// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval API Composition Root v1.0.0                    ║
// ║  Vault, Neon, OPA, identity, KMS, and graceful shutdown wiring. ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { OAuth2Client } from "google-auth-library";
import { createLogger } from "@heady/logger";
import { loadSecrets } from "@heady/secrets";
import { createApprovalService, createPolicyEvaluator } from "@heady/approvals";
import { createApprovalApi } from "./app.mjs";
import { createAuthenticator } from "./auth.mjs";
import { loadConfig } from "./config.mjs";
import { createPgDatabase } from "./database.mjs";
import { createKmsReceiptSigner } from "./kms-signer.mjs";
import { createApprovalRuntime } from "./runtime.mjs";

let database = null;
let runtime = null;
let log = createLogger({
  level: "info",
  base: { service: "approval-api" },
});

async function bootstrap() {
  const config = loadConfig();
  log = createLogger({
    level: config.LOG_LEVEL,
    base: { service: "approval-api" },
  });
  const { DATABASE_URL } = await loadSecrets({
    source: "env",
    only: ["DATABASE_URL"],
    require: ["DATABASE_URL"],
  });
  database = createPgDatabase({ connectionString: DATABASE_URL });
  await database.assertRuntimeAuthority();
  const policyEvaluator = await createPolicyEvaluator();
  const signer = await createKmsReceiptSigner({
    keyVersionName: config.APPROVAL_KMS_KEY_VERSION,
  });
  const firebaseApp = getApps()[0] ?? initializeApp({ projectId: config.FIREBASE_PROJECT_ID });
  const authenticator = createAuthenticator({
    firebaseAuth: getAuth(firebaseApp),
    workloadClient: new OAuth2Client(),
    workloadAudience: config.APPROVAL_SERVICE_AUDIENCE,
  });
  const approvalService = createApprovalService({
    database,
    policyEvaluator,
    signer,
  });
  const api = createApprovalApi({
    approvalService,
    authenticator,
    database,
    log,
  });
  runtime = createApprovalRuntime({
    api,
    database,
    port: config.PORT,
    log,
  });
  await runtime.start();
}

try {
  await bootstrap();
} catch (error) {
  log.fatal({ err: String(error?.message ?? error) }, "approval API startup failed");
  if (database) {
    try {
      await database.end();
    } catch (cleanupError) {
      log.error({
        err: String(cleanupError?.message ?? cleanupError),
      }, "approval API startup cleanup failed");
    }
  }
  process.exitCode = 1;
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  const failed = signal === "unhandledRejection" || signal === "uncaughtException";
  log.info({ signal }, "approval API graceful shutdown");
  try {
    if (runtime) await runtime.stop();
    log.info({ signal }, "approval API shutdown complete");
    process.exitCode = failed ? 1 : 0;
  } catch (error) {
    log.error({ signal, err: String(error?.message ?? error) }, "approval API shutdown failed");
    process.exitCode = 1;
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("unhandledRejection", (reason) => {
  log.error({ reason: String(reason) }, "unhandled rejection");
  void shutdown("unhandledRejection");
});
process.on("uncaughtException", (error) => {
  log.fatal({ err: String(error?.message ?? error) }, "uncaught exception");
  void shutdown("uncaughtException");
});
