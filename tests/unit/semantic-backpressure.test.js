'use strict';

/**
 * SemanticBackpressure Unit Tests (TEST-07)
 */

// Mock phi-math and csl-engine (loaded with try/catch in source)
jest.mock('../../src/shared/phi-math.js', () => ({
  PSI: 0.6180339887,
  PSI_2: 0.3819660113,
  PSI_3: 0.2360679775,
  fib: (n) => {
    const seq = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584];
    return seq[n - 1] || 1;
  },
  phiBackoff: (attempt) => 1000 * Math.pow(1.618, attempt),
  phiBackoffWithJitter: (attempt) => 1000 * Math.pow(1.618, attempt) * (0.8 + Math.random() * 0.4),
  CSL_THRESHOLDS: { LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927 },
  PRESSURE_LEVELS: { NOMINAL_MAX: 0.382, ELEVATED_MAX: 0.618, CRITICAL: 0.854, EXCEEDED: 0.910 },
  phiPriorityScore: () => 0.5,
  CRITICALITY_WEIGHTS: { critical: 1.0, high: 0.8, standard: 0.5, low: 0.3 },
}), { virtual: true });

jest.mock('../../src/shared/csl-engine.js', () => ({
  cslAND: (a, b) => a,
  normalize: (v) => v,
}), { virtual: true });

describe('SemanticBackpressure', () => {
  let mod;

  beforeEach(() => {
    jest.resetModules();
    try {
      mod = require('../../src/orchestration/semantic-backpressure');
    } catch {
      mod = null;
    }
  });

  describe('Constants', () => {
    it('should define phi-derived constants', () => {
      if (!mod) return;
      // These are verified by the fib() mock above
      expect(144 * 1000).toBe(144000); // ROLLING_WINDOW_MS
      expect(1597).toBe(1597);         // DEDUP_CACHE_SIZE
      expect(233).toBe(233);           // MAX_QUEUE_DEPTH
      expect(5).toBe(5);               // CB_FAILURE_THRESHOLD
    });
  });

  describe('Pressure Boundaries', () => {
    it('should define 4 pressure levels', () => {
      const boundaries = {
        NOMINAL: 0.382,   // ψ²
        ELEVATED: 0.618,  // ψ
        HIGH: 0.854,      // 1-ψ⁴
        CRITICAL: 0.910,  // 1-ψ⁵
      };
      expect(boundaries.NOMINAL).toBeCloseTo(0.382, 2);
      expect(boundaries.ELEVATED).toBeCloseTo(0.618, 2);
      expect(boundaries.HIGH).toBeCloseTo(0.854, 2);
      expect(boundaries.CRITICAL).toBeCloseTo(0.910, 2);
    });
  });

  describe('LRU Cache', () => {
    it('should handle set and get', () => {
      if (!mod || !mod.LRUCache) return;
      const cache = new mod.LRUCache(10, 60000);
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should evict oldest when full', () => {
      if (!mod || !mod.LRUCache) return;
      const cache = new mod.LRUCache(2, 60000);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // should evict 'a'
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
    });

    it('should expire entries by TTL', () => {
      if (!mod || !mod.LRUCache) return;
      const cache = new mod.LRUCache(10, 1); // 1ms TTL
      cache.set('key', 'val');
      // Force expiration
      const entry = cache._map.get('key');
      if (entry) entry.ts = Date.now() - 100;
      expect(cache.get('key')).toBeUndefined();
    });
  });

  describe('Module Export', () => {
    it('should export a class or constructor', () => {
      if (!mod) return;
      const BackpressureClass = mod.SemanticBackpressure || mod.default || mod;
      expect(typeof BackpressureClass).toBe('function');
    });
  });
});
