from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import pickle
import pandas as pd
from pathlib import Path
from typing import Optional, List

from data_engine import calculate_daily_kpis
from commercial_engine import calculate_commercial_performance
from products_engine import (
    get_penetration_data,
    get_sales_velocity_data,
    get_ticket_contribution_data,
    get_repurchase_frequency_data,
    get_associations_data
)
from forecast_engine import get_forecast_data
from alerts_engine import get_alerts_data

app = FastAPI(title="Le Croisic - Retail Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load all data objects once at startup ──
def load_data():
    base_dir = Path(__file__).resolve().parent.parent
    paths = [
        base_dir / "retail_data.pkl",
        base_dir / "existing_bi" / "boulangerie-performance--main" / "retail_data.pkl"
    ]
    for p in paths:
        if p.exists():
            with open(p, "rb") as f:
                d = pickle.load(f)
            if isinstance(d, dict) and "df_clean" in d:
                return d
    return None

data_store = load_data()
df_clean = None
ca_mensuel = None
df_penetration = None
df_macro = None
regles = None
forecast_14j = None
forecast_saison = None
daily_data = None
mdape_cv = 20.9

if data_store is not None:
    df_clean = data_store.get("df_clean")
    ca_mensuel = data_store.get("ca_mensuel")
    df_penetration = data_store.get("df_penetration")
    df_macro = data_store.get("df_macro")
    regles = data_store.get("regles")
    forecast_14j = data_store.get("forecast_14j")
    forecast_saison = data_store.get("forecast_saison")
    daily_data = data_store.get("daily_data")
    mdape_cv = data_store.get("mdape_cv", 20.9)

    # Standardize df_clean
    if df_clean is not None:
        df_clean["date"] = pd.to_datetime(df_clean["date"], errors="coerce")
        df_clean = df_clean.dropna(subset=["date"])
        df_clean["day"] = df_clean["date"].dt.date
        for col in ["quantity", "total_revenue", "hour"]:
            if col not in df_clean.columns:
                df_clean[col] = 0.0
            df_clean[col] = pd.to_numeric(df_clean[col], errors="coerce").fillna(0)
        df_clean["hour"] = df_clean["hour"].astype(int).clip(0, 23)
        if "article" not in df_clean.columns:
            df_clean["article"] = "Produit"
        if "category" not in df_clean.columns:
            df_clean["category"] = "Autre"
        if "ticket_number" not in df_clean.columns:
            df_clean["ticket_number"] = df_clean.index.astype(str)
        df_clean["article"] = df_clean["article"].fillna("Produit").astype(str)
        df_clean["category"] = df_clean["category"].fillna("Autre").astype(str)


# ── 1. Vue du Jour ──
@app.get("/api/daily-kpis")
def get_daily_kpis():
    if df_clean is None:
        return {"error": "Data not found"}
    available_days = sorted(df_clean["day"].dropna().unique())
    if not available_days:
        return {"error": "No data"}
    selected_day = available_days[-1]
    sel_ts = pd.Timestamp(selected_day)
    return calculate_daily_kpis(df_clean, sel_ts)


# ── 2. Performance Générale ──
@app.get("/api/performance")
def get_performance(
    annee: str = "2024 + 2025",
    saison: str = "Toutes",
    mois: str = "Tous",
    categorie: str = "Toutes",
    evenement: str = "Tous"
):
    if df_clean is None:
        return {"error": "Data not found"}
    return calculate_commercial_performance(
        df_clean, ca_mensuel, annee, saison, mois, categorie, evenement
    )


# ── 3. Produits ──
@app.get("/api/products/penetration")
def get_penetration(
    search: str = "",
    categories: Optional[List[str]] = Query(None),
    statuts: Optional[List[str]] = Query(None),
    year: str = "Toutes"
):
    if df_clean is None or df_penetration is None:
        return {"error": "Data not found"}
    return get_penetration_data(df_clean, df_penetration, search, categories, statuts, year)

@app.get("/api/products/velocity")
def get_velocity():
    if df_clean is None or df_macro is None:
        return {"error": "Data not found"}
    return get_sales_velocity_data(df_clean, df_macro)

@app.get("/api/products/ticket-contribution")
def get_ticket_contribution():
    if df_clean is None:
        return {"error": "Data not found"}
    return get_ticket_contribution_data(df_clean)

@app.get("/api/products/frequency")
def get_frequency():
    if df_clean is None:
        return {"error": "Data not found"}
    return get_repurchase_frequency_data(df_clean)

@app.get("/api/products/associations")
def get_associations(
    sort_by: str = "Lift ↓",
    top_n: int = 20
):
    if regles is None:
        return {"error": "Data not found"}
    return get_associations_data(regles, sort_by, top_n)


# ── 4. Prévisions ──
@app.get("/api/forecast")
def get_forecast(
    horizon: int = 14,
    forecast_type: str = "articles",
    product: Optional[str] = None,
    category: Optional[str] = None,
    season: Optional[str] = None,
    event: Optional[str] = None,
    history_period: str = "all"
):
    if daily_data is None or forecast_14j is None:
        return {"error": "Data not found"}
    return get_forecast_data(
        daily_data, forecast_14j, forecast_saison, mdape_cv,
        horizon, forecast_type, product, category, season, event, history_period,
        df_clean  # ← DONNÉES TICKETS STANDARDISÉES (colonnes article, category, season, event garanties)
    )


# ── 5. Alertes Stock ──
@app.get("/api/alerts")
def get_alerts(mois: str = "Tout"):
    if df_clean is None or forecast_saison is None:
        return {"error": "Data not found"}
    return get_alerts_data(df_clean, forecast_saison, mois)
