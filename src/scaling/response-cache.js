/**
 * ResponseCache — φ-Sized LRU Response Cache
 * In-memory response caching with Fibonacci-sized buckets,
 * cache-aware ETags, conditional requests, and graceful degradation.
 * All constants φ-derived. CSL gates replace boolean. ESM only.
 * Author: Eric Haywood
 */
import { createHash } from 'crypto';

const PHI = 1.6180339887;
const PSI = 0.6180339887;
const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

function phiThreshold(level, spread = PSI2) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  CRITICAL: phiThreshold(4),
  HIGH: phiThreshold(3),
  MEDIUM: phiThreshold(2),
  LOW: phiThreshold(1),
  MINIMUM: phiThreshold(0),
};

function cslGate(value, score, tau = CSL_THRESHOLDS.MEDIUM, temp = Math.pow(PSI, 3)) {
  return value * (1 / (1 + Math.exp(-(score - tau) / temp)));
}

function hashSHA256(data) {
  return createHash('sha256').update(typeof data === 'string' ? data : JSON.stringify(data)).digest('hex');
}

// ── Cache Profiles ───────────────────────────────────────────────
const CACHE_PROFILES = {
  'static':    { maxEntries: FIB[16], ttlMs: FIB[11] * 60 * 1000, staleWhileRevalidateMs: FIB[10] * 60 * 1000 }, // 987 entries, 89min TTL
  'api':       { maxEntries: FIB[14], ttlMs: FIB[9] * 1000, staleWhileRevalidateMs: FIB[8] * 1000 },              // 377 entries, 34s TTL
  'search':    { maxEntries: FIB[13], ttlMs: FIB[10] * 1000, staleWhileRevalidateMs: FIB[9] * 1000 },             // 233 entries, 55s TTL
  'embedding': { maxEntries: FIB[16], ttlMs: FIB[14] * 60 * 1000, staleWhileRevalidateMs: FIB[12] * 60 * 1000 }, // 987 entries, 377min TTL
  'volatile':  { maxEntries: FIB[11], ttlMs: FIB[6] * 1000, staleWhileRevalidateMs: FIB[4] * 1000 },             // 89 entries, 8s TTL
};

class CacheEntry {
  constructor(key, value, headers, profile) {
    this.key = key;
    this.value = value;
    this.headers = headers;
    this.etag = hashSHA256(value).slice(0, FIB[8]);
    this.createdAt = Date.now();
    this.lastAccessedAt = Date.now();
    this.accessCount = 0;
    this.ttlMs = profile.ttlMs;
    this.staleMs = profile.staleWhileRevalidateMs;
    this.size = typeof value === 'string' ? value.length : JSON.stringify(value).length;
  }

  isFresh() { return Date.now() - this.createdAt < this.ttlMs; }
  isStale() { return !this.isFresh() && Date.now() - this.createdAt < this.ttlMs + this.staleMs; }
  isExpired() { return Date.now() - this.createdAt >= this.ttlMs + this.staleMs; }

  access() {
    this.lastAccessedAt = Date.now();
    this.accessCount++;
  }

  evictionScore() {
    const recency = 1.0 / (1 + (Date.now() - this.lastAccessedAt) / (FIB[10] * 1000));
    const frequency = Math.min(1.0, this.accessCount / FIB[8]);
    const freshness = this.isFresh() ? 1.0 : this.isStale() ? PSI : 0;
    return recency * PSI + frequency * PSI2 + freshness * (1 - PSI - PSI2);
  }
}

class ResponseCache {
  constructor(config = {}) {
    this.profileName = config.profile ?? 'api';
    this.profile = CACHE_PROFILES[this.profileName] ?? CACHE_PROFILES['api'];
    this.entries = new Map();
    this.hits = 0;
    this.misses = 0;
    this.staleHits = 0;
    this.evictions = 0;
    this.bypassPatterns = config.bypassPatterns ?? [/\/health/, /\/metrics/, /\/admin/];
  }

  _cacheKey(req) {
    return hashSHA256({ method: req.method, url: req.url, accept: req.headers?.accept ?? '' });
  }

  _shouldCache(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    if (this.bypassPatterns.some(p => p.test(req.url))) return false;
    const status = res.statusCode;
    return status >= 200 && status < 300;
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) { this.misses++; return null; }
    if (entry.isExpired()) { this.entries.delete(key); this.misses++; return null; }
    entry.access();
    if (entry.isFresh()) { this.hits++; return { entry, status: 'fresh' }; }
    this.staleHits++;
    return { entry, status: 'stale' };
  }

  set(key, value, headers) {
    if (this.entries.size >= this.profile.maxEntries) this._evictOne();
    this.entries.set(key, new CacheEntry(key, value, headers, this.profile));
  }

  _evictOne() {
    let worstKey = null, worstScore = Infinity;
    for (const [key, entry] of this.entries) {
      const score = entry.evictionScore();
      if (score < worstScore) { worstScore = score; worstKey = key; }
    }
    if (worstKey) { this.entries.delete(worstKey); this.evictions++; }
  }

  middleware() {
    const self = this;
    return (req, res, next) => {
      const key = self._cacheKey(req);

      // Check for conditional request (ETag)
      const ifNoneMatch = req.headers['if-none-match'];
      const cached = self.get(key);

      if (cached && ifNoneMatch === `"${cached.entry.etag}"`) {
        res.writeHead(304, { 'ETag': `"${cached.entry.etag}"`, 'X-Cache': 'HIT-NOT-MODIFIED' });
        res.end();
        return;
      }

      if (cached && cached.status === 'fresh') {
        const headers = { ...cached.entry.headers, 'ETag': `"${cached.entry.etag}"`, 'X-Cache': 'HIT', 'Age': Math.floor((Date.now() - cached.entry.createdAt) / 1000) };
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
        res.writeHead(200);
        res.end(cached.entry.value);
        return;
      }

      if (cached && cached.status === 'stale') {
        // Serve stale while revalidating
        const headers = { ...cached.entry.headers, 'X-Cache': 'STALE', 'Warning': '110 - "Response is stale"' };
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      }

      // Intercept response to cache it
      const originalEnd = res.end.bind(res);
      const originalWrite = res.write.bind(res);
      let body = [];

      res.write = function(chunk) {
        if (chunk) body.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return originalWrite(chunk);
      };

      res.end = function(chunk) {
        if (chunk) body.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

        if (self._shouldCache(req, res)) {
          const fullBody = Buffer.concat(body).toString();
          const responseHeaders = {};
          for (const [k, v] of Object.entries(res.getHeaders())) {
            if (!['transfer-encoding', 'connection'].includes(k.toLowerCase())) responseHeaders[k] = v;
          }
          self.set(key, fullBody, responseHeaders);
          res.setHeader('X-Cache', 'MISS');
        }

        return originalEnd(chunk);
      };

      next?.();
    };
  }

  invalidate(pattern) {
    const removed = [];
    for (const [key, entry] of this.entries) {
      if (typeof pattern === 'string' && key.includes(pattern)) {
        this.entries.delete(key); removed.push(key);
      } else if (pattern instanceof RegExp && pattern.test(key)) {
        this.entries.delete(key); removed.push(key);
      }
    }
    return removed.length;
  }

  flush() {
    const size = this.entries.size;
    this.entries.clear();
    return size;
  }

  health() {
    const total = this.hits + this.misses + this.staleHits;
    return {
      profile: this.profileName,
      entries: this.entries.size,
      maxEntries: this.profile.maxEntries,
      hits: this.hits, misses: this.misses, staleHits: this.staleHits,
      hitRate: total > 0 ? (this.hits + this.staleHits) / total : 0,
      evictions: this.evictions,
    };
  }
}

export default ResponseCache;
export { ResponseCache, CacheEntry, CACHE_PROFILES };
