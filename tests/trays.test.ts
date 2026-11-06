// Tests de frontend/src/lib/trays.ts :  node --test tests/trays.test.ts   (Node 22.6 ou plus récent)
import test from "node:test";
import assert from "node:assert/strict";
import { planTrays, splitQty, traysToPieces, piecesToTrays } from "../frontend/src/lib/trays.ts";

const up = { pieces: 12, rounding: "up" as const, estimate: false };
const near = { pieces: 12, rounding: "nearest" as const, estimate: false };

test("up : toujours à la plaque entière, jamais en manque", () => {
  assert.deepEqual(planTrays(37, up), { trays: 4, planned: 48, surplus: 11 });
  assert.deepEqual(planTrays(36, up), { trays: 3, planned: 36, surplus: 0 });
  assert.deepEqual(planTrays(1, up), { trays: 1, planned: 12, surplus: 11 });
  assert.deepEqual(planTrays(12, up), { trays: 1, planned: 12, surplus: 0 });
  assert.deepEqual(planTrays(13, up), { trays: 2, planned: 24, surplus: 11 });
});

test("up : un reste flottant infime ne crée pas une plaque de plus", () => {
  assert.equal(planTrays(0.1 * 3 * 40, { pieces: 12, rounding: "up", estimate: false })?.trays, 1); // 12.000000000000002
  assert.equal(planTrays(0.07 * 300, { pieces: 21, rounding: "up", estimate: false })?.trays, 1); // 21.000000000000004
});

test("nearest : plaque la plus proche, au moins une si on doit en faire", () => {
  assert.deepEqual(planTrays(37, near), { trays: 3, planned: 36, surplus: -1 });
  assert.deepEqual(planTrays(42, near), { trays: 4, planned: 48, surplus: 6 });   // 3,5 -> 4
  assert.deepEqual(planTrays(3, near), { trays: 1, planned: 12, surplus: 9 });    // 0,25 -> au moins 1
});

test("pas de plaque : le produit reste en pièces", () => {
  assert.equal(planTrays(37, null), null);
  assert.equal(planTrays(37, undefined), null);
  assert.equal(planTrays(37, { pieces: 12, rounding: "none", estimate: false }), null);
  assert.equal(planTrays(37, { pieces: 0, rounding: "up", estimate: false }), null);
});

test("rien à préparer ou valeur invalide : pas de plan", () => {
  assert.equal(planTrays(0, up), null);
  assert.equal(planTrays(-5, up), null);
  assert.equal(planTrays(NaN, up), null);
  assert.equal(planTrays(Infinity, up), null);
});

test("splitQty : la somme reste exactement égale au total", () => {
  for (const total of [0, 1, 2, 3, 5, 7, 10, 37, 100]) {
    for (const shares of [[0.5, 0.3, 0.2], [1 / 3, 1 / 3, 1 / 3], [0.9, 0.05, 0.05], [0, 0, 1], [0.25, 0.25, 0.25, 0.25]]) {
      const out = splitQty(total, shares);
      assert.equal(out.reduce((a, b) => a + b, 0), total, `${total} ${shares}`);
      assert.ok(out.every((x) => Number.isInteger(x) && x >= 0));
    }
  }
  assert.deepEqual(splitQty(3, [1 / 3, 1 / 3, 1 / 3]), [1, 1, 1]);
  assert.deepEqual(splitQty(5, []), []);
});

test("splitQty : égalité de restes départagée de façon stable", () => {
  assert.deepEqual(splitQty(1, [0.5, 0.5]), [1, 0]);
  assert.deepEqual(splitQty(1, [0.5, 0.5]), splitQty(1, [0.5, 0.5]));
});

test("conversion de saisie", () => {
  assert.equal(traysToPieces(1.5, 12), 18);
  assert.equal(traysToPieces(0.5, 25), 13);       // 12,5 -> 13
  assert.equal(piecesToTrays(18, 12), 1.5);
  assert.equal(piecesToTrays(10, 12), 0.8333);
  assert.equal(traysToPieces(piecesToTrays(30, 12), 12), 30);
  for (const size of [7, 12, 24, 100, 333, 1000]) {          // aller-retour exact pour toute quantité plausible
    for (let p = 0; p <= 3 * size; p++) assert.equal(traysToPieces(piecesToTrays(p, size), size), p, `${p}/${size}`);
  }
});
