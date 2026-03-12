# Heady™ 17-Swarm Orchestration + 91-Bee Factory Optimization

## Foundation
All changes are based on the HeadyMe repos and Heady project data. The actual source code for every referenced file is provided below.

## Objective
Optimize the 17-swarm hierarchical topology and 91-bee worker factory for maximum throughput and deterministic task routing. Currently the swarm coordinator has CSL-gated routing but the bee factory spawns bees based on simple keyword matching. Wire bees into the swarm topology so each swarm has dedicated bee pools, and implement phi-scaled load balancing.

## Specific Deliverables — Build ALL Files

### 1. Swarm-Bee Binding
- Map each of the 17 swarms to its optimal bee types
- `swarm-bee-registry.js` — defines which bees belong to which swarm
- Dynamic bee pool sizing based on swarm load (phi-scaled: pool_size = base × φ^(load/max))

### 2. Swarm Coordinator Enhancement
- CSL gate on every inter-swarm message route
- Phi-weighted priority scheduling: priority_score = task.weight × φ^(tier_depth)
- Swarm health monitoring with heartbeat + CSL confidence on swarm state
- Auto-migrate tasks between swarms when confidence drops below φ⁻²

### 3. Bee Factory Enhancement
- CSL-gated bee spawning — only spawn if confidence > φ⁻¹
- Bee performance tracking — latency, success rate, output quality per bee type
- Adaptive bee type selection based on learned patterns
- Bee retirement when performance drops below φ⁻² threshold

### 4. Task Pipeline Integration
- Wire swarm-bee routing into the battle-sim task orchestrator
- Every task flows: Dispatcher → Swarm → Bee → Execute → Report → Audit

### 5. Test Suite
- Swarm-bee binding correctness
- Load balancing distribution
- Bee spawning CSL gate
- Inter-swarm message routing
- Full pipeline integration

## Constraints
- All constants from φ = 1.6180339887
- Node.js only
- Must integrate with existing battle-sim-task-orchestrator

---

## SOURCE FILES — COMPLETE HEADY CODEBASE CONTEXT


### `src/orchestration/swarm-coordinator.js`

```javascript
/**
 * @fileoverview SwarmCoordinator — Enhanced coordination layer for 17 autonomous
 * agent swarms in the Heady Latent OS platform.
 *
 * Architecture:
 *   - Hierarchical topology: strategic → tactical → operational layers
 *   - Sacred Geometry ring topology (HeadySoul center, inner/middle/outer rings)
 *   - CSL (Cosine Similarity Layer) gates for task routing
 *   - Fibonacci-ratio resource allocation across swarms
 *   - Swarm-to-swarm communication via internal message bus
 *   - Health monitoring, graceful degradation, and metrics collection
 *
 * Integration points:
 *   - src/bees/bee-factory.js        (BeeFactory for worker instantiation)
 *   - src/bees/registry.js           (BeeRegistry for capability lookup)
 *   - src/orchestration/heady-bees.js (HeadyBees orchestration primitives)
 *   - src/orchestration/swarm-consensus.js (SwarmConsensus for cross-swarm agreement)
 *   - src/hc_orchestrator.js         (HCOrchestrator parent integration)
 *
 * @module swarm-coordinator
 * @version 2.1.0
 *
 * PHI-MATH INTEGRATION:
 *   All thresholds, weights, timings, and queue limits are derived from the
 *   golden ratio φ = (1 + √5) / 2 ≈ 1.618 and Fibonacci sequence.
 *   See shared/phi-math.js for derivations.
 */

import { EventEmitter } from 'events';
import { createHash, randomUUID } from 'crypto';
import {
  PHI,
  PSI,
  CSL_THRESHOLDS,
  DEDUP_THRESHOLD,
  phiResourceWeights,
  phiBackoff,
  phiFusionWeights,
  cslGate,
  cslBlend,
  PRESSURE_LEVELS,
  classifyPressure,
  phiAdaptiveInterval,
  fib,
  fibSequence,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Fibonacci sequence [F(0)..F(11)] for resource-allocation ratios.
 *
 * Derived: fibSequence(11) = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
 * Previously hardcoded as [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89].
 * Now generated dynamically so the sequence is always consistent with
 * the canonical Fibonacci definition in phi-math.
 *
 * @type {number[]}
 */
const FIBONACCI = fibSequence(11);

/** Fibonacci sum for the 17-swarm pool (sum of first relevant Fibonacci ratios) */
const FIB_TOTAL = FIBONACCI.slice(0, 17).reduce((a, b) => a + b, 0);

/**
 * CSL cosine-similarity thresholds for deterministic routing.
 *
 * Derived from phi-harmonic levels (phiThreshold(n) = 1 - ψⁿ × 0.5):
 *   HIGH     = phiThreshold(3) ≈ 0.882  (was 0.85 — arbitrary)
 *   MEDIUM   = phiThreshold(2) ≈ 0.809  (was 0.72 — arbitrary)
 *   LOW      = phiThreshold(1) ≈ 0.691  (was 0.55 — arbitrary)
 *
 * The gaps between levels now follow the golden ratio: gap(LOW→MED)/gap(MED→HIGH) ≈ φ.
 */
const CSL_THRESHOLD_HIGH = CSL_THRESHOLDS.HIGH;     // ≈ 0.882  (was 0.85)
const CSL_THRESHOLD_MED  = CSL_THRESHOLDS.MEDIUM;   // ≈ 0.809  (was 0.72)
const CSL_THRESHOLD_LOW  = CSL_THRESHOLDS.LOW;      // ≈ 0.691  (was 0.55)

/**
 * Phi-derived resource weights for the 17-swarm pool.
 *
 * phiResourceWeights(17) assigns Fibonacci-normalized weights in descending
 * order so the highest-priority swarm gets F(18)/sum and the lowest gets F(2)/sum.
 * This replaces the per-swarm fibWeight() lookup with a single computed array.
 *
 * @type {number[]}
 */
const PHI_WEIGHTS_17 = phiResourceWeights(17);

/** Swarm health states */
const SWARM_STATE = Object.freeze({
  HEALTHY:   'healthy',
  DEGRADED:  'degraded',
  OVERLOADED:'overloaded',
  FAILED:    'failed',
  RECOVERING:'recovering',
});

/** Orchestration layer identifiers (hierarchical topology) */
const LAYER = Object.freeze({
  STRATEGIC:   'strategic',   // HeadySoul center + governance
  TACTICAL:    'tactical',    // Inner ring coordinators
  OPERATIONAL: 'operational', // Middle + outer ring workers
});

/** Ring assignments aligned with Sacred Geometry topology */
const RING = Object.freeze({
  CENTER: 'center',
  INNER:  'inner',
  MIDDLE: 'middle',
  OUTER:  'outer',
  GOVERNANCE: 'governance',
});

/** Default metrics snapshot interval (ms) */
const METRICS_INTERVAL_MS = 5_000;

/**
 * Base health check interval (ms).
 *
 * Actual per-swarm intervals adapt via phiAdaptiveInterval():
 *   - Healthy swarm:   current × φ  (checks less often, up to 60 s)
 *   - Unhealthy swarm: current × ψ  (checks more often, down to 1 s)
 */
const HEALTH_CHECK_INTERVAL_MS = 15_000;

/**
 * Max queue depth before triggering backpressure.
 *
 * fib(13) = 233 (a Fibonacci-sized queue — was arbitrary 500).
 * For swarms requiring more capacity, override per-swarm via opts.
 *
 * @type {number}
 */
const MAX_QUEUE_DEPTH = fib(13); // 233  (was 500)

/** Minimum healthy swarms required for operation */
const MIN_HEALTHY_SWARMS = 5;

// ─── Swarm Definitions ────────────────────────────────────────────────────────

/**
 * Canonical 17-swarm definitions with ring placement, layer, and base config.
 * Fibonacci index determines resource weight (higher index = more resources).
 */
const SWARM_DEFINITIONS = [
  // CENTER — HeadySoul (strategic, highest Fibonacci weight)
  { id: 'heady-soul',        ring: RING.CENTER,     layer: LAYER.STRATEGIC,   fibIdx: 10, domain: 'orchestration',  cslThreshold: CSL_THRESHOLD_HIGH },

  // INNER — Tactical coordinators (5 swarms)
  { id: 'cognition-core',    ring: RING.INNER,      layer: LAYER.TACTICAL,    fibIdx: 9,  domain: 'reasoning',      cslThreshold: CSL_THRESHOLD_HIGH },
  { id: 'memory-weave',      ring: RING.INNER,      layer: LAYER.TACTICAL,    fibIdx: 8,  domain: 'memory',         cslThreshold: CSL_THRESHOLD_HIGH },
  { id: 'context-bridge',    ring: RING.INNER,      layer: LAYER.TACTICAL,    fibIdx: 8,  domain: 'context',        cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'task-planner',      ring: RING.INNER,      layer: LAYER.TACTICAL,    fibIdx: 7,  domain: 'planning',       cslThreshold: CSL_THRESHOLD_HIGH },
  { id: 'consensus-forge',   ring: RING.INNER,      layer: LAYER.TACTICAL,    fibIdx: 7,  domain: 'consensus',      cslThreshold: CSL_THRESHOLD_MED  },

  // MIDDLE — Operational specialists (7 swarms)
  { id: 'code-artisan',      ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 6,  domain: 'coding',         cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'data-sculptor',     ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 6,  domain: 'data',           cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'research-herald',   ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 5,  domain: 'research',       cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'tool-weaver',       ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 5,  domain: 'tools',          cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'language-flow',     ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 5,  domain: 'language',       cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'vision-scribe',     ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 4,  domain: 'vision',         cslThreshold: CSL_THRESHOLD_LOW  },
  { id: 'audio-pulse',       ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 4,  domain: 'audio',          cslThreshold: CSL_THRESHOLD_LOW  },

  // OUTER — Edge workers (3 swarms)
  { id: 'integration-node',  ring: RING.OUTER,      layer: LAYER.OPERATIONAL, fibIdx: 3,  domain: 'integration',    cslThreshold: CSL_THRESHOLD_LOW  },
  { id: 'cache-guardian',    ring: RING.OUTER,      layer: LAYER.OPERATIONAL, fibIdx: 3,  domain: 'caching',        cslThreshold: CSL_THRESHOLD_LOW  },
  { id: 'stream-runner',     ring: RING.OUTER,      layer: LAYER.OPERATIONAL, fibIdx: 2,  domain: 'streaming',      cslThreshold: CSL_THRESHOLD_LOW  },

  // GOVERNANCE — Policy + compliance (1 swarm)
  { id: 'policy-sentinel',   ring: RING.GOVERNANCE, layer: LAYER.STRATEGIC,   fibIdx: 6,  domain: 'governance',     cslThreshold: CSL_THRESHOLD_HIGH },
];

// ─── Helper Utilities ─────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two numeric vectors.
 * @param {number[]} a - Vector A
 * @param {number[]} b - Vector B
 * @returns {number} Cosine similarity in [-1, 1]
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Return the Fibonacci-ratio resource weight for a given swarm by its
 * rank in the 17-swarm pool (0 = heady-soul, highest weight).
 *
 * Uses pre-computed PHI_WEIGHTS_17 derived from phiResourceWeights(17)
 * rather than re-normalising per lookup.
 *
 * @param {number} fibIdx  - Fibonacci sequence index (0-based, per SWARM_DEFINITIONS)
 * @returns {number} Normalised weight in (0, 1]
 */
function fibWeight(fibIdx) {
  return FIBONACCI[Math.min(fibIdx, FIBONACCI.length - 1)] / FIB_TOTAL;
}

/**
 * Golden-ratio exponential backoff with phi-derived jitter.
 *
 * Base formula: delay = baseMs × 2^attempt  (standard doubling)
 * Phi jitter:   ±(base × ψ²) ≈ ±38.2% of base  (was ±30% — arbitrary)
 *
 * ψ² ≈ 0.382 is the phi-harmonic complement of ψ (≈ 0.618).
 * Together ψ + ψ² = 1, so the jitter band is precisely [0.618×base, base].
 *
 * @param {number} attempt - Attempt number (0-based)
 * @param {number} baseMs  - Base delay in ms
 * @returns {number} Delay in ms
 */
function backoffDelay(attempt, baseMs = 100) {
  const exp  = Math.min(attempt, 10);
  const base = baseMs * Math.pow(2, exp);
  // ψ² ≈ 0.382 — phi-derived jitter coefficient (was arbitrary 0.3)
  const jitter = Math.random() * base * Math.pow(PSI, 2);
  return Math.min(base + jitter, 30_000);
}

// ─── SwarmInstance ─────────────────────────────────────────────────────────────

/**
 * Represents a single running swarm instance with its state, metrics, and queue.
 */
class SwarmInstance {
  /**
   * @param {object} def - Swarm definition from SWARM_DEFINITIONS
   */
  constructor(def) {
    this.id           = def.id;
    this.ring         = def.ring;
    this.layer        = def.layer;
    this.domain       = def.domain;
    this.cslThreshold = def.cslThreshold;
    this.fibIdx       = def.fibIdx;
    this.weight       = fibWeight(def.fibIdx);

    /** @type {string} Current swarm health state */
    this.state = SWARM_STATE.HEALTHY;

    /** @type {Map<string, object>} Active tasks keyed by taskId */
    this.activeTasks = new Map();

    /** @type {Array<object>} Pending task queue */
    this.queue = [];

    /** @type {number[]} Optional domain embedding for CSL routing */
    this.embedding = null;

    /**
     * Current health-check interval in ms.
     * Adapts via phiAdaptiveInterval(): grows by φ when healthy,
     * shrinks by ψ when unhealthy, bounded in [1 s, 60 s].
     *
     * @type {number}
     */
    this._healthCheckInterval = HEALTH_CHECK_INTERVAL_MS;

    /** Metrics accumulator */
    this.metrics = {
      tasksCompleted: 0,
      tasksFailed:    0,
      tasksRejected:  0,
      totalLatencyMs: 0,
      lastHealthAt:   Date.now(),
      consecutiveFails: 0,
      windowRequests:  0,
      windowAccepts:   0,
      windowStart:     Date.now(),
    };

    /**
     * Circuit-breaker state.
     *
     * FAILURE_THRESHOLD = fib(5) = 5  (same numeric value as before, but now
     *   Fibonacci-derived — the threshold is the 5th Fibonacci number).
     * RECOVERY_TIMEOUT_MS = Math.round(phiBackoff(5)) ≈ 11_090 ms base, but
     *   we keep 45_000 ms for recovery as it's an operational SLA requirement;
     *   the phi backoff is used in the swarm-level backoff helper instead.
     */
    this.circuitBreaker = {
      state:          'closed', // closed | open | half-open
      failCount:      0,
      lastOpenedAt:   null,
      halfOpenProbes: 0,
      /** fib(5) = 5 — Fibonacci-derived failure threshold (was hardcoded 5) */
      FAILURE_THRESHOLD:   fib(5),        // = 5
      RECOVERY_TIMEOUT_MS: 45_000,
      HALF_OPEN_MAX_PROBES: 3,
    };
  }

  /** @returns {boolean} Whether this swarm can accept new tasks */
  get canAccept() {
    if (this.circuitBreaker.state === 'open') {
      const elapsed = Date.now() - this.circuitBreaker.lastOpenedAt;
      if (elapsed >= this.circuitBreaker.RECOVERY_TIMEOUT_MS) {
        this.circuitBreaker.state = 'half-open';
        this.circuitBreaker.halfOpenProbes = 0;
      } else {
        return false;
      }
    }
    return (
      this.state !== SWARM_STATE.FAILED &&
      this.queue.length < MAX_QUEUE_DEPTH
    );
  }

  /** @returns {number} Queue utilization ratio [0, 1] */
  get queuePressure() {
    return this.queue.length / MAX_QUEUE_DEPTH;
  }

  /** @returns {number} Tasks-per-second over the last sample window */
  get throughput() {
    const elapsed = (Date.now() - this.metrics.windowStart) / 1000;
    return elapsed > 0 ? this.metrics.tasksCompleted / elapsed : 0;
  }

  /**
   * Advance the adaptive health-check interval based on current health.
   *
   * Uses phiAdaptiveInterval() from phi-math:
   *   healthy   → interval × φ  (check less often, up to 60 s)
   *   unhealthy → interval × ψ  (check more often, down to 1 s)
   *
   * @param {boolean} healthy - Whether the swarm is currently healthy
   * @returns {number} Updated interval in ms
   */
  advanceHealthInterval(healthy) {
    this._healthCheckInterval = phiAdaptiveInterval(
      this._healthCheckInterval,
      healthy,
      1_000,   // minMs: at most once per second when degraded
      60_000,  // maxMs: at most once per minute when healthy
    );
    return this._healthCheckInterval;
  }

  /**
   * Record a task completion and update metrics.
   * @param {number} latencyMs - Task execution duration
   * @param {boolean} success  - Whether the task succeeded
   */
  recordCompletion(latencyMs, success) {
    if (success) {
      this.metrics.tasksCompleted++;
      this.metrics.totalLatencyMs += latencyMs;
      this.metrics.consecutiveFails = 0;
      // Circuit-breaker: successful probe in half-open → close
      if (this.circuitBreaker.state === 'half-open') {
        this.circuitBreaker.halfOpenProbes++;
        if (this.circuitBreaker.halfOpenProbes >= this.circuitBreaker.HALF_OPEN_MAX_PROBES) {
          this.circuitBreaker.state    = 'closed';
          this.circuitBreaker.failCount = 0;
        }
      }
    } else {
      this.metrics.tasksFailed++;
      this.metrics.consecutiveFails++;
      this.circuitBreaker.failCount++;
      if (this.circuitBreaker.failCount >= this.circuitBreaker.FAILURE_THRESHOLD) {
        this.circuitBreaker.state      = 'open';
        this.circuitBreaker.lastOpenedAt = Date.now();
      }
    }
    this._updateState();
  }

  /** Derive health state from current metrics */
  _updateState() {
    const { consecutiveFails } = this.metrics;
    const healthy = this.circuitBreaker.state === 'closed' && consecutiveFails === 0;

    if (this.circuitBreaker.state === 'open') {
      this.state = SWARM_STATE.FAILED;
    } else if (consecutiveFails >= 3) {
      this.state = SWARM_STATE.DEGRADED;
    } else if (this.queuePressure > PRESSURE_LEVELS.ELEVATED_MAX) {
      /**
       * Overload detection threshold = PRESSURE_LEVELS.ELEVATED_MAX ≈ 0.618 (ψ).
       *
       * Previously: queuePressure > 0.8 (arbitrary).
       * Now: start overload detection at the phi-harmonic ELEVATED→HIGH boundary (ψ ≈ 0.618).
       * This detects queue buildup earlier — at the golden ratio of capacity —
       * allowing gradual backpressure before hitting hard limits.
       */
      this.state = SWARM_STATE.OVERLOADED;
    } else if (this.circuitBreaker.state === 'half-open') {
      this.state = SWARM_STATE.RECOVERING;
    } else {
      this.state = SWARM_STATE.HEALTHY;
    }

    // Advance the health-check interval based on new state
    this.advanceHealthInterval(this.state === SWARM_STATE.HEALTHY);
  }

  /**
   * Export a metrics snapshot for observability.
   * @returns {object}
   */
  getMetricsSnapshot() {
    const avgLatency = this.metrics.tasksCompleted > 0
      ? Math.round(this.metrics.totalLatencyMs / this.metrics.tasksCompleted)
      : 0;
    return {
      swarmId:       this.id,
      ring:          this.ring,
      layer:         this.layer,
      domain:        this.domain,
      state:         this.state,
      circuitState:  this.circuitBreaker.state,
      queueDepth:    this.queue.length,
      queuePressure: Math.round(this.queuePressure * 100) / 100,
      activeTasks:   this.activeTasks.size,
      tasksCompleted:this.metrics.tasksCompleted,
      tasksFailed:   this.metrics.tasksFailed,
      tasksRejected: this.metrics.tasksRejected,
      avgLatencyMs:  avgLatency,
      throughputTps: Math.round(this.throughput * 100) / 100,
      weight:        Math.round(this.weight * 1000) / 1000,
      healthCheckIntervalMs: this._healthCheckInterval,
      timestamp:     new Date().toISOString(),
    };
  }
}

// ─── MessageBus ───────────────────────────────────────────────────────────────

/**
 * Lightweight in-process message bus for swarm-to-swarm communication.
 * Supports topic-based pub/sub with priority queuing.
 */
class SwarmMessageBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    /** @type {Map<string, Array<object>>} Pending messages per topic */
    this._queues = new Map();
    /** @type {Map<string, Set<Function>>} Subscribers per topic */
    this._subscribers = new Map();
  }

  /**
   * Publish a message to a topic.
   * @param {string} topic   - Target topic (e.g. 'swarm:coding', 'broadcast')
   * @param {object} message - Message payload
   * @param {object} [opts]  - Options: { priority?: number, ttlMs?: number }
   */
  publish(topic, message, opts = {}) {
    const envelope = {
      id:        randomUUID(),
      topic,
      message,
      priority:  opts.priority ?? 5,
      publishedAt: Date.now(),
      expiresAt: opts.ttlMs ? Date.now() + opts.ttlMs : null,
    };

    // Deliver immediately to subscribers
    const subs = this._subscribers.get(topic) ?? new Set();
    const globalSubs = this._subscribers.get('*') ?? new Set();
    const allSubs = new Set([...subs, ...globalSubs]);

    if (allSubs.size > 0) {
      for (const handler of allSubs) {
        try { handler(envelope); } catch (err) { /* isolate subscriber errors */ }
      }
    } else {
      // Queue for late subscribers
      if (!this._queues.has(topic)) this._queues.set(topic, []);
      this._queues.get(topic).push(envelope);
    }

    this.emit('published', { topic, messageId: envelope.id });
    return envelope.id;
  }

  /**
   * Subscribe to a topic.
   * @param {string}   topic   - Topic name, or '*' for all
   * @param {Function} handler - Callback(envelope)
   * @returns {Function} Unsubscribe function
   */
  subscribe(topic, handler) {
    if (!this._subscribers.has(topic)) this._subscribers.set(topic, new Set());
    this._subscribers.get(topic).add(handler);

    // Drain any queued messages
    const queued = this._queues.get(topic) ?? [];
    for (const env of queued) {
      if (!env.expiresAt || Date.now() < env.expiresAt) {
        try { handler(env); } catch (_) {}
      }
    }
    this._queues.delete(topic);

    return () => this._subscribers.get(topic)?.delete(handler);
  }

  /**
   * Send a direct message from one swarm to another.
   * @param {string} fromId  - Sender swarm ID
   * @param {string} toId    - Receiver swarm ID
   * @param {object} payload - Message payload
   */
  sendDirect(fromId, toId, payload) {
    return this.publish(`direct:${toId}`, { ...payload, from: fromId });
  }

  /**
   * Broadcast a backpressure signal to all upstream swarms.
   * @param {string} swarmId    - Overloaded swarm emitting the signal
   * @param {number} pressure   - Pressure level [0, 1]
   */
  broadcastBackpressure(swarmId, pressure) {
    return this.publish('backpressure', { swarmId, pressure, ts: Date.now() }, { priority: 10 });
  }
}

// ─── SwarmCoordinator ─────────────────────────────────────────────────────────

/**
 * @class SwarmCoordinator
 * @extends EventEmitter
 *
 * Central coordination layer for the 17-swarm Heady Latent OS platform.
 *
 * Responsibilities:
 *  - Instantiate and track all 17 swarm instances
 *  - Route tasks using CSL cosine similarity gates with LLM fallback
 *  - Load-balance using Fibonacci-ratio resource weights
 *  - Monitor health and trigger graceful degradation
 *  - Propagate backpressure signals through the message bus
 *  - Collect and expose per-swarm metrics
 *
 * @fires SwarmCoordinator#task:routed       When a task is assigned to a swarm
 * @fires SwarmCoordinator#task:completed    When a swarm task finishes
 * @fires SwarmCoordinator#task:failed       When a swarm task errors
 * @fires SwarmCoordinator#swarm:degraded    When a swarm enters degraded state
 * @fires SwarmCoordinator#swarm:recovered   When a swarm returns to healthy
 * @fires SwarmCoordinator#metrics:snapshot  Periodic metrics snapshot
 * @fires SwarmCoordinator#backpressure      When queue pressure is high
 */
class SwarmCoordinator extends EventEmitter {
  /**
   * @param {object} [opts]                   - Configuration options
   * @param {object} [opts.beeFactory]         - BeeFactory instance for worker creation
   * @param {object} [opts.beeRegistry]        - BeeRegistry for capability lookup
   * @param {object} [opts.headyBees]          - HeadyBees orchestration primitive
   * @param {object} [opts.swarmConsensus]     - SwarmConsensus instance
   * @param {number} [opts.cslThreshold]       - Global CSL gate threshold override
   * @param {number} [opts.metricsIntervalMs]  - Metrics collection interval
   * @param {number} [opts.healthCheckMs]      - Health check interval
   * @param {Function} [opts.embedFn]          - Async fn(text) → number[] for CSL routing
   * @param {Function} [opts.llmClassifyFn]    - Async fn(task) → swarmId for LLM fallback routing
   */
  constructor(opts = {}) {
    super();
    this.setMaxListeners(200);

    this._beeFactory      = opts.beeFactory      ?? null;
    this._beeRegistry     = opts.beeRegistry     ?? null;
    this._headyBees       = opts.headyBees       ?? null;
    this._swarmConsensus  = opts.swarmConsensus  ?? null;
    this._cslThreshold    = opts.cslThreshold    ?? CSL_THRESHOLD_MED;
    this._metricsInterval = opts.metricsIntervalMs ?? METRICS_INTERVAL_MS;
    this._healthCheckMs   = opts.healthCheckMs   ?? HEALTH_CHECK_INTERVAL_MS;
    this._embedFn         = opts.embedFn         ?? null;
    this._llmClassifyFn   = opts.llmClassifyFn   ?? null;

    /** @type {Map<string, SwarmInstance>} All swarms keyed by ID */
    this._swarms = new Map();

    /** @type {SwarmMessageBus} Internal message bus */
    this._bus = new SwarmMessageBus();

    /** @type {Map<string, Function>} Task completion callbacks */
    this._taskCallbacks = new Map();

    /** Global coordinator metrics */
    this._globalMetrics = {
      totalTasksRouted:   0,
      totalTasksCompleted:0,
      totalTasksFailed:   0,
      routingDecisions:   { deterministic: 0, csl: 0, llm: 0, loadBalance: 0 },
      startedAt: new Date().toISOString(),
    };

    /** @type {NodeJS.Timer|null} */
    this._metricsTimer    = null;
    this._healthTimer     = null;
    this._initialized     = false;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialize the coordinator: instantiate all 17 swarms, register bus handlers,
   * start monitoring timers, and optionally build domain embeddings for CSL routing.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;

    // Build swarm instances
    for (const def of SWARM_DEFINITIONS) {
      const instance = new SwarmInstance(def);
      this._swarms.set(def.id, instance);
    }

    // Wire up message bus subscriptions
    this._bus.subscribe('backpressure', (env) => this._handleBackpressureSignal(env));
    this._bus.subscribe('*', (env) => {
      if (env.topic.startsWith('direct:')) {
        const targetId = env.topic.replace('direct:', '');
        this.emit('message:received', { targetId, envelope: env });
      }
    });

    // Build domain embeddings for CSL routing (if embedFn available)
    if (this._embedFn) {
      await this._buildDomainEmbeddings();
    }

    // Start health monitoring
    this._healthTimer = setInterval(
      () => this._runHealthChecks(),
      this._healthCheckMs
    );

    // Start metrics collection
    this._metricsTimer = setInterval(
      () => this._emitMetricsSnapshot(),
      this._metricsInterval
    );

    this._initialized = true;
    this.emit('coordinator:ready', {
      swarmCount: this._swarms.size,
      timestamp:  new Date().toISOString(),
    });
  }

  /**
   * Graceful shutdown: drain queues, stop timers, close resources.
   * @returns {Promise<void>}
   */
  async shutdown() {
    clearInterval(this._healthTimer);
    clearInterval(this._metricsTimer);

    // Wait for active tasks to complete (max 30s)
    const deadline = Date.now() + 30_000;
    while (this._activeTotalCount() > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500));
    }

    this._initialized = false;
    this.emit('coordinator:shutdown', { timestamp: new Date().toISOString() });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Route and execute a task to the best-matching swarm.
   *
   * Routing priority:
   *   1. Deterministic: explicit swarmId on task
   *   2. CSL cosine similarity gate (if embedFn available)
   *   3. Domain string matching
   *   4. LLM classifier fallback (if llmClassifyFn available)
   *   5. Fibonacci-weighted load balancing (final fallback)
   *
   * @param {object} task           - Task descriptor
   * @param {string} task.id        - Unique task ID (auto-generated if absent)
   * @param {string} [task.swarmId] - Explicit target swarm (bypasses routing)
   * @param {string} [task.domain]  - Domain hint for routing ('coding', 'research', …)
   * @param {string} [task.description] - Task description for CSL embedding
   * @param {number} [task.priority]    - Priority [1-10], default 5
   * @param {number[]} [task.embedding] - Pre-computed embedding (skips embedFn call)
   * @param {object} [task.payload]     - Task-specific data
   * @param {Function} [executor]   - Async fn(task, swarm) → result (optional override)
   * @returns {Promise<object>} Task result with routing metadata
   */
  async routeTask(task, executor = null) {
    if (!this._initialized) await this.initialize();

    const taskId = task.id ?? randomUUID();
    const enriched = { ...task, id: taskId, priority: task.priority ?? 5 };

    // Step 1: Resolve target swarm
    const { swarmId, strategy } = await this._resolveTargetSwarm(enriched);
    const swarm = this._swarms.get(swarmId);

    if (!swarm || !swarm.canAccept) {
      const fallback = this._pickFallback(swarmId);
      if (!fallback) {
        throw new Error(`[SwarmCoordinator] No healthy swarms available for task ${taskId}`);
      }
      return this.routeTask(enriched, executor); // re-route with fallback
    }

    this._globalMetrics.totalTasksRouted++;
    this._globalMetrics.routingDecisions[strategy]++;

    // Step 2: Enqueue or execute immediately
    return this._executeOnSwarm(swarm, enriched, executor, strategy);
  }

  /**
   * Get the current health status of all swarms.
   * @returns {object[]} Array of health descriptors
   */
  getSwarmHealth() {
    return [...this._swarms.values()].map(s => ({
      id:           s.id,
      ring:         s.ring,
      layer:        s.layer,
      domain:       s.domain,
      state:        s.state,
      circuitState: s.circuitBreaker.state,
      queueDepth:   s.queue.length,
      activeTasks:  s.activeTasks.size,
    }));
  }

  /**
   * Get a specific swarm instance by ID.
   * @param {string} swarmId
   * @returns {SwarmInstance|undefined}
   */
  getSwarm(swarmId) {
    return this._swarms.get(swarmId);
  }

  /**
   * Get all metrics snapshots for all swarms.
   * @returns {object[]}
   */
  getAllMetrics() {
    return [...this._swarms.values()].map(s => s.getMetricsSnapshot());
  }

  /**
   * Get global coordinator metrics.
   * @returns {object}
   */
  getGlobalMetrics() {
    return {
      ...this._globalMetrics,
      swarmCount:     this._swarms.size,
      healthySwarms:  this._countByState(SWARM_STATE.HEALTHY),
      degradedSwarms: this._countByState(SWARM_STATE.DEGRADED),
      failedSwarms:   this._countByState(SWARM_STATE.FAILED),
      totalActiveTasks: this._activeTotalCount(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Send a direct message from one swarm to another via the message bus.
   * @param {string} fromId  - Sender swarm ID
   * @param {string} toId    - Target swarm ID
   * @param {object} payload - Message payload
   * @returns {string} Message envelope ID
   */
  sendSwarmMessage(fromId, toId, payload) {
    return this._bus.sendDirect(fromId, toId, payload);
  }

  /**
   * Broadcast a system-wide signal to all swarms.
   * @param {string} type    - Signal type (e.g. 'shutdown', 'flush', 'recalibrate')
   * @param {object} payload - Signal payload
   */
  broadcastSignal(type, payload) {
    return this._bus.publish('broadcast', { type, ...payload });
  }

  /**
   * Register domain embeddings manually (e.g. loaded from a vector store).
   * @param {string}   swarmId   - Target swarm ID
   * @param {number[]} embedding - Pre-computed embedding vector
   */
  setSwarmEmbedding(swarmId, embedding) {
    const swarm = this._swarms.get(swarmId);
    if (!swarm) throw new Error(`Unknown swarm: ${swarmId}`);
    swarm.embedding = embedding;
  }

  // ─── Routing Logic ─────────────────────────────────────────────────────────

  /**
   * Determine which swarm should handle a given task.
   * @private
   * @param {object} task
   * @returns {Promise<{swarmId: string, strategy: string, score: number}>}
   */
  async _resolveTargetSwarm(task) {
    // 1. Explicit swarm ID
    if (task.swarmId && this._swarms.has(task.swarmId)) {
      return { swarmId: task.swarmId, strategy: 'deterministic', score: 1.0 };
    }

    // 2. CSL cosine similarity routing
    if (this._embedFn || task.embedding) {
      const cslResult = await this._cslRoute(task);
      if (cslResult) return cslResult;
    }

    // 3. Domain string matching
    if (task.domain) {
      const domainMatch = this._domainRoute(task.domain);
      if (domainMatch) return { swarmId: domainMatch, strategy: 'deterministic', score: 0.9 };
    }

    // 4. LLM classification fallback
    if (this._llmClassifyFn) {
      try {
        const swarmId = await this._llmClassifyFn(task);
        if (swarmId && this._swarms.has(swarmId)) {
          return { swarmId, strategy: 'llm', score: 0.8 };
        }
      } catch (err) {
        this.emit('routing:llm-error', { error: err.message, taskId: task.id });
      }
    }

    // 5. Fibonacci-weighted load balancing
    const swarmId = this._fibLoadBalance(task);
    return { swarmId, strategy: 'loadBalance', score: 0 };
  }

  /**
   * CSL-gated cosine similarity routing.
   * @private
   * @param {object} task
   * @returns {Promise<{swarmId: string, strategy: string, score: number}|null>}
   */
  async _cslRoute(task) {
    let queryEmbedding = task.embedding;

    if (!queryEmbedding && this._embedFn && task.description) {
      try {
        queryEmbedding = await this._embedFn(task.description);
      } catch (err) {
        this.emit('routing:embed-error', { error: err.message, taskId: task.id });
        return null;
      }
    }

    if (!queryEmbedding) return null;

    let bestScore = -Infinity;
    let bestSwarm = null;

    for (const swarm of this._swarms.values()) {
      if (!swarm.canAccept || !swarm.embedding) continue;
      const score = cosineSimilarity(queryEmbedding, swarm.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestSwarm = swarm;
      }
    }

    if (bestSwarm && bestScore >= (bestSwarm.cslThreshold ?? this._cslThreshold)) {
      return { swarmId: bestSwarm.id, strategy: 'csl', score: bestScore };
    }

    return null;
  }

  /**
   * Route by domain string matching.
   * @private
   * @param {string} domain
   * @returns {string|null} Matching swarm ID
   */
  _domainRoute(domain) {
    const normalized = domain.toLowerCase().trim();
    for (const swarm of this._swarms.values()) {
      if (swarm.domain === normalized && swarm.canAccept) return swarm.id;
    }
    // Fuzzy match: check if domain contains swarm's domain keyword
    for (const swarm of this._swarms.values()) {
      if (swarm.canAccept && (normalized.includes(swarm.domain) || swarm.domain.includes(normalized))) {
        return swarm.id;
      }
    }
    return null;
  }

  /**
   * Fibonacci-weighted load balancing across healthy swarms.
   * Higher fibonacci index = higher probability of selection.
   * @private
   * @param {object} task - Used for deterministic hash-based selection
   * @returns {string} Selected swarm ID
   */
  _fibLoadBalance(task) {
    const healthySwarms = [...this._swarms.values()].filter(s => s.canAccept);
    if (healthySwarms.length === 0) {
      throw new Error('[SwarmCoordinator] No healthy swarms available');
    }

    // Build weighted selection table
    const totalWeight = healthySwarms.reduce((sum, s) => sum + s.weight, 0);

    // Deterministic selection based on task hash for consistency
    const hash = createHash('sha256').update(task.id).digest('hex');
    const hashVal = parseInt(hash.slice(0, 8), 16) / 0xFFFFFFFF;
    const targetWeight = hashVal * totalWeight;

    let cumulative = 0;
    for (const swarm of healthySwarms) {
      cumulative += swarm.weight;
      if (hashVal <= cumulative / totalWeight) return swarm.id;
    }

    return healthySwarms[healthySwarms.length - 1].id;
  }

  // ─── Execution ─────────────────────────────────────────────────────────────

  /**
   * Execute a task on a given swarm instance.
   * @private
   */
  async _executeOnSwarm(swarm, task, executor, strategy) {
    const startMs = Date.now();
    swarm.activeTasks.set(task.id, { task, startMs, strategy });

    /**
     * @event SwarmCoordinator#task:routed
     * @type {object}
     * @property {string} taskId
     * @property {string} swarmId
     * @property {string} strategy - Routing strategy used
     */
    this.emit('task:routed', {
      taskId:   task.id,
      swarmId:  swarm.id,
      strategy,
      ring:     swarm.ring,
      layer:    swarm.layer,
      domain:   swarm.domain,
    });

    try {
      let result;

      if (executor) {
        result = await executor(task, swarm);
      } else if (this._headyBees) {
        // Delegate to HeadyBees orchestration primitive
        result = await this._headyBees.dispatch(swarm.id, task);
      } else {
        // Simulation: resolve immediately (replace with real execution in production)
        result = await this._simulateExecution(task);
      }

      const latencyMs = Date.now() - startMs;
      swarm.activeTasks.delete(task.id);
      swarm.recordCompletion(latencyMs, true);
      this._globalMetrics.totalTasksCompleted++;

      /**
       * @event SwarmCoordinator#task:completed
       */
      this.emit('task:completed', {
        taskId:    task.id,
        swarmId:   swarm.id,
        latencyMs,
        result,
      });

      // Check if queue pressure has dropped below nominal
      if (swarm.queuePressure < PSI * PSI && swarm.state === SWARM_STATE.OVERLOADED) {
        // Recovery threshold = ψ² ≈ 0.382 (NOMINAL_MAX) — phi-harmonic lower bound
        swarm.state = SWARM_STATE.HEALTHY;
        this.emit('swarm:recovered', { swarmId: swarm.id });
      }

      return { taskId: task.id, swarmId: swarm.id, strategy, latencyMs, result };

    } catch (err) {
      const latencyMs = Date.now() - startMs;
      swarm.activeTasks.delete(task.id);
      swarm.recordCompletion(latencyMs, false);
      this._globalMetrics.totalTasksFailed++;

      if (swarm.state === SWARM_STATE.FAILED) {
        /**
         * @event SwarmCoordinator#swarm:degraded
         */
        this.emit('swarm:degraded', {
          swarmId:     swarm.id,
          circuitState: swarm.circuitBreaker.state,
          error:       err.message,
        });
      }

      /**
       * @event SwarmCoordinator#task:failed
       */
      this.emit('task:failed', {
        taskId:   task.id,
        swarmId:  swarm.id,
        error:    err.message,
        latencyMs,
      });

      // Graceful degradation: retry on a fallback swarm
      const fallback = this._pickFallback(swarm.id);
      if (fallback && task._retryCount < 2) {
        const retryTask = { ...task, _retryCount: (task._retryCount ?? 0) + 1, swarmId: fallback };
        return this.routeTask(retryTask, executor);
      }

      throw err;
    }
  }

  /**
   * Simulation placeholder for task execution (development / testing).
   * Replace with real BeeFactory dispatch in production.
   * @private
   */
  async _simulateExecution(task) {
    const delayMs = 50 + Math.random() * 200;
    await new Promise(r => setTimeout(r, delayMs));
    return { simulated: true, taskId: task.id, delayMs };
  }

  // ─── Degradation & Failover ────────────────────────────────────────────────

  /**
   * Pick a fallback swarm when the primary is unavailable.
   * Prefers same ring/layer, then falls back to any healthy swarm.
   * @private
   * @param {string} failedSwarmId
   * @returns {string|null}
   */
  _pickFallback(failedSwarmId) {
    const failed = this._swarms.get(failedSwarmId);
    if (!failed) return null;

    // Same ring preference
    const sameRing = [...this._swarms.values()]
      .filter(s => s.id !== failedSwarmId && s.ring === failed.ring && s.canAccept)
      .sort((a, b) => b.weight - a.weight);

    if (sameRing.length > 0) return sameRing[0].id;

    // Any healthy swarm
    const anyHealthy = [...this._swarms.values()]
      .filter(s => s.id !== failedSwarmId && s.canAccept)
      .sort((a, b) => b.weight - a.weight);

    return anyHealthy.length > 0 ? anyHealthy[0].id : null;
  }

  // ─── Health Monitoring ─────────────────────────────────────────────────────

  /**
   * Run health checks across all swarms.
   * Each swarm's check interval adapts via phiAdaptiveInterval():
   *   healthy   → interval × φ (less frequent checks, saves resources)
   *   unhealthy → interval × ψ (more frequent checks, faster recovery)
   * @private
   */
  _runHealthChecks() {
    const now = Date.now();
    let healthyCount = 0;

    for (const swarm of this._swarms.values()) {
      swarm.metrics.lastHealthAt = now;
      swarm._updateState();

      if (swarm.state === SWARM_STATE.HEALTHY) healthyCount++;

      // Propagate backpressure if queue pressure exceeds ELEVATED_MAX (ψ ≈ 0.618)
      // Previously: queuePressure > 0.7 (arbitrary mid-level)
      // Now: PRESSURE_LEVELS.ELEVATED_MAX ≈ 0.618 (phi-harmonic ELEVATED→HIGH boundary)
      if (swarm.queuePressure > PRESSURE_LEVELS.ELEVATED_MAX) {
        this._bus.broadcastBackpressure(swarm.id, swarm.queuePressure);
        /**
         * @event SwarmCoordinator#backpressure
         */
        this.emit('backpressure', {
          swarmId:  swarm.id,
          pressure: swarm.queuePressure,
          state:    swarm.state,
          level:    classifyPressure(swarm.queuePressure),
        });
      }
    }

    if (healthyCount < MIN_HEALTHY_SWARMS) {
      this.emit('coordinator:critical', {
        message:      `Only ${healthyCount} healthy swarms (minimum: ${MIN_HEALTHY_SWARMS})`,
        healthyCount,
        timestamp:    new Date().toISOString(),
      });
    }
  }

  /**
   * Handle incoming backpressure signals from swarms.
   * @private
   */
  _handleBackpressureSignal(envelope) {
    const { swarmId, pressure } = envelope.message;
    const swarm = this._swarms.get(swarmId);
    if (!swarm) return;

    // Use phi-harmonic pressure classification instead of arbitrary 0.9 / 0.7
    const level = classifyPressure(pressure);
    if (level === 'critical') {
      swarm.state = SWARM_STATE.OVERLOADED;
    } else if (level === 'high') {
      swarm.state = SWARM_STATE.DEGRADED;
    }

    this.emit('backpressure:received', { swarmId, pressure, level });
  }

  // ─── Embeddings ────────────────────────────────────────────────────────────

  /**
   * Build domain embeddings for all swarms using the configured embed function.
   * @private
   */
  async _buildDomainEmbeddings() {
    const promises = [...this._swarms.values()].map(async (swarm) => {
      try {
        const description = `${swarm.domain} swarm: ${swarm.id} (${swarm.ring} ring, ${swarm.layer} layer)`;
        swarm.embedding = await this._embedFn(description);
      } catch (err) {
        this.emit('embedding:error', { swarmId: swarm.id, error: err.message });
      }
    });
    await Promise.allSettled(promises);
  }

  // ─── Metrics ───────────────────────────────────────────────────────────────

  /** @private */
  _emitMetricsSnapshot() {
    const snapshot = {
      global: this.getGlobalMetrics(),
      swarms: this.getAllMetrics(),
    };
    /**
     * @event SwarmCoordinator#metrics:snapshot
     */
    this.emit('metrics:snapshot', snapshot);
  }

  /** @private */
  _activeTotalCount() {
    let count = 0;
    for (const s of this._swarms.values()) count += s.activeTasks.size;
    return count;
  }

  /** @private */
  _countByState(state) {
    let count = 0;
    for (const s of this._swarms.values()) if (s.state === state) count++;
    return count;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  SwarmCoordinator,
  SwarmInstance,
  SwarmMessageBus,
  SWARM_DEFINITIONS,
  SWARM_STATE,
  LAYER,
  RING,
  FIBONACCI,
  FIB_TOTAL,
  CSL_THRESHOLD_HIGH,
  CSL_THRESHOLD_MED,
  CSL_THRESHOLD_LOW,
  cosineSimilarity,
  fibWeight,
};

export default SwarmCoordinator;
```

---

### `src/orchestration/seventeen-swarm-orchestrator.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: 17-Swarm Decentralized Orchestration

'use strict';

const crypto = require('crypto');

const PHI = 1.6180339887;

// ─── The 17 Canonical Swarms ──────────────────────────────────────────────────

const SWARM_NAMES = [
  'Deploy',
  'Battle',
  'Research',
  'Security',
  'Memory',
  'Creative',
  'Trading',
  'Health',
  'Governance',
  'Documentation',
  'Testing',
  'Migration',
  'Monitoring',
  'Cleanup',
  'Onboarding',
  'Analytics',
  'Emergency',
];

// Priority levels: higher = more urgent
const PRIORITY = {
  EMERGENCY:  100,
  CRITICAL:    80,
  HIGH:        60,
  NORMAL:      40,
  LOW:         20,
  BACKGROUND:  10,
};

// Default priorities per swarm
const SWARM_PRIORITIES = {
  Emergency:     PRIORITY.EMERGENCY,
  Security:      PRIORITY.CRITICAL,
  Health:        PRIORITY.CRITICAL,
  Deploy:        PRIORITY.HIGH,
  Migration:     PRIORITY.HIGH,
  Monitoring:    PRIORITY.HIGH,
  Governance:    PRIORITY.NORMAL,
  Testing:       PRIORITY.NORMAL,
  Battle:        PRIORITY.NORMAL,
  Research:      PRIORITY.NORMAL,
  Memory:        PRIORITY.NORMAL,
  Trading:       PRIORITY.NORMAL,
  Creative:      PRIORITY.LOW,
  Documentation: PRIORITY.LOW,
  Analytics:     PRIORITY.LOW,
  Cleanup:       PRIORITY.BACKGROUND,
  Onboarding:    PRIORITY.BACKGROUND,
};

const SWARM_STATUS = {
  IDLE:       'idle',
  ACTIVE:     'active',
  PAUSED:     'paused',
  ERROR:      'error',
  OVERLOADED: 'overloaded',
};

const MESSAGE_TYPE = {
  TASK:        'task',
  RESULT:      'result',
  BROADCAST:   'broadcast',
  CONSENSUS:   'consensus',
  HEARTBEAT:   'heartbeat',
  ESCALATION:  'escalation',
  SYNC:        'sync',
};

// ─── SwarmTask ────────────────────────────────────────────────────────────────

class SwarmTask {
  constructor(opts = {}) {
    this.id         = opts.id       || crypto.randomUUID();
    this.type       = opts.type     || 'generic';
    this.payload    = opts.payload  || {};
    this.priority   = opts.priority || PRIORITY.NORMAL;
    this.targetSwarm = opts.targetSwarm || null;
    this.sourceSwarm = opts.sourceSwarm || null;
    this.createdAt  = Date.now();
    this.deadline   = opts.deadline || null;
    this.ttlMs      = opts.ttlMs    || 60000;
    this.metadata   = opts.metadata || {};
    this.status     = 'pending';
    this.result     = null;
    this.error      = null;
    this.startedAt  = null;
    this.completedAt = null;
  }

  isExpired() {
    return this.ttlMs && Date.now() - this.createdAt > this.ttlMs;
  }

  complete(result) {
    this.status      = 'completed';
    this.result      = result;
    this.completedAt = Date.now();
    return this;
  }

  fail(error) {
    this.status   = 'failed';
    this.error    = error instanceof Error ? error.message : String(error);
    this.completedAt = Date.now();
    return this;
  }

  getDuration() {
    if (!this.completedAt || !this.startedAt) return null;
    return this.completedAt - this.startedAt;
  }
}

// ─── SwarmMessage ─────────────────────────────────────────────────────────────

class SwarmMessage {
  constructor(opts = {}) {
    this.id       = opts.id   || crypto.randomUUID();
    this.type     = opts.type || MESSAGE_TYPE.BROADCAST;
    this.from     = opts.from;
    this.to       = opts.to   || null; // null = broadcast
    this.payload  = opts.payload || {};
    this.ts       = Date.now();
    this.priority = opts.priority || PRIORITY.NORMAL;
  }
}

// ─── SwarmBus (inter-swarm communication) ────────────────────────────────────

class SwarmBus {
  constructor() {
    this._queues    = new Map();  // swarmName → Message[]
    this._listeners = new Map();  // swarmName → fn[]
    this._history   = [];
    this._maxHistory = 10000;
  }

  register(swarmName) {
    if (!this._queues.has(swarmName))    this._queues.set(swarmName, []);
    if (!this._listeners.has(swarmName)) this._listeners.set(swarmName, []);
    return this;
  }

  /**
   * Send a message to a specific swarm or broadcast to all.
   */
  send(message) {
    const msg = message instanceof SwarmMessage ? message : new SwarmMessage(message);
    this._history.push(msg);
    if (this._history.length > this._maxHistory) this._history.shift();

    if (msg.to) {
      // Direct
      const q = this._queues.get(msg.to);
      if (q) q.push(msg);
      const listeners = this._listeners.get(msg.to) || [];
      for (const fn of listeners) fn(msg);
    } else {
      // Broadcast to all except sender
      for (const [name, q] of this._queues.entries()) {
        if (name !== msg.from) {
          q.push(msg);
          const listeners = this._listeners.get(name) || [];
          for (const fn of listeners) fn(msg);
        }
      }
    }
    return this;
  }

  /**
   * Drain messages for a swarm.
   */
  drain(swarmName) {
    const q = this._queues.get(swarmName) || [];
    this._queues.set(swarmName, []);
    return q;
  }

  /**
   * Register a listener for a swarm.
   */
  subscribe(swarmName, fn) {
    if (!this._listeners.has(swarmName)) this._listeners.set(swarmName, []);
    this._listeners.get(swarmName).push(fn);
    return () => this.unsubscribe(swarmName, fn);
  }

  unsubscribe(swarmName, fn) {
    const listeners = this._listeners.get(swarmName);
    if (listeners) this._listeners.set(swarmName, listeners.filter(l => l !== fn));
    return this;
  }

  getHistory(filter = {}) {
    return this._history.filter(m => {
      if (filter.from && m.from !== filter.from) return false;
      if (filter.to   && m.to   !== filter.to)   return false;
      if (filter.type && m.type !== filter.type)  return false;
      if (filter.since && m.ts < filter.since)   return false;
      return true;
    });
  }

  getQueueDepth(swarmName) { return (this._queues.get(swarmName) || []).length; }
}

// ─── Swarm ────────────────────────────────────────────────────────────────────

class Swarm {
  constructor(name, opts = {}) {
    this.name       = name;
    this.id         = opts.id       || crypto.randomUUID();
    this.priority   = opts.priority || SWARM_PRIORITIES[name] || PRIORITY.NORMAL;
    this.status     = SWARM_STATUS.IDLE;
    this._bus       = null;
    this._handlers  = {};   // task type → async fn
    this._queue     = [];   // pending SwarmTasks
    this._active    = [];   // in-flight SwarmTasks
    this._completed = [];
    this._maxConcurrency = opts.maxConcurrency || 5;
    this._maxQueue       = opts.maxQueue       || 100;
    this._stats          = { received: 0, completed: 0, failed: 0, escalated: 0 };
    this._heartbeatMs    = opts.heartbeatMs || Math.round(5000 * (1 + (this.priority / 200)));
    this._heartbeatTimer = null;
    this._capabilities   = opts.capabilities || [name.toLowerCase()];
    this._callbacks      = { task: [], complete: [], error: [] };
  }

  connectBus(bus) {
    this._bus = bus;
    bus.register(this.name);
    bus.subscribe(this.name, msg => this._onMessage(msg));
    return this;
  }

  /**
   * Register a handler for a task type.
   */
  on(taskType, fn) {
    this._handlers[taskType] = fn;
    return this;
  }

  /**
   * Submit a task to this swarm.
   */
  submit(task) {
    const t = task instanceof SwarmTask ? task : new SwarmTask({ ...task, targetSwarm: this.name });
    if (this._queue.length >= this._maxQueue) {
      // Evict lowest priority task if new one is higher
      this._queue.sort((a, b) => a.priority - b.priority);
      if (this._queue[0].priority < t.priority) {
        const evicted = this._queue.shift();
        evicted.fail(new Error('Queue overflow - evicted'));
      } else {
        t.fail(new Error('Swarm queue full'));
        return t;
      }
    }
    this._stats.received++;
    this._queue.push(t);
    this._queue.sort((a, b) => b.priority - a.priority); // highest priority first
    this._drain();
    return t;
  }

  async _drain() {
    while (this._queue.length > 0 && this._active.length < this._maxConcurrency) {
      const task = this._queue.shift();
      if (task.isExpired()) { task.fail(new Error('Task TTL expired')); continue; }

      this._active.push(task);
      task.startedAt = Date.now();
      task.status    = 'running';
      this.status    = SWARM_STATUS.ACTIVE;
      this._emit('task', task);

      this._executeTask(task).then(result => {
        task.complete(result);
        this._stats.completed++;
        this._emit('complete', task);
        this._finishTask(task);
      }).catch(err => {
        task.fail(err);
        this._stats.failed++;
        this._emit('error', task);
        this._finishTask(task);

        // Escalate to Emergency swarm if critical
        if (this._bus && task.priority >= PRIORITY.HIGH) {
          this._stats.escalated++;
          this._bus.send({
            type:    MESSAGE_TYPE.ESCALATION,
            from:    this.name,
            to:      'Emergency',
            payload: { taskId: task.id, error: task.error, priority: task.priority },
            priority: PRIORITY.CRITICAL,
          });
        }
      });
    }

    if (this._active.length === 0 && this._queue.length === 0) {
      this.status = SWARM_STATUS.IDLE;
    }
  }

  async _executeTask(task) {
    const handler = this._handlers[task.type] || this._handlers['*'];
    if (!handler) {
      throw new Error(`No handler registered for task type '${task.type}' in swarm '${this.name}'`);
    }
    return handler(task, this);
  }

  _finishTask(task) {
    this._active = this._active.filter(t => t.id !== task.id);
    this._completed.push(task);
    if (this._completed.length > 1000) this._completed.shift();

    // Reply if there's a target bus recipient
    if (this._bus && task.sourceSwarm) {
      this._bus.send({
        type:    MESSAGE_TYPE.RESULT,
        from:    this.name,
        to:      task.sourceSwarm,
        payload: { taskId: task.id, status: task.status, result: task.result, error: task.error },
        priority: task.priority,
      });
    }
    this._drain();
  }

  _onMessage(msg) {
    switch (msg.type) {
      case MESSAGE_TYPE.TASK:
        this.submit(new SwarmTask({
          ...msg.payload,
          sourceSwarm: msg.from,
          targetSwarm: this.name,
        }));
        break;
      case MESSAGE_TYPE.HEARTBEAT:
        // Record heartbeat from peer (no reply to avoid feedback loops)
        break;
      case MESSAGE_TYPE.BROADCAST:
        // Optionally handle broadcasts
        break;
    }
  }

  startHeartbeat() {
    this._heartbeatTimer = setInterval(() => {
      if (this._bus) {
        this._bus.send({
          type:    MESSAGE_TYPE.HEARTBEAT,
          from:    this.name,
          payload: this.getStatus(),
          priority: PRIORITY.LOW,
        });
      }
    }, this._heartbeatMs);
    if (this._heartbeatTimer.unref) this._heartbeatTimer.unref();
    return this;
  }

  stopHeartbeat() {
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    return this;
  }

  pause()  { this.status = SWARM_STATUS.PAUSED;  return this; }
  resume() { this.status = SWARM_STATUS.IDLE; this._drain(); return this; }

  getStatus() {
    return {
      name:        this.name,
      id:          this.id,
      status:      this.status,
      priority:    this.priority,
      queue:       this._queue.length,
      active:      this._active.length,
      capabilities: this._capabilities,
      stats:       { ...this._stats },
    };
  }

  getCompletedTasks() { return this._completed.slice(); }
  getQueueDepth()     { return this._queue.length; }
  getActiveCount()    { return this._active.length; }

  _emit(event, data) {
    for (const fn of (this._callbacks[event] || [])) fn(data);
  }
  onChange(event, fn) { if (this._callbacks[event]) this._callbacks[event].push(fn); return this; }
}

// ─── ConsensusManager ────────────────────────────────────────────────────────

class ConsensusManager {
  /**
   * Aggregate decisions from multiple swarms using φ-weighted voting.
   */
  constructor(opts = {}) {
    this._quorum     = opts.quorum     || 0.5;  // fraction of swarms that must agree
    this._timeout    = opts.timeoutMs  || 10000;
    this._proposals  = new Map();  // proposalId → { votes, result }
  }

  /**
   * Create a consensus proposal.
   */
  propose(proposalId, data, participants) {
    this._proposals.set(proposalId, {
      data,
      participants: participants.slice(),
      votes: new Map(),
      createdAt: Date.now(),
      resolved: false,
    });
    return proposalId;
  }

  /**
   * Record a vote from a swarm.
   */
  vote(proposalId, swarmName, decision, weight = 1.0) {
    const proposal = this._proposals.get(proposalId);
    if (!proposal) return null;
    if (proposal.resolved) return proposal.result;  // return existing result on late votes
    proposal.votes.set(swarmName, { decision, weight });
    return this._tryResolve(proposalId);
  }

  _tryResolve(proposalId) {
    const proposal = this._proposals.get(proposalId);
    const total    = proposal.participants.length;
    const voted    = proposal.votes.size;

    if (voted < Math.ceil(total * this._quorum)) return null;

    // Tally with φ-weighted scores
    const tally = {};
    let totalWeight = 0;
    for (const [swarm, { decision, weight }] of proposal.votes) {
      // Weight by swarm priority
      const priorityWeight = (SWARM_PRIORITIES[swarm] || PRIORITY.NORMAL) / PRIORITY.EMERGENCY;
      const effectiveWeight = weight * priorityWeight * PHI;
      tally[decision] = (tally[decision] || 0) + effectiveWeight;
      totalWeight += effectiveWeight;
    }

    // Find winning decision
    let winner = null, maxScore = -1;
    for (const [dec, score] of Object.entries(tally)) {
      if (score > maxScore) { winner = dec; maxScore = score; }
    }

    const confidence = maxScore / totalWeight;
    proposal.resolved = true;
    proposal.result   = { decision: winner, confidence, tally, voted, total };
    return proposal.result;
  }

  getProposal(proposalId) { return this._proposals.get(proposalId) || null; }

  /**
   * Await consensus with timeout.
   */
  async waitForConsensus(proposalId) {
    return new Promise((resolve, reject) => {
      const start   = Date.now();
      const check   = setInterval(() => {
        const p = this._proposals.get(proposalId);
        if (!p) { clearInterval(check); reject(new Error('Proposal not found')); return; }
        if (p.resolved) { clearInterval(check); resolve(p.result); return; }
        if (Date.now() - start > this._timeout) {
          clearInterval(check);
          reject(new Error(`Consensus timeout for proposal '${proposalId}'`));
        }
      }, 50);
    });
  }
}

// ─── SwarmOrchestrator ────────────────────────────────────────────────────────

class SwarmOrchestrator {
  /**
   * Manages all 17 canonical swarms with inter-swarm comms,
   * priority-based scheduling, and consensus support.
   */
  constructor(opts = {}) {
    this._bus          = new SwarmBus();
    this._swarms       = new Map();
    this._consensus    = new ConsensusManager(opts.consensusOpts || {});
    this._schedulerMs  = opts.schedulerMs || Math.round(1000 / PHI);
    this._schedulerTimer = null;
    this._auditLog     = [];
    this._maxAudit     = opts.maxAuditEntries || 50000;
    this._initialized  = false;
    this._taskRouter   = opts.taskRouter || null;

    // Initialize all 17 swarms
    for (const name of SWARM_NAMES) {
      this._createSwarm(name, opts.swarmOpts?.[name] || {});
    }
  }

  _createSwarm(name, opts = {}) {
    const swarm = new Swarm(name, {
      priority: SWARM_PRIORITIES[name] || PRIORITY.NORMAL,
      ...opts,
    });
    swarm.connectBus(this._bus);
    this._swarms.set(name, swarm);

    // Default handlers per swarm type
    this._installDefaultHandlers(swarm);

    swarm.onChange('complete', task => this._audit('task_complete', { swarm: name, taskId: task.id, durationMs: task.getDuration() }));
    swarm.onChange('error',    task => this._audit('task_error',    { swarm: name, taskId: task.id, error: task.error }));

    return swarm;
  }

  _installDefaultHandlers(swarm) {
    // Each swarm handles its own type by default (passthrough with logging)
    swarm.on('*', async (task, s) => {
      // Default: noop passthrough
      return { processed: true, swarm: s.name, taskId: task.id };
    });

    // Specific default behaviors
    switch (swarm.name) {
      case 'Health':
        swarm.on('health_check', async (task) => ({
          ok: true, ts: Date.now(), metrics: { uptime: process.uptime(), memory: process.memoryUsage() }
        }));
        break;

      case 'Monitoring':
        swarm.on('get_status', async (task, s) => ({
          swarms: Array.from(this._swarms.values()).map(sw => sw.getStatus()),
          bus:    { queueDepths: SWARM_NAMES.reduce((acc, n) => { acc[n] = this._bus.getQueueDepth(n); return acc; }, {}) },
        }));
        break;

      case 'Cleanup':
        swarm.on('cleanup', async (task) => {
          // Trim completed task history across swarms
          let cleaned = 0;
          for (const sw of this._swarms.values()) {
            const before = sw._completed.length;
            sw._completed.splice(0, Math.floor(before / 2));
            cleaned += before - sw._completed.length;
          }
          return { cleaned };
        });
        break;

      case 'Emergency':
        swarm.on('*', async (task) => {
          this._audit('emergency', { taskId: task.id, priority: task.priority, payload: task.payload });
          // Broadcast emergency to all swarms
          this._bus.send({
            type:    MESSAGE_TYPE.BROADCAST,
            from:    'Emergency',
            payload: { emergency: true, taskId: task.id, payload: task.payload },
            priority: PRIORITY.EMERGENCY,
          });
          return { acknowledged: true, ts: Date.now() };
        });
        break;

      case 'Governance':
        swarm.on('consensus', async (task) => {
          const { proposalId, participants, data } = task.payload;
          this._consensus.propose(proposalId, data, participants || SWARM_NAMES);
          return { proposed: proposalId };
        });
        swarm.on('vote', async (task) => {
          const { proposalId, swarmName, decision, weight } = task.payload;
          const result = this._consensus.vote(proposalId, swarmName, decision, weight);
          return { proposalId, result };
        });
        break;

      case 'Analytics':
        swarm.on('get_metrics', async (task) => {
          const metrics = {};
          for (const [name, sw] of this._swarms.entries()) {
            metrics[name] = sw.getStatus().stats;
          }
          return { metrics, ts: Date.now(), totalTasks: this._getTotalTasks() };
        });
        break;
    }
  }

  /**
   * Start the orchestrator: activate all swarms and begin scheduling.
   */
  start() {
    for (const swarm of this._swarms.values()) {
      swarm.startHeartbeat();
    }
    this._schedulerTimer = setInterval(() => this._schedulerTick(), this._schedulerMs);
    if (this._schedulerTimer.unref) this._schedulerTimer.unref();
    this._initialized = true;
    this._audit('orchestrator_start', { swarms: SWARM_NAMES.length });
    return this;
  }

  /**
   * Stop the orchestrator.
   */
  stop() {
    if (this._schedulerTimer) { clearInterval(this._schedulerTimer); this._schedulerTimer = null; }
    for (const swarm of this._swarms.values()) swarm.stopHeartbeat();
    this._initialized = false;
    this._audit('orchestrator_stop', {});
    return this;
  }

  _schedulerTick() {
    // Priority-based: check overloaded swarms, rebalance tasks
    for (const [name, swarm] of this._swarms.entries()) {
      if (swarm.status === SWARM_STATUS.ERROR) swarm.status = SWARM_STATUS.IDLE;
      const qd = swarm.getQueueDepth();
      if (qd > 50) swarm.status = SWARM_STATUS.OVERLOADED;
    }
  }

  /**
   * Route a task to the appropriate swarm.
   */
  dispatch(taskOpts) {
    const task = taskOpts instanceof SwarmTask ? taskOpts : new SwarmTask(taskOpts);

    // Custom router if provided
    if (this._taskRouter) {
      const target = this._taskRouter(task, this._swarms);
      if (target) return target.submit(task);
    }

    // Auto-route to target swarm
    if (task.targetSwarm && this._swarms.has(task.targetSwarm)) {
      return this._swarms.get(task.targetSwarm).submit(task);
    }

    // Route by task type prefix matching swarm names
    for (const name of SWARM_NAMES) {
      if (task.type.toLowerCase().includes(name.toLowerCase())) {
        return this._swarms.get(name).submit(task);
      }
    }

    // Default: Memory swarm for generic tasks
    return this._swarms.get('Memory').submit(task);
  }

  /**
   * Broadcast to all swarms.
   */
  broadcast(payload, type = MESSAGE_TYPE.BROADCAST, priority = PRIORITY.NORMAL) {
    this._bus.send({ type, from: 'Orchestrator', payload, priority });
    return this;
  }

  /**
   * Run a cross-swarm consensus vote.
   */
  async runConsensus(proposal, participants = null, timeoutMs = 10000) {
    const proposalId  = crypto.randomUUID();
    const swarmList   = participants || SWARM_NAMES;
    this._consensus.propose(proposalId, proposal, swarmList);

    // Ask the Governance swarm to cast a vote on behalf of each participant
    const governance = this._swarms.get('Governance');
    for (const swarmName of swarmList) {
      const swarm = this._swarms.get(swarmName);
      if (!swarm || !governance) continue;
      governance.submit(new SwarmTask({
        type:        'vote',
        targetSwarm: 'Governance',
        sourceSwarm: swarmName,
        payload:     { proposalId, swarmName, decision: 'approve', weight: swarm.priority / PRIORITY.EMERGENCY },
        priority:    PRIORITY.HIGH,
      }));
    }

    return this._consensus.waitForConsensus(proposalId);
  }

  getSwarm(name)    { return this._swarms.get(name) || null; }
  getAllSwarms()     { return new Map(this._swarms); }
  listSwarmNames()  { return SWARM_NAMES.slice(); }

  getStatus() {
    return {
      initialized: this._initialized,
      swarms:      SWARM_NAMES.map(n => this._swarms.get(n).getStatus()),
      busHistory:  this._bus.getHistory({ since: Date.now() - 60000 }).length,
      totalTasks:  this._getTotalTasks(),
    };
  }

  _getTotalTasks() {
    let total = 0;
    for (const sw of this._swarms.values()) total += sw.getStatus().stats.received;
    return total;
  }

  getAuditLog(filter = {}) {
    return this._auditLog.filter(e => {
      if (filter.action && e.action !== filter.action) return false;
      if (filter.since && e.ts < filter.since) return false;
      return true;
    });
  }

  _audit(action, data) {
    this._auditLog.push({ action, data, ts: Date.now() });
    if (this._auditLog.length > this._maxAudit) this._auditLog.shift();
  }

  getBus()      { return this._bus; }
  getConsensus(){ return this._consensus; }

  /**
   * Register a custom handler on a specific swarm.
   */
  registerHandler(swarmName, taskType, fn) {
    const swarm = this._swarms.get(swarmName);
    if (!swarm) throw new Error(`Swarm '${swarmName}' not found`);
    swarm.on(taskType, fn);
    return this;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  SWARM_NAMES,
  PRIORITY,
  SWARM_PRIORITIES,
  SWARM_STATUS,
  MESSAGE_TYPE,
  SwarmTask,
  SwarmMessage,
  SwarmBus,
  Swarm,
  ConsensusManager,
  SwarmOrchestrator,
};
```

---

### `src/bees/bee-factory.js`

```javascript
/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * Dynamic Bee Factory — Creates any type of bee on the fly at runtime.
 * CSL Integration: Uses Continuous Semantic Logic gates for intelligent
 * bee dispatch, swarm candidate scoring, and priority classification.
 *
 * CSL gates used:
 *   - multi_resonance      → Score bee candidates against task intent
 *   - route_gate           → Select best bee for a task with soft activation
 *   - resonance_gate       → Match task intent to bee domain semantics
 *   - ternary_gate         → Classify bee health/priority: core / ephemeral / reject
 *   - soft_gate            → Continuous priority activation for swarm ordering
 *   - superposition_gate   → Fuse multi-domain bee vectors for composite swarms
 *   - orthogonal_gate      → Exclude specific domain influence from routing
 *
 * Usage:
 *   const { createBee, spawnBee, routeBee, createWorkUnit } = require('./bee-factory');
 *
 *   // Create a bee for any domain
 *   createBee('new-domain', { description: 'Handles new-domain tasks', priority: 0.9, ... });
 *
 *   // Route a task to the best bee using CSL
 *   const best = routeBee('deploy kubernetes cluster');
 *
 *   // Or spawn a single-purpose bee instantly
 *   spawnBee('quick-fix', async () => patchDatabase());
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger').child('bee-factory');
const CSL = require('../core/semantic-logic');

const BEES_DIR = __dirname;
const _dynamicRegistry = new Map();
const _ephemeralBees = new Map(); // In-memory only, not persisted

// ── CSL Helpers ─────────────────────────────────────────────────────────
const _vecCache = new Map();

/**
 * Deterministic pseudo-embedding for a domain/description string.
 * In production, replaced by the 384D vector-memory embeddings.
 */
function _domainToVec(text, dim = 64) {
    if (_vecCache.has(text)) return _vecCache.get(text);
    const v = new Float32Array(dim);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    }
    for (let i = 0; i < dim; i++) {
        hash = ((hash << 5) + hash + i) >>> 0;
        v[i] = ((hash % 2000) - 1000) / 1000;
    }
    const result = CSL.normalize(v);
    _vecCache.set(text, result);
    return result;
}

/**
 * Build a composite semantic vector for a bee from its domain + description.
 */
function _buildBeeVector(domain, description) {
    const domainVec = _domainToVec(domain);
    const descVec = _domainToVec(description || domain);
    return CSL.weighted_superposition(domainVec, descVec, 0.6);
}

/**
 * Create a full bee domain dynamically at runtime.
 * Registers it in-memory AND optionally persists to disk for future boots.
 * Now includes a CSL semantic vector for routing.
 *
 * @param {string} domain - Domain name for the bee
 * @param {Object} config - Bee configuration
 * @param {string} config.description - What this bee does
 * @param {number} config.priority - Urgency (0.0 - 1.0)
 * @param {Array} config.workers - Array of { name, fn } work units
 * @param {boolean} config.persist - If true, writes a bee file to disk (default: false)
 * @returns {Object} The registered bee entry
 */
function createBee(domain, config = {}) {
    const {
        description = `Dynamic ${domain} bee`,
        priority = 0.5,
        workers = [],
        persist = false,
    } = config;

    // Validate workers are callable
    let validated = true;
    for (let i = 0; i < workers.length; i++) {
        const w = workers[i];
        if (typeof w !== 'function' && (typeof w !== 'object' || typeof w.fn !== 'function')) {
            validated = false;
            try { logger.warn(`Worker ${i} in '${domain}' is not callable`); } catch { }
        }
    }

    // CSL: Build semantic vector for this bee
    const vector = _buildBeeVector(domain, description);

    // CSL: Classify priority using ternary_gate
    const priorityClass = CSL.ternary_gate(priority, 0.7, 0.3);

    const entry = {
        domain,
        description,
        priority,
        createdAt: Date.now(),
        dynamic: true,
        validated,
        file: `dynamic:${domain}`,
        vector,
        csl: {
            priorityState: priorityClass.state, // +1 = critical, 0 = normal, -1 = low
            priorityActivation: priorityClass.resonanceActivation,
        },
        getWork: (ctx = {}) => workers.map(w => {
            if (typeof w === 'function') return w;
            if (typeof w.fn === 'function') return async () => {
                try {
                    const result = await w.fn(ctx);
                    return { bee: domain, action: w.name || 'work', ...result };
                } catch (err) {
                    return { bee: domain, action: w.name || 'work', error: err.message };
                }
            };
            return async () => ({ bee: domain, action: w.name || 'noop', status: 'no-handler' });
        }),
    };

    _dynamicRegistry.set(domain, entry);

    // Also register in the main registry if available
    try {
        const registry = require('./registry');
        registry.registry.set(domain, entry);
    } catch { /* registry not loaded yet */ }

    // Persist to disk if requested — creates a real bee file
    if (persist) {
        _persistBee(domain, config);
    }

    return entry;
}

/**
 * Spawn a single-purpose ephemeral bee for one-off tasks.
 * Lives only in memory for this process lifecycle.
 *
 * @param {string} name - Name for this bee
 * @param {Function|Function[]} work - Work function(s) to execute
 * @param {number} priority - Urgency (default: 0.8)
 * @returns {Object} The ephemeral bee entry
 */
function spawnBee(name, work, priority = 0.8) {
    const workFns = Array.isArray(work) ? work : [work];
    const id = `ephemeral-${name}-${crypto.randomBytes(3).toString('hex')}`;

    const vector = _buildBeeVector(id, `Ephemeral bee: ${name}`);

    const entry = {
        domain: id,
        description: `Ephemeral bee: ${name}`,
        priority,
        ephemeral: true,
        createdAt: Date.now(),
        file: `ephemeral:${id}`,
        vector,
        csl: { priorityState: CSL.ternary_gate(priority, 0.7, 0.3).state },
        getWork: () => workFns.map(fn => async (ctx) => {
            const result = await fn(ctx);
            return { bee: id, action: name, ...(typeof result === 'object' ? result : { result }) };
        }),
    };

    _ephemeralBees.set(id, entry);

    // Register in main registry
    try {
        const registry = require('./registry');
        registry.registry.set(id, entry);
    } catch { /* registry not loaded yet */ }

    return entry;
}

/**
 * Route a task to the best bee using CSL multi-resonance scoring.
 * This is the primary CSL-powered dispatch function.
 *
 * @param {string} taskDescription - Natural language description of the task
 * @param {Object} options - Routing options
 * @param {number} options.threshold - Minimum resonance to accept (default: 0.3)
 * @param {string[]} options.exclude - Domain names to exclude via orthogonal_gate
 * @param {number} options.topK - Return top K matches (default: 3)
 * @returns {{ best: Object|null, ranked: Array, csl: Object }}
 */
function routeBee(taskDescription, options = {}) {
    const {
        threshold = 0.3,
        exclude = [],
        topK = 3,
    } = options;

    // Build intent vector from task description
    let intentVec = _domainToVec(taskDescription);

    // Strip excluded domain influence via orthogonal_gate
    if (exclude.length > 0) {
        const excludeVecs = exclude.map(e => _domainToVec(e));
        intentVec = CSL.batch_orthogonal(intentVec, excludeVecs);
    }

    // Collect all registered bees (dynamic + ephemeral) with vectors
    const allBees = [];
    for (const [, entry] of _dynamicRegistry) {
        if (entry.vector) allBees.push(entry);
    }
    for (const [, entry] of _ephemeralBees) {
        if (entry.vector) allBees.push(entry);
    }

    if (allBees.length === 0) {
        return { best: null, ranked: [], csl: { error: 'No bees registered' } };
    }

    // CSL route_gate — scores all candidates with multi_resonance + soft_gate
    const candidates = allBees.map(b => ({ id: b.domain, vector: b.vector }));
    const routeResult = CSL.route_gate(intentVec, candidates, threshold);

    // Enrich with priority weighting via soft_gate
    const ranked = routeResult.scores.map(s => {
        const bee = allBees.find(b => b.domain === s.id);
        const priorityActivation = CSL.soft_gate(bee.priority, 0.5, 10);
        // Composite: 70% semantic resonance + 30% priority
        const composite = s.score * 0.7 + priorityActivation * 0.3;
        return {
            domain: s.id,
            description: bee.description,
            resonance: s.score,
            activation: s.activation,
            priority: bee.priority,
            priorityActivation: +priorityActivation.toFixed(6),
            composite: +composite.toFixed(6),
        };
    }).sort((a, b) => b.composite - a.composite).slice(0, topK);

    const best = ranked.length > 0 ? allBees.find(b => b.domain === ranked[0].domain) : null;

    return {
        best,
        ranked,
        csl: {
            intentDim: intentVec.length,
            candidatesScored: allBees.length,
            fallback: routeResult.fallback,
            gateStats: CSL.getStats(),
        },
    };
}

/**
 * Add a single work unit to an existing domain.
 * If the domain doesn't exist, creates it.
 *
 * @param {string} domain - Domain to add work to
 * @param {string} name - Name of the work unit
 * @param {Function} fn - The work function
 * @returns {Object} The updated/created bee entry
 */
function createWorkUnit(domain, name, fn) {
    const existing = _dynamicRegistry.get(domain);
    if (existing) {
        // Add to existing dynamic bee
        const oldGetWork = existing.getWork;
        existing.getWork = (ctx = {}) => {
            const existingWork = oldGetWork(ctx);
            existingWork.push(async () => {
                const result = await fn(ctx);
                return { bee: domain, action: name, ...(typeof result === 'object' ? result : { result }) };
            });
            return existingWork;
        };
        return existing;
    }

    // Create new domain with this single worker
    return createBee(domain, {
        workers: [{ name, fn }],
    });
}

/**
 * Create a bee from a template/pattern.
 * Useful for spawning service-monitoring bees, health-check bees, etc.
 *
 * @param {string} template - Template name ('health-check', 'monitor', 'processor', 'scanner')
 * @param {Object} config - Template-specific configuration
 * @returns {Object} The created bee entry
 */
function createFromTemplate(template, config = {}) {
    const templates = {
        'health-check': (cfg) => ({
            domain: cfg.domain || `health-${cfg.target}`,
            description: `Health checker for ${cfg.target}`,
            priority: 0.9,
            workers: [
                {
                    name: 'probe', fn: async () => {
                        const url = cfg.url || `https://${cfg.target}/api/health`;
                        const timeout = cfg.timeout || 5000;
                        const start = Date.now();
                        try {
                            const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
                            const latency = Date.now() - start;
                            const body = res.headers.get('content-type')?.includes('json')
                                ? await res.json().catch(() => null)
                                : await res.text().catch(() => null);
                            return {
                                target: cfg.target, url, status: res.ok ? 'healthy' : 'degraded',
                                statusCode: res.status, latency, body,
                            };
                        } catch (err) {
                            return {
                                target: cfg.target, url, status: 'down',
                                error: err.message, latency: Date.now() - start,
                            };
                        }
                    }
                },
            ],
        }),

        'monitor': (cfg) => ({
            domain: cfg.domain || `monitor-${cfg.target}`,
            description: `Monitor for ${cfg.target}`,
            priority: 0.7,
            workers: [
                {
                    name: 'metrics', fn: async () => {
                        const mem = process.memoryUsage();
                        const lagStart = Date.now();
                        await new Promise(r => setImmediate(r));
                        const eventLoopLag = Date.now() - lagStart;
                        return {
                            target: cfg.target,
                            heapUsedMB: Math.round(mem.heapUsed / 1048576 * 10) / 10,
                            heapTotalMB: Math.round(mem.heapTotal / 1048576 * 10) / 10,
                            rssMB: Math.round(mem.rss / 1048576 * 10) / 10,
                            externalMB: Math.round(mem.external / 1048576 * 10) / 10,
                            eventLoopLagMs: eventLoopLag,
                            ts: Date.now(),
                        };
                    }
                },
                {
                    name: 'uptime', fn: async () => {
                        const uptimeSec = process.uptime();
                        return {
                            target: cfg.target,
                            uptimeSeconds: Math.round(uptimeSec),
                            uptimeHuman: uptimeSec > 86400
                                ? `${Math.floor(uptimeSec / 86400)}d ${Math.floor((uptimeSec % 86400) / 3600)}h`
                                : uptimeSec > 3600
                                    ? `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`
                                    : `${Math.floor(uptimeSec / 60)}m ${Math.round(uptimeSec % 60)}s`,
                            cpuUsage: process.cpuUsage(),
                            pid: process.pid,
                            ts: Date.now(),
                        };
                    }
                },
            ],
        }),

        'processor': (cfg) => ({
            domain: cfg.domain || `processor-${cfg.name}`,
            description: `Data processor: ${cfg.name}`,
            priority: cfg.priority || 0.6,
            workers: (cfg.tasks || []).map(task => ({
                name: task.name || 'process',
                fn: task.fn || (async () => ({ processed: true, task: task.name })),
            })),
        }),

        'scanner': (cfg) => ({
            domain: cfg.domain || `scanner-${cfg.target}`,
            description: `Scanner for ${cfg.target}`,
            priority: 0.8,
            workers: [
                {
                    name: 'scan', fn: cfg.scanFn || (async () => {
                        const fs = require('fs');
                        const path = require('path');
                        const targetDir = cfg.scanPath || cfg.target || '.';
                        const patterns = cfg.patterns || ['.env', '.key', '.pem', 'secret'];
                        const findings = [];

                        const walk = (dir, depth = 0) => {
                            if (depth > 5) return;
                            try {
                                const entries = fs.readdirSync(dir, { withFileTypes: true });
                                for (const entry of entries) {
                                    if (entry.name === 'node_modules' || entry.name === '.git') continue;
                                    const fullPath = path.join(dir, entry.name);
                                    if (entry.isDirectory()) {
                                        walk(fullPath, depth + 1);
                                    } else if (patterns.some(p => entry.name.includes(p))) {
                                        findings.push({
                                            file: fullPath,
                                            pattern: patterns.find(p => entry.name.includes(p)),
                                            size: fs.statSync(fullPath).size,
                                        });
                                    }
                                }
                            } catch { /* permission denied or missing dir */ }
                        };
                        walk(targetDir);

                        return { scanned: targetDir, findings, count: findings.length, ts: Date.now() };
                    })
                },
                {
                    name: 'report', fn: cfg.reportFn || (async (ctx) => {
                        const findings = ctx?.findings || [];
                        const severity = findings.length > 5 ? 'high' : findings.length > 0 ? 'medium' : 'clean';
                        return {
                            report: `Scan complete: ${cfg.target}`,
                            severity,
                            totalFindings: findings.length,
                            summary: findings.slice(0, 10).map(f => f.file),
                        };
                    })
                },
            ],
        }),

        'alerter': (cfg) => ({
            domain: cfg.domain || `alerter-${cfg.target}`,
            description: `Threshold alerter for ${cfg.target}`,
            priority: 0.85,
            workers: [
                {
                    name: 'check-thresholds', fn: async () => {
                        const mem = process.memoryUsage();
                        const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;
                        const alerts = [];

                        if (heapPercent > (cfg.heapThreshold || 85)) {
                            alerts.push({ type: 'heap', level: 'warning', value: `${heapPercent.toFixed(1)}%`, threshold: `${cfg.heapThreshold || 85}%` });
                        }

                        if (process.uptime() > (cfg.maxUptimeSeconds || 86400 * 7)) {
                            alerts.push({ type: 'uptime', level: 'info', value: `${Math.floor(process.uptime() / 86400)}d`, threshold: 'restart recommended' });
                        }

                        if (global.eventBus && alerts.length > 0) {
                            global.eventBus.emit('bee:alerts', { target: cfg.target, alerts });
                        }

                        return { target: cfg.target, alerts, alertCount: alerts.length, ts: Date.now() };
                    }
                },
            ],
        }),
    };

    const templateFn = templates[template];
    if (!templateFn) {
        throw new Error(`Unknown bee template: '${template}'. Available: ${Object.keys(templates).join(', ')}`);
    }

    return createBee(config.domain || `${template}-${config.target || config.name || 'dynamic'}`, templateFn(config));
}

/**
 * Create a coordinated swarm of bees with CSL-powered candidate scoring.
 * Uses multi_resonance to rank bees by semantic affinity to the swarm mission,
 * and superposition_gate to build the swarm's composite capability vector.
 *
 * @param {string} name - Swarm name
 * @param {Array} beeConfigs - Array of { domain, config } for each bee
 * @param {Object} policy - Orchestration policy
 * @param {string} policy.mode - 'parallel', 'sequential', or 'pipeline'
 * @param {boolean} policy.requireConsensus - If true, all bees must succeed
 * @param {number} policy.timeoutMs - Max execution time per bee (default: 30000)
 * @returns {Object} The swarm bee entry with CSL scoring
 */
function createSwarm(name, beeConfigs = [], policy = {}) {
    const {
        mode = 'parallel',
        requireConsensus = false,
        timeoutMs = 30000,
    } = policy;

    // Create individual bees first
    const bees = beeConfigs.map(({ domain, config }) =>
        createBee(domain, config || {})
    );

    // CSL: Score each bee's affinity to the swarm mission using multi_resonance
    const swarmIntentVec = _domainToVec(name);
    const beeVectors = bees.map(b => b.vector);
    const affinityScores = beeVectors.length > 0
        ? CSL.multi_resonance(swarmIntentVec, beeVectors, 0.2)
        : [];

    // CSL: Build composite swarm vector via consensus superposition
    const swarmVector = beeVectors.length > 0
        ? CSL.consensus_superposition(beeVectors)
        : swarmIntentVec;

    // Create the orchestrating swarm bee
    const swarmBee = createBee(`swarm-${name}`, {
        description: `Swarm: ${name} (${mode}, ${bees.length} bees, CSL-scored)`,
        priority: 1.0,
        isSwarm: true,
        workers: [{
            name: 'orchestrate',
            fn: async (ctx = {}) => {
                const results = {};
                const startTime = Date.now();

                // Order bees by CSL affinity (highest first) for sequential/pipeline modes
                const orderedBees = affinityScores.length > 0
                    ? affinityScores.map(s => bees[s.index])
                    : bees;

                if (mode === 'parallel') {
                    const settled = await Promise.allSettled(
                        orderedBees.map(async (bee) => {
                            const workFns = bee.getWork(ctx);
                            const beeResults = [];
                            for (const fn of workFns) {
                                const result = await Promise.race([
                                    fn(ctx),
                                    new Promise((_, reject) =>
                                        setTimeout(() => reject(new Error('timeout')), timeoutMs)
                                    ),
                                ]);
                                beeResults.push(result);
                            }
                            return { domain: bee.domain, results: beeResults };
                        })
                    );

                    for (const s of settled) {
                        if (s.status === 'fulfilled') {
                            results[s.value.domain] = { status: 'ok', results: s.value.results };
                        } else {
                            results[s.reason?.domain || 'unknown'] = { status: 'error', error: s.reason?.message };
                        }
                    }
                } else if (mode === 'sequential' || mode === 'pipeline') {
                    let pipelineCtx = { ...ctx };
                    for (const bee of orderedBees) {
                        try {
                            const workFns = bee.getWork(pipelineCtx);
                            const beeResults = [];
                            for (const fn of workFns) {
                                const result = await fn(pipelineCtx);
                                beeResults.push(result);
                                if (mode === 'pipeline' && typeof result === 'object') {
                                    pipelineCtx = { ...pipelineCtx, ...result };
                                }
                            }
                            results[bee.domain] = { status: 'ok', results: beeResults };
                        } catch (err) {
                            results[bee.domain] = { status: 'error', error: err.message };
                            if (requireConsensus) break;
                        }
                    }
                }

                const allOk = Object.values(results).every(r => r.status === 'ok');
                return {
                    swarm: name,
                    mode,
                    beeCount: bees.length,
                    consensus: requireConsensus ? allOk : null,
                    durationMs: Date.now() - startTime,
                    csl: {
                        affinityScores: affinityScores.map(s => ({ index: s.index, score: s.score })),
                        swarmVectorDim: swarmVector.length,
                    },
                    results,
                };
            },
        }],
    });

    // Attach the composite swarm vector
    swarmBee.vector = swarmVector;
    swarmBee.csl.affinityScores = affinityScores.map(s => ({ index: s.index, score: s.score }));

    return swarmBee;
}

/**
 * Get all dynamic and ephemeral bees with CSL metadata.
 */
function listDynamicBees() {
    const bees = [];
    for (const [id, entry] of _dynamicRegistry) {
        bees.push({
            domain: id, description: entry.description, priority: entry.priority,
            type: 'dynamic', createdAt: entry.createdAt,
            csl: entry.csl || null,
        });
    }
    for (const [id, entry] of _ephemeralBees) {
        bees.push({
            domain: id, description: entry.description, priority: entry.priority,
            type: 'ephemeral', createdAt: entry.createdAt,
            csl: entry.csl || null,
        });
    }
    return bees;
}

/**
 * Dissolve (remove) a dynamic or ephemeral bee.
 */
function dissolveBee(domain) {
    _dynamicRegistry.delete(domain);
    _ephemeralBees.delete(domain);
    _vecCache.delete(domain);
    try {
        const registry = require('./registry');
        registry.registry.delete(domain);
    } catch { /* fine */ }
}

/**
 * Persist a dynamic bee to disk as a real bee file.
 * @private
 */
function _persistBee(domain, config) {
    const filename = `${domain.replace(/[^a-z0-9-]/gi, '-')}-bee.js`;
    const filePath = path.join(BEES_DIR, filename);

    // Don't overwrite existing files
    if (fs.existsSync(filePath)) return;

    const workerNames = (config.workers || []).map((w, i) =>
        typeof w === 'function' ? `worker-${i}` : (w.name || `worker-${i}`)
    );

    const code = `/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Auto-generated by Dynamic Bee Factory (CSL-enabled)
 * Domain: ${domain}
 * Created: ${new Date().toISOString()}
 */
const domain = '${domain}';
const description = '${(config.description || '').replace(/'/g, "\\'")}';
const priority = ${config.priority || 0.5};

function getWork(ctx = {}) {
    return [
${workerNames.map(name => `        async () => ({ bee: domain, action: '${name}', status: 'active', ts: Date.now() }),`).join('\n')}
    ];
}

module.exports = { domain, description, priority, getWork };
`;

    try {
        fs.writeFileSync(filePath, code, 'utf8');
    } catch { /* non-fatal */ }
}

// Export everything — Heady can create any bee, anywhere, instantly
module.exports = {
    createBee,
    spawnBee,
    routeBee,
    createWorkUnit,
    createFromTemplate,
    createSwarm,
    listDynamicBees,
    dissolveBee,
    dynamicRegistry: _dynamicRegistry,
    ephemeralBees: _ephemeralBees,
    _domainToVec,
};
```

---

### `src/orchestration/battle-sim-task-orchestrator.js`

```javascript
/**
 * Battle-Sim Task Orchestrator
 *
 * Bridges HeadyBattle, HeadySims, HeadyMC, HeadyBees, and HeadySwarms
 * into a unified deterministic task pipeline.
 *
 * Pipeline:  Task → Sim → CSL Gate → Battle/MC → Bee → Swarm → Result → Drift → Audit
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;
const PSI = 1 / PHI;           // ≈ 0.618
const PSI_SQ = PSI * PSI;      // ≈ 0.382

const PIPELINE_STAGES = [
    'sim_preflight',   // HeadySims: predict resource needs, estimate success
    'csl_gate',        // CSL confidence check
    'battle_race',     // HeadyBattle: model racing with contestants
    'mc_sampling',     // HeadyMC: Monte Carlo determinism boundary finding
    'bee_dispatch',    // HeadyBees: spawn domain-specific worker
    'swarm_route',     // HeadySwarms: route to optimal swarm
    'result_capture',  // Capture and hash output
    'drift_check',     // Drift detection
    'audit_log',       // Immutable audit trail
];

// ─── BattleSimTaskOrchestrator ────────────────────────────────────────────────

class BattleSimTaskOrchestrator extends EventEmitter {

    /**
     * @param {Object} opts
     * @param {Object} [opts.battleService]  - HeadyBattleService instance
     * @param {Object} [opts.simsService]    - HeadySimsService instance
     * @param {Object} [opts.arena]          - BattleArena instance (from battle-arena-protocol)
     * @param {Object} [opts.confidenceGate] - CSLConfidenceGate instance
     * @param {Object} [opts.actionAnalyzer] - ContinuousActionAnalyzer instance
     * @param {number} [opts.mcIterations]   - Monte Carlo iterations (default: 5)
     * @param {number} [opts.simConfidenceThreshold] - Min sim score to proceed (default: PSI ≈ 0.618)
     */
    constructor(opts = {}) {
        super();
        this.battleService = opts.battleService || null;
        this.simsService = opts.simsService || null;
        this.arena = opts.arena || null;
        this.confidenceGate = opts.confidenceGate || null;
        this.actionAnalyzer = opts.actionAnalyzer || null;
        this.mcIterations = opts.mcIterations || 5;
        this.simConfidenceThreshold = opts.simConfidenceThreshold || PSI;
        this._auditLog = [];
        this._stats = {
            tasksProcessed: 0,
            simPasses: 0,
            simFails: 0,
            battleRaces: 0,
            mcRuns: 0,
            beeDispatches: 0,
            swarmRoutes: 0,
            halts: 0,
            driftAlerts: 0,
        };
    }

    // ─── Main Pipeline ────────────────────────────────────────────────────────

    /**
     * Execute a task through the full battle-sim pipeline.
     *
     * @param {Object} task - { id, prompt, domain, keywords, variables, contestants?, beeType? }
     * @param {Object} [opts] - { skipSim, skipBattle, skipMC, force }
     * @returns {Object} Pipeline result with stage outputs and determinism metrics
     */
    async execute(task, opts = {}) {
        const pipelineId = crypto.randomUUID();
        const startTime = Date.now();
        const stages = {};

        this._stats.tasksProcessed++;
        this._audit('pipeline_start', { pipelineId, taskId: task.id, task: task.prompt?.slice(0, 100) });

        try {
            // ─── Stage 1: HeadySims Pre-Flight ──────────────────────────────────
            if (!opts.skipSim) {
                stages.sim_preflight = this._simPreflight(task);
                if (stages.sim_preflight.score < this.simConfidenceThreshold && !opts.force) {
                    this._stats.simFails++;
                    this._stats.halts++;
                    this._audit('sim_halt', { pipelineId, score: stages.sim_preflight.score });
                    this.emit('pipeline:halt', { pipelineId, stage: 'sim_preflight', reason: 'sim score below threshold' });
                    return {
                        pipelineId, halted: true, haltStage: 'sim_preflight',
                        reason: `Sim score ${stages.sim_preflight.score.toFixed(4)} < threshold ${this.simConfidenceThreshold.toFixed(4)}`,
                        stages, durationMs: Date.now() - startTime,
                    };
                }
                this._stats.simPasses++;
            }

            // ─── Stage 2: CSL Confidence Gate ───────────────────────────────────
            if (this.confidenceGate) {
                const interpolated = task.prompt || '';
                stages.csl_gate = this.confidenceGate.preFlightCheck(
                    task.id || '', task.variables || {}, interpolated
                );
                if (stages.csl_gate.decision === 'HALT' && !opts.force) {
                    this._stats.halts++;
                    this._audit('csl_halt', { pipelineId, decision: stages.csl_gate.decision });
                    this.emit('pipeline:halt', { pipelineId, stage: 'csl_gate', reason: 'CSL confidence below threshold' });
                    return {
                        pipelineId, halted: true, haltStage: 'csl_gate',
                        reason: `CSL decision: HALT (confidence ${stages.csl_gate.confidence.toFixed(4)})`,
                        stages, durationMs: Date.now() - startTime,
                    };
                }
            }

            // ─── Stage 3: HeadyBattle Model Racing ─────────────────────────────
            if (!opts.skipBattle && this.arena) {
                stages.battle_race = await this._battleRace(task);
                this._stats.battleRaces++;
            } else {
                // Direct execution without racing
                stages.battle_race = { skipped: true, output: task.prompt || '' };
            }

            // ─── Stage 4: HeadyMC Monte Carlo Sampling ─────────────────────────
            if (!opts.skipMC) {
                stages.mc_sampling = this._mcSampling(task, stages.battle_race);
                this._stats.mcRuns++;
            }

            // ─── Stage 5: HeadyBees Worker Dispatch ────────────────────────────
            stages.bee_dispatch = this._beeDispatch(task);
            this._stats.beeDispatches++;

            // ─── Stage 6: HeadySwarms Route ────────────────────────────────────
            stages.swarm_route = this._swarmRoute(task);
            this._stats.swarmRoutes++;

            // ─── Stage 7: Result Capture ───────────────────────────────────────
            const winnerOutput = stages.battle_race.winnerOutput || stages.battle_race.output || task.prompt;
            const outputHash = crypto.createHash('sha256')
                .update(JSON.stringify({ output: winnerOutput, taskId: task.id }))
                .digest('hex');
            stages.result_capture = { output: winnerOutput, outputHash };

            // ─── Stage 8: Drift Check ──────────────────────────────────────────
            if (this.confidenceGate) {
                stages.drift_check = this.confidenceGate.trackDrift(outputHash);
                if (stages.drift_check.drifting) {
                    this._stats.driftAlerts++;
                    this.emit('pipeline:drift', { pipelineId, driftScore: stages.drift_check.driftScore });
                }
            }

            // ─── Stage 9: Continuous Action Analysis ───────────────────────────
            if (this.actionAnalyzer) {
                this.actionAnalyzer.record({
                    taskId: task.id,
                    domain: task.domain || 'unknown',
                    inputHash: crypto.createHash('sha256').update(JSON.stringify(task)).digest('hex').slice(0, 16),
                    outputHash: outputHash.slice(0, 16),
                    provider: stages.battle_race.winnerProvider || 'local',
                    model: stages.battle_race.winnerModel || 'deterministic',
                    latencyMs: Date.now() - startTime,
                    confidence: stages.csl_gate?.confidence || 1.0,
                    simScore: stages.sim_preflight?.score || 1.0,
                    battleWon: !!stages.battle_race.winner,
                    mcDeterminism: stages.mc_sampling?.determinismScore || 1.0,
                });
            }

            // ─── Audit ─────────────────────────────────────────────────────────
            const result = {
                pipelineId,
                halted: false,
                taskId: task.id,
                output: winnerOutput,
                outputHash,
                stages,
                determinismMetrics: {
                    simScore: stages.sim_preflight?.score || null,
                    cslConfidence: stages.csl_gate?.confidence || null,
                    battleWinner: stages.battle_race?.winner || null,
                    mcDeterminism: stages.mc_sampling?.determinismScore || null,
                    drifting: stages.drift_check?.drifting || false,
                },
                durationMs: Date.now() - startTime,
            };

            this._audit('pipeline_complete', { pipelineId, durationMs: result.durationMs });
            this.emit('pipeline:complete', result);
            return result;

        } catch (err) {
            this._audit('pipeline_error', { pipelineId, error: err.message });
            this.emit('pipeline:error', { pipelineId, error: err });
            throw err;
        }
    }

    // ─── Stage Implementations ──────────────────────────────────────────────

    /** HeadySims: Pre-task simulation to predict success probability */
    _simPreflight(task) {
        // Factors: prompt length, variable completeness, domain alignment, keyword density
        const promptLen = (task.prompt || '').length;
        const hasKeywords = (task.keywords || []).length > 0;
        const hasDomain = !!(task.domain);
        const varCount = Object.keys(task.variables || {}).length;

        const lengthScore = Math.min(1.0, promptLen / 200);          // normalized to ~200 chars
        const keywordScore = hasKeywords ? 1.0 : 0.3;
        const domainScore = hasDomain ? 1.0 : 0.3;
        const varScore = varCount > 0 ? Math.min(1.0, varCount / 4) : 0.5;

        // Phi-weighted composite
        const score = (
            lengthScore * PSI +            // 0.618 weight
            keywordScore * PSI_SQ +        // 0.382 weight
            domainScore * (1 - PSI) +      // 0.382 weight
            varScore * (PSI_SQ * PSI)      // 0.236 weight
        ) / (PSI + PSI_SQ + (1 - PSI) + (PSI_SQ * PSI));

        const resources = {
            estimatedTokens: Math.ceil(promptLen * 1.3),
            estimatedLatencyMs: Math.ceil(promptLen * 2 + 500),
            recommendedModel: score >= PSI ? 'sonar-pro' : 'sonar',
        };

        return { score: +score.toFixed(4), resources, factors: { lengthScore, keywordScore, domainScore, varScore } };
    }

    /** HeadyBattle: Run task through arena contestants, pick winner */
    async _battleRace(task) {
        if (!this.arena) return { skipped: true, output: task.prompt };

        try {
            const summary = await this.arena.runRound({
                id: task.id || crypto.randomUUID(),
                prompt: task.prompt || 'default task',
                keywords: task.keywords || [],
                maxOutputLen: task.maxOutputLen || 500,
            });

            const winnerContestant = this.arena._contestants.get(summary.winner);
            return {
                winner: summary.winner,
                winnerOutput: summary.outputs[summary.winner] || '',
                winnerProvider: winnerContestant?.provider || 'unknown',
                winnerModel: winnerContestant?.model || 'unknown',
                finalScores: summary.finalScores,
                durationMs: summary.durationMs,
                allOutputs: summary.outputs,
            };
        } catch (err) {
            return { error: err.message, skipped: true, output: task.prompt };
        }
    }

    /** HeadyMC: Monte Carlo sampling — measure determinism across N iterations */
    _mcSampling(task, battleResult) {
        // Hash the task N times with slight perturbations to find determinism boundary
        const hashes = new Set();
        const baseInput = JSON.stringify({
            prompt: task.prompt,
            variables: task.variables,
            domain: task.domain,
        });

        for (let i = 0; i < this.mcIterations; i++) {
            // Deterministic hash: same input always → same hash
            const hash = crypto.createHash('sha256')
                .update(baseInput + `|iter=${i}|seed=42`)
                .digest('hex')
                .slice(0, 16);
            hashes.add(hash);
        }

        // Determinism score = 1 / unique_hashes (perfect = 1.0 when all same)
        const uniqueRatio = hashes.size / this.mcIterations;
        // With seed=42 deterministic hashing: each iteration produces unique hash by design
        // Real MC would call LLM N times — here we measure structural determinism
        const determinismScore = 1.0 - ((hashes.size - 1) / this.mcIterations);
        const boundary = Math.floor(this.mcIterations * PSI); // φ⁻¹ boundary

        return {
            iterations: this.mcIterations,
            uniqueHashes: hashes.size,
            determinismScore: +Math.max(0, determinismScore).toFixed(4),
            boundary,
            prediction: determinismScore >= PSI ? 'deterministic' :
                determinismScore >= PSI_SQ ? 'marginal' : 'non_deterministic',
        };
    }

    /** HeadyBees: Identify and dispatch domain-specific bee */
    _beeDispatch(task) {
        const domain = task.domain || 'general';
        const beeMap = {
            code: 'refactor-bee',
            deploy: 'deployment-bee',
            research: 'documentation-bee',
            security: 'governance-bee',
            data: 'template-bee',
            creative: 'creative-bee',
            health: 'health-bee',
            memory: 'memory-bee',
            general: 'orchestration-bee',
        };

        const bee = beeMap[domain] || beeMap.general;
        return { domain, bee, dispatched: true };
    }

    /** HeadySwarms: Route task to optimal swarm by domain */
    _swarmRoute(task) {
        const domain = task.domain || 'general';
        const swarmMap = {
            code: 'code-weaver',
            deploy: 'deploy-shepherd',
            research: 'research-herald',
            security: 'security-warden',
            data: 'data-sculptor',
            creative: 'creative-forge',
            general: 'heady-soul',
        };

        const swarm = swarmMap[domain] || swarmMap.general;
        const priority = task.priority || 40; // NORMAL

        return { targetSwarm: swarm, priority, routed: true };
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /** Get pipeline stats */
    getStats() {
        return { ...this._stats };
    }

    /** Get audit log */
    getAuditLog() {
        return this._auditLog.slice();
    }

    /** Get determinism report */
    getDeterminismReport() {
        const total = this._stats.tasksProcessed;
        const halted = this._stats.halts;
        const drifts = this._stats.driftAlerts;
        return {
            totalTasks: total,
            successRate: total > 0 ? `${((total - halted) / total * 100).toFixed(1)}%` : 'N/A',
            haltRate: total > 0 ? `${(halted / total * 100).toFixed(1)}%` : 'N/A',
            driftRate: total > 0 ? `${(drifts / total * 100).toFixed(1)}%` : 'N/A',
            phi: PHI,
            psi: PSI,
        };
    }

    // ─── Comparison Framework ───────────────────────────────────────────────

    /**
     * Compare Heady output against external output (e.g., Perplexity Computer)
     * Measures determinism divergence between two systems on the same task.
     *
     * @param {Object} headyResult - Result from this.execute()
     * @param {string} externalOutput - Output from Perplexity/other system
     * @returns {Object} Comparison metrics
     */
    compareOutputs(headyResult, externalOutput) {
        const headyHash = headyResult.outputHash;
        const externalHash = crypto.createHash('sha256')
            .update(JSON.stringify({ output: externalOutput, taskId: headyResult.taskId }))
            .digest('hex');

        const headyOutput = headyResult.output || '';

        // Jaccard similarity on word sets
        const headyWords = new Set(headyOutput.toLowerCase().split(/\W+/).filter(Boolean));
        const extWords = new Set(externalOutput.toLowerCase().split(/\W+/).filter(Boolean));
        const intersection = new Set([...headyWords].filter(w => extWords.has(w)));
        const union = new Set([...headyWords, ...extWords]);
        const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;

        // Hash match (perfect determinism)
        const hashMatch = headyHash === externalHash;

        // Length ratio
        const lengthRatio = headyOutput.length > 0 && externalOutput.length > 0
            ? Math.min(headyOutput.length, externalOutput.length) / Math.max(headyOutput.length, externalOutput.length)
            : 0;

        // Composite determinism score (phi-weighted)
        const determinismScore = (
            (hashMatch ? 1.0 : 0.0) * PSI +
            jaccardSimilarity * PSI_SQ +
            lengthRatio * (1 - PSI - PSI_SQ)
        );

        return {
            headyHash: headyHash.slice(0, 16),
            externalHash: externalHash.slice(0, 16),
            hashMatch,
            jaccardSimilarity: +jaccardSimilarity.toFixed(4),
            lengthRatio: +lengthRatio.toFixed(4),
            determinismScore: +determinismScore.toFixed(4),
            verdict: determinismScore >= PSI ? 'deterministic' :
                determinismScore >= PSI_SQ ? 'marginal_divergence' : 'non_deterministic',
            recommendation: determinismScore >= PSI ? 'Systems aligned — no action needed' :
                determinismScore >= PSI_SQ ? 'Minor divergence — review prompts for ambiguity' :
                    'Significant divergence — lock LLM params: temperature=0, seed=42, top_p=1',
        };
    }

    /** Compare two pipeline runs for self-consistency */
    comparePipelineRuns(resultA, resultB) {
        return {
            hashMatch: resultA.outputHash === resultB.outputHash,
            latencyDelta: Math.abs(resultA.durationMs - resultB.durationMs),
            confidenceDelta: Math.abs(
                (resultA.determinismMetrics.cslConfidence || 0) -
                (resultB.determinismMetrics.cslConfidence || 0)
            ),
            sameWinner: resultA.determinismMetrics.battleWinner === resultB.determinismMetrics.battleWinner,
            selfConsistent: resultA.outputHash === resultB.outputHash,
        };
    }

    // ─── Internal ───────────────────────────────────────────────────────────

    _audit(action, data) {
        this._auditLog.push({ action, data, ts: Date.now() });
        if (this._auditLog.length > 10000) this._auditLog.shift();
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    BattleSimTaskOrchestrator,
    PIPELINE_STAGES,
    PHI, PSI, PSI_SQ,
};
```

---

### `src/hcfp/task-dispatcher.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ HCFP Task Dispatcher ═══
 *
 * Classifies tasks by type and routes to the optimal sub-agent.
 * Uses service_group field from task-manifest-schema + keyword analysis.
 *
 * Sub-Agent Topology:
 *   HeadyIO         → I/O-bound tasks (file, stream, network)
 *   HeadyBot         → Automation scripting, ephemeral workers
 *   HeadyMCP         → Machine-to-machine context protocols
 *   HeadyConnection  → Persistent connections, long-lived sessions
 *   Core Platform    → Default brain orchestration
 *
 * Pipeline Tasks: buddy-dist-001, buddy-dist-003
 */

const path = require('path');
const fs = require('fs');
const { midiBus, CHANNELS } = require("../engines/midi-event-bus");
const logger = require("../utils/logger");

// ═══ Pipeline Source ═══
const PIPELINE_FILE = path.join(__dirname, '..', 'auto-flow-200-tasks.json');

// ═══ Sub-Agent Registry (Cloud-Only Endpoints) ═══
const SUB_AGENTS = {
    "heady-io": {
        name: "HeadyIO",
        endpoint: process.env.HEADY_IO_URL || "https://heady-io.headyme.com/api",
        capabilities: ["file", "stream", "network", "upload", "download", "parse"],
        keywords: ["file", "read", "write", "stream", "upload", "download", "parse", "csv", "json", "xml", "buffer", "fs"],
    },
    "heady-bot": {
        name: "HeadyBot",
        endpoint: process.env.HEADY_BOT_URL || "https://heady-bot.headyme.com/api",
        capabilities: ["automate", "script", "cron", "worker", "spawn", "parallel"],
        keywords: ["automate", "script", "cron", "schedule", "parallel", "worker", "spawn", "run", "execute", "deploy", "build"],
    },
    "heady-mcp": {
        name: "HeadyMCP",
        endpoint: process.env.HEADY_MCP_URL || "https://heady-mcp.headyme.com/api",
        capabilities: ["protocol", "m2m", "context", "bridge", "translate"],
        keywords: ["protocol", "machine", "m2m", "bridge", "translate", "context", "mcp", "middleware", "adapter"],
    },
    "heady-connection": {
        name: "HeadyConnection",
        endpoint: process.env.HEADY_CONNECTION_URL || "https://heady-connection.headyme.com/api",
        capabilities: ["persistent", "session", "websocket", "sse", "keepalive"],
        keywords: ["persistent", "session", "websocket", "sse", "keepalive", "long-running", "subscribe", "watch", "monitor"],
    },
    "heady-cloudrun": {
        name: "Cloud Run Failover",
        endpoint: process.env.HEADY_CLOUDRUN_URL || "https://heady-edge-gateway-609590223909.us-central1.run.app",
        capabilities: ["chat", "analyze", "code", "reasoning", "buddy"],
        keywords: ["failover", "cloudrun", "gcloud", "liquid", "backup"],
    },
    "heady-battle": {
        name: "HeadyBattle",
        endpoint: process.env.HEADY_BATTLE_URL || "https://heady-battle.headyme.com/api",
        capabilities: ["battle", "race", "compare", "tournament", "evaluate", "contest"],
        keywords: ["battle", "race", "compare", "tournament", "evaluate", "contest", "arena", "compete", "versus", "benchmark", "leaderboard"],
    },
    "heady-sims": {
        name: "HeadySims",
        endpoint: process.env.HEADY_SIMS_URL || "https://heady-sims.headyme.com/api",
        capabilities: ["simulate", "predict", "model", "optimize", "forecast"],
        keywords: ["simulate", "sim", "predict", "forecast", "model", "optimize", "resource", "estimate", "preflight", "pre-flight"],
    },
    "core": {
        name: "Core Platform",
        endpoint: process.env.HEADY_BRAIN_URL || "https://127.0.0.1:3301/api/brain/chat",
        capabilities: ["chat", "analyze", "code", "reasoning", "think", "generate"],
        keywords: [], // Default — catches everything else
    },
};

/**
 * Classify a task and determine the optimal sub-agent.
 *
 * @param {object} task - Task from manifest (has name, action, service_group, inputs)
 * @returns {{ agent: string, endpoint: string, reason: string }}
 */
function classify(task) {
    // Priority 1: Explicit service_group mapping
    if (task.service_group && task.service_group !== "brain") {
        const agentKey = Object.keys(SUB_AGENTS).find(key =>
            key === task.service_group ||
            SUB_AGENTS[key].name.toLowerCase() === task.service_group.toLowerCase()
        );
        if (agentKey) {
            const agent = SUB_AGENTS[agentKey];
            midiBus.agentSpawned(agent.name, CHANNELS.DISPATCHER);
            return {
                agent: agentKey,
                name: agent.name,
                endpoint: agent.endpoint,
                reason: `Explicit service_group: "${task.service_group}" → ${agent.name}`,
            };
        }
    }

    // Priority 2: Keyword matching against task name + action + inputs
    const searchText = [
        task.name || "",
        task.action || "",
        JSON.stringify(task.inputs || {}),
    ].join(" ").toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    for (const [key, agent] of Object.entries(SUB_AGENTS)) {
        if (key === "core") continue; // Skip default
        const matches = agent.keywords.filter(kw => searchText.includes(kw));
        if (matches.length > bestScore) {
            bestScore = matches.length;
            bestMatch = { key, agent, matches };
        }
    }

    if (bestMatch && bestScore >= 1) {
        midiBus.agentSpawned(bestMatch.agent.name, CHANNELS.DISPATCHER);
        return {
            agent: bestMatch.key,
            name: bestMatch.agent.name,
            endpoint: bestMatch.agent.endpoint,
            reason: `Keyword match (${bestScore} hits: ${bestMatch.matches.join(", ")}) → ${bestMatch.agent.name}`,
        };
    }

    // Fallback: Core Platform
    const core = SUB_AGENTS["core"];
    return {
        agent: "core",
        name: core.name,
        endpoint: core.endpoint,
        reason: `Default routing → Core Platform (no sub-agent keywords matched)`,
    };
}

/**
 * Classify multiple tasks and return a dispatch plan.
 *
 * @param {Array} tasks - Array of task objects
 * @returns {Array} Array of { task, dispatch } objects
 */
function createDispatchPlan(tasks) {
    return tasks.map(task => ({
        task_name: task.name,
        task_id: task.id,
        dispatch: classify(task),
    }));
}

/**
 * Get agent registry summary.
 */
function getAgentRegistry() {
    return Object.entries(SUB_AGENTS).map(([key, agent]) => ({
        key,
        name: agent.name,
        endpoint: agent.endpoint,
        capabilities: agent.capabilities,
        keyword_count: agent.keywords.length,
    }));
}

/**
 * Load the auto-flow pipeline from disk and return tasks sorted by priority.
 * @param {object} opts - { pool: 'hot'|'warm'|'cold'|'all', minWeight: 1-5, limit: number }
 * @returns {Array} Sorted task array
 */
function loadPipeline(opts = {}) {
    const pool = opts.pool || 'hot';
    const minWeight = opts.minWeight || 4;
    const limit = opts.limit || 50;

    try {
        const raw = fs.readFileSync(PIPELINE_FILE, 'utf8');
        let tasks = JSON.parse(raw);

        // Filter by pool
        if (pool !== 'all') {
            tasks = tasks.filter(t => t.pool === pool);
        }

        // Filter by minimum weight
        tasks = tasks.filter(t => (t.w || 0) >= minWeight);

        // Sort: weight desc, then by id for stability
        tasks.sort((a, b) => (b.w || 0) - (a.w || 0) || (a.id || '').localeCompare(b.id || ''));

        return tasks.slice(0, limit);
    } catch (err) {
        logger.error(`[TaskDispatcher] Pipeline load error: ${err.message}`);
        return [];
    }
}

/**
 * Create a prioritized dispatch plan from the auto-flow pipeline.
 * @param {object} opts - { pool, minWeight, limit }
 * @returns {Array} Array of { task, dispatch } objects
 */
function createPipelinePlan(opts = {}) {
    const tasks = loadPipeline(opts);
    return createDispatchPlan(tasks);
}

module.exports = { classify, createDispatchPlan, createPipelinePlan, loadPipeline, getAgentRegistry, SUB_AGENTS };
```

---

### `src/core/csl-engine/csl-engine.js`

```javascript
/**
 * @fileoverview CSL Engine — Continuous Semantic Logic
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Core innovation: vector geometry as logical gates operating in 384-dimensional
 * (or 1536-dimensional) embedding space. All logic is geometric: alignment,
 * superposition, orthogonal projection, and cosine activation.
 *
 * Mathematical Foundation:
 *   - Domain: unit vectors in ℝᴰ, D ∈ {384, 1536}
 *   - Truth value: τ(a, b) = cos(θ) = (a·b) / (‖a‖·‖b‖) ∈ [-1, +1]
 *   - +1 = fully aligned (TRUE), 0 = orthogonal (UNKNOWN), -1 = antipodal (FALSE)
 *
 * References:
 *   - Birkhoff & von Neumann (1936): "The Logic of Quantum Mechanics"
 *   - Widdows (2003): "Orthogonal Negation in Vector Spaces" — ACL 2003
 *   - Grand et al. (2022): "Semantic projection" — Nature Human Behaviour
 *   - Fagin, Riegel, Gray (2024): "Foundations of reasoning with uncertainty" — PNAS
 *
 * @module csl-engine
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL techniques
 */

import { PHI, PSI, PHI_TEMPERATURE, CSL_THRESHOLDS, phiThreshold, EPSILON as PHI_EPSILON, adaptiveTemperature } from '../../shared/phi-math.js';

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default vector dimension for standard embedding models (e.g., all-MiniLM-L6-v2) */
const DEFAULT_DIM = 384;

/** Extended dimension for high-fidelity models (e.g., text-embedding-3-large) */
const LARGE_DIM = 1536;

/** Numerical epsilon: prevents division-by-zero and detects near-zero vectors.
 * Sourced from shared/phi-math.js PHI_EPSILON (same 1e-10 value, unified constant). */
const EPSILON = PHI_EPSILON; // from shared/phi-math.js

/** Threshold below which a vector is considered near-zero (degenerate) */
const ZERO_NORM_THRESHOLD = 1e-8;

/** Default gate threshold τ for GATE operation.
 * CSL_THRESHOLDS.MINIMUM ≈ 0.500 — noise floor for geometric truth activation. */
const DEFAULT_GATE_THRESHOLD = CSL_THRESHOLDS.MINIMUM; // ≈ 0.500 (CSL noise floor)

/** Default temperature τ for soft gating / softmax operations.
 * PHI_TEMPERATURE = PSI^3 ≈ 0.236 — phi-harmonic softness. */
const DEFAULT_TEMPERATURE = PHI_TEMPERATURE; // PSI^3 ≈ 0.236

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Compute the L2 norm (Euclidean length) of a vector.
 *
 * Formula: ‖a‖ = √(Σᵢ aᵢ²)
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {number} L2 norm ≥ 0
 */
function norm(a) {
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length (project onto unit hypersphere Sᴰ⁻¹).
 *
 * Formula: â = a / ‖a‖
 *
 * Returns the zero vector if ‖a‖ < ZERO_NORM_THRESHOLD (degenerate case).
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {Float64Array} Unit vector, or zero vector if degenerate
 */
function normalize(a) {
  const n = norm(a);
  const result = new Float64Array(a.length);
  if (n < ZERO_NORM_THRESHOLD) {
    return result; // zero vector — caller should handle
  }
  const invN = 1.0 / n;
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * invN;
  }
  return result;
}

/**
 * Compute the dot product of two equal-length vectors.
 *
 * Formula: a·b = Σᵢ aᵢ·bᵢ
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {number} Scalar dot product
 * @throws {Error} If vectors have different lengths
 */
function dot(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Clamp a value to the interval [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Add two vectors element-wise and return a new Float64Array.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorAdd(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] + b[i];
  }
  return result;
}

/**
 * Subtract vector b from a element-wise.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorSub(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] - b[i];
  }
  return result;
}

/**
 * Scale a vector by a scalar.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {number} scalar
 * @returns {Float64Array}
 */
function vectorScale(a, scalar) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * scalar;
  }
  return result;
}

// ─── CSLEngine Class ──────────────────────────────────────────────────────────

/**
 * CSLEngine — Continuous Semantic Logic Engine
 *
 * Implements all CSL logical gates as pure geometric operations on high-dimensional
 * vectors. All operations work on raw (unnormalized) input vectors and handle
 * normalization internally unless otherwise noted.
 *
 * All gate methods:
 *   1. Accept Float32Array, Float64Array, or number[] inputs
 *   2. Return Float64Array for gate outputs (or number for scalar outputs)
 *   3. Include full numerical stability handling
 *   4. Support batch operation via the batch* prefix methods
 *
 * @class
 * @example
 * const engine = new CSLEngine({ dim: 384 });
 * const score = engine.AND(vectorA, vectorB);     // cosine similarity ∈ [-1,1]
 * const union = engine.OR(vectorA, vectorB);       // normalized superposition
 * const negated = engine.NOT(vectorA, vectorB);    // semantic negation
 */
class CSLEngine {
  /** Golden ratio constant — accessible on class for downstream phi-arithmetic */
  static PHI = PHI;
  /** Golden ratio conjugate (1/Φ = Φ-1) — accessible on class */
  static PSI = PSI;

  /**
   * @param {Object} [options]
   * @param {number} [options.dim=384] - Vector dimension
   * @param {number} [options.epsilon=1e-10] - Numerical stability epsilon
   * @param {number} [options.gateThreshold=0.0] - Default threshold τ for GATE
   * @param {number} [options.temperature=1.0] - Default temperature for soft gates
   * @param {boolean} [options.normalizeInputs=true] - Auto-normalize inputs
   */
  constructor(options = {}) {
    this.dim = options.dim || DEFAULT_DIM;
    this.epsilon = options.epsilon || EPSILON;
    this.gateThreshold = options.gateThreshold !== undefined
      ? options.gateThreshold
      : DEFAULT_GATE_THRESHOLD;
    this.temperature = options.temperature || DEFAULT_TEMPERATURE;
    this.normalizeInputs = options.normalizeInputs !== false;

    // Runtime statistics for monitoring
    this._stats = {
      operationCount: 0,
      degenerateVectors: 0,
      gateActivations: 0,
    };
  }

  // ─── Core Gate Operations ──────────────────────────────────────────────────

  /**
   * CSL AND — Measures semantic alignment between two concept vectors.
   *
   * Mathematical formula:
   *   AND(a, b) = cos(θ_{a,b}) = (a·b) / (‖a‖·‖b‖)
   *
   * Interpretation:
   *   - Result ∈ [-1, +1]
   *   - +1: concepts are fully aligned ("both true in the same direction")
   *   - 0:  concepts are orthogonal ("independent / no relationship")
   *   - -1: concepts are antipodal ("contradictory / one negates the other")
   *
   * Logical analogy: "a AND b is true" ↔ cos(a, b) close to +1.
   * This is the soft AND: high only when both concepts are co-aligned.
   *
   * Properties:
   *   - Commutative: AND(a,b) = AND(b,a)
   *   - Bounded: result ∈ [-1, +1]
   *   - Scale invariant: AND(λa, b) = AND(a, b) for λ > 0
   *
   * Reference: Birkhoff & von Neumann (1936), quantum logic inner product.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {number} Cosine similarity ∈ [-1, +1]
   */
  AND(a, b) {
    this._stats.operationCount++;
    const normA = norm(a);
    const normB = norm(b);

    if (normA < this.epsilon || normB < this.epsilon) {
      this._stats.degenerateVectors++;
      return 0.0; // degenerate: zero vectors are orthogonal to everything
    }

    const dotProduct = dot(a, b);
    return clamp(dotProduct / (normA * normB), -1.0, 1.0);
  }

  /**
   * CSL OR — Computes semantic superposition (soft union) of two concepts.
   *
   * Mathematical formula:
   *   OR(a, b) = normalize(a + b)
   *
   * The sum a + b creates a vector similar to both a and b — capturing the
   * "union" of semantic content. Normalization returns the result to the unit
   * sphere for subsequent operations.
   *
   * Interpretation:
   *   - The result vector points "between" a and b on the hypersphere
   *   - Its cosine similarity to both a and b is positive
   *   - For orthogonal a, b: result is at 45° to both (equal similarity)
   *   - For identical a = b: result is identical to a (idempotent in direction)
   *
   * Logical analogy: "a OR b" is the direction that captures either concept.
   *
   * Properties:
   *   - Commutative: OR(a,b) = OR(b,a)
   *   - Returns unit vector on Sᴰ⁻¹
   *   - Degenerate when a ≈ -b (antiparallel): returns zero vector
   *
   * Reference: HDC bundling operation; Boolean IR vector addition.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized superposition vector (unit length)
   */
  OR(a, b) {
    this._stats.operationCount++;
    const sum = vectorAdd(a, b);
    const n = norm(sum);

    if (n < this.epsilon) {
      this._stats.degenerateVectors++;
      // a ≈ -b: concepts cancel. Return zero vector to signal cancellation.
      return new Float64Array(a.length);
    }

    return vectorScale(sum, 1.0 / n);
  }

  /**
   * CSL NOT — Semantic negation via orthogonal projection.
   *
   * Mathematical formula:
   *   NOT(a, b) = a - proj_b(a) = a - (a·b / ‖b‖²) · b
   *
   * For unit vectors ‖b‖ = 1:
   *   NOT(a, b) = a - (a·b) · b
   *
   * The result is the component of a that is orthogonal to b — removing
   * the semantic content of b from a.
   *
   * Interpretation:
   *   - "NOT(a, b)" means "a, but not the part that overlaps with b"
   *   - Example: NOT(cat_vector, persian_vector) → cat vector minus Persian traits
   *   - The result has zero cosine similarity with b (by construction)
   *   - Residual magnitude: ‖NOT(a,b)‖ = ‖a‖·sin(θ_{a,b})
   *
   * Idempotency:
   *   NOT(NOT(a,b), b) ≈ NOT(a,b) because the result is already in b⊥.
   *   More precisely: the projection of NOT(a,b) onto b is ≈ 0, so subtracting
   *   proj_b again leaves it unchanged. (Full proof in csl-mathematical-proofs.md)
   *
   * Similarity after negation (for normalized a, b):
   *   a · NOT(a, b) = 1 - (a·b)²
   *
   * Reference: Widdows (2003), ACL 2003, "Orthogonal Negation in Vector Spaces"
   *
   * @param {Float32Array|Float64Array|number[]} a - Query/source vector
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate/remove
   * @param {boolean} [returnNormalized=true] - Whether to normalize the result
   * @returns {Float64Array} Vector with b's semantic content removed
   */
  NOT(a, b, returnNormalized = true) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      // b is near-zero: nothing to project out, return a (optionally normalized)
      return returnNormalized ? normalize(a) : new Float64Array(a);
    }

    // Projection coefficient: (a·b) / ‖b‖²
    const projCoeff = dot(a, b) / normBSq;

    // Remove projection: a - projCoeff·b
    const result = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] - projCoeff * b[i];
    }

    if (returnNormalized) {
      return normalize(result);
    }
    return result;
  }

  /**
   * CSL IMPLY — Geometric material implication via projection.
   *
   * Mathematical formula:
   *   IMPLY(a, b) = proj_b(a) = (a·b / ‖b‖²) · b
   *
   * For unit vectors:
   *   IMPLY(a, b) = (a·b) · b    [scalar times unit vector]
   *
   * The projection of a onto b captures "how much of a is contained in b" —
   * the geometric analog of material implication: degree to which a implies b.
   *
   * Interpretation:
   *   - Large projection → a strongly implies b (concepts highly co-directional)
   *   - Zero projection → a and b are independent (no implication)
   *   - Negative projection → a implies NOT b (antiparallel)
   *
   * Scalar implication strength: IMPLY_scalar(a,b) = a·b / ‖b‖ = cos(θ)·‖a‖
   *
   * Reference: Grand et al. (2022) semantic projection; Birkhoff-von Neumann.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent vector (hypothesis)
   * @param {Float32Array|Float64Array|number[]} b - Consequent vector (conclusion)
   * @returns {Float64Array} Projection of a onto span(b)
   */
  IMPLY(a, b) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      return new Float64Array(a.length); // zero consequent: no implication
    }

    const projCoeff = dot(a, b) / normBSq;
    return vectorScale(b, projCoeff);
  }

  /**
   * Scalar implication strength — returns the signed magnitude of implication.
   *
   * Formula: IMPLY_strength(a, b) = (a·b) / (‖a‖·‖b‖) = cos(θ_{a,b})
   *
   * Equivalent to AND(a, b) — the cosine similarity *is* the implication strength.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Implication strength ∈ [-1, +1]
   */
  IMPLY_scalar(a, b) {
    return this.AND(a, b);
  }

  /**
   * CSL XOR — Exclusive semantic content (symmetric difference).
   *
   * Mathematical formula:
   *   XOR(a, b) = normalize(a + b) - proj_mutual(a, b)
   *
   * More precisely, for unit vectors:
   *   XOR(a, b) = normalize( (a - proj_b(a)) + (b - proj_a(b)) )
   *             = normalize( a_⊥b + b_⊥a )
   *
   * Where a_⊥b is the component of a orthogonal to b (exclusive to a),
   * and b_⊥a is the component of b orthogonal to a (exclusive to b).
   *
   * Interpretation:
   *   - XOR captures what is unique to each concept (symmetric difference)
   *   - When a ≈ b: both exclusive components → 0, XOR → zero vector
   *   - When a ⊥ b: exclusive components = full vectors, XOR ≈ normalize(a + b)
   *   - "a XOR b" = concepts that appear in one but not both
   *
   * Properties:
   *   - Commutative: XOR(a,b) = XOR(b,a)
   *   - Anti-idempotent: XOR(a,a) → zero vector
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized exclusive semantic content
   */
  XOR(a, b) {
    this._stats.operationCount++;

    // a_⊥b: component of a orthogonal to b (NOT(a, b) unnormalized)
    const normBSq = dot(b, b);
    const normASq = dot(a, a);

    if (normASq < this.epsilon || normBSq < this.epsilon) {
      this._stats.degenerateVectors++;
      return new Float64Array(a.length);
    }

    const projAonB = dot(a, b) / normBSq;
    const projBonA = dot(a, b) / normASq; // Note: dot(b,a) = dot(a,b)

    // a_⊥b = a - proj_b(a)
    // b_⊥a = b - proj_a(b)
    const exclusive = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      const a_excl = a[i] - projAonB * b[i];
      const b_excl = b[i] - projBonA * a[i];
      exclusive[i] = a_excl + b_excl;
    }

    const n = norm(exclusive);
    if (n < this.epsilon) {
      return new Float64Array(a.length); // a ≈ b: no exclusive content
    }

    return vectorScale(exclusive, 1.0 / n);
  }

  /**
   * CSL CONSENSUS — Weighted mean of agent/concept vectors (agreement).
   *
   * Mathematical formula:
   *   CONSENSUS({aᵢ}, {wᵢ}) = normalize( Σᵢ wᵢ · aᵢ )
   *
   * Uniform weights (default):
   *   CONSENSUS({aᵢ}) = normalize( (1/n) Σᵢ aᵢ )
   *
   * Interpretation:
   *   - Result is the centroid direction on the unit hypersphere
   *   - ‖Σ wᵢaᵢ‖ before normalization measures consensus strength:
   *     → ≈ 1: strong agreement (vectors nearly aligned)
   *     → ≈ 0: strong disagreement (vectors cancel out)
   *   - Consensus Quality metric: R = ‖(1/n)Σaᵢ‖ ∈ [0,1]
   *
   * Properties:
   *   - Commutative: order of vectors doesn't matter
   *   - Weights must be non-negative (negative weights invert contribution)
   *   - Returns zero vector when agents completely disagree
   *
   * Reference: HDC bundling operation; Roundtable Policy (arXiv 2509.16839)
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors - Agent opinion vectors
   * @param {number[]} [weights] - Optional weights (uniform if omitted)
   * @returns {{ consensus: Float64Array, strength: number }}
   *   consensus: normalized consensus vector
   *   strength: R ∈ [0,1] measuring agreement level
   */
  CONSENSUS(vectors, weights = null) {
    this._stats.operationCount++;

    if (!vectors || vectors.length === 0) {
      throw new Error('CONSENSUS requires at least one vector');
    }

    const dim = vectors[0].length;
    const n = vectors.length;

    // Validate weights
    let w = weights;
    if (!w) {
      w = new Array(n).fill(1.0 / n);
    } else {
      if (w.length !== n) {
        throw new Error(`Weights length ${w.length} != vectors length ${n}`);
      }
      // Normalize weights to sum to 1
      const wSum = w.reduce((s, x) => s + x, 0);
      if (wSum < this.epsilon) {
        throw new Error('Weights must have positive sum');
      }
      w = w.map(x => x / wSum);
    }

    // Weighted sum
    const sum = new Float64Array(dim);
    for (let j = 0; j < n; j++) {
      const vec = vectors[j];
      const wj = w[j];
      for (let i = 0; i < dim; i++) {
        sum[i] += wj * vec[i];
      }
    }

    // Measure consensus strength before normalizing
    const strength = norm(sum);

    if (strength < this.epsilon) {
      this._stats.degenerateVectors++;
      return {
        consensus: new Float64Array(dim),
        strength: 0.0,
      };
    }

    const consensus = vectorScale(sum, 1.0 / strength);
    return { consensus, strength: clamp(strength, 0, 1) };
  }

  /**
   * CSL GATE — Threshold activation function using cosine similarity.
   *
   * Mathematical formula:
   *   GATE(input, gate_vector, τ) = θ( cos(input, gate_vector) - τ )
   *
   * Where θ is the Heaviside step function (hard gate) or sigmoid (soft gate):
   *   Hard:  GATE = 1  if cos(input, gate_vector) ≥ τ, else 0
   *   Soft:  GATE = σ( (cos(input, gate_vector) - τ) / temperature )
   *
   * The gate_vector defines a semantic "topic direction" in embedding space.
   * Inputs aligned with this direction (above threshold τ) pass the gate.
   *
   * Properties:
   *   - Bounded output: hard ∈ {0,1}, soft ∈ (0,1)
   *   - Scale invariant: GATE(λ·input, gate_vector, τ) = GATE(input, gate_vector, τ)
   *   - Differentiable (soft gate only)
   *   - Valid activation function: monotone, bounded, Lipschitz-continuous (soft)
   *
   * Proof that soft GATE is a valid activation function:
   *   (See csl-mathematical-proofs.md §4: CSL GATE Activation Properties)
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector to gate
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [threshold=0.0] - Threshold τ ∈ [-1, +1]
   * @param {'hard'|'soft'} [mode='hard'] - Hard (step) or soft (sigmoid) gate
   * @param {number} [temperature=1.0] - Temperature for soft gate sharpness
   * @returns {{ activation: number, cosScore: number }}
   *   activation: gate output ∈ {0,1} (hard) or (0,1) (soft)
   *   cosScore: raw cosine similarity before thresholding
   */
  GATE(input, gateVector, threshold = null, mode = 'hard', temperature = null) {
    this._stats.operationCount++;

    const tau = threshold !== null ? threshold : this.gateThreshold;
    const temp = temperature !== null ? temperature : this.temperature;

    const cosScore = this.AND(input, gateVector);
    const shifted = cosScore - tau;

    let activation;
    if (mode === 'hard') {
      activation = shifted >= 0 ? 1 : 0;
    } else {
      // Soft (sigmoid) gate: σ(x) = 1 / (1 + e^{-x/temp})
      activation = 1.0 / (1.0 + Math.exp(-shifted / temp));
    }

    if (activation > 0) this._stats.gateActivations++;

    return { activation, cosScore };
  }

  /**
   * CSL NAND — NOT AND: semantic incompatibility gate.
   *
   * Formula: NAND(a, b) = 1 - max(0, AND(a, b))
   *          Maps high alignment → low output; low alignment → high output.
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {number} NAND score ∈ [0, 1]
   */
  NAND(a, b) {
    const andScore = this.AND(a, b);
    return 1.0 - Math.max(0, andScore);
  }

  /**
   * CSL NOR — NOT OR: semantic exclusion gate.
   *
   * Returns normalized vector pointing away from the OR superposition.
   * Semantically: the concept that is distinct from both a and b.
   *
   * Formula: NOR(a,b) = normalize( -(a + b) )
   *                   = negate( OR(a, b) )
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {Float64Array} Antipodal to OR(a,b)
   */
  NOR(a, b) {
    this._stats.operationCount++;
    const orVec = this.OR(a, b);
    return vectorScale(orVec, -1.0);
  }

  // ─── Projection Utilities ──────────────────────────────────────────────────

  /**
   * Project vector a onto the subspace spanned by a set of basis vectors.
   *
   * Uses Gram-Schmidt orthogonalization for numerical stability.
   *
   * Formula: proj_B(a) = Σᵢ (a·eᵢ) eᵢ
   * where {eᵢ} is an orthonormal basis for span(B), computed via Gram-Schmidt.
   *
   * @param {Float32Array|Float64Array|number[]} a - Vector to project
   * @param {Array<Float32Array|Float64Array|number[]>} basisVectors - Spanning set
   * @returns {Float64Array} Projection of a onto span(basisVectors)
   */
  projectOntoSubspace(a, basisVectors) {
    if (!basisVectors || basisVectors.length === 0) {
      return new Float64Array(a.length);
    }

    const dim = a.length;
    // Gram-Schmidt orthogonalization of basisVectors
    const orthoBasis = [];

    for (let j = 0; j < basisVectors.length; j++) {
      let vec = new Float64Array(basisVectors[j]);

      // Remove components along existing orthobasis
      for (const e of orthoBasis) {
        const coeff = dot(vec, e);
        for (let i = 0; i < dim; i++) {
          vec[i] -= coeff * e[i];
        }
      }

      const n = norm(vec);
      if (n > this.epsilon) {
        const unitVec = vectorScale(vec, 1.0 / n);
        orthoBasis.push(unitVec);
      }
    }

    // Project a onto orthobasis
    const projection = new Float64Array(dim);
    for (const e of orthoBasis) {
      const coeff = dot(a, e);
      for (let i = 0; i < dim; i++) {
        projection[i] += coeff * e[i];
      }
    }

    return projection;
  }

  /**
   * NOT against a subspace (multiple semantic concepts removed simultaneously).
   *
   * Formula: NOT(a, B) = a - proj_B(a)
   *
   * Removes all semantic content in span{b₁,...,bₙ} from a.
   *
   * @param {Float32Array|Float64Array|number[]} a - Source vector
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Concepts to remove
   * @param {boolean} [returnNormalized=true]
   * @returns {Float64Array}
   */
  NOT_subspace(a, bVectors, returnNormalized = true) {
    this._stats.operationCount++;
    const projection = this.projectOntoSubspace(a, bVectors);
    const result = vectorSub(a, projection);
    return returnNormalized ? normalize(result) : result;
  }

  // ─── Batch Operations ──────────────────────────────────────────────────────

  /**
   * Batch AND — Compute cosine similarity of one vector against many.
   *
   * GPU-friendly: equivalent to a matrix-vector multiplication.
   * M[j] = a · B[j] / (‖a‖ · ‖B[j]‖) for each row B[j] in the matrix.
   *
   * @param {Float32Array|Float64Array|number[]} a - Query vector (1 × dim)
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Corpus vectors (n × dim)
   * @returns {Float64Array} Similarity scores (n,) ∈ [-1,+1]
   */
  batchAND(a, bVectors) {
    const normA = norm(a);
    if (normA < this.epsilon) {
      return new Float64Array(bVectors.length);
    }

    const result = new Float64Array(bVectors.length);
    for (let j = 0; j < bVectors.length; j++) {
      const normB = norm(bVectors[j]);
      if (normB < this.epsilon) {
        result[j] = 0.0;
        continue;
      }
      result[j] = clamp(dot(a, bVectors[j]) / (normA * normB), -1.0, 1.0);
    }
    return result;
  }

  /**
   * Batch NOT — Remove concept b from an array of source vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors - Source vectors
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate
   * @param {boolean} [returnNormalized=true]
   * @returns {Array<Float64Array>} Array of negated vectors
   */
  batchNOT(aVectors, b, returnNormalized = true) {
    return aVectors.map(a => this.NOT(a, b, returnNormalized));
  }

  /**
   * Batch GATE — Apply semantic gate to an array of input vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} inputs - Input vectors
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction
   * @param {number} [threshold=0.0] - Threshold τ
   * @param {'hard'|'soft'} [mode='hard']
   * @returns {Array<{ activation: number, cosScore: number }>}
   */
  batchGATE(inputs, gateVector, threshold = null, mode = 'hard') {
    return inputs.map(inp => this.GATE(inp, gateVector, threshold, mode));
  }

  /**
   * Batch IMPLY — Compute projection of each input onto the consequent.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {Array<Float64Array>} Projections
   */
  batchIMPLY(aVectors, b) {
    return aVectors.map(a => this.IMPLY(a, b));
  }

  // ─── Advanced Logical Compositions ────────────────────────────────────────

  /**
   * CSL CONDITIONAL — Soft conditional probability: P(b|a) via geometric Bayes.
   *
   * Formula: P(b|a) ≈ AND(a,b) / AND(a,a) = cos(a,b) / 1 = cos(a,b)
   *          [for normalized vectors, this reduces to AND]
   *
   * For asymmetric conditional, use the projection magnitude:
   *   P(b|a) ≈ ‖proj_b(a)‖ / ‖a‖ = |cos(a,b)|
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Conditional alignment ∈ [0, 1]
   */
  CONDITIONAL(a, b) {
    return Math.abs(this.AND(a, b));
  }

  /**
   * CSL ANALOGY — Completes an analogy: "a is to b as c is to ?"
   *
   * Formula: d = normalize( b - a + c )
   *   [vector arithmetic analogy, as in word2vec: king - man + woman ≈ queen]
   *
   * @param {Float32Array|Float64Array|number[]} a - Source concept
   * @param {Float32Array|Float64Array|number[]} b - Target concept
   * @param {Float32Array|Float64Array|number[]} c - Query concept
   * @returns {Float64Array} Analogy completion vector
   */
  ANALOGY(a, b, c) {
    this._stats.operationCount++;
    // d = normalize(b - a + c)
    const diff = vectorSub(b, a);
    const result = vectorAdd(diff, c);
    return normalize(result);
  }

  /**
   * Compute pairwise AND (cosine similarity matrix) for a set of vectors.
   *
   * Returns a symmetric matrix M where M[i][j] = cos(vectors[i], vectors[j]).
   * GPU-friendly: equivalent to normalized matrix multiplication V @ Vᵀ.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors
   * @returns {Float64Array[]} n×n cosine similarity matrix (row-major)
   */
  pairwiseAND(vectors) {
    const n = vectors.length;
    const norms = vectors.map(v => norm(v));

    // Pre-allocate n×n matrix as array of Float64Arrays
    const matrix = Array.from({ length: n }, () => new Float64Array(n));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0; // self-similarity
      for (let j = i + 1; j < n; j++) {
        const d = dot(vectors[i], vectors[j]);
        const normIJ = norms[i] * norms[j];
        const sim = normIJ < this.epsilon ? 0.0 : clamp(d / normIJ, -1.0, 1.0);
        matrix[i][j] = sim;
        matrix[j][i] = sim; // symmetric
      }
    }

    return matrix;
  }

  // ─── Statistics and Introspection ─────────────────────────────────────────

  /**
   * Retrieve runtime operation statistics.
   *
   * @returns {{ operationCount: number, degenerateVectors: number, gateActivations: number }}
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Reset runtime statistics.
   */
  resetStats() {
    this._stats = { operationCount: 0, degenerateVectors: 0, gateActivations: 0 };
  }

  // ─── Phi-Harmonic Gate Extensions ───────────────────────────────────────────────

  /**
   * Phi-harmonic GATE — uses phiThreshold(level) from phi-math.js as threshold.
   *
   * phiThreshold(level) = 1 - PSI^level * 0.5:
   *   level=1 ≈ 0.691 (CSL LOW)
   *   level=2 ≈ 0.809 (CSL MEDIUM)
   *   level=3 ≈ 0.882 (CSL HIGH)
   *
   * Provides a geometrically scaled activation threshold aligned with
   * the sacred geometry resource allocation tiers.
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [level=2] - Phi threshold level (1–4)
   * @param {'hard'|'soft'} [mode='hard'] - Gate mode
   * @returns {{ activation: number, cosScore: number, threshold: number }}
   */
  phiGATE(input, gateVector, level = 2, mode = 'hard') {
    const threshold = phiThreshold(level); // e.g. level=2 ≈ 0.809 (MEDIUM)
    const result = this.GATE(input, gateVector, threshold, mode);
    return { ...result, threshold };
  }

  /**
   * Adaptive GATE — uses adaptiveTemperature(entropy, maxEntropy) for dynamic softness.
   *
   * Temperature = PSI^(1 + 2*(1 - H/Hmax)) from phi-math.js.
   * At max entropy (uniform distribution): temperature ≈ PSI (softest).
   * At zero entropy (deterministic):       temperature ≈ PSI^3 (sharpest = PHI_TEMPERATURE).
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} entropy - Current routing entropy H (nats)
   * @param {number} maxEntropy - Maximum possible entropy Hmax = log(numExperts)
   * @returns {{ activation: number, cosScore: number, temperature: number }}
   */
  adaptiveGATE(input, gateVector, entropy, maxEntropy) {
    const temperature = adaptiveTemperature(entropy, maxEntropy);
    const result = this.GATE(input, gateVector, null, 'soft', temperature);
    return { ...result, temperature };
  }

  /**
   * Validate that a vector has the expected dimension and no NaN/Inf values.
   *
   * @param {Float32Array|Float64Array|number[]} vector
   * @param {number} [expectedDim] - Expected dimension (defaults to this.dim)
   * @returns {{ valid: boolean, issues: string[] }}
   */
  validateVector(vector, expectedDim = null) {
    const issues = [];
    const dim = expectedDim || this.dim;

    if (!vector || vector.length === 0) {
      issues.push('Vector is empty or null');
    } else {
      if (vector.length !== dim) {
        issues.push(`Dimension mismatch: got ${vector.length}, expected ${dim}`);
      }

      let hasNaN = false;
      let hasInf = false;
      for (let i = 0; i < vector.length; i++) {
        if (Number.isNaN(vector[i])) hasNaN = true;
        if (!Number.isFinite(vector[i])) hasInf = true;
      }
      if (hasNaN) issues.push('Vector contains NaN values');
      if (hasInf) issues.push('Vector contains Inf values');

      const n = norm(vector);
      if (n < ZERO_NORM_THRESHOLD) {
        issues.push('Vector is near-zero (degenerate)');
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  CSLEngine,
  // Export utility functions for external use
  norm,
  normalize,
  dot,
  clamp,
  vectorAdd,
  vectorSub,
  vectorScale,
  // Export constants
  DEFAULT_DIM,
  LARGE_DIM,
  EPSILON,
  ZERO_NORM_THRESHOLD,
};
```

---

### `src/core/csl-gates-enhanced.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Continuous Semantic Logic Gates — Enhanced ───────────────────────────────
 *
 * Patent Docket: HS-058
 * Title: SYSTEM AND METHOD FOR CONTINUOUS SEMANTIC LOGIC GATES USING GEOMETRIC
 *        OPERATIONS IN HIGH-DIMENSIONAL VECTOR SPACES
 * Applicant: Heady Systems LLC  |  Inventor: Eric Haywood
 *
 * Satisfies ALL 10 claims of HS-058.
 *
 * THE 3 UNIVERSAL VECTOR GATES:
 *   1. Resonance Gate   (Semantic AND / IF)   — cosine similarity + sigmoid
 *   2. Superposition Gate (Semantic OR / MERGE) — weighted vector fusion
 *   3. Orthogonal Gate  (Semantic NOT / REJECT) — vector subtraction
 *
 * EXTENDED OPERATIONS (Claims 4-8):
 *   4. Multi-Resonance         — score N vectors against a target (Claim 4)
 *   5. Weighted Superposition  — biased fusion with configurable α (Claim 5)
 *   6. Consensus Superposition — fuse arbitrary N vectors (Claim 6)
 *   7. Batch Orthogonal        — strip multiple reject vectors in one pass (Claim 7)
 *   8. Soft Gate               — configurable sigmoid steepness/threshold (Claim 8)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// Golden ratio constant — used throughout HeadySystems implementations
const PHI = 1.6180339887;

// ── Statistics module — Claim 9(d): tracks gate invocation counts and avg scores
const _gateStats = {
    resonance:           0,
    superposition:       0,
    orthogonal:          0,
    softGate:            0,
    totalCalls:          0,
    avgResonanceScore:   0,
    _resonanceScoreSum:  0,
    _resonanceCallCount: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// VECTOR MATH PRIMITIVES (shared by all gates)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the dot product of two vectors.
 * @param {number[]|Float32Array} a
 * @param {number[]|Float32Array} b
 * @returns {number}
 */
function dot_product(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}

/**
 * Compute the L2 norm (magnitude) of a vector.
 * @param {number[]|Float32Array} v
 * @returns {number}
 */
function norm(v) {
    let sum = 0;
    for (let i = 0; i < v.length; i++) {
        sum += v[i] * v[i];
    }
    return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length.
 * @param {number[]|Float32Array} v
 * @returns {Float32Array}
 */
function normalize(v) {
    const n = norm(v);
    if (n < 1e-10) return Float32Array.from(v);
    const res = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) {
        res[i] = v[i] / n;
    }
    return res;
}

/**
 * Cosine similarity between two N-dimensional vectors.
 * Returns a value in [-1, 1].
 * @param {number[]|Float32Array} a
 * @param {number[]|Float32Array} b
 * @returns {number}
 */
function cosine_similarity(a, b) {
    if (!a || !b || a.length === 0 || b.length === 0) return 0;
    const dot = dot_product(a, b);
    const normA = norm(a);
    const normB = norm(b);
    return dot / (normA * normB || 1e-10);
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT GATE — Continuous Activation Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soft Gate: sigmoid activation σ(x) = 1 / (1 + e^(-k(x - θ)))
 * Produces a continuous activation value between 0 and 1.
 *
 * // RTP: HS-058 Claim 8 — configurable sigmoid steepness k and threshold θ
 *
 * @param {number} score      — raw cosine similarity score
 * @param {number} threshold  — center of the sigmoid (θ), default 0.5
 * @param {number} steepness  — how sharp the transition is (k), default 20
 * @returns {number} continuous activation ∈ [0, 1]
 */
function soft_gate(score, threshold = 0.5, steepness = 20) {
    // RTP: HS-058 Claim 1(c) — sigmoid applied to similarity score
    // RTP: HS-058 Claim 8    — configurable k (steepness) and θ (threshold)
    _gateStats.softGate++;
    _gateStats.totalCalls++;
    return 1.0 / (1.0 + Math.exp(-steepness * (score - threshold)));
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 1: RESONANCE GATE  (Semantic IF / AND)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resonance Gate: measures cosine similarity between two N≥128 dimensional
 * vectors and applies sigmoid activation.
 *
 * // RTP: HS-058 Claim 1 — receives two N≥128-dim vectors, computes cosine
 * //                        similarity, applies sigmoid, returns structured result.
 *
 * @param {number[]|Float32Array} vec_a     — first embedding vector (N ≥ 128 dims)
 * @param {number[]|Float32Array} vec_b     — second embedding vector (N ≥ 128 dims)
 * @param {number}                threshold — sigmoid center θ (default 0.5)
 * @param {number}                steepness — sigmoid slope k (default 20)
 * @returns {{ score: number, activation: number, open: boolean }}
 */
function resonance_gate(vec_a, vec_b, threshold = 0.5, steepness = 20) {
    // RTP: HS-058 Claim 1(a) — receive two N-dimensional embedding vectors
    if (!vec_a || !vec_b) throw new Error('resonance_gate: both vectors required');

    // RTP: HS-058 Claim 1(b) — compute continuous alignment score via cosine similarity
    const score = cosine_similarity(vec_a, vec_b);

    // RTP: HS-058 Claim 1(c) — apply sigmoid activation function
    // RTP: HS-058 Claim 8    — sigmoid uses configurable steepness and threshold
    const activation = soft_gate(score, threshold, steepness);

    _gateStats.resonance++;
    _gateStats.totalCalls++;
    _gateStats._resonanceScoreSum += score;
    _gateStats._resonanceCallCount++;
    _gateStats.avgResonanceScore = _gateStats._resonanceScoreSum / _gateStats._resonanceCallCount;

    // RTP: HS-058 Claim 1(d) — return activation value and score as structured gate result
    return {
        score:      +score.toFixed(6),
        activation: +activation.toFixed(6),
        open:       activation >= 0.5,
        threshold,
        steepness,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 1 EXTENSION: MULTI-RESONANCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multi-Resonance: scores a plurality of candidate vectors against a single
 * target simultaneously and returns a sorted array of results.
 *
 * // RTP: HS-058 Claim 4 — scores multiple candidates against single target,
 * //                        returns sorted array of alignment scores and activations.
 *
 * @param {number[]|Float32Array}            target     — reference vector
 * @param {Array<number[]|Float32Array>}     candidates — vectors to score
 * @param {number}                           threshold  — sigmoid threshold
 * @param {number}                           steepness  — sigmoid steepness
 * @returns {Array<{ index: number, score: number, activation: number, open: boolean }>}
 */
function multi_resonance(target, candidates, threshold = 0.5, steepness = 20) {
    // RTP: HS-058 Claim 4 — score plurality of candidate vectors simultaneously
    if (!Array.isArray(candidates) || candidates.length === 0) return [];

    return candidates
        .map((c, i) => {
            const score = cosine_similarity(target, c);
            const activation = soft_gate(score, threshold, steepness);
            _gateStats.resonance++;
            _gateStats.totalCalls++;
            _gateStats._resonanceScoreSum += score;
            _gateStats._resonanceCallCount++;
            return {
                index:      i,
                score:      +score.toFixed(6),
                activation: +activation.toFixed(6),
                open:       activation >= 0.5,
            };
        })
        // RTP: HS-058 Claim 4 — return SORTED array (descending by score)
        .sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 2: SUPERPOSITION GATE  (Semantic OR / MERGE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Superposition Gate: fuses two concept vectors into a normalized hybrid vector.
 * Basic (equal-weight) form: S(A, B) = normalize(A + B)
 *
 * // RTP: HS-058 Claim 2 — receives plurality of vectors, computes weighted sum,
 * //                        normalizes, returns unit vector as new hybrid concept.
 *
 * @param {number[]|Float32Array} vec_a — concept A
 * @param {number[]|Float32Array} vec_b — concept B
 * @returns {Float32Array} normalized hybrid concept vector
 */
function superposition_gate(vec_a, vec_b) {
    // RTP: HS-058 Claim 2(a) — receive plurality of embedding vectors
    const len = vec_a.length;
    const hybrid = new Float32Array(len);
    // RTP: HS-058 Claim 2(b) — compute weighted sum (equal weight = 0.5 each)
    for (let i = 0; i < len; i++) {
        hybrid[i] = vec_a[i] + vec_b[i];
    }
    _gateStats.superposition++;
    _gateStats.totalCalls++;
    // RTP: HS-058 Claim 2(c) — normalize result to unit vector
    // RTP: HS-058 Claim 2(d) — return unit vector as new hybrid semantic concept
    return normalize(hybrid);
}

/**
 * Weighted Superposition: biased fusion with configurable α.
 * S(A, B, α) = normalize(α·A + (1−α)·B)
 *
 * // RTP: HS-058 Claim 5 — α ∈ [0,1]; α=1.0 returns A; α=0.0 returns B.
 *
 * @param {number[]|Float32Array} vec_a  — concept A
 * @param {number[]|Float32Array} vec_b  — concept B
 * @param {number}                alpha  — weight for vec_a ∈ [0.0, 1.0]
 * @returns {Float32Array} normalized weighted hybrid vector
 */
function weighted_superposition(vec_a, vec_b, alpha = 0.5) {
    // RTP: HS-058 Claim 5 — alpha ∈ [0.0,1.0]; (1-alpha) applied to vec_b
    if (alpha < 0 || alpha > 1) throw new Error('weighted_superposition: alpha must be in [0, 1]');
    const beta = 1.0 - alpha;
    const len = vec_a.length;
    const hybrid = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        hybrid[i] = alpha * vec_a[i] + beta * vec_b[i];
    }
    _gateStats.superposition++;
    _gateStats.totalCalls++;
    return normalize(hybrid);
}

/**
 * Consensus Superposition: fuses an arbitrary number of vectors into a single
 * normalized consensus vector using sum + normalize.
 *
 * // RTP: HS-058 Claim 6 — fuses arbitrary N vectors via sum + normalize.
 *
 * @param {Array<number[]|Float32Array>} vectors — vectors to fuse
 * @returns {Float32Array} normalized consensus vector
 */
function consensus_superposition(vectors) {
    // RTP: HS-058 Claim 6 — arbitrary number of vectors, sum all, normalize result
    if (!vectors || vectors.length === 0) return new Float32Array(0);
    const len = vectors[0].length;
    const fused = new Float32Array(len);
    for (const v of vectors) {
        for (let i = 0; i < len; i++) {
            fused[i] += v[i];
        }
    }
    _gateStats.superposition++;
    _gateStats.totalCalls++;
    return normalize(fused);
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 3: ORTHOGONAL GATE  (Semantic NOT / REJECT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orthogonal Gate: removes a semantic concept from a target vector by
 * projecting the target onto the orthogonal complement of the rejection vector.
 * O(T, L) = normalize(T − ((T·L)/(L·L))·L)
 *
 * // RTP: HS-058 Claim 3 — receives target + rejection vectors, projects target
 * //                        onto orthogonal complement, returns purified unit vector.
 *
 * @param {number[]|Float32Array} target_vec  — base intent vector
 * @param {number[]|Float32Array} reject_vec  — concept to remove
 * @returns {Float32Array} purified orthogonal unit vector
 */
function orthogonal_gate(target_vec, reject_vec) {
    // RTP: HS-058 Claim 3(a) — receive target vector and rejection vector
    const len = target_vec.length;
    const dotTR = dot_product(target_vec, reject_vec);
    const dotRR = dot_product(reject_vec, reject_vec);
    const projectionFactor = dotTR / (dotRR || 1e-10);

    // RTP: HS-058 Claim 3(b) — project target onto each rejection, subtract projections
    const result = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        result[i] = target_vec[i] - projectionFactor * reject_vec[i];
    }
    _gateStats.orthogonal++;
    _gateStats.totalCalls++;
    // RTP: HS-058 Claim 3(c) — normalize to produce purified unit vector
    // RTP: HS-058 Claim 3(d) — return purified vector
    return normalize(result);
}

/**
 * Batch Orthogonal: iteratively removes multiple rejection vectors from the
 * target in a single pass.
 *
 * // RTP: HS-058 Claim 7 — iteratively removes multiple rejection vectors in a single pass.
 *
 * @param {number[]|Float32Array}        target_vec  — base intent vector
 * @param {Array<number[]|Float32Array>} reject_vecs — concepts to strip out
 * @returns {Float32Array} purified vector with all rejections removed
 */
function batch_orthogonal(target_vec, reject_vecs) {
    // RTP: HS-058 Claim 7 — single pass through all rejection vectors
    let current = Float32Array.from(target_vec);
    for (const reject of reject_vecs) {
        const dotTR = dot_product(current, reject);
        const dotRR = dot_product(reject, reject);
        const factor = dotTR / (dotRR || 1e-10);
        for (let i = 0; i < current.length; i++) {
            current[i] -= factor * reject[i];
        }
    }
    _gateStats.orthogonal++;
    _gateStats.totalCalls++;
    return normalize(current);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS MODULE — Claim 9(d)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return a snapshot of gate invocation counts and average scores.
 *
 * // RTP: HS-058 Claim 9(d) — statistics module tracking gate invocation counts
 * //                            and average scores.
 * @returns {object}
 */
function getStats() {
    // RTP: HS-058 Claim 9(d)
    return {
        resonance:         _gateStats.resonance,
        superposition:     _gateStats.superposition,
        orthogonal:        _gateStats.orthogonal,
        softGate:          _gateStats.softGate,
        totalCalls:        _gateStats.totalCalls,
        avgResonanceScore: _gateStats._resonanceCallCount > 0
            ? +(_gateStats._resonanceScoreSum / _gateStats._resonanceCallCount).toFixed(6)
            : 0,
    };
}

/**
 * Reset all statistics counters.
 */
function resetStats() {
    _gateStats.resonance           = 0;
    _gateStats.superposition       = 0;
    _gateStats.orthogonal          = 0;
    _gateStats.softGate            = 0;
    _gateStats.totalCalls          = 0;
    _gateStats.avgResonanceScore   = 0;
    _gateStats._resonanceScoreSum  = 0;
    _gateStats._resonanceCallCount = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL CSL SYSTEM — Claim 9: complete system exposing all gates + stats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSLSystem: the full Continuous Semantic Logic system as a single object.
 *
 * // RTP: HS-058 Claim 9  — system with Resonance Gate module, Superposition Gate
 * //                         module, Orthogonal Gate module, statistics module, and
 * //                         API layer (see csl-routes.js).
 * // RTP: HS-058 Claim 10 — replaces all discrete boolean logic in vector memory
 * //                         subsystem, hybrid search subsystem, and self-healing
 * //                         attestation mesh with continuous geometric operations.
 */
class CSLSystem {

    constructor(opts = {}) {
        // RTP: HS-058 Claim 8 — configurable sigmoid steepness and threshold
        this.defaultThreshold = opts.threshold !== undefined ? opts.threshold : 0.5;
        this.defaultSteepness = opts.steepness !== undefined ? opts.steepness : 20;
    }

    // ── Resonance Gate module (Claim 9a) ───────────────────────────────────

    /**
     * Resonance Gate — Claim 1 core method.
     * // RTP: HS-058 Claim 1
     */
    resonance(vec_a, vec_b, threshold, steepness) {
        // RTP: HS-058 Claim 1
        return resonance_gate(
            vec_a,
            vec_b,
            threshold !== undefined ? threshold : this.defaultThreshold,
            steepness !== undefined ? steepness : this.defaultSteepness,
        );
    }

    /**
     * Multi-Resonance — Claim 4 extension.
     * // RTP: HS-058 Claim 4
     */
    multiResonance(target, candidates, threshold, steepness) {
        // RTP: HS-058 Claim 4
        return multi_resonance(
            target,
            candidates,
            threshold !== undefined ? threshold : this.defaultThreshold,
            steepness !== undefined ? steepness : this.defaultSteepness,
        );
    }

    // ── Superposition Gate module (Claim 9b) ───────────────────────────────

    /**
     * Superposition Gate — Claim 2 core method.
     * // RTP: HS-058 Claim 2
     */
    superposition(vec_a, vec_b) {
        // RTP: HS-058 Claim 2
        return superposition_gate(vec_a, vec_b);
    }

    /**
     * Weighted Superposition — Claim 5 configurable alpha.
     * // RTP: HS-058 Claim 5
     */
    weightedSuperposition(vec_a, vec_b, alpha = 0.5) {
        // RTP: HS-058 Claim 5
        return weighted_superposition(vec_a, vec_b, alpha);
    }

    /**
     * Consensus Superposition — Claim 6 arbitrary N vectors.
     * // RTP: HS-058 Claim 6
     */
    consensusSuperposition(vectors) {
        // RTP: HS-058 Claim 6
        return consensus_superposition(vectors);
    }

    // ── Orthogonal Gate module (Claim 9c) ──────────────────────────────────

    /**
     * Orthogonal Gate — Claim 3 core method.
     * // RTP: HS-058 Claim 3
     */
    orthogonal(target_vec, reject_vec) {
        // RTP: HS-058 Claim 3
        return orthogonal_gate(target_vec, reject_vec);
    }

    /**
     * Batch Orthogonal — Claim 7 multi-rejection single pass.
     * // RTP: HS-058 Claim 7
     */
    batchOrthogonal(target_vec, reject_vecs) {
        // RTP: HS-058 Claim 7
        return batch_orthogonal(target_vec, reject_vecs);
    }

    // ── Soft Gate (sigmoid) — Claim 8 ─────────────────────────────────────

    /**
     * Soft Gate with configurable steepness and threshold.
     * // RTP: HS-058 Claim 8
     */
    softGate(score, threshold, steepness) {
        // RTP: HS-058 Claim 8
        return soft_gate(
            score,
            threshold !== undefined ? threshold : this.defaultThreshold,
            steepness !== undefined ? steepness : this.defaultSteepness,
        );
    }

    // ── Statistics module — Claim 9(d) ────────────────────────────────────

    /**
     * Get gate invocation counts and average scores.
     * // RTP: HS-058 Claim 9(d)
     */
    getStats() {
        // RTP: HS-058 Claim 9(d)
        return getStats();
    }

    resetStats() {
        resetStats();
    }

    // ── Integration Replacement Points — Claim 10 ─────────────────────────

    /**
     * Vector Memory Density Gate: replaces boolean deduplication.
     * Returns continuous alignment — downstream decides with soft threshold.
     *
     * // RTP: HS-058 Claim 10 — replacement integration point: vector memory subsystem
     *
     * @param {number[]|Float32Array} newMemoryVec    — incoming memory embedding
     * @param {number[]|Float32Array} existingMemVec  — candidate existing memory
     * @param {number}               threshold        — deduplication threshold
     * @returns {{ isDuplicate: boolean, score: number, activation: number }}
     */
    vectorMemoryDensityGate(newMemoryVec, existingMemVec, threshold = 0.92) {
        // RTP: HS-058 Claim 10 — replaces discrete boolean deduplication
        const result = this.resonance(newMemoryVec, existingMemVec, threshold);
        return {
            isDuplicate: result.open,
            score:       result.score,
            activation:  result.activation,
        };
    }

    /**
     * Hybrid Search Score: replaces boolean similarity cutoffs.
     * Returns continuous relevance score.
     *
     * // RTP: HS-058 Claim 10 — replacement integration point: hybrid search subsystem
     *
     * @param {number[]|Float32Array}        queryVec    — query embedding
     * @param {Array<number[]|Float32Array>} docVecs     — document embeddings
     * @param {number}                       threshold   — relevance threshold
     * @returns {Array<{ index: number, score: number, activation: number, open: boolean }>}
     */
    hybridSearchScore(queryVec, docVecs, threshold = 0.5) {
        // RTP: HS-058 Claim 10 — replaces discrete cutoff in hybrid search
        return this.multiResonance(queryVec, docVecs, threshold);
    }

    /**
     * Hallucination Detection: replaces boolean confidence threshold.
     * Returns continuous alignment of agent output against mesh consensus.
     *
     * // RTP: HS-058 Claim 10 — replacement integration point: self-healing attestation mesh
     *
     * @param {number[]|Float32Array} agentOutputVec  — agent output embedding
     * @param {number[]|Float32Array} consensusVec    — mesh consensus vector
     * @param {number}               threshold        — hallucination threshold
     * @returns {{ score: number, activation: number, hallucinated: boolean }}
     */
    hallucinationDetectionGate(agentOutputVec, consensusVec, threshold = 0.7) {
        // RTP: HS-058 Claim 10 — replaces discrete hallucination detection in mesh
        const result = this.resonance(agentOutputVec, consensusVec, threshold);
        return {
            score:        result.score,
            activation:   result.activation,
            hallucinated: !result.open,
        };
    }

    // ── Shared math utilities (exposed for external callers) ───────────────

    cosineSimilarity(a, b) { return cosine_similarity(a, b); }
    dotProduct(a, b)       { return dot_product(a, b); }
    normalize(v)           { return normalize(v); }
    norm(v)                { return norm(v); }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    PHI,

    // Primitive math
    dot_product,
    norm,
    normalize,
    cosine_similarity,

    // Individual gate functions (functional API)
    soft_gate,
    resonance_gate,
    multi_resonance,
    superposition_gate,
    weighted_superposition,
    consensus_superposition,
    orthogonal_gate,
    batch_orthogonal,

    // Stats
    getStats,
    resetStats,

    // Full system class (OOP API)
    CSLSystem,

    // Convenience default instance with production defaults
    // RTP: HS-058 Claim 9 — instantiated full system
    defaultCSL: new CSLSystem({ threshold: 0.5, steepness: 20 }),
};
```

---

### `src/shared/sacred-geometry.js`

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Sacred Geometry — shared/sacred-geometry.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Orchestration topology, node placement rings, coherence scoring,
 * Fibonacci resource allocation, and UI aesthetic constants.
 *
 * Every node, agent, and UI element follows geometric principles derived from φ.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { PHI, PSI, CSL_THRESHOLDS, fib, phiFusionWeights, poolAllocation } = require('./phi-math');
const { cslAND, normalize, add } = require('./csl-engine');

// ─── Node Topology ───────────────────────────────────────────────────────────

/**
 * Geometric ring topology for the 20 AI nodes.
 * Central → Inner → Middle → Outer → Governance
 */
const NODE_RINGS = Object.freeze({
  CENTRAL: {
    radius: 0,
    nodes: ['HeadySoul'],
    role: 'Awareness and values layer — origin point',
  },
  INNER: {
    radius: 1,
    nodes: ['HeadyBrains', 'HeadyConductor', 'HeadyVinci'],
    role: 'Processing core — orchestration, reasoning, planning',
  },
  MIDDLE: {
    radius: PHI,
    nodes: ['JULES', 'BUILDER', 'ATLAS', 'NOVA', 'HeadyLens', 'StoryDriver'],
    role: 'Execution layer — coding, building, monitoring, documentation',
  },
  OUTER: {
    radius: PHI * PHI,
    nodes: ['HeadyScientist', 'HeadyMC', 'PatternRecognition', 'SelfCritique',
            'SASHA', 'Imagination', 'HCSupervisor', 'HCBrain'],
    role: 'Specialized capabilities — research, simulation, creativity, supervision',
  },
  GOVERNANCE: {
    radius: PHI * PHI * PHI,
    nodes: ['HeadyQA', 'HeadyCheck', 'HeadyRisk'],
    role: 'Quality, assurance, risk — governance shell',
  },
});

/**
 * All 20 node names in canonical order (center-out).
 */
const ALL_NODES = Object.freeze(
  Object.values(NODE_RINGS).flatMap(ring => ring.nodes)
);

/**
 * Lookup which ring a node belongs to.
 * @param {string} nodeName
 * @returns {string|null} Ring name or null
 */
function nodeRing(nodeName) {
  for (const [ringName, ring] of Object.entries(NODE_RINGS)) {
    if (ring.nodes.includes(nodeName)) return ringName;
  }
  return null;
}

/**
 * Geometric distance between two nodes based on ring positions.
 * Nodes in the same ring have distance = ring angular separation.
 * Nodes in different rings have distance = ring radius difference.
 * @param {string} nodeA
 * @param {string} nodeB
 * @returns {number}
 */
function nodeDistance(nodeA, nodeB) {
  const ringA = nodeRing(nodeA);
  const ringB = nodeRing(nodeB);
  if (!ringA || !ringB) return Infinity;

  const rA = NODE_RINGS[ringA];
  const rB = NODE_RINGS[ringB];

  if (ringA === ringB) {
    // Same ring: angular distance based on position index
    const idxA = rA.nodes.indexOf(nodeA);
    const idxB = rA.nodes.indexOf(nodeB);
    const angularDist = Math.abs(idxA - idxB) / rA.nodes.length;
    return rA.radius * angularDist * 2 * Math.PI / rA.nodes.length;
  }

  // Different rings: radius difference + minimal angular correction
  return Math.abs(rA.radius - rB.radius);
}

// ─── Coherence Scoring ───────────────────────────────────────────────────────

const COHERENCE_THRESHOLDS = Object.freeze({
  HEALTHY:   CSL_THRESHOLDS.HIGH,     // ≈ 0.882 — normal operating range
  WARNING:   CSL_THRESHOLDS.MEDIUM,   // ≈ 0.809 — slight drift
  DEGRADED:  CSL_THRESHOLDS.LOW,      // ≈ 0.691 — significant drift
  CRITICAL:  CSL_THRESHOLDS.MINIMUM,  // ≈ 0.500 — system integrity at risk
});

/**
 * Compute coherence between two node state embeddings.
 * @param {Float64Array|number[]} stateA
 * @param {Float64Array|number[]} stateB
 * @returns {{ score: number, status: string }}
 */
function coherenceScore(stateA, stateB) {
  const score = cslAND(stateA, stateB);
  let status;
  if (score >= COHERENCE_THRESHOLDS.HEALTHY)   status = 'HEALTHY';
  else if (score >= COHERENCE_THRESHOLDS.WARNING)   status = 'WARNING';
  else if (score >= COHERENCE_THRESHOLDS.DEGRADED)  status = 'DEGRADED';
  else status = 'CRITICAL';
  return { score, status };
}

/**
 * Compute system-wide coherence by averaging all pairwise node scores.
 * @param {Map<string, Float64Array|number[]>} nodeStates - Map of node name → state vector
 * @returns {{ overall: number, status: string, drifted: string[] }}
 */
function systemCoherence(nodeStates) {
  const nodes = Array.from(nodeStates.keys());
  const drifted = [];
  let totalScore = 0;
  let pairCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const { score, status } = coherenceScore(
        nodeStates.get(nodes[i]),
        nodeStates.get(nodes[j])
      );
      totalScore += score;
      pairCount++;
      if (status === 'CRITICAL' || status === 'DEGRADED') {
        drifted.push(`${nodes[i]}<->${nodes[j]} (${score.toFixed(3)} ${status})`);
      }
    }
  }

  const overall = pairCount > 0 ? totalScore / pairCount : 0;
  let status;
  if (overall >= COHERENCE_THRESHOLDS.HEALTHY)  status = 'HEALTHY';
  else if (overall >= COHERENCE_THRESHOLDS.WARNING)  status = 'WARNING';
  else if (overall >= COHERENCE_THRESHOLDS.DEGRADED) status = 'DEGRADED';
  else status = 'CRITICAL';

  return { overall, status, drifted };
}

// ─── Pool Scheduling ─────────────────────────────────────────────────────────

/**
 * Hot/Warm/Cold pool definitions with Fibonacci resource ratios.
 */
const POOL_CONFIG = Object.freeze({
  HOT: {
    name: 'hot',
    purpose: 'User-facing, latency-critical tasks',
    resourcePct: fib(9),   // 34%
    maxConcurrency: fib(8), // 21
    timeoutMs: 5000,
    priority: 0,
  },
  WARM: {
    name: 'warm',
    purpose: 'Background processing, non-urgent tasks',
    resourcePct: fib(8),   // 21%
    maxConcurrency: fib(7), // 13
    timeoutMs: 30000,
    priority: 1,
  },
  COLD: {
    name: 'cold',
    purpose: 'Ingestion, analytics, batch processing',
    resourcePct: fib(7),   // 13%
    maxConcurrency: fib(6), // 8
    timeoutMs: 120000,
    priority: 2,
  },
  RESERVE: {
    name: 'reserve',
    purpose: 'Burst capacity for overload conditions',
    resourcePct: fib(6),   // 8%
    maxConcurrency: fib(5), // 5
    timeoutMs: 60000,
    priority: 3,
  },
  GOVERNANCE: {
    name: 'governance',
    purpose: 'Health checks, auditing, compliance',
    resourcePct: fib(5),   // 5%
    maxConcurrency: fib(4), // 3
    timeoutMs: 10000,
    priority: 4,
  },
});

/**
 * Assign a task to the appropriate pool based on priority and type.
 * @param {object} task
 * @param {string} task.type - 'user-facing' | 'background' | 'batch' | 'burst' | 'governance'
 * @param {number} [task.urgency=0.5] - 0–1 urgency score
 * @returns {string} Pool name
 */
function assignPool(task) {
  const urgency = task.urgency || 0.5;
  switch (task.type) {
    case 'user-facing': return 'HOT';
    case 'governance':  return 'GOVERNANCE';
    case 'burst':       return 'RESERVE';
    case 'batch':       return 'COLD';
    case 'background':
      return urgency >= CSL_THRESHOLDS.MEDIUM ? 'WARM' : 'COLD';
    default:
      return urgency >= CSL_THRESHOLDS.HIGH ? 'HOT' : 'WARM';
  }
}

// ─── UI Aesthetic Constants ──────────────────────────────────────────────────

const UI = Object.freeze({
  // Typography scale: φ-based
  TYPE_SCALE: {
    xs:    Math.round(16 / PHI / PHI),  // ≈ 6
    sm:    Math.round(16 / PHI),        // ≈ 10
    base:  16,
    lg:    Math.round(16 * PHI),        // ≈ 26
    xl:    Math.round(16 * PHI * PHI),  // ≈ 42
    '2xl': Math.round(16 * PHI * PHI * PHI), // ≈ 68
  },

  // Fibonacci spacing (px)
  SPACING: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89],

  // Layout ratios
  LAYOUT: {
    primaryWidth:   `${(PSI * 100).toFixed(2)}%`,      // ≈ 61.80%
    secondaryWidth: `${((1 - PSI) * 100).toFixed(2)}%`, // ≈ 38.20%
    goldenSection:  PSI,
  },

  // Color harmony: golden angle ≈ 137.508° for complementary hues
  GOLDEN_ANGLE: 360 / (PHI * PHI), // ≈ 137.508°

  // Brand colors
  COLORS: {
    primary:    '#6C63FF', // Heady Purple
    secondary:  '#FF6584', // Accent Pink
    success:    '#00C9A7', // Sacred Green
    warning:    '#FFB800', // Gold
    danger:     '#FF4757', // Alert Red
    background: '#0F0E17', // Deep Space
    surface:    '#1A1928', // Card Surface
    text:       '#FFFFFE', // Pure White
    muted:      '#94A1B2', // Muted
  },

  // Animation timing (phi-based easing)
  TIMING: {
    instant:  fib(4) * 10,  // 30ms
    fast:     fib(5) * 10,  // 50ms
    normal:   fib(7) * 10,  // 130ms
    slow:     fib(8) * 10,  // 210ms
    glacial:  fib(9) * 10,  // 340ms
  },
});

// ─── Bee Worker Limits ───────────────────────────────────────────────────────

const BEE_LIMITS = Object.freeze({
  maxConcurrentBees:  fib(8),  // 21
  maxQueueDepth:      fib(13), // 233
  beeTimeoutMs:       fib(9) * 1000, // 34 seconds
  maxRetries:         fib(5),  // 5
  healthCheckIntervalMs: fib(7) * 1000, // 13 seconds
  registryCapacity:   fib(10), // 55 registered bee types
});

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Topology
  NODE_RINGS, ALL_NODES, nodeRing, nodeDistance,

  // Coherence
  COHERENCE_THRESHOLDS, coherenceScore, systemCoherence,

  // Pool scheduling
  POOL_CONFIG, assignPool, poolAllocation,

  // UI aesthetics
  UI,

  // Bee limits
  BEE_LIMITS,
};
```

---

### `src/analytics/continuous-action-analyzer.js`

```javascript
/**
 * Continuous Action Analyzer
 *
 * Tracks every task execution, user action, and environmental parameter
 * to learn deterministic patterns and enforce them.
 *
 * Features:
 *   - Rolling window of action vectors for drift/pattern detection
 *   - Phi-scaled thresholds trigger auto-reconfig when determinism degrades
 *   - Learns optimal LLM params from execution history
 *   - Emits action:learned / action:drift / action:reconfig events
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

const PHI = 1.6180339887;
const PSI = 1 / PHI;
const PSI_SQ = PSI * PSI;

const WINDOW_SIZE = 50;          // rolling window for pattern detection
const DRIFT_THRESHOLD = PSI_SQ;  // 0.382 — alert when uniqueness exceeds this
const LEARN_THRESHOLD = 10;      // min actions before learning kicks in

class ContinuousActionAnalyzer extends EventEmitter {

    constructor(opts = {}) {
        super();
        this._windowSize = opts.windowSize || WINDOW_SIZE;
        this._actions = [];            // rolling window of action records
        this._allActions = [];         // full history (capped at 10k)
        this._patterns = new Map();    // domain → learned pattern
        this._driftWindow = [];        // rolling output hash window
        this._stats = {
            totalActions: 0,
            learnedPatterns: 0,
            driftAlerts: 0,
            reconfigs: 0,
            avgConfidence: 0,
            avgLatency: 0,
        };
    }

    /**
     * Record a task execution action.
     * @param {Object} action - { taskId, domain, inputHash, outputHash, provider, model, latencyMs, confidence, simScore, battleWon, mcDeterminism }
     */
    record(action) {
        const entry = {
            ...action,
            ts: Date.now(),
            actionHash: crypto.createHash('sha256')
                .update(JSON.stringify(action))
                .digest('hex').slice(0, 16),
        };

        this._actions.push(entry);
        if (this._actions.length > this._windowSize) this._actions.shift();

        this._allActions.push(entry);
        if (this._allActions.length > 10000) this._allActions.shift();

        this._stats.totalActions++;
        this._updateRunningStats(entry);

        // Check drift
        this._driftWindow.push(entry.outputHash);
        if (this._driftWindow.length > this._windowSize) this._driftWindow.shift();
        const driftResult = this._checkDrift();
        if (driftResult.drifting) {
            this._stats.driftAlerts++;
            this.emit('action:drift', { entry, ...driftResult });
        }

        // Learn patterns after threshold
        if (this._actions.length >= LEARN_THRESHOLD) {
            this._learnPatterns();
        }

        this.emit('action:recorded', entry);
        return entry;
    }

    /**
     * Record a user action (click, navigation, input, etc.)
     * @param {Object} userAction - { type, target, value, sessionId }
     */
    recordUserAction(userAction) {
        return this.record({
            taskId: `user-${userAction.type}`,
            domain: 'user-interaction',
            inputHash: crypto.createHash('sha256').update(JSON.stringify(userAction)).digest('hex').slice(0, 16),
            outputHash: 'user-action',
            provider: 'user',
            model: 'human',
            latencyMs: 0,
            confidence: 1.0,
            simScore: 1.0,
            battleWon: true,
            mcDeterminism: 1.0,
            ...userAction,
        });
    }

    /**
     * Record an environmental parameter change.
     * @param {Object} envParam - { key, value, previousValue, source }
     */
    recordEnvironmental(envParam) {
        return this.record({
            taskId: `env-${envParam.key}`,
            domain: 'environmental',
            inputHash: crypto.createHash('sha256').update(`${envParam.key}=${envParam.value}`).digest('hex').slice(0, 16),
            outputHash: crypto.createHash('sha256').update(String(envParam.value)).digest('hex').slice(0, 16),
            provider: envParam.source || 'system',
            model: 'env',
            latencyMs: 0,
            confidence: 1.0,
            simScore: 1.0,
            battleWon: true,
            mcDeterminism: 1.0,
            ...envParam,
        });
    }

    // ─── Drift Detection ──────────────────────────────────────────────────

    _checkDrift() {
        if (this._driftWindow.length < 5) {
            return { drifting: false, driftScore: 0, prediction: 'insufficient_data' };
        }

        const unique = new Set(this._driftWindow).size;
        const driftScore = (unique - 1) / (this._driftWindow.length - 1);

        const drifting = driftScore > DRIFT_THRESHOLD;
        const prediction = driftScore === 0 ? 'perfectly_deterministic' :
            driftScore <= PSI_SQ ? 'stable' :
                driftScore <= PSI ? 'moderate_drift' : 'severe_drift';

        if (drifting) {
            const reconfig = this._generateReconfig(driftScore);
            this._stats.reconfigs++;
            this.emit('action:reconfig', reconfig);
        }

        return { drifting, driftScore: +driftScore.toFixed(4), prediction, windowSize: this._driftWindow.length };
    }

    // ─── Pattern Learning ─────────────────────────────────────────────────

    _learnPatterns() {
        // Group recent actions by domain
        const byDomain = {};
        for (const a of this._actions) {
            if (!byDomain[a.domain]) byDomain[a.domain] = [];
            byDomain[a.domain].push(a);
        }

        for (const [domain, actions] of Object.entries(byDomain)) {
            if (actions.length < 3) continue;

            const avgConf = actions.reduce((s, a) => s + (a.confidence || 0), 0) / actions.length;
            const avgLat = actions.reduce((s, a) => s + (a.latencyMs || 0), 0) / actions.length;
            const avgSim = actions.reduce((s, a) => s + (a.simScore || 0), 0) / actions.length;
            const avgMC = actions.reduce((s, a) => s + (a.mcDeterminism || 0), 0) / actions.length;
            const winRate = actions.filter(a => a.battleWon).length / actions.length;

            // Find most common provider/model
            const providerCounts = {};
            for (const a of actions) {
                const key = `${a.provider}/${a.model}`;
                providerCounts[key] = (providerCounts[key] || 0) + 1;
            }
            const bestProvider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];

            const pattern = {
                domain,
                count: actions.length,
                avgConfidence: +avgConf.toFixed(4),
                avgLatencyMs: +avgLat.toFixed(0),
                avgSimScore: +avgSim.toFixed(4),
                avgMCDeterminism: +avgMC.toFixed(4),
                winRate: +winRate.toFixed(4),
                bestProviderModel: bestProvider ? bestProvider[0] : 'unknown',
                recommendedConfig: {
                    temperature: avgMC >= PSI ? 0 : 0.1,
                    seed: 42,
                    top_p: 1,
                    preferredModel: bestProvider ? bestProvider[0] : null,
                },
                learnedAt: Date.now(),
            };

            const isNew = !this._patterns.has(domain);
            this._patterns.set(domain, pattern);
            if (isNew) {
                this._stats.learnedPatterns++;
                this.emit('action:learned', pattern);
            }
        }
    }

    // ─── Reconfiguration ──────────────────────────────────────────────────

    _generateReconfig(driftScore) {
        const steps = [];

        if (driftScore > PSI) {
            steps.push('CRITICAL: Lock all LLM params — temperature=0, seed=42, top_p=1');
            steps.push('Switch to single-model mode (disable racing) to reduce variance');
            steps.push('Enable full replay cache to serve deterministic responses');
        } else if (driftScore > PSI_SQ) {
            steps.push('WARNING: Increase MC sampling iterations to detect boundary');
            steps.push('Tighten CSL confidence threshold to φ⁻¹ (0.618)');
            steps.push('Enable output comparison logging for drift root-cause analysis');
        }

        return {
            action: driftScore > PSI ? 'lock_deterministic' : 'stabilize',
            driftScore: +driftScore.toFixed(4),
            steps,
            newConfig: {
                temperature: 0,
                seed: 42,
                top_p: 1,
                mcIterations: Math.ceil(5 * (1 + driftScore)),
                cslThreshold: driftScore > PSI ? PSI : PSI_SQ,
            },
            ts: Date.now(),
        };
    }

    // ─── Public API ─────────────────────────────────────────────────────

    /** Get current stats */
    getStats() {
        return { ...this._stats };
    }

    /** Get learned patterns for all domains */
    getPatterns() {
        return Object.fromEntries(this._patterns);
    }

    /** Get pattern for a specific domain */
    getPattern(domain) {
        return this._patterns.get(domain) || null;
    }

    /** Get recent actions */
    getRecentActions(n = 10) {
        return this._actions.slice(-n);
    }

    /** Get comprehensive determinism report */
    getDeterminismReport() {
        const patterns = this.getPatterns();
        const domains = Object.keys(patterns);
        const avgDeterminism = domains.length > 0
            ? domains.reduce((s, d) => s + patterns[d].avgMCDeterminism, 0) / domains.length
            : 0;

        return {
            totalActions: this._stats.totalActions,
            learnedDomains: domains.length,
            avgDeterminism: +avgDeterminism.toFixed(4),
            driftAlerts: this._stats.driftAlerts,
            reconfigs: this._stats.reconfigs,
            patterns,
            recommendation: avgDeterminism >= PSI ? 'System is deterministic — maintain current config' :
                avgDeterminism >= PSI_SQ ? 'Marginal determinism — consider tightening params' :
                    'Low determinism — lock all params and enable replay cache',
        };
    }

    /** Force reconfigure based on current state */
    forceReconfig() {
        const drift = this._checkDrift();
        if (!drift.drifting) {
            return { action: 'none', reason: 'No drift detected — system is stable' };
        }
        return this._generateReconfig(drift.driftScore);
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    _updateRunningStats(entry) {
        const n = this._stats.totalActions;
        this._stats.avgConfidence = ((this._stats.avgConfidence * (n - 1)) + (entry.confidence || 0)) / n;
        this._stats.avgLatency = ((this._stats.avgLatency * (n - 1)) + (entry.latencyMs || 0)) / n;
    }
}

module.exports = { ContinuousActionAnalyzer, WINDOW_SIZE, DRIFT_THRESHOLD, LEARN_THRESHOLD, PHI, PSI, PSI_SQ };
```

---

### `src/services/csl-service-integration.js`

```javascript
/**
 * CSL Service Integration — Wires Continuous Semantic Logic into services
 *
 * Provides a lightweight façade that services import to route decisions
 * through CSL gates instead of discrete if/else.  The engine singleton
 * is shared across the process to avoid redundant Float64Array allocations.
 *
 * Usage in any service:
 *   const { csl, gate, decide, consensus } = require('./csl-service-integration');
 *   const { activation } = gate(inputVec, topicVec);      // replaces: if (topic === 'foo')
 *   const choice = decide(candidates, queryVec);           // replaces: switch/case
 *   const agreed = consensus(agentVectors);                // replaces: majority vote
 *
 * © 2026 HeadySystems Inc. — Proprietary
 * @module csl-service-integration
 */

'use strict';

const logger = require('../utils/logger');

// ── Lazy-load CSL engine (try/require pattern) ────────────────────────────
let _engine = null;

function getEngine() {
    if (_engine) return _engine;
    try {
        const { CSLEngine } = require('../core/csl-engine/csl-engine');
        _engine = new CSLEngine({ dim: 1536, normalizeInputs: true });
        logger.logNodeActivity('CSL', '  ✓ CSL Engine singleton: ACTIVE (1536-dim, phi-thresholds)');
    } catch (err) {
        // Fallback: lightweight compatibility shim
        logger.logNodeActivity('CSL', `  ⚠ CSL Engine unavailable, using shim: ${err.message}`);
        _engine = {
            AND(a, b) { return cosine(a, b); },
            OR(a, b) { return normalize(add(a, b)); },
            GATE(input, gateVec, threshold = 0.5) {
                const cos = cosine(input, gateVec);
                return { activation: cos >= (threshold || 0.5) ? 1 : 0, cosScore: cos };
            },
            CONSENSUS(vecs) {
                const dim = vecs[0].length;
                const sum = new Float64Array(dim);
                for (const v of vecs) for (let i = 0; i < dim; i++) sum[i] += v[i];
                const n = Math.sqrt(sum.reduce((s, x) => s + x * x, 0));
                return { consensus: n > 1e-10 ? sum.map(x => x / n) : sum, strength: n / vecs.length };
            },
            _stats: { operationCount: 0, degenerateVectors: 0, gateActivations: 0 }
        };
    }
    return _engine;
}

// Shim helpers
function cosine(a, b) {
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
    nA = Math.sqrt(nA); nB = Math.sqrt(nB);
    return (nA < 1e-10 || nB < 1e-10) ? 0 : dot / (nA * nB);
}
function add(a, b) { const r = new Float64Array(a.length); for (let i = 0; i < a.length; i++) r[i] = a[i] + b[i]; return r; }
function normalize(a) { const n = Math.sqrt(a.reduce((s, x) => s + x * x, 0)); return n < 1e-10 ? a : a.map(x => x / n); }

// ── Public API ────────────────────────────────────────────────────────────

/**
 * CSL gate — replaces if/else on semantic similarity
 * @param {Float64Array} input  - The input vector
 * @param {Float64Array} topic  - The gate topic vector
 * @param {number} [threshold]  - Optional override (default: engine default)
 * @returns {{ activation: number, cosScore: number }}
 */
function gate(input, topic, threshold) {
    return getEngine().GATE(input, topic, threshold, 'soft');
}

/**
 * decide — rank candidates by cosine similarity to query (replaces switch/case)
 * @param {Array<{ vector: Float64Array, label: string }>} candidates
 * @param {Float64Array} queryVec
 * @returns {{ label: string, score: number }[]}
 */
function decide(candidates, queryVec) {
    const engine = getEngine();
    return candidates
        .map(c => ({ label: c.label, score: engine.AND(queryVec, c.vector) }))
        .sort((a, b) => b.score - a.score);
}

/**
 * consensus — aggregate multiple agent vectors (replaces majority vote)
 * @param {Float64Array[]} vectors
 * @param {number[]} [weights]
 * @returns {{ consensus: Float64Array, strength: number }}
 */
function consensus(vectors, weights) {
    return getEngine().CONSENSUS(vectors, weights);
}

/**
 * stats — return engine operation counters
 */
function stats() {
    return getEngine()._stats || {};
}

module.exports = {
    get csl() { return getEngine(); },
    gate,
    decide,
    consensus,
    stats,
    getEngine,
};
```

---

### `tests/battle-sim-orchestrator.test.js`

```javascript
/**
 * Battle-Sim Orchestrator + Continuous Action Analyzer — Test Suite
 *
 * Tests:
 *   1. Sim pre-flight scoring and resource estimation
 *   2. Battle racing with mock arena contestants
 *   3. MC sampling determinism measurement
 *   4. Full pipeline: Sim → CSL → Battle → MC → Bee → Swarm → Result → Drift
 *   5. Continuous action analyzer drift detection and pattern learning
 *   6. Comparison framework (Heady vs external output)
 *   7. Task dispatcher routing to HeadyBattle/HeadySims
 *   8. Edge cases
 *
 * Run: npx jest tests/battle-sim-orchestrator.test.js --verbose
 */

const { BattleSimTaskOrchestrator, PHI, PSI, PSI_SQ } = require('../src/orchestration/battle-sim-task-orchestrator');
const { ContinuousActionAnalyzer, DRIFT_THRESHOLD, LEARN_THRESHOLD } = require('../src/analytics/continuous-action-analyzer');

// ─── Stubs ────────────────────────────────────────────────────────────────────

class StubCSLConfidenceGate {
    constructor() {
        this._driftWindow = [];
        this._stats = { checks: 0, executes: 0, halts: 0 };
    }
    preFlightCheck(promptId, vars, interpolated) {
        this._stats.checks++;
        const filled = Object.values(vars).filter(v => v && String(v).trim()).length;
        const total = Object.keys(vars).length;
        const completeness = total > 0 ? filled / total : 0;
        const promptLen = (interpolated || '').length;
        const lengthScore = Math.min(1.0, promptLen / 100);
        const confidence = (completeness * PSI + lengthScore * PSI_SQ) / (PSI + PSI_SQ);
        const decision = confidence >= PSI ? 'EXECUTE' : confidence >= PSI_SQ ? 'CAUTIOUS' : 'HALT';
        if (decision === 'EXECUTE') this._stats.executes++;
        if (decision === 'HALT') this._stats.halts++;
        return { confidence: +confidence.toFixed(4), decision, factors: { completeness, lengthScore } };
    }
    trackDrift(hash) {
        this._driftWindow.push(hash);
        if (this._driftWindow.length > 20) this._driftWindow.shift();
        if (this._driftWindow.length < 5) return { drifting: false, driftScore: 0, prediction: 'insufficient_data' };
        const unique = new Set(this._driftWindow).size;
        const driftScore = (unique - 1) / (this._driftWindow.length - 1);
        return { drifting: driftScore > PSI_SQ, driftScore: +driftScore.toFixed(4), prediction: driftScore > PSI_SQ ? 'drift_detected' : 'stable' };
    }
    getStats() { return this._stats; }
}

class StubBattleArena {
    constructor() {
        this._contestants = new Map();
        this._contestants.set('model-a', { id: 'model-a', provider: 'anthropic', model: 'claude-3' });
        this._contestants.set('model-b', { id: 'model-b', provider: 'openai', model: 'gpt-4' });
    }
    async runRound(task) {
        return {
            winner: 'model-a',
            outputs: {
                'model-a': `Analysis of "${task.prompt}": comprehensive and accurate with reasoning.`,
                'model-b': `Response to "${task.prompt}": concise summary.`,
            },
            finalScores: { 'model-a': 0.85, 'model-b': 0.72 },
            durationMs: 150,
        };
    }
}

// ─── 1. Sim Pre-Flight ───────────────────────────────────────────────────────

describe('Sim Pre-Flight', () => {
    test('well-formed task gets high sim score', async () => {
        const orch = new BattleSimTaskOrchestrator();
        const result = await orch.execute({
            id: 'test-001',
            prompt: 'Analyze this code for security vulnerabilities and provide detailed recommendations for fixing each issue found.',
            domain: 'code',
            keywords: ['security', 'vulnerability', 'fix'],
            variables: { language: 'JavaScript', severity: 'high' },
        }, { skipBattle: true, skipMC: true });

        expect(result.halted).toBe(false);
        expect(result.stages.sim_preflight.score).toBeGreaterThan(0.5);
        expect(result.stages.sim_preflight.resources).toBeDefined();
    });

    test('empty task gets low sim score and halts', async () => {
        const orch = new BattleSimTaskOrchestrator();
        const result = await orch.execute({
            id: 'test-002', prompt: '', domain: '', keywords: [],
        }, { skipBattle: true, skipMC: true });

        expect(result.halted).toBe(true);
        expect(result.haltStage).toBe('sim_preflight');
    });

    test('sim can be skipped', async () => {
        const orch = new BattleSimTaskOrchestrator();
        const result = await orch.execute({
            id: 'test-003', prompt: 'Hello', domain: 'code',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        expect(result.halted).toBe(false);
        expect(result.stages.sim_preflight).toBeUndefined();
    });
});

// ─── 2. Battle Racing ────────────────────────────────────────────────────────

describe('Battle Racing', () => {
    test('arena races contestants and picks winner', async () => {
        const arena = new StubBattleArena();
        const orch = new BattleSimTaskOrchestrator({ arena, simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'battle-001',
            prompt: 'Which sorting algorithm is fastest for nearly-sorted data?',
            domain: 'code', keywords: ['sort', 'algorithm'],
        }, { skipSim: true, skipMC: true });

        expect(result.halted).toBe(false);
        expect(result.stages.battle_race.winner).toBe('model-a');
        expect(result.stages.battle_race.winnerProvider).toBe('anthropic');
        expect(result.stages.battle_race.finalScores['model-a']).toBeGreaterThan(result.stages.battle_race.finalScores['model-b']);
    });

    test('battle race is skipped when no arena provided', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'battle-002', prompt: 'Test', domain: 'code',
        }, { skipSim: true, skipMC: true });

        expect(result.stages.battle_race.skipped).toBe(true);
    });
});

// ─── 3. MC Sampling ──────────────────────────────────────────────────────────

describe('MC Sampling', () => {
    test('deterministic input produces consistent MC metrics', async () => {
        const orch = new BattleSimTaskOrchestrator({ mcIterations: 10, simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'mc-001', prompt: 'Test prompt for MC sampling', domain: 'code',
            variables: { language: 'JS' },
        }, { skipSim: true, skipBattle: true });

        expect(result.stages.mc_sampling.iterations).toBe(10);
        expect(result.stages.mc_sampling.uniqueHashes).toBeGreaterThanOrEqual(1);
        expect(result.stages.mc_sampling.determinismScore).toBeDefined();
        expect(result.stages.mc_sampling.boundary).toBeDefined();
        expect(result.stages.mc_sampling.prediction).toBeDefined();
    });

    test('MC can be skipped', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'mc-002', prompt: 'Test', domain: 'code',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        expect(result.stages.mc_sampling).toBeUndefined();
    });
});

// ─── 4. Full Pipeline ────────────────────────────────────────────────────────

describe('Full Pipeline', () => {
    test('all 9 stages execute in sequence', async () => {
        const gate = new StubCSLConfidenceGate();
        const arena = new StubBattleArena();
        const analyzer = new ContinuousActionAnalyzer();
        const orch = new BattleSimTaskOrchestrator({
            arena, confidenceGate: gate, actionAnalyzer: analyzer, mcIterations: 3,
        });

        const result = await orch.execute({
            id: 'full-001',
            prompt: 'Design a microservice architecture for a real-time trading platform with low-latency requirements, distributed consensus, and phi-scaled resource allocation.',
            domain: 'code',
            keywords: ['architecture', 'microservice', 'trading', 'latency'],
            variables: { language: 'Go', scale: 'large' },
        });

        expect(result.halted).toBe(false);
        expect(result.pipelineId).toBeDefined();
        expect(result.stages.sim_preflight).toBeDefined();
        expect(result.stages.csl_gate).toBeDefined();
        expect(result.stages.battle_race).toBeDefined();
        expect(result.stages.mc_sampling).toBeDefined();
        expect(result.stages.bee_dispatch).toBeDefined();
        expect(result.stages.swarm_route).toBeDefined();
        expect(result.stages.result_capture).toBeDefined();
        expect(result.stages.drift_check).toBeDefined();
        expect(result.output).toBeDefined();
        expect(result.outputHash).toBeDefined();
        expect(result.determinismMetrics).toBeDefined();
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('bee dispatch routes to correct domain', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'bee-001', prompt: 'Deploy the service', domain: 'deploy',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        expect(result.stages.bee_dispatch.bee).toBe('deployment-bee');
        expect(result.stages.bee_dispatch.domain).toBe('deploy');
    });

    test('swarm route targets correct swarm', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'swarm-001', prompt: 'Research the topic', domain: 'research',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        expect(result.stages.swarm_route.targetSwarm).toBe('research-herald');
        expect(result.stages.swarm_route.routed).toBe(true);
    });

    test('pipeline emits events', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        let completeFired = false;
        orch.on('pipeline:complete', () => { completeFired = true; });

        await orch.execute({
            id: 'events-001', prompt: 'Test event emission', domain: 'code',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        expect(completeFired).toBe(true);
    });
});

// ─── 5. Continuous Action Analyzer ───────────────────────────────────────────

describe('Continuous Action Analyzer', () => {
    test('records actions and updates stats', () => {
        const analyzer = new ContinuousActionAnalyzer();
        analyzer.record({ taskId: 'test', domain: 'code', inputHash: 'abc', outputHash: 'def', provider: 'anthropic', model: 'claude', latencyMs: 100, confidence: 0.9, simScore: 0.85, battleWon: true, mcDeterminism: 0.95 });
        const stats = analyzer.getStats();
        expect(stats.totalActions).toBe(1);
        expect(stats.avgConfidence).toBeCloseTo(0.9, 1);
    });

    test('detects drift when outputs diverge', () => {
        const analyzer = new ContinuousActionAnalyzer();
        let driftFired = false;
        analyzer.on('action:drift', () => { driftFired = true; });

        // Push diverse outputs to trigger drift
        for (let i = 0; i < 20; i++) {
            analyzer.record({ taskId: `t${i}`, domain: 'code', outputHash: `unique-${i}`, provider: 'test', model: 'test', latencyMs: 100, confidence: 0.5, simScore: 0.5, battleWon: false, mcDeterminism: 0.3 });
        }

        expect(driftFired).toBe(true);
        expect(analyzer.getStats().driftAlerts).toBeGreaterThan(0);
    });

    test('learns patterns after threshold', () => {
        const analyzer = new ContinuousActionAnalyzer();
        let learnedFired = false;
        analyzer.on('action:learned', () => { learnedFired = true; });

        for (let i = 0; i < LEARN_THRESHOLD + 5; i++) {
            analyzer.record({ taskId: `t${i}`, domain: 'code', outputHash: 'same-hash', provider: 'anthropic', model: 'claude-3', latencyMs: 200, confidence: 0.85, simScore: 0.9, battleWon: true, mcDeterminism: 0.95 });
        }

        expect(learnedFired).toBe(true);
        const pattern = analyzer.getPattern('code');
        expect(pattern).not.toBe(null);
        expect(pattern.avgConfidence).toBeGreaterThan(0.8);
        expect(pattern.bestProviderModel).toBe('anthropic/claude-3');
    });

    test('records user actions', () => {
        const analyzer = new ContinuousActionAnalyzer();
        analyzer.recordUserAction({ type: 'click', target: 'submit-btn', sessionId: 's1' });
        expect(analyzer.getStats().totalActions).toBe(1);
        expect(analyzer.getRecentActions(1)[0].domain).toBe('user-interaction');
    });

    test('records environmental params', () => {
        const analyzer = new ContinuousActionAnalyzer();
        analyzer.recordEnvironmental({ key: 'NODE_ENV', value: 'production', source: 'env' });
        expect(analyzer.getStats().totalActions).toBe(1);
        expect(analyzer.getRecentActions(1)[0].domain).toBe('environmental');
    });

    test('determinism report aggregates patterns', () => {
        const analyzer = new ContinuousActionAnalyzer();
        for (let i = 0; i < 15; i++) {
            analyzer.record({ taskId: `r${i}`, domain: 'deploy', outputHash: 'h1', provider: 'gcp', model: 'cloudrun', latencyMs: 300, confidence: 0.9, simScore: 0.88, battleWon: true, mcDeterminism: 0.92 });
        }
        const report = analyzer.getDeterminismReport();
        expect(report.learnedDomains).toBe(1);
        expect(report.avgDeterminism).toBeGreaterThan(0.5);
        expect(report.recommendation).toContain('deterministic');
    });
});

// ─── 6. Comparison Framework ─────────────────────────────────────────────────

describe('Comparison Framework', () => {
    test('identical outputs → hashMatch + high determinism score', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'comp-001', prompt: 'Test comparison', domain: 'code',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        const comparison = orch.compareOutputs(result, result.output);
        expect(comparison.hashMatch).toBe(true);
        expect(comparison.jaccardSimilarity).toBe(1.0);
        expect(comparison.determinismScore).toBeGreaterThan(PSI);
        expect(comparison.verdict).toBe('deterministic');
    });

    test('different outputs → no hashMatch + lower determinism', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'comp-002', prompt: 'First output for comparison', domain: 'code',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        const comparison = orch.compareOutputs(result, 'Completely different and unrelated text about something else entirely');
        expect(comparison.hashMatch).toBe(false);
        expect(comparison.jaccardSimilarity).toBeLessThan(0.5);
        expect(comparison.determinismScore).toBeLessThan(PSI);
    });

    test('comparePipelineRuns detects self-consistency', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const task = { id: 'consistency-001', prompt: 'Same task for consistency check', domain: 'code' };
        const a = await orch.execute(task, { skipSim: true, skipBattle: true, skipMC: true });
        const b = await orch.execute(task, { skipSim: true, skipBattle: true, skipMC: true });
        const consistency = orch.comparePipelineRuns(a, b);
        expect(consistency.hashMatch).toBe(true);
        expect(consistency.selfConsistent).toBe(true);
    });
});

// ─── 7. Task Dispatcher Routing ──────────────────────────────────────────────

describe('Task Dispatcher Battle/Sim Routing', () => {
    // Load the actual dispatcher to verify it has the new agents
    let classify, SUB_AGENTS;
    beforeAll(() => {
        try {
            ({ classify, SUB_AGENTS } = require('../src/hcfp/task-dispatcher'));
        } catch (e) {
            // Dispatcher may fail to load due to missing midi-event-bus — skip
            classify = null;
        }
    });

    test('SUB_AGENTS includes heady-battle', () => {
        if (!SUB_AGENTS) return; // skip if dispatcher doesn't load
        expect(SUB_AGENTS['heady-battle']).toBeDefined();
        expect(SUB_AGENTS['heady-battle'].name).toBe('HeadyBattle');
        expect(SUB_AGENTS['heady-battle'].keywords).toContain('battle');
        expect(SUB_AGENTS['heady-battle'].keywords).toContain('race');
        expect(SUB_AGENTS['heady-battle'].keywords).toContain('compare');
    });

    test('SUB_AGENTS includes heady-sims', () => {
        if (!SUB_AGENTS) return;
        expect(SUB_AGENTS['heady-sims']).toBeDefined();
        expect(SUB_AGENTS['heady-sims'].name).toBe('HeadySims');
        expect(SUB_AGENTS['heady-sims'].keywords).toContain('simulate');
        expect(SUB_AGENTS['heady-sims'].keywords).toContain('predict');
    });

    test('battle keyword routes to HeadyBattle', () => {
        if (!classify) return;
        const result = classify({ name: 'battle arena evaluation compare', action: 'battle', inputs: {} });
        expect(result.agent).toBe('heady-battle');
        expect(result.name).toBe('HeadyBattle');
    });

    test('simulate keyword routes to HeadySims', () => {
        if (!classify) return;
        const result = classify({ name: 'Simulate resource usage', action: 'simulate', inputs: {} });
        expect(result.agent).toBe('heady-sims');
        expect(result.name).toBe('HeadySims');
    });
});

// ─── 8. Edge Cases ───────────────────────────────────────────────────────────

describe('Edge Cases', () => {
    test('stats are accurate after multiple runs', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        await orch.execute({ id: 'e1', prompt: 'Task 1', domain: 'code' }, { skipSim: true, skipBattle: true, skipMC: true });
        await orch.execute({ id: 'e2', prompt: 'Task 2', domain: 'deploy' }, { skipSim: true, skipBattle: true, skipMC: true });
        const stats = orch.getStats();
        expect(stats.tasksProcessed).toBe(2);
        expect(stats.beeDispatches).toBe(2);
        expect(stats.swarmRoutes).toBe(2);
    });

    test('audit log tracks all actions', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        await orch.execute({ id: 'audit-1', prompt: 'Audit test', domain: 'code' }, { skipSim: true, skipBattle: true, skipMC: true });
        const log = orch.getAuditLog();
        expect(log.length).toBeGreaterThan(0);
        expect(log[0].action).toBe('pipeline_start');
    });

    test('determinism report is correct', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        await orch.execute({ id: 'dr-1', prompt: 'Test', domain: 'code' }, { skipSim: true, skipBattle: true, skipMC: true });
        const report = orch.getDeterminismReport();
        expect(report.totalTasks).toBe(1);
        expect(report.phi).toBeCloseTo(PHI, 6);
        expect(report.psi).toBeCloseTo(PSI, 6);
    });

    test('force flag bypasses sim halt', async () => {
        const orch = new BattleSimTaskOrchestrator();
        const result = await orch.execute({
            id: 'force-001', prompt: '', domain: '',
        }, { force: true, skipBattle: true, skipMC: true });
        expect(result.halted).toBe(false);
    });

    test('phi constants are golden ratio', () => {
        expect(PHI).toBeCloseTo(1.618, 2);
        expect(PSI).toBeCloseTo(0.618, 2);
        expect(PSI_SQ).toBeCloseTo(0.382, 2);
        expect(PHI * PSI).toBeCloseTo(1.0, 6);
    });
});
```

---
