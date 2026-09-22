# 🥐 Retail Intelligence System — Boulangerie Le Croisic
## Rapport Détaillé d'Architecture, Fonctionnalités et Buts Métier
**Projet de Fin d'Études (PFE 2026)**  
**Auteure :** Mariem Dridi  
**Application :** Dashboard d'aide à la décision pour le commerce de détail alimentaire (Boulangerie-Pâtisserie artisanale)

---

## 🎯 1. Pour quel But ce Projet a-t-il été Conçu ? (Objectifs & Enjeux Métier)

Dans le secteur de la boulangerie artisanale, la gestion quotidienne repose historiquement sur l'intuition du boulanger ou de l'artisan (estimation "au doigt mouillé" de la pâte à pétrir le matin). Cette approche empirique engendre deux risques majeurs et coûteux :
1. **Le sur-stockage et le gaspillage alimentaire :** Les baguettes et viennoiseries sont des produits ultra-frais périssables le jour même (durée de vie < 24h). Tout invendu en fin de journée constitue une perte sèche de matière première, d'énergie de cuisson et de main-d'œuvre.
2. **La rupture de stock (sous-stockage) :** Manquer de baguette de tradition ou de croissants à 8h du matin ou à 17h provoque une perte immédiate de chiffre d'affaires, pousse les clients vers la concurrence et dégrade l'image de marque.
3. **Le manque d'optimisation du panier client :** Sans connaissance analytique des associations d'achats (cross-selling), l'artisan ne sait pas quelles formules proposer ni comment organiser l'étalage en magasin pour maximiser la rentabilité.
4. **La forte saisonnalité touristique :** Située au **Croisic (Loire-Atlantique, Bretagne)**, la boulangerie subit une variabilité extrême entre la basse saison hivernale et la haute saison estivale où l'afflux touristique multiplie la fréquentation par 2 à 4.

### 🏆 Objectif Global de l'Application
Ce système a été créé pour transformer des **données brutes d'encaissement (tickets de caisse POS)** en un **outil d'aide à la décision stratégique et opérationnelle ("Retail Intelligence")**. Il permet au boulanger-artisan :
- De **planifier précisément la production quotidienne** grâce à l'Intelligence Artificielle prédictive.
- D'**ajuster les stocks en flux tendu** pour réduire les invendus sans jamais tomber en rupture sur les produits clés.
- De **classifier scientifiquement le catalogue de produits** selon leur comportement d'achat (pénétration, contribution, récurrence).
- De **découvrir des opportunités de vente croisée (cross-selling)** pour augmenter la valeur du panier moyen.

---

## 📊 2. Données et Période d'Étude

- **Source des données :** Historique réel des ventes de la Boulangerie Le Croisic.
- **Période analysée :** 2024 à 2025 (2 années complètes consécutives).
- **Volume :** Plus de **131 315 tickets de caisse** et des centaines de milliers de lignes de transactions.
- **Catalogue :** Environ **145 références d'articles** réparties en catégories (Pains, Baguettes, Viennoiseries, Pâtisseries, Sandwichs/Snacking, Boissons, etc.).
- **Enrichissement calendaire :** Intégration de **98 événements exogènes** (jours fériés français, vacances scolaires des trois zones, ponts, Pâques, Noël/Jour de l'An, et pics touristiques de juillet-août).

---

## 🏗️ 3. Architecture Technique du Code

Le projet est structuré comme une application web interactive multi-pages développée en **Python** avec le framework **Streamlit** :

```
boulangerie-performance/
│
├── Acceuil.py                             # Point d'entrée principal (Hub vitrine & menu)
├── style.py                               # Charte graphique artisanale & composants CSS
├── retail_data.pkl                        # Jeu de données prétraité & modèles pré-calculés
├── Retail_Final_Mariem_Dridi (8) (1).ipynb # Notebook Jupyter de R&D, nettoyage et modélisation
│
└── pages/
    ├── 1-Analyse_Commerciale.py           # Analyse du CA, Pareto, saisonnalité & horaires
    ├── 2-Penetration.py                   # Taux de pénétration & classification comportementale
    ├── 3-Matrice_de_décision.py           # Matrice stratégique Stars / Niche / Trafic / Dormant
    ├── 3-Sales_Velocity.py                # Vitesse de rotation des ventes & stock tampon
    ├── 4-ticket_contribution.py           # Poids du produit dans le montant du panier
    ├── 5_Repurchase_Frequency.py          # Loyauté et fréquence de réachat hebdomadaire
    ├── 6-Market_Basket_Analysis_.py       # Algorithme Apriori & règles d'association
    ├── 7_Demand_Forecasting.py            # Prévision à 14 jours via Facebook Prophet
    ├── 8-Alertes_Stock.py                 # Système d'alertes temps réel sur les stocks
    └── 9_Retail_Intelligence_Dashboard.py # Cockpit exécutif de synthèse décisionnelle
```

---

## 🔍 4. Description Détaillée de Chaque Module

### 🏠 Module 0 : `Acceuil.py` & `style.py` (La Vitrine Décisionnelle)
- **Ce qu'il fait :** 
  - Présente l'application sous l'esthétique d'un **menu de boulangerie artisanale française** (palette beige farine, doré croûte de pain, brun chocolat, typographies serif *Playfair Display* et *DM Sans*).
  - Charge en mémoire via `@st.cache_data` les données pré-calculées contenues dans `retail_data.pkl`.
  - Calcule et affiche en temps réel les **5 indicateurs macro-économiques fondamentaux** :
    - Chiffre d'Affaires total (en k€).
    - Nombre total de tickets enregistrés.
    - Panier moyen (en € par visite).
    - Taux de croissance annuel (2025 vs 2024).
    - Nombre de références actives et jours d'activité.
  - Offre un sommaire interactif orientant l'utilisateur vers les différents axes d'analyse.

---

### 📈 Module 1 : `1-Analyse_Commerciale.py` (CA, Saisonnalité & Catégories)
- **Ce qu'il fait :**
  - **Évolution temporelle du CA :** Graphique interactif mensuel avec couloir de volatilité statistique ($\pm 1$ écart-type $\sigma$), identification automatique des mois records (MAX en été) et des creux d'hiver (MIN).
  - **Comparatif 2024 vs 2025 :** Comparaison mois par mois pour quantifier la progression réelle d'une année sur l'autre.
  - **Principe de Pareto (Loi des 80/20) :** Classement des meilleurs produits et calcul de la part cumulée de CA afin de prouver quels 20% d'articles génèrent 80% du revenu.
  - **Décomposition calendaire & horaire :** 
    - Revenus cumulés et moyens par jour de la semaine (lundi au dimanche) pour calibrer l'ouverture du fournil.
    - Courbe horaire d'affluence (tickets et CA par heure) montrant les trois vagues : petit-déjeuner (7h-9h), déjeuner (12h-13h) et sortie d'école/travail (16h-19h).
  - **Treemap des catégories :** Visualisation hiérarchique de l'apport de chaque famille de produits dans le chiffre d'affaires global.

---

### 🎯 Module 2 : `2-Penetration.py` (Taux de Pénétration Comportementale)
- **Ce qu'il fait :**
  - Mesure le **taux de pénétration** : $\text{Taux} = \frac{\text{Nombre de tickets contenant le produit}}{\text{Nombre total de tickets}} \times 100$.
  - **Segmentation stratégique en 5 paliers :**
    - ⭐ **Produit Phare (> 20%)** : Dominance absolue (ex. *Traditional Baguette*).
    - 🏆 **Leader (5% – 20%)** : Piliers incontournables du magasin (ex. *Coupe*, *Croissant*, *Pain au chocolat*).
    - 🎯 **Produit Coeur / Core (2% – 5%)** : Produits stables générant la fidélité.
    - 📦 **Produit Régulier (0.5% – 2%)** : Ventes secondaires régulières.
    - 🔍 **Produit de Niche (< 0.5%)** : Produits spécialisés ou à surveiller.
  - **Analyse de tendances dynamiques :** Calcul des moyennes mobiles à 4 semaines (MM4) et de la pente de régression linéaire sur 12 semaines pour détecter si un produit est en croissance ($\uparrow$), stable ($\rightarrow$) ou en perte de vitesse ($\downarrow$).
  - **Règles d'or promotionnelles :** Conseils automatiques interdisant formellement de faire des remises sur les produits phares/leaders (destruction pure de marge sans gain de trafic) et conseillant des promotions ciblées sur les produits *Core*.

---

### 🧠 Module 3 : `3-Matrice_de_décision.py` (Matrice Stratégique 4 Quadrants)
- **Ce qu'il fait :**
  - Croise simultanément la **Pénétration (% de présence dans les tickets)** et la **Contribution Ticket (% de valeur financière)**.
  - Classe l'ensemble du catalogue en 4 quadrants opérationnels :
    1. **Stars (Indispensables) :** Forte pénétration + Forte contribution $\rightarrow$ Priorité absolue, tolérance zéro rupture.
    2. **Générateurs de Trafic :** Forte pénétration + Faible contribution $\rightarrow$ Attirent le client dans la boutique (ex. baguette classique, café).
    3. **Niches Rentables :** Faible pénétration + Forte contribution $\rightarrow$ Pâtisseries de fête, pièces montées, gâteaux familiaux.
    4. **Stock Dormant (Dead Stock) :** Faible pénétration + Faible contribution $\rightarrow$ Produits à éliminer ou à remplacer pour libérer de l'espace.

---

### ⚡ Module 4 : `3-Sales_Velocity.py` (Vitesse de Rotation & Stocks Tampons)
- **Ce qu'il fait :**
  - Calcule la vitesse d'écoulement unitaire par jour et par heure pour chaque produit.
  - Détermine les besoins en approvisionnement selon les temps forts de la journée (matin, midi, soir).
  - Évalue les stocks de sécurité nécessaires pour absorber les pointes de demande sans sur-stocker.

---

### 🧾 Module 5 : `4-ticket_contribution.py` (Poids Financier dans le Panier)
- **Ce qu'il fait :**
  - Analyse la part relative du prix d'un produit dans la valeur totale du ticket lors d'achats groupés (paniers multi-articles).
  - Segmente les produits en 4 catégories d'impact monétaire :
    - **Produit Ancre ($\ge 67\%$)** : Le produit représente les deux tiers ou plus du montant dépensé.
    - **Moteur du Panier ($40\% - 67\%$)** : Produit central qui justifie la venue et la dépense.
    - **Produit Complémentaire ($20\% - 40\%$)** : Achat d'impulsion ou d'accompagnement (ex. boisson avec un sandwich).
    - **Micro-contributeur ($< 20\%$)** : Petites gourmandises, bonbons, chewing-gums d'appoint à la caisse.

---

### 🔁 Module 6 : `5_Repurchase_Frequency.py` (Fréquence de Réachat & Fidélité)
- **Ce qu'il fait :**
  - Mesure la régularité d'apparition des produits sur une base hebdomadaire tout au long des 104 semaines de l'historique :
    - **Produit Quotidien (100% des semaines)** : Pain quotidien acheté invariablement chaque semaine de l'année.
    - **Produit Régulier (75% – 99%)** : Grande stabilité de consommation.
    - **Produit Cyclique (50% – 74%)** : Produits météo-dépendants ou liés aux fins de semaine.
    - **Produit Sporadique (< 50%)** : Produits événementiels ou saisonniers (ex. galette des rois en janvier, bûches en décembre).

---

### 🛒 Module 7 : `6-Market_Basket_Analysis_.py` (Association du Panier & Apriori)
- **Ce qu'il fait :**
  - Implémente l'algorithme d'apprentissage non supervisé **Apriori** pour le *Market Basket Analysis* (Fouille de règles d'association).
  - Calcule pour chaque couple d'articles :
    - **Support :** Probabilité que deux produits soient achetés ensemble.
    - **Confiance :** Probabilité conditionnelle qu'un client achète le produit B sachant qu'il a pris le produit A.
    - **Lift :** Intensité de la corrélation réelle par rapport au hasard ($Lift > 1$ indique une véritable complémentarité).
  - **Applications directes :**
    - Création de formules "Menu Midi" (Sandwich + Boisson + Pâtisserie).
    - Merchandising en magasin : placer les produits à fort *Lift* côte à côte pour stimuler les achats d'impulsion.

---

### 🔮 Module 8 : `7_Demand_Forecasting.py` (Prévision IA avec Facebook Prophet)
- **Ce qu'il fait :**
  - Embarque un modèle de séries temporelles basé sur **Facebook Prophet**.
  - Génère des **prévisions à horizon 14 jours** des volumes de ventes et du chiffre d'affaires attendu.
  - Décompose les séries temporelles en composantes explicatives :
    - Tendance de fond (croissance de la boulangerie).
    - Saisonnalité hebdomadaire (effet pic du samedi et dimanche).
    - Saisonnalité annuelle (sur-activité estivale de juillet-août au Croisic).
    - Effet des 98 jours fériés et vacances scolaires.
  - Calcule des intervalles de confiance prédictifs (`yhat_lower`, `yhat_upper`).
  - Évalue la précision du modèle par validation croisée temporelle avec la métrique robuste **MDAPE** (*Median Absolute Percentage Error*).

---

### 📦 Module 9 : `8-Alertes_Stock.py` (Gestion des Risques & Alertes Fournil)
- **Ce qu'il fait :**
  - Traduit les prévisions mathématiques de Prophet en **ordres opérationnels pour le boulanger** à J+1 et J+2.
  - Compare le stock disponible prévu avec la demande estimée pour émettre 4 niveaux de drapeaux :
    - 🔴 **RUPTURE :** Demande supérieure au stock $\rightarrow$ Risque de manquer de pain, recommandation d'augmentation de la fournée.
    - 🟠 **VIGILANCE :** Marge de sécurité faible.
    - 🟢 **NORMAL :** Équilibre offre/demande optimal.
    - 🔵 **SURSTOCK :** Risque important d'invendus $\rightarrow$ Recommandation de baisse de production pour éviter les pertes.
  - Chiffre la **marge protégée** et le **chiffre d'affaires sécurisé** grâce aux alertes.

---

### 🥐 Module 10 : `9_Retail_Intelligence_Dashboard.py` (Cockpit Exécutif)
- **Ce qu'il fait :**
  - Réunit sur un écran unique une synthèse décisionnelle à destination du chef d'entreprise / gérant.
  - Vue à 360° : KPIs financiers, prévisionnel à court terme, alertes de production du jour et meilleures associations de vente.

---

## 🔬 5. Méthodologie et Algorithmes Utilisés

| Domaine | Algorithme / Outil | Usage dans le Projet |
| :--- | :--- | :--- |
| **Séries Temporelles** | **Facebook Prophet** (additive/multiplicative) | Prévisions journalières à 14 jours avec modélisation des jours fériés et vacances |
| **Validation IA** | **Time Series Cross-Validation & MDAPE** | Évaluation rigoureuse non biaisée par les valeurs extrêmes (médiane des erreurs relatives) |
| **Data Mining** | **Algorithme Apriori** (Association Rules) | Extraction des règles d'association, calcul du Support, de la Confiance et du Lift |
| **Statistiques** | **Loi de Pareto & Régression Linéaire** | Analyse 80/20 du CA et détection des tendances d'évolution sur 12 semaines |
| **Framework Web** | **Streamlit** (Multi-page App) | Interface réactive, filtres dynamiques, génération de rapports |
| **Visualisation** | **Plotly Graph Objects & Treemap** | Graphiques financiers et comportementaux interactifs haute fidélité |

---

## 💼 6. Synthèse de la Valeur Ajoutée pour l'Utilisateur Final

En résumé, ce code ne se contente pas d'afficher des graphiques statiques : c'est un **système expert complet de pilotage commercial** qui permet à un artisan boulanger :
1. **D'économiser de l'argent :** En réduisant le gaspillage sur les produits périssables (alerte surstock).
2. **De gagner du chiffre d'affaires :** En éliminant les ruptures de stock sur les produits phares aux heures de pointe.
3. **D'augmenter le ticket moyen :** En plaçant judicieusement les produits complémentaires découverts grâce au *Market Basket Analysis*.
4. **D'anticiper la haute saison :** En préparant le personnel et les commandes de matières premières (farine, beurre, emballages) plusieurs semaines à l'avance grâce aux prévisions calendaires.
