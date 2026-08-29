// The registry's job is to fire on the exact paths that broke f69ddccdcd, and to
// stay quiet on ordinary edits. Both directions are asserted.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BYTE_PINS, classify, groupByPin } from '../src/pins.mjs';

const idsFor = (paths) => [...new Set(classify(paths).map((h) => h.pin.id))].sort();

test('catches every pin the 2026-08-27 branding sweep actually broke', () => {
  assert.deepEqual(
    idsFor([
      'policies/approval.rego',                                   // broke @heady/approvals build
      'apps/headyme-portal/src/components/AdminUI.js',            // broke the projection drift gate
      'docs/adr/0054-domain-canon-carrier-closure.md',            // needed a manual ceremony re-pin
    ]),
    ['adr-ceremony', 'approval-policy', 'projection-sources'],
  );
});

test('an applied migration is flagged as un-repinnable, not merely pinned', () => {
  const [hit] = classify(['packages/db/migrations/0004_approval_control_plane.sql']);
  assert.equal(hit.pin.id, 'db-migrations');
  assert.equal(hit.pin.offlineVerifiable, false);
  assert.match(hit.pin.repin, /IMPOSSIBLE/);
});

test('ordinary source edits are not flagged — the guard must not cry wolf', () => {
  assert.deepEqual(idsFor([
    'src/routes/brain.js',
    'tooling/coherence/src/coherence.mjs',
    'docs/ACTIVITY_RECORD.md',
    'README.md',
    'packages/db/src/migrate.mjs',          // the checker itself, not a pinned migration
    'docs/adr/0033-nine-domain-brand-architecture.md',  // accepted, not ceremony-pinned
  ]), []);
});

test('subtree matching is prefix-exact, never a bare substring', () => {
  assert.deepEqual(idsFor(['apps/headyme-portal-other/src/x.js']), []);
  assert.deepEqual(idsFor(['apps/headyme-portal/src/x.js']), ['projection-sources']);
  assert.deepEqual(idsFor(['packages/db/migrations-old/0001.sql']), []);
});

test('generated projections gated by equality are pinned too', () => {
  assert.deepEqual(idsFor(['configs/_generated/domain-roster.json']), ['domain-roster-projection']);
  assert.deepEqual(idsFor(['configs/battle-contexts/codex-context.json']), ['arena-spec-dumps']);
  assert.deepEqual(idsFor(['configs/battle-blueprint.json']), ['arena-spec-dumps']);
});

test('groupByPin collapses a 500-file sweep into per-pin rows', () => {
  const paths = Array.from({ length: 40 }, (_, i) => `apps/headyme-portal/src/f${i}.js`);
  const groups = groupByPin(classify([...paths, 'policies/approval.rego']));
  assert.equal(groups.length, 2);
  assert.equal(groups.find((g) => g.pin.id === 'projection-sources').paths.length, 40);
});

test('every registered pin carries the four fields a caller needs to act', () => {
  for (const p of BYTE_PINS) {
    for (const f of ['id', 'pinnedBy', 'breaks', 'repin']) {
      assert.ok(typeof p[f] === 'string' && p[f].length > 0, `${p.id}.${f} missing`);
    }
    assert.equal(typeof p.covers, 'function');
    assert.equal(typeof p.offlineVerifiable, 'boolean');
  }
});
