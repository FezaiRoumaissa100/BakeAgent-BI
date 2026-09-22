import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
import pickle
from scipy.stats import linregress

st.set_page_config(
    page_title="Taux de Pénétration — Le Croisic",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ============================================================
# PALETTE
# ============================================================
C1, C2, C3 = '#8B3A0F', '#C8860A', '#E6A817'
COLOR_STATUT = {
    'Produit Phare (Dominant)' : '#8B3A0F',
    'Leader (Indispensable)'   : '#C8860A',
    'Produit Coeur (Core)'     : '#E6A817',
    'Produit Regulier'         : '#3498DB',
    'Niche / A surveiller'     : '#AAAAAA',
}
ICONE_STATUT = {
    'Produit Phare (Dominant)' : '⭐',
    'Leader (Indispensable)'   : '🏆',
    'Produit Coeur (Core)'     : '🎯',
    'Produit Regulier'         : '📦',
    'Niche / A surveiller'     : '🔍',
}
COLOR_PROD = {
    'TRADITIONAL BAGUETTE' : '#8B3A0F',
    'COUPE'                : '#C8860A',
    'BAGUETTE'             : '#E6A817',
    'BANETTE'              : '#27AE60',
    'CROISSANT'            : '#3498DB',
    'PAIN AU CHOCOLAT'     : '#8E44AD',
}

# ============================================================
# CSS
# ============================================================
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500&display=swap');

html, body, [class*="css"] { font-family:'DM Sans',sans-serif; background:#FAF6F0 !important; }
.main, .stApp { background:#FAF6F0 !important; }
.block-container { padding:0 2.5rem 3rem !important; max-width:1400px !important; }

[data-testid="stSidebar"] {
    background:linear-gradient(180deg,#3B1F0E,#5C2D0F 60%,#3B1F0E) !important;
    border-right:none !important;
}
[data-testid="stSidebar"] * { color:#F5DDB0 !important; }
[data-testid="stSidebar"] label {
    color:#F5C98A !important; font-size:.76rem !important;
    font-weight:500 !important; text-transform:uppercase !important; letter-spacing:.06em !important;
}
[data-testid="stSidebar"] .stSelectbox>div>div,
[data-testid="stSidebar"] .stMultiSelect>div>div,
[data-testid="stSidebar"] .stTextInput input {
    background:rgba(255,255,255,.10) !important;
    border:1px solid rgba(245,200,138,.35) !important; border-radius:10px !important;
}
[data-testid="stSidebar"] hr { border-color:rgba(245,200,138,.18) !important; margin:1rem 0 !important; }

.page-header {
    background:linear-gradient(135deg,#3B1F0E 0%,#7A3D15 50%,#C8860A 100%);
    border-radius:20px; padding:32px 44px; margin:2rem 0 24px;
    position:relative; overflow:hidden;
    box-shadow:0 16px 48px rgba(139,58,15,.22);
}
.page-header::before {
    content:'🎯'; position:absolute; right:44px; top:50%;
    transform:translateY(-50%); font-size:5.5rem; opacity:.09;
}
.page-header h1 {
    font-family:'Playfair Display',serif !important;
    font-size:2rem !important; color:white !important;
    margin:0 0 6px !important; font-weight:700 !important;
}
.page-header .sub  { color:rgba(245,230,200,.80) !important; font-size:.90rem !important; margin:0 !important; }
.page-header .tag  {
    display:inline-block; background:rgba(255,255,255,.12);
    border:1px solid rgba(255,255,255,.22); border-radius:20px;
    padding:4px 14px; font-size:.68rem; color:rgba(255,255,255,.8);
    letter-spacing:.10em; text-transform:uppercase; margin-bottom:12px;
}

.stTabs [data-baseweb="tab-list"] {
    background:transparent; gap:4px;
    border-bottom:2px solid rgba(200,134,10,.2) !important;
}
.stTabs [data-baseweb="tab"] {
    background:transparent; border:none; border-radius:8px 8px 0 0 !important;
    color:#9E8A78 !important; font-size:.88rem !important; padding:10px 20px !important;
}
.stTabs [aria-selected="true"] {
    background:rgba(200,134,10,.08) !important; color:#3B1F0E !important;
    font-weight:600 !important; border-bottom:2px solid #C8860A !important;
}

.sec-title {
    display:flex; align-items:center; gap:12px;
    font-family:'Playfair Display',serif; font-size:1.1rem; font-weight:700; color:#3B1F0E;
    margin:24px 0 16px;
}
.sec-title::after {
    content:''; flex:1; height:1px;
    background:linear-gradient(90deg,rgba(200,134,10,.3),transparent);
}
.sec-title .ico {
    width:34px; height:34px; border-radius:50%;
    background:rgba(200,134,10,.10); border:1.5px solid rgba(200,134,10,.28);
    display:flex; align-items:center; justify-content:center; font-size:.95rem; flex-shrink:0;
}

.insight {
    background:linear-gradient(135deg,#FDF6EC,#F5E6C8);
    border:1px solid rgba(200,134,10,.22); border-left:4px solid #C8450A;
    border-radius:0 12px 12px 0; padding:12px 16px;
    font-size:.86rem; color:#5a3010; margin:14px 0;
}

.prod-card {
    background:white;
    border:1px solid rgba(200,134,10,.13);
    border-radius:16px;
    padding:18px 20px;
    margin-bottom:12px;
    box-shadow:0 2px 8px rgba(139,58,15,.06);
    transition:box-shadow .2s;
}
.prod-card:hover { box-shadow:0 6px 20px rgba(139,58,15,.12); }
</style>
""", unsafe_allow_html=True)

# ============================================================
# CHARGEMENT
# ============================================================
@st.cache_data
def load_data():
    paths = ['retail_data.pkl','../retail_data.pkl',
             os.path.join(os.path.dirname(__file__),'..','retail_data.pkl')]
    for p in paths:
        if os.path.exists(p):
            with open(p,'rb') as f: return pickle.load(f)
    return None

data = load_data()
if data is None:
    st.error("❌ Fichier retail_data.pkl introuvable.")
    st.stop()

df_all = data['df_clean']
df_pen = data['df_penetration'].copy()

# Enrichissement
cat_map = df_all[['article','category']].drop_duplicates().query("category != 'A CLASSIFIER'")
df_pen  = df_pen.merge(cat_map, on='article', how='left')
moy_cat = (df_pen.dropna(subset=['category'])
           .groupby('category')['penetration_rate_%'].mean().reset_index()
           .rename(columns={'penetration_rate_%':'moy_pen_cat'}))
df_pen  = df_pen.merge(moy_cat, on='category', how='left')
df_pen['score_normalise'] = (df_pen['penetration_rate_%'] / df_pen['moy_pen_cat'].replace(0,1)*100).round(1)

ca  = df_all.groupby('article')['total_revenue'].sum().reset_index().rename(columns={'total_revenue':'ca_total'})
qty = df_all.groupby('article')['quantity'].sum().reset_index().rename(columns={'quantity':'qty_total'})
df_pen = df_pen.merge(ca,on='article',how='left').merge(qty,on='article',how='left')
df_pen['upt'] = (df_pen['qty_total']/df_pen['tickets_count'].replace(0,1)).round(2)

PRODUITS_TOP = ['TRADITIONAL BAGUETTE','COUPE','BAGUETTE','BANETTE','CROISSANT','PAIN AU CHOCOLAT']

# Pénétration temporelle
if 'semaine_iso' in df_all.columns:
    try:
        tickets_hebdo = (df_all.groupby('semaine_iso')['ticket_number']
                         .nunique().reset_index()
                         .rename(columns={'ticket_number':'nb_tickets_semaine'}))
        df_penet = (df_all.drop_duplicates(subset=['ticket_number','article'])
                    .query('article in @PRODUITS_TOP')
                    .groupby(['semaine_iso','article'])['ticket_number'].nunique().reset_index()
                    .rename(columns={'ticket_number':'nb_tickets_produit'})
                    .merge(tickets_hebdo,on='semaine_iso',how='left'))
        df_penet['taux'] = (df_penet['nb_tickets_produit']/df_penet['nb_tickets_semaine']*100).round(2)
        si = df_penet['semaine_iso']
        df_penet['date_semaine'] = si.dt.to_timestamp() if hasattr(si.dtype,'freq') else si.apply(
            lambda x: x.to_timestamp() if hasattr(x,'to_timestamp') else pd.NaT)
        df_penet = df_penet.sort_values(['article','date_semaine'])
        df_penet['mm4'] = df_penet.groupby('article')['taux'].transform(
            lambda x: x.rolling(4,min_periods=2).mean())
    except Exception:
        df_penet = pd.DataFrame()
else:
    df_penet = pd.DataFrame()

total_ca      = df_pen['ca_total'].sum()
total_tickets = df_all['ticket_number'].nunique()
nb_phare      = (df_pen['statut_strategique']=='Produit Phare (Dominant)').sum()
nb_leader     = (df_pen['statut_strategique']=='Leader (Indispensable)').sum()
nb_core       = (df_pen['statut_strategique']=='Produit Coeur (Core)').sum()
nb_niche      = (df_pen['statut_strategique']=='Niche / A surveiller').sum()
pen_max       = df_pen['penetration_rate_%'].max()
pen_med       = df_pen['penetration_rate_%'].median()

# ============================================================
# SIDEBAR
# ============================================================
with st.sidebar:
    st.markdown("""
    <div style="padding:20px 4px 8px;">
      <p style="font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;
                color:#F5C98A;margin:0 0 4px;">🔍 Filtres</p>
    </div>""", unsafe_allow_html=True)
    st.markdown("---")

    recherche  = st.text_input("🔤 Rechercher", placeholder="Ex: baguette…", label_visibility="visible")
    st.markdown("---")
    cats_dispo = sorted(df_pen['category'].dropna().unique().tolist())
    cat_sel    = st.multiselect("🏷️ Catégorie(s)", cats_dispo, default=cats_dispo)
    st.markdown("---")
    statuts_d  = list(COLOR_STATUT.keys())
    statut_sel = st.multiselect("📊 Statut(s)", statuts_d, default=statuts_d,
                                 format_func=lambda x: f"{ICONE_STATUT[x]} {x}")
    st.markdown("---")
    pen_min_v  = float(df_pen['penetration_rate_%'].min())
    pen_max_v  = float(df_pen['penetration_rate_%'].max())
    pen_range  = st.slider("📈 Pénétration (%)", pen_min_v, pen_max_v, (pen_min_v, pen_max_v), 0.1)
    st.markdown("---")
    top_n = st.slider("🔢 Top N produits", 10, 50, 20, 5)
    tri   = st.selectbox("↕️ Trier par", ["Pénétration ↓","CA Total ↓","Tickets ↓"])
    st.markdown("---")
    st.markdown("<div style='font-size:.70rem;color:rgba(245,230,200,.38);text-align:center;'>Boulangerie Le Croisic · 2024–2025</div>",
                unsafe_allow_html=True)

# ── Filtrage
df_f = df_pen.copy()
if recherche: df_f = df_f[df_f['article'].str.contains(recherche.upper(),na=False)]
if cat_sel:   df_f = df_f[df_f['category'].isin(cat_sel)]
if statut_sel:df_f = df_f[df_f['statut_strategique'].isin(statut_sel)]
df_f = df_f[(df_f['penetration_rate_%']>=pen_range[0])&(df_f['penetration_rate_%']<=pen_range[1])]
tri_col = {"Pénétration ↓":'penetration_rate_%',"CA Total ↓":'ca_total',"Tickets ↓":'tickets_count'}[tri]
df_f = df_f.sort_values(tri_col,ascending=False).reset_index(drop=True)

# ============================================================
# EN-TÊTE
# ============================================================
st.markdown("""
<div class="page-header">
  <div class="tag">Analyse Comportementale · Section 2.2</div>
  <h1>Taux de Pénétration Produits</h1>
  <p class="sub">Diffusion comportementale · 145 produits · 131 315 tickets · Jan 2024 – Déc 2025</p>
</div>
""", unsafe_allow_html=True)

# ============================================================
# KPI — 6 colonnes
# ============================================================
nb_regulier = (df_pen['statut_strategique']=='Produit Regulier').sum()

k1,k2,k3,k4,k5,k6 = st.columns(6)
for col, color, icon, lbl, val, sub in [
    (k1,'#8B3A0F','⭐','Produits Phares',   str(nb_phare),       "Pénétration > 20%"),
    (k2,'#C8860A','🏆','Leaders',           str(nb_leader),      "Entre 5% et 20%"),
    (k3,'#E6A817','🎯','Produits Core',     str(nb_core),        "Entre 2% et 5%"),
    (k4,'#AAAAAA','🔍','Niche',             str(nb_niche),       "< 0.5%"),
    (k5,'#3498DB','📦','Produits Réguliers',str(nb_regulier),    "Entre 0.5% et 2%"),
    (k6,'#8B3A0F','📈','Pénétration Max',   f"{pen_max:.1f}%",   "Trad. Baguette"),


]:
    with col:
        st.markdown(f"""
        <div style="background:white;border:1px solid rgba(200,134,10,.14);
                    border-radius:14px;padding:18px 14px;text-align:center;
                    border-bottom:4px solid {color};
                    box-shadow:0 2px 10px rgba(139,58,15,.07);margin-bottom:4px;">
          <div style="font-size:1.4rem;margin-bottom:8px;">{icon}</div>
          <div style="font-size:.62rem;font-weight:700;color:#9E8A78;
                      text-transform:uppercase;letter-spacing:.09em;margin-bottom:8px;">{lbl}</div>
          <div style="font-family:'Playfair Display',serif;font-size:1.8rem;
                      font-weight:900;color:#3B1F0E;line-height:1;margin-bottom:6px;">{val}</div>
          <div style="font-size:.70rem;color:#9E8A78;">{sub}</div>
        </div>""", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# Résultat filtre
st.markdown(f"""
<div style="display:inline-flex;align-items:center;gap:6px;
            background:rgba(200,134,10,.08);border:1px solid rgba(200,134,10,.2);
            border-radius:20px;padding:6px 16px;font-size:.83rem;color:#7A3D15;
            font-weight:500;margin-bottom:18px;">
    📌 <strong>{len(df_f)} produits</strong> affichés
    {f' · recherche "<em>{recherche}</em>"' if recherche else ''}
    · pénétration {pen_range[0]:.1f}% → {pen_range[1]:.1f}%
</div>
""", unsafe_allow_html=True)

if df_f.empty:
    st.warning("Aucun produit ne correspond aux filtres.")
    st.stop()

# ============================================================
# ONGLETS  (Dashboard supprimé — 5 onglets)
# ============================================================
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "  📊 Top Produits  ",
    "  🔵 Positionnement  ",
    "  📅 Évolution  ",
    "  🏷️ Par Catégorie  ",
    "  ⚙️ Recommandations  ",
])

# ─────────────────────────────────────────────────
# TAB 1 — TOP PRODUITS (avec mini KPI row en tête)
# ─────────────────────────────────────────────────
with tab1:
    df_tbl = df_f.head(top_n).reset_index(drop=True).copy()

   

    # ── Classement barres verticales
    st.markdown('<div class="sec-title"><div class="ico">📊</div>Classement par Taux de Pénétration</div>',
                unsafe_allow_html=True)

    df_bar2 = df_f.head(top_n).sort_values('penetration_rate_%', ascending=False).copy()
    df_bar2['article_fmt'] = df_bar2['article'].str.title()
    bar_colors2 = [COLOR_STATUT.get(s, '#AAAAAA') for s in df_bar2['statut_strategique']]

    fig1 = go.Figure()
    fig1.add_trace(go.Bar(
        x=df_bar2['article_fmt'],
        y=df_bar2['penetration_rate_%'],
        orientation='v',
        marker=dict(color=bar_colors2, opacity=0.90, line=dict(color='white', width=0.8)),
        text=[f"<b>{v:.2f}%</b>" for v in df_bar2['penetration_rate_%']],
        textposition='outside',
        textfont=dict(size=10, color='#3B1F0E'),
        hovertemplate="<b>%{x}</b><br>Pénétration : <b>%{y:.2f}%</b><extra></extra>",
        showlegend=False,
    ))

    for seuil, lbl, col in [(20,'Phare ≥20%', C1),(5,'Leader ≥5%', C2),(2,'Core ≥2%', C3)]:
        fig1.add_hline(y=seuil, line_dash='dash', line_color=col, line_width=1.5, opacity=0.7,
                       annotation_text=lbl, annotation_font=dict(color=col, size=10),
                       annotation_position="top right")

    legend_items = list(COLOR_STATUT.items())
    for i, (statut, color) in enumerate(legend_items):
        icone = ICONE_STATUT[statut]
        fig1.add_annotation(
            x=1.01, y=1 - i*0.10,
            xref='paper', yref='paper',
            text=f"<span style='color:{color}'>■</span> {icone} {statut.split('(')[0].strip()}",
            showarrow=False,
            font=dict(size=10, color=color),
            xanchor='left', align='left',
        )

    fig1.update_layout(
        height=520,
        plot_bgcolor='white',
        paper_bgcolor='rgba(250,246,240,.6)',
        font=dict(family='DM Sans'),
        xaxis=dict(title='Produit', tickangle=-35, tickfont=dict(size=10, color='#3B1F0E'),
                   gridcolor='#f0ece4', zeroline=False),
        yaxis=dict(title='Taux de Pénétration (%)', ticksuffix='%', gridcolor='#f0ece4',
                   zeroline=False, range=[0, df_bar2['penetration_rate_%'].max() * 1.22]),
        margin=dict(l=60, r=180, t=30, b=100),
        bargap=0.28,
        hovermode='x unified',
    )
    st.plotly_chart(fig1, use_container_width=True)

    if len(df_f) >= 2:
        top1 = df_f.iloc[0]; top2 = df_f.iloc[1]
        st.markdown(f'<div class="insight">💡 <strong>{top1["article"].title()}</strong> domine avec '
                    f'<strong>{top1["penetration_rate_%"]:.2f}%</strong> ({top1["tickets_count"]:,} tickets) — '
                    f'soit <strong>{top1["penetration_rate_%"]/max(top2["penetration_rate_%"],0.01):.1f}×</strong> '
                    f'plus que <strong>{top2["article"].title()}</strong> ({top2["penetration_rate_%"]:.2f}%).'
                    f'</div>', unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    csv = df_tbl[['article', 'category', 'penetration_rate_%', 'statut_strategique',
                  'ca_total', 'tickets_count']].copy()
    csv.columns = ['Produit', 'Catégorie', 'Pénétration (%)', 'Statut', 'CA (€)', 'Tickets']
    csv['Produit'] = csv['Produit'].str.title()
    st.download_button("⬇️ Exporter CSV", csv.to_csv(index=False).encode('utf-8'),
                       "penetration.csv", "text/csv")

# ─────────────────────────────────────────────────
# TAB 2 — POSITIONNEMENT
# ─────────────────────────────────────────────────
with tab2:
    col_sc, col_pie = st.columns([3, 2])

    with col_sc:
        st.markdown('<div class="sec-title"><div class="ico">🔵</div>Pénétration × CA — Top 20</div>',
                    unsafe_allow_html=True)

        exclure_dominant = st.checkbox(
            "🔍 Exclure le produit dominant (Traditional Baguette) pour mieux voir les autres",
            value=False
        )

        df_sc = df_f.sort_values('penetration_rate_%', ascending=False).head(20).copy()
        if exclure_dominant:
            df_sc = df_sc.iloc[1:].copy()
        df_sc['article_fmt'] = df_sc['article'].str.title()
        sz_max = df_sc['tickets_count'].max()
        df_sc['sz'] = ((df_sc['tickets_count'] / max(sz_max, 1)) * 30 + 14).clip(14, 44)

        fig_sc = go.Figure()

        for statut, color in COLOR_STATUT.items():
            sub = df_sc[df_sc['statut_strategique'] == statut]
            if sub.empty: continue
            fig_sc.add_trace(go.Scatter(
                x=sub['penetration_rate_%'],
                y=sub['ca_total'] / 1000,
                mode='markers+text',
                name=f"{ICONE_STATUT[statut]} {statut.split('(')[0].strip()}",
                marker=dict(size=sub['sz'], color=color, opacity=0.88,
                            line=dict(width=2, color='white')),
                text=[a[:18] for a in sub['article_fmt']],
                textposition='top center',
                textfont=dict(size=9, color='#3B1F0E', family='DM Sans'),
                hovertemplate=(
                    "<b>%{customdata[0]}</b><br>"
                    "Pénétration : <b>%{x:.2f}%</b><br>"
                    "CA : <b>%{y:.1f}k€</b><br>"
                    "Tickets : <b>%{customdata[1]:,}</b>"
                    "<extra></extra>"
                ),
                customdata=list(zip(sub['article_fmt'], sub['tickets_count'])),
            ))

        pen_vals = df_sc['penetration_rate_%']
        ca_vals  = df_sc['ca_total'] / 1000
        x_max    = pen_vals.max() * 1.25
        x_min_p  = max(pen_vals.min() * 0.7, 0)
        y_max    = ca_vals.max() * 1.30
        y_min    = max(ca_vals.min() * 0.75, 0)

        fig_sc.add_shape(type='rect', x0=20, x1=x_max, y0=y_min, y1=y_max,
                         fillcolor='rgba(139,58,15,0.05)', line=dict(width=0))
        fig_sc.add_shape(type='rect', x0=5, x1=20, y0=y_min, y1=y_max,
                         fillcolor='rgba(200,134,10,0.04)', line=dict(width=0))
        fig_sc.add_shape(type='rect', x0=x_min_p, x1=5, y0=y_min, y1=y_max,
                         fillcolor='rgba(52,152,219,0.03)', line=dict(width=0))

        for x_pos, lbl, col_ in [
            ((x_min_p + 5) / 2, 'Core / Régulier', '#3498DB'),
            (12,                 'Leader',           C2),
            (min(32, x_max*0.85),'Phare',            C1),
        ]:
            if x_pos < x_max:
                fig_sc.add_annotation(
                    x=x_pos, y=y_max * 0.97,
                    text=f"<b>{lbl}</b>",
                    showarrow=False,
                    font=dict(size=10, color=col_),
                    bgcolor='rgba(255,255,255,0.7)',
                    borderpad=3,
                )

        for seuil, col_ in [(5, C2), (20, C1)]:
            if seuil < x_max:
                fig_sc.add_vline(x=seuil, line_dash='dash', line_color=col_,
                                 line_width=1.5, opacity=0.5)

        fig_sc.update_layout(
            height=500,
            plot_bgcolor='white',
            paper_bgcolor='rgba(250,246,240,.6)',
            font=dict(family='DM Sans'),
            xaxis=dict(title='<b>Pénétration (%)</b>', ticksuffix='%', gridcolor='#ede8e0',
                       zeroline=False, range=[x_min_p, x_max], tickformat='.1f',
                       nticks=10, showgrid=True),
            yaxis=dict(title='<b>CA Total (k€)</b>', ticksuffix='k€', gridcolor='#ede8e0',
                       zeroline=False, range=[y_min, y_max], tickformat='.0f', showgrid=True),
            legend=dict(orientation='h', yanchor='bottom', y=-0.26, xanchor='center', x=0.5,
                        bgcolor='rgba(250,246,240,.95)', bordercolor='rgba(200,134,10,.2)',
                        borderwidth=1, font=dict(size=10)),
            margin=dict(l=70, r=20, t=30, b=100),
            hovermode='closest',
        )
        st.plotly_chart(fig_sc, use_container_width=True)
        st.markdown(
            '<div class="insight">💡 <b>Taille des bulles</b> = volume de tickets · '
            'Cochez la case ci-dessus pour mieux visualiser les produits groupés.</div>',
            unsafe_allow_html=True
        )

    with col_pie:
        st.markdown('<div class="sec-title" style="font-size:.95rem;"><div class="ico">🍩</div>Répartition</div>',
                    unsafe_allow_html=True)

        statut_counts = df_f['statut_strategique'].value_counts().reindex(list(COLOR_STATUT.keys())).dropna()
        fig_pie = go.Figure(go.Pie(
            labels=[f"{ICONE_STATUT.get(s,'📦')} {s.split('(')[0].strip()}" for s in statut_counts.index],
            values=statut_counts.values, hole=0.58,
            marker=dict(colors=[COLOR_STATUT[s] for s in statut_counts.index],
                        line=dict(color='white', width=2.5)),
            textinfo='percent+label', textfont=dict(size=10),
            hovertemplate='<b>%{label}</b><br>%{value} produits<br>%{percent}<extra></extra>',
        ))
        fig_pie.add_annotation(text=f"<b>{len(df_f)}</b><br>produits",
                               x=0.5, y=0.5, showarrow=False, font=dict(size=16, color=C1))
        fig_pie.update_layout(height=280, paper_bgcolor='rgba(0,0,0,0)',
                              showlegend=False, margin=dict(t=10, b=10, l=10, r=10))
        st.plotly_chart(fig_pie, use_container_width=True)

        st.markdown("**Part CA par Statut**")
        for statut, color in COLOR_STATUT.items():
            ca_s = df_f[df_f['statut_strategique']==statut]['ca_total'].sum()
            pct  = ca_s/total_ca*100 if total_ca>0 else 0
            nb_s = (df_f['statut_strategique']==statut).sum()
            st.markdown(f"""
            <div style="margin-bottom:9px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="font-size:.78rem;font-weight:600;color:#3B1F0E;">
                  {ICONE_STATUT[statut]} {statut.split('(')[0].strip()}
                  <span style="color:#9E8A78;font-weight:400;">({nb_s})</span>
                </span>
                <span style="font-size:.78rem;font-weight:700;color:{color};">{pct:.1f}%</span>
              </div>
              <div style="background:#F0ECE4;border-radius:99px;height:6px;overflow:hidden;">
                <div style="width:{min(pct,100):.0f}%;background:linear-gradient(90deg,{color},{color}88);
                            border-radius:99px;height:6px;"></div>
              </div>
            </div>""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────
# TAB 3 — ÉVOLUTION
# ─────────────────────────────────────────────────
with tab3:
    if df_penet.empty:
        st.info("Données temporelles non disponibles.")
    else:
        st.markdown('<div class="sec-title"><div class="ico">📅</div>Évolution Hebdomadaire — Pénétration</div>',
                    unsafe_allow_html=True)
        produit_sel = st.multiselect("Produits à comparer", PRODUITS_TOP, default=PRODUITS_TOP[:4])
        if not produit_sel:
            st.warning("Sélectionnez au moins un produit.")
        else:
            n = len(produit_sel)
            rows_nb = (n+1)//2
            fig3 = make_subplots(rows=rows_nb, cols=2,
                                  subplot_titles=[p.title() for p in produit_sel],
                                  vertical_spacing=0.16, horizontal_spacing=0.10)

            for idx, produit in enumerate(produit_sel):
                row = idx//2+1; col = idx%2+1
                c   = COLOR_PROD.get(produit, C2)
                dp  = df_penet[df_penet['article']==produit].copy().reset_index(drop=True)
                if dp.empty: continue
                moy = dp['taux'].mean()
                r,g,b = int(c[1:3],16),int(c[3:5],16),int(c[5:7],16)

                fig3.add_trace(go.Scatter(
                    x=dp['date_semaine'], y=dp['taux'], mode='lines',
                    line=dict(color=c, width=0.8, dash='dot'), opacity=0.25,
                    showlegend=False, hoverinfo='skip',
                ), row=row, col=col)

                fig3.add_trace(go.Scatter(
                    x=dp['date_semaine'], y=dp['mm4'], mode='lines',
                    line=dict(color=c, width=2.8),
                    fill='tozeroy', fillcolor=f'rgba({r},{g},{b},0.09)',
                    name=produit.title(), showlegend=(idx==0),
                    hovertemplate='%{x|%d %b %Y}<br>MM4 : <b>%{y:.2f}%</b><extra></extra>',
                ), row=row, col=col)

                fig3.add_hline(y=moy, line_dash='dot', line_color=c,
                               line_width=1, opacity=0.45, row=row, col=col)

                mm4_clean = dp['mm4'].dropna().tail(12)
                slope = linregress(range(len(mm4_clean)), mm4_clean.values)[0] if len(mm4_clean)>=4 else 0
                t_lbl = '↑ Hausse' if slope>0.15 else ('↓ Baisse' if slope<-0.15 else '→ Stable')
                t_col = '#27AE60' if slope>0.15 else ('#E74C3C' if slope<-0.15 else C3)
                pen_v = df_pen.loc[df_pen['article']==produit,'penetration_rate_%']
                pen_v = pen_v.values[0] if len(pen_v) else 0
                last_y = mm4_clean.iloc[-1] if len(mm4_clean) else moy

                fig3.add_annotation(
                    x=dp['date_semaine'].iloc[-1], y=last_y,
                    text=f"<b>{t_lbl}</b> · {pen_v:.1f}%",
                    showarrow=True, arrowhead=2,
                    font=dict(size=9, color=t_col),
                    bgcolor='white', bordercolor=t_col, borderwidth=1.5,
                    row=row, col=col,
                )

            fig3.update_layout(
                height=340*rows_nb, plot_bgcolor='white',
                paper_bgcolor='rgba(250,246,240,.6)',
                font=dict(family='DM Sans', size=11),
                margin=dict(t=60, b=40, l=10, r=10),
            )
            fig3.update_xaxes(tickformat='%b %y', tickangle=30, gridcolor='#f0ece4')
            fig3.update_yaxes(title_text='Pénétration (%)', gridcolor='#f0ece4',
                              zeroline=False, ticksuffix='%')
            st.plotly_chart(fig3, use_container_width=True)
            st.markdown('<div class="insight">📊 Courbe pleine = moyenne mobile 4 semaines · '
                        'La flèche indique la tendance des 12 dernières semaines</div>',
                        unsafe_allow_html=True)

# ─────────────────────────────────────────────────
# TAB 4 — PAR CATÉGORIE
# ─────────────────────────────────────────────────
with tab4:
    cats_list = sorted(df_f['category'].dropna().unique().tolist())
    cat_zoom  = st.selectbox("Sélectionner une catégorie", ["Toutes"] + cats_list)

    if cat_zoom == "Toutes":
        col_a, col_b = st.columns([1,1])
        with col_a:
            st.markdown('<div class="sec-title" style="font-size:.95rem;"><div class="ico">📊</div>Pénétration moyenne par catégorie</div>',
                        unsafe_allow_html=True)
            moy_par_cat = (df_f.dropna(subset=['category'])
                           .groupby('category')['penetration_rate_%'].mean()
                           .sort_values(ascending=True).reset_index())
            fig_cg = go.Figure(go.Bar(
                x=moy_par_cat['penetration_rate_%'], y=moy_par_cat['category'],
                orientation='h',
                marker=dict(color=moy_par_cat['penetration_rate_%'],
                            colorscale=[[0,C3],[0.5,C2],[1,C1]],
                            line=dict(color='white', width=0.5)),
                text=[f"<b>{v:.2f}%</b>" for v in moy_par_cat['penetration_rate_%']],
                textposition='outside', textfont=dict(size=10),
                hovertemplate='<b>%{y}</b><br>Pén. moy. : <b>%{x:.2f}%</b><extra></extra>',
            ))
            fig_cg.update_layout(
                height=380, plot_bgcolor='white', paper_bgcolor='rgba(250,246,240,.6)',
                font=dict(family='DM Sans'),
                xaxis=dict(title='Pénétration moy. (%)', ticksuffix='%', gridcolor='#f0ece4',
                           zeroline=False, range=[0, moy_par_cat['penetration_rate_%'].max()*1.28]),
                yaxis=dict(tickfont=dict(size=11, color='#3B1F0E')),
                margin=dict(l=10, r=80, t=10, b=40), showlegend=False,
            )
            st.plotly_chart(fig_cg, use_container_width=True)

        with col_b:
            st.markdown('<div class="sec-title" style="font-size:.95rem;"><div class="ico">🥧</div>Part du CA par catégorie</div>',
                        unsafe_allow_html=True)
            ca_cat = (df_f.dropna(subset=['category']).groupby('category')['ca_total']
                      .sum().sort_values(ascending=False).reset_index())
            PALETTE_CAT = [C1,C2,C3,'#27AE60','#3498DB','#8E44AD','#E74C3C','#1ABC9C']
            fig_dn = go.Figure(go.Pie(
                labels=ca_cat['category'], values=ca_cat['ca_total'], hole=0.55,
                marker=dict(colors=PALETTE_CAT[:len(ca_cat)], line=dict(color='white', width=2.5)),
                textinfo='label+percent', textfont=dict(size=11),
                hovertemplate='<b>%{label}</b><br>CA : %{value:,.0f} €<br>%{percent}<extra></extra>',
            ))
            fig_dn.add_annotation(text=f"<b>{ca_cat['ca_total'].sum()/1000:.0f}k€</b>",
                                  x=0.5, y=0.5, showarrow=False, font=dict(size=15, color=C1))
            fig_dn.update_layout(height=380, paper_bgcolor='rgba(0,0,0,0)',
                                 showlegend=False, margin=dict(t=10, b=10, l=10, r=10))
            st.plotly_chart(fig_dn, use_container_width=True)

    else:
        df_cat = df_f[(df_f['category']==cat_zoom)&(df_f['penetration_rate_%']>0)].copy()
        df_cat = df_cat.sort_values('penetration_rate_%', ascending=False).reset_index(drop=True)

        col_s, col_c = st.columns([1,2])
        with col_s:
            for lbl, val, color in [
                ("Produits actifs", str(len(df_cat)), C2),
                ("Pén. moyenne",    f"{df_cat['penetration_rate_%'].mean():.2f}%", C1),
                ("Pén. max",        f"{df_cat['penetration_rate_%'].max():.2f}%", C1),
                ("CA catégorie",    f"{df_cat['ca_total'].sum()/1000:.1f}k€", C2),
            ]:
                st.markdown(f"""
                <div style="background:white;border:1px solid rgba(200,134,10,.12);
                            border-left:4px solid {color};border-radius:10px;
                            padding:12px 16px;margin-bottom:10px;">
                  <div style="font-size:.68rem;color:#9E8A78;text-transform:uppercase;
                              letter-spacing:.07em;margin-bottom:4px;">{lbl}</div>
                  <div style="font-family:'Playfair Display',serif;font-size:1.35rem;
                              font-weight:700;color:#3B1F0E;">{val}</div>
                </div>""", unsafe_allow_html=True)
            if len(df_cat)>0:
                tp = df_cat.iloc[0]['article'].title()
                st.markdown(f"""
                <div style="background:rgba(200,134,10,.07);border:1px solid rgba(200,134,10,.2);
                            border-radius:10px;padding:12px 16px;">
                  <div style="font-size:.70rem;color:#7A3D15;font-weight:600;margin-bottom:4px;">⭐ Leader</div>
                  <div style="font-size:.90rem;font-weight:700;color:#3B1F0E;">{tp}</div>
                </div>""", unsafe_allow_html=True)

        with col_c:
            df_sh = df_cat.head(15).sort_values('penetration_rate_%', ascending=True)
            df_sh['article_fmt'] = df_sh['article'].str.title()
            fig_zoom = go.Figure(go.Bar(
                x=df_sh['penetration_rate_%'], y=df_sh['article_fmt'], orientation='h',
                marker=dict(color=[COLOR_STATUT.get(s,'#AAA') for s in df_sh['statut_strategique']],
                            opacity=0.90, line=dict(color='white', width=0.5)),
                text=[f"<b>{v:.2f}%</b>" for v in df_sh['penetration_rate_%']],
                textposition='outside', textfont=dict(size=11),
                hovertemplate='<b>%{y}</b><br>Pénétration : <b>%{x:.2f}%</b><extra></extra>',
            ))
            moy_z = df_sh['penetration_rate_%'].mean()
            fig_zoom.add_vline(x=moy_z, line_dash='dash', line_color=C2, line_width=1.5,
                               annotation_text=f'Moy : {moy_z:.2f}%',
                               annotation_font=dict(color=C2, size=10))
            fig_zoom.update_layout(
                height=max(360, len(df_sh)*32), plot_bgcolor='white',
                paper_bgcolor='rgba(250,246,240,.6)', font=dict(family='DM Sans'),
                xaxis=dict(title='Pénétration (%)', ticksuffix='%', gridcolor='#f0ece4',
                           zeroline=False, range=[0, df_sh['penetration_rate_%'].max()*1.28]),
                yaxis=dict(tickfont=dict(size=11, color='#3B1F0E')),
                margin=dict(l=10, r=80, t=10, b=40), showlegend=False,
            )
            st.plotly_chart(fig_zoom, use_container_width=True)

# ─────────────────────────────────────────────────
# TAB 5 — RECOMMANDATIONS
# ─────────────────────────────────────────────────
with tab5:
    st.markdown('<div class="sec-title"><div class="ico">⚙️</div>Recommandations Opérationnelles</div>',
                unsafe_allow_html=True)

    c_alert1, c_alert2 = st.columns(2)
    with c_alert1:
        st.error("**❌ Ne jamais promouvoir** les Phares & Leaders — ils se vendent naturellement. Une remise détruit la marge sans générer de trafic.")
    with c_alert2:
        st.success("**✅ Promouvoir les Core & Réguliers** — une promotion augmente leur pénétration et attire de nouveaux clients.")

    st.markdown("<br>", unsafe_allow_html=True)

    niveaux = [
        ("⭐", "Produit Phare",    "≥ 20%", '#8B3A0F',
         int((df_f['statut_strategique']=='Produit Phare (Dominant)').sum()),
         "Stock max · Niveau des yeux · ❌ Jamais de promo · Réassort quotidien"),
        ("🏆", "Leader",           "5–20%", '#C8860A',
         int((df_f['statut_strategique']=='Leader (Indispensable)').sum()),
         "Stock élevé · Zone visible · ❌ Promo inutile · Réassort quotidien"),
        ("🎯", "Produit Core",     "2–5%",  '#E6A817',
         int((df_f['statut_strategique']=='Produit Coeur (Core)').sum()),
         "Stock modéré · Étagère milieu · ✅ Promo efficace · Réassort 2–3×/sem"),
        ("📦", "Produit Régulier", "0.5–2%",'#3498DB',
         int((df_f['statut_strategique']=='Produit Regulier').sum()),
         "Stock limité · Zone secondaire · ✅ Promo possible · Réassort hebdo"),
        ("🔍", "Niche",            "< 0.5%",'#AAAAAA',
         int((df_f['statut_strategique']=='Niche / A surveiller').sum()),
         "Stock minimal · Vitrine · 🔬 À tester · Réassort à la commande"),
    ]

    for ico, nom, seuil, color, nb, conseil in niveaux:
        pen_items = df_f[df_f['statut_strategique'].str.startswith(nom.split()[0])]['penetration_rate_%']
        pen_moy   = pen_items.mean() if len(pen_items) > 0 else 0
        st.markdown(f"""
        <div style="display:flex;align-items:center;gap:18px;
                    background:white;border:1px solid rgba(200,134,10,.12);
                    border-left:5px solid {color};border-radius:14px;
                    padding:18px 22px;margin-bottom:12px;
                    box-shadow:0 2px 8px rgba(139,58,15,.05);">
          <div style="font-size:2rem;flex-shrink:0;">{ico}</div>
          <div style="min-width:170px;flex-shrink:0;">
            <div style="font-size:1rem;font-weight:700;color:#3B1F0E;">{nom}</div>
            <div style="margin-top:4px;display:flex;gap:6px;align-items:center;">
              <span style="background:{color}18;border:1px solid {color}44;border-radius:20px;
                           padding:2px 9px;font-size:.70rem;font-weight:700;color:{color};">{seuil}</span>
              <span style="font-size:.75rem;color:#9E8A78;">{nb} produit{'s' if nb!=1 else ''} · {pen_moy:.2f}%</span>
            </div>
          </div>
          <div style="width:1px;height:40px;background:rgba(200,134,10,.15);flex-shrink:0;"></div>
          <div style="font-size:.88rem;color:#5a3010;line-height:1.6;flex:1;">{conseil}</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("#### 📋 Recommandations par Produit")

    def reco_label(p):
        if   p>=20: return "🔴 Stock max · ❌ Pas de promo"
        elif p>=5 : return "🟠 Réassort quotidien · ❌ Pas de promo"
        elif p>=2 : return "🟡 Réassort 2×/sem · ✅ Promo efficace"
        elif p>=.5: return "🟢 Réassort hebdo · ✅ Promo possible"
        else      : return "⚪ À la commande · 🔬 Tester"

    df_reco = df_f.copy()
    df_reco['Recommandation'] = df_reco['penetration_rate_%'].apply(reco_label)
    df_reco['Produit']   = df_reco['article'].str.title()
    df_reco['Catégorie'] = df_reco['category'].fillna('—')

    styled = (df_reco[['Produit','Catégorie','penetration_rate_%','statut_strategique',
                        'ca_total','tickets_count','Recommandation']]
              .rename(columns={'penetration_rate_%':'Pénétration (%)','statut_strategique':'Statut',
                               'ca_total':'CA (€)','tickets_count':'Tickets'})
              .style
              .map(lambda v: f'color:{COLOR_STATUT.get(v,"#333")};font-weight:700', subset=['Statut'])
              .format({'Pénétration (%)':'{:.2f}','CA (€)':'{:,.0f}','Tickets':'{:,}'})
              .bar(subset=['Pénétration (%)'], color='rgba(200,134,10,.15)', vmin=0))
    st.dataframe(styled, use_container_width=True, height=380, hide_index=True)

    csv = df_reco[['Produit','Catégorie','penetration_rate_%','statut_strategique',
                   'ca_total','tickets_count','Recommandation']].to_csv(index=False).encode('utf-8')
    st.download_button("⬇️ Exporter CSV", csv, "recommandations.csv", "text/csv")

# ============================================================
# FOOTER
# ============================================================
st.markdown("""
<div style="text-align:center;color:#9E8A78;font-size:.76rem;
            padding:20px 0 8px;border-top:1px solid rgba(200,134,10,.12);margin-top:28px;">
  🎯 Section 2.2 · Taux de Pénétration · 145 produits · 131 315 tickets · PFE 2026 — Mariem Dridi
</div>
""", unsafe_allow_html=True)
