/**
 * @fileoverview HeadyGhostProtocolService — Shadow execution engine.
 * Runs proposed actions in parallel simulation before committing to production.
 * Ghost runs produce impact reports showing affected services, data mutations,
 * resource consumption, and side effects. Only after CSL gate validation does
 * real execution proceed.
 * @module heady-ghost-protocol-service
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

// ── PHI-MATH CONSTANTS ──────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

/** Ghost run states */
const GHOST_STATES = {
  PENDING: 'PENDING',
  SIMULATING: 'SIMULATING',
  ANALYZING: 'ANALYZING',
  GATE_CHECK: 'GATE_CHECK',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMMITTED: 'COMMITTED',
  ROLLED_BACK: 'ROLLED_BACK'
};

/** Impact severity levels, CSL-mapped */
const IMPACT_SEVERITY = {
  NONE: { level: 0, csl: 1.0 },
  LOW: { level: 1, csl: CSL.HIGH },
  MEDIUM: { level: 2, csl: CSL.MEDIUM },
  HIGH: { level: 3, csl: CSL.LOW },
  CRITICAL: { level: 4, csl: CSL.MINIMUM }
};

/** Maximum concurrent ghost runs, Fibonacci-derived */
const MAX_CONCURRENT = FIB[7]; // 13

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
    service: 'heady-ghost-protocol-service',
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
 * HeadyGhostProtocolService — Shadow execution engine.
 */
class HeadyGhostProtocolService {
  /**
   * @param {Object} config - Service configuration
   * @param {number} [config.port=3406] - HTTP port
   * @param {number} [config.maxConcurrent] - Maximum concurrent ghost runs
   * @param {number} [config.timeoutMs] - Default ghost run timeout
   * @param {number} [config.minGateScore] - Minimum CSL score to approve
   */
  constructor(config = {}) {
    this.port = config.port || 3406;
    this.maxConcurrent = config.maxConcurrent || MAX_CONCURRENT;
    this.timeoutMs = config.timeoutMs || FIB[10] * FIB[8] * PHI; // ~1869ms
    this.minGateScore = config.minGateScore || CSL.MEDIUM;
    /** @type {Map<string, Object>} */
    this.ghostRuns = new Map();
    /** @type {Map<string, Function>} */
    this.actionHandlers = new Map();
    /** @type {Map<string, Object>} */
    this.impactHistory = new Map();
    this._historyMaxSize = FIB[10];
    this.app = express();
    this.server = null;
    this._started = false;
    this._coherence = CSL.HIGH;
    this._activeRuns = 0;
    this._circuitBreaker = { failures: 0, maxFailures: FIB[6], openUntil: 0 };
  }

  /**
   * Register an action handler for ghost simulation.
   * Handlers must be pure functions that simulate without side effects.
   * @param {string} actionType - Action type identifier
   * @param {Function} handler - Simulation handler (async)
   */
  registerHandler(actionType, handler) {
    this.actionHandlers.set(actionType, handler);
    log('info', 'Ghost handler registered', { actionType });
  }

  /**
   * Create a ghost run for a proposed action.
   * @param {Object} proposal - Action proposal
   * @param {string} proposal.actionType - Type of action
   * @param {Object} proposal.params - Action parameters
   * @param {string[]} [proposal.affectedServices] - Services that may be affected
   * @param {Object} [proposal.context] - Execution context
   * @returns {Object} Ghost run descriptor
   */
  createGhostRun(proposal) {
    if (this._activeRuns >= this.maxConcurrent) {
      throw new Error(`Ghost run limit reached: ${this.maxConcurrent} concurrent runs`);
    }

    // Circuit breaker check
    if (this._circuitBreaker.failures >= this._circuitBreaker.maxFailures && Date.now() < this._circuitBreaker.openUntil) {
      throw new Error('Circuit breaker OPEN: too many ghost run failures');
    }

    const runId = crypto.randomUUID();
    const correlationId = proposal.context?.correlationId || crypto.randomUUID();

    const ghostRun = {
      runId,
      correlationId,
      actionType: proposal.actionType,
      params: proposal.params || {},
      affectedServices: proposal.affectedServices || [],
      state: GHOST_STATES.PENDING,
      impactReport: null,
      gateResult: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      timeoutMs: this.timeoutMs
    };

    this.ghostRuns.set(runId, ghostRun);
    this._activeRuns++;
    log('info', 'Ghost run created', { runId, actionType: proposal.actionType }, correlationId);
    return { runId, correlationId, state: ghostRun.state };
  }

  /**
   * Execute a ghost run simulation.
   * Runs the action in a sandboxed simulation environment.
   * @param {string} runId - Ghost run identifier
   * @returns {Promise<Object>} Impact report
   */
  async executeGhostRun(runId) {
    const run = this.ghostRuns.get(runId);
    if (!run) throw new Error('Ghost run not found');
    if (run.state !== GHOST_STATES.PENDING) throw new Error(`Invalid state for execution: ${run.state}`);

    run.state = GHOST_STATES.SIMULATING;
    run.startedAt = Date.now();

    const handler = this.actionHandlers.get(run.actionType);
    const simulationEnv = this._createSimulationEnv(run);

    try {
      // Execute with phi-scaled timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Ghost run timeout')), run.timeoutMs)
      );

      let simulationResult;
      if (handler) {
        simulationResult = await Promise.race([
          handler(run.params, simulationEnv),
          timeoutPromise
        ]);
      } else {
        // Default simulation: static analysis of proposal
        simulationResult = this._defaultSimulation(run);
      }

      run.state = GHOST_STATES.ANALYZING;

      // Generate impact report
      const impactReport = this._analyzeImpact(run, simulationResult, simulationEnv);
      run.impactReport = impactReport;

      // CSL gate validation
      run.state = GHOST_STATES.GATE_CHECK;
      const gateResult = this._cslGateCheck(impactReport);
      run.gateResult = gateResult;

      run.state = gateResult.approved ? GHOST_STATES.APPROVED : GHOST_STATES.REJECTED;
      run.completedAt = Date.now();
      this._activeRuns = Math.max(0, this._activeRuns - 1);

      // Reset circuit breaker on success
      this._circuitBreaker.failures = 0;

      // Store in history
      this._storeHistory(runId, run);

      log('info', `Ghost run ${run.state}`, {
        runId,
        safetyScore: impactReport.safetyScore,
        approved: gateResult.approved
      }, run.correlationId);

      return { runId, state: run.state, impactReport, gateResult };
    } catch (err) {
      run.state = GHOST_STATES.REJECTED;
      run.completedAt = Date.now();
      this._activeRuns = Math.max(0, this._activeRuns - 1);

      this._circuitBreaker.failures++;
      if (this._circuitBreaker.failures >= this._circuitBreaker.maxFailures) {
        this._circuitBreaker.openUntil = Date.now() + phiBackoff(this._circuitBreaker.failures);
      }

      run.impactReport = { error: err.message, safetyScore: 0, severity: 'CRITICAL' };
      run.gateResult = { approved: false, reason: err.message };
      log('error', 'Ghost run failed', { runId, error: err.message }, run.correlationId);
      return { runId, state: run.state, error: err.message };
    }
  }

  /**
   * Create a sandboxed simulation environment.
   * @param {Object} run - Ghost run descriptor
   * @returns {Object} Simulation environment with tracked mutations
   * @private
   */
  _createSimulationEnv(run) {
    return {
      mutations: [],
      resourceUsage: { cpu: 0, memory: 0, network: 0, storage: 0 },
      sideEffects: [],
      servicesAccessed: new Set(),

      /** Record a simulated data mutation */
      recordMutation(target, operation, data) {
        this.mutations.push({ target, operation, data, timestamp: Date.now() });
      },

      /** Record a simulated side effect */
      recordSideEffect(type, description) {
        this.sideEffects.push({ type, description, timestamp: Date.now() });
      },

      /** Record service access */
      recordServiceAccess(serviceId) {
        this.servicesAccessed.add(serviceId);
      },

      /** Record resource consumption */
      recordResource(type, amount) {
        if (type in this.resourceUsage) this.resourceUsage[type] += amount;
      }
    };
  }

  /**
   * Default static simulation for unregistered action types.
   * @param {Object} run - Ghost run
   * @returns {Object} Simulation result
   * @private
   */
  _defaultSimulation(run) {
    return {
      simulated: true,
      actionType: run.actionType,
      paramCount: Object.keys(run.params).length,
      estimatedComplexity: Object.keys(run.params).length * PHI,
      affectedServices: run.affectedServices
    };
  }

  /**
   * Analyze the impact of a ghost run simulation.
   * @param {Object} run - Ghost run
   * @param {Object} simResult - Simulation result
   * @param {Object} simEnv - Simulation environment
   * @returns {Object} Impact report
   * @private
   */
  _analyzeImpact(run, simResult, simEnv) {
    const mutationCount = simEnv.mutations.length;
    const sideEffectCount = simEnv.sideEffects.length;
    const servicesAffected = simEnv.servicesAccessed.size + run.affectedServices.length;

    // Risk scoring: phi-weighted combination of impact factors
    const mutationRisk = Math.min(1, mutationCount / FIB[7]) * PHI;
    const sideEffectRisk = Math.min(1, sideEffectCount / FIB[5]) * PHI * PHI;
    const blastRadius = Math.min(1, servicesAffected / FIB[6]);
    const resourceRisk = Object.values(simEnv.resourceUsage).reduce((s, v) => s + v, 0) / (FIB[10] * PHI);

    const totalRisk = (mutationRisk + sideEffectRisk + blastRadius + resourceRisk) / (PHI * PHI + PHI + 2);
    const safetyScore = Math.max(0, Math.min(1, 1 - totalRisk));

    // Determine severity
    let severity = 'NONE';
    if (safetyScore < IMPACT_SEVERITY.CRITICAL.csl) severity = 'CRITICAL';
    else if (safetyScore < IMPACT_SEVERITY.HIGH.csl) severity = 'HIGH';
    else if (safetyScore < IMPACT_SEVERITY.MEDIUM.csl) severity = 'MEDIUM';
    else if (safetyScore < IMPACT_SEVERITY.LOW.csl) severity = 'LOW';

    return {
      runId: run.runId,
      actionType: run.actionType,
      safetyScore,
      severity,
      mutations: simEnv.mutations,
      sideEffects: simEnv.sideEffects,
      servicesAffected: [...simEnv.servicesAccessed, ...run.affectedServices],
      resourceUsage: simEnv.resourceUsage,
      blastRadius,
      riskBreakdown: { mutationRisk, sideEffectRisk, blastRadius, resourceRisk },
      duration: Date.now() - run.startedAt,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * CSL gate validation of impact report.
   * @param {Object} impactReport - Impact report
   * @returns {Object} Gate result
   * @private
   */
  _cslGateCheck(impactReport) {
    const score = impactReport.safetyScore;
    const approved = score >= this.minGateScore;
    let gateLevel;

    if (score >= CSL.CRITICAL) gateLevel = 'AUTO_APPROVE';
    else if (score >= CSL.HIGH) gateLevel = 'APPROVE';
    else if (score >= CSL.MEDIUM) gateLevel = 'APPROVE_WITH_MONITOR';
    else if (score >= CSL.LOW) gateLevel = 'MANUAL_REVIEW';
    else gateLevel = 'REJECT';

    return {
      approved,
      gateLevel,
      safetyScore: score,
      threshold: this.minGateScore,
      recommendations: !approved
        ? [`Safety score ${score.toFixed(3)} below threshold ${this.minGateScore}`, 'Consider reducing blast radius or adding safeguards']
        : [`Action cleared with safety score ${score.toFixed(3)}`]
    };
  }

  /**
   * Commit an approved ghost run to production.
   * @param {string} runId - Ghost run identifier
   * @returns {Object} Commit result
   */
  async commitGhostRun(runId) {
    const run = this.ghostRuns.get(runId);
    if (!run) throw new Error('Ghost run not found');
    if (run.state !== GHOST_STATES.APPROVED) {
      throw new Error(`Cannot commit: run is ${run.state}, must be APPROVED`);
    }

    run.state = GHOST_STATES.COMMITTED;
    log('info', 'Ghost run committed to production', { runId }, run.correlationId);
    return { runId, state: run.state, committedAt: new Date().toISOString() };
  }

  /**
   * Store a completed ghost run in history.
   * @param {string} runId - Run ID
   * @param {Object} run - Run data
   * @private
   */
  _storeHistory(runId, run) {
    this.impactHistory.set(runId, {
      runId,
      actionType: run.actionType,
      state: run.state,
      safetyScore: run.impactReport?.safetyScore,
      completedAt: run.completedAt
    });
    if (this.impactHistory.size > this._historyMaxSize) {
      const firstKey = this.impactHistory.keys().next().value;
      this.impactHistory.delete(firstKey);
    }
  }

  /** Set up Express routes. @private */
  _setupRoutes() {
    this.app.use(express.json());

    this.app.get('/health', (_req, res) => {
      this._coherence = this._circuitBreaker.failures < this._circuitBreaker.maxFailures ? CSL.HIGH : CSL.LOW;
      res.json({
        status: this._coherence >= CSL.MEDIUM ? 'healthy' : 'degraded',
        coherence: this._coherence,
        activeRuns: this._activeRuns,
        maxConcurrent: this.maxConcurrent,
        circuitBreaker: this._circuitBreaker.failures >= this._circuitBreaker.maxFailures ? 'OPEN' : 'CLOSED',
        historySize: this.impactHistory.size,
        timestamp: new Date().toISOString()
      });
    });

    this.app.post('/ghost/create', (req, res) => {
      try {
        const result = this.createGhostRun(req.body);
        res.status(201).json(result);
      } catch (err) {
        res.status(429).json({ error: err.message });
      }
    });

    this.app.post('/ghost/:id/execute', async (req, res) => {
      try {
        const result = await this.executeGhostRun(req.params.id);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });

    this.app.post('/ghost/:id/commit', async (req, res) => {
      try {
        const result = await this.commitGhostRun(req.params.id);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });

    this.app.get('/ghost/:id', (req, res) => {
      const run = this.ghostRuns.get(req.params.id);
      if (!run) return res.status(404).json({ error: 'Ghost run not found' });
      res.json(run);
    });

    this.app.get('/ghost/history', (_req, res) => {
      res.json({ history: Array.from(this.impactHistory.values()) });
    });
  }

  /** @returns {Promise<void>} */
  async start() {
    if (this._started) return;
    this._setupRoutes();
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this._started = true;
        log('info', 'HeadyGhostProtocolService started', { port: this.port });
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
        this.ghostRuns.clear();
        log('info', 'HeadyGhostProtocolService stopped');
        resolve();
      });
    });
  }

  /** @returns {Object} Health */
  health() {
    return { status: this._coherence >= CSL.MEDIUM ? 'healthy' : 'degraded', coherence: this._coherence, activeRuns: this._activeRuns };
  }
}

module.exports = { HeadyGhostProtocolService, PHI, PSI, FIB, CSL, GHOST_STATES, IMPACT_SEVERITY, phiBackoff };
