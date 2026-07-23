// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Projection collectSource tests — walker + excludes         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectSource } from "../src/collect.mjs";
import { treeHash } from "../src/hash.mjs";

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "heady-collect-"));
  mkdirSync(join(root, "app/src"), { recursive: true });
  mkdirSync(join(root, "app/node_modules/dep"), { recursive: true });
  mkdirSync(join(root, "app/dist"), { recursive: true });
  mkdirSync(join(root, "app/secret"), { recursive: true });
  writeFileSync(join(root, "app/src/index.js"), "export const x = 1;");
  writeFileSync(join(root, "app/readme.md"), "# app");
  writeFileSync(join(root, "app/node_modules/dep/index.js"), "module.exports = {}");
  writeFileSync(join(root, "app/dist/bundle.js"), "/*built*/");
  writeFileSync(join(root, "app/secret/key.txt"), "topsecret");
  return root;
}

test("collectSource walks the tree with repo-relative rel paths and drops excludes", () => {
  const root = fixtureRoot();
  const files = collectSource(root, "app");
  const rels = files.map((f) => f.rel).sort();
  assert.deepEqual(rels, ["app/readme.md", "app/secret/key.txt", "app/src/index.js"]);
  assert.ok(!rels.some((r) => r.includes("node_modules")), "node_modules excluded");
  assert.ok(!rels.some((r) => r.includes("/dist/")), "dist excluded");
});

test("private_paths are dropped and never affect the tree hash", () => {
  const root = fixtureRoot();
  const withSecret = treeHash(collectSource(root, "app"));
  const withoutSecret = treeHash(collectSource(root, "app", { privatePaths: ["app/secret"] }));
  assert.notEqual(withSecret.root, withoutSecret.root);
  assert.ok(!collectSource(root, "app", { privatePaths: ["app/secret"] }).some((f) => f.rel.includes("secret")));
});

test("a missing source dir yields an empty set (caller decides fail-closed)", () => {
  assert.deepEqual(collectSource(fixtureRoot(), "does-not-exist"), []);
});
