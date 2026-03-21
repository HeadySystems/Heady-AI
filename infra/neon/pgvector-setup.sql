-- HEADY_BRAND:BEGIN
-- Neon pgvector Setup — Vector Memory Layer for Liquid Latent OS
-- HEADY_BRAND:END

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ─── SCHEMAS ─────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS heady_core;
CREATE SCHEMA IF NOT EXISTS heady_vectors;
CREATE SCHEMA IF NOT EXISTS heady_battle;
CREATE SCHEMA IF NOT EXISTS heady_sims;
CREATE SCHEMA IF NOT EXISTS heady_pipeline;

-- ─── HEADY_CORE: Service Registry ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS heady_core.services (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  service_id TEXT NOT NULL UNIQUE,
  service_version TEXT NOT NULL DEFAULT '1.0.0',
  service_tier TEXT NOT NULL DEFAULT 'warm' CHECK (service_tier IN ('hot', 'warm', 'cold')),
  port INTEGER,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  endpoint TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heady_core.service_health (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES heady_core.services(service_id),
  status TEXT NOT NULL,
  latency_ms REAL,
  error_rate REAL DEFAULT 0,
  memory_mb REAL,
  details JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_health_service ON heady_core.service_health(service_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS heady_core.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  source TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_topic ON heady_core.events(topic, created_at DESC);

CREATE TABLE IF NOT EXISTS heady_core.audit_trail (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  resource TEXT,
  details JSONB DEFAULT '{}',
  hash TEXT, -- Ed25519 trust receipt hash
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── HEADY_VECTORS: Vector Memory (1536D) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS heady_vectors.embeddings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content_hash TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  embedding vector(1536) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_ivfflat
  ON heady_vectors.embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 3-Tier Memory
CREATE TABLE IF NOT EXISTS heady_vectors.memory_t0 (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  embedding vector(1536),
  ttl_ms INTEGER DEFAULT 29034, -- φ⁷ × 1000
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS heady_vectors.memory_t1 (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  embedding vector(1536),
  access_count INTEGER DEFAULT 0,
  ttl_ms INTEGER DEFAULT 46979000, -- φ⁸ × 1000000
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heady_vectors.memory_t2 (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  embedding vector(1536),
  importance REAL DEFAULT 0.618, -- ψ
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_t2_embedding
  ON heady_vectors.memory_t2 USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── HEADY_BATTLE: Arena Competition ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS heady_battle.arena_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  scenario TEXT,
  candidate_count INTEGER DEFAULT 0,
  max_rounds INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS heady_battle.battle_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES heady_battle.arena_sessions(session_id),
  round INTEGER NOT NULL,
  candidate_id TEXT NOT NULL,
  score REAL NOT NULL,
  judge_weights JSONB DEFAULT '{"correctness": 0.34, "safety": 0.21, "performance": 0.21, "quality": 0.13, "elegance": 0.11}',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battle_results_session ON heady_battle.battle_results(session_id, round);

-- ─── HEADY_SIMS: Simulation Engine ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS heady_sims.simulation_runs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sim_id TEXT NOT NULL UNIQUE,
  scenario TEXT NOT NULL,
  iterations INTEGER NOT NULL DEFAULT 89,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  params JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS heady_sims.mc_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sim_id TEXT NOT NULL REFERENCES heady_sims.simulation_runs(sim_id),
  statistics JSONB NOT NULL DEFAULT '{}', -- mean, variance, stdDev, min, max, p50, p95, p99
  risk_profile JSONB NOT NULL DEFAULT '{}', -- level, confidence
  outcomes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heady_sims.risk_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id TEXT NOT NULL UNIQUE,
  service_id TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  confidence REAL DEFAULT 0.618,
  factors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── HEADY_PIPELINE: HCFullPipeline State ───────────────────────────────────
CREATE TABLE IF NOT EXISTS heady_pipeline.pipeline_runs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE,
  trigger TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed', 'cancelled')),
  stages_completed INTEGER DEFAULT 0,
  stages_total INTEGER DEFAULT 22,
  config_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS heady_pipeline.stage_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES heady_pipeline.pipeline_runs(run_id),
  stage_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  duration_ms INTEGER,
  output JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heady_pipeline.checkpoint_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  run_id TEXT,
  stage TEXT NOT NULL,
  ors_score REAL DEFAULT 100.0,
  config_hash TEXT,
  drift_detected BOOLEAN DEFAULT FALSE,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heady_pipeline.task_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  input_hash TEXT,
  output_hash TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_history_category ON heady_pipeline.task_history(category, created_at DESC);

-- ─── GRANTS ──────────────────────────────────────────────────────────────────
-- (Neon manages roles; these are for reference)
-- GRANT ALL ON SCHEMA heady_core TO heady_app;
-- GRANT ALL ON SCHEMA heady_vectors TO heady_app;
-- GRANT ALL ON SCHEMA heady_battle TO heady_app;
-- GRANT ALL ON SCHEMA heady_sims TO heady_app;
-- GRANT ALL ON SCHEMA heady_pipeline TO heady_app;
