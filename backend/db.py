import os
import logging
import psycopg2
from psycopg2 import OperationalError

logger = logging.getLogger("db")

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "retail_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "admin123")

_conn = None


def get_connection():
    global _conn
    if _conn is None or _conn.closed:
        try:
            _conn = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                dbname=DB_NAME,
                user=DB_USER,
                password=DB_PASS,
                connect_timeout=5,
            )
            _conn.autocommit = True
        except OperationalError as e:
            logger.warning("PostgreSQL inaccessible: %s", e)
            _conn = None
            raise
    return _conn


def is_pg_available():
    try:
        c = get_connection()
        cur = c.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        return True
    except Exception as e:
        logger.warning("is_pg_available returned False: %s", e)
        return False


def sql_fetch_all(sql, params=None):
    c = get_connection()
    cur = c.cursor()
    cur.execute(sql, params or ())
    cols = [d[0] for d in cur.description] if cur.description else []
    rows = cur.fetchall()
    return [dict(zip(cols, r)) for r in rows]


def sql_fetch_one(sql, params=None):
    c = get_connection()
    cur = c.cursor()
    cur.execute(sql, params or ())
    cols = [d[0] for d in cur.description] if cur.description else []
    row = cur.fetchone()
    return dict(zip(cols, row)) if row else None


def sql_value(sql, params=None):
    c = get_connection()
    cur = c.cursor()
    cur.execute(sql, params or ())
    row = cur.fetchone()
    return row[0] if row else None
