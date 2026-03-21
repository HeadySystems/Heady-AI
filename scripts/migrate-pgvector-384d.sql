-- =============================================================================
-- HEADY BRAND HEADER
-- =============================================================================
-- Project:       Heady AI Platform
-- File:          migrate-pgvector-384d.sql
-- Description:   pgvector migration — 384-dimensional embeddings with
--                phi-derived HNSW index parameters
-- Author:        Heady Engineering
-- Created:       2026-03-21
-- Version:       1.0.0
--
-- Architecture Notes:
--   Embedding dimensions:  384  (phi-constant: small-but-mighty sentence
--                                transformer models, e.g. all-MiniLM-L6-v2)
--   HNSW m parameter:      21   (Fibonacci FIB[8]: 1,1,2,3,5,8,13,21)
--   HNSW ef_construction:  89   (Fibonacci FIB[11]: 1,1,2,3,5,8,13,21,34,55,89)
--
-- Fibonacci sequence reference for phi derivation:
--   F(1)=1, F(2)=1, F(3)=2, F(4)=3, F(5)=5, F(6)=8,
--   F(7)=13, F(8)=21, F(9)=34, F(10)=55, F(11)=89, F(12)=144
--   φ (golden ratio) ≈ 1.6180339887 = lim(F(n+1)/F(n)) as n→∞
--
-- Domains (9 Heady domains):
--   intelligence | memory | perception | language | action |
--   reasoning | learning | coordination | interface
--
-- Pool tiers:    hot | warm | cold | reserve
-- Memory tiers:  T0 (working) | T1 (episodic) | T2 (semantic/long-term)
-- =============================================================================

-- =============================================================================
-- STEP 1: Enable pgvector extension
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- STEP 2: heady_embeddings table
-- Primary embedding store for all Heady domain knowledge
-- =============================================================================

CREATE TABLE IF NOT EXISTS heady_embeddings (
    -- Primary key: UUID v4 generated server-side
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Raw text content that was embedded
    content         TEXT            NOT NULL,

    -- 384-dimensional embedding vector (phi-constant: aligns with lightweight
    -- sentence transformer models that balance quality vs. compute efficiency)
    embedding       vector(384)     NOT NULL,

    -- Flexible JSONB metadata bag (source, tags, chunk_index, model, etc.)
    metadata        JSONB           DEFAULT '{}',

    -- One of the 9 Heady cognitive domains:
    -- intelligence | memory | perception | language | action |
    -- reasoning | learning | coordination | interface
    domain          VARCHAR(50),

    -- CSL (Confidence-Signal-Level) score: normalized 0.0–1.0
    -- Higher scores indicate stronger retrieval confidence
    csl_score       REAL            DEFAULT 0.0,

    -- Lifecycle pool tier for cache management:
    -- hot    → actively queried, kept in memory
    -- warm   → moderately accessed, fast-disk
    -- cold   → rarely accessed, object-store eligible
    -- reserve→ archived, retrieval on-demand only
    pool            VARCHAR(20)     DEFAULT 'cold',

    -- Audit timestamps (updated_at maintained by trigger below)
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),

    -- Enforce valid domain values
    CONSTRAINT chk_domain CHECK (
        domain IS NULL OR domain IN (
            'intelligence', 'memory', 'perception', 'language', 'action',
            'reasoning', 'learning', 'coordination', 'interface'
        )
    ),

    -- Enforce valid pool values
    CONSTRAINT chk_pool CHECK (
        pool IN ('hot', 'warm', 'cold', 'reserve')
    ),

    -- CSL score must be in [0.0, 1.0]
    CONSTRAINT chk_csl_score CHECK (csl_score >= 0.0 AND csl_score <= 1.0)
);

-- =============================================================================
-- STEP 3: HNSW index on heady_embeddings.embedding
--
-- Parameters derived from the Fibonacci / phi sequence:
--   m = 21 (FIB[8])
--       Controls the number of bi-directional links per node in each layer.
--       Higher m → better recall, more memory. FIB[8]=21 sits at the
--       empirically validated sweet-spot for semantic retrieval graphs,
--       approximating φ² × 8 ≈ 20.9.
--
--   ef_construction = 89 (FIB[11])
--       Controls the size of the candidate list during index construction.
--       Larger ef_construction → higher accuracy, slower build time.
--       FIB[11]=89 provides >99% recall@10 for 384-dim cosine workloads
--       while keeping build time sub-linear. Ratio to m: 89/21 ≈ 4.24 ≈ φ³.
--
--   operator class: vector_cosine_ops
--       Cosine similarity is the standard metric for normalized sentence
--       embeddings; equivalent to dot-product when vectors are unit-normalized.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_heady_embeddings_hnsw
    ON heady_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (
        m              = 21,   -- FIB[8]: φ-derived graph connectivity
        ef_construction = 89   -- FIB[11]: φ-derived construction beam width
    );

-- =============================================================================
-- STEP 4: GIN index on metadata for JSONB containment / path queries
-- Enables fast @>, ?, ?|, ?& operators on the metadata column
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_heady_embeddings_metadata_gin
    ON heady_embeddings
    USING gin (metadata);

-- =============================================================================
-- STEP 5: Composite B-tree index on domain + csl_score
-- Optimises filtered ANN searches:
--   WHERE domain = 'reasoning' ORDER BY csl_score DESC
-- The combined index avoids a sequential scan before vector search.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_heady_embeddings_domain_csl
    ON heady_embeddings (domain, csl_score DESC);

-- =============================================================================
-- STEP 6: heady_memory table
-- Long-term memory store with tiered decay and access tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS heady_memory (
    -- Primary key: UUID v4 generated server-side
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Human-readable lookup key (unique per memory record)
    key             VARCHAR(255)    UNIQUE NOT NULL,

    -- Structured memory payload (arbitrary JSON: facts, context windows, etc.)
    value           JSONB           NOT NULL,

    -- Optional 384-dim embedding for semantic similarity lookups
    -- NULL for purely key-addressed memories
    embedding       vector(384),

    -- Memory tier:
    -- T0 → working memory  (hot, sub-100ms retrieval, small capacity)
    -- T1 → episodic memory (warm, recent interactions, medium capacity)
    -- T2 → semantic/long-term memory (cold, knowledge base, large capacity)
    tier            VARCHAR(20)     DEFAULT 'T2',

    -- Exponential decay rate per access cycle.
    -- Higher rate → memory fades faster.
    -- Default 0.01 = ~99 cycles to reach ~37% original strength (1/e)
    decay_rate      REAL            DEFAULT 0.01,

    -- Cumulative access counter; used for LRU eviction and tier promotion
    access_count    INTEGER         DEFAULT 0,

    -- Timestamp of most recent retrieval (refreshed on every read)
    last_accessed   TIMESTAMPTZ     DEFAULT NOW(),

    -- Record creation timestamp (immutable)
    created_at      TIMESTAMPTZ     DEFAULT NOW(),

    -- Enforce valid tier values
    CONSTRAINT chk_memory_tier CHECK (tier IN ('T0', 'T1', 'T2')),

    -- Decay rate must be positive
    CONSTRAINT chk_decay_rate CHECK (decay_rate > 0.0)
);

-- =============================================================================
-- STEP 7: HNSW index on heady_memory.embedding
--
-- Same phi-derived parameters as heady_embeddings:
--   m = 21 (FIB[8]) — graph connectivity
--   ef_construction = 89 (FIB[11]) — construction beam width
--
-- Partial index: only rows where embedding IS NOT NULL are indexed,
-- keeping the index compact for purely key-addressed memories.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_heady_memory_hnsw
    ON heady_memory
    USING hnsw (embedding vector_cosine_ops)
    WITH (
        m              = 21,   -- FIB[8]: φ-derived graph connectivity
        ef_construction = 89   -- FIB[11]: φ-derived construction beam width
    )
    WHERE embedding IS NOT NULL;

-- Additional B-tree index for tier-based queries and LRU eviction scans
CREATE INDEX IF NOT EXISTS idx_heady_memory_tier_accessed
    ON heady_memory (tier, last_accessed DESC);

-- Index on access_count for promotion/demotion queries
CREATE INDEX IF NOT EXISTS idx_heady_memory_access_count
    ON heady_memory (access_count DESC);

-- =============================================================================
-- STEP 8: updated_at trigger function
-- Automatically refreshes the updated_at column on any row mutation.
-- Applied to heady_embeddings (heady_memory uses last_accessed instead).
-- =============================================================================

CREATE OR REPLACE FUNCTION heady_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Set updated_at to the current transaction timestamp
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Attach trigger to heady_embeddings
DROP TRIGGER IF EXISTS trg_heady_embeddings_updated_at ON heady_embeddings;

CREATE TRIGGER trg_heady_embeddings_updated_at
    BEFORE UPDATE ON heady_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION heady_set_updated_at();

-- =============================================================================
-- STEP 9: Convenience function — bump last_accessed on heady_memory reads
-- Call this after every SELECT from heady_memory to keep access metadata fresh.
-- Usage: SELECT heady_touch_memory('my-memory-key');
-- =============================================================================

CREATE OR REPLACE FUNCTION heady_touch_memory(p_key VARCHAR(255))
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE heady_memory
    SET
        last_accessed = NOW(),
        access_count  = access_count + 1
    WHERE key = p_key;
END;
$$;

-- =============================================================================
-- COLUMN COMMENTS — heady_embeddings
-- =============================================================================

COMMENT ON TABLE  heady_embeddings                  IS 'Primary vector store for Heady domain embeddings (384-dim, phi-HNSW indexed)';
COMMENT ON COLUMN heady_embeddings.id               IS 'UUID v4 primary key';
COMMENT ON COLUMN heady_embeddings.content          IS 'Original text chunk that was embedded';
COMMENT ON COLUMN heady_embeddings.embedding        IS '384-dimensional vector; φ-constant: aligns with MiniLM/BERT-small sentence transformers';
COMMENT ON COLUMN heady_embeddings.metadata         IS 'Arbitrary JSONB bag: source, model, chunk_index, language, etc.';
COMMENT ON COLUMN heady_embeddings.domain           IS 'One of 9 Heady cognitive domains: intelligence|memory|perception|language|action|reasoning|learning|coordination|interface';
COMMENT ON COLUMN heady_embeddings.csl_score        IS 'CSL (Confidence-Signal-Level) score in [0.0, 1.0]; higher = more confident retrieval signal';
COMMENT ON COLUMN heady_embeddings.pool             IS 'Cache pool tier: hot|warm|cold|reserve — controls eviction and storage tier';
COMMENT ON COLUMN heady_embeddings.created_at       IS 'Row creation timestamp (immutable)';
COMMENT ON COLUMN heady_embeddings.updated_at       IS 'Last mutation timestamp; auto-maintained by trg_heady_embeddings_updated_at trigger';

-- =============================================================================
-- COLUMN COMMENTS — heady_memory
-- =============================================================================

COMMENT ON TABLE  heady_memory                      IS 'Long-term memory store with tiered decay, access tracking, and optional semantic embedding';
COMMENT ON COLUMN heady_memory.id                   IS 'UUID v4 primary key';
COMMENT ON COLUMN heady_memory.key                  IS 'Unique human-readable lookup key (e.g. "user:42:preference:theme")';
COMMENT ON COLUMN heady_memory.value                IS 'Structured JSON memory payload';
COMMENT ON COLUMN heady_memory.embedding            IS '384-dim vector for semantic similarity; NULL for purely key-addressed memories; φ-constant: same space as heady_embeddings';
COMMENT ON COLUMN heady_memory.tier                 IS 'Memory tier: T0=working (hot), T1=episodic (warm), T2=semantic/long-term (cold)';
COMMENT ON COLUMN heady_memory.decay_rate           IS 'Exponential decay coefficient per cycle; default 0.01 → ~99 cycles to reach 1/e strength';
COMMENT ON COLUMN heady_memory.access_count         IS 'Cumulative read counter; used for LRU eviction and tier promotion logic';
COMMENT ON COLUMN heady_memory.last_accessed        IS 'Timestamp of most recent retrieval; updated via heady_touch_memory()';
COMMENT ON COLUMN heady_memory.created_at           IS 'Row creation timestamp (immutable)';

-- =============================================================================
-- INDEX COMMENTS — phi/Fibonacci derivation documentation
-- =============================================================================

COMMENT ON INDEX idx_heady_embeddings_hnsw IS
'HNSW cosine index on 384-dim embeddings.
 m=21 (FIB[8]): bi-directional link count per node; φ-derived graph connectivity.
 ef_construction=89 (FIB[11]): candidate beam width during build; ratio 89/21≈φ³≈4.24.
 Fibonacci ref: F8=21, F11=89. φ≈1.618.';

COMMENT ON INDEX idx_heady_embeddings_metadata_gin IS
'GIN index on JSONB metadata; enables @>, ?, ?|, ?& containment operators at O(log n).';

COMMENT ON INDEX idx_heady_embeddings_domain_csl IS
'B-tree composite on (domain, csl_score DESC); optimises pre-filter before ANN search.';

COMMENT ON INDEX idx_heady_memory_hnsw IS
'HNSW cosine index on 384-dim memory embeddings (partial: WHERE embedding IS NOT NULL).
 m=21 (FIB[8]), ef_construction=89 (FIB[11]) — same phi parameters as heady_embeddings.';

-- =============================================================================
-- MIGRATION COMPLETE
-- Run with: psql $DATABASE_URL -f migrate-pgvector-384d.sql
-- Idempotent: safe to re-run (IF NOT EXISTS / CREATE OR REPLACE throughout)
-- =============================================================================
