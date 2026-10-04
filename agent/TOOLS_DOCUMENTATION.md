# Documentation des Tools - Agent Retail Intelligence

Ce document décrit tous les tools disponibles pour l'agent AI de Retail Intelligence.

---

## Table des matières

1. [Daily Tools](#daily-tools)
2. [Performance Tools](#performance-tools)
3. [Product Tools](#product-tools)
4. [Forecast Tools](#forecast-tools)
5. [Alert Tools](#alert-tools)

---

## Daily Tools

### `get_daily_kpis`

Récupère les KPIs journaliers pour une date spécifique.

**Description :**
Cette fonction retourne toutes les métriques clés d'une journée : chiffre d'affaires, nombre de tickets, panier moyen, vitesse des ventes, top produits, top combinaisons, données horaires, catégories, etc.

**Paramètres :**

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `target_date` | str (optionnel) | None | Date cible au format 'YYYY-MM-DD'. Si None, utilise la date du jour. |

**Retour :**

```python
dict: {
    "ca_jour": float,              # Chiffre d'affaires du jour en EUR
    "tickets": int,                # Nombre de tickets transactions
    "panier": float,               # Panier moyen en EUR
    "qte_jour": int,               # Quantité totale d'articles vendus
    "hourly_data": list,           # Liste des données horaires
    "heures_act": int,             # Nombre d'heures avec ventes
    "vitesse": float,              # Vitesse des ventes (articles/heure)
    "peak_h": int,                 # Heure de pointe
    "peak_qte_h": float,           # Quantité vendue à l'heure de pointe
    "ca_moy_global": float,        # CA moyen global
    "delta_vs_moy": float,         # Écart en % vs moyenne
    "top_qte": list,               # Top produits par quantité
    "top_ca": list,                # Top produits par CA
    "top_tkt": list,               # Top produits par nombre de tickets
    "categories": list,            # Liste des catégories avec leur CA
    "top_pairs": list,             # Top combinaisons de produits
    "nb_multi": int,               # Nombre de tickets multi-produits
    "nb_mono": int,                # Nombre de tickets mono-produit
    "pct_m": float,                # Pourcentage de tickets multi-produits
    "alerts_count": int,           # Nombre d'alertes
    "date_str": str,               # Date formatée
    "jour_str": str,               # Jour de la semaine
    "total_lignes": int            # Nombre total de lignes
}
```

**Structure de `hourly_data` :**
```python
[
    {
        "hour": int,           # Heure de la journée (0-23)
        "ca": float,           # CA de cette heure
        "tkt": int,            # Nombre de tickets cette heure
        "qte": float,          # Quantité vendue cette heure
        "panier_h": float,     # Panier moyen cette heure
        "heure": str,          # Heure formatée "HHh"
        "ca_cum": float        # CA cumulé jusqu'à cette heure
    }
]
```

**Structure de `top_qte`, `top_ca`, `top_tkt` :**
```python
[
    {
        "article": str,        # Nom du produit
        "quantity": float,     # Quantité vendue (pour top_qte)
        "total_revenue": float, # CA total (pour top_ca)
        "nb_tkt": int          # Nombre de tickets (pour top_tkt)
    }
]
```

**Structure de `categories` :**
```python
[
    {
        "category": str,         # Nom de la catégorie
        "total_revenue": float   # CA de la catégorie
    }
]
```

**Structure de `top_pairs` :**
```python
[
    {
        "pa": str,    # Premier produit de la paire
        "pb": str,    # Deuxième produit de la paire
        "cnt": int    # Nombre d'occurrences de cette combinaison
    }
]
```

**Exemple d'utilisation :**
```python
>>> get_daily_kpis("2025-10-02")
{
    "ca_jour": 18139.71,
    "tickets": 508,
    "panier": 35.71,
    "top_qte": [
        {"article": "BUCHE 6PERS", "quantity": 215.0},
        {"article": "BUCHE 4PERS", "quantity": 115.0}
    ],
    "top_pairs": [
        {"pa": "12 MACARON", "pb": "BUCHE 6PERS", "cnt": 33}
    ]
}
```

---

## Performance Tools

### `get_commercial_performance`

Récupère les données de performance commerciale avec filtres.

**Description :**
Cette fonction analyse la performance globale du chiffre d'affaires sur une période définie par les filtres. Elle retourne les KPIs, l'évolution mensuelle, les top produits, la saisonnalité, et les données par catégorie.

**Paramètres :**

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `annee` | str | "Toutes" | Filtre année. Options: "Toutes" ou année spécifique (ex: "2024", "2025", "2026"). Les années disponibles sont détectées automatiquement depuis la base de données. |
| `saison` | str | "Toutes" | Filtre saison. Options: "Toutes", "Printemps", "Ete", "Automne", "Hiver" |
| `mois` | str | "Tous" | Filtre mois. Options: "Tous", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre" |
| `categorie` | str | "Toutes" | Filtre catégorie. Options: "Toutes" ou nom spécifique (ex: "Patisseries", "Pains") |
| `evenement` | str | "Tous" | Filtre événement. Options: "Tous" ou nom spécifique (ex: "Fêtes", "Vacances") |

**Retour :**

```python
dict: {
    "kpis": {
        "total_ca": float,      # Chiffre d'affaires total
        "nb_tickets": int,      # Nombre total de tickets
        "panier": float,        # Panier moyen
        "nb_jours": int,        # Nombre de jours actifs
        "nb_produits": int      # Nombre de produits vendus
    },
    "monthly": {
        "series": list,         # Série temporelle mensuelle
        "moyenne": float,       # CA moyen mensuel
        "ecart_type": float,    # Écart-type du CA
        "ca_max": dict,         # CA maximum avec date_str et val
        "ca_min": dict,         # CA minimum avec date_str et val
        "amplitude": float,     # Amplitude (max - min)
        "ratio_amp": float,     # Ratio max/min
        "comp_24_25": list      # Comparaison 2024 vs 2025 par mois
    },
    "top_products": {
        "by_ca": list,          # Top par CA
        "by_qte": list,         # Top par quantité
        "by_tkt": list          # Top par tickets
    },
    "seasonality": {
        "days": list,           # Par jour de la semaine
        "hourly": list          # Par heure
    },
    "categories": list,         # Liste des catégories
    "available_filters": dict   # Filtres disponibles
}
```

**Structure de `monthly.series` :**
```python
[
    {
        "date": str,    # Date formatée
        "label": str,   # Label du mois (ex: "Oct 2025")
        "ca": float     # CA du mois
    }
]
```

**Structure de `top_products.by_ca` :**
```python
[
    {
        "article": str,         # Nom du produit
        "total_revenue": float, # CA total
        "part": float,          # Part en % du CA total
        "cumul": float          # Cumul des parts
    }
]
```

**Structure de `seasonality.days` :**
```python
[
    {
        "day": str,         # Nom du jour (Lundi, Mardi, etc.)
        "ca_total": float,  # CA total ce jour
        "ca_moyen": float   # CA moyen ce jour
    }
]
```

**Structure de `categories` :**
```python
[
    {
        "category": str,         # Nom de la catégorie
        "ca": float,              # CA de la catégorie
        "part": float,            # Part en % du CA total
        "panier": float,          # Panier moyen de la catégorie
        "tickets": int,           # Tickets de la catégorie
        "produits": int           # Nombre de produits dans la catégorie
    }
]
```

**Exemple d'utilisation :**
```python
>>> get_commercial_performance(annee="2025", categorie="Patisseries")
{
    "kpis": {
        "total_ca": 5252.01,
        "nb_tickets": 156,
        "panier": 33.67
    },
    "top_products": {
        "by_ca": [
            {"article": "BUCHE 6PERS", "total_revenue": 1548.61, "part": 29.5}
        ]
    },
    "categories": [
        {"category": "Patisseries", "ca": 5252.01, "part": 100.0}
    ]
}
```

---

## Product Tools

### `get_penetration_data`

Récupère les données de pénétration des produits.

**Description :**
La pénétration indique dans quel pourcentage de tickets un produit apparaît. C'est un indicateur clé de la popularité d'un produit.

**Paramètres :**

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `search` | str | "" | Recherche textuelle sur le nom du produit (recherche partielle). Ex: "BAGUETTE", "BUCHE" |
| `categories` | list (optionnel) | None | Liste des catégories à filtrer. Si None ou contient "Toutes", pas de filtre |
| `statuts` | list (optionnel) | None | Liste des statuts stratégiques à filtrer |
| `year` | str | "Toutes" | Année d'analyse. Options: "Toutes", "2024", "2025" |

**Retour :**

```python
dict: {
    "kpis": {
        "total_articles": int,    # Nombre total d'articles
        "pen_max": float,         # Taux de pénétration maximum
        "pen_median": float,      # Taux de pénétration médian
        "status_counts": dict     # Compte par statut stratégique
    },
    "items": list,               # Liste des produits
    "category_summary": list,    # Résumé par catégorie
    "weekly_trend": list,         # Tendance hebdomadaire
    "available_categories": list, # Catégories disponibles
    "available_statuts": list,   # Statuts disponibles
    "available_years": list      # Années disponibles
}
```

**Structure de `items` :**
```python
[
    {
        "article": str,             # Nom du produit
        "category": str,            # Catégorie du produit
        "penetration_rate": float,  # Taux de pénétration (0.0 à 1.0)
        "tickets_count": int,       # Nombre de tickets où le produit apparaît
        "ca_total": float,          # CA total du produit
        "qty_total": float,         # Quantité totale vendue
        "upt": float,               # Unités par ticket (quantité / tickets)
        "statut": str              # Statut stratégique
    }
]
```

**Exemple d'utilisation :**
```python
>>> get_penetration_data(search="BAGUETTE", year="2025")
{
    "items": [
        {
            "article": "TRADITIONAL BAGUETTE",
            "penetration_rate": 0.452,
            "tickets_count": 230,
            "ca_total": 12450.0,
            "statut": "Star"
        }
    ]
}
```

---

### `get_sales_velocity`

Récupère les données de vitesse de vente des produits.

**Description :**
La vitesse de vente indique combien d'articles sont vendus par jour en moyenne. C'est crucial pour la gestion des stocks et le réapprovisionnement.

**Paramètres :**
Aucun paramètre (vue globale).

**Retour :**

```python
dict: {
    "dow_velocity": list,           # Vitesse par jour de la semaine
    "macro_items": list,            # Liste des produits avec leur vélocité
    "hourly_distribution": list     # Distribution horaire
}
```

**Structure de `dow_velocity` :**
```python
[
    {
        "day": str,      # Nom du jour (Lundi, Mardi, etc.)
        "all": float,    # Vitesse globale
        "touristic": float,  # Vitesse période touristique
        "event": float      # Vitesse période événement
    }
]
```

**Structure de `macro_items` :**
```python
[
    {
        "article": str,                # Nom du produit
        "daily_velocity": float,       # Vitesse quotidienne moyenne
        "velocity_touristic": float,   # Vitesse en période touristique
        "velocity_event": float,       # Vitesse en période événement
        "stock_securite": float,       # Stock de sécurité recommandé
        "ratio_touristic": float,      # Ratio période touristique
        "ratio_event": float,          # Ratio période événement
        "peak_hour": int,              # Heure de pointe de vente
        "ratio_pic_percent": float,    # Pourcentage vendu à l'heure de pointe
        "alerte_replissage_avant": str # Heure recommandée pour le replissage
    }
]
```

**Exemple d'utilisation :**
```python
>>> get_sales_velocity()
{
    "macro_items": [
        {
            "article": "TRADITIONAL BAGUETTE",
            "daily_velocity": 245.3,
            "peak_hour": 8,
            "stock_securite": 490.0
        }
    ]
}
```

---

### `get_ticket_contribution`

Récupère les données de contribution des produits au ticket moyen.

**Description :**
La contribution indique quel pourcentage du CA d'un ticket multi-produits est représenté par un produit donné. Utile pour identifier les produits "ancre" qui structurent le panier.

**Paramètres :**
Aucun paramètre (vue globale).

**Retour :**

```python
dict: {
    "stats": {
        "nb_produits_analysables": int,  # Nombre de produits analysés
        "ca_total_multi": float,         # CA total des tickets multi-produits
        "distribution_par_statut": dict, # Distribution par statut de contribution
        "nb_multi": int,                # Nombre de tickets multi-produits
        "nb_mono": int,                 # Nombre de tickets mono-produit
        "nb_total": int,                # Nombre total de tickets
        "pct_multi": float              # Pourcentage de tickets multi-produits
    },
    "top20": list,                      # Top 20 produits par contribution
    "bcg_quadrants": dict               # Quadrants BCG
}
```

**Structure de `top20` :**
```python
[
    {
        "article": str,                 # Nom du produit
        "contribution_med": float,      # Contribution médiane au ticket en %
        "contribution_moy": float,      # Contribution moyenne au ticket en %
        "nb_tickets_multi": int,        # Nombre de tickets multi-produits
        "statut_contribution": str,     # Statut ("Ancre", "Moteur", "Complement", "Micro")
        "ca_total_multi": float,       # CA total en tickets multi-produits
        "frequence_multi_pct": float   # Fréquence en tickets multi-produits en %
    }
]
```

**Structure de `bcg_quadrants` :**
```python
{
    "etoiles": list,        # Produits stars (haute contribution, haute fréquence)
    "moteurs": list,        # Produits moteurs (haute contribution)
    "opportunites": list,   # Produits opportunités (haute fréquence)
    "a_reevaluer": list     # Produits à réévaluer
}
```

**Exemple d'utilisation :**
```python
>>> get_ticket_contribution()
{
    "top20": [
        {
            "article": "BUCHE 6PERS",
            "contribution_med": 68.5,
            "statut_contribution": "Ancre"
        }
    ]
}
```

---

### `get_repurchase_frequency`

Récupère les données de fréquence de rachat des produits.

**Description :**
La fréquence de rachat indique combien de semaines un produit est vendu sur la période totale. C'est un indicateur de régularité de la demande.

**Paramètres :**
Aucun paramètre (vue globale).

**Retour :**

```python
dict: {
    "total_sem": int,               # Nombre total de semaines dans la période
    "nb_produits": int,             # Nombre de produits analysés
    "status_distribution": dict,    # Distribution par statut de fréquence
    "items": list,                  # Liste des produits
    "weekly_multi": list            # Données hebdomadaires multiples
}
```

**Structure de `items` :**
```python
[
    {
        "article": str,               # Nom du produit
        "category": str,              # Catégorie du produit
        "semaines_actives": int,      # Nombre de semaines avec ventes
        "repurchase_freq_pct": float, # Fréquence de rachat en %
        "statut_frequence": str,      # Statut ("Quotidien", "Regulier", "Cyclique", "Sporadique")
        "ca_total": float,            # CA total
        "ca_par_sem_active": float    # CA par semaine active
    }
]
```

**Exemple d'utilisation :**
```python
>>> get_repurchase_frequency()
{
    "items": [
        {
            "article": "TRADITIONAL BAGUETTE",
            "semaines_actives": 52,
            "repurchase_freq_pct": 100.0,
            "statut_frequence": "Quotidien"
        }
    ]
}
```

---

### `get_associations`

Récupère les règles d'association de produits (Apriori).

**Description :**
Les règles d'association identifient les produits qui sont souvent achetés ensemble. Le lift mesure la force de l'association (>1 = association forte).

**Paramètres :**

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `sort_by` | str | "Lift ↓" | Critère de tri. Options: "Lift ↓", "Confiance ↓", "Support ↓" |
| `top_n` | int | 20 | Nombre de règles à retourner |

**Retour :**

```python
dict: {
    "nb_total_regles": int,  # Nombre total de règles disponibles
    "rules": list            # Liste des règles
}
```

**Structure de `rules` :**
```python
[
    {
        "antecedent": str,    # Produit antécédent (si A est acheté)
        "consequent": str,    # Produit conséquent (alors B est acheté)
        "support": float,     # Support en % (fréquence de la combinaison)
        "confidence": float,  # Confiance en % (probabilité que B soit acheté si A est acheté)
        "lift": float         # Lift (force de l'association, >1 = forte)
    }
]
```

**Exemple d'utilisation :**
```python
>>> get_associations(sort_by="Lift ↓", top_n=10)
{
    "rules": [
        {
            "antecedent": "12 MACARON",
            "consequent": "BUCHE 6PERS",
            "support": 8.2,
            "confidence": 67.5,
            "lift": 3.45
        }
    ],
    "nb_total_regles": 156
}
```

---

## Forecast Tools

### `get_forecast`

Récupère les prévisions de demande (Prophet).

**Description :**
Cette fonction retourne les prévisions de demande pour un horizon donné, basées sur le modèle Prophet. Elle inclut l'historique, les métriques de précision, et les prévisions saisonnières.

**Paramètres :**

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `horizon` | int | 14 | Horizon de prévision en jours. Options: 7, 14, 30 |
| `forecast_type` | str | "articles" | Type de prévision. Options: "articles", "ca" |
| `product` | str (optionnel) | None | Produit spécifique pour la prévision. Si None, prévision globale |
| `category` | str (optionnel) | None | Catégorie spécifique pour la prévision. Si None, prévision globale |
| `season` | str (optionnel) | None | Saison spécifique pour la prévision |
| `event` | str (optionnel) | None | Événement spécifique pour la prévision |
| `history_period` | str | "all" | Période historique utilisée pour l'entraînement. Options: "all", "30d", "90d", "180d" |

**Retour :**

```python
dict: {
    "forecast_info": {
        "type": str,           # Type de prévision
        "label": str,          # Label lisible
        "unit": str,           # Unité (€ ou unités)
        "horizon": int,        # Horizon en jours
        "history_period": str  # Période historique
    },
    "metrics": {
        "mdape_cv": float,         # MDAPE (erreur médiane absolue en %)
        "moy_jour_historique": float, # Moyenne journalière historique
        "total_prevision": float,    # Total prévu sur l'horizon
        "horizon_jours": int         # Nombre de jours de l'horizon
    },
    "prophet_metrics": {
        "mdape_cv": float,          # MDAPE validation
        "train_error": float,       # Erreur d'entraînement
        "validation_error": float,  # Erreur de validation
        "mape_by_horizon": list     # MAPE par horizon
    },
    "model_comparison": list,      # Comparaison de modèles
    "history": list,               # Historique
    "forecast": list,             # Prévisions
    "forecast_season": list,      # Prévisions saisonnières
    "available_filters": dict     # Filtres disponibles
}
```

**Structure de `forecast` :**
```python
[
    {
        "horizon": str,       # Label "J+X"
        "ds": str,            # Date
        "date_fr": str,       # Date formatée FR
        "jour_semaine": str,  # Jour de la semaine
        "yhat": int,          # Valeur prédite
        "yhat_lower": int,    # Borne inférieure
        "yhat_upper": int,    # Borne supérieure
        "is_ferme": int       # 1 si jour fermé, 0 sinon
    }
]
```

**Exemple d'utilisation :**
```python
>>> get_forecast(horizon=14, forecast_type="articles")
{
    "forecast": [
        {
            "horizon": "J+1",
            "ds": "2025-10-03",
            "yhat": 120,
            "yhat_lower": 100,
            "yhat_upper": 140
        }
    ],
    "metrics": {
        "total_prevision": 1680,
        "mdape_cv": 15.2
    }
}
```

---

## Alert Tools

### `get_alerts`

Récupère les alertes de stock basées sur les prévisions saisonnières.

**Description :**
Cette fonction analyse les prévisions de demande et génère des alertes de stock (rupture, vigilance, normal, surstock) pour chaque jour.

**Paramètres :**

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `mois_filter` | str | "Tout" | Filtre de mois pour les alertes. Options: "Tout", "Juin", "Juillet", "Août", "Septembre" |

**Retour :**

```python
dict: {
    "kpis": {
        "total_articles": int,    # Total d'articles prévus
        "ca_total_prevu": float,  # CA total prévu
        "marge_totale": float,    # Marge totale prévue
        "ca_risque": float,       # CA à risque (jours en rupture)
        "pic_val": int,           # Valeur du pic
        "pic_date": str,          # Date du pic
        "statuts": {
            "RUPTURE": int,       # Nombre de jours en rupture
            "VIGILANCE": int,     # Nombre de jours en vigilance
            "NORMAL": int,        # Nombre de jours normaux
            "SURSTOCK": int,      # Nombre de jours en surstock
            "FERMÉ": int          # Nombre de jours fermés
        }
    },
    "days": list,                 # Liste des jours avec alertes
    "available_mois": list       # Mois disponibles pour le filtre
}
```

**Structure de `days` :**
```python
[
    {
        "ds": str,                    # Date
        "date_fr": str,               # Date formatée FR
        "jour_semaine": str,          # Jour de la semaine
        "yhat": int,                  # Prévision de demande
        "yhat_lower": int,            # Borne inférieure
        "yhat_upper": int,            # Borne supérieure
        "ca_prevu": float,            # CA prévu
        "marge_prevue": float,        # Marge prévue
        "ratio_pct": float,           # Ratio stock/prévision en %
        "commande_recommandee": int,  # Commande recommandée
        "statut": str,                # Statut ("RUPTURE", "VIGILANCE", "NORMAL", "SURSTOCK", "FERMÉ")
        "bar_color": str              # Code couleur hex pour l'affichage
    }
]
```

**Exemple d'utilisation :**
```python
>>> get_alerts(mois_filter="Juillet")
{
    "kpis": {
        "total_articles": 4500,
        "ca_risque": 1250.0,
        "statuts": {
            "RUPTURE": 3,
            "VIGILANCE": 5,
            "NORMAL": 18
        }
    },
    "days": [
        {
            "ds": "2026-07-15",
            "statut": "RUPTURE",
            "yhat": 150,
            "ca_prevu": 375.0
        }
    ]
}
```

---

## Résumé des Tools

| Tool | Module | Description principale |
|------|--------|----------------------|
| `get_daily_kpis` | Daily | KPIs journaliers avec top produits et combinaisons |
| `get_commercial_performance` | Performance | Performance commerciale avec filtres temporels et catégories |
| `get_penetration_data` | Product | Taux de pénétration des produits dans les tickets |
| `get_sales_velocity` | Product | Vitesse de vente par jour pour gestion des stocks |
| `get_ticket_contribution` | Product | Contribution des produits au ticket moyen |
| `get_repurchase_frequency` | Product | Fréquence de rachat et régularité de la demande |
| `get_associations` | Product | Règles d'association entre produits (Apriori) |
| `get_forecast` | Forecast | Prévisions de demande Prophet |
| `get_alerts` | Alert | Alertes de stock basées sur les prévisions |

---

## Notes importantes

- Tous les tools utilisent le décorateur `@tool` d'ADK
- Les tools importent les engines depuis le dossier `backend/`
- Les retours sont les données brutes des engines (JSON/dictionnaires)
- Les paramètres optionnels ont des valeurs par défaut indiquées
- Les dates doivent être au format 'YYYY-MM-DD' lorsqu'elles sont fournies
- Les filtres de catégorie et d'événement acceptent "Toutes"/"Tous" pour désactiver le filtre
