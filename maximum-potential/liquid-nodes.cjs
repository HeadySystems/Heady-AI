/**
 * Heady Liquid Node Architecture — Production Implementation v4.1
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder — 60+ Provisional Patents
 *
 * Every component in the Heady ecosystem is a LiquidNode — a self-aware,
 * self-healing unit that operates in 384D vector space with phi-scaled
 * parameters and CSL-gated decision logic.
 *
 * @module liquid-node
 * @version 4.1.0
 */

const {
  PHI, PSI, fib,
  CSL_THRESHOLDS, COHERENCE_DRIFT_THRESHOLD,
  phiBackoff, phiAdaptiveInterval,
  cslGate, cosineSimilarity,
  SIZING, POOL_SIZES,
  RESOURCE_WEIGHTS,
} = require('./phi-constants.cjs');

const EventEmitter = require('events');

const nodeBus = new EventEmitter();
nodeBus.setMaxListeners(fib(10));

// ═══════════════════════════════════════════════════════════════
// STRUCTURED LOGGER
// ═══════════════════════════════════════════════════════════════

function createLogger(service) {
  const _log = (level, data, msg) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      correlationId: data?.correlationId || null,
      msg: msg || data?.message || '',
    };
    if (data) {
      const { correlationId, message, ...rest } = typeof data === 'object' ? data : {};
      Object.assign(entry, rest);
    }
    const out = level === 'error' ? process.stderr : process.stdout;
    out.write(JSON.stringify(entry) + '\n');
  };
  return {
    info: (data, msg) => _log('info', data, msg),
    warn: (data, msg) => _log('warn', data, msg),
    error: (data, msg) => _log('error', data, msg),
    debug: (data, msg) => _log('debug', data, msg),
  };
}

// ═══════════════════════════════════════════════════════════════
// LIFECYCLE STATE MACHINE
// ═══════════════════════════════════════════════════════════════

const LIFECYCLE_STATES = Object.freeze({
  INIT: 'init',
  ACTIVE: 'active',
  THINKING: 'thinking',
  RESPONDING: 'responding',
  IDLE: 'idle',
  DEGRADED: 'degraded',
  HIBERNATING: 'hibernating',
  EXPIRED: 'expired',
});

const VALID_TRANSITIONS = Object.freeze({
  init: ['active', 'expired'],
  active: ['thinking', 'idle', 'degraded', 'expired'],
  thinking: ['responding', 'active', 'degraded', 'expired'],
  responding: ['active', 'idle', 'degraded', 'expired'],
  idle: ['active', 'hibernating', 'expired'],
  degraded: ['active', 'idle', 'expired'],
  hibernating: ['active', 'expired'],
  expired: [],
});

// ═══════════════════════════════════════════════════════════════
// LIQUID NODE BASE CLASS
// ═══════════════════════════════════════════════════════════════

class LiquidNode {
  constructor(config) {
    this.name = config.name;
    this.ring = config.ring;
    this.pool = config.pool;
    this.domain = config.domain || 'headyme.com';
    this.capabilities = config.capabilities || [];
    this.embedding = config.embedding || this._generateInitialEmbedding();
    this.state = LIFECYCLE_STATES.INIT;
    this.coherenceScore = 1.0;
    this.logger = createLogger(this.name);
    this.startTime = Date.now();
    this.lastHeartbeat = Date.now();
    this.heartbeatInterval = null;
    this.cleanupStack = [];
    this.metrics = {
      requestsHandled: 0,
      errorsEncountered: 0,
      avgResponseMs: 0,
      uptimeMs: 0,
      driftEvents: 0,
      lastTaskType: null,
      lastTaskTime: null,
    };

    nodeBus.on(`${this.name}:task`, (task) => this._handleTask(task));
    this.cleanupStack.push(() => nodeBus.removeAllListeners(`${this.name}:task`));
  }

  transition(newState) {
    const valid = VALID_TRANSITIONS[this.state];
    if (!valid || !valid.includes(newState)) {
      throw new Error(`Invalid transition: ${this.state} → ${newState} for node ${this.name}`);
    }
    const oldState = this.state;
    this.state = newState;
    this.logger.info({ oldState, newState }, 'State transition');
    nodeBus.emit('node:transition', { node: this.name, from: oldState, to: newState });
  }

  async init() {
    this.logger.info({ ring: this.ring, pool: this.pool, capabilities: this.capabilities }, 'Initializing node');
    await this._registerEmbedding();
    const heartbeatMs = Math.round(PHI * 1000 * fib(5));
    this.heartbeatInterval = setInterval(() => this.heartbeat(), heartbeatMs);
    this.cleanupStack.push(() => clearInterval(this.heartbeatInterval));
    this.transition(LIFECYCLE_STATES.ACTIVE);
    this.logger.info({}, 'Node initialized and active');
  }

  async heartbeat() {
    this.lastHeartbeat = Date.now();
    this.metrics.uptimeMs = Date.now() - this.startTime;
    const currentEmbedding = await this._computeCurrentEmbedding();
    const similarity = cosineSimilarity(this.embedding, currentEmbedding);
    this.coherenceScore = similarity;

    if (similarity < COHERENCE_DRIFT_THRESHOLD) {
      this.metrics.driftEvents++;
      this.logger.warn({
        coherence: similarity,
        threshold: COHERENCE_DRIFT_THRESHOLD,
        driftEvents: this.metrics.driftEvents,
      }, 'Semantic drift detected');
      nodeBus.emit('node:drift', {
        node: this.name,
        coherence: similarity,
        threshold: COHERENCE_DRIFT_THRESHOLD,
      });
      if (this.state === LIFECYCLE_STATES.ACTIVE) {
        this.transition(LIFECYCLE_STATES.DEGRADED);
      }
    } else if (this.state === LIFECYCLE_STATES.DEGRADED && similarity >= COHERENCE_DRIFT_THRESHOLD) {
      this.transition(LIFECYCLE_STATES.ACTIVE);
      this.logger.info({ coherence: similarity }, 'Coherence restored');
    }

    nodeBus.emit('node:heartbeat', {
      node: this.name,
      state: this.state,
      coherence: this.coherenceScore,
      metrics: this.metrics,
    });
  }

  health() {
    const uptimeMs = Date.now() - this.startTime;
    return {
      service: this.name,
      status: this.state === LIFECYCLE_STATES.EXPIRED ? 'down'
        : this.state === LIFECYCLE_STATES.DEGRADED ? 'degraded' : 'up',
      state: this.state,
      ring: this.ring,
      pool: this.pool,
      capabilities: this.capabilities,
      coherence: this.coherenceScore,
      coherenceThreshold: COHERENCE_DRIFT_THRESHOLD,
      driftDetected: this.coherenceScore < COHERENCE_DRIFT_THRESHOLD,
      uptime: { ms: uptimeMs, human: this._formatUptime(uptimeMs) },
      lastHeartbeat: new Date(this.lastHeartbeat).toISOString(),
      metrics: { ...this.metrics },
      version: process.env.npm_package_version || '4.1.0',
      timestamp: new Date().toISOString(),
    };
  }

  async shutdown(signal = 'SIGTERM') {
    this.logger.info({ signal }, 'Graceful shutdown initiated');
    while (this.cleanupStack.length > 0) {
      const cleanup = this.cleanupStack.pop();
      try { await cleanup(); } catch (err) {
        this.logger.error({ error: err.message }, 'Cleanup step failed');
      }
    }
    this.transition(LIFECYCLE_STATES.EXPIRED);
    this.logger.info({}, 'Shutdown complete');
  }

  evaluateTask(taskEmbedding) {
    const similarity = cosineSimilarity(this.embedding, taskEmbedding);
    return cslGate(1.0, similarity, CSL_THRESHOLDS.LOW);
  }

  canAcceptWork() {
    return (
      (this.state === LIFECYCLE_STATES.ACTIVE || this.state === LIFECYCLE_STATES.DEGRADED) &&
      this.coherenceScore >= CSL_THRESHOLDS.MINIMUM
    );
  }

  async _handleTask(task) {
    if (!this.canAcceptWork()) {
      this.logger.warn({ task: task?.id }, 'Cannot accept work in current state');
      return null;
    }
    const start = Date.now();
    try {
      this.transition(LIFECYCLE_STATES.THINKING);
      const result = await this.execute(task);
      this.transition(LIFECYCLE_STATES.RESPONDING);
      this.metrics.requestsHandled++;
      const elapsed = Date.now() - start;
      this.metrics.avgResponseMs =
        (this.metrics.avgResponseMs * (this.metrics.requestsHandled - 1) + elapsed) /
        this.metrics.requestsHandled;
      this.metrics.lastTaskType = task?.type || 'unknown';
      this.metrics.lastTaskTime = new Date().toISOString();
      this.transition(LIFECYCLE_STATES.ACTIVE);
      return result;
    } catch (err) {
      this.metrics.errorsEncountered++;
      this.logger.error({ error: err.message, task: task?.id }, 'Task execution failed');
      if (this.state !== LIFECYCLE_STATES.EXPIRED) {
        this.transition(LIFECYCLE_STATES.ACTIVE);
      }
      throw err;
    }
  }

  async execute(task) {
    throw new Error(`${this.name}: execute() not implemented`);
  }

  _generateInitialEmbedding() {
    const dim = 384;
    const vec = new Array(dim);
    let seed = 0;
    for (let i = 0; i < this.name.length; i++) seed += this.name.charCodeAt(i);
    for (let i = 0; i < dim; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      vec[i] = (seed / 0x7fffffff - PSI) * PHI;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return vec.map(v => v / norm);
  }

  async _registerEmbedding() {
    this.logger.info({ dimensions: this.embedding.length }, 'Embedding registered');
  }

  async _computeCurrentEmbedding() {
    return this.embedding;
  }

  _formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  }
}

// ═══════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════

const CB_STATES = Object.freeze({ CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half_open' });

class CircuitBreaker {
  constructor(config) {
    this.name = config.name;
    this.failureThreshold = config.failureThreshold || SIZING.FAILURE_THRESHOLD;
    this.resetTimeoutMs = config.resetTimeoutMs || Math.round(1000 * PSI * fib(8));
    this.halfOpenProbes = config.halfOpenProbes || fib(3);
    this.state = CB_STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = 0;
    this.logger = createLogger(`CB:${this.name}`);
  }

  async exec(fn) {
    if (this.state === CB_STATES.OPEN) {
      if (Date.now() - this.lastFailure > this.resetTimeoutMs) {
        this.state = CB_STATES.HALF_OPEN;
        this.successes = 0;
        this.logger.info({}, 'Transitioning to half-open');
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }
    try {
      const result = await fn();
      if (this.state === CB_STATES.HALF_OPEN) {
        this.successes++;
        if (this.successes >= this.halfOpenProbes) {
          this.state = CB_STATES.CLOSED;
          this.failures = 0;
          this.logger.info({}, 'Circuit closed (recovered)');
        }
      } else {
        this.failures = 0;
      }
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.failureThreshold) {
        this.state = CB_STATES.OPEN;
        this.logger.warn({ failures: this.failures }, 'Circuit OPEN');
      }
      throw err;
    }
  }

  health() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

// ═══════════════════════════════════════════════════════════════
// NODE REGISTRY
// ═══════════════════════════════════════════════════════════════

class NodeRegistry {
  constructor() {
    this.nodes = new Map();
    this.logger = createLogger('NodeRegistry');
  }

  register(node) {
    this.nodes.set(node.name, node);
    this.logger.info({ node: node.name, ring: node.ring, pool: node.pool, total: this.nodes.size }, 'Registered');
  }

  deregister(name) {
    this.nodes.delete(name);
    this.logger.info({ node: name, total: this.nodes.size }, 'Deregistered');
  }

  get(name) { return this.nodes.get(name); }
  getByRing(ring) { return [...this.nodes.values()].filter(n => n.ring === ring); }
  getByPool(pool) { return [...this.nodes.values()].filter(n => n.pool === pool); }
  getByCapability(cap) { return [...this.nodes.values()].filter(n => n.capabilities.includes(cap)); }

  healthAll() { return [...this.nodes.values()].map(n => n.health()); }
  get size() { return this.nodes.size; }
}

// ═══════════════════════════════════════════════════════════════
// HEADY ERROR
// ═══════════════════════════════════════════════════════════════

class HeadyError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    this.coherenceImpact = details.coherenceImpact || 0;
    Error.captureStackTrace(this, this.constructor);
  }
}

class CoherenceDriftError extends HeadyError {
  constructor(component, currentScore, threshold) {
    super(
      `Coherence drift: ${component} score ${currentScore.toFixed(4)} below threshold ${threshold}`,
      503, 'COHERENCE_DRIFT',
      { component, currentScore, threshold, coherenceImpact: threshold - currentScore }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPRESS HEALTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

function createHealthMiddleware(node) {
  return (req, res) => {
    const h = node.health();
    const status = h.status === 'up' ? 200 : h.status === 'degraded' ? 200 : 503;
    res.status(status).json(h);
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  LiquidNode, CircuitBreaker, NodeRegistry,
  HeadyError, CoherenceDriftError,
  LIFECYCLE_STATES, VALID_TRANSITIONS, CB_STATES,
  createLogger, createHealthMiddleware,
  nodeBus,
};
