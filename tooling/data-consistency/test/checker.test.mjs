// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Data-Consistency Tests v1.0.0                            ║
// ║  node:test, zero deps — runs with `node --test test/`             ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  runTokenInvariants,
  runStructuralChecks,
  runChecks,
} from "../src/checker.mjs";
import { transform, skillNameFromFile } from "../src/sync.mjs";

const QDRANT = {
  id: "QDRANT-DROPPED",
  severity: "error",
  appliesTo: ["canonical", "extended"],
  authority: "ADR-0003",
  banned: "\\bQdrant\\b",
  allow: "(?i)(drop|supersed|no\\s+Qdrant|zero\\s+Qdrant)",
  message: "Qdrant is dropped.",
  fix: null,
};

const EMBED = {
  id: "EMBED-DIM-384",
  severity: "error",
  appliesTo: ["canonical"],
  authority: "ADR-0015",
  banned: "vector\\(\\s*1536\\s*\\)",
  allow: null,
  message: "Use vector(384).",
  fix: "vector(384)",
};

function fileSet(canonical = [], extended = []) {
  return { canonical, extended };
}

test("EMBED-DIM-384 flags vector(1536) in canonical files", () => {
  const fs = fileSet([{ rel: "AGENTS.md", content: "col vector(1536) here" }]);
  const f = runTokenInvariants(fs, [EMBED]);
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "error");
  assert.equal(f[0].line, 1);
  assert.equal(f[0].fix, "vector(384)");
});

test("QDRANT allow-context skips legitimate negation lines", () => {
  const fs = fileSet([
    { rel: "a.md", content: "Qdrant is dropped per R2" },
    { rel: "b.md", content: "no Qdrant in baseline" },
    { rel: "c.md", content: "zero Qdrant here" },
  ]);
  assert.equal(runTokenInvariants(fs, [QDRANT]).length, 0);
});

test("QDRANT flags a live tier reference", () => {
  const fs = fileSet([{ rel: "AGENTS.md", content: "T2 Qdrant (cold, 144h)" }]);
  const f = runTokenInvariants(fs, [QDRANT]);
  assert.equal(f.length, 1);
  assert.equal(f[0].invariant, "QDRANT-DROPPED");
});

test("extended-scope errors are downgraded to warnings", () => {
  const fs = fileSet([], [{ rel: ".agents/x/SKILL.md", content: "Store in Qdrant" }]);
  const f = runTokenInvariants(fs, [QDRANT]);
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "warn");
});

test("structural: duplicate ADR numbers are an error", () => {
  const repo = {
    adrFiles: [
      { rel: "docs/adr/0014-a.md" },
      { rel: "docs/adr/0014-b.md" },
      { rel: "docs/adr/0015-c.md" },
    ],
    supersededDocs: [],
    planningDocs: [],
    taskSources: [],
    fileExists: () => true,
  };
  const f = runStructuralChecks(repo, { adrUniqueNumbers: true });
  assert.equal(f.length, 1);
  assert.equal(f[0].invariant, "ADR-UNIQUE-NUMBERS");
});

test("structural: superseded doc without banner is flagged", () => {
  const repo = {
    adrFiles: [],
    supersededDocs: [{ rel: "docs/OLD.md", content: "no banner here" }],
    planningDocs: [],
    taskSources: [],
    fileExists: () => true,
  };
  const f = runStructuralChecks(repo, { supersededBannerPattern: "supersed" });
  assert.equal(f.length, 1);
  assert.equal(f[0].invariant, "SUPERSEDED-BANNER");
});

test("structural: superseded doc WITH banner passes", () => {
  const repo = {
    adrFiles: [],
    supersededDocs: [{ rel: "docs/OLD.md", content: "Status: Superseded by V2" }],
    planningDocs: [],
    taskSources: [],
    fileExists: () => true,
  };
  assert.equal(runStructuralChecks(repo, { supersededBannerPattern: "supersed" }).length, 0);
});

test("structural: missing planning doc + dangling task source", () => {
  const repo = {
    adrFiles: [],
    supersededDocs: [],
    planningDocs: [{ rel: "docs/GONE.md", from: "SOURCE_OF_TRUTH.md", line: 5 }],
    taskSources: [{ taskId: "SEC-001", source: "x.md", resolved: false, configRel: "configs/t.json", line: 3 }],
    fileExists: () => false,
  };
  const f = runStructuralChecks(repo, {
    planningDocsMustExist: true,
    taskSourcesMustResolve: true,
  });
  const ids = f.map((x) => x.invariant).sort();
  assert.deepEqual(ids, ["PLANNING-DOC-RESOLVES", "TASK-SOURCE-RESOLVES"]);
});

test("runChecks summarizes and sorts errors before warnings", () => {
  const fs = fileSet(
    [{ rel: "AGENTS.md", content: "vector(1536)" }],
    [{ rel: ".agents/s.md", content: "Store in Qdrant" }],
  );
  const repo = { adrFiles: [], supersededDocs: [], planningDocs: [], taskSources: [], fileExists: () => true };
  const r = runChecks(fs, [EMBED, QDRANT], repo, {});
  assert.equal(r.summary.errors, 1);
  assert.equal(r.summary.warns, 1);
  assert.equal(r.summary.ok, false);
  assert.equal(r.findings[0].severity, "error");
});

test("sync transform is idempotent and rewrites legacy tokens", () => {
  const once = transform("see /home/headyme/Heady/x and run npm install");
  assert.match(once, /OPTIMAL BUILD NOTICE/);
  assert.match(once, /\/home\/headyme\/Heady-AI\/x/);
  assert.match(once, /pnpm install/);
  assert.doesNotMatch(once, /home\/headyme\/Heady\/x/);
  const twice = transform(once);
  assert.equal(once, twice, "transform must be idempotent");
});

test("skillNameFromFile strips index prefix and -SKILL suffix", () => {
  assert.equal(skillNameFromFile("23-heady-arena-SKILL.md"), "heady-arena");
  assert.equal(skillNameFromFile("heady-foo.md"), "heady-foo");
});
