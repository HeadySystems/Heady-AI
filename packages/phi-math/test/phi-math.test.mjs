// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ φ-Math tests — node:test, zero deps                       ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PHI,
  PSI,
  PSI2,
  PHI_7,
  HEARTBEAT_MS,
  FIB,
  fib,
  phiThreshold,
  CSL_THRESHOLDS,
  GATE,
  phiBackoffMs,
  phiBackoff,
  phiFusionWeights,
  CIRCUIT_BREAKER,
} from "../src/index.mjs";

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("PHI and PSI satisfy the golden-ratio identities", () => {
  assert.ok(close(PHI, 1.618033988749895));
  assert.ok(close(PSI, PHI - 1)); // ψ = φ − 1
  assert.ok(close(PHI * PSI, 1)); // ψ = 1/φ
  assert.ok(close(PHI * PHI, PHI + 1)); // φ² = φ + 1
});

test("FIB is correct and fib() extends beyond the cache", () => {
  assert.deepEqual(FIB.slice(0, 8), [0, 1, 1, 2, 3, 5, 8, 13]);
  assert.equal(fib(10), 55);
  assert.equal(fib(20), 6765);
  assert.equal(fib(25), 75025); // beyond the cached array
  assert.throws(() => fib(-1), RangeError);
});

test("PHI_7 heartbeat scalar", () => {
  assert.ok(close(PHI_7, PHI ** 7));
  assert.equal(HEARTBEAT_MS, 29034);
});

test("phiThreshold is monotonic increasing and seeds CSL_THRESHOLDS", () => {
  assert.ok(close(phiThreshold(0), 0.5));
  assert.ok(phiThreshold(0) < phiThreshold(1));
  assert.ok(phiThreshold(1) < phiThreshold(2));
  assert.ok(close(CSL_THRESHOLDS.MINIMUM, 0.5));
  assert.ok(CSL_THRESHOLDS.CRITICAL > CSL_THRESHOLDS.HIGH);
  assert.throws(() => phiThreshold(-1), RangeError);
});

test("GATE bands are ψ² and ψ", () => {
  assert.ok(close(GATE.HALT, PSI2));
  assert.ok(close(GATE.EXECUTE, PSI));
  assert.ok(GATE.HALT < GATE.EXECUTE);
  assert.ok(close(GATE.HALT, 0.3819660112501051));
  assert.ok(close(GATE.EXECUTE, 0.6180339887498949));
});

test("phiBackoffMs grows by φ per attempt", () => {
  assert.equal(phiBackoffMs(1), 1618);
  assert.equal(phiBackoffMs(2), 2618);
  assert.equal(phiBackoffMs(3), 4236);
  assert.ok(phiBackoffMs(4) > phiBackoffMs(3));
  assert.throws(() => phiBackoffMs(0), RangeError);
});

test("phiBackoff awaits the computed delay (injected sleep)", async () => {
  let waited = -1;
  const ms = await phiBackoff(2, (x) => {
    waited = x;
    return Promise.resolve();
  });
  assert.equal(ms, 2618);
  assert.equal(waited, 2618);
});

test("phiFusionWeights are ψ-decaying and sum to 1", () => {
  const w = phiFusionWeights(3);
  assert.equal(w.length, 3);
  assert.ok(close(w.reduce((a, b) => a + b, 0), 1));
  assert.ok(w[0] > w[1] && w[1] > w[2]); // rank-weighted, first source heaviest
  assert.throws(() => phiFusionWeights(0), RangeError);
});

test("circuit-breaker policy", () => {
  assert.equal(CIRCUIT_BREAKER.FAILURE_THRESHOLD, 5);
  assert.equal(CIRCUIT_BREAKER.BASE_BACKOFF_US, 1618034);
});
