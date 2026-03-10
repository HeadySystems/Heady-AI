-- Heady™ Migration 001 — Extensions & Schema Foundation
-- @author Eric Haywood — HeadySystems Inc.
-- All numeric parameters derived from φ (1.618) and Fibonacci sequences

-- ═══════════════════════════════════════════════════════════
-- EXTENSIONS
-- ═══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;          -- pgvector for 384D embeddings
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID generation
CREATE EXTENSION IF NOT EXISTS pg_trgm;         -- Trigram similarity for text search
CREATE EXTENSION IF NOT EXISTS btree_gist;      -- GiST index support

-- ═══════════════════════════════════════════════════════════
-- SCHEMA
-- ═══════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS heady;
SET search_path TO heady, public;

-- ═══════════════════════════════════════════════════════════
-- CORE EMBEDDINGS TABLE — 384-dimensional vectors
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS heady.embeddings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    embedding       vector(384) NOT NULL,        -- 384D = embedding dimension
    metadata        JSONB NOT NULL DEFAULT '{}',
    domain          VARCHAR(55) NOT NULL DEFAULT 'general',  -- fib(10) = 55 chars max
    source_service  VARCHAR(89) NOT NULL DEFAULT 'unknown',  -- fib(11) = 89 chars max
    coherence_score REAL DEFAULT 1.0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION heady.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER embeddings_updated_at
    BEFORE UPDATE ON heady.embeddings
    FOR EACH ROW EXECUTE FUNCTION heady.update_timestamp();

-- ═══════════════════════════════════════════════════════════
-- HNSW INDEX — Phi-scaled parameters
-- M = fib(8) = 21, ef_construction = fib(12) = 144
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
    ON heady.embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 21, ef_construction = 144);

-- Set default ef_search = fib(11) = 89
ALTER SYSTEM SET hnsw.ef_search = 89;

-- Domain index for filtered searches
CREATE INDEX IF NOT EXISTS idx_embeddings_domain
    ON heady.embeddings (domain);

-- Metadata GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata
    ON heady.embeddings USING gin (metadata jsonb_path_ops);

-- Created_at for time-range queries
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at
    ON heady.embeddings (created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- SESSIONS TABLE — For auth-session-server
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS heady.sessions (
    id              VARCHAR(89) PRIMARY KEY,     -- fib(11) chars
    user_id         VARCHAR(55) NOT NULL,        -- fib(10) chars
    csrf_token      VARCHAR(55) NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON heady.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON heady.sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON heady.sessions (is_active) WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════
-- AGENT STATE TABLE — For HeadyBee and Swarm persistence
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS heady.agent_state (
    agent_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type      VARCHAR(34) NOT NULL,        -- fib(9) chars
    domain          VARCHAR(55) NOT NULL,
    pool            VARCHAR(13) NOT NULL DEFAULT 'WARM',  -- HOT/WARM/COLD
    status          VARCHAR(21) NOT NULL DEFAULT 'idle',   -- fib(8) chars
    embedding       vector(384),
    config          JSONB NOT NULL DEFAULT '{}',
    metrics         JSONB NOT NULL DEFAULT '{}',
    last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER agent_state_updated_at
    BEFORE UPDATE ON heady.agent_state
    FOR EACH ROW EXECUTE FUNCTION heady.update_timestamp();

CREATE INDEX IF NOT EXISTS idx_agent_state_domain ON heady.agent_state (domain);
CREATE INDEX IF NOT EXISTS idx_agent_state_pool ON heady.agent_state (pool);
CREATE INDEX IF NOT EXISTS idx_agent_state_status ON heady.agent_state (status);

-- ═══════════════════════════════════════════════════════════
-- TASK HISTORY TABLE — Pipeline execution audit trail
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS heady.task_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type       VARCHAR(55) NOT NULL,
    domain          VARCHAR(55) NOT NULL,
    pool            VARCHAR(13) NOT NULL,
    status          VARCHAR(21) NOT NULL,
    input_hash      VARCHAR(89),
    result_embedding vector(384),
    stages_completed INTEGER NOT NULL DEFAULT 0,
    total_stages    INTEGER NOT NULL DEFAULT 21,    -- fib(8) = 21 HCFP stages
    duration_ms     BIGINT,
    error           TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_task_history_domain ON heady.task_history (domain);
CREATE INDEX IF NOT EXISTS idx_task_history_created ON heady.task_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_history_status ON heady.task_history (status);

-- ═══════════════════════════════════════════════════════════
-- PATTERN STORE TABLE — For HeadyPatterns learning
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS heady.patterns (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_type    VARCHAR(55) NOT NULL,
    domain          VARCHAR(55) NOT NULL,
    embedding       vector(384) NOT NULL,
    description     TEXT,
    frequency       INTEGER NOT NULL DEFAULT 1,
    confidence      REAL NOT NULL DEFAULT 0.5,      -- CSL_THRESHOLDS.MINIMUM
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patterns_hnsw
    ON heady.patterns
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 21, ef_construction = 144);

CREATE INDEX IF NOT EXISTS idx_patterns_domain ON heady.patterns (domain);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON heady.patterns (confidence DESC);

-- ═══════════════════════════════════════════════════════════
-- DRIFT LOG TABLE — Semantic coherence tracking
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS heady.drift_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component       VARCHAR(89) NOT NULL,
    previous_score  REAL NOT NULL,
    current_score   REAL NOT NULL,
    threshold       REAL NOT NULL DEFAULT 0.809,    -- CSL_THRESHOLDS.MEDIUM
    action_taken    VARCHAR(55),
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drift_log_component ON heady.drift_log (component);
CREATE INDEX IF NOT EXISTS idx_drift_log_created ON heady.drift_log (created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- AUDIT LOG TABLE — Security and governance
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS heady.audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor           VARCHAR(89) NOT NULL,
    action          VARCHAR(55) NOT NULL,
    resource        VARCHAR(89),
    result          VARCHAR(21) NOT NULL,    -- 'allow', 'deny', 'error'
    ip_address      INET,
    user_agent      TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON heady.audit_log (actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON heady.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON heady.audit_log (action);

-- ═══════════════════════════════════════════════════════════
-- BACKUP METADATA TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS heady.backups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_type     VARCHAR(34) NOT NULL,
    file_path       TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum        VARCHAR(89) NOT NULL,
    encrypted       BOOLEAN NOT NULL DEFAULT true,
    tables_included TEXT[] NOT NULL,
    duration_ms     BIGINT,
    status          VARCHAR(21) NOT NULL DEFAULT 'completed',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_created ON heady.backups (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_type ON heady.backups (backup_type);

-- ═══════════════════════════════════════════════════════════
-- MIGRATION TRACKING
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS heady.migrations (
    version         INTEGER PRIMARY KEY,
    name            VARCHAR(144) NOT NULL,        -- fib(12)
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checksum        VARCHAR(89)
);

INSERT INTO heady.migrations (version, name) VALUES (1, '001_init_extensions')
ON CONFLICT (version) DO NOTHING;
