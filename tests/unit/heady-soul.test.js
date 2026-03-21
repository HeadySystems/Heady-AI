/**
 * Heady™ Latent OS v5.4.0
 * Tests: HeadySoul Values & Awareness Core
 * © 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents
 */
'use strict';

const assert = require('assert');
const { HeadySoul, CORE_VALUES, VALUES_VECTOR_DIM } = require('../../src/core/heady-soul');
const { fib, CSL_THRESHOLDS } = require('../../shared/phi-math');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    process.stdout.write(JSON.stringify({ level: 'info', test: name, status: 'PASS' }) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ level: 'error', test: name, status: 'FAIL', error: err.message }) + '\n');
  }
}

test('HeadySoul initializes with correct state', () => {
  const soul = new HeadySoul();
  assert.strictEqual(soul.state, 'initializing');
  assert.ok(soul.sessionId.length > 0);
});

test('HeadySoul has 8 core values', () => {
  assert.strictEqual(Object.keys(CORE_VALUES).length, 8);
});

test('VALUES_VECTOR_DIM is fib(14) = 377', () => {
  assert.strictEqual(VALUES_VECTOR_DIM, fib(14));
});

test('HeadySoul.start transitions to active', () => {
  const soul = new HeadySoul();
  soul.start();
  assert.strictEqual(soul.state, 'active');
  soul.stop();
});

test('evaluateAction rejects wrong dimensions', () => {
  const soul = new HeadySoul();
  const result = soul.evaluateAction(new Float32Array(10));
  assert.strictEqual(result.aligned, false);
  assert.strictEqual(result.reason, 'invalid_embedding_dimensions');
});

test('evaluateAction accepts correct dimensions', () => {
  const soul = new HeadySoul();
  const embedding = new Float32Array(VALUES_VECTOR_DIM);
  for (let i = 0; i < VALUES_VECTOR_DIM; i++) embedding[i] = Math.random() * 2 - 1;
  const result = soul.evaluateAction(embedding);
  assert.ok(typeof result.overallScore === 'number');
  assert.ok(typeof result.aligned === 'boolean');
  assert.ok(result.valueScores);
  assert.strictEqual(Object.keys(result.valueScores).length, 8);
});

test('getState returns expected shape', () => {
  const soul = new HeadySoul();
  const state = soul.getState();
  assert.strictEqual(state.state, 'initializing');
  assert.strictEqual(state.valuesCount, 8);
  assert.ok(typeof state.coherenceScore === 'number');
});

process.stdout.write(JSON.stringify({
  level: 'info', suite: 'heady-soul',
  passed, total, status: passed === total ? 'ALL_PASS' : 'SOME_FAIL',
}) + '\n');
process.exitCode = passed === total ? 0 : 1;
