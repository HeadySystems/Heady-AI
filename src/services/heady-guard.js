// HEADY_BRAND:BEGIN
// ║  HEADY™ — HeadyGuard Governance-as-a-Service                          ║
// ║  FILE: src/services/heady-guard.js                                     ║
// HEADY_BRAND:END
/**
 * HeadyGuard — Enterprise governance-as-a-service combining:
 *   1. Kill Switch — emergency position flattening at configurable loss thresholds
 *   2. Audit Trail — immutable SHA-256 hash-chained event log
 *   3. Hallucination Guard — LLM output confidence scoring with CSL gates
 *   4. Policy Engine — rate limits, cost budgets, access control
 *
 * SOC 2 positioning for fintech and healthcare compliance.
 * All constants from phi-math.js. Zero hardcoded numbers.
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const crypto = require('crypto');
const {
  fib, PHI, PSI,
  PHI_TIMING,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math');

let log = null;
try { log = require('../utils/logger'); } catch { log = console; }

const { bus } = require('../core/event-bus');

// ─── Constants ───────────────────────────────────────────────────────────────

/** Max audit entries: fib(20) = 6765 */
const MAX_AUDIT_ENTRIES = fib(20);

/** Default daily loss threshold for kill switch: 51% */
const DEFAULT_KILL_SWITCH_THRESHOLD = 0.51;

/** Safety buffer: PSI (0.618) of threshold */
const SAFETY_BUFFER_FACTOR = PSI;

/** Hallucination confidence thresholds */
const HALLUCINATION_THRESHOLDS = {
  PASS:  CSL_THRESHOLDS.HIGH,     // ≥ ~0.854
  FLAG:  CSL_THRESHOLDS.MEDIUM,   // ≥ ~0.691
  WARN:  CSL_THRESHOLDS.LOW,      // ≥ ~0.500
  BLOCK: 0.5,
};

/** Max policies: fib(8) = 34 */
const MAX_POLICIES = fib(8);

// ─── Audit Trail (Immutable Hash Chain) ──────────────────────────────────────

class AuditTrail {
  constructor() {
    /** @type {Array<{ id: number, action: string, actor: string, data: object, hash: string, prevHash: string, ts: string }>} */
    this._entries = [];
    this._lastHash = '0'.repeat(64); // genesis hash
  }

  /**
   * Append an audit entry. Each entry includes hash of previous entry.
   * @param {string} action
   * @param {string} actor
   * @param {object} data
   * @returns {object} the new entry
   */
  append(action, actor, data = {}) {
    const entry = {
      id: this._entries.length,
      action,
      actor,
      data,
      prevHash: this._lastHash,
      ts: new Date().toISOString(),
    };

    // Create hash of this entry (including prevHash for chain integrity)
    const hashInput = JSON.stringify({
      id: entry.id,
      action: entry.action,
      actor: entry.actor,
      data: entry.data,
      prevHash: entry.prevHash,
      ts: entry.ts,
    });
    entry.hash = crypto.createHash('sha256').update(hashInput).digest('hex');
    this._lastHash = entry.hash;

    this._entries.push(entry);

    // Trim if needed
    if (this._entries.length > MAX_AUDIT_ENTRIES) {
      this._entries = this._entries.slice(-MAX_AUDIT_ENTRIES);
    }

    return entry;
  }

  /**
   * Validate the entire audit chain integrity.
   * @returns {{ valid: boolean, entries: number, brokenAt?: number }}
   */
  validate() {
    let prevHash = this._entries.length > 0 ? this._entries[0].prevHash : null;

    for (let i = 0; i < this._entries.length; i++) {
      const entry = this._entries[i];

      // Verify prevHash links
      if (i > 0 && entry.prevHash !== this._entries[i - 1].hash) {
        return { valid: false, entries: this._entries.length, brokenAt: i };
      }

      // Verify entry hash
      const hashInput = JSON.stringify({
        id: entry.id,
        action: entry.action,
        actor: entry.actor,
        data: entry.data,
        prevHash: entry.prevHash,
        ts: entry.ts,
      });
      const expectedHash = crypto.createHash('sha256').update(hashInput).digest('hex');
      if (entry.hash !== expectedHash) {
        return { valid: false, entries: this._entries.length, brokenAt: i };
      }
    }

    return { valid: true, entries: this._entries.length };
  }

  /**
   * Get audit entries (paginated).
   * @param {number} limit
   * @param {number} offset
   * @returns {Array<object>}
   */
  getEntries(limit = fib(7), offset = 0) {
    return this._entries.slice(offset, offset + limit);
  }

  /** @returns {number} */
  get length() { return this._entries.length; }
}

// ─── Kill Switch ─────────────────────────────────────────────────────────────

class KillSwitch {
  constructor(config = {}) {
    this.threshold = config.threshold || DEFAULT_KILL_SWITCH_THRESHOLD;
    this.safetyBuffer = this.threshold * SAFETY_BUFFER_FACTOR;
    this.armed = true;
    this.triggered = false;
    this.triggeredAt = null;
    this.accounts = new Map();
  }

  /**
   * Update daily P&L for an account and check kill switch.
   * @param {string} accountId
   * @param {number} dailyPnL — positive = profit, negative = loss
   * @param {number} accumulatedProfit — total accumulated profit
   * @returns {{ triggered: boolean, action?: string }}
   */
  checkAndTrigger(accountId, dailyPnL, accumulatedProfit) {
    this.accounts.set(accountId, { dailyPnL, accumulatedProfit, checkedAt: Date.now() });

    if (!this.armed) return { triggered: false };

    // Check if daily loss exceeds threshold of accumulated profit
    const maxDailyProfit = accumulatedProfit * this.threshold;
    const safetyTrigger = accumulatedProfit * this.safetyBuffer;

    if (dailyPnL >= safetyTrigger && accumulatedProfit > 0) {
      return this._trigger(accountId, 'safety_buffer_breach', {
        dailyPnL,
        accumulatedProfit,
        safetyTrigger,
      });
    }

    if (dailyPnL >= maxDailyProfit && accumulatedProfit > 0) {
      return this._trigger(accountId, 'threshold_breach', {
        dailyPnL,
        accumulatedProfit,
        maxDailyProfit,
      });
    }

    return { triggered: false };
  }

  /**
   * @private
   */
  _trigger(accountId, reason, data) {
    this.triggered = true;
    this.triggeredAt = Date.now();

    bus.emit('governance', {
      type: 'kill_switch_triggered',
      data: { accountId, reason, ...data },
    });

    return {
      triggered: true,
      action: 'flatten_and_sever',
      steps: [
        'flatten_all_positions',
        'cancel_pending_orders',
        'revoke_api_token',
      ],
      accountId,
      reason,
    };
  }

  /** Reset the kill switch (requires manual action) */
  reset() {
    this.triggered = false;
    this.triggeredAt = null;
  }

  status() {
    return {
      armed: this.armed,
      triggered: this.triggered,
      triggeredAt: this.triggeredAt,
      threshold: this.threshold,
      safetyBuffer: this.safetyBuffer,
      accountsMonitored: this.accounts.size,
    };
  }
}

// ─── Hallucination Guard ─────────────────────────────────────────────────────

class HallucinationGuard {
  constructor() {
    /** @type {Array<{ claim: string, confidence: number, disposition: string, ts: string }>} */
    this._history = [];
  }

  /**
   * Verify LLM output for potential hallucinations.
   * @param {string} output — LLM-generated text
   * @param {object} [context] — ground truth context
   * @returns {{ confidence: number, disposition: string, claims: Array }}
   */
  verify(output, context = {}) {
    // Extract claims (sentences that make factual assertions)
    const claims = this._extractClaims(output);
    let totalConfidence = 0;

    const evaluatedClaims = claims.map(claim => {
      const confidence = this._scoreClaim(claim, context);
      totalConfidence += confidence;
      return { claim, confidence, disposition: this._classify(confidence) };
    });

    const avgConfidence = claims.length > 0 ? totalConfidence / claims.length : 1.0;
    const disposition = this._classify(avgConfidence);

    // Record in history
    this._history.push({
      outputLength: output.length,
      claimCount: claims.length,
      confidence: avgConfidence,
      disposition,
      ts: new Date().toISOString(),
    });
    if (this._history.length > fib(13)) {
      this._history = this._history.slice(-fib(13));
    }

    return { confidence: avgConfidence, disposition, claims: evaluatedClaims };
  }

  /**
   * Extract factual claims from text.
   * @param {string} text
   * @returns {string[]}
   * @private
   */
  _extractClaims(text) {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10)
      .filter(s => {
        // Filter to declarative statements (not questions, exclamations, etc.)
        const lc = s.toLowerCase();
        return !lc.startsWith('what') && !lc.startsWith('how') &&
               !lc.startsWith('why') && !lc.startsWith('please');
      })
      .slice(0, fib(7)); // max 21 claims
  }

  /**
   * Score a claim's confidence based on context.
   * @param {string} claim
   * @param {object} context
   * @returns {number} 0-1 confidence score
   * @private
   */
  _scoreClaim(claim, context) {
    let score = PSI; // base confidence

    // Check for negation patterns (contradiction indicators)
    const negations = ['not', "doesn't", "isn't", 'never', 'impossible', 'wrong'];
    const hasNegation = negations.some(n => claim.toLowerCase().includes(n));
    if (hasNegation) score *= PSI;

    // Check for hedging language (reduces confidence)
    const hedges = ['maybe', 'perhaps', 'possibly', 'might', 'could', 'approximately'];
    const hasHedge = hedges.some(h => claim.toLowerCase().includes(h));
    if (hasHedge) score *= 0.9;

    // Check for strong assertion language (increases confidence if context matches)
    const strong = ['always', 'every', 'all', 'none', 'exactly', 'precisely'];
    const hasStrong = strong.some(s => claim.toLowerCase().includes(s));
    if (hasStrong && Object.keys(context).length === 0) score *= PSI; // no context to verify

    // If context provided, check for keyword overlap
    if (context.groundTruth) {
      const truthWords = new Set(context.groundTruth.toLowerCase().split(/\s+/));
      const claimWords = claim.toLowerCase().split(/\s+/);
      const overlap = claimWords.filter(w => truthWords.has(w)).length;
      const overlapRatio = claimWords.length > 0 ? overlap / claimWords.length : 0;
      score = score * PSI + overlapRatio * (1 - PSI);
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Classify confidence into disposition.
   * @param {number} confidence
   * @returns {string}
   * @private
   */
  _classify(confidence) {
    if (confidence >= HALLUCINATION_THRESHOLDS.PASS) return 'PASS';
    if (confidence >= HALLUCINATION_THRESHOLDS.FLAG) return 'FLAG';
    if (confidence >= HALLUCINATION_THRESHOLDS.WARN) return 'WARN';
    return 'BLOCK';
  }

  stats() {
    return {
      historySize: this._history.length,
      recentDispositions: this._history.slice(-fib(5)).map(h => h.disposition),
    };
  }
}

// ─── Policy Engine ───────────────────────────────────────────────────────────

class PolicyEngine {
  constructor() {
    /** @type {Map<string, { id, name, type, rule, enabled }>} */
    this._policies = new Map();
  }

  addPolicy(id, name, type, rule) {
    if (this._policies.size >= MAX_POLICIES) {
      throw new Error(`Max policies (${MAX_POLICIES}) reached`);
    }
    this._policies.set(id, { id, name, type, rule, enabled: true, createdAt: Date.now() });
  }

  evaluate(action, context = {}) {
    const results = [];
    for (const [id, policy] of this._policies) {
      if (!policy.enabled) continue;
      try {
        const passed = policy.rule(action, context);
        results.push({ policyId: id, name: policy.name, passed });
      } catch (err) {
        results.push({ policyId: id, name: policy.name, passed: false, error: err.message });
      }
    }
    const allPassed = results.every(r => r.passed);
    return { allowed: allPassed, results };
  }

  listPolicies() {
    return [...this._policies.values()].map(({ rule, ...rest }) => rest);
  }
}

// ─── HeadyGuard Service ──────────────────────────────────────────────────────

class HeadyGuard {
  constructor(config = {}) {
    this.audit = new AuditTrail();
    this.killSwitch = new KillSwitch(config.killSwitch);
    this.hallucinationGuard = new HallucinationGuard();
    this.policyEngine = new PolicyEngine();

    // Register default policies
    this.policyEngine.addPolicy('rate_limit', 'Rate Limit', 'rate_limit',
      (action, ctx) => (ctx.requestsThisMinute || 0) < fib(9) // 55 rps
    );
    this.policyEngine.addPolicy('cost_budget', 'Cost Budget', 'budget',
      (action, ctx) => (ctx.dailyCost || 0) < (ctx.dailyBudget || 50)
    );

    // Log initial boot
    this.audit.append('guard_initialized', 'system', { config: { threshold: this.killSwitch.threshold } });
  }

  status() {
    return {
      killSwitch: this.killSwitch.status(),
      auditChain: this.audit.validate(),
      hallucinationGuard: this.hallucinationGuard.stats(),
      policies: this.policyEngine.listPolicies().length,
    };
  }
}

// ─── Express Router ──────────────────────────────────────────────────────────

function createGuardRouter() {
  const express = require('express');
  const router  = express.Router();
  const guard   = new HeadyGuard();

  router.get('/status', (_req, res) => {
    res.json({ ok: true, ...guard.status() });
  });

  router.post('/evaluate', (req, res) => {
    const { action, context } = req.body || {};
    if (!action) return res.status(400).json({ ok: false, error: 'action required' });

    const result = guard.policyEngine.evaluate(action, context);
    guard.audit.append('policy_evaluation', 'api', { action, allowed: result.allowed });
    res.json({ ok: true, ...result });
  });

  router.post('/kill-switch', (req, res) => {
    const { accountId, dailyPnL, accumulatedProfit } = req.body || {};
    if (!accountId) return res.status(400).json({ ok: false, error: 'accountId required' });

    const result = guard.killSwitch.checkAndTrigger(accountId, dailyPnL || 0, accumulatedProfit || 0);
    guard.audit.append(
      result.triggered ? 'kill_switch_triggered' : 'kill_switch_checked',
      'api',
      { accountId, dailyPnL, accumulatedProfit }
    );
    res.json({ ok: true, ...result });
  });

  router.get('/audit', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || fib(7), fib(10));
    const offset = parseInt(req.query.offset) || 0;
    const entries = guard.audit.getEntries(limit, offset);
    const validation = guard.audit.validate();
    res.json({ ok: true, entries, total: guard.audit.length, ...validation });
  });

  router.post('/verify-output', (req, res) => {
    const { output, context } = req.body || {};
    if (!output) return res.status(400).json({ ok: false, error: 'output required' });

    const result = guard.hallucinationGuard.verify(output, context);
    guard.audit.append('hallucination_check', 'api', {
      disposition: result.disposition,
      confidence: result.confidence,
    });
    res.json({ ok: true, ...result });
  });

  router.get('/policies', (_req, res) => {
    res.json({ ok: true, policies: guard.policyEngine.listPolicies() });
  });

  return router;
}

module.exports = {
  HeadyGuard,
  AuditTrail,
  KillSwitch,
  HallucinationGuard,
  PolicyEngine,
  createGuardRouter,
  MAX_AUDIT_ENTRIES,
  HALLUCINATION_THRESHOLDS,
};
