from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import logging
from typing import Optional, List
from datetime import date

from db.db import is_pg_available, sql_value
from engines.data_engine import calculate_daily_kpis_pg
from engines.commercial_engine import calculate_commercial_performance_pg
from engines.products_engine import (
    get_penetration_data_pg,
    get_sales_velocity_data_pg,
    get_ticket_contribution_data_pg,
    get_repurchase_frequency_data_pg,
    get_associations_data_pg
)
from engines.forecast_engine import get_forecast_data_pg
from engines.alerts_engine import get_alerts_data_pg

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


@app.get("/api/daily-kpis")
def get_daily_kpis():
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
