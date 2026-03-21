'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const {
  PHI,
  PSI,
  PSI_SQ,
  fib,
  CSL_THRESHOLDS,
  phiBackoffWithJitter
} = require('../../shared/phi-math');
const {
  createLogger
} = require('../../shared/logger');
const logger = createLogger('liquid-self-heal');
const MAX_RULES = fib(10); // 55 rules
const LEARNING_WINDOW_MS = fib(8) * 3600 * 1000; // 21 hours
const MIN_OCCURRENCES = fib(4); // 3 occurrences to learn
const CONFIDENCE_THRESHOLD = CSL_THRESHOLDS.MEDIUM; // 0.809
const RULE_DECAY_RATE = PSI_SQ; // 0.382 per period without occurrence
const HEALTH_CHECK_INTERVAL_MS = fib(8) * 1000; // 21s

const FAILURE_CATEGORIES = Object.freeze({
  TIMEOUT: 'TIMEOUT',
  OOM: 'OOM',
  RATE_LIMIT: 'RATE_LIMIT',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  CONNECTION: 'CONNECTION',
  CRASH: 'CRASH',
  DATA_CORRUPTION: 'DATA_CORRUPTION',
  DEPENDENCY: 'DEPENDENCY',
  RESOURCE: 'RESOURCE'
});
const HEAL_ACTIONS = Object.freeze({
  REROUTE: 'REROUTE',
  // switch to alternate provider
  SCALE_UP: 'SCALE_UP',
  // increase resource limits
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  // trip circuit breaker preemptively
  RESTART: 'RESTART',
  // restart service
  CACHE_WARM: 'CACHE_WARM',
  // pre-warm cache
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  // refresh auth tokens
  BACKOFF: 'BACKOFF',
  // increase intervals
  ALERT: 'ALERT' // escalate to operator
});
class HealingRule {
  constructor(config) {
    this.id = config.id || crypto.randomUUID();
    this.name = config.name;
    this.pattern = config.pattern; // { category, service, timePattern, contextMatch }
    this.action = config.action; // HEAL_ACTION
    this.actionParams = config.actionParams || {};
    this.confidence = config.confidence || 0;
    this.occurrences = config.occurrences || 0;
    this.successes = config.successes || 0; // times this rule prevented failure
    this.failures = config.failures || 0; // times the rule didn't help
    this.createdAt = config.createdAt || Date.now();
    this.lastTriggered = null;
    this.lastUpdated = Date.now();
    this.version = config.version || 1;
    this.enabled = config.enabled !== false;
  }
  get successRate() {
    const total = this.successes + this.failures;
    return total > 0 ? this.successes / total : 0;
  }
  updateConfidence() {
    // Confidence = weighted blend of occurrence frequency and success rate
    const freqScore = Math.min(1.0, this.occurrences / fib(7)); // cap at 13 occurrences
    const successScore = this.successRate;
    this.confidence = PHI * successScore * PSI + freqScore * PSI_SQ;
    this.confidence = Math.min(1.0, this.confidence);
    this.lastUpdated = Date.now();
  }
}
class FailureEvent {
  constructor(category, service, error, context = {}) {
    this.id = crypto.randomUUID();
    this.category = category;
    this.service = service;
    this.error = error;
    this.context = context;
    this.timestamp = Date.now();
    this.hour = new Date().getHours();
    this.dayOfWeek = new Date().getDay();
    this.healed = false;
    this.healRuleId = null;
  }
}
class LiquidSelfHeal extends EventEmitter {
  constructor(config = {}) {
    super();
    this._rules = new Map(); // ruleId → HealingRule
    this._failureLog = []; // recent failure events
    this._healCallbacks = new Map(); // HEAL_ACTION → async function
    this._serviceHealth = new Map(); // service → { healthy, lastCheck, failures }

    this._metrics = {
      failuresDetected: 0,
      rulesLearned: 0,
      healingsApplied: 0,
      healingsSucceeded: 0,
      preemptiveActions: 0
    };

    // Health check loop
    this._healthTimer = null;
    if (config.autoStart !== false) {
      this._healthTimer = setInterval(() => this._healthCheck(), HEALTH_CHECK_INTERVAL_MS);
    }
    logger.info('LiquidSelfHeal initialized');
  }

  // ── Register Heal Callbacks ────────────────────────────────────
  registerHealAction(action, callback) {
    this._healCallbacks.set(action, callback);
  }

  // ── Record Failure ─────────────────────────────────────────────
  async recordFailure(category, service, error, context = {}) {
    const event = new FailureEvent(category, service, error, context);
    this._failureLog.push(event);
    this._metrics.failuresDetected++;

    // Trim failure log
    if (this._failureLog.length > fib(13)) {
      this._failureLog = this._failureLog.slice(-fib(12));
    }

    // Update service health
    const health = this._serviceHealth.get(service) || {
      healthy: true,
      lastCheck: 0,
      failures: 0
    };
    health.failures++;
    health.healthy = false;
    health.lastCheck = Date.now();
    this._serviceHealth.set(service, health);

    // Try to match existing rule
    const matchedRule = this._findMatchingRule(event);
    if (matchedRule && matchedRule.enabled) {
      const healed = await this._applyRule(matchedRule, event);
      event.healed = healed;
      event.healRuleId = matchedRule.id;
      return {
        event,
        rule: matchedRule,
        healed
      };
    }

    // Try to learn new rule
    this._learnFromHistory(event);
    this.emit('failure:recorded', {
      event,
      matched: !!matchedRule
    });
    return {
      event,
      rule: null,
      healed: false
    };
  }

  // ── Record Success (after heal) ────────────────────────────────
  recordHealSuccess(ruleId) {
    const rule = this._rules.get(ruleId);
    if (rule) {
      rule.successes++;
      rule.updateConfidence();
      this._metrics.healingsSucceeded++;
      this.emit('heal:success', {
        ruleId
      });
    }
  }
  recordHealFailure(ruleId) {
    const rule = this._rules.get(ruleId);
    if (rule) {
      rule.failures++;
      rule.updateConfidence();
      // Disable rules with very low confidence
      if (rule.confidence < CSL_THRESHOLDS.MINIMUM && rule.failures > fib(5)) {
        rule.enabled = false;
        logger.warn({
          ruleId,
          confidence: rule.confidence
        }, 'Rule disabled due to low confidence');
      }
    }
  }

  // ── Apply Healing Rule ─────────────────────────────────────────
  async _applyRule(rule, event) {
    const callback = this._healCallbacks.get(rule.action);
    if (!callback) {
      logger.warn({
        action: rule.action
      }, 'No callback registered for heal action');
      this.emit('heal:no_callback', {
        action: rule.action
      });
      return false;
    }
    try {
      rule.lastTriggered = Date.now();
      this._metrics.healingsApplied++;
      await callback({
        rule,
        event,
        params: rule.actionParams,
        service: event.service
      });
      this.emit('heal:applied', {
        ruleId: rule.id,
        action: rule.action,
        service: event.service
      });
      logger.info({
        ruleId: rule.id,
        action: rule.action,
        service: event.service
      }, 'Healing applied');
      return true;
    } catch (e) {
      logger.error({
        ruleId: rule.id,
        error: e.message
      }, 'Heal action failed');
      return false;
    }
  }

  // ── Pattern Matching ───────────────────────────────────────────
  _findMatchingRule(event) {
    let bestRule = null;
    let bestConfidence = 0;
    for (const rule of this._rules.values()) {
      if (!rule.enabled) continue;
      const match = this._matchPattern(rule.pattern, event);
      if (match && rule.confidence > bestConfidence) {
        bestConfidence = rule.confidence;
        bestRule = rule;
      }
    }
    return bestConfidence >= CONFIDENCE_THRESHOLD ? bestRule : null;
  }
  _matchPattern(pattern, event) {
    if (pattern.category && pattern.category !== event.category) return false;
    if (pattern.service && pattern.service !== event.service) return false;
    if (pattern.hour !== undefined && pattern.hour !== event.hour) return false;
    if (pattern.dayOfWeek !== undefined && pattern.dayOfWeek !== event.dayOfWeek) return false;
    if (pattern.errorMatch && !event.error.includes(pattern.errorMatch)) return false;
    return true;
  }

  // ── Learning ───────────────────────────────────────────────────
  _learnFromHistory(latestEvent) {
    const windowStart = Date.now() - LEARNING_WINDOW_MS;
    const relevant = this._failureLog.filter(e => e.timestamp >= windowStart && e.category === latestEvent.category && e.service === latestEvent.service);
    if (relevant.length < MIN_OCCURRENCES) return;

    // Check if we already have a rule for this pattern
    const existingRule = [...this._rules.values()].find(r => r.pattern.category === latestEvent.category && r.pattern.service === latestEvent.service);
    if (existingRule) {
      existingRule.occurrences = relevant.length;
      existingRule.updateConfidence();
      return;
    }

    // Create new rule
    if (this._rules.size >= MAX_RULES) {
      this._evictWeakestRule();
    }
    const action = this._inferHealAction(latestEvent.category);
    const rule = new HealingRule({
      name: `auto-${latestEvent.category.toLowerCase()}-${latestEvent.service}`,
      pattern: {
        category: latestEvent.category,
        service: latestEvent.service
      },
      action,
      occurrences: relevant.length,
      confidence: 0.5 // starts at 50%
    });

    // Check for time patterns
    const hours = relevant.map(e => e.hour);
    const hourCounts = {};
    for (const h of hours) hourCounts[h] = (hourCounts[h] || 0) + 1;
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    if (peakHour && peakHour[1] >= MIN_OCCURRENCES) {
      rule.pattern.hour = parseInt(peakHour[0]);
      rule.name += `-hour${peakHour[0]}`;
    }
    rule.updateConfidence();
    this._rules.set(rule.id, rule);
    this._metrics.rulesLearned++;
    this.emit('rule:learned', {
      ruleId: rule.id,
      name: rule.name,
      confidence: rule.confidence
    });
    logger.info({
      ruleId: rule.id,
      name: rule.name,
      confidence: rule.confidence
    }, 'New healing rule learned');
  }
  _inferHealAction(category) {
    const mapping = {
      [FAILURE_CATEGORIES.TIMEOUT]: HEAL_ACTIONS.REROUTE,
      [FAILURE_CATEGORIES.OOM]: HEAL_ACTIONS.SCALE_UP,
      [FAILURE_CATEGORIES.RATE_LIMIT]: HEAL_ACTIONS.BACKOFF,
      [FAILURE_CATEGORIES.AUTH_EXPIRED]: HEAL_ACTIONS.TOKEN_REFRESH,
      [FAILURE_CATEGORIES.CONNECTION]: HEAL_ACTIONS.REROUTE,
      [FAILURE_CATEGORIES.CRASH]: HEAL_ACTIONS.RESTART,
      [FAILURE_CATEGORIES.DATA_CORRUPTION]: HEAL_ACTIONS.ALERT,
      [FAILURE_CATEGORIES.DEPENDENCY]: HEAL_ACTIONS.CIRCUIT_OPEN,
      [FAILURE_CATEGORIES.RESOURCE]: HEAL_ACTIONS.SCALE_UP
    };
    return mapping[category] || HEAL_ACTIONS.ALERT;
  }
  _evictWeakestRule() {
    let weakest = null;
    let minConfidence = Infinity;
    for (const [id, rule] of this._rules) {
      if (rule.confidence < minConfidence) {
        minConfidence = rule.confidence;
        weakest = id;
      }
    }
    if (weakest) this._rules.delete(weakest);
  }

  // ── Preemptive Health Check ────────────────────────────────────
  async _healthCheck() {
    for (const rule of this._rules.values()) {
      if (!rule.enabled || rule.confidence < CONFIDENCE_THRESHOLD) continue;

      // Time-based preemption: if rule has hour pattern and we're approaching it
      if (rule.pattern.hour !== undefined) {
        const currentHour = new Date().getHours();
        if (currentHour === rule.pattern.hour) {
          this._metrics.preemptiveActions++;
          await this._applyRule(rule, {
            category: rule.pattern.category,
            service: rule.pattern.service,
            error: 'Preemptive action based on learned time pattern',
            context: {
              preemptive: true
            }
          });
        }
      }
    }

    // Decay confidence for rules not triggered recently
    const now = Date.now();
    for (const rule of this._rules.values()) {
      if (rule.lastTriggered && now - rule.lastTriggered > LEARNING_WINDOW_MS) {
        rule.confidence *= 1 - RULE_DECAY_RATE;
        if (rule.confidence < CSL_THRESHOLDS.MINIMUM) {
          rule.enabled = false;
        }
      }
    }
  }

  // ── Query ──────────────────────────────────────────────────────
  getRules() {
    return [...this._rules.values()].map(r => ({
      id: r.id,
      name: r.name,
      action: r.action,
      confidence: r.confidence,
      occurrences: r.occurrences,
      successRate: r.successRate,
      enabled: r.enabled,
      lastTriggered: r.lastTriggered
    }));
  }
  getServiceHealth() {
    const result = {};
    for (const [service, health] of this._serviceHealth) {
      result[service] = {
        ...health
      };
    }
    return result;
  }

  // ── Lifecycle ──────────────────────────────────────────────────
  destroy() {
    if (this._healthTimer) clearInterval(this._healthTimer);
    this.removeAllListeners();
  }
  get metrics() {
    return {
      ...this._metrics
    };
  }
}
module.exports = {
  LiquidSelfHeal,
  FAILURE_CATEGORIES,
  HEAL_ACTIONS
};