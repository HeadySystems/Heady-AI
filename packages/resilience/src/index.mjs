// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Resilience v1.0.0 — circuit breaker, retry, timeout,      ║
// ║  bulkhead, graceful shutdown. φ-scaled (AGENTS.md).               ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { phiBackoffMs, CIRCUIT_BREAKER, PHI } from "@heady/phi-math";
import { UpstreamError, RateLimitError } from "@heady/shared";

export const BREAKER_STATE = Object.freeze({ CLOSED: "CLOSED", OPEN: "OPEN", HALF_OPEN: "HALF_OPEN" });

/**
 * Circuit breaker: opens after `threshold` consecutive failures, cools down for a
 * φ-scaled window, then half-opens to probe. Time is injectable for tests.
 */
export class CircuitBreaker {
  constructor({ threshold = CIRCUIT_BREAKER.FAILURE_THRESHOLD, cooldownMs = CIRCUIT_BREAKER.PROBE_AFTER_MS, now = Date.now } = {}) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.now = now;
    this.failures = 0;
    this.state = BREAKER_STATE.CLOSED;
    this.openedAt = 0;
  }
  #canProbe() { return this.now() - this.openedAt >= this.cooldownMs; }
  async exec(fn) {
    if (this.state === BREAKER_STATE.OPEN) {
      if (!this.#canProbe()) throw new UpstreamError("circuit open", { state: this.state });
      this.state = BREAKER_STATE.HALF_OPEN;
    }
    try {
      const out = await fn();
      this.failures = 0;
      this.state = BREAKER_STATE.CLOSED;
      return out;
    } catch (e) {
      this.failures += 1;
      if (this.state === BREAKER_STATE.HALF_OPEN || this.failures >= this.threshold) {
        this.state = BREAKER_STATE.OPEN;
        this.openedAt = this.now();
      }
      throw e;
    }
  }
}

/** Retry with φ-backoff. `sleep` injectable; `retryable` decides which errors retry. */
export async function withRetry(fn, { retries = 3, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), retryable = () => true, onRetry } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      attempt += 1;
      if (attempt > retries || !retryable(e)) throw e;
      const delay = phiBackoffMs(attempt);
      if (onRetry) onRetry(attempt, delay, e);
      await sleep(delay);
    }
  }
}

/** Reject if `fn` exceeds `ms`. */
export function withTimeout(fn, ms, { timer = setTimeout, clear = clearTimeout } = {}) {
  return new Promise((resolve, reject) => {
    const t = timer(() => reject(new UpstreamError(`timeout after ${ms}ms`, { ms })), ms);
    Promise.resolve()
      .then(fn)
      .then((v) => { clear(t); resolve(v); })
      .catch((e) => { clear(t); reject(e); });
  });
}

/**
 * Bulkhead: cap concurrent executions to `limit`; queue up to `queue` waiters,
 * else reject (fail-fast under overload). Pool size defaults to a φ-derived cap.
 */
export class Bulkhead {
  constructor({ limit = Math.round(PHI * PHI), queue = Math.round(PHI * PHI * PHI) } = {}) {
    this.limit = limit;
    this.maxQueue = queue;
    this.active = 0;
    this.waiters = [];
  }
  async run(fn) {
    if (this.active >= this.limit) {
      if (this.waiters.length >= this.maxQueue) throw new RateLimitError("bulkhead full", { limit: this.limit });
      await new Promise((resolve) => this.waiters.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.waiters.shift();
      if (next) next();
    }
  }
}

/**
 * Register cleanup handlers run (in reverse) on SIGTERM/SIGINT. Returns a manual
 * trigger for tests/embedding. Handlers run once; errors are collected, not swallowed.
 */
export function gracefulShutdown(handlers = [], { signals = ["SIGTERM", "SIGINT"], process: proc = globalThis.process } = {}) {
  let done = false;
  const run = async () => {
    if (done) return [];
    done = true;
    const errors = [];
    for (const h of [...handlers].reverse()) {
      try { await h(); } catch (e) { errors.push(e); }
    }
    return errors;
  };
  if (proc?.once) for (const s of signals) proc.once(s, run);
  return run;
}
