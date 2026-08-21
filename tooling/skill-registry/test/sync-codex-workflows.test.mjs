// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Codex Workflow Shortcut Sync Tests v1.0.0               ║
// ║  Verifies complete, collision-safe Codex workflow projection.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("../sync-codex-workflows.mjs", import.meta.url));

function makeRepo() {
  const root = mkdtemp();
  mkdirSync(join(root, ".agents", "workflows"), { recursive: true });
  mkdirSync(join(root, ".agents", "skills"), { recursive: true });
  mkdirSync(join(root, "tooling", "skill-registry"), { recursive: true });
  writeFileSync(
    join(root, "tooling", "skill-registry", "sync-codex-workflows.mjs"),
    readFileSync(TOOL),
  );
  return root;
}

function mkdtemp() {
  const result = spawnSync("mktemp", ["-d", "/tmp/codex-workflow-sync.XXXXXX"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function workflow(description = "Run the sample workflow") {
  return `---\ndescription: ${description}\n---\n\n# Sample workflow\n\nExecute the canonical steps.\n`;
}

function run(root, args = []) {
  return spawnSync(
    "node",
    [join(root, "tooling", "skill-registry", "sync-codex-workflows.mjs"), ...args],
    { cwd: root, encoding: "utf8" },
  );
}

test("creates an explicit-only Codex adapter and relative directory shortcut", () => {
  const root = makeRepo();
  try {
    writeFileSync(join(root, ".agents", "workflows", "heady-sample.md"), workflow());
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);

    const shortcut = join(root, ".agents", "skills", "heady-sample");
    assert.ok(lstatSync(shortcut).isSymbolicLink());
    assert.equal(readlinkSync(shortcut), join("..", "codex-workflows", "heady-sample"));

    const adapter = readFileSync(
      join(root, ".agents", "codex-workflows", "heady-sample", "SKILL.md"),
      "utf8",
    );
    assert.match(adapter, /^---\nname: heady-sample\ndescription:/);
    assert.match(adapter, /\.agents\/workflows\/heady-sample\.md/);
    assert.equal(
      readFileSync(join(
        root,
        ".agents",
        "codex-workflows",
        "heady-sample",
        "agents",
        "openai.yaml",
      ), "utf8"),
      "policy:\n  allow_implicit_invocation: false\n",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("preserves an authored skill when its name matches a workflow", () => {
  const root = makeRepo();
  try {
    writeFileSync(join(root, ".agents", "workflows", "heady-sample.md"), workflow());
    const skillDir = join(root, ".agents", "skills", "heady-sample");
    mkdirSync(skillDir, { recursive: true });
    const authored = "---\nname: heady-sample\ndescription: Authored skill\n---\n";
    writeFileSync(join(skillDir, "SKILL.md"), authored);

    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(skillDir, "SKILL.md"), "utf8"), authored);
    assert.equal(existsSync(join(root, ".agents", "codex-workflows", "heady-sample")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--check detects drift and passes after synchronization", () => {
  const root = makeRepo();
  try {
    writeFileSync(join(root, ".agents", "workflows", "heady-sample.md"), workflow());
    const drift = run(root, ["--check"]);
    assert.equal(drift.status, 1);

    assert.equal(run(root).status, 0);
    const clean = run(root, ["--check"]);
    assert.equal(clean.status, 0, clean.stderr);

    rmSync(join(
      root,
      ".agents",
      "codex-workflows",
      "heady-sample",
      "agents",
      "openai.yaml",
    ));
    assert.equal(run(root, ["--check"]).status, 1);
    assert.equal(run(root).status, 0);
    assert.equal(run(root, ["--check"]).status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("updates changed workflow metadata and prunes managed orphans", () => {
  const root = makeRepo();
  try {
    const workflowPath = join(root, ".agents", "workflows", "heady-sample.md");
    writeFileSync(workflowPath, workflow("First description"));
    assert.equal(run(root).status, 0);

    writeFileSync(workflowPath, workflow("Updated description"));
    const update = run(root);
    assert.equal(update.status, 0, update.stderr);
    const adapter = readFileSync(
      join(root, ".agents", "codex-workflows", "heady-sample", "SKILL.md"),
      "utf8",
    );
    assert.match(adapter, /Updated description/);

    rmSync(workflowPath);
    const prune = run(root);
    assert.equal(prune.status, 0, prune.stderr);
    assert.equal(existsSync(join(root, ".agents", "skills", "heady-sample")), false);
    assert.equal(existsSync(join(root, ".agents", "codex-workflows", "heady-sample")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
