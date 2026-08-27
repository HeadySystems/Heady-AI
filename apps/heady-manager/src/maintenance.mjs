// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Cloud Maintenance Policy v1.0.0                         ║
// ║  Read-only runtime maintenance health for ephemeral Cloud Run;  ║
// ║  durable records remain in Neon and are never locally pruned.    ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { HEALTH } from "@heady/shared";

export const FILESYSTEM_POLICY = Object.freeze({
  runtimeFilesystem: "ephemeral",
  localMutationEnabled: false,
  localAuditStorageAllowed: false,
  durableTaskAuthority: "neon.task",
  durableAuditAuthority: "neon.task_outbox",
  cleanupStrategy: "immutable-image-replacement",
  logStrategy: "structured-stdout",
});

export function createMaintenanceService({ nodesReadiness } = {}) {
  const service = {
    name: "maintenance",
    deps: ["nodes"],
    start: async () => {},
    stop: async () => {},
    health: async () => ({ status: HEALTH.OK, policy: FILESYSTEM_POLICY }),
    metrics: async () => ({ localMutations: 0, localAuditFiles: 0 }),
  };

  function routes(app) {
    app.get("/api/maintenance/health", (_req, res) => {
      const orchestration = nodesReadiness?.() ?? null;
      const productionReady = orchestration?.productionReady === true;
      return res.status(productionReady ? 200 : 503).json({
        status: productionReady ? HEALTH.OK : HEALTH.DEGRADED,
        filesystem: FILESYSTEM_POLICY,
        orchestration,
        productionReady,
        timestamp: new Date().toISOString(),
      });
    });
  }

  return { service, routes };
}
