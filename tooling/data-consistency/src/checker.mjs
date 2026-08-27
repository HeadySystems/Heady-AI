// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Data-Consistency Checker v1.0.0                           ║
// ║  Pure invariant engine: token gates + structural cross-ref checks ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Pure functions only (no IO) so the gate is unit-testable like
// packages/embedding/src/core.mjs. The CLI and the sync system both call
// runChecks() — there is exactly one validation path in the system.
//
// A finding: { invariant, severity, file, line, column, excerpt, message, authority, fix }

/**
 * Apply one banned/allow token invariant to a single file's content.
 * `allow` (when present) is tested against the matched LINE — if it matches,
 * the hit is legitimate context (e.g. "Qdrant dropped") and is skipped.
 */
// Translate a leading inline-flag marker like "(?i)" into JS RegExp flags,
// since JavaScript does not support inline flag groups.
function compile(pattern, baseFlags) {
  let flags = baseFlags;
  let src = pattern;
  const m = src.match(/^\(\?([a-z]+)\)/);
  if (m) {
    for (const ch of m[1]) if (!flags.includes(ch)) flags += ch;
    src = src.slice(m[0].length);
  }
  return new RegExp(src, flags);
}

function scanTokens(file, invariant, forcedSeverity) {
  const findings = [];
  let banned;
  let allow = null;
  try {
    banned = compile(invariant.banned, "g");
    if (invariant.allow) allow = compile(invariant.allow, "");
  } catch (err) {
    throw new Error(`invariant ${invariant.id}: invalid regex — ${err.message}`);
  }
  const lines = file.content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (allow && allow.test(line)) continue;
    banned.lastIndex = 0;
    let m;
    while ((m = banned.exec(line)) !== null) {
      findings.push({
        invariant: invariant.id,
        severity: forcedSeverity ?? invariant.severity,
        file: file.rel,
        line: i + 1,
        column: m.index + 1,
        excerpt: line.trim().slice(0, 200),
        message: invariant.message,
        authority: invariant.authority,
        fix: invariant.fix ?? null,
      });
      if (m.index === banned.lastIndex) banned.lastIndex++;
    }
  }
  return findings;
}

/**
 * Token-invariant pass across both file sets. Hits in extended-only scope
 * (e.g. migrated .agents legacy reference) are downgraded to "warn" so legacy
 * drift is reported without blocking the canonical gate.
 */
export function runTokenInvariants(fileSets, invariants) {
  const findings = [];
  for (const inv of invariants) {
    const applies = new Set(inv.appliesTo ?? ["canonical"]);
    if (applies.has("canonical")) {
      for (const f of fileSets.canonical) findings.push(...scanTokens(f, inv, null));
    }
    if (applies.has("extended")) {
      const downgrade = inv.severity === "error" ? "warn" : inv.severity;
      for (const f of fileSets.extended) findings.push(...scanTokens(f, inv, downgrade));
    }
  }
  return findings;
}

/**
 * Structural cross-reference checks. `repo` carries the discovered facts:
 *   { adrFiles:[{rel}], allFiles:Set<rel>, fileExists(rel):bool,
 *     planningDocs:[rel], taskSources:[{taskId, source, resolved:bool, where}],
 *     supersededDocs:[{rel, content}] }
 */
export function runStructuralChecks(repo, structural) {
  const findings = [];

  if (structural.adrUniqueNumbers) {
    const seen = new Map();
    for (const adr of repo.adrFiles) {
      const num = (adr.rel.match(/(\d{4})-/) || [])[1];
      if (!num) continue;
      if (seen.has(num)) {
        findings.push({
          invariant: "ADR-UNIQUE-NUMBERS",
          severity: "error",
          file: adr.rel,
          line: 1,
          column: 1,
          excerpt: `duplicate ADR number ${num} (also ${seen.get(num)})`,
          message: `ADR number ${num} is used by more than one file. ADR numbers must be globally unique.`,
          authority: "docs/adr/README.md (one decision per file)",
          fix: null,
        });
      } else {
        seen.set(num, adr.rel);
      }
    }
  }

  for (const sup of repo.supersededDocs ?? []) {
    const re = new RegExp(structural.supersededBannerPattern, "i");
    if (!re.test(sup.content)) {
      findings.push({
        invariant: "SUPERSEDED-BANNER",
        severity: "error",
        file: sup.rel,
        line: 1,
        column: 1,
        excerpt: "no SUPERSEDED banner found in document head",
        message:
          "A superseded document must carry a visible SUPERSEDED banner so it is never built from as current.",
        authority: "SOURCE_OF_TRUTH.md (canonical planning documents)",
        fix: null,
      });
    }
  }

  if (structural.planningDocsMustExist) {
    for (const ref of repo.planningDocs ?? []) {
      if (!repo.fileExists(ref.rel)) {
        findings.push({
          invariant: "PLANNING-DOC-RESOLVES",
          severity: "error",
          file: ref.from,
          line: ref.line ?? 1,
          column: 1,
          excerpt: `referenced planning doc not found: ${ref.rel}`,
          message: `${ref.from} references planning document "${ref.rel}" which does not exist on disk.`,
          authority: "SOURCE_OF_TRUTH.md",
          fix: null,
        });
      }
    }
  }

  if (structural.taskSourcesMustResolve) {
    for (const t of repo.taskSources ?? []) {
      if (!t.resolved) {
        findings.push({
          invariant: "TASK-SOURCE-RESOLVES",
          severity: "warn",
          file: t.configRel,
          line: t.line ?? 1,
          column: 1,
          excerpt: `task ${t.taskId} source "${t.source}" not found in rebuild or legacy build`,
          message: `Task ${t.taskId} cites source "${t.source}" which could not be located in the rebuild or the current Heady build. Provenance is dangling — sync the source or correct the reference.`,
          authority: "configs/*-tasks.json provenance",
          fix: null,
        });
      }
    }
  }

  return findings;
}

/** Severity ordering for sorting/summary. */
const SEV_RANK = { error: 0, warn: 1, info: 2 };

/** Full run: token + structural, sorted, with a summary. */
export function runChecks(fileSets, invariants, repo, structural) {
  const findings = [
    ...runTokenInvariants(fileSets, invariants),
    ...runStructuralChecks(repo, structural),
  ];
  findings.sort(
    (a, b) =>
      (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );
  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  return {
    findings,
    summary: {
      errors,
      warns,
      total: findings.length,
      filesCanonical: fileSets.canonical.length,
      filesExtended: fileSets.extended.length,
      ok: errors === 0,
    },
  };
}
