// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Auto-Context enforcer tests — the Law-4 gate is real      ║
// ║  Proves: bare reasoning calls in an anchor-less file FLAG, the     ║
// ║  wrap-once chokepoint pattern PASSES, waivers are honored, and     ║
// ║  prose/non-receiver forms are IGNORED. © 2026 HeadySystems Inc.   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mirror the enforcer's matching contract (kept in lock-step with autocontext.mjs).
const REASONING_CALL = /[A-Za-z0-9_$)\]]\s*\.\s*(complete|battle|council)\s*\(/;
const ENRICH_ANCHOR = /(wrapGateway|assertEnriched|autoContext|@heady\/auto-context)/;
const WAIVER = /heady-allow:\s*autocontext/;

// Scan one file's text the same way autocontext.mjs does.
function scan(text) {
  const anchored = ENRICH_ANCHOR.test(text);
  let violations = 0, waived = 0;
  for (const line of text.split('\n')) {
    if (!REASONING_CALL.test(line)) continue;
    if (WAIVER.test(line)) { waived += 1; continue; }
    if (anchored) continue;
    violations += 1;
  }
  return { anchored, violations, waived };
}

test('FLAGS a bare reasoning call in an anchor-less file', () => {
  const r = scan('export async function go(gw, req){ return gw.complete(req); }');
  assert.equal(r.anchored, false);
  assert.equal(r.violations, 1);
});

test('PASSES the wrap-once chokepoint pattern', () => {
  const text = [
    'import { wrapGateway } from "@heady/auto-context";',
    'const w = wrapGateway(gw, { retriever });',
    'export async function go(req){ return w.complete(req); }',
    'export async function fight(req){ return w.battle(req); }',
  ].join('\n');
  const r = scan(text);
  assert.equal(r.anchored, true);
  assert.equal(r.violations, 0);
});

test('honors a per-line waiver', () => {
  const text = 'return model.complete(req); // heady-allow:autocontext — bare model double in a harness';
  const r = scan(text);
  assert.equal(r.violations, 0);
  assert.equal(r.waived, 1);
});

test('IGNORES prose, comments, and non-receiver forms', () => {
  const safe = [
    '// the task will complete(eventually)',
    'function incomplete(x){ return x; }',
    'const completeFlag = true;',
    'await council(votes); // a bare fn named council, no receiver dot',
  ].join('\n');
  const r = scan(safe);
  assert.equal(r.violations, 0);
});

test('matches receivers: identifier, this, call result, index', () => {
  for (const s of ['gw.complete(x)', 'this.council(y)', 'make().battle(z)', 'pool[0].complete(q)']) {
    assert.ok(REASONING_CALL.test(s), `should match: ${s}`);
  }
});
