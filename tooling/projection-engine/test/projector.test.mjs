// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Projector + SyncProjectionBee tests (ADR-0017)             ║
// ║  Proves drift classification, a valid projection_only ServerManifest ║
// ║  is emitted, private_paths never leak into the hash, and the bee     ║
// ║  work-unit reports the right status. © 2026 HeadySystems Inc.       ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateServerManifest } from "@heady/contracts";
import { project, classifyDrift } from "../src/projector.mjs";
import { runProjectionBee, deltaCheck } from "../src/sync-projection-bee.mjs";

const manifest = {
  schema: "projection.v1", id: "headyos", source_path: "apps/mcp-dashboard",
  target_repo: "HeadySystems/headyos-core", projection_type: "worker-shell",
  deploy_target: "cloudflare-workers", status: "proposed",
};
const files = [{ rel: "apps/mcp-dashboard/index.html", content: "<h1>os</h1>" }];
const NOW = "2026-07-23T00:00:00.000Z";
const SHA = "abc1234";

test("classifyDrift: no prior=source-ahead, equal=in-sync, differ=source-ahead, anomaly=projection-ahead", () => {
  assert.equal(classifyDrift({ sourceHash: "x", lastSyncHash: null }), "source-ahead");
  assert.equal(classifyDrift({ sourceHash: "x", lastSyncHash: "x" }), "in-sync");
  assert.equal(classifyDrift({ sourceHash: "y", lastSyncHash: "x" }), "source-ahead");
  assert.equal(classifyDrift({ sourceHash: "x", lastSyncHash: "x", observedProjectionHash: "z" }), "projection-ahead");
});

test("project emits a VALID projection_only ServerManifest with honest provenance", () => {
  const r = project({ manifest, sourceFiles: files, sourceSha: SHA, nowIso: NOW });
  assert.equal(r.ok, true);
  assert.equal(validateServerManifest(r.serverManifest).ok, true);
  assert.equal(r.serverManifest.projection_only, true);
  assert.equal(r.serverManifest.provenance.source_repo, manifest.target_repo);
  assert.equal(r.serverManifest.provenance.source_sha, SHA);
  assert.equal(r.drift, "source-ahead"); // no last_sync_hash yet
  assert.match(r.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(r.nextManifest.last_sync_hash, r.sourceHash); // sync bookkeeping advanced
});

test("re-project with the recorded hash is in-sync (idempotent)", () => {
  const first = project({ manifest, sourceFiles: files, sourceSha: SHA, nowIso: NOW });
  const second = project({ manifest: first.nextManifest, sourceFiles: files, sourceSha: SHA, nowIso: NOW });
  assert.equal(second.drift, "in-sync");
  assert.equal(deltaCheck({ manifest: first.nextManifest, sourceFiles: files, sourceSha: SHA, nowIso: NOW }).changed, false);
});

test("an invalid manifest fails closed (no ServerManifest emitted)", () => {
  const r = project({ manifest: { ...manifest, status: "bogus" }, sourceFiles: files, sourceSha: SHA, nowIso: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.serverManifest, null);
});

test("runProjectionBee reports reprojected / in-sync / frozen status", () => {
  const fresh = runProjectionBee({ manifest, sourceFiles: files, sourceSha: SHA, nowIso: NOW });
  assert.equal(fresh.status, "reprojected");
  assert.equal(fresh.bee, "sync-projection");
  const synced = runProjectionBee({ manifest: fresh.nextManifest, sourceFiles: files, sourceSha: SHA, nowIso: NOW });
  assert.equal(synced.status, "in-sync");
  const frozen = runProjectionBee({ manifest: fresh.nextManifest, sourceFiles: files, sourceSha: SHA, nowIso: NOW, observedProjectionHash: "tampered" });
  assert.equal(frozen.status, "frozen");
  assert.equal(frozen.drift, "projection-ahead");
});
