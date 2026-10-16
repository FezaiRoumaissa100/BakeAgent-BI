"""
Agent Tools - Product Module
ADK agent tools - Product analysis
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from engines.products_engine import (
    get_penetration_data_pg,
    get_sales_velocity_data_pg,
    get_ticket_contribution_data_pg,
    get_repurchase_frequency_data_pg,
    get_associations_data_pg
)


def get_penetration_data(
    search: str = "",
    categories: list = None,
    statuts: list = None,
    year: str = "Toutes"
) -> dict:
    """
    Retrieves product penetration data.
    
    Penetration indicates in what percentage of tickets a product appears.
    It's a key indicator of a product's popularity.
    
    Args:
        search (str): Text search on product name (partial search).
            Examples: "BAGUETTE", "BUCHE", "MACARON"
            Default: "" (no filter)
        
        categories (list, optional): List of categories to filter.
            If None or contains "Toutes", no filter.
            Examples: ["Patisseries", "Pains"], ["Toutes"]
            Default: None
        
        statuts (list, optional): List of strategic statuses to filter.
            Examples: ["Star", "Cash Cow", "Question Mark"]
            Default: None
        
        year (str): Analysis year. Options: "Toutes", "2024", "2025", etc.
            Default: "Toutes"
    
    Returns:
        dict: Dictionary containing:
            - kpis (dict): Global KPIs:
                - total_articles (int): Total number of articles
                - pen_max (float): Maximum penetration rate
                - pen_median (float): Median penetration rate
                - status_counts (dict): Count by strategic status
            
            - items (list): List of products, each element contains:
                - article (str): Product name
                - category (str): Product category
                - penetration_rate (float): Penetration rate (0.0 to 1.0)
                - tickets_count (int): Number of tickets where product appears
                - ca_total (float): Total product revenue
                - qty_total (float): Total quantity sold
                - upt (float): Units per ticket (quantity / tickets)
                - statut (str): Strategic status
            
            - category_summary (list): Summary by category, each element contains:
                - category (str): Category name
                - taux_moyen (float): Average penetration rate of category
                - ca_total (float): Total category revenue
                - nb_articles (int): Number of articles in category
            
            - weekly_trend (list): Weekly trend, each element contains:
                - article (str): Product name
                - series (list): Data series by week, each element contains:
                    - week (str): Formatted week "SXX-YY"
                    - rate (float): Penetration rate this week
            
            - available_categories (list): Available categories
            - available_statuts (list): Available statuses
            - available_years (list): Available years
    
    Example:
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
            ],
            ...
        }
    """
    return get_penetration_data_pg(search, categories, statuts, year)


def get_sales_velocity() -> dict:
    """
    Retrieves product sales velocity data.
    
    Sales velocity indicates how many items are sold per day on average.
    It's crucial for inventory management and restocking.
    
    Args:
        No parameters (global view).
    
    Returns:
        dict: Dictionary containing:
            - dow_velocity (list): Velocity by day of week, each element contains:
                - day (str): Day name (Lundi, Mardi, etc.)
                - all (float): Global velocity
                - touristic (float): Touristic period velocity
                - event (float): Event period velocity
            
            - macro_items (list): List of products with their velocity, each element contains:
                - article (str): Product name
                - daily_velocity (float): Average daily velocity
                - velocity_touristic (float): Touristic period velocity
                - velocity_event (float): Event period velocity
                - stock_securite (float): Recommended safety stock
                - ratio_touristic (float): Touristic period ratio
                - ratio_event (float): Event period ratio
                - peak_hour (int): Peak sales hour
                - ratio_pic_percent (float): Percentage sold at peak hour
                - alerte_replissage_avant (str): Recommended restocking time
            
            - hourly_distribution (list): Hourly distribution, each element contains:
                - hour (int): Hour
                - heure_label (str): Formatted hour "HHh"
                - global_qte_per_hour (float): Total quantity this hour
                - per_product (list): Top products this hour, each element contains:
                    - article (str): Product name
                    - qte_this_hour (float): Quantity this hour
    
    Example:
        >>> get_sales_velocity()
        {
            "macro_items": [
                {
                    "article": "TRADITIONAL BAGUETTE",
                    "daily_velocity": 245.3,
                    "peak_hour": 8,
                    "stock_securite": 490.0
                }
            ],
            ...
        }
    """
    return get_sales_velocity_data_pg()


def get_ticket_contribution() -> dict:
    """
    Retrieves product contribution data to average ticket.
    
    Contribution indicates what percentage of a multi-product ticket's revenue
    is represented by a given product. Useful to identify "anchor" products
    that structure the basket.
    
    Args:
        No parameters (global view).
    
    Returns:
        dict: Dictionary containing:
            - stats (dict): Global statistics:
                - nb_produits_analysables (int): Number of analyzed products
                - ca_total_multi (float): Total revenue of multi-product tickets
                - distribution_par_statut (dict): Distribution by contribution status
                - nb_multi (int): Number of multi-product tickets
                - nb_mono (int): Number of single-product tickets
                - nb_total (int): Total number of tickets
                - pct_multi (float): Percentage of multi-product tickets
            
            - top20 (list): Top 20 products by contribution, each element contains:
                - article (str): Product name
                - contribution_med (float): Median contribution to ticket in %
                - contribution_moy (float): Average contribution to ticket in %
                - nb_tickets_multi (int): Number of multi-product tickets
                - statut_contribution (str): Status ("Ancre", "Moteur", "Complement", "Micro")
                - ca_total_multi (float): Total revenue in multi-product tickets
                - frequence_multi_pct (float): Frequency in multi-product tickets in %
            
            - bcg_quadrants (dict): BCG quadrants:
                - etoiles (list): Star products (high contribution, high frequency)
                - moteurs (list): Driver products (high contribution)
                - opportunites (list): Opportunity products (high frequency)
                - a_reevaluer (list): Products to reevaluate
    
    Example:
        >>> get_ticket_contribution()
        {
            "top20": [
                {
                    "article": "BUCHE 6PERS",
                    "contribution_med": 68.5,
                    "statut_contribution": "Ancre"
                }
            ],
            ...
        }
    """
    return get_ticket_contribution_data_pg()


def get_repurchase_frequency() -> dict:
    """
    Retrieves product repurchase frequency data.
    
    Repurchase frequency indicates how many weeks a product is sold
    over the total period. It's an indicator of demand regularity.
    
    Args:
        No parameters (global view).
    
    Returns:
        dict: Dictionary containing:
            - total_sem (int): Total number of weeks in period
            - nb_produits (int): Number of analyzed products
            - status_distribution (dict): Distribution by frequency status
            - items (list): List of products, each element contains:
                - article (str): Product name
                - category (str): Product category
                - semaines_actives (int): Number of weeks with sales
                - repurchase_freq_pct (float): Repurchase frequency in %
                - statut_frequence (str): Status ("Quotidien", "Regulier", "Cyclique", "Sporadique")
                - ca_total (float): Total revenue
                - ca_par_sem_active (float): Revenue per active week
    
    Example:
        >>> get_repurchase_frequency()
        {
            "items": [
                {
                    "article": "TRADITIONAL BAGUETTE",
                    "semaines_actives": 52,
                    "repurchase_freq_pct": 100.0,
                    "statut_frequence": "Quotidien"
                }
            ],
            ...
        }
    """
    return get_repurchase_frequency_data_pg()


def get_associations(sort_by: str = "Lift ↓", top_n: int = 20) -> dict:
    """
    Retrieves product association rules (Apriori).
    
    Association rules identify products that are often bought together.
    Lift measures the strength of association (>1 = strong association).
    
    Args:
        sort_by (str): Sort criteria. Options: "Lift ↓", "Confiance ↓", "Support ↓".
            Default: "Lift ↓"
        
        top_n (int): Number of rules to return.
            Default: 20
    
    Returns:
        dict: Dictionary containing:
            - nb_total_regles (int): Total number of available rules
            - rules (list): List of rules, each element contains:
                - antecedent (str): Antecedent product (if A is bought)
                - consequent (str): Consequent product (then B is bought)
                - support (float): Support in % (frequency of combination)
                - confidence (float): Confidence in % (probability B is bought if A is bought)
                - lift (float): Lift (association strength, >1 = strong)
    
    Example:
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
    """
    return get_associations_data_pg(sort_by, top_n)
