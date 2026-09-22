import os, sys, pickle, base64, json
from pathlib import Path
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import streamlit as st
import streamlit.components.v1 as components

# Importer notre nouveau moteur de calcul
from data_engine import calculate_daily_kpis

st.set_page_config(
    page_title="Vue du Jour",
    page_icon="🥐",
    layout="wide",
    initial_sidebar_state="collapsed",
)

ORANGE = "#E8734A"
PEACH  = "#F0A882"
LIGHT  = "#FAD4C4"
INK    = "#1C1410"
MUTED  = "#9a8070"
GRID   = "rgba(200,140,100,0.13)"
PAL    = [ORANGE, PEACH, "#e05c35", "#f5c4a8", LIGHT,
          "#c45030", "#fad8c0", "#d4724a", "#fbe8d8", "#b84028"]

# ══════════════════════════════════════════════════════════════
# CHARGEMENT DES STYLES ET DONNÉES
# ══════════════════════════════════════════════════════════════
def load_css():
    css_path = Path(__file__).parent / "style.css"
    if css_path.exists():
        return f"<style>\n{css_path.read_text(encoding='utf-8')}\n</style>"
    return ""

st.markdown(load_css(), unsafe_allow_html=True)

@st.cache_data(show_spinner=False)
def load_pkl():
    base_bi = Path(__file__).resolve().parent.parent / "existing_bi" / "boulangerie-performance--main"
    for c in [Path("retail_data.pkl"), base_bi / "retail_data.pkl", Path("../retail_data.pkl")]:
        c = c.resolve()
        if c.exists():
            with c.open("rb") as f:
                d = pickle.load(f)
            if isinstance(d, dict): return d
    return None

data = load_pkl()
if data is None:
    st.error("retail_data.pkl introuvable.")
    st.stop()

df_all = data["df_clean"].copy()
df_all["date"] = pd.to_datetime(df_all["date"], errors="coerce")
df_all = df_all.dropna(subset=["date"])
df_all["day"] = df_all["date"].dt.date
for col in ["quantity","total_revenue","hour"]:
    if col not in df_all.columns: df_all[col] = 0.0
    df_all[col] = pd.to_numeric(df_all[col], errors="coerce").fillna(0)
df_all["hour"] = df_all["hour"].astype(int).clip(0,23)
if "article"  not in df_all.columns: df_all["article"]  = "Produit"
if "category" not in df_all.columns: df_all["category"] = "Autre"
if "ticket_number" not in df_all.columns: df_all["ticket_number"] = df_all.index.astype(str)
df_all["article"]  = df_all["article"].fillna("Produit").astype(str)
df_all["category"] = df_all["category"].fillna("Autre").astype(str)

available_days = sorted(df_all["day"].dropna().unique())

@st.cache_data(show_spinner=False)
def get_bg():
    p = Path(__file__).resolve().parent.parent / "existing_bi" / "boulangerie-performance--main" / "images" / "Screenshot 2026-09-15 212206.png"
    if p.exists():
        return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()
    return ""
bg_uri = get_bg()

# Date selector fixée au dernier jour
selected_day = available_days[-1]
sel_ts  = pd.Timestamp(selected_day)
dow     = sel_ts.weekday()
JOURS_FR_LONG = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"]
jour_str = JOURS_FR_LONG[dow]

# ══════════════════════════════════════════════════════════════
# APPEL AU DATA ENGINE
# ══════════════════════════════════════════════════════════════
kpis = calculate_daily_kpis(df_all, sel_ts)
locals().update(kpis) # Permet d'utiliser ca_jour, tickets, etc. directement pour faciliter le refactoring

# ══════════════════════════════════════════════════════════════
# CONVERSION FIGURES → HTML EMBARQUE
# ══════════════════════════════════════════════════════════════
FONT = {"family": "Inter, sans-serif", "color": "#5a4a3a"}

def fig2html(fig, div_id, height="160px"):
    d = json.loads(fig.to_json())
    return (
        f'<div id="{div_id}" style="height:{height};width:100%;"></div>'
        f'<script>Plotly.newPlot("{div_id}",{json.dumps(d["data"])},{json.dumps(d["layout"])},'
        f'{{displayModeBar:false,responsive:true,staticPlot:false}});</script>'
    )

BASE_LAYOUT = dict(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                   font=FONT, margin=dict(l=2,r=2,t=4,b=2), hovermode="x unified", showlegend=False)
XAX = dict(showgrid=False, tickfont=dict(size=8,color="#9a8070"), tickangle=0, tickcolor="#9a8070")
YAX = dict(showgrid=True, gridcolor=GRID, tickfont=dict(size=8,color="#9a8070"), tickformat=",.0f")

def barcols(series):
    mx = series.max()
    return [ORANGE if v == mx else LIGHT for v in series]

# -- Sparkline (Reports card)
fig_spark = go.Figure(go.Scatter(
    x=by_hour["heure"].tolist(), y=by_hour["ca"].tolist(),
    mode="lines", line=dict(color="rgba(255,255,255,0.70)",width=1.8),
    fill="tozeroy", fillcolor="rgba(255,255,255,0.12)", hoverinfo="skip"))
fig_spark.update_layout(height=55, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", margin=dict(l=0,r=0,t=0,b=0))
fig_spark.update_xaxes(visible=False); fig_spark.update_yaxes(visible=False)
spark_h = fig2html(fig_spark, "spark", "55px")

# -- Gauge Vitesse
vit_max = max(vitesse * 1.7, 25)
fig_g = go.Figure(go.Indicator(
    mode="gauge", value=vitesse,
    gauge={"axis":{"range":[0,vit_max],"tickfont":{"size":8,"color":"#9a8070"},"tickcolor":MUTED},
           "bar":{"color":ORANGE,"thickness":0.40}, "bgcolor":"rgba(0,0,0,0)","borderwidth":0,
           "steps":[{"range":[0,vit_max*.4],"color":"#fdf0ea"},
                     {"range":[vit_max*.4,vit_max*.72],"color":"#fad8c8"},
                     {"range":[vit_max*.72,vit_max],"color":"#f5c4a8"}],
           "threshold":{"line":{"color":"#b84020","width":2},"thickness":.8,"value":vit_max*.72}}))
fig_g.update_layout(height=140, paper_bgcolor="rgba(0,0,0,0)", margin=dict(l=20,r=20,t=15,b=5))
vitesse_h = fig2html(fig_g, "vitesse", "140px")

# Badge Vitesse
if vitesse >= 20:
    v_badge_bg, v_badge_color, v_text = "rgba(232, 115, 74, 0.08)", "#E8734A", "Forte"
    v_svg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>'
elif vitesse <= 5:
    v_badge_bg, v_badge_color, v_text = "rgba(154, 128, 112, 0.08)", "#9a8070", "Faible"
    v_svg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>'
else:
    v_badge_bg, v_badge_color, v_text = "rgba(122, 106, 90, 0.08)", "#7a6a5a", "Normale"
    v_svg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="12" x2="2" y2="12"></line></svg>'
vitesse_badge = f'<div style="background:{v_badge_bg};color:{v_badge_color};border-radius:99px;padding:3px 8px;font-size:.62rem;font-weight:700;display:flex;align-items:center;gap:5px;">{v_svg}{v_text}</div>'

# -- Treemap top produits
if len(top_qte) > 0:
    fig_tree = go.Figure(go.Treemap(
        labels=top_qte["article"].str[:16].tolist(), parents=[""]*len(top_qte), values=top_qte["quantity"].tolist(),
        marker=dict(colors=PAL[:len(top_qte)], line=dict(color="white",width=2)),
        textfont=dict(size=8,family="Inter,sans-serif",color="white"),
        hovertemplate="<b>%{label}</b><br>%{value:.0f} unites<extra></extra>", textposition="middle center"))
    fig_tree.update_layout(height=160, margin=dict(l=0,r=0,t=0,b=0), paper_bgcolor="rgba(0,0,0,0)", showlegend=False)
    tree_h = fig2html(fig_tree, "treemap", "160px")
else:
    tree_h = "<div style='height:160px;display:flex;align-items:center;justify-content:center;color:#9a8070;font-size:.78rem;'>Pas de donnees</div>"

# -- Barres CA/heure
bc4 = barcols(by_hour["ca"]) if not by_hour.empty else [LIGHT]
fig_hb = go.Figure(go.Bar(x=by_hour["heure"].tolist(), y=by_hour["ca"].tolist(), marker_color=bc4, hovertemplate="%{x} : %{y:,.0f} EUR<extra></extra>"))
fig_hb.update_layout(height=150, bargap=0.32, **BASE_LAYOUT)
fig_hb.update_xaxes(**{**XAX,"tickangle":-35}); fig_hb.update_yaxes(**YAX)
hourly_h = fig2html(fig_hb, "hourly", "150px")

# ── Contenu carte 1 (HTML pur)
s1, s2, s3 = max(15, int(nb_mono /max(tickets,1)*55)), max(8, int(nb_multi/max(tickets,1)*30)), 20
card1_content = f"""
<div style="background:#fdf5f0;border-radius:11px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
  <span style="font-size:.82rem;font-weight:600;color:#5a3820">Tickets : <span style="font-size:1.05rem;font-weight:800;color:{ORANGE}">{tickets}</span></span>
  <div style="width:22px;height:22px;background:{ORANGE};color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700">&#8599;</div>
</div>
<div style="display:flex;gap:5px;margin-bottom:12px;">
  <div style="height:42px;border-radius:10px;background:{ORANGE};flex:{s1}"></div>
  <div style="height:42px;border-radius:10px;background:linear-gradient(90deg,{ORANGE},{PEACH});opacity:.65;flex:{s2}"></div>
  <div style="height:42px;border-radius:10px;background:{LIGHT};flex:{s3}"></div>
</div>
<div style="display:flex;gap:10px;flex-wrap:wrap;">
  <div style="display:flex;align-items:center;gap:5px;font-size:.70rem;color:#5a4a3a;font-weight:500"><div style="width:8px;height:8px;border-radius:50%;background:{ORANGE}"></div>CA : {ca_jour:,.0f}</div>
  <div style="display:flex;align-items:center;gap:5px;font-size:.70rem;color:#5a4a3a;font-weight:500"><div style="width:8px;height:8px;border-radius:50%;background:{PEACH}"></div>Multi : {nb_multi}</div>
  <div style="display:flex;align-items:center;gap:5px;font-size:.70rem;color:#5a4a3a;font-weight:500"><div style="width:8px;height:8px;border-radius:50%;background:{LIGHT};border:1px solid {PEACH}"></div>Mono : {nb_mono}</div>
</div>
"""

# -- Legend treemap
top3_leg = "".join([f'<div style="display:flex;align-items:center;gap:5px;font-size:.68rem;color:#5a4a3a;font-weight:500"><div style="width:7px;height:7px;border-radius:50%;background:{PAL[i]};flex-shrink:0"></div>{str(row["article"])[:16]} &nbsp;<strong>{float(row["quantity"]):.0f}</strong></div>' for i, row in top_qte.head(3).iterrows()])

# -- Top Combinaisons
if top_pairs:
    mx_cnt = top_pairs[0][1]
    mba_card_h = "".join([f'<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f5f0ea;"><span style="font-size:.70rem;color:#1C1410;font-weight:500;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{pa[:13]} + {pb[:13]}</span><div style="display:flex;align-items:center;gap:5px;flex-shrink:0;margin-left:6px;"><div style="width:{max(4, int(cnt / mx_cnt * 50))}px;height:4px;background:{ORANGE};border-radius:99px;opacity:.7"></div><span style="font-size:.68rem;font-weight:700;color:#c05030;background:#fdf0ea;border-radius:4px;padding:1px 5px;">{cnt}x</span></div></div>' for (pa, pb), cnt in top_pairs[:5]])
else:
    mba_card_h = '<div style="font-size:.76rem;color:#9a8070;padding:16px 0;text-align:center;">Pas assez de tickets multi-produits.</div>'
mba_card_h = f'<div style="flex:1;overflow:hidden;margin-top:6px;">{mba_card_h}</div>'

# ══════════════════════════════════════════════════════════════
# COMPOSANT HERO + 4 CARTES
# ══════════════════════════════════════════════════════════════
paire_texte = f"{top_pairs[0][0][0][:12]} + {top_pairs[0][0][1][:12]}" if top_pairs else "Aucune paire"
top_prod_name = str(top_qte.iloc[0]["article"]) if len(top_qte) > 0 else "Aucun"

svg_pulse = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8734A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>'
svg_link = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8734A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>'
svg_star = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8734A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'

if delta_vs_moy >= 10:
    svg_trend, trend_text = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8734A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>', f"CA +{delta_vs_moy:.1f}% vs moyenne"
elif delta_vs_moy <= -10:
    svg_trend, trend_text = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9a8070" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>', f"CA {delta_vs_moy:.1f}% vs moyenne"
else:
    svg_trend, trend_text = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9a8070" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="22" y2="12"></line></svg>', f"CA dans la normale ({delta_vs_moy:+.1f}%)"

etat_content = f"""
      <div style="flex:1; display:flex; flex-direction:column; gap:6px; margin-top:6px;">
        <div style="display:flex; align-items:center; gap:10px; padding:7px 10px; background:rgba(232, 115, 74, 0.04); border-radius:8px;">
          <div>{svg_pulse}</div><div style="font-size:.7rem; color:#1C1410; line-height:1.2;"><strong style="color:#E8734A">Activité {v_text.lower()}</strong><br><span style="color:#9a8070">{vitesse:.1f} art/h</span></div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; padding:7px 10px; background:rgba(232, 115, 74, 0.04); border-radius:8px;">
          <div>{svg_link}</div><div style="font-size:.7rem; color:#1C1410; line-height:1.2;"><strong style="color:#E8734A">Paire forte</strong><br><span style="color:#9a8070">{paire_texte}</span></div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; padding:7px 10px; background:rgba(232, 115, 74, 0.04); border-radius:8px;">
          <div>{svg_star}</div><div style="font-size:.7rem; color:#1C1410; line-height:1.2;"><strong style="color:#E8734A">Top Produit</strong><br><span style="color:#9a8070">{top_prod_name}</span></div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; padding:7px 10px; background:rgba(232, 115, 74, 0.04); border-radius:8px;">
          <div>{svg_trend}</div><div style="font-size:.7rem; color:#1C1410; line-height:1.2;"><strong style="color:#E8734A">Journée</strong><br><span style="color:#9a8070">{trend_text}</span></div>
        </div>
      </div>
"""

# Le CSS global est injecté directement dans load_css(). Pour le Hero, le style.css s'applique si la structure html est incluse dans l'app via components. 
# Mais components.html créé une iFrame ! Il FAUT donc réinjecter le style.css DANS le hero_html.
with (Path(__file__).parent / "style.css").open("r", encoding="utf-8") as f:
    hero_css = f.read()

hero_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<script src="https://cdn.plot.ly/plotly-2.26.0.min.js" charset="utf-8"></script>
<style>{hero_css}</style>
<style>.hero{{background-image:url('{bg_uri}');}}</style>
</head>
<body>
<div class="outer">
  <div class="hero">
    <div class="hero-ov"></div>
    <div class="hero-bar"><div class="logo-pill"><div class="logo-sq">&#x1F950;</div>Le Croisic</div></div>
    <div class="hero-title-wrap">
      <div class="h-title">Vue du Jour</div>
      <div class="h-sub">{jour_str} &nbsp;&middot;&nbsp; {sel_ts.strftime('%d/%m/%Y')}</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:22px;">
        <div class="icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <div class="icon-badge">{alerts_count}</div>
        </div>
        <div class="icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
            <path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path>
          </svg>
        </div>
      </div>
    </div>
    <div class="reports-card">
      <div class="rc-hdr"><span class="rc-title">Rapports</span><span class="rc-badge">Journee</span></div>
      <div class="rc-kpis">
        <div><div class="rc-lbl">Chiffre d'affaires</div><div class="rc-val">{ca_jour:,.0f} EUR</div></div>
        <div><div class="rc-lbl">Tickets</div><div class="rc-val">{tickets:,}</div></div>
      </div>
      <div class="rc-sub">Panier moy. {panier:.2f} EUR &nbsp;&middot;&nbsp; Pic {peak_h:02d}h</div>
      {spark_h}
    </div>
  </div>

  <div class="cards-row">
    <div class="bc"><div class="bc-title">État de la journée</div>{etat_content}</div>
    <div class="bc">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;"><div class="bc-title">Vitesse des Ventes</div>{vitesse_badge}</div>
      <div style="margin-bottom:2px"><span class="bc-big">{vitesse:.1f}</span><span style="font-size:.72rem;color:#9a8070;margin-left:4px;font-weight:600">art / h</span><div style="font-size:.66rem;color:#9a8070;margin-top:2px">Cadence de la journee</div></div>
      <div style="flex:1;display:flex;align-items:flex-end;">{vitesse_h}</div>
    </div>
    <div class="bc"><div class="bc-title">Top Produits</div><div style="flex:1;min-height:0">{tree_h}</div><div class="leg-row">{top3_leg}</div></div>
    <div class="bc"><div class="bc-title">Top Combinaisons</div>{mba_card_h}</div>
  </div>
</div>
</body>
</html>"""

components.html(hero_html, height=590, scrolling=False)

# ══════════════════════════════════════════════════════════════
# SECTIONS ANALYTIQUES (en dessous)
# ══════════════════════════════════════════════════════════════
def bcard(title, sub, content_html):
    st.markdown(f'<div class="cc"><div class="ct">{title}</div><div class="cs">{sub}</div>{content_html}</div>', unsafe_allow_html=True)

def plotly_card(title, sub, fig, height=210):
    st.markdown(f'<div class="cc"><div class="ct">{title}</div><div class="cs">{sub}</div>', unsafe_allow_html=True)
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar":False})
    st.markdown('</div>', unsafe_allow_html=True)

def prod_html(df_p, col):
    mv = float(df_p[col].max()) or 1
    rows = ""
    for i, row in df_p.iterrows():
        pct = float(row[col])/mv; bw = max(3,int(pct*52))
        c = PAL[i % len(PAL)]; name = str(row["article"])[:22]
        rows += f'<div class="prod-row"><div class="prod-nm"><div class="pdot" style="background:{c}"></div><span>{name}</span></div><div class="pbar-w"><div class="pbar" style="width:{bw}px;background:{c}"></div></div><span class="pval">{float(row[col]):.0f}</span></div>'
    return f'<div class="prod-list">{rows}</div>'

# ── Section 1 : Rythme horaire
st.markdown('<div class="sec-title">Rythme de la journee</div>', unsafe_allow_html=True)
st.markdown('<div class="sw"><div class="g3">', unsafe_allow_html=True)
c1a, c2a, c3a = st.columns(3, gap="small")
with c1a:
    fig_qte = go.Figure(go.Bar(x=by_hour["heure"], y=by_hour["qte"], marker_color=barcols(by_hour["qte"]), hovertemplate="%{x} : %{y:.0f} unites<extra></extra>"))
    fig_qte.update_layout(height=200, bargap=0.32, **BASE_LAYOUT); fig_qte.update_xaxes(**XAX); fig_qte.update_yaxes(**YAX)
    plotly_card("Quantites par Heure", f"Total : {qte_jour:.0f} unites", fig_qte)
with c2a:
    fig_tkt = go.Figure(go.Bar(x=by_hour["heure"], y=by_hour["tkt"], marker_color=barcols(by_hour["tkt"]), hovertemplate="%{x} : %{y} tickets<extra></extra>"))
    fig_tkt.update_layout(height=200, bargap=0.32, **BASE_LAYOUT); fig_tkt.update_xaxes(**XAX); fig_tkt.update_yaxes(**{**YAX,"tickformat":",d"})
    plotly_card("Tickets par Heure", "Nombre de transactions", fig_tkt)
with c3a:
    fig_pan = go.Figure(go.Scatter(x=by_hour["heure"], y=by_hour["panier_h"], mode="lines+markers", line=dict(color=PEACH,width=2.2), marker=dict(size=5,color=PEACH,line=dict(color="white",width=1.5)), fill="tozeroy", fillcolor="rgba(240,168,130,0.10)", hovertemplate="%{x} : %{y:.2f} EUR<extra></extra>"))
    fig_pan.update_layout(height=200, **BASE_LAYOUT); fig_pan.update_xaxes(**XAX); fig_pan.update_yaxes(**{**YAX,"tickformat":",.2f"})
    plotly_card("Panier Moyen par Heure", f"Moy. journee : {panier:.2f} EUR", fig_pan)
st.markdown('</div></div>', unsafe_allow_html=True)

# ── Section 2 : CA Horaire
st.markdown('<div class="sec-title">Chiffre d\'Affaires Horaire</div>', unsafe_allow_html=True)
st.markdown('<div class="sw"><div class="g2">', unsafe_allow_html=True)
c_ca1, c_ca2 = st.columns(2, gap="small")
with c_ca1:
    fig_cum = go.Figure(go.Scatter(x=by_hour["heure"], y=by_hour["ca_cum"], mode="lines+markers", line=dict(color=ORANGE,width=2.2), marker=dict(size=5,color=ORANGE), fill="tozeroy", fillcolor="rgba(232,115,74,0.10)", hovertemplate="%{x} : %{y:,.0f} EUR cumules<extra></extra>"))
    fig_cum.update_layout(height=210, **BASE_LAYOUT); fig_cum.update_xaxes(**XAX); fig_cum.update_yaxes(**YAX)
    plotly_card("CA Cumulé", "Progression sur la journée", fig_cum)
with c_ca2:
    fig_ca = go.Figure(go.Bar(x=by_hour["heure"], y=by_hour["ca"], marker_color=barcols(by_hour["ca"]), hovertemplate="%{x} : %{y:.0f} EUR<extra></extra>"))
    fig_ca.update_layout(height=210, bargap=0.32, **BASE_LAYOUT); fig_ca.update_xaxes(**XAX); fig_ca.update_yaxes(**YAX)
    plotly_card("CA par Heure", f"Pic d'activité : {peak_h:02d}h", fig_ca)
st.markdown('</div></div>', unsafe_allow_html=True)

# ── Section 3 : Top produits
st.markdown('<div class="sec-title">Top produits du jour</div>', unsafe_allow_html=True)
st.markdown('<div class="sw"><div class="g3">', unsafe_allow_html=True)
c1c, c2c, c3c = st.columns(3, gap="small")
with c1c: bcard("Plus vendus en quantite", "Unites", prod_html(top_qte, "quantity"))
with c2c: bcard("Plus generateurs de CA", "EUR", prod_html(top_ca, "total_revenue"))
with c3c: bcard("Presents dans le plus de tickets", "Tickets", prod_html(top_tkt, "nb_tkt"))
st.markdown('</div></div>', unsafe_allow_html=True)

# ── Section 4 : Mix & Catégories
st.markdown('<div class="sec-title">Mix et categories</div>', unsafe_allow_html=True)
st.markdown('<div class="sw"><div class="g2">', unsafe_allow_html=True)
c1d, c2d = st.columns(2, gap="small")
with c1d:
    fig_cat = go.Figure(go.Pie(labels=cat_df["category"].tolist(), values=cat_df["total_revenue"].tolist(), hole=0.52, marker=dict(colors=PAL[:len(cat_df)],line=dict(color="white",width=2)), textinfo="label+percent", textfont=dict(size=9,family="Inter"), hovertemplate="<b>%{label}</b><br>%{value:,.0f} EUR<br>%{percent}<extra></extra>"))
    fig_cat.add_annotation(text=f"<b>{ca_jour:,.0f}</b><br>EUR",x=0.5,y=0.5, showarrow=False,font=dict(size=10,color=INK,family="Inter"))
    fig_cat.update_layout(height=260, paper_bgcolor="rgba(0,0,0,0)", margin=dict(t=4,b=4,l=4,r=4), showlegend=True, legend=dict(orientation="h",y=-0.12,x=0.5,xanchor="center",font=dict(size=8,family="Inter")))
    plotly_card("Répartition par catégorie", "CA par famille de produits", fig_cat)
with c2d: bcard("Statut des Ventes", "Tickets du jour", card1_content)
st.markdown('</div></div>', unsafe_allow_html=True)

# ── Footer
st.markdown("<br>", unsafe_allow_html=True)
st.markdown(f'<div class="pf"><span>Boulangerie Le Croisic &nbsp;&middot;&nbsp; POS &nbsp;&middot;&nbsp; {len(day_df):,} lignes &nbsp;&middot;&nbsp; {sel_ts.strftime("%d/%m/%Y")}</span><span>Données historiques — pas le stock réel</span></div>', unsafe_allow_html=True)
