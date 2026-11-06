"""
BD/db_config.py
================
Connexion PostgreSQL partagée par les scripts d'import (pkl et API).

Réglages par variables d'environnement (valeurs par défaut = installation actuelle) :
  PG_URL                     URL SQLAlchemy complète (prioritaire si définie)
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
"""

import os
from urllib.parse import quote_plus


def get_pg_url() -> str:
    url = os.getenv("PG_URL")
    if url:
        return url
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "retail_db")
    user = os.getenv("DB_USER", "postgres")
    pwd = os.getenv("DB_PASS", "admin123")
    return f"postgresql+psycopg2://{quote_plus(user)}:{quote_plus(pwd)}@{host}:{port}/{name}"


PG_URL = get_pg_url()
