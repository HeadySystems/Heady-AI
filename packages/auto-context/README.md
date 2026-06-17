<!-- HEADY_BRAND:BEGIN
  HEADY™ · @heady/auto-context · LAYER: packages
  ∞ Sacred Geometry · Liquid Intelligence ∞
HEADY_BRAND:END -->

# @heady/auto-context — WAL logical replication projector

Syncs Neon pgvector events directly to Cloudflare Vectorize (edge cache) with count-parity and PK hash drift checks.

## Core Features

1. **Logical Replication Projection**: Listens to database WAL mutation events and projects vectors to Cloudflare Vectorize.
2. **Drift Detection**: Implements count-parity and primary key hash comparison to detect projection sync drift.
