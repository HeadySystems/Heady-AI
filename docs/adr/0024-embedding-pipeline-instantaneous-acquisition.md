# ADR-0024: Embedding Pipeline & Instantaneous-Acquisition Ruleset

- **Status:** Accepted (2026-06-16)
- **Deciders:** Eric Anthony Haywood

## Context

Retrieval must feel instantaneous, but embeddings are not free and the vector index is a *derived* store
(ADR-0000). The risk is conflating "fast similarity search" with "embed at read time" — which would put
model latency on the hot path and re-embed unchanged content endlessly. We need the embedding process
defined as a durable, idempotent workflow whose rules make *acquisition* fast by construction.
Implemented in `packages/embedding`.

## Decision

Adopt the **8-rule acquisition ruleset**, enforced as workflow control flow and pure guards:

1. **Embed-on-write, never on-read** — acquisition reads only pre-built tiers; embedding is async at ingest.
2. **Content-addressed dedup** — `vectorKey = sha256(normalize(content)) : modelId : version`; a ledger
   hit short-circuits the pipeline (O(1), zero cost).
3. **Change-significance gate** — re-embed only when significant fields change; metadata-only diffs skip.
4. **Idempotent jobs** — keyed by `vectorKey`; at-least-once delivery ⇒ effectively-once embedding.
5. **Embedding lock** (ADR-0015) — `@cf/baai/bge-small-en-v1.5`, 384-dim, mean; asserted, fail-closed.
6. **Write-through warm** — on persist, populate pgvector (authority) + emit outbox; warm Vectorize + KV
   so the first read is hot.
7. **Tiered acquire** — KV (O(1)) → Vectorize (edge) → pgvector (authority); serve from the fastest tier
   holding the key. A total miss enqueues a job — it never embeds on the read path.
8. **Reconstructible** — derived tiers rebuildable from the SoR (ADR-0000/0014).

The durable workflow is **`HCEmbedPipeline`** (Cloudflare Workflows): intake → dedup-check →
significance-gate → embed → persist(+outbox) → project-warm → done. Job state machine:
`QUEUED → {DEDUPED | SKIPPED | EMBEDDING → PERSISTED → PROJECTED} | FAILED`.

## Consequences

- (+) Read-path latency is independent of embedding cost; identical/insignificantly-changed content is
  never re-embedded; first reads are warm.
- (+) The pure core (`core.mjs`) is platform-free and unit-tested (8/8) — the rules are verifiable.
- (−) A cold first embed of new content still costs one model call (off the hot path); a full re-index is
  O(n) (batched/parallel — fast wall-clock, not zero). Honestly scoped in the package README.
- (−) Dedup correctness depends on the normalization function; over-aggressive normalization would merge
  distinct content. Kept conservative (NFC + whitespace, no case-folding).
- Implements ADR-0003/0014/0015; governed by ADR-0000 (latent is derived). See `compendium/04`.
