"""
BD/002_import_from_api.py
==========================
Import des ventes depuis l'API d'un fournisseur (caisse / logiciel de boulangerie) → PostgreSQL.

Le tableau de bord ne lit QUE la base PostgreSQL. Ce script remplit les mêmes tables que
BD/001_import_from_pkl.py ; rien d'autre ne change dans l'application.

Réglage : BD/api_mapping.json (noms des champs de l'API, authentification, pagination).
Secrets (jamais dans un fichier du projet) :
    API_BASE_URL   ex. https://api.fournisseur.example/v1
    API_TOKEN      clé ou jeton d'accès

Utilisation :
    python BD/002_import_from_api.py                    # depuis le dernier jour en base (- recouvrement)
    python BD/002_import_from_api.py --since 2026-01-01
    python BD/002_import_from_api.py --dry-run          # tout calculer, ne rien écrire
    python BD/002_import_from_api.py --from-json ventes.json   # sans réseau : export de l'API déjà téléchargé
    python BD/002_import_from_api.py --no-refresh       # ne pas recalculer les prévisions ensuite
    python BD/002_import_from_api.py --no-analytics     # ne pas recalculer vitesse de vente / règles d'association

Règles :
  * A partir de la date de départ, l'API fait foi : les lignes de ticket de ces jours sont
    REMPLACÉES par celles de l'API (relancer le script ne crée donc jamais de doublons).
  * Tout est récupéré et vérifié AVANT la moindre écriture, puis écrit en une seule transaction :
    en cas d'erreur, la base reste telle qu'elle était.
  * Événements : si l'API ne fournit pas le nom de l'événement du jour, il vient du calendrier réglable
    BD/events_calendar.py + BD/events_config.json (garder ou retirer les événements français).
  * Recalcule ensuite, dans la même transaction, la vitesse de vente et les règles d'association
    (BD/analytics.py). product_penetration n'est pas recalculée : aucune page ne la lit.
  * Seuls les jours de --since à --until sont remplacés : les jours après --until ne sont jamais touchés.
  * Pages : on lit jusqu'à une page vide (une API qui plafonne la taille des pages ne fait plus perdre de lignes).
  * Produits vendus au poids (quantité 0,35 kg…) : chaque ligne compte pour 1 article, au montant réel encaissé.
  * Heures : un horodatage avec fuseau (« Z », « +01:00 ») est converti en heure locale de la boutique
    (réglage "timezone", par défaut Europe/Paris) avant de prendre le jour et l'heure.
  * Famille : si la caisse change la famille d'un produit, la famille la plus récente est enregistrée.
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
import requests
from sqlalchemy import create_engine, text

import analytics
import client_settings
import events_calendar
from db_config import PG_URL

HERE = Path(__file__).resolve().parent
DEFAULT_MAPPING = HERE / "api_mapping.json"
JOUR_NORMAL = "Jour Normal"
DEFAULT_SHOP_TZ = "Europe/Paris"    # fuseau de la boutique si api_mapping.json ne dit rien (réglage "timezone")
SEASONS = ["Hiver", "Printemps", "Ete", "Automne"]
MOIS_NOMS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
             "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
JOURS_NOMS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
CALENDAR_MARGIN_DAYS = 15          # même marge que l'import pkl : le calendrier dépasse la dernière vente
INSERT_CHUNK = 5000
NORMALISED_COLS = ["source_row_id", "date_id", "ticket_number", "article", "category",
                   "quantity", "unit_price", "total_revenue", "hour", "event"]


# ───────────────────────── Calendrier ─────────────────────────

_SOUTH = {"Printemps": "Automne", "Ete": "Hiver", "Automne": "Printemps", "Hiver": "Ete"}


def season_for(d: date, hemisphere: str = "north") -> str:
    """Saison par bornes fixes (20/3, 21/6, 22/9, 21/12), vérifiées sur toutes les dates vendues des données de démonstration.
    hemisphere « south » (client_settings.json) inverse les saisons."""
    md = (d.month, d.day)
    if (3, 20) <= md <= (6, 20):
        name = "Printemps"
    elif (6, 21) <= md <= (9, 21):
        name = "Ete"
    elif (9, 22) <= md <= (12, 20):
        name = "Automne"
    else:
        name = "Hiver"
    return _SOUTH[name] if hemisphere == "south" else name


def is_touristic(d: date, months=()) -> bool:
    """Haute saison touristique : les mois listés dans client_settings.json (touristic_months ; aucun par défaut)."""
    return d.month in months


def open_days(counts: pd.Series, ratio: float, min_tickets=None) -> set:
    """Jours « ouverts » parmi `counts` (index = jour, valeur = nombre de tickets ; jours avec ventes seulement).

    Un jour est ouvert s'il atteint `ratio` fois le nombre de tickets habituel, c'est-à-dire la médiane des 28 jours de vente
    PRÉCÉDENTS (même principe que le calcul des prévisions : aucun regard sur les jours suivants). En dessous : quelques ventes
    isolées un jour de fermeture. `min_tickets` (si renseigné) remplace cette règle par un seuil absolu. Sans historique
    suffisant (moins de 5 jours), tout jour avec des ventes est ouvert."""
    if counts.empty:
        return set()
    counts = counts.sort_index()
    if min_tickets is not None:
        return {d for d, n in counts.items() if n >= int(min_tickets)}
    med = counts.shift(1).rolling(28, min_periods=5).median().bfill().ffill()
    if med.isna().all():
        return set(counts.index)
    return {d for d, n in counts.items() if n >= max(1.0, float(ratio) * float(med[d]))}


# ───────────────────────── Réglages ─────────────────────────

def load_mapping(path: Path) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            m = json.load(f)
    except FileNotFoundError:
        raise SystemExit(f"[ERREUR] Fichier de réglage introuvable : {path}")
    except json.JSONDecodeError as e:
        raise SystemExit(f"[ERREUR] {path} n'est pas un JSON valide : {e}")

    fields = m.get("fields") or {}
    problems = []
    for need in ("ticket_number", "article", "quantity"):
        if not fields.get(need):
            problems.append(f"fields.{need} doit être renseigné")
    if not fields.get("timestamp") and not (fields.get("date") and fields.get("hour")):
        problems.append("il faut fields.timestamp, ou bien fields.date ET fields.hour")
    if not fields.get("unit_price") and not fields.get("total_revenue"):
        problems.append("il faut fields.unit_price ou fields.total_revenue (l'un des deux suffit)")
    if problems:
        raise SystemExit("[ERREUR] Réglage incomplet dans " + str(path) + " :\n  - " + "\n  - ".join(problems))
    m.setdefault("params", {})
    m.setdefault("response", {})
    m.setdefault("auth", {"type": "none"})
    return m


# ───────────────────────── Appels à l'API ─────────────────────────

def _auth_parts(mapping: dict):
    """Retourne (en-têtes, paramètres) d'authentification. Le jeton ne s'affiche jamais."""
    auth = mapping.get("auth") or {}
    kind = (auth.get("type") or "none").lower()
    if kind == "none":
        return {}, {}
    token = os.environ.get("API_TOKEN")
    if not token:
        raise SystemExit("[ERREUR] Variable d'environnement API_TOKEN absente (authentification : %s)." % kind)
    name = auth.get("name") or "Authorization"
    if kind == "bearer":
        return {name: f"Bearer {token}"}, {}
    if kind == "header":
        return {name: token}, {}
    if kind == "query":
        return {}, {name: token}
    raise SystemExit(f"[ERREUR] auth.type inconnu : {kind} (bearer, header, query ou none)")


def _get_json(url: str, headers: dict, params: dict, retries: int = 3):
    last = None
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=headers, params=params, timeout=30)
        except requests.RequestException as e:
            last = f"erreur réseau : {type(e).__name__}"
        else:
            if r.status_code == 429 or r.status_code >= 500:
                last = f"HTTP {r.status_code}"
            elif r.status_code >= 400:
                # erreur définitive (accès refusé, mauvaise adresse...) : inutile de réessayer
                raise SystemExit(f"[ERREUR] L'API a répondu HTTP {r.status_code} pour {url}")
            else:
                try:
                    return r.json()
                except ValueError:
                    raise SystemExit(f"[ERREUR] La réponse de {url} n'est pas du JSON.")
        if attempt < retries - 1:
            time.sleep(2 ** attempt)
    raise SystemExit(f"[ERREUR] API injoignable après {retries} essais ({last}) : {url}")


def _walk(payload, path):
    """Descend dans la réponse selon un chemin pointé ('data.items'). path vide = la réponse elle-même."""
    cur = payload
    if path:
        for key in str(path).split("."):
            if not isinstance(cur, dict) or key not in cur:
                raise SystemExit(f"[ERREUR] Chemin '{path}' introuvable dans la réponse de l'API (clé '{key}').")
            cur = cur[key]
    if not isinstance(cur, list):
        raise SystemExit(f"[ERREUR] On attendait une liste de lignes de vente à '{path or 'la racine'}'.")
    return cur


def fetch_records(mapping: dict, d_from: date, d_to: date) -> list:
    base = os.environ.get("API_BASE_URL")
    if not base:
        raise SystemExit("[ERREUR] Variable d'environnement API_BASE_URL absente.")
    url = base.rstrip("/") + "/" + str(mapping.get("endpoint", "")).lstrip("/")
    headers, auth_params = _auth_parts(mapping)

    p = mapping["params"]
    fmt = p.get("date_format", "%Y-%m-%d")
    window = max(1, int(p.get("window_days", 31)))
    inclusive = bool(p.get("to_inclusive", True))
    page_size = int(p.get("page_size_value", 1000))
    resp = mapping["response"]
    paginated = (resp.get("pagination", "none") or "none").lower() == "page"
    if (resp.get("pagination") or "none").lower() not in ("page", "none"):
        raise SystemExit("[ERREUR] response.pagination : 'page' ou 'none'.")

    records, start = [], d_from
    total_path = resp.get("total_path")
    while start <= d_to:
        end = min(start + timedelta(days=window - 1), d_to)
        base_params = dict(auth_params)
        if p.get("date_from"):
            base_params[p["date_from"]] = start.strftime(fmt)
        if p.get("date_to"):
            base_params[p["date_to"]] = (end if inclusive else end + timedelta(days=1)).strftime(fmt)
        if paginated:
            # On lit jusqu'à une page VIDE : beaucoup d'API plafonnent la taille des pages (ex. 100 lignes même si on en
            # demande 1000) ; s'arrêter à la première page « plus courte » faisait alors perdre des lignes sans erreur.
            page, prev_sig, got, expected = 1, None, 0, None
            while True:
                q = dict(base_params)
                q[p.get("page", "page")] = page
                if p.get("page_size"):
                    q[p["page_size"]] = page_size
                payload = _get_json(url, headers, q)
                chunk = _walk(payload, resp.get("records_path"))
                if total_path and expected is None:
                    expected = _total(payload, total_path)
                if not chunk:
                    break
                sig = hashlib.blake2b(json.dumps(chunk[:3], sort_keys=True, default=str).encode(), digest_size=8).hexdigest()
                if sig == prev_sig:   # l'API ignore le numéro de page : elle renvoie toujours la même page
                    raise SystemExit("[ERREUR] L'API renvoie deux fois la même page : vérifier params.page dans api_mapping.json.")
                prev_sig = sig
                records.extend(chunk)
                got += len(chunk)
                page += 1
                if page > 100000:
                    raise SystemExit("[ERREUR] Pagination sans fin (plus de 100 000 pages).")
            if expected is not None and got != expected:
                raise SystemExit(f"[ERREUR] {start} → {end} : l'API annonce {expected} lignes mais en a envoyé {got}. Rien n'a été écrit.")
        else:
            records.extend(_walk(_get_json(url, headers, base_params), resp.get("records_path")))
        print(f"   API {start} → {end} : {len(records):,} lignes au total")
        start = end + timedelta(days=1)
    return records


def _total(payload, path):
    cur = payload
    for key in str(path).split("."):
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    try:
        return int(cur)
    except (TypeError, ValueError):
        return None


# ───────────────────────── Normalisation ─────────────────────────

def _stable_id(date_id, ticket, article, nth) -> int:
    key = f"{date_id}|{ticket}|{article}|{nth}".encode("utf-8")
    return int.from_bytes(hashlib.blake2b(key, digest_size=8).digest(), "big") & 0x7FFFFFFFFFFFFFFF


def normalise(records: list, mapping: dict):
    """Lignes brutes de l'API → table au format de fact_ticket_lines (+ rapport de ce qui est écarté)."""
    report = {"received": len(records), "dropped_invalid": 0, "excluded_negative_qty": 0,
              "excluded_negative_revenue": 0.0, "weighed_lines": 0, "weighed_products": [], "timezone": None}
    if not records:
        return pd.DataFrame(columns=NORMALISED_COLS), report

    f = mapping["fields"]
    raw = pd.DataFrame(records)

    def col(name, required=True):
        """Colonne de l'API réglée pour `name` ; None si ce champ n'est pas réglé (null) dans le fichier de réglage.
        Un champ réglé mais absent de la réponse est toujours une erreur (jamais ignoré en silence)."""
        src = f.get(name)
        if not src:
            return None
        if src not in raw.columns:
            raise SystemExit(f"[ERREUR] Le champ '{src}' (réglé pour '{name}') n'existe pas dans la réponse de l'API. "
                             f"Champs reçus : {', '.join(map(str, raw.columns))}")
        return raw[src]

    df = pd.DataFrame(index=raw.index)

    tz = mapping.get("timezone")
    if f.get("timestamp"):
        raw_ts = col("timestamp").astype(str).str.strip()
        # Horodatage AVEC fuseau (« ...Z », « ...+01:00 ») : c'est un instant précis, on le ramène à l'heure locale de la
        # boutique. Sans cela, une vente de 0 h 30 à Paris (23 h 30 UTC) tombait la veille, et toutes les heures étaient décalées.
        aware = raw_ts.str.contains(r"(?:Z|[+-]\d{2}:?\d{2})$", regex=True).mean() > 0.5
        if aware or tz:
            shop_tz = tz or DEFAULT_SHOP_TZ
            ts = pd.to_datetime(raw_ts, errors="coerce", utc=True, format="mixed").dt.tz_convert(shop_tz)
            report["timezone"] = shop_tz + ("" if tz else " (par défaut)")
        else:
            ts = pd.to_datetime(raw_ts, errors="coerce", format="mixed")
        df["date_id"] = ts.dt.date
        df["hour"] = ts.dt.hour
    else:
        df["date_id"] = pd.to_datetime(col("date"), errors="coerce").dt.date
        df["hour"] = pd.to_numeric(col("hour"), errors="coerce")

    df["ticket_number"] = col("ticket_number").astype(str).str.strip()
    df["article"] = col("article").astype(str).str.strip()
    # Deux noms pour un même produit (bouton de caisse en double) : on regroupe sous le nom voulu
    aliases = {client_settings.norm(k): str(v).strip() for k, v in (mapping.get("article_aliases") or {}).items()}
    if aliases:
        df["article"] = [aliases.get(client_settings.norm(a), a) for a in df["article"]]
    cat = col("category", required=False)
    df["category"] = (cat.fillna("Autre").astype(str).str.strip() if cat is not None else "Autre")
    df.loc[df["category"] == "", "category"] = "Autre"
    # Famille corrigée à la main pour certains articles (la famille envoyée par la caisse est parfois fausse)
    overrides = {client_settings.norm(k): str(v).strip() for k, v in (mapping.get("category_overrides") or {}).items()}
    if overrides:
        df["category"] = [overrides.get(client_settings.norm(a), c) for a, c in zip(df["article"], df["category"])]
    ev = col("event", required=False)
    df["event"] = (ev.fillna(JOUR_NORMAL).astype(str).str.strip() if ev is not None else JOUR_NORMAL)
    df.loc[df["event"] == "", "event"] = JOUR_NORMAL

    qty = pd.to_numeric(col("quantity"), errors="coerce")
    price = pd.to_numeric(col("unit_price", required=False), errors="coerce") if f.get("unit_price") else None
    total = pd.to_numeric(col("total_revenue", required=False), errors="coerce") if f.get("total_revenue") else None
    if total is None:
        total = qty * price
    if price is None:
        price = (total / qty.where(qty > 0)).fillna(0.0)
    df["quantity"], df["unit_price"], df["total_revenue"] = qty, price, total

    line_id = pd.to_numeric(col("line_id", required=False), errors="coerce") if f.get("line_id") else None
    if line_id is not None:
        df["source_row_id"] = line_id
    else:
        df["source_row_id"] = pd.NA

    # Lignes inutilisables : on les compte et on les signale
    valid = (df["date_id"].notna() & df["hour"].notna() & (df["ticket_number"] != "") & (df["ticket_number"].str.lower() != "nan")
             & (df["article"] != "") & (df["article"].str.lower() != "nan")
             & df["quantity"].notna() & df["total_revenue"].notna() & df["unit_price"].notna())
    if line_id is not None:
        valid &= df["source_row_id"].notna()
    report["dropped_invalid"] = int((~valid).sum())
    df = df[valid].copy()

    # La table n'accepte pas les quantités négatives (retours) : écartées et chiffrées dans le rapport
    neg = df["quantity"] < 0
    report["excluded_negative_qty"] = int(neg.sum())
    report["excluded_negative_revenue"] = float(df.loc[neg, "total_revenue"].sum())
    df = df[~neg].copy()

    # Produits vendus au poids (quantité 0,35 kg…) : la table compte des ARTICLES (nombres entiers). Chaque ligne d'un
    # produit au poids compte pour 1 article vendu, au montant réellement encaissé (le chiffre d'affaires reste exact).
    # Un produit est « au poids » s'il est listé dans weight_articles, ou s'il a au moins une quantité non entière.
    listed = {client_settings.norm(a) for a in (mapping.get("weight_articles") or [])}
    frac = df.loc[df["quantity"] % 1 != 0, "article"]
    weighed = set(frac) | {a for a in df["article"].unique() if client_settings.norm(a) in listed}
    w = df["article"].isin(weighed)
    report["weighed_lines"] = int(w.sum())
    report["weighed_products"] = sorted(weighed)
    if w.any():
        df.loc[w, "unit_price"] = df.loc[w, "total_revenue"]
        df.loc[w, "quantity"] = 1
    df["quantity"] = df["quantity"].astype("int64")
    df["hour"] = df["hour"].astype("int64").clip(0, 23)
    df["unit_price"] = df["unit_price"].astype(float)
    df["total_revenue"] = df["total_revenue"].astype(float)

    if line_id is not None:
        if (df["source_row_id"] % 1 != 0).any():
            raise SystemExit("[ERREUR] Le champ d'identifiant de ligne (fields.line_id) n'est pas un entier. "
                             "Mettre null dans api_mapping.json pour calculer un identifiant stable.")
        df["source_row_id"] = df["source_row_id"].astype("int64")
    else:
        nth = df.groupby(["date_id", "ticket_number", "article"]).cumcount()
        df["source_row_id"] = [_stable_id(d, t, a, n) for d, t, a, n in
                               zip(df["date_id"], df["ticket_number"], df["article"], nth)]

    df = df.sort_values(["date_id", "hour"], kind="stable")
    df = df[NORMALISED_COLS].drop_duplicates().reset_index(drop=True)
    dup = df["source_row_id"].duplicated(keep=False)
    if dup.any():
        raise SystemExit(f"[ERREUR] {int(dup.sum())} lignes différentes partagent le même identifiant de ligne "
                         f"(ex. {df.loc[dup, 'source_row_id'].iloc[0]}). Rien n'a été écrit.")
    return df, report


# ───────────────────────── Écriture en base ─────────────────────────

def _chunks(rows, n):
    for i in range(0, len(rows), n):
        yield rows[i:i + n]


def calendar_rows(first: date, last: date, sale_dates: set, season_ids: dict, last_sale: date,
                  touristic_months=(), hemisphere: str = "north") -> list:
    """Lignes de dim_dates. Le drapeau touristique n'est posé que jusqu'à la dernière vente : au-delà, il reste faux comme
    dans les données actuelles, car le calcul des prévisions projette alors la saison de l'an dernier. Un calendrier futur
    à moitié rempli (quelques jours de juillet seulement) lui ferait croire qu'il est complet et supprimerait la saison."""
    rows = []
    for d in pd.date_range(first, last, freq="D"):
        dd = d.date()
        iso = d.isocalendar()
        dow = int(d.weekday())
        rows.append({
            "date_id": dd, "year": int(d.year), "month": int(d.month), "month_name": MOIS_NOMS[d.month - 1],
            "week_iso": f"{iso.year}-W{int(iso.week):02d}", "day_of_week": dow, "day_name": JOURS_NOMS[dow],
            "is_weekend": dow >= 5, "is_touristic": is_touristic(dd, touristic_months) and dd <= last_sale,
            "season_id": season_ids[season_for(dd, hemisphere)] if dd in sale_dates else None,
        })
    return rows


def write_to_db(conn, df: pd.DataFrame, since: date, settings: dict = None, until: date = None, mapping: dict = None) -> dict:
    """Écrit dans la transaction ouverte (le commit / rollback est décidé par l'appelant).
    Seuls les jours de `since` à `until` (inclus) sont remplacés ; les jours après `until` ne sont pas touchés."""
    stats = {}
    cfg = settings if settings is not None else client_settings.load()
    tmonths, hemi = cfg["touristic_months"], cfg["hemisphere"]
    if until is None:
        until = max(df["date_id"]) if len(df) else since
    df = df[(df["date_id"] >= since) & (df["date_id"] <= until)].copy()

    # 1) Identifiants déjà pris par des lignes AUTRES que celles qu'on remplace : on s'arrête net
    ids = [int(x) for x in df["source_row_id"]]
    clash = []
    for part in _chunks(ids, 20000):
        clash += conn.execute(text("SELECT source_row_id FROM fact_ticket_lines "
                                   "WHERE source_row_id = ANY(:ids) AND (date_id < :since OR date_id > :until) LIMIT 5"),
                              {"ids": part, "since": since, "until": until}).scalars().all()
        if clash:
            break
    if clash:
        raise SystemExit(f"[ERREUR] Des identifiants de ligne de l'API existent déjà en base pour des jours plus anciens "
                         f"(ex. {clash[:3]}) : les identifiants de l'API et ceux de l'ancien import se recouvrent. "
                         "Rien n'a été écrit. Utiliser --since plus tôt, ou mettre fields.line_id à null.")

    # 2) Dimensions
    for s in SEASONS:
        conn.execute(text("INSERT INTO dim_seasons (season_name) VALUES (:n) ON CONFLICT (season_name) DO NOTHING"), {"n": s})
    season_ids = {r[1]: r[0] for r in conn.execute(text("SELECT season_id, season_name FROM dim_seasons"))}

    for ev in sorted(set(df["event"]) | {JOUR_NORMAL}):
        conn.execute(text("INSERT INTO dim_events (event_name, event_date, is_event) VALUES (:n, NULL, :e) "
                          "ON CONFLICT (event_name) DO NOTHING"), {"n": ev, "e": ev.lower() != JOUR_NORMAL.lower()})
    event_ids = {r[1]: r[0] for r in conn.execute(text("SELECT event_id, event_name FROM dim_events"))}

    for c in sorted(set(df["category"])):
        conn.execute(text("INSERT INTO dim_categories (category_name) VALUES (:n) ON CONFLICT (category_name) DO NOTHING"), {"n": c})
    cat_ids = {r[1]: r[0] for r in conn.execute(text("SELECT category_id, category_name FROM dim_categories"))}

    # Famille : la plus RÉCENTE vue pour chaque produit (les lignes sont triées par jour et heure). Si la caisse change la
    # famille d'un produit, le produit suit. « Autre » (famille absente) ne remplace jamais une vraie famille.
    last_cat = df.groupby("article")["category"].last()
    known = {r[0]: r[1] for r in conn.execute(text(
        "SELECT p.article_name, c.category_name FROM dim_products p LEFT JOIN dim_categories c ON c.category_id = p.category_id"))}
    new_products, changed = 0, []
    for art, c in last_cat.items():
        if art not in known:
            conn.execute(text("INSERT INTO dim_products (article_name, category_id) VALUES (:a, :c) "
                              "ON CONFLICT (article_name) DO NOTHING"), {"a": art, "c": cat_ids.get(c)})
            new_products += 1
        elif c != "Autre" and known[art] != c:
            conn.execute(text("UPDATE dim_products SET category_id = :c WHERE article_name = :a"), {"a": art, "c": cat_ids.get(c)})
            changed.append(f"{art} : {known[art] or '—'} → {c}")
    # Familles corrigées à la main (category_overrides) : appliquées aussi aux produits déjà en base
    overrides = {client_settings.norm(k): str(v).strip() for k, v in ((mapping or {}).get("category_overrides") or {}).items()}
    if overrides:
        for v in set(overrides.values()):
            conn.execute(text("INSERT INTO dim_categories (category_name) VALUES (:n) ON CONFLICT (category_name) DO NOTHING"), {"n": v})
        cat_ids = {r[1]: r[0] for r in conn.execute(text("SELECT category_id, category_name FROM dim_categories"))}
        for art, cur in list(known.items()):
            want = overrides.get(client_settings.norm(art))
            if want and cur != want and art not in last_cat.index:
                conn.execute(text("UPDATE dim_products SET category_id = :c WHERE article_name = :a"), {"a": art, "c": cat_ids[want]})
                changed.append(f"{art} : {cur or '—'} → {want}")
    prod_ids = {r[1]: r[0] for r in conn.execute(text("SELECT product_id, article_name FROM dim_products"))}
    stats["new_products"] = new_products
    stats["family_changes"] = changed

    # 3) Calendrier : jours manquants entre le départ et la dernière vente (+ marge), saison des jours vendus
    sale_dates = set(df["date_id"])
    first_day = min(since, min(sale_dates))
    last_day = max(sale_dates) + timedelta(days=CALENDAR_MARGIN_DAYS)
    last_sale = max(sale_dates)
    cal = calendar_rows(first_day, last_day, sale_dates, season_ids, last_sale, tmonths, hemi)
    conn.execute(text("""INSERT INTO dim_dates (date_id, year, month, month_name, week_iso, day_of_week, day_name,
                                                is_weekend, is_touristic, season_id)
                         VALUES (:date_id, :year, :month, :month_name, :week_iso, :day_of_week, :day_name,
                                 :is_weekend, :is_touristic, :season_id)
                         ON CONFLICT (date_id) DO NOTHING"""), cal)
    for d in sale_dates:   # jour déjà au calendrier mais sans saison : on la renseigne
        conn.execute(text("UPDATE dim_dates SET season_id = :s WHERE date_id = :d AND season_id IS NULL"),
                     {"s": season_ids[season_for(d, hemi)], "d": d})

    # Jours déjà au calendrier mais posés « hors saison » avant que leurs ventes n'arrivent (calendrier futur) : on corrige
    stats["touristic_fixed"] = conn.execute(text("""
        UPDATE dim_dates SET is_touristic = (EXTRACT(MONTH FROM date_id) = ANY(CAST(:m AS INTEGER[])))
        WHERE date_id BETWEEN :s AND :e
          AND is_touristic IS DISTINCT FROM (EXTRACT(MONTH FROM date_id) = ANY(CAST(:m AS INTEGER[])))"""),
        {"s": since, "e": last_sale, "m": list(tmonths)}).rowcount

    # 4) Lignes de ticket : remplacement des jours >= since
    stats["deleted_lines"] = conn.execute(text("DELETE FROM fact_ticket_lines WHERE date_id BETWEEN :s AND :u"),
                                          {"s": since, "u": until}).rowcount
    rows = [{
        "source_row_id": int(r.source_row_id), "date_id": r.date_id, "ticket_number": r.ticket_number,
        "product_id": int(prod_ids[r.article]), "quantity": int(r.quantity), "unit_price": float(r.unit_price),
        "total_revenue": float(r.total_revenue), "hour": int(r.hour), "event_id": int(event_ids[r.event]),
    } for r in df.itertuples(index=False)]
    ins = text("""INSERT INTO fact_ticket_lines (source_row_id, date_id, ticket_number, product_id, quantity,
                                                  unit_price, total_revenue, hour, event_id)
                  VALUES (:source_row_id, :date_id, :ticket_number, :product_id, :quantity,
                          :unit_price, :total_revenue, :hour, :event_id)""")
    for part in _chunks(rows, INSERT_CHUNK):
        conn.execute(ins, part)
    stats["inserted_lines"] = len(rows)

    # 5) Agrégats recalculés à partir des lignes (mêmes définitions que les tables existantes).
    #    daily_aggregates ne contient que les jours OUVERTS (le tableau de bord y lit « le dernier jour » et l'historique des
    #    prévisions) : quelques ventes isolées un jour de fermeture ne doivent pas en faire un jour ouvert. Règle relative à
    #    l'habitude de la boutique (open_days), réglée par client_settings.json ; les 60 jours précédents servent de repère.
    conn.execute(text("DELETE FROM daily_aggregates WHERE date_id BETWEEN :s AND :u"), {"s": since, "u": until})
    ctx = conn.execute(text("""SELECT date_id, COUNT(DISTINCT ticket_number) FROM fact_ticket_lines
                               WHERE date_id BETWEEN :s AND :u GROUP BY date_id"""), {"s": since - timedelta(days=60), "u": until}).all()
    counts = pd.Series({r[0]: int(r[1]) for r in ctx}, dtype="int64")
    opened = sorted(d for d in open_days(counts, cfg["open_day_min_ratio"], cfg["open_day_min_tickets"]) if since <= d <= until)
    if opened:
        conn.execute(text("""INSERT INTO daily_aggregates (date_id, nb_tickets, nb_articles, ca_jour, ref_actives)
                             SELECT date_id, COUNT(DISTINCT ticket_number), COALESCE(SUM(quantity), 0),
                                    COALESCE(SUM(total_revenue), 0), COUNT(DISTINCT product_id)
                             FROM fact_ticket_lines WHERE date_id = ANY(:d) GROUP BY date_id"""), {"d": opened})
    stats["days_below_threshold"] = len(sale_dates) - len(opened)
    analytics.recount_daily_articles(conn, since)      # articles du jour sans les non-produits (sac, découpe...)
    conn.execute(text("""INSERT INTO monthly_ca (month_start, year, month, total_revenue)
                         SELECT date_trunc('month', date_id)::date, EXTRACT(YEAR FROM date_id)::int,
                                EXTRACT(MONTH FROM date_id)::int, SUM(total_revenue)
                         FROM fact_ticket_lines
                         WHERE date_id >= date_trunc('month', CAST(:s AS date))::date
                         GROUP BY 1, 2, 3
                         ON CONFLICT (month_start) DO UPDATE SET total_revenue = EXCLUDED.total_revenue,
                                                                 year = EXCLUDED.year, month = EXCLUDED.month"""),
                 {"s": since})
    return stats


# ───────────────────────── Programme principal ─────────────────────────

def _parse_day(s: str) -> date:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise SystemExit(f"[ERREUR] Date invalide '{s}' (format AAAA-MM-JJ).")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Import des ventes depuis l'API du fournisseur.")
    ap.add_argument("--since", help="Premier jour à (re)charger, AAAA-MM-JJ. Défaut : dernier jour en base moins le recouvrement.")
    ap.add_argument("--until", help="Dernier jour à charger. Défaut : aujourd'hui.")
    ap.add_argument("--mapping", default=str(DEFAULT_MAPPING), help="Fichier de réglage JSON.")
    ap.add_argument("--from-json", help="Lire les lignes dans ce fichier JSON (liste) au lieu d'appeler l'API.")
    ap.add_argument("--dry-run", action="store_true", help="Tout calculer et vérifier, ne rien écrire.")
    ap.add_argument("--no-refresh", action="store_true", help="Ne pas recalculer les prévisions après l'import.")
    ap.add_argument("--events-config", default=str(events_calendar.CONFIG_PATH),
                    help="Fichier JSON des événements (défaut : BD/events_config.json).")
    ap.add_argument("--no-analytics", action="store_true",
                    help="Ne pas recalculer la vitesse de vente et les règles d'association.")
    args = ap.parse_args(argv)

    print("=" * 70)
    print("[DEMARRAGE] IMPORT API -> PostgreSQL" + ("  (essai à blanc : rien ne sera écrit)" if args.dry_run else ""))
    print("=" * 70)
    mapping = load_mapping(Path(args.mapping))
    try:
        settings = client_settings.load()
    except client_settings.SettingsError as e:
        raise SystemExit(f"[ERREUR] client_settings.json : {e}")
    engine = create_engine(PG_URL, future=True, client_encoding="utf8")

    with engine.connect() as c:
        last_in_db = c.execute(text("SELECT MAX(date_id) FROM fact_ticket_lines")).scalar()
    if args.since:
        since = _parse_day(args.since)
    elif last_in_db:
        since = last_in_db - timedelta(days=int(mapping.get("overlap_days", 3)))
    else:
        raise SystemExit("[ERREUR] Base vide : indiquer --since AAAA-MM-JJ (premier jour à charger).")
    until = _parse_day(args.until) if args.until else date.today()
    if until < since:
        raise SystemExit(f"[ERREUR] --until ({until}) est avant le jour de départ ({since}).")
    print(f"[INFO] Dernier jour en base : {last_in_db}   |   chargement du {since} au {until}")

    if args.from_json:
        with open(args.from_json, encoding="utf-8") as fh:
            records = _walk(json.load(fh), mapping["response"].get("records_path"))
        print(f"[INFO] {len(records):,} lignes lues dans {args.from_json}")
    else:
        # Un jour de plus de chaque côté : l'API filtre souvent sur la date UTC, alors qu'une vente de 0 h 30 heure de
        # Paris est la veille en UTC. On garde ensuite seulement les jours de since à until, en heure locale.
        records = fetch_records(mapping, since - timedelta(days=1), until + timedelta(days=1))

    df, rep = normalise(records, mapping)
    print(f"[INFO] Reçues : {rep['received']:,}   |   valides : {len(df):,}   |   inutilisables écartées : {rep['dropped_invalid']:,}")
    if rep["timezone"]:
        print(f"[INFO] Horodatages avec fuseau : convertis en heure locale ({rep['timezone']}).")
    if rep["weighed_lines"]:
        print(f"[INFO] {rep['weighed_lines']:,} ligne(s) de produits vendus au poids ({', '.join(rep['weighed_products'][:5])}"
              f"{'…' if len(rep['weighed_products']) > 5 else ''}) : 1 article par ligne, au montant encaissé.")
    if rep["excluded_negative_qty"]:
        print(f"[ATTENTION] {rep['excluded_negative_qty']:,} ligne(s) à quantité négative (retours ?) non importées "
              f"(montant : {rep['excluded_negative_revenue']:,.2f}). La base n'accepte pas les quantités négatives.")
    df = df[(df["date_id"] >= since) & (df["date_id"] <= until)].copy()
    if not mapping["fields"].get("event") and not df.empty:
        try:
            ev_cfg = events_calendar.load_config(args.events_config)
            label = events_calendar.build_labeler(ev_cfg)
        except events_calendar.EventsConfigError as e:
            raise SystemExit(f"[ERREUR] {e}")
        df["event"] = df["date_id"].map(label)
        ev_days = df.drop_duplicates("date_id")["event"].value_counts()
        ev_days = ev_days[ev_days.index != JOUR_NORMAL]
        print(f"[INFO] Événements (calendrier {ev_cfg.get('profile', '?')}, {Path(args.events_config).name}"
              + (", désactivé" if not ev_cfg.get("enabled", True) else "") + ") : "
              + (", ".join(f"{k} ({v} j)" for k, v in ev_days.items()) if len(ev_days) else "aucun sur la période"))
    if df.empty:
        print("[INFO] Aucune ligne de vente dans cette période : la base n'a pas été modifiée.")
        return 0
    print(f"[INFO] Jours couverts : {df['date_id'].min()} → {df['date_id'].max()} ({df['date_id'].nunique()} jours, "
          f"{df.groupby(['date_id', 'ticket_number']).ngroups:,} tickets)")

    with engine.connect() as conn:
        try:
            night = float(((df["hour"] >= 0) & (df["hour"] < 4)).mean()) if len(df) else 0.0
            if night > 0.05:
                print(f"[ATTENTION] {night:.0%} des ventes entre 0 h et 4 h : les heures de l'API sont peut-être dans un autre "
                      "fuseau. Régler \"timezone\" dans api_mapping.json (ex. \"Europe/Paris\").")
            stats = write_to_db(conn, df, since, settings, until, mapping)
            if args.no_analytics:
                stats["analytics"] = None
            else:
                stats["analytics"] = analytics.refresh_analytics(conn)
            if args.dry_run:
                conn.rollback()
                print(f"[ESSAI A BLANC] Aurait remplacé {stats['deleted_lines']:,} lignes par {stats['inserted_lines']:,} "
                      f"(nouveaux produits : {stats['new_products']}). Rien n'a été écrit.")
                return 0
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
    print(f"[OK] {stats['deleted_lines']:,} lignes remplacées par {stats['inserted_lines']:,} "
          f"(nouveaux produits : {stats['new_products']}). Agrégats journaliers et mensuels mis à jour.")
    if stats.get("family_changes"):
        print(f"[INFO] Famille mise à jour pour {len(stats['family_changes'])} produit(s) : " + " ; ".join(stats["family_changes"][:5])
              + (" …" if len(stats["family_changes"]) > 5 else ""))
    if stats["days_below_threshold"]:
        print(f"[INFO] {stats['days_below_threshold']} jour(s) trop calmes pour compter comme ouverts (fermeture avec quelques "
              "ventes isolées) : leurs lignes sont gardées mais ils ne comptent pas comme jours ouverts.")
    if stats["touristic_fixed"]:
        print(f"[INFO] Saison touristique corrigée sur {stats['touristic_fixed']} jour(s) du calendrier (ventes arrivées après coup).")
    an = stats["analytics"]
    if an is None:
        print("[NOTE] --no-analytics : vitesse de vente et règles d'association gardent leurs valeurs précédentes "
              "(les nouveaux produits n'y figurent pas encore).")
    else:
        print(f"[OK] Vitesse de vente : {an['velocity_rows']} produits ; règles d'association : {an['rule_rows']} lignes.")

    if not args.no_refresh:
        r = subprocess.run([sys.executable, str(HERE.parent / "forecasting" / "refresh_forecasts.py")])
        if r.returncode != 0:
            print("[ATTENTION] Import terminé, mais la mise à jour des prévisions n'a pas abouti "
                  "(voir le journal dans forecasting/data/). Relancer : python forecasting\\refresh_forecasts.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
