// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: packages/heady-auto-context/src/embedding-client.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ═══════════════════════════════════════════════════════════
 * HEADY™ EMBEDDING CLIENT
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * HuggingFace Inference API with 3-token round-robin,
 * LRU cache (fib(16)=987 entries), and phi-backoff retry
 * ═══════════════════════════════════════════════════════════
 */

import { createLogger } from '../shared/structured-logger.js';
import { EmbeddingError } from '../shared/errors.js';
import { phiBackoff, fib } from '../shared/phi-math.js';
import config from './config.js';

const logger = createLogger('embedding-client');

// ── LRU Cache ─────────────────────────────────────────────
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    if (!this.cache.has(key)) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    const value = this.cache.get(key);
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict oldest (first key)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  get size() {
    return this.cache.size;
  }

  get stats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

// ── Round-Robin Token Selector ────────────────────────────
class TokenRoundRobin {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  next() {
    const token = this.tokens[this.index];
    this.index = (this.index + 1) % this.tokens.length;
    return token;
  }
}

// ── Singleton State ───────────────────────────────────────
const embeddingCache = new LRUCache(config.cacheSize);
const tokenSelector = new TokenRoundRobin(config.hfTokens);

const HF_API_BASE = 'https://api-inference.huggingface.co/pipeline/feature-extraction';
const MAX_RETRIES = fib(5); // 5

/**
 * Call HuggingFace Inference API for a single text.
 * Retries with phi-backoff on 429/503.
 */
async function callHfApi(text, attempt = 0) {
  const token = tokenSelector.next();
  const url = `${HF_API_BASE}/${config.embeddingModel}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true },
      }),
    });

    if (res.status === 429 || res.status === 503) {
      if (attempt < MAX_RETRIES) {
        const delay = phiBackoff(attempt);
        logger.warn({ status: res.status, attempt, delayMs: delay }, 'HF API rate limited, retrying');
        await new Promise(r => setTimeout(r, delay));
        return callHfApi(text, attempt + 1);
      }
      throw new EmbeddingError(`HF API exhausted after ${MAX_RETRIES} retries`, {
        status: res.status,
        attempts: attempt + 1,
      });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new EmbeddingError(`HF API error: ${res.status}`, {
        status: res.status,
        body: body.slice(0, 500),
      });
    }

    const data = await res.json();

    // HuggingFace returns [[...384 floats...]] for single input
    const embedding = Array.isArray(data[0]) ? data[0] : data;

    if (!Array.isArray(embedding) || embedding.length !== config.vectorDim) {
      throw new EmbeddingError(`Unexpected embedding shape: expected ${config.vectorDim}, got ${embedding?.length}`, {
        shape: embedding?.length,
      });
    }

    return embedding;
  } catch (err) {
    if (err instanceof EmbeddingError) throw err;
    if (attempt < MAX_RETRIES) {
      const delay = phiBackoff(attempt);
      logger.warn({ error: err.message, attempt, delayMs: delay }, 'HF API network error, retrying');
      await new Promise(r => setTimeout(r, delay));
      return callHfApi(text, attempt + 1);
    }
    throw new EmbeddingError(`HF API failed: ${err.message}`, { attempts: attempt + 1 });
  }
}

/**
 * Generate embedding for text — uses LRU cache.
 * @param {string} text
 * @returns {Promise<number[]>} 384-dim embedding
 */
export async function embed(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new EmbeddingError('Cannot embed empty text');
  }

  const trimmed = text.trim().slice(0, 8192); // Hard cap at 8K chars
  const cacheKey = trimmed;

  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    logger.debug({ cacheHit: true }, 'Embedding cache hit');
    return cached;
  }

  const embedding = await callHfApi(trimmed);
  embeddingCache.set(cacheKey, embedding);
  return embedding;
}

/**
 * Batch embed — processes in chunks of fib(7)=13.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts) {
  const results = [];
  for (let i = 0; i < texts.length; i += config.batchSize) {
    const chunk = texts.slice(i, i + config.batchSize);
    const chunkResults = await Promise.all(chunk.map(t => embed(t)));
    results.push(...chunkResults);
  }
  return results;
}

/**
 * Clear the embedding cache.
 */
export function clearCache() {
  embeddingCache.clear();
  logger.info('Embedding cache cleared');
}

/**
 * Get cache statistics.
 */
export function getCacheStats() {
  return embeddingCache.stats;
}
