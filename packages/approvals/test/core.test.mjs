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
  EVIDENCE_CEREMONY_MAX_MS,
  publicJwkFingerprint,
  safeHashEqual,
  sha256,
  verifyEvidenceCeremony,
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
