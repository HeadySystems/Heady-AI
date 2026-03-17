-- Heady™ HNSW Optimization Migration
-- Target: >400 QPS at 99% recall for 1536-dim embeddings
-- Run on: Neon Postgres (pgvector extension required)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS heady_knowledge (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT NOT NULL,
  embedding   vector(1536),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

DROP INDEX IF EXISTS heady_knowledge_hnsw_idx;
CREATE INDEX heady_knowledge_hnsw_idx
  ON heady_knowledge
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Set at query time: SET hnsw.ef_search = 40;

CREATE TABLE IF NOT EXISTS heady_session_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, content)
);

CREATE INDEX IF NOT EXISTS heady_session_memory_hnsw_idx
  ON heady_session_memory
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 8, ef_construction = 32);

CREATE TABLE IF NOT EXISTS heady_semantic_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash  TEXT UNIQUE NOT NULL,
  query_text  TEXT NOT NULL,
  embedding   vector(1536),
  result      JSONB NOT NULL,
  hit_count   INT DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ DEFAULT now() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS heady_semantic_cache_hnsw_idx
  ON heady_semantic_cache
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 8, ef_construction = 32);

CREATE INDEX IF NOT EXISTS heady_semantic_cache_active_idx
  ON heady_semantic_cache (expires_at)
  WHERE expires_at > now();

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM heady_semantic_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;
