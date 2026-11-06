r"""
Rafraîchit les prévisions du tableau de bord après de nouvelles ventes :
  1. sauvegarde des tables de prévision (fichiers CSV, dossier ignoré par Git) ;
  2. calcul normal à 14 jours (c'est lui qui sert aux vues 7 et 14 jours) ;
  3. calcul à 30 jours (il prolonge la vue 30 jours : jours 15 à 30).
Chaque calcul AJOUTE un nouveau lot de résultats dans la base ; rien n'est supprimé. Le tableau de bord lit toujours
le dernier lot de chaque type.

Utilisation (dans le dossier du projet) :
    python forecasting\refresh_forecasts.py              # sauvegarde + les deux calculs, enregistrés dans la base
    python forecasting\refresh_forecasts.py --csv        # ESSAI : n'écrit rien dans la base (résultats dans un dossier temporaire)
    python forecasting\refresh_forecasts.py --no-backup  # sans sauvegarde
    python forecasting\refresh_forecasts.py --backup-only

Aucun planificateur n'est nécessaire : BD/001_import_from_pkl.py lance ce script à la fin d'un import réussi
(option --no-refresh pour l'éviter). Un verrou empêche deux rafraîchissements en même temps.
Code de sortie : 0 = tout est bon ; 1 = un calcul a échoué ; 3 = un rafraîchissement est déjà en cours.
"""
import os
import sys
import shutil
import subprocess
import tempfile
import time
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
DATA = os.path.join(HERE, "data")            # dossier ignoré par Git
PIPE = os.path.join(HERE, "pipeline.py")
LOCK = os.path.join(DATA, "refresh.lock")
LOCK_MAX_MIN = 90                            # un verrou plus vieux est considéré comme abandonné
LONG_H = 30
TABLES = ["product_forecast_runs", "product_forecast_models", "product_forecasts", "forecast_data_checks",
          "shop_forecasts", "prophet_forecasts", "forecast_models", "ml_metrics", "daily_production"]

TS = datetime.now().strftime("%Y%m%d_%H%M%S")
os.makedirs(DATA, exist_ok=True)
LOG_PATH = os.path.join(DATA, f"refresh_{TS}.log")
_log = open(LOG_PATH, "a", encoding="utf-8", buffering=1)


def log(msg):
    line = f"[{datetime.now():%H:%M:%S}] {msg}"
    print(line, flush=True)
    _log.write(line + "\n")


def acquire_lock():
    if os.path.exists(LOCK):
        age_min = (time.time() - os.path.getmtime(LOCK)) / 60
        if age_min < LOCK_MAX_MIN:
            log(f"Un rafraîchissement est déjà en cours (verrou vieux de {age_min:.0f} min) : rien n'est lancé.")
            sys.exit(3)
        log(f"Verrou abandonné ({age_min:.0f} min) : supprimé.")
        os.remove(LOCK)
    fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.write(fd, f"{os.getpid()} {datetime.now().isoformat()}".encode())
    os.close(fd)


def release_lock():
    try:
        os.remove(LOCK)
    except OSError:
        pass


def backup():
    """Copie les tables de prévision dans forecasting/data/backup_before_refresh_<date>/ (lecture seule sur la base)."""
    sys.path.insert(0, os.path.join(ROOT, "backend"))
    import pandas as pd
    from db.db import sql_fetch_all
    out = os.path.join(DATA, f"backup_before_refresh_{TS}")
    os.makedirs(out, exist_ok=True)
    for t in TABLES:
        if not sql_fetch_all("SELECT to_regclass(%s) AS r", (f"public.{t}",))[0]["r"]:
            log(f"  sauvegarde : {t:<26} (table absente)")
            continue
        df = pd.DataFrame(sql_fetch_all(f"SELECT * FROM {t}"))
        df.to_csv(os.path.join(out, t + ".csv"), index=False, encoding="utf-8")
        log(f"  sauvegarde : {t:<26} {len(df):>7} lignes")
    log(f"Sauvegarde dans : {out}")


def run_pipeline(horizon, csv_dir=None):
    """Lance pipeline.py avec l'horizon voulu. csv_dir : mode essai (aucune écriture dans la base)."""
    env = dict(os.environ, PYTHONUTF8="1")
    env.pop("FORECAST_HORIZON", None)
    cmd = [sys.executable, PIPE]
    if horizon != 14:
        env["FORECAST_HORIZON"] = str(horizon)
    if csv_dir:
        env["FORECAST_DATA"] = csv_dir
        cmd.append("--csv")
    out_path = os.path.join(DATA, f"refresh_{TS}_h{horizon}.out.txt")
    t0 = time.time()
    log(f"Calcul à {horizon} jours{' (essai, sans la base)' if csv_dir else ''}…")
    with open(out_path, "w", encoding="utf-8") as f:
        r = subprocess.run(cmd, env=env, cwd=ROOT, stdout=f, stderr=subprocess.STDOUT)
    log(f"Calcul à {horizon} jours : {'terminé' if r.returncode == 0 else 'ÉCHEC (code %d)' % r.returncode} en {time.time() - t0:.0f} s (détail : {out_path})")
    return r.returncode == 0


def summary_from_db():
    sys.path.insert(0, os.path.join(ROOT, "backend"))
    from db.db import sql_fetch_all
    runs = sql_fetch_all("SELECT run_id, horizon, data_end, run_at FROM product_forecast_runs ORDER BY run_id DESC LIMIT 2")
    for r in runs:
        n = sql_fetch_all("SELECT COUNT(*) AS n FROM shop_forecasts WHERE run_id = %s AND kind = 'court'", (r["run_id"],))[0]["n"]
        log(f"  lot n° {r['run_id']} : {r['horizon']} jours, données jusqu'au {r['data_end']}, {n} jours prévus pour la boutique")
    if len(runs) == 2 and runs[0]["data_end"] != runs[1]["data_end"]:
        log("ATTENTION : les deux lots ne portent pas sur les mêmes données ; la vue 30 jours restera indisponible.")


def main():
    args = set(sys.argv[1:])
    dry = "--csv" in args
    acquire_lock()
    t0 = time.time()
    try:
        if "--backup-only" in args:
            backup()
            return 0
        if not dry and "--no-backup" not in args:
            log("Sauvegarde des tables de prévision…")
            backup()
        csv_dirs = {14: None, LONG_H: None}
        if dry:
            log("Mode essai : export des données (lecture seule sur la base)…")
            subprocess.run([sys.executable, os.path.join(HERE, "export_data.py")], cwd=ROOT, check=True,
                           stdout=_log, stderr=subprocess.STDOUT, env=dict(os.environ, PYTHONUTF8="1"))
            for h in csv_dirs:
                d = tempfile.mkdtemp(prefix=f"refresh_h{h}_")
                for f in ("sales.csv", "products.csv", "calendar.csv"):
                    shutil.copy(os.path.join(DATA, f), os.path.join(d, f))
                csv_dirs[h] = d
        if not run_pipeline(14, csv_dirs[14]):
            log("Le calcul à 14 jours a échoué : le calcul à 30 jours n'est pas lancé. Les anciennes prévisions restent en place.")
            return 1
        ok30 = run_pipeline(LONG_H, csv_dirs[LONG_H])
        if not ok30:
            log("Le calcul à 30 jours a échoué : la vue 30 jours reste indisponible jusqu'au prochain succès ; les vues 7 et 14 jours sont à jour.")
        if not dry:
            summary_from_db()
        else:
            log("Essai terminé : rien n'a été écrit dans la base. Résultats : " + ", ".join(d for d in csv_dirs.values() if d))
        log(f"Rafraîchissement {'terminé' if ok30 else 'incomplet'} en {time.time() - t0:.0f} s. Journal : {LOG_PATH}")
        return 0 if ok30 else 1
    finally:
        release_lock()


if __name__ == "__main__":
    sys.exit(main())
