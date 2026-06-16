// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ DB v1.0.0 — schema constants + outbox/idempotency helpers ║
// ║  Neon Postgres + pgvector system of record. © 2026 HeadySystems.   ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Pure, dependency-free helpers (Drizzle/pg wire the actual connection at the
// app layer; these encode the invariants so they're unit-testable without a DB).
// The canonical DDL lives in migrations/0001_init.sql.

import { createHash } from "node:crypto";

/** Locked retrieval/embedding dimension (ADR-0015: bge-small-en-v1.5). */
export const VECTOR_DIM = 384;

export const TABLES = Object.freeze({
  task: "task",
  taskDep: "task_dep",
  taskAttempt: "task_attempt",
  taskOutbox: "task_outbox",
  idempotencyKey: "idempotency_key",
  vectorMemory: "vector_memory",
});

export const TASK_STATUS = Object.freeze(["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]);

/** Stable, content-addressed idempotency key for (scope, kind, input). */
export function idempotencyKey(scope, kind, input) {
  if (!scope || !kind) throw new TypeError("idempotencyKey: scope and kind required");
  const canonical = JSON.stringify({ scope, kind, input: input ?? null });
  return `${scope}:${createHash("sha256").update(canonical).digest("hex").slice(0, 32)}`;
}

/**
 * Build the outbox row to insert in the SAME transaction as a task state change
 * (ADR-0002 transactional outbox). Returns a plain row object (no IO).
 */
export function buildOutboxRecord({ taskId, topic, payload }) {
  if (!topic) throw new TypeError("buildOutboxRecord: topic required");
  if (typeof payload !== "object" || payload === null) throw new TypeError("buildOutboxRecord: payload must be an object");
  return { task_id: taskId ?? null, topic, payload, dispatched_at: null };
}

/** Guard: an embedding must be exactly the locked 384 dimensions of finite numbers. */
export function assertEmbedding(vec) {
  if (!Array.isArray(vec) || vec.length !== VECTOR_DIM) {
    throw new RangeError(`embedding must be a ${VECTOR_DIM}-dim array (got ${Array.isArray(vec) ? vec.length : typeof vec})`);
  }
  for (const x of vec) if (!Number.isFinite(x)) throw new TypeError("embedding contains a non-finite value");
  return true;
}

/** Validate a task status against the CHECK constraint in the schema. */
export function isValidStatus(status) {
  return TASK_STATUS.includes(status);
}
