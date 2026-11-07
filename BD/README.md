# BD - Database Setup

Scripts and schema for setting up the PostgreSQL database for the Retail Intelligence Agent.

## Overview

This folder contains the database initialization scripts, schema definition, and migration audit for the PostgreSQL database used by the retail intelligence system.

## Contents

```
BD/
├── schema.sql                 # Complete database schema (star schema + calculated tables)
├── 001_import_from_pkl.py     # Data import script from pickle files
├── 002_verify_after_import.sql # Verification script after import
└── audit_migration_postgresql.md # Migration audit documentation
```

## Quick Start

### 1. Create Database

Using pgAdmin or psql:

```sql
CREATE DATABASE retail_db OWNER postgres;
```

### 2. Execute Schema

Connect to `retail_db` and execute the schema:

**Using pgAdmin:**
1. Open Query Tool
2. Connect to `retail_db`
3. Paste contents of `schema.sql`
4. Execute (F5)

**Using psql:**
```bash
psql -U postgres -d retail_db -f BD/schema.sql
```

### 3. Import Data (if migrating from pickle files)

```bash
python BD/001_import_from_pkl.py
```

### Product families (demo data only: `demo_data/fix_categories_demo_bakery.sql`)
The original keyword rule put "PAIN AU CHOCOLAT", "PAIN CHOCO AMANDES", "PAIN AUX RAISINS" and "PAIN SUISSE PEPITO" in *Pains & Baguettes* (because of the word "PAIN"), "SANDWICH COMPLET" there too (because of "COMPLET"), and "BOTTEREAU" in *Boissons* (it contains "EAU"). `demo_data/fix_categories_demo_bakery.sql` moves them (specific to the demo bakery's article names, not a setup step; for another client use `category_overrides` in `api_mapping.json`) to *Viennoiseries* / *Traiteur & Sale*. Share of revenue: Pains & Baguettes 45.3 % -> 38.1 %, Viennoiseries 8.1 % -> 13.3 %, Traiteur & Sale 9.5 % -> 11.6 %. Sales, quantities and forecasts are unchanged. Safe to run again.

### Tray sizes (starting values for the demo bakery only: `demo_data/seed_tray_sizes_demo_bakery.sql`)
Sales and forecasts stay in pieces; a *tray* (plaque / batch) is a production unit used on the prep list and stock entry. `product_tray_sizes` holds pieces per tray and a rounding rule per product (`up` = whole tray above, `nearest`, `none` = stay in pieces). The seed gives five **estimates** (baguettes 8, croissant and pain au chocolat 20), flagged *to confirm* in the dashboard until the bakery re-saves them in *Saisie du stock > Tailles de plaque*. A product without a size stays in pieces.
Rounding to whole trays has a price: if a product sells less than a tray a day, a whole tray is more than the day needs. On the last 60 days of real sales, with a perfect forecast, rounding up to the estimated sizes would leave extra pieces worth about 12 % of baguette sales, 16 % (traditional baguette), 36 % (banette), 64 % (croissant), 68 % (pain au chocolat). The prep list shows this as *Whole-tray surplus*, so it is visible, and a product can be set to `nearest` or `none`.

### Settings that belong to one client (`client_settings.json`, project root)
Everything that depends on the shop, not on the code, is in this one file (another file: environment variable `CLIENT_SETTINGS`). It is read by the backend (`backend/config.py`) and by the imports (`BD/analytics.py`, `BD/002_import_from_api.py`). A missing file means neutral values: nothing excluded, no tourist season.
- `non_product_articles`: till articles that are not products (a slicing service, a carrier bag, a deposit, a donation). They stay in revenue and ticket counts, but are left out of every product analysis: rankings and pairs on Vue du Jour, presence, decision matrix, sales rhythm, basket role, regularity, the best products on Performance, the "bought together" rules, and the production screens. A ticket "croissant + bag" counts as a one-product basket. For the demo bakery: COUPE (0.20 EUR, sold with bread on 16,042 tickets; it was in 34 of the 50 stored rules).
- `production_excluded_categories`, `production_excluded_articles`: real products that are not made on site, hidden from the production screens only (prep list, risk grid, stock entry, tray sizes). For the demo bakery: Boissons, Confiserie & Chocolat.
- `basket_excluded_articles`: products to leave out of the "bought together" rules in addition to the non-products (none for the demo).
- Daily totals: `daily_aggregates.nb_articles` (the "Articles" of Vue du Jour, the history of the shop forecast) counts products only; revenue (`ca_jour`) and tickets stay complete. Both imports recount it with `analytics.recount_daily_articles`. The forecast pipeline drops non-products from its input, so they get no product forecast and are not in the shop total (which is the sum of the products).
- `touristic_months`, `hemisphere` (`south` reverses the seasons), `open_day_min_ratio` / `open_day_min_tickets`, `basket_min_support` / `basket_min_lift`.
Names are compared without case or accents. Events (Noel, Paques...) are in `events_config.json` (profile `FR` for the demo; another country or shop gets its own file via `--events-config`).

### Setting up a new client
1. Get the API documentation or a sample answer; fill `api_mapping.json` (field names, authentication, paging, timezone).
2. Edit `client_settings.json` (and `events_config.json`): the points above.
3. Dry run on a copy of the database: `python BD/002_import_from_api.py --since YYYY-MM-DD --dry-run`; read the report (rows received and dropped, returns skipped, stray days, events found).
4. Check the product list for duplicate names (`article_aliases`), wrong families (`category_overrides`) and articles that are not products (`*_excluded_*`).
5. Confirm tray sizes in *Saisie du stock > Tailles de plaque*.
`python tests/test_other_shop.py` rebuilds a shop that looks nothing like the demo one (English names, southern hemisphere, closed Mondays, 5 months of data, no tourist season, UTC timestamps, no line ids) from an empty database and checks the import, the dashboard endpoints and the trays; run it after any change to the import. With under a year of data the forecast falls back to the 4-week same-weekday average (the global model is skipped for lack of history); this was checked on that test shop.

### 4. Verify Import

```bash
psql -U postgres -d retail_db -f BD/002_verify_after_import.sql
```

### Choosing the data source: pickle file or the supplier's API

The dashboard only ever reads PostgreSQL; the source only decides how the tables are filled.
`BD/run_import.py` picks the importer from `DATA_SOURCE` (or `--source`); the default is `pkl`,
so nothing changes unless you ask for `api`.

```bash
python BD/run_import.py                          # pickle file (default, as before)
python BD/run_import.py --source api             # ticket lines from the supplier's API
python BD/run_import.py --source api --dry-run   # check everything, write nothing
python BD/run_import.py --source api --since 2026-01-01
python BD/002_import_from_api.py --from-json export.json   # no network: an API export already downloaded
```

Setting up the API import (`BD/002_import_from_api.py`):

1. Put the supplier's field names, authentication and pagination in `BD/api_mapping.json`. Only that file changes, not the code.
2. Give the secrets as environment variables, never in a file of the project: `API_BASE_URL`, `API_TOKEN`.
3. The database connection is read from `PG_URL` or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` (`BD/db_config.py`); the defaults are the current local installation.

Rules of the API import:

- From the start date on (by default the last day in the database minus `overlap_days`), the API is the reference: the ticket lines of those days are **replaced**, so running it twice never duplicates sales. Only the days from `--since` to `--until` are replaced: older days and days after `--until` are never touched.
- **Pages** are read until an empty page, so an API that caps its page size (e.g. 100 lines when 1000 are asked) does not lose lines. An API that ignores the page number is detected (same page twice) and nothing is written. If the API gives a total (`response.total_path`), the import checks it received every line.
- **Time zone.** Timestamps with a zone (`...Z`, `...+01:00`) are converted to the shop's time zone (`timezone`, Europe/Paris by default) before taking the day and the hour; one extra day is fetched on each side because the API usually filters on the UTC date. A warning is printed if more than 5 % of sales fall between midnight and 4 am.
- **Products sold by weight** (quantity 0.35 kg…): each line counts as 1 item, at the amount actually paid, so revenue stays exact. Detected automatically from a non-whole quantity; `weight_articles` lists products that can land on a round weight.
- **Families follow the till.** Each product takes its most recent family; `category_overrides` also applies to products already in the database. A missing family (`Autre`) never replaces a real one.
- Everything is downloaded and checked before anything is written, then written in one transaction: on any error the database stays as it was.
- It refuses (and writes nothing) if line identifiers are duplicated or already used by days outside the import. Lines with a negative quantity (returns) are skipped and counted in the report, because `fact_ticket_lines` does not accept them.
- It rebuilds `daily_aggregates` and `monthly_ca` from the ticket lines, extends `dim_dates` (15 days after the last sale), and adds new products and categories. The season comes from the date.
- **Events** (Noël, Pâques, Galette des Rois...): if the API provides an `event` field it is used; otherwise the day is labelled from the calendar in `BD/events_config.json` (rules in `BD/events_calendar.py`). The French events are kept by default and are easy to switch off:
  - all of them: set `"enabled": false` at the top of the file (every day becomes `Jour Normal`);
  - one of them: set that event's `"enabled": false`;
  - other countries or shops: add events with the rule types `fixed`, `month`, `range`, `easter`, `nth_weekday` (e.g. US Thanksgiving) or `mothers_day_fr`. `--events-config other.json` tries a different file.
  - Official public holidays are not duplicated here: the forecast already handles them with `jours_feries_pays` in `forecasting/config.json`.
  - The calendar reproduces the event labels of 655 of the 658 sales days already in the database; the 3 others (1–3 April 2024, within three days of Easter) were labelled `Jour Normal` by the original notebook, which missed events crossing a month boundary.
- **Sales speed and association rules** (`product_velocity_stats`, `association_rules`) are recomputed from the ticket lines in the same transaction (`BD/analytics.py`; `--no-analytics` skips it). Sales speed uses the original notebook's formulas and reproduces the stored values exactly for all 144 products. The rules use the same Apriori settings; one deliberate correction: a ticket is the pair (day, ticket number), as everywhere else in the dashboard, whereas the notebook used the ticket number alone (numbers are reused from one day to the next: 131,315 distinct numbers for 131,853 real tickets). Result on the current data: the same 50 rules (61 rows) with lift within 0.02 and confidence within 0.005 of the old stored values before the COUPE removal (the live table was then recomputed: 22 rows, 18 rules). Articles listed in `basket_excluded_articles` (client_settings.json) are removed from the baskets first; for the demo bakery that is COUPE (bread slicing, 0.20 EUR), which was in 34 of the 50 stored rules. `product_penetration` is not recomputed: no dashboard page reads it.
- **Open days.** `daily_aggregates` only holds days the shop was open (the dashboard reads "the last day" there, and the forecast history). A day is open when it reaches `open_day_min_ratio` (15 %) of the usual number of tickets, the median of the 28 previous sales days: a few stray sales on a closed Monday or Wednesday do not make an open day, whatever the size of the shop. This is the same rule the forecast uses (`seuil_jour_ouvert_pct` in `forecasting/config.json`: keep the two in agreement). `open_day_min_tickets` in `client_settings.json` replaces it with a fixed number if you prefer. The stray days' ticket lines are still imported; they just do not count as open days.
- **Tourist season flag.** `dim_dates.is_touristic` is set from the months listed in `touristic_months` (client_settings.json; none by default) up to the last day with sales, and corrected on days that were put in the calendar before their sales arrived. It is deliberately left false after the last sale: the forecast then projects last year's season. A half-filled future calendar would make it think the calendar is complete and drop the season.
- **Fixing what the till sends.** In `api_mapping.json`: `article_aliases` merges two names of one product (a duplicated till button), `category_overrides` corrects a wrong family.
- The forecasts are refreshed at the end (`--no-refresh` to skip). The Performance page notices new data by itself (it compares a small fingerprint of `daily_aggregates`), so there is no need to restart the backend.
- Tested against a fake supplier API (`tests/fake_supplier_api.py`): capped pages, UTC timestamps, sales by weight, a family change, returns.

## Database Schema

### Star Schema Architecture

The database uses a star schema with fact tables and dimension tables:

#### Dimensions (Layer 1)

**`dim_categories`**
- Product categories (e.g., "Viennoiserie", "Pâtisserie")

**`dim_seasons`**
- Weather/tourism seasons

**`dim_events`**
- Events (holidays, promotions, normal days)
- 98 values including "Jour Normal"

**`dim_products`**
- Products/articles (~145 SKUs)
- Foreign key to `dim_categories`
- **Note**: No `unit_price` column (price is historical per ticket line)

**`dim_dates`**
- Date dimensions
- Day of week, month, weekend flags
- Touristic season flags

**`forecast_models`**
- Forecast model lookup table

#### Fact Tables (Layer 2)

**`fact_ticket_lines`**
- Transaction line items
- References: `product_id`, `date_id`, `event_id`
- Fields: `quantity`, `total_revenue`, `unit_price`

**`fact_ticket_lines_history`**
- Historical ticket lines for Prophet training

#### Calculated Tables (Layer 3)

**`daily_aggregates`**
- Daily aggregated metrics
- Revenue, tickets, articles, average basket

**`prophet_forecasts`**
- Prophet demand forecasts
- 7/14/30 day horizons
- Confidence intervals

**`prophet_forecast_components`**
- Forecast components (trend, seasonality, holidays)

#### RAG Tables (Layer 4)

**`rag_knowledge`**
- Knowledge base chunks
- Embeddings stored as JSONB
- Semantic search support

## Schema.sql Structure

The schema is organized in layers:

1. **Layer 1**: Dimensions (categories, seasons, events, products, dates)
2. **Layer 2**: Fact tables (ticket lines, ticket lines history)
3. **Layer 3**: Calculated tables (daily aggregates, forecasts)
4. **Layer 4**: RAG knowledge base

### Key Indexes

- `idx_products_category` on `dim_products(category_id)`
- `idx_ticket_lines_product` on `fact_ticket_lines(product_id)`
- `idx_ticket_lines_date` on `fact_ticket_lines(date_id)`
- Indexes on forecast and RAG tables for performance

## Import Script (001_import_from_pkl.py)

### Purpose

Migrates data from existing pickle files to PostgreSQL. This is used when transitioning from the legacy system to the new PostgreSQL database.

### Prerequisites

- PostgreSQL database created with schema
- Pickle files with legacy data
- Python dependencies installed

### Usage

```bash
python BD/001_import_from_pkl.py
```

The script:
1. Reads pickle files
2. Transforms data to match schema
3. Inserts into PostgreSQL tables
4. Logs progress and errors

## Verification Script (002_verify_after_import.sql)

### Purpose

Verifies data integrity after import from pickle files.

### Checks Performed

- Row counts for all tables
- Foreign key integrity
- Data type validation
- Reference integrity

### Usage

```bash
psql -U postgres -d retail_db -f BD/002_verify_after_import.sql
```

Review the output for any errors or warnings.

## Migration Audit

The file `audit_migration_postgresql.md` contains:
- Detailed migration documentation
- Comparison between legacy system and PostgreSQL
- Known issues and resolutions
- Performance considerations

Review this document before performing a migration.

## Database Maintenance

### Backups

```bash
pg_dump -U postgres -d retail_db > backup_$(date +%Y%m%d).sql
```

### Restore

```bash
psql -U postgres -d retail_db < backup_YYYYMMDD.sql
```

### Index Maintenance

```sql
-- Rebuild indexes
REINDEX DATABASE retail_db;

-- Analyze tables for query optimization
ANALYZE;
```

## Common Issues

### Connection Errors

**Problem**: Cannot connect to PostgreSQL

**Solutions**:
1. Check PostgreSQL is running
2. Verify connection parameters in `.env`
3. Check firewall settings

### Schema Execution Errors

**Problem**: Schema.sql fails to execute

**Solutions**:
1. Ensure database exists
2. Check for conflicting table names
3. Review error messages in pgAdmin

### Import Failures

**Problem**: Pickle import fails

**Solutions**:
1. Verify pickle files exist
2. Check file paths in script
3. Review error logs
4. Ensure data matches schema expectations

## Security Considerations

### User Permissions

Create a dedicated user for the application:

```sql
CREATE USER retail_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE retail_db TO retail_user;
GRANT USAGE ON SCHEMA public TO retail_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO retail_user;
```

### Environment Variables

Never commit sensitive credentials:
- Database passwords in `.env` (add to `.gitignore`)
- Use different passwords for dev/staging/production

## Performance Tips

1. **Indexes**: Ensure all foreign keys are indexed
2. **Vacuum**: Run `VACUUM ANALYZE` regularly
3. **Connection Pooling**: Use connection pooling in the backend
4. **Query Optimization**: Use `EXPLAIN ANALYZE` for slow queries

## Contributing

When modifying the database schema:

1. Update `schema.sql` with changes
2. Add migration scripts in versioned format (e.g., `003_add_new_column.sql`)
3. Update this README
4. Test changes on a copy of the database first
5. Document breaking changes

## Troubleshooting

### Table Already Exists

If you get "table already exists" errors, you can drop and recreate:

```sql
DROP TABLE IF EXISTS fact_ticket_lines CASCADE;
-- Repeat for other tables
```

**Warning**: This deletes all data!

### Foreign Key Violations

Check that referenced rows exist before inserting.

### Encoding Issues

Ensure client encoding is UTF-8 (set in schema.sql)

## Contact

For questions or issues, please refer to the main project repository.
