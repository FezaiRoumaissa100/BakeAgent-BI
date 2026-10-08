// Langue du tableau de bord : français (par défaut) ou anglais.
//
// Comment traduire un texte dans une page :
//   tr("Chiffre d'affaires", "Revenue")      → le texte français, puis l'anglais
//   trData(valeur)                            → traduit une valeur envoyée par le backend
//                                               (catégorie, jour, mois, statut…) pour l'affichage
//   num(1234.5, 1) / locale()                 → nombres et dates au format de la langue
//
// Le backend et l'agent IA continuent de travailler en français : on ne traduit que l'affichage.
// Les valeurs renvoyées au backend (filtres, sélections) restent celles du backend, en français.
//
// Le choix est mémorisé dans le navigateur. Quand on change de langue,
// le contenu de la page est ré-affiché (voir components/LangProvider.tsx).

export type Lang = "fr" | "en";

export const LANG_STORAGE_KEY = "dashboard-lang";

let current: Lang = "fr";

export function getLang(): Lang {
  return current;
}

export function setCurrentLang(lang: Lang) {
  current = lang;
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

export function readStoredLang(): Lang {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {}
}

/** Texte affiché : français, puis anglais. */
export function tr(fr: string, en: string): string {
  return current === "en" ? en : fr;
}

/** Format régional des nombres et des dates. */
export function locale(): string {
  return current === "en" ? "en-GB" : "fr-FR";
}

/** Nombre formaté selon la langue (1 234,5 en français, 1,234.5 en anglais). */
export function num(n: number, dec = 0): string {
  return Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Valeurs envoyées par le backend, traduites pour l'affichage uniquement.
// Pour ajouter une valeur : "valeur exacte du backend": "English".
const DATA_EN: Record<string, string> = {
  // Choix « tous »
  "Toutes": "All", "Tous": "All", "Tout": "All",
  // Catégories de produits
  "Pains & Baguettes": "Breads & Baguettes",
  "Viennoiseries": "Viennoiseries",
  "Patisseries": "Pastries",
  "Pâtisseries": "Pastries",
  "Produits Festifs": "Festive Products",
  "Traiteur & Sale": "Deli & Savoury",
  "Traiteur & Salé": "Deli & Savoury",
  "Boissons": "Drinks",
  "Confiserie & Chocolat": "Confectionery & Chocolate",
  // Jours
  "Lundi": "Monday", "Mardi": "Tuesday", "Mercredi": "Wednesday", "Jeudi": "Thursday",
  "Vendredi": "Friday", "Samedi": "Saturday", "Dimanche": "Sunday",
  // Mois
  "Janvier": "January", "Février": "February", "Mars": "March", "Avril": "April", "Mai": "May",
  "Juin": "June", "Juillet": "July", "Août": "August", "Septembre": "September",
  "Octobre": "October", "Novembre": "November", "Décembre": "December",
  "Jan": "Jan", "Fév": "Feb", "Mar": "Mar", "Avr": "Apr", "Jun": "Jun", "Jul": "Jul", "Aoû": "Aug",
  "Sep": "Sep", "Oct": "Oct", "Nov": "Nov", "Déc": "Dec",
  // Saisons
  "Hiver": "Winter", "Printemps": "Spring", "Ete": "Summer", "Été": "Summer", "Automne": "Autumn",
  // Événements
  "Noel": "Christmas", "Noël": "Christmas", "Reveillon": "New Year's Eve", "Réveillon": "New Year's Eve",
  "Jour de l'An": "New Year's Day", "Galette des Rois": "Epiphany (Galette des Rois)",
  "Saint-Valentin": "Valentine's Day", "Paques": "Easter", "Pâques": "Easter",
  "Fete des Meres": "Mother's Day", "Fête des Mères": "Mother's Day",
  "Fete de la Musique": "Music Day", "Fête de la Musique": "Music Day", "Toussaint": "All Saints' Day",
  // Statuts des produits (présence dans les tickets)
  "Produit Phare (Dominant)": "Flagship product (Dominant)",
  "Leader (Indispensable)": "Leader (Essential)",
  "Produit Coeur (Core)": "Core product",
  "Produit Regulier": "Regular product",
  "Niche / A surveiller": "Niche / To watch",
  "Produit Phare": "Flagship product", "Leader": "Leader", "Produit Coeur": "Core product",
  "Niche / A surv": "Niche / To watch",
  // Rôle dans le panier et régularité
  "Ancre": "Anchor", "Moteur": "Driver", "Complémentaire": "Complementary", "Micro": "Minor",
  "Cyclique": "Cyclical", "Sporadique": "Sporadic", "Quotidien": "Daily", "Hebdomadaire": "Weekly",
  // Force des associations
  "Forte": "Strong", "Tres forte": "Very strong", "Très forte": "Very strong", "Moyenne": "Medium", "Faible": "Weak",
  // Statuts des alertes
  "RUPTURE": "STOCK-OUT", "VIGILANCE": "WATCH", "NORMAL": "NORMAL", "SURSTOCK": "OVERSTOCK",
  "FERMÉ": "CLOSED", "FERME": "CLOSED",
  // Divers
  "unités": "units", "Articles": "Items", "Actif": "Active", "Chiffre d'Affaires": "Revenue",
};

/** Traduit une valeur du backend pour l'affichage (renvoie la valeur telle quelle si inconnue). */
export function trData(v: string | null | undefined): string {
  if (v == null) return "";
  if (current !== "en") return String(v);
  return DATA_EN[String(v)] ?? String(v);
}
