# @heady/embedding

The embedding pipeline, designed so **data acquisition is near-instantaneous** — not by magic, but by
moving all the work off the read path and never doing it twice. Implements ADR-0003 (pgvector authority +
Vectorize cache), ADR-0014 (WAL→CDC projector), ADR-0015 (embedding lock), and ADR-0024 (this ruleset).

## The idea in one line

> Acquisition is fast because the embedding already happened (asynchronously, at write), the result is
> **content-addressed** (so identical content is never re-embedded), and reads are served from the
> **fastest pre-built tier**. The vector index is a *derived* store, never the source of truth (ADR-0000).

## The ruleset (`ACQUISITION_RULES` in `core.mjs`)

| # | Rule | What it buys |
|---|---|---|
| 1 | **Embed-on-write, never on-read** | the read path has zero embedding latency |
| 2 | **Content-addressed dedup** — `vectorKey = sha256(normalized):modelId:version` | identical content ⇒ O(1) skip, zero cost |
| 3 | **Change-significance gate** | metadata-only edits never trigger re-embedding |
| 4 | **Idempotent jobs** (keyed by `vectorKey`) | at-least-once delivery ⇒ effectively-once embedding |
| 5 | **Embedding lock** (`bge-small-en-v1.5`, 384, mean) | no silent corruption; fail-closed on mismatch |
| 6 | **Write-through warm** (pgvector + Vectorize + KV) | the first read is already hot |
| 7 | **Tiered acquire** (KV → Vectorize → pgvector) | served from the fastest tier holding the key |
| 8 | **Reconstructible** | any derived tier rebuildable from the SoR |

## The workflow — `HCEmbedPipeline` (`workflow.ts`)

Durable Cloudflare Workflow; each step memoized + retryable; idempotent on `vectorKey`:

```
intake ─▶ dedup-check ──hit──▶ link existing vector ─▶ DEDUPED   (Rule 2: the fast path, no embed)
            │ miss
            ▼
       significance-gate ──not-significant──▶ SKIPPED            (Rule 3)
            │ significant
            ▼
          embed (locked model)                                    (Rule 5)
            ▼
       persist → pgvector(SoR) + ledger + outbox row             (Rule 6; ADR-0014 projector consumes outbox)
            ▼
       project-warm → Vectorize + KV                              (Rule 6: first read is hot)
            ▼
          PROJECTED
```

State machine (`nextState` in `core.mjs`):
`QUEUED → {DEDUPED | SKIPPED | EMBEDDING → PERSISTED → PROJECTED} | FAILED`.

## The acquisition path — `acquireEmbedding()` (`acquire-tiers.ts`)

```
acquire(key, [ KV(O(1)) , Vectorize(edge) , pgvector(authority) ]) → fastest tier that has it
```
Never embeds. If every tier misses, returns `{hit:false}` — a miss is a *signal* (enqueue an embed job),
not a read-time embed.

## What's runnable vs canonical

- **`src/core.mjs`** + **`test/core.test.mjs`** — pure, dependency-free (`node:crypto`), **runs here**:
  `node --test test/core.test.mjs` (8/8 passing). This is the verified rule logic.
- **`src/{embedder,schema,workflow,acquire-tiers,index}.ts`** — the canonical integration for the
  Cloudflare/Neon/Workers-AI stack. Real shapes; require the platform to execute.

## Why this is honestly "near-instantaneous" (and where it isn't)

Fast: dedup hits (O(1)), point acquisition from a warm tier (O(1)/O(log n)), incremental re-embedding
(only significant changes). **Not** instantaneous: a cold first embed of new content (one model call,
done off the read path), and full re-index of everything (O(n), batched/parallel — fast wall-clock, not
zero). Embeddings accelerate *similarity search*, not *consistency* — consistency is checked against the
SoR by hash/count, never by the vector index (see the compendium `04` and ADR-0000).
