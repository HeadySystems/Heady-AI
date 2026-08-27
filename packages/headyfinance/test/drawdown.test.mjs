// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — trailing drawdown tests (the bug-fix proof) ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDrawdownTracker } from "../src/drawdown.mjs";

// 50K tier: start 50000, maxDrawdown 2500 → initial level 47500.
const cfg = { startingBalance: 50000, maxDrawdown: 2500 };

test("trails UP on realized balance only — NOT on unrealized equity (the corrected bug)", () => {
  const dd = createDrawdownTracker(cfg);
  // Open profit of +1000 (unrealized) must NOT move the level; realized balance unchanged.
  const a = dd.update(50000, 1000);
  assert.equal(a.level, 47500, "unrealized profit must not trail the level");
  // Realize +1000 (balance 51000) → level trails to 48500.
  const b = dd.update(51000, 0);
  assert.equal(b.level, 48500);
});

test("breach is on real-time equity (balance + unrealized), not realized balance", () => {
  const dd = createDrawdownTracker(cfg);
  dd.update(51000, 0); // level 48500
  // Balance 49000 but open loss -600 → equity 48400 <= 48500 → BREACH.
  const r = dd.update(49000, -600);
  assert.equal(r.breached, true);
  assert.equal(r.equity, 48400);
  // Same balance, flat → equity 49000 > 48500 → safe.
  const s = createDrawdownTracker(cfg);
  s.update(51000, 0);
  assert.equal(s.update(49000, 0).breached, false);
});

test("level LOCKS once it reaches the starting balance and never trails past it", () => {
  const dd = createDrawdownTracker(cfg);
  dd.update(52500, 0); // 52500 - 2500 = 50000 = starting → lock
  const snap = dd.snapshot();
  assert.equal(snap.level, 50000);
  assert.equal(snap.locked, true);
  // Further gains do NOT push the level above the starting balance.
  const r = dd.update(60000, 0);
  assert.equal(r.level, 50000, "locked level stays at starting balance");
  assert.equal(r.locked, true);
});

test("rejects non-finite inputs (fail-closed)", () => {
  const dd = createDrawdownTracker(cfg);
  assert.throws(() => dd.update("x", 0));
  assert.throws(() => dd.update(50000, Number.NaN));
  assert.throws(() => createDrawdownTracker({ startingBalance: 0, maxDrawdown: 2500 }));
});
