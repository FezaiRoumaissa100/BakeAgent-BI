# Backend API

FastAPI backend , providing REST API endpoints for bakery analytics and database access.

## Overview

The backend serves as the data layer and calculation engine for the retail intelligence system. It provides:
- REST API endpoints for frontend integration
- Database connection management (PostgreSQL)
- Calculation engines for KPIs, forecasts, and analytics
- RAG (Retrieval-Augmented Generation) system for knowledge base

## Architecture

```
backend/
├── db/
│   ├── __init__.py
│   └── db.py                    # PostgreSQL connection and queries
├── engines/
│   ├── __init__.py
│   ├── data_engine.py            # Daily KPIs calculations
│   ├── commercial_engine.py      # Commercial performance
│   ├── products_engine.py        # Product analysis
│   ├── forecast_engine.py        # Demand forecasts (Prophet)
│   ├── alerts_engine.py          # Stock alerts
│   └── product_forecast_engine.py # Per-product forecasts
├── rag/
│   ├── __init__.py
│   ├── rag_engine.py             # RAG semantic search
│   ├── ingest_rag_chunks.py      # Ingest knowledge chunks
│   └── init_rag_db.py            # Initialize RAG tables
├── config.py                     # Configuration settings
└── main.py                       # FastAPI application entry point
```

## Tech Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL
- **ORM**: None (direct SQL queries)
- **Calculations**: Python (pandas, numpy, scipy)
- **Forecasting**: Prophet (Facebook)
- **RAG**: Custom implementation with Gemini embeddings

## Quick Start

### Prerequisites

1. PostgreSQL database running with retail data
2. Python 3.8+ with dependencies installed
3. Database connection configured in environment variables

### Environment Setup

Set the following environment variables:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASS=your_password
```

### Starting the Backend

```bash
cd backend
python main.py
```

The backend server will start on `http://127.0.0.1:8000`

### API Documentation

Once running, access:
- **Swagger UI**: http://127.0.0.1:8000/docs
- **ReDoc**: http://127.0.0.1:8000/redoc

## API Endpoints

### Daily KPIs
- `GET /api/daily-kpis` - Daily KPIs for a specific date
- Parameters: `date` (YYYY-MM-DD)

### Performance
- `GET /api/performance` - Commercial performance data
- Parameters: `year`, `season`, `month`, `category` (optional)

### Products
- `GET /api/products/penetration` - Product penetration rates
- `GET /api/products/velocity` - Sales velocity data
- `GET /api/products/contribution` - Product contribution to basket
- `GET /api/products/repurchase` - Repurchase frequency
- `GET /api/products/associations` - Product association rules

### Forecasts
- `GET /api/forecast` - Demand forecasts
### Alerts
- `GET /api/alerts` - Stock alerts based on forecasts

## Database Structure

### Key Tables

- `fact_ticket_lines` - Transaction lines (product, quantity, revenue)
- `daily_aggregates` - Daily aggregated metrics
- `dim_products` - Product dimensions
- `dim_categories` - Product categories
- `dim_dates` - Date dimensions (day of week, season, etc.)
- `dim_events` - Events (holidays, promotions)
- `rag_knowledge` - RAG knowledge chunks with embeddings

## Engines

### Data Engine (`data_engine.py`)
Calculates daily KPIs:
- Revenue, tickets, basket size
- Top products by revenue
- Hourly sales distribution
- Sales velocity metrics

### Commercial Engine (`commercial_engine.py`)
Calculates commercial performance:
- Revenue trends over time
- Category performance
- Seasonal analysis
- Month-over-month growth

### Products Engine (`products_engine.py`)
Analyzes product data:
- Penetration rates
- Sales velocity
- Basket contribution (BCG analysis)
- Repurchase frequency
- Product associations (Apriori algorithm)

### Forecast Engine (`forecast_engine.py`)
Generates demand forecasts:
- Prophet model for time series forecasting
- Confidence intervals
- Historical accuracy metrics

### Alerts Engine (`alerts_engine.py`)
Generates stock alerts:
- Compares forecasts to current stock
- Alerts for stockouts and overstock
- Priority-based classification

### Product Forecast Engine (`product_forecast_engine.py`)
Per-product forecasting:
- Individual product demand forecasts
- Risk assessment for stockouts
- Product-specific parameters

## RAG System

### Overview

The RAG (Retrieval-Augmented Generation) system stores knowledge chunks with embeddings for semantic search.

### Initialization

```bash
cd backend
python rag/init_rag_db.py
```

This creates the `rag_knowledge` table in PostgreSQL.

### Ingesting Knowledge

```bash
cd backend
python rag/ingest_rag_chunks.py
```

This reads knowledge chunks from a JSON file and:
- Generates embeddings using Gemini API
- Stores chunks and embeddings in PostgreSQL

### Usage

The RAG engine provides:
- Semantic search across knowledge base
- Theme-based retrieval
- Similarity matching for questions

See `agent/tools/rag_tools.py` for agent integration.

## Development Guidelines

### Adding a New Engine

1. Create a new file in `engines/` directory
2. Add the calculation function
3. Add database queries in `db/db.py` if needed
4. Add API endpoint in `main.py`
5. Test the endpoint via Swagger UI

### Example: Adding a New Endpoint

```python
# In main.py
@app.get("/api/my-new-endpoint")
async def my_new_endpoint(param: str):
    result = engines.my_engine.calculate(param)
    return result
```

### Database Queries

All database queries are in `db/db.py`:

```python
def sql_fetch_all(query: str, params: tuple = ()):
    """Execute a SELECT query and return all rows."""
    # ... implementation
```

### Error Handling

The backend uses FastAPI's exception handling:
- Returns HTTP 400 for invalid parameters
- Returns HTTP 500 for database errors
- Logs all errors for debugging

## Testing

### Manual Testing

Use Swagger UI at http://127.0.0.1:8000/docs to test endpoints.

### Automated Testing

Test scripts can be added to a `tests/` directory:

```python
# tests/test_backend.py
import requests

def test_daily_kpis():
    response = requests.get("http://127.0.0.1:8000/api/daily-kpis?date=2025-10-02")
    assert response.status_code == 200
    assert "ca_jour" in response.json()
```

## Deployment

### Production

1. Set production environment variables
2. Use PostgreSQL with SSL
3. Enable CORS for production domains
4. Use Gunicorn or Uvicorn with workers:
   ```bash
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
   ```
5. Set up database backups
6. Monitor logs and performance

### Docker (Optional)

Create a `Dockerfile`:
```dockerfile
FROM python:3.11
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Troubleshooting

### Database Connection Failed

**Causes**:
- PostgreSQL not running
- Wrong credentials
- Database doesn't exist

**Solutions**:
1. Check PostgreSQL is running
2. Verify DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
3. Test connection with `psql` command

### Forecast Errors

**Causes**:
- Insufficient historical data
- Prophet library not installed
- Data format issues

**Solutions**:
1. Ensure at least 30 days of historical data
2. Install Prophet: `pip install prophet`
3. Check data format matches expected schema

### RAG Search Returns No Results

**Causes**:
- Knowledge base not ingested
- Embeddings not generated
- Query too specific

**Solutions**:
1. Run `python rag/ingest_rag_chunks.py`
2. Check GEMINI_API_KEY is set
3. Try broader search terms

## Contributing

When contributing to the backend:

1. Follow Python coding conventions (PEP 8)
2. Add docstrings to all functions
3. Add error handling for database operations
4. Test endpoints via Swagger UI
5. Update this README if adding new features

## Configuration

Configuration settings are in `config.py`:

```python
# Database settings
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "retail_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "password")

# API settings
API_PREFIX = "/api"
CORS_ORIGINS = ["http://localhost:3000"]
```

## Contact

For questions or issues, please refer to the main project repository.
