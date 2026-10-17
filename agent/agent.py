"""
Retail Intelligence Agent - ADK
Agent configuration with tools and loading system prompt from prompt/system_prompt.txt
"""

from google.adk import Agent
from dotenv import load_dotenv
import sys
import os

# Lit la clé dans agent/.env (ou le .env du projet), quel que soit le dossier de lancement.
_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, ".env"))
load_dotenv(os.path.join(_HERE, "..", ".env"))
# La clé peut s'appeler GEMINI_API_KEY ou GOOGLE_API_KEY : on accepte les deux.
if os.getenv("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(BASE_DIR, '..', 'backend'))
sys.path.append(os.path.join(BASE_DIR, 'tools'))

PROMPT_PATH = os.path.join(BASE_DIR, 'prompt', 'system_prompt.txt')


def load_system_instruction() -> str:
    """Loads system prompt from prompt/system_prompt.txt file."""
    if not os.path.isfile(PROMPT_PATH):
        raise FileNotFoundError(f"Prompt file not found: {PROMPT_PATH}")
    with open(PROMPT_PATH, 'r', encoding='utf-8') as f:
        return f.read()


from daily_tools import get_daily_kpis
from performance_tools import get_commercial_performance
from product_tools import (
    get_penetration_data,
    get_sales_velocity,
    get_ticket_contribution,
    get_repurchase_frequency,
    get_associations
)
from forecast_tools import get_forecast
from alert_tools import get_alerts
from rag_tools import (
    get_available_knowledge_themes,
    search_knowledge_by_theme,
    semantic_search_knowledge
)
from product_forecast_tools import get_product_forecast, get_product_risk

import functools
import logging


def _safe(tool):
    """Si un outil plante (base indisponible, produit inconnu…), l'assistant reçoit un message
    d'erreur au lieu de faire tomber toute la réponse (« Service temporarily unavailable »)."""
    @functools.wraps(tool)
    def wrapper(*args, **kwargs):
        try:
            return tool(*args, **kwargs)
        except Exception as e:  # noqa: BLE001
            logging.exception("Outil %s en erreur", tool.__name__)
            return {"error": f"L'outil {tool.__name__} a échoué : {type(e).__name__}: {e}. "
                             "Réponds avec les données du graphique fournies dans la question si elles existent."}
    return wrapper

agent = Agent(
    # Modèle choisi dans agent/.env (GEMINI_MODEL=...), chacun garde le sien ; défaut : gemini-2.5-flash-lite
    model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"),
    name="analyste_BI_performances_Boulangerie",
    instruction=load_system_instruction(),
    tools=[_safe(t) for t in [
        get_daily_kpis,
        get_commercial_performance,
        get_penetration_data,
        get_sales_velocity,
        get_ticket_contribution,
        get_repurchase_frequency,
        get_associations,
        get_forecast,
        get_alerts,
        get_available_knowledge_themes,
        search_knowledge_by_theme,
        semantic_search_knowledge,
        get_product_forecast,
        get_product_risk,
    ]]
)

root_agent = agent
