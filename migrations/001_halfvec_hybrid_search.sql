-- Heady™ pgvector Optimization Migration v1.0.0
-- HeadySystems Inc.
-- 
-- Implements:
-- 1. halfvec conversion (57% storage reduction)
-- 2. Iterative index scans (pgvector 0.8.x)
-- 3. BM25 hybrid search via ts_rank + RRF fusion
-- 4. Distiller recipe schema (§12)
-- 5. MAPE-K wisdom schema (§25)
-- 6. Agent DID identity schema (HS-064)
--
-- All numeric constants φ-derived.
-- Run on Neon Postgres (ep-cold-snow-aesmiwt9)

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- §1 — Enable extensions
-- ═══════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ═══════════════════════════════════════════════════════════════
-- §2 — halfvec conversion for existing embeddings
-- 57% storage reduction with <1% recall loss
-- ═══════════════════════════════════════════════════════════════

-- Convert T1 memory embeddings to halfvec
ALTER TABLE IF EXISTS heady_memory_t1
  ADD COLUMN IF NOT EXISTS embedding_half halfvec(1536);

UPDATE heady_memory_t1
SET embedding_half = embedding::halfvec(1536)
WHERE embedding IS NOT NULL AND embedding_half IS NULL;

-- Convert T2 memory embeddings to halfvec
ALTER TABLE IF EXISTS heady_memory_t2
  ADD COLUMN IF NOT EXISTS embedding_half halfvec(1536);

UPDATE heady_memory_t2
SET embedding_half = embedding::halfvec(1536)
WHERE embedding IS NOT NULL AND embedding_half IS NULL;

-- Create optimized HNSW indexes on halfvec columns
-- m=21 (fib(8)), ef_construction=89 (fib(11))
DROP INDEX IF EXISTS idx_memory_t1_embedding_half;
CREATE INDEX idx_memory_t1_embedding_half
  ON heady_memory_t1
  USING hnsw (embedding_half halfvec_cosine_ops)
  WITH (m = 21, ef_construction = 89);

DROP INDEX IF EXISTS idx_memory_t2_embedding_half;
CREATE INDEX idx_memory_t2_embedding_half
  ON heady_memory_t2
  USING hnsw (embedding_half halfvec_cosine_ops)
  WITH (m = 21, ef_construction = 89);

-- ═══════════════════════════════════════════════════════════════
-- §3 — Skill embeddings for MCP tool routing
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS heady_skill_embeddings (
  skill_id TEXT PRIMARY KEY,
  skill_name TEXT NOT NULL,
  description TEXT,
  embedding halfvec(384),       -- 384D for fast matching
  embedding_large halfvec(1536), -- 1536D for precise matching
  usage_count BIGINT DEFAULT 0,
  avg_latency_ms REAL DEFAULT 0,
  success_rate REAL DEFAULT 0.618, -- Initial ψ
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_embedding_384
  ON heady_skill_embeddings
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 13, ef_construction = 55);

CREATE INDEX IF NOT EXISTS idx_skill_embedding_1536
  ON heady_skill_embeddings
  USING hnsw (embedding_large halfvec_cosine_ops)
  WITH (m = 21, ef_construction = 89);

-- GIN index for tag-based filtering
CREATE INDEX IF NOT EXISTS idx_skill_tags ON heady_skill_embeddings USING gin (tags);

-- Full-text search index for BM25 hybrid
ALTER TABLE heady_skill_embeddings ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(skill_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_skill_tsv ON heady_skill_embeddings USING gin (tsv);

-- ═══════════════════════════════════════════════════════════════
-- §4 — Hybrid search function (vector + BM25 via RRF)
-- Reciprocal Rank Fusion: score = Σ 1/(k + rank_i)
-- k = 55 (fib(10)) — standard RRF constant
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION heady_hybrid_search(
  query_embedding halfvec(384),
  query_text TEXT,
  match_threshold REAL DEFAULT 0.382,  -- ψ²
  match_count INT DEFAULT 13,           -- fib(7)
  vector_weight REAL DEFAULT 0.618,     -- ψ (vector favored)
  keyword_weight REAL DEFAULT 0.382     -- ψ² (keyword supplementary)
)
RETURNS TABLE (
  skill_id TEXT,
  skill_name TEXT,
  description TEXT,
  vector_similarity REAL,
  keyword_rank REAL,
  hybrid_score REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  rrf_k CONSTANT INT := 55; -- fib(10) — RRF smoothing constant
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      s.skill_id,
      s.skill_name,
      s.description,
      (1 - (s.embedding <=> query_embedding))::REAL as similarity,
      ROW_NUMBER() OVER (ORDER BY s.embedding <=> query_embedding) as rank
    FROM heady_skill_embeddings s
    WHERE 1 - (s.embedding <=> query_embedding) >= match_threshold
    ORDER BY s.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_results AS (
    SELECT
      s.skill_id,
      s.skill_name,
      s.description,
      ts_rank_cd(s.tsv, websearch_to_tsquery('english', query_text))::REAL as rank_score,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(s.tsv, websearch_to_tsquery('english', query_text)) DESC
      ) as rank
    FROM heady_skill_embeddings s
    WHERE s.tsv @@ websearch_to_tsquery('english', query_text)
    LIMIT match_count * 2
  ),
  fused AS (
    SELECT
      COALESCE(v.skill_id, k.skill_id) as skill_id,
      COALESCE(v.skill_name, k.skill_name) as skill_name,
      COALESCE(v.description, k.description) as description,
      COALESCE(v.similarity, 0)::REAL as vector_similarity,
      COALESCE(k.rank_score, 0)::REAL as keyword_rank,
      (
        vector_weight * COALESCE(1.0 / (rrf_k + v.rank), 0) +
        keyword_weight * COALESCE(1.0 / (rrf_k + k.rank), 0)
      )::REAL as hybrid_score
    FROM vector_results v
    FULL OUTER JOIN keyword_results k ON v.skill_id = k.skill_id
  )
  SELECT
    f.skill_id,
    f.skill_name,
    f.description,
    f.vector_similarity,
    f.keyword_rank,
    f.hybrid_score
  FROM fused f
  ORDER BY f.hybrid_score DESC
  LIMIT match_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- §5 — Iterative index scan settings (pgvector 0.8+)
-- ═══════════════════════════════════════════════════════════════

-- Enable iterative scans for filtered queries
ALTER SYSTEM SET hnsw.iterative_scan = 'relaxed_order';
-- Set ef_search for query-time accuracy
ALTER SYSTEM SET hnsw.ef_search = 89; -- fib(11)

-- ═══════════════════════════════════════════════════════════════
-- §6 — Distiller recipe registry (§12)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS distiller_recipes (
  id TEXT PRIMARY KEY,
  tier SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 4),
  task_class TEXT NOT NULL,
  intent_embedding vector(1536),
  config JSONB NOT NULL,
  judge_composite REAL NOT NULL,
  usage_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_embedding
  ON distiller_recipes
  USING hnsw (intent_embedding vector_cosine_ops)
  WITH (m = 21, ef_construction = 89);

CREATE INDEX IF NOT EXISTS idx_recipe_task_class
  ON distiller_recipes (task_class);

CREATE INDEX IF NOT EXISTS idx_recipe_tier
  ON distiller_recipes (tier);

-- ═══════════════════════════════════════════════════════════════
-- §7 — MAPE-K wisdom store (§25)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS heady_wisdom (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- §8 — Agent DID Identity (HS-064)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_identities (
  agent_id TEXT PRIMARY KEY,
  did TEXT UNIQUE NOT NULL,
  did_document JSONB NOT NULL,
  swarm TEXT,
  tier TEXT,
  archetype TEXT,
  trust_score REAL DEFAULT 0.618, -- Initial ψ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_credentials (
  credential_id TEXT PRIMARY KEY,
  issuer_did TEXT NOT NULL,
  subject_did TEXT NOT NULL,
  credential JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cred_subject ON agent_credentials (subject_did);
CREATE INDEX IF NOT EXISTS idx_cred_issuer ON agent_credentials (issuer_did);
CREATE INDEX IF NOT EXISTS idx_cred_expires ON agent_credentials (expires_at) WHERE NOT revoked;

CREATE TABLE IF NOT EXISTS delegation_grants (
  grant_id TEXT PRIMARY KEY,
  delegator_did TEXT NOT NULL,
  delegatee_did TEXT NOT NULL,
  scopes JSONB NOT NULL,
  depth SMALLINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  chain JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deleg_delegatee ON delegation_grants (delegatee_did);

-- ═══════════════════════════════════════════════════════════════
-- §9 — Performance monitoring view
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW heady_vector_stats AS
SELECT
  'memory_t1' as table_name,
  count(*) as row_count,
  pg_size_pretty(pg_total_relation_size('heady_memory_t1')) as total_size,
  pg_size_pretty(pg_indexes_size('heady_memory_t1')) as index_size
FROM heady_memory_t1
UNION ALL
SELECT
  'memory_t2',
  count(*),
  pg_size_pretty(pg_total_relation_size('heady_memory_t2')),
  pg_size_pretty(pg_indexes_size('heady_memory_t2'))
FROM heady_memory_t2
UNION ALL
SELECT
  'skill_embeddings',
  count(*),
  pg_size_pretty(pg_total_relation_size('heady_skill_embeddings')),
  pg_size_pretty(pg_indexes_size('heady_skill_embeddings'))
FROM heady_skill_embeddings
UNION ALL
SELECT
  'distiller_recipes',
  count(*),
  pg_size_pretty(pg_total_relation_size('distiller_recipes')),
  pg_size_pretty(pg_indexes_size('distiller_recipes'))
FROM distiller_recipes;

COMMIT;

-- Post-migration verification
SELECT * FROM heady_vector_stats;
