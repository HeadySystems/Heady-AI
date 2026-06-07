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
// ║  FILE: src/mcp/context7-adapter.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

/**
 * Context7 MCP Adapter — Streamable HTTP transport layer
 * Wraps the Context7 remote endpoint as a Heady-compatible MCP server.
 *
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */

const https = require('https');
const { URL } = require('url');
const logger = require('../utils/logger');

// ─── Phi-Math Constants ─────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ─── CSL Gate Thresholds ────────────────────────────────────────────────────
const CSL_GATES = {
  MINIMUM: 0.500,
  LOW: 0.691,
  MEDIUM: 0.809,
  HIGH: 0.882,
  CRITICAL: 0.927,
  DEDUP: 0.972,
};

// ─── Phi-Derived Configuration ──────────────────────────────────────────────
const CONTEXT7_ENDPOINT = 'https://mcp.context7.com/mcp';
// Note: FIB is 0-indexed: [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987]
// Index:                    0 1 2 3 4 5  6  7  8  9 10  11  12  13  14  15
const BACKOFF_BASE_MS = FIB[5] * 100;                  // 8 * 100 = 800ms
const BACKOFF_MAX_MS = FIB[10] * 100;                  // 89 * 100 = 8900ms
const MAX_ATTEMPTS = FIB[5];                           // 8
const LIB_CACHE_MAX = FIB[10];                         // 89
const LIB_CACHE_TTL = FIB[13] * 1000;                 // 377 * 1000 = 377000ms ≈ 6.28min
const DOC_CACHE_MAX = FIB[7];                          // 21
const DOC_CACHE_TTL = FIB[12] * 1000;                 // 233 * 1000 = 233000ms ≈ 3.88min
const CIRCUIT_RESET_MS = FIB[9] * 1000;               // 55 * 1000 = 55000ms
const HALF_OPEN_MAX = FIB[3];                          // 3
const REQUEST_TIMEOUT_MS = FIB[8] * 1000;              // 34 * 1000 = 34000ms

const log = logger.child ? logger.child({ component: 'context7-adapter' }) : logger;

// ─── LRU Cache ──────────────────────────────────────────────────────────────
class LRUCache {
  constructor(maxSize, ttlMs) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first key)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  get size() {
    return this.cache.size;
  }

  get hitRate() {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      hits: this.hits,
      misses: this.misses,
      hitRate: Number(this.hitRate.toFixed(4)),
    };
  }
}

// ─── Circuit Breaker ────────────────────────────────────────────────────────
const CIRCUIT_STATES = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half_open' };

class CircuitBreaker {
  constructor() {
    this.state = CIRCUIT_STATES.CLOSED;
    this.failures = 0;
    this.maxFailures = MAX_ATTEMPTS;             // FIB[6] = 8
    this.resetTimeoutMs = CIRCUIT_RESET_MS;      // FIB[9] * 1000 = 55000ms
    this.halfOpenMax = HALF_OPEN_MAX;             // FIB[4] = 3
    this.halfOpenAttempts = 0;
    this.lastFailureTime = 0;
    this.totalTrips = 0;
  }

  canExecute() {
    if (this.state === CIRCUIT_STATES.CLOSED) return true;
    if (this.state === CIRCUIT_STATES.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = CIRCUIT_STATES.HALF_OPEN;
        this.halfOpenAttempts = 0;
        log.info({ state: this.state }, 'Circuit breaker transitioning to half-open');
        return true;
      }
      return false;
    }
    // HALF_OPEN — allow limited attempts
    return this.halfOpenAttempts < this.halfOpenMax;
  }

  recordSuccess() {
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.halfOpenMax) {
        this.state = CIRCUIT_STATES.CLOSED;
        this.failures = 0;
        this.halfOpenAttempts = 0;
        log.info({ state: this.state }, 'Circuit breaker closed after recovery');
      }
    } else {
      this.failures = 0;
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.state = CIRCUIT_STATES.OPEN;
      this.totalTrips++;
      log.warn({ failures: this.failures, totalTrips: this.totalTrips }, 'Circuit breaker re-opened from half-open');
    } else if (this.failures >= this.maxFailures) {
      this.state = CIRCUIT_STATES.OPEN;
      this.totalTrips++;
      log.warn({ failures: this.failures, totalTrips: this.totalTrips }, 'Circuit breaker opened');
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      maxFailures: this.maxFailures,
      totalTrips: this.totalTrips,
      lastFailureTime: this.lastFailureTime,
      resetTimeoutMs: this.resetTimeoutMs,
      halfOpenAttempts: this.halfOpenAttempts,
      halfOpenMax: this.halfOpenMax,
    };
  }
}

// ─── Phi-Backoff ────────────────────────────────────────────────────────────
function phiBackoff(attempt) {
  const delay = Math.pow(PHI, attempt) * BACKOFF_BASE_MS;
  const capped = Math.min(delay, BACKOFF_MAX_MS);
  const jitter = capped * PSI * PSI * (Math.random() * 2 - 1); // ±38.2%
  return Math.max(BACKOFF_BASE_MS, Math.round(capped + jitter));
}

// ─── HTTP Transport ─────────────────────────────────────────────────────────
function makeJsonRpcRequest(method, params, apiKey) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(CONTEXT7_ENDPOINT);
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: `ctx7-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method,
      params,
    });

    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'HeadySystems-Context7Adapter/1.0.0',
      },
    };

    if (apiKey) {
      options.headers['CONTEXT7_API_KEY'] = apiKey;
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Context7 HTTP ${res.statusCode}: ${body.slice(0, 500)}`));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) {
            reject(new Error(`Context7 JSON-RPC error ${parsed.error.code}: ${parsed.error.message}`));
            return;
          }
          resolve(parsed.result);
        } catch (err) {
          reject(new Error(`Context7 response parse error: ${err.message}`));
        }
      });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(`Context7 request timeout after ${REQUEST_TIMEOUT_MS}ms`));
    });

    req.on('error', (err) => {
      reject(new Error(`Context7 network error: ${err.message}`));
    });

    req.write(payload);
    req.end();
  });
}

// ─── Context7Adapter Class ──────────────────────────────────────────────────
class Context7Adapter {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.CONTEXT7_API_KEY;
    if (!this.apiKey) {
      log.warn('CONTEXT7_API_KEY not set — requests may be rate-limited');
    }

    this.libraryCache = new LRUCache(LIB_CACHE_MAX, LIB_CACHE_TTL);
    this.docCache = new LRUCache(DOC_CACHE_MAX, DOC_CACHE_TTL);
    this.circuitBreaker = new CircuitBreaker();

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatencyMs: 0,
      resolutionCount: 0,
      queryCount: 0,
    };

    this.startTime = Date.now();
    log.info({
      endpoint: CONTEXT7_ENDPOINT,
      libCacheMax: LIB_CACHE_MAX,
      docCacheMax: DOC_CACHE_MAX,
      maxAttempts: MAX_ATTEMPTS,
    }, 'Context7Adapter initialized');
  }

  /**
   * Execute a request with circuit breaker and phi-backoff retry.
   */
  async _executeWithResilience(method, params, cacheStore, cacheKey) {
    // Check cache first
    if (cacheStore && cacheKey) {
      const cached = cacheStore.get(cacheKey);
      if (cached !== undefined) {
        log.debug({ method, cacheKey, cached: true }, 'Cache hit');
        return cached;
      }
    }

    if (!this.circuitBreaker.canExecute()) {
      const cbState = this.circuitBreaker.getState();
      throw new Error(`Circuit breaker OPEN — Context7 unavailable (${cbState.failures} failures, resets in ${Math.max(0, cbState.resetTimeoutMs - (Date.now() - cbState.lastFailureTime))}ms)`);
    }

    let lastError;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const start = Date.now();
      this.metrics.totalRequests++;

      try {
        const result = await makeJsonRpcRequest(method, params, this.apiKey);
        const latency = Date.now() - start;
        this.metrics.totalLatencyMs += latency;
        this.metrics.successfulRequests++;
        this.circuitBreaker.recordSuccess();

        // Store in cache
        if (cacheStore && cacheKey && result !== undefined) {
          cacheStore.set(cacheKey, result);
        }

        log.info({ method, latencyMs: latency, attempt }, 'Context7 request succeeded');
        return result;
      } catch (err) {
        lastError = err;
        this.metrics.failedRequests++;
        this.circuitBreaker.recordFailure();

        if (!this.circuitBreaker.canExecute()) {
          log.error({ method, attempt, error: err.message }, 'Circuit breaker opened, aborting retries');
          break;
        }

        if (attempt < MAX_ATTEMPTS - 1) {
          const backoffMs = phiBackoff(attempt);
          log.warn({ method, attempt, backoffMs, error: err.message }, 'Retrying with phi-backoff');
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }

    throw lastError || new Error(`Context7 ${method} failed after ${MAX_ATTEMPTS} attempts`);
  }

  /**
   * Resolve a library name to a Context7-compatible ID.
   * @param {string} name — Library name (e.g., "express", "react", "next.js")
   * @returns {Promise<Object>} — Resolved library with id, name, and metadata
   */
  async resolveLibrary(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Library name is required and must be a string');
    }

    const normalizedName = name.trim().toLowerCase();
    const cacheKey = `lib:${normalizedName}`;

    const result = await this._executeWithResilience(
      'tools/call',
      {
        name: 'resolve-library-id',
        arguments: { libraryName: normalizedName },
      },
      this.libraryCache,
      cacheKey
    );

    this.metrics.resolutionCount++;
    log.info({ name: normalizedName, resultId: result?.libraryId }, 'Library resolved');
    return result;
  }

  /**
   * Query documentation for a library by its Context7 ID.
   * @param {string} libraryId — Context7 library ID
   * @param {Object} options — Query options
   * @param {number} options.tokens — Max tokens for response (default FIB[13]=377)
   * @param {string} options.topic — Optional topic filter
   * @returns {Promise<Object>} — Documentation content
   */
  async queryDocs(libraryId, options = {}) {
    if (!libraryId || typeof libraryId !== 'string') {
      throw new Error('Library ID is required and must be a string');
    }

    const tokens = options.tokens || FIB[13]; // 377
    const topic = options.topic || undefined;
    const cacheKey = `doc:${libraryId}:${tokens}:${topic || 'all'}`;

    const params = {
      name: 'query-docs',
      arguments: { libraryId, tokens },
    };
    if (topic) {
      params.arguments.topic = topic;
    }

    const result = await this._executeWithResilience(
      'tools/call',
      params,
      this.docCache,
      cacheKey
    );

    this.metrics.queryCount++;
    log.info({ libraryId, tokens, hasDocs: !!result }, 'Docs queried');
    return result;
  }

  /**
   * Health check — ping Context7 with a known library.
   * @returns {Promise<Object>} — Health status with coherence score
   */
  async health() {
    const start = Date.now();
    const cbState = this.circuitBreaker.getState();

    try {
      // Ping with "express" as a known-good library
      await this.resolveLibrary('express');
      const latencyMs = Date.now() - start;

      // Compute coherence: healthy if latency is reasonable and circuit is closed
      const latencyFactor = Math.max(0, 1 - (latencyMs / (FIB[10] * 100))); // degrade over 8900ms
      const errorRate = this.metrics.totalRequests > 0
        ? this.metrics.failedRequests / this.metrics.totalRequests
        : 0;
      const coherence = Math.max(
        CSL_GATES.MINIMUM,
        (latencyFactor * PSI + (1 - errorRate) * (1 - PSI))
      );

      return {
        status: coherence >= CSL_GATES.MEDIUM ? 'healthy' : 'degraded',
        coherence: Number(coherence.toFixed(4)),
        latencyMs,
        circuitBreaker: cbState,
        caches: {
          libraries: this.libraryCache.getStats(),
          docs: this.docCache.getStats(),
        },
        uptime: Date.now() - this.startTime,
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        coherence: CSL_GATES.MINIMUM,
        error: err.message,
        circuitBreaker: cbState,
        caches: {
          libraries: this.libraryCache.getStats(),
          docs: this.docCache.getStats(),
        },
        uptime: Date.now() - this.startTime,
      };
    }
  }

  /**
   * Get adapter statistics.
   * @returns {Object} — Metrics, cache stats, circuit breaker state
   */
  getStats() {
    const avgLatency = this.metrics.successfulRequests > 0
      ? this.metrics.totalLatencyMs / this.metrics.successfulRequests
      : 0;

    return {
      metrics: {
        totalRequests: this.metrics.totalRequests,
        successfulRequests: this.metrics.successfulRequests,
        failedRequests: this.metrics.failedRequests,
        resolutionCount: this.metrics.resolutionCount,
        queryCount: this.metrics.queryCount,
        avgLatencyMs: Number(avgLatency.toFixed(2)),
      },
      caches: {
        libraries: this.libraryCache.getStats(),
        docs: this.docCache.getStats(),
      },
      circuitBreaker: this.circuitBreaker.getState(),
      uptime: Date.now() - this.startTime,
      phi: PHI,
      psi: PSI,
    };
  }

  /**
   * Clear all caches and reset metrics.
   */
  reset() {
    this.libraryCache.clear();
    this.docCache.clear();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatencyMs: 0,
      resolutionCount: 0,
      queryCount: 0,
    };
    log.info('Context7Adapter reset');
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────
module.exports = {
  Context7Adapter,
  LRUCache,
  CircuitBreaker,
  phiBackoff,
  CIRCUIT_STATES,
  // Expose constants for tests and downstream consumers
  PHI,
  PSI,
  FIB,
  CSL_GATES,
  CONTEXT7_ENDPOINT,
  LIB_CACHE_MAX,
  LIB_CACHE_TTL,
  DOC_CACHE_MAX,
  DOC_CACHE_TTL,
  MAX_ATTEMPTS,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
};
