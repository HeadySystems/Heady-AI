/**
 * Cache Store Service
 * Implements the Latent Service Pattern
 */
'use strict';
const { createLogger } = require('../utils/logger');
const { phiMs } = require('../shared/phi-math');
const logger = createLogger('cache-store');

class CacheStoreService {
  constructor() {
    this.name = 'cache-store';
    this.status = 'dormant';
    this._metrics = { hits: 0, misses: 0, sets: 0 };
    this._interval = null;
    this.store = new Map();
  }
  async start() {
    if (this.status === 'active') return this;
    this.status = 'active';
    this._interval = setInterval(() => this._tick(), phiMs(10000));
    if (this._interval.unref) this._interval.unref();
    logger.info({}, 'Cache Store service started');
    return this;
  }
  async stop() {
    this.status = 'dormant';
    if (this._interval) clearInterval(this._interval);
    logger.info({}, 'Cache Store service stopped');
  }
  health() { return { name: this.name, status: this.status, metrics: this._metrics }; }
  metrics() { return { ...this._metrics }; }
  async _tick() {
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (v.expiry < now) {
        this.store.delete(k);
      }
    }
  }
  get(key) {
    if (this.status !== 'active') return null;
    const entry = this.store.get(key);
    if (!entry || entry.expiry < Date.now()) {
      this._metrics.misses++;
      return null;
    }
    this._metrics.hits++;
    return entry.value;
  }
  set(key, value, ttlMs = phiMs(60000)) {
    if (this.status !== 'active') return;
    this._metrics.sets++;
    this.store.set(key, { value, expiry: Date.now() + ttlMs });
  }
}
module.exports = new CacheStoreService();


// --- Auto-Unified Latent Service Pattern ---
if (module.exports && typeof module.exports === 'object') {
  if (!module.exports.start) module.exports.start = async () => ({ status: 'started' });
  if (!module.exports.stop) module.exports.stop = async () => ({ status: 'stopped' });
  if (!module.exports.health) module.exports.health = () => ({ status: 'healthy' });
  if (!module.exports.metrics) module.exports.metrics = () => ({ usages: 0 });
  if (!module.exports._tick) module.exports._tick = async () => {};
}
// -------------------------------------------
