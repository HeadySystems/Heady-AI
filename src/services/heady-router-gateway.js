// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ ROUTER GATEWAY — Intelligent LLM Routing               ║
// ║  Route between Claude/GPT/Gemini/Groq by cost, latency, quality║
// ║  FILE: src/services/heady-router-gateway.js                    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

'use strict';
const crypto = require('crypto');

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;

// ─── Model Registry ─────────────────────────────────────────────────

const MODELS = {
  'claude-sonnet-4-6': {
    provider: 'anthropic', name: 'Claude Sonnet 4.6',
    costPer1kInput: 0.003, costPer1kOutput: 0.015,
    avgLatencyMs: 1200, qualityScore: 0.92, maxTokens: 200000,
    available: true,
  },
  'claude-haiku-4-5': {
    provider: 'anthropic', name: 'Claude Haiku 4.5',
    costPer1kInput: 0.0008, costPer1kOutput: 0.004,
    avgLatencyMs: 600, qualityScore: 0.82, maxTokens: 200000,
    available: true,
  },
  'gpt-4o': {
    provider: 'openai', name: 'GPT-4o',
    costPer1kInput: 0.0025, costPer1kOutput: 0.01,
    avgLatencyMs: 1500, qualityScore: 0.90, maxTokens: 128000,
    available: true,
  },
  'gpt-4o-mini': {
    provider: 'openai', name: 'GPT-4o Mini',
    costPer1kInput: 0.00015, costPer1kOutput: 0.0006,
    avgLatencyMs: 400, qualityScore: 0.78, maxTokens: 128000,
    available: true,
  },
  'gemini-2.0-flash': {
    provider: 'google', name: 'Gemini 2.0 Flash',
    costPer1kInput: 0.0001, costPer1kOutput: 0.0004,
    avgLatencyMs: 350, qualityScore: 0.80, maxTokens: 1000000,
    available: true,
  },
  'groq-llama-3.3-70b': {
    provider: 'groq', name: 'Groq Llama 3.3 70B',
    costPer1kInput: 0.00059, costPer1kOutput: 0.00079,
    avgLatencyMs: 200, qualityScore: 0.75, maxTokens: 131072,
    available: true,
  },
};

// ─── Routing Engine ─────────────────────────────────────────────────

class RoutingEngine {
  constructor() {
    this.metrics = new Map(); // modelId → { calls, totalLatency, totalCost, totalTokens, errors }
    for (const id of Object.keys(MODELS)) {
      this.metrics.set(id, { calls: 0, totalLatencyMs: 0, totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, errors: 0 });
    }
    this.dailySpend = 0;
    this.dailyBudget = 50.00;
  }

  selectModel(strategy = 'balanced', constraints = {}) {
    const minQuality = constraints.minQuality || 0;
    const maxLatency = constraints.maxLatencyMs || Infinity;
    const maxCost = constraints.maxCostPer1k || Infinity;

    const candidates = Object.entries(MODELS)
      .filter(([, m]) => m.available && m.qualityScore >= minQuality && m.avgLatencyMs <= maxLatency)
      .map(([id, m]) => ({ id, ...m }));

    if (candidates.length === 0) {
      // Fallback to cheapest available model
      return Object.entries(MODELS)
        .filter(([, m]) => m.available)
        .sort((a, b) => a[1].costPer1kInput - b[1].costPer1kInput)[0]?.[0] || 'gpt-4o-mini';
    }

    // Budget guard — if over 80% budget, force cheapest
    if (this.dailySpend >= this.dailyBudget * 0.8) {
      candidates.sort((a, b) => a.costPer1kInput - b.costPer1kInput);
      return candidates[0].id;
    }

    switch (strategy) {
      case 'cost-optimized':
        candidates.sort((a, b) => a.costPer1kInput - b.costPer1kInput);
        return candidates[0].id;

      case 'quality-optimized':
        candidates.sort((a, b) => b.qualityScore - a.qualityScore);
        return candidates[0].id;

      case 'latency-optimized':
        candidates.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs);
        return candidates[0].id;

      case 'balanced':
      default: {
        // Weighted score: quality 40% + inverse cost 30% + inverse latency 30%
        const maxCostVal = Math.max(...candidates.map(c => c.costPer1kInput));
        const maxLatVal = Math.max(...candidates.map(c => c.avgLatencyMs));

        for (const c of candidates) {
          c.score = c.qualityScore * 0.4
            + (1 - c.costPer1kInput / (maxCostVal || 1)) * 0.3
            + (1 - c.avgLatencyMs / (maxLatVal || 1)) * 0.3;
        }
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].id;
      }
    }
  }

  recordRequest(modelId, inputTokens, outputTokens, latencyMs, success = true) {
    const model = MODELS[modelId];
    if (!model) return;

    const cost = (inputTokens / 1000) * model.costPer1kInput + (outputTokens / 1000) * model.costPer1kOutput;
    const m = this.metrics.get(modelId);
    m.calls++;
    m.totalLatencyMs += latencyMs;
    m.totalCost += cost;
    m.totalInputTokens += inputTokens;
    m.totalOutputTokens += outputTokens;
    if (!success) m.errors++;

    this.dailySpend += cost;

    // Update running average latency
    model.avgLatencyMs = Math.round(m.totalLatencyMs / m.calls);

    // Emit usage event for billing
    if (global.eventBus) {
      global.eventBus.emit('billing:usage', {
        productId: 'llm-routing',
        meter: 'heady_routed_tokens',
        quantity: inputTokens + outputTokens,
        modelId,
        cost,
        timestamp: new Date().toISOString(),
      });
    }

    return { modelId, cost: Math.round(cost * 10000) / 10000, latencyMs, tokens: inputTokens + outputTokens };
  }

  getStats() {
    const stats = {};
    for (const [id, m] of this.metrics) {
      stats[id] = {
        ...MODELS[id],
        calls: m.calls,
        avgLatencyMs: m.calls > 0 ? Math.round(m.totalLatencyMs / m.calls) : MODELS[id].avgLatencyMs,
        totalCost: Math.round(m.totalCost * 10000) / 10000,
        totalTokens: m.totalInputTokens + m.totalOutputTokens,
        errorRate: m.calls > 0 ? Math.round(m.errors / m.calls * 100) / 100 : 0,
      };
    }
    return stats;
  }

  getBudget() {
    return {
      dailyBudget: this.dailyBudget,
      dailySpend: Math.round(this.dailySpend * 10000) / 10000,
      remaining: Math.round((this.dailyBudget - this.dailySpend) * 10000) / 10000,
      percentUsed: Math.round(this.dailySpend / this.dailyBudget * 10000) / 100,
      budgetAlert: this.dailySpend >= this.dailyBudget * PSI,
    };
  }
}

// ─── Express Router ─────────────────────────────────────────────────

function createRouterGateway() {
  const express = require('express');
  const router = express.Router();
  const engine = new RoutingEngine();

  const auth = (req, res, next) => {
    const key = req.headers['x-heady-api-key'] || req.headers['authorization']?.split(' ')[1];
    if (!key || key !== process.env.HEADY_API_KEY) {
      return res.status(403).json({ error: 'API key required' });
    }
    next();
  };

  router.post('/complete', auth, (req, res) => {
    const { prompt, strategy, constraints, maxTokens } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const modelId = engine.selectModel(strategy || 'balanced', constraints || {});
    const model = MODELS[modelId];

    // Simulate completion (in production, call the actual provider API)
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.min(maxTokens || 1000, model.maxTokens);
    const latencyMs = model.avgLatencyMs + Math.round(Math.random() * 200 - 100);

    const usage = engine.recordRequest(modelId, inputTokens, outputTokens, latencyMs);

    res.json({
      ok: true,
      modelId,
      modelName: model.name,
      provider: model.provider,
      usage,
      response: `[Routed to ${model.name}] Response for: ${prompt.slice(0, 50)}...`,
      strategy: strategy || 'balanced',
    });
  });

  router.post('/embed', auth, (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    // Embedding always uses cheapest model
    const modelId = engine.selectModel('cost-optimized');
    const tokens = Math.ceil(text.length / 4);
    engine.recordRequest(modelId, tokens, 0, 50);

    res.json({
      ok: true, modelId, tokens,
      embedding: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
    });
  });

  router.get('/models', auth, (req, res) => {
    res.json({ ok: true, models: MODELS });
  });

  router.get('/stats', auth, (req, res) => {
    res.json({ ok: true, stats: engine.getStats(), budget: engine.getBudget() });
  });

  router.get('/budget', auth, (req, res) => {
    res.json({ ok: true, ...engine.getBudget() });
  });

  router.post('/config', auth, (req, res) => {
    const { dailyBudget, modelAvailability } = req.body;
    if (dailyBudget) engine.dailyBudget = dailyBudget;
    if (modelAvailability) {
      for (const [id, available] of Object.entries(modelAvailability)) {
        if (MODELS[id]) MODELS[id].available = available;
      }
    }
    res.json({ ok: true, budget: engine.getBudget(), models: MODELS });
  });

  return router;
}

module.exports = { createRouterGateway, MODELS, RoutingEngine };
