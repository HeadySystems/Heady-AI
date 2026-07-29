// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — backtest tests (mechanics, no lookahead,   ║
// ║  risk gating). Asserts the SIMULATION is correct — never that any   ║
// ║  strategy is profitable. © 2026 HeadySystems Inc. — Eric Haywood   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRiskEngine } from "../src/risk-engine.mjs";
import { runBacktest } from "../src/backtest.mjs";
import { runStrategy } from "../src/strategy.mjs";

// A tiny hand-computable series: always-long, price +1 per bar.
const bars = [{ close: 100 }, { close: 101 }, { close: 102 }, { close: 103 }];
const alwaysLong = bars.map(() => ({ position: 1 }));

test("no lookahead + correct P&L: long through a +1/bar series earns exactly 3 units", () => {
  const eng = createRiskEngine({ account: { startingBalance: 1000, maxDrawdown: 500 } });
  const r = runBacktest({ bars, signals: alwaysLong, engine: eng, unitsPerSignal: 1 });
  // 3 steps × +1 × 1 unit = +3 → finalEquity 1003.
  assert.equal(r.finalEquity, 1003);
  assert.equal(r.totalReturnPct, 0.3);
  assert.equal(r.barsTested, 4);
  assert.equal(r.mode, "paper-historical");
  assert.match(r.disclaimer, /Not investment advice/);
});

test("short position profits on a falling series; direction sign is correct", () => {
  const down = [{ close: 100 }, { close: 99 }, { close: 98 }];
  const eng = createRiskEngine({ account: { startingBalance: 1000, maxDrawdown: 500 } });
  const r = runBacktest({ bars: down, signals: down.map(() => ({ position: -1 })), engine: eng, unitsPerSignal: 2 });
  // 2 steps × (-1)×2×(-1) = +4.
  assert.equal(r.finalEquity, 1004);
});

test("risk gate flattens on a drawdown breach and stops the bleed", () => {
  // Falling market, but strategy says LONG → losses accrue → account breaches → gate flattens.
  const down = Array.from({ length: 12 }, (_, i) => ({ close: 1000 - i * 50 }));
  const eng = createRiskEngine({ account: { startingBalance: 1000, maxDrawdown: 300 } });
  const r = runBacktest({ bars: down, signals: down.map(() => ({ position: 1 })), engine: eng, unitsPerSignal: 1 });
  assert.ok(r.riskFlattenCount > 0, "the risk engine should have forced flat after the breach");
  // Once flattened, equity stops falling — final loss is bounded, not the full move.
  const unGatedLoss = 1000 - down[down.length - 1].close; // if it had ridden all the way down
  assert.ok((1000 - r.finalEquity) < unGatedLoss, "gating must cap the loss below the un-gated ride");
});

test("integrates the real strategy layer end-to-end (rising series → long → profit)", () => {
  const up = Array.from({ length: 40 }, (_, i) => ({ close: 100 + i }));
  const signals = runStrategy("sma-crossover", up, { fast: 5, slow: 20 });
  const eng = createRiskEngine({ account: { startingBalance: 100000, maxDrawdown: 3000 } });
  const r = runBacktest({ bars: up, signals, engine: eng, unitsPerSignal: 1 });
  assert.ok(r.finalEquity > 100000, "a long-only crossover on a monotonic rise should not lose");
  assert.equal(r.equityCurve.length, up.length);
});

test("rejects misaligned signals and too-few bars (fail-closed)", () => {
  const eng = createRiskEngine({ account: "50K" });
  assert.throws(() => runBacktest({ bars, signals: [{ position: 1 }], engine: eng }));
  assert.throws(() => runBacktest({ bars: [{ close: 1 }], signals: [{ position: 1 }], engine: eng }));
});
