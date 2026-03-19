/**
 * @fileoverview HeadyCausalInferenceService — Causal reasoning engine.
 * Predicts consequences of actions BEFORE execution using structural causal models,
 * do-calculus interventions, counterfactual reasoning, and Monte Carlo simulation.
 * Every pipeline stage transition gets a causal impact assessment.
 * @module heady-causal-inference-service
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

// ── PHI-MATH CONSTANTS ──────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

/** HCFP 21-Stage Pipeline for causal stage transitions */
const PIPELINE_STAGES = [
  'CHANNEL_ENTRY', 'CONTEXT_ASSEMBLY', 'INTENT_CLASSIFY', 'NODE_SELECT', 'PRE_EXECUTE',
  'EXECUTE', 'POST_EXECUTE', 'QUALITY_GATE', 'ASSURANCE_GATE', 'PATTERN_CAPTURE',
  'STORY_UPDATE', 'LEARNING', 'DRIFT_CHECK', 'COHERENCE_VALIDATE', 'RECEIPT_SIGN',
  'CHECKPOINT', 'CLEANUP', 'METRICS_EMIT', 'TELEMETRY_FLUSH', 'GOVERNANCE_LOG', 'RECEIPT'
];

/** Monte Carlo simulation count, Fibonacci-derived */
const MC_SIMULATIONS = FIB[10]; // 55

/**
 * Structured JSON logger.
 * @param {string} level - Log level
 * @param {string} msg - Message
 * @param {Object} meta - Metadata
 * @param {string} [correlationId] - Correlation ID
 */
function log(level, msg, meta = {}, correlationId = null) {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'heady-causal-inference-service',
    level,
    correlationId: correlationId || crypto.randomUUID(),
    message: msg,
    ...meta
  }) + '\n');
}

/**
 * Phi-backoff delay.
 * @param {number} attempt - Attempt number
 * @returns {number} Delay in ms
 */
function phiBackoff(attempt) {
  return FIB[Math.min(attempt, FIB.length - 1)] * PSI * 1000;
}

/**
 * Simple pseudorandom seeded generator for reproducible Monte Carlo.
 * @param {number} seed - Random seed
 * @returns {Function} Random number generator returning [0, 1)
 */
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

/**
 * Represents a node in a Structural Causal Model (SCM).
 * @typedef {Object} CausalNode
 * @property {string} id - Node identifier
 * @property {string[]} parents - Parent node IDs
 * @property {Function} mechanism - Causal mechanism function
 * @property {number} value - Current value
 */

/**
 * HeadyCausalInferenceService — Predictive causal reasoning engine.
 */
class HeadyCausalInferenceService {
  /**
   * @param {Object} config - Service configuration
   * @param {number} [config.port=3403] - HTTP port
   * @param {number} [config.mcSimulations] - Number of Monte Carlo simulations
   * @param {number} [config.maxModels] - Maximum SCMs in memory
   */
  constructor(config = {}) {
    this.port = config.port || 3403;
    this.mcSimulations = config.mcSimulations || MC_SIMULATIONS;
    this.maxModels = config.maxModels || FIB[8];
    /** @type {Map<string, {nodes: Map<string, CausalNode>, edges: Array, createdAt: number}>} */
    this.models = new Map();
    /** @type {Map<string, Object>} */
    this.assessmentCache = new Map();
    this._cacheMaxSize = FIB[10];
    this.app = express();
    this.server = null;
    this._started = false;
    this._coherence = CSL.HIGH;
    this._circuitBreaker = { failures: 0, maxFailures: FIB[6], openUntil: 0 };
  }

  /**
   * Create a new Structural Causal Model.
   * @param {string} modelId - Model identifier
   * @param {Array<{id: string, parents: string[]}>} nodeSpecs - Node specifications
   * @returns {Object} Created model info
   */
  createModel(modelId, nodeSpecs = []) {
    if (this.models.size >= this.maxModels) {
      const oldest = [...this.models.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) this.models.delete(oldest[0]);
    }

    const nodes = new Map();
    const edges = [];

    for (const spec of nodeSpecs) {
      nodes.set(spec.id, {
        id: spec.id,
        parents: spec.parents || [],
        mechanism: spec.mechanism || ((parentVals) => parentVals.reduce((s, v) => s + v, 0) * PSI),
        value: spec.initialValue || 0
      });
      for (const parent of (spec.parents || [])) {
        edges.push({ from: parent, to: spec.id });
      }
    }

    this.models.set(modelId, { nodes, edges, createdAt: Date.now() });
    log('info', 'SCM created', { modelId, nodeCount: nodes.size, edgeCount: edges.length });
    return { modelId, nodeCount: nodes.size, edgeCount: edges.length };
  }

  /**
   * Topologically sort SCM nodes for forward propagation.
   * @param {Map<string, CausalNode>} nodes - SCM nodes
   * @returns {string[]} Topologically sorted node IDs
   * @private
   */
  _topologicalSort(nodes) {
    const visited = new Set();
    const stack = [];

    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = nodes.get(id);
      if (node) {
        for (const parent of node.parents) {
          visit(parent);
        }
      }
      stack.push(id);
    };

    for (const id of nodes.keys()) visit(id);
    return stack;
  }

  /**
   * Perform do-calculus intervention: set a node to a fixed value,
   * severing all incoming causal arrows, then propagate.
   * @param {string} modelId - Model identifier
   * @param {Object} interventions - Map of nodeId → forced value
   * @returns {Object} Post-intervention state of all nodes
   */
  doIntervention(modelId, interventions = {}) {
    const model = this.models.get(modelId);
    if (!model) throw new Error('Model not found');

    // Clone nodes
    const clonedNodes = new Map();
    for (const [id, node] of model.nodes) {
      clonedNodes.set(id, { ...node, parents: [...node.parents] });
    }

    // Apply interventions: sever parent links for intervened nodes
    for (const [nodeId, value] of Object.entries(interventions)) {
      const node = clonedNodes.get(nodeId);
      if (node) {
        node.parents = [];
        node.value = value;
      }
    }

    // Forward propagate in topological order
    const order = this._topologicalSort(clonedNodes);
    for (const id of order) {
      const node = clonedNodes.get(id);
      if (!node) continue;
      if (id in interventions) continue;
      const parentVals = node.parents.map(pid => clonedNodes.get(pid)?.value || 0);
      node.value = typeof node.mechanism === 'function'
        ? node.mechanism(parentVals)
        : parentVals.reduce((s, v) => s + v, 0) * PSI;
    }

    const result = {};
    for (const [id, node] of clonedNodes) result[id] = node.value;
    return result;
  }

  /**
   * Counterfactual query: "What would Y be if X had been x' instead of x?"
   * @param {string} modelId - Model identifier
   * @param {Object} factual - Observed factual values
   * @param {Object} counterfactualIntervention - Counterfactual intervention
   * @returns {Object} Counterfactual outcomes
   */
  counterfactual(modelId, factual, counterfactualIntervention) {
    const model = this.models.get(modelId);
    if (!model) throw new Error('Model not found');

    // Step 1: Abduction — infer exogenous values from factual
    for (const [id, value] of Object.entries(factual)) {
      const node = model.nodes.get(id);
      if (node) node.value = value;
    }

    // Step 2: Action — apply counterfactual intervention
    const cfResult = this.doIntervention(modelId, counterfactualIntervention);

    // Step 3: Prediction — compare
    const deltas = {};
    for (const [id, cfValue] of Object.entries(cfResult)) {
      const factualValue = factual[id] || 0;
      deltas[id] = { factual: factualValue, counterfactual: cfValue, delta: cfValue - factualValue };
    }

    return { counterfactualState: cfResult, deltas };
  }

  /**
   * Monte Carlo simulation for probabilistic causal inference.
   * Runs N simulations with noise injection to estimate outcome distributions.
   * @param {string} modelId - Model identifier
   * @param {Object} interventions - Interventions to test
   * @param {Object} [options] - Simulation options
   * @returns {Object} Distribution statistics
   */
  monteCarloSimulate(modelId, interventions, options = {}) {
    const model = this.models.get(modelId);
    if (!model) throw new Error('Model not found');

    const numSims = options.simulations || this.mcSimulations;
    const noiseScale = options.noiseScale || PSI * 0.1;
    const seed = options.seed || Date.now();
    const rng = seededRandom(seed);

    const results = [];
    for (let i = 0; i < numSims; i++) {
      // Add Gaussian-ish noise to interventions
      const noisyInterventions = {};
      for (const [k, v] of Object.entries(interventions)) {
        const u1 = rng(), u2 = rng();
        const noise = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2) * noiseScale;
        noisyInterventions[k] = v + noise;
      }
      results.push(this.doIntervention(modelId, noisyInterventions));
    }

    // Aggregate statistics per node
    const stats = {};
    const nodeIds = [...model.nodes.keys()];
    for (const id of nodeIds) {
      const values = results.map(r => r[id] || 0).sort((a, b) => a - b);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
      const p5Idx = Math.floor(values.length * 0.05);
      const p95Idx = Math.floor(values.length * 0.95);
      stats[id] = {
        mean,
        stdDev: Math.sqrt(variance),
        min: values[0],
        max: values[values.length - 1],
        p5: values[p5Idx],
        p95: values[p95Idx],
        confidence: variance < PSI ? 'high' : variance < PHI ? 'medium' : 'low'
      };
    }

    return { simulations: numSims, seed, stats };
  }

  /**
   * Assess the causal impact of a pipeline stage transition.
   * @param {string} fromStage - Current pipeline stage
   * @param {string} toStage - Target pipeline stage
   * @param {Object} context - Current execution context
   * @returns {Object} Impact assessment
   */
  assessPipelineTransition(fromStage, toStage, context = {}) {
    const correlationId = context.correlationId || crypto.randomUUID();
    const fromIdx = PIPELINE_STAGES.indexOf(fromStage);
    const toIdx = PIPELINE_STAGES.indexOf(toStage);

    if (fromIdx === -1 || toIdx === -1) {
      return { error: 'Invalid pipeline stage', fromStage, toStage };
    }

    const stagesSkipped = toIdx - fromIdx - 1;
    const isForward = toIdx > fromIdx;
    const isCriticalJump = stagesSkipped > FIB[4]; // Jumping more than 3 stages

    // Risk scoring based on phi-weighted stage importance
    const stageRisk = {
      EXECUTE: PHI * PHI,
      QUALITY_GATE: PHI * PHI,
      ASSURANCE_GATE: PHI,
      COHERENCE_VALIDATE: PHI,
      GOVERNANCE_LOG: PHI
    };

    const fromRisk = stageRisk[fromStage] || 1;
    const toRisk = stageRisk[toStage] || 1;
    const transitionRisk = (fromRisk + toRisk) * (1 + stagesSkipped * PSI) * (isForward ? 1 : PHI);

    // CSL gate check
    const normalizedRisk = 1 / (1 + transitionRisk * PSI);
    const cslGate = normalizedRisk >= CSL.HIGH ? 'SAFE' : normalizedRisk >= CSL.MEDIUM ? 'CAUTION' : normalizedRisk >= CSL.LOW ? 'WARNING' : 'BLOCKED';

    // Side-effect prediction
    const potentialEffects = [];
    if (isCriticalJump) potentialEffects.push({ type: 'skipped_validation', severity: 'high', stages: PIPELINE_STAGES.slice(fromIdx + 1, toIdx) });
    if (!isForward) potentialEffects.push({ type: 'backward_transition', severity: 'medium', riskMultiplier: PHI });
    if (toStage === 'EXECUTE' && fromStage !== 'PRE_EXECUTE') potentialEffects.push({ type: 'unguarded_execution', severity: 'critical' });

    const assessment = {
      correlationId,
      fromStage,
      toStage,
      isForward,
      stagesSkipped,
      transitionRisk,
      normalizedSafety: normalizedRisk,
      cslGate,
      potentialEffects,
      recommendation: cslGate === 'BLOCKED' ? 'HALT' : cslGate === 'WARNING' ? 'REVIEW' : 'PROCEED',
      timestamp: new Date().toISOString()
    };

    // Cache
    const cacheKey = `${fromStage}->${toStage}`;
    this.assessmentCache.set(cacheKey, assessment);
    if (this.assessmentCache.size > this._cacheMaxSize) {
      const firstKey = this.assessmentCache.keys().next().value;
      this.assessmentCache.delete(firstKey);
    }

    log('info', 'Pipeline transition assessed', { fromStage, toStage, cslGate }, correlationId);
    return assessment;
  }

  /** Set up Express routes. @private */
  _setupRoutes() {
    this.app.use(express.json());

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      next();
    });

    this.app.get('/health', (_req, res) => {
      res.json({
        status: this._coherence >= CSL.MEDIUM ? 'healthy' : 'degraded',
        coherence: this._coherence,
        activeModels: this.models.size,
        cachedAssessments: this.assessmentCache.size,
        circuitBreaker: this._circuitBreaker.failures >= this._circuitBreaker.maxFailures ? 'OPEN' : 'CLOSED',
        timestamp: new Date().toISOString()
      });
    });

    this.app.post('/model', (req, res) => {
      try {
        const result = this.createModel(req.body.modelId, req.body.nodes);
        res.status(201).json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });

    this.app.post('/model/:id/intervene', (req, res) => {
      try {
        const result = this.doIntervention(req.params.id, req.body.interventions);
        res.json({ modelId: req.params.id, state: result });
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    });

    this.app.post('/model/:id/counterfactual', (req, res) => {
      try {
        const result = this.counterfactual(req.params.id, req.body.factual, req.body.intervention);
        res.json(result);
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    });

    this.app.post('/model/:id/simulate', (req, res) => {
      try {
        const result = this.monteCarloSimulate(req.params.id, req.body.interventions, req.body.options);
        res.json(result);
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    });

    this.app.post('/pipeline/assess', (req, res) => {
      const result = this.assessPipelineTransition(req.body.from, req.body.to, req.body.context);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });

    this.app.get('/pipeline/stages', (_req, res) => {
      res.json({ stages: PIPELINE_STAGES, count: PIPELINE_STAGES.length });
    });
  }

  /** @returns {Promise<void>} */
  async start() {
    if (this._started) return;
    this._setupRoutes();
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this._started = true;
        log('info', 'HeadyCausalInferenceService started', { port: this.port });
        resolve();
      });
    });
  }

  /** @returns {Promise<void>} */
  async stop() {
    if (!this._started) return;
    return new Promise((resolve) => {
      this.server.close(() => {
        this._started = false;
        this.models.clear();
        this.assessmentCache.clear();
        log('info', 'HeadyCausalInferenceService stopped');
        resolve();
      });
    });
  }

  /** @returns {Object} Health status */
  health() {
    return { status: this._coherence >= CSL.MEDIUM ? 'healthy' : 'degraded', coherence: this._coherence, activeModels: this.models.size };
  }
}

module.exports = { HeadyCausalInferenceService, PHI, PSI, FIB, CSL, PIPELINE_STAGES, phiBackoff };
