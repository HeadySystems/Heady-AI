/**
 * Liquid Rebalance Workflow
 * Monitors Hot/Warm/Cold/Reserve utilization, predicts demand,
 * crystallizes optimal distribution, applies phi-graduated migration.
 * @module liquid-rebalance
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */
'use strict';

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

const IDEAL_POOL_RATIOS = { hot: 0.34, warm: 0.21, cold: 0.13, reserve: 0.08, governance: 0.05 };
const PHI_MIGRATION_STEPS = [0.05, 0.08, 0.13, 0.21, 0.34]; // Fibonacci percentages

class LiquidRebalanceWorkflow {
  constructor(config = {}) {
    this.deviationThreshold = config.deviationThreshold || PSI * 0.1; // ~6.18% deviation triggers rebalance
    this.migrationStepIndex = 0;
    this.state = 'IDLE';
    this.rebalanceHistory = [];
    this.stats = { checks: 0, rebalances: 0, migrations: 0, totalMigrated: 0 };
  }

  /**
   * Execute liquid pool rebalance cycle
   * @param {object} poolState — { hot: {count, capacity}, warm: {...}, cold: {...}, reserve: {...}, governance: {...} }
   * @returns {object} — rebalance plan and execution result
   */
  async execute(poolState) {
    this.state = 'ANALYZING';
    this.stats.checks++;
    const correlationId = `rebalance-${Date.now().toString(36)}`;

    // Phase 1: Measure current distribution
    const distribution = this._measureDistribution(poolState);

    // Phase 2: Calculate deviations from ideal
    const deviations = this._calculateDeviations(distribution);

    // Phase 3: Check if rebalance is needed
    const maxDeviation = Math.max(...Object.values(deviations).map(d => Math.abs(d.deviation)));
    if (maxDeviation < this.deviationThreshold) {
      this.state = 'IDLE';
      return { correlationId, status: 'balanced', maxDeviation, threshold: this.deviationThreshold, distribution, timestamp: new Date().toISOString() };
    }

    // Phase 4: Predict demand using recent history
    const demandPrediction = this._predictDemand(poolState);

    // Phase 5: Crystallize optimal distribution
    const optimalDistribution = this._crystallizeOptimal(distribution, demandPrediction);

    // Phase 6: Generate migration plan with phi-graduated steps
    const migrationPlan = this._generateMigrationPlan(distribution, optimalDistribution);

    // Phase 7: Execute migrations
    this.state = 'MIGRATING';
    const executionResult = await this._executeMigrations(migrationPlan, poolState);

    // Phase 8: Verify new distribution
    const verifiedDistribution = this._measureDistribution(poolState);
    const postDeviations = this._calculateDeviations(verifiedDistribution);
    const postMaxDeviation = Math.max(...Object.values(postDeviations).map(d => Math.abs(d.deviation)));

    this.stats.rebalances++;
    this.rebalanceHistory.push({ correlationId, timestamp: Date.now(), preDeviation: maxDeviation, postDeviation: postMaxDeviation, migrations: migrationPlan.length });
    if (this.rebalanceHistory.length > FIB[10]) this.rebalanceHistory.splice(0, this.rebalanceHistory.length - FIB[10]);

    this.state = 'IDLE';
    return {
      correlationId,
      status: postMaxDeviation < this.deviationThreshold ? 'rebalanced' : 'partially-rebalanced',
      preDistribution: distribution,
      postDistribution: verifiedDistribution,
      migrationPlan,
      executionResult,
      improvement: maxDeviation - postMaxDeviation,
      coherence: Math.max(CSL.MINIMUM, 1.0 - postMaxDeviation * PHI),
      timestamp: new Date().toISOString()
    };
  }

  _measureDistribution(poolState) {
    const total = Object.values(poolState).reduce((s, p) => s + (p.count || 0), 0);
    const dist = {};
    for (const [pool, state] of Object.entries(poolState)) {
      dist[pool] = { count: state.count || 0, capacity: state.capacity || FIB[10], ratio: total > 0 ? (state.count || 0) / total : 0, utilization: state.capacity > 0 ? (state.count || 0) / state.capacity : 0 };
    }
    dist._total = total;
    return dist;
  }

  _calculateDeviations(distribution) {
    const deviations = {};
    for (const [pool, ideal] of Object.entries(IDEAL_POOL_RATIOS)) {
      const actual = distribution[pool] ? distribution[pool].ratio : 0;
      deviations[pool] = { actual, ideal, deviation: actual - ideal, absDeviation: Math.abs(actual - ideal), direction: actual > ideal ? 'over' : actual < ideal ? 'under' : 'exact' };
    }
    return deviations;
  }

  _predictDemand(poolState) {
    // Simple demand prediction based on current utilization trends
    const prediction = {};
    for (const [pool, state] of Object.entries(poolState)) {
      const utilization = state.capacity > 0 ? (state.count || 0) / state.capacity : 0;
      const trend = utilization > PSI ? 'growing' : utilization < PSI * PSI ? 'shrinking' : 'stable';
      const predictedDemand = trend === 'growing' ? (state.count || 0) * PHI : trend === 'shrinking' ? (state.count || 0) * PSI : state.count || 0;
      prediction[pool] = { currentUtil: utilization, trend, predictedDemand: Math.round(predictedDemand) };
    }
    return prediction;
  }

  _crystallizeOptimal(distribution, prediction) {
    const optimal = {};
    const total = distribution._total || 1;
    for (const [pool, ideal] of Object.entries(IDEAL_POOL_RATIOS)) {
      const pred = prediction[pool];
      // Blend ideal ratio with predicted demand
      const idealCount = Math.round(ideal * total);
      const predictedCount = pred ? pred.predictedDemand : idealCount;
      const blended = Math.round(idealCount * PSI + predictedCount * (1 - PSI));
      optimal[pool] = { targetCount: blended, targetRatio: total > 0 ? blended / total : ideal };
    }
    return optimal;
  }

  _generateMigrationPlan(currentDist, optimalDist) {
    const plan = [];
    const overPools = [];
    const underPools = [];

    for (const pool of Object.keys(IDEAL_POOL_RATIOS)) {
      const current = currentDist[pool] ? currentDist[pool].count : 0;
      const target = optimalDist[pool] ? optimalDist[pool].targetCount : current;
      const diff = current - target;
      if (diff > 0) overPools.push({ pool, excess: diff });
      else if (diff < 0) underPools.push({ pool, deficit: -diff });
    }

    // Match excess with deficit using phi-graduated steps
    for (const over of overPools) {
      for (const under of underPools) {
        if (over.excess > 0 && under.deficit > 0) {
          const transferAmount = Math.min(over.excess, under.deficit);
          const stepSize = Math.max(1, Math.round(transferAmount * PHI_MIGRATION_STEPS[Math.min(this.migrationStepIndex, PHI_MIGRATION_STEPS.length - 1)]));
          const steps = Math.ceil(transferAmount / stepSize);
          plan.push({ from: over.pool, to: under.pool, totalAmount: transferAmount, stepSize, steps, priority: IDEAL_POOL_RATIOS[under.pool] || 0 });
          over.excess -= transferAmount;
          under.deficit -= transferAmount;
          this.stats.migrations++;
        }
      }
    }

    return plan.sort((a, b) => b.priority - a.priority);
  }

  async _executeMigrations(plan, poolState) {
    const results = [];
    for (const migration of plan) {
      const { from, to, totalAmount, stepSize, steps } = migration;
      let migrated = 0;
      for (let step = 0; step < steps && migrated < totalAmount; step++) {
        const amount = Math.min(stepSize, totalAmount - migrated);
        if (poolState[from] && poolState[from].count >= amount) {
          poolState[from].count -= amount;
          if (!poolState[to]) poolState[to] = { count: 0, capacity: FIB[10] };
          poolState[to].count += amount;
          migrated += amount;
          this.stats.totalMigrated += amount;
        }
      }
      results.push({ from, to, planned: totalAmount, migrated, success: migrated >= totalAmount });
    }
    return results;
  }

  health() {
    return { status: 'ok', workflow: 'liquid-rebalance', state: this.state, stats: { ...this.stats }, historySize: this.rebalanceHistory.length, timestamp: new Date().toISOString() };
  }
}

module.exports = { LiquidRebalanceWorkflow };
