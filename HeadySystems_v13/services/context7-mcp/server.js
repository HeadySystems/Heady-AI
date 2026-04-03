'use strict';

/**
 * Context7 MCP Service — HeadySystems_v13 Express microservice.
 * Port: 3371
 *
 * Routes:
 *   GET  /health  — service health + Context7 connection + cache + circuit breaker
 *   POST /resolve — resolve library name to Context7 ID
 *   POST /query   — query docs for a library ID
 *   POST /enrich  — extract libraries from task and return enriched context
 *   GET  /stats   — cache hit rates, latency percentiles, resolution counts
 *
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

// @heady/core imports (matching HeadySystems_v13 pattern)
const { createLogger, headyAutoContext, CSL_GATES, PHI } = require('@heady/core');

// ─── Phi-Math Constants ─────────────────────────────────────────────────────
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ─── Service Configuration ──────────────────────────────────────────────────
const PORT = parseInt(process.env.CONTEXT7_PORT || '3371', 10);
const SERVICE_NAME = 'context7-mcp';
const SERVICE_VERSION = '1.0.0';

const log = createLogger(SERVICE_NAME);

// ─── Inline Context7 Adapter (self-contained service) ───────────────────────
// The adapter is inlined here to keep the v13 service self-contained,
// mirroring the pattern of other HeadySystems_v13 services.

const https = require('https');
const { URL } = require('url');

const CONTEXT7_ENDPOINT = 'https://mcp.context7.com/mcp';
// FIB 0-indexed: [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987]
const BACKOFF_BASE_MS = FIB[5] * 100;      // 8 * 100 = 800ms
const BACKOFF_MAX_MS = FIB[10] * 100;      // 89 * 100 = 8900ms
const MAX_ATTEMPTS = FIB[5];               // 8
const LIB_CACHE_MAX = FIB[10];             // 89
const LIB_CACHE_TTL = FIB[13] * 1000;     // 377 * 1000 = 377000ms
const DOC_CACHE_MAX = FIB[7];              // 21
const DOC_CACHE_TTL = FIB[12] * 1000;     // 233 * 1000 = 233000ms
const CIRCUIT_RESET_MS = FIB[9] * 1000;   // 55 * 1000 = 55000ms
const HALF_OPEN_MAX = FIB[3];              // 3
const REQUEST_TIMEOUT_MS = FIB[8] * 1000; // 34 * 1000 = 34000ms
const MAX_TOKENS_PER_LIB = FIB[11] * 100; // 144 * 100 = 14400
const MAX_LIBRARIES_PER_TASK = FIB[6];     // 13

// ── LRU Cache ───────────────────────────────────────────────────────────────
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
    if (!entry) { this.misses++; return undefined; }
    if (Date.now() - entry.timestamp > this.ttlMs) { this.cache.delete(key); this.misses++; return undefined; }
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  get hitRate() {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  getStats() {
    return {
      size: this.cache.size, maxSize: this.maxSize, ttlMs: this.ttlMs,
      hits: this.hits, misses: this.misses, hitRate: Number(this.hitRate.toFixed(4)),
    };
  }
}

// ── Circuit Breaker ─────────────────────────────────────────────────────────
class CircuitBreaker {
  constructor() {
    this.state = 'closed';
    this.failures = 0;
    this.maxFailures = MAX_ATTEMPTS;
    this.resetTimeoutMs = CIRCUIT_RESET_MS;
    this.halfOpenMax = HALF_OPEN_MAX;  // 3
    this.halfOpenAttempts = 0;
    this.lastFailureTime = 0;
    this.totalTrips = 0;
  }

  canExecute() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half_open'; this.halfOpenAttempts = 0; return true;
      }
      return false;
    }
    return this.halfOpenAttempts < this.halfOpenMax;
  }

  recordSuccess() {
    if (this.state === 'half_open') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.halfOpenMax) {
        this.state = 'closed'; this.failures = 0; this.halfOpenAttempts = 0;
      }
    } else { this.failures = 0; }
  }

  recordFailure() {
    this.failures++; this.lastFailureTime = Date.now();
    if (this.state === 'half_open' || this.failures >= this.maxFailures) {
      this.state = 'open'; this.totalTrips++;
    }
  }

  getState() {
    return {
      state: this.state, failures: this.failures, maxFailures: this.maxFailures,
      totalTrips: this.totalTrips, lastFailureTime: this.lastFailureTime,
      resetTimeoutMs: this.resetTimeoutMs, halfOpenAttempts: this.halfOpenAttempts,
    };
  }
}

// ── Phi-backoff ─────────────────────────────────────────────────────────────
function phiBackoff(attempt) {
  const delay = Math.pow(PHI, attempt) * BACKOFF_BASE_MS;
  const capped = Math.min(delay, BACKOFF_MAX_MS);
  const jitter = capped * PSI * PSI * (Math.random() * 2 - 1);
  return Math.max(BACKOFF_BASE_MS, Math.round(capped + jitter));
}

// ── JSON-RPC Transport ──────────────────────────────────────────────────────
function makeJsonRpcRequest(method, params, apiKey) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(CONTEXT7_ENDPOINT);
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: `ctx7-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method, params,
    });

    const options = {
      hostname: parsed.hostname, port: 443, path: parsed.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'HeadySystems-Context7MCP/1.0.0',
      },
    };
    if (apiKey) options.headers['CONTEXT7_API_KEY'] = apiKey;

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Context7 HTTP ${res.statusCode}: ${body.slice(0, 500)}`));
        }
        try {
          const data = JSON.parse(body);
          if (data.error) return reject(new Error(`Context7 RPC error ${data.error.code}: ${data.error.message}`));
          resolve(data.result);
        } catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
      });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', (e) => reject(new Error(`Network error: ${e.message}`)));
    req.write(payload);
    req.end();
  });
}

// ── Service Adapter ─────────────────────────────────────────────────────────
const apiKey = process.env.CONTEXT7_API_KEY;
const libraryCache = new LRUCache(LIB_CACHE_MAX, LIB_CACHE_TTL);
const docCache = new LRUCache(DOC_CACHE_MAX, DOC_CACHE_TTL);
const circuitBreaker = new CircuitBreaker();
const serviceMetrics = {
  totalRequests: 0, successfulRequests: 0, failedRequests: 0,
  totalLatencyMs: 0, resolutionCount: 0, queryCount: 0,
  latencies: [],
};
const startTime = Date.now();
const MAX_LATENCY_SAMPLES = FIB[10]; // 89

async function executeWithResilience(method, params, cache, cacheKey) {
  if (cache && cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
  }
  if (!circuitBreaker.canExecute()) {
    throw new Error('Circuit breaker OPEN — Context7 unavailable');
  }

  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const t0 = Date.now();
    serviceMetrics.totalRequests++;
    try {
      const result = await makeJsonRpcRequest(method, params, apiKey);
      const latency = Date.now() - t0;
      serviceMetrics.totalLatencyMs += latency;
      serviceMetrics.successfulRequests++;
      serviceMetrics.latencies.push(latency);
      if (serviceMetrics.latencies.length > MAX_LATENCY_SAMPLES) serviceMetrics.latencies.shift();
      circuitBreaker.recordSuccess();
      if (cache && cacheKey && result !== undefined) cache.set(cacheKey, result);
      return result;
    } catch (err) {
      lastError = err;
      serviceMetrics.failedRequests++;
      circuitBreaker.recordFailure();
      if (!circuitBreaker.canExecute()) break;
      if (attempt < MAX_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, phiBackoff(attempt)));
    }
  }
  throw lastError || new Error('Context7 request failed');
}

async function resolveLibrary(name) {
  const key = `lib:${name.trim().toLowerCase()}`;
  const result = await executeWithResilience(
    'tools/call',
    { name: 'resolve-library-id', arguments: { libraryName: name.trim().toLowerCase() } },
    libraryCache, key
  );
  serviceMetrics.resolutionCount++;
  return result;
}

async function queryDocs(libraryId, options) {
  options = options || {};
  const tokens = options.tokens || FIB[13];
  const topic = options.topic;
  const key = `doc:${libraryId}:${tokens}:${topic || 'all'}`;
  const params = { name: 'query-docs', arguments: { libraryId, tokens } };
  if (topic) params.arguments.topic = topic;
  const result = await executeWithResilience('tools/call', params, docCache, key);
  serviceMetrics.queryCount++;
  return result;
}

// ── Library Extraction Patterns ─────────────────────────────────────────────
const LIBRARY_PATTERNS = [
  /import\s+(?:[\w{},*\s]+from\s+)?['"]([^'"./][^'"]*)['"]/g,
  /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g,
  /import\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g,
  /\b(?:using|with|install|add|require|import)\s+(@?[a-z][\w.-]*(?:\/[\w.-]+)?)/gi,
];

const NOISE = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'it', 'is', 'be', 'as', 'do', 'if', 'so', 'no', 'not', 'how', 'can', 'use',
  'get', 'set', 'new', 'all', 'my', 'function', 'class', 'const', 'let', 'var',
]);

function extractLibraryNames(text) {
  if (!text) return [];
  const found = new Set();
  for (const pattern of LIBRARY_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const name = m[1].trim();
      if (name && name.length >= 2 && !NOISE.has(name.toLowerCase())) {
        const base = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
        found.add(base);
      }
    }
  }
  return Array.from(found).slice(0, MAX_LIBRARIES_PER_TASK);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Express App ────────────────────────────────────────────────────────────
const app = express();

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origin.endsWith('.headysystems.com') || origin === `http://localhost:${PORT}`) {
      return cb(null, true);
    }
    cb(new Error('CORS not allowed'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(headyAutoContext());

// ── GET /health ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const cbState = circuitBreaker.getState();
  let context7Status = 'unknown';
  let probeLatencyMs = 0;

  try {
    const t0 = Date.now();
    await resolveLibrary('express');
    probeLatencyMs = Date.now() - t0;
    context7Status = 'connected';
  } catch (err) {
    context7Status = 'disconnected';
    log.warn({ error: err.message }, 'Health probe failed');
  }

  const errorRate = serviceMetrics.totalRequests > 0
    ? serviceMetrics.failedRequests / serviceMetrics.totalRequests
    : 0;
  const latencyFactor = Math.max(0, 1 - (probeLatencyMs / (FIB[10] * 100)));
  const coherence = Number(Math.max(
    CSL_GATES.MINIMUM,
    latencyFactor * PSI + (1 - errorRate) * (1 - PSI)
  ).toFixed(4));

  res.json({
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    status: coherence >= CSL_GATES.MEDIUM ? 'healthy' : 'degraded',
    coherence,
    phi_compliance: true,
    sacred_geometry: { layer: 'Outer', node: 'BRIDGE', pool: 'Warm' },
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    context7: {
      status: context7Status,
      endpoint: CONTEXT7_ENDPOINT,
      probeLatencyMs,
    },
    caches: {
      libraries: libraryCache.getStats(),
      docs: docCache.getStats(),
    },
    circuit_breaker: cbState,
    phi: PHI,
    psi: PSI,
  });
});

// ── POST /resolve ───────────────────────────────────────────────────────────
app.post('/resolve', async (req, res) => {
  try {
    const { libraryName } = req.body;
    if (!libraryName || typeof libraryName !== 'string') {
      return res.status(400).json({ error: 'libraryName (string) is required' });
    }
    const result = await resolveLibrary(libraryName);
    log.info({ libraryName, resultId: result?.libraryId }, 'Library resolved');
    res.json({ libraryName, result });
  } catch (err) {
    log.error({ error: err.message }, 'Resolve failed');
    res.status(502).json({ error: err.message });
  }
});

// ── POST /query ─────────────────────────────────────────────────────────────
app.post('/query', async (req, res) => {
  try {
    const { libraryId, tokens, topic } = req.body;
    if (!libraryId || typeof libraryId !== 'string') {
      return res.status(400).json({ error: 'libraryId (string) is required' });
    }
    const result = await queryDocs(libraryId, { tokens, topic });
    log.info({ libraryId, tokens }, 'Docs queried');
    res.json({ libraryId, result });
  } catch (err) {
    log.error({ error: err.message }, 'Query failed');
    res.status(502).json({ error: err.message });
  }
});

// ── POST /enrich ────────────────────────────────────────────────────────────
app.post('/enrich', async (req, res) => {
  try {
    const { taskDescription } = req.body;
    if (!taskDescription || typeof taskDescription !== 'string') {
      return res.status(400).json({ error: 'taskDescription (string) is required' });
    }

    const libraryNames = extractLibraryNames(taskDescription);
    if (libraryNames.length === 0) {
      return res.json({ libraries: [], totalTokens: 0 });
    }

    const libraries = [];
    let totalTokens = 0;

    const results = await Promise.allSettled(
      libraryNames.map(async (name) => {
        const resolved = await resolveLibrary(name);
        if (!resolved || !resolved.libraryId) return null;
        const docs = await queryDocs(resolved.libraryId, { tokens: MAX_TOKENS_PER_LIB });
        const docText = typeof docs === 'string' ? docs : JSON.stringify(docs);
        const tokenEstimate = Math.ceil(docText.length / 4);
        return { name, id: resolved.libraryId, docs, tokenEstimate };
      })
    );

    for (const s of results) {
      if (s.status === 'fulfilled' && s.value) {
        libraries.push(s.value);
        totalTokens += s.value.tokenEstimate;
      }
    }

    log.info({ taskDescription: taskDescription.slice(0, 200), libraryCount: libraries.length, totalTokens }, 'Enrichment complete');
    res.json({ libraries, totalTokens });
  } catch (err) {
    log.error({ error: err.message }, 'Enrich failed');
    res.status(502).json({ error: err.message });
  }
});

// ── GET /stats ──────────────────────────────────────────────────────────────
app.get('/stats', (_req, res) => {
  const sorted = [...serviceMetrics.latencies].sort((a, b) => a - b);
  const avgLatency = serviceMetrics.successfulRequests > 0
    ? serviceMetrics.totalLatencyMs / serviceMetrics.successfulRequests
    : 0;

  res.json({
    service: SERVICE_NAME,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    requests: {
      total: serviceMetrics.totalRequests,
      successful: serviceMetrics.successfulRequests,
      failed: serviceMetrics.failedRequests,
      resolutions: serviceMetrics.resolutionCount,
      queries: serviceMetrics.queryCount,
    },
    latency: {
      avg_ms: Number(avgLatency.toFixed(2)),
      p50_ms: percentile(sorted, 50),
      p90_ms: percentile(sorted, 90),
      p99_ms: percentile(sorted, 99),
      samples: sorted.length,
    },
    caches: {
      libraries: libraryCache.getStats(),
      docs: docCache.getStats(),
    },
    circuit_breaker: circuitBreaker.getState(),
  });
});

// ── Error Handler ───────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  log.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    service: SERVICE_NAME,
  });
});

// ─── Graceful Shutdown (LIFO) ───────────────────────────────────────────────
const cleanups = [];
const registerCleanup = (name, fn) => cleanups.unshift({ name, fn });

let server;

function startServer() {
  server = app.listen(PORT, () => {
    log.info({
      port: PORT,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      phi: PHI,
      sacred_geometry: { layer: 'Outer', node: 'BRIDGE', pool: 'Warm' },
    }, `${SERVICE_NAME} listening on port ${PORT}`);
  });

  registerCleanup('http-server', () => new Promise((resolve) => {
    server.close(() => { log.info('HTTP server closed'); resolve(); });
  }));
}

async function shutdown(signal) {
  log.info({ signal, service: SERVICE_NAME }, 'Shutting down gracefully');
  for (const { name, fn } of cleanups) {
    try {
      await fn();
      log.info({ name }, 'Cleanup complete');
    } catch (err) {
      log.error({ name, error: err.message }, 'Cleanup failed');
    }
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();

module.exports = { app, server };
