// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Neon Integration Tests v1.0.0                  ║
// ║  Transactions, receipts, idempotency, concurrency, and DB armor.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { after, before, test } from "node:test";
import pg from "pg";
import {
  buildEvidenceEnvelope,
  canonicalize,
  createApprovalService,
  createPolicyEvaluator,
  publicJwkFingerprint,
} from "../src/index.mjs";

const connectionString = process.env.TEST_DATABASE_URL;
const runtimeConnectionString = process.env.TEST_RUNTIME_DATABASE_URL ?? connectionString;
const integration = connectionString ? test : test.skip;
const NOW = new Date("2026-07-24T12:00:00.000Z");
const CEREMONY_EXPIRY = new Date("2026-07-24T12:05:00.000Z").toISOString();

let pool;
let runtimePool;
let database;
let policyEvaluator;
let receiptKey;
let service;
let founder;
let arbiter;
let deploymentGuard;
let automationRequester;
let automationGuard;

function keyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey,
    publicJwk: publicKey.export({ format: "jwk" }),
  };
}

function databaseAdapter(targetPool) {
  return {
    query(sql, params = []) {
      return targetPool.query(sql, params);
    },
    async tx(work) {
      const client = await targetPool.connect();
      try {
        await client.query("BEGIN");
        const value = await work(client);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

function localReceiptSigner(key = receiptKey) {
  return {
    async sign({ payload }) {
      return {
        signingKeyId: "test-kms-key-version",
        algorithm: "EC_SIGN_ED25519",
        signature: sign(null, payload, key.privateKey).toString("base64url"),
        publicJwk: key.publicJwk,
        publicJwkVersion: "test-kms-key-version",
      };
    },
  };
}

async function seedPrincipal({
  stableIdentifier,
  principalType,
  principalRole,
  firebaseUid = null,
  verifiedEmail = null,
  workloadIdentity = null,
  allowedEvidence,
  key = null,
}) {
  const principalResult = await pool.query(`
    INSERT INTO heady_approval.principals (
      stable_identifier,
      principal_type,
      principal_role,
      firebase_uid,
      verified_email,
      workload_identity,
      allowed_evidence_classes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [
    stableIdentifier,
    principalType,
    principalRole,
    firebaseUid,
    verifiedEmail,
    workloadIdentity,
    allowedEvidence,
  ]);
  const principal = {
    id: principalResult.rows[0].id,
    actor: principalType === "service"
      ? {
          authType: "workload_identity",
          subject: workloadIdentity,
          email: null,
          emailVerified: false,
        }
      : {
          authType: "firebase",
          subject: firebaseUid,
          email: verifiedEmail,
          emailVerified: true,
        },
    key,
  };
  if (key) {
    await pool.query(`
      INSERT INTO heady_approval.principal_keys (
        principal_id,
        fingerprint,
        public_jwk,
        valid_from
      ) VALUES ($1, $2, $3, $4)
    `, [
      principal.id,
      publicJwkFingerprint(key.publicJwk),
      key.publicJwk,
      new Date(NOW.getTime() - 60_000).toISOString(),
    ]);
  }
  return principal;
}

function decisionInput(approval, principal, {
  decision = "approve",
  reason = "founder explicit approval",
  nonce = "founder-decision-nonce-0001",
} = {}) {
  const detail = {
    evidenceClass: "founder_decision",
    decision,
    reason,
    resolvesEscalation: false,
  };
  const envelope = buildEvidenceEnvelope({
    approvalId: approval.approvalId,
    action: decision,
    payloadSha256: approval.payloadSha256,
    diffSha256: approval.diffSha256,
    policySha256: approval.policySha256,
    nonce,
    evidenceExpiresAt: CEREMONY_EXPIRY,
    detail,
  });
  return {
    decision,
    reason,
    nonce,
    evidenceExpiresAt: CEREMONY_EXPIRY,
    signature: sign(
      null,
      Buffer.from(canonicalize(envelope)),
      principal.key.privateKey,
    ).toString("base64url"),
    resolvesEscalation: false,
  };
}

function arbiterInput(approval, principal, {
  nonce = "arbiter-attestation-nonce-0001",
} = {}) {
  const detail = {
    evidenceClass: "arbiter_attestation",
    verdict: "ALLOW",
    patentClaims: ["HS-2026-051"],
    reviewedPaths: approval.zonePaths,
    rationaleSha256: "5".repeat(64),
    resolvesEscalation: false,
  };
  const envelope = buildEvidenceEnvelope({
    approvalId: approval.approvalId,
    action: "attest:ALLOW",
    payloadSha256: approval.payloadSha256,
    diffSha256: approval.diffSha256,
    policySha256: approval.policySha256,
    nonce,
    evidenceExpiresAt: CEREMONY_EXPIRY,
    detail,
  });
  return {
    verdict: "ALLOW",
    patentClaims: detail.patentClaims,
    reviewedPaths: detail.reviewedPaths,
    rationaleSha256: detail.rationaleSha256,
    nonce,
    evidenceExpiresAt: CEREMONY_EXPIRY,
    signature: sign(
      null,
      Buffer.from(canonicalize(envelope)),
      principal.key.privateKey,
    ).toString("base64url"),
  };
}

function automationGuardInput(approval, principal, {
  nonce = "automation-attestation-nonce-0001",
} = {}) {
  const detail = {
    evidenceClass: "automation_attestation",
    verdict: "ALLOW",
    patentClaims: [],
    reviewedPaths: approval.zonePaths,
    rationaleSha256: "8".repeat(64),
    resolvesEscalation: false,
  };
  const envelope = buildEvidenceEnvelope({
    approvalId: approval.approvalId,
    action: "attest:ALLOW",
    payloadSha256: approval.payloadSha256,
    diffSha256: approval.diffSha256,
    policySha256: approval.policySha256,
    nonce,
    evidenceExpiresAt: CEREMONY_EXPIRY,
    detail,
  });
  return {
    verdict: "ALLOW",
    patentClaims: [],
    reviewedPaths: approval.zonePaths,
    rationaleSha256: detail.rationaleSha256,
    nonce,
    evidenceExpiresAt: CEREMONY_EXPIRY,
    signature: sign(
      null,
      Buffer.from(canonicalize(envelope)),
      principal.key.privateKey,
    ).toString("base64url"),
  };
}

before(async () => {
  if (!connectionString) return;
  pool = new pg.Pool({ connectionString, max: 5 });
  runtimePool = new pg.Pool({ connectionString: runtimeConnectionString, max: 5 });
  database = databaseAdapter(runtimePool);
  await pool.query(`
    TRUNCATE
      heady_approval.bootstrap,
      heady_approval.audit_replays,
      heady_approval.autonomous_grant_claims,
      heady_approval.outbox,
      heady_approval.receipts,
      heady_approval.events,
      heady_approval.approvals,
      heady_approval.receipt_signing_keys,
      heady_approval.principal_keys,
      heady_approval.principals
    RESTART IDENTITY CASCADE
  `);
  receiptKey = keyPair();
  policyEvaluator = await createPolicyEvaluator();
  await pool.query(`
    INSERT INTO heady_approval.receipt_signing_keys (
      key_id,
      fingerprint,
      public_jwk,
      valid_from
    ) VALUES ($1, $2, $3, $4)
  `, [
    "test-kms-key-version",
    publicJwkFingerprint(receiptKey.publicJwk),
    receiptKey.publicJwk,
    new Date(NOW.getTime() - 60_000).toISOString(),
  ]);
  founder = await seedPrincipal({
    stableIdentifier: "founder-eric-haywood",
    principalType: "human",
    principalRole: "founder",
    firebaseUid: "firebase-founder-uid",
    verifiedEmail: "eric@headysystems.com",
    allowedEvidence: ["founder_decision"],
    key: keyPair(),
  });
  arbiter = await seedPrincipal({
    stableIdentifier: "arbiter-workload",
    principalType: "service",
    principalRole: "arbiter",
    workloadIdentity: "arbiter-workload-subject",
    allowedEvidence: ["arbiter_attestation"],
    key: keyPair(),
  });
  deploymentGuard = await seedPrincipal({
    stableIdentifier: "github-deployment-guard",
    principalType: "service",
    principalRole: "deployment_guard",
    workloadIdentity: "deployment-guard-subject",
    allowedEvidence: [],
  });
  automationRequester = await seedPrincipal({
    stableIdentifier: "autonomous-requester-workload",
    principalType: "service",
    principalRole: "automation_requester",
    workloadIdentity: "autonomous-requester-subject",
    allowedEvidence: [],
  });
  automationGuard = await seedPrincipal({
    stableIdentifier: "autonomous-guard-workload",
    principalType: "service",
    principalRole: "automation_guard",
    workloadIdentity: "autonomous-guard-subject",
    allowedEvidence: ["automation_attestation"],
    key: keyPair(),
  });
  service = createApprovalService({
    database,
    policyEvaluator,
    signer: localReceiptSigner(),
    clock: () => NOW,
  });
});

after(async () => {
  if (runtimePool) await runtimePool.end();
  if (pool) await pool.end();
});

integration("standard approval is transactional, idempotent, replayable, and deployment-bound", async () => {
  const draft = await service.create({
    actor: founder.actor,
    input: {
      hcpIdentifier: "HCP-0031",
      title: "Approval service standard integration",
      subjectType: "deployment",
      patentLocked: false,
      zonePaths: ["packages/example/index.mjs"],
      payload: { release: "approval-api-v1" },
      diffSha256: "2".repeat(64),
      artifactDigest: `sha256:${"3".repeat(64)}`,
    },
    idempotencyKey: "create-standard-0001",
    traceId: "trace-standard-create",
  });
  assert.equal(draft.state, "draft");
  assert.equal(draft.eventSequence, 1);

  const pending = await service.submit({
    approvalId: draft.approvalId,
    actor: founder.actor,
    input: { reason: "proposal hashes reviewed" },
    idempotencyKey: "submit-standard-0001",
    traceId: "trace-standard-submit",
  });
  assert.equal(pending.state, "pending");
  assert.deepEqual(pending.requiredEvidence, ["founder_decision"]);

  const approveInput = decisionInput(pending, founder);
  const approved = await service.decide({
    approvalId: pending.approvalId,
    actor: founder.actor,
    input: approveInput,
    idempotencyKey: "decision-standard-0001",
    traceId: "trace-standard-decision",
  });
  assert.equal(approved.state, "approved");
  assert.equal(approved.eventSequence, 3);
  assert.ok(approved.events.every((event) => event.receiptVerified));

  const readable = await service.get({
    approvalId: approved.approvalId,
    actor: founder.actor,
  });
  assert.equal(readable.approvalId, approved.approvalId);
  const readableReceipts = await service.receipts({
    approvalId: approved.approvalId,
    actor: founder.actor,
  });
  assert.equal(readableReceipts.receipts.length, 3);
  await assert.rejects(
    () => service.get({
      approvalId: approved.approvalId,
      actor: {
        authType: "firebase",
        subject: "unregistered-user",
        email: "unregistered@headysystems.com",
        emailVerified: true,
      },
    }),
    /active approval principal/,
  );

  const retried = await service.decide({
    approvalId: pending.approvalId,
    actor: founder.actor,
    input: approveInput,
    idempotencyKey: "decision-standard-0001",
    traceId: "trace-standard-decision-retry",
  });
  assert.equal(retried.eventSequence, 3);

  const verified = await service.verify({
    approvalId: pending.approvalId,
    actor: founder.actor,
    input: { reason: "integration audit replay" },
    idempotencyKey: "verify-standard-0001",
    traceId: "trace-standard-verify",
  });
  assert.equal(verified.auditReplay.valid, true);
  assert.equal(verified.eventSequence, 4);

  const protection = await service.deploymentProtection({
    actor: deploymentGuard.actor,
    input: {
      approvalId: approved.approvalId,
      diffSha256: approved.diffSha256,
      artifactDigest: approved.artifactDigest,
      policySha256: approved.policySha256,
    },
  });
  assert.equal(protection.allow, true);

  const drifted = await service.deploymentProtection({
    actor: deploymentGuard.actor,
    input: {
      approvalId: approved.approvalId,
      diffSha256: "4".repeat(64),
      artifactDigest: approved.artifactDigest,
      policySha256: approved.policySha256,
    },
  });
  assert.equal(drifted.allow, false);
  assert.ok(drifted.reasons.includes("diff_hash_mismatch"));
  const outbox = await pool.query(
    "SELECT topic FROM heady_approval.outbox ORDER BY sequence",
  );
  assert.ok(outbox.rows.every(({ topic }) => topic.startsWith("heady.approval.")));
});

integration("patent founder and ARBITER decisions serialize into one monotonic chain", async () => {
  const draft = await service.create({
    actor: founder.actor,
    input: {
      hcpIdentifier: "HCP-0032",
      title: "Concurrent patent approval",
      subjectType: "change",
      patentLocked: true,
      zonePaths: ["packages/bees/worker.mjs"],
      payload: { change: "bounded patent test" },
      diffSha256: "6".repeat(64),
    },
    idempotencyKey: "create-patent-0001",
    traceId: "trace-patent-create",
  });
  const pending = await service.submit({
    approvalId: draft.approvalId,
    actor: founder.actor,
    input: { reason: "patent proposal frozen" },
    idempotencyKey: "submit-patent-0001",
    traceId: "trace-patent-submit",
  });

  const [founderResult, arbiterResult] = await Promise.all([
    service.decide({
      approvalId: pending.approvalId,
      actor: founder.actor,
      input: decisionInput(pending, founder, {
        nonce: "founder-patent-decision-0001",
      }),
      idempotencyKey: "decision-patent-founder-0001",
      traceId: "trace-patent-founder",
    }),
    service.attest({
      approvalId: pending.approvalId,
      actor: arbiter.actor,
      input: arbiterInput(pending, arbiter),
      idempotencyKey: "attest-patent-arbiter-0001",
      traceId: "trace-patent-arbiter",
    }),
  ]);
  const final = founderResult.eventSequence > arbiterResult.eventSequence
    ? founderResult
    : arbiterResult;
  assert.equal(final.state, "approved");
  assert.equal(final.eventSequence, 4);
  assert.deepEqual(final.events.map((event) => event.sequence), [1, 2, 3, 4]);
});

integration("autonomous grants require an independent guard and are consumed once", async () => {
  const pending = await service.requestAutonomous({
    actor: automationRequester.actor,
    input: {
      hcpIdentifier: "HCP-0033",
      title: "One-time source authorship grant",
      capability: "source_authorship",
      zonePaths: ["packages/example/src/autonomous.mjs"],
      resourceScopes: ["repo:Heady-AI/packages/example"],
      subjectSha256: "9".repeat(64),
      diffSha256: "a".repeat(64),
      rollbackPlanSha256: "b".repeat(64),
      riskTier: "low",
      reversible: true,
      dryRunVerified: true,
      networkAccess: "none",
      maxAffectedResources: 1,
      maxDurationMs: 1_000,
    },
    idempotencyKey: "autonomous-request-0001",
    traceId: "trace-autonomous-request",
  });
  assert.equal(pending.state, "pending");
  assert.deepEqual(pending.requiredEvidence, ["automation_attestation"]);

  const guardReadable = await service.getAutonomous({
    approvalId: pending.approvalId,
    actor: automationGuard.actor,
  });
  assert.equal(guardReadable.payload.requesterPrincipalId, automationRequester.id);

  const approved = await service.attest({
    approvalId: pending.approvalId,
    actor: automationGuard.actor,
    input: automationGuardInput(pending, automationGuard),
    idempotencyKey: "autonomous-attest-0001",
    traceId: "trace-autonomous-attest",
  });
  assert.equal(approved.state, "approved");

  const protectionInput = {
    approvalId: approved.approvalId,
    capability: approved.payload.capability,
    subjectSha256: approved.payload.subjectSha256,
    payloadSha256: approved.payloadSha256,
    diffSha256: approved.diffSha256,
    policySha256: approved.policySha256,
    executionNonce: "autonomous-execution-nonce-0001",
  };
  const granted = await service.autonomousProtection({
    actor: automationRequester.actor,
    input: protectionInput,
    idempotencyKey: "autonomous-protection-0001",
    traceId: "trace-autonomous-protection",
  });
  assert.equal(granted.allow, true);
  assert.equal(granted.grant.authorizationReceipt.signatureVerified, true);

  const retried = await service.autonomousProtection({
    actor: automationRequester.actor,
    input: protectionInput,
    idempotencyKey: "autonomous-protection-0001",
    traceId: "trace-autonomous-protection-retry",
  });
  assert.equal(retried.grant.operationSha256, granted.grant.operationSha256);

  const replayed = await service.autonomousProtection({
    actor: automationRequester.actor,
    input: {
      ...protectionInput,
      executionNonce: "autonomous-execution-nonce-0002",
    },
    idempotencyKey: "autonomous-protection-0002",
    traceId: "trace-autonomous-protection-replay",
  });
  assert.equal(replayed.allow, false);
  assert.ok(replayed.reasons.includes("grant_already_consumed"));

  await assert.rejects(
    () => pool.query(`
      UPDATE heady_approval.autonomous_grant_claims
         SET capability = 'maintenance_execution'
    `),
    /append-only relation/,
  );
});

integration("signer failures roll back and database history rejects rewrite or deletion", async () => {
  const before = await pool.query("SELECT count(*)::int AS count FROM heady_approval.approvals");
  const failingService = createApprovalService({
    database,
    policyEvaluator,
    signer: {
      async sign() {
        throw new Error("simulated KMS outage");
      },
    },
    clock: () => NOW,
  });
  await assert.rejects(() => failingService.create({
    actor: founder.actor,
    input: {
      hcpIdentifier: "HCP-0033",
      title: "Must roll back",
      subjectType: "change",
      patentLocked: false,
      zonePaths: ["packages/example/failure.mjs"],
      payload: { signer: "unavailable" },
      diffSha256: "7".repeat(64),
    },
    idempotencyKey: "create-signer-failure-0001",
    traceId: "trace-signer-failure",
  }), /simulated KMS outage/);
  const afterFailure = await pool.query("SELECT count(*)::int AS count FROM heady_approval.approvals");
  assert.equal(afterFailure.rows[0].count, before.rows[0].count);

  await assert.rejects(
    () => pool.query("UPDATE heady_approval.events SET reason = 'rewritten' WHERE sequence = 1"),
    /append-only relation/,
  );
  await assert.rejects(
    () => pool.query("DELETE FROM heady_approval.receipts"),
    /append-only relation/,
  );
  await assert.rejects(
    () => pool.query(`
      UPDATE heady_approval.outbox
         SET payload = jsonb_build_object('rewritten', TRUE)
    `),
    /outbox event identity is immutable/,
  );
  await assert.rejects(
    () => pool.query(`
      INSERT INTO heady_approval.principals (
        stable_identifier,
        principal_type,
        principal_role,
        workload_identity,
        allowed_evidence_classes
      ) VALUES (
        'invalid-renovate-role-binding',
        'service',
        'renovate',
        'invalid-renovate-subject',
        ARRAY['arbiter_attestation']::TEXT[]
      )
    `),
    /principal_role_evidence_shape/,
  );

  const revocationClient = await pool.connect();
  try {
    await revocationClient.query("BEGIN");
    await revocationClient.query(`
      UPDATE heady_approval.principals
         SET active = FALSE,
             revoked_at = now(),
             revocation_reason = 'integration revocation'
       WHERE id = $1
    `, [deploymentGuard.id]);
    await assert.rejects(
      () => revocationClient.query(`
        UPDATE heady_approval.principals
           SET active = TRUE,
               revoked_at = NULL,
               revocation_reason = NULL
         WHERE id = $1
      `, [deploymentGuard.id]),
      /revocation is irreversible/,
    );
    await revocationClient.query("ROLLBACK");
  } finally {
    revocationClient.release();
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE authenticated");
    await assert.rejects(
      () => client.query("SELECT * FROM heady_approval.approvals"),
      /permission denied/,
    );
    await client.query("ROLLBACK");

  } finally {
    client.release();
  }

  const runtimeClient = await runtimePool.connect();
  try {
    await assert.rejects(
      () => runtimeClient.query("UPDATE heady_approval.outbox SET payload = payload"),
      /permission denied/,
    );
    await assert.rejects(
      () => runtimeClient.query("INSERT INTO heady_approval.bootstrap (singleton) VALUES (TRUE)"),
      /permission denied/,
    );
  } finally {
    runtimeClient.release();
  }
});
