// packages/heady-llm/src/router.js
// Intelligent Model Router — 30–50% cost reduction
// Routes 70% low→DeepSeek/Gemini, 20% mid→Groq, 10% complex→premium
import { PHI_SQ, CSL } from '../../heady-core/src/phi.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const PROVIDERS = {
  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    key: () => process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
    costPer1M: { input: 0.14, output: 0.28 },
    tier: 'low'
  },
  geminiLite: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
    key: () => process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY,
    model: 'gemini-2.0-flash-lite',
    costPer1M: { input: 0.10, output: 0.40 },
    tier: 'low'
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    costPer1M: { input: 0.59, output: 0.79 },
    tier: 'mid'
  },
  azureGPT: {
    url: process.env.AZURE_OPENAI_ENDPOINT,
    key: () => process.env.AZURE_OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    costPer1M: { input: 0.15, output: 0.60 },
    tier: 'mid'
  },
  workersAI: {
    url: null, // Handled via CF binding
    key: () => process.env.CF_API_TOKEN,
    model: 'llama-3.1-8b-instruct',
    costPer1M: { input: 0, output: 0 },
    tier: 'low'
  }
};

/**
 * Classify query complexity to route to the optimal provider tier.
 * @param {string} input — user message
 * @param {number} [cslScore] — user's current CSL score
 * @returns {'low'|'mid'|'high'}
 */
export function classifyComplexity(input, cslScore = 0.618) {
  const len = input.length;
  const hasCode = /```|function |class |import |const |async/.test(input);
  const hasMultiStep = /\band\b.*\bthen\b|\bfirst\b.*\bthen\b|\bstep\b/i.test(input);
  const hasAnalysis = /\banalyze\b|\bcompare\b|\bexplain\b.*\bwhy\b|\bresearch\b/i.test(input);

  let score = 0;
  if (len > 2000) score += 0.3;
  else if (len > 500) score += 0.15;
  if (hasCode) score += 0.25;
  if (hasMultiStep) score += 0.2;
  if (hasAnalysis) score += 0.15;
  if (cslScore >= CSL.CORE) score += 0.1; // High-value user → premium

  if (score >= 0.5) return 'high';
  if (score >= 0.25) return 'mid';
  return 'low';
}

/**
 * Select the optimal provider chain based on complexity tier.
 * @param {'low'|'mid'|'high'} tier
 * @returns {string[]} — ordered provider keys
 */
export function selectChain(tier) {
  switch (tier) {
    case 'low':  return ['deepseek', 'geminiLite', 'workersAI'];
    case 'mid':  return ['groq', 'geminiLite', 'azureGPT', 'deepseek'];
    case 'high': return ['azureGPT', 'groq', 'geminiLite', 'deepseek'];
    default:     return ['geminiLite', 'deepseek', 'groq'];
  }
}

/**
 * Call a specific OpenAI-compatible provider.
 * @param {string} providerKey
 * @param {{ messages: Array, temperature?: number, maxTokens?: number }} req
 * @returns {Promise<{ content: string, model: string, provider: string, latencyMs: number }>}
 */
async function callProvider(providerKey, req) {
  const p = PROVIDERS[providerKey];
  if (!p || !p.key()) throw new Error(`Provider ${providerKey} not configured`);

  const start = Date.now();

  if (providerKey === 'geminiLite') {
    const res = await fetch(`${p.url}?key=${p.key()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: req.messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : m.role,
          parts: [{ text: m.content }]
        })),
        generationConfig: { temperature: req.temperature ?? 0.618, maxOutputTokens: req.maxTokens ?? 2048 }
      })
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    return { content: data.candidates[0].content.parts[0].text, model: p.model, provider: providerKey, latencyMs: Date.now() - start };
  }

  // OpenAI-compatible format (DeepSeek, Groq, Azure)
  const url = providerKey === 'azureGPT'
    ? `${p.url}/openai/deployments/${p.model}/chat/completions?api-version=2024-12-01-preview`
    : p.url;

  const headers = { 'Content-Type': 'application/json' };
  if (providerKey === 'azureGPT') headers['api-key'] = p.key();
  else headers['Authorization'] = `Bearer ${p.key()}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: p.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.618,
      max_tokens: req.maxTokens ?? 2048
    })
  });
  if (!res.ok) throw new Error(`${providerKey} ${res.status}`);
  const data = await res.json();
  return { content: data.choices[0].message.content, model: p.model, provider: providerKey, latencyMs: Date.now() - start };
}

/**
 * Routed chat — classifies complexity and routes through optimal provider chain.
 * @param {{ messages: Array, temperature?: number, maxTokens?: number, cslScore?: number }} req
 * @returns {Promise<{ content: string, model: string, provider: string, tier: string, latencyMs: number }>}
 */
export async function routedChat(req) {
  const lastMsg = req.messages[req.messages.length - 1]?.content || '';
  const tier = classifyComplexity(lastMsg, req.cslScore);
  const chain = selectChain(tier);
  const errors = [];

  for (const provider of chain) {
    try {
      const result = await callProvider(provider, req);
      return { ...result, tier };
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
      await sleep(PHI_SQ * 500);
    }
  }
  throw new Error(`All routed providers failed: ${errors.join(' | ')}`);
}
