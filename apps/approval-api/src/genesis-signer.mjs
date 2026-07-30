// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Founder Genesis Manifest Signer v1.0.0                  ║
// ║  Exact-hash Cloud KMS ceremony for the canonical stage-0 record.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { z } from "zod";
import {
  ACCEPTED_ADR_0031,
  canonicalize,
  publicJwkFingerprint,
  sha256,
  verifyEd25519,
} from "@heady/approvals";
import { createKmsReceiptSigner } from "./kms-signer.mjs";

const HASH_RE = /^[a-f0-9]{64}$/;
const OCI_DIGEST_RE = /^sha256:[a-f0-9]{64}$/;
const KEY_VERSION_RE = /^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+\/cryptoKeyVersions\/[1-9]\d*$/;

export const GenesisManifestSchema = z.object({
  schema: z.literal("heady.approval.genesis.v1"),
  purpose: z.literal("approval-service-first-deployment-only"),
  acceptedAdr: z.object({
    identifier: z.literal("ADR-0031"),
    tag: z.literal(ACCEPTED_ADR_0031.tag),
    acceptedCommit: z.literal(ACCEPTED_ADR_0031.acceptedCommit),
    tagObject: z.literal(ACCEPTED_ADR_0031.tagObject),
    signerFingerprint: z.literal(ACCEPTED_ADR_0031.signerFingerprint),
  }).strict(),
  implementation: z.object({
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    sourceTreeSha256: z.string().regex(HASH_RE),
    specificationSha256: z.string().regex(HASH_RE),
    migrationSha256: z.string().regex(HASH_RE),
    policyVersion: z.string().min(1),
    policySourceSha256: z.string().regex(HASH_RE),
    policyWasmSha256: z.string().regex(HASH_RE),
  }).strict(),
  deployment: z.object({
    manifestSha256: z.string().regex(HASH_RE),
    artifactDigest: z.string().regex(OCI_DIGEST_RE),
    rollbackArtifactDigest: z.string().regex(OCI_DIGEST_RE),
  }).strict(),
  gates: z.object({
    governanceReportSha256: z.string().regex(HASH_RE),
    securityReviewSha256: z.string().regex(HASH_RE),
  }).strict(),
  publicKeys: z.object({
    founderEvidence: z.string().regex(HASH_RE),
    arbiterEvidence: z.string().regex(HASH_RE),
    receiptSigner: z.string().regex(HASH_RE),
  }).strict(),
  constraints: z.object({
    hcp0003Authorized: z.literal(false),
    beeRuntimeAuthorized: z.literal(false),
    reusable: z.literal(false),
  }).strict(),
}).strict();

export const GenesisManifestSignatureSchema = z.object({
  schema: z.literal("heady.approval.genesis.signature.v1"),
  manifestSha256: z.string().regex(HASH_RE),
  keyVersionName: z.string().regex(KEY_VERSION_RE),
  keyFingerprint: z.string().regex(HASH_RE),
  algorithm: z.literal("EC_SIGN_ED25519"),
  signature: z.string().min(64).max(610).regex(/^[A-Za-z0-9_-]+$/),
  publicJwk: z.object({
    kty: z.literal("OKP"),
    crv: z.literal("Ed25519"),
    x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  }).strict(),
}).strict();

export async function signGenesisManifest({
  manifestText,
  keyVersionName,
  confirmedManifestSha256,
  client,
}) {
  if (!KEY_VERSION_RE.test(keyVersionName)) {
    throw new TypeError("founder key version must be a full Cloud KMS crypto-key-version name");
  }
  if (!HASH_RE.test(confirmedManifestSha256)) {
    throw new TypeError("confirmed manifest SHA-256 must be 64 lowercase hexadecimal characters");
  }

  const manifest = GenesisManifestSchema.parse(JSON.parse(manifestText));
  const canonicalManifest = canonicalize(manifest);
  if (manifestText.trim() !== canonicalManifest) {
    throw new TypeError("genesis manifest file is not canonical JSON");
  }

  const manifestSha256 = sha256(canonicalManifest);
  if (manifestSha256 !== confirmedManifestSha256) {
    throw new TypeError("founder-confirmed genesis manifest hash mismatch");
  }

  const signer = await createKmsReceiptSigner({ keyVersionName, client });
  const keyFingerprint = publicJwkFingerprint(signer.publicJwk);
  if (keyFingerprint !== manifest.publicKeys.founderEvidence) {
    throw new TypeError("Cloud KMS key does not match the founder key bound by the genesis manifest");
  }

  const signed = await signer.sign({ payload: Buffer.from(canonicalManifest) });
  if (!verifyEd25519({
    publicJwk: signed.publicJwk,
    payload: canonicalManifest,
    signature: signed.signature,
  })) {
    throw new TypeError("founder genesis signature failed local verification");
  }

  return Object.freeze({
    schema: "heady.approval.genesis.signature.v1",
    manifestSha256,
    keyVersionName,
    keyFingerprint,
    algorithm: signed.algorithm,
    signature: signed.signature,
    publicJwk: signed.publicJwk,
  });
}
