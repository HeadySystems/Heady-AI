// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ CSL Engine tests — node:test, deps: @heady/phi-math       ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DIM,
  dot,
  magnitude,
  normalize,
  cosineSimilarity,
  sigmoid,
  cslAND,
  cslOR,
  cslNOT,
  cslIMPLY,
  cslXOR,
  cslCONSENSUS,
  cslBlend,
  cslGate,
  phiBackoffMs,
} from "../src/index.mjs";

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("DIM is the locked 384", () => assert.equal(DIM, 384));

test("vector primitives", () => {
  assert.equal(dot([1, 2, 3], [4, 5, 6]), 32);
  assert.ok(close(magnitude([3, 4]), 5));
  assert.ok(close(magnitude(normalize([3, 4])), 1));
  assert.deepEqual(normalize([0, 0]), [0, 0]); // zero vector safe
  assert.throws(() => dot([1, 2], [1]), RangeError);
});

test("cosineSimilarity: identical=1, orthogonal=0, opposite=-1", () => {
  assert.ok(close(cosineSimilarity([1, 1], [1, 1]), 1));
  assert.ok(close(cosineSimilarity([1, 0], [0, 1]), 0));
  assert.ok(close(cosineSimilarity([1, 0], [-1, 0]), -1));
});

test("sigmoid", () => {
  assert.ok(close(sigmoid(0), 0.5));
  assert.ok(sigmoid(10) > 0.99 && sigmoid(-10) < 0.01);
});

test("CSL gates: AND=cosine, OR superposes, NOT is orthogonal to b", () => {
  assert.ok(close(cslAND([1, 0], [1, 0]), 1));
  const or = cslOR([1, 0], [0, 1]);
  assert.ok(close(magnitude(or), 1)); // unit vector
  assert.ok(or[0] > 0 && or[1] > 0);
  const not = cslNOT([1, 1], [1, 0]); // remove the [1,0] component
  assert.ok(close(cosineSimilarity(not, [1, 0]), 0)); // result ⟂ b
});

test("IMPLY rectifies, XOR measures orthogonality, CONSENSUS centroids", () => {
  assert.ok(close(cslIMPLY([1, 0], [1, 0]), 1));
  assert.equal(cslIMPLY([1, 0], [-1, 0]), 0); // contradiction → 0
  assert.ok(close(cslXOR([1, 0], [0, 1]), 1)); // orthogonal → max exclusivity
  assert.ok(close(cslXOR([1, 0], [1, 0]), 0)); // aligned → 0
  const c = cslCONSENSUS([[1, 0], [0, 1]]);
  assert.ok(close(magnitude(c), 1));
  assert.throws(() => cslCONSENSUS([]), RangeError);
});

test("cslBlend uses ψ weight by default", () => {
  assert.ok(close(cslBlend(1, 0), 0.618033988749895));
  assert.ok(close(cslBlend(10, 20, 0.5), 15));
});

test("cslGate ternary bands (default φ thresholds)", () => {
  // value-only path
  assert.equal(cslGate(0.9), "EXECUTE"); // ≥ 0.618
  assert.equal(cslGate(0.5), "CAUTIOUS"); // between 0.382 and 0.618
  assert.equal(cslGate(0.2), "HALT"); // < 0.382
});

test("cslGate combines value × cosScore (geometric mean)", () => {
  // high confidence but low relevance must NOT execute
  assert.equal(cslGate(0.95, 0.1), "HALT");
  // both high → execute
  assert.equal(cslGate(0.9, 0.9), "EXECUTE");
  // custom object thresholds (as the auto-flow engine passes)
  assert.equal(cslGate(0.7, 0.7, { halt: 0.382, execute: 0.618 }), "EXECUTE");
  // numeric tau = execute threshold (HALT derived as tau·ψ = 0.382)
  assert.equal(cslGate(0.5, null, 0.618), "CAUTIOUS"); // 0.382 ≤ 0.5 < 0.618
  assert.equal(cslGate(0.3, null, 0.618), "HALT"); //     0.3 < 0.382
});

test("phiBackoffMs re-exported from @heady/phi-math", () => {
  assert.equal(phiBackoffMs(1), 1618);
});
