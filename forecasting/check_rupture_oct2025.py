"""
Vérification ponctuelle : que s'est-il passé en octobre 2025 ?
Depuis octobre 2025, la boutique a deux fois moins de tickets mais un chiffre d'affaires presque identique,
et la TRADITIONAL BAGUETTE passe de ~3 500 à ~500 par mois. Ce script cherche si c'est un changement
d'enregistrement en caisse (tickets regroupés, article renommé, quantités notées autrement) ou une vraie baisse.

Lecture seule. Lancer depuis le dossier du projet :
    python forecasting\\check_rupture_oct2025.py
Résultat : forecasting\\data\\check_rupture_oct2025.txt (dossier non envoyé sur GitHub).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))
from db.db import sql_fetch_all  # noqa: E402

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


p("=== 1. TRADITIONAL BAGUETTE par mois : quantité, CA, prix moyen, lignes, quantité par ligne ===")
table(sql_fetch_all("""
    SELECT to_char(f.date_id, 'YYYY-MM') AS mois, SUM(f.quantity) AS qte, ROUND(SUM(f.total_revenue)::numeric, 0) AS ca,
           ROUND((SUM(f.total_revenue) / NULLIF(SUM(f.quantity), 0))::numeric, 2) AS prix_moyen,
           COUNT(*) AS lignes, ROUND(AVG(f.quantity)::numeric, 2) AS qte_par_ligne,
           ROUND(AVG(f.unit_price)::numeric, 2) AS prix_unitaire_moyen
    FROM fact_ticket_lines f JOIN dim_products p ON p.product_id = f.product_id
    WHERE p.article_name = 'TRADITIONAL BAGUETTE' AND f.date_id >= '2024-07-01'
    GROUP BY 1 ORDER BY 1
"""))

p("")
p("=== 2. Boutique par mois depuis 2024-07 : tickets, lignes, lignes par ticket, articles par ticket, CA par ticket ===")
table(sql_fetch_all("""
    WITH t AS (
        SELECT date_id, ticket_number, COUNT(*) AS lignes, SUM(quantity) AS qte, SUM(total_revenue) AS ca
        FROM fact_ticket_lines WHERE date_id >= '2024-07-01' GROUP BY 1, 2)
    SELECT to_char(date_id, 'YYYY-MM') AS mois, COUNT(*) AS tickets, SUM(lignes) AS lignes,
           ROUND(AVG(lignes)::numeric, 2) AS lignes_par_ticket, ROUND(AVG(qte)::numeric, 2) AS articles_par_ticket,
           ROUND(AVG(ca)::numeric, 2) AS ca_par_ticket, MAX(qte) AS plus_gros_ticket_articles
    FROM t GROUP BY 1 ORDER BY 1
"""))

p("")
p("=== 3. Format des numéros de ticket : exemples en septembre puis en octobre/novembre 2025 ===")
table(sql_fetch_all("""
    SELECT to_char(date_id, 'YYYY-MM') AS mois, MIN(ticket_number) AS plus_petit, MAX(ticket_number) AS plus_grand,
           COUNT(DISTINCT ticket_number) AS numeros_distincts, COUNT(DISTINCT (date_id, ticket_number)) AS tickets_jour
    FROM fact_ticket_lines WHERE date_id BETWEEN '2025-08-01' AND '2025-12-31' GROUP BY 1 ORDER BY 1
"""))

p("")
p("=== 4. Articles qui apparaissent pour la première fois à partir d'août 2025 (nouveaux noms ?) ===")
table(sql_fetch_all("""
    SELECT p.article_name, MIN(f.date_id) AS premiere_vente, SUM(f.quantity) AS qte, ROUND(SUM(f.total_revenue)::numeric, 0) AS ca
    FROM fact_ticket_lines f JOIN dim_products p ON p.product_id = f.product_id
    GROUP BY 1 HAVING MIN(f.date_id) >= '2025-08-01' ORDER BY qte DESC LIMIT 25
"""))

p("")
p("=== 5. Plus fortes variations de quantité : oct-déc 2024 vs oct-déc 2025 (30 articles) ===")
table(sql_fetch_all("""
    SELECT p.article_name,
           SUM(CASE WHEN f.date_id BETWEEN '2024-10-01' AND '2024-12-31' THEN f.quantity ELSE 0 END) AS qte_2024,
           SUM(CASE WHEN f.date_id BETWEEN '2025-10-01' AND '2025-12-31' THEN f.quantity ELSE 0 END) AS qte_2025
    FROM fact_ticket_lines f JOIN dim_products p ON p.product_id = f.product_id
    WHERE f.date_id BETWEEN '2024-10-01' AND '2024-12-31' OR f.date_id BETWEEN '2025-10-01' AND '2025-12-31'
    GROUP BY 1
    ORDER BY ABS(SUM(CASE WHEN f.date_id BETWEEN '2025-10-01' AND '2025-12-31' THEN f.quantity ELSE 0 END)
               - SUM(CASE WHEN f.date_id BETWEEN '2024-10-01' AND '2024-12-31' THEN f.quantity ELSE 0 END)) DESC
    LIMIT 30
"""))

p("")
p("=== 6. Jour par jour autour de la cassure (15/09/2025 -> 15/10/2025) : tickets, articles, CA, baguettes tradition ===")
table(sql_fetch_all("""
    SELECT f.date_id, to_char(f.date_id, 'Dy') AS jour, COUNT(DISTINCT f.ticket_number) AS tickets,
           SUM(f.quantity) AS articles, ROUND(SUM(f.total_revenue)::numeric, 0) AS ca,
           SUM(CASE WHEN p.article_name = 'TRADITIONAL BAGUETTE' THEN f.quantity ELSE 0 END) AS trad
    FROM fact_ticket_lines f JOIN dim_products p ON p.product_id = f.product_id
    WHERE f.date_id BETWEEN '2025-09-15' AND '2025-10-15' GROUP BY 1, 2 ORDER BY 1
"""))

os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
dest = os.path.join(HERE, "data", "check_rupture_oct2025.txt")
with open(dest, "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("\nRésultat écrit dans", dest)
