"""
Test de l'agent Retail Intelligence
Script pour tester l'agent avec ADK
"""

from google.adk.runners import InMemoryRunner
import sys
import os

# Add paths
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'agent'))

from agent import agent

# Creer le Runner
runner = InMemoryRunner(agent=agent)

def test_agent():
    """Test simple de l'agent"""
    print("Test Agent Analyste Boulangerie")
    print("=" * 50)
    
    # Test 1 : Question simple
    question1 = "Quel est le chiffre d'affaires du jour ?"
    print(f"\nTest 1 : {question1}")
    print("Traitement...")
    
    try:
        result = runner.run(
            user_id="test_user",
            session_id="test_session",
            new_message=question1
        )
        print(f"Reponse : {result.events[-1].content}")
    except Exception as e:
        print(f"Erreur : {e}")
    
    print("\n" + "=" * 50)
    
    # Test 2 : Question sur les produits
    question2 = "Quels sont les top 3 produits du jour ?"
    print(f"\nTest 2 : {question2}")
    print("Traitement...")
    
    try:
        result = runner.run(
            user_id="test_user",
            session_id="test_session",
            new_message=question2
        )
        print(f"Reponse : {result.events[-1].content}")
    except Exception as e:
        print(f"Erreur : {e}")
    
    print("\n" + "=" * 50)
    print("Tests termines")

if __name__ == "__main__":
    test_agent()
