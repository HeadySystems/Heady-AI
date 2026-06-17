# PGVector Migration Runbook

**Canonical Scope**: Runbook for backfilling legacy documents into vector storage.
**Version**: 1.0.0

1. Dual-write layer activation.
2. Backfill historical assets with deterministic chunking.
3. Build HNSW indexes post-load.
4. Parity checks.
5. φ-stepped traffic cutover.
