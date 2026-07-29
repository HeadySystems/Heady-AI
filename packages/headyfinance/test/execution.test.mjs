// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — execution adapter + live-paper loop tests  ║
// ║  Proves the paper broker's P&L accounting and the strategy→risk→   ║
// ║  execution loop, deterministically, with no money. © 2026 Heady   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPaperBroker } from "../src/execution.mjs";
import { createRiskEngine } from "../src/risk-engine.mjs";
import { runLivePaper } from "../src/live-loop.mjs";
import { runStrategy } from "../src/strategy.mjs";

test("paper broker: long entry then exit realizes the correct P&L", () => {
  const b = createPaperBroker();
  b.submitMarket({ side: "buy", qty: 2, price: 100 });
  assert.deepEqual(b.position(), { position: 2, avgPrice: 100 });
  assert.equal(b.markToMarket(105), 10); // 2 × (105-100)
  b.flatten(105);
  assert.equal(b.realized(), 10);
  assert.equal(b.position().position, 0);
});

test("paper broker: averaging up then a partial close realizes on the closed qty", () => {
  const b = createPaperBroker();
  b.submitMarket({ side: "buy", qty: 1, price: 100 });
  b.submitMarket({ side: "buy", qty: 1, price: 110 }); // avg 105, pos 2
  assert.equal(b.position().avgPrice, 105);
  b.submitMarket({ side: "sell", qty: 1, price: 115 }); // close 1 @ 115 vs 105 → +10
  assert.equal(b.realized(), 10);
  assert.equal(b.position().position, 1);
});

test("paper broker: a flip closes the old side and opens the new at the new price", () => {
  const b = createPaperBroker();
  b.submitMarket({ side: "buy", qty: 1, price: 100 });
  b.submitMarket({ side: "sell", qty: 3, price: 110 }); // close +1 (+10), open -2 @ 110
  assert.equal(b.realized(), 10);
  assert.equal(b.position().position, -2);
  assert.equal(b.position().avgPrice, 110);
});

test("paper broker rejects bad orders (fail-closed)", () => {
  const b = createPaperBroker();
  assert.throws(() => b.submitMarket({ side: "hold", qty: 1, price: 100 }));
  assert.throws(() => b.submitMarket({ side: "buy", qty: 0, price: 100 }));
  assert.throws(() => b.submitMarket({ side: "buy", qty: 1, price: -5 }));
});

test("live-paper loop drives the broker from strategy signals and returns a session", () => {
  const up = Array.from({ length: 40 }, (_, i) => ({ close: 100 + i }));
  const signals = runStrategy("sma-crossover", up, { fast: 5, slow: 20 });
  const engine = createRiskEngine({ account: { startingBalance: 100000, maxDrawdown: 5000 } });
  const broker = createPaperBroker();
  const r = runLivePaper({ bars: up, signals, engine, broker, unitsPerSignal: 10 });
  assert.equal(r.mode, "paper");
  assert.ok(r.fills > 0, "the loop should have placed paper orders");
  assert.ok(r.finalEquity > 100000, "long a monotonic rise should profit on paper");
  assert.match(r.disclaimer, /Not live trading/);
});

test("live-paper loop flattens on a risk breach (risk gate governs execution)", () => {
  const down = Array.from({ length: 15 }, (_, i) => ({ close: 1000 - i * 40 }));
  const engine = createRiskEngine({ account: { startingBalance: 1000, maxDrawdown: 300 } });
  const broker = createPaperBroker();
  const r = runLivePaper({ bars: down, signals: down.map(() => ({ position: 1 })), engine, broker, unitsPerSignal: 1 });
  assert.ok(r.riskFlattenCount > 0, "a breach must force the broker flat");
});

test("runLivePaper refuses a non-paper broker (live execution is separately gated)", () => {
  const engine = createRiskEngine({ account: "50K" });
  const liveish = { ...createPaperBroker(), mode: "live" };
  assert.throws(() => runLivePaper({ bars: [{ close: 1 }, { close: 2 }], signals: [null, null], engine, broker: liveish }));
});
