// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Smart Model Router v1.0                                ║
// ║  CSL-scored complexity → φ-weighted provider selection          ║
// ║  Target: 30-50% LLM cost reduction via intelligent routing     ║
// ║  ⚠️ PATENT LOCK — HS-2026-051 — φ-scaled AI orchestration     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';

const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'smart-router',
  base: { service: 'smart-router', node: 'headyconductor' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// ── Provider Registry (ordered by cost, ascending) ──────────────────
const PROVIDERS = [
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3.2',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    keyEnv: 'DEEPSEEK_API_KEY',
    costInput: 0.14,   // $/M tokens
    costOutput: 0.28,
    costCached: 0.028,
    maxTokens: 65536,
    tier: 'economy',
    quality: 0.79,      // vs GPT-5 baseline
    speed: 'medium',
    supports: ['chat', 'code', 'reasoning'],
  },
  {
    id: 'groq-scout',
    name: 'Groq Llama 4 Scout',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    keyEnv: 'GROQ_API_KEY',
    costInput: 0.11,
    costOutput: 0.34,
    costCached: 0,
    maxTokens: 8192,
    tier: 'economy',
    quality: 0.72,
    speed: 'ultrafast',  // 594 tok/s
    supports: ['chat', 'classification', 'triage'],
  },
  {
    id: 'gemini-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    endpoint: `https://gateway.ai.cloudflare.com/v1/${process.env.CF_ACCOUNT_ID}/heady/google-ai-studio/v1beta/models/gemini-2.5-flash-lite:generateContent`,
    model: 'gemini-2.5-flash-lite',
    keyEnv: 'GEMINI_API_KEY',
    costInput: 0.10,
    costOutput: 0.40,
    costCached: 0.025,
    maxTokens: 65536,
    tier: 'economy',
    quality: 0.70,
    speed: 'fast',
    supports: ['chat', 'classification', 'multimodal'],
    isGemini: true,
  },
  {
    id: 'groq-llama-70b',
    name: 'Groq Llama 3.3 70B',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    keyEnv: 'GROQ_API_KEY',
    costInput: 0.59,
    costOutput: 0.79,
    costCached: 0,
    maxTokens: 32768,
    tier: 'standard',
    quality: 0.84,
    speed: 'ultrafast',
    supports: ['chat', 'code', 'reasoning'],
  },
  {
    id: 'gemini-flash',
    name: 'Gemini 2.5 Flash',
    endpoint: `https://gateway.ai.cloudflare.com/v1/${process.env.CF_ACCOUNT_ID}/heady/google-ai-studio/v1beta/models/gemini-2.5-flash:generateContent`,
    model: 'gemini-2.5-flash',
    keyEnv: 'GEMINI_API_KEY',
    costInput: 0.30,
    costOutput: 2.50,
    costCached: 0.075,
    maxTokens: 65536,
    tier: 'standard',
    quality: 0.86,
    speed: 'fast',
    supports: ['chat', 'code', 'reasoning', 'multimodal'],
    isGemini: true,
  },
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 4',
    endpoint: `https://gateway.ai.cloudflare.com/v1/${process.env.CF_ACCOUNT_ID}/heady/anthropic/v1/messages`,
    model: process.env.MODEL_ANTHROPIC_PRIMARY || 'claude-sonnet-4-20250514',
    keyEnv: 'ANTHROPIC_API_KEY',
    costInput: 3.0,
    costOutput: 15.0,
    costCached: 0.30,
    maxTokens: 64000,
    tier: 'premium',
    quality: 0.95,
    speed: 'medium',
    supports: ['chat', 'code', 'reasoning', 'tool-use', 'analysis'],
    isAnthropic: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    endpoint: `https://gateway.ai.cloudflare.com/v1/${process.env.CF_ACCOUNT_ID}/heady/openai/v1/chat/completions`,
    model: process.env.MODEL_OPENAI_FALLBACK || 'gpt-4o',
    keyEnv: 'OPENAI_API_KEY',
    costInput: 2.50,
    costOutput: 10.0,
    costCached: 1.25,
    maxTokens: 16384,
    tier: 'premium',
    quality: 0.92,
    speed: 'medium',
    supports: ['chat', 'code', 'reasoning', 'tool-use', 'multimodal'],
  },
  {
    id: 'claude-opus',
    name: 'Claude Opus 4',
    endpoint: `https://gateway.ai.cloudflare.com/v1/${process.env.CF_ACCOUNT_ID}/heady/anthropic/v1/messages`,
    model: process.env.MODEL_ANTHROPIC_DEEP || 'claude-opus-4-0-20250617',
    keyEnv: 'ANTHROPIC_API_KEY',
    costInput: 15.0,
    costOutput: 75.0,
    costCached: 1.50,
    maxTokens: 32000,
    tier: 'ultra',
    quality: 0.99,
    speed: 'slow',
    supports: ['chat', 'code', 'reasoning', 'tool-use', 'analysis', 'architecture'],
    isAnthropic: true,
  },
];

// ── Complexity Signals ──────────────────────────────────────────────
const COMPLEXITY_SIGNALS = {
  // Token count thresholds (φ-scaled)
  shortQuery:    100,                    // < 100 tokens → economy
  mediumQuery:   Math.round(100 * PHI),  // < 162 tokens → standard
  longQuery:     Math.round(100 * PHI * PHI), // < 262 tokens → premium

  // Intent complexity mapping
  intentWeights: {
    conversational: 0.2,
    question:       0.3,
    classification: 0.2,
    creative:       0.5,
    technical:      0.6,
    code:           0.7,
    reasoning:      0.8,
    analysis:       0.85,
    architecture:   0.95,
  },

  // Context depth (number of prior messages)
  contextDepthWeight: 0.05, // per message, capped at 0.3
};

/**
 * Estimate query complexity on [0, 1] scale using CSL-inspired scoring.
 * Uses φ-weighted composite of multiple signals.
 */
export function estimateComplexity(query, context = {}) {
  const signals = [];

  // Signal 1: Token count (rough estimate: 4 chars per token)
  const estimatedTokens = Math.ceil(query.length / 4);
  const tokenComplexity = Math.min(1, estimatedTokens / 500);
  signals.push(tokenComplexity);

  // Signal 2: Intent type
  const intent = context.intent || 'conversational';
  const intentComplexity = COMPLEXITY_SIGNALS.intentWeights[intent] || 0.5;
  signals.push(intentComplexity);

  // Signal 3: Context depth
  const historyLength = context.historyLength || 0;
  const contextComplexity = Math.min(0.3, historyLength * COMPLEXITY_SIGNALS.contextDepthWeight);
  signals.push(contextComplexity);

  // Signal 4: Keyword analysis
  const complexKeywords = /\b(architect|design|analyze|compare|implement|refactor|optimize|debug|security|patent|deploy)\b/i;
  const simpleKeywords = /\b(hi|hello|thanks|yes|no|ok|what is|define|list)\b/i;
  const keywordComplexity = complexKeywords.test(query) ? 0.8 : simpleKeywords.test(query) ? 0.15 : 0.4;
  signals.push(keywordComplexity);

  // Signal 5: Requires tool use
  const toolRequired = context.requiresToolUse ? 0.7 : 0;
  signals.push(toolRequired);

  // φ-weighted composite: each successive signal decays by PSI
  let composite = 0;
  let weight = 1;
  let totalWeight = 0;
  for (const signal of signals) {
    composite += signal * weight;
    totalWeight += weight;
    weight *= PSI;
  }

  return composite / totalWeight;
}

/**
 * Select optimal provider based on complexity, budget, and availability.
 */
export function selectProvider(complexity, context = {}) {
  const budgetMode = context.budgetMode || process.env.BUDGET_MODE || 'balanced';
  const requiredCapabilities = context.requiredCapabilities || ['chat'];

  // Filter by capabilities
  let candidates = PROVIDERS.filter(p =>
    requiredCapabilities.every(cap => p.supports.includes(cap)) &&
    process.env[p.keyEnv]
  );

  if (candidates.length === 0) {
    log.warn({ requiredCapabilities }, 'No providers match required capabilities');
    candidates = PROVIDERS.filter(p => process.env[p.keyEnv]);
  }

  // Tier selection based on complexity
  let targetTier;
  if (complexity < PSI * PSI) {          // < 0.382 → economy
    targetTier = 'economy';
  } else if (complexity < PSI) {         // < 0.618 → standard
    targetTier = 'standard';
  } else if (complexity < PSI + 0.1) {   // < 0.718 → premium
    targetTier = 'premium';
  } else {                                // ≥ 0.718 → ultra
    targetTier = 'ultra';
  }

  // Budget mode adjustments
  if (budgetMode === 'economy') {
    if (targetTier === 'ultra') targetTier = 'premium';
    if (targetTier === 'premium') targetTier = 'standard';
  } else if (budgetMode === 'quality') {
    if (targetTier === 'economy') targetTier = 'standard';
  }

  // Score candidates: φ-weighted blend of quality fit, cost efficiency, speed
  const scored = candidates.map(p => {
    const tierMatch = p.tier === targetTier ? 1.0 :
      Math.abs(['economy','standard','premium','ultra'].indexOf(p.tier) -
               ['economy','standard','premium','ultra'].indexOf(targetTier)) === 1 ? 0.6 : 0.2;

    const costEfficiency = 1 / (1 + p.costInput + p.costOutput);
    const qualityFit = p.quality;
    const speedBonus = p.speed === 'ultrafast' ? 0.15 : p.speed === 'fast' ? 0.08 : 0;

    // φ-weighted composite
    const score = tierMatch * PHI + qualityFit * 1.0 + costEfficiency * PSI + speedBonus;

    return { provider: p, score, tierMatch };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected = scored[0].provider;
  const fallback = scored.length > 1 ? scored[1].provider : null;

  log.info({
    complexity: Math.round(complexity * 1000) / 1000,
    targetTier,
    selected: selected.id,
    fallback: fallback?.id,
    estimatedCostPerMTokens: selected.costInput + selected.costOutput,
  }, 'Provider selected');

  return { provider: selected, fallback, complexity, targetTier, allScored: scored.slice(0, 3) };
}

/**
 * Execute an LLM call with smart routing and automatic fallback.
 */
export async function smartRoute(messages, context = {}) {
  const userMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
  const complexity = context.complexity ?? estimateComplexity(userMessage, context);
  const { provider, fallback } = selectProvider(complexity, context);

  const providers = [provider, fallback].filter(Boolean);

  for (const p of providers) {
    try {
      const result = await callProvider(p, messages, context);
      return {
        ...result,
        provider: p.id,
        tier: p.tier,
        complexity,
        costEstimate: estimateCost(p, result.inputTokens, result.outputTokens),
      };
    } catch (err) {
      log.warn({ provider: p.id, error: err.message }, 'Provider failed — falling back');
    }
  }

  throw new Error('All providers exhausted — HE-3001');
}

async function callProvider(provider, messages, context) {
  const key = process.env[provider.keyEnv];
  if (!key) throw new Error(`Missing key: ${provider.keyEnv}`);

  const timeout = context.timeout || parseInt(process.env.DEFAULT_TIMEOUT || '30000', 10);

  // Build request based on provider type
  let url = provider.endpoint;
  let headers = { 'Content-Type': 'application/json' };
  let body;

  if (provider.isAnthropic) {
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    body = {
      model: provider.model,
      max_tokens: context.maxTokens || 4096,
      temperature: context.temperature ?? 0,
      system: messages.find(m => m.role === 'system')?.content || '',
      messages: messages.filter(m => m.role !== 'system'),
    };
  } else if (provider.isGemini) {
    headers['x-goog-api-key'] = key;
    body = {
      contents: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      systemInstruction: messages.find(m => m.role === 'system')
        ? { parts: [{ text: messages.find(m => m.role === 'system').content }] }
        : undefined,
      generationConfig: {
        temperature: context.temperature ?? 0,
        maxOutputTokens: context.maxTokens || 4096,
      },
    };
  } else {
    // OpenAI-compatible (DeepSeek, Groq, GPT)
    headers['Authorization'] = `Bearer ${key}`;
    body = {
      model: provider.model,
      messages,
      max_tokens: context.maxTokens || 4096,
      temperature: context.temperature ?? 0,
    };
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => 'no body');
    throw new Error(`${provider.id} returned ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();

  // Normalize response
  if (provider.isAnthropic) {
    return {
      content: data.content?.[0]?.text || '',
      model: data.model,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };
  } else if (provider.isGemini) {
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      model: provider.model,
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    };
  } else {
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model,
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };
  }
}

function estimateCost(provider, inputTokens, outputTokens) {
  return {
    input: (inputTokens / 1_000_000) * provider.costInput,
    output: (outputTokens / 1_000_000) * provider.costOutput,
    total: (inputTokens / 1_000_000) * provider.costInput + (outputTokens / 1_000_000) * provider.costOutput,
    currency: 'USD',
  };
}

export { PROVIDERS };
export default { smartRoute, selectProvider, estimateComplexity, PROVIDERS };
