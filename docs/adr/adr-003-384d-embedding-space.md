# ADR-003: 384-Dimensional Embedding Space

## Status
Accepted

## Date
2026-03-10

## Context
The Heady Alive Software Architecture requires every component, agent, configuration, and artifact to be represented as a vector in a continuous embedding space. This enables:

1. Cosine similarity for component relationship measurement
2. Semantic drift detection via vector distance
3. Clustering and topology mapping
4. CSL-gated routing and scoring

The dimension count needed to be:
- Large enough for meaningful semantic separation
- Small enough for fast computation (especially on Colab Pro+ GPUs)
- Compatible with Matryoshka Representation Learning (MRL) truncation
- Near a Fibonacci number for phi-math consistency

## Decision
Use 384 dimensions as the standard embedding dimension across the Heady platform.

**Rationale:**
- 384 is adjacent to fib(14) = 377, providing Fibonacci-alignment
- 384 = 2^7 × 3, giving good memory alignment properties
- Many high-quality embedding models support 384d natively or via MRL truncation
- 384d provides sufficient capacity for ~50 services × ~100 components
- HNSW index with M=21 (fib(8)) and ef_construction=144 (fib(12)) optimizes for this dimension

**MRL Truncation Hierarchy:**
- 384d → full quality (standard operations)
- 256d → acceptable for pre-filtering
- 128d → edge/mobile only
- All truncations require L2 re-normalization

**Storage:** pgvector with `vector(384)` column type, HNSW index.

## Consequences

### Positive
- Unified representation space — all components speak the same "language"
- Fast cosine similarity computation (384 × 3 FLOPs per comparison)
- Compatible with GPU batch processing on Colab Pro+
- MRL truncation enables quality/speed tradeoffs

### Negative
- Some information loss compared to 768d or 1024d models
- Requires embedding router for multi-provider normalization to 384d
- Every new component type must define an embedding strategy

## Related
- ADR-001 — Phi-Derived Constants (fib(14) = 377 ≈ 384)
- `src/embedding/heady-embed.js` — embedding engine
- `src/colab/colab-vector-space-ops.js` — GPU-accelerated vector operations
- `shared/pgvector-client.js` — vector storage
