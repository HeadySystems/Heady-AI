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
// ║  FILE: src/core/circuit-breaker.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Circuit Breaker — Multi-service resilience with Phi (φ) exponential backoff.
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 */
const PHI = 1.618033988749895;

export class CircuitBreaker {
  #log;
  #circuits = new Map();
  #defaults = { failThreshold: 5, resetTimeout: 30_000, halfOpenMax: 2 };

  constructor({ log }) {
    this.#log = log;
  }

  #getOrCreate(name) {
    if (!this.#circuits.has(name)) {
      this.#circuits.set(name, {
        state: 'CLOSED',
        failures: 0,
        lastFailure: 0,
        resetTimeout: this.#defaults.resetTimeout,
        halfOpenAttempts: 0,
      });
    }
    return this.#circuits.get(name);
  }

  isOpen(name) {
    const c = this.#getOrCreate(name);
    if (c.state === 'OPEN') {
      if (Date.now() - c.lastFailure > c.resetTimeout) {
        c.state = 'HALF_OPEN';
        c.halfOpenAttempts = 0;
        this.#log.info({ service: name }, 'Circuit → HALF_OPEN');
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(name) {
    const c = this.#getOrCreate(name);
    c.failures = 0;
    c.state = 'CLOSED';
    c.resetTimeout = this.#defaults.resetTimeout;
  }

  recordFailure(name) {
    const c = this.#getOrCreate(name);
    c.failures++;
    c.lastFailure = Date.now();
    if (c.failures >= this.#defaults.failThreshold) {
      c.state = 'OPEN';
      c.resetTimeout = Math.round(c.resetTimeout * PHI); // golden ratio backoff
      this.#log.warn({ service: name, resetTimeout: c.resetTimeout }, 'Circuit → OPEN (φ backoff)');
    }
  }

  status() {
    const out = {};
    for (const [name, c] of this.#circuits) out[name] = { state: c.state, failures: c.failures };
    return out;
  }
}
