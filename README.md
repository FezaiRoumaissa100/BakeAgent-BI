# Design d'un Systeme de Gestion Commerciale Intelligent — Boulangerie, Agentique & BI

> Plateforme d'intelligence decisionnelle et agent autonome dedie a une boulangerie.  
> Architecture Next.js 16 / FastAPI / PostgreSQL 16.  
> **Source de donnees active: Fichier Pickle `retail_data.pkl`** (validation 1:1 PostgreSQL effectuee, bascule backend en preparation).

---

## 1. But et description du projet

Ce systeme transforme un systeme d'information decisionnel classique (BI traditionnel) en une plateforme **agentique** dediee a la gestion d'une **boulangerie**. Il est concu pour analyser l'activite quotidienne sur des donnees historiques, produire des previsions de demande (Prophet), identifier des associations entre pains, patisseries et autres produits (Apriori) et generer des alertes sur les niveaux de stock intelligentes. Les informations specifiques a un etablissement (nom, localisation, adresse, contact) sont configurees dans un fichier central de branding sans modifier le coeur du systeme.

Cas d'usage couverts:
- **Vue du Jour** — suivi en temps réel du CA, des tickets et du rythme horaire
- **Performance** — évolution du CA mensuel, saisonnalité, top produits (Pareto 80/20), treemap catégories
- **Analyse Produits** — pénétration, vélocité de vente, contribution au ticket, fréquence de rachat, règles d'association
- **Prévisions Ventes** — modèle Prophet unique (horizons 7/14/30 jours, intervalle de confiance, MAPE par horizon)
- **Alertes & Stock** — statut RUPTURE / VIGILANCE / NORMAL / SURSTOCK / FERMÉ, recommandations commandes

Identité visuelle: style **boulangerie moderne** — tons chauds orange #E8734A, crème #FDF6EC, design sobre.

---

## 2. Organisation des dossiers

```
retail-intelligence-agent/
├── existing_bi/      Projet de reference — BI Streamlit historique + source de donnees
│
├── frontend/         Dashboard nouvelle generation — Next.js 16 App Router
│
├── backend/          API REST metier — FastAPI + calculs Pandas
│
├── BD/               Scripts et documentation migration PostgreSQL 16
│
├── analyse.ipynb     Notebook d'exploration (historique)
└── .gitignore
```

### existing_bi/
Contient le projet BI Streamlit d'origine et la source de donnees principale.
- **Application Streamlit 9 pages** (Acceuil + pages d'analyse commerciale: performance, penetration, velocite, matrice de decision, contribution ticket, frequence rachat, market basket Apriori, previsions Prophet, alertes stock).
- **`retail_data.pkl`** : Fichier source **actif** (36 MB, 225 865 lignes transactions + 8 tables precalculees). Ce fichier est la veritable source de verite pendant la phase de stabilisation.
- Scripts utilitaires d'inspection du jeu de donnees et styles Streamlit.

### frontend/
Interface utilisateur web moderne construite sur Next.js 16 (App Router, React Server Components) + Tailwind CSS.
- **5 pages routées**: Vue du Jour (`/`), Performance, Analyse Produits (5 onglets), Previsions, Alertes & Stock.
- **Composants UI reutilisables**: Sidebar navigation, barre superieure Navbar, cartes KPIs, Hero analytics.
- **Design System "boulangerie moderne"** implemente en CSS global + classes utilitaires.
- Couche API centralisee (fetch vers backend 127.0.0.1:8000, cache desactive).
- Branding et metadonnees centralises dans un fichier de configuration.

### backend/
API REST Python construite avec FastAPI. Expose 9 endpoints metier consommés par le frontend.
- **Chargement des donnees au demarrage**: lecture du fichier Pickle `retail_data.pkl`.
- **6 modules de calcul metier**: Vue du Jour (KPIs horaires, top produits, combinaisons Apriori du jour), Performance commerciale (evolution CA, top N, saisonnalite, categories), Produits (penetration, velocite, contribution ticket, frequence, associations Apriori historiques), Previsions Prophet horizons 7/14/30 jours, Alertes stock estivales.
- Tous les calculs sont effectues cote backend. Le frontend n'effectue que des arrangements visuels et des pourcentages d'affichage.

### BD/
Ensemble des artefacts de migration vers PostgreSQL 16. Une description detaillee de chaque fichier est disponible dans la section **Installation PostgreSQL** de ce README.
- **`schema.sql`**: Definition du Star Schema (14 tables: dimensions, faits, resultats ML precalcules, agregats).
- **`001_import_from_pkl.py`**: Script unique d'import en masse depuis le Pickle vers PostgreSQL.
- **`002_verify_after_import.sql`**: Requetes SQL de verification 1:1 a comparer avec l'audit de reference.
- **`verify_checklist.py`**: Script Python qui valide automatiquement les 11 criteres d'acceptation de l'Annexe C (resultat actuel: 8/11 verifies, 3 en attente de la bascule backend).
- **`audit_migration_postgresql.md`**: Audit de reference pre-migration — tous les chiffres, plages, distributions du jeu de donnees Pickle a reproduire a l'identique dans PostgreSQL.

---


## 3. Installation — Étape par étape

### Pré-requis système
- **Windows** (environnement de développement confirmé)
- **Python 3.11 ou 3.12** (PATH activé pendant installation)
- **Node.js 20+ LTS** (inclut npm)
- **PostgreSQL 16** — port 5432

---

### 4.1 Installer les dépendances Backend Python

```powershell
# Installer les packages nécessaires
pip install fastapi uvicorn pandas numpy
pip install psycopg2-binary sqlalchemy   # Pour migration PostgreSQL seulement
```

---

### 4.2 Installer les dépendances Frontend Next.js

```powershell
cd frontend
npm install
```

---

### 4.3 PostgreSQL 16 (Migration / Validation uniquement)

#### 4.3.1 Créer la base `retail_db`

- Ouvrir **pgAdmin 4** ou DBeaver
- Se connecter au serveur local `127.0.0.1:5432` avec `postgres / mdp`
- Créer nouvelle base: `CREATE DATABASE retail_db OWNER postgres;`

#### 4.3.2 Exécuter le schéma Star Schema 14 tables

Dans pgAdmin Query Tool sur `retail_db`, coller/exécuter le contenu de:
- [`BD/schema.sql`]

Ordre exécution: DIM (5 tables) → FACT → Tables ML précalculées. Contraintes FK et index sont créés automatiquement.

#### 4.3.3 Importer les données depuis le Pickle

```powershell
# Depuis le dossier racine retail-intelligence-agent
python BD\001_import_from_pkl.py
```

Ce script charge `retail_data.pkl` puis insère:
- `fact_ticket_lines`: 225 865 lignes (chunks 20 000)
- 5 tables DIM + 8 tables ML/agrégats

Attendu en sortie: `[TERMINE] Migration terminee avec succes.`

#### 4.3.4 Valider la migration (11 critères Annexe C)

```powershell
python BD\verify_checklist.py
```

**Résultat actuel attendu**: `8/11 VERIFIES` — les 3 critères EN ATTENTE concernent la **bascule code backend FastAPI** (filtres, contrats endpoints, rendu frontend PG vs PKL). Voir section §6.

Alternative SQL dans pgAdmin: exécuter [`BD/002_verify_after_import.sql`](retail-intelligence-agent/BD/002_verify_after_import.sql) et comparer avec `BD/audit_migration_postgresql.md §3`.

---

## 5. Lancer l'application

### Étape 1 — Lancer le Backend FastAPI (Terminal 1)

```powershell
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### Étape 2 — Lancer le Frontend Next.js (Terminal 2)

```powershell
cd "retail-intelligence-agent\frontend"
npm run dev
```
---

## 6. Source de données active & Roadmap

### Source actuelle (stable — production)

**Toute l'application tourne actuellement exclusivement sur le fichier Pickle:**
```
existing_bi/boulangerie-performance--main/retail_data.pkl
  ├── df_clean         225 865 lignes transactions (19 colonnes)
  ├── df_penetration   145 produits × pénétration × statut stratégique
  ├── df_macro         145 produits × vélocité × stock sécurité
  ├── regles           50 règles Apriori × 16 métriques
  ├── forecast_14j     14 jours Prophet (J+1 → J+14)
  ├── forecast_saison  122 jours Juin–Septembre 2026
  ├── daily_data       620 jours agrégats
  ├── ca_mensuel       24 mois CA
  └── mdape_cv         Erreur Prophet cross-val: 20,927 606 %
