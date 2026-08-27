// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Sync Fabric v1.0.0 — Buddy Everywhere, hardened           ║
// ║  Clean ESM port of the legacy CrossDeviceSyncHub (src/            ║
// ║  cross-device-sync.js) with auth made MANDATORY and every cap     ║
// ║  φ-derived. Five objects: devices · sessions (resumable handoff)  ║
// ║  · sharedContext · persistent user/workspace state (debounced     ║
// ║  JSON under .data/sync-fabric/) · event receipts.                 ║
// ║  Transport: /ws/sync upgrade via `ws`. Fail-closed: upgrades are  ║
// ║  503 until the SYNC_TOKEN digest arms, 401 on mismatch.           ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import path from "node:path";
import { WebSocketServer } from "ws";
import { FIB, HEARTBEAT_MS } from "@heady/phi-math";

// ─── φ-derived hard caps (AGENTS.md #8 — zero magic numbers) ────────────────
export const SYNC_PATH = "/ws/sync";
export const MAX_MESSAGE_BYTES = FIB[13] * 1024; //        233 KB per frame
export const MAX_MESSAGES_PER_SECOND = FIB[8]; //          21 msg/s per device
export const HEARTBEAT_TIMEOUT_MS = HEARTBEAT_MS * 2; //   2·φ⁷s ≈ 58 068 ms
export const PERSIST_DEBOUNCE_MS = FIB[13]; //             233 ms write debounce
export const RECEIPT_CAPACITY = FIB[12]; //                144 receipts retained
const RATE_WINDOW_MS = 1000; // the unit of the msg/s cap, not a tunable

/** sha256 digest of a credential string — both sides of every comparison are
 *  digested so lengths always match and raw values are never retained. */
export function sha256Digest(value) {
  return createHash("sha256").update(String(value), "utf8").digest();
}

const anonId = (deviceId) => createHash("sha256").update(String(deviceId), "utf8").digest("hex").slice(0, 12);

/**
 * Create a hardened cross-device sync fabric.
 *
 * @param {object} opts
 * @param {Buffer}   [opts.tokenDigest]   32-byte sha256 digest of SYNC_TOKEN (arms synchronously).
 * @param {Function} [opts.secretsLoader] async () => ({ SYNC_TOKEN }) — defaults to the fail-closed
 *                                        @heady/secrets loader. One of tokenDigest/secretsLoader paths
 *                                        MUST arm or every upgrade stays rejected (fail-closed).
 * @param {Function} [opts.log]           structured log hook — receives { event, ...meta }.
 * @param {string}   [opts.dataDir]       persistent-state dir (default <cwd>/.data/sync-fabric).
 * @param {number}   [opts.heartbeatTimeoutMs] stale-device cutoff (default 2·φ⁷s).
 * @param {number}   [opts.sweepIntervalMs]    stale sweep cadence (default φ⁷s).
 * @param {number}   [opts.persistDebounceMs]  state write debounce (default FIB[13] ms).
 * @returns {{ attachToServer, registerRoutes, status, close, on, events }}
 */
export function createSyncFabric(opts = {}) {
  const log = typeof opts.log === "function" ? opts.log : () => {};
  const events = new EventEmitter();
  const dataDir = opts.dataDir || path.join(process.cwd(), ".data", "sync-fabric");
  const storePath = path.join(dataDir, "state.json");
  const heartbeatTimeoutMs = opts.heartbeatTimeoutMs ?? HEARTBEAT_TIMEOUT_MS;
  const sweepIntervalMs = opts.sweepIntervalMs ?? HEARTBEAT_MS;
  const persistDebounceMs = opts.persistDebounceMs ?? PERSIST_DEBOUNCE_MS;

  // ── The five fabric objects ────────────────────────────────────────────────
  const devices = new Map(); //       deviceId → { ws, name, platform, userId, connectedAt, lastSeen }
  const sessions = new Map(); //      sessionId → { userId, fromDeviceId, targetDeviceId, context, startedAt, resumedAt, resumedBy }
  const sharedContext = new Map(); // key → { value, updatedBy, updatedAt }
  let persistent = { users: {}, workspaces: {}, lastUpdatedAt: null }; // debounced JSON store
  const receipts = []; //             ring buffer of { id, event, ts, meta }

  const totals = { messages: 0, rejected: 0, kicked: 0 };
  const rateWindows = new Map(); // deviceId → { windowStartMs, count }
  let wss = null;
  let sweepTimer = null;
  let persistTimer = null;
  let closed = false;

  // ── Auth: token REQUIRED, always. Fail-closed until armed. ────────────────
  const auth = { state: "pending", digest: null, error: null };
  if (opts.tokenDigest) {
    if (!Buffer.isBuffer(opts.tokenDigest) || opts.tokenDigest.length !== 32) {
      throw new TypeError("createSyncFabric: tokenDigest must be a 32-byte sha256 digest Buffer");
    }
    auth.digest = opts.tokenDigest;
    auth.state = "ready";
    receipt("auth_armed", { via: "tokenDigest" });
  } else {
    const loader = opts.secretsLoader ??
      (async () => (await import("@heady/secrets")).loadSecrets({ only: ["SYNC_TOKEN"], require: ["SYNC_TOKEN"] }));
    Promise.resolve()
      .then(async () => {
        const secrets = await loader();
        const token = secrets?.SYNC_TOKEN;
        if (typeof token !== "string" || token.length < 20) {
          throw new Error("SYNC_TOKEN missing or shorter than the registry minimum (20)");
        }
        auth.digest = sha256Digest(token);
        auth.state = "ready";
        receipt("auth_armed", { via: "secretsLoader" });
      })
      .catch((err) => {
        auth.state = "failed";
        auth.error = String(err?.message || err);
        receipt("auth_arm_failed", { error: auth.error });
      });
  }

  function receipt(event, meta = {}) {
    const entry = { id: randomUUID(), event, ts: Date.now(), meta };
    receipts.push(entry);
    if (receipts.length > RECEIPT_CAPACITY) receipts.splice(0, receipts.length - RECEIPT_CAPACITY);
    log({ event: `sync-fabric.${event}`, ...meta });
    events.emit(event, entry);
    return entry;
  }

  // ── Persistence (durable user/workspace state only — never socket internals)
  try {
    if (existsSync(storePath)) {
      const loaded = JSON.parse(readFileSync(storePath, "utf8"));
      persistent = { users: loaded.users || {}, workspaces: loaded.workspaces || {}, lastUpdatedAt: loaded.lastUpdatedAt || null };
    }
  } catch (err) {
    receipt("persist_load_failed", { error: String(err?.message || err) });
  }

  function flushPersist() {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    try {
      mkdirSync(dataDir, { recursive: true });
      persistent.lastUpdatedAt = new Date().toISOString();
      writeFileSync(storePath, JSON.stringify(persistent));
    } catch (err) {
      receipt("persist_write_failed", { error: String(err?.message || err) });
    }
  }

  function schedulePersist() {
    if (persistTimer) return;
    persistTimer = setTimeout(() => { persistTimer = null; flushPersist(); }, persistDebounceMs);
    if (typeof persistTimer.unref === "function") persistTimer.unref();
  }

  const userSlot = (userId) => (persistent.users[userId] ??= {});

  // ── Transport helpers ──────────────────────────────────────────────────────
  function send(ws, message) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
  }

  function broadcast(excludeDeviceId, message) {
    for (const [deviceId, device] of devices) {
      if (deviceId !== excludeDeviceId) send(device.ws, message);
    }
  }

  function deviceList() {
    return Array.from(devices, ([id, d]) => ({
      id: id.slice(0, 12), name: d.name, platform: d.platform, userId: d.userId,
      connectedAt: d.connectedAt, lastSeen: d.lastSeen,
    }));
  }

  /** 503 while unarmed (or after a failed arm), 401 on missing/mismatched token. */
  function authorizeUpgrade(req) {
    if (auth.state !== "ready" || !auth.digest) return { ok: false, code: 503, reason: "sync auth unavailable — fail-closed" };
    const header = req.headers["x-sync-token"] ||
      (String(req.headers.authorization || "").startsWith("Bearer ") ? String(req.headers.authorization).slice(7) : "");
    if (!header || !timingSafeEqual(sha256Digest(header), auth.digest)) {
      return { ok: false, code: 401, reason: "unauthorized" };
    }
    return { ok: true };
  }

  function rejectUpgrade(socket, code, reason) {
    totals.rejected++;
    receipt("unauthorized_upgrade", { code, reason });
    const text = code === 503 ? "Service Unavailable" : "Unauthorized";
    socket.once("error", () => {}); // client may RST after the refusal — never crash the host
    socket.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }

  /** true ⇒ the message was rejected (size) or the device was kicked (rate). */
  function enforceCaps(deviceId, raw) {
    const device = devices.get(deviceId);
    const size = typeof raw?.length === "number" ? raw.length : Buffer.byteLength(String(raw), "utf8");
    if (size > MAX_MESSAGE_BYTES) {
      totals.rejected++;
      receipt("message_too_large", { device: anonId(deviceId), size });
      send(device?.ws, { type: "error", error: `Message exceeds ${MAX_MESSAGE_BYTES} bytes` });
      device?.ws.close(1009, "message too large");
      return true;
    }
    const now = Date.now();
    const win = rateWindows.get(deviceId) || { windowStartMs: now, count: 0 };
    if (now - win.windowStartMs >= RATE_WINDOW_MS) { win.windowStartMs = now; win.count = 0; }
    win.count++;
    rateWindows.set(deviceId, win);
    if (win.count > MAX_MESSAGES_PER_SECOND) {
      totals.kicked++;
      receipt("rate_limit_kick", { device: anonId(deviceId), perSecond: win.count });
      send(device?.ws, { type: "error", error: `Rate cap ${MAX_MESSAGES_PER_SECOND} msg/s exceeded — disconnecting` });
      device?.ws.close(1008, "rate limit exceeded");
      unregisterDevice(deviceId); // evict now — trailing frames from the closing socket are dropped
      return true;
    }
    return false;
  }

  // ── Device lifecycle ───────────────────────────────────────────────────────
  function registerDevice(deviceId, ws, meta) {
    devices.set(deviceId, { ws, ...meta, connectedAt: Date.now(), lastSeen: Date.now() });
    send(ws, {
      type: "welcome",
      deviceId,
      connectedDevices: deviceList(),
      sharedContext: Object.fromEntries(sharedContext),
      personalState: persistent.users[meta.userId] || {},
      workspaceState: persistent.workspaces[meta.userId] || {},
    });
    broadcast(deviceId, {
      type: "device_connected",
      device: { id: deviceId.slice(0, 12), name: meta.name, platform: meta.platform },
      connectedDevices: deviceList(),
    });
    receipt("device_connected", { device: anonId(deviceId), platform: meta.platform });
  }

  function unregisterDevice(deviceId) {
    const device = devices.get(deviceId);
    devices.delete(deviceId);
    rateWindows.delete(deviceId);
    if (!device) return;
    broadcast(null, { type: "device_disconnected", deviceId: deviceId.slice(0, 12), connectedDevices: deviceList() });
    receipt("device_disconnected", { device: anonId(deviceId), platform: device.platform });
  }

  // ── Message protocol ───────────────────────────────────────────────────────
  function handleMessage(deviceId, msg) {
    totals.messages++;
    const device = devices.get(deviceId);
    if (!device) return;
    device.lastSeen = Date.now();

    switch (msg.type) {
      case "heartbeat":
        send(device.ws, { type: "heartbeat_ack", ts: Date.now() });
        break;

      case "context_update": {
        if (!msg.key || msg.value === undefined) {
          send(device.ws, { type: "error", error: "context_update needs key and value" });
          break;
        }
        sharedContext.set(msg.key, { value: msg.value, updatedBy: deviceId, updatedAt: Date.now() });
        broadcast(deviceId, { type: "context_updated", key: msg.key, value: msg.value, updatedBy: deviceId.slice(0, 12) });
        const slot = userSlot(device.userId);
        slot.context = { ...slot.context, [msg.key]: msg.value };
        slot.contextUpdatedAt = Date.now();
        schedulePersist();
        receipt("context_updated", { device: anonId(deviceId), key: msg.key });
        break;
      }

      case "session_handoff": {
        const target = devices.get(msg.targetDeviceId);
        if (!target) {
          send(device.ws, { type: "error", error: `Target device ${String(msg.targetDeviceId).slice(0, 12)} not connected` });
          break;
        }
        const sessionId = randomUUID();
        sessions.set(sessionId, {
          userId: device.userId,
          fromDeviceId: deviceId,
          targetDeviceId: msg.targetDeviceId,
          context: msg.sessionData ?? {},
          startedAt: Date.now(),
          resumedAt: null,
          resumedBy: null,
        });
        send(target.ws, { type: "session_handoff", sessionId, from: deviceId.slice(0, 12), context: msg.sessionData ?? {} });
        send(device.ws, { type: "session_handoff_ack", sessionId, to: String(msg.targetDeviceId).slice(0, 12) });
        receipt("session_handoff", { session: sessionId, from: anonId(deviceId), to: anonId(msg.targetDeviceId) });
        break;
      }

      case "session_resume": {
        const session = sessions.get(msg.sessionId);
        if (!session || session.userId !== device.userId) {
          send(device.ws, { type: "error", error: "Unknown session or not owned by this user" });
          break;
        }
        session.resumedAt = Date.now();
        session.resumedBy = deviceId;
        send(device.ws, { type: "session_resumed", sessionId: msg.sessionId, context: session.context, from: session.fromDeviceId.slice(0, 12) });
        receipt("session_resumed", { session: msg.sessionId, device: anonId(deviceId) });
        break;
      }

      case "relay_event": {
        if (msg.targetDeviceId) {
          const target = devices.get(msg.targetDeviceId);
          if (target) send(target.ws, { type: "event", from: deviceId.slice(0, 12), event: msg.event, data: msg.data });
        } else {
          broadcast(deviceId, { type: "event", from: deviceId.slice(0, 12), event: msg.event, data: msg.data });
        }
        receipt("event_relayed", { device: anonId(deviceId), relayed: msg.event });
        break;
      }

      case "get_devices":
        send(device.ws, { type: "device_list", devices: deviceList() });
        break;

      case "get_context":
        send(device.ws, { type: "context_snapshot", context: Object.fromEntries(sharedContext) });
        break;

      case "user_state_update": {
        const slot = userSlot(device.userId);
        slot.state = { ...slot.state, ...(msg.state || {}), updatedAt: Date.now(), updatedBy: deviceId.slice(0, 12) };
        schedulePersist();
        broadcast(deviceId, { type: "user_state_updated", userId: device.userId, state: slot.state });
        receipt("user_state_updated", { device: anonId(deviceId), keys: Object.keys(msg.state || {}) });
        break;
      }

      case "workspace_sync": {
        persistent.workspaces[device.userId] = { ...(msg.snapshot || {}), updatedAt: Date.now(), updatedBy: deviceId.slice(0, 12) };
        schedulePersist();
        broadcast(deviceId, { type: "workspace_synced", userId: device.userId, snapshot: persistent.workspaces[device.userId] });
        receipt("workspace_synced", { device: anonId(deviceId) });
        break;
      }

      default:
        send(device.ws, { type: "error", error: `Unknown message type: ${msg.type}` });
    }
  }

  // ── Public surface ─────────────────────────────────────────────────────────
  function attachToServer(httpServer) {
    if (wss) throw new Error("sync-fabric is already attached to a server");
    wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

    httpServer.on("upgrade", (req, socket, head) => {
      let pathname;
      try { pathname = new URL(req.url ?? "/", "https://headyme.com").pathname; } catch { pathname = null; }
      if (pathname !== SYNC_PATH) return; // some other upgrade surface owns this path
      const verdict = authorizeUpgrade(req);
      if (!verdict.ok) return rejectUpgrade(socket, verdict.code, verdict.reason);
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    });

    wss.on("connection", (ws, req) => {
      const deviceId = String(req.headers["x-device-id"] || randomUUID());
      const meta = {
        name: String(req.headers["x-device-name"] || "unnamed"),
        platform: String(req.headers["x-device-platform"] || "unknown"),
        userId: String(req.headers["x-user-id"] || `user:${deviceId.slice(0, 12)}`).trim(),
      };
      registerDevice(deviceId, ws, meta);

      ws.on("message", (raw) => {
        try {
          if (!devices.has(deviceId)) return; // already evicted (kick/timeout) — drop trailing frames
          if (enforceCaps(deviceId, raw)) return;
          handleMessage(deviceId, JSON.parse(raw.toString()));
        } catch (err) {
          send(ws, { type: "error", error: `Invalid message: ${err.message}` });
        }
      });
      ws.on("close", () => unregisterDevice(deviceId));
      ws.on("error", (err) => receipt("socket_error", { device: anonId(deviceId), error: err.message }));
    });

    sweepTimer = setInterval(() => {
      const now = Date.now();
      for (const [deviceId, device] of devices) {
        if (now - device.lastSeen > heartbeatTimeoutMs) {
          receipt("heartbeat_timeout", { device: anonId(deviceId), staleMs: now - device.lastSeen });
          device.ws.terminate();
          unregisterDevice(deviceId);
        }
      }
    }, sweepIntervalMs);
    if (typeof sweepTimer.unref === "function") sweepTimer.unref();

    receipt("attached", { path: SYNC_PATH });
  }

  /** Read-only, public-safe presence: device count + anonymized entries.
   *  No names, no userIds, no raw device ids — safe on an open surface. */
  function registerRoutes(app) {
    app.get("/api/sync/presence", (req, res) => {
      const now = Date.now();
      res.json({
        ok: true,
        service: "sync-fabric",
        deviceCount: devices.size,
        presence: Array.from(devices, ([id, d]) => ({
          id: anonId(id),
          platform: d.platform,
          lastSeenMsAgo: now - d.lastSeen,
        })),
        checkedAt: new Date(now).toISOString(),
      });
    });
    receipt("routes_registered", { routes: ["/api/sync/presence"] });
  }

  function status() {
    return {
      ok: !closed,
      service: "sync-fabric",
      path: SYNC_PATH,
      auth: { state: auth.state, armed: auth.state === "ready", error: auth.error },
      devices: devices.size,
      sessions: sessions.size,
      sharedContextKeys: sharedContext.size,
      persistentUsers: Object.keys(persistent.users).length,
      receipts: receipts.length,
      recentReceipts: receipts.slice(-FIB[5]).map(({ id, event, ts }) => ({ id, event, ts })),
      totals: { ...totals },
      caps: {
        maxMessageBytes: MAX_MESSAGE_BYTES,
        maxMessagesPerSecond: MAX_MESSAGES_PER_SECOND,
        heartbeatTimeoutMs,
      },
    };
  }

  function close() {
    if (closed) return Promise.resolve();
    closed = true;
    if (sweepTimer) clearInterval(sweepTimer);
    for (const [, device] of devices) {
      send(device.ws, { type: "shutdown", reason: "sync-fabric closing" });
      device.ws.close(1001, "server shutdown");
    }
    devices.clear();
    sessions.clear();
    rateWindows.clear();
    flushPersist();
    receipt("closed", {});
    return new Promise((resolve) => (wss ? wss.close(() => resolve()) : resolve()));
  }

  return { attachToServer, registerRoutes, status, close, on: events.on.bind(events), events };
}
