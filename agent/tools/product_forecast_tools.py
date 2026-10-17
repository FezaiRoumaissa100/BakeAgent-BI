"""
Agent Tools - Per-product forecast module
ADK agent tools - per-product demand forecast and per-product shortage risk
(results of forecasting/pipeline.py, the same data as the Prévisions and Alertes pages).
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from engines.product_forecast_engine import (
    get_product_forecast_list,
    get_product_forecast_detail,
    get_product_alerts,
)


def _find(items: list, product: str):
    q = (product or "").strip().lower()
    if not q:
        return None
    exact = [i for i in items if i["article"].lower() == q]
    if exact:
        return exact[0]
    part = [i for i in items if q in i["article"].lower()]
    return part[0] if part else None


def get_product_forecast(product: str = "", horizon: int = 7) -> dict:
    """
    Retrieves the per-product demand forecast (units per day), as shown on the Prévisions page.

    Use this tool for any question about the forecast of ONE product (e.g. "MERINGUE",
    "TRADITIONAL BAGUETTE") or about which products will sell more or less than usual
    in the coming days. Quantities are units sold per day (not euros).

    Args:
        product (str): Product name (exact or partial, case-insensitive). Empty = overview of all products.
        horizon (int): Number of forecast days to return for one product: 7 or 14. Default: 7.

    Returns:
        dict: If a product is given and found:
            - product (dict): article, category
            - model (dict): fiabilite (bonne/moyenne/faible), wape (average error, 0.25 = ±25 %),
              next7 (forecast units over the next 7 days), usual7 (usual units over 7 days), saisonnier
            - forecast (list): per day: ds (date), yhat (forecast units), yhat_lower / yhat_upper (usual range),
              is_ferme (shop closed), last_year (units sold on the SAME WEEKDAY 52 weeks earlier, i.e. date ds - 364 days — NOT the same calendar date: for 2026-01-01 it is 2025-01-02; never call it "le 1er janvier de l'an dernier")
            - history (list): last 6 weeks: ds, qty (units sold), ouvert (shop open)
            - data_end (str): last day of sales data used
        If no product is given:
            - top_hausse / top_baisse (list): products forecast clearly above / below usual over 7 days
            - nb_produits (int), data_end (str)
        If the forecast has not been computed: available = False.
    """
    lst = get_product_forecast_list()
    if not lst.get("available"):
        return {"available": False, "message": "La prévision par produit n'a pas encore été calculée (python forecasting/pipeline.py)."}
    items = lst.get("items", [])
    data_end = lst.get("run", {}).get("data_end")
    if not (product or "").strip():
        keep = lambda i: {k: i[k] for k in ("article", "category", "next7", "usual7", "change_pct", "fiabilite")}
        moving = [i for i in items if i.get("change_pct") is not None and (i.get("usual7") or 0) >= 5]
        up = sorted([i for i in moving if i["change_pct"] >= 15], key=lambda i: -(i["next7"] - i["usual7"]))[:10]
        down = sorted([i for i in moving if i["change_pct"] <= -15], key=lambda i: (i["next7"] - i["usual7"]))[:10]
        return {"available": True, "nb_produits": len(items), "data_end": data_end,
                "top_hausse": [keep(i) for i in up], "top_baisse": [keep(i) for i in down]}
    it = _find(items, product)
    if not it:
        return {"available": True, "found": False,
                "message": f"Aucune prévision pour « {product} ». Produits proches : " +
                           ", ".join(i["article"] for i in items if product.strip().lower()[:4] in i["article"].lower())[:400]}
    d = get_product_forecast_detail(it["product_id"])
    if not d.get("found"):
        return {"available": True, "found": False, "message": f"Détail indisponible pour {it['article']}."}
    h = 14 if int(horizon or 7) > 7 else 7
    return {
        "available": True, "found": True,
        "product": d["product"],
        "model": {k: d["model"].get(k) for k in ("fiabilite", "wape", "next7", "usual7", "saisonnier", "segment")},
        "forecast": d["forecast"][:h],
        "history": d["history"],
        "data_end": d.get("run", {}).get("data_end"),
    }


def get_product_risk(days: int = 14, product: str = "") -> dict:
    """
    Retrieves the per-product shortage / unsold risk by day, as shown on the Alertes & Stock page
    ("Quels produits risquent de manquer, et quel jour ?").

    Each day compares the product's forecast with what it usually sells that weekday.
    statut: RUPTURE (shortage risk), VIGILANCE (watch), NORMAL, SURSTOCK (unsold risk), FERMÉ (closed).

    Args:
        days (int): Number of days: 7 or 14. Default: 14.
        product (str): Optional product name to return only that product. Empty = products at risk.

    Returns:
        dict:
            - dates (list): the days covered
            - items (list): per product: article, category, nb_risque, nb_vigilance,
              days (list of ds, yhat = forecast units, usual = usual units, conseille = suggested quantity, statut)
            - seuils (dict): thresholds used
    """
    r = get_product_alerts(14 if int(days or 14) > 7 else 7)
    if not r.get("available"):
        return {"available": False, "message": "La prévision par produit n'a pas encore été calculée."}
    items = r.get("items", [])
    if (product or "").strip():
        it = _find(items, product)
        items = [it] if it else []
    else:
        items = [i for i in items if (i.get("nb_risque", 0) + i.get("nb_vigilance", 0)) > 0][:15]
    return {"available": True, "dates": r.get("dates"), "items": items, "seuils": r.get("seuils"),
            "data_end": r.get("run", {}).get("data_end")}
