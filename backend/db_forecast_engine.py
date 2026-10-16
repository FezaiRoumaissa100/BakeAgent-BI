import math
from datetime import datetime, date, timedelta
from db import sql_fetch_all, sql_fetch_one, sql_value, is_pg_available

def safe_num(v, default=0.0):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return default
    return float(v)

def shop_source():
    """Dernier calcul de forecasting/pipeline.py contenant la prévision de toute la boutique (table shop_forecasts).
    None si le pipeline n'a pas encore été lancé : on se replie alors sur la prévision Prophet du notebook."""
    import json
    try:
        # Dernier calcul seulement : si la prévision boutique n'a pas pu y être calculée, on ne ressert pas
        # silencieusement un calcul plus ancien (dates peut-être déjà passées).
        run = sql_fetch_one("SELECT * FROM product_forecast_runs ORDER BY run_id DESC LIMIT 1")
        if not run or not sql_value("SELECT COUNT(*) FROM shop_forecasts WHERE run_id = %s AND ds > %s",
                                    (run["run_id"], run["data_end"])):
            return None
    except Exception:
        return None
    try:
        notes = json.loads(run.get("notes") or "{}").get("boutique", {}) or {}
    except Exception:
        notes = {}
    return run, notes


def get_forecast_data_pg(horizon=14, forecast_type="articles", product=None, category=None,
                        season=None, event=None, history_period="all"):
    """
    Version PostgreSQL de get_forecast_data
    Utilise les tables prophet_forecasts, ml_metrics et fact_ticket_lines
    """
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")
    
    # Une seule prévision Prophet est disponible : J+1 à J+14 (« 14j_global »).
    # L'horizon 7 jours en est les 7 premiers jours ; au-delà de 14 jours, aucune prévision n'existe.
    horizon = 7 if int(horizon or 14) <= 7 else 14
    model_name = "14j_global"
    src = shop_source()   # prévision du pipeline (vérifiée) si disponible ; sinon Prophet (notebook)

    # Prix moyen réellement encaissé par article (pour le chiffre d'affaires estimé)
    prix_article = safe_num(sql_value(
        "SELECT SUM(total_revenue) / NULLIF(SUM(quantity), 0) FROM fact_ticket_lines"
    ), 2.42)
    coef = prix_article if forecast_type == "ca" else 1.0
    
    # ── 1. Récupérer les prévisions depuis prophet_forecasts ──
    forecast_query = """
    SELECT 
        ds,
        yhat,
        yhat_lower,
        yhat_upper,
        is_ferme
    FROM prophet_forecasts
    WHERE model_name = %s
    ORDER BY ds
    LIMIT %s
    """
    
    if src:
        forecast_raw = sql_fetch_all("""SELECT ds, yhat, yhat_lower, yhat_upper, is_ferme, ca, ca_lower, ca_upper
                                        FROM shop_forecasts WHERE run_id = %s AND kind = 'court'
                                        ORDER BY ds LIMIT %s""", (src[0]["run_id"], horizon))
    else:
        forecast_raw = sql_fetch_all(forecast_query, (model_name, horizon))
    
    jours_map = {
        'Monday': 'Lundi', 'Tuesday': 'Mardi', 'Wednesday': 'Mercredi',
        'Thursday': 'Jeudi', 'Friday': 'Vendredi', 'Saturday': 'Samedi', 'Sunday': 'Dimanche'
    }
    
    forecast_list = []
    for i, r in enumerate(forecast_raw):
        ds_date = r['ds']
        dow_en = ds_date.strftime('%A')
        if src and forecast_type == "ca" and r.get('ca') is not None:
            # chiffre d'affaires prévu produit par produit (prix réel de chaque produit), pas un prix moyen
            forecast_list.append({
                "horizon": f"J+{i+1}",
                "ds": ds_date.strftime('%Y-%m-%d'),
                "date_fr": ds_date.strftime('%d/%m/%Y'),
                "jour_semaine": jours_map.get(dow_en, dow_en),
                "yhat": int(round(safe_num(r['ca']))),
                "yhat_lower": int(round(safe_num(r['ca_lower']))),
                "yhat_upper": int(round(safe_num(r['ca_upper']))),
                "is_ferme": 1 if r['is_ferme'] else 0,
            })
            continue
        forecast_list.append({
            "horizon": f"J+{i+1}",
            "ds": ds_date.strftime('%Y-%m-%d'),
            "date_fr": ds_date.strftime('%d/%m/%Y'),
            "jour_semaine": jours_map.get(dow_en, dow_en),
            "yhat": int(round(safe_num(r['yhat']) * coef)),
            "yhat_lower": int(round(safe_num(r['yhat_lower']) * coef)),
            "yhat_upper": int(round(safe_num(r['yhat_upper']) * coef)),
            "is_ferme": (1 if r['is_ferme'] else 0) if src else (int(r['is_ferme']) if r['is_ferme'] else (1 if r['yhat'] == 0 else 0))
        })
    
    total_forecast = sum(item['yhat'] for item in forecast_list)
    
    # ── 2. Historique depuis daily_aggregates ──
    history_query = f"""
    SELECT 
        date_id as ds,
        {"ca_jour" if forecast_type == "ca" else "nb_articles"} as y
    FROM daily_aggregates
    ORDER BY date_id DESC
    LIMIT 60
    """
    
    history_raw = sql_fetch_all(history_query)
    history_raw.reverse()  # Ordre chronologique
    
    history_series = []
    for r in history_raw:
        ds_date = r['ds']
        history_series.append({
            "ds": ds_date.strftime('%Y-%m-%d'),
            "label": ds_date.strftime('%d/%m'),
            "y": safe_num(r['y'])
        })
    
    # Référence comparable : les mêmes jours un an plus tôt (décalage de 364 jours,
    # même jour de la semaine), jours ouverts uniquement.
    moy_jour = 0.0
    ref_period = ""
    if forecast_raw:
        col = "ca_jour" if forecast_type == "ca" else "nb_articles"
        ref_rows = sql_fetch_all(f"""
            SELECT AVG({col}) AS moy, MIN(date_id) AS d1, MAX(date_id) AS d2
            FROM daily_aggregates
            WHERE nb_articles > 0
              AND date_id BETWEEN %s::date - INTERVAL '364 days' AND %s::date - INTERVAL '364 days'
        """, (forecast_raw[0]['ds'], forecast_raw[-1]['ds']))
        if ref_rows and ref_rows[0]['moy'] is not None:
            moy_jour = safe_num(ref_rows[0]['moy'])
            ref_period = f"{ref_rows[0]['d1'].strftime('%d/%m/%Y')} – {ref_rows[0]['d2'].strftime('%d/%m/%Y')}"
    
    # ── 3. Prévision saisonnière ──
    # Dernier modèle de saison calculé par le notebook (ex. « saison_2026 »)
    season_model = sql_value(
        "SELECT model_name FROM prophet_forecasts WHERE model_name LIKE 'saison_%%' ORDER BY model_name DESC LIMIT 1"
    ) or "saison_2026"
    season_query = """
    SELECT 
        ds,
        yhat,
        yhat_lower,
        yhat_upper
    FROM prophet_forecasts
    WHERE model_name = %s
    ORDER BY ds
    """
    
    if src:
        season_raw = sql_fetch_all("""SELECT ds, yhat, yhat_lower, yhat_upper, is_ferme FROM shop_forecasts
                                      WHERE run_id = %s AND kind = 'saison' ORDER BY ds""", (src[0]["run_id"],))
    else:
        season_raw = sql_fetch_all(season_query, (season_model,))
    
    season_series = []
    for r in season_raw:
        ds_date = r['ds']
        season_series.append({
            "ds": ds_date.strftime('%Y-%m-%d'),
            "label": ds_date.strftime('%d/%m'),
            "yhat": int(round(safe_num(r['yhat']))),
            "yhat_lower": int(round(safe_num(r['yhat_lower']))),
            "yhat_upper": int(round(safe_num(r['yhat_upper']))),
            "is_ferme": 1 if (r.get('is_ferme') or safe_num(r['yhat']) == 0) else 0,
        })
    
    # ── 4. Précision mesurée ──
    if src:
        court, saison = src[1].get("court", {}) or {}, src[1].get("saison", {}) or {}
        med = court.get("erreur_mediane_jour")
        mdape_cv = round(med * 100, 1) if med is not None else None
        prophet_metrics = {
            "source": "pipeline",
            "mdape_cv": mdape_cv,                       # écart médian d'un jour (tests sur l'historique), en %
            "wape_jour": court.get("wape_jour"),
            "erreur_semaine": court.get("erreur_semaine"),
            "biais": court.get("biais"),
            "couverture_fourchette": court.get("couverture_fourchette"),
            "wape_jour_ca": court.get("wape_jour_ca"),
            "biais_ca": court.get("biais_ca"),
            "au_dessus_fourchette": court.get("au_dessus_fourchette"),
            "biais_fenetre_min": court.get("biais_fenetre_min"),
            "biais_fenetre_max": court.get("biais_fenetre_max"),
            "poids_an_dernier": court.get("poids_an_dernier"),
            "choix_poids": court.get("choix_poids"),
            "jours_feries_pays": src[1].get("jours_feries_pays", ""),
            "jours_testes": court.get("jours_testes"),
            "fenetres": court.get("fenetres"),
            "saison": saison,
            "data_end": str(src[0].get("data_end")),
            "run_at": str(src[0].get("run_at"))[:16],
            "objectif_cahier_des_charges": "15 à 20 % sur 14 jours",
        }
        w = court.get("wape_jour")
        model_comparison = [
            {"model": "Somme des prévisions par produit combinée avec l'an dernier", "mape": round(w * 100, 1) if w is not None else None, "status": "Retenu"},
            {"model": "Méthodes appliquées seulement au total", "mape": None, "status": "Écarté (erreur plus élevée lors des tests)"},
        ]
    else:
        # Repli : prévision Prophet du notebook. Aucune valeur par défaut : si la mesure manque, elle est absente.
        v = sql_value("SELECT value FROM ml_metrics WHERE model_name = %s AND metric_name = 'MDAPE_CV'", (model_name,))
        mdape_cv = safe_num(v) if v is not None else None
        prophet_metrics = {"source": "notebook", "mdape_cv": mdape_cv,
                           "objectif_cahier_des_charges": "15 à 20 % sur 14 jours"}
        model_comparison = [
            {"model": "Prophet", "mape": mdape_cv, "status": "Retenu"},
            {"model": "ARIMA", "mape": None, "status": "Écarté (saisonnalités multiples)"},
            {"model": "LSTM", "mape": None, "status": "Écarté (données et ressources)"},
        ]

    # ── 6. Filtres disponibles ──
    available_products = ["Toutes"] + sorted([r['article_name'] for r in sql_fetch_all("SELECT DISTINCT article_name FROM dim_products ORDER BY article_name LIMIT 100")])
    available_categories = ["Toutes"] + sorted([r['category_name'] for r in sql_fetch_all("SELECT DISTINCT category_name FROM dim_categories WHERE category_name != 'A CLASSIFIER' ORDER BY category_name")])
    available_seasons = ["Toutes"] + sorted([r['season_name'] for r in sql_fetch_all("SELECT DISTINCT season_name FROM dim_seasons ORDER BY season_name")])
    available_events = ["Tous"] + sorted([r['event_name'] for r in sql_fetch_all("SELECT DISTINCT event_name FROM dim_events WHERE event_name != 'Jour Normal' ORDER BY event_name")])
    
    unit_label = "€" if forecast_type == "ca" else "unités"
    forecast_label = "Chiffre d'affaires estimé" if forecast_type == "ca" else "Articles"
    
    return {
        "forecast_info": {
            "type": forecast_type,
            "label": forecast_label,
            "unit": unit_label,
            "horizon": horizon,
            "history_period": history_period
        },
        "metrics": {
            "mdape_cv": mdape_cv,
            "moy_jour_historique": moy_jour,
            "moy_jour_reference": "Mêmes jours l'année précédente",
            "moy_jour_periode": ref_period,
            "prix_moyen_article": prix_article,
            "total_prevision": total_forecast,
            "horizon_jours": horizon
        },
        "prophet_metrics": prophet_metrics,
        "model_comparison": model_comparison,
        "history": history_series,
        "forecast": forecast_list,
        "forecast_season": season_series,
        "decomposition": {},  # À implémenter si nécessaire
        "available_filters": {
            "horizons": [7, 14],
            "forecast_types": ["articles", "ca"],
            "products": available_products,
            "categories": available_categories,
            "seasons": available_seasons,
            "events": available_events
        }
    }