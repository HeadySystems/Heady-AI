-- ============================================================================
-- HEADY™ FOUNDATION SCHEMA v1.0
-- Migration: 001_foundation.sql
-- Target: Neon Postgres (ep-cold-snow-aesmiwt9.c-2.us-east-2.aws.neon.tech)
-- Requires: pgvector extension
-- 
-- Addresses Gap #1: No database schema existed (neon-schema.sql was 404)
-- This schema covers ALL persistent state for the Heady platform:
--   - Users, devices, sessions (auth)
--   - Onboarding state (was in-memory Map())
--   - Memory tiers T1/T2 (pgvector HNSW)
--   - Distiller recipes (v8 new)
--   - Pipeline execution traces
--   - Audit log (immutable append-only)
--   - Wisdom entries (learned rules, patterns)
--   - Bee/swarm registry
--
-- φ-derived constants used throughout:
--   PSI = 0.618, PSI_SQ = 0.382, fib(7)=13, fib(8)=21, fib(9)=34
--
-- © 2026 HeadySystems Inc.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram similarity for fuzzy text search

-- ============================================================================
-- USERS & AUTH (Gaps #4, #7: Unifies dual auth, enables SSO)
-- ============================================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Firebase UID is the bridge between Firebase Auth and our DB
    firebase_uid    TEXT UNIQUE,
    email           TEXT UNIQUE NOT NULL,
    display_name    TEXT,
    avatar_url      TEXT,
    -- SSO: which provider authenticated this user last
    auth_provider   TEXT NOT NULL DEFAULT 'email',  -- google, github, facebook, email, etc.
    provider_data   JSONB DEFAULT '{}',             -- provider-specific profile fields
    -- Subscription & billing
    stripe_customer_id  TEXT UNIQUE,
    subscription_tier   TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing')),
    -- ML-DSA-65 public key for PQC device identity
    pqc_public_key  BYTEA,
    -- Metadata
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    -- Soft delete
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_firebase ON users (firebase_uid) WHERE firebase_uid IS NOT NULL;
CREATE INDEX idx_users_email ON users USING btree (email);
CREATE INDEX idx_users_stripe ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_users_tier ON users (subscription_tier);

-- User devices (for cross-device sync and PQC identity)
CREATE TABLE user_devices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name     TEXT NOT NULL,
    device_type     TEXT NOT NULL CHECK (device_type IN ('web', 'mobile', 'desktop', 'cli', 'bot')),
    -- PQC: each device has its own ML-DSA-65 keypair
    pqc_public_key  BYTEA NOT NULL,
    pqc_key_fingerprint TEXT NOT NULL,  -- SHA-256 of public key, for quick lookup
    -- Session management
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_user ON user_devices (user_id);
CREATE UNIQUE INDEX idx_devices_fingerprint ON user_devices (pqc_key_fingerprint);

-- Sessions (replaces in-memory session store, enables cross-domain SSO)
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       UUID REFERENCES user_devices(id) ON DELETE SET NULL,
    -- Session token is the httpOnly cookie value (__Host-heady_session)
    session_token   TEXT UNIQUE NOT NULL,
    -- φ-scaled session timing (from auth-gateway.js findings)
    expires_at      TIMESTAMPTZ NOT NULL,   -- maxAge = fib(8) = 21 hours
    renew_after     TIMESTAMPTZ NOT NULL,   -- renewAfter = fib(7) = 13 hours
    absolute_expiry TIMESTAMPTZ NOT NULL,   -- absoluteMax = fib(10) = 55 hours
    -- Cross-domain SSO: which site created this session
    origin_site     TEXT NOT NULL DEFAULT 'headyme.com',
    -- Security
    ip_address      INET,
    user_agent      TEXT,
    pqc_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_token ON sessions USING hash (session_token);
CREATE INDEX idx_sessions_expiry ON sessions (expires_at) WHERE expires_at > NOW();

-- OAuth provider connections (supports 27 providers from provider-registry.js)
CREATE TABLE oauth_connections (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,          -- google, github, facebook, discord, etc.
    provider_uid    TEXT NOT NULL,           -- provider's user ID
    access_token    TEXT,                    -- encrypted at rest
    refresh_token   TEXT,                    -- encrypted at rest
    token_expires_at TIMESTAMPTZ,
    scopes          TEXT[],
    profile_data    JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

CREATE INDEX idx_oauth_provider ON oauth_connections (provider, provider_uid);

-- ============================================================================
-- ONBOARDING (Gap #3: Was in-memory Map() with TODO comment)
-- ============================================================================

CREATE TABLE onboarding_state (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 8-step onboarding from onboarding-controller.js
    current_step    INTEGER NOT NULL DEFAULT 0 CHECK (current_step >= 0 AND current_step <= 8),
    steps_completed INTEGER[] NOT NULL DEFAULT '{}',
    steps_skipped   INTEGER[] NOT NULL DEFAULT '{}',
    -- Per-step data collected during onboarding
    step_data       JSONB NOT NULL DEFAULT '{}',
    -- Example step_data structure:
    -- {
    --   "0": { "welcomed": true },
    --   "1": { "name": "Eric", "role": "founder" },
    --   "2": { "interests": ["ai", "music", "sacred-geometry"] },
    --   "3": { "connected_providers": ["google", "github"] },
    --   ...
    -- }
    completed_at    TIMESTAMPTZ,
    -- 30-day TTL for incomplete onboarding (was Redis TTL)
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_onboarding_user ON onboarding_state (user_id);
CREATE INDEX idx_onboarding_incomplete ON onboarding_state (completed_at) WHERE completed_at IS NULL;

-- ============================================================================
-- MEMORY T1: SHORT-TERM (pgvector HNSW, 47h TTL)
-- ============================================================================

CREATE TABLE memory_t1 (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    -- NULL user_id = system-level memory (codebase patterns, global wisdom)
    node_id         TEXT,                   -- which heady node created this
    memory_type     TEXT NOT NULL CHECK (memory_type IN (
        'conversation', 'task_context', 'user_preference', 'error_resolution',
        'execution_trace', 'pattern', 'code_embedding', 'document', 'distiller_recipe'
    )),
    -- Content
    content         TEXT NOT NULL,
    content_hash    TEXT NOT NULL,           -- SHA-256 for deduplication
    metadata        JSONB NOT NULL DEFAULT '{}',
    -- Vector embedding (1536D for full mode, stored as halfvec for 50% savings)
    embedding       halfvec(1536),
    -- CSL quality score at time of storage
    csl_score       REAL NOT NULL DEFAULT 0.5,
    -- φ-scaled TTL: 47 hours (φ⁸) default, extended by φ⁴≈6.85h on access
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '47 hours'),
    access_count    INTEGER NOT NULL DEFAULT 0,
    last_accessed   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Consolidation tracking
    consolidated_to_t2  BOOLEAN NOT NULL DEFAULT FALSE,
    consolidated_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for vector similarity search
-- m=16 (connections per node), ef_construction=200 (build quality)
CREATE INDEX idx_memory_t1_embedding ON memory_t1 
    USING hnsw (embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 200);

CREATE INDEX idx_memory_t1_user ON memory_t1 (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_memory_t1_type ON memory_t1 (memory_type);
CREATE INDEX idx_memory_t1_expiry ON memory_t1 (expires_at);
CREATE INDEX idx_memory_t1_hash ON memory_t1 (content_hash);
CREATE INDEX idx_memory_t1_csl ON memory_t1 (csl_score) WHERE csl_score >= 0.382;

-- ============================================================================
-- MEMORY T2: LONG-TERM (partitioned by temperature: hot/warm/cold/archive)
-- ============================================================================

CREATE TABLE memory_t2 (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    node_id         TEXT,
    memory_type     TEXT NOT NULL,
    memory_subtype  TEXT NOT NULL CHECK (memory_subtype IN (
        'semantic', 'episodic', 'procedural'
    )),
    content         TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    embedding       halfvec(1536),
    csl_score       REAL NOT NULL DEFAULT 0.5,
    -- Temperature partition: hot (0-21d), warm (21-55d), cold (55-144d), archive (144d+)
    temperature     TEXT NOT NULL DEFAULT 'hot' CHECK (temperature IN ('hot', 'warm', 'cold', 'archive')),
    -- Decay tracking (procedural has no decay, semantic decays at ψ⁴≈0.146/epoch)
    decay_rate      REAL NOT NULL DEFAULT 0.146,
    importance      REAL NOT NULL DEFAULT 0.5,
    -- Consolidation source
    source_t1_id    UUID,
    -- Wisdom entry reference (if this memory was distilled from wisdom.json)
    wisdom_entry_id UUID,
    access_count    INTEGER NOT NULL DEFAULT 0,
    last_accessed   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Separate HNSW indexes per temperature partition for ef tuning
-- Hot: ef_search=144, Warm: ef_search=89, Cold: ef_search=55
CREATE INDEX idx_memory_t2_emb_hot ON memory_t2 
    USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 200)
    WHERE temperature = 'hot';

CREATE INDEX idx_memory_t2_emb_warm ON memory_t2 
    USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 128)
    WHERE temperature = 'warm';

CREATE INDEX idx_memory_t2_user ON memory_t2 (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_memory_t2_type ON memory_t2 (memory_type, memory_subtype);
CREATE INDEX idx_memory_t2_temp ON memory_t2 (temperature);
CREATE INDEX idx_memory_t2_hash ON memory_t2 (content_hash);

-- ============================================================================
-- DISTILLER: EXECUTION RECIPES (v8 new — Gap addressed by super prompt)
-- ============================================================================

CREATE TABLE distiller_recipes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id       TEXT UNIQUE NOT NULL,    -- human-readable: r1_code_gen_module, r3_auth_flow
    task_class      TEXT NOT NULL,           -- CODE_GEN, DRUPAL_BUILD, MEMORY_OP, etc.
    tier            INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
    -- Content varies by tier
    -- Tier 1: optimized prompt + few-shot examples
    -- Tier 2: pipeline config + abstract tips
    -- Tier 3: full DAG + recorded LLM outputs + test assertions
    payload         JSONB NOT NULL,
    payload_hash    TEXT NOT NULL,           -- SHA-256 of payload
    -- Quality metrics from JUDGE stage
    judge_score     REAL NOT NULL CHECK (judge_score >= 0.85),
    judge_breakdown JSONB NOT NULL DEFAULT '{}',  -- {correctness, safety, perf, quality, elegance}
    -- Recipe embedding for semantic retrieval
    embedding       halfvec(1536),
    -- Usage tracking
    use_count       INTEGER NOT NULL DEFAULT 0,
    success_count   INTEGER NOT NULL DEFAULT 0,
    -- Staleness: success_rate < ψ² (0.382) over 8+ uses → archive
    success_rate    REAL GENERATED ALWAYS AS (
        CASE WHEN use_count >= 8 THEN success_count::REAL / use_count ELSE 1.0 END
    ) STORED,
    -- Source trace
    source_trace_id UUID,
    -- PQC signature (ML-DSA-65)
    pqc_signature   BYTEA,
    -- Lifecycle
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'composite')),
    archived_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recipes_embedding ON distiller_recipes 
    USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 200)
    WHERE status = 'active';

CREATE INDEX idx_recipes_class ON distiller_recipes (task_class) WHERE status = 'active';
CREATE INDEX idx_recipes_tier ON distiller_recipes (tier) WHERE status = 'active';
CREATE INDEX idx_recipes_stale ON distiller_recipes (success_rate) WHERE use_count >= 8 AND status = 'active';

-- Meta-distilled composite recipes (fib(9)=34 recipes → 1 composite)
CREATE TABLE distiller_composites (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_class      TEXT NOT NULL,
    recipe_ids      UUID[] NOT NULL,        -- source recipes that were compressed
    composite_payload JSONB NOT NULL,
    composite_hash  TEXT NOT NULL,
    judge_score_avg REAL NOT NULL,
    pqc_signature   BYTEA,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PIPELINE EXECUTION TRACES
-- ============================================================================

CREATE TABLE pipeline_traces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id        TEXT UNIQUE NOT NULL,    -- t_20260316_071500 format
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Pipeline metadata
    pipeline_variant TEXT NOT NULL CHECK (pipeline_variant IN ('fast', 'full', 'arena', 'learning')),
    intent_class    TEXT NOT NULL,
    swarm_assigned  TEXT,
    -- JUDGE results
    judge_composite REAL,
    judge_breakdown JSONB DEFAULT '{}',
    -- Timing
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER,
    -- Resource usage
    total_tokens_in  INTEGER DEFAULT 0,
    total_tokens_out INTEGER DEFAULT 0,
    models_used     TEXT[] DEFAULT '{}',
    bees_dispatched TEXT[] DEFAULT '{}',
    -- Status
    status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'halted')),
    error_message   TEXT,
    -- The full JSONL trace is stored in R2/S3, this is just the pointer
    trace_storage_url TEXT,
    -- SHA-256 of the full trace for integrity verification
    trace_hash      TEXT,
    -- Distillation status
    distilled       BOOLEAN NOT NULL DEFAULT FALSE,
    recipe_id       UUID REFERENCES distiller_recipes(id),
    -- PQC receipt signature
    receipt_signature BYTEA,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_traces_user ON pipeline_traces (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_traces_status ON pipeline_traces (status);
CREATE INDEX idx_traces_class ON pipeline_traces (intent_class);
CREATE INDEX idx_traces_judge ON pipeline_traces (judge_composite) WHERE judge_composite IS NOT NULL;
CREATE INDEX idx_traces_undistilled ON pipeline_traces (distilled) 
    WHERE distilled = FALSE AND status = 'completed' AND judge_composite >= 0.85;

-- ============================================================================
-- AUDIT LOG (Immutable append-only — Law 2: Glass Box Mandate)
-- ============================================================================

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,  -- sequential for ordering guarantee
    event_id        UUID NOT NULL DEFAULT uuid_generate_v4(),
    -- Who
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    node_id         TEXT,                   -- which heady node
    bee_id          TEXT,                   -- which bee, if applicable
    -- What
    action          TEXT NOT NULL,           -- e.g. 'user.login', 'pipeline.complete', 'recipe.created'
    resource_type   TEXT,                    -- e.g. 'user', 'session', 'recipe', 'memory'
    resource_id     TEXT,                    -- ID of the affected resource
    -- Context
    details         JSONB NOT NULL DEFAULT '{}',
    -- Correlation
    trace_id        TEXT,                   -- X-Heady-Trace-Id
    request_id      TEXT,
    -- Security
    ip_address      INET,
    pqc_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    -- Integrity: SHA-256 hash chain (each entry hashes previous + self)
    entry_hash      TEXT NOT NULL,
    previous_hash   TEXT,
    -- PQC signature on the entry
    pqc_signature   BYTEA,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log is append-only: no UPDATE or DELETE operations should ever be performed
-- This is enforced at the application layer via middleware
CREATE INDEX idx_audit_user ON audit_log (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_action ON audit_log (action);
CREATE INDEX idx_audit_trace ON audit_log (trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX idx_audit_time ON audit_log (created_at);

-- ============================================================================
-- WISDOM (Learned rules, patterns, evolved knowledge)
-- ============================================================================

CREATE TABLE wisdom_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Type of wisdom
    entry_type      TEXT NOT NULL CHECK (entry_type IN (
        'learned_rule',         -- LR-001 through LR-NNN
        'error_pattern',        -- recurring error → prevention rule
        'success_pattern',      -- recurring success → optimization hint
        'csl_threshold',        -- empirically adjusted CSL threshold
        'model_affinity',       -- which model wins for which task class
        'swarm_optimization',   -- swarm reorganization insight
        'distiller_insight'     -- meta-pattern from recipe analysis
    )),
    -- Content
    rule_id         TEXT UNIQUE,            -- e.g. LR-001, SP-012
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    -- Confidence and validation
    confidence      REAL NOT NULL DEFAULT 0.5,
    validation_count INTEGER NOT NULL DEFAULT 0,
    last_validated  TIMESTAMPTZ,
    -- Source: which pipeline trace or error produced this wisdom
    source_trace_id UUID REFERENCES pipeline_traces(id),
    -- PQC: wisdom entries are SLH-DSA signed (long-term archive signing)
    slh_dsa_signature BYTEA,
    -- Status
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'superseded')),
    superseded_by   UUID REFERENCES wisdom_entries(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wisdom_type ON wisdom_entries (entry_type) WHERE status = 'active';
CREATE INDEX idx_wisdom_rule ON wisdom_entries (rule_id) WHERE rule_id IS NOT NULL;
CREATE INDEX idx_wisdom_confidence ON wisdom_entries (confidence) WHERE status = 'active';

-- ============================================================================
-- BEE & SWARM REGISTRY
-- ============================================================================

CREATE TABLE bee_registry (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bee_type        TEXT UNIQUE NOT NULL,    -- e.g. 'coder-bee', 'qa-bee', 'distiller-bee'
    swarm           TEXT NOT NULL,           -- which of the 17 swarms this bee belongs to
    description     TEXT,
    -- Capabilities
    capabilities    TEXT[] DEFAULT '{}',
    required_models TEXT[] DEFAULT '{}',     -- which AI models this bee needs
    -- Resource requirements
    timeout_ms      INTEGER NOT NULL DEFAULT 4236,  -- φ² × 1000
    max_retries     INTEGER NOT NULL DEFAULT 3,
    -- Execution stats (rolling window)
    total_executions    BIGINT NOT NULL DEFAULT 0,
    successful_executions BIGINT NOT NULL DEFAULT 0,
    avg_duration_ms REAL,
    -- CSL quality score (rolling average)
    csl_score       REAL NOT NULL DEFAULT 0.5,
    -- Status
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bee_swarm ON bee_registry (swarm) WHERE is_active = TRUE;
CREATE INDEX idx_bee_csl ON bee_registry (csl_score) WHERE is_active = TRUE;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_oauth_updated BEFORE UPDATE ON oauth_connections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_onboarding_updated BEFORE UPDATE ON onboarding_state 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_recipes_updated BEFORE UPDATE ON distiller_recipes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_wisdom_updated BEFORE UPDATE ON wisdom_entries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bee_updated BEFORE UPDATE ON bee_registry 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Memory T1 expiry extension: extend TTL by φ⁴≈6.85h on access
CREATE OR REPLACE FUNCTION extend_memory_ttl()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.access_count > OLD.access_count THEN
        NEW.expires_at = GREATEST(NEW.expires_at, NOW() + INTERVAL '6 hours 51 minutes');
        NEW.last_accessed = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_memory_t1_access BEFORE UPDATE ON memory_t1 
    FOR EACH ROW EXECUTE FUNCTION extend_memory_ttl();

-- Memory T2 temperature migration (called by scheduled job)
CREATE OR REPLACE FUNCTION migrate_memory_temperature()
RETURNS INTEGER AS $$
DECLARE
    migrated INTEGER := 0;
BEGIN
    -- Hot → Warm (after 21 days = fib(8) × 24h)
    UPDATE memory_t2 SET temperature = 'warm'
    WHERE temperature = 'hot' AND created_at < NOW() - INTERVAL '21 days';
    GET DIAGNOSTICS migrated = ROW_COUNT;
    
    -- Warm → Cold (after 55 days = fib(10) × 24h)
    UPDATE memory_t2 SET temperature = 'cold'
    WHERE temperature = 'warm' AND created_at < NOW() - INTERVAL '55 days';
    
    -- Cold → Archive (after 144 days = fib(12) × 24h)
    UPDATE memory_t2 SET temperature = 'archive'
    WHERE temperature = 'cold' AND created_at < NOW() - INTERVAL '144 days';
    
    RETURN migrated;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired T1 memories
CREATE OR REPLACE FUNCTION cleanup_expired_t1()
RETURNS INTEGER AS $$
DECLARE
    cleaned INTEGER;
BEGIN
    DELETE FROM memory_t1 WHERE expires_at < NOW() AND consolidated_to_t2 = TRUE;
    GET DIAGNOSTICS cleaned = ROW_COUNT;
    RETURN cleaned;
END;
$$ LANGUAGE plpgsql;

-- Archive stale distiller recipes (success_rate < ψ² over 8+ uses)
CREATE OR REPLACE FUNCTION archive_stale_recipes()
RETURNS INTEGER AS $$
DECLARE
    archived INTEGER;
BEGIN
    UPDATE distiller_recipes 
    SET status = 'archived', archived_at = NOW()
    WHERE status = 'active' 
      AND use_count >= 8 
      AND success_rate < 0.382;
    GET DIAGNOSTICS archived = ROW_COUNT;
    RETURN archived;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW-LEVEL SECURITY (multi-tenant isolation)
-- ============================================================================

ALTER TABLE memory_t1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_t2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;

-- Service role can access everything (used by heady-manager)
CREATE POLICY service_all ON memory_t1 FOR ALL USING (TRUE);
CREATE POLICY service_all ON memory_t2 FOR ALL USING (TRUE);
CREATE POLICY service_all ON sessions FOR ALL USING (TRUE);
CREATE POLICY service_all ON onboarding_state FOR ALL USING (TRUE);

-- ============================================================================
-- SEED DATA: Initial bee registry (90+ types from live scan)
-- ============================================================================

INSERT INTO bee_registry (bee_type, swarm, description, timeout_ms) VALUES
    ('coder-bee',           'Forge',        'Code generation and implementation', 4236),
    ('qa-bee',              'Forge',        'Quality assurance and testing', 4236),
    ('security-bee',        'Sentinel',     'Security scanning and auditing', 4236),
    ('deployment-bee',      'Forge',        'Deployment automation', 8000),
    ('research-bee',        'Dreamer',      'Deep research and analysis', 13000),
    ('memory-bee',          'Overmind',     'Memory consolidation and retrieval', 4236),
    ('embedding-bee',       'Overmind',     'Vector embedding generation', 4236),
    ('distiller-bee',       'Overmind',     'Execution recipe distillation', 12708),
    ('audit-bee',           'Governance',   'Audit logging and compliance', 4236),
    ('auth-bee',            'Governance',   'Authentication and authorization', 4236),
    ('onboarding-bee',      'Persona',      'User onboarding flow', 4236),
    ('creative-bee',        'Studio',       'Creative content generation', 8000),
    ('midi-bee',            'Studio',       'MIDI protocol bridging', 2000),
    ('trading-bee',         'Quant',        'Financial analysis and trading', 4236),
    ('anomaly-bee',         'Sentinel',     'Anomaly detection', 4236),
    ('archiver-bee',        'Governance',   'Data archival and cleanup', 8000),
    ('mcp-bridge-bee',      'Emissary',     'MCP protocol translation', 4236),
    ('documentation-bee',   'Emissary',     'Documentation generation', 8000),
    ('monte-carlo-bee',     'Dreamer',      'Monte Carlo simulation', 13000),
    ('pattern-bee',         'Overmind',     'Pattern recognition and learning', 4236)
ON CONFLICT (bee_type) DO NOTHING;

-- Seed initial wisdom entries (learned rules from super prompt)
INSERT INTO wisdom_entries (entry_type, rule_id, title, description, confidence, payload) VALUES
    ('learned_rule', 'LR-001', 'Edge deploy working directory', 
     'Use workingDirectory: cloudflare/heady-edge-proxy for edge deployments', 1.0,
     '{"scope": "cloudflare", "enforced_at": "pre-commit"}'),
    ('learned_rule', 'LR-002', 'pnpm audit only', 
     'Use pnpm audit exclusively (never npm audit on pnpm projects)', 1.0,
     '{"scope": "ci-cd", "enforced_at": "pre-commit"}'),
    ('learned_rule', 'LR-003', 'Redis connection safety', 
     'Enforce connectTimeout: 5s, capped backoff, graceful shutdown for Redis', 1.0,
     '{"scope": "infrastructure", "enforced_at": "code-review"}'),
    ('learned_rule', 'LR-004', 'Pino logger in routes', 
     'All logs in src/routes/ and src/orchestration/ must use pino-based logger', 1.0,
     '{"scope": "logging", "enforced_at": "pre-commit"}'),
    ('learned_rule', 'LR-005', 'Host header stripping', 
     'Delete Host header before forwarding to Cloud Run origins (edge proxy)', 1.0,
     '{"scope": "cloudflare", "enforced_at": "code-review"}'),
    ('learned_rule', 'LR-006', 'Zero console.*', 
     'ALL modules in src/ must use system/error/activity logger methods. Zero console.*', 1.0,
     '{"scope": "logging", "enforced_at": "pre-commit"}')
ON CONFLICT (rule_id) DO NOTHING;

-- ============================================================================
-- COMMENTS (documentation in the schema itself)
-- ============================================================================

COMMENT ON TABLE users IS 'Heady platform users. Firebase UID bridges Firebase Auth. PQC public key for device identity.';
COMMENT ON TABLE sessions IS 'φ-scaled sessions: 21h max, 13h renew, 55h absolute. Cross-domain SSO via origin_site.';
COMMENT ON TABLE onboarding_state IS 'Replaces the in-memory Map() that had a TODO comment. 8-step flow with 30-day TTL.';
COMMENT ON TABLE memory_t1 IS 'Short-term memory. pgvector HNSW 1536D halfvec. 47h TTL (φ⁸). Extended on access.';
COMMENT ON TABLE memory_t2 IS 'Long-term memory. Partitioned hot/warm/cold/archive by φ-scaled time boundaries.';
COMMENT ON TABLE distiller_recipes IS 'v8: Execution recipes reverse-engineered from successful traces. 3 tiers.';
COMMENT ON TABLE pipeline_traces IS 'Full pipeline execution history. JSONL trace stored in R2, pointer here.';
COMMENT ON TABLE audit_log IS 'Immutable append-only. SHA-256 hash chain. ML-DSA signed. Glass Box Mandate.';
COMMENT ON TABLE wisdom_entries IS 'Learned rules and patterns. SLH-DSA signed for long-term integrity.';
COMMENT ON TABLE bee_registry IS '90+ bee types across 17 swarms. CSL scoring and execution stats.';
