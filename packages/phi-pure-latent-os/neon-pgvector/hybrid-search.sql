-- © 2026 HeadySystems Inc. All Rights Reserved.
-- PROPRIETARY AND CONFIDENTIAL.
--
-- Hybrid Search SQL Function — Reciprocal Rank Fusion (RRF)
--
-- Combines pgvector HNSW cosine-similarity vector search with
-- pg_trgm full-text trigram search via RRF score fusion.
--
-- HNSW index parameters (defined in migration 001_vector_memory.sql):
--   m = 24, ef_construction = 128, for 384-dimensional vectors
--
-- RRF formula: score(d) = sum_i( 1 / (rrf_k + rank_i(d)) )
--   where rrf_k is a smoothing constant (default 60, from Cormack et al. 2009)
--
-- Usage example:
--   SELECT * FROM hybrid_search(
--     query_embedding := '[0.1, 0.2, ...]'::vector(384),
--     query_text       := 'semantic memory retrieval',
--     match_count      := 10,
--     rrf_k            := 60,
--     vector_weight    := 0.7,
--     text_weight      := 0.3
--   );
--
-- Dependencies:
--   - pgvector extension (CREATE EXTENSION vector)
--   - pg_trgm extension (CREATE EXTENSION pg_trgm)
--   - memories table (see migrations/001_vector_memory.sql)
--
-- All parameterized — no string interpolation.

CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding  vector(384),
  query_text       text,
  match_count      int     DEFAULT 10,
  rrf_k            int     DEFAULT 60,
  vector_weight    float   DEFAULT 0.7,
  text_weight      float   DEFAULT 0.3
)
RETURNS TABLE (
  id        uuid,
  content   text,
  metadata  jsonb,
  score     float
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
BEGIN
  -- ── Input validation ────────────────────────────────────────────────────────
  IF match_count < 1 THEN
    RAISE EXCEPTION 'match_count must be >= 1, got %', match_count;
  END IF;

  IF rrf_k < 1 THEN
    RAISE EXCEPTION 'rrf_k must be >= 1, got %', rrf_k;
  END IF;

  IF vector_weight < 0 OR vector_weight > 1 THEN
    RAISE EXCEPTION 'vector_weight must be in [0, 1], got %', vector_weight;
  END IF;

  IF text_weight < 0 OR text_weight > 1 THEN
    RAISE EXCEPTION 'text_weight must be in [0, 1], got %', text_weight;
  END IF;

  -- ── RRF Hybrid Search ───────────────────────────────────────────────────────
  RETURN QUERY
  WITH

  -- ── CTE 1: Vector (HNSW cosine) ranked results ─────────────────────────────
  -- Uses the HNSW index on embedding with vector_cosine_ops.
  -- Ordered by cosine distance ascending (closer = more similar).
  -- Candidate pool = match_count * 10 to give RRF enough candidates to merge.
  vector_results AS (
    SELECT
      m.id,
      m.content,
      m.metadata,
      ROW_NUMBER() OVER (
        ORDER BY m.embedding <=> query_embedding ASC
      ) AS vector_rank,
      1 - (m.embedding <=> query_embedding) AS cosine_similarity
    FROM memories m
    ORDER BY m.embedding <=> query_embedding ASC
    LIMIT (match_count * 10)
  ),

  -- ── CTE 2: Text (pg_trgm similarity) ranked results ────────────────────────
  -- Uses GIN trigram index on content for fast text similarity.
  -- Only considers rows with similarity > 0.1 to avoid noise.
  text_results AS (
    SELECT
      m.id,
      m.content,
      m.metadata,
      ROW_NUMBER() OVER (
        ORDER BY similarity(m.content, query_text) DESC
      ) AS text_rank,
      similarity(m.content, query_text) AS text_similarity
    FROM memories m
    WHERE m.content % query_text  -- pg_trgm % operator uses similarity threshold
       OR m.content ILIKE '%' || query_text || '%'  -- fallback for short queries
    ORDER BY similarity(m.content, query_text) DESC
    LIMIT (match_count * 10)
  ),

  -- ── CTE 3: Collect all candidate IDs from both ranking lists ───────────────
  all_candidates AS (
    SELECT id FROM vector_results
    UNION
    SELECT id FROM text_results
  ),

  -- ── CTE 4: Join candidates back to both result sets and compute RRF score ──
  -- RRF formula: 1 / (rrf_k + rank)
  -- Weighted combination: vector_weight × vector_rrf + text_weight × text_rrf
  -- If a candidate appears in only one list, the other list contribution is 0.
  rrf_scores AS (
    SELECT
      ac.id,
      COALESCE(
        (vector_weight::float * (1.0 / (rrf_k + COALESCE(vr.vector_rank, match_count * 10 + 1))))
        + (text_weight::float  * (1.0 / (rrf_k + COALESCE(tr.text_rank,  match_count * 10 + 1)))),
        0.0
      ) AS rrf_score,
      COALESCE(vr.cosine_similarity, 0.0) AS cosine_similarity,
      COALESCE(tr.text_similarity,   0.0) AS text_similarity,
      COALESCE(vr.vector_rank,       match_count * 10 + 1) AS vector_rank,
      COALESCE(tr.text_rank,         match_count * 10 + 1) AS text_rank
    FROM all_candidates ac
    LEFT JOIN vector_results vr ON ac.id = vr.id
    LEFT JOIN text_results   tr ON ac.id = tr.id
  ),

  -- ── CTE 5: Fetch full memory rows for top-ranked candidates ─────────────────
  top_candidates AS (
    SELECT
      rs.id,
      rs.rrf_score,
      rs.cosine_similarity,
      rs.text_similarity,
      rs.vector_rank,
      rs.text_rank
    FROM rrf_scores rs
    ORDER BY rs.rrf_score DESC
    LIMIT match_count
  )

  -- ── Final: Return id, content, metadata, and fused score ───────────────────
  SELECT
    m.id,
    m.content,
    m.metadata,
    tc.rrf_score AS score
  FROM top_candidates tc
  JOIN memories m ON m.id = tc.id
  ORDER BY tc.rrf_score DESC;
END;
$$;

-- ── Grant execute to the application role ────────────────────────────────────
-- Replace 'app_role' with your actual application database role.
-- GRANT EXECUTE ON FUNCTION hybrid_search(vector(384), text, int, int, float, float)
--   TO app_role;

-- ── Ensure pg_trgm similarity threshold is set for the session ───────────────
-- SET pg_trgm.similarity_threshold = 0.1;
-- This should be set at the pool level or connection startup.

COMMENT ON FUNCTION hybrid_search(vector(384), text, int, int, float, float) IS
  'Reciprocal Rank Fusion (RRF) hybrid search combining pgvector HNSW cosine similarity '
  'with pg_trgm text similarity. '
  'HNSW index: m=24, ef_construction=128, 384D vectors (vector_cosine_ops). '
  'RRF formula: score = vector_weight*(1/(rrf_k+vector_rank)) + text_weight*(1/(rrf_k+text_rank)). '
  '© 2026 HeadySystems Inc.';
