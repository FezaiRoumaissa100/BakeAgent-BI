"""
Agent Tools - Alert Module
ADK agent tools - Stock alerts
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from engines.alerts_engine import get_alerts_data_pg


def get_alerts(mois_filter: str = "Tout") -> dict:
    """
    Retrieves stock alerts based on seasonal forecasts.
    
    This function analyzes demand forecasts and generates stock alerts
    (stockout, warning, normal, overstock) for each day.
    
    Args:
        mois_filter (str): Month filter for alerts.
            Options: "Tout", "Juin", "Juillet", "Août", "Septembre"
            Default: "Tout"
    
    Returns:
        dict: Dictionary containing:
            - kpis (dict): Global alert KPIs:
                - total_articles (int): Total forecasted items
                - ca_total_prevu (float): Total forecasted revenue
                - marge_totale (float): Total forecasted margin
                - ca_risque (float): Revenue at risk (stockout days)
                - pic_val (int): Peak value
                - pic_date (str): Peak date
                - statuts (dict): Count by status:
                    - RUPTURE (int): Number of stockout days
                    - VIGILANCE (int): Number of warning days
                    - NORMAL (int): Number of normal days
                    - SURSTOCK (int): Number of overstock days
                    - FERMÉ (int): Number of closed days
            
            - days (list): List of days with alerts, each element contains:
                - ds (str): Date
                - date_fr (str): Formatted FR date
                - jour_semaine (str): Day of the week
                - yhat (int): Demand forecast
                - yhat_lower (int): Lower bound
                - yhat_upper (int): Upper bound
                - ca_prevu (float): Forecasted revenue
                - marge_prevue (float): Forecasted margin
                - ratio_pct (float): Stock/forecast ratio in %
                - commande_recommandee (int): Recommended order
                - statut (str): Status ("RUPTURE", "VIGILANCE", "NORMAL", "SURSTOCK", "FERMÉ")
                - bar_color (str): Hex color code for display
            
            - available_mois (list): Available months for filter
    
    Example:
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
            ],
            ...
        }
    """
    return get_alerts_data_pg(mois_filter)
