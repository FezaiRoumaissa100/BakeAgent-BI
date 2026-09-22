import pandas as pd
import numpy as np
from collections import Counter
from itertools import combinations
import math

def safe_float(v):
    if pd.isna(v) or math.isnan(v): return 0.0
    return float(v)

def calculate_daily_kpis(df_all, sel_ts):
    day_df = df_all[df_all["day"] == sel_ts.date()].copy()
    
    ca_jour  = safe_float(day_df["total_revenue"].sum())
    tickets  = int(day_df["ticket_number"].nunique())
    panier   = ca_jour / tickets if tickets else 0.0
    qte_jour = safe_float(day_df["quantity"].sum())

    by_hour = (day_df.groupby("hour", as_index=False)
               .agg(ca=("total_revenue","sum"),
                    tkt=("ticket_number","nunique"),
                    qte=("quantity","sum"))
               .sort_values("hour"))
    by_hour["panier_h"] = (by_hour["ca"] / by_hour["tkt"].replace(0, np.nan)).fillna(0)
    by_hour["heure"]    = by_hour["hour"].map(lambda x: f"{int(x):02d}h")
    by_hour["ca_cum"]   = by_hour["ca"].cumsum()

    heures_act = int((by_hour["qte"] > 0).sum())
    vitesse    = qte_jour / heures_act if heures_act > 0 else 0.0
    peak_h     = int(by_hour.loc[by_hour["qte"].idxmax(), "hour"]) if not by_hour.empty else 0
    peak_qte_h = safe_float(by_hour["qte"].max()) if not by_hour.empty else 0.0

    ca_moy_global = safe_float(df_all.groupby("day")["total_revenue"].sum().mean())
    delta_vs_moy  = (ca_jour - ca_moy_global) / ca_moy_global * 100 if ca_moy_global > 0 else 0

    top_qte = day_df.groupby("article")["quantity"].sum().sort_values(ascending=False).head(8).reset_index()
    top_ca  = day_df.groupby("article")["total_revenue"].sum().sort_values(ascending=False).head(8).reset_index()
    top_tkt = (day_df.groupby("article")["ticket_number"].nunique()
               .sort_values(ascending=False).head(8).reset_index()
               .rename(columns={"ticket_number":"nb_tkt"}))

    cat_df  = day_df.groupby("category")["total_revenue"].sum().sort_values(ascending=False).reset_index()
    cat_df  = cat_df[cat_df["total_revenue"] > 0]

    tkt_items = day_df.groupby("ticket_number")["article"].apply(list)
    pairs_ctr = Counter()
    for items in tkt_items:
        uniq = list(set(items))
        if len(uniq) >= 2:
            for a, b in combinations(sorted(uniq), 2):
                pairs_ctr[(a, b)] += 1
    top_pairs = pairs_ctr.most_common(5)

    tkt_sz   = day_df.groupby("ticket_number")["article"].count()
    nb_multi = int((tkt_sz >= 2).sum())
    nb_mono  = tickets - nb_multi
    pct_m    = nb_multi / tickets * 100 if tickets else 0

    alerts_count = 5 
    
    hourly_data = by_hour.to_dict(orient="records")
    top_qte_list = top_qte.to_dict(orient="records")
    top_ca_list = top_ca.to_dict(orient="records")
    top_tkt_list = top_tkt.to_dict(orient="records")
    cat_list = cat_df.to_dict(orient="records")
    pairs_list = [{"pa": p[0][0], "pb": p[0][1], "cnt": int(p[1])} for p in top_pairs]

    return {
        "ca_jour": ca_jour,
        "tickets": tickets,
        "panier": panier,
        "qte_jour": qte_jour,
        "hourly_data": hourly_data,
        "heures_act": heures_act,
        "vitesse": vitesse,
        "peak_h": peak_h,
        "peak_qte_h": peak_qte_h,
        "ca_moy_global": ca_moy_global,
        "delta_vs_moy": delta_vs_moy,
        "top_qte": top_qte_list,
        "top_ca": top_ca_list,
        "top_tkt": top_tkt_list,
        "categories": cat_list,
        "top_pairs": pairs_list,
        "nb_multi": nb_multi,
        "nb_mono": nb_mono,
        "pct_m": pct_m,
        "alerts_count": alerts_count
    }
