"""
Initialisation de la base de données RAG (sans pgvector - stockage JSON)
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from db.db import get_connection

def init_rag_table():
    """Crée la table rag_knowledge avec stockage JSON des embeddings"""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # Créer la table rag_knowledge
        cur.execute("""
            CREATE TABLE IF NOT EXISTS rag_knowledge (
                id SERIAL PRIMARY KEY,
                titre VARCHAR(255) NOT NULL,
                chunk_text TEXT NOT NULL,
                embedding JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Créer un index sur la colonne titre pour filtrer par thème
        cur.execute("""
            CREATE INDEX IF NOT EXISTS rag_knowledge_titre_idx 
            ON rag_knowledge (titre)
        """)
        
        conn.commit()
        print("Table rag_knowledge créée avec succès (stockage JSON)")
        
    except Exception as e:
        conn.rollback()
        print(f"Erreur lors de la création de la table : {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    init_rag_table()
