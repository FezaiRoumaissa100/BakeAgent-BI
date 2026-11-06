"""
BD/analytics.py
================
Recalcule, à partir des lignes de ticket déjà en base, deux tables que l'import pkl recevait toutes faites du notebook :

  * product_velocity_stats : vitesse de vente par produit (globale, saison touristique, jours d'événement),
                             stock de sécurité, ratios
  * association_rules      : règles d'association Apriori (« achetés ensemble »)

Les formules sont celles du notebook d'origine (existing_bi/.../Retail_Final_Mariem_Dridi*.ipynb, sections 2.2 et 2.5) et
ont été vérifiées contre les valeurs déjà présentes en base (voir BD/README.md).

Non recalculée : product_penetration. Aucune page du tableau de bord ne la lit (elle n'est utilisée que par l'import pkl).

Appelé par BD/002_import_from_api.py dans la même transaction que l'import : tout est annulé en cas d'erreur.
"""

import itertools
from collections import Counter

import numpy as np
import pandas as pd
from sqlalchemy import text

import client_settings

MAX_LEN = 3             # paires et triplets
# Seuils et articles exclus des paniers : client_settings.json (basket_min_support = présent dans au moins 1 % des tickets de plus
# d'un article, basket_min_lift = association au moins 20 % plus fréquente que le hasard, basket_excluded_articles = services ou
# sacs qui ne disent rien sur les produits, par ex. un service de découpe du pain vendu à côté de presque chaque pain).


def load_lines(conn) -> pd.DataFrame:
    return pd.read_sql(text("""
        SELECT f.date_id, f.ticket_number, f.product_id, p.article_name AS article, f.quantity,
               d.is_touristic, COALESCE(e.is_event, FALSE) AS is_event
        FROM fact_ticket_lines f
        JOIN dim_products p ON p.product_id = f.product_id
        JOIN dim_dates d ON d.date_id = f.date_id
        LEFT JOIN dim_events e ON e.event_id = f.event_id"""), conn)


# ───────────────────────── Vitesse de vente (notebook, section 2.2) ─────────────────────────

def compute_velocity(df: pd.DataFrame) -> pd.DataFrame:
    jours = df["date_id"].nunique()
    g = df.groupby("product_id").agg(qte=("quantity", "sum"), std=("quantity", "std")).reset_index()
    g["daily_velocity"] = (g["qte"] / jours).round(2)
    g["stock_securite"] = (g["daily_velocity"] + g["std"]).round(0)      # moyenne + 1 écart-type ; NaN si une seule ligne

    def per_day(mask, name):
        sub = df[mask]
        n = sub["date_id"].nunique()
        if not n:
            return pd.DataFrame({"product_id": pd.Series(dtype="int64"), name: pd.Series(dtype=float)})
        s = sub.groupby("product_id")["quantity"].sum()
        return (s / n).round(2).rename(name).reset_index()

    g = g.merge(per_day(df["is_touristic"].astype(bool), "velocity_touristic"), on="product_id", how="left")
    g = g.merge(per_day(df["is_event"].astype(bool), "velocity_event"), on="product_id", how="left")
    cols = ["stock_securite", "velocity_touristic", "velocity_event"]
    g[cols] = g[cols].fillna(0)                                            # comme le notebook : absent = 0
    g["ratio_touristic"] = (g["velocity_touristic"] / g["daily_velocity"]).replace([np.inf, -np.inf], 0).round(2)
    g["ratio_event"] = (g["velocity_event"] / g["daily_velocity"]).replace([np.inf, -np.inf], 0).round(2)
    return g[["product_id", "daily_velocity", "velocity_touristic", "velocity_event",
              "stock_securite", "ratio_touristic", "ratio_event"]]


# ───────────────────────── Règles d'association (notebook, section 2.5) ─────────────────────────

def _finite(x):
    x = float(x)
    return x if np.isfinite(x) else None


def compute_rules(df: pd.DataFrame, min_support=None, min_lift=None, excluded_articles=None) -> list:
    """Règles Apriori sur les tickets de plus d'un article. Renvoie une ligne par (règle, produit conséquent), comme l'import pkl.

    Un ticket = la paire (jour, numéro de ticket), comme partout ailleurs dans le tableau de bord. Le notebook d'origine
    identifiait un ticket par son numéro seul : or les numéros se réutilisent d'un jour à l'autre (131 315 numéros distincts
    pour 131 853 vrais tickets), ce qui mélangeait des paniers de jours différents. Corrigé ici ; l'écart avec les règles
    d'origine reste faible (lift : 0,02 au plus sur les règles actuelles, mêmes 50 règles).
    """
    cfg = client_settings.load()
    min_support = cfg["basket_min_support"] if min_support is None else min_support
    min_lift = cfg["basket_min_lift"] if min_lift is None else min_lift
    if excluded_articles is None:          # articles qui ne sont pas des produits + exclusions propres aux paniers
        excluded_articles = list(cfg["non_product_articles"]) + list(cfg["basket_excluded_articles"])
    excl = {client_settings.norm(a) for a in excluded_articles}
    if excl:
        df = df[~df["article"].map(client_settings.norm).isin(excl)]
    ids = df.drop_duplicates("product_id").set_index("article")["product_id"].to_dict()
    baskets = df.groupby(["date_id", "ticket_number"])["article"].apply(frozenset)
    baskets = [sorted(b) for b in baskets if len(b) >= 2]
    n = len(baskets)
    if n == 0:
        return []

    c1, c2, c3 = Counter(), Counter(), Counter()
    for b in baskets:
        c1.update(b)
    f1 = {a for a, c in c1.items() if c / n >= min_support}
    kept = [[a for a in b if a in f1] for b in baskets]
    for b in kept:
        c2.update(itertools.combinations(b, 2))
    f2 = {p for p, c in c2.items() if c / n >= min_support}
    for b in kept:
        for t in itertools.combinations(b, 3):
            if all(p in f2 for p in itertools.combinations(t, 2)):
                c3[t] += 1
    f3 = {t for t, c in c3.items() if c / n >= min_support}

    sup = {frozenset([a]): c1[a] / n for a in f1}
    sup.update({frozenset(p): c2[p] / n for p in f2})
    if MAX_LEN >= 3:
        sup.update({frozenset(t): c3[t] / n for t in f3})

    rules = []
    for items in (k for k in sup if len(k) >= 2):
        for r in range(1, len(items)):
            for ante in itertools.combinations(sorted(items), r):
                ante = frozenset(ante)
                cons = items - ante
                s, a, c = sup[items], sup[ante], sup[cons]
                conf = s / a
                lift = conf / c
                if lift < min_lift:
                    continue
                lev = s - a * c
                zden = max(s * (1 - a), a * (c - s))
                rules.append({
                    "ante": sorted(ante), "cons": sorted(cons),
                    "antecedent_support": a, "consequent_support": c, "support": s, "confidence": conf, "lift": lift,
                    "leverage": lev,
                    "conviction": (1 - c) / (1 - conf) if conf < 1 else None,
                    "zhangs_metric": lev / zden if zden else None,
                    "representativity": 1.0,
                    "jaccard": s / (a + c - s),
                    "certainty": (conf - c) / (1 - c) if c < 1 else None,
                    "kulczynski": (conf + s / c) / 2,
                })
    rules.sort(key=lambda r: (-r["lift"], ", ".join(r["ante"]), ", ".join(r["cons"])))

    rows = []
    for r in rules:
        for cons_item in r["cons"]:
            rows.append({
                "ante_ids": [int(ids[x]) for x in r["ante"]], "cons_id": int(ids[cons_item]),
                "a_sup": r["antecedent_support"], "c_sup": r["consequent_support"], "sup": r["support"],
                "conf": r["confidence"], "lift": r["lift"], "lev": _finite(r["leverage"]),
                "conv": _finite(r["conviction"]) if r["conviction"] is not None else None,
                "zh": _finite(r["zhangs_metric"]) if r["zhangs_metric"] is not None else None,
                "rep": r["representativity"], "jac": _finite(r["jaccard"]),
                "cert": _finite(r["certainty"]) if r["certainty"] is not None else None,
                "kulc": _finite(r["kulczynski"]),
                "ante_str": ", ".join(r["ante"])[:500], "cons_str": ", ".join(r["cons"])[:500],
            })
    return rows


# ───────────────────────── Articles du jour ─────────────────────────

def recount_daily_articles(conn, since=None) -> int:
    """Recompte daily_aggregates.nb_articles (et ref_actives) à partir des lignes de ticket, SANS les articles qui ne sont
    pas des produits (client_settings.json > non_product_articles). Le chiffre d'affaires et le nombre de tickets restent
    complets (un sac ou une découpe est une vente). Utilisé par les deux imports ; renvoie le nombre de jours modifiés."""
    names = {client_settings.norm(a) for a in client_settings.load()["non_product_articles"]}
    np_ids = [int(r[0]) for r in conn.execute(text("SELECT product_id, article_name FROM dim_products"))
              if client_settings.norm(r[1]) in names]
    return conn.execute(text("""
        UPDATE daily_aggregates a SET nb_articles = s.q, ref_actives = s.n
        FROM (SELECT date_id,
                     COALESCE(SUM(quantity) FILTER (WHERE product_id <> ALL(CAST(:np AS INTEGER[]))), 0) AS q,
                     COUNT(DISTINCT product_id) FILTER (WHERE product_id <> ALL(CAST(:np AS INTEGER[]))) AS n
              FROM fact_ticket_lines
              WHERE CAST(:s AS date) IS NULL OR date_id >= CAST(:s AS date)
              GROUP BY date_id) s
        WHERE s.date_id = a.date_id AND (a.nb_articles <> s.q OR a.ref_actives <> s.n)"""),
        {"np": np_ids, "s": since}).rowcount


# ───────────────────────── Écriture ─────────────────────────

def refresh_analytics(conn) -> dict:
    """Remplace le contenu des deux tables dans la transaction ouverte. Ne fait rien s'il n'y a aucune ligne de ticket."""
    df = load_lines(conn)
    if df.empty:
        return {"velocity_rows": 0, "rule_rows": 0, "skipped": True}

    vel = compute_velocity(df)
    conn.execute(text("DELETE FROM product_velocity_stats"))
    vrows = [{
        "p": int(r.product_id), "dv": float(r.daily_velocity), "vt": _finite(r.velocity_touristic),
        "ve": _finite(r.velocity_event), "ss": float(r.stock_securite) if np.isfinite(r.stock_securite) else 0.0,
        "rt": _finite(r.ratio_touristic), "re": _finite(r.ratio_event),
    } for r in vel.itertuples(index=False)]
    conn.execute(text("""INSERT INTO product_velocity_stats
                         (product_id, daily_velocity, velocity_touristic, velocity_event, stock_securite,
                          ratio_touristic, ratio_event)
                         VALUES (:p, :dv, :vt, :ve, :ss, :rt, :re)"""), vrows)

    rules = compute_rules(df)
    conn.execute(text("DELETE FROM association_rules"))
    if rules:
        conn.execute(text("""INSERT INTO association_rules
                             (antecedent_ids, consequent_id, antecedent_support, consequent_support, support, confidence,
                              lift, leverage, conviction, zhangs_metric, representativity, jaccard, certainty, kulczynski,
                              antecedents_str, consequents_str)
                             VALUES (CAST(:ante_ids AS INTEGER[]), :cons_id, :a_sup, :c_sup, :sup, :conf, :lift, :lev,
                                     :conv, :zh, :rep, :jac, :cert, :kulc, :ante_str, :cons_str)"""), rules)
    return {"velocity_rows": len(vrows), "rule_rows": len(rules), "skipped": False}
