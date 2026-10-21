"""
Prévision PAR PRODUIT : lecture des résultats du pipeline forecasting/pipeline.py (dernier lancement).
Ne remplace rien : la prévision globale (prophet_forecasts) reste servie par db_forecast_engine.py.
"""
from datetime import timedelta
from db.db import sql_fetch_all, sql_fetch_one, sql_value
from config import RISQUE_SEUIL_ELEVE, RISQUE_SEUIL_VIGILANCE, RISQUE_SEUIL_FAIBLE

import json, os
# Seuils de fiabilité : lus dans forecasting/config.json (un seul endroit pour les régler)
try:
    _cfg = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "forecasting", "config.json"), encoding="utf-8"))
except Exception:
    _cfg = {}
FIAB_BONNE = float(_cfg.get("fiabilite_bonne_wape_max", 0.35))
FIAB_MOYENNE = float(_cfg.get("fiabilite_moyenne_wape_max", 0.6))
ECART_MIN_UNITES = 2   # en dessous de 2 articles d'écart, pas d'alerte (évite les fausses alertes sur les petits produits)

NOT_READY = {
    "available": False,
    "message": "La prévision par produit n'a pas encore été calculée. Lancer : python forecasting\\pipeline.py",
}


def _f(v):
    return float(v) if v is not None else None


def _latest_run():
    try:
        return sql_fetch_one("SELECT * FROM product_forecast_runs ORDER BY run_id DESC LIMIT 1")
    except Exception:
        return None


def fiabilite(wape):
    if wape is None:
        return "inconnue"
    return "bonne" if wape <= FIAB_BONNE else "moyenne" if wape <= FIAB_MOYENNE else "faible"


def get_product_forecast_list():
    run = _latest_run()
    if not run:
        return NOT_READY
    rid = run["run_id"]
    models = sql_fetch_all("""
        SELECT m.*, p.article_name, COALESCE(c.category_name, 'Autre') AS category
        FROM product_forecast_models m
        JOIN dim_products p ON p.product_id = m.product_id
        LEFT JOIN dim_categories c ON c.category_id = p.category_id
        WHERE m.run_id = %s
    """, (rid,))
    fc = sql_fetch_all("SELECT product_id, ds, yhat, is_ferme FROM product_forecasts WHERE run_id = %s ORDER BY ds", (rid,))
    spark = {}
    for r in fc:
        spark.setdefault(r["product_id"], []).append(_f(r["yhat"]))
    items, others = [], {"inactif": 0, "insuffisant": 0}
    for m in models:
        if m["status"] != "prevu":
            others[m["status"]] = others.get(m["status"], 0) + 1
            continue
        nxt, usual = _f(m["next7"]) or 0.0, _f(m["usual7"]) or 0.0
        chg = (nxt - usual) / usual * 100 if usual > 0 else None
        w = _f(m["wape"])
        items.append({
            "product_id": m["product_id"], "article": m["article_name"], "category": m["category"],
            "segment": m["segment"], "saisonnier": bool(m["saisonnier"]), "method": m["method"],
            "wape": w, "wape_baseline": _f(m["wape_baseline"]), "fiabilite": fiabilite(w),
            "next7": nxt, "usual7": usual, "change_pct": chg,
            "tendance": "hausse" if chg is not None and chg >= 15 else "baisse" if chg is not None and chg <= -15 else "normale",
            "spark": spark.get(m["product_id"], [])[:7], "saison": m.get("saison"),
        })
    items.sort(key=lambda x: -(x["next7"] or 0))
    checks = sql_fetch_all("SELECT check_type, severity, date_from, date_to, detail FROM forecast_data_checks WHERE run_id = %s", (rid,))
    return {
        "available": True,
        "run": {"run_id": rid, "run_at": str(run["run_at"])[:16], "data_start": str(run["data_start"]), "data_end": str(run["data_end"]),
                "horizon": run["horizon"], "n_products": run["n_products"], "n_forecast": run["n_forecast"], "notes": run["notes"]},
        "items": items,
        "non_prevus": others,
        "checks": [{**c, "date_from": str(c["date_from"]) if c["date_from"] else None, "date_to": str(c["date_to"]) if c["date_to"] else None} for c in checks],
        "seuils_fiabilite": {"bonne": FIAB_BONNE, "moyenne": FIAB_MOYENNE},
    }


def get_product_forecast_detail(product_id: int):
    run = _latest_run()
    if not run:
        return NOT_READY
    rid = run["run_id"]
    m = sql_fetch_one("""
        SELECT m.*, p.article_name, COALESCE(c.category_name, 'Autre') AS category
        FROM product_forecast_models m JOIN dim_products p ON p.product_id = m.product_id
        LEFT JOIN dim_categories c ON c.category_id = p.category_id
        WHERE m.run_id = %s AND m.product_id = %s
    """, (rid, product_id))
    if not m:
        return {"available": True, "found": False}
    fc = sql_fetch_all("""SELECT ds, yhat, yhat_lower, yhat_upper, is_ferme FROM product_forecasts
                          WHERE run_id = %s AND product_id = %s ORDER BY ds""", (rid, product_id))
    end = run["data_end"]
    hist = sql_fetch_all("""
        SELECT d.date_id, COALESCE(SUM(f.quantity), 0) AS qty, (COALESCE(a.nb_articles, 0) > 0) AS ouvert
        FROM dim_dates d
        LEFT JOIN fact_ticket_lines f ON f.date_id = d.date_id AND f.product_id = %s
        LEFT JOIN daily_aggregates a ON a.date_id = d.date_id
        WHERE d.date_id BETWEEN %s AND %s
        GROUP BY d.date_id, a.nb_articles ORDER BY d.date_id
    """, (product_id, end - timedelta(days=41), end))
    # Même jour de la semaine, un an plus tôt (364 jours) : repère « l'an dernier »
    ly = {}
    if fc:
        rows = sql_fetch_all("""SELECT date_id, SUM(quantity) AS qty FROM fact_ticket_lines
                                WHERE product_id = %s AND date_id BETWEEN %s AND %s GROUP BY date_id""",
                             (product_id, fc[0]["ds"] - timedelta(days=364), fc[-1]["ds"] - timedelta(days=364)))
        ly = {r["date_id"]: float(r["qty"]) for r in rows}
        # Jour ouvert l'an dernier sans vente du produit : 0 (et pas « inconnu »)
        opened = sql_fetch_all("""SELECT date_id FROM daily_aggregates WHERE nb_articles > 0 AND date_id BETWEEN %s AND %s""",
                               (fc[0]["ds"] - timedelta(days=364), fc[-1]["ds"] - timedelta(days=364)))
        for o in opened:
            ly.setdefault(o["date_id"], 0.0)
    w = _f(m["wape"])
    return {
        "available": True, "found": True,
        "product": {"product_id": product_id, "article": m["article_name"], "category": m["category"]},
        "model": {"segment": m["segment"], "saisonnier": bool(m["saisonnier"]), "status": m["status"], "method": m["method"],
                  "wape": w, "wape_baseline": _f(m["wape_baseline"]), "fiabilite": fiabilite(w),
                  "n_sale_days": m["n_sale_days"], "adi": _f(m["adi"]), "cv2": _f(m["cv2"]),
                  "next7": _f(m["next7"]), "usual7": _f(m["usual7"]), "saison": m.get("saison"),
                  "last_sale": str(m["last_sale"]) if m["last_sale"] else None},
        "forecast": [{"ds": str(r["ds"]), "yhat": _f(r["yhat"]), "yhat_lower": _f(r["yhat_lower"]), "yhat_upper": _f(r["yhat_upper"]),
                      "is_ferme": bool(r["is_ferme"]),
                      "last_year": ly.get(r["ds"] - timedelta(days=364))} for r in fc],
        "history": [{"ds": str(r["date_id"]), "qty": float(r["qty"]), "ouvert": bool(r["ouvert"])} for r in hist],
        "run": {"data_end": str(end), "run_at": str(run["run_at"])[:16]},
    }


# ── Jours fériés (même règle que forecasting/pipeline.py : réglages jours_feries_pays / jours_feries_dates) ──
def _easter(y):
    a, b, c = y % 19, y // 100, y % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l_ = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l_) // 451
    from datetime import date as _d
    return _d(y, (h + l_ - 7 * m + 114) // 31, ((h + l_ - 7 * m + 114) % 31) + 1)


def _holidays(years):
    from datetime import date as _d
    pays = str(_cfg.get("jours_feries_pays", "") or "").upper()
    out = {}
    for y in years:
        if pays == "FR":
            for md, n in {(1, 1): "Jour de l'An", (5, 1): "Fête du Travail", (5, 8): "Victoire 1945", (7, 14): "Fête nationale",
                          (8, 15): "Assomption", (11, 1): "Toussaint", (11, 11): "Armistice", (12, 25): "Noël"}.items():
                out[_d(y, *md)] = n
            e = _easter(y)
            for dd, n in ((1, "Lundi de Pâques"), (39, "Ascension"), (50, "Lundi de Pentecôte")):
                out[e + timedelta(days=dd)] = n
        for md in _cfg.get("jours_feries_dates", []) or []:
            try:
                m_, d_ = (int(x) for x in str(md).split("-"))
                out[_d(y, m_, d_)] = f"Jour particulier {d_:02d}/{m_:02d}"
            except Exception:
                pass
    return out


def _raison(st, y, u, ly, ferie, veille):
    """Pourquoi ce jour sort de l'habitude (code + valeurs ; le texte est écrit par la page, en français ou en anglais)."""
    if st in ("NORMAL", "FERMÉ"):
        return None
    if ferie:
        return {"code": "ferie", "nom": ferie}
    if veille:
        return {"code": "veille", "nom": veille}
    if st in ("RUPTURE", "VIGILANCE") and u < 3:
        return {"code": "saison"}
    if ly is not None and u > 0 and ((y > u and ly >= u * 1.3) or (y < u and ly <= u * 0.7)):
        return {"code": "an_dernier", "ly": round(ly)}
    return {"code": "tendance", "sens": "hausse" if y > u else "baisse"}


def get_product_alerts(days: int = 14):
    """Risque par produit et par jour : prévision comparée au jour habituel du produit
    (médiane des 8 derniers mêmes jours de la semaine ouverts, calculée par le pipeline), mêmes seuils que la page Alertes."""
    run = _latest_run()
    if not run:
        return NOT_READY
    rid, end = run["run_id"], run["data_end"]
    fc = sql_fetch_all("""
        SELECT f.product_id, f.ds, f.yhat, f.yhat_upper, f.is_ferme, f.usual, p.article_name,
               COALESCE(c.category_name, 'Autre') AS category, m.fiabilite_wape
        FROM product_forecasts f
        JOIN dim_products p ON p.product_id = f.product_id
        LEFT JOIN dim_categories c ON c.category_id = p.category_id
        JOIN (SELECT product_id, wape AS fiabilite_wape FROM product_forecast_models WHERE run_id = %s) m ON m.product_id = f.product_id
        WHERE f.run_id = %s ORDER BY f.ds
    """, (rid, rid))
    # « Habitude » = niveau calculé par le pipeline (médiane des 8 derniers mêmes jours de semaine ouverts) :
    # même définition que sur la page Prévisions.
    dates = sorted({r["ds"] for r in fc})[:days]
    # Prix moyen récent de chaque produit (90 derniers jours de ventes) : pour chiffrer les risques en euros
    prix = {}
    try:
        for r in sql_fetch_all("""SELECT product_id, SUM(total_revenue) / NULLIF(SUM(quantity), 0) AS prix FROM fact_ticket_lines
                                  WHERE date_id > %s AND date_id <= %s GROUP BY product_id""", (end - timedelta(days=90), end)):
            if r["prix"] is not None:
                prix[r["product_id"]] = float(r["prix"])
    except Exception:
        prix = {}
    # Ventes du même jour de la semaine 52 semaines plus tôt (pour expliquer les écarts)
    ly = {}
    if dates:
        try:
            for r in sql_fetch_all(f"""SELECT product_id, date_id, SUM(quantity) AS q FROM fact_ticket_lines
                                       WHERE date_id IN ({", ".join(["%s"] * len(dates))}) GROUP BY 1, 2""",
                                   tuple(d - timedelta(days=364) for d in dates)):
                ly[(r["product_id"], r["date_id"] + timedelta(days=364))] = float(r["q"] or 0)
        except Exception:
            ly = {}
    fer = _holidays({d.year for d in dates}) if dates else {}
    prods = {}
    for r in fc:
        if r["ds"] not in dates:
            continue
        pid = r["product_id"]
        p = prods.setdefault(pid, {"product_id": pid, "article": r["article_name"], "category": r["category"], "days": [],
                                   "fiabilite": fiabilite(_f(r["fiabilite_wape"]))})
        u = _f(r["usual"]) or 0.0
        y = _f(r["yhat"]) or 0.0
        if r["is_ferme"]:
            st = "FERMÉ"
        elif abs(y - u) < ECART_MIN_UNITES:
            st = "NORMAL"
        elif u <= 0:
            st = "RUPTURE"
        else:
            ratio = y / u
            st = ("RUPTURE" if ratio >= RISQUE_SEUIL_ELEVE else "VIGILANCE" if ratio >= RISQUE_SEUIL_VIGILANCE
                  else "SURSTOCK" if ratio < RISQUE_SEUIL_FAIBLE else "NORMAL")
        pr = prix.get(pid)
        euros = round(abs(y - u) * pr) if (pr and st in ("RUPTURE", "VIGILANCE", "SURSTOCK")) else 0
        p["prix"] = round(pr, 2) if pr else None
        p["days"].append({"ds": str(r["ds"]), "yhat": y, "usual": u, "conseille": _f(r["yhat_upper"]), "statut": st,
                          "euros": euros,
                          "raison": _raison(st, y, u, ly.get((pid, r["ds"])), fer.get(r["ds"]), fer.get(r["ds"] + timedelta(days=1)))})
    items = list(prods.values())
    for p in items:
        p["nb_risque"] = sum(1 for d in p["days"] if d["statut"] == "RUPTURE")
        p["nb_vigilance"] = sum(1 for d in p["days"] if d["statut"] == "VIGILANCE")
        p["volume"] = sum(d["yhat"] for d in p["days"])
        p["euros_manque"] = sum(d["euros"] for d in p["days"] if d["statut"] in ("RUPTURE", "VIGILANCE"))
        p["euros_invendus"] = sum(d["euros"] for d in p["days"] if d["statut"] == "SURSTOCK")
        p["excedent"] = round(sum(max(0.0, d["yhat"] - d["usual"]) for d in p["days"] if d["statut"] in ("RUPTURE", "VIGILANCE")), 1)
    items.sort(key=lambda p: (-p["excedent"], -p["nb_risque"], -p["volume"]))
    return {"available": True, "dates": [str(d) for d in dates], "items": items,
            "seuils": {"eleve": RISQUE_SEUIL_ELEVE, "vigilance": RISQUE_SEUIL_VIGILANCE, "faible": RISQUE_SEUIL_FAIBLE,
                       "ecart_min_unites": ECART_MIN_UNITES},
            "run": {"data_end": str(end), "run_at": str(run["run_at"])[:16]}}
