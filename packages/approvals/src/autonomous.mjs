// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Autonomous Grant Verification v1.0.0                    ║
// ║  Offline validation of one-time KMS-signed authorization grants.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { publicJwkFingerprint, safeHashEqual, sha256 } from "./canonical.mjs";
import { verifyReceipt } from "./receipts.mjs";
import { AutonomousGrantSchema } from "./schemas.mjs";

export function verifyAutonomousGrant(grantInput, {
  now = Date.now(),
  trustedSigner,
} = {}) {
  const result = AutonomousGrantSchema.safeParse(grantInput);
  if (
    !result.success
    || typeof trustedSigner?.signingKeyId !== "string"
    || !trustedSigner.publicJwk
  ) return false;
  let trustedSignerFingerprint;
  let receiptSignerFingerprint;
  try {
    trustedSignerFingerprint = publicJwkFingerprint(trustedSigner.publicJwk);
    receiptSignerFingerprint = publicJwkFingerprint(result.data.authorizationReceipt.publicJwk);
  } catch {
    return false;
  }
  const grant = result.data;
  const event = grant.authorizationEvent;
  const receipt = grant.authorizationReceipt;
  const policyInput = event.policyInput;
  const policyResult = event.policyResult;
  const expiresAtEpochMs = Date.parse(grant.expiresAt);
  const expectedOperationSha256 = sha256({
    action: "authorize_autonomous",
    value: {
      approvalId: event.approvalId,
      capability: grant.capability,
      subjectSha256: grant.subjectSha256,
      payloadSha256: grant.payloadSha256,
      diffSha256: grant.diffSha256,
      policySha256: grant.policySha256,
      executionNonce: grant.executionNonce,
    },
  });

  return (
    Number.isFinite(expiresAtEpochMs)
    && expiresAtEpochMs > now
    && event.schema === "heady.approval.event.v1"
    && event.eventType === "authorized"
    && event.resultingState === "approved"
    && event.actorPrincipalId === event.actorSnapshot?.principalId
    && event.actorPrincipalId === policyInput?.creatorPrincipalId
    && event.actorSnapshot?.principalType === "service"
    && event.actorSnapshot?.principalRole === "automation_requester"
    && policyInput?.state === "pending"
    && policyInput?.changeClass === "autonomous_operation"
    && policyInput?.subjectType === "autonomous_process"
    && policyInput?.expiresAtEpochMs === expiresAtEpochMs
    && policyInput?.nowEpochMs < expiresAtEpochMs
    && policyInput?.autonomous?.capability === grant.capability
    && policyInput?.autonomous?.subjectSha256 === grant.subjectSha256
    && policyResult?.allow === true
    && safeHashEqual(event.operationSha256, expectedOperationSha256)
    && safeHashEqual(grant.operationSha256, expectedOperationSha256)
    && safeHashEqual(policyInput?.payloadSha256, grant.payloadSha256)
    && safeHashEqual(policyInput?.diffSha256, grant.diffSha256)
    && safeHashEqual(policyInput?.policySha256, grant.policySha256)
    && receipt.eventId === event.eventId
    && receipt.signingKeyId === trustedSigner.signingKeyId
    && safeHashEqual(receiptSignerFingerprint, trustedSignerFingerprint)
    && receipt.publicJwkVersion === receipt.signingKeyId
    && receipt.payload?.schema === "heady.approval.receipt.v1"
    && receipt.payload?.receiptId === receipt.receiptId
    && receipt.payload?.approvalId === event.approvalId
    && receipt.payload?.eventId === event.eventId
    && receipt.payload?.sequence === event.sequence
    && receipt.payload?.previousEventSha256 === event.previousEventSha256
    && receipt.payload?.state === "approved"
    && receipt.payload?.issuedAt === receipt.issuedAt
    && event.occurredAt === receipt.issuedAt
    && safeHashEqual(receipt.payload?.eventSha256, sha256(event))
    && safeHashEqual(receipt.payload?.payloadSha256, grant.payloadSha256)
    && safeHashEqual(receipt.payload?.diffSha256, grant.diffSha256)
    && safeHashEqual(receipt.payload?.policySha256, grant.policySha256)
    && verifyReceipt({
      payload: receipt.payload,
      payloadSha256: receipt.payloadSha256,
      signature: receipt.signature,
      publicJwk: receipt.publicJwk,
    })
  );
}
