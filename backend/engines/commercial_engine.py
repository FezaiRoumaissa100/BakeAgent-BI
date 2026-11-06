import math
from datetime import datetime
from db.db import sql_fetch_all, sql_fetch_one, sql_value, is_pg_available
from config import np_sql

def safe_num(v, default=0.0):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return default
    # Handle Decimal type from PostgreSQL
    from decimal import Decimal
    if isinstance(v, Decimal):
        return float(v)
    return float(v)

MOIS_COURT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
             'septembre', 'octobre', 'novembre', 'décembre']


import time as _time
_PERF_CACHE = {}
_PERF_TTL = 300  # secondes : une même demande (mêmes filtres) est resservie pendant 5 minutes


def calculate_commercial_performance_pg(annee="Toutes", saison="Toutes", mois="Tous", categorie="Toutes", evenement="Tous"):
    """Mémorise les réponses récentes : revenir sur une période déjà vue est immédiat."""
    key = (annee, saison, mois, categorie, evenement)
    hit = _PERF_CACHE.get(key)
    if hit and _time.time() - hit[0] < _PERF_TTL:
        return hit[1]
    res = _calculate_commercial_performance_pg(annee, saison, mois, categorie, evenement)
    if len(_PERF_CACHE) > 60:
        _PERF_CACHE.clear()
    _PERF_CACHE[key] = (_time.time(), res)
    return res


def _calculate_commercial_performance_pg(annee="Toutes", saison="Toutes", mois="Tous", categorie="Toutes", evenement="Tous"):
    """
    Version PostgreSQL de calculate_commercial_performance
    """
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    where_clauses = []
    params = []
    year_int = None

    # Une ou plusieurs années (« 2025 » ou « 2016,2019 ») ; la comparaison se fait sur la plus récente
    years_sel = []
    if annee != "Toutes":
        try:
            years_sel = sorted({int(x) for x in str(annee).split(",") if x.strip()})
        except ValueError:
            years_sel = []  # Si l'année n'est pas valide, ignorer le filtre
        if years_sel:
            year_int = years_sel[-1]
            where_clauses.append("EXTRACT(YEAR FROM d.date_id) IN (" + ",".join(["%s"] * len(years_sel)) + ")")
            params.extend(years_sel)
    # Si "Toutes", pas de filtre sur l'année

    if saison != "Toutes":
        where_clauses.append("s.season_name = %s")
        params.append(saison)

    if mois != "Tous":
        mois_num = ["Tous", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                   "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].index(mois)
        where_clauses.append("EXTRACT(MONTH FROM d.date_id) = %s")
        params.append(mois_num)

    if categorie != "Toutes":
        where_clauses.append("c.category_name = %s")
        params.append(categorie)

    if evenement != "Tous":
        where_clauses.append("e.event_name = %s")
        params.append(evenement)

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # Mêmes filtres sans l'année (pour la comparaison 2024 / 2025 et l'année précédente)
    where_no_year = [w for w in where_clauses if not w.startswith("EXTRACT(YEAR")]
    params_no_year = params[len(years_sel):] if years_sel else list(params)
    where_no_year_sql = " AND ".join(where_no_year) if where_no_year else "1=1"

    BASE_JOINS = """
    FROM fact_ticket_lines f
    JOIN dim_dates d ON f.date_id = d.date_id
    JOIN dim_products p ON f.product_id = p.product_id
    LEFT JOIN dim_categories c ON p.category_id = c.category_id
    LEFT JOIN dim_seasons s ON d.season_id = s.season_id
    LEFT JOIN dim_events e ON f.event_id = e.event_id
    """

    kpis_query = f"""
    SELECT
        SUM(f.total_revenue) as total_ca,
        COUNT(DISTINCT (f.date_id::text || '|' || f.ticket_number::text)) as nb_tickets,
        COUNT(DISTINCT f.date_id) as nb_jours,
        -- jours OUVERTS (daily_aggregates) : un jour de fermeture avec quelques ventes isolées n'en est pas un
        COUNT(DISTINCT f.date_id) FILTER (WHERE (NOT EXISTS (SELECT 1 FROM daily_aggregates) OR f.date_id IN (SELECT date_id FROM daily_aggregates))) as nb_jours_ouverts,
        COUNT(DISTINCT f.product_id) as nb_produits,
        MIN(f.date_id) as d_min, MAX(f.date_id) as d_max
    FROM fact_ticket_lines f
    JOIN dim_dates d ON f.date_id = d.date_id
    JOIN dim_products p ON f.product_id = p.product_id
    LEFT JOIN dim_categories c ON p.category_id = c.category_id
    LEFT JOIN dim_seasons s ON d.season_id = s.season_id
    LEFT JOIN dim_events e ON f.event_id = e.event_id
    WHERE {where_sql}
    """

    kpis = sql_fetch_one(kpis_query, tuple(params))

    if not kpis or kpis['total_ca'] is None:
        return {"empty": True}

    total_ca = safe_num(kpis['total_ca'])
    nb_tickets = int(kpis['nb_tickets'] or 0)
    nb_jours = int(kpis['nb_jours'] or 0)
    nb_jours_ouverts = int(kpis['nb_jours_ouverts'] or 0)
    nb_produits = int(kpis['nb_produits'] or 0)
    panier = total_ca / nb_tickets if nb_tickets > 0 else 0.0

    # Courbe mensuelle : calculée sur les mêmes filtres que les indicateurs
    monthly_data_raw = sql_fetch_all(f"""
    SELECT DATE_TRUNC('month', f.date_id)::date AS month_start,
           SUM(f.total_revenue) AS total_revenue
    {BASE_JOINS}
    WHERE {where_sql}
    GROUP BY 1
    ORDER BY 1
    """, tuple(params))

    monthly_data = []
    for r in monthly_data_raw:
        ms = r['month_start']
        monthly_data.append({
            "date": ms.strftime('%Y-%m-%d'),
            "label": f"{MOIS_COURT[ms.month - 1]} {ms.year}",
            "label_long": f"{MOIS_LONG[ms.month - 1]} {ms.year}",
            "ca": safe_num(r['total_revenue'])
        })

    # Un seul mois choisi (ex. jour choisi dans la barre du haut) : la courbe mensuelle n'a qu'un point,
    # on ajoute donc le chiffre d'affaires jour par jour de ce mois (mêmes filtres)
    daily_data = []
    if len(monthly_data) <= 1:
        for r in sql_fetch_all(f"""
        SELECT f.date_id AS d, SUM(f.total_revenue) AS total_revenue
        {BASE_JOINS}
        WHERE {where_sql}
        GROUP BY 1
        ORDER BY 1
        """, tuple(params)):
            dd = r['d']
            daily_data.append({"date": dd.strftime('%Y-%m-%d'), "ca": safe_num(r['total_revenue'])})

    if monthly_data:
        vals = [d['ca'] for d in monthly_data]
        moyenne = safe_num(sum(vals) / len(vals))
        ecart_type = safe_num(math.sqrt(sum((v - moyenne) ** 2 for v in vals) / len(vals)))
        ca_max = max(monthly_data, key=lambda x: x['ca'])
        ca_min = min(monthly_data, key=lambda x: x['ca'])
        amplitude = ca_max['ca'] - ca_min['ca']
        ratio_amp = safe_num(ca_max['ca'] / max(ca_min['ca'], 1.0))
        ca_max_obj = {"date_str": ca_max["date"], "label": ca_max["label_long"], "val": ca_max["ca"]}
        ca_min_obj = {"date_str": ca_min["date"], "label": ca_min["label_long"], "val": ca_min["ca"]}
    else:
        moyenne = ecart_type = amplitude = ratio_amp = 0
        ca_max_obj = {"date_str": "", "label": "", "val": 0}
        ca_min_obj = {"date_str": "", "label": "", "val": 0}

    # Comparaison de deux années, mois par mois (tous filtres sauf l'année).
    # Le nom du champ « comp_24_25 » est conservé pour l'agent ; les années réelles sont dans « comp_annees ».
    # Années, mois et premiers / derniers jours de vente : une seule lecture de la table pour tout ce qui suit
    ym_rows = sql_fetch_all(
        "SELECT EXTRACT(YEAR FROM date_id)::int AS y, EXTRACT(MONTH FROM date_id)::int AS m, MIN(date_id) AS d0, MAX(date_id) AS d1 "
        "FROM fact_ticket_lines GROUP BY 1, 2")
    all_years = sorted({int(r['y']) for r in ym_rows})
    year_bounds = {}
    for r in ym_rows:
        y = int(r['y']); b0, b1 = year_bounds.get(y, (r['d0'], r['d1']))
        year_bounds[y] = (min(b0, r['d0']), max(b1, r['d1']))
    yrs = list(all_years)
    # Un mois choisi : on ne compare que des années qui ont des ventes ce mois-là (ex. mars 2015 face à mars 2014)
    if mois != "Tous":
        m_num = ["Tous", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].index(mois)
        yrs = sorted({int(r['y']) for r in ym_rows if int(r['m']) == m_num})
    comp_24_25, comp_annees = [], None
    # Une année choisie : on la compare à l'année d'avant (si elle existe) ; sinon les deux dernières années
    pair = None
    if year_int:
        if year_int in yrs and (year_int - 1) in yrs:
            pair = (year_int - 1, year_int)
    elif len(yrs) >= 2:
        pair = (yrs[-2], yrs[-1])
    if pair:
        y_prec, y_der = pair
        comp_annees = {"prec": y_prec, "der": y_der}
        comp_raw = sql_fetch_all(f"""
        SELECT EXTRACT(YEAR FROM f.date_id)::int AS y, EXTRACT(MONTH FROM f.date_id)::int AS m,
               SUM(f.total_revenue) AS ca
        {BASE_JOINS}
        WHERE {where_no_year_sql} AND EXTRACT(YEAR FROM f.date_id) IN (%s, %s)
        GROUP BY 1, 2
        """, tuple(params_no_year) + (y_prec, y_der))
        comp = {(int(r['y']), int(r['m'])): safe_num(r['ca']) for r in comp_raw}
        comp_24_25 = [{
            "mois": MOIS_COURT[m - 1],
            "ca_prec": comp.get((y_prec, m), 0.0),
            "ca_der": comp.get((y_der, m), 0.0),
            f"ca_{y_prec}": comp.get((y_prec, m), 0.0),
            f"ca_{y_der}": comp.get((y_der, m), 0.0),
        } for m in range(1, 13)]

    par_annee = {}
    # Totaux par année : seulement utiles sans année choisie (la page compare ensuite sur la même période, plus bas)
    for r in ([] if years_sel else sql_fetch_all(f"""
        SELECT EXTRACT(YEAR FROM f.date_id)::int AS y, SUM(f.total_revenue) AS ca,
               COUNT(DISTINCT (f.date_id::text || '|' || f.ticket_number::text)) AS tk
        {BASE_JOINS}
        WHERE {where_no_year_sql}
        GROUP BY 1 ORDER BY 1
    """, tuple(params_no_year))):
        ca_y, tk_y = safe_num(r['ca']), int(r['tk'] or 0)
        par_annee[str(int(r['y']))] = {"total_ca": ca_y, "nb_tickets": tk_y, "panier": ca_y / tk_y if tk_y else 0.0}

    # Année précédente (mêmes filtres) quand une année est choisie
    kpis_n1 = None
    if year_int and len(years_sel) == 1:
        r1 = sql_fetch_one(f"""
        SELECT SUM(f.total_revenue) AS total_ca,
               COUNT(DISTINCT (f.date_id::text || '|' || f.ticket_number::text)) AS nb_tickets
        {BASE_JOINS}
        WHERE {where_no_year_sql} AND EXTRACT(YEAR FROM f.date_id) = %s
        """, tuple(params_no_year) + (year_int - 1,))
        if r1 and r1['total_ca'] is not None:
            ca1, t1 = safe_num(r1['total_ca']), int(r1['nb_tickets'] or 0)
            kpis_n1 = {"annee": year_int - 1, "total_ca": ca1, "nb_tickets": t1,
                       "panier": ca1 / t1 if t1 else 0.0}

    # Comparaison d'une année avec la précédente SUR LA MÊME PÉRIODE de l'année :
    # si une année n'est pas complète (ex. données jusqu'au 15 mars), on compare 1er jan – 15 mars des deux côtés.
    comp_kpis = None
    pair_k = None
    if year_int:
        if year_int in yrs and (year_int - 1) in yrs:
            pair_k = (year_int - 1, year_int)
    elif len(yrs) >= 2:
        pair_k = (yrs[-2], yrs[-1])
    if pair_k:
        bounds = year_bounds
        a, b = bounds.get(pair_k[0]), bounds.get(pair_k[1])
        if a and b:
            # Un jour de fermeture en début ou fin d'année (ex. 1er janvier) ne doit pas couper la période :
            # une année qui commence dans ses 14 premiers jours compte comme commencée au 1er janvier (idem en fin d'année)
            def md_start(d0):
                return "01-01" if d0.timetuple().tm_yday <= 14 else d0.strftime('%m-%d')
            def md_end(d1):
                return "12-31" if (d1.replace(month=12, day=31) - d1).days < 14 else d1.strftime('%m-%d')
            md0 = max(md_start(a[0]), md_start(b[0]))
            md1 = min(md_end(a[1]), md_end(b[1]))
            if md0 <= md1:
                # Les deux années en une seule lecture
                kk = {int(r['y']): r for r in sql_fetch_all(f"""
                SELECT EXTRACT(YEAR FROM f.date_id)::int AS y, SUM(f.total_revenue) AS ca,
                       COUNT(DISTINCT (f.date_id::text || '|' || f.ticket_number::text)) AS tk
                {BASE_JOINS}
                WHERE {where_no_year_sql} AND EXTRACT(YEAR FROM f.date_id) IN (%s, %s)
                  AND TO_CHAR(f.date_id, 'MM-DD') BETWEEN %s AND %s
                GROUP BY 1
                """, tuple(params_no_year) + (pair_k[0], pair_k[1], md0, md1))}
                def k_of(y):
                    r = kk.get(y) or {}
                    ca_v, tk_v = safe_num(r.get('ca')), int(r.get('tk') or 0)
                    return {"total_ca": ca_v, "nb_tickets": tk_v, "panier": ca_v / tk_v if tk_v else 0.0}
                comp_kpis = {"prec": pair_k[0], "der": pair_k[1], "debut": md0, "fin": md1,
                             "complet": md0 == "01-01" and md1 == "12-31",
                             "kpis_prec": k_of(pair_k[0]), "kpis_der": k_of(pair_k[1])}

    top_ca_query = f"""
    SELECT
        p.article_name as article,
        SUM(f.total_revenue) as total_revenue
    FROM fact_ticket_lines f
    JOIN dim_products p ON f.product_id = p.product_id
    JOIN dim_dates d ON f.date_id = d.date_id
    LEFT JOIN dim_categories c ON p.category_id = c.category_id
    LEFT JOIN dim_seasons s ON d.season_id = s.season_id
    LEFT JOIN dim_events e ON f.event_id = e.event_id
    WHERE {where_sql}{np_sql('f.')}
    GROUP BY p.article_name
    ORDER BY total_revenue DESC
    LIMIT 20
    """

    top_ca_raw = sql_fetch_all(top_ca_query, tuple(params))
    top_ca_list = []
    for r in top_ca_raw:
        rev = safe_num(r['total_revenue'])
        part = safe_num(rev / max(total_ca, 1.0) * 100)
        top_ca_list.append({
            "article": r['article'],
            "total_revenue": rev,
            "part": part
        })

    cumul = 0
    for item in top_ca_list:
        cumul += item['part']
        item['cumul'] = round(cumul, 1)

    top_qte_query = f"""
    SELECT
        p.article_name as article,
        SUM(f.quantity) as quantity
    FROM fact_ticket_lines f
    JOIN dim_products p ON f.product_id = p.product_id
    JOIN dim_dates d ON f.date_id = d.date_id
    LEFT JOIN dim_categories c ON p.category_id = c.category_id
    LEFT JOIN dim_seasons s ON d.season_id = s.season_id
    LEFT JOIN dim_events e ON f.event_id = e.event_id
    WHERE {where_sql}{np_sql('f.')}
    GROUP BY p.article_name
    ORDER BY quantity DESC
    LIMIT 20
    """

    top_qte_raw = sql_fetch_all(top_qte_query, tuple(params))
    top_qte_list = [{"article": r['article'], "quantity": safe_num(r['quantity'])} for r in top_qte_raw]

    top_tkt_query = f"""
    SELECT
        p.article_name as article,
        COUNT(DISTINCT (f.date_id::text || '|' || f.ticket_number::text)) as nb_tkt
    FROM fact_ticket_lines f
    JOIN dim_products p ON f.product_id = p.product_id
    JOIN dim_dates d ON f.date_id = d.date_id
    LEFT JOIN dim_categories c ON p.category_id = c.category_id
    LEFT JOIN dim_seasons s ON d.season_id = s.season_id
    LEFT JOIN dim_events e ON f.event_id = e.event_id
    WHERE {where_sql}{np_sql('f.')}
    GROUP BY p.article_name
    ORDER BY nb_tkt DESC
    LIMIT 20
    """

    top_tkt_raw = sql_fetch_all(top_tkt_query, tuple(params))
    top_tkt_list = [{"article": r['article'], "nb_tkt": int(r['nb_tkt'] or 0)} for r in top_tkt_raw]

    # Parts du total pour la quantité (quantité totale) et les tickets (% des tickets qui contiennent le produit)
    qte_tot = safe_num((sql_fetch_one(f"""
    SELECT SUM(f.quantity) AS q
    {BASE_JOINS}
    WHERE {where_sql}{np_sql('f.')}
    """, tuple(params)) or {}).get('q'))
    for it in top_qte_list:
        it["part"] = safe_num(it["quantity"] / qte_tot * 100) if qte_tot else 0.0
    for it in top_tkt_list:
        it["part"] = safe_num(it["nb_tkt"] / nb_tickets * 100) if nb_tickets else 0.0

    # Tendance de chaque produit : même période, année de comparaison face à l'année d'avant (comme les indicateurs)
    if comp_kpis:
        y_a, y_b, md0, md1 = comp_kpis["prec"], comp_kpis["der"], comp_kpis["debut"], comp_kpis["fin"]
        tr_rows = sql_fetch_all(f"""
        SELECT p.article_name AS article, EXTRACT(YEAR FROM f.date_id)::int AS y,
               SUM(f.total_revenue) AS ca, SUM(f.quantity) AS q, COUNT(DISTINCT (f.date_id::text || '|' || f.ticket_number::text)) AS tk
        {BASE_JOINS}
        WHERE {where_no_year_sql}{np_sql('f.')} AND EXTRACT(YEAR FROM f.date_id) IN (%s, %s)
          AND TO_CHAR(f.date_id, 'MM-DD') BETWEEN %s AND %s
        GROUP BY 1, 2
        """, tuple(params_no_year) + (y_a, y_b, md0, md1))
        tr_map = {}
        for r in tr_rows:
            tr_map.setdefault(r['article'], {})[int(r['y'])] = (safe_num(r['ca']), safe_num(r['q']), int(r['tk'] or 0))
        def evo(art, k):
            m = tr_map.get(art, {})
            a, b = m.get(y_a), m.get(y_b)
            if not a or not b or not a[k]:
                return None
            return safe_num((b[k] - a[k]) / a[k] * 100)
        for it in top_ca_list:
            it["evo"] = evo(it["article"], 0)
        for it in top_qte_list:
            it["evo"] = evo(it["article"], 1)
        for it in top_tkt_list:
            it["evo"] = evo(it["article"], 2)

    dow_query = f"""
    SELECT
        d.day_of_week,
        SUM(f.total_revenue) as ca_total,
        COUNT(DISTINCT d.date_id) as nb_jours
    FROM fact_ticket_lines f
    JOIN dim_dates d ON f.date_id = d.date_id
    JOIN dim_products p ON f.product_id = p.product_id
    LEFT JOIN dim_categories c ON p.category_id = c.category_id
    LEFT JOIN dim_seasons s ON d.season_id = s.season_id
    LEFT JOIN dim_events e ON f.event_id = e.event_id
    WHERE {where_sql}
      -- moyenne par jour OUVERT : les ventes isolées d'un jour de fermeture (ex. un lundi fermé) ne forment pas un jour
      AND (NOT EXISTS (SELECT 1 FROM daily_aggregates) OR f.date_id IN (SELECT date_id FROM daily_aggregates))
    GROUP BY d.day_of_week
    ORDER BY d.day_of_week
    """

    dow_raw = sql_fetch_all(dow_query, tuple(params))
    labels_dow = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

    dow_dict = {r['day_of_week']: r for r in dow_raw}
    seasonality_days = []
    for i in range(7):
        r = dow_dict.get(i, {'ca_total': 0, 'nb_jours': 1})
        ca_tot = safe_num(r.get('ca_total', 0))
        nb_j = int(r.get('nb_jours', 1) or 1)
        ca_moyen = safe_num(ca_tot / max(nb_j, 1))
        seasonality_days.append({
            "day": labels_dow[i],
            "ca_total": ca_tot,
            "ca_moyen": ca_moyen,
            # Nombre de jours ouverts : un jour rarement ouvert (ex. mercredi, ouvert seulement les jours de fête)
            # ne doit pas être comparé aux autres
            "nb_jours": nb_j if i in dow_dict else 0,
        })

    hourly_query = f"""
    SELECT
        f.hour,
        SUM(f.total_revenue) as ca,
        COUNT(DISTINCT (f.date_id::text || '|' || f.ticket_number::text)) as tickets
    FROM fact_ticket_lines f
    JOIN dim_dates d ON f.date_id = d.date_id
    JOIN dim_products p ON f.product_id = p.product_id
    LEFT JOIN dim_categories c ON p.category_id = c.category_id
    LEFT JOIN dim_seasons s ON d.season_id = s.season_id
    LEFT JOIN dim_events e ON f.event_id = e.event_id
    WHERE {where_sql}
      AND f.hour IS NOT NULL
    GROUP BY f.hour
    ORDER BY f.hour
    """

    hourly_raw = sql_fetch_all(hourly_query, tuple(params))

    # Jour × heure : chiffre d'affaires et tickets d'une heure, pour un jour d'ouverture habituel de ce jour de la semaine
    heat_raw = sql_fetch_all(f"""
    SELECT d.day_of_week AS dow, f.hour AS h, SUM(f.total_revenue) AS ca,
           COUNT(DISTINCT (f.date_id::text || '|' || f.ticket_number::text)) AS tk
    {BASE_JOINS}
    WHERE {where_sql}
      AND f.hour IS NOT NULL
      AND (NOT EXISTS (SELECT 1 FROM daily_aggregates) OR f.date_id IN (SELECT date_id FROM daily_aggregates))
    GROUP BY 1, 2
    """, tuple(params))
    heatmap = []
    for r in heat_raw:
        dw = int(r['dow']); nj = int((dow_dict.get(dw) or {}).get('nb_jours') or 0)
        if nj <= 0:
            continue
        heatmap.append({"dow": dw, "hour": int(r['h']), "ca_moy": safe_num(r['ca']) / nj, "tk_moy": int(r['tk'] or 0) / nj})
    hourly_dist = []
    for r in hourly_raw:
        h = int(r['hour']) if r['hour'] is not None else 0
        hourly_dist.append({
            "hour": h,
            "heure_label": f"{h:02d}h",
            "ca": safe_num(r['ca']),
            "tickets": int(r['tickets'] or 0)
        })

    cat_query = f"""
    SELECT
        c.category_name as category,
        SUM(f.total_revenue) as ca,
        SUM(f.total_revenue) / NULLIF(COUNT(DISTINCT (f.date_id::text || '|' || f.ticket_number::text)), 0) as panier,
        AVG(f.total_revenue) as montant_ligne,
        COUNT(DISTINCT (f.date_id::text || '|' || f.ticket_number::text)) as tickets,
        COUNT(DISTINCT f.product_id) as produits
    FROM fact_ticket_lines f
    JOIN dim_products p ON f.product_id = p.product_id
    JOIN dim_categories c ON p.category_id = c.category_id
    JOIN dim_dates d ON f.date_id = d.date_id
    LEFT JOIN dim_seasons s ON d.season_id = s.season_id
    LEFT JOIN dim_events e ON f.event_id = e.event_id
    WHERE {where_sql} AND c.category_name IS NOT NULL AND c.category_name != 'A CLASSIFIER'
    GROUP BY c.category_name
    ORDER BY ca DESC
    """

    cat_raw = sql_fetch_all(cat_query, tuple(params))
    total_cat_ca = sum(safe_num(r['ca']) for r in cat_raw) if cat_raw else 1.0
    if total_cat_ca <= 0:
        total_cat_ca = 1.0

    categories_summary = []
    for r in cat_raw:
        categories_summary.append({
            "category": r['category'],
            "ca": safe_num(r['ca']),
            "part": safe_num(safe_num(r['ca']) / total_cat_ca * 100),
            # Dépense moyenne dans la catégorie par ticket qui la contient
            "panier": safe_num(r['panier']),
            "montant_ligne": safe_num(r['montant_ligne']),
            "tickets": int(r['tickets'] or 0),
            "produits": int(r['produits'] or 0)
        })

    categories_list = ["Toutes"] + sorted([r['category_name'] for r in sql_fetch_all("SELECT DISTINCT category_name FROM dim_categories WHERE category_name IS NOT NULL AND category_name != 'A CLASSIFIER' ORDER BY category_name")])
    events_list = ["Tous"] + sorted([r['event_name'] for r in sql_fetch_all("SELECT DISTINCT event_name FROM dim_events WHERE event_name IS NOT NULL AND event_name != 'Jour Normal' ORDER BY event_name")])
    
    # Récupérer dynamiquement les années disponibles
    available_years = sorted(all_years, reverse=True)
    
    # Construire la liste des options d'années : "Toutes" + années individuelles
    annees_options = ["Toutes"] + [str(y) for y in available_years]

    return {
        "kpis": {
            "total_ca": total_ca,
            "nb_tickets": nb_tickets,
            "panier": panier,
            "nb_jours": nb_jours,
            "nb_jours_ouverts": nb_jours_ouverts,
            "nb_produits": nb_produits
        },
        "kpis_n1": kpis_n1,
        "kpis_par_annee": par_annee,
        "comp_kpis": comp_kpis,
        "periode": {"debut": str(kpis.get('d_min')), "fin": str(kpis.get('d_max'))},
        "monthly": {
            "series": monthly_data,
            "daily": daily_data,
            "moyenne": moyenne,
            "ecart_type": ecart_type,
            "ca_max": ca_max_obj,
            "ca_min": ca_min_obj,
            "amplitude": amplitude,
            "ratio_amp": ratio_amp,
            "comp_24_25": comp_24_25,
            "comp_annees": comp_annees
        },
        "top_products": {
            "by_ca": top_ca_list,
            "by_qte": top_qte_list,
            "by_tkt": top_tkt_list
        },
        "seasonality": {
            "days": seasonality_days,
            "hourly": hourly_dist,
            "heatmap": heatmap
        },
        "categories": categories_summary,
        "available_filters": {
            "annees": annees_options,
            "saisons": ["Toutes", "Printemps", "Ete", "Automne", "Hiver"],
            "mois": ["Tous", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
            "categories": categories_list,
            "evenements": events_list
        }
    }
