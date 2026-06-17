// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Task Ledger v1.0.0                                       ║
// ║  Transactional task scheduling, state machine, and outbox sync    ║
// ║  (Linear/Sentry). © 2026 HeadySystems Inc. — Eric Haywood, Founder ║
// ╚══════════════════════════════════════════════════════════════════╝

import { isValidStatus } from "@heady/db";
import { logger } from "@heady/logger";

const log = logger.child({ component: "task-ledger" });

/**
 * Creates a new task atomically within a transaction.
 * Resolves idempotency keys to prevent duplicate creation.
 *
 * @param {object} tx Database client/transaction executor (must support .query(sql, params))
 * @param {object} params
 * @param {string} params.kind The task classification
 * @param {object} params.input Input payload
 * @param {string} [params.idempotencyKey] Unique hash key
 * @param {string} [params.scope] Deduplication boundary (required if idempotencyKey is provided)
 * @param {string[]} [params.dependencies] Array of dependent Task UUIDs
 */
export async function createTask(tx, { kind, input, idempotencyKey, scope, dependencies = [] }) {
  if (!kind) throw new TypeError("createTask: kind is required");
  if (typeof input !== "object" || input === null) throw new TypeError("createTask: input must be an object");

  // 1. Resolve idempotency key if provided
  if (idempotencyKey) {
    if (!scope) throw new TypeError("createTask: scope is required when using an idempotency key");
    const checkSql = "SELECT result FROM idempotency_key WHERE key = $1 AND scope = $2";
    const checkRes = await tx.query(checkSql, [idempotencyKey, scope]);
    if (checkRes.rows.length > 0) {
      log.info({ idempotencyKey, scope }, "idempotency match found");
      return checkRes.rows[0].result;
    }
  }

  // 2. Insert new task
  const insertTaskSql = `
    INSERT INTO task (kind, input, status, created_at, updated_at)
    VALUES ($1, $2, 'PENDING', now(), now())
    RETURNING id, kind, input, status, created_at, updated_at
  `;
  const taskRes = await tx.query(insertTaskSql, [kind, JSON.stringify(input)]);
  const task = taskRes.rows[0];

  // Convert JSON strings back to objects
  task.input = JSON.parse(JSON.stringify(input));

  // 3. Write dependencies
  if (Array.isArray(dependencies) && dependencies.length > 0) {
    for (const depId of dependencies) {
      const depSql = "INSERT INTO task_dep (task_id, depends_on) VALUES ($1, $2)";
      await tx.query(depSql, [task.id, depId]);
    }
  }

  // 4. Record idempotency if provided
  const resultPayload = { task_id: task.id, kind: task.kind, status: task.status };
  if (idempotencyKey) {
    const idempSql = `
      INSERT INTO idempotency_key (key, scope, result, created_at)
      VALUES ($1, $2, $3, now())
    `;
    await tx.query(idempSql, [idempotencyKey, scope, JSON.stringify(resultPayload)]);
  }

  // 5. Emit transactional outbox record (Linear/Sentry sync triggers)
  const outboxSql = `
    INSERT INTO task_outbox (task_id, topic, payload, created_at)
    VALUES ($1, 'task:created', $2, now())
  `;
  await tx.query(outboxSql, [task.id, JSON.stringify(resultPayload)]);

  log.info({ taskId: task.id, kind }, "task created successfully");
  return resultPayload;
}

/**
 * Transitions task from PENDING to RUNNING and spawns an attempt log.
 *
 * @param {object} tx Database client/transaction executor
 * @param {string} taskId Task UUID
 */
export async function startTask(tx, taskId) {
  if (!taskId) throw new TypeError("startTask: taskId is required");

  // 1. Fetch task and check status machine invariant
  const fetchSql = "SELECT status, kind FROM task WHERE id = $1 FOR UPDATE";
  const fetchRes = await tx.query(fetchSql, [taskId]);
  if (fetchRes.rows.length === 0) throw new Error(`startTask: task ${taskId} not found`);
  
  const task = fetchRes.rows[0];
  if (task.status !== "PENDING") {
    throw new Error(`startTask: invalid state transition from ${task.status} to RUNNING`);
  }

  // 2. Transition task status
  const updateSql = "UPDATE task SET status = 'RUNNING', updated_at = now() WHERE id = $1";
  await tx.query(updateSql, [taskId]);

  // 3. Spawn attempt record
  const attemptSql = `
    INSERT INTO task_attempt (task_id, started_at)
    VALUES ($1, now())
    RETURNING id
  `;
  const attemptRes = await tx.query(attemptSql, [taskId]);
  const attemptId = attemptRes.rows[0].id;

  // 4. Emit outbox record
  const outboxSql = `
    INSERT INTO task_outbox (task_id, topic, payload, created_at)
    VALUES ($1, 'task:started', $2, now())
  `;
  const payload = { task_id: taskId, attempt_id: attemptId, status: "RUNNING" };
  await tx.query(outboxSql, [taskId, JSON.stringify(payload)]);

  log.info({ taskId, attemptId }, "task started");
  return attemptId;
}

/**
 * Resolves a task and logs attempt completion. Updates any active idempotency results.
 *
 * @param {object} tx Database client/transaction executor
 * @param {string} taskId Task UUID
 * @param {string} attemptId Attempt UUID
 * @param {object} resolution
 * @param {boolean} resolution.success True for SUCCEEDED, false for FAILED
 * @param {object} [resolution.result] Result payload if successful
 * @param {object} [resolution.error] Error details if failed
 */
export async function completeTask(tx, taskId, attemptId, { success, result, error }) {
  if (!taskId || !attemptId) throw new TypeError("completeTask: taskId and attemptId are required");
  if (typeof success !== "boolean") throw new TypeError("completeTask: success must be a boolean");

  const targetStatus = success ? "SUCCEEDED" : "FAILED";
  const topic = success ? "task:completed" : "task:failed";

  // 1. Fetch task state
  const fetchSql = "SELECT status, kind FROM task WHERE id = $1 FOR UPDATE";
  const fetchRes = await tx.query(fetchSql, [taskId]);
  if (fetchRes.rows.length === 0) throw new Error(`completeTask: task ${taskId} not found`);
  
  const task = fetchRes.rows[0];
  if (task.status !== "RUNNING") {
    throw new Error(`completeTask: invalid state transition from ${task.status} to ${targetStatus}`);
  }

  // 2. Update task state
  const taskUpdateSql = `
    UPDATE task
    SET status = $1, result = $2, updated_at = now()
    WHERE id = $3
  `;
  const resPayload = success ? (result ?? {}) : (error ?? {});
  await tx.query(taskUpdateSql, [targetStatus, JSON.stringify(resPayload), taskId]);

  // 3. Update attempt record
  const attemptUpdateSql = `
    UPDATE task_attempt
    SET ended_at = now(), success = $1, error = $2
    WHERE id = $3
  `;
  await tx.query(attemptUpdateSql, [success, success ? null : JSON.stringify(resPayload), attemptId]);

  // 4. Update idempotency result if key exists
  const idempUpdateSql = `
    UPDATE idempotency_key
    SET result = jsonb_set(result, '{status}', $1::jsonb || result->'status')
    WHERE result->>'task_id' = $2
  `;
  // Just update the status inside the result column for matching task_id
  const statusString = `"${targetStatus}"`;
  await tx.query(idempUpdateSql, [statusString, taskId]);

  // 5. Emit outbox event
  const outboxSql = `
    INSERT INTO task_outbox (task_id, topic, payload, created_at)
    VALUES ($1, $2, $3, now())
  `;
  const outboxPayload = { task_id: taskId, attempt_id: attemptId, status: targetStatus, payload: resPayload };
  await tx.query(outboxSql, [taskId, topic, JSON.stringify(outboxPayload)]);

  log.info({ taskId, status: targetStatus }, "task completed");
  return { taskId, status: targetStatus };
}

/**
 * Transitions task to CANCELLED.
 *
 * @param {object} tx Database client/transaction executor
 * @param {string} taskId Task UUID
 */
export async function cancelTask(tx, taskId) {
  if (!taskId) throw new TypeError("cancelTask: taskId is required");

  // 1. Fetch task state
  const fetchSql = "SELECT status, kind FROM task WHERE id = $1 FOR UPDATE";
  const fetchRes = await tx.query(fetchSql, [taskId]);
  if (fetchRes.rows.length === 0) throw new Error(`cancelTask: task ${taskId} not found`);

  const task = fetchRes.rows[0];
  if (task.status === "SUCCEEDED" || task.status === "FAILED") {
    throw new Error(`cancelTask: cannot cancel task in terminal state ${task.status}`);
  }

  // 2. Update status
  const updateSql = "UPDATE task SET status = 'CANCELLED', updated_at = now() WHERE id = $1";
  await tx.query(updateSql, [taskId]);

  // 3. Emit outbox event
  const outboxSql = `
    INSERT INTO task_outbox (task_id, topic, payload, created_at)
    VALUES ($1, 'task:cancelled', $2, now())
  `;
  const payload = { task_id: taskId, status: "CANCELLED" };
  await tx.query(outboxSql, [taskId, JSON.stringify(payload)]);

  log.info({ taskId }, "task cancelled");
  return { taskId, status: "CANCELLED" };
}

/**
 * Reads undispatched outbox records for processing (Linear/Sentry sync loop).
 *
 * @param {object} tx Database client/transaction executor
 * @param {number} [limit] Page limit
 */
export async function getUndispatchedOutbox(tx, limit = 100) {
  const sql = `
    SELECT seq, task_id, topic, payload, created_at
    FROM task_outbox
    WHERE dispatched_at IS NULL
    ORDER BY seq ASC
    LIMIT $1
  `;
  const res = await tx.query(sql, [limit]);
  return res.rows.map((row) => ({
    seq: Number(row.seq),
    taskId: row.task_id,
    topic: row.topic,
    payload: row.payload,
    createdAt: row.created_at,
  }));
}

/**
 * Marks outbox records as dispatched.
 *
 * @param {object} tx Database client/transaction executor
 * @param {number[]} seqs Record sequence numbers
 */
export async function markOutboxDispatched(tx, seqs) {
  if (!Array.isArray(seqs) || seqs.length === 0) return;
  const sql = `
    UPDATE task_outbox
    SET dispatched_at = now()
    WHERE seq = ANY($1)
  `;
  await tx.query(sql, [seqs]);
}
