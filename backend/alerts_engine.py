import pandas as pd
import numpy as np

def safe_num(v, default=0.0):
    try:
        if pd.isna(v) or np.isnan(v) or np.isinf(v):
            return default
        return float(v)
    except:
        return default

COLOR_STATUT = {
    'RUPTURE': '#E24B4A',
    'VIGILANCE': '#EF9F27',
    'NORMAL': '#639922',
    'SURSTOCK': '#378ADD',
    'FERMÉ': '#B4B2A9',
}

def get_alerts_data(df_clean, forecast_saison_raw, mois_filter="Tout"):
    if forecast_saison_raw is None or forecast_saison_raw.empty:
        return {"empty": True}

    fs = forecast_saison_raw.copy()
    if 'ds' not in fs.columns and 'date' in fs.columns:
        fs = fs.rename(columns={'date': 'ds'})
    fs['ds'] = pd.to_datetime(fs['ds'])

    # Paramètres
    prix_median = safe_num(df_clean['unit_price'].median() if 'unit_price' in df_clean.columns else 2.5, 2.5)
    taux_marge = 0.65
    stock_jours = 2

    fs['stock_initial'] = (fs['yhat'] * stock_jours).clip(0).astype(int)
    fs['ca_prevu'] = (fs['yhat'] * prix_median).round(0)
    fs['marge_prevue'] = (fs['ca_prevu'] * taux_marge).round(0)
    fs['commande_recommandee'] = fs['stock_initial']
    fs['ratio_pct'] = np.where(
        fs['yhat_upper'] > 0,
        (fs['stock_initial'] / fs['yhat_upper'] * 100).clip(0, 300).round(1),
        0
    )

    def get_statut(row):
        if row.get('is_ferme', 0) or row['yhat'] == 0:
            return 'FERMÉ'
        r = row['ratio_pct']
        if r >= 90: return 'RUPTURE'
        if r >= 60: return 'VIGILANCE'
        if r >= 40: return 'NORMAL'
        return 'SURSTOCK'

    fs['statut'] = fs.apply(get_statut, axis=1)
    fs['bar_color'] = fs['statut'].map(COLOR_STATUT)

    # Global KPI counts across all season
    kpi_all = fs['statut'].value_counts().to_dict()
    for s in ['RUPTURE', 'VIGILANCE', 'NORMAL', 'SURSTOCK', 'FERMÉ']:
        kpi_all.setdefault(s, 0)

    open_days = fs[fs['yhat'] > 0]
    total_articles = int(open_days['yhat'].sum())
    ca_total_prevu = safe_num(open_days['ca_prevu'].sum())
    marge_totale = safe_num(open_days['marge_prevue'].sum())
    ca_risque = safe_num(fs[fs['statut'] == 'RUPTURE']['ca_prevu'].sum())
    
    pic_idx = fs['yhat'].idxmax()
    pic_val = int(fs.loc[pic_idx, 'yhat'])
    pic_date = fs.loc[pic_idx, 'date_fr'] if 'date_fr' in fs.columns else fs.loc[pic_idx, 'ds'].strftime('%d/%m/%Y')

    # Filtrage par mois
    mois_map = {
        'Tout': ('2026-06-01', '2026-09-30'),
        'Juin': ('2026-06-01', '2026-06-30'),
        'Juillet': ('2026-07-01', '2026-07-31'),
        'Août': ('2026-08-01', '2026-08-31'),
        'Septembre': ('2026-09-01', '2026-09-30'),
    }
    d_start, d_end = mois_map.get(mois_filter, ('2026-06-01', '2026-09-30'))
    dash_df = fs[(fs['ds'] >= pd.Timestamp(d_start)) & (fs['ds'] <= pd.Timestamp(d_end))].copy()

    days_data = []
    for _, r in dash_df.sort_values('ds').iterrows():
        days_data.append({
            "ds": r['ds'].strftime('%Y-%m-%d'),
            "date_fr": r.get('date_fr', r['ds'].strftime('%d/%m/%Y')),
            "jour_semaine": r.get('jour_semaine', ''),
            "yhat": int(r['yhat']),
            "yhat_lower": int(r['yhat_lower']),
            "yhat_upper": int(r['yhat_upper']),
            "ca_prevu": safe_num(r['ca_prevu']),
            "marge_prevue": safe_num(r['marge_prevue']),
            "ratio_pct": safe_num(r['ratio_pct']),
            "commande_recommandee": int(r['commande_recommandee']),
            "statut": str(r['statut']),
            "bar_color": str(r['bar_color'])
        })

    return {
        "kpis": {
            "total_articles": total_articles,
            "ca_total_prevu": ca_total_prevu,
            "marge_totale": marge_totale,
            "ca_risque": ca_risque,
            "pic_val": pic_val,
            "pic_date": pic_date,
            "statuts": kpi_all
        },
        "days": days_data,
        "available_mois": ['Tout', 'Juin', 'Juillet', 'Août', 'Septembre']
    }
