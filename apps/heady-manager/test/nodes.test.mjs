// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ AI Nodes Orchestration Tests v1.0.0                     ║
// ║  Fail-closed auth, durable dispatch/idempotency, audit routes,   ║
// ║  and honest registry/readiness reporting.                       ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { runWithTrace } from "@heady/logger";
import {
  createNodesService,
  HEADY_ATTRIBUTION_ROSTER,
  HEADY_MATHEMATICAL_CORE,
  HEADY_NODE_ROSTER,
} from "../src/nodes.mjs";

const SECRET = "node-secret-for-test-only";

function fakePort() {
  const taskId = randomUUID();
  const idempotency = new Map();
  const outbox = [];
  const heartbeats = new Map();
  let sequence = 0;
  const client = {
    async connect() {},
    async end() {},
    async query(sql, params = []) {
      const compact = sql.replace(/\s+/g, " ").trim();
      if (compact === "SELECT 1") return { rows: [{ value: 1 }] };
      if (compact.startsWith("SELECT EXISTS ( SELECT 1 FROM pg_trigger")) {
        return { rows: [{ outbox_guard: true, heartbeat_registry: true }] };
      }
      if (compact.startsWith("SELECT node_id, revision, status, metadata, observed_at")) {
        return { rows: [...heartbeats.values()].map((row) => ({ ...row, fresh: true })) };
      }
      if (compact.startsWith("INSERT INTO heady_runtime.node_heartbeat")) {
        const row = { node_id: params[0], revision: params[1], status: params[2], metadata: params[3], observed_at: new Date().toISOString() };
        heartbeats.set(params[0], row);
        return { rows: [row] };
      }
      if (compact.startsWith("SELECT result FROM idempotency_key")) {
        const value = idempotency.get(`${params[1]}:${params[0]}`);
        return { rows: value ? [{ result: value }] : [] };
      }
      if (compact.startsWith("INSERT INTO task ")) {
        return { rows: [{ id: taskId, kind: params[0], input: params[1], status: "PENDING" }] };
      }
      if (compact.startsWith("INSERT INTO idempotency_key")) {
        idempotency.set(`${params[1]}:${params[0]}`, JSON.parse(params[2]));
        return { rows: [] };
      }
      if (compact.startsWith("INSERT INTO task_outbox")) {
        sequence += 1;
        const standardTaskEvent = compact.includes("'task:created'");
        outbox.push({
          seq: sequence,
          task_id: params[0],
          topic: standardTaskEvent ? "task:created" : params[1],
          payload: JSON.parse(standardTaskEvent ? params[1] : params[2]),
          created_at: new Date().toISOString(),
          dispatched_at: null,
        });
        return { rows: [] };
      }
      if (compact.startsWith("SELECT o.seq")) {
        return { rows: outbox.slice().reverse().slice(0, params[1]) };
      }
      if (compact.startsWith("SELECT seq, topic, payload FROM task_outbox WHERE dispatched_at IS NULL")) {
        return { rows: outbox.filter(({ dispatched_at, topic }) => dispatched_at === null && topic.startsWith("agent.")).slice(0, params[0]) };
      }
      if (compact.startsWith("UPDATE task_outbox SET dispatched_at = now()")) {
        const row = outbox.find(({ seq }) => seq === params[0]);
        if (row && row.dispatched_at === null) row.dispatched_at = new Date().toISOString();
        return { rows: [] };
      }
      if (compact.startsWith("SELECT id, kind, status, created_at")) {
        return params[0] === taskId
          ? { rows: [{ id: taskId, kind: "node:jules:build.release", status: "PENDING", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] }
          : { rows: [] };
      }
      if (compact.startsWith("SELECT seq, topic, created_at")) return { rows: outbox };
      return { rows: [] };
    },
  };
  return { ...client, tx: (fn) => fn(client), taskId, outbox };
}

async function harness({ configured = true, projectionFails = false } = {}) {
  const published = [];
  const db = fakePort();
  const service = createNodesService({
    log: { info: () => {}, warn: () => {}, error: () => {} },
    publish: async (subject, payload) => {
      if (projectionFails) throw new Error("NATS unavailable");
      published.push({ subject, payload });
      return { delivered: 1, errors: [] };
    },
    getDbPort: configured ? async () => db : null,
    getInternalSecret: configured ? async () => SECRET : null,
    getEventTransportStatus: () => ({ name: "nats", ready: configured }),
  });
  await service.service.start();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => runWithTrace(req.header("x-heady-trace-id") ?? randomUUID(), next));
  service.routes(app);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    db,
    published,
    service,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const authHeaders = {
  authorization: `Bearer ${SECRET}`,
  "x-heady-actor-node": "CONDUCTOR",
};

test("registry separates runtime contexts, attribution roles, and mathematical core", () => {
  assert.equal(HEADY_NODE_ROSTER.length, 21);
  assert.equal(HEADY_ATTRIBUTION_ROSTER.length, 19);
  assert.deepEqual(HEADY_MATHEMATICAL_CORE.map(({ id }) => id), ["TENSOR", "TOPOLOGY"]);
  assert.equal(new Set(HEADY_NODE_ROSTER.map(({ id }) => id)).size, HEADY_NODE_ROSTER.length);
  assert.ok(HEADY_ATTRIBUTION_ROSTER.every(({ runtimeNode }) => HEADY_NODE_ROSTER.some(({ slug }) => slug === runtimeNode)));
});

test("disabled mode lists registered nodes but fails readiness closed", async () => {
  const h = await harness({ configured: false });
  try {
    const nodes = await (await fetch(`${h.base}/api/nodes`)).json();
    assert.equal(nodes.registered, 21);
    assert.equal(nodes.attributionRoles.length, 19);
    assert.equal(nodes.active, 0);
    assert.equal(nodes.productionReady, false);
    const readiness = await fetch(`${h.base}/api/orchestration/readiness`);
    assert.equal(readiness.status, 503);
    assert.equal((await readiness.json()).dispatchAccepting, false);
  } finally {
    await h.close();
  }
});

test("dispatch is authenticated, durable, attributed, and idempotent", async () => {
  const h = await harness();
  try {
    const url = `${h.base}/api/nodes/JULES/dispatch`;
    const denied = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "dispatch-0001" },
      body: JSON.stringify({ action: "build.release", input: {} }),
    });
    assert.equal(denied.status, 401);

    const headers = { ...authHeaders, "content-type": "application/json", "idempotency-key": "dispatch-0001", "x-heady-trace-id": randomUUID() };
    const accepted = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "build.release", input: { target: "canary" } }),
    });
    assert.equal(accepted.status, 202);
    assert.deepEqual(await accepted.json(), {
      taskId: h.db.taskId,
      status: "PENDING",
      node: "HEADY_BEE_FACTORY",
      attributionRole: "JULES",
      deduplicated: false,
    });
    assert.equal(h.db.outbox.length, 2);
    assert.equal(h.db.outbox[1].topic, "agent.heady-bee-factory.action.requested");
    assert.equal(h.db.outbox[1].payload.attributionRole, "JULES");
    assert.equal(h.db.outbox[1].payload.actor.node, "CONDUCTOR");
    assert.equal(h.published[0].subject, "agent.heady-bee-factory.action.requested");

    await h.service.projectNodeOutbox();
    assert.equal(h.db.outbox[1].dispatched_at !== null, true);
    assert.equal(h.published[1].subject, "agent.heady-bee-factory.action.requested");

    const repeated = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "build.release", input: { target: "canary" } }),
    });
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).deduplicated, true);
    assert.equal(h.db.outbox.length, 2, "deduplicated requests must not append duplicate audit events");
  } finally {
    await h.close();
  }
});

test("a failed immediate NATS projection never changes a committed dispatch into HTTP 500", async () => {
  const h = await harness({ projectionFails: true });
  try {
    const response = await fetch(`${h.base}/api/nodes/JULES/dispatch`, {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json", "idempotency-key": "dispatch-deferred-0001" },
      body: JSON.stringify({ action: "build.release", input: { target: "canary" } }),
    });
    assert.equal(response.status, 202);
    assert.equal(h.db.outbox[1].dispatched_at, null);
  } finally {
    await h.close();
  }
});

test("audit and task status require internal node identity", async () => {
  const h = await harness();
  try {
    assert.equal((await fetch(`${h.base}/api/nodes/audit`)).status, 401);
    const audit = await fetch(`${h.base}/api/nodes/audit?limit=5&node=JULES`, { headers: authHeaders });
    assert.equal(audit.status, 200);
    const auditBody = await audit.json();
    assert.equal(auditBody.authority, "neon.task_outbox");
    assert.equal(auditBody.appendOnlyEnforced, true);
    const task = await fetch(`${h.base}/api/orchestration/tasks/${h.db.taskId}`, { headers: authHeaders });
    assert.equal(task.status, 200);
    assert.equal((await task.json()).status, "PENDING");
  } finally {
    await h.close();
  }
});

test("measured heartbeat activates a runtime context and clears readiness", async () => {
  const h = await harness();
  try {
    const before = await fetch(`${h.base}/api/orchestration/readiness`);
    assert.equal(before.status, 503);
    assert.ok((await before.json()).blockers.includes("no active runtime-node heartbeats"));
    const heartbeat = await fetch(`${h.base}/api/nodes/HEADY_BRAIN/heartbeat`, {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ revision: "rev-test", status: "READY", metadata: { worker: "test" } }),
    });
    assert.equal(heartbeat.status, 200);
    assert.equal((await heartbeat.json()).node_id, "HEADY_BRAIN");
    const after = await fetch(`${h.base}/api/orchestration/readiness`);
    assert.equal(after.status, 200);
    assert.equal((await after.json()).productionReady, true);
    const registry = await (await fetch(`${h.base}/api/nodes`)).json();
    const brain = registry.nodes.find(({ id }) => id === "HEADY_BRAIN");
    assert.equal(brain.live, true);
    assert.equal(brain.heartbeat.revision, "rev-test");
  } finally {
    await h.close();
  }
});
