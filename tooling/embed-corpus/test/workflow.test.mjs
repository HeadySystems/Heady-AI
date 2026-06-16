// Unit tests for the corpus-embedding tooling (store + embedder resolver). `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createStore, FILES } from "../src/store.mjs";
import { resolveEmbedder } from "../src/embedder.mjs";
import { embedJobs, mergeOutbox } from "../src/pipeline.mjs";
import { planCorpusEmbedding } from "../../../packages/embedding/src/corpus.mjs";
import { LOCKED_MODEL } from "../../../packages/embedding/src/core.mjs";

// Deterministic stub embedder — returns real 384-d arrays without any network call.
const stubEmbedder = {
  model: LOCKED_MODEL,
  serving: "stub",
  async embed(texts) {
    return texts.map((_, i) => new Array(LOCKED_MODEL.dim).fill((i + 1) / 1000));
  },
};

test("store round-trips JSON and falls back when absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "heady-vm-"));
  try {
    const store = createStore(dir);
    assert.deepEqual(store.readJson(FILES.LEDGER, {}), {}, "missing file → fallback");
    store.writeJson(FILES.LEDGER, { k: { vectorId: "k", refCount: 1 } });
    assert.deepEqual(store.readJson(FILES.LEDGER, null), { k: { vectorId: "k", refCount: 1 } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("store surfaces corruption instead of silently swallowing it", () => {
  const dir = mkdtempSync(join(tmpdir(), "heady-vm-"));
  try {
    const store = createStore(dir);
    writeFileSync(join(dir, FILES.MERKLE), "{ not json");
    assert.throws(() => store.readJson(FILES.MERKLE, null), /corrupt/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveEmbedder returns null without a Workers AI binding", () => {
  assert.equal(resolveEmbedder({}), null);
});

test("resolveEmbedder returns the locked Workers AI embedder when CF env is present", () => {
  const e = resolveEmbedder({ CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_API_TOKEN: "tok" });
  assert.ok(e, "embedder must resolve");
  assert.equal(e.model.id, "@cf/baai/bge-small-en-v1.5");
  assert.equal(e.model.dim, 384);
  assert.equal(e.serving, "workers-ai");
  assert.equal(typeof e.embed, "function");
});

test("HF is fail-safe gated: ignored without explicit opt-in, used only on consent", () => {
  assert.equal(resolveEmbedder({ HF_TOKEN: "hf" }), null, "HF token alone must NOT auto-embed (no IP leak)");
  assert.equal(resolveEmbedder({ HF_TOKEN: "hf" }, { allowHf: true }).serving, "huggingface");
  assert.equal(resolveEmbedder({ HF_TOKEN: "hf", HEADY_ALLOW_HF_EMBED: "1" }).serving, "huggingface");
});

test("Cloudflare (locked serving) is preferred over HF when both are configured", () => {
  const both = resolveEmbedder(
    { CLOUDFLARE_ACCOUNT_ID: "a", CLOUDFLARE_API_TOKEN: "t", HF_TOKEN: "hf" },
    { allowHf: true },
  );
  assert.equal(both.serving, "workers-ai", "the locked CF serving wins when both are configured");
});

test("embedJobs writes real 384-d vectors + ledger, and the run is idempotent ONLY after embed", async () => {
  const files = [
    { rel: "docs/a.md", content: "alpha" },
    { rel: "docs/b.md", content: "beta" },
  ];
  // Before embedding: a cold plan enqueues every file.
  const plan1 = planCorpusEmbedding({ files, prevIndex: null, ledger: {} });
  assert.equal(plan1.summary.jobsQueued, 2);

  // Embed through the stub → real vectors + ledger.
  const res = await embedJobs(plan1.jobs, stubEmbedder, { vectors: {}, ledger: {} }, "2026-06-16T00:00:00Z");
  assert.equal(res.embedded, 2);
  for (const id of Object.keys(res.vectors)) {
    assert.equal(res.vectors[id].embedding.length, 384, "must be a 384-d vector");
    assert.equal(res.vectors[id].dim, 384);
  }
  assert.equal(Object.keys(res.ledger).length, 2, "ledger now records both vectors");

  // After embedding (ledger populated), re-planning the SAME corpus yields zero work.
  const plan2 = planCorpusEmbedding({ files, prevIndex: plan1.nextIndex, ledger: res.ledger });
  assert.equal(plan2.summary.jobsQueued, 0, "idempotent: nothing to embed once the ledger is populated");
  assert.equal(plan2.summary.dedupHits, 2);
});

test("mergeOutbox strips content and is idempotent by key", () => {
  const jobs = [{ idempotencyKey: "k1", sourceId: "a", content: "body", state: "QUEUED" }];
  const once = mergeOutbox({}, jobs);
  assert.equal(once.k1.content, undefined, "content is not persisted to the outbox");
  assert.equal(once.k1.sourceId, "a");
  assert.deepEqual(mergeOutbox(once, jobs), once, "re-merging the same job is a no-op");
});
