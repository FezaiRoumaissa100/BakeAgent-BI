"""
Agent Tools - Product Module
Fonctions tools pour l'agent ADK - Analyse produits
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from db_products_engine import (
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
    Récupère les données de pénétration des produits.
    
    La pénétration indique dans quel pourcentage de tickets un produit apparaît.
    C'est un indicateur clé de la popularité d'un produit.
    
    Args:
        search (str): Recherche textuelle sur le nom du produit (recherche partielle).
            Exemples: "BAGUETTE", "BUCHE", "MACARON"
            Défaut: "" (pas de filtre)
        
        categories (list, optional): Liste des catégories à filtrer.
            Si None ou contient "Toutes", pas de filtre.
            Exemples: ["Patisseries", "Pains"], ["Toutes"]
            Défaut: None
        
        statuts (list, optional): Liste des statuts stratégiques à filtrer.
            Exemples: ["Star", "Cash Cow", "Question Mark"]
            Défaut: None
        
        year (str): Année d'analyse. Options: "Toutes", "2024", "2025", etc.
            Défaut: "Toutes"
    
    Returns:
        dict: Dictionnaire contenant:
            - kpis (dict): KPIs globaux:
                - total_articles (int): Nombre total d'articles
                - pen_max (float): Taux de pénétration maximum
                - pen_median (float): Taux de pénétration médian
                - status_counts (dict): Compte par statut stratégique
            
            - items (list): Liste des produits, chaque élément contient:
                - article (str): Nom du produit
                - category (str): Catégorie du produit
                - penetration_rate (float): Taux de pénétration (0.0 à 1.0)
                - tickets_count (int): Nombre de tickets où le produit apparaît
                - ca_total (float): CA total du produit
                - qty_total (float): Quantité totale vendue
                - upt (float): Unités par ticket (quantité / tickets)
                - statut (str): Statut stratégique
            
            - category_summary (list): Résumé par catégorie, chaque élément contient:
                - category (str): Nom de la catégorie
                - taux_moyen (float): Taux de pénétration moyen de la catégorie
                - ca_total (float): CA total de la catégorie
                - nb_articles (int): Nombre d'articles dans la catégorie
            
            - weekly_trend (list): Tendance hebdomadaire, chaque élément contient:
                - article (str): Nom du produit
                - series (list): Série de données par semaine, chaque élément contient:
                    - week (str): Semaine formatée "SXX-YY"
                    - rate (float): Taux de pénétration cette semaine
            
            - available_categories (list): Catégories disponibles
            - available_statuts (list): Statuts disponibles
            - available_years (list): Années disponibles
    
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
    Récupère les données de vitesse de vente des produits.
    
    La vitesse de vente indique combien d'articles sont vendus par jour en moyenne.
    C'est crucial pour la gestion des stocks et le réapprovisionnement.
    
    Args:
        Aucun paramètre (vue globale).
    
    Returns:
        dict: Dictionnaire contenant:
            - dow_velocity (list): Vitesse par jour de la semaine, chaque élément contient:
                - day (str): Nom du jour (Lundi, Mardi, etc.)
                - all (float): Vitesse globale
                - touristic (float): Vitesse période touristique
                - event (float): Vitesse période événement
            
            - macro_items (list): Liste des produits avec leur vélocité, chaque élément contient:
                - article (str): Nom du produit
                - daily_velocity (float): Vitesse quotidienne moyenne
                - velocity_touristic (float): Vitesse en période touristique
                - velocity_event (float): Vitesse en période événement
                - stock_securite (float): Stock de sécurité recommandé
                - ratio_touristic (float): Ratio période touristique
                - ratio_event (float): Ratio période événement
                - peak_hour (int): Heure de pointe de vente
                - ratio_pic_percent (float): Pourcentage vendu à l'heure de pointe
                - alerte_replissage_avant (str): Heure recommandée pour le replissage
            
            - hourly_distribution (list): Distribution horaire, chaque élément contient:
                - hour (int): Heure
                - heure_label (str): Heure formatée "HHh"
                - global_qte_per_hour (float): Quantité totale cette heure
                - per_product (list): Top produits cette heure, chaque élément contient:
                    - article (str): Nom du produit
                    - qte_this_hour (float): Quantité cette heure
    
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
    Récupère les données de contribution des produits au ticket moyen.
    
    La contribution indique quel pourcentage du CA d'un ticket multi-produits
    est représenté par un produit donné. Utile pour identifier les produits
    "ancre" qui structurent le panier.
    
    Args:
        Aucun paramètre (vue globale).
    
    Returns:
        dict: Dictionnaire contenant:
            - stats (dict): Statistiques globales:
                - nb_produits_analysables (int): Nombre de produits analysés
                - ca_total_multi (float): CA total des tickets multi-produits
                - distribution_par_statut (dict): Distribution par statut de contribution
                - nb_multi (int): Nombre de tickets multi-produits
                - nb_mono (int): Nombre de tickets mono-produit
                - nb_total (int): Nombre total de tickets
                - pct_multi (float): Pourcentage de tickets multi-produits
            
            - top20 (list): Top 20 produits par contribution, chaque élément contient:
                - article (str): Nom du produit
                - contribution_med (float): Contribution médiane au ticket en %
                - contribution_moy (float): Contribution moyenne au ticket en %
                - nb_tickets_multi (int): Nombre de tickets multi-produits
                - statut_contribution (str): Statut ("Ancre", "Moteur", "Complement", "Micro")
                - ca_total_multi (float): CA total en tickets multi-produits
                - frequence_multi_pct (float): Fréquence en tickets multi-produits en %
            
            - bcg_quadrants (dict): Quadrants BCG:
                - etoiles (list): Produits stars (haute contribution, haute fréquence)
                - moteurs (list): Produits moteurs (haute contribution)
                - opportunites (list): Produits opportunités (haute fréquence)
                - a_reevaluer (list): Produits à réévaluer
    
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
    Récupère les données de fréquence de rachat des produits.
    
    La fréquence de rachat indique combien de semaines un produit est vendu
    sur la période totale. C'est un indicateur de régularité de la demande.
    
    Args:
        Aucun paramètre (vue globale).
    
    Returns:
        dict: Dictionnaire contenant:
            - total_sem (int): Nombre total de semaines dans la période
            - nb_produits (int): Nombre de produits analysés
            - status_distribution (dict): Distribution par statut de fréquence
            - items (list): Liste des produits, chaque élément contient:
                - article (str): Nom du produit
                - category (str): Catégorie du produit
                - semaines_actives (int): Nombre de semaines avec ventes
                - repurchase_freq_pct (float): Fréquence de rachat en %
                - statut_frequence (str): Statut ("Quotidien", "Regulier", "Cyclique", "Sporadique")
                - ca_total (float): CA total
                - ca_par_sem_active (float): CA par semaine active
    
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
    Récupère les règles d'association de produits (Apriori).
    
    Les règles d'association identifient les produits qui sont souvent achetés
    ensemble. Le lift mesure la force de l'association (>1 = association forte).
    
    Args:
        sort_by (str): Critère de tri. Options: "Lift ↓", "Confiance ↓", "Support ↓".
            Défaut: "Lift ↓"
        
        top_n (int): Nombre de règles à retourner.
            Défaut: 20
    
    Returns:
        dict: Dictionnaire contenant:
            - nb_total_regles (int): Nombre total de règles disponibles
            - rules (list): Liste des règles, chaque élément contient:
                - antecedent (str): Produit antécédent (si A est acheté)
                - consequent (str): Produit conséquent (alors B est acheté)
                - support (float): Support en % (fréquence de la combinaison)
                - confidence (float): Confiance en % (probabilité que B soit acheté si A est acheté)
                - lift (float): Lift (force de l'association, >1 = forte)
    
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
