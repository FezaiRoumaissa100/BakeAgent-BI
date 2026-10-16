"""
Retail Intelligence Agent - ADK
Agent configuration with tools and loading system prompt from prompt/system_prompt.txt
"""

from google.adk import Agent
from dotenv import load_dotenv
import sys
import os

load_dotenv()
os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")

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

agent = Agent(
    model="gemini-2.5-flash-lite",
    name="analyste_BI_performances_Boulangerie",
    instruction=load_system_instruction(),
    tools=[
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
        semantic_search_knowledge
    ]
)

root_agent = agent
