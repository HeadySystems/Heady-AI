// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Consistency Bus — Link Index (LinkIndexPort) v1.0.0       ║
// ║  The runtime view of HeadyRegistry: every registered key → its     ║
// ║  canonical value, class, source-of-truth, and lock status.         ║
// ║  Sourced from the generated variable-registry (no hand authoring). ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadFacts } from '@heady/config';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
// Locked classes carry a canonical value that ingress may not silently override.
const LOCKED = new Set(['fact', 'constant', 'secret']);
const INDEXED = new Set(['fact', 'constant', 'env', 'secret']);

/**
 * Fallback source: the COMMITTED golden record (facts.yaml, validated against
 * facts.v1 by @heady/config). The generated variable-registry lives under the
 * gitignored .data/ dir and is ABSENT in a fresh prod deploy — without this
 * floor the bus would enter passthrough mode and fail OPEN in production. Every
 * fact leaf is a LOCKED entry, matching the coherence kernel's `class: 'fact'`
 * derivation, so runtime ingress drift on a golden value is blocked in prod too.
 */
function factEntries() {
  const out = [];
  const walk = (obj, pfx = '') => {
    for (const [k, v] of Object.entries(obj)) {
      const name = pfx ? `${pfx}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, name);
      else out.push({ class: 'fact', name, value: Array.isArray(v) ? v.join(', ') : String(v), sot: 'facts.yaml' });
    }
  };
  walk(loadFacts());
  return out;
}

/**
 * Build the link index from a variable-registry.json (HeadyRegistry). If the
 * generated registry is unreadable (e.g. gitignored .data/ absent in prod), fall
 * back to the committed golden record so enforcement stays LIVE, never fail-open.
 */
export function loadLinkIndex({ registryPath, vars } = {}) {
  let list; let source;
  if (vars) {
    list = vars; source = 'provided';
  } else {
    try {
      list = JSON.parse(readFileSync(registryPath || join(ROOT, '.data', 'coherence', 'variable-registry.json'), 'utf8')).vars;
      source = 'generated-registry';
    } catch {
      list = factEntries(); source = 'facts.yaml-fallback';
    }
  }
  const byName = new Map();
  const bySeg = new Map();
  for (const v of list) {
    if (!INDEXED.has(v.class)) continue;
    const entry = { name: v.name, value: v.value, class: v.class, sot: v.sot, locked: LOCKED.has(v.class) };
    byName.set(v.name, entry);
    const seg = String(v.name).split('.').pop();
    bySeg.set(seg, bySeg.has(seg) ? null : entry); // null marks an ambiguous segment
  }
  return { byName, bySeg, size: byName.size, source };
}

/** Resolve a payload key (dotted path or bare key) to a registered entry, or null. */
export function lookup(index, key) {
  if (index.byName.has(key)) return index.byName.get(key);
  const seg = String(key).split('.').pop();
  return index.bySeg.get(seg) || null; // null = absent or ambiguous (won't guess)
}
