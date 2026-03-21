// © 2026 HeadySystems Inc. — Eric Haywood, Founder — 60+ Provisional Patents
'use strict';

const { Router } = require('express');
const {
  PHI, PSI, ALERTS, CSL_THRESHOLDS,
  getPressureLevel, phiFusionWeights,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/structured-logger');
const crypto = require('crypto');

/**
 * @module usage-metering
 * @version 1.0.0
 * @description Usage metering service tracking API calls, vector ops, LLM tokens,
 * agent hours, and storage. Phi-scaled alert thresholds with feature gating
 * per subscription tier. In-memory tracking (production: Redis).
 */

const SERVICE_NAME = 'usage-metering';
const logger = createLogger(SERVICE_NAME, { domain: 'billing' });

/** Phi-scaled alert thresholds as percentage of quota */
const USAGE_THRESHOLDS = Object.freeze({
  warning:  PSI,                       // ≈ 0.618 (61.8%)
  caution:  1 - Math.pow(PSI, 3),     // ≈ 0.764 (76.4%)
  critical: 1 - Math.pow(PSI, 4),     // ≈ 0.854 (85.4%)
  exceeded: 1 - Math.pow(PSI, 5),     // ≈ 0.910 (91.0%)
  hard_max: 1.0,                       // 100%
});

/** Quota definitions per tier (monthly) */
const TIER_QUOTAS = Object.freeze({
  developer: {
    apiCalls:    100000,
    vectorOps:   50000,
    llmTokens:   100000,
    agentHoursMs: 3600000,       // 1 hour in ms
    storageMb:   1024,            // 1 GB
  },
  team: {
    apiCalls:    1000000,
    vectorOps:   500000,
    llmTokens:   1000000,
    agentHoursMs: 36000000,      // 10 hours in ms
    storageMb:   10240,           // 10 GB
  },
  enterprise: {
    apiCalls:    Infinity,
    vectorOps:   Infinity,
    llmTokens:   Infinity,
    agentHoursMs: Infinity,
    storageMb:   Infinity,
  },
});

/** Feature gates per tier */
const FEATURE_GATES = Object.freeze({
  developer: [
    'api-access', 'heady-mcp', 'basic-analytics', 'community-support',
  ],
  team: [
    'api-access', 'heady-mcp', 'basic-analytics', 'community-support',
    'advanced-analytics', 'team-dashboard', 'shared-workspaces',
    'heady-buddy', 'custom-webhooks', 'priority-support',
  ],
  enterprise: [
    'api-access', 'heady-mcp', 'basic-analytics', 'community-support',
    'advanced-analytics', 'team-dashboard', 'shared-workspaces',
    'heady-buddy', 'custom-webhooks', 'priority-support',
    'sso-saml', 'audit-logging', 'dedicated-infra', 'private-vector-memory',
    'custom-model-tuning', 'on-premise', 'sla-guarantee',
  ],
});

/** In-memory usage store: userId → { metric → current_count } */
const usageStore = new Map();
let startTime = Date.now();

/**
 * UsageMeter — tracks and enforces usage quotas per user.
 */
class UsageMeter {
  constructor() {
    this.alertCallbacks = [];
  }

  /**
   * Record usage for a user.
   * @param {string} userId
   * @param {string} metric One of: apiCalls, vectorOps, llmTokens, agentHoursMs, storageMb
   * @param {number} amount Amount to add
   * @param {string} tier Subscription tier
   * @returns {{ recorded: boolean, current: number, quota: number, usage: number, alertLevel: string|null }}
   */
  record(userId, metric, amount, tier = 'developer') {
    const key = `${userId}:${metric}`;
    const current = (usageStore.get(key) || 0) + amount;
    usageStore.set(key, current);

    const quota = TIER_QUOTAS[tier]?.[metric] || TIER_QUOTAS.developer[metric] || Infinity;
    const usage = quota === Infinity ? 0 : current / quota;
    const alertLevel = this._getAlertLevel(usage);

    if (alertLevel) {
      logger.warn('usage_alert', { userId, metric, usage, alertLevel, current, quota });
      for (const cb of this.alertCallbacks) {
        try { cb({ userId, metric, usage, alertLevel, current, quota }); } catch (_) { /* non-fatal */ }
      }
    }

    return { recorded: true, current, quota, usage, alertLevel };
  }

  /**
   * Get current usage for a user and metric.
   * @param {string} userId
   * @param {string} metric
   * @param {string} tier
   * @returns {{ current: number, quota: number, usage: number, alertLevel: string|null }}
   */
  getUsage(userId, metric, tier = 'developer') {
    const key = `${userId}:${metric}`;
    const current = usageStore.get(key) || 0;
    const quota = TIER_QUOTAS[tier]?.[metric] || Infinity;
    const usage = quota === Infinity ? 0 : current / quota;
    return { current, quota, usage, alertLevel: this._getAlertLevel(usage) };
  }

  /**
   * Feature gate check: determine if a user can access a feature.
   * @param {string} userId
   * @param {string} feature Feature name
   * @param {string} tier Subscription tier
   * @returns {{ allowed: boolean, plan: string, degradation: string|null, quotaUsage: Object }}
   */
  checkFeatureGate(userId, feature, tier = 'developer') {
    const allowedFeatures = FEATURE_GATES[tier] || FEATURE_GATES.developer;
    const allowed = allowedFeatures.includes(feature);

    /** Gather overall quota usage */
    const quotaUsage = {};
    for (const metric of Object.keys(TIER_QUOTAS[tier] || TIER_QUOTAS.developer)) {
      quotaUsage[metric] = this.getUsage(userId, metric, tier);
    }

    /** Check for degradation based on highest usage */
    let degradation = null;
    const maxUsage = Math.max(...Object.values(quotaUsage).map(q => q.usage));
    if (maxUsage >= USAGE_THRESHOLDS.exceeded) {
      degradation = 'hard_throttle';
    } else if (maxUsage >= USAGE_THRESHOLDS.critical) {
      degradation = 'rate_limited';
    } else if (maxUsage >= USAGE_THRESHOLDS.caution) {
      degradation = 'reduced_priority';
    }

    return { allowed, plan: tier, degradation, quotaUsage };
  }

  /**
   * Register an alert callback.
   * @param {Function} cb
   */
  onAlert(cb) {
    this.alertCallbacks.push(cb);
  }

  /**
   * Reset usage for a user (e.g., on billing cycle reset).
   * @param {string} userId
   */
  resetUser(userId) {
    for (const [key] of usageStore) {
      if (key.startsWith(`${userId}:`)) usageStore.delete(key);
    }
    logger.info('usage_reset', { userId });
  }

  /**
   * Determine the alert level for a usage ratio.
   * @private
   * @param {number} usage Usage ratio [0,1+]
   * @returns {string|null}
   */
  _getAlertLevel(usage) {
    if (usage >= USAGE_THRESHOLDS.hard_max) return 'hard_max';
    if (usage >= USAGE_THRESHOLDS.exceeded) return 'exceeded';
    if (usage >= USAGE_THRESHOLDS.critical) return 'critical';
    if (usage >= USAGE_THRESHOLDS.caution) return 'caution';
    if (usage >= USAGE_THRESHOLDS.warning) return 'warning';
    return null;
  }
}

/**
 * Create the usage metering Express router.
 * @returns {import('express').Router}
 */
function createUsageMeteringRouter() {
  const router = Router();
  const meter = new UsageMeter();
  startTime = Date.now();

  /** Health endpoint */
  router.get('/health', (_req, res) => {
    res.json(health());
  });

  /** Record usage */
  router.post('/record', (req, res) => {
    const { userId, metric, amount, tier } = req.body || {};
    if (!userId || !metric || amount == null) {
      return res.status(400).json({ error: 'userId, metric, and amount are required' });
    }
    const result = meter.record(userId, metric, amount, tier);
    res.status(201).json(result);
  });

  /** Get usage for a user/metric */
  router.get('/usage/:userId/:metric', (req, res) => {
    const { userId, metric } = req.params;
    const tier = req.query.tier || 'developer';
    res.json(meter.getUsage(userId, metric, tier));
  });

  /** Feature gate check */
  router.get('/gate/:userId/:feature', (req, res) => {
    const { userId, feature } = req.params;
    const tier = req.query.tier || 'developer';
    res.json(meter.checkFeatureGate(userId, feature, tier));
  });

  /** Reset user usage */
  router.post('/reset/:userId', (req, res) => {
    meter.resetUser(req.params.userId);
    res.json({ reset: true, userId: req.params.userId });
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
    trackedUsers: new Set([...usageStore.keys()].map(k => k.split(':')[0])).size,
    trackedMetrics: usageStore.size,
    thresholds: USAGE_THRESHOLDS,
    tiers: Object.keys(TIER_QUOTAS),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Graceful shutdown.
 */
function shutdown() {
  logger.info('shutdown', { service: SERVICE_NAME, trackedMetrics: usageStore.size });
  usageStore.clear();
}

module.exports = {
  UsageMeter,
  createUsageMeteringRouter,
  health,
  shutdown,
  USAGE_THRESHOLDS,
  TIER_QUOTAS,
  FEATURE_GATES,
};
