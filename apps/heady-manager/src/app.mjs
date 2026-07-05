// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — origin app (Cloud Run modular monolith)    ║
// ║  Boots the backbone via @heady/kernel (Latent Service Pattern) and ║
// ║  serves /health (kernel-aggregated), /metrics, /. © 2026 Heady.    ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// The HTTP listener is itself a kernel-managed service ({start,stop,health,metrics}),
// so /health reflects the same dependency-ordered boot the kernel performs. ESM only,
// binds 0.0.0.0 + $PORT (no localhost), pino structured logs with X-Heady-Trace-Id.

import { randomUUID } from "node:crypto";
import express from "express";
import { Kernel } from "@heady/kernel";
import { createLogger, runWithTrace } from "@heady/logger";
import { HEALTH } from "@heady/shared";
import { loadFacts } from "@heady/config";
import { createConsistencyMiddleware } from "@heady/consistency-bus/express";
import { createIntelligence } from "./intelligence.mjs";

/**
 * Build the origin app + its kernel. Does not listen — call `start()` (which boots the
 * kernel, whose `http` service performs the listen). Returns handles for tests + index.mjs.
 */
export function createApp({ port = Number(process.env.PORT) || 3300, logger } = {}) {
  const log = logger ?? createLogger({ base: { module: "heady-manager" } });

  // Golden record (facts.yaml). Resilient: if it can't be located from cwd, serve with
  // baseline identity rather than failing the whole origin — health still reports honestly.
  let facts = null;
  try { facts = loadFacts(); } catch (e) { log.warn({ err: e.message }, "facts.yaml not loaded; using baseline identity"); }
  const product = facts?.product?.name ?? "heady-ai";
  const version = facts?.product?.version ?? "3.0.0";

  const kernel = new Kernel({ logger: log });
  const intel = createIntelligence({ log });
  const startedAt = Date.now();
  let server = null;
  let requestCount = 0;

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  // Trace-context middleware: honor inbound trace id or mint one (runWithTrace stores
  // verbatim — it does not generate), bind it to the async context, and echo it back.
  app.use((req, res, next) => {
    const traceId = req.header("x-heady-trace-id") || randomUUID();
    res.setHeader("X-Heady-Trace-Id", traceId);
    res.setHeader("X-Heady-Service", "heady-manager");
    runWithTrace(traceId, () => {
      requestCount += 1;
      next();
    });
  });

  // Consistency bus at the app level: EVERY route on the origin gets ingress
  // recognition (locked-value drift ⇒ 409, fail-closed) and egress
  // normalization (stale linked values never leave the process). The governed
  // codeflow channel is exempt — it IS the sanctioned path for linked-value
  // change. Degrades to visible passthrough if HeadyRegistry is unreadable.
  const consistency = createConsistencyMiddleware({
    exemptPaths: ["/api/codeflow"],
    log,
  });
  app.use(consistency.middleware);

  // The HTTP listener as a Latent Service Pattern service, managed by the kernel.
  kernel.register(intel.service);

  kernel.register({
    name: "http",
    start: async () => {
      await new Promise((resolve, reject) => {
        server = app.listen(port, "0.0.0.0");
        server.once("listening", resolve);
        server.once("error", reject);
      });
    },
    stop: async () => {
      if (server) await new Promise((resolve) => server.close(() => resolve()));
      server = null;
    },
    health: async () => ({ status: server?.listening ? HEALTH.OK : HEALTH.DOWN }),
    metrics: async () => ({ uptimeMs: Date.now() - startedAt, requests: requestCount, listening: !!server?.listening }),
  });

  app.get("/health", async (_req, res) => {
    const h = await kernel.health();
    res.status(h.status === HEALTH.DOWN ? 503 : 200).json({
      status: h.status,
      service: "heady-manager",
      product,
      version,
      tier: "origin",
      checks: h.checks ?? {},
      consistencyBus: consistency.status(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/metrics", async (_req, res) => res.json(await kernel.metrics()));

  app.get("/intelligence", async (_req, res) => {
    const h = await intel.selfCheck();
    res.status(h.status === HEALTH.DOWN ? 503 : 200).json({
      stack: "intelligence",
      status: h.status,
      components: h.checks ?? {},
      note: "in-process cognition; production retriever = Neon pgvector, embeddings = Workers-AI bge-small-384",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/", (_req, res) => res.json({
    service: "heady-manager",
    product,
    version,
    tier: "origin (Cloud Run modular monolith)",
    endpoints: ["/health", "/metrics"],
  }));

  app.use((_req, res) => res.status(404).json({ error: "not_found" }));

  return {
    app,
    kernel,
    intel,
    log,
    /** Boot the kernel (dependency-ordered; the `http` service listens here). */
    start: () => kernel.boot(),
    /** Stop services in reverse order; returns collected errors. */
    stop: () => kernel.shutdown(),
    /** Net address after start (for tests on an ephemeral port). */
    address: () => server?.address() ?? null,
  };
}
