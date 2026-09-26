-- ================================================================
-- BD/schema.sql
-- Star Schema + Tables pré-calculées
-- Version validée par l'audit (BD/audit_migration_postgresql.md)
--
-- Ordre d'exécution DANS pgAdmin (Query Tool) sur la base retail_db :
--   1. CREATE DATABASE retail_db OWNER postgres;   (si pas encore créée)
--   2. Se connecter à retail_db
--   3. \i BD/schema.sql  OU  Coller/exécuter ce fichier dans Query Tool
-- ================================================================

SET client_encoding = 'UTF8';

-- ================================================================
-- ── COUCHE 1 : DIMENSIONS ──────────────────────────────────────
-- ================================================================
CREATE TABLE IF NOT EXISTS dim_categories (
    category_id   SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE
);

-- Saisons météo / tourisme
CREATE TABLE IF NOT EXISTS dim_seasons (
    season_id   SERIAL PRIMARY KEY,
    season_name VARCHAR(50) NOT NULL UNIQUE
);

-- Événements (Jour Normal, Fêtes, Ponts, etc. — 98 valeurs)
CREATE TABLE IF NOT EXISTS dim_events (
    event_id   SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL UNIQUE,
    event_date DATE,                           -- NULL pour récurrents / typologie
    is_event   BOOLEAN NOT NULL DEFAULT TRUE   -- FALSE => "Jour Normal"
);

-- Produits / articles référencés (~145 SKU)
CREATE TABLE IF NOT EXISTS dim_products (
    product_id    SERIAL PRIMARY KEY,
    article_name  VARCHAR(255) NOT NULL UNIQUE,   -- "TRADITIONAL BAGUETTE"
    category_id   INT REFERENCES dim_categories(category_id) ON DELETE SET NULL,
    -- [ATTENTION] PAS de colonne unit_price ici — le prix EST HISTORIQUE PAR LIGNE DE TICKET
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON dim_products(category_id);

-- Modèles de prévisions Prophet (table de lookup pour FK)
CREATE TABLE IF NOT EXISTS forecast_models (
    model_name    VARCHAR(50) PRIMARY KEY,   -- "14j_global", "saison_2026", etc.
    forecast_type VARCHAR(20) NOT NULL CHECK (forecast_type IN ('articles', 'ca')),
    description   TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table CALENDRIER — indispensable (jointure sur date)
-- [ATTENTION] Couverture : min(df_clean.date) -> max(forecast_saison.ds) + 15j marge
CREATE TABLE IF NOT EXISTS dim_dates (
    date_id       DATE PRIMARY KEY,
    year          INT NOT NULL,
    month         INT NOT NULL,
    month_name    VARCHAR(20) NOT NULL,
    week_iso      VARCHAR(10) NOT NULL,       -- format "2024-W03" = colonne semaine_iso
    day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),   -- 0=Lun
    day_name      VARCHAR(20) NOT NULL,       -- "Lundi"
    is_weekend    BOOLEAN NOT NULL,
    is_touristic  BOOLEAN NOT NULL DEFAULT FALSE,   -- colonne is_touristic_season
    season_id     INT REFERENCES dim_seasons(season_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_dates_year_month ON dim_dates(year, month);
CREATE INDEX IF NOT EXISTS idx_dates_week_iso   ON dim_dates(week_iso);
CREATE INDEX IF NOT EXISTS idx_dates_season     ON dim_dates(season_id);

-- ================================================================
-- ── COUCHE 1 : TABLE DE FAITS PRINCIPALE ─────────────────────
-- ================================================================
-- 225 865 lignes. Chaque ligne = 1 article dans 1 ticket = 1 source_row_id (transaction_id)
CREATE TABLE IF NOT EXISTS fact_ticket_lines (
    source_row_id  BIGINT PRIMARY KEY,         -- [OK] transaction_id, DÉJÀ UNIQUE
    date_id        DATE NOT NULL REFERENCES dim_dates(date_id)  ON DELETE CASCADE,
    ticket_number  VARCHAR(50) NOT NULL,       -- [ATTENTION] PAS UNIQUE global : réutilisé + tard
    product_id     INT  NOT NULL REFERENCES dim_products(product_id) ON DELETE CASCADE,
    quantity       INTEGER NOT NULL CHECK (quantity >= 0),
    unit_price     NUMERIC(10,4) NOT NULL,     -- [ATTENTION] PAR LIGNE (historique prix variable)
    total_revenue  NUMERIC(12,2) NOT NULL,     -- CHECK (total_revenue = quantity * unit_price)
    hour           SMALLINT CHECK (hour BETWEEN 0 AND 23),
    event_id       INT REFERENCES dim_events(event_id) ON DELETE SET NULL
    -- [ATTENTION] DÉLIBÉRÉMENT PAS de UNIQUE(ticket_number, product_id, date_id) :
    --    ferait perdre 5291 lignes (même produit/ticket/jour avec prix différents).
);
CREATE INDEX IF NOT EXISTS idx_fact_date      ON fact_ticket_lines(date_id);
CREATE INDEX IF NOT EXISTS idx_fact_ticket    ON fact_ticket_lines(ticket_number);
CREATE INDEX IF NOT EXISTS idx_fact_product   ON fact_ticket_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_fact_date_prod ON fact_ticket_lines(date_id, product_id);
CREATE INDEX IF NOT EXISTS idx_fact_hour      ON fact_ticket_lines(hour);
CREATE INDEX IF NOT EXISTS idx_fact_event     ON fact_ticket_lines(event_id);
-- La réelle association "1 ticket" = la paire (date_id, ticket_number)
CREATE INDEX IF NOT EXISTS idx_fact_date_ticket ON fact_ticket_lines(date_id, ticket_number);

-- ================================================================
-- ── COUCHE 2 : TABLES ANALYTIQUES PRÉ-CALCULÉES ──────────────
-- ================================================================

-- Pénétration produit + statut stratégique (métier — dérivé de df_penetration)
CREATE TABLE IF NOT EXISTS product_penetration (
    product_id         INT PRIMARY KEY REFERENCES dim_products(product_id) ON DELETE CASCADE,
    tickets_count      INT NOT NULL,
    penetration_rate   NUMERIC(5,2) NOT NULL,   -- échelle 0 – 100 (comme df_penetration.penetration_rate_%)
    statut_strategique VARCHAR(100) NOT NULL,    -- Produit Phare / Complémentaire / A développer / etc.
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Vitesse de vente, stock sécurité (df_macro)
CREATE TABLE IF NOT EXISTS product_velocity_stats (
    product_id         INT PRIMARY KEY REFERENCES dim_products(product_id) ON DELETE CASCADE,
    daily_velocity     NUMERIC(12,4) NOT NULL,   -- unités / jour en moyenne
    velocity_touristic NUMERIC(12,4),
    velocity_event     NUMERIC(12,4),
    stock_securite     NUMERIC(12,4) NOT NULL,
    ratio_touristic    NUMERIC(6,4),             -- 0–1 (df_macro.ratio_touristic)
    ratio_event        NUMERIC(6,4),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Règles d'association Apriori — 50 règles
-- [ATTENTION] TOUTES les métriques sont EN ÉCHELLE 0–1 native (PAS en %) comme df_regles original.
--    confidence=0.8161 → 81,61 %
CREATE TABLE IF NOT EXISTS association_rules (
    rule_id            BIGSERIAL PRIMARY KEY,
    antecedent_ids     INTEGER[] NOT NULL,                    -- array produit_ids ex: {23, 45}
    consequent_id      INTEGER NOT NULL REFERENCES dim_products(product_id) ON DELETE CASCADE,
    antecedent_support NUMERIC(8,6) NOT NULL,                 -- 0 – 1
    consequent_support NUMERIC(8,6) NOT NULL,                 -- 0 – 1
    support            NUMERIC(8,6) NOT NULL,                 -- 0 – 1
    confidence         NUMERIC(6,4) NOT NULL,                 -- 0 – 1  (PAS 0–100)
    lift               NUMERIC(10,4) NOT NULL,                -- ≥ 0
    leverage           NUMERIC(8,6),
    conviction         NUMERIC(10,4),
    zhangs_metric      NUMERIC(5,2),
    representativity   NUMERIC(8,6),
    jaccard            NUMERIC(8,6),
    certainty          NUMERIC(8,6),
    kulczynski         NUMERIC(8,6),
    antecedents_str    VARCHAR(500),                          -- lisible, pré-sérialisé depuis df_regles
    consequents_str    VARCHAR(500),
    created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rules_lift       ON association_rules(lift DESC);
CREATE INDEX IF NOT EXISTS idx_rules_conf       ON association_rules(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_rules_supp       ON association_rules(support DESC);
CREATE INDEX IF NOT EXISTS idx_rules_consequent ON association_rules(consequent_id);

-- Prévisions Prophet — 14 jours + saison estivale
-- Structure exacte : colonnes = forecast_14j / forecast_saison (SANS trend/seasonal/holidays)
CREATE TABLE IF NOT EXISTS prophet_forecasts (
    forecast_id   BIGSERIAL PRIMARY KEY,
    model_name    VARCHAR(50) NOT NULL REFERENCES forecast_models(model_name) ON DELETE CASCADE,
    ds            DATE NOT NULL,
    yhat          NUMERIC(14,2) NOT NULL,      -- prédiction (ex: nb_articles prévus)
    yhat_lower    NUMERIC(14,2),
    yhat_upper    NUMERIC(14,2),
    is_ferme      BOOLEAN NOT NULL DEFAULT FALSE,
    run_date      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_forecast_model_ds ON prophet_forecasts(model_name, ds);
CREATE INDEX IF NOT EXISTS idx_forecast_ds ON prophet_forecasts(ds);

-- Métriques de performance des modèles ML
CREATE TABLE IF NOT EXISTS ml_metrics (
    metric_id   SERIAL PRIMARY KEY,
    model_name  VARCHAR(50) NOT NULL REFERENCES forecast_models(model_name) ON DELETE CASCADE,
    metric_name VARCHAR(30) NOT NULL,       -- MDAPE_CV, MAPE_J+1, etc.
    value       NUMERIC(8,4) NOT NULL,      -- valeur en % (ex: 20.9 = 20,9 %)
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mlmetrics_model_metric ON ml_metrics(model_name, metric_name);

-- Agrégats mensuels CA (remplace ca_mensuel PKL)
CREATE TABLE IF NOT EXISTS monthly_ca (
    month_id      SERIAL PRIMARY KEY,
    month_start   DATE NOT NULL UNIQUE,      -- 1er jour du mois
    year          INT  NOT NULL,
    month         INT  NOT NULL CHECK (month BETWEEN 1 AND 12),
    total_revenue NUMERIC(14,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monthlyca_y_m ON monthly_ca(year, month);

-- Agrégats journaliers (remplace daily_data PKL)
CREATE TABLE IF NOT EXISTS daily_aggregates (
    date_id     DATE PRIMARY KEY REFERENCES dim_dates(date_id) ON DELETE CASCADE,
    nb_tickets  INT NOT NULL,
    nb_articles INT NOT NULL,
    ca_jour     NUMERIC(14,2) NOT NULL,
    ref_actives INT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dailyagg_tickets ON daily_aggregates(nb_tickets DESC);

-- ══════════════════════════════════════════════════════════════
--  ANNEXE : Vues matérialisées — à créer APRÈS l'import initial
-- ══════════════════════════════════════════════════════════════
-- REFRESH MATERIALIZED VIEW mv_daily_aggregates;
--
-- CREATE MATERIALIZED VIEW mv_daily_aggregates AS
--   SELECT f.date_id,
--          COUNT(DISTINCT (f.date_id, f.ticket_number)) AS nb_tickets,
--          SUM(f.quantity)        AS nb_articles,
--          SUM(f.total_revenue)   AS ca_jour,
--          COUNT(DISTINCT f.product_id) AS ref_actives
--   FROM fact_ticket_lines f GROUP BY 1;
--
-- CREATE MATERIALIZED VIEW mv_monthly_ca AS
--   SELECT d.year, d.month, DATE_TRUNC('month', d.date_id)::DATE AS month_start,
--          SUM(f.total_revenue) AS total_revenue
--   FROM fact_ticket_lines f JOIN dim_dates d ON d.date_id = f.date_id GROUP BY 1,2,3;
--
-- CREATE MATERIALIZED VIEW mv_weekly_tickets AS
--   SELECT d.week_iso,
--          COUNT(DISTINCT (f.date_id, f.ticket_number)) AS nb_tickets_semaine
--   FROM fact_ticket_lines f JOIN dim_dates d ON d.date_id = f.date_id GROUP BY 1;
