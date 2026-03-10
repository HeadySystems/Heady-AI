'use strict';

/**
 * Heady™ Colab Runtime Manager
 * Manages 3 Colab Pro+ runtimes as distributed latent space compute nodes
 * for the Heady latent OS. Routes tasks via CSL-scored affinity, monitors
 * health at Fibonacci intervals, and rebalances on failure.
 *
 * ALL numeric constants derive from φ (phi ≈ 1.618) or Fibonacci numbers.
 *
 * @module colab-runtime-manager
 * @author HeadySystems Inc.
 * @license Proprietary
 */

const EventEmitter = require('events');

// ─── Phi / Fibonacci Primitives ──────────────────────────────────────────────

/** @constant {number} PHI - Golden ratio φ = (1 + √5) / 2 ≈ 1.618033988749895 */
const PHI = (1 + Math.sqrt(5)) / 2;

/** @constant {number} PSI - Conjugate golden ratio ψ = 1/φ ≈ 0.618033988749895 */
const PSI = 1 / PHI;

/**
 * Compute the n-th Fibonacci number via Binet's closed-form formula.
 * @param {number} n - Non-negative integer index.
 * @returns {number} F(n).
 */
const fib = (n) => Math.round((Math.pow(PHI, n) - Math.pow(-PSI, n)) / Math.sqrt(5));

// ─── Derived Constants ───────────────────────────────────────────────────────

/** @constant {number} HEALTH_CHECK_INTERVAL_MS - fib(7) × 1000 = 13 000 ms */
const HEALTH_CHECK_INTERVAL_MS = fib(7) * 1000;

/** @constant {number} CIRCUIT_BREAKER_THRESHOLD - fib(5) = 5 consecutive failures to open */
const CIRCUIT_BREAKER_THRESHOLD = fib(5);

/** @constant {number} MAX_RETRIES - fib(4) = 3 retry attempts before giving up */
const MAX_RETRIES = fib(4);

/** @constant {number} BASE_BACKOFF_MS - fib(6) × 100 = 800 ms base delay */
const BASE_BACKOFF_MS = fib(6) * 100;

/** @constant {number} REBALANCE_COOLDOWN_MS - fib(8) × 1000 = 21 000 ms between rebalances */
const REBALANCE_COOLDOWN_MS = fib(8) * 1000;

/** @constant {number} CONNECTION_TIMEOUT_MS - fib(9) × 1000 = 34 000 ms */
const CONNECTION_TIMEOUT_MS = fib(9) * 1000;

/** @constant {number} TASK_TIMEOUT_MS - fib(11) × 1000 = 89 000 ms */
const TASK_TIMEOUT_MS = fib(11) * 1000;

/** @constant {number} MAX_QUEUE_SIZE - fib(13) = 233 tasks per runtime queue */
const MAX_QUEUE_SIZE = fib(13);

/** @constant {number} HALF_OPEN_PROBE_DELAY_MS - fib(10) × 100 = 5 500 ms */
const HALF_OPEN_PROBE_DELAY_MS = fib(10) * 100;

/**
 * CSL (Composite Scoring Lattice) routing weights.
 * Derived from sequential Fibonacci numbers normalised to sum ≈ 1.0:
 *   fib(7)=13, fib(6)=8, fib(6)=8, fib(5)=5, fib(4)=3  →  total = 37
 *   gpu_util  = 13/37 ≈ 0.3514
 *   memory    =  8/37 ≈ 0.2162
 *   queue     =  8/37 ≈ 0.2162
 *   latency   =  5/37 ≈ 0.1351
 *   cache_hit =  3/37 ≈ 0.0811
 *
 * Rounded presentation: 0.34, 0.21, 0.21, 0.13, 0.11.
 * @constant {Object}
 */
const CSL_WEIGHT_DENOM = fib(7) + fib(6) + fib(6) + fib(5) + fib(4);
const CSL_WEIGHTS = Object.freeze({
  gpu_util:  fib(7) / CSL_WEIGHT_DENOM,
  memory:    fib(6) / CSL_WEIGHT_DENOM,
  queue:     fib(6) / CSL_WEIGHT_DENOM,
  latency:   fib(5) / CSL_WEIGHT_DENOM,
  cache_hit: fib(4) / CSL_WEIGHT_DENOM,
});

/**
 * The three runtime slots and their default task-type specialisations.
 * Alpha handles embeddings, Beta handles inference, Gamma handles vector ops.
 * @constant {Object<string, string>}
 */
const RUNTIME_SLOTS = Object.freeze({
  alpha: 'embedding',
  beta:  'inference',
  gamma: 'vector_ops',
});

// ─── CircuitBreaker ──────────────────────────────────────────────────────────

/**
 * Per-runtime circuit breaker.
 * Opens after {@link CIRCUIT_BREAKER_THRESHOLD} (fib(5) = 5) consecutive
 * failures. After a phi-scaled cool-down the breaker transitions to
 * half-open and allows a single probe request.
 */
class CircuitBreaker {
  /**
   * Create a circuit breaker for a runtime.
   * @param {string} runtimeId - Slot identifier (alpha | beta | gamma).
   */
  constructor(runtimeId) {
    /** @type {string} */
    this.runtimeId = runtimeId;
    /** @type {number} Consecutive failure count */
    this.failures = 0;
    /** @type {'closed'|'open'|'half-open'} */
    this.state = 'closed';
    /** @type {number} Epoch ms of last failure */
    this.lastFailureTs = 0;
    /** @type {number} Current cool-down in ms (grows with phi on repeated opens) */
    this.cooldownMs = HALF_OPEN_PROBE_DELAY_MS;
    /** @type {number} Number of times the breaker has opened */
    this.tripCount = 0;
  }

  /**
   * Record a successful operation — reset failures and close the breaker.
   */
  recordSuccess() {
    this.failures = 0;
    this.state = 'closed';
    this.cooldownMs = HALF_OPEN_PROBE_DELAY_MS;
  }

  /**
   * Record a failure. If the threshold is reached the breaker opens and the
   * cool-down grows by φ for each successive trip.
   * @returns {boolean} `true` if the breaker has just tripped open.
   */
  recordFailure() {
    this.failures += 1;
    this.lastFailureTs = Date.now();
    if (this.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.state = 'open';
      this.tripCount += 1;
      this.cooldownMs = Math.round(HALF_OPEN_PROBE_DELAY_MS * Math.pow(PHI, this.tripCount - 1));
      return true;
    }
    return false;
  }

  /**
   * Whether traffic may be sent through this breaker.
   * @returns {boolean}
   */
  allowRequest() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTs >= this.cooldownMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    /* half-open — allow a single probe */
    return true;
  }

  /**
   * Unconditionally reset the breaker.
   */
  reset() {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTs = 0;
    this.cooldownMs = HALF_OPEN_PROBE_DELAY_MS;
    this.tripCount = 0;
  }
}

// ─── ColabRuntime ────────────────────────────────────────────────────────────

/**
 * Represents a single Colab Pro+ runtime connection.
 * Manages connection lifecycle, code execution, metric collection,
 * and local task queue tracking.
 */
class ColabRuntime {
  /**
   * @param {Object} config
   * @param {string} config.id             - Slot id (alpha | beta | gamma).
   * @param {string} config.url            - Colab runtime REST endpoint.
   * @param {string} config.token          - Authentication bearer token.
   * @param {string} config.specialization - Task type this slot is optimised for.
   */
  constructor({ id, url, token, specialization }) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.url = url;
    /** @type {string} */
    this.token = token;
    /** @type {string} */
    this.specialization = specialization;
    /** @type {'disconnected'|'connecting'|'connected'|'executing'|'error'} */
    this.status = 'disconnected';
    /** @type {CircuitBreaker} */
    this.circuitBreaker = new CircuitBreaker(id);
    /** @type {Array<Object>} Pending/active tasks for this runtime */
    this.taskQueue = [];
    /** @type {number} Created-at timestamp */
    this.createdAt = Date.now();

    /**
     * Real-time metrics consumed by CSL scoring.
     * @type {Object}
     */
    this.metrics = {
      gpuUtilization: 0,
      memoryUsage:    0,
      queueDepth:     0,
      avgLatencyMs:   0,
      cacheHitRate:   0,
      lastHealthCheck:     0,
      totalTasksExecuted:  0,
      totalTasksFailed:    0,
    };

    /** @private {number} EMA weight for latency — derived from PSI */
    this._emaAlpha = PSI;
  }

  /**
   * Establish a connection to the Colab runtime.
   * @returns {Promise<boolean>} `true` on success.
   * @throws {Error} On connection failure.
   */
  async connect() {
    if (this.status === 'connected' || this.status === 'executing') {
      return true;
    }
    this.status = 'connecting';
    try {
      const res = await this._httpPost(`${this.url}/api/connect`, {
        specialization: this.specialization,
        timeout: CONNECTION_TIMEOUT_MS,
      });
      if (res && res.status === 'ok') {
        this.status = 'connected';
        this.circuitBreaker.reset();
        return true;
      }
      throw new Error(`Unexpected connect response: ${JSON.stringify(res)}`);
    } catch (err) {
      this.status = 'error';
      this.circuitBreaker.recordFailure();
      throw err;
    }
  }

  /**
   * Execute Python code on this runtime.
   * @param {string} code          - Python source code.
   * @param {Object} [opts]        - Optional overrides.
   * @param {number} [opts.timeoutMs] - Override default task timeout.
   * @returns {Promise<Object>} Execution result payload.
   * @throws {Error} On execution or network failure.
   */
  async execute(code, opts = {}) {
    const timeout = opts.timeoutMs || TASK_TIMEOUT_MS;
    const prevStatus = this.status;
    this.status = 'executing';
    const start = Date.now();
    try {
      const result = await this._httpPost(`${this.url}/api/execute`, {
        code,
        timeout,
      });
      const elapsed = Date.now() - start;
      this._updateLatency(elapsed);
      this.metrics.totalTasksExecuted += 1;
      this.status = 'connected';
      this.circuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      this.metrics.totalTasksFailed += 1;
      this.status = prevStatus === 'connected' ? 'connected' : 'error';
      this.circuitBreaker.recordFailure();
      throw err;
    }
  }

  /**
   * Lightweight health-check ping that updates GPU and memory metrics.
   * @returns {Promise<Object>} Health payload from the runtime.
   * @throws {Error} If the health check request fails.
   */
  async healthCheck() {
    try {
      const result = await this._httpPost(`${this.url}/api/health`, {});
      if (result) {
        this.metrics.gpuUtilization = result.gpu_utilization ?? this.metrics.gpuUtilization;
        this.metrics.memoryUsage    = result.memory_usage    ?? this.metrics.memoryUsage;
        this.metrics.cacheHitRate   = result.cache_hit_rate  ?? this.metrics.cacheHitRate;
        this.metrics.lastHealthCheck = Date.now();
      }
      this.circuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      this.circuitBreaker.recordFailure();
      throw err;
    }
  }

  /**
   * Disconnect from the Colab runtime gracefully.
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      await this._httpPost(`${this.url}/api/disconnect`, {});
    } catch (_) {
      /* best-effort disconnect */
    } finally {
      this.status = 'disconnected';
    }
  }

  /**
   * Compute the CSL (Composite Scoring Lattice) score for this runtime.
   * Lower is better — a perfectly idle runtime scores near 0.
   *
   * Weights (phi-derived):
   *   gpu_util × 0.34 + memory × 0.21 + queue × 0.21
   *   + latency × 0.13 + (1 − cache_hit) × 0.11
   *
   * @returns {number} Score in [0, 1].
   */
  computeCSLScore() {
    const normQueue   = Math.min(this.taskQueue.length / fib(8), 1);
    const normLatency = Math.min(this.metrics.avgLatencyMs / TASK_TIMEOUT_MS, 1);
    const cacheInverse = 1 - Math.min(this.metrics.cacheHitRate, 1);

    return (
      CSL_WEIGHTS.gpu_util  * Math.min(this.metrics.gpuUtilization, 1) +
      CSL_WEIGHTS.memory    * Math.min(this.metrics.memoryUsage, 1) +
      CSL_WEIGHTS.queue     * normQueue +
      CSL_WEIGHTS.latency   * normLatency +
      CSL_WEIGHTS.cache_hit * cacheInverse
    );
  }

  /**
   * Serialise the runtime state for status reporting.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      specialization: this.specialization,
      status: this.status,
      circuitBreaker: this.circuitBreaker.state,
      cslScore: this.computeCSLScore(),
      queueDepth: this.taskQueue.length,
      metrics: { ...this.metrics },
      uptime: Date.now() - this.createdAt,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Update rolling-average latency using an EMA weighted by PSI.
   * @param {number} latencyMs - Latest observed latency.
   * @private
   */
  _updateLatency(latencyMs) {
    if (this.metrics.avgLatencyMs === 0) {
      this.metrics.avgLatencyMs = latencyMs;
    } else {
      this.metrics.avgLatencyMs =
        this._emaAlpha * latencyMs +
        (1 - this._emaAlpha) * this.metrics.avgLatencyMs;
    }
  }

  /**
   * POST JSON to a Colab runtime endpoint with auth and timeout.
   * @param {string} endpoint - Full URL.
   * @param {Object} body     - JSON-serialisable payload.
   * @returns {Promise<Object>} Parsed JSON response.
   * @private
   */
  async _httpPost(endpoint, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} from ${endpoint}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── LatentSpaceRouter ───────────────────────────────────────────────────────

/**
 * Routes tasks to the optimal Colab runtime based on task-type affinity
 * and real-time CSL scores.
 *
 * Routing strategy:
 *  1. If the affinity-matched runtime is healthy and its CSL score is within
 *     φ of the global best, prefer it (locality bias).
 *  2. Otherwise fall back to the lowest-scoring available runtime.
 */
class LatentSpaceRouter {
  /**
   * @param {Map<string, ColabRuntime>} runtimes - Slot-id → runtime map.
   */
  constructor(runtimes) {
    /** @type {Map<string, ColabRuntime>} */
    this.runtimes = runtimes;

    /**
     * Affinity map: task type → preferred runtime slot.
     * @type {Object<string, string>}
     */
    this.affinityMap = {
      embedding:   'alpha',
      inference:   'beta',
      vector_ops:  'gamma',
    };

    /** @type {number} Routing decisions counter */
    this.routeCount = 0;
    /** @type {number} Affinity-hit counter */
    this.affinityHits = 0;
  }

  /**
   * Select the best runtime for a given task type.
   * @param {string} taskType - One of embedding | inference | vector_ops.
   * @returns {ColabRuntime|null} Best runtime, or null if none available.
   */
  route(taskType) {
    const preferredSlot = this.affinityMap[taskType];
    const candidates = this._getAvailableCandidates();
    if (candidates.length === 0) return null;

    this.routeCount += 1;
    candidates.sort((a, b) => a.score - b.score);

    const best = candidates[0];
    const preferred = candidates.find((c) => c.id === preferredSlot);

    if (preferred) {
      /* Prefer affinity runtime unless another is φ-times better */
      if (best.score >= preferred.score / PHI) {
        this.affinityHits += 1;
        return preferred.runtime;
      }
    }

    return best.runtime;
  }

  /**
   * Return all healthy runtimes ranked by ascending CSL score.
   * @returns {Array<{id: string, runtime: ColabRuntime, score: number}>}
   */
  ranked() {
    return this._getAvailableCandidates().sort((a, b) => a.score - b.score);
  }

  /**
   * Return routing statistics.
   * @returns {Object}
   */
  stats() {
    return {
      routeCount: this.routeCount,
      affinityHits: this.affinityHits,
      affinityRate: this.routeCount > 0 ? this.affinityHits / this.routeCount : 0,
    };
  }

  /**
   * Gather runtimes whose circuit breakers allow traffic and that are
   * connected, paired with their CSL score.
   * @returns {Array<{id: string, runtime: ColabRuntime, score: number}>}
   * @private
   */
  _getAvailableCandidates() {
    const out = [];
    for (const [id, runtime] of this.runtimes) {
      if (!runtime.circuitBreaker.allowRequest()) continue;
      if (runtime.status === 'disconnected' || runtime.status === 'error') continue;
      out.push({ id, runtime, score: runtime.computeCSLScore() });
    }
    return out;
  }
}

// ─── ColabRuntimeManager ─────────────────────────────────────────────────────

/**
 * Orchestrates three Colab Pro+ runtimes (alpha / beta / gamma) as
 * distributed latent-space compute nodes for the Heady latent OS.
 *
 * Features:
 *  - {@link registerRuntime} to connect a slot to a live Colab endpoint.
 *  - {@link dispatchTask} with CSL-scored routing and phi-backoff retries.
 *  - Automatic health checks every fib(7)×1000 = 13 000 ms.
 *  - {@link rebalance} moves orphaned tasks from broken runtimes to healthy
 *    ones on circuit-breaker trip.
 *
 * @extends EventEmitter
 *
 * @fires ColabRuntimeManager#runtime:registered  - A new slot was registered.
 * @fires ColabRuntimeManager#runtime:connected   - A slot finished connecting.
 * @fires ColabRuntimeManager#runtime:disconnected- A slot was removed.
 * @fires ColabRuntimeManager#runtime:error       - A slot encountered an error.
 * @fires ColabRuntimeManager#task:dispatched     - A task was sent to a runtime.
 * @fires ColabRuntimeManager#task:completed      - A task finished successfully.
 * @fires ColabRuntimeManager#task:failed         - A task attempt failed.
 * @fires ColabRuntimeManager#circuit:open        - A circuit breaker tripped.
 * @fires ColabRuntimeManager#circuit:closed      - A circuit breaker recovered.
 * @fires ColabRuntimeManager#rebalance           - Tasks were moved between runtimes.
 * @fires ColabRuntimeManager#health:check        - Health check completed.
 */
class ColabRuntimeManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, ColabRuntime>} */
    this.runtimes = new Map();
    /** @type {LatentSpaceRouter} */
    this.router = new LatentSpaceRouter(this.runtimes);
    /** @type {NodeJS.Timeout|null} */
    this._healthTimer = null;
    /** @type {boolean} */
    this._running = false;
    /** @type {number} Timestamp of last rebalance */
    this._lastRebalanceTs = 0;
    /** @type {number} Monotonic task sequence counter */
    this._taskSeq = 0;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Register and connect a Colab Pro+ runtime in one of the three slots.
   *
   * @param {Object}  config
   * @param {string}  config.slot  - Slot name: alpha | beta | gamma.
   * @param {string}  config.url   - Colab runtime REST endpoint URL.
   * @param {string}  config.token - Bearer token for authentication.
   * @returns {Promise<ColabRuntime>} The connected runtime instance.
   * @throws {Error} If the slot name is invalid or already occupied.
   */
  async registerRuntime({ slot, url, token }) {
    if (!RUNTIME_SLOTS[slot]) {
      throw new Error(
        `Invalid slot "${slot}". Must be one of: ${Object.keys(RUNTIME_SLOTS).join(', ')}`
      );
    }
    if (this.runtimes.has(slot)) {
      throw new Error(`Slot "${slot}" is already occupied. Call removeRuntime first.`);
    }

    const runtime = new ColabRuntime({
      id: slot,
      url,
      token,
      specialization: RUNTIME_SLOTS[slot],
    });

    this.runtimes.set(slot, runtime);
    this.emit('runtime:registered', { slot, specialization: RUNTIME_SLOTS[slot] });

    try {
      await runtime.connect();
      this.emit('runtime:connected', { slot });
    } catch (err) {
      this.runtimes.delete(slot);
      this.emit('runtime:error', { slot, error: err.message });
      throw err;
    }

    if (!this._running && this.runtimes.size > 0) {
      this._startHealthLoop();
    }

    return runtime;
  }

  /**
   * Dispatch a task to the optimal runtime using CSL-scored routing.
   *
   * Retries up to {@link MAX_RETRIES} (fib(4) = 3) times with phi-backoff:
   * delay = BASE_BACKOFF_MS × φ^attempt.
   *
   * @param {Object}  task
   * @param {string}  task.type     - Task type: embedding | inference | vector_ops.
   * @param {string}  task.code     - Python code to execute on the runtime.
   * @param {Object}  [task.opts]   - Optional execution overrides.
   * @returns {Promise<Object>} Execution result from the runtime.
   * @throws {Error} After all retries are exhausted.
   */
  async dispatchTask(task) {
    const taskId = `task_${++this._taskSeq}_${Date.now()}`;
    let lastErr = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const runtime = this.router.route(task.type);

      if (!runtime) {
        lastErr = new Error(`No available runtime for task type: ${task.type}`);
        this.emit('task:failed', { taskId, error: lastErr.message, attempt });
        await this._phiBackoff(attempt);
        continue;
      }

      /* Enqueue locally */
      const entry = { taskId, type: task.type, enqueuedAt: Date.now() };
      runtime.taskQueue.push(entry);
      runtime.metrics.queueDepth = runtime.taskQueue.length;
      this.emit('task:dispatched', { taskId, slot: runtime.id, attempt });

      try {
        const result = await runtime.execute(task.code, task.opts || {});
        this._removeFromQueue(runtime, taskId);
        this.emit('task:completed', { taskId, slot: runtime.id, result });
        return result;
      } catch (err) {
        this._removeFromQueue(runtime, taskId);
        lastErr = err;
        this.emit('task:failed', {
          taskId,
          slot: runtime.id,
          error: err.message,
          attempt,
        });

        if (runtime.circuitBreaker.state === 'open') {
          this.emit('circuit:open', { slot: runtime.id, tripCount: runtime.circuitBreaker.tripCount });
          this._maybeRebalance();
        }

        if (attempt < MAX_RETRIES - 1) {
          await this._phiBackoff(attempt);
        }
      }
    }

    throw new Error(`Task ${taskId} failed after ${MAX_RETRIES} retries: ${lastErr?.message}`);
  }

  /**
   * Run a health check on every registered runtime concurrently.
   * Updates metrics and triggers rebalance when breakers open.
   *
   * @returns {Promise<Object<string, {ok: boolean, data?: Object, error?: string}>>}
   */
  async healthCheck() {
    const results = {};
    const checks = [];

    for (const [slot, runtime] of this.runtimes) {
      checks.push(
        runtime.healthCheck()
          .then((data) => {
            results[slot] = { ok: true, data };
            if (runtime.circuitBreaker.state === 'closed') {
              this.emit('circuit:closed', { slot });
            }
          })
          .catch((err) => {
            results[slot] = { ok: false, error: err.message };
            if (runtime.circuitBreaker.state === 'open') {
              this.emit('circuit:open', { slot, tripCount: runtime.circuitBreaker.tripCount });
            }
          })
      );
    }

    await Promise.all(checks);
    this.emit('health:check', results);
    return results;
  }

  /**
   * Rebalance queued tasks away from runtimes whose circuit breakers are
   * open. Moves orphaned tasks to healthy runtimes ranked by CSL score.
   *
   * Respects a cooldown of {@link REBALANCE_COOLDOWN_MS} (fib(8)×1000 = 21 s)
   * to prevent thrashing.
   */
  rebalance() {
    const now = Date.now();
    if (now - this._lastRebalanceTs < REBALANCE_COOLDOWN_MS) return;
    this._lastRebalanceTs = now;

    const healthy = this.router.ranked().filter((c) => c.runtime.status === 'connected');
    if (healthy.length === 0) return;

    for (const [slot, runtime] of this.runtimes) {
      if (runtime.circuitBreaker.state !== 'open') continue;

      const orphaned = [...runtime.taskQueue];
      runtime.taskQueue = [];
      runtime.metrics.queueDepth = 0;

      if (orphaned.length === 0) continue;

      /* Round-robin across healthy runtimes weighted by queue capacity */
      let targetIdx = 0;
      for (const task of orphaned) {
        const target = healthy[targetIdx % healthy.length];
        target.runtime.taskQueue.push(task);
        target.runtime.metrics.queueDepth = target.runtime.taskQueue.length;
        targetIdx += 1;
      }

      this.emit('rebalance', {
        from: slot,
        tasksReassigned: orphaned.length,
        to: healthy.map((h) => h.id),
      });
    }
  }

  /**
   * Disconnect and deregister a runtime from its slot.
   * @param {string} slot - Slot to vacate.
   * @returns {Promise<void>}
   */
  async removeRuntime(slot) {
    const runtime = this.runtimes.get(slot);
    if (!runtime) return;

    try {
      await runtime.disconnect();
    } finally {
      this.runtimes.delete(slot);
      this.emit('runtime:disconnected', { slot });
      if (this.runtimes.size === 0) {
        this._stopHealthLoop();
      }
    }
  }

  /**
   * Gracefully shut down all runtimes and stop the health loop.
   * @returns {Promise<void>}
   */
  async shutdown() {
    this._stopHealthLoop();
    const slots = [...this.runtimes.keys()];
    await Promise.all(slots.map((slot) => this.removeRuntime(slot)));
  }

  /**
   * Return an aggregate status snapshot of all runtimes.
   * @returns {Object}
   */
  status() {
    const snapshot = {};
    for (const [slot, runtime] of this.runtimes) {
      snapshot[slot] = runtime.toJSON();
    }
    return {
      runtimes: snapshot,
      router: this.router.stats(),
      healthInterval: HEALTH_CHECK_INTERVAL_MS,
      running: this._running,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Remove a task entry from a runtime's local queue.
   * @param {ColabRuntime} runtime - Target runtime.
   * @param {string} taskId        - Task to remove.
   * @private
   */
  _removeFromQueue(runtime, taskId) {
    runtime.taskQueue = runtime.taskQueue.filter((t) => t.taskId !== taskId);
    runtime.metrics.queueDepth = runtime.taskQueue.length;
  }

  /**
   * Start the periodic health-check loop at fib(7)×1000 = 13 000 ms.
   * @private
   */
  _startHealthLoop() {
    if (this._running) return;
    this._running = true;
    this._healthTimer = setInterval(async () => {
      try {
        await this.healthCheck();
        this._maybeRebalance();
      } catch (_) {
        /* per-runtime errors already emitted */
      }
    }, HEALTH_CHECK_INTERVAL_MS);
    if (this._healthTimer.unref) {
      this._healthTimer.unref();
    }
  }

  /**
   * Stop the health-check loop.
   * @private
   */
  _stopHealthLoop() {
    this._running = false;
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }
  }

  /**
   * Trigger rebalance if any circuit breaker is open.
   * @private
   */
  _maybeRebalance() {
    for (const [, runtime] of this.runtimes) {
      if (runtime.circuitBreaker.state === 'open') {
        this.rebalance();
        return;
      }
    }
  }

  /**
   * Phi-scaled exponential backoff: delay = BASE_BACKOFF_MS × φ^attempt.
   * @param {number} attempt - Zero-based attempt index.
   * @returns {Promise<void>}
   * @private
   */
  _phiBackoff(attempt) {
    const delayMs = Math.round(BASE_BACKOFF_MS * Math.pow(PHI, attempt));
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  PSI,
  fib,
  CSL_WEIGHTS,
  RUNTIME_SLOTS,
  HEALTH_CHECK_INTERVAL_MS,
  CIRCUIT_BREAKER_THRESHOLD,
  MAX_RETRIES,
  BASE_BACKOFF_MS,
  REBALANCE_COOLDOWN_MS,
  CONNECTION_TIMEOUT_MS,
  TASK_TIMEOUT_MS,
  MAX_QUEUE_SIZE,
  CircuitBreaker,
  ColabRuntime,
  LatentSpaceRouter,
  ColabRuntimeManager,
};
