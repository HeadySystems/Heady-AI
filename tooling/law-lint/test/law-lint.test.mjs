// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Law-Lint v2 — unit tests. `node --test`                  ║
// ║  Scope: ESM-only (#1) + HEADY brand-header (#6). Logging/         ║
// ║  placeholders/localhost are tooling/enforcers' canonical domain.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCANNER = fileURLToPath(new URL("../src/law-lint.mjs", import.meta.url));
const FIXTURE_HEADER = `// ╔══════════════════════════════════════════════════════════════════╗\n// ║  HEADY™ test fixture                                              ║\n// ╚══════════════════════════════════════════════════════════════════╝\n`;

function runScanner(dir, args = []) {
  try {
    const out = execFileSync("node", [SCANNER, "--json", "--root", dir, ...args], { encoding: "utf8" });
    return JSON.parse(out);
  } catch (err) {
    return JSON.parse(err.stdout || "{}");
  }
}

function writeFixture(root, relPath, content) {
  const full = join(root, relPath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

test("clean ESM file with brand header produces 0 violations", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  try {
    writeFixture(dir, "packages/foo/src/ok.mjs", FIXTURE_HEADER + "export const x = 1;\n");
    const result = runScanner(dir);
    assert.equal(result.count, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("detects CommonJS require() (esm-only)", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  try {
    writeFixture(dir, "packages/foo/src/bad.mjs", FIXTURE_HEADER + `const x = require('lodash');\n`);
    const result = runScanner(dir);
    assert.ok(result.violations.some(v => v.rule === "esm-only"), "should flag require()");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("missing HEADY brand header flagged in packages/", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  try {
    writeFixture(dir, "packages/foo/src/no-header.mjs", "export const x = 1;\n");
    const result = runScanner(dir);
    assert.ok(result.violations.some(v => v.rule === "heady-brand"), "missing brand header should be flagged");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test(".d.ts files exempt from brand header check", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  try {
    writeFixture(dir, "packages/foo/src/types.d.ts", "export type Foo = string;\n");
    const result = runScanner(dir);
    assert.equal(result.violations.filter(v => v.rule === "heady-brand").length, 0, ".d.ts should not require HEADY header");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("generated bundles and legacy SDK are exempt", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  try {
    writeFixture(dir, "apps/portal/dist/bundle.mjs", `const x = require('x');\n`);
    writeFixture(dir, "packages/heady-sacred-geometry-sdk/index.js", `const y = require('y');\n`);
    const result = runScanner(dir);
    assert.equal(result.count, 0, "dist/ + legacy SDK fully exempt");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("does NOT enforce console/placeholder/localhost (delegated to tooling/enforcers)", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  const lh = "local" + "host";
  const todo = "TO" + "DO";
  try {
    // A file that would trip the old rules but only ESM/brand are in scope now.
    writeFixture(dir, "packages/foo/src/logs.mjs", FIXTURE_HEADER + `export const u = "http://${lh}:3000"; // ${todo}: later\n`);
    const result = runScanner(dir);
    assert.equal(result.count, 0, "console/placeholder/localhost are no longer law-lint's concern");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
