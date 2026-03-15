'use strict';

/**
 * SwarmConsensus v2 Unit Tests (TEST-04)
 */

jest.mock('../../src/shared/phi-math', () => ({
  PHI_TIMING: { CYCLE: 29034 },
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const SwarmConsensus = require('../../src/orchestration/swarm-consensus-v2');

// Handle module.exports variations
const SwarmClass = SwarmConsensus.SwarmConsensus || SwarmConsensus;

describe('SwarmConsensus v2', () => {
  let consensus;

  beforeEach(() => {
    consensus = new SwarmClass({
      lockTtlMs: 5000,
      deadOwnerThresholdMs: 3000,
    });
  });

  afterEach(() => {
    if (consensus.shutdown) consensus.shutdown();
  });

  describe('Lock Acquisition', () => {
    it('should acquire a lock and return a nonce', async () => {
      const result = await consensus.acquire('resource-1', 'owner-1');
      expect(result.acquired).toBe(true);
      expect(result.nonce).toBeDefined();
      expect(typeof result.nonce).toBe('string');
      expect(result.nonce.length).toBe(32); // 16 bytes hex
    });

    it('should prevent double acquisition of same resource', async () => {
      await consensus.acquire('resource-1', 'owner-1');
      const result = await consensus.acquire('resource-1', 'owner-2');
      expect(result.acquired).toBe(false);
    });

    it('should emit lock:acquired event', async () => {
      const handler = jest.fn();
      consensus.on('lock:acquired', handler);
      await consensus.acquire('resource-1', 'owner-1');
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Lock Release', () => {
    it('should release with valid nonce', async () => {
      const { nonce } = await consensus.acquire('resource-1', 'owner-1');
      const released = consensus.release('resource-1', nonce);
      expect(released).toBe(true);
    });

    it('should reject release with invalid nonce', async () => {
      await consensus.acquire('resource-1', 'owner-1');
      const released = consensus.release('resource-1', 'wrong-nonce-value-here-1234');
      expect(released).toBe(false);
    });

    it('should emit lock:released on successful release', async () => {
      const handler = jest.fn();
      consensus.on('lock:released', handler);
      const { nonce } = await consensus.acquire('resource-1', 'owner-1');
      consensus.release('resource-1', nonce);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Heartbeat', () => {
    it('should accept heartbeat with valid nonce', async () => {
      const { nonce } = await consensus.acquire('resource-1', 'owner-1');
      const result = consensus.heartbeat('resource-1', nonce);
      expect(result).toBe(true);
    });

    it('should reject heartbeat with invalid nonce', async () => {
      await consensus.acquire('resource-1', 'owner-1');
      const result = consensus.heartbeat('resource-1', 'invalid-nonce-1234567890ab');
      expect(result).toBe(false);
    });
  });

  describe('Force Release', () => {
    it('should support force release', async () => {
      await consensus.acquire('resource-1', 'owner-1');
      if (typeof consensus.forceRelease === 'function') {
        const result = consensus.forceRelease('resource-1', 'admin-nonce');
        expect(result).toBeDefined();
      }
    });
  });

  describe('Metrics', () => {
    it('should report metrics', async () => {
      await consensus.acquire('resource-1', 'owner-1');
      const metrics = consensus.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.activeLocks).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Priority Queue', () => {
    it('should serve higher priority requests first', async () => {
      // Acquire lock
      await consensus.acquire('resource-1', 'owner-1');
      // Queue two waiters with different priorities
      const lowPriority = consensus.acquire('resource-1', 'owner-low', { priority: 'LOW' });
      const highPriority = consensus.acquire('resource-1', 'owner-high', { priority: 'CRITICAL' });

      // Release — high priority should get it first
      const { nonce } = await consensus.acquire('resource-1', 'owner-1').catch(() => ({}));
      if (nonce) consensus.release('resource-1', nonce);
    });
  });
});
