// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Consistency Bus tests                                     ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLinkIndex, recognize, ingressGuard, egressNormalize, changeSet, applyChangeSet } from '../src/index.mjs';

const VARS = [
  { class: 'fact', name: 'embedding.dim', value: '384', sot: 'facts.yaml' },
  { class: 'fact', name: 'embedding.model', value: '@cf/baai/bge-small-en-v1.5', sot: 'facts.yaml' },
  { class: 'env', name: 'CODEFLOW_ORIGIN', value: '*', sot: 'registry' },
];
const index = loadLinkIndex({ vars: VARS });

test('link index loads HeadyRegistry values with lock status', () => {
  assert.equal(index.size, 3);
  assert.equal(index.byName.get('embedding.dim').locked, true);
  assert.equal(index.byName.get('CODEFLOW_ORIGIN').locked, false);
});

test('recognize classifies linked values MATCH vs DRIFT', () => {
  const f = recognize({ embedding: { dim: 512, model: '@cf/baai/bge-small-en-v1.5' } }, index);
  const byKey = Object.fromEntries(f.map((x) => [x.key, x.status]));
  assert.equal(byKey['embedding.dim'], 'DRIFT');
  assert.equal(byKey['embedding.model'], 'MATCH');
});

test('ingress FAILS CLOSED on drift of a locked value (unless authorized)', () => {
  const payload = { embedding: { dim: 1536 } };
  assert.equal(ingressGuard(payload, index).verdict, 'BLOCK');
  assert.equal(ingressGuard(payload, index, { authorizedKeys: ['embedding.dim'] }).verdict, 'ALLOW');
});

test('egress normalizes stale linked values to canonical (type preserved)', () => {
  const { payload, rewrites } = egressNormalize({ embedding: { dim: 1536 } }, index);
  assert.equal(payload.embedding.dim, 384);
  assert.equal(typeof payload.embedding.dim, 'number');
  assert.equal(rewrites.length, 1);
});

test('a canonical change propagates to EVERY link-site (no partial update)', () => {
  const root = mkdtempSync(join(tmpdir(), 'cb-'));
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'configs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'a.md'), 'embedding dim is 384 here\n');
  writeFileSync(join(root, 'configs', 'b.json'), '{ "dim": 384 }\n');
  const cs = changeSet(index, 'embedding.dim', '512', { root });
  assert.ok(cs.sites.length >= 2, 'blast radius found all sites carrying the value');
  const res = applyChangeSet(cs, { root, actor: 'test' });
  assert.equal(res.applied, cs.proposals.length, 'every site applied');
  assert.match(readFileSync(join(root, 'docs', 'a.md'), 'utf8'), /512/);
  assert.match(readFileSync(join(root, 'configs', 'b.json'), 'utf8'), /512/);
});

test('no-op change yields an empty change-set', () => {
  assert.equal(changeSet(index, 'embedding.dim', '384').noop, true);
});
