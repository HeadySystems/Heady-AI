// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Task Ledger — REAL-tx integration (GATE-1 exit test)      ║
// ║  Runs the full lifecycle against a live Neon COW BRANCH via        ║
// ║  @heady/db/port. Requires HEADY_TEST_DATABASE_URL (point it at a   ║
// ║  branch endpoint, NEVER root) — skips cleanly when unset so CI     ║
// ║  without credentials stays green. Cleans up every row it creates.  ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createDbPort } from "@heady/db/port";
import {
  createTask, startTask, completeTask, cancelTask,
  getUndispatchedOutbox, markOutboxDispatched,
} from "../src/index.mjs";

const URL = process.env.HEADY_TEST_DATABASE_URL;
const SKIP = URL ? false : "HEADY_TEST_DATABASE_URL not set (point it at a Neon COW branch to run)";

test("full task lifecycle is durable on the real branch (GATE-1)", { skip: SKIP }, async () => {
  const port = createDbPort({ connectionString: URL });
  await port.connect();
  const scope = `gate1-${randomUUID()}`;
  const taskIds = [];
  try {
    // create → PENDING + outbox(task:created) + idempotency row, all one tx
    const created = await port.tx((tx) => createTask(tx, {
      kind: "gate1.lifecycle", input: { probe: true },
      idempotencyKey: `${scope}-k1`, scope,
    }));
    taskIds.push(created.task_id);
    assert.equal(created.status, "PENDING");

    // idempotent replay returns the SAME task, creates nothing new
    const replay = await port.tx((tx) => createTask(tx, {
      kind: "gate1.lifecycle", input: { probe: true },
      idempotencyKey: `${scope}-k1`, scope,
    }));
    assert.equal(replay.task_id, created.task_id);

    // start → RUNNING + attempt row
    const attemptId = await port.tx((tx) => startTask(tx, created.task_id));
    assert.ok(attemptId);
    const running = await port.query("SELECT status FROM task WHERE id = $1", [created.task_id]);
    assert.equal(running.rows[0].status, "RUNNING");

    // complete(success) → SUCCEEDED, attempt closed
    const done = await port.tx((tx) => completeTask(tx, created.task_id, attemptId, { success: true, result: { ok: 1 } }));
    assert.equal(done.status, "SUCCEEDED");
    const attempt = await port.query("SELECT success, ended_at FROM task_attempt WHERE id = $1", [attemptId]);
    assert.equal(attempt.rows[0].success, true);
    assert.ok(attempt.rows[0].ended_at);

    // outbox: created/started/completed rows exist undispatched → dispatch them
    const outbox = await port.tx((tx) => getUndispatchedOutbox(tx, 100));
    const mine = outbox.filter((r) => r.taskId === created.task_id);
    assert.deepEqual(mine.map((r) => r.topic).sort(), ["task:completed", "task:created", "task:started"]);
    await port.tx((tx) => markOutboxDispatched(tx, mine.map((r) => r.seq)));
    const after = await port.tx((tx) => getUndispatchedOutbox(tx, 100));
    assert.equal(after.filter((r) => r.taskId === created.task_id).length, 0);

    // cancel path on a second task
    const second = await port.tx((tx) => createTask(tx, { kind: "gate1.cancel", input: {} }));
    taskIds.push(second.task_id);
    const cancelled = await port.tx((tx) => cancelTask(tx, second.task_id));
    assert.equal(cancelled.status, "CANCELLED");

    // terminal-state machine holds on the real DB
    await assert.rejects(() => port.tx((tx) => startTask(tx, created.task_id)), /invalid state transition/);
  } finally {
    // remove every row this test created (branch hygiene)
    for (const t of ["task_outbox", "task_attempt", "task_dep"]) {
      await port.query(`DELETE FROM ${t} WHERE task_id = ANY($1)`, [taskIds]);
    }
    await port.query("DELETE FROM idempotency_key WHERE scope = $1", [scope]);
    await port.query("DELETE FROM task WHERE id = ANY($1)", [taskIds]);
    await port.end();
  }
});
