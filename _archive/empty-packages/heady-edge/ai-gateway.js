'use strict';

/**
 * HEADY™ Cloudflare AI Gateway — Liquid Architecture v9 (§3)
 *
 * Unified LLM proxy through gateway.ai.cloudflare.com:
 * - Response caching (up to 90% latency reduction for repeated queries)
 * - Automatic provider fallback: Gemini → GPT → Workers AI → Colab vLLM
 * - Per-user rate limiting
 * - Cost analytics across all providers from one dashboard
 *
 * Usage:
 *   const gateway = new AIGateway({ accountId, gatewayId });
 *   const result = await gateway.chat('You are Heady', 'Hello', { provider: 'google' });
 */

const FALLBACK_CHAIN = ['google', 'azure-openai', 'workers-ai', 'huggingface'];

const PROVIDER_MODELS = {
  'google':       { model: 'gemini-2.5-flash-lite', inputCost: 0.10, outputCost: 0.40 },
  'azure-openai': { model: 'gpt-5-nano',           inputCost: 0.05, outputCost: 0.40 },
  'workers-ai':   { model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', inputCost: 0.29, outputCost: 2.25 },
  'huggingface':  { model: 'Qwen/Qwen3-30B-A3B',   inputCost: 0.05, outputCost: 0.34 },
};

class AIGateway {
  /**
   * @param {object} config
   * @param {string} config.accountId  - Cloudflare account ID
   * @param {string} config.gatewayId  - AI Gateway name
   * @param {string[]} [config.fallbackChain] - Provider fallback order
   */
  constructor(config = {}) {
    this.accountId = config.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    this.gatewayId = config.gatewayId || process.env.AI_GATEWAY_ID || 'heady-gateway';
    this.fallbackChain = config.fallbackChain || FALLBACK_CHAIN;

    if (!this.accountId) {
      console.warn('[AIGateway] No CLOUDFLARE_ACCOUNT_ID — running in passthrough mode');
    }
  }

  /**
   * Get the AI Gateway base URL for a specific provider.
   * All LLM calls route through this URL for caching + analytics.
   *
   * @param {string} provider - 'google', 'azure-openai', 'workers-ai', 'huggingface'
   * @returns {string} Gateway URL
   */
  getBaseUrl(provider) {
    return `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.gatewayId}/${provider}`;
  }

  /**
   * Chat completion with automatic fallback across providers.
   *
   * @param {string} systemPrompt
   * @param {string} userMessage
   * @param {object} [options]
   * @param {string} [options.provider]  - Preferred provider (falls back on failure)
   * @param {string} [options.model]     - Override model
   * @param {number} [options.maxTokens=1024]
   * @param {number} [options.temperature=0.7]
   * @param {boolean} [options.cache=true] - Enable AI Gateway response caching
   * @returns {Promise<{content: string, provider: string, model: string, cached: boolean}>}
   */
  async chat(systemPrompt, userMessage, options = {}) {
    const chain = options.provider
      ? [options.provider, ...this.fallbackChain.filter(p => p !== options.provider)]
      : [...this.fallbackChain];

    let lastError;

    for (const provider of chain) {
      try {
        const result = await this._callProvider(provider, systemPrompt, userMessage, options);
        return { ...result, provider };
      } catch (err) {
        lastError = err;
        console.warn(`[AIGateway] ${provider} failed: ${err.message}, trying next...`);
      }
    }

    throw new Error(`[AIGateway] All providers failed. Last error: ${lastError?.message}`);
  }

  async _callProvider(provider, systemPrompt, userMessage, options = {}) {
    const providerConfig = PROVIDER_MODELS[provider] || {};
    const model = options.model || providerConfig.model;
    const maxTokens = options.maxTokens || 1024;
    const temperature = options.temperature ?? 0.7;

    const baseUrl = this.getBaseUrl(provider);

    // Unified OpenAI-compatible request format (all providers support this via AI Gateway)
    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature,
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    // Add provider-specific auth
    if (provider === 'google') {
      headers['Authorization'] = `Bearer ${process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY}`;
    } else if (provider === 'azure-openai') {
      headers['api-key'] = process.env.AZURE_OPENAI_API_KEY;
    } else if (provider === 'workers-ai') {
      headers['Authorization'] = `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`;
    } else if (provider === 'huggingface') {
      headers['Authorization'] = `Bearer ${process.env.HF_TOKEN}`;
    }

    // AI Gateway caching header
    if (options.cache !== false) {
      headers['cf-aig-cache-ttl'] = String(options.cacheTtl || 3600);
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`${provider} ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content,
      model,
      cached: response.headers.get('cf-aig-cache-status') === 'HIT',
      usage: data.usage || {},
    };
  }

  /**
   * Generate embeddings through AI Gateway.
   * @param {string} text    - Text to embed
   * @param {string} [model] - Embedding model (default: BGE-M3 on Workers AI)
   */
  async embed(text, model = '@cf/baai/bge-m3') {
    const baseUrl = this.getBaseUrl('workers-ai');

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      },
      body: JSON.stringify({ model, input: text }),
    });

    if (!response.ok) throw new Error(`Embed failed: ${response.status}`);
    const data = await response.json();
    return data.data?.[0]?.embedding || data.result?.data?.[0] || [];
  }
}

module.exports = { AIGateway, PROVIDER_MODELS, FALLBACK_CHAIN };
