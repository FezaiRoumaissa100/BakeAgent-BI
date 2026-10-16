"""
Engine RAG - Recherche vectorielle dans la base de connaissances (sans pgvector)
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from db.db import get_connection
import os
import json
import numpy as np
import requests

def get_available_themes() -> list:
    """Retourne la liste des thèmes/titres disponibles dans la base RAG"""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT DISTINCT titre 
            FROM rag_knowledge 
            ORDER BY titre
        """)
        themes = [row[0] for row in cur.fetchall()]
        return themes
    except Exception as e:
        print(f"Erreur lors de la récupération des thèmes : {e}")
        return []
    finally:
        cur.close()
        conn.close()

def search_by_theme(titre: str) -> dict:
    """
    Récupère tous les chunks d'un thème spécifique par titre
    
    Args:
        titre (str): Titre/identifiant du thème
    
    Returns:
        dict: {
            "theme": str,
            "chunks": list,
            "total_chunks": int
        }
    """
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT titre, chunk_text, created_at
            FROM rag_knowledge
            WHERE titre = %s
            ORDER BY id
        """, (titre,))
        
        rows = cur.fetchall()
        chunks = [row["chunk_text"] for row in rows]
        
        return {
            "theme": titre,
            "chunks": chunks,
            "total_chunks": len(chunks)
        }
    except Exception as e:
        print(f"Erreur lors de la recherche par thème : {e}")
        return {
            "theme": titre,
            "chunks": [],
            "total_chunks": 0,
            "error": str(e)
        }
    finally:
        cur.close()
        conn.close()

def semantic_search(query: str, limit: int = 5) -> dict:
    """
    Recherche sémantique par similarité vectorielle (calculée en Python)
    
    Args:
        query (str): Question/requête de l'utilisateur
        limit (int): Nombre de résultats à retourner
    
    Returns:
        dict: {
            "query": str,
            "results": list,
            "total_results": int
        }
    """
    from dotenv import load_dotenv
    
    load_dotenv()
    
    # Générer l'embedding de la requête via API REST
    api_key = os.getenv("GOOGLE_API_KEY")
    # Utiliser le modèle Gemini Embedding 001 (actuel)
    model_name = "gemini-embedding-001"
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:embedContent?key={api_key}"
    
    headers = {"Content-Type": "application/json"}
    data = {
        "content": {
            "parts": [{"text": query}]
        },
        "taskType": "retrieval_query"
    }
    
    response = requests.post(url, json=data, headers=headers)
    response.raise_for_status()
    
    result = response.json()
    query_embedding = np.array(result["embedding"]["values"])
    
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Récupérer tous les chunks avec leurs embeddings
        cur.execute("""
            SELECT titre, chunk_text, embedding
            FROM rag_knowledge
        """)
        
        rows = cur.fetchall()
        
        # Calculer la similarité cosine pour chaque chunk
        results = []
        for row in rows:
            # L'embedding est déjà désérialisé par psycopg2 (list)
            chunk_embedding = np.array(row["embedding"])
            
            # Calculer la similarité cosine
            similarity = np.dot(query_embedding, chunk_embedding) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(chunk_embedding)
            )
            
            results.append({
                "titre": row["titre"],
                "chunk": row["chunk_text"],
                "similarity": float(similarity)
            })
        
        # Trier par similarité et prendre les top N
        results.sort(key=lambda x: x["similarity"], reverse=True)
        results = results[:limit]
        
        return {
            "query": query,
            "results": results,
            "total_results": len(results)
        }
    except Exception as e:
        print(f"Erreur lors de la recherche sémantique : {e}")
        return {
            "query": query,
            "results": [],
            "total_results": 0,
            "error": str(e)
        }
    finally:
        cur.close()
        conn.close()
