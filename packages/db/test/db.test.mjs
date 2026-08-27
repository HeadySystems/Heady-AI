// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ DB tests — node:test, zero deps                          ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { VECTOR_DIM, TABLES, idempotencyKey, buildOutboxRecord, assertEmbedding, isValidStatus } from "../src/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

test("VECTOR_DIM is the locked 384", () => assert.equal(VECTOR_DIM, 384));

test("idempotencyKey is deterministic and scope-prefixed", () => {
  const a = idempotencyKey("embed", "doc", { id: 1 });
  const b = idempotencyKey("embed", "doc", { id: 1 });
  const c = idempotencyKey("embed", "doc", { id: 2 });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a.startsWith("embed:"));
  assert.throws(() => idempotencyKey(null, "x"), TypeError);
});

test("buildOutboxRecord shapes a dispatchable row", () => {
  const row = buildOutboxRecord({ taskId: "t1", topic: "heady.observation.task.done", payload: { ok: true } });
  assert.equal(row.topic, "heady.observation.task.done");
  assert.equal(row.dispatched_at, null);
  assert.deepEqual(row.payload, { ok: true });
  assert.throws(() => buildOutboxRecord({ topic: "x", payload: 1 }), TypeError);
  assert.throws(() => buildOutboxRecord({ payload: {} }), TypeError);
});

test("assertEmbedding enforces 384-dim finite vectors", () => {
  assert.ok(assertEmbedding(new Array(384).fill(0.1)));
  assert.throws(() => assertEmbedding(new Array(1536).fill(0)), RangeError); // wrong dim (the 1536 drift)
  assert.throws(() => assertEmbedding([1, 2, 3]), RangeError);
  const bad = new Array(384).fill(0);
  bad[0] = NaN;
  assert.throws(() => assertEmbedding(bad), TypeError);
});

test("isValidStatus matches the CHECK constraint", () => {
  assert.ok(isValidStatus("PENDING"));
  assert.ok(!isValidStatus("BOGUS"));
});

test("migration DDL exists, is forward-only, and locks vector(384)", () => {
  const sql = readFileSync(join(HERE, "..", "migrations", "0001_init.sql"), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS task_outbox/);
  assert.match(sql, /vector\(384\)/);
  assert.match(sql, /USING hnsw/);
  assert.ok(!/vector\(1536\)/.test(sql), "must not use the 1536 drift dimension");
  assert.ok(!/DROP TABLE/.test(sql), "forward-only: no destructive DROP");
  // every table constant should appear in the DDL
  for (const t of Object.values(TABLES)) assert.match(sql, new RegExp(t));
});
