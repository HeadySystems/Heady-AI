// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Governance Gate — unit tests. `node --test`              ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const GATE = fileURLToPath(new URL("../src/governance-gate.mjs", import.meta.url));
const MARKER = "⚠️ PATENT zone (HS-2026-051+)";

function run(dir, cmd) {
  try {
    const out = execFileSync("node", [GATE, cmd, "--json", "--root", dir], { encoding: "utf8" });
    return JSON.parse(out);
  } catch (err) {
    return JSON.parse(err.stdout || "{}");
  }
}

function write(root, rel, content) {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

test("patent-coverage FAILS when a marked file is not covered by CODEOWNERS", () => {
  const dir = mkdtempSync("/tmp/gov-");
  try {
    write(dir, "packages/csl-engine/src/index.mjs", `// ${MARKER}\nexport const x = 1;\n`);
    write(dir, ".github/CODEOWNERS", "/.agents/ @HeadyMe/core-team\n");
    const r = run(dir, "patent-coverage");
    assert.equal(r.patentCoverage.ok, false);
    assert.ok(r.patentCoverage.uncovered.includes("packages/csl-engine/src/index.mjs"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("patent-coverage PASSES when a directory rule covers the marked file", () => {
  const dir = mkdtempSync("/tmp/gov-");
  try {
    write(dir, "packages/csl-engine/src/index.mjs", `// ${MARKER}\nexport const x = 1;\n`);
    write(dir, "packages/csl-engine/package.json", `{ "name": "csl", "description": "${MARKER}" }\n`);
    write(dir, ".github/CODEOWNERS", "/packages/csl-engine/ @HeadyMe/core-team\n");
    const r = run(dir, "patent-coverage");
    assert.equal(r.patentCoverage.ok, true);
    assert.equal(r.patentCoverage.uncovered.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("patent-coverage FAILS when CODEOWNERS is absent", () => {
  const dir = mkdtempSync("/tmp/gov-");
  try {
    write(dir, "packages/sec/src/index.mjs", `// ${MARKER}\nexport const x = 1;\n`);
    const r = run(dir, "patent-coverage");
    assert.equal(r.patentCoverage.ok, false);
    assert.match(r.patentCoverage.reason, /CODEOWNERS/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("patent-coverage ignores files in docs/ (prose, not embodiment)", () => {
  const dir = mkdtempSync("/tmp/gov-");
  try {
    write(dir, "docs/governance.md", `Discusses ${MARKER} at length.\n`);
    write(dir, ".github/CODEOWNERS", "/.agents/ @HeadyMe/core-team\n");
    const r = run(dir, "patent-coverage");
    assert.equal(r.patentCoverage.ok, true, "docs prose is out of coverage scope");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("workflow-sync PASSES when workflows and commands match", () => {
  const dir = mkdtempSync("/tmp/gov-");
  try {
    write(dir, ".agents/workflows/a.md", "wf a\n");
    write(dir, ".agents/workflows/b.md", "wf b\n");
    write(dir, ".claude/commands/a.md", "cmd a\n");
    write(dir, ".claude/commands/b.md", "cmd b\n");
    const r = run(dir, "workflow-sync");
    assert.equal(r.workflowSync.ok, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("workflow-sync FAILS when a workflow has no command", () => {
  const dir = mkdtempSync("/tmp/gov-");
  try {
    write(dir, ".agents/workflows/a.md", "wf a\n");
    write(dir, ".agents/workflows/orphan.md", "wf orphan\n");
    write(dir, ".claude/commands/a.md", "cmd a\n");
    const r = run(dir, "workflow-sync");
    assert.equal(r.workflowSync.ok, false);
    assert.ok(r.workflowSync.missingCommand.includes("orphan.md"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("workflow-sync FAILS when a command has no workflow", () => {
  const dir = mkdtempSync("/tmp/gov-");
  try {
    write(dir, ".agents/workflows/a.md", "wf a\n");
    write(dir, ".claude/commands/a.md", "cmd a\n");
    write(dir, ".claude/commands/extra.md", "cmd extra\n");
    const r = run(dir, "workflow-sync");
    assert.equal(r.workflowSync.ok, false);
    assert.ok(r.workflowSync.orphanCommand.includes("extra.md"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
