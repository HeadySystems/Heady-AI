// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Core Tests v1.0.0                              ║
// ║  Canonical hashes, state guards, schemas, ULIDs, and ceremonies.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { test } from "node:test";
import {
  buildEvidenceEnvelope,
  buildReceiptPayload,
  canTransition,
  canonicalize,
  classifyChange,
  createUlid,
  CreateApprovalSchema,
  AutonomousApprovalRequestSchema,
  AUTONOMOUS_MAX_AFFECTED_RESOURCES,
  EVIDENCE_CEREMONY_MAX_MS,
  publicJwkFingerprint,
  safeHashEqual,
  sha256,
  verifyEvidenceCeremony,
  verifyAutonomousGrant,
  verifyReceipt,
} from "../src/index.mjs";

function signingKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey,
    publicJwk: publicKey.export({ format: "jwk" }),
  };
}

test("canonical JSON is key-order independent and rejects ambiguous values", () => {
  assert.equal(canonicalize({ beta: 2, alpha: 1 }), '{"alpha":1,"beta":2}');
  assert.equal(sha256({ alpha: 1, beta: 2 }), sha256({ beta: 2, alpha: 1 }));
  assert.throws(() => canonicalize({ invalid: undefined }), /undefined/);
  assert.throws(() => canonicalize(new Date()), /plain object/);
  assert.equal(safeHashEqual("abc", "abc"), true);
  assert.equal(safeHashEqual("abc", "abd"), false);
  const { publicJwk } = signingKey();
  assert.throws(
    () => publicJwkFingerprint({ ...publicJwk, d: "private-material" }),
    /public JWK/,
  );
});

test("change classification gives approval and patent zones precedence over automation", () => {
  assert.equal(classifyChange({
    subjectType: "dependency_update",
    patentLocked: false,
    zonePaths: ["packages/example/package.json"],
    renovatePatchOnly: true,
  }), "renovate_patch");
  assert.equal(classifyChange({
    subjectType: "dependency_update",
    patentLocked: false,
    zonePaths: ["packages/approvals/package.json"],
    renovatePatchOnly: true,
  }), "approval_system");
  assert.equal(classifyChange({
    subjectType: "change",
    patentLocked: true,
    zonePaths: ["packages/example/index.mjs"],
  }), "patent_locked");
  assert.equal(classifyChange({
    subjectType: "change",
    patentLocked: false,
    zonePaths: ["packages/approvals"],
  }), "approval_system");
  assert.equal(classifyChange({
    subjectType: "change",
    patentLocked: false,
    zonePaths: ["packages/bees"],
  }), "patent_locked");
  assert.equal(classifyChange({
    subjectType: "change",
    patentLocked: false,
    zonePaths: ["packages/db/migrations/0004_approval_control_plane.sql"],
  }), "approval_system");
});

test("every migration that touches the approval schema classifies as approval_system", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const migrationsDir = fileURLToPath(new URL("../../db/migrations/", import.meta.url));
  const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));

  // Classification is name-based because it must stay a pure sync function.
  // This walks the actual file bodies, so a migration that touches
  // heady_approval.* under a name the predicate cannot see is a FINDING —
  // either rename it or add it to APPROVAL_SYSTEM_PREFIXES.
  const touchesApprovalSchema = migrations
    .filter((name) => readFileSync(join(migrationsDir, name), "utf8").includes("heady_approval."));

  // 0004 (control plane) and 0010 (autonomous grants + insert guards) at minimum.
  assert.ok(touchesApprovalSchema.length >= 2);
  for (const name of touchesApprovalSchema) {
    assert.equal(classifyChange({
      subjectType: "change",
      patentLocked: false,
      zonePaths: [`packages/db/migrations/${name}`],
    }), "approval_system", `${name} touches heady_approval.* but is not approval_system scope`);
  }
});

test("state machine only permits the accepted directed transitions", () => {
  assert.equal(canTransition("draft", "pending"), true);
  assert.equal(canTransition("pending", "approved"), true);
  assert.equal(canTransition("approved", "superseded"), true);
  assert.equal(canTransition("approved", "pending"), false);
  assert.equal(canTransition("rejected", "approved"), false);
});

test("create schema is strict and validates exact digest and repository path shapes", () => {
  const valid = {
    hcpIdentifier: "HCP-0031",
    title: "Approval service bootstrap",
    subjectType: "change",
    patentLocked: false,
    zonePaths: ["packages/example/index.mjs"],
    payload: { version: 1 },
    diffSha256: "a".repeat(64),
  };
  assert.equal(CreateApprovalSchema.parse(valid).renovatePatchOnly, false);
  assert.throws(() => CreateApprovalSchema.parse({ ...valid, extra: true }));
  assert.throws(() => CreateApprovalSchema.parse({
    ...valid,
    zonePaths: ["../escape"],
  }));
  assert.throws(() => CreateApprovalSchema.parse({
    ...valid,
    subjectType: "deployment",
  }));
  assert.throws(() => CreateApprovalSchema.parse({
    ...valid,
    artifactDigest: "approval-api:latest",
  }));
});

test("autonomous request schema permits only bounded reversible low-risk work", () => {
  const valid = {
    hcpIdentifier: "HCP-0033",
    title: "Sign an autonomous source-authorship operation",
    capability: "source_authorship",
    zonePaths: ["packages/example/src/index.mjs"],
    resourceScopes: ["repo:Heady-AI/packages/example"],
    subjectSha256: "1".repeat(64),
    diffSha256: "2".repeat(64),
    rollbackPlanSha256: "3".repeat(64),
    riskTier: "low",
    reversible: true,
    dryRunVerified: true,
    networkAccess: "none",
    maxAffectedResources: 1,
    maxDurationMs: 1_000,
  };
  assert.equal(AutonomousApprovalRequestSchema.parse(valid).reversible, true);
  assert.equal(AUTONOMOUS_MAX_AFFECTED_RESOURCES, 34);
  const ceilingScopes = Array.from(
    { length: AUTONOMOUS_MAX_AFFECTED_RESOURCES },
    (_, index) => `provider:catalog-${index + 1}`,
  );
  assert.equal(AutonomousApprovalRequestSchema.parse({
    ...valid,
    resourceScopes: ceilingScopes,
    maxAffectedResources: AUTONOMOUS_MAX_AFFECTED_RESOURCES,
  }).resourceScopes.length, AUTONOMOUS_MAX_AFFECTED_RESOURCES);
  assert.throws(() => AutonomousApprovalRequestSchema.parse({
    ...valid,
    resourceScopes: [...ceilingScopes, "provider:catalog-overflow"],
    maxAffectedResources: AUTONOMOUS_MAX_AFFECTED_RESOURCES,
  }));
  assert.throws(() => AutonomousApprovalRequestSchema.parse({ ...valid, reversible: false }));
  assert.throws(() => AutonomousApprovalRequestSchema.parse({
    ...valid,
    resourceScopes: ["https://untrusted.example/path"],
  }));
  assert.throws(() => CreateApprovalSchema.parse({
    hcpIdentifier: "HCP-0033",
    title: "bypass dedicated route",
    subjectType: "autonomous_process",
    patentLocked: false,
    zonePaths: valid.zonePaths,
    payload: {},
    diffSha256: valid.diffSha256,
  }));
});

test("evidence ceremonies bind every approval hash and reject expiry or tampering", () => {
  const { privateKey, publicJwk } = signingKey();
  const now = Date.parse("2026-07-24T12:00:00.000Z");
  const envelope = buildEvidenceEnvelope({
    approvalId: "01K10000000000000000000000",
    action: "approve",
    payloadSha256: "1".repeat(64),
    diffSha256: "2".repeat(64),
    policySha256: "3".repeat(64),
    nonce: "nonce-for-explicit-approval",
    evidenceExpiresAt: new Date(now + EVIDENCE_CEREMONY_MAX_MS - 1).toISOString(),
    detail: { decision: "approve" },
  });
  const signature = sign(null, Buffer.from(canonicalize(envelope)), privateKey).toString("base64url");
  const verified = verifyEvidenceCeremony({ publicJwk, envelope, signature, now });
  assert.equal(verified.keyFingerprint, publicJwkFingerprint(publicJwk));
  assert.throws(() => verifyEvidenceCeremony({
    publicJwk,
    envelope: { ...envelope, diffSha256: "4".repeat(64) },
    signature,
    now,
  }), /verification failed/);
  assert.throws(() => verifyEvidenceCeremony({
    publicJwk,
    envelope,
    signature,
    now: Date.parse(envelope.evidenceExpiresAt),
  }), /expired/);
});

test("receipt verification detects payload and signature tampering", () => {
  const { privateKey, publicJwk } = signingKey();
  const payload = buildReceiptPayload({
    receiptId: "01K10000000000000000000000",
    approvalId: "01K10000000000000000000001",
    eventId: "ec9eb2d8-2412-4e16-8956-6e4ccdc863f2",
    sequence: 1,
    eventSha256: "1".repeat(64),
    previousEventSha256: null,
    payloadSha256: "2".repeat(64),
    diffSha256: "3".repeat(64),
    policySha256: "4".repeat(64),
    state: "draft",
    issuedAt: "2026-07-24T12:00:00.000Z",
  });
  const payloadSha256 = sha256(payload);
  const signature = sign(null, Buffer.from(canonicalize(payload)), privateKey).toString("base64url");
  assert.equal(verifyReceipt({ payload, payloadSha256, signature, publicJwk }), true);
  assert.equal(verifyReceipt({
    payload: { ...payload, state: "approved" },
    payloadSha256,
    signature,
    publicJwk,
  }), false);
  assert.equal(verifyReceipt({
    payload,
    payloadSha256,
    signature: "not_base64url!",
    publicJwk,
  }), false);
});

test("autonomous grant verification binds operation, policy, event, and KMS receipt", () => {
  const { privateKey, publicJwk } = signingKey();
  const issuedAt = "2026-07-24T12:00:00.000Z";
  const expiresAt = "2026-07-24T12:21:00.000Z";
  const approvalId = "01K10000000000000000000000";
  const hashes = {
    subjectSha256: "1".repeat(64),
    payloadSha256: "2".repeat(64),
    diffSha256: "3".repeat(64),
    policySha256: "4".repeat(64),
  };
  const executionNonce = "one-time-execution-nonce";
  const operationSha256 = sha256({
    action: "authorize_autonomous",
    value: {
      approvalId,
      capability: "source_authorship",
      ...hashes,
      executionNonce,
    },
  });
  const authorizationEvent = {
    schema: "heady.approval.event.v1",
    eventId: "ec9eb2d8-2412-4e16-8956-6e4ccdc863f2",
    approvalId,
    sequence: 3,
    eventType: "authorized",
    actorPrincipalId: "automation-requester",
    actorKeyId: null,
    evidenceClass: null,
    decision: null,
    verdict: null,
    reason: "one-time source_authorship authorization consumed",
    nonce: null,
    evidenceExpiresAt: null,
    evidenceEnvelope: null,
    evidenceSha256: null,
    evidenceSignature: null,
    actorSnapshot: {
      principalId: "automation-requester",
      principalType: "service",
      principalRole: "automation_requester",
    },
    policyInput: {
      state: "pending",
      changeClass: "autonomous_operation",
      subjectType: "autonomous_process",
      creatorPrincipalId: "automation-requester",
      payloadSha256: hashes.payloadSha256,
      diffSha256: hashes.diffSha256,
      policySha256: hashes.policySha256,
      expiresAtEpochMs: Date.parse(expiresAt),
      nowEpochMs: Date.parse(issuedAt),
      autonomous: {
        capability: "source_authorship",
        subjectSha256: hashes.subjectSha256,
      },
    },
    policyResult: { allow: true },
    resultingState: "approved",
    previousEventSha256: "5".repeat(64),
    traceId: "autonomous-grant-test",
    idempotencyKey: "autonomous-grant-test-0001",
    operationSha256,
    occurredAt: issuedAt,
  };
  const receiptPayload = buildReceiptPayload({
    receiptId: "01K10000000000000000000001",
    approvalId,
    eventId: authorizationEvent.eventId,
    sequence: authorizationEvent.sequence,
    eventSha256: sha256(authorizationEvent),
    previousEventSha256: authorizationEvent.previousEventSha256,
    payloadSha256: hashes.payloadSha256,
    diffSha256: hashes.diffSha256,
    policySha256: hashes.policySha256,
    state: "approved",
    issuedAt,
  });
  const receiptPayloadSha256 = sha256(receiptPayload);
  const signature = sign(
    null,
    Buffer.from(canonicalize(receiptPayload)),
    privateKey,
  ).toString("base64url");
  const grant = {
    schema: "heady.autonomous.grant.v1",
    capability: "source_authorship",
    ...hashes,
    operationSha256,
    executionNonce,
    expiresAt,
    authorizationEvent,
    authorizationReceipt: {
      receiptId: receiptPayload.receiptId,
      eventId: authorizationEvent.eventId,
      payload: receiptPayload,
      payloadSha256: receiptPayloadSha256,
      signingKeyId: "projects/heady/locations/global/keyRings/approval/cryptoKeys/receipt/cryptoKeyVersions/1",
      algorithm: "EC_SIGN_ED25519",
      signature,
      publicJwk,
      publicJwkVersion: "projects/heady/locations/global/keyRings/approval/cryptoKeys/receipt/cryptoKeyVersions/1",
      signatureVerified: true,
      issuedAt,
    },
  };
  const trustedSigner = {
    signingKeyId: grant.authorizationReceipt.signingKeyId,
    publicJwk,
  };
  assert.equal(verifyAutonomousGrant(grant, {
    now: Date.parse(issuedAt),
    trustedSigner,
  }), true);
  assert.equal(verifyAutonomousGrant(grant, { now: Date.parse(issuedAt) }), false);
  assert.equal(verifyAutonomousGrant({
    ...grant,
    subjectSha256: "9".repeat(64),
  }, { now: Date.parse(issuedAt), trustedSigner }), false);
  assert.equal(verifyAutonomousGrant(grant, {
    now: Date.parse(expiresAt),
    trustedSigner,
  }), false);
});

test("ULID generation is deterministic with injected time and entropy", () => {
  const ulid = createUlid({
    now: () => 1_721_822_400_000,
    entropy: () => Buffer.alloc(10),
  });
  assert.match(ulid, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.equal(ulid, createUlid({
    now: () => 1_721_822_400_000,
    entropy: () => Buffer.alloc(10),
  }));
});
