"""
BD/run_import.py
=================
Lance l'import de données choisi par le réglage DATA_SOURCE (variable d'environnement) ou --source.

    python BD/run_import.py                       # DATA_SOURCE absent => pkl (comportement actuel)
    python BD/run_import.py --source api          # ventes depuis l'API du fournisseur
    set DATA_SOURCE=api  puis  python BD/run_import.py

Les options qui suivent sont transmises au script choisi, par ex. :
    python BD/run_import.py --source api --since 2026-01-01 --dry-run
    python BD/run_import.py --source pkl --no-refresh

Le tableau de bord ne dépend pas de ce choix : il lit toujours PostgreSQL.
"""

import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = {"pkl": "001_import_from_pkl.py", "api": "002_import_from_api.py"}


def main(argv):
    args = list(argv)
    source = os.environ.get("DATA_SOURCE", "pkl").strip().lower() or "pkl"
    if "--source" in args:
        i = args.index("--source")
        if i + 1 >= len(args):
            raise SystemExit("[ERREUR] --source attend une valeur : pkl ou api")
        source = args[i + 1].strip().lower()
        del args[i:i + 2]
    if source not in SCRIPTS:
        raise SystemExit(f"[ERREUR] Source inconnue '{source}' (DATA_SOURCE / --source : pkl ou api)")
    print(f"[INFO] Source de données : {source}  ->  {SCRIPTS[source]}")
    return subprocess.run([sys.executable, str(HERE / SCRIPTS[source]), *args]).returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
