import math
from db import sql_fetch_all, sql_fetch_one, sql_value, is_pg_available
from config import (PENETRATION_STATUTS, statut_penetration, PIC_HORAIRE_SEUIL_PCT,
                    CONTRIBUTION_GENERATEUR_SEUIL_PCT, FREQUENCE_STATUTS, statut_frequence)

def safe_num(v, default=0.0):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return default
    # Handle Decimal type from PostgreSQL
    from decimal import Decimal
    if isinstance(v, Decimal):
        return float(v)
    return float(v)

# ── 1. Pénétration ──────────────────────────────────────────
# Cahier des charges : taux de pénétration (%) = tickets contenant le produit
# / nombre total de tickets uniques x 100. Un ticket = date + numéro (la caisse
# réutilise ses numéros d'un jour à l'autre).
def _parse_year(year):
    if year and str(year) not in ("Toutes", "Tous", ""):
        try:
            return int(year)
        except Exception:
            return None
    return None


def get_penetration_data_pg(search="", categories=None, statuts=None, year=None):
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    y_int = _parse_year(year)
    year_sql = "AND EXTRACT(YEAR FROM f.date_id) = %s" if y_int else ""
    year_params = (y_int,) if y_int else ()

    total_tickets = int(sql_value(f"""
        SELECT COUNT(DISTINCT (f.date_id, f.ticket_number))
        FROM fact_ticket_lines f
        WHERE 1=1 {year_sql}
    """, year_params) or 0)

    rows = sql_fetch_all(f"""
        SELECT p.product_id, p.article_name AS article, c.category_name AS category,
               COUNT(DISTINCT (f.date_id, f.ticket_number)) AS tickets_count,
               SUM(f.quantity) AS qty_total,
               SUM(f.total_revenue) AS ca_total
        FROM fact_ticket_lines f
        JOIN dim_products p ON p.product_id = f.product_id
        LEFT JOIN dim_categories c ON c.category_id = p.category_id
        WHERE 1=1 {year_sql}
        GROUP BY p.product_id, p.article_name, c.category_name
        HAVING SUM(f.total_revenue) > 0
    """, year_params)

    all_items = []
    for r in rows:
        tc = int(r['tickets_count'] or 0)
        qty = safe_num(r['qty_total'])
        rate = safe_num(tc / total_tickets * 100) if total_tickets else 0.0
        all_items.append({
            "product_id": int(r['product_id']),
            "article": r['article'],
            "category": r['category'] or 'Autre',
            "penetration_rate": rate,
            "tickets_count": tc,
            "ca_total": safe_num(r['ca_total']),
            "qty_total": qty,
            "upt": safe_num(qty / tc) if tc else 0.0,
            "statut": statut_penetration(rate),
        })

    # Normalisation par catégorie (cahier des charges, §7) : taux / moyenne de la catégorie
    cat_rates = {}
    for it in all_items:
        cat_rates.setdefault(it['category'], []).append(it['penetration_rate'])
    cat_mean = {k: sum(v) / len(v) for k, v in cat_rates.items() if v}
    for it in all_items:
        m = cat_mean.get(it['category'], 0)
        it['indice_categorie'] = safe_num(it['penetration_rate'] / m) if m else 0.0

    # Filtres (« Toutes » = pas de filtre)
    def keep(it):
        if search and search.lower() not in it['article'].lower():
            return False
        if categories and "Toutes" not in categories and it['category'] not in categories:
            return False
        if statuts and not any(s in ("Toutes", "Tous") for s in statuts) and it['statut'] not in statuts:
            return False
        return True

    items = sorted([it for it in all_items if keep(it)], key=lambda x: x['penetration_rate'], reverse=True)

    # Par catégorie : part des tickets contenant au moins un produit de la catégorie,
    # moyenne simple des taux de ses produits, chiffre d'affaires.
    cat_rows = sql_fetch_all(f"""
        SELECT c.category_name AS category,
               COUNT(DISTINCT (f.date_id, f.ticket_number)) AS tickets_cat,
               SUM(f.total_revenue) AS ca_total,
               COUNT(DISTINCT f.product_id) AS nb_articles
        FROM fact_ticket_lines f
        JOIN dim_products p ON p.product_id = f.product_id
        JOIN dim_categories c ON c.category_id = p.category_id
        WHERE c.category_name IS NOT NULL {year_sql}
        GROUP BY c.category_name
    """, year_params)
    cat_pen_list = sorted([{
        "category": r['category'],
        "taux_moyen": safe_num(cat_mean.get(r['category'], 0)),
        "taux_categorie": safe_num(int(r['tickets_cat'] or 0) / total_tickets * 100) if total_tickets else 0.0,
        "ca_total": safe_num(r['ca_total']),
        "nb_articles": int(r['nb_articles'] or 0),
    } for r in cat_rows], key=lambda x: x['taux_categorie'], reverse=True)

    status_counts = {}
    for it in items:
        status_counts[it['statut']] = status_counts.get(it['statut'], 0) + 1
    # Comptes sur tout le catalogue (pour afficher le nombre de produits sur chaque filtre de statut)
    status_counts_all = {label: 0 for _, label in PENETRATION_STATUTS}
    for it in all_items:
        status_counts_all[it['statut']] = status_counts_all.get(it['statut'], 0) + 1

    # Pénétration hebdomadaire des 5 produits les plus présents (semaine ISO avec l'année)
    top5 = [it for it in sorted(all_items, key=lambda x: x['penetration_rate'], reverse=True)[:5]]
    weekly_trend = []
    if top5:
        totals = {r['week_iso']: int(r['n']) for r in sql_fetch_all(f"""
            SELECT d.week_iso, COUNT(DISTINCT (f.date_id, f.ticket_number)) AS n
            FROM fact_ticket_lines f
            JOIN dim_dates d ON d.date_id = f.date_id
            WHERE 1=1 {year_sql}
            GROUP BY d.week_iso
        """, year_params)}
        per_prod = sql_fetch_all(f"""
            SELECT d.week_iso, f.product_id, COUNT(DISTINCT (f.date_id, f.ticket_number)) AS n
            FROM fact_ticket_lines f
            JOIN dim_dates d ON d.date_id = f.date_id
            WHERE f.product_id = ANY(%s) {year_sql}
            GROUP BY d.week_iso, f.product_id
        """, (list(it['product_id'] for it in top5),) + year_params)
        counts = {(r['week_iso'], int(r['product_id'])): int(r['n']) for r in per_prod}
        weeks = sorted(totals.keys())[-52:]
        for it in top5:
            weekly_trend.append({
                "article": it['article'],
                "series": [{
                    "week": f"S{w[-2:]}-{w[2:4]}",
                    "rate": safe_num(counts.get((w, it['product_id']), 0) / totals[w] * 100) if totals.get(w) else 0.0,
                } for w in weeks],
            })

    available_categories = ["Toutes"] + sorted([r['category_name'] for r in sql_fetch_all(
        "SELECT DISTINCT category_name FROM dim_categories WHERE category_name IS NOT NULL AND category_name != 'A CLASSIFIER' ORDER BY category_name")])
    available_statuts = ["Toutes"] + [label for _, label in PENETRATION_STATUTS]
    available_years = [int(r['y']) for r in sql_fetch_all(
        "SELECT DISTINCT EXTRACT(YEAR FROM date_id) AS y FROM fact_ticket_lines ORDER BY y DESC")]

    rates = sorted(i['penetration_rate'] for i in items)
    return {
        "kpis": {
            "total_articles": len(items),
            "total_tickets": total_tickets,
            "pen_max": rates[-1] if rates else 0,
            "pen_median": rates[len(rates) // 2] if rates else 0,
            "status_counts": status_counts,
            "status_counts_all": status_counts_all,
        },
        "items": items,
        "category_summary": cat_pen_list,
        "weekly_trend": weekly_trend,
        "seuils": [{"seuil": s, "statut": l} for s, l in PENETRATION_STATUTS],
        "available_categories": available_categories,
        "available_statuts": available_statuts,
        "available_years": available_years,
    }

# ── 2. Vitesse de vente ─────────────────────────────────────
def get_sales_velocity_data_pg():
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    # Vitesse moyenne de la boutique par jour de la semaine (articles / jour d'ouverture),
    # calculée séparément sur tous les jours, les jours de saison touristique et les jours d'événement.
    dow_raw = sql_fetch_all("""
        WITH jours AS (
            SELECT f.date_id,
                   SUM(f.quantity) AS qte,
                   BOOL_OR(COALESCE(e.is_event, FALSE)) AS is_event
            FROM fact_ticket_lines f
            LEFT JOIN dim_events e ON e.event_id = f.event_id
            GROUP BY f.date_id
        )
        SELECT d.day_of_week,
               AVG(j.qte) AS v_all,
               AVG(j.qte) FILTER (WHERE d.is_touristic) AS v_touristic,
               AVG(j.qte) FILTER (WHERE j.is_event) AS v_event
        FROM jours j
        JOIN dim_dates d ON d.date_id = j.date_id
        GROUP BY d.day_of_week
        ORDER BY d.day_of_week
    """)
    labels = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
    dow_dict = {int(r['day_of_week']): r for r in dow_raw}
    dow_velocity = []
    for i in range(7):
        r = dow_dict.get(i, {})
        dow_velocity.append({
            "day": labels[i],
            "all": safe_num(r.get('v_all')),
            # None = aucun jour de ce type pour ce jour de la semaine
            "touristic": safe_num(r['v_touristic']) if r.get('v_touristic') is not None else None,
            "event": safe_num(r['v_event']) if r.get('v_event') is not None else None,
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
        if peak_hour is not None and ratio_pic >= PIC_HORAIRE_SEUIL_PCT:
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
        "seuil_pic_horaire_pct": PIC_HORAIRE_SEUIL_PCT,
        "dow_velocity": dow_velocity,
        "macro_items": macro_items,
        "hourly_distribution": hourly_dist
    }

# ── 3. Contribution au ticket ────────────────────────────────
def get_ticket_contribution_data_pg():
    """
    Cahier des charges : contribution (%) = prix unitaire x quantité / valeur totale du ticket x 100.
    Un ticket = date + numéro. Analyse sur les tickets à plusieurs lignes.
    """
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    sizes = sql_fetch_one("""
        WITH t AS (
            SELECT date_id, ticket_number, COUNT(DISTINCT product_id) AS nb_items
            FROM fact_ticket_lines
            GROUP BY date_id, ticket_number
        )
        SELECT COUNT(*) AS nb_total,
               COUNT(*) FILTER (WHERE nb_items = 1) AS nb_mono,
               COUNT(*) FILTER (WHERE nb_items >= 2) AS nb_multi
        FROM t
    """) or {}
    nb_total = int(sizes.get('nb_total') or 0)
    nb_mono = int(sizes.get('nb_mono') or 0)
    nb_multi = int(sizes.get('nb_multi') or 0)

    contribution_raw = sql_fetch_all("""
    WITH ticket_totals AS (
        SELECT date_id, ticket_number, SUM(total_revenue) AS ticket_total
        FROM fact_ticket_lines
        GROUP BY date_id, ticket_number
        HAVING COUNT(DISTINCT product_id) >= 2
    ),
    line_contributions AS (
        SELECT
            f.product_id,
            f.date_id,
            f.ticket_number,
            f.total_revenue,
            (CASE WHEN tt.ticket_total > 0
                  THEN f.total_revenue::numeric / tt.ticket_total::numeric * 100
                  ELSE 0 END) AS contribution_pct
        FROM fact_ticket_lines f
        JOIN ticket_totals tt
          ON f.date_id = tt.date_id AND f.ticket_number = tt.ticket_number
    ),
    product_contributions AS (
        SELECT
            product_id,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY contribution_pct) AS contribution_med,
            AVG(contribution_pct) AS contribution_moy,
            COUNT(DISTINCT (date_id, ticket_number)) AS nb_tickets_multi,
            SUM(total_revenue) AS ca_multi
        FROM line_contributions
        GROUP BY product_id
        HAVING COUNT(DISTINCT (date_id, ticket_number)) >= 10
    )
    SELECT pc.product_id, p.article_name, pc.contribution_med, pc.contribution_moy,
           pc.nb_tickets_multi, pc.ca_multi
    FROM product_contributions pc
    JOIN dim_products p ON pc.product_id = p.product_id
    ORDER BY pc.contribution_med DESC
    """)

    # Tous les produits analysables (≥ 10 tickets à plusieurs produits) : les rôles sont comptés sur
    # l'ensemble, sinon une liste limitée aux plus fortes parts ne contiendrait que des « Générateurs ».
    all_items = []
    for r in contribution_raw:
        nb_tm = int(r['nb_tickets_multi'] or 0)
        contrib_med = safe_num(r['contribution_med'])
        # Cahier des charges : deux rôles, « Générateurs de chiffre » et « Accessoires »
        statut = ("Générateur de chiffre" if contrib_med >= CONTRIBUTION_GENERATEUR_SEUIL_PCT
                  else "Accessoire")
        all_items.append({
            "article": r['article_name'],
            "contribution_med": contrib_med,
            "contribution_moy": safe_num(r['contribution_moy']),
            "nb_tickets_multi": nb_tm,
            "statut_contribution": statut,
            # Chiffre d'affaires du produit dans les seuls tickets multi-produits
            "ca_total_multi": safe_num(r['ca_multi']),
            "frequence_multi_pct": safe_num(nb_tm / max(nb_multi, 1) * 100),
        })

    # Liste historique (30 plus fortes parts) conservée pour l'agent IA
    top20 = all_items[:30]

    distribution_par_statut = {}
    for t in all_items:
        d = distribution_par_statut.setdefault(t["statut_contribution"], {"nb": 0, "ca": 0.0})
        d["nb"] += 1
        d["ca"] += t["ca_total_multi"]

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
            "nb_produits_analysables": len(all_items),
            "ca_total_multi": sum(t["ca_total_multi"] for t in all_items),
            "distribution_par_statut": distribution_par_statut,
            "nb_multi": nb_multi,
            "nb_mono": nb_mono,
            "nb_total": nb_total,
            "pct_multi": safe_num(nb_multi / max(nb_total, 1) * 100),
            "pct_mono": safe_num(nb_mono / max(nb_total, 1) * 100),
        },
        "top20": top20,
        "all_items": all_items,
        "bcg_quadrants": bcg_quadrants,
    }

# ── 4. Fréquence d'achat ─────────────────────────────────────
def get_repurchase_frequency_data_pg():
    """
    Cahier des charges : régularité (%) = semaines avec vente / total des semaines x 100.
    Total des semaines = semaines de la période couverte par les ventes (pas les semaines futures).
    Semaine = semaine ISO avec son année (« 2024-W03 »).
    """
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    total_semaines = int(sql_value("""
        SELECT COUNT(DISTINCT d.week_iso)
        FROM dim_dates d
        WHERE d.date_id BETWEEN (SELECT MIN(date_id) FROM fact_ticket_lines)
                            AND (SELECT MAX(date_id) FROM fact_ticket_lines)
    """) or 1) or 1

    freq_raw = sql_fetch_all("""
        SELECT p.product_id, p.article_name, c.category_name,
               COUNT(DISTINCT d.week_iso) AS semaines_actives,
               SUM(f.total_revenue) AS ca_total,
               SUM(f.quantity) AS qte_totale
        FROM fact_ticket_lines f
        JOIN dim_products p ON f.product_id = p.product_id
        JOIN dim_dates d ON f.date_id = d.date_id
        LEFT JOIN dim_categories c ON p.category_id = c.category_id
        GROUP BY p.product_id, p.article_name, c.category_name
        ORDER BY semaines_actives DESC
    """)

    items = []
    for r in freq_raw:
        sa = int(r['semaines_actives'] or 0)
        pct = safe_num(sa / total_semaines * 100)
        ca_tot = safe_num(r['ca_total'])
        items.append({
            "article": r['article_name'],
            "category": r['category_name'] or 'Autre',
            "semaines_actives": sa,
            "repurchase_freq_pct": pct,
            "statut_frequence": statut_frequence(pct),
            "ca_total": ca_tot,
            "ca_par_sem_active": safe_num(ca_tot / max(sa, 1)),
        })

    status_distribution = {}
    for item in items:
        status_distribution[item['statut_frequence']] = status_distribution.get(item['statut_frequence'], 0) + 1

    ca_global = sum(i['ca_total'] for i in items) or 1
    ca_quotidiens = sum(i['ca_total'] for i in items if i['statut_frequence'] == FREQUENCE_STATUTS[0][1])

    return {
        "total_sem": total_semaines,
        "nb_produits": len(items),
        "nb_quotidiens": status_distribution.get(FREQUENCE_STATUTS[0][1], 0),
        "part_ca_quotidiens": safe_num(ca_quotidiens / ca_global * 100),
        "status_distribution": status_distribution,
        "items": items,
        "weekly_multi": [],
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

    rules_raw = sql_fetch_all(f"""
    SELECT antecedents_str, consequents_str, support, confidence, lift
    FROM association_rules
    ORDER BY {order_by}
    """)

    def band_from_lift(l):
        if l >= 4.0: return "Tres forte"
        if l >= 2.5: return "Forte"
        if l >= 1.5: return "Moderee"
        return "Legere"

    # A -> B et B -> A décrivent le même groupe de produits : on ne garde qu'une règle
    # par groupe, la première dans l'ordre de tri choisi (lift, confiance ou support).
    def _items(r):
        noms = [x.strip() for x in str(r['antecedents_str'] or '').split(',')]
        noms += [x.strip() for x in str(r['consequents_str'] or '').split(',')]
        return frozenset(n for n in noms if n)

    seen = set()
    uniques = []
    for r in rules_raw:
        key = _items(r)
        if key in seen:
            continue
        seen.add(key)
        uniques.append(r)

    rules = []
    for r in uniques[: int(top_n) if top_n else None]:
        lift_v = safe_num(r['lift'])
        rules.append({
            "antecedent": r['antecedents_str'],
            "consequent": r['consequents_str'],
            "support": safe_num(r['support']) * 100,
            "confidence": safe_num(r['confidence']) * 100,
            "lift": lift_v,
            "lift_bande": band_from_lift(lift_v),
            "lecture": f"Achetés ensemble {lift_v:.1f} fois plus souvent que par hasard".replace(".", ","),
        })

    mono = sql_fetch_one("""
        WITH t AS (SELECT date_id, ticket_number, COUNT(DISTINCT product_id) AS n FROM fact_ticket_lines GROUP BY 1, 2)
        SELECT COUNT(*) FILTER (WHERE n = 1)::numeric / NULLIF(COUNT(*), 0) * 100 AS pct FROM t
    """) or {}

    return {
        "nb_total_regles": len(uniques),
        "nb_regles_brutes": len(rules_raw),
        "pct_tickets_mono": safe_num(mono.get('pct')),
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


# ── 6. Matrice de décision (cahier des charges, composante 2 §4) ─────────────
MATRICE_ACTIONS = {
    "Star": ("Star (indispensable)", "Priorité critique : zéro rupture, alerte horaire"),
    "Niche": ("Niche (rentable)", "Stocker pour les clients fidèles (gros volumes)"),
    "Trafic": ("Générateur de trafic", "Placer en vitrine ou en caisse pour attirer, stock modéré"),
    "Dormant": ("Stock dormant", "Réduire la production, envisager l'arrêt"),
}


def get_decision_matrix_data_pg(year=None):
    """
    Pénétration x vitesse journalière, frontières = moyennes de la boutique (cahier des charges).
    Vitesse journalière = quantité vendue / jours où le produit a été vendu.
    Alerte horaire : l'heure de pointe dépasse 40 % des ventes du produit.
    """
    if not is_pg_available():
        raise Exception("PostgreSQL non disponible")

    y_int = _parse_year(year)
    year_sql = "AND EXTRACT(YEAR FROM f.date_id) = %s" if y_int else ""
    yp = (y_int,) if y_int else ()

    total_tickets = int(sql_value(f"""
        SELECT COUNT(DISTINCT (f.date_id, f.ticket_number)) FROM fact_ticket_lines f WHERE 1=1 {year_sql}
    """, yp) or 0)

    rows = sql_fetch_all(f"""
        SELECT p.product_id, p.article_name AS article, c.category_name AS category,
               COUNT(DISTINCT (f.date_id, f.ticket_number)) AS tickets,
               SUM(f.quantity) AS qte,
               COUNT(DISTINCT f.date_id) AS jours_actifs,
               SUM(f.total_revenue) AS ca
        FROM fact_ticket_lines f
        JOIN dim_products p ON p.product_id = f.product_id
        LEFT JOIN dim_categories c ON c.category_id = p.category_id
        WHERE 1=1 {year_sql}
        GROUP BY p.product_id, p.article_name, c.category_name
        HAVING SUM(f.total_revenue) > 0
    """, yp)

    pics = sql_fetch_all(f"""
        WITH h AS (
            SELECT f.product_id, f.hour, SUM(f.quantity) AS q,
                   ROW_NUMBER() OVER (PARTITION BY f.product_id ORDER BY SUM(f.quantity) DESC) AS rn
            FROM fact_ticket_lines f
            WHERE f.hour IS NOT NULL {year_sql}
            GROUP BY f.product_id, f.hour
        ), t AS (
            SELECT f.product_id, SUM(f.quantity) AS q FROM fact_ticket_lines f WHERE 1=1 {year_sql} GROUP BY f.product_id
        )
        SELECT h.product_id, h.hour, h.q AS q_pic, t.q AS q_tot
        FROM h JOIN t ON t.product_id = h.product_id
        WHERE h.rn = 1
    """, yp + yp)
    pic = {int(r['product_id']): (int(r['hour']), safe_num(r['q_pic']) / max(safe_num(r['q_tot']), 1) * 100) for r in pics}

    items = []
    for r in rows:
        tc = int(r['tickets'] or 0)
        ja = int(r['jours_actifs'] or 0)
        items.append({
            "article": r['article'],
            "category": r['category'] or 'Autre',
            "penetration_rate": safe_num(tc / total_tickets * 100) if total_tickets else 0.0,
            "daily_velocity": safe_num(safe_num(r['qte']) / ja) if ja else 0.0,
            "jours_actifs": ja,
            "ca_total": safe_num(r['ca']),
            "qty_total": safe_num(r['qte']),
            "peak_hour": pic.get(int(r['product_id']), (None, 0))[0],
            "ratio_pic_percent": safe_num(pic.get(int(r['product_id']), (None, 0))[1]),
        })

    if not items:
        return {"items": [], "seuils": {}, "quadrants": {}}

    pen_moy = sum(i['penetration_rate'] for i in items) / len(items)
    vel_moy = sum(i['daily_velocity'] for i in items) / len(items)

    quadrants = {k: {"label": v[0], "action": v[1], "nb": 0, "ca": 0.0} for k, v in MATRICE_ACTIONS.items()}
    for it in items:
        hp = it['penetration_rate'] >= pen_moy
        hv = it['daily_velocity'] >= vel_moy
        key = "Star" if hp and hv else "Niche" if hv else "Trafic" if hp else "Dormant"
        it['quadrant'] = key
        it['categorie_strategique'] = MATRICE_ACTIONS[key][0]
        it['action'] = MATRICE_ACTIONS[key][1]
        it['alerte_horaire'] = (
            f"Remplir avant {max(6, it['peak_hour'] - 1):02d}h00"
            if it['peak_hour'] is not None and it['ratio_pic_percent'] >= PIC_HORAIRE_SEUIL_PCT else None
        )
        # Critère complémentaire du cahier (phase 5) : pénétration < 1 % et vitesse proche de zéro
        it['dormant_strict'] = it['penetration_rate'] < 1.0 and it['daily_velocity'] < 1.0
        quadrants[key]["nb"] += 1
        quadrants[key]["ca"] += it['ca_total']

    ca_tot = sum(i['ca_total'] for i in items) or 1
    for q in quadrants.values():
        q["part_ca"] = safe_num(q["ca"] / ca_tot * 100)

    items.sort(key=lambda x: (["Star", "Niche", "Trafic", "Dormant"].index(x['quadrant']), -x['ca_total']))
    return {
        "items": items,
        "seuils": {"penetration_moyenne": safe_num(pen_moy), "vitesse_moyenne": safe_num(vel_moy),
                   "pic_horaire_pct": PIC_HORAIRE_SEUIL_PCT},
        "quadrants": quadrants,
        "nb_dormant_strict": sum(1 for i in items if i['dormant_strict']),
        "methodologie": ("Pénétration = tickets contenant le produit / tickets ; vitesse = quantité / jours de vente "
                         "du produit ; frontières = moyennes de la boutique (cahier des charges)."),
    }
