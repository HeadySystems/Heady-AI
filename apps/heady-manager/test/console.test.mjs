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

import { createConsoleService, classifyHttp, classifyProjectionManifest, PROBE_TIMEOUT_MS } from "../src/console.mjs";
import { createApp } from "../src/app.mjs";

const PROJ_MANIFEST = {
  schema: "projection.v1", id: "headyos", source_path: "apps/mcp-dashboard",
  target_repo: "HeadySystems/headyos-core", projection_type: "worker-shell",
  deploy_target: "cloudflare-workers", status: "proposed",
};

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

test("classifyProjectionManifest: valid manifest ⇒ projection_only, invalid/absent ⇒ null (fall through)", () => {
  const c = classifyProjectionManifest(PROJ_MANIFEST);
  assert.equal(c.state, "projection_only");
  assert.match(c.detail, /HeadySystems\/headyos-core \(proposed\)/);
  assert.equal(classifyProjectionManifest(null), null);
  assert.equal(classifyProjectionManifest({ ...PROJ_MANIFEST, status: "bogus" }), null);
});

test("projection connector renders projection_only from its committed manifest — never probes the .com (anti-masquerade)", async () => {
  let networkHit = false;
  const svc = createConsoleService({
    log: noLog, kernel: { services: [] }, publish: async () => {},
    registryPath: fixtureRegistry([
      { id: "headyos", name: "HeadyOS", kind: "heady", role: "dashboard", deploy_class: false, expected: "projection", probe: { kind: "https", url: "https://headyos.com/" } },
    ]),
    fetchImpl: async () => { networkHit = true; return { status: 200, json: async () => ({ status: "ok" }) }; },
    readProjection: (id) => (id === "headyos" ? PROJ_MANIFEST : null),
  });
  await svc.service.start();
  await svc.service.stop();
  const os = svc.summary().connectors.find((c) => c.id === "headyos");
  assert.equal(os.state, "projection_only");
  assert.match(os.detail, /projected → HeadySystems\/headyos-core/);
  assert.equal(networkHit, false, "a governed projection must not have its public URL probed");
});

test("projection connector WITHOUT a governed manifest falls through to the live server-manifest probe", async () => {
  const svc = createConsoleService({
    log: noLog, kernel: { services: [] }, publish: async () => {},
    registryPath: fixtureRegistry([
      { id: "shell", name: "Shell", kind: "heady", role: "shell", deploy_class: false, expected: "projection", probe: { kind: "https", url: "https://shell.example.headysystems.com/manifest" } },
    ]),
    fetchImpl: fakeFetch,
    readProjection: () => null, // no committed manifest → fall through
  });
  await svc.service.start();
  await svc.service.stop();
  assert.equal(svc.summary().connectors.find((c) => c.id === "shell").state, "projection_only");
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

test("vault probe: full token lifecycle — healthy / token_expired / missing / no-resolver", async () => {
  const VAULT_CONNECTORS = [
    { id: "cache-ok", name: "Cache", kind: "infra", role: "cache", deploy_class: false, expected: "real", probe: { kind: "vault", secrets: ["C_URL", "C_TOKEN"], ping: { urlSecret: "C_URL", path: "/ping", authSecret: "C_TOKEN" } } },
    { id: "api-expired", name: "API", kind: "infra", role: "edge", deploy_class: false, expected: "real", probe: { kind: "vault", secrets: ["A_TOKEN"], ping: { url: "https://api.example.headysystems.com/verify", authSecret: "A_TOKEN" } } },
    { id: "no-secret", name: "Missing", kind: "infra", role: "docs", deploy_class: false, expected: "real", probe: { kind: "vault", secrets: ["ABSENT_ONE"], ping: { url: "https://x.example.headysystems.com/", authSecret: "ABSENT_ONE" } } },
  ];
  const seen = [];
  const vaultFetch = async (url, opts) => {
    seen.push({ url, auth: opts.headers.authorization });
    if (url.includes("secret-host")) return { status: 200, json: async () => ({}) };
    return { status: 401, json: async () => ({}) };
  };
  const svc = createConsoleService({
    log: noLog, kernel: { services: [] }, publish: async () => {},
    registryPath: fixtureRegistry(VAULT_CONNECTORS), fetchImpl: vaultFetch,
    resolveSecrets: async () => ({ C_URL: "https://secret-host.upstash.example/", C_TOKEN: "tok-cache", A_TOKEN: "tok-api" }),
  });
  await svc.service.start();
  await svc.service.stop();
  const byId = Object.fromEntries(svc.summary().connectors.map((c) => [c.id, c]));
  assert.equal(byId["cache-ok"].state, "healthy");
  assert.equal(byId["api-expired"].state, "token_expired"); // 401 = the live Re-authorize signal
  assert.match(byId["api-expired"].detail, /re-authorize/);
  assert.equal(byId["no-secret"].state, "not_connected");
  assert.match(byId["no-secret"].detail, /ABSENT_ONE/);
  // secret hygiene: the auth header carried the token, but NO detail leaks values or vault URLs
  assert.equal(seen[0].auth, "Bearer tok-cache");
  for (const c of Object.values(byId)) {
    assert.ok(!String(c.detail).includes("secret-host"), "vault URL must never leak into details");
    assert.ok(!String(c.detail).includes("tok-"), "token values must never leak into details");
  }
  // trailing-slash join: urlSecret base + path must not double the slash
  assert.equal(seen[0].url, "https://secret-host.upstash.example/ping");
});

test("vault probe without a resolver = not_connected (dev/test never touches the vault)", async () => {
  const svc = createConsoleService({
    log: noLog, kernel: { services: [] }, publish: async () => {},
    registryPath: fixtureRegistry([
      { id: "v", name: "V", kind: "infra", role: "cache", deploy_class: false, expected: "real", probe: { kind: "vault", secrets: ["X_TOKEN"], ping: { url: "https://x.example.headysystems.com/", authSecret: "X_TOKEN" } } },
    ]),
    fetchImpl: async () => { throw new Error("must not be called"); },
  });
  await svc.service.start();
  await svc.service.stop();
  const v = svc.summary().connectors.find((c) => c.id === "v");
  assert.equal(v.state, "not_connected");
  assert.match(v.detail, /resolver not configured/);
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
    // The headyX projection shells now render projection_only from their committed
    // ADR-0017 manifests — NOT "healthy" off a bare 200 (anti-masquerade), even
    // though the injected fetch answers 200 for every https probe.
    for (const id of ["headysystems", "headyos", "headyio", "headyapi", "headyweb"]) {
      const shell = s.connectors.find((c) => c.id === id);
      assert.equal(shell.state, "projection_only", `${id} must render projection_only from its governed manifest`);
      assert.match(shell.detail, /projected → HeadySystems\//);
    }
  } finally {
    await a.stop();
  }
});
