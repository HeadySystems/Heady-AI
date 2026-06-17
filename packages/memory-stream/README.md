<!-- HEADY_BRAND:BEGIN
  HEADY™ · @heady/memory-stream · LAYER: packages
  ∞ Sacred Geometry · Liquid Intelligence ∞
HEADY_BRAND:END -->

# @heady/memory-stream — Latent Memory Stream

Implements CoALA episodic/semantic memory retrieval, fact mutations, and reflection using Neon pgvector as the sole retrieval authority.

## Core Features

1. **pgvector Retrieval Authority**: Queries Neon pgvector (384-D) directly using cosine similarity.
2. **φ-Tiered Retrieval Scoring**: Combines relevance, recency, and importance using `@heady/phi-math` golden-ratio fusion weights.
3. **Task-Ledger & Outbox Integrations**: Emits transaction-safe memory outbox events.
