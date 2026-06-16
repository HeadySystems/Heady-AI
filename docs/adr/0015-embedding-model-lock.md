# ADR-0015: Embedding-Model Lock

- **Status:** Proposed (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

The embedding model and its pooling mode are baked into every stored vector; changing either silently
corrupts retrieval (mean vs CLS pooling are incompatible; dimension is immutable in Vectorize). A drifting
or unpinned embedder is a latent data-corruption bug. ADR-0003 (amended) names the pick; this ADR governs
its lifecycle.

## Decision

1. **Locked embedder:** `@cf/baai/bge-small-en-v1.5`, **384-dim, `mean` pooling** (Cloudflare Workers AI,
   MIT, edge-resident, same trust boundary as Vectorize). 1536-dim (`text-embedding-3-large`) is the
   full-CSL embedder where depth is needed.
2. **Pooling mode and dimension are immutable after first ingest.** Pinned in config, asserted at
   startup; a mismatch fails closed.
3. **Migration recipe (the only way to change it):** dual-write a `heady-v2` index with
   `embedding_model_version`; shadow-eval against a **frozen Ragas testset** until scores stabilize;
   flag-flip reads; drop v1. Never an in-place swap.
4. Every vector row records `embedding_model_version`; the projector (ADR-0014) propagates it.
5. **Watchlist:** EmbeddingGemma-300M (Matryoshka-truncatable to 384, multilingual, code-strong) as the
   likely successor — adopt only via the recipe above.

## Consequences

- (+) Retrieval correctness is protected from silent embedder drift; migrations are evaluable and
  reversible.
- (−) Model upgrades cost a dual-write + shadow-eval cycle — deliberate friction on a corruption-prone
  change.
- See ADR-0003 (amended), ADR-0014 (projector carries the version), REBUILD_PLAN_V2 §4/§6.
