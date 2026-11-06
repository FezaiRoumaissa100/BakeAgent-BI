"""
Tailles de plaque : combien de pièces tient une plaque (ou une fournée) de chaque produit.

Les ventes et les prévisions restent en PIÈCES (c'est ce que la caisse enregistre et ce que le client achète).
La plaque est une unité de PRODUCTION : elle sert seulement à présenter la liste « À préparer » (et la saisie du stock)
comme le boulanger travaille : « 3 plaques de croissants » plutôt que « 37 croissants ».

Table : product_tray_sizes (créée automatiquement au premier appel, rien à lancer à la main).
  pieces_per_tray  pièces par plaque (entier de 1 à 1000)
  rounding         up = toujours monter à la plaque entière (jamais en manque) ;
                   nearest = plaque la plus proche (au moins 1 plaque si on doit en faire) ;
                   none = pas de plaques pour ce produit : tout reste en pièces
  is_estimate      vrai tant qu'un humain n'a pas confirmé la taille (estimation de départ)
Un produit sans ligne ici reste affiché en pièces.
"""
import math
from datetime import timedelta
from db.db import sql_fetch_all, sql_fetch_one, get_connection
from config import is_produced

ROUNDINGS = ("up", "nearest", "none")
MAX_PIECES = 1000
_ready = False


def ensure_table():
    global _ready
    if _ready:
        return
    cur = get_connection().cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS product_tray_sizes (
            product_id      INTEGER PRIMARY KEY REFERENCES dim_products(product_id) ON DELETE CASCADE,
            pieces_per_tray INTEGER NOT NULL CHECK (pieces_per_tray BETWEEN 1 AND 1000),
            rounding        VARCHAR(10) NOT NULL DEFAULT 'up' CHECK (rounding IN ('up', 'nearest', 'none')),
            is_estimate     BOOLEAN NOT NULL DEFAULT TRUE,
            note            VARCHAR(200),
            updated_at      TIMESTAMP NOT NULL DEFAULT now()
        )""")
    _ready = True


def tray_map() -> dict:
    """product_id -> {pieces, rounding, estimate} (pour joindre les plaques aux autres listes)."""
    ensure_table()
    return {r["product_id"]: {"pieces": int(r["pieces_per_tray"]), "rounding": r["rounding"], "estimate": bool(r["is_estimate"])}
            for r in sql_fetch_all("SELECT product_id, pieces_per_tray, rounding, is_estimate FROM product_tray_sizes")}


def list_trays(days: int = 90) -> dict:
    """Tous les produits vendus ces `days` derniers jours (plus gros volumes d'abord), avec leur plaque s'ils en ont une,
    plus les produits qui ont une plaque même s'ils ne se vendent plus."""
    ensure_table()
    last = (sql_fetch_one("SELECT MAX(date_id) AS d FROM fact_ticket_lines") or {}).get("d")
    since = (last - timedelta(days=int(days))) if last else None
    rows = sql_fetch_all("""
        SELECT p.product_id, p.article_name, COALESCE(c.category_name, 'Autre') AS category,
               COALESCE(s.q, 0) AS sold, t.pieces_per_tray, t.rounding, t.is_estimate, t.note
        FROM dim_products p
        LEFT JOIN dim_categories c ON c.category_id = p.category_id
        LEFT JOIN (SELECT product_id, SUM(quantity) AS q FROM fact_ticket_lines WHERE date_id > %s GROUP BY 1) s
               ON s.product_id = p.product_id
        LEFT JOIN product_tray_sizes t ON t.product_id = p.product_id
        WHERE COALESCE(s.q, 0) > 0 OR t.product_id IS NOT NULL
        ORDER BY COALESCE(s.q, 0) DESC, p.article_name
    """, (since,))
    rows = [r for r in rows if is_produced(r["article_name"], r["category"])]     # pas de plaque pour une boisson ou la découpe
    items = [{
        "product_id": r["product_id"], "article": r["article_name"], "category": r["category"], "sold": float(r["sold"] or 0),
        "pieces_per_tray": int(r["pieces_per_tray"]) if r["pieces_per_tray"] is not None else None,
        "rounding": r["rounding"], "is_estimate": bool(r["is_estimate"]) if r["is_estimate"] is not None else None,
        "note": r["note"],
    } for r in rows]
    return {"items": items, "roundings": list(ROUNDINGS), "nb_with_tray": sum(1 for i in items if i["pieces_per_tray"])}


def save_tray(product_id, pieces, rounding) -> dict:
    """Crée ou modifie la plaque d'un produit. Une taille saisie par un humain n'est plus une estimation."""
    ensure_table()
    try:
        pid = int(product_id)
    except (TypeError, ValueError):
        return {"ok": False, "message": "Produit invalide."}
    if isinstance(pieces, bool) or pieces is None or pieces == "":
        return {"ok": False, "message": "Indiquer le nombre de pièces par plaque."}
    try:
        n = float(pieces)
    except (TypeError, ValueError):
        return {"ok": False, "message": "Le nombre de pièces par plaque doit être un nombre."}
    if not math.isfinite(n) or n != int(n) or not (1 <= n <= MAX_PIECES):
        return {"ok": False, "message": f"Le nombre de pièces par plaque doit être un entier entre 1 et {MAX_PIECES}."}
    if rounding not in ROUNDINGS:
        return {"ok": False, "message": "Arrondi inconnu (up, nearest ou none)."}
    if not sql_fetch_one("SELECT 1 AS x FROM dim_products WHERE product_id = %s", (pid,)):
        return {"ok": False, "message": "Produit introuvable."}
    cur = get_connection().cursor()
    cur.execute("""INSERT INTO product_tray_sizes (product_id, pieces_per_tray, rounding, is_estimate, updated_at)
                   VALUES (%s, %s, %s, FALSE, now())
                   ON CONFLICT (product_id) DO UPDATE
                   SET pieces_per_tray = EXCLUDED.pieces_per_tray, rounding = EXCLUDED.rounding,
                       is_estimate = FALSE, updated_at = now()""", (pid, int(n), rounding))
    return {"ok": True, "product_id": pid, "pieces_per_tray": int(n), "rounding": rounding, "is_estimate": False}


def delete_tray(product_id) -> dict:
    ensure_table()
    try:
        pid = int(product_id)
    except (TypeError, ValueError):
        return {"ok": False, "message": "Produit invalide."}
    cur = get_connection().cursor()
    cur.execute("DELETE FROM product_tray_sizes WHERE product_id = %s", (pid,))
    return {"ok": True, "deleted": cur.rowcount}
