// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — entrypoint. Boots the app + handles signals ║
// ║  for graceful shutdown (Cloud Run sends SIGTERM). © 2026 Heady.     ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createApp } from "./app.mjs";

// Production composition root: the tasks service gets the LIVE vault resolver
// here (and only here) — createApp without it boots tasks in disabled mode, so
// tests/dev shells never implicitly touch a live database.
const { kernel, log, start } = createApp({
  tasks: {
    getDbPort: async () => {
      const { loadSecrets } = await import("@heady/secrets");
      const { createDbPort } = await import("@heady/db/port");
      const { DATABASE_URL } = await loadSecrets({ require: ["DATABASE_URL"] });
      return createDbPort({ connectionString: DATABASE_URL });
    },
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
