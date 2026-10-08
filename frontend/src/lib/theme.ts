// Couleurs du tableau de bord, regroupées en un seul endroit.
// Les pages importent ces valeurs au lieu d'écrire elles-mêmes les codes couleur.
//
// Mode clair / sombre : chaque couleur qui doit changer en mode sombre s'écrit
// var(--dk-xxx, <couleur claire>). En mode clair, la variable --dk-xxx n'existe pas,
// donc le navigateur prend la couleur claire, exactement comme avant.
// En mode sombre, --dk-xxx est définie dans app/globals.css (thème « Fournil »).
// Les oranges et couleurs de graphique restent identiques dans les deux modes.
// Étape suivante possible : d'autres thèmes (Praline, Sauge, Ardoise) = un autre jeu de --dk-xxx.
export const colors = {
  ink: "var(--dk-ink, #1C1410)",          // texte principal
  accent: "#E8734A",                      // orange de la marque
  accentLight: "#F0A882",
  accentPale: "var(--dk-accent-pale, #FAD4C4)", // pêche pâle (plus sourd en mode sombre)
  accentDeep: "var(--dk-accent-deep, #C2410C)", // orange foncé (plus clair en mode sombre)
  accentDeep2: "#EA580C",
  amber: "#D97706",
  brown: "var(--dk-brown, #92400E)",
  muted: "var(--dk-muted, #9a8070)",      // texte secondaire
  mutedDark: "var(--dk-ink2, #57534E)",
  grid: "var(--dk-grid, rgba(200,140,100,0.13))",
  ok: "var(--dk-ok, #15803D)",            // statut favorable
  warn: "var(--dk-warn, #B45309)",        // vigilance
  alert: "var(--dk-alert, #991B1B)",      // risque
  beige: "#C4A882",
  gold: "#C8860A",
  amberLight: "#E6A817",
  green: "#27AE60",
  blue: "#3498DB",
  paper: "var(--dk-soft, #FDF6EC)",       // fond crème des cartes
  paper2: "var(--dk-soft, #FBF2E7)",
  zoneTop: "var(--dk-red, #DC2626)",      // zones des nuages de points
  zoneLeft: "var(--dk-warn, #B45309)",
  zoneRight: "var(--dk-green-dark, #166534)",
  zoneLow: "var(--dk-ink2, #57534E)",
} as const;
