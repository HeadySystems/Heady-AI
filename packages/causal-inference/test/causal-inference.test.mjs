// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Causal Inference — unit tests (node --test)               ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createModel,
  topologicalSort,
  intervene,
  counterfactual,
  monteCarloSimulate,
  seededRandom,
  DEFAULT_SIMULATIONS,
} from "../src/index.mjs";

// A → B → C chain with explicit linear mechanisms (identity from single parent).
function chainModel() {
  return createModel({
    nodes: [
      { id: "A", initialValue: 1 },
      { id: "B", parents: ["A"], mechanism: ([a]) => a * 2 },
      { id: "C", parents: ["B"], mechanism: ([b]) => b + 1 },
    ],
  });
}

test("createModel builds nodes + edges and rejects dangling parents", () => {
  const m = chainModel();
  assert.equal(m.nodes.size, 3);
  assert.deepEqual(m.edges, [{ from: "A", to: "B" }, { from: "B", to: "C" }]);
  assert.throws(() => createModel({ nodes: [{ id: "X", parents: ["ghost"] }] }), /unknown parent/);
  assert.throws(() => createModel({ nodes: [{ id: "" }] }), /non-empty string id/);
});

test("topologicalSort orders parents before children and detects cycles", () => {
  const order = topologicalSort(chainModel().nodes);
  assert.ok(order.indexOf("A") < order.indexOf("B"));
  assert.ok(order.indexOf("B") < order.indexOf("C"));
  const cyclic = createModel({ nodes: [{ id: "A" }, { id: "B", parents: ["A"] }] });
  cyclic.nodes.get("A").parents.push("B"); // force a cycle
  assert.throws(() => topologicalSort(cyclic.nodes), /cycle detected/);
});

test("intervene applies the do-operator (severs parents, propagates)", () => {
  const m = chainModel();
  // do(A=1): B=2, C=3
  assert.deepEqual(intervene(m, { A: 1 }), { A: 1, B: 2, C: 3 });
  // do(B=10): A stays at its own value (root=1), C=11 — B's parent A is severed.
  const r = intervene(m, { B: 10 });
  assert.equal(r.B, 10);
  assert.equal(r.C, 11);
  assert.throws(() => intervene(m, { NOPE: 1 }), /unknown node/);
});

test("intervene is pure — input model is not mutated", () => {
  const m = chainModel();
  intervene(m, { A: 99 });
  assert.equal(m.nodes.get("A").value, 1);
  assert.deepEqual(m.nodes.get("B").parents, ["A"]);
});

test("counterfactual runs abduction→action→prediction with deltas", () => {
  const m = chainModel();
  const { counterfactualState, deltas } = counterfactual(m, { A: 1, B: 2, C: 3 }, { A: 5 });
  assert.deepEqual(counterfactualState, { A: 5, B: 10, C: 11 });
  assert.equal(deltas.C.factual, 3);
  assert.equal(deltas.C.counterfactual, 11);
  assert.equal(deltas.C.delta, 8);
});

test("monteCarloSimulate is deterministic for a fixed seed", () => {
  const m = chainModel();
  const a = monteCarloSimulate(m, { A: 1 }, { simulations: 200, seed: 42 });
  const b = monteCarloSimulate(m, { A: 1 }, { simulations: 200, seed: 42 });
  assert.deepEqual(a.stats, b.stats);
  assert.equal(a.simulations, 200);
  // stats shape + ordering sanity
  assert.ok(a.stats.C.p5 <= a.stats.C.mean && a.stats.C.mean <= a.stats.C.p95);
  assert.ok(["high", "medium", "low"].includes(a.stats.C.confidence));
});

test("monteCarloSimulate defaults to a Fibonacci sample count", () => {
  const m = chainModel();
  assert.equal(monteCarloSimulate(m, { A: 1 }).simulations, DEFAULT_SIMULATIONS);
});

test("seededRandom is reproducible and in [0,1)", () => {
  const r1 = seededRandom(7);
  const r2 = seededRandom(7);
  for (let i = 0; i < 5; i++) {
    const v = r1();
    assert.equal(v, r2());
    assert.ok(v >= 0 && v < 1);
  }
});
