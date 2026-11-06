"""
BD/events_calendar.py
======================
Calendrier des événements de la boutique (Noël, Pâques, Galette des Rois...), réglable sans toucher au code.

Utilisé par l'import API (BD/002_import_from_api.py) quand l'API ne fournit pas elle-même le nom de l'événement.
Les réglages sont dans BD/events_config.json :
  * "enabled": false           -> aucun événement, tous les jours sont « Jour Normal »
  * "events"[i]."enabled"      -> garder (true) ou retirer (false) un événement précis
  * ajouter / modifier un événement : une entrée avec un nom et une règle (types ci-dessous)

Types de règle :
  fixed            {"type": "fixed", "month": 2, "day": 14}
  month            {"type": "month", "month": 1}                      (tout le mois)
  range            {"type": "range", "from": [12, 20], "to": [12, 25]}
  easter           {"type": "easter", "offset_from": -3, "offset_to": 3}   (jours autour du dimanche de Pâques)
  nth_weekday      {"type": "nth_weekday", "month": 11, "weekday": 3, "n": 4}   (weekday : 0 = lundi ... 6 = dimanche ;
                                                                                n : 1..4, ou -1 pour le dernier)
  mothers_day_fr   {"type": "mothers_day_fr"}   (dernier dimanche de mai, ou 1er dimanche de juin si Pentecôte)

Quand plusieurs règles s'appliquent le même jour, la première de la liste gagne (comme dans le notebook d'origine :
le 1er janvier est « Jour de l'An », pas « Galette des Rois »).

Les jours fériés officiels (loi, par pays) ne sont PAS traités ici : le calcul des prévisions les gère déjà à part, avec le
réglage « jours_feries_pays » de forecasting/config.json. Les mettre aussi ici les compterait deux fois.
"""

import json
from datetime import date, timedelta
from pathlib import Path

DEFAULT_EVENT = "Jour Normal"
CONFIG_PATH = Path(__file__).resolve().parent / "events_config.json"
_RULE_TYPES = ("fixed", "month", "range", "easter", "nth_weekday", "mothers_day_fr")


class EventsConfigError(ValueError):
    pass


def easter_sunday(year: int) -> date:
    """Dimanche de Pâques (calendrier grégorien, algorithme de Meeus/Jones/Butcher)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    if n > 0:
        first = date(year, month, 1)
        return first + timedelta(days=(weekday - first.weekday()) % 7 + 7 * (n - 1))
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    last = nxt - timedelta(days=1)
    return last - timedelta(days=(last.weekday() - weekday) % 7)


def _mothers_day_fr(year: int) -> date:
    last_sunday_may = _nth_weekday(year, 5, 6, -1)
    pentecost = easter_sunday(year) + timedelta(days=49)
    return _nth_weekday(year, 6, 6, 1) if pentecost == last_sunday_may else last_sunday_may


def _check_md(month, day, where):
    try:
        date(2024, int(month), int(day))      # 2024 = année bissextile : accepte le 29 février
    except (TypeError, ValueError):
        raise EventsConfigError(f"{where} : date invalide (mois {month}, jour {day})")


def _validate_rule(rule: dict, where: str):
    if not isinstance(rule, dict) or rule.get("type") not in _RULE_TYPES:
        raise EventsConfigError(f"{where} : 'rule.type' doit être l'un de {', '.join(_RULE_TYPES)}")
    t = rule["type"]
    if t == "fixed":
        _check_md(rule.get("month"), rule.get("day"), where)
    elif t == "month":
        if not (isinstance(rule.get("month"), int) and 1 <= rule["month"] <= 12):
            raise EventsConfigError(f"{where} : 'month' doit être un entier de 1 à 12")
    elif t == "range":
        f, to = rule.get("from"), rule.get("to")
        if not (isinstance(f, list) and isinstance(to, list) and len(f) == 2 and len(to) == 2):
            raise EventsConfigError(f"{where} : 'from' et 'to' doivent être [mois, jour]")
        _check_md(f[0], f[1], where); _check_md(to[0], to[1], where)
        if tuple(f) > tuple(to):
            raise EventsConfigError(f"{where} : 'from' doit précéder 'to' dans la même année")
    elif t == "easter":
        a, b = rule.get("offset_from"), rule.get("offset_to")
        if not (isinstance(a, int) and isinstance(b, int) and a <= b):
            raise EventsConfigError(f"{where} : 'offset_from' et 'offset_to' doivent être des entiers (from <= to)")
    elif t == "nth_weekday":
        if not (isinstance(rule.get("month"), int) and 1 <= rule["month"] <= 12
                and isinstance(rule.get("weekday"), int) and 0 <= rule["weekday"] <= 6
                and rule.get("n") in (1, 2, 3, 4, -1)):
            raise EventsConfigError(f"{where} : month 1-12, weekday 0-6 et n parmi 1, 2, 3, 4, -1 sont requis")


def load_config(path=None) -> dict:
    path = Path(path) if path else CONFIG_PATH
    try:
        with open(path, encoding="utf-8") as f:
            cfg = json.load(f)
    except FileNotFoundError:
        raise EventsConfigError(f"Fichier des événements introuvable : {path}")
    except json.JSONDecodeError as e:
        raise EventsConfigError(f"{path} n'est pas un JSON valide : {e}")
    if not isinstance(cfg.get("enabled", True), bool):
        raise EventsConfigError("'enabled' doit être true ou false")
    seen = set()
    for i, ev in enumerate(cfg.get("events") or []):
        where = f"{path.name}, événement n°{i + 1}"
        name = (ev.get("name") or "").strip() if isinstance(ev, dict) else ""
        if not name:
            raise EventsConfigError(f"{where} : 'name' manquant")
        if name.lower() == DEFAULT_EVENT.lower():
            raise EventsConfigError(f"{where} : « {DEFAULT_EVENT} » est réservé (jour sans événement)")
        if name in seen:
            raise EventsConfigError(f"{where} : le nom « {name} » est en double")
        seen.add(name)
        if not isinstance(ev.get("enabled", True), bool):
            raise EventsConfigError(f"{where} ({name}) : 'enabled' doit être true ou false")
        _validate_rule(ev.get("rule"), f"{where} ({name})")
    return cfg


def _matches(rule: dict, d: date) -> bool:
    t = rule["type"]
    if t == "fixed":
        return (d.month, d.day) == (rule["month"], rule["day"])
    if t == "month":
        return d.month == rule["month"]
    if t == "range":
        return tuple(rule["from"]) <= (d.month, d.day) <= tuple(rule["to"])
    if t == "easter":
        delta = (d - easter_sunday(d.year)).days
        return rule["offset_from"] <= delta <= rule["offset_to"]
    if t == "nth_weekday":
        return d == _nth_weekday(d.year, rule["month"], rule["weekday"], rule["n"])
    if t == "mothers_day_fr":
        return d == _mothers_day_fr(d.year)
    return False


def build_labeler(config=None):
    """Retourne une fonction date -> nom de l'événement ('Jour Normal' si aucun)."""
    cfg = config if config is not None else load_config()
    if not cfg.get("enabled", True):
        return lambda d: DEFAULT_EVENT
    rules = [(ev["name"].strip(), ev["rule"]) for ev in cfg.get("events", []) if ev.get("enabled", True)]

    def label(d: date) -> str:
        for name, rule in rules:
            if _matches(rule, d):
                return name
        return DEFAULT_EVENT
    return label
