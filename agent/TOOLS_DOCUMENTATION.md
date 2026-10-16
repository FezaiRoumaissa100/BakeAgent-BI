# Tools Documentation - Retail Intelligence Agent

This document describes all available tools for the Retail Intelligence AI agent.

---

## Table of Contents

1. [Daily Tools](#daily-tools)
2. [Performance Tools](#performance-tools)
3. [Product Tools](#product-tools)
4. [Forecast Tools](#forecast-tools)
5. [Alert Tools](#alert-tools)

---

## Daily Tools

### `get_daily_kpis`

Retrieves daily KPIs for a specific date.

**Description:**
This function returns all key metrics for a day: revenue, number of tickets, average basket, sales velocity, top products, top combinations, hourly data, categories, etc.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `target_date` | str (optional) | None | Target date in 'YYYY-MM-DD' format. If None, uses today's date. |

**Return:**

```python
dict: {
    "ca_jour": float,              # Daily revenue in EUR
    "tickets": int,                # Number of ticket transactions
    "panier": float,               # Average basket in EUR
    "qte_jour": int,               # Total quantity of items sold
    "hourly_data": list,           # List of hourly data
    "heures_act": int,             # Number of hours with sales
    "vitesse": float,              # Sales velocity (items/hour)
    "peak_h": int,                 # Peak hour
    "peak_qte_h": float,           # Quantity sold at peak hour
    "ca_moy_global": float,        # Global average revenue
    "delta_vs_moy": float,         # Difference in % vs average
    "top_qte": list,               # Top products by quantity
    "top_ca": list,                # Top products by revenue
    "top_tkt": list,               # Top products by ticket count
    "categories": list,            # List of categories with their revenue
    "top_pairs": list,             # Top product combinations
    "nb_multi": int,               # Number of multi-product tickets
    "nb_mono": int,                # Number of single-product tickets
    "pct_m": float,                # Percentage of multi-product tickets
    "alerts_count": int,           # Number of alerts
    "date_str": str,               # Formatted date
    "jour_str": str,               # Day of the week
    "total_lignes": int            # Total number of lines
}
```

**`hourly_data` structure:**
```python
[
    {
        "hour": int,           # Hour of the day (0-23)
        "ca": float,           # Revenue for this hour
        "tkt": int,            # Number of tickets this hour
        "qte": float,          # Quantity sold this hour
        "panier_h": float,     # Average basket this hour
        "heure": str,          # Formatted hour "HHh"
        "ca_cum": float        # Cumulative revenue up to this hour
    }
]
```

**`top_qte`, `top_ca`, `top_tkt` structure:**
```python
[
    {
        "article": str,        # Product name
        "quantity": float,     # Quantity sold (for top_qte)
        "total_revenue": float, # Total revenue (for top_ca)
        "nb_tkt": int          # Number of tickets (for top_tkt)
    }
]
```

**`categories` structure:**
```python
[
    {
        "category": str,         # Category name
        "total_revenue": float   # Category revenue
    }
]
```

**`top_pairs` structure:**
```python
[
    {
        "pa": str,    # First product in the pair
        "pb": str,    # Second product in the pair
        "cnt": int    # Number of occurrences of this combination
    }
]
```

**Usage example:**
```python
>>> get_daily_kpis("2025-10-02")
{
    "ca_jour": 18139.71,
    "tickets": 508,
    "panier": 35.71,
    "top_qte": [
        {"article": "BUCHE 6PERS", "quantity": 215.0},
        {"article": "BUCHE 4PERS", "quantity": 115.0}
    ],
    "top_pairs": [
        {"pa": "12 MACARON", "pb": "BUCHE 6PERS", "cnt": 33}
    ]
}
```

---

## Performance Tools

### `get_commercial_performance`

Retrieves commercial performance data with filters.

**Description:**
This function analyzes global revenue performance over a period defined by filters. It returns KPIs, monthly evolution, top products, seasonality, and category data.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `annee` | str | "Toutes" | Year filter. Options: "Toutes" or specific year (ex: "2024", "2025", "2026"). Available years are automatically detected from the database. |
| `saison` | str | "Toutes" | Season filter. Options: "Toutes", "Printemps", "Ete", "Automne", "Hiver" |
| `mois` | str | "Tous" | Month filter. Options: "Tous", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre" |
| `categorie` | str | "Toutes" | Category filter. Options: "Toutes" or specific name (ex: "Patisseries", "Pains") |
| `evenement` | str | "Tous" | Event filter. Options: "Tous" or specific name (ex: "Fêtes", "Vacances") |

**Return:**

```python
dict: {
    "kpis": {
        "total_ca": float,      # Total revenue
        "nb_tickets": int,      # Total number of tickets
        "panier": float,        # Average basket
        "nb_jours": int,        # Number of active days
        "nb_produits": int      # Number of products sold
    },
    "monthly": {
        "series": list,         # Monthly time series
        "moyenne": float,       # Monthly average revenue
        "ecart_type": float,    # Revenue standard deviation
        "ca_max": dict,         # Maximum revenue with date_str and val
        "ca_min": dict,         # Minimum revenue with date_str and val
        "amplitude": float,     # Amplitude (max - min)
        "ratio_amp": float,     # Ratio max/min
        "comp_24_25": list      # 2024 vs 2025 comparison by month
    },
    "top_products": {
        "by_ca": list,          # Top by revenue
        "by_qte": list,         # Top by quantity
        "by_tkt": list          # Top by tickets
    },
    "seasonality": {
        "days": list,           # By day of week
        "hourly": list          # By hour
    },
    "categories": list,         # List of categories
    "available_filters": dict   # Available filters
}
```

**`monthly.series` structure:**
```python
[
    {
        "date": str,    # Formatted date
        "label": str,   # Month label (ex: "Oct 2025")
        "ca": float     # Monthly revenue
    }
]
```

**`top_products.by_ca` structure:**
```python
[
    {
        "article": str,         # Product name
        "total_revenue": float, # Total revenue
        "part": float,          # Share in % of total revenue
        "cumul": float          # Cumulative share
    }
]
```

**`seasonality.days` structure:**
```python
[
    {
        "day": str,         # Day name (Lundi, Mardi, etc.)
        "ca_total": float,  # Total revenue this day
        "ca_moyen": float   # Average revenue this day
    }
]
```

**`categories` structure:**
```python
[
    {
        "category": str,         # Category name
        "ca": float,              # Category revenue
        "part": float,            # Share in % of total revenue
        "panier": float,          # Category average basket
        "tickets": int,           # Category tickets
        "produits": int           # Number of products in category
    }
]
```

**Usage example:**
```python
>>> get_commercial_performance(annee="2025", categorie="Patisseries")
{
    "kpis": {
        "total_ca": 5252.01,
        "nb_tickets": 156,
        "panier": 33.67
    },
    "top_products": {
        "by_ca": [
            {"article": "BUCHE 6PERS", "total_revenue": 1548.61, "part": 29.5}
        ]
    },
    "categories": [
        {"category": "Patisseries", "ca": 5252.01, "part": 100.0}
    ]
}
```

---

## Product Tools

### `get_penetration_data`

Retrieves product penetration data.

**Description:**
Penetration indicates in what percentage of tickets a product appears. It's a key indicator of a product's popularity.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | str | "" | Text search on product name (partial search). Ex: "BAGUETTE", "BUCHE" |
| `categories` | list (optional) | None | List of categories to filter. If None or contains "Toutes", no filter |
| `statuts` | list (optional) | None | List of strategic statuses to filter |
| `year` | str | "Toutes" | Analysis year. Options: "Toutes", "2024", "2025" |

**Return:**

```python
dict: {
    "kpis": {
        "total_articles": int,    # Total number of articles
        "pen_max": float,         # Maximum penetration rate
        "pen_median": float,      # Median penetration rate
        "status_counts": dict     # Count by strategic status
    },
    "items": list,               # List of products
    "category_summary": list,    # Summary by category
    "weekly_trend": list,         # Weekly trend
    "available_categories": list, # Available categories
    "available_statuts": list,   # Available statuses
    "available_years": list      # Available years
}
```

**`items` structure:**
```python
[
    {
        "article": str,             # Product name
        "category": str,            # Product category
        "penetration_rate": float,  # Penetration rate (0.0 to 1.0)
        "tickets_count": int,       # Number of tickets where product appears
        "ca_total": float,          # Total product revenue
        "qty_total": float,         # Total quantity sold
        "upt": float,               # Units per ticket (quantity / tickets)
        "statut": str              # Strategic status
    }
]
```

**Usage example:**
```python
>>> get_penetration_data(search="BAGUETTE", year="2025")
{
    "items": [
        {
            "article": "TRADITIONAL BAGUETTE",
            "penetration_rate": 0.452,
            "tickets_count": 230,
            "ca_total": 12450.0,
            "statut": "Star"
        }
    ]
}
```

---

### `get_sales_velocity`

Retrieves product sales velocity data.

**Description:**
Sales velocity indicates how many items are sold per day on average. It's crucial for inventory management and restocking.

**Parameters:**
No parameters (global view).

**Return:**

```python
dict: {
    "dow_velocity": list,           # Velocity by day of week
    "macro_items": list,            # List of products with their velocity
    "hourly_distribution": list     # Hourly distribution
}
```

**`dow_velocity` structure:**
```python
[
    {
        "day": str,      # Day name (Lundi, Mardi, etc.)
        "all": float,    # Global velocity
        "touristic": float,  # Touristic period velocity
        "event": float      # Event period velocity
    }
]
```

**`macro_items` structure:**
```python
[
    {
        "article": str,                # Product name
        "daily_velocity": float,       # Average daily velocity
        "velocity_touristic": float,   # Touristic period velocity
        "velocity_event": float,       # Event period velocity
        "stock_securite": float,       # Recommended safety stock
        "ratio_touristic": float,      # Touristic period ratio
        "ratio_event": float,          # Event period ratio
        "peak_hour": int,              # Peak sales hour
        "ratio_pic_percent": float,    # Percentage sold at peak hour
        "alerte_replissage_avant": str # Recommended restocking time
    }
]
```

**Usage example:**
```python
>>> get_sales_velocity()
{
    "macro_items": [
        {
            "article": "TRADITIONAL BAGUETTE",
            "daily_velocity": 245.3,
            "peak_hour": 8,
            "stock_securite": 490.0
        }
    ]
}
```

---

### `get_ticket_contribution`

Retrieves product contribution data to average ticket.

**Description:**
Contribution indicates what percentage of a multi-product ticket's revenue is represented by a given product. Useful to identify "anchor" products that structure the basket.

**Parameters:**
No parameters (global view).

**Return:**

```python
dict: {
    "stats": {
        "nb_produits_analysables": int,  # Number of analyzed products
        "ca_total_multi": float,         # Total revenue of multi-product tickets
        "distribution_par_statut": dict, # Distribution by contribution status
        "nb_multi": int,                # Number of multi-product tickets
        "nb_mono": int,                 # Number of single-product tickets
        "nb_total": int,                # Total number of tickets
        "pct_multi": float              # Percentage of multi-product tickets
    },
    "top20": list,                      # Top 20 products by contribution
    "bcg_quadrants": dict               # BCG quadrants
}
```

**`top20` structure:**
```python
[
    {
        "article": str,                 # Product name
        "contribution_med": float,      # Median contribution to ticket in %
        "contribution_moy": float,      # Average contribution to ticket in %
        "nb_tickets_multi": int,        # Number of multi-product tickets
        "statut_contribution": str,     # Status ("Ancre", "Moteur", "Complement", "Micro")
        "ca_total_multi": float,       # Total revenue in multi-product tickets
        "frequence_multi_pct": float   # Frequency in multi-product tickets in %
    }
]
```

**`bcg_quadrants` structure:**
```python
{
    "etoiles": list,        # Star products (high contribution, high frequency)
    "moteurs": list,        # Driver products (high contribution)
    "opportunites": list,   # Opportunity products (high frequency)
    "a_reevaluer": list     # Products to reevaluate
}
```

**Usage example:**
```python
>>> get_ticket_contribution()
{
    "top20": [
        {
            "article": "BUCHE 6PERS",
            "contribution_med": 68.5,
            "statut_contribution": "Ancre"
        }
    ]
}
```

---

### `get_repurchase_frequency`

Retrieves product repurchase frequency data.

**Description:**
Repurchase frequency indicates how many weeks a product is sold over the total period. It's an indicator of demand regularity.

**Parameters:**
No parameters (global view).

**Return:**

```python
dict: {
    "total_sem": int,               # Total number of weeks in period
    "nb_produits": int,             # Number of analyzed products
    "status_distribution": dict,    # Distribution by frequency status
    "items": list,                  # List of products
    "weekly_multi": list            # Multiple weekly data
}
```

**`items` structure:**
```python
[
    {
        "article": str,               # Product name
        "category": str,              # Product category
        "semaines_actives": int,      # Number of weeks with sales
        "repurchase_freq_pct": float, # Repurchase frequency in %
        "statut_frequence": str,      # Status ("Quotidien", "Regulier", "Cyclique", "Sporadique")
        "ca_total": float,            # Total revenue
        "ca_par_sem_active": float    # Revenue per active week
    }
]
```

**Usage example:**
```python
>>> get_repurchase_frequency()
{
    "items": [
        {
            "article": "TRADITIONAL BAGUETTE",
            "semaines_actives": 52,
            "repurchase_freq_pct": 100.0,
            "statut_frequence": "Quotidien"
        }
    ]
}
```

---

### `get_associations`

Retrieves product association rules (Apriori).

**Description:**
Association rules identify products that are often bought together. Lift measures the strength of association (>1 = strong association).

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort_by` | str | "Lift ↓" | Sort criteria. Options: "Lift ↓", "Confiance ↓", "Support ↓" |
| `top_n` | int | 20 | Number of rules to return |

**Return:**

```python
dict: {
    "nb_total_regles": int,  # Total number of available rules
    "rules": list            # List of rules
}
```

**`rules` structure:**
```python
[
    {
        "antecedent": str,    # Antecedent product (if A is bought)
        "consequent": str,    # Consequent product (then B is bought)
        "support": float,     # Support in % (frequency of combination)
        "confidence": float,  # Confidence in % (probability B is bought if A is bought)
        "lift": float         # Lift (association strength, >1 = strong)
    }
]
```

**Usage example:**
```python
>>> get_associations(sort_by="Lift ↓", top_n=10)
{
    "rules": [
        {
            "antecedent": "12 MACARON",
            "consequent": "BUCHE 6PERS",
            "support": 8.2,
            "confidence": 67.5,
            "lift": 3.45
        }
    ],
    "nb_total_regles": 156
}
```

---

## Forecast Tools

### `get_forecast`

Retrieves demand forecasts (Prophet).

**Description:**
This function returns demand forecasts for a given horizon, based on the Prophet model. It includes history, accuracy metrics, and seasonal forecasts.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `horizon` | int | 14 | Forecast horizon in days. Options: 7, 14, 30 |
| `forecast_type` | str | "articles" | Forecast type. Options: "articles", "ca" |
| `product` | str (optional) | None | Specific product for forecast. If None, global forecast |
| `category` | str (optional) | None | Specific category for forecast. If None, global forecast |
| `season` | str (optional) | None | Specific season for forecast |
| `event` | str (optional) | None | Specific event for forecast |
| `history_period` | str | "all" | Historical period used for training. Options: "all", "30d", "90d", "180d" |

**Return:**

```python
dict: {
    "forecast_info": {
        "type": str,           # Forecast type
        "label": str,          # Readable label
        "unit": str,           # Unit (€ or units)
        "horizon": int,        # Horizon in days
        "history_period": str  # Historical period
    },
    "metrics": {
        "mdape_cv": float,         # MDAPE (median absolute percentage error)
        "moy_jour_historique": float, # Historical daily average
        "total_prevision": float,    # Total forecast over horizon
        "horizon_jours": int         # Number of horizon days
    },
    "prophet_metrics": {
        "mdape_cv": float,          # MDAPE validation
        "train_error": float,       # Training error
        "validation_error": float,  # Validation error
        "mape_by_horizon": list     # MAPE by horizon
    },
    "model_comparison": list,      # Model comparison
    "history": list,               # History
    "forecast": list,             # Forecasts
    "forecast_season": list,      # Seasonal forecasts
    "available_filters": dict     # Available filters
}
```

**`forecast` structure:**
```python
[
    {
        "horizon": str,       # Label "J+X"
        "ds": str,            # Date
        "date_fr": str,       # Formatted FR date
        "jour_semaine": str,  # Day of the week
        "yhat": int,          # Predicted value
        "yhat_lower": int,    # Lower bound
        "yhat_upper": int,    # Upper bound
        "is_ferme": int       # 1 if closed day, 0 otherwise
    }
]
```

**Usage example:**
```python
>>> get_forecast(horizon=14, forecast_type="articles")
{
    "forecast": [
        {
            "horizon": "J+1",
            "ds": "2025-10-03",
            "yhat": 120,
            "yhat_lower": 100,
            "yhat_upper": 140
        }
    ],
    "metrics": {
        "total_prevision": 1680,
        "mdape_cv": 15.2
    }
}
```

---

## Alert Tools

### `get_alerts`

Retrieves stock alerts based on seasonal forecasts.

**Description:**
This function analyzes demand forecasts and generates stock alerts (stockout, warning, normal, overstock) for each day.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mois_filter` | str | "Tout" | Month filter for alerts. Options: "Tout", "Juin", "Juillet", "Août", "Septembre" |

**Return:**

```python
dict: {
    "kpis": {
        "total_articles": int,    # Total forecasted items
        "ca_total_prevu": float,  # Total forecasted revenue
        "marge_totale": float,    # Total forecasted margin
        "ca_risque": float,       # Revenue at risk (stockout days)
        "pic_val": int,           # Peak value
        "pic_date": str,          # Peak date
        "statuts": {
            "RUPTURE": int,       # Number of stockout days
            "VIGILANCE": int,     # Number of warning days
            "NORMAL": int,        # Number of normal days
            "SURSTOCK": int,      # Number of overstock days
            "FERMÉ": int          # Number of closed days
        }
    },
    "days": list,                 # List of days with alerts
    "available_mois": list       # Available months for filter
}
```

**`days` structure:**
```python
[
    {
        "ds": str,                    # Date
        "date_fr": str,               # Formatted FR date
        "jour_semaine": str,          # Day of the week
        "yhat": int,                  # Demand forecast
        "yhat_lower": int,            # Lower bound
        "yhat_upper": int,            # Upper bound
        "ca_prevu": float,            # Forecasted revenue
        "marge_prevue": float,        # Forecasted margin
        "ratio_pct": float,           # Stock/forecast ratio in %
        "commande_recommandee": int,  # Recommended order
        "statut": str,                # Status ("RUPTURE", "VIGILANCE", "NORMAL", "SURSTOCK", "FERMÉ")
        "bar_color": str              # Hex color code for display
    }
]
```

**Usage example:**
```python
>>> get_alerts(mois_filter="Juillet")
{
    "kpis": {
        "total_articles": 4500,
        "ca_risque": 1250.0,
        "statuts": {
            "RUPTURE": 3,
            "VIGILANCE": 5,
            "NORMAL": 18
        }
    },
    "days": [
        {
            "ds": "2026-07-15",
            "statut": "RUPTURE",
            "yhat": 150,
            "ca_prevu": 375.0
        }
    ]
}
```

---

## Tools Summary

| Tool | Module | Main description |
|------|--------|------------------|
| `get_daily_kpis` | Daily | Daily KPIs with top products and combinations |
| `get_commercial_performance` | Performance | Commercial performance with time and category filters |
| `get_penetration_data` | Product | Product penetration rate in tickets |
| `get_sales_velocity` | Product | Sales velocity per day for inventory management |
| `get_ticket_contribution` | Product | Product contribution to average ticket |
| `get_repurchase_frequency` | Product | Repurchase frequency and demand regularity |
| `get_associations` | Product | Product association rules (Apriori) |
| `get_forecast` | Forecast | Prophet demand forecasts |
| `get_alerts` | Alert | Stock alerts based on forecasts |

---

## Important Notes

- All tools use the ADK `@tool` decorator
- Tools import engines from the `backend/` folder
- Returns are raw data from engines (JSON/dictionaries)
- Optional parameters have indicated default values
- Dates must be in 'YYYY-MM-DD' format when provided
- Category and event filters accept "Toutes"/"Tous" to disable the filter
