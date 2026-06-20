// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Orphans enforcer tests — the intersection is real         ║
// ║  Proves: depcruise/knip parsing and that "confirmed orphan" is the ║
// ║  set flagged by BOTH tools (entry points seen by only one pass).   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDepcruiseOrphans, parseKnipUnused, confirmedOrphans } from '../orphans.mjs';

test('parseDepcruiseOrphans extracts only orphan modules, sorted', () => {
  const json = { modules: [
    { source: 'tooling/z.mjs', orphan: true },
    { source: 'tooling/a.mjs', orphan: true },
    { source: 'packages/live.mjs', orphan: false },
  ] };
  assert.deepEqual(parseDepcruiseOrphans(json), ['tooling/a.mjs', 'tooling/z.mjs']);
  assert.deepEqual(parseDepcruiseOrphans(JSON.stringify(json)), ['tooling/a.mjs', 'tooling/z.mjs']);
});

test('parseKnipUnused extracts the files list, sorted', () => {
  assert.deepEqual(parseKnipUnused({ files: ['b.mjs', 'a.mjs'] }), ['a.mjs', 'b.mjs']);
  assert.deepEqual(parseKnipUnused({}), []);
});

test('confirmedOrphans = intersection (a CLI entry point flagged by ONE tool is NOT confirmed)', () => {
  const dep = ['tooling/cli.mjs', 'tooling/dead.mjs', 'packages/x.mjs'];
  const knip = ['tooling/dead.mjs', 'packages/y.mjs'];
  // cli.mjs is a depcruise orphan (nothing imports it) but knip sees it as an entry → NOT confirmed.
  // dead.mjs is flagged by both → confirmed.
  assert.deepEqual(confirmedOrphans(dep, knip), ['tooling/dead.mjs']);
});

test('confirmedOrphans is empty when the tools do not overlap', () => {
  assert.deepEqual(confirmedOrphans(['a.mjs'], ['b.mjs']), []);
  assert.deepEqual(confirmedOrphans([], ['b.mjs']), []);
});
