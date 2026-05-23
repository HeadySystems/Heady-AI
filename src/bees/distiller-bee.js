'use strict';

/**
 * DistillerBee — HeadyBee specialization for Stage 22 DISTILL.
 * Spawned by bee-factory when DISTILL intent class is detected.
 *
 * Communicates with the heady-distiller service via the DISTILLER_URL
 * environment variable (Cloud Run service discovery / Cloudflare Worker binding).
 *
 * All constants phi-derived. Zero localhost. Zero placeholders.
 *
 * @module bees/distiller-bee
 */

const PHI  = 1.618033988749895;
const PSI  = 0.618033988749895;
const FIB  = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// CSL gate thresholds
const CSL = {
  INCLUDE  : 0.382,
  MINIMUM  : 0.500,
  BOOST    : PSI,     // 0.618
  MEDIUM   : 0.809,
  HIGH     : 0.882,
  CRITICAL : 0.927,
};

/**
 * Phi-exponential backoff with ±38.2% jitter.
 * @param {number} attempt — 0-indexed retry count
 * @param {number} [baseMs=1000]
 * @param {number} [maxMs=13000] — FIB[7] * 1000
 * @returns {number} delay in ms
 */
function phiBackoff(attempt, baseMs = 1000, maxMs = 13000) {
  const delay = Math.min(baseMs * Math.pow(PHI, attempt), maxMs);
  const jitter = delay * PSI * PSI * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

class DistillerBee {
  /**
   * @param {object} [config]
   * @param {string} [config.distillerUrl] — override service URL (env: DISTILLER_URL)
   * @param {number} [config.maxRetries]   — max retries (default: FIB[4] = 3)
   * @param {number} [config.timeoutMs]    — request timeout (default: FIB[11]*FIB[7] = 1157ms)
   */
  constructor(config = {}) {
    this.type    = 'distiller';
    this.version = '2.0.0';
    this.status  = 'idle';

    // Service URL from env — NEVER localhost
    this.distillerUrl = config.distillerUrl
      || process.env.DISTILLER_URL
      || process.env.DISTILLER_SERVICE_URL;

    if (!this.distillerUrl) {
      throw new Error(
        '[DistillerBee] DISTILLER_URL or DISTILLER_SERVICE_URL environment variable is required. ' +
        'Set to the Cloud Run or Cloudflare Worker URL for the heady-distiller service.'
      );
    }

    this.maxRetries = config.maxRetries ?? FIB[4];  // 3
    this.timeoutMs  = config.timeoutMs  ?? (FIB[11] * FIB[7]);  // 89 * 13 = 1157ms
  }

  /**
   * spawn — initialize the bee, validate service connectivity.
   * @returns {Promise<{type: string, version: string, status: string}>}
   */
  async spawn() {
    this.status = 'spawning';

    // Validate service connectivity with a health check
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(`${this.distillerUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(id);

      if (!res.ok) {
        throw new Error(`Health check returned ${res.status}`);
      }

      const body = await res.json();
      this.status = 'ready';
      return { type: this.type, version: this.version, status: this.status, serviceHealth: body };
    } catch (err) {
      this.status = 'degraded';
      return { type: this.type, version: this.version, status: this.status, error: err.message };
    }
  }

  /**
   * execute — run distillation for a pipeline trace.
   * @param {object} task
   * @param {string} task.trace_id     — pipeline run ID
   * @param {object} task.execution_log — full execution trace
   * @param {number} task.judge_score   — judge confidence (0-1)
   * @param {object} [task.metadata]    — additional context
   * @returns {Promise<{success: boolean, result?: object, error?: string}>}
   */
  async execute(task) {
    this.status = 'distilling';
    const { trace_id, execution_log, judge_score, metadata } = task;

    // CSL BOOST gate — skip if judge score below threshold
    if (typeof judge_score === 'number' && judge_score < CSL.BOOST) {
      this.status = 'complete';
      return {
        success: true,
        result: {
          skipped: true,
          reason: 'judge_score_below_boost_threshold',
          judge_score,
          threshold: CSL.BOOST,
        },
      };
    }

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.distillerUrl}/distill`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Heady-Run-Id': trace_id || 'unknown',
            'X-Heady-Bee-Type': this.type,
          },
          body: JSON.stringify({ trace_id, execution_log, judge_score, metadata }),
          signal: controller.signal,
        });
        clearTimeout(id);

        if (!response.ok) {
          throw new Error(`Distiller service returned ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        this.status = 'complete';
        return { success: true, result };

      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          const delay = phiBackoff(attempt);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // All retries exhausted — distillation is non-blocking, so return gracefully
    this.status = 'error';
    return {
      success: false,
      error: lastError?.message || 'Unknown distillation error',
      retries: this.maxRetries,
      faultTolerant: true,
    };
  }

  /**
   * report — return current status and metrics.
   * @returns {object}
   */
  report() {
    return {
      type: this.type,
      version: this.version,
      status: this.status,
      distillerUrl: this.distillerUrl,
      maxRetries: this.maxRetries,
      timeoutMs: this.timeoutMs,
    };
  }

  /**
   * retire — clean up and deregister.
   * @returns {Promise<{retired: boolean}>}
   */
  async retire() {
    this.status = 'retired';
    return { retired: true };
  }

  /**
   * health — health check for bee registry.
   * @returns {object}
   */
  health() {
    return {
      type: this.type,
      version: this.version,
      status: this.status,
      distillerUrl: this.distillerUrl ? '[configured]' : '[missing]',
    };
  }
}

module.exports = { DistillerBee };
