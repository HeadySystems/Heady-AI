// packages/heady-llm/src/gateway.js
// §4 — LLM Fallback Chain via Cloudflare AI Gateway
// Route: https://gateway.ai.cloudflare.com/v1/{account}/heady-gateway/{provider}/*

import { PHI_SQ } from '../../heady-core/src/phi.js';
const CF = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
const GW = process.env.HEADY_CLOUDFLARE_AI_GATEWAY || 'heady-gateway';
export const AI_GATEWAY = {
  gemini: `https://gateway.ai.cloudflare.com/v1/${CF}/${GW}/google-ai-studio`,
  openai: `https://gateway.ai.cloudflare.com/v1/${CF}/${GW}/azure-openai`,
  workers: `https://gateway.ai.cloudflare.com/v1/${CF}/${GW}/workers-ai`,
  colab: process.env.COLAB_RUNTIME_GAMMA || 'https://infer.headysystems.com/v1'
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Individual Provider Calls ──────────────────────────────────────────────

async function callGemini(req) {
  const start = Date.now();
  const res = await fetch(`${AI_GATEWAY.gemini}/v1beta/models/gemini-2.0-flash-lite:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY,
      'cf-aig-cache-ttl': '3600'
    },
    body: JSON.stringify({
      contents: req.messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{
          text: m.content
        }]
      })),
      generationConfig: {
        temperature: req.temperature ?? 0.618,
        maxOutputTokens: req.maxTokens ?? 2048
      }
    })
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.candidates[0].content.parts[0].text,
    model: 'gemini-2.0-flash-lite',
    provider: 'gemini',
    cached: res.headers.get('cf-aig-cache-status') === 'HIT',
    latencyMs: Date.now() - start
  };
}
async function callAzureOpenAI(req) {
  const start = Date.now();
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const version = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
  if (!endpoint || !apiKey) throw new Error('Azure OpenAI not configured');
  const res = await fetch(`${AI_GATEWAY.openai}/openai/deployments/gpt-4o-mini/chat/completions?api-version=${version}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      'cf-aig-cache-ttl': '3600'
    },
    body: JSON.stringify({
      messages: req.messages,
      temperature: req.temperature ?? 0.618,
      max_tokens: req.maxTokens ?? 2048
    })
  });
  if (!res.ok) throw new Error(`Azure OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    model: 'gpt-4o-mini',
    provider: 'azure',
    cached: res.headers.get('cf-aig-cache-status') === 'HIT',
    latencyMs: Date.now() - start
  };
}
async function callWorkersAI(req) {
  const start = Date.now();
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  if (!token) throw new Error('Workers AI not configured');
  const res = await fetch(`${AI_GATEWAY.workers}/@cf/meta/llama-3.1-8b-instruct`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: req.messages
    })
  });
  if (!res.ok) throw new Error(`Workers AI ${res.status}`);
  const data = await res.json();
  return {
    content: data.result.response,
    model: 'llama-3.1-8b-instruct',
    provider: 'workers-ai',
    cached: false,
    latencyMs: Date.now() - start
  };
}
async function callColabVLLM(req) {
  const start = Date.now();
  const res = await fetch(`${AI_GATEWAY.colab}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'mistralai/Mistral-7B-Instruct-v0.3',
      messages: req.messages,
      temperature: req.temperature ?? 0.618
    })
  });
  if (!res.ok) throw new Error(`Colab vLLM ${res.status}`);
  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    model: 'mistral-7b-instruct',
    provider: 'colab-vllm',
    cached: false,
    latencyMs: Date.now() - start
  };
}

// ── Fallback Chain: Gemini → Azure → Workers AI → Colab vLLM ──────────────

export async function chat(req) {
  const errors = [];
  const chain = [callGemini, callAzureOpenAI, callWorkersAI, callColabVLLM];
  for (const fn of chain) {
    try {
      return await fn(req);
    } catch (err) {
      errors.push(err);
      await sleep(PHI_SQ * 1000); // φ² backoff before next provider
    }
  }
  throw new Error(`All LLM providers failed: ${errors.map(e => e.message).join(' | ')}`);
}