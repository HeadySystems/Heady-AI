/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Azure OpenAI Client — v9.0 Blueprint §5
 *
 * Exclusive enterprise-grade GPT model access with data privacy.
 * Your data never trains OpenAI's models.
 *
 * Models: GPT-5-nano ($0.05/$0.40 per M tokens) for classification/routing,
 *         GPT-4.1-mini ($0.40/$1.60) for mid-complexity tasks.
 *
 * Set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and
 * AZURE_OPENAI_API_VERSION in env.
 */

'use strict';

const {
  getLogger
} = require('./structured-logger');
const logger = getLogger('azure-openai');
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || '';
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
const isConfigured = !!(AZURE_ENDPOINT && AZURE_API_KEY);

// v9.0 Blueprint §5: Model routing — GPT-5-nano for classification, GPT-4.1-mini for reasoning
const MODELS = {
  'gpt-5-nano': {
    costPerMInputTokens: 0.05,
    costPerMOutputTokens: 0.40,
    maxTokens: 8192
  },
  'gpt-4.1-mini': {
    costPerMInputTokens: 0.40,
    costPerMOutputTokens: 1.60,
    maxTokens: 16384
  },
  'gpt-4.1': {
    costPerMInputTokens: 2.00,
    costPerMOutputTokens: 8.00,
    maxTokens: 32768
  }
};
class AzureOpenAIClient {
  constructor(endpoint = AZURE_ENDPOINT, apiKey = AZURE_API_KEY, apiVersion = AZURE_API_VERSION) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.apiVersion = apiVersion;
    this._stats = {
      requests: 0,
      errors: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0
    };
  }
  async chatCompletion(deploymentName, messages, opts = {}) {
    const url = `${this.endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${this.apiVersion}`;
    this._stats.requests++;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify({
          messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.max_tokens ?? 4096,
          top_p: opts.top_p ?? 1,
          ...opts
        })
      });
      if (!res.ok) {
        const text = await res.text();
        this._stats.errors++;
        throw new Error(`Azure OpenAI ${res.status}: ${text}`);
      }
      const data = await res.json();

      // Track token usage and cost
      if (data.usage) {
        this._stats.tokensIn += data.usage.prompt_tokens || 0;
        this._stats.tokensOut += data.usage.completion_tokens || 0;
        const modelInfo = MODELS[deploymentName];
        if (modelInfo) {
          this._stats.costUsd += data.usage.prompt_tokens / 1_000_000 * modelInfo.costPerMInputTokens + data.usage.completion_tokens / 1_000_000 * modelInfo.costPerMOutputTokens;
        }
      }
      return data;
    } catch (err) {
      this._stats.errors++;
      logger.error('Azure OpenAI request failed', {
        deployment: deploymentName,
        error: err.message
      });
      throw err;
    }
  }

  /**
   * v9.0 Blueprint §5: Route to the cheapest model that can handle the task.
   * Classification/routing → GPT-5-nano
   * Mid-complexity → GPT-4.1-mini
   * Complex reasoning → GPT-4.1
   */
  async smartRoute(messages, complexity = 'low', opts = {}) {
    const deploymentMap = {
      low: 'gpt-5-nano',
      // $0.05/$0.40 — classification, routing
      medium: 'gpt-4.1-mini',
      // $0.40/$1.60 — mid-complexity
      high: 'gpt-4.1' // $2.00/$8.00 — complex reasoning
    };
    const deployment = deploymentMap[complexity] || deploymentMap.medium;
    return this.chatCompletion(deployment, messages, opts);
  }

  /**
   * Text embedding via Azure OpenAI.
   */
  async embedding(deploymentName, input) {
    const url = `${this.endpoint}/openai/deployments/${deploymentName}/embeddings?api-version=${this.apiVersion}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey
      },
      body: JSON.stringify({
        input
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Azure OpenAI embedding ${res.status}: ${text}`);
    }
    return res.json();
  }
  getStats() {
    return {
      ...this._stats,
      configured: isConfigured,
      costUsdFormatted: `$${this._stats.costUsd.toFixed(4)}`
    };
  }
}

// ── Singleton ───────────────────────────────────────────────
let _instance = null;
function getAzureOpenAIClient() {
  if (_instance) return _instance;
  if (!isConfigured) {
    logger.warn('Azure OpenAI not configured (set AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY)');
    return null;
  }
  _instance = new AzureOpenAIClient();
  logger.info('Azure OpenAI client initialized', {
    endpoint: AZURE_ENDPOINT.replace(/\/\/.*@/, '//***@')
  });
  return _instance;
}
module.exports = {
  AzureOpenAIClient,
  getAzureOpenAIClient,
  MODELS,
  isConfigured
};

// --- Auto-Unified Latent Service Pattern ---
if (module.exports && typeof module.exports === 'object') {
  if (!module.exports.start) module.exports.start = async () => ({ status: 'started' });
  if (!module.exports.stop) module.exports.stop = async () => ({ status: 'stopped' });
  if (!module.exports.health) module.exports.health = () => ({ status: 'healthy' });
  if (!module.exports.metrics) module.exports.metrics = () => ({ usages: 0 });
  if (!module.exports._tick) module.exports._tick = async () => {};
}
// -------------------------------------------
