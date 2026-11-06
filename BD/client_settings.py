"""
BD/client_settings.py
======================
Lecture du fichier de réglages client (client_settings.json, à la racine du projet).
Même fichier lu par backend/config.py. Fichier alternatif : variable d'environnement CLIENT_SETTINGS.
Fichier absent => valeurs neutres (aucune exclusion, pas de saison touristique).
"""

import json
import os
import unicodedata
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parent.parent / "client_settings.json"

NEUTRAL = {
    "non_product_articles": [],
    "production_excluded_categories": [],
    "production_excluded_articles": [],
    "basket_excluded_articles": [],
    "touristic_months": [],
    "hemisphere": "north",
    "open_day_min_ratio": 0.15,
    "open_day_min_tickets": None,
    "basket_min_support": 0.01,
    "basket_min_lift": 1.2,
}


class SettingsError(ValueError):
    pass


def norm(s) -> str:
    """Comparaison sans majuscules ni accents ni espaces autour."""
    t = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode("ascii")
    return t.strip().casefold()


def load(path=None) -> dict:
    p = Path(path or os.environ.get("CLIENT_SETTINGS") or DEFAULT_PATH)
    cfg = dict(NEUTRAL)
    if p.exists():
        try:
            raw = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise SettingsError(f"{p} n'est pas un JSON valide : {e}")
        cfg.update({k: v for k, v in raw.items() if k in NEUTRAL})
    for k in ("non_product_articles", "production_excluded_categories", "production_excluded_articles",
              "basket_excluded_articles"):
        if not isinstance(cfg[k], list):
            raise SettingsError(f"{k} doit être une liste de noms")
    m = cfg["touristic_months"]
    if not isinstance(m, list) or not all(isinstance(x, int) and 1 <= x <= 12 for x in m):
        raise SettingsError("touristic_months doit être une liste de mois de 1 à 12 (ou [])")
    if cfg["hemisphere"] not in ("north", "south"):
        raise SettingsError("hemisphere doit être 'north' ou 'south'")
    r = cfg["open_day_min_ratio"]
    if isinstance(r, bool) or not isinstance(r, (int, float)) or not 0 <= r < 1:
        raise SettingsError("open_day_min_ratio doit être un nombre entre 0 et 1")
    t = cfg["open_day_min_tickets"]
    if t is not None and (isinstance(t, bool) or not isinstance(t, int) or t < 1):
        raise SettingsError("open_day_min_tickets doit être un entier >= 1 ou null")
    for k in ("basket_min_support", "basket_min_lift"):
        if isinstance(cfg[k], bool) or not isinstance(cfg[k], (int, float)) or cfg[k] <= 0:
            raise SettingsError(f"{k} doit être un nombre positif")
    return cfg
