"""
Agent Tools - Forecast Module
Fonctions tools pour l'agent ADK - Prévisions
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from db_forecast_engine import get_forecast_data_pg


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
    Récupère les prévisions de demande (Prophet).
    
    Cette fonction retourne les prévisions de demande pour un horizon donné,
    basées sur le modèle Prophet. Elle inclut l'historique, les métriques de
    précision, et les prévisions saisonnières.
    
    Args:
        horizon (int): Horizon de prévision en jours. Options: 7, 14, 30.
            Défaut: 14
        
        forecast_type (str): Type de prévision. Options: "articles", "ca".
            Défaut: "articles"
        
        product (str, optional): Produit spécifique pour la prévision.
            Si None, prévision globale.
            Exemples: "TRADITIONAL BAGUETTE", "BUCHE 6PERS"
            Défaut: None
        
        category (str, optional): Catégorie spécifique pour la prévision.
            Si None, prévision globale.
            Exemples: "Patisseries", "Pains"
            Défaut: None
        
        season (str, optional): Saison spécifique pour la prévision.
            Exemples: "Printemps", "Ete"
            Défaut: None
        
        event (str, optional): Événement spécifique pour la prévision.
            Exemples: "Fêtes", "Vacances"
            Défaut: None
        
        history_period (str): Période historique utilisée pour l'entraînement.
            Options: "all", "30d", "90d", "180d"
            Défaut: "all"
    
    Returns:
        dict: Dictionnaire contenant:
            - forecast_info (dict): Informations sur la prévision:
                - type (str): Type de prévision
                - label (str): Label lisible
                - unit (str): Unité (€ ou unités)
                - horizon (int): Horizon en jours
                - history_period (str): Période historique
            
            - metrics (dict): Métriques de performance:
                - mdape_cv (float): MDAPE (erreur médiane absolue en %)
                - moy_jour_historique (float): Moyenne journalière historique
                - total_prevision (float): Total prévu sur l'horizon
                - horizon_jours (int): Nombre de jours de l'horizon
            
            - prophet_metrics (dict): Métriques détaillées Prophet:
                - mdape_cv (float): MDAPE validation
                - train_error (float): Erreur d'entraînement
                - validation_error (float): Erreur de validation
                - mape_by_horizon (list): MAPE par horizon
            
            - model_comparison (list): Comparaison de modèles:
                - model (str): Nom du modèle
                - mape (float): MAPE du modèle
                - status (str): Statut du modèle
            
            - history (list): Historique, chaque élément contient:
                - ds (str): Date
                - label (str): Label court
                - y (float): Valeur historique
            
            - forecast (list): Prévisions, chaque élément contient:
                - horizon (str): Label "J+X"
                - ds (str): Date
                - date_fr (str): Date formatée FR
                - jour_semaine (str): Jour de la semaine
                - yhat (int): Valeur prédite
                - yhat_lower (int): Borne inférieure
                - yhat_upper (int): Borne supérieure
                - is_ferme (int): 1 si jour fermé, 0 sinon
            
            - forecast_season (list): Prévisions saisonnières, chaque élément contient:
                - ds (str): Date
                - label (str): Label court
                - yhat (int): Valeur prédite
                - yhat_lower (int): Borne inférieure
                - yhat_upper (int): Borne supérieure
            
            - available_filters (dict): Filtres disponibles:
                - horizons (list): Horizons disponibles
                - forecast_types (list): Types disponibles
                - products (list): Produits disponibles
                - categories (list): Catégories disponibles
                - seasons (list): Saisons disponibles
                - events (list): Événements disponibles
    
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
