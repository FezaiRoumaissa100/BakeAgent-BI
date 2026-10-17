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

### 4. Verify Import

```bash
psql -U postgres -d retail_db -f BD/002_verify_after_import.sql
```

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
