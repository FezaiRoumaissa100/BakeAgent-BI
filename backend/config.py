"""
Seuils métier du tableau de bord, regroupés ici pour être modifiés en un seul endroit.

Les valeurs par défaut sont celles du cahier des charges (« Retail Intelligence System »).
Tout changement de seuil doit être validé par écrit par le superviseur (revue, section 9.2).
"""

# ── Pénétration (cahier des charges, composante 1) ──────────────────────────
# Taux de pénétration (%) = tickets contenant le produit / tickets uniques x 100
PENETRATION_STATUTS = [
    (50.0, "Leader (Indispensable)"),
    (30.0, "Produit Cœur (Core)"),
    (10.0, "Produit Régulier"),
    (0.0, "Niche / À surveiller"),
]

# ── Vitesse opérationnelle (cahier des charges, composante 2) ───────────────
# Alerte de remplissage si l'heure de pointe dépasse 40 % des ventes du jour du produit
PIC_HORAIRE_SEUIL_PCT = 40.0

# ── Contribution au ticket (cahier des charges, composante 3) ───────────────
# « Générateurs de chiffre » vs « Accessoires »
CONTRIBUTION_GENERATEUR_SEUIL_PCT = 50.0

# ── Fréquence (cahier des charges, composante 4) ────────────────────────────
FREQUENCE_STATUTS = [
    (100.0, "Quotidien"),
    (75.0, "Regulier"),
    (50.0, "Cyclique"),
    (0.0, "Sporadique"),
]

# ── Risque de manque (alertes) ──────────────────────────────────────────────
# Le stock réel n'est pas connu : la référence est le « jour type » de la période,
# médiane de la prévision du même jour de la semaine, le même mois.
# Ratio = demande prévue / jour type.
RISQUE_SEUIL_ELEVE = 1.20      # >= 120 % d'un jour type  -> RUPTURE (risque de manque)
RISQUE_SEUIL_VIGILANCE = 1.10  # >= 110 %                 -> VIGILANCE (à surveiller)
RISQUE_SEUIL_FAIBLE = 0.80     # < 80 %                   -> SURSTOCK (risque d'invendus)

# ── Plan par tranche horaire (liste « À préparer ») ─────────────────────────
# Frontières des tranches, en heures : avant 10 h · de 10 h à 13 h · à partir de 13 h.
# La part de chaque tranche est mesurée sur l'historique du produit, aux mêmes jours de la semaine.
CRENEAUX_HORAIRES = [10, 13]
CRENEAUX_JOURS_OUVERTS = 8     # nombre de mêmes jours de la semaine (boutique ouverte) utilisés pour mesurer les parts
CRENEAUX_POIDS_BOUTIQUE = 30   # produit vendu moins que ça sur la période : il emprunte en partie le profil de la boutique


# ── Ce qui ne se prépare pas (liste « À préparer », grille de risque, saisie du stock, tailles de plaque) ──
# Propre à chaque client : les listes sont dans client_settings.json (racine du projet), pas dans le code.
# Ces articles restent dans les ventes, les prévisions de demande et les statistiques ; ils sont seulement retirés des
# écrans de PRODUCTION, où un boulanger n'a rien à fabriquer (une boisson, une sucette, un service de découpe du pain...).
import json as _json
import os as _os
import unicodedata as _ud
from pathlib import Path as _Path


def _norm(s) -> str:
    """Comparaison sans majuscules ni accents."""
    return _ud.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode("ascii").strip().casefold()


def _client_settings() -> dict:
    path = _Path(_os.environ.get("CLIENT_SETTINGS") or _Path(__file__).resolve().parent.parent / "client_settings.json")
    if not path.exists():
        return {}                       # fichier absent : rien n'est exclu
    try:
        return _json.loads(path.read_text(encoding="utf-8"))
    except ValueError as e:
        raise RuntimeError(f"{path} n'est pas un JSON valide : {e}")


_CLIENT = _client_settings()
# Articles de caisse qui ne sont pas des produits (service, sac, consigne...) : hors de toutes les analyses produit
NON_PRODUCT_ARTICLES = [str(x) for x in (_CLIENT.get("non_product_articles") or [])]
_NON_PRODUCT = {_norm(x) for x in NON_PRODUCT_ARTICLES}
PRODUCTION_EXCLUDED_CATEGORIES = [str(x) for x in (_CLIENT.get("production_excluded_categories") or [])]
PRODUCTION_EXCLUDED_ARTICLES = [str(x) for x in (_CLIENT.get("production_excluded_articles") or [])]
_EXCL_CATS = {_norm(x) for x in PRODUCTION_EXCLUDED_CATEGORIES}
_EXCL_ARTS = {_norm(x) for x in PRODUCTION_EXCLUDED_ARTICLES} | _NON_PRODUCT


def is_product(article: str) -> bool:
    """Faux pour un article de caisse qui n'est pas un produit (client_settings.json > non_product_articles)."""
    return _norm(article) not in _NON_PRODUCT


def non_product_ids() -> list:
    """Identifiants des articles qui ne sont pas des produits (lus à chaque appel : les produits changent après un import)."""
    if not _NON_PRODUCT:
        return []
    from db.db import sql_fetch_all
    return sorted(int(r["product_id"]) for r in sql_fetch_all("SELECT product_id, article_name FROM dim_products")
                  if _norm(r["article_name"]) in _NON_PRODUCT)


def np_sql(prefix: str = "f.") -> str:
    """Condition SQL « AND <prefix>product_id n'est pas un non-produit » ('' s'il n'y en a pas). Les identifiants sont des
    entiers lus en base : pas d'injection possible."""
    ids = non_product_ids()
    return f" AND {prefix}product_id <> ALL(ARRAY[{','.join(str(i) for i in ids)}]::int[])" if ids else ""


def is_produced(article: str, category: str) -> bool:
    """Faux pour les articles qu'on ne fabrique pas (client_settings.json > production_excluded_*)."""
    return _norm(category) not in _EXCL_CATS and _norm(article) not in _EXCL_ARTS


def statut_penetration(rate: float) -> str:
    for seuil, label in PENETRATION_STATUTS:
        if rate >= seuil:
            return label
    return PENETRATION_STATUTS[-1][1]


def statut_frequence(pct: float) -> str:
    for seuil, label in FREQUENCE_STATUTS:
        if pct >= seuil:
            return label
    return FREQUENCE_STATUTS[-1][1]


# ── Quantité conseillée à préparer (anti-gaspillage) ────────────────────────
# Avant : on conseillait la borne haute de la prévision (90 %), donc des invendus presque tous les jours.
# Maintenant : on met en balance ce que coûte un invendu et ce que coûte une vente manquée.
#   - un invendu fait perdre le coût de revient de l'article (matières, énergie) ;
#   - une vente manquée fait perdre la marge (prix − coût de revient).
# Le bon niveau de couverture vaut alors : 1 − (coût de revient / prix de vente).
# Exemple : coût = 35 % du prix -> on prépare assez pour couvrir la demande 65 jours sur 100.
PART_COUT_DEFAUT = 0.35            # coût de revient / prix de vente, pour tous les produits
PART_COUT_PAR_CATEGORIE = {}       # ex. {"Viennoiserie": 0.30, "Pâtisserie": 0.40} (noms des familles de la boutique)
CATEGORIES_LONGUE_CONSERVATION = []  # familles qui ne se perdent pas le soir (ex. boissons) : couverture haute
PRODUITS_A_NE_PAS_MANQUER = []     # articles d'appel à ne jamais manquer (ex. "TRADITIONAL BAGUETTE") : couverture haute
NIVEAU_MIN = 0.50                  # jamais moins que la prévision centrale
NIVEAU_MAX = 0.90                  # jamais plus que la borne haute de la prévision

# Apprentissage à partir de la page « Saisie du stock » (préparé / restant le soir), 4 dernières semaines saisies :
APPRENTISSAGE_JOURS = 28           # fenêtre regardée
APPRENTISSAGE_MIN_JOURS = 8        # nombre minimum de jours saisis pour corriger un produit
APPRENTISSAGE_PAS = 0.10           # correction du niveau de couverture à chaque fois
APPRENTISSAGE_TOLERANCE = 0.15     # écart toléré entre jours épuisés observés et attendus
APPRENTISSAGE_RESTES_MIN = 0.10    # on ne baisse que si les restes dépassent 10 % de la production
