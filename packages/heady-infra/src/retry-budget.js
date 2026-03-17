/**
 * Heady™ Adaptive Retry Budget — φ-scaled per pipeline stage
 * @module core/infrastructure/retry-budget
 */
import { PHI, PSI, TIMING, FIB, phiBackoffWithJitter, CSL } from '../constants/phi.js';

export class RetryBudget {
  constructor({ totalMs = TIMING.WARM, maxAttempts = FIB[4] } = {}) {
    this.totalMs = totalMs; this.remaining = totalMs;
    this.maxAttempts = maxAttempts; this.attempts = 0; this.log = [];
  }

  async attempt(label, fn, { critical = false } = {}) {
    if (this.attempts >= this.maxAttempts) throw new Error(`[RetryBudget] Max attempts (${this.maxAttempts}) exceeded for: ${label}`);
    if (this.remaining < TIMING.CONNECT && !critical) throw new Error(`[RetryBudget] Budget exhausted (${this.remaining}ms left) for: ${label}`);
    const start = Date.now();
    try {
      const result = await fn();
      this.remaining -= Date.now()-start;
      this.log.push({ label, elapsed: Date.now()-start, success: true, attempt: this.attempts });
      return result;
    } catch (err) {
      const elapsed = Date.now()-start;
      this.remaining -= elapsed; this.attempts++;
      this.log.push({ label, elapsed, success: false, error: err.message, attempt: this.attempts });
      if (this.attempts >= this.maxAttempts) throw err;
      if (this.remaining < TIMING.CONNECT) throw err;
      const delay = Math.min(phiBackoffWithJitter(this.attempts), this.remaining * PSI);
      await new Promise(r => setTimeout(r, delay));
      return this.attempt(label, fn, { critical });
    }
  }

  get confidence() { return (1 - (this.totalMs-this.remaining)/this.totalMs) * CSL.HIGH; }
  getSummary() { return { totalMs: this.totalMs, remaining: this.remaining, attempts: this.attempts, maxAttempts: this.maxAttempts, confidence: this.confidence, log: this.log }; }
}
