// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Handoff Router v1.0.0                                   ║
// ║  Explicit agent-to-agent handoffs with CSL-gated transfers     ║
// ║  Absorbed from: OpenAI Swarm explicit handoffs                 ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { EventEmitter } from 'events';
import { PlatformConfig } from '../../config/platform-config.js';

const PHI = 1.6180339887498948;

/**
 * HandoffRouter — Manages explicit agent handoffs (OpenAI Swarm style).
 *
 * A handoff occurs when one agent/swarm decides another agent/swarm
 * is better suited for the current task. The handoff preserves context
 * and is gated by CSL threshold to prevent unnecessary transfers.
 */
export class HandoffRouter extends EventEmitter {
  constructor(messageBus) {
    super();
    this._messageBus = messageBus;
    this._handoffHistory = [];
    this._handoffRules = new Map(); // fromSwarm → { toSwarm, condition }[]
    this._maxHistory = 89; // F(11)
  }

  /**
   * Register a handoff rule.
   *
   * @param {string} fromSwarm — Source swarm
   * @param {string} toSwarm — Target swarm
   * @param {Function} condition — (task, context) => boolean
   */
  registerRule(fromSwarm, toSwarm, condition = null) {
    if (!this._handoffRules.has(fromSwarm)) {
      this._handoffRules.set(fromSwarm, []);
    }
    this._handoffRules.get(fromSwarm).push({ toSwarm, condition });
  }

  /**
   * Execute a handoff from one swarm to another.
   *
   * @param {string} fromSwarm — Source swarm
   * @param {string} toSwarm — Target swarm
   * @param {object} task — Task being handed off
   * @param {object} context — Accumulated context from source
   * @param {number} cslScore — CSL score justifying the handoff
   * @returns {{ accepted: boolean, reason?: string }}
   */
  handoff(fromSwarm, toSwarm, task, context = {}, cslScore = 0.7) {
    // CSL gate: handoff must meet minimum threshold
    const minThreshold = PlatformConfig.csl.low; // 0.691
    if (cslScore < minThreshold) {
      this.emit('handoff:rejected', {
        from: fromSwarm,
        to: toSwarm,
        reason: 'CSL score below threshold',
        score: cslScore,
        threshold: minThreshold,
      });
      return { accepted: false, reason: `CSL score ${cslScore} < threshold ${minThreshold}` };
    }

    // Check if handoff rule exists
    const rules = this._handoffRules.get(fromSwarm) || [];
    const matchingRule = rules.find((r) => r.toSwarm === toSwarm);
    if (matchingRule?.condition && !matchingRule.condition(task, context)) {
      return { accepted: false, reason: 'Handoff condition not met' };
    }

    // Execute handoff
    const handoffRecord = {
      id: `hoff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from: fromSwarm,
      to: toSwarm,
      taskId: task.id,
      cslScore,
      context: Object.keys(context),
      timestamp: Date.now(),
    };

    this._handoffHistory.push(handoffRecord);
    if (this._handoffHistory.length > this._maxHistory) {
      this._handoffHistory.shift();
    }

    // Publish handoff event
    if (this._messageBus) {
      this._messageBus.publish(`handoff.${toSwarm}`, {
        type: 'handoff:received',
        from: fromSwarm,
        task,
        context,
        cslScore,
      });
    }

    this.emit('handoff:executed', handoffRecord);
    return { accepted: true, handoffId: handoffRecord.id };
  }

  /**
   * Suggest best handoff target for a task.
   *
   * @param {string} fromSwarm — Current swarm
   * @param {object} task — Task to hand off
   * @returns {string|null} — Suggested target swarm or null
   */
  suggestTarget(fromSwarm, task) {
    const rules = this._handoffRules.get(fromSwarm) || [];
    for (const rule of rules) {
      if (!rule.condition || rule.condition(task, {})) {
        return rule.toSwarm;
      }
    }
    return null;
  }

  /**
   * Get handoff history.
   */
  getHistory(limit = 10) {
    return this._handoffHistory.slice(-limit);
  }

  /**
   * Get statistics.
   */
  getStats() {
    return {
      totalHandoffs: this._handoffHistory.length,
      rules: Array.from(this._handoffRules.entries()).map(([from, rules]) => ({
        from,
        targets: rules.map((r) => r.toSwarm),
      })),
    };
  }
}
