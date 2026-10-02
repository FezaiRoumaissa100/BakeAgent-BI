import math
from datetime import datetime, date
from db import sql_fetch_all, sql_fetch_one, sql_value, is_pg_available

def safe_float(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return 0.0
    return float(v)

def calculate_daily_kpis_pg(sel_date: date):
    """
    Version PostgreSQL de calculate_daily_kpis
    Utilise les tables fact_ticket_lines et daily_aggregates
    """
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")
    
    date_str = sel_date.strftime('%Y-%m-%d')
    
    # Récupérer les agrégats journaliers depuis daily_aggregates
    daily_agg = sql_fetch_one(
        """
        SELECT nb_tickets, nb_articles, ca_jour, ref_actives
        FROM daily_aggregates
        WHERE date_id = %s
        """,
        (date_str,)
    )
    
    if not daily_agg:
        return {
            "ca_jour": 0,
            "tickets": 0,
            "panier": 0,
            "qte_jour": 0,
            "hourly_data": [],
            "heures_act": 0,
            "vitesse": 0,
            "peak_h": 0,
            "peak_qte_h": 0,
            "ca_moy_global": 0,
            "delta_vs_moy": 0,
            "top_qte": [],
            "top_ca": [],
            "top_tkt": [],
            "categories": [],
            "top_pairs": [],
            "nb_multi": 0,
            "nb_mono": 0,
            "pct_m": 0,
            "alerts_count": 0
        }
    
    ca_jour = safe_float(daily_agg['ca_jour'])
    tickets = int(daily_agg['nb_tickets'])
    qte_jour = int(daily_agg['nb_articles'])
    panier = ca_jour / tickets if tickets > 0 else 0.0
    
    # Données horaires depuis fact_ticket_lines
    hourly_data = sql_fetch_all(
        """
        SELECT 
            hour,
            SUM(total_revenue) as ca,
            COUNT(DISTINCT ticket_number) as tkt,
            SUM(quantity) as qte
        FROM fact_ticket_lines
        WHERE date_id = %s
        GROUP BY hour
        ORDER BY hour
        """,
        (date_str,)
    )
    
    hourly_list = []
    ca_cum = 0
    qte_total = 0
    peak_h = 0
    peak_qte_h = 0
    heures_act = 0
    
    for row in hourly_data:
        hour = int(row['hour'])
        ca = safe_float(row['ca'])
        tkt = int(row['tkt'])
        qte = safe_float(row['qte'])
        panier_h = ca / tkt if tkt > 0 else 0.0
        
        ca_cum += ca
        qte_total += qte
        
        if qte > 0:
            heures_act += 1
            if qte > peak_qte_h:
                peak_qte_h = qte
                peak_h = hour
        
        hourly_list.append({
            "hour": hour,
            "ca": ca,
            "tkt": tkt,
            "qte": qte,
            "panier_h": panier_h,
            "heure": f"{hour:02d}h",
            "ca_cum": ca_cum
        })
    
    vitesse = qte_jour / heures_act if heures_act > 0 else 0.0
    
    # CA moyen global
    ca_moy_global = safe_float(sql_value(
        "SELECT AVG(ca_jour) FROM daily_aggregates"
    ))
    
    delta_vs_moy = (ca_jour - ca_moy_global) / ca_moy_global * 100 if ca_moy_global > 0 else 0
    
    # Top produits quantité
    top_qte = sql_fetch_all(
        """
        SELECT 
            p.article_name as article,
            SUM(f.quantity) as quantity
        FROM fact_ticket_lines f
        JOIN dim_products p ON f.product_id = p.product_id
        WHERE f.date_id = %s
        GROUP BY p.article_name
        ORDER BY quantity DESC
        LIMIT 8
        """,
        (date_str,)
    )
    
    top_qte_list = [{"article": r['article'], "quantity": safe_float(r['quantity'])} for r in top_qte]
    
    # Top produits CA
    top_ca = sql_fetch_all(
        """
        SELECT 
            p.article_name as article,
            SUM(f.total_revenue) as total_revenue
        FROM fact_ticket_lines f
        JOIN dim_products p ON f.product_id = p.product_id
        WHERE f.date_id = %s
        GROUP BY p.article_name
        ORDER BY total_revenue DESC
        LIMIT 8
        """,
        (date_str,)
    )
    
    top_ca_list = [{"article": r['article'], "total_revenue": safe_float(r['total_revenue'])} for r in top_ca]
    
    # Top produits tickets
    top_tkt = sql_fetch_all(
        """
        SELECT 
            p.article_name as article,
            COUNT(DISTINCT f.ticket_number) as nb_tkt
        FROM fact_ticket_lines f
        JOIN dim_products p ON f.product_id = p.product_id
        WHERE f.date_id = %s
        GROUP BY p.article_name
        ORDER BY nb_tkt DESC
        LIMIT 8
        """,
        (date_str,)
    )
    
    top_tkt_list = [{"article": r['article'], "nb_tkt": int(r['nb_tkt'])} for r in top_tkt]
    
    # Catégories
    categories = sql_fetch_all(
        """
        SELECT 
            c.category_name as category,
            SUM(f.total_revenue) as total_revenue
        FROM fact_ticket_lines f
        JOIN dim_products p ON f.product_id = p.product_id
        JOIN dim_categories c ON p.category_id = c.category_id
        WHERE f.date_id = %s
        GROUP BY c.category_name
        ORDER BY total_revenue DESC
        """,
        (date_str,)
    )
    
    cat_list = [{"category": r['category'], "total_revenue": safe_float(r['total_revenue'])} for r in categories]
    
    # Top paires (associations) - paires de produits apparaissant ensemble dans les tickets
    top_pairs = sql_fetch_all(
        """
        SELECT 
            p1.article_name as pa,
            p2.article_name as pb,
            COUNT(*) as cnt
        FROM fact_ticket_lines f1
        JOIN fact_ticket_lines f2 ON f1.ticket_number = f2.ticket_number AND f1.date_id = f2.date_id
        JOIN dim_products p1 ON f1.product_id = p1.product_id
        JOIN dim_products p2 ON f2.product_id = p2.product_id
        WHERE f1.date_id = %s
            AND f1.product_id < f2.product_id
        GROUP BY p1.article_name, p2.article_name
        ORDER BY cnt DESC
        LIMIT 5
        """,
        (date_str,)
    )
    
    top_pairs_list = [{"pa": r['pa'], "pb": r['pb'], "cnt": int(r['cnt'])} for r in top_pairs]
    
    # Tickets mono vs multi
    ticket_sizes = sql_fetch_all(
        """
        SELECT ticket_number, COUNT(*) as nb_items
        FROM fact_ticket_lines
        WHERE date_id = %s
        GROUP BY ticket_number
        """,
        (date_str,)
    )
    
    nb_multi = sum(1 for t in ticket_sizes if t['nb_items'] >= 2)
    nb_mono = len(ticket_sizes) - nb_multi
    pct_m = nb_multi / tickets * 100 if tickets > 0 else 0
    
    # Alerts count (à implémenter avec la table alerts quand disponible)
    alerts_count = 5
    
    return {
        "ca_jour": ca_jour,
        "tickets": tickets,
        "panier": panier,
        "qte_jour": qte_jour,
        "hourly_data": hourly_list,
        "heures_act": heures_act,
        "vitesse": vitesse,
        "peak_h": peak_h,
        "peak_qte_h": peak_qte_h,
        "ca_moy_global": ca_moy_global,
        "delta_vs_moy": delta_vs_moy,
        "top_qte": top_qte_list,
        "top_ca": top_ca_list,
        "top_tkt": top_tkt_list,
        "categories": cat_list,
        "top_pairs": top_pairs_list,
        "nb_multi": nb_multi,
        "nb_mono": nb_mono,
        "pct_m": pct_m,
        "alerts_count": alerts_count
    }