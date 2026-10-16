// Couleurs du tableau de bord, regroupées en un seul endroit (thème « Sauge »).
// Les pages importent ces valeurs au lieu d'écrire elles-mêmes les codes couleur.
//
// Mode clair / sombre : les couleurs qui changent s'écrivent var(--dk-xxx, <couleur claire>).
// Les variables --dk-xxx sont définies dans app/globals.css, pour le mode clair (:root)
// et pour le mode sombre (html[data-theme="dark"]).
export const colors = {
  ink: "var(--dk-ink, #1E2420)",              // texte principal
  accent: "#2E7D4F",                          // vert sauge foncé (marque)
  accentLight: "#8DC05A",                     // vert tendre
  accentPale: "var(--dk-accent-pale, #DCEBD9)",
  accentDeep: "var(--dk-accent-deep, #256B42)",
  accentDeep2: "#3E8E5E",
  amber: "#D4A52A",                           // moutarde
  brown: "var(--dk-brown, #A0694A)",
  muted: "var(--dk-muted, #6E756F)",          // texte secondaire
  mutedDark: "var(--dk-ink2, #4A524C)",
  grid: "var(--dk-grid, #EBECE6)",
  ok: "var(--dk-ok, #2E7D4F)",                // statut favorable
  warn: "var(--dk-warn, #B7791F)",            // vigilance
  alert: "var(--dk-alert, #C0392B)",          // risque
  beige: "#B9C7B0",
  gold: "#6F9A64",
  amberLight: "#A9CC84",
  green: "#2E7D4F",
  blue: "#4A78A8",
  paper: "var(--dk-soft, #F5F6F1)",
  paper2: "var(--dk-soft, #F5F6F1)",
  zoneTop: "var(--dk-accent-deep, #256B42)",  // zones des nuages de points
  zoneLeft: "#D4A52A",
  zoneRight: "#4A78A8",
  zoneLow: "var(--dk-muted, #6E756F)",
} as const;

// Palette des catégories (familles de produits, séries multiples) : distinctes et douces
export const categoryPalette = [
  "#2E7D4F", "#A0694A", "#D4A52A", "#B5527A", "#6F9A64", "#E0A85C", "#4A78A8", "#7A5AA0", "#8DC05A", "#3F7F8C",
];
