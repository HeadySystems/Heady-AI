// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Manager MCP Intelligence Gateway v1.0.0                 ║
// ║  Authenticated Streamable HTTP with one audited tool chokepoint. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createHash, timingSafeEqual } from "node:crypto";
import { McpServer, createMcpHandler, validateHostHeader, validateOriginHeader } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { z } from "zod4";
import { ContextEnricher } from "@heady/auto-context";
import { assertEmbedding } from "@heady/db";
import { LOCKED_MODEL } from "@heady/embedding/core";
import { GATE, FIB, HEARTBEAT_MS } from "@heady/phi-math";
import { HEALTH, makeHealth } from "@heady/shared";
import {
  createMcpIntelligenceGateway,
  createNeonMcpAuditStore,
} from "@heady/mcp-intelligence";

const SOURCE_AUTHORITY = "git:source-authority; neon:runtime-and-retrieval-authority; adr-0051-read-cutover:not-verified";
const MCP_PATHS = Object.freeze(["/mcp", "/mcp/v1"]);
const HASH_HEX_LENGTH = FIB[10] + FIB[6] + FIB[2];
const AUTH_DIGEST_PREFIX = FIB[7];
const MEMORY_SCOPE = "heady:mcp:memory";
const SET_RUNTIME_ROLE = "SET LOCAL ROLE heady_runtime_api";
const RESET_RUNTIME_ROLE = "RESET ROLE";

function digest(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
}

function vectorLiteral(embedding) {
  assertEmbedding(embedding);
  return `[${embedding.join(",")}]`;
}

function parseVector(value) {
  const parsed = Array.isArray(value)
    ? value.map(Number)
    : String(value).replace(/^\[|\]$/g, "").split(",").map(Number);
  assertEmbedding(parsed);
  return parsed;
}

async function withDb(getDbPort, operation) {
  if (typeof getDbPort !== "function") throw new Error("Neon DbPort is not configured");
  const port = await getDbPort();
  await port.connect();
  try {
    return await operation(port);
  } finally {
    await port.end();
  }
}

function constantTimeEqual(actual, expected) {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function bearerFrom(req) {
  const authorization = req.header("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  return match?.[1] ?? null;
}

function staticBearerAuthenticator({ bearerToken, tenantId }) {
  if (typeof bearerToken !== "string" || bearerToken.length < FIB[8]) return null;
  if (typeof tenantId !== "string" || tenantId.trim().length === 0) return null;
  const clientId = `mcp-bootstrap:${digest(bearerToken).slice(0, AUTH_DIGEST_PREFIX)}`;

  return async (req) => {
    const candidate = bearerFrom(req);
    if (!candidate || !constantTimeEqual(candidate, bearerToken)) return null;
    return {
      token: candidate,
      clientId,
      scopes: ["heady:mcp:read", "heady:mcp:write"],
      extra: { tenantId },
    };
  };
}

function unavailableAuditStore() {
  return {
    async ready() { return false; },
    async append() { throw new Error("Neon MCP audit store is not configured"); },
    async history() { throw new Error("Neon MCP audit store is not configured"); },
    async verify() { throw new Error("Neon MCP audit store is not configured"); },
  };
}

function jsonRpcError(res, status, message) {
  return res.status(status).json({
    jsonrpc: "2.0",
    error: { code: -32_000, message },
    id: null,
  });
}

/**
 * Compose the canonical MCP transport and its Latent Service Pattern handle.
 * InMemoryMcpAuditStore must be injected explicitly and is intended for tests.
 */
export function createMcpService({
  log,
  intelligence,
  events,
  tasks,
  heady990,
  getDbPort = null,
  embedQuery = null,
  auditStore = null,
  authenticate = null,
  bearerToken = null,
  tenantId = null,
  allowedHosts = [],
  allowedOrigins = allowedHosts,
  enabled = true,
} = {}) {
  if (!log || !intelligence || !events || !tasks || !heady990) throw new TypeError("MCP service dependencies are required");

  const authenticator = authenticate ?? staticBearerAuthenticator({ bearerToken, tenantId });
  const audit = auditStore ?? (getDbPort ? createNeonMcpAuditStore({ getDbPort }) : unavailableAuditStore());
  const state = {
    enabled,
    running: false,
    auditReady: false,
    semanticReady: false,
    auditReason: "not probed",
    semanticReason: "not probed",
    calls: 0,
    failures: 0,
  };

  async function contextCandidates({ tenantId: actorTenantId, queryEmbedding, limit }) {
    return withDb(getDbPort, (port) => port.tx(async (tx) => {
      await tx.query(SET_RUNTIME_ROLE);
      await tx.query("SELECT set_config('heady.tenant_id', $1, true)", [actorTenantId]);
      const result = await tx.query(
        `SELECT id, content, embedding::text, metadata, provenance
           FROM heady_runtime.context_fragment
          WHERE tenant_id = $2
          ORDER BY embedding <=> $1::vector
          LIMIT $3`,
        [vectorLiteral(queryEmbedding), actorTenantId, limit],
      );
      return result.rows.map((row) => ({
        id: String(row.id),
        content: row.content,
        embedding: parseVector(row.embedding),
        source: String(row.metadata?.source ?? "neon-pgvector"),
        metadata: { ...(row.metadata ?? {}), provenance: row.provenance ?? [] },
      }));
    }));
  }

  const intelligencePipeline = {
    async prepare({ input, traceId, tenantId: actorTenantId, contextPolicy }) {
      if (contextPolicy !== "semantic") {
        return {
          authority: SOURCE_AUTHORITY,
          sourceRevision: null,
          confidence: 1,
          relevance: 1,
          capsule: { profile: "metadata", gate: 1, budget: FIB[0], items: [], considered: FIB[0], gated: FIB[0], deduped: FIB[0], coherence: FIB[0] },
        };
      }
      if (!state.semanticReady) throw new Error(state.semanticReason);
      const query = input.query;
      if (typeof query !== "string" || query.length === 0) throw new Error("semantic context requires a query");
      const queryEmbedding = await embedQuery(query);
      assertEmbedding(queryEmbedding);
      const enricher = new ContextEnricher({
        retriever: {
          retrieve: (_task, { limit }) => contextCandidates({ tenantId: actorTenantId, queryEmbedding, limit }),
        },
      });
      const capsule = await enricher.enrichForStage({ text: query, embedding: queryEmbedding, traceId });
      return {
        authority: SOURCE_AUTHORITY,
        sourceRevision: null,
        confidence: 1,
        relevance: capsule.items.length > 0 ? capsule.coherence : GATE.HALT ** FIB[3],
        capsule,
        queryEmbedding,
      };
    },
  };

  let gateway;
  const runtime = {
    controlPlaneAvailability() {
      if (!state.enabled) return { available: false, reason: "MCP service is disabled" };
      if (!state.running) return { available: false, reason: "MCP service is not running" };
      if (typeof authenticator !== "function") return { available: false, reason: "MCP authentication is not configured" };
      if (allowedHosts.length === 0) return { available: false, reason: "MCP allowed hosts are not configured" };
      if (!state.auditReady) return { available: false, reason: state.auditReason };
      return true;
    },
    semanticAvailability() {
      return state.semanticReady ? true : { available: false, reason: state.semanticReason };
    },
    auditAvailability() {
      return state.auditReady ? true : { available: false, reason: state.auditReason };
    },
    taskAvailability() {
      return { available: false, reason: "the current task ledger is not tenant-bound" };
    },
    heady990Availability: () => heady990.availability(),
    async health() {
      const cognition = await intelligence.selfCheck();
      const checks = {
        transport: state.running ? HEALTH.OK : HEALTH.DOWN,
        authentication: typeof authenticator === "function" && allowedHosts.length > 0 ? HEALTH.OK : HEALTH.DOWN,
        audit: state.auditReady ? HEALTH.OK : HEALTH.DOWN,
        intelligence: cognition.status,
        semanticMemory: state.semanticReady ? HEALTH.OK : HEALTH.DEGRADED,
      };
      return {
        status: makeHealth(checks).status,
        sourceAuthority: SOURCE_AUTHORITY,
        services: checks,
        timestamp: new Date().toISOString(),
      };
    },
    async services() {
      const serviceEntries = [intelligence.service, events.service, tasks.service, heady990.service];
      const services = await Promise.all(serviceEntries.map(async (service) => {
        try {
          const measured = await service.health();
          return { name: service.name, status: measured?.status ?? String(measured), details: measured?.checks ?? {} };
        } catch (error) {
          return { name: service.name, status: HEALTH.DOWN, details: { reason: String(error?.message ?? error) } };
        }
      }));
      services.push({
        name: "mcp-intelligence",
        status: state.auditReady && typeof authenticator === "function" ? (state.semanticReady ? HEALTH.OK : HEALTH.DEGRADED) : HEALTH.DOWN,
        details: { audit: state.auditReason, semanticMemory: state.semanticReason },
      });
      return { services };
    },
    toolStatus: () => gateway.status(),
    async history({ tenantId: actorTenantId, limit }) {
      const [events, chainValid] = await Promise.all([
        audit.history({ tenantId: actorTenantId, limit }),
        audit.verify({ tenantId: actorTenantId }),
      ]);
      return { events, chainValid };
    },
    async memorySearch({ tenantId: actorTenantId, query, limit, queryEmbedding }) {
      const embedding = queryEmbedding ?? await embedQuery(query);
      const result = await withDb(getDbPort, (port) => port.tx(async (tx) => {
        await tx.query(SET_RUNTIME_ROLE);
        await tx.query("SELECT set_config('heady.tenant_id', $1, true)", [actorTenantId]);
        return tx.query(
          `SELECT id, content, metadata, provenance, created_at,
                  1 - (embedding <=> $1::vector) AS similarity
             FROM heady_runtime.context_fragment
            WHERE tenant_id = $2
            ORDER BY embedding <=> $1::vector
            LIMIT $3`,
          [vectorLiteral(embedding), actorTenantId, limit],
        );
      }));
      return {
        results: result.rows.map((row) => ({
          id: String(row.id),
          content: row.content,
          similarity: Number(row.similarity),
          metadata: { ...(row.metadata ?? {}), provenance: row.provenance ?? [] },
          createdAt: new Date(row.created_at).toISOString(),
        })),
        count: result.rows.length,
        model: LOCKED_MODEL.id,
        dimension: LOCKED_MODEL.dim,
      };
    },
    async memoryStore({ tenantId: actorTenantId, principalId, traceId, callId, content, metadata, idempotencyKey }) {
      const embedding = await embedQuery(content);
      assertEmbedding(embedding);
      const requestSha256 = digest(stableJson({ actorTenantId, content, metadata }));
      const contentSha256 = digest(content);
      const durableKey = digest(`${actorTenantId}:${MEMORY_SCOPE}:${idempotencyKey}`);
      const speakerId = `mcp:${digest(principalId).slice(0, FIB[10])}`;
      const serverMetadata = {
        ...metadata,
        principalId,
        traceId,
        source: "mcp-intelligence",
        model: LOCKED_MODEL.id,
      };
      const provenance = [{ kind: "mcp-tool-call", principalId, traceId }];

      return withDb(getDbPort, (port) => port.tx(async (tx) => {
        await tx.query("SELECT set_config('heady.tenant_id', $1, true)", [actorTenantId]);
        const existing = await tx.query(
          `SELECT request_sha256, status, result
             FROM idempotency_key
            WHERE key = $1 AND scope = $2
            FOR UPDATE`,
          [durableKey, MEMORY_SCOPE],
        );
        const prior = existing.rows[0];
        if (prior) {
          if (prior.request_sha256 !== requestSha256) throw new Error("idempotency key payload mismatch");
          if (prior.status !== "SUCCEEDED" || !prior.result) throw new Error("idempotent memory operation is incomplete");
          return { ...prior.result, replayed: true };
        }

        await tx.query(
          `INSERT INTO idempotency_key
             (key, scope, request_sha256, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'STARTED', now(), now())`,
          [durableKey, MEMORY_SCOPE, requestSha256],
        );
        await tx.query(SET_RUNTIME_ROLE);
        let inserted = await tx.query(
          `SELECT id, false AS stored
             FROM heady_runtime.context_fragment
            WHERE tenant_id = $1 AND content_sha256 = $2
            ORDER BY created_at
            LIMIT 1`,
          [actorTenantId, contentSha256],
        );
        if (!inserted.rows[0]) {
          await tx.query(
            `INSERT INTO heady_runtime.conversation_session (
               tenant_id, conversation_id, active_speaker_id,
               active_speaker_basis, active_speaker_confidence, revision, updated_at
             ) VALUES ($1, $2::uuid, $3, 'AUTHENTICATED', 1, 0, now())`,
            [actorTenantId, callId, speakerId],
          );
          const source = await tx.query(
            `INSERT INTO heady_runtime.context_source (
               tenant_id, trace_id, content_sha256, content, provenance, metadata,
               embedding_status, conversation_id, turn_id, speaker_id, speaker_basis,
               speaker_confidence, attribution, attribution_revision, created_at, updated_at
             ) VALUES (
               $1, $2::uuid, $3, $4, $5::jsonb, $6::jsonb,
               'READY', $2::uuid, $2::uuid, $7, 'AUTHENTICATED',
               1, $8::jsonb, 0, now(), now()
             ) RETURNING id`,
            [actorTenantId, callId, contentSha256, content, provenance, serverMetadata, speakerId, { method: "mcp-authenticated-principal", principalId }],
          );
          if (!source.rows[0]) throw new Error("tenant memory source insert returned no row");
          inserted = await tx.query(
            `INSERT INTO heady_runtime.context_fragment (
               tenant_id, source_id, content_sha256, content, embedding, embedding_model,
               provenance, metadata, source_updated_at, created_at, updated_at
             ) VALUES ($1, $2::uuid, $3, $4, $5::vector, $6, $7::jsonb, $8::jsonb, now(), now(), now())
             RETURNING id, true AS stored`,
            [actorTenantId, source.rows[0].id, contentSha256, content, vectorLiteral(embedding), LOCKED_MODEL.id, provenance, serverMetadata],
          );
        }
        await tx.query(RESET_RUNTIME_ROLE);
        if (!inserted.rows[0]) throw new Error("tenant memory insert returned no row");
        const outcome = {
          stored: inserted.rows[0].stored === true,
          replayed: false,
          id: String(inserted.rows[0].id),
          model: LOCKED_MODEL.id,
          dimension: LOCKED_MODEL.dim,
        };
        await tx.query(
          `INSERT INTO task_outbox (topic, payload, created_at)
           VALUES ('heady.action.memory.written', $1::jsonb, now())`,
          [{ memoryId: outcome.id, tenantId: actorTenantId, traceId, contentSha256 }],
        );
        await tx.query(
          `UPDATE idempotency_key
              SET result = $3::jsonb, status = 'SUCCEEDED', updated_at = now()
            WHERE key = $1 AND scope = $2`,
          [durableKey, MEMORY_SCOPE, outcome],
        );
        return outcome;
      }));
    },
    taskEnqueue: ({ traceId, ...input }) => tasks.enqueue(input, { traceId }),
    taskStatus: (taskId) => tasks.get(taskId),
    heady990Search: (input) => heady990.search(input),
    heady990GetOrg: (ein) => heady990.getOrg(ein),
    heady990GetFilings: (ein) => heady990.getFilings(ein),
  };

  gateway = createMcpIntelligenceGateway({
    runtime,
    intelligence: intelligencePipeline,
    audit,
    publish: (subject, payload) => events.publish(subject, payload),
    log,
  });

  const handler = createMcpHandler((requestContext) => {
    const server = new McpServer({ name: "heady-mcp-intelligence", version: "1.0.0" });
    for (const definition of gateway.advertised()) {
      const Receipt = z.object({
        callId: z.string().uuid(),
        recordSha256: z.string().length(HASH_HEX_LENGTH),
        responseSha256: z.string().length(HASH_HEX_LENGTH),
      });
      const Output = z.object({ result: definition.outputSchema, receipt: Receipt });
      server.registerTool(definition.name, {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema,
        outputSchema: Output,
        annotations: {
          readOnlyHint: definition.risk === "read",
          destructiveHint: false,
          idempotentHint: definition.risk === "read" || definition.name === "heady_memory_store",
          openWorldHint: false,
        },
      }, async (input, toolContext) => {
        state.calls += 1;
        const progressToken = toolContext.mcpReq._meta?.progressToken;
        try {
          const completed = await gateway.invoke(definition.name, input, {
            authInfo: requestContext.authInfo,
            traceId: requestContext.requestInfo?.headers.get("x-heady-trace-id") ?? undefined,
            signal: toolContext.mcpReq.signal,
            progress: progressToken === undefined
              ? async () => {}
              : (update) => toolContext.mcpReq.notify({
                method: "notifications/progress",
                params: { progressToken, progress: update.progress, total: update.total, message: update.message },
              }),
          });
          const structuredContent = { result: completed.output, receipt: completed.receipt };
          return { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
        } catch (error) {
          state.failures += 1;
          throw error;
        }
      });
    }
    return server;
  }, {
    legacy: "stateless",
    responseMode: "auto",
    keepAliveMs: HEARTBEAT_MS,
    onerror: (error) => log.error({ err: String(error?.message ?? error) }, "MCP protocol error"),
  });
  const nodeHandler = toNodeHandler(handler, {
    onerror: (error) => log.error({ err: String(error?.message ?? error) }, "MCP Node transport error"),
  });

  async function guard(req, res, next) {
    if (!state.enabled) return jsonRpcError(res, 503, "MCP service is disabled");
    if (!state.running) return jsonRpcError(res, 503, "MCP service is not running");
    if (allowedHosts.length === 0) return jsonRpcError(res, 503, "MCP allowed hosts are not configured");
    const host = validateHostHeader(req.headers.host, allowedHosts);
    if (!host.ok) return jsonRpcError(res, 403, host.message);
    const origin = validateOriginHeader(req.headers.origin, allowedOrigins);
    if (!origin.ok) return jsonRpcError(res, 403, origin.message);
    if (typeof authenticator !== "function") return jsonRpcError(res, 503, "MCP authentication is not configured");

    try {
      const authInfo = await authenticator(req);
      if (!authInfo) {
        res.setHeader("WWW-Authenticate", 'Bearer realm="heady-mcp"');
        return jsonRpcError(res, 401, "invalid bearer token");
      }
      req.auth = authInfo;
      return next();
    } catch (error) {
      log.error({ err: String(error?.message ?? error) }, "MCP authentication failed");
      return jsonRpcError(res, 401, "authentication failed");
    }
  }

  function routes(app) {
    app.use(MCP_PATHS, guard);
    for (const path of MCP_PATHS) {
      app.post(path, (req, res) => nodeHandler(req, res, req.body));
      app.all(path, (_req, res) => {
        res.setHeader("Allow", "POST");
        return jsonRpcError(res, 405, "method not allowed");
      });
    }
  }

  const service = {
    name: "mcp-intelligence",
    deps: ["intelligence", "events", "tasks", "heady990"],
    start: async () => {
      if (!state.enabled) {
        log.info({}, "MCP intelligence gateway disabled");
        return;
      }
      state.running = true;
      try {
        state.auditReady = await audit.ready();
        state.auditReason = state.auditReady ? "ready" : "migration 0013 or Neon audit store is unavailable";
      } catch (error) {
        state.auditReady = false;
        state.auditReason = String(error?.message ?? error);
      }
      if (typeof getDbPort !== "function" || typeof embedQuery !== "function") {
        state.semanticReady = false;
        state.semanticReason = "Neon DbPort and locked Workers AI embedder are required";
      } else {
        try {
          const present = await withDb(getDbPort, (port) => port.tx(async (tx) => {
            await tx.query(SET_RUNTIME_ROLE);
            const result = await tx.query(
              `SELECT to_regclass('heady_runtime.context_fragment') IS NOT NULL
                      AND has_table_privilege(current_user, 'heady_runtime.context_fragment', 'SELECT')
                      AND has_table_privilege(current_user, 'heady_runtime.context_fragment', 'INSERT')
                      AND has_table_privilege(current_user, 'heady_runtime.context_source', 'INSERT')
                      AND has_table_privilege(current_user, 'heady_runtime.conversation_session', 'INSERT') AS ready`,
            );
            return result.rows[0]?.ready === true;
          }));
          state.semanticReady = present;
          state.semanticReason = present ? "ready" : "tenant-bound context_fragment is unavailable";
        } catch (error) {
          state.semanticReady = false;
          state.semanticReason = String(error?.message ?? error);
        }
      }
      log.info({ auditReady: state.auditReady, semanticReady: state.semanticReady, sourceAuthority: SOURCE_AUTHORITY }, "MCP intelligence gateway probed");
    },
    stop: async () => {
      state.running = false;
      await handler.close();
    },
    health: async () => {
      if (!state.enabled) return { status: HEALTH.OK, mode: "disabled" };
      if (!state.running) return { status: HEALTH.DOWN, reason: "not running" };
      if (typeof authenticator !== "function" || allowedHosts.length === 0 || !state.auditReady) {
        return { status: HEALTH.DOWN, audit: state.auditReason, semanticMemory: state.semanticReason };
      }
      return { status: state.semanticReady ? HEALTH.OK : HEALTH.DEGRADED, audit: state.auditReason, semanticMemory: state.semanticReason };
    },
    metrics: async () => ({ calls: state.calls, failures: state.failures, advertisedTools: gateway.advertised().length }),
  };

  return { service, routes, gateway, state: () => ({ ...state }), audit };
}

export { SOURCE_AUTHORITY };
