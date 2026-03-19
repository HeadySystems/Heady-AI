-- ═══════════════════════════════════════════════════════════════
-- Heady™ Initial Database Schema v1.0
-- Neon Postgres with pgvector extension
-- 
-- Applies: vector memory, user sessions, audit log, embeddings
-- Run: psql $DATABASE_URL -f migrations/001-initial-schema.sql
-- ═══════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;         -- pgvector for 384D embeddings
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- Trigram index for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUID generation

-- ═══════════════════════════════════════════════════════════════
-- Vector Memory — 384D embeddings for Alive Software
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vector_memory (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  namespace     TEXT NOT NULL DEFAULT 'default',
  key           TEXT NOT NULL,
  content       TEXT NOT NULL,
  embedding     vector(384) NOT NULL,
  metadata      JSONB DEFAULT '{}',
  coherence     REAL DEFAULT 0.809,  -- CSL MEDIUM threshold
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  UNIQUE(namespace, key)
);

-- HNSW index for fast similarity search
-- Fibonacci parameters: m=21, ef_construction=89
CREATE INDEX IF NOT EXISTS idx_vector_memory_embedding 
  ON vector_memory USING hnsw (embedding vector_cosine_ops)
  WITH (m = 21, ef_construction = 89);

CREATE INDEX IF NOT EXISTS idx_vector_memory_namespace 
  ON vector_memory (namespace);

CREATE INDEX IF NOT EXISTS idx_vector_memory_metadata 
  ON vector_memory USING gin (metadata);

-- ═══════════════════════════════════════════════════════════════
-- User Sessions — Firebase Auth + session management
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       TEXT NOT NULL,
  firebase_uid  TEXT NOT NULL,
  email         TEXT,
  display_name  TEXT,
  provider      TEXT DEFAULT 'google',
  session_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  last_active   TIMESTAMPTZ DEFAULT now(),
  revoked       BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_firebase_uid ON user_sessions (firebase_uid);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at);

-- ═══════════════════════════════════════════════════════════════
-- Audit Log — Governance and compliance
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp   TIMESTAMPTZ DEFAULT now(),
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  details     JSONB DEFAULT '{}',
  ip_address  INET,
  coherence   REAL,
  hash        TEXT  -- SHA-256 chain hash for tamper-proofing
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);

-- ═══════════════════════════════════════════════════════════════
-- Pipeline Events — HCFullPipeline stage tracking
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pipeline_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id     UUID NOT NULL,
  stage           TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  input           JSONB DEFAULT '{}',
  output          JSONB DEFAULT '{}',
  coherence       REAL,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_pipeline ON pipeline_events (pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_stage ON pipeline_events (stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_status ON pipeline_events (status);

-- ═══════════════════════════════════════════════════════════════
-- Bee Registry — HeadyBee agent tracking
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bee_registry (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bee_type      TEXT NOT NULL,
  bee_id        TEXT UNIQUE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'spawned' CHECK (status IN ('spawned', 'ready', 'running', 'suspended', 'retiring', 'terminated')),
  swarm         TEXT,
  layer         TEXT,
  embedding     vector(384),
  health_score  REAL DEFAULT 1.0,
  last_heartbeat TIMESTAMPTZ DEFAULT now(),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  retired_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bee_registry_type ON bee_registry (bee_type);
CREATE INDEX IF NOT EXISTS idx_bee_registry_status ON bee_registry (status);
CREATE INDEX IF NOT EXISTS idx_bee_registry_swarm ON bee_registry (swarm);

-- ═══════════════════════════════════════════════════════════════
-- Configuration Store — Versioned YAML/JSON configs
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS config_store (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT UNIQUE NOT NULL,
  value       JSONB NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  hash        TEXT NOT NULL,  -- SHA-256 of serialized value
  updated_by  TEXT DEFAULT 'system',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_store_key ON config_store (key);

-- ═══════════════════════════════════════════════════════════════
-- Functions
-- ═══════════════════════════════════════════════════════════════

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vector_memory_updated_at
  BEFORE UPDATE ON vector_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_config_store_updated_at
  BEFORE UPDATE ON config_store
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Cosine similarity search function
CREATE OR REPLACE FUNCTION vector_search(
  query_embedding vector(384),
  search_namespace TEXT DEFAULT 'default',
  match_count INTEGER DEFAULT 10,
  similarity_threshold REAL DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  key TEXT,
  content TEXT,
  metadata JSONB,
  similarity REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vm.id,
    vm.key,
    vm.content,
    vm.metadata,
    (1 - (vm.embedding <=> query_embedding))::REAL as similarity
  FROM vector_memory vm
  WHERE vm.namespace = search_namespace
    AND (1 - (vm.embedding <=> query_embedding)) > similarity_threshold
    AND (vm.expires_at IS NULL OR vm.expires_at > now())
  ORDER BY vm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- Schema version tracking
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ DEFAULT now(),
  description TEXT
);

INSERT INTO schema_migrations (version, description)
VALUES ('001', 'Initial schema: vector_memory, user_sessions, audit_log, pipeline_events, bee_registry, config_store')
ON CONFLICT (version) DO NOTHING;
