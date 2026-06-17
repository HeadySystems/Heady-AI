// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Perspective — Roles (RolePort) v1.0.0                     ║
// ║  The "optimal software company" as weighted roles: the 8 cognitive ║
// ║  agents + bee workers + skills, each with competencies + a base     ║
// ║  perspective weight. Derived from HeadyRegistry (no hand-authoring).║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
// Base perspective weight by role kind — agents lead, bees execute, skills advise.
const KIND_WEIGHT = { agent: 0.9, bee: 0.7, skill: 0.6 };
const STOP = new Set(['the', 'and', 'for', 'with', 'a', 'an', 'of', 'to', 'in', 'on', 'use', 'when', 'via', 'that', 'this', 'its', 'per', 'into', 'across', 'every', 'all', 'or', 'is', 'are', 'as', 'by', 'be']);

export function tokenize(text) {
  return [...new Set(String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t)))];
}

/** Load roles from the variable-registry (classes agent/bee/skill). Every defined role weighs in. */
export function loadRoles({ registryPath, vars } = {}) {
  const list = vars || JSON.parse(readFileSync(registryPath || join(ROOT, '.data', 'coherence', 'variable-registry.json'), 'utf8')).vars;
  return list
    .filter((v) => KIND_WEIGHT[v.class] != null)
    .map((v) => ({ id: v.name, kind: v.class, weight: KIND_WEIGHT[v.class], competencies: tokenize(`${v.name} ${v.def || ''}`), sot: v.sot }))
    .sort((a, b) => a.id.localeCompare(b.id)); // deterministic order
}
