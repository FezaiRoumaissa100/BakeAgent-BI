"""
Agent Tools - Daily Data Module
ADK agent tools - Daily data
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from engines.data_engine import calculate_daily_kpis_pg
from datetime import date


def get_daily_kpis(target_date: str = None) -> dict:
    """
    Retrieves daily KPIs for a specific date.
    
    This function returns all key metrics for a day: revenue,
    number of tickets, average basket, sales velocity, top products, top combinations,
    hourly data, categories, etc.
    
    Args:
        target_date (str, optional): Target date in 'YYYY-MM-DD' format.
            If None, uses today's date.
            Examples: "2025-10-02", "2025-09-15"
            Default: None (today's date)
    
    Returns:
        dict: Dictionary containing:
            - ca_jour (float): Daily revenue in EUR
            - tickets (int): Number of ticket transactions
            - panier (float): Average basket in EUR
            - qte_jour (int): Total quantity of items sold
            - hourly_data (list): List of hourly data, each element contains:
                - hour (int): Hour of the day (0-23)
                - ca (float): Revenue for this hour
                - tkt (int): Number of tickets this hour
                - qte (float): Quantity sold this hour
                - panier_h (float): Average basket this hour
                - heure (str): Formatted hour "HHh"
                - ca_cum (float): Cumulative revenue up to this hour
            - heures_act (int): Number of hours with sales
            - vitesse (float): Sales velocity (items/hour)
            - peak_h (int): Peak hour
            - peak_qte_h (float): Quantity sold at peak hour
            - ca_moy_global (float): Global average revenue
            - delta_vs_moy (float): Percentage difference vs average
            - top_qte (list): Top products by quantity, each element contains:
                - article (str): Product name
                - quantity (float): Quantity sold
            - top_ca (list): Top products by revenue, each element contains:
                - article (str): Product name
                - total_revenue (float): Total revenue
            - top_tkt (list): Top products by ticket count, each element contains:
                - article (str): Product name
                - nb_tkt (int): Number of tickets
            - categories (list): List of categories, each element contains:
                - category (str): Category name
                - total_revenue (float): Category revenue
            - top_pairs (list): Top product combinations, each element contains:
                - pa (str): First product in the pair
                - pb (str): Second product in the pair
                - cnt (int): Number of occurrences of this combination
            - nb_multi (int): Number of multi-product tickets
            - nb_mono (int): Number of single-product tickets
            - pct_m (float): Percentage of multi-product tickets
            - alerts_count (int): Number of alerts
            - date_str (str): Formatted date
            - jour_str (str): Day of the week
            - total_lignes (int): Total number of lines
    
    Example:
        >>> get_daily_kpis("2025-10-02")
        {
            "ca_jour": 18139.71,
            "tickets": 508,
            "panier": 35.7080905511811,
            "top_qte": [
                {"article": "BUCHE 6PERS", "quantity": 215.0},
                {"article": "BUCHE 4PERS", "quantity": 115.0}
            ],
            "top_pairs": [
                {"pa": "12 MACARON", "pb": "BUCHE 6PERS", "cnt": 33}
            ],
            ...
        }
    """
    if target_date:
        from datetime import datetime
        target = datetime.strptime(target_date, '%Y-%m-%d').date()
    else:
        target = date.today()
    
    return calculate_daily_kpis_pg(target)
