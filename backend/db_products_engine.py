import math
from db import sql_fetch_all, sql_fetch_one, sql_value, is_pg_available

def safe_num(v, default=0.0):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return default
    # Handle Decimal type from PostgreSQL
    from decimal import Decimal
    if isinstance(v, Decimal):
        return float(v)
    return float(v)

# ── 1. Pénétration ──────────────────────────────────────────
def get_penetration_data_pg(search="", categories=None, statuts=None, year=None):
    """
    Version PostgreSQL de get_penetration_data
    """
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    where_clauses = []
    params = []

    if search:
        where_clauses.append("p.article_name ILIKE %s")
        params.append(f"%{search}%")

    if categories and len(categories) > 0 and "Toutes" not in categories:
        where_clauses.append("c.category_name = ANY(%s)")
        params.append(list(categories))

    if statuts and len(statuts) > 0:
        where_clauses.append("pp.statut_strategique = ANY(%s)")
        params.append(list(statuts))

    year_where_added = False
    if year and year != "Toutes":
        try:
            y_int = int(year)
            where_clauses.append("EXTRACT(YEAR FROM d.date_id) = %s")
            params.append(y_int)
            year_where_added = True
        except Exception:
            pass

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    if year_where_added:
        qty_join_sql = f"""
        JOIN fact_ticket_lines f_agg ON p.product_id = f_agg.product_id
        JOIN dim_dates d_agg ON f_agg.date_id = d_agg.date_id
        WHERE EXTRACT(YEAR FROM d_agg.date_id) = {y_int}
        """
    else:
        qty_join_sql = ""

    penetration_query = f"""
    SELECT
        p.article_name as article,
        c.category_name as category,
        pp.penetration_rate as penetration_rate,
        pp.tickets_count,
        pp.statut_strategique,
        COALESCE(q.qty_total, 0) as qty_total,
        COALESCE(q.ca_total, 0) as ca_total
    FROM product_penetration pp
    JOIN dim_products p ON pp.product_id = p.product_id
    LEFT JOIN dim_categories c ON p.category_id = c.category_id
    LEFT JOIN fact_ticket_lines f ON f.product_id = p.product_id
    LEFT JOIN dim_dates d ON f.date_id = d.date_id
    LEFT JOIN LATERAL (
        SELECT
            SUM(fq.quantity) as qty_total,
            SUM(fq.total_revenue) as ca_total
        FROM fact_ticket_lines fq
        WHERE fq.product_id = p.product_id
          {'AND EXTRACT(YEAR FROM (SELECT date_id FROM dim_dates dd WHERE dd.date_id = fq.date_id)) = ' + str(y_int) if year_where_added else ''}
    ) q ON TRUE
    WHERE {where_sql}
    GROUP BY p.product_id, p.article_name, c.category_name,
             pp.penetration_rate, pp.tickets_count, pp.statut_strategique,
             q.qty_total, q.ca_total
    ORDER BY pp.penetration_rate DESC
    """

    penetration_raw = sql_fetch_all(penetration_query, tuple(params))

    items = []
    for r in penetration_raw:
        tickets_count = int(r['tickets_count'] or 0)
        qty_tot = safe_num(r['qty_total'])
        upt = safe_num(qty_tot / tickets_count) if tickets_count > 0 else 0
        items.append({
            "article": r['article'],
            "category": r['category'] or 'Autre',
            "penetration_rate": safe_num(r['penetration_rate']),
            "tickets_count": tickets_count,
            "ca_total": safe_num(r['ca_total']),
            "qty_total": qty_tot,
            "upt": upt,
            "statut": r['statut_strategique'] or 'Autre'
        })

    cat_pen_query = f"""
    SELECT
        c.category_name as category,
        AVG(pp.penetration_rate) as taux_moyen,
        COALESCE(SUM(fagg.ca_total), 0) as ca_total,
        COUNT(DISTINCT p.product_id) as nb_articles
    FROM product_penetration pp
    JOIN dim_products p ON pp.product_id = p.product_id
    JOIN dim_categories c ON p.category_id = c.category_id
    LEFT JOIN fact_ticket_lines f ON f.product_id = p.product_id
    LEFT JOIN dim_dates d ON f.date_id = d.date_id
    LEFT JOIN (
        SELECT
            f2.product_id,
            SUM(f2.total_revenue) as ca_total
        FROM fact_ticket_lines f2
        {'WHERE EXTRACT(YEAR FROM (SELECT dd.date_id FROM dim_dates dd WHERE dd.date_id = f2.date_id)) = ' + str(y_int) if year_where_added else ''}
        GROUP BY f2.product_id
    ) fagg ON fagg.product_id = p.product_id
    WHERE {where_sql} AND c.category_name IS NOT NULL
    GROUP BY c.category_name
    ORDER BY taux_moyen DESC
    """

    cat_pen_raw = sql_fetch_all(cat_pen_query, tuple(params))
    cat_pen_list = [{
        "category": r['category'],
        "taux_moyen": safe_num(r['taux_moyen']),
        "ca_total": safe_num(r['ca_total']),
        "nb_articles": int(r['nb_articles'] or 0)
    } for r in cat_pen_raw]

    status_counts = {}
    for item in items:
        statut = item['statut']
        status_counts[statut] = status_counts.get(statut, 0) + 1

    # Calculer la tendance hebdomadaire pour le top produit (TRADITIONAL BAGUETTE par défaut)
    weekly_trend_query = """
    SELECT
        EXTRACT(WEEK FROM d.date_id) as week_num,
        EXTRACT(YEAR FROM d.date_id) as year,
        COUNT(DISTINCT f.ticket_number) as total_tickets,
        COUNT(DISTINCT CASE WHEN p.article_name = 'TRADITIONAL BAGUETTE' THEN f.ticket_number END) as product_tickets
    FROM fact_ticket_lines f
    JOIN dim_dates d ON f.date_id = d.date_id
    JOIN dim_products p ON f.product_id = p.product_id
    GROUP BY EXTRACT(WEEK FROM d.date_id), EXTRACT(YEAR FROM d.date_id)
    ORDER BY year, week_num
    LIMIT 52
    """

    weekly_raw = sql_fetch_all(weekly_trend_query)
    # Formater pour le frontend MultiLineChart qui attend: { article: string; series: { week: string; rate: number }[] }[]
    series_data = []
    week_data = []
    for r in weekly_raw:
        total = int(r.get('total_tickets', 0) or 0)
        prod = int(r.get('product_tickets', 0) or 0)
        pen_rate = safe_num((prod / total * 100) if total > 0 else 0)
        week_label = f"S{int(r.get('week_num', 0))}-{str(int(r.get('year', 0)))[2:]}"
        week_data.append({
            "week": week_label,
            "rate": pen_rate
        })
    
    weekly_trend = [{
        "article": "TRADITIONAL BAGUETTE",
        "series": week_data
    }]

    available_categories = ["Toutes"] + sorted([r['category_name'] for r in sql_fetch_all("SELECT DISTINCT category_name FROM dim_categories WHERE category_name IS NOT NULL AND category_name != 'A CLASSIFIER' ORDER BY category_name")])
    available_statuts_rows = sql_fetch_all("SELECT DISTINCT statut_strategique FROM product_penetration WHERE statut_strategique IS NOT NULL ORDER BY statut_strategique")
    available_statuts = ["Toutes"] + sorted([r['statut_strategique'] for r in available_statuts_rows])
    available_years_raw = sql_fetch_all("SELECT DISTINCT EXTRACT(YEAR FROM date_id) as year FROM dim_dates ORDER BY year DESC")
    available_years = sorted([int(r['year']) for r in available_years_raw if r['year'] is not None], reverse=True)

    return {
        "kpis": {
            "total_articles": len(items),
            "pen_max": safe_num(max([i['penetration_rate'] for i in items]) if items else 0),
            "pen_median": safe_num(sorted([i['penetration_rate'] for i in items])[len(items)//2] if items else 0),
            "status_counts": status_counts
        },
        "items": items,
        "category_summary": cat_pen_list,
        "weekly_trend": weekly_trend,
        "available_categories": available_categories,
        "available_statuts": available_statuts,
        "available_years": available_years
    }

# ── 2. Vitesse de vente ─────────────────────────────────────
def get_sales_velocity_data_pg():
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    dow_query = """
    SELECT
        d.day_of_week,
        SUM(f.quantity) as qte,
        COUNT(DISTINCT d.date_id) as jours
    FROM fact_ticket_lines f
    JOIN dim_dates d ON f.date_id = d.date_id
    GROUP BY d.day_of_week
    ORDER BY d.day_of_week
    """

    dow_raw = sql_fetch_all(dow_query)
    labels = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

    dow_dict = {r['day_of_week']: r for r in dow_raw}
    dow_velocity = []
    for i in range(7):
        r = dow_dict.get(i, {'qte': 0, 'jours': 1})
        qte = safe_num(r.get('qte', 0))
        j = int(r.get('jours', 1) or 1)
        velocity = safe_num(qte / max(j, 1))
        dow_velocity.append({
            "day": labels[i],
            "all": velocity,
            "touristic": velocity,
            "event": velocity
        })

    macro_query = """
    SELECT
        p.article_name as article,
        p.product_id,
        pvs.daily_velocity,
        pvs.velocity_touristic,
        pvs.velocity_event,
        pvs.stock_securite,
        pvs.ratio_touristic,
        pvs.ratio_event
    FROM product_velocity_stats pvs
    JOIN dim_products p ON pvs.product_id = p.product_id
    ORDER BY pvs.daily_velocity DESC
    LIMIT 50
    """

    macro_raw = sql_fetch_all(macro_query)

    peak_hour_by_product = {}
    ratio_pic_by_product = {}
    for r in sql_fetch_all("""
        WITH per_hour AS (
            SELECT
                f.product_id,
                f.hour,
                SUM(f.quantity) as qte_h,
                ROW_NUMBER() OVER (PARTITION BY f.product_id ORDER BY SUM(f.quantity) DESC) as rn
            FROM fact_ticket_lines f
            WHERE f.hour IS NOT NULL
            GROUP BY f.product_id, f.hour
        ),
        totals AS (
            SELECT product_id, SUM(quantity) as total_qte
            FROM fact_ticket_lines
            GROUP BY product_id
        )
        SELECT
            ph.product_id,
            ph.hour,
            ph.qte_h,
            t.total_qte
        FROM per_hour ph
        JOIN totals t ON ph.product_id = t.product_id
        WHERE ph.rn = 1
    """):
        pid = int(r['product_id'])
        peak_hour_by_product[pid] = int(r['hour']) if r['hour'] is not None else None
        tq = safe_num(r['total_qte'])
        if tq > 0:
            ratio_pic_by_product[pid] = safe_num(safe_num(r['qte_h']) / tq * 100)
        else:
            ratio_pic_by_product[pid] = 0.0

    macro_items = []
    for r in macro_raw:
        pid = int(r['product_id'])
        peak_hour = peak_hour_by_product.get(pid)
        ratio_pic = ratio_pic_by_product.get(pid, 0.0)
        if peak_hour is not None and ratio_pic >= 30:
            alerte_str = f"{max(6, peak_hour - 1):02d}:00"
        else:
            alerte_str = None
        macro_items.append({
            "article": r['article'],
            "daily_velocity": safe_num(r['daily_velocity']),
            "velocity_touristic": safe_num(r['velocity_touristic']),
            "velocity_event": safe_num(r['velocity_event']),
            "stock_securite": safe_num(r['stock_securite']),
            "ratio_touristic": safe_num(r['ratio_touristic']),
            "ratio_event": safe_num(r['ratio_event']),
            "peak_hour": peak_hour,
            "ratio_pic_percent": ratio_pic,
            "alerte_replissage_avant": alerte_str
        })

    hourly_product_query = """
    SELECT
        f.hour,
        p.article_name,
        SUM(f.quantity) as qte_this_hour
    FROM fact_ticket_lines f
    JOIN dim_products p ON f.product_id = p.product_id
    WHERE f.hour IS NOT NULL AND f.hour BETWEEN 7 AND 19
    GROUP BY f.hour, p.article_name
    ORDER BY f.hour, qte_this_hour DESC
    """
    hourly_product_raw = sql_fetch_all(hourly_product_query)

    per_hour_global = {}
    per_hour_products = {}
    for r in hourly_product_raw:
        h = int(r['hour'])
        qte = safe_num(r['qte_this_hour'])
        per_hour_global[h] = per_hour_global.get(h, 0) + qte
        if h not in per_hour_products:
            per_hour_products[h] = []
        per_hour_products[h].append({
            "article": r['article_name'],
            "qte_this_hour": qte
        })

    hourly_dist = []
    for h in sorted(per_hour_global.keys()):
        hourly_dist.append({
            "hour": h,
            "heure_label": f"{h:02d}h",
            "global_qte_per_hour": safe_num(per_hour_global[h]),
            "per_product": per_hour_products.get(h, [])
        })

    return {
        "dow_velocity": dow_velocity,
        "macro_items": macro_items,
        "hourly_distribution": hourly_dist
    }

# ── 3. Contribution au ticket ────────────────────────────────
def get_ticket_contribution_data_pg():
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    ticket_sizes_query = """
    SELECT ticket_number, COUNT(*) as nb_items
    FROM fact_ticket_lines
    GROUP BY ticket_number
    """

    ticket_sizes = sql_fetch_all(ticket_sizes_query)
    nb_mono = sum(1 for t in ticket_sizes if int(t['nb_items'] or 0) == 1)
    nb_multi = sum(1 for t in ticket_sizes if int(t['nb_items'] or 0) >= 2)
    nb_total = len(ticket_sizes)

    ca_by_product = {}
    for r in sql_fetch_all("""
        SELECT product_id, SUM(total_revenue) as ca_total
        FROM fact_ticket_lines
        GROUP BY product_id
    """):
        ca_by_product[int(r['product_id'])] = safe_num(r['ca_total'])

    contribution_query = """
    WITH ticket_totals AS (
        SELECT ticket_number, SUM(total_revenue) as ticket_total
        FROM fact_ticket_lines
        GROUP BY ticket_number
        HAVING COUNT(*) >= 2
    ),
    line_contributions AS (
        SELECT
            f.product_id,
            f.ticket_number,
            f.total_revenue,
            tt.ticket_total,
            (CASE WHEN tt.ticket_total > 0
                  THEN f.total_revenue::numeric / tt.ticket_total::numeric * 100
                  ELSE 0 END) as contribution_pct
        FROM fact_ticket_lines f
        JOIN ticket_totals tt ON f.ticket_number = tt.ticket_number
    ),
    product_contributions AS (
        SELECT
            f.product_id,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY contribution_pct) as contribution_med,
            AVG(contribution_pct) as contribution_moy,
            COUNT(DISTINCT f.ticket_number) as nb_tickets_multi
        FROM line_contributions f
        GROUP BY f.product_id
        HAVING COUNT(DISTINCT f.ticket_number) >= 10
    )
    SELECT
        pc.product_id,
        p.article_name,
        pc.contribution_med,
        pc.contribution_moy,
        pc.nb_tickets_multi
    FROM product_contributions pc
    JOIN dim_products p ON pc.product_id = p.product_id
    ORDER BY pc.contribution_med DESC
    LIMIT 30
    """

    contribution_raw = sql_fetch_all(contribution_query)
    top20 = []
    for r in contribution_raw:
        ca_tot = ca_by_product.get(int(r['product_id']), 0.0)
        nb_tm = int(r['nb_tickets_multi'] or 0)
        freq_multi_pct = safe_num(nb_tm / max(nb_multi, 1) * 100)
        contrib_med = safe_num(r['contribution_med'])
        if contrib_med >= 67:
            statut = "Ancre"
        elif contrib_med >= 40:
            statut = "Moteur"
        elif contrib_med >= 20:
            statut = "Complement"
        else:
            statut = "Micro"
        top20.append({
            "article": r['article_name'],
            "contribution_med": contrib_med,
            "contribution_moy": safe_num(r['contribution_moy']),
            "nb_tickets_multi": nb_tm,
            "statut_contribution": statut,
            "ca_total_multi": ca_tot,
            "frequence_multi_pct": freq_multi_pct
        })

    distribution_par_statut = {}
    for t in top20:
        s = t["statut_contribution"]
        if s not in distribution_par_statut:
            distribution_par_statut[s] = {"nb": 0, "ca": 0.0}
        distribution_par_statut[s]["nb"] += 1
        distribution_par_statut[s]["ca"] += t["ca_total_multi"]

    bcg_quadrants = {"etoiles": [], "opportunites": [], "moteurs": [], "a_reevaluer": []}
    for t in top20:
        if t["contribution_med"] >= 50 and t["frequence_multi_pct"] >= 10:
            bcg_quadrants["etoiles"].append(t["article"])
        elif t["contribution_med"] >= 50:
            bcg_quadrants["moteurs"].append(t["article"])
        elif t["frequence_multi_pct"] >= 10:
            bcg_quadrants["opportunites"].append(t["article"])
        else:
            bcg_quadrants["a_reevaluer"].append(t["article"])

    return {
        "stats": {
            "nb_produits_analysables": len(top20),
            "ca_total_multi": sum(t["ca_total_multi"] for t in top20),
            "distribution_par_statut": distribution_par_statut,
            "nb_multi": nb_multi,
            "nb_mono": nb_mono,
            "nb_total": nb_total,
            "pct_multi": safe_num(nb_multi / max(nb_total, 1) * 100)
        },
        "top20": top20,
        "bcg_quadrants": bcg_quadrants
    }

# ── 4. Fréquence d'achat ─────────────────────────────────────
def get_repurchase_frequency_data_pg():
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    total_semaines = int(sql_value("SELECT COUNT(DISTINCT week_iso) FROM dim_dates") or 1)
    if total_semaines <= 0:
        total_semaines = 1

    freq_query = """
    WITH product_weeks AS (
        SELECT
            p.product_id,
            p.article_name,
            c.category_name,
            COUNT(DISTINCT d.week_iso) as semaines_actives
        FROM fact_ticket_lines f
        JOIN dim_products p ON f.product_id = p.product_id
        JOIN dim_dates d ON f.date_id = d.date_id
        LEFT JOIN dim_categories c ON p.category_id = c.category_id
        GROUP BY p.product_id, p.article_name, c.category_name
    )
    SELECT
        pw.product_id,
        pw.article_name,
        pw.category_name,
        pw.semaines_actives,
        (pw.semaines_actives::numeric / %s::numeric * 100) as repurchase_freq,
        CASE
            WHEN (pw.semaines_actives::numeric / %s::numeric * 100) >= 100 THEN 'Quotidien'
            WHEN (pw.semaines_actives::numeric / %s::numeric * 100) >= 75  THEN 'Regulier'
            WHEN (pw.semaines_actives::numeric / %s::numeric * 100) >= 50  THEN 'Cyclique'
            ELSE 'Sporadique'
        END as statut_frequence,
        (SELECT SUM(total_revenue) FROM fact_ticket_lines f2 WHERE f2.product_id = pw.product_id) as ca_total,
        (SELECT SUM(quantity)      FROM fact_ticket_lines f3 WHERE f3.product_id = pw.product_id) as qte_totale
    FROM product_weeks pw
    ORDER BY pw.semaines_actives DESC
    """

    freq_raw = sql_fetch_all(freq_query, (total_semaines, total_semaines, total_semaines, total_semaines))

    items = []
    for r in freq_raw:
        sa = int(r['semaines_actives'] or 0)
        ca_tot = safe_num(r['ca_total'])
        ca_par_sem = safe_num(ca_tot / max(sa, 1))
        items.append({
            "article": r['article_name'],
            "category": r['category_name'] or 'Autre',
            "semaines_actives": sa,
            "repurchase_freq_pct": safe_num(r['repurchase_freq']),
            "statut_frequence": r['statut_frequence'],
            "ca_total": ca_tot,
            "ca_par_sem_active": ca_par_sem
        })

    status_distribution = {}
    for item in items:
        statut = item['statut_frequence']
        status_distribution[statut] = status_distribution.get(statut, 0) + 1

    nb_produits = len(items)
    return {
        "total_sem": total_semaines,
        "nb_produits": nb_produits,
        "status_distribution": status_distribution,
        "items": items,
        "weekly_multi": []
    }

# ── 5. Associations (Apriori Rules) ──────────────────────────
def get_associations_data_pg(sort_by="Lift ↓", top_n=20):
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    order_map = {
        "Lift ↓": "lift DESC",
        "Confiance ↓": "confidence DESC",
        "Support ↓": "support DESC"
    }

    order_by = order_map.get(sort_by, "lift DESC")

    rules_query = f"""
    SELECT
        antecedents_str,
        consequents_str,
        support,
        confidence,
        lift
    FROM association_rules
    ORDER BY {order_by}
    LIMIT %s
    """

    rules_raw = sql_fetch_all(rules_query, (top_n,))

    def band_from_lift(l):
        if l >= 4.0: return "Tres forte"
        if l >= 2.5: return "Forte"
        if l >= 1.5: return "Moderee"
        return "Legere"

    rules = []
    for r in rules_raw:
        lift_v = safe_num(r['lift'])
        rules.append({
            "antecedent": r['antecedents_str'],
            "consequent": r['consequents_str'],
            "support": safe_num(r['support'] * 100),
            "confidence": safe_num(r['confidence'] * 100),
            "lift": lift_v,
            "lift_bande": band_from_lift(lift_v)
        })

    nb_total = sql_value("SELECT COUNT(*) FROM association_rules") or 0

    return {
        "nb_total_regles": int(nb_total),
        "rules": rules,
        "methodology": {
            "algorithm": "Apriori",
            "default_thresholds": {
                "support": "1%",
                "lift": "1.2x",
                "max_length": "3 items"
            }
        }
    }
