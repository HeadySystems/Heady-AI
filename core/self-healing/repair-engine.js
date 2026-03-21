'use strict';
/**
 * Heady Self-Healing — Repair Engine
 * Executes repair strategies for drifted components with cooldown protection.
 *
 * © 2026 HeadySystems Inc. — Eric Haywood
 * Architecture: φ-scaled, CSL-gated, Sacred Geometry v4.0
 */

const { EventEmitter } = require('events');

// ─── φ-Math Constants ────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI;

// ─── Repair Strategy Types ──────────────────────────────────────
const REPAIR_STRATEGIES = Object.freeze({
  RESTART:    'restart',
  REINDEX:    'reindex',
  RECALIBRATE: 'recalibrate',
  ROLLBACK:   'rollback',
  ESCALATE:   'escalate',
});

// ─── Strategy Selection: status → preferred strategy ────────────
const STATUS_STRATEGY_MAP = {
  critical:  REPAIR_STRATEGIES.RESTART,
  degraded:  REPAIR_STRATEGIES.RESTART,
  drifting:  REPAIR_STRATEGIES.RECALIBRATE,
};

// ─── RepairEngine ───────────────────────────────────────────────
class RepairEngine extends EventEmitter {
  #strategies = new Map();
  #cooldowns = new Map();     // componentId -> lastRepairTimestamp
  #history = [];              // [{ componentId, strategy, success, timestamp }]
  #repairCooldownMs;

  constructor(options = {}) {
    super();
    this.#repairCooldownMs = options.repairCooldownMs ?? Math.round(PHI * 1000 * 60); // ~97s default
  }

  /**
   * Register a repair strategy handler.
   * @param {string} strategyName - One of REPAIR_STRATEGIES values
   * @param {Function} handler - async (componentId, measurement) => boolean (success)
   */
  registerStrategy(strategyName, handler) {
    this.#strategies.set(strategyName, handler);
  }

  /**
   * Attempt to repair a component.
   * @param {string} componentId
   * @param {object} measurement - { componentType, coherenceScore, status, ... }
   * @returns {{ success, strategy, componentId, timestamp } | null} null if in cooldown
   */
  async repair(componentId, measurement) {
    // Check cooldown
    const lastRepair = this.#cooldowns.get(componentId);
    if (lastRepair && this.#repairCooldownMs > 0) {
      const elapsed = Date.now() - lastRepair;
      if (elapsed < this.#repairCooldownMs) {
        return null; // Still in cooldown
      }
    }

    // Select strategy based on status
    const status = measurement.status || 'degraded';
    const strategyName = STATUS_STRATEGY_MAP[status] || REPAIR_STRATEGIES.RESTART;

    // Find the handler — prefer the mapped strategy, fall back to first registered
    let handler = this.#strategies.get(strategyName);
    let usedStrategy = strategyName;

    if (!handler) {
      // Fall back to first available strategy
      const firstEntry = this.#strategies.entries().next();
      if (firstEntry.done) {
        // No strategies registered
        return { success: false, strategy: 'none', componentId, timestamp: Date.now(), error: 'no_strategy' };
      }
      usedStrategy = firstEntry.value[0];
      handler = firstEntry.value[1];
    }

    // Execute repair
    let success = false;
    try {
      success = await handler(componentId, measurement);
    } catch (err) {
      success = false;
    }

    const record = {
      success: !!success,
      strategy: usedStrategy,
      componentId,
      timestamp: Date.now(),
      coherenceScore: measurement.coherenceScore,
    };

    this.#history.push(record);
    this.#cooldowns.set(componentId, Date.now());

    this.emit('repair:complete', record);
    return record;
  }

  /**
   * Get repair statistics.
   */
  stats() {
    const totalRepairs = this.#history.length;
    const successCount = this.#history.filter(r => r.success).length;

    return {
      totalRepairs,
      successCount,
      failureCount: totalRepairs - successCount,
      successRate: totalRepairs === 0 ? 0 : successCount / totalRepairs,
      history: [...this.#history],
      strategies: Array.from(this.#strategies.keys()),
    };
  }

  /**
   * Shutdown and clean up.
   */
  async shutdown() {
    this.#cooldowns.clear();
    this.removeAllListeners();
  }
}

module.exports = {
  RepairEngine,
  REPAIR_STRATEGIES,
};
