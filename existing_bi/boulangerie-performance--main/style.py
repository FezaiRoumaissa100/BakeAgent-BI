import streamlit as st

def inject_bakery_style():
    st.markdown("""
    <style>
    /* ── Fond principal ── */
    .stApp {
        background-color: #FDF6EC;
        background-image:
            radial-gradient(circle at 15% 20%, rgba(210,140,60,0.08) 0%, transparent 45%),
            radial-gradient(circle at 85% 75%, rgba(139,58,15,0.07) 0%, transparent 45%);
    }

    /* ── Sidebar ── */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #3B1F0A 0%, #6B3012 60%, #8B4513 100%);
        border-right: 3px solid #C8860A;
    }
    [data-testid="stSidebar"] * {
        color: #F5E6C8 !important;
    }
    [data-testid="stSidebar"] .stSelectbox label,
    [data-testid="stSidebar"] .stMultiSelect label,
    [data-testid="stSidebar"] .stCheckbox label {
        color: #F5D49A !important;
        font-weight: 600;
        font-size: 0.85rem;
        letter-spacing: 0.03em;
    }
    /* Selectbox dans sidebar */
    [data-testid="stSidebar"] .stSelectbox > div > div,
    [data-testid="stSidebar"] .stMultiSelect > div > div {
        background-color: rgba(245, 230, 200, 0.15) !important;
        border: 1px solid rgba(200, 134, 10, 0.5) !important;
        border-radius: 8px !important;
        color: #F5E6C8 !important;
    }
    /* Logo / Titre sidebar */
    [data-testid="stSidebar"] h1,
    [data-testid="stSidebar"] h2,
    [data-testid="stSidebar"] h3 {
        color: #F5D49A !important;
    }

    /* ── Titre de page principal ── */
    h1 {
        color: #5C1F00 !important;
        font-size: 2rem !important;
        font-weight: 800 !important;
        letter-spacing: -0.02em;
        border-bottom: 3px solid #C8860A;
        padding-bottom: 0.4rem;
        margin-bottom: 1.2rem;
    }
    h2, h3 {
        color: #7A3010 !important;
        font-weight: 700 !important;
    }

    /* ── Cartes KPI ── */
    div[data-testid="metric-container"] {
        background: linear-gradient(135deg, #FFFAF2 0%, #FFF0D4 100%);
        border: 1.5px solid #D4A056;
        border-radius: 16px;
        padding: 18px 20px !important;
        box-shadow: 0 4px 16px rgba(139,58,15,0.10),
                    0 1px 3px rgba(139,58,15,0.08);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    div[data-testid="metric-container"]:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 24px rgba(139,58,15,0.18);
    }
    div[data-testid="metric-container"] [data-testid="stMetricLabel"] {
        color: #8B5E3C !important;
        font-size: 0.78rem !important;
        font-weight: 700 !important;
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }
    div[data-testid="metric-container"] [data-testid="stMetricValue"] {
        color: #5C1F00 !important;
        font-size: 1.8rem !important;
        font-weight: 800 !important;
    }
    div[data-testid="metric-container"] [data-testid="stMetricDelta"] {
        font-size: 0.8rem !important;
    }

    /* ── Sections (st.container) ── */
    div[data-testid="stVerticalBlock"] > div[data-testid="stVerticalBlockBorderWrapper"] {
        background: #FFFAF4;
        border: 1px solid #E8C97A;
        border-radius: 16px;
        padding: 1.2rem;
        box-shadow: 0 2px 12px rgba(139,58,15,0.06);
        margin-bottom: 1rem;
    }

    /* ── En-têtes de section ── */
    .section-header {
        display: flex;
        align-items: center;
        gap: 10px;
        background: linear-gradient(90deg, #8B3A0F 0%, #C8860A 100%);
        color: white !important;
        padding: 10px 20px;
        border-radius: 12px;
        font-size: 1.05rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        margin-bottom: 1rem;
        box-shadow: 0 3px 10px rgba(139,58,15,0.25);
    }

    /* ── Séparateurs ── */
    hr {
        border: none;
        border-top: 2px dashed #D4A056;
        margin: 1.5rem 0;
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #FDF6EC; }
    ::-webkit-scrollbar-thumb { background: #C8860A; border-radius: 3px; }

    /* ── Boutons ── */
    .stButton > button {
        background: linear-gradient(135deg, #8B3A0F, #C8860A) !important;
        color: white !important;
        border: none !important;
        border-radius: 10px !important;
        font-weight: 700 !important;
        padding: 0.5rem 1.5rem !important;
        box-shadow: 0 3px 10px rgba(139,58,15,0.3) !important;
        transition: all 0.2s ease !important;
    }
    .stButton > button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 16px rgba(139,58,15,0.4) !important;
    }

    /* ── Tabs ── */
    .stTabs [data-baseweb="tab-list"] {
        background: #F5E6C8;
        border-radius: 12px;
        padding: 4px;
        gap: 4px;
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 8px !important;
        color: #7A3010 !important;
        font-weight: 600 !important;
    }
    .stTabs [aria-selected="true"] {
        background: linear-gradient(135deg, #8B3A0F, #C8860A) !important;
        color: white !important;
    }

    /* ── Footer ── */
    footer { visibility: hidden; }
    </style>
    """, unsafe_allow_html=True)


def section_header(icon: str, title: str):
    """Affiche un en-tête de section stylisé."""
    st.markdown(f"""
    <div class="section-header">
        <span style="font-size:1.3rem">{icon}</span>
        <span>{title}</span>
    </div>
    """, unsafe_allow_html=True)


def bakery_sidebar_logo():
    """Affiche le logo/titre dans la sidebar."""
    st.sidebar.markdown("""
    <div style="text-align:center; padding: 1rem 0 1.5rem 0; border-bottom: 2px solid rgba(200,134,10,0.4); margin-bottom:1rem;">
        <div style="font-size: 3rem; margin-bottom:0.3rem;">🥐</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: #F5D49A; letter-spacing:0.05em;">
            LA BOULANGERIE
        </div>
        <div style="font-size: 0.75rem; color: rgba(245,214,154,0.7); margin-top:0.2rem; letter-spacing:0.1em;">
            TABLEAU DE BORD
        </div>
    </div>
    """, unsafe_allow_html=True)
