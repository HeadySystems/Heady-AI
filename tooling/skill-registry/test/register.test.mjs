// ╭──────────────────────────────────────────────────────────────╮
// │  HEADY™ Skill Registry Projection Tests v1.0.0               │
// │  Verifies content drift detection and deterministic repair.      │
// │  © 2026 HeadySystems Inc. — Eric Haywood, Founder           │
// ╰─────────────────────────────────────────────────────────────╯
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("../register.mjs", import.meta.url));

function makeRepo() {
  const root = mkdtempSync("/tmp/skill-register-");
  mkdirSync(join(root, ".agents", "skills", "heady-sample", "scripts"), { recursive: true });
  mkdirSync(join(root, ".claude", "skills"), { recursive: true });
  mkdirSync(join(root, "tooling", "skill-registry"), { recursive: true });
  writeFileSync(
    join(root, "tooling", "skill-registry", "register.mjs"),
    readFileSync(TOOL),
  );
  writeFileSync(
    join(root, ".agents", "skills", "heady-sample", "SKILL.md"),
    "---\nname: heady-sample\ndescription: Sample projection contract.\n---\n\n# Sample\n",
  );
  writeFileSync(
    join(root, ".agents", "skills", "heady-sample", "scripts", "probe.mjs"),
    "export const probe = true;\n",
  );
  return root;
}

function run(root, args = []) {
  return spawnSync(
    "node",
    [join(root, "tooling", "skill-registry", "register.mjs"), ...args],
    { cwd: root, encoding: "utf8" },
  );
}

test("--check detects a missing projection without writing it", () => {
  const root = makeRepo();
  try {
    const result = run(root, ["--check"]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /missing projected SKILL\.md/);
    assert.throws(() => readFileSync(join(root, ".claude", "skills", "heady-sample", "SKILL.md")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("registration repairs content and resource drift idempotently", () => {
  const root = makeRepo();
  try {
    const writeResult = run(root);
    assert.equal(writeResult.status, 0, writeResult.stderr);

    const clean = run(root, ["--check"]);
    assert.equal(clean.status, 0, clean.stdout);
    assert.match(clean.stdout, /1\/1 skill projections are in sync/);

    writeFileSync(
      join(root, ".claude", "skills", "heady-sample", "scripts", "probe.mjs"),
      "export const probe = false;\n",
    );
    const drift = run(root, ["--check"]);
    assert.equal(drift.status, 1);
    assert.match(drift.stdout, /resource differs: scripts\/probe\.mjs/);

    execFileSync("node", [join(root, "tooling", "skill-registry", "register.mjs")], { cwd: root });
    assert.equal(run(root, ["--check"]).status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
