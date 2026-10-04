"""
Agent Tools - Daily Data Module
Fonctions tools pour l'agent ADK - Données journalières
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from db_data_engine import calculate_daily_kpis_pg
from datetime import date


def get_daily_kpis(target_date: str = None) -> dict:
    """
    Récupère les KPIs journaliers pour une date spécifique.
    
    Cette fonction retourne toutes les métriques clés d'une journée : chiffre d'affaires,
    nombre de tickets, panier moyen, vitesse des ventes, top produits, top combinaisons,
    données horaires, catégories, etc.
    
    Args:
        target_date (str, optional): Date cible au format 'YYYY-MM-DD'.
            Si None, utilise la date du jour.
            Exemples: "2025-10-02", "2025-09-15"
            Défaut: None (date du jour)
    
    Returns:
        dict: Dictionnaire contenant:
            - ca_jour (float): Chiffre d'affaires du jour en EUR
            - tickets (int): Nombre de tickets transactions
            - panier (float): Panier moyen en EUR
            - qte_jour (int): Quantité totale d'articles vendus
            - hourly_data (list): Liste des données horaires, chaque élément contient:
                - hour (int): Heure de la journée (0-23)
                - ca (float): CA de cette heure
                - tkt (int): Nombre de tickets cette heure
                - qte (float): Quantité vendue cette heure
                - panier_h (float): Panier moyen cette heure
                - heure (str): Heure formatée "HHh"
                - ca_cum (float): CA cumulé jusqu'à cette heure
            - heures_act (int): Nombre d'heures avec ventes
            - vitesse (float): Vitesse des ventes (articles/heure)
            - peak_h (int): Heure de pointe
            - peak_qte_h (float): Quantité vendue à l'heure de pointe
            - ca_moy_global (float): CA moyen global
            - delta_vs_moy (float): Écart en % vs moyenne
            - top_qte (list): Top produits par quantité, chaque élément contient:
                - article (str): Nom du produit
                - quantity (float): Quantité vendue
            - top_ca (list): Top produits par CA, chaque élément contient:
                - article (str): Nom du produit
                - total_revenue (float): CA total
            - top_tkt (list): Top produits par nombre de tickets, chaque élément contient:
                - article (str): Nom du produit
                - nb_tkt (int): Nombre de tickets
            - categories (list): Liste des catégories, chaque élément contient:
                - category (str): Nom de la catégorie
                - total_revenue (float): CA de la catégorie
            - top_pairs (list): Top combinaisons de produits, chaque élément contient:
                - pa (str): Premier produit de la paire
                - pb (str): Deuxième produit de la paire
                - cnt (int): Nombre d'occurrences de cette combinaison
            - nb_multi (int): Nombre de tickets multi-produits
            - nb_mono (int): Nombre de tickets mono-produit
            - pct_m (float): Pourcentage de tickets multi-produits
            - alerts_count (int): Nombre d'alertes
            - date_str (str): Date formatée
            - jour_str (str): Jour de la semaine
            - total_lignes (int): Nombre total de lignes
    
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
