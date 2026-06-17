// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Consistency Bus — Link Index (LinkIndexPort) v1.0.0       ║
// ║  The runtime view of HeadyRegistry: every registered key → its     ║
// ║  canonical value, class, source-of-truth, and lock status.         ║
// ║  Sourced from the generated variable-registry (no hand authoring). ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
// Locked classes carry a canonical value that ingress may not silently override.
const LOCKED = new Set(['fact', 'constant', 'secret']);
const INDEXED = new Set(['fact', 'constant', 'env', 'secret']);

/** Build the link index from a variable-registry.json (HeadyRegistry). */
export function loadLinkIndex({ registryPath, vars } = {}) {
  const list = vars || JSON.parse(readFileSync(registryPath || join(ROOT, '.data', 'coherence', 'variable-registry.json'), 'utf8')).vars;
  const byName = new Map();
  const bySeg = new Map();
  for (const v of list) {
    if (!INDEXED.has(v.class)) continue;
    const entry = { name: v.name, value: v.value, class: v.class, sot: v.sot, locked: LOCKED.has(v.class) };
    byName.set(v.name, entry);
    const seg = String(v.name).split('.').pop();
    bySeg.set(seg, bySeg.has(seg) ? null : entry); // null marks an ambiguous segment
  }
  return { byName, bySeg, size: byName.size };
}

/** Resolve a payload key (dotted path or bare key) to a registered entry, or null. */
export function lookup(index, key) {
  if (index.byName.has(key)) return index.byName.get(key);
  const seg = String(key).split('.').pop();
  return index.bySeg.get(seg) || null; // null = absent or ambiguous (won't guess)
}
