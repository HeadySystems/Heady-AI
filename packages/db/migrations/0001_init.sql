-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0001 — init (Neon Postgres + pgvector)       ║
-- ║  System of record: tasks + transactional outbox + idempotency +   ║
-- ║  vector_memories (384-dim, ADR-0015). © 2026 HeadySystems Inc.     ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Forward-only. The outbox is written in the SAME transaction as the state
-- change (ADR-0002), then projected to derived stores via WAL/CDC (ADR-0014).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind        TEXT NOT NULL,
  input       JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
  result      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_dep (
  task_id     UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  depends_on  UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on)
);

CREATE TABLE IF NOT EXISTS task_attempt (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  success     BOOLEAN,
  error       JSONB
);

-- ─── Transactional outbox (written in-tx with the state change) ────────────────
CREATE TABLE IF NOT EXISTS task_outbox (
  seq          BIGSERIAL PRIMARY KEY,
  task_id      UUID REFERENCES task(id) ON DELETE SET NULL,
  topic        TEXT NOT NULL,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS task_outbox_undispatched ON task_outbox (seq) WHERE dispatched_at IS NULL;

-- ─── Idempotency (at-least-once delivery dedupe) ───────────────────────────────
CREATE TABLE IF NOT EXISTS idempotency_key (
  key         TEXT PRIMARY KEY,
  scope       TEXT NOT NULL,
  result      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Vector memories (retrieval authority — 384-dim, ADR-0015) ─────────────────
CREATE TABLE IF NOT EXISTS vector_memory (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content     TEXT NOT NULL,
  embedding   vector(384) NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vector_memory_hnsw
  ON vector_memory USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);
