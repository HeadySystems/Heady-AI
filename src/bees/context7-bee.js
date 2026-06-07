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
// ║  FILE: src/bees/context7-bee.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

/**
 * Context7Bee — HeadyBee specialist for library documentation retrieval.
 * Wraps the Context7Adapter for swarm integration.
 *
 * Domain: context7 | Swarm: research | Tier: high | Layer: Outer | Node: BRIDGE
 *
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */

const crypto = require('crypto');
const { Context7Adapter } = require('../mcp/context7-adapter');
const logger = require('../utils/logger');

// ─── Phi-Math Constants ─────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ─── CSL Gate Thresholds ────────────────────────────────────────────────────
const CSL_GATES = {
  MINIMUM: 0.500,
  LOW: 0.691,
  MEDIUM: 0.809,
  HIGH: 0.882,
  CRITICAL: 0.927,
  DEDUP: 0.972,
};

// ─── Bee Configuration ──────────────────────────────────────────────────────
const BEE_DOMAIN = 'context7';
const BEE_SWARM = 'research';
const BEE_TIER = 'high';
const BEE_LAYER = 'Outer';
const BEE_NODE = 'BRIDGE';
const EMBEDDING_DIM = 384;
// FIB 0-indexed: [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987]
const HEARTBEAT_INTERVAL = FIB[9] * 1000;   // 55 * 1000 = 55000ms
const RETIRE_DRAIN_MS = FIB[9] * 1000;      // 55 * 1000 = 55000ms

// ─── Priority Tier Resources (phi-scaled) ───────────────────────────────────
// Tokens: critical=377, high=233, medium=144, low=89, minimal=55
const PRIORITY_TIERS = {
  critical: { cpu: PHI ** 3, memory: PHI ** 3, tokens: FIB[13] },  // 377
  high:     { cpu: PHI ** 2, memory: PHI ** 2, tokens: FIB[12] },  // 233
  medium:   { cpu: PHI,      memory: PHI,      tokens: FIB[11] },  // 144
  low:      { cpu: 1.0,      memory: 1.0,      tokens: FIB[10] },  // 89
  minimal:  { cpu: PSI,      memory: PSI,      tokens: FIB[9]  },  // 55
};

// ─── Context7 Capability Vector (deterministic 384D) ────────────────────────
const CAPABILITY_KEYWORDS = [
  'documentation', 'library', 'api', 'reference', 'code', 'examples',
  'version', 'framework', 'sdk', 'package', 'npm', 'docs', 'context7',
];

/**
 * Generate a deterministic 384D embedding from a seed string.
 * Uses the same pattern as bee-factory's _buildBeeVector.
 */
function generateDeterministicEmbedding(seed) {
  const embedding = new Float32Array(EMBEDDING_DIM);
  const hash = crypto.createHash('sha256').update(seed).digest();
  const seedNum = hash.reduce((sum, byte, i) => sum + byte * (i + 1), 0);

  for (let i = 0; i < EMBEDDING_DIM; i++) {
    embedding[i] = Math.sin(seedNum * PHI + i * PSI) * PSI;
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * CSL soft gate — sigmoid activation.
 */
function softGate(value, cosScore, tau, temp) {
  tau = tau !== undefined ? tau : CSL_GATES.MINIMUM;
  temp = temp !== undefined ? temp : 0.236;
  return value * (1 / (1 + Math.exp(-(cosScore - tau) / temp)));
}

/**
 * Build the static capability vector for Context7 intent matching.
 */
const CONTEXT7_CAPABILITY_VECTOR = generateDeterministicEmbedding(
  CAPABILITY_KEYWORDS.join(':') + ':' + BEE_DOMAIN + ':' + BEE_NODE
);

const log = logger.child ? logger.child({ component: 'context7-bee' }) : logger;

// ─── Context7Bee Class ──────────────────────────────────────────────────────
class Context7Bee {
  constructor(config = {}) {
    this.beeId = config.beeId || crypto.randomUUID();
    this.templateId = 'context7-doc-resolver';
    this.domain = BEE_DOMAIN;
    this.swarm = BEE_SWARM;
    this.tier = config.tier || BEE_TIER;
    this.layer = BEE_LAYER;
    this.node = BEE_NODE;
    this.config = config;
    this.state = 'created';
    this.createdAt = Date.now();
    this.resources = PRIORITY_TIERS[this.tier] || PRIORITY_TIERS.high;
    this.heartbeatId = null;

    // Metrics tracking
    this.metrics = {
      tasksCompleted: 0,
      errorsEncountered: 0,
      avgLatencyMs: 0,
      cacheHitRate: 0,
      resolutionCount: 0,
      queryCount: 0,
    };

    // DNA embedding (384D)
    this.dnaEmbedding = generateDeterministicEmbedding(
      `${this.beeId}:${BEE_DOMAIN}:${BEE_SWARM}:${BEE_LAYER}:${BEE_NODE}`
    );

    // Adapter instance
    this.adapter = config.adapter || new Context7Adapter({
      apiKey: config.apiKey || process.env.CONTEXT7_API_KEY,
    });

    log.info({
      beeId: this.beeId,
      domain: this.domain,
      swarm: this.swarm,
      tier: this.tier,
      layer: this.layer,
      node: this.node,
    }, 'Context7Bee created');
  }

  // ── Phase 1: Spawn ────────────────────────────────────────────────────────
  async spawn(registry) {
    this.state = 'spawning';

    if (registry && typeof registry.register === 'function') {
      await registry.register({
        beeId: this.beeId,
        templateId: this.templateId,
        tier: this.tier,
        layer: this.layer,
        swarm: this.swarm,
        state: this.state,
        domain: this.domain,
        node: this.node,
      });
    }

    this.state = 'spawned';
    log.info({ beeId: this.beeId, tier: this.tier, layer: this.layer }, 'Context7Bee spawned');
    return this;
  }

  // ── Phase 2: Initialize ───────────────────────────────────────────────────
  async initialize() {
    this.state = 'initializing';
    this.heartbeatId = setInterval(() => this._heartbeat(), HEARTBEAT_INTERVAL);
    this.state = 'initialized';
    log.info({ beeId: this.beeId }, 'Context7Bee initialized');
    return this;
  }

  // ── Phase 3: Execute ──────────────────────────────────────────────────────
  async execute(context) {
    this.state = 'executing';
    const start = Date.now();

    try {
      // CSL-gated: check intent resonance against capability vector
      if (context.intentVector) {
        const resonance = cosineSimilarity(context.intentVector, CONTEXT7_CAPABILITY_VECTOR);
        if (resonance < CSL_GATES.MEDIUM) {
          log.warn({
            beeId: this.beeId,
            resonance: Number(resonance.toFixed(4)),
            threshold: CSL_GATES.MEDIUM,
          }, 'Intent resonance below MEDIUM gate — declining task');
          this.state = 'idle';
          return { declined: true, resonance, threshold: CSL_GATES.MEDIUM };
        }
      }

      const result = await this.onExecute(context);
      const latency = Date.now() - start;

      this.metrics.tasksCompleted++;
      this.metrics.avgLatencyMs = this.metrics.avgLatencyMs * PSI + latency * (1 - PSI);

      // Update cache hit rate from adapter stats
      const adapterStats = this.adapter.getStats();
      const libHitRate = adapterStats.caches.libraries.hitRate;
      const docHitRate = adapterStats.caches.docs.hitRate;
      this.metrics.cacheHitRate = libHitRate * PSI + docHitRate * (1 - PSI);

      this.state = 'idle';
      log.info({ beeId: this.beeId, latencyMs: latency, taskType: context.taskType }, 'Execution complete');
      return result;
    } catch (err) {
      this.metrics.errorsEncountered++;
      this.state = 'error';
      log.error({ beeId: this.beeId, error: err.message }, 'Execution failed');
      throw err;
    }
  }

  /**
   * Core execution handler — dispatches by task type.
   * @param {Object} context — Must include taskType: 'resolve' | 'query'
   */
  async onExecute(context) {
    const { taskType } = context;

    if (taskType === 'resolve') {
      if (!context.libraryName) {
        throw new Error('context.libraryName is required for resolve task');
      }
      const result = await this.adapter.resolveLibrary(context.libraryName);
      this.metrics.resolutionCount++;
      return { taskType: 'resolve', libraryName: context.libraryName, result };
    }

    if (taskType === 'query') {
      if (!context.libraryId) {
        throw new Error('context.libraryId is required for query task');
      }
      const tokens = context.maxTokens || FIB[13]; // 377
      const result = await this.adapter.queryDocs(context.libraryId, {
        tokens,
        topic: context.topic,
      });
      this.metrics.queryCount++;
      return { taskType: 'query', libraryId: context.libraryId, tokens, result };
    }

    throw new Error(`Unknown task type: ${taskType}. Supported: 'resolve', 'query'`);
  }

  // ── Phase 4: Report ───────────────────────────────────────────────────────
  async report(observerClient) {
    this.state = 'reporting';
    const coherence = this._calculateCoherence();
    const adapterStats = this.adapter.getStats();

    const report = {
      beeId: this.beeId,
      templateId: this.templateId,
      domain: this.domain,
      swarm: this.swarm,
      tier: this.tier,
      layer: this.layer,
      node: this.node,
      metrics: {
        ...this.metrics,
        cacheHitRate: Number(this.metrics.cacheHitRate.toFixed(4)),
        avgLatencyMs: Number(this.metrics.avgLatencyMs.toFixed(2)),
      },
      adapterStats: {
        totalRequests: adapterStats.metrics.totalRequests,
        avgLatencyMs: adapterStats.metrics.avgLatencyMs,
        circuitBreakerState: adapterStats.circuitBreaker.state,
      },
      coherence,
      uptimeMs: Date.now() - this.createdAt,
    };

    if (observerClient && typeof observerClient.submitBeeReport === 'function') {
      await observerClient.submitBeeReport(report);
    }

    this.state = 'idle';
    log.info({ beeId: this.beeId, coherence }, 'Report submitted to OBSERVER');
    return report;
  }

  // ── Phase 5: Retire ───────────────────────────────────────────────────────
  async retire(registry) {
    this.state = 'retiring';

    if (this.heartbeatId) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }

    // Drain period
    await new Promise((r) => setTimeout(r, RETIRE_DRAIN_MS));

    if (registry && typeof registry.deregister === 'function') {
      await registry.deregister(this.beeId);
    }

    this.state = 'retired';
    log.info({
      beeId: this.beeId,
      totalTasks: this.metrics.tasksCompleted,
      uptimeMs: Date.now() - this.createdAt,
    }, 'Context7Bee retired');
    return this;
  }

  // ── Internal Methods ──────────────────────────────────────────────────────

  _heartbeat() {
    const coherence = this._calculateCoherence();
    log.debug({
      beeId: this.beeId,
      state: this.state,
      coherence,
      tasks: this.metrics.tasksCompleted,
    }, 'Heartbeat');
  }

  _calculateCoherence() {
    const total = this.metrics.tasksCompleted + this.metrics.errorsEncountered;
    const errorRate = total === 0 ? 0 : this.metrics.errorsEncountered / total;
    return Number(Math.max(CSL_GATES.MINIMUM, 1 - errorRate * PHI).toFixed(4));
  }

  /**
   * Get the 384D DNA embedding for vector similarity search.
   */
  getDnaEmbedding() {
    return this.dnaEmbedding;
  }

  /**
   * Get the static capability vector for intent matching.
   */
  static getCapabilityVector() {
    return CONTEXT7_CAPABILITY_VECTOR;
  }

  toJSON() {
    return {
      beeId: this.beeId,
      templateId: this.templateId,
      domain: this.domain,
      swarm: this.swarm,
      tier: this.tier,
      layer: this.layer,
      node: this.node,
      state: this.state,
      resources: this.resources,
      metrics: this.metrics,
      coherence: this._calculateCoherence(),
      uptimeMs: Date.now() - this.createdAt,
    };
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────
module.exports = {
  Context7Bee,
  generateDeterministicEmbedding,
  cosineSimilarity,
  softGate,
  CONTEXT7_CAPABILITY_VECTOR,
  BEE_DOMAIN,
  BEE_SWARM,
  BEE_TIER,
  BEE_LAYER,
  BEE_NODE,
  EMBEDDING_DIM,
  PHI,
  PSI,
  FIB,
  CSL_GATES,
};
