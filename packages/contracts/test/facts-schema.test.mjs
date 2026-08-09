// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ facts.v1 schema tests — node:test, zero deps              ║
// ║  Proves the golden-record law: valid record passes; every known    ║
// ║  drift (patents 51→60 counter is OK; dim/stages/store LOCKS fail).  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateFactsV1, FACTS_V1_VERSION, FACTS_V1 } from "../src/facts-schema.mjs";

/** A minimal record that satisfies every facts.v1 rule. */
const VALID = Object.freeze({
  schema: "facts.v1",
  company: { legal_name: "HeadySystems Inc.", trade_name: "Heady", founder: "Eric Anthony Haywood", patents_provisional: 51 },
  product: { name: "heady-ai", version: "3.0.0", status: "pre-launch" },
  platform: { package_manager: "pnpm", node_version: 22, module_system: "esm", phi: 1.618033988749895 },
  stores: { system_of_record: "neon-postgres", retrieval_authority: "pgvector", derived_edge_cache: "vectorize", dropped: ["qdrant"] },
  embedding: { model: "@cf/baai/bge-small-en-v1.5", dim: 384, pooling: "mean" },
  model_layer: { egress_chokepoint: "cloudflare-ai-gateway", edge_tier: "workers-ai", fallback_chain: ["workers-ai", "cloud-run"] },
  event_bus: "nats",
  durable_execution: "cloudflare-workflows",
  agent_harness: "vercel-ai-sdk-v6",
  auth: "firebase-auth",
  secrets: "gcp-secret-manager",
  supply_chain: { primary: "renovate" },
  deploy_targets: { origin: { kind: "gcp-cloud-run" } },
  pipeline: { stages: ["lint"], required_checks: ["lint"] },
  hcfullpipeline: { stage_count: 21 },
  capacity: { max_concurrent_runtime: 6765 },
  consistency: { escalation_threshold: 3 },
  stage0: { manifest: "configs/stage0-untouchables.json" },
  domains: { headyme: { fqdn: "headyme.com", role: "primary-user-surface", status: "verified" } },
  legacy: { source_root: "~/Heady" },
});

/** Deep-clone VALID then apply a mutation, so each drift test is isolated. */
const drift = (mutate) => { const c = structuredClone(VALID); mutate(c); return c; };
const msgs = (facts) => validateFactsV1(facts).errors.join(" | ");

test("the canonical valid record conforms", () => {
  const { ok, errors } = validateFactsV1(VALID);
  assert.equal(ok, true, errors.join("; "));
  assert.equal(errors.length, 0);
});

test("FACTS_V1_VERSION is the declared schema tag", () => {
  assert.equal(FACTS_V1_VERSION, "facts.v1");
  assert.ok(FACTS_V1.length > 20, "rule set must be substantive, not a token");
});

test("patents_provisional is a COUNTER (type-checked) not value-locked — 60 is fine", () => {
  assert.equal(validateFactsV1(drift((c) => { c.company.patents_provisional = 60; })).ok, true);
  assert.equal(validateFactsV1(drift((c) => { c.company.patents_provisional = 52; })).ok, true);
});

test("patents_provisional rejects non-integer / non-positive", () => {
  assert.match(msgs(drift((c) => { c.company.patents_provisional = "many"; })), /patents_provisional must be of type integer/);
  assert.match(msgs(drift((c) => { c.company.patents_provisional = 0; })), /patents_provisional must be >= 1/);
});

test("LOCKED architectural decisions fail closed on drift", () => {
  assert.match(msgs(drift((c) => { c.embedding.dim = 1536; })), /embedding\.dim must be 384/);
  assert.match(msgs(drift((c) => { c.embedding.pooling = "cls"; })), /embedding\.pooling must be "mean"/);
  assert.match(msgs(drift((c) => { c.stores.retrieval_authority = "qdrant"; })), /pgvector/);
  assert.match(msgs(drift((c) => { c.hcfullpipeline.stage_count = 22; })), /stage_count must be 21/);
  assert.match(msgs(drift((c) => { c.capacity.max_concurrent_runtime = 10000; })), /max_concurrent_runtime must be 6765/);
  assert.match(msgs(drift((c) => { c.platform.module_system = "cjs"; })), /module_system must be "esm"/);
  assert.match(msgs(drift((c) => { c.platform.phi = 1.5; })), /phi must be 1\.618/);
  assert.match(msgs(drift((c) => { c.event_bus = "kafka"; })), /event_bus must be "nats"/);
  assert.match(msgs(drift((c) => { c.model_layer.egress_chokepoint = "direct"; })), /egress_chokepoint/);
});

test("dropped stores must still contain qdrant (the dropped decision)", () => {
  assert.match(msgs(drift((c) => { c.stores.dropped = []; })), /stores\.dropped must include "qdrant"/);
});

test("schema tag is self-referential — a bump needs a new schema module", () => {
  assert.match(msgs(drift((c) => { c.schema = "facts.v2"; })), /schema must be "facts\.v1"/);
});

test("missing required keys are reported by dotted path", () => {
  assert.match(msgs(drift((c) => { delete c.embedding.model; })), /missing required key: embedding\.model/);
  assert.match(msgs({ schema: "facts.v1" }), /missing required key/);
});

test("dynamic domain entries require fqdn/role/status with a recognized status", () => {
  assert.match(msgs(drift((c) => { c.domains.bad = { fqdn: "x.com", role: "r", status: "maybe" }; })), /domains\.bad\.status must be one of/);
  assert.match(msgs(drift((c) => { c.domains.bad = { role: "r", status: "verified" }; })), /domains\.bad\.fqdn must be a non-empty string/);
  // scalar children (e.g. dns_checked) are ignored, not treated as entries
  assert.equal(validateFactsV1(drift((c) => { c.domains.dns_checked = "2026-07-04"; })).ok, true);
});

test("validateFactsV1 AGGREGATES — one run surfaces every violation", () => {
  const { ok, errors } = validateFactsV1(drift((c) => {
    c.embedding.dim = 1536;
    c.hcfullpipeline.stage_count = 22;
    c.stores.retrieval_authority = "qdrant";
  }));
  assert.equal(ok, false);
  assert.ok(errors.length >= 3, `expected >=3 aggregated errors, got ${errors.length}`);
});
