// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval API v1.0.0                                    ║
// ║  Authenticated HTTP boundary for the approval control plane.    ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { randomUUID } from "node:crypto";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { FIB, HEARTBEAT_MS } from "@heady/phi-math";
import { runWithTrace } from "@heady/logger";
import { HeadyError, UnauthorizedError, ValidationError } from "@heady/shared";
import { TraceIdSchema } from "@heady/approvals";

function asyncAuth(authenticate) {
  return async (request, _response, next) => {
    request.actor = await authenticate(request);
    next();
  };
}

function idempotencyKey(request) {
  return request.header("idempotency-key");
}

export function createApprovalApi({
  approvalService,
  authenticator,
  database,
  log,
}) {
  const app = express();
  const startedAt = Date.now();
  const metrics = {
    requests: 0,
    failures: 0,
    decisions: 0,
    attestations: 0,
    autonomousRequests: 0,
    autonomousGrants: 0,
  };
  async function databaseHealth() {
    try {
      return await database.health();
    } catch (error) {
      log.warn({
        err: String(error?.message ?? error),
      }, "approval API Neon health check failed");
      return { ok: false };
    }
  }

  app.disable("x-powered-by");
  app.set("trust proxy", FIB[1]);
  app.use(helmet());
  app.use(express.json({ limit: `${FIB[16]}kb`, strict: true }));
  app.use((request, response, next) => {
    const candidateTraceId = request.header("x-heady-trace-id") ?? randomUUID();
    const parsedTraceId = TraceIdSchema.safeParse(candidateTraceId);
    if (!parsedTraceId.success) {
      next(new ValidationError("invalid X-Heady-Trace-Id header"));
      return;
    }
    const traceId = parsedTraceId.data;
    request.traceId = traceId;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Heady-Trace-Id", traceId);
    response.setHeader("X-Heady-Service", "approval-api");
    runWithTrace(traceId, () => {
      metrics.requests += 1;
      next();
    });
  });
  app.use("/api", rateLimit({
    windowMs: HEARTBEAT_MS,
    limit: FIB[10],
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (request) => request.method === "GET",
    handler: (request, response) => {
      metrics.failures += 1;
      response.status(429).json({
        error: {
          code: "RATE_LIMIT",
          message: "approval mutation rate limit exceeded",
        },
        traceId: request.traceId,
      });
    },
  }));

  const human = asyncAuth(authenticator.human);
  const workload = asyncAuth(authenticator.workload);

  app.get("/health/live", (_request, response) => {
    response.json({ status: "ok", service: "approval-api" });
  });
  app.get("/health/ready", async (_request, response) => {
    const db = await databaseHealth();
    response.status(db.ok ? 200 : 503).json({
      status: db.ok ? "ok" : "down",
      service: "approval-api",
      checks: { neon: db.ok ? "ok" : "down" },
    });
  });
  app.post("/api/approvals", human, async (request, response) => {
    const result = await approvalService.create({
      actor: request.actor,
      input: request.body,
      idempotencyKey: idempotencyKey(request),
      traceId: request.traceId,
    });
    response.status(201).json({ ...result, traceId: request.traceId });
  });

  app.post("/api/autonomous-approvals", workload, async (request, response) => {
    const result = await approvalService.requestAutonomous({
      actor: request.actor,
      input: request.body,
      idempotencyKey: idempotencyKey(request),
      traceId: request.traceId,
    });
    metrics.autonomousRequests += 1;
    response.status(201).json({ ...result, traceId: request.traceId });
  });

  app.get("/api/autonomous-approvals/:approvalId", workload, async (request, response) => {
    const result = await approvalService.getAutonomous({
      approvalId: request.params.approvalId,
      actor: request.actor,
    });
    response.json({ ...result, traceId: request.traceId });
  });

  app.post("/api/approvals/:approvalId/submit", human, async (request, response) => {
    const result = await approvalService.submit({
      approvalId: request.params.approvalId,
      actor: request.actor,
      input: request.body,
      idempotencyKey: idempotencyKey(request),
      traceId: request.traceId,
    });
    response.json({ ...result, traceId: request.traceId });
  });

  app.get("/api/approvals/:approvalId", human, async (request, response) => {
    const result = await approvalService.get({
      approvalId: request.params.approvalId,
      actor: request.actor,
    });
    response.json({ ...result, traceId: request.traceId });
  });

  app.post("/api/approvals/:approvalId/approve", human, async (request, response) => {
    if (request.body?.decision !== "approve") {
      throw new HeadyError("approve route requires decision=approve", {
        code: "VALIDATION",
        status: 400,
      });
    }
    const result = await approvalService.decide({
      approvalId: request.params.approvalId,
      actor: request.actor,
      input: request.body,
      idempotencyKey: idempotencyKey(request),
      traceId: request.traceId,
    });
    metrics.decisions += 1;
    response.json({ ...result, traceId: request.traceId });
  });

  app.post("/api/approvals/:approvalId/reject", human, async (request, response) => {
    if (request.body?.decision !== "reject") {
      throw new HeadyError("reject route requires decision=reject", {
        code: "VALIDATION",
        status: 400,
      });
    }
    const result = await approvalService.decide({
      approvalId: request.params.approvalId,
      actor: request.actor,
      input: request.body,
      idempotencyKey: idempotencyKey(request),
      traceId: request.traceId,
    });
    metrics.decisions += 1;
    response.json({ ...result, traceId: request.traceId });
  });

  app.post("/api/approvals/:approvalId/attest", workload, async (request, response) => {
    const result = await approvalService.attest({
      approvalId: request.params.approvalId,
      actor: request.actor,
      input: request.body,
      idempotencyKey: idempotencyKey(request),
      traceId: request.traceId,
    });
    metrics.attestations += 1;
    response.json({ ...result, traceId: request.traceId });
  });

  app.post("/api/approvals/:approvalId/supersede", human, async (request, response) => {
    const result = await approvalService.supersede({
      approvalId: request.params.approvalId,
      actor: request.actor,
      input: request.body,
      idempotencyKey: idempotencyKey(request),
      traceId: request.traceId,
    });
    response.json({ ...result, traceId: request.traceId });
  });

  app.post("/api/approvals/:approvalId/verify", human, async (request, response) => {
    const result = await approvalService.verify({
      approvalId: request.params.approvalId,
      actor: request.actor,
      input: request.body,
      idempotencyKey: idempotencyKey(request),
      traceId: request.traceId,
    });
    response.json({ ...result, traceId: request.traceId });
  });

  app.get("/api/approvals/:approvalId/receipts", human, async (request, response) => {
    const result = await approvalService.receipts({
      approvalId: request.params.approvalId,
      actor: request.actor,
    });
    response.json({ ...result, traceId: request.traceId });
  });

  app.post("/api/deployment-protection", workload, async (request, response) => {
    const result = await approvalService.deploymentProtection({
      actor: request.actor,
      input: request.body,
    });
    response.status(result.allow ? 200 : 409).json({ ...result, traceId: request.traceId });
  });

  app.post("/api/autonomous-protection", workload, async (request, response) => {
    const result = await approvalService.autonomousProtection({
      actor: request.actor,
      input: request.body,
      idempotencyKey: idempotencyKey(request),
      traceId: request.traceId,
    });
    if (result.allow) metrics.autonomousGrants += 1;
    response.status(result.allow ? 200 : 409).json({ ...result, traceId: request.traceId });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "route not found" } });
  });

  app.use((error, request, response, _next) => {
    metrics.failures += 1;
    const expected = error instanceof HeadyError;
    const status = expected ? error.status : error instanceof SyntaxError ? 400 : 500;
    const code = expected ? error.code : status === 400 ? "INVALID_JSON" : "INTERNAL";
    if (status >= 500) {
      log.error({
        err: String(error?.message ?? error),
        code,
        method: request.method,
        path: request.path,
      }, "approval API request failed");
    } else if (!(error instanceof UnauthorizedError)) {
      log.warn({ code, method: request.method, path: request.path }, "approval API request denied");
    }
    response.status(status).json({
      error: {
        code,
        message: expected ? error.message : status === 400 ? "invalid JSON body" : "internal error",
        ...(expected && Object.keys(error.context).length > 0 ? { context: error.context } : {}),
      },
      traceId: request.traceId,
    });
  });

  return Object.freeze({
    app,
    health: databaseHealth,
    metrics: () => ({ ...metrics, uptimeMs: Date.now() - startedAt }),
  });
}
