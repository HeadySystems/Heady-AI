-- ═══════════════════════════════════════════════════════════════
-- HEADY™ Liquid Architecture v9 — Core Database Schema
-- Neon Postgres with pgvector (§2 of blueprint)
--
-- 7 core tables + HNSW indexes + GIN full-text search
-- Run against Neon staging branch first, then promote to prod.
-- ═══════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- Trigram similarity
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- UUID generation

-- ═══════════════════════════════════════════════════════════════
-- 1. USER PROFILES
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id     TEXT UNIQUE,                         -- OAuth provider ID
    email           TEXT UNIQUE,
    display_name    TEXT,
    avatar_url      TEXT,
    auth_provider   TEXT DEFAULT 'email',                 -- google, github, etc.
    tier            TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise', 'pilot')),
    preferences     JSONB DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    profile_embedding VECTOR(1536),                      -- User interest embedding
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_external_id ON user_profiles(external_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);

-- ═══════════════════════════════════════════════════════════════
-- 2. CONVERSATIONS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    title           TEXT,
    model           TEXT DEFAULT 'gemini-2.5-flash-lite',
    system_prompt   TEXT,
    summary_embedding VECTOR(1536),                      -- Conversation topic embedding
    message_count   INT DEFAULT 0,
    total_tokens    INT DEFAULT 0,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 3. MESSAGES
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content         TEXT NOT NULL,
    model           TEXT,                                 -- Which model generated this
    token_count     INT DEFAULT 0,
    latency_ms      INT,                                  -- Response generation time
    content_embedding VECTOR(1536),                       -- Message content embedding
    tool_calls      JSONB,                                -- Tool use metadata
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- ═══════════════════════════════════════════════════════════════
-- 4. EXECUTION TRACES — OpenTelemetry span model (§2 + §8)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS execution_traces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id        TEXT NOT NULL,                        -- OpenTelemetry trace ID
    parent_span_id  TEXT,                                 -- For distributed tracing reconstruction
    span_name       TEXT NOT NULL,                        -- e.g. 'stage:classify', 'llm:gemini'
    service_name    TEXT NOT NULL,                        -- Which HeadyNode
    stage_number    INT,                                  -- Pipeline stage (1-22)
    status          TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'error', 'timeout')),
    duration_ms     INT,
    input_tokens    INT DEFAULT 0,
    output_tokens   INT DEFAULT 0,
    cost_usd        NUMERIC(10,6) DEFAULT 0,             -- Actual cost for this span
    input_embedding VECTOR(1536),                        -- Embedding of the input
    input_preview   TEXT,                                 -- First N chars of input
    output_preview  TEXT,                                 -- First N chars of output
    error_message   TEXT,
    quality_score   NUMERIC(4,3),                         -- LLM-as-Judge score (0-1)
    user_feedback   TEXT CHECK (user_feedback IN ('positive', 'negative', NULL)),
    attributes      JSONB DEFAULT '{}',                   -- OpenTelemetry attributes
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON execution_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_service ON execution_traces(service_name);
CREATE INDEX IF NOT EXISTS idx_traces_stage ON execution_traces(stage_number);
CREATE INDEX IF NOT EXISTS idx_traces_status ON execution_traces(status);
CREATE INDEX IF NOT EXISTS idx_traces_created ON execution_traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_quality ON execution_traces(quality_score)
    WHERE quality_score IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 5. PIPELINE STATES — checkpointing for resilience (§11)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pipeline_states (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id TEXT NOT NULL,                        -- Groups all stages of one run
    stage_number    INT NOT NULL,
    stage_name      TEXT NOT NULL,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    worker_id       TEXT,                                 -- Which worker processed this
    input_data      JSONB,
    output_data     JSONB,
    checkpoint      JSONB,                                -- Resumable state
    retries         INT DEFAULT 0,
    duration_ms     INT,
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pipeline_run_id, stage_number)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_run_id ON pipeline_states(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_status ON pipeline_states(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON pipeline_states(stage_number);

-- ═══════════════════════════════════════════════════════════════
-- 6. RECIPE REGISTRY — hybrid search (GIN + HNSW) per §2
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS recipe_registry (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL UNIQUE,
    version         TEXT DEFAULT '1.0.0',
    category        TEXT NOT NULL,                        -- 'prompt', 'skill', 'tool', 'workflow'
    description     TEXT NOT NULL,
    content         JSONB NOT NULL,                       -- Recipe definition (prompt template, skill config, etc.)
    description_embedding VECTOR(1536),                   -- For semantic search
    description_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', description)) STORED,
    author          TEXT DEFAULT 'heady-system',
    tags            TEXT[] DEFAULT '{}',
    usage_count     INT DEFAULT 0,
    avg_quality     NUMERIC(4,3) DEFAULT 0,               -- Average quality score from traces
    is_active       BOOLEAN DEFAULT true,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_recipe_description_tsv ON recipe_registry USING GIN(description_tsv);
CREATE INDEX IF NOT EXISTS idx_recipe_tags ON recipe_registry USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipe_category ON recipe_registry(category);
CREATE INDEX IF NOT EXISTS idx_recipe_name ON recipe_registry(name);

-- ═══════════════════════════════════════════════════════════════
-- 7. AUDIT LOGS — immutable governance trail
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor           TEXT NOT NULL,                        -- User ID, service name, or 'system'
    action          TEXT NOT NULL,                        -- 'create', 'update', 'delete', 'deploy', 'auth'
    resource_type   TEXT NOT NULL,                        -- 'recipe', 'pipeline', 'model', 'user'
    resource_id     TEXT,
    details         JSONB DEFAULT '{}',
    ip_address      INET,
    user_agent      TEXT,
    csl_score       NUMERIC(4,3),                         -- CSL gate score at time of action
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- HNSW VECTOR INDEXES — build AFTER data is loaded (§2)
--
-- Parameters tuned for 10K-100K scale per blueprint:
--   m=16, ef_construction=128
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_user_profile_embedding ON user_profiles
    USING hnsw (profile_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

CREATE INDEX IF NOT EXISTS idx_conversation_embedding ON conversations
    USING hnsw (summary_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

CREATE INDEX IF NOT EXISTS idx_message_embedding ON messages
    USING hnsw (content_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

CREATE INDEX IF NOT EXISTS idx_trace_input_embedding ON execution_traces
    USING hnsw (input_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

CREATE INDEX IF NOT EXISTS idx_recipe_description_embedding ON recipe_registry
    USING hnsw (description_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- ═══════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['user_profiles', 'conversations', 'recipe_registry'])
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trigger_updated_at ON %I; CREATE TRIGGER trigger_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
            t, t
        );
    END LOOP;
END;
$$;

-- Hybrid search function for recipes (full-text + semantic)
CREATE OR REPLACE FUNCTION search_recipes(
    query_text TEXT,
    query_embedding VECTOR(1536),
    text_weight FLOAT DEFAULT 0.4,
    semantic_weight FLOAT DEFAULT 0.6,
    result_limit INT DEFAULT 10
)
RETURNS TABLE (
    recipe_id UUID,
    name TEXT,
    category TEXT,
    description TEXT,
    combined_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id AS recipe_id,
        r.name,
        r.category,
        r.description,
        (
            text_weight * COALESCE(ts_rank(r.description_tsv, plainto_tsquery('english', query_text)), 0) +
            semantic_weight * (1 - (r.description_embedding <=> query_embedding))
        ) AS combined_score
    FROM recipe_registry r
    WHERE r.is_active = true
      AND (
          r.description_tsv @@ plainto_tsquery('english', query_text)
          OR (r.description_embedding <=> query_embedding) < 0.5
      )
    ORDER BY combined_score DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════
COMMENT ON TABLE user_profiles IS 'Heady platform user accounts with profile embeddings';
COMMENT ON TABLE conversations IS 'User conversation sessions with topic embeddings';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE execution_traces IS 'OpenTelemetry-compatible execution traces for observability';
COMMENT ON TABLE pipeline_states IS 'Checkpointed pipeline stage state for resilience and recovery';
COMMENT ON TABLE recipe_registry IS 'Prompt templates, skills, and workflows with hybrid search';
COMMENT ON TABLE audit_logs IS 'Immutable governance and audit trail';
