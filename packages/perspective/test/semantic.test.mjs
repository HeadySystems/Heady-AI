// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Perspective — semantic (CSL cosine) tests                  ║
// ║  Uses a TEST-ONLY deterministic mock embedder. Production uses the  ║
// ║  locked bge-small embedder only (no fake embeddings in src).        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoles, tokenize, embedRoles, assignWeighted, assignSemantic, semanticScore } from '../src/index.mjs';

const VARS = [
  { class: 'agent', name: 'Sentinel', def: 'Monitoring and security watch observes health anomalies threats' },
  { class: 'bee', name: 'security-bee', def: 'Security review secrets fail-closed auth' },
  { class: 'bee', name: 'refactor-bee', def: 'Performs code refactoring and codemods' },
  { class: 'bee', name: 'deployment-bee', def: 'Deploys services to cloud run' },
];
// TEST DOUBLE only: a fixed-vocab 0/1 embedder so cosine is deterministic. Not a production path.
const VOCAB = ['security', 'audit', 'secrets', 'auth', 'refactor', 'code', 'codemod', 'deploy', 'cloud', 'run', 'monitoring', 'review'];
const mockEmbedder = { async embed(texts) { return texts.map((t) => { const s = new Set(tokenize(t)); return VOCAB.map((w) => (s.has(w) ? 1 : 0)); }); } };

test('semanticScore: aligned vectors score high, orthogonal score zero', () => {
  assert.ok(semanticScore([1, 0, 1], [1, 0, 1]) > 0.5);
  assert.equal(semanticScore([1, 0, 0], [0, 1, 0]), 0);
});

test('assignWeighted uses CSL-cosine when an embedder + role vectors exist', async () => {
  const roles = await embedRoles(loadRoles({ vars: VARS }), mockEmbedder);
  assert.ok(roles.every((r) => Array.isArray(r.vector)), 'roles embedded');
  const out = await assignWeighted('security audit of secrets', roles, { embedder: mockEmbedder, topN: 3 });
  assert.equal(out.mode, 'semantic-csl');
  assert.ok(['security-bee', 'Sentinel'].includes(out.ranked[0].role), `security task → security role (got ${out.ranked[0].role})`);
});

test('falls back to lexical when no embedder', async () => {
  const roles = loadRoles({ vars: VARS });
  const out = await assignWeighted('deploy to cloud run', roles, {});
  assert.equal(out.mode, 'lexical');
  assert.equal(out.ranked[0].role, 'deployment-bee');
});

test('semantic assignment is deterministic', async () => {
  const roles = await embedRoles(loadRoles({ vars: VARS }), mockEmbedder);
  const a = await assignWeighted('refactor the code with a codemod', roles, { embedder: mockEmbedder });
  const b = await assignWeighted('refactor the code with a codemod', roles, { embedder: mockEmbedder });
  assert.deepEqual(a, b);
  assert.equal(a.ranked[0].role, 'refactor-bee');
});
