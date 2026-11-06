// Tests de frontend/src/lib/chartScale.ts :  node --test tests/chartScale.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { niceScale, fmtAxisEuro, fmtAxisNum, robustCap } from "../frontend/src/lib/chartScale.ts";

test("niceScale : pas ronds, départ à 0, maximum au-dessus des données", () => {
  assert.deepEqual(niceScale(89241), { max: 100000, step: 25000, ticks: [0, 25000, 50000, 75000, 100000] });
  assert.deepEqual(niceScale(1594).ticks, [0, 500, 1000, 1500, 2000]);
  assert.deepEqual(niceScale(162000).ticks, [0, 50000, 100000, 150000, 200000]);
  assert.deepEqual(niceScale(100).ticks, [0, 25, 50, 75, 100]);
  assert.deepEqual(niceScale(7).ticks, [0, 2, 4, 6, 8]);
  for (const m of [0.3, 3, 17, 95, 101, 999, 1234, 98765, 3.2e6]) {
    const s = niceScale(m);
    assert.ok(s.max >= m, `${m}`);
    assert.equal(s.ticks[0], 0);
    assert.ok(s.ticks.length >= 3 && s.ticks.length <= 7, `${m} -> ${s.ticks}`);
    const mant = s.step / Math.pow(10, Math.floor(Math.log10(s.step)));
    assert.ok([1, 2, 2.5, 5].some((x) => Math.abs(x - mant) < 1e-9), `${m} step ${s.step}`);
  }
});

test("niceScale : valeurs vides ou nulles", () => {
  assert.deepEqual(niceScale(0), { max: 1, step: 1, ticks: [0, 1] });
  assert.deepEqual(niceScale(NaN), { max: 1, step: 1, ticks: [0, 1] });
});

test("étiquettes", () => {
  const sp = (s: string) => s.replace(/ | /g, " ");
  assert.equal(sp(fmtAxisEuro(0)), "0 €");
  assert.equal(sp(fmtAxisEuro(500)), "500 €");
  assert.equal(sp(fmtAxisEuro(2500)), "2,5 k€");
  assert.equal(sp(fmtAxisEuro(40000)), "40 k€");
  assert.equal(sp(fmtAxisEuro(1200000)), "1,2 M€");
  assert.equal(sp(fmtAxisNum(1500)), "1 500");
  assert.equal(sp(fmtAxisNum(25000)), "25 k");
  assert.equal(sp(fmtAxisNum(2.5)), "2,5");
});

test("robustCap : une valeur isolée n'écrase pas l'échelle", () => {
  assert.deepEqual(robustCap([200, 300, 250, 1250, 280]), { cap: 300, clipped: true });
  assert.deepEqual(robustCap([200, 300, 250, 400, 280]), { cap: 400, clipped: false });
  assert.deepEqual(robustCap([5, 900]), { cap: 900, clipped: false });
});
