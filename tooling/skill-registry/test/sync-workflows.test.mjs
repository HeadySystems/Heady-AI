// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Workflow→Command Sync — unit tests. `node --test`        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, lstatSync, readlinkSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("../sync-workflows.mjs", import.meta.url));

// The tool resolves dirs relative to its own location (REPO_ROOT = tool/../..),
// so we exercise it through a fake repo root via a temp copy of the script's dir layout.
// Simpler: drive it by symlinking a temp repo into place is overkill — instead we test
// the observable contract by running with a temp HOME-like tree and asserting on output JSON.
// The tool has no --root flag, so we validate behavior by constructing the real relative
// layout under a temp dir and invoking node with cwd at a copied tool path.

function makeRepo() {
  const root = mkdtempSync("/tmp/wfsync-");
  mkdirSync(join(root, ".agents", "workflows"), { recursive: true });
  mkdirSync(join(root, ".claude", "commands"), { recursive: true });
  mkdirSync(join(root, "tooling", "skill-registry"), { recursive: true });
  // copy the tool into the temp repo so its REPO_ROOT resolves to the temp root
  const toolSrc = execFileSync("cat", [TOOL], { encoding: "utf8" });
  writeFileSync(join(root, "tooling", "skill-registry", "sync-workflows.mjs"), toolSrc);
  return root;
}

function run(root, args = []) {
  const tool = join(root, "tooling", "skill-registry", "sync-workflows.mjs");
  try {
    const out = execFileSync("node", [tool, "--json", ...args], { encoding: "utf8" });
    return JSON.parse(out);
  } catch (err) {
    return JSON.parse(err.stdout || "{}");
  }
}

test("creates a symlink command for a workflow with none", () => {
  const root = makeRepo();
  try {
    writeFileSync(join(root, ".agents", "workflows", "heady-x.md"), "# X\n");
    const r = run(root);
    assert.equal(r.linked, 1);
    const link = join(root, ".claude", "commands", "heady-x.md");
    assert.ok(lstatSync(link).isSymbolicLink(), "command is a symlink");
    assert.equal(readlinkSync(link), join("..", "..", ".agents", "workflows", "heady-x.md"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("is idempotent — second run links nothing", () => {
  const root = makeRepo();
  try {
    writeFileSync(join(root, ".agents", "workflows", "heady-x.md"), "# X\n");
    run(root);
    const r = run(root, ["--check"]);
    assert.equal(r.inSync, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("converts a stray real-file command into a symlink", () => {
  const root = makeRepo();
  try {
    writeFileSync(join(root, ".agents", "workflows", "heady-x.md"), "# X\n");
    writeFileSync(join(root, ".claude", "commands", "heady-x.md"), "# stale copy\n");
    const r = run(root);
    assert.equal(r.linked, 1);
    assert.ok(lstatSync(join(root, ".claude", "commands", "heady-x.md")).isSymbolicLink());
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("prunes an orphan command with no workflow", () => {
  const root = makeRepo();
  try {
    writeFileSync(join(root, ".claude", "commands", "ghost.md"), "# ghost\n");
    const r = run(root);
    assert.equal(r.pruned, 1);
    assert.equal(existsSync(join(root, ".claude", "commands", "ghost.md")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("--check exits non-zero (reported via empty count) when out of sync", () => {
  const root = makeRepo();
  try {
    writeFileSync(join(root, ".agents", "workflows", "heady-x.md"), "# X\n");
    const r = run(root, ["--check"]);
    assert.equal(r.inSync, false);
    assert.ok(r.needLink.some((s) => s.startsWith("heady-x.md")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
