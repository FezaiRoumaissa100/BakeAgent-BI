import pandas as pd
import numpy as np

def safe_num(v, default=0.0):
    try:
        if pd.isna(v) or np.isnan(v) or np.isinf(v):
            return default
        return float(v)
    except:
        return default

# ── 1. Pénétration ──────────────────────────────────────────
def get_penetration_data(df_clean, df_pen_raw, search="", categories=None, statuts=None, year=None):
    df = df_clean.copy()
    df_pen = df_pen_raw.copy()

    # Filtre temporel
    if year and year != "Toutes":
        try:
            y = int(year)
            if 'semaine_iso' in df.columns:
                df = df[df['semaine_iso'].astype(str).str.startswith(str(y))]
            elif 'date' in df.columns:
                df = df[df['date'].dt.year == y]
            df_pen = df_pen.copy()
        except Exception:
            pass

    cat_map = df[['article', 'category']].drop_duplicates().query("category != 'A CLASSIFIER'")
    df_pen = df_pen.merge(cat_map, on='article', how='left')
    
    moy_cat = (df_pen.dropna(subset=['category'])
               .groupby('category')['penetration_rate_%'].mean().reset_index()
               .rename(columns={'penetration_rate_%': 'moy_pen_cat'}))
    df_pen = df_pen.merge(moy_cat, on='category', how='left')
    df_pen['score_normalise'] = (df_pen['penetration_rate_%'] / df_pen['moy_pen_cat'].replace(0, 1) * 100).round(1)

    ca = df.groupby('article')['total_revenue'].sum().reset_index().rename(columns={'total_revenue': 'ca_total'})
    qty = df.groupby('article')['quantity'].sum().reset_index().rename(columns={'quantity': 'qty_total'})
    df_pen = df_pen.merge(ca, on='article', how='left').merge(qty, on='article', how='left')
    df_pen['upt'] = (df_pen['qty_total'] / df_pen['tickets_count'].replace(0, 1)).round(2)

    # Filtrage
    if search:
        df_pen = df_pen[df_pen['article'].str.contains(search, case=False, na=False)]
    if categories is not None and isinstance(categories, (list, set, tuple)) and len(categories) > 0 and "Toutes" not in categories:
        df_pen = df_pen[df_pen['category'].isin(categories)]
    if statuts is not None and isinstance(statuts, (list, set, tuple)) and len(statuts) > 0:
        df_pen = df_pen[df_pen['statut_strategique'].isin(statuts)]

    # Weekly trend — DYNAMIQUE selon les filtres
    # Si recherche OU catégories OU statuts sont actifs :
    #   → afficher les TOP 4 produits du df_penet FILTRÉ (pertinence > TOP fixes)
    # Sinon : garder les 6 produits "phares" fixes (référence historique)
    PRODUITS_TOP_FIXES = ['TRADITIONAL BAGUETTE', 'COUPE', 'BAGUETTE', 'BANETTE', 'CROISSANT', 'PAIN AU CHOCOLAT']
    has_filter = bool(search) or (categories and len(categories) > 0) or (statuts and len(statuts) > 0)

    if has_filter and len(df_pen) > 0:
        # Prendre les N premiers du df_penet déjà filtré (triés par pénétration)
        top_n = min(6, len(df_pen))
        produits_du_graphe = df_pen.sort_values('penetration_rate_%', ascending=False)['article'].head(top_n).tolist()
    else:
        produits_du_graphe = list(PRODUITS_TOP_FIXES)

    weekly_trend = []
    if 'semaine_iso' in df.columns and len(produits_du_graphe) > 0:
        try:
            tickets_hebdo = (df.groupby('semaine_iso')['ticket_number']
                             .nunique().reset_index()
                             .rename(columns={'ticket_number': 'nb_tickets_semaine'}))
            df_penet = (df.drop_duplicates(subset=['ticket_number', 'article'])
                        [df.drop_duplicates(subset=['ticket_number', 'article'])['article'].isin(produits_du_graphe)]
                        .groupby(['semaine_iso', 'article'])['ticket_number'].nunique().reset_index()
                        .rename(columns={'ticket_number': 'nb_tickets_produit'})
                        .merge(tickets_hebdo, on='semaine_iso', how='left'))
            df_penet['taux'] = (df_penet['nb_tickets_produit'] / df_penet['nb_tickets_semaine'] * 100).round(2)

            for art in produits_du_graphe:
                sub = df_penet[df_penet['article'] == art].sort_values('semaine_iso')
                series = []
                for _, r in sub.iterrows():
                    series.append({"week": str(r['semaine_iso']), "rate": safe_num(r['taux'])})
                weekly_trend.append({"article": art, "series": series})
        except Exception:
            weekly_trend = []

    # Category averages
    cat_pen = (df_pen.dropna(subset=['category'])
               .groupby('category')
               .agg(
                   taux_moyen=('penetration_rate_%', 'mean'),
                   ca_total=('ca_total', 'sum'),
                   nb_articles=('article', 'count')
               ).reset_index().sort_values('taux_moyen', ascending=False))

    cat_pen_list = []
    for _, r in cat_pen.iterrows():
        cat_pen_list.append({
            "category": str(r['category']),
            "taux_moyen": safe_num(r['taux_moyen']),
            "ca_total": safe_num(r['ca_total']),
            "nb_articles": int(r['nb_articles'])
        })

    # Status distribution
    status_counts = df_pen['statut_strategique'].value_counts().to_dict()

    # Product rows
    items = []
    for _, r in df_pen.sort_values('penetration_rate_%', ascending=False).iterrows():
        items.append({
            "article": str(r['article']),
            "category": str(r.get('category', 'Autre')),
            "penetration_rate": safe_num(r.get('penetration_rate_%', 0)),
            "tickets_count": int(r.get('tickets_count', 0)),
            "ca_total": safe_num(r.get('ca_total', 0)),
            "qty_total": safe_num(r.get('qty_total', 0)),
            "upt": safe_num(r.get('upt', 0)),
            "statut": str(r.get('statut_strategique', 'Autre'))
        })

    available_years = []
    try:
        if 'date' in df_clean.columns:
            available_years = sorted([int(y) for y in df_clean['date'].dt.year.dropna().unique()], reverse=True)
        elif 'semaine_iso' in df_clean.columns:
            years = sorted(list(set(str(s)[:4] for s in df_clean['semaine_iso'].dropna().astype(str).unique())), reverse=True)
            available_years = [int(y) for y in years if y.isdigit()]
    except Exception:
        available_years = []

    return {
        "kpis": {
            "total_articles": len(df_pen),
            "pen_max": safe_num(df_pen['penetration_rate_%'].max() if len(df_pen) else 0),
            "pen_median": safe_num(df_pen['penetration_rate_%'].median() if len(df_pen) else 0),
            "status_counts": status_counts
        },
        "items": items,
        "category_summary": cat_pen_list,
        "weekly_trend": weekly_trend,
        "available_categories": sorted(df_clean[df_clean['category'] != 'A CLASSIFIER']['category'].dropna().unique().tolist()) if 'category' in df_clean.columns else [],
        "available_statuts": sorted(df_pen_raw['statut_strategique'].dropna().unique().tolist()),
        "available_years": available_years
    }

# ── 2. Vitesse de vente ─────────────────────────────────────
def get_sales_velocity_data(df_clean, df_macro_raw):
    ordre = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    labels = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

    def vel_par_jour(df_sub):
        v = (df_sub.groupby(df_sub['date'].dt.day_name())
             .agg(qte=('quantity', 'sum'),
                  jours=('date', lambda x: x.nunique()))
             .reindex(ordre))
        v['velocity'] = (v['qte'] / v['jours'].replace(0, 1)).round(2)
        return v

    v_all = vel_par_jour(df_clean)
    v_tour = vel_par_jour(df_clean[df_clean.get('is_touristic_season', 0) == 1]) if 'is_touristic_season' in df_clean.columns else v_all
    v_evt = vel_par_jour(df_clean[df_clean.get('is_event', 0) == 1]) if 'is_event' in df_clean.columns else v_all

    dow_velocity = []
    for i, lab in enumerate(labels):
        dow_velocity.append({
            "day": lab,
            "all": safe_num(v_all['velocity'].values[i]),
            "touristic": safe_num(v_tour['velocity'].values[i]),
            "event": safe_num(v_evt['velocity'].values[i])
        })

    # Macro items
    macro_items = []
    df_m = df_macro_raw.copy()
    if 'article' in df_m.columns:
        for _, r in df_m.sort_values(df_m.columns[1], ascending=False).head(30).iterrows():
            row_dict = {"article": str(r['article'])}
            for col in df_m.columns:
                if col != 'article':
                    row_dict[col] = safe_num(r[col]) if isinstance(r[col], (int, float, np.number)) else str(r[col])
            macro_items.append(row_dict)

    # Micro velocity (hourly distribution)
    df_h = df_clean[df_clean['hour'].notna()].copy()
    df_h['hour'] = df_h['hour'].astype(int)
    mask_hors = (df_h['hour'] < 7) | (df_h['hour'] > 19)
    df_hc = df_h[~mask_hors].copy()
    
    hourly_agg = df_hc.groupby('hour')['quantity'].sum().reset_index()
    hourly_dist = []
    for _, r in hourly_agg.iterrows():
        hourly_dist.append({"hour": int(r['hour']), "label": f"{int(r['hour']):02d}h", "qte": safe_num(r['quantity'])})

    return {
        "dow_velocity": dow_velocity,
        "macro_items": macro_items,
        "hourly_distribution": hourly_dist
    }

# ── 3. Contribution au ticket ────────────────────────────────
def get_ticket_contribution_data(df_clean):
    df = df_clean.copy()
    taille_tickets = df.groupby('ticket_number')['article'].nunique()
    tickets_multi = taille_tickets[taille_tickets >= 2].index
    df_multi = df[df['ticket_number'].isin(tickets_multi)].copy()

    nb_mono = int((taille_tickets == 1).sum())
    nb_multi = len(tickets_multi)
    nb_total = len(taille_tickets)

    df_multi_agg = (
        df_multi.groupby(['ticket_number', 'article'], as_index=False)
        .agg(line_revenue=('total_revenue', 'sum'), line_qty=('quantity', 'sum'))
    )
    df_multi_agg['ticket_total_value'] = df_multi_agg.groupby('ticket_number')['line_revenue'].transform('sum')
    df_multi_agg['contribution_%'] = (df_multi_agg['line_revenue'] / df_multi_agg['ticket_total_value'].replace(0, 1) * 100).round(2)

    ca_reel = df.groupby('article')['total_revenue'].sum().reset_index()
    ca_reel.columns = ['article', 'ca_total_magasin']

    ticket_contribution = (
        df_multi_agg.groupby('article')
        .agg(
            contribution_med=('contribution_%', 'median'),
            contribution_moy=('contribution_%', 'mean'),
            nb_tickets_multi=('ticket_number', 'nunique'),
        )
        .reset_index().round(2)
    )
    ticket_contribution = ticket_contribution.merge(ca_reel, on='article', how='left')
    ticket_contribution_fiable = ticket_contribution[ticket_contribution['nb_tickets_multi'] >= 10].sort_values('contribution_med', ascending=False)

    top20 = []
    for _, r in ticket_contribution_fiable.head(20).iterrows():
        top20.append({
            "article": str(r['article']),
            "contribution_med": safe_num(r['contribution_med']),
            "contribution_moy": safe_num(r['contribution_moy']),
            "nb_tickets_multi": int(r['nb_tickets_multi']),
            "ca_total": safe_num(r['ca_total_magasin'])
        })

    return {
        "stats": {
            "nb_mono": nb_mono,
            "nb_multi": nb_multi,
            "nb_total": nb_total,
            "pct_multi": safe_num(nb_multi / max(nb_total, 1) * 100)
        },
        "top20": top20
    }

# ── 4. Fréquence d'achat ─────────────────────────────────────
def get_repurchase_frequency_data(df_clean):
    df = df_clean.copy()

    # Création de week_id 100% VECTORISÉ (aucun apply ligne-par-ligne)
    if 'semaine_iso' in df.columns:
        df['week_id'] = df['semaine_iso'].astype(str)
    else:
        iso = df['date'].dt.isocalendar()
        wk = iso['week'].astype(int).astype(str)
        # zfill vectorisé par concaténation conditionnelle
        df['week_id'] = (iso['year'].astype(int).astype(str) + '-W' +
                         ('0' + wk).str.slice(-2))

    total_sem = int(df['week_id'].nunique())
    if total_sem <= 0:
        total_sem = 1

    sp = (df.groupby('article')['week_id'].nunique().reset_index()
            .rename(columns={'week_id': 'semaines_actives'}))
    sp['repurchase_freq_%'] = (sp['semaines_actives'] / max(total_sem, 1) * 100).round(2)

    def classify(r):
        if r == 100: return 'Produit Quotidien (100%)'
        elif r >= 75: return 'Produit Regulier (75-99%)'
        elif r >= 50: return 'Produit Cyclique (50-74%)'
        else: return 'Produit Sporadique (<50%)'

    sp['statut_frequence'] = sp['repurchase_freq_%'].apply(classify)
    ca = df.groupby('article')['total_revenue'].sum().reset_index().rename(columns={'total_revenue': 'ca_total'})
    qty = df.groupby('article')['quantity'].sum().reset_index().rename(columns={'quantity': 'qte_totale'})
    rp = sp.merge(ca, on='article').merge(qty, on='article')

    if 'category' in df.columns:
        cat = df.groupby('article')['category'].first().reset_index()
        rp = rp.merge(cat, on='article', how='left')

    rp = rp.sort_values('repurchase_freq_%', ascending=False).reset_index(drop=True)
    status_distribution = rp['statut_frequence'].value_counts().to_dict()

    items = []
    for _, r in rp.iterrows():
        items.append({
            "article": str(r['article']),
            "category": str(r.get('category', 'Autre')),
            "semaines_actives": int(r['semaines_actives']),
            "repurchase_freq": safe_num(r['repurchase_freq_%']),
            "statut": str(r['statut_frequence']),
            "ca_total": safe_num(r['ca_total']),
            "qte_totale": safe_num(r['qte_totale'])
        })

    return {
        "total_semaines": total_sem,
        "nb_produits": len(rp),
        "status_distribution": status_distribution,
        "items": items
    }

# ── 5. Associations (Apriori Rules) ──────────────────────────
def get_associations_data(regles_raw, sort_by="Lift ↓", top_n=20):
    df_r = regles_raw.copy()
    
    def prep_col(col):
        return col.apply(lambda x: ' + '.join(sorted(x)) if hasattr(x, '__iter__') and not isinstance(x, str) else str(x))

    if 'antecedents_str' not in df_r.columns:
        df_r['antecedents_str'] = prep_col(df_r['antecedents'])
    if 'consequents_str' not in df_r.columns:
        df_r['consequents_str'] = prep_col(df_r['consequents'])

    if sort_by == "Confiance ↓":
        df_r = df_r.sort_values('confidence', ascending=False)
    elif sort_by == "Support ↓":
        df_r = df_r.sort_values('support', ascending=False)
    else:
        df_r = df_r.sort_values('lift', ascending=False)

    df_r = df_r.reset_index(drop=True)
    if top_n and top_n != "Toutes":
        df_r = df_r.head(int(top_n))

    rules = []
    for _, r in df_r.iterrows():
        rules.append({
            "antecedent": str(r['antecedents_str']),
            "consequent": str(r['consequents_str']),
            "support": safe_num(r['support'] * 100),
            "confidence": safe_num(r['confidence'] * 100),
            "lift": safe_num(r['lift'])
        })

    return {
        "nb_total_regles": len(regles_raw),
        "rules": rules
    }
