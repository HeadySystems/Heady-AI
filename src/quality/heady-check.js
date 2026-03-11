/**
 * Heady™ HeadyCheck v1.0
 * Quality gate that validates all node outputs before delivery.
 * Every pipeline stage passes through HeadyCheck to ensure output
 * meets phi-threshold standards before reaching the next stage.
 *
 * Part of the HCFullPipeline (Stage 5: Quality Gate).
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
  cslGate,
  cslBlend,
  adaptiveTemperature,
  PRESSURE_LEVELS,
  ALERT_THRESHOLDS,
} = require('../../shared/phi-math.js');
const logger = require('../../shared/logger.js');
const { createHealthCheck } = require('../../shared/health.js');

// ═══════════════════════════════════════════════════════════
// CONSTANTS — All phi-derived
// ═══════════════════════════════════════════════════════════

/** Maximum concurrent checks — fib(8) = 21 */
const MAX_CONCURRENT_CHECKS = fib(8);

/** Check timeout — fib(9) × 1000 = 34s */
const CHECK_TIMEOUT_MS = fib(9) * 1000;

/** Maximum check rules per domain — fib(8) = 21 */
const MAX_RULES_PER_DOMAIN = fib(8);

/** Result history buffer — fib(11) = 89 */
const RESULT_HISTORY = fib(11);

/** Minimum pass score for Hot pool outputs */
const HOT_POOL_THRESHOLD = CSL_THRESHOLDS.HIGH; // ≈ 0.882

/** Minimum pass score for Warm pool outputs */
const WARM_POOL_THRESHOLD = CSL_THRESHOLDS.MEDIUM; // ≈ 0.809

/** Minimum pass score for Cold pool outputs */
const COLD_POOL_THRESHOLD = CSL_THRESHOLDS.LOW; // ≈ 0.691

/** Score below which output is rejected outright */
const REJECTION_THRESHOLD = CSL_THRESHOLDS.MINIMUM; // ≈ 0.500

/** Maximum check retries before permanent failure — fib(4) = 3 */
const MAX_CHECK_RETRIES = fib(4);

/** Dimension weights for multi-factor scoring — phiFusionWeights(5) */
const DIMENSION_WEIGHTS = Object.freeze({
  correctness: 0.387,
  completeness: 0.239,
  coherence: 0.148,
  performance: 0.092,
  safety: 0.057,
});

// ═══════════════════════════════════════════════════════════
// CHECK RULE — Individual quality check
// ═══════════════════════════════════════════════════════════

class CheckRule {
  /**
   * @param {object} opts
   * @param {string} opts.id — rule identifier
   * @param {string} opts.name — human-readable name
   * @param {string} opts.dimension — 'correctness' | 'completeness' | 'coherence' | 'performance' | 'safety'
   * @param {function} opts.check — (output, context) => { score: 0-1, issues: string[] }
   * @param {boolean} [opts.required] — if true, failure blocks the entire check
   * @param {string} [opts.pool] — which pool this applies to ('hot' | 'warm' | 'cold' | 'all')
   */
  constructor({ id, name, dimension, check, required = false, pool = 'all' }) {
    this.id = id;
    this.name = name;
    this.dimension = dimension;
    this.check = check;
    this.required = required;
    this.pool = pool;
  }
}

// ═══════════════════════════════════════════════════════════
// BUILT-IN RULES
// ═══════════════════════════════════════════════════════════

const BUILT_IN_RULES = Object.freeze([
  // ── Correctness rules ──
  new CheckRule({
    id: 'syntax_valid',
    name: 'Syntax Validation',
    dimension: 'correctness',
    required: true,
    check: (output) => {
      if (typeof output.content !== 'string') {
        return { score: 0, issues: ['Output content is not a string'] };
      }
      if (output.type === 'code' && output.content.endsWith('.js')) {
        const braces = (output.content.match(/\{/g) || []).length -
                       (output.content.match(/\}/g) || []).length;
        if (Math.abs(braces) > fib(3)) {
          return { score: PSI_SQ, issues: [`Brace imbalance: ${braces}`] };
        }
      }
      return { score: 1.0, issues: [] };
    },
  }),

  new CheckRule({
    id: 'no_console_log',
    name: 'No Console.log',
    dimension: 'correctness',
    required: true,
    check: (output) => {
      if (typeof output.content !== 'string') return { score: 1.0, issues: [] };
      const matches = output.content.match(/console\.(log|warn|error|info|debug)\s*\(/g);
      if (matches && matches.length > 0) {
        return {
          score: Math.max(0, 1 - matches.length * PSI_CUBE),
          issues: [`Found ${matches.length} console.log statement(s) — use structured logger`],
        };
      }
      return { score: 1.0, issues: [] };
    },
  }),

  new CheckRule({
    id: 'no_localstorage',
    name: 'No localStorage',
    dimension: 'safety',
    required: true,
    check: (output) => {
      if (typeof output.content !== 'string') return { score: 1.0, issues: [] };
      if (/localStorage\s*[.[]/.test(output.content)) {
        return { score: 0, issues: ['localStorage usage detected — use httpOnly cookies'] };
      }
      return { score: 1.0, issues: [] };
    },
  }),

  new CheckRule({
    id: 'phi_constants',
    name: 'Phi-Derived Constants',
    dimension: 'correctness',
    check: (output) => {
      if (typeof output.content !== 'string' || output.type !== 'code') {
        return { score: 1.0, issues: [] };
      }
      const magicNumbers = output.content.match(/(?<!\w)(100|500|1000|0\.5|0\.7|0\.8|0\.9|0\.95)(?!\w)/g);
      if (magicNumbers && magicNumbers.length > 0) {
        return {
          score: Math.max(PSI_SQ, 1 - magicNumbers.length * PSI_FOURTH),
          issues: [`Found ${magicNumbers.length} potential magic number(s): ${[...new Set(magicNumbers)].join(', ')}`],
        };
      }
      return { score: 1.0, issues: [] };
    },
  }),

  // ── Completeness rules ──
  new CheckRule({
    id: 'has_exports',
    name: 'Module Exports Present',
    dimension: 'completeness',
    check: (output) => {
      if (typeof output.content !== 'string' || output.type !== 'code') {
        return { score: 1.0, issues: [] };
      }
      if (!output.content.includes('module.exports') && !output.content.includes('export ')) {
        return { score: PSI_SQ, issues: ['No exports found — module may be incomplete'] };
      }
      return { score: 1.0, issues: [] };
    },
  }),

  new CheckRule({
    id: 'has_documentation',
    name: 'Documentation Present',
    dimension: 'completeness',
    check: (output) => {
      if (typeof output.content !== 'string') return { score: 1.0, issues: [] };
      const jsdocCount = (output.content.match(/\/\*\*/g) || []).length;
      if (output.type === 'code' && jsdocCount < fib(3)) {
        return {
          score: Math.min(1.0, jsdocCount / fib(3)),
          issues: jsdocCount === 0 ? ['No JSDoc documentation found'] : ['Minimal documentation — consider adding more'],
        };
      }
      return { score: 1.0, issues: [] };
    },
  }),

  new CheckRule({
    id: 'has_error_handling',
    name: 'Error Handling Present',
    dimension: 'completeness',
    check: (output) => {
      if (typeof output.content !== 'string' || output.type !== 'code') {
        return { score: 1.0, issues: [] };
      }
      const tryCount = (output.content.match(/try\s*\{/g) || []).length;
      const catchCount = (output.content.match(/catch\s*\(/g) || []).length;
      const lineCount = output.content.split('\n').length;

      // Expect roughly 1 try/catch per fib(11) = 89 lines
      const expectedMinimum = Math.max(1, Math.floor(lineCount / fib(11)));
      if (catchCount < expectedMinimum) {
        return {
          score: Math.min(1.0, catchCount / expectedMinimum),
          issues: [`Only ${catchCount} error handler(s) for ${lineCount} lines`],
        };
      }
      return { score: 1.0, issues: [] };
    },
  }),

  // ── Coherence rules ──
  new CheckRule({
    id: 'naming_consistency',
    name: 'Naming Consistency',
    dimension: 'coherence',
    check: (output) => {
      if (typeof output.content !== 'string' || output.type !== 'code') {
        return { score: 1.0, issues: [] };
      }
      // Check for "Eric Head" instead of "Eric Haywood"
      if (/Eric\s+Head(?!y)/i.test(output.content)) {
        return { score: PSI, issues: ['Found "Eric Head" — should be "Eric Haywood"'] };
      }
      return { score: 1.0, issues: [] };
    },
  }),

  new CheckRule({
    id: 'structured_logging',
    name: 'Structured Logging',
    dimension: 'coherence',
    check: (output) => {
      if (typeof output.content !== 'string' || output.type !== 'code') {
        return { score: 1.0, issues: [] };
      }
      const loggerUsage = (output.content.match(/logger\.(info|error|warn|debug)\s*\(\s*\{/g) || []).length;
      const consoleUsage = (output.content.match(/console\.\w+\s*\(/g) || []).length;
      if (consoleUsage > 0 && loggerUsage === 0) {
        return { score: PSI_SQ, issues: ['Uses console instead of structured JSON logger'] };
      }
      return { score: 1.0, issues: [] };
    },
  }),

  // ── Performance rules ──
  new CheckRule({
    id: 'no_sync_io',
    name: 'No Synchronous I/O',
    dimension: 'performance',
    pool: 'hot',
    check: (output) => {
      if (typeof output.content !== 'string' || output.type !== 'code') {
        return { score: 1.0, issues: [] };
      }
      const syncOps = output.content.match(/\b(readFileSync|writeFileSync|execSync|accessSync)\b/g);
      if (syncOps && syncOps.length > 0) {
        return {
          score: Math.max(PSI_SQ, 1 - syncOps.length * PSI_CUBE),
          issues: [`Found ${syncOps.length} synchronous I/O operation(s) in hot pool code`],
        };
      }
      return { score: 1.0, issues: [] };
    },
  }),

  // ── Safety rules ──
  new CheckRule({
    id: 'no_eval',
    name: 'No eval() Usage',
    dimension: 'safety',
    required: true,
    check: (output) => {
      if (typeof output.content !== 'string') return { score: 1.0, issues: [] };
      if (/\beval\s*\(/.test(output.content) || /new\s+Function\s*\(/.test(output.content)) {
        return { score: 0, issues: ['eval() or new Function() detected — security violation'] };
      }
      return { score: 1.0, issues: [] };
    },
  }),

  new CheckRule({
    id: 'no_secrets_in_code',
    name: 'No Hardcoded Secrets',
    dimension: 'safety',
    required: true,
    check: (output) => {
      if (typeof output.content !== 'string') return { score: 1.0, issues: [] };
      const secretPatterns = [
        /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
        /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
      ];
      for (const pat of secretPatterns) {
        if (pat.test(output.content)) {
          return { score: 0, issues: ['Potential hardcoded secret detected'] };
        }
      }
      return { score: 1.0, issues: [] };
    },
  }),

  new CheckRule({
    id: 'no_todos_in_prod',
    name: 'No TODOs in Production',
    dimension: 'completeness',
    check: (output) => {
      if (typeof output.content !== 'string') return { score: 1.0, issues: [] };
      const todos = output.content.match(/\/\/\s*(TODO|FIXME|HACK|XXX)\b/gi);
      if (todos && todos.length > 0) {
        return {
          score: Math.max(PSI, 1 - todos.length * PSI_FOURTH),
          issues: [`Found ${todos.length} TODO/FIXME marker(s) — must be resolved for production`],
        };
      }
      return { score: 1.0, issues: [] };
    },
  }),
]);

// ═══════════════════════════════════════════════════════════
// CHECK RESULT — Individual check outcome
// ═══════════════════════════════════════════════════════════

class CheckResult {
  /**
   * @param {string} outputId — the node output being checked
   * @param {string} pool — 'hot' | 'warm' | 'cold'
   */
  constructor(outputId, pool = 'warm') {
    this.outputId = outputId;
    this.pool = pool;
    this.timestamp = Date.now();
    this.dimensionScores = {};
    this.ruleResults = [];
    this.compositeScore = 0;
    this.passed = false;
    this.requiredFailures = [];
    this.issues = [];
  }

  addRuleResult(rule, result) {
    this.ruleResults.push({
      ruleId: rule.id,
      ruleName: rule.name,
      dimension: rule.dimension,
      required: rule.required,
      score: Number(result.score.toFixed(6)),
      issues: result.issues,
    });

    if (rule.required && result.score < CSL_THRESHOLDS.LOW) {
      this.requiredFailures.push(rule.id);
    }

    this.issues.push(...result.issues);
  }

  /**
   * Compute final scores and pass/fail.
   */
  finalize() {
    // Aggregate dimension scores
    const dimensionTotals = {};
    const dimensionCounts = {};

    for (const rr of this.ruleResults) {
      if (!dimensionTotals[rr.dimension]) {
        dimensionTotals[rr.dimension] = 0;
        dimensionCounts[rr.dimension] = 0;
      }
      dimensionTotals[rr.dimension] += rr.score;
      dimensionCounts[rr.dimension]++;
    }

    for (const dim of Object.keys(dimensionTotals)) {
      this.dimensionScores[dim] = Number(
        (dimensionTotals[dim] / dimensionCounts[dim]).toFixed(6)
      );
    }

    // Composite score = phi-weighted sum of dimension scores
    let weightedSum = 0;
    let weightTotal = 0;

    for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
      if (this.dimensionScores[dim] !== undefined) {
        weightedSum += weight * this.dimensionScores[dim];
        weightTotal += weight;
      }
    }

    this.compositeScore = weightTotal > 0
      ? Number((weightedSum / weightTotal).toFixed(6))
      : 0;

    // Determine pass/fail based on pool threshold
    const threshold = this.pool === 'hot' ? HOT_POOL_THRESHOLD
      : this.pool === 'cold' ? COLD_POOL_THRESHOLD
      : WARM_POOL_THRESHOLD;

    this.passed = (
      this.requiredFailures.length === 0 &&
      this.compositeScore >= threshold
    );

    return this;
  }

  toJSON() {
    return {
      outputId: this.outputId,
      pool: this.pool,
      timestamp: this.timestamp,
      passed: this.passed,
      compositeScore: this.compositeScore,
      dimensionScores: this.dimensionScores,
      requiredFailures: this.requiredFailures,
      issueCount: this.issues.length,
      issues: this.issues,
      ruleResults: this.ruleResults,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// HEADY CHECK ENGINE — Main quality gate
// ═══════════════════════════════════════════════════════════

class HeadyCheckEngine {
  constructor() {
    /** @type {Array<CheckRule>} */
    this._rules = [...BUILT_IN_RULES];
    /** @type {Array<CheckResult>} */
    this._history = [];
    this._activeChecks = 0;
    this._totalChecks = 0;
    this._totalPassed = 0;
    this._totalFailed = 0;
  }

  /**
   * Register a custom check rule.
   * @param {CheckRule} rule
   */
  addRule(rule) {
    if (this._rules.length >= MAX_RULES_PER_DOMAIN * Object.keys(DIMENSION_WEIGHTS).length) {
      logger.info({
        component: 'HeadyCheck',
        action: 'rule_limit_reached',
        maxRules: MAX_RULES_PER_DOMAIN * Object.keys(DIMENSION_WEIGHTS).length,
      });
      return false;
    }
    this._rules.push(rule);
    return true;
  }

  /**
   * Run all applicable checks against a node output.
   *
   * @param {object} output — { id, content, type, pool, metadata }
   * @param {object} [context] — additional context for check rules
   * @returns {CheckResult}
   */
  check(output, context = {}) {
    if (this._activeChecks >= MAX_CONCURRENT_CHECKS) {
      logger.info({
        component: 'HeadyCheck',
        action: 'backpressure',
        activeChecks: this._activeChecks,
        max: MAX_CONCURRENT_CHECKS,
      });
      const result = new CheckResult(output.id, output.pool);
      result.issues.push('Check skipped — backpressure limit reached');
      result.finalize();
      return result;
    }

    this._activeChecks++;
    this._totalChecks++;

    const result = new CheckResult(output.id, output.pool || 'warm');

    try {
      // Filter rules by pool applicability
      const applicableRules = this._rules.filter(r =>
        r.pool === 'all' || r.pool === output.pool
      );

      for (const rule of applicableRules) {
        try {
          const ruleResult = rule.check(output, context);
          result.addRuleResult(rule, ruleResult);
        } catch (err) {
          result.addRuleResult(rule, {
            score: PSI_SQ,
            issues: [`Rule ${rule.id} threw: ${err.message}`],
          });
        }
      }

      result.finalize();

      if (result.passed) {
        this._totalPassed++;
      } else {
        this._totalFailed++;
      }

      logger.info({
        component: 'HeadyCheck',
        action: 'check_complete',
        outputId: output.id,
        pool: output.pool,
        passed: result.passed,
        compositeScore: result.compositeScore,
        issueCount: result.issues.length,
        requiredFailures: result.requiredFailures,
      });

    } finally {
      this._activeChecks--;
    }

    // Record in history
    this._history.push(result);
    while (this._history.length > RESULT_HISTORY) {
      this._history.shift();
    }

    return result;
  }

  /**
   * Batch check multiple outputs.
   *
   * @param {Array<object>} outputs
   * @param {object} [context]
   * @returns {object} — { results, passRate, summary }
   */
  batchCheck(outputs, context = {}) {
    const results = outputs.map(output => this.check(output, context));

    const passed = results.filter(r => r.passed).length;
    const passRate = outputs.length > 0 ? passed / outputs.length : 0;

    const avgScore = results.length > 0
      ? results.reduce((s, r) => s + r.compositeScore, 0) / results.length
      : 0;

    return {
      results,
      total: outputs.length,
      passed,
      failed: outputs.length - passed,
      passRate: Number(passRate.toFixed(6)),
      averageScore: Number(avgScore.toFixed(6)),
    };
  }

  /**
   * Get pass rate statistics.
   */
  getStats() {
    const passRate = this._totalChecks > 0
      ? this._totalPassed / this._totalChecks
      : 0;

    // Recent trend — last fib(8) = 21 checks
    const recentCount = Math.min(this._history.length, fib(8));
    const recent = this._history.slice(-recentCount);
    const recentPassRate = recent.length > 0
      ? recent.filter(r => r.passed).length / recent.length
      : 0;

    // Dimension breakdown
    const dimensionAverages = {};
    for (const dim of Object.keys(DIMENSION_WEIGHTS)) {
      const scores = this._history
        .filter(r => r.dimensionScores[dim] !== undefined)
        .map(r => r.dimensionScores[dim]);
      dimensionAverages[dim] = scores.length > 0
        ? Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(6))
        : null;
    }

    return {
      totalChecks: this._totalChecks,
      totalPassed: this._totalPassed,
      totalFailed: this._totalFailed,
      overallPassRate: Number(passRate.toFixed(6)),
      recentPassRate: Number(recentPassRate.toFixed(6)),
      recentCheckCount: recentCount,
      dimensionAverages,
      activeChecks: this._activeChecks,
      ruleCount: this._rules.length,
    };
  }

  /**
   * Get the most common issues.
   * @param {number} [topN=fib(6)] — default 8
   */
  topIssues(topN = fib(6)) {
    const issueCounts = {};
    for (const result of this._history) {
      for (const issue of result.issues) {
        issueCounts[issue] = (issueCounts[issue] || 0) + 1;
      }
    }
    return Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([issue, count]) => ({ issue, count, frequency: Number((count / this._history.length).toFixed(6)) }));
  }

  /**
   * Get recent check history.
   * @param {number} [n=fib(7)] — default 13
   */
  recentHistory(n = fib(7)) {
    return this._history.slice(-n).map(r => r.toJSON());
  }
}

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════

const healthCheck = createHealthCheck('heady-check', () => {
  const engine = getSharedEngine();
  return engine.getStats();
});

// ═══════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════

let _sharedEngine = null;

function getSharedEngine() {
  if (!_sharedEngine) {
    _sharedEngine = new HeadyCheckEngine();
  }
  return _sharedEngine;
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  // Core
  HeadyCheckEngine,
  CheckRule,
  CheckResult,

  // Built-in rules
  BUILT_IN_RULES,

  // Singleton
  getSharedEngine,

  // Health
  healthCheck,

  // Constants (for testing)
  MAX_CONCURRENT_CHECKS,
  CHECK_TIMEOUT_MS,
  MAX_RULES_PER_DOMAIN,
  RESULT_HISTORY,
  HOT_POOL_THRESHOLD,
  WARM_POOL_THRESHOLD,
  COLD_POOL_THRESHOLD,
  REJECTION_THRESHOLD,
  MAX_CHECK_RETRIES,
  DIMENSION_WEIGHTS,
};
