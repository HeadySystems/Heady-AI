// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Stage 0 — agent-untouchable bootstrap enforcement          ║
// ║  Pure logic behind the coherence kernel's STAGE0-* checks: the      ║
// ║  verifier-of-verifiers path-glob (configs/stage0-untouchables.json) ║
// ║  must resolve, be CODEOWNERS-locked, and include the kernel itself. ║
// ║  Realizes STEPWISE §0.8 / ADR-0016. Dependency-free + fully pure    ║
// ║  (all IO injected) so it unit-tests without touching the repo.      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Strip leading slash(es) so CODEOWNERS `/a/b` and manifest `a/b` compare equal. */
const normalize = (p) => String(p).replace(/^\/+/, "");

/**
 * Extract the path patterns from a CODEOWNERS file — the first whitespace token
 * of every non-comment, non-blank line, normalized (leading slash stripped).
 * @param {string} text raw CODEOWNERS contents
 * @returns {string[]}
 */
export function parseCodeownersPatterns(text) {
  return String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => normalize(l.split(/\s+/)[0]))
    .filter(Boolean);
}

/**
 * Is `path` covered by some CODEOWNERS pattern? Enforced Stage 0 globs are exact
 * files or directory prefixes only (validated below), so coverage is a decidable
 * exact-or-prefix test — no glob engine, no false positives.
 * @param {string} path a Stage 0 glob (exact file or dir prefix)
 * @param {string[]} patterns normalized CODEOWNERS patterns
 */
export function isCodeownerCovered(path, patterns) {
  const p = normalize(path);
  return patterns.some((pat) => {
    if (pat === p) return true; // exact match (file or dir==dir)
    if (pat.endsWith("/") && p.startsWith(pat)) return true; // owned dir covers a path within it
    return false;
  });
}

/**
 * Validate the untouchables manifest shape. Enforced (`present:true`) entries may
 * not contain wildcards — that would make CODEOWNERS coverage undecidable and arm
 * a fragile exit-2 on the central gate.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateUntouchables(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") return { ok: false, errors: ["manifest is not an object"] };
  if (manifest.schema !== "stage0-untouchables.v1") {
    errors.push(`manifest.schema must be "stage0-untouchables.v1", got ${JSON.stringify(manifest.schema)}`);
  }
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    errors.push("manifest.entries must be a non-empty array");
  }
  for (const [i, e] of (Array.isArray(manifest.entries) ? manifest.entries : []).entries()) {
    if (typeof e?.role !== "string" || !e.role) errors.push(`entries[${i}].role must be a non-empty string`);
    if (typeof e?.glob !== "string" || !e.glob) errors.push(`entries[${i}].glob must be a non-empty string`);
    if (typeof e?.present !== "boolean") errors.push(`entries[${i}].present must be a boolean`);
    if (e?.present === true && /[*?[\]]/.test(e.glob || "")) {
      errors.push(`entries[${i}].glob (present) must be an exact path or dir prefix, no wildcards: ${e.glob}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Compute the STAGE0-* findings in the coherence kernel's finding shape.
 * IO is injected so this is pure and testable:
 *   manifest         parsed configs/stage0-untouchables.json (or null if absent)
 *   resolves         (glob) => boolean — does the glob resolve to an existing path
 *   codeownerPatterns normalized CODEOWNERS patterns (see parseCodeownersPatterns)
 *   kernelPath       the coherence kernel's own path (self-protection anchor)
 * @returns {Array<{id,tier,kind,msg,evidence}>}
 */
export function checkStage0({ manifest, resolves, codeownerPatterns = [], kernelPath = "tooling/coherence/" }) {
  const findings = [];
  const err = (id, msg, evidence) => findings.push({ id, tier: "error", kind: "contradiction", msg, evidence });
  const info = (id, msg, evidence) => findings.push({ id, tier: "info", kind: "incomplete", msg, evidence });

  if (!manifest) {
    err("STAGE0-manifest", "stage0 untouchables manifest missing or unreadable (STEPWISE §0.8 / ADR-0016)", {});
    return findings;
  }
  const shape = validateUntouchables(manifest);
  if (!shape.ok) {
    for (const e of shape.errors) err("STAGE0-schema", `stage0 manifest invalid: ${e}`, {});
    return findings;
  }

  const present = manifest.entries.filter((e) => e.present);
  for (const e of present) {
    if (!resolves(e.glob)) {
      err("STAGE0-resolve", `stage0 untouchable "${e.role}" glob resolves to nothing (declared-but-absent)`, { glob: e.glob });
    }
    if (!isCodeownerCovered(e.glob, codeownerPatterns)) {
      err("STAGE0-codeowner", `stage0 untouchable "${e.role}" is not CODEOWNERS-locked`, { glob: e.glob });
    }
  }
  for (const e of manifest.entries.filter((x) => !x.present)) {
    info("STAGE0-pending", `stage0 role "${e.role}" declared; path pending (${e.ref || "Phase 3"})`, { glob: e.glob });
  }

  // Self-protection (minimal, per design): the verifier-of-verifiers must live in
  // its own untouchable set and be CODEOWNERS-locked — else the protector is
  // unprotected. Anchored on the kernel path only; no hardcoded required-set.
  const self = present.find((e) => normalize(e.glob) === normalize(kernelPath));
  if (!self) {
    err("STAGE0-self", "the coherence kernel is not declared in its own stage0 untouchable set", { kernelPath });
  } else if (!isCodeownerCovered(kernelPath, codeownerPatterns)) {
    err("STAGE0-self", "the coherence kernel path is not CODEOWNERS-locked", { kernelPath });
  }

  return findings;
}
