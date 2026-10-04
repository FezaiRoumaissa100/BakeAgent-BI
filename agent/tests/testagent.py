"""
Test de l'agent Retail Intelligence
Script pour tester l'agent avec ADK
"""

from google.adk.runners import InMemoryRunner
from google.genai import types
import asyncio
import sys
import os

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

    question1 = "Quelles sont les produits que je dois concentrer a vendre et pourquoi simplement ?"
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
                        print(f"Réponse : {part.text}")

            if event.is_final_response():
                break

    except Exception as e:
        print(f"Erreur : {e}")


if __name__ == "__main__":
    test_agent()