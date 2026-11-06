// Échelles « rondes » pour les axes des graphiques (0 · 20 k€ · 40 k€… plutôt que 0 · 26 k€ · 53 k€…).
// Sans dépendance : testé par tests/chartScale.test.ts.

export type Scale = { max: number; step: number; ticks: number[] };

/** Échelle qui commence à 0, avec environ `target` intervalles de pas 1, 2, 2,5 ou 5 × 10^n, et un maximum juste
 *  au-dessus de `maxValue` (jamais en dessous : aucune barre ne dépasse le cadre). */
export function niceScale(maxValue: number, target = 4): Scale {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return { max: 1, step: 1, ticks: [0, 1] };
  const raw = maxValue / Math.max(1, target);
  const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((s) => s >= raw - 1e-12) as number;
  const n = Math.ceil(maxValue / step - 1e-9);
  const ticks = Array.from({ length: n + 1 }, (_, i) => Number((i * step).toPrecision(12)));
  return { max: ticks[ticks.length - 1], step, ticks };
}

function trimNum(v: number, dec: number, locale: string): string {
  return v.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: dec });
}

/** Étiquette d'axe en euros : 0 € · 500 € · 2,5 k€ · 40 k€ · 1,2 M€ (espace avant l'unité, une décimale au plus). */
export function fmtAxisEuro(v: number, locale = "fr-FR"): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${trimNum(v / 1e6, 1, locale)} M€`;
  if (a >= 1e3) return `${trimNum(v / 1e3, 1, locale)} k€`;
  return `${trimNum(v, 0, locale)} €`;
}

/** Étiquette d'axe sans unité : 0 · 500 · 2,5 k · 40 k. */
export function fmtAxisNum(v: number, locale = "fr-FR"): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${trimNum(v / 1e6, 1, locale)} M`;
  if (a >= 1e4) return `${trimNum(v / 1e3, 1, locale)} k`;
  return trimNum(v, a < 10 && v % 1 !== 0 ? 1 : 0, locale);
}

/** Plafond d'axe robuste : si une seule valeur écrase toutes les autres (ex. le 31 décembre), l'axe s'arrête au niveau
 *  des autres et cette valeur est signalée comme « hors échelle ». Renvoie la valeur à utiliser pour l'échelle. */
export function robustCap(values: number[], ratio = 1.6): { cap: number; clipped: boolean } {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length < 4) return { cap: v[v.length - 1] || 1, clipped: false };
  const top = v[v.length - 1], second = v[v.length - 2];
  return top > second * ratio ? { cap: second, clipped: true } : { cap: top, clipped: false };
}
