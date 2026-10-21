// Couleurs du tableau de bord, regroupées en un seul endroit (thème « Sauge »).
// Les pages importent ces valeurs au lieu d'écrire elles-mêmes les codes couleur.
//
// Mode clair / sombre : les couleurs qui changent s'écrivent var(--dk-xxx, <couleur claire>).
// Les variables --dk-xxx sont définies dans app/globals.css, pour le mode clair (:root)
// et pour le mode sombre (html[data-theme="dark"]).
export const colors = {
  ink: "var(--dk-ink, #1E2A22)",              // texte principal
  accent: "var(--ch-1, #2E7D4F)",             // vert (marque, 1re série)
  accentLight: "var(--ch-soft, #8EB08A)",     // même mesure, moins importante
  accentPale: "var(--dk-accent-pale, #D6E1D3)",
  accentDeep: "var(--dk-accent-deep, #1F5E3A)",
  accentDeep2: "var(--ch-1, #2E7D4F)",
  amber: "var(--ch-2, #B8860B)",              // blé doré
  brown: "var(--ch-4, #C2552F)",              // croûte
  muted: "var(--dk-muted, #5B6B5F)",          // texte secondaire
  mutedDark: "var(--dk-ink2, #3F4F44)",
  grid: "var(--dk-grid, rgba(52,76,61,0.11))",
  ok: "var(--dk-ok, #2E7D4F)",                // statut favorable
  warn: "var(--dk-warn, #B7791F)",            // vigilance
  alert: "var(--dk-alert, #C0392B)",          // risque
  beige: "var(--ch-ramp-3, #A3BA9F)",
  gold: "var(--ch-moss, #738A6E)",
  amberLight: "var(--ch-soft, #8EB08A)",
  green: "var(--ch-1, #2E7D4F)",
  blue: "var(--ch-3, #3A6FB8)",
  paper: "var(--dk-soft, #E5ECE2)",
  paper2: "var(--dk-soft, #E5ECE2)",
  zoneTop: "var(--dk-accent-deep, #1F5E3A)",  // zones des nuages de points
  zoneLeft: "var(--ch-2, #B8860B)",
  zoneRight: "var(--ch-3, #3A6FB8)",
  zoneLow: "var(--dk-muted, #5B6B5F)",
} as const;

// Palette des catégories (ordre fixe) : Vert, Blé doré, Bleu, Croûte, Prune, Autres,
// puis des nuances de sauge si une liste dépasse six couleurs.
export const categoryPalette = [
  "var(--ch-1, #2E7D4F)", "var(--ch-2, #B8860B)", "var(--ch-3, #3A6FB8)", "var(--ch-4, #C2552F)", "var(--ch-5, #8E4C9A)",
  "var(--ch-other, #8A938B)", "var(--ch-ramp-6, #4F6A55)", "var(--ch-ramp-4, #8EA58C)", "var(--ch-peak, #1F5E3A)", "var(--ch-soft, #8EB08A)",
];

// Échelle d'intensité (carte de chaleur), du plus clair au plus foncé
export const intensityRamp = [1, 2, 3, 4, 5, 6, 7].map((i) => `var(--ch-ramp-${i})`);
