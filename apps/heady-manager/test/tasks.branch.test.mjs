// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — GATE-2 integration (live Neon COW branch)  ║
// ║  The full HTTP write path: POST /tasks → ONE Neon tx (task +       ║
// ║  outbox) → GET shows it durable → ledger start/complete on the      ║
// ║  same port → SUCCEEDED with result — X-Heady-Trace-Id asserted at   ║
// ║  every hop. Requires HEADY_TEST_DATABASE_URL (a BRANCH, never       ║
// ║  root); skips cleanly when unset. Self-cleaning.                    ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDbPort } from "@heady/db/port";
import { startTask, completeTask } from "@heady/task-ledger";
import { createApp } from "../src/app.mjs";

const URL_ = process.env.HEADY_TEST_DATABASE_URL;
const SKIP = URL_ ? false : "HEADY_TEST_DATABASE_URL not set (point it at a Neon COW branch to run)";

test("GATE 2: live HTTP write path durable in Neon with the trace id on every hop", { skip: SKIP }, async () => {
  const a = createApp({ port: 0, tasks: { getDbPort: async () => createDbPort({ connectionString: URL_ }) } });
  await a.start();
  const { port } = a.address();
  const base = `http://127.0.0.1:${port}`;
  const traceId = randomUUID();
  let taskId = null;
  try {
    // 1. POST /tasks — the live write path (task + outbox in one Neon tx)
    const post = await fetch(`${base}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-heady-trace-id": traceId },
      body: JSON.stringify({ kind: "gate2.http", input: { via: "heady-manager" } }),
    });
    assert.equal(post.status, 201);
    assert.equal(post.headers.get("x-heady-trace-id"), traceId, "trace id echoed on the write");
    const created = await post.json();
    taskId = created.taskId;
    assert.equal(created.status, "PENDING");

    // 2. GET /tasks/:id — durable read-back over HTTP, same trace
    const get1 = await fetch(`${base}/tasks/${taskId}`, { headers: { "x-heady-trace-id": traceId } });
    assert.equal(get1.status, 200);
    assert.equal(get1.headers.get("x-heady-trace-id"), traceId, "trace id echoed on the read");
    assert.equal((await get1.json()).status, "PENDING");

    // 3. create→complete durable: drive the lifecycle on the SAME live port
    const dbPort = a.tasks.port();
    const attemptId = await dbPort.tx((tx) => startTask(tx, taskId));
    await dbPort.tx((tx) => completeTask(tx, taskId, attemptId, { success: true, result: { gate: 2 } }));

    const get2 = await fetch(`${base}/tasks/${taskId}`);
    const done = await get2.json();
    assert.equal(done.status, "SUCCEEDED");
    assert.deepEqual(done.result, { gate: 2 });

    // 4. outbox rows for the full lifecycle exist (created/started/completed)
    const outbox = await dbPort.query("SELECT topic FROM task_outbox WHERE task_id = $1 ORDER BY seq", [taskId]);
    assert.deepEqual(outbox.rows.map((r) => r.topic), ["task:created", "task:started", "task:completed"]);

    // 5. health reports the tasks service live
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.checks?.tasks, "ok");
  } finally {
    const dbPort = a.tasks.port();
    if (dbPort && taskId) {
      for (const t of ["task_outbox", "task_attempt", "task_dep"]) {
        await dbPort.query(`DELETE FROM ${t} WHERE task_id = $1`, [taskId]);
      }
      await dbPort.query("DELETE FROM task WHERE id = $1", [taskId]);
    }
    await a.stop();
  }
});
