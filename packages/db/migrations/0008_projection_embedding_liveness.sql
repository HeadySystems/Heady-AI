-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0008 — projection source and alive state    ║
-- ║  Durable context intake, idempotent embedding jobs, and mutable   ║
-- ║  operational liveness proof under forced tenant isolation.        ║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE TABLE heady_runtime.context_source (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'),
  trace_id          UUID,
  content_sha256    TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  content           TEXT NOT NULL CHECK (length(content) > 0),
  provenance        JSONB NOT NULL CHECK (jsonb_typeof(provenance) = 'array' AND jsonb_array_length(provenance) > 0),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  embedding_status  TEXT NOT NULL DEFAULT 'QUEUED' CHECK (embedding_status IN ('QUEUED', 'PROCESSING', 'READY', 'FAILED')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, content_sha256)
);

CREATE TABLE heady_runtime.embedding_job (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'),
  source_id        UUID NOT NULL REFERENCES heady_runtime.context_source(id) ON DELETE RESTRICT,
  idempotency_key  TEXT NOT NULL,
  model            TEXT NOT NULL CHECK (model = '@cf/baai/bge-small-en-v1.5'),
  state            TEXT NOT NULL DEFAULT 'QUEUED' CHECK (state IN ('QUEUED', 'PROCESSING', 'READY', 'FAILED')),
  attempts         INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_code       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE heady_runtime.alive_probe (
  tenant_id    TEXT PRIMARY KEY CHECK (tenant_id ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'),
  probe_id     UUID NOT NULL,
  revision     TEXT NOT NULL,
  observed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE heady_runtime.context_fragment ADD COLUMN source_id UUID;
ALTER TABLE heady_runtime.context_fragment
  ADD CONSTRAINT context_fragment_source_fk
  FOREIGN KEY (source_id) REFERENCES heady_runtime.context_source(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE heady_runtime.context_fragment VALIDATE CONSTRAINT context_fragment_source_fk;
ALTER TABLE heady_runtime.context_fragment ALTER COLUMN source_id SET NOT NULL;

CREATE INDEX context_source_tenant_status
  ON heady_runtime.context_source (tenant_id, embedding_status, created_at);
CREATE INDEX embedding_job_ready
  ON heady_runtime.embedding_job (tenant_id, state, available_at)
  WHERE state IN ('QUEUED', 'FAILED');
CREATE INDEX context_fragment_source
  ON heady_runtime.context_fragment (tenant_id, source_id);

ALTER TABLE heady_runtime.context_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.context_source FORCE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.embedding_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.embedding_job FORCE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.alive_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.alive_probe FORCE ROW LEVEL SECURITY;

CREATE POLICY context_source_tenant_isolation ON heady_runtime.context_source
USING (tenant_id = current_setting('heady.tenant_id', true))
WITH CHECK (tenant_id = current_setting('heady.tenant_id', true));
CREATE POLICY embedding_job_tenant_isolation ON heady_runtime.embedding_job
USING (tenant_id = current_setting('heady.tenant_id', true))
WITH CHECK (tenant_id = current_setting('heady.tenant_id', true));
CREATE POLICY alive_probe_tenant_isolation ON heady_runtime.alive_probe
USING (tenant_id = current_setting('heady.tenant_id', true))
WITH CHECK (tenant_id = current_setting('heady.tenant_id', true));

REVOKE ALL ON heady_runtime.context_source FROM PUBLIC, authenticated, anonymous;
REVOKE ALL ON heady_runtime.embedding_job FROM PUBLIC, authenticated, anonymous;
REVOKE ALL ON heady_runtime.alive_probe FROM PUBLIC, authenticated, anonymous;

GRANT SELECT, INSERT ON heady_runtime.context_source TO heady_runtime_api;
GRANT UPDATE (embedding_status, updated_at) ON heady_runtime.context_source TO heady_runtime_api;
GRANT SELECT, INSERT ON heady_runtime.embedding_job TO heady_runtime_api;
GRANT UPDATE (state, attempts, available_at, error_code, updated_at) ON heady_runtime.embedding_job TO heady_runtime_api;
GRANT SELECT, INSERT, UPDATE ON heady_runtime.alive_probe TO heady_runtime_api;
