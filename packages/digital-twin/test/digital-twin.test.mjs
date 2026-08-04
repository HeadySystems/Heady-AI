// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Digital Twin — unit tests (node --test)                  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { DIM } from "@heady/csl-engine";
import { createTwin, updateBehavior, twinSimilarity, simulate } from "../src/index.mjs";

const PSI = 0.6180339887498949;

test("createTwin is deterministic and normalized", () => {
  const a = createTwin("user-42", { type: "user" });
  const b = createTwin("user-42", { type: "user" });
  assert.equal(a.id, b.id);
  assert.deepEqual(a.embedding, b.embedding);
  assert.equal(a.embedding.length, DIM);
  assert.equal(a.entityType, "user");
  // unit vector
  const mag = Math.sqrt(a.embedding.reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(mag - 1) < 1e-9);
  // different entity → different twin
  assert.notEqual(createTwin("user-99").id, a.id);
  assert.throws(() => createTwin(""), /non-empty string/);
});

test("updateBehavior is pure and shifts the embedding", () => {
  const t0 = createTwin("agent-x");
  const t1 = updateBehavior(t0, "clicks", 5, { now: 0 });
  // input untouched
  assert.deepEqual(t0.behaviors, {});
  // behavior recorded, embedding changed but still unit-length
  assert.equal(t1.behaviors.clicks.value, 5);
  assert.notDeepEqual(t1.embedding, t0.embedding);
  assert.ok(Math.abs(Math.sqrt(t1.embedding.reduce((s, x) => s + x * x, 0)) - 1) < 1e-9);
  // deterministic
  assert.deepEqual(updateBehavior(t0, "clicks", 5, { now: 0 }).embedding, t1.embedding);
});

test("updateBehavior φ-decays the prior weight over elapsed time", () => {
  const t0 = createTwin("agent-y");
  const t1 = updateBehavior(t0, "focus", 1, { now: 0 });          // weight 1
  const t2 = updateBehavior(t1, "focus", 1, { now: 55_000 });     // 55s later → decayed
  assert.ok(t2.behaviors.focus.weight < 1);
  assert.ok(t2.behaviors.focus.weight >= PSI ** 5 - 1e-9); // floored
});

test("twinSimilarity: identical twins ≈ 1, raw number (no gate verdict)", () => {
  const a = createTwin("same");
  const b = createTwin("same");
  assert.ok(Math.abs(twinSimilarity(a, b) - 1) < 1e-9);
  const s = twinSimilarity(createTwin("p"), createTwin("q"));
  assert.equal(typeof s, "number");
  assert.ok(s >= -1 && s <= 1);
});

test("simulate returns raw drift/coherence/risk (no SAFE/REVIEW/BLOCK gate)", () => {
  const t = createTwin("sim-entity");
  const r = simulate(t, { name: "shock", perturbations: { load: 3, latency: 2 } });
  assert.equal(r.scenario, "shock");
  assert.equal(r.perturbationCount, 2);
  assert.ok(r.drift >= 0);
  assert.ok(r.coherence > 0 && r.coherence <= 1);
  assert.ok(r.risk >= 0);
  // patent boundary: NO gate/verdict field is emitted by this package
  assert.equal("gate" in r, false);
  // deterministic
  assert.deepEqual(simulate(t, { name: "shock", perturbations: { load: 3, latency: 2 } }), r);
  // empty scenario → ~zero drift (within float epsilon)
  assert.ok(simulate(t).drift < 1e-9);
});
