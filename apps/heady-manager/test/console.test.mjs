// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — Console probe service tests               ║
// ║  Injected fetch + kernel, manual sweeps (no timers, no network):    ║
// ║  state classification, manifest anti-masquerade, transitions,       ║
// ║  honest registry-failure state, and the live app wiring.            ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createConsoleService, classifyHttp, PROBE_TIMEOUT_MS } from "../src/console.mjs";
import { createApp } from "../src/app.mjs";

const noLog = { info: () => {}, warn: () => {}, error: () => {} };

function fixtureRegistry(connectors) {
  const dir = mkdtempSync(join(tmpdir(), "heady-console-"));
  const p = join(dir, "connectors.json");
  writeFileSync(p, JSON.stringify({ schema: "connectors.v1", connectors }));
  return p;
}

const CONNECTORS = [
  { id: "site-ok", name: "OK site", kind: "heady", role: "site", deploy_class: false, expected: "real", probe: { kind: "https", url: "https://ok.example.headysystems.com/" } },
  { id: "site-gated", name: "Gated", kind: "heady", role: "admin", deploy_class: true, expected: "real", probe: { kind: "https", url: "https://gated.example.headysystems.com/" } },
  { id: "site-down", name: "Down", kind: "heady", role: "site", deploy_class: false, expected: "real", probe: { kind: "https", url: "https://down.example.headysystems.com/" } },
  { id: "shell", name: "Projection shell", kind: "heady", role: "shell", deploy_class: false, expected: "projection", probe: { kind: "https", url: "https://shell.example.headysystems.com/manifest" } },
  { id: "db", name: "DB", kind: "infra", role: "sor", deploy_class: false, expected: "real", probe: { kind: "kernel", service: "tasks" } },
  { id: "unwired", name: "No token", kind: "infra", role: "cache", deploy_class: false, expected: "real", probe: null },
];

function fakeFetch(url) {
  if (url.includes("ok.")) return Promise.resolve({ status: 200, json: async () => ({ status: "ok" }) });
  if (url.includes("gated.")) return Promise.resolve({ status: 302, json: async () => { throw new Error("no body"); } });
  if (url.includes("down.")) return Promise.reject(new Error("ECONNREFUSED"));
  if (url.includes("shell.")) {
    return Promise.resolve({ status: 200, json: async () => ({ schema: "server-manifest.v1", name: "shell-core", projection_only: true, provenance: { source_repo: "HeadySystems/Heady-AI" } }) });
  }
  return Promise.resolve({ status: 500, json: async () => ({}) });
}

// probeKernel reads the service's FULL health object via kernel.services.
const fakeKernel = (tasksStatus) => ({ services: [{ name: "tasks", health: async () => ({ status: tasksStatus }) }] });

async function harness({ tasksStatus = "ok" } = {}) {
  const published = [];
  const svc = createConsoleService({
    log: noLog,
    kernel: fakeKernel(tasksStatus),
    publish: async (subject, payload) => published.push({ subject, payload }),
    registryPath: fixtureRegistry(CONNECTORS),
    fetchImpl: fakeFetch,
  });
  return { svc, published };
}

test("PROBE_TIMEOUT_MS is φ²-derived (≈2618ms)", () => {
  assert.equal(PROBE_TIMEOUT_MS, 2618);
});

test("classifyHttp: manifest anti-masquerade beats a bare 200", () => {
  assert.equal(classifyHttp({ status: 200, body: null }).state, "healthy");
  const shell = classifyHttp({ status: 200, body: { schema: "server-manifest.v1", name: "x", projection_only: true, provenance: { source_repo: "r" } } });
  assert.equal(shell.state, "projection_only");
  const invalid = classifyHttp({ status: 200, body: { schema: "server-manifest.v1", name: "x", projection_only: "lies", provenance: { source_repo: "r" } } });
  assert.equal(invalid.state, "degraded");
  assert.equal(classifyHttp({ status: 302 }).state, "degraded");
  assert.equal(classifyHttp({ status: 503 }).state, "degraded");
});

test("a sweep measures every §8 state honestly", async () => {
  const { svc } = await harness();
  await svc.service.start(); // includes first sweep; timer is unref'd and cleared below
  const byId = Object.fromEntries(svc.summary().connectors.map((c) => [c.id, c]));
  assert.equal(byId["site-ok"].state, "healthy");
  assert.equal(byId["site-gated"].state, "degraded");
  assert.equal(byId["site-down"].state, "unreachable");
  assert.equal(byId.shell.state, "projection_only");
  assert.match(byId.shell.detail, /projected from/);
  assert.equal(byId.db.state, "healthy");
  assert.equal(byId.unwired.state, "not_connected");
  const s = svc.summary();
  assert.equal(s.schema, "console-summary.v1");
  assert.equal(s.global, "attention"); // site-down is unreachable
  await svc.service.stop();
});

test("state transitions publish console.connector.state events", async () => {
  const published = [];
  let status = "ok";
  const flipping = createConsoleService({
    log: noLog,
    kernel: { services: [{ name: "tasks", health: async () => ({ status }) }] },
    publish: async (subject, payload) => published.push({ subject, payload }),
    registryPath: fixtureRegistry(CONNECTORS), fetchImpl: fakeFetch,
  });
  await flipping.service.start();
  status = "down"; // the live DB signal drops between sweeps
  await flipping.sweep();
  await flipping.service.stop();
  const t = published.find((p) => p.subject === "console.connector.state" && p.payload.id === "db");
  assert.ok(t, "db transition must publish");
  assert.equal(t.payload.from, "healthy");
  assert.equal(t.payload.to, "unreachable");
});

test("kernel probe: disabled service = not_connected (never fake healthy)", async () => {
  const svc = createConsoleService({
    log: noLog,
    kernel: { services: [{ name: "tasks", health: async () => ({ status: "ok", mode: "disabled" }) }] },
    publish: async () => {},
    registryPath: fixtureRegistry(CONNECTORS), fetchImpl: fakeFetch,
  });
  await svc.service.start();
  await svc.service.stop();
  const db = svc.summary().connectors.find((c) => c.id === "db");
  assert.equal(db.state, "not_connected");
  assert.match(db.detail, /disabled/);
});

test("registry failure = honest degraded service + error summary (never fake cells)", async () => {
  const svc = createConsoleService({
    log: noLog, kernel: fakeKernel("ok"), publish: async () => {},
    registryPath: "/nonexistent/connectors.json", fetchImpl: fakeFetch,
  });
  await svc.service.start();
  assert.equal((await svc.service.health()).status, "degraded");
  const s = svc.summary();
  assert.ok(s.error);
  assert.deepEqual(s.connectors, []);
});

test("live app serves /api/console/summary — real 15-connector registry, injected fetch, honest disabled-DB", async () => {
  // Real registry file, fake network: every https probe answers 200 so the test
  // is deterministic and offline; the honesty assertions ride on kernel probes.
  const a = createApp({
    port: 0,
    console: { fetchImpl: async () => ({ status: 200, json: async () => ({ status: "ok" }) }) },
  });
  await a.start();
  try {
    const { port } = a.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/console/summary`);
    assert.equal(res.status, 200);
    const s = await res.json();
    assert.equal(s.schema, "console-summary.v1");
    assert.equal(s.heartbeatMs, 29034);
    assert.equal(s.connectors.length, 15);
    // tasks boots DISABLED without a DbPort factory → neon's kernel probe must
    // report not_connected — NEVER a fake healthy through the flattened kernel.
    const neon = s.connectors.find((c) => c.id === "neon");
    assert.equal(neon.state, "not_connected");
    assert.match(neon.detail, /disabled/);
    const unwired = s.connectors.find((c) => c.id === "google-drive");
    assert.equal(unwired.state, "not_connected");
    const origin = s.connectors.find((c) => c.id === "heady-manager");
    assert.equal(origin.state, "healthy"); // the http service is genuinely listening
  } finally {
    await a.stop();
  }
});
