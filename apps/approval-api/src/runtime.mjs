// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval API Runtime v1.0.0                             ║
// ║  Latent Service Pattern lifecycle for the Cloud Run listener.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { HEALTH } from "@heady/shared";

export function createApprovalRuntime({ api, database, port, log }) {
  let server = null;

  return Object.freeze({
    async start() {
      if (server?.listening) return;
      await new Promise((resolve, reject) => {
        server = api.app.listen(port, "0.0.0.0"); // heady-allow:no-localhost — Cloud Run all-interface contract.
        server.once("listening", resolve);
        server.once("error", reject);
      });
      log.info({ port }, "approval API listening on all interfaces");
    },
    async stop() {
      if (server) {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
        });
      }
      server = null;
      await database.end();
    },
    async health() {
      const db = await api.health();
      return {
        status: server?.listening && db.ok ? HEALTH.OK : HEALTH.DOWN,
        checks: {
          listener: server?.listening ? HEALTH.OK : HEALTH.DOWN,
          neon: db.ok ? HEALTH.OK : HEALTH.DOWN,
        },
      };
    },
    metrics() {
      return {
        ...api.metrics(),
        listening: server?.listening === true,
      };
    },
  });
}
