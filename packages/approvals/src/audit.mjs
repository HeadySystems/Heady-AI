// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Audit Replay v1.0.0                             ║
// ║  Verifies event chains, policy snapshots, and detached receipts.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import {
  canonicalize,
  publicJwkFingerprint,
  safeHashEqual,
  sha256,
  verifyEd25519,
} from "./canonical.mjs";
import { eventPayloadFromRow } from "./events.mjs";
import { verifyReceipt } from "./receipts.mjs";
import {
  EVIDENCE_SCHEMA,
  RECEIPT_SCHEMA,
} from "./constants.mjs";

function receiptForEvent(receipts, eventId) {
  return receipts.find((receipt) => receipt.event_id === eventId);
}

export async function replayApprovalHistory({
  approval,
  events,
  receipts,
  policyEvaluator,
}) {
  const errors = [];
  const ordered = [...events].sort((left, right) => Number(left.sequence) - Number(right.sequence));
  let previousEventSha256 = null;

  if (ordered.length === 0) errors.push("approval history is empty");
  if (receipts.length !== ordered.length) errors.push("event and receipt counts differ");

  for (let index = 0; index < ordered.length; index += 1) {
    const event = ordered[index];
    const expectedSequence = index + 1;
    if (Number(event.sequence) !== expectedSequence) {
      errors.push(`event sequence gap at ${expectedSequence}`);
    }
    if (event.previous_event_sha256 !== previousEventSha256) {
      errors.push(`previous event hash mismatch at sequence ${expectedSequence}`);
    }

    const eventPayload = eventPayloadFromRow({
      ...event,
      external_approval_id: approval.approval_id,
    });
    const computedEventSha256 = sha256(eventPayload);
    if (!safeHashEqual(computedEventSha256, event.event_sha256)) {
      errors.push(`event hash mismatch at sequence ${expectedSequence}`);
    }
    if (event.evidence_class) {
      if (
        event.evidence_envelope?.schema !== EVIDENCE_SCHEMA
        || event.evidence_envelope?.approvalId !== approval.approval_id
        || event.evidence_envelope?.payloadSha256 !== approval.payload_sha256
        || event.evidence_envelope?.diffSha256 !== approval.diff_sha256
        || event.evidence_envelope?.policySha256 !== approval.policy_sha256
        || event.evidence_envelope?.nonce !== event.nonce
        || event.evidence_envelope?.evidenceExpiresAt
          !== new Date(event.evidence_expires_at).toISOString()
      ) {
        errors.push(`evidence approval binding mismatch at sequence ${expectedSequence}`);
      }
      if (!event.actor_public_jwk || !event.evidence_signature) {
        errors.push(`missing actor verification material at sequence ${expectedSequence}`);
      } else {
        if (!safeHashEqual(sha256(event.evidence_envelope), event.evidence_sha256)) {
          errors.push(`evidence envelope hash mismatch at sequence ${expectedSequence}`);
        }
        if (
          !safeHashEqual(
            publicJwkFingerprint(event.actor_public_jwk),
            event.actor_snapshot.keyFingerprint,
          )
          || !safeHashEqual(event.actor_key_fingerprint, event.actor_snapshot.keyFingerprint)
        ) {
          errors.push(`actor key fingerprint mismatch at sequence ${expectedSequence}`);
        }
        if (!verifyEd25519({
          publicJwk: event.actor_public_jwk,
          payload: event.evidence_envelope,
          signature: event.evidence_signature,
        })) {
          errors.push(`invalid actor evidence signature at sequence ${expectedSequence}`);
        }
        if (
          !event.evidence_expires_at
          || new Date(event.occurred_at).getTime() >= new Date(event.evidence_expires_at).getTime()
        ) {
          errors.push(`evidence ceremony timing mismatch at sequence ${expectedSequence}`);
        }
      }
    }

    const receipt = receiptForEvent(receipts, event.id);
    if (!receipt) {
      errors.push(`missing receipt at sequence ${expectedSequence}`);
    } else {
      const receiptValid = verifyReceipt({
        payload: receipt.canonical_payload,
        payloadSha256: receipt.payload_sha256,
        signature: receipt.signature,
        publicJwk: receipt.public_jwk,
      });
      if (!receiptValid) errors.push(`invalid receipt signature at sequence ${expectedSequence}`);
      if (
        canonicalize(receipt.public_jwk) !== canonicalize(receipt.registered_public_jwk)
        || !safeHashEqual(
          publicJwkFingerprint(receipt.public_jwk),
          receipt.registered_key_fingerprint,
        )
        || new Date(receipt.issued_at).getTime()
          < new Date(receipt.registered_key_valid_from).getTime()
      ) {
        errors.push(`receipt signer registry mismatch at sequence ${expectedSequence}`);
      }
      if (
        receipt.algorithm !== "EC_SIGN_ED25519"
        || receipt.public_jwk_version !== receipt.signing_key_id
        || receipt.canonical_payload.schema !== RECEIPT_SCHEMA
        || receipt.canonical_payload.receiptId !== receipt.receipt_id
        || receipt.canonical_payload.approvalId !== approval.approval_id
        || receipt.canonical_payload.previousEventSha256 !== event.previous_event_sha256
        || receipt.canonical_payload.payloadSha256 !== approval.payload_sha256
        || receipt.canonical_payload.diffSha256 !== approval.diff_sha256
        || receipt.canonical_payload.policySha256 !== approval.policy_sha256
        || receipt.canonical_payload.state !== event.resulting_state
        || receipt.canonical_payload.eventId !== event.id
        || receipt.canonical_payload.eventSha256 !== event.event_sha256
        || receipt.canonical_payload.sequence !== Number(event.sequence)
        || receipt.canonical_payload.issuedAt !== new Date(receipt.issued_at).toISOString()
      ) {
        errors.push(`receipt binding mismatch at sequence ${expectedSequence}`);
      }
    }

    const replayedPolicy = await policyEvaluator.evaluate(event.policy_input);
    if (
      event.policy_input.changeClass !== approval.change_class
      || event.policy_input.patentLocked !== approval.patent_locked
      || event.policy_input.payloadSha256 !== approval.payload_sha256
      || event.policy_input.diffSha256 !== approval.diff_sha256
      || event.policy_input.policySha256 !== approval.policy_sha256
      || canonicalize(event.policy_input.zonePaths) !== canonicalize(approval.zone_paths)
    ) {
      errors.push(`policy input approval binding mismatch at sequence ${expectedSequence}`);
    }
    if (canonicalize(replayedPolicy) !== canonicalize(event.policy_result)) {
      errors.push(`policy replay mismatch at sequence ${expectedSequence}`);
    }
    previousEventSha256 = event.event_sha256;
  }

  const finalEvent = ordered.at(-1);
  if (finalEvent && finalEvent.resulting_state !== approval.state) {
    errors.push("materialized approval state differs from event history");
  }
  if (!safeHashEqual(approval.policy_sha256, policyEvaluator.sourceSha256)) {
    errors.push("approval policy source hash differs from the loaded evaluator");
  }

  return {
    valid: errors.length === 0,
    errors,
    throughSequence: ordered.length,
    chainHeadSha256: previousEventSha256,
    receiptCount: receipts.length,
    policySha256: policyEvaluator.sourceSha256,
  };
}
