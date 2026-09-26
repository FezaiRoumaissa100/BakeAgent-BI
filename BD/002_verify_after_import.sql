-- ============================================================
-- BD/002_verify_after_import.sql
-- Vérification 1:1 après migration depuis retail_data.pkl
-- À exécuter DANS pgAdmin (Query Tool) sur retail_db
-- Puis comparer avec la section §3 de audit_migration_postgresql.md
-- ============================================================

SET client_encoding = 'UTF8';

\timing off

\echo === 3.1 TOTAUX GÉNÉRAUX (PKL §3.1) ===
SELECT
  SUM(total_revenue)::NUMERIC(14,2)          AS "CA total €",
  SUM(quantity)                                AS "Quantités totales",
  COUNT(DISTINCT ticket_number)                AS "Tickets numéros",
  COUNT(DISTINCT (date_id, ticket_number))     AS "Tickets (date+num)",
  COUNT(DISTINCT product_id)                   AS "Articles référencés",
  (SELECT COUNT(*) FROM dim_categories)        AS "Catégories",
  COUNT(DISTINCT date_id)                      AS "Jours ouverts"
FROM fact_ticket_lines;

\echo
\echo === 3.2 CA PAR ANNÉE (PKL §3.2) ===
SELECT
  d.year                                               AS "Année",
  TO_CHAR(SUM(f.total_revenue), '999G999G999D99')      AS "CA €"
FROM fact_ticket_lines f
JOIN dim_dates d ON d.date_id = f.date_id
GROUP BY 1 ORDER BY 1;

\echo
\echo === 3.3 CA MENSUEL — comparé à la table monthly_ca pré-calculée ===
WITH ca_groupby AS (
  SELECT DATE_TRUNC('month', d.date_id)::DATE                        AS month_start,
         SUM(f.total_revenue)::NUMERIC(14,2)                          AS ca_groupby
  FROM fact_ticket_lines f JOIN dim_dates d ON d.date_id = f.date_id
  GROUP BY 1
)
SELECT TO_CHAR(g.month_start, 'YYYY-MM')                             AS "Mois",
       TO_CHAR(g.ca_groupby,         '999G999G999D99')                AS "CA groupby",
       TO_CHAR(m.total_revenue,      '999G999G999D99')                AS "CA monthly_ca",
       TO_CHAR(ABS(g.ca_groupby - COALESCE(m.total_revenue,0)),
               '999G999G999D99')                                      AS "Diff €",
       ROUND(100.0 * ABS(g.ca_groupby - COALESCE(m.total_revenue,0))
                 / NULLIF(m.total_revenue, 0), 4)                     AS "Diff %"
FROM ca_groupby g
FULL OUTER JOIN monthly_ca m ON m.month_start = g.month_start
ORDER BY COALESCE(g.month_start, m.month_start);

\echo
\echo === 3.4 AGRÉGATS JOURNALIERS — fact vs daily_aggregates ===
WITH agg_fact AS (
  SELECT f.date_id,
         COUNT(DISTINCT (f.date_id, f.ticket_number))   AS nb_tickets_fact,
         SUM(f.quantity)                                 AS nb_articles_fact,
         SUM(f.total_revenue)::NUMERIC(14,2)             AS ca_jour_fact
  FROM fact_ticket_lines f GROUP BY 1
)
SELECT 'Tickets'   AS "Colonne", MAX(ABS(a.nb_tickets_fact   - COALESCE(d.nb_tickets,0)))::TEXT   AS "|Δ| max"
FROM agg_fact a FULL OUTER JOIN daily_aggregates d ON d.date_id = a.date_id
UNION ALL
SELECT 'Articles'  AS "Colonne", MAX(ABS(a.nb_articles_fact  - COALESCE(d.nb_articles,0)))::TEXT
FROM agg_fact a FULL OUTER JOIN daily_aggregates d ON d.date_id = a.date_id
UNION ALL
SELECT 'CA'        AS "Colonne", MAX(ABS(a.ca_jour_fact      - COALESCE(d.ca_jour,0)))::TEXT
FROM agg_fact a FULL OUTER JOIN daily_aggregates d ON d.date_id = a.date_id;

\echo
\echo === COMPTAGES PAR TABLE (sanity-check global) ===
SELECT 'dim_categories'         AS t, COUNT(*) FROM dim_categories
UNION ALL SELECT 'dim_seasons',         COUNT(*) FROM dim_seasons
UNION ALL SELECT 'dim_events',          COUNT(*) FROM dim_events
UNION ALL SELECT 'dim_products',        COUNT(*) FROM dim_products
UNION ALL SELECT 'dim_dates',           COUNT(*) FROM dim_dates
UNION ALL SELECT 'fact_ticket_lines',   COUNT(*) FROM fact_ticket_lines
UNION ALL SELECT 'forecast_models',     COUNT(*) FROM forecast_models
UNION ALL SELECT 'product_penetration', COUNT(*) FROM product_penetration
UNION ALL SELECT 'product_velocity_stats', COUNT(*) FROM product_velocity_stats
UNION ALL SELECT 'association_rules',   COUNT(*) FROM association_rules
UNION ALL SELECT 'prophet_forecasts',   COUNT(*) FROM prophet_forecasts
UNION ALL SELECT 'ml_metrics',          COUNT(*) FROM ml_metrics
UNION ALL SELECT 'monthly_ca',          COUNT(*) FROM monthly_ca
UNION ALL SELECT 'daily_aggregates',    COUNT(*) FROM daily_aggregates
ORDER BY 1;

\echo
\echo === CONTRÔLE INTEGRITÉ FK : 0 ligne orpheline ===
SELECT 'fact_ticket_lines sans date_id'     AS ctrl, COUNT(*) FROM fact_ticket_lines f WHERE NOT EXISTS (SELECT 1 FROM dim_dates d WHERE d.date_id=f.date_id)
UNION ALL SELECT 'fact sans product_id',    COUNT(*) FROM fact_ticket_lines f WHERE NOT EXISTS (SELECT 1 FROM dim_products p WHERE p.product_id=f.product_id)
UNION ALL SELECT 'penetration sans produit', COUNT(*) FROM product_penetration   p WHERE NOT EXISTS (SELECT 1 FROM dim_products x WHERE x.product_id=p.product_id)
UNION ALL SELECT 'velocity sans produit',    COUNT(*) FROM product_velocity_stats v WHERE NOT EXISTS (SELECT 1 FROM dim_products x WHERE x.product_id=v.product_id)
UNION ALL SELECT 'regles sans conséquent',   COUNT(*) FROM association_rules   a WHERE NOT EXISTS (SELECT 1 FROM dim_products x WHERE x.product_id=a.consequent_id);

\echo
\echo === SPOT-CHECK — pénétration TOP 5 (comparatif audit) ===
SELECT
  p.article_name                                     AS "Article",
  pn.penetration_rate                                AS "Penetration %",
  pn.tickets_count                                   AS "Tickets",
  pn.statut_strategique                              AS "Statut"
FROM product_penetration pn
JOIN dim_products p ON p.product_id = pn.product_id
ORDER BY pn.penetration_rate DESC NULLS LAST LIMIT 5;

\echo
\echo === SPOT-CHECK — Apriori TOP 5 lift (échelle 0-1 native) ===
SELECT
  a.rule_id,
  a.antecedents_str                                  AS "Si le client achète...",
  c.article_name                                     AS "... alors aussi :",
  a.support, a.confidence, a.lift
FROM association_rules a
JOIN dim_products c ON c.product_id = a.consequent_id
ORDER BY a.lift DESC NULLS LAST LIMIT 5;
