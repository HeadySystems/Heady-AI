// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Source Ledger Tests v1.0.0                             ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSourceSnapshot, commitSourceRevision, reconcileSnapshot } from "../src/index.mjs";

const files = [
  { path: "src/a.mjs", content: "export const a = 1;\n" },
  { path: "docs/a.md", content: "# A\n" },
];

test("source snapshots are deterministic, content-addressed, and path-safe", () => {
  const first = buildSourceSnapshot(files);
  const second = buildSourceSnapshot([...files].reverse());
  assert.equal(first.merkleRoot, second.merkleRoot);
  assert.equal(first.fileCount, 2);
  assert.match(first.files[0].contentSha256, /^[a-f0-9]{64}$/);
  assert.throws(() => buildSourceSnapshot([{ path: "../secret", content: "x" }]), /invalid source path/);
  assert.throws(() => buildSourceSnapshot([files[0], files[0]]), /duplicate paths/);
});

test("reconciliation treats Neon entries as the comparison authority", () => {
  const authority = buildSourceSnapshot(files).files;
  const result = reconcileSnapshot(authority, [
    { path: "src/a.mjs", content: "export const a = 2;\n" },
    { path: "new.txt", content: "new" },
  ]);
  assert.deepEqual(result.added, ["new.txt"]);
  assert.deepEqual(result.changed, ["src/a.mjs"]);
  assert.deepEqual(result.removed, ["docs/a.md"]);
});

test("reconciliation detects executable-mode drift even when bytes match", () => {
  const authority = buildSourceSnapshot([{ path: "bin/tool", content: "tool", fileMode: 33188 }]).files;
  const result = reconcileSnapshot(authority, [{ path: "bin/tool", content: "tool", fileMode: 33261 }]);
  assert.deepEqual(result.changed, ["bin/tool"]);
  assert.deepEqual(result.unchanged, []);
});

test("commit writes blobs and entries before atomically advancing the Neon ref", async () => {
  const calls = [];
  const tx = {
    async query(sql, params) {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (sql.includes("WITH inserted AS")) return { rows: [{ repository_id: "repo-id" }] };
      if (sql.includes("advance_ref")) return { rows: [{ version: "1" }] };
      return { rows: [] };
    },
  };
  const result = await commitSourceRevision({ tx: (fn) => fn(tx) }, {
    repositorySlug: "headysystems/heady-ai",
    expectedRefVersion: 0,
    files,
    message: "bootstrap source authority",
    actor: { type: "founder", id: "eric" },
    revisionId: "00000000-0000-4000-8000-000000000051",
  });
  assert.equal(result.refVersion, 1);
  assert.equal(calls.filter(({ sql }) => sql.includes("heady_source.blob")).length, 2);
  assert.equal(calls.filter(({ sql }) => sql.includes("heady_source.revision_entry")).length, 2);
  assert.match(calls.at(-1).sql, /advance_ref/);
});
