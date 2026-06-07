// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/core/liquid-architecture.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Liquid Architecture — Dynamic service allocation.
 * Scales up under heavy load, conserves under light load.
 * Always-on: patterns, auto-success, streaming.
 */
export class LiquidArchitecture {
  #log;
  #circuitBreaker;
  #services = new Map();
  #alwaysOn = new Set(['patterns', 'auto-success', 'streaming']);

  constructor({ log, circuitBreaker }) {
    this.#log = log;
    this.#circuitBreaker = circuitBreaker;
  }

  register(name, handler) {
    this.#services.set(name, { handler, active: this.#alwaysOn.has(name), load: 0 });
    this.#log.info({ service: name }, 'Registered in liquid architecture');
  }

  async allocate(name) {
    const svc = this.#services.get(name);
    if (!svc) throw new Error(`Unknown service: ${name}`);
    if (this.#circuitBreaker.isOpen(name)) {
      this.#log.warn({ service: name }, 'Circuit open — skipping allocation');
      return null;
    }
    svc.active = true;
    svc.load++;
    return svc.handler;
  }

  async deallocate(name) {
    const svc = this.#services.get(name);
    if (svc && !this.#alwaysOn.has(name)) {
      svc.load = Math.max(0, svc.load - 1);
      if (svc.load === 0) svc.active = false;
    }
  }

  status() {
    const out = {};
    for (const [name, svc] of this.#services) {
      out[name] = { active: svc.active, load: svc.load };
    }
    return out;
  }

  async stop() {
    this.#log.info('Liquid Architecture shutting down');
    this.#services.clear();
  }
}
