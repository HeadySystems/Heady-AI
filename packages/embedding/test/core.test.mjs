// Runnable with: node --test packages/embedding/test/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOCKED_MODEL,
  assertModelLock,
  normalizeContent,
  contentHash,
  vectorKey,
  idempotencyKey,
  significanceGate,
  dedupLookup,
  acquire,
  nextState,
  isTerminal,
  ACQUISITION_RULES,
} from "../src/core.mjs";

test("Rule 5: model lock asserts and fails closed", () => {
  assert.equal(assertModelLock(LOCKED_MODEL), true);
  assert.throws(() => assertModelLock({ ...LOCKED_MODEL, dim: 512 }), /lock violated/);
  assert.throws(() => assertModelLock({ ...LOCKED_MODEL, pooling: "cls" }), /lock violated/);
});

test("Rule 2: normalization + content hashing are deterministic & dedup-friendly", () => {
  assert.equal(normalizeContent("  hello   world\n"), "hello world");
  // trivially-different whitespace ⇒ same hash (dedup)
  assert.equal(contentHash("a  b"), contentHash("a b"));
  // distinct casing ⇒ distinct hash (we do NOT collapse case)
  assert.notEqual(contentHash("Heady"), contentHash("heady"));
});

test("Rule 2/4: vectorKey == idempotencyKey, deterministic, content-addressed", () => {
  const k1 = vectorKey("the hive breathes");
  const k2 = vectorKey("the   hive breathes  ");
  assert.equal(k1, k2); // dedup hit across whitespace
  assert.equal(vectorKey("the hive breathes"), idempotencyKey("the hive breathes"));
  assert.match(k1, /^[0-9a-f]{64}:@cf\/baai\/bge-small-en-v1\.5:v1$/);
});

test("Rule 3: significance gate skips metadata-only change, re-embeds on content change", () => {
  const fields = ["title", "body"];
  const prev = { title: "T", body: "B", views: 1, updatedAt: "x" };
  const metaOnly = { title: "T", body: "B", views: 999, updatedAt: "y" };
  const contentChange = { title: "T", body: "B2", views: 1, updatedAt: "x" };

  assert.deepEqual(significanceGate(null, prev, fields), { reembed: true, reason: "new-record" });
  assert.equal(significanceGate(prev, metaOnly, fields).reembed, false);
  assert.equal(significanceGate(prev, contentChange, fields).reembed, true);
});

test("Rule 2: dedup lookup short-circuits on a ledger hit", () => {
  const ledger = new Map([[vectorKey("known"), { vectorId: "vec_123" }]]);
  assert.deepEqual(dedupLookup(ledger, vectorKey("known")), { hit: true, ref: { vectorId: "vec_123" } });
  assert.deepEqual(dedupLookup(ledger, vectorKey("unknown")), { hit: false, ref: null });
});

test("Rule 1/7: tiered acquire returns the fastest tier holding the key; never embeds", async () => {
  const key = vectorKey("query vector");
  const kv = { name: "kv", latencyClass: "O(1)", store: new Map() };
  const vectorize = { name: "vectorize", latencyClass: "edge", store: new Map() };
  const pg = { name: "pgvector", latencyClass: "authority", store: new Map([[key, [0.1, 0.2]]]) };
  const mk = (t) => ({ name: t.name, latencyClass: t.latencyClass, get: async (k) => t.store.get(k) });

  // only pgvector has it → served by authority
  let r = await acquire(key, [mk(kv), mk(vectorize), mk(pg)]);
  assert.equal(r.hit, true);
  assert.equal(r.tier, "pgvector");

  // warm the edge cache → now served by vectorize (faster), pgvector never consulted
  vectorize.store.set(key, [0.1, 0.2]);
  r = await acquire(key, [mk(kv), mk(vectorize), mk(pg)]);
  assert.equal(r.tier, "vectorize");

  // warm kv → fastest tier wins
  kv.store.set(key, [0.1, 0.2]);
  r = await acquire(key, [mk(kv), mk(vectorize), mk(pg)]);
  assert.equal(r.tier, "kv");
  assert.equal(r.latencyClass, "O(1)");

  // miss everywhere → no hit, and (crucially) no embed call occurs
  r = await acquire(vectorKey("never-stored"), [mk(kv), mk(vectorize), mk(pg)]);
  assert.equal(r.hit, false);
});

test("job state machine: legal paths and illegal-transition guard", () => {
  // dedup short-circuit
  assert.equal(nextState("QUEUED", "DEDUP_HIT"), "DEDUPED");
  assert.equal(isTerminal("DEDUPED"), true);
  // full embed path
  assert.equal(nextState("QUEUED", "EMBED"), "EMBEDDING");
  assert.equal(nextState("EMBEDDING", "PERSIST"), "PERSISTED");
  assert.equal(nextState("PERSISTED", "PROJECT"), "PROJECTED");
  assert.equal(isTerminal("PROJECTED"), true);
  // not-significant skip
  assert.equal(nextState("QUEUED", "NOT_SIGNIFICANT"), "SKIPPED");
  // illegal
  assert.throws(() => nextState("PROJECTED", "EMBED"), /illegal transition/);
  assert.throws(() => nextState("QUEUED", "PERSIST"), /illegal transition/);
});

test("ruleset is present and complete", () => {
  assert.equal(ACQUISITION_RULES.length, 8);
  assert.ok(ACQUISITION_RULES.every((r) => r.id && r.name && r.invariant));
});
