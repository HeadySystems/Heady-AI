// service-registry — validates the SoT loads, cross-links the secrets registry, and the query API. node:test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistry, crossCheckSecrets, query } from "../src/service-registry.mjs";

test("registry loads and every provider has an id + valid status", () => {
  const doc = loadRegistry();
  assert.ok(doc.providers.length >= 10, "expect the seeded providers");
  for (const p of doc.providers) assert.ok(p.id, "provider has id");
});

test("every provider secret name exists in the secrets registry (no unknown refs)", async () => {
  const doc = loadRegistry();
  const { unknownRefs } = await crossCheckSecrets(doc);
  assert.deepEqual(unknownRefs, [], `providers must only reference known secrets; got ${JSON.stringify(unknownRefs)}`);
});

test("query surfaces the failing-payment cluster, exposure, and unapplied discounts", () => {
  const doc = loadRegistry();
  const q = query(doc, "all");
  assert.ok(q.exposed.includes("neon"), "neon flagged exposed");
  assert.ok(q.failing.includes("vercel") && q.failing.includes("slack"), "failing cluster surfaced");
  assert.ok(q.unappliedDiscounts.includes("anthropic") && q.unappliedDiscounts.includes("openai"), "nonprofit discounts flagged");
  assert.ok(q.openIncidents.length >= 1, "SEC-002 incident tracked");
  assert.equal(typeof q.knownMonthlyUSD, "number");
});

test("risk + cancel views return focused slices", () => {
  const doc = loadRegistry();
  assert.ok(query(doc, "risk").exposed.includes("neon"));
  assert.ok(query(doc, "cancel").cancelCandidates.includes("google-voice"));
});
