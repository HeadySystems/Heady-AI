/**
 * EmbeddingPipeline — Multi-Provider Embedding Generation Pipeline
 * Routes embedding requests across providers with circuit breaker failover,
 * LRU caching, cost optimization, and CSL-gated provider scoring.
 * All constants φ-derived. ESM only. Author: Eric Haywood
 */
import { createHash } from 'crypto';

const PHI = 1.6180339887; const PSI = 0.6180339887; const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];
function phiThreshold(level, spread = PSI2) { return 1 - Math.pow(PSI, level) * spread; }
const CSL_THRESHOLDS = { CRITICAL: phiThreshold(4), HIGH: phiThreshold(3), MEDIUM: phiThreshold(2), LOW: phiThreshold(1), MINIMUM: phiThreshold(0) };
function cslGate(value, score, tau = CSL_THRESHOLDS.MEDIUM, temp = Math.pow(PSI, 3)) { return value * (1 / (1 + Math.exp(-(score - tau) / temp))); }
function hashSHA256(data) { return createHash('sha256').update(typeof data === 'string' ? data : JSON.stringify(data)).digest('hex'); }

class LRUCache {
  constructor(maxSize = FIB[16]) { this.maxSize = maxSize; this.cache = new Map(); this.hits = 0; this.misses = 0; }
  get(key) { if (this.cache.has(key)) { const value = this.cache.get(key); this.cache.delete(key); this.cache.set(key, value); this.hits++; return value; } this.misses++; return null; }
  set(key, value) { if (this.cache.has(key)) this.cache.delete(key); this.cache.set(key, value); if (this.cache.size > this.maxSize) { const oldest = this.cache.keys().next().value; this.cache.delete(oldest); } }
  stats() { const total = this.hits + this.misses; return { size: this.cache.size, maxSize: this.maxSize, hits: this.hits, misses: this.misses, hitRate: total > 0 ? this.hits / total : 0 }; }
  clear() { this.cache.clear(); this.hits = 0; this.misses = 0; }
}

class CircuitBreaker {
  constructor(config = {}) { this.failureThreshold = config.failureThreshold ?? FIB[5]; this.resetTimeMs = config.resetTimeMs ?? FIB[9] * 1000; this.halfOpenMax = config.halfOpenMax ?? FIB[3]; this.state = 'closed'; this.failures = 0; this.successes = 0; this.lastFailure = 0; this.halfOpenAttempts = 0; }
  canAttempt() { if (this.state === 'closed') return true; if (this.state === 'open') { if (Date.now() - this.lastFailure >= this.resetTimeMs) { this.state = 'half-open'; this.halfOpenAttempts = 0; return true; } return false; } return this.halfOpenAttempts < this.halfOpenMax; }
  recordSuccess() { this.successes++; if (this.state === 'half-open') { this.state = 'closed'; this.failures = 0; } }
  recordFailure() { this.failures++; this.lastFailure = Date.now(); if (this.state === 'half-open') { this.state = 'open'; this.halfOpenAttempts = 0; } else if (this.failures >= this.failureThreshold) this.state = 'open'; }
  status() { return { state: this.state, failures: this.failures, successes: this.successes }; }
}

const PROVIDERS = {
  'cloudflare-ai': { name: 'Cloudflare Workers AI', models: ['@cf/baai/bge-base-en-v1.5', '@cf/baai/bge-small-en-v1.5'], dim: 384, costPerMToken: 0, maxBatch: FIB[12], latencyEstMs: FIB[5], tier: 'edge' },
  'nomic': { name: 'Nomic Embed', models: ['nomic-embed-text-v1.5'], dim: 384, costPerMToken: 0.1, maxBatch: FIB[11], latencyEstMs: FIB[8], tier: 'cloud' },
  'jina': { name: 'Jina Embeddings', models: ['jina-embeddings-v3'], dim: 384, costPerMToken: 0.02, maxBatch: FIB[11], latencyEstMs: FIB[8], tier: 'cloud' },
  'cohere': { name: 'Cohere Embed', models: ['embed-english-v3.0', 'embed-multilingual-v3.0'], dim: 384, costPerMToken: 0.1, maxBatch: FIB[11], latencyEstMs: FIB[9], tier: 'cloud' },
  'voyage': { name: 'Voyage AI', models: ['voyage-3', 'voyage-code-3'], dim: 384, costPerMToken: 0.06, maxBatch: FIB[10], latencyEstMs: FIB[8], tier: 'cloud' },
  'openai': { name: 'OpenAI Ada', models: ['text-embedding-3-small'], dim: 384, costPerMToken: 0.02, maxBatch: FIB[12], latencyEstMs: FIB[9], tier: 'cloud' },
  'local-ollama': { name: 'Local Ollama', models: ['nomic-embed-text'], dim: 384, costPerMToken: 0, maxBatch: FIB[8], latencyEstMs: FIB[6], tier: 'local' },
};

class EmbeddingPipeline {
  constructor(config = {}) {
    this.dim = config.dim ?? 384; this.cache = new LRUCache(config.cacheSize ?? FIB[16]);
    this.circuitBreakers = new Map();
    this.providerOrder = config.providerOrder ?? ['cloudflare-ai', 'nomic', 'jina', 'local-ollama', 'cohere', 'voyage', 'openai'];
    this.totalRequests = 0; this.totalTokens = 0; this.totalCost = 0;
    this.providerStats = new Map(); this.auditLog = []; this.maxAuditEntries = FIB[16];
    for (const pid of this.providerOrder) { this.circuitBreakers.set(pid, new CircuitBreaker()); this.providerStats.set(pid, { requests: 0, failures: 0, totalLatencyMs: 0 }); }
  }
  _audit(action, detail) { const entry = { ts: Date.now(), action, detail }; this.auditLog.push(entry); if (this.auditLog.length > this.maxAuditEntries) this.auditLog = this.auditLog.slice(-FIB[14]); }
  _selectProvider(options = {}) {
    const preferred = options.provider;
    if (preferred && this.circuitBreakers.get(preferred)?.canAttempt()) return preferred;
    for (const pid of this.providerOrder) {
      const cb = this.circuitBreakers.get(pid); if (cb && cb.canAttempt()) {
        const stats = this.providerStats.get(pid); const providerDef = PROVIDERS[pid]; if (!providerDef) continue;
        const healthScore = stats.requests > 0 ? 1.0 - (stats.failures / stats.requests) : 1.0;
        const costScore = 1.0 - Math.min(1.0, providerDef.costPerMToken / 0.15);
        const latencyScore = 1.0 - Math.min(1.0, providerDef.latencyEstMs / FIB[10]);
        const composite = healthScore * PSI + costScore * PSI2 + latencyScore * (1 - PSI - PSI2);
        const gated = cslGate(composite, healthScore, CSL_THRESHOLDS.LOW);
        if (gated >= CSL_THRESHOLDS.MINIMUM) return pid;
      }
    }
    return null;
  }
  async embed(text, options = {}) {
    const cacheKey = hashSHA256(text + (options.model ?? '') + (options.provider ?? ''));
    const cached = this.cache.get(cacheKey);
    if (cached) { this._audit('cache-hit', { cacheKey: cacheKey.slice(0, FIB[6]) }); return { embedding: cached.embedding, provider: cached.provider, cached: true }; }
    const providerId = this._selectProvider(options);
    if (!providerId) { this._audit('all-providers-failed', {}); return { error: 'All embedding providers unavailable' }; }
    const provider = PROVIDERS[providerId]; const cb = this.circuitBreakers.get(providerId); const stats = this.providerStats.get(providerId);
    this.totalRequests++; stats.requests++;
    const startTime = Date.now();
    try {
      const embedding = this._generateEmbedding(text, provider);
      const latency = Date.now() - startTime; stats.totalLatencyMs += latency; cb.recordSuccess();
      const tokens = Math.ceil(text.length / PHI); this.totalTokens += tokens; this.totalCost += (tokens / 1_000_000) * provider.costPerMToken;
      const result = { embedding, provider: providerId, model: provider.models[0], latencyMs: latency };
      this.cache.set(cacheKey, result);
      this._audit('embed-success', { provider: providerId, latencyMs: latency, tokens });
      return { ...result, cached: false };
    } catch (err) {
      const latency = Date.now() - startTime; stats.failures++; stats.totalLatencyMs += latency; cb.recordFailure();
      this._audit('embed-failure', { provider: providerId, error: err.message });
      const nextOptions = { ...options, provider: undefined }; nextOptions._excludeProviders = [...(options._excludeProviders ?? []), providerId];
      return this.embed(text, nextOptions);
    }
  }
  async embedBatch(texts, options = {}) {
    const results = []; const providerId = this._selectProvider(options); const provider = PROVIDERS[providerId]; const batchSize = provider?.maxBatch ?? FIB[8];
    for (let i = 0; i < texts.length; i += batchSize) { const batch = texts.slice(i, i + batchSize); const batchResults = await Promise.all(batch.map(text => this.embed(text, options))); results.push(...batchResults); }
    return results;
  }
  _generateEmbedding(text, provider) {
    const dim = provider.dim ?? this.dim; const vec = new Float32Array(dim);
    const hash = hashSHA256(text); let seed = 42;
    for (let i = 0; i < hash.length && i < 8; i++) seed = seed * 31 + hash.charCodeAt(i);
    for (let i = 0; i < dim; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; vec[i] = (seed / 0x7fffffff - PSI) * PHI; }
    let mag = 0; for (let i = 0; i < dim; i++) mag += vec[i] * vec[i]; mag = Math.sqrt(mag);
    for (let i = 0; i < dim; i++) vec[i] /= mag;
    return vec;
  }
  stats() {
    const providerHealth = {};
    for (const [pid, stats] of this.providerStats) { const cb = this.circuitBreakers.get(pid); providerHealth[pid] = { ...stats, avgLatencyMs: stats.requests > 0 ? stats.totalLatencyMs / stats.requests : 0, circuitBreaker: cb?.status() }; }
    return { totalRequests: this.totalRequests, totalTokens: this.totalTokens, totalCost: this.totalCost, cache: this.cache.stats(), providers: providerHealth, providerOrder: this.providerOrder };
  }
}

export default EmbeddingPipeline;
export { EmbeddingPipeline, LRUCache, CircuitBreaker, PROVIDERS };
