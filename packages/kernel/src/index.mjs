// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Kernel v1.0.0 — Latent Service Pattern + boot ordering    ║
// ║  Every service exports {start,stop,health,metrics}; the kernel     ║
// ║  boots them in dependency order. © 2026 HeadySystems Inc.          ║
// ╚══════════════════════════════════════════════════════════════════╝

import { isService, makeHealth, ValidationError, HeadyError } from "@heady/shared";
import { withRetry, withTimeout } from "@heady/resilience";
import { createLogger } from "@heady/logger";

/**
 * Define a service that satisfies the Latent Service Pattern (AGENTS.md):
 * { name, deps?, start, stop, health, metrics }. Validated eagerly.
 */
export function defineService(def) {
  if (!def?.name || typeof def.name !== "string") throw new ValidationError("service requires a name");
  if (!isService(def)) throw new ValidationError(`service "${def.name}" must implement {start,stop,health,metrics}`);
  return { deps: [], ...def };
}

/** Topological order of services by `deps`; throws on missing dep or cycle. */
function topoOrder(services) {
  const byName = new Map(services.map((s) => [s.name, s]));
  const order = [];
  const state = new Map(); // name → 'visiting' | 'done'
  const visit = (name, trail) => {
    if (state.get(name) === "done") return;
    if (state.get(name) === "visiting") throw new ValidationError(`dependency cycle: ${[...trail, name].join(" → ")}`);
    const svc = byName.get(name);
    if (!svc) throw new ValidationError(`unknown service dependency: ${name}`);
    state.set(name, "visiting");
    for (const dep of svc.deps) visit(dep, [...trail, name]);
    state.set(name, "done");
    order.push(svc);
  };
  for (const s of services) visit(s.name, []);
  return order;
}

/** The microkernel: registers services, boots in dep order, aggregates health/metrics. */
export class Kernel {
  constructor({ logger = createLogger({ base: { module: "kernel" } }), startTimeoutMs = 30000 } = {}) {
    this.services = [];
    this.started = [];
    this.log = logger;
    this.startTimeoutMs = startTimeoutMs;
  }

  register(def) {
    const svc = defineService(def);
    if (this.services.some((s) => s.name === svc.name)) throw new ConflictName(svc.name);
    this.services.push(svc);
    return this;
  }

  /** Start every service in dependency order; each start is retried + time-bounded. */
  async boot() {
    const order = topoOrder(this.services);
    for (const svc of order) {
      this.log.info({ service: svc.name }, "starting");
      await withRetry(() => withTimeout(() => svc.start(), this.startTimeoutMs), {
        retries: 2,
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      });
      this.started.push(svc);
    }
    return this;
  }

  /** Aggregate health — the worst service status wins. */
  async health() {
    const checks = {};
    for (const svc of this.services) {
      try {
        const h = await svc.health();
        checks[svc.name] = h?.status ?? h;
      } catch {
        checks[svc.name] = "down";
      }
    }
    return makeHealth(checks);
  }

  /** Aggregate metrics keyed by service name. */
  async metrics() {
    const out = {};
    for (const svc of this.services) {
      try { out[svc.name] = await svc.metrics(); } catch { out[svc.name] = null; }
    }
    return out;
  }

  /** Stop started services in reverse order; collects (does not swallow) errors. */
  async shutdown() {
    const errors = [];
    for (const svc of [...this.started].reverse()) {
      try { await svc.stop(); } catch (e) { errors.push({ service: svc.name, error: e }); }
    }
    this.started = [];
    return errors;
  }
}

class ConflictName extends HeadyError {
  constructor(name) { super(`service "${name}" already registered`, { code: "CONFLICT", status: 409 }); }
}
