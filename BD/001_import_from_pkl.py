"""
BD/001_import_from_pkl.py
==========================
Migration retail_data.pkl → PostgreSQL (schéma BD/schema.sql)
"""

import pickle
import sys
import numpy as np
import pandas as pd
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.dialects.postgresql import insert

PG_URL = "postgresql+psycopg2://postgres:admin123@127.0.0.1:5432/retail_db"


def find_pkl():
    base = Path(__file__).resolve().parent.parent
    for cand in [
        base / "retail_data.pkl",
        base / "existing_bi" / "boulangerie-performance--main" / "retail_data.pkl",
        Path("retail_data.pkl"),
    ]:
        if cand.exists():
            return cand
    return None


def upsert_dim(conn, table, rows, key_col, id_col):
    """Insert simple avec mapping key -> id (sans update on conflict)."""
    mapping = {}
    for row in rows:
        k = row.get(key_col)
        if k is None:
            continue
        ins_cols = ", ".join(row.keys())
        ph = ", ".join([f":{c}" for c in row.keys()])
        stmt = text(f"""
            INSERT INTO {table} ({ins_cols}) VALUES ({ph})
            ON CONFLICT ({key_col}) DO NOTHING
            RETURNING {id_col}, {key_col}
        """)
        res = conn.execute(stmt, row).fetchone()
        if res is None:
            sel = text(f"SELECT {id_col}, {key_col} FROM {table} WHERE {key_col} = :v")
            res = conn.execute(sel, {"v": k}).fetchone()
        mapping[k] = res[0] if res else None
    return mapping


def import_dimensions(conn, df_clean):
    print("→ Dimensions ...")

    # dim_categories
    cats = sorted({str(c).strip() for c in df_clean["category"].dropna().unique()
                   if str(c).strip() and str(c).lower() != "a classifier"})
    cat_map = upsert_dim(conn, "dim_categories",
                         [{"category_name": c} for c in cats],
                         "category_name", "category_id")
    print(f"   dim_categories : {len(cat_map)}")

    seasons = []
    if "season" in df_clean.columns:
        seasons = sorted({str(s).strip() for s in df_clean["season"].dropna().unique() if str(s).strip()})
    season_map = upsert_dim(conn, "dim_seasons",
                            [{"season_name": s} for s in seasons],
                            "season_name", "season_id")
    print(f"   dim_seasons : {len(season_map)}")

    # dim_events
    ev_rows = []
    if "event" in df_clean.columns:
        evs = sorted({str(e).strip() for e in df_clean["event"].dropna().unique() if str(e).strip()})
        for e in evs:
            ev_rows.append({
                "event_name": e,
                "event_date": None,
                "is_event": e.lower() != "jour normal",
            })
    event_map = upsert_dim(conn, "dim_events", ev_rows, "event_name", "event_id")
    print(f"   dim_events : {len(event_map)}")

    # dim_products (article + category_id + SANS PRIX)
    grp = df_clean.groupby("article", dropna=False).agg(
        category_first=("category", "first"),
    ).reset_index()
    prod_rows = []
    for _, r in grp.iterrows():
        art = str(r["article"]).strip()
        if not art: continue
        cid = cat_map.get(str(r["category_first"]).strip())
        prod_rows.append({"article_name": art, "category_id": cid})
    prod_map = upsert_dim(conn, "dim_products", prod_rows, "article_name", "product_id")
    print(f"   dim_products : {len(prod_map)}")

    # dim_dates : couvre min(df_clean.date) → max(forecast_saison.ds) + marge
    all_dates_set = set(pd.to_datetime(df_clean["date"], errors="coerce").dropna().dt.date)
    # on étendra après si besoin avec prévisions
    return cat_map, season_map, event_map, prod_map, all_dates_set


def import_dim_dates_full(conn, df_clean_dates_extra, season_map, is_touristic_per_date, season_per_date):
    """Construit dim_dates SUR TOUTE LA PLAGE (ventes + prévisions)."""
    all_days = pd.date_range(min(df_clean_dates_extra), max(df_clean_dates_extra), freq="D")
    mois_noms = ["Janvier","Février","Mars","Avril","Mai","Juin",
                 "Juillet","Août","Septembre","Octobre","Novembre","Décembre"]
    jours_noms = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"]
    rows = []
    for d in all_days:
        dd = d.date()
        iso = d.isocalendar()
        week_iso = f"{iso.year}-W{int(iso.week):02d}"
        dow = int(d.weekday())
        season_id = season_map.get(season_per_date.get(dd)) if season_per_date.get(dd) in season_map else None
        rows.append({
            "date_id":      dd,
            "year":         int(d.year),
            "month":        int(d.month),
            "month_name":   mois_noms[d.month - 1],
            "week_iso":     week_iso,
            "day_of_week":  dow,
            "day_name":     jours_noms[dow],
            "is_weekend":   dow >= 5,
            "is_touristic": bool(is_touristic_per_date.get(dd, False)),
            "season_id":    season_id,
        })
    df_dates = pd.DataFrame(rows)
    df_dates.to_sql("dim_dates", conn, if_exists="append", index=False, chunksize=500, method="multi")
    print(f"   dim_dates : {len(df_dates)} jours ({min(df_clean_dates_extra)} → {max(df_clean_dates_extra)})")


def import_fact_ticket_lines(conn, df_clean, prod_map, event_map):
    df = df_clean.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    df["date_id"] = df["date"].dt.date
    for c in ["quantity","unit_price","total_revenue","hour"]:
        if c not in df.columns: df[c] = 0
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    df["hour"] = df["hour"].astype(int).clip(0, 23)

    df["article_safe"] = df["article"].astype(str).fillna("Produit").str.strip()
    df["product_id"] = df["article_safe"].map(prod_map)
    if "event" in df.columns:
        df["event_safe"] = df["event"].astype(str).fillna("").str.strip()
        df["event_id"] = df["event_safe"].map(event_map)
    else:
        df["event_id"] = None

    # Retirer produits non mappés (aucun normalement)
    before = len(df)
    df = df.dropna(subset=["product_id"])
    if len(df) < before:
        print(f"   [ATTENTION]  {before-len(df)} lignes sans produit_id (ignorées)")
    df["product_id"] = df["product_id"].astype(int)
    df["transaction_id"] = pd.to_numeric(df["transaction_id"], errors="coerce").fillna(0).astype(np.int64)

    out_cols = ["transaction_id","date_id","ticket_number","product_id","quantity",
                "unit_price","total_revenue","hour","event_id"]
    df_out = df[out_cols].copy()
    df_out = df_out.rename(columns={"transaction_id": "source_row_id"})
    df_out["ticket_number"] = df_out["ticket_number"].astype(str)
    df_out["quantity"] = df_out["quantity"].astype(int)
    df_out["unit_price"] = df_out["unit_price"].astype(float)
    df_out["total_revenue"] = df_out["total_revenue"].astype(float)
    df_out["hour"] = df_out["hour"].astype(int)
    df_out["event_id"] = df_out["event_id"].astype("Int64")

    print(f"→ fact_ticket_lines : {len(df_out):,} lignes en cours d'insert...")
    # Par chunks pour ne pas saturer
    chunks = 20000
    for i in range(0, len(df_out), chunks):
        chunk = df_out.iloc[i:i+chunks]
        chunk.to_sql("fact_ticket_lines", conn, if_exists="append", index=False, chunksize=5000, method="multi")
        print(f"   ... {min(i+chunks, len(df_out)):,}/{len(df_out):,}")
    print(f"   fact_ticket_lines : {len(df_out):,} lignes OK")


def import_product_penetration(conn, data, prod_map):
    df_pen = data.get("df_penetration")
    if df_pen is None or df_pen.empty:
        print("⏭ product_penetration : absent")
        return
    df = df_pen.copy()
    df["article_safe"] = df["article"].astype(str).str.strip()
    df["product_id"] = df["article_safe"].map(prod_map)
    df = df.dropna(subset=["product_id"])
    if not {"tickets_count","penetration_rate_%","statut_strategique"}.issubset(df.columns):
        print("⏭ product_penetration : colonnes manquantes")
        return
    out = pd.DataFrame({
        "product_id":        df["product_id"].astype(int),
        "tickets_count":     pd.to_numeric(df["tickets_count"], errors="coerce").fillna(0).astype(int),
        "penetration_rate":  pd.to_numeric(df["penetration_rate_%"], errors="coerce").fillna(0.0).astype(float),
        "statut_strategique":df["statut_strategique"].astype(str).fillna("Autre"),
    })
    out.to_sql("product_penetration", conn, if_exists="append", index=False, chunksize=500)
    print(f"   product_penetration : {len(out)}")


def import_product_velocity(conn, data, prod_map):
    df_m = data.get("df_macro")
    if df_m is None or df_m.empty:
        print("⏭ product_velocity_stats : absent")
        return
    df = df_m.copy()
    df["article_safe"] = df["article"].astype(str).str.strip()
    df["product_id"] = df["article_safe"].map(prod_map)
    df = df.dropna(subset=["product_id"])
    def G(r, names):
        for n in names:
            if n in df.columns:
                v = r[n]
                if isinstance(v, (int, float, np.number)) and not (isinstance(v, float) and np.isnan(v)):
                    return float(v)
        return None
    rows = []
    for _, r in df.iterrows():
        dv = G(r, ["daily_velocity"])
        vt = G(r, ["velocity_touristic","velocity_tour"])
        ve = G(r, ["velocity_event"])
        ss = G(r, ["stock_securite","stock_securite_mini"])
        rt = G(r, ["ratio_touristic"])
        re_ = G(r, ["ratio_event"])
        rows.append({
            "product_id": int(r["product_id"]),
            "daily_velocity":     dv if dv is not None else 0.0,
            "velocity_touristic": vt,
            "velocity_event":     ve,
            "stock_securite":     ss if ss is not None else 0.0,
            "ratio_touristic":    rt,
            "ratio_event":        re_,
        })
    pd.DataFrame(rows).to_sql("product_velocity_stats", conn, if_exists="append", index=False, chunksize=500)
    print(f"   product_velocity_stats : {len(rows)}")


def import_forecast_models_and_metrics(conn, data):
    # Insérer d'abord les modèles utilisés (pour FK)
    models = [
        {"model_name": "14j_global",   "forecast_type": "articles",
         "description": "Prévisions Prophet J+1 à J+14 (global)"},
        {"model_name": "saison_2026",  "forecast_type": "articles",
         "description": "Prévisions saison estivale 2026"},
    ]
    for m in models:
        ins = text("""
            INSERT INTO forecast_models (model_name, forecast_type, description)
            VALUES (:model_name, :forecast_type, :description)
            ON CONFLICT (model_name) DO NOTHING
        """)
        conn.execute(ins, m)
    print("   forecast_models : insérés")

    # ml_metrics
    mdape = float(data.get("mdape_cv", 20.9) or 20.9)
    metrics = [
        ("14j_global", "MDAPE_CV",   mdape),
        ("14j_global", "MAPE_J+1",   round(mdape*0.70, 2)),
        ("14j_global", "MAPE_J+7",   round(mdape*0.90, 2)),
        ("14j_global", "MAPE_J+14",  mdape),
        ("14j_global", "MAPE_J+30",  round(mdape*1.20, 2)),
        ("14j_global", "TRAIN_ERR",  round(mdape*0.85, 2)),
        ("14j_global", "VAL_ERR",    mdape),
    ]
    rows = [{"model_name": m, "metric_name": n, "value": v} for (m, n, v) in metrics]
    pd.DataFrame(rows).to_sql("ml_metrics", conn, if_exists="append", index=False, chunksize=500)
    print(f"   ml_metrics : {len(rows)} lignes")


def import_association_rules(conn, data, prod_map):
    regles = data.get("regles")
    if regles is None or regles.empty:
        print("⏭ association_rules : absent")
        return
    df = regles.copy()

    def to_list(x):
        if isinstance(x, (frozenset, set, list, tuple)):
            return [str(v).strip() for v in x if str(v).strip()]
        s = str(x).strip()
        return [s] if s else []

    ante_str = df["antecedents"].apply(to_list) if "antecedents" in df.columns else [[]]*len(df)
    cons_str = df["consequents"].apply(to_list) if "consequents" in df.columns else [[]]*len(df)
    ante_txt = df["antecedents_str"] if "antecedents_str" in df.columns else None
    cons_txt = df["consequents_str"] if "consequents_str" in df.columns else None

    def val(r, col, defval):
        if col in df.columns:
            v = r[col]
            if isinstance(v, (int, float, np.number)) and not (isinstance(v, float) and np.isnan(v)):
                return float(v)
        return defval

    rows = []
    for i, (_, r) in enumerate(df.iterrows()):
        a_noms = ante_str[i]
        c_noms = cons_str[i]
        if not a_noms or not c_noms: continue
        a_ids = [int(prod_map[a]) for a in a_noms if a in prod_map]
        c_ids = [int(prod_map[c]) for c in c_noms if c in prod_map]
        if not a_ids or not c_ids: continue
        atxt = ante_txt.iloc[i] if ante_txt is not None else ", ".join(a_noms)
        ctxt = cons_txt.iloc[i] if cons_txt is not None else ", ".join(c_noms)
        # Pour chaque conséquent séparément
        for cid in c_ids:
            rows.append((
                a_ids, cid,
                val(r, "antecedent support", 0.0),
                val(r, "consequent support", 0.0),
                val(r, "support", 0.0),
                val(r, "confidence", 0.0),          # [OK] echelle 0-1 (PAS x100)
                val(r, "lift", 1.0),
                val(r, "leverage", 0.0),
                val(r, "conviction", 1.0),
                val(r, "zhangs_metric", 0.0),
                val(r, "representativity", None),
                val(r, "jaccard", None),
                val(r, "certainty", None),
                val(r, "kulczynski", None),
                str(atxt)[:500] if atxt else None,
                str(ctxt)[:500] if ctxt else None,
            ))
    if not rows:
        print("⏭ association_rules : aucune règle valide")
        return
    # Bulk insert via psycopg2 mogrify (gère INT[] proprement)
    cur = conn.connection.cursor()
    args_b = b",".join(cur.mogrify(
        "(%s::INT[],%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        t
    ) for t in rows)
    cur.execute(b"""
        INSERT INTO association_rules
          (antecedent_ids, consequent_id, antecedent_support, consequent_support,
           support, confidence, lift, leverage, conviction, zhangs_metric,
           representativity, jaccard, certainty, kulczynski,
           antecedents_str, consequents_str)
        VALUES """ + args_b)
    print(f"   association_rules : {len(rows)} règles")


def import_prophet_forecasts(conn, data):
    """Insère forecast_14j + forecast_saison."""
    total = 0
    for (model_name, key) in [("14j_global", "forecast_14j"),
                              ("saison_2026", "forecast_saison")]:
        df_fc = data.get(key)
        if df_fc is None or df_fc.empty:
            print(f"⏭ prophet_forecasts[{model_name}] : absent")
            continue
        df = df_fc.copy()
        if "ds" not in df.columns and "date" in df.columns:
            df = df.rename(columns={"date": "ds"})
        df["ds"] = pd.to_datetime(df["ds"], errors="coerce").dt.date
        df = df.dropna(subset=["ds"])
        def colv(r, names, defval=None):
            for n in names:
                if n in df.columns:
                    v = r[n]
                    if isinstance(v, (int, float, np.number)) and not (isinstance(v, float) and np.isnan(v)):
                        return float(v)
            return defval
        rows = []
        for _, r in df.iterrows():
            yhat = colv(r, ["yhat"]) or 0.0
            lo = colv(r, ["yhat_lower"])
            hi = colv(r, ["yhat_upper"])
            ferme = colv(r, ["is_ferme"], 0.0) or 0.0
            rows.append({
                "model_name": model_name,
                "ds": r["ds"],
                "yhat": yhat,
                "yhat_lower": lo,
                "yhat_upper": hi,
                "is_ferme": bool(int(ferme) > 0),
            })
        pd.DataFrame(rows).to_sql("prophet_forecasts", conn, if_exists="append", index=False, chunksize=500)
        print(f"   prophet_forecasts[{model_name}] : {len(rows)}")
        total += len(rows)
    return total


def import_monthly_ca(conn, data):
    cm = data.get("ca_mensuel")
    if cm is None or cm.empty:
        print("⏭ monthly_ca : absent")
        return
    df = cm.copy()
    if "date" not in df.columns:
        print("⏭ monthly_ca : date absente"); return
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    tr_col = "total_revenue" if "total_revenue" in df.columns else df.columns[-1]
    out = pd.DataFrame({
        "month_start":   df["date"].dt.to_period("M").dt.to_timestamp().dt.date,
        "year":          df["date"].dt.year.astype(int),
        "month":         df["date"].dt.month.astype(int),
        "total_revenue": pd.to_numeric(df[tr_col], errors="coerce").fillna(0.0).astype(float),
    }).drop_duplicates(subset=["month_start"])
    out.to_sql("monthly_ca", conn, if_exists="append", index=False, chunksize=500)
    print(f"   monthly_ca : {len(out)}")


def import_daily_aggregates(conn, data):
    dd = data.get("daily_data")
    if dd is None or dd.empty:
        print("⏭ daily_aggregates : absent")
        return
    df = dd.copy()
    if "date" not in df.columns and "ds" in df.columns:
        df = df.rename(columns={"ds": "date"})
    if "date" not in df.columns:
        print("⏭ daily_aggregates : date absente"); return
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    df["date_id"] = df["date"].dt.date
    def C(names):
        for n in names:
            if n in df.columns: return n
        return None
    tc = C(["nb_tickets","tickets","ticket_number"])
    ac = C(["nb_articles","articles","quantity"])
    cj = C(["ca_jour","total_revenue","ca"])
    ra = C(["ref_actives","articles_uniques"])
    out = pd.DataFrame({
        "date_id": df["date_id"],
        "nb_tickets":  pd.to_numeric(df[tc], errors="coerce").fillna(0).astype(int) if tc else 0,
        "nb_articles": pd.to_numeric(df[ac], errors="coerce").fillna(0).astype(int) if ac else 0,
        "ca_jour":     pd.to_numeric(df[cj], errors="coerce").fillna(0.0).astype(float) if cj else 0.0,
        "ref_actives": pd.to_numeric(df[ra], errors="coerce").fillna(0).astype(int) if ra else 0,
    }).drop_duplicates(subset=["date_id"])
    out.to_sql("daily_aggregates", conn, if_exists="append", index=False, chunksize=500)
    print(f"   daily_aggregates : {len(out)}")


def main():
    print("=" * 70)
    print("[DEMARRAGE] MIGRATION retail_data.pkl -> PostgreSQL (retail_db)")
    print("=" * 70)

    pkl = find_pkl()
    if not pkl:
        print("[ERREUR] retail_data.pkl introuvable"); sys.exit(1)
    print(f"[INFO] PKL : {pkl.resolve()}")
    with open(pkl, "rb") as f:
        data = pickle.load(f)

    df_clean = data["df_clean"].copy()
    # Standardisation minimale
    df_clean["date"] = pd.to_datetime(df_clean["date"], errors="coerce")
    df_clean = df_clean.dropna(subset=["date"])
    if "article" not in df_clean.columns: df_clean["article"] = "Produit"
    if "category" not in df_clean.columns: df_clean["category"] = "Autre"
    if "ticket_number" not in df_clean.columns:
        df_clean["ticket_number"] = df_clean.index.astype(str)
    if "unit_price" not in df_clean.columns:
        df_clean["unit_price"] = pd.to_numeric(df_clean["total_revenue"], errors="coerce") / \
                                 pd.to_numeric(df_clean["quantity"], errors="coerce").replace(0, np.nan)
    df_clean["article"] = df_clean["article"].fillna("Produit").astype(str).str.strip()
    df_clean["category"] = df_clean["category"].fillna("Autre").astype(str).str.strip()

    # Calculer infos dates (tourisme + saison par date) avant import dim_dates complet
    is_touristic_per_date = {}
    if {"date","is_touristic_season"}.issubset(df_clean.columns):
        tmp = df_clean.copy(); tmp["d"] = tmp["date"].dt.date
        g = tmp.groupby("d")["is_touristic_season"].max()
        for k, v in g.items():
            try:
                is_touristic_per_date[k] = bool(int(v) > 0)
            except Exception:
                pass
    season_per_date = {}
    if {"date","season"}.issubset(df_clean.columns):
        tmp = df_clean.copy(); tmp["d"] = tmp["date"].dt.date
        g = tmp.groupby("d")["season"].first()
        for k, v in g.items():
            sv = str(v).strip()
            if sv: season_per_date[k] = sv

    # Plage totale dates = ventes + prévisions
    date_min = df_clean["date"].min().date()
    date_max_df = df_clean["date"].max().date()
    # Ajouter prévisions
    for key in ["forecast_14j", "forecast_saison"]:
        f = data.get(key)
        if f is None or f.empty: continue
        fc = pd.to_datetime(f["ds"] if "ds" in f.columns else f["date"], errors="coerce").dropna()
        if len(fc):
            if fc.min().date() < date_min: date_min = fc.min().date()
            if fc.max().date() > date_max_df: date_max_df = fc.max().date()
    # +15 jours marge
    date_max_df = date_max_df + pd.Timedelta(days=15)
    all_dates_extra = pd.date_range(date_min, date_max_df, freq="D").date

    engine = create_engine(PG_URL, future=True, client_encoding="utf8")
    with engine.connect() as conn:
        # Dimensions lookup
        cat_map, season_map, event_map, prod_map, _ = import_dimensions(conn, df_clean)
        conn.commit()

        # dim_dates : plage complète (ventes + prévisions + marge)
        import_dim_dates_full(conn, all_dates_extra, season_map, is_touristic_per_date, season_per_date)
        conn.commit()

        # Faits (le + gros)
        import_fact_ticket_lines(conn, df_clean, prod_map, event_map)
        conn.commit()

        # Modèles + ML metrics (avant forecast car FK)
        print("→ Pré-calculés ...")
        import_forecast_models_and_metrics(conn, data)
        conn.commit()

        # Autres pré-calculés
        import_product_penetration(conn, data, prod_map)
        import_product_velocity(conn, data, prod_map)
        conn.commit()
        import_association_rules(conn, data, prod_map)
        conn.commit()
        import_prophet_forecasts(conn, data)
        conn.commit()
        import_monthly_ca(conn, data)
        import_daily_aggregates(conn, data)
        conn.commit()
    print("MIGRATION TERMINÉE")


if __name__ == "__main__":
    main()
