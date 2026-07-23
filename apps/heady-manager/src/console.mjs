// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — Console probe service (§8 living state)    ║
// ║  Probes every registry connector on the φ⁷ heartbeat (29 034 ms)   ║
// ║  and serves the ConsoleSummary the honeycomb renders. States are    ║
// ║  MEASURED, never asserted: a shell that only projects reports       ║
// ║  projection_only via its manifest; an unwired token is              ║
// ║  not_connected; a gate/redirect is degraded — no masquerades.       ║
// ║  Kernel-managed {start,stop,health,metrics}; timers unref'd.        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PHI, HEARTBEAT_MS } from "@heady/phi-math";
import { validateConnectorRegistry, validateServerManifest, buildConsoleSummary } from "@heady/contracts";
import { HEALTH } from "@heady/shared";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const REGISTRY_PATH = join(REPO_ROOT, "configs", "connectors.json");
/** Per-probe timeout: φ² seconds (≈2 618 ms) — φ-derived, no magic numbers. */
export const PROBE_TIMEOUT_MS = Math.round(PHI * PHI * 1000);

/** Map an HTTPS probe outcome to the §8 state model. Exported for tests. */
export function classifyHttp({ status, body }) {
  if (status >= 200 && status < 300) {
    // A truth-telling shell manifest wins over a bare 200 (anti-masquerade).
    if (body && typeof body === "object" && body.schema === "server-manifest.v1") {
      const v = validateServerManifest(body);
      if (v.ok && body.projection_only) return { state: "projection_only", detail: `projected from ${body.provenance.source_repo}` };
      if (v.ok) return { state: "healthy", detail: `manifest: ${body.name}` };
      return { state: "degraded", detail: `invalid manifest: ${v.errors[0]}` };
    }
    return { state: "healthy" };
  }
  if (status >= 300 && status < 400) return { state: "degraded", detail: `gated (HTTP ${status})` };
  if (status === 401 || status === 403) return { state: "degraded", detail: `auth-gated (HTTP ${status})` };
  return { state: "degraded", detail: `HTTP ${status}` };
}

/**
 * Build the Console service + routes.
 * @param {object} opts
 * @param {object} opts.log pino-style logger
 * @param {object} opts.kernel the app kernel (kernel-probe source of truth)
 * @param {Function} opts.publish event hook — publish(subject, payload)
 * @param {string} [opts.registryPath] connectors.json (default: configs/)
 * @param {typeof fetch} [opts.fetchImpl] injectable for tests
 * @param {number} [opts.heartbeatMs] φ⁷ by default
 * @param {() => number} [opts.now]
 */
export function createConsoleService({
  log, kernel, publish,
  registryPath = REGISTRY_PATH, fetchImpl = fetch, heartbeatMs = HEARTBEAT_MS, now = () => Date.now(),
  deps = [],
  resolveSecrets = null, // composition-root owned (index.mjs wires the vault); null ⇒ vault probes report not_connected
}) {
  let registry = null;
  let loadError = null;
  let timer = null;
  let lastSweepAt = null;
  let secretCache = null; // name → value, resolved ONCE at start (rotation ⇒ restart)
  const states = new Map(); // id → { state, detail, latencyMs, checkedAt }

  function loadRegistry() {
    const parsed = JSON.parse(readFileSync(registryPath, "utf8"));
    const v = validateConnectorRegistry(parsed);
    if (!v.ok) throw new Error(`connectors.json invalid: ${v.errors.join("; ")}`);
    return parsed;
  }

  async function probeHttps(url) {
    const controller = new AbortController();
    const kill = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const startedAt = now();
    try {
      const res = await fetchImpl(url, { redirect: "manual", signal: controller.signal });
      const latencyMs = now() - startedAt;
      let body = null;
      try { body = await res.json(); } catch { /* non-JSON bodies are fine */ }
      return { ...classifyHttp({ status: res.status, body }), latencyMs };
    } catch (err) {
      return { state: "unreachable", detail: String(err?.message ?? err).slice(0, 120), latencyMs: now() - startedAt };
    } finally {
      clearTimeout(kill);
    }
  }

  async function probeKernel(service) {
    // Read the service's FULL health object (kernel.health() flattens to a
    // status string and would report a disabled service as "ok" — a fake
    // healthy the console must never emit).
    const def = kernel.services?.find?.((s) => s.name === service);
    if (!def) return { state: "unreachable", detail: `kernel:${service} absent` };
    try {
      const h = await def.health();
      if (h?.mode === "disabled") return { state: "not_connected", detail: `kernel:${service} disabled` };
      if (h?.status === "ok") return { state: "healthy", detail: `kernel:${service}` };
      if (h?.status === "degraded") return { state: "degraded", detail: `kernel:${service} ${h?.reason ?? ""}`.trim() };
      return { state: "unreachable", detail: `kernel:${service} ${h?.status ?? "unknown"}` };
    } catch (err) {
      return { state: "unreachable", detail: `kernel:${service} ${String(err?.message ?? err).slice(0, 80)}` };
    }
  }

  /**
   * Vault probe — the live token lifecycle (§8): resolve the connector's
   * credentials from the vault and ping authenticated. 2xx = healthy,
   * 401/403 = token_expired (the Re-authorize signal), else degraded/
   * unreachable. Details NEVER carry URLs or values — a vault-resolved URL
   * (e.g. an Upstash instance host) is itself sensitive.
   */
  async function probeVault({ id, probe }) {
    if (!resolveSecrets) return { state: "not_connected", detail: "vault resolver not configured" };
    if (!secretCache) {
      const names = [...new Set(registry.connectors.flatMap((c) => (c.probe?.kind === "vault" ? c.probe.secrets : [])))];
      try { secretCache = await resolveSecrets(names); } catch (err) {
        secretCache = {};
        log.warn({ err: String(err?.message ?? err) }, "console: vault resolution failed — vault probes degrade honestly");
      }
    }
    const missing = probe.secrets.filter((n) => !secretCache[n]);
    if (missing.length) return { state: "not_connected", detail: `vault: ${missing.join(", ")} not present` };

    const base = probe.ping.url ?? secretCache[probe.ping.urlSecret];
    if (!base) return { state: "not_connected", detail: "vault: ping url unresolved" };
    const url = `${String(base).replace(/\/+$/, "")}${probe.ping.path ?? ""}`;
    const controller = new AbortController();
    const kill = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const startedAt = now();
    try {
      const res = await fetchImpl(url, {
        signal: controller.signal,
        headers: { authorization: `${probe.ping.scheme ?? "Bearer"} ${secretCache[probe.ping.authSecret]}` },
      });
      const latencyMs = now() - startedAt;
      if (res.status === 401 || res.status === 403) return { state: "token_expired", detail: `credential rejected (HTTP ${res.status}) — re-authorize`, latencyMs };
      if (res.status >= 200 && res.status < 300) return { state: "healthy", detail: "authenticated ping ok", latencyMs };
      return { state: "degraded", detail: `HTTP ${res.status}`, latencyMs };
    } catch (err) {
      return { state: "unreachable", detail: `ping failed: ${String(err?.name ?? "error")}`, latencyMs: now() - startedAt };
    } finally {
      clearTimeout(kill);
    }
  }

  async function probeOne(connector) {
    if (connector.probe === null) return { state: "not_connected", detail: "token/OAuth lifecycle not wired yet" };
    if (connector.probe.kind === "kernel") return probeKernel(connector.probe.service);
    if (connector.probe.kind === "vault") return probeVault(connector);
    return probeHttps(connector.probe.url);
  }

  /** One full sweep across the registry; publishes transitions. Exported on the handle for tests. */
  async function sweep() {
    if (!registry) return;
    await Promise.all(registry.connectors.map(async (c) => {
      const result = await probeOne(c);
      const prev = states.get(c.id)?.state;
      states.set(c.id, { ...result, checkedAt: new Date(now()).toISOString() });
      if (prev && prev !== result.state) {
        log.info({ connector: c.id, from: prev, to: result.state }, "console: connector state transition");
        await publish("console.connector.state", { id: c.id, from: prev, to: result.state, detail: result.detail ?? null });
      }
    }));
    lastSweepAt = new Date(now()).toISOString();
  }

  function summary() {
    if (!registry) {
      return { schema: "console-summary.v1", heartbeatMs, generatedAt: new Date(now()).toISOString(), error: loadError ?? "registry not loaded", connectors: [] };
    }
    return buildConsoleSummary({
      heartbeatMs,
      generatedAt: new Date(now()).toISOString(),
      connectors: registry.connectors.map((c) => ({
        id: c.id, name: c.name, kind: c.kind, role: c.role,
        deploy_class: c.deploy_class, expected: c.expected,
        ...(states.get(c.id) ?? { state: "connecting", checkedAt: null }),
      })),
    });
  }

  const service = {
    name: "console",
    // The console observes the whole organism — it boots after what it probes
    // (kernel topo-orders by deps), so the FIRST sweep sees live services.
    deps,
    start: async () => {
      try {
        registry = loadRegistry();
        loadError = null;
      } catch (err) {
        loadError = String(err?.message ?? err);
        log.warn({ err: loadError }, "console: registry unavailable — serving honest error state");
        return;
      }
      await sweep(); // first sweep before the heartbeat takes over
      timer = setInterval(() => { sweep().catch((err) => log.warn({ err: String(err?.message ?? err) }, "console: sweep failed")); }, heartbeatMs);
      timer.unref();
      log.info({ connectors: registry.connectors.length, heartbeatMs }, "console: probing on the φ⁷ heartbeat");
    },
    stop: async () => { if (timer) clearInterval(timer); timer = null; },
    health: async () => (registry
      ? { status: HEALTH.OK }
      : { status: HEALTH.DEGRADED, reason: loadError ?? "registry not loaded" }),
    metrics: async () => {
      const s = summary();
      return { connectors: s.connectors.length, counts: s.counts ?? {}, lastSweepAt };
    },
  };

  function routes(app) {
    // The Console UI's data source — one summary, every cell's measured truth.
    app.get("/api/console/summary", (_req, res) => res.json(summary()));
  }

  return { service, routes, sweep, summary };
}
