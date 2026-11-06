"""
Jours particuliers : jours fériés du pays (réglage « jours_feries_pays » de forecasting/config.json, + les dates
ajoutées à la main « jours_feries_dates ») et événements COURTS du calendrier de la boutique (Réveillon, Noël,
Saint-Valentin, Fête des Mères, Pâques… table dim_events, réglée dans BD/events_config.json).
Un événement qui dure tout un mois (ex. Galette des Rois) est une saison, pas un jour particulier.

Sert à ne pas comparer un jour de fête à un jour ordinaire, et à ne pas compter les jours de fête dans « l'habitude ».
"""
from datetime import date

from db.db import sql_fetch_all

EVENEMENT_COURT_MAX_JOURS = 10   # au-delà (jours de vente dans l'année), l'événement est une saison


def _as_date(v):
    return v if isinstance(v, date) else date.fromisoformat(str(v)[:10])


def special_days(dates):
    """{date: nom} des jours particuliers parmi `dates`."""
    dates = [_as_date(d) for d in dates]
    out = {}
    if not dates:
        return out
    try:
        from engines.product_forecast_engine import _holidays
        fer = _holidays({d.year for d in dates})
        for d in dates:
            if d in fer:
                out[d] = fer[d]
    except Exception:
        pass
    try:
        rows = sql_fetch_all(
            """
            WITH ev AS (
                SELECT f.date_id, e.event_name, e.event_id
                FROM fact_ticket_lines f JOIN dim_events e ON e.event_id = f.event_id
                WHERE f.date_id = ANY(%s::date[]) AND e.is_event
                GROUP BY f.date_id, e.event_name, e.event_id
            ),
            len AS (
                SELECT f.event_id, EXTRACT(YEAR FROM f.date_id) AS y, COUNT(DISTINCT f.date_id) AS n
                FROM fact_ticket_lines f WHERE f.event_id IN (SELECT event_id FROM ev)
                GROUP BY f.event_id, EXTRACT(YEAR FROM f.date_id)
            )
            SELECT ev.date_id, ev.event_name
            FROM ev JOIN len ON len.event_id = ev.event_id AND len.y = EXTRACT(YEAR FROM ev.date_id)
            WHERE len.n <= %s
            """,
            ([d.isoformat() for d in dates], EVENEMENT_COURT_MAX_JOURS))
        for r in rows:
            out.setdefault(_as_date(r['date_id']), r['event_name'])
    except Exception:
        pass
    return out


def same_special_day_last_year(d, name):
    """Le même jour particulier l'année d'avant : même nom pour un jour férié (fêtes mobiles), sinon même date."""
    d = _as_date(d)
    try:
        from engines.product_forecast_engine import _holidays
        cand = [x for x, n in _holidays({d.year - 1}).items() if n == name]
        if cand:
            return cand[0]
    except Exception:
        pass
    try:
        return d.replace(year=d.year - 1)
    except ValueError:          # 29 février
        return date(d.year - 1, 2, 28)
