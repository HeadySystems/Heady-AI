// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Perspective — Source Levels (PerspectivePort) v1.0.0      ║
// ║  Assign a perspective level (weight ∈ [0,1]) to every source — the  ║
// ║  authority bias. Canonical sources (facts/AGENTS/ADR/SoT) weigh     ║
// ║  most; legacy/stale least. Auditable, never arbitrary.             ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
// Base level by class — locked canonical values carry the strongest bias.
const CLASS_LEVEL = { fact: 1.0, constant: 0.95, secret: 0.9, decision: 0.85, agent: 0.9, bee: 0.7, env: 0.7, term: 0.65, skill: 0.6 };
// Source-of-truth authority modifiers (provenance bias).
const HIGH_AUTHORITY = /facts\.yaml|AGENTS\.md|SOURCE_OF_TRUTH|docs\/adr|lexicon\.yaml|packages\//i;
const LOW_AUTHORITY = /legacy|_archive|dropzone|OPTIMAL_REBUILD_PLAN|status|snapshot|stale/i;

const clamp = (n) => Math.max(0, Math.min(1, Number(n.toFixed(4))));

/** Perspective level for one registry entry. */
export function levelFor(entry) {
  let lvl = CLASS_LEVEL[entry.class] ?? 0.5;
  const sot = String(entry.sot || '');
  if (HIGH_AUTHORITY.test(sot)) lvl += 0.05;
  if (LOW_AUTHORITY.test(sot)) lvl -= 0.2;
  return clamp(lvl);
}

/** Perspective level for every source in the registry → [{ key, class, sot, level }]. */
export function sourceLevels({ registryPath, vars } = {}) {
  const list = vars || JSON.parse(readFileSync(registryPath || join(ROOT, '.data', 'coherence', 'variable-registry.json'), 'utf8')).vars;
  return list
    .map((v) => ({ key: v.name, class: v.class, sot: v.sot, level: levelFor(v) }))
    .sort((a, b) => b.level - a.level || a.key.localeCompare(b.key));
}
