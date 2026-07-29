// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — Workers-AI query embedder tests           ║
// ║  Mock fetch (no network): proves request shape + auth, the 384-dim ║
// ║  fail-closed guard, and φ-backoff retry on transient failures.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkersAiQueryEmbedder } from "../src/embed-query.mjs";

const noLog = { info: () => {}, warn: () => {}, error: () => {} };
const ACCOUNT = "acc012345";
const TOKEN = "tok_this_is_over_twenty_chars_long";
const ok384 = (fill = 0.02) => ({ ok: true, status: 200, json: async () => ({ result: { data: [new Array(384).fill(fill)] } }) });

test("embeds a query → 384-d vector; posts to the locked model with a Bearer token", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return ok384(); };
  const embed = createWorkersAiQueryEmbedder({ accountId: ACCOUNT, apiToken: TOKEN, fetchImpl, log: noLog });
  const vec = await embed("food banks in california");
  assert.equal(vec.length, 384);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/accounts\/acc012345\/ai\/run\/@cf\/baai\/bge-small-en-v1\.5$/);
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), { text: ["food banks in california"] });
});

test("legacy Global API Key uses X-Auth-Email/Key instead of Bearer", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push(init); return ok384(); };
  const embed = createWorkersAiQueryEmbedder({ accountId: ACCOUNT, apiToken: TOKEN, email: "eric@headyconnection.org", fetchImpl, log: noLog });
  await embed("arts");
  assert.equal(calls[0].headers["X-Auth-Email"], "eric@headyconnection.org");
  assert.equal(calls[0].headers["X-Auth-Key"], TOKEN);
  assert.equal(calls[0].headers.Authorization, undefined);
});

test("fails closed on a wrong-dimension response (never corrupts the cosine ranking)", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ result: { data: [[1, 2, 3]] } }) });
  const embed = createWorkersAiQueryEmbedder({ accountId: ACCOUNT, apiToken: TOKEN, fetchImpl, retries: 0, log: noLog });
  await assert.rejects(() => embed("x"), /dim=3, expected 384/);
});

test("retries a transient 5xx then succeeds (φ-backoff)", async () => {
  let n = 0;
  const fetchImpl = async () => { n += 1; return n < 2 ? { ok: false, status: 503, json: async () => ({}) } : ok384(); };
  const embed = createWorkersAiQueryEmbedder({ accountId: ACCOUNT, apiToken: TOKEN, fetchImpl, log: noLog });
  const vec = await embed("resilient");
  assert.equal(vec.length, 384);
  assert.equal(n, 2, "the transient failure was retried once");
});

test("a 4xx (non-transient) is not retried and surfaces", async () => {
  let n = 0;
  const fetchImpl = async () => { n += 1; return { ok: false, status: 401, json: async () => ({}) }; };
  const embed = createWorkersAiQueryEmbedder({ accountId: ACCOUNT, apiToken: TOKEN, fetchImpl, log: noLog });
  await assert.rejects(() => embed("nope"), /workers-ai 401/);
  assert.equal(n, 1, "auth failure is terminal — no retry");
});

test("construction fails closed on missing/short creds", () => {
  assert.throws(() => createWorkersAiQueryEmbedder({ accountId: "x", apiToken: TOKEN }));
  assert.throws(() => createWorkersAiQueryEmbedder({ accountId: ACCOUNT, apiToken: "short" }));
});
