"""
Agent Tools - Performance Module
Fonctions tools pour l'agent ADK - Performance commerciale
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from db_commercial_engine import calculate_commercial_performance_pg


def get_commercial_performance(
    annee: str = "Toutes",
    saison: str = "Toutes",
    mois: str = "Tous",
    categorie: str = "Toutes",
    evenement: str = "Tous"
) -> dict:
    """
    Récupère les données de performance commerciale avec filtres.
    
    Cette fonction analyse la performance globale du chiffre d'affaires sur une période
    définie par les filtres. Elle retourne les KPIs, l'évolution mensuelle, les top produits,
    la saisonnalité, et les données par catégorie.
    
    Args:
        annee (str): Filtre année. Options: "Toutes" ou année spécifique (ex: "2024", "2025", "2026").
            Les années disponibles sont détectées automatiquement depuis la base de données.
            Défaut: "Toutes"
        
        saison (str): Filtre saison. Options: "Toutes", "Printemps", "Ete", "Automne", "Hiver".
            Défaut: "Toutes"
        
        mois (str): Filtre mois. Options: "Tous", "Janvier", "Février", "Mars", "Avril", 
                   "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre".
            Défaut: "Tous"
        
        categorie (str): Filtre catégorie. Options: "Toutes" ou nom de catégorie spécifique.
            Exemples: "Patisseries", "Pains", "Traiteur & Sale", "Viennoiseries"
            Défaut: "Toutes"
        
        evenement (str): Filtre événement. Options: "Tous" ou nom d'événement spécifique.
            Exemples: "Fêtes", "Vacances"
            Défaut: "Tous"
    
    Returns:
        dict: Dictionnaire contenant:
            - kpis (dict): KPIs globaux de la période:
                - total_ca (float): Chiffre d'affaires total
                - nb_tickets (int): Nombre total de tickets
                - panier (float): Panier moyen
                - nb_jours (int): Nombre de jours actifs
                - nb_produits (int): Nombre de produits vendus
            
            - monthly (dict): Données mensuelles:
                - series (list): Série temporelle mensuelle, chaque élément contient:
                    - date (str): Date formatée
                    - label (str): Label du mois (ex: "Oct 2025")
                    - ca (float): CA du mois
                - moyenne (float): CA moyen mensuel
                - ecart_type (float): Écart-type du CA
                - ca_max (dict): CA maximum avec date_str et val
                - ca_min (dict): CA minimum avec date_str et val
                - amplitude (float): Amplitude (max - min)
                - ratio_amp (float): Ratio max/min
                - comp_24_25 (list): Comparaison 2024 vs 2025 par mois, chaque élément contient:
                    - mois (str): Nom du mois court
                    - ca_2024 (float): CA 2024
                    - ca_2025 (float): CA 2025
            
            - top_products (dict): Top produits:
                - by_ca (list): Top par CA, chaque élément contient:
                    - article (str): Nom du produit
                    - total_revenue (float): CA total
                    - part (float): Part en % du CA total
                    - cumul (float): Cumul des parts
                - by_qte (list): Top par quantité, chaque élément contient:
                    - article (str): Nom du produit
                    - quantity (float): Quantité totale
                - by_tkt (list): Top par tickets, chaque élément contient:
                    - article (str): Nom du produit
                    - nb_tkt (int): Nombre de tickets
            
            - seasonality (dict): Données de saisonnalité:
                - days (list): Par jour de la semaine, chaque élément contient:
                    - day (str): Nom du jour (Lundi, Mardi, etc.)
                    - ca_total (float): CA total ce jour
                    - ca_moyen (float): CA moyen ce jour
                - hourly (list): Par heure, chaque élément contient:
                    - hour (int): Heure
                    - heure_label (str): Heure formatée "HHh"
                    - ca (float): CA cette heure
                    - tickets (int): Tickets cette heure
            
            - categories (list): Liste des catégories, chaque élément contient:
                - category (str): Nom de la catégorie
                - ca (float): CA de la catégorie
                - part (float): Part en % du CA total
                - panier (float): Panier moyen de la catégorie
                - tickets (int): Tickets de la catégorie
                - produits (int): Nombre de produits dans la catégorie
            
            - available_filters (dict): Filtres disponibles:
                - annees (list): Liste des années disponibles
                - saisons (list): Liste des saisons disponibles
                - mois (list): Liste des mois disponibles
                - categories (list): Liste des catégories disponibles
                - evenements (list): Liste des événements disponibles
    
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
