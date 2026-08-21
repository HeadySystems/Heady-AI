// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Cloud Maintenance Policy Tests v1.0.0                   ║
// ║  Verifies read-only ephemeral-filesystem posture and readiness. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createMaintenanceService, FILESYSTEM_POLICY } from "../src/maintenance.mjs";

test("filesystem policy forbids local audit storage and runtime mutation", () => {
  assert.equal(FILESYSTEM_POLICY.runtimeFilesystem, "ephemeral");
  assert.equal(FILESYSTEM_POLICY.localMutationEnabled, false);
  assert.equal(FILESYSTEM_POLICY.localAuditStorageAllowed, false);
  assert.equal(FILESYSTEM_POLICY.durableAuditAuthority, "neon.task_outbox");
});

test("maintenance endpoint fails production readiness closed", async () => {
  const maintenance = createMaintenanceService({
    nodesReadiness: () => ({ productionReady: false, blockers: ["worker fleet unavailable"] }),
  });
  const app = express();
  maintenance.routes(app);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/maintenance/health`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.productionReady, false);
    assert.equal(body.filesystem.localMutationEnabled, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
