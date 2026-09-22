import streamlit as st
import pickle
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from style import inject_bakery_style, section_header, bakery_sidebar_logo

st.set_page_config(
    page_title="Alertes Stock — Boulangerie Le Croisic",
    page_icon="📦",
    layout="wide"
)
inject_bakery_style()
bakery_sidebar_logo()

# ── Palette ─────────────────────────────────────────────────
C1  = '#8B3A0F'
C2  = '#C8860A'
C3  = '#E6A817'
BG  = '#FDF6EC'

COLOR_STATUT = {
    'RUPTURE'  : '#E24B4A',
    'VIGILANCE': '#EF9F27',
    'NORMAL'   : '#639922',
    'SURSTOCK' : '#378ADD',
    'FERMÉ'    : '#B4B2A9',
}

# ── Chargement des données ───────────────────────────────────
@st.cache_data
def load_data():
    path = 'retail_data.pkl'
    if not os.path.exists(path):
        path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'retail_data.pkl')
    with open(path, 'rb') as f:
        return pickle.load(f)

data = load_data()
df            = data['df_clean']
forecast_saison = data['forecast_saison'].copy()
mdape_cv      = float(data['mdape_cv'])

# ── Paramètres ───────────────────────────────────────────────
PRIX_MEDIAN   = float(df['unit_price'].median())
TAUX_MARGE    = 0.65
STOCK_JOURS   = 2

# ── Préparation forecast_saison ──────────────────────────────
fs = forecast_saison.copy()
fs['stock_initial']       = (fs['yhat'] * STOCK_JOURS).clip(0).astype(int)
fs['ca_prevu']            = (fs['yhat'] * PRIX_MEDIAN).round(0)
fs['marge_prevue']        = (fs['ca_prevu'] * TAUX_MARGE).round(0)
fs['commande_recommandee'] = fs['stock_initial']
fs['ratio_pct']           = np.where(
    fs['yhat_upper'] > 0,
    (fs['stock_initial'] / fs['yhat_upper'] * 100).clip(0, 300).round(1),
    0
)

def get_statut(row):
    if row['is_ferme'] or row['yhat'] == 0:
        return 'FERMÉ'
    r = row['ratio_pct']
    if r >= 90:  return 'RUPTURE'
    if r >= 60:  return 'VIGILANCE'
    if r >= 40:  return 'NORMAL'
    return 'SURSTOCK'

fs['statut']    = fs.apply(get_statut, axis=1)
fs['bar_color'] = fs['statut'].map(COLOR_STATUT)

# ── KPIs globaux ─────────────────────────────────────────────
open_days       = fs[fs['yhat'] > 0]
total_articles  = int(open_days['yhat'].sum())
ca_total_prevu  = float(open_days['ca_prevu'].sum())
marge_totale    = float(open_days['marge_prevue'].sum())
ca_risque       = float(fs[fs['statut'] == 'RUPTURE']['ca_prevu'].sum())
pic_idx         = fs['yhat'].idxmax()
pic_val         = int(fs.loc[pic_idx, 'yhat'])
pic_date        = fs.loc[pic_idx, 'date_fr']
kpi             = fs['statut'].value_counts().to_dict()
for s in ['RUPTURE','VIGILANCE','NORMAL','SURSTOCK','FERMÉ']:
    kpi.setdefault(s, 0)

# ═══════════════════════════════════════════════════════════════
# TITRE
# ═══════════════════════════════════════════════════════════════
st.markdown("# 📦 Système d'Alertes Stock")
st.markdown("### Saison Estivale 2026 — Juin → Septembre · Prévision Prophet")
st.divider()

# ── KPI Cards ────────────────────────────────────────────────
c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("🛍️ Articles prévus",    f"{total_articles:,}")
c2.metric("💶 CA prévu saison",    f"{ca_total_prevu:,.0f} €")
c3.metric("📊 Marge prévisionnelle", f"{marge_totale:,.0f} €")
c4.metric("⚠️ CA à risque rupture",  f"{ca_risque:,.0f} €")
c5.metric("📈 MDAPE Prophet",        f"{mdape_cv:.1f}%")

st.divider()

# ── Légende statuts ──────────────────────────────────────────
section_header("🚦", "Légende des Statuts Stock")
cols_leg = st.columns(5)
statuts_info = [
    ('RUPTURE',   '🔴', f"{kpi['RUPTURE']} jours",   "Stock < demande haute"),
    ('VIGILANCE', '🟠', f"{kpi['VIGILANCE']} jours",  "Stock entre 60–90%"),
    ('NORMAL',    '🟢', f"{kpi['NORMAL']} jours",    "Stock entre 40–60%"),
    ('SURSTOCK',  '🔵', f"{kpi['SURSTOCK']} jours",  "Stock > demande"),
    ('FERMÉ',     '⚪', f"{kpi['FERMÉ']} jours",     "Boulangerie fermée"),
]
for col, (statut, icon, nb, desc) in zip(cols_leg, statuts_info):
    with col:
        st.markdown(f"""
        <div style="background:white;border:2px solid {COLOR_STATUT[statut]};
                    border-radius:12px;padding:14px;text-align:center;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            <div style="font-size:1.6rem">{icon}</div>
            <div style="font-weight:800;color:{COLOR_STATUT[statut]};font-size:1.05rem">{statut}</div>
            <div style="font-size:1.2rem;font-weight:700;color:#333;margin:4px 0">{nb}</div>
            <div style="font-size:0.72rem;color:#888">{desc}</div>
        </div>
        """, unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# ── Filtres mois ─────────────────────────────────────────────
section_header("🗓️", "Filtrer par mois")
mois_options = ['Tout', 'Juin', 'Juillet', 'Août', 'Septembre']
mois_map = {
    'Tout'      : ('2026-06-01', '2026-09-30'),
    'Juin'      : ('2026-06-01', '2026-06-30'),
    'Juillet'   : ('2026-07-01', '2026-07-31'),
    'Août'      : ('2026-08-01', '2026-08-31'),
    'Septembre' : ('2026-09-01', '2026-09-30'),
}
mois_sel = st.radio("", mois_options, horizontal=True, label_visibility="collapsed")
d_start, d_end = mois_map[mois_sel]
dash_df = fs[(fs['ds'] >= pd.Timestamp(d_start)) & (fs['ds'] <= pd.Timestamp(d_end))].copy()

st.divider()

# ═══════════════════════════════════════════════════════════════
# GRAPHIQUE PRINCIPAL — 4 sous-graphes
# ═══════════════════════════════════════════════════════════════
section_header("📊", "Tableau de Bord Stock — 4 Indicateurs")

fig = make_subplots(
    rows=4, cols=1,
    shared_xaxes=True,
    vertical_spacing=0.06,
    subplot_titles=[
        '📦 Demande prévue (articles/jour)',
        '💶 CA prévu & Marge (€)',
        '📊 Ratio stock / demande haute (%)',
        '🛒 Commande recommandée (articles × 2 jours)',
    ],
    row_heights=[0.30, 0.25, 0.25, 0.20],
)

# G1 — Demande prévue
fig.add_trace(go.Bar(
    x=dash_df['ds'],
    y=dash_df['yhat'],
    marker_color=dash_df['bar_color'].tolist(),
    marker_line_width=0,
    name='Demande prévue',
    hovertemplate='%{x|%d/%m} : <b>%{y} articles</b><extra></extra>',
    showlegend=False,
), row=1, col=1)

# Intervalle de confiance G1
fig.add_trace(go.Scatter(
    x=pd.concat([dash_df['ds'], dash_df['ds'][::-1]]),
    y=pd.concat([dash_df['yhat_upper'], dash_df['yhat_lower'][::-1]]),
    fill='toself',
    fillcolor='rgba(200,134,10,0.12)',
    line=dict(width=0),
    showlegend=False,
    hoverinfo='skip',
), row=1, col=1)

# Pic max
if len(dash_df) > 0:
    pic_local = dash_df.loc[dash_df['yhat'].idxmax()]
    fig.add_annotation(
        x=pic_local['ds'], y=pic_local['yhat'],
        text=f"⚠️ Pic : {int(pic_local['yhat'])} art",
        showarrow=True, arrowhead=2, arrowcolor=C1, arrowwidth=1.5,
        font=dict(size=10, color=C1),
        bgcolor='rgba(255,255,255,0.9)',
        bordercolor=C1, borderwidth=1,
        ax=50, ay=-40, row=1, col=1,
    )

# G2 — CA + Marge
fig.add_trace(go.Bar(
    x=dash_df['ds'], y=dash_df['ca_prevu'],
    marker_color=dash_df['bar_color'].tolist(),
    marker_line_width=0, name='CA prévu (€)',
    hovertemplate='%{x|%d/%m} : <b>%{y:.0f} €</b><extra></extra>',
    showlegend=False,
), row=2, col=1)
fig.add_trace(go.Scatter(
    x=dash_df['ds'], y=dash_df['marge_prevue'],
    mode='lines+markers', name='Marge (€)',
    line=dict(color='#27AE60', width=2),
    marker=dict(size=4),
    hovertemplate='%{x|%d/%m} : Marge <b>%{y:.0f} €</b><extra></extra>',
), row=2, col=1)

# G3 — Ratio %
fig.add_trace(go.Scatter(
    x=dash_df['ds'], y=dash_df['ratio_pct'],
    mode='lines+markers', name='Ratio %',
    line=dict(color='#7F77DD', width=1.5),
    marker=dict(size=5, color=dash_df['bar_color'].tolist(),
                line=dict(width=1, color='white')),
    hovertemplate='%{x|%d/%m} : <b>%{y:.0f}%</b><extra></extra>',
    showlegend=False,
), row=3, col=1)

fig.add_hrect(y0=90, y1=300, fillcolor='rgba(226,75,74,0.08)',
              line_width=0, row=3, col=1)
fig.add_hrect(y0=0, y1=40, fillcolor='rgba(55,138,221,0.08)',
              line_width=0, row=3, col=1)
for seuil, label, color in [
    (90, '← Rupture (90%)', '#E24B4A'),
    (40, '← Surstock (40%)', '#378ADD'),
]:
    fig.add_hline(
        y=seuil, line_dash='dash', line_color=color, line_width=1.2,
        annotation_text=label,
        annotation_position='top right',
        annotation_font=dict(size=10, color=color),
        row=3, col=1,
    )

# G4 — Commande recommandée
fig.add_trace(go.Bar(
    x=dash_df['ds'], y=dash_df['commande_recommandee'],
    marker_color='rgba(127,119,221,0.7)',
    marker_line_width=0, name='Commande recommandée',
    hovertemplate='%{x|%d/%m} : <b>%{y} art</b> à commander (48h)<extra></extra>',
    showlegend=False,
), row=4, col=1)

# Layout
fig.update_layout(
    height=900,
    plot_bgcolor='white',
    paper_bgcolor=BG,
    font=dict(family='Arial, sans-serif', size=11, color='#333333'),
    hovermode='x unified',
    margin=dict(t=60, b=40, l=65, r=25),
    legend=dict(
        orientation='h', yanchor='bottom', y=1.01,
        xanchor='right', x=1.0,
        font=dict(size=10),
        bgcolor='rgba(255,255,255,0.8)',
        bordercolor='#dddddd', borderwidth=1,
    ),
)
for i in range(1, 5):
    fig.update_xaxes(
        showgrid=False, tickformat='%d/%m',
        tickangle=-45, tickfont=dict(size=9), row=i, col=1,
    )
fig.update_yaxes(showgrid=True, gridcolor='#f0f0f0',
                 title_text='Art/jour', title_font=dict(size=10), row=1, col=1)
fig.update_yaxes(showgrid=True, gridcolor='#f0f0f0',
                 title_text='EUR (€)', ticksuffix='€', row=2, col=1)
fig.update_yaxes(showgrid=True, gridcolor='#f0f0f0',
                 title_text='Ratio (%)', ticksuffix='%',
                 range=[0, min(300, dash_df['ratio_pct'].max() * 1.15)] if len(dash_df) > 0 else [0, 200],
                 row=3, col=1)
fig.update_yaxes(showgrid=True, gridcolor='#f0f0f0',
                 title_text='Art×2j', row=4, col=1)

st.plotly_chart(fig, use_container_width=True)

# ═══════════════════════════════════════════════════════════════
# TABLEAU DÉTAILLÉ
# ═══════════════════════════════════════════════════════════════
st.divider()
section_header("📋", "Détail jour par jour")

with st.expander("📅 Voir le tableau complet", expanded=False):
    table_df = dash_df[['date_fr', 'jour_semaine', 'yhat', 'yhat_lower', 'yhat_upper',
                         'ca_prevu', 'marge_prevue', 'commande_recommandee', 'statut']].copy()
    table_df.columns = ['Date', 'Jour', 'Demande prévue', 'Min', 'Max',
                         'CA prévu (€)', 'Marge (€)', 'Commande (art)', 'Statut']

    def color_statut(val):
        colors = {
            'RUPTURE'  : 'background-color: #FFE5E5; color: #E24B4A; font-weight: bold',
            'VIGILANCE': 'background-color: #FFF4E0; color: #EF9F27; font-weight: bold',
            'NORMAL'   : 'background-color: #F0FFF0; color: #639922; font-weight: bold',
            'SURSTOCK' : 'background-color: #E8F4FF; color: #378ADD; font-weight: bold',
            'FERMÉ'    : 'background-color: #F5F5F5; color: #888888',
        }
        return colors.get(val, '')

    styled = table_df.style.applymap(color_statut, subset=['Statut'])
    st.dataframe(styled, use_container_width=True, hide_index=True)

# ═══════════════════════════════════════════════════════════════
# RECOMMANDATIONS
# ═══════════════════════════════════════════════════════════════
st.divider()
section_header("💡", "Recommandations Opérationnelles")

col1, col2 = st.columns(2)

with col1:
    st.markdown(f"""
    <div style="background:linear-gradient(135deg,#FFF5F5,#FFE8E8);
                border:2px solid #E24B4A;border-radius:14px;padding:20px;">
        <h4 style="color:#E24B4A;margin:0 0 12px 0">⚠️ Risques identifiés</h4>
        <ul style="color:#555;line-height:1.8;margin:0">
            <li><b>{kpi['RUPTURE']} jours</b> à risque de rupture stock</li>
            <li>CA à risque : <b>{ca_risque:,.0f} €</b> ({ca_risque/ca_total_prevu*100:.1f}% du CA prévu)</li>
            <li>Pic absolu prévu le <b>{pic_date}</b> → <b>{pic_val} articles</b></li>
            <li>MDAPE Prophet : <b>{mdape_cv:.1f}%</b> — précision à surveiller</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown(f"""
    <div style="background:linear-gradient(135deg,#F0FFF5,#E0FFE8);
                border:2px solid #27AE60;border-radius:14px;padding:20px;">
        <h4 style="color:#27AE60;margin:0 0 12px 0">✅ Actions recommandées</h4>
        <ul style="color:#555;line-height:1.8;margin:0">
            <li>Renforcer les commandes <b>48h avant</b> les jours de pic</li>
            <li>Anticiper <b>Juillet–Août</b> (saison touristique)</li>
            <li>Activer les offres groupées pour écouler les surplus</li>
            <li>Surveiller le <b>13/08/2026</b> — pic absolu de la saison</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)

# ── Footer ────────────────────────────────────────────────────
st.markdown("""
<div style="text-align:center;color:#9E8A78;font-size:.78rem;
            padding:24px 0 8px;border-top:1px solid rgba(200,134,10,0.12);margin-top:32px;">
    📦 Section 8 · Dashboard Alertes Stock · Modèle Prophet (Meta) · Saison Été 2026
</div>
""", unsafe_allow_html=True)
