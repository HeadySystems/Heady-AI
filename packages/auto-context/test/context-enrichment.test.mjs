// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Auto-Context Enrichment tests — node:test                ║
// ║  Proves CSL-rank → gate → dedupe → φ-budget → coherence, and the  ║
// ║  384-dim contract is enforced. © 2026 HeadySystems Inc.          ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { DIM } from "@heady/csl-engine";
import { CSL_THRESHOLDS, FIB, DEDUP_THRESHOLD } from "@heady/phi-math";
import { ContextEnricher, ENRICH_PROFILES } from "../src/context-enrichment.mjs";

// ── helpers: build 384-dim unit-ish vectors with a controllable cosine to a base ──
function unit(seed) {
  const v = new Array(DIM).fill(0);
  // deterministic pseudo-vector
  for (let i = 0; i < DIM; i++) v[i] = Math.sin(seed * (i + 1)) ;
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / mag);
}
// A vector at a target cosine to `base` (mix base with an orthogonal-ish noise vector).
function atCosine(base, cos, seed) {
  const noise = unit(seed);
  const mixed = base.map((b, i) => cos * b + (1 - cos) * noise[i]);
  const mag = Math.sqrt(mixed.reduce((s, x) => s + x * x, 0));
  return mixed.map((x) => x / mag);
}

const BASE = unit(1);
const task = (embedding = BASE) => ({ text: "do the thing", embedding, traceId: "t1" });

function frag(id, embedding, source = "vector") {
  return { id, content: `c-${id}`, embedding, source, metadata: {} };
}

function retrieverOf(frags) {
  return { retrieve: async (_t, { limit }) => frags.slice(0, limit) };
}

test("ENRICH_PROFILES are φ/Fibonacci aligned", () => {
  assert.equal(ENRICH_PROFILES.stage.gate, CSL_THRESHOLDS.LOW);
  assert.equal(ENRICH_PROFILES.stage.budget, FIB[8]);
  assert.equal(ENRICH_PROFILES.battle.gate, CSL_THRESHOLDS.MEDIUM);
  assert.equal(ENRICH_PROFILES.council.gate, CSL_THRESHOLDS.HIGH);
  assert.equal(ENRICH_PROFILES.council.budget, FIB[6]);
});

test("constructor demands a retriever", () => {
  assert.throws(() => new ContextEnricher({}), /retriever/);
});

test("gate drops fragments below the profile relevance bar", async () => {
  // stage gate = LOW (0.691). Build one clearly-above and one clearly-below.
  const high = frag("hi", atCosine(BASE, 0.95, 2));
  const low = frag("lo", atCosine(BASE, 0.40, 3));
  const enricher = new ContextEnricher({ retriever: retrieverOf([high, low]) });
  const out = await enricher.enrichForStage(task());
  assert.equal(out.profile, "stage");
  assert.ok(out.items.find((i) => i.id === "hi"), "high-relevance kept");
  assert.ok(!out.items.find((i) => i.id === "lo"), "low-relevance gated out");
  assert.ok(out.coherence >= CSL_THRESHOLDS.LOW);
});

test("near-duplicates are deduped, highest score kept", async () => {
  const a = frag("a", atCosine(BASE, 0.97, 5));
  // b is a near-duplicate of a (cosine to a ≥ DEDUP_THRESHOLD) but slightly lower task score
  const b = frag("b", a.embedding.map((x, i) => x + (i === 0 ? 1e-6 : 0)));
  const enricher = new ContextEnricher({ retriever: retrieverOf([a, b]) });
  const out = await enricher.enrichForStage(task());
  assert.equal(out.deduped, 1, "one near-duplicate dropped");
  assert.equal(out.items.length, 1);
  assert.ok(DEDUP_THRESHOLD > 0.9);
});

test("capsule is capped at the φ-budget", async () => {
  const many = Array.from({ length: 40 }, (_, i) => frag(`f${i}`, atCosine(BASE, 0.90, 100 + i)));
  const enricher = new ContextEnricher({ retriever: retrieverOf(many) });
  const out = await enricher.enrichForStage(task()); // stage budget = FIB[8] = 21
  assert.ok(out.items.length <= ENRICH_PROFILES.stage.budget);
});

test("empty retrieval → empty capsule, zero coherence (no throw)", async () => {
  const enricher = new ContextEnricher({ retriever: retrieverOf([]) });
  const out = await enricher.enrichForCouncil(task());
  assert.equal(out.items.length, 0);
  assert.equal(out.coherence, 0);
});

test("non-384-dim fragment embedding is rejected (single source of truth)", async () => {
  const bad = { id: "x", content: "c", embedding: [1, 2, 3], source: "vector", metadata: {} };
  const enricher = new ContextEnricher({ retriever: retrieverOf([bad]) });
  await assert.rejects(() => enricher.enrichForStage(task()), /384/);
});

test("task without a 384-dim embedding is rejected", async () => {
  const enricher = new ContextEnricher({ retriever: retrieverOf([]) });
  await assert.rejects(() => enricher.enrichForStage({ text: "hi", embedding: [1] }), /384/);
});
