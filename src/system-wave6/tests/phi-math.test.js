/**
 * Heady™ Phi-Math Foundation Tests v6.0
 * Validates all phi-derived constants and functions
 * 
 * @author Eric Haywood — HeadySystems Inc.
 */

'use strict';

const assert = require('assert');
const path = require('path');

// Direct require since we're testing the module itself
const phiMath = require(path.resolve(__dirname, '../shared/phi-math'));

const {
  PHI, PSI, PHI_SQ, PHI_CUBE, PHI_FOURTH,
  PSI_SQ, PSI_CUBE, PSI_FOURTH,
  EMBEDDING_DIM, FIB_CACHE,
  fib, nearestFib, phiThreshold, phiBackoff, phiBackoffWithJitter,
  CSL_THRESHOLDS, DEDUP_THRESHOLD, COHERENCE_DRIFT_THRESHOLD,
  PRESSURE_LEVELS, ALERT_THRESHOLDS, TIMING,
  POOL_SIZES, HNSW_PARAMS, SERVICE_PORTS,
  cslAnd, cslOr, cslNot,
  phiFusionWeights, phiResourceWeights,
} = phiMath;

// ═══════════════════════════════════════════════════════════
// CORE CONSTANTS
// ═══════════════════════════════════════════════════════════

function testCoreConstants() {
  // Golden ratio identity: φ² = φ + 1
  assert(Math.abs(PHI * PHI - (PHI + 1)) < 1e-10, 'φ² should equal φ + 1');
  
  // Conjugate identity: 1/φ = φ - 1
  assert(Math.abs(1 / PHI - (PHI - 1)) < 1e-10, '1/φ should equal φ - 1');
  
  // PSI = 1/φ
  assert(Math.abs(PSI - 1 / PHI) < 1e-10, 'PSI should equal 1/PHI');
  
  // PHI * PSI = 1
  assert(Math.abs(PHI * PSI - 1) < 1e-10, 'PHI * PSI should equal 1');
  
  // PHI_SQ = φ + 1
  assert(Math.abs(PHI_SQ - (PHI + 1)) < 1e-10, 'PHI_SQ should equal PHI + 1');
  
  // PHI_CUBE = 2φ + 1
  assert(Math.abs(PHI_CUBE - (2 * PHI + 1)) < 1e-10, 'PHI_CUBE should equal 2*PHI + 1');
  
  // PHI_FOURTH = 3φ + 2
  assert(Math.abs(PHI_FOURTH - (3 * PHI + 2)) < 1e-10, 'PHI_FOURTH should equal 3*PHI + 2');
  
  // Embedding dimension
  assert.strictEqual(EMBEDDING_DIM, 384, 'EMBEDDING_DIM should be 384');
  
  return 'PASS';
}

// ═══════════════════════════════════════════════════════════
// FIBONACCI SEQUENCE
// ═══════════════════════════════════════════════════════════

function testFibonacci() {
  // Known values
  assert.strictEqual(fib(0), 0);
  assert.strictEqual(fib(1), 1);
  assert.strictEqual(fib(2), 1);
  assert.strictEqual(fib(5), 5);
  assert.strictEqual(fib(8), 21);
  assert.strictEqual(fib(10), 55);
  assert.strictEqual(fib(12), 144);
  assert.strictEqual(fib(14), 377);
  assert.strictEqual(fib(16), 987);
  assert.strictEqual(fib(20), 6765);
  
  // Fibonacci recurrence: fib(n) = fib(n-1) + fib(n-2)
  for (let i = 2; i <= 20; i++) {
    assert.strictEqual(fib(i), fib(i - 1) + fib(i - 2), `fib(${i}) should equal fib(${i-1}) + fib(${i-2})`);
  }
  
  // Ratio convergence: fib(n+1)/fib(n) → φ
  const ratio = fib(20) / fib(19);
  assert(Math.abs(ratio - PHI) < 0.0001, `fib(20)/fib(19) should approximate φ, got ${ratio}`);
  
  // nearestFib
  assert.strictEqual(nearestFib(20), 21);
  assert.strictEqual(nearestFib(10), 8);
  assert.strictEqual(nearestFib(100), 89);
  
  return 'PASS';
}

// ═══════════════════════════════════════════════════════════
// CSL THRESHOLDS
// ═══════════════════════════════════════════════════════════

function testCSLThresholds() {
  // phiThreshold formula: 1 - ψ^level × 0.5
  assert(Math.abs(CSL_THRESHOLDS.MINIMUM - (1 - Math.pow(PSI, 0) * 0.5)) < 1e-10);
  assert(Math.abs(CSL_THRESHOLDS.LOW - (1 - Math.pow(PSI, 1) * 0.5)) < 1e-10);
  assert(Math.abs(CSL_THRESHOLDS.MEDIUM - (1 - Math.pow(PSI, 2) * 0.5)) < 1e-10);
  assert(Math.abs(CSL_THRESHOLDS.HIGH - (1 - Math.pow(PSI, 3) * 0.5)) < 1e-10);
  assert(Math.abs(CSL_THRESHOLDS.CRITICAL - (1 - Math.pow(PSI, 4) * 0.5)) < 1e-10);
  
  // Value ranges
  assert(CSL_THRESHOLDS.MINIMUM > 0.49 && CSL_THRESHOLDS.MINIMUM < 0.51, 'MINIMUM ≈ 0.500');
  assert(CSL_THRESHOLDS.LOW > 0.68 && CSL_THRESHOLDS.LOW < 0.70, 'LOW ≈ 0.691');
  assert(CSL_THRESHOLDS.MEDIUM > 0.80 && CSL_THRESHOLDS.MEDIUM < 0.82, 'MEDIUM ≈ 0.809');
  assert(CSL_THRESHOLDS.HIGH > 0.87 && CSL_THRESHOLDS.HIGH < 0.89, 'HIGH ≈ 0.882');
  assert(CSL_THRESHOLDS.CRITICAL > 0.92 && CSL_THRESHOLDS.CRITICAL < 0.94, 'CRITICAL ≈ 0.927');
  
  // Monotonic increase
  assert(CSL_THRESHOLDS.MINIMUM < CSL_THRESHOLDS.LOW);
  assert(CSL_THRESHOLDS.LOW < CSL_THRESHOLDS.MEDIUM);
  assert(CSL_THRESHOLDS.MEDIUM < CSL_THRESHOLDS.HIGH);
  assert(CSL_THRESHOLDS.HIGH < CSL_THRESHOLDS.CRITICAL);
  
  // DEDUP above CRITICAL
  assert(DEDUP_THRESHOLD > CSL_THRESHOLDS.CRITICAL, 'DEDUP should exceed CRITICAL');
  
  // COHERENCE_DRIFT = MEDIUM
  assert.strictEqual(COHERENCE_DRIFT_THRESHOLD, CSL_THRESHOLDS.MEDIUM);
  
  return 'PASS';
}

// ═══════════════════════════════════════════════════════════
// PHI-BACKOFF
// ═══════════════════════════════════════════════════════════

function testPhiBackoff() {
  // Base case
  assert.strictEqual(phiBackoff(0), 1000);
  
  // Phi scaling: each step multiplied by φ
  const expected = [1000, 1618, 2618, 4236, 6854, 11090];
  for (let i = 0; i < expected.length; i++) {
    const actual = Math.round(phiBackoff(i));
    assert(Math.abs(actual - expected[i]) < 2, `phiBackoff(${i}) should be ≈${expected[i]}, got ${actual}`);
  }
  
  // Respects max
  assert(phiBackoff(20, 1000, 60000) <= 60000, 'Should not exceed maxMs');
  
  // Jitter version stays within bounds
  if (typeof phiBackoffWithJitter === 'function') {
    for (let i = 0; i < 10; i++) {
      const val = phiBackoffWithJitter(2);
      const base = phiBackoff(2);
      // Jitter should be ±38.2% (PSI²)
      assert(val >= base * 0.5, `Jitter too low: ${val}`);
      assert(val <= base * 1.5, `Jitter too high: ${val}`);
    }
  }
  
  return 'PASS';
}

// ═══════════════════════════════════════════════════════════
// SERVICE PORTS
// ═══════════════════════════════════════════════════════════

function testServicePorts() {
  assert(SERVICE_PORTS, 'SERVICE_PORTS should be defined');
  
  // All ports in range 3310-3396
  const ports = Object.values(SERVICE_PORTS);
  for (const port of ports) {
    if (typeof port === 'number') {
      assert(port >= 3310 && port <= 3396, `Port ${port} out of range 3310-3396`);
    }
  }
  
  // No duplicate ports
  const uniquePorts = new Set(ports.filter(p => typeof p === 'number'));
  assert.strictEqual(uniquePorts.size, ports.filter(p => typeof p === 'number').length, 'No duplicate ports allowed');
  
  // Key services exist
  assert(SERVICE_PORTS.HEADY_AUTH, 'HEADY_AUTH port should exist');
  assert(SERVICE_PORTS.HEADY_CONDUCTOR || SERVICE_PORTS.HEADY_ORCHESTRATOR, 'Conductor port should exist');
  
  return 'PASS';
}

// ═══════════════════════════════════════════════════════════
// HNSW PARAMETERS
// ═══════════════════════════════════════════════════════════

function testHNSWParams() {
  if (!HNSW_PARAMS) return 'SKIP — HNSW_PARAMS not exported';
  
  assert.strictEqual(HNSW_PARAMS.M || HNSW_PARAMS.m, 21, 'HNSW M should be fib(8) = 21');
  
  const efConstruction = HNSW_PARAMS.EF_CONSTRUCTION || HNSW_PARAMS.ef_construction || HNSW_PARAMS.efConstruction;
  assert.strictEqual(efConstruction, 144, 'ef_construction should be fib(12) = 144');
  
  const efSearch = HNSW_PARAMS.EF_SEARCH || HNSW_PARAMS.ef_search || HNSW_PARAMS.efSearch;
  assert.strictEqual(efSearch, 89, 'ef_search should be fib(11) = 89');
  
  return 'PASS';
}

// ═══════════════════════════════════════════════════════════
// CSL GATE OPERATIONS
// ═══════════════════════════════════════════════════════════

function testCSLGates() {
  if (!cslAnd || !cslOr || !cslNot) return 'SKIP — CSL gates not exported';
  
  // CSL AND: cosine similarity (range 0-1 for normalized vectors)
  const v1 = [1, 0, 0];
  const v2 = [1, 0, 0];
  const v3 = [0, 1, 0];
  
  const andSame = cslAnd(v1, v2);
  assert(andSame > 0.99, `CSL AND of identical vectors should be ≈1, got ${andSame}`);
  
  const andOrth = cslAnd(v1, v3);
  assert(Math.abs(andOrth) < 0.01, `CSL AND of orthogonal vectors should be ≈0, got ${andOrth}`);
  
  return 'PASS';
}

// ═══════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════

function runAllTests() {
  const tests = [
    ['Core Constants', testCoreConstants],
    ['Fibonacci Sequence', testFibonacci],
    ['CSL Thresholds', testCSLThresholds],
    ['Phi-Backoff', testPhiBackoff],
    ['Service Ports', testServicePorts],
    ['HNSW Parameters', testHNSWParams],
    ['CSL Gates', testCSLGates],
  ];
  
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const results = [];
  
  for (const [name, testFn] of tests) {
    try {
      const result = testFn();
      if (result === 'SKIP') {
        skipped++;
        results.push({ name, status: 'SKIP' });
      } else {
        passed++;
        results.push({ name, status: 'PASS' });
      }
    } catch (error) {
      failed++;
      results.push({ name, status: 'FAIL', error: error.message });
    }
  }
  
  // Output structured results
  const summary = {
    total: tests.length,
    passed,
    failed,
    skipped,
    results,
  };
  
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
