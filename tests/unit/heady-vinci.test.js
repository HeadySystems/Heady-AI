/**
 * Heady™ Latent OS v5.4.0
 * Tests: HeadyVinci Session Planner + AsyncParallelExecutor
 * © 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents
 */
'use strict';

const assert = require('assert');
const { HeadyVinci, SubtaskStatus, MAX_SUBTASKS } = require('../../src/orchestration/heady-vinci');
const { AsyncParallelExecutor, MAX_CONCURRENCY } = require('../../src/orchestration/async-parallel-executor');
const { fib } = require('../../shared/phi-math');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  Promise.resolve().then(fn).then(() => {
    passed++;
    process.stdout.write(JSON.stringify({ level: 'info', test: name, status: 'PASS' }) + '\n');
  }).catch((err) => {
    process.stdout.write(JSON.stringify({ level: 'error', test: name, status: 'FAIL', error: err.message }) + '\n');
  });
}

// ─── HeadyVinci Tests ───────────────────────────────────────────────────────

test('createPlan produces valid plan', async () => {
  const vinci = new HeadyVinci();
  const plan = vinci.createPlan('Build system', [
    { name: 'Design', pool: 'warm' },
    { name: 'Code', pool: 'hot', dependencies: [0] },
    { name: 'Test', pool: 'hot', dependencies: [1] },
  ]);
  assert.ok(plan.id.startsWith('plan_'));
  assert.strictEqual(plan.subtasks.length, 3);
  assert.strictEqual(plan.status, 'ready');
});

test('getReadySubtasks returns only dependency-free tasks', async () => {
  const vinci = new HeadyVinci();
  const plan = vinci.createPlan('Build', [
    { name: 'A', dependencies: [] },
    { name: 'B', dependencies: [] },
    { name: 'C', dependencies: [0, 1] },
  ]);
  const ready = vinci.getReadySubtasks(plan.id);
  assert.strictEqual(ready.length, 2, 'A and B should be ready');
  assert.ok(ready.every((s) => s.status === SubtaskStatus.READY));
});

test('markSubtaskCompleted unlocks dependents', async () => {
  const vinci = new HeadyVinci();
  const plan = vinci.createPlan('Build', [
    { name: 'A' },
    { name: 'B', dependencies: [0] },
  ]);
  vinci.markSubtaskStarted(plan.id, plan.subtasks[0].id);
  vinci.markSubtaskCompleted(plan.id, plan.subtasks[0].id, 'done');
  const ready = vinci.getReadySubtasks(plan.id);
  assert.strictEqual(ready.length, 1);
  assert.strictEqual(ready[0].name, 'B');
});

test('MAX_SUBTASKS is fib(10) = 55', async () => {
  assert.strictEqual(MAX_SUBTASKS, fib(10));
});

// ─── AsyncParallelExecutor Tests ────────────────────────────────────────────

test('executeConcurrent runs all tasks', async () => {
  const executor = new AsyncParallelExecutor({ maxConcurrency: 5 });
  const results = await executor.executeConcurrent([
    () => Promise.resolve('a'),
    () => Promise.resolve('b'),
    () => Promise.resolve('c'),
  ]);
  assert.strictEqual(results.size, 3);
  assert.strictEqual(results.get('task_0'), 'a');
});

test('executeDAG respects dependencies', async () => {
  const executor = new AsyncParallelExecutor({ maxConcurrency: 5 });
  const order = [];
  const results = await executor.executeDAG([
    { id: 'first', fn: async () => { order.push('first'); return 1; }, dependencies: [] },
    { id: 'second', fn: async () => { order.push('second'); return 2; }, dependencies: ['first'] },
  ]);
  assert.strictEqual(order[0], 'first');
  assert.strictEqual(order[1], 'second');
  assert.strictEqual(results.get('first'), 1);
  assert.strictEqual(results.get('second'), 2);
});

test('MAX_CONCURRENCY is fib(8) = 21', async () => {
  assert.strictEqual(MAX_CONCURRENCY, fib(8));
});

// Wait for all async tests, then report
setTimeout(() => {
  process.stdout.write(JSON.stringify({
    level: 'info', suite: 'heady-vinci',
    passed, total, status: passed === total ? 'ALL_PASS' : 'SOME_FAIL',
  }) + '\n');
  process.exitCode = passed === total ? 0 : 1;
}, 5000);
