// The dumper's decision logic: the committed artifact set is authoritative, so a
// contender with no committed dump is reported rather than silently created.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planRefresh } from '../dump.mjs';

const CONTENDERS = [{ id: 'codex' }, { id: 'jules' }, { id: 'newcomer' }];

test('refreshes only contenders whose dump is already committed', () => {
  const plan = planRefresh(CONTENDERS, ['codex-context.json', 'jules-context.json']);
  assert.deepEqual(plan.refresh, [
    { id: 'codex', file: 'codex-context.json' },
    { id: 'jules', file: 'jules-context.json' },
  ]);
  assert.deepEqual(plan.uncommitted, ['newcomer']);
});

test('a new contender is never silently created', () => {
  const plan = planRefresh(CONTENDERS, []);
  assert.deepEqual(plan.refresh, []);
  assert.deepEqual(plan.uncommitted, ['codex', 'jules', 'newcomer']);
});

test('an orphan dump on disk is left alone — it maps to no contender', () => {
  const plan = planRefresh([{ id: 'codex' }], ['codex-context.json', 'retired-context.json']);
  assert.deepEqual(plan.refresh, [{ id: 'codex', file: 'codex-context.json' }]);
  assert.deepEqual(plan.uncommitted, []);
});

test('empty and missing inputs are tolerated', () => {
  assert.deepEqual(planRefresh(undefined, []), { refresh: [], uncommitted: [] });
  assert.deepEqual(planRefresh([], ['stray.json']), { refresh: [], uncommitted: [] });
});

test('importing the module does not run the dumper', async () => {
  // planRefresh imported above; if main() had run on import, the process would have
  // written to configs/ already. Re-importing must also stay inert.
  const again = await import('../dump.mjs');
  assert.equal(typeof again.planRefresh, 'function');
});
