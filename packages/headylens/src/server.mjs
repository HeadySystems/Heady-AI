// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ HeadyLens API v1.0.0                                      ║
// ║  Read-only, dependency-free HTTP surface over the collector:      ║
// ║  /api/lens/query (time-windowed, detail-graded) + /api/lens/      ║
// ║  stream (SSE live tail) + /api/lens/health. Token-auth, fail-     ║
// ║  closed. © 2026 HeadySystems Inc. — Eric Haywood, Founder         ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Mirrors packages/codeflow/src/server.mjs (node:http, bearer token, φ-derived PORT). GET-only —
// HeadyLens is a display/diagnostic lens, never a write or decision-replay endpoint (ARBITER).
// Records are already redacted at ingest (record.mjs); inputs are strictly validated + clamped.

import { createServer } from "node:http";
import { FIB } from "@heady/phi-math";
import { DETAIL, DETAIL_NAMES } from "./record.mjs";

const log = (level, msg, f = {}) =>
  process.stdout.write(`${JSON.stringify({ t: "headylens-api", level, msg, ...f })}\n`);

const MAX_LIMIT = FIB[18]; // 2584 — bound the query response

function parseDetail(v) {
  if (v == null || v === "") return DETAIL.NORMAL;
  const byName = DETAIL_NAMES.indexOf(String(v).toLowerCase());
  if (byName >= 0) return byName;
  const n = Number(v);
  return Number.isInteger(n) && n >= DETAIL.SUMMARY && n <= DETAIL.FORENSIC ? n : DETAIL.NORMAL;
}

function parseTime(v) {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n; // epoch ms
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : undefined;
}

/** Strictly parse + clamp the query filter from URL params (fail-closed: unknown → safe default). */
function parseFilter(params) {
  const limitRaw = Number(params.get("limit"));
  return {
    sinceMs: parseTime(params.get("since")),
    untilMs: parseTime(params.get("until")),
    maxDetail: parseDetail(params.get("detail")),
    traceId: params.get("trace") || undefined,
    subjectPrefix: params.get("subject") || undefined,
    limit: Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : FIB[16], // default 987
  };
}

/**
 * Build the HeadyLens HTTP server over a collector.
 * @param {object} collector  from createCollector()
 * @param {{token?:string, origin?:string}} [opts]
 */
export function createLensServer(collector, opts = {}) {
  const token = opts.token ?? process.env.HEADYLENS_TOKEN ?? "";
  const origin = opts.origin ?? process.env.HEADYLENS_ORIGIN ?? ""; // no "*" default (AGENTS #CORS)

  // Fail-closed auth: when a token is configured, a matching Bearer is required.
  const authorized = (req) => {
    if (!token) return true; // dev / no token set
    const authz = req.headers.authorization || "";
    return authz.startsWith("Bearer ") && authz.slice(7) === token;
  };

  const cors = (res) => { if (origin) res.setHeader("Access-Control-Allow-Origin", origin); };
  const json = (res, code, body) => {
    cors(res);
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  return createServer((req, res) => {
    const url = new URL(req.url, "http://h");
    if (req.method !== "GET") return json(res, 405, { error: "read-only: GET only" });
    if (!authorized(req)) return json(res, 401, { error: "unauthorized" });

    if (url.pathname === "/api/lens/health") {
      return json(res, 200, {
        ok: true,
        size: collector.size,
        channels: ["event", "log", "span", "error"],
        detailTiers: DETAIL_NAMES,
      });
    }

    if (url.pathname === "/api/lens/query") {
      const filter = parseFilter(url.searchParams);
      const records = collector.query(filter);
      return json(res, 200, { count: records.length, filter, records });
    }

    if (url.pathname === "/api/lens/stream") {
      const filter = parseFilter(url.searchParams);
      cors(res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(`event: ready\ndata: ${JSON.stringify({ filter })}\n\n`);
      const unsub = collector.subscribe((rec) => {
        res.write(`data: ${JSON.stringify(rec)}\n\n`);
      }, filter);
      // φ-cadence keep-alive comment so proxies hold the stream open.
      const ka = setInterval(() => res.write(`: keep-alive\n\n`), FIB[11] * 1000); // 89s
      const close = () => { clearInterval(ka); unsub(); };
      req.on("close", close);
      req.on("error", close);
      return undefined;
    }

    return json(res, 404, { error: "not found", routes: ["/api/lens/query", "/api/lens/stream", "/api/lens/health"] });
  });
}

/** Start the server (called by the host after taps are wired). */
export function startLensServer(collector, opts = {}) {
  const port = Number(process.env.PORT) || 8000 + FIB[14]; // 8377 local default; Cloud Run injects PORT
  const server = createLensServer(collector, opts);
  server.listen(port, () => log("info", "headylens api listening", { port, authRequired: Boolean(opts.token ?? process.env.HEADYLENS_TOKEN) }));
  return server;
}
