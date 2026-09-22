import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from style import inject_bakery_style, section_header, bakery_sidebar_logo

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
import pickle

st.set_page_config(page_title="Matrice de Décision", page_icon="🎯", layout="wide")
inject_bakery_style()
bakery_sidebar_logo()

# ════════════════════════════════════════════
# CONSTANTES
# ════════════════════════════════════════════
C1  = '#8B3A0F'
C2  = '#C8860A'
C3  = '#E6A817'
BG  = '#FDF6EC'
TXT = '#A0522D'

COLOR_MATRICE = {
    'Star (Indispensable)'  : '#8B3A0F',
    'Générateur de Trafic'  : '#C8860A',
    'Niche (Rentable)'      : '#27AE60',
    'Stock Dormant (Dead)'  : '#AAAAAA',
}

ICON_MATRICE = {
    'Star (Indispensable)'  : '⭐',
    'Générateur de Trafic'  : '🚀',
    'Niche (Rentable)'      : '💎',
    'Stock Dormant (Dead)'  : '💤',
}

ACTION_MATRICE = {
    'Star (Indispensable)'  : 'Priorité critique — zéro rupture + alerte horaire',
    'Générateur de Trafic'  : 'Visibilité — tête de gondole, stock modéré',
    'Niche (Rentable)'      : 'Stocker pour clients fidèles — gros volumes',
    'Stock Dormant (Dead)'  : 'Liquidation — arrêter commandes',
}

ORDRE_CAT = [
    'Star (Indispensable)',
    'Générateur de Trafic',
    'Niche (Rentable)',
    'Stock Dormant (Dead)',
]

# ════════════════════════════════════════════
# CHARGEMENT & CALCUL
# ════════════════════════════════════════════
@st.cache_data
def load_and_compute():
    with open('retail_data.pkl', 'rb') as f:
        d = pickle.load(f)

    df          = d['df_clean'].copy()
    df_pen      = d['df_penetration'].copy()
    df_pen_orig = df_pen.copy()

    jours_actifs = df['date'].nunique()
    df_macro = (df.groupby('article')
                .agg(qte_totale=('quantity', 'sum'),
                     std_vel=('quantity', 'std'))
                .reset_index())
    df_macro['daily_velocity'] = (df_macro['qte_totale'] / jours_actifs).round(2)
    df_macro = df_macro.drop(columns=['qte_totale', 'std_vel'])

    ca = (df.groupby('article')['total_revenue']
          .sum().reset_index()
          .rename(columns={'total_revenue': 'ca_total'}))

    cat_map = (df[['article', 'category']]
               .drop_duplicates()
               .query("category != 'A CLASSIFIER'"))

    df_matrix = df_pen[['article', 'penetration_rate_%', 'statut_strategique']].merge(
        df_macro[['article', 'daily_velocity']], on='article', how='inner'
    ).merge(ca, on='article', how='left').merge(cat_map, on='article', how='left')

    SEUIL_VEL_CORE     = 2.0
    SEUIL_VEL_REGULIER = 1.0
    SEUIL_VEL_NICHE    = 1.0

    def mapper_matrice(row):
        statut = row['statut_strategique']
        vel    = row['daily_velocity']
        if statut in ['Produit Phare (Dominant)', 'Leader (Indispensable)']:
            return 'Star (Indispensable)'
        elif statut == 'Produit Coeur (Core)':
            return 'Star (Indispensable)' if vel >= SEUIL_VEL_CORE else 'Générateur de Trafic'
        elif statut == 'Produit Regulier':
            return 'Générateur de Trafic' if vel >= SEUIL_VEL_REGULIER else 'Niche (Rentable)'
        else:
            return 'Niche (Rentable)' if vel >= SEUIL_VEL_NICHE else 'Stock Dormant (Dead)'

    df_matrix['categorie_matrice'] = df_matrix.apply(mapper_matrice, axis=1)

    ca_global = df['total_revenue'].sum()
    summary = (df_matrix.groupby('categorie_matrice')
               .agg(nb_produits=('article',            'count'),
                    pen_moyenne=('penetration_rate_%', 'mean'),
                    vel_moyenne=('daily_velocity',     'mean'),
                    ca_total   =('ca_total',           'sum'))
               .round(2))
    summary = summary.reindex(ORDRE_CAT)
    summary['nb_produits'] = summary['nb_produits'].fillna(0).astype(int)
    summary['pen_moyenne'] = summary['pen_moyenne'].fillna(0.0)
    summary['vel_moyenne'] = summary['vel_moyenne'].fillna(0.0)
    summary['ca_total'] = summary['ca_total'].fillna(0.0)
    summary['part_ca_%'] = (summary['ca_total'] / ca_global * 100).fillna(0.0).round(1)

    return df_matrix, summary, ca_global, jours_actifs


df_matrix, summary, ca_global, jours_actifs = load_and_compute()

# ════════════════════════════════════════════
# EN-TÊTE
# ════════════════════════════════════════════
st.markdown("""
<div style="background:linear-gradient(135deg,#8B3A0F,#C8860A);
     border-radius:12px;padding:22px 28px;margin-bottom:24px;">
  <h1 style="color:white;margin:0;font-size:26px;
       font-family:'Playfair Display',serif;">
    🎯 Matrice de Décision — Pénétration × Velocity
  </h1>
  <p style="color:rgba(255,255,255,0.82);margin:6px 0 0;font-size:13px;">
    Boulangerie Le Croisic · Croisement comportemental & logistique ·
    Jan 2024 → Déc 2025
  </p>
</div>""", unsafe_allow_html=True)

st.markdown("""
> 🎯 **De l'analyse à la décision.** La matrice croise le **Taux de Pénétration**
> (popularité comportementale) et la **Sales Velocity** (vitesse d'écoulement)
> pour classifier chaque produit en 4 catégories stratégiques actionnables.
""")

# ════════════════════════════════════════════
# KPI CARDS
# ════════════════════════════════════════════
kpi_cols = st.columns(4)
for i, cat in enumerate(ORDRE_CAT):
    row  = summary.loc[cat]
    col  = COLOR_MATRICE[cat]
    icon = ICON_MATRICE[cat]
    kpi_cols[i].markdown(f"""
    <div style="background:white;border-radius:12px;padding:18px 16px;
         border-top:5px solid {col};
         box-shadow:0 4px 16px rgba(0,0,0,0.08);text-align:center;">
      <div style="font-size:28px;margin-bottom:4px;">{icon}</div>
      <div style="font-size:12px;color:{col};font-weight:700;
           text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
        {cat}</div>
      <div style="font-size:36px;font-weight:700;color:#222;
           font-family:'Playfair Display',serif;line-height:1;">
        {int(row['nb_produits'])}</div>
      <div style="font-size:11px;color:#888;margin-top:4px;">produits</div>
      <div style="margin-top:10px;padding-top:10px;
           border-top:1px solid #f0e8dc;">
        <span style="font-size:16px;font-weight:700;color:{col};">
          {row['part_ca_%']:.1f}%</span>
        <span style="font-size:10px;color:#aaa;"> du CA</span>
      </div>
    </div>""", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# ════════════════════════════════════════════
# TABS
tab1, tab2, tab4 = st.tabs([
    "🗺️ Carte Stratégique",
    "📊 Analyse par Catégorie",
    "💡 Synthèse & Actions",
])
# ─────────────────────────────────────────────────────────────
# TAB 1 — HEATMAP STRATÉGIQUE
# ─────────────────────────────────────────────────────────────
with tab1:
    st.markdown("""
    <div style="background:linear-gradient(135deg,#8B3A0F,#C8860A);
         border-radius:12px;padding:18px 24px;margin-bottom:24px;">
      <h2 style="color:white;margin:0;font-size:20px;
           font-family:'Playfair Display',serif;">
        🗺️ Carte Stratégique — Répartition par Catégorie × Quadrant
      </h2>
      <p style="color:rgba(255,255,255,0.80);margin:6px 0 0;font-size:12px;">
        Chaque cellule = nombre de produits · Couleur = intensité CA · 
        Survolez pour les détails complets
      </p>
    </div>""", unsafe_allow_html=True)

    leg4 = st.columns(4)
    quadrant_desc = [
        ("⭐", "Star",          "Pén. haute + Vel. haute", "Piliers du CA",          C1),
        ("🚀", "Générateur",    "Pén. haute + Vel. faible","Attire les clients",      C2),
        ("💎", "Niche",         "Pén. faible + Vel. haute","Marges élevées",         '#27AE60'),
        ("💤", "Dormant",       "Pén. faible + Vel. faible","À réévaluer",           '#AAAAAA'),
    ]
    for col_ui, (icon, titre, sous, action, color) in zip(leg4, quadrant_desc):
        col_ui.markdown(f"""
        <div style="background:white;border-radius:10px;padding:12px 14px;
             border-top:4px solid {color};
             box-shadow:0 2px 8px rgba(0,0,0,0.07);text-align:center;">
          <div style="font-size:20px;">{icon}</div>
          <div style="font-weight:700;color:{color};font-size:13px;
               margin:4px 0;">{titre}</div>
          <div style="font-size:10px;color:#888;">{sous}</div>
          <div style="font-size:10px;color:#555;font-weight:600;
               margin-top:4px;">→ {action}</div>
        </div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    df_heat = df_matrix.copy()
    pivot_nb  = df_heat.groupby(['category','categorie_matrice'])['article'].count().unstack(fill_value=0)
    pivot_ca  = df_heat.groupby(['category','categorie_matrice'])['ca_total'].sum().unstack(fill_value=0)
    pivot_pen = df_heat.groupby(['category','categorie_matrice'])['penetration_rate_%'].mean().unstack(fill_value=0)
    pivot_vel = df_heat.groupby(['category','categorie_matrice'])['daily_velocity'].mean().unstack(fill_value=0)

    quad_cols = [c for c in ORDRE_CAT if c in pivot_nb.columns]
    pivot_nb  = pivot_nb.reindex(columns=quad_cols, fill_value=0)
    pivot_ca  = pivot_ca.reindex(columns=quad_cols, fill_value=0)
    pivot_pen = pivot_pen.reindex(columns=quad_cols, fill_value=0)
    pivot_vel = pivot_vel.reindex(columns=quad_cols, fill_value=0)

    cat_order = pivot_ca.sum(axis=1).sort_values(ascending=False).index.tolist()
    pivot_nb  = pivot_nb.loc[cat_order]
    pivot_ca  = pivot_ca.loc[cat_order]
    pivot_pen = pivot_pen.loc[cat_order]
    pivot_vel = pivot_vel.loc[cat_order]

    text_matrix = []
    for cat in cat_order:
        row_txt = []
        for quad in quad_cols:
            nb = int(pivot_nb.loc[cat, quad])
            ca = pivot_ca.loc[cat, quad]
            row_txt.append(f"<b>{nb}</b> produit{'s' if nb>1 else ''}<br>{ca:,.0f} €" if nb>0 else "")
        text_matrix.append(row_txt)

    hover_matrix = []
    for cat in cat_order:
        row_h = []
        for quad in quad_cols:
            nb  = int(pivot_nb.loc[cat, quad])
            ca  = pivot_ca.loc[cat, quad]
            pen = pivot_pen.loc[cat, quad]
            vel = pivot_vel.loc[cat, quad]
            row_h.append(
                f"<b>{cat}</b>  ×  <b>{quad}</b><br>━━━━━━━━━━━━━━━━━━<br>"
                f"Produits : <b>{nb}</b><br>CA total : <b>{ca:,.0f} €</b><br>"
                f"Pénétration moy. : <b>{pen:.2f}%</b><br>Velocity moy. : <b>{vel:.2f} u/j</b>"
            )
        hover_matrix.append(row_h)

    fig_heat = go.Figure(go.Heatmap(
        z=pivot_ca.values.tolist(),
        x=[f"{ICON_MATRICE.get(q,'•')} {q}" for q in quad_cols],
        y=cat_order,
        text=text_matrix,
        texttemplate="%{text}",
        hovertext=hover_matrix,
        hovertemplate="%{hovertext}<extra></extra>",
        colorscale=[[0,'#F5ECD7'],[0.25,'#E6A817'],[0.55,'#C8860A'],[0.80,'#8B3A0F'],[1,'#4A1A04']],
        showscale=True,
        colorbar=dict(title=dict(text="CA (€)",font=dict(size=11)),thickness=14,len=0.85,tickformat=',.0f'),
        xgap=4, ygap=4,
    ))

    star_col_idx = quad_cols.index(ORDRE_CAT[0]) if ORDRE_CAT[0] in quad_cols else None
    if star_col_idx is not None:
        fig_heat.add_shape(type='rect',
            x0=star_col_idx-0.5, x1=star_col_idx+0.5,
            y0=-0.5, y1=len(cat_order)-0.5,
            line=dict(color=C1, width=2.5, dash='dot'),
            fillcolor='rgba(0,0,0,0)')

    fig_heat.update_layout(
        height=max(500, len(cat_order)*46),
        plot_bgcolor='rgba(253,246,236,0.4)', paper_bgcolor='rgba(0,0,0,0)',
        font=dict(size=12),
        xaxis=dict(title='Quadrant Stratégique',title_font=dict(size=13),side='top',
                   tickfont=dict(size=12,color='#333'),showgrid=False),
        yaxis=dict(title='Catégorie Produit',title_font=dict(size=13),
                   tickfont=dict(size=11),showgrid=False,autorange='reversed'),
        margin=dict(t=80,b=40,l=160,r=20),
        hoverlabel=dict(bgcolor='white',bordercolor='rgba(139,58,15,0.3)',font=dict(size=12)),
    )
    st.plotly_chart(fig_heat, use_container_width=True)
    st.caption("📌 **Lecture** : Plus la cellule est foncée, plus le CA est élevé. La colonne ⭐ Star est encadrée — produits prioritaires absolus.")
    st.divider()

    st.markdown("##### 📊 Résumé par Quadrant")
    kpi_cols2 = st.columns(4)
    for col_ui, (icon, titre, sous, conseil, color) in zip(kpi_cols2, quadrant_desc):
        nb_prod = (df_heat['categorie_matrice']==titre).sum()
        ca_quad  = df_heat[df_heat['categorie_matrice']==titre]['ca_total'].sum()
        pct_ca   = ca_quad/df_heat['ca_total'].sum()*100 if df_heat['ca_total'].sum()>0 else 0
        pen_moy  = df_heat[df_heat['categorie_matrice']==titre]['penetration_rate_%'].mean()
        col_ui.markdown(f"""
        <div style="background:white;border-radius:10px;padding:16px;border-left:5px solid {color};
             box-shadow:0 2px 10px rgba(0,0,0,0.08);">
          <div style="font-size:24px;margin-bottom:6px;">{icon}</div>
          <div style="font-weight:700;color:{color};font-size:14px;">{titre}</div>
          <div style="font-size:11px;color:#888;margin-bottom:10px;">{sous}</div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid #f0f0f0;padding-top:10px;">
            <div style="text-align:center;">
              <div style="font-size:24px;font-weight:700;color:#222;font-family:'Playfair Display',serif;">{nb_prod}</div>
              <div style="font-size:10px;color:#AAA;">produits</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:16px;font-weight:700;color:{color};">{pct_ca:.1f}%</div>
              <div style="font-size:10px;color:#AAA;">du CA</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:14px;font-weight:700;color:#555;">{pen_moy:.1f}%</div>
              <div style="font-size:10px;color:#AAA;">pén. moy.</div>
            </div>
          </div>
          <div style="margin-top:10px;background:rgba(0,0,0,0.03);border-radius:6px;
               padding:8px;font-size:10.5px;color:#555;border-left:3px solid {color};">
            💡 {conseil}
          </div>
        </div>""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────
# TAB 2 — ANALYSE PAR CATÉGORIE
# ─────────────────────────────────────────────────────────────
with tab2:
    st.markdown("##### 📊 Analyse détaillée par catégorie stratégique")

    col_g1, col_g2 = st.columns(2)
    with col_g1:
        st.markdown("###### 🥧 Répartition du CA")
        fig_pie = go.Figure(go.Pie(
            labels=[f"{ICON_MATRICE[c]} {c}" for c in ORDRE_CAT],
            values=[summary.loc[c,'ca_total'] for c in ORDRE_CAT],
            marker_colors=[COLOR_MATRICE[c] for c in ORDRE_CAT],
            textinfo='label+percent', textfont=dict(size=11), hole=0.42,
            hovertemplate='<b>%{label}</b><br>CA : %{value:,.0f} EUR<br>Part : %{percent}<extra></extra>',
        ))
        fig_pie.add_annotation(
            text=f"<b>{ca_global:,.0f}</b><br><span style='font-size:10px'>EUR total</span>",
            x=0.5, y=0.5, showarrow=False, font=dict(size=13, color=C1))
        fig_pie.update_layout(height=360, plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)',
                              showlegend=False, margin=dict(t=20,b=20,l=20,r=20))
        st.plotly_chart(fig_pie, use_container_width=True)

    with col_g2:
        st.markdown("###### 📦 Nombre de produits par catégorie")
        nb_vals = [summary.loc[c,'nb_produits'] for c in ORDRE_CAT]
        fig_bar = go.Figure(go.Bar(
            x=[f"{ICON_MATRICE[c]} {c}" for c in ORDRE_CAT], y=nb_vals,
            marker_color=[COLOR_MATRICE[c] for c in ORDRE_CAT],
            text=[f"{int(v)} produits" for v in nb_vals],
            textposition='outside', textfont=dict(size=11, color=C1, family='Arial Black'),
            hovertemplate='<b>%{x}</b><br>%{y} produits<extra></extra>',
        ))
        fig_bar.update_layout(height=360, plot_bgcolor='rgba(253,246,236,0.5)', paper_bgcolor='rgba(0,0,0,0)',
                              xaxis=dict(tickfont=dict(size=10), gridcolor='rgba(0,0,0,0)'),
                              yaxis=dict(gridcolor='rgba(139,58,15,0.10)'),
                              margin=dict(t=40,b=20,l=10,r=20), showlegend=False)
        st.plotly_chart(fig_bar, use_container_width=True)

    st.divider()
    st.markdown("###### 🏆 Top 10 produits par catégorie")
    cat_sel = st.selectbox("Sélectionner une catégorie", ORDRE_CAT,
                           format_func=lambda x: f"{ICON_MATRICE[x]} {x}", key="cat_sel_tab2")
    df_cat = (df_matrix[df_matrix['categorie_matrice']==cat_sel]
              .sort_values('ca_total', ascending=True).tail(10).copy())

    if df_cat.empty:
        st.info("Aucun produit dans cette catégorie.")
    else:
        color_cat = COLOR_MATRICE[cat_sel]
        labels_cat = df_cat['article'].str.title().apply(lambda x: x[:25]+'…' if len(x)>25 else x)
        fig_cat = make_subplots(rows=1, cols=3,
                                subplot_titles=['CA Total (EUR)','Pénétration (%)','Velocity (u/j)'],
                                horizontal_spacing=0.10)
        for col_i, (col_name, fmt) in enumerate([
            ('ca_total','           {:.0f} EUR'),
            ('penetration_rate_%','{:.2f}%'),
            ('daily_velocity',    '{:.1f} u/j'),
        ], start=1):
            vals = df_cat[col_name].values
            fig_cat.add_trace(go.Bar(
                x=vals, y=list(labels_cat), orientation='h',
                marker_color=color_cat, marker_opacity=0.85,
                text=[fmt.format(v) for v in vals], textposition='outside',
                textfont=dict(size=9, color=color_cat),
                hovertemplate=f'<b>%{{y}}</b><br>{col_name} : %{{x}}<extra></extra>',
                showlegend=False,
            ), row=1, col=col_i)
            fig_cat.update_xaxes(gridcolor='rgba(139,58,15,0.08)', title_font=dict(size=9), row=1, col=col_i)
            fig_cat.update_yaxes(gridcolor='rgba(0,0,0,0)', tickfont=dict(size=9), row=1, col=col_i)
        for ann in fig_cat.layout.annotations:
            ann.update(font=dict(size=11, color=color_cat))
        fig_cat.update_layout(height=max(380, len(df_cat)*32), plot_bgcolor='rgba(253,246,236,0.5)',
                              paper_bgcolor='rgba(0,0,0,0)', margin=dict(t=50,b=30,l=10,r=100))
        st.plotly_chart(fig_cat, use_container_width=True)

    st.divider()
    st.markdown("###### 📋 Tableau résumé des 4 catégories")
    summary_disp = summary.copy().reset_index()
    summary_disp['Catégorie']    = summary_disp['categorie_matrice'].apply(lambda x: f"{ICON_MATRICE[x]} {x}")
    summary_disp['Nb Produits']  = summary_disp['nb_produits'].astype(int)
    summary_disp['Pén. Moyenne'] = summary_disp['pen_moyenne'].apply(lambda x: f"{x:.2f}%")
    summary_disp['Vel. Moyenne'] = summary_disp['vel_moyenne'].apply(lambda x: f"{x:.1f} u/j")
    summary_disp['CA Total']     = summary_disp['ca_total'].apply(lambda x: f"{x:,.0f} EUR")
    summary_disp['Part CA']      = summary_disp['part_ca_%'].apply(lambda x: f"{x:.1f}%")
    summary_disp['Action']       = summary_disp['categorie_matrice'].map(ACTION_MATRICE)
    st.dataframe(summary_disp[['Catégorie','Nb Produits','Pén. Moyenne',
                               'Vel. Moyenne','CA Total','Part CA','Action']],
                 use_container_width=True, hide_index=True)


# TAB 4 — SYNTHÈSE & ACTIONS
# ─────────────────────────────────────────────────────────────
with tab4:
    st.markdown("##### 💡 Synthèse Stratégique & Actions Recommandées")

    stars = summary.loc['Star (Indispensable)']
    total_prod = summary['nb_produits'].sum()
    pct_stars_prod = stars['nb_produits'] / total_prod * 100

    st.markdown(f"""
    <div style="background:linear-gradient(135deg,{C1}15,{C2}10);
         border:1px solid {C1}40;border-radius:12px;padding:20px 24px;margin-bottom:20px;">
      <h3 style="color:{C1};margin:0 0 8px;font-size:16px;">📐 La Règle des 10/90 — Confirmée</h3>
      <p style="color:#555;margin:0;font-size:13px;line-height:1.6;">
        <b style="color:{C1};">{int(stars['nb_produits'])} produits Stars</b>
        ({pct_stars_prod:.0f}% du catalogue) génèrent
        <b style="color:{C1};">{stars['part_ca_%']:.0f}% du CA</b>
        ({stars['ca_total']:,.0f} EUR).
      </p>
    </div>""", unsafe_allow_html=True)

    for cat in ORDRE_CAT:
        row   = summary.loc[cat]
        color = COLOR_MATRICE[cat]
        icon  = ICON_MATRICE[cat]
        action = ACTION_MATRICE[cat]
        details = {
            'Star (Indispensable)': [
                "🔴 Stock de sécurité non négociable (velocity + 1σ)",
                "⏰ Alerte horaire active — réassort avant heure de pic",
                "📍 Emplacement prioritaire en rayon — hauteur des yeux",
                "🚫 Tolérance zéro rupture — impact direct sur CA",
            ],
            'Générateur de Trafic': [
                "👁️ Tête de gondole et zone d'entrée",
                "📦 Stock modéré — rotation hebdomadaire",
                "🏷️ Affichage promotionnel pour augmenter la velocity",
                "📈 Potentiel de montée en Star avec bon positionnement",
            ],
            'Niche (Rentable)': [
                "🎯 Stocker pour la clientèle fidèle régulière",
                "💰 Produits à forte valeur unitaire — ne pas sous-stocker",
                "📅 Anticiper les pics saisonniers (galettes, bûches…)",
                "🔍 Surveiller : toute rupture = perte clientèle fidèle",
            ],
            'Stock Dormant (Dead)': [
                "📊 Analyser : rupture réelle ou manque d'exposition ?",
                "🗑️ Envisager la suppression si velocity < 0.1 u/j",
                "🔄 Test repositionnement avant décision finale",
                "💤 Libérer la capacité de production pour les Stars",
            ],
        }

        with st.expander(
            f"{icon} **{cat}** — {int(row['nb_produits'])} produits · "
            f"{row['part_ca_%']:.1f}% du CA · {row['ca_total']:,.0f} EUR",
            expanded=(cat == 'Star (Indispensable)')
        ):
            c_left, c_right = st.columns([2, 1])
            with c_left:
                st.markdown(f"""
                <div style="background:{color}12;border-left:4px solid {color};
                     border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:12px;">
                  <b style="color:{color};font-size:13px;">Action recommandée :</b><br>
                  <span style="color:#444;font-size:13px;">{action}</span>
                </div>""", unsafe_allow_html=True)
                for item in details[cat]:
                    st.markdown(f"- {item}")
            with c_right:
                st.markdown(f"""
                <div style="background:white;border-radius:10px;padding:16px;
                     border-top:4px solid {color};
                     box-shadow:0 2px 8px rgba(0,0,0,0.07);text-align:center;">
                  <div style="font-size:11px;color:#888;text-transform:uppercase;font-weight:600;">Pén. Moyenne</div>
                  <div style="font-size:22px;font-weight:700;color:{color};">{row['pen_moyenne']:.2f}%</div>
                  <div style="font-size:11px;color:#888;margin-top:8px;text-transform:uppercase;font-weight:600;">Vel. Moyenne</div>
                  <div style="font-size:22px;font-weight:700;color:{color};">{row['vel_moyenne']:.1f} u/j</div>
                  <div style="font-size:11px;color:#888;margin-top:8px;text-transform:uppercase;font-weight:600;">CA Moyen / produit</div>
                  <div style="font-size:18px;font-weight:700;color:{color};">{row['ca_total']/row['nb_produits']:,.0f} EUR</div>
                </div>""", unsafe_allow_html=True)

    st.divider()
    st.markdown("##### 🗃️ Matrice 2×2 — Positionnement stratégique")
    st.markdown(f"""
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:700px;margin:auto;">
      <div style="background:white;border-radius:10px;padding:20px;
           border:2px solid {COLOR_MATRICE['Star (Indispensable)']};text-align:center;">
        <div style="font-size:24px;">⭐</div>
        <div style="font-weight:700;color:{COLOR_MATRICE['Star (Indispensable)']};font-size:14px;">Star (Indispensable)</div>
        <div style="font-size:11px;color:#666;margin-top:4px;">Pén. HAUTE · Vel. HAUTE</div>
        <div style="font-size:11px;color:#999;margin-top:6px;">
          {int(summary.loc['Star (Indispensable)','nb_produits'])} produits ·
          {summary.loc['Star (Indispensable)','part_ca_%']:.0f}% CA</div>
      </div>
      <div style="background:white;border-radius:10px;padding:20px;
           border:2px solid {COLOR_MATRICE['Niche (Rentable)']};text-align:center;">
        <div style="font-size:24px;">💎</div>
        <div style="font-weight:700;color:{COLOR_MATRICE['Niche (Rentable)']};font-size:14px;">Niche (Rentable)</div>
        <div style="font-size:11px;color:#666;margin-top:4px;">Pén. FAIBLE · Vel. HAUTE</div>
        <div style="font-size:11px;color:#999;margin-top:6px;">
          {int(summary.loc['Niche (Rentable)','nb_produits'])} produits ·
          {summary.loc['Niche (Rentable)','part_ca_%']:.0f}% CA</div>
      </div>
      <div style="background:white;border-radius:10px;padding:20px;
           border:2px solid {COLOR_MATRICE['Générateur de Trafic']};text-align:center;">
        <div style="font-size:24px;">🚀</div>
        <div style="font-weight:700;color:{COLOR_MATRICE['Générateur de Trafic']};font-size:14px;">Générateur de Trafic</div>
        <div style="font-size:11px;color:#666;margin-top:4px;">Pén. HAUTE · Vel. FAIBLE</div>
        <div style="font-size:11px;color:#999;margin-top:6px;">
          {int(summary.loc['Générateur de Trafic','nb_produits'])} produits ·
          {summary.loc['Générateur de Trafic','part_ca_%']:.0f}% CA</div>
      </div>
      <div style="background:white;border-radius:10px;padding:20px;
           border:2px solid {COLOR_MATRICE['Stock Dormant (Dead)']};text-align:center;">
        <div style="font-size:24px;">💤</div>
        <div style="font-weight:700;color:{COLOR_MATRICE['Stock Dormant (Dead)']};font-size:14px;">Stock Dormant</div>
        <div style="font-size:11px;color:#666;margin-top:4px;">Pén. FAIBLE · Vel. FAIBLE</div>
        <div style="font-size:11px;color:#999;margin-top:6px;">
          {int(summary.loc['Stock Dormant (Dead)','nb_produits'])} produits ·
          {summary.loc['Stock Dormant (Dead)','part_ca_%']:.0f}% CA</div>
      </div>
    </div>""", unsafe_allow_html=True)
