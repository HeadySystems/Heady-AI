// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Consistency Bus — Link Index tests                       ║
// ║  Proves the prod-enforcement floor: when the gitignored generated  ║
// ║  registry is absent, the index falls back to the COMMITTED golden  ║
// ║  record so locked-value enforcement stays live (never fail-open).  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLinkIndex, lookup } from "../src/link-index.mjs";

test("absent generated registry ⇒ falls back to the committed facts.yaml floor", () => {
  // Point at a path that cannot exist — simulates a fresh prod deploy with no .data/.
  const idx = loadLinkIndex({ registryPath: "/nonexistent/variable-registry.json" });
  assert.equal(idx.source, "facts.yaml-fallback");
  assert.ok(idx.size > 0, "the golden-record floor must yield linked keys in prod");
});

test("the fallback floor locks the golden facts (drift is recognizable in prod)", () => {
  const idx = loadLinkIndex({ registryPath: "/nonexistent/variable-registry.json" });
  const dim = lookup(idx, "embedding.dim");
  assert.ok(dim, "embedding.dim must be a linked entry from facts.yaml");
  assert.equal(dim.locked, true, "a fact-class entry must be LOCKED");
  assert.equal(String(dim.value), "384", "canonical value comes from the golden record");
  const patents = lookup(idx, "company.patents_provisional");
  assert.ok(patents && patents.locked && String(patents.value) === "51");
});

test("explicit vars are used verbatim (source=provided)", () => {
  const idx = loadLinkIndex({ vars: [{ class: "fact", name: "x.y", value: "1", sot: "test" }] });
  assert.equal(idx.source, "provided");
  assert.equal(lookup(idx, "x.y").value, "1");
});

test("egress never rewrites generic single-segment keys (the Console schema bug)", async () => {
  const { egressNormalize } = await import("../src/process.mjs");
  const idx = loadLinkIndex({ vars: [
    { class: "fact", name: "schema", value: "facts.v1", sot: "facts.yaml" },
    { class: "fact", name: "embedding.dim", value: "384", sot: "facts.yaml" },
  ] });
  // top-level generic key sharing a single-segment fact name → untouched
  const a = egressNormalize({ schema: "console-summary.v1", ok: true }, idx);
  assert.equal(a.payload.schema, "console-summary.v1");
  assert.equal(a.rewrites.length, 0);
  // exact multi-segment linked path → still normalized to canon
  const b = egressNormalize({ embedding: { dim: 1536 } }, idx);
  assert.equal(b.payload.embedding.dim, 384);
  assert.equal(b.rewrites.length, 1);
});
