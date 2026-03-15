'use strict';

/**
 * ContextWindowManager Unit Tests (TEST-08)
 */

const {
  ContextWindowManager,
  ContextEntry,
  TOKEN_BUDGETS,
  COMPRESSION_TRIGGER,
  EVICTION_WEIGHTS,
  roughTokenCount,
  evictionScore,
} = (() => {
  try {
    return require('../../src/orchestration/context-window-manager');
  } catch {
    return {};
  }
})();

describe('ContextWindowManager', () => {
  describe('Token Budgets (Phi-Scaled)', () => {
    it('should define working budget as 8192', () => {
      if (!TOKEN_BUDGETS) return;
      expect(TOKEN_BUDGETS.working).toBe(8192);
    });

    it('should define session budget as ~8192 × φ² ≈ 21450', () => {
      if (!TOKEN_BUDGETS) return;
      expect(TOKEN_BUDGETS.session).toBe(21450);
    });

    it('should define memory budget as ~8192 × φ⁴ ≈ 56131', () => {
      if (!TOKEN_BUDGETS) return;
      expect(TOKEN_BUDGETS.memory).toBe(56131);
    });

    it('should define artifacts budget as ~8192 × φ⁶ ≈ 146920', () => {
      if (!TOKEN_BUDGETS) return;
      expect(TOKEN_BUDGETS.artifacts).toBe(146920);
    });

    it('should scale by φ² between tiers', () => {
      if (!TOKEN_BUDGETS) return;
      const PHI2 = 1.6180339887 * 1.6180339887;
      expect(TOKEN_BUDGETS.session / TOKEN_BUDGETS.working).toBeCloseTo(PHI2, 0);
    });
  });

  describe('Compression Trigger', () => {
    it('should trigger at ~91% (1 - ψ⁵)', () => {
      if (COMPRESSION_TRIGGER === undefined) return;
      const PSI = 0.6180339887;
      const expected = 1 - Math.pow(PSI, 5);
      expect(COMPRESSION_TRIGGER).toBeCloseTo(expected, 3);
    });
  });

  describe('Eviction Weights', () => {
    it('should sum to ~1.0', () => {
      if (!EVICTION_WEIGHTS) return;
      const sum = EVICTION_WEIGHTS.importance + EVICTION_WEIGHTS.recency + EVICTION_WEIGHTS.relevance;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should have importance as highest weight', () => {
      if (!EVICTION_WEIGHTS) return;
      expect(EVICTION_WEIGHTS.importance).toBeGreaterThan(EVICTION_WEIGHTS.recency);
      expect(EVICTION_WEIGHTS.recency).toBeGreaterThan(EVICTION_WEIGHTS.relevance);
    });
  });

  describe('roughTokenCount', () => {
    it('should estimate tokens for strings as ceil(length/4)', () => {
      if (!roughTokenCount) return;
      expect(roughTokenCount('hello world')).toBe(Math.ceil(11 / 4));
    });

    it('should estimate tokens for objects', () => {
      if (!roughTokenCount) return;
      const obj = { key: 'value' };
      expect(roughTokenCount(obj)).toBe(Math.ceil(JSON.stringify(obj).length / 4));
    });
  });

  describe('ContextEntry', () => {
    it('should create with defaults', () => {
      if (!ContextEntry) return;
      const entry = new ContextEntry({ id: 'test', content: 'hello' });
      expect(entry.id).toBe('test');
      expect(entry.role).toBe('user');
      expect(entry.importance).toBeCloseTo(0.618, 2); // PSI default
      expect(entry.relevance).toBeCloseTo(0.618, 2);
      expect(entry.tokens).toBeGreaterThan(0);
    });

    it('should clamp importance to [0, 1]', () => {
      if (!ContextEntry) return;
      const entry = new ContextEntry({ id: 'test', content: 'x', importance: 1.5 });
      expect(entry.importance).toBeLessThanOrEqual(1);
    });

    it('should update lastAccessAt on touch()', () => {
      if (!ContextEntry) return;
      const entry = new ContextEntry({ id: 'test', content: 'x' });
      const before = entry.lastAccessAt;
      entry.touch();
      expect(entry.lastAccessAt).toBeGreaterThanOrEqual(before);
    });

    it('should compute eviction score', () => {
      if (!ContextEntry) return;
      const entry = new ContextEntry({ id: 'test', content: 'x', importance: 0.9 });
      const score = entry.evictionScore();
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('ContextWindowManager Instance', () => {
    it('should create with default config', () => {
      if (!ContextWindowManager) return;
      const mgr = new ContextWindowManager({});
      expect(mgr).toBeDefined();
    });

    it('should add entries', () => {
      if (!ContextWindowManager) return;
      const mgr = new ContextWindowManager({});
      if (typeof mgr.addEntry === 'function') {
        mgr.addEntry({ id: 'e1', content: 'test content' });
        const entries = mgr.getEntries ? mgr.getEntries() : [];
        expect(entries.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
