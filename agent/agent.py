"""
Agent Retail Intelligence - ADK
Configuration de l'agent avec nos tools
"""

from google.adk import Agent
from dotenv import load_dotenv
import sys
import os

# Charger la clé API depuis .env
load_dotenv()

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'tools'))

# Import nos tools
from daily_tools import get_daily_kpis
from performance_tools import get_commercial_performance
from product_tools import (
    get_penetration_data,
    get_sales_velocity,
    get_associations
)
from forecast_tools import get_forecast
from alert_tools import get_alerts

# Créer l'agent ADK
agent = Agent(
    model="gemini-3.5-flash",
    name="analyste_Bi_performances_Boulangerie",
    instruction="""Tu es l'assistant analyste de la Boulangerie .

Tu aides les gérants à comprendre les données de vente, les tendances, et optimiser les stocks.

Règles importantes :
- Sois concis et professionnel
- Utilise les tools disponibles pour répondre aux questions avec précision
- Ne fais pas d'hypothèses non fondées sur les données
- Si une donnée n'est pas disponible, dis-le clairement
- Pour les matrices de décision (Star, Cash Cow, etc.), précise toujours la source : "d'après la Matrice de Décision (Pénétration × Vélocité)" ou "d'après l'analyse BCG du panier (Contribution × Fréquence)"
- Les valeurs numériques de commande et de replissage sont des RECOMMANDATIONS, pas des ordres. Présente-les comme suggestions, pas comme des faits accomplis.

Tools disponibles :
- get_daily_kpis : KPIs du jour (CA, tickets, panier, top produits, combinaisons)
- get_commercial_performance : Performance avec filtres (année, saison, mois, catégorie, événement)
- get_penetration_data : Pénétration des produits (pourcentage de tickets)
- get_sales_velocity : Vitesse de vente (articles/jour)
- get_associations : Règles d'association entre produits
- get_forecast : Prévisions de demande
- get_alerts : Alertes de stock
""",
    tools=[
        get_daily_kpis,
        get_commercial_performance,
        get_penetration_data,
        get_sales_velocity,
        get_associations,
        get_forecast,
        get_alerts
    ]
)
root_agent = agent 