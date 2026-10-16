r"""
Exporte les ventes journalières par produit depuis PostgreSQL vers forecasting/data/ (fichiers CSV).
Lecture seule : ne modifie rien dans la base.

Utilisation (dans le dossier du projet) :
    python forecasting\export_data.py

Fichiers produits :
    data/sales.csv     -> date, produit, quantité, chiffre d'affaires (une ligne par produit et par jour vendu)
    data/products.csv  -> produits et familles
    data/calendar.csv  -> calendrier (jour de semaine, mois, saison touristique, événement, tickets du jour)
"""
import csv
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from db.db import sql_fetch_all  # même connexion que le backend (variables DB_HOST, DB_PASS…)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(OUT, exist_ok=True)


def dump(name, rows):
    path = os.path.join(OUT, name)
    with open(path, "w", newline="", encoding="utf-8") as f:
        if not rows:
            f.write("")
            return
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"  {name:<14} {len(rows):>8} lignes")


print("Export des données pour la prévision par produit…")
dump("sales.csv", sql_fetch_all("""
    SELECT date_id, product_id, SUM(quantity) AS qty, SUM(total_revenue) AS revenue
    FROM fact_ticket_lines
    GROUP BY date_id, product_id
    ORDER BY date_id, product_id
"""))
dump("products.csv", sql_fetch_all("""
    SELECT p.product_id, p.article_name, COALESCE(c.category_name, 'Autre') AS category
    FROM dim_products p LEFT JOIN dim_categories c ON c.category_id = p.category_id
    ORDER BY p.product_id
"""))
dump("calendar.csv", sql_fetch_all("""
    SELECT d.date_id, d.day_of_week, d.month, d.is_weekend, d.is_touristic,
           COALESCE(a.nb_tickets, 0) AS nb_tickets, COALESCE(a.nb_articles, 0) AS nb_articles,
           COALESCE(a.ca_jour, 0) AS ca_jour,
           (SELECT e.event_name FROM fact_ticket_lines f JOIN dim_events e ON e.event_id = f.event_id
             WHERE f.date_id = d.date_id AND e.is_event
             GROUP BY e.event_name ORDER BY COUNT(*) DESC LIMIT 1) AS event_name
    FROM dim_dates d LEFT JOIN daily_aggregates a ON a.date_id = d.date_id
    ORDER BY d.date_id
"""))
print(f"Terminé. Fichiers dans : {OUT}")
