-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0004 — approval control plane              ║
-- ║  Append-only HCP evidence, KMS receipts, policy state, and outbox.║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Forward-only. Neon Postgres is authoritative; every derived approval view is
-- rebuilt from this schema's event and receipt history.

CREATE SCHEMA IF NOT EXISTS heady_approval;

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'heady_approval_api') THEN
    CREATE ROLE heady_approval_api NOLOGIN;
  END IF;
END
$role$;

-- NB (2026-07-29): a redundant `ALTER ROLE heady_approval_api WITH NOLOGIN NOSUPERUSER
-- NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` was REMOVED here. `CREATE ROLE ...
-- NOLOGIN` above already yields exactly those attributes as defaults, so the ALTER added
-- nothing — except that setting the SUPERUSER/BYPASSRLS attributes requires a Postgres
-- superuser, which Neon never grants `neondb_owner`. The ALTER therefore failed with
-- "permission denied to alter role" and halted the ENTIRE migration chain on every Neon
-- endpoint (verified live). The role's least-privilege posture is unchanged.

CREATE TABLE heady_approval.principals (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stable_identifier        TEXT NOT NULL UNIQUE,
  principal_type           TEXT NOT NULL
                           CHECK (principal_type IN ('human', 'service', 'external_reviewer')),
  principal_role           TEXT NOT NULL
                           CHECK (principal_role IN ('founder', 'arbiter', 'security_reviewer', 'renovate', 'deployment_guard')),
  firebase_uid             TEXT,
  verified_email           TEXT,
  workload_identity        TEXT,
  allowed_evidence_classes TEXT[] NOT NULL,
  active                   BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at               TIMESTAMPTZ,
  revocation_reason        TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT principal_identity_shape CHECK (
    (principal_type IN ('human', 'external_reviewer')
      AND firebase_uid IS NOT NULL
      AND verified_email IS NOT NULL
      AND workload_identity IS NULL)
    OR
    (principal_type = 'service'
      AND firebase_uid IS NULL
      AND verified_email IS NULL
      AND workload_identity IS NOT NULL)
  ),
  CONSTRAINT principal_role_shape CHECK (
    (principal_role = 'founder' AND principal_type = 'human')
    OR (principal_role = 'security_reviewer' AND principal_type = 'external_reviewer')
    OR (principal_role IN ('arbiter', 'renovate', 'deployment_guard') AND principal_type = 'service')
  ),
  CONSTRAINT principal_revocation_shape CHECK (
    (active AND revoked_at IS NULL AND revocation_reason IS NULL)
    OR
    (NOT active AND revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
  ),
  CONSTRAINT principal_evidence_classes CHECK (
    (
      cardinality(allowed_evidence_classes) > 0
      OR principal_role = 'deployment_guard'
    )
    AND allowed_evidence_classes <@ ARRAY[
      'founder_decision',
      'arbiter_attestation',
      'external_human_review',
      'external_security_review',
      'renovate_attestation'
    ]::TEXT[]
  ),
  CONSTRAINT principal_role_evidence_shape CHECK (
    (principal_role = 'founder'
      AND allowed_evidence_classes = ARRAY['founder_decision']::TEXT[])
    OR
    (principal_role = 'security_reviewer'
      AND cardinality(allowed_evidence_classes) > 0
      AND allowed_evidence_classes <@ ARRAY[
        'external_human_review',
        'external_security_review'
      ]::TEXT[])
    OR
    (principal_role = 'arbiter'
      AND allowed_evidence_classes = ARRAY['arbiter_attestation']::TEXT[])
    OR
    (principal_role = 'renovate'
      AND allowed_evidence_classes = ARRAY['renovate_attestation']::TEXT[])
    OR
    (principal_role = 'deployment_guard'
      AND cardinality(allowed_evidence_classes) = 0)
  )
);

CREATE UNIQUE INDEX approval_principals_firebase_uid
  ON heady_approval.principals (firebase_uid)
  WHERE firebase_uid IS NOT NULL;
CREATE UNIQUE INDEX approval_principals_verified_email
  ON heady_approval.principals (lower(verified_email))
  WHERE verified_email IS NOT NULL;
CREATE UNIQUE INDEX approval_principals_workload_identity
  ON heady_approval.principals (workload_identity)
  WHERE workload_identity IS NOT NULL;
CREATE UNIQUE INDEX approval_single_active_founder
  ON heady_approval.principals (principal_role)
  WHERE principal_role = 'founder' AND active;

CREATE TABLE heady_approval.principal_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id    UUID NOT NULL REFERENCES heady_approval.principals(id),
  fingerprint     TEXT NOT NULL UNIQUE CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  public_jwk      JSONB NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT principal_key_jwk_shape CHECK (
    public_jwk->>'kty' = 'OKP'
    AND public_jwk->>'crv' = 'Ed25519'
    AND jsonb_typeof(public_jwk->'x') = 'string'
    AND (public_jwk->>'x') ~ '^[A-Za-z0-9_-]{43}$'
    AND NOT public_jwk ? 'd'
  ),
  CONSTRAINT principal_key_revocation_shape CHECK (
    (active AND revoked_at IS NULL AND revocation_reason IS NULL)
    OR
    (NOT active AND revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
  ),
  UNIQUE (id, principal_id)
);

CREATE TABLE heady_approval.receipt_signing_keys (
  key_id            TEXT PRIMARY KEY,
  fingerprint       TEXT NOT NULL UNIQUE CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  public_jwk        JSONB NOT NULL,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT receipt_signing_key_jwk_shape CHECK (
    public_jwk->>'kty' = 'OKP'
    AND public_jwk->>'crv' = 'Ed25519'
    AND jsonb_typeof(public_jwk->'x') = 'string'
    AND (public_jwk->>'x') ~ '^[A-Za-z0-9_-]{43}$'
    AND NOT public_jwk ? 'd'
  ),
  CONSTRAINT receipt_signing_key_revocation_shape CHECK (
    (active AND revoked_at IS NULL AND revocation_reason IS NULL)
    OR
    (NOT active AND revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
  )
);

CREATE TABLE heady_approval.approvals (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  approval_id             TEXT NOT NULL UNIQUE
                          CHECK (approval_id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),
  hcp_identifier          TEXT NOT NULL CHECK (hcp_identifier ~ '^HCP-[0-9]{4}$'),
  title                   TEXT NOT NULL,
  subject_type            TEXT NOT NULL
                          CHECK (subject_type IN ('change', 'deployment', 'policy', 'approval_system', 'dependency_update')),
  change_class            TEXT NOT NULL
                          CHECK (change_class IN ('standard_sensitive', 'patent_locked', 'approval_system', 'renovate_patch')),
  patent_locked           BOOLEAN NOT NULL,
  renovate_patch_only     BOOLEAN NOT NULL DEFAULT FALSE,
  zone_paths              TEXT[] NOT NULL CHECK (cardinality(zone_paths) > 0),
  canonical_payload       JSONB NOT NULL,
  payload_sha256          TEXT NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  diff_sha256             TEXT NOT NULL CHECK (diff_sha256 ~ '^[a-f0-9]{64}$'),
  artifact_digest         TEXT
                          CHECK (
                            artifact_digest IS NULL
                            OR artifact_digest ~ '^sha256:[a-f0-9]{64}$'
                          ),
  state                   TEXT NOT NULL DEFAULT 'draft'
                          CHECK (state IN ('draft', 'pending', 'approved', 'rejected', 'expired', 'superseded')),
  policy_version          TEXT NOT NULL,
  policy_sha256           TEXT NOT NULL CHECK (policy_sha256 ~ '^[a-f0-9]{64}$'),
  required_evidence       TEXT[] NOT NULL,
  expires_at              TIMESTAMPTZ,
  superseded_by           UUID REFERENCES heady_approval.approvals(id),
  created_by              UUID NOT NULL REFERENCES heady_approval.principals(id),
  trace_id                TEXT NOT NULL,
  creation_idempotency_key TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL,
  updated_at              TIMESTAMPTZ NOT NULL,
  CONSTRAINT approval_state_expiry CHECK (
    (state = 'draft' AND expires_at IS NULL)
    OR (state IN ('pending', 'approved', 'rejected', 'expired') AND expires_at IS NOT NULL)
    OR state = 'superseded'
  ),
  CONSTRAINT approval_supersede_shape CHECK (
    (state = 'superseded' AND superseded_by IS NOT NULL)
    OR
    (state <> 'superseded' AND superseded_by IS NULL)
  ),
  CONSTRAINT approval_deployment_artifact CHECK (
    subject_type <> 'deployment' OR artifact_digest IS NOT NULL
  ),
  UNIQUE (created_by, creation_idempotency_key)
);

CREATE INDEX approval_hcp_identifier ON heady_approval.approvals (hcp_identifier);
CREATE INDEX approval_pending_expiry
  ON heady_approval.approvals (expires_at)
  WHERE state = 'pending';

CREATE TABLE heady_approval.events (
  id                    UUID PRIMARY KEY,
  approval_id           UUID NOT NULL REFERENCES heady_approval.approvals(id),
  sequence              BIGINT NOT NULL CHECK (sequence > 0),
  event_type            TEXT NOT NULL
                        CHECK (event_type IN ('system_bootstrapped', 'created', 'submitted', 'decision', 'attestation', 'expired', 'superseded', 'verified')),
  actor_principal_id    UUID NOT NULL REFERENCES heady_approval.principals(id),
  actor_key_id          UUID,
  evidence_class        TEXT,
  decision              TEXT CHECK (decision IS NULL OR decision IN ('approve', 'reject')),
  verdict               TEXT CHECK (verdict IS NULL OR verdict IN ('ALLOW', 'BLOCK', 'ESCALATE')),
  reason                TEXT NOT NULL,
  nonce                 TEXT,
  evidence_expires_at   TIMESTAMPTZ,
  evidence_envelope     JSONB,
  evidence_sha256       TEXT CHECK (evidence_sha256 IS NULL OR evidence_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_signature    TEXT,
  actor_snapshot        JSONB NOT NULL,
  policy_input          JSONB NOT NULL,
  policy_result         JSONB NOT NULL,
  resulting_state       TEXT NOT NULL
                        CHECK (resulting_state IN ('draft', 'pending', 'approved', 'rejected', 'expired', 'superseded')),
  previous_event_sha256 TEXT CHECK (previous_event_sha256 IS NULL OR previous_event_sha256 ~ '^[a-f0-9]{64}$'),
  event_sha256          TEXT NOT NULL UNIQUE CHECK (event_sha256 ~ '^[a-f0-9]{64}$'),
  trace_id              TEXT NOT NULL,
  idempotency_key       TEXT NOT NULL,
  operation_sha256      TEXT NOT NULL CHECK (operation_sha256 ~ '^[a-f0-9]{64}$'),
  occurred_at           TIMESTAMPTZ NOT NULL,
  UNIQUE (approval_id, sequence),
  UNIQUE (actor_principal_id, idempotency_key),
  UNIQUE (actor_principal_id, nonce),
  CONSTRAINT event_actor_key_owner FOREIGN KEY (actor_key_id, actor_principal_id)
    REFERENCES heady_approval.principal_keys(id, principal_id),
  CONSTRAINT event_evidence_class CHECK (
    evidence_class IS NULL
    OR evidence_class IN (
      'founder_decision',
      'arbiter_attestation',
      'external_human_review',
      'external_security_review',
      'renovate_attestation'
    )
  ),
  CONSTRAINT event_decision_shape CHECK (
    (event_type = 'decision' AND decision IS NOT NULL AND verdict IS NULL)
    OR (event_type = 'attestation' AND verdict IS NOT NULL AND decision IS NULL)
    OR (event_type NOT IN ('decision', 'attestation') AND decision IS NULL AND verdict IS NULL)
  ),
  CONSTRAINT event_class_shape CHECK (
    (
      event_type = 'decision'
      AND evidence_class IN (
        'founder_decision',
        'external_human_review',
        'external_security_review'
      )
    )
    OR
    (
      event_type = 'attestation'
      AND evidence_class IN ('arbiter_attestation', 'renovate_attestation')
    )
    OR (event_type = 'superseded' AND evidence_class = 'founder_decision')
    OR (
      event_type NOT IN ('decision', 'attestation', 'superseded')
      AND evidence_class IS NULL
    )
  ),
  CONSTRAINT event_evidence_timing CHECK (
    evidence_expires_at IS NULL OR evidence_expires_at > occurred_at
  ),
  CONSTRAINT event_evidence_shape CHECK (
    (
      event_type IN ('decision', 'attestation', 'superseded')
      AND actor_key_id IS NOT NULL
      AND evidence_class IS NOT NULL
      AND nonce IS NOT NULL
      AND evidence_expires_at IS NOT NULL
      AND evidence_envelope IS NOT NULL
      AND evidence_sha256 IS NOT NULL
      AND evidence_signature IS NOT NULL
    )
    OR
    (
      event_type IN ('system_bootstrapped', 'created', 'submitted', 'expired', 'verified')
      AND evidence_class IS NULL
      AND nonce IS NULL
      AND evidence_expires_at IS NULL
      AND evidence_envelope IS NULL
      AND evidence_sha256 IS NULL
      AND evidence_signature IS NULL
    )
  )
);

CREATE INDEX approval_events_history
  ON heady_approval.events (approval_id, sequence);

CREATE TABLE heady_approval.receipts (
  id                    UUID PRIMARY KEY,
  receipt_id            TEXT NOT NULL UNIQUE
                        CHECK (receipt_id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),
  event_id              UUID NOT NULL UNIQUE REFERENCES heady_approval.events(id),
  canonical_payload     JSONB NOT NULL,
  payload_sha256        TEXT NOT NULL UNIQUE CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  signing_key_id        TEXT NOT NULL REFERENCES heady_approval.receipt_signing_keys(key_id),
  algorithm             TEXT NOT NULL CHECK (algorithm = 'EC_SIGN_ED25519'),
  signature             TEXT NOT NULL,
  public_jwk            JSONB NOT NULL,
  public_jwk_version    TEXT NOT NULL,
  signature_verified    BOOLEAN NOT NULL CHECK (signature_verified),
  issued_at             TIMESTAMPTZ NOT NULL,
  last_audit_verified_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT receipt_public_jwk_shape CHECK (
    public_jwk->>'kty' = 'OKP'
    AND public_jwk->>'crv' = 'Ed25519'
    AND jsonb_typeof(public_jwk->'x') = 'string'
    AND (public_jwk->>'x') ~ '^[A-Za-z0-9_-]{43}$'
    AND NOT public_jwk ? 'd'
  ),
  CONSTRAINT receipt_key_version_binding CHECK (public_jwk_version = signing_key_id)
);

CREATE TABLE heady_approval.outbox (
  sequence        BIGSERIAL PRIMARY KEY,
  event_id        UUID NOT NULL UNIQUE REFERENCES heady_approval.events(id),
  topic           TEXT NOT NULL CHECK (topic ~ '^heady[.]approval[.]'),
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL,
  available_at    TIMESTAMPTZ NOT NULL,
  dispatch_attempts INTEGER NOT NULL DEFAULT 0 CHECK (dispatch_attempts >= 0),
  dispatched_at   TIMESTAMPTZ,
  CONSTRAINT approval_outbox_timing CHECK (
    available_at >= created_at
    AND (dispatched_at IS NULL OR dispatched_at >= created_at)
  )
);

CREATE INDEX approval_outbox_undispatched
  ON heady_approval.outbox (available_at, sequence)
  WHERE dispatched_at IS NULL;

CREATE TABLE heady_approval.audit_replays (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  approval_id              UUID NOT NULL REFERENCES heady_approval.approvals(id),
  through_sequence         BIGINT NOT NULL,
  valid                    BOOLEAN NOT NULL,
  chain_head_sha256        TEXT NOT NULL CHECK (chain_head_sha256 ~ '^[a-f0-9]{64}$'),
  policy_sha256            TEXT NOT NULL CHECK (policy_sha256 ~ '^[a-f0-9]{64}$'),
  receipt_count            INTEGER NOT NULL CHECK (receipt_count > 0),
  verification_summary     JSONB NOT NULL,
  verifier_principal_id    UUID NOT NULL REFERENCES heady_approval.principals(id),
  trace_id                 TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL
);

CREATE TABLE heady_approval.bootstrap (
  singleton                 BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  accepted_commit_sha       TEXT NOT NULL
                             CHECK (accepted_commit_sha = 'e064a8943b1dc4d9737f542d530e023fc8441282'),
  accepted_tag              TEXT NOT NULL UNIQUE
                             CHECK (accepted_tag = 'adr-0031-accepted-e064a8943'),
  accepted_tag_object_sha   TEXT NOT NULL
                             CHECK (accepted_tag_object_sha = '5b7226f218ff6b888b5aaee581ced89fa574e9ac'),
  accepted_signer_fingerprint TEXT NOT NULL
                             CHECK (accepted_signer_fingerprint = '1050B59E7296C46C26DDF95DA7D2108BB3C6101C'),
  genesis_manifest_sha256   TEXT NOT NULL CHECK (genesis_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  migration_sha256          TEXT NOT NULL CHECK (migration_sha256 ~ '^[a-f0-9]{64}$'),
  deployment_artifact_digest TEXT NOT NULL
                             CHECK (deployment_artifact_digest ~ '^sha256:[a-f0-9]{64}$'),
  rollback_artifact_digest  TEXT NOT NULL
                            CHECK (rollback_artifact_digest ~ '^sha256:[a-f0-9]{64}$'),
  founder_principal_id      UUID NOT NULL REFERENCES heady_approval.principals(id),
  bootstrap_event_id        UUID NOT NULL UNIQUE REFERENCES heady_approval.events(id),
  created_at                TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION heady_approval.reject_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'append-only relation %.% rejects %', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.guard_principal_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF ROW(
    NEW.stable_identifier,
    NEW.principal_type,
    NEW.principal_role,
    NEW.firebase_uid,
    NEW.verified_email,
    NEW.workload_identity,
    NEW.allowed_evidence_classes,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.stable_identifier,
    OLD.principal_type,
    OLD.principal_role,
    OLD.firebase_uid,
    OLD.verified_email,
    OLD.workload_identity,
    OLD.allowed_evidence_classes,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'principal identity fields are immutable' USING ERRCODE = '55000';
  END IF;
  IF NOT OLD.active AND (
    NEW.active
    OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
    OR NEW.revocation_reason IS DISTINCT FROM OLD.revocation_reason
  ) THEN
    RAISE EXCEPTION 'principal revocation is irreversible' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.guard_principal_key_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF ROW(
    NEW.principal_id,
    NEW.fingerprint,
    NEW.public_jwk,
    NEW.valid_from,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.principal_id,
    OLD.fingerprint,
    OLD.public_jwk,
    OLD.valid_from,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'principal key identity fields are immutable' USING ERRCODE = '55000';
  END IF;
  IF NOT OLD.active AND (
    NEW.active
    OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
    OR NEW.revocation_reason IS DISTINCT FROM OLD.revocation_reason
  ) THEN
    RAISE EXCEPTION 'principal key revocation is irreversible' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.guard_receipt_signing_key_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF ROW(
    NEW.key_id,
    NEW.fingerprint,
    NEW.public_jwk,
    NEW.valid_from,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.key_id,
    OLD.fingerprint,
    OLD.public_jwk,
    OLD.valid_from,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'receipt signing key identity fields are immutable' USING ERRCODE = '55000';
  END IF;
  IF NOT OLD.active AND (
    NEW.active
    OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
    OR NEW.revocation_reason IS DISTINCT FROM OLD.revocation_reason
  ) THEN
    RAISE EXCEPTION 'receipt signing key revocation is irreversible' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.guard_approval_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  transition_allowed BOOLEAN;
BEGIN
  IF ROW(
    NEW.approval_id,
    NEW.hcp_identifier,
    NEW.title,
    NEW.subject_type,
    NEW.change_class,
    NEW.patent_locked,
    NEW.renovate_patch_only,
    NEW.zone_paths,
    NEW.canonical_payload,
    NEW.payload_sha256,
    NEW.diff_sha256,
    NEW.artifact_digest,
    NEW.policy_version,
    NEW.policy_sha256,
    NEW.created_by,
    NEW.trace_id,
    NEW.creation_idempotency_key,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.approval_id,
    OLD.hcp_identifier,
    OLD.title,
    OLD.subject_type,
    OLD.change_class,
    OLD.patent_locked,
    OLD.renovate_patch_only,
    OLD.zone_paths,
    OLD.canonical_payload,
    OLD.payload_sha256,
    OLD.diff_sha256,
    OLD.artifact_digest,
    OLD.policy_version,
    OLD.policy_sha256,
    OLD.created_by,
    OLD.trace_id,
    OLD.creation_idempotency_key,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'approval proposal and policy bindings are immutable' USING ERRCODE = '55000';
  END IF;

  transition_allowed := (
    NEW.state = OLD.state
    OR (OLD.state = 'draft' AND NEW.state IN ('pending', 'superseded'))
    OR (OLD.state = 'pending' AND NEW.state IN ('approved', 'rejected', 'expired', 'superseded'))
    OR (OLD.state = 'approved' AND NEW.state = 'superseded')
  );
  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'illegal approval state transition: % -> %', OLD.state, NEW.state
      USING ERRCODE = '23514';
  END IF;

  IF OLD.state <> 'draft' AND NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'approval expiry is immutable after submission' USING ERRCODE = '55000';
  END IF;
  IF NEW.state <> 'superseded' AND NEW.superseded_by IS DISTINCT FROM OLD.superseded_by THEN
    RAISE EXCEPTION 'superseding link requires superseded state' USING ERRCODE = '23514';
  END IF;
  IF NEW.updated_at IS DISTINCT FROM OLD.updated_at
     AND ROW(
       NEW.state,
       NEW.required_evidence,
       NEW.expires_at,
       NEW.superseded_by
     ) IS NOT DISTINCT FROM ROW(
       OLD.state,
       OLD.required_evidence,
       OLD.expires_at,
       OLD.superseded_by
     ) THEN
    RAISE EXCEPTION 'approval timestamp cannot change without policy state'
      USING ERRCODE = '55000';
  END IF;
  NEW.updated_at := GREATEST(NEW.updated_at, OLD.updated_at);
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.guard_approval_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.state <> 'draft' THEN
    RAISE EXCEPTION 'new approvals must begin in draft state' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.enforce_event_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  previous_sequence BIGINT;
  previous_sha TEXT;
BEGIN
  IF NEW.event_type = 'system_bootstrapped'
     AND pg_has_role(current_user, 'heady_approval_api', 'member') THEN
    RAISE EXCEPTION 'approval API role cannot create the genesis event'
      USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM heady_approval.approvals WHERE id = NEW.approval_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'approval does not exist' USING ERRCODE = '23503';
  END IF;

  SELECT sequence, event_sha256
    INTO previous_sequence, previous_sha
    FROM heady_approval.events
   WHERE approval_id = NEW.approval_id
   ORDER BY sequence DESC
   LIMIT 1;

  IF previous_sequence IS NULL THEN
    IF NEW.sequence <> 1 OR NEW.previous_event_sha256 IS NOT NULL THEN
      RAISE EXCEPTION 'first approval event must be sequence 1 with no previous hash'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.sequence <> previous_sequence + 1 OR NEW.previous_event_sha256 IS DISTINCT FROM previous_sha THEN
    RAISE EXCEPTION 'approval event chain mismatch at sequence %', NEW.sequence
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.validate_event_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  principal_record heady_approval.principals%ROWTYPE;
  actor_key_fingerprint TEXT;
  expected_auth_type TEXT;
BEGIN
  SELECT *
    INTO principal_record
    FROM heady_approval.principals
   WHERE id = NEW.actor_principal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'approval event actor principal does not exist'
      USING ERRCODE = '23503';
  END IF;

  expected_auth_type := CASE
    WHEN principal_record.principal_type = 'service' THEN 'workload_identity'
    ELSE 'firebase'
  END;
  IF NEW.actor_snapshot->>'principalId' IS DISTINCT FROM NEW.actor_principal_id::TEXT
     OR NEW.actor_snapshot->>'stableIdentifier'
       IS DISTINCT FROM principal_record.stable_identifier
     OR NEW.actor_snapshot->>'principalType'
       IS DISTINCT FROM principal_record.principal_type
     OR NEW.actor_snapshot->>'principalRole'
       IS DISTINCT FROM principal_record.principal_role
     OR NEW.actor_snapshot->>'authenticatedBy' IS DISTINCT FROM expected_auth_type THEN
    RAISE EXCEPTION 'approval event actor snapshot does not match its principal'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.evidence_class IS NOT NULL THEN
    SELECT fingerprint
      INTO actor_key_fingerprint
      FROM heady_approval.principal_keys
     WHERE id = NEW.actor_key_id
       AND principal_id = NEW.actor_principal_id;
    IF NOT FOUND
       OR NEW.actor_snapshot->>'keyId' IS DISTINCT FROM NEW.actor_key_id::TEXT
       OR NEW.actor_snapshot->>'keyFingerprint' IS DISTINCT FROM actor_key_fingerprint
       OR NEW.actor_snapshot->>'ceremonyVerified' IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'approval evidence snapshot does not match its principal key'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.actor_snapshot->>'keyId' IS NOT NULL
        OR NEW.actor_snapshot->>'keyFingerprint' IS NOT NULL
        OR NEW.actor_snapshot->>'ceremonyVerified' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'non-evidence approval event cannot claim a signing ceremony'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.validate_event_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  approval_record heady_approval.approvals%ROWTYPE;
BEGIN
  SELECT *
    INTO approval_record
    FROM heady_approval.approvals
   WHERE id = NEW.approval_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'approval event target does not exist' USING ERRCODE = '23503';
  END IF;

  IF NEW.policy_input->>'payloadSha256'
       IS DISTINCT FROM approval_record.payload_sha256
     OR NEW.policy_input->>'diffSha256'
       IS DISTINCT FROM approval_record.diff_sha256
     OR NEW.policy_input->>'policySha256'
       IS DISTINCT FROM approval_record.policy_sha256
     OR NEW.policy_input->>'changeClass'
       IS DISTINCT FROM approval_record.change_class
     OR NEW.policy_input->'patentLocked'
       IS DISTINCT FROM to_jsonb(approval_record.patent_locked)
     OR NEW.policy_input->'zonePaths'
       IS DISTINCT FROM to_jsonb(approval_record.zone_paths)
     OR jsonb_typeof(NEW.policy_input->'evidence') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'approval event policy input does not match its proposal'
      USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(NEW.policy_result->'allow') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(NEW.policy_result->'missingEvidence') IS DISTINCT FROM 'array'
     OR jsonb_typeof(NEW.policy_result->'reasons') IS DISTINCT FROM 'array'
     OR jsonb_typeof(NEW.policy_result->'requiredEvidence') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'approval event policy result has an invalid shape'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.evidence_class IS NOT NULL AND (
    NEW.evidence_envelope->>'schema' IS DISTINCT FROM 'heady.approval.evidence.v1'
    OR NEW.evidence_envelope->>'approvalId'
      IS DISTINCT FROM approval_record.approval_id
    OR NEW.evidence_envelope->>'payloadSha256'
      IS DISTINCT FROM approval_record.payload_sha256
    OR NEW.evidence_envelope->>'diffSha256'
      IS DISTINCT FROM approval_record.diff_sha256
    OR NEW.evidence_envelope->>'policySha256'
      IS DISTINCT FROM approval_record.policy_sha256
    OR NEW.evidence_envelope->>'nonce' IS DISTINCT FROM NEW.nonce
    OR (NEW.evidence_envelope->>'evidenceExpiresAt')::TIMESTAMPTZ
      IS DISTINCT FROM NEW.evidence_expires_at
  ) THEN
    RAISE EXCEPTION 'approval evidence envelope does not match its event or proposal'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.require_event_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM heady_approval.receipts WHERE event_id = NEW.id) THEN
    RAISE EXCEPTION 'approval event % has no signed receipt', NEW.id
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM heady_approval.approvals
     WHERE id = NEW.approval_id
       AND state = NEW.resulting_state
  ) THEN
    RAISE EXCEPTION 'event % resulting state does not match its approval', NEW.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.validate_receipt_signer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  registered_jwk JSONB;
  registered_active BOOLEAN;
  registered_valid_from TIMESTAMPTZ;
BEGIN
  SELECT public_jwk, active, valid_from
    INTO registered_jwk, registered_active, registered_valid_from
    FROM heady_approval.receipt_signing_keys
   WHERE key_id = NEW.signing_key_id;
  IF NOT FOUND
     OR NOT registered_active
     OR registered_valid_from > NEW.issued_at
     OR registered_jwk IS DISTINCT FROM NEW.public_jwk THEN
    RAISE EXCEPTION 'receipt signer is unregistered, inactive, premature, or mismatched'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM heady_approval.events event_record
    JOIN heady_approval.approvals approval_record
      ON approval_record.id = event_record.approval_id
    WHERE event_record.id = NEW.event_id
      AND NEW.canonical_payload->>'schema' = 'heady.approval.receipt.v1'
      AND NEW.canonical_payload->>'receiptId' = NEW.receipt_id
      AND NEW.canonical_payload->>'approvalId' = approval_record.approval_id
      AND NEW.canonical_payload->>'eventId' = NEW.event_id::TEXT
      AND (NEW.canonical_payload->>'sequence')::BIGINT = event_record.sequence
      AND NEW.canonical_payload->>'eventSha256' = event_record.event_sha256
      AND NEW.canonical_payload->>'previousEventSha256'
        IS NOT DISTINCT FROM event_record.previous_event_sha256
      AND NEW.canonical_payload->>'payloadSha256' = approval_record.payload_sha256
      AND NEW.canonical_payload->>'diffSha256' = approval_record.diff_sha256
      AND NEW.canonical_payload->>'policySha256' = approval_record.policy_sha256
      AND NEW.canonical_payload->>'state' = event_record.resulting_state
      AND (NEW.canonical_payload->>'issuedAt')::TIMESTAMPTZ = NEW.issued_at
  ) THEN
    RAISE EXCEPTION 'receipt payload does not match its event or approval'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.require_state_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state
     OR NEW.required_evidence IS DISTINCT FROM OLD.required_evidence
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.superseded_by IS DISTINCT FROM OLD.superseded_by THEN
    IF NOT EXISTS (
      SELECT 1
      FROM (
        SELECT resulting_state, policy_result, occurred_at
        FROM heady_approval.events
        WHERE approval_id = NEW.id
        ORDER BY sequence DESC
        LIMIT 1
      ) latest_event
      WHERE latest_event.resulting_state = NEW.state
        AND latest_event.policy_result->'missingEvidence' = to_jsonb(NEW.required_evidence)
        AND latest_event.occurred_at = NEW.updated_at
    ) THEN
      RAISE EXCEPTION 'approval state mutation has no matching policy event'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.guard_outbox_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF ROW(
    NEW.sequence,
    NEW.event_id,
    NEW.topic,
    NEW.payload,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.sequence,
    OLD.event_id,
    OLD.topic,
    OLD.payload,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'approval outbox event identity is immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.dispatch_attempts < OLD.dispatch_attempts THEN
    RAISE EXCEPTION 'approval outbox attempts cannot decrease' USING ERRCODE = '55000';
  END IF;
  IF OLD.dispatched_at IS NOT NULL AND NEW.dispatched_at IS DISTINCT FROM OLD.dispatched_at THEN
    RAISE EXCEPTION 'approval outbox dispatch completion is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.validate_bootstrap_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM heady_approval.events event_record
    JOIN heady_approval.principals founder
      ON founder.id = NEW.founder_principal_id
    WHERE event_record.id = NEW.bootstrap_event_id
      AND event_record.event_type = 'system_bootstrapped'
      AND event_record.sequence = 1
      AND event_record.actor_principal_id = NEW.founder_principal_id
      AND founder.principal_type = 'human'
      AND founder.principal_role = 'founder'
      AND founder.active
  ) THEN
    RAISE EXCEPTION 'bootstrap row requires the founder-authored first system event'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER approval_principal_identity_immutable
  BEFORE UPDATE ON heady_approval.principals
  FOR EACH ROW EXECUTE FUNCTION heady_approval.guard_principal_update();
CREATE TRIGGER approval_principal_key_identity_immutable
  BEFORE UPDATE ON heady_approval.principal_keys
  FOR EACH ROW EXECUTE FUNCTION heady_approval.guard_principal_key_update();
CREATE TRIGGER approval_receipt_signing_key_identity_immutable
  BEFORE UPDATE ON heady_approval.receipt_signing_keys
  FOR EACH ROW EXECUTE FUNCTION heady_approval.guard_receipt_signing_key_update();
CREATE TRIGGER approval_principals_no_delete
  BEFORE DELETE ON heady_approval.principals
  FOR EACH ROW EXECUTE FUNCTION heady_approval.reject_history_mutation();
CREATE TRIGGER approval_principal_keys_no_delete
  BEFORE DELETE ON heady_approval.principal_keys
  FOR EACH ROW EXECUTE FUNCTION heady_approval.reject_history_mutation();
CREATE TRIGGER approval_receipt_signing_keys_no_delete
  BEFORE DELETE ON heady_approval.receipt_signing_keys
  FOR EACH ROW EXECUTE FUNCTION heady_approval.reject_history_mutation();
CREATE TRIGGER approval_materialized_state_guard
  BEFORE UPDATE ON heady_approval.approvals
  FOR EACH ROW EXECUTE FUNCTION heady_approval.guard_approval_update();
CREATE TRIGGER approval_initial_state_guard
  BEFORE INSERT ON heady_approval.approvals
  FOR EACH ROW EXECUTE FUNCTION heady_approval.guard_approval_insert();
CREATE CONSTRAINT TRIGGER approval_state_event_required
  AFTER UPDATE ON heady_approval.approvals
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION heady_approval.require_state_event();
CREATE TRIGGER approval_event_chain_guard
  BEFORE INSERT ON heady_approval.events
  FOR EACH ROW EXECUTE FUNCTION heady_approval.enforce_event_chain();
CREATE TRIGGER approval_event_actor_guard
  BEFORE INSERT ON heady_approval.events
  FOR EACH ROW EXECUTE FUNCTION heady_approval.validate_event_actor();
CREATE TRIGGER approval_event_binding_guard
  BEFORE INSERT ON heady_approval.events
  FOR EACH ROW EXECUTE FUNCTION heady_approval.validate_event_binding();
CREATE CONSTRAINT TRIGGER approval_event_receipt_required
  AFTER INSERT ON heady_approval.events
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION heady_approval.require_event_receipt();
CREATE TRIGGER approval_receipt_signer_guard
  BEFORE INSERT ON heady_approval.receipts
  FOR EACH ROW EXECUTE FUNCTION heady_approval.validate_receipt_signer();

CREATE TRIGGER approval_events_append_only
  BEFORE UPDATE OR DELETE ON heady_approval.events
  FOR EACH ROW EXECUTE FUNCTION heady_approval.reject_history_mutation();
CREATE TRIGGER approval_receipts_append_only
  BEFORE UPDATE OR DELETE ON heady_approval.receipts
  FOR EACH ROW EXECUTE FUNCTION heady_approval.reject_history_mutation();
CREATE TRIGGER approval_outbox_update_guard
  BEFORE UPDATE ON heady_approval.outbox
  FOR EACH ROW EXECUTE FUNCTION heady_approval.guard_outbox_update();
CREATE TRIGGER approval_audit_replays_append_only
  BEFORE UPDATE OR DELETE ON heady_approval.audit_replays
  FOR EACH ROW EXECUTE FUNCTION heady_approval.reject_history_mutation();
CREATE TRIGGER approval_bootstrap_insert_guard
  BEFORE INSERT ON heady_approval.bootstrap
  FOR EACH ROW EXECUTE FUNCTION heady_approval.validate_bootstrap_insert();
CREATE TRIGGER approval_bootstrap_immutable
  BEFORE UPDATE OR DELETE ON heady_approval.bootstrap
  FOR EACH ROW EXECUTE FUNCTION heady_approval.reject_history_mutation();

REVOKE ALL ON SCHEMA heady_approval FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA heady_approval FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA heady_approval FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA heady_approval FROM PUBLIC;

GRANT USAGE ON SCHEMA heady_approval TO heady_approval_api;
GRANT SELECT ON heady_approval.principals TO heady_approval_api;
GRANT SELECT ON heady_approval.principal_keys TO heady_approval_api;
GRANT SELECT ON heady_approval.receipt_signing_keys TO heady_approval_api;
GRANT SELECT, INSERT ON heady_approval.approvals TO heady_approval_api;
GRANT UPDATE (state, required_evidence, expires_at, superseded_by, updated_at)
  ON heady_approval.approvals TO heady_approval_api;
GRANT SELECT, INSERT ON heady_approval.events TO heady_approval_api;
GRANT SELECT, INSERT ON heady_approval.receipts TO heady_approval_api;
GRANT SELECT, INSERT ON heady_approval.outbox TO heady_approval_api;
GRANT UPDATE (available_at, dispatch_attempts, dispatched_at)
  ON heady_approval.outbox TO heady_approval_api;
GRANT SELECT, INSERT ON heady_approval.audit_replays TO heady_approval_api;
GRANT SELECT ON heady_approval.bootstrap TO heady_approval_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA heady_approval TO heady_approval_api;

ALTER DEFAULT PRIVILEGES IN SCHEMA heady_approval
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA heady_approval
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA heady_approval
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $data_api$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA heady_approval FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA heady_approval FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA heady_approval FROM authenticated;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA heady_approval FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA heady_approval
      REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA heady_approval
      REVOKE ALL ON SEQUENCES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA heady_approval
      REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
  END IF;
END
$data_api$;
