// heady-manager — boots on the backbone and serves /health. node:test, no extra deps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HEALTH } from "@heady/shared";
import { createApp } from "../src/app.mjs";

test("kernel boots and aggregate health is ok", async () => {
  const a = createApp({ port: 0 }); // ephemeral port
  await a.start();
  try {
    const h = await a.kernel.health();
    assert.equal(h.status, HEALTH.OK, "aggregate health should be ok once the http service is listening");
    assert.equal(typeof a.address().port, "number", "server should be bound to a port");
  } finally {
    const errs = await a.stop();
    assert.equal(errs.length, 0, "shutdown should be clean");
  }
});

test("GET /health returns 200 with status ok over HTTP", async () => {
  const a = createApp({ port: 0 });
  await a.start();
  const { port } = a.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, HEALTH.OK);
    assert.equal(body.service, "heady-manager");
    assert.ok(body.timestamp, "health carries a timestamp");
    assert.equal(res.headers.get("x-heady-service"), "heady-manager");
    assert.ok(res.headers.get("x-heady-trace-id"), "trace id is echoed");
  } finally {
    await a.stop();
  }
});

test("GET /metrics reports the http service", async () => {
  const a = createApp({ port: 0 });
  await a.start();
  const { port } = a.address();
  try {
    const m = await (await fetch(`http://127.0.0.1:${port}/metrics`)).json();
    assert.ok(m.http, "metrics keyed by service name");
    assert.equal(m.http.listening, true);
  } finally {
    await a.stop();
  }
});
