// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Awareness — Test Suite v1.0.0                            ║
// ║  Pure-unit coverage of the squash clusterer, the context          ║
// ║  snapshot shape, the state store, and git introspection against   ║
// ║  the live repo (read-only). © 2026 HeadySystems Inc.              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { commitType, scopeOf, cosineTF } from "../src/squash.mjs";
import { openState, STATE_FILES } from "../src/state.mjs";
import { buildContextSnapshot, CONTEXT_SCHEMA } from "../src/context.mjs";
import * as g from "../src/git.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const VM_DIR = join(REPO_ROOT, ".data", "vector-memory");

function tmp() {
  return mkdtempSync(join(tmpdir(), "heady-awareness-"));
}

test("commitType parses conventional prefixes; defaults to chore", () => {
  assert.equal(commitType("feat(awareness): add service"), "feat");
  assert.equal(commitType("fix: null guard"), "fix");
  assert.equal(commitType("feat!: breaking"), "feat");
  assert.equal(commitType("just a message"), "chore");
});

test("scopeOf resolves package/app/tool names, else top dir", () => {
  assert.equal(scopeOf("packages/consistency-bus/src/index.mjs"), "consistency-bus");
  assert.equal(scopeOf("tooling/awareness/src/cli.mjs"), "awareness");
  assert.equal(scopeOf("apps/headyme-portal/src/x.js"), "headyme-portal");
  assert.equal(scopeOf("docs/adr/0001.md"), "docs");
  assert.equal(scopeOf("AGENTS.md"), "AGENTS.md");
});

test("cosineTF: identical bags = 1, disjoint = 0, symmetric", () => {
  const a = new Map([["x", 1], ["y", 2]]);
  const b = new Map([["x", 1], ["y", 2]]);
  const c = new Map([["z", 5]]);
  assert.ok(Math.abs(cosineTF(a, b) - 1) < 1e-9);
  assert.equal(cosineTF(a, c), 0);
  assert.equal(cosineTF(a, c), cosineTF(c, a));
});

test("state store round-trips, bumps counters, persists context + squash", () => {
  const dir = tmp();
  try {
    const s = openState(dir);
    assert.equal(s.readState().counters.reactions, 0);
    s.mergeState({ lastSeenHead: "abc123" });
    assert.equal(s.readState().lastSeenHead, "abc123");
    s.bump({ reactions: 1, jobsEnqueued: 5 });
    s.bump({ reactions: 1 });
    const st = s.readState();
    assert.equal(st.counters.reactions, 2);
    assert.equal(st.counters.jobsEnqueued, 5);

    s.writeContext({ schema: CONTEXT_SCHEMA, ok: true });
    assert.equal(s.readContext().ok, true);
    s.writeSquash({ noop: true });
    assert.equal(s.readSquash().noop, true);
    // counters survive an unrelated merge (deep-merge guarantee)
    s.mergeState({ running: true });
    assert.equal(s.readState().counters.reactions, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("git introspection is fail-closed (never throws) on the live repo", () => {
  assert.equal(g.isGitRepo(REPO_ROOT), true);
  assert.equal(typeof g.head(REPO_ROOT), "string");
  // a bogus ref must return a structured non-ok result, not throw
  const r = g.git(REPO_ROOT, ["rev-parse", "definitely-not-a-ref-zzz"]);
  assert.equal(r.ok, false);
  assert.ok(Array.isArray(g.log(REPO_ROOT, undefined, 3)));
  assert.deepEqual(g.changedFiles(REPO_ROOT, null), []); // cold start → empty
});

test("git.log returns structured commits with files", () => {
  const commits = g.log(REPO_ROOT, undefined, 3);
  assert.ok(commits.length >= 1);
  for (const c of commits) {
    assert.match(c.sha, /^[0-9a-f]{40}$/);
    assert.equal(typeof c.subject, "string");
    assert.ok(Array.isArray(c.files));
  }
});

test("buildContextSnapshot returns a versioned, honest snapshot", () => {
  const snap = buildContextSnapshot({
    repoRoot: REPO_ROOT,
    vectorMemoryDir: VM_DIR,
    nowIso: "2026-06-16T00:00:00.000Z",
    sinceHead: null,
  });
  assert.equal(snap.schema, CONTEXT_SCHEMA);
  assert.equal(snap.generatedAt, "2026-06-16T00:00:00.000Z");
  assert.equal(typeof snap.repo.head, "string");
  assert.ok("embedderBound" in snap.vectorMemory);
  assert.ok("vectorsLive" in snap.vectorMemory);
  // honesty invariant: vectors cannot be "live" without an embedder bound
  assert.equal(snap.vectorMemory.vectorsLive, snap.vectorMemory.embedderBound);
  assert.ok("fresh" in snap.currency);
});
