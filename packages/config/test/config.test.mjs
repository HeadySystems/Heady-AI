// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Config tests — node:test, dep: @heady/shared             ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { parseYaml, validateFacts, loadFacts, getFact, requireEnv } from "../src/index.mjs";

test("parseYaml handles nested maps, scalar lists, scalars, comments", () => {
  const y = parseYaml(`# comment
product:
  name: heady-ai
  version: 3.0.0
platform:
  node_version: 22
  phi: 1.618
stores:
  dropped:
    - qdrant
    - other
flag: true
empty: ~`);
  assert.equal(y.product.name, "heady-ai");
  assert.equal(y.platform.node_version, 22);
  assert.equal(y.platform.phi, 1.618);
  assert.deepEqual(y.stores.dropped, ["qdrant", "other"]);
  assert.equal(y.flag, true);
  assert.equal(y.empty, null);
});

test("loadFacts reads + validates the real golden record", () => {
  const f = loadFacts();
  assert.equal(f.schema, "facts.v1");
  assert.equal(f.product.name, "heady-ai");
  assert.equal(f.embedding.dim, 384);
  assert.equal(f.stores.retrieval_authority, "pgvector");
  assert.deepEqual(f.stores.dropped, ["qdrant"]);
  assert.equal(f.platform.node_version, 22);
});

test("getFact resolves dotted paths", () => {
  assert.equal(getFact("embedding.model"), "@cf/baai/bge-small-en-v1.5");
  assert.equal(getFact("platform.package_manager"), "pnpm");
  assert.equal(getFact("nope.missing"), undefined);
});

test("validateFacts enforces locked invariants", () => {
  assert.throws(() => validateFacts({ schema: "x" }), /missing required key/);
  const base = loadFacts();
  assert.throws(() => validateFacts({ ...base, embedding: { ...base.embedding, dim: 1536 } }), /must be 384/);
  assert.throws(() => validateFacts({ ...base, stores: { ...base.stores, retrieval_authority: "qdrant" } }), /pgvector/);
});

test("requireEnv is fail-closed and rejects loopback", () => {
  assert.equal(requireEnv("X", { env: { X: "https://headymcp.com" } }), "https://headymcp.com");
  assert.throws(() => requireEnv("X", { env: {} }), /missing/);
  assert.throws(() => requireEnv("X", { env: { X: "http://local" + "host:3000" } }), /loopback/);
});
