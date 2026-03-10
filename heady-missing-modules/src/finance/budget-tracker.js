/**
 * HeadyBudgetTracker — LLM Cost Management & Resource Budgeting
 *
 * Tracks token usage, API costs, and resource consumption across all providers.
 * Enforces per-provider daily caps and global monthly budgets.
 * Auto-downgrades to cheaper models when approaching limits.
 *
 * All budgets and thresholds use phi-scaled constants.
 *
 * © 2026 HeadySystems Inc. — Sacred Geometry v4.0
 * @module finance/budget-tracker
 */

const { PHI, PSI, fib, CSL_THRESHOLDS, phiFusionWeights } = require('../shared/phi-math');
const { createLogger } = require('../shared/logger');

const logger = createLogger('BudgetTracker');

/** Provider cost rates ($/1M tokens, approximate 2026 rates) */
const PROVIDER_RATES = Object.freeze({
  'anthropic-opus':    { input: 15.0,  output: 75.0  },
  'anthropic-sonnet':  { input: 3.0,   output: 15.0  },
  'anthropic-haiku':   { input: 0.25,  output: 1.25  },
  'openai-gpt4o':      { input: 2.5,   output: 10.0  },
  'openai-gpt4o-mini': { input: 0.15,  output: 0.60  },
  'google-gemini-pro': { input: 1.25,  output: 5.0   },
  'google-gemini-flash': { input: 0.075, output: 0.30 },
  'groq-llama':        { input: 0.05,  output: 0.08  },
  'perplexity-sonar':  { input: 1.0,   output: 1.0   },
  'cloudflare-edge':   { input: 0.01,  output: 0.01  },
  'local-ollama':      { input: 0,     output: 0     },
});

/** Phi-scaled alert thresholds for budget utilization */
const BUDGET_ALERTS = Object.freeze({
  nominal:  PSI * PSI,          // ≈ 0.382 — all good
  warning:  PSI,                // ≈ 0.618 — start monitoring
  caution:  1 - PSI * PSI,     // ≈ 0.764 — consider downgrade
  critical: 1 - PSI * PSI * PSI, // ≈ 0.854 — force downgrade
  exceeded: 1 - Math.pow(PSI, 4), // ≈ 0.910 — block non-essential
});

/** Downgrade chains — when budget is tight, use cheaper alternatives */
const DOWNGRADE_CHAINS = Object.freeze({
  'anthropic-opus':    ['anthropic-sonnet', 'anthropic-haiku', 'groq-llama'],
  'anthropic-sonnet':  ['anthropic-haiku', 'groq-llama'],
  'openai-gpt4o':      ['openai-gpt4o-mini', 'groq-llama'],
  'google-gemini-pro': ['google-gemini-flash', 'groq-llama'],
  'perplexity-sonar':  ['anthropic-sonnet', 'groq-llama'],
});

class BudgetTracker {
  /**
   * @param {Object} config
   * @param {number} config.dailyCapUsd - Daily spend cap in USD
   * @param {number} config.monthlyCapUsd - Monthly spend cap in USD
   * @param {Object} [config.providerDailyCaps] - Per-provider daily caps { provider: usd }
   */
  constructor(config) {
    this.dailyCap = config.dailyCapUsd;
    this.monthlyCap = config.monthlyCapUsd;
    this.providerCaps = config.providerDailyCaps || {};
    this.usage = new Map();      // provider -> { inputTokens, outputTokens, costUsd, requests }
    this.dailyUsage = new Map(); // provider -> same, resets daily
    this.monthlyTotal = 0;
    this.dailyTotal = 0;
    this.lastResetDay = this._today();
    this.lastResetMonth = this._month();
    this.alerts = [];
  }

  /**
   * Record token usage for a provider.
   * @param {string} provider - Provider ID
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @returns {{ costUsd: number, alert: string|null, downgrade: string|null }}
   */
  record(provider, inputTokens, outputTokens) {
    this._checkResets();

    const rates = PROVIDER_RATES[provider];
    if (!rates) {
      logger.warn({ provider }, 'Unknown provider — recording zero cost');
      return { costUsd: 0, alert: null, downgrade: null };
    }

    const costUsd = (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;

    // Update running totals
    if (!this.usage.has(provider)) {
      this.usage.set(provider, { inputTokens: 0, outputTokens: 0, costUsd: 0, requests: 0 });
    }
    if (!this.dailyUsage.has(provider)) {
      this.dailyUsage.set(provider, { inputTokens: 0, outputTokens: 0, costUsd: 0, requests: 0 });
    }

    const allTime = this.usage.get(provider);
    allTime.inputTokens += inputTokens;
    allTime.outputTokens += outputTokens;
    allTime.costUsd += costUsd;
    allTime.requests++;

    const daily = this.dailyUsage.get(provider);
    daily.inputTokens += inputTokens;
    daily.outputTokens += outputTokens;
    daily.costUsd += costUsd;
    daily.requests++;

    this.dailyTotal += costUsd;
    this.monthlyTotal += costUsd;

    // Check budget status
    const alert = this._checkAlerts(provider);
    const downgrade = this._checkDowngrade(provider);

    if (alert) {
      this.alerts.push({ timestamp: new Date().toISOString(), provider, alert, costUsd });
      if (this.alerts.length > fib(11)) this.alerts = this.alerts.slice(-fib(10));
    }

    logger.info({
      provider,
      inputTokens,
      outputTokens,
      costUsd: costUsd.toFixed(6),
      dailyTotal: this.dailyTotal.toFixed(4),
      monthlyTotal: this.monthlyTotal.toFixed(4),
    }, 'Usage recorded');

    return { costUsd, alert, downgrade };
  }

  /**
   * Get the recommended model for a provider, considering budget.
   * May return a downgrade if budget is tight.
   * @param {string} preferredProvider
   * @returns {string} Provider to use
   */
  getEffectiveProvider(preferredProvider) {
    const downgrade = this._checkDowngrade(preferredProvider);
    return downgrade || preferredProvider;
  }

  /**
   * Check if a provider is within budget.
   * @param {string} provider
   * @returns {boolean}
   */
  canUse(provider) {
    this._checkResets();

    // Check provider daily cap
    const providerCap = this.providerCaps[provider];
    if (providerCap) {
      const daily = this.dailyUsage.get(provider);
      if (daily && daily.costUsd >= providerCap) return false;
    }

    // Check global daily cap
    if (this.dailyTotal >= this.dailyCap) return false;

    // Check monthly cap
    if (this.monthlyTotal >= this.monthlyCap) return false;

    return true;
  }

  /**
   * Get budget utilization summary.
   * @returns {Object}
   */
  summary() {
    this._checkResets();

    const providerBreakdown = {};
    for (const [provider, data] of this.dailyUsage) {
      providerBreakdown[provider] = {
        ...data,
        costUsd: parseFloat(data.costUsd.toFixed(6)),
        capUsd: this.providerCaps[provider] || 'unlimited',
        utilizationPct: this.providerCaps[provider]
          ? parseFloat((data.costUsd / this.providerCaps[provider] * 100).toFixed(2))
          : null,
      };
    }

    return {
      daily: {
        spent: parseFloat(this.dailyTotal.toFixed(4)),
        cap: this.dailyCap,
        utilization: parseFloat((this.dailyTotal / this.dailyCap).toFixed(4)),
        alertLevel: this._getAlertLevel(this.dailyTotal / this.dailyCap),
      },
      monthly: {
        spent: parseFloat(this.monthlyTotal.toFixed(4)),
        cap: this.monthlyCap,
        utilization: parseFloat((this.monthlyTotal / this.monthlyCap).toFixed(4)),
        alertLevel: this._getAlertLevel(this.monthlyTotal / this.monthlyCap),
      },
      providers: providerBreakdown,
      recentAlerts: this.alerts.slice(-fib(5)),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────

  _checkAlerts(provider) {
    const dailyUtil = this.dailyTotal / this.dailyCap;
    const monthlyUtil = this.monthlyTotal / this.monthlyCap;
    const util = Math.max(dailyUtil, monthlyUtil);

    if (util >= BUDGET_ALERTS.exceeded) return 'exceeded';
    if (util >= BUDGET_ALERTS.critical) return 'critical';
    if (util >= BUDGET_ALERTS.caution) return 'caution';
    if (util >= BUDGET_ALERTS.warning) return 'warning';
    return null;
  }

  _checkDowngrade(provider) {
    const dailyUtil = this.dailyTotal / this.dailyCap;

    if (dailyUtil < BUDGET_ALERTS.caution) return null;

    const chain = DOWNGRADE_CHAINS[provider];
    if (!chain) return null;

    // Find first available downgrade
    for (const alt of chain) {
      if (this.canUse(alt)) return alt;
    }
    return null;
  }

  _getAlertLevel(utilization) {
    if (utilization >= BUDGET_ALERTS.exceeded) return 'exceeded';
    if (utilization >= BUDGET_ALERTS.critical) return 'critical';
    if (utilization >= BUDGET_ALERTS.caution) return 'caution';
    if (utilization >= BUDGET_ALERTS.warning) return 'warning';
    return 'nominal';
  }

  _checkResets() {
    const today = this._today();
    if (today !== this.lastResetDay) {
      this.dailyUsage.clear();
      this.dailyTotal = 0;
      this.lastResetDay = today;
      logger.info({}, 'Daily budget reset');
    }

    const month = this._month();
    if (month !== this.lastResetMonth) {
      this.monthlyTotal = 0;
      this.lastResetMonth = month;
      logger.info({}, 'Monthly budget reset');
    }
  }

  _today() { return new Date().toISOString().split('T')[0]; }
  _month() { return new Date().toISOString().slice(0, 7); }

  /** Health check */
  health() {
    return {
      service: 'BudgetTracker',
      status: 'up',
      dailyUtilization: parseFloat((this.dailyTotal / this.dailyCap).toFixed(4)),
      monthlyUtilization: parseFloat((this.monthlyTotal / this.monthlyCap).toFixed(4)),
      alertLevel: this._getAlertLevel(Math.max(
        this.dailyTotal / this.dailyCap,
        this.monthlyTotal / this.monthlyCap
      )),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { BudgetTracker, PROVIDER_RATES, BUDGET_ALERTS, DOWNGRADE_CHAINS };
