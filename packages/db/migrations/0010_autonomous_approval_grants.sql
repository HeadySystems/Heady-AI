-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0010 — autonomous approval grants          ║
-- ║  Independent workload attestations and one-time signed grants.   ║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Forward-only. This migration adds a narrowly bounded machine lane; it does
-- not weaken founder, external-reviewer, ARBITER, or deployment gates.

ALTER TABLE heady_approval.principals
  DROP CONSTRAINT principals_principal_role_check,
  ADD CONSTRAINT principals_principal_role_check CHECK (
    principal_role IN (
      'founder',
      'arbiter',
      'security_reviewer',
      'renovate',
      'deployment_guard',
      'automation_requester',
      'automation_guard'
    )
  ),
  DROP CONSTRAINT principal_role_shape,
  ADD CONSTRAINT principal_role_shape CHECK (
    (principal_role = 'founder' AND principal_type = 'human')
    OR (principal_role = 'security_reviewer' AND principal_type = 'external_reviewer')
    OR (
      principal_role IN (
        'arbiter',
        'renovate',
        'deployment_guard',
        'automation_requester',
        'automation_guard'
      )
      AND principal_type = 'service'
    )
  ),
  DROP CONSTRAINT principal_evidence_classes,
  ADD CONSTRAINT principal_evidence_classes CHECK (
    (
      cardinality(allowed_evidence_classes) > 0
      OR principal_role IN ('deployment_guard', 'automation_requester')
    )
    AND allowed_evidence_classes <@ ARRAY[
      'founder_decision',
      'arbiter_attestation',
      'external_human_review',
      'external_security_review',
      'renovate_attestation',
      'automation_attestation'
    ]::TEXT[]
  ),
  DROP CONSTRAINT principal_role_evidence_shape,
  ADD CONSTRAINT principal_role_evidence_shape CHECK (
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
    (principal_role = 'automation_guard'
      AND allowed_evidence_classes = ARRAY['automation_attestation']::TEXT[])
    OR
    (principal_role IN ('deployment_guard', 'automation_requester')
      AND cardinality(allowed_evidence_classes) = 0)
  );

ALTER TABLE heady_approval.approvals
  DROP CONSTRAINT approvals_subject_type_check,
  ADD CONSTRAINT approvals_subject_type_check CHECK (
    subject_type IN (
      'change',
      'deployment',
      'policy',
      'approval_system',
      'dependency_update',
      'autonomous_process'
    )
  ),
  DROP CONSTRAINT approvals_change_class_check,
  ADD CONSTRAINT approvals_change_class_check CHECK (
    change_class IN (
      'standard_sensitive',
      'patent_locked',
      'approval_system',
      'renovate_patch',
      'autonomous_operation'
    )
  ),
  ADD CONSTRAINT approval_autonomous_shape CHECK (
    (
      subject_type <> 'autonomous_process'
      AND change_class <> 'autonomous_operation'
    )
    OR
    (
      subject_type = 'autonomous_process'
      AND change_class = 'autonomous_operation'
      AND NOT patent_locked
      AND NOT renovate_patch_only
      AND artifact_digest IS NULL
      AND canonical_payload->>'schema' = 'heady.autonomous.approval.v1'
      AND canonical_payload->>'requesterPrincipalId' = created_by::TEXT
      AND canonical_payload->>'riskTier' = 'low'
      AND canonical_payload->'reversible' = 'true'::JSONB
      AND canonical_payload->'dryRunVerified' = 'true'::JSONB
    )
  );

ALTER TABLE heady_approval.events
  DROP CONSTRAINT events_event_type_check,
  ADD CONSTRAINT events_event_type_check CHECK (
    event_type IN (
      'system_bootstrapped',
      'created',
      'submitted',
      'decision',
      'attestation',
      'expired',
      'superseded',
      'verified',
      'autonomous_requested',
      'authorized'
    )
  ),
  DROP CONSTRAINT event_evidence_class,
  ADD CONSTRAINT event_evidence_class CHECK (
    evidence_class IS NULL
    OR evidence_class IN (
      'founder_decision',
      'arbiter_attestation',
      'external_human_review',
      'external_security_review',
      'renovate_attestation',
      'automation_attestation'
    )
  ),
  DROP CONSTRAINT event_class_shape,
  ADD CONSTRAINT event_class_shape CHECK (
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
      AND evidence_class IN (
        'arbiter_attestation',
        'renovate_attestation',
        'automation_attestation'
      )
    )
    OR (event_type = 'superseded' AND evidence_class = 'founder_decision')
    OR (
      event_type NOT IN ('decision', 'attestation', 'superseded')
      AND evidence_class IS NULL
    )
  ),
  DROP CONSTRAINT event_evidence_shape,
  ADD CONSTRAINT event_evidence_shape CHECK (
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
      event_type IN (
        'system_bootstrapped',
        'created',
        'submitted',
        'expired',
        'verified',
        'autonomous_requested',
        'authorized'
      )
      AND evidence_class IS NULL
      AND nonce IS NULL
      AND evidence_expires_at IS NULL
      AND evidence_envelope IS NULL
      AND evidence_sha256 IS NULL
      AND evidence_signature IS NULL
    )
  );

CREATE TABLE heady_approval.autonomous_grant_claims (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  approval_id            UUID NOT NULL UNIQUE REFERENCES heady_approval.approvals(id),
  authorization_event_id UUID NOT NULL UNIQUE REFERENCES heady_approval.events(id),
  requester_principal_id UUID NOT NULL REFERENCES heady_approval.principals(id),
  execution_nonce        TEXT NOT NULL UNIQUE
                         CHECK (execution_nonce ~ '^[A-Za-z0-9_-]{21,233}$'),
  capability             TEXT NOT NULL
                         CHECK (capability IN (
                           'source_authorship',
                           'build_attestation',
                           'maintenance_execution'
                         )),
  subject_sha256         TEXT NOT NULL CHECK (subject_sha256 ~ '^[a-f0-9]{64}$'),
  payload_sha256         TEXT NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  diff_sha256            TEXT NOT NULL CHECK (diff_sha256 ~ '^[a-f0-9]{64}$'),
  policy_sha256          TEXT NOT NULL CHECK (policy_sha256 ~ '^[a-f0-9]{64}$'),
  operation_sha256       TEXT NOT NULL CHECK (operation_sha256 ~ '^[a-f0-9]{64}$'),
  approval_expires_at    TIMESTAMPTZ NOT NULL,
  claimed_at             TIMESTAMPTZ NOT NULL,
  CONSTRAINT autonomous_grant_claim_timing CHECK (claimed_at < approval_expires_at)
);

CREATE OR REPLACE FUNCTION heady_approval.guard_approval_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.state <> 'draft' THEN
    RAISE EXCEPTION 'new approvals must begin in draft state' USING ERRCODE = '23514';
  END IF;
  IF NEW.change_class = 'autonomous_operation' AND NOT EXISTS (
    SELECT 1
      FROM heady_approval.principals requester
     WHERE requester.id = NEW.created_by
       AND requester.principal_type = 'service'
       AND requester.principal_role = 'automation_requester'
       AND requester.active
  ) THEN
    RAISE EXCEPTION 'autonomous approvals require an active automation requester'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.validate_autonomous_event_binding()
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
  IF approval_record.change_class = 'autonomous_operation' AND (
    NEW.policy_input->>'subjectType' IS DISTINCT FROM approval_record.subject_type
    OR NEW.policy_input->>'creatorPrincipalId' IS DISTINCT FROM approval_record.created_by::TEXT
    OR NEW.policy_input->'autonomous' IS DISTINCT FROM approval_record.canonical_payload
  ) THEN
    RAISE EXCEPTION 'autonomous event policy input does not match its proposal'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION heady_approval.validate_autonomous_grant_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM heady_approval.approvals approval_record
      JOIN heady_approval.events authorization_event
        ON authorization_event.id = NEW.authorization_event_id
       AND authorization_event.approval_id = approval_record.id
      JOIN heady_approval.principals requester
        ON requester.id = NEW.requester_principal_id
      JOIN heady_approval.receipts authorization_receipt
        ON authorization_receipt.event_id = authorization_event.id
     WHERE approval_record.id = NEW.approval_id
       AND approval_record.state = 'approved'
       AND approval_record.change_class = 'autonomous_operation'
       AND approval_record.created_by = NEW.requester_principal_id
       AND approval_record.expires_at = NEW.approval_expires_at
       AND approval_record.expires_at > NEW.claimed_at
       AND approval_record.payload_sha256 = NEW.payload_sha256
       AND approval_record.diff_sha256 = NEW.diff_sha256
       AND approval_record.policy_sha256 = NEW.policy_sha256
       AND approval_record.canonical_payload->>'capability' = NEW.capability
       AND approval_record.canonical_payload->>'subjectSha256' = NEW.subject_sha256
       AND authorization_event.event_type = 'authorized'
       AND authorization_event.actor_principal_id = NEW.requester_principal_id
       AND authorization_event.resulting_state = 'approved'
       AND authorization_event.operation_sha256 = NEW.operation_sha256
       AND authorization_receipt.signature_verified
       AND requester.principal_type = 'service'
       AND requester.principal_role = 'automation_requester'
       AND requester.active
  ) THEN
    RAISE EXCEPTION 'autonomous grant claim is not bound to an approved signed authorization'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER approval_autonomous_grant_claim_guard
  BEFORE INSERT ON heady_approval.autonomous_grant_claims
  FOR EACH ROW EXECUTE FUNCTION heady_approval.validate_autonomous_grant_claim();
CREATE TRIGGER approval_autonomous_event_binding_guard
  BEFORE INSERT ON heady_approval.events
  FOR EACH ROW EXECUTE FUNCTION heady_approval.validate_autonomous_event_binding();
CREATE TRIGGER approval_autonomous_grant_claims_append_only
  BEFORE UPDATE OR DELETE ON heady_approval.autonomous_grant_claims
  FOR EACH ROW EXECUTE FUNCTION heady_approval.reject_history_mutation();

REVOKE ALL ON heady_approval.autonomous_grant_claims FROM PUBLIC;
GRANT SELECT, INSERT ON heady_approval.autonomous_grant_claims TO heady_approval_api;

DO $data_api$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON heady_approval.autonomous_grant_claims FROM authenticated;
  END IF;
END
$data_api$;
