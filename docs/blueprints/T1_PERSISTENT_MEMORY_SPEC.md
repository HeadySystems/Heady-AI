# T1 Persistent Memory Specification

**Canonical Scope**: Defines the T1 warm memory layer on Neon pgvector.
**Version**: 1.0.0

- **Dimension**: 1536d canonical storage (BGE-M3 / OpenAI 3-small)
- **Projection**: 384d materialized for edge routing
- **Database**: Neon Postgres >= 0.8.2
- **Index**: HNSW with `halfvec` quantization
