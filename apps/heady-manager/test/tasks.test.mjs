// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — tasks service unit tests (fake DbPort)     ║
// ║  Contract validation, disabled-mode honesty, and the trace-ID       ║
// ║  visibility chain (header → span exporter tag) without a database.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { runWithTrace } from "@heady/logger";
import { Metrics } from "@heady/observability";
import { createApp } from "../src/app.mjs";
import { createTasksService, validateEnqueue } from "../src/tasks.mjs";

const TASK_ID = randomUUID();

/** Scripted pg-shaped fake: routes by SQL prefix; tx hands itself to fn. */
function fakePort() {
  const client = {
    async query(sql, params = []) {
      if (sql === "SELECT 1") return { rows: [{ "?column?": 1 }] };
      if (sql.trim().startsWith("INSERT INTO task ")) {
        return { rows: [{ id: TASK_ID, kind: params[0], input: params[1], status: "PENDING" }] };
      }
      if (sql.trim().startsWith("SELECT id, status, result FROM task")) {
        return params[0] === TASK_ID ? { rows: [{ id: TASK_ID, status: "PENDING", result: null }] } : { rows: [] };
      }
      return { rows: [] }; // outbox insert etc.
    },
    async connect() {}, async end() {},
  };
  return { connect: client.connect, end: client.end, query: client.query, tx: (fn) => fn(client) };
}

/** Mini harness: express + trace middleware + routes, injected exporter. */
async function harness({ getDbPort }) {
  const spans = [];
  const exporter = { span: (s) => spans.push(s), error: () => {} };
  const published = [];
  const svc = createTasksService({
    log: { info: () => {}, warn: () => {}, error: () => {} },
    publish: async (subject, payload) => published.push({ subject, payload }),
    getDbPort, exporter, registry: new Metrics(),
  });
  await svc.service.start();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const traceId = req.header("x-heady-trace-id") || randomUUID();
    res.setHeader("X-Heady-Trace-Id", traceId);
    runWithTrace(traceId, next);
  });
  svc.routes(app);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, spans, published, svc, close: () => new Promise((r) => server.close(r)) };
}

test("validateEnqueue enforces the OpenAPI contract strictly", () => {
  assert.equal(validateEnqueue({ kind: "k", input: {} }).ok, true);
  assert.equal(validateEnqueue({ kind: "k", input: {}, deps: [randomUUID()] }).ok, true);
  assert.equal(validateEnqueue(null).ok, false);
  assert.equal(validateEnqueue({ input: {} }).ok, false);              // kind missing
  assert.equal(validateEnqueue({ kind: "k", input: [] }).ok, false);   // input not object
  assert.equal(validateEnqueue({ kind: "k", input: {}, deps: ["nope"] }).ok, false);
  assert.equal(validateEnqueue({ kind: "k", input: {}, extra: 1 }).ok, false); // unknown field
});

test("write path: POST → 201, trace id echoed AND visible on the exported span; SSE published", async () => {
  const h = await harness({ getDbPort: async () => fakePort() });
  try {
    const traceId = randomUUID();
    const res = await fetch(`${h.base}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-heady-trace-id": traceId },
      body: JSON.stringify({ kind: "gate2.unit", input: { a: 1 } }),
    });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("x-heady-trace-id"), traceId); // echoed upstream
    const body = await res.json();
    assert.equal(body.taskId, TASK_ID);
    assert.equal(body.status, "PENDING");
    // trace visibility: the span the exporter received carries the SAME trace id
    const span = h.spans.find((s) => s.name === "tasks.enqueue");
    assert.equal(span.traceId, traceId);
    // and the SSE event carries it too
    assert.equal(h.published[0].subject, "task.created");
    assert.equal(h.published[0].payload.traceId, traceId);
  } finally { await h.close(); }
});

test("GET /tasks/:id → 200 shape / 404 missing / 400 bad uuid", async () => {
  const h = await harness({ getDbPort: async () => fakePort() });
  try {
    const ok = await fetch(`${h.base}/tasks/${TASK_ID}`);
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { taskId: TASK_ID, status: "PENDING" });
    assert.equal((await fetch(`${h.base}/tasks/${randomUUID()}`)).status, 404);
    assert.equal((await fetch(`${h.base}/tasks/not-a-uuid`)).status, 400);
  } finally { await h.close(); }
});

test("invalid enqueue → 400 with details", async () => {
  const h = await harness({ getDbPort: async () => fakePort() });
  try {
    const res = await fetch(`${h.base}/tasks`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: 5 }),
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "invalid_request");
  } finally { await h.close(); }
});

test("createApp without a DbPort factory: tasks disabled, health stays OK, /tasks 503", async () => {
  const a = createApp({ port: 0 });
  await a.start();
  try {
    const { port } = a.address();
    const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    assert.equal(health.status, "ok", "disabled tasks must not degrade the origin");
    assert.equal(health.checks?.tasks, "ok"); // kernel flattens to the status string
    const res = await fetch(`http://127.0.0.1:${port}/tasks`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "x", input: {} }),
    });
    assert.equal(res.status, 503);
    assert.match((await res.json()).reason, /disabled/);
  } finally { await a.stop(); }
});
