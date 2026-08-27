// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — SSE realtime event fabric                   ║
// ║  Projects the in-process @heady/events bus (the ONE event spine,    ║
// ║  shared with the intelligence stack) onto GET /api/events as SSE.   ║
// ║  Ring-buffer replay via Last-Event-ID, φ⁷ heartbeat, kernel-managed ║
// ║  ({start,stop,health,metrics}) so /health reports the fabric.       ║
// ║  Made with ❤️ by HeadySystems Inc.                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Producers wired here (all REAL, none synthetic):
//   heady.system.service.health   — kernel per-service status CHANGE (poll on φ⁷ heartbeat)
//   heady.system.origin.status    — aggregate origin status CHANGE (worst-wins transitions)
//   heady.system.metrics.milestone— request count crossing the next Fibonacci milestone
//   heady.system.stream.hello     — per-connection bootstrap frame (not buffered)
//   plus EVERY subject any service publishes on the shared bus (">" projection),
//   e.g. the intelligence self-check's selfcheck.ping. publish() is the generic
//   app-level hook other services use to reach installed Heady apps live.

import { HEARTBEAT_MS, FIB, fib } from "@heady/phi-math";
import { SUBJECT } from "@heady/events";
import { HEALTH } from "@heady/shared";

/** Smallest Fibonacci value strictly greater than v (skips the 0/1/1 duplicates). */
function nextFibAbove(v) {
  let i = 2;
  while (fib(i) <= v) i += 1;
  return fib(i);
}

/**
 * Build the SSE event fabric as a Latent Service Pattern service.
 *
 * @param {object} opts
 * @param {import("@heady/events").InMemoryBus} opts.bus  the shared in-process bus (intel.bus)
 * @param {import("@heady/kernel").Kernel} opts.kernel    polled for health transitions
 * @param {object} opts.log                               pino-compatible structured logger
 * @param {number} [opts.heartbeatMs]                     φ⁷ golden heartbeat (poll + SSE comment)
 * @param {number} [opts.bufferSize]                      ring buffer capacity (FIB[12] = 144)
 * @param {number} [opts.maxConnections]                  per-process SSE cap (FIB[11] = 89)
 * @param {() => number} [opts.getRequestCount]           origin request counter (milestones)
 * @param {() => object|null} [opts.getConsistencyStatus] consistency-bus status() for hello/origin
 */
export function createEventsService({
  bus,
  kernel,
  log,
  heartbeatMs = HEARTBEAT_MS, //   φ⁷ ≈ 29034ms (ADR-0026 golden heartbeat)
  bufferSize = FIB[12], //          144-event replay ring
  maxConnections = FIB[11], //      89 concurrent SSE clients per process
  getRequestCount = () => 0,
  getConsistencyStatus = () => null,
} = {}) {
  // ── Ring buffer (fixed slots, monotonic ids — replay = ids still resident) ──
  const ring = new Array(bufferSize);
  let nextId = 1;

  // ── Live connections ─────────────────────────────────────────────────────
  const connections = new Set(); // express res objects
  let peakConnections = 0;
  let connectionsTotal = 0;
  let lastEventAt = null;

  // ── Producer state ────────────────────────────────────────────────────────
  let running = false;
  let timer = null;
  let unsubscribe = null;
  let snapshot = null; // { status, checks, consistencyBus, at } — latest kernel truth
  const lastStatuses = new Map(); // per-service status baseline for CHANGE detection
  let nextMilestone = nextFibAbove(0); // first crossing target; advanced past current count at start
  let tickInFlight = null;

  const frame = (evt) => `id: ${evt.id}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`;

  function broadcast(text) {
    for (const res of connections) {
      try {
        res.write(text);
      } catch (err) {
        connections.delete(res);
        log?.warn({ err: err.message, connections: connections.size }, "sse write failed — connection dropped");
      }
    }
  }

  /** Ingest a bus event into the ring and fan it out to every live connection. */
  function ingest(event) {
    const evt = {
      id: nextId,
      ts: event.ts ?? new Date().toISOString(),
      type: event.subject,
      payload: event.payload ?? {},
    };
    nextId += 1;
    ring[evt.id % bufferSize] = evt;
    lastEventAt = Date.now();
    broadcast(frame(evt));
    return evt;
  }

  /** Generic app-level publish hook — one spine: everything goes through the bus. */
  async function publish(subject, payload, opts) {
    return bus.publish(subject, payload, opts);
  }

  /** Events with id > sinceId that are still resident in the ring, in order. */
  function replaySince(sinceId) {
    const out = [];
    for (let id = Math.max(sinceId + 1, nextId - bufferSize); id < nextId; id += 1) {
      const evt = ring[id % bufferSize];
      if (evt && evt.id === id) out.push(evt);
    }
    return out;
  }

  /** One golden heartbeat: poll kernel truth, emit CHANGES only, keep sockets alive. */
  async function tick() {
    if (tickInFlight) return tickInFlight;
    tickInFlight = (async () => {
      const h = await kernel.health();

      // Per-service transitions — emit on CHANGE only, never on steady state.
      for (const [service, status] of Object.entries(h.checks ?? {})) {
        const previous = lastStatuses.get(service);
        if (previous !== undefined && previous !== status) {
          await publish(SUBJECT.system("service.health"), { service, status, previous });
        }
        lastStatuses.set(service, status);
      }

      // Aggregate origin transition (worst-wins status from the kernel).
      if (snapshot && snapshot.status !== h.status) {
        await publish(SUBJECT.system("origin.status"), {
          status: h.status,
          previous: snapshot.status,
          checks: h.checks ?? {},
        });
      }
      snapshot = { status: h.status, checks: h.checks ?? {}, consistencyBus: getConsistencyStatus(), at: Date.now() };

      // Request-count milestones from the existing origin metric (Fibonacci ladder).
      const requests = getRequestCount();
      while (requests >= nextMilestone) {
        await publish(SUBJECT.system("metrics.milestone"), { requests, milestone: nextMilestone });
        nextMilestone = nextFibAbove(nextMilestone);
      }
    })().finally(() => {
      tickInFlight = null;
    });
    return tickInFlight;
  }

  /** GET /api/events — the SSE endpoint. Express handler (mounted by app.mjs). */
  async function sseHandler(req, res) {
    if (!running) {
      res.status(503).json({ error: "event_fabric_offline" });
      return;
    }
    if (connections.size >= maxConnections) {
      log?.warn({ maxConnections }, "sse capacity reached — connection refused");
      res.status(503).json({ error: "sse_capacity", maxConnections });
      return;
    }

    // Last-Event-ID header (EventSource reconnect) or ?lastEventId= (fetch clients,
    // CORS-safe — no preflight-triggering header needed). NaN ⇒ live-only, no replay.
    const sinceRaw = req.header("last-event-id") ?? req.query.lastEventId;
    const sinceId = Number.parseInt(sinceRaw, 10);

    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    });
    res.flushHeaders?.();
    res.write(`retry: ${Math.round(heartbeatMs)}\n\n`); // φ-derived client reconnect hint

    // Join the live set BEFORE any await so no event can fall between replay and live.
    connections.add(res);
    connectionsTotal += 1;
    peakConnections = Math.max(peakConnections, connections.size);
    log?.info({ connections: connections.size, sinceId: Number.isNaN(sinceId) ? null : sinceId }, "sse connection open");

    if (!Number.isNaN(sinceId)) {
      for (const evt of replaySince(sinceId)) res.write(frame(evt));
    }

    // Fresh kernel truth for the hello (boot-time transitions publish live here too).
    try {
      await tick();
    } catch (err) {
      log?.warn({ err: err.message }, "sse hello health poll failed — sending last snapshot");
    }
    res.write(
      `event: ${SUBJECT.system("stream.hello")}\ndata: ${JSON.stringify({
        ts: new Date().toISOString(),
        type: SUBJECT.system("stream.hello"),
        payload: {
          lastEventId: nextId - 1,
          buffered: Math.min(nextId - 1, bufferSize),
          connections: connections.size,
          heartbeatMs,
          origin: snapshot,
        },
      })}\n\n`,
    );

    req.on("close", () => {
      connections.delete(res);
      log?.info({ connections: connections.size }, "sse connection closed");
    });
  }

  const service = {
    name: "events",
    deps: ["intelligence"], // the bus is the intelligence stack's spine — boot after it
    start: async () => {
      running = true;
      unsubscribe = bus.subscribe(">", (event) => ingest(event)); // project the WHOLE spine
      nextMilestone = nextFibAbove(getRequestCount()); // never re-announce already-passed rungs
      await tick(); // baseline snapshot — CHANGE detection starts honest
      timer = setInterval(() => {
        tick().catch((err) => log?.warn({ err: err.message }, "event fabric heartbeat poll failed"));
        broadcast(`: hb ${Date.now()}\n\n`); // SSE keep-alive comment on the same φ⁷ beat
      }, heartbeatMs);
      timer.unref?.();
      log?.info({ heartbeatMs, bufferSize, maxConnections }, "event fabric online (SSE /api/events)");
    },
    stop: async () => {
      running = false;
      if (timer) clearInterval(timer);
      timer = null;
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      for (const res of connections) {
        try {
          res.end();
        } catch { /* already gone — nothing to close */ }
      }
      connections.clear();
    },
    health: async () => ({
      status: !running ? HEALTH.DOWN : connections.size >= maxConnections ? HEALTH.DEGRADED : HEALTH.OK,
    }),
    metrics: async () => ({
      connections: connections.size,
      peakConnections,
      connectionsTotal,
      published: nextId - 1,
      buffered: Math.min(nextId - 1, bufferSize),
      bufferSize,
      maxConnections,
      heartbeatMs,
      lastEventAt,
    }),
  };

  return { service, sseHandler, publish, replaySince, tick };
}
