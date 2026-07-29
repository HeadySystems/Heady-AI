// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Event Canonicalization v1.0.0                  ║
// ║  Stable event envelopes for hash chaining and offline replay.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { EVENT_SCHEMA } from "./constants.mjs";

export function buildEventPayload({
  eventId,
  approvalId,
  sequence,
  eventType,
  actorPrincipalId,
  actorKeyId = null,
  evidenceClass = null,
  decision = null,
  verdict = null,
  reason,
  nonce = null,
  evidenceExpiresAt = null,
  evidenceEnvelope = null,
  evidenceSha256 = null,
  evidenceSignature = null,
  actorSnapshot,
  policyInput,
  policyResult,
  resultingState,
  previousEventSha256 = null,
  traceId,
  idempotencyKey,
  operationSha256,
  occurredAt,
}) {
  return {
    schema: EVENT_SCHEMA,
    eventId,
    approvalId,
    sequence,
    eventType,
    actorPrincipalId,
    actorKeyId,
    evidenceClass,
    decision,
    verdict,
    reason,
    nonce,
    evidenceExpiresAt,
    evidenceEnvelope,
    evidenceSha256,
    evidenceSignature,
    actorSnapshot,
    policyInput,
    policyResult,
    resultingState,
    previousEventSha256,
    traceId,
    idempotencyKey,
    operationSha256,
    occurredAt,
  };
}

export function eventPayloadFromRow(row) {
  return buildEventPayload({
    eventId: row.id,
    approvalId: row.external_approval_id ?? row.approval_id,
    sequence: Number(row.sequence),
    eventType: row.event_type,
    actorPrincipalId: row.actor_principal_id,
    actorKeyId: row.actor_key_id,
    evidenceClass: row.evidence_class,
    decision: row.decision,
    verdict: row.verdict,
    reason: row.reason,
    nonce: row.nonce,
    evidenceExpiresAt: row.evidence_expires_at
      ? new Date(row.evidence_expires_at).toISOString()
      : null,
    evidenceEnvelope: row.evidence_envelope,
    evidenceSha256: row.evidence_sha256,
    evidenceSignature: row.evidence_signature,
    actorSnapshot: row.actor_snapshot,
    policyInput: row.policy_input,
    policyResult: row.policy_result,
    resultingState: row.resulting_state,
    previousEventSha256: row.previous_event_sha256,
    traceId: row.trace_id,
    idempotencyKey: row.idempotency_key,
    operationSha256: row.operation_sha256,
    occurredAt: new Date(row.occurred_at).toISOString(),
  });
}
