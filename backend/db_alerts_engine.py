import math
from datetime import datetime, date
from db import sql_fetch_all, sql_fetch_one, sql_value, is_pg_available

def safe_num(v, default=0.0):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return default
    return float(v)

COLOR_STATUT = {
    'RUPTURE': '#E24B4A',
    'VIGILANCE': '#EF9F27',
    'NORMAL': '#639922',
    'SURSTOCK': '#378ADD',
    'FERMÉ': '#B4B2A9',
}

def get_alerts_data_pg(mois_filter="Tout"):
    """
    Version PostgreSQL de get_alerts_data
    Utilise la table prophet_forecasts pour les prévisions saisonnières
    """
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")
    
    # Paramètres
    prix_median = safe_num(sql_value("SELECT AVG(unit_price) FROM fact_ticket_lines"), 2.5)
    taux_marge = 0.65
    stock_jours = 2
    
    # Récupérer les prévisions saisonnières
    season_model = "saison_2026"  # Pas de suffixe _articles dans la base actuelle
    forecast_query = """
    SELECT 
        ds,
        yhat,
        yhat_lower,
        yhat_upper
    FROM prophet_forecasts
    WHERE model_name = %s
    ORDER BY ds
    """
    
    forecast_raw = sql_fetch_all(forecast_query, (season_model,))
    
    if not forecast_raw:
        return {"empty": True}
    
    # Calculer les métriques d'alerte
    days_data = []
    kpi_all = {'RUPTURE': 0, 'VIGILANCE': 0, 'NORMAL': 0, 'SURSTOCK': 0, 'FERMÉ': 0}
    
    for r in forecast_raw:
        ds_date = r['ds']
        yhat = safe_num(r['yhat'])
        yhat_lower = safe_num(r['yhat_lower'])
        yhat_upper = safe_num(r['yhat_upper'])
        
        stock_initial = int(yhat * stock_jours)
        ca_prevu = safe_num(yhat * prix_median)
        marge_prevue = safe_num(ca_prevu * taux_marge)
        commande_recommandee = stock_initial
        
        ratio_pct = safe_num(stock_initial / yhat_upper * 100) if yhat_upper > 0 else 0
        
        # Déterminer le statut
        if yhat == 0:
            statut = 'FERMÉ'
        elif ratio_pct >= 90:
            statut = 'RUPTURE'
        elif ratio_pct >= 60:
            statut = 'VIGILANCE'
        elif ratio_pct >= 40:
            statut = 'NORMAL'
        else:
            statut = 'SURSTOCK'
        
        kpi_all[statut] = kpi_all.get(statut, 0) + 1
        
        jours_map = {
            'Monday': 'Lundi', 'Tuesday': 'Mardi', 'Wednesday': 'Mercredi',
            'Thursday': 'Jeudi', 'Friday': 'Vendredi', 'Saturday': 'Samedi', 'Sunday': 'Dimanche'
        }
        dow_en = ds_date.strftime('%A')
        
        days_data.append({
            "ds": ds_date.strftime('%Y-%m-%d'),
            "date_fr": ds_date.strftime('%d/%m/%Y'),
            "jour_semaine": jours_map.get(dow_en, dow_en),
            "yhat": int(yhat),
            "yhat_lower": int(yhat_lower),
            "yhat_upper": int(yhat_upper),
            "ca_prevu": ca_prevu,
            "marge_prevue": marge_prevue,
            "ratio_pct": ratio_pct,
            "commande_recommandee": commande_recommandee,
            "statut": statut,
            "bar_color": COLOR_STATUT.get(statut, '#B4B2A9')
        })
    
    # KPIs globaux
    open_days = [d for d in days_data if d['yhat'] > 0]
    total_articles = sum(d['yhat'] for d in open_days)
    ca_total_prevu = sum(d['ca_prevu'] for d in open_days)
    marge_totale = sum(d['marge_prevue'] for d in open_days)
    ca_risque = sum(d['ca_prevu'] for d in days_data if d['statut'] == 'RUPTURE')
    
    if days_data:
        pic_day = max(days_data, key=lambda x: x['yhat'])
        pic_val = pic_day['yhat']
        pic_date = pic_day['date_fr']
    else:
        pic_val = 0
        pic_date = ""
    
    # Filtrage par mois
    mois_map = {
        'Tout': ('2026-06-01', '2026-09-30'),
        'Juin': ('2026-06-01', '2026-06-30'),
        'Juillet': ('2026-07-01', '2026-07-31'),
        'Août': ('2026-08-01', '2026-08-31'),
        'Septembre': ('2026-09-01', '2026-09-30'),
    }
    
    d_start, d_end = mois_map.get(mois_filter, ('2026-06-01', '2026-09-30'))
    
    from datetime import datetime
    start_date = datetime.strptime(d_start, '%Y-%m-%d').date()
    end_date = datetime.strptime(d_end, '%Y-%m-%d').date()
    
    filtered_days = [d for d in days_data if start_date <= datetime.strptime(d['ds'], '%Y-%m-%d').date() <= end_date]
    
    return {
        "kpis": {
            "total_articles": total_articles,
            "ca_total_prevu": ca_total_prevu,
            "marge_totale": marge_totale,
            "ca_risque": ca_risque,
            "pic_val": pic_val,
            "pic_date": pic_date,
            "statuts": kpi_all
        },
        "days": filtered_days,
        "available_mois": ['Tout', 'Juin', 'Juillet', 'Août', 'Septembre']
    }