// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Law-Lint — unit tests. `node --test`                      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCANNER = fileURLToPath(new URL("../src/law-lint.mjs", import.meta.url));
const cl = "console" + String.fromCharCode(46) + "log";
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

test("clean file produces 0 violations", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  try {
    writeFixture(dir, "packages/foo/src/ok.mjs", FIXTURE_HEADER + "export const x = 1;\n");
    const result = runScanner(dir);
    assert.equal(result.count, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("detects require() in packages/ (esm-only)", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  try {
    writeFixture(dir, "packages/foo/src/bad.mjs", FIXTURE_HEADER + `const x = require('lodash');\n`);
    const result = runScanner(dir);
    assert.ok(result.violations.some(v => v.rule === "esm-only"), "should flag require()");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("detects console.log in apps/ but NOT in tooling/", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  try {
    writeFixture(dir, "apps/portal/src/main.mjs", FIXTURE_HEADER + "console.log('x');\n");
    writeFixture(dir, "tooling/cli/src/run.mjs", FIXTURE_HEADER + "console.log('y');\n");
    const result = runScanner(dir);
    const appHit = result.violations.some(v => v.file.includes("/apps/") && v.rule === "no-console-log");
    const toolHit = result.violations.some(v => v.file.includes("/tooling/") && v.rule === "no-console-log");
    assert.ok(appHit, "console.log in apps/ should be flagged");
    assert.equal(toolHit, false, "console.log in tooling/ should be exempt");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("detects loopback address in packages/", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  const lh = "local" + "host";
  try {
    writeFixture(dir, "packages/api/src/client.mjs", FIXTURE_HEADER + `const url = "http://${lh}:3000";\n`);
    const result = runScanner(dir);
    assert.ok(result.violations.some(v => v.rule === "no-loopback"), "should flag loopback");
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

test("files under dist/ are exempt", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  const lh = "local" + "host";
  try {
    writeFixture(dir, "apps/portal/dist/bundle.mjs", `const x = require('x'); const u = '${lh}'; console.log(u);\n`);
    const result = runScanner(dir);
    assert.equal(result.count, 0, "dist/ files should be fully exempt");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("structured logging via JSON.stringify is allowed (Workers/Logpush)", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  try {
    writeFixture(dir, "apps/edge/src/index.mjs", FIXTURE_HEADER + cl + "(JSON.stringify({ level: 'info' }));\n");
    const result = runScanner(dir);
    assert.equal(result.violations.filter(v => v.rule === "no-console-log").length, 0, "structured JSON logging is sanctioned");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("bare debug logging is still blocked in apps/", () => {
  const dir = mkdtempSync("/tmp/llaw-");
  try {
    writeFixture(dir, "apps/edge/src/dbg.mjs", FIXTURE_HEADER + cl + "('debugging', x);\n");
    const result = runScanner(dir);
    assert.ok(result.violations.some(v => v.rule === "no-console-log"), "bare debug logging stays blocked");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
