-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0006 — 990 hybrid search columns             ║
-- ║  Adds the retrieval surface for Phase-A A3: a generated tsvector    ║
-- ║  (keyword) + a pgvector embedding (semantic) on organizations,      ║
-- ║  fused at query time via RRF (@heady/heady990 search). pgvector is  ║
-- ║  the retrieval authority (facts.yaml); embeddings are 384-dim       ║
-- ║  (@cf/baai/bge-small-en-v1.5) and backfilled — nullable until then, ║
-- ║  so keyword search works standalone. Forward-only.                  ║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE heady_990.organizations
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(name, '') || ' ' || coalesce(ntee_code, '') || ' ' || coalesce(state, ''))
    ) STORED;

ALTER TABLE heady_990.organizations
  ADD COLUMN IF NOT EXISTS embedding vector(384);

ALTER TABLE heady_990.organizations
  ADD COLUMN IF NOT EXISTS embedding_model TEXT;

CREATE INDEX IF NOT EXISTS organizations_search_tsv ON heady_990.organizations USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS organizations_embedding_hnsw
  ON heady_990.organizations USING hnsw (embedding vector_cosine_ops);
