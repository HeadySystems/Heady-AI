// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Stage 0 tests — node:test, zero deps                      ║
// ║  Arms the central gate; the CODEOWNERS matcher + manifest schema    ║
// ║  get facts.v1-grade rigor so a STAGE0 exit-2 never misfires.        ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseCodeownersPatterns, isCodeownerCovered, validateUntouchables, checkStage0,
} from "../src/stage0.mjs";

// A realistic CODEOWNERS slice (comments, blanks, team tokens, leading slashes).
const CODEOWNERS = `# HEADY CODEOWNERS
/.github/CODEOWNERS                   @HeadyMe/core-team

# stage 0
/tooling/coherence/                  @HeadyMe/core-team
/packages/contracts/src/facts-schema.mjs  @HeadyMe/core-team
/.claude/hooks/heady-rules.mjs       @HeadyMe/core-team`;

const PATTERNS = parseCodeownersPatterns(CODEOWNERS);

const okManifest = () => ({
  schema: "stage0-untouchables.v1",
  entries: [
    { role: "codeowners", glob: ".github/CODEOWNERS", present: true },
    { role: "coherence-kernel", glob: "tooling/coherence/", present: true },
    { role: "facts-schema", glob: "packages/contracts/src/facts-schema.mjs", present: true },
    { role: "rule-gate-hook", glob: ".claude/hooks/heady-rules.mjs", present: true },
    { role: "liquid-gateway", glob: "packages/liquid-gateway/", present: false, ref: "Phase 3" },
  ],
});
// Every present glob in okManifest() resolves and is codeowner-covered.
const allResolve = () => true;

test("parseCodeownersPatterns strips comments/blanks/owners and leading slashes", () => {
  assert.deepEqual(PATTERNS, [
    ".github/CODEOWNERS",
    "tooling/coherence/",
    "packages/contracts/src/facts-schema.mjs",
    ".claude/hooks/heady-rules.mjs",
  ]);
});

test("isCodeownerCovered: exact files, owned-dir prefixes, and misses", () => {
  assert.equal(isCodeownerCovered(".github/CODEOWNERS", PATTERNS), true); // exact
  assert.equal(isCodeownerCovered("/tooling/coherence/", PATTERNS), true); // dir==dir, leading slash normalized
  assert.equal(isCodeownerCovered("tooling/coherence/src/coherence.mjs", PATTERNS), true); // file within owned dir
  assert.equal(isCodeownerCovered("tooling/law-lint/", PATTERNS), false); // not owned
  assert.equal(isCodeownerCovered("packages/contracts/src/other.mjs", PATTERNS), false); // sibling not covered by exact-file rule
});

test("validateUntouchables accepts a well-formed manifest", () => {
  const { ok, errors } = validateUntouchables(okManifest());
  assert.equal(ok, true, errors.join("; "));
});

test("validateUntouchables rejects bad schema / empty / malformed / wildcard-when-present", () => {
  assert.match(validateUntouchables({ schema: "x", entries: [{ role: "a", glob: "b", present: true }] }).errors.join(" "), /schema must be/);
  assert.match(validateUntouchables({ schema: "stage0-untouchables.v1", entries: [] }).errors.join(" "), /non-empty array/);
  assert.match(validateUntouchables({ schema: "stage0-untouchables.v1", entries: [{ glob: "b", present: true }] }).errors.join(" "), /role must be/);
  assert.match(validateUntouchables({ schema: "stage0-untouchables.v1", entries: [{ role: "a", glob: "b" }] }).errors.join(" "), /present must be a boolean/);
  // wildcards are only forbidden for ENFORCED (present) entries
  assert.match(validateUntouchables({ schema: "stage0-untouchables.v1", entries: [{ role: "a", glob: "x/*.yml", present: true }] }).errors.join(" "), /no wildcards/);
  assert.equal(validateUntouchables({ schema: "stage0-untouchables.v1", entries: [{ role: "a", glob: "x/*.yml", present: false }] }).ok, true);
});

test("checkStage0 is clean when present globs resolve + are locked + kernel self-included", () => {
  const findings = checkStage0({ manifest: okManifest(), resolves: allResolve, codeownerPatterns: PATTERNS });
  const errors = findings.filter((f) => f.tier === "error");
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.ok(findings.some((f) => f.id === "STAGE0-pending"), "pending role should log info");
});

test("STAGE0-resolve fires when a present glob resolves to nothing", () => {
  const findings = checkStage0({
    manifest: okManifest(),
    resolves: (g) => g !== "packages/contracts/src/facts-schema.mjs",
    codeownerPatterns: PATTERNS,
  });
  assert.ok(findings.some((f) => f.id === "STAGE0-resolve" && f.evidence.glob === "packages/contracts/src/facts-schema.mjs"));
});

test("STAGE0-codeowner fires when a present untouchable is not CODEOWNERS-locked", () => {
  const m = okManifest();
  m.entries.push({ role: "law-lint", glob: "tooling/law-lint/", present: true }); // not in CODEOWNERS slice
  const errs = checkStage0({ manifest: m, resolves: allResolve, codeownerPatterns: PATTERNS }).filter((f) => f.id === "STAGE0-codeowner");
  assert.ok(errs.some((f) => f.evidence.glob === "tooling/law-lint/"));
});

test("STAGE0-self fires when the kernel is absent from its own set", () => {
  const m = okManifest();
  m.entries = m.entries.filter((e) => e.glob !== "tooling/coherence/");
  assert.ok(checkStage0({ manifest: m, resolves: allResolve, codeownerPatterns: PATTERNS }).some((f) => f.id === "STAGE0-self"));
});

test("STAGE0-manifest fires when the manifest is missing", () => {
  assert.ok(checkStage0({ manifest: null, resolves: allResolve, codeownerPatterns: PATTERNS }).some((f) => f.id === "STAGE0-manifest"));
});
