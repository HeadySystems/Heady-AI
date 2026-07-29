// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — indicators + strategy tests                ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { sma, ema, rsi } from "../src/indicators.mjs";
import { smaCrossover, rsiReversion, runStrategy } from "../src/strategy.mjs";
import { parseCsvBars } from "../src/bars.mjs";

test("SMA: leading nulls until the window fills, then the correct mean", () => {
  const s = sma([1, 2, 3, 4, 5], 3);
  assert.deepEqual(s, [null, null, 2, 3, 4]);
});

test("EMA: seeded with the first SMA, then recurses", () => {
  const e = ema([1, 2, 3, 4, 5], 3);
  assert.equal(e[0], null);
  assert.equal(e[1], null);
  assert.equal(e[2], 2); // seed = SMA(1,2,3)
  assert.ok(Math.abs(e[3] - 3) < 1e-9); // 4*0.5 + 2*0.5
  assert.ok(Math.abs(e[4] - 4) < 1e-9);
});

test("RSI: all-gains → 100; is null until the period is satisfied", () => {
  const r = rsi([1, 2, 3, 4, 5, 6], 3);
  assert.equal(r[0], null);
  assert.equal(r[2], null);
  assert.equal(r[3], 100); // no losses in the window
});

test("indicators reject non-finite series", () => {
  assert.throws(() => sma([1, "x", 3], 2));
  assert.throws(() => rsi([1, Number.NaN], 2));
});

test("SMA crossover: long when fast>slow, short when fast<slow, null before defined", () => {
  const up = Array.from({ length: 40 }, (_, i) => ({ close: 100 + i })); // steadily rising
  const sig = smaCrossover(up, { fast: 5, slow: 20 });
  assert.equal(sig[0], null);
  assert.equal(sig[39].position, 1); // rising → fast above slow → long
  const down = Array.from({ length: 40 }, (_, i) => ({ close: 200 - i }));
  assert.equal(smaCrossover(down, { fast: 5, slow: 20 })[39].position, -1);
  assert.throws(() => smaCrossover(up, { fast: 20, slow: 5 }));
});

test("RSI reversion: oversold → long, overbought → short", () => {
  const down = Array.from({ length: 20 }, (_, i) => ({ close: 100 - i * 2 })); // falling → oversold
  const sig = rsiReversion(down, { period: 5, lower: 30, upper: 70 });
  const last = sig[sig.length - 1];
  assert.equal(last.position, 1);
  const up = Array.from({ length: 20 }, (_, i) => ({ close: 100 + i * 2 }));
  assert.equal(rsiReversion(up, { period: 5 })[19].position, -1);
});

test("runStrategy dispatches by name and rejects unknown", () => {
  const bars = Array.from({ length: 40 }, (_, i) => ({ close: 100 + i }));
  assert.equal(runStrategy("sma-crossover", bars, { fast: 5, slow: 20 })[39].position, 1);
  assert.throws(() => runStrategy("nope", bars));
});

test("parseCsvBars handles a header + extra columns", () => {
  const csv = "Date,Open,High,Low,Close,Volume\n2026-01-01,10,11,9,10.5,1000\n2026-01-02,10.5,12,10,11.5,2000";
  const bars = parseCsvBars(csv);
  assert.equal(bars.length, 2);
  assert.equal(bars[1].close, 11.5);
  assert.equal(bars[0].high, 11);
});
