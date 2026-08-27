// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Nodes Admin Logic Tests v1.0.0                          ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditDelivery, groupNodes, readinessTone, validateDispatch } from '../src/components/nodes-admin-logic.mjs';

test('readiness tone never presents partial availability as production ready', () => {
  assert.equal(readinessTone({ productionReady: true }), 'online');
  assert.equal(readinessTone({ productionReady: false, dispatchAccepting: true }), 'alert');
  assert.equal(readinessTone({ productionReady: false, dispatchAccepting: false }), 'offline');
});

test('runtime nodes group by bounded context family', () => {
  const grouped = groupNodes([
    { id: 'HEADY_BRAIN', group: 'Core Pipeline' },
    { id: 'HEADY_MEMORY', group: 'Intelligence' },
    { id: 'HEADY_QA', group: 'Core Pipeline' },
  ]);
  assert.deepEqual(Object.keys(grouped), ['Core Pipeline', 'Intelligence']);
  assert.equal(grouped['Core Pipeline'].length, 2);
});

test('dispatch validation normalizes valid requests and rejects unsafe input', () => {
  assert.deepEqual(validateDispatch({ nodeId: 'HEADY_QA', action: ' inspect.health ', inputText: '{"scope":"runtime"}' }), {
    nodeId: 'HEADY_QA',
    body: { action: 'inspect.health', input: { scope: 'runtime' }, dependsOn: [] },
  });
  assert.throws(() => validateDispatch({ nodeId: '', action: 'inspect.health', inputText: '{}' }), /Select/);
  assert.throws(() => validateDispatch({ nodeId: 'HEADY_QA', action: 'Deploy Now', inputText: '{}' }), /Action/);
  assert.throws(() => validateDispatch({ nodeId: 'HEADY_QA', action: 'inspect.health', inputText: '[]' }), /object/);
  assert.throws(() => validateDispatch({ nodeId: 'HEADY_QA', action: 'inspect.health', inputText: '{' }), /valid JSON/);
});

test('audit delivery distinguishes durable pending rows from projected rows', () => {
  assert.equal(auditDelivery({ dispatched_at: null }), 'pending');
  assert.equal(auditDelivery({ dispatched_at: '2026-08-09T00:00:00Z' }), 'projected');
});
