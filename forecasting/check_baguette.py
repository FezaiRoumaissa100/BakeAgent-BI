"""
Vérification ponctuelle : pourquoi la TRADITIONAL BAGUETTE vend-elle 4 fois moins fin 2025 que début 2025,
et pourquoi la prévision du 1er janvier 2026 est-elle si basse alors que le 1er janvier 2025 était très fort ?

Lecture seule (aucune écriture en base). Lancer depuis le dossier du projet :
    python forecasting\\check_baguette.py
Le résultat est écrit dans forecasting\\data\\check_baguette.txt (dossier non envoyé sur GitHub).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))
from db.db import sql_fetch_all  # noqa: E402

PRODUIT = "TRADITIONAL BAGUETTE"
out = []


def p(*a):
    line = " ".join(str(x) for x in a)
    print(line)
    out.append(line)


def table(rows, cols=None):
    if not rows:
        p("  (aucune ligne)")
        return
    cols = cols or list(rows[0].keys())
    p("  " + " | ".join(cols))
    for r in rows:
        p("  " + " | ".join(str(r[c]) for c in cols))


p("=== 1. Articles dont le nom contient BAGUETTE / BAGUET / TRAD : quantités par mois ===")
rows = sql_fetch_all("""
    SELECT p.article_name, to_char(f.date_id, 'YYYY-MM') AS mois, SUM(f.quantity) AS qte
    FROM fact_ticket_lines f JOIN dim_products p ON p.product_id = f.product_id
    WHERE p.article_name ILIKE '%%BAGUET%%' OR p.article_name ILIKE '%%TRAD%%'
    GROUP BY 1, 2 ORDER BY 1, 2
""")
table(rows)

p("")
p("=== 2. Toute la boutique par mois : jours ouverts, tickets, articles, CA ===")
rows = sql_fetch_all("""
    SELECT to_char(date_id, 'YYYY-MM') AS mois, COUNT(DISTINCT date_id) AS jours,
           COUNT(DISTINCT (date_id, ticket_number)) AS tickets, SUM(quantity) AS articles,
           ROUND(SUM(total_revenue)::numeric, 0) AS ca
    FROM fact_ticket_lines GROUP BY 1 ORDER BY 1
""")
table(rows)

p("")
p(f"=== 3. {PRODUIT} jour par jour : 15/12/2024 -> 15/01/2025 et 01/12/2025 -> fin des données ===")
rows = sql_fetch_all("""
    SELECT f.date_id, to_char(f.date_id, 'Dy') AS jour, SUM(f.quantity) AS qte,
           COUNT(DISTINCT f.ticket_number) AS tickets_avec
    FROM fact_ticket_lines f JOIN dim_products p ON p.product_id = f.product_id
    WHERE p.article_name = %s
      AND (f.date_id BETWEEN '2024-12-15' AND '2025-01-15' OR f.date_id >= '2025-12-01')
    GROUP BY 1, 2 ORDER BY 1
""", (PRODUIT,))
table(rows)

p("")
p("=== 4. Les 1er janvier : tickets, articles et CA de la boutique ===")
rows = sql_fetch_all("""
    SELECT date_id, COUNT(DISTINCT ticket_number) AS tickets, SUM(quantity) AS articles,
           ROUND(SUM(total_revenue)::numeric, 0) AS ca, MIN(hour) AS premiere_heure, MAX(hour) AS derniere_heure
    FROM fact_ticket_lines WHERE to_char(date_id, 'MM-DD') = '01-01' GROUP BY 1 ORDER BY 1
""")
table(rows)

p("")
p("=== 5. Le 1er janvier 2025 : 15 articles les plus vendus ===")
rows = sql_fetch_all("""
    SELECT p.article_name, SUM(f.quantity) AS qte
    FROM fact_ticket_lines f JOIN dim_products p ON p.product_id = f.product_id
    WHERE f.date_id = '2025-01-01' GROUP BY 1 ORDER BY 2 DESC LIMIT 15
""")
table(rows)

p("")
p("=== 6. Décembre 2025 : jours ouverts de la boutique (jours manquants = données incomplètes ?) ===")
rows = sql_fetch_all("""
    SELECT date_id, to_char(date_id, 'Dy') AS jour, COUNT(DISTINCT ticket_number) AS tickets, SUM(quantity) AS articles
    FROM fact_ticket_lines WHERE date_id >= '2025-12-01' GROUP BY 1, 2 ORDER BY 1
""")
table(rows)

p("")
p(f"=== 7. Prévision actuelle de {PRODUIT} (dernier calcul du pipeline) ===")
try:
    from engines.product_forecast_engine import get_product_forecast_list, get_product_forecast_detail
    lst = get_product_forecast_list()
    it = next((i for i in lst.get("items", []) if i["article"] == PRODUIT), None)
    if not it:
        p("  produit absent de la prévision")
    else:
        d = get_product_forecast_detail(it["product_id"])
        p("  modèle :", {k: d["model"].get(k) for k in ("method", "segment", "saisonnier", "wape", "next7", "usual7", "saison")})
        table(d["forecast"], ["ds", "yhat", "yhat_lower", "yhat_upper", "is_ferme", "last_year"])
except Exception as e:  # noqa: BLE001
    p("  erreur :", type(e).__name__, e)

os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
dest = os.path.join(HERE, "data", "check_baguette.txt")
with open(dest, "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("\nRésultat écrit dans", dest)
