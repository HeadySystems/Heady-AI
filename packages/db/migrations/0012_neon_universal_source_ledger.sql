-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0012 — Neon universal source ledger        ║
-- ║  Append-only canonical source blobs, revisions, refs, and events.║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS heady_source;
REVOKE ALL ON SCHEMA heady_source FROM PUBLIC, authenticated, anonymous;

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'heady_source_api') THEN
    CREATE ROLE heady_source_api
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$role$;

CREATE TABLE heady_source.repository (
  repository_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9._/-]{0,255}$'),
  display_name     TEXT NOT NULL CHECK (length(display_name) > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE heady_source.blob (
  content_sha256   TEXT PRIMARY KEY CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  content          BYTEA NOT NULL,
  byte_length      BIGINT GENERATED ALWAYS AS (octet_length(content)) STORED,
  media_type       TEXT NOT NULL DEFAULT 'application/octet-stream',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (digest(content, 'sha256') = decode(content_sha256, 'hex'))
);

CREATE TABLE heady_source.revision (
  revision_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id    UUID NOT NULL REFERENCES heady_source.repository(repository_id) ON DELETE RESTRICT,
  merkle_root      TEXT NOT NULL CHECK (merkle_root ~ '^[a-f0-9]{64}$'),
  message          TEXT NOT NULL CHECK (length(message) > 0),
  actor            JSONB NOT NULL CHECK (jsonb_typeof(actor) = 'object'),
  git_provenance   JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(git_provenance) = 'object'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repository_id, revision_id)
);

CREATE TABLE heady_source.revision_parent (
  repository_id      UUID NOT NULL REFERENCES heady_source.repository(repository_id) ON DELETE RESTRICT,
  revision_id        UUID NOT NULL,
  parent_revision_id UUID NOT NULL,
  parent_order        SMALLINT NOT NULL CHECK (parent_order >= 0),
  PRIMARY KEY (revision_id, parent_order),
  UNIQUE (revision_id, parent_revision_id),
  CHECK (revision_id <> parent_revision_id),
  FOREIGN KEY (repository_id, revision_id)
    REFERENCES heady_source.revision(repository_id, revision_id) ON DELETE RESTRICT,
  FOREIGN KEY (repository_id, parent_revision_id)
    REFERENCES heady_source.revision(repository_id, revision_id) ON DELETE RESTRICT
);

CREATE TABLE heady_source.revision_entry (
  revision_id      UUID NOT NULL REFERENCES heady_source.revision(revision_id) ON DELETE RESTRICT,
  path             TEXT NOT NULL CHECK (path !~ '(^/|(^|/)\.\.(/|$)|[[:cntrl:]])'),
  content_sha256   TEXT NOT NULL REFERENCES heady_source.blob(content_sha256) ON DELETE RESTRICT,
  file_mode        INTEGER NOT NULL DEFAULT 33188 CHECK (file_mode IN (33188, 33261, 40960)),
  PRIMARY KEY (revision_id, path)
);

CREATE TABLE heady_source.named_ref (
  repository_id    UUID NOT NULL,
  ref_name         TEXT NOT NULL CHECK (ref_name ~ '^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,255}$'),
  revision_id      UUID NOT NULL,
  version          BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (repository_id, ref_name),
  FOREIGN KEY (repository_id, revision_id)
    REFERENCES heady_source.revision(repository_id, revision_id) ON DELETE RESTRICT
);

CREATE TABLE heady_source.source_embedding (
  embedding_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id      UUID NOT NULL,
  path             TEXT NOT NULL,
  chunk_ordinal    INTEGER NOT NULL CHECK (chunk_ordinal >= 0),
  content_sha256   TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  content          TEXT NOT NULL,
  embedding        vector(384) NOT NULL,
  embedding_model  TEXT NOT NULL DEFAULT '@cf/baai/bge-small-en-v1.5'
    CHECK (embedding_model = '@cf/baai/bge-small-en-v1.5'),
  provenance       JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(provenance) = 'object'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (revision_id, path)
    REFERENCES heady_source.revision_entry(revision_id, path) ON DELETE RESTRICT,
  UNIQUE (revision_id, path, chunk_ordinal),
  CHECK (digest(convert_to(content, 'UTF8'), 'sha256') = decode(content_sha256, 'hex'))
);

CREATE INDEX source_embedding_hnsw_cosine
  ON heady_source.source_embedding USING hnsw (embedding vector_cosine_ops);

CREATE TABLE heady_source.event (
  sequence         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  repository_id    UUID NOT NULL,
  revision_id      UUID NOT NULL,
  event_type       TEXT NOT NULL CHECK (event_type IN ('SOURCE_BOOTSTRAPPED', 'REF_ADVANCED')),
  ref_name         TEXT NOT NULL,
  actor             JSONB NOT NULL CHECK (jsonb_typeof(actor) = 'object'),
  evidence          JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (repository_id, revision_id)
    REFERENCES heady_source.revision(repository_id, revision_id) ON DELETE RESTRICT
);

CREATE FUNCTION heady_source.reject_immutable_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $body$
BEGIN
  RAISE EXCEPTION 'canonical source ledger rows are append-only' USING ERRCODE = '55000';
END
$body$;

CREATE TRIGGER source_blob_append_only BEFORE UPDATE OR DELETE ON heady_source.blob
FOR EACH ROW EXECUTE FUNCTION heady_source.reject_immutable_mutation();
CREATE TRIGGER source_revision_append_only BEFORE UPDATE OR DELETE ON heady_source.revision
FOR EACH ROW EXECUTE FUNCTION heady_source.reject_immutable_mutation();
CREATE TRIGGER source_revision_parent_append_only BEFORE UPDATE OR DELETE ON heady_source.revision_parent
FOR EACH ROW EXECUTE FUNCTION heady_source.reject_immutable_mutation();
CREATE TRIGGER source_revision_entry_append_only BEFORE UPDATE OR DELETE ON heady_source.revision_entry
FOR EACH ROW EXECUTE FUNCTION heady_source.reject_immutable_mutation();
CREATE TRIGGER source_embedding_append_only BEFORE UPDATE OR DELETE ON heady_source.source_embedding
FOR EACH ROW EXECUTE FUNCTION heady_source.reject_immutable_mutation();
CREATE TRIGGER source_event_append_only BEFORE UPDATE OR DELETE ON heady_source.event
FOR EACH ROW EXECUTE FUNCTION heady_source.reject_immutable_mutation();

CREATE FUNCTION heady_source.advance_ref(
  target_repository UUID,
  target_ref TEXT,
  expected_version BIGINT,
  next_revision UUID,
  event_actor JSONB,
  event_evidence JSONB DEFAULT '{}'::jsonb
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, heady_source AS $body$
DECLARE next_version BIGINT;
DECLARE current_revision UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM heady_source.revision
     WHERE revision_id = next_revision AND repository_id = target_repository
  ) THEN
    RAISE EXCEPTION 'revision does not belong to repository' USING ERRCODE = '23503';
  END IF;

  IF expected_version = 0 THEN
    INSERT INTO heady_source.named_ref(repository_id, ref_name, revision_id, version)
    VALUES (target_repository, target_ref, next_revision, 1)
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'source ref compare-and-swap conflict' USING ERRCODE = '40001';
    END IF;
    next_version := 1;
  ELSE
    SELECT revision_id INTO current_revision
      FROM heady_source.named_ref
     WHERE repository_id = target_repository AND ref_name = target_ref AND version = expected_version
     FOR UPDATE;
    IF current_revision IS NULL THEN
      RAISE EXCEPTION 'source ref compare-and-swap conflict' USING ERRCODE = '40001';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM heady_source.revision_parent
       WHERE repository_id = target_repository
         AND revision_id = next_revision AND parent_revision_id = current_revision
    ) THEN
      RAISE EXCEPTION 'source ref advance must descend from current revision' USING ERRCODE = '23514';
    END IF;
    UPDATE heady_source.named_ref
       SET revision_id = next_revision, version = version + 1, updated_at = now()
     WHERE repository_id = target_repository AND ref_name = target_ref AND version = expected_version
     RETURNING version INTO next_version;
    IF next_version IS NULL THEN
      RAISE EXCEPTION 'source ref compare-and-swap conflict' USING ERRCODE = '40001';
    END IF;
  END IF;

  INSERT INTO heady_source.event(repository_id, revision_id, event_type, ref_name, actor, evidence)
  VALUES (
    target_repository,
    next_revision,
    CASE WHEN expected_version = 0 THEN 'SOURCE_BOOTSTRAPPED' ELSE 'REF_ADVANCED' END,
    target_ref,
    event_actor,
    event_evidence
  );
  RETURN next_version;
END
$body$;

REVOKE ALL ON ALL TABLES IN SCHEMA heady_source FROM PUBLIC, authenticated, anonymous;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA heady_source FROM PUBLIC, authenticated, anonymous;
GRANT USAGE ON SCHEMA heady_source TO heady_source_api;
GRANT SELECT, INSERT ON heady_source.repository, heady_source.blob, heady_source.revision,
  heady_source.revision_parent, heady_source.revision_entry, heady_source.source_embedding
  TO heady_source_api;
GRANT SELECT ON heady_source.named_ref, heady_source.event TO heady_source_api;
GRANT EXECUTE ON FUNCTION heady_source.advance_ref(UUID, TEXT, BIGINT, UUID, JSONB, JSONB) TO heady_source_api;
GRANT heady_source_api TO neondb_owner;

ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA heady_source
  REVOKE ALL ON TABLES FROM PUBLIC, authenticated, anonymous;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA heady_source
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, authenticated, anonymous;
