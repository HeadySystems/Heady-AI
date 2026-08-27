// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Sync Fabric — integration tests (real ws client)          ║
// ║  Covers: mandatory-auth upgrade rejection (401/503), welcome +    ║
// ║  context broadcast round-trip, session handoff store/resume,      ║
// ║  rate-limit kick (FIB[8] msg/s → close 1008), anonymized          ║
// ║  presence REST, debounced JSON persistence.                       ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import WebSocket from "ws";
import {
  createSyncFabric,
  sha256Digest,
  MAX_MESSAGES_PER_SECOND,
  MAX_MESSAGE_BYTES,
} from "../src/index.mjs";

const SYNC_TOKEN = "heady-sync-fabric-integration-credential-2026";
const USER = "founder-eric";

async function startFabric(t, fabricOpts = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), "heady-sync-fabric-"));
  const fabric = createSyncFabric({ tokenDigest: sha256Digest(SYNC_TOKEN), dataDir, log: () => {}, ...fabricOpts });
  const server = createServer();
  fabric.attachToServer(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  t.after(async () => {
    await fabric.close();
    await new Promise((resolve) => server.close(resolve));
  });
  return { fabric, port, dataDir };
}

function connect(port, { token = SYNC_TOKEN, deviceId, name, platform = "desktop", userId = USER } = {}) {
  const headers = { "x-device-platform": platform, "x-user-id": userId };
  if (deviceId !== undefined) headers["x-device-id"] = deviceId;
  if (name !== undefined) headers["x-device-name"] = name;
  if (token !== null) headers["x-sync-token"] = token;
  return new WebSocket(`ws://127.0.0.1:${port}/ws/sync`, { headers });
}

/** Promise-queue wrapper so tests can await the next parsed JSON frame. */
function frames(ws) {
  const queue = [];
  const waiters = [];
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(msg);
    else queue.push(msg);
  });
  return {
    next(label = "frame", ms = 5000) {
      if (queue.length > 0) return Promise.resolve(queue.shift());
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), ms);
        waiters.push({ resolve: (msg) => { clearTimeout(timer); resolve(msg); } });
      });
    },
  };
}

function upgradeRejection(ws) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for upgrade rejection")), 5000);
    ws.on("unexpected-response", (req, res) => { clearTimeout(timer); resolve(res.statusCode); });
    ws.on("open", () => { clearTimeout(timer); reject(new Error("upgrade unexpectedly accepted")); });
    ws.on("error", () => {}); // follows unexpected-response; rejection already captured
  });
}

async function openDevice(port, opts) {
  const ws = connect(port, opts);
  const inbox = frames(ws);
  const welcome = await inbox.next("welcome");
  assert.equal(welcome.type, "welcome");
  return { ws, inbox, welcome };
}

test("upgrade without a token is rejected 401 — auth is mandatory, never optional", async (t) => {
  const { fabric, port } = await startFabric(t);
  assert.equal((await upgradeRejection(connect(port, { token: null }))), 401);
  assert.equal(fabric.status().totals.rejected, 1);
});

test("upgrade with a wrong token is rejected 401", async (t) => {
  const { port } = await startFabric(t);
  assert.equal((await upgradeRejection(connect(port, { token: "definitely-not-the-armed-credential" }))), 401);
});

test("fail-closed: while the secrets loader cannot arm, every upgrade is 503", async (t) => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "heady-sync-fabric-"));
  const fabric = createSyncFabric({
    dataDir,
    log: () => {},
    secretsLoader: async () => { throw new Error("secret manager unreachable"); },
  });
  const server = createServer();
  fabric.attachToServer(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { await fabric.close(); await new Promise((r) => server.close(r)); });
  // let the arm attempt settle into "failed"
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(fabric.status().auth.state, "failed");
  assert.equal((await upgradeRejection(connect(server.address().port, {}))), 503);
});

test("welcome + shared-context broadcast round-trip between two authenticated devices", async (t) => {
  const { fabric, port } = await startFabric(t);
  const a = await openDevice(port, { deviceId: "device-desk-alpha", name: "Desk", platform: "desktop" });
  const b = await openDevice(port, { deviceId: "device-phone-beta", name: "Phone", platform: "android" });
  await a.inbox.next("device_connected for b"); // a is told b arrived

  a.ws.send(JSON.stringify({ type: "context_update", key: "active-task", value: { repo: "Heady-AI", branch: "feat/service-registry" } }));
  const updated = await b.inbox.next("context_updated");
  assert.equal(updated.type, "context_updated");
  assert.equal(updated.key, "active-task");
  assert.equal(updated.value.branch, "feat/service-registry");
  assert.equal(fabric.status().sharedContextKeys, 1);

  // a late-joining device receives the accumulated shared context in its welcome
  const c = await openDevice(port, { deviceId: "device-tab-gamma", name: "Tablet", platform: "ios" });
  assert.equal(c.welcome.sharedContext["active-task"].value.repo, "Heady-AI");
});

test("session handoff stores resumable context and resume returns it", async (t) => {
  const { fabric, port } = await startFabric(t);
  const a = await openDevice(port, { deviceId: "device-desk-alpha", name: "Desk", platform: "desktop" });
  const b = await openDevice(port, { deviceId: "device-phone-beta", name: "Phone", platform: "android" });
  await a.inbox.next("device_connected for b");

  const sessionData = { openFile: "packages/sync-fabric/src/index.mjs", cursorLine: 89, draft: "continue on phone" };
  a.ws.send(JSON.stringify({ type: "session_handoff", targetDeviceId: "device-phone-beta", sessionData }));

  const handoff = await b.inbox.next("session_handoff");
  assert.equal(handoff.type, "session_handoff");
  assert.equal(handoff.context.cursorLine, 89);
  const ack = await a.inbox.next("session_handoff_ack");
  assert.equal(ack.type, "session_handoff_ack");
  assert.equal(ack.sessionId, handoff.sessionId);
  assert.equal(fabric.status().sessions, 1);

  b.ws.send(JSON.stringify({ type: "session_resume", sessionId: handoff.sessionId }));
  const resumed = await b.inbox.next("session_resumed");
  assert.equal(resumed.type, "session_resumed");
  assert.equal(resumed.sessionId, handoff.sessionId);
  assert.deepEqual(resumed.context, sessionData);
});

test("session resume is refused for a different user's session", async (t) => {
  const { port } = await startFabric(t);
  const a = await openDevice(port, { deviceId: "device-desk-alpha", name: "Desk" });
  const b = await openDevice(port, { deviceId: "device-phone-beta", name: "Phone", userId: "other-teammate" });
  await a.inbox.next("device_connected for b");
  a.ws.send(JSON.stringify({ type: "session_handoff", targetDeviceId: "device-phone-beta", sessionData: { secretDraft: true } }));
  const handoff = await b.inbox.next("session_handoff");
  b.ws.send(JSON.stringify({ type: "session_resume", sessionId: handoff.sessionId }));
  const refusal = await b.inbox.next("resume refusal");
  assert.equal(refusal.type, "error");
  assert.match(refusal.error, /not owned/i);
});

test(`rate-limit kick: more than ${MAX_MESSAGES_PER_SECOND} msg/s closes the socket with 1008`, async (t) => {
  const { fabric, port } = await startFabric(t);
  const a = await openDevice(port, { deviceId: "device-blaster", name: "Blaster" });
  const closed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for rate-limit close")), 5000);
    a.ws.on("close", (code) => { clearTimeout(timer); resolve(code); });
  });
  for (let i = 0; i <= MAX_MESSAGES_PER_SECOND + 3; i++) {
    a.ws.send(JSON.stringify({ type: "heartbeat" }));
  }
  assert.equal(await closed, 1008);
  assert.equal(fabric.status().totals.kicked, 1);
});

test("presence REST route is read-only and anonymized (no names, no userIds, no raw ids)", async (t) => {
  const { fabric, port } = await startFabric(t);
  await openDevice(port, { deviceId: "device-desk-alpha", name: "Eric's Desk", platform: "desktop" });

  const routes = new Map();
  const appShim = { get: (routePath, handler) => routes.set(routePath, handler) };
  fabric.registerRoutes(appShim);
  assert.ok(routes.has("/api/sync/presence"));

  const payload = await new Promise((resolve) => routes.get("/api/sync/presence")({}, { json: resolve }));
  assert.equal(payload.ok, true);
  assert.equal(payload.deviceCount, 1);
  const entry = payload.presence[0];
  assert.equal(entry.platform, "desktop");
  assert.equal(entry.name, undefined);
  assert.equal(entry.userId, undefined);
  assert.notEqual(entry.id, "device-desk-alpha");
  assert.equal(entry.id.length, 12);
});

test("persistent user/workspace state lands in a debounced JSON file under the data dir", async (t) => {
  const { port, dataDir } = await startFabric(t);
  const a = await openDevice(port, { deviceId: "device-desk-alpha", name: "Desk" });
  a.ws.send(JSON.stringify({ type: "user_state_update", state: { theme: "sacred-geometry-dark" } }));
  a.ws.send(JSON.stringify({ type: "workspace_sync", snapshot: { vectorWorkspaceId: "heady-ai-main", openPanels: 3 } }));
  await new Promise((r) => setTimeout(r, 700)); // > FIB[13] ms debounce
  const stored = JSON.parse(readFileSync(path.join(dataDir, "state.json"), "utf8"));
  assert.equal(stored.users[USER].state.theme, "sacred-geometry-dark");
  assert.equal(stored.workspaces[USER].vectorWorkspaceId, "heady-ai-main");
  assert.ok(stored.lastUpdatedAt);
});

test("status() reports φ caps and event receipts", async (t) => {
  const { fabric, port } = await startFabric(t);
  await openDevice(port, { deviceId: "device-desk-alpha", name: "Desk" });
  const s = fabric.status();
  assert.equal(s.caps.maxMessageBytes, MAX_MESSAGE_BYTES);
  assert.equal(s.caps.maxMessagesPerSecond, MAX_MESSAGES_PER_SECOND);
  assert.ok(s.receipts >= 2); // auth_armed + attached + device_connected
  assert.ok(s.recentReceipts.some((r) => r.event === "device_connected"));
  assert.equal(s.auth.armed, true);
});
