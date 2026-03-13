-- HeadyMemory T2 (Long-Term) Partitioned Storage
-- 3 sub-spaces: semantic, episodic, procedural
-- 4 partitions: hot, warm, cold, archive
-- Decay rates: semantic=psi^4, episodic=psi^2, procedural=0 (no decay)

-- T2: Long-Term Memory — partitioned by sub-space
CREATE TABLE IF NOT EXISTS heady_memory_t2 (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subspace      TEXT NOT NULL CHECK (subspace IN ('semantic', 'episodic', 'procedural')),
  partition     TEXT NOT NULL DEFAULT 'hot' CHECK (partition IN ('hot', 'warm', 'cold', 'archive')),
  embedding     vector(1536) NOT NULL,
  content       JSONB NOT NULL,
  content_hash  TEXT NOT NULL,
  domain        TEXT NOT NULL DEFAULT 'general',
  source_node   TEXT NOT NULL,
  importance    DOUBLE PRECISION NOT NULL DEFAULT 0.618034,
  access_count  INTEGER NOT NULL DEFAULT 0,
  reinforcement INTEGER NOT NULL DEFAULT 0,
  decay_rate    DOUBLE PRECISION NOT NULL DEFAULT 0.145898,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promoted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata      JSONB DEFAULT '{}',
  CONSTRAINT unique_t2_content UNIQUE (content_hash, subspace)
);

-- HNSW indexes per sub-space for scoped searches
CREATE INDEX IF NOT EXISTS idx_t2_semantic_hnsw
  ON heady_memory_t2
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE subspace = 'semantic';

CREATE INDEX IF NOT EXISTS idx_t2_episodic_hnsw
  ON heady_memory_t2
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE subspace = 'episodic';

CREATE INDEX IF NOT EXISTS idx_t2_procedural_hnsw
  ON heady_memory_t2
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE subspace = 'procedural';

-- Index for partition sweeps
CREATE INDEX IF NOT EXISTS idx_t2_partition
  ON heady_memory_t2 (partition, last_accessed);

-- Index for sub-space scoped queries
CREATE INDEX IF NOT EXISTS idx_t2_subspace_domain
  ON heady_memory_t2 (subspace, domain);

-- Partition sweep: move entries between hot → warm → cold → archive
-- Based on last_accessed age relative to Fibonacci intervals
CREATE OR REPLACE FUNCTION heady_t2_partition_sweep() RETURNS TABLE(
  moved_to_warm INTEGER,
  moved_to_cold INTEGER,
  moved_to_archive INTEGER
) AS $$
DECLARE
  cnt_warm INTEGER := 0;
  cnt_cold INTEGER := 0;
  cnt_archive INTEGER := 0;
BEGIN
  -- Hot → Warm: not accessed in 8 hours (fib: 8)
  UPDATE heady_memory_t2
    SET partition = 'warm'
    WHERE partition = 'hot'
      AND last_accessed < NOW() - INTERVAL '8 hours';
  GET DIAGNOSTICS cnt_warm = ROW_COUNT;

  -- Warm → Cold: not accessed in 24 hours (fib: 13+8+3)
  UPDATE heady_memory_t2
    SET partition = 'cold'
    WHERE partition = 'warm'
      AND last_accessed < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS cnt_cold = ROW_COUNT;

  -- Cold → Archive: not accessed in 7 days
  UPDATE heady_memory_t2
    SET partition = 'archive'
    WHERE partition = 'cold'
      AND last_accessed < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS cnt_archive = ROW_COUNT;

  RETURN QUERY SELECT cnt_warm, cnt_cold, cnt_archive;
END;
$$ LANGUAGE plpgsql;

-- Apply decay to importance based on sub-space decay rates
-- semantic: psi^4 = 0.1459, episodic: psi^2 = 0.3820, procedural: 0 (no decay)
CREATE OR REPLACE FUNCTION heady_t2_apply_decay() RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE heady_memory_t2
    SET importance = GREATEST(0.01, importance * (1.0 - decay_rate))
    WHERE decay_rate > 0
      AND last_accessed < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql;

-- Promote T1 entry to T2 (called by consolidation)
CREATE OR REPLACE FUNCTION heady_promote_t1_to_t2(
  p_id UUID,
  p_subspace TEXT DEFAULT 'semantic'
) RETURNS BOOLEAN AS $$
DECLARE
  t1_row heady_memory_t1%ROWTYPE;
  decay DOUBLE PRECISION;
BEGIN
  SELECT * INTO t1_row FROM heady_memory_t1 WHERE id = p_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Set decay rate based on sub-space
  CASE p_subspace
    WHEN 'semantic' THEN decay := 0.145898;   -- psi^4
    WHEN 'episodic' THEN decay := 0.382066;   -- psi^2
    WHEN 'procedural' THEN decay := 0.0;       -- no decay
    ELSE decay := 0.145898;
  END CASE;

  INSERT INTO heady_memory_t2 (
    embedding, content, content_hash, domain, source_node,
    importance, access_count, reinforcement, decay_rate,
    subspace, partition, metadata
  ) VALUES (
    t1_row.embedding, t1_row.content, t1_row.content_hash,
    t1_row.domain, t1_row.source_node, t1_row.importance,
    t1_row.access_count, t1_row.reinforcement, decay,
    p_subspace, 'hot', t1_row.metadata
  )
  ON CONFLICT (content_hash, subspace) DO UPDATE SET
    access_count = heady_memory_t2.access_count + t1_row.access_count,
    reinforcement = heady_memory_t2.reinforcement + 1,
    importance = GREATEST(heady_memory_t2.importance, t1_row.importance),
    last_accessed = NOW(),
    partition = 'hot';

  -- Remove from T1 after promotion
  DELETE FROM heady_memory_t1 WHERE id = p_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
