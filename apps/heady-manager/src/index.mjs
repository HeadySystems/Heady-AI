// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — entrypoint. Boots the app + handles signals ║
// ║  for graceful shutdown (Cloud Run sends SIGTERM). © 2026 Heady.     ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createLogger } from "@heady/logger";
import { NatsBus } from "@heady/events";
import { createApp } from "./app.mjs";

// One logger for the composition root — shared with createApp so the embedder
// wiring and the app log to the same structured stream.
const log = createLogger({ base: { module: "heady-manager" } });

const { loadSecrets: loadRuntimeSecrets } = await import("@heady/secrets");
const nats = await loadRuntimeSecrets({
  only: ["NATS_SERVERS", "NATS_TOKEN", "NATS_USER", "NATS_PASS"],
  require: ["NATS_SERVERS"],
});
if (Boolean(nats.NATS_USER) !== Boolean(nats.NATS_PASS)) {
  throw new Error("NATS_USER and NATS_PASS must be configured together");
}
if (nats.NATS_TOKEN && nats.NATS_USER) {
  throw new Error("configure NATS_TOKEN or NATS_USER/NATS_PASS, not both");
}
const eventBus = new NatsBus({
  servers: nats.NATS_SERVERS,
  token: nats.NATS_TOKEN,
  user: nats.NATS_USER,
  pass: nats.NATS_PASS,
  name: `heady-manager-${process.env.K_REVISION ?? "unknown-revision"}`,
  log,
});

// Live DbPort factory (vault-resolved). Shared shape used by both write paths
// (tasks) and the 990 read plane — each service owns its own connection lifecycle.
const liveDbPort = async () => {
  const { loadSecrets } = await import("@heady/secrets");
  const { createDbPort } = await import("@heady/db/port");
  const { DATABASE_URL } = await loadSecrets({ require: ["DATABASE_URL"] });
  return createDbPort({ connectionString: DATABASE_URL });
};

const liveInternalSecret = async () => {
  const { loadSecrets } = await import("@heady/secrets");
  const { INTERNAL_NODE_SECRET } = await loadSecrets({ only: ["INTERNAL_NODE_SECRET"], require: ["INTERNAL_NODE_SECRET"] });
  return INTERNAL_NODE_SECRET;
};

// 990 query embedder (hybrid search). The Cloud Run origin has no Workers-AI
// binding, so it embeds queries over the CF REST API — activated ONLY when the
// account id + token are present in the vault. Absent ⇒ null ⇒ keyword-only
// (honest degrade; never throws the boot). Resolved once, eagerly.
let embedQuery = null;
let mcpBearerToken = null;
try {
  const { loadSecrets } = await import("@heady/secrets");
  const resolved = await loadSecrets({ only: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_EMAIL", "HEADY_MCP_BEARER"] });
  mcpBearerToken = resolved.HEADY_MCP_BEARER ?? null;
  const cf = resolved;
  if (cf.CLOUDFLARE_ACCOUNT_ID && cf.CLOUDFLARE_API_TOKEN) {
    const { createWorkersAiQueryEmbedder } = await import("./embed-query.mjs");
    embedQuery = createWorkersAiQueryEmbedder({
      accountId: cf.CLOUDFLARE_ACCOUNT_ID,
      apiToken: cf.CLOUDFLARE_API_TOKEN,
      email: cf.CLOUDFLARE_EMAIL ?? null,
      log,
    });
    log.info({}, "heady990: Workers-AI query embedder wired — hybrid search active");
  } else {
    log.info({}, "heady990: no Workers-AI creds — keyword-only search");
  }
} catch (err) {
  log.warn({ err: String(err?.message ?? err) }, "heady990: embedder wiring failed — keyword-only search");
}

// Production composition root: the tasks service gets the LIVE vault resolver
// here (and only here) — createApp without it boots tasks in disabled mode, so
// tests/dev shells never implicitly touch a live database.
const { kernel, start } = createApp({
  logger: log,
  eventBus,
  tasks: { getDbPort: liveDbPort },
  nodes: { getDbPort: liveDbPort, getInternalSecret: liveInternalSecret },
  heady990: { getDbPort: liveDbPort, embedQuery },
  mcp: {
    getDbPort: liveDbPort,
    embedQuery,
    bearerToken: mcpBearerToken,
    tenantId: process.env.HEADY_MCP_TENANT_ID ?? null,
    allowedHosts: (process.env.HEADY_MCP_ALLOWED_HOSTS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    allowedOrigins: (process.env.HEADY_MCP_ALLOWED_ORIGINS ?? process.env.HEADY_MCP_ALLOWED_HOSTS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  },
  console: {
    // Vault resolver for `vault` probes (the live token lifecycle): resolves
    // ONLY the names the registry declares; absent optional secrets resolve
    // to undefined (the probe reports not_connected honestly, never throws).
    resolveSecrets: async (names) => {
      const { loadSecrets } = await import("@heady/secrets");
      return loadSecrets({ only: names });
    },
  },
});

await start();
const port = Number(process.env.PORT) || 3300;
log.info({ port, tier: "origin", transport: "http" }, "heady-manager listening on all interfaces");

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, "graceful shutdown");
  const errors = await kernel.shutdown();
  if (errors.length) { log.error({ errors: errors.map((e) => e.service) }, "shutdown errors"); process.exit(1); }
  log.info("shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => { log.error({ reason: String(reason) }, "unhandledRejection"); });
