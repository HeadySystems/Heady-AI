// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ projection-shapes tests — ADR-0017 contract is real        ║
// ║  Proves the manifest validator enforces required fields + strict    ║
// ║  unknowns, and the lifecycle transition rule is forward-only        ║
// ║  except deprecated→active. © 2026 HeadySystems Inc.                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateProjectionManifest, isLegalProjectionTransition,
  PROJECTION_STATES, DRIFT_STATES,
} from "../src/projection-shapes.mjs";

const ok = {
  schema: "projection.v1", id: "headyos", source_path: "apps/mcp-dashboard",
  target_repo: "HeadySystems/headyos-core", projection_type: "worker-shell",
  deploy_target: "cloudflare-workers", status: "proposed",
};

test("accepts a minimal valid projection manifest", () => {
  assert.equal(validateProjectionManifest(ok).ok, true);
});

test("rejects missing required fields, bad enums, and non-objects", () => {
  assert.equal(validateProjectionManifest(null).ok, false);
  assert.equal(validateProjectionManifest({ ...ok, schema: "x" }).ok, false);
  assert.equal(validateProjectionManifest({ ...ok, id: "Bad_ID" }).ok, false);
  assert.equal(validateProjectionManifest({ ...ok, projection_type: "nope" }).ok, false);
  assert.equal(validateProjectionManifest({ ...ok, status: "live" }).ok, false);
  const noSrc = { ...ok }; delete noSrc.source_path;
  assert.equal(validateProjectionManifest(noSrc).ok, false);
});

test("strict: unknown fields and malformed optionals are rejected", () => {
  assert.equal(validateProjectionManifest({ ...ok, rogue: 1 }).ok, false);
  assert.equal(validateProjectionManifest({ ...ok, live_url: "http://x" }).ok, false); // not https
  assert.equal(validateProjectionManifest({ ...ok, last_sync_hash: "deadbeef" }).ok, false); // not sha256
  assert.equal(validateProjectionManifest({ ...ok, last_sync_hash: "a".repeat(64) }).ok, true);
});

test("lifecycle is forward-only except the single deprecated→active reversal", () => {
  assert.equal(isLegalProjectionTransition("proposed", "scaffolded"), true);
  assert.equal(isLegalProjectionTransition("scaffolded", "active"), true);
  assert.equal(isLegalProjectionTransition("active", "deprecated"), true);
  assert.equal(isLegalProjectionTransition("deprecated", "active"), true); // allowed reversal
  assert.equal(isLegalProjectionTransition("deprecated", "archived"), true);
  assert.equal(isLegalProjectionTransition("archived", "eliminated"), true);
  // illegal jumps / backward
  assert.equal(isLegalProjectionTransition("proposed", "active"), false);
  assert.equal(isLegalProjectionTransition("active", "proposed"), false);
  assert.equal(isLegalProjectionTransition("eliminated", "active"), false);
  assert.equal(isLegalProjectionTransition("bogus", "active"), false);
});

test("state + drift enums are frozen and complete", () => {
  assert.deepEqual([...PROJECTION_STATES], ["proposed", "scaffolded", "active", "deprecated", "archived", "eliminated"]);
  assert.deepEqual([...DRIFT_STATES], ["in-sync", "source-ahead", "projection-ahead"]);
  assert.throws(() => { PROJECTION_STATES.push("x"); });
});
