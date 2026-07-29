// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Receipts v1.0.0                                ║
// ║  Canonical evidence ceremonies and KMS-verifiable receipt data.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import {
  EVIDENCE_CEREMONY_MAX_MS,
  EVIDENCE_SCHEMA,
  RECEIPT_SCHEMA,
} from "./constants.mjs";
import {
  canonicalize,
  publicJwkFingerprint,
  sha256,
  verifyEd25519,
} from "./canonical.mjs";

export function buildEvidenceEnvelope({
  approvalId,
  action,
  payloadSha256,
  diffSha256,
  policySha256,
  nonce,
  evidenceExpiresAt,
  detail,
}) {
  return {
    schema: EVIDENCE_SCHEMA,
    approvalId,
    action,
    payloadSha256,
    diffSha256,
    policySha256,
    nonce,
    evidenceExpiresAt,
    detail,
  };
}

export function verifyEvidenceCeremony({
  publicJwk,
  envelope,
  signature,
  now = Date.now(),
}) {
  const expiresAt = Date.parse(envelope.evidenceExpiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new TypeError("evidence ceremony is expired");
  }
  if (expiresAt - now > EVIDENCE_CEREMONY_MAX_MS) {
    throw new TypeError("evidence ceremony expiry exceeds the allowed window");
  }
  if (!verifyEd25519({ publicJwk, payload: envelope, signature })) {
    throw new TypeError("evidence signature verification failed");
  }
  return {
    envelope,
    envelopeSha256: sha256(envelope),
    keyFingerprint: publicJwkFingerprint(publicJwk),
  };
}

export function buildReceiptPayload({
  receiptId,
  approvalId,
  eventId,
  sequence,
  eventSha256,
  previousEventSha256,
  payloadSha256,
  diffSha256,
  policySha256,
  state,
  issuedAt,
}) {
  return {
    schema: RECEIPT_SCHEMA,
    receiptId,
    approvalId,
    eventId,
    sequence,
    eventSha256,
    previousEventSha256,
    payloadSha256,
    diffSha256,
    policySha256,
    state,
    issuedAt,
  };
}

export function verifyReceipt({ payload, payloadSha256, signature, publicJwk }) {
  const canonical = canonicalize(payload);
  if (sha256(canonical) !== payloadSha256) return false;
  return verifyEd25519({ publicJwk, payload: canonical, signature });
}
