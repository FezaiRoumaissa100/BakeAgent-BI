"""
Agent Tools - Performance Module
ADK agent tools - Commercial performance
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from engines.commercial_engine import calculate_commercial_performance_pg


def get_commercial_performance(
    annee: str = "Toutes",
    saison: str = "Toutes",
    mois: str = "Tous",
    categorie: str = "Toutes",
    evenement: str = "Tous"
) -> dict:
    """
    Retrieves commercial performance data with filters.
    
    This function analyzes global revenue performance over a period
    defined by filters. It returns KPIs, monthly evolution, top products,
    seasonality, and category data.
    
    Args:
        annee (str): Year filter. Options: "Toutes" or specific year (ex: "2024", "2025", "2026").
            Available years are automatically detected from the database.
            Default: "Toutes"
        
        saison (str): Season filter. Options: "Toutes", "Printemps", "Ete", "Automne", "Hiver".
            Default: "Toutes"
        
        mois (str): Month filter. Options: "Tous", "Janvier", "Février", "Mars", "Avril", 
                   "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre".
            Default: "Tous"
        
        categorie (str): Category filter. Options: "Toutes" or specific category name.
            Examples: "Patisseries", "Pains", "Traiteur & Sale", "Viennoiseries"
            Default: "Toutes"
        
        evenement (str): Event filter. Options: "Tous" or specific event name.
            Examples: "Fêtes", "Vacances"
            Default: "Tous"
    
    Returns:
        dict: Dictionary containing:
            - kpis (dict): Global period KPIs:
                - total_ca (float): Total revenue
                - nb_tickets (int): Total number of tickets
                - panier (float): Average basket
                - nb_jours (int): Number of active days
                - nb_produits (int): Number of products sold
            
            - monthly (dict): Monthly data:
                - series (list): Monthly time series, each element contains:
                    - date (str): Formatted date
                    - label (str): Month label (ex: "Oct 2025")
                    - ca (float): Monthly revenue
                - moyenne (float): Monthly average revenue
                - ecart_type (float): Revenue standard deviation
                - ca_max (dict): Maximum revenue with date_str and val
                - ca_min (dict): Minimum revenue with date_str and val
                - amplitude (float): Amplitude (max - min)
                - ratio_amp (float): Ratio max/min
                - comp_24_25 (list): 2024 vs 2025 comparison by month, each element contains:
                    - mois (str): Short month name
                    - ca_2024 (float): 2024 revenue
                    - ca_2025 (float): 2025 revenue
            
            - top_products (dict): Top products:
                - by_ca (list): Top by revenue, each element contains:
                    - article (str): Product name
                    - total_revenue (float): Total revenue
                    - part (float): Share in % of total revenue
                    - cumul (float): Cumulative share
                - by_qte (list): Top by quantity, each element contains:
                    - article (str): Product name
                    - quantity (float): Total quantity
                - by_tkt (list): Top by tickets, each element contains:
                    - article (str): Product name
                    - nb_tkt (int): Number of tickets
            
            - seasonality (dict): Seasonality data:
                - days (list): By day of week, each element contains:
                    - day (str): Day name (Lundi, Mardi, etc.)
                    - ca_total (float): Total revenue this day
                    - ca_moyen (float): Average revenue this day
                - hourly (list): By hour, each element contains:
                    - hour (int): Hour
                    - heure_label (str): Formatted hour "HHh"
                    - ca (float): Revenue this hour
                    - tickets (int): Tickets this hour
            
            - categories (list): List of categories, each element contains:
                - category (str): Category name
                - ca (float): Category revenue
                - part (float): Share in % of total revenue
                - panier (float): Category average basket
                - tickets (int): Category tickets
                - produits (int): Number of products in category
            
            - available_filters (dict): Available filters:
                - annees (list): Available years
                - saisons (list): Available seasons
                - mois (list): Available months
                - categories (list): Available categories
                - evenements (list): Available events
    
    Example:
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
            ],
            ...
        }
    """
    return calculate_commercial_performance_pg(annee, saison, mois, categorie, evenement)
