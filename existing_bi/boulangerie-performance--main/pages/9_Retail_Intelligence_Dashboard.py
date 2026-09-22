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
    page_title="Retail Intelligence Dashboard — Boulangerie Le Croisic",
    page_icon="🥐",
    layout="wide"
)
inject_bakery_style()
bakery_sidebar_logo()

# ── Palette ─────────────────────────────────────────────────
C1      = '#8B3A0F'
C2      = '#C8860A'
C3      = '#E6A817'
BG      = '#FDF6EC'
PALETTE = ['#8B3A0F','#C8860A','#E6A817','#27AE60','#3498DB',
           '#8E44AD','#E74C3C','#1ABC9C','#F39C12','#2C3E50']

# ── Chargement des données ───────────────────────────────────
@st.cache_data
def load_data():
    path = 'retail_data.pkl'
    if not os.path.exists(path):
        path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'retail_data.pkl')
    with open(path, 'rb') as f:
        return pickle.load(f)

data          = load_data()
df            = data['df_clean']
df_pen        = data['df_penetration']
df_macro      = data['df_macro']
regles        = data['regles']
forecast_14j  = data['forecast_14j'].copy()
daily_data    = data['daily_data'].copy()
ca_mensuel    = data['ca_mensuel'].copy()
if 'total_revenue' not in ca_mensuel.columns and 'ca' in ca_mensuel.columns:
    ca_mensuel['total_revenue'] = ca_mensuel['ca']
mdape_cv      = float(data['mdape_cv'])

# ── KPIs globaux ─────────────────────────────────────────────
total_ca        = df['total_revenue'].sum()
nb_tickets      = df['ticket_number'].nunique()
panier_moyen    = total_ca / nb_tickets
jours_actifs    = df['date'].nunique()
tickets_par_jour= nb_tickets / jours_actifs
nb_produits     = df['article'].nunique()
ca_2024         = df[df['date'].dt.year == 2024]['total_revenue'].sum()
ca_2025         = df[df['date'].dt.year == 2025]['total_revenue'].sum()
croissance_pct  = (ca_2025 - ca_2024) / ca_2024 * 100

# ── Préparation données ───────────────────────────────────────

# Top 10 produits
top10 = (df.groupby('article')['total_revenue']
         .sum()
         .sort_values(ascending=False)
         .head(10)
         .reset_index())
top10['part'] = top10['total_revenue'] / total_ca * 100

# CA moyen par jour de la semaine
jours_order = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
jours_fr_map = {
    'Monday':'Lundi','Tuesday':'Mardi','Wednesday':'Mercredi',
    'Thursday':'Jeudi','Friday':'Vendredi','Saturday':'Samedi','Sunday':'Dimanche'
}
daily_data['day_name'] = daily_data['date'].dt.day_name()
ca_moy_j    = daily_data.groupby('day_name')['ca_jour'].mean().reindex(jours_order)
labels_jours = [jours_fr_map[d] for d in jours_order]

# Top 15 pénétration
top15_pen   = df_pen.head(15).copy()
pen_colors  = [C1 if s == 'Produit Phare (Dominant)'
               else C2 if s == 'Leader (Indispensable)'
               else C3
               for s in top15_pen['statut_strategique']]

# Top 10 velocity
if 'stock_securite' not in df_macro.columns:
    df_macro['stock_securite'] = (df_macro['daily_velocity'] * 1.5).round(0)
if 'ratio_touristic' not in df_macro.columns:
    df_macro['ratio_touristic'] = 1.8

top10_vel   = df_macro.sort_values('daily_velocity', ascending=False).head(10).reset_index(drop=True)
vel_colors  = [C1 if v == top10_vel['daily_velocity'].max()
               else C2 if v >= top10_vel['daily_velocity'].quantile(0.6)
               else C3
               for v in top10_vel['daily_velocity']]

# Top 10 règles apriori (lift)
top10_reg   = regles.sort_values('lift', ascending=False).head(10).reset_index(drop=True)
top10_reg['label'] = (top10_reg['antecedents_str']
                      + ' → '
                      + top10_reg['consequents_str'])
lift_max    = top10_reg['lift'].max()
lift_colors = [C1 if v == lift_max
               else C2 if v >= top10_reg['lift'].quantile(0.6)
               else C3
               for v in top10_reg['lift']]

# Prévision 14j
moy_hist    = float(daily_data['nb_articles'].mean())
f14         = forecast_14j.copy()
f14['bar_color'] = np.where(f14['yhat'] > moy_hist * 1.1, C1,
                   np.where(f14['yhat'] < moy_hist * 0.9, '#378ADD', C2))

# CA par catégorie
cat_df = (df.groupby('category')['total_revenue']
          .sum()
          .sort_values(ascending=False)
          .reset_index())

# ═══════════════════════════════════════════════════════════════
# TITRE
# ═══════════════════════════════════════════════════════════════
st.markdown("# 🥐 Retail Intelligence Dashboard")
st.markdown("### Boulangerie Le Croisic · Jan 2024 → Déc 2025 · Vue Globale")
st.divider()

# ── KPI Cards ────────────────────────────────────────────────
c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("💶 CA Total",         f"{total_ca/1000:.1f} k€")
c2.metric("🧾 Tickets",          f"{nb_tickets:,}")
c3.metric("🛒 Panier moyen",     f"{panier_moyen:.2f} €")
c4.metric("📅 Tickets / jour",   f"{tickets_par_jour:.0f}")
c5.metric("📈 Croissance CA",    f"+{croissance_pct:.1f}%")

st.divider()

# ═══════════════════════════════════════════════════════════════
# DASHBOARD 8 GRAPHIQUES
# ═══════════════════════════════════════════════════════════════
section_header("📊", "Dashboard Complet — 8 Analyses")

fig = make_subplots(
    rows=4, cols=2,
    subplot_titles=[
        '📈 CA Mensuel 2024–2025',
        '🏆 Top 10 Produits par CA',
        '📅 CA Moyen par Jour d\'Ouverture',
        '🎯 Taux de Pénétration — Top 15',
        '⚡ Sales Velocity — Top 10',
        '🛒 Market Basket — Top 10 Règles (Lift)',
        '🔮 Prévision Prophet 14 Jours (Jan 2026)',
        '🏷️ CA par Catégorie',
    ],
    specs=[
        [{"type": "xy"},     {"type": "xy"}],
        [{"type": "xy"},     {"type": "xy"}],
        [{"type": "xy"},     {"type": "xy"}],
        [{"type": "xy"},     {"type": "domain"}],
    ],
    vertical_spacing=0.10,
    horizontal_spacing=0.10,
)

# ── G1 — CA Mensuel ─────────────────────────────────────────
fig.add_trace(go.Scatter(
    x=ca_mensuel['date'], y=ca_mensuel['total_revenue'],
    mode='lines+markers', name='CA Mensuel',
    line=dict(color=C1, width=2.5),
    marker=dict(size=5, color=C2),
    fill='tozeroy', fillcolor='rgba(200,134,10,0.10)',
    hovertemplate='%{x|%b %Y} : <b>%{y:,.0f} €</b><extra></extra>',
    showlegend=False,
), row=1, col=1)
moy_ca = float(ca_mensuel['total_revenue'].mean())
fig.add_hline(
    y=moy_ca, line_dash='dot', line_color=C3, line_width=1.5,
    annotation_text=f'Moy : {moy_ca:,.0f} €',
    annotation_position='top right',
    annotation_font=dict(size=9, color=C3),
    row=1, col=1,
)

# ── G2 — Top 10 Produits ─────────────────────────────────────
colors_t10 = [C1 if i < 3 else C2 if i < 6 else C3
              for i in range(len(top10))]
fig.add_trace(go.Bar(
    x=top10['total_revenue'],
    y=top10['article'],
    orientation='h',
    marker_color=colors_t10,
    marker_line_width=0,
    text=[f"{p:.1f}%" for p in top10['part']],
    textposition='outside',
    hovertemplate='<b>%{y}</b><br>%{x:,.0f} €<extra></extra>',
    showlegend=False,
), row=1, col=2)

# ── G3 — CA par Jour ─────────────────────────────────────────
colors_j = [C1 if v == ca_moy_j.max() else C2 for v in ca_moy_j.values]
fig.add_trace(go.Bar(
    x=labels_jours,
    y=ca_moy_j.values,
    marker_color=colors_j,
    marker_line_width=0,
    hovertemplate='<b>%{x}</b> : %{y:,.0f} €<extra></extra>',
    showlegend=False,
), row=2, col=1)

# ── G4 — Pénétration ─────────────────────────────────────────
fig.add_trace(go.Bar(
    x=top15_pen['penetration_rate_%'],
    y=top15_pen['article'],
    orientation='h',
    marker_color=pen_colors,
    marker_line_width=0,
    text=[f"{v:.1f}%" for v in top15_pen['penetration_rate_%']],
    textposition='outside',
    hovertemplate='<b>%{y}</b> : %{x:.2f}%<extra></extra>',
    showlegend=False,
), row=2, col=2)

# ── G5 — Velocity ─────────────────────────────────────────────
fig.add_trace(go.Bar(
    x=top10_vel['daily_velocity'],
    y=top10_vel['article'],
    orientation='h',
    marker_color=vel_colors,
    marker_line_width=0,
    text=[f"{v:.1f}" for v in top10_vel['daily_velocity']],
    textposition='outside',
    hovertemplate='<b>%{y}</b> : %{x:.1f} u/j<extra></extra>',
    showlegend=False,
), row=3, col=1)

# ── G6 — Market Basket ────────────────────────────────────────
fig.add_trace(go.Bar(
    x=top10_reg['lift'],
    y=top10_reg['label'],
    orientation='h',
    marker_color=lift_colors,
    marker_line_width=0,
    text=[f"L={l:.2f}" for l in top10_reg['lift']],
    textposition='outside',
    hovertemplate='<b>%{y}</b><br>Lift : %{x:.2f}<extra></extra>',
    showlegend=False,
), row=3, col=2)
fig.add_vline(x=1.0, line_dash='dot', line_color='#888888',
              line_width=1.2, row=3, col=2)

# ── G7 — Prévision 14j ────────────────────────────────────────
fig.add_trace(go.Scatter(
    x=f14['ds'], y=f14['yhat_upper'],
    mode='lines', line=dict(width=0),
    showlegend=False, hoverinfo='skip',
), row=4, col=1)
fig.add_trace(go.Scatter(
    x=f14['ds'], y=f14['yhat_lower'].clip(0),
    mode='lines', line=dict(width=0),
    fill='tonexty', fillcolor='rgba(200,134,10,0.15)',
    showlegend=False, hoverinfo='skip',
), row=4, col=1)
fig.add_trace(go.Bar(
    x=f14['ds'], y=f14['yhat'],
    marker_color=f14['bar_color'].tolist(),
    marker_line_width=0,
    hovertemplate='%{x|%d/%m} : <b>%{y} art</b><extra></extra>',
    showlegend=False,
), row=4, col=1)
fig.add_hline(
    y=moy_hist, line_dash='dot', line_color=C3, line_width=1.5,
    annotation_text=f'Moy. hist : {moy_hist:.0f}',
    annotation_position='top right',
    annotation_font=dict(size=9, color=C3),
    row=4, col=1,
)

# ── G8 — Donut Catégories ────────────────────────────────────
fig.add_trace(go.Pie(
    labels=cat_df['category'],
    values=cat_df['total_revenue'],
    hole=0.42,
    marker=dict(
        colors=PALETTE[:len(cat_df)],
        line=dict(color='white', width=2)
    ),
    textinfo='label+percent',
    textfont=dict(size=8),
    hovertemplate='<b>%{label}</b><br>%{value:,.0f} €<br>%{percent}<extra></extra>',
    showlegend=False,
), row=4, col=2)

# ── Layout global ─────────────────────────────────────────────
fig.update_layout(
    height=1450,
    plot_bgcolor='white',
    paper_bgcolor=BG,
    font=dict(family='Arial, sans-serif', size=10, color='#3B1A08'),
    hovermode='closest',
    margin=dict(t=60, b=40, l=60, r=40),
)
fig.update_xaxes(tickformat='%b %Y', tickangle=-30, row=1, col=1)
fig.update_yaxes(autorange='reversed', row=1, col=2)
fig.update_yaxes(autorange='reversed', row=2, col=2)
fig.update_yaxes(autorange='reversed', row=3, col=1)
fig.update_yaxes(autorange='reversed', row=3, col=2)
fig.update_xaxes(tickformat='%d/%m', tickangle=-40, row=4, col=1)
for r in range(1, 5):
    for c in range(1, 3):
        fig.update_xaxes(showgrid=True, gridcolor='#f0ece4', gridwidth=0.5, row=r, col=c)
        fig.update_yaxes(showgrid=True, gridcolor='#f0ece4', gridwidth=0.5, row=r, col=c)

st.plotly_chart(fig, use_container_width=True)

# ═══════════════════════════════════════════════════════════════
# SYNTHÈSE DES INSIGHTS
# ═══════════════════════════════════════════════════════════════
st.divider()
section_header("🔍", "Synthèse des Insights Clés")

col1, col2, col3 = st.columns(3)

with col1:
    st.markdown(f"""
    <div style="background:linear-gradient(135deg,#FFF8F0,#FDEBD0);
                border:2px solid {C2};border-radius:14px;padding:18px;">
        <h4 style="color:{C1};margin:0 0 10px 0">🥖 Produits & Mix</h4>
        <ul style="color:#555;line-height:1.9;margin:0;font-size:0.88rem">
            <li><b>Tradition Baguette</b> : 17,3% du CA total</li>
            <li>Présente dans <b>43,9%</b> des tickets</li>
            <li><b>Formule Sandwich</b> : 2ème contributeur CA</li>
            <li><b>Buche 6P & 8P</b> : pics saisonniers forts</li>
            <li>{nb_produits} références actives analysées</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)

with col2:
    top_paire = top10_reg.iloc[0]
    st.markdown(f"""
    <div style="background:linear-gradient(135deg,#F0F8FF,#E0EEFF);
                border:2px solid #3498DB;border-radius:14px;padding:18px;">
        <h4 style="color:#2471A3;margin:0 0 10px 0">🛒 Associations d'Achat</h4>
        <ul style="color:#555;line-height:1.9;margin:0;font-size:0.88rem">
            <li>Paire la plus forte : <b>{top_paire['antecedents_str']}</b></li>
            <li>→ <b>{top_paire['consequents_str']}</b> (Lift={top_paire['lift']:.2f})</li>
            <li><b>BOULE 200G ↔ COUPE</b> : Lift = 2.99</li>
            <li>Opportunité : <b>offres groupées</b></li>
            <li>Placement stratégique en magasin</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)

with col3:
    st.markdown(f"""
    <div style="background:linear-gradient(135deg,#F0FFF4,#DCFFE4);
                border:2px solid #27AE60;border-radius:14px;padding:18px;">
        <h4 style="color:#1E8449;margin:0 0 10px 0">📈 Performance Globale</h4>
        <ul style="color:#555;line-height:1.9;margin:0;font-size:0.88rem">
            <li>CA total : <b>{total_ca/1000:.1f} k€</b> sur 2 ans</li>
            <li>Croissance : <b>+{croissance_pct:.1f}%</b> (volume > prix)</li>
            <li>Jeudi = pic hebdomadaire de CA</li>
            <li>Été (Juil–Août) : mois les plus forts</li>
            <li>MDAPE Prophet : <b>{mdape_cv:.1f}%</b></li>
        </ul>
    </div>
    """, unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════════
# ANALYSES DÉTAILLÉES PAR SECTION (tabs)
# ═══════════════════════════════════════════════════════════════
st.divider()
section_header("🔬", "Analyses Détaillées")

tab1, tab2, tab3, tab4 = st.tabs([
    "📈 CA Mensuel",
    "🎯 Pénétration",
    "⚡ Velocity",
    "🛒 Market Basket",
])

with tab1:
    col_a, col_b = st.columns([2, 1])
    with col_a:
        fig_ca = go.Figure()
        fig_ca.add_trace(go.Bar(
            x=ca_mensuel['date'], y=ca_mensuel['total_revenue'],
            marker_color=[C1 if m in [6,7,8,12] else C2
                          for m in ca_mensuel['date'].dt.month],
            hovertemplate='%{x|%b %Y} : <b>%{y:,.0f} €</b><extra></extra>',
        ))
        fig_ca.add_hline(y=moy_ca, line_dash='dot', line_color=C3, line_width=2,
                         annotation_text=f'Moyenne : {moy_ca:,.0f} €',
                         annotation_position='top left')
        fig_ca.update_layout(
            height=350, plot_bgcolor='white', paper_bgcolor=BG,
            margin=dict(t=20, b=30, l=50, r=20),
            xaxis=dict(tickformat='%b %Y', tickangle=-30),
            showlegend=False,
        )
        st.plotly_chart(fig_ca, use_container_width=True)

    with col_b:
        best_month = ca_mensuel.loc[ca_mensuel['total_revenue'].idxmax()]
        worst_month = ca_mensuel.loc[ca_mensuel['total_revenue'].idxmin()]
        st.markdown(f"""
        <div style="background:white;border:1px solid #E8C97A;border-radius:12px;padding:16px">
            <p style="margin:0 0 8px;font-weight:700;color:{C1}">📊 Statistiques CA</p>
            <hr style="border-top:1px dashed #D4A056;margin:8px 0">
            <p style="margin:4px 0;font-size:0.85rem"><b>Meilleur mois :</b><br>
               {best_month['date'].strftime('%b %Y')} → {best_month['total_revenue']:,.0f} €</p>
            <p style="margin:4px 0;font-size:0.85rem"><b>Mois le plus faible :</b><br>
               {worst_month['date'].strftime('%b %Y')} → {worst_month['total_revenue']:,.0f} €</p>
            <p style="margin:4px 0;font-size:0.85rem"><b>Moyenne mensuelle :</b><br>
               {moy_ca:,.0f} €</p>
            <p style="margin:4px 0;font-size:0.85rem"><b>CA 2024 :</b> {ca_2024/1000:.1f} k€</p>
            <p style="margin:4px 0;font-size:0.85rem"><b>CA 2025 :</b> {ca_2025/1000:.1f} k€</p>
            <p style="margin:4px 0;font-size:0.85rem"><b>Croissance :</b>
               <span style="color:#27AE60;font-weight:700">+{croissance_pct:.1f}%</span></p>
        </div>
        """, unsafe_allow_html=True)

with tab2:
    st.markdown("**Top 15 produits par taux de pénétration**")
    col_a, col_b = st.columns([2, 1])
    with col_a:
        fig_pen = go.Figure(go.Bar(
            x=top15_pen['penetration_rate_%'],
            y=top15_pen['article'],
            orientation='h',
            marker_color=pen_colors,
            text=[f"{v:.1f}%" for v in top15_pen['penetration_rate_%']],
            textposition='outside',
            hovertemplate='<b>%{y}</b> : %{x:.2f}%<extra></extra>',
        ))
        fig_pen.update_layout(
            height=420, plot_bgcolor='white', paper_bgcolor=BG,
            margin=dict(t=10, b=20, l=160, r=60),
            yaxis=dict(autorange='reversed'),
            showlegend=False,
        )
        st.plotly_chart(fig_pen, use_container_width=True)
    with col_b:
        statuts_count = df_pen['statut_strategique'].value_counts()
        st.markdown("**Répartition des statuts :**")
        colors_statut = {
            'Produit Phare (Dominant)': C1,
            'Leader (Indispensable)'  : C2,
            'Produit Coeur (Core)'    : C3,
            'Produit Regulier'        : '#27AE60',
            'Niche / A surveiller'    : '#3498DB',
        }
        for statut, count in statuts_count.items():
            color = colors_statut.get(statut, '#888')
            st.markdown(f"""
            <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
                <div style="width:12px;height:12px;background:{color};border-radius:50%"></div>
                <span style="font-size:0.82rem;color:#333">{statut}: <b>{count}</b></span>
            </div>
            """, unsafe_allow_html=True)

with tab3:
    st.markdown("**Top 10 produits par vitesse de vente quotidienne**")
    fig_vel = go.Figure(go.Bar(
        x=top10_vel['daily_velocity'],
        y=top10_vel['article'],
        orientation='h',
        marker_color=vel_colors,
        text=[f"{v:.1f} u/j" for v in top10_vel['daily_velocity']],
        textposition='outside',
        hovertemplate='<b>%{y}</b> : %{x:.1f} unités/jour<extra></extra>',
    ))
    fig_vel.update_layout(
        height=380, plot_bgcolor='white', paper_bgcolor=BG,
        margin=dict(t=10, b=20, l=160, r=80),
        yaxis=dict(autorange='reversed'),
        showlegend=False,
    )
    st.plotly_chart(fig_vel, use_container_width=True)

    col_a, col_b, col_c = st.columns(3)
    col_a.metric("🏆 N°1 Velocity",  top10_vel.iloc[0]['article'],
                 f"{top10_vel.iloc[0]['daily_velocity']:.1f} u/jour")
    col_b.metric("📦 Stock sécu N°1",
                 f"{top10_vel.iloc[0]['stock_securite']:.0f} u",
                 "unités de sécurité")
    col_c.metric("🌞 Boost touristique",
                 f"×{top10_vel.iloc[0]['ratio_touristic']:.1f}",
                 "vs période normale")

with tab4:
    st.markdown("**Top 10 règles d'association (triées par Lift)**")
    fig_mba = go.Figure(go.Bar(
        x=top10_reg['lift'],
        y=top10_reg['label'],
        orientation='h',
        marker_color=lift_colors,
        text=[f"Lift={l:.2f} | Conf={c:.1%}" for l, c in
              zip(top10_reg['lift'], top10_reg['confidence'])],
        textposition='outside',
        hovertemplate='<b>%{y}</b><br>Lift : %{x:.2f}<extra></extra>',
    ))
    fig_mba.add_vline(x=1.0, line_dash='dot', line_color='#888', line_width=1.5,
                      annotation_text='Lift = 1 (indépendance)',
                      annotation_position='top right')
    fig_mba.update_layout(
        height=420, plot_bgcolor='white', paper_bgcolor=BG,
        margin=dict(t=10, b=20, l=300, r=120),
        yaxis=dict(autorange='reversed'),
        showlegend=False,
    )
    st.plotly_chart(fig_mba, use_container_width=True)

    st.info(f"""
    💡 **Lecture du Lift :** Un Lift > 1 indique une association positive.
    La paire la plus forte ({top10_reg.iloc[0]['antecedents_str']} → {top10_reg.iloc[0]['consequents_str']})
    a un Lift de **{top10_reg.iloc[0]['lift']:.2f}** — ces produits sont achetés ensemble
    **{top10_reg.iloc[0]['lift']:.1f}× plus souvent** qu'attendu par hasard.
    """)

# ── Footer ────────────────────────────────────────────────────
st.markdown("""
<div style="text-align:center;color:#9E8A78;font-size:.78rem;
            padding:24px 0 8px;border-top:1px solid rgba(200,134,10,0.12);margin-top:32px;">
    🥐 Retail Intelligence Dashboard · Vue Globale · Jan 2024 → Déc 2025 · PFE 2026 — Mariem Dridi
</div>
""", unsafe_allow_html=True)
