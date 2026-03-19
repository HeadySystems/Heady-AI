-- ═══════════════════════════════════════════════════════════════
-- HEADY™ Multi-Tenant IaaS Schema — HeadyConnection
-- Neon Postgres + pgvector + Row-Level Security
--
-- Adds multi-tenant infrastructure on top of 001_core_schema.sql.
-- Run against Neon staging branch first, then promote to prod.
-- ═══════════════════════════════════════════════════════════════

-- Ensure pgvector is available (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══════════════════════════════════════════════════════════════
-- 1. TENANTS — Businesses or developers paying for HeadyConnection
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name    VARCHAR(255) NOT NULL,
    contact_email   TEXT,
    subscription_tier VARCHAR(50) DEFAULT 'developer'
                    CHECK (subscription_tier IN ('developer', 'starter', 'pro', 'enterprise')),
    request_count   BIGINT DEFAULT 0,                        -- Usage-based Stripe billing counter
    monthly_vector_ops BIGINT DEFAULT 0,                     -- Vector operations this billing cycle
    rate_limit_rpm  INT DEFAULT 144,                          -- Requests per minute (φ-scaled Fib[12])
    stripe_customer_id TEXT,                                  -- Stripe customer ID for metered billing
    stripe_subscription_id TEXT,                              -- Stripe subscription ID
    metadata        JSONB DEFAULT '{}',                       -- Custom tenant metadata
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tenants_tier ON tenants(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 2. API KEYS — Secure gateway routing (SHA-256 hashed, never plaintext)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS api_keys (
    key_hash        VARCHAR(64) PRIMARY KEY,                  -- SHA-256 hex digest (64 chars)
    tenant_id       UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    key_prefix      VARCHAR(12),                              -- First 8 chars for display (hc_xxxx...)
    label           VARCHAR(255),                             -- Human-readable label
    scopes          TEXT[] DEFAULT '{read,write}',            -- Permission scopes
    is_active       BOOLEAN DEFAULT true,
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,                              -- Optional expiry
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════
-- 3. HEADY VECTORS — The tenant-isolated intelligence layer
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS heady_vectors (
    vector_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    context_type    VARCHAR(50),                              -- e.g. 'trading_setup', 'chat_history', 'governance_rule'
    namespace       VARCHAR(100) DEFAULT 'default',           -- Logical grouping within a tenant
    payload         JSONB,                                    -- Raw text or metadata associated with the vector
    embedding       VECTOR(1536),                             -- Dimension matches text-embedding-3-small / ada-002
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for sub-millisecond cosine similarity searches
CREATE INDEX IF NOT EXISTS idx_heady_vectors_hnsw ON heady_vectors
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- B-tree indexes for tenant isolation and filtering
CREATE INDEX IF NOT EXISTS idx_heady_vectors_tenant ON heady_vectors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_heady_vectors_context ON heady_vectors(tenant_id, context_type);
CREATE INDEX IF NOT EXISTS idx_heady_vectors_namespace ON heady_vectors(tenant_id, namespace);

-- ═══════════════════════════════════════════════════════════════
-- 4. ROW-LEVEL SECURITY — Kernel-level tenant isolation
--
-- Even if application logic has a bug, the database itself will
-- physically block cross-tenant data access.
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on the vectors table
ALTER TABLE heady_vectors ENABLE ROW LEVEL SECURITY;

-- Policy: rows only visible when app.current_tenant_id matches
CREATE POLICY tenant_vector_isolation ON heady_vectors
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Enable RLS on api_keys too (defense in depth)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_key_isolation ON api_keys
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ═══════════════════════════════════════════════════════════════
-- 5. TENANT USAGE LOG — Granular metering for Stripe billing
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenant_usage_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    operation       VARCHAR(50) NOT NULL,                     -- 'vector_insert', 'vector_search', 'api_call'
    quantity        INT DEFAULT 1,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_log_tenant ON tenant_usage_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_log_operation ON tenant_usage_log(operation);

-- Enable RLS on usage log
ALTER TABLE tenant_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_usage_isolation ON tenant_usage_log
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ═══════════════════════════════════════════════════════════════
-- 6. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Auto-update updated_at on tenants
CREATE OR REPLACE FUNCTION update_tenant_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenant_updated_at ON tenants;
CREATE TRIGGER trigger_tenant_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_tenant_timestamp();

-- Tenant-scoped vector similarity search
CREATE OR REPLACE FUNCTION search_tenant_vectors(
    p_tenant_id UUID,
    p_query_embedding VECTOR(1536),
    p_context_type VARCHAR DEFAULT NULL,
    p_namespace VARCHAR DEFAULT NULL,
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    vector_id UUID,
    context_type VARCHAR,
    namespace VARCHAR,
    payload JSONB,
    similarity_score FLOAT
) AS $$
BEGIN
    -- Set tenant context for RLS
    PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, true);

    RETURN QUERY
    SELECT
        v.vector_id,
        v.context_type,
        v.namespace,
        v.payload,
        (1 - (v.embedding <=> p_query_embedding))::FLOAT AS similarity_score
    FROM heady_vectors v
    WHERE (p_context_type IS NULL OR v.context_type = p_context_type)
      AND (p_namespace IS NULL OR v.namespace = p_namespace)
    ORDER BY v.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Meter a tenant API request (atomic increment)
CREATE OR REPLACE FUNCTION meter_tenant_request(p_tenant_id UUID, p_operation VARCHAR DEFAULT 'api_call')
RETURNS VOID AS $$
BEGIN
    UPDATE tenants SET request_count = request_count + 1 WHERE tenant_id = p_tenant_id;

    INSERT INTO tenant_usage_log (tenant_id, operation)
    VALUES (p_tenant_id, p_operation);
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════
COMMENT ON TABLE tenants IS 'HeadyConnection IaaS tenant accounts with Stripe billing integration';
COMMENT ON TABLE api_keys IS 'SHA-256 hashed API keys for tenant authentication (never stores plaintext)';
COMMENT ON TABLE heady_vectors IS 'Tenant-isolated 1536-dim vector storage with HNSW indexing and RLS';
COMMENT ON TABLE tenant_usage_log IS 'Granular usage metering for Stripe metered billing';
COMMENT ON FUNCTION search_tenant_vectors IS 'RLS-aware cosine similarity search within a tenant context';
COMMENT ON FUNCTION meter_tenant_request IS 'Atomic request counter + usage log for billing';
