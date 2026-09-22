import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from style import inject_bakery_style, section_header, bakery_sidebar_logo

import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
import pickle
import math

st.set_page_config(page_title="Sales Velocity", page_icon="⚡", layout="wide")
inject_bakery_style()
bakery_sidebar_logo()

# ════════════════════════════════════════════
# CONSTANTES & COULEURS
# ════════════════════════════════════════════
C1  = '#8B3A0F'
C2  = '#C8860A'
C3  = '#E6A817'
BG  = '#FDF6EC'
TXT = '#A0522D'

CRENEAUX = {
    'Petit-déjeuner (7h-9h)'   : {'heures': range(7, 10),  'color': '#F39C12'},
    'Déjeuner (12h-13h)'       : {'heures': range(12, 14), 'color': '#3498DB'},
    'Fin de journée (16h-19h)' : {'heures': range(16, 20), 'color': '#27AE60'},
}

# ════════════════════════════════════════════
# CHARGEMENT DES DONNÉES
# ════════════════════════════════════════════
@st.cache_data
def load_data():
    with open('retail_data.pkl', 'rb') as f:
        d = pickle.load(f)

    df = d['df_clean'].copy()

    if 'hour' not in df.columns:
        def extract_hour(val):
            if pd.isnull(val): return np.nan
            try: return int(str(val).strip().split(':')[0])
            except: return np.nan
        df['hour'] = df['time'].apply(extract_hour) if 'time' in df.columns else np.nan

    if 'is_touristic_season' not in df.columns:
        df['is_touristic_season'] = df['date'].dt.month.isin([7, 8]).astype(int)

    if 'is_event' not in df.columns:
        def is_event_fn(d):
            m, day = d.month, d.day
            if m == 1:                return 1
            if m == 2 and day == 14:  return 1
            paques = {2024: (3, 31), 2025: (4, 20)}
            y = d.year
            if y in paques:
                pm, pd_ = paques[y]
                if m == pm and abs(day - pd_) <= 1: return 1
            if m == 12 and day >= 20: return 1
            return 0
        df['is_event'] = df['date'].apply(is_event_fn)

    df_macro_saved = d.get('df_macro', None)
    return df, df_macro_saved


df, df_macro_cache = load_data()

# ════════════════════════════════════════════
# CALCUL MACRO-VELOCITY
# ════════════════════════════════════════════
@st.cache_data
def compute_macro(_df):
    jours_actifs_global = _df['date'].nunique()

    macro_global = (_df.groupby('article')
                    .agg(qte_totale=('quantity', 'sum'),
                         stock_securite=('quantity', 'std'))
                    .reset_index())
    macro_global['daily_velocity'] = (
        macro_global['qte_totale'] / jours_actifs_global
    ).round(2)
    macro_global['stock_securite'] = (
        macro_global['daily_velocity'] + macro_global['stock_securite'].fillna(0)
    ).round(0)
    macro_global = macro_global.drop(columns=['qte_totale'])

    df_t   = _df[_df['is_touristic_season'] == 1]
    jours_t = df_t['date'].nunique()
    mt = df_t.groupby('article').agg(qte=('quantity', 'sum')).reset_index()
    mt['velocity_touristic'] = (mt['qte'] / jours_t).round(2) if jours_t > 0 else 0

    df_e    = _df[_df['is_event'] == 1]
    jours_e = df_e['date'].nunique()
    me = df_e.groupby('article').agg(qte=('quantity', 'sum')).reset_index()
    me['velocity_event'] = (me['qte'] / jours_e).round(2) if jours_e > 0 else 0

    df_mac = (macro_global
              .merge(mt[['article', 'velocity_touristic']], on='article', how='left')
              .merge(me[['article', 'velocity_event']],     on='article', how='left')
              .fillna(0))

    df_mac['ratio_touristic'] = (
        df_mac['velocity_touristic'] / df_mac['daily_velocity']
    ).replace([np.inf, -np.inf], 0).round(2)

    df_mac['ratio_event'] = (
        df_mac['velocity_event'] / df_mac['daily_velocity']
    ).replace([np.inf, -np.inf], 0).round(2)

    df_mac = df_mac.sort_values('daily_velocity', ascending=False).reset_index(drop=True)

    return df_mac, jours_actifs_global, jours_t, jours_e


@st.cache_data
def compute_velocity_jours(_df):
    ordre  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    labels = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']

    def vel_par_jour(df_sub):
        v = (df_sub.groupby(df_sub['date'].dt.day_name())
             .agg(qte=('quantity', 'sum'),
                  jours=('date', lambda x: x.nunique()))
             .reindex(ordre))
        v['velocity'] = (v['qte'] / v['jours']).round(2)
        return v

    return (vel_par_jour(_df),
            vel_par_jour(_df[_df['is_touristic_season'] == 1]),
            vel_par_jour(_df[_df['is_event'] == 1]),
            labels)


@st.cache_data
def compute_micro(_df, _df_macro):
    df_h = _df[_df['hour'].notna()].copy()
    df_h['hour'] = df_h['hour'].astype(int)

    mask_mer  = ((df_h['date'].dt.dayofweek == 2) &
                 (df_h['is_touristic_season'] == 0) &
                 (df_h['is_event'] == 0))
    mask_dim  = ((df_h['date'].dt.dayofweek == 6) &
                 (df_h['hour'] >= 14) &
                 (df_h['is_touristic_season'] == 0) &
                 (df_h['is_event'] == 0))
    mask_hors = ((df_h['hour'] < 7) | (df_h['hour'] > 19))
    df_hc     = df_h[~(mask_mer | mask_dim | mask_hors)].copy()

    jours_u = (df_hc[['date', 'is_touristic_season', 'is_event']]
               .drop_duplicates('date').copy())
    jours_u['dow'] = pd.to_datetime(jours_u['date']).dt.dayofweek

    jours_actifs_h = {}
    for h in range(7, 20):
        c = 0
        for _, row in jours_u.iterrows():
            dow        = row['dow']
            is_special = (row['is_touristic_season'] == 1 or row['is_event'] == 1)
            if dow == 2:
                if is_special: c += 1
            elif dow == 6:
                if h <= 13:        c += 1
                elif is_special:   c += 1
            else:
                c += 1
        jours_actifs_h[h] = c

    vel_h = (df_hc.groupby(['article', 'hour'])
             .agg(qte=('quantity', 'sum')).reset_index())
    vel_h['jours_h']          = vel_h['hour'].map(jours_actifs_h)
    vel_h['velocity_horaire'] = (vel_h['qte'] / vel_h['jours_h']).round(2)

    idx_peak = vel_h.groupby('article')['velocity_horaire'].idxmax()
    df_peak  = vel_h.loc[idx_peak].rename(columns={
        'hour'            : 'peak_hour',
        'velocity_horaire': 'peak_velocity',
    })

    df_mic = _df_macro[['article', 'daily_velocity', 'stock_securite']].merge(
        df_peak[['article', 'peak_hour', 'peak_velocity']], on='article', how='left')
    df_mic['ratio_pic_%'] = (
        df_mic['peak_velocity'] / df_mic['daily_velocity'] * 100
    ).round(1)
    df_mic['alerte'] = df_mic.apply(
        lambda r: f"ALERTE : Remplir avant {int(r['peak_hour'])}h00"
        if r['ratio_pic_%'] >= 30 else 'Flux Stable', axis=1)
    df_mic = df_mic.sort_values('daily_velocity', ascending=False).reset_index(drop=True)

    vel_glob = (df_hc.groupby('hour')['quantity']
                .sum().reset_index().sort_values('hour'))
    vel_glob['velocity'] = vel_glob.apply(
        lambda r: round(r['quantity'] / jours_actifs_h.get(int(r['hour']), 1), 1),
        axis=1)

    return df_mic, vel_glob, df_hc, jours_actifs_h


df_macro, jours_global, jours_t, jours_e = compute_macro(df)
vel_global, vel_ete, vel_event, labels_jours = compute_velocity_jours(df)
df_micro, vel_heure_glob, df_hour_corr, jours_actifs_h = compute_micro(df, df_macro)

nb_alertes = (df_micro['alerte'] != 'Flux Stable').sum()

# ════════════════════════════════════════════
# EN-TÊTE DE PAGE
# ════════════════════════════════════════════
st.markdown("""
<div style="background:linear-gradient(135deg,#8B3A0F,#C8860A);
     border-radius:12px;padding:22px 28px;margin-bottom:24px;">
  <h1 style="color:white;margin:0;font-size:26px;
       font-family:'Playfair Display',serif;">
    ⚡ Sales Velocity — Vitesse d'Écoulement des Produits
  </h1>
  <p style="color:rgba(255,255,255,0.82);margin:6px 0 0;font-size:13px;">
    Boulangerie Le Croisic · Macro & Micro niveaux · Jan 2024 → Déc 2025
  </p>
</div>""", unsafe_allow_html=True)

st.markdown("""
> ⚡ **Pourquoi la Sales Velocity ?** Elle répond à *« À quelle vitesse ce produit
> quitte-t-il le rayon ? »* — Un KPI opérationnel essentiel pour optimiser les
> commandes, le stock de sécurité et le planning de production.
""")

# ════════════════════════════════════════════
# KPI GLOBAUX
# ════════════════════════════════════════════
def kpi_card(titre, valeur, couleur, sous=""):
    return f"""
    <div style="background:white;border-radius:10px;padding:16px 18px;
         border-left:5px solid {couleur};
         box-shadow:0 2px 8px rgba(0,0,0,0.08);height:100%;">
      <div style="font-size:11px;color:#888;font-weight:600;
           text-transform:uppercase;letter-spacing:0.5px;
           margin-bottom:4px;">{titre}</div>
      <div style="font-size:28px;font-weight:700;color:{couleur};
           font-family:'Playfair Display',serif;">{valeur}</div>
      <div style="font-size:11px;color:#aaa;margin-top:3px;">{sous}</div>
    </div>"""

k1, k2, k3, k4 = st.columns(4)
k1.markdown(kpi_card("📅 Jours actifs",       str(jours_global), C1,       "2024-2025"),              unsafe_allow_html=True)
k2.markdown(kpi_card("🌊 Jours touristiques", str(jours_t),      C2,       "Juillet + Août"),         unsafe_allow_html=True)
k3.markdown(kpi_card("🎉 Jours événements",   str(jours_e),      C3,       "Noël, Galette, Pâques…"), unsafe_allow_html=True)
k4.markdown(kpi_card("🚨 Produits en alerte", str(nb_alertes),   '#E74C3C','Concentration ≥ 30%'),    unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# ════════════════════════════════════════════
# TABS
# ════════════════════════════════════════════
tab2, tab3, tab4 = st.tabs([
    "📅 Velocity par Jour",
    "⏱️ Micro-Velocity Horaire",
    "🚨 Alertes Rayon",
])

# TAB 2 — VELOCITY PAR JOUR DE LA SEMAINE
# ─────────────────────────────────────────────────────────────
with tab2:
    st.markdown("##### 📅 Macro-Velocity par Jour de la Semaine")
    st.caption(
        "Comparaison des trois contextes : Global · Estival · Événements. "
        "Le Mercredi est grisé (fermeture habituelle)."
    )

    ordre = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

    contextes_jours = [
        (vel_global, f'Velocity Globale ({jours_global} jours)', C1),
        (vel_ete,    f'Velocity Estivale ({jours_t} jours)',      C2),
        (vel_event,  f'Velocity Événements ({jours_e} jours)',    C3),
    ]

    fig2 = make_subplots(rows=1, cols=3,
                         subplot_titles=[c[1] for c in contextes_jours],
                         horizontal_spacing=0.08)

    for col_idx, (vel_df, titre, color) in enumerate(contextes_jours, start=1):
        vals = vel_df['velocity'].fillna(0).values
        moy  = vals.mean()
        colors_j = [color if j != 'Wednesday' else '#CCCCCC' for j in ordre]

        fig2.add_trace(go.Bar(
            x=vals, y=labels_jours,
            orientation='h',
            marker_color=colors_j,
            text=[f" {v:.0f}" for v in vals],
            textposition='outside',
            textfont=dict(size=10, color=color),
            hovertemplate='<b>%{y}</b> : <b>%{x:.1f} u/j</b><extra></extra>',
            showlegend=False,
        ), row=1, col=col_idx)

        fig2.add_vline(x=moy, line_dash='dash', line_color='#777',
                       line_width=1.5, row=1, col=col_idx,
                       annotation_text=f'Moy:{moy:.0f}',
                       annotation_font_color='#777', annotation_font_size=9,
                       annotation_position='top right')

        fig2.update_xaxes(title_text='u/j', title_font=dict(size=9),
                          gridcolor='rgba(139,58,15,0.08)', row=1, col=col_idx)
        fig2.update_yaxes(tickfont=dict(size=10),
                          gridcolor='rgba(0,0,0,0)', row=1, col=col_idx)

    for ann in fig2.layout.annotations:
        ann.update(font=dict(size=11, color=C1))

    fig2.update_layout(
        height=420,
        plot_bgcolor='rgba(253,246,236,0.5)',
        paper_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=60, b=40, l=10, r=80),
        showlegend=False,
    )
    st.plotly_chart(fig2, use_container_width=True)

    st.divider()

    st.markdown("##### 📋 Tableau comparatif par jour")
    df_jours = pd.DataFrame({
        'Jour'            : labels_jours,
        'Vel. Globale'    : vel_global['velocity'].fillna(0).values.round(1),
        'Vel. Estivale'   : vel_ete['velocity'].fillna(0).values.round(1),
        'Ratio Été'       : (vel_ete['velocity'].fillna(0) /
                             vel_global['velocity'].replace(0, np.nan)
                             ).round(2).fillna(0).values,
        'Vel. Événements' : vel_event['velocity'].fillna(0).values.round(1),
        'Ratio Event'     : (vel_event['velocity'].fillna(0) /
                             vel_global['velocity'].replace(0, np.nan)
                             ).round(2).fillna(0).values,
    })
    st.dataframe(df_jours, use_container_width=True, hide_index=True)

# ─────────────────────────────────────────────────────────────
# TAB 3 — MICRO-VELOCITY HORAIRE
# ─────────────────────────────────────────────────────────────
with tab3:
    st.markdown("##### ⏱️ Micro-Velocity — Distribution Horaire Globale")
    st.caption(
        "Dénominateur corrigé par heure selon les horaires réels d'ouverture. "
        "Mercredi fermé exclu · Dimanche après 14h exclu."
    )

    heures_v = vel_heure_glob['hour'].astype(int).values
    vals_v   = vel_heure_glob['velocity'].values

    def couleur_heure(h, v, v_max, v_mean):
        if v == v_max: return C1
        for cr in CRENEAUX.values():
            if h in cr['heures']: return cr['color']
        return C2 if v >= v_mean else '#CCCCCC'

    colors_h = [couleur_heure(h, v, vals_v.max(), vals_v.mean())
                for h, v in zip(heures_v, vals_v)]

    fig3 = go.Figure()

    for label, cr in CRENEAUX.items():
        h_list = list(cr['heures'])
        fig3.add_vrect(
            x0=h_list[0] - 0.5, x1=h_list[-1] + 0.5,
            fillcolor=cr['color'], opacity=0.08, line_width=0,
            annotation_text=label.split('(')[0].strip(),
            annotation_position='top left',
            annotation_font=dict(size=9, color=cr['color']),
        )

    fig3.add_trace(go.Bar(
        x=heures_v, y=vals_v,
        marker_color=colors_h,
        marker_line_color='rgba(253,246,236,1)',
        marker_line_width=0.5,
        text=[f"{v:.0f}" if c != '#CCCCCC' else ''
              for v, c in zip(vals_v, colors_h)],
        textposition='outside',
        textfont=dict(size=9, color=C1, family='Arial Black'),
        hovertemplate='<b>%{x}h00</b> : <b>%{y:.1f} u/h</b><extra></extra>',
    ))

    moy_v = vals_v.mean()
    fig3.add_hline(y=moy_v, line_dash='dash', line_color='#777', line_width=1.5,
                   annotation_text=f'Moy : {moy_v:.0f}',
                   annotation_font_color='#777', annotation_font_size=9,
                   annotation_position='top right')

    fig3.update_layout(
        height=420,
        plot_bgcolor='rgba(253,246,236,0.5)',
        paper_bgcolor='rgba(0,0,0,0)',
        xaxis=dict(title='Heure de la journée',
                   tickmode='array', tickvals=list(heures_v),
                   ticktext=[f'{h}h' for h in heures_v],
                   gridcolor='rgba(139,58,15,0.08)',
                   title_font=dict(size=11)),
        yaxis=dict(title='Unités vendues / jour actif',
                   gridcolor='rgba(139,58,15,0.08)',
                   title_font=dict(size=11)),
        margin=dict(t=30, b=60, l=10, r=60),
        showlegend=False,
    )
    st.plotly_chart(fig3, use_container_width=True)

    st.divider()

    st.markdown("##### 🔍 Velocity horaire par produit")
    produit_sel = st.selectbox(
        "Sélectionner un produit",
        df_macro['article'].str.title().tolist(),
        key="produit_micro",
    )

    art_upper = produit_sel.upper()
    df_prod_h = (df_hour_corr[df_hour_corr['article'] == art_upper]
                 .groupby('hour')['quantity'].sum()
                 .reset_index().sort_values('hour'))

    if not df_prod_h.empty:
        df_prod_h['velocity'] = df_prod_h.apply(
            lambda r: round(
                r['quantity'] / jours_actifs_h.get(int(r['hour']), 1), 2),
            axis=1)

        heures_p = df_prod_h['hour'].astype(int).values
        vals_p   = df_prod_h['velocity'].values
        peak_h   = heures_p[np.argmax(vals_p)]
        peak_v   = vals_p.max()

        colors_p = [couleur_heure(h, v, peak_v, vals_p.mean())
                    for h, v in zip(heures_p, vals_p)]

        fig3b = go.Figure()
        fig3b.add_trace(go.Bar(
            x=heures_p, y=vals_p,
            marker_color=colors_p,
            text=[f"{v:.1f}" for v in vals_p],
            textposition='outside',
            textfont=dict(size=9, color=C1),
            hovertemplate='<b>%{x}h00</b> : <b>%{y:.2f} u/h</b><extra></extra>',
        ))
        fig3b.add_vline(
            x=peak_h, line_dash='dot', line_color=C1, line_width=2,
            annotation_text=f'Pic : {peak_h}h ({peak_v:.1f} u/h)',
            annotation_font_color=C1, annotation_font_size=10,
            annotation_position='top right',
        )
        fig3b.update_layout(
            height=350,
            title=f"Velocity horaire — {produit_sel}",
            title_font=dict(size=13, color=C1),
            plot_bgcolor='rgba(253,246,236,0.5)',
            paper_bgcolor='rgba(0,0,0,0)',
            xaxis=dict(title='Heure', tickmode='array',
                       tickvals=list(heures_p),
                       ticktext=[f'{h}h' for h in heures_p],
                       gridcolor='rgba(139,58,15,0.08)'),
            yaxis=dict(title='u / jour actif',
                       gridcolor='rgba(139,58,15,0.08)'),
            margin=dict(t=50, b=50, l=10, r=60),
            showlegend=False,
        )
        st.plotly_chart(fig3b, use_container_width=True)
    else:
        st.info("Aucune donnée horaire disponible pour ce produit.")

# ─────────────────────────────────────────────────────────────
# TAB 4 — ALERTES RAYON
# ─────────────────────────────────────────────────────────────
with tab4:
    st.markdown("##### 🚨 Produits en Alerte — Concentration Horaire ≥ 30%")
    st.caption(
        f"**{nb_alertes} produits** dépassent le seuil de 30% : "
        "plus de 30% de leurs ventes journalières se concentrent sur **1 seule heure**. "
        "Le rayon doit être approvisionné **avant** l'heure de pic."
    )

    col_a1, col_a2 = st.columns([3, 1])
    with col_a2:
        seuil = st.slider("Seuil alerte (%)", 20, 60, 30, key="seuil_alerte")
    with col_a1:
        st.metric("Produits en alerte", len(df_micro[df_micro['ratio_pic_%'] >= seuil]),
                  f"seuil {seuil}%", delta_color="inverse")

    df_alerte = (df_micro[df_micro['ratio_pic_%'] >= seuil]
                 .sort_values('ratio_pic_%', ascending=True).copy())

    if df_alerte.empty:
        st.info("Aucun produit en alerte avec ce seuil.")
    else:
        def couleur_pic(h):
            for cr in CRENEAUX.values():
                if int(h) in cr['heures']: return cr['color']
            return C2

        colors_a = [couleur_pic(h) for h in df_alerte['peak_hour'].fillna(0)]
        labels_a = df_alerte['article'].str.title().apply(
            lambda x: x[:22] + '…' if len(x) > 22 else x).values

        fig4 = go.Figure()
        fig4.add_trace(go.Bar(
            x=df_alerte['ratio_pic_%'], y=labels_a,
            orientation='h',
            marker_color=colors_a,
            marker_line_color='rgba(253,246,236,1)',
            text=[f" {r:.1f}%  —  Pic : {int(h)}h00"
                  for r, h in zip(df_alerte['ratio_pic_%'],
                                  df_alerte['peak_hour'].fillna(0))],
            textposition='outside',
            textfont=dict(size=9, color=C1, family='Arial Black'),
            customdata=df_alerte[['daily_velocity', 'stock_securite']].values,
            hovertemplate=(
                '<b>%{y}</b><br>'
                'Concentration : <b>%{x:.1f}%</b><br>'
                'Vel. journalière : %{customdata[0]:.2f} u/j<br>'
                'Stock sécurité : %{customdata[1]:.0f}<extra></extra>'
            ),
        ))

        fig4.add_vline(
            x=seuil, line_dash='dash', line_color='#E74C3C', line_width=2,
            annotation_text=f'Seuil ({seuil}%)',
            annotation_font_color='#E74C3C', annotation_font_size=10,
            annotation_position='top right',
        )
        fig4.update_layout(
            height=max(450, len(df_alerte) * 30),
            plot_bgcolor='rgba(253,246,236,0.5)',
            paper_bgcolor='rgba(0,0,0,0)',
            xaxis=dict(title='Ratio pic / journée (%)',
                       gridcolor='rgba(139,58,15,0.08)',
                       title_font=dict(size=11),
                       range=[0, df_alerte['ratio_pic_%'].max() * 1.40]),
            yaxis=dict(gridcolor='rgba(0,0,0,0)', tickfont=dict(size=10)),
            margin=dict(t=30, b=50, l=10, r=160),
            showlegend=False,
        )
        st.plotly_chart(fig4, use_container_width=True)

        st.divider()

        leg_cols = st.columns(len(CRENEAUX) + 1)
        for i, (label, cr) in enumerate(CRENEAUX.items()):
            leg_cols[i].markdown(
                f'<div style="display:flex;align-items:center;gap:8px;font-size:12px;">'
                f'<div style="width:14px;height:14px;border-radius:3px;'
                f'background:{cr["color"]};flex-shrink:0;"></div>'
                f'<span style="color:#444;">{label}</span></div>',
                unsafe_allow_html=True)
        leg_cols[-1].markdown(
            f'<div style="display:flex;align-items:center;gap:8px;font-size:12px;">'
            f'<div style="width:14px;height:14px;border-radius:3px;'
            f'background:{C2};flex-shrink:0;"></div>'
            f'<span style="color:#444;">Autres créneaux</span></div>',
            unsafe_allow_html=True)

        st.divider()

        # ── CORRECTION : tableau avec uniquement 4 colonnes ──────────
        st.markdown("##### 📋 Tableau des produits en alerte")
        df_alerte_tbl = df_alerte[['article', 'daily_velocity',
                                   'peak_hour', 'alerte']].copy()
        df_alerte_tbl['article']   = df_alerte_tbl['article'].str.title()
        df_alerte_tbl['peak_hour'] = (df_alerte_tbl['peak_hour']
                                      .fillna(0).astype(int).astype(str) + 'h00')
        df_alerte_tbl.index = range(1, len(df_alerte_tbl) + 1)
        st.dataframe(
            df_alerte_tbl.rename(columns={
                'article'        : 'Produit',
                'daily_velocity' : 'Vel. Journalière',
                'peak_hour'      : 'Heure Pic',
                'alerte'         : 'Alerte',
            }),
            use_container_width=True,
            height=400,
        )
