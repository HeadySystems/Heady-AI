# Heady™ Edge Workers + API Gateway + Inference Routing

## Foundation
All changes are based on the HeadyMe repos and Heady project data. The actual source code for every referenced file is provided below.

## Objective
Optimize edge computing for ultra-low latency AI inference. Wire CSL confidence gates into every edge routing decision. Phi-scaled load balancing across inference providers with deterministic fallback.

## Specific Deliverables — Build ALL Files

### 1. Edge Workers — CSL-gated routing, phi-scaled cache TTL, deterministic inference (temp=0, seed=42)
### 2. API Gateway v2 — unified gateway, phi-scaled rate limiting, CSL-prioritized request queue, circuit breakers
### 3. Inference Routing — multi-provider (Claude, GPT-4, Gemini, Sonar), CSL health scoring, latency tracking, model racing
### 4. Edge Embedding Cache — zero round-trip similarity search, CSL-gated invalidation, phi-scaled warming
### 5. Test Suite — routing, caching, rate limiting, provider selection, circuit breakers, model racing

## Constraints
- All constants from φ = 1.6180339887, Cloudflare Workers compatible, sub-100ms target, temp=0 seed=42

---

## SOURCE FILES — COMPLETE HEADY CODEBASE CONTEXT


### `src/edge/edge-worker.js`

```javascript
/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Cloudflare Edge Worker — AI inference without origin round-trips.
 * Designed to run inside the Cloudflare Workers runtime.
 * Also exports Node-compatible wrappers for local testing.
 */

'use strict';

// ─── Runtime detection ───────────────────────────────────────────────────────

const IS_CLOUDFLARE = typeof globalThis.caches !== 'undefined' && typeof process === 'undefined';
const IS_NODE = !IS_CLOUDFLARE;

// In Node, fall back to lightweight logger shim
const logger = IS_NODE
  ? require('../../utils/logger')
  : { info: () => {}, debug: () => {}, error: () => {}, warn: () => {} };

// ─── Constants ────────────────────────────────────────────────────────────────

const CF_AI_BASE    = 'https://api.cloudflare.com/client/v4/accounts';
const EMBED_MODEL   = '@cf/baai/bge-small-en-v1.5';
const CLASSIFY_MODEL = '@cf/huggingface/distilbert-sst-2-int8';

const ROUTE_TABLE = [
  { pattern: /^\/api\/embed/,    target: 'embedding' },
  { pattern: /^\/api\/classify/, target: 'classification' },
  { pattern: /^\/api\/chat/,     target: 'llm' },
  { pattern: /^\/api\/image/,    target: 'image-gen' },
  { pattern: /^\/health/,        target: 'health' },
];

// ─── Edge Functions ───────────────────────────────────────────────────────────

/**
 * Compute embeddings at the edge using Cloudflare Workers AI.
 * Zero round-trip to origin for supported embedding models.
 *
 * @param {string} text - Input text to embed
 * @param {object} [opts]
 * @param {string} [opts.model]       - Override model
 * @param {object} [opts.env]         - Cloudflare env bindings (contains AI)
 * @returns {Promise<number[]>}       - Embedding vector
 */
async function embedAtEdge(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    throw new TypeError('embedAtEdge: text must be a non-empty string');
  }

  const model = opts.model || EMBED_MODEL;

  // Cloudflare Workers AI path
  if (IS_CLOUDFLARE && opts.env && opts.env.AI) {
    const result = await opts.env.AI.run(model, { text });
    return result.data[0];
  }

  // Node / REST fallback using account credentials
  if (IS_NODE) {
    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken  = process.env.CF_API_TOKEN;

    if (!accountId || !apiToken) {
      logger.warn('[EdgeWorker] CF credentials not set — returning mock embedding');
      return _mockEmbedding(text, 384);
    }

    const res = await _cfFetch(`${CF_AI_BASE}/${accountId}/ai/run/${model}`, apiToken, { text });
    return res.result.data[0];
  }

  throw new Error('embedAtEdge: unable to determine runtime environment');
}

/**
 * Classify text at the edge (sentiment / intent).
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {string}   [opts.model]   - Override model
 * @param {object}   [opts.env]     - Cloudflare env bindings
 * @param {string[]} [opts.labels]  - Custom label set (if supported by model)
 * @returns {Promise<{ label: string, score: number }[]>}
 */
async function classifyAtEdge(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    throw new TypeError('classifyAtEdge: text must be a non-empty string');
  }

  const model = opts.model || CLASSIFY_MODEL;

  if (IS_CLOUDFLARE && opts.env && opts.env.AI) {
    const result = await opts.env.AI.run(model, { text });
    return _normalizeClassification(result);
  }

  if (IS_NODE) {
    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken  = process.env.CF_API_TOKEN;

    if (!accountId || !apiToken) {
      logger.warn('[EdgeWorker] CF credentials not set — returning mock classification');
      return [{ label: 'NEUTRAL', score: 0.5 }];
    }

    const res = await _cfFetch(`${CF_AI_BASE}/${accountId}/ai/run/${model}`, apiToken, { text });
    return _normalizeClassification(res.result);
  }

  throw new Error('classifyAtEdge: unable to determine runtime environment');
}

/**
 * Route an incoming edge request to the appropriate handler.
 * Designed to be called from the Cloudflare Worker fetch handler.
 *
 * @param {Request} request - Fetch API Request object
 * @param {object}  [env]   - Cloudflare env bindings
 * @param {object}  [ctx]   - Cloudflare execution context
 * @returns {Promise<Response>}
 */
async function routeAtEdge(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return _corsResponse(new Response(null, { status: 204 }));
  }

  // Route matching
  const route = ROUTE_TABLE.find(r => r.pattern.test(pathname));

  try {
    switch (route && route.target) {
      case 'health':
        return _corsResponse(Response.json({ status: 'ok', edge: true, ts: Date.now() }));

      case 'embedding': {
        const body = await _parseBody(request);
        if (!body.text) return _errResponse(400, 'text field required');
        const vector = await embedAtEdge(body.text, { model: body.model, env });
        return _corsResponse(Response.json({ vector, model: body.model || EMBED_MODEL }));
      }

      case 'classification': {
        const body = await _parseBody(request);
        if (!body.text) return _errResponse(400, 'text field required');
        const labels = await classifyAtEdge(body.text, { model: body.model, env });
        return _corsResponse(Response.json({ labels, model: body.model || CLASSIFY_MODEL }));
      }

      case 'llm': {
        // Forward to origin for full LLM inference (too large for edge-only)
        return _proxyToOrigin(request, env);
      }

      case 'image-gen': {
        return _proxyToOrigin(request, env);
      }

      default:
        return _corsResponse(Response.json({ error: 'Not found' }, { status: 404 }));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return _errResponse(500, message);
  }
}

// ─── Edge-side caching helpers ────────────────────────────────────────────────

/**
 * Try to serve an embedding from the edge cache before computing.
 * @param {string} text
 * @param {object} opts
 */
async function embedWithCache(text, opts = {}) {
  if (!IS_CLOUDFLARE || !globalThis.caches) {
    return embedAtEdge(text, opts);
  }

  const cacheKey = new Request(`https://embed-cache.heady.internal/${_hashText(text)}`);
  const cache = await caches.open('heady-edge-embed');
  const cached = await cache.match(cacheKey);

  if (cached) {
    const data = await cached.json();
    return data.vector;
  }

  const vector = await embedAtEdge(text, opts);

  // Cache for 1 hour
  const response = new Response(JSON.stringify({ vector }), {
    headers: { 'Cache-Control': 'max-age=3600', 'Content-Type': 'application/json' },
  });
  await cache.put(cacheKey, response);
  return vector;
}

// ─── Cloudflare Worker entry point ───────────────────────────────────────────

/**
 * Standard Cloudflare Worker export.
 * Usage in wrangler.toml: main = "src/edge/edge-worker.js"
 */
const cfWorkerExport = {
  async fetch(request, env, ctx) {
    return routeAtEdge(request, env, ctx);
  },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _cfFetch(url, token, body) {
  const headyFetch = require('../../core/heady-fetch');
  const res = await headyFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CF AI API error ${res.status}: ${text}`);
  }

  return res.json();
}

function _normalizeClassification(result) {
  if (Array.isArray(result)) return result;
  if (result && result.label) return [{ label: result.label, score: result.score ?? 1 }];
  return [];
}

function _corsResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(response.body, { status: response.status, headers });
}

function _errResponse(status, message) {
  const body = JSON.stringify({ error: message });
  const headers = { 'Content-Type': 'application/json' };
  return _corsResponse(new Response(body, { status, headers }));
}

async function _parseBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function _proxyToOrigin(request, env) {
  const originUrl = (env && env.ORIGIN_URL) || 'https://api.headyconnection.org';
  const url = new URL(request.url);
  const target = `${originUrl}${url.pathname}${url.search}`;
  return fetch(target, { method: request.method, headers: request.headers, body: request.body });
}

function _mockEmbedding(text, dims = 384) {
  // Deterministic mock: hash text into floats
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  const seed = Math.abs(h);
  const vec = Array.from({ length: dims }, (_, i) => {
    const v = Math.sin(seed * (i + 1) * 0.01);
    return parseFloat(v.toFixed(6));
  });
  // L2-normalize
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map(x => x / norm);
}

function _hashText(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  embedAtEdge,
  classifyAtEdge,
  routeAtEdge,
  embedWithCache,
  cfWorkerExport,
  EMBED_MODEL,
  CLASSIFY_MODEL,
  ROUTE_TABLE,
};

// Cloudflare Workers default export
if (IS_CLOUDFLARE) {
  // eslint-disable-next-line no-undef
  Object.assign(globalThis, cfWorkerExport);
}
```
---

### `src/edge/edge-embedding-cache.js`

```javascript
/**
 * edge-embedding-cache.js
 * Heady Latent OS — Edge Embedding Cache
 *
 * LRU cache with TTL for embedding vectors at the Cloudflare edge.
 * Reduces Workers AI inference cost by 60–80% for repeated queries.
 *
 * Two-tier caching:
 *   L1 — In-memory LRU (fast, bounded by MAX_MEMORY_ITEMS)
 *   L2 — Workers KV (persistent, globally replicated, TTL-based)
 *
 * Cache key: SHA-256 of (model + normalized text) → deterministic hex string
 * Memory bound: configurable MAX_MEMORY_ITEMS (default: 1,000 — Fibonacci-based)
 * TTL: configurable per model tier (embed-fast: 1h, embed-standard: 3h)
 *
 * Sacred Geometry: LRU eviction uses Fibonacci-based batch eviction (evict 8
 * entries at a time, not 1 at a time — reduces churn).
 *
 * Hit rate metrics tracked in-memory and optionally persisted to KV.
 *
 * @module edge-embedding-cache
 */

import { PHI, PSI, fib, phiBackoff } from '../../shared/phi-math.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Default in-memory LRU max size — fib(16) = 987 (Fibonacci-exact, was 1000) */
const DEFAULT_MAX_MEMORY_ITEMS = fib(16); // 987 (phi-continuous Fibonacci)

/** Fibonacci eviction batch size — fib(6) = 8, made explicit via fib() */
const EVICTION_BATCH_SIZE = fib(6); // fib(6) = 8 (already Fibonacci — made explicit)

/**
 * Default KV TTL per model (seconds).
 * phi-scaled: PHI^n × 60s base
 *   bge-small:  round(60 × PHI^7) ≈ 1742s
 *   bge-base:   round(60 × PHI^8) ≈ 2818s
 *   bge-large:  round(60 × PHI^9) ≈ 4559s
 *   default:    round(60 × PHI^7) ≈ 1742s (phi-harmonic noise-floor tier)
 */
const DEFAULT_KV_TTL = {
  'bge-small': Math.round(60 * Math.pow(PHI, 7)),   // ≈ 1742s — phi^7 × 60s
  'bge-base':  Math.round(60 * Math.pow(PHI, 8)),   // ≈ 2818s — phi^8 × 60s
  'bge-large': Math.round(60 * Math.pow(PHI, 9)),   // ≈ 4559s — phi^9 × 60s
  'default':   Math.round(60 * Math.pow(PHI, 7)),   // ≈ 1742s — phi^7 × 60s (noise-floor tier)
};

/** KV cache key prefix */
const KV_PREFIX = 'emb:';

/**
 * Metrics flush interval to KV (ms).
 * phi-scaled: round(60_000 × PHI^4) ≈ 411_000ms ≈ 6.8min.
 */
const METRICS_FLUSH_INTERVAL_MS = Math.round(60_000 * Math.pow(PHI, 4)); // ≈ 411_000ms (phi^4 × 60s)

/** Cache warming batch size — fib(7) = 13, made explicit via fib() */
const WARM_BATCH_SIZE = fib(7); // fib(7) = 13 (already Fibonacci — made explicit)

// ─────────────────────────────────────────────────────────────────────────────
// LRU Node for doubly-linked list
// ─────────────────────────────────────────────────────────────────────────────

class LRUNode {
  /**
   * @param {string} key
   * @param {CacheEntry} value
   */
  constructor(key, value) {
    this.key = key;
    this.value = value;
    /** @type {LRUNode|null} */
    this.prev = null;
    /** @type {LRUNode|null} */
    this.next = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LRU cache data structure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CacheEntry
 * @property {number[]} embedding - Float32 embedding vector
 * @property {string} model - Model that generated this embedding
 * @property {number} dimensions - Vector dimensionality
 * @property {number} expiresAt - Unix timestamp (ms)
 * @property {number} accessCount - Hit count for this entry
 * @property {number} createdAt - Unix timestamp (ms)
 */

class LRUCache {
  /**
   * @param {number} maxSize
   */
  constructor(maxSize) {
    this.maxSize = maxSize;
    /** @type {Map<string, LRUNode>} */
    this._map = new Map();
    /** @type {LRUNode} Sentinel head (MRU end) */
    this._head = new LRUNode('__HEAD__', null);
    /** @type {LRUNode} Sentinel tail (LRU end) */
    this._tail = new LRUNode('__TAIL__', null);
    this._head.next = this._tail;
    this._tail.prev = this._head;
    this._size = 0;
  }

  get size() { return this._size; }

  /**
   * Get an entry and move it to the MRU position.
   * @param {string} key
   * @returns {CacheEntry|undefined}
   */
  get(key) {
    const node = this._map.get(key);
    if (!node) return undefined;

    // Check TTL expiry
    if (node.value.expiresAt < Date.now()) {
      this._remove(node);
      return undefined;
    }

    // Move to head (MRU)
    this._remove(node);
    this._insertHead(node);
    node.value.accessCount++;
    return node.value;
  }

  /**
   * Insert or update an entry.
   * @param {string} key
   * @param {CacheEntry} value
   */
  set(key, value) {
    const existing = this._map.get(key);
    if (existing) {
      existing.value = value;
      this._remove(existing);
      this._insertHead(existing);
      return;
    }

    const node = new LRUNode(key, value);
    this._map.set(key, node);
    this._insertHead(node);
    this._size++;

    // Evict LRU entries in Fibonacci batch when over capacity
    while (this._size > this.maxSize) {
      this._evictBatch(EVICTION_BATCH_SIZE);
    }
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    const node = this._map.get(key);
    if (!node) return false;
    this._remove(node);
    return true;
  }

  /** Clear all entries. */
  clear() {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
    this._size = 0;
  }

  /**
   * Evict the N least-recently-used entries.
   * @param {number} n
   */
  _evictBatch(n) {
    for (let i = 0; i < n && this._size > 0; i++) {
      const lru = this._tail.prev;
      if (lru === this._head) break;
      this._remove(lru);
    }
  }

  /** @param {LRUNode} node */
  _remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    node.prev = null;
    node.next = null;
    this._map.delete(node.key);
    this._size--;
  }

  /** @param {LRUNode} node */
  _insertHead(node) {
    node.next = this._head.next;
    node.prev = this._head;
    this._head.next.prev = node;
    this._head.next = node;
    this._map.set(node.key, node);
    this._size++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EdgeEmbeddingCache class
// ─────────────────────────────────────────────────────────────────────────────

export class EdgeEmbeddingCache {
  /**
   * @param {object} config
   * @param {KVNamespace} [config.kv] - Workers KV for L2 persistence
   * @param {number} [config.maxMemoryItems] - L1 LRU max items
   * @param {object} [config.kvTtl] - Per-model KV TTL overrides
   * @param {boolean} [config.enableMetrics] - Track hit/miss stats
   * @param {boolean} [config.enableKv] - Enable L2 KV cache (default: true if kv provided)
   */
  constructor({
    kv = null,
    maxMemoryItems = DEFAULT_MAX_MEMORY_ITEMS,
    kvTtl = {},
    enableMetrics = true,
    enableKv = true,
  } = {}) {
    this.kv = kv;
    this.enableKv = enableKv && !!kv;
    this.kvTtl = { ...DEFAULT_KV_TTL, ...kvTtl };
    this.enableMetrics = enableMetrics;

    /** @type {LRUCache} L1 in-memory cache */
    this._l1 = new LRUCache(maxMemoryItems);

    /** Metrics counters */
    this._metrics = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0,
      errors: 0,
    };

    this._lastMetricsFlush = 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Look up a single embedding by text + model.
   * Checks L1 (memory) then L2 (KV).
   *
   * @param {string} text - Input text
   * @param {string} model - Model identifier
   * @returns {Promise<number[]|null>} Embedding vector or null on miss
   */
  async get(text, model) {
    const key = await this._makeKey(text, model);

    // L1 check
    const l1Entry = this._l1.get(key);
    if (l1Entry) {
      if (this.enableMetrics) this._metrics.l1Hits++;
      return l1Entry.embedding;
    }

    // L2 check (KV)
    if (this.enableKv && this.kv) {
      try {
        const l2Entry = await this.kv.get(`${KV_PREFIX}${key}`, { type: 'json' });
        if (l2Entry && l2Entry.expiresAt > Date.now()) {
          if (this.enableMetrics) this._metrics.l2Hits++;
          // Promote to L1
          this._l1.set(key, l2Entry);
          return l2Entry.embedding;
        }
      } catch (err) {
        if (this.enableMetrics) this._metrics.errors++;
        console.warn('[EdgeEmbeddingCache] KV get error:', err.message);
      }
    }

    if (this.enableMetrics) this._metrics.misses++;
    return null;
  }

  /**
   * Store an embedding vector for text + model.
   * Writes to both L1 and L2 (KV) if enabled.
   *
   * @param {string} text
   * @param {string} model
   * @param {number[]} embedding
   * @param {object} [options]
   * @param {number} [options.ttlSeconds] - Override TTL
   * @param {number} [options.dimensions] - Vector dimensionality
   * @returns {Promise<void>}
   */
  async set(text, model, embedding, { ttlSeconds, dimensions } = {}) {
    const key = await this._makeKey(text, model);
    const ttl = ttlSeconds ?? this._getTtl(model);
    const entry = {
      embedding,
      model,
      dimensions: dimensions ?? embedding.length,
      expiresAt: Date.now() + ttl * 1000,
      accessCount: 0,
      createdAt: Date.now(),
    };

    // Write to L1
    this._l1.set(key, entry);

    // Write to L2 (fire and forget — don't block response)
    if (this.enableKv && this.kv) {
      this.kv.put(`${KV_PREFIX}${key}`, JSON.stringify(entry), { expirationTtl: ttl }).catch((err) => {
        if (this.enableMetrics) this._metrics.errors++;
        console.warn('[EdgeEmbeddingCache] KV put error:', err.message);
      });
    }

    if (this.enableMetrics) this._metrics.writes++;
  }

  /**
   * Batch cache lookup for multiple texts.
   * Returns a map of text → embedding (null for misses).
   *
   * @param {string[]} texts
   * @param {string} model
   * @returns {Promise<Map<string, number[]|null>>}
   */
  async getBatch(texts, model) {
    const results = new Map();

    await Promise.all(
      texts.map(async (text) => {
        const embedding = await this.get(text, model);
        results.set(text, embedding);
      }),
    );

    return results;
  }

  /**
   * Batch write multiple embeddings.
   *
   * @param {Array<{text: string, embedding: number[]}>} items
   * @param {string} model
   * @param {object} [options]
   * @returns {Promise<void>}
   */
  async setBatch(items, model, options = {}) {
    await Promise.all(
      items.map(({ text, embedding }) => this.set(text, model, embedding, options)),
    );
  }

  /**
   * Warm the cache with common queries.
   * Fetches embeddings from Workers AI for the provided texts and caches them.
   *
   * @param {string[]} texts - Common queries to pre-embed
   * @param {string} model - Embedding model to use
   * @param {AI} ai - Workers AI binding
   * @returns {Promise<{warmed: number, errors: number}>}
   */
  async warm(texts, model, ai) {
    if (!ai) throw new Error('Workers AI binding required for cache warming');

    let warmed = 0;
    let errors = 0;

    // Process in Fibonacci batches
    for (let i = 0; i < texts.length; i += WARM_BATCH_SIZE) {
      const batch = texts.slice(i, i + WARM_BATCH_SIZE);

      // Check which are already cached
      const uncached = [];
      for (const text of batch) {
        const cached = await this.get(text, model);
        if (!cached) uncached.push(text);
      }

      if (uncached.length === 0) continue;

      try {
        const result = await ai.run(model, { text: uncached });
        const embeddings = result.data ?? result ?? [];

        for (let j = 0; j < uncached.length; j++) {
          if (embeddings[j]) {
            await this.set(uncached[j], model, embeddings[j]);
            warmed++;
          }
        }
      } catch (err) {
        errors += uncached.length;
        console.error('[EdgeEmbeddingCache] warming batch error:', err);
      }
    }

    return { warmed, errors };
  }

  /**
   * Invalidate a specific embedding from all cache layers.
   * @param {string} text
   * @param {string} model
   * @returns {Promise<void>}
   */
  async invalidate(text, model) {
    const key = await this._makeKey(text, model);
    this._l1.delete(key);
    if (this.enableKv && this.kv) {
      await this.kv.delete(`${KV_PREFIX}${key}`).catch(() => {});
    }
  }

  /**
   * Clear the L1 in-memory cache entirely.
   */
  clearMemory() {
    this._l1.clear();
  }

  /**
   * Get cache hit rate metrics.
   * @param {ExecutionContext} [ctx] - If provided, flushes metrics to KV in background
   * @returns {object}
   */
  getMetrics(ctx) {
    const { l1Hits, l2Hits, misses, writes, errors } = this._metrics;
    const totalLookups = l1Hits + l2Hits + misses;
    const hitRate = totalLookups > 0 ? (l1Hits + l2Hits) / totalLookups : 0;
    const l1Rate = totalLookups > 0 ? l1Hits / totalLookups : 0;

    const metrics = {
      hits: { l1: l1Hits, l2: l2Hits, total: l1Hits + l2Hits },
      misses,
      writes,
      errors,
      hitRate: Math.round(hitRate * 10000) / 100, // percent with 2 decimals
      l1HitRate: Math.round(l1Rate * 10000) / 100,
      totalLookups,
      l1Size: this._l1.size,
      l1MaxSize: this._l1.maxSize,
      l1Utilization: Math.round((this._l1.size / this._l1.maxSize) * 100),
    };

    // Async flush to KV if context provided and interval elapsed
    if (ctx && this.enableKv && this.kv && (Date.now() - this._lastMetricsFlush > METRICS_FLUSH_INTERVAL_MS)) {
      this._lastMetricsFlush = Date.now();
      ctx.waitUntil(
        this.kv.put('emb:metrics', JSON.stringify({ ...metrics, updatedAt: Date.now() }), { expirationTtl: 86400 })
          .catch(() => {}),
      );
    }

    return metrics;
  }

  /**
   * Get the number of items currently in the L1 cache.
   * @returns {number}
   */
  get size() {
    return this._l1.size;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate a deterministic cache key from text + model.
   * Uses SHA-256 over normalized (lowercased, trimmed) text.
   *
   * @param {string} text
   * @param {string} model
   * @returns {Promise<string>}
   */
  async _makeKey(text, model) {
    // Normalize: lowercase, collapse whitespace
    const normalized = `${model}::${text.toLowerCase().trim().replace(/\s+/g, ' ')}`;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Determine KV TTL for a model string.
   * @param {string} model
   * @returns {number} seconds
   */
  _getTtl(model) {
    if (model.includes('small')) return this.kvTtl['bge-small'] ?? this.kvTtl.default;
    if (model.includes('large')) return this.kvTtl['bge-large'] ?? this.kvTtl.default;
    if (model.includes('base')) return this.kvTtl['bge-base'] ?? this.kvTtl.default;
    return this.kvTtl.default ?? DEFAULT_KV_TTL.default;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware factory — wrap Workers AI embed calls with cache
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a cached embedding function that wraps Workers AI.
 * Drop-in replacement for `env.AI.run(model, { text: [...] })`.
 *
 * @param {AI} ai - Workers AI binding
 * @param {EdgeEmbeddingCache} cache - Cache instance
 * @param {string} [defaultModel] - Default embedding model
 * @returns {Function}
 *
 * @example
 * const cachedEmbed = createCachedEmbedder(env.AI, embeddingCache);
 * const result = await cachedEmbed(['hello', 'world']);
 */
export function createCachedEmbedder(ai, cache, defaultModel = '@cf/baai/bge-base-en-v1.5') {
  return async function cachedEmbed(texts, model = defaultModel) {
    const textArray = Array.isArray(texts) ? texts : [texts];

    const results = new Array(textArray.length).fill(null);
    const uncachedIndices = [];

    // L1/L2 lookup
    for (let i = 0; i < textArray.length; i++) {
      const cached = await cache.get(textArray[i], model);
      if (cached) {
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
      }
    }

    if (uncachedIndices.length === 0) {
      return { data: results, source: 'cache', model };
    }

    // Fetch uncached from Workers AI
    const uncachedTexts = uncachedIndices.map((i) => textArray[i]);
    const aiResult = await ai.run(model, { text: uncachedTexts });
    const embeddings = aiResult.data ?? aiResult ?? [];

    // Fill results and write to cache
    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j];
      results[idx] = embeddings[j] ?? null;
      if (embeddings[j]) {
        // Fire and forget cache write
        cache.set(textArray[idx], model, embeddings[j]).catch(console.error);
      }
    }

    return { data: results, source: 'mixed', model, cacheHits: textArray.length - uncachedIndices.length };
  };
}
```
---

### `src/edge/edge-origin-router.js`

```javascript
/**
 * edge-origin-router.js
 * Heady Latent OS — Edge ↔ Origin Smart Router
 *
 * Routes AI inference requests between Cloudflare edge (Workers AI) and
 * origin (Cloud Run) based on complexity scoring, latency measurements,
 * cost optimization, and geographic rules.
 *
 * Design principles:
 *   - Prefer edge when quality is equivalent (lower latency + cost)
 *   - Fibonacci complexity thresholds align with Sacred Geometry resource allocation
 *   - Automatic fallback: edge failure → origin (transparent to caller)
 *   - Request tagging for downstream analytics (cost attribution, route tracing)
 *   - Smart Placement integration hints for Workers deployed near origin
 *
 * Routing tiers:
 *   Tier 1 — EDGE_ONLY:    Simple queries, short context, classification, embedding
 *   Tier 2 — EDGE_PREFER:  Medium queries, try edge first, fallback to origin
 *   Tier 3 — ORIGIN_ONLY:  Complex multi-step, long context, tool-heavy workflows
 *
 * @module edge-origin-router
 */

import { PHI, PSI, fib, phiFusionWeights, CSL_THRESHOLDS } from '../../shared/phi-math.js';

// ─────────────────────────────────────────────────────────────────────────────
// Complexity scoring weights (Sacred Geometry — Fibonacci ratios)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scoring weights for complexity factors using phiFusionWeights pattern.
 * Weights follow Fibonacci sequence: fib(9)=34, fib(8)=21, fib(7)=13, fib(6)=8, fib(5)=5, fib(4)=3, fib(3)=2, fib(2)=1
 * These are the same values as before — verified as correct Fibonacci numbers.
 */
const COMPLEXITY_WEIGHTS = {
  TOKEN_ESTIMATE:    fib(9),   // 34 — dominant factor: context length
  TOOL_COUNT:        fib(8),   // 21 — tool use implies agentic complexity
  MESSAGE_DEPTH:     fib(7),   // 13 — conversation depth
  SYSTEM_PROMPT_LEN: fib(6),   //  8 — elaborate system prompts = complex
  EXPLICIT_HINT:     fib(5),   //  5 — client-provided complexity hint
  MULTIMODAL:        fib(4),   //  3 — multimodal input
  REASONING_MODEL:   fib(3),   //  2 — requires chain-of-thought reasoning
  RAG_CONTEXT:       fib(2),   //  1 — has retrieved context to process
};

/**
 * Complexity score thresholds for tier assignment.
 * Derived from CSL_THRESHOLDS scaled to the max score range (87 = sum of all weights):
 *   EDGE_ONLY   = floor(CSL_THRESHOLDS.MINIMUM * 50)  ≈ 25  (noise floor scaled)
 *   ORIGIN_ONLY = floor(CSL_THRESHOLDS.LOW * 87)      ≈ 60  (low threshold scaled)
 */
const TIER_THRESHOLDS = {
  EDGE_ONLY:   Math.floor(CSL_THRESHOLDS.MINIMUM * 50),  // ≈ 25 (CSL noise floor scaled)
  EDGE_PREFER: Math.floor(CSL_THRESHOLDS.LOW * 87),      // ≈ 60 (CSL LOW scaled to score range)
  ORIGIN_ONLY: Math.floor(CSL_THRESHOLDS.LOW * 87),      // ≈ 60 (same boundary)
};

/**
 * Edge inference timeout (ms) before fallback to origin.
 * phi-scaled: round(1000 × PHI^3) ≈ 4236ms.
 */
const EDGE_TIMEOUT_MS = Math.round(1000 * Math.pow(PHI, 3));    // ≈ 4236ms (phi-scaled from 1s base)

/**
 * Origin request timeout (ms).
 * phi-scaled: round(1000 × PHI^7) ≈ 29034ms ≈ 29s (close to original 30s).
 * PHI^7 × 1000 gives exact phi-continuous derivation.
 */
const ORIGIN_TIMEOUT_MS = Math.round(1000 * Math.pow(PHI, 7));  // ≈ 29034ms (phi-scaled from 1s base)

/**
 * Latency measurement ring buffer size.
 * fib(10) = 55 — already a Fibonacci number, made explicit.
 */
const LATENCY_WINDOW = fib(10); // fib(10) = 55 ✓ already Fibonacci — made explicit via fib()

// ─────────────────────────────────────────────────────────────────────────────
// Route decision types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'edge_only'|'edge_prefer'|'origin_only'} RouteTier
 */

/**
 * @typedef {object} RouteDecision
 * @property {RouteTier} tier
 * @property {'edge'|'origin'} primary - Primary route to attempt
 * @property {'edge'|'origin'|null} fallback - Fallback on failure
 * @property {number} complexityScore
 * @property {string[]} reasons - Human-readable reasons for decision
 * @property {string} requestTag - Unique tag for analytics
 * @property {object} [smartPlacementHint] - Hint for CF Smart Placement
 * @property {number} estimatedLatencyMs - Estimated latency for this route
 * @property {number} estimatedCostNeurons - Estimated Cloudflare Neurons cost
 */

/**
 * @typedef {object} RouterRequest
 * @property {string} type - 'chat' | 'embed' | 'classify' | 'rerank' | 'rag'
 * @property {object[]} [messages] - Chat messages
 * @property {string} [text] - Single text input
 * @property {string[]} [tools] - Tool names requested
 * @property {number} [tokenEstimate] - Pre-computed token estimate
 * @property {string} [complexity] - Client hint: 'low' | 'medium' | 'high'
 * @property {boolean} [multimodal] - Contains image/audio input
 * @property {boolean} [requiresReasoning] - Needs chain-of-thought model
 * @property {object[]} [ragContext] - Retrieved context chunks
 * @property {string} [region] - Client geographic region (CF-IPCountry)
 * @property {string} [tier] - Client subscription tier ('free'|'pro'|'enterprise')
 */

// ─────────────────────────────────────────────────────────────────────────────
// Latency tracker (in-memory ring buffer — no external storage needed)
// ─────────────────────────────────────────────────────────────────────────────

class LatencyTracker {
  constructor(windowSize = LATENCY_WINDOW) {
    this._edge = new Array(windowSize).fill(null);
    this._origin = new Array(windowSize).fill(null);
    this._idx = { edge: 0, origin: 0 };
    this._windowSize = windowSize;
  }

  /** @param {'edge'|'origin'} route @param {number} ms */
  record(route, ms) {
    const arr = route === 'edge' ? this._edge : this._origin;
    const key = route === 'edge' ? 'edge' : 'origin';
    arr[this._idx[key] % this._windowSize] = ms;
    this._idx[key]++;
  }

  /**
   * @param {'edge'|'origin'} route
   * @returns {{p50: number, p95: number, count: number}}
   */
  stats(route) {
    const arr = (route === 'edge' ? this._edge : this._origin)
      .filter((v) => v !== null)
      .sort((a, b) => a - b);

    if (arr.length === 0) return { p50: Infinity, p95: Infinity, count: 0 };

    // Phi-harmonic percentile indices:
    //   p50 → PSI ≈ 0.618  (golden ratio conjugate — phi-harmonic median)
    //   p95 → 1 - PSI^3 ≈ 0.854  (phi-harmonic high-percentile)
    const p50 = arr[Math.floor(arr.length * PSI)];                          // PSI ≈ 0.618
    const p95 = arr[Math.floor(arr.length * (1 - Math.pow(PSI, 3)))];       // 1 - PSI^3 ≈ 0.854
    return { p50, p95, count: arr.length };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EdgeOriginRouter class
// ─────────────────────────────────────────────────────────────────────────────

export class EdgeOriginRouter {
  /**
   * @param {object} config
   * @param {string} config.originUrl - Cloud Run origin base URL
   * @param {string} [config.originApiKey] - Bearer token for origin auth
   * @param {KVNamespace} [config.kv] - KV for persistent latency/route stats
   * @param {boolean} [config.preferCost] - When true, prefer edge even at slight quality loss
   * @param {object} [config.geoRules] - Geographic routing overrides
   * @param {object} [config.costBudgets] - Per-tier cost budgets
   */
  constructor({
    originUrl,
    originApiKey = '',
    kv = null,
    preferCost = true,
    geoRules = {},
    costBudgets = {},
  }) {
    this.originUrl = originUrl.replace(/\/$/, '');
    this.originApiKey = originApiKey;
    this.kv = kv;
    this.preferCost = preferCost;
    this.geoRules = geoRules;
    this.costBudgets = costBudgets;

    /** @type {LatencyTracker} */
    this._latency = new LatencyTracker();

    /** Request counters for analytics */
    this._counters = { edge: 0, origin: 0, fallback: 0, error: 0 };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public: Route decision
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Compute a routing decision for the given request.
   * Does NOT execute the request — returns a RouteDecision for the caller.
   *
   * @param {RouterRequest} request
   * @returns {RouteDecision}
   */
  decide(request) {
    const score = this._scoreComplexity(request);
    const tier = this._assignTier(score, request);
    const reasons = this._buildReasonList(request, score, tier);
    const requestTag = this._buildRequestTag(request, tier);

    const { primary, fallback } = this._selectRoute(tier, request);
    const estimatedLatencyMs = this._estimateLatency(primary);
    const estimatedCostNeurons = this._estimateCost(request, primary);

    const smartPlacementHint = primary === 'origin'
      ? { placement: 'smart', affinity: 'origin_db', reason: 'origin_heavy_query' }
      : null;

    return {
      tier,
      primary,
      fallback,
      complexityScore: score,
      reasons,
      requestTag,
      smartPlacementHint,
      estimatedLatencyMs,
      estimatedCostNeurons,
    };
  }

  /**
   * Execute a request via the decided route, with automatic fallback.
   *
   * @param {RouterRequest} routerRequest - Original request metadata
   * @param {Request} httpRequest - Raw HTTP Request to forward
   * @param {object} env - Worker env bindings
   * @returns {Promise<{response: Response, route: 'edge'|'origin', tag: string, fallbackUsed: boolean}>}
   */
  async route(routerRequest, httpRequest, env) {
    const decision = this.decide(routerRequest);

    let response = null;
    let routeUsed = decision.primary;
    let fallbackUsed = false;

    const startTime = Date.now();

    try {
      if (decision.primary === 'edge') {
        response = await this._callEdge(httpRequest, env, decision);
        this._counters.edge++;
      } else {
        response = await this._callOrigin(httpRequest, decision);
        this._counters.origin++;
      }
    } catch (primaryErr) {
      console.warn(`[EdgeOriginRouter] primary route (${decision.primary}) failed:`, primaryErr.message);

      if (decision.fallback) {
        fallbackUsed = true;
        routeUsed = decision.fallback;
        this._counters.fallback++;

        try {
          if (decision.fallback === 'origin') {
            response = await this._callOrigin(httpRequest, decision);
          } else {
            response = await this._callEdge(httpRequest, env, decision);
          }
        } catch (fallbackErr) {
          this._counters.error++;
          throw new Error(`Both edge and origin routes failed. Primary: ${primaryErr.message}. Fallback: ${fallbackErr.message}`);
        }
      } else {
        this._counters.error++;
        throw primaryErr;
      }
    }

    const latencyMs = Date.now() - startTime;
    this._latency.record(routeUsed, latencyMs);

    // Add analytics headers to response
    const mutableHeaders = new Headers(response.headers);
    mutableHeaders.set('X-Heady-Route', routeUsed);
    mutableHeaders.set('X-Heady-Tag', decision.requestTag);
    mutableHeaders.set('X-Heady-Complexity', String(decision.complexityScore));
    mutableHeaders.set('X-Heady-Latency', String(latencyMs));
    if (fallbackUsed) mutableHeaders.set('X-Heady-Fallback', '1');

    return {
      response: new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: mutableHeaders,
      }),
      route: routeUsed,
      tag: decision.requestTag,
      fallbackUsed,
    };
  }

  /**
   * Get current router statistics.
   * @returns {object}
   */
  getStats() {
    return {
      counters: { ...this._counters },
      latency: {
        edge: this._latency.stats('edge'),
        origin: this._latency.stats('origin'),
      },
      config: {
        originUrl: this.originUrl,
        preferCost: this.preferCost,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Complexity scoring
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Score the complexity of a request using weighted factors.
   * @param {RouterRequest} req
   * @returns {number}
   */
  _scoreComplexity(req) {
    let score = 0;

    // Estimate token count from messages + text
    const messages = req.messages ?? [];
    const totalChars = messages.reduce((s, m) => s + (m.content?.length ?? 0), 0) + (req.text?.length ?? 0);
    const tokenEst = req.tokenEstimate ?? Math.ceil(totalChars / 4);

    // TOKEN_ESTIMATE: normalized to 0–34
    score += Math.min((tokenEst / 2000) * COMPLEXITY_WEIGHTS.TOKEN_ESTIMATE, COMPLEXITY_WEIGHTS.TOKEN_ESTIMATE);

    // TOOL_COUNT: each tool adds complexity
    const toolCount = req.tools?.length ?? 0;
    score += Math.min(toolCount * 5, COMPLEXITY_WEIGHTS.TOOL_COUNT);

    // MESSAGE_DEPTH: conversation turns
    score += Math.min((messages.length / 10) * COMPLEXITY_WEIGHTS.MESSAGE_DEPTH, COMPLEXITY_WEIGHTS.MESSAGE_DEPTH);

    // SYSTEM_PROMPT_LEN
    const systemLen = messages.find((m) => m.role === 'system')?.content?.length ?? 0;
    score += Math.min((systemLen / 500) * COMPLEXITY_WEIGHTS.SYSTEM_PROMPT_LEN, COMPLEXITY_WEIGHTS.SYSTEM_PROMPT_LEN);

    // EXPLICIT_HINT
    if (req.complexity === 'high') score += COMPLEXITY_WEIGHTS.EXPLICIT_HINT;
    else if (req.complexity === 'medium') score += COMPLEXITY_WEIGHTS.EXPLICIT_HINT * 0.5;

    // MULTIMODAL
    if (req.multimodal) score += COMPLEXITY_WEIGHTS.MULTIMODAL;

    // REASONING_MODEL
    if (req.requiresReasoning) score += COMPLEXITY_WEIGHTS.REASONING_MODEL;

    // RAG_CONTEXT
    const ragChunks = req.ragContext?.length ?? 0;
    if (ragChunks > 0) score += Math.min(ragChunks * 0.5, COMPLEXITY_WEIGHTS.RAG_CONTEXT * 5);

    // Fast-path overrides: classification and embedding are always edge
    if (req.type === 'classify' || req.type === 'embed' || req.type === 'rerank') {
      return 5; // Force tier 1
    }

    return Math.round(score);
  }

  /**
   * Assign a routing tier based on complexity score and request attributes.
   * @param {number} score
   * @param {RouterRequest} req
   * @returns {RouteTier}
   */
  _assignTier(score, req) {
    // Enterprise tier always gets origin for quality
    if (req.tier === 'enterprise' && score > TIER_THRESHOLDS.EDGE_ONLY) {
      return 'origin_only';
    }

    // Geographic override: some regions have higher edge GPU density
    const geoOverride = this.geoRules[req.region];
    if (geoOverride === 'edge_only') return 'edge_only';
    if (geoOverride === 'origin_only') return 'origin_only';

    if (score < TIER_THRESHOLDS.EDGE_ONLY) return 'edge_only';
    if (score < TIER_THRESHOLDS.ORIGIN_ONLY) return 'edge_prefer';
    return 'origin_only';
  }

  /**
   * @param {RouteTier} tier
   * @param {RouterRequest} req
   * @returns {{primary: 'edge'|'origin', fallback: 'edge'|'origin'|null}}
   */
  _selectRoute(tier, req) {
    // Cost preference: if edge stats show lower latency, prefer it even at medium complexity
    if (tier === 'edge_prefer' && this.preferCost) {
      const edgeStats = this._latency.stats('edge');
      const originStats = this._latency.stats('origin');
      // If edge p95 is less than origin p50, strongly prefer edge
      if (edgeStats.count > 5 && edgeStats.p95 < (originStats.p50 || Infinity)) {
        return { primary: 'edge', fallback: 'origin' };
      }
    }

    switch (tier) {
      case 'edge_only':    return { primary: 'edge', fallback: null };
      case 'edge_prefer':  return { primary: 'edge', fallback: 'origin' };
      case 'origin_only':  return { primary: 'origin', fallback: null };
      default:             return { primary: 'edge', fallback: 'origin' };
    }
  }

  /**
   * Build human-readable routing reasons for logging/analytics.
   * @param {RouterRequest} req
   * @param {number} score
   * @param {RouteTier} tier
   * @returns {string[]}
   */
  _buildReasonList(req, score, tier) {
    const reasons = [`complexity_score=${score}`, `tier=${tier}`];

    if (req.type === 'embed' || req.type === 'classify') reasons.push('fast_path_type');
    if (req.tools?.length > 0) reasons.push(`tool_count=${req.tools.length}`);
    if (req.requiresReasoning) reasons.push('reasoning_model_required');
    if (req.multimodal) reasons.push('multimodal_input');
    if (req.tier === 'enterprise') reasons.push('enterprise_tier_upgrade');
    if (req.region && this.geoRules[req.region]) reasons.push(`geo_override_${this.geoRules[req.region]}`);
    if (this.preferCost) reasons.push('cost_preference_enabled');

    return reasons;
  }

  /**
   * Build a structured request tag for analytics attribution.
   * @param {RouterRequest} req
   * @param {RouteTier} tier
   * @returns {string}
   */
  _buildRequestTag(req, tier) {
    const ts = Date.now().toString(36);
    const typeCode = (req.type ?? 'unk').slice(0, 3);
    const tierCode = tier === 'edge_only' ? 'e' : tier === 'origin_only' ? 'o' : 'ep';
    return `hdy:${typeCode}:${tierCode}:${ts}`;
  }

  /**
   * Estimate expected latency for a route (ms).
   * @param {'edge'|'origin'} route
   * @returns {number}
   */
  _estimateLatency(route) {
    const stats = this._latency.stats(route);
    if (stats.count > 0) return stats.p50;
    // Default estimates
    return route === 'edge' ? 250 : 800;
  }

  /**
   * Estimate Cloudflare Neurons cost for this request.
   * Rough model: 1 Neuron ≈ 1000 tokens at edge.
   * @param {RouterRequest} req
   * @param {'edge'|'origin'} route
   * @returns {number}
   */
  _estimateCost(req, route) {
    if (route === 'origin') return 0; // origin cost not tracked here
    const tokenEst = req.tokenEstimate ?? 100;
    return Math.ceil(tokenEst / 1000);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Route executors
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Call the edge inference Worker (internal Service Binding or same-worker).
   * In practice, this re-routes to the edge-inference-worker via Service Binding.
   *
   * @param {Request} request
   * @param {object} env
   * @param {RouteDecision} decision
   * @returns {Promise<Response>}
   */
  async _callEdge(request, env, decision) {
    // Tag the request before forwarding
    const edgeRequest = new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        'X-Heady-Route': 'edge',
        'X-Heady-Tag': decision.requestTag,
        'X-Heady-Complexity': String(decision.complexityScore),
      },
    });

    // Use Service Binding if available, otherwise forward to self
    if (env.EDGE_INFERENCE) {
      return env.EDGE_INFERENCE.fetch(edgeRequest);
    }

    // Fallback: forward to the same origin URL with edge path
    const url = new URL(request.url);
    const edgeUrl = new URL(url.pathname, url.origin);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS);

    try {
      const response = await fetch(edgeUrl.toString(), {
        method: request.method,
        headers: edgeRequest.headers,
        body: request.body,
        signal: controller.signal,
      });

      if (!response.ok && response.status >= 500) {
        throw new Error(`Edge returned ${response.status}`);
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Call the Cloud Run origin backend.
   *
   * @param {Request} request
   * @param {RouteDecision} decision
   * @returns {Promise<Response>}
   */
  async _callOrigin(request, decision) {
    const url = new URL(request.url);
    const originUrl = `${this.originUrl}${url.pathname}${url.search}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS);

    try {
      const response = await fetch(originUrl, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          'Authorization': this.originApiKey ? `Bearer ${this.originApiKey}` : request.headers.get('Authorization') ?? '',
          'X-Heady-Route': 'origin',
          'X-Heady-Tag': decision.requestTag,
          'X-Heady-Forwarded-By': 'edge-origin-router',
        },
        body: request.body,
        signal: controller.signal,
      });

      if (!response.ok && response.status >= 500) {
        throw new Error(`Origin returned ${response.status}`);
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
}
```
---

### `src/edge/heady-edge-daemon.js`

```javascript
#!/usr/bin/env node
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * Heady Edge Daemon
 * ═══════════════════════════════════════════════════════════════
 *
 * Persistent local process that provides a reliable tether between
 * the cloud-based Heady brain and local hardware:
 *
 *   - WebSocket bridge to Heady Cloud (Cloud Run / Cloudflare)
 *   - MIDI integration via easymidi (Ableton Live, hardware synths)
 *   - Local file system watch for real-time embedding triggers
 *   - Secure token authentication (EDGE_DAEMON_TOKEN)
 *
 * Usage:
 *   EDGE_DAEMON_TOKEN=xxx node heady-edge-daemon.js
 *   EDGE_DAEMON_TOKEN=xxx HEADY_CLOUD_URL=https://heady.headyme.com node heady-edge-daemon.js
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = parseInt(process.env.EDGE_DAEMON_PORT || '9876', 10);
const HEADY_CLOUD_URL = process.env.HEADY_CLOUD_URL || 'https://heady.headyme.com';
const EDGE_DAEMON_TOKEN = process.env.EDGE_DAEMON_TOKEN;
const MONOREPO_ROOT = process.env.HEADY_DIR || path.resolve(__dirname, '..', '..');

// ── State ───────────────────────────────────────────────────────
const state = {
    running: false,
    startedAt: null,
    cloudConnected: false,
    midiConnected: false,
    fileWatcherActive: false,
    eventsProcessed: 0,
    errors: [],
};

// ── MIDI Bridge ─────────────────────────────────────────────────
let midi = null;
let midiInput = null;
let midiOutput = null;

function initMIDI() {
    try {
        midi = require('easymidi');
        const inputs = midi.getInputs();
        const outputs = midi.getOutputs();

        console.log(`  🎹 MIDI Inputs:  [${inputs.join(', ')}]`);
        console.log(`  🎹 MIDI Outputs: [${outputs.join(', ')}]`);

        if (inputs.length > 0) {
            midiInput = new midi.Input(inputs[0]);
            midiInput.on('sysex', handleSysEx);
            midiInput.on('cc', handleCC);
            midiInput.on('noteon', handleNoteOn);
            state.midiConnected = true;
            console.log(`  ✅ MIDI connected: ${inputs[0]}`);
        }

        if (outputs.length > 0) {
            midiOutput = new midi.Output(outputs[0]);
        }
    } catch (err) {
        console.log('  ⚠️  easymidi not installed — MIDI bridge disabled');
        console.log('     Install with: npm install easymidi');
    }
}

function handleSysEx(msg) {
    state.eventsProcessed++;
    const data = msg.bytes || [];

    // Heady SysEx prefix: 0xF0 0x7D (non-commercial manufacturer ID)
    if (data[0] === 0xF0 && data[1] === 0x7D) {
        const commandByte = data[2];
        const payload = Buffer.from(data.slice(3, -1)).toString('utf8');

        console.log(`  🎵 SysEx command: 0x${commandByte.toString(16)} payload: ${payload}`);

        // Route to Heady cloud
        sendToCloud({
            type: 'sysex',
            command: commandByte,
            payload,
            timestamp: new Date().toISOString(),
        });
    }
}

function handleCC(msg) {
    state.eventsProcessed++;
    // CC messages for real-time parameter control
    sendToCloud({
        type: 'cc',
        controller: msg.controller,
        value: msg.value,
        channel: msg.channel,
        timestamp: new Date().toISOString(),
    });
}

function handleNoteOn(msg) {
    state.eventsProcessed++;
    // Note events for triggers
    if (msg.velocity > 0) {
        sendToCloud({
            type: 'noteon',
            note: msg.note,
            velocity: msg.velocity,
            channel: msg.channel,
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Send a MIDI-triggered SysEx command back to the MIDI output.
 */
function sendSysEx(commandByte, payload) {
    if (!midiOutput) return;
    const sysexData = [
        0xF0, 0x7D, commandByte,
        ...Buffer.from(payload, 'utf8'),
        0xF7,
    ];
    midiOutput.send('sysex', sysexData);
}

// ── Cloud Bridge ────────────────────────────────────────────────

async function sendToCloud(event) {
    if (!EDGE_DAEMON_TOKEN) return;

    try {
        const body = JSON.stringify(event);
        const url = new URL('/api/v1/edge/event', HEADY_CLOUD_URL);

        const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${EDGE_DAEMON_TOKEN}`,
                'X-Heady-Source': 'edge-daemon',
            },
            body,
        });

        if (!res.ok) {
            state.errors.push({ error: `Cloud: ${res.status}`, timestamp: new Date().toISOString() });
        }
        state.cloudConnected = true;
    } catch (err) {
        state.cloudConnected = false;
        state.errors.push({ error: err.message, timestamp: new Date().toISOString() });
    }

    // Cap error log
    if (state.errors.length > 100) state.errors.splice(0, state.errors.length - 100);
}

// ── File System Watcher ─────────────────────────────────────────

function initFileWatcher() {
    const srcDir = path.join(MONOREPO_ROOT, 'src');
    if (!fs.existsSync(srcDir)) {
        console.log(`  ⚠️  Source directory not found: ${srcDir}`);
        return;
    }

    try {
        const watcher = fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
            if (!filename) return;
            if (filename.includes('node_modules') || filename.startsWith('.')) return;

            state.eventsProcessed++;
            sendToCloud({
                type: 'file-change',
                eventType,
                filename,
                timestamp: new Date().toISOString(),
            });
        });

        watcher.on('error', (err) => {
            console.error(`  ❌ File watcher error: ${err.message}`);
        });

        state.fileWatcherActive = true;
        console.log(`  👁️  File watcher active on: ${srcDir}`);
    } catch (err) {
        console.log(`  ⚠️  File watcher failed: ${err.message}`);
    }
}

// ── HTTP Server ─────────────────────────────────────────────────

function startServer() {
    const server = http.createServer((req, res) => {
        // Auth check
        const authHeader = req.headers.authorization;
        const providedToken = authHeader ? authHeader.replace('Bearer ', '') : null;

        if (EDGE_DAEMON_TOKEN && providedToken !== EDGE_DAEMON_TOKEN) {
            if (req.url !== '/health') {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
        }

        if (req.url === '/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                service: 'heady-edge-daemon',
                ...state,
                uptime: state.startedAt ? Date.now() - new Date(state.startedAt).getTime() : 0,
            }));
            return;
        }

        if (req.url === '/midi/sysex' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const { command, payload } = JSON.parse(body);
                    sendSysEx(command, payload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, sent: { command, payload } }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
            return;
        }

        if (req.url === '/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(state));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(PORT, () => {
        state.running = true;
        state.startedAt = new Date().toISOString();
        console.log(`\n  ═══════════════════════════════════════════`);
        console.log(`  ⚡ Heady Edge Daemon running on port ${PORT}`);
        console.log(`  ═══════════════════════════════════════════`);
        console.log(`  Cloud:   ${HEADY_CLOUD_URL}`);
        console.log(`  Auth:    ${EDGE_DAEMON_TOKEN ? '✅ Token set' : '⚠️  No token'}`);
        console.log(`  MIDI:    ${state.midiConnected ? '✅ Connected' : '⚠️  Not available'}`);
        console.log(`  Watcher: ${state.fileWatcherActive ? '✅ Active' : '⚠️  Inactive'}`);
        console.log(`  ═══════════════════════════════════════════\n`);
    });
}

// ── Boot ─────────────────────────────────────────────────────────

function boot() {
    console.log('\n  🚀 Booting Heady Edge Daemon...\n');
    initMIDI();
    initFileWatcher();
    startServer();
}

// Auto-start if run directly
if (require.main === module) {
    boot();
}

module.exports = { boot, sendSysEx, sendToCloud, state };
```
---

### `src/edge/workers/edge-inference-worker.js`

```javascript
/**
 * edge-inference-worker.js
 * Heady Latent OS — Edge Inference Worker
 *
 * Cloudflare Worker module handling AI inference at the edge.
 * Endpoints: /api/chat (SSE streaming), /api/embed, /api/classify, /api/rerank
 *
 * Model bindings:
 *   - @cf/meta/llama-3.1-8b-instruct-fp8-fast  (fast chat)
 *   - @cf/meta/llama-3.2-1b-instruct           (simple/ultra-fast chat)
 *   - @cf/baai/bge-base-en-v1.5                (embeddings, 768-dim)
 *   - @cf/baai/bge-small-en-v1.5               (fast embeddings, 384-dim)
 *   - @cf/huggingface/distilbert-sst-2-int8    (classification)
 *   - @cf/baai/bge-reranker-base               (reranking)
 *   - @cf/meta/llama-guard-3-8b               (safety)
 *
 * Sacred Geometry resource allocation: Fibonacci ratios govern cache TTL tiers
 * and rate limit buckets (8, 13, 21, 34, 55, 89 req/min).
 *
 * @module edge-inference-worker
 */

// ─────────────────────────────────────────────────────────────────────────────
// Phi-Math constants (inlined from shared/phi-math.js — Workers can't import)
// Source: heady-implementation/shared/phi-math.js v2.0.0
// ─────────────────────────────────────────────────────────────────────────────

/** Golden ratio φ = (1 + √5) / 2 */
const PHI = 1.6180339887498949;
/** Golden ratio conjugate ψ = 1/φ = φ - 1 */
const PSI = 0.6180339887498949;

/**
 * Fibonacci sequence helper — F(0)=0, F(1)=1, F(2)=1, ...
 * Used to compute explicit Fibonacci constants below.
 * fib(6)=8, fib(7)=13, fib(8)=21, fib(9)=34, fib(10)=55, fib(11)=89
 */
// F(n) values for rate limits and TTLs — all are true Fibonacci numbers:
const _FIB_8  = 8;    // fib(6)
const _FIB_13 = 13;   // fib(7)
const _FIB_21 = 21;   // fib(8)
const _FIB_34 = 34;   // fib(9)
const _FIB_55 = 55;   // fib(10)
const _FIB_89 = 89;   // fib(11)

// CSL thresholds from phi-math (phiThreshold(n) = 1 - PSI^n * 0.5)
const _CSL_MEDIUM   = 1.0 - Math.pow(PSI, 2) * 0.5;  // ≈ 0.809
const _CSL_LOW      = 1.0 - Math.pow(PSI, 1) * 0.5;  // ≈ 0.691
const _CSL_MINIMUM  = 1.0 - Math.pow(PSI, 0) * 0.5;  // ≈ 0.500

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phi-scaled TTL tiers (seconds) for cache layers.
 * Values derived from phi-harmonic sequence:
 *   EMBED      = round(PHI^7 * 100) ≈ 2909s → rounded to phi-friendly 3600 (1h)
 *   CLASSIFY   = fib(12) = 144 * 2 ≈ 300 (nearest phi-scaled: PSI^(-3)*100 ≈ 292)
 *   RERANK     = fib(13) = 233 * 2 ≈ 610 (nearest: fib(14) = 610 — exact Fibonacci!)
 *   CHAT_EXACT = fib(10) * 2 = 110 (phi-scaled: nearest Fibonacci 2x = 144-based)
 *
 * Phi-scaled in seconds using phiBackoff-like scaling from a base of 60s:
 *   60 * PHI^0 = 60
 *   60 * PHI^1 ≈ 97
 *   60 * PHI^2 ≈ 157 → CHAT_EXACT
 *   60 * PHI^4 ≈ 411 → CLASSIFY
 *   60 * PHI^5 ≈ 665 → RERANK
 *   60 * PHI^7 ≈ 1741 → use fib(16)=987*4=3948 → 3600 rounded
 */
const CACHE_TTL = {
  EMBED:      Math.round(60 * Math.pow(PHI, 7)),  // ≈ 3541 → ~1h; embeddings are stable
  CLASSIFY:   Math.round(60 * Math.pow(PHI, 4)),  // ≈ 411 → ~7m; classifications may drift
  RERANK:     Math.round(60 * Math.pow(PHI, 5)),  // ≈ 665 → ~11m
  CHAT_EXACT: Math.round(60 * Math.pow(PHI, 2)),  // ≈ 157 → ~2.6m; deterministic chat (temp=0)
};

/**
 * Fibonacci rate-limit thresholds per tier (req/min).
 * These are true Fibonacci numbers: F(10)=55, F(8)=21, F(11)=89, F(9)=34.
 * Already Fibonacci — made explicit via named constants.
 */
const RATE_LIMITS = {
  EMBED:    _FIB_55,  // fib(10) = 55
  CHAT:     _FIB_21,  // fib(8)  = 21
  CLASSIFY: _FIB_89,  // fib(11) = 89
  RERANK:   _FIB_34,  // fib(9)  = 34
};

/** Model assignments by complexity tier */
const MODELS = {
  CHAT_FAST: '@cf/meta/llama-3.2-1b-instruct',
  CHAT_STANDARD: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  EMBED_FAST: '@cf/baai/bge-small-en-v1.5',
  EMBED_STANDARD: '@cf/baai/bge-base-en-v1.5',
  CLASSIFY: '@cf/huggingface/distilbert-sst-2-int8',
  RERANK: '@cf/baai/bge-reranker-base',
  SAFETY: '@cf/meta/llama-guard-3-8b',
};

/** CORS allowed origins — tighten in production */
const ALLOWED_ORIGINS = [
  'https://heady.ai',
  'https://app.heady.ai',
  'https://headyconnection.org',
  'http://localhost:3000',
  'http://localhost:5173',
];

// ─────────────────────────────────────────────────────────────────────────────
// CORS helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build CORS response headers.
 * @param {Request} request
 * @returns {Headers}
 */
function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const h = new Headers();
  h.set('Access-Control-Allow-Origin', allowed);
  h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Session-ID');
  h.set('Access-Control-Max-Age', '86400');
  h.set('Vary', 'Origin');
  return h;
}

/**
 * Handle preflight OPTIONS request.
 * @param {Request} request
 * @returns {Response}
 */
function handleOptions(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// ─────────────────────────────────────────────────────────────────────────────
// Error helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a structured JSON error response.
 * @param {string} message
 * @param {number} status
 * @param {Request} request
 * @param {string} [code]
 * @returns {Response}
 */
function errorResponse(message, status, request, code = 'INFERENCE_ERROR') {
  const headers = corsHeaders(request);
  headers.set('Content-Type', 'application/json');
  return new Response(
    JSON.stringify({
      error: { message, code, status },
      timestamp: Date.now(),
    }),
    { status, headers },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting (using Cloudflare's built-in CF-RateLimit header + KV counters)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check and increment rate limit counter for a given key.
 * Uses Workers KV for distributed counting with 60s sliding window.
 *
 * @param {KVNamespace} kv
 * @param {string} key
 * @param {number} limitPerMin
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
async function checkRateLimit(kv, key, limitPerMin) {
  const windowKey = `rl:${key}:${Math.floor(Date.now() / 60_000)}`;
  const raw = await kv.get(windowKey);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= limitPerMin) {
    return { allowed: false, remaining: 0, resetAt: (Math.floor(Date.now() / 60_000) + 1) * 60_000 };
  }

  // Increment — fire and forget to avoid blocking the request path
  kv.put(windowKey, String(count + 1), { expirationTtl: 120 }).catch(() => {});
  return { allowed: true, remaining: limitPerMin - count - 1, resetAt: (Math.floor(Date.now() / 60_000) + 1) * 60_000 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Complexity scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score the complexity of a chat request to select model tier.
 * Returns 'simple' | 'standard' | 'complex'
 *
 * Scoring factors (phiFusionWeights pattern — Fibonacci proportions):
 *   - Token estimate (rough char/4)   weight: fib(9)=34  (dominant factor)
 *   - Message count                   weight: fib(8)=21
 *   - System prompt length            weight: fib(7)=13
 *   - Tool/function use requested     weight: fib(6)=8
 *   - Explicit complexity hint        weight: fib(5)=5
 *
 * Thresholds use CSL_THRESHOLDS-derived values (scaled to score range):
 *   'simple'   = score < _CSL_MINIMUM * 40  ≈ 20
 *   'standard' = score < _CSL_LOW * 72      ≈ 50
 *   'complex'  = score ≥ 50
 *
 * @param {object} body
 * @returns {'simple'|'standard'|'complex'}
 */
function scoreChatComplexity(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const totalChars = messages.reduce((s, m) => s + (m.content?.length ?? 0), 0);
  const tokenEstimate = Math.ceil(totalChars / 4);
  const systemPrompt = messages.find((m) => m.role === 'system')?.content ?? '';

  let score = 0;
  score += Math.min(tokenEstimate / 500, _FIB_34) * 1;  // up to fib(9)=34 pts from tokens
  score += Math.min(messages.length, _FIB_21);          // up to fib(8)=21 pts from depth
  score += Math.min(systemPrompt.length / 200, _FIB_13); // up to fib(7)=13 pts from system
  score += body.tools?.length ? _FIB_8 : 0;             // fib(6)=8 pts for tool use
  score += body.complexity === 'high' ? 5 : 0;          // 5 pts for explicit hint

  // Thresholds derived from CSL noise floor (_CSL_MINIMUM ≈ 0.5) and LOW (≈ 0.691)
  // scaled to the 0–81 score range (sum of all max weights = 34+21+13+8+5=81)
  const SIMPLE_THRESHOLD   = Math.round(_CSL_MINIMUM * 40);   // ≈ 20
  const STANDARD_THRESHOLD = Math.round(_CSL_LOW * 72);       // ≈ 50

  if (score < SIMPLE_THRESHOLD) return 'simple';
  if (score < STANDARD_THRESHOLD) return 'standard';
  return 'complex';
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic cache key for a request.
 * Uses crypto.subtle SHA-256 over the canonical request body.
 *
 * @param {string} prefix
 * @param {object} payload
 * @returns {Promise<string>}
 */
async function makeCacheKey(prefix, payload) {
  const data = JSON.stringify(payload, Object.keys(payload).sort());
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}:${hex}`;
}

/**
 * Attempt to read a cached response from Workers KV.
 *
 * @param {KVNamespace} kv
 * @param {string} cacheKey
 * @returns {Promise<object|null>}
 */
async function kvCacheGet(kv, cacheKey) {
  try {
    const raw = await kv.get(cacheKey, { type: 'json' });
    return raw ?? null;
  } catch {
    return null;
  }
}

/**
 * Store a response in Workers KV cache with TTL.
 *
 * @param {KVNamespace} kv
 * @param {string} cacheKey
 * @param {object} value
 * @param {number} ttlSeconds
 * @returns {Promise<void>}
 */
async function kvCachePut(kv, cacheKey, value, ttlSeconds) {
  try {
    await kv.put(cacheKey, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch {
    // cache write failure is non-fatal
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate Authorization header against expected bearer token.
 * Returns the extracted API key or null on failure.
 *
 * @param {Request} request
 * @param {Env} env
 * @returns {string|null}
 */
function validateAuth(request, env) {
  const auth = request.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  // In dev/local, allow the dev token
  if (env.EDGE_API_KEY && token !== env.EDGE_API_KEY) return null;
  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle POST /api/chat
 * Streams SSE from Workers AI LLM. Selects model based on complexity scoring.
 * Supports cache for temperature=0 deterministic requests.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
async function handleChat(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, request, 'INVALID_BODY');
  }

  const { messages, stream = true, temperature = 0.7, max_tokens = 1024, session_id } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse('messages array is required and must be non-empty', 400, request, 'MISSING_MESSAGES');
  }

  // Rate limiting
  const rateLimitKey = session_id ?? request.headers.get('CF-Connecting-IP') ?? 'global';
  const rl = await checkRateLimit(env.EDGE_CACHE_KV, `chat:${rateLimitKey}`, RATE_LIMITS.CHAT);
  if (!rl.allowed) {
    const headers = corsHeaders(request);
    headers.set('Retry-After', String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
    headers.set('X-RateLimit-Remaining', '0');
    return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded', code: 'RATE_LIMITED', status: 429 } }), { status: 429, headers });
  }

  // Complexity scoring → model selection
  const complexity = scoreChatComplexity(body);

  // If complexity is 'complex', route to origin (caller should check X-Heady-Route)
  if (complexity === 'complex') {
    const headers = corsHeaders(request);
    headers.set('X-Heady-Route', 'origin');
    headers.set('X-Heady-Complexity', complexity);
    headers.set('Content-Type', 'application/json');
    return new Response(
      JSON.stringify({ route: 'origin', reason: 'complexity_score_exceeded_edge_threshold', complexity }),
      { status: 307, headers },
    );
  }

  const model = complexity === 'simple' ? MODELS.CHAT_FAST : MODELS.CHAT_STANDARD;

  // Exact-match cache for deterministic (temp=0) non-streaming requests
  if (!stream && temperature === 0 && env.EDGE_CACHE_KV) {
    const cacheKey = await makeCacheKey('chat', { model, messages, temperature, max_tokens });
    const cached = await kvCacheGet(env.EDGE_CACHE_KV, cacheKey);
    if (cached) {
      const headers = corsHeaders(request);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Heady-Cache', 'HIT');
      return new Response(JSON.stringify(cached), { headers });
    }
  }

  const inferenceParams = {
    messages,
    stream,
    temperature,
    max_tokens,
  };

  try {
    if (stream) {
      // Streaming SSE response
      const aiStream = await env.AI.run(model, inferenceParams);
      const headers = corsHeaders(request);
      headers.set('Content-Type', 'text/event-stream');
      headers.set('Cache-Control', 'no-cache');
      headers.set('Connection', 'keep-alive');
      headers.set('X-Heady-Model', model);
      headers.set('X-Heady-Complexity', complexity);
      headers.set('X-RateLimit-Remaining', String(rl.remaining));
      return new Response(aiStream, { headers });
    } else {
      // Non-streaming JSON response
      const result = await env.AI.run(model, { ...inferenceParams, stream: false });
      const responsePayload = {
        result,
        model,
        complexity,
        cached: false,
        timestamp: Date.now(),
      };

      // Cache deterministic responses
      if (temperature === 0 && env.EDGE_CACHE_KV) {
        const cacheKey = await makeCacheKey('chat', { model, messages, temperature, max_tokens });
        ctx.waitUntil(kvCachePut(env.EDGE_CACHE_KV, cacheKey, responsePayload, CACHE_TTL.CHAT_EXACT));
      }

      const headers = corsHeaders(request);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Heady-Model', model);
      headers.set('X-Heady-Complexity', complexity);
      headers.set('X-RateLimit-Remaining', String(rl.remaining));
      return new Response(JSON.stringify(responsePayload), { headers });
    }
  } catch (err) {
    console.error('[chat] inference error:', err);
    return errorResponse('Edge inference failed', 502, request, 'INFERENCE_FAILED');
  }
}

/**
 * Handle POST /api/embed
 * Generates embeddings using BGE models. Returns float32 vectors.
 * Caches results in KV by content hash.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
async function handleEmbed(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, request, 'INVALID_BODY');
  }

  const { text, texts, model: requestedModel, dimensions = 'standard' } = body;

  // Accept single text or batch
  const inputs = texts ?? (text ? [text] : null);
  if (!inputs || inputs.length === 0) {
    return errorResponse('text or texts field is required', 400, request, 'MISSING_INPUT');
  }

  if (inputs.length > 100) {
    return errorResponse('Maximum batch size is 100 texts', 400, request, 'BATCH_TOO_LARGE');
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') ?? 'global';
  const rl = await checkRateLimit(env.EDGE_CACHE_KV, `embed:${clientIP}`, RATE_LIMITS.EMBED);
  if (!rl.allowed) {
    return errorResponse('Rate limit exceeded', 429, request, 'RATE_LIMITED');
  }

  // Model selection: explicit > dimension hint > default
  let model = MODELS.EMBED_STANDARD;
  if (requestedModel && (requestedModel.includes('bge-small') || dimensions === 'fast')) {
    model = MODELS.EMBED_FAST;
  }

  // Cache lookup for single-text requests
  let cacheKey = null;
  if (inputs.length === 1 && env.EDGE_CACHE_KV) {
    cacheKey = await makeCacheKey('embed', { model, text: inputs[0] });
    const cached = await kvCacheGet(env.EDGE_CACHE_KV, cacheKey);
    if (cached) {
      const headers = corsHeaders(request);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Heady-Cache', 'HIT');
      return new Response(JSON.stringify(cached), { headers });
    }
  }

  try {
    const result = await env.AI.run(model, { text: inputs });
    const responsePayload = {
      embeddings: result.data ?? result,
      model,
      dimensions: model.includes('small') ? 384 : 768,
      count: inputs.length,
      cached: false,
      timestamp: Date.now(),
    };

    // Store in cache
    if (cacheKey && env.EDGE_CACHE_KV) {
      ctx.waitUntil(kvCachePut(env.EDGE_CACHE_KV, cacheKey, responsePayload, CACHE_TTL.EMBED));
    }

    const headers = corsHeaders(request);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Heady-Model', model);
    headers.set('X-Heady-Cache', 'MISS');
    headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return new Response(JSON.stringify(responsePayload), { headers });
  } catch (err) {
    console.error('[embed] inference error:', err);
    return errorResponse('Embedding generation failed', 502, request, 'INFERENCE_FAILED');
  }
}

/**
 * Handle POST /api/classify
 * Runs text classification using DistilBERT SST-2.
 * Caches results due to deterministic nature of classification.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
async function handleClassify(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, request, 'INVALID_BODY');
  }

  const { text, texts } = body;
  const inputs = texts ?? (text ? [text] : null);

  if (!inputs || inputs.length === 0) {
    return errorResponse('text or texts field is required', 400, request, 'MISSING_INPUT');
  }

  if (inputs.length > 50) {
    return errorResponse('Maximum batch size is 50 texts', 400, request, 'BATCH_TOO_LARGE');
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') ?? 'global';
  const rl = await checkRateLimit(env.EDGE_CACHE_KV, `classify:${clientIP}`, RATE_LIMITS.CLASSIFY);
  if (!rl.allowed) {
    return errorResponse('Rate limit exceeded', 429, request, 'RATE_LIMITED');
  }

  // Cache lookup
  let cacheKey = null;
  if (env.EDGE_CACHE_KV) {
    cacheKey = await makeCacheKey('classify', { texts: inputs });
    const cached = await kvCacheGet(env.EDGE_CACHE_KV, cacheKey);
    if (cached) {
      const headers = corsHeaders(request);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Heady-Cache', 'HIT');
      return new Response(JSON.stringify(cached), { headers });
    }
  }

  try {
    // DistilBERT accepts single text input; batch sequentially for multiple
    const results = await Promise.all(
      inputs.map((t) => env.AI.run(MODELS.CLASSIFY, { text: t })),
    );

    const responsePayload = {
      classifications: results.map((r, i) => ({
        text: inputs[i],
        label: r[0]?.label ?? 'UNKNOWN',
        score: r[0]?.score ?? 0,
        all: r,
      })),
      model: MODELS.CLASSIFY,
      count: inputs.length,
      cached: false,
      timestamp: Date.now(),
    };

    if (cacheKey && env.EDGE_CACHE_KV) {
      ctx.waitUntil(kvCachePut(env.EDGE_CACHE_KV, cacheKey, responsePayload, CACHE_TTL.CLASSIFY));
    }

    const headers = corsHeaders(request);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Heady-Model', MODELS.CLASSIFY);
    headers.set('X-Heady-Cache', 'MISS');
    headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return new Response(JSON.stringify(responsePayload), { headers });
  } catch (err) {
    console.error('[classify] inference error:', err);
    return errorResponse('Classification failed', 502, request, 'INFERENCE_FAILED');
  }
}

/**
 * Handle POST /api/rerank
 * Reranks documents relative to a query using BGE-reranker-base.
 * Returns documents sorted by relevance score.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
async function handleRerank(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, request, 'INVALID_BODY');
  }

  const { query, documents, top_k } = body;

  if (!query || typeof query !== 'string') {
    return errorResponse('query string is required', 400, request, 'MISSING_QUERY');
  }

  if (!Array.isArray(documents) || documents.length === 0) {
    return errorResponse('documents array is required and non-empty', 400, request, 'MISSING_DOCUMENTS');
  }

  if (documents.length > 50) {
    return errorResponse('Maximum 50 documents per rerank request', 400, request, 'BATCH_TOO_LARGE');
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') ?? 'global';
  const rl = await checkRateLimit(env.EDGE_CACHE_KV, `rerank:${clientIP}`, RATE_LIMITS.RERANK);
  if (!rl.allowed) {
    return errorResponse('Rate limit exceeded', 429, request, 'RATE_LIMITED');
  }

  // Cache lookup
  let cacheKey = null;
  if (env.EDGE_CACHE_KV) {
    cacheKey = await makeCacheKey('rerank', { query, documents });
    const cached = await kvCacheGet(env.EDGE_CACHE_KV, cacheKey);
    if (cached) {
      const headers = corsHeaders(request);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Heady-Cache', 'HIT');
      return new Response(JSON.stringify(cached), { headers });
    }
  }

  try {
    const docTexts = documents.map((d) => (typeof d === 'string' ? d : d.text ?? d.content ?? ''));

    // BGE reranker accepts query + passages
    const result = await env.AI.run(MODELS.RERANK, {
      query,
      passages: docTexts,
    });

    // Build scored results with original document reference
    const scored = (result.data ?? result ?? []).map((score, i) => ({
      index: i,
      document: documents[i],
      score: typeof score === 'number' ? score : score?.score ?? 0,
    }));

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const topK = top_k ?? scored.length;
    const responsePayload = {
      results: scored.slice(0, topK),
      model: MODELS.RERANK,
      query,
      total: documents.length,
      returned: Math.min(topK, scored.length),
      cached: false,
      timestamp: Date.now(),
    };

    if (cacheKey && env.EDGE_CACHE_KV) {
      ctx.waitUntil(kvCachePut(env.EDGE_CACHE_KV, cacheKey, responsePayload, CACHE_TTL.RERANK));
    }

    const headers = corsHeaders(request);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Heady-Model', MODELS.RERANK);
    headers.set('X-Heady-Cache', 'MISS');
    headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return new Response(JSON.stringify(responsePayload), { headers });
  } catch (err) {
    console.error('[rerank] inference error:', err);
    return errorResponse('Reranking failed', 502, request, 'INFERENCE_FAILED');
  }
}

/**
 * Handle GET /api/health
 * Returns worker health and binding availability.
 *
 * @param {Request} request
 * @param {Env} env
 * @returns {Response}
 */
function handleHealth(request, env) {
  const headers = corsHeaders(request);
  headers.set('Content-Type', 'application/json');
  return new Response(
    JSON.stringify({
      status: 'ok',
      worker: 'edge-inference-worker',
      version: '1.0.0',
      bindings: {
        ai: !!env.AI,
        kv: !!env.EDGE_CACHE_KV,
        vectorize: !!env.VECTORIZE,
        agentDO: !!env.AGENT_STATE,
      },
      models: MODELS,
      timestamp: Date.now(),
    }),
    { headers },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main fetch handler
// ─────────────────────────────────────────────────────────────────────────────

export default {
  /**
   * Main fetch entrypoint for the Cloudflare Worker.
   *
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;

    // Preflight
    if (method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Health check (no auth required)
    if (path === '/api/health' && method === 'GET') {
      return handleHealth(request, env);
    }

    // Auth validation for all other routes
    const token = validateAuth(request, env);
    if (!token && env.EDGE_API_KEY) {
      return errorResponse('Unauthorized — valid Bearer token required', 401, request, 'UNAUTHORIZED');
    }

    // Tag request with correlation ID
    const requestId = request.headers.get('X-Request-ID') ?? crypto.randomUUID();

    try {
      if (path === '/api/chat' && method === 'POST') {
        return await handleChat(request, env, ctx);
      }

      if (path === '/api/embed' && method === 'POST') {
        return await handleEmbed(request, env, ctx);
      }

      if (path === '/api/classify' && method === 'POST') {
        return await handleClassify(request, env, ctx);
      }

      if (path === '/api/rerank' && method === 'POST') {
        return await handleRerank(request, env, ctx);
      }

      // 404 for unknown paths
      return errorResponse(`Path ${path} not found`, 404, request, 'NOT_FOUND');
    } catch (err) {
      console.error(`[${requestId}] unhandled error:`, err);
      return errorResponse('Internal server error', 500, request, 'INTERNAL_ERROR');
    }
  },

  /**
   * Scheduled handler for cache warming and metric flushes.
   * Triggered by Cron Triggers defined in wrangler.toml.
   *
   * @param {ScheduledEvent} event
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async scheduled(event, env, ctx) {
    console.log('[scheduled] cron fired:', event.cron);
    // Placeholder for cache warm-up logic
    // In production, pre-embed common queries and store in EDGE_CACHE_KV
  },
};
```
---

### `src/routes/edge-routes.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const {
  StateManager,
  EdgeAgentRuntime,
  EdgeHealthProbe,
  DurableAgent,
  evaluateCslGate,
} = require('../edge/durable-edge-agent');

function respond(res, status, body) {
  if (res && typeof res.status === 'function') return res.status(status).json(body);
  if (res && typeof res.writeHead === 'function') {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  }
  return body;
}

function createEdgeRoutes(opts = {}) {
  const runtime = opts.runtime || new EdgeAgentRuntime(opts.runtimeOpts || {});
  runtime.start();
  const routes  = [];

  /**
   * POST /edge/agent/create
   * Create or retrieve a durable agent.
   * Body: { agentId: string, cslGates?: Gate[] }
   */
  routes.push({
    method: 'POST',
    path:   '/edge/agent/create',
    handler: async (req, res) => {
      const { agentId, cslGates = [] } = req.body || {};
      if (!agentId) return respond(res, 400, { error: 'Missing agentId' });
      const agent = runtime.getOrCreate(agentId, cslGates);
      if (!agent._initialized) await agent._initialize();
      return respond(res, 201, { ok: true, agentId: agent.getAgentId() });
    },
  });

  /**
   * GET /edge/agent/:agentId/state
   * Get current state of a durable agent.
   */
  routes.push({
    method: 'GET',
    path:   '/edge/agent/:agentId/state',
    handler: async (req, res) => {
      const { agentId } = req.params || {};
      if (!agentId) return respond(res, 400, { error: 'Missing agentId' });
      const agent = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();
      const sm     = agent.getStateManager();
      const state  = await sm.getAll(['agentId', 'status', 'beatCount', 'startedAt', 'lastBeat']);
      return respond(res, 200, { ok: true, state });
    },
  });

  /**
   * GET /edge/agent/:agentId/state/:key
   * Get a specific state key from a durable agent.
   */
  routes.push({
    method: 'GET',
    path:   '/edge/agent/:agentId/state/:key',
    handler: async (req, res) => {
      const { agentId, key } = req.params || {};
      if (!agentId || !key) return respond(res, 400, { error: 'Missing agentId or key' });
      const agent = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();
      const value = await agent.getStateManager().get(key);
      return respond(res, 200, { ok: true, key, value });
    },
  });

  /**
   * PUT /edge/agent/:agentId/state
   * Set state key(s) on a durable agent.
   * Body: { key: string, value: any } or { entries: { [key]: value } }
   */
  routes.push({
    method: 'PUT',
    path:   '/edge/agent/:agentId/state',
    handler: async (req, res) => {
      const { agentId } = req.params || {};
      const { key, value, entries } = req.body || {};
      if (!agentId) return respond(res, 400, { error: 'Missing agentId' });

      const agent = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();
      const sm    = agent.getStateManager();

      if (entries && typeof entries === 'object') {
        await sm.setAll(entries);
        return respond(res, 200, { ok: true, keys: Object.keys(entries) });
      } else if (key !== undefined && value !== undefined) {
        await sm.set(key, value);
        return respond(res, 200, { ok: true, key, value });
      }
      return respond(res, 400, { error: 'Provide key+value or entries' });
    },
  });

  /**
   * POST /edge/agent/:agentId/action
   * Dispatch an action to a durable agent.
   * Body: { action: string, payload: object }
   */
  routes.push({
    method: 'POST',
    path:   '/edge/agent/:agentId/action',
    handler: async (req, res) => {
      const { agentId } = req.params || {};
      const { action, payload = {} } = req.body || {};
      if (!agentId || !action) return respond(res, 400, { error: 'Missing agentId or action' });

      const agent = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();

      const mockReq = {
        method: 'POST',
        url:    `http://edge/action`,
        json:   async () => ({ action, payload }),
      };
      const mockRes = await agent.fetch(mockReq);
      const body    = JSON.parse(await mockRes.text());
      return respond(res, mockRes.status || 200, body);
    },
  });

  /**
   * POST /edge/agent/:agentId/snapshot
   * Take a state snapshot.
   * Body: { label?: string }
   */
  routes.push({
    method: 'POST',
    path:   '/edge/agent/:agentId/snapshot',
    handler: async (req, res) => {
      const { agentId } = req.params || {};
      const { label }   = req.body || {};
      if (!agentId) return respond(res, 400, { error: 'Missing agentId' });
      const agent   = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();
      const snpLabel = label || `snap-${Date.now()}`;
      const snap     = await agent.getStateManager().snapshot(snpLabel);
      return respond(res, 200, { ok: true, snapshot: snap });
    },
  });

  /**
   * POST /edge/agent/:agentId/migrate
   * Migrate agent state to a target edge location.
   * Body: { targetEdge: string }
   */
  routes.push({
    method: 'POST',
    path:   '/edge/agent/:agentId/migrate',
    handler: async (req, res) => {
      const { agentId }    = req.params || {};
      const { targetEdge } = req.body || {};
      if (!agentId || !targetEdge) return respond(res, 400, { error: 'Missing agentId or targetEdge' });
      try {
        const result = await runtime.migrateAgent(agentId, targetEdge);
        return respond(res, 200, { ok: true, ...result });
      } catch (err) {
        return respond(res, 404, { error: err.message });
      }
    },
  });

  /**
   * GET /edge/agent/:agentId/health
   * Get health status of a durable agent.
   */
  routes.push({
    method: 'GET',
    path:   '/edge/agent/:agentId/health',
    handler: async (req, res) => {
      const { agentId } = req.params || {};
      if (!agentId) return respond(res, 400, { error: 'Missing agentId' });
      const agent = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();
      const stats = agent.getProbe().getStats();
      return respond(res, 200, { ok: stats.healthy, ...stats });
    },
  });

  /**
   * GET /edge/agents
   * List all active agent IDs.
   */
  routes.push({
    method: 'GET',
    path:   '/edge/agents',
    handler: async (req, res) => {
      return respond(res, 200, {
        ok:         true,
        agents:     runtime.listAgentIds(),
        count:      runtime.getAgentCount(),
        edgeLabel:  runtime.getEdgeLabel(),
      });
    },
  });

  /**
   * POST /edge/csl/evaluate
   * Evaluate a CSL gate against a provided state.
   * Body: { gate: Gate, state: object }
   */
  routes.push({
    method: 'POST',
    path:   '/edge/csl/evaluate',
    handler: async (req, res) => {
      const { gate, state } = req.body || {};
      if (!gate || !state) return respond(res, 400, { error: 'Missing gate or state' });
      const result = evaluateCslGate(gate, state);
      return respond(res, 200, { ok: true, result, gate, state });
    },
  });

  return routes;
}

function attachEdgeRoutes(app, opts = {}) {
  const routes = createEdgeRoutes(opts);
  for (const route of routes) {
    const method = route.method.toLowerCase();
    if (app[method]) app[method](route.path, route.handler);
  }
  return app;
}

module.exports = { createEdgeRoutes, attachEdgeRoutes };
```
---

### `src/services/gateway.js`

```javascript
'use strict';

/**
 * HeadyGateway — Unified API Gateway for all Heady Native Services
 * Routes requests to the appropriate service based on path prefix.
 * Sacred Geometry Architecture v3.0.0
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const PHI = 1.618033988749895;

// Service imports
const embedRoutes = require('./services/heady-embed/routes');
const inferRoutes = require('./services/heady-infer/routes');
const vectorRoutes = require('./services/heady-vector/routes');
const chainRoutes = require('./services/heady-chain/routes');
const cacheRoutes = require('./services/heady-cache/routes');
const guardRoutes = require('./services/heady-guard/routes');
const evalRoutes = require('./services/heady-eval/routes');

const PORT = parseInt(process.env.HEADY_GATEWAY_PORT || '3100', 10);

const SERVICES = [
  { name: 'HeadyEmbed',  prefix: '/embed',  port: 3101, status: 'unknown' },
  { name: 'HeadyInfer',  prefix: '/infer',  port: 3102, status: 'unknown' },
  { name: 'HeadyVector', prefix: '/vector', port: 3103, status: 'unknown' },
  { name: 'HeadyChain',  prefix: '/chain',  port: 3104, status: 'unknown' },
  { name: 'HeadyCache',  prefix: '/cache',  port: 3105, status: 'unknown' },
  { name: 'HeadyGuard',  prefix: '/guard',  port: 3106, status: 'unknown' },
  { name: 'HeadyEval',   prefix: '/eval',   port: 3107, status: 'unknown' },
];

function createGateway() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '50mb' }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[Gateway] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // Service routes
  app.use('/api/v1/embed', embedRoutes);
  app.use('/api/v1/infer', inferRoutes);
  app.use('/api/v1/vector', vectorRoutes);
  app.use('/api/v1/chain', chainRoutes);
  app.use('/api/v1/cache', cacheRoutes);
  app.use('/api/v1/guard', guardRoutes);
  app.use('/api/v1/eval', evalRoutes);

  // Gateway health
  app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    res.json({
      status: 'healthy',
      service: 'HeadyGateway',
      version: '1.0.0',
      architecture: 'Sacred Geometry v3.0.0',
      phi: PHI,
      uptime: `${Math.floor(uptime)}s`,
      memory: {
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      },
      services: SERVICES,
      timestamp: new Date().toISOString(),
    });
  });

  // Service registry
  app.get('/services', (req, res) => {
    res.json({
      gateway: { port: PORT, version: '1.0.0' },
      services: SERVICES.map(s => ({
        name: s.name,
        prefix: `/api/v1${s.prefix}`,
        standalone_port: s.port,
        health: `/api/v1${s.prefix}/health`,
      })),
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      available_prefixes: SERVICES.map(s => `/api/v1${s.prefix}`),
    });
  });

  // Error handler
  app.use((err, req, res, _next) => {
    console.error('[Gateway] Error:', err.message);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      service: 'HeadyGateway',
    });
  });

  return app;
}

// Start if run directly
if (require.main === module) {
  const app = createGateway();
  const server = app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║          HeadyGateway — Sacred Geometry v3.0.0          ║');
    console.log('║     Sovereign AI • Zero External Dependencies           ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Gateway:     http://localhost:${PORT}                      ║`);
    console.log('║                                                          ║');
    SERVICES.forEach(s => {
      const line = `║  ${s.name.padEnd(12)} /api/v1${s.prefix.padEnd(8)} (standalone :${s.port})    ║`;
      console.log(line);
    });
    console.log('║                                                          ║');
    console.log(`║  PHI = ${PHI}                              ║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n[Gateway] ${signal} received — shutting down gracefully...`);
    server.close(() => {
      console.log('[Gateway] All connections closed. Goodbye.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[Gateway] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { createGateway };
```
---

### `src/services/inference-gateway.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * AI Inference Gateway — Multi-provider, credit-aware, latency-optimized.
 *
 * Routes requests to the optimal AI provider based on:
 *   1. Task complexity & context window needs
 *   2. Credit balance / cost optimization
 *   3. Latency requirements
 *   4. Provider availability
 *
 * Priority order (burn free resources first):
 *   Groq (free/fast) → Gemini (GCloud credits) → Claude (membership/API) → OpenAI (fallback)
 *
 * Supports parallel "race" mode for instantaneous response.
 */
const EventEmitter = require('events');
const logger = require('./utils/logger');

// ─── Provider Definitions ───────────────────────────────────────
const PROVIDERS = {
    groq: {
        name: 'Groq',
        tier: 'speed',
        costPerMTok: 0,  // free tier
        latencyMs: 100,  // ultra-fast inference
        maxContext: 128000,
        envKey: 'GROQ_API_KEY',
        models: {
            fast: 'llama-3.1-70b-versatile',
            small: 'llama-3.1-8b-instant',
            default: 'llama-3.1-70b-versatile',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) throw new Error('GROQ_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model, messages,
                    max_tokens: opts.maxTokens || 4096,
                    temperature: opts.temperature ?? 0.7,
                    stream: false,
                }),
            });
            if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
            const data = await res.json();
            return {
                content: data.choices[0].message.content,
                model: data.model,
                provider: 'groq',
                usage: data.usage,
                latencyMs: data.usage?.total_time ? Math.round(data.usage.total_time * 1000) : null,
            };
        },
    },

    gemini: {
        name: 'Gemini (GCloud)',
        tier: 'credits',
        costPerMTok: 0.075, // paid via $530 GCloud credits
        latencyMs: 300,
        maxContext: 1000000, // 1M context window
        envKey: 'GOOGLE_API_KEY',
        models: {
            fast: 'gemini-2.0-flash',
            quality: 'gemini-1.5-pro',
            default: 'gemini-2.0-flash',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.GOOGLE_API_KEY;
            if (!apiKey) throw new Error('GOOGLE_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            // Convert OpenAI-style messages to Gemini format
            const contents = messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));
            // Extract system instruction
            const systemMsg = messages.find(m => m.role === 'system');
            const nonSystemContents = contents.filter((_, i) => messages[i].role !== 'system');

            const body = { contents: nonSystemContents, generationConfig: { maxOutputTokens: opts.maxTokens || 4096, temperature: opts.temperature ?? 0.7 } };
            if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return {
                content: text,
                model,
                provider: 'gemini',
                usage: data.usageMetadata || null,
            };
        },
    },

    claude: {
        name: 'Claude (Anthropic)',
        tier: 'quality',
        costPerMTok: 3.0,  // Sonnet pricing
        latencyMs: 800,
        maxContext: 200000,
        envKey: 'ANTHROPIC_API_KEY',
        models: {
            fast: 'claude-3-haiku-20240307',
            quality: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
            default: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
        },
        async complete(messages, opts = {}) {
            // Try secondary key first to save primary for interactive
            const apiKey = (opts.useSecondary && process.env.ANTHROPIC_SECONDARY_KEY)
                || process.env.ANTHROPIC_API_KEY;
            if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const systemMsg = messages.find(m => m.role === 'system');
            const chatMessages = messages.filter(m => m.role !== 'system');

            const body = {
                model,
                max_tokens: opts.maxTokens || parseInt(process.env.CLAUDE_MAX_TOKENS) || 4096,
                messages: chatMessages,
            };
            if (systemMsg) body.system = systemMsg.content;

            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(`Claude ${res.status}: ${err.error?.message || res.statusText}`);
            }
            const data = await res.json();
            return {
                content: data.content?.[0]?.text || '',
                model: data.model,
                provider: 'claude',
                usage: data.usage,
            };
        },
    },

    openai: {
        name: 'OpenAI (Business)',
        tier: 'diversity',
        costPerMTok: 2.5,  // GPT-4o — business seat may include credits
        latencyMs: 600,
        maxContext: 128000,
        envKey: 'OPENAI_API_KEY',
        models: {
            fast: 'gpt-4o-mini',
            quality: 'gpt-4o',
            default: 'gpt-4o',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) throw new Error('OPENAI_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model, messages,
                    max_tokens: opts.maxTokens || 4096,
                    temperature: opts.temperature ?? 0.7,
                }),
            });
            if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
            const data = await res.json();
            return {
                content: data.choices[0].message.content,
                model: data.model,
                provider: 'openai',
                usage: data.usage,
            };
        },
    },

    huggingface: {
        name: 'Hugging Face (Business)',
        tier: 'value',
        costPerMTok: 0,  // business seat includes inference
        latencyMs: 500,
        maxContext: 32000,
        envKey: 'HF_TOKEN',
        models: {
            fast: 'meta-llama/Llama-3.1-8B-Instruct',
            quality: 'meta-llama/Llama-3.1-70B-Instruct',
            default: 'meta-llama/Llama-3.1-70B-Instruct',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.HF_TOKEN || process.env.HF_API_KEY;
            if (!apiKey) throw new Error('HF_TOKEN not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const res = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model, messages,
                    max_tokens: opts.maxTokens || 4096,
                    temperature: opts.temperature ?? 0.7,
                    stream: false,
                }),
            });
            if (!res.ok) throw new Error(`HuggingFace ${res.status}: ${await res.text()}`);
            const data = await res.json();
            return {
                content: data.choices?.[0]?.message?.content || '',
                model,
                provider: 'huggingface',
                usage: data.usage || null,
            };
        },
    },
};

// ─── Inference Gateway ──────────────────────────────────────────
class InferenceGateway extends EventEmitter {
    constructor() {
        super();
        this.stats = { total: 0, byProvider: {}, errors: 0, raceModeWins: {} };
        this.circuitBreakers = {}; // provider -> { failures, lastFailure, open }
        this.CIRCUIT_THRESHOLD = 3; // failures before opening circuit
        this.CIRCUIT_RESET_MS = 60000; // 1 min reset
    }

    // Get available providers (key set + circuit closed)
    getAvailable() {
        const available = [];
        for (const [key, provider] of Object.entries(PROVIDERS)) {
            if (!process.env[provider.envKey]) continue;
            const cb = this.circuitBreakers[key];
            if (cb && cb.open && (Date.now() - cb.lastFailure < this.CIRCUIT_RESET_MS)) continue;
            available.push(key);
        }
        return available;
    }

    // Select optimal provider based on request context
    selectProvider(opts = {}) {
        const available = this.getAvailable();
        if (available.length === 0) throw new Error('No AI providers available');

        // Explicit provider request
        if (opts.provider && available.includes(opts.provider)) return opts.provider;

        // Task-based routing
        const complexity = opts.complexity || 5;
        const contextLength = opts.contextLength || 0;

        // Route based on strategy
        if (complexity <= 3 && available.includes('groq')) return 'groq';
        if (contextLength > 100000 && available.includes('gemini')) return 'gemini';
        if (opts.bulk && available.includes('gemini')) return 'gemini';
        if (opts.quality && available.includes('claude')) return 'claude';
        if (opts.battle) return null; // null = race mode

        // Default priority cascade: free/included → credits → paid API
        // Groq (free) → HF (business seat) → Gemini (GCloud $530) → OpenAI (business seat) → Claude (API $60)
        const priority = ['groq', 'huggingface', 'gemini', 'openai', 'claude'];
        return priority.find(p => available.includes(p)) || available[0];
    }

    // Single-provider completion
    async complete(messages, opts = {}) {
        const provider = this.selectProvider(opts);
        if (provider === null) return this.race(messages, opts);

        const start = Date.now();
        try {
            const result = await PROVIDERS[provider].complete(messages, opts);
            result.gatewayLatencyMs = Date.now() - start;
            this._recordSuccess(provider);
            this.emit('complete', { provider, latencyMs: result.gatewayLatencyMs });
            return result;
        } catch (err) {
            this._recordFailure(provider, err);
            // Fallback to next available
            const fallback = this.getAvailable().filter(p => p !== provider);
            if (fallback.length > 0) {
                logger.warn(`[InferenceGateway] ${provider} failed, falling back to ${fallback[0]}`, { error: err.message });
                return this.complete(messages, { ...opts, provider: fallback[0] });
            }
            throw err;
        }
    }

    // Race mode — fire at multiple providers, return fastest
    async race(messages, opts = {}) {
        const available = this.getAvailable();
        if (available.length === 0) throw new Error('No providers available for race');
        const racers = available.slice(0, Math.min(3, available.length)); // race up to 3

        logger.info(`[InferenceGateway] 🏁 Race mode: ${racers.join(' vs ')}`);
        const start = Date.now();

        const racePromises = racers.map(provider =>
            PROVIDERS[provider].complete(messages, { ...opts, tier: 'fast' })
                .then(result => {
                    result.gatewayLatencyMs = Date.now() - start;
                    result.raceWinner = true;
                    this._recordSuccess(provider);
                    return result;
                })
                .catch(err => {
                    this._recordFailure(provider, err);
                    return null; // don't reject, let others win
                })
        );

        // Promise.any — first non-null wins
        const results = await Promise.allSettled(racePromises);
        const winner = results.find(r => r.status === 'fulfilled' && r.value);
        if (!winner) throw new Error('All race participants failed');

        const result = winner.value;
        this.stats.raceModeWins[result.provider] = (this.stats.raceModeWins[result.provider] || 0) + 1;
        this.emit('race_complete', { winner: result.provider, latencyMs: result.gatewayLatencyMs, racers });
        return result;
    }

    // Battle mode — run all providers, return all results for comparison
    async battle(messages, opts = {}) {
        const available = this.getAvailable();
        logger.info(`[InferenceGateway] ⚔️ Battle mode: ${available.join(', ')}`);

        const results = await Promise.allSettled(
            available.map(provider =>
                PROVIDERS[provider].complete(messages, { ...opts, tier: 'quality' })
                    .then(result => ({ ...result, provider }))
            )
        );

        return results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
    }

    // Circuit breaker helpers
    _recordSuccess(provider) {
        this.stats.total++;
        this.stats.byProvider[provider] = (this.stats.byProvider[provider] || 0) + 1;
        this.circuitBreakers[provider] = { failures: 0, lastFailure: 0, open: false };
    }

    _recordFailure(provider, err) {
        this.stats.errors++;
        const cb = this.circuitBreakers[provider] || { failures: 0, lastFailure: 0, open: false };
        cb.failures++;
        cb.lastFailure = Date.now();
        if (cb.failures >= this.CIRCUIT_THRESHOLD) {
            cb.open = true;
            logger.error(`[InferenceGateway] Circuit OPEN for ${provider}`, { failures: cb.failures, error: err.message });
        }
        this.circuitBreakers[provider] = cb;
    }

    getStatus() {
        const providers = {};
        for (const [key, p] of Object.entries(PROVIDERS)) {
            const cb = this.circuitBreakers[key] || { failures: 0, open: false };
            providers[key] = {
                name: p.name,
                tier: p.tier,
                configured: !!process.env[p.envKey],
                circuitOpen: cb.open,
                failures: cb.failures,
                requests: this.stats.byProvider[key] || 0,
                costPerMTok: `$${p.costPerMTok}`,
                latencyEstMs: p.latencyMs,
                maxContext: p.maxContext,
            };
        }
        return {
            totalRequests: this.stats.total,
            errors: this.stats.errors,
            raceModeWins: this.stats.raceModeWins,
            providers,
        };
    }
}

// ─── Express Routes ─────────────────────────────────────────────
function registerGatewayRoutes(app, gateway) {
    // POST /api/ai/complete — intelligent routed completion
    app.post('/api/ai/complete', async (req, res) => {
        try {
            const { messages, provider, complexity, quality, battle, maxTokens, temperature } = req.body;
            if (!messages?.length) return res.status(400).json({ error: 'messages required' });

            const result = await gateway.complete(messages, { provider, complexity, quality, battle, maxTokens, temperature });
            res.json({ ok: true, ...result });
        } catch (err) {
            logger.error('[AI Gateway] Completion failed', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/ai/race — race mode (fastest wins)
    app.post('/api/ai/race', async (req, res) => {
        try {
            const { messages, maxTokens, temperature } = req.body;
            if (!messages?.length) return res.status(400).json({ error: 'messages required' });
            const result = await gateway.race(messages, { maxTokens, temperature });
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/ai/battle — all providers compete
    app.post('/api/ai/battle', async (req, res) => {
        try {
            const { messages, maxTokens, temperature } = req.body;
            if (!messages?.length) return res.status(400).json({ error: 'messages required' });
            const results = await gateway.battle(messages, { maxTokens, temperature });
            res.json({ ok: true, results, count: results.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/ai/status — gateway health & stats
    app.get('/api/ai/status', (req, res) => {
        res.json({ ok: true, ...gateway.getStatus() });
    });

    // GET /api/ai/providers — list configured providers
    app.get('/api/ai/providers', (req, res) => {
        const providers = {};
        for (const [key, p] of Object.entries(PROVIDERS)) {
            providers[key] = {
                name: p.name,
                tier: p.tier,
                configured: !!process.env[p.envKey],
                maxContext: p.maxContext,
                models: Object.entries(p.models).map(([tier, model]) => ({ tier, model })),
            };
        }
        res.json({ ok: true, providers });
    });

    logger.info('[AI Gateway] Routes registered: /api/ai/complete, /api/ai/race, /api/ai/battle, /api/ai/status, /api/ai/providers');
}

module.exports = { InferenceGateway, registerGatewayRoutes, PROVIDERS };
```
---

### `src/integrations/inference-gateway.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * AI Inference Gateway — Multi-provider, credit-aware, latency-optimized.
 *
 * Routes requests to the optimal AI provider based on:
 *   1. Task complexity & context window needs
 *   2. Credit balance / cost optimization
 *   3. Latency requirements
 *   4. Provider availability
 *
 * Priority order (burn free resources first):
 *   Groq (free/fast) → Gemini (GCloud credits) → Claude (membership/API) → OpenAI (fallback)
 *
 * Supports parallel "race" mode for instantaneous response.
 */
const EventEmitter = require('events');
const logger = require('./utils/logger');

// ─── Provider Definitions ───────────────────────────────────────
const PROVIDERS = {
    groq: {
        name: 'Groq',
        tier: 'speed',
        costPerMTok: 0,  // free tier
        latencyMs: 100,  // ultra-fast inference
        maxContext: 128000,
        envKey: 'GROQ_API_KEY',
        models: {
            fast: 'llama-3.1-70b-versatile',
            small: 'llama-3.1-8b-instant',
            default: 'llama-3.1-70b-versatile',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) throw new Error('GROQ_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model, messages,
                    max_tokens: opts.maxTokens || 4096,
                    temperature: opts.temperature ?? 0.7,
                    stream: false,
                }),
            });
            if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
            const data = await res.json();
            return {
                content: data.choices[0].message.content,
                model: data.model,
                provider: 'groq',
                usage: data.usage,
                latencyMs: data.usage?.total_time ? Math.round(data.usage.total_time * 1000) : null,
            };
        },
    },

    gemini: {
        name: 'Gemini (GCloud)',
        tier: 'credits',
        costPerMTok: 0.075, // paid via $530 GCloud credits
        latencyMs: 300,
        maxContext: 1000000, // 1M context window
        envKey: 'GOOGLE_API_KEY',
        models: {
            fast: 'gemini-2.0-flash',
            quality: 'gemini-1.5-pro',
            default: 'gemini-2.0-flash',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.GOOGLE_API_KEY;
            if (!apiKey) throw new Error('GOOGLE_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            // Convert OpenAI-style messages to Gemini format
            const contents = messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));
            // Extract system instruction
            const systemMsg = messages.find(m => m.role === 'system');
            const nonSystemContents = contents.filter((_, i) => messages[i].role !== 'system');

            const body = { contents: nonSystemContents, generationConfig: { maxOutputTokens: opts.maxTokens || 4096, temperature: opts.temperature ?? 0.7 } };
            if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return {
                content: text,
                model,
                provider: 'gemini',
                usage: data.usageMetadata || null,
            };
        },
    },

    claude: {
        name: 'Claude (Anthropic)',
        tier: 'quality',
        costPerMTok: 3.0,  // Sonnet pricing
        latencyMs: 800,
        maxContext: 200000,
        envKey: 'ANTHROPIC_API_KEY',
        models: {
            fast: 'claude-3-haiku-20240307',
            quality: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
            default: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
        },
        async complete(messages, opts = {}) {
            // Try secondary key first to save primary for interactive
            const apiKey = (opts.useSecondary && process.env.ANTHROPIC_SECONDARY_KEY)
                || process.env.ANTHROPIC_API_KEY;
            if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const systemMsg = messages.find(m => m.role === 'system');
            const chatMessages = messages.filter(m => m.role !== 'system');

            const body = {
                model,
                max_tokens: opts.maxTokens || parseInt(process.env.CLAUDE_MAX_TOKENS) || 4096,
                messages: chatMessages,
            };
            if (systemMsg) body.system = systemMsg.content;

            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(`Claude ${res.status}: ${err.error?.message || res.statusText}`);
            }
            const data = await res.json();
            return {
                content: data.content?.[0]?.text || '',
                model: data.model,
                provider: 'claude',
                usage: data.usage,
            };
        },
    },

    openai: {
        name: 'OpenAI (Business)',
        tier: 'diversity',
        costPerMTok: 2.5,  // GPT-4o — business seat may include credits
        latencyMs: 600,
        maxContext: 128000,
        envKey: 'OPENAI_API_KEY',
        models: {
            fast: 'gpt-4o-mini',
            quality: 'gpt-4o',
            default: 'gpt-4o',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) throw new Error('OPENAI_API_KEY not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model, messages,
                    max_tokens: opts.maxTokens || 4096,
                    temperature: opts.temperature ?? 0.7,
                }),
            });
            if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
            const data = await res.json();
            return {
                content: data.choices[0].message.content,
                model: data.model,
                provider: 'openai',
                usage: data.usage,
            };
        },
    },

    huggingface: {
        name: 'Hugging Face (Business)',
        tier: 'value',
        costPerMTok: 0,  // business seat includes inference
        latencyMs: 500,
        maxContext: 32000,
        envKey: 'HF_TOKEN',
        models: {
            fast: 'meta-llama/Llama-3.1-8B-Instruct',
            quality: 'meta-llama/Llama-3.1-70B-Instruct',
            default: 'meta-llama/Llama-3.1-70B-Instruct',
        },
        async complete(messages, opts = {}) {
            const apiKey = process.env.HF_TOKEN || process.env.HF_API_KEY;
            if (!apiKey) throw new Error('HF_TOKEN not set');
            const model = opts.model || this.models[opts.tier] || this.models.default;
            const res = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model, messages,
                    max_tokens: opts.maxTokens || 4096,
                    temperature: opts.temperature ?? 0.7,
                    stream: false,
                }),
            });
            if (!res.ok) throw new Error(`HuggingFace ${res.status}: ${await res.text()}`);
            const data = await res.json();
            return {
                content: data.choices?.[0]?.message?.content || '',
                model,
                provider: 'huggingface',
                usage: data.usage || null,
            };
        },
    },
};

// ─── Inference Gateway ──────────────────────────────────────────
class InferenceGateway extends EventEmitter {
    constructor() {
        super();
        this.stats = { total: 0, byProvider: {}, errors: 0, raceModeWins: {} };
        this.circuitBreakers = {}; // provider -> { failures, lastFailure, open }
        this.CIRCUIT_THRESHOLD = 3; // failures before opening circuit
        this.CIRCUIT_RESET_MS = 60000; // 1 min reset
    }

    // Get available providers (key set + circuit closed)
    getAvailable() {
        const available = [];
        for (const [key, provider] of Object.entries(PROVIDERS)) {
            if (!process.env[provider.envKey]) continue;
            const cb = this.circuitBreakers[key];
            if (cb && cb.open && (Date.now() - cb.lastFailure < this.CIRCUIT_RESET_MS)) continue;
            available.push(key);
        }
        return available;
    }

    // Select optimal provider based on request context
    selectProvider(opts = {}) {
        const available = this.getAvailable();
        if (available.length === 0) throw new Error('No AI providers available');

        // Explicit provider request
        if (opts.provider && available.includes(opts.provider)) return opts.provider;

        // Task-based routing
        const complexity = opts.complexity || 5;
        const contextLength = opts.contextLength || 0;

        // Route based on strategy
        if (complexity <= 3 && available.includes('groq')) return 'groq';
        if (contextLength > 100000 && available.includes('gemini')) return 'gemini';
        if (opts.bulk && available.includes('gemini')) return 'gemini';
        if (opts.quality && available.includes('claude')) return 'claude';
        if (opts.battle) return null; // null = race mode

        // Default priority cascade: free/included → credits → paid API
        // Groq (free) → HF (business seat) → Gemini (GCloud $530) → OpenAI (business seat) → Claude (API $60)
        const priority = ['groq', 'huggingface', 'gemini', 'openai', 'claude'];
        return priority.find(p => available.includes(p)) || available[0];
    }

    // Single-provider completion
    async complete(messages, opts = {}) {
        const provider = this.selectProvider(opts);
        if (provider === null) return this.race(messages, opts);

        const start = Date.now();
        try {
            const result = await PROVIDERS[provider].complete(messages, opts);
            result.gatewayLatencyMs = Date.now() - start;
            this._recordSuccess(provider);
            this.emit('complete', { provider, latencyMs: result.gatewayLatencyMs });
            return result;
        } catch (err) {
            this._recordFailure(provider, err);
            // Fallback to next available
            const fallback = this.getAvailable().filter(p => p !== provider);
            if (fallback.length > 0) {
                logger.warn(`[InferenceGateway] ${provider} failed, falling back to ${fallback[0]}`, { error: err.message });
                return this.complete(messages, { ...opts, provider: fallback[0] });
            }
            throw err;
        }
    }

    // Race mode — fire at multiple providers, return fastest
    async race(messages, opts = {}) {
        const available = this.getAvailable();
        if (available.length === 0) throw new Error('No providers available for race');
        const racers = available.slice(0, Math.min(3, available.length)); // race up to 3

        logger.info(`[InferenceGateway] 🏁 Race mode: ${racers.join(' vs ')}`);
        const start = Date.now();

        const racePromises = racers.map(provider =>
            PROVIDERS[provider].complete(messages, { ...opts, tier: 'fast' })
                .then(result => {
                    result.gatewayLatencyMs = Date.now() - start;
                    result.raceWinner = true;
                    this._recordSuccess(provider);
                    return result;
                })
                .catch(err => {
                    this._recordFailure(provider, err);
                    return null; // don't reject, let others win
                })
        );

        // Promise.any — first non-null wins
        const results = await Promise.allSettled(racePromises);
        const winner = results.find(r => r.status === 'fulfilled' && r.value);
        if (!winner) throw new Error('All race participants failed');

        const result = winner.value;
        this.stats.raceModeWins[result.provider] = (this.stats.raceModeWins[result.provider] || 0) + 1;
        this.emit('race_complete', { winner: result.provider, latencyMs: result.gatewayLatencyMs, racers });
        return result;
    }

    // Battle mode — run all providers, return all results for comparison
    async battle(messages, opts = {}) {
        const available = this.getAvailable();
        logger.info(`[InferenceGateway] ⚔️ Battle mode: ${available.join(', ')}`);

        const results = await Promise.allSettled(
            available.map(provider =>
                PROVIDERS[provider].complete(messages, { ...opts, tier: 'quality' })
                    .then(result => ({ ...result, provider }))
            )
        );

        return results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
    }

    // Circuit breaker helpers
    _recordSuccess(provider) {
        this.stats.total++;
        this.stats.byProvider[provider] = (this.stats.byProvider[provider] || 0) + 1;
        this.circuitBreakers[provider] = { failures: 0, lastFailure: 0, open: false };
    }

    _recordFailure(provider, err) {
        this.stats.errors++;
        const cb = this.circuitBreakers[provider] || { failures: 0, lastFailure: 0, open: false };
        cb.failures++;
        cb.lastFailure = Date.now();
        if (cb.failures >= this.CIRCUIT_THRESHOLD) {
            cb.open = true;
            logger.error(`[InferenceGateway] Circuit OPEN for ${provider}`, { failures: cb.failures, error: err.message });
        }
        this.circuitBreakers[provider] = cb;
    }

    getStatus() {
        const providers = {};
        for (const [key, p] of Object.entries(PROVIDERS)) {
            const cb = this.circuitBreakers[key] || { failures: 0, open: false };
            providers[key] = {
                name: p.name,
                tier: p.tier,
                configured: !!process.env[p.envKey],
                circuitOpen: cb.open,
                failures: cb.failures,
                requests: this.stats.byProvider[key] || 0,
                costPerMTok: `$${p.costPerMTok}`,
                latencyEstMs: p.latencyMs,
                maxContext: p.maxContext,
            };
        }
        return {
            totalRequests: this.stats.total,
            errors: this.stats.errors,
            raceModeWins: this.stats.raceModeWins,
            providers,
        };
    }
}

// ─── Express Routes ─────────────────────────────────────────────
function registerGatewayRoutes(app, gateway) {
    // POST /api/ai/complete — intelligent routed completion
    app.post('/api/ai/complete', async (req, res) => {
        try {
            const { messages, provider, complexity, quality, battle, maxTokens, temperature } = req.body;
            if (!messages?.length) return res.status(400).json({ error: 'messages required' });

            const result = await gateway.complete(messages, { provider, complexity, quality, battle, maxTokens, temperature });
            res.json({ ok: true, ...result });
        } catch (err) {
            logger.error('[AI Gateway] Completion failed', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/ai/race — race mode (fastest wins)
    app.post('/api/ai/race', async (req, res) => {
        try {
            const { messages, maxTokens, temperature } = req.body;
            if (!messages?.length) return res.status(400).json({ error: 'messages required' });
            const result = await gateway.race(messages, { maxTokens, temperature });
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/ai/battle — all providers compete
    app.post('/api/ai/battle', async (req, res) => {
        try {
            const { messages, maxTokens, temperature } = req.body;
            if (!messages?.length) return res.status(400).json({ error: 'messages required' });
            const results = await gateway.battle(messages, { maxTokens, temperature });
            res.json({ ok: true, results, count: results.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/ai/status — gateway health & stats
    app.get('/api/ai/status', (req, res) => {
        res.json({ ok: true, ...gateway.getStatus() });
    });

    // GET /api/ai/providers — list configured providers
    app.get('/api/ai/providers', (req, res) => {
        const providers = {};
        for (const [key, p] of Object.entries(PROVIDERS)) {
            providers[key] = {
                name: p.name,
                tier: p.tier,
                configured: !!process.env[p.envKey],
                maxContext: p.maxContext,
                models: Object.entries(p.models).map(([tier, model]) => ({ tier, model })),
            };
        }
        res.json({ ok: true, providers });
    });

    logger.info('[AI Gateway] Routes registered: /api/ai/complete, /api/ai/race, /api/ai/battle, /api/ai/status, /api/ai/providers');
}

module.exports = { InferenceGateway, registerGatewayRoutes, PROVIDERS };
```
---

### `src/core/heady-api-gateway-v2.js`

```javascript
/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * heady-api-gateway-v2.js
 * ════════════════════════════════════════════════════════════════════
 *
 * Heady API Gateway v2 — unified edge for all nine Heady domains.
 *
 * What this replaces / improves
 * ──────────────────────────────
 *   • headyapi-core (empty shell — only express dep)
 *   • source-map.json "notes": "gateway needs auth layer"
 *   • alive-software-architecture.md API surface (partial only)
 *   • heady-registry.json services[headyapi] hard-coded URLs
 *
 * Key capabilities
 * ────────────────
 *   ✓ API versioning  (/api/v1/* legacy, /api/v2/* current)
 *   ✓ JWT + API-key dual authentication
 *   ✓ Per-service, per-user rate limiting (sliding window, in-memory)
 *   ✓ CORS for all 9 Heady domains + localhost dev
 *   ✓ SSE (Server-Sent Events) endpoint for real-time pipeline updates
 *   ✓ Request validation middleware (JSON Schema via fast validator)
 *   ✓ Proxy routing through HeadyServiceMesh (circuit-breaking, LB)
 *   ✓ Observability: trace headers, Prometheus metrics, structured logs
 *   ✓ Admin router (/api/v1/admin/*) — gated by HMAC admin token
 *   ✓ Health / readiness probes (/health, /ready)
 *   ✓ GCP Pub/Sub webhook ingest (/webhooks/pubsub)
 *   ✓ Graceful shutdown with drain period
 *
 * Versioning policy
 * ──────────────────
 *   /api/v1/*  — Stable, maintained for backward compat. No new features.
 *   /api/v2/*  — Current, actively developed. New integrations go here.
 *   /api/v3/*  — Reserved for future breaking changes.
 *   /api/vN/*  — Unrecognised version → 404 with upgrade instructions.
 *
 * Nine Heady domains handled
 * ───────────────────────────
 *   headyme.com, headysystems.com, headyapi.com, headyconnection.org,
 *   headybuddy.org, headymcp.com, headyio.com, headybot.com, heady-ai.com
 *
 * Auth schemes
 * ─────────────
 *   Bearer <JWT>   — HS256 signed with gateway.jwtSecret (config server)
 *   X-Heady-Key    — SHA-256 HMAC API key (issued per service/user)
 *   X-Admin-Token  — Admin HMAC token (heady-service-mesh compatible)
 *   Public routes  — explicitly whitelisted, no auth required
 *
 * Rate limits (default, all configurable via config server)
 * ──────────────────────────────────────────────────────────
 *   Anonymous    :   60 req / 60 s per IP
 *   Authenticated: 1000 req / 60 s per identity
 *   Admin routes :  200 req / 60 s per identity
 *   Pipeline SSE :   10 concurrent streams per identity
 *
 * Port
 * ────
 *   Reads from config server 'gateway.port' (default 8080 for Cloud Run).
 *
 * Usage
 * ─────
 *   const { createGateway } = require('./heady-api-gateway-v2');
 *   const gw = createGateway();
 *   await gw.start();
 *   // → Listening on port 8080
 *
 *   // Programmatic (embed in existing Express app):
 *   app.use(gw.router());
 *
 * ════════════════════════════════════════════════════════════════════
 */

'use strict';

const http         = require('http');
const https        = require('https');
const { URL }      = require('url');
const crypto       = require('crypto');
const EventEmitter = require('events');
const { pipeline } = require('stream');

// ─── φ constant ───────────────────────────────────────────────────────────────
const PHI = 1.6180339887;

// ─── All 9 Heady domains + canonical www variants ─────────────────────────────
const HEADY_DOMAINS = Object.freeze([
  'headyme.com',       'www.headyme.com',
  'headysystems.com',  'www.headysystems.com',
  'headyapi.com',      'www.headyapi.com',
  'headyconnection.org', 'www.headyconnection.org',
  'headybuddy.org',    'www.headybuddy.org',
  'headymcp.com',      'www.headymcp.com',
  'headyio.com',       'www.headyio.com',
  'headybot.com',      'www.headybot.com',
  'heady-ai.com',       'www.heady-ai.com',
  // Dev / local
  'localhost',
  '127.0.0.1',
]);

// ─── Supported API versions ───────────────────────────────────────────────────
const SUPPORTED_VERSIONS = Object.freeze(['v1', 'v2']);
const CURRENT_VERSION    = 'v2';
const LEGACY_VERSION     = 'v1';

// ─── Public (no-auth) routes by version ──────────────────────────────────────
const PUBLIC_ROUTES = Object.freeze({
  v1: [
    'GET /api/v1/health',
    'GET /api/v1/ready',
    'GET /api/v1/version',
    'POST /api/v1/auth/login',
    'POST /api/v1/auth/refresh',
    'POST /webhooks/pubsub',
  ],
  v2: [
    'GET /api/v2/health',
    'GET /api/v2/ready',
    'GET /api/v2/version',
    'POST /api/v2/auth/login',
    'POST /api/v2/auth/refresh',
    'GET /api/v2/obs/metrics',     // Prometheus scrape
    'POST /webhooks/pubsub',
  ],
});

// ─── Rate limit tiers ─────────────────────────────────────────────────────────
const RATE_TIERS = Object.freeze({
  anonymous:     { windowMs: 60_000, maxRequests: 60   },
  authenticated: { windowMs: 60_000, maxRequests: 1000 },
  admin:         { windowMs: 60_000, maxRequests: 200  },
  pipeline_sse:  { windowMs: 60_000, maxStreams: 10    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  In-memory rate limiter (sliding window, no external deps)
// ─────────────────────────────────────────────────────────────────────────────

class RateLimiter {
  constructor() {
    // key → { timestamps: number[], tier: string }
    this._windows = new Map();
    // Prune every φ × 60 s
    this._pruneTimer = setInterval(() => this._prune(), Math.round(PHI * 60_000));
    if (this._pruneTimer.unref) this._pruneTimer.unref();
  }

  /**
   * Check and record a request attempt.
   * @param {string} key        — identity (IP or user ID)
   * @param {string} tier       — 'anonymous' | 'authenticated' | 'admin'
   * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
   */
  check(key, tier = 'anonymous') {
    const config  = RATE_TIERS[tier] || RATE_TIERS.anonymous;
    const now     = Date.now();
    const entry   = this._windows.get(key) || { timestamps: [] };
    const cutoff  = now - config.windowMs;

    // Slide window
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    const allowed   = entry.timestamps.length < config.maxRequests;
    if (allowed) entry.timestamps.push(now);

    this._windows.set(key, entry);

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - entry.timestamps.length),
      resetMs:   entry.timestamps.length ? (entry.timestamps[0] + config.windowMs - now) : 0,
      limit:     config.maxRequests,
    };
  }

  _prune() {
    const now = Date.now();
    for (const [key, entry] of this._windows) {
      // Remove windows older than the longest tier window
      if (entry.timestamps.every((t) => now - t > 120_000)) {
        this._windows.delete(key);
      }
    }
  }

  stop() {
    clearInterval(this._pruneTimer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  JWT helpers (HS256, no external deps)
// ─────────────────────────────────────────────────────────────────────────────

function base64urlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

/**
 * Sign a JWT with HS256.
 * @param {Object} payload
 * @param {string} secret
 * @param {number} [expiresInS=3600]
 */
function signJwt(payload, secret, expiresInS = 3600) {
  const header  = base64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body    = base64urlEncode(Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInS,
  })));
  const sig = base64urlEncode(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

/**
 * Verify a JWT. Returns decoded payload or throws.
 */
function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format.');
  const [header, body, sig] = parts;
  const expected = base64urlEncode(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  );
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('JWT signature invalid.');
  }
  const payload = JSON.parse(base64urlDecode(body).toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT expired.');
  }
  return payload;
}

/**
 * Verify an API key (HMAC-SHA256: key = HMAC(secret, keyId)).
 */
function verifyApiKey(key, secret) {
  // Key format: <keyId>.<hmac>
  const sep = key.lastIndexOf('.');
  if (sep === -1) throw new Error('Invalid API key format.');
  const keyId  = key.substring(0, sep);
  const hmac   = key.substring(sep + 1);
  const expected = crypto.createHmac('sha256', secret).update(keyId).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
    throw new Error('Invalid API key.');
  }
  return { keyId };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HeadyApiGatewayV2
// ─────────────────────────────────────────────────────────────────────────────

class HeadyApiGatewayV2 extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._opts = {
      port:           opts.port           || parseInt(process.env.PORT || '8080', 10),
      jwtSecret:      opts.jwtSecret      || process.env.JWT_SECRET    || '',
      apiKeySecret:   opts.apiKeySecret   || process.env.API_KEY_SECRET || '',
      adminTokenHash: opts.adminTokenHash || process.env.ADMIN_TOKEN_HASH || '',
      trustProxy:     opts.trustProxy     !== false,
      enableCors:     opts.enableCors     !== false,
      enableRateLimit: opts.enableRateLimit !== false,
      enableAuth:     opts.enableAuth     !== false,
      serviceName:    opts.serviceName    || 'headyapi',
    };

    this._rateLimiter = new RateLimiter();
    this._sseClients  = new Map();   // traceId → res
    this._server      = null;
    this._started     = false;

    // Lazy-load singleton collaborators to avoid circular requires at module load
    this._mesh  = null;   // HeadyServiceMesh singleton
    this._obs   = null;   // HeadyObservability singleton
    this._cfg   = null;   // ConfigServer singleton
    this._bus   = null;   // HeadyEventBus singleton
  }

  // ── Lazy singleton accessors ──────────────────────────────────────────────────

  get mesh() {
    if (!this._mesh) {
      try { this._mesh = require('./heady-service-mesh').getServiceMesh(); }
      catch { /* optional dependency */ }
    }
    return this._mesh;
  }

  get obs() {
    if (!this._obs) {
      try { this._obs = require('./heady-observability').getObservability({ service: this._opts.serviceName }); }
      catch { /* optional dependency */ }
    }
    return this._obs;
  }

  get cfg() {
    if (!this._cfg) {
      try { this._cfg = require('./heady-config-server').getConfigServer(); }
      catch { /* optional dependency */ }
    }
    return this._cfg;
  }

  get bus() {
    if (!this._bus) {
      try { this._bus = require('./heady-event-bus').getEventBus(); }
      catch { /* optional dependency */ }
    }
    return this._bus;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async start() {
    if (this._started) return this;

    const express = require('express');
    const app = express();

    if (this._opts.trustProxy) app.set('trust proxy', 1);
    app.set('x-powered-by', false);
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // ── Observability middleware (first) ────────────────────────────────────
    if (this.obs) app.use(this.obs.requestMiddleware());

    // ── CORS ────────────────────────────────────────────────────────────────
    if (this._opts.enableCors) app.use(this._corsMiddleware());

    // ── Security headers ────────────────────────────────────────────────────
    app.use(this._securityHeaders());

    // ── Version router ──────────────────────────────────────────────────────
    app.use('/api', this._versionRouter());

    // ── Webhook ingress ─────────────────────────────────────────────────────
    app.use('/webhooks', this._webhookRouter());

    // ── Health probes (no version prefix — Cloud Run requires /) ───────────
    app.get('/health', (_req, res) => res.json({ status: 'ok', service: this._opts.serviceName, ts: Date.now() }));
    app.get('/ready',  (_req, res) => res.json({ status: 'ready', service: this._opts.serviceName }));
    app.get('/',       (_req, res) => res.json({
      name:     'Heady API Gateway',
      version:  CURRENT_VERSION,
      docs:     'https://headyapi.com/docs',
      github:   'https://github.com/heady-project/headyapi-core',
    }));

    // ── Observability error middleware (last) ───────────────────────────────
    if (this.obs) app.use(this.obs.errorMiddleware());

    // ── Unhandled routes ────────────────────────────────────────────────────
    app.use((req, res) => {
      res.status(404).json({
        error:   'Not Found',
        path:    req.path,
        hint:    `API routes live under /api/${CURRENT_VERSION}/. Check the docs at https://headyapi.com/docs`,
        traceId: req.headyTrace?.traceId || null,
      });
    });

    this._server = http.createServer(app);
    const port   = this.cfg ? this.cfg.get('gateway.port', this._opts.port) : this._opts.port;

    await new Promise((resolve, reject) => {
      this._server.listen(port, '0.0.0.0', (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    this._started = true;
    this.emit('gateway:started', { port });
    console.log(`[HeadyApiGatewayV2] Listening on port ${port}`);
    return this;
  }

  async stop() {
    if (!this._server) return;
    // Drain SSE clients
    for (const [, res] of this._sseClients) {
      try { res.end(); } catch { /* ignore */ }
    }
    this._sseClients.clear();
    this._rateLimiter.stop();

    await new Promise((resolve) => this._server.close(resolve));
    this._started = false;
    this.emit('gateway:stopped');
  }

  // ── CORS ───────────────────────────────────────────────────────────────────

  _corsMiddleware() {
    return (req, res, next) => {
      const origin = req.headers.origin || '';
      const allowed = HEADY_DOMAINS.some((d) => origin.includes(d)) || !origin;
      res.setHeader('Access-Control-Allow-Origin',  allowed ? (origin || '*') : 'null');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', [
        'Content-Type', 'Authorization', 'X-Heady-Key',
        'X-Heady-Trace-Id', 'X-Heady-Span-Id', 'X-Heady-Service',
        'X-Admin-Token', 'Cache-Control',
      ].join(', '));
      res.setHeader('Access-Control-Expose-Headers', 'X-Heady-Trace-Id, X-Heady-Span-Id');
      res.setHeader('Access-Control-Max-Age', String(Math.round(PHI * 3600))); // ~5820 s
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    };
  }

  // ── Security headers ───────────────────────────────────────────────────────

  _securityHeaders() {
    return (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('X-Heady-Gateway', `v${CURRENT_VERSION}`);
      next();
    };
  }

  // ── Version router ─────────────────────────────────────────────────────────

  _versionRouter() {
    const express = require('express');
    const router  = express.Router();

    // Version detection
    router.use('/:version/*', (req, res, next) => {
      const { version } = req.params;
      if (!SUPPORTED_VERSIONS.includes(version)) {
        return res.status(404).json({
          error:     `API version '${version}' is not supported.`,
          supported: SUPPORTED_VERSIONS,
          current:   CURRENT_VERSION,
          upgrade:   `https://headyapi.com/docs/migration/${version}-to-${CURRENT_VERSION}`,
        });
      }
      req.apiVersion = version;
      next();
    });

    // Mount versioned routers
    router.use('/v1', this._authMiddleware(), this._rateLimitMiddleware('authenticated'), this._v1Router());
    router.use('/v2', this._authMiddleware(), this._rateLimitMiddleware('authenticated'), this._v2Router());

    return router;
  }

  // ── Auth middleware ────────────────────────────────────────────────────────

  _authMiddleware() {
    return (req, res, next) => {
      if (!this._opts.enableAuth) { req.auth = { anonymous: true }; return next(); }

      const version  = req.apiVersion || 'v2';
      const routeKey = `${req.method} ${req.path}`;

      // Check if route is public
      const publicRoutes = [...(PUBLIC_ROUTES[version] || []), ...(PUBLIC_ROUTES.v2)];
      const isPublic = publicRoutes.some((r) => {
        const [m, p] = r.split(' ');
        return (m === req.method || m === '*') && req.originalUrl.startsWith(p);
      });

      if (isPublic) { req.auth = { anonymous: true }; return next(); }

      // Try JWT
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const secret = this.cfg ? this.cfg.get('gateway.jwtSecret', this._opts.jwtSecret) : this._opts.jwtSecret;
        if (!secret) {
          return res.status(500).json({ error: 'JWT secret not configured. Set gateway.jwtSecret.' });
        }
        try {
          const payload = verifyJwt(token, secret);
          req.auth = { type: 'jwt', userId: payload.sub, roles: payload.roles || [], payload };
          return next();
        } catch (err) {
          return res.status(401).json({ error: 'JWT invalid.', detail: err.message, traceId: req.headyTrace?.traceId });
        }
      }

      // Try API key
      const apiKey = req.headers['x-heady-key'] || '';
      if (apiKey) {
        const secret = this.cfg ? this.cfg.get('gateway.jwtSecret', this._opts.apiKeySecret) : this._opts.apiKeySecret;
        try {
          const { keyId } = verifyApiKey(apiKey, secret || 'heady-default-key-secret-change-in-prod');
          req.auth = { type: 'apikey', keyId, roles: ['service'] };
          return next();
        } catch (err) {
          return res.status(401).json({ error: 'API key invalid.', detail: err.message, traceId: req.headyTrace?.traceId });
        }
      }

      // Admin token (checked separately from regular auth)
      const adminToken = req.headers['x-admin-token'] || '';
      if (adminToken && req.path.startsWith('/admin')) {
        const expectedHash = this.cfg
          ? this.cfg.get('gateway.adminTokenHash', this._opts.adminTokenHash)
          : this._opts.adminTokenHash;
        const actualHash = crypto.createHash('sha256').update(adminToken).digest('hex');
        if (expectedHash && crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash))) {
          req.auth = { type: 'admin', roles: ['admin', 'service'] };
          return next();
        }
        return res.status(403).json({ error: 'Admin token invalid.' });
      }

      // No credentials provided
      return res.status(401).json({
        error:   'Authentication required.',
        schemes: ['Bearer <JWT>', 'X-Heady-Key: <api-key>'],
        docs:    'https://headyapi.com/docs/auth',
        traceId: req.headyTrace?.traceId || null,
      });
    };
  }

  // ── Rate limit middleware ──────────────────────────────────────────────────

  _rateLimitMiddleware(defaultTier = 'authenticated') {
    return (req, res, next) => {
      if (!this._opts.enableRateLimit) return next();

      const tier     = req.auth?.roles?.includes('admin') ? 'admin' : (req.auth?.anonymous ? 'anonymous' : defaultTier);
      const identity = req.auth?.userId || req.auth?.keyId || req.ip || 'unknown';
      const result   = this._rateLimiter.check(identity, tier);

      res.setHeader('X-RateLimit-Limit',     String(result.limit));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset',     String(Math.ceil(result.resetMs / 1000)));

      if (!result.allowed) {
        this.obs?.metrics.counter('heady_http_requests_total').inc({
          service: this._opts.serviceName, method: req.method, path: req.path, status_code: '429',
        });
        return res.status(429).json({
          error:      'Rate limit exceeded.',
          tier,
          resetInMs:  result.resetMs,
          retryAfter: Math.ceil(result.resetMs / 1000),
          traceId:    req.headyTrace?.traceId || null,
        });
      }
      next();
    };
  }

  // ── v1 Router (legacy, read-only stable surface) ──────────────────────────

  _v1Router() {
    const express = require('express');
    const router  = express.Router();

    // Health
    router.get('/health',  (_req, res) => res.json({ status: 'ok',   version: 'v1', ts: Date.now() }));
    router.get('/ready',   (_req, res) => res.json({ status: 'ready', version: 'v1' }));
    router.get('/version', (_req, res) => res.json({
      current:  CURRENT_VERSION,
      version:  'v1',
      status:   'legacy',
      sunset:   '2027-01-01',
      docs:     'https://headyapi.com/docs/v1',
    }));

    // Pipeline run (v1 — proxied to v2 internally)
    router.post('/pipeline/run', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', '/api/v2/pipeline/run');
    });

    // Bees (v1 read-only)
    router.get('/bees', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', '/api/v2/bees');
    });
    router.get('/bees/:id', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', `/api/v2/bees/${req.params.id}`);
    });

    // Creative engine
    router.post('/creative/generate', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', '/api/v2/creative/generate');
    });

    // Vector memory (v1 — GET only)
    router.get('/memory/query', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', '/api/v2/memory/query');
    });

    // Deprecation warning header for ALL v1 routes
    router.use((_req, res, next) => {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
      res.setHeader('Link', '<https://headyapi.com/docs/migration/v1-to-v2>; rel="deprecation"');
      next();
    });

    return router;
  }

  // ── v2 Router (current, all features) ────────────────────────────────────

  _v2Router() {
    const express = require('express');
    const router  = express.Router();

    // ── Meta ───────────────────────────────────────────────────────────────
    router.get('/health',  (_req, res) => res.json({ status: 'ok',    version: 'v2', ts: Date.now() }));
    router.get('/ready',   (_req, res) => res.json({ status: 'ready', version: 'v2' }));
    router.get('/version', (_req, res) => res.json({
      name:     'Heady API Gateway',
      current:  CURRENT_VERSION,
      versions: SUPPORTED_VERSIONS,
      docs:     'https://headyapi.com/docs',
      email:    'eric@headyconnection.org',
    }));

    // ── Auth ───────────────────────────────────────────────────────────────
    router.post('/auth/login', express.json(), async (req, res) => {
      const { userId, password } = req.body || {};
      if (!userId) return res.status(400).json({ error: 'userId required.' });
      // In production: validate against PostgreSQL users table
      // For now: issue JWT with userId (password validation is caller's responsibility)
      const secret = this.cfg ? this.cfg.get('gateway.jwtSecret', this._opts.jwtSecret) : this._opts.jwtSecret;
      if (!secret) return res.status(500).json({ error: 'JWT secret not configured.' });
      const token = signJwt({ sub: userId, roles: ['user'] }, secret, 3600);
      res.json({ token, expiresIn: 3600, type: 'Bearer' });
    });

    router.post('/auth/refresh', (req, res) => {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Bearer token required.' });
      const secret = this.cfg ? this.cfg.get('gateway.jwtSecret', this._opts.jwtSecret) : this._opts.jwtSecret;
      try {
        const payload = verifyJwt(authHeader.slice(7), secret);
        const newToken = signJwt({ sub: payload.sub, roles: payload.roles }, secret, 3600);
        res.json({ token: newToken, expiresIn: 3600 });
      } catch (err) {
        res.status(401).json({ error: err.message });
      }
    });

    // ── Pipeline ───────────────────────────────────────────────────────────
    router.post('/pipeline/run', async (req, res) => {
      const traceId = req.headyTrace?.traceId;
      this.obs?.metrics.counter('heady_pipeline_runs_total').inc({ service: this._opts.serviceName, status: 'started' });
      this.bus?.publish('heady:pipeline:run:created', { traceId, body: req.body, userId: req.auth?.userId });
      return this._proxyToService(req, res, 'headyapi', '/api/v2/pipeline/run');
    });

    router.get('/pipeline/runs/:runId', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', `/api/v2/pipeline/runs/${req.params.runId}`);
    });

    router.delete('/pipeline/runs/:runId', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', `/api/v2/pipeline/runs/${req.params.runId}`);
    });

    // ── Pipeline SSE stream ────────────────────────────────────────────────
    router.get('/pipeline/stream/:runId', (req, res) => {
      const { runId } = req.params;
      const traceId  = req.headyTrace?.traceId || crypto.randomUUID();

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
      res.flushHeaders();

      const clientKey = `${traceId}:${runId}`;
      this._sseClients.set(clientKey, res);

      const sendEvent = (event, data) => {
        try {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch { /* client disconnected */ }
      };

      sendEvent('connected', { runId, traceId, ts: Date.now() });

      // Subscribe to pipeline events for this runId
      let unsubFn = null;
      if (this.bus) {
        unsubFn = this.bus.subscribe('heady:pipeline:run:*', (event) => {
          if (event.data?.runId === runId || event.data?.traceId === traceId) {
            sendEvent('pipeline:update', event.data);
          }
        });
      }

      req.on('close', () => {
        this._sseClients.delete(clientKey);
        if (unsubFn) unsubFn();
        res.end();
      });

      // Heartbeat to keep connection alive (every φ × 10 s)
      const heartbeat = setInterval(() => {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      }, Math.round(PHI * 10_000));

      req.on('close', () => clearInterval(heartbeat));
    });

    // ── Bees ──────────────────────────────────────────────────────────────
    router.get('/bees',        async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/bees'));
    router.post('/bees',       async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/bees'));
    router.get('/bees/:id',    async (req, res) => this._proxyToService(req, res, 'headyapi', `/api/v2/bees/${req.params.id}`));
    router.delete('/bees/:id', async (req, res) => this._proxyToService(req, res, 'headyapi', `/api/v2/bees/${req.params.id}`));
    router.post('/bees/:id/restart', async (req, res) => this._proxyToService(req, res, 'headyapi', `/api/v2/bees/${req.params.id}/restart`));

    // ── Vector memory ────────────────────────────────────────────────────
    router.post('/memory/ingest', async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/memory/ingest'));
    router.get('/memory/query',   async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/memory/query'));
    router.delete('/memory',      async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/memory'));

    // ── Creative engine ──────────────────────────────────────────────────
    router.post('/creative/generate', async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/creative/generate'));
    router.get('/creative/styles',    async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/creative/styles'));

    // ── Edge diffusion (image generation) ────────────────────────────────
    router.post('/image/generate', async (req, res) => this._proxyToService(req, res, 'heady-ai', '/api/v2/image/generate'));

    // ── MCP tools ────────────────────────────────────────────────────────
    router.get('/mcp/tools',               async (req, res) => this._proxyToService(req, res, 'headymcp', '/api/v2/mcp/tools'));
    router.post('/mcp/tools/:toolName/run', async (req, res) => this._proxyToService(req, res, 'headymcp', `/api/v2/mcp/tools/${req.params.toolName}/run`));

    // ── Buddy / sovereign orchestrator ────────────────────────────────────
    router.post('/buddy/task',          async (req, res) => this._proxyToService(req, res, 'headybuddy', '/api/v2/buddy/task'));
    router.get('/buddy/status',         async (req, res) => this._proxyToService(req, res, 'headybuddy', '/api/v2/buddy/status'));
    router.get('/buddy/metacognition',  async (req, res) => this._proxyToService(req, res, 'headybuddy', '/api/v2/buddy/metacognition'));

    // ── Self-awareness ────────────────────────────────────────────────────
    router.get('/awareness/status',     async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/awareness/status'));
    router.get('/awareness/telemetry',  async (req, res) => this._proxyToService(req, res, 'headyapi', '/api/v2/awareness/telemetry'));

    // ── Config (admin only) ───────────────────────────────────────────────
    router.use('/admin/config', this._adminAuthMiddleware(), (() => {
      try { return require('./heady-config-server').getConfigServer().router(); } catch { return (_r, res) => res.json({ error: 'Config server not available.' }); }
    })());

    // ── Service mesh (admin only) ─────────────────────────────────────────
    router.get('/admin/mesh', this._adminAuthMiddleware(), async (_req, res) => {
      try {
        const status = this.mesh ? await this.mesh.status() : { error: 'Mesh not available.' };
        res.json(status);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ── Observability ─────────────────────────────────────────────────────
    if (this.obs) {
      router.use('/obs', this.obs.router());
    } else {
      router.get('/obs/metrics', (_req, res) => res.status(503).json({ error: 'Observability not configured.' }));
    }

    // ── Event bus admin ───────────────────────────────────────────────────
    router.get('/admin/events/topics', this._adminAuthMiddleware(), (_req, res) => {
      const topics = this.bus ? this.bus.listTopics() : [];
      res.json({ topics });
    });

    // ── Ternary logic ─────────────────────────────────────────────────────
    router.post('/ternary/evaluate', async (req, res) => {
      return this._proxyToService(req, res, 'headyapi', '/api/v2/ternary/evaluate');
    });

    return router;
  }

  // ── Admin auth middleware ─────────────────────────────────────────────────

  _adminAuthMiddleware() {
    return (req, res, next) => {
      if (req.auth?.roles?.includes('admin')) return next();
      const adminToken = req.headers['x-admin-token'] || '';
      if (!adminToken) return res.status(403).json({ error: 'Admin token required.' });
      const expectedHash = this.cfg
        ? this.cfg.get('gateway.adminTokenHash', this._opts.adminTokenHash)
        : this._opts.adminTokenHash;
      if (!expectedHash) return res.status(500).json({ error: 'Admin token hash not configured.' });
      const actualHash = crypto.createHash('sha256').update(adminToken).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash))) {
        return res.status(403).json({ error: 'Invalid admin token.' });
      }
      req.auth = { ...(req.auth || {}), roles: ['admin', 'service'] };
      next();
    };
  }

  // ── Webhook router ────────────────────────────────────────────────────────

  _webhookRouter() {
    const express = require('express');
    const router  = express.Router();

    // GCP Pub/Sub push subscription
    router.post('/pubsub', express.json(), async (req, res) => {
      const { message, subscription } = req.body || {};
      if (!message) return res.status(400).json({ error: 'Pub/Sub message required.' });

      try {
        const data = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
        const attributes = message.attributes || {};

        this.obs?.logger.info('PubSub message received', {
          subscription,
          messageId: message.messageId,
          topic:     attributes.topic,
          traceId:   req.headyTrace?.traceId,
        });

        // Publish to internal event bus
        if (this.bus) {
          const topic = attributes.eventType || 'heady:pubsub:message:received';
          await this.bus.publish(topic, { ...data, _pubsubMessageId: message.messageId, _subscription: subscription });
        }

        res.sendStatus(200); // ACK — prevents Pub/Sub redelivery
      } catch (err) {
        this.obs?.logger.error('PubSub message parse error', { error: err.message, traceId: req.headyTrace?.traceId });
        res.status(400).json({ error: 'Invalid Pub/Sub message payload.' });
      }
    });

    return router;
  }

  // ── Service proxy helper ──────────────────────────────────────────────────

  async _proxyToService(req, res, serviceName, targetPath) {
    // Resolve URL via service mesh if available, else use registry fallback
    let baseUrl;
    try {
      baseUrl = this.mesh ? await this.mesh.resolve(serviceName) : this._fallbackUrl(serviceName);
    } catch (err) {
      return res.status(503).json({
        error:   `Service '${serviceName}' unavailable.`,
        detail:  err.message,
        traceId: req.headyTrace?.traceId,
      });
    }

    const url = `${baseUrl}${targetPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

    const outHeaders = {
      'Content-Type':    'application/json',
      'X-Forwarded-For': req.ip,
      'X-Real-IP':       req.ip,
      ...( this.obs ? this.obs.tracer.injectHeaders({}) : {} ),
    };
    if (req.auth?.userId)  outHeaders['X-Heady-User']    = req.auth.userId;
    if (req.auth?.roles)   outHeaders['X-Heady-Roles']   = req.auth.roles.join(',');

    try {
      const parsed  = new URL(url);
      const mod     = parsed.protocol === 'https:' ? https : http;
      const reqOpts = {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   req.method,
        headers:  outHeaders,
        timeout:  30_000,
      };

      const proxyReq = mod.request(reqOpts, (proxyRes) => {
        res.status(proxyRes.statusCode);
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (!['transfer-encoding', 'connection'].includes(k.toLowerCase())) {
            res.setHeader(k, v);
          }
        }
        proxyRes.pipe(res);
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        if (!res.headersSent) {
          res.status(504).json({ error: 'Gateway timeout.', service: serviceName, traceId: req.headyTrace?.traceId });
        }
      });
      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.status(502).json({ error: 'Bad gateway.', detail: err.message, service: serviceName, traceId: req.headyTrace?.traceId });
        }
      });

      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        proxyReq.write(JSON.stringify(req.body));
      }
      proxyReq.end();

    } catch (err) {
      res.status(500).json({ error: 'Proxy error.', detail: err.message, traceId: req.headyTrace?.traceId });
    }
  }

  _fallbackUrl(serviceName) {
    const FALLBACK = {
      headyapi:     process.env.HEADY_API_URL     || 'https://heady-manager-609590223909.us-central1.run.app',
      headymcp:     process.env.HEADY_MCP_URL     || 'https://headymcp.com',
      headybuddy:   process.env.HEADY_BUDDY_URL   || 'https://headybuddy.org',
      heady-ai:      process.env.HEADY_AI_URL      || 'https://heady-ai.com',
      headyio:      process.env.HEADY_IO_URL      || 'https://headyio.com',
      headybot:     process.env.HEADY_BOT_URL     || 'https://headybot.com',
      headysystems: process.env.HEADY_SYSTEMS_URL || 'https://headysystems.com',
      headyme:      process.env.HEADY_ME_URL      || 'https://headyme.com',
      headyconnection: process.env.HEADY_CONNECTION_URL || 'https://headyconnection.org',
    };
    const url = FALLBACK[serviceName];
    if (!url) throw new Error(`No fallback URL for service '${serviceName}'.`);
    return url;
  }

  /**
   * Returns an Express router (for embedding in an existing app).
   */
  router() {
    const express = require('express');
    const router  = express.Router();
    router.use(this._corsMiddleware());
    router.use(this._securityHeaders());
    router.use('/api', this._versionRouter());
    router.use('/webhooks', this._webhookRouter());
    return router;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _instance = null;

/**
 * Returns the singleton HeadyApiGatewayV2 instance.
 */
function createGateway(opts) {
  if (!_instance) _instance = new HeadyApiGatewayV2(opts);
  return _instance;
}

function _resetGatewayForTests() {
  if (_instance) _instance.stop().catch(() => {});
  _instance = null;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  HeadyApiGatewayV2,
  createGateway,
  _resetGatewayForTests,
  signJwt,
  verifyJwt,
  verifyApiKey,
  HEADY_DOMAINS,
  SUPPORTED_VERSIONS,
  CURRENT_VERSION,
  LEGACY_VERSION,
  PUBLIC_ROUTES,
  RATE_TIERS,
  PHI,
};

// ─── Entrypoint ───────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const gw = createGateway({
      port:       parseInt(process.env.PORT || '8080', 10),
      enableAuth: process.env.NODE_ENV === 'production',
    });
    await gw.start();

    // Graceful shutdown
    const shutdown = async (sig) => {
      console.log(`[HeadyApiGatewayV2] ${sig} received — draining connections...`);
      await gw.stop();
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  })().catch((err) => { console.error(err); process.exit(1); });
}
```
---

### `src/api/payment-gateway.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Systems - Auth & Payment Gateway Integration
 * Wires Firebase Auth for identity and Stripe for subscription billing.
 */
const Stripe = (()=>{try{return require('stripe')}catch(e){return class{constructor(){this.checkout={sessions:{create:async()=>({url:'#'})}}};}}})();
const logger = require("../utils/logger");

class PaymentGateway {
    constructor() {
        // In production, loaded via PQC-rotated secrets
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');
        this.plans = {
            'pro': process.env.STRIPE_PRICE_PRO || 'price_mock_pro',
            'enterprise': process.env.STRIPE_PRICE_ENTERPRISE || 'price_mock_ent'
        };
    }

    async createCheckoutSession(userId, planType, successUrl, cancelUrl) {
        logger.logSystem(`💳 [Payment Gateway] Generating checkout for User:${userId} -> Plan:${planType}`);

        // Mock simulation for development
        if (process.env.NODE_ENV !== 'production' && !process.env.STRIPE_SECRET_KEY) {
            return { url: 'https://checkout.stripe.com/pay/mock_session_id_123' };
        }

        try {
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{ price: this.plans[planType], quantity: 1 }],
                mode: 'subscription',
                success_url: successUrl,
                cancel_url: cancelUrl,
                client_reference_id: userId
            });
            return { url: session.url };
        } catch (err) {
            logger.error(`🚨 [Payment Gateway] Failed to create checkout:`, err.message);
            throw err;
        }
    }

    async verifyWebhookSignature(payload, signature) {
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
        return this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    }
}

class AuthMiddleware {
    static requireProPlan(req, res, next) {
        const userRole = req.headers['x-user-role'] || 'free';
        if (userRole === 'pro' || userRole === 'enterprise') {
            next();
        } else {
            res.status(403).json({ error: "Heady Pro Subscription Required", upgrade_url: "/billing" });
        }
    }
}

module.exports = { PaymentGateway: new PaymentGateway(), AuthMiddleware };
```
---

### `src/core/csl-engine/csl-engine.js`

```javascript
/**
 * @fileoverview CSL Engine — Continuous Semantic Logic
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Core innovation: vector geometry as logical gates operating in 384-dimensional
 * (or 1536-dimensional) embedding space. All logic is geometric: alignment,
 * superposition, orthogonal projection, and cosine activation.
 *
 * Mathematical Foundation:
 *   - Domain: unit vectors in ℝᴰ, D ∈ {384, 1536}
 *   - Truth value: τ(a, b) = cos(θ) = (a·b) / (‖a‖·‖b‖) ∈ [-1, +1]
 *   - +1 = fully aligned (TRUE), 0 = orthogonal (UNKNOWN), -1 = antipodal (FALSE)
 *
 * References:
 *   - Birkhoff & von Neumann (1936): "The Logic of Quantum Mechanics"
 *   - Widdows (2003): "Orthogonal Negation in Vector Spaces" — ACL 2003
 *   - Grand et al. (2022): "Semantic projection" — Nature Human Behaviour
 *   - Fagin, Riegel, Gray (2024): "Foundations of reasoning with uncertainty" — PNAS
 *
 * @module csl-engine
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL techniques
 */

import { PHI, PSI, PHI_TEMPERATURE, CSL_THRESHOLDS, phiThreshold, EPSILON as PHI_EPSILON, adaptiveTemperature } from '../../shared/phi-math.js';

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default vector dimension for standard embedding models (e.g., all-MiniLM-L6-v2) */
const DEFAULT_DIM = 384;

/** Extended dimension for high-fidelity models (e.g., text-embedding-3-large) */
const LARGE_DIM = 1536;

/** Numerical epsilon: prevents division-by-zero and detects near-zero vectors.
 * Sourced from shared/phi-math.js PHI_EPSILON (same 1e-10 value, unified constant). */
const EPSILON = PHI_EPSILON; // from shared/phi-math.js

/** Threshold below which a vector is considered near-zero (degenerate) */
const ZERO_NORM_THRESHOLD = 1e-8;

/** Default gate threshold τ for GATE operation.
 * CSL_THRESHOLDS.MINIMUM ≈ 0.500 — noise floor for geometric truth activation. */
const DEFAULT_GATE_THRESHOLD = CSL_THRESHOLDS.MINIMUM; // ≈ 0.500 (CSL noise floor)

/** Default temperature τ for soft gating / softmax operations.
 * PHI_TEMPERATURE = PSI^3 ≈ 0.236 — phi-harmonic softness. */
const DEFAULT_TEMPERATURE = PHI_TEMPERATURE; // PSI^3 ≈ 0.236

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Compute the L2 norm (Euclidean length) of a vector.
 *
 * Formula: ‖a‖ = √(Σᵢ aᵢ²)
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {number} L2 norm ≥ 0
 */
function norm(a) {
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length (project onto unit hypersphere Sᴰ⁻¹).
 *
 * Formula: â = a / ‖a‖
 *
 * Returns the zero vector if ‖a‖ < ZERO_NORM_THRESHOLD (degenerate case).
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {Float64Array} Unit vector, or zero vector if degenerate
 */
function normalize(a) {
  const n = norm(a);
  const result = new Float64Array(a.length);
  if (n < ZERO_NORM_THRESHOLD) {
    return result; // zero vector — caller should handle
  }
  const invN = 1.0 / n;
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * invN;
  }
  return result;
}

/**
 * Compute the dot product of two equal-length vectors.
 *
 * Formula: a·b = Σᵢ aᵢ·bᵢ
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {number} Scalar dot product
 * @throws {Error} If vectors have different lengths
 */
function dot(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Clamp a value to the interval [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Add two vectors element-wise and return a new Float64Array.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorAdd(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] + b[i];
  }
  return result;
}

/**
 * Subtract vector b from a element-wise.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorSub(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] - b[i];
  }
  return result;
}

/**
 * Scale a vector by a scalar.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {number} scalar
 * @returns {Float64Array}
 */
function vectorScale(a, scalar) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * scalar;
  }
  return result;
}

// ─── CSLEngine Class ──────────────────────────────────────────────────────────

/**
 * CSLEngine — Continuous Semantic Logic Engine
 *
 * Implements all CSL logical gates as pure geometric operations on high-dimensional
 * vectors. All operations work on raw (unnormalized) input vectors and handle
 * normalization internally unless otherwise noted.
 *
 * All gate methods:
 *   1. Accept Float32Array, Float64Array, or number[] inputs
 *   2. Return Float64Array for gate outputs (or number for scalar outputs)
 *   3. Include full numerical stability handling
 *   4. Support batch operation via the batch* prefix methods
 *
 * @class
 * @example
 * const engine = new CSLEngine({ dim: 384 });
 * const score = engine.AND(vectorA, vectorB);     // cosine similarity ∈ [-1,1]
 * const union = engine.OR(vectorA, vectorB);       // normalized superposition
 * const negated = engine.NOT(vectorA, vectorB);    // semantic negation
 */
class CSLEngine {
  /** Golden ratio constant — accessible on class for downstream phi-arithmetic */
  static PHI = PHI;
  /** Golden ratio conjugate (1/Φ = Φ-1) — accessible on class */
  static PSI = PSI;

  /**
   * @param {Object} [options]
   * @param {number} [options.dim=384] - Vector dimension
   * @param {number} [options.epsilon=1e-10] - Numerical stability epsilon
   * @param {number} [options.gateThreshold=0.0] - Default threshold τ for GATE
   * @param {number} [options.temperature=1.0] - Default temperature for soft gates
   * @param {boolean} [options.normalizeInputs=true] - Auto-normalize inputs
   */
  constructor(options = {}) {
    this.dim = options.dim || DEFAULT_DIM;
    this.epsilon = options.epsilon || EPSILON;
    this.gateThreshold = options.gateThreshold !== undefined
      ? options.gateThreshold
      : DEFAULT_GATE_THRESHOLD;
    this.temperature = options.temperature || DEFAULT_TEMPERATURE;
    this.normalizeInputs = options.normalizeInputs !== false;

    // Runtime statistics for monitoring
    this._stats = {
      operationCount: 0,
      degenerateVectors: 0,
      gateActivations: 0,
    };
  }

  // ─── Core Gate Operations ──────────────────────────────────────────────────

  /**
   * CSL AND — Measures semantic alignment between two concept vectors.
   *
   * Mathematical formula:
   *   AND(a, b) = cos(θ_{a,b}) = (a·b) / (‖a‖·‖b‖)
   *
   * Interpretation:
   *   - Result ∈ [-1, +1]
   *   - +1: concepts are fully aligned ("both true in the same direction")
   *   - 0:  concepts are orthogonal ("independent / no relationship")
   *   - -1: concepts are antipodal ("contradictory / one negates the other")
   *
   * Logical analogy: "a AND b is true" ↔ cos(a, b) close to +1.
   * This is the soft AND: high only when both concepts are co-aligned.
   *
   * Properties:
   *   - Commutative: AND(a,b) = AND(b,a)
   *   - Bounded: result ∈ [-1, +1]
   *   - Scale invariant: AND(λa, b) = AND(a, b) for λ > 0
   *
   * Reference: Birkhoff & von Neumann (1936), quantum logic inner product.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {number} Cosine similarity ∈ [-1, +1]
   */
  AND(a, b) {
    this._stats.operationCount++;
    const normA = norm(a);
    const normB = norm(b);

    if (normA < this.epsilon || normB < this.epsilon) {
      this._stats.degenerateVectors++;
      return 0.0; // degenerate: zero vectors are orthogonal to everything
    }

    const dotProduct = dot(a, b);
    return clamp(dotProduct / (normA * normB), -1.0, 1.0);
  }

  /**
   * CSL OR — Computes semantic superposition (soft union) of two concepts.
   *
   * Mathematical formula:
   *   OR(a, b) = normalize(a + b)
   *
   * The sum a + b creates a vector similar to both a and b — capturing the
   * "union" of semantic content. Normalization returns the result to the unit
   * sphere for subsequent operations.
   *
   * Interpretation:
   *   - The result vector points "between" a and b on the hypersphere
   *   - Its cosine similarity to both a and b is positive
   *   - For orthogonal a, b: result is at 45° to both (equal similarity)
   *   - For identical a = b: result is identical to a (idempotent in direction)
   *
   * Logical analogy: "a OR b" is the direction that captures either concept.
   *
   * Properties:
   *   - Commutative: OR(a,b) = OR(b,a)
   *   - Returns unit vector on Sᴰ⁻¹
   *   - Degenerate when a ≈ -b (antiparallel): returns zero vector
   *
   * Reference: HDC bundling operation; Boolean IR vector addition.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized superposition vector (unit length)
   */
  OR(a, b) {
    this._stats.operationCount++;
    const sum = vectorAdd(a, b);
    const n = norm(sum);

    if (n < this.epsilon) {
      this._stats.degenerateVectors++;
      // a ≈ -b: concepts cancel. Return zero vector to signal cancellation.
      return new Float64Array(a.length);
    }

    return vectorScale(sum, 1.0 / n);
  }

  /**
   * CSL NOT — Semantic negation via orthogonal projection.
   *
   * Mathematical formula:
   *   NOT(a, b) = a - proj_b(a) = a - (a·b / ‖b‖²) · b
   *
   * For unit vectors ‖b‖ = 1:
   *   NOT(a, b) = a - (a·b) · b
   *
   * The result is the component of a that is orthogonal to b — removing
   * the semantic content of b from a.
   *
   * Interpretation:
   *   - "NOT(a, b)" means "a, but not the part that overlaps with b"
   *   - Example: NOT(cat_vector, persian_vector) → cat vector minus Persian traits
   *   - The result has zero cosine similarity with b (by construction)
   *   - Residual magnitude: ‖NOT(a,b)‖ = ‖a‖·sin(θ_{a,b})
   *
   * Idempotency:
   *   NOT(NOT(a,b), b) ≈ NOT(a,b) because the result is already in b⊥.
   *   More precisely: the projection of NOT(a,b) onto b is ≈ 0, so subtracting
   *   proj_b again leaves it unchanged. (Full proof in csl-mathematical-proofs.md)
   *
   * Similarity after negation (for normalized a, b):
   *   a · NOT(a, b) = 1 - (a·b)²
   *
   * Reference: Widdows (2003), ACL 2003, "Orthogonal Negation in Vector Spaces"
   *
   * @param {Float32Array|Float64Array|number[]} a - Query/source vector
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate/remove
   * @param {boolean} [returnNormalized=true] - Whether to normalize the result
   * @returns {Float64Array} Vector with b's semantic content removed
   */
  NOT(a, b, returnNormalized = true) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      // b is near-zero: nothing to project out, return a (optionally normalized)
      return returnNormalized ? normalize(a) : new Float64Array(a);
    }

    // Projection coefficient: (a·b) / ‖b‖²
    const projCoeff = dot(a, b) / normBSq;

    // Remove projection: a - projCoeff·b
    const result = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] - projCoeff * b[i];
    }

    if (returnNormalized) {
      return normalize(result);
    }
    return result;
  }

  /**
   * CSL IMPLY — Geometric material implication via projection.
   *
   * Mathematical formula:
   *   IMPLY(a, b) = proj_b(a) = (a·b / ‖b‖²) · b
   *
   * For unit vectors:
   *   IMPLY(a, b) = (a·b) · b    [scalar times unit vector]
   *
   * The projection of a onto b captures "how much of a is contained in b" —
   * the geometric analog of material implication: degree to which a implies b.
   *
   * Interpretation:
   *   - Large projection → a strongly implies b (concepts highly co-directional)
   *   - Zero projection → a and b are independent (no implication)
   *   - Negative projection → a implies NOT b (antiparallel)
   *
   * Scalar implication strength: IMPLY_scalar(a,b) = a·b / ‖b‖ = cos(θ)·‖a‖
   *
   * Reference: Grand et al. (2022) semantic projection; Birkhoff-von Neumann.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent vector (hypothesis)
   * @param {Float32Array|Float64Array|number[]} b - Consequent vector (conclusion)
   * @returns {Float64Array} Projection of a onto span(b)
   */
  IMPLY(a, b) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      return new Float64Array(a.length); // zero consequent: no implication
    }

    const projCoeff = dot(a, b) / normBSq;
    return vectorScale(b, projCoeff);
  }

  /**
   * Scalar implication strength — returns the signed magnitude of implication.
   *
   * Formula: IMPLY_strength(a, b) = (a·b) / (‖a‖·‖b‖) = cos(θ_{a,b})
   *
   * Equivalent to AND(a, b) — the cosine similarity *is* the implication strength.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Implication strength ∈ [-1, +1]
   */
  IMPLY_scalar(a, b) {
    return this.AND(a, b);
  }

  /**
   * CSL XOR — Exclusive semantic content (symmetric difference).
   *
   * Mathematical formula:
   *   XOR(a, b) = normalize(a + b) - proj_mutual(a, b)
   *
   * More precisely, for unit vectors:
   *   XOR(a, b) = normalize( (a - proj_b(a)) + (b - proj_a(b)) )
   *             = normalize( a_⊥b + b_⊥a )
   *
   * Where a_⊥b is the component of a orthogonal to b (exclusive to a),
   * and b_⊥a is the component of b orthogonal to a (exclusive to b).
   *
   * Interpretation:
   *   - XOR captures what is unique to each concept (symmetric difference)
   *   - When a ≈ b: both exclusive components → 0, XOR → zero vector
   *   - When a ⊥ b: exclusive components = full vectors, XOR ≈ normalize(a + b)
   *   - "a XOR b" = concepts that appear in one but not both
   *
   * Properties:
   *   - Commutative: XOR(a,b) = XOR(b,a)
   *   - Anti-idempotent: XOR(a,a) → zero vector
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized exclusive semantic content
   */
  XOR(a, b) {
    this._stats.operationCount++;

    // a_⊥b: component of a orthogonal to b (NOT(a, b) unnormalized)
    const normBSq = dot(b, b);
    const normASq = dot(a, a);

    if (normASq < this.epsilon || normBSq < this.epsilon) {
      this._stats.degenerateVectors++;
      return new Float64Array(a.length);
    }

    const projAonB = dot(a, b) / normBSq;
    const projBonA = dot(a, b) / normASq; // Note: dot(b,a) = dot(a,b)

    // a_⊥b = a - proj_b(a)
    // b_⊥a = b - proj_a(b)
    const exclusive = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      const a_excl = a[i] - projAonB * b[i];
      const b_excl = b[i] - projBonA * a[i];
      exclusive[i] = a_excl + b_excl;
    }

    const n = norm(exclusive);
    if (n < this.epsilon) {
      return new Float64Array(a.length); // a ≈ b: no exclusive content
    }

    return vectorScale(exclusive, 1.0 / n);
  }

  /**
   * CSL CONSENSUS — Weighted mean of agent/concept vectors (agreement).
   *
   * Mathematical formula:
   *   CONSENSUS({aᵢ}, {wᵢ}) = normalize( Σᵢ wᵢ · aᵢ )
   *
   * Uniform weights (default):
   *   CONSENSUS({aᵢ}) = normalize( (1/n) Σᵢ aᵢ )
   *
   * Interpretation:
   *   - Result is the centroid direction on the unit hypersphere
   *   - ‖Σ wᵢaᵢ‖ before normalization measures consensus strength:
   *     → ≈ 1: strong agreement (vectors nearly aligned)
   *     → ≈ 0: strong disagreement (vectors cancel out)
   *   - Consensus Quality metric: R = ‖(1/n)Σaᵢ‖ ∈ [0,1]
   *
   * Properties:
   *   - Commutative: order of vectors doesn't matter
   *   - Weights must be non-negative (negative weights invert contribution)
   *   - Returns zero vector when agents completely disagree
   *
   * Reference: HDC bundling operation; Roundtable Policy (arXiv 2509.16839)
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors - Agent opinion vectors
   * @param {number[]} [weights] - Optional weights (uniform if omitted)
   * @returns {{ consensus: Float64Array, strength: number }}
   *   consensus: normalized consensus vector
   *   strength: R ∈ [0,1] measuring agreement level
   */
  CONSENSUS(vectors, weights = null) {
    this._stats.operationCount++;

    if (!vectors || vectors.length === 0) {
      throw new Error('CONSENSUS requires at least one vector');
    }

    const dim = vectors[0].length;
    const n = vectors.length;

    // Validate weights
    let w = weights;
    if (!w) {
      w = new Array(n).fill(1.0 / n);
    } else {
      if (w.length !== n) {
        throw new Error(`Weights length ${w.length} != vectors length ${n}`);
      }
      // Normalize weights to sum to 1
      const wSum = w.reduce((s, x) => s + x, 0);
      if (wSum < this.epsilon) {
        throw new Error('Weights must have positive sum');
      }
      w = w.map(x => x / wSum);
    }

    // Weighted sum
    const sum = new Float64Array(dim);
    for (let j = 0; j < n; j++) {
      const vec = vectors[j];
      const wj = w[j];
      for (let i = 0; i < dim; i++) {
        sum[i] += wj * vec[i];
      }
    }

    // Measure consensus strength before normalizing
    const strength = norm(sum);

    if (strength < this.epsilon) {
      this._stats.degenerateVectors++;
      return {
        consensus: new Float64Array(dim),
        strength: 0.0,
      };
    }

    const consensus = vectorScale(sum, 1.0 / strength);
    return { consensus, strength: clamp(strength, 0, 1) };
  }

  /**
   * CSL GATE — Threshold activation function using cosine similarity.
   *
   * Mathematical formula:
   *   GATE(input, gate_vector, τ) = θ( cos(input, gate_vector) - τ )
   *
   * Where θ is the Heaviside step function (hard gate) or sigmoid (soft gate):
   *   Hard:  GATE = 1  if cos(input, gate_vector) ≥ τ, else 0
   *   Soft:  GATE = σ( (cos(input, gate_vector) - τ) / temperature )
   *
   * The gate_vector defines a semantic "topic direction" in embedding space.
   * Inputs aligned with this direction (above threshold τ) pass the gate.
   *
   * Properties:
   *   - Bounded output: hard ∈ {0,1}, soft ∈ (0,1)
   *   - Scale invariant: GATE(λ·input, gate_vector, τ) = GATE(input, gate_vector, τ)
   *   - Differentiable (soft gate only)
   *   - Valid activation function: monotone, bounded, Lipschitz-continuous (soft)
   *
   * Proof that soft GATE is a valid activation function:
   *   (See csl-mathematical-proofs.md §4: CSL GATE Activation Properties)
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector to gate
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [threshold=0.0] - Threshold τ ∈ [-1, +1]
   * @param {'hard'|'soft'} [mode='hard'] - Hard (step) or soft (sigmoid) gate
   * @param {number} [temperature=1.0] - Temperature for soft gate sharpness
   * @returns {{ activation: number, cosScore: number }}
   *   activation: gate output ∈ {0,1} (hard) or (0,1) (soft)
   *   cosScore: raw cosine similarity before thresholding
   */
  GATE(input, gateVector, threshold = null, mode = 'hard', temperature = null) {
    this._stats.operationCount++;

    const tau = threshold !== null ? threshold : this.gateThreshold;
    const temp = temperature !== null ? temperature : this.temperature;

    const cosScore = this.AND(input, gateVector);
    const shifted = cosScore - tau;

    let activation;
    if (mode === 'hard') {
      activation = shifted >= 0 ? 1 : 0;
    } else {
      // Soft (sigmoid) gate: σ(x) = 1 / (1 + e^{-x/temp})
      activation = 1.0 / (1.0 + Math.exp(-shifted / temp));
    }

    if (activation > 0) this._stats.gateActivations++;

    return { activation, cosScore };
  }

  /**
   * CSL NAND — NOT AND: semantic incompatibility gate.
   *
   * Formula: NAND(a, b) = 1 - max(0, AND(a, b))
   *          Maps high alignment → low output; low alignment → high output.
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {number} NAND score ∈ [0, 1]
   */
  NAND(a, b) {
    const andScore = this.AND(a, b);
    return 1.0 - Math.max(0, andScore);
  }

  /**
   * CSL NOR — NOT OR: semantic exclusion gate.
   *
   * Returns normalized vector pointing away from the OR superposition.
   * Semantically: the concept that is distinct from both a and b.
   *
   * Formula: NOR(a,b) = normalize( -(a + b) )
   *                   = negate( OR(a, b) )
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {Float64Array} Antipodal to OR(a,b)
   */
  NOR(a, b) {
    this._stats.operationCount++;
    const orVec = this.OR(a, b);
    return vectorScale(orVec, -1.0);
  }

  // ─── Projection Utilities ──────────────────────────────────────────────────

  /**
   * Project vector a onto the subspace spanned by a set of basis vectors.
   *
   * Uses Gram-Schmidt orthogonalization for numerical stability.
   *
   * Formula: proj_B(a) = Σᵢ (a·eᵢ) eᵢ
   * where {eᵢ} is an orthonormal basis for span(B), computed via Gram-Schmidt.
   *
   * @param {Float32Array|Float64Array|number[]} a - Vector to project
   * @param {Array<Float32Array|Float64Array|number[]>} basisVectors - Spanning set
   * @returns {Float64Array} Projection of a onto span(basisVectors)
   */
  projectOntoSubspace(a, basisVectors) {
    if (!basisVectors || basisVectors.length === 0) {
      return new Float64Array(a.length);
    }

    const dim = a.length;
    // Gram-Schmidt orthogonalization of basisVectors
    const orthoBasis = [];

    for (let j = 0; j < basisVectors.length; j++) {
      let vec = new Float64Array(basisVectors[j]);

      // Remove components along existing orthobasis
      for (const e of orthoBasis) {
        const coeff = dot(vec, e);
        for (let i = 0; i < dim; i++) {
          vec[i] -= coeff * e[i];
        }
      }

      const n = norm(vec);
      if (n > this.epsilon) {
        const unitVec = vectorScale(vec, 1.0 / n);
        orthoBasis.push(unitVec);
      }
    }

    // Project a onto orthobasis
    const projection = new Float64Array(dim);
    for (const e of orthoBasis) {
      const coeff = dot(a, e);
      for (let i = 0; i < dim; i++) {
        projection[i] += coeff * e[i];
      }
    }

    return projection;
  }

  /**
   * NOT against a subspace (multiple semantic concepts removed simultaneously).
   *
   * Formula: NOT(a, B) = a - proj_B(a)
   *
   * Removes all semantic content in span{b₁,...,bₙ} from a.
   *
   * @param {Float32Array|Float64Array|number[]} a - Source vector
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Concepts to remove
   * @param {boolean} [returnNormalized=true]
   * @returns {Float64Array}
   */
  NOT_subspace(a, bVectors, returnNormalized = true) {
    this._stats.operationCount++;
    const projection = this.projectOntoSubspace(a, bVectors);
    const result = vectorSub(a, projection);
    return returnNormalized ? normalize(result) : result;
  }

  // ─── Batch Operations ──────────────────────────────────────────────────────

  /**
   * Batch AND — Compute cosine similarity of one vector against many.
   *
   * GPU-friendly: equivalent to a matrix-vector multiplication.
   * M[j] = a · B[j] / (‖a‖ · ‖B[j]‖) for each row B[j] in the matrix.
   *
   * @param {Float32Array|Float64Array|number[]} a - Query vector (1 × dim)
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Corpus vectors (n × dim)
   * @returns {Float64Array} Similarity scores (n,) ∈ [-1,+1]
   */
  batchAND(a, bVectors) {
    const normA = norm(a);
    if (normA < this.epsilon) {
      return new Float64Array(bVectors.length);
    }

    const result = new Float64Array(bVectors.length);
    for (let j = 0; j < bVectors.length; j++) {
      const normB = norm(bVectors[j]);
      if (normB < this.epsilon) {
        result[j] = 0.0;
        continue;
      }
      result[j] = clamp(dot(a, bVectors[j]) / (normA * normB), -1.0, 1.0);
    }
    return result;
  }

  /**
   * Batch NOT — Remove concept b from an array of source vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors - Source vectors
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate
   * @param {boolean} [returnNormalized=true]
   * @returns {Array<Float64Array>} Array of negated vectors
   */
  batchNOT(aVectors, b, returnNormalized = true) {
    return aVectors.map(a => this.NOT(a, b, returnNormalized));
  }

  /**
   * Batch GATE — Apply semantic gate to an array of input vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} inputs - Input vectors
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction
   * @param {number} [threshold=0.0] - Threshold τ
   * @param {'hard'|'soft'} [mode='hard']
   * @returns {Array<{ activation: number, cosScore: number }>}
   */
  batchGATE(inputs, gateVector, threshold = null, mode = 'hard') {
    return inputs.map(inp => this.GATE(inp, gateVector, threshold, mode));
  }

  /**
   * Batch IMPLY — Compute projection of each input onto the consequent.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {Array<Float64Array>} Projections
   */
  batchIMPLY(aVectors, b) {
    return aVectors.map(a => this.IMPLY(a, b));
  }

  // ─── Advanced Logical Compositions ────────────────────────────────────────

  /**
   * CSL CONDITIONAL — Soft conditional probability: P(b|a) via geometric Bayes.
   *
   * Formula: P(b|a) ≈ AND(a,b) / AND(a,a) = cos(a,b) / 1 = cos(a,b)
   *          [for normalized vectors, this reduces to AND]
   *
   * For asymmetric conditional, use the projection magnitude:
   *   P(b|a) ≈ ‖proj_b(a)‖ / ‖a‖ = |cos(a,b)|
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Conditional alignment ∈ [0, 1]
   */
  CONDITIONAL(a, b) {
    return Math.abs(this.AND(a, b));
  }

  /**
   * CSL ANALOGY — Completes an analogy: "a is to b as c is to ?"
   *
   * Formula: d = normalize( b - a + c )
   *   [vector arithmetic analogy, as in word2vec: king - man + woman ≈ queen]
   *
   * @param {Float32Array|Float64Array|number[]} a - Source concept
   * @param {Float32Array|Float64Array|number[]} b - Target concept
   * @param {Float32Array|Float64Array|number[]} c - Query concept
   * @returns {Float64Array} Analogy completion vector
   */
  ANALOGY(a, b, c) {
    this._stats.operationCount++;
    // d = normalize(b - a + c)
    const diff = vectorSub(b, a);
    const result = vectorAdd(diff, c);
    return normalize(result);
  }

  /**
   * Compute pairwise AND (cosine similarity matrix) for a set of vectors.
   *
   * Returns a symmetric matrix M where M[i][j] = cos(vectors[i], vectors[j]).
   * GPU-friendly: equivalent to normalized matrix multiplication V @ Vᵀ.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors
   * @returns {Float64Array[]} n×n cosine similarity matrix (row-major)
   */
  pairwiseAND(vectors) {
    const n = vectors.length;
    const norms = vectors.map(v => norm(v));

    // Pre-allocate n×n matrix as array of Float64Arrays
    const matrix = Array.from({ length: n }, () => new Float64Array(n));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0; // self-similarity
      for (let j = i + 1; j < n; j++) {
        const d = dot(vectors[i], vectors[j]);
        const normIJ = norms[i] * norms[j];
        const sim = normIJ < this.epsilon ? 0.0 : clamp(d / normIJ, -1.0, 1.0);
        matrix[i][j] = sim;
        matrix[j][i] = sim; // symmetric
      }
    }

    return matrix;
  }

  // ─── Statistics and Introspection ─────────────────────────────────────────

  /**
   * Retrieve runtime operation statistics.
   *
   * @returns {{ operationCount: number, degenerateVectors: number, gateActivations: number }}
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Reset runtime statistics.
   */
  resetStats() {
    this._stats = { operationCount: 0, degenerateVectors: 0, gateActivations: 0 };
  }

  // ─── Phi-Harmonic Gate Extensions ───────────────────────────────────────────────

  /**
   * Phi-harmonic GATE — uses phiThreshold(level) from phi-math.js as threshold.
   *
   * phiThreshold(level) = 1 - PSI^level * 0.5:
   *   level=1 ≈ 0.691 (CSL LOW)
   *   level=2 ≈ 0.809 (CSL MEDIUM)
   *   level=3 ≈ 0.882 (CSL HIGH)
   *
   * Provides a geometrically scaled activation threshold aligned with
   * the sacred geometry resource allocation tiers.
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [level=2] - Phi threshold level (1–4)
   * @param {'hard'|'soft'} [mode='hard'] - Gate mode
   * @returns {{ activation: number, cosScore: number, threshold: number }}
   */
  phiGATE(input, gateVector, level = 2, mode = 'hard') {
    const threshold = phiThreshold(level); // e.g. level=2 ≈ 0.809 (MEDIUM)
    const result = this.GATE(input, gateVector, threshold, mode);
    return { ...result, threshold };
  }

  /**
   * Adaptive GATE — uses adaptiveTemperature(entropy, maxEntropy) for dynamic softness.
   *
   * Temperature = PSI^(1 + 2*(1 - H/Hmax)) from phi-math.js.
   * At max entropy (uniform distribution): temperature ≈ PSI (softest).
   * At zero entropy (deterministic):       temperature ≈ PSI^3 (sharpest = PHI_TEMPERATURE).
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} entropy - Current routing entropy H (nats)
   * @param {number} maxEntropy - Maximum possible entropy Hmax = log(numExperts)
   * @returns {{ activation: number, cosScore: number, temperature: number }}
   */
  adaptiveGATE(input, gateVector, entropy, maxEntropy) {
    const temperature = adaptiveTemperature(entropy, maxEntropy);
    const result = this.GATE(input, gateVector, null, 'soft', temperature);
    return { ...result, temperature };
  }

  /**
   * Validate that a vector has the expected dimension and no NaN/Inf values.
   *
   * @param {Float32Array|Float64Array|number[]} vector
   * @param {number} [expectedDim] - Expected dimension (defaults to this.dim)
   * @returns {{ valid: boolean, issues: string[] }}
   */
  validateVector(vector, expectedDim = null) {
    const issues = [];
    const dim = expectedDim || this.dim;

    if (!vector || vector.length === 0) {
      issues.push('Vector is empty or null');
    } else {
      if (vector.length !== dim) {
        issues.push(`Dimension mismatch: got ${vector.length}, expected ${dim}`);
      }

      let hasNaN = false;
      let hasInf = false;
      for (let i = 0; i < vector.length; i++) {
        if (Number.isNaN(vector[i])) hasNaN = true;
        if (!Number.isFinite(vector[i])) hasInf = true;
      }
      if (hasNaN) issues.push('Vector contains NaN values');
      if (hasInf) issues.push('Vector contains Inf values');

      const n = norm(vector);
      if (n < ZERO_NORM_THRESHOLD) {
        issues.push('Vector is near-zero (degenerate)');
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  CSLEngine,
  // Export utility functions for external use
  norm,
  normalize,
  dot,
  clamp,
  vectorAdd,
  vectorSub,
  vectorScale,
  // Export constants
  DEFAULT_DIM,
  LARGE_DIM,
  EPSILON,
  ZERO_NORM_THRESHOLD,
};
```
---

### `src/shared/sacred-geometry.js`

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Sacred Geometry — shared/sacred-geometry.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Orchestration topology, node placement rings, coherence scoring,
 * Fibonacci resource allocation, and UI aesthetic constants.
 *
 * Every node, agent, and UI element follows geometric principles derived from φ.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { PHI, PSI, CSL_THRESHOLDS, fib, phiFusionWeights, poolAllocation } = require('./phi-math');
const { cslAND, normalize, add } = require('./csl-engine');

// ─── Node Topology ───────────────────────────────────────────────────────────

/**
 * Geometric ring topology for the 20 AI nodes.
 * Central → Inner → Middle → Outer → Governance
 */
const NODE_RINGS = Object.freeze({
  CENTRAL: {
    radius: 0,
    nodes: ['HeadySoul'],
    role: 'Awareness and values layer — origin point',
  },
  INNER: {
    radius: 1,
    nodes: ['HeadyBrains', 'HeadyConductor', 'HeadyVinci'],
    role: 'Processing core — orchestration, reasoning, planning',
  },
  MIDDLE: {
    radius: PHI,
    nodes: ['JULES', 'BUILDER', 'ATLAS', 'NOVA', 'HeadyLens', 'StoryDriver'],
    role: 'Execution layer — coding, building, monitoring, documentation',
  },
  OUTER: {
    radius: PHI * PHI,
    nodes: ['HeadyScientist', 'HeadyMC', 'PatternRecognition', 'SelfCritique',
            'SASHA', 'Imagination', 'HCSupervisor', 'HCBrain'],
    role: 'Specialized capabilities — research, simulation, creativity, supervision',
  },
  GOVERNANCE: {
    radius: PHI * PHI * PHI,
    nodes: ['HeadyQA', 'HeadyCheck', 'HeadyRisk'],
    role: 'Quality, assurance, risk — governance shell',
  },
});

/**
 * All 20 node names in canonical order (center-out).
 */
const ALL_NODES = Object.freeze(
  Object.values(NODE_RINGS).flatMap(ring => ring.nodes)
);

/**
 * Lookup which ring a node belongs to.
 * @param {string} nodeName
 * @returns {string|null} Ring name or null
 */
function nodeRing(nodeName) {
  for (const [ringName, ring] of Object.entries(NODE_RINGS)) {
    if (ring.nodes.includes(nodeName)) return ringName;
  }
  return null;
}

/**
 * Geometric distance between two nodes based on ring positions.
 * Nodes in the same ring have distance = ring angular separation.
 * Nodes in different rings have distance = ring radius difference.
 * @param {string} nodeA
 * @param {string} nodeB
 * @returns {number}
 */
function nodeDistance(nodeA, nodeB) {
  const ringA = nodeRing(nodeA);
  const ringB = nodeRing(nodeB);
  if (!ringA || !ringB) return Infinity;

  const rA = NODE_RINGS[ringA];
  const rB = NODE_RINGS[ringB];

  if (ringA === ringB) {
    // Same ring: angular distance based on position index
    const idxA = rA.nodes.indexOf(nodeA);
    const idxB = rA.nodes.indexOf(nodeB);
    const angularDist = Math.abs(idxA - idxB) / rA.nodes.length;
    return rA.radius * angularDist * 2 * Math.PI / rA.nodes.length;
  }

  // Different rings: radius difference + minimal angular correction
  return Math.abs(rA.radius - rB.radius);
}

// ─── Coherence Scoring ───────────────────────────────────────────────────────

const COHERENCE_THRESHOLDS = Object.freeze({
  HEALTHY:   CSL_THRESHOLDS.HIGH,     // ≈ 0.882 — normal operating range
  WARNING:   CSL_THRESHOLDS.MEDIUM,   // ≈ 0.809 — slight drift
  DEGRADED:  CSL_THRESHOLDS.LOW,      // ≈ 0.691 — significant drift
  CRITICAL:  CSL_THRESHOLDS.MINIMUM,  // ≈ 0.500 — system integrity at risk
});

/**
 * Compute coherence between two node state embeddings.
 * @param {Float64Array|number[]} stateA
 * @param {Float64Array|number[]} stateB
 * @returns {{ score: number, status: string }}
 */
function coherenceScore(stateA, stateB) {
  const score = cslAND(stateA, stateB);
  let status;
  if (score >= COHERENCE_THRESHOLDS.HEALTHY)   status = 'HEALTHY';
  else if (score >= COHERENCE_THRESHOLDS.WARNING)   status = 'WARNING';
  else if (score >= COHERENCE_THRESHOLDS.DEGRADED)  status = 'DEGRADED';
  else status = 'CRITICAL';
  return { score, status };
}

/**
 * Compute system-wide coherence by averaging all pairwise node scores.
 * @param {Map<string, Float64Array|number[]>} nodeStates - Map of node name → state vector
 * @returns {{ overall: number, status: string, drifted: string[] }}
 */
function systemCoherence(nodeStates) {
  const nodes = Array.from(nodeStates.keys());
  const drifted = [];
  let totalScore = 0;
  let pairCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const { score, status } = coherenceScore(
        nodeStates.get(nodes[i]),
        nodeStates.get(nodes[j])
      );
      totalScore += score;
      pairCount++;
      if (status === 'CRITICAL' || status === 'DEGRADED') {
        drifted.push(`${nodes[i]}<->${nodes[j]} (${score.toFixed(3)} ${status})`);
      }
    }
  }

  const overall = pairCount > 0 ? totalScore / pairCount : 0;
  let status;
  if (overall >= COHERENCE_THRESHOLDS.HEALTHY)  status = 'HEALTHY';
  else if (overall >= COHERENCE_THRESHOLDS.WARNING)  status = 'WARNING';
  else if (overall >= COHERENCE_THRESHOLDS.DEGRADED) status = 'DEGRADED';
  else status = 'CRITICAL';

  return { overall, status, drifted };
}

// ─── Pool Scheduling ─────────────────────────────────────────────────────────

/**
 * Hot/Warm/Cold pool definitions with Fibonacci resource ratios.
 */
const POOL_CONFIG = Object.freeze({
  HOT: {
    name: 'hot',
    purpose: 'User-facing, latency-critical tasks',
    resourcePct: fib(9),   // 34%
    maxConcurrency: fib(8), // 21
    timeoutMs: 5000,
    priority: 0,
  },
  WARM: {
    name: 'warm',
    purpose: 'Background processing, non-urgent tasks',
    resourcePct: fib(8),   // 21%
    maxConcurrency: fib(7), // 13
    timeoutMs: 30000,
    priority: 1,
  },
  COLD: {
    name: 'cold',
    purpose: 'Ingestion, analytics, batch processing',
    resourcePct: fib(7),   // 13%
    maxConcurrency: fib(6), // 8
    timeoutMs: 120000,
    priority: 2,
  },
  RESERVE: {
    name: 'reserve',
    purpose: 'Burst capacity for overload conditions',
    resourcePct: fib(6),   // 8%
    maxConcurrency: fib(5), // 5
    timeoutMs: 60000,
    priority: 3,
  },
  GOVERNANCE: {
    name: 'governance',
    purpose: 'Health checks, auditing, compliance',
    resourcePct: fib(5),   // 5%
    maxConcurrency: fib(4), // 3
    timeoutMs: 10000,
    priority: 4,
  },
});

/**
 * Assign a task to the appropriate pool based on priority and type.
 * @param {object} task
 * @param {string} task.type - 'user-facing' | 'background' | 'batch' | 'burst' | 'governance'
 * @param {number} [task.urgency=0.5] - 0–1 urgency score
 * @returns {string} Pool name
 */
function assignPool(task) {
  const urgency = task.urgency || 0.5;
  switch (task.type) {
    case 'user-facing': return 'HOT';
    case 'governance':  return 'GOVERNANCE';
    case 'burst':       return 'RESERVE';
    case 'batch':       return 'COLD';
    case 'background':
      return urgency >= CSL_THRESHOLDS.MEDIUM ? 'WARM' : 'COLD';
    default:
      return urgency >= CSL_THRESHOLDS.HIGH ? 'HOT' : 'WARM';
  }
}

// ─── UI Aesthetic Constants ──────────────────────────────────────────────────

const UI = Object.freeze({
  // Typography scale: φ-based
  TYPE_SCALE: {
    xs:    Math.round(16 / PHI / PHI),  // ≈ 6
    sm:    Math.round(16 / PHI),        // ≈ 10
    base:  16,
    lg:    Math.round(16 * PHI),        // ≈ 26
    xl:    Math.round(16 * PHI * PHI),  // ≈ 42
    '2xl': Math.round(16 * PHI * PHI * PHI), // ≈ 68
  },

  // Fibonacci spacing (px)
  SPACING: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89],

  // Layout ratios
  LAYOUT: {
    primaryWidth:   `${(PSI * 100).toFixed(2)}%`,      // ≈ 61.80%
    secondaryWidth: `${((1 - PSI) * 100).toFixed(2)}%`, // ≈ 38.20%
    goldenSection:  PSI,
  },

  // Color harmony: golden angle ≈ 137.508° for complementary hues
  GOLDEN_ANGLE: 360 / (PHI * PHI), // ≈ 137.508°

  // Brand colors
  COLORS: {
    primary:    '#6C63FF', // Heady Purple
    secondary:  '#FF6584', // Accent Pink
    success:    '#00C9A7', // Sacred Green
    warning:    '#FFB800', // Gold
    danger:     '#FF4757', // Alert Red
    background: '#0F0E17', // Deep Space
    surface:    '#1A1928', // Card Surface
    text:       '#FFFFFE', // Pure White
    muted:      '#94A1B2', // Muted
  },

  // Animation timing (phi-based easing)
  TIMING: {
    instant:  fib(4) * 10,  // 30ms
    fast:     fib(5) * 10,  // 50ms
    normal:   fib(7) * 10,  // 130ms
    slow:     fib(8) * 10,  // 210ms
    glacial:  fib(9) * 10,  // 340ms
  },
});

// ─── Bee Worker Limits ───────────────────────────────────────────────────────

const BEE_LIMITS = Object.freeze({
  maxConcurrentBees:  fib(8),  // 21
  maxQueueDepth:      fib(13), // 233
  beeTimeoutMs:       fib(9) * 1000, // 34 seconds
  maxRetries:         fib(5),  // 5
  healthCheckIntervalMs: fib(7) * 1000, // 13 seconds
  registryCapacity:   fib(10), // 55 registered bee types
});

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Topology
  NODE_RINGS, ALL_NODES, nodeRing, nodeDistance,

  // Coherence
  COHERENCE_THRESHOLDS, coherenceScore, systemCoherence,

  // Pool scheduling
  POOL_CONFIG, assignPool, poolAllocation,

  // UI aesthetics
  UI,

  // Bee limits
  BEE_LIMITS,
};
```
---

### `src/services/perplexity-research.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Perplexity Research Service — Real API Integration ═══
 *
 * Direct Sonar Pro API calls with:
 *   - Mode switching (quick/deep/academic/news)
 *   - Context injection from project state
 *   - Response → 3D vector memory persistence
 *   - Citation extraction
 *   - Cost tracking via budget-tracker
 */

const _logger = require("../utils/logger");
const logger = {
    logNodeActivity: _logger.logNodeActivity?.bind(_logger) || ((_n, msg) => (_logger.info || console.log)(msg)),
    logError: _logger.logError?.bind(_logger) || ((_n, msg) => (_logger.error || console.error)(msg)),
    logSystem: _logger.logSystem?.bind(_logger) || ((msg) => (_logger.info || console.log)(msg)),
};

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

// Mode → model mapping
const MODE_MAP = {
    quick: { model: "sonar", maxTokens: 4096, systemPrompt: "Provide a concise, accurate answer." },
    deep: { model: "sonar-pro", maxTokens: 16384, systemPrompt: "You are a deep research specialist. Provide thorough analysis with citations, evidence, and actionable recommendations." },
    academic: { model: "sonar-pro", maxTokens: 16384, systemPrompt: "You are an academic research specialist. Provide scholarly analysis with references to papers, standards, and formal methodologies." },
    news: { model: "sonar", maxTokens: 4096, systemPrompt: "You are a news research specialist. Focus on the most recent developments, announcements, and breaking news. Include dates and sources." },
};

class PerplexityResearchService {
    constructor(opts = {}) {
        this.apiKey = opts.apiKey || process.env.PERPLEXITY_API_KEY;
        this.vectorMemory = opts.vectorMemory || null;
        this.budgetTracker = opts.budgetTracker || null;
        this.stats = { totalQueries: 0, totalTokensUsed: 0, byMode: {}, errors: 0 };
    }

    /**
     * Execute a research query via the Perplexity Sonar API.
     * @param {object} params
     * @param {string} params.query - Research question
     * @param {string} params.mode - quick | deep | academic | news
     * @param {string} params.timeframe - all | day | week | month | year
     * @param {number} params.maxSources - Max citation URLs
     * @param {string} params.context - Optional project context to inject
     * @param {boolean} params.persist - Whether to persist results to vector memory (default: true)
     */
    async research({ query, mode = "deep", timeframe = "all", maxSources = 10, context = "", persist = true }) {
        if (!this.apiKey) {
            throw new Error("PERPLEXITY_API_KEY not configured. Set it in the SecureKeyVault or environment.");
        }

        const config = MODE_MAP[mode] || MODE_MAP.deep;
        const startTime = Date.now();

        // Build system prompt with optional context injection
        let systemPrompt = config.systemPrompt;
        if (context) {
            systemPrompt += `\n\nProject Context:\n${context}`;
        }
        if (timeframe !== "all") {
            const timeframeMap = { day: "the last 24 hours", week: "the past week", month: "the past month", year: "the past year" };
            systemPrompt += `\n\nFocus on information from ${timeframeMap[timeframe] || timeframe}.`;
        }

        // Call Perplexity API
        const response = await fetch(PERPLEXITY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: query },
                ],
                max_tokens: config.maxTokens,
                temperature: mode === "quick" ? 0.1 : 0.3,
            }),
            signal: AbortSignal.timeout(mode === "deep" || mode === "academic" ? 90000 : 30000),
        });

        if (!response.ok) {
            this.stats.errors++;
            const errText = await response.text().catch(() => "Unknown error");
            throw new Error(`Perplexity API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const latencyMs = Date.now() - startTime;

        // Extract the answer and citations
        const answer = data.choices?.[0]?.message?.content || "";
        const citations = data.citations || [];
        const tokensUsed = data.usage?.total_tokens || 0;

        // Update stats
        this.stats.totalQueries++;
        this.stats.totalTokensUsed += tokensUsed;
        this.stats.byMode[mode] = (this.stats.byMode[mode] || 0) + 1;

        // Track cost via budget tracker
        if (this.budgetTracker) {
            try {
                const provider = config.model.includes("pro") ? "perplexity-sonar-pro" : "perplexity-sonar";
                this.budgetTracker.trackUsage?.(provider, {
                    inputTokens: data.usage?.prompt_tokens || 0,
                    outputTokens: data.usage?.completion_tokens || 0,
                });
            } catch (e) { /* non-critical */ }
        }

        // Persist to 3D vector memory if available
        if (persist && this.vectorMemory) {
            try {
                const embedding = this._simpleEmbed(query);
                await this.vectorMemory.ingestMemory?.({
                    content: `[Research:${mode}] Q: ${query}\n\nA: ${answer.substring(0, 2000)}`,
                    embedding,
                    metadata: {
                        type: "research",
                        mode,
                        query,
                        citationCount: citations.length,
                        tokensUsed,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (e) {
                logger.logError("PERPLEXITY", `Vector persist failed: ${e.message}`, e);
            }
        }

        const result = {
            ok: true,
            service: "heady-perplexity-research",
            mode,
            model: config.model,
            query,
            answer,
            citations: citations.slice(0, maxSources),
            usage: {
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                totalTokens: tokensUsed,
            },
            latencyMs,
            persisted: persist && !!this.vectorMemory,
            timestamp: new Date().toISOString(),
        };

        logger.logNodeActivity("PERPLEXITY", `  🔍 Research [${mode}] "${query.substring(0, 60)}..." → ${tokensUsed} tokens, ${citations.length} citations, ${latencyMs}ms`);

        return result;
    }

    // Simple embedding for vector memory persistence (32-dim hash-based)
    _simpleEmbed(text) {
        const dims = 32;
        const vec = new Float32Array(dims);
        for (let i = 0; i < text.length; i++) {
            vec[i % dims] += text.charCodeAt(i) / 255;
        }
        const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
        return Array.from(vec).map(v => v / mag);
    }

    getStats() {
        return { ...this.stats, apiKeyConfigured: !!this.apiKey };
    }
}

/**
 * Register Perplexity research routes on Express app.
 * Replaces the stub from service-stubs.js.
 */
function registerPerplexityRoutes(app, opts = {}) {
    const service = new PerplexityResearchService(opts);

    // POST /api/perplexity/research — Main research endpoint
    app.post("/api/perplexity/research", async (req, res) => {
        try {
            const result = await service.research({
                query: req.body.query,
                mode: req.body.mode || "deep",
                timeframe: req.body.timeframe || "all",
                maxSources: req.body.maxSources || 10,
                context: req.body.context || "",
                persist: req.body.persist !== false,
            });
            res.json(result);
        } catch (err) {
            logger.logError("PERPLEXITY", `Research error: ${err.message}`, err);
            res.status(err.message.includes("not configured") ? 503 : 500).json({
                ok: false, service: "heady-perplexity-research",
                error: err.message, timestamp: new Date().toISOString(),
            });
        }
    });

    // POST /api/perplexity/search — Quick search alias
    app.post("/api/perplexity/search", async (req, res) => {
        try {
            const result = await service.research({
                query: req.body.query,
                mode: "quick",
                maxSources: req.body.maxSources || 5,
            });
            res.json(result);
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // GET /api/perplexity/health — Service health
    app.get("/api/perplexity/health", (req, res) => {
        res.json({
            ok: true, service: "heady-perplexity-research",
            ...service.getStats(), timestamp: new Date().toISOString(),
        });
    });

    logger.logSystem("  🔍 PerplexityResearch: LIVE → /api/perplexity/research (Sonar Pro direct API)");
    return service;
}

module.exports = { PerplexityResearchService, registerPerplexityRoutes };
```
---
