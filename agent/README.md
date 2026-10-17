# Retail Intelligence Agent

AI-powered business intelligence agent for bakery analytics, built with Google ADK (Agent Development Kit) and Gemini models.

## Overview

This agent analyzes bakery data and provides actionable insights through natural language conversations. It can answer questions about:
- Daily KPIs (revenue, tickets, basket size)
- Commercial performance trends
- Product penetration and sales velocity
- Demand forecasts
- Stock alerts
- Product associations

## Architecture

```
agent/
├── __init__.py              # Package initialization
├── agent.py                 # Main agent configuration
├── start_agent.py            # Server startup script
├── prompt/
│   └── system_prompt.txt    # System instructions for the agent
├── tools/                   # Agent tools (functions the agent can call)
│   ├── __init__.py
│   ├── daily_tools.py         # Daily KPIs data
│   ├── performance_tools.py   # Commercial performance
│   ├── product_tools.py       # Product analysis
│   ├── forecast_tools.py     # Demand forecasts
│   ├── alert_tools.py        # Stock alerts
│   ├── rag_tools.py          # RAG knowledge base search
│   └── product_forecast_tools.py  # Product-specific forecasts
└── tests/
    ├── testagent.py          # Agent integration tests
    └── test_rag_current.py   # RAG system tests
```

## Tech Stack

- **Framework**: Google ADK (Agent Development Kit)
- **Model**: Gemini 2.5 Flash Lite (configurable via GEMINI_API_KEY)
- **Backend Integration**: PostgreSQL via custom tools
- **RAG**: PostgreSQL + Gemini embeddings (JSONB-based)
- **Server**: FastAPI (via ADK)

## Quick Start

### Prerequisites

1. PostgreSQL database running with retail data
2. Python 3.8+ with dependencies installed
3. GEMINI_API_KEY set in environment variables

### Environment Setup

Create a `.env` file in the `agent/` directory:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite  # Optional, defaults to gemini-2.5-flash-lite
```

### Starting the Agent

```bash
cd agent
python start_agent.py
```

The agent server will start on `http://127.0.0.1:8001`

### Testing the Agent

```bash
cd agent/tests
python testagent.py
```

## Tools Available

The agent has access to the following tools (see `tools/` directory):

### Data Tools
- `get_daily_kpis` - Daily KPIs, top products, hourly data
- `get_commercial_performance` - Performance with filters (year, season, month, category)
- `get_penetration_data` - Product penetration rates
- `get_sales_velocity` - Sales velocity, safety stock, peak hours
- `get_ticket_contribution` - Product contribution to basket, BCG analysis
- `get_repurchase_frequency` - Repurchase frequency and regularity
- `get_associations` - Product association rules (Apriori)

### Forecast & Alert Tools
- `get_forecast` - Prophet demand forecasts (7/14/30 day horizons)
- `get_alerts` - Stock alerts based on forecasts
- `get_product_forecast` - Per-product forecasts
- `get_product_risk` - Per-product shortage risk

### RAG Tools
- `get_available_knowledge_themes` - List available knowledge themes
- `search_knowledge_by_theme` - Retrieve all chunks for a specific theme
- `semantic_search_knowledge` - Semantic search in knowledge base

For detailed documentation of each tool, see `TOOLS_DOCUMENTATION.md`.

## System Prompt

The agent's behavior is defined in `prompt/system_prompt.txt`. It includes:

- **Role**: Senior BI analyst for a bakery
- **Language Rules**: Respond in the same language as the user
- **Data Rules**: Only use verifiable data from tools, no calculations
- **Response Structure**: 5-step reasoning framework
- **Plain Language**: Explain BI concepts simply for non-technical users
- **Chart Explanation**: Handle chart data from custom_metadata

## Backend Integration

The agent tools import functions from the backend:

```python
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from engines.data_engine import calculate_daily_kpis_pg
from engines.commercial_engine import calculate_commercial_performance_pg
# ... etc
```

The backend structure after reorganization:
- `backend/db/` - Database connection layer
- `backend/engines/` - Calculation engines
- `backend/rag/` - RAG and embeddings

## RAG Knowledge Base

The agent has access to a RAG (Retrieval-Augmented Generation) knowledge base stored in PostgreSQL:

- **Format**: JSONB (no pgvector required)
- **Embeddings**: Gemini text embeddings
- **Storage**: PostgreSQL table with chunks and embeddings
- **Usage**: Explain BI concepts, provide context for metrics

To ingest knowledge chunks:
```bash
cd backend
python rag/ingest_rag_chunks.py
```

## Error Handling

All tools are wrapped with a `_safe` decorator in `agent.py`:

```python
def _safe(tool):
    @functools.wraps(tool)
    def wrapper(*args, **kwargs):
        try:
            return tool(*args, **kwargs)
        except Exception as e:
            logging.exception("Outil %s en erreur", tool.__name__)
            return {"error": f"L'outil {tool.__name__} a échoué : ..."}
    return wrapper
```

This prevents tool failures from crashing the entire agent response.

## Debugging

### Check Agent Logs

The agent server logs to console. Look for:
- Tool call failures
- API errors
- Model response issues

### Test Tools Individually

```python
from tools.daily_tools import get_daily_kpis
result = get_daily_kpis("2025-10-02")
print(result)
```

### Test RAG System

```bash
cd agent/tests
python test_rag_current.py
```

## Frontend Integration

The frontend communicates with the agent via:

**Endpoint**: `http://127.0.0.1:8001/run`

**Implementation**: See `frontend/src/lib/api.ts`
- `queryAgentWithMetadata()` - Main function to query the agent
- `createAgentSession()` - Session management
- Auto-retry logic for Gemini tool_code format leaks

## Known Issues

### Gemini Tool Code Leak

**Issue**: The Gemini model occasionally outputs internal tool-calling format:
```
tool_code print(default_api.get_daily_kpis(...))
```

**Solution**: The frontend detects this pattern and automatically retries the call (max 2 retries). See `frontend/src/lib/api.ts` for implementation.

## Development Guidelines

### Adding a New Tool

1. Create the tool function in `tools/` directory
2. Add docstring with Args and Returns
3. Import and add to the tools list in `agent.py`
4. Update `TOOLS_DOCUMENTATION.md` if needed
5. Test the tool independently
6. Add to agent tools list: `tools=[_safe(t) for t in [...]]`

### Modifying System Prompt

Edit `prompt/system_prompt.txt`. Changes affect agent behavior immediately after restart.

**Key sections**:
- REGLE 1: Language matching
- REGLE 2: Veridical data only
- REGLE 3: Multiple tool calls
- REGLE 6: RAG knowledge base
- REGLE 6C: Plain language for bakers

## Deployment

### Production

1. Set environment variables for production API keys
2. Configure CORS in `start_agent.py` for production domains
3. Use a production-grade model (e.g., gemini-2.5-flash)
4. Ensure PostgreSQL is secure and backed up
5. Monitor agent logs for errors and performance

### Docker (Optional)

Create a `Dockerfile`:
```dockerfile
FROM python:3.11
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "start_agent.py"]
```

## Troubleshooting

### Agent returns "Service temporarily unavailable"

**Causes**:
- Backend not running (port 8000)
- PostgreSQL connection failed
- Tool execution error

**Solutions**:
1. Check backend is running: `http://127.0.0.1:8000`
2. Check PostgreSQL connection
3. Check agent logs for specific error

### Agent doesn't call tools

**Causes**:
- GEMINI_API_KEY not set or invalid
- Model doesn't understand tool descriptions
- System prompt conflicts

**Solutions**:
1. Verify GEMINI_API_KEY in environment
2. Check tool docstrings are clear
3. Test tool functions independently

### RAG returns no results

**Causes**:
- Knowledge base not ingested
- Semantic search finds no matches
- Database table empty

**Solutions**:
1. Run `python backend/rag/ingest_rag_chunks.py`
2. Check PostgreSQL table has data
3. Test with `python agent/tests/test_rag_current.py`

## Contributing

When contributing to the agent:

1. Keep tool docstrings updated
2. Add tests for new tools
3. Update `TOOLS_DOCUMENTATION.md`
4. Follow Python coding conventions (PEP 8)
5. Test with `python agent/tests/testagent.py`

## Roadmap

For planned improvements and future enhancements (anomaly detection, AI alerts, decision support, production readiness), see [ROADMAP.md](./ROADMAP.md).

## Contact
For questions or issues, please refer to the main project repository.
