// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Scaffold Sync API v1.0.0                                  ║
// ║  Shared decision state for both interfaces: GET plan+decisions,   ║
// ║  POST one decision. Web (AdminUI section) + CLI converge on the   ║
// ║  same .data/scaffold/decisions.json overlay. Token-auth, the      ║
// ║  plan source is read-only. © 2026 HeadySystems — Eric Haywood     ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Mirrors packages/codeflow/src/server.mjs (node:http, bearer token, φ-PORT). The ONLY write is the
// decision overlay (derived, never the plan source); inputs are validated against the plan's known
// ids + the decision enum (AGENTS.md Rule 5, fail-closed).

import { createServer } from "node:http";
import { FIB } from "@heady/phi-math";
import { flattenBuild, applyDecisions, setDecision, summarize, DECISIONS } from "./core.mjs";
import { loadPlan, loadDecisions, saveDecisions } from "./store.mjs";

const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: "scaffold-api", level, msg, ...f })}\n`);

function knownIds(plan) {
  const ids = new Set();
  for (const b of Object.keys(plan.builds ?? {})) for (const r of flattenBuild(plan, b).rows) ids.add(r.id);
  return ids;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > FIB[15]) reject(new Error("body too large")); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function createScaffoldServer(opts = {}) {
  const token = opts.token ?? process.env.SCAFFOLD_TOKEN ?? "";
  const origin = opts.origin ?? process.env.SCAFFOLD_ORIGIN ?? ""; // no "*" default (AGENTS)

  const authorized = (req) => {
    if (!token) return true;
    const a = req.headers.authorization || "";
    return a.startsWith("Bearer ") && a.slice(7) === token;
  };
  const send = (res, code, body) => {
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://h");
    if (!authorized(req)) return send(res, 401, { error: "unauthorized" });

    // GET /api/scaffold/plan?build=ai|v1 → flattened build + decisions merged + summary.
    if (req.method === "GET" && url.pathname === "/api/scaffold/plan") {
      const plan = loadPlan();
      const buildId = url.searchParams.get("build") === "v1" ? "heady-v1" : "heady-ai";
      const { build, rows } = flattenBuild(plan, buildId);
      const options = applyDecisions(rows, loadDecisions());
      return send(res, 200, { build, options, summary: summarize(options) });
    }

    // GET /api/scaffold/decisions → the raw overlay (shared by CLI + web).
    if (req.method === "GET" && url.pathname === "/api/scaffold/decisions") {
      return send(res, 200, { decisions: loadDecisions() });
    }

    // POST /api/scaffold/decisions { id, decision, note } → validate, persist, return updated overlay.
    if (req.method === "POST" && url.pathname === "/api/scaffold/decisions") {
      let payload;
      try { payload = JSON.parse((await readBody(req)) || "{}"); }
      catch { return send(res, 400, { error: "invalid JSON" }); }
      const { id, decision, note } = payload;
      if (!DECISIONS.includes(decision)) return send(res, 400, { error: `decision must be one of ${DECISIONS.join("|")}` });
      if (!id || !knownIds(loadPlan()).has(id)) return send(res, 400, { error: `unknown option id "${id}"` });
      const updated = setDecision(loadDecisions(), id, decision, typeof note === "string" ? note : null, new Date().toISOString());
      saveDecisions(updated);
      log("info", "decision set", { id, decision });
      return send(res, 200, { ok: true, id, decision: updated[id] });
    }

    return send(res, 404, { error: "not found", routes: ["GET /api/scaffold/plan", "GET|POST /api/scaffold/decisions"] });
  });
}

export function startScaffoldServer(opts = {}) {
  const port = Number(process.env.PORT) || 8000 + FIB[15]; // 8610 local default; Cloud Run injects PORT
  const server = createScaffoldServer(opts);
  server.listen(port, () => log("info", "scaffold sync api listening", { port, authRequired: Boolean(opts.token ?? process.env.SCAFFOLD_TOKEN) }));
  return server;
}
