-- HeadyMemory T1 (Short-Term) Vector Storage
-- pgvector HNSW index for fast approximate nearest neighbor search
-- TTL: phi^8 ~ 46.98h, consolidation scoring with 4 phi-derived weights

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- T1: Short-Term Memory — vector embeddings with metadata
CREATE TABLE IF NOT EXISTS heady_memory_t1 (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  embedding     vector(1536) NOT NULL,
  content       JSONB NOT NULL,
  content_hash  TEXT NOT NULL,
  domain        TEXT NOT NULL DEFAULT 'general',
  source_node   TEXT NOT NULL DEFAULT 'autocontext',
  importance    DOUBLE PRECISION NOT NULL DEFAULT 0.618034,
  access_count  INTEGER NOT NULL DEFAULT 0,
  reinforcement INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '47 hours'),
  metadata      JSONB DEFAULT '{}',
  CONSTRAINT unique_content_hash UNIQUE (content_hash)
);

-- HNSW index for fast ANN search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_t1_embedding_hnsw
  ON heady_memory_t1
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index for TTL expiry sweep
CREATE INDEX IF NOT EXISTS idx_t1_expires_at
  ON heady_memory_t1 (expires_at);

-- Index for domain-scoped queries
CREATE INDEX IF NOT EXISTS idx_t1_domain
  ON heady_memory_t1 (domain);

-- Index for consolidation scoring (access patterns)
CREATE INDEX IF NOT EXISTS idx_t1_consolidation
  ON heady_memory_t1 (access_count DESC, importance DESC);

-- Consolidation scoring function
-- Score = wa*access + wr*reinforcement + wi*importance + ws*similarity
-- Weights: wa=0.447, wr=0.276, wi=0.171, ws=0.106
CREATE OR REPLACE FUNCTION heady_consolidation_score(
  access_count INTEGER,
  reinforcement INTEGER,
  importance DOUBLE PRECISION,
  similarity DOUBLE PRECISION DEFAULT 0.5
) RETURNS DOUBLE PRECISION AS $$
BEGIN
  RETURN (
    0.447 * LEAST(access_count / 10.0, 1.0) +
    0.276 * LEAST(reinforcement / 5.0, 1.0) +
    0.171 * importance +
    0.106 * similarity
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-cleanup expired T1 entries (run via pg_cron or application-level)
CREATE OR REPLACE FUNCTION heady_t1_expire_sweep() RETURNS INTEGER AS $$
DECLARE
  removed INTEGER;
BEGIN
  DELETE FROM heady_memory_t1 WHERE expires_at < NOW();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$ LANGUAGE plpgsql;
