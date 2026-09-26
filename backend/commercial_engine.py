import pandas as pd
import numpy as np

def safe_num(v, default=0.0):
    try:
        if pd.isna(v) or np.isnan(v) or np.isinf(v):
            return default
        return float(v)
    except:
        return default

def calculate_commercial_performance(df_all, ca_mens_raw, annee="2024 + 2025", saison="Toutes", mois="Tous", categorie="Toutes", evenement="Tous"):
    df = df_all.copy()
    
    # ── Filtres ──
    if annee == "2024":
        df = df[df['date'].dt.year == 2024]
    elif annee == "2025":
        df = df[df['date'].dt.year == 2025]
        
    if saison != "Toutes" and 'season' in df.columns:
        df = df[df['season'] == saison]
        
    mois_noms = ["Tous", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                 "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
    if mois != "Tous" and mois in mois_noms:
        df = df[df['date'].dt.month == mois_noms.index(mois)]
        
    if categorie != "Toutes" and 'category' in df.columns:
        df = df[df['category'] == categorie]
        
    if evenement != "Tous" and 'event' in df.columns:
        df = df[df['event'] == evenement]

    if df.empty:
        return {"empty": True}

    # ── KPIs ──
    total_ca = safe_num(df['total_revenue'].sum())
    nb_tickets = int(df['ticket_number'].nunique())
    nb_jours = int(df['date'].dt.date.nunique())
    panier = safe_num(total_ca / nb_tickets) if nb_tickets > 0 else 0.0
    nb_produits = int(df['article'].nunique())

    # ── 1. Évolution mensuelle (sur df_all complet, conforme à app.py) ──
    ca_plot = (df_all.groupby(df_all['date'].dt.to_period('M').dt.to_timestamp())['total_revenue']
               .sum().reset_index())
    ca_plot.columns = ['date', 'ca']
    ca_plot['date_str'] = ca_plot['date'].dt.strftime('%b %Y')
    
    moyenne = safe_num(ca_plot['ca'].mean())
    ecart_type = safe_num(ca_plot['ca'].std())
    idx_max = int(ca_plot['ca'].idxmax())
    idx_min = int(ca_plot['ca'].idxmin())
    
    monthly_data = []
    for _, row in ca_plot.iterrows():
        monthly_data.append({
            "date": row['date'].strftime('%Y-%m-%d'),
            "label": row['date_str'],
            "ca": safe_num(row['ca'])
        })
        
    ca_max_info = {
        "date_str": ca_plot.loc[idx_max, 'date'].strftime('%B %Y'),
        "val": safe_num(ca_plot.loc[idx_max, 'ca'])
    }
    ca_min_info = {
        "date_str": ca_plot.loc[idx_min, 'date'].strftime('%B %Y'),
        "val": safe_num(ca_plot.loc[idx_min, 'ca'])
    }
    amplitude = ca_max_info['val'] - ca_min_info['val']
    ratio_amp = safe_num(ca_max_info['val'] / max(ca_min_info['val'], 1.0))

    # Comparaison 2024 vs 2025 mois par mois
    df24 = df_all[df_all['date'].dt.year == 2024]
    df25 = df_all[df_all['date'].dt.year == 2025]
    ca24 = df24.groupby(df24['date'].dt.month)['total_revenue'].sum()
    ca25 = df25.groupby(df25['date'].dt.month)['total_revenue'].sum()
    mois_court = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    months_common = sorted(set(ca24.index) & set(ca25.index))
    comp_24_25 = []
    for m in months_common:
        comp_24_25.append({
            "mois": mois_court[m-1],
            "ca_2024": safe_num(ca24.get(m, 0)),
            "ca_2025": safe_num(ca25.get(m, 0)),
        })

    # ── 2. Top Produits (sur df filtré) ──
    top_ca_df = (df.groupby('article')['total_revenue'].sum()
                 .sort_values(ascending=False).head(20).reset_index())
    top_ca_df['part'] = (top_ca_df['total_revenue'] / max(total_ca, 1.0) * 100).round(1)
    top_ca_df['cumul'] = top_ca_df['part'].cumsum().round(1)
    top_ca_list = []
    for _, r in top_ca_df.iterrows():
        top_ca_list.append({
            "article": str(r['article']).title(),
            "total_revenue": safe_num(r['total_revenue']),
            "part": safe_num(r['part']),
            "cumul": safe_num(r['cumul'])
        })

    top_qte_df = (df.groupby('article')['quantity'].sum()
                  .sort_values(ascending=False).head(20).reset_index())
    top_qte_list = [{"article": str(r['article']).title(), "quantity": safe_num(r['quantity'])} for _, r in top_qte_df.iterrows()]

    top_tkt_df = (df.groupby('article')['ticket_number'].nunique()
                  .sort_values(ascending=False).head(20).reset_index())
    top_tkt_list = [{"article": str(r['article']).title(), "nb_tkt": int(r['ticket_number'])} for _, r in top_tkt_df.iterrows()]

    # ── 3. Saisonnalité (sur df filtré) ──
    ordre_dow = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    labels_dow = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
    ca_j = df.groupby(df['date'].dt.day_name())['total_revenue'].sum().reindex(ordre_dow).fillna(0)
    nb_j = df.groupby(df['date'].dt.day_name())['date'].nunique().reindex(ordre_dow).fillna(1)
    ca_moy = (ca_j / nb_j).fillna(0)

    seasonality_days = []
    for i, dow in enumerate(labels_dow):
        seasonality_days.append({
            "day": dow,
            "ca_total": safe_num(ca_j.values[i]),
            "ca_moyen": safe_num(ca_moy.values[i])
        })

    # Distribution horaire
    hourly_dist = []
    if 'hour' in df.columns:
        ca_h = df.groupby('hour')['total_revenue'].sum().reset_index()
        tick_h = df.groupby('hour')['ticket_number'].nunique().reset_index()
        merged_h = pd.merge(ca_h, tick_h, on='hour')
        for _, r in merged_h.iterrows():
            hourly_dist.append({
                "hour": int(r['hour']),
                "heure_label": f"{int(r['hour']):02d}h",
                "ca": safe_num(r['total_revenue']),
                "tickets": int(r['ticket_number'])
            })

    # ── 4. Catégories (sur df filtré) ──
    categories_summary = []
    if 'category' in df.columns:
        cat = (df[df['category'] != 'A CLASSIFIER']
               .groupby('category')
               .agg(
                   CA=('total_revenue', 'sum'),
                   Panier=('total_revenue', 'mean'),
                   Tickets=('ticket_number', 'nunique'),
                   Produits=('article', 'nunique')
               )
               .sort_values('CA', ascending=False))
        total_cat_ca = cat['CA'].sum() or 1.0
        cat['Part_%'] = (cat['CA'] / total_cat_ca * 100).round(1)

        for cat_name, r in cat.iterrows():
            categories_summary.append({
                "category": str(cat_name),
                "ca": safe_num(r['CA']),
                "part": safe_num(r['Part_%']),
                "panier": safe_num(r['Panier']),
                "tickets": int(r['Tickets']),
                "produits": int(r['Produits'])
            })

    # Available filter options for the frontend
    categories_list = ["Toutes"] + sorted(df_all[df_all['category'] != 'A CLASSIFIER']['category'].dropna().unique().tolist()) if 'category' in df_all.columns else ["Toutes"]
    events_list = ["Tous"] + sorted(df_all[df_all['event'] != 'Jour Normal']['event'].dropna().unique().tolist()) if 'event' in df_all.columns else ["Tous"]

    return {
        "kpis": {
            "total_ca": total_ca,
            "nb_tickets": nb_tickets,
            "panier": panier,
            "nb_jours": nb_jours,
            "nb_produits": nb_produits
        },
        "monthly": {
            "series": monthly_data,
            "moyenne": moyenne,
            "ecart_type": ecart_type,
            "ca_max": ca_max_info,
            "ca_min": ca_min_info,
            "amplitude": amplitude,
            "ratio_amp": ratio_amp,
            "comp_24_25": comp_24_25
        },
        "top_products": {
            "by_ca": top_ca_list,
            "by_qte": top_qte_list,
            "by_tkt": top_tkt_list
        },
        "seasonality": {
            "days": seasonality_days,
            "hourly": hourly_dist
        },
        "categories": categories_summary,
        "available_filters": {
            "annees": ["2024 + 2025", "2024", "2025"],
            "saisons": ["Toutes", "Printemps", "Ete", "Automne", "Hiver"],
            "mois": ["Tous", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
            "categories": categories_list,
            "evenements": events_list
        }
    }
