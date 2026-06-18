// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Derive — canonical value resolver                         ║
// ║  Builds the flat dot-key map of authoritative values that may be   ║
// ║  injected into files. Reads ONLY from the single sources of truth  ║
// ║  (facts.yaml via @heady/config + lexicon.yaml) — never hardcodes.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadFacts, parseYaml } from "../../../packages/config/src/index.mjs";

const ROOT = resolve(new URL("../../..", import.meta.url).pathname);

/** Flatten nested objects to dot-keys: {a:{b:1}} → {"a.b":1}. Arrays → joined + .count. */
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      out[key] = v.join(", ");
      out[`${key}.count`] = String(v.length);
    } else if (v && typeof v === "object") {
      flatten(v, key, out);
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

/**
 * Resolve the canonical value map. Namespaces:
 *   facts.*    — every key in facts.yaml (the golden record)
 *   lexicon.*  — agents/bees/terms counts from lexicon.yaml
 * Add a source here to widen what can be injected; values are always READ, never authored.
 */
export function resolveCanon() {
  const canon = {};
  // facts.yaml — the golden record
  Object.assign(canon, flatten(loadFacts(), "facts"));
  // lexicon.yaml — named-entity counts (agents/bees/terms)
  try {
    const lex = parseYaml(readFileSync(resolve(ROOT, "lexicon.yaml"), "utf8"));
    for (const ns of ["agents", "bees", "terms"]) {
      const n = lex?.[ns] && typeof lex[ns] === "object" ? Object.keys(lex[ns]).length : 0;
      if (n) canon[`lexicon.${ns}.count`] = String(n);
    }
  } catch { /* lexicon optional */ }
  return canon;
}

/** Look up one canonical value or throw (fail-closed — never inject an unknown key). */
export function canonValue(key, canon = resolveCanon()) {
  if (!(key in canon)) {
    throw new Error(`heady-derive: unknown canon key "${key}" (not in facts.yaml/lexicon.yaml)`);
  }
  return canon[key];
}
