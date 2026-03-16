-- ══════════════════════════════════════════════════════════════
-- HEADY™ Neon Database Schema — Liquid Architecture v9.0
-- Serverless Postgres (Neon) — Persistent State Layer
-- ══════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users + Auth ──
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  display_name TEXT,
  email TEXT,
  csl_score FLOAT DEFAULT 0.618,
  memory_count INT DEFAULT 0,
  tier TEXT CHECK (tier IN ('spark', 'flow', 'blaze', 'internal')) DEFAULT 'spark',
  is_new_user BOOL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_firebase ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_csl ON users(csl_score);

-- ── Device Registry (Ed25519 identity) ──
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('windows', 'linux', 'macos', 'android', 'ios', 'colab', 'web')) NOT NULL,
  last_seen TIMESTAMPTZ,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_devices_platform ON devices(platform);

-- ── Task History (22-stage HCFullPipeline) ──
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pipeline_stage INT CHECK (pipeline_stage BETWEEN 1 AND 22),
  task_class TEXT,
  status TEXT CHECK (status IN ('executing', 'complete', 'correcting', 'failed', 'distilled')) DEFAULT 'executing',
  csl_score FLOAT,
  execution_ms INT,
  distilled BOOL DEFAULT FALSE,
  recipe_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_stage ON tasks(pipeline_stage);
CREATE INDEX idx_tasks_distilled ON tasks(distilled) WHERE distilled = FALSE;

-- ── CSL Memory Scores ──
CREATE TABLE IF NOT EXISTS memory_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  memory_hash TEXT NOT NULL,
  csl_score FLOAT NOT NULL,
  tier TEXT CHECK (tier IN ('core', 'archival', 'recall')) NOT NULL,
  access_count INT DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memory_user ON memory_scores(user_id);
CREATE INDEX idx_memory_csl ON memory_scores(csl_score);
CREATE INDEX idx_memory_tier ON memory_scores(tier);

-- ── Anti-Regression Guards (Stage 18) ──
CREATE TABLE IF NOT EXISTS task_guards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_class TEXT NOT NULL,
  guard_type TEXT CHECK (guard_type IN ('assertion', 'invariant', 'boundary')) NOT NULL,
  guard_expr TEXT NOT NULL,
  failure_count INT DEFAULT 0,
  active BOOL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guards_class ON task_guards(task_class);

-- ── Distillation Recipes (Stage 22 — HeadyDistiller) ──
CREATE TABLE IF NOT EXISTS distillation_recipes (
  id TEXT PRIMARY KEY,
  tier INT CHECK (tier BETWEEN 1 AND 3) NOT NULL,
  task_class TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  optimization_gain FLOAT DEFAULT 0,
  use_count INT DEFAULT 0,
  config JSONB,
  prompt TEXT,
  replay_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ
);

CREATE INDEX idx_recipes_class ON distillation_recipes(task_class);
CREATE INDEX idx_recipes_tier ON distillation_recipes(tier);
CREATE INDEX idx_recipes_gain ON distillation_recipes(optimization_gain DESC);
