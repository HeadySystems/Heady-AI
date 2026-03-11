// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Budget Tracker — φ-Scaled LLM Spend Tracking & Auto-Downgrade
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PHI, PSI, PSI2, PSI3, FIB, CSL_THRESHOLDS,
  cslGate, phiFusionWeights, sha256, SEED
} from '../shared/phi-math-v2.js';

const BUDGET_TIERS = Object.freeze([
  { name: 'micro',     dailyCap: FIB[5],   monthlyCap: FIB[5] * FIB[8] },
  { name: 'standard',  dailyCap: FIB[8],   monthlyCap: FIB[8] * FIB[8] },
  { name: 'enhanced',  dailyCap: FIB[10],  monthlyCap: FIB[10] * FIB[8] },
  { name: 'unlimited', dailyCap: FIB[14],  monthlyCap: FIB[14] * FIB[8] },
]);

const PROVIDER_COSTS = Object.freeze({
  'anthropic-sonnet':   { inputPer1k: 0.003, outputPer1k: 0.015 },
  'anthropic-opus':     { inputPer1k: 0.015, outputPer1k: 0.075 },
  'anthropic-haiku':    { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  'openai-gpt4o':       { inputPer1k: 0.005, outputPer1k: 0.015 },
  'openai-gpt4o-mini':  { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'google-gemini-pro':  { inputPer1k: 0.00125, outputPer1k: 0.005 },
  'google-gemini-flash':{ inputPer1k: 0.000075, outputPer1k: 0.0003 },
  'groq-llama':         { inputPer1k: 0.00005, outputPer1k: 0.00008 },
  'perplexity-sonar':   { inputPer1k: 0.001, outputPer1k: 0.001 },
  'local-ollama':       { inputPer1k: 0, outputPer1k: 0 },
});

const DOWNGRADE_CHAIN = Object.freeze([
  'anthropic-opus', 'anthropic-sonnet', 'openai-gpt4o', 'google-gemini-pro',
  'openai-gpt4o-mini', 'google-gemini-flash', 'groq-llama', 'local-ollama',
]);

class BudgetTracker {
  #dailySpend;
  #monthlySpend;
  #providerSpend;
  #taskTypeSpend;
  #currentTier;
  #history;
  #maxHistory;
  #warningThreshold;
  #autoDowngradeThreshold;

  constructor(tierName = 'standard') {
    this.#dailySpend = 0;
    this.#monthlySpend = 0;
    this.#providerSpend = new Map();
    this.#taskTypeSpend = new Map();
    this.#currentTier = BUDGET_TIERS.find(t => t.name === tierName) || BUDGET_TIERS[1];
    this.#history = [];
    this.#maxHistory = FIB[16];
    this.#warningThreshold = PSI;        // 61.8% of cap
    this.#autoDowngradeThreshold = 1 - PSI3; // 76.4% of cap
  }

  async track(provider, taskType, inputTokens, outputTokens) {
    const costs = PROVIDER_COSTS[provider];
    if (!costs) throw new Error('Unknown provider: ' + provider);

    const cost = (inputTokens / 1000) * costs.inputPer1k + (outputTokens / 1000) * costs.outputPer1k;

    this.#dailySpend += cost;
    this.#monthlySpend += cost;

    const prev = this.#providerSpend.get(provider) || 0;
    this.#providerSpend.set(provider, prev + cost);

    const prevTask = this.#taskTypeSpend.get(taskType) || 0;
    this.#taskTypeSpend.set(taskType, prevTask + cost);

    const record = {
      provider, taskType, inputTokens, outputTokens, cost,
      dailyTotal: this.#dailySpend,
      timestamp: Date.now(),
      hash: await sha256(provider + ':' + cost + ':' + Date.now()),
    };

    this.#history.push(record);
    if (this.#history.length > this.#maxHistory) {
      this.#history = this.#history.slice(-this.#maxHistory);
    }

    const alerts = this.#checkAlerts();
    return { cost, dailyTotal: this.#dailySpend, monthlyTotal: this.#monthlySpend, alerts };
  }

  getSpend() {
    return {
      daily: this.#dailySpend,
      monthly: this.#monthlySpend,
      byProvider: Object.fromEntries(this.#providerSpend),
      byTaskType: Object.fromEntries(this.#taskTypeSpend),
      tier: this.#currentTier.name,
      dailyCap: this.#currentTier.dailyCap,
      monthlyCap: this.#currentTier.monthlyCap,
      dailyUtilization: this.#dailySpend / this.#currentTier.dailyCap,
      monthlyUtilization: this.#monthlySpend / this.#currentTier.monthlyCap,
    };
  }

  getBudget() {
    return {
      dailyRemaining: Math.max(0, this.#currentTier.dailyCap - this.#dailySpend),
      monthlyRemaining: Math.max(0, this.#currentTier.monthlyCap - this.#monthlySpend),
      tier: this.#currentTier,
      warningAt: this.#currentTier.dailyCap * this.#warningThreshold,
      downgradeAt: this.#currentTier.dailyCap * this.#autoDowngradeThreshold,
    };
  }

  autoDowngrade(currentProvider) {
    const dailyUtilization = this.#dailySpend / this.#currentTier.dailyCap;
    if (dailyUtilization < this.#autoDowngradeThreshold) {
      return { downgraded: false, provider: currentProvider };
    }

    const currentIdx = DOWNGRADE_CHAIN.indexOf(currentProvider);
    if (currentIdx === -1 || currentIdx >= DOWNGRADE_CHAIN.length - 1) {
      return { downgraded: false, provider: currentProvider, reason: 'Already at lowest tier' };
    }

    const newProvider = DOWNGRADE_CHAIN[currentIdx + 1];
    return {
      downgraded: true,
      from: currentProvider,
      to: newProvider,
      reason: 'Daily utilization at ' + (dailyUtilization * 100).toFixed(1) + '%',
      savingsEstimate: this.#estimateSavings(currentProvider, newProvider),
    };
  }

  projectCosts(tokensPerDay, provider) {
    const costs = PROVIDER_COSTS[provider];
    if (!costs) return null;

    const avgInputRatio = PSI;  // 61.8% input, 38.2% output
    const dailyCost = (tokensPerDay * avgInputRatio / 1000) * costs.inputPer1k +
                      (tokensPerDay * PSI2 / 1000) * costs.outputPer1k;
    return {
      daily: dailyCost,
      weekly: dailyCost * FIB[5] + dailyCost * FIB[3], // 7 days approx
      monthly: dailyCost * FIB[8] * PSI + dailyCost * FIB[7], // ~30 days
      yearly: dailyCost * FIB[12] * FIB[3] + dailyCost * FIB[8], // ~365 days
    };
  }

  resetDaily() {
    this.#dailySpend = 0;
    this.#providerSpend.clear();
    this.#taskTypeSpend.clear();
  }

  resetMonthly() {
    this.#monthlySpend = 0;
    this.resetDaily();
  }

  getHistory(limit = FIB[8]) { return this.#history.slice(-limit); }

  #checkAlerts() {
    const alerts = [];
    const dailyRatio = this.#dailySpend / this.#currentTier.dailyCap;
    const monthlyRatio = this.#monthlySpend / this.#currentTier.monthlyCap;

    if (dailyRatio >= 1) alerts.push({ level: 'exceeded', scope: 'daily', ratio: dailyRatio });
    else if (dailyRatio >= this.#autoDowngradeThreshold) alerts.push({ level: 'critical', scope: 'daily', ratio: dailyRatio });
    else if (dailyRatio >= this.#warningThreshold) alerts.push({ level: 'warning', scope: 'daily', ratio: dailyRatio });

    if (monthlyRatio >= 1) alerts.push({ level: 'exceeded', scope: 'monthly', ratio: monthlyRatio });
    else if (monthlyRatio >= this.#autoDowngradeThreshold) alerts.push({ level: 'critical', scope: 'monthly', ratio: monthlyRatio });
    else if (monthlyRatio >= this.#warningThreshold) alerts.push({ level: 'warning', scope: 'monthly', ratio: monthlyRatio });

    return alerts;
  }

  #estimateSavings(from, to) {
    const fromCost = PROVIDER_COSTS[from];
    const toCost = PROVIDER_COSTS[to];
    if (!fromCost || !toCost) return 0;
    const avgCostFrom = (fromCost.inputPer1k + fromCost.outputPer1k) / 2;
    const avgCostTo = (toCost.inputPer1k + toCost.outputPer1k) / 2;
    return avgCostFrom > 0 ? (1 - avgCostTo / avgCostFrom) : 0;
  }
}

export { BudgetTracker, BUDGET_TIERS, PROVIDER_COSTS, DOWNGRADE_CHAIN };
export default BudgetTracker;
