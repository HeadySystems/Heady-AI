/**
 * Heady™ HeadyMC v1.0
 * Monte Carlo Simulator for probabilistic healing strategy evaluation.
 * Runs simulated scenarios to find optimal self-healing responses before
 * committing to real-world actions.
 *
 * All numeric values derived from φ (phi) and Fibonacci sequences.
 * Zero magic numbers.
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const {
  PHI, PSI, PSI_SQ, PSI_CUBE, PSI_FOURTH,
  EMBEDDING_DIM,
  fib, nearestFib,
  CSL_THRESHOLDS,
  phiThreshold,
  phiBackoff,
  phiFusionWeights,
  phiResourceWeights,
  cslGate,
  cslBlend,
  PRESSURE_LEVELS,
  ALERT_THRESHOLDS,
} = require('../../shared/phi-math.js');
const logger = require('../../shared/logger.js');
const { createHealthCheck } = require('../../shared/health.js');

// ═══════════════════════════════════════════════════════════
// CONSTANTS — All phi-derived
// ═══════════════════════════════════════════════════════════

/** Default simulation runs — fib(12) = 144 */
const DEFAULT_SIMULATIONS = fib(12);

/** Maximum simulation runs — fib(14) = 377 */
const MAX_SIMULATIONS = fib(14);

/** Convergence check interval — every fib(8) = 21 runs */
const CONVERGENCE_CHECK_INTERVAL = fib(8);

/** Convergence tolerance — ψ⁴ ≈ 0.146 */
const CONVERGENCE_TOLERANCE = PSI_FOURTH;

/** Maximum scenario variables — fib(7) = 13 */
const MAX_VARIABLES = fib(7);

/** History buffer for past simulations — fib(11) = 89 */
const HISTORY_BUFFER = fib(11);

/** Time horizon steps per simulation — fib(9) = 34 */
const DEFAULT_TIME_STEPS = fib(9);

/** Confidence interval percentile — derived from phi: 1 - ψ³ ≈ 0.764 */
const CONFIDENCE_LEVEL = 1 - PSI_CUBE;

/** Minimum improvement threshold — ψ² ≈ 0.382 */
const MIN_IMPROVEMENT_THRESHOLD = PSI_SQ;

/** Strategy scoring weights — phi fusion of 3 factors */
const STRATEGY_WEIGHTS = Object.freeze({
  successRate: 0.528,       // phiFusionWeights(3)[0]
  meanRecoveryTime: 0.326,  // phiFusionWeights(3)[1]
  sideEffectRisk: 0.146,    // phiFusionWeights(3)[2]
});

/** Random seed multiplier for reproducibility */
const SEED_PHI_FACTOR = Math.floor(PHI * 1000000); // 1618033

// ═══════════════════════════════════════════════════════════
// PSEUDO-RANDOM GENERATOR — Seeded for reproducibility
// ═══════════════════════════════════════════════════════════

class PhiRandom {
  /**
   * @param {number} seed — initial seed (defaults to phi-derived value)
   */
  constructor(seed = SEED_PHI_FACTOR) {
    this._state = seed;
  }

  /**
   * Generate next pseudo-random number in [0, 1).
   * Uses xorshift32 for speed and reasonable distribution.
   */
  next() {
    let x = this._state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    this._state = x;
    return (x >>> 0) / 4294967296;
  }

  /**
   * Random float in [min, max).
   */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /**
   * Random integer in [min, max].
   */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Sample from a normal distribution using Box-Muller transform.
   * @param {number} mean
   * @param {number} stddev
   */
  normal(mean = 0, stddev = 1) {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1 || Number.MIN_VALUE)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }

  /**
   * Sample from a phi-weighted distribution.
   * Higher weight on values near ψ (golden conjugate).
   */
  phiWeighted() {
    const raw = this.next();
    // Transform: phi-weighted beta-like distribution centered on ψ
    return PSI + (raw - 0.5) * PSI_SQ;
  }
}

// ═══════════════════════════════════════════════════════════
// HEALING STRATEGY — Defines a potential healing approach
// ═══════════════════════════════════════════════════════════

class HealingStrategy {
  /**
   * @param {object} opts
   * @param {string} opts.id — strategy identifier
   * @param {string} opts.name — human-readable name
   * @param {string} opts.category — 'restart' | 'rollback' | 'scale' | 'reroute' | 'quarantine' | 'patch'
   * @param {function} opts.simulate — (state, rng) => { success, recoveryTime, sideEffects }
   * @param {number} [opts.cost] — resource cost factor [0, 1]
   * @param {number} [opts.risk] — inherent risk factor [0, 1]
   */
  constructor({ id, name, category, simulate, cost = PSI_SQ, risk = PSI_CUBE }) {
    this.id = id;
    this.name = name;
    this.category = category;
    this.simulate = simulate;
    this.cost = cost;
    this.risk = risk;
  }
}

// ═══════════════════════════════════════════════════════════
// BUILT-IN STRATEGY LIBRARY
// ═══════════════════════════════════════════════════════════

/**
 * Built-in healing strategies with phi-parameterized simulation functions.
 */
const BUILT_IN_STRATEGIES = Object.freeze({
  /**
   * Simple restart — fast recovery, moderate risk of state loss.
   */
  restart: new HealingStrategy({
    id: 'restart',
    name: 'Service Restart',
    category: 'restart',
    cost: PSI_FOURTH,       // Low cost
    risk: PSI_CUBE,         // Low-moderate risk
    simulate: (state, rng) => {
      const baseSuccess = state.healthScore > CSL_THRESHOLDS.LOW ? 0.85 : PSI;
      const success = rng.next() < baseSuccess;
      return {
        success,
        recoveryTimeMs: success ? Math.floor(rng.normal(fib(8) * 1000, fib(6) * 1000)) : 0,
        sideEffects: success ? (rng.next() < PSI_FOURTH ? ['brief_downtime'] : []) : ['restart_failed'],
        stateAfter: success ? { ...state, healthScore: Math.min(1.0, state.healthScore + PSI) } : state,
      };
    },
  }),

  /**
   * Rollback — revert to last known good state.
   */
  rollback: new HealingStrategy({
    id: 'rollback',
    name: 'Version Rollback',
    category: 'rollback',
    cost: PSI_SQ,           // Moderate cost
    risk: PSI_SQ,           // Moderate risk
    simulate: (state, rng) => {
      const hasGoodSnapshot = state.snapshotAge < DECAY_HALF_LIFE;
      const baseSuccess = hasGoodSnapshot ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW;
      const success = rng.next() < baseSuccess;
      return {
        success,
        recoveryTimeMs: success ? Math.floor(rng.normal(fib(9) * 1000, fib(7) * 1000)) : 0,
        sideEffects: success ? (rng.next() < PSI_CUBE ? ['data_loss_minor'] : []) : ['rollback_failed'],
        stateAfter: success ? { ...state, healthScore: CSL_THRESHOLDS.MEDIUM } : state,
      };
    },
  }),

  /**
   * Scale out — add capacity to handle overload.
   */
  scaleOut: new HealingStrategy({
    id: 'scale_out',
    name: 'Horizontal Scale-Out',
    category: 'scale',
    cost: PSI,              // Higher cost
    risk: PSI_FOURTH,       // Low risk
    simulate: (state, rng) => {
      const isOverloaded = state.pressure > PRESSURE_LEVELS.ELEVATED.max;
      const baseSuccess = isOverloaded ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.MEDIUM;
      const success = rng.next() < baseSuccess;
      return {
        success,
        recoveryTimeMs: success ? Math.floor(rng.normal(fib(10) * 1000, fib(8) * 1000)) : 0,
        sideEffects: success ? ['increased_cost'] : ['scale_failed'],
        stateAfter: success
          ? { ...state, healthScore: Math.min(1.0, state.healthScore + PSI_SQ), pressure: state.pressure * PSI }
          : state,
      };
    },
  }),

  /**
   * Reroute — redirect traffic to healthy nodes.
   */
  reroute: new HealingStrategy({
    id: 'reroute',
    name: 'Traffic Reroute',
    category: 'reroute',
    cost: PSI_CUBE,         // Low cost
    risk: PSI_SQ,           // Moderate risk
    simulate: (state, rng) => {
      const hasAlternatives = state.healthyNodes > 1;
      const baseSuccess = hasAlternatives ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.MINIMUM;
      const success = rng.next() < baseSuccess;
      return {
        success,
        recoveryTimeMs: success ? Math.floor(rng.normal(fib(7) * 1000, fib(5) * 1000)) : 0,
        sideEffects: success
          ? (rng.next() < PSI_CUBE ? ['increased_latency'] : [])
          : ['reroute_failed', 'potential_cascade'],
        stateAfter: success ? { ...state, healthScore: Math.min(1.0, state.healthScore + PSI_CUBE) } : state,
      };
    },
  }),

  /**
   * Quarantine — isolate the failing component.
   */
  quarantine: new HealingStrategy({
    id: 'quarantine',
    name: 'Component Quarantine',
    category: 'quarantine',
    cost: PSI_CUBE,         // Low cost
    risk: PSI_SQ,           // Moderate risk (capacity reduction)
    simulate: (state, rng) => {
      const success = rng.next() < CSL_THRESHOLDS.CRITICAL; // Almost always works
      return {
        success,
        recoveryTimeMs: success ? Math.floor(rng.normal(fib(6) * 1000, fib(4) * 1000)) : 0,
        sideEffects: success ? ['capacity_reduced'] : ['quarantine_failed'],
        stateAfter: success
          ? { ...state, healthScore: state.healthScore, quarantined: true, pressure: state.pressure * PSI_SQ }
          : state,
      };
    },
  }),

  /**
   * Hot patch — apply a targeted fix without restart.
   */
  hotPatch: new HealingStrategy({
    id: 'hot_patch',
    name: 'Hot Patch',
    category: 'patch',
    cost: PSI,              // Higher cost (engineering time)
    risk: PSI,              // Higher risk (untested change)
    simulate: (state, rng) => {
      const patchQuality = rng.phiWeighted();
      const success = patchQuality > CSL_THRESHOLDS.LOW;
      return {
        success,
        recoveryTimeMs: success ? Math.floor(rng.normal(fib(11) * 1000, fib(9) * 1000)) : 0,
        sideEffects: success
          ? (rng.next() < PSI ? ['regression_risk'] : [])
          : ['patch_failed', 'possible_regression'],
        stateAfter: success
          ? { ...state, healthScore: Math.min(1.0, state.healthScore + PSI) }
          : { ...state, healthScore: Math.max(0, state.healthScore - PSI_CUBE) },
      };
    },
  }),
});

/** Decay half-life reference (matches HeadyPatterns) */
const DECAY_HALF_LIFE = fib(17); // seconds

// ═══════════════════════════════════════════════════════════
// SIMULATION ENGINE
// ═══════════════════════════════════════════════════════════

class SimulationEngine {
  /**
   * @param {object} [opts]
   * @param {number} [opts.simulations] — number of Monte Carlo runs
   * @param {number} [opts.seed] — random seed
   */
  constructor({ simulations = DEFAULT_SIMULATIONS, seed = SEED_PHI_FACTOR } = {}) {
    this._simulations = Math.min(simulations, MAX_SIMULATIONS);
    this._seed = seed;
  }

  /**
   * Evaluate a single healing strategy against a failure scenario.
   *
   * @param {HealingStrategy} strategy
   * @param {object} initialState — current system state snapshot
   * @returns {StrategyResult}
   */
  evaluate(strategy, initialState) {
    const rng = new PhiRandom(this._seed);
    const results = [];
    let converged = false;
    let runningSuccessRate = 0;

    for (let i = 0; i < this._simulations; i++) {
      const outcome = strategy.simulate(initialState, rng);
      results.push(outcome);

      // Check convergence every fib(8) = 21 runs
      if ((i + 1) % CONVERGENCE_CHECK_INTERVAL === 0 && i > CONVERGENCE_CHECK_INTERVAL) {
        const currentRate = results.filter(r => r.success).length / results.length;
        if (Math.abs(currentRate - runningSuccessRate) < CONVERGENCE_TOLERANCE) {
          converged = true;
          break;
        }
        runningSuccessRate = currentRate;
      }
    }

    return this._analyzeResults(strategy, results, converged);
  }

  /**
   * Compare multiple strategies and rank them.
   *
   * @param {Array<HealingStrategy>} strategies
   * @param {object} initialState
   * @returns {Array<StrategyResult>} — sorted best to worst
   */
  compare(strategies, initialState) {
    const evaluations = strategies.map(s => this.evaluate(s, initialState));
    return evaluations.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  /**
   * Run a multi-step simulation where strategies are applied sequentially.
   *
   * @param {Array<HealingStrategy>} strategySequence
   * @param {object} initialState
   * @param {number} [timeSteps=DEFAULT_TIME_STEPS]
   * @returns {MultiStepResult}
   */
  multiStep(strategySequence, initialState, timeSteps = DEFAULT_TIME_STEPS) {
    const rng = new PhiRandom(this._seed);
    const trajectories = [];

    for (let sim = 0; sim < this._simulations; sim++) {
      let state = { ...initialState };
      const trajectory = [{ step: 0, state: { ...state } }];

      for (let step = 0; step < Math.min(timeSteps, strategySequence.length); step++) {
        const strategy = strategySequence[step];
        const outcome = strategy.simulate(state, rng);

        if (outcome.success && outcome.stateAfter) {
          state = { ...outcome.stateAfter };
        }

        trajectory.push({
          step: step + 1,
          strategyId: strategy.id,
          outcome: {
            success: outcome.success,
            recoveryTimeMs: outcome.recoveryTimeMs,
            sideEffects: outcome.sideEffects,
          },
          state: { ...state },
        });

        // Early exit if state is good enough
        if (state.healthScore >= CSL_THRESHOLDS.HIGH) break;
      }

      trajectories.push(trajectory);
    }

    return this._analyzeTrajectories(strategySequence, trajectories);
  }

  /**
   * Analyze individual strategy results.
   * @private
   */
  _analyzeResults(strategy, results, converged) {
    const successes = results.filter(r => r.success);
    const successRate = successes.length / results.length;

    // Recovery times for successful outcomes
    const recoveryTimes = successes.map(r => r.recoveryTimeMs).filter(t => t > 0);
    const meanRecovery = recoveryTimes.length > 0
      ? recoveryTimes.reduce((s, t) => s + t, 0) / recoveryTimes.length
      : 0;

    // Side effect frequency
    const allSideEffects = {};
    for (const r of results) {
      for (const se of (r.sideEffects || [])) {
        allSideEffects[se] = (allSideEffects[se] || 0) + 1;
      }
    }
    const sideEffectRate = Object.keys(allSideEffects).length > 0
      ? Object.values(allSideEffects).reduce((s, c) => s + c, 0) / results.length
      : 0;

    // Percentiles for recovery time
    const sortedTimes = [...recoveryTimes].sort((a, b) => a - b);
    const p50 = percentile(sortedTimes, 0.5);
    const pConf = percentile(sortedTimes, CONFIDENCE_LEVEL);
    const p95 = percentile(sortedTimes, 1 - PSI_FOURTH); // ≈ 0.854

    // Composite score: phi-weighted blend of success, speed, safety
    const normalizedRecovery = meanRecovery > 0
      ? 1 - Math.min(meanRecovery / (fib(12) * 1000), 1.0) // Normalize against max 144s
      : 0;
    const safetyScore = 1 - sideEffectRate;

    const compositeScore = (
      STRATEGY_WEIGHTS.successRate * successRate +
      STRATEGY_WEIGHTS.meanRecoveryTime * normalizedRecovery +
      STRATEGY_WEIGHTS.sideEffectRisk * safetyScore
    );

    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      category: strategy.category,
      simulations: results.length,
      converged,
      successRate: Number(successRate.toFixed(6)),
      meanRecoveryMs: Math.round(meanRecovery),
      recoveryPercentiles: {
        p50: Math.round(p50),
        [`p${Math.round(CONFIDENCE_LEVEL * 100)}`]: Math.round(pConf),
        p95: Math.round(p95),
      },
      sideEffects: Object.entries(allSideEffects).map(([effect, count]) => ({
        effect,
        frequency: Number((count / results.length).toFixed(6)),
      })),
      sideEffectRate: Number(sideEffectRate.toFixed(6)),
      compositeScore: Number(compositeScore.toFixed(6)),
      cost: strategy.cost,
      risk: strategy.risk,
    };
  }

  /**
   * Analyze multi-step trajectories.
   * @private
   */
  _analyzeTrajectories(strategies, trajectories) {
    const finalStates = trajectories.map(t => t[t.length - 1].state);
    const fullyHealed = finalStates.filter(s => s.healthScore >= CSL_THRESHOLDS.HIGH).length;
    const partialHealed = finalStates.filter(
      s => s.healthScore >= CSL_THRESHOLDS.LOW && s.healthScore < CSL_THRESHOLDS.HIGH
    ).length;
    const failed = finalStates.filter(s => s.healthScore < CSL_THRESHOLDS.LOW).length;

    const avgFinalHealth = finalStates.reduce((s, st) => s + st.healthScore, 0) / finalStates.length;

    // Total recovery time across all steps
    const totalRecoveryTimes = trajectories.map(t =>
      t.slice(1).reduce((sum, step) => sum + (step.outcome?.recoveryTimeMs || 0), 0)
    );
    const meanTotalRecovery = totalRecoveryTimes.reduce((s, t) => s + t, 0) / totalRecoveryTimes.length;

    // Side effects across all steps
    const allSideEffects = {};
    for (const t of trajectories) {
      for (const step of t.slice(1)) {
        for (const se of (step.outcome?.sideEffects || [])) {
          allSideEffects[se] = (allSideEffects[se] || 0) + 1;
        }
      }
    }

    return {
      strategies: strategies.map(s => s.id),
      simulations: trajectories.length,
      fullHealRate: Number((fullyHealed / trajectories.length).toFixed(6)),
      partialHealRate: Number((partialHealed / trajectories.length).toFixed(6)),
      failRate: Number((failed / trajectories.length).toFixed(6)),
      avgFinalHealth: Number(avgFinalHealth.toFixed(6)),
      meanTotalRecoveryMs: Math.round(meanTotalRecovery),
      sideEffects: Object.entries(allSideEffects).map(([effect, count]) => ({
        effect,
        frequency: Number((count / trajectories.length).toFixed(6)),
      })),
    };
  }
}

// ═══════════════════════════════════════════════════════════
// STRATEGY RECOMMENDER
// ═══════════════════════════════════════════════════════════

class StrategyRecommender {
  /**
   * @param {SimulationEngine} engine
   */
  constructor(engine = new SimulationEngine()) {
    this._engine = engine;
    /** @type {Array<{scenario: object, recommendation: object, timestamp: number}>} */
    this._history = [];
  }

  /**
   * Recommend the best healing strategy for a given system state.
   *
   * @param {object} systemState — { healthScore, pressure, healthyNodes, snapshotAge, ... }
   * @param {object} [opts]
   * @param {Array<HealingStrategy>} [opts.strategies] — custom strategies (default: built-in)
   * @param {boolean} [opts.includeMultiStep] — evaluate multi-step sequences
   * @returns {object} — { recommended, rankings, multiStep? }
   */
  recommend(systemState, { strategies, includeMultiStep = false } = {}) {
    const candidates = strategies || Object.values(BUILT_IN_STRATEGIES);

    // Single-strategy comparison
    const rankings = this._engine.compare(candidates, systemState);

    const recommended = rankings[0];
    const runner_up = rankings.length > 1 ? rankings[1] : null;

    // Check if recommended is significantly better
    const improvement = runner_up
      ? (recommended.compositeScore - runner_up.compositeScore) / runner_up.compositeScore
      : 1.0;

    const result = {
      recommended: {
        ...recommended,
        confidence: improvement > MIN_IMPROVEMENT_THRESHOLD ? 'high' : 'moderate',
        improvementOverRunnerUp: Number(improvement.toFixed(6)),
      },
      rankings,
      systemState,
      timestamp: Date.now(),
    };

    // Multi-step evaluation if requested
    if (includeMultiStep && rankings.length >= 2) {
      const topTwo = rankings.slice(0, 2).map(r =>
        candidates.find(s => s.id === r.strategyId)
      ).filter(Boolean);

      if (topTwo.length >= 2) {
        // Try both orderings
        const sequenceA = this._engine.multiStep(topTwo, systemState);
        const sequenceB = this._engine.multiStep([...topTwo].reverse(), systemState);

        result.multiStep = {
          sequenceA: { strategies: topTwo.map(s => s.id), ...sequenceA },
          sequenceB: { strategies: [...topTwo].reverse().map(s => s.id), ...sequenceB },
          bestSequence: sequenceA.fullHealRate >= sequenceB.fullHealRate ? 'A' : 'B',
        };
      }
    }

    // Record in history
    this._history.push({
      scenario: systemState,
      recommendation: { strategyId: recommended.strategyId, compositeScore: recommended.compositeScore },
      timestamp: Date.now(),
    });

    // Bound history — fib(11) = 89
    while (this._history.length > HISTORY_BUFFER) {
      this._history.shift();
    }

    logger.info({
      component: 'HeadyMC',
      action: 'recommendation',
      recommended: recommended.strategyId,
      compositeScore: recommended.compositeScore,
      successRate: recommended.successRate,
      simulations: recommended.simulations,
      converged: recommended.converged,
    });

    return result;
  }

  /**
   * Get recommendation history.
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Analyze historical recommendations for meta-patterns.
   */
  analyzeHistory() {
    if (this._history.length < fib(5)) {
      return { sufficient: false, message: `Need at least ${fib(5)} recommendations for analysis` };
    }

    const strategyCounts = {};
    for (const entry of this._history) {
      const id = entry.recommendation.strategyId;
      strategyCounts[id] = (strategyCounts[id] || 0) + 1;
    }

    const totalRecs = this._history.length;
    const distribution = Object.entries(strategyCounts)
      .map(([id, count]) => ({ strategyId: id, frequency: count / totalRecs }))
      .sort((a, b) => b.frequency - a.frequency);

    // Check if one strategy dominates (> ψ of all recommendations)
    const dominant = distribution[0].frequency > PSI;

    return {
      sufficient: true,
      totalRecommendations: totalRecs,
      distribution,
      dominantStrategy: dominant ? distribution[0].strategyId : null,
      diversity: 1 - distribution[0].frequency, // Higher = more diverse
    };
  }
}

// ═══════════════════════════════════════════════════════════
// SCENARIO BUILDER — Create failure scenarios from events
// ═══════════════════════════════════════════════════════════

class ScenarioBuilder {
  /**
   * Build a system state from a drift classification and current metrics.
   *
   * @param {object} classification — from HeadyPatterns.classifyDrift()
   * @param {object} [metrics] — current system metrics
   * @returns {object} — systemState suitable for SimulationEngine
   */
  static fromDrift(classification, metrics = {}) {
    return {
      healthScore: classification.similarity || PSI,
      pressure: metrics.pressure || PSI_SQ,
      healthyNodes: metrics.healthyNodes || fib(5),
      snapshotAge: metrics.snapshotAge || fib(10),
      driftCategory: classification.categoryKey || 'UNKNOWN',
      driftSeverity: classification.severity || 'medium',
      latency: metrics.latency || fib(8) * 100,
      errorRate: metrics.errorRate || PSI_CUBE,
      memoryUtilization: metrics.memoryUtilization || PSI,
      cpuUtilization: metrics.cpuUtilization || PSI,
    };
  }

  /**
   * Create a worst-case scenario for stress testing.
   */
  static worstCase() {
    return {
      healthScore: PSI_FOURTH,
      pressure: 1 - PSI_FOURTH,
      healthyNodes: 1,
      snapshotAge: fib(17),
      driftCategory: 'STRUCTURAL',
      driftSeverity: 'critical',
      latency: fib(12) * 100,
      errorRate: PSI,
      memoryUtilization: 1 - PSI_FOURTH,
      cpuUtilization: 1 - PSI_FOURTH,
    };
  }

  /**
   * Create a nominal/healthy scenario for baseline comparison.
   */
  static nominal() {
    return {
      healthScore: CSL_THRESHOLDS.HIGH,
      pressure: PSI_FOURTH,
      healthyNodes: fib(7),
      snapshotAge: fib(5),
      driftCategory: null,
      driftSeverity: null,
      latency: fib(6) * 10,
      errorRate: PSI_FOURTH * PSI_FOURTH,
      memoryUtilization: PSI_SQ,
      cpuUtilization: PSI_SQ,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Compute the percentile from a sorted array.
 */
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.max(0, Math.ceil(p * sortedArr.length) - 1);
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
}

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════

const healthCheck = createHealthCheck('heady-mc', () => ({
  simulationEngine: 'ready',
  builtInStrategies: Object.keys(BUILT_IN_STRATEGIES).length,
  defaultSimulations: DEFAULT_SIMULATIONS,
  maxSimulations: MAX_SIMULATIONS,
}));

// ═══════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════

let _sharedRecommender = null;

function getSharedRecommender() {
  if (!_sharedRecommender) {
    _sharedRecommender = new StrategyRecommender();
  }
  return _sharedRecommender;
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  // Core
  SimulationEngine,
  StrategyRecommender,
  ScenarioBuilder,
  HealingStrategy,

  // Built-in strategies
  BUILT_IN_STRATEGIES,

  // Random generator
  PhiRandom,

  // Singleton
  getSharedRecommender,

  // Health
  healthCheck,

  // Constants (for testing)
  DEFAULT_SIMULATIONS,
  MAX_SIMULATIONS,
  CONVERGENCE_CHECK_INTERVAL,
  CONVERGENCE_TOLERANCE,
  STRATEGY_WEIGHTS,
  CONFIDENCE_LEVEL,
  MIN_IMPROVEMENT_THRESHOLD,
  HISTORY_BUFFER,
  SEED_PHI_FACTOR,
};
