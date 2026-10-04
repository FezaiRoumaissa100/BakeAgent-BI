import math
from datetime import datetime
from db import sql_fetch_all, sql_fetch_one, sql_value, is_pg_available

def safe_num(v, default=0.0):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return default
    # Handle Decimal type from PostgreSQL
    from decimal import Decimal
    if isinstance(v, Decimal):
        return float(v)
    return float(v)

def calculate_commercial_performance_pg(annee="Toutes", saison="Toutes", mois="Tous", categorie="Toutes", evenement="Tous"):
    """
    Version PostgreSQL de calculate_commercial_performance
    """
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    where_clauses = []
    params = []

    if annee != "Toutes":
        # Gérer n'importe quelle année spécifique (ex: 2024, 2025, 2026, etc.)
        try:
            year_int = int(annee)
            where_clauses.append("EXTRACT(YEAR FROM d.date_id) = %s")
            params.append(year_int)
        except ValueError:
            pass  # Si l'année n'est pas valide, ignorer le filtre
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

    kpis_query = f"""
    SELECT
        SUM(f.total_revenue) as total_ca,
        COUNT(DISTINCT (f.date_id, f.ticket_number)) as nb_tickets,
        COUNT(DISTINCT f.date_id) as nb_jours,
        COUNT(DISTINCT f.product_id) as nb_produits
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
    nb_produits = int(kpis['nb_produits'] or 0)
    panier = total_ca / nb_tickets if nb_tickets > 0 else 0.0

    monthly_query = """
    SELECT
        month_start,
        year,
        month,
        total_revenue
    FROM monthly_ca
    ORDER BY month_start
    """

    monthly_data_raw = sql_fetch_all(monthly_query)

    monthly_data = []
    for r in monthly_data_raw:
        ms = r['month_start']
        try:
            ds = ms.strftime('%Y-%m-%d')
            lb = ms.strftime('%b %Y')
        except Exception:
            ds = str(ms)[:10]
            lb = ds
        monthly_data.append({
            "date": ds,
            "label": lb,
            "ca": safe_num(r['total_revenue'])
        })

    if monthly_data:
        moyenne = safe_num(sum(d['ca'] for d in monthly_data) / len(monthly_data))
        ca_max = max(monthly_data, key=lambda x: x['ca'])
        ca_min = min(monthly_data, key=lambda x: x['ca'])
        amplitude = ca_max['ca'] - ca_min['ca']
        ratio_amp = safe_num(ca_max['ca'] / max(ca_min['ca'], 1.0))
        ca_max_obj = {"date_str": ca_max["date"], "val": ca_max["ca"]}
        ca_min_obj = {"date_str": ca_min["date"], "val": ca_min["ca"]}
    else:
        moyenne = 0
        amplitude = 0
        ratio_amp = 0
        ca_max_obj = {"date_str": "", "val": 0}
        ca_min_obj = {"date_str": "", "val": 0}

    comp_24_25 = []
    mois_court = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    for m in range(1, 13):
        ca_2024 = safe_num(sql_value(
            "SELECT total_revenue FROM monthly_ca WHERE year = 2024 AND month = %s",
            (m,)
        ))
        ca_2025 = safe_num(sql_value(
            "SELECT total_revenue FROM monthly_ca WHERE year = 2025 AND month = %s",
            (m,)
        ))
        comp_24_25.append({
            "mois": mois_court[m-1],
            "ca_2024": ca_2024,
            "ca_2025": ca_2025
        })

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
    WHERE {where_sql}
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
    WHERE {where_sql}
    GROUP BY p.article_name
    ORDER BY quantity DESC
    LIMIT 20
    """

    top_qte_raw = sql_fetch_all(top_qte_query, tuple(params))
    top_qte_list = [{"article": r['article'], "quantity": safe_num(r['quantity'])} for r in top_qte_raw]

    top_tkt_query = f"""
    SELECT
        p.article_name as article,
        COUNT(DISTINCT (f.date_id, f.ticket_number)) as nb_tkt
    FROM fact_ticket_lines f
    JOIN dim_products p ON f.product_id = p.product_id
    JOIN dim_dates d ON f.date_id = d.date_id
    LEFT JOIN dim_categories c ON p.category_id = c.category_id
    LEFT JOIN dim_seasons s ON d.season_id = s.season_id
    LEFT JOIN dim_events e ON f.event_id = e.event_id
    WHERE {where_sql}
    GROUP BY p.article_name
    ORDER BY nb_tkt DESC
    LIMIT 20
    """

    top_tkt_raw = sql_fetch_all(top_tkt_query, tuple(params))
    top_tkt_list = [{"article": r['article'], "nb_tkt": int(r['nb_tkt'] or 0)} for r in top_tkt_raw]

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
            "ca_moyen": ca_moyen
        })

    hourly_query = f"""
    SELECT
        f.hour,
        SUM(f.total_revenue) as ca,
        COUNT(DISTINCT (f.date_id, f.ticket_number)) as tickets
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
        AVG(f.total_revenue) as panier,
        COUNT(DISTINCT (f.date_id, f.ticket_number)) as tickets,
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
            "panier": safe_num(r['panier']),
            "tickets": int(r['tickets'] or 0),
            "produits": int(r['produits'] or 0)
        })

    categories_list = ["Toutes"] + sorted([r['category_name'] for r in sql_fetch_all("SELECT DISTINCT category_name FROM dim_categories WHERE category_name IS NOT NULL AND category_name != 'A CLASSIFIER' ORDER BY category_name")])
    events_list = ["Tous"] + sorted([r['event_name'] for r in sql_fetch_all("SELECT DISTINCT event_name FROM dim_events WHERE event_name IS NOT NULL AND event_name != 'Jour Normal' ORDER BY event_name")])
    
    # Récupérer dynamiquement les années disponibles
    years_raw = sql_fetch_all("SELECT DISTINCT EXTRACT(YEAR FROM date_id) as year FROM dim_dates ORDER BY year DESC")
    available_years = sorted([int(r['year']) for r in years_raw if r['year'] is not None], reverse=True)
    
    # Construire la liste des options d'années : "Toutes" + années individuelles
    annees_options = ["Toutes"] + [str(y) for y in available_years]

    return {
        "kpis": {
            "total_ca": total_ca,
            "nb_tickets": nb_tickets,
            "panier": panier,
            "nb_jours": nb_jours,
            "nb_produits": nb_produits
        },
        "monthly": {
            "series": monthly_data,
            "moyenne": moyenne,
            "ecart_type": 0,
            "ca_max": ca_max_obj,
            "ca_min": ca_min_obj,
            "amplitude": amplitude,
            "ratio_amp": ratio_amp,
            "comp_24_25": comp_24_25
        },
        "top_products": {
            "by_ca": top_ca_list,
            "by_qte": top_qte_list,
            "by_tkt": top_tkt_list
        },
        "seasonality": {
            "days": seasonality_days,
            "hourly": hourly_dist
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
