"""
Quantité conseillée à préparer, produit par produit : le compromis entre invendus et ventes manquées.

Avant, toutes les pages conseillaient la borne haute de la prévision (quantile 90 %) : la boutique couvrait
la demande 9 jours sur 10, donc jetait presque tous les soirs. Pour un produit frais, un invendu coûte son coût
de revient, une vente manquée coûte sa marge. La quantité qui minimise la perte totale est le quantile
« 1 − coût / prix » de la demande (méthode du « vendeur de journaux », standard pour les produits périssables).

Réglages : backend/config.py (section « Quantité conseillée »). Aucun réglage n'est propre à une boulangerie :
par défaut tous les produits ont la même part de coût, chaque boutique peut préciser ses familles.

Apprentissage : si la boulangerie saisit « préparé / restant » (page Saisie du stock), un produit souvent épuisé
voit son niveau monter, un produit qui reste souvent voit son niveau baisser.
"""
import json
import os
from datetime import timedelta

from config import (PART_COUT_DEFAUT, PART_COUT_PAR_CATEGORIE, CATEGORIES_LONGUE_CONSERVATION,
                    PRODUITS_A_NE_PAS_MANQUER, NIVEAU_MIN, NIVEAU_MAX, APPRENTISSAGE_JOURS,
                    APPRENTISSAGE_MIN_JOURS, APPRENTISSAGE_PAS, APPRENTISSAGE_TOLERANCE, APPRENTISSAGE_RESTES_MIN)

# Quantiles de la fourchette produite par forecasting/pipeline.py (forecasting/config.json, « quantiles »)
try:
    _q = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "forecasting", "config.json"),
                        encoding="utf-8")).get("quantiles", [0.1, 0.9])
    Q_BAS, Q_HAUT = float(_q[0]), float(_q[1])
except Exception:
    Q_BAS, Q_HAUT = 0.1, 0.9


def _borne(x, lo=NIVEAU_MIN, hi=NIVEAU_MAX):
    return max(lo, min(hi, x))


def niveau_base(category=None, article=None):
    """Part des jours où la quantité préparée doit couvrir la demande, avant apprentissage."""
    if article and article in PRODUITS_A_NE_PAS_MANQUER:
        return NIVEAU_MAX
    if category and category in CATEGORIES_LONGUE_CONSERVATION:
        return NIVEAU_MAX
    cout = PART_COUT_PAR_CATEGORIE.get(category, PART_COUT_DEFAUT) if category else PART_COUT_DEFAUT
    return _borne(1.0 - float(cout))


def quantite(yhat, yhat_upper, niveau, yhat_lower=None, q_haut=None, q_bas=None):
    """Quantité au niveau de couverture demandé, lue sur la fourchette de la prévision
    (prévision centrale = 50 %, borne haute = Q_HAUT, borne basse = Q_BAS ; interpolation linéaire entre les deux)."""
    if yhat is None:
        return None
    y = float(yhat)
    qh, qb = (q_haut or Q_HAUT), (q_bas or Q_BAS)
    if niveau >= 0.5:
        if yhat_upper is None or float(yhat_upper) <= y or qh <= 0.5:
            return max(0.0, y)
        return max(0.0, y + (niveau - 0.5) / (qh - 0.5) * (float(yhat_upper) - y))
    if yhat_lower is None or float(yhat_lower) >= y or qb >= 0.5:
        return max(0.0, y)
    return max(0.0, y - (0.5 - niveau) / (0.5 - qb) * (y - float(yhat_lower)))


def apprentissage(products):
    """products : {product_id: (category, article)}.
    Renvoie {product_id: {"niveau", "base", "code", "jours", "epuises", "part_restes"}} pour tous les produits.
    code : None (pas de correction), "souvent_epuise" (niveau monté), "souvent_restes" (niveau baissé)."""
    out = {pid: {"niveau": niveau_base(c, a), "base": niveau_base(c, a), "code": None, "jours": 0, "epuises": 0,
                 "part_restes": None} for pid, (c, a) in products.items()}
    if not products:
        return out
    try:
        from db.db import sql_fetch_all, sql_fetch_one
        last = (sql_fetch_one("SELECT MAX(date_id) AS d FROM daily_production") or {}).get("d")
        if not last:
            return out
        rows = sql_fetch_all("""
            SELECT product_id, COUNT(*) AS n, SUM(CASE WHEN leftover <= 0 THEN 1 ELSE 0 END) AS ep,
                   SUM(produced) AS prod, SUM(leftover) AS rest
            FROM daily_production
            WHERE date_id > %s AND date_id <= %s AND produced > 0 AND leftover IS NOT NULL
            GROUP BY product_id
        """, (last - timedelta(days=APPRENTISSAGE_JOURS), last))
    except Exception:
        return out          # table absente ou base indisponible : pas de correction
    for r in rows:
        o = out.get(r["product_id"])
        if not o:
            continue
        n, ep = int(r["n"] or 0), int(r["ep"] or 0)
        prod, rest = float(r["prod"] or 0), float(r["rest"] or 0)
        o["jours"], o["epuises"] = n, ep
        o["part_restes"] = round(rest / prod, 3) if prod > 0 else None
        if n < APPRENTISSAGE_MIN_JOURS:
            continue
        taux = ep / n
        attendu = 1.0 - o["base"]          # part de jours épuisés attendue à ce niveau de couverture
        if taux >= attendu + APPRENTISSAGE_TOLERANCE:
            o["niveau"], o["code"] = _borne(o["base"] + APPRENTISSAGE_PAS), "souvent_epuise"
        elif taux <= attendu - APPRENTISSAGE_TOLERANCE and (o["part_restes"] or 0) >= APPRENTISSAGE_RESTES_MIN:
            o["niveau"], o["code"] = _borne(o["base"] - APPRENTISSAGE_PAS), "souvent_restes"
        if o["niveau"] == o["base"]:
            o["code"] = None               # déjà en butée : rien n'a changé
    return out


def resume(a):
    """Ce que la page affiche pour expliquer le niveau d'un produit."""
    return {"niveau": round(a["niveau"], 2), "niveau_base": round(a["base"], 2), "ajustement": a["code"],
            "jours_saisis": a["jours"], "jours_epuises": a["epuises"], "part_restes": a["part_restes"]}
