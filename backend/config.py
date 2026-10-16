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
