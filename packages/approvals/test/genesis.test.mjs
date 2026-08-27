// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Genesis Manifest Tests v1.0.0                  ║
// ║  Determinism, accepted anchor binding, and scope denial tests.   ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACCEPTED_ADR_0031,
  buildGenesisManifest,
} from "../src/genesis.mjs";

const input = Object.freeze({
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
  founderPublicKeyFingerprint: "b".repeat(64),
  arbiterPublicKeyFingerprint: "c".repeat(64),
  receiptSignerPublicKeyFingerprint: "d".repeat(64),
});

test("genesis manifest is deterministic and permanently denies downstream scope", () => {
  const first = buildGenesisManifest(input);
  const second = buildGenesisManifest({ ...input });
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.equal(first.canonicalManifest, second.canonicalManifest);
  assert.deepEqual(first.manifest.acceptedAdr.tagObject, ACCEPTED_ADR_0031.tagObject);
  assert.equal(first.manifest.constraints.hcp0003Authorized, false);
  assert.equal(first.manifest.constraints.beeRuntimeAuthorized, false);
  assert.equal(first.manifest.constraints.reusable, false);
});

test("genesis manifest rejects malformed hashes and undeclared fields", () => {
  assert.throws(() => buildGenesisManifest({
    ...input,
    migrationSha256: "invalid",
  }));
  assert.throws(() => buildGenesisManifest({
    ...input,
    extraAuthority: true,
  }));
  assert.throws(() => buildGenesisManifest({
    ...input,
    deploymentArtifactDigest: "approval-api:latest",
  }));
});
