-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0002 — legacy schema capture (GATE-1 diff)   ║
-- ║  Captures the pre-existing March-2026 Neon tables verbatim so the ║
-- ║  migrations home fully describes the real database (additive, IF  ║
-- ║  NOT EXISTS — a fresh branch reconstructs the complete schema).    ║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Faithful capture from live introspection (branch rebuild-gate1, 2026-07-23).
-- NOTE: latent_os_memory.embedding is vector(1536) — the LEGACY pre-lock dim.
-- ADR-0015 locks the rebuild pipeline at 384; this table is captured as-is and
-- its disposition (re-embed at 384 into vector_memory, then drop) is a later,
-- founder-gated step. Do NOT write new embeddings at 1536.

CREATE TABLE IF NOT EXISTS latent_os_memory (
  id         varchar(255) PRIMARY KEY,
  file_path  text,
  language   varchar(50),
  symbol     varchar(255),
  content    text,
  embedding  vector(1536)
);
CREATE INDEX IF NOT EXISTS latent_os_memory_embedding_idx
  ON latent_os_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS buddy_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  text NOT NULL,
  device_id  text,
  role       text NOT NULL CONSTRAINT buddy_messages_role_check CHECK (role IN ('user', 'buddy', 'system')),
  text       text NOT NULL,
  node       text,
  origin     text,
  csl_score  real DEFAULT 0.618,
  embedding  vector(384),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buddy_msg_tenant
  ON buddy_messages USING btree (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buddy_msg_embedding
  ON buddy_messages USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
