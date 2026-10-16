from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import logging
from typing import Optional, List
from datetime import date

from db import is_pg_available, sql_fetch_one, sql_fetch_all
from db_data_engine import calculate_daily_kpis_pg
from db_commercial_engine import calculate_commercial_performance_pg
from db_products_engine import (
    get_penetration_data_pg,
    get_sales_velocity_data_pg,
    get_ticket_contribution_data_pg,
    get_repurchase_frequency_data_pg,
    get_associations_data_pg,
    get_decision_matrix_data_pg
)
from db_forecast_engine import get_forecast_data_pg
from db_alerts_engine import get_alerts_data_pg
from db_product_forecast_engine import get_product_forecast_list, get_product_forecast_detail, get_product_alerts

logger = logging.getLogger("main")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

if not is_pg_available():
    raise RuntimeError("PostgreSQL connection FAILED. Le backend est configure en mode PG ONLY.")

logger.info("Mode POSTGRESQL ONLY active. Tous les moteurs PG sont verifies disponibles au demarrage.")

app = FastAPI(title="Le Croisic - Retail Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/data-period")
def data_period():
    """Période réellement couverte par les ventes (affichée dans l'en-tête et les filtres d'année)."""
    r = sql_fetch_one("SELECT MIN(date_id) AS d1, MAX(date_id) AS d2 FROM fact_ticket_lines") or {}
    years = [int(x['y']) for x in sql_fetch_all(
        "SELECT DISTINCT EXTRACT(YEAR FROM date_id) AS y FROM fact_ticket_lines ORDER BY y")]
    d1, d2 = r.get('d1'), r.get('d2')
    return {
        "date_debut": d1.isoformat() if d1 else None,
        "date_fin": d2.isoformat() if d2 else None,
        "date_debut_fr": d1.strftime('%d/%m/%Y') if d1 else None,
        "date_fin_fr": d2.strftime('%d/%m/%Y') if d2 else None,
        "annees": years,
    }

@app.get("/api/forecast/products")
def forecast_products():
    """Prévision par produit (liste) : dernier lancement de forecasting/pipeline.py."""
    return get_product_forecast_list()


@app.get("/api/forecast/products/{product_id}")
def forecast_product_detail(product_id: int):
    return get_product_forecast_detail(product_id)


@app.get("/api/alerts/products")
def alerts_products(days: int = 14):
    return get_product_alerts(days)


@app.get("/api/daily-kpis")
def get_daily_kpis():
    from db import sql_value
    last_date_raw = sql_value("SELECT MAX(date_id) FROM daily_aggregates")
    if not last_date_raw:
        return {"error": "Aucune donnee disponible dans daily_aggregates"}
    if isinstance(last_date_raw, date):
        last_date = last_date_raw
    else:
        last_date = date.fromisoformat(str(last_date_raw))
    return calculate_daily_kpis_pg(last_date)


@app.get("/api/performance")
def get_performance(
    annee: str = "Toutes",
    saison: str = "Toutes",
    mois: str = "Tous",
    categorie: str = "Toutes",
    evenement: str = "Tous"
):
    return calculate_commercial_performance_pg(annee, saison, mois, categorie, evenement)


@app.get("/api/products/associations")
def get_associations(
    sort_by: str = "Lift ↓",
    top_n: int = 20
):
    return get_associations_data_pg(sort_by, top_n)


@app.get("/api/products/matrix")
def get_matrix(year: str = "Toutes"):
    return get_decision_matrix_data_pg(year)


@app.get("/api/products/velocity")
def get_velocity():
    return get_sales_velocity_data_pg()


@app.get("/api/products/penetration")
def get_penetration(
    search: str = "",
    categories: Optional[List[str]] = Query(None),
    statuts: Optional[List[str]] = Query(None),
    year: str = "Toutes"
):
    return get_penetration_data_pg(search, categories, statuts, year)


@app.get("/api/products/contribution")
@app.get("/api/products/ticket-contribution")
def get_contribution():
    return get_ticket_contribution_data_pg()


@app.get("/api/products/frequency")
def get_frequency():
    return get_repurchase_frequency_data_pg()


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
    return get_forecast_data_pg(
        horizon, forecast_type, product, category, season, event, history_period
    )


@app.get("/api/alerts")
def get_alerts(mois: str = "Tout"):
    return get_alerts_data_pg(mois)
