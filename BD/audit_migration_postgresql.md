# Audit Pré-Migration PostgreSQL — Retail Intelligence Agent

> Objectif : capture exhaustive de l'état des données dans `retail_data.pkl` avant toute création de schéma SQL.
> Ce document sert de **référentiel de validation** : chaque chiffre ci-dessous devra être identique après import dans PostgreSQL.

---

## 1. Vue d'ensemble des objets dans le PKL

| Objet | Type | Shape / Valeur | Rôle |
|---|---|---|---|
| `df_clean` | DataFrame | 225,865 lignes × 19 colonnes | Données transactionnelles brutes |
| `df_penetration` | DataFrame | 145 × 4 | Pénétration produit + statut stratégique |
| `df_macro` | DataFrame | 145 × 7 | Vélocité, stock sécurité, ratios |
| `regles` | DataFrame | 50 règles × 16 colonnes | Règles d'association Apriori |
| `forecast_14j` | DataFrame | 14 jours × 8 colonnes | Prévisions Prophet 14 jours |
| `forecast_saison` | DataFrame | 122 jours × 10 colonnes | Prévisions saison estivale 2026 |
| `daily_data` | DataFrame | 620 jours × 6 colonnes | Agrégats journaliers |
| `ca_mensuel` | DataFrame | 24 mois × 2 colonnes | CA mensuel |
| `mdape_cv` | scalaire | **20.927606 % | Erreur médiane cross-val Prophet |

---
## 2. df_clean — Contrôles Qualité & Contraintes Schéma

### 2.1 Colonnes & types

| # | Colonne | dtype PostgreSQL recommandé | dtype pandas |
|---|---|---|---|
| 1 | `transaction_id` | `BIGINT` | `int64` |
| 2 | `date` | `DATE — FK vers dim_dates` | `datetime64[ns]` |
| 3 | `time` | `VARCHAR(n)` | `object` |
| 4 | `day` | `VARCHAR(n)` | `object` |
| 5 | `ticket_number` | `BIGINT` | `int64` |
| 6 | `article` | `FK dim_products / dim_categories` | `object` |
| 7 | `quantity` | `INTEGER` | `int64` |
| 8 | `unit_price` | `NUMERIC(12,2)` | `float64` |
| 9 | `total_revenue` | `NUMERIC(12,2)` | `float64` |
| 10 | `hour` | `SMALLINT` | `Int64` |
| 11 | `season` | `FK dim_seasons (en dérivé dim_dates)` | `object` |
| 12 | `event` | `FK dim_events` | `object` |
| 13 | `is_event` | `INTEGER` | `int64` |
| 14 | `is_touristic_season` | `INTEGER` | `int64` |
| 15 | `category` | `FK dim_products / dim_categories` | `object` |
| 16 | `ticket_total_value` | `NUMERIC(12,2)` | `float64` |
| 17 | `day_name` | `VARCHAR(n)` | `object` |
| 18 | `semaine_iso` | `VARCHAR(10)` | `period[W-SUN]` |
| 19 | `week_id` | `VARCHAR(n)` | `object` |

### 2.2 Contrôles d'unicité

- **transaction_id (future `source_row_id`)** : 225,865 uniques / 225,865 lignes → **0 doublons [OK]**
  → PostgreSQL : `source_row_id BIGINT UNIQUE NOT NULL`

- **Contrainte `UNIQUE(ticket_number, article, date)` — initialement prévue** : **5,291 lignes concernées [INTERDIT] IMPOSSIBLE**
  - Plusieurs lignes existent avec même ticket/article/jour mais prix différents. Décision : **NE PAS créer cette contrainte**.

Exemple (aurait été écrasé) :
```
 source_row_id | date       | ticket | article                          | qty | unit_€ | line_€
---------------------------------------------------------------------------------------------------------
             1 | 2024-01-01 | T#295793 | PAIN AU CHOCOLAT                 |   1 |   1.48 |   1.48
             2 | 2024-01-01 | T#295793 | PAIN AU CHOCOLAT                 |   2 |   1.41 |   2.82
            18 | 2024-01-01 | T#295778 | SEIGLE                           |   1 |   2.35 |   2.35
            19 | 2024-01-01 | T#295778 | SEIGLE                           |   1 |   2.28 |   2.28
```

### 2.3 Unicité ticket_number dans l'historique

- Tickets distincts : 131,315
- Paires (ticket_number, date) distinctes : 131,853
- **[ATTENTION]  Écart 538 → ticket_number N'EST PAS unique dans le temps**
- Tickets réutilisés : 538
- Impact : agrégats tickets → utiliser clé composite `(date_id, ticket_number)`

Exemples :
```
  ticket #301522 — 2 jours : [datetime.date(2025, 1, 12), datetime.date(2025, 12, 1)]
  ticket #150066 — 2 jours : [datetime.date(2024, 1, 2), datetime.date(2024, 2, 1)]
  ticket #150173 — 2 jours : [datetime.date(2024, 1, 2), datetime.date(2024, 2, 1)]
```

### 2.4 Valeurs nulles

- **[OK] ZÉRO null** dans les 19 colonnes — données propres.

### 2.5 Plages numériques

| Colonne | Min | Max | Recommandation SQL |
|---|---|---|---|
| quantity | 1 | 20 | INTEGER ≥0 |
| unit_price | 0.1900 € | 41.83 € | NUMERIC(10,4) — 4 décimales promotions |
| total_revenue | 0.19 € | 209.70 € | NUMERIC(14,2) |
| hour | 7 | 20 | SMALLINT CHECK 0-23 |
| ticket_total_value | 0.19 € | 327.65 € | Redondant — contrôle |

### 2.6 Plages de dates

- Ventes               : **2024-01-01 → 2025-12-31
- Prévisions 14j     : **2026-01-01 → 2026-01-14
- Prévisions saison  : **2026-06-01 → 2026-09-30
- **dim_dates DOIT couvrir : 2024-01-01 → 2026-09-30** (plus marge)

---
## 3. Chiffres de Référence — VALIDATION APRÈS IMPORT POSTGRESQL

> Ces chiffres **DOIVENT** être égaux entre le PKL (actuel) et PostgreSQL (futur).

### 3.1 Totaux généraux

| Indicateur | Valeur |
|---|---|
| CA total | **846,194.79 €** |
| Quantités totales | **349,487 |
| Tickets (numéros) | **131,315** |
| Tickets (date+num) | **131,853** |
| Articles référencés | **144** |
| Catégories | **7** |
| Jours ouverts | **658** |

### 3.2 CA par année

| Année | CA € |
|---|---|
| 2024 | **415,676.39 €** |
| 2025 | **430,518.40 €** |

### 3.3 CA mensuel — df_clean vs ca_mensuel

| Mois | CA (groupby df_clean) | CA (ca_mensuel PKL) | Diff € | Diff % |
|---|---|---|---|---|
| 2024-01 | 35,503.72 € | 35,503.72 € | 0.00 € | 0.0000 % |
| 2024-02 | 17,404.62 € | 17,404.62 € | 0.00 € | 0.0000 % |
| 2024-03 | 26,187.69 € | 26,187.69 € | 0.00 € | 0.0000 % |
| 2024-04 | 25,716.96 € | 25,716.96 € | 0.00 € | 0.0000 % |
| 2024-05 | 42,457.45 € | 42,457.45 € | 0.00 € | 0.0000 % |
| 2024-06 | 25,790.88 € | 25,790.88 € | 0.00 € | 0.0000 % |
| 2024-07 | 48,977.60 € | 48,977.60 € | 0.00 € | 0.0000 % |
| 2024-08 | 57,652.97 € | 57,652.97 € | 0.00 € | 0.0000 % |
| 2024-09 | 23,704.48 € | 23,704.48 € | 0.00 € | 0.0000 % |
| 2024-10 | 22,651.28 € | 22,651.28 € | 0.00 € | 0.0000 % |
| 2024-11 | 18,941.99 € | 18,941.99 € | 0.00 € | 0.0000 % |
| 2024-12 | 70,686.75 € | 70,737.96 € | 51.21 € | 0.0724 % |
| 2025-01 | 39,563.11 € | 39,563.11 € | 0.00 € | 0.0000 % |
| 2025-02 | 18,748.82 € | 18,748.82 € | 0.00 € | 0.0000 % |
| 2025-03 | 19,666.36 € | 19,666.36 € | 0.00 € | 0.0000 % |
| 2025-04 | 28,632.75 € | 28,632.75 € | 0.00 € | 0.0000 % |
| 2025-05 | 40,768.99 € | 40,768.99 € | 0.00 € | 0.0000 % |
| 2025-06 | 24,698.21 € | 24,698.21 € | 0.00 € | 0.0000 % |
| 2025-07 | 49,731.67 € | 49,731.67 € | 0.00 € | 0.0000 % |
| 2025-08 | 57,831.08 € | 57,831.08 € | 0.00 € | 0.0000 % |
| 2025-09 | 20,472.42 € | 20,472.42 € | 0.00 € | 0.0000 % |
| 2025-10 | 20,088.12 € | 20,088.12 € | 0.00 € | 0.0000 % |
| 2025-11 | 21,075.66 € | 21,075.66 € | 0.00 € | 0.0000 % |
| 2025-12 | 89,241.21 € | 89,241.21 € | 0.00 € | 0.0000 % |

→ **[ATTENTION] ÉCART**

### 3.4 Agrégats journaliers — df_clean vs daily_data

- Tickets : max |Δ| = 0.0000 — **OK**
- Articles : max |Δ| = 4.0000 — **[ATTENTION] ÉCART**
- CA : max |Δ| = 51.2100 — **[ATTENTION] ÉCART**

---
## 4. Tables Pré-Calculées — Structure Exacte

### 4.1 df_penetration

| Colonne | dtype pandas | Exemple | Destination |
|---|---|---|---|
| `article` | `object` | `['TRADITIONAL BAGUETTE', 'COUPE', 'BAGUETTE']` | → product_penetration.product_id FK via article_name |
| `tickets_count` | `int64` | `[57577, 16035, 14573]` | → tickets_count INT |
| `penetration_rate_%` | `float64` | `[43.85, 12.21, 11.1]` | → penetration_rate NUMERIC(5,2) — échelle 0–100 % |
| `statut_strategique` | `object` | `['Produit Phare (Dominant)', 'Leader (Indispensable)', 'Leader (Indispensable)']` | → statut_strategique VARCHAR(100) [métier] |

- Plage pénétration : 0.00 % → 43.85 %
- Distribution statut_strategique :
  - Niche / A surveiller : 95 produits
  - Produit Regulier : 36 produits
  - Produit Coeur (Core) : 8 produits
  - Leader (Indispensable) : 5 produits
  - Produit Phare (Dominant) : 1 produits

### 4.2 df_macro

| Colonne | dtype | Min | Max |
|---|---|---|---|
| `article` | `object` | — | — |
| `daily_velocity` | `float64` | 0.0000 | 153.4600 |
| `stock_securite` | `float64` | 0.0000 | 155.0000 |
| `velocity_touristic` | `float64` | 0.0000 | 324.6000 |
| `velocity_event` | `float64` | 0.0000 | 98.7300 |
| `ratio_touristic` | `float64` | 0.0000 | 5.1100 |
| `ratio_event` | `float64` | 0.0000 | 7.4900 |

### 4.3 regles Apriori (50 règles × 16 colonnes — ÉCHELLES CRITIQUES

> [ATTENTION] Convention native : **0–1 (PAS en %)**. confidence=0.8161 signifie 81,61 %. Aucun ×100 en SQL — on conserve l'échelle native.

| Colonne | dtype | Min | Max |
|---|---|---|---|
| `antecedent support` | `float64` | 0.013420 | 0.398421 |
| `consequent support` | `float64` | 0.013420 | 0.398421 |
| `support` | `float64` | 0.010126 | 0.075306 |
| `confidence` | `float64` | 0.026727 | 0.816136 |
| `lift` | `float64` | 1.263245 | 4.467283 |
| `leverage` | `float64` | 0.002816 | 0.047735 |
| `conviction` | `float64` | 1.007294 | 3.954904 |
| `zhangs_metric` | `float64` | 0.214615 | 0.915472 |
| `representativity` | `float64` | 1.000000 | 1.000000 |
| `jaccard` | `float64` | 0.026165 | 0.292850 |
| `certainty` | `float64` | 0.007241 | 0.747149 |
| `kulczynski` | `float64` | 0.151685 | 0.483082 |
| `antecedents`       | frozenset | — | — |
| `consequents`       | frozenset | — | — |
| `antecedents_str`   | VARCHAR   | — | — |
| `consequents_str`   | VARCHAR   | — | — |

- Taille des consequents :
  - 1 item(s) : 39 règles
  - 2 item(s) : 11 règles

### 4.4 Prévisions Prophet

#### forecast_14j (14j)

| Colonne | dtype | Exemple |
|---|---|---|
| `ds` | `datetime64[ns]` | `[Timestamp('2026-01-01 00:00:00'), Timestamp('2026-01-02 00:00:00')]` |
| `yhat` | `int64` | `[393, 527]` |
| `yhat_lower` | `int64` | `[95, 248]` |
| `yhat_upper` | `int64` | `[706, 852]` |
| `jour_semaine` | `object` | `['Jeudi', 'Vendredi']` |
| `date_fr` | `object` | `['01/01/2026', '02/01/2026']` |
| `horizon` | `object` | `['J+1', 'J+2']` |
| `is_ferme` | `int64` | `[0, 0]` |

#### forecast_saison (122j)

| Colonne | dtype | Exemple |
|---|---|---|
| `ds` | `datetime64[ns]` | `[Timestamp('2026-06-01 00:00:00'), Timestamp('2026-06-02 00:00:00')]` |
| `yhat` | `int64` | `[658, 660]` |
| `yhat_lower` | `int64` | `[190, 171]` |
| `yhat_upper` | `int64` | `[1131, 1089]` |
| `mois_num` | `int32` | `[6, 6]` |
| `facteur` | `float64` | `[1.5, 1.5]` |
| `jour_semaine` | `object` | `['Lundi', 'Mardi']` |
| `date_fr` | `object` | `['01/06/2026', '02/06/2026']` |
| `is_ferme` | `int64` | `[0, 0]` |
| `mois` | `category` | `['June 2026', 'June 2026']` |

---
## 5. Correspondance Colonne df_clean → Destination PostgreSQL

| df_clean.colonne | PostgreSQL | Cardinalité / Remarque |
|---|---|---|
| transaction_id | **fact_ticket_lines.source_row_id BIGINT UNIQUE | 1:1 clé source |
| date | dim_dates.date_id (FK) | N/A |
| ticket_number | fact_ticket_lines.ticket_number VARCHAR(50) | [ATTENTION] composite (date_id, ticket_number) = ticket réel |
| article | dim_products.article_name UNIQUE | ~145 |
| category | dim_categories.category_name → dim_products.category_id | ~5 |
| quantity | fact_ticket_lines.quantity INTEGER | ≥0 |
| unit_price | fact_ticket_lines.unit_price NUMERIC(10,4) | [ATTENTION] PAR LIGNE — historique prix variable |
| total_revenue | fact_ticket_lines.total_revenue NUMERIC(14,2) | Contrôle qty × prix |
| hour | fact_ticket_lines.hour SMALLINT | 0-23 |
| season | dim_dates.season_id FK dim_seasons | 4 saisons |
| event | fact_ticket_lines.event_id FK dim_events | 98 événements |
| is_event | dim_events.is_event | redondant utile |
| is_touristic_season | dim_dates.is_touristic BOOLEAN | |
| ticket_total_value | *(si fact_tickets ? sinon dérivé | redondant |
| day_name / week_id / semaine_iso | dim_dates dérivés | dérivés |

---
## 6. Décisions & Correctifs Issus de l'Audit

| # | Point | Décision |
|---|---|---|
| 1 | Contrainte UNIQUE(ticket, article, date) | **[REJETÉ] RETIRÉE** (écrase 5 000+ lignes) |
| 2 | Clé source | **[OK] source_row_id = transaction_id BIGINT UNIQUE |
| 3 | Unicité ticket | **[ATTENTION] Clé composite (date_id, ticket_number)** pour agrégats |
| 4 | unit_price dans dim_products | **[REJETÉ] RETIRÉ** (prix variable dans le temps — historique) |
| 5 | Échelle Apriori | **[OK] 0–1 natif — PAS × 100** |
| 6 | FK prophet_forecasts.model_name / ml_metrics | **[OK] Table `forecast_models` (PK model_name)** |
| 7 | Plage dim_dates | **[OK] {global_min} → {global_max}** (couvre ventes + prévisions saison 2026 |
| 8 | Structure Prophet | **[OK] 14j / saison — pas trend/seasonal/holidays |
| 9 | Validation | **[OK] Vérifier 1:1 chiffres §3 après import avant bascule |
| 10 | Bascule PKL → PG | **[REJETÉ] Interdit immédiat** : double lecture via `USE_POSTGRESQL` flag |

---
_Fin audit — version automatique, trace source de vérité_