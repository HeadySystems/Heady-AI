// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Genesis Manifest Preparer v1.0.0               ║
// ║  Verifies the accepted tag and emits, but never applies, genesis.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  ACCEPTED_ADR_0031,
  buildGenesisManifest,
} from "../src/genesis.mjs";
import {
  assertHash,
  publicJwkFingerprint,
  sha256,
} from "../src/canonical.mjs";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, "../..");
const HASH_RE = /^[a-f0-9]{64}$/;
const OCI_DIGEST_RE = /^sha256:[a-f0-9]{64}$/;

function argumentsObject(values) {
  const entries = {};
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      throw new TypeError("genesis arguments must be --name value pairs");
    }
    const key = name.slice(2);
    if (Object.hasOwn(entries, key)) {
      throw new TypeError(`genesis argument --${key} must appear exactly once`);
    }
    entries[key] = value;
  }
  return entries;
}

const ArgumentsSchema = z.object({
  "deployment-manifest-sha256": z.string().regex(HASH_RE),
  "deployment-artifact-digest": z.string().regex(OCI_DIGEST_RE),
  "rollback-artifact-digest": z.string().regex(OCI_DIGEST_RE),
  "governance-report-sha256": z.string().regex(HASH_RE),
  "security-review-sha256": z.string().regex(HASH_RE),
  "founder-public-jwk": z.string().min(1),
  "arbiter-public-jwk": z.string().min(1),
  "receipt-signer-public-jwk": z.string().min(1),
}).strict();

function git(...args) {
  return execFileSync("git", args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function readJwk(path) {
  return JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, path), "utf8"));
}

function verifyAcceptedTag() {
  execFileSync("git", ["tag", "--verify", ACCEPTED_ADR_0031.tag], {
    cwd: REPOSITORY_ROOT,
    stdio: ["ignore", "ignore", "pipe"],
  });
  const acceptedCommit = git("rev-list", "-n", "1", ACCEPTED_ADR_0031.tag);
  const tagObject = git("rev-parse", ACCEPTED_ADR_0031.tag);
  if (
    acceptedCommit !== ACCEPTED_ADR_0031.acceptedCommit
    || tagObject !== ACCEPTED_ADR_0031.tagObject
  ) {
    throw new TypeError("ADR-0031 acceptance tag does not match the pinned Git objects");
  }
}

function trackedSourceTreeSha256(commit) {
  const paths = [
    "apps/approval-api",
    "packages/approvals",
    "packages/db/migrations/0004_approval_control_plane.sql",
    "policies/approval.rego",
  ];
  const tree = git("ls-tree", "-r", "--full-tree", commit, "--", ...paths);
  if (!tree) throw new TypeError("approval source tree is not tracked at the implementation commit");
  return sha256(tree);
}

const args = ArgumentsSchema.parse(argumentsObject(process.argv.slice(2)));
if (git("status", "--porcelain", "--untracked-files=all")) {
  throw new TypeError("genesis manifest preparation requires a clean committed worktree");
}
verifyAcceptedTag();

const implementationCommit = git("rev-parse", "HEAD^{commit}");
const policyManifest = JSON.parse(readFileSync(
  join(PACKAGE_ROOT, "policy", "manifest.json"),
  "utf8",
));
assertHash(
  policyManifest.sourceSha256,
  sha256(readFileSync(join(REPOSITORY_ROOT, "policies", "approval.rego"))),
  "policy source",
);
assertHash(
  policyManifest.wasmSha256,
  sha256(readFileSync(join(PACKAGE_ROOT, "policy", "approval.wasm"))),
  "policy WASM",
);
const result = buildGenesisManifest({
  implementationCommit,
  approvalSourceTreeSha256: trackedSourceTreeSha256(implementationCommit),
  specificationSha256: sha256(readFileSync(
    join(REPOSITORY_ROOT, "docs", "design", "APPROVAL_SERVICE_BOOTSTRAP_SPEC.md"),
  )),
  migrationSha256: sha256(readFileSync(
    join(REPOSITORY_ROOT, "packages", "db", "migrations", "0004_approval_control_plane.sql"),
  )),
  policySourceSha256: policyManifest.sourceSha256,
  policyWasmSha256: policyManifest.wasmSha256,
  deploymentManifestSha256: args["deployment-manifest-sha256"],
  deploymentArtifactDigest: args["deployment-artifact-digest"],
  rollbackArtifactDigest: args["rollback-artifact-digest"],
  governanceReportSha256: args["governance-report-sha256"],
  securityReviewSha256: args["security-review-sha256"],
  founderPublicKeyFingerprint: publicJwkFingerprint(readJwk(args["founder-public-jwk"])),
  arbiterPublicKeyFingerprint: publicJwkFingerprint(readJwk(args["arbiter-public-jwk"])),
  receiptSignerPublicKeyFingerprint: publicJwkFingerprint(
    readJwk(args["receipt-signer-public-jwk"]),
  ),
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
