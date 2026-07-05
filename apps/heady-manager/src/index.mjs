// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — entrypoint. Boots the app + handles signals ║
// ║  for graceful shutdown (Cloud Run sends SIGTERM). © 2026 Heady.     ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createApp } from "./app.mjs";

const { kernel, log, start } = createApp();

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
