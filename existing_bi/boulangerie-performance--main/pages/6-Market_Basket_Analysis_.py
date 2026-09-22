import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import pickle, os

# ============================================================
# PAGE CONFIG
# ============================================================
st.set_page_config(
    page_title="Market Basket Analysis · Boulangerie Le Croisic",
    page_icon="🥖",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ============================================================
# PALETTE
# ============================================================
COLORS = {
    'dark'  : '#1C0F05',
    'brown' : '#3B1F0E',
    'rust'  : '#C8450A',
    'orange': '#E07B1A',
    'gold'  : '#D4A017',
    'sand'  : '#F5E6C8',
    'cream' : '#FAF6F0',
    'muted' : '#9E8A78',
    'white' : '#FFFFFF',
}

LIFT_BANDS = [
    ('Très forte', 4.0,  99,   '#C8450A', '≥ 4.0'),
    ('Forte',      2.5,  3.99, '#E07B1A', '2.5 – 3.9'),
    ('Modérée',    1.5,  2.49, '#D4A017', '1.5 – 2.4'),
    ('Légère',     1.2,  1.49, '#9E8A78', '1.2 – 1.4'),
]

def lift_band(lift):
    for name, lo, hi, color, rng in LIFT_BANDS:
        if lift >= lo:
            return name, color, rng
    return 'Légère', '#9E8A78', '1.2 – 1.4'

# ============================================================
# GLOBAL CSS
# ============================================================
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;1,9..144,400&family=Inter:wght@300;400;500;600&display=swap');

html, body, [class*="css"] {
    font-family: 'Inter', sans-serif;
    background-color: #FAF6F0;
}
.block-container { padding: 1.5rem 2rem 3rem; max-width: 1440px; }

[data-testid="stSidebar"] {
    background: #1C0F05;
    border-right: 1px solid rgba(212,160,23,0.15);
}
[data-testid="stSidebar"] * { color: #F5E6C8 !important; }
[data-testid="stSidebar"] label {
    color: #D4A017 !important;
    font-size: 0.72rem !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.08em !important;
}
[data-testid="stSidebar"] .stSelectbox > div > div,
[data-testid="stSidebar"] .stMultiSelect > div > div {
    background: rgba(255,255,255,0.06) !important;
    border: 1px solid rgba(212,160,23,0.25) !important;
    border-radius: 8px !important;
}
[data-testid="stSidebar"] .stTextInput input {
    background: rgba(255,255,255,0.06) !important;
    border: 1px solid rgba(212,160,23,0.25) !important;
    border-radius: 8px !important;
    color: #F5E6C8 !important;
}
[data-testid="stSidebar"] hr { border-color: rgba(212,160,23,0.12) !important; margin: 0.8rem 0 !important; }

.hero {
    background: linear-gradient(120deg, #1C0F05 0%, #3B1F0E 45%, #5a2a0a 100%);
    border-radius: 18px; padding: 36px 44px; margin-bottom: 28px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 24px; position: relative; overflow: hidden;
}
.hero::after {
    content: ''; position: absolute; top:0;left:0;right:0;bottom:0;
    background: radial-gradient(circle at 80% 50%, rgba(212,160,23,0.08) 0%, transparent 60%);
    pointer-events: none;
}
.hero-text h1 { font-family:'Fraunces',serif!important; font-size:2.1rem!important; font-weight:700!important; color:#FFFFFF!important; margin:0 0 8px!important; }
.hero-text p  { color:rgba(245,230,200,0.65)!important; font-size:0.88rem!important; margin:0!important; font-weight:300!important; }
.hero-badge   { display:flex; flex-direction:column; align-items:center; gap:6px; flex-shrink:0; }
.hero-badge-val { font-family:'Fraunces',serif; font-size:3rem; font-weight:700; color:#D4A017; line-height:1; }
.hero-badge-lbl { font-size:0.72rem; color:rgba(212,160,23,0.7); text-transform:uppercase; letter-spacing:0.08em; font-weight:500; text-align:center; }

.kpi-row { display:flex; gap:14px; margin-bottom:24px; }
.kpi { flex:1; background:white; border-radius:14px; padding:18px 20px 16px; border:1px solid rgba(200,134,10,0.12); position:relative; overflow:hidden; }
.kpi-accent { position:absolute; top:0;left:0;right:0; height:3px; border-radius:14px 14px 0 0; }
.kpi-icon  { font-size:1.4rem; margin-bottom:8px; display:block; }
.kpi-val   { font-family:'Fraunces',serif; font-size:2rem; font-weight:700; color:#1C0F05; line-height:1; margin-bottom:4px; }
.kpi-lbl   { font-size:0.72rem; font-weight:600; color:#9E8A78; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:2px; }
.kpi-sub   { font-size:0.75rem; color:#9E8A78; }

.section-title { display:flex; align-items:center; gap:10px; margin:28px 0 16px; }
.section-title h2 { font-family:'Fraunces',serif!important; font-size:1.15rem!important; font-weight:600!important; color:#1C0F05!important; margin:0!important; }
.section-divider { flex:1; height:1px; background:rgba(200,134,10,0.15); }

/* ── RÈGLES (simplifiées) ── */
.rule {
    background: white; border-radius: 14px;
    border: 1px solid rgba(200,134,10,0.12);
    border-left: 5px solid; padding: 14px 18px; margin-bottom: 10px;
    transition: box-shadow 0.18s;
}
.rule:hover { box-shadow: 0 4px 20px rgba(59,31,14,0.09); }
.rule-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.rule-badge  { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:20px; font-size:0.70rem; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; }
.rule-body   { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
.pill-ant    { background:rgba(28,15,5,0.07); border-radius:8px; padding:7px 14px; font-weight:600; color:#1C0F05; font-size:0.9rem; }
.pill-cons   { background:rgba(200,69,10,0.09); border-radius:8px; padding:7px 14px; font-weight:600; color:#C8450A; font-size:0.9rem; }
.rule-stats  { display:flex; align-items:center; border-top:1px solid rgba(200,134,10,0.10); padding-top:8px; gap:0; }
.stat-block  { flex:0 0 auto; text-align:center; padding:0 16px; border-right:1px solid rgba(200,134,10,0.10); }
.stat-block:first-child { padding-left:0; }
.stat-block:last-child  { border-right:none; }
.stat-val    { font-family:'Fraunces',serif; font-size:1.1rem; font-weight:600; color:#1C0F05; line-height:1.1; }
.stat-lbl    { font-size:0.67rem; color:#9E8A78; text-transform:uppercase; letter-spacing:0.06em; font-weight:500; }
.stat-interp { flex:1; padding-left:16px; font-size:0.81rem; color:#5a3010; line-height:1.45; }

.insight-box {
    background:linear-gradient(135deg,#FDF6EC,#F5E6C8);
    border:1px solid rgba(200,134,10,0.20); border-left:4px solid #C8450A;
    border-radius:0 12px 12px 0; padding:14px 18px;
    font-size:0.86rem; color:#5a3010; margin:16px 0; line-height:1.55;
}
.filter-pill {
    display:inline-flex; align-items:center; gap:6px;
    background:rgba(200,69,10,0.07); border:1px solid rgba(200,69,10,0.18);
    border-radius:20px; padding:5px 14px; font-size:0.82rem; color:#7A3D15; font-weight:500; margin-bottom:18px;
}
.legend      { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:16px; }
.legend-item { display:flex; align-items:center; gap:6px; font-size:.78rem; color:#5a3010; }
.dot         { width:10px; height:10px; border-radius:50%; flex-shrink:0; }

.meth-table  { width:100%; border-collapse:collapse; font-size:0.85rem; }
.meth-table td { padding:9px 10px; border-bottom:1px solid rgba(200,134,10,0.10); color:#3B1F0E; }
.meth-table td:first-child { color:#9E8A78; font-weight:500; width:40%; }
.formula-box {
    background:rgba(28,15,5,0.04); border-radius:8px; padding:10px 14px;
    font-family:'Courier New',monospace; font-size:0.83rem; color:#1C0F05; margin:6px 0 12px;
}
</style>
""", unsafe_allow_html=True)


# ============================================================
# CHARGEMENT DONNÉES
# ============================================================
@st.cache_data
def load_data():
    paths = [
        '/home/claude/retail_data.pkl',
        'retail_data.pkl',
        '../retail_data.pkl',
        os.path.join(os.path.dirname(__file__), 'retail_data.pkl'),
    ]
    for p in paths:
        if os.path.exists(p):
            with open(p, 'rb') as f:
                return pickle.load(f)
    return None

data = load_data()
if data is None:
    st.error("❌ Fichier `retail_data.pkl` introuvable. Placez-le dans le même dossier que ce script.")
    st.stop()

# ── Préparer les règles ──
regles_raw = data['regles'].copy()

def prep_col(col):
    return col.apply(
        lambda x: ' + '.join(sorted(x)) if hasattr(x, '__iter__') and not isinstance(x, str) else str(x)
    )

if 'antecedents_str' not in regles_raw.columns:
    regles_raw['antecedents_str'] = prep_col(regles_raw['antecedents'])
    regles_raw['consequents_str'] = prep_col(regles_raw['consequents'])

regles_raw = regles_raw.sort_values('lift', ascending=False).reset_index(drop=True)
regles_raw['rang']       = regles_raw.index + 1
regles_raw['lift_name']  = regles_raw['lift'].apply(lambda v: lift_band(v)[0])
regles_raw['lift_color'] = regles_raw['lift'].apply(lambda v: lift_band(v)[1])
regles_raw['lift_range'] = regles_raw['lift'].apply(lambda v: lift_band(v)[2])

df_clean = data['df_clean']
taille   = df_clean.groupby('ticket_number')['article'].nunique()
nb_multi = int((taille >= 2).sum())

stats = {
    'nb_tickets_multi': nb_multi,
    'nb_tickets_total': len(taille),
    'nb_produits'     : df_clean['article'].nunique(),
    'nb_regles'       : len(regles_raw),
    'lift_max'        : regles_raw['lift'].max(),
    'lift_moy'        : regles_raw['lift'].mean(),
    'nb_paires'       : int((regles_raw['antecedents_str'].str.count(r'\+') == 0).sum()),
    'nb_triplets'     : int((regles_raw['antecedents_str'].str.count(r'\+') >= 1).sum()),
}


# ============================================================
# SIDEBAR — uniquement Trier par et Top N
# ============================================================
with st.sidebar:
    st.markdown("""
    <div style="padding:20px 4px 12px;">
      <p style="font-family:'Fraunces',serif;font-size:1.25rem;font-weight:600;color:#D4A017;margin:0 0 3px;">🔍 Filtres</p>
      <p style="font-size:.75rem;color:rgba(245,230,200,.45);margin:0;font-weight:300;">Affiner l'analyse</p>
    </div>""", unsafe_allow_html=True)
    st.markdown("---")

    sort_by   = st.selectbox("↕️ Trier par", ["Lift ↓", "Confiance ↓", "Support ↓"])
    top_n_sel = st.selectbox("🏆 Top N règles", [10, 20, 30, 50, "Toutes"], index=1)
    top_n     = None if top_n_sel == "Toutes" else int(top_n_sel)

    st.markdown("---")
    st.markdown(f"""<div style="font-size:.70rem;color:rgba(245,230,200,.35);text-align:center;padding:4px 0;line-height:1.6;">
        Algorithme Apriori<br>Support ≥ 1% · Lift ≥ 1.2<br>
        {len(regles_raw)} règles au total</div>""", unsafe_allow_html=True)


# ============================================================
# FILTRAGE — uniquement tri et top N
# ============================================================
df_r = regles_raw.copy()

# Tri
sc, sa = {"Lift ↓": ('lift', False), "Confiance ↓": ('confidence', False), "Support ↓": ('support', False)}[sort_by]
df_r   = df_r.sort_values(sc, ascending=sa).reset_index(drop=True)

# Top N
if top_n:
    df_r = df_r.head(top_n)


# ============================================================
# HERO
# ============================================================
st.markdown(f"""
<div class="hero">
  <div class="hero-text">
    <h1>🥖 Market Basket Analysis</h1>
    <p>Section 2.5 · Algorithme Apriori · Boulangerie Le Croisic<br>
       Quels produits les clients achètent-ils ensemble ?</p>
  </div>
  <div class="hero-badge">
    <div class="hero-badge-val">{stats['lift_max']:.2f}</div>
    <div class="hero-badge-lbl">Lift maximum<br>détecté</div>
  </div>
</div>""", unsafe_allow_html=True)


# ============================================================
# KPI ROW
# ============================================================
kpis = [
    ('#C8450A', '🎟️', f"{stats['nb_tickets_multi']:,}", 'Tickets analysés',   'paniers multi-articles'),
    ('#E07B1A', '📌',  stats['nb_regles'],               'Règles générées',    'Lift ≥ 1.2'),
    ('#D4A017', '🏆', f"{stats['lift_max']:.2f}",        'Lift maximum',       'association la plus forte'),
    ('#3B1F0E', '🔗',  stats['nb_paires'],                'Paires fréquentes',  'support ≥ 1%'),
    ('#9E8A78', '🔺',  stats['nb_triplets'],              'Triplets fréquents', '3 produits simultanés'),
]
cols = st.columns(5)
for col, (accent, icon, val, lbl, sub) in zip(cols, kpis):
    with col:
        st.markdown(f"""
        <div class="kpi">
          <div class="kpi-accent" style="background:{accent};"></div>
          <span class="kpi-icon">{icon}</span>
          <div class="kpi-val">{val}</div>
          <div class="kpi-lbl">{lbl}</div>
          <div class="kpi-sub">{sub}</div>
        </div>""", unsafe_allow_html=True)


# ============================================================
# ONGLETS
# ============================================================
tab1, tab2, tab3, tab4 = st.tabs([
    "  🃏 Règles d'Association  ",
    "  📊 Visualisations  ",
    "  📋 Tableau Détaillé  ",
    "  📖 Méthodologie  ",
])


# ══════════════════════════════════════════════════════════════
# TAB 1 — RÈGLES D'ASSOCIATION
# ══════════════════════════════════════════════════════════════
with tab1:
    st.markdown(f"""
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
      <div class="filter-pill">
        📌 <strong>{len(df_r)} règles</strong> affichées
      </div>
    </div>""", unsafe_allow_html=True)

    # Légende compacte
    st.markdown('<div class="legend">' + ''.join(
        f'<div class="legend-item"><div class="dot" style="background:{c};"></div>'
        f'<span><b>{n}</b> &nbsp;(Lift {r})</span></div>'
        for n, lo, hi, c, r in LIFT_BANDS
    ) + '</div>', unsafe_allow_html=True)

    if df_r.empty:
        st.info("Aucune règle disponible.")
    else:
        for _, row in df_r.iterrows():
            name, color, rng = lift_band(row['lift'])
            conf_pct = row['confidence'] * 100
            supp_pct = row['support'] * 100
            interp = (
                f"Quand un client achète <strong>{row['antecedents_str'].title()}</strong>, "
                f"il a <strong>{conf_pct:.0f}%</strong> de chances d'acheter aussi "
                f"<strong>{row['consequents_str'].title()}</strong> "
                f"— soit <strong>{row['lift']:.1f}×</strong> plus qu'un acheteur aléatoire."
            )
            st.markdown(f"""
            <div class="rule" style="border-left-color:{color};">
              <div class="rule-header">
                <span class="rule-badge" style="background:{color}18;color:{color};">
                  ⚡ {name} · Lift {rng}
                </span>
                <span style="font-size:.70rem;color:#9E8A78;">Règle #{int(row['rang'])}</span>
              </div>
              <div class="rule-body">
                <div class="pill-ant">🧺 {row['antecedents_str'].title()}</div>
                <span style="font-size:1.3rem;color:#C8450A;">→</span>
                <div class="pill-cons">🎯 {row['consequents_str'].title()}</div>
              </div>
              <div class="rule-stats">
                <div class="stat-block">
                  <div class="stat-val" style="color:{color};">{row['lift']:.2f}</div>
                  <div class="stat-lbl">Lift</div>
                </div>
                <div class="stat-block">
                  <div class="stat-val">{conf_pct:.0f}%</div>
                  <div class="stat-lbl">Confiance</div>
                </div>
                <div class="stat-block">
                  <div class="stat-val">{supp_pct:.1f}%</div>
                  <div class="stat-lbl">Support</div>
                </div>
                <div class="stat-interp">{interp}</div>
              </div>
            </div>""", unsafe_allow_html=True)

    st.markdown("""
    <div class="insight-box">
      💡 <strong>Deux clusters d'achat se dégagent :</strong><br>
      &nbsp;&nbsp;🍞 <strong>Pains artisanaux</strong> — Coupe, Boule, Campagne, Vik Bread se co-achètent avec un Lift ≥ 2.7, signe d'un panier "pain de la semaine".<br>
      &nbsp;&nbsp;🥐 <strong>Viennoiseries</strong> — Croissant ↔ Pain au Chocolat (Lift ≈ 2.73), co-achat quasi systématique du petit-déjeuner.
    </div>""", unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════
# TAB 2 — VISUALISATIONS
# ══════════════════════════════════════════════════════════════
with tab2:

    st.markdown('<div class="section-title"><h2>🔵 Support × Confiance (taille = Lift)</h2><div class="section-divider"></div></div>', unsafe_allow_html=True)

    fig_sc = go.Figure()
    lift_min_data = regles_raw['lift'].min()
    lift_max_data = regles_raw['lift'].max()

    for name, lo, hi, color, rng in LIFT_BANDS:
        mask = (regles_raw['lift'] >= lo) & (regles_raw['lift'] < hi + 1)
        sub  = regles_raw[mask]
        if sub.empty:
            continue
        norm_size = 8 + 20 * (sub['lift'] - lift_min_data) / max(lift_max_data - lift_min_data, 0.01)
        fig_sc.add_trace(go.Scatter(
            x=sub['support'] * 100,
            y=sub['confidence'] * 100,
            mode='markers',
            name=f'{name} (Lift {rng})',
            marker=dict(
                size=norm_size,
                color=color,
                opacity=0.78,
                line=dict(width=1.2, color='white'),
                sizemode='diameter',
            ),
            hovertemplate=(
                "<b>%{customdata[0]}</b> → <b>%{customdata[1]}</b><br>"
                "Support   : %{x:.2f}%<br>"
                "Confiance : %{y:.1f}%<br>"
                "Lift      : %{customdata[2]:.2f}"
                "<extra></extra>"
            ),
            customdata=list(zip(
                sub['antecedents_str'].str.title(),
                sub['consequents_str'].str.title(),
                sub['lift'],
            )),
        ))

    conf_moy = regles_raw['confidence'].mean() * 100
    fig_sc.add_hline(
        y=conf_moy, line_dash="dot", line_color="#9E8A78", line_width=1.2,
        annotation_text=f"  Confiance moy. {conf_moy:.0f}%",
        annotation_font=dict(color="#9E8A78", size=9),
        annotation_position="right",
    )

    fig_sc.update_layout(
        height=430,
        plot_bgcolor='white',
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(family='Inter', size=11, color='#3B1F0E'),
        xaxis=dict(
            title=dict(text='Support (%)', font=dict(size=11, color='#5a3010')),
            ticksuffix='%',
            gridcolor='rgba(200,134,10,0.12)',
            zeroline=False,
            showline=True, linecolor='rgba(200,134,10,0.25)',
            tickfont=dict(size=10),
        ),
        yaxis=dict(
            title=dict(text='Confiance (%)', font=dict(size=11, color='#5a3010')),
            ticksuffix='%',
            gridcolor='rgba(200,134,10,0.12)',
            zeroline=False,
            showline=True, linecolor='rgba(200,134,10,0.25)',
            tickfont=dict(size=10),
        ),
        legend=dict(
            orientation='h', yanchor='bottom', y=-0.28,
            xanchor='center', x=0.5,
            bgcolor='rgba(250,246,240,0.95)',
            bordercolor='rgba(200,134,10,0.20)', borderwidth=1,
            font=dict(size=10),
        ),
        margin=dict(l=10, r=10, t=20, b=90),
    )
    fig_sc.add_annotation(
        text="Taille des bulles ∝ Lift (normalisé)",
        xref="paper", yref="paper", x=1, y=1.04,
        showarrow=False, font=dict(size=9, color='#9E8A78'), xanchor='right',
    )
    st.plotly_chart(fig_sc, use_container_width=True)
    st.caption("Chaque bulle est une règle d'association. Plus elle est grande et foncée, plus le lift est élevé.")

    st.markdown("---")

    st.markdown('<div class="section-title"><h2>🏅 Top 15 Règles par Lift</h2><div class="section-divider"></div></div>', unsafe_allow_html=True)

    top15 = regles_raw.head(15).sort_values('lift', ascending=True).reset_index(drop=True)

    def fmt_label(ant, cons, maxlen=18):
        a = ant[:maxlen] + ('…' if len(ant) > maxlen else '')
        c = cons[:maxlen] + ('…' if len(cons) > maxlen else '')
        return f"{a.title()} → {c.title()}"

    labels_y   = [fmt_label(r['antecedents_str'], r['consequents_str']) for _, r in top15.iterrows()]
    bar_colors = [lift_band(v)[1] for v in top15['lift']]

    fig_bar = go.Figure()
    fig_bar.add_trace(go.Bar(
        y=labels_y,
        x=top15['lift'],
        orientation='h',
        marker=dict(color=bar_colors, opacity=0.88, line=dict(width=0)),
        text=[f"{v:.2f}" for v in top15['lift']],
        textposition='outside',
        textfont=dict(size=10, color='#3B1F0E', family='Inter'),
        hovertemplate=(
            "<b>%{customdata[0]}</b> → <b>%{customdata[1]}</b><br>"
            "Lift      : %{x:.2f}<br>"
            "Confiance : %{customdata[2]:.0f}%<br>"
            "Support   : %{customdata[3]:.2f}%"
            "<extra></extra>"
        ),
        customdata=list(zip(
            top15['antecedents_str'].str.title(),
            top15['consequents_str'].str.title(),
            top15['confidence'] * 100,
            top15['support'] * 100,
        )),
    ))
    fig_bar.add_vline(
        x=1.0, line_dash="dash", line_color="#9E8A78", line_width=1.2,
        annotation_text="  Hasard (Lift=1)",
        annotation_font=dict(color="#9E8A78", size=9),
    )
    fig_bar.add_vline(
        x=regles_raw['lift'].mean(), line_dash="dot", line_color="#D4A017", line_width=1.2,
        annotation_text=f"  Moy. {regles_raw['lift'].mean():.2f}",
        annotation_font=dict(color="#D4A017", size=9),
    )
    fig_bar.update_layout(
        height=460,
        plot_bgcolor='white',
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(family='Inter', size=10, color='#3B1F0E'),
        xaxis=dict(
            title=dict(text='Lift', font=dict(size=11, color='#5a3010')),
            gridcolor='rgba(200,134,10,0.12)',
            zeroline=False,
            range=[0, top15['lift'].max() * 1.20],
            showline=True, linecolor='rgba(200,134,10,0.25)',
            tickfont=dict(size=10),
        ),
        yaxis=dict(tickfont=dict(size=9), automargin=True),
        margin=dict(l=10, r=70, t=20, b=40),
        showlegend=False,
    )
    st.plotly_chart(fig_bar, use_container_width=True)
    st.caption("Les lignes pointillées indiquent le hasard (Lift=1) et la moyenne des règles.")

    st.markdown("---")

    st.markdown('<div class="section-title"><h2>📉 Distribution des Lift</h2><div class="section-divider"></div></div>', unsafe_allow_html=True)

    bins     = [1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, regles_raw['lift'].max() + 0.1]
    cut      = pd.cut(regles_raw['lift'], bins=bins, right=False)
    bin_cnts = cut.value_counts().sort_index()

    bin_colors = []
    for interval in bin_cnts.index:
        mid = (interval.left + interval.right) / 2
        bin_colors.append(lift_band(mid)[1])

    fig_hist = go.Figure()
    for interval, count, color in zip(bin_cnts.index, bin_cnts.values, bin_colors):
        lbl = f"{interval.left:.1f} – {interval.right:.1f}"
        fig_hist.add_trace(go.Bar(
            x=[(interval.left + interval.right) / 2],
            y=[count],
            width=[interval.right - interval.left - 0.02],
            name=lbl,
            marker=dict(color=color, opacity=0.85, line=dict(color='white', width=1.5)),
            hovertemplate=f"Lift {lbl}<br>Règles : {count}<extra></extra>",
        ))

    for seuil, lbl, col in [(1.2, 'Légère', '#9E8A78'), (1.5, 'Modérée', '#D4A017'),
                             (2.5, 'Forte', '#E07B1A'), (4.0, 'Très forte', '#C8450A')]:
        if seuil < regles_raw['lift'].max():
            fig_hist.add_vline(
                x=seuil, line_dash="dot", line_color=col, line_width=1.8, opacity=0.8,
                annotation_text=f"<b>{lbl}</b>",
                annotation_font=dict(color=col, size=9),
                annotation_position="top right",
            )

    fig_hist.update_layout(
        height=320,
        barmode='overlay',
        plot_bgcolor='white',
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(family='Inter', size=11, color='#3B1F0E'),
        xaxis=dict(
            title=dict(text='Lift', font=dict(size=11, color='#5a3010')),
            tickvals=[1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0],
            ticktext=['1.0', '1.2', '1.5', '2.0', '2.5', '3.0', '3.5', '≥ 4.0'],
            gridcolor='rgba(200,134,10,0.12)',
            zeroline=False, showline=True, linecolor='rgba(200,134,10,0.25)',
        ),
        yaxis=dict(
            title=dict(text='Nombre de règles', font=dict(size=11, color='#5a3010')),
            gridcolor='rgba(200,134,10,0.12)',
            zeroline=False, showline=True, linecolor='rgba(200,134,10,0.25)',
        ),
        showlegend=False,
        margin=dict(l=10, r=10, t=30, b=50),
    )
    st.plotly_chart(fig_hist, use_container_width=True)
    st.caption(f"Distribution de {stats['nb_regles']} règles. La majorité se concentre dans la bande Forte (Lift 2.5–3.9).")

    st.markdown("---")

    st.markdown('<div class="section-title"><h2>🔥 Matrice Lift — Associations entre produits</h2><div class="section-divider"></div></div>', unsafe_allow_html=True)

    paires = regles_raw[regles_raw['antecedents_str'].str.count(r'\+') == 0].copy()
    paires = paires[paires['consequents_str'].str.count(r'\+') == 0]

    prod_count = {}
    for _, row in paires.iterrows():
        for p in [row['antecedents_str'], row['consequents_str']]:
            prod_count[p] = prod_count.get(p, 0) + 1
    top_prods = sorted(prod_count, key=prod_count.get, reverse=True)[:12]

    matrix = pd.DataFrame(np.nan, index=top_prods, columns=top_prods)
    for _, row in paires.iterrows():
        a, c = row['antecedents_str'], row['consequents_str']
        if a in top_prods and c in top_prods:
            cur = matrix.loc[a, c]
            matrix.loc[a, c] = row['lift'] if np.isnan(cur) else max(cur, row['lift'])
            if np.isnan(matrix.loc[c, a]):
                matrix.loc[c, a] = row['lift']

    mat_labels = [p.title() for p in top_prods]
    z_vals     = matrix.values

    z_min, z_max = 1.0, float(np.nanmax(z_vals)) if not np.all(np.isnan(z_vals)) else 5.0
    text_vals = []
    for row_ in z_vals:
        row_txt = []
        for v in row_:
            if np.isnan(v):
                row_txt.append("")
            else:
                row_txt.append(f"{v:.2f}")
        text_vals.append(row_txt)

    colorscale = [
        [0.0,  '#F5E6C8'],
        [0.25, '#F0C060'],
        [0.5,  '#E07B1A'],
        [0.75, '#C8450A'],
        [1.0,  '#3B1F0E'],
    ]

    fig_hm = go.Figure(go.Heatmap(
        z=z_vals.tolist(),
        x=mat_labels,
        y=mat_labels,
        colorscale=colorscale,
        zmin=z_min, zmax=z_max,
        text=text_vals,
        texttemplate="%{text}",
        textfont=dict(size=10, family='Inter'),
        hovertemplate="<b>%{y}</b> → <b>%{x}</b><br>Lift : %{z:.2f}<extra></extra>",
        colorbar=dict(
            title=dict(text='Lift', side='right', font=dict(size=11)),
            tickvals=[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0],
            ticktext=['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '≥4.0'],
            tickfont=dict(size=9),
            thickness=14,
            len=0.85,
        ),
    ))
    fig_hm.update_layout(
        height=480,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='white',
        font=dict(family='Inter', size=10, color='#3B1F0E'),
        xaxis=dict(
            tickangle=-40, tickfont=dict(size=9),
            showline=True, linecolor='rgba(200,134,10,0.25)',
            side='bottom',
        ),
        yaxis=dict(
            tickfont=dict(size=9), autorange='reversed',
            showline=True, linecolor='rgba(200,134,10,0.25)',
        ),
        margin=dict(l=10, r=20, t=20, b=90),
    )
    st.plotly_chart(fig_hm, use_container_width=True)
    st.caption(
        "Cases colorées = association détectée (règle Apriori). "
        "Cases blanches = aucune règle avec Lift ≥ 1.2. "
        "La matrice est quasi-symétrique car A→B et B→A sont souvent toutes deux générées."
    )

    st.markdown("---")
    st.markdown('<div class="section-title"><h2>📐 Confiance vs Lift — Vue synthétique</h2><div class="section-divider"></div></div>', unsafe_allow_html=True)

    top20 = regles_raw.head(20).copy()
    top20['label'] = top20.apply(
        lambda r: f"{r['antecedents_str'][:12].title()} → {r['consequents_str'][:12].title()}", axis=1
    )

    fig_cv = make_subplots(specs=[[{"secondary_y": True}]])
    fig_cv.add_trace(go.Bar(
        x=top20['label'],
        y=top20['confidence'] * 100,
        name='Confiance (%)',
        marker=dict(color='#D4A017', opacity=0.75),
        hovertemplate="<b>%{x}</b><br>Confiance : %{y:.1f}%<extra></extra>",
    ), secondary_y=False)
    fig_cv.add_trace(go.Scatter(
        x=top20['label'],
        y=top20['lift'],
        name='Lift',
        mode='lines+markers',
        line=dict(color='#C8450A', width=2.5),
        marker=dict(size=7, color='#C8450A', line=dict(color='white', width=1.5)),
        hovertemplate="<b>%{x}</b><br>Lift : %{y:.2f}<extra></extra>",
    ), secondary_y=True)

    fig_cv.update_layout(
        height=350,
        plot_bgcolor='white',
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(family='Inter', size=10, color='#3B1F0E'),
        xaxis=dict(tickangle=-40, tickfont=dict(size=8), gridcolor='rgba(200,134,10,0.10)'),
        legend=dict(
            orientation='h', yanchor='bottom', y=-0.35,
            xanchor='center', x=0.5, font=dict(size=10),
            bgcolor='rgba(250,246,240,0.95)',
            bordercolor='rgba(200,134,10,0.20)', borderwidth=1,
        ),
        margin=dict(l=10, r=10, t=20, b=100),
    )
    fig_cv.update_yaxes(
        title_text="Confiance (%)", ticksuffix="%",
        secondary_y=False,
        gridcolor='rgba(200,134,10,0.10)',
        tickfont=dict(color='#D4A017'),
        title_font=dict(color='#D4A017'),
    )
    fig_cv.update_yaxes(
        title_text="Lift",
        secondary_y=True,
        tickfont=dict(color='#C8450A'),
        title_font=dict(color='#C8450A'),
        showgrid=False,
    )
    st.plotly_chart(fig_cv, use_container_width=True)
    st.caption("Les barres représentent la confiance (axe gauche) et la courbe le lift (axe droit) pour les 20 meilleures règles.")


# ══════════════════════════════════════════════════════════════
# TAB 3 — TABLEAU DÉTAILLÉ
# ══════════════════════════════════════════════════════════════
with tab3:
    st.markdown('<div class="section-title"><h2>📋 Toutes les règles filtrées</h2><div class="section-divider"></div></div>', unsafe_allow_html=True)

    df_disp = df_r[['rang', 'antecedents_str', 'consequents_str',
                    'lift', 'confidence', 'support', 'lift_name']].copy()
    df_disp.columns = ['#', 'Si (Antécédent)', 'Alors (Conséquent)', 'Lift', 'Confiance', 'Support', 'Force']

    def style_force(v):
        c = {'Très forte': '#C8450A', 'Forte': '#E07B1A', 'Modérée': '#b08a00', 'Légère': '#9E8A78'}.get(v, '')
        return f'color:{c};font-weight:600'

    styled = (
        df_disp.style
        .applymap(style_force, subset=['Force'])
        .format({'Lift': '{:.2f}', 'Confiance': '{:.1%}', 'Support': '{:.3f}'})
        .bar(subset=['Lift'],      color='rgba(200,69,10,0.15)',  vmin=1, vmax=regles_raw['lift'].max())
        .bar(subset=['Confiance'], color='rgba(212,160,23,0.15)', vmin=0, vmax=1)
        .set_table_styles([
            {'selector': 'thead th', 'props': 'background:#1C0F05;color:#D4A017;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.06em;'},
            {'selector': 'tbody tr:hover', 'props': 'background:rgba(200,134,10,0.05);'},
        ])
    )
    st.dataframe(styled, use_container_width=True, height=500)

    csv = df_disp.to_csv(index=False).encode('utf-8')
    col_dl1, _ = st.columns([1, 4])
    with col_dl1:
        st.download_button("⬇️ Export CSV", csv, "mba_regles.csv", "text/csv")


# ══════════════════════════════════════════════════════════════
# TAB 4 — MÉTHODOLOGIE
# ══════════════════════════════════════════════════════════════
with tab4:
    st.markdown('<div class="section-title"><h2>📐 Métriques clés</h2><div class="section-divider"></div></div>', unsafe_allow_html=True)
    m1, m2 = st.columns(2)

    with m1:
        for metric, color, formula, desc in [
            ("Support",   "#C8450A",
             "Support(A,B) = tickets(A et B) / total tickets",
             "Fréquence de la combinaison dans tous les paniers."),
            ("Confiance", "#E07B1A",
             "Confiance(A→B) = Support(A,B) / Support(A)",
             "Probabilité d'acheter B quand A est dans le panier."),
            ("Lift",      "#D4A017",
             "Lift(A→B) = Confiance(A→B) / Support(B)",
             "Force de l'association vs hasard pur."),
        ]:
            st.markdown(f"""
            <div style="margin-bottom:18px;">
              <p style="font-weight:600;color:{color};margin:0 0 4px;font-size:.92rem;">{metric}</p>
              <p style="font-size:.82rem;color:#5a3010;margin:0 0 6px;">{desc}</p>
              <div class="formula-box">{formula}</div>
            </div>""", unsafe_allow_html=True)

        st.markdown("""
        <div style="background:rgba(200,69,10,0.05);border-radius:10px;padding:12px 16px;font-size:.82rem;color:#5a3010;line-height:1.65;">
          🔑 <strong>Lift = 1</strong> → association nulle (indépendance)<br>
          🔑 <strong>Lift > 1</strong> → association positive (les produits s'attirent)<br>
          🔑 <strong>Lift < 1</strong> → association négative (substitution)
        </div>""", unsafe_allow_html=True)

    with m2:
        st.markdown('<div class="section-title"><h2>⚙️ Paramètres Apriori</h2><div class="section-divider"></div></div>', unsafe_allow_html=True)
        params = [
            ("Périmètre",     "Tickets avec ≥ 2 articles différents"),
            ("Support min.",  "0.01 → présent dans ≥ 1% des tickets"),
            ("Lift min.",     "1.2 → association ≥ 20% > hasard"),
            ("Longueur max.", "3 articles (paires + triplets)"),
            ("Résultat",      f"{stats['nb_regles']} règles générées"),
        ]
        st.markdown('<table class="meth-table">' +
                    ''.join(f'<tr><td>{k}</td><td><strong>{v}</strong></td></tr>' for k, v in params) +
                    '</table>', unsafe_allow_html=True)

        st.markdown('<div class="section-title" style="margin-top:24px;"><h2>🎯 Plan d\'action</h2><div class="section-divider"></div></div>', unsafe_allow_html=True)
        actions = [
            ("#C8450A", "Lift ≥ 4.0",   "Îlot dédié + bundle promotionnel"),
            ("#E07B1A", "Lift 2.5–4.0", "Placement adjacent en rayon"),
            ("#D4A017", "Lift 1.5–2.5", "Suggestion à la caisse"),
            ("#9E8A78", "Lift 1.2–1.5", "Affichage digital / signalétique"),
        ]
        for color, seuil, action in actions:
            st.markdown(f"""
            <div style="display:flex;align-items:center;gap:12px;padding:9px 14px;border-radius:9px;
                        margin-bottom:7px;background:rgba(28,15,5,0.03);border-left:3px solid {color};">
              <span style="font-weight:700;color:{color};font-size:.82rem;flex-shrink:0;">{seuil}</span>
              <span style="font-size:.82rem;color:#3B1F0E;">{action}</span>
            </div>""", unsafe_allow_html=True)


# ============================================================
# FOOTER
# ============================================================
st.markdown("""
<div style="text-align:center;color:#9E8A78;font-size:.74rem;
            padding:20px 0 6px;border-top:1px solid rgba(200,134,10,0.10);margin-top:36px;">
  🥖 Section 2.5 · Market Basket Analysis · Algorithme Apriori
  · Support ≥ 1% · Lift ≥ 1.2 · Boulangerie Le Croisic
</div>""", unsafe_allow_html=True)
