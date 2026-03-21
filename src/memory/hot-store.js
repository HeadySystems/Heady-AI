/**
 * Hot Store - Redis integration for real-time / transient Heady memory
 * Part of the Latent OS 3-Tier Architecture
 */
'use strict';
const { createLogger } = require('../utils/logger');
const logger = createLogger('hot-store');

class HotStore {
  constructor(config = {}) {
    this.prefix = config.prefix || 'heady:hot:';
    this.client = config.client || null; // Map or Redis client
  }
  
  async connect() {
    if (!this.client) {
      logger.warn('HotStore: No Redis client provided, running in memory-only degraded mode');
      this.client = new Map();
    }
  }

  async set(key, value, mode, ttl) {
    const k = this.prefix + key;
    if (this.client instanceof Map) {
      this.client.set(k, { value, expire: Date.now() + (ttl * 1000) });
      return 'OK';
    }
    return this.client.set(k, value, mode, ttl);
  }

  async get(key) {
    const k = this.prefix + key;
    if (this.client instanceof Map) {
      const entry = this.client.get(k);
      if (!entry) return null;
      if (Date.now() > entry.expire) {
        this.client.delete(k);
        return null;
      }
      return entry.value;
    }
    return this.client.get(k);
  }

  async delete(key) {
    const k = this.prefix + key;
    if (this.client instanceof Map) {
      return this.client.delete(k) ? 1 : 0;
    }
    return this.client.del(k);
  }

  async exportStale() {
    const stale = [];
    if (this.client instanceof Map) {
      const now = Date.now();
      for (const [key, entry] of this.client.entries()) {
        // If it expires in less than 5 seconds, migrate to warm
        if (entry.expire - now < 5000) {
          stale.push({ key: key.replace(this.prefix, ''), value: entry.value, metadata: { migrated: true } });
          this.client.delete(key);
        }
      }
    }
    return stale;
  }
}

module.exports = { HotStore };
