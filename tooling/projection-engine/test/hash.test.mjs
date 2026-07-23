// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Projection hash tests — content-addressable + deterministic ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { treeHash, isExcluded, DEFAULT_EXCLUDES } from "../src/hash.mjs";

const files = [
  { rel: "app/b.js", content: "b" },
  { rel: "app/a.js", content: "a" },
];

test("hash is order-independent (sorted-tree) and deterministic", () => {
  const h1 = treeHash(files);
  const h2 = treeHash([...files].reverse());
  assert.equal(h1.root, h2.root);
  assert.equal(h1.count, 2);
  assert.match(h1.root, /^[a-f0-9]{64}$/);
});

test("an edit OR a rename changes the root (the ADR-0017 re-project trigger)", () => {
  const base = treeHash(files).root;
  assert.notEqual(treeHash([{ rel: "app/a.js", content: "a2" }, files[0]]).root, base); // edit
  assert.notEqual(treeHash([{ rel: "app/a-renamed.js", content: "a" }, files[0]]).root, base); // rename
});

test("excludes drop .git/node_modules/build/dist and honor private_paths", () => {
  assert.equal(isExcluded("app/node_modules/x.js"), true);
  assert.equal(isExcluded("app/dist/x.js"), true);
  assert.equal(isExcluded("app/src/x.js"), false);
  assert.equal(isExcluded("app/secret/x.js", { privatePaths: ["app/secret"] }), true);
  assert.deepEqual([...DEFAULT_EXCLUDES].includes("node_modules"), true);
  // a private_path file must not affect the hash
  const withSecret = treeHash([...files, { rel: "app/secret/k.txt", content: "topsecret" }], { privatePaths: ["app/secret"] });
  assert.equal(withSecret.root, treeHash(files).root);
});
