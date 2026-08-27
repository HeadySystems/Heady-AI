// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Service v1.0.0                                 ║
// ║  Transactional HCP decisions, policy evaluation, and receipts.  ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { randomUUID } from "node:crypto";
import {
  ConflictError,
  HeadyError,
  ValidationError,
} from "@heady/shared";
import {
  APPROVAL_LIFETIME_MS,
  AUTONOMOUS_APPROVAL_LIFETIME_MS,
  classifyChange,
  isAutonomousBlockedPath,
  isPatentZonePath,
  normalizeZonePath,
  requiredEvidenceFor,
} from "./constants.mjs";
import {
  canonicalize,
  publicJwkFingerprint,
  safeHashEqual,
  sha256,
} from "./canonical.mjs";
import { buildEventPayload, eventPayloadFromRow } from "./events.mjs";
import {
  actorSnapshot,
  assertEvidenceAllowed,
  ForbiddenError,
  requirePrincipal,
  verifyPrincipalEvidence,
} from "./identity.mjs";
import { buildPendingPolicyInput, buildPolicyInput } from "./policy-input.mjs";
import {
  AttestationEvidenceSchema,
  AutonomousApprovalRequestSchema,
  AutonomousProtectionSchema,
  CreateApprovalSchema,
  DecisionEvidenceSchema,
  DeploymentProtectionSchema,
  IdempotencyKeySchema,
  SubmitApprovalSchema,
  SupersedeApprovalSchema,
  TraceIdSchema,
  UlidSchema,
  VerifyApprovalSchema,
} from "./schemas.mjs";
import {
  buildEvidenceEnvelope,
  buildReceiptPayload,
  verifyReceipt,
} from "./receipts.mjs";
import { replayApprovalHistory } from "./audit.mjs";
import { verifyAutonomousGrant } from "./autonomous.mjs";
import {
  approvalView,
  findAutonomousGrantClaim,
  findAutonomousGrantClaimByNonce,
  findReceiptSigningKey,
  findIdempotentEvent,
  insertApproval,
  insertAutonomousGrantClaim,
  insertAuditReplay,
  insertEvent,
  insertOutbox,
  insertReceipt,
  lastEvent,
  loadEvidence,
  loadEvents,
  loadReceipts,
  lockAutonomousExecutionNonce,
  lockIdempotencyScope,
  markSubmitted,
  markSuperseded,
  publicReceipts,
  requireApproval,
  updateDecisionState,
} from "./store.mjs";
import { createUlid } from "./ulid.mjs";

const RECEIPT_ALGORITHM = "EC_SIGN_ED25519";

function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError("approval input validation failed", {
      issues: result.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
      })),
    });
  }
  return result.data;
}

function asDate(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError("approval clock returned an invalid date");
  return date;
}

function sameStringSet(left, right) {
  const normalizedLeft = [...new Set(left.map(normalizeZonePath))].sort();
  const normalizedRight = [...new Set(right.map(normalizeZonePath))].sort();
  return canonicalize(normalizedLeft) === canonicalize(normalizedRight);
}

function requireRole(principal, allowedRoles, action) {
  if (!allowedRoles.includes(principal.principal_role)) {
    throw new ForbiddenError(`principal role cannot ${action}`, {
      principalRole: principal.principal_role,
      allowedRoles,
    });
  }
}

function operationHash(action, value) {
  return sha256({ action, value });
}

function policyEvidence({
  eventId,
  principal,
  evidenceClass,
  decision = null,
  verdict = null,
  detail,
  approval,
}) {
  return {
    eventId,
    principalId: principal.id,
    principalType: principal.principal_type,
    principalRole: principal.principal_role,
    evidenceClass,
    decision,
    verdict,
    resolvesEscalation: detail.resolvesEscalation === true,
    patentClaims: detail.patentClaims ?? [],
    reviewedPaths: detail.reviewedPaths ?? [],
    principalActive: true,
    ceremonyVerified: true,
    payloadSha256: approval.payload_sha256,
    diffSha256: approval.diff_sha256,
    policySha256: approval.policy_sha256,
  };
}

function assertPending(approval) {
  if (approval.state !== "pending") {
    throw new ConflictError("approval evidence can only be added while pending", {
      approvalId: approval.approval_id,
      state: approval.state,
    });
  }
}

function assertActivePolicy(approval, policyEvaluator) {
  if (
    approval.policy_version !== policyEvaluator.version
    || !safeHashEqual(approval.policy_sha256, policyEvaluator.sourceSha256)
  ) {
    throw new ConflictError("approval is pinned to a different policy build", {
      approvalId: approval.approval_id,
      approvalPolicyVersion: approval.policy_version,
      activePolicyVersion: policyEvaluator.version,
    });
  }
}

function idempotencyResult(existing, expectedOperationSha256) {
  if (!existing) return null;
  if (!safeHashEqual(existing.operation_sha256, expectedOperationSha256)) {
    throw new ConflictError("idempotency key was already used for a different operation", {
      approvalId: existing.approval_id,
      eventType: existing.event_type,
    });
  }
  return existing.approval_id;
}

export function createApprovalService({
  database,
  policyEvaluator,
  signer,
  clock = () => new Date(),
  uuidFactory = randomUUID,
  ulidFactory = createUlid,
}) {
  if (!database || typeof database.tx !== "function" || typeof database.query !== "function") {
    throw new TypeError("approval service requires a database with query and tx methods");
  }
  if (!policyEvaluator || typeof policyEvaluator.evaluate !== "function") {
    throw new TypeError("approval service requires a policy evaluator");
  }
  if (!signer || typeof signer.sign !== "function") {
    throw new TypeError("approval service requires a receipt signer");
  }

  async function appendSignedEvent(client, {
    approval,
    eventId,
    eventType,
    principal,
    actor,
    key = null,
    evidenceClass = null,
    decision = null,
    verdict = null,
    reason,
    nonce = null,
    evidenceExpiresAt = null,
    evidenceEnvelope = null,
    evidenceSha256 = null,
    evidenceSignature = null,
    policyInput,
    policyResult,
    resultingState,
    traceId,
    idempotencyKey,
    operationSha256,
    occurredAt,
  }) {
    const previous = await lastEvent(client, approval.id);
    const sequence = previous ? Number(previous.sequence) + 1 : 1;
    const previousEventSha256 = previous?.event_sha256 ?? null;
    const snapshot = actorSnapshot(principal, actor, {
      key,
      ceremonyVerified: key !== null,
    });
    const eventPayload = buildEventPayload({
      eventId,
      approvalId: approval.approval_id,
      sequence,
      eventType,
      actorPrincipalId: principal.id,
      actorKeyId: key?.id ?? null,
      evidenceClass,
      decision,
      verdict,
      reason,
      nonce,
      evidenceExpiresAt,
      evidenceEnvelope,
      evidenceSha256,
      evidenceSignature,
      actorSnapshot: snapshot,
      policyInput,
      policyResult,
      resultingState,
      previousEventSha256,
      traceId,
      idempotencyKey,
      operationSha256,
      occurredAt,
    });
    const eventSha256 = sha256(eventPayload);
    const receiptId = ulidFactory();
    const receiptPayload = buildReceiptPayload({
      receiptId,
      approvalId: approval.approval_id,
      eventId,
      sequence,
      eventSha256,
      previousEventSha256,
      payloadSha256: approval.payload_sha256,
      diffSha256: approval.diff_sha256,
      policySha256: approval.policy_sha256,
      state: resultingState,
      issuedAt: occurredAt,
    });
    const receiptPayloadSha256 = sha256(receiptPayload);
    const signatureResult = await signer.sign({
      payload: Buffer.from(canonicalize(receiptPayload)),
      payloadSha256: receiptPayloadSha256,
    });
    if (signatureResult.algorithm !== RECEIPT_ALGORITHM) {
      throw new HeadyError("receipt signer returned an unsupported algorithm", {
        code: "SIGNER_ALGORITHM",
        status: 502,
      });
    }
    if (
      typeof signatureResult.signingKeyId !== "string"
      || !signatureResult.signingKeyId
      || signatureResult.publicJwkVersion !== signatureResult.signingKeyId
    ) {
      throw new HeadyError("receipt signer returned inconsistent key-version metadata", {
        code: "SIGNER_METADATA",
        status: 502,
      });
    }
    if (!verifyReceipt({
      payload: receiptPayload,
      payloadSha256: receiptPayloadSha256,
      signature: signatureResult.signature,
      publicJwk: signatureResult.publicJwk,
    })) {
      throw new HeadyError("receipt signer output failed local verification", {
        code: "SIGNER_VERIFICATION",
        status: 502,
      });
    }
    const registeredSigner = await findReceiptSigningKey(
      client,
      signatureResult.signingKeyId,
    );
    if (
      !registeredSigner
      || !registeredSigner.active
      || new Date(registeredSigner.valid_from).getTime() > new Date(occurredAt).getTime()
      || canonicalize(registeredSigner.public_jwk) !== canonicalize(signatureResult.publicJwk)
      || !safeHashEqual(
        registeredSigner.fingerprint,
        publicJwkFingerprint(signatureResult.publicJwk),
      )
    ) {
      throw new HeadyError("receipt signer is not an active registered key", {
        code: "SIGNER_NOT_REGISTERED",
        status: 503,
      });
    }

    await insertEvent(client, {
      id: eventId,
      approvalInternalId: approval.id,
      sequence,
      eventType,
      actorPrincipalId: principal.id,
      actorKeyId: key?.id ?? null,
      evidenceClass,
      decision,
      verdict,
      reason,
      nonce,
      evidenceExpiresAt,
      evidenceEnvelope,
      evidenceSha256,
      evidenceSignature,
      actorSnapshot: snapshot,
      policyInput,
      policyResult,
      resultingState,
      previousEventSha256,
      eventSha256,
      traceId,
      idempotencyKey,
      operationSha256,
      occurredAt,
    });
    await insertReceipt(client, {
      id: uuidFactory(),
      receiptId,
      eventId,
      payload: receiptPayload,
      payloadSha256: receiptPayloadSha256,
      signingKeyId: signatureResult.signingKeyId,
      algorithm: signatureResult.algorithm,
      signature: signatureResult.signature,
      publicJwk: signatureResult.publicJwk,
      publicJwkVersion: signatureResult.publicJwkVersion,
      issuedAt: occurredAt,
    });
    await insertOutbox(client, {
      eventId,
      topic: `heady.approval.${eventType}`,
      payload: {
        schema: "heady.approval.outbox.v1",
        approvalId: approval.approval_id,
        eventId,
        sequence,
        state: resultingState,
        eventSha256,
        receiptId,
        traceId,
      },
      occurredAt,
    });
    return { eventId, eventSha256, receiptId, sequence };
  }

  async function beginOperation(client, actorInput, idempotencyKey, expectedOperationSha256) {
    const { actor, principal } = await requirePrincipal(client, actorInput);
    await lockIdempotencyScope(client, principal.id, idempotencyKey);
    const existing = await findIdempotentEvent(client, principal.id, idempotencyKey);
    const replayApprovalId = idempotencyResult(existing, expectedOperationSha256);
    return { actor, principal, replayApprovalId };
  }

  async function expireIfElapsed(client, context) {
    const {
      approval,
      actor,
      principal,
      traceId,
      idempotencyKey,
      operationSha256,
      now,
    } = context;
    if (!approval.expires_at || new Date(approval.expires_at).getTime() > now.getTime()) {
      return null;
    }
    const evidenceRows = await loadEvidence(client, approval.id);
    const policyInput = buildPolicyInput({
      approval,
      evidenceRows,
      nowEpochMs: now.getTime(),
      state: "pending",
    });
    const policyResult = await policyEvaluator.evaluate(policyInput);
    await updateDecisionState(client, approval.id, {
      state: "expired",
      requiredEvidence: policyResult.missingEvidence,
      occurredAt: now.toISOString(),
    });
    await appendSignedEvent(client, {
      approval,
      eventId: uuidFactory(),
      eventType: "expired",
      principal,
      actor,
      reason: "approval lifetime elapsed before evidence was accepted",
      policyInput,
      policyResult,
      resultingState: "expired",
      traceId,
      idempotencyKey,
      operationSha256,
      occurredAt: now.toISOString(),
    });
    return approvalView(client, approval.approval_id);
  }

  async function create({ actor: actorInput, input, idempotencyKey, traceId }) {
    const parsed = parse(CreateApprovalSchema, input);
    const parsedIdempotencyKey = parse(IdempotencyKeySchema, idempotencyKey);
    const parsedTraceId = parse(TraceIdSchema, traceId);
    const normalizedPaths = [...new Set(parsed.zonePaths.map(normalizeZonePath))].sort();
    const normalized = { ...parsed, zonePaths: normalizedPaths };
    const expectedOperationSha256 = operationHash("create", normalized);

    return database.tx(async (client) => {
      const { actor, principal, replayApprovalId } = await beginOperation(
        client,
        actorInput,
        parsedIdempotencyKey,
        expectedOperationSha256,
      );
      if (replayApprovalId) return approvalView(client, replayApprovalId);
      requireRole(principal, ["founder"], "create approval drafts");

      const payloadSha256 = sha256(parsed.payload);
      if (parsed.payloadSha256 && !safeHashEqual(parsed.payloadSha256, payloadSha256)) {
        throw new ValidationError("provided payload hash does not match the canonical payload");
      }
      const effectivePatentLocked = (
        parsed.patentLocked
        || normalizedPaths.some(isPatentZonePath)
      );
      const changeClass = classifyChange({
        subjectType: parsed.subjectType,
        patentLocked: effectivePatentLocked,
        zonePaths: normalizedPaths,
        renovatePatchOnly: parsed.renovatePatchOnly,
      });
      const now = asDate(clock);
      const approval = await insertApproval(client, {
        approvalId: ulidFactory(),
        hcpIdentifier: parsed.hcpIdentifier,
        title: parsed.title,
        subjectType: parsed.subjectType,
        changeClass,
        patentLocked: effectivePatentLocked,
        renovatePatchOnly: parsed.renovatePatchOnly,
        zonePaths: normalizedPaths,
        payload: parsed.payload,
        payloadSha256,
        diffSha256: parsed.diffSha256,
        artifactDigest: parsed.artifactDigest ?? null,
        policyVersion: policyEvaluator.version,
        policySha256: policyEvaluator.sourceSha256,
        requiredEvidence: requiredEvidenceFor(changeClass, {
          patentLocked: effectivePatentLocked,
        }),
        createdBy: principal.id,
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        occurredAt: now.toISOString(),
      });
      const policyInput = buildPolicyInput({
        approval,
        evidenceRows: [],
        nowEpochMs: now.getTime(),
      });
      const policyResult = await policyEvaluator.evaluate(policyInput);
      await appendSignedEvent(client, {
        approval,
        eventId: uuidFactory(),
        eventType: "created",
        principal,
        actor,
        reason: "approval draft created",
        policyInput,
        policyResult,
        resultingState: "draft",
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        operationSha256: expectedOperationSha256,
        occurredAt: now.toISOString(),
      });
      return approvalView(client, approval.approval_id);
    });
  }

  async function requestAutonomous({ actor: actorInput, input, idempotencyKey, traceId }) {
    const parsed = parse(AutonomousApprovalRequestSchema, input);
    const parsedIdempotencyKey = parse(IdempotencyKeySchema, idempotencyKey);
    const parsedTraceId = parse(TraceIdSchema, traceId);
    const normalizedPaths = [...new Set(parsed.zonePaths.map(normalizeZonePath))].sort();
    const normalizedScopes = [...new Set(parsed.resourceScopes)].sort();
    const normalized = {
      ...parsed,
      zonePaths: normalizedPaths,
      resourceScopes: normalizedScopes,
    };
    const expectedOperationSha256 = operationHash("request_autonomous", normalized);

    return database.tx(async (client) => {
      const { actor, principal, replayApprovalId } = await beginOperation(
        client,
        actorInput,
        parsedIdempotencyKey,
        expectedOperationSha256,
      );
      if (replayApprovalId) return approvalView(client, replayApprovalId);
      requireRole(principal, ["automation_requester"], "request autonomous approval");
      const blockedPaths = normalizedPaths.filter(isAutonomousBlockedPath);
      if (blockedPaths.length > 0) {
        throw new ForbiddenError("autonomous approval targets a human-gated path", {
          blockedPaths,
        });
      }

      const now = asDate(clock);
      const expiresAt = new Date(now.getTime() + AUTONOMOUS_APPROVAL_LIFETIME_MS);
      const payload = {
        schema: "heady.autonomous.approval.v1",
        capability: parsed.capability,
        requesterPrincipalId: principal.id,
        requesterWorkloadIdentity: principal.workload_identity,
        resourceScopes: normalizedScopes,
        subjectSha256: parsed.subjectSha256,
        rollbackPlanSha256: parsed.rollbackPlanSha256,
        riskTier: parsed.riskTier,
        reversible: parsed.reversible,
        dryRunVerified: parsed.dryRunVerified,
        networkAccess: parsed.networkAccess,
        maxAffectedResources: parsed.maxAffectedResources,
        maxDurationMs: parsed.maxDurationMs,
      };
      const payloadSha256 = sha256(payload);
      const changeClass = classifyChange({
        subjectType: "autonomous_process",
        patentLocked: false,
        zonePaths: normalizedPaths,
      });
      if (changeClass !== "autonomous_operation") {
        throw new ForbiddenError("autonomous request was reclassified into a human-gated lane", {
          changeClass,
        });
      }
      const approval = await insertApproval(client, {
        approvalId: ulidFactory(),
        hcpIdentifier: parsed.hcpIdentifier,
        title: parsed.title,
        subjectType: "autonomous_process",
        changeClass,
        patentLocked: false,
        renovatePatchOnly: false,
        zonePaths: normalizedPaths,
        payload,
        payloadSha256,
        diffSha256: parsed.diffSha256,
        artifactDigest: null,
        policyVersion: policyEvaluator.version,
        policySha256: policyEvaluator.sourceSha256,
        requiredEvidence: requiredEvidenceFor(changeClass),
        createdBy: principal.id,
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        occurredAt: now.toISOString(),
      });
      const pendingApproval = await markSubmitted(client, approval.id, {
        expiresAt: expiresAt.toISOString(),
        requiredEvidence: requiredEvidenceFor(changeClass),
        occurredAt: now.toISOString(),
      });
      const policyInput = buildPendingPolicyInput({
        approval: pendingApproval,
        evidenceRows: [],
        nowEpochMs: now.getTime(),
      });
      const policyResult = await policyEvaluator.evaluate(policyInput);
      await appendSignedEvent(client, {
        approval: pendingApproval,
        eventId: uuidFactory(),
        eventType: "autonomous_requested",
        principal,
        actor,
        reason: "bounded autonomous approval requested",
        policyInput,
        policyResult,
        resultingState: "pending",
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        operationSha256: expectedOperationSha256,
        occurredAt: now.toISOString(),
      });
      return approvalView(client, approval.approval_id);
    });
  }

  async function submit({
    approvalId,
    actor: actorInput,
    input,
    idempotencyKey,
    traceId,
  }) {
    const parsedApprovalId = parse(UlidSchema, approvalId);
    const parsed = parse(SubmitApprovalSchema, input);
    const parsedIdempotencyKey = parse(IdempotencyKeySchema, idempotencyKey);
    const parsedTraceId = parse(TraceIdSchema, traceId);
    const expectedOperationSha256 = operationHash("submit", {
      approvalId: parsedApprovalId,
      ...parsed,
    });

    return database.tx(async (client) => {
      const { actor, principal, replayApprovalId } = await beginOperation(
        client,
        actorInput,
        parsedIdempotencyKey,
        expectedOperationSha256,
      );
      if (replayApprovalId) return approvalView(client, replayApprovalId);
      requireRole(principal, ["founder"], "submit approval drafts");

      const approval = await requireApproval(client, parsedApprovalId, { forUpdate: true });
      assertActivePolicy(approval, policyEvaluator);
      if (approval.state !== "draft") {
        throw new ConflictError("only draft approvals can be submitted", {
          approvalId: parsedApprovalId,
          state: approval.state,
        });
      }
      const now = asDate(clock);
      const expiresAt = new Date(now.getTime() + APPROVAL_LIFETIME_MS);
      const pendingApproval = {
        ...approval,
        state: "pending",
        expires_at: expiresAt,
      };
      const policyInput = buildPolicyInput({
        approval: pendingApproval,
        evidenceRows: [],
        nowEpochMs: now.getTime(),
      });
      const policyResult = await policyEvaluator.evaluate(policyInput);
      await markSubmitted(client, approval.id, {
        expiresAt: expiresAt.toISOString(),
        requiredEvidence: policyResult.missingEvidence,
        occurredAt: now.toISOString(),
      });
      await appendSignedEvent(client, {
        approval,
        eventId: uuidFactory(),
        eventType: "submitted",
        principal,
        actor,
        reason: parsed.reason,
        policyInput,
        policyResult,
        resultingState: "pending",
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        operationSha256: expectedOperationSha256,
        occurredAt: now.toISOString(),
      });
      return approvalView(client, parsedApprovalId);
    });
  }

  async function decide({
    approvalId,
    actor: actorInput,
    input,
    idempotencyKey,
    traceId,
  }) {
    const parsedApprovalId = parse(UlidSchema, approvalId);
    const parsed = parse(DecisionEvidenceSchema, input);
    const parsedIdempotencyKey = parse(IdempotencyKeySchema, idempotencyKey);
    const parsedTraceId = parse(TraceIdSchema, traceId);
    const expectedOperationSha256 = operationHash("decision", {
      approvalId: parsedApprovalId,
      ...parsed,
    });

    return database.tx(async (client) => {
      const { actor, principal, replayApprovalId } = await beginOperation(
        client,
        actorInput,
        parsedIdempotencyKey,
        expectedOperationSha256,
      );
      if (replayApprovalId) return approvalView(client, replayApprovalId);
      if (!["human", "external_reviewer"].includes(principal.principal_type)) {
        throw new ForbiddenError("service credentials cannot issue human decisions");
      }

      const approval = await requireApproval(client, parsedApprovalId, { forUpdate: true });
      assertActivePolicy(approval, policyEvaluator);
      assertPending(approval);
      const now = asDate(clock);
      const expired = await expireIfElapsed(client, {
        approval,
        actor,
        principal,
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        operationSha256: expectedOperationSha256,
        now,
      });
      if (expired) return expired;

      let evidenceClass;
      if (principal.principal_role === "founder") {
        evidenceClass = "founder_decision";
      } else if (approval.change_class === "approval_system") {
        evidenceClass = "external_security_review";
      } else if (approval.change_class === "patent_locked") {
        evidenceClass = "external_human_review";
      } else {
        throw new ForbiddenError("external reviewer is not required for this change class", {
          changeClass: approval.change_class,
        });
      }
      assertEvidenceAllowed(principal, evidenceClass);

      const detail = {
        evidenceClass,
        decision: parsed.decision,
        reason: parsed.reason,
        resolvesEscalation: parsed.resolvesEscalation,
      };
      const envelope = buildEvidenceEnvelope({
        approvalId: parsedApprovalId,
        action: parsed.decision,
        payloadSha256: approval.payload_sha256,
        diffSha256: approval.diff_sha256,
        policySha256: approval.policy_sha256,
        nonce: parsed.nonce,
        evidenceExpiresAt: parsed.evidenceExpiresAt,
        detail,
      });
      const { key, verification } = verifyPrincipalEvidence({
        principal,
        envelope,
        signature: parsed.signature,
        now: now.getTime(),
      });
      const eventId = uuidFactory();
      const evidenceRows = await loadEvidence(client, approval.id);
      const policyInput = buildPendingPolicyInput({
        approval,
        evidenceRows,
        nowEpochMs: now.getTime(),
        extraEvidence: [policyEvidence({
          eventId,
          principal,
          evidenceClass,
          decision: parsed.decision,
          detail,
          approval,
        })],
      });
      const policyResult = await policyEvaluator.evaluate(policyInput);
      const resultingState = parsed.decision === "reject"
        ? "rejected"
        : policyResult.allow ? "approved" : "pending";
      await updateDecisionState(client, approval.id, {
        state: resultingState,
        requiredEvidence: policyResult.missingEvidence,
        occurredAt: now.toISOString(),
      });
      await appendSignedEvent(client, {
        approval,
        eventId,
        eventType: "decision",
        principal,
        actor,
        key,
        evidenceClass,
        decision: parsed.decision,
        reason: parsed.reason,
        nonce: parsed.nonce,
        evidenceExpiresAt: parsed.evidenceExpiresAt,
        evidenceEnvelope: envelope,
        evidenceSha256: verification.envelopeSha256,
        evidenceSignature: parsed.signature,
        policyInput,
        policyResult,
        resultingState,
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        operationSha256: expectedOperationSha256,
        occurredAt: now.toISOString(),
      });
      return approvalView(client, parsedApprovalId);
    });
  }

  async function attest({
    approvalId,
    actor: actorInput,
    input,
    idempotencyKey,
    traceId,
  }) {
    const parsedApprovalId = parse(UlidSchema, approvalId);
    const parsed = parse(AttestationEvidenceSchema, input);
    const parsedIdempotencyKey = parse(IdempotencyKeySchema, idempotencyKey);
    const parsedTraceId = parse(TraceIdSchema, traceId);
    const expectedOperationSha256 = operationHash("attest", {
      approvalId: parsedApprovalId,
      ...parsed,
    });

    return database.tx(async (client) => {
      const { actor, principal, replayApprovalId } = await beginOperation(
        client,
        actorInput,
        parsedIdempotencyKey,
        expectedOperationSha256,
      );
      if (replayApprovalId) return approvalView(client, replayApprovalId);
      if (principal.principal_type !== "service") {
        throw new ForbiddenError("human credentials cannot issue service attestations");
      }

      const approval = await requireApproval(client, parsedApprovalId, { forUpdate: true });
      assertActivePolicy(approval, policyEvaluator);
      assertPending(approval);
      const now = asDate(clock);
      const expired = await expireIfElapsed(client, {
        approval,
        actor,
        principal,
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        operationSha256: expectedOperationSha256,
        now,
      });
      if (expired) return expired;

      let evidenceClass;
      if (principal.principal_role === "arbiter") {
        evidenceClass = "arbiter_attestation";
        if (!approval.patent_locked) {
          throw new ForbiddenError("ARBITER attestations are limited to patent-locked approvals");
        }
        if (
          parsed.verdict !== "BLOCK"
          && parsed.patentClaims.length === 0
        ) {
          throw new ValidationError("ARBITER ALLOW and ESCALATE require explicit patent claims");
        }
      } else if (principal.principal_role === "renovate") {
        evidenceClass = "renovate_attestation";
        if (approval.change_class !== "renovate_patch") {
          throw new ForbiddenError("Renovate attestations are limited to classified patch updates");
        }
        if (parsed.patentClaims.length !== 0) {
          throw new ValidationError("Renovate attestations cannot claim patent review");
        }
      } else if (principal.principal_role === "automation_guard") {
        evidenceClass = "automation_attestation";
        if (approval.change_class !== "autonomous_operation") {
          throw new ForbiddenError(
            "automation guard attestations are limited to autonomous approvals",
          );
        }
        if (principal.id === approval.created_by) {
          throw new ForbiddenError("an autonomous requester cannot attest its own request");
        }
        if (parsed.patentClaims.length !== 0) {
          throw new ValidationError("automation guard attestations cannot claim patent review");
        }
      } else {
        throw new ForbiddenError("service principal cannot issue approval attestations", {
          principalRole: principal.principal_role,
        });
      }
      assertEvidenceAllowed(principal, evidenceClass);
      if (!sameStringSet(parsed.reviewedPaths, approval.zone_paths)) {
        throw new ValidationError("attestation reviewed paths must exactly match the approval zone paths");
      }

      const detail = {
        evidenceClass,
        verdict: parsed.verdict,
        patentClaims: [...new Set(parsed.patentClaims)].sort(),
        reviewedPaths: [...new Set(parsed.reviewedPaths.map(normalizeZonePath))].sort(),
        rationaleSha256: parsed.rationaleSha256,
        resolvesEscalation: false,
      };
      const envelope = buildEvidenceEnvelope({
        approvalId: parsedApprovalId,
        action: `attest:${parsed.verdict}`,
        payloadSha256: approval.payload_sha256,
        diffSha256: approval.diff_sha256,
        policySha256: approval.policy_sha256,
        nonce: parsed.nonce,
        evidenceExpiresAt: parsed.evidenceExpiresAt,
        detail,
      });
      const { key, verification } = verifyPrincipalEvidence({
        principal,
        envelope,
        signature: parsed.signature,
        now: now.getTime(),
      });
      const eventId = uuidFactory();
      const evidenceRows = await loadEvidence(client, approval.id);
      const policyInput = buildPendingPolicyInput({
        approval,
        evidenceRows,
        nowEpochMs: now.getTime(),
        extraEvidence: [policyEvidence({
          eventId,
          principal,
          evidenceClass,
          verdict: parsed.verdict,
          detail,
          approval,
        })],
      });
      const policyResult = await policyEvaluator.evaluate(policyInput);
      const resultingState = parsed.verdict === "BLOCK"
        ? "rejected"
        : policyResult.allow ? "approved" : "pending";
      await updateDecisionState(client, approval.id, {
        state: resultingState,
        requiredEvidence: policyResult.missingEvidence,
        occurredAt: now.toISOString(),
      });
      await appendSignedEvent(client, {
        approval,
        eventId,
        eventType: "attestation",
        principal,
        actor,
        key,
        evidenceClass,
        verdict: parsed.verdict,
        reason: `attestation rationale ${parsed.rationaleSha256}`,
        nonce: parsed.nonce,
        evidenceExpiresAt: parsed.evidenceExpiresAt,
        evidenceEnvelope: envelope,
        evidenceSha256: verification.envelopeSha256,
        evidenceSignature: parsed.signature,
        policyInput,
        policyResult,
        resultingState,
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        operationSha256: expectedOperationSha256,
        occurredAt: now.toISOString(),
      });
      return approvalView(client, parsedApprovalId);
    });
  }

  async function supersede({
    approvalId,
    actor: actorInput,
    input,
    idempotencyKey,
    traceId,
  }) {
    const parsedApprovalId = parse(UlidSchema, approvalId);
    const parsed = parse(SupersedeApprovalSchema, input);
    const parsedIdempotencyKey = parse(IdempotencyKeySchema, idempotencyKey);
    const parsedTraceId = parse(TraceIdSchema, traceId);
    const expectedOperationSha256 = operationHash("supersede", {
      approvalId: parsedApprovalId,
      ...parsed,
    });

    return database.tx(async (client) => {
      const { actor, principal, replayApprovalId } = await beginOperation(
        client,
        actorInput,
        parsedIdempotencyKey,
        expectedOperationSha256,
      );
      if (replayApprovalId) return approvalView(client, replayApprovalId);
      requireRole(principal, ["founder"], "supersede approvals");
      assertEvidenceAllowed(principal, "founder_decision");

      const approval = await requireApproval(client, parsedApprovalId, { forUpdate: true });
      assertActivePolicy(approval, policyEvaluator);
      if (!["draft", "pending", "approved"].includes(approval.state)) {
        throw new ConflictError("approval state cannot be superseded", {
          state: approval.state,
        });
      }
      const replacement = await requireApproval(client, parsed.replacementApprovalId, {
        forUpdate: true,
      });
      assertActivePolicy(replacement, policyEvaluator);
      if (replacement.id === approval.id) {
        throw new ValidationError("an approval cannot supersede itself");
      }
      if (replacement.hcp_identifier !== approval.hcp_identifier) {
        throw new ValidationError("superseding approval must use the same HCP identifier");
      }

      const now = asDate(clock);
      const detail = {
        evidenceClass: "founder_decision",
        replacementApprovalId: parsed.replacementApprovalId,
        reason: parsed.reason,
      };
      const envelope = buildEvidenceEnvelope({
        approvalId: parsedApprovalId,
        action: "supersede",
        payloadSha256: approval.payload_sha256,
        diffSha256: approval.diff_sha256,
        policySha256: approval.policy_sha256,
        nonce: parsed.nonce,
        evidenceExpiresAt: parsed.evidenceExpiresAt,
        detail,
      });
      const { key, verification } = verifyPrincipalEvidence({
        principal,
        envelope,
        signature: parsed.signature,
        now: now.getTime(),
      });
      const evidenceRows = await loadEvidence(client, approval.id);
      const policyInput = buildPolicyInput({
        approval,
        evidenceRows,
        nowEpochMs: now.getTime(),
      });
      const policyResult = await policyEvaluator.evaluate(policyInput);
      await markSuperseded(client, approval.id, {
        replacementInternalId: replacement.id,
        occurredAt: now.toISOString(),
      });
      await appendSignedEvent(client, {
        approval,
        eventId: uuidFactory(),
        eventType: "superseded",
        principal,
        actor,
        key,
        evidenceClass: "founder_decision",
        reason: parsed.reason,
        nonce: parsed.nonce,
        evidenceExpiresAt: parsed.evidenceExpiresAt,
        evidenceEnvelope: envelope,
        evidenceSha256: verification.envelopeSha256,
        evidenceSignature: parsed.signature,
        policyInput,
        policyResult,
        resultingState: "superseded",
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        operationSha256: expectedOperationSha256,
        occurredAt: now.toISOString(),
      });
      return approvalView(client, parsedApprovalId);
    });
  }

  async function verify({
    approvalId,
    actor: actorInput,
    input,
    idempotencyKey,
    traceId,
  }) {
    const parsedApprovalId = parse(UlidSchema, approvalId);
    const parsed = parse(VerifyApprovalSchema, input);
    const parsedIdempotencyKey = parse(IdempotencyKeySchema, idempotencyKey);
    const parsedTraceId = parse(TraceIdSchema, traceId);
    const expectedOperationSha256 = operationHash("verify", {
      approvalId: parsedApprovalId,
      ...parsed,
    });

    return database.tx(async (client) => {
      const { actor, principal, replayApprovalId } = await beginOperation(
        client,
        actorInput,
        parsedIdempotencyKey,
        expectedOperationSha256,
      );
      if (replayApprovalId) return approvalView(client, replayApprovalId);

      const approval = await requireApproval(client, parsedApprovalId, { forUpdate: true });
      assertActivePolicy(approval, policyEvaluator);
      const beforeEvents = await loadEvents(client, approval.id);
      const beforeReceipts = await loadReceipts(client, approval.id);
      const beforeReplay = await replayApprovalHistory({
        approval,
        events: beforeEvents,
        receipts: beforeReceipts,
        policyEvaluator,
      });
      if (!beforeReplay.valid) {
        throw new ConflictError("approval audit replay failed", {
          approvalId: parsedApprovalId,
          errors: beforeReplay.errors,
        });
      }

      const now = asDate(clock);
      const evidenceRows = await loadEvidence(client, approval.id);
      const policyInput = buildPolicyInput({
        approval,
        evidenceRows,
        nowEpochMs: now.getTime(),
        state: approval.state === "approved" ? "pending" : approval.state,
      });
      const policyResult = await policyEvaluator.evaluate(policyInput);
      await appendSignedEvent(client, {
        approval,
        eventId: uuidFactory(),
        eventType: "verified",
        principal,
        actor,
        reason: parsed.reason ?? "authenticated audit replay",
        policyInput,
        policyResult,
        resultingState: approval.state,
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        operationSha256: expectedOperationSha256,
        occurredAt: now.toISOString(),
      });

      const events = await loadEvents(client, approval.id);
      const receipts = await loadReceipts(client, approval.id);
      const replay = await replayApprovalHistory({
        approval,
        events,
        receipts,
        policyEvaluator,
      });
      if (!replay.valid) {
        throw new HeadyError("new approval audit replay failed", {
          code: "AUDIT_REPLAY_FAILED",
          status: 500,
          context: { errors: replay.errors },
        });
      }
      await insertAuditReplay(client, {
        approvalInternalId: approval.id,
        throughSequence: replay.throughSequence,
        valid: replay.valid,
        chainHeadSha256: replay.chainHeadSha256,
        policySha256: replay.policySha256,
        receiptCount: replay.receiptCount,
        verificationSummary: replay,
        verifierPrincipalId: principal.id,
        traceId: parsedTraceId,
        occurredAt: now.toISOString(),
      });
      return {
        ...(await approvalView(client, parsedApprovalId)),
        auditReplay: replay,
      };
    });
  }

  async function get({ approvalId, actor: actorInput }) {
    const parsedApprovalId = parse(UlidSchema, approvalId);
    await requirePrincipal(database, actorInput);
    return approvalView(database, parsedApprovalId);
  }

  async function getAutonomous({ approvalId, actor: actorInput }) {
    const parsedApprovalId = parse(UlidSchema, approvalId);
    const { principal } = await requirePrincipal(database, actorInput);
    requireRole(
      principal,
      ["automation_requester", "automation_guard"],
      "read autonomous approvals",
    );
    const approval = await requireApproval(database, parsedApprovalId);
    if (approval.change_class !== "autonomous_operation") {
      throw new ForbiddenError("workload reads are limited to autonomous approvals");
    }
    return approvalView(database, parsedApprovalId);
  }

  async function receipts({ approvalId, actor: actorInput }) {
    const parsedApprovalId = parse(UlidSchema, approvalId);
    await requirePrincipal(database, actorInput);
    const approval = await requireApproval(database, parsedApprovalId);
    return {
      approvalId: parsedApprovalId,
      receipts: publicReceipts(await loadReceipts(database, approval.id)),
    };
  }

  async function deploymentProtection({ actor: actorInput, input }) {
    const parsed = parse(DeploymentProtectionSchema, input);
    return database.tx(async (client) => {
      const { principal } = await requirePrincipal(client, actorInput);
      requireRole(principal, ["deployment_guard"], "evaluate deployment protection");
      const approval = await requireApproval(client, parsed.approvalId, { forUpdate: true });
      const reasons = [];
      const now = asDate(clock);
      if (approval.state !== "approved") reasons.push("approval_not_approved");
      if (!approval.expires_at || new Date(approval.expires_at).getTime() <= now.getTime()) {
        reasons.push("approval_expired");
      }
      if (!safeHashEqual(approval.diff_sha256, parsed.diffSha256)) {
        reasons.push("diff_hash_mismatch");
      }
      if (!safeHashEqual(approval.policy_sha256, parsed.policySha256)) {
        reasons.push("policy_hash_mismatch");
      }
      if (!approval.artifact_digest || approval.artifact_digest !== parsed.artifactDigest) {
        reasons.push("artifact_digest_mismatch");
      }
      if (!safeHashEqual(policyEvaluator.sourceSha256, parsed.policySha256)) {
        reasons.push("active_policy_drift");
      }

      const evidenceRows = await loadEvidence(client, approval.id);
      const policyInput = buildPendingPolicyInput({
        approval,
        evidenceRows,
        nowEpochMs: now.getTime(),
      });
      const policyResult = await policyEvaluator.evaluate(policyInput);
      if (!policyResult.allow) reasons.push(...policyResult.reasons, ...policyResult.missingEvidence);

      const replay = await replayApprovalHistory({
        approval,
        events: await loadEvents(client, approval.id),
        receipts: await loadReceipts(client, approval.id),
        policyEvaluator,
      });
      if (!replay.valid) reasons.push("audit_replay_failed");
      return {
        approvalId: parsed.approvalId,
        allow: reasons.length === 0,
        reasons: [...new Set(reasons)].sort(),
        policyResult,
        auditReplay: replay,
      };
    });
  }

  async function autonomousProtection({
    actor: actorInput,
    input,
    idempotencyKey,
    traceId,
  }) {
    const parsed = parse(AutonomousProtectionSchema, input);
    const parsedIdempotencyKey = parse(IdempotencyKeySchema, idempotencyKey);
    const parsedTraceId = parse(TraceIdSchema, traceId);
    const expectedOperationSha256 = operationHash("authorize_autonomous", parsed);

    return database.tx(async (client) => {
      const { actor, principal, replayApprovalId } = await beginOperation(
        client,
        actorInput,
        parsedIdempotencyKey,
        expectedOperationSha256,
      );
      if (replayApprovalId) {
        const replayApproval = await requireApproval(client, replayApprovalId);
        const replayClaim = await findAutonomousGrantClaim(client, replayApproval.id);
        if (!replayClaim) {
          throw new ConflictError("autonomous authorization replay is missing its grant claim");
        }
        return autonomousGrantView(client, replayApproval, replayClaim);
      }
      requireRole(principal, ["automation_requester"], "consume autonomous approval");
      await lockAutonomousExecutionNonce(client, parsed.executionNonce);
      const nonceClaim = await findAutonomousGrantClaimByNonce(
        client,
        parsed.executionNonce,
      );

      const approval = await requireApproval(client, parsed.approvalId, { forUpdate: true });
      const reasons = [];
      const now = asDate(clock);
      if (approval.state !== "approved") reasons.push("approval_not_approved");
      if (approval.change_class !== "autonomous_operation") {
        reasons.push("not_autonomous_operation");
      }
      if (approval.created_by !== principal.id) reasons.push("requester_mismatch");
      if (!approval.expires_at || new Date(approval.expires_at).getTime() <= now.getTime()) {
        reasons.push("approval_expired");
      }
      if (!safeHashEqual(approval.payload_sha256, parsed.payloadSha256)) {
        reasons.push("payload_hash_mismatch");
      }
      if (!safeHashEqual(approval.diff_sha256, parsed.diffSha256)) {
        reasons.push("diff_hash_mismatch");
      }
      if (!safeHashEqual(approval.policy_sha256, parsed.policySha256)) {
        reasons.push("policy_hash_mismatch");
      }
      if (!safeHashEqual(policyEvaluator.sourceSha256, parsed.policySha256)) {
        reasons.push("active_policy_drift");
      }
      if (approval.canonical_payload.capability !== parsed.capability) {
        reasons.push("capability_mismatch");
      }
      if (!safeHashEqual(approval.canonical_payload.subjectSha256, parsed.subjectSha256)) {
        reasons.push("subject_hash_mismatch");
      }
      if (await findAutonomousGrantClaim(client, approval.id)) {
        reasons.push("grant_already_consumed");
      }
      if (nonceClaim) reasons.push("execution_nonce_reused");

      const evidenceRows = await loadEvidence(client, approval.id);
      const policyInput = buildPendingPolicyInput({
        approval,
        evidenceRows,
        nowEpochMs: now.getTime(),
      });
      const policyResult = await policyEvaluator.evaluate(policyInput);
      if (!policyResult.allow) reasons.push(...policyResult.reasons, ...policyResult.missingEvidence);
      const replay = await replayApprovalHistory({
        approval,
        events: await loadEvents(client, approval.id),
        receipts: await loadReceipts(client, approval.id),
        policyEvaluator,
      });
      if (!replay.valid) reasons.push("audit_replay_failed");
      if (reasons.length > 0) {
        return {
          approvalId: parsed.approvalId,
          allow: false,
          reasons: [...new Set(reasons)].sort(),
          policyResult,
          auditReplay: replay,
        };
      }

      const authorizationEventId = uuidFactory();
      await appendSignedEvent(client, {
        approval,
        eventId: authorizationEventId,
        eventType: "authorized",
        principal,
        actor,
        reason: `one-time ${parsed.capability} authorization consumed`,
        policyInput,
        policyResult,
        resultingState: "approved",
        traceId: parsedTraceId,
        idempotencyKey: parsedIdempotencyKey,
        operationSha256: expectedOperationSha256,
        occurredAt: now.toISOString(),
      });
      const claim = await insertAutonomousGrantClaim(client, {
        approvalInternalId: approval.id,
        authorizationEventId,
        requesterPrincipalId: principal.id,
        executionNonce: parsed.executionNonce,
        capability: parsed.capability,
        subjectSha256: parsed.subjectSha256,
        payloadSha256: parsed.payloadSha256,
        diffSha256: parsed.diffSha256,
        policySha256: parsed.policySha256,
        operationSha256: expectedOperationSha256,
        approvalExpiresAt: new Date(approval.expires_at).toISOString(),
        claimedAt: now.toISOString(),
      });
      return autonomousGrantView(client, approval, claim);
    });
  }

  async function autonomousGrantView(client, approval, claim) {
    const events = await loadEvents(client, approval.id);
    const receipts = await loadReceipts(client, approval.id);
    const event = events.find((candidate) => candidate.id === claim.authorization_event_id);
    const receipt = receipts.find((candidate) => candidate.event_id === claim.authorization_event_id);
    if (!event || !receipt) {
      throw new HeadyError("autonomous grant is missing signed authorization material", {
        code: "AUTONOMOUS_GRANT_INCOMPLETE",
        status: 500,
      });
    }
    const result = {
      approvalId: approval.approval_id,
      allow: true,
      reasons: [],
      grant: {
        schema: "heady.autonomous.grant.v1",
        capability: claim.capability,
        subjectSha256: claim.subject_sha256,
        payloadSha256: claim.payload_sha256,
        diffSha256: claim.diff_sha256,
        policySha256: claim.policy_sha256,
        operationSha256: claim.operation_sha256,
        executionNonce: claim.execution_nonce,
        expiresAt: new Date(claim.approval_expires_at).toISOString(),
        authorizationEvent: eventPayloadFromRow({
          ...event,
          external_approval_id: approval.approval_id,
        }),
        authorizationReceipt: publicReceipts([receipt])[0],
      },
    };
    if (!verifyAutonomousGrant(result.grant, {
      now: new Date(claim.claimed_at).getTime(),
      trustedSigner: {
        signingKeyId: receipt.signing_key_id,
        publicJwk: receipt.registered_public_jwk,
      },
    })) {
      throw new HeadyError("autonomous grant failed local signature verification", {
        code: "AUTONOMOUS_GRANT_VERIFICATION",
        status: 500,
      });
    }
    return result;
  }

  return Object.freeze({
    create,
    requestAutonomous,
    submit,
    decide,
    attest,
    supersede,
    verify,
    get,
    getAutonomous,
    receipts,
    deploymentProtection,
    autonomousProtection,
  });
}
