from db import sql_fetch_all, sql_value


SORT_MAP = {
    "Confiance ↓": "confidence DESC",
    "Support ↓": "support DESC",
}


def get_associations_from_sql(sort_by="Lift ↓", top_n=20):
    order_clause = SORT_MAP.get(sort_by, "lift DESC")

    nb_total = sql_value("SELECT COUNT(*) FROM association_rules")

    if top_n and top_n != "Toutes":
        try:
            top_n = int(top_n)
            limit_sql = " LIMIT %s"
            params = [top_n]
        except Exception:
            limit_sql = ""
            params = []
    else:
        limit_sql = ""
        params = []

    # Une seule règle par groupe de produits (A -> B et B -> A sont le même groupe)
    sql = (
        "SELECT antecedents_str, consequents_str, support, confidence, lift "
        "FROM association_rules ORDER BY %s" % order_clause
    )
    seen = set()
    rows = []
    for r in sql_fetch_all(sql):
        noms = str(r["antecedents_str"] or "").split(",") + str(r["consequents_str"] or "").split(",")
        key = frozenset(n.strip() for n in noms if n.strip())
        if key in seen:
            continue
        seen.add(key)
        rows.append(r)
    nb_total = len(rows)
    if params:
        rows = rows[: params[0]]

    rules = []
    for r in rows:
        rules.append({
            "antecedent": str(r["antecedents_str"]),
            "consequent": str(r["consequents_str"]),
            "support": round(float(r["support"]) * 100, 2),
            "confidence": round(float(r["confidence"]) * 100, 2),
            "lift": round(float(r["lift"]), 2),
        })

    return {
        "nb_total_regles": int(nb_total or 0),
        "rules": rules,
    }
