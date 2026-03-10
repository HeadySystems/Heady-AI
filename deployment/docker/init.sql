-- HEADY™ PostgreSQL + pgvector initialization
-- Fibonacci-compliant parameters

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Vector memory table
CREATE TABLE IF NOT EXISTS heady_memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384),
  projection vector(3),
  metadata JSONB DEFAULT '{}',
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index — Fibonacci-compliant parameters
CREATE INDEX IF NOT EXISTS idx_memories_embedding
  ON heady_memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 34, ef_construction = 233);

-- BM25-like text search
CREATE INDEX IF NOT EXISTS idx_memories_content_trgm
  ON heady_memories USING gin (content gin_trgm_ops);

-- Receipt chain table
CREATE TABLE IF NOT EXISTS heady_receipts (
  chain_index INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  previous_hash TEXT,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telemetry events table
CREATE TABLE IF NOT EXISTS heady_telemetry (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  source TEXT,
  data JSONB DEFAULT '{}',
  level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_event ON heady_telemetry (event);
CREATE INDEX IF NOT EXISTS idx_telemetry_created ON heady_telemetry (created_at);
