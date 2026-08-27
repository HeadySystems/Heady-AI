// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Founder Ceremony Terminal v1.0.0                       ║
// ║  Ephemeral identity-checked shell for human stage-0 operations. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { z } from "zod";
import {
  FOUNDER_FIREBASE_EMAILS,
  FOUNDER_FIREBASE_PROJECT_ID,
  signInFounderWithPassword,
  verifyFounderIdToken,
} from "../src/founder-firebase-auth.mjs";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FOUNDER_EMAILS = FOUNDER_FIREBASE_EMAILS;
const FOUNDER_GPG_FINGERPRINT = "1050B59E7296C46C26DDF95DA7D2108BB3C6101C";
const CANONICAL_BRANCH = "origin/checkpoint/rebuild-substrate-2026-07-23";
const KEY_VERSION_RE = /^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+\/cryptoKeyVersions\/[1-9]\d*$/;
const FIREBASE_APP_NAME = "heady-founder-terminal";

const ArgumentsSchema = z.object({
  check: z.boolean(),
  keyVersionName: z.string().regex(KEY_VERSION_RE),
  firebaseEmail: z.enum(FOUNDER_EMAILS).optional(),
}).strict();
const FirebaseEnvironmentSchema = z.object({
  FIREBASE_PROJECT_ID: z.literal(FOUNDER_FIREBASE_PROJECT_ID),
  FIREBASE_WEB_API_KEY: z.string().min(21),
  HEADY_FOUNDER_ID_TOKEN: z.string().min(89).optional(),
}).passthrough();

function parseArguments(values) {
  if (values.includes("--help")) return { help: true };
  const check = values.includes("--check");
  const keyIndex = values.indexOf("--key-version");
  const emailIndex = values.indexOf("--firebase-email");
  const keyVersionName = keyIndex >= 0 ? values[keyIndex + 1] : process.env.HEADY_FOUNDER_KEY_VERSION;
  const firebaseEmail = emailIndex >= 0 ? values[emailIndex + 1] : undefined;
  const consumed = new Set([
    ...(check ? [values.indexOf("--check")] : []),
    ...(keyIndex >= 0 ? [keyIndex, keyIndex + 1] : []),
    ...(emailIndex >= 0 ? [emailIndex, emailIndex + 1] : []),
  ]);
  if (values.some((_, index) => !consumed.has(index))) {
    throw new TypeError(
      "founder terminal accepts only --check, --key-version, and --firebase-email",
    );
  }
  return ArgumentsSchema.parse({ check, keyVersionName, firebaseEmail });
}

function execute(program, args, { ignoreStdout = false } = {}) {
  const output = execFileSync(program, args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", ignoreStdout ? "ignore" : "pipe", "pipe"],
  });
  return ignoreStdout ? "" : output.trim();
}

function requireEqual(actual, expected, message) {
  if (actual !== expected) throw new TypeError(message);
}

function preflight(keyVersionName) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new TypeError("founder terminal rejects GOOGLE_APPLICATION_CREDENTIALS service-account override");
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new TypeError("founder terminal requires an interactive TTY");
  }

  const implementationCommit = execute("git", ["rev-parse", `${CANONICAL_BRANCH}^{commit}`]);
  const worktreeCommit = execute("git", ["rev-parse", "HEAD^{commit}"]);
  execute("git", ["tag", "--verify", "adr-0031-accepted-e064a8943"], { ignoreStdout: true });

  const founderEmail = execute(
    "gcloud",
    ["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"],
  );
  if (!FOUNDER_EMAILS.includes(founderEmail)) {
    throw new TypeError(`active gcloud account must be one of ${FOUNDER_EMAILS.join(", ")}`);
  }
  const impersonatedAccount = execute(
    "gcloud",
    ["config", "get-value", "auth/impersonate_service_account"],
  );
  if (![("(unset)"), ""].includes(impersonatedAccount)) {
    throw new TypeError("founder terminal rejects gcloud service-account impersonation");
  }
  execute("gcloud", ["auth", "application-default", "print-access-token"], { ignoreStdout: true });

  const secretKeys = execute("gpg", [
    "--batch",
    "--with-colons",
    "--list-secret-keys",
    FOUNDER_GPG_FINGERPRINT,
  ]);
  if (!secretKeys.includes(`fpr:::::::::${FOUNDER_GPG_FINGERPRINT}:`)) {
    throw new TypeError("pinned founder OpenPGP secret key is unavailable");
  }

  const publicKeyRecord = JSON.parse(execute("node", [
    "apps/approval-api/bin/export-kms-public-jwk.mjs",
    "--key-version",
    keyVersionName,
  ]));
  if (
    publicKeyRecord.keyVersionName !== keyVersionName
    || publicKeyRecord.publicJwk?.kty !== "OKP"
    || publicKeyRecord.publicJwk?.crv !== "Ed25519"
    || Object.hasOwn(publicKeyRecord.publicJwk ?? {}, "d")
  ) {
    throw new TypeError("founder KMS key-version public metadata failed validation");
  }

  return Object.freeze({
    gcloudFounderEmail: founderEmail,
    founderGpgFingerprint: FOUNDER_GPG_FINGERPRINT,
    founderKmsKeyVersion: keyVersionName,
    founderKmsPublicFingerprint: publicKeyRecord.fingerprint,
    implementationCommit,
    worktreeCommit,
  });
}

async function hiddenPassword() {
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let password;
  let questionError;
  execFileSync("stty", ["-echo"], { stdio: ["inherit", "ignore", "inherit"] });
  try {
    password = await terminal.question("Firebase founder password: ");
  } catch (error) {
    questionError = error;
  }
  try {
    execFileSync("stty", ["echo"], { stdio: ["inherit", "ignore", "inherit"] });
  } catch (restoreError) {
    terminal.close();
    process.stdout.write("\n");
    if (questionError) {
      throw new AggregateError(
        [questionError, restoreError],
        "Firebase password prompt and terminal-echo restoration both failed",
      );
    }
    throw restoreError;
  }
  terminal.close();
  process.stdout.write("\n");
  if (questionError) throw questionError;
  return password;
}

function founderFirebaseAdmin() {
  const app = getApps().find((candidate) => candidate.name === FIREBASE_APP_NAME)
    ?? initializeApp({ projectId: FOUNDER_FIREBASE_PROJECT_ID }, FIREBASE_APP_NAME);
  return getAuth(app);
}

async function authenticateFounder({
  firebaseEmail,
  environment,
}) {
  const firebaseAuth = founderFirebaseAdmin();
  if (environment.HEADY_FOUNDER_ID_TOKEN) {
    return verifyFounderIdToken({
      firebaseAuth,
      idToken: environment.HEADY_FOUNDER_ID_TOKEN,
      expectedEmail: firebaseEmail,
    });
  }
  let password = await hiddenPassword();
  try {
    return await signInFounderWithPassword({
      firebaseAuth,
      apiKey: environment.FIREBASE_WEB_API_KEY,
      email: firebaseEmail,
      password,
    });
  } finally {
    password = "";
  }
}

async function main() {
  const values = process.argv.slice(2);
  const args = parseArguments(values[0] === "--" ? values.slice(1) : values);
  if (args.help) {
    process.stdout.write(
      "Usage: pnpm --filter @heady/approval-api founder:terminal -- "
      + "--key-version projects/.../cryptoKeyVersions/N "
      + "[--firebase-email eric@headyconnection.org] [--check]\n",
    );
    return 0;
  }

  const context = preflight(args.keyVersionName);
  if (args.check) {
    process.stdout.write(`${JSON.stringify({
      t: "founder-terminal",
      level: "info",
      msg: "founder terminal preflight passed",
      ...context,
    })}\n`);
    return 0;
  }
  const firebaseEnvironment = FirebaseEnvironmentSchema.parse(process.env);
  const firebaseEmail = args.firebaseEmail ?? context.gcloudFounderEmail;
  const founderAuth = await authenticateFounder({
    firebaseEmail,
    environment: firebaseEnvironment,
  });
  process.stdout.write(`${JSON.stringify({
    t: "founder-terminal",
    level: "info",
    msg: "opening revoked-aware founder ceremony shell",
    ...context,
    firebaseProjectId: FOUNDER_FIREBASE_PROJECT_ID,
    firebaseFounderEmail: founderAuth.email,
    firebaseFounderUid: founderAuth.uid,
    firebaseAuthenticatedAt: founderAuth.authenticatedAt,
  })}\n`);

  const environment = { ...process.env };
  delete environment.BASH_ENV;
  delete environment.ENV;
  delete environment.GOOGLE_APPLICATION_CREDENTIALS;
  Object.assign(environment, {
    HEADY_FOUNDER_TERMINAL: "1",
    HEADY_FOUNDER_EMAIL: founderAuth.email,
    HEADY_FOUNDER_UID: founderAuth.uid,
    HEADY_FOUNDER_ID_TOKEN: founderAuth.idToken,
    HEADY_GCLOUD_FOUNDER_EMAIL: context.gcloudFounderEmail,
    HEADY_FOUNDER_GPG_FINGERPRINT: FOUNDER_GPG_FINGERPRINT,
    HEADY_FOUNDER_KEY_VERSION: args.keyVersionName,
    HEADY_IMPLEMENTATION_COMMIT: context.implementationCommit,
    HISTCONTROL: "ignoreboth:erasedups",
    HISTFILE: "/dev/null",
    PS1: "[HEADY FOUNDER · STAGE-0] \\w\\n$ ",
  });

  const shell = spawnSync("/bin/bash", ["--noprofile", "--norc", "-i"], {
    cwd: REPOSITORY_ROOT,
    env: environment,
    stdio: "inherit",
  });
  if (shell.error) throw shell.error;
  return shell.status ?? 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    t: "founder-terminal",
    level: "error",
    msg: error instanceof Error ? error.message : String(error),
    remediation: [
      `run gcloud auth login with one founder identity: ${FOUNDER_EMAILS.join(" or ")}`,
      "run gcloud auth application-default login",
      `set FIREBASE_PROJECT_ID=${FOUNDER_FIREBASE_PROJECT_ID} and FIREBASE_WEB_API_KEY`,
      "use --firebase-email when the Firebase founder alias differs from active gcloud",
      `ensure ${CANONICAL_BRANCH} resolves to the approved implementation commit`,
      "pass the full immutable founder Cloud KMS crypto-key-version name",
    ],
  })}\n`);
  process.exitCode = 1;
}
