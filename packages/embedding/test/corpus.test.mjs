// Unit tests for the pure corpus layer (corpus.mjs). Zero install: `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  leafHash,
  buildMerkleIndex,
  diffMerkle,
  planCorpusEmbedding,
} from "../src/corpus.mjs";
import { vectorKey } from "../src/core.mjs";

const corpus = [
  { rel: "docs/a.md", content: "alpha content" },
  { rel: "docs/b.md", content: "beta content" },
];

test("buildMerkleIndex is deterministic and order-independent", () => {
  const a = buildMerkleIndex(corpus);
  const b = buildMerkleIndex([...corpus].reverse());
  assert.equal(a.root, b.root, "root must not depend on input order");
  assert.equal(a.count, 2);
  assert.equal(a.dim, 384);
  assert.equal(a.model, "@cf/baai/bge-small-en-v1.5");
});

test("leafHash changes on content edit AND on rename", () => {
  const base = leafHash("docs/a.md", "alpha content");
  assert.notEqual(base, leafHash("docs/a.md", "alpha content!"), "edit must change leaf");
  assert.notEqual(base, leafHash("docs/a2.md", "alpha content"), "rename must change leaf");
});

test("empty corpus yields a stable sentinel root", () => {
  assert.equal(buildMerkleIndex([]).root, buildMerkleIndex([]).root);
});

test("diffMerkle classifies added / changed / removed / unchanged", () => {
  const prev = buildMerkleIndex(corpus);
  const next = buildMerkleIndex([
    { rel: "docs/a.md", content: "alpha content" }, // unchanged
    { rel: "docs/b.md", content: "beta CHANGED" }, // changed
    { rel: "docs/c.md", content: "gamma new" }, // added
  ]);
  const d = diffMerkle(prev, next);
  assert.deepEqual(d.unchanged, ["docs/a.md"]);
  assert.deepEqual(d.changed, ["docs/b.md"]);
  assert.deepEqual(d.added, ["docs/c.md"]);
  assert.deepEqual(d.removed, []);
});

test("cold plan (no prior index) enqueues every file once, idempotently", () => {
  const plan = planCorpusEmbedding({ files: corpus, prevIndex: null });
  assert.equal(plan.summary.added, 2);
  assert.equal(plan.summary.jobsQueued, 2);
  for (const job of plan.jobs) {
    assert.equal(job.state, "QUEUED");
    assert.equal(job.id, job.idempotencyKey, "job id must equal idempotency key (Rule 4)");
    assert.equal(job.idempotencyKey, vectorKey(job.content), "key must be the locked vectorKey");
  }
});

test("dedup ledger hit short-circuits — no job for already-embedded content (Rule 2)", () => {
  const key = vectorKey(corpus[0].content);
  const ledger = { [key]: { vectorId: key, refCount: 1 } };
  const plan = planCorpusEmbedding({ files: corpus, prevIndex: null, ledger });
  assert.equal(plan.summary.dedupHits, 1);
  assert.equal(plan.summary.jobsQueued, 1);
  assert.ok(!plan.jobs.some((j) => j.sourceId === "docs/a.md"));
});

test("incremental plan only re-embeds changed files once the ledger reflects what was embedded", () => {
  // Ledger authority: both original contents are already embedded.
  const ledger = {
    [vectorKey("alpha content")]: { vectorId: vectorKey("alpha content"), refCount: 1 },
    [vectorKey("beta content")]: { vectorId: vectorKey("beta content"), refCount: 1 },
  };
  const prevIndex = buildMerkleIndex(corpus);
  const next = [
    { rel: "docs/a.md", content: "alpha content" }, // unchanged → ledger hit → skipped
    { rel: "docs/b.md", content: "beta CHANGED" }, // changed → new key, ledger miss → re-embed
  ];
  const plan = planCorpusEmbedding({ files: next, prevIndex, ledger });
  assert.equal(plan.summary.jobsQueued, 1);
  assert.equal(plan.jobs[0].sourceId, "docs/b.md");
  assert.equal(plan.jobs[0].reason, "changed-file");
});

test("catch-up: Merkle-unchanged but ledger-missing content is still planned (no silent skip)", () => {
  // Reproduces the stuck-state bug: a prior run advanced the Merkle index with NO embedder bound,
  // so the index is current but nothing was embedded (empty ledger). The plan MUST re-enqueue all.
  const prevIndex = buildMerkleIndex(corpus); // index already "seen" the corpus
  const plan = planCorpusEmbedding({ files: corpus, prevIndex, ledger: {} });
  assert.equal(plan.summary.changed, 0, "Merkle sees no change");
  assert.equal(plan.summary.added, 0);
  assert.equal(plan.summary.jobsQueued, 2, "but ledger is empty → both files must be embedded");
  assert.equal(plan.summary.backfill, 2);
  assert.ok(plan.jobs.every((j) => j.reason === "backfill"));
});

test("intra-run duplicate content collapses to one job (Rule 2)", () => {
  const dup = [
    { rel: "docs/x.md", content: "same body" },
    { rel: "docs/y.md", content: "same body" },
  ];
  const plan = planCorpusEmbedding({ files: dup, prevIndex: null, ledger: {} });
  assert.equal(plan.summary.jobsQueued, 1, "identical content → single vector");
  assert.equal(plan.summary.dedupHits, 1);
});

test("removed files surface as tombstones, not silent drops", () => {
  const prevIndex = buildMerkleIndex(corpus);
  const plan = planCorpusEmbedding({
    files: [{ rel: "docs/a.md", content: "alpha content" }],
    prevIndex,
  });
  assert.deepEqual(plan.tombstones, [{ rel: "docs/b.md" }]);
  assert.equal(plan.summary.removed, 1);
});
