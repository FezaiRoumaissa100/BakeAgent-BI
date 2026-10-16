"""
Agent Tools - Forecast Module
ADK agent tools - Forecasts
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from engines.forecast_engine import get_forecast_data_pg


def get_forecast(
    horizon: int = 14,
    forecast_type: str = "articles",
    product: str = None,
    category: str = None,
    season: str = None,
    event: str = None,
    history_period: str = "all"
) -> dict:
    """
    Retrieves demand forecasts (Prophet).
    
    This function returns demand forecasts for a given horizon,
    based on the Prophet model. It includes history, accuracy metrics,
    and seasonal forecasts.
    
    Args:
        horizon (int): Forecast horizon in days. Options: 7, 14, 30.
            Default: 14
        
        forecast_type (str): Forecast type. Options: "articles", "ca".
            Default: "articles"
        
        product (str, optional): Specific product for forecast.
            If None, global forecast.
            Examples: "TRADITIONAL BAGUETTE", "BUCHE 6PERS"
            Default: None
        
        category (str, optional): Specific category for forecast.
            If None, global forecast.
            Examples: "Patisseries", "Pains"
            Default: None
        
        season (str, optional): Specific season for forecast.
            Examples: "Printemps", "Ete"
            Default: None
        
        event (str, optional): Specific event for forecast.
            Examples: "Fêtes", "Vacances"
            Default: None
        
        history_period (str): Historical period used for training.
            Options: "all", "30d", "90d", "180d"
            Default: "all"
    
    Returns:
        dict: Dictionary containing:
            - forecast_info (dict): Forecast information:
                - type (str): Forecast type
                - label (str): Readable label
                - unit (str): Unit (€ or units)
                - horizon (int): Horizon in days
                - history_period (str): Historical period
            
            - metrics (dict): Performance metrics:
                - mdape_cv (float): MDAPE (median absolute percentage error)
                - moy_jour_historique (float): Historical daily average
                - total_prevision (float): Total forecast over horizon
                - horizon_jours (int): Number of horizon days
            
            - prophet_metrics (dict): Detailed Prophet metrics:
                - mdape_cv (float): MDAPE validation
                - train_error (float): Training error
                - validation_error (float): Validation error
                - mape_by_horizon (list): MAPE by horizon
            
            - model_comparison (list): Model comparison:
                - model (str): Model name
                - mape (float): Model MAPE
                - status (str): Model status
            
            - history (list): History, each element contains:
                - ds (str): Date
                - label (str): Short label
                - y (float): Historical value
            
            - forecast (list): Forecasts, each element contains:
                - horizon (str): Label "J+X"
                - ds (str): Date
                - date_fr (str): Formatted FR date
                - jour_semaine (str): Day of the week
                - yhat (int): Predicted value
                - yhat_lower (int): Lower bound
                - yhat_upper (int): Upper bound
                - is_ferme (int): 1 if closed day, 0 otherwise
            
            - forecast_season (list): Seasonal forecasts, each element contains:
                - ds (str): Date
                - label (str): Short label
                - yhat (int): Predicted value
                - yhat_lower (int): Lower bound
                - yhat_upper (int): Upper bound
            
            - available_filters (dict): Available filters:
                - horizons (list): Available horizons
                - forecast_types (list): Available types
                - products (list): Available products
                - categories (list): Available categories
                - seasons (list): Available seasons
                - events (list): Available events
    
    Example:
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
            },
            ...
        }
    """
    return get_forecast_data_pg(horizon, forecast_type, product, category, season, event, history_period)
