"""
Production du jour : ce que la boulangerie a PRÉPARÉ et ce qui RESTE le soir, produit par produit.
Saisi par le boulanger sur la page « Production du jour » (frontend/src/app/production/page.tsx).

Table : daily_production (créée automatiquement au premier appel, rien à lancer à la main).
Avec les ventes de la caisse, elle donne les vrais invendus (en articles et en euros), la part de la production
vendue, et les produits épuisés (restant = 0 : la demande était peut-être plus forte que les ventes).
"""
from datetime import date, datetime, timedelta
from statistics import median
from db.db import sql_fetch_all, sql_fetch_one, get_connection
from config import CRENEAUX_HORAIRES, CRENEAUX_JOURS_OUVERTS, CRENEAUX_POIDS_BOUTIQUE, is_produced
from engines.tray_engine import tray_map
from engines.quantity_engine import apprentissage, quantite

_ready = False



def _sans_jours_particuliers(ds, days):
    """Retire de « l'habitude » les jours fériés et événements courts (Réveillon, Noël…), sauf si le jour
    affiché en est un lui-même. S'il ne reste presque rien, on garde la liste d'origine."""
    try:
        from engines.calendar_engine import special_days
        if special_days([ds]):
            return list(days)
        sp = special_days(list(days))
        kept = [d for d in days if d not in sp]
        return kept if len(kept) >= 3 else list(days)
    except Exception:
        return list(days)

def ensure_table():
    global _ready
    if _ready:
        return
    cur = get_connection().cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS daily_production (
            date_id    DATE     NOT NULL,
            product_id INTEGER  NOT NULL,
            produced   NUMERIC(10,1),
            leftover   NUMERIC(10,1),
            updated_at TIMESTAMP NOT NULL DEFAULT now(),
            PRIMARY KEY (date_id, product_id)
        )""")
    _ready = True


def _f(v):
    return float(v) if v is not None else None


def last_sales_day():
    r = sql_fetch_one("SELECT MAX(date_id) AS d FROM fact_ticket_lines") or {}
    return r.get("d")


def _prices(end):
    """Prix moyen de chaque produit sur les 90 jours de ventes avant « end »."""
    rows = sql_fetch_all("""SELECT product_id, SUM(total_revenue) / NULLIF(SUM(quantity), 0) AS prix FROM fact_ticket_lines
                            WHERE date_id > %s AND date_id <= %s GROUP BY product_id""", (end - timedelta(days=90), end))
    return {r["product_id"]: float(r["prix"]) for r in rows if r["prix"] is not None}


def get_production_day(ds: date):
    """Liste à remplir pour un jour : produits vendus ces 4 dernières semaines, avec ventes de la caisse ce jour-là,
    quantité habituelle (médiane des 8 derniers mêmes jours de semaine), quantité conseillée (prévision au niveau anti-gaspillage, voir quantity_engine.py)
    et ce qui a déjà été saisi."""
    ensure_table()
    prods = sql_fetch_all("""
        SELECT f.product_id, p.article_name, COALESCE(c.category_name, 'Autre') AS category, SUM(f.quantity) AS q28
        FROM fact_ticket_lines f
        JOIN dim_products p ON p.product_id = f.product_id
        LEFT JOIN dim_categories c ON c.category_id = p.category_id
        WHERE f.date_id > %s AND f.date_id <= %s
        GROUP BY 1, 2, 3 HAVING SUM(f.quantity) > 0
    """, (ds - timedelta(days=28), ds))
    prods = [p for p in prods if is_produced(p["article_name"], p["category"])]     # ni boissons, ni confiserie, ni découpe
    sold = {r["product_id"]: float(r["q"] or 0) for r in sql_fetch_all(
        "SELECT product_id, SUM(quantity) AS q FROM fact_ticket_lines WHERE date_id = %s GROUP BY 1", (ds,))}
    # Habitude : les 8 derniers mêmes jours de la semaine OÙ LA BOUTIQUE ÉTAIT OUVERTE (cherchés sur 26 semaines)
    cand = [ds - timedelta(days=7 * k) for k in range(1, 27)]
    open_days = sorted({r["date_id"] for r in sql_fetch_all(
        f"SELECT DISTINCT date_id FROM fact_ticket_lines WHERE date_id IN ({', '.join(['%s'] * len(cand))})", tuple(cand))},
        reverse=True)
    open_days = _sans_jours_particuliers(ds, open_days)[:8]
    hist = {}
    if open_days:
        for r in sql_fetch_all(f"""SELECT product_id, date_id, SUM(quantity) AS q FROM fact_ticket_lines
                                   WHERE date_id IN ({", ".join(["%s"] * len(open_days))}) GROUP BY 1, 2""", tuple(open_days)):
            hist.setdefault(r["product_id"], []).append(float(r["q"] or 0))
    sugg = {}
    try:
        # Calcul « normal » (moins de 30 jours) : le calcul à 30 jours ne sert qu'à prolonger la vue longue
        run = sql_fetch_one("SELECT run_id FROM product_forecast_runs WHERE horizon < 30 ORDER BY run_id DESC LIMIT 1") \
            or sql_fetch_one("SELECT run_id FROM product_forecast_runs ORDER BY run_id DESC LIMIT 1")
        if run:
            fc = sql_fetch_all("""SELECT product_id, yhat, yhat_lower, yhat_upper, is_ferme FROM product_forecasts
                                   WHERE run_id = %s AND ds = %s""", (run["run_id"], ds))
            ap = apprentissage({p["product_id"]: (p["category"], p["article_name"]) for p in prods})
            for r in fc:
                if r["product_id"] in ap and not r["is_ferme"]:
                    sugg[r["product_id"]] = quantite(_f(r["yhat"]), _f(r["yhat_upper"]), ap[r["product_id"]]["niveau"],
                                                     _f(r["yhat_lower"]))
    except Exception:
        sugg = {}
    entered = {r["product_id"]: r for r in sql_fetch_all(
        "SELECT product_id, produced, leftover, updated_at FROM daily_production WHERE date_id = %s", (ds,))}
    prix = _prices(ds)
    trays = tray_map()

    items = []
    for p in prods:
        pid = p["product_id"]
        h = hist.get(pid, [])
        h += [0.0] * max(0, len(open_days) - len(h))       # jours ouverts sans vente = 0
        usual = median(h) if h else None
        e = entered.get(pid)
        items.append({
            "product_id": pid, "article": p["article_name"], "category": p["category"],
            "sold": sold.get(pid, 0.0), "usual": usual, "suggested": sugg.get(pid),
            "prix": round(prix[pid], 2) if pid in prix else None,
            "produced": _f(e["produced"]) if e else None, "leftover": _f(e["leftover"]) if e else None,
            "q28": float(p["q28"] or 0),
            "tray": trays.get(pid),      # {pieces, rounding, estimate} ou None : saisie possible en plaques
        })
    # Familles les plus vendues d'abord (pains, viennoiseries… avant les boissons), puis produits par volume
    cat_tot = {}
    for i in items:
        cat_tot[i["category"]] = cat_tot.get(i["category"], 0) + i["q28"]
    items.sort(key=lambda i: (-cat_tot[i["category"]], i["category"], -i["q28"]))
    last = max((e["updated_at"] for e in entered.values()), default=None)
    return {"date": ds.isoformat(), "items": items, "nb_saisis": len(entered),
            "last_sales_day": (last_sales_day() or ds).isoformat(),
            "updated_at": last.strftime("%Y-%m-%d %H:%M") if last else None}


def get_slot_plan(ds: date):
    """Plan par tranche horaire : pour chaque produit, la part de ses ventes faite habituellement à chaque tranche
    (mêmes jours de la semaine que « ds », les derniers jours où la boutique était ouverte). Le tableau de bord applique
    ces parts à la quantité à préparer, ce qui donne une quantité par fournée. Un produit peu vendu emprunte en partie
    le profil de toute la boutique (poids CRENEAUX_POIDS_BOUTIQUE) ; un produit sans vente n'a pas de profil propre."""
    edges = list(CRENEAUX_HORAIRES)
    n_slots = len(edges) + 1

    def slot(h):
        return sum(1 for e in edges if h >= e)

    cand = [ds - timedelta(days=7 * k) for k in range(1, 27)]
    days = sorted({r["date_id"] for r in sql_fetch_all(
        f"SELECT DISTINCT date_id FROM fact_ticket_lines WHERE date_id IN ({', '.join(['%s'] * len(cand))})", tuple(cand))},
        reverse=True)
    days = _sans_jours_particuliers(ds, days)[:CRENEAUX_JOURS_OUVERTS]
    if not days:
        return {"available": False, "date": ds.isoformat(), "edges": edges}
    rows = sql_fetch_all(f"""SELECT product_id, hour, SUM(quantity) AS q FROM fact_ticket_lines
                             WHERE hour IS NOT NULL AND date_id IN ({', '.join(['%s'] * len(days))}) GROUP BY 1, 2""", tuple(days))
    per, shop = {}, [0.0] * n_slots
    for r in rows:
        k, q = slot(int(r["hour"])), float(r["q"] or 0)
        per.setdefault(r["product_id"], [0.0] * n_slots)[k] += q
        shop[k] += q
    tot = sum(shop)
    if tot <= 0:
        return {"available": False, "date": ds.isoformat(), "edges": edges}
    shop_share = [s / tot for s in shop]
    items = []
    for pid, c in per.items():
        n = sum(c)
        if n <= 0:
            continue
        sh = [(c[k] + CRENEAUX_POIDS_BOUTIQUE * shop_share[k]) / (n + CRENEAUX_POIDS_BOUTIQUE) for k in range(n_slots)]
        items.append({"product_id": pid, "shares": [round(x, 4) for x in sh], "n": n})
    return {"available": True, "date": ds.isoformat(), "edges": edges, "shop_shares": [round(x, 4) for x in shop_share],
            "history_days": [d.isoformat() for d in sorted(days)], "items": items}


def save_production_day(ds: date, rows: list):
    """Enregistre la saisie d'un jour. Une ligne sans « préparé » ni « restant » est effacée."""
    ensure_table()
    if ds > date.today() + timedelta(days=1):
        return {"ok": False, "message": "Impossible d'enregistrer une production dans le futur."}
    errors, clean = [], []
    for r in rows or []:
        try:
            pid = int(r.get("product_id"))
        except (TypeError, ValueError):
            continue
        prod, left = r.get("produced"), r.get("leftover")
        prod = None if prod in (None, "") else float(prod)
        left = None if left in (None, "") else float(left)
        if (prod is not None and prod < 0) or (left is not None and left < 0):
            errors.append({"product_id": pid, "message": "Les quantités ne peuvent pas être négatives."})
            continue
        if prod is not None and left is not None and left > prod:
            errors.append({"product_id": pid, "message": "Il reste plus que ce qui a été préparé."})
            continue
        clean.append((pid, prod, left))
    if errors:
        return {"ok": False, "errors": errors, "message": "Certaines lignes sont à corriger."}
    cur = get_connection().cursor()
    saved = 0
    for pid, prod, left in clean:
        if prod is None and left is None:
            cur.execute("DELETE FROM daily_production WHERE date_id = %s AND product_id = %s", (ds, pid))
        else:
            cur.execute("""INSERT INTO daily_production (date_id, product_id, produced, leftover, updated_at)
                           VALUES (%s, %s, %s, %s, now())
                           ON CONFLICT (date_id, product_id) DO UPDATE
                           SET produced = EXCLUDED.produced, leftover = EXCLUDED.leftover, updated_at = now()""",
                        (ds, pid, prod, left))
            saved += 1
    return {"ok": True, "saved": saved, "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M")}


def get_production_summary(days: int = 14):
    """Bilan des derniers jours saisis : préparé, restant, part vendue, invendus en euros, produits épuisés.
    Indique aussi si le dernier jour de ventes n'a pas encore été saisi (rappel dans la cloche)."""
    ensure_table()
    end = last_sales_day()
    if not end:
        return {"available": False}
    # Les « days » derniers jours qui ont été saisis
    rows = sql_fetch_all("""
        SELECT d.date_id, d.product_id, d.produced, d.leftover, p.article_name
        FROM daily_production d JOIN dim_products p ON p.product_id = d.product_id
        WHERE d.date_id IN (SELECT DISTINCT date_id FROM daily_production ORDER BY date_id DESC LIMIT %s)
        ORDER BY d.date_id
    """, (max(int(days), 1),))
    prix = _prices(end)
    by_day = {}
    for r in rows:
        d = by_day.setdefault(r["date_id"], {"date": r["date_id"].isoformat(), "produced": 0.0, "leftover": 0.0,
                                             "euros_invendus": 0.0, "epuises": [], "nb_produits": 0})
        prod, left = _f(r["produced"]), _f(r["leftover"])
        d["nb_produits"] += 1
        if prod is not None:
            d["produced"] += prod
        if left is not None:
            d["leftover"] += left
            d["euros_invendus"] += left * prix.get(r["product_id"], 0.0)
            if left == 0 and (prod or 0) > 0:
                d["epuises"].append(r["article_name"])
    out = sorted(by_day.values(), key=lambda d: d["date"])[-days:]
    for d in out:
        d["part_vendue"] = round(1 - d["leftover"] / d["produced"], 3) if d["produced"] > 0 else None
        d["euros_invendus"] = round(d["euros_invendus"])
    return {"available": True, "days": out, "last_sales_day": end.isoformat(),
            "last_sales_day_saisi": end in by_day}
