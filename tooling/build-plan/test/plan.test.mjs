// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Build-Plan tests — the deterministic proof                 ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compare, topoSort, planHash } from '../src/plan.mjs';

const goal = JSON.parse(readFileSync(join(new URL('../goals/portal-codeflow.json', import.meta.url).pathname), 'utf8'));

test('DETERMINISTIC: identical goal ⇒ identical plan hashes across runs', () => {
  const a = compare(goal);
  const b = compare(goal);
  assert.equal(a.mapped.hash, b.mapped.hash, 'mapped plan is reproducible');
  assert.equal(a.iterative.hash, b.iterative.hash, 'iterative plan is reproducible');
  assert.equal(planHash(a.mapped), a.mapped.hash, 'hash is self-consistent');
});

test('mapped plan is rework-free + green-by-construction', () => {
  const { mapped } = compare(goal);
  assert.equal(mapped.metrics.seamRework, 0, 'no seam rework');
  assert.equal(mapped.metrics.orderViolations, 0, 'topological order — no dependency violations');
  assert.equal(mapped.metrics.greenFromStart, true, 'all seams frozen up front');
  assert.equal(mapped.metrics.deferredWired, mapped.metrics.deferred, 'every deferred node is wired behind a frozen seam');
});

test('PROVEN: mapped strictly dominates simple-first on rework', () => {
  const { mapped, iterative, proof } = compare(goal);
  assert.ok(iterative.metrics.seamRework >= 2, 'simple-first reworks shared seams (WritePort, AuthPort)');
  assert.ok(mapped.metrics.seamRework < iterative.metrics.seamRework, 'mapped < iterative rework');
  assert.ok(proof.invariantsHeld.mapped_dominates_seam_rework);
  assert.match(proof.verdict, /PROVEN/);
});

test('the deferred WritePort seam is the real prod-apply rework', () => {
  const { iterative } = compare(goal);
  assert.ok(iterative.metrics.seamReworkOn.includes('WritePort'), 'prod-apply ↔ governed-edit shared seam reworks when not frozen');
});

test('topoSort detects cycles', () => {
  assert.throws(() => topoSort([{ id: 'a', depends: ['b'] }, { id: 'b', depends: ['a'] }]), /cycle/);
});
