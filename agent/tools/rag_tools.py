"""
Agent Tools - RAG Module
ADK agent tools - Knowledge base search
"""

import sys
import os

# Add backend to path to import engines
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from rag.rag_engine import get_available_themes, search_by_theme, semantic_search


def get_available_knowledge_themes() -> dict:
    """
    Retrieves the list of available themes in the RAG knowledge base.
    
    This function returns all theme identifiers/titles available
    so the agent can select the right theme when searching.
    
    Returns:
        dict: {
            "themes": list,  # List of available theme/titles
            "total_themes": int  # Total number of themes
        }
    
    Example:
        >>> get_available_knowledge_themes()
        {
            "themes": [
                "Contexte et Problématique",
                "Taux de Pénétration - Définition",
                "Vitesse des Ventes",
                ...
            ],
            "total_themes": 11
        }
    """
    themes = get_available_themes()
    return {
        "themes": themes,
        "total_themes": len(themes)
    }


def search_knowledge_by_theme(titre: str) -> dict:
    """
    Retrieves all knowledge chunks of a specific theme.
    
    This function allows the agent to access all documentation of a specific
    theme (ex: "Taux de Pénétration", "Vitesse des Ventes", etc.).
    
    Args:
        titre (str): Exact theme title/identifier to search.
            Use get_available_knowledge_themes() to see available options.
    
    Returns:
        dict: {
            "theme": str,  # Searched theme name
            "chunks": list,  # List of text chunks for this theme
            "total_chunks": int  # Number of chunks found
        }
    
    Example:
        >>> search_knowledge_by_theme("Taux de Pénétration - Définition")
        {
            "theme": "Taux de Pénétration - Définition",
            "chunks": [
                "Chunk 2 : Le Taux de Pénétration - Définition et Architecture...",
                ...
            ],
            "total_chunks": 3
        }
    """
    return search_by_theme(titre)


def semantic_search_knowledge(query: str, limit: int = 5) -> dict:
    """
    Semantic search in the knowledge base using vector similarity.
    
    This function allows the agent to find relevant information
    using vector search based on the meaning of the question,
    not just exact keyword matching.
    
    Args:
        query (str): User question or query.
            Example: "Comment calculer le taux de pénétration ?"
        
        limit (int): Maximum number of results to return.
            Default: 5
    
    Returns:
        dict: {
            "query": str,  # Original query
            "results": list,  # List of results with similarity
            "total_results": int  # Number of results found
        }
    
    Results structure:
        [
            {
                "titre": str,  # Theme title
                "chunk": str,  # Relevant chunk text
                "similarity": float  # Similarity score (0-1)
            }
        ]
    
    Example:
        >>> semantic_search_knowledge("Comment calculer la pénétration ?", limit=3)
        {
            "query": "Comment calculer la pénétration ?",
            "results": [
                {
                    "titre": "Taux de Pénétration - Définition",
                    "chunk": "La formule est : Taux de pénétration (%) = ...",
                    "similarity": 0.85
                }
            ],
            "total_results": 3
        }
    """
    return semantic_search(query, limit)
