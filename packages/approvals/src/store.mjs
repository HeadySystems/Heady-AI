// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Store v1.0.0                                   ║
// ║  Parameterized Neon queries for the authoritative approval log. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { NotFoundError } from "@heady/shared";
import { verifyReceipt } from "./receipts.mjs";

const APPROVAL_COLUMNS = `
  id, approval_id, hcp_identifier, title, subject_type, change_class,
  patent_locked, renovate_patch_only, zone_paths, canonical_payload,
  payload_sha256, diff_sha256, artifact_digest, state, policy_version,
  policy_sha256, required_evidence, expires_at, superseded_by, created_by,
  trace_id, creation_idempotency_key, created_at, updated_at
`;

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

export function publicApproval(row) {
  return {
    approvalId: row.approval_id,
    hcpIdentifier: row.hcp_identifier,
    title: row.title,
    subjectType: row.subject_type,
    changeClass: row.change_class,
    patentLocked: row.patent_locked,
    renovatePatchOnly: row.renovate_patch_only,
    zonePaths: row.zone_paths,
    payload: row.canonical_payload,
    payloadSha256: row.payload_sha256,
    diffSha256: row.diff_sha256,
    artifactDigest: row.artifact_digest,
    state: row.state,
    policyVersion: row.policy_version,
    policySha256: row.policy_sha256,
    requiredEvidence: row.required_evidence,
    expiresAt: iso(row.expires_at),
    supersededBy: row.superseded_external_id ?? null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export async function resolvePrincipal(client, actor) {
  const identityColumn = actor.authType === "firebase" ? "firebase_uid" : "workload_identity";
  const result = await client.query(`
    SELECT
      p.*,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', k.id,
            'fingerprint', k.fingerprint,
            'publicJwk', k.public_jwk,
            'active', k.active,
            'validFrom', k.valid_from,
            'revokedAt', k.revoked_at
          )
          ORDER BY k.created_at
        ) FILTER (WHERE k.id IS NOT NULL),
        '[]'::jsonb
      ) AS keys
    FROM heady_approval.principals p
    LEFT JOIN heady_approval.principal_keys k ON k.principal_id = p.id
    WHERE p.${identityColumn} = $1
    GROUP BY p.id
  `, [actor.subject]);
  return result.rows[0] ?? null;
}

export async function lockIdempotencyScope(client, principalId, idempotencyKey) {
  const scope = `${principalId}:${idempotencyKey}`;
  // The zero is a fixed PostgreSQL hash seed, not a runtime tuning parameter.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [scope]);
}

export async function findIdempotentEvent(client, principalId, idempotencyKey) {
  const result = await client.query(`
    SELECT
      e.id,
      e.event_type,
      e.operation_sha256,
      e.sequence,
      e.resulting_state,
      a.approval_id
    FROM heady_approval.events e
    JOIN heady_approval.approvals a ON a.id = e.approval_id
    WHERE e.actor_principal_id = $1 AND e.idempotency_key = $2
  `, [principalId, idempotencyKey]);
  return result.rows[0] ?? null;
}

export async function findApproval(client, approvalId, { forUpdate = false } = {}) {
  const result = await client.query(`
    SELECT
      a.*,
      replacement.approval_id AS superseded_external_id
    FROM heady_approval.approvals a
    LEFT JOIN heady_approval.approvals replacement ON replacement.id = a.superseded_by
    WHERE a.approval_id = $1
    ${forUpdate ? "FOR UPDATE OF a" : ""}
  `, [approvalId]);
  return result.rows[0] ?? null;
}

export async function requireApproval(client, approvalId, options) {
  const approval = await findApproval(client, approvalId, options);
  if (!approval) throw new NotFoundError("approval not found", { approvalId });
  return approval;
}

export async function insertApproval(client, value) {
  const result = await client.query(`
    INSERT INTO heady_approval.approvals (
      approval_id,
      hcp_identifier,
      title,
      subject_type,
      change_class,
      patent_locked,
      renovate_patch_only,
      zone_paths,
      canonical_payload,
      payload_sha256,
      diff_sha256,
      artifact_digest,
      state,
      policy_version,
      policy_sha256,
      required_evidence,
      expires_at,
      created_by,
      trace_id,
      creation_idempotency_key,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12, 'draft', $13, $14, $15, NULL, $16, $17, $18, $19, $19
    )
    RETURNING ${APPROVAL_COLUMNS}
  `, [
    value.approvalId,
    value.hcpIdentifier,
    value.title,
    value.subjectType,
    value.changeClass,
    value.patentLocked,
    value.renovatePatchOnly,
    value.zonePaths,
    value.payload,
    value.payloadSha256,
    value.diffSha256,
    value.artifactDigest,
    value.policyVersion,
    value.policySha256,
    value.requiredEvidence,
    value.createdBy,
    value.traceId,
    value.idempotencyKey,
    value.occurredAt,
  ]);
  return result.rows[0];
}

export async function markSubmitted(client, approvalInternalId, {
  expiresAt,
  requiredEvidence,
  occurredAt,
}) {
  const result = await client.query(`
    UPDATE heady_approval.approvals
       SET state = 'pending',
           expires_at = $2,
           required_evidence = $3,
           updated_at = $4
     WHERE id = $1
     RETURNING ${APPROVAL_COLUMNS}
  `, [approvalInternalId, expiresAt, requiredEvidence, occurredAt]);
  return result.rows[0];
}

export async function updateDecisionState(client, approvalInternalId, {
  state,
  requiredEvidence,
  occurredAt,
}) {
  const result = await client.query(`
    UPDATE heady_approval.approvals
       SET state = $2,
           required_evidence = $3,
           updated_at = $4
     WHERE id = $1
     RETURNING ${APPROVAL_COLUMNS}
  `, [approvalInternalId, state, requiredEvidence, occurredAt]);
  return result.rows[0];
}

export async function markSuperseded(client, approvalInternalId, {
  replacementInternalId,
  occurredAt,
}) {
  const result = await client.query(`
    UPDATE heady_approval.approvals
       SET state = 'superseded',
           superseded_by = $2,
           updated_at = $3
     WHERE id = $1
     RETURNING ${APPROVAL_COLUMNS}
  `, [approvalInternalId, replacementInternalId, occurredAt]);
  return result.rows[0];
}

export async function loadEvents(client, approvalInternalId) {
  const result = await client.query(`
    SELECT
      e.*,
      k.public_jwk AS actor_public_jwk,
      k.fingerprint AS actor_key_fingerprint
    FROM heady_approval.events e
    LEFT JOIN heady_approval.principal_keys k ON k.id = e.actor_key_id
    WHERE e.approval_id = $1
    ORDER BY e.sequence
  `, [approvalInternalId]);
  return result.rows;
}

export async function loadEvidence(client, approvalInternalId) {
  const result = await client.query(`
    SELECT
      e.*,
      p.active AS current_principal_active,
      k.active AS current_key_active
    FROM heady_approval.events e
    JOIN heady_approval.principals p ON p.id = e.actor_principal_id
    LEFT JOIN heady_approval.principal_keys k ON k.id = e.actor_key_id
    WHERE e.approval_id = $1 AND e.evidence_class IS NOT NULL
    ORDER BY e.sequence
  `, [approvalInternalId]);
  return result.rows;
}

export async function loadReceipts(client, approvalInternalId) {
  const result = await client.query(`
    SELECT
      r.*,
      signer.public_jwk AS registered_public_jwk,
      signer.fingerprint AS registered_key_fingerprint,
      signer.valid_from AS registered_key_valid_from
    FROM heady_approval.receipts r
    JOIN heady_approval.events e ON e.id = r.event_id
    JOIN heady_approval.receipt_signing_keys signer ON signer.key_id = r.signing_key_id
    WHERE e.approval_id = $1
    ORDER BY e.sequence
  `, [approvalInternalId]);
  return result.rows;
}

export async function lastEvent(client, approvalInternalId) {
  const result = await client.query(`
    SELECT id, sequence, event_sha256
    FROM heady_approval.events
    WHERE approval_id = $1
    ORDER BY sequence DESC
    LIMIT 1
  `, [approvalInternalId]);
  return result.rows[0] ?? null;
}

export async function findReceiptSigningKey(client, keyId) {
  const result = await client.query(`
    SELECT key_id, fingerprint, public_jwk, active, valid_from, revoked_at
    FROM heady_approval.receipt_signing_keys
    WHERE key_id = $1
  `, [keyId]);
  return result.rows[0] ?? null;
}

export async function findAutonomousGrantClaim(client, approvalInternalId) {
  const result = await client.query(`
    SELECT *
    FROM heady_approval.autonomous_grant_claims
    WHERE approval_id = $1
  `, [approvalInternalId]);
  return result.rows[0] ?? null;
}

export async function findAutonomousGrantClaimByNonce(client, executionNonce) {
  const result = await client.query(`
    SELECT *
    FROM heady_approval.autonomous_grant_claims
    WHERE execution_nonce = $1
  `, [executionNonce]);
  return result.rows[0] ?? null;
}

export async function lockAutonomousExecutionNonce(client, executionNonce) {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`autonomous-execution:${executionNonce}`],
  );
}

export async function insertAutonomousGrantClaim(client, value) {
  const result = await client.query(`
    INSERT INTO heady_approval.autonomous_grant_claims (
      approval_id,
      authorization_event_id,
      requester_principal_id,
      execution_nonce,
      capability,
      subject_sha256,
      payload_sha256,
      diff_sha256,
      policy_sha256,
      operation_sha256,
      approval_expires_at,
      claimed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `, [
    value.approvalInternalId,
    value.authorizationEventId,
    value.requesterPrincipalId,
    value.executionNonce,
    value.capability,
    value.subjectSha256,
    value.payloadSha256,
    value.diffSha256,
    value.policySha256,
    value.operationSha256,
    value.approvalExpiresAt,
    value.claimedAt,
  ]);
  return result.rows[0];
}

export async function insertEvent(client, value) {
  await client.query(`
    INSERT INTO heady_approval.events (
      id,
      approval_id,
      sequence,
      event_type,
      actor_principal_id,
      actor_key_id,
      evidence_class,
      decision,
      verdict,
      reason,
      nonce,
      evidence_expires_at,
      evidence_envelope,
      evidence_sha256,
      evidence_signature,
      actor_snapshot,
      policy_input,
      policy_result,
      resulting_state,
      previous_event_sha256,
      event_sha256,
      trace_id,
      idempotency_key,
      operation_sha256,
      occurred_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
      $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
    )
  `, [
    value.id,
    value.approvalInternalId,
    value.sequence,
    value.eventType,
    value.actorPrincipalId,
    value.actorKeyId,
    value.evidenceClass,
    value.decision,
    value.verdict,
    value.reason,
    value.nonce,
    value.evidenceExpiresAt,
    value.evidenceEnvelope,
    value.evidenceSha256,
    value.evidenceSignature,
    value.actorSnapshot,
    value.policyInput,
    value.policyResult,
    value.resultingState,
    value.previousEventSha256,
    value.eventSha256,
    value.traceId,
    value.idempotencyKey,
    value.operationSha256,
    value.occurredAt,
  ]);
}

export async function insertReceipt(client, value) {
  await client.query(`
    INSERT INTO heady_approval.receipts (
      id,
      receipt_id,
      event_id,
      canonical_payload,
      payload_sha256,
      signing_key_id,
      algorithm,
      signature,
      public_jwk,
      public_jwk_version,
      signature_verified,
      issued_at,
      last_audit_verified_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, $11
    )
  `, [
    value.id,
    value.receiptId,
    value.eventId,
    value.payload,
    value.payloadSha256,
    value.signingKeyId,
    value.algorithm,
    value.signature,
    value.publicJwk,
    value.publicJwkVersion,
    value.issuedAt,
  ]);
}

export async function insertOutbox(client, value) {
  await client.query(`
    INSERT INTO heady_approval.outbox (
      event_id,
      topic,
      payload,
      created_at,
      available_at
    ) VALUES ($1, $2, $3, $4, $4)
  `, [value.eventId, value.topic, value.payload, value.occurredAt]);
}

export async function insertAuditReplay(client, value) {
  await client.query(`
    INSERT INTO heady_approval.audit_replays (
      approval_id,
      through_sequence,
      valid,
      chain_head_sha256,
      policy_sha256,
      receipt_count,
      verification_summary,
      verifier_principal_id,
      trace_id,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    value.approvalInternalId,
    value.throughSequence,
    value.valid,
    value.chainHeadSha256,
    value.policySha256,
    value.receiptCount,
    value.verificationSummary,
    value.verifierPrincipalId,
    value.traceId,
    value.occurredAt,
  ]);
}

export async function approvalView(client, approvalId) {
  const approval = await requireApproval(client, approvalId);
  const [events, receipts] = await Promise.all([
    loadEvents(client, approval.id),
    loadReceipts(client, approval.id),
  ]);
  const receiptByEvent = new Map(receipts.map((receipt) => [receipt.event_id, receipt]));
  return {
    ...publicApproval(approval),
    eventSequence: events.length,
    events: events.map((event) => {
      const receipt = receiptByEvent.get(event.id);
      return {
        eventId: event.id,
        sequence: Number(event.sequence),
        eventType: event.event_type,
        evidenceClass: event.evidence_class,
        decision: event.decision,
        verdict: event.verdict,
        reason: event.reason,
        actor: event.actor_snapshot,
        policyResult: event.policy_result,
        resultingState: event.resulting_state,
        eventSha256: event.event_sha256,
        occurredAt: iso(event.occurred_at),
        receiptId: receipt?.receipt_id ?? null,
        receiptVerified: receipt
          ? verifyReceipt({
              payload: receipt.canonical_payload,
              payloadSha256: receipt.payload_sha256,
              signature: receipt.signature,
              publicJwk: receipt.public_jwk,
            })
          : false,
      };
    }),
  };
}

export function publicReceipts(receipts) {
  return receipts.map((receipt) => ({
    receiptId: receipt.receipt_id,
    eventId: receipt.event_id,
    payload: receipt.canonical_payload,
    payloadSha256: receipt.payload_sha256,
    signingKeyId: receipt.signing_key_id,
    algorithm: receipt.algorithm,
    signature: receipt.signature,
    publicJwk: receipt.public_jwk,
    publicJwkVersion: receipt.public_jwk_version,
    signatureVerified: verifyReceipt({
      payload: receipt.canonical_payload,
      payloadSha256: receipt.payload_sha256,
      signature: receipt.signature,
      publicJwk: receipt.public_jwk,
    }),
    issuedAt: iso(receipt.issued_at),
  }));
}
