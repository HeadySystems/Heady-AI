// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Genesis Executor Bundle Tests v1.0.0                   ║
// ║  Static authorization, target binding, and receipt-chain tests.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  randomUUID,
  sign,
} from "node:crypto";
import { test } from "node:test";
import {
  base64UrlEncode,
  buildGenesisManifest,
  canonicalize,
  publicJwkFingerprint,
  sha256,
  verifyReceipt,
} from "@heady/approvals";
import {
  GENESIS_TARGET,
  parseGenesisArtifacts,
  verifyFounderFirebaseIdentity,
} from "../src/genesis-contract.mjs";
import { buildGenesisMaterial } from "../src/genesis-executor.mjs";
import { buildGenesisReviewDigest } from "../src/genesis-review-digest.mjs";
import {
  parseNeonConnectionUrl,
  verifyNeonTarget,
} from "../src/genesis-target.mjs";

function keyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey,
    publicJwk: publicKey.export({ format: "jwk" }),
  };
}

function artifactsFixture() {
  const founder = keyPair();
  const arbiter = keyPair();
  const receipt = keyPair();
  const built = buildGenesisManifest({
    implementationCommit: "a".repeat(40),
    approvalSourceTreeSha256: "1".repeat(64),
    specificationSha256: "2".repeat(64),
    migrationSha256: "3".repeat(64),
    policySourceSha256: "4".repeat(64),
    policyWasmSha256: "5".repeat(64),
    deploymentManifestSha256: "6".repeat(64),
    deploymentArtifactDigest: `sha256:${"7".repeat(64)}`,
    rollbackArtifactDigest: `sha256:${"8".repeat(64)}`,
    governanceReportSha256: "9".repeat(64),
    securityReviewSha256: "a".repeat(64),
    founderPublicKeyFingerprint: publicJwkFingerprint(founder.publicJwk),
    arbiterPublicKeyFingerprint: publicJwkFingerprint(arbiter.publicJwk),
    receiptSignerPublicKeyFingerprint: publicJwkFingerprint(receipt.publicJwk),
  });
  const signature = {
    schema: "heady.approval.genesis.signature.v1",
    manifestSha256: built.manifestSha256,
    keyVersionName: "projects/heady-ai/locations/global/keyRings/review/cryptoKeys/founder/cryptoKeyVersions/1",
    keyFingerprint: publicJwkFingerprint(founder.publicJwk),
    algorithm: "EC_SIGN_ED25519",
    signature: base64UrlEncode(sign(
      null,
      Buffer.from(built.canonicalManifest),
      founder.privateKey,
    )),
    publicJwk: founder.publicJwk,
  };
  const principalSeed = {
    schema: "heady.approval.genesis.principals.v1",
    firebaseProjectId: "heady-ai",
    founder: {
      stableIdentifier: "founder-eric-haywood",
      firebaseUid: "firebase-founder-uid",
      verifiedEmail: "eric@headysystems.com",
      publicJwk: founder.publicJwk,
    },
    arbiter: {
      stableIdentifier: "arbiter-workload",
      workloadIdentity: "arbiter-workload-subject",
      publicJwk: arbiter.publicJwk,
    },
    deploymentGuard: {
      stableIdentifier: "github-deployment-guard",
      workloadIdentity: "deployment-guard-subject",
    },
  };
  return {
    artifacts: parseGenesisArtifacts({
      manifestText: built.canonicalManifest,
      signatureText: JSON.stringify(signature),
      principalSeedText: JSON.stringify(principalSeed),
    }),
    founder,
    arbiter,
    receipt,
  };
}

test("genesis artifacts verify the founder signature and three distinct key roles", () => {
  const { artifacts } = artifactsFixture();
  assert.equal(artifacts.manifest.constraints.reusable, false);
  assert.equal(artifacts.manifestSha256, artifacts.signature.manifestSha256);
  assert.match(artifacts.principalSeedSha256, /^[a-f0-9]{64}$/);
});

test("genesis founder identity is verified against the exact Firebase seed", async () => {
  const { artifacts } = artifactsFixture();
  const identity = await verifyFounderFirebaseIdentity({
    firebaseAuth: {
      async verifyIdToken(token, checkRevoked) {
        assert.equal(token, "f".repeat(89));
        assert.equal(checkRevoked, true);
        return {
          uid: artifacts.principalSeed.founder.firebaseUid,
          email: artifacts.principalSeed.founder.verifiedEmail,
          email_verified: true,
          aud: artifacts.principalSeed.firebaseProjectId,
          iss: `https://securetoken.google.com/${artifacts.principalSeed.firebaseProjectId}`,
          auth_time: Math.floor(Date.now() / 1_000),
          iat: Math.floor(Date.now() / 1_000),
        };
      },
    },
    idToken: "f".repeat(89),
    principalSeed: artifacts.principalSeed,
  });
  assert.equal(identity.uid, artifacts.principalSeed.founder.firebaseUid);
});

test("genesis material creates a fail-closed event and independently signed receipt", async () => {
  const { artifacts, receipt } = artifactsFixture();
  const policyResult = {
    allow: false,
    missingEvidence: ["external_security_review", "founder_decision"],
    reasons: ["approval_not_pending"],
    requiredEvidence: ["founder_decision", "external_security_review"],
    escalationRequired: false,
    duplicateEvidence: [],
    principalSlotCollisions: [],
  };
  const signingKeyId = "projects/heady-ai/locations/global/keyRings/review/cryptoKeys/receipt/cryptoKeyVersions/1";
  const material = await buildGenesisMaterial({
    artifacts,
    founderPrincipal: {
      id: "6d80ce56-85b1-45ff-9f4a-572f80fdb85d",
      stable_identifier: "founder-eric-haywood",
      principal_type: "human",
      principal_role: "founder",
    },
    policyEvaluator: {
      async evaluate() {
        return policyResult;
      },
    },
    signer: {
      async sign({ payload }) {
        return {
          signingKeyId,
          algorithm: "EC_SIGN_ED25519",
          signature: base64UrlEncode(sign(null, payload, receipt.privateKey)),
          publicJwk: receipt.publicJwk,
          publicJwkVersion: signingKeyId,
        };
      },
    },
    occurredAt: "2026-07-29T12:00:00.000Z",
    ids: {
      approvalId: "01K1C3P9G0H9W7XFZYB3D5N8QM",
      approvalInternalId: "2ba1cfbf-9caf-48b2-862b-41011f81fbc8",
      eventId: "cb88cf4f-6b9d-446b-839c-f52149e59ea7",
      receiptInternalId: "d5226166-64de-4a2b-9849-6fbf6978ea6a",
      receiptId: "01K1C3P9G0H9W7XFZYB3D5N8QN",
    },
  });
  assert.equal(material.event.eventType, "system_bootstrapped");
  assert.equal(material.event.resultingState, "draft");
  assert.equal(material.event.policyResult.allow, false);
  assert.equal(material.event.actorSnapshot.ceremonyVerified, false);
  assert.equal(material.receipt.signingKeyId, signingKeyId);
  assert.equal(verifyReceipt({
    payload: material.receipt.payload,
    payloadSha256: material.receipt.payloadSha256,
    signature: material.receipt.signature,
    publicJwk: material.receipt.publicJwk,
  }), true);
  const { eventSha256, ...eventPayload } = material.event;
  assert.equal(eventSha256, sha256(eventPayload));
});

test("Neon target guard proves the pinned production branch and endpoint", async () => {
  const directUrl = "postgresql://owner:secret@ep-review.us-central1.aws.neon.tech/neondb?sslmode=require";
  assert.equal(parseNeonConnectionUrl(directUrl, { pooled: false }).databaseName, "neondb");
  const calls = [];
  const result = await verifyNeonTarget({
    connectionString: directUrl,
    apiKey: "neon-review-api-key-value",
    pooled: false,
    fetchFn: async (url) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        async json() {
          if (url.endsWith(`/branches/${GENESIS_TARGET.branchId}`)) {
            return {
              branch: {
                id: GENESIS_TARGET.branchId,
                project_id: GENESIS_TARGET.projectId,
                name: GENESIS_TARGET.branchName,
              },
            };
          }
          return {
            endpoints: [{
              id: "ep-review",
              project_id: GENESIS_TARGET.projectId,
              branch_id: GENESIS_TARGET.branchId,
              host: "ep-review.us-central1.aws.neon.tech",
              type: "read_write",
              disabled: false,
            }],
          };
        },
      };
    },
  });
  assert.equal(result.branchId, GENESIS_TARGET.branchId);
  assert.equal(result.endpointId, "ep-review");
  assert.equal(calls.length, 2);
});

test("review scope is self-inclusive and produces a canonical SHA-256", () => {
  const result = buildGenesisReviewDigest();
  assert.match(result.bundleSha256, /^[a-f0-9]{64}$/);
  assert.ok(result.record.files.some(({ path }) => (
    path === "apps/approval-api/genesis-review-scope.json"
  )));
  assert.equal(result.canonicalRecord, canonicalize(result.record));
});
