// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Auto-Flow preflight tests — the shortlist gate is real     ║
// ║  Proves preflight (over the LIVE skill/workflow catalog) ranks by   ║
// ║  relevance, caps at fib(7)=13, gates φ-ternary, and returns zero    ║
// ║  recommendations for an unmatchable task. © 2026 HeadySystems Inc. ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { preflight } from "../preflight.mjs";

const DECISIONS = new Set(["EXECUTE", "CAUTIOUS", "HALT"]);

test("scans a non-empty catalog and returns a capped, sorted, gated shortlist", () => {
  const r = preflight("agent handoff catch-up bundle since the last run");
  assert.ok(r.catalogSize > 0, "catalog must not be empty");
  assert.ok(r.shortlist.length <= 13, "shortlist capped at fib(7)=13");
  for (let i = 1; i < r.shortlist.length; i += 1) {
    assert.ok(r.shortlist[i - 1].score >= r.shortlist[i].score, "shortlist sorted by score desc");
  }
  for (const s of r.shortlist) assert.ok(DECISIONS.has(s.decision));
  assert.ok(r.recommended.every((x) => x.decision !== "HALT"), "recommended excludes HALT");
});

test("a strongly on-topic task surfaces the matching pack as recommended", () => {
  const r = preflight("agent handoff summarize and verify all work since the last run catch-up bundle");
  assert.ok(r.recommended.some((x) => x.ref.includes("handoff")), "heady-handoff family expected in recommendations");
});

test("an unmatchable task yields zero recommendations (never a forced pick)", () => {
  const r = preflight("zzqx qqzv wxqj plmk");
  assert.equal(r.recommended.length, 0);
});

test("φ-ternary thresholds hold: HALT ≈ 1/φ² < EXECUTE ≈ 1/φ", () => {
  const { HALT, EXECUTE } = preflight("x").thresholds;
  const PHI = (1 + Math.sqrt(5)) / 2;
  assert.ok(Math.abs(HALT - 1 / (PHI * PHI)) < 1e-9);
  assert.ok(Math.abs(EXECUTE - 1 / PHI) < 1e-9);
  assert.ok(HALT < EXECUTE);
});
