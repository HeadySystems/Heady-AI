// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — risk/signal engine + paper-sim tests       ║
// ║  Deterministic, synthetic-input — no broker, no market data, no    ║
// ║  real money. Proves the advisory brain end-to-end on paper.        ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRiskEngine, SIGNAL } from "../src/risk-engine.mjs";
import { runPaperSession } from "../src/paper-sim.mjs";
import { resolveAccount } from "../src/accounts.mjs";

test("resolveAccount: known tier, custom personal account, and rejection", () => {
  assert.equal(resolveAccount("50K").startingBalance, 50000);
  const custom = resolveAccount({ startingBalance: 5000, maxDrawdown: 250 });
  assert.equal(custom.startingBalance, 5000);
  assert.ok(custom.initialMAE > 0);
  assert.throws(() => resolveAccount("999K"));
  assert.throws(() => resolveAccount({ startingBalance: -1, maxDrawdown: 10 }));
});

test("engine ENGAGEs when safe and flat", () => {
  const eng = createRiskEngine({ account: "50K" });
  const r = eng.checkRisk(50000, 0);
  assert.equal(r.safe, true);
  assert.equal(r.signal, SIGNAL.ENGAGE);
});

test("engine REPELs on a drawdown breach (equity incl. unrealized)", () => {
  const eng = createRiskEngine({ account: "50K" });
  eng.checkRisk(51000, 0); // level trails to 48500
  const r = eng.checkRisk(49000, -600); // equity 48400 <= 48500
  assert.equal(r.safe, false);
  assert.equal(r.signal, SIGNAL.REPEL);
  assert.ok(r.violations.some((v) => v.startsWith("TRAILING_DRAWDOWN")));
});

test("engine REPELs on an MAE breach", () => {
  const eng = createRiskEngine({ account: "50K" }); // initialMAE 750
  const r = eng.checkRisk(50000, -800); // open loss beyond -750
  assert.equal(r.safe, false);
  assert.ok(r.violations.some((v) => v.startsWith("MAE_EXCEEDED")));
});

test("engine HOLDs (caution) as an open loss approaches the MAE limit without breaching", () => {
  const eng = createRiskEngine({ account: "50K" }); // MAE 750
  const r = eng.checkRisk(50000, -730); // ~97% of the limit → gate cautions, not yet a violation
  assert.equal(r.safe, true);
  assert.equal(r.signal, SIGNAL.HOLD);
});

test("onEvent sink receives structured events (no console)", () => {
  const events = [];
  const eng = createRiskEngine({ account: "50K", onEvent: (e) => events.push(e.type) });
  eng.checkRisk(50000, -800); // violation
  assert.ok(events.includes("risk:violation"));
});

test("payout eligibility follows the Apex funded rules", () => {
  const eng = createRiskEngine({ account: "50K" });
  // Fresh account: not enough trading/profitable days.
  const early = eng.canRequestPayout(500);
  assert.equal(early.allowed, false);
  assert.ok(early.reasons.length >= 1);
});

test("paper session runs over simulated ticks and reports the first breach", () => {
  const eng = createRiskEngine({ account: "50K" });
  const ticks = [
    { balance: 50000, openPnL: 0 },
    { balance: 50500, openPnL: 0 },   // trails level to 48500 (via 50500? no — 50500-2500=48000)
    { balance: 51000, openPnL: 0 },   // level 48500
    { balance: 48400, openPnL: 0 },   // equity 48400 <= 48500 → breach
    { balance: 48600, openPnL: 0 },
  ];
  const sess = runPaperSession({ engine: eng, ticks });
  assert.equal(sess.ticks, 5);
  assert.equal(sess.breached, true);
  assert.equal(sess.firstBreachAt, 3);
  assert.equal(sess.records[3].signal, SIGNAL.REPEL);
  assert.ok(sess.status.mode === "paper");
});

test("a clean winning session never breaches and stays advisory", () => {
  const eng = createRiskEngine({ account: "50K" });
  const ticks = Array.from({ length: 6 }, (_, i) => ({ balance: 50000 + i * 200, openPnL: 0 }));
  const sess = runPaperSession({ engine: eng, ticks });
  assert.equal(sess.breached, false);
  assert.equal(sess.status.mode, "paper");
});
