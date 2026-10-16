"""
Test script for current RAG system (with JSONB)
Tests functions after chunk ingestion.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from rag.rag_engine import get_available_themes, search_by_theme, semantic_search


def test_get_themes():
    """Tests retrieval of available themes"""
    themes = get_available_themes()
    print(f"Number of themes: {len(themes)}")
    print("\nAvailable themes:")
    for i, theme in enumerate(themes, 1):
        print(f"  {i}. {theme}")
    
    return themes


def test_search_by_theme(titre: str):
    """Tests search by theme"""
    
    result = search_by_theme(titre)
    
    print(f"Theme: {result['theme']}")
    print(f"Number of chunks: {result['total_chunks']}")
    
    if result['chunks']:
        print("\nChunk content:")
        for i, chunk in enumerate(result['chunks'], 1):
            print(f"\n--- Chunk {i} ---")
            print(chunk[:200] + "..." if len(chunk) > 200 else chunk)
    
    return result


def test_semantic_search(query: str, limit: int = 3):
    """Tests semantic search"""
    
    result = semantic_search(query, limit)
    
    print(f"Query: {result['query']}")
    print(f"Number of results: {result['total_results']}")
    
    if result['results']:
        print("\nResults:")
        for i, item in enumerate(result['results'], 1):
            print(f"\n--- Result {i} ---")
            print(f"Title: {item['titre']}")
            print(f"Similarity: {item['similarity']:.4f}")
            print(f"Chunk: {item['chunk'][:150]}...")
    
    return result


def main():
    """Main test function"""
    
    # Test 1: Retrieve themes
    themes = test_get_themes()
    if not themes:
        print("\n✗ No theme found. Verify that ingestion has been done.")
        return
    # Test 2: Search by theme
    test_search_by_theme("Taux de Pénétration - Définition")
    # Test 3: Semantic search
    test_semantic_search("Comment calculer le taux de pénétration ?", limit=3)
    # Test 4: Another semantic search
    test_semantic_search("Qu'est-ce que la vitesse des ventes ?", limit=2)



if __name__ == "__main__":
    main()
