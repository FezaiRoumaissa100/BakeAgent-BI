// Couleurs du tableau de bord, regroupées en un seul endroit (thème « Pastel »).
// Les pages importent ces valeurs au lieu d'écrire elles-mêmes les codes couleur.
//
// Mode clair / sombre : les couleurs qui changent s'écrivent var(--dk-xxx, <couleur claire>).
// Les variables --dk-xxx sont définies dans app/globals.css, pour le mode clair (:root)
// et pour le mode sombre (html[data-theme="dark"]).
export const colors = {
  ink: "var(--dk-ink, #24213A)",              // texte principal
  accent: "var(--ch-1, #7357D9)",             // violet (marque, 1re série)
  accentLight: "var(--ch-soft, #C4B8F4)",     // même mesure, moins importante
  accentPale: "var(--dk-accent-pale, #E4DEFA)",
  accentDeep: "var(--dk-accent-deep, #43309E)",
  accentDeep2: "var(--ch-1, #7357D9)",
  amber: "var(--ch-2, #E0805E)",              // pêche
  brown: "var(--ch-4, #C9A227)",              // or
  muted: "var(--dk-muted, #5E5A78)",          // texte secondaire
  mutedDark: "var(--dk-ink2, #3A3655)",
  grid: "var(--dk-grid, rgba(43,39,71,0.08))",
  ok: "var(--dk-ok, #2E7D4F)",                // statut favorable
  warn: "var(--dk-warn, #B7791F)",            // vigilance
  alert: "var(--dk-alert, #C0392B)",          // risque
  beige: "var(--ch-ramp-3, #C4B8F4)",
  gold: "var(--ch-moss, #8E86C9)",
  amberLight: "var(--ch-soft, #C4B8F4)",
  green: "var(--ch-1, #7357D9)",
  blue: "var(--ch-3, #3E86D6)",
  paper: "var(--dk-soft, #F4F1FC)",
  paper2: "var(--dk-soft, #F4F1FC)",
  zoneTop: "var(--dk-accent-deep, #43309E)",  // zones des nuages de points
  zoneLeft: "var(--ch-2, #E0805E)",
  zoneRight: "var(--ch-3, #3E86D6)",
  zoneLow: "var(--dk-muted, #5E5A78)",
} as const;

// Palette des catégories (ordre fixe) : Violet, Pêche, Bleu, Or, Sarcelle, Autres,
// puis des nuances de lavande si une liste dépasse six couleurs.
export const categoryPalette = [
  "var(--ch-1, #7357D9)", "var(--ch-2, #E0805E)", "var(--ch-3, #3E86D6)", "var(--ch-4, #C9A227)", "var(--ch-5, #2E9C8A)",
  "var(--ch-other, #8A879C)", "var(--ch-ramp-6, #6E59CF)", "var(--ch-ramp-4, #A797EC)", "var(--ch-peak, #4B33B5)", "var(--ch-soft, #C4B8F4)",
];

// Échelle d'intensité (carte de chaleur), du plus clair au plus foncé
export const intensityRamp = [1, 2, 3, 4, 5, 6, 7].map((i) => `var(--ch-ramp-${i})`);
