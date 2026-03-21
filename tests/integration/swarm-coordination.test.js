import { vi } from "vitest";
'use strict';

/**
 * Swarm Coordination Integration Tests (TEST-12)
 * Tests HeadyConductor + SwarmConsensus working together.
 */

vi.mock('../../src/shared/phi-math', () => ({
  PHI_TIMING: { CYCLE: 29034 },
}));

vi.mock('../../src/utils/logger', () => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}));

const { HeadyConductor } = require('../../src/orchestration/heady-conductor');

describe('Swarm Coordination Integration', () => {
  let conductor;

  beforeEach(() => {
    conductor = new HeadyConductor();
  });

  afterEach(() => {
    conductor.stopHeartbeat();
  });

  it('should register multiple bees and dispatch to correct one', async () => {
    const researchBee = {
      category: 'research',
      execute: vi.fn().mockResolvedValue({ findings: ['data1'] }),
    };
    const codingBee = {
      category: 'coding',
      execute: vi.fn().mockResolvedValue({ code: 'function(){}' }),
    };

    conductor.registerBee('researcher', researchBee);
    conductor.registerBee('coder', codingBee);

    const r1 = await conductor.dispatch('research', { query: 'test' });
    expect(r1.ok).toBe(true);
    expect(researchBee.execute).toHaveBeenCalled();
    expect(codingBee.execute).not.toHaveBeenCalled();

    const r2 = await conductor.dispatch('coding', { task: 'build' });
    expect(r2.ok).toBe(true);
    expect(codingBee.execute).toHaveBeenCalled();
  });

  it('should handle concurrent dispatches', async () => {
    // Register 3 bees so all concurrent dispatches can find an idle bee
    conductor.registerBee('worker-1', { execute: vi.fn().mockResolvedValue({ ok: true }) });
    conductor.registerBee('worker-2', { execute: vi.fn().mockResolvedValue({ ok: true }) });
    conductor.registerBee('worker-3', { execute: vi.fn().mockResolvedValue({ ok: true }) });

    const results = await Promise.all([
      conductor.dispatch('task', { id: 1 }),
      conductor.dispatch('task', { id: 2 }),
      conductor.dispatch('task', { id: 3 }),
    ]);

    expect(results.filter(r => r.ok).length).toBeGreaterThanOrEqual(1);
    expect(conductor.totalDispatched).toBe(3);
  });

  it('should track execution state correctly', async () => {
    const bee = {
      execute: vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ done: true }), 50))
      ),
    };
    conductor.registerBee('slow-bee', bee);

    const promise = conductor.dispatch('task', {});
    expect(conductor.activeExecutions.size).toBe(1);

    await promise;
    expect(conductor.activeExecutions.size).toBe(0);
  });

  it('should handle bee failure gracefully', async () => {
    const failBee = {
      execute: vi.fn().mockRejectedValue(new Error('bee crashed')),
    };
    conductor.registerBee('fail-bee', failBee);

    const result = await conductor.dispatch('task', {}, { timeout: 1000 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('bee crashed');
    expect(conductor.totalFailed).toBe(1);

    // Bee should be idle again
    expect(conductor.bees.get('fail-bee').status).toBe('idle');
  });

  it('should support admin dispatch (God Mode)', async () => {
    const bee = { execute: vi.fn().mockResolvedValue({ admin: true }) };
    conductor.registerBee('admin-bee', bee);

    const handler = vi.fn();
    conductor.on('admin:dispatch', handler);

    const result = await conductor.adminDispatch('admin-task', { urgent: true });
    expect(result.ok).toBe(true);
    expect(handler).toHaveBeenCalled();
  });

  it('should maintain correct status after operations', async () => {
    const bee = { execute: vi.fn().mockResolvedValue({}) };
    conductor.registerBee('bee-1', bee);
    conductor.registerBee('bee-2', { domain: 'other' });

    await conductor.dispatch('task', {});

    const status = conductor.getStatus();
    expect(status.totalRegistered).toBe(2);
    expect(status.totalDispatched).toBe(1);
    expect(status.totalCompleted).toBe(1);
    expect(status.bees['bee-1']).toBeDefined();
    expect(status.bees['bee-2']).toBeDefined();
  });
});
