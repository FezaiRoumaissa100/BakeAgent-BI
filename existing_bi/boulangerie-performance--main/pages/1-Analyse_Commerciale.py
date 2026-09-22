import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import pandas as pd
import pickle

st.set_page_config(
    page_title="CA & Activité — Le Croisic",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ============================================================
# PALETTE
# ============================================================
C1      = '#C4A882'          # beige foncé
C2      = '#C8860A'
C3      = '#E6A817'
PALETTE = [C1, C2, C3, '#27AE60', '#3498DB', '#8E44AD', '#E74C3C', '#1ABC9C',
           '#F39C12', '#2ECC71', '#9B59B6', '#16A085']

# ============================================================
# CSS
# ============================================================
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');

html, body, [class*="css"] { font-family: 'DM Sans', sans-serif; background: #FAF6F0 !important; }
.main, .stApp { background: #FAF6F0 !important; }
.block-container { padding: 0 2.5rem 3rem !important; max-width: 1400px !important; }

[data-testid="stSidebar"] {
    background: linear-gradient(180deg,#C4A882,#D4BC9A 60%,#C4A882) !important;
    border-right: none !important;
}
[data-testid="stSidebar"] * { color: #4A3728 !important; }
[data-testid="stSidebar"] label {
    color: #5C4033 !important; font-size:.76rem !important;
    font-weight:500 !important; text-transform:uppercase !important; letter-spacing:.06em !important;
}
[data-testid="stSidebar"] .stSelectbox > div > div {
    background: rgba(255,255,255,.30) !important;
    border: 1px solid rgba(90,60,40,.25) !important;
    border-radius: 10px !important;
}
[data-testid="stSidebar"] hr { border-color:rgba(90,60,40,.18) !important; margin:1rem 0 !important; }

/* ── PAGE HEADER ── */
.page-header {
    background: linear-gradient(135deg,#C4A882,#D4BC9A 50%,#E6C99A);
    border-radius: 20px; padding: 32px 40px; margin: 2rem 0 24px;
    position: relative; overflow: hidden;
}
.page-header::before {
    content:'📊'; position:absolute; right:40px; top:50%;
    transform:translateY(-50%); font-size:5rem; opacity:.15;
}
.page-header h1 {
    font-family:'Playfair Display',serif !important;
    font-size:1.9rem !important; color:#3B2510 !important;
    margin:0 0 6px !important; font-weight:700 !important;
}
.page-header p { color:rgba(60,35,15,.70) !important; font-size:.9rem !important; margin:0 !important; }

/* ── SECTION TITLE ── */
.sec-title {
    display:flex; align-items:center; gap:12px;
    font-family:'Playfair Display',serif;
    font-size:1.15rem; font-weight:700; color:#5C4033;
    margin: 28px 0 18px;
}
.sec-title::after {
    content:''; flex:1; height:1px;
    background:linear-gradient(90deg,rgba(196,168,130,.5),transparent);
}
.sec-title .ico {
    width:36px; height:36px; border-radius:50%;
    background:rgba(196,168,130,.20); border:1.5px solid rgba(196,168,130,.5);
    display:flex; align-items:center; justify-content:center; font-size:1rem; flex-shrink:0;
}

/* ── KPI CARDS ── */
.kpi-card {
    background:white; border:1px solid rgba(196,168,130,.25);
    border-radius:16px; padding:20px 22px;
    position:relative; overflow:hidden;
    transition:transform .2s, box-shadow .2s;
}
.kpi-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(196,168,130,.25); }
.kpi-card::after {
    content:''; position:absolute; bottom:0; left:0; right:0; height:3px; border-radius:0 0 16px 16px;
}
.kpi-card.a::after{background:#C4A882} .kpi-card.b::after{background:#C8860A}
.kpi-card.c::after{background:#E6A817} .kpi-card.d::after{background:#27AE60}
.kpi-card.e::after{background:#3498DB}
.kpi-lbl { font-size:.70rem; color:#C4A882; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; font-weight:500; }
.kpi-val { font-family:'Playfair Display',serif; font-size:1.85rem; font-weight:700; color:#5C4033; line-height:1; }
.kpi-sub { font-size:.73rem; color:#9E8A78; margin-top:4px; }

/* ── FILTER PILL ── */
.filter-pill {
    display:inline-flex; align-items:center; gap:6px;
    background:rgba(196,168,130,.12); border:1px solid rgba(196,168,130,.35);
    border-radius:20px; padding:4px 14px; font-size:.80rem; color:#5C4033;
    margin:0 4px 8px 0;
}

/* ── INSIGHT BOX ── */
.insight {
    background:linear-gradient(135deg,#FDF6EC,#F5E6C8);
    border:1px solid rgba(196,168,130,.30); border-left:4px solid #C4A882;
    border-radius:0 12px 12px 0; padding:14px 18px;
    font-size:.87rem; color:#5C4033; margin:16px 0;
}

/* ── TABS ── */
.stTabs [data-baseweb="tab-list"] {
    background:transparent; gap:4px;
    border-bottom:2px solid rgba(196,168,130,.30) !important;
}
.stTabs [data-baseweb="tab"] {
    background:transparent; border:none; border-radius:8px 8px 0 0 !important;
    color:#9E8A78 !important; font-size:.88rem !important; padding:10px 20px !important;
    transition:all .2s;
}
.stTabs [aria-selected="true"] {
    background:rgba(196,168,130,.12) !important;
    color:#5C4033 !important; font-weight:500 !important;
    border-bottom:2px solid #C4A882 !important;
}

/* ── DELTA BADGE ── */
.delta-up   { color:#27AE60; font-size:.80rem; font-weight:600; }
.delta-down { color:#E74C3C; font-size:.80rem; font-weight:600; }
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
    st.error("❌ Fichier `retail_data.pkl` introuvable.")
    st.stop()

df_all  = data['df_clean']
ca_mens = data['ca_mensuel']

# ============================================================
# SIDEBAR — FILTRES
# ============================================================
with st.sidebar:
    st.markdown("""
    <div style="padding:20px 4px 8px;">
      <p style="font-family:'Playfair Display',serif;font-size:1.25rem;font-weight:700;
                color:#4A3728;margin:0 0 4px;">🔍 Filtres</p>
      <p style="font-size:.76rem;color:rgba(74,55,40,.6);margin:0;">Affinez l'analyse</p>
    </div>
    """, unsafe_allow_html=True)
    st.markdown("---")

    st.markdown("##### 📅 Année")
    annee = st.selectbox("", ["2024 + 2025","2024","2025"], label_visibility="collapsed")
    st.markdown("---")

    st.markdown("##### 📆 Saison")
    saison = st.selectbox("", ["Toutes","Printemps","Ete","Automne","Hiver"], label_visibility="collapsed")
    st.markdown("---")

    mois_noms = ["Tous","Janvier","Février","Mars","Avril","Mai","Juin",
                 "Juillet","Août","Septembre","Octobre","Novembre","Décembre"]
    st.markdown("##### 🗓️ Mois")
    mois = st.selectbox("", mois_noms, label_visibility="collapsed")
    st.markdown("---")

    cats = ["Toutes"]
    if 'category' in df_all.columns:
        cats += sorted(df_all[df_all['category'] != 'A CLASSIFIER']['category'].unique().tolist())
    st.markdown("##### 🏷️ Catégorie")
    categorie = st.selectbox("", cats, label_visibility="collapsed")
    st.markdown("---")

    events = ["Tous"]
    if 'event' in df_all.columns:
        events += sorted(df_all[df_all['event'] != 'Jour Normal']['event'].unique().tolist())
    st.markdown("##### 🎉 Événement")
    evenement = st.selectbox("", events, label_visibility="collapsed")

    st.markdown("---")
    st.markdown("""<div style="font-size:.70rem;color:rgba(74,55,40,.45);
                text-align:center;padding:6px 0;">Boulangerie Le Croisic · 2024–2025</div>""",
                unsafe_allow_html=True)

# ============================================================
# FILTRAGE
# ============================================================
df = df_all.copy()
if annee == "2024": df = df[df['date'].dt.year == 2024]
elif annee == "2025": df = df[df['date'].dt.year == 2025]
if saison != "Toutes" and 'season' in df.columns: df = df[df['season'] == saison]
if mois != "Tous": df = df[df['date'].dt.month == mois_noms.index(mois)]
if categorie != "Toutes" and 'category' in df.columns: df = df[df['category'] == categorie]
if evenement != "Tous" and 'event' in df.columns: df = df[df['event'] == evenement]

if df.empty:
    st.warning("⚠️ Aucune donnée pour cette combinaison de filtres.")
    st.stop()

# ============================================================
# EN-TÊTE
# ============================================================
st.markdown("""
<div class="page-header">
  <h1>Analyse Commerciale & Activité</h1>
  <p>Section 2.1 · Évolution du CA, performance produits, saisonnalité · Boulangerie Le Croisic · 2024–2025</p>
</div>
""", unsafe_allow_html=True)

filtres = []
if annee != "2024 + 2025": filtres.append(f"📅 {annee}")
if saison != "Toutes":     filtres.append(f"📆 {saison}")
if mois != "Tous":         filtres.append(f"🗓️ {mois}")
if categorie != "Toutes":  filtres.append(f"🏷️ {categorie}")
if evenement != "Tous":    filtres.append(f"🎉 {evenement}")

if filtres:
    pills = "".join([f'<span class="filter-pill">✦ {f}</span>' for f in filtres])
    st.markdown(f'<div style="margin-bottom:12px;">{pills}</div>', unsafe_allow_html=True)

# ============================================================
# KPIs
# ============================================================
total_ca    = df['total_revenue'].sum()
nb_tickets  = df['ticket_number'].nunique()
nb_jours    = df['date'].nunique()
panier      = total_ca / nb_tickets if nb_tickets > 0 else 0
nb_produits = df['article'].nunique()

ca_ref   = df_all['total_revenue'].sum()
delta_ca = (total_ca - ca_ref) / ca_ref * 100 if ca_ref > 0 and filtres else None

st.markdown("""
<div class="sec-title"><div class="ico">📊</div> Indicateurs Clés de Performance</div>
""", unsafe_allow_html=True)

c1,c2,c3,c4,c5 = st.columns(5)
for col, cls, label, value, sub in [
    (c1,"a","CA Total",      f"{total_ca/1000:.1f} k€",  "chiffre d'affaires"),
    (c2,"b","Tickets",       f"{nb_tickets:,}",           "transactions clients"),
    (c3,"c","Panier Moyen",  f"{panier:.2f} €",           "par visite"),
    (c4,"d","Jours Actifs",  f"{nb_jours}",               "jours avec ventes"),
    (c5,"e","Références",    f"{nb_produits}",            "produits vendus"),
]:
    with col:
        st.markdown(f"""
        <div class="kpi-card {cls}">
          <div class="kpi-lbl">{label}</div>
          <div class="kpi-val">{value}</div>
          <div class="kpi-sub">{sub}</div>
        </div>""", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# ============================================================
# ONGLETS
# ============================================================
tab1, tab2, tab3, tab4 = st.tabs([
    "  📈  Évolution du CA  ",
    "  🏆  Top Produits  ",
    "  📅  Saisonnalité  ",
    "  🏷️  Catégories  ",
])

# ─────────────────────────────────────────────────
# TAB 1 — ÉVOLUTION DU CA
# ─────────────────────────────────────────────────
with tab1:
    st.markdown("""
    <div class="sec-title"><div class="ico">📈</div>
    Évolution Mensuelle du Chiffre d'Affaires
    </div>""", unsafe_allow_html=True)

    # ── Toujours basé sur df_clean complet (comme le notebook) ──
    ca_plot = (df_all.groupby(df_all['date'].dt.to_period('M').dt.to_timestamp())['total_revenue']
               .sum().reset_index())
    ca_plot.columns = ['date', 'ca']

    moyenne    = float(ca_plot['ca'].mean())
    ecart_type = float(ca_plot['ca'].std())
    idx_max    = ca_plot['ca'].idxmax()
    idx_min    = ca_plot['ca'].idxmin()

    fig1 = go.Figure()

    # Zone ±1 écart-type
    fig1.add_hrect(
        y0=moyenne - ecart_type, y1=moyenne + ecart_type,
        fillcolor=C1, opacity=0.12, line_width=0,
        annotation_text=f'Zone ±1 écart-type ({ecart_type:,.0f} EUR)',
        annotation_position='top left',
        annotation_font=dict(color=C1, size=10),
    )

    # Lignes +1σ / -1σ
    fig1.add_hline(y=moyenne + ecart_type, line_dash='dot', line_color=C1, line_width=1,
                   annotation_text=f'+1σ : {moyenne + ecart_type:,.0f} EUR',
                   annotation_position='top left',
                   annotation_font=dict(color=C1, size=10))
    fig1.add_hline(y=moyenne - ecart_type, line_dash='dot', line_color=C1, line_width=1,
                   annotation_text=f'-1σ : {moyenne - ecart_type:,.0f} EUR',
                   annotation_position='bottom left',
                   annotation_font=dict(color=C1, size=10))

    # Ligne moyenne
    fig1.add_hline(
        y=moyenne, line_dash='dash', line_color=C3, line_width=1.8,
        annotation_text=f'Moyenne : {moyenne:,.0f} EUR',
        annotation_position='top right',
        annotation_font=dict(color=C3, size=11, family='DM Sans'),
    )

    # Courbe CA (comme notebook)
    fig1.add_trace(go.Scatter(
        x=ca_plot['date'], y=ca_plot['ca'],
        name='CA Mensuel',
        mode='lines+markers',
        line=dict(color=C1, width=2.5),
        marker=dict(size=7, color=C2, line=dict(color=C1, width=1.5)),
        fill='tozeroy', fillcolor=f'rgba(200,134,10,0.10)',
        hovertemplate='<b>%{x|%b %Y}</b><br>CA : <b>%{y:,.0f} €</b><extra></extra>',
    ))

    # Annotations MAX / MIN
    for idx, label in [(idx_max, 'MAX'), (idx_min, 'MIN')]:
        val   = ca_plot.loc[idx, 'ca']
        color = C2 if label == 'MAX' else C1
        fig1.add_annotation(
            x=ca_plot.loc[idx, 'date'], y=val,
            text=f'<b>{label}<br>{val:,.0f} EUR</b>',
            showarrow=True, arrowhead=2, arrowcolor=color,
            font=dict(color=color, size=10),
            ay=-35, ax=0,
        )

    fig1.update_layout(
        height=460,
        plot_bgcolor='rgba(250,246,240,0.6)', paper_bgcolor='rgba(0,0,0,0)',
        font=dict(family='DM Sans'),
        yaxis=dict(title='CA (€)', gridcolor='rgba(196,168,130,.15)', zeroline=False,
                   tickformat=',.0f'),
        xaxis=dict(tickformat='%b %Y', gridcolor='rgba(196,168,130,.10)',
                   dtick='M2'),
        legend=dict(orientation='h', yanchor='bottom', y=-0.2, xanchor='center', x=0.5,
                    bgcolor='rgba(250,246,240,.95)', bordercolor='rgba(196,168,130,.3)', borderwidth=1),
        margin=dict(l=10, r=10, t=20, b=60),
        hovermode='x unified',
    )
    st.plotly_chart(fig1, use_container_width=True)

    ca_max = ca_plot.loc[idx_max]
    ca_min = ca_plot.loc[idx_min]

    mc1, mc2, mc3 = st.columns(3)
    with mc1:
        st.markdown(f"""<div class="insight">
        📈 <strong>Meilleur mois :</strong> {ca_max['date'].strftime('%B %Y')} —
        <strong>{ca_max['ca']:,.0f} €</strong>
        </div>""", unsafe_allow_html=True)
    with mc2:
        st.markdown(f"""<div class="insight">
        📉 <strong>Mois le plus faible :</strong> {ca_min['date'].strftime('%B %Y')} —
        <strong>{ca_min['ca']:,.0f} €</strong>
        </div>""", unsafe_allow_html=True)
    with mc3:
        amplitude = ca_max['ca'] - ca_min['ca']
        st.markdown(f"""<div class="insight">
        📊 <strong>Amplitude saisonnière :</strong>
        <strong>{amplitude:,.0f} €</strong> — ratio {ca_max['ca']/ca_min['ca']:.1f}×
        </div>""", unsafe_allow_html=True)

    if annee == "2024 + 2025":
        st.markdown("""
        <div class="sec-title" style="margin-top:32px;"><div class="ico">⚖️</div>
        Comparaison 2024 vs 2025 — Mois par Mois
        </div>""", unsafe_allow_html=True)

        df24 = df_all[df_all['date'].dt.year == 2024]
        df25 = df_all[df_all['date'].dt.year == 2025]
        ca24 = df24.groupby(df24['date'].dt.month)['total_revenue'].sum()
        ca25 = df25.groupby(df25['date'].dt.month)['total_revenue'].sum()

        mois_labels = ['Jan','Fév','Mar','Avr','Mai','Jun',
                       'Jul','Aoû','Sep','Oct','Nov','Déc']
        months_common = sorted(set(ca24.index) & set(ca25.index))
        labels_x = [mois_labels[m-1] for m in months_common]

        fig_cmp = go.Figure()
        fig_cmp.add_trace(go.Bar(
            x=labels_x, y=[ca24.get(m,0) for m in months_common],
            name='2024', marker_color=C1, opacity=0.85,
            hovertemplate='2024 — %{x} : <b>%{y:,.0f} €</b><extra></extra>',
        ))
        fig_cmp.add_trace(go.Bar(
            x=labels_x, y=[ca25.get(m,0) for m in months_common],
            name='2025', marker_color=C2, opacity=0.85,
            hovertemplate='2025 — %{x} : <b>%{y:,.0f} €</b><extra></extra>',
        ))
        fig_cmp.update_layout(
            height=360, barmode='group', bargap=0.2, bargroupgap=0.05,
            plot_bgcolor='rgba(250,246,240,0.6)', paper_bgcolor='rgba(0,0,0,0)',
            font=dict(family='DM Sans'),
            yaxis=dict(title='CA (€)', gridcolor='rgba(196,168,130,.15)', zeroline=False),
            legend=dict(orientation='h', yanchor='bottom', y=-0.22, xanchor='center', x=0.5,
                        bgcolor='rgba(250,246,240,.95)', bordercolor='rgba(196,168,130,.3)', borderwidth=1),
            margin=dict(l=10,r=10,t=10,b=60),
            hovermode='x unified',
        )
        st.plotly_chart(fig_cmp, use_container_width=True)

# ─────────────────────────────────────────────────
# TAB 2 — TOP PRODUITS
# ─────────────────────────────────────────────────
with tab2:
    st.markdown("""
    <div class="sec-title"><div class="ico">🏆</div>
    Classement des Produits par Chiffre d'Affaires
    </div>""", unsafe_allow_html=True)

    n_top = st.slider("Nombre de produits à afficher", 5, 20, 10)

    top_n = (df.groupby('article')['total_revenue'].sum()
               .sort_values(ascending=False).head(n_top).reset_index())
    top_n['part']    = (top_n['total_revenue'] / total_ca * 100).round(1)
    top_n['article'] = top_n['article'].str.title()
    top_n['cumul']   = top_n['part'].cumsum()

    col_bar, col_pie = st.columns([3, 2])

    with col_bar:
        colors = [C1 if i < 3 else C2 if i < int(n_top*0.6) else C3
                  for i in range(len(top_n))]
        fig2 = go.Figure(go.Bar(
            x=top_n['total_revenue'],
            y=top_n['article'],
            orientation='h',
            marker=dict(color=colors, opacity=0.88, line=dict(width=0)),
            text=[f"<b>{p:.1f}%</b>" for p in top_n['part']],
            textposition='outside',
            hovertemplate=(
                "<b>%{y}</b><br>"
                "CA : <b>%{x:,.0f} €</b><br>"
                "Part : %{customdata:.1f}%<extra></extra>"
            ),
            customdata=top_n['part'],
        ))
        fig2.update_yaxes(autorange='reversed')
        fig2.update_layout(
            height=max(400, n_top * 38),
            plot_bgcolor='rgba(250,246,240,0.6)', paper_bgcolor='rgba(0,0,0,0)',
            font=dict(family='DM Sans'),
            xaxis=dict(title='CA (€)', gridcolor='rgba(196,168,130,.15)', zeroline=False),
            yaxis=dict(tickfont=dict(size=11, color='#5C4033')),
            margin=dict(l=10,r=80,t=10,b=40),
            showlegend=False,
        )
        st.plotly_chart(fig2, use_container_width=True)

    with col_pie:
        fig_pie = go.Figure(go.Pie(
            labels=top_n['article'],
            values=top_n['total_revenue'],
            hole=0.50,
            marker=dict(colors=PALETTE * 2, line=dict(color='white', width=1.5)),
            textinfo='percent',
            textfont=dict(size=10),
            hovertemplate='<b>%{label}</b><br>%{value:,.0f} €<br>%{percent}<extra></extra>',
        ))
        fig_pie.update_layout(
            height=max(400, n_top * 38),
            paper_bgcolor='rgba(0,0,0,0)',
            font=dict(family='DM Sans'),
            legend=dict(font=dict(size=10), orientation='v'),
            margin=dict(t=10,b=40,l=10,r=10),
            annotations=[dict(
                text=f"<b>{total_ca/1000:.0f}k€</b>",
                x=0.5, y=0.5, font_size=14, font_color='#5C4033', showarrow=False
            )],
        )
        st.plotly_chart(fig_pie, use_container_width=True)

    top80 = top_n[top_n['cumul'] <= 80.5]
    st.markdown(f"""<div class="insight">
    📌 <strong>Règle de Pareto :</strong> Les <strong>{len(top80)} premiers produits</strong>
    génèrent <strong>{top80['part'].sum():.1f}%</strong> du CA total filtré.
    {"✅ Loi 80/20 validée." if len(top80) <= n_top * 0.25 else "⚠️ Concentration modérée."}
    </div>""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────
# TAB 3 — SAISONNALITÉ
# ─────────────────────────────────────────────────
with tab3:
    st.markdown("""
    <div class="sec-title"><div class="ico">📅</div>
    Saisonnalité — CA par Jour de la Semaine
    </div>""", unsafe_allow_html=True)

    ordre  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    labels = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']
    ca_j   = df.groupby(df['date'].dt.day_name())['total_revenue'].sum().reindex(ordre).fillna(0)
    nb_j   = df.groupby(df['date'].dt.day_name())['date'].nunique().reindex(ordre).fillna(1)
    ca_moy = (ca_j / nb_j).fillna(0)

    col1, col2 = st.columns(2)

    with col1:
        fig3 = go.Figure(go.Bar(
            x=labels, y=ca_j.values,
            marker=dict(
                color=[C1 if v == ca_j.max() else C2 if v >= ca_j.mean() else C3
                       for v in ca_j.values],
                opacity=0.88, line=dict(width=0),
            ),
            text=[f'<b>{v:,.0f} €</b>' for v in ca_j.values],
            textposition='outside',
            hovertemplate='<b>%{x}</b><br>CA total : <b>%{y:,.0f} €</b><extra></extra>',
        ))
        fig3.update_layout(
            height=380,
            plot_bgcolor='rgba(250,246,240,0.6)', paper_bgcolor='rgba(0,0,0,0)',
            font=dict(family='DM Sans'),
            yaxis=dict(title='CA total (€)', gridcolor='rgba(196,168,130,.15)', zeroline=False),
            title=dict(text='CA Cumulé par Jour', font=dict(color='#5C4033', size=13)),
            margin=dict(l=10,r=10,t=40,b=40),
            showlegend=False,
        )
        st.plotly_chart(fig3, use_container_width=True)

    with col2:
        fig3b = go.Figure(go.Bar(
            x=labels, y=ca_moy.values,
            marker=dict(
                color=[C1 if v == ca_moy.max() else C2 if v >= ca_moy.mean() else C3
                       for v in ca_moy.values],
                opacity=0.88, line=dict(width=0),
            ),
            text=[f'<b>{v:,.0f} €</b>' for v in ca_moy.values],
            textposition='outside',
            hovertemplate='<b>%{x}</b><br>CA moyen : <b>%{y:,.0f} €</b><extra></extra>',
        ))
        fig3b.update_layout(
            height=380,
            plot_bgcolor='rgba(250,246,240,0.6)', paper_bgcolor='rgba(0,0,0,0)',
            font=dict(family='DM Sans'),
            yaxis=dict(title='CA moyen (€)', gridcolor='rgba(196,168,130,.15)', zeroline=False),
            title=dict(text='CA Moyen par Jour (normalisé)', font=dict(color='#5C4033', size=13)),
            margin=dict(l=10,r=10,t=40,b=40),
            showlegend=False,
        )
        st.plotly_chart(fig3b, use_container_width=True)

    best_day  = labels[list(ca_moy.values).index(max(ca_moy.values))]
    worst_day = labels[list(ca_moy.values).index(min(ca_moy.values))]
    st.markdown(f"""<div class="insight">
    📅 <strong>Meilleur jour :</strong> <strong>{best_day}</strong>
    ({max(ca_moy.values):,.0f} €/j en moyenne) &nbsp;·&nbsp;
    <strong>Jour le plus faible :</strong> <strong>{worst_day}</strong>
    ({min(ca_moy.values):,.0f} €/j) — ratio {max(ca_moy.values)/max(min(ca_moy.values),1):.1f}×
    </div>""", unsafe_allow_html=True)

    if 'hour' in df.columns:
        st.markdown("""
        <div class="sec-title" style="margin-top:28px;"><div class="ico">🕐</div>
        Distribution Horaire des Ventes
        </div>""", unsafe_allow_html=True)

        ca_h   = df.groupby('hour')['total_revenue'].sum().reset_index()
        tick_h = df.groupby('hour')['ticket_number'].nunique().reset_index()

        fig4 = make_subplots(specs=[[{"secondary_y": True}]])
        fig4.add_trace(go.Bar(
            x=ca_h['hour'], y=ca_h['total_revenue'],
            name='CA par heure', marker_color=C2, opacity=0.80,
            hovertemplate='<b>%{x}h</b> — CA : <b>%{y:,.0f} €</b><extra></extra>',
        ), secondary_y=False)
        fig4.add_trace(go.Scatter(
            x=tick_h['hour'], y=tick_h['ticket_number'],
            name='Tickets', line=dict(color=C1, width=2),
            mode='lines+markers', marker=dict(size=5),
            hovertemplate='<b>%{x}h</b> — Tickets : <b>%{y}</b><extra></extra>',
        ), secondary_y=True)

        fig4.update_layout(
            height=360,
            plot_bgcolor='rgba(250,246,240,0.6)', paper_bgcolor='rgba(0,0,0,0)',
            font=dict(family='DM Sans'),
            xaxis=dict(title='Heure', dtick=1, gridcolor='rgba(196,168,130,.10)'),
            yaxis=dict(title='CA (€)', gridcolor='rgba(196,168,130,.15)', zeroline=False),
            yaxis2=dict(title='Tickets', zeroline=False, overlaying='y', side='right'),
            legend=dict(orientation='h', yanchor='bottom', y=-0.22, xanchor='center', x=0.5,
                        bgcolor='rgba(250,246,240,.95)', bordercolor='rgba(196,168,130,.3)', borderwidth=1),
            margin=dict(l=10,r=60,t=10,b=70),
            hovermode='x unified',
        )
        st.plotly_chart(fig4, use_container_width=True)

# ─────────────────────────────────────────────────
# TAB 4 — CATÉGORIES
# ─────────────────────────────────────────────────
with tab4:
    st.markdown("""
    <div class="sec-title"><div class="ico">🏷️</div>
    Performance par Catégorie de Produits
    </div>""", unsafe_allow_html=True)

    if 'category' not in df.columns:
        st.info("Colonne 'category' non disponible.")
    else:
        cat = (df[df['category'] != 'A CLASSIFIER']
               .groupby('category')
               .agg(CA=('total_revenue','sum'),
                    Panier=('total_revenue','mean'),
                    Tickets=('ticket_number','nunique'),
                    Produits=('article','nunique'))
               .sort_values('CA', ascending=False))
        cat['Part_%'] = (cat['CA'] / cat['CA'].sum() * 100).round(1)

        st.markdown("""
        <div class="sec-title" style="font-size:1rem;margin-top:0;">
        <div class="ico">🗺️</div> Treemap — Poids des Catégories
        </div>""", unsafe_allow_html=True)

        fig_tm = px.treemap(
            cat.reset_index(),
            path=['category'], values='CA',
            color='Part_%',
            color_continuous_scale=['#F5E6C8','#D4BC9A','#C4A882'],
            hover_data={'Part_%':':.1f','Panier':':.2f'},
        )
        fig_tm.update_traces(
            texttemplate='<b>%{label}</b><br>%{value:,.0f} €<br>%{customdata[0]:.1f}%',
            hovertemplate='<b>%{label}</b><br>CA : %{value:,.0f} €<br>Part : %{customdata[0]:.1f}%<extra></extra>',
        )
        fig_tm.update_layout(
            height=380,
            paper_bgcolor='rgba(0,0,0,0)',
            margin=dict(l=10,r=10,t=10,b=10),
            coloraxis_showscale=False,
        )
        st.plotly_chart(fig_tm, use_container_width=True)

        col1, col2 = st.columns(2)
        with col1:
            fig5 = go.Figure(go.Bar(
                x=cat['CA'], y=cat.index, orientation='h',
                marker=dict(color=PALETTE[:len(cat)], opacity=0.88, line=dict(width=0)),
                text=[f"<b>{p:.1f}%</b>" for p in cat['Part_%']],
                textposition='outside',
                hovertemplate='<b>%{y}</b><br>CA : <b>%{x:,.0f} €</b><extra></extra>',
            ))
            fig5.update_yaxes(autorange='reversed')
            fig5.update_layout(
                height=380,
                plot_bgcolor='rgba(250,246,240,0.6)', paper_bgcolor='rgba(0,0,0,0)',
                font=dict(family='DM Sans'),
                xaxis=dict(title='CA (€)', gridcolor='rgba(196,168,130,.15)', zeroline=False),
                title=dict(text='CA par Catégorie', font=dict(color='#5C4033', size=13)),
                margin=dict(l=10,r=80,t=40,b=40),
                showlegend=False,
            )
            st.plotly_chart(fig5, use_container_width=True)

        with col2:
            fig5b = go.Figure(go.Bar(
                x=cat['Panier'], y=cat.index, orientation='h',
                marker=dict(color=PALETTE[:len(cat)], opacity=0.88, line=dict(width=0)),
                text=[f"<b>{v:.2f} €</b>" for v in cat['Panier']],
                textposition='outside',
                hovertemplate='<b>%{y}</b><br>Panier : <b>%{x:.2f} €</b><extra></extra>',
            ))
            fig5b.update_yaxes(autorange='reversed')
            fig5b.update_layout(
                height=380,
                plot_bgcolor='rgba(250,246,240,0.6)', paper_bgcolor='rgba(0,0,0,0)',
                font=dict(family='DM Sans'),
                xaxis=dict(title='Panier moyen (€)', gridcolor='rgba(196,168,130,.15)', zeroline=False),
                title=dict(text='Panier Moyen par Catégorie', font=dict(color='#5C4033', size=13)),
                margin=dict(l=10,r=80,t=40,b=40),
                showlegend=False,
            )
            st.plotly_chart(fig5b, use_container_width=True)

        st.markdown("""
        <div class="sec-title" style="font-size:1rem;"><div class="ico">📋</div>
        Tableau Récapitulatif des Catégories
        </div>""", unsafe_allow_html=True)

        df_table = cat.reset_index()[['category','CA','Part_%','Panier','Tickets','Produits']].copy()
        df_table.columns = ['Catégorie','CA (€)','Part (%)','Panier moy. (€)','Tickets','Produits']

        styled = (df_table.style
                  .format({'CA (€)':'{:,.0f}','Part (%)':'{:.1f}','Panier moy. (€)':'{:.2f}',
                           'Tickets':'{:,}','Produits':'{:,}'})
                  .bar(subset=['CA (€)'], color='rgba(196,168,130,.30)', vmin=0)
                  .bar(subset=['Part (%)'], color='rgba(196,168,130,.20)', vmin=0, vmax=100))
        st.dataframe(styled, use_container_width=True, hide_index=True)

# ============================================================
# FOOTER
# ============================================================
st.markdown("""
<div style="text-align:center;color:#9E8A78;font-size:.77rem;
            padding:24px 0 8px;border-top:1px solid rgba(196,168,130,.20);margin-top:32px;">
  📊 Section 2.1 · Analyse Commerciale & Activité · Boulangerie Le Croisic · 2024–2025
</div>
""", unsafe_allow_html=True)
