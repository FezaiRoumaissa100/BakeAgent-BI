import pandas as pd
import numpy as np
from collections import Counter
from itertools import combinations

def calculate_daily_kpis(df_all, sel_ts):
    """Calcule tous les KPIs pour une journée donnée"""
    day_df = df_all[df_all["day"] == sel_ts.date()].copy()
    
    # Base KPIs
    ca_jour  = float(day_df["total_revenue"].sum())
    tickets  = int(day_df["ticket_number"].nunique())
    panier   = ca_jour / tickets if tickets else 0.0
    qte_jour = float(day_df["quantity"].sum())

    # Aggrégation horaire
    by_hour = (day_df.groupby("hour", as_index=False)
               .agg(ca=("total_revenue","sum"),
                    tkt=("ticket_number","nunique"),
                    qte=("quantity","sum"))
               .sort_values("hour"))
    by_hour["panier_h"] = (by_hour["ca"] / by_hour["tkt"].replace(0, np.nan)).fillna(0)
    by_hour["heure"]    = by_hour["hour"].map(lambda x: f"{int(x):02d}h")
    by_hour["ca_cum"]   = by_hour["ca"].cumsum()

    # Vitesse et Pic d'activité
    heures_act = int((by_hour["qte"] > 0).sum())
    vitesse    = qte_jour / heures_act if heures_act > 0 else 0.0
    peak_h     = int(by_hour.loc[by_hour["qte"].idxmax(), "hour"]) if not by_hour.empty else 0
    peak_qte_h = float(by_hour["qte"].max()) if not by_hour.empty else 0.0

    # Delta vs Moyenne Globale
    ca_moy_global = float(df_all.groupby("day")["total_revenue"].sum().mean())
    delta_vs_moy  = (ca_jour - ca_moy_global) / ca_moy_global * 100 if ca_moy_global > 0 else 0

    # Top produits
    top_qte = day_df.groupby("article")["quantity"].sum().sort_values(ascending=False).head(8).reset_index()
    top_ca  = day_df.groupby("article")["total_revenue"].sum().sort_values(ascending=False).head(8).reset_index()
    top_tkt = (day_df.groupby("article")["ticket_number"].nunique()
               .sort_values(ascending=False).head(8).reset_index()
               .rename(columns={"ticket_number":"nb_tkt"}))

    # Catégories
    cat_df  = day_df.groupby("category")["total_revenue"].sum().sort_values(ascending=False).reset_index()
    cat_df  = cat_df[cat_df["total_revenue"] > 0]

    # Market Basket Analysis (Combinaisons fréquentes)
    tkt_items = day_df.groupby("ticket_number")["article"].apply(list)
    pairs_ctr = Counter()
    for items in tkt_items:
        uniq = list(set(items))
        if len(uniq) >= 2:
            for a, b in combinations(sorted(uniq), 2):
                pairs_ctr[(a, b)] += 1
    top_pairs = pairs_ctr.most_common(5)

    # Tickets Mono/Multi-articles
    tkt_sz   = day_df.groupby("ticket_number")["article"].count()
    nb_multi = int((tkt_sz >= 2).sum())
    nb_mono  = tickets - nb_multi
    pct_m    = nb_multi / tickets * 100 if tickets else 0

    # Alerts
    alerts_count = 5 

    return {
        "day_df": day_df,
        "ca_jour": ca_jour,
        "tickets": tickets,
        "panier": panier,
        "qte_jour": qte_jour,
        "by_hour": by_hour,
        "heures_act": heures_act,
        "vitesse": vitesse,
        "peak_h": peak_h,
        "peak_qte_h": peak_qte_h,
        "ca_moy_global": ca_moy_global,
        "delta_vs_moy": delta_vs_moy,
        "top_qte": top_qte,
        "top_ca": top_ca,
        "top_tkt": top_tkt,
        "cat_df": cat_df,
        "top_pairs": top_pairs,
        "nb_multi": nb_multi,
        "nb_mono": nb_mono,
        "pct_m": pct_m,
        "alerts_count": alerts_count
    }
