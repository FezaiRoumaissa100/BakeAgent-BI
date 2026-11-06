"""
Tests de l'API des tailles de plaque (backend/engines/tray_engine.py + routes de backend/main.py).

Ils tournent sur une base jetable (retail_db_traytest), jamais sur retail_db :
    python tests/test_trays_engine.py
Connexion administrateur : variables DB_HOST, DB_PORT, DB_USER, DB_PASS (mêmes défauts que le projet).
"""
import os
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parent.parent
TEST_DB = "retail_db_traytest"
ADMIN = dict(host=os.getenv("DB_HOST", "127.0.0.1"), port=os.getenv("DB_PORT", "5432"),
             user=os.getenv("DB_USER", "postgres"), password=os.getenv("DB_PASS", "admin123"))


def _build_test_db():
    adm = psycopg2.connect(dbname="postgres", **ADMIN)
    adm.autocommit = True
    cur = adm.cursor()
    cur.execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
    cur.execute(f"CREATE DATABASE {TEST_DB}")
    adm.close()
    c = psycopg2.connect(dbname=TEST_DB, **ADMIN)
    c.autocommit = True
    cur = c.cursor()
    cur.execute((ROOT / "BD" / "schema.sql").read_text(encoding="utf-8"))
    cur.execute("INSERT INTO dim_categories (category_name) VALUES ('Viennoiseries'), ('Pains & Baguettes')")
    cur.execute("""INSERT INTO dim_products (article_name, category_id) VALUES
        ('CROISSANT', 1), ('BAGUETTE', 2), ('ANCIEN PRODUIT', 2), ('PRODUIT SANS VENTE', 1)""")
    day = date(2025, 12, 20)
    for k in range(10):
        d = day + timedelta(days=k)
        cur.execute("INSERT INTO dim_dates (date_id, year, month, month_name, week_iso, day_of_week, day_name, is_weekend)"
                    " VALUES (%s, %s, %s, 'x', 'x', %s, 'x', false)", (d, d.year, d.month, d.weekday()))
    cur.execute("INSERT INTO dim_dates (date_id, year, month, month_name, week_iso, day_of_week, day_name, is_weekend)"
                " VALUES ('2025-01-05', 2025, 1, 'x', 'x', 6, 'x', true)")
    n = 1
    for k in range(10):                                   # CROISSANT : 30/jour, BAGUETTE : 10/jour sur 10 jours récents
        for pid, q in ((1, 30), (2, 10)):
            cur.execute("INSERT INTO fact_ticket_lines (source_row_id, date_id, ticket_number, product_id, quantity, unit_price,"
                        " total_revenue, hour) VALUES (%s, %s, 't', %s, %s, 1, %s, 9)", (n, day + timedelta(days=k), pid, q, q))
            n += 1
    cur.execute("INSERT INTO fact_ticket_lines (source_row_id, date_id, ticket_number, product_id, quantity, unit_price,"
                " total_revenue, hour) VALUES (%s, '2025-01-05', 't', 3, 5, 1, 5, 9)", (n,))   # vendu seulement il y a longtemps
    # Articles qu'on ne fabrique pas : boisson et service de découpe, bien vendus mais absents des écrans de production
    cur.execute("INSERT INTO dim_categories (category_name) VALUES ('Boissons')")
    cur.execute("INSERT INTO dim_products (article_name, category_id) VALUES ('CAFE OU EAU', 3), ('COUPE', 2)")
    for k in range(10):
        for pid in (5, 6):
            n += 1
            cur.execute("INSERT INTO fact_ticket_lines (source_row_id, date_id, ticket_number, product_id, quantity, unit_price,"
                        " total_revenue, hour) VALUES (%s, %s, 't', %s, 50, 1, 50, 9)", (n + 100, day + timedelta(days=k), pid))
    c.close()


_build_test_db()
os.environ.update(DB_HOST=ADMIN["host"], DB_PORT=str(ADMIN["port"]), DB_NAME=TEST_DB, DB_USER=ADMIN["user"], DB_PASS=ADMIN["password"])
sys.path.insert(0, str(ROOT / "backend"))
from fastapi.testclient import TestClient   # noqa: E402
import main                                  # noqa: E402

client = TestClient(main.app)


def put(pid, body):
    return client.put(f"/api/production/trays/{pid}", json=body)


class TraysApi(unittest.TestCase):
    def setUp(self):
        for pid in (1, 2, 3, 4):
            client.delete(f"/api/production/trays/{pid}")

    def test_list_only_recent_sales_sorted_by_volume(self):
        r = client.get("/api/production/trays").json()
        names = [i["article"] for i in r["items"]]
        self.assertEqual(names, ["CROISSANT", "BAGUETTE"])           # ANCIEN PRODUIT (vendu il y a un an) et SANS VENTE exclus
        self.assertEqual(r["items"][0]["sold"], 300.0)
        self.assertTrue(all(i["pieces_per_tray"] is None for i in r["items"]))
        self.assertEqual(r["roundings"], ["up", "nearest", "none"])

    def test_non_produced_articles_hidden_from_production_screens(self):
        names = [i["article"] for i in client.get("/api/production/trays").json()["items"]]
        self.assertNotIn("CAFE OU EAU", names)
        self.assertNotIn("COUPE", names)
        day_items = [i["article"] for i in client.get("/api/production", params={"date": "2025-12-29"}).json()["items"]]
        self.assertNotIn("CAFE OU EAU", day_items)
        self.assertNotIn("COUPE", day_items)
        self.assertIn("CROISSANT", day_items)

    def test_save_and_read_back_marks_confirmed(self):
        r = put(1, {"pieces_per_tray": 20, "rounding": "up"}).json()
        self.assertEqual(r, {"ok": True, "product_id": 1, "pieces_per_tray": 20, "rounding": "up", "is_estimate": False})
        item = next(i for i in client.get("/api/production/trays").json()["items"] if i["product_id"] == 1)
        self.assertEqual((item["pieces_per_tray"], item["rounding"], item["is_estimate"]), (20, "up", False))

    def test_update_overwrites_and_estimate_flag_cleared(self):
        from db.db import get_connection
        get_connection().cursor().execute("INSERT INTO product_tray_sizes (product_id, pieces_per_tray, rounding, is_estimate)"
                                          " VALUES (2, 6, 'nearest', TRUE) ON CONFLICT (product_id) DO UPDATE SET is_estimate = TRUE")
        item = next(i for i in client.get("/api/production/trays").json()["items"] if i["product_id"] == 2)
        self.assertTrue(item["is_estimate"])
        put(2, {"pieces_per_tray": 8, "rounding": "nearest"})
        item = next(i for i in client.get("/api/production/trays").json()["items"] if i["product_id"] == 2)
        self.assertEqual((item["pieces_per_tray"], item["is_estimate"]), (8, False))

    def test_invalid_values_refused_and_nothing_written(self):
        bad = [{"pieces_per_tray": 0, "rounding": "up"}, {"pieces_per_tray": -3, "rounding": "up"},
               {"pieces_per_tray": 1001, "rounding": "up"}, {"pieces_per_tray": 12.5, "rounding": "up"},
               {"pieces_per_tray": "abc", "rounding": "up"}, {"pieces_per_tray": "nan", "rounding": "up"},
               {"pieces_per_tray": "inf", "rounding": "up"}, {"pieces_per_tray": None, "rounding": "up"},
               {"pieces_per_tray": "", "rounding": "up"}, {"pieces_per_tray": True, "rounding": "up"},
               {"pieces_per_tray": 12, "rounding": "toujours"}, {"rounding": "up"}]
        for b in bad:
            r = put(1, b).json()
            self.assertFalse(r["ok"], b)
            self.assertTrue(r["message"])
        self.assertEqual(client.get("/api/production/trays").json()["nb_with_tray"], 0)

    def test_unknown_product_refused(self):
        self.assertFalse(put(999, {"pieces_per_tray": 12, "rounding": "up"}).json()["ok"])
        self.assertEqual(put("abc", {"pieces_per_tray": 12, "rounding": "up"}).status_code, 422)

    def test_numeric_string_accepted_whole_number_only(self):
        self.assertTrue(put(1, {"pieces_per_tray": "24", "rounding": "up"}).json()["ok"])
        self.assertTrue(put(1, {"pieces_per_tray": 24.0, "rounding": "none"}).json()["ok"])

    def test_delete(self):
        put(1, {"pieces_per_tray": 20, "rounding": "up"})
        self.assertEqual(client.delete("/api/production/trays/1").json(), {"ok": True, "deleted": 1})
        self.assertEqual(client.delete("/api/production/trays/1").json(), {"ok": True, "deleted": 0})
        self.assertEqual(client.get("/api/production/trays").json()["nb_with_tray"], 0)

    def test_product_with_tray_stays_listed_without_recent_sales(self):
        put(3, {"pieces_per_tray": 10, "rounding": "up"})
        names = [i["article"] for i in client.get("/api/production/trays").json()["items"]]
        self.assertIn("ANCIEN PRODUIT", names)

    def test_production_day_items_carry_the_tray(self):
        put(1, {"pieces_per_tray": 20, "rounding": "up"})
        items = client.get("/api/production", params={"date": "2025-12-29"}).json()["items"]
        by = {i["article"]: i for i in items}
        self.assertEqual(by["CROISSANT"]["tray"], {"pieces": 20, "rounding": "up", "estimate": False})
        self.assertIsNone(by["BAGUETTE"]["tray"])

    def test_deleting_a_product_removes_its_tray(self):
        from db.db import get_connection
        put(4, {"pieces_per_tray": 12, "rounding": "up"})
        get_connection().cursor().execute("DELETE FROM dim_products WHERE product_id = 4")
        n = main.sql_value("SELECT COUNT(*) FROM product_tray_sizes WHERE product_id = 4")
        self.assertEqual(n, 0)


if __name__ == "__main__":
    ok = unittest.main(exit=False, verbosity=2).result.wasSuccessful()
    adm = psycopg2.connect(dbname="postgres", **ADMIN)
    adm.autocommit = True
    try:
        from db.db import get_connection
        get_connection().close()
    except Exception:
        pass
    adm.cursor().execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
    adm.close()
    sys.exit(0 if ok else 1)
