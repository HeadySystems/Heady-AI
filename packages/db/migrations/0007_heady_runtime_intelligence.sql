-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0007 — governed runtime Intelligence SoR    ║
-- ║  Durable command traces, immutable decisions/outcomes, and the    ║
-- ║  tenant-isolated 384-dim canonical context retrieval authority.   ║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS heady_runtime;
REVOKE ALL ON SCHEMA heady_runtime FROM PUBLIC;

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'heady_runtime_api') THEN
    CREATE ROLE heady_runtime_api
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$role$;

CREATE TABLE heady_runtime.command_run (
  trace_id        UUID PRIMARY KEY,
  tenant_id       TEXT NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'),
  capability      TEXT NOT NULL,
  principal       JSONB NOT NULL,
  input_sha256    TEXT NOT NULL CHECK (input_sha256 ~ '^[a-f0-9]{64}$'),
  status          TEXT NOT NULL CHECK (status IN ('STARTED', 'SUCCEEDED', 'FAILED')),
  result          JSONB,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  CHECK ((status = 'STARTED' AND completed_at IS NULL) OR (status <> 'STARTED' AND completed_at IS NOT NULL))
);

CREATE TABLE heady_runtime.intelligence_decision (
  decision_id          UUID PRIMARY KEY,
  trace_id             UUID NOT NULL REFERENCES heady_runtime.command_run(trace_id) ON DELETE RESTRICT,
  tenant_id            TEXT NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'),
  process              TEXT NOT NULL,
  input_sha256         TEXT NOT NULL CHECK (input_sha256 ~ '^[a-f0-9]{64}$'),
  retrieved_provenance JSONB NOT NULL CHECK (jsonb_typeof(retrieved_provenance) = 'array'),
  coherence            DOUBLE PRECISION NOT NULL CHECK (coherence >= 0 AND coherence <= 1),
  decision             TEXT NOT NULL,
  decided_at           TIMESTAMPTZ NOT NULL
);

CREATE TABLE heady_runtime.intelligence_outcome (
  decision_id  UUID PRIMARY KEY REFERENCES heady_runtime.intelligence_decision(decision_id) ON DELETE RESTRICT,
  trace_id     UUID NOT NULL REFERENCES heady_runtime.command_run(trace_id) ON DELETE RESTRICT,
  tenant_id    TEXT NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'),
  status       TEXT NOT NULL,
  payload      JSONB NOT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE heady_runtime.context_fragment (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          TEXT NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'),
  content_sha256     TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  content            TEXT NOT NULL CHECK (length(content) > 0),
  embedding          vector(384) NOT NULL,
  embedding_model    TEXT NOT NULL CHECK (embedding_model = '@cf/baai/bge-small-en-v1.5'),
  provenance         JSONB NOT NULL CHECK (jsonb_typeof(provenance) = 'array' AND jsonb_array_length(provenance) > 0),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  source_updated_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, content_sha256)
);

CREATE INDEX command_run_tenant_requested
  ON heady_runtime.command_run (tenant_id, requested_at DESC);
CREATE INDEX intelligence_decision_trace
  ON heady_runtime.intelligence_decision (tenant_id, trace_id);
CREATE INDEX intelligence_outcome_trace
  ON heady_runtime.intelligence_outcome (tenant_id, trace_id);
CREATE INDEX context_fragment_tenant_updated
  ON heady_runtime.context_fragment (tenant_id, updated_at DESC);
CREATE INDEX context_fragment_embedding_hnsw
  ON heady_runtime.context_fragment USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);

CREATE FUNCTION heady_runtime.reject_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  RAISE EXCEPTION 'immutable Heady Intelligence records cannot be updated or deleted';
END
$body$;

CREATE TRIGGER intelligence_decision_immutable
BEFORE UPDATE OR DELETE ON heady_runtime.intelligence_decision
FOR EACH ROW EXECUTE FUNCTION heady_runtime.reject_immutable_mutation();

CREATE TRIGGER intelligence_outcome_immutable
BEFORE UPDATE OR DELETE ON heady_runtime.intelligence_outcome
FOR EACH ROW EXECUTE FUNCTION heady_runtime.reject_immutable_mutation();

ALTER TABLE heady_runtime.command_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.command_run FORCE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.intelligence_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.intelligence_decision FORCE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.intelligence_outcome ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.intelligence_outcome FORCE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.context_fragment ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.context_fragment FORCE ROW LEVEL SECURITY;

CREATE POLICY command_run_tenant_isolation ON heady_runtime.command_run
USING (tenant_id = current_setting('heady.tenant_id', true))
WITH CHECK (tenant_id = current_setting('heady.tenant_id', true));
CREATE POLICY intelligence_decision_tenant_isolation ON heady_runtime.intelligence_decision
USING (tenant_id = current_setting('heady.tenant_id', true))
WITH CHECK (tenant_id = current_setting('heady.tenant_id', true));
CREATE POLICY intelligence_outcome_tenant_isolation ON heady_runtime.intelligence_outcome
USING (tenant_id = current_setting('heady.tenant_id', true))
WITH CHECK (tenant_id = current_setting('heady.tenant_id', true));
CREATE POLICY context_fragment_tenant_isolation ON heady_runtime.context_fragment
USING (tenant_id = current_setting('heady.tenant_id', true))
WITH CHECK (tenant_id = current_setting('heady.tenant_id', true));

REVOKE ALL ON ALL TABLES IN SCHEMA heady_runtime FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA heady_runtime FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA heady_runtime FROM authenticated, anonymous;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA heady_runtime FROM authenticated, anonymous;

GRANT USAGE ON SCHEMA heady_runtime TO heady_runtime_api;
GRANT SELECT, INSERT, UPDATE ON heady_runtime.command_run TO heady_runtime_api;
GRANT SELECT, INSERT ON heady_runtime.intelligence_decision TO heady_runtime_api;
GRANT SELECT, INSERT ON heady_runtime.intelligence_outcome TO heady_runtime_api;
GRANT SELECT, INSERT, UPDATE ON heady_runtime.context_fragment TO heady_runtime_api;
GRANT heady_runtime_api TO neondb_owner;

ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA heady_runtime
  REVOKE ALL ON TABLES FROM PUBLIC, authenticated, anonymous;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA heady_runtime
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, authenticated, anonymous;
