-- © 2026 HeadySystems Inc. All Rights Reserved.
-- PROPRIETARY AND CONFIDENTIAL.
--
-- Migration 001: Vector Memory Table
--
-- Creates the core vector memory infrastructure:
--   - pgvector extension for 384D embedding storage
--   - pg_trgm extension for trigram text search
--   - memories table with HNSW index (m=24, ef_construction=128)
--   - GIN index on metadata JSONB column
--   - GIN trigram index on content column
--   - Automatic updated_at trigger
--
-- Run via: DATABASE_URL_DIRECT (non-pooler endpoint)
-- DDL must use direct connections — pooler endpoints do not support all DDL.
--
-- φ-Math constants used:
--   FIB[3]=2  : min pool connections
--   FIB[7]=13 : max pool connections
--   m=24      : HNSW m parameter (connectivity per layer)
--   ef_construction=128 : HNSW build-time candidate list size
--
-- Reversible: see DOWN migration at bottom of this file.

BEGIN;

-- ── Extensions ───────────────────────────────────────────────────────────────

-- pgvector: 384-dimensional vector similarity search with HNSW indexing
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_trgm: Trigram similarity for full-text approximate matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- uuid-ossp: UUID generation (used for default id values)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── memories table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS memories (
  -- Primary key: UUID v4
  id          uuid         NOT NULL DEFAULT uuid_generate_v4(),

  -- The human-readable content stored in this memory
  content     text         NOT NULL,

  -- 384-dimensional vector embedding (e.g. from all-MiniLM-L6-v2)
  embedding   vector(384)  NOT NULL,

  -- Arbitrary domain metadata (tags, source, agent, etc.)
  metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,

  -- Namespace for multi-tenant isolation (e.g. 'headyme', 'headybuddy')
  namespace   text         NOT NULL DEFAULT 'default',

  -- Timestamps
  created_at  timestamptz  NOT NULL DEFAULT NOW(),
  updated_at  timestamptz  NOT NULL DEFAULT NOW(),

  CONSTRAINT memories_pkey PRIMARY KEY (id)
);

-- ── HNSW vector index ─────────────────────────────────────────────────────────
--
-- HNSW (Hierarchical Navigable Small World) parameters:
--   m = 24             : connections per node per layer (default 16, increased for 384D)
--   ef_construction    : candidate list size during graph construction
--   = 128              : higher = better recall at build cost (default 64)
--
-- vector_cosine_ops    : cosine distance operator (1 - cosine_similarity)
--   Best for normalized embeddings from sentence transformers.
--
-- This index supports the hybrid_search function's vector ranking CTE.

CREATE INDEX IF NOT EXISTS memories_embedding_hnsw_idx
  ON memories
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);

-- ── GIN index on metadata JSONB ──────────────────────────────────────────────
--
-- Enables fast queries on metadata fields, e.g.:
--   WHERE metadata @> '{"source": "headybuddy"}'
--   WHERE metadata ? 'tag'

CREATE INDEX IF NOT EXISTS memories_metadata_gin_idx
  ON memories
  USING gin (metadata);

-- ── GIN trigram index on content ──────────────────────────────────────────────
--
-- Enables fast pg_trgm similarity queries, e.g.:
--   WHERE content % 'semantic memory retrieval'
--   WHERE content ILIKE '%memory%'
-- Also enables the text_results CTE in hybrid_search.

CREATE INDEX IF NOT EXISTS memories_content_trgm_gin_idx
  ON memories
  USING gin (content gin_trgm_ops);

-- ── Namespace index ───────────────────────────────────────────────────────────
--
-- Speeds up namespace-scoped queries (common in multi-tenant workloads).

CREATE INDEX IF NOT EXISTS memories_namespace_idx
  ON memories (namespace);

-- ── Compound index: namespace + created_at ────────────────────────────────────
--
-- Supports paginated listing within a namespace:
--   WHERE namespace = $1 ORDER BY created_at DESC LIMIT 13

CREATE INDEX IF NOT EXISTS memories_namespace_created_idx
  ON memories (namespace, created_at DESC);

-- ── Automatic updated_at trigger ──────────────────────────────────────────────
--
-- Keeps updated_at current on every UPDATE without manual management.

CREATE OR REPLACE FUNCTION memories_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS memories_updated_at_trigger ON memories;

CREATE TRIGGER memories_updated_at_trigger
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION memories_set_updated_at();

-- ── HNSW query-time ef_search configuration ───────────────────────────────────
--
-- ef_search controls recall vs speed at query time.
-- Set to FIB[8]=34 × FIB[5]=8 = 272 for high-recall production searches.
-- Can be overridden per-session for batch processing.
-- Stored as a table-level storage parameter comment for documentation.

COMMENT ON INDEX memories_embedding_hnsw_idx IS
  'HNSW cosine index: m=24, ef_construction=128 for 384D sentence embeddings. '
  'Set hnsw.ef_search=272 (FIB[8]*FIB[5]=34*8) for production recall. '
  '© 2026 HeadySystems Inc.';

-- ── Table comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE memories IS
  'Heady φ-Pure Latent OS — 384D vector memory store. '
  'Supports hybrid search via HNSW cosine similarity + pg_trgm text search (RRF fusion). '
  'Pool: min=FIB[3]=2, max=FIB[7]=13 connections. '
  '© 2026 HeadySystems Inc.';

COMMENT ON COLUMN memories.embedding IS
  '384-dimensional vector from all-MiniLM-L6-v2 or equivalent sentence transformer. '
  'HNSW index: m=24, ef_construction=128, vector_cosine_ops.';

COMMENT ON COLUMN memories.metadata IS
  'JSONB document for domain-specific attributes. '
  'Indexed with GIN for fast containment and key-existence queries.';

COMMENT ON COLUMN memories.namespace IS
  'Multi-tenant isolation key. Indexed for fast namespace-scoped queries. '
  'Convention: use Heady domain name (headyme, headybuddy, headyconnection, etc.)';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- DOWN MIGRATION (run to revert — execute in reverse order)
-- ════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- DROP TRIGGER  IF EXISTS memories_updated_at_trigger      ON memories;
-- DROP FUNCTION IF EXISTS memories_set_updated_at();
-- DROP INDEX    IF EXISTS memories_namespace_created_idx;
-- DROP INDEX    IF EXISTS memories_namespace_idx;
-- DROP INDEX    IF EXISTS memories_content_trgm_gin_idx;
-- DROP INDEX    IF EXISTS memories_metadata_gin_idx;
-- DROP INDEX    IF EXISTS memories_embedding_hnsw_idx;
-- DROP TABLE    IF EXISTS memories;
-- -- Do NOT drop extensions — they may be used by other tables.
-- COMMIT;
