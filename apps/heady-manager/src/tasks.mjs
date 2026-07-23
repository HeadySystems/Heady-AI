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

  function routes(app) {
    // POST /tasks — operationId: enqueueTask. Task + outbox row land in ONE
    // transaction (ADR-0002); the response echoes X-Heady-Trace-Id upstream.
    app.post("/tasks", async (req, res) => {
      const v = validateEnqueue(req.body);
      if (!v.ok) return res.status(400).json({ error: "invalid_request", details: v.errors });
      if (!port) return res.status(503).json({ error: "tasks_unavailable", reason: disabled ? "tasks disabled (no DbPort configured)" : (lastError ?? "db not connected") });

      const span = startSpan("tasks.enqueue", { kind: req.body.kind }, { exporter, registry });
      try {
        const created = await port.tx((tx) => createTask(tx, {
          kind: req.body.kind, input: req.body.input, dependencies: req.body.deps ?? [],
        }));
        registry.counter("tasks.enqueued").inc();
        span.end({ taskId: created.task_id, status: created.status });
        await publish("task.created", { taskId: created.task_id, kind: created.kind, status: created.status, traceId: currentTraceId() ?? null });
        log.info({ taskId: created.task_id, kind: created.kind }, "task enqueued");
        return res.status(201).json({ taskId: created.task_id, status: created.status });
      } catch (err) {
        span.end({ failed: true });
        captureError(err, { route: "POST /tasks", kind: req.body.kind }, { exporter, registry });
        log.error({ err: String(err?.message ?? err) }, "enqueue failed");
        return res.status(500).json({ error: "enqueue_failed" });
      }
    });

    // GET /tasks/:taskId — operationId: getTask.
    app.get("/tasks/:taskId", async (req, res) => {
      const { taskId } = req.params;
      if (!UUID_RE.test(taskId)) return res.status(400).json({ error: "invalid_request", details: ["taskId must be a UUID"] });
      if (!port) return res.status(503).json({ error: "tasks_unavailable", reason: disabled ? "tasks disabled (no DbPort configured)" : (lastError ?? "db not connected") });

      const span = startSpan("tasks.get", {}, { exporter, registry });
      try {
        const r = await port.query("SELECT id, status, result FROM task WHERE id = $1", [taskId]);
        registry.counter("tasks.reads").inc();
        span.end({ found: r.rows.length > 0 });
        if (r.rows.length === 0) return res.status(404).json({ error: "not_found" });
        const row = r.rows[0];
        const out = { taskId: row.id, status: row.status };
        if (row.result !== null && row.result !== undefined) out.result = row.result;
        return res.json(out);
      } catch (err) {
        span.end({ failed: true });
        captureError(err, { route: "GET /tasks/:taskId" }, { exporter, registry });
        return res.status(500).json({ error: "read_failed" });
      }
    });
  }

  return { service, routes, port: () => port };
}
