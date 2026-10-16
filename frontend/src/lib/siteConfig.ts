export const siteConfig = {
  bakeryName: "Boulangerie Le Croisic",
  bakeryLocation: "Le Croisic, France",
  appName: "Tableau de Bord BI",
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
    address: "Place du Marché, 44490 Le Croisic",
    phone: "02 40 82 XX XX",
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
