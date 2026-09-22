import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pickle
import os

# ============================================================
# CONFIG PAGE
# ============================================================
st.set_page_config(
    page_title="Repurchase Frequency",
    page_icon="🔁",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ============================================================
# PALETTE
# ============================================================
COLOR_FREQ = {
    'Produit Quotidien (100%)'  : '#C8450A',
    'Produit Regulier (75-99%)' : '#E07B1A',
    'Produit Cyclique (50-74%)' : '#E6B830',
    'Produit Sporadique (<50%)' : '#9E8A78',
}
EMOJI_FREQ = {
    'Produit Quotidien (100%)'  : '🔴',
    'Produit Regulier (75-99%)' : '🟠',
    'Produit Cyclique (50-74%)' : '🟡',
    'Produit Sporadique (<50%)' : '⚫',
}
ORDRE_FREQ = list(COLOR_FREQ.keys())

# ============================================================
# CSS
# ============================================================
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@300;400;500&display=swap');

html, body, [class*="css"] { font-family: 'DM Sans', sans-serif; }
.main { background-color: #FAF6F0; }
.block-container { padding: 2rem 2.5rem 3rem; max-width: 1400px; }

[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #3B1F0E 0%, #5C2D0F 60%, #7A3D15 100%);
    border-right: none;
}
[data-testid="stSidebar"] * { color: #F5E6C8 !important; }
[data-testid="stSidebar"] label {
    color: #F5C98A !important; font-size: 0.76rem !important;
    font-weight: 500 !important; text-transform: uppercase !important;
    letter-spacing: 0.06em !important;
}
[data-testid="stSidebar"] .stSelectbox > div > div,
[data-testid="stSidebar"] .stMultiSelect > div > div {
    background: rgba(255,255,255,0.10) !important;
    border: 1px solid rgba(245,200,138,0.35) !important;
    border-radius: 10px !important;
}
[data-testid="stSidebar"] .stTextInput input {
    background: rgba(255,255,255,0.10) !important;
    border: 1px solid rgba(245,200,138,0.35) !important;
    border-radius: 10px !important; color: #F5E6C8 !important;
}
[data-testid="stSidebar"] hr {
    border-color: rgba(245,200,138,0.18) !important; margin: 1rem 0 !important;
}

.page-header {
    background: linear-gradient(135deg, #3B1F0E 0%, #7A3D15 50%, #C8450A 100%);
    border-radius: 20px; padding: 32px 40px; margin-bottom: 28px;
    position: relative; overflow: hidden;
}
.page-header::before {
    content: '🔁'; position: absolute; right: 40px; top: 50%;
    transform: translateY(-50%); font-size: 5rem; opacity: 0.10;
}
.page-header h1 {
    font-family: 'Playfair Display', serif !important;
    font-size: 1.9rem !important; color: white !important;
    margin: 0 0 6px !important; font-weight: 700 !important;
}
.page-header p { color: rgba(245,230,200,0.82) !important; font-size: 0.9rem !important; margin: 0 !important; }

.mc {
    background: white; border: 1px solid rgba(200,134,10,0.14);
    border-radius: 16px; padding: 18px 20px; position: relative; overflow: hidden;
    transition: transform .2s, box-shadow .2s;
}
.mc:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(139,58,15,0.10); }
.mc::after { content:''; position:absolute; bottom:0; left:0; right:0; height:3px; border-radius:0 0 16px 16px; }
.mc.a::after{background:#C8450A}.mc.b::after{background:#E07B1A}
.mc.c::after{background:#E6B830}.mc.d::after{background:#9E8A78}.mc.e::after{background:#3B1F0E}
.mc-label { font-size:.72rem; font-weight:500; color:#A0522D; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; }
.mc-value { font-family:'Playfair Display',serif; font-size:1.75rem; font-weight:700; color:#3B1F0E; line-height:1; }
.mc-sub   { font-size:.74rem; color:#9E8A78; margin-top:4px; }

.result-pill {
    display:inline-block; background:rgba(200,69,10,0.08);
    border:1px solid rgba(200,69,10,0.2); border-radius:20px;
    padding:6px 16px; font-size:.84rem; color:#7A3D15; font-weight:500; margin-bottom:18px;
}
.insight {
    background:linear-gradient(135deg,#FDF6EC,#F5E6C8);
    border:1px solid rgba(200,134,10,0.22); border-left:4px solid #C8450A;
    border-radius:0 12px 12px 0; padding:14px 18px;
    font-size:.87rem; color:#5a3010; margin:16px 0;
}
.badge {
    display:inline-flex; align-items:center; gap:5px;
    padding:4px 12px; border-radius:20px; font-size:.75rem; font-weight:600; border:1.5px solid;
}
.stat-chip {
    background:white; border:1px solid rgba(200,134,10,0.18);
    border-radius:12px; padding:12px 16px; margin-bottom:10px;
}
.sec-title {
    font-size:1rem; font-weight:700; color:#3B1F0E;
    border-left:4px solid #C8450A; padding-left:10px;
    margin:20px 0 14px;
}
</style>
""", unsafe_allow_html=True)


# ============================================================
# CHARGEMENT
# ============================================================
@st.cache_data
def load_data():
    for p in ['retail_data.pkl','../retail_data.pkl',
              os.path.join(os.path.dirname(__file__),'..','retail_data.pkl')]:
        if os.path.exists(p):
            with open(p,'rb') as f: return pickle.load(f)
    return None


@st.cache_data
def compute_repurchase(_data):
    df = _data['df_clean'].copy()
    df['week_id'] = (df['date'].dt.isocalendar()
                     .apply(lambda x: f"{x['year']}-W{x['week']:02d}", axis=1))
    total_sem = df['week_id'].nunique()

    sp = (df.groupby('article')['week_id'].nunique().reset_index()
            .rename(columns={'week_id':'semaines_actives'}))
    sp['repurchase_freq_%'] = (sp['semaines_actives'] / total_sem * 100).round(2)

    def classify(r):
        if r==100   : return 'Produit Quotidien (100%)'
        elif r>=75  : return 'Produit Regulier (75-99%)'
        elif r>=50  : return 'Produit Cyclique (50-74%)'
        else        : return 'Produit Sporadique (<50%)'

    sp['statut_frequence'] = sp['repurchase_freq_%'].apply(classify)

    ca  = df.groupby('article')['total_revenue'].sum().reset_index().rename(columns={'total_revenue':'ca_total'})
    qty = df.groupby('article')['quantity'].sum().reset_index().rename(columns={'quantity':'qte_totale'})
    rp  = sp.merge(ca,on='article').merge(qty,on='article')

    if 'category' in df.columns:
        cat = df.groupby('article')['category'].first().reset_index()
        rp  = rp.merge(cat,on='article',how='left')

    rp = rp.sort_values('repurchase_freq_%',ascending=False).reset_index(drop=True)
    rp['rang'] = rp.index + 1

    weekly = df.groupby(['week_id','article'])['total_revenue'].sum().reset_index()

    return rp, {
        'total_semaines': total_sem,
        'nb_produits'   : len(rp),
        'ca_total'      : df['total_revenue'].sum(),
        'date_min'      : df['date'].dt.date.min(),
        'date_max'      : df['date'].dt.date.max(),
        'df_weekly'     : weekly,
        'all_weeks'     : sorted(df['week_id'].unique()),
    }


data = load_data()
if data is None:
    st.error("❌ Fichier `retail_data.pkl` introuvable.")
    st.stop()

repurchase, stats = compute_repurchase(data)
has_cat = 'category' in repurchase.columns


# ============================================================
# SIDEBAR — uniquement : Statut, Catégorie, Fréquence
# ============================================================
with st.sidebar:
    st.markdown("""
    <div style="padding:20px 4px 8px;">
      <p style="font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:700;
                color:#F5C98A;margin:0 0 4px;">🔍 Filtres</p>
      <p style="font-size:.78rem;color:rgba(245,230,200,.55);margin:0;">Affinez l'analyse</p>
    </div>
    """, unsafe_allow_html=True)
    st.markdown("---")

    st.markdown("##### 📊 Statut")
    filtre_statut = st.multiselect("", ORDRE_FREQ, default=ORDRE_FREQ,
        format_func=lambda x: f"{EMOJI_FREQ[x]}  {x}", label_visibility="collapsed")
    st.markdown("---")

    if has_cat:
        st.markdown("##### 🗂️ Catégorie")
        all_cats = sorted(repurchase['category'].dropna().unique())
        filtre_cat = st.multiselect("", all_cats, default=all_cats, label_visibility="collapsed")
    else:
        filtre_cat = None
    st.markdown("---")

    st.markdown("##### 📈 Fréquence (%)")
    freq_range = st.slider("", 0.0, 100.0, (0.0, 100.0), 1.0, label_visibility="collapsed")

    st.markdown("---")
    st.markdown("""<div style="font-size:.72rem;color:rgba(245,230,200,.4);
                text-align:center;padding:6px 0;">
                Boulangerie Le Croisic · 2024–2025</div>""", unsafe_allow_html=True)


# ============================================================
# FILTRAGE
# ============================================================
df_f = repurchase.copy()
if filtre_statut:
    df_f = df_f[df_f['statut_frequence'].isin(filtre_statut)]
df_f = df_f[(df_f['repurchase_freq_%'] >= freq_range[0]) & (df_f['repurchase_freq_%'] <= freq_range[1])]
if has_cat and filtre_cat:
    df_f = df_f[df_f['category'].isin(filtre_cat)]

df_f = df_f.sort_values('repurchase_freq_%', ascending=False).reset_index(drop=True)


# ============================================================
# EN-TÊTE
# ============================================================
st.markdown("""
<div class="page-header">
  <h1>Fréquence de Rachat</h1>
  <p>Section 2.4 · Loyauté comportementale · Boulangerie Le Croisic · 2024–2025</p>
</div>
""", unsafe_allow_html=True)


# ============================================================
# MÉTRIQUES
# ============================================================
recap = (repurchase.groupby('statut_frequence')
         .agg(nb=('article','count'), ca=('ca_total','sum'))
         .reindex(ORDRE_FREQ).fillna(0))
recap['part_ca'] = (recap['ca'] / stats['ca_total'] * 100).round(1)

nb_q  = int(recap.loc['Produit Quotidien (100%)','nb'])
pca_q = recap.loc['Produit Quotidien (100%)','part_ca']
nb_sp = int(recap.loc['Produit Sporadique (<50%)','nb'])

c1,c2,c3,c4,c5 = st.columns(5)
for col, cls, val, lbl, sub in [
    (c1,"a",stats['total_semaines'],"Semaines analysées",f"{stats['date_min']} → {stats['date_max']}"),
    (c2,"b",stats['nb_produits'],"Produits analysés","toutes références"),
    (c3,"c",nb_q,"Produits Quotidiens","présents 100% des semaines"),
    (c4,"d",f"{pca_q:.1f}%","CA des Piliers","générés par les Quotidiens"),
    (c5,"e",nb_sp,"Produits Sporadiques","< 50% des semaines"),
]:
    with col:
        st.markdown(f"""
        <div class="mc {cls}">
          <div class="mc-label">{lbl}</div>
          <div class="mc-value">{val}</div>
          <div class="mc-sub">{sub}</div>
        </div>""", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)
st.markdown(f'<div class="result-pill">📌 <strong>{len(df_f)} produits</strong> affichés'
            + f' · fréquence {freq_range[0]:.0f}%→{freq_range[1]:.0f}%</div>',
            unsafe_allow_html=True)


# ============================================================
# ONGLETS
# ============================================================
tab1, tab2, tab3, tab4 = st.tabs([
    "  📊 Classement  ",
    "  🎯 Carte Stratégique  ",
    "  📋 Tableau  ",
    "  📅 Évolution  ",
])


# ── TAB 1 — BARRES ──────────────────────────────────────────
with tab1:
    n_bar  = min(30, len(df_f))
    df_bar = df_f.head(n_bar).sort_values('repurchase_freq_%', ascending=True)

    fig = go.Figure()
    fig.add_trace(go.Bar(
        y=df_bar['article'].str.title(),
        x=df_bar['repurchase_freq_%'],
        orientation='h',
        marker=dict(color=[COLOR_FREQ[s] for s in df_bar['statut_frequence']],
                    opacity=0.88, line=dict(width=0)),
        text=[f"<b>{v:.1f}%</b>" for v in df_bar['repurchase_freq_%']],
        textposition='outside', textfont=dict(size=10),
        hovertemplate=(
            "<b>%{y}</b><br>Fréquence : <b>%{x:.1f}%</b><br>"
            "Semaines : %{customdata[0]}<br>CA : %{customdata[1]:,.0f} €<br>"
            "Statut : %{customdata[2]}<extra></extra>"
        ),
        customdata=list(zip(df_bar['semaines_actives'], df_bar['ca_total'], df_bar['statut_frequence'])),
    ))

    for seuil, lbl, col in [(100,"Quotidien",'#C8450A'),(75,"Régulier",'#E07B1A'),(50,"Cyclique",'#E6B830')]:
        fig.add_vline(x=seuil, line_dash="dot", line_color=col, line_width=1.5, opacity=0.45,
                      annotation_text=lbl, annotation_position="top",
                      annotation_font=dict(color=col, size=9))

    fig.update_layout(
        height=max(480, n_bar*24),
        plot_bgcolor='rgba(250,246,240,0.6)', paper_bgcolor='rgba(0,0,0,0)',
        font=dict(family='DM Sans'),
        xaxis=dict(title='Fréquence de Rachat (%)', ticksuffix='%',
                   gridcolor='rgba(200,134,10,0.12)', range=[0,118], zeroline=False),
        yaxis=dict(tickfont=dict(size=10, color='#3B1F0E')),
        margin=dict(l=10, r=100, t=16, b=40), showlegend=False,
    )
    st.plotly_chart(fig, use_container_width=True)

    bc = st.columns(4)
    for col, st_key in zip(bc, ORDRE_FREQ):
        nb = len(repurchase[repurchase['statut_frequence']==st_key])
        c  = COLOR_FREQ[st_key]
        with col:
            st.markdown(
                f'<span class="badge" style="background:{c}18;color:{c};border-color:{c}40;">'
                f'{EMOJI_FREQ[st_key]} {st_key.split("(")[0].strip()} — {nb}</span>',
                unsafe_allow_html=True)

    st.markdown('<div class="insight">💡 <strong>Règle opérationnelle :</strong> '
                'Un Produit Quotidien absent une semaine = anomalie grave (rupture, fermeture, qualité). '
                'Stock de sécurité dimensionné sur la prévision haute du modèle Prophet.</div>',
                unsafe_allow_html=True)


# ── TAB 2 — CARTE STRATÉGIQUE ────────────────────────────────
with tab2:

    recap_data = (repurchase.groupby('statut_frequence')
                  .agg(nb=('article','count'),
                       ca=('ca_total','sum'),
                       freq_moy=('repurchase_freq_%','mean'),
                       freq_med=('repurchase_freq_%','median'))
                  .reindex(ORDRE_FREQ).fillna(0).reset_index())
    recap_data['part_ca'] = (recap_data['ca'] / stats['ca_total'] * 100).round(1)
    labels_short = [s.split('(')[0].strip() for s in recap_data['statut_frequence']]
    colors_list  = [COLOR_FREQ[s] for s in recap_data['statut_frequence']]

    col_l, col_r = st.columns([1, 2])

    with col_l:
        st.markdown('<div class="sec-title">🥧 Répartition du CA</div>', unsafe_allow_html=True)
        fig_donut = go.Figure(go.Pie(
            labels=[f"{EMOJI_FREQ[s]} {s.split('(')[0].strip()}" for s in recap_data['statut_frequence']],
            values=recap_data['ca'],
            hole=0.58,
            marker=dict(colors=colors_list, line=dict(color='white', width=2.5)),
            textinfo='percent',
            textfont=dict(size=12, family='DM Sans'),
            hovertemplate='<b>%{label}</b><br>CA : %{value:,.0f} €<br>Part : %{percent}<extra></extra>',
            direction='clockwise',
            sort=False,
        ))
        fig_donut.add_annotation(
            text=f"<b>{stats['ca_total']/1000:.0f}k€</b><br><span style='font-size:10px'>CA Total</span>",
            x=0.5, y=0.5, showarrow=False,
            font=dict(size=15, color='#3B1F0E', family='Playfair Display'),
        )
        fig_donut.update_layout(
            height=300,
            paper_bgcolor='rgba(0,0,0,0)',
            showlegend=False,
            margin=dict(t=10, b=10, l=10, r=10),
        )
        st.plotly_chart(fig_donut, use_container_width=True)

    with col_r:
        st.markdown('<div class="sec-title">📊 Nombre de produits & Part CA par statut</div>',
                    unsafe_allow_html=True)

        fig_h = make_subplots(rows=2, cols=1,
                              subplot_titles=["Nombre de produits", "Part du CA (%)"],
                              vertical_spacing=0.18)

        fig_h.add_trace(go.Bar(
            x=labels_short,
            y=recap_data['nb'],
            marker_color=colors_list,
            marker_opacity=0.88,
            marker_line=dict(width=0),
            text=[f"<b>{int(v)}</b>" for v in recap_data['nb']],
            textposition='outside',
            textfont=dict(size=12, color='#3B1F0E', family='DM Sans'),
            hovertemplate='<b>%{x}</b><br>%{y} produits<extra></extra>',
            showlegend=False,
        ), row=1, col=1)

        fig_h.add_trace(go.Bar(
            x=labels_short,
            y=recap_data['part_ca'],
            marker_color=colors_list,
            marker_opacity=0.88,
            marker_line=dict(width=0),
            text=[f"<b>{v:.1f}%</b>" for v in recap_data['part_ca']],
            textposition='outside',
            textfont=dict(size=12, color='#3B1F0E', family='DM Sans'),
            hovertemplate='<b>%{x}</b><br>Part CA : %{y:.1f}%<extra></extra>',
            showlegend=False,
        ), row=2, col=1)

        fig_h.update_layout(
            height=380,
            plot_bgcolor='white',
            paper_bgcolor='rgba(0,0,0,0)',
            font=dict(family='DM Sans', size=11),
            margin=dict(l=10, r=20, t=40, b=20),
            bargap=0.38,
        )
        fig_h.update_xaxes(tickfont=dict(size=10, color='#5a3010'),
                           gridcolor='rgba(0,0,0,0)', linecolor='rgba(200,134,10,0.15)')
        fig_h.update_yaxes(gridcolor='rgba(200,134,10,0.08)', zeroline=False,
                           tickfont=dict(size=9))
        fig_h.update_yaxes(title_text='Produits', title_font=dict(size=9), row=1, col=1)
        fig_h.update_yaxes(title_text='% CA', ticksuffix='%', title_font=dict(size=9), row=2, col=1)
        for ann in fig_h.layout.annotations:
            ann.update(font=dict(size=11, color='#3B1F0E', family='DM Sans'))

        st.plotly_chart(fig_h, use_container_width=True)

    st.divider()

    st.markdown('<div class="sec-title">📋 Synthèse par statut</div>', unsafe_allow_html=True)
    cols_cards = st.columns(4)
    for i, row in recap_data.iterrows():
        c = COLOR_FREQ[row['statut_frequence']]
        with cols_cards[i]:
            st.markdown(f"""
            <div style="background:white;border-radius:14px;padding:18px 16px;
                        border-top:4px solid {c};
                        box-shadow:0 2px 10px rgba(139,58,15,0.07);text-align:center;">
              <div style="font-size:1.6rem;margin-bottom:6px;">{EMOJI_FREQ[row['statut_frequence']]}</div>
              <div style="font-weight:700;color:{c};font-size:.85rem;margin-bottom:10px;">
                {row['statut_frequence'].split('(')[0].strip()}
              </div>
              <div style="display:flex;justify-content:space-around;
                          border-top:1px solid rgba(200,134,10,0.12);padding-top:10px;">
                <div>
                  <div style="font-family:'Playfair Display',serif;font-size:1.4rem;
                              font-weight:700;color:#3B1F0E;">{int(row['nb'])}</div>
                  <div style="font-size:.70rem;color:#9E8A78;">produits</div>
                </div>
                <div>
                  <div style="font-family:'Playfair Display',serif;font-size:1.4rem;
                              font-weight:700;color:{c};">{row['part_ca']:.1f}%</div>
                  <div style="font-size:.70rem;color:#9E8A78;">du CA</div>
                </div>
                <div>
                  <div style="font-family:'Playfair Display',serif;font-size:1.4rem;
                              font-weight:700;color:#3B1F0E;">{row['freq_moy']:.0f}%</div>
                  <div style="font-size:.70rem;color:#9E8A78;">fréq. moy.</div>
                </div>
              </div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown('<div class="insight" style="margin-top:18px;">💡 Les <strong>Produits Quotidiens</strong> '
                'représentent une minorité du catalogue mais génèrent la majorité du CA — '
                'ce sont les piliers absolus de la boulangerie. '
                'Les <strong>Produits Sporadiques</strong> méritent une révision de leur présence en rayon.'
                '</div>', unsafe_allow_html=True)


# ── TAB 3 — TABLEAU ─────────────────────────────────────────
with tab3:
    cols_show = ['rang','article','statut_frequence','repurchase_freq_%','semaines_actives','ca_total','qte_totale']
    if has_cat: cols_show.append('category')

    df_disp = df_f[cols_show].copy().rename(columns={
        'rang':'#','article':'Produit','statut_frequence':'Statut',
        'repurchase_freq_%':'Fréq. (%)','semaines_actives':'Semaines',
        'ca_total':'CA (€)','qte_totale':'Qté','category':'Catégorie'
    })

    def col_s(v):
        return {
            'Produit Quotidien (100%)'  :'color:#C8450A;font-weight:600',
            'Produit Regulier (75-99%)' :'color:#E07B1A;font-weight:600',
            'Produit Cyclique (50-74%)' :'color:#b08a00;font-weight:600',
            'Produit Sporadique (<50%)' :'color:#9E8A78;font-weight:600',
        }.get(v,'')

    def bg_f(v):
        if v==100  : return 'background:rgba(200,69,10,0.09)'
        elif v>=75 : return 'background:rgba(224,123,26,0.07)'
        elif v>=50 : return 'background:rgba(230,184,48,0.07)'
        return ''

    styled = (df_disp.style
              .applymap(col_s, subset=['Statut'])
              .applymap(bg_f,  subset=['Fréq. (%)'])
              .format({'Fréq. (%)':'{:.1f}','CA (€)':'{:,.0f}','Qté':'{:,.0f}'})
              .bar(subset=['Fréq. (%)'], color='rgba(200,69,10,0.16)', vmin=0, vmax=100))

    st.dataframe(styled, use_container_width=True, height=520)
    csv = df_disp.to_csv(index=False).encode('utf-8')
    st.download_button("⬇️ Exporter en CSV", csv, "repurchase_frequency.csv", "text/csv")


# ── TAB 4 — ÉVOLUTION ───────────────────────────────────────
with tab4:
    top_def = repurchase.head(20)['article'].tolist()
    prods   = st.multiselect("Comparer jusqu'à 6 produits",
                              repurchase['article'].tolist(), default=top_def[:4], max_selections=6)

    if prods:
        df_w      = stats['df_weekly']
        all_weeks = stats['all_weeks']
        xcolors   = ['#C8450A','#E07B1A','#E6B830','#3B7FBF','#6B3BAC','#2E8B57']

        fig4 = go.Figure()
        for i, prod in enumerate(prods):
            freq   = repurchase[repurchase['article']==prod]['repurchase_freq_%'].iloc[0]
            statut = repurchase[repurchase['article']==prod]['statut_frequence'].iloc[0]
            color  = COLOR_FREQ.get(statut, xcolors[i%len(xcolors)])
            r,g,b  = int(color[1:3],16), int(color[3:5],16), int(color[5:7],16)

            weekly = (df_w[df_w['article']==prod]
                      .set_index('week_id')['total_revenue']
                      .reindex(all_weeks, fill_value=0))

            fig4.add_trace(go.Scatter(
                x=all_weeks, y=weekly.values, mode='lines',
                name=f"{prod.title()[:22]} ({freq:.0f}%)",
                line=dict(color=color, width=2.2),
                fill='tozeroy', fillcolor=f"rgba({r},{g},{b},0.05)",
                hovertemplate=f"<b>{prod}</b><br>Semaine : %{{x}}<br>CA : %{{y:,.0f}} €<extra></extra>",
            ))

        fig4.update_layout(
            height=450,
            plot_bgcolor='rgba(250,246,240,0.6)', paper_bgcolor='rgba(0,0,0,0)',
            font=dict(family='DM Sans'),
            xaxis=dict(title='Semaine', tickvals=all_weeks[::4], tickangle=40,
                       tickfont=dict(size=9), gridcolor='rgba(200,134,10,0.12)', zeroline=False),
            yaxis=dict(title='CA Hebdomadaire (€)', ticksuffix=' €',
                       gridcolor='rgba(200,134,10,0.12)', zeroline=False),
            legend=dict(orientation='h', yanchor='bottom', y=-0.28, xanchor='center', x=0.5,
                        bgcolor='rgba(250,246,240,0.95)',
                        bordercolor='rgba(200,134,10,0.25)', borderwidth=1),
            margin=dict(l=10, r=10, t=10, b=90),
        )
        st.plotly_chart(fig4, use_container_width=True)
        st.markdown('<div class="insight">💡 Les semaines à <strong>CA = 0 €</strong> '
                    'sont des semaines sans vente pour ce produit. '
                    'Plus elles sont rares, plus la fréquence de rachat est élevée.</div>',
                    unsafe_allow_html=True)
    else:
        st.info("Sélectionne au moins un produit pour afficher son évolution.")


# ============================================================
# FOOTER
# ============================================================
st.markdown("""
<div style="text-align:center;color:#9E8A78;font-size:.78rem;
            padding:24px 0 8px;border-top:1px solid rgba(200,134,10,0.12);margin-top:32px;">
  🔁 Section 2.4 · Repurchase Frequency · (Semaines avec vente / Total semaines) × 100
</div>
""", unsafe_allow_html=True)
