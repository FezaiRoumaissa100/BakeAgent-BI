import math
from datetime import datetime, date
from db import sql_fetch_all, sql_fetch_one, sql_value, is_pg_available
from config import RISQUE_SEUIL_ELEVE, RISQUE_SEUIL_VIGILANCE, RISQUE_SEUIL_FAIBLE

def safe_num(v, default=0.0):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return default
    return float(v)

# Les clés de statut sont conservées pour la compatibilité avec l'agent ;
# leur sens est donné par STATUT_LABEL (le stock réel n'étant pas connu).
COLOR_STATUT = {
    'RUPTURE': '#E24B4A',
    'VIGILANCE': '#EF9F27',
    'NORMAL': '#639922',
    'SURSTOCK': '#378ADD',
    'FERMÉ': '#B4B2A9',
}

STATUT_LABEL = {
    'RUPTURE': 'Risque de manque',
    'VIGILANCE': 'À surveiller',
    'NORMAL': 'Normal',
    'SURSTOCK': "Risque d'invendus",
    'FERMÉ': 'Fermé',
}

JOURS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
MOIS_FR = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
           'août', 'septembre', 'octobre', 'novembre', 'décembre']


def _production_habituelle():
    """
    Production habituelle estimée = moyenne des articles vendus les jours ouverts,
    par (jour de la semaine, mois), sur tout l'historique. Repli : moyenne par jour de la semaine.
    """
    rows = sql_fetch_all("""
        SELECT d.day_of_week, d.month, AVG(a.nb_articles) AS moy
        FROM daily_aggregates a
        JOIN dim_dates d ON d.date_id = a.date_id
        WHERE a.nb_articles > 0
        GROUP BY d.day_of_week, d.month
    """)
    par_mois = {(int(r['day_of_week']), int(r['month'])): safe_num(r['moy']) for r in rows}
    rows_dow = sql_fetch_all("""
        SELECT d.day_of_week, AVG(a.nb_articles) AS moy
        FROM daily_aggregates a
        JOIN dim_dates d ON d.date_id = a.date_id
        WHERE a.nb_articles > 0
        GROUP BY d.day_of_week
    """)
    par_jour = {int(r['day_of_week']): safe_num(r['moy']) for r in rows_dow}
    return par_mois, par_jour


def get_alerts_data_pg(mois_filter="Tout"):
    """
    Risque de manque estimé par jour sur la prévision estivale.
    Le stock réel n'étant pas enregistré, chaque jour est comparé au jour type de la période
    (médiane de la prévision du même jour de la semaine, le même mois).
    """
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    # Prix moyen réellement encaissé par article vendu (CA total / quantité totale)
    prix_article = safe_num(sql_value(
        "SELECT SUM(total_revenue) / NULLIF(SUM(quantity), 0) FROM fact_ticket_lines"
    ), 2.42)

    par_mois, par_jour = _production_habituelle()

    # Prix moyen par article du même mois l'année précédente (le panier d'été diffère du reste de l'année)
    prix_mois = {int(r['m']): safe_num(r['p']) for r in sql_fetch_all("""
        SELECT EXTRACT(MONTH FROM date_id)::int AS m, SUM(ca_jour) / NULLIF(SUM(nb_articles), 0) AS p
        FROM daily_aggregates
        WHERE date_id >= (SELECT MAX(date_id) FROM daily_aggregates) - INTERVAL '1 year'
        GROUP BY 1
    """) if r['p'] is not None}

    # Prévision de saison du pipeline (forecasting/pipeline.py, vérifiée) si disponible ;
    # sinon dernier modèle de saison du notebook (ex. « saison_2026 »).
    from db_forecast_engine import shop_source
    src = shop_source()
    if src:
        forecast_raw = sql_fetch_all("""
            SELECT ds, yhat, yhat_lower, yhat_upper, ca, is_ferme
            FROM shop_forecasts WHERE run_id = %s AND kind = 'saison' ORDER BY ds
        """, (src[0]["run_id"],))
    else:
        season_model = sql_value(
            "SELECT model_name FROM prophet_forecasts WHERE model_name LIKE 'saison_%%' ORDER BY model_name DESC LIMIT 1"
        ) or "saison_2026"
        forecast_raw = sql_fetch_all("""
            SELECT ds, yhat, yhat_lower, yhat_upper
            FROM prophet_forecasts
            WHERE model_name = %s
            ORDER BY ds
        """, (season_model,))

    if not forecast_raw:
        return {"empty": True}

    # Jour type de la période : médiane de la prévision centrale pour le même jour
    # de la semaine, le même mois (jours ouverts). C'est la quantité que le gérant
    # prépare « un lundi normal de juin » ; un jour qui s'en écarte nettement est à surveiller.
    from statistics import median
    groupes = {}
    for r in forecast_raw:
        y = safe_num(r['yhat'])
        if y > 0:
            groupes.setdefault((r['ds'].weekday(), r['ds'].month), []).append(y)
    jour_type = {k: median(v) for k, v in groupes.items()}

    days_data = []
    for r in forecast_raw:
        ds_date = r['ds']
        yhat = safe_num(r['yhat'])
        yhat_lower = safe_num(r['yhat_lower'])
        yhat_upper = safe_num(r['yhat_upper'])
        dow = ds_date.weekday()
        reference = jour_type.get((dow, ds_date.month), 0.0)
        historique = par_mois.get((dow, ds_date.month)) or par_jour.get(dow) or 0.0

        ratio = (yhat / reference) if reference > 0 else 0.0
        ratio_pct = safe_num(ratio * 100)

        if yhat == 0 or r.get('is_ferme'):
            statut = 'FERMÉ'
        elif ratio >= RISQUE_SEUIL_ELEVE:
            statut = 'RUPTURE'
        elif ratio >= RISQUE_SEUIL_VIGILANCE:
            statut = 'VIGILANCE'
        elif ratio >= RISQUE_SEUIL_FAIBLE:
            statut = 'NORMAL'
        else:
            statut = 'SURSTOCK'

        # Articles qui manqueraient si l'on préparait comme un jour type
        manque = max(0.0, yhat - reference) if statut in ('RUPTURE', 'VIGILANCE') else 0.0
        jour = JOURS_FR[dow]
        if statut == 'FERMÉ':
            raison = "Boutique fermée"
        elif reference > 0:
            ecart = round((ratio - 1) * 100)
            sens = "au-dessus" if ecart >= 0 else "en dessous"
            raison = (f"Demande prévue {abs(ecart)} % {sens} d'un {jour.lower()} type "
                      f"de {MOIS_FR[ds_date.month]} ({int(round(reference))} articles)")
        else:
            raison = "Pas de jour comparable"

        days_data.append({
            "ds": ds_date.strftime('%Y-%m-%d'),
            "date_fr": ds_date.strftime('%d/%m/%Y'),
            "jour_semaine": jour,
            "yhat": int(round(yhat)),
            "yhat_lower": int(round(yhat_lower)),
            "yhat_upper": int(round(yhat_upper)),
            "jour_type": int(round(reference)),
            "moyenne_historique": int(round(historique)),
            "ca_prevu": safe_num(r['ca']) if r.get('ca') is not None else safe_num(yhat * prix_mois.get(ds_date.month, prix_article)),
            "prix_article": (safe_num(r['ca']) / yhat) if (r.get('ca') is not None and yhat > 0) else prix_mois.get(ds_date.month, prix_article),
            "ratio_pct": ratio_pct,
            # Produits frais vendus le jour même : préparer la prévision haute du jour
            "commande_recommandee": int(round(yhat_upper)) if yhat > 0 else 0,
            "manque_estime": int(round(manque)),
            "statut": statut,
            "statut_label": STATUT_LABEL[statut],
            "raison": raison,
            "bar_color": COLOR_STATUT.get(statut, '#B4B2A9'),
        })

    # Filtrage par mois : appliqué aux jours ET aux indicateurs
    # Mois couverts par la prévision (et non une liste fixe juin–septembre)
    mois_prevus = sorted({int(d['ds'][5:7]) for d in days_data})
    mois_num = {MOIS_FR[m].capitalize(): m for m in mois_prevus}
    annee_prevue = int(days_data[0]['ds'][:4]) if days_data else None
    if mois_filter in mois_num:
        m = mois_num[mois_filter]
        filtered_days = [d for d in days_data if int(d['ds'][5:7]) == m]
    else:
        filtered_days = days_data

    statuts = {k: 0 for k in COLOR_STATUT}
    for d in filtered_days:
        statuts[d['statut']] += 1

    open_days = [d for d in filtered_days if d['yhat'] > 0]
    total_articles = sum(d['yhat'] for d in open_days)
    ca_total_prevu = sum(d['ca_prevu'] for d in open_days)
    # Ventes perdues estimées si l'on produit comme d'habitude les jours à risque
    ca_risque = sum(d['manque_estime'] * d['prix_article'] for d in filtered_days)

    if open_days:
        pic_day = max(open_days, key=lambda x: x['yhat'])
        pic_val, pic_date = pic_day['yhat'], pic_day['date_fr']
    else:
        pic_val, pic_date = 0, ""

    # Ventes réelles des mêmes mois l'année précédant la prévision, pour comparer
    mois_list = [mois_num[mois_filter]] if mois_filter in mois_num else mois_prevus
    annee_n1 = (annee_prevue - 1) if annee_prevue else None
    n1 = sql_fetch_one("""
        SELECT SUM(a.nb_articles) AS art, SUM(a.ca_jour) AS ca
        FROM daily_aggregates a
        WHERE EXTRACT(YEAR FROM a.date_id) = %s AND EXTRACT(MONTH FROM a.date_id) = ANY(%s)
    """, (annee_n1, mois_list)) or {}
    articles_n1 = safe_num(n1.get('art'))
    ca_n1 = safe_num(n1.get('ca'))

    jours_a_surveiller = sorted(
        [d for d in filtered_days if d['statut'] in ('RUPTURE', 'VIGILANCE')],
        key=lambda d: d['ratio_pct'], reverse=True
    )[:5]

    return {
        "kpis": {
            "total_articles": total_articles,
            "ca_total_prevu": ca_total_prevu,
            "ca_risque": ca_risque,
            "prix_moyen_article": (ca_total_prevu / total_articles) if total_articles else prix_article,
            "pic_val": pic_val,
            "pic_date": pic_date,
            "statuts": statuts,
            "statut_labels": STATUT_LABEL,
            "articles_n1": articles_n1,
            "ca_n1": ca_n1,
            "annee_n1": annee_n1,
        },
        "jours_a_surveiller": jours_a_surveiller,
        "methodologie": (
            "Risque estimé : chaque jour est comparé au jour type de la période (même jour de la semaine, "
            "même mois). Un jour nettement plus chargé risque de manquer si l'on prépare comme d'habitude. "
            "Le stock réel n'est pas enregistré ; la quantité conseillée est la prévision haute du jour."
        ),
        "days": filtered_days,
        "available_mois": ['Tout'] + list(mois_num.keys()),
    }
