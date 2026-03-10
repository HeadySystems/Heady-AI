-- Heady Systems pgvector initialization
-- Eric Haywood — Sacred Geometry v4.0
-- All sizes are Fibonacci numbers

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Vector memory table (384-dimensional, fib-inspired)
CREATE TABLE IF NOT EXISTS vector_memory (
  id            BIGSERIAL PRIMARY KEY,
  content       TEXT NOT NULL,
  embedding     vector(384) NOT NULL,
  domain        VARCHAR(89) NOT NULL DEFAULT 'general',
  metadata      JSONB DEFAULT '{}',
  importance    REAL DEFAULT 0.618,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  access_count  INTEGER DEFAULT 0,
  ttl_seconds   INTEGER DEFAULT 7776000  -- 90 days (close to fib: 89)
);

-- HNSW index: ef_construction=144 (fib(12)), m=21 (fib(8))
CREATE INDEX IF NOT EXISTS idx_vector_memory_hnsw
  ON vector_memory USING hnsw (embedding vector_cosine_ops)
  WITH (m = 21, ef_construction = 144);

-- BM25 full-text search index
CREATE INDEX IF NOT EXISTS idx_vector_memory_content_trgm
  ON vector_memory USING gin (content gin_trgm_ops);

-- Domain index for filtered queries
CREATE INDEX IF NOT EXISTS idx_vector_memory_domain
  ON vector_memory (domain);

-- Metadata GIN index
CREATE INDEX IF NOT EXISTS idx_vector_memory_metadata
  ON vector_memory USING gin (metadata);

-- Graph RAG tables
CREATE TABLE IF NOT EXISTS entities (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(233) NOT NULL,
  entity_type VARCHAR(89) NOT NULL,
  embedding   vector(384),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relationships (
  id            BIGSERIAL PRIMARY KEY,
  source_id     BIGINT REFERENCES entities(id),
  target_id     BIGINT REFERENCES entities(id),
  rel_type      VARCHAR(89) NOT NULL,
  weight        REAL DEFAULT 0.618,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_hnsw
  ON entities USING hnsw (embedding vector_cosine_ops)
  WITH (m = 21, ef_construction = 144);

CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id);

-- Communities (Louvain)
CREATE TABLE IF NOT EXISTS communities (
  id            BIGSERIAL PRIMARY KEY,
  community_id  INTEGER NOT NULL,
  summary       TEXT,
  embedding     vector(384),
  entity_ids    BIGINT[] DEFAULT '{}',
  level         INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions and auth
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR(233) NOT NULL,
  token_hash    VARCHAR(144) NOT NULL,
  ip_hash       VARCHAR(89),
  ua_hash       VARCHAR(89),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(144) NOT NULL UNIQUE,
  rollout_pct   REAL DEFAULT 0.0618,  -- phi-scaled: start at 6.18%
  csl_gate      REAL DEFAULT 0.618,
  enabled       BOOLEAN DEFAULT false,
  kill_switch   BOOLEAN DEFAULT false,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version       VARCHAR(89) PRIMARY KEY,
  applied_at    TIMESTAMPTZ DEFAULT NOW(),
  checksum      VARCHAR(89)
);

-- Analytics (privacy-first, no PII)
CREATE TABLE IF NOT EXISTS analytics_events (
  id            BIGSERIAL PRIMARY KEY,
  event_type    VARCHAR(89) NOT NULL,
  domain        VARCHAR(89) NOT NULL,
  session_hash  VARCHAR(89),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_domain_type
  ON analytics_events (domain, event_type, created_at);

-- Dead letter queue
CREATE TABLE IF NOT EXISTS dead_letters (
  id            BIGSERIAL PRIMARY KEY,
  subject       VARCHAR(233) NOT NULL,
  payload       JSONB NOT NULL,
  error         TEXT,
  attempts      INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Service registry
CREATE TABLE IF NOT EXISTS service_registry (
  id            BIGSERIAL PRIMARY KEY,
  service_name  VARCHAR(144) NOT NULL UNIQUE,
  port          INTEGER NOT NULL,
  domain        VARCHAR(89) NOT NULL,
  status        VARCHAR(34) DEFAULT 'active',
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  metadata      JSONB DEFAULT '{}'
);

-- Grants
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO heady;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO heady;
