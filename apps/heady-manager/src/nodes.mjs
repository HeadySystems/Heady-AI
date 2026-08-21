// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ AI Nodes Orchestration v1.0.0                           ║
// ║  Authenticated node registry, durable dispatch, and audit        ║
// ║  projection over the Neon task ledger and transactional outbox.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createTask } from "@heady/task-ledger";
import { SUBJECT } from "@heady/events";
import { currentTraceId } from "@heady/logger";
import { FIB, HEARTBEAT_MS } from "@heady/phi-math";
import { HEALTH } from "@heady/shared";

const runtimeRoster = [
  ["HEADY_BRAIN", "heady-brain", "Core Pipeline", "Inference and reasoning"],
  ["HEADY_BUDDY", "heady-buddy", "Core Pipeline", "Authenticated companion interaction"],
  ["HEADY_SOUL", "heady-soul", "Core Pipeline", "Values and coherence reflection"],
  ["HEADY_CONDUCTOR", "heady-conductor", "Core Pipeline", "Workflow coordination"],
  ["HEADY_ORCHESTRATOR", "heady-orchestrator", "Core Pipeline", "Durable task orchestration"],
  ["HEADY_PATTERNS", "heady-patterns", "Core Pipeline", "Resilience and fallback patterns"],
  ["HEADY_AWARE", "heady-aware", "Core Pipeline", "Runtime awareness and telemetry"],
  ["HEADY_CORRECTIONS", "heady-corrections", "Core Pipeline", "Attributable corrective records"],
  ["HEADY_QA", "heady-qa", "Core Pipeline", "Verification and quality gates"],
  ["HEADY_VINCI", "heady-vinci", "Core Pipeline", "Creative experience generation"],
  ["HEADY_MEMORY", "heady-memory", "Intelligence", "Tenant-isolated semantic memory"],
  ["HEADY_EMBED", "heady-embed", "Intelligence", "384-dimension embedding projection"],
  ["HEADY_VECTOR", "heady-vector", "Intelligence", "Vector retrieval and ranking"],
  ["HEADY_INFER", "heady-infer", "Intelligence", "Predictive inference"],
  ["HEADY_FOUNDRY", "heady-foundry", "Intelligence", "Model and intelligence assembly"],
  ["HEADY_MCP", "heady-mcp", "Integration", "MCP protocol gateway"],
  ["HEADY_IO", "heady-io", "Integration", "External system input and output"],
  ["HEADY_BEE_FACTORY", "heady-bee-factory", "Integration", "Governed worker construction"],
  ["HEADY_GUARD", "heady-guard", "Integration", "Threat and boundary enforcement"],
  ["HEADY_GOVERNANCE", "heady-governance", "Integration", "Policy and approval enforcement"],
  ["HEADY_DISTILLER", "heady-distiller", "Integration", "Evidence distillation"],
];

const attributionRoster = [
  ["CONDUCTOR", "Decision", "Primary task routing and orchestration", "heady-conductor"],
  ["OVERMIND", "Decision", "Cross-node synthesis and strategy", "heady-orchestrator"],
  ["GOVERNANCE", "Decision", "Policy and authorization gates", "heady-governance"],
  ["OBSERVER", "Observation", "Runtime telemetry and anomaly observation", "heady-aware"],
  ["PYTHIA", "Observation", "Forecasting and scenario analysis", "heady-infer"],
  ["ATLAS", "Observation", "System and knowledge mapping", "heady-memory"],
  ["BUILDER", "Creation", "Application and service construction", "heady-bee-factory"],
  ["JULES", "Creation", "Governed software implementation", "heady-bee-factory"],
  ["FORGE", "Creation", "Integration and artifact assembly", "heady-foundry"],
  ["STUDIO", "Creation", "Experience and media production", "heady-vinci"],
  ["SENTINEL", "Security", "Threat detection and security posture", "heady-guard"],
  ["PERSONA", "Security", "Identity, tenant, and persona boundaries", "heady-buddy"],
  ["DIPLOMAT", "Business", "External coordination and negotiation", "heady-io"],
  ["ARBITER", "Business", "Independent review and dispute resolution", "heady-governance"],
  ["QUANT", "Business", "Quantitative and financial analysis", "heady-infer"],
  ["EMISSARY", "Specialized", "External communication and delivery", "heady-mcp"],
  ["FABRICATOR", "Specialized", "Tool and connector fabrication", "heady-bee-factory"],
  ["DREAMER", "Specialized", "Generative ideation and exploration", "heady-brain"],
  ["NEXUS", "Specialized", "Cross-system relationship coordination", "heady-orchestrator"],
];

export const HEADY_MATHEMATICAL_CORE = Object.freeze([
  Object.freeze({ id: "TENSOR", responsibility: "CSL geometric arithmetic" }),
  Object.freeze({ id: "TOPOLOGY", responsibility: "Spatial clustering and dependency topology" }),
]);

export const HEADY_NODE_ROSTER = Object.freeze(runtimeRoster.map(([id, slug, group, responsibility]) => Object.freeze({
  id,
  slug,
  group,
  responsibility,
  dispatchSubject: SUBJECT.agent(`${slug}.action.requested`),
  observationSubject: SUBJECT.agent(`${slug}.observation.>`),
})));

export const HEADY_ATTRIBUTION_ROSTER = Object.freeze(attributionRoster.map(([id, plane, responsibility, runtimeNode]) => Object.freeze({
  id,
  slug: id.toLowerCase(),
  plane,
  responsibility,
  runtimeNode,
})));

const runtimeNodesByKey = new Map(HEADY_NODE_ROSTER.flatMap((node) => [[node.id, node], [node.slug.toUpperCase(), node]]));
const attributionById = new Map(HEADY_ATTRIBUTION_ROSTER.map((role) => [role.id, role]));
const ACTION_RE = /^[a-z][a-z0-9._-]*$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9._:-]+$/;
const dispatchSchema = z.object({
  action: z.string().trim().min(1).max(FIB[10]).regex(ACTION_RE),
  input: z.record(z.unknown()).default({}),
  dependsOn: z.array(z.string().uuid()).max(FIB[8]).default([]),
}).strict();
const idempotencySchema = z.string().trim().min(FIB[5]).max(FIB[12]).regex(IDEMPOTENCY_RE);
const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(FIB[10]).default(FIB[8]),
  node: z.string().trim().toUpperCase().optional(),
}).strict();
const taskIdSchema = z.string().uuid();
const heartbeatSchema = z.object({
  revision: z.string().trim().min(1).max(FIB[10]),
  status: z.enum(["STARTING", "READY", "DEGRADED", "DRAINING"]),
  metadata: z.record(z.unknown()).default({}),
}).strict();

function digest(value) {
  return createHash("sha256").update(String(value), "utf8").digest();
}

function errorDetails(error) {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

function attributionFor(raw) {
  return attributionById.get(String(raw ?? "").toUpperCase()) ?? null;
}

function dispatchTargetFor(raw) {
  const key = String(raw ?? "").toUpperCase();
  const attribution = attributionById.get(key) ?? null;
  const runtimeNode = attribution
    ? runtimeNodesByKey.get(attribution.runtimeNode.toUpperCase())
    : runtimeNodesByKey.get(key);
  return runtimeNode ? { attribution, runtimeNode } : null;
}

/**
 * Build the governed 21-context runtime registry and its durable dispatch/audit routes.
 * The transactional outbox is authoritative; SSE delivery is a best-effort projection.
 */
export function createNodesService({ log, publish, getDbPort = null, getInternalSecret = null, getEventTransportStatus = () => ({ name: "in-memory", ready: false }) } = {}) {
  const disabled = getDbPort === null && getInternalSecret === null;
  let port = null;
  let secretDigest = null;
  let lastError = null;
  let accepted = 0;
  let deduplicated = 0;
  let denied = 0;
  let auditAppendOnlyEnforced = false;
  let heartbeatRegistryReady = false;
  let activeNodes = 0;
  let heartbeats = new Map();
  let outboxProjectorTimer = null;
  let projected = 0;
  let projectionFailures = 0;

  async function refreshRuntimeEvidence() {
    if (!port) return;
    const integrity = await port.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM pg_trigger
            WHERE tgrelid = 'public.task_outbox'::regclass
              AND tgname = 'task_outbox_append_only'
              AND NOT tgisinternal
         ) AS outbox_guard,
         to_regclass('heady_runtime.node_heartbeat') IS NOT NULL AS heartbeat_registry`,
    );
    auditAppendOnlyEnforced = integrity.rows[0]?.outbox_guard === true;
    heartbeatRegistryReady = integrity.rows[0]?.heartbeat_registry === true;
    if (heartbeatRegistryReady) {
      const heartbeat = await port.query(
        `SELECT node_id, revision, status, metadata, observed_at,
                observed_at >= now() - ($1::bigint * interval '1 millisecond') AS fresh
           FROM heady_runtime.node_heartbeat
          ORDER BY node_id ASC`,
        [HEARTBEAT_MS * FIB[5]],
      );
      heartbeats = new Map(heartbeat.rows.map((row) => [row.node_id, row]));
      activeNodes = heartbeat.rows.filter((row) => row.status === "READY" && row.fresh === true).length;
    } else {
      heartbeats = new Map();
      activeNodes = 0;
    }
  }

  async function projectNodeOutbox() {
    if (!port || !getEventTransportStatus().ready) return;
    await port.tx(async (tx) => {
      const result = await tx.query(
        `SELECT seq, topic, payload
           FROM task_outbox
          WHERE dispatched_at IS NULL
            AND topic LIKE 'agent.%'
          ORDER BY seq ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED`,
        [FIB[8]],
      );
      for (const row of result.rows) {
        try {
          await publish(row.topic, row.payload, { id: String(row.seq), source: "neon.task_outbox", flush: true });
          await tx.query(
            "UPDATE task_outbox SET dispatched_at = now() WHERE seq = $1 AND dispatched_at IS NULL",
            [row.seq],
          );
          projected += 1;
        } catch (error) {
          projectionFailures += 1;
          log.warn({ err: String(error?.message ?? error), seq: row.seq, topic: row.topic }, "node outbox projection deferred");
          break;
        }
      }
    });
  }

  function readiness() {
    const ledgerReady = port !== null;
    const authReady = secretDigest !== null;
    const registryReady = HEADY_NODE_ROSTER.length === FIB[8] && HEADY_ATTRIBUTION_ROSTER.length === FIB[8] - FIB[3];
    const transport = getEventTransportStatus();
    const productionReady = ledgerReady
      && authReady
      && registryReady
      && auditAppendOnlyEnforced
      && heartbeatRegistryReady
      && transport.ready
      && activeNodes > 0;
    return {
      mode: disabled ? "disabled" : "configured",
      registryReady,
      ledgerReady,
      authReady,
      dispatchAccepting: ledgerReady && authReady,
      registeredNodes: HEADY_NODE_ROSTER.length,
      runtimeNodeCount: FIB[8],
      attributionRoleCount: HEADY_ATTRIBUTION_ROSTER.length,
      skillClaimedAttributionCount: FIB[8] - 1,
      taxonomyNote: "The integration skill enumerates 19 attribution roles despite claiming 20; runtime authority is the 21 bounded-context master-plan roster.",
      mathematicalCoreEntries: HEADY_MATHEMATICAL_CORE.length,
      activeNodes,
      workerHeartbeatSource: heartbeatRegistryReady ? "neon.heady_runtime.node_heartbeat" : "not-configured",
      authoritativeAudit: "neon.task_outbox",
      auditAppendOnlyEnforced,
      deliveryProjection: "nats-with-in-process-sse",
      eventTransport: transport,
      productionReady,
      blockers: [
        ...(ledgerReady ? [] : ["neon task ledger unavailable"]),
        ...(authReady ? [] : ["internal node authentication unavailable"]),
        ...(HEADY_NODE_ROSTER.length === FIB[8] ? [] : ["runtime node registry does not contain 21 bounded contexts"]),
        ...(HEADY_ATTRIBUTION_ROSTER.length === FIB[8] - FIB[3] ? [] : ["attribution role registry does not match the skill's 19 enumerated roles"]),
        ...(heartbeatRegistryReady ? [] : ["no durable worker heartbeat registry"]),
        ...(transport.ready ? [] : ["NATS transport unavailable"]),
        ...(heartbeatRegistryReady && activeNodes === 0 ? ["no active runtime-node heartbeats"] : []),
        ...(auditAppendOnlyEnforced ? [] : ["task_outbox lacks append-only/tamper-evident enforcement"]),
      ],
      error: lastError,
    };
  }

  async function start() {
    if (disabled) {
      log.info({}, "nodes service: disabled (no production factories configured)");
      return;
    }
    const errors = [];
    if (getDbPort === null) {
      errors.push("DbPort factory missing");
    } else {
      try {
        port = await getDbPort();
        await port.connect();
        await port.query("SELECT 1");
        await refreshRuntimeEvidence();
      } catch (error) {
        port = null;
        errors.push(`Neon unavailable: ${String(error?.message ?? error)}`);
      }
    }
    if (getInternalSecret === null) {
      errors.push("internal secret factory missing");
    } else {
      try {
        const secret = await getInternalSecret();
        if (typeof secret !== "string" || secret.length < FIB[8] - FIB[5]) {
          throw new TypeError("INTERNAL_NODE_SECRET is invalid");
        }
        secretDigest = digest(secret);
      } catch (error) {
        secretDigest = null;
        errors.push(`node auth unavailable: ${String(error?.message ?? error)}`);
      }
    }
    lastError = errors.length > 0 ? errors.join("; ") : null;
    if (port && !outboxProjectorTimer) {
      outboxProjectorTimer = setInterval(() => {
        projectNodeOutbox().catch((error) => {
          projectionFailures += 1;
          log.warn({ err: String(error?.message ?? error) }, "node outbox projection sweep failed");
        });
      }, Math.round(HEARTBEAT_MS / FIB[8]));
      outboxProjectorTimer.unref?.();
    }
    if (lastError) log.warn({ err: lastError }, "nodes service degraded");
    else log.info({ registeredNodes: HEADY_NODE_ROSTER.length }, "nodes service dispatch ledger armed");
  }

  async function stop() {
    if (outboxProjectorTimer) clearInterval(outboxProjectorTimer);
    outboxProjectorTimer = null;
    if (port) await port.end();
    port = null;
    secretDigest = null;
    auditAppendOnlyEnforced = false;
    heartbeatRegistryReady = false;
    activeNodes = 0;
    heartbeats = new Map();
  }

  function requireInternalNode(req, res, next) {
    if (!secretDigest) {
      denied += 1;
      return res.status(503).json({ error: "node_auth_unavailable" });
    }
    const authorization = String(req.header("authorization") ?? "");
    const bearer = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
    const provided = req.header("x-heady-internal-secret") ?? bearer;
    if (!provided || !timingSafeEqual(digest(provided), secretDigest)) {
      denied += 1;
      return res.status(401).json({ error: "unauthorized" });
    }
    const actorRole = attributionFor(req.header("x-heady-actor-node"));
    if (!actorRole) {
      denied += 1;
      return res.status(400).json({ error: "invalid_actor", details: ["x-heady-actor-node must identify a registered Heady node"] });
    }
    const requestedBy = String(req.header("x-heady-user") ?? "").trim();
    req.headyActor = {
      authType: "internal_node_secret",
      node: actorRole.id,
      subject: `node:${actorRole.slug}`,
      ...(requestedBy ? { requestedBy } : {}),
    };
    return next();
  }

  function routes(app) {
    app.get("/api/nodes", (_req, res) => {
      const state = readiness();
      return res.json({
        total: HEADY_NODE_ROSTER.length,
        registered: HEADY_NODE_ROSTER.length,
        active: state.activeNodes,
        dispatchAccepting: state.dispatchAccepting,
        productionReady: state.productionReady,
        nodes: HEADY_NODE_ROSTER.map((node) => {
          const heartbeat = heartbeats.get(node.id) ?? null;
          const live = heartbeat?.status === "READY" && heartbeat?.fresh === true;
          return {
            ...node,
            state: heartbeat?.status?.toLowerCase() ?? "registered",
            live,
            heartbeat: heartbeat ? {
              revision: heartbeat.revision,
              status: heartbeat.status,
              observedAt: heartbeat.observed_at,
              fresh: heartbeat.fresh,
              metadata: heartbeat.metadata,
            } : null,
          };
        }),
        attributionRoles: HEADY_ATTRIBUTION_ROSTER,
      });
    });

    app.get("/api/orchestration/readiness", (_req, res) => {
      const state = readiness();
      return res.status(state.productionReady ? 200 : 503).json(state);
    });

    app.post("/api/nodes/:nodeId/heartbeat", requireInternalNode, async (req, res) => {
      const target = dispatchTargetFor(req.params.nodeId);
      if (!target) return res.status(404).json({ error: "node_not_found" });
      const parsed = heartbeatSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_request", details: errorDetails(parsed.error) });
      if (!port || !heartbeatRegistryReady) return res.status(503).json({ error: "node_heartbeat_registry_unavailable" });
      try {
        const result = await port.query(
          `INSERT INTO heady_runtime.node_heartbeat (node_id, revision, status, metadata, observed_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (node_id) DO UPDATE
             SET revision = EXCLUDED.revision,
                 status = EXCLUDED.status,
                 metadata = EXCLUDED.metadata,
                 observed_at = EXCLUDED.observed_at
           RETURNING node_id, revision, status, observed_at`,
          [target.runtimeNode.id, parsed.data.revision, parsed.data.status, parsed.data.metadata],
        );
        await refreshRuntimeEvidence();
        log.info({ node: target.runtimeNode.id, status: parsed.data.status, actorNode: req.headyActor.node }, "node heartbeat recorded");
        return res.status(200).json(result.rows[0]);
      } catch (error) {
        log.error({ err: String(error?.message ?? error), node: target.runtimeNode.id }, "node heartbeat write failed");
        return res.status(500).json({ error: "node_heartbeat_write_failed" });
      }
    });

    app.get("/api/nodes/audit", requireInternalNode, async (req, res) => {
      const parsed = auditQuerySchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "invalid_request", details: errorDetails(parsed.error) });
      const filterTarget = parsed.data.node ? dispatchTargetFor(parsed.data.node) : null;
      if (parsed.data.node && !filterTarget) return res.status(400).json({ error: "invalid_node" });
      if (!port) return res.status(503).json({ error: "node_ledger_unavailable" });
      try {
        const result = await port.query(
          `SELECT o.seq, o.task_id, o.topic, o.payload, o.created_at, o.dispatched_at,
                  t.kind, t.status
             FROM task_outbox o
             JOIN task t ON t.id = o.task_id
            WHERE t.kind LIKE 'node:%'
              AND ($1::text IS NULL OR split_part(t.kind, ':', 2) = $1)
            ORDER BY o.seq DESC
            LIMIT $2`,
          [filterTarget?.runtimeNode.slug ?? null, parsed.data.limit],
        );
        return res.json({
          authority: "neon.task_outbox",
          appendOnlyEnforced: auditAppendOnlyEnforced,
          events: result.rows,
        });
      } catch (error) {
        log.error({ err: String(error?.message ?? error) }, "node audit read failed");
        return res.status(500).json({ error: "audit_read_failed" });
      }
    });

    app.get("/api/orchestration/tasks/:taskId", requireInternalNode, async (req, res) => {
      const parsedId = taskIdSchema.safeParse(req.params.taskId);
      if (!parsedId.success) return res.status(400).json({ error: "invalid_request", details: errorDetails(parsedId.error) });
      if (!port) return res.status(503).json({ error: "node_ledger_unavailable" });
      try {
        const task = await port.query(
          "SELECT id, kind, status, created_at, updated_at FROM task WHERE id = $1 AND kind LIKE 'node:%'",
          [parsedId.data],
        );
        if (task.rows.length === 0) return res.status(404).json({ error: "not_found" });
        const audit = await port.query(
          "SELECT seq, topic, created_at, dispatched_at FROM task_outbox WHERE task_id = $1 ORDER BY seq ASC",
          [parsedId.data],
        );
        return res.json({ ...task.rows[0], audit: audit.rows });
      } catch (error) {
        log.error({ err: String(error?.message ?? error) }, "node task read failed");
        return res.status(500).json({ error: "node_task_read_failed" });
      }
    });

    app.post("/api/nodes/:nodeId/dispatch", requireInternalNode, async (req, res) => {
      const target = dispatchTargetFor(req.params.nodeId);
      if (!target) return res.status(404).json({ error: "node_not_found" });
      const parsed = dispatchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_request", details: errorDetails(parsed.error) });
      const parsedKey = idempotencySchema.safeParse(req.header("idempotency-key"));
      if (!parsedKey.success) return res.status(400).json({ error: "invalid_request", details: [{ path: "idempotency-key", message: "valid idempotency-key header required" }] });
      if (!port) return res.status(503).json({ error: "node_ledger_unavailable" });

      const traceId = currentTraceId() ?? null;
      const scope = `node:${target.runtimeNode.slug}`;
      try {
        const outcome = await port.tx(async (tx) => {
          const existing = await tx.query("SELECT result FROM idempotency_key WHERE key = $1 AND scope = $2", [parsedKey.data, scope]);
          if (existing.rows.length > 0) return { task: existing.rows[0].result, created: false };
          const task = await createTask(tx, {
            kind: `node:${target.runtimeNode.slug}:${parsed.data.action}`,
            input: {
              node: target.runtimeNode.id,
              attributionRole: target.attribution?.id ?? null,
              action: parsed.data.action,
              arguments: parsed.data.input,
              actor: req.headyActor,
              traceId,
            },
            dependencies: parsed.data.dependsOn,
            idempotencyKey: parsedKey.data,
            scope,
          });
          await tx.query(
            "INSERT INTO task_outbox (task_id, topic, payload, created_at) VALUES ($1, $2, $3, now())",
            [task.task_id, target.runtimeNode.dispatchSubject, JSON.stringify({
              taskId: task.task_id,
              node: target.runtimeNode.id,
              attributionRole: target.attribution?.id ?? null,
              action: parsed.data.action,
              actor: req.headyActor,
              traceId,
            })],
          );
          return { task, created: true };
        });

        if (!outcome.created) {
          deduplicated += 1;
          return res.status(200).json({ taskId: outcome.task.task_id, status: outcome.task.status, deduplicated: true });
        }
        accepted += 1;
        try {
          const projection = await publish(target.runtimeNode.dispatchSubject, {
            taskId: outcome.task.task_id,
            node: target.runtimeNode.id,
            attributionRole: target.attribution?.id ?? null,
            action: parsed.data.action,
            actor: req.headyActor,
            traceId,
          });
          if (projection?.errors?.length) {
            log.warn({ node: target.runtimeNode.id, taskId: outcome.task.task_id, errors: projection.errors.length }, "node dispatch projection had subscriber errors");
          }
        } catch (error) {
          projectionFailures += 1;
          log.warn({ err: String(error?.message ?? error), node: target.runtimeNode.id, taskId: outcome.task.task_id }, "node dispatch committed; immediate projection deferred to outbox");
        }
        log.info({ node: target.runtimeNode.id, attributionRole: target.attribution?.id ?? null, actorNode: req.headyActor.node, taskId: outcome.task.task_id }, "node dispatch durably accepted");
        return res.status(202).json({ taskId: outcome.task.task_id, status: outcome.task.status, node: target.runtimeNode.id, attributionRole: target.attribution?.id ?? null, deduplicated: false });
      } catch (error) {
        log.error({ err: String(error?.message ?? error), node: target.runtimeNode.id }, "node dispatch failed");
        return res.status(500).json({ error: "node_dispatch_failed" });
      }
    });
  }

  const service = {
    name: "nodes",
    deps: ["events", "tasks"],
    start,
    stop,
    health: async () => {
      const state = readiness();
      if (disabled) return { status: HEALTH.OK, mode: "disabled" };
      return { status: state.dispatchAccepting ? HEALTH.DEGRADED : HEALTH.DOWN, ...state };
    },
    metrics: async () => ({ accepted, deduplicated, denied, projected, projectionFailures, ...readiness() }),
  };

  return { service, routes, readiness, projectNodeOutbox };
}
