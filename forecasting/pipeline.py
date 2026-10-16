r"""
Prévision des ventes PAR PRODUIT — pipeline automatique, indépendant de la boulangerie.

Ce que fait le pipeline, à chaque lancement :
  1. lit les ventes (base PostgreSQL, ou fichiers CSV exportés avec export_data.py) ;
  2. contrôle la qualité des données (ruptures de volume, jours absents, valeurs aberrantes, produits arrêtés) ;
  3. classe chaque produit selon sa façon de se vendre (Syntetos-Boylan : régulier, irrégulier,
     intermittent, sporadique ; plus « saisonnier », « inactif », « historique insuffisant ») ;
  4. organise une compétition entre plusieurs méthodes, testées sur les dernières semaines connues
     (le modèle ne les a pas vues) : moyenne des 4 derniers mêmes jours, TSB (ventes intermittentes),
     modèle global de gradient boosting (tous les produits ensemble), Prophet par produit si installé ;
  5. garde, pour chaque produit, la méthode la plus précise (erreur WAPE) — la plus simple en cas d'égalité ;
  6. calcule la prévision des prochains jours avec une fourchette basse / haute ;
  7. enregistre le tout dans de nouvelles tables (les tables existantes, dont prophet_forecasts, ne sont pas touchées).

Rien n'est propre à une boutique : les jours fermés, la saison et les ruptures sont détectés dans les données,
et les réglages sont dans config.json.

Utilisation (dans le dossier du projet) :
    python forecasting\pipeline.py            -> lit la base et y écrit les résultats
    python forecasting\pipeline.py --csv      -> lit forecasting/data/*.csv et écrit forecasting/data/out_*.csv (essai)
Dépendances : pandas, numpy, scikit-learn (prophet en option).
"""
import argparse
import json
import os
import sys
import time
import warnings
from datetime import datetime

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("FORECAST_DATA") or os.path.join(HERE, "data")
CFG = json.load(open(os.path.join(HERE, "config.json"), encoding="utf-8"))
H = int(CFG["horizon_jours"])
# Seuil « vrai jour d'ouverture » : % du volume d'un jour normal (médiane des 28 jours précédents)
SEUIL_OUVERT = float(CFG.get("seuil_jour_ouvert_pct", 15)) / 100
# Jours d'événement : part donnée aux ventes du même jour l'an dernier (le reste : modèle ajusté)
POIDS_EVT = float(np.clip(CFG.get("poids_an_dernier_jours_evenement", 0.5), 0.0, 1.0))


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


# ═════════════════════════════ 1. Lecture des données ═════════════════════════════
SQL_SALES = """SELECT date_id, product_id, SUM(quantity) AS qty, SUM(total_revenue) AS revenue
               FROM fact_ticket_lines GROUP BY date_id, product_id"""
SQL_PRODUCTS = """SELECT p.product_id, p.article_name, COALESCE(c.category_name, 'Autre') AS category
                  FROM dim_products p LEFT JOIN dim_categories c ON c.category_id = p.category_id"""
SQL_CALENDAR = """SELECT d.date_id, d.is_touristic, COALESCE(a.nb_tickets, 0) AS nb_tickets,
                         COALESCE(a.nb_articles, 0) AS nb_articles,
                         (SELECT e.event_name FROM fact_ticket_lines f JOIN dim_events e ON e.event_id = f.event_id
                           WHERE f.date_id = d.date_id AND e.is_event
                           GROUP BY e.event_name ORDER BY COUNT(*) DESC LIMIT 1) AS event_name
                  FROM dim_dates d LEFT JOIN daily_aggregates a ON a.date_id = d.date_id"""


def load(source):
    if source == "csv":
        s = pd.read_csv(os.path.join(DATA, "sales.csv"))
        p = pd.read_csv(os.path.join(DATA, "products.csv"))
        c = pd.read_csv(os.path.join(DATA, "calendar.csv"))
    else:
        sys.path.insert(0, os.path.join(HERE, "..", "backend"))
        from db.db import sql_fetch_all
        s = pd.DataFrame(sql_fetch_all(SQL_SALES))
        p = pd.DataFrame(sql_fetch_all(SQL_PRODUCTS))
        c = pd.DataFrame(sql_fetch_all(SQL_CALENDAR))
    s["date"] = pd.to_datetime(s["date_id"])
    s["qty"] = pd.to_numeric(s["qty"], errors="coerce").fillna(0)
    c["date"] = pd.to_datetime(c["date_id"])
    if "category" not in p.columns:
        p["category"] = "Autre"
    p["category"] = p["category"].fillna("Autre").astype(str)
    return s, p, c


def _col(df, name, default):
    """Colonne facultative : valeur par défaut si la base d'une autre boutique ne l'a pas."""
    return df[name] if name in df.columns else pd.Series(default, index=df.index)


# Calendrier étendu aux jours à prévoir (saison touristique, événements) : rempli par prepare()
EXT_TOUR = pd.Series(dtype=float)
EXT_EVENT = pd.Series(dtype=object)
# Jours fériés ajoutés automatiquement (noms) et ceux qui ont réellement été des jours particuliers (dates passées)
HOL_NAMES = set()
HOL_SPECIAL = set()
HOL_ALL = {}          # date -> nom du jour férié (passé et futur), hors jours déjà marqués dans le calendrier
USE_HOL = False       # vrai seulement pendant la prévision de saison de la boutique (voir _season_days)


def prepare(sales, cal):
    """Série journalière continue : Y[date, produit] (0 quand pas de vente), et calendrier aligné."""
    global EXT_TOUR, EXT_EVENT, HOL_NAMES, HOL_SPECIAL, HOL_ALL
    start, end = sales["date"].min(), sales["date"].max()
    days = pd.date_range(start, end, freq="D")
    Y = sales.pivot_table(index="date", columns="product_id", values="qty", aggfunc="sum").reindex(days).fillna(0.0)
    neg = int((Y < 0).sum().sum())
    Y = Y.clip(lower=0)   # retours / annulations nets : jamais de vente négative dans les modèles
    cal = cal.drop_duplicates("date").set_index("date")
    C = cal.reindex(days)
    C["in_calendar"] = C.index.isin(cal.index)
    S = Y.sum(axis=1)
    # Boutique ouverte : jour avec un vrai volume de ventes. Quelques ventes isolées un jour de fermeture
    # (régularisations, commandes) ne suffisent pas : il faut au moins 15 % du volume habituel des jours voisins.
    # Médiane des 28 jours PRÉCÉDENTS seulement (aucun regard sur les jours suivants).
    med = S.where(S > 0).shift(1).rolling(28, min_periods=5).median().bfill().ffill()
    nb_art = pd.to_numeric(_col(C, "nb_articles", np.nan), errors="coerce")
    has_nb = nb_art.notna().any()
    C["open"] = ((S > 0) & (S >= SEUIL_OUVERT * med)) & ((nb_art > 0) | ~has_nb | (S >= 0.5 * med))
    C["vol_rel"] = (S / med).where(S > 0)   # volume du jour / jour normal : sert au contrôle des jours ambigus
    C["is_touristic"] = _col(C, "is_touristic", False).fillna(False).astype(str).str.lower().isin(["true", "t", "1"])
    ev = _col(C, "event_name", None)
    C["event_name"] = ev.where(ev.notna(), None)
    # Jours fériés (réglage « jours_feries_pays ») : ajoutés comme événements les jours où le calendrier n'en a pas
    hol = public_holidays(range(start.year - 1, end.year + 3))
    C["event_name"] = C["event_name"].astype(object)
    HOL_NAMES, HOL_SPECIAL = set(), set()
    HOL_ALL = {t: n for t, n in hol.items() if not (t in C.index and isinstance(C.at[t, "event_name"], str))}
    HOL_NAMES = set(HOL_ALL.values())
    for t, name in HOL_ALL.items():
        if t in C.index:
            # Ce jour férié a-t-il vraiment été un jour à part ? (≥ 1,25 × ou ≤ 0,8 × un jour normal, boutique ouverte)
            # (un jour férié fermé relève des règles de fermeture, pas de celle-ci)
            if bool(C.at[t, "open"]):
                b_ = _day_base(S, C, t)
                if b_ > 0 and not (0.8 <= S[t] / b_ <= 1.25):
                    HOL_SPECIAL.add(t)
    C["dow"] = days.dayofweek
    C["month"] = days.month
    C.attrs["negatives"] = neg
    C.attrs["daily_total"] = S
    # Calendrier étendu aux H jours à prévoir. Le calendrier n'est utilisé pour ces dates que s'il est vraiment
    # rempli pour l'avenir (au moins une saison / un événement saisi après la fin des ventes) ; sinon on projette
    # l'an dernier : saison = même date l'an dernier ; événements = projetés selon leur type (date fixe, lié à
    # Pâques, ou même jour de semaine), appris sur l'historique.
    ext = pd.date_range(start, end + pd.Timedelta(days=max(H, 400)), freq="D")   # jusqu'à ~13 mois : prévision de saison
    calx = cal[cal.index > end]
    tour_cal = _col(cal, "is_touristic", False).fillna(False).astype(str).str.lower().isin(["true", "t", "1"])
    ev_cal = _col(cal, "event_name", None)
    tour_known = bool(tour_cal[tour_cal.index > end].any())
    ev_known = bool(ev_cal[ev_cal.index > end].notna().any()) if len(calx) else False
    EXT_TOUR = pd.Series(0.0, index=ext)
    EXT_EVENT = pd.Series([None] * len(ext), index=ext, dtype=object)
    _learn_events(C["event_name"])   # calendrier de la boutique seulement (les jours fériés sont gérés à part)
    for t in ext:
        if t <= end:
            EXT_TOUR[t] = float(C.at[t, "is_touristic"])
            EXT_EVENT[t] = C.at[t, "event_name"]
        else:
            ly = t - pd.DateOffset(years=1)
            EXT_TOUR[t] = float(tour_cal.get(t, False)) if tour_known else float(C.at[ly, "is_touristic"]) if ly in C.index else 0.0
            if ev_known:
                v = ev_cal.get(t)
                EXT_EVENT[t] = v if isinstance(v, str) else None
            else:
                EXT_EVENT[t] = _project_event(t)
    return Y, C


def public_holidays(years):
    """Jours fériés du pays choisi dans config.json (« jours_feries_pays » : "FR", ou "" pour aucun), plus les dates
    ajoutées à la main (« jours_feries_dates » : ["MM-JJ", …]). Calculés, jamais saisis : valables chaque année.
    Les fêtes du calendrier de la boutique restent prioritaires."""
    pays = str(CFG.get("jours_feries_pays", "") or "").upper()
    extra = CFG.get("jours_feries_dates", []) or []
    out = {}
    for y in years:
        fixed = {}
        if pays == "FR":
            fixed = {(1, 1): "Jour de l'An", (5, 1): "Fête du Travail", (5, 8): "Victoire 1945", (7, 14): "Fête nationale",
                     (8, 15): "Assomption", (11, 1): "Toussaint", (11, 11): "Armistice", (12, 25): "Noël"}
            e = easter(y)
            for d, n in ((1, "Lundi de Pâques"), (39, "Ascension"), (50, "Lundi de Pentecôte")):
                out[e + pd.Timedelta(days=d)] = n
        for md, n in fixed.items():
            out[pd.Timestamp(y, *md)] = n
        for md in extra:
            try:
                m_, d_ = (int(x) for x in str(md).split("-"))
                out[pd.Timestamp(y, m_, d_)] = f"Jour particulier {d_:02d}/{m_:02d}"
            except Exception:
                pass
    return out


# ── Événements : type appris sur l'historique (aucun nom d'événement codé en dur)
EV_RULES = {}


def easter(y):
    """Dimanche de Pâques (calendrier grégorien)."""
    a, b, c = y % 19, y // 100, y % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l_ = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l_) // 451
    return pd.Timestamp(y, (h + l_ - 7 * m + 114) // 31, ((h + l_ - 7 * m + 114) % 31) + 1)


def _learn_events(ev):
    """Pour chaque événement du calendrier : comment il se déplace d'une année à l'autre.
    - « date » : mêmes dates chaque année (Noël, 1er janvier…)
    - « paques » : même écart avec Pâques (Pâques, Ascension…)
    - « semaine » : même jour de semaine, 52 semaines plus tard (Fête des mères…)
    Le type retenu est celui qui fait coïncider le plus de jours entre les deux dernières années observées.
    « court » = au plus 7 jours par an : ces jours-là suivent le même jour de l'an dernier."""
    global EV_RULES
    EV_RULES = {}
    ev = ev.dropna()
    for name, grp in ev.groupby(ev.values):
        ds = pd.DatetimeIndex(grp.index)
        by_year = {y: ds[ds.year == y] for y in sorted(set(ds.year))}
        years = sorted(by_year)
        last = by_year[years[-1]]
        kind = "date"
        # Une seule année observée : un événement collé à Pâques (de 7 jours avant au lundi) est supposé lié à Pâques
        offs = [(x - easter(x.year)).days for x in last]
        if len(years) == 1 and all(-7 <= o <= 1 for o in offs):
            kind = "paques"
        if len(years) >= 2:
            a, b = by_year[years[-2]], last
            ov = {"date": len({(x.month, x.day) for x in a} & {(x.month, x.day) for x in b}),
                  "paques": len({(x - easter(x.year)).days for x in a} & {(x - easter(x.year)).days for x in b}),
                  "semaine": len({x + pd.Timedelta(days=364) for x in a} & set(b))}
            kind = max(ov, key=lambda k: (ov[k], k == "date"))
        EV_RULES[name] = dict(kind=kind, short=max(len(v) for v in by_year.values()) <= 7,
                              md={(x.month, x.day) for x in last}, off={(x - easter(x.year)).days for x in last},
                              wk={x + pd.Timedelta(days=364) for x in last})


def _project_event(t):
    """Événement attendu à une date future, d'après les règles apprises. Si deux événements tombent le même jour
    (ex. 1er janvier pendant la période de la galette), l'événement court (le plus spécifique) l'emporte."""
    for name, r in sorted(EV_RULES.items(), key=lambda kv: not kv[1]["short"]):
        if (r["kind"] == "date" and (t.month, t.day) in r["md"]) or \
           (r["kind"] == "paques" and (t - easter(t.year)).days in r["off"]) or \
           (r["kind"] == "semaine" and t in r["wk"]):
            return name
    return None


def _event_at(t):
    """Événement du jour t : calendrier de la boutique ; en mode saison, aussi les jours fériés du pays."""
    e = EXT_EVENT.get(t)
    if isinstance(e, str):
        return e
    if USE_HOL and t in HOL_ALL:
        return HOL_ALL[t]
    return None


def _holiday_last_year(t):
    """Même jour férié l'année d'avant (même nom : gère les fêtes mobiles comme l'Ascension)."""
    name = HOL_ALL.get(t)
    for x, n in HOL_ALL.items():
        if n == name and x.year == t.year - 1:
            return x
    return None


def event_match(t):
    """Jour équivalent l'an dernier pour un jour d'événement COURT (ex. 24/12 → 24/12 de l'an dernier ;
    lundi de Pâques → lundi de Pâques de l'an dernier). None si ce n'est pas un jour d'événement court."""
    name = _event_at(t)
    if isinstance(name, str) and name not in EV_RULES and name in HOL_NAMES:
        return _holiday_last_year(t)
    r = EV_RULES.get(name) if isinstance(name, str) else None
    if not r or not r["short"]:
        return None
    if r["kind"] == "paques":
        return easter(t.year - 1) + pd.Timedelta(days=(t - easter(t.year)).days)
    if r["kind"] == "semaine":
        return t - pd.Timedelta(days=364)
    try:
        return t - pd.DateOffset(years=1)
    except Exception:
        return None


# ═════════════════════════════ 2. Contrôles de qualité ═════════════════════════════
def data_checks(Y, C):
    out = []
    end = Y.index.max()
    # Jours absents du calendrier
    miss = C.index[~C["in_calendar"]]
    if len(miss):
        out.append(dict(check_type="jours_absents_calendrier", severity="info", date_from=miss.min(), date_to=miss.max(),
                        detail=f"{len(miss)} jour(s) sans ligne dans le calendrier (dim_dates)."))
    # Ruptures de volume : semaines nettement en dessous de la référence.
    # Référence = mêmes semaines l'an dernier quand elles existent (la saisonnalité est donc normale) ;
    # sinon les 8 semaines précédentes et le niveau normal des 6 derniers mois (la fin d'une saison n'est pas une rupture).
    daily = Y.sum(axis=1).where(C["open"])
    wk = daily.resample("W-SUN").mean()
    prev8 = wk.shift(1).rolling(8, min_periods=4).median()
    # Mêmes semaines l'an dernier : moyenne des semaines 50 à 54 en arrière (fêtes mobiles comme Pâques)
    ly = pd.concat([wk.shift(k) for k in range(50, 55)], axis=1).mean(axis=1, skipna=False)
    thr = 1 - CFG["rupture_baisse_min_pct"] / 100.0
    below_ly = (wk < ly * thr) & ly.notna()
    below_prev = (wk < prev8 * thr) & prev8.notna()
    # Niveau normal de la boutique : médiane des 26 semaines précédentes. Sans an dernier, une baisse n'est signalée que
    # si elle passe aussi nettement sous ce niveau normal (la fin d'une haute saison n'est pas une rupture).
    med26 = wk.shift(1).rolling(26, min_periods=20).median()   # au moins ~5 mois d'historique pour juger
    below_norm = (wk < med26 * thr) & med26.notna()
    # Rupture : baisse par rapport à l'an dernier ET aux semaines précédentes (une saison normale ne déclenche rien) ;
    # sans an dernier : baisse par rapport aux semaines précédentes ET au niveau normal des 6 derniers mois.
    low = ((below_ly & (below_prev | prev8.isna())) | (ly.isna() & below_prev & below_norm)).fillna(False)
    ref = ly.where(ly.notna(), prev8)
    runs, cur = [], []
    for d, v in low.items():
        if v:
            cur.append(d)
        elif cur:
            runs.append(cur); cur = []
    if cur:
        runs.append(cur)
    for r in runs:
        if len(r) >= CFG["rupture_semaines_min"]:
            a, b = r[0] - pd.Timedelta(days=6), r[-1]
            drop = 100 * (1 - wk[r].mean() / ref[r].mean()) if ref[r].mean() else 0
            base = "les mêmes semaines de l'an dernier" if ly[r].notna().all() else "les 8 semaines précédentes"
            out.append(dict(check_type="rupture_volume", severity="attention", date_from=a, date_to=min(b, end),
                            detail=f"Ventes {drop:.0f} % sous {base} pendant {len(r)} semaines : "
                                   f"changement de caisse, fermeture partielle ou données incomplètes ? À vérifier avec la boutique."))
    if C.attrs.get("negatives"):
        out.append(dict(check_type="quantites_negatives", severity="info", date_from=None, date_to=None,
                        detail=f"{C.attrs['negatives']} vente(s) journalière(s) négative(s) (retours ?) ramenées à 0."))
    stray = int(((Y.sum(axis=1) > 0) & ~C["open"]).sum())
    if stray:
        out.append(dict(check_type="ventes_jours_fermes", severity="info", date_from=None, date_to=None,
                        detail=f"{stray} jour(s) avec quelques ventes isolées mais un volume trop faible pour un jour d'ouverture : comptés comme fermés."))
    # Jours ambigus : volume proche du seuil d'ouverture (entre 2/3 et 5/3 du seuil, ex. 10–25 % d'un jour normal).
    # Quelques-uns sont normaux (1er janvier, demi-journée) ; beaucoup = seuil peut-être mal adapté à cette boutique.
    vr = C["vol_rel"]
    amb = C.index[(vr >= SEUIL_OUVERT * 2 / 3) & (vr <= SEUIL_OUVERT * 5 / 3)]
    if len(amb):
        many = len(amb) >= max(10, 0.02 * len(C))
        pct = round(SEUIL_OUVERT * 100)
        out.append(dict(check_type="jours_ambigus", severity="attention" if many else "info",
                        date_from=amb.min(), date_to=amb.max(),
                        detail=f"{len(amb)} jour(s) avec un volume proche du seuil d'ouverture ({pct} % d'un jour normal) : "
                               + ("nombreux — vérifier avec la boutique ses jours et horaires d'ouverture, et ajuster "
                                  "« seuil_jour_ouvert_pct » dans config.json si besoin."
                                  if many else "peu nombreux (jours fériés, demi-journées) : rien à faire.")))
    # Valeurs aberrantes : un produit qui vend > 5 fois son niveau habituel élevé (p95) en un jour
    nz = Y.where(Y > 0)
    p95 = nz.quantile(0.95)
    big = (Y > np.maximum(10, 5 * p95)).sum().sum()
    if big:
        out.append(dict(check_type="valeurs_aberrantes", severity="info", date_from=None, date_to=None,
                        detail=f"{int(big)} vente(s) journalière(s) très au-dessus de l'habitude du produit (commandes spéciales ?). Gardées, mais à vérifier."))
    return out


# ═════════════════════════════ 3. Classement des produits ═════════════════════════════
SEG_FR = {"smooth": "régulier", "erratic": "irrégulier", "intermittent": "intermittent", "lumpy": "sporadique"}


def classify(Y, C):
    end = Y.index.max()
    open_days = C.index[C["open"]]
    future = pd.date_range(end + pd.Timedelta(days=1), periods=H)
    rows = []
    for pid in Y.columns:
        s = Y[pid]
        sold = s[s > 0]
        first, last = sold.index.min(), sold.index.max()
        hist = s.loc[(s.index >= max(first, end - pd.Timedelta(days=364))) & s.index.isin(open_days)]
        n_sale = int((hist > 0).sum())
        nz = hist[hist > 0]
        adi = len(hist) / max(n_sale, 1)
        cv2 = float((nz.std(ddof=0) / nz.mean()) ** 2) if len(nz) > 1 and nz.mean() > 0 else 0.0
        seg = ("smooth" if cv2 < 0.49 else "erratic") if adi < 1.32 else ("intermittent" if cv2 < 0.49 else "lumpy")
        # Saisonnier : ≥ 70 % des ventes concentrées sur 2 mois de l'année (avec au moins ~10 mois d'historique)
        by_m = s.groupby(s.index.month).sum()
        seasonal = bool((end - first).days >= 300 and by_m.sum() > 0 and by_m.nlargest(2).sum() / by_m.sum() >= 0.7)
        # Actif : vendu récemment, OU vendu l'an dernier sur la même période que l'horizon (produit de saison)
        ly = s.loc[(s.index >= future[0] - pd.Timedelta(days=371)) & (s.index <= future[-1] - pd.Timedelta(days=357))]
        recent = (end - last).days <= CFG["inactif_si_aucune_vente_depuis_jours"]
        active = bool(recent or ly.sum() > 0)
        if not active:
            status = "inactif"
        elif n_sale < CFG["historique_min_jours_vente"] and not (seasonal and ly.sum() > 0):
            status = "insuffisant"
        else:
            status = "prevu"
        rows.append(dict(product_id=pid, segment=SEG_FR[seg], saisonnier=seasonal, status=status,
                         n_sale_days=n_sale, adi=round(adi, 2), cv2=round(cv2, 2), first_sale=first, last_sale=last,
                         avg_qty_open_day=float(hist.mean()) if len(hist) else 0.0))
    return pd.DataFrame(rows).set_index("product_id")


# ═════════════════════════════ 4. Méthodes candidates ═════════════════════════════
def _open_hist(Y, C, origin):
    m = (Y.index <= origin) & C["open"].values
    return Y.loc[m]


def m_moyenne_4_semaines(Y, C, origin, targets, pids):
    """Moyenne des 4 derniers mêmes jours de la semaine ouverts ; fourchette = 8 derniers mêmes jours."""
    Yo = _open_hist(Y, C, origin)[pids]
    out = {}
    for d in range(7):
        sub = Yo[Yo.index.dayofweek == d]
        out[d] = (sub.tail(4).mean(), sub.tail(8).quantile(CFG["quantiles"][0]), sub.tail(8).quantile(CFG["quantiles"][1]))
    res = {}
    for pid in pids:
        yh = np.array([out[t.dayofweek][0].get(pid, 0.0) for t in targets], float)
        lo = np.array([out[t.dayofweek][1].get(pid, 0.0) for t in targets], float)
        hi = np.array([out[t.dayofweek][2].get(pid, 0.0) for t in targets], float)
        res[pid] = (np.nan_to_num(yh), np.nan_to_num(lo), np.nan_to_num(hi))
    return res


def m_tsb(Y, C, origin, targets, pids, alpha=0.1, beta=0.1):
    """TSB (Teunter-Syntetos-Babai) pour les ventes intermittentes, modulé par le profil de la semaine."""
    Yo = _open_hist(Y, C, origin)[pids]
    res = {}
    for pid in pids:
        s = Yo[pid]
        s = s[s.index >= (s[s > 0].index.min() if (s > 0).any() else s.index.max())]
        if len(s) == 0:
            res[pid] = (np.zeros(len(targets)),) * 3
            continue
        p, z = float((s > 0).mean()), float(s[s > 0].mean()) if (s > 0).any() else 0.0
        for v in s.values:
            if v > 0:
                z = z + alpha * (v - z)
                p = p + beta * (1 - p)
            else:
                p = p + beta * (0 - p)
        base = p * z
        last = s.tail(84)
        prof = last.groupby(last.index.dayofweek).mean() / max(last.mean(), 1e-9)
        yh = np.array([base * float(prof.get(t.dayofweek, 1.0)) for t in targets])
        hi = np.maximum(yh, np.quantile(s.tail(56), CFG["quantiles"][1]) if len(s) else yh)
        lo = np.minimum(yh, np.quantile(s.tail(56), CFG["quantiles"][0]) if len(s) else yh * 0)
        res[pid] = (yh, lo, hi)
    return res


def level_ratio(Y, origin, pids):
    """Évolution du niveau de chaque produit : 8 dernières semaines / mêmes 8 semaines un an plus tôt (borné 0,1–3).
    Niveau du produit lui-même si la période de comparaison compte vraiment pour lui ; sinon (hors saison, produit
    récent) évolution de toute la boutique. Fonctionne aussi avec un peu plus d'un an d'historique."""
    win_cur = (Y.index > origin - pd.Timedelta(days=56)) & (Y.index <= origin)
    win_prev = (Y.index > origin - pd.Timedelta(days=420)) & (Y.index <= origin - pd.Timedelta(days=364))
    if win_prev.sum() < 21:   # pas assez de recul pour comparer
        return {pid: 1.0 for pid in pids}, False
    # Même nombre de jours de part et d'autre (historique parfois juste au-dessus d'un an) : les n jours les plus
    # anciens disponibles avant « origin − 364 » sont comparés aux n derniers jours.
    n = int(win_prev.sum())
    if n < 56:
        win_cur = (Y.index > origin - pd.Timedelta(days=n)) & (Y.index <= origin)
    cur, prev = Y.loc[win_cur, pids].sum(), Y.loc[win_prev, pids].sum()
    year_prev = Y.loc[(Y.index > origin - pd.Timedelta(days=728)) & (Y.index <= origin - pd.Timedelta(days=364)), pids].sum()
    tot_cur, tot_prev = float(Y.loc[win_cur].values.sum()), float(Y.loc[win_prev].values.sum())   # toute la boutique
    shop = float(np.clip(tot_cur / tot_prev, 0.1, 3.0)) if tot_prev > 0 else 1.0
    out = {}
    for pid in pids:
        significant = prev[pid] >= max(20.0, 0.08 * year_prev[pid])
        out[pid] = float(np.clip(cur[pid] / prev[pid], 0.1, 3.0)) if significant else shop
    return out, True


def _ly_value(Y, C, t, pid):
    """Ventes « l'an dernier » pour le jour t : même jour de semaine il y a 52 semaines (poids 50 %), lissé avec
    les semaines 51 et 53 (25 % chacune). Les jours où la boutique était fermée sont écartés. Une semaine voisine
    ne peut pas dépasser 2 × le jour lui-même + 1 (ou 2 × les autres jours de cette semaine-là + 1 si ce jour-là
    était fermé) : un pic voisin (Noël juste avant le 1er janvier) ne déborde pas, et une saison courte n'est pas effacée."""
    w = {364: 0.5, 357: 0.25, 371: 0.25}
    v = {}
    ev_t = _event_at(t)
    for d in w:
        x = t - pd.Timedelta(days=d)
        # Prévision de saison : un jour de fête de l'an dernier (Noël, réveillon, 15 août s'il a été un jour à part…)
        # ne sert pas de référence à un autre jour, sinon son pic se retrouverait à côté cette année. Mesuré sur
        # l'historique : erreur mensuelle 17 % → 13 %. (La prévision par produit garde la version d'origine,
        # plus précise pour elle lors des tests.)
        if USE_HOL:
            ev_x = _event_at(x)
            if isinstance(ev_x, str) and ev_x != ev_t and (EV_RULES.get(ev_x, {}).get("short", False) or x in HOL_SPECIAL):
                continue
        if x in Y.index and bool(C["open"].get(x, True)):
            v[d] = float(Y.at[x, pid])
    if not v:
        return 0.0
    # Référence pour le plafond : le jour lui-même ; s'il était fermé l'an dernier, les autres jours ouverts de cette
    # même semaine-là (évite qu'une semaine de fête voisine, ex. le dimanche avant Noël, soit recopiée telle quelle).
    if 364 in v:
        ref = v[364]
    else:
        x0 = t - pd.Timedelta(days=364)
        wk_ = [float(Y.at[x, pid]) for x in pd.date_range(x0 - pd.Timedelta(days=3), x0 + pd.Timedelta(days=3))
               if x != x0 and x in Y.index and bool(C["open"].get(x, True))]
        ref = float(np.median(wk_)) if wk_ else min(v.values())
    cap = 2 * ref + 1
    v = {d: (min(x, cap) if d != 364 else x) for d, x in v.items()}
    return sum(w[d] * v[d] for d in v) / sum(w[d] for d in v)


def m_an_dernier(Y, C, origin, targets, pids):
    """Même période l'an dernier (même jour de semaine), ajustée au niveau actuel du produit (level_ratio).
    Utile pour les produits saisonniers (fêtes) quand l'historique est court."""
    res = {}
    if (origin - Y.index.min()).days < 371 + H:
        return res
    ratio, ok = level_ratio(Y, origin, pids)
    if not ok:
        return res
    for pid in pids:
        ly = np.array([_ly_value(Y, C, t, pid) for t in targets])
        yh = ratio[pid] * ly
        res[pid] = (yh, yh * 0.6, yh * 1.4 + 1)
    return res


def apply_events(Y, C, origin, targets, pids, methods, ratio=None):
    """Jours d'événement courts (Noël, réveillon, 1er janvier, Pâques…) : moitié prévision du modèle, ajustée par
    l'écart (atténué : racine carrée) de toute la boutique le même jour d'événement l'an dernier, moitié ce que le
    produit a vendu ce jour-là l'an dernier, ajusté à son niveau actuel. Méthode « an dernier » : elle contient déjà
    l'événement, on prend seulement le bon jour (même date) sans ajouter l'écart une seconde fois. Produit absent à
    cette période l'an dernier : modèle × écart atténué. Règle choisie sur 14 vrais jours d'événement de 2025.
    Appliqué à toutes les méthodes, dans les tests comme pour l'avenir."""
    pairs = _event_pairs(Y, C, origin, targets)
    if not pairs:
        return
    if ratio is None:
        ratio, ok = level_ratio(Y, origin, pids)
    else:
        ok = True
    for meth, r in methods.items():
        for pid, (yh, lo, hi) in r.items():
            yh, lo, hi = np.array(yh, float), np.array(lo, float), np.array(hi, float)
            for j, m, f in pairs:
                # Le produit était-il en vente autour de ce jour-là l'an dernier ? (± 1 semaine ; un produit de saison
                # qui démarre quelques jours avant la fête compte bien comme « en vente »)
                near = Y.loc[(Y.index >= m - pd.Timedelta(days=7)) & (Y.index <= m + pd.Timedelta(days=7)), pid].sum() > 0
                if near and ok:
                    ly_part = Y.at[m, pid] * ratio.get(pid, 1.0)
                    # « l'an dernier » contient déjà l'événement : on remplace seulement par le bon jour (même date),
                    # sans ajouter l'écart de la boutique une seconde fois.
                    new = ly_part if meth == "an_dernier" else (1 - POIDS_EVT) * yh[j] * np.sqrt(f) + POIDS_EVT * ly_part
                else:   # produit absent à cette période l'an dernier : modèle × écart atténué de la boutique
                    new = yh[j] * np.sqrt(f)
                lo[j], hi[j] = min(lo[j], new), max(hi[j], new)
                yh[j] = new
            r[pid] = (yh, lo, hi)


def _day_base(S, C, m):
    """Volume d'un jour normal autour de m : médiane des mêmes jours de semaine ouverts (± 4 semaines) ;
    si ce jour de semaine est d'habitude fermé, médiane des jours ouverts à ± 2 semaines."""
    open_ = C["open"].reindex(S.index).fillna(False).values
    near = (S.index != m) & open_
    a = S[near & (S.index.dayofweek == m.dayofweek) & (abs((S.index - m).days) <= 28)]
    if len(a) < 2:
        a = S[near & (abs((S.index - m).days) <= 14)]
    return float(a.median()) if len(a) else 0.0


def _event_pairs(Y, C, origin, targets):
    """(position, jour équivalent l'an dernier, écart de toute la boutique ce jour-là) pour les jours d'événement."""
    S = Y.sum(axis=1)
    pairs = []
    for j, t in enumerate(targets):
        m = event_match(t)
        # Jour d'événement ouvert l'an dernier, même avec très peu de ventes (ex. 1er janvier ouvert le matin
        # seulement) : ce faible volume est justement l'information utile.
        if m is None or m not in C.index or m > origin or not (bool(C.at[m, "open"]) or S.get(m, 0) > 0):
            continue
        # Jour férié ajouté automatiquement : traité à part seulement s'il a été un jour particulier l'an dernier
        if _event_at(t) in HOL_NAMES and _event_at(t) not in EV_RULES and m not in HOL_SPECIAL:
            continue
        base = _day_base(S, C, m)
        f = float(np.clip(S[m] / base, 0.1, 4.0)) if base > 0 else 1.0
        pairs.append((j, m, f))
    return pairs


def _features(Y, C, origin, targets, pids, first_sale, fam_code, pid_code, ev_code):
    """Variables du modèle global, calculées avec l'historique connu à la date « origin » uniquement."""
    Yo = _open_hist(Y, C, origin)[pids]
    last28 = Yo[Yo.index > origin - pd.Timedelta(days=28)]
    m28, m7 = last28.mean(), Yo[Yo.index > origin - pd.Timedelta(days=7)].mean()
    dow_mean = {d: Yo[Yo.index.dayofweek == d].tail(4).mean() for d in range(7)}
    rows = []
    for t in targets:
        h = (t - origin).days
        ly_win = Y.loc[(Y.index >= t - pd.Timedelta(days=367)) & (Y.index <= t - pd.Timedelta(days=361)), pids]
        ly_win = ly_win[C["open"].reindex(ly_win.index).fillna(False).values]
        ly = ly_win.mean() if len(ly_win) else pd.Series(np.nan, index=pids)
        doy = t.dayofyear
        for pid in pids:
            rows.append((pid_code.get(pid, -1), fam_code.get(pid, 0), t.dayofweek, t.month, np.sin(2 * np.pi * doy / 365.25),
                         np.cos(2 * np.pi * doy / 365.25), int(EXT_TOUR.get(t, 0.0) > 0.5),
                         ev_code.get(EXT_EVENT.get(t), 0), h,
                         m28.get(pid, 0.0), m7.get(pid, 0.0), dow_mean[t.dayofweek].get(pid, 0.0), ly.get(pid, np.nan),
                         max(0, (origin - first_sale.get(pid, origin)).days), pid, t))
    cols = ["pid_c", "fam_c", "dow", "month", "doy_sin", "doy_cos", "tour", "ev_c", "h", "m28", "m7", "dow4", "ly",
            "age", "pid", "date"]
    return pd.DataFrame(rows, columns=cols)


FEATS = ["pid_c", "fam_c", "dow", "month", "doy_sin", "doy_cos", "tour", "ev_c", "h", "m28", "m7", "dow4", "ly", "age"]


class GlobalGBM:
    """Un seul modèle de gradient boosting pour tous les produits (approche « globale », standard en commerce)."""

    def __init__(self, Y, C, train_pids, products, classes):
        from sklearn.ensemble import HistGradientBoostingRegressor  # noqa
        self.Y, self.C, self.pids = Y, C, list(train_pids)
        fams = products.set_index("product_id")["category"].to_dict() if "category" in products else {}
        famlist = sorted(set(fams.values()))
        self.fam_code = {p: famlist.index(fams[p]) + 1 for p in self.pids if p in fams}
        # Code produit en catégorie seulement si le nombre de produits le permet (sinon le niveau récent suffit)
        self.pid_code = {p: i for i, p in enumerate(self.pids)} if len(self.pids) < 250 else {}
        evs = sorted({e for e in EXT_EVENT.dropna().unique()})
        self.ev_code = {e: i + 1 for i, e in enumerate(evs[:250])}
        self.first = classes["first_sale"].to_dict()

    def _build(self, last_target):
        Y, C = self.Y, self.C
        start = Y.index.min() + pd.Timedelta(days=56)
        origins = pd.date_range(start, last_target - pd.Timedelta(days=H), freq=f"{CFG['pas_origines_entrainement_jours']}D")
        frames = []
        for o in origins:
            tg = [t for t in pd.date_range(o + pd.Timedelta(days=1), periods=H) if C["open"].get(t, False)]
            if not tg:
                continue
            f = _features(Y, C, o, tg, self.pids, self.first, self.fam_code, self.pid_code, self.ev_code)
            f["y"] = [Y.at[t, p] for t, p in zip(f["date"], f["pid"])]
            f = f[f["date"] >= f["pid"].map(lambda p: self.first.get(p, Y.index.min()))]
            frames.append(f)
        return pd.concat(frames, ignore_index=True) if frames else None

    def fit(self, last_target, quantiles=True):
        from sklearn.ensemble import HistGradientBoostingRegressor
        D = self._build(last_target)
        cat = [FEATS.index(c) for c in ["fam_c", "ev_c"] + (["pid_c"] if self.pid_code else [])]
        X = D[FEATS].values
        common = dict(max_iter=300, learning_rate=0.06, max_leaf_nodes=31, min_samples_leaf=40,
                      categorical_features=cat, random_state=0)
        X = np.where(np.isnan(X), np.nan, X)
        Xc = X.copy()
        for j in cat:  # catégories : entiers positifs
            Xc[:, j] = np.where(Xc[:, j] < 0, 0, Xc[:, j])
        self.cat = cat
        self.m = HistGradientBoostingRegressor(loss="poisson", **common).fit(Xc, D["y"].values)
        self.q = {}
        if quantiles:
            for qv in CFG["quantiles"]:
                self.q[qv] = HistGradientBoostingRegressor(loss="quantile", quantile=qv, **common).fit(Xc, D["y"].values)
        return self

    def predict(self, origin, targets, pids):
        f = _features(self.Y, self.C, origin, targets, list(pids), self.first, self.fam_code, self.pid_code, self.ev_code)
        X = f[FEATS].values
        for j in self.cat:
            X[:, j] = np.where(X[:, j] < 0, 0, X[:, j])
        f["yh"] = self.m.predict(X)
        qs = CFG["quantiles"]
        f["lo"] = self.q[qs[0]].predict(X) if qs[0] in self.q else f["yh"] * 0.7
        f["hi"] = self.q[qs[1]].predict(X) if qs[1] in self.q else f["yh"] * 1.3
        res = {}
        for pid, g in f.groupby("pid"):
            g = g.set_index("date").reindex(targets)
            res[pid] = (g["yh"].fillna(0).values, g["lo"].fillna(0).values, g["hi"].fillna(0).values)
        return res


def m_prophet(Y, C, origin, targets, pids, classes):
    try:
        from prophet import Prophet
    except Exception:
        return {}
    import logging
    logging.getLogger("cmdstanpy").setLevel(logging.WARNING)
    Yo = _open_hist(Y, C, origin)
    res = {}
    for pid in pids:
        if classes.at[pid, "segment"] not in ("régulier", "irrégulier"):
            continue
        s = Yo[pid]
        s = s[s.index >= classes.at[pid, "first_sale"]]
        if (s.index.max() - s.index.min()).days < CFG["prophet_min_jours_historique"]:
            continue
        m = Prophet(weekly_seasonality=True, yearly_seasonality=True, daily_seasonality=False,
                    interval_width=CFG["quantiles"][1] - CFG["quantiles"][0])
        m.fit(pd.DataFrame({"ds": s.index, "y": s.values}))
        fc = m.predict(pd.DataFrame({"ds": targets}))
        res[pid] = (fc["yhat"].clip(lower=0).values, fc["yhat_lower"].clip(lower=0).values, fc["yhat_upper"].clip(lower=0).values)
    return res


# ═════════════════════════════ 5. Compétition et prévision ═════════════════════════════
def closed_future(C, future):
    """Jour futur fermé ? Valable pour quelques jours comme pour plusieurs mois.
    1. Habitude du jour de la semaine : fermé si fermé ≥ 3 des 4 dernières semaines (≥ 6 des 8 dernières pour
       une date à plus de 4 semaines).
    2. Comparaison avec l'an dernier au même moment : si la boutique se comportait de la même façon il y a un an
       (même habitude ce jour de la semaine), on suit ce qui s'est passé ensuite l'an dernier (même jour de semaine,
       ± 1 semaine, majorité sur 3) : réouverture des mercredis en juillet, fermeture en septembre… Si l'habitude a
       changé depuis l'an dernier (ex. dimanches désormais ouverts), on garde l'habitude actuelle.
    3. Jour férié : la même date l'an dernier était une fermeture COURTE (1–2 jours) un jour normalement ouvert
       (année la plus récente), ET c'est un jour d'événement du calendrier ou la même date était déjà fermée l'année
       d'avant. Une fermeture ponctuelle ou de plusieurs jours (congés) n'est pas supposée se répéter.
    4. Ouverture exceptionnelle : jour d'événement ouvert l'an dernier avec un vrai pic (voir plus bas)."""
    out = []
    end = C.index.max()
    op = C["open"]

    def opened(dates):
        return [bool(op[x]) for x in dates if x in op.index]

    for t in future:
        far = (t - end).days > 28
        n_rec, need = (8, 6) if far else (4, 3)
        same = op[op.index.dayofweek == t.dayofweek].tail(n_rec)
        rc = int((~same).sum())
        recent_closed = rc >= need
        recent_open = int(same.sum()) >= need
        # Même moment l'an dernier (52 semaines, ou 104… pour une date lointaine)
        k = 364
        while t - pd.Timedelta(days=k - 7) > end:
            k += 364
        al = opened([t - pd.Timedelta(days=k + d) for d in (-7, 0, 7)])
        ref_end = end - pd.Timedelta(days=k - 364) - pd.Timedelta(days=364)   # « aujourd'hui » il y a un an
        prev = op[(op.index <= ref_end) & (op.index.dayofweek == t.dayofweek)].tail(n_rec)
        if len(al) >= 2 and len(prev) >= 2:
            ly_closed = sum(not v for v in al) >= 2
            p_closed = (~prev).mean() >= need / n_rec      # mêmes proportions, même si l'historique d'il y a un an est court
            p_open = prev.mean() >= need / n_rec
            if (recent_closed and p_closed) or (recent_open and p_open) or not (recent_closed or recent_open):
                closed = ly_closed           # même situation qu'il y a un an : on suit l'an dernier
            else:
                closed = recent_closed       # l'habitude a changé depuis l'an dernier
        elif len(al) >= 2:
            closed = (sum(not v for v in al) >= 2) if far else recent_closed   # loin : la saison de l'an dernier décide
        else:
            closed = recent_closed           # pas d'an dernier : habitude récente
        # Jour férié fermé l'an dernier (fermeture courte un jour normalement ouvert)
        for y in range(1, 6):
            ly = t - pd.DateOffset(years=y)
            if ly not in C.index:
                continue
            if _short_closure(C, op, ly):
                # Répétée seulement si c'est un jour d'événement du calendrier, le MÊME jour férié (même nom), ou si la
                # même date était déjà fermée l'année d'avant : une fermeture ponctuelle (imprévu, congé) ne se répète pas.
                ev = C["event_name"].get(ly) if "event_name" in C.columns else None
                ly2 = ly - pd.DateOffset(years=1)
                again = _short_closure(C, op, ly2)      # fermeture inhabituelle l'année d'avant aussi (pas un jour fermé chaque semaine)
                same_hol = ly in HOL_ALL and HOL_ALL.get(t) == HOL_ALL[ly]
                if isinstance(ev, str) or same_hol or again:
                    closed = True
            break   # année la plus récente seulement
        # Jour férié mobile (Ascension, Pentecôte…) : fermé si le même jour férié l'an dernier l'était
        if not closed and t in HOL_ALL:
            lh = _holiday_last_year(t)
            if lh is not None and lh in op.index and _short_closure(C, op, lh):
                closed = True
        # Ouverture exceptionnelle : jour d'événement court (ex. 24/12, 31/12) ouvert l'an dernier avec un vrai
        # volume (au moins un jour normal) → ouvert, même si ce jour de la semaine est d'habitude fermé.
        # Conditions : ce jour de semaine n'est pas fermé toute l'année (au moins 4 ouvertures sur les 12 derniers mois,
        # ex. fermeture d'hiver seulement), et le jour équivalent l'an dernier était un vrai jour de pic (≥ 1,5 × un
        # jour normal) ou lui-même une ouverture exceptionnelle.
        m = event_match(t)
        if closed and m is not None and m in C.index and bool(C.at[m, "open"]):
            S = C.attrs.get("daily_total")
            year = C[(C.index > C.index.max() - pd.Timedelta(days=365)) & (C.index.dayofweek == t.dayofweek)]
            sometimes_open = int(year["open"].sum()) >= 4
            base = _day_base(S, C, m) if S is not None else 0.0
            peak = S is not None and base > 0 and S[m] >= 1.5 * base
            same_m = C[(C.index.dayofweek == m.dayofweek) & (abs((C.index - m).days) <= 28) & (C.index != m)]
            was_exceptional = len(same_m) > 0 and same_m["open"].mean() < 0.25
            if sometimes_open and (peak or was_exceptional):
                closed = False
        out.append(closed)
    return np.array(out)


def _short_closure(C, op, d):
    """Le jour d était-il une fermeture courte (1 à 2 jours) un jour de semaine d'habitude ouvert ?"""
    if d not in op.index or bool(op[d]):
        return False
    around = C[(C.index.dayofweek == d.dayofweek) & (abs((C.index - d).days) <= 28) & (C.index != d)]
    if not len(around) or around["open"].mean() < 0.75:
        return False
    block = 1
    for step in (-1, 1):
        x = d + pd.Timedelta(days=step)
        while x in op.index and not bool(op[x]):
            nb = op[(op.index.dayofweek == x.dayofweek) & (abs((op.index - x).days) <= 28) & (op.index != x)]
            if len(nb) and nb.mean() >= 0.75:
                block += 1
            x += pd.Timedelta(days=step)
    return block <= 2


def usual_level(Y, C, origin, targets, pids):
    """Niveau habituel d'un produit pour un jour donné : médiane des 8 derniers mêmes jours de semaine ouverts.
    La médiane évite qu'une ou deux semaines de fêtes gonflent l'« habitude »."""
    Yo = _open_hist(Y, C, origin)[pids]
    med = {d: Yo[Yo.index.dayofweek == d].tail(8).median() for d in range(7)}
    return {pid: np.array([float(med[t.dayofweek].get(pid, 0.0)) if pd.notna(med[t.dayofweek].get(pid, np.nan)) else 0.0
                           for t in targets]) for pid in pids}


def season_transition(Y, C, end, future, pids, classes):
    """Produits dont la saison démarre ou s'arrête pendant l'horizon, d'après l'an dernier :
    ventes moyennes l'an dernier sur la même période ≥ 3 fois celles des 8 semaines précédentes (début de saison)
    ou ≤ 1/3 (fin de saison), avec au moins 1 article par jour d'un côté. Ces produits suivent l'an dernier."""
    out = {}
    if (end - Y.index.min()).days < 400:
        return out
    lyh = [t - pd.Timedelta(days=364) for t in future]
    lyh = [x for x in lyh if x in C.index and bool(C.at[x, "open"])]
    lyp = C.index[(C.index > lyh[0] - pd.Timedelta(days=57)) & (C.index < lyh[0]) & C["open"].values] if lyh else []
    if not lyh or not len(lyp):
        return out
    a, b = Y.loc[lyh, pids].mean(), Y.loc[lyp, pids].mean()
    for pid in pids:
        if a[pid] >= 1 and a[pid] >= 3 * b[pid]:
            out[pid] = "debut"
        elif b[pid] >= 1 and b[pid] >= 3 * a[pid]:
            out[pid] = "fin"
    return out


def run_methods(Y, C, origin, targets, pids, classes, products, gbm_cache=None, quantiles=False):
    methods = {}
    methods["moyenne_4_semaines"] = m_moyenne_4_semaines(Y, C, origin, targets, pids)
    if "an_dernier" in CFG["methodes"]:
        r = m_an_dernier(Y, C, origin, targets, pids)
        if r:
            methods["an_dernier"] = r
    inter = [p for p in pids if classes.at[p, "segment"] in ("intermittent", "sporadique")]
    if "tsb" in CFG["methodes"] and inter:  # TSB : seulement pour les ventes intermittentes / sporadiques
        methods["tsb"] = m_tsb(Y, C, origin, targets, inter)
    if "gbm_global" in CFG["methodes"] and (origin - Y.index.min()).days >= 120:
        try:   # historique trop court ou trop peu de lignes : le modèle global est simplement ignoré
            train = [p for p in classes.index if classes.at[p, "status"] != "inactif"]
            g = GlobalGBM(Y, C, train, products, classes).fit(origin, quantiles=quantiles)
            methods["gbm_global"] = g.predict(origin, targets, pids)
        except Exception as e:
            log(f"Modèle global ignoré ({type(e).__name__}) : historique insuffisant à cette date.")
    if "prophet" in CFG["methodes"] and CFG.get("utiliser_prophet_si_installe"):
        try:
            r = m_prophet(Y, C, origin, targets, pids, classes)
            if r:
                methods["prophet"] = r
        except Exception as e:
            log(f"Prophet ignoré ({type(e).__name__}).")
    apply_events(Y, C, origin, targets, pids, methods)
    return methods


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", action="store_true", help="lire/écrire des fichiers CSV au lieu de la base")
    ap.add_argument("--audit", action="store_true", help="enregistre aussi les prévisions des fenêtres de test (out_backtest.csv)")
    args = ap.parse_args()
    t0 = time.time()
    source = "csv" if args.csv else "db"
    log(f"Lecture des données ({source})…")
    sales, products, cal = load(source)
    Y, C = prepare(sales, cal)
    end = Y.index.max()
    log(f"{Y.shape[1]} produits, du {Y.index.min():%d/%m/%Y} au {end:%d/%m/%Y} ({int(C['open'].sum())} jours ouverts).")

    checks = data_checks(Y, C)
    for c in checks:
        log(f"Contrôle — {c['check_type']} : {c['detail']}")

    classes = classify(Y, C)
    pids = list(classes.index[classes["status"] == "prevu"])
    log(f"Classement : {len(pids)} produits prévus · "
        + ", ".join(f"{k} {v}" for k, v in classes["segment"].value_counts().items())
        + f" · {int((classes['status'] == 'inactif').sum())} inactifs · {int((classes['status'] == 'insuffisant').sum())} historique insuffisant")

    # ── Compétition : fenêtres de test de H jours réparties sur l'année (pas seulement les dernières semaines,
    #    souvent atypiques : fêtes…), plus la même période que l'horizon, un an plus tôt.
    K = int(CFG["nb_fenetres_test"])
    gap = int(CFG.get("ecart_fenetres_jours", H))
    origins = [end - pd.Timedelta(days=H + gap * (k - 1)) for k in range(K, 0, -1)]
    aligned = end - pd.Timedelta(days=364)
    if (aligned - Y.index.min()).days >= 371 + H + 21 and all(abs((aligned - o).days) >= H for o in origins):
        origins = sorted(origins + [aligned])
    origins = [o for o in origins if o - pd.Timedelta(days=120) >= Y.index.min()]
    fold_err = {}   # (pid, méthode, fenêtre) -> (erreur absolue, total réel)
    bt = {"p": [], "m": [], "f": [], "yh": [], "r": [], "d": []}   # prévisions des tests : pour calibrer et mesurer la fourchette
    audit_rows = []
    n_folds = 0
    for i, origin in enumerate(origins):
        targets = [t for t in pd.date_range(origin + pd.Timedelta(days=1), periods=H) if C["open"].get(t, False)]
        if not targets:   # boutique fermée toute la période (congés) : fenêtre ignorée
            continue
        n_folds += 1
        log(f"Test {i + 1}/{len(origins)} : prévision du {targets[0]:%d/%m/%Y} au {targets[-1]:%d/%m/%Y}…")
        res = run_methods(Y, C, origin, pd.DatetimeIndex(targets), pids, classes, products)
        actual = Y.loc[targets, pids]
        for meth, r in res.items():
            for pid, (yh, lo_, hi_) in r.items():
                a_ = actual[pid].values
                fold_err[(pid, meth, i)] = (float(np.abs(a_ - yh).sum()), float(a_.sum()))
                # Erreurs relatives, pour construire des fourchettes réalistes (calibrées sur les tests)
                n_ = len(a_)
                bt["p"] += [pid] * n_; bt["m"] += [meth] * n_; bt["f"] += [i] * n_; bt["d"] += list(targets)
                bt["yh"] += list(yh); bt["r"] += list((a_ - yh) / (yh + 1.0))
                if args.audit:
                    audit_rows.extend(dict(fold=i, origin=origin.date(), product_id=pid, method=meth, ds=t.date(), y=float(a_[j]),
                                           yhat=float(yh[j]), lo=float(lo_[j]), hi=float(hi_[j])) for j, t in enumerate(targets))
    if not n_folds:
        log("Attention : historique trop court pour tester les méthodes ; la moyenne des 4 semaines est utilisée partout.")

    simple_order = ["moyenne_4_semaines", "an_dernier", "tsb", "gbm_global", "prophet"]
    MIN_VOL = 5.0   # en dessous de 5 articles vendus sur les fenêtres de test, l'erreur en % n'a pas de sens

    def scores_for(pid):
        """Erreur de chaque méthode, calculée sur les MÊMES fenêtres pour toutes (comparaison équitable)."""
        folds = {m: {f for (p, mm, f) in fold_err if p == pid and mm == m} for m in simple_order}
        folds = {m: f for m, f in folds.items() if f}
        if not folds:
            return {}, None
        nmax = max(len(f) for f in folds.values())
        folds = {m: f for m, f in folds.items() if len(f) >= max(1, nmax // 2)}
        common = set.intersection(*folds.values())
        out = {}
        for m in folds:
            e = sum(fold_err[(pid, m, f)][0] for f in common)
            v = sum(fold_err[(pid, m, f)][1] for f in common)
            out[m] = (e / v if v >= MIN_VOL else None, e)
        return out, v if common else 0.0

    choice = {}
    for pid in pids:
        sc, vol = scores_for(pid)
        if not sc:
            choice[pid] = ("moyenne_4_semaines", None, None)
            continue
        key = (lambda m: sc[m][1]) if (vol or 0) < MIN_VOL else (lambda m: sc[m][0])
        base = sc.get("moyenne_4_semaines")
        best = min(sc, key=key)
        # Parcimonie : une méthode plus complexe seulement si elle bat la moyenne d'au moins 2 points d'erreur
        if base and best != "moyenne_4_semaines":
            if (vol or 0) >= MIN_VOL and not (sc[best][0] < base[0] - 0.02):
                best = "moyenne_4_semaines"
            elif (vol or 0) < MIN_VOL and not (sc[best][1] < base[1]):
                best = "moyenne_4_semaines"
        choice[pid] = (best, sc[best][0], base[0] if base else None)

    # ── Prévision finale à partir du dernier jour connu
    future = pd.date_range(end + pd.Timedelta(days=1), periods=H)
    closed = closed_future(C, future)
    trans = season_transition(Y, C, end, future, pids, classes)
    log("Prévision finale…")
    res = run_methods(Y, C, end, future, pids, classes, products, quantiles=False)
    # Fourchette calibrée : quantiles 10 % / 90 % des erreurs relatives (réel − prévu) / (prévu + 1) réellement
    # observées pendant les tests, par méthode ET par taille de prévision (< 1, 1–5, ≥ 5 par jour) : les petits
    # produits (prévus ~0) ne faussent plus la fourchette des produits qui se vendent vraiment.
    # Choix validé sur les fenêtres de test (calibration sans la fenêtre testée) : ≈ 80 % des ventes dans la
    # fourchette et ≈ 10 % au-dessus pour les produits prévus ≥ 1 par jour, contre 63 % / 16 % par produit.
    qlo, qhi = CFG["quantiles"]
    BT = {k: np.array(v) for k, v in bt.items()}
    BT["b"] = np.digitize(BT["yh"], [1.0, 5.0]) if len(BT["yh"]) else np.array([], int)

    def quantile_table(mask, ql=None, qh=None):
        ql = qlo if ql is None else ql
        qh = qhi if qh is None else qh
        tab = {}
        for meth in set(BT["m"][mask]):
            mm = mask & (BT["m"] == meth)
            if mm.sum() >= 20:
                tab[meth] = (np.quantile(BT["r"][mm], ql), np.quantile(BT["r"][mm], qh))
            for b_ in (0, 1, 2):
                mb = mm & (BT["b"] == b_)
                if mb.sum() >= 20:
                    tab[(meth, b_)] = (np.quantile(BT["r"][mb], ql), np.quantile(BT["r"][mb], qh))
        return tab

    QT = quantile_table(np.ones(len(BT["r"]), bool))

    def band(meth, yh, tab=None):
        tab = QT if tab is None else tab
        lo, hi = yh * 0.6, yh * 1.4 + 1
        for j, b_ in enumerate(np.digitize(yh, [1.0, 5.0])):
            q = tab.get((meth, b_)) or tab.get(meth)
            if q:
                lo[j], hi[j] = max(0.0, yh[j] + q[0] * (yh[j] + 1)), yh[j] + q[1] * (yh[j] + 1)
        return lo, hi
    usual = usual_level(Y, C, end, future, pids)
    # Plafond pour un produit prévu à ~0 (hors saison) : la fourchette ne dépasse pas ce qu'il a vendu au plus
    # un jour à la même période l'an dernier (ou ces 4 dernières semaines sans an dernier) : évite « préparer 2 bûches » en janvier.
    recent_max = Y.loc[Y.index > end - pd.Timedelta(days=28), pids].max()
    ly_max = Y.loc[(Y.index > end - pd.Timedelta(days=364)) & (Y.index <= end - pd.Timedelta(days=364 - H)), pids].max() \
        if (end - Y.index.min()).days >= 371 else pd.Series(np.inf, index=pids)
    for pid, kind in trans.items():   # règle de saison : le produit suit l'an dernier (début ou fin de saison)
        if "an_dernier" in res and pid in res["an_dernier"]:
            choice[pid] = ("an_dernier", None, choice[pid][2])
    # Couverture réelle de la fourchette affichée, mesurée HONNÊTEMENT : pour chaque fenêtre de test, fourchette calibrée
    # sans cette fenêtre, et méthode que chaque produit aurait choisie sans elle (_lofo_choice). Produits prévus ≥ 1
    # par jour (ceux pour lesquels « quantité à préparer » compte vraiment).
    # Les niveaux de la fourchette sont ensuite AJUSTÉS pour viser ≈ 10 % des jours au-dessus de la borne haute
    # (= quantité à préparer) et ≈ 10 % sous la borne basse : vérifié en conditions réelles sur 8 dates de 2025,
    # la fourchette 10 / 90 % brute laissait 16 % des jours au-dessus.
    folds_ = sorted(set(BT["f"].tolist())) if len(BT["f"]) else []
    lofo_p = _lofo_choice(fold_err, pids, trans, folds_) if folds_ else {}
    ch_l = np.array([lofo_p.get((p_, f_), "") for p_, f_ in zip(BT["p"], BT["f"])]) if len(BT["p"]) else np.array([])

    def measure(ql, qh):
        ins = ab = be = tot = 0
        for f_ in folds_:
            tab = quantile_table(BT["f"] != f_, ql, qh)
            sel = (BT["f"] == f_) & (BT["m"] == ch_l) & (BT["yh"] >= 1.0)
            for meth in set(BT["m"][sel]):
                mm = sel & (BT["m"] == meth)
                yh_ = BT["yh"][mm]
                y_ = yh_ + BT["r"][mm] * (yh_ + 1.0)
                lo_, hi_ = band(meth, yh_.copy(), tab)
                hi_ = np.maximum(hi_, yh_)
                lo_ = np.minimum(lo_, yh_)
                ins += int(((y_ >= lo_ - 1e-9) & (y_ <= hi_ + 1e-9)).sum())
                ab += int((y_ > hi_ + 1e-9).sum())
                be += int((y_ < lo_ - 1e-9).sum())
                tot += int(mm.sum())
        return (ins / tot, ab / tot, be / tot) if tot else (None, None, None)

    q_hi_used, q_lo_used = qhi, qlo
    if folds_:
        for qh_ in (qhi, 0.925, 0.95, 0.975):
            q_hi_used = qh_
            if (measure(qlo, qh_)[1] or 0) <= 0.10:
                break
        for ql_ in (qlo, 0.075, 0.05, 0.025):
            q_lo_used = ql_
            if (measure(ql_, q_hi_used)[2] or 0) <= 0.10:
                break
        QT = quantile_table(np.ones(len(BT["r"]), bool), q_lo_used, q_hi_used)
    cov_ = measure(q_lo_used, q_hi_used) if folds_ else (None, None, None)
    coverage = round(cov_[0], 3) if cov_[0] is not None else None
    above_rate = round(cov_[1], 3) if cov_[1] is not None else None
    wins = pd.Series([c[0] for c in choice.values()]).value_counts().to_dict()
    log("Méthodes retenues : " + ", ".join(f"{k} {v}" for k, v in wins.items())
        + (f" (dont {len(trans)} par règle de saison : début ou fin de saison d'après l'an dernier)" if trans else ""))
    fc_rows, model_rows = [], []
    price = product_prices(sales, end)
    tot_yh = np.zeros(len(future))
    tot_ca = np.zeros(len(future)) if price is not None else None
    for pid in pids:
        meth, w, wb = choice[pid]
        if meth not in res or pid not in res[meth]:   # repli : on enregistre la méthode réellement utilisée
            meth, w = "moyenne_4_semaines", wb
        yh = np.clip(res[meth][pid][0], 0, None)
        lo, hi = band(meth, yh.astype(float).copy())
        cap = float(ly_max.get(pid, np.inf)) if np.isfinite(ly_max.get(pid, np.inf)) else float(recent_max.get(pid, 0.0))
        hi = np.where(yh < 0.5, np.minimum(hi, np.maximum(yh, cap)), hi)
        yh = np.where(closed, 0, yh)
        lo = np.where(closed, 0, np.clip(np.minimum(lo, yh), 0, None))
        hi = np.where(closed, 0, np.maximum(hi, yh))
        u = np.where(closed, 0, usual[pid])
        tot_yh += yh
        if tot_ca is not None:
            tot_ca += yh * float(price.get(pid, price.attrs.get("global", 0.0)))
        for i, t in enumerate(future):
            fc_rows.append(dict(product_id=pid, ds=t.date(), yhat=round(float(yh[i]), 2), yhat_lower=round(float(lo[i]), 2),
                                yhat_upper=round(float(hi[i]), 2), is_ferme=bool(closed[i]), usual=round(float(u[i]), 2)))
        model_rows.append(dict(product_id=pid, method=meth,
                               wape=None if w is None or not np.isfinite(w) else round(float(w), 4),
                               wape_baseline=None if wb is None or not np.isfinite(wb) else round(float(wb), 4),
                               saison=trans.get(pid),
                               next7=round(float(yh[:7].sum()), 1), usual7=round(float(u[:7].sum()), 1)))
    M = classes.join(pd.DataFrame(model_rows).set_index("product_id"), how="left").reset_index()
    # ── Prévision de toute la boutique : 14 prochains jours (somme des produits) et prochaine saison
    shop_rows, shop_notes = [], {"jours_feries_pays": CFG.get("jours_feries_pays", "") or ""}
    try:
        r_, n_ = shop_short(future, closed, tot_yh, tot_ca, BT, choice, sales, price, Y, C, end, fold_err,
                            {i: o for i, o in enumerate(origins)}, pids, trans)
        shop_rows += r_; shop_notes["court"] = n_
    except Exception as e:
        log(f"Prévision boutique 14 jours non calculée ({type(e).__name__}: {e}).")
    try:
        r_, n_ = shop_season(Y, C, sales, end)
        shop_rows += r_; shop_notes["saison"] = n_
        if n_.get("debut"):
            log(f"Saison prévue : {n_['libelle']} ({n_['debut']} → {n_['fin']}), méthode « même période l'an dernier » "
                f"× évolution^{n_['alpha']} ; erreur mesurée {n_.get('wape_jour')}.")
    except Exception as e:
        log(f"Prévision de saison non calculée ({type(e).__name__}: {e}).")
    run = dict(run_at=datetime.now(), data_start=Y.index.min().date(), data_end=end.date(), horizon=H,
               n_products=int(Y.shape[1]), n_forecast=len(pids),
               notes=json.dumps({"methodes_retenues": wins, "fenetres_test": n_folds, "regle_saison": len(trans),
                                 "couverture_fourchette": coverage, "au_dessus_fourchette": above_rate,
                                 "niveaux_fourchette": [q_lo_used, q_hi_used], "jours_evenement": [str(t.date()) for t in future if event_match(t) is not None],
                                 "boutique": shop_notes, "duree_s": round(time.time() - t0)}, ensure_ascii=False, default=str))
    if args.audit:
        pd.DataFrame(audit_rows).to_csv(os.path.join(DATA, "out_backtest.csv"), index=False)
        pd.DataFrame([dict(product_id=p, kind=k) for p, k in trans.items()]).to_csv(os.path.join(DATA, "out_season.csv"), index=False)
    write(source, run, M, pd.DataFrame(fc_rows), checks, pd.DataFrame(shop_rows))
    log(f"Terminé en {time.time() - t0:.0f} s.")


# ═════════════════════════════ 5 bis. Toute la boutique ═════════════════════════════
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


def product_prices(sales, end):
    """Prix moyen encaissé par article, par produit : 8 dernières semaines, sinon tout l'historique.
    None si la source de données ne contient pas le chiffre d'affaires."""
    if "revenue" not in sales.columns:
        return None
    rv = pd.to_numeric(sales["revenue"], errors="coerce")
    if not rv.notna().any():
        return None
    sv = sales.assign(revenue=rv.fillna(0.0))
    allp = sv.groupby("product_id")[["qty", "revenue"]].sum()
    rec = sv[sv["date"] > end - pd.Timedelta(days=56)].groupby("product_id")[["qty", "revenue"]].sum()
    price = allp["revenue"] / allp["qty"].where(allp["qty"] > 0)
    rp = (rec["revenue"] / rec["qty"].where(rec["qty"] > 0)).dropna()
    price.loc[rp.index] = rp
    tot = rec if rec["qty"].sum() > 0 else allp
    price.attrs["global"] = float(tot["revenue"].sum() / tot["qty"].sum()) if tot["qty"].sum() > 0 else 0.0
    return price.dropna()


def _lofo_choice(fold_err, pids, trans, folds):
    """Méthode que chaque produit aurait choisie SANS la fenêtre testée (même règle que le pipeline : la plus précise,
    la moyenne simple sauf gain de 2 points). Sert à mesurer honnêtement la précision du total de la boutique."""
    by = {}
    for (p_, m_, f_), ev in fold_err.items():
        by.setdefault(p_, {}).setdefault(m_, {})[f_] = ev
    out = {}
    for pid in pids:
        meths = by.get(pid, {})
        for f in folds:
            here = [m for m, d in meths.items() if f in d]
            if not here:
                continue
            if pid in trans:
                out[(pid, f)] = "an_dernier" if "an_dernier" in here else "moyenne_4_semaines"
                continue
            others = [set(meths[m]) - {f} for m in here]
            common = set.intersection(*others) if others else set()
            if not common:
                out[(pid, f)] = "moyenne_4_semaines" if "moyenne_4_semaines" in here else here[0]
                continue
            err = {m: sum(meths[m][g][0] for g in common) for m in here}
            vol = sum(meths[here[0]][g][1] for g in common)
            best = min(err, key=err.get)
            base = "moyenne_4_semaines"
            if base in err and best != base and err[base] - err[best] < 0.02 * max(vol, 1e-9):
                best = base
            out[(pid, f)] = best
    return out


def shop_short(future, closed, tot_yh, tot_ca, BT, choice, sales, price, Y, C, end, fold_err, origins, pids, trans):
    """14 prochains jours pour toute la boutique.
    Prévision = (1 − w) × somme des prévisions par produit + w × ventes de la boutique le même jour l'an dernier
    (même méthode que la saison : jours fermés et jours de fête compris, évolution^0,5). La somme des produits suit
    bien le niveau récent ; « l'an dernier » voit venir les changements de saison et les jours fériés. w est choisi sur
    les fenêtres de test (0,5 par défaut) ; mesuré sur 8 dates de 2025 en conditions réelles : erreur 31 % → 29 %,
    biais −10 % → 0 %.
    Précision et fourchette mesurées HONNÊTEMENT : pour chaque fenêtre de test, chaque produit utilise la méthode
    qu'il aurait choisie sans cette fenêtre (sinon la mesure serait trop optimiste)."""
    notes = {"methode": "somme des produits combinée avec l'an dernier"}
    q, q_ca, w = None, None, 0.0
    T = Y.sum(axis=1)
    Yt = pd.DataFrame({1: T})
    start = Y.index.min()
    has_ly = (end - start).days >= 371 + H

    def ly_shop(origin, days):
        Cc = C.loc[:origin].copy()
        Cc.attrs["daily_total"] = T.loc[:origin]
        f_, _ = _season_days(Yt.loc[:origin], Cc, origin, pd.DatetimeIndex(days), _trend(T.loc[:origin], origin, start), 0.5, 0.0)
        return f_

    G = pd.DataFrame()
    if len(BT["p"]):
        folds = sorted(set(BT["f"].tolist()))
        lofo = _lofo_choice(fold_err, pids, trans, folds)
        ch = np.array([lofo.get((p_, f_), "") for p_, f_ in zip(BT["p"], BT["f"])])
        sel = BT["m"] == ch
        y_ = BT["yh"][sel] + BT["r"][sel] * (BT["yh"][sel] + 1.0)
        D = pd.DataFrame({"f": BT["f"][sel], "p": BT["p"][sel], "d": pd.to_datetime(BT["d"][sel]), "yh": BT["yh"][sel], "y": y_})
        if price is not None:
            D["ca"] = D["yh"] * D["p"].map(price).fillna(price.attrs.get("global", 0.0))
        else:
            D["ca"] = np.nan
        G = D.groupby(["f", "d"], as_index=False)[["yh", "y", "ca"]].sum()
        # Prévision « an dernier » de la boutique faite à la date de chaque fenêtre
        G["ly"] = np.nan
        if has_ly:
            for f_ in G["f"].unique():
                o = origins[f_]
                if (o - start).days < 371 + H:
                    continue
                m_ = G["f"] == f_
                G.loc[m_, "ly"] = ly_shop(o, G.loc[m_, "d"])
        ok_ly = G["ly"].notna()
        if ok_ly.sum() >= 20 and G.loc[ok_ly, "f"].nunique() >= 3:
            Gl = G[ok_ly]
            score = {w_: float(((1 - w_) * Gl["yh"] + w_ * Gl["ly"] - Gl["y"]).abs().sum() / Gl["y"].sum())
                     for w_ in (0.0, 0.25, 0.5, 0.75)}
            best = min(score, key=score.get)
            w = 0.5 if score[0.5] <= score[best] + 0.005 else best
            notes["choix_poids"] = ", ".join(f"w={k:g} → {v:.1%}" for k, v in score.items())
        elif has_ly:
            w = 0.5
            notes["choix_poids"] = "par défaut (trop peu de fenêtres de test pour le mesurer)"
        G["fc"] = np.where(G["ly"].notna(), (1 - w) * G["yh"] + w * G["ly"].fillna(0), G["yh"])
        G = G[G["fc"] > 0]
        if len(G) >= 20:
            rel = (G["y"] - G["fc"]) / G["fc"]

            def loo(ql, qh):
                ins = ab = be = n = 0
                for f_ in G["f"].unique():
                    o = rel[G["f"] != f_]
                    if len(o) < 10:
                        continue
                    a_, b_ = np.quantile(o, ql), np.quantile(o, qh)
                    r_ = rel[G["f"] == f_]
                    ins += int(((r_ >= a_) & (r_ <= b_)).sum()); ab += int((r_ > b_).sum()); be += int((r_ < a_).sum()); n += len(r_)
                return ins, ab, be, n
            # niveaux ajustés pour viser ≈ 10 % des jours au-dessus de la borne haute et ≈ 10 % en dessous de la basse
            qh_ = 0.9
            for qh_ in (0.9, 0.925, 0.95, 0.975):
                i_, a_, b_, n_ = loo(0.1, qh_)
                if n_ and a_ / n_ <= 0.10:
                    break
            ql_ = 0.1
            for ql_ in (0.1, 0.075, 0.05, 0.025):
                i_, a_, b_, n_ = loo(ql_, qh_)
                if n_ and b_ / n_ <= 0.10:
                    break
            q = (float(np.quantile(rel, ql_)), float(np.quantile(rel, qh_)))
            ins, ab, be, n = loo(ql_, qh_)
            notes["niveaux_fourchette"] = [ql_, qh_]
            notes["au_dessus_fourchette"] = round(ab / n, 3) if n else None
            G["wk"] = G.groupby("f")["d"].rank(method="first").sub(1).floordiv(7)
            W = G.groupby(["f", "wk"])[["fc", "y"]].sum()
            per_f = G.groupby("f").apply(lambda x: (x["fc"].sum() - x["y"].sum()) / x["y"].sum())
            notes.update({
                "wape_jour": round(float((G["y"] - G["fc"]).abs().sum() / G["y"].sum()), 3),
                "erreur_mediane_jour": round(float(((G["y"] - G["fc"]).abs() / G["y"].where(G["y"] > 0)).median()), 3),
                "erreur_semaine": round(float(((W["y"] - W["fc"]).abs() / W["y"]).mean()), 3),
                "biais": round(float((G["fc"].sum() - G["y"].sum()) / G["y"].sum()), 3),
                "biais_fenetre_min": round(float(per_f.min()), 3), "biais_fenetre_max": round(float(per_f.max()), 3),
                "couverture_fourchette": round(ins / n, 3) if n else None,
                "jours_testes": int(len(G)), "fenetres": int(G["f"].nunique())})
            # Chiffre d'affaires : CA de la somme des produits, ramené au total combiné, comparé au CA encaissé
            if price is not None and sales is not None and "revenue" in sales.columns:
                ca_real = sales.assign(revenue=pd.to_numeric(sales["revenue"], errors="coerce").fillna(0.0)).groupby("date")["revenue"].sum()
                Gc = G.assign(cafc=G["ca"] * np.where(G["yh"] > 0, G["fc"] / G["yh"], 1.0), real=G["d"].map(ca_real).fillna(0.0))
                Gc = Gc[(Gc["real"] > 0) & (Gc["cafc"] > 0)]
                if len(Gc) >= 20:
                    notes["wape_jour_ca"] = round(float((Gc["real"] - Gc["cafc"]).abs().sum() / Gc["real"].sum()), 3)
                    notes["biais_ca"] = round(float((Gc["cafc"].sum() - Gc["real"].sum()) / Gc["real"].sum()), 3)
                    rc = (Gc["real"] - Gc["cafc"]) / Gc["cafc"]
                    q_ca = (float(np.quantile(rc, 0.1)), float(np.quantile(rc, 0.9)))
    notes["poids_an_dernier"] = w
    ly_f = ly_shop(end, future) if (has_ly and w > 0) else np.zeros(len(future))
    rows = []
    for i, t in enumerate(future):
        bu = float(tot_yh[i])
        yh = 0.0 if closed[i] else ((1 - w) * bu + w * float(ly_f[i]))
        lo, hi = (yh * (1 + q[0]), yh * (1 + q[1])) if q else (yh * 0.75, yh * 1.25)
        lo, hi = max(0.0, min(lo, yh)), max(hi, yh)
        ca = None
        if tot_ca is not None:
            ca = 0.0 if closed[i] else float(tot_ca[i]) * (yh / bu if bu > 0 else 1.0)
        if ca is not None and q_ca:
            ca_lo, ca_hi = max(0.0, min(ca * (1 + q_ca[0]), ca)), max(ca * (1 + q_ca[1]), ca)
        else:
            k = (ca / yh) if (ca is not None and yh > 0) else 0.0
            ca_lo, ca_hi = (lo * k, hi * k) if ca is not None else (None, None)
        rows.append(dict(kind="court", ds=t.date(), yhat=round(yh, 1), yhat_lower=round(lo, 1), yhat_upper=round(hi, 1),
                         ca=None if ca is None else round(ca, 2), ca_lower=None if ca is None else round(ca_lo, 2),
                         ca_upper=None if ca is None else round(ca_hi, 2), is_ferme=bool(closed[i]),
                         somme_produits=round(0.0 if closed[i] else bu, 1)))
    notes["fourchette"] = "mesurée" if q else "par défaut (± 25 %) : historique trop court pour la mesurer"
    return rows, notes


def season_window(Y, C, end):
    """Prochaine saison à prévoir, déduite des données (aucun mois codé en dur) :
    - cœur de saison = mois marqués « saison touristique » dans le calendrier sur la dernière année ; sinon mois
      consécutifs autour du mois le plus fort, au moins 25 % au-dessus du mois médian ;
    - on ajoute un mois avant et un mois après (préparation et fin de saison), 6 mois au plus ;
    - sans saison marquée (ventes régulières toute l'année) : les 3 mois suivant les 14 prochains jours.
    Renvoie (début, fin, mois, explication) ou None si moins d'un an d'historique."""
    if (end - Y.index.min()).days < 365:
        return None
    T = Y.sum(axis=1)
    last = T.index > end - pd.Timedelta(days=365)
    op = C["open"].reindex(T.index).fillna(False).values
    lvl = T[last & op].groupby(T[last & op].index.month).mean().reindex(range(1, 13))
    tour = C["is_touristic"].reindex(T.index).fillna(False).astype(bool)[last]
    tour_m = tour.groupby(tour.index.month).mean().reindex(range(1, 13)).fillna(0)
    core, how = [], ""
    if (tour_m >= 0.5).any():
        core = [m for m in range(1, 13) if tour_m[m] >= 0.5]
        how = "mois marqués saison touristique dans le calendrier"
    elif lvl.notna().sum() >= 6:
        med = float(lvl.median())
        peak = int(lvl.idxmax())
        if med > 0 and lvl[peak] >= 1.25 * med:
            core = [peak]
            for step in (-1, 1):
                m = peak
                while True:
                    m = (m - 1 + step) % 12 + 1
                    if m in core or not (lvl.get(m, np.nan) >= 1.25 * med):
                        break
                    core.append(m)
            how = "mois les plus forts de la dernière année (≥ 25 % au-dessus du mois médian)"
    if core:
        # mois consécutifs (éventuellement à cheval sur deux années) : on part du premier mois de la série
        cs = set(core)
        first = next(m for m in core if ((m - 2) % 12 + 1) not in cs) if len(cs) < 12 else 1
        n_core = len(cs)
        m0 = (first - 2) % 12 + 1          # un mois avant
        n = min(n_core + 2, 6)
        months = [((m0 - 1 + k) % 12) + 1 for k in range(n)]
        for y in range(end.year - 1, end.year + 2):
            st = pd.Timestamp(y, m0, 1)
            en = st + pd.DateOffset(months=n) - pd.Timedelta(days=1)
            # Saison déjà commencée : elle reprend après les 14 jours déjà prévus jour par jour (pas de doublon) ;
            # s'il en reste moins de 4 semaines, on passe à la saison suivante.
            st2 = max(st, end + pd.Timedelta(days=H + 1))
            if en - st2 >= pd.Timedelta(days=28):
                return st2, en, months, how
    st = (end + pd.Timedelta(days=H + 1)).replace(day=1) + pd.DateOffset(months=1)
    en = st + pd.DateOffset(months=3) - pd.Timedelta(days=1)
    return st, en, [((st.month - 1 + k) % 12) + 1 for k in range(3)], "pas de saison marquée : les 3 mois suivants"


def _ly_shop(Yt, C, t, end):
    """Ventes de la boutique « l'an dernier » pour le jour t (même jour de semaine, lissé), avec l'année connue la plus
    récente quand t est à plus d'un an."""
    k = 364
    while t - pd.Timedelta(days=k - 7) > end:
        k += 364
    return _ly_value(Yt, C, t - pd.Timedelta(days=k - 364), 1)


def _trend(T, cut, start):
    """Évolution des ventes : dernière année (ou ce qui est disponible, au moins 4 semaines) / même période un an avant."""
    n = min(365, (cut - start).days - 364)
    if n < 28:
        return 1.0
    cur = T[(T.index > cut - pd.Timedelta(days=n)) & (T.index <= cut)].sum()
    prev = T[(T.index > cut - pd.Timedelta(days=n + 364)) & (T.index <= cut - pd.Timedelta(days=364))].sum()
    return float(np.clip(cur / prev, 0.5, 2.0)) if prev > 0 else 1.0


def _date_ly(Yt, C, t, origin):
    """Ventes de la boutique à la MÊME DATE (jour et mois) l'année connue la plus récente ; None si fermé ou absent."""
    for y in range(1, 4):
        try:
            x = t - pd.DateOffset(years=y)
        except Exception:
            return None
        if x <= origin:
            if x in Yt.index and bool(C["open"].get(x, False)):
                return float(Yt.at[x, 1])
            return None
    return None


def _season_days(Yt, C, origin, days, tr, alpha, blend):
    """Prévision de la boutique pour des jours lointains, à partir de l'historique connu à « origin » :
    (1 − blend) × même jour de semaine l'an dernier (lissé) + blend × même date l'an dernier, × évolution^α ;
    jours d'événement du calendrier : même jour d'événement l'an dernier ; jours fermés : closed_future."""
    global USE_HOL
    USE_HOL = True
    try:
        return _season_days_inner(Yt, C, origin, days, tr, alpha, blend)
    finally:
        USE_HOL = False


def _season_days_inner(Yt, C, origin, days, tr, alpha, blend):
    wk = np.array([_ly_shop(Yt, C, t, origin) for t in days])
    if blend > 0:
        dt = np.array([(lambda v: wk[i] if v is None else v)(_date_ly(Yt, C, t, origin)) for i, t in enumerate(days)])
        base = (1 - blend) * wk + blend * dt
    else:
        base = wk
    yh = base * tr ** alpha
    methods = {"an_dernier": {1: (yh.copy(), yh * 0.8, yh * 1.2)}}
    apply_events(Yt, C, origin, days, [1], methods, ratio={1: tr ** alpha})
    yh = np.clip(methods["an_dernier"][1][0], 0, None)
    closed = closed_future(C, days)
    return np.where(closed, 0.0, yh), closed


def _price_index(sales, end):
    """Évolution des prix à panier constant (mêmes produits, mêmes quantités) : 6 derniers mois / mêmes 6 mois un an
    avant. Le mélange des produits (bûches à Noël…) ne fausse pas la mesure. 1 si l'historique est trop court."""
    if "revenue" not in sales.columns or not pd.to_numeric(sales["revenue"], errors="coerce").notna().any():
        return 1.0
    sv = sales.assign(revenue=pd.to_numeric(sales["revenue"], errors="coerce").fillna(0.0))
    if (end - sv["date"].min()).days < 364 + 182:
        return 1.0
    now = sv[sv["date"] > end - pd.Timedelta(days=182)].groupby("product_id")[["qty", "revenue"]].sum()
    then = sv[(sv["date"] > end - pd.Timedelta(days=182 + 364)) & (sv["date"] <= end - pd.Timedelta(days=364))] \
        .groupby("product_id")[["qty", "revenue"]].sum()
    j = now.join(then, lsuffix="_n", rsuffix="_t", how="inner")
    j = j[(j["qty_n"] > 0) & (j["qty_t"] > 0)]
    if j.empty:
        return 1.0
    pn, pt = j["revenue_n"] / j["qty_n"], j["revenue_t"] / j["qty_t"]
    num, den = float((pn * j["qty_t"]).sum()), float((pt * j["qty_t"]).sum())
    return float(np.clip(num / den, 0.8, 1.25)) if den > 0 else 1.0


def shop_season(Y, C, sales, end):
    """Prévision jour par jour de la prochaine saison pour toute la boutique (plusieurs mois à l'avance).
    Méthode (_season_days) : même jour de semaine l'an dernier, mélangé (part « blend ») avec la même date l'an dernier
    (pics liés à une date, ex. 14 juillet, 15 août), × évolution des ventes sur un an puissance α ; jours d'événement
    et jours fermés compris. α et blend sont CHOISIS sur l'historique de la boutique : prévisions complètes (fermetures
    et événements compris) faites à plusieurs dates passées, 1 à 8 mois à l'avance, comparées aux ventes réelles.
    Les mêmes tests donnent l'erreur affichée et la fourchette."""
    win = season_window(Y, C, end)
    if win is None:
        return [], {"message": "moins d'un an d'historique : pas de prévision de saison"}
    st, en, months, how = win
    T = Y.sum(axis=1)
    Yt = pd.DataFrame({1: T})
    start = Y.index.min()
    op = C["open"]
    # ── Tests : prévisions complètes faites à des dates passées (fins de mois), 4 à 34 semaines à l'avance
    cuts = [c for c in pd.date_range(start + pd.Timedelta(days=365 + 28), end - pd.Timedelta(days=60), freq="ME")][-12:]
    grid = [(a, b) for a in (0.0, 0.5, 1.0) for b in (0.0, 0.25, 0.5)]
    rec = {g: [] for g in grid}
    for cut in cuts:
        Yc, Cc = Yt.loc[:cut], C.loc[:cut].copy()
        Cc.attrs["daily_total"] = T.loc[:cut]
        tr = _trend(T.loc[:cut], cut, start)
        days = pd.date_range(cut + pd.Timedelta(days=28), min(cut + pd.Timedelta(days=240), end))
        if len(days) < 14:
            continue
        y = np.array([float(T[t]) if bool(op.get(t, False)) else 0.0 for t in days])
        for g in grid:
            f, _ = _season_days(Yc, Cc, cut, days, tr, g[0], g[1])
            rec[g] += [(cut, t, y[i], f[i]) for i, t in enumerate(days)]
    default = (0.5, 0.0)
    alpha, blend = default
    note_choice = "par défaut (historique trop court pour le mesurer)"
    n_cuts = len({r[0] for r in rec[default]})
    if n_cuts >= 3:
        score = {g: sum(abs(y - f) for _, _, y, f in v) / max(1e-9, sum(y for _, _, y, _f in v)) for g, v in rec.items()}
        best = min(score, key=score.get)
        alpha, blend = default if score[default] <= score[best] + 0.005 else best
        note_choice = (f"choisis sur l'historique ({n_cuts} dates passées) : erreur {score[(alpha, blend)]:.1%} "
                       f"(sans évolution ni date : {score[(0.0, 0.0)]:.1%} ; évolution entière : {score[(1.0, 0.0)]:.1%})")
    R = pd.DataFrame(rec[(alpha, blend)], columns=["cut", "t", "y", "f"])
    q, cover, wape_d, err_m, bias = None, None, None, None, None
    if len(R) >= 30 and R["y"].sum() > 0:
        wape_d = round(float((R["y"] - R["f"]).abs().sum() / R["y"].sum()), 3)
        bias = round(float((R["f"].sum() - R["y"].sum()) / R["y"].sum()), 3)
        R["m"] = pd.to_datetime(R["t"]).dt.to_period("M")
        Mo = R.groupby(["cut", "m"])[["y", "f"]].sum()
        Mo = Mo[Mo["y"] > 0]
        err_m = round(float(((Mo["y"] - Mo["f"]).abs() / Mo["y"]).mean()), 3)
        O = R[(R["f"] > 0) & (R["y"] > 0)].copy()
        if len(O) >= 30:
            O["rel"] = O["y"] / O["f"] - 1
            q = (float(np.quantile(O["rel"], 0.1)), float(np.quantile(O["rel"], 0.9)))
            ins = n = 0
            for c_ in O["cut"].unique():
                o = O.loc[O["cut"] != c_, "rel"]
                if len(o) < 20:
                    continue
                a_, b_ = np.quantile(o, 0.1), np.quantile(o, 0.9)
                r_ = O.loc[O["cut"] == c_, "rel"]
                ins += int(((r_ >= a_) & (r_ <= b_)).sum()); n += len(r_)
            cover = round(ins / n, 3) if n else None
    # ── Prévision
    days = pd.date_range(st, en)
    tr = _trend(T, end, start)
    yh, closed = _season_days(Yt, C, end, days, tr, alpha, blend)
    lo = yh * (1 + q[0]) if q else yh * 0.7
    hi = yh * (1 + q[1]) if q else yh * 1.3
    # Évolution récente (3 derniers mois / mêmes mois un an avant), pour information
    n3 = T[(T.index > end - pd.Timedelta(days=91))].sum()
    p3 = T[(T.index > end - pd.Timedelta(days=91 + 364)) & (T.index <= end - pd.Timedelta(days=364))].sum()
    tr3 = round(float(n3 / p3), 3) if p3 > 0 and (end - start).days >= 364 + 91 else None
    # Chiffre d'affaires : prix par article du même mois l'an dernier × évolution des prix à panier constant
    price_m = {}
    if "revenue" in sales.columns and pd.to_numeric(sales["revenue"], errors="coerce").notna().any():
        sv = sales.assign(revenue=pd.to_numeric(sales["revenue"], errors="coerce").fillna(0.0))
        d_ = sv.groupby("date")[["qty", "revenue"]].sum()
        ly = d_[d_.index > end - pd.Timedelta(days=365)]
        g = ly.groupby(ly.index.month).sum()
        price_m = (g["revenue"] / g["qty"].where(g["qty"] > 0)).dropna().to_dict()
    drift = _price_index(sales, end)
    glob = float(np.mean(list(price_m.values()))) if price_m else None
    rows = []
    for i, t in enumerate(days):
        p_ = price_m.get(t.month, glob)
        ca = None if p_ is None else float(yh[i] * p_ * drift)
        lo_i, hi_i = max(0.0, min(lo[i], yh[i])), max(hi[i], yh[i])
        rows.append(dict(kind="saison", ds=t.date(), yhat=round(float(yh[i]), 1), yhat_lower=round(float(lo_i), 1),
                         yhat_upper=round(float(hi_i), 1), ca=None if ca is None else round(ca, 2),
                         ca_lower=None if ca is None else round(lo_i * p_ * drift, 2),
                         ca_upper=None if ca is None else round(hi_i * p_ * drift, 2), is_ferme=bool(closed[i])))
    d1 = "" if st.day == 1 else f"{st.day} "
    lib = (f"{d1}{MOIS[st.month - 1]} – {MOIS[en.month - 1]} {en.year}" if st.year == en.year
           else f"{d1}{MOIS[st.month - 1]} {st.year} – {MOIS[en.month - 1]} {en.year}")
    notes = {"debut": str(st.date()), "fin": str(en.date()), "mois": months, "libelle": lib, "choix_mois": how,
             "alpha": alpha, "part_meme_date": blend, "choix_alpha": note_choice, "evolution": round(tr, 3),
             "evolution_3_mois": tr3, "evolution_prix": round(drift, 3),
             "wape_jour": wape_d, "erreur_mois": err_m, "biais": bias, "couverture_fourchette": cover,
             "fourchette": "mesurée" if q else "par défaut (± 30 %) : historique trop court pour la mesurer",
             "dates_test": n_cuts, "jours_fermes": [str(t.date()) for t, c_ in zip(days, closed) if c_]}
    return rows, notes


# ═════════════════════════════ 6. Enregistrement ═════════════════════════════
DDL = """
CREATE TABLE IF NOT EXISTS product_forecast_runs (
    run_id SERIAL PRIMARY KEY, run_at TIMESTAMP NOT NULL, data_start DATE, data_end DATE,
    horizon INT, n_products INT, n_forecast INT, notes TEXT);
CREATE TABLE IF NOT EXISTS product_forecast_models (
    run_id INT REFERENCES product_forecast_runs(run_id) ON DELETE CASCADE, product_id INT,
    segment VARCHAR(30), saisonnier BOOLEAN, status VARCHAR(20), method VARCHAR(40),
    wape NUMERIC(10,4), wape_baseline NUMERIC(10,4), n_sale_days INT, adi NUMERIC(10,2), cv2 NUMERIC(10,2),
    first_sale DATE, last_sale DATE, avg_qty_open_day NUMERIC(12,3), next7 NUMERIC(12,1), usual7 NUMERIC(12,1),
    PRIMARY KEY (run_id, product_id));
CREATE TABLE IF NOT EXISTS product_forecasts (
    run_id INT REFERENCES product_forecast_runs(run_id) ON DELETE CASCADE, product_id INT, ds DATE,
    yhat NUMERIC(12,2), yhat_lower NUMERIC(12,2), yhat_upper NUMERIC(12,2), is_ferme BOOLEAN,
    PRIMARY KEY (run_id, product_id, ds));
ALTER TABLE product_forecasts ADD COLUMN IF NOT EXISTS usual NUMERIC(12,2);
ALTER TABLE product_forecast_models ADD COLUMN IF NOT EXISTS saison VARCHAR(10);
CREATE TABLE IF NOT EXISTS shop_forecasts (
    run_id INT REFERENCES product_forecast_runs(run_id) ON DELETE CASCADE, kind VARCHAR(10), ds DATE,
    yhat NUMERIC(12,1), yhat_lower NUMERIC(12,1), yhat_upper NUMERIC(12,1),
    ca NUMERIC(14,2), ca_lower NUMERIC(14,2), ca_upper NUMERIC(14,2), is_ferme BOOLEAN,
    PRIMARY KEY (run_id, kind, ds));
CREATE TABLE IF NOT EXISTS forecast_data_checks (
    run_id INT REFERENCES product_forecast_runs(run_id) ON DELETE CASCADE, check_type VARCHAR(40),
    severity VARCHAR(20), date_from DATE, date_to DATE, detail TEXT);
"""


def _clean(v):
    if v is None or (isinstance(v, float) and not np.isfinite(v)):
        return None
    if isinstance(v, pd.Timestamp):
        return v.date()
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return None if not np.isfinite(v) else float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    try:
        if pd.isna(v):
            return None
    except Exception:
        pass
    return v


MODEL_COLS = ["product_id", "segment", "saisonnier", "status", "method", "wape", "wape_baseline", "n_sale_days", "adi",
              "cv2", "first_sale", "last_sale", "avg_qty_open_day", "next7", "usual7", "saison"]


def write(source, run, M, F, checks, S=None):
    S = S if S is not None else pd.DataFrame()
    if source == "csv":
        json.dump({k: str(v) for k, v in run.items()}, open(os.path.join(DATA, "out_run.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        M[MODEL_COLS].to_csv(os.path.join(DATA, "out_models.csv"), index=False)
        F.to_csv(os.path.join(DATA, "out_forecasts.csv"), index=False)
        pd.DataFrame(checks).to_csv(os.path.join(DATA, "out_checks.csv"), index=False)
        S.to_csv(os.path.join(DATA, "out_shop.csv"), index=False)
        log(f"Résultats écrits dans {DATA} (out_*.csv)")
        return
    sys.path.insert(0, os.path.join(HERE, "..", "backend"))
    from db.db import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(DDL)
    cur.execute("""INSERT INTO product_forecast_runs (run_at, data_start, data_end, horizon, n_products, n_forecast, notes)
                   VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING run_id""",
                (run["run_at"], run["data_start"], run["data_end"], run["horizon"], run["n_products"], run["n_forecast"], run["notes"]))
    run_id = cur.fetchone()[0]
    cur.executemany(f"INSERT INTO product_forecast_models (run_id, {', '.join(MODEL_COLS)}) VALUES ({', '.join(['%s'] * (len(MODEL_COLS) + 1))})",
                    [tuple([run_id] + [_clean(r[c]) for c in MODEL_COLS]) for r in M.to_dict("records")])
    cur.executemany("""INSERT INTO product_forecasts (run_id, product_id, ds, yhat, yhat_lower, yhat_upper, is_ferme, usual)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                    [(run_id, _clean(r["product_id"]), r["ds"], r["yhat"], r["yhat_lower"], r["yhat_upper"], r["is_ferme"], r["usual"])
                     for r in F.to_dict("records")])
    if len(S):
        cur.executemany("""INSERT INTO shop_forecasts (run_id, kind, ds, yhat, yhat_lower, yhat_upper, ca, ca_lower, ca_upper, is_ferme)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        [(run_id, r["kind"], r["ds"], _clean(r["yhat"]), _clean(r["yhat_lower"]), _clean(r["yhat_upper"]),
                          _clean(r["ca"]), _clean(r["ca_lower"]), _clean(r["ca_upper"]), bool(r["is_ferme"])) for r in S.to_dict("records")])
    cur.executemany("INSERT INTO forecast_data_checks (run_id, check_type, severity, date_from, date_to, detail) VALUES (%s,%s,%s,%s,%s,%s)",
                    [(run_id, c["check_type"], c["severity"], _clean(c["date_from"]), _clean(c["date_to"]), c["detail"]) for c in checks])
    if not conn.autocommit:
        conn.commit()
    log(f"Résultats enregistrés dans la base (run n° {run_id}).")


if __name__ == "__main__":
    main()
