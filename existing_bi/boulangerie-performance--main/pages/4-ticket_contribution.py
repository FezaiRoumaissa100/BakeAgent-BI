import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import pickle
import os

# ============================================================
# CONFIG & PALETTE
# ============================================================
st.set_page_config(
    page_title="Ticket Contribution",
    page_icon="🧾",
    layout="wide",
)

PALETTE = {
    'c1': '#8B3A0F',
    'c2': '#C8860A',
    'c3': '#E6A817',
    'fg': '#F5E6C8',
    'bg': '#FDF6EC',
    'txt': '#A0522D',
}

COLOR_STATUT = {
    'Produit Ancre': '#C0392B',
    'Moteur du Panier': '#D4882A',
    'Produit Complementaire': '#C9A84C',
    'Micro Contributeur': '#6B6B6B',
}

# Seuils recalibrés sur le ticket médian réel de la boulangerie (7.40 €)
# -- identiques à la version finale v5 du notebook (Section 2.3)
SEUIL_ANCRE = 67.0
SEUIL_MOTEUR = 40.0
SEUIL_COMPL = 20.0
SEUIL_FIABILITE = 10  # nb minimum de tickets multi-articles pour être retenu

ORDRE_STATUT = [
    'Produit Ancre',
    'Moteur du Panier',
    'Produit Complementaire',
    'Micro Contributeur',
]

# ============================================================
# CSS PERSONNALISÉ
# ============================================================
st.markdown("""
<style>
    .main { background-color: #FDF6EC; }
    .block-container { padding-top: 1.5rem; }

    .metric-card {
        background: linear-gradient(135deg, #FDF6EC 0%, #F5E6C8 100%);
        border: 1.5px solid #C8860A;
        border-radius: 12px;
        padding: 16px 20px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(139,58,15,0.10);
    }
    .metric-card .label {
        font-size: 0.78rem;
        color: #A0522D;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 4px;
    }
    .metric-card .value {
        font-size: 1.6rem;
        font-weight: 800;
        color: #8B3A0F;
    }
    .metric-card .sub {
        font-size: 0.75rem;
        color: #C8860A;
        margin-top: 2px;
    }

    .statut-badge {
        display: inline-block;
        padding: 4px 14px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 700;
        color: white;
        margin: 2px;
    }

    .section-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: #8B3A0F;
        border-left: 4px solid #C8860A;
        padding-left: 10px;
        margin-bottom: 0.8rem;
        margin-top: 1.2rem;
    }

    .insight-box {
        background: rgba(200,134,10,0.08);
        border-left: 4px solid #C8860A;
        border-radius: 0 8px 8px 0;
        padding: 12px 16px;
        margin: 10px 0;
        font-size: 0.88rem;
        color: #5a3010;
    }
    .warning-box {
        background: rgba(192,57,43,0.08);
        border-left: 4px solid #C0392B;
        border-radius: 0 8px 8px 0;
        padding: 12px 16px;
        margin: 10px 0;
        font-size: 0.88rem;
        color: #5a1010;
    }
</style>
""", unsafe_allow_html=True)


# ============================================================
# CHARGEMENT DES DONNÉES (retail_data.pkl généré par le notebook)
# ============================================================
@st.cache_data
def load_data():
    pkl_paths = [
        'retail_data.pkl',
        '../retail_data.pkl',
        os.path.join(os.path.dirname(__file__), '..', 'retail_data.pkl'),
        os.path.join(os.path.dirname(__file__), 'retail_data.pkl'),
    ]
    for path in pkl_paths:
        if os.path.exists(path):
            with open(path, 'rb') as f:
                return pickle.load(f)
    return None


# ============================================================
# CALCUL — reproduit EXACTEMENT la logique du notebook
# (Section 2.3 — Contribution au Ticket — VERSION FINALE v5)
# ============================================================
@st.cache_data
def compute_ticket_contribution(_data):
    df = _data['df_clean'].copy()

    # -- 1. Filtrage des tickets multi-articles (EN PREMIER) ----
    taille_tickets = df.groupby('ticket_number')['article'].nunique()
    tickets_multi = taille_tickets[taille_tickets >= 2].index
    df_multi = df[df['ticket_number'].isin(tickets_multi)].copy()

    nb_mono = (taille_tickets == 1).sum()
    nb_multi = len(tickets_multi)
    nb_total = len(taille_tickets)

    # -- 2. Regroupement (ticket, article) avant calcul ---------
    # Évite la sous-estimation si un même produit apparaît
    # sur 2 lignes distinctes dans le même ticket
    df_multi_agg = (
        df_multi
        .groupby(['ticket_number', 'article'], as_index=False)
        .agg(
            line_revenue=('total_revenue', 'sum'),
            line_qty=('quantity', 'sum'),
        )
    )

    # -- 3. Valeur totale du ticket -------------------------------
    df_multi_agg['ticket_total_value'] = (
        df_multi_agg
        .groupby('ticket_number')['line_revenue']
        .transform('sum')
    )

    # -- 4. Contribution en % -------------------------------------
    df_multi_agg['contribution_%'] = (
        df_multi_agg['line_revenue'] / df_multi_agg['ticket_total_value'] * 100
    ).round(2)

    # -- 5. CA réel sur tout le magasin -----------------------------
    ca_reel = df.groupby('article')['total_revenue'].sum().reset_index()
    ca_reel.columns = ['article', 'ca_total_magasin']

    # -- 6. Agrégation par produit ----------------------------------
    ticket_contribution = (
        df_multi_agg
        .groupby('article')
        .agg(
            contribution_med=('contribution_%', 'median'),
            contribution_moy=('contribution_%', 'mean'),
            contribution_std=('contribution_%', 'std'),
            nb_tickets_multi=('ticket_number', 'nunique'),
        )
        .reset_index()
        .round(2)
    )

    # Jointure CA réel
    ticket_contribution = ticket_contribution.merge(ca_reel, on='article', how='left')
    ticket_contribution['ca_total_magasin'] = ticket_contribution['ca_total_magasin'].round(2)

    # -- 7. FILTRE FIABILITÉ : minimum 10 tickets multi ------------
    nb_avant_filtre = len(ticket_contribution)
    ticket_contribution_fiable = ticket_contribution[
        ticket_contribution['nb_tickets_multi'] >= SEUIL_FIABILITE
    ].copy().reset_index(drop=True)
    nb_exclus = nb_avant_filtre - len(ticket_contribution_fiable)

    # -- 8. Classification (seuils calibrés ticket médian 7.40€) --
    def classifier_contribution(rate):
        if rate >= SEUIL_ANCRE:
            return 'Produit Ancre'
        elif rate >= SEUIL_MOTEUR:
            return 'Moteur du Panier'
        elif rate >= SEUIL_COMPL:
            return 'Produit Complementaire'
        else:
            return 'Micro Contributeur'

    ticket_contribution_fiable['statut_contribution'] = (
        ticket_contribution_fiable['contribution_med']
        .apply(classifier_contribution)
    )

    # -- 9. Tri sur la médiane --------------------------------------
    ticket_contribution_fiable = ticket_contribution_fiable.sort_values(
        'contribution_med', ascending=False
    ).reset_index(drop=True)

    ticket_median = df_multi_agg['ticket_total_value'].median()
    ca_total_magasin = df['total_revenue'].sum()

    stats = {
        'nb_mono': nb_mono,
        'nb_multi': nb_multi,
        'nb_total': nb_total,
        'nb_avant_filtre': nb_avant_filtre,
        'nb_exclus': nb_exclus,
        'ticket_median': ticket_median,
        'ca_total': ca_total_magasin,
        'nb_produits': len(ticket_contribution_fiable),
    }

    return ticket_contribution_fiable, stats


# ============================================================
# EN-TÊTE
# ============================================================
st.markdown("""
<div style="background:linear-gradient(135deg,#8B3A0F,#C8860A);
            padding:22px 28px; border-radius:14px; margin-bottom:22px;
            box-shadow:0 4px 16px rgba(139,58,15,0.25)">
  <h2 style="color:white;margin:0;font-size:1.55rem;">
    🧾 Section 2.3 — Contribution au Ticket (Ticket Contribution)
  </h2>
  <p style="color:#F5E6C8;margin:6px 0 0;font-size:0.9rem;">
    Évaluer le poids financier de chaque produit dans le panier client
    · Boulangerie Le Croisic · 2024–2025
  </p>
</div>
""", unsafe_allow_html=True)

# ============================================================
# CHARGEMENT
# ============================================================
data = load_data()

if data is None:
    st.error("❌ Fichier `retail_data.pkl` introuvable. Placez-le à la racine du projet "
             "(ou dans le dossier parent du dossier `pages/`).")
    st.stop()

if 'df_clean' not in data:
    st.error("❌ La clé `df_clean` est absente du fichier `retail_data.pkl`. "
              "Régénérez-le depuis le notebook.")
    st.stop()

tc, stats = compute_ticket_contribution(data)

# ============================================================
# MÉTRIQUES GLOBALES
# ============================================================
repartition = (
    tc.groupby('statut_contribution')
    .agg(nb_produits=('article', 'count'),
         ca_total=('ca_total_magasin', 'sum'),
         med_moy=('contribution_med', 'mean'))
    .reindex(ORDRE_STATUT)
    .reset_index()
)
repartition['nb_produits'] = repartition['nb_produits'].fillna(0).astype(int)
repartition['ca_total'] = repartition['ca_total'].fillna(0.0)
repartition['med_moy'] = repartition['med_moy'].fillna(0.0)
repartition['part_ca_%'] = (repartition['ca_total'] / stats['ca_total'] * 100).fillna(0.0).round(1)

col1, col2, col3, col4, col5 = st.columns(5)

nb_ancre = int(repartition.loc[repartition['statut_contribution'] == 'Produit Ancre', 'nb_produits'].fillna(0).iloc[0]) \
    if (repartition['statut_contribution'] == 'Produit Ancre').any() else 0

metrics = [
    (col1, "Tickets multi-articles", f"{stats['nb_multi']:,}", f"{stats['nb_multi']/stats['nb_total']*100:.1f}% du total"),
    (col2, "Produits retenus", f"{stats['nb_produits']}", f"fiabilité ≥ {SEUIL_FIABILITE} tickets"),
    (col3, "Ticket médian", f"{stats['ticket_median']:.2f} €", "périmètre multi-articles"),
    (col4, "CA boulangerie", f"{stats['ca_total']/1000:.0f} K€", "CA total (toutes lignes)"),
    (col5, "Produits Ancre", f"{nb_ancre}", f"≥ {SEUIL_ANCRE:.0f}% du ticket"),
]

for col, label, value, sub in metrics:
    with col:
        st.markdown(f"""
        <div class="metric-card">
          <div class="label">{label}</div>
          <div class="value">{value}</div>
          <div class="sub">{sub}</div>
        </div>""", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# ============================================================
# SEUILS & MÉTHODOLOGIE
# ============================================================
with st.expander("📐 Méthodologie & Seuils de Classification", expanded=False):
    st.markdown(f"""
    **Formule :**
    > *Contribution (%) = (CA ligne produit / Valeur totale du ticket) × 100*

    Le calcul est effectué uniquement sur le **périmètre des tickets multi-articles**
    ({stats['nb_multi']:,} tickets sur {stats['nb_total']:,}, soit {stats['nb_multi']/stats['nb_total']*100:.1f}%).
    Les tickets mono-produit ({stats['nb_mono']:,}) sont exclus car la contribution y est
    toujours de 100% par construction.

    Les seuils sont **fixes et calibrés sur le ticket médian réel de la boulangerie
    ({stats['ticket_median']:.2f} €)** :

    | Statut | Seuil médiane | Équivalent prix produit | Rôle dans le panier |
    |---|---|---|---|
    | 🔴 **Produit Ancre** | ≥ {SEUIL_ANCRE:.0f}% | > ~5.00 € | Raison principale de la visite |
    | 🟠 **Moteur du Panier** | ≥ {SEUIL_MOTEUR:.0f}% | ~3.00 – 5.00 € | Cœur transactionnel du ticket |
    | 🟡 **Produit Complémentaire** | ≥ {SEUIL_COMPL:.0f}% | ~1.50 – 3.00 € | Achat d'accompagnement |
    | ⚫ **Micro Contributeur** | < {SEUIL_COMPL:.0f}% | < ~1.50 € | Achat d'impulsion |

    **Filtre de fiabilité :** seuls les produits présents dans **≥ {SEUIL_FIABILITE} tickets
    multi-articles** sont retenus ({stats['nb_produits']} produits retenus sur
    {stats['nb_avant_filtre']}, {stats['nb_exclus']} exclus pour présence anecdotique).
    Ce seuil garantit que la médiane calculée est statistiquement robuste.
    """)

# ============================================================
# ONGLETS
# ============================================================
tab1, tab2, tab3, tab4 = st.tabs([
    "📊 Top 20 Produits",
    "🫧 Carte des Produits",
    "📋 Tableau Complet",
    "🔍 Analyse par Statut",
])

# ────────────────────────────────────────────────────────────
# TAB 1 — TOP 20 BARRES HORIZONTALES
# ────────────────────────────────────────────────────────────
with tab1:
    st.markdown('<div class="section-title">Top 20 Produits — Contribution Médiane au Ticket</div>',
                unsafe_allow_html=True)

    top20 = tc.head(20).copy()

    fig1 = go.Figure()

    fig1.add_trace(go.Bar(
        y=top20['article'],
        x=top20['contribution_med'],
        orientation='h',
        marker_color=[COLOR_STATUT.get(s, '#888') for s in top20['statut_contribution']],
        text=[f"{v:.1f}%" for v in top20['contribution_med']],
        textposition='outside',
        hovertemplate=(
            "<b>%{y}</b><br>"
            "Contribution médiane : %{x:.1f}%<br>"
            "Nb tickets multi : %{customdata[0]:,}<br>"
            "Statut : %{customdata[1]}<extra></extra>"
        ),
        customdata=list(zip(top20['nb_tickets_multi'], top20['statut_contribution'])),
    ))

    for seuil, label, color in [
        (SEUIL_ANCRE, f"Ancre ≥ {SEUIL_ANCRE:.0f}%", COLOR_STATUT['Produit Ancre']),
        (SEUIL_MOTEUR, f"Moteur ≥ {SEUIL_MOTEUR:.0f}%", COLOR_STATUT['Moteur du Panier']),
        (SEUIL_COMPL, f"Compl. ≥ {SEUIL_COMPL:.0f}%", COLOR_STATUT['Produit Complementaire']),
    ]:
        fig1.add_vline(
            x=seuil, line_dash="dash",
            line_color=color, line_width=1.5, opacity=0.7,
            annotation_text=label,
            annotation_position="top",
            annotation_font_color=color,
            annotation_font_size=10,
        )

    fig1.update_yaxes(autorange='reversed')
    fig1.update_layout(
        height=580,
        plot_bgcolor='rgba(253,246,236,0.5)',
        paper_bgcolor='rgba(0,0,0,0)',
        xaxis_title='Contribution Médiane au Ticket (%)',
        xaxis=dict(ticksuffix='%', gridcolor='rgba(200,134,10,0.15)'),
        yaxis=dict(tickfont=dict(size=11)),
        margin=dict(l=10, r=120, t=20, b=40),
        showlegend=False,
    )

    st.plotly_chart(fig1, use_container_width=True)

    cols_leg = st.columns(4)
    for i, (statut, color) in enumerate(COLOR_STATUT.items()):
        nb = len(tc[tc['statut_contribution'] == statut])
        with cols_leg[i]:
            st.markdown(
                f'<span class="statut-badge" style="background:{color}">'
                f'{statut} ({nb})</span>',
                unsafe_allow_html=True
            )

    st.markdown('<br>', unsafe_allow_html=True)
    st.markdown('<div class="warning-box">⚠️ <strong>Règle opérationnelle clé :</strong> '
                'Un Produit Ancre en rupture de stock ne fait pas perdre une vente — '
                'il fait perdre un <em>ticket entier</em>.</div>',
                unsafe_allow_html=True)

# ────────────────────────────────────────────────────────────
# TAB 2 — BUBBLE CHART (Fréquence × Contribution × CA)
# ────────────────────────────────────────────────────────────
with tab2:
    st.markdown('<div class="section-title">Fréquence × Contribution × CA (taille bulle ∝ √CA)</div>',
                unsafe_allow_html=True)

    df_b = tc[tc['ca_total_magasin'] > 0].copy()
    df_b['x_log'] = np.log1p(df_b['nb_tickets_multi'])
    ca_max = df_b['ca_total_magasin'].max()
    df_b['size_norm'] = (np.sqrt(df_b['ca_total_magasin'] / ca_max)) * 60 + 5

    fig2 = go.Figure()

    for statut, color in COLOR_STATUT.items():
        mask = df_b['statut_contribution'] == statut
        sub = df_b[mask]
        if sub.empty:
            continue
        fig2.add_trace(go.Scatter(
            x=sub['x_log'],
            y=sub['contribution_med'],
            mode='markers+text',
            name=f"{statut} ({mask.sum()})",
            marker=dict(
                size=sub['size_norm'],
                color=color,
                opacity=0.75,
                line=dict(width=0.8, color='rgba(60,30,10,0.4)')
            ),
            text=[a.title()[:18] if sub['ca_total_magasin'].iloc[i] > ca_max * 0.05
                  else '' for i, a in enumerate(sub['article'])],
            textposition='top center',
            textfont=dict(size=8, color='#5a3010'),
            hovertemplate=(
                "<b>%{customdata[0]}</b><br>"
                "Contribution médiane : %{y:.1f}%<br>"
                "Nb tickets multi : %{customdata[1]:,}<br>"
                "CA total : %{customdata[2]:,.0f} €<br>"
                "Statut : %{customdata[3]}<extra></extra>"
            ),
            customdata=list(zip(
                sub['article'],
                sub['nb_tickets_multi'],
                sub['ca_total_magasin'],
                sub['statut_contribution'],
            )),
        ))

    for seuil, label, color in [
        (SEUIL_ANCRE, f"Ancre ≥ {SEUIL_ANCRE:.0f}%", COLOR_STATUT['Produit Ancre']),
        (SEUIL_MOTEUR, f"Moteur ≥ {SEUIL_MOTEUR:.0f}%", COLOR_STATUT['Moteur du Panier']),
        (SEUIL_COMPL, f"Compl. ≥ {SEUIL_COMPL:.0f}%", COLOR_STATUT['Produit Complementaire']),
    ]:
        fig2.add_hline(
            y=seuil, line_dash="dot",
            line_color=color, line_width=1.3, opacity=0.6,
            annotation_text=label,
            annotation_position="right",
            annotation_font_color=color,
            annotation_font_size=9,
        )

    x_ticks_real = [10, 50, 200, 1000, 5000, 20000]
    fig2.update_xaxes(
        tickvals=[np.log1p(v) for v in x_ticks_real],
        ticktext=[f'{v:,}' for v in x_ticks_real],
        title='Nombre de Tickets Multi-Articles (échelle log)',
    )

    fig2.update_layout(
        height=550,
        plot_bgcolor='rgba(253,246,236,0.5)',
        paper_bgcolor='rgba(0,0,0,0)',
        yaxis_title='Contribution Médiane (%)',
        yaxis=dict(ticksuffix='%', range=[0, 95], gridcolor='rgba(200,134,10,0.15)'),
        xaxis=dict(gridcolor='rgba(200,134,10,0.15)'),
        legend=dict(
            orientation='h', yanchor='bottom', y=-0.22,
            xanchor='center', x=0.5,
            bgcolor='rgba(253,246,236,0.85)',
            bordercolor='#C8860A', borderwidth=1,
        ),
        margin=dict(l=10, r=80, t=20, b=80),
    )

    st.plotly_chart(fig2, use_container_width=True)

    st.markdown('<div class="insight-box">💡 <strong>Lecture :</strong> '
                'Les <em>Moteurs du Panier</em> dans le coin supérieur droit combinent haute fréquence '
                'et fort poids financier — c\'est la zone de <strong>rentabilité maximale</strong> du catalogue.'
                '</div>', unsafe_allow_html=True)

# ────────────────────────────────────────────────────────────
# TAB 3 — TABLEAU COMPLET FILTRABLE
# ────────────────────────────────────────────────────────────
with tab3:
    st.markdown(f'<div class="section-title">Tableau Complet — {len(tc)} Produits Analysés</div>',
                unsafe_allow_html=True)

    col_f1, col_f2, col_f3 = st.columns([2, 2, 1])
    with col_f1:
        filtre_statut = st.multiselect(
            "Filtrer par statut",
            options=ORDRE_STATUT,
            default=ORDRE_STATUT,
        )
    with col_f2:
        search = st.text_input("Rechercher un produit", placeholder="ex: baguette")
    with col_f3:
        top_n = st.slider("Afficher N produits", 10, len(tc), len(tc))

    df_filtered = tc[tc['statut_contribution'].isin(filtre_statut)].copy()
    if search:
        df_filtered = df_filtered[
            df_filtered['article'].str.lower().str.contains(search.lower())
        ]
    df_filtered = df_filtered.head(top_n)

    df_display = df_filtered[['article', 'statut_contribution',
                               'contribution_med', 'contribution_moy',
                               'contribution_std', 'nb_tickets_multi',
                               'ca_total_magasin']].copy()
    df_display.columns = ['Produit', 'Statut', 'Méd. (%)',
                           'Moy. (%)', 'Écart-type (%)',
                           'Tickets Multi', 'CA Total (€)']

    def color_row(row):
        c = COLOR_STATUT.get(row['Statut'], '#888888')
        return [f'color: {c}; font-weight: bold' if col == 'Statut'
                else '' for col in row.index]

    st.dataframe(
        df_display.style.apply(color_row, axis=1)
                        .format({
                            'Méd. (%)': '{:.1f}',
                            'Moy. (%)': '{:.1f}',
                            'Écart-type (%)': '{:.1f}',
                            'Tickets Multi': '{:,.0f}',
                            'CA Total (€)': '{:,.0f}',
                        }),
        use_container_width=True,
        height=500,
    )

    st.caption(f"📌 {len(df_filtered)} produits affichés sur {len(tc)} analysés")

    csv = df_display.to_csv(index=False).encode('utf-8')
    st.download_button(
        "⬇️ Télécharger ce tableau (CSV)",
        data=csv,
        file_name="ticket_contribution.csv",
        mime="text/csv",
    )

# ────────────────────────────────────────────────────────────
# TAB 4 — ANALYSE PAR STATUT
# ────────────────────────────────────────────────────────────
with tab4:
    st.markdown('<div class="section-title">Répartition Stratégique par Statut</div>',
                unsafe_allow_html=True)

    col_d, col_t = st.columns([1, 1])

    with col_d:
        rep = repartition.dropna(subset=['statut_contribution'])
        fig_donut = go.Figure(go.Pie(
            labels=rep['statut_contribution'],
            values=rep['ca_total'],
            hole=0.55,
            marker_colors=[COLOR_STATUT.get(s, '#888') for s in rep['statut_contribution']],
            textinfo='label+percent',
            textfont_size=11,
            hovertemplate=(
                "<b>%{label}</b><br>"
                "CA Total : %{value:,.0f} €<br>"
                "Part CA  : %{percent}<extra></extra>"
            )
        ))
        fig_donut.update_layout(
            height=360,
            showlegend=False,
            paper_bgcolor='rgba(0,0,0,0)',
            margin=dict(l=10, r=10, t=30, b=10),
            annotations=[dict(
                text=f"<b>{stats['ca_total']/1000:.0f} K€</b><br>CA Total",
                x=0.5, y=0.5, font_size=14,
                font_color='#8B3A0F', showarrow=False
            )]
        )
        st.plotly_chart(fig_donut, use_container_width=True)

    with col_t:
        st.markdown("<br><br>", unsafe_allow_html=True)
        for _, row in rep.iterrows():
            if pd.isna(row['statut_contribution']):
                continue
            color = COLOR_STATUT.get(row['statut_contribution'], '#888')
            nb_p = int(row['nb_produits']) if pd.notna(row['nb_produits']) else 0
            ca_t = float(row['ca_total']) if pd.notna(row['ca_total']) else 0.0
            p_ca = float(row['part_ca_%']) if pd.notna(row['part_ca_%']) else 0.0
            m_m  = float(row['med_moy']) if pd.notna(row['med_moy']) else 0.0
            st.markdown(f"""
            <div style="background:rgba(253,246,236,1);border:1.5px solid {color};
                        border-radius:10px;padding:12px 16px;margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="color:{color};font-weight:700;font-size:0.95rem;">
                  {row['statut_contribution']}
                </span>
                <span style="color:#8B3A0F;font-weight:800;font-size:1.1rem;">
                  {p_ca:.1f}%
                </span>
              </div>
              <div style="display:flex;gap:20px;margin-top:8px;font-size:0.82rem;color:#A0522D;">
                <span>📦 <b>{nb_p}</b> produits</span>
                <span>💶 <b>{ca_t:,.0f} €</b></span>
                <span>📊 Méd. moy. <b>{m_m:.1f}%</b></span>
              </div>
            </div>
            """, unsafe_allow_html=True)

    st.divider()

    st.markdown("#### 🧠 Synthèse Décisionnelle")

    interpretations = {
        'Produit Ancre': (
            COLOR_STATUT['Produit Ancre'],
            "🔴 Produit Ancre",
            "Produit > ~5 € · Raison principale de la visite. Gestion stock critique lors des "
            "périodes clés (galettes en janvier, bûches en décembre). "
            "Une rupture = un ticket entier perdu."
        ),
        'Moteur du Panier': (
            COLOR_STATUT['Moteur du Panier'],
            "🟠 Moteur du Panier",
            "Produit ~3–5 € · Cœur transactionnel quotidien. Emplacement prioritaire en vitrine. "
            "Combinent haute pénétration ET fort poids financier → zone de rentabilité maximale."
        ),
        'Produit Complementaire': (
            COLOR_STATUT['Produit Complementaire'],
            "🟡 Produit Complémentaire",
            "Produit ~1.5–3 € · Force = présence systématique dans les paniers, malgré une "
            "contribution unitaire modeste. "
            "Levier : placement caisse/tête de gondole pour maximiser les achats d'impulsion."
        ),
        'Micro Contributeur': (
            COLOR_STATUT['Micro Contributeur'],
            "⚫ Micro Contributeur",
            "Produit < ~1.5 € · Contribution marginale au ticket. "
            "Évaluer l'utilité dans le catalogue — maintien si rôle d'image, retrait sinon."
        ),
    }

    for statut, (color, titre, texte) in interpretations.items():
        if statut not in rep['statut_contribution'].values:
            continue
        st.markdown(f"""
        <div style="border-left:4px solid {color};background:rgba(253,246,236,0.8);
                    border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:10px;">
          <div style="font-weight:700;color:{color};margin-bottom:4px;">{titre}</div>
          <div style="font-size:0.87rem;color:#5a3010;">{texte}</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown('<br>', unsafe_allow_html=True)

    st.markdown("#### 🔗 Lecture Croisée avec la Matrice de Décision")
    df_cross = pd.DataFrame({
        'Catégorie Matrice': ['⭐ Star (Indispensable)', '💎 Niche (Rentable)',
                              '🚦 Générateur de Trafic', '💀 Stock Dormant'],
        'Profil Ticket Contribution typique': [
            'Moteur du Panier + forte Pénétration',
            'Produit Ancre + faible Pénétration',
            'Produit Complémentaire + très haute Pénétration',
            'Micro Contributeur + faible Velocity',
        ]
    })
    st.table(df_cross)
