// Plaques : conversion pièces <-> plaques, sans dépendance (testé par tests/trays.test.ts).
// Les ventes et les prévisions restent en pièces ; la plaque ne sert qu'à présenter ce qu'il faut produire.

export type Rounding = "up" | "nearest" | "none";
export type TrayInfo = { pieces: number; rounding: Rounding; estimate: boolean };

export type TrayPlan = {
  trays: number;     // nombre de plaques entières à préparer
  planned: number;   // pièces correspondantes (trays × taille)
  surplus: number;   // planned − demandé : > 0 = pièces en plus à cause de l'arrondi, < 0 = pièces en moins (arrondi « proche »)
};

/** Plan en plaques pour `pieces` pièces demandées. null = ce produit reste en pièces (pas de plaque, arrondi « none », rien à faire). */
export function planTrays(pieces: number, t: TrayInfo | null | undefined): TrayPlan | null {
  if (!t || t.rounding === "none" || !(t.pieces >= 1) || !Number.isFinite(pieces) || pieces <= 0) return null;
  const ratio = pieces / t.pieces;
  // 1e-9 : 12 pièces sur une plaque de 12 = 1 plaque, pas 2, même si la division laisse un reste infime
  const trays = t.rounding === "up" ? Math.ceil(ratio - 1e-9) : Math.max(1, Math.round(ratio));
  const planned = trays * t.pieces;
  return { trays, planned, surplus: planned - pieces };
}

/** Répartit une quantité entière entre des tranches selon leurs parts ; la somme reste exactement égale au total. */
export function splitQty(total: number, shares: number[]): number[] {
  if (!shares.length) return [];
  const raw = shares.map((s) => total * s);
  const out = raw.map(Math.floor);
  const left = total - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => ({ i, f: r - out[i] })).sort((a, b) => b.f - a.f || a.i - b.i).slice(0, Math.max(0, left)).forEach(({ i }) => { out[i] += 1; });
  return out;
}

/** Saisie en plaques -> pièces (arrondi à la pièce : une demi-plaque de 12 = 6). */
export function traysToPieces(trays: number, size: number): number {
  return Math.round(trays * size);
}

/** Pièces -> plaques pour l'affichage d'une saisie (18 pièces sur 12 = 1,5). Quatre décimales : l'aller-retour redonne
 *  toujours la même pièce, même pour une plaque de 1000 pièces. */
export function piecesToTrays(pieces: number, size: number): number {
  return Math.round((pieces / size) * 10000) / 10000;
}
