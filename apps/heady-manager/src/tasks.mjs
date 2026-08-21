// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — Tasks service (the GATE-2 write path)     ║
// ║  Realizes the OpenAPI contract (enqueueTask / getTask) over the     ║
// ║  live DbPort + @heady/task-ledger: POST /tasks writes task +        ║
// ║  outbox in ONE Neon transaction; every hop carries the             ║
// ║  X-Heady-Trace-Id (pino async context → span exporter tags →       ║
// ║  SSE payloads). Kernel-managed {start,stop,health,metrics};         ║
// ║  degrades honestly (503 + DEGRADED health) when the DB is           ║
// ║  unreachable — never fake-succeeds. © 2026 HeadySystems Inc.       ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createTask } from "@heady/task-ledger";
import { startSpan, captureError, metrics, noopExporter } from "@heady/observability";
import { currentTraceId } from "@heady/logger";
import { HEALTH } from "@heady/shared";
import { validateEnqueueTask, TASK_UUID_RE } from "@heady/contracts";

const UUID_RE = TASK_UUID_RE;

/** Strict boundary validation — the shape's single authority is @heady/contracts
 *  (components.schemas.EnqueueTask); this alias keeps existing importers stable. */
export const validateEnqueue = validateEnqueueTask;

/**
 * Build the tasks service + routes.
 * @param {object} opts
 * @param {object} opts.log pino-style logger (trace ids flow via async context)
 * @param {Function} opts.publish SSE/event-bus hook — publish(subject, payload)
 * @param {() => Promise<object>} opts.getDbPort async DbPort factory (called at
 *   start; the composition root owns secret resolution — this service never
 *   reads env/vault itself)
 * @param {object} [opts.exporter] observability exporter (Sentry adapter or noop)
 * @param {object} [opts.registry] metrics registry
 */
export function createTasksService({ log, publish, getDbPort = null, exporter = noopExporter, registry = metrics }) {
  let port = null;
  let lastError = null;
  const disabled = getDbPort === null; // no factory = deliberate (dev/test) state

  const service = {
    name: "tasks",
    start: async () => {
      if (disabled) {
        log.info({}, "tasks service: disabled (no DbPort factory configured)");
        return;
      }
      try {
        port = await getDbPort();
        await port.connect();
        await port.query("SELECT 1"); // prove the session, not just the config
        lastError = null;
        log.info({}, "tasks service: live DbPort connected");
      } catch (err) {
        // Degrade honestly: the origin still serves, /tasks answers 503, health says why.
        port = null;
        lastError = String(err?.message ?? err);
        log.warn({ err: lastError }, "tasks service: DB unavailable — degraded (503 on /tasks)");
      }
    },
    stop: async () => { if (port) await port.end(); port = null; },
    health: async () => {
      if (port) return { status: HEALTH.OK };
      if (disabled) return { status: HEALTH.OK, mode: "disabled" }; // absence of config ≠ failure
      return { status: HEALTH.DEGRADED, reason: lastError ?? "db not connected" };
    },
    metrics: async () => {
      const snap = registry.snapshot();
      return {
        enqueued: snap.counters["tasks.enqueued"] ?? 0,
        reads: snap.counters["tasks.reads"] ?? 0,
        errors: snap.counters["errors.total"] ?? 0,
        exporter: exporter.stats ? exporter.stats() : "noop",
      };
    },
  };

  function unavailableReason() {
    return disabled ? "tasks disabled (no DbPort configured)" : (lastError ?? "db not connected");
  }

  async function enqueue(value, { traceId = currentTraceId() ?? null } = {}) {
    const validated = validateEnqueue(value);
    if (!validated.ok) {
      const error = new Error("invalid task request");
      error.code = "invalid_request";
      error.details = validated.errors;
      throw error;
    }
    if (!port) {
      const error = new Error(unavailableReason());
      error.code = "tasks_unavailable";
      throw error;
    }

    const span = startSpan("tasks.enqueue", { kind: value.kind }, { exporter, registry });
    try {
      const created = await port.tx((tx) => createTask(tx, {
        kind: value.kind, input: value.input, dependencies: value.deps ?? [],
      }));
      registry.counter("tasks.enqueued").inc();
      span.end({ taskId: created.task_id, status: created.status });
      await publish("task.created", { taskId: created.task_id, kind: created.kind, status: created.status, traceId });
      log.info({ taskId: created.task_id, kind: created.kind }, "task enqueued");
      return { taskId: created.task_id, status: created.status };
    } catch (err) {
      span.end({ failed: true });
      captureError(err, { operation: "tasks.enqueue", kind: value.kind }, { exporter, registry });
      throw err;
    }
  }

  async function get(taskId) {
    if (!UUID_RE.test(taskId)) {
      const error = new Error("taskId must be a UUID");
      error.code = "invalid_request";
      throw error;
    }
    if (!port) {
      const error = new Error(unavailableReason());
      error.code = "tasks_unavailable";
      throw error;
    }

    const span = startSpan("tasks.get", {}, { exporter, registry });
    try {
      const result = await port.query("SELECT id, status, result FROM task WHERE id = $1", [taskId]);
      registry.counter("tasks.reads").inc();
      if (result.rows.length === 0) {
        const error = new Error("task not found");
        error.code = "not_found";
        throw error;
      }
      const row = result.rows[0];
      span.end({ found: true });
      return {
        taskId: row.id,
        status: row.status,
        ...(row.result === null || row.result === undefined ? {} : { result: row.result }),
      };
    } catch (err) {
      span.end({ failed: true });
      captureError(err, { operation: "tasks.get" }, { exporter, registry });
      throw err;
    }
  }

  function routes(app) {
    // POST /tasks — operationId: enqueueTask. Task + outbox row land in ONE
    // transaction (ADR-0002); the response echoes X-Heady-Trace-Id upstream.
    app.post("/tasks", async (req, res) => {
      try {
        return res.status(201).json(await enqueue(req.body));
      } catch (err) {
        log.error({ err: String(err?.message ?? err) }, "enqueue failed");
        if (err.code === "invalid_request") return res.status(400).json({ error: err.code, details: err.details });
        if (err.code === "tasks_unavailable") return res.status(503).json({ error: err.code, reason: err.message });
        return res.status(500).json({ error: "enqueue_failed" });
      }
    });

    // GET /tasks/:taskId — operationId: getTask.
    app.get("/tasks/:taskId", async (req, res) => {
      const { taskId } = req.params;
      try {
        return res.json(await get(taskId));
      } catch (err) {
        if (err.code === "invalid_request") return res.status(400).json({ error: err.code, details: [err.message] });
        if (err.code === "tasks_unavailable") return res.status(503).json({ error: err.code, reason: err.message });
        if (err.code === "not_found") return res.status(404).json({ error: err.code });
        return res.status(500).json({ error: "read_failed" });
      }
    });
  }

  return { service, routes, port: () => port, enqueue, get };
}
