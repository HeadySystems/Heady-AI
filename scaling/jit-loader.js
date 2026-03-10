// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ JIT Loader — Just-In-Time Module Loading with LRU Eviction
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import { PHI, PSI, PSI2, PSI3, FIB, CSL_THRESHOLDS, cslGate, phiFusionWeights } from '../shared/phi-math-v2.js';

class JITLoader {
  #cache;
  #maxCacheSize;
  #loadHistory;
  #evictionWeights;

  constructor() {
    this.#cache = new Map();
    this.#maxCacheSize = FIB[16];
    this.#loadHistory = [];
    this.#evictionWeights = { importance: PSI2 + PSI3, recency: PSI3 + PSI3 * PSI, relevance: PSI3 * PSI2 };
  }

  async load(moduleName, loader = null) {
    if (this.#cache.has(moduleName)) {
      const entry = this.#cache.get(moduleName);
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      return { loaded: true, cached: true, module: entry.module };
    }

    const module = loader ? await loader() : { name: moduleName, loaded: true };
    const entry = {
      module, moduleName, loadedAt: Date.now(), lastAccessed: Date.now(), accessCount: 1, size: 1,
    };

    if (this.#cache.size >= this.#maxCacheSize) {
      this.#evict();
    }

    this.#cache.set(moduleName, entry);
    this.#loadHistory.push({ action: 'load', moduleName, timestamp: Date.now() });

    return { loaded: true, cached: false, module };
  }

  unload(moduleName) {
    const deleted = this.#cache.delete(moduleName);
    if (deleted) this.#loadHistory.push({ action: 'unload', moduleName, timestamp: Date.now() });
    return { unloaded: deleted, moduleName };
  }

  preload(moduleNames, loaders = {}) {
    const results = [];
    for (const name of moduleNames) {
      results.push(this.load(name, loaders[name]));
    }
    return Promise.all(results);
  }

  getCacheStats() {
    return {
      size: this.#cache.size,
      maxSize: this.#maxCacheSize,
      utilization: this.#cache.size / this.#maxCacheSize,
      modules: Array.from(this.#cache.keys()),
      totalAccesses: Array.from(this.#cache.values()).reduce((s, e) => s + e.accessCount, 0),
    };
  }

  warmCache(moduleNames) {
    return this.preload(moduleNames);
  }

  #evict() {
    let worst = null;
    let worstScore = Infinity;
    const now = Date.now();

    for (const [name, entry] of this.#cache) {
      const recency = 1 - Math.min(1, (now - entry.lastAccessed) / (FIB[12] * 60000));
      const importance = Math.min(1, entry.accessCount / FIB[8]);
      const score = this.#evictionWeights.importance * importance +
                    this.#evictionWeights.recency * recency;
      if (score < worstScore) {
        worstScore = score;
        worst = name;
      }
    }

    if (worst) {
      this.#cache.delete(worst);
      this.#loadHistory.push({ action: 'evict', moduleName: worst, timestamp: now });
    }
  }
}

export { JITLoader };
export default JITLoader;
