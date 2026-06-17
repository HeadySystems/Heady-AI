// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Task Ledger unit tests                                   ║
// ║  Validates task creation, dependencies, attempts, and outbox.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createTask,
  startTask,
  completeTask,
  cancelTask,
  getUndispatchedOutbox,
  markOutboxDispatched,
} from "../src/index.mjs";

class MockDb {
  constructor() {
    this.tasks = [];
    this.taskDeps = [];
    this.attempts = [];
    this.outbox = [];
    this.idempotency = [];
  }

  async query(sql, params) {
    const s = sql.trim().replace(/\s+/g, " ");

    if (s.startsWith("SELECT result FROM idempotency_key")) {
      const [key, scope] = params;
      const row = this.idempotency.find((r) => r.key === key && r.scope === scope);
      return { rows: row ? [row] : [] };
    }

    if (s.startsWith("INSERT INTO task (kind, input")) {
      const [kind, inputJson] = params;
      const task = {
        id: "task-uuid-" + (this.tasks.length + 1),
        kind,
        input: JSON.parse(inputJson),
        status: "PENDING",
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.tasks.push(task);
      return { rows: [task] };
    }

    if (s.startsWith("INSERT INTO task_dep")) {
      const [taskId, dependsOn] = params;
      this.taskDeps.push({ task_id: taskId, depends_on: dependsOn });
      return { rows: [] };
    }

    if (s.startsWith("INSERT INTO idempotency_key")) {
      const [key, scope, resultJson] = params;
      this.idempotency.push({ key, scope, result: JSON.parse(resultJson) });
      return { rows: [] };
    }

    if (s.startsWith("INSERT INTO task_outbox")) {
      let taskId, topic, payloadJson;
      if (params.length === 2) {
        [taskId, payloadJson] = params;
        if (s.includes("'task:created'")) topic = "task:created";
        else if (s.includes("'task:started'")) topic = "task:started";
        else if (s.includes("'task:cancelled'")) topic = "task:cancelled";
      } else {
        [taskId, topic, payloadJson] = params;
      }
      const out = {
        seq: this.outbox.length + 1,
        task_id: taskId,
        topic,
        payload: JSON.parse(payloadJson),
        created_at: new Date(),
        dispatched_at: null,
      };
      this.outbox.push(out);
      return { rows: [out] };
    }

    if (s.startsWith("SELECT status, kind FROM task")) {
      const [id] = params;
      const task = this.tasks.find((t) => t.id === id);
      return { rows: task ? [task] : [] };
    }

    if (s.startsWith("UPDATE task SET status = 'RUNNING'")) {
      const [id] = params;
      const task = this.tasks.find((t) => t.id === id);
      if (task) {
        task.status = "RUNNING";
        task.updated_at = new Date();
      }
      return { rows: [] };
    }

    if (s.startsWith("INSERT INTO task_attempt")) {
      const [taskId] = params;
      const att = {
        id: "attempt-uuid-" + (this.attempts.length + 1),
        task_id: taskId,
        started_at: new Date(),
        ended_at: null,
        success: null,
        error: null,
      };
      this.attempts.push(att);
      return { rows: [att] };
    }

    if (s.startsWith("UPDATE task SET status = $1, result = $2")) {
      const [status, resultJson, id] = params;
      const task = this.tasks.find((t) => t.id === id);
      if (task) {
        task.status = status;
        task.result = JSON.parse(resultJson);
        task.updated_at = new Date();
      }
      return { rows: [] };
    }

    if (s.startsWith("UPDATE task_attempt SET ended_at")) {
      const [success, errorJson, id] = params;
      const att = this.attempts.find((a) => a.id === id);
      if (att) {
        att.ended_at = new Date();
        att.success = success;
        att.error = errorJson ? JSON.parse(errorJson) : null;
      }
      return { rows: [] };
    }

    if (s.startsWith("UPDATE idempotency_key SET result")) {
      const [statusJson, taskId] = params;
      const cleanStatus = statusJson.replace(/"/g, "");
      const idemp = this.idempotency.find((i) => i.result && i.result.task_id === taskId);
      if (idemp) {
        idemp.result.status = cleanStatus;
      }
      return { rows: [] };
    }

    if (s.startsWith("UPDATE task SET status = 'CANCELLED'")) {
      const [id] = params;
      const task = this.tasks.find((t) => t.id === id);
      if (task) {
        task.status = "CANCELLED";
        task.updated_at = new Date();
      }
      return { rows: [] };
    }

    if (s.startsWith("SELECT seq, task_id, topic")) {
      const [limit] = params;
      const rows = this.outbox
        .filter((o) => o.dispatched_at === null)
        .slice(0, limit)
        .map((r) => ({
          seq: r.seq,
          task_id: r.task_id,
          topic: r.topic,
          payload: r.payload,
          created_at: r.created_at,
        }));
      return { rows };
    }

    if (s.startsWith("UPDATE task_outbox SET dispatched_at")) {
      const [seqs] = params;
      const seqSet = new Set(seqs);
      for (const o of this.outbox) {
        if (seqSet.has(o.seq)) {
          o.dispatched_at = new Date();
        }
      }
      return { rows: [] };
    }

    throw new Error("Unhandled mock query: " + sql);
  }
}

test("createTask validates inputs and creates pending task with outbox", async () => {
  const db = new MockDb();
  
  await assert.rejects(() => createTask(db, { input: {} }), TypeError);
  await assert.rejects(() => createTask(db, { kind: "test" }), TypeError);

  const res = await createTask(db, { kind: "ingest", input: { url: "headyme.com" } });
  assert.equal(res.status, "PENDING");
  assert.equal(res.kind, "ingest");
  
  assert.equal(db.tasks.length, 1);
  assert.equal(db.tasks[0].status, "PENDING");
  assert.equal(db.tasks[0].input.url, "headyme.com");

  assert.equal(db.outbox.length, 1);
  assert.equal(db.outbox[0].topic, "task:created");
  assert.equal(db.outbox[0].payload.task_id, res.task_id);
});

test("createTask resolves idempotency key without duplicate creation", async () => {
  const db = new MockDb();
  
  await assert.rejects(() => createTask(db, { kind: "a", input: {}, idempotencyKey: "123" }), TypeError);

  const res1 = await createTask(db, { kind: "a", input: {}, idempotencyKey: "key-1", scope: "linear" });
  assert.equal(db.tasks.length, 1);

  const res2 = await createTask(db, { kind: "a", input: {}, idempotencyKey: "key-1", scope: "linear" });
  assert.equal(db.tasks.length, 1);
  assert.deepEqual(res1, res2);
});

test("task lifecycle - start, succeed, complete", async () => {
  const db = new MockDb();
  const task = await createTask(db, { kind: "test-lifecycle", input: {} });
  
  const attemptId = await startTask(db, task.task_id);
  assert.equal(db.tasks[0].status, "RUNNING");
  assert.equal(db.attempts.length, 1);
  assert.equal(db.attempts[0].task_id, task.task_id);
  assert.equal(db.outbox.length, 2);
  assert.equal(db.outbox[1].topic, "task:started");

  await completeTask(db, task.task_id, attemptId, { success: true, result: { count: 42 } });
  assert.equal(db.tasks[0].status, "SUCCEEDED");
  assert.deepEqual(db.tasks[0].result, { count: 42 });
  assert.equal(db.attempts[0].success, true);
  assert.equal(db.outbox.length, 3);
  assert.equal(db.outbox[2].topic, "task:completed");
});

test("task lifecycle - failed attempt", async () => {
  const db = new MockDb();
  const task = await createTask(db, { kind: "test-lifecycle", input: {} });
  
  const attemptId = await startTask(db, task.task_id);
  await completeTask(db, task.task_id, attemptId, { success: false, error: { message: "timeout" } });
  assert.equal(db.tasks[0].status, "FAILED");
  assert.deepEqual(db.attempts[0].error, { message: "timeout" });
  assert.equal(db.attempts[0].success, false);
  assert.equal(db.outbox.length, 3);
  assert.equal(db.outbox[2].topic, "task:failed");
});

test("task cancellation - cannot cancel completed task", async () => {
  const db = new MockDb();
  const task = await createTask(db, { kind: "test-cancel", input: {} });
  
  const attemptId = await startTask(db, task.task_id);
  await completeTask(db, task.task_id, attemptId, { success: true });
  
  await assert.rejects(() => cancelTask(db, task.task_id), /cannot cancel task in terminal state/);
});

test("outbox retrieval and dispatching", async () => {
  const db = new MockDb();
  await createTask(db, { kind: "t1", input: {} });
  await createTask(db, { kind: "t2", input: {} });

  const undispatched = await getUndispatchedOutbox(db, 10);
  assert.equal(undispatched.length, 2);
  assert.equal(undispatched[0].seq, 1);
  assert.equal(undispatched[1].seq, 2);

  await markOutboxDispatched(db, [1]);
  
  const undispatched2 = await getUndispatchedOutbox(db, 10);
  assert.equal(undispatched2.length, 1);
  assert.equal(undispatched2[0].seq, 2);
});
