// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Genesis Manifest v1.0.0                        ║
// ║  Canonical one-time bootstrap binding without executing genesis.║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { z } from "zod";
import { canonicalize, sha256 } from "./canonical.mjs";
import { POLICY_VERSION, SHA256_RE } from "./constants.mjs";

export const ACCEPTED_ADR_0031 = Object.freeze({
  tag: "adr-0031-accepted-e064a8943",
  acceptedCommit: "e064a8943b1dc4d9737f542d530e023fc8441282",
  tagObject: "5b7226f218ff6b888b5aaee581ced89fa574e9ac",
  signerFingerprint: "1050B59E7296C46C26DDF95DA7D2108BB3C6101C",
});

const GitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const HashSchema = z.string().regex(SHA256_RE);
const OciDigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const GenesisManifestInputSchema = z.object({
  implementationCommit: GitShaSchema,
  approvalSourceTreeSha256: HashSchema,
  specificationSha256: HashSchema,
  migrationSha256: HashSchema,
  policySourceSha256: HashSchema,
  policyWasmSha256: HashSchema,
  deploymentManifestSha256: HashSchema,
  deploymentArtifactDigest: OciDigestSchema,
  rollbackArtifactDigest: OciDigestSchema,
  governanceReportSha256: HashSchema,
  securityReviewSha256: HashSchema,
  founderPublicKeyFingerprint: HashSchema,
  arbiterPublicKeyFingerprint: HashSchema,
  receiptSignerPublicKeyFingerprint: HashSchema,
}).strict();

export function buildGenesisManifest(input) {
  const value = GenesisManifestInputSchema.parse(input);
  const manifest = {
    schema: "heady.approval.genesis.v1",
    purpose: "approval-service-first-deployment-only",
    acceptedAdr: {
      identifier: "ADR-0031",
      ...ACCEPTED_ADR_0031,
    },
    implementation: {
      commit: value.implementationCommit,
      sourceTreeSha256: value.approvalSourceTreeSha256,
      specificationSha256: value.specificationSha256,
      migrationSha256: value.migrationSha256,
      policyVersion: POLICY_VERSION,
      policySourceSha256: value.policySourceSha256,
      policyWasmSha256: value.policyWasmSha256,
    },
    deployment: {
      manifestSha256: value.deploymentManifestSha256,
      artifactDigest: value.deploymentArtifactDigest,
      rollbackArtifactDigest: value.rollbackArtifactDigest,
    },
    gates: {
      governanceReportSha256: value.governanceReportSha256,
      securityReviewSha256: value.securityReviewSha256,
    },
    publicKeys: {
      founderEvidence: value.founderPublicKeyFingerprint,
      arbiterEvidence: value.arbiterPublicKeyFingerprint,
      receiptSigner: value.receiptSignerPublicKeyFingerprint,
    },
    constraints: {
      hcp0003Authorized: false,
      beeRuntimeAuthorized: false,
      reusable: false,
    },
  };
  return Object.freeze({
    manifest,
    canonicalManifest: canonicalize(manifest),
    manifestSha256: sha256(manifest),
  });
}
