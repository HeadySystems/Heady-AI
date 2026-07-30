// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Genesis Execution Contract v1.0.0                      ║
// ║  Strict stage-0 inputs and offline authorization verification. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  ACCEPTED_ADR_0031,
  canonicalize,
  publicJwkFingerprint,
  safeHashEqual,
  sha256,
  verifyEd25519,
} from "@heady/approvals";
import {
  GenesisManifestSchema,
  GenesisManifestSignatureSchema,
} from "./genesis-signer.mjs";
import {
  FOUNDER_FIREBASE_EMAILS,
  FOUNDER_FIREBASE_PROJECT_ID,
  verifyFounderIdToken,
} from "./founder-firebase-auth.mjs";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const HASH_RE = /^[a-f0-9]{64}$/;
const FOUNDER_EMAILS = FOUNDER_FIREBASE_EMAILS;
const JWK_SCHEMA = z.object({
  kty: z.literal("OKP"),
  crv: z.literal("Ed25519"),
  x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
}).strict();

export const GENESIS_TARGET = Object.freeze({
  projectId: "cool-wind-37254039",
  branchId: "br-hidden-union-aabqn03y",
  branchName: "production",
  databaseName: "neondb",
  confirmation: "cool-wind-37254039/br-hidden-union-aabqn03y/neondb",
});

export const GENESIS_ZONE_PATHS = Object.freeze([
  "apps/approval-api/",
  "docs/adr/0031-solo-founder-approval-bootstrap.md",
  "docs/design/APPROVAL_SERVICE_BOOTSTRAP_SPEC.md",
  "packages/approvals/",
  "packages/db/migrations/0004_approval_control_plane.sql",
  "policies/approval.rego",
]);

export const GenesisPrincipalSeedSchema = z.object({
  schema: z.literal("heady.approval.genesis.principals.v1"),
  firebaseProjectId: z.literal(FOUNDER_FIREBASE_PROJECT_ID),
  founder: z.object({
    stableIdentifier: z.literal("founder-eric-haywood"),
    firebaseUid: z.string().min(1).max(610),
    verifiedEmail: z.enum(FOUNDER_EMAILS),
    publicJwk: JWK_SCHEMA,
  }).strict(),
  arbiter: z.object({
    stableIdentifier: z.literal("arbiter-workload"),
    workloadIdentity: z.string().min(1).max(610),
    publicJwk: JWK_SCHEMA,
  }).strict(),
  deploymentGuard: z.object({
    stableIdentifier: z.literal("github-deployment-guard"),
    workloadIdentity: z.string().min(1).max(610),
  }).strict(),
}).strict().superRefine((value, context) => {
  const identities = [
    value.founder.firebaseUid,
    value.arbiter.workloadIdentity,
    value.deploymentGuard.workloadIdentity,
  ];
  if (new Set(identities).size !== identities.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [],
      message: "genesis principals must use three distinct authenticated identities",
    });
  }
});

function git(...args) {
  return execFileSync("git", args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function trackedSourceTreeSha256(commit) {
  const tree = git(
    "ls-tree",
    "-r",
    "--full-tree",
    commit,
    "--",
    "apps/approval-api",
    "packages/approvals",
    "packages/db/migrations/0004_approval_control_plane.sql",
    "policies/approval.rego",
  );
  if (!tree) throw new TypeError("approval source tree is absent at the implementation commit");
  return sha256(tree);
}

function assertFileHash(path, expected, label) {
  const actual = sha256(readFileSync(join(REPOSITORY_ROOT, path)));
  if (!safeHashEqual(actual, expected)) {
    throw new TypeError(`${label} does not match the signed genesis manifest`);
  }
}

export function parseGenesisArtifacts({
  manifestText,
  signatureText,
  principalSeedText,
}) {
  const manifest = GenesisManifestSchema.parse(JSON.parse(manifestText));
  const canonicalManifest = canonicalize(manifest);
  if (manifestText.trim() !== canonicalManifest) {
    throw new TypeError("genesis manifest must be canonical JSON");
  }
  const manifestSha256 = sha256(canonicalManifest);
  const signature = GenesisManifestSignatureSchema.parse(JSON.parse(signatureText));
  const principalSeed = GenesisPrincipalSeedSchema.parse(JSON.parse(principalSeedText));
  const principalSeedSha256 = sha256(principalSeed);
  const signatureSha256 = sha256(signature);

  if (
    !safeHashEqual(signature.manifestSha256, manifestSha256)
    || !safeHashEqual(signature.keyFingerprint, manifest.publicKeys.founderEvidence)
    || !safeHashEqual(publicJwkFingerprint(signature.publicJwk), signature.keyFingerprint)
    || canonicalize(signature.publicJwk) !== canonicalize(principalSeed.founder.publicJwk)
    || !verifyEd25519({
      publicJwk: signature.publicJwk,
      payload: canonicalManifest,
      signature: signature.signature,
    })
  ) {
    throw new TypeError("founder genesis authorization is invalid or not bound to the seed");
  }

  const founderFingerprint = publicJwkFingerprint(principalSeed.founder.publicJwk);
  const arbiterFingerprint = publicJwkFingerprint(principalSeed.arbiter.publicJwk);
  const receiptFingerprint = manifest.publicKeys.receiptSigner;
  if (
    !safeHashEqual(founderFingerprint, manifest.publicKeys.founderEvidence)
    || !safeHashEqual(arbiterFingerprint, manifest.publicKeys.arbiterEvidence)
    || new Set([founderFingerprint, arbiterFingerprint, receiptFingerprint]).size !== 3
  ) {
    throw new TypeError("genesis evidence and receipt keys must be correctly bound and distinct");
  }

  return Object.freeze({
    manifest,
    canonicalManifest,
    manifestSha256,
    signature,
    signatureSha256,
    principalSeed,
    principalSeedSha256,
  });
}

export function assertGenesisRepository({
  artifacts,
  deploymentManifestPath,
  governanceReportPath,
  securityReviewPath,
}) {
  if (git("status", "--porcelain", "--untracked-files=all")) {
    throw new TypeError("genesis execution requires a clean committed review worktree");
  }
  execFileSync("git", ["tag", "--verify", ACCEPTED_ADR_0031.tag], {
    cwd: REPOSITORY_ROOT,
    stdio: ["ignore", "ignore", "pipe"],
  });
  const commit = git("rev-parse", "HEAD^{commit}");
  if (
    commit !== artifacts.manifest.implementation.commit
    || git("rev-list", "-n", "1", ACCEPTED_ADR_0031.tag) !== ACCEPTED_ADR_0031.acceptedCommit
    || git("rev-parse", ACCEPTED_ADR_0031.tag) !== ACCEPTED_ADR_0031.tagObject
    || !safeHashEqual(
      trackedSourceTreeSha256(commit),
      artifacts.manifest.implementation.sourceTreeSha256,
    )
  ) {
    throw new TypeError("review worktree or ADR acceptance objects differ from the signed manifest");
  }

  assertFileHash(
    "docs/design/APPROVAL_SERVICE_BOOTSTRAP_SPEC.md",
    artifacts.manifest.implementation.specificationSha256,
    "bootstrap specification",
  );
  assertFileHash(
    "packages/db/migrations/0004_approval_control_plane.sql",
    artifacts.manifest.implementation.migrationSha256,
    "approval migration",
  );
  assertFileHash(
    "policies/approval.rego",
    artifacts.manifest.implementation.policySourceSha256,
    "approval policy source",
  );
  assertFileHash(
    "packages/approvals/policy/approval.wasm",
    artifacts.manifest.implementation.policyWasmSha256,
    "approval policy WASM",
  );

  const externalFiles = [
    [
      deploymentManifestPath,
      artifacts.manifest.deployment.manifestSha256,
      "deployment manifest",
    ],
    [
      governanceReportPath,
      artifacts.manifest.gates.governanceReportSha256,
      "governance report",
    ],
    [
      securityReviewPath,
      artifacts.manifest.gates.securityReviewSha256,
      "security review",
    ],
  ];
  for (const [path, expected, label] of externalFiles) {
    const actual = sha256(readFileSync(resolve(path)));
    if (!safeHashEqual(actual, expected)) {
      throw new TypeError(`${label} does not match the signed genesis manifest`);
    }
  }
  return true;
}

export function assertGenesisConfirmations({
  confirmedTarget,
  confirmedManifestSha256,
  confirmedBundleSha256,
  actualManifestSha256,
  actualBundleSha256,
}) {
  if (confirmedTarget !== GENESIS_TARGET.confirmation) {
    throw new TypeError("human-confirmed Neon target does not match the pinned production target");
  }
  for (const [value, label] of [
    [confirmedManifestSha256, "confirmed manifest"],
    [confirmedBundleSha256, "confirmed review bundle"],
  ]) {
    if (!HASH_RE.test(value)) {
      throw new TypeError(`${label} SHA-256 must be 64 lowercase hexadecimal characters`);
    }
  }
  if (
    !safeHashEqual(confirmedManifestSha256, actualManifestSha256)
    || !safeHashEqual(confirmedBundleSha256, actualBundleSha256)
  ) {
    throw new TypeError("human-confirmed manifest or review-bundle hash mismatch");
  }
  return true;
}

export function assertFounderTerminalEnvironment(environment = process.env) {
  if (
    environment.HEADY_FOUNDER_TERMINAL !== "1"
    || !FOUNDER_EMAILS.includes(environment.HEADY_FOUNDER_EMAIL)
    || environment.GOOGLE_APPLICATION_CREDENTIALS
  ) {
    throw new TypeError("genesis must run in the identity-checked founder terminal");
  }
  return true;
}

export async function verifyFounderFirebaseIdentity({
  firebaseAuth,
  idToken,
  principalSeed,
}) {
  return verifyFounderIdToken({
    firebaseAuth,
    idToken,
    expectedEmail: principalSeed.founder.verifiedEmail,
    expectedUid: principalSeed.founder.firebaseUid,
  });
}
