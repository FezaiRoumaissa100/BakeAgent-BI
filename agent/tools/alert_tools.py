"""
Agent Tools - Alert Module
Fonctions tools pour l'agent ADK - Alertes stock
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from db_alerts_engine import get_alerts_data_pg


def get_alerts(mois_filter: str = "Tout") -> dict:
    """
    Récupère les alertes de stock basées sur les prévisions saisonnières.
    
    Cette fonction analyse les prévisions de demande et génère des alertes
    de stock (rupture, vigilance, normal, surstock) pour chaque jour.
    
    Args:
        mois_filter (str): Filtre de mois pour les alertes.
            Options: "Tout", "Juin", "Juillet", "Août", "Septembre"
            Défaut: "Tout"
    
    Returns:
        dict: Dictionnaire contenant:
            - kpis (dict): KPIs globaux des alertes:
                - total_articles (int): Total d'articles prévus
                - ca_total_prevu (float): CA total prévu
                - marge_totale (float): Marge totale prévue
                - ca_risque (float): CA à risque (jours en rupture)
                - pic_val (int): Valeur du pic
                - pic_date (str): Date du pic
                - statuts (dict): Compte par statut:
                    - RUPTURE (int): Nombre de jours en rupture
                    - VIGILANCE (int): Nombre de jours en vigilance
                    - NORMAL (int): Nombre de jours normaux
                    - SURSTOCK (int): Nombre de jours en surstock
                    - FERMÉ (int): Nombre de jours fermés
            
            - days (list): Liste des jours avec alertes, chaque élément contient:
                - ds (str): Date
                - date_fr (str): Date formatée FR
                - jour_semaine (str): Jour de la semaine
                - yhat (int): Prévision de demande
                - yhat_lower (int): Borne inférieure
                - yhat_upper (int): Borne supérieure
                - ca_prevu (float): CA prévu
                - marge_prevue (float): Marge prévue
                - ratio_pct (float): Ratio stock/prévision en %
                - commande_recommandee (int): Commande recommandée
                - statut (str): Statut ("RUPTURE", "VIGILANCE", "NORMAL", "SURSTOCK", "FERMÉ")
                - bar_color (str): Code couleur hex pour l'affichage
            
            - available_mois (list): Mois disponibles pour le filtre
    
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
