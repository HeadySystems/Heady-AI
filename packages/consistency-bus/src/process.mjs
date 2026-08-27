// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Consistency Bus — Processor (ProcessPort) v1.0.0          ║
// ║  Process every ingress/egress payload: recognize registered values,║
// ║  block inbound drift on locked values, normalize outbound to       ║
// ║  canonical. Made with ❤️ by HeadySystems Inc.                      ║
// ╚══════════════════════════════════════════════════════════════════╝
import { lookup } from './link-index.mjs';

function flatten(obj, pfx = '', out = []) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) flatten(v, pfx ? `${pfx}.${k}` : k, out);
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${pfx}.${i}`, out));
  } else {
    out.push({ path: pfx, value: obj });
  }
  return out;
}
function setPath(obj, path, value) {
  const parts = path.split('.'); let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = value;
}
// Preserve the inbound JS type when normalizing (canonical values are strings in the registry).
const coerce = (canonical, like) => (typeof like === 'number' && /^-?\d+(\.\d+)?$/.test(canonical) ? Number(canonical) : typeof like === 'boolean' ? canonical === 'true' : canonical);

/** Classify every registered value found in a payload as MATCH or DRIFT vs canonical. */
export function recognize(payload, index) {
  const findings = [];
  for (const { path, value } of flatten(payload)) {
    const e = lookup(index, path);
    if (!e) continue;
    findings.push({ path, value, canonical: e.value, key: e.name, class: e.class, locked: e.locked, status: String(value) === String(e.value) ? 'MATCH' : 'DRIFT' });
  }
  return findings;
}

/** Ingress: DRIFT on a LOCKED value is BLOCKED fail-closed unless the key is explicitly authorized. */
export function ingressGuard(payload, index, { authorizedKeys = [] } = {}) {
  const findings = recognize(payload, index);
  const blocked = findings.filter((f) => f.status === 'DRIFT' && f.locked && !authorizedKeys.includes(f.key));
  return { verdict: blocked.length ? 'BLOCK' : 'ALLOW', blocked, findings };
}

/**
 * Egress: rewrite any stale linked value to canonical — never emit drift.
 * Rewrites fire ONLY on exact multi-segment dotted paths (byName): a silent
 * rewrite of a generic top-level key would corrupt innocent payloads — found
 * live when the Console summary's `schema: "console-summary.v1"` was rewritten
 * to the golden record's `schema: facts.v1`. Ingress keeps single-segment
 * recognition (blocking is loud + has the authorized-header channel; silent
 * egress corruption has no such escape).
 */
export function egressNormalize(payload, index) {
  const clone = structuredClone(payload);
  const rewrites = [];
  for (const { path, value } of flatten(payload)) {
    if (!path.includes('.') || !index.byName.has(path)) continue;
    const e = index.byName.get(path);
    if (String(value) !== String(e.value)) { setPath(clone, path, coerce(e.value, value)); rewrites.push({ path, from: value, to: e.value }); }
  }
  return { payload: clone, rewrites };
}
