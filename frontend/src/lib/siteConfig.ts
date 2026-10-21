// Réglages propres à chaque boulangerie cliente : c'est le seul endroit à modifier lors d'une installation.
// Le nom du produit (BakeAgent) reste le même pour tous les clients.
export const siteConfig = {
  productName: "BakeAgent",
  bakeryName: "Ma Boulangerie",          // nom de la boulangerie cliente (affiché sous le nom du produit)
  // Logo de la boulangerie (facultatif) : déposer l'image dans frontend/public/ (ex. logo.png)
  // puis écrire "/logo.png" ici. Vide = logo BakeAgent (épi de blé).
  bakeryLogo: "",
  // Couleur de la boulangerie (facultatif) : un code couleur, ex. "#8B2E2E" (bordeaux) ou "#1F4E79" (bleu).
  // Change les boutons, le menu, la grande carte du jour et les titres en couleur. Vide = vert BakeAgent.
  // Choisir une couleur assez foncée : le texte des boutons est blanc. Les couleurs des graphiques ne changent pas.
  brandColor: "",
  // Motif en filigrane (le dessin léger en bas à droite et dans la grande carte du jour) :
  //   "wheat" = épi de blé (par défaut) · "none" = aucun motif
  //   ou le chemin d'une image déposée dans frontend/public/, ex. "/motif.svg" (de préférence un SVG ou un PNG
  //   à fond transparent : seule la forme est utilisée, elle prend la couleur du thème).
  motif: "wheat" as string,
  // Grain de papier sur le fond (true = oui, false = fond lisse).
  grain: true as boolean,
  bakeryLocation: "",
  appName: "Tableau de bord",
  appTagline: "Intelligence Retail & Aide à la Décision",
  dataPeriodLabel: "Données historiques 2024–2025",
  // Valeurs de secours seulement : l'en-tête et les filtres lisent la vraie période
  // dans le backend (/api/data-period) ; ces dates ne s'affichent que si le backend ne répond pas.
  dataStartLabel: "01/01/2024",
  dataEndLabel: "31/12/2025",
  // Adresse de l'assistant IA (interface « adk web » de l'agent). Bouton « Demander à l'assistant » de l'en-tête.
  agentUrl: "http://localhost:8080",
  dataSourceLabel: "POS · Système d'encaissement",
  contact: {
    address: "",
    phone: "",
  },
} as const;

export type SiteConfig = typeof siteConfig;

export function formatTodayDate(locale: string = "fr-FR"): string {
  const now = new Date();
  return now.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
