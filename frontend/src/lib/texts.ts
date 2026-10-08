// Textes communs à plusieurs écrans (en-tête, boutons…), en français et en anglais.
// Les textes propres à une page sont écrits directement dans la page avec tr("français", "English")
// (voir lib/i18n.ts).
import { getLang } from "./i18n";

export const texts = {
  fr: {
    header: {
      dataLabel: "Données",
      from: "du",
      to: "au",
    },
    forecast: {
      reliability: "Fiabilité de la prévision",
      reliabilitySub: "Écart médian entre prévu et réel",
    },
    theme: {
      toDark: "Passer en mode sombre",
      toLight: "Passer en mode clair",
    },
    associations: {
      strength: "Force du lien",
      probability: "Probabilité d'achat",
      pairFrequency: "Fréquence de la paire",
    },
  },
  en: {
    header: {
      dataLabel: "Data",
      from: "from",
      to: "to",
    },
    forecast: {
      reliability: "Forecast reliability",
      reliabilitySub: "Median gap between forecast and actual",
    },
    theme: {
      toDark: "Switch to dark mode",
      toLight: "Switch to light mode",
    },
    associations: {
      strength: "Link strength",
      probability: "Purchase probability",
      pairFrequency: "Pair frequency",
    },
  },
};

type Texts = typeof texts.fr;

// `t` renvoie toujours les textes de la langue active (t.header.dataLabel, etc.).
export const t: Texts = new Proxy({} as Texts, {
  get: (_target, key: string) => (texts[getLang()] as Record<string, unknown>)[key],
});
