import streamlit as st
import pickle
import os

st.set_page_config(
    page_title="Retail Intelligence — Boulangerie Le Croisic",
    page_icon="🥐",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ============================================================
# CHARGEMENT
# ============================================================
@st.cache_data
def load_data():
    paths = [
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
if data:
    st.session_state['data'] = data
    df          = data['df_clean']
    total_ca    = df['total_revenue'].sum()
    nb_tickets  = df['ticket_number'].nunique()
    panier_moy  = total_ca / nb_tickets
    nb_jours    = df['date'].nunique()
    ca_2024     = df[df['date'].dt.year == 2024]['total_revenue'].sum()
    ca_2025     = df[df['date'].dt.year == 2025]['total_revenue'].sum()
    croissance  = (ca_2025 - ca_2024) / ca_2024 * 100 if ca_2024 > 0 else 0
    nb_produits = df['article'].nunique()
    date_min    = df['date'].dt.date.min().strftime('%d/%m/%Y')
    date_max    = df['date'].dt.date.max().strftime('%d/%m/%Y')
else:
    total_ca = nb_tickets = panier_moy = nb_jours = croissance = nb_produits = 0
    date_min = date_max = "—"

# ============================================================
# CSS — Artisan Bakery Menu Style
# ============================================================
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;0,900;1,400;1,700&family=Lato:wght@300;400;700&family=Great+Vibes&display=swap');

html, body, [class*="css"] {
    font-family: 'Lato', sans-serif;
    background: #F9F3E8 !important;
}
.main, .stApp { background: #F9F3E8 !important; }
.block-container { padding: 0 !important; max-width: 100% !important; }

/* ── SIDEBAR ── */
[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #3B1F0E 0%, #5C2D0F 60%, #3B1F0E 100%) !important;
    border-right: none !important;
}
[data-testid="stSidebar"] * { color: #F5DDB0 !important; font-family: 'Lato', sans-serif !important; }
[data-testid="stSidebarNav"] a { font-size: .86rem !important; border-radius: 8px !important; padding: 5px 12px !important; }
[data-testid="stSidebarNav"] a:hover { background: rgba(245,200,138,.15) !important; color: #F5C98A !important; }

/* ── WRAPPER ── */
.menu-wrap {
    background: #F9F3E8;
    min-height: 100vh;
    padding: 0;
    position: relative;
}

/* ── TOP BANNER ── */
.top-banner {
    background: #3B1F0E;
    padding: 10px 0;
    text-align: center;
    font-family: 'Lato', sans-serif;
    font-size: .72rem;
    letter-spacing: .18em;
    color: #C8860A;
    text-transform: uppercase;
}

/* ── HEADER ── */
.menu-header {
    background: #F9F3E8;
    text-align: center;
    padding: 48px 40px 32px;
    border-bottom: 2px solid #3B1F0E;
    position: relative;
}
.menu-header::before, .menu-header::after {
    content: '✦';
    position: absolute;
    top: 50%; transform: translateY(-50%);
    font-size: 1.2rem; color: #C8860A; opacity: .4;
}
.menu-header::before { left: 40px; }
.menu-header::after  { right: 40px; }

.bakery-script {
    font-family: 'Great Vibes', cursive;
    font-size: clamp(2.5rem, 5vw, 4.5rem);
    color: #C8860A;
    line-height: 1; margin: 0;
}
.bakery-name {
    font-family: 'Playfair Display', serif;
    font-size: clamp(1.8rem, 4vw, 3.2rem);
    font-weight: 900;
    color: #3B1F0E;
    letter-spacing: .08em;
    text-transform: uppercase;
    line-height: 1; margin: 4px 0 6px;
}
.bakery-location {
    font-family: 'Lato', sans-serif;
    font-size: .80rem; letter-spacing: .22em;
    text-transform: uppercase; color: #9E6B3A;
    margin: 0 0 14px;
}
.header-divider {
    display: flex; align-items: center;
    justify-content: center; gap: 14px; margin: 14px 0 0;
}
.hdiv-line { width: 80px; height: 1px; background: #3B1F0E; }
.hdiv-ornament {
    font-size: .85rem; color: #C8860A;
    font-family: 'Playfair Display', serif;
}

/* ── BODY ── */
.menu-body {
    max-width: 1200px;
    margin: 0 auto;
    padding: 50px 60px 60px;
}

/* ── SECTION TITLE (style menu) ── */
.menu-section-title {
    text-align: center;
    margin: 0 0 40px;
    position: relative;
}
.menu-section-title h2 {
    font-family: 'Playfair Display', serif;
    font-size: 1.6rem; font-weight: 700;
    color: #3B1F0E; letter-spacing: .06em;
    text-transform: uppercase; margin: 0;
    display: inline-block;
    background: #F9F3E8;
    padding: 0 20px;
    position: relative; z-index: 1;
}
.menu-section-title::before {
    content: '';
    position: absolute; top: 50%; left: 0; right: 0;
    height: 1px; background: #3B1F0E; z-index: 0;
}
.menu-section-title .script {
    font-family: 'Great Vibes', cursive;
    font-size: 1.1rem; color: #C8860A;
    display: block; margin-bottom: 2px;
}

/* ── KPI ROW ── */
.kpi-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    border: 2px solid #3B1F0E;
    margin-bottom: 56px;
}
.kpi-item {
    text-align: center;
    padding: 30px 20px;
    border-right: 1px solid #3B1F0E;
    background: #F9F3E8;
    transition: background .25s;
    position: relative;
}
.kpi-item:last-child { border-right: none; }
.kpi-item:hover { background: #FBF0D8; }
.kpi-item::before {
    content: '';
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 30px; height: 2px; background: #C8860A;
}
.kpi-emoji { font-size: 1.4rem; margin-bottom: 8px; display: block; }
.kpi-lbl {
    font-family: 'Lato', sans-serif;
    font-size: .62rem; color: #9E6B3A;
    letter-spacing: .16em; text-transform: uppercase;
    margin-bottom: 8px;
}
.kpi-val {
    font-family: 'Playfair Display', serif;
    font-size: 2rem; font-weight: 700;
    color: #3B1F0E; line-height: 1; margin-bottom: 4px;
}
.kpi-val .unit { font-size: 1.1rem; color: #C8860A; font-weight: 400; }
.kpi-note { font-size: .68rem; color: #B08050; font-style: italic; }
.kpi-tag {
    display: inline-block; margin-top: 8px;
    border: 1px solid #3B7A57; border-radius: 3px;
    padding: 2px 10px; font-size: .65rem;
    color: #3B7A57; letter-spacing: .06em;
}
.kpi-tag-amber {
    border-color: #C8860A; color: #C8860A;
}

/* ── MENU GRID ── */
.menu-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0;
    border: 2px solid #3B1F0E;
    margin-bottom: 50px;
}
.menu-item {
    padding: 32px 36px;
    border-right: 1px solid #C8A87A;
    border-bottom: 1px solid #C8A87A;
    background: #F9F3E8;
    transition: background .25s;
    position: relative;
    overflow: hidden;
}
.menu-item:hover { background: #FBF0D8; }
.menu-item:nth-child(2n) { border-right: none; }
.menu-item:nth-last-child(-n+2) { border-bottom: none; }

/* Numéro de section style menu */
.menu-num {
    position: absolute; top: 20px; right: 24px;
    font-family: 'Playfair Display', serif;
    font-size: .75rem; color: rgba(200,134,10,.35);
    letter-spacing: .08em;
}
.menu-item-header {
    display: flex; align-items: flex-start; gap: 16px; margin-bottom: 10px;
}
.menu-item-icon {
    width: 44px; height: 44px;
    border: 1.5px solid #C8860A;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.2rem; flex-shrink: 0;
    background: rgba(200,134,10,.06);
}
.menu-item-title {
    font-family: 'Playfair Display', serif;
    font-size: 1.15rem; font-weight: 700;
    color: #3B1F0E; margin: 0 0 2px; line-height: 1.2;
}
.menu-item-sub {
    font-size: .68rem; color: #9E6B3A;
    letter-spacing: .10em; text-transform: uppercase;
    font-family: 'Lato', sans-serif;
}
.menu-item-desc {
    font-size: .83rem; color: #6B4A2A;
    line-height: 1.65; margin: 0;
}
.menu-dotline {
    border: none;
    border-top: 1px dashed rgba(200,134,10,.35);
    margin: 14px 0;
}
.menu-item-tags {
    display: flex; gap: 6px; flex-wrap: wrap;
}
.mtag {
    background: rgba(59,31,14,.06);
    border: 1px solid rgba(59,31,14,.15);
    border-radius: 3px; padding: 2px 9px;
    font-size: .62rem; color: #6B4A2A;
    font-family: 'Lato', sans-serif;
    letter-spacing: .06em; text-transform: uppercase;
}

/* ── BOTTOM ORNAMENT ── */
.menu-bottom {
    text-align: center;
    padding: 30px 0 0;
    border-top: 2px solid #3B1F0E;
}
.menu-bottom-script {
    font-family: 'Great Vibes', cursive;
    font-size: 2rem; color: #C8860A; display: block; margin-bottom: 8px;
}
.menu-bottom-line {
    font-family: 'Lato', sans-serif;
    font-size: .68rem; color: #9E6B3A;
    letter-spacing: .18em; text-transform: uppercase;
}
.menu-bottom-ornament {
    font-size: 1rem; color: #C8860A; margin: 12px 0 4px;
    letter-spacing: 6px;
}
</style>
""", unsafe_allow_html=True)

# ============================================================
# TOP BANNER
# ============================================================
st.markdown("""
<div class="menu-wrap">
<div class="top-banner">
  ✦ &nbsp; Boulangerie Artisanale · Le Croisic · Depuis 2022 &nbsp; ✦ &nbsp;
  Retail Intelligence System · PFE 2026 — Mariem Dridi &nbsp; ✦
</div>
""", unsafe_allow_html=True)

# ============================================================
# HEADER
# ============================================================
st.markdown("""
<div class="menu-header">
  <p class="bakery-script">La Boulangerie</p>
  <h1 class="bakery-name">Le Croisic</h1>
  <p class="bakery-location">Loire-Atlantique · Bretagne · France</p>
  <div class="header-divider">
    <div class="hdiv-line"></div>
    <div class="hdiv-ornament">✦ Retail Intelligence ✦</div>
    <div class="hdiv-line"></div>
  </div>
</div>
""", unsafe_allow_html=True)

# ============================================================
# BODY
# ============================================================
st.markdown('<div class="menu-body">', unsafe_allow_html=True)

# ── KPI ROW ──
st.markdown(f"""
<div class="menu-section-title">
  <span class="script">nos chiffres</span>
  <h2>Tableau de Bord</h2>
</div>

<div class="kpi-row">

  <div class="kpi-item">
    <span class="kpi-emoji">💶</span>
    <div class="kpi-lbl">Chiffre d'Affaires</div>
    <div class="kpi-val">{total_ca/1000:.1f}<span class="unit"> k€</span></div>
    <div class="kpi-note">2024 – 2025</div>
  </div>

  <div class="kpi-item">
    <span class="kpi-emoji">🧾</span>
    <div class="kpi-lbl">Tickets clients</div>
    <div class="kpi-val">{nb_tickets:,}</div>
    <div class="kpi-note">transactions enregistrées</div>
  </div>

  <div class="kpi-item">
    <span class="kpi-emoji">🛒</span>
    <div class="kpi-lbl">Panier Moyen</div>
    <div class="kpi-val">{panier_moy:.2f}<span class="unit"> €</span></div>
    <div class="kpi-note">par visite client</div>
  </div>

  <div class="kpi-item">
    <span class="kpi-emoji">📈</span>
    <div class="kpi-lbl">Croissance</div>
    <div class="kpi-val">+{croissance:.1f}<span class="unit">%</span></div>
    <div class="kpi-note">2024 → 2025</div>
    <div class="kpi-tag">▲ En hausse</div>
  </div>

  <div class="kpi-item">
    <span class="kpi-emoji">🍞</span>
    <div class="kpi-lbl">Références</div>
    <div class="kpi-val">{nb_produits}</div>
    <div class="kpi-note">{date_min} → {date_max}</div>
    <div class="kpi-tag kpi-tag-amber">{nb_jours} jours actifs</div>
  </div>

</div>
""", unsafe_allow_html=True)

# ── MODULES GRID ──
st.markdown("""
<div class="menu-section-title">
  <span class="script">notre carte</span>
  <h2>Modules d'Analyse</h2>
</div>

<div class="menu-grid">

  <div class="menu-item">
    <span class="menu-num">§ 2.1</span>
    <div class="menu-item-header">
      <div class="menu-item-icon">📊</div>
      <div>
        <div class="menu-item-title">CA & Activité</div>
        <div class="menu-item-sub">Chiffre d'affaires & Performance</div>
      </div>
    </div>
    <hr class="menu-dotline">
    <p class="menu-item-desc">
      Évolution du chiffre d'affaires par catégorie, analyse du panier moyen,
      tendances temporelles et comparaison des périodes.
    </p>
    <div class="menu-item-tags">
      <span class="mtag">CA mensuel</span>
      <span class="mtag">Catégories</span>
      <span class="mtag">Panier moyen</span>
    </div>
  </div>

  <div class="menu-item">
    <span class="menu-num">§ 2.2</span>
    <div class="menu-item-header">
      <div class="menu-item-icon">🎯</div>
      <div>
        <div class="menu-item-title">Taux de Pénétration</div>
        <div class="menu-item-sub">Présence & Popularité Produit</div>
      </div>
    </div>
    <hr class="menu-dotline">
    <p class="menu-item-desc">
      Part des clients achetant chaque produit sur la période analysée.
      Segmentation stratégique du catalogue.
    </p>
    <div class="menu-item-tags">
      <span class="mtag">Penetration %</span>
      <span class="mtag">Segmentation</span>
      <span class="mtag">Popularité</span>
    </div>
  </div>

  <div class="menu-item">
    <span class="menu-num">§ 2.3</span>
    <div class="menu-item-header">
      <div class="menu-item-icon">🧾</div>
      <div>
        <div class="menu-item-title">Ticket Contribution</div>
        <div class="menu-item-sub">Poids Financier dans le Panier</div>
      </div>
    </div>
    <hr class="menu-dotline">
    <p class="menu-item-desc">
      Contribution médiane de chaque produit au ticket client.
      Classification Ancre, Moteur, Complémentaire, Micro.
    </p>
    <div class="menu-item-tags">
      <span class="mtag">Contribution %</span>
      <span class="mtag">Produit Ancre</span>
      <span class="mtag">Moteur du panier</span>
    </div>
  </div>

  <div class="menu-item">
    <span class="menu-num">§ 2.4</span>
    <div class="menu-item-header">
      <div class="menu-item-icon">🔁</div>
      <div>
        <div class="menu-item-title">Repurchase Frequency</div>
        <div class="menu-item-sub">Loyauté & Fidélité Produit</div>
      </div>
    </div>
    <hr class="menu-dotline">
    <p class="menu-item-desc">
      Fréquence de rachat hebdomadaire par produit. Identification des
      piliers quotidiens, réguliers, cycliques et sporadiques.
    </p>
    <div class="menu-item-tags">
      <span class="mtag">Fréquence %</span>
      <span class="mtag">Quotidien</span>
      <span class="mtag">Saisonnalité</span>
    </div>
  </div>

  <div class="menu-item">
    <span class="menu-num">§ 2.5</span>
    <div class="menu-item-header">
      <div class="menu-item-icon">🛒</div>
      <div>
        <div class="menu-item-title">Market Basket Analysis</div>
        <div class="menu-item-sub">Associations & Complémentarités</div>
      </div>
    </div>
    <hr class="menu-dotline">
    <p class="menu-item-desc">
      Règles d'association entre produits via l'algorithme Apriori.
      Lift, Confiance et Support pour optimiser le merchandising.
    </p>
    <div class="menu-item-tags">
      <span class="mtag">Apriori</span>
      <span class="mtag">Lift</span>
      <span class="mtag">Cross-selling</span>
    </div>
  </div>

  <div class="menu-item">
    <span class="menu-num">§ 2.6</span>
    <div class="menu-item-header">
      <div class="menu-item-icon">⚡</div>
      <div>
        <div class="menu-item-title">Sales Velocity</div>
        <div class="menu-item-sub">Vitesse de Rotation Stock</div>
      </div>
    </div>
    <hr class="menu-dotline">
    <p class="menu-item-desc">
      Vitesse de vente journalière par produit. Calcul du stock optimal,
      détection des ruptures et sur-stocks potentiels.
    </p>
    <div class="menu-item-tags">
      <span class="mtag">Velocity</span>
      <span class="mtag">Stock optimal</span>
      <span class="mtag">Rotation</span>
    </div>
  </div>

  <div class="menu-item">
    <span class="menu-num">§ 3</span>
    <div class="menu-item-header">
      <div class="menu-item-icon">🔮</div>
      <div>
        <div class="menu-item-title">Demand Forecasting</div>
        <div class="menu-item-sub">Prévision de la Demande</div>
      </div>
    </div>
    <hr class="menu-dotline">
    <p class="menu-item-desc">
      Prévision 14 jours avec le modèle Prophet. MDAPE cross-validation,
      saisonnalité estivale, 98 événements calendaires intégrés.
    </p>
    <div class="menu-item-tags">
      <span class="mtag">Prophet</span>
      <span class="mtag">14 jours</span>
      <span class="mtag">Saisonnalité</span>
    </div>
  </div>

  <div class="menu-item">
    <span class="menu-num">§ 4</span>
    <div class="menu-item-header">
      <div class="menu-item-icon">🧠</div>
      <div>
        <div class="menu-item-title">Matrice de Décision</div>
        <div class="menu-item-sub">Classification Stratégique</div>
      </div>
    </div>
    <hr class="menu-dotline">
    <p class="menu-item-desc">
      Classification Stars, Niche, Trafic et Stock dormant.
      Recommandations opérationnelles pour chaque produit du catalogue.
    </p>
    <div class="menu-item-tags">
      <span class="mtag">Stars</span>
      <span class="mtag">Niche</span>
      <span class="mtag">Stock dormant</span>
    </div>
  </div>

</div>
""", unsafe_allow_html=True)

# ── FOOTER ──
st.markdown(f"""
<div class="menu-bottom">
  <div class="menu-bottom-ornament">✦ ✦ ✦</div>
  <span class="menu-bottom-script">Merci de votre visite</span>
  <div class="menu-bottom-line">
    Boulangerie Artisanale Le Croisic &nbsp;·&nbsp;
    Données {date_min} → {date_max} &nbsp;·&nbsp;
    Mariem Dridi · PFE 2026 &nbsp;·&nbsp;
    Streamlit · Prophet · Apriori
  </div>
</div>

</div>
</div>
""", unsafe_allow_html=True)