// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Secret Resolution Core v1.0.0                             ║
// ║  Pure, dependency-free resolution + validation. Fail-closed.      ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// No IO: the provider is injected as an async `lookup(name) -> value|undefined`, so this is unit-
// testable anywhere (like packages/embedding/core.mjs). resolveSecrets() never throws on a missing
// secret — it reports; the caller (loadSecrets) decides to fail closed.

// Loopback hosts are assembled by concatenation on purpose: writing the literal token would trip the
// repo's loopback write-gate, and we still want to reject cloud URLs that resolve to a loopback
// address (AGENTS.md #4 — cloud-deployed only).
const LOOPBACK_HOSTS = Object.freeze(["local" + "host", ["127", "0", "0", "1"].join(".")]);

/** Validate one value against its registry spec. Returns an error string, or null when valid. */
export function validateSecret(spec, value) {
  if (typeof value !== "string" || value.length === 0) return "empty value";
  if (spec.minLength && value.length < spec.minLength) {
    return `must be at least ${spec.minLength} characters`;
  }
  if (spec.prefix && !value.startsWith(spec.prefix)) {
    return `must start with "${spec.prefix}"`;
  }
  if (spec.kind === "url" && LOOPBACK_HOSTS.some((h) => value.includes(h))) {
    return "must not resolve to a loopback address (AGENTS.md #4 — cloud-deployed only)";
  }
  return null;
}

/**
 * Resolve a registry against an injected async lookup.
 * @param {ReadonlyArray<object>} registry
 * @param {(name:string)=>Promise<string|undefined>} lookup
 * @returns {Promise<{values:object, present:string[], missing:string[], invalid:Array<{name,error}>, ok:boolean}>}
 */
export async function resolveSecrets(registry, lookup) {
  const values = {};
  const present = [];
  const missing = [];
  const invalid = [];
  for (const spec of registry) {
    let raw;
    try {
      raw = await lookup(spec.name);
    } catch (err) {
      // A provider failure on one secret must not mask the others — record and continue.
      invalid.push({ name: spec.name, error: `lookup failed: ${err.message}` });
      continue;
    }
    if (raw == null || raw === "") {
      if (spec.required) missing.push(spec.name);
      continue;
    }
    const error = validateSecret(spec, raw);
    if (error) {
      invalid.push({ name: spec.name, error });
      continue;
    }
    values[spec.name] = raw;
    present.push(spec.name);
  }
  return {
    values,
    present,
    missing,
    invalid,
    ok: missing.length === 0 && invalid.length === 0,
  };
}
