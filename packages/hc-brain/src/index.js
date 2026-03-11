// HEADY_BRAND:BEGIN
// HEADY SYSTEMS :: SACRED GEOMETRY
// FILE: packages/hc-brain/src/index.js
// LAYER: packages/hc-brain
// HEADY_BRAND:END

'use strict';

const EventEmitter = require('events');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

/**
 * SystemBrain — Meta-controller for the Heady orchestration system.
 * Manages concurrency tuning, governance checks, pattern evaluation,
 * and health-aware decision making using phi-scaled thresholds.
 */
class SystemBrain extends EventEmitter {
  constructor(options = {}) {
    super();
    this.serviceCatalog = options.serviceCatalog || {};
    this.resourcePolicies = options.resourcePolicies || {};
    this.conceptsIndex = options.conceptsIndex || {};
    this.governancePolicies = options.governancePolicies || {};

    // Health state tracking
    this.healthState = new Map();
    this.orsHistory = [];
    this.concurrencyMultiplier = 1.0;
    this.decisions = [];
    this.maxDecisionHistory = FIB[8]; // 21
  }

  /**
   * Operational Readiness Score — 0-100 composite health metric.
   */
  computeORS() {
    if (this.healthState.size === 0) return 85; // default healthy

    let totalScore = 0;
    let count = 0;

    for (const [name, health] of this.healthState) {
      const statusScore =
        health.status === 'healthy' ? 100 :
        health.status === 'degraded' ? 60 :
        health.status === 'unhealthy' ? 20 : 0;
      totalScore += statusScore;
      count++;
    }

    const rawScore = count > 0 ? totalScore / count : 85;

    // Apply phi-weighted smoothing with history
    if (this.orsHistory.length > 0) {
      const lastScore = this.orsHistory[this.orsHistory.length - 1];
      const smoothed = rawScore * PSI + lastScore * (1 - PSI);
      const score = Math.round(Math.max(0, Math.min(100, smoothed)));
      this.orsHistory.push(score);
      if (this.orsHistory.length > FIB[8]) this.orsHistory.shift();
      return score;
    }

    const score = Math.round(rawScore);
    this.orsHistory.push(score);
    return score;
  }

  /**
   * Get operational mode based on ORS.
   */
  getMode() {
    const ors = this.computeORS();
    if (ors > 85) return { mode: 'aggressive', ors, parallelism: 'full' };
    if (ors > 70) return { mode: 'normal', ors, parallelism: 'standard' };
    if (ors > 50) return { mode: 'maintenance', ors, parallelism: 'reduced' };
    return { mode: 'recovery', ors, parallelism: 'minimal' };
  }

  /**
   * Update health state for a named check.
   */
  updateHealth(name, status, details = {}) {
    this.healthState.set(name, {
      status,
      details,
      lastUpdated: new Date().toISOString(),
    });
    this.emit('health:updated', { name, status });
  }

  /**
   * Auto-tune concurrency based on error rates and system metrics.
   */
  tuneConcurrency(metrics = {}) {
    const { errorRate = 0, avgLatencyMs = 0, queueDepth = 0 } = metrics;

    let multiplier = this.concurrencyMultiplier;

    // Scale down if errors are high
    if (errorRate > 0.1) {
      multiplier *= PSI; // ~0.618x reduction
    } else if (errorRate > 0.05) {
      multiplier *= (PSI + (1 - PSI) * PSI); // ~0.854x
    } else if (errorRate < 0.01 && queueDepth > FIB[5]) {
      // Scale up if healthy and queue is backing up
      multiplier *= PHI * PSI + PSI; // ~1.618 * 0.618 + 0.618 ≈ 1.618
      multiplier = Math.min(multiplier, PHI); // Cap at phi
    }

    // Latency pressure
    if (avgLatencyMs > FIB[10] * 100) { // > 8900ms
      multiplier *= PSI;
    }

    multiplier = Math.max(PSI * PSI, Math.min(PHI, multiplier)); // Clamp [0.382, 1.618]
    this.concurrencyMultiplier = multiplier;

    const decision = {
      action: 'tune_concurrency',
      multiplier,
      metrics,
      timestamp: new Date().toISOString(),
    };
    this._recordDecision(decision);
    this.emit('concurrency:tuned', decision);

    return {
      multiplier,
      effectiveConcurrency: Math.round(FIB[7] * multiplier),
      recommendation: multiplier < 0.8 ? 'reduce_load' : multiplier > 1.2 ? 'scale_up' : 'stable',
    };
  }

  /**
   * Governance check — validates an action against governance policies.
   */
  checkGovernance(action, actor, domain) {
    const policies = this.governancePolicies;

    // Default allow if no policies defined
    if (!policies || Object.keys(policies).length === 0) {
      return { allowed: true, reason: 'No governance policies configured' };
    }

    const accessControl = policies.accessControl || policies.access_control || {};
    const domains = accessControl.domains || {};
    const domainPolicy = domains[domain] || {};
    const allowedActors = domainPolicy.allowedActors || domainPolicy.allowed_actors || [];

    if (allowedActors.length > 0 && !allowedActors.includes(actor) && !allowedActors.includes('*')) {
      return {
        allowed: false,
        reason: `Actor '${actor}' not permitted for domain '${domain}'`,
        policy: 'access_control',
      };
    }

    return { allowed: true, reason: 'Governance check passed' };
  }

  /**
   * Evaluate a pattern for applicability.
   */
  evaluatePattern(patternId) {
    const concepts = this.conceptsIndex;
    const implemented = concepts.implemented || [];
    const planned = concepts.planned || [];

    const isImplemented = implemented.some(c => c.id === patternId || c.name === patternId);
    const isPlanned = planned.some(c => c.id === patternId || c.name === patternId);

    return {
      patternId,
      status: isImplemented ? 'implemented' : isPlanned ? 'planned' : 'not_tracked',
      recommendation: isImplemented
        ? 'Pattern is active; monitor for drift'
        : isPlanned
          ? 'Pattern is planned; evaluate readiness for integration'
          : 'Pattern not in index; evaluate for addition',
    };
  }

  getStatus() {
    const mode = this.getMode();
    return {
      ...mode,
      healthChecks: Object.fromEntries(this.healthState),
      concurrencyMultiplier: this.concurrencyMultiplier,
      recentDecisions: this.decisions.slice(-FIB[5]),
      timestamp: new Date().toISOString(),
    };
  }

  _recordDecision(decision) {
    this.decisions.push(decision);
    if (this.decisions.length > this.maxDecisionHistory) {
      this.decisions.shift();
    }
  }
}

module.exports = { SystemBrain };
