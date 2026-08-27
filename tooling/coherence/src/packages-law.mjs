// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Package-Law checks — frameworks + tests-alongside          ║
// ║  Pure logic behind the coherence kernel's C-framework and TEST-*    ║
// ║  findings. Proves: no workspace manifest depends on a forbidden     ║
// ║  frontend framework (AGENTS.md Do-Not: Vue/Angular), and every      ║
// ║  substrate workspace member (packages/ + tooling/) ships at least   ║
// ║  one test file (AGENTS.md #9) — apps surface as INFO debt pending   ║
// ║  their Phase-3 build-out. Dependency-free + pure (IO injected).     ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

/** AGENTS.md Do-Not list, machine form: Vue/Angular are forbidden outright.
 *  (React's "complex canvas only" scoping stays review-enforced.) */
export const FORBIDDEN_FRAMEWORKS = [/^vue$/, /^@vue\//, /^angular$/, /^@angular\//];

/** Substrate scopes where a missing test is a build-blocking contradiction. */
const ENFORCED_SCOPES = new Set(["packages", "tooling"]);

/**
 * C-framework — no manifest may depend on a forbidden frontend framework.
 * @param {Array<{path:string, dependencies?:object, devDependencies?:object}>} manifests
 * @returns coherence findings (error tier on any hit)
 */
export function checkFrameworks(manifests) {
  const findings = [];
  for (const m of manifests || []) {
    const deps = Object.keys({ ...(m.dependencies || {}), ...(m.devDependencies || {}) });
    for (const dep of deps) {
      if (FORBIDDEN_FRAMEWORKS.some((re) => re.test(dep))) {
        findings.push({
          id: "C-framework", tier: "error", kind: "contradiction",
          msg: `forbidden frontend framework "${dep}" declared as a dependency (AGENTS.md Do-Not: no Vue/Angular)`,
          evidence: { manifest: m.path, dep },
        });
      }
    }
  }
  return findings;
}

/**
 * LAW11-merkle-trigger — the file-embedding path derives from the Merkle
 * planner (ADR-0023) and carries zero Postgres-CDC machinery. DB→derived-store
 * CDC (ADR-0014) is a different concern living outside the file-index path;
 * its appearance HERE is the violation. Pure — IO (file read + grep) injected.
 * @param {object} args
 * @param {boolean} args.plannerImported  embed orchestrator imports planCorpusEmbedding
 * @param {Array<{line:string}>} args.cdcHits  CDC-token grep hits inside the file-index path
 * @returns coherence findings
 */
export function checkMerkleTrigger({ plannerImported, cdcHits = [] }) {
  const findings = [];
  if (!plannerImported) {
    findings.push({
      id: "LAW11-merkle-trigger", tier: "error", kind: "contradiction",
      msg: "file-embed orchestrator no longer derives from the Merkle planner (planCorpusEmbedding, ADR-0023)",
      evidence: { expected: "tooling/embed-corpus/src/embed.mjs imports planCorpusEmbedding" },
    });
  }
  for (const h of cdcHits) {
    findings.push({
      id: "LAW11-cdc-in-file-path", tier: "error", kind: "contradiction",
      msg: "Postgres-CDC machinery inside the file-indexing path (AGENTS.md #11: file indexing triggers via Merkle hashing, never CDC)",
      evidence: { line: String(h.line).slice(0, 140) },
    });
  }
  return findings;
}

/**
 * TEST-missing — every packages/ + tooling/ workspace member must carry at
 * least one test file; apps without tests surface as INFO (visible debt).
 * @param {Array<{dir:string, scope:string, hasTestFile:boolean}>} members
 * @returns coherence findings
 */
export function checkTestsAlongside(members) {
  const findings = [];
  for (const m of members || []) {
    if (m.hasTestFile) continue;
    if (ENFORCED_SCOPES.has(m.scope)) {
      findings.push({
        id: "TEST-missing", tier: "error", kind: "contradiction",
        msg: `workspace member ${m.scope}/${m.dir} ships no test file (AGENTS.md #9: tests alongside code)`,
        evidence: { member: `${m.scope}/${m.dir}` },
      });
    } else {
      findings.push({
        id: "TEST-missing-app", tier: "info", kind: "incomplete",
        msg: `app ${m.scope}/${m.dir} ships no test file yet (surfaced debt — enforcement lands with its Phase-3 build-out)`,
        evidence: { member: `${m.scope}/${m.dir}` },
      });
    }
  }
  return findings;
}
