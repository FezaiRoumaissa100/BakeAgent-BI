"""
Retail Intelligence Agent Test
Script to test the agent with ADK
"""

from google.adk.runners import InMemoryRunner
from google.genai import types
import asyncio
import sys
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure console logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Capture message content
os.environ["OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT"] = "true"

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'agent'))

from agent import agent

runner = InMemoryRunner(agent=agent)


async def create_session():
    await runner.session_service.create_session(
        app_name=runner.app_name,
        user_id="test_user",
        session_id="test_session",
    )


def test_agent():
    asyncio.run(create_session())

    question1 = "Quelles sont les produits importants dans ma boulangerie ?"
    message = types.Content(role="user", parts=[types.Part(text=question1)])

    try:
        for event in runner.run(
            user_id="test_user",
            session_id="test_session",
            new_message=message,
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        print(f"Response: {part.text}")

            if event.is_final_response():
                break

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_agent()