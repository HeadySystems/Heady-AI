// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Founder Genesis Executor CLI v1.0.0                    ║
// ║  Explicit exact-hash gate for one production transaction.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { z } from "zod";
import {
  assertFounderTerminalEnvironment,
  assertGenesisConfirmations,
  assertGenesisRepository,
  parseGenesisArtifacts,
} from "../src/genesis-contract.mjs";
import { executeGenesis } from "../src/genesis-executor.mjs";
import { FOUNDER_FIREBASE_PROJECT_ID } from "../src/founder-firebase-auth.mjs";
import { buildGenesisReviewDigest } from "../src/genesis-review-digest.mjs";

const HASH_RE = /^[a-f0-9]{64}$/;
const KEY_VERSION_RE = /^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+\/cryptoKeyVersions\/[1-9]\d*$/;
const ArgumentsSchema = z.object({
  "manifest": z.string().min(1),
  "manifest-signature": z.string().min(1),
  "principal-seed": z.string().min(1),
  "deployment-manifest": z.string().min(1),
  "governance-report": z.string().min(1),
  "security-review": z.string().min(1),
  "confirm-target": z.string().min(1),
  "confirm-manifest-sha256": z.string().regex(HASH_RE),
  "confirm-bundle-sha256": z.string().regex(HASH_RE),
}).strict();
const EnvironmentSchema = z.object({
  HEADY_GENESIS_DATABASE_URL: z.string().min(1),
  NEON_API_KEY: z.string().min(21),
  HEADY_RECEIPT_KEY_VERSION: z.string().regex(KEY_VERSION_RE),
  FIREBASE_PROJECT_ID: z.literal(FOUNDER_FIREBASE_PROJECT_ID),
  HEADY_FOUNDER_ID_TOKEN: z.string().min(89),
}).passthrough();

function namedArguments(values) {
  const entries = {};
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      throw new TypeError("genesis executor arguments must be --name value pairs");
    }
    const key = name.slice(2);
    if (Object.hasOwn(entries, key)) {
      throw new TypeError(`genesis executor argument --${key} must appear exactly once`);
    }
    entries[key] = value;
  }
  return ArgumentsSchema.parse(entries);
}

const inputArguments = process.argv[2] === "--" ? process.argv.slice(3) : process.argv.slice(2);
const args = namedArguments(inputArguments);
assertFounderTerminalEnvironment();
const environment = EnvironmentSchema.parse(process.env);
const [manifestText, signatureText, principalSeedText] = await Promise.all([
  readFile(resolve(args.manifest), "utf8"),
  readFile(resolve(args["manifest-signature"]), "utf8"),
  readFile(resolve(args["principal-seed"]), "utf8"),
]);
const artifacts = parseGenesisArtifacts({
  manifestText,
  signatureText,
  principalSeedText,
});
const reviewDigest = buildGenesisReviewDigest();
assertGenesisConfirmations({
  confirmedTarget: args["confirm-target"],
  confirmedManifestSha256: args["confirm-manifest-sha256"],
  confirmedBundleSha256: args["confirm-bundle-sha256"],
  actualManifestSha256: artifacts.manifestSha256,
  actualBundleSha256: reviewDigest.bundleSha256,
});
assertGenesisRepository({
  artifacts,
  deploymentManifestPath: args["deployment-manifest"],
  governanceReportPath: args["governance-report"],
  securityReviewPath: args["security-review"],
});

const result = await executeGenesis({
  connectionString: environment.HEADY_GENESIS_DATABASE_URL,
  neonApiKey: environment.NEON_API_KEY,
  receiptKeyVersionName: environment.HEADY_RECEIPT_KEY_VERSION,
  firebaseAuth: getAuth(
    getApps()[0] ?? initializeApp({ projectId: environment.FIREBASE_PROJECT_ID }),
  ),
  founderIdToken: environment.HEADY_FOUNDER_ID_TOKEN,
  artifacts,
});
process.stdout.write(`${JSON.stringify({
  ...result,
  reviewBundleSha256: reviewDigest.bundleSha256,
}, null, 2)}\n`);
