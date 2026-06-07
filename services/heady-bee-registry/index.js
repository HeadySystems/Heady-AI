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
// ║  FILE: services/heady-bee-registry/index.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// © 2026 HeadySystems Inc. — Eric Haywood, Founder — 60+ Provisional Patents
'use strict';

const { Router } = require('express');
const {
  PHI, PSI, FIB, CSL_THRESHOLDS,
  phiFusionWeights, cosineSimilarity, phiBackoff,
  BEE, getPressureLevel,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/structured-logger');
const crypto = require('crypto');

/**
 * @module heady-bee-registry
 * @version 1.0.0
 * @description Production HeadyBee registry and factory. Manages bee lifecycle
 * (spawn → execute → report → retire), tracks active bees by type and
 * Sacred Geometry layer, provides swarm consensus via weighted voting,
 * and exposes health/status endpoints.
 */

const SERVICE_NAME = 'heady-bee-registry';
const logger = createLogger(SERVICE_NAME, { domain: 'swarm' });

/** Sacred Geometry resource layers (phi-weighted) */
const GEOMETRY_LAYERS = Object.freeze({
  HOT:        { weight: PHI * PSI * PSI, label: 'HOT — latency-critical' },
  WARM:       { weight: PSI * PSI,       label: 'WARM — important background' },
  COLD:       { weight: PSI * PSI * PSI, label: 'COLD — batch analytics' },
  RESERVE:    { weight: Math.pow(PSI, 4), label: 'RESERVE — burst capacity' },
  GOVERNANCE: { weight: Math.pow(PSI, 5), label: 'GOVERNANCE — always-on assurance' },
});

/** Bee lifecycle states */
const LIFECYCLE = BEE.LIFECYCLE;

/** Bee type templates (30+ types) */
const BEE_TEMPLATES = Object.freeze({
  'agents-bee':       { layer: 'HOT',     priority: 0.95, description: 'Multi-agent orchestration' },
  'brain-bee':        { layer: 'HOT',     priority: 0.95, description: 'System brain meta-controller' },
  'config-bee':       { layer: 'WARM',    priority: 0.70, description: 'Configuration management' },
  'conductor-bee':    { layer: 'HOT',     priority: 0.90, description: 'Pipeline conductor' },
  'cortex-bee':       { layer: 'HOT',     priority: 0.92, description: 'Neural cortex reasoning' },
  'cron-bee':         { layer: 'WARM',    priority: 0.60, description: 'Scheduled task execution' },
  'csl-bee':          { layer: 'HOT',     priority: 0.88, description: 'CSL gate evaluation' },
  'data-bee':         { layer: 'WARM',    priority: 0.75, description: 'Data pipeline operations' },
  'deploy-bee':       { layer: 'WARM',    priority: 0.80, description: 'Deployment orchestration' },
  'embed-bee':        { layer: 'HOT',     priority: 0.85, description: 'Vector embedding generation' },
  'eval-bee':         { layer: 'WARM',    priority: 0.72, description: 'Quality evaluation' },
  'forge-bee':        { layer: 'WARM',    priority: 0.78, description: 'Code generation and build' },
  'gateway-bee':      { layer: 'HOT',     priority: 0.90, description: 'API gateway routing' },
  'governance-bee':   { layer: 'GOVERNANCE', priority: 0.95, description: 'Policy enforcement' },
  'guard-bee':        { layer: 'HOT',     priority: 0.93, description: 'Security monitoring' },
  'health-bee':       { layer: 'GOVERNANCE', priority: 0.90, description: 'Health probe execution' },
  'inference-bee':    { layer: 'HOT',     priority: 0.92, description: 'LLM inference routing' },
  'knowledge-bee':    { layer: 'WARM',    priority: 0.80, description: 'Knowledge graph operations' },
  'lint-bee':         { layer: 'COLD',    priority: 0.55, description: 'Code linting and analysis' },
  'log-bee':          { layer: 'COLD',    priority: 0.50, description: 'Log aggregation' },
  'memory-bee':       { layer: 'HOT',     priority: 0.88, description: 'Vector memory read/write' },
  'meter-bee':        { layer: 'WARM',    priority: 0.70, description: 'Usage metering' },
  'monitor-bee':      { layer: 'GOVERNANCE', priority: 0.85, description: 'System monitoring' },
  'notify-bee':       { layer: 'WARM',    priority: 0.65, description: 'Notification dispatch' },
  'observe-bee':      { layer: 'GOVERNANCE', priority: 0.82, description: 'Observability trace collection' },
  'pipeline-bee':     { layer: 'HOT',     priority: 0.90, description: 'HCFullPipeline stage execution' },
  'rank-bee':         { layer: 'HOT',     priority: 0.85, description: 'Result ranking and fusion' },
  'receipt-bee':      { layer: 'WARM',    priority: 0.60, description: 'Transaction receipt signing' },
  'research-bee':     { layer: 'WARM',    priority: 0.75, description: 'Research and context gathering' },
  'router-bee':       { layer: 'HOT',     priority: 0.88, description: 'Task routing' },
  'saga-bee':         { layer: 'WARM',    priority: 0.78, description: 'Saga/transaction coordination' },
  'scanner-bee':      { layer: 'COLD',    priority: 0.65, description: 'Security scanning' },
  'search-bee':       { layer: 'HOT',     priority: 0.87, description: 'Semantic search execution' },
  'snapshot-bee':     { layer: 'COLD',    priority: 0.55, description: 'State snapshot persistence' },
  'swarm-bee':        { layer: 'HOT',     priority: 0.92, description: 'Swarm coordination' },
  'telemetry-bee':    { layer: 'COLD',    priority: 0.60, description: 'Telemetry collection' },
  'vector-bee':       { layer: 'HOT',     priority: 0.86, description: 'Vector operations' },
  'webhook-bee':      { layer: 'WARM',    priority: 0.70, description: 'Webhook dispatch' },
});

// ─── BaseHeadyBee ───────────────────────────────────────────────────────────

/**
 * BaseHeadyBee — lifecycle: spawn() → execute() → report() → retire()
 */
class BaseHeadyBee {
  /**
   * @param {string} id Unique bee ID
   * @param {string} type Bee type from BEE_TEMPLATES
   * @param {Object} [opts]
   */
  constructor(id, type, opts = {}) {
    this.id = id;
    this.type = type;
    this.state = 'SPAWN';
    this.layer = opts.layer || 'WARM';
    this.priority = opts.priority || 0.5;
    this.description = opts.description || `${type} bee`;
    this.createdAt = Date.now();
    this.lastHeartbeat = Date.now();
    this.metrics = { executions: 0, errors: 0, totalDurationMs: 0 };
    this.resourceBudget = Math.round(1000 * Math.pow(PHI, this.priority * 3));
  }

  /**
   * Spawn the bee — transition to INITIALIZE then READY.
   * @returns {BaseHeadyBee}
   */
  spawn() {
    this.state = 'INITIALIZE';
    this.lastHeartbeat = Date.now();
    logger.info('bee_spawn', { id: this.id, type: this.type, layer: this.layer });
    this.state = 'READY';
    return this;
  }

  /**
   * Execute a task.
   * @param {Object} task
   * @returns {Promise<Object>}
   */
  async execute(task) {
    if (this.state === 'DEAD' || this.state === 'SHUTDOWN') {
      throw new Error(`Bee ${this.id} is ${this.state}, cannot execute`);
    }
    this.state = 'ACTIVE';
    this.lastHeartbeat = Date.now();
    const start = Date.now();

    try {
      const result = await this._doWork(task);
      this.metrics.executions++;
      this.metrics.totalDurationMs += Date.now() - start;
      this.state = 'READY';
      return result;
    } catch (err) {
      this.metrics.errors++;
      this.state = 'READY';
      throw err;
    }
  }

  /**
   * Override in subclasses for actual work.
   * @protected
   */
  async _doWork(task) {
    return { beeId: this.id, type: this.type, task, processedAt: Date.now() };
  }

  /**
   * Report bee status.
   * @returns {Object}
   */
  report() {
    return {
      id: this.id,
      type: this.type,
      state: this.state,
      layer: this.layer,
      priority: this.priority,
      description: this.description,
      resourceBudget: this.resourceBudget,
      uptime: Date.now() - this.createdAt,
      lastHeartbeat: Date.now() - this.lastHeartbeat,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Retire the bee — graceful shutdown.
   */
  retire() {
    this.state = 'DRAINING';
    logger.info('bee_retire', { id: this.id, type: this.type, executions: this.metrics.executions });
    this.state = 'SHUTDOWN';
    this.state = 'DEAD';
  }
}

// ─── BeeRegistry ────────────────────────────────────────────────────────────

/**
 * BeeRegistry — tracks all active bees, their types, layers, and health.
 */
class BeeRegistry {
  constructor() {
    /** @type {Map<string, BaseHeadyBee>} */
    this.bees = new Map();
  }

  /**
   * Register a bee in the registry.
   * @param {BaseHeadyBee} bee
   */
  register(bee) {
    this.bees.set(bee.id, bee);
    logger.info('bee_registered', { id: bee.id, type: bee.type, layer: bee.layer });
  }

  /**
   * Deregister a bee.
   * @param {string} beeId
   */
  deregister(beeId) {
    const bee = this.bees.get(beeId);
    if (bee) {
      bee.retire();
      this.bees.delete(beeId);
    }
  }

  /**
   * Get all bees of a given type.
   * @param {string} type
   * @returns {BaseHeadyBee[]}
   */
  getByType(type) {
    return [...this.bees.values()].filter(b => b.type === type);
  }

  /**
   * Get all bees in a given layer.
   * @param {string} layer
   * @returns {BaseHeadyBee[]}
   */
  getByLayer(layer) {
    return [...this.bees.values()].filter(b => b.layer === layer);
  }

  /**
   * Evict stale bees (no heartbeat within BEE.STALE_MS).
   * @returns {number} Number evicted
   */
  evictStale() {
    const now = Date.now();
    let evicted = 0;
    for (const [id, bee] of this.bees) {
      if (now - bee.lastHeartbeat > BEE.STALE_MS && bee.state !== 'DEAD') {
        bee.retire();
        this.bees.delete(id);
        evicted++;
      }
    }
    if (evicted > 0) {
      logger.info('stale_bees_evicted', { count: evicted });
    }
    return evicted;
  }

  /**
   * Swarm consensus via phi-weighted voting.
   * Each bee casts a vote (a score [0,1]) and votes are fused with phi weights.
   * @param {string} question Context for the vote
   * @param {BaseHeadyBee[]} voters Array of bees to participate
   * @returns {{ consensus: number, votes: Array, quorum: boolean }}
   */
  swarmConsensus(question, voters) {
    if (voters.length === 0) return { consensus: 0, votes: [], quorum: false };

    const weights = phiFusionWeights(voters.length);
    /** Each bee votes based on priority-weighted deterministic score */
    const votes = voters.map((bee, i) => {
      const hash = crypto.createHash('sha256').update(`${bee.id}:${question}`).digest();
      const raw = (hash[0] + hash[1] * 256) / 65535;
      const vote = raw * bee.priority;
      return { beeId: bee.id, type: bee.type, vote, weight: weights[i] };
    });

    const consensus = votes.reduce((sum, v, i) => sum + v.vote * weights[i], 0);
    const quorum = voters.length >= 3;

    return { consensus, votes, quorum };
  }

  /**
   * Get full registry status.
   * @returns {Object}
   */
  status() {
    const byLayer = {};
    const byType = {};
    for (const bee of this.bees.values()) {
      byLayer[bee.layer] = (byLayer[bee.layer] || 0) + 1;
      byType[bee.type] = (byType[bee.type] || 0) + 1;
    }
    return {
      totalBees: this.bees.size,
      byLayer,
      byType,
      activeBees: [...this.bees.values()].filter(b => b.state === 'ACTIVE').length,
      readyBees: [...this.bees.values()].filter(b => b.state === 'READY').length,
    };
  }
}

// ─── BeeFactory ─────────────────────────────────────────────────────────────

/**
 * BeeFactory — creates bees from templates with phi-scaled resource budgets.
 */
class BeeFactory {
  /**
   * @param {BeeRegistry} registry
   */
  constructor(registry) {
    this.registry = registry;
  }

  /**
   * Create a bee from a registered template type.
   * @param {string} type Bee type name from BEE_TEMPLATES
   * @param {Object} [overrides] Override template defaults
   * @returns {BaseHeadyBee}
   */
  create(type, overrides = {}) {
    const template = BEE_TEMPLATES[type];
    if (!template) {
      throw new Error(`Unknown bee type: ${type}. Available: ${Object.keys(BEE_TEMPLATES).join(', ')}`);
    }

    const id = `bee-${type}-${crypto.randomBytes(4).toString('hex')}`;
    const bee = new BaseHeadyBee(id, type, {
      layer: overrides.layer || template.layer,
      priority: overrides.priority || template.priority,
      description: overrides.description || template.description,
    });

    bee.spawn();
    this.registry.register(bee);
    return bee;
  }

  /**
   * Create multiple bees of the same type.
   * @param {string} type
   * @param {number} count
   * @returns {BaseHeadyBee[]}
   */
  createPool(type, count) {
    const bees = [];
    for (let i = 0; i < count; i++) {
      bees.push(this.create(type));
    }
    logger.info('bee_pool_created', { type, count });
    return bees;
  }
}

// ─── Router factory ─────────────────────────────────────────────────────────

let startTime = Date.now();

/**
 * Create the bee registry Express router.
 * @returns {import('express').Router}
 */
function createBeeRegistryRouter() {
  const router = Router();
  const registry = new BeeRegistry();
  const factory = new BeeFactory(registry);
  startTime = Date.now();

  /** Health endpoint */
  router.get('/health', (_req, res) => {
    res.json(health());
  });

  /** Registry status */
  router.get('/status', (_req, res) => {
    res.json(registry.status());
  });

  /** List all bees */
  router.get('/bees', (_req, res) => {
    const bees = [...registry.bees.values()].map(b => b.report());
    res.json({ count: bees.length, bees });
  });

  /** Create a bee */
  router.post('/bees', (req, res) => {
    const { type, overrides } = req.body || {};
    if (!type) return res.status(400).json({ error: 'type is required' });
    try {
      const bee = factory.create(type, overrides);
      res.status(201).json(bee.report());
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /** Get a bee by ID */
  router.get('/bees/:id', (req, res) => {
    const bee = registry.bees.get(req.params.id);
    if (!bee) return res.status(404).json({ error: 'Bee not found' });
    res.json(bee.report());
  });

  /** Retire a bee */
  router.delete('/bees/:id', (req, res) => {
    registry.deregister(req.params.id);
    res.json({ retired: true, id: req.params.id });
  });

  /** List available bee types */
  router.get('/types', (_req, res) => {
    res.json({
      count: Object.keys(BEE_TEMPLATES).length,
      types: Object.entries(BEE_TEMPLATES).map(([name, tmpl]) => ({
        name,
        layer: tmpl.layer,
        priority: tmpl.priority,
        description: tmpl.description,
      })),
    });
  });

  /** Swarm consensus vote */
  router.post('/consensus', (req, res) => {
    const { question, beeType } = req.body || {};
    if (!question) return res.status(400).json({ error: 'question is required' });
    const voters = beeType
      ? registry.getByType(beeType)
      : [...registry.bees.values()].filter(b => b.state === 'READY' || b.state === 'ACTIVE');
    const result = registry.swarmConsensus(question, voters);
    res.json(result);
  });

  /** Evict stale bees */
  router.post('/evict', (_req, res) => {
    const evicted = registry.evictStale();
    res.json({ evicted });
  });

  return router;
}

/**
 * Health check.
 * @returns {Object}
 */
function health() {
  return {
    service: SERVICE_NAME,
    status: 'HEALTHY',
    uptime: Date.now() - startTime,
    templateCount: Object.keys(BEE_TEMPLATES).length,
    geometryLayers: Object.keys(GEOMETRY_LAYERS),
    lifecycle: LIFECYCLE,
    maxBees: BEE.MAX_TOTAL,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Graceful shutdown.
 */
function shutdown() {
  logger.info('shutdown', { service: SERVICE_NAME });
}

module.exports = {
  BaseHeadyBee,
  BeeRegistry,
  BeeFactory,
  createBeeRegistryRouter,
  health,
  shutdown,
  BEE_TEMPLATES,
  GEOMETRY_LAYERS,
  LIFECYCLE,
};
