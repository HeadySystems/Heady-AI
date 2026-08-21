-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0009 — conversation speaker attribution     ║
-- ║  Shared conversations retain explicit, correctable speaker data;  ║
-- ║  uncertain turns cannot enter speaker-specific semantic memory.   ║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE TABLE heady_runtime.conversation_session (
  tenant_id                 TEXT NOT NULL CHECK (tenant_id ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'),
  conversation_id           UUID NOT NULL,
  active_speaker_id         TEXT NOT NULL DEFAULT 'unknown' CHECK (active_speaker_id ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'),
  active_speaker_basis      TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (active_speaker_basis IN ('AUTHENTICATED', 'EXPLICIT_CLAIM', 'INFERRED', 'UNKNOWN')),
  active_speaker_confidence DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (active_speaker_confidence >= 0 AND active_speaker_confidence <= 1),
  revision                  INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, conversation_id),
  CHECK (
    (active_speaker_basis = 'UNKNOWN' AND active_speaker_id = 'unknown' AND active_speaker_confidence = 0)
    OR active_speaker_basis <> 'UNKNOWN'
  ),
  CHECK (active_speaker_basis <> 'AUTHENTICATED' OR active_speaker_confidence = 1)
);

DO $precondition$
BEGIN
  IF EXISTS (SELECT 1 FROM heady_runtime.context_source) THEN
    RAISE EXCEPTION 'migration 0009 requires explicit speaker attribution for existing context sources';
  END IF;
END
$precondition$;

ALTER TABLE heady_runtime.context_source ADD COLUMN conversation_id UUID;
ALTER TABLE heady_runtime.context_source ADD COLUMN turn_id UUID;
ALTER TABLE heady_runtime.context_source ADD COLUMN speaker_id TEXT;
ALTER TABLE heady_runtime.context_source ADD COLUMN speaker_basis TEXT;
ALTER TABLE heady_runtime.context_source ADD COLUMN speaker_confidence DOUBLE PRECISION;
ALTER TABLE heady_runtime.context_source ADD COLUMN attribution JSONB;
ALTER TABLE heady_runtime.context_source ADD COLUMN attribution_revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE heady_runtime.context_source ALTER COLUMN conversation_id SET NOT NULL;
ALTER TABLE heady_runtime.context_source ALTER COLUMN turn_id SET NOT NULL;
ALTER TABLE heady_runtime.context_source ALTER COLUMN speaker_id SET NOT NULL;
ALTER TABLE heady_runtime.context_source ALTER COLUMN speaker_basis SET NOT NULL;
ALTER TABLE heady_runtime.context_source ALTER COLUMN speaker_confidence SET NOT NULL;
ALTER TABLE heady_runtime.context_source ALTER COLUMN attribution SET NOT NULL;

ALTER TABLE heady_runtime.context_source
  ADD CONSTRAINT context_source_speaker_id
  CHECK (speaker_id ~ '^[a-z0-9][a-z0-9:_-]{0,127}$');
ALTER TABLE heady_runtime.context_source
  ADD CONSTRAINT context_source_speaker_basis
  CHECK (speaker_basis IN ('AUTHENTICATED', 'EXPLICIT_CLAIM', 'INFERRED', 'UNKNOWN'));
ALTER TABLE heady_runtime.context_source
  ADD CONSTRAINT context_source_speaker_confidence
  CHECK (speaker_confidence >= 0 AND speaker_confidence <= 1);
ALTER TABLE heady_runtime.context_source
  ADD CONSTRAINT context_source_attribution_object
  CHECK (jsonb_typeof(attribution) = 'object');
ALTER TABLE heady_runtime.context_source
  ADD CONSTRAINT context_source_unknown_consistency
  CHECK (
    (speaker_basis = 'UNKNOWN' AND speaker_id = 'unknown' AND speaker_confidence = 0)
    OR speaker_basis <> 'UNKNOWN'
  );
ALTER TABLE heady_runtime.context_source
  ADD CONSTRAINT context_source_authenticated_confidence
  CHECK (speaker_basis <> 'AUTHENTICATED' OR speaker_confidence = 1);
ALTER TABLE heady_runtime.context_source
  ADD CONSTRAINT context_source_turn_unique
  UNIQUE (tenant_id, conversation_id, turn_id);

ALTER TABLE heady_runtime.context_source
  DROP CONSTRAINT context_source_tenant_id_content_sha256_key;
CREATE INDEX context_source_content_sha256
  ON heady_runtime.context_source (tenant_id, content_sha256);

ALTER TABLE heady_runtime.context_fragment
  DROP CONSTRAINT context_fragment_tenant_id_content_sha256_key;
DROP INDEX heady_runtime.context_fragment_source;
CREATE UNIQUE INDEX context_fragment_tenant_source_unique
  ON heady_runtime.context_fragment (tenant_id, source_id);

CREATE INDEX context_source_speaker_time
  ON heady_runtime.context_source (tenant_id, speaker_id, created_at DESC);

ALTER TABLE heady_runtime.conversation_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_runtime.conversation_session FORCE ROW LEVEL SECURITY;
CREATE POLICY conversation_session_tenant_isolation ON heady_runtime.conversation_session
USING (tenant_id = current_setting('heady.tenant_id', true))
WITH CHECK (tenant_id = current_setting('heady.tenant_id', true));

REVOKE ALL ON heady_runtime.conversation_session FROM PUBLIC, authenticated, anonymous;
GRANT SELECT, INSERT, UPDATE ON heady_runtime.conversation_session TO heady_runtime_api;

CREATE FUNCTION heady_runtime.bump_attribution_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  NEW.attribution_revision := OLD.attribution_revision + 1;
  NEW.updated_at := now();
  RETURN NEW;
END
$body$;

CREATE TRIGGER context_source_attribution_revision
BEFORE UPDATE OF speaker_id, speaker_basis, speaker_confidence, attribution
ON heady_runtime.context_source
FOR EACH ROW EXECUTE FUNCTION heady_runtime.bump_attribution_revision();

GRANT UPDATE (speaker_id, speaker_basis, speaker_confidence, attribution, updated_at)
ON heady_runtime.context_source TO heady_runtime_api;

CREATE FUNCTION heady_runtime.require_attributed_embedding_source()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  source_basis TEXT;
  source_speaker TEXT;
BEGIN
  SELECT speaker_basis, speaker_id
    INTO source_basis, source_speaker
    FROM heady_runtime.context_source
   WHERE id = NEW.source_id AND tenant_id = NEW.tenant_id;

  IF source_basis IS NULL THEN
    RAISE EXCEPTION 'embedding source is not visible in the active tenant';
  END IF;
  IF source_basis IN ('UNKNOWN', 'INFERRED') OR source_speaker = 'unknown' THEN
    RAISE EXCEPTION 'speaker attribution is insufficient for personal embedding';
  END IF;
  RETURN NEW;
END
$body$;

CREATE TRIGGER embedding_job_requires_attributed_speaker
BEFORE INSERT ON heady_runtime.embedding_job
FOR EACH ROW EXECUTE FUNCTION heady_runtime.require_attributed_embedding_source();

REVOKE ALL ON FUNCTION heady_runtime.require_attributed_embedding_source() FROM PUBLIC, authenticated, anonymous;
GRANT EXECUTE ON FUNCTION heady_runtime.require_attributed_embedding_source() TO heady_runtime_api;
REVOKE ALL ON FUNCTION heady_runtime.bump_attribution_revision() FROM PUBLIC, authenticated, anonymous;
GRANT EXECUTE ON FUNCTION heady_runtime.bump_attribution_revision() TO heady_runtime_api;
