"""
Script to launch ADK API server on port 8001
This script exposes the agent via a REST API that the frontend can call
"""

import os
import sys
from dotenv import load_dotenv
from google.adk.cli.fast_api import get_fast_api_app


load_dotenv()
if "GEMINI_API_KEY" in os.environ:
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]



AGENT_DIR = os.path.dirname(os.path.abspath(__file__))

if __name__ == "__main__":
    app = get_fast_api_app(
        agents_dir=AGENT_DIR,
        use_local_storage=True,
        allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:3002"],  # Allow CORS for frontend
        web=False,
    )

    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
