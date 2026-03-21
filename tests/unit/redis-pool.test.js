import { vi } from "vitest";
'use strict';

/**
 * Redis Pool Unit Tests (TEST-09)
 * Tests both RedisPoolManager (resilience) and RedisConnectionPool (services)
 */

describe('RedisPoolManager (src/resilience)', () => {
  let RedisPoolManager;

  beforeEach(() => {
    vi.resetModules();
    vi.mock('../../src/shared/phi-math', () => ({ PHI_TIMING: { CYCLE: 29034 } }));
    vi.mock('../../src/utils/logger', () => ({
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    }));
    const mod = require('../../src/resilience/redis-pool');
    RedisPoolManager = mod.RedisPoolManager || mod;
  });

  it('should create pool with defaults', () => {
    const pool = new RedisPoolManager();
    expect(pool.maxConnections).toBe(20);
    expect(pool.minConnections).toBe(5);
    expect(pool.pool).toEqual([]);
    expect(pool.active).toBe(0);
  });

  it('should acquire a connection', async () => {
    const pool = new RedisPoolManager();
    const conn = await pool.acquire();
    expect(conn).toBeDefined();
    expect(conn.id).toContain('redis-');
    expect(pool.active).toBe(1);
    expect(pool.totalAcquired).toBe(1);
  });

  it('should release a connection', async () => {
    const pool = new RedisPoolManager();
    const conn = await pool.acquire();
    pool.release(conn);
    expect(pool.active).toBe(0);
    expect(pool.totalReleased).toBe(1);
  });

  it('should reuse released connection for waiter', async () => {
    const pool = new RedisPoolManager({ maxConnections: 1 });
    const conn1 = await pool.acquire();

    // Start waiting for connection
    const acquirePromise = pool.acquire();

    // Release — should give to waiter
    pool.release(conn1);
    const conn2 = await acquirePromise;
    expect(conn2).toBeDefined();
  });

  it('should timeout on acquire when pool exhausted', async () => {
    const pool = new RedisPoolManager({ maxConnections: 1 });
    await pool.acquire();
    await expect(pool.acquire()).rejects.toThrow('timeout');
  }, 10000);

  it('should return correct status', async () => {
    const pool = new RedisPoolManager();
    const conn = await pool.acquire();
    const status = pool.getStatus();
    expect(status.ok).toBe(true);
    expect(status.active).toBe(1);
    expect(status.totalAcquired).toBe(1);
    expect(status.maxConnections).toBe(20);
    pool.release(conn);
  });
});

describe('RedisPoolV3 (src/resilience)', () => {
  let RedisPoolV3;

  beforeEach(() => {
    vi.resetModules();
    // Force mock fallback by making ioredis unavailable
    vi.mock('ioredis', () => { throw new Error('mocked out'); });
    const mod = require('../../src/resilience/redis-pool-v3');
    RedisPoolV3 = mod.RedisPoolV3;
  });

  it('should create pool with tier config', () => {
    const pool = new RedisPoolV3();
    expect(pool.pools.hot).toBeDefined();
    expect(pool.pools.warm).toBeDefined();
    expect(pool.pools.cold).toBeDefined();
  });

  function createPool() {
    const pool = new RedisPoolV3();
    pool.on('error', () => {}); // suppress unhandled EventEmitter errors in test
    return pool;
  }

  it('should initialize and pre-warm', async () => {
    const pool = createPool();
    await pool.initialize();
    expect(pool._initialized).toBe(true);
    expect(pool.pools.hot.connections.length).toBeGreaterThanOrEqual(1);
    await pool.shutdown();
  });

  it('should acquire from hot pool', async () => {
    const pool = createPool();
    await pool.initialize();
    const conn = await pool.acquire('hot');
    expect(conn).toBeDefined();
    expect(conn._poolId).toContain('redis-v3-hot');
    pool.release(conn);
    await pool.shutdown();
  });

  it('should fall back to lower tiers', async () => {
    const pool = createPool();
    await pool.initialize();
    const conn = await pool.acquire('cold');
    expect(conn).toBeDefined();
    expect(conn._tier).toBe('cold');
    pool.release(conn);
    await pool.shutdown();
  });

  it('should perform agent handoff', async () => {
    const pool = createPool();
    await pool.initialize();
    const result = await pool.agentHandoff('agent-1', 'agent-2', { task: 'test' });
    expect(result.handoffId).toContain('handoff:');
    expect(result.stored).toBe(true);
    expect(result.latencyMs).toBeDefined();
    expect(pool.metrics.totalHandoffs).toBe(1);
    await pool.shutdown();
  });

  it('should return health metrics', async () => {
    const pool = createPool();
    await pool.initialize();
    const health = pool.getHealth();
    expect(health.ok).toBe(true);
    expect(health.pools.hot).toBeDefined();
    expect(health.pools.warm).toBeDefined();
    expect(health.pools.cold).toBeDefined();
    expect(health.metrics.totalAcquired).toBeDefined();
    await pool.shutdown();
  });

  it('should withConnection auto-release', async () => {
    const pool = createPool();
    await pool.initialize();
    const result = await pool.withConnection(async (conn) => {
      return conn._poolId;
    });
    expect(result).toContain('redis-v3');
    await pool.shutdown();
  });

  it('should clean shutdown', async () => {
    const pool = createPool();
    await pool.initialize();
    await pool.acquire('hot');
    await pool.shutdown();
    expect(pool._initialized).toBe(false);
    expect(pool.pools.hot.connections).toHaveLength(0);
  });
});

describe('phiBackoff', () => {
  const { phiBackoff } = require('../../src/resilience/redis-pool-v3');

  it('should increase with attempts', () => {
    const d0 = phiBackoff(0);
    const d1 = phiBackoff(1);
    const d2 = phiBackoff(2);
    expect(d1).toBeGreaterThan(d0);
    expect(d2).toBeGreaterThan(d1);
  });

  it('should cap at 30000ms', () => {
    expect(phiBackoff(100)).toBeLessThanOrEqual(30000);
  });
});
