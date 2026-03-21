import { vi } from "vitest";
'use strict';

/**
 * HeadyConductor v2 Unit Tests (TEST-02)
 */

vi.mock('../../src/shared/phi-math', () => ({
  PHI_TIMING: { CYCLE: 29034 },
}));

vi.mock('../../src/utils/logger', () => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}));

const { HeadyConductor } = require('../../src/orchestration/heady-conductor');

describe('HeadyConductor', () => {
  let conductor;

  beforeEach(() => {
    conductor = new HeadyConductor();
  });

  afterEach(() => {
    conductor.stopHeartbeat();
  });

  describe('Bee Registration', () => {
    it('should register a bee', () => {
      const bee = { domain: 'research', execute: vi.fn() };
      conductor.registerBee('bee-1', bee);
      expect(conductor.bees.has('bee-1')).toBe(true);
      expect(conductor.bees.get('bee-1').bee).toBe(bee);
      expect(conductor.bees.get('bee-1').status).toBe('idle');
    });

    it('should emit bee:registered event', () => {
      const handler = vi.fn();
      conductor.on('bee:registered', handler);
      conductor.registerBee('bee-1', { domain: 'test' });
      expect(handler).toHaveBeenCalledWith({ beeId: 'bee-1' });
    });

    it('should unregister a bee', () => {
      conductor.registerBee('bee-1', { domain: 'test' });
      conductor.unregisterBee('bee-1');
      expect(conductor.bees.has('bee-1')).toBe(false);
    });

    it('should emit bee:unregistered event', () => {
      const handler = vi.fn();
      conductor.on('bee:unregistered', handler);
      conductor.registerBee('bee-1', { domain: 'test' });
      conductor.unregisterBee('bee-1');
      expect(handler).toHaveBeenCalledWith({ beeId: 'bee-1' });
    });
  });

  describe('Task Dispatch', () => {
    it('should dispatch to explicit beeId', async () => {
      const bee = { execute: vi.fn().mockResolvedValue({ output: 'done' }) };
      conductor.registerBee('bee-1', bee);
      const result = await conductor.dispatch('research', {}, { beeId: 'bee-1' });
      expect(result.ok).toBe(true);
      expect(bee.execute).toHaveBeenCalled();
    });

    it('should dispatch by category match', async () => {
      const bee = { category: 'research', execute: vi.fn().mockResolvedValue({ output: 'found' }) };
      conductor.registerBee('researcher', bee);
      const result = await conductor.dispatch('research', { query: 'test' });
      expect(result.ok).toBe(true);
    });

    it('should dispatch by domain match', async () => {
      const bee = { domain: 'coding', execute: vi.fn().mockResolvedValue({ output: 'coded' }) };
      conductor.registerBee('coder', bee);
      const result = await conductor.dispatch('coding', {});
      expect(result.ok).toBe(true);
    });

    it('should fallback to first idle bee', async () => {
      const bee = { execute: vi.fn().mockResolvedValue({ output: 'fallback' }) };
      conductor.registerBee('generic', bee);
      const result = await conductor.dispatch('unknown-type', {});
      expect(result.ok).toBe(true);
    });

    it('should return error when no bee available', async () => {
      const result = await conductor.dispatch('research', {});
      expect(result.ok).toBe(false);
      expect(result.error).toContain('No available bee');
    });

    it('should emit task:dispatched event', async () => {
      const handler = vi.fn();
      conductor.on('task:dispatched', handler);
      conductor.registerBee('bee-1', { execute: vi.fn().mockResolvedValue({}) });
      await conductor.dispatch('test', {});
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        beeId: 'bee-1',
        taskType: 'test',
      }));
    });

    it('should emit task:completed on success', async () => {
      const handler = vi.fn();
      conductor.on('task:completed', handler);
      conductor.registerBee('bee-1', { execute: vi.fn().mockResolvedValue({ ok: true }) });
      await conductor.dispatch('test', {});
      expect(handler).toHaveBeenCalled();
    });

    it('should emit task:failed on error', async () => {
      const handler = vi.fn();
      conductor.on('task:failed', handler);
      conductor.registerBee('bee-1', { execute: vi.fn().mockRejectedValue(new Error('boom')) });
      const result = await conductor.dispatch('test', {}, { timeout: 1000 });
      expect(result.ok).toBe(false);
      expect(handler).toHaveBeenCalled();
    });

    it('should handle timeout', async () => {
      conductor.registerBee('slow', {
        execute: () => new Promise(resolve => setTimeout(resolve, 5000)),
      });
      const result = await conductor.dispatch('test', {}, { timeout: 50 });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('timeout');
    }, 10000);

    it('should increment counters', async () => {
      conductor.registerBee('bee-1', { execute: vi.fn().mockResolvedValue({}) });
      await conductor.dispatch('test', {});
      expect(conductor.totalDispatched).toBe(1);
      expect(conductor.totalCompleted).toBe(1);
    });

    it('should cap execution log at 100', async () => {
      conductor.registerBee('bee-1', { execute: vi.fn().mockResolvedValue({}) });
      for (let i = 0; i < 105; i++) {
        await conductor.dispatch('test', {});
      }
      expect(conductor.executionLog.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Heartbeat', () => {
    it('should start heartbeat', () => {
      conductor.startHeartbeat();
      expect(conductor.heartbeatTimer).not.toBeNull();
    });

    it('should stop heartbeat', () => {
      conductor.startHeartbeat();
      conductor.stopHeartbeat();
      expect(conductor.heartbeatTimer).toBeNull();
    });

    it('should not start duplicate heartbeat', () => {
      conductor.startHeartbeat();
      const firstTimer = conductor.heartbeatTimer;
      conductor.startHeartbeat();
      expect(conductor.heartbeatTimer).toBe(firstTimer);
    });
  });

  describe('Status', () => {
    it('should return correct status shape', () => {
      conductor.registerBee('bee-1', { domain: 'test' });
      const status = conductor.getStatus();
      expect(status).toHaveProperty('bees');
      expect(status).toHaveProperty('totalRegistered', 1);
      expect(status).toHaveProperty('totalDispatched', 0);
      expect(status).toHaveProperty('totalCompleted', 0);
      expect(status).toHaveProperty('totalFailed', 0);
      expect(status).toHaveProperty('activeExecutions', 0);
      expect(status).toHaveProperty('heartbeatActive');
      expect(status).toHaveProperty('priorityModes');
    });
  });

  describe('Agent Handoff (RED-03)', () => {
    it('should return error when no redis pool wired', async () => {
      const result = await conductor.agentHandoff('bee-1', 'bee-2', { task: 'test' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Redis pool not wired');
    });

    it('should delegate to redis pool when wired', async () => {
      const mockPool = {
        agentHandoff: vi.fn().mockResolvedValue({
          handoffId: 'handoff:test',
          stored: true,
          latencyMs: 5,
        }),
      };
      conductor.setRedisPool(mockPool);
      const result = await conductor.agentHandoff('bee-1', 'bee-2', { task: 'test' });
      expect(result.ok).toBe(true);
      expect(result.handoffId).toBe('handoff:test');
      expect(mockPool.agentHandoff).toHaveBeenCalledWith('bee-1', 'bee-2', { task: 'test' }, {});
    });
  });
});
