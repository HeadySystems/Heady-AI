// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Bee Factory v1.0.0                                      ║
// ║  Dynamic bee spawning, lifecycle, performance tracking          ║
// ║  with phi-scaled resource management                           ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { EventEmitter } from 'events';
import { PlatformConfig } from '../../config/platform-config.js';
import { randomUUID } from 'crypto';

const PHI = 1.6180339887498948;
const PSI = 0.6180339887498949;

/**
 * BeeFactory — Dynamic agent worker spawning and lifecycle management.
 *
 * Features absorbed from:
 *   - CrewAI: Role/goal/backstory configuration
 *   - AutoGen: Runtime worker creation/retirement
 *   - Heady native: Phi-scaled pool sizing and self-healing
 *
 * Each "bee" is a lightweight agent worker within a swarm.
 * Bees are spawned on demand, tracked for performance, and auto-retired.
 */
export class BeeFactory extends EventEmitter {
  constructor() {
    super();
    this._bees = new Map(); // beeId → BeeState
    this._swarmBees = new Map(); // swarmId → Set<beeId>
    this._templates = new Map(); // beeType → BeeTemplate
    this._performanceLog = new Map(); // beeId → PerformanceStats
  }

  /**
   * Register a bee type template.
   * @param {string} beeType — e.g. 'coder', 'researcher', 'analyzer'
   * @param {object} template — { role, goal, backstory, tools?, systemPrompt? }
   */
  registerTemplate(beeType, template) {
    this._templates.set(beeType, {
      type: beeType,
      role: template.role || beeType,
      goal: template.goal || `Execute ${beeType} tasks`,
      backstory: template.backstory || '',
      tools: template.tools || [],
      systemPrompt: template.systemPrompt || null,
      model: template.model || null,
    });
  }

  /**
   * Spawn a new bee within a swarm.
   *
   * @param {string} beeType — Template type
   * @param {string} swarmId — Parent swarm
   * @param {number} cslScore — CSL confidence from routing (0-1)
   * @returns {object} — Spawned bee instance
   */
  async spawnBee(beeType, swarmId, cslScore = 0.7) {
    const template = this._templates.get(beeType);

    // Check swarm capacity
    const swarmBees = this._swarmBees.get(swarmId) || new Set();
    const maxBees = PlatformConfig.pools.maxSwarmBees;

    if (swarmBees.size >= maxBees) {
      // Try to retire underperforming bees
      const retired = this._retireWorstBee(swarmId);
      if (!retired) {
        this.emit('bee:capacity-exceeded', { swarmId, current: swarmBees.size, max: maxBees });
        return null;
      }
    }

    const beeId = `${beeType}-${randomUUID().slice(0, 8)}`;
    const bee = {
      id: beeId,
      type: beeType,
      swarmId,
      role: template?.role || beeType,
      goal: template?.goal || `Execute ${beeType} tasks`,
      backstory: template?.backstory || '',
      tools: template?.tools || [],
      systemPrompt: template?.systemPrompt || null,
      model: template?.model || null,
      state: 'idle', // idle | active | draining | retired
      cslScore,
      spawnedAt: Date.now(),
      lastActiveAt: null,
      taskCount: 0,
    };

    this._bees.set(beeId, bee);

    if (!this._swarmBees.has(swarmId)) {
      this._swarmBees.set(swarmId, new Set());
    }
    this._swarmBees.get(swarmId).add(beeId);

    this._performanceLog.set(beeId, {
      successes: 0,
      failures: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
    });

    this.emit('bee:spawned', { beeId, beeType, swarmId });
    return bee;
  }

  /**
   * Record bee task performance for self-healing decisions.
   */
  recordBeePerformance(beeId, success, latencyMs) {
    const stats = this._performanceLog.get(beeId);
    const bee = this._bees.get(beeId);
    if (!stats || !bee) return;

    if (success) stats.successes++;
    else stats.failures++;

    stats.totalLatencyMs += latencyMs;
    stats.avgLatencyMs = stats.totalLatencyMs / (stats.successes + stats.failures);

    bee.taskCount++;
    bee.lastActiveAt = Date.now();

    // Auto-retire consistently failing bees (success rate < PSI ≈ 61.8%)
    const total = stats.successes + stats.failures;
    if (total >= 5 && stats.successes / total < PSI) {
      this._retireBee(beeId, 'poor-performance');
    }
  }

  /**
   * Get all active bees for a swarm.
   */
  getSwarmBees(swarmId) {
    const beeIds = this._swarmBees.get(swarmId);
    if (!beeIds) return [];
    return Array.from(beeIds)
      .map((id) => this._bees.get(id))
      .filter((b) => b && b.state !== 'retired');
  }

  /**
   * Get bee statistics.
   */
  getBeeStats(beeId) {
    const bee = this._bees.get(beeId);
    const stats = this._performanceLog.get(beeId);
    if (!bee || !stats) return null;

    const total = stats.successes + stats.failures;
    return {
      ...bee,
      performance: {
        ...stats,
        successRate: total > 0 ? Math.round((stats.successes / total) * 1000) / 1000 : 1.0,
        uptime: Date.now() - bee.spawnedAt,
      },
    };
  }

  /**
   * Get factory-wide statistics.
   */
  getFactoryStats() {
    const allBees = Array.from(this._bees.values());
    return {
      totalBees: allBees.length,
      activeBees: allBees.filter((b) => b.state !== 'retired').length,
      retiredBees: allBees.filter((b) => b.state === 'retired').length,
      swarmCounts: Object.fromEntries(
        Array.from(this._swarmBees.entries()).map(([id, set]) => [id, set.size]),
      ),
      templates: Array.from(this._templates.keys()),
    };
  }

  /**
   * Retire a specific bee.
   */
  retireBee(beeId) {
    return this._retireBee(beeId, 'manual');
  }

  // ─── Private Methods ──────────────────────────────────────────────

  _retireBee(beeId, reason) {
    const bee = this._bees.get(beeId);
    if (!bee || bee.state === 'retired') return false;

    bee.state = 'retired';
    bee.retiredAt = Date.now();
    bee.retireReason = reason;

    // Remove from swarm set
    const swarmSet = this._swarmBees.get(bee.swarmId);
    if (swarmSet) swarmSet.delete(beeId);

    this.emit('bee:retired', { beeId, swarmId: bee.swarmId, reason });
    return true;
  }

  _retireWorstBee(swarmId) {
    const beeIds = this._swarmBees.get(swarmId);
    if (!beeIds || beeIds.size === 0) return false;

    let worstId = null;
    let worstScore = Infinity;

    for (const beeId of beeIds) {
      const stats = this._performanceLog.get(beeId);
      if (!stats) continue;

      const total = stats.successes + stats.failures;
      const successRate = total > 0 ? stats.successes / total : 1.0;

      // Phi-weighted score: success rate + recency bonus
      const bee = this._bees.get(beeId);
      const recency = bee?.lastActiveAt
        ? (Date.now() - bee.lastActiveAt) / 60000 // minutes inactive
        : 0;
      const score = successRate - recency * PSI * 0.01;

      if (score < worstScore) {
        worstScore = score;
        worstId = beeId;
      }
    }

    if (worstId) {
      return this._retireBee(worstId, 'capacity-eviction');
    }
    return false;
  }
}
