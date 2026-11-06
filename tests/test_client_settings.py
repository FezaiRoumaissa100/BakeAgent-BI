"""Tests sans base de données : réglages client, jours ouverts adaptatifs, saisons, calendrier d'événements.
    python tests/test_client_settings.py
"""
import importlib.util
import json
import os
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

BD = Path(__file__).resolve().parent.parent / "BD"
sys.path.insert(0, str(BD))
import client_settings  # noqa: E402
import events_calendar  # noqa: E402

spec = importlib.util.spec_from_file_location("importer", BD / "002_import_from_api.py")
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)


def tmp_json(obj):
    f = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
    json.dump(obj, f); f.close()
    return f.name


class Settings(unittest.TestCase):
    def test_missing_file_is_neutral(self):
        cfg = client_settings.load(Path(tempfile.gettempdir()) / "n_existe_pas.json")
        self.assertEqual(cfg["production_excluded_articles"], [])
        self.assertEqual(cfg["touristic_months"], [])

    def test_partial_file_keeps_defaults(self):
        cfg = client_settings.load(tmp_json({"touristic_months": [12, 1]}))
        self.assertEqual(cfg["touristic_months"], [12, 1])
        self.assertEqual(cfg["open_day_min_ratio"], 0.15)

    def test_invalid_values_refused(self):
        for bad in ({"touristic_months": [13]}, {"touristic_months": "7,8"}, {"hemisphere": "east"}, {"open_day_min_ratio": 1.5},
                    {"open_day_min_ratio": True}, {"open_day_min_tickets": 0}, {"production_excluded_articles": "COUPE"},
                    {"basket_min_support": 0}):
            with self.assertRaises(client_settings.SettingsError, msg=str(bad)):
                client_settings.load(tmp_json(bad))

    def test_invalid_json_refused(self):
        f = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False); f.write("{pas du json"); f.close()
        with self.assertRaises(client_settings.SettingsError):
            client_settings.load(f.name)

    def test_non_product_articles_are_out_of_production_and_baskets(self):
        p = tmp_json({"non_product_articles": ["Sac"]})
        env = dict(os.environ, CLIENT_SETTINGS=p)
        import subprocess
        out = subprocess.run([sys.executable, "-c",
                              "import sys; sys.path.insert(0, r'%s'); import config; print(config.is_product('SAC'), config.is_produced('sac', 'Pain'), "
                              "config.is_product('Croissant'))" % (BD.parent / "backend")], capture_output=True, text=True, env=env).stdout.split()
        self.assertEqual(out, ["False", "False", "True"])
        os.environ["CLIENT_SETTINGS"] = p
        try:
            import analytics
            df = pd.DataFrame({"date_id": [date(2026, 1, 1)] * 6, "ticket_number": ["1", "1", "2", "2", "3", "3"],
                               "product_id": [1, 2, 1, 2, 1, 3], "article": ["Pain", "Sac", "Pain", "Sac", "Pain", "Beurre"],
                               "quantity": [1] * 6})
            rules = analytics.compute_rules(df, min_support=0.01, min_lift=0.0)
            self.assertFalse(any("Sac" in r["ante_str"] + r["cons_str"] for r in rules))
        finally:
            del os.environ["CLIENT_SETTINGS"]

    def test_norm_ignores_case_accents_spaces(self):
        self.assertEqual(client_settings.norm("  Café  "), client_settings.norm("CAFE"))

    def test_backend_config_reads_the_same_file(self):
        p = tmp_json({"production_excluded_categories": ["Boissons"], "production_excluded_articles": ["Sac"]})
        env = dict(os.environ, CLIENT_SETTINGS=p)
        import subprocess
        out = subprocess.run([sys.executable, "-c",
                              "import sys; sys.path.insert(0, r'%s'); import config; print(config.is_produced('Pain','Viennoiseries'), "
                              "config.is_produced('x','BOISSONS'), config.is_produced('SAC','Pain'))" % (BD.parent / "backend")],
                             capture_output=True, text=True, env=env).stdout.split()
        self.assertEqual(out, ["True", "False", "False"])


class OpenDays(unittest.TestCase):
    def series(self, values, start=date(2026, 1, 5)):
        return pd.Series(values, index=[start + timedelta(days=i) for i in range(len(values))], dtype="int64")

    def test_stray_day_is_closed_normal_day_open(self):
        s = self.series([100] * 20 + [3] + [100] * 5)
        self.assertNotIn(date(2026, 1, 5) + timedelta(days=20), imp.open_days(s, 0.15))
        self.assertEqual(len(imp.open_days(s, 0.15)), 25)

    def test_scales_with_the_shop_size(self):
        small = self.series([10] * 20 + [1, 2] + [10] * 3)          # a small shop: 2 tickets is a stray day only if < 1.5
        o = imp.open_days(small, 0.15)
        self.assertIn(date(2026, 1, 5) + timedelta(days=21), o)     # 2 tickets >= 1.5 : counts as open
        big = self.series([400] * 20 + [30] + [400] * 3)
        self.assertNotIn(date(2026, 1, 5) + timedelta(days=20), imp.open_days(big, 0.15))   # 30 < 60

    def test_absolute_threshold_overrides(self):
        s = self.series([100] * 10 + [40])
        self.assertIn(date(2026, 1, 5) + timedelta(days=10), imp.open_days(s, 0.15))
        self.assertNotIn(date(2026, 1, 5) + timedelta(days=10), imp.open_days(s, 0.15, min_tickets=50))

    def test_little_history_everything_open(self):
        s = self.series([5, 4, 6])
        self.assertEqual(imp.open_days(s, 0.15), set(s.index))
        self.assertEqual(imp.open_days(pd.Series(dtype="int64"), 0.15), set())

    def test_season_shift_in_activity_does_not_close_days(self):
        s = self.series([200] * 28 + [90] * 28)       # activity halves: stays open (reference follows the shop)
        self.assertEqual(len(imp.open_days(s, 0.15)), 56)


class Calendar(unittest.TestCase):
    def test_hemisphere(self):
        self.assertEqual(imp.season_for(date(2026, 1, 15)), "Hiver")
        self.assertEqual(imp.season_for(date(2026, 1, 15), "south"), "Ete")
        self.assertEqual(imp.season_for(date(2026, 7, 1), "south"), "Hiver")

    def test_touristic_months_come_from_settings(self):
        self.assertFalse(imp.is_touristic(date(2026, 7, 10)))
        self.assertTrue(imp.is_touristic(date(2026, 7, 10), (7, 8)))
        self.assertTrue(imp.is_touristic(date(2026, 1, 3), [12, 1]))

    def test_events_profile_and_toggle(self):
        cfg = events_calendar.load_config()
        self.assertEqual(cfg.get("profile"), "FR")
        self.assertEqual(events_calendar.build_labeler(cfg)(date(2025, 12, 24)), "Noel")
        cfg["enabled"] = False
        self.assertEqual(events_calendar.build_labeler(cfg)(date(2025, 12, 24)), "Jour Normal")


if __name__ == "__main__":
    unittest.main(verbosity=1)
