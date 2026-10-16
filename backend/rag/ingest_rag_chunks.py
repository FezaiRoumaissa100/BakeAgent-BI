"""
Ingestion des chunks RAG avec embeddings Gemini
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import requests
from dotenv import load_dotenv
import os
import sys

# Charger la clé API
load_dotenv()

# Données des chunks avec leurs titres/identifiants
CHUNKS_DATA = [
    {
        "titre": "Contexte et Problématique",
        "chunk": """Chunk 1 : Contexte, Problématique et Proposition de Valeur
- Le secteur du commerce de détail connaît une transformation radicale impulsée par les données et l'intelligence artificielle.
- Les commerçants font face à quatre problèmes principaux : les stocks dormants bloquant la trésorerie, un panier moyen trop faible, des ruptures de stock soudaines sur les produits phares, et des promotions ponctuelles érodant les marges.
- L'objectif du système est de transformer les données en profits mesurables en analysant la performance, détectant les relations d'achat et prédisant la demande future.
- La proposition de valeur permet de répondre à la question : "Quel a été l'impact de mes décisions en matière de gestion des stocks et de prix ce mois-ci ?".
- Le système génère des décisions basées sur les données pour améliorer la trésorerie, accroître le chiffre d'affaires, et réduire le gaspillage ainsi que les remises arbitraires."""
    },
    {
        "titre": "Taux de Pénétration - Définition",
        "chunk": """Chunk 2 : Le Taux de Pénétration - Définition et Architecture
- Le taux de pénétration ne mesure pas le volume des ventes traditionnel, mais la diffusion comportementale (Behavioral Spread) d'un produit.
- Il représente la probabilité statistique qu'un produit spécifique se trouve dans le panier d'un client aléatoire.
- Cet indicateur est un "filtre de vérité" car il distingue un produit acheté parce qu'il est "aimé" d'un produit acheté parce qu'il est "bradé".
- Une baisse du taux de pénétration d'un produit phare est le premier signal d'alarme ("Health Metric") avant la chute des revenus.
- L'architecture des données est "Privacy-Friendly", basée sur les tickets de caisse (Points de Vente) sans utiliser de Customer ID, ce qui est conforme au RGPD.
- La formule est : Taux de pénétration (%) = (Nombre de tickets contenant le produit / Nombre total de tickets uniques) × 100.
- Lors du nettoyage des données, un dédoublonnage intra-ticket est appliqué : si un client achète 5 bouteilles de lait dans le même ticket, cela compte pour une seule décision d'achat binaire."""
    },
    {
        "titre": "Taux de Pénétration - Interprétation",
        "chunk": """Chunk 3 : Interprétation et Moteur Décisionnel du Taux de Pénétration
- Le "Produit Leader" (Haute Pénétration) est présent dans la majorité des tickets et fait partie de la routine d'achat.
- Le "Produit Invisible" (Faible Pénétration) est rarement choisi et sa présence est anecdotique.
- Le "Générateur de Trafic" (Traffic Builder) est un produit très populaire acheté à l'unité (ex: Eau, Chewing-gum).
- Le "Produit de Niche" a une faible pénétration mais est acheté en grandes quantités par peu de clients (ex: Produits pour animaux).
- Optimisation des Stocks : Pour les produits à haute pénétration, le seuil de "Stock de Sécurité" est augmenté pour éviter toute rupture, car leur absence frustre la majorité des clients.
- Allocation d'Espace : Un produit présent dans de nombreux tickets mérite un emplacement au "Niveau des Yeux" (Eye Level) ou en tête de gondole.
- Efficacité Promotionnelle : Il ne faut jamais appliquer de rabais agressif sur un produit à haute pénétration sans raison, sous peine de détruire la marge sur des ventes assurées."""
    },
    {
        "titre": "Taux de Pénétration - Études de Cas",
        "chunk": """Chunk 4 : Étude de Cas du Taux de Pénétration (Exemples Métier)
- Le système dévoile l'"Illusion du Volume" : un Produit A (1000 unités sur 1000 tickets) est fort et durable, tandis qu'un Produit B (1000 unités sur 50 tickets) est à risque car il dépend d'une minorité.
- Dans l'analyse des résultats d'un magasin, le "Pain" (Pénétration de 66.67%) est le leader absolu et le moteur de trafic ; une rupture de stock y est critique.
- Le "Lait" (Pénétration de 50%) est un produit pilier acheté par un client sur deux.
- Le "Savon" (produit peu cher) et le "PC Portable" (produit cher) peuvent avoir exactement le même score de pénétration (16.67%) car cet indicateur mesure la popularité comportementale, pas la valeur monétaire.
- Bien que le PC Portable génère plus de chiffre d'affaires, son taux de pénétration est faible, tandis que le pain est le véritable moteur de trafic (Traffic Driver)."""
    },
    {
        "titre": "Vitesse des Ventes",
        "chunk": """Chunk 5 : Ingénierie de la Vitesse des Ventes (Sales Velocity)
- Le système utilise une "Granularité Adaptative" avec une approche à Double Couche : la vitesse stratégique et la vitesse opérationnelle.
- La Vitesse Stratégique (Macro-Velocity) sert à gérer la chaîne d'approvisionnement (Supply Chain).
- L'indicateur Macro est le SPPD (Sales Per Product Per Day) : Quantité Totale Vendue / Nombre de Jours de Vente Actifs.
- Le SPPD permet de générer une recommandation de Stock de Sécurité, par exemple pour couvrir 2 jours de vente.
- La Vitesse Opérationnelle (Micro-Velocity) gère la disponibilité en rayon et évite la "Rupture de Stock Intra-journalière".
- Un rayon vide à 18h00 signifie une perte de chiffre d'affaires, justifiant l'utilisation du Profilage Horaire (Hourly Profiling).
- La formule Micro est : Hourly Velocity = Quantité Totale Vendue / Nombre Total d'Heures d'Activité.
- L'algorithme extrait l'heure critique (Pic maximal / Burst Hour) pour chaque produit afin d'anticiper le remplissage."""
    },
    {
        "titre": "Matrice de Décision",
        "chunk": """Chunk 6 : La Matrice de Décision Intégrée (Pénétration croisée à la Vélocité)
- Les "Stars" (Leaders) cumulent une pénétration élevée et une vélocité élevée : la priorité est critique ("Zéro Rupture") avec des alertes horaires.
- Les produits de "Niche" ont une pénétration faible mais une vélocité élevée : l'action est de stocker pour les clients fidèles qui génèrent de gros volumes.
- Les "Traffic Builders" ont une pénétration élevée et une vélocité faible : ils doivent être placés en tête de gondole pour attirer, avec un stock modéré.
- Le "Dead Stock" (Stock Dormant) a une pénétration et une vélocité faibles, justifiant un arrêt des commandes et un déstockage.
- Exemple de classification par le système : Le Pain est classé "Star" car tout le monde l'achète en grande quantité, déclenchant une alerte pour remplir le rayon avant son pic de 18h00.
- Les Croquettes sont classées "Niche" car achetées en gros volume mais par peu de gens, tandis que le Sel est un "Générateur de Trafic" au flux stable."""
    },
    {
        "titre": "Contribution au Ticket",
        "chunk": """Chunk 7 : Contribution au Ticket (Ticket Contribution)
- La contribution au ticket mesure le poids financier d'un produit dans le panier (l'emprise financière sur le portefeuille du client).
- La formule est : Contribution (%) = (Prix Unitaire x Quantité / Valeur Totale du Ticket) x 100.
- Cet indicateur identifie le "Produit Moteur" (Basket Driver), qui est la raison principale de la visite (ex: un Laptop contribuant à 95,69% du ticket).
- Il identifie aussi les "Produits de Complément" (Basket Fillers), qui sont des accessoires périphériques augmentant la marge (ex: une souris à 2,39% et un câble à 1,91%).
- Le système classe automatiquement les produits entre "Générateurs de Chiffre" nécessitant un stock critique et "Accessoires" nécessitant un bon placement pour l'achat d'impulsion."""
    },
    {
        "titre": "Fréquence de Rachat",
        "chunk": """Chunk 8 : Fréquence de Rachat (Repurchase Frequency)
- Cet indicateur mesure la loyauté comportementale du marché envers le produit (le rythme/l'habitude) sans avoir besoin d'identifiant client.
- La formule est : Repurchase (%) = (Nombre de Semaines avec Vente / Total Semaines) * 100.
- Un score de 100% indique un produit quotidien de base (Lait, Pain) dont la disparition du ticket est une anomalie grave.
- Un score de 25% indique un achat occasionnel ou durable (ex: TV, Électroménager).
- Une chute soudaine de 100% à 50% sur un produit régulier indique un problème potentiel de qualité ou de prix."""
    },
    {
        "titre": "Règles d'Association",
        "chunk": """Chunk 9 : Analyse du Panier & Règles d'Association (Algorithme Apriori)
- Le Market Basket Analysis cherche à découvrir l'ADN des achats groupés, sachant que les produits vivent en "communautés".
- L'algorithme Apriori scanne les factures pour trouver des motifs fréquents (Frequent Patterns).
- La métrique clé est le Lift : Probabilité (A et B) / [Probabilité(A) x Probabilité(B)].
- Si le Lift est = 1, la relation relève du hasard ; s'il est > 1, les produits s'attirent (Association) ; s'il est < 1, ils se repoussent (Substituts).
- Exemple : Si l'antécédent est "Céréales" et le conséquent "Lait" avec un support de 0.6, cela signifie que cette combinaison apparaît dans 60% des transactions.
- Si la confiance de ce duo est de 1.0, cela signifie que dans 100% des cas où il y a des céréales, il y a du lait.
- Si le Lift est de 1.25, la présence de céréales augmente de 25% la probabilité d'acheter du lait.
- Application métier : Créer du Cross-Merchandising (placer ces produits côte à côte) ou des offres de Bundling ("Achetez 2 paquets de Céréales, le Lait est offert")."""
    },
    {
        "titre": "Prévision de la Demande",
        "chunk": """Chunk 10 : Prévision de la Demande (Demand Forecasting)
- La prévision de la demande permet de passer d'une gestion de stock réactive à une gestion proactive en anticipant les besoins sur 14 jours.
- L'approche mathématique utilise la décomposition des séries temporelles (Time Series Decomposition) via le modèle Meta Prophet.
- L'équation fondamentale est y = g + s + h + et (où 'y' est la prédiction, 'g' la tendance, 's' la saisonnalité, 'h' les événements/jours fériés, et 'et' le bruit aléatoire).
- Prophet a été choisi par rapport à ARIMA (trop rigide) et LSTM (trop gourmand en ressources) car il gère nativement les jours fériés et est robuste aux données manquantes.
- L'algorithme fournit un intervalle de probabilité avec une valeur pessimiste (yhat_lower) et optimiste (yhat_upper) pour alerter sur un risque de rupture imminent si le stock tombe sous le seuil pessimiste.
- Synergie système : Apriori indique quels produits promouvoir, et Prophet assure qu'il y aura suffisamment de stock pour assumer la demande générée."""
    },
    {
        "titre": "KPIs et Succès du Projet",
        "chunk": """Chunk 11 : Indicateurs de Performance (KPIs) et Succès du Projet
- Le système doit avoir une erreur moyenne absolue en pourcentage (MAPE/MAE) de prédiction Prophet inférieure à 15-20% sur un horizon de 14 jours.
- L'interface Dashboard doit charger les visualisations en moins de 3 secondes.
- Les impacts métier (Retail Impact) mesurés sont : la réduction des ruptures de stock anticipées 48h à l'avance, l'optimisation du stock dormant pour libérer de la trésorerie, et l'augmentation du panier moyen par les ventes croisées."""
    }
]

def get_embedding(text: str) -> list:
    """Génère un embedding avec Gemini via API REST"""
    api_key = os.getenv("GOOGLE_API_KEY")
    # Utiliser le modèle Gemini Embedding 001 (actuel)
    model_name = "gemini-embedding-001"
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:embedContent?key={api_key}"
    
    headers = {"Content-Type": "application/json"}
    data = {
        "content": {
            "parts": [{"text": text}]
        },
        "taskType": "retrieval_document"
    }
    
    response = requests.post(url, json=data, headers=headers)
    response.raise_for_status()
    
    result = response.json()
    return result["embedding"]["values"]

def ingest_chunks():
    """Ingeste les chunks dans PostgreSQL avec leurs embeddings"""
    from db.db import get_connection
    
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        for data in CHUNKS_DATA:
            titre = data["titre"]
            chunk_text = data["chunk"]
            
            print(f"Génération de l'embedding pour : {titre}")
            embedding = get_embedding(chunk_text)
            
            # Insérer dans la base (embedding en JSON)
            import json
            cur.execute("""
                INSERT INTO rag_knowledge (titre, chunk_text, embedding)
                VALUES (%s, %s, %s)
            """, (titre, chunk_text, json.dumps(embedding)))
            
            print(f"Chunk inséré : {titre}")
        
        conn.commit()
        print(f"\n{len(CHUNKS_DATA)} chunks ingérés avec succes")
        
    except Exception as e:
        conn.rollback()
        print(f"Erreur lors de l'ingestion : {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    ingest_chunks()
