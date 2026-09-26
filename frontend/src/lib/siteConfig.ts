export const siteConfig = {
  bakeryName: "Boulangerie Le Croisic",
  bakeryLocation: "Le Croisic, France",
  appName: "Tableau de Bord BI",
  appTagline: "Intelligence Retail & Aide à la Décision",
  dataPeriodLabel: "Données historiques 2024–2025",
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
