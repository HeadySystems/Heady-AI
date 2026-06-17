// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Perspective tests                                         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoles, levelFor, sourceLevels, assign, train } from '../src/index.mjs';

const VARS = [
  { class: 'fact', name: 'embedding.dim', value: '384', sot: 'facts.yaml', def: '' },
  { class: 'term', name: 'CSL', value: '', sot: 'docs/compendium/01', def: 'Continuous Semantic Logic geometric vector logic gates' },
  { class: 'agent', name: 'Sentinel', value: '', sot: 'heady-agent-orchestration', def: 'Monitoring and security watch observes health anomalies and threats' },
  { class: 'agent', name: 'Execution', value: '', sot: 'heady-agent-orchestration', def: 'Task execution carries out planned work units and reports results' },
  { class: 'bee', name: 'security-bee', value: '', sot: 'agent: security-bee', def: 'Security review secrets fail-closed auth' },
  { class: 'bee', name: 'refactor-bee', value: '', sot: 'heady-bee-swarm-ops', def: 'Performs code refactoring and codemods' },
  { class: 'skill', name: 'heady-security-audit', value: '', sot: '.claude/skills', def: 'security audit vulnerability scanning' },
  { class: 'env', name: 'CODEFLOW_ORIGIN', value: '*', sot: 'registry', def: 'allowed origin' },
];

test('perspective level is authority-biased (canonical highest, legacy lowest)', () => {
  const fact = levelFor({ class: 'fact', sot: 'facts.yaml' });
  const skill = levelFor({ class: 'skill', sot: '.claude/skills' });
  const stale = levelFor({ class: 'term', sot: 'legacy/_archive/old.md' });
  assert.ok(fact > skill, 'a fact outweighs a skill');
  assert.ok(skill > stale, 'a current skill outweighs a stale/legacy source');
  assert.ok(fact <= 1 && stale >= 0, 'levels are clamped');
});

test('every defined role weighs in (agents/bees/skills), with kind weights', () => {
  const roles = loadRoles({ vars: VARS });
  const kinds = new Set(roles.map((r) => r.kind));
  assert.deepEqual([...kinds].sort(), ['agent', 'bee', 'skill']);
  assert.equal(roles.find((r) => r.id === 'Execution').weight, 0.9);
  assert.equal(roles.find((r) => r.id === 'security-bee').weight, 0.7);
});

test('task assignment corresponds to competency × perspective weight', () => {
  const roles = loadRoles({ vars: VARS });
  const sec = assign('security audit and secrets scanning', roles);
  assert.ok(['Sentinel', 'security-bee', 'heady-security-audit'].includes(sec[0].role), `security task → a security role (got ${sec[0].role})`);
  const ref = assign('refactor the code with a codemod', roles);
  assert.equal(ref[0].role, 'refactor-bee', 'refactor task → refactor-bee');
});

test('assignment is deterministic', () => {
  const roles = loadRoles({ vars: VARS });
  assert.deepEqual(assign('security audit', roles), assign('security audit', roles));
});

test('hc-train calibrates deterministically from ground truth', () => {
  const a = train({ vars: VARS });
  const b = train({ vars: VARS });
  assert.equal(a.hash, b.hash, 'same registry ⇒ same profile hash');
  assert.equal(a.counts.roles, 5);
  assert.ok(a.sources.length === VARS.length, 'every source gets a perspective level');
});
