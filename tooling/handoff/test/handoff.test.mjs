// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Agent Handoff — pure core tests. `node --test`           ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadCheckpoint, nextCheckpoint, parseNameStatus, parseCommits, summarizeFiles, renderBundle,
  CHECKPOINT_SCHEMA, FIELD_SEP,
} from "../src/core.mjs";

test("loadCheckpoint returns null for absent/invalid, parses valid", () => {
  assert.equal(loadCheckpoint(null), null);
  assert.equal(loadCheckpoint("not json"), null);
  assert.equal(loadCheckpoint(JSON.stringify({ schema: "wrong", head: "x" })), null);
  const cp = loadCheckpoint(JSON.stringify({ schema: CHECKPOINT_SCHEMA, head: "abc123" }));
  assert.equal(cp.head, "abc123");
});

test("nextCheckpoint advances head, records previous, increments runCount", () => {
  const prev = { schema: CHECKPOINT_SCHEMA, head: "old", runCount: 2 };
  const next = nextCheckpoint("new", "2026-06-17T00:00:00Z", prev);
  assert.equal(next.head, "new");
  assert.equal(next.previousHead, "old");
  assert.equal(next.runCount, 3);
  assert.equal(next.schema, CHECKPOINT_SCHEMA);
});

test("parseNameStatus handles A/M/D and renames", () => {
  const text = "A\tpackages/x/new.mjs\nM\tAGENTS.md\nD\told.txt\nR100\tsrc/a.mjs\tsrc/b.mjs";
  const files = parseNameStatus(text);
  assert.deepEqual(files[0], { status: "A", path: "packages/x/new.mjs" });
  assert.deepEqual(files[1], { status: "M", path: "AGENTS.md" });
  assert.deepEqual(files[2], { status: "D", path: "old.txt" });
  assert.deepEqual(files[3], { status: "R", from: "src/a.mjs", path: "src/b.mjs" });
});

test("parseCommits splits FIELD_SEP records", () => {
  const line = ["abc123", "feat: thing", "Eric", "2026-06-17"].join(FIELD_SEP);
  const [c] = parseCommits(line);
  assert.equal(c.sha, "abc123");
  assert.equal(c.subject, "feat: thing");
  assert.equal(c.author, "Eric");
});

test("summarizeFiles groups and counts by status", () => {
  const s = summarizeFiles([{ status: "A", path: "a" }, { status: "A", path: "b" }, { status: "M", path: "c" }]);
  assert.equal(s.total, 3);
  assert.equal(s.counts.A, 2);
  assert.equal(s.counts.M, 1);
});

test("renderBundle produces all 7 sections and reflects verification", () => {
  const md = renderBundle({
    nowIso: "2026-06-17T12:00:00Z", head: "deadbeef", headShort: "deadbee", branch: "rebuild",
    sinceRef: "cafe", sinceShort: "cafe", firstRun: false,
    commits: [{ sha: "abc", subject: "feat: x", author: "Eric" }],
    files: [{ status: "A", path: "packages/new.mjs" }, { status: "M", path: "AGENTS.md" }],
    stat: " 2 files changed", uncommitted: ["wip.mjs"],
    verification: [{ name: "law-lint", ok: true, detail: "clean" }, { name: "coherence", ok: false, detail: "2 contradictions" }],
    contextFiles: [{ path: "AGENTS.md", exists: true, note: "rules" }],
  });
  for (const h of ["# Heady Agent Handoff", "## 1. TL;DR", "## 2. Commits", "## 3. Files changed",
    "## 4. Verification", "## 5. Context to read", "## 6. Open threads", "## 7. Checkpoint"]) {
    assert.ok(md.includes(h), `missing section: ${h}`);
  }
  assert.ok(md.includes("packages/new.mjs"), "lists added file");
  assert.ok(md.includes("coherence** failing"), "surfaces failing gate in open threads");
  assert.ok(md.includes("wip.mjs"), "surfaces uncommitted file");
  assert.ok(md.includes("deadbee"), "shows new checkpoint head");
});

test("renderBundle marks first-run baseline", () => {
  const md = renderBundle({
    nowIso: "t", head: "h", headShort: "h", branch: "b", firstRun: true,
    commits: [], files: [], verification: [], contextFiles: [], uncommitted: [],
  });
  assert.ok(md.includes("first run") || md.includes("baseline"), "notes baseline on first run");
});

test("extractFiles pulls paths from enforcer JSON and path:line forms", async () => {
  const { extractFiles } = await import("../src/core.mjs");
  const a = extractFiles('{"enforcer":"glass-box","file":"apps/x/index.ts","line":92}');
  assert.ok(a.includes("apps/x/index.ts"));
  const b = extractFiles("  /tooling/handoff/src/core.mjs:12 [esm-only] msg");
  assert.ok(b.includes("tooling/handoff/src/core.mjs"));
  assert.deepEqual(extractFiles("no files here"), []);
});

test("classifyScope distinguishes dirty-tree from committed failures", async () => {
  const { classifyScope } = await import("../src/core.mjs");
  const dirty = new Set(["facts.yaml", "apps/x/index.ts"]);
  assert.equal(classifyScope('{"file":"facts.yaml"}', dirty), "dirty");
  assert.equal(classifyScope('{"file":"packages/committed.mjs"}', dirty), "committed");
  assert.equal(classifyScope('{"file":"facts.yaml"} and {"file":"packages/c.mjs"}', dirty), "mixed");
  assert.equal(classifyScope("no path cited", dirty), "unknown");
});

test("renderBundle separates dirty-tree (transient) from committed failures", async () => {
  const { renderBundle } = await import("../src/core.mjs");
  const md = renderBundle({
    nowIso: "t", head: "h", headShort: "h", branch: "rebuild", firstRun: false, sinceShort: "s",
    commits: [], files: [], contextFiles: [], uncommitted: ["facts.yaml"],
    verification: [
      { name: "coherence", ok: false, scope: "dirty", detail: '{"file":"facts.yaml"}' },
      { name: "law-lint", ok: false, scope: "committed", detail: "packages/x.mjs:1 bad" },
      { name: "governance", ok: true, detail: "ok" },
    ],
  });
  assert.ok(md.includes("Tree state:** ⚠️ DIRTY"), "flags dirty tree in TL;DR");
  assert.ok(md.includes("Needs attention (committed / real)"), "real bucket present");
  assert.ok(md.includes("Likely transient (dirty-tree"), "transient bucket present");
  assert.ok(/coherence\*\* cites uncommitted/.test(md), "coherence is in transient bucket");
});
