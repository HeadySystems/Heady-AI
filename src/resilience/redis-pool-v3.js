'use strict';

/**
 * RedisPoolManager v3 — Phi-Scaled Connection Pooling with Agent Handoff (RED-02)
 *
 * Enhancements over v1/v2:
 *   - Hot/Warm/Cold pool tiers: fib(9)/fib(8)/fib(7) = 34/21/13
 *   - Agent handoff protocol for HeadyConductor task routing
 *   - Connection quality tracking (p50/p95/p99 latency)
 *   - ioredis support with mock fallback
 *   - Phi-exponential backoff on reconnection
 *
 * © 2026 HeadySystems Inc.
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

const PHI = 1.6180339887;
const PSI = 0.6180339887;

// Fibonacci pool sizing
const POOL_TIERS = {
  hot:  { max: 34, min: 5, name: 'hot',  priority: 'high' },    // fib(9)
  warm: { max: 21, min: 3, name: 'warm', priority: 'medium' },  // fib(8)
  cold: { max: 13, min: 1, name: 'cold', priority: 'low' },     // fib(7)
};

/** Phi-exponential backoff with ψ-jitter, capped at 30s */
function phiBackoff(attempt) {
  const base = 1000;
  const delay = base * Math.pow(PHI, attempt);
  const jitter = delay * PSI * Math.random();
  return Math.min(delay + jitter, 30000);
}

class RedisPoolV3 extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      host: config.host || process.env.REDIS_HOST || '0.0.0.0',
      port: parseInt(config.port || process.env.REDIS_PORT || '6379', 10),
      password: config.password || process.env.REDIS_PASSWORD || undefined,
      db: parseInt(config.db || process.env.REDIS_DB || '0', 10),
      keyPrefix: config.keyPrefix || 'heady:',
      ...config,
    };

    this.pools = {
      hot:  { connections: [], inUse: new Set(), waiters: [] },
      warm: { connections: [], inUse: new Set(), waiters: [] },
      cold: { connections: [], inUse: new Set(), waiters: [] },
    };

    this.metrics = {
      totalAcquired: 0,
      totalReleased: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      totalHandoffs: 0,
      latencies: [],
      handoffLatencies: [],
    };

    this._initialized = false;
    this._maintenanceTimer = null;
    this._ioredis = null;
  }

  async initialize() {
    if (this._initialized) return;

    try { this._ioredis = require('ioredis'); } catch { this._ioredis = null; }

    for (let i = 0; i < POOL_TIERS.hot.min; i++) {
      try {
        const conn = await this._createConnection('hot');
        this.pools.hot.connections.push(conn);
      } catch (err) {
        this.emit('error', { tier: 'hot', error: err.message });
      }
    }

    for (let i = 0; i < POOL_TIERS.warm.min; i++) {
      try {
        const conn = await this._createConnection('warm');
        this.pools.warm.connections.push(conn);
      } catch (err) {
        this.emit('error', { tier: 'warm', error: err.message });
      }
    }

    // Maintenance every φ⁴ ≈ 6.85 seconds
    const maintenanceMs = Math.round(Math.pow(PHI, 4) * 1000);
    this._maintenanceTimer = setInterval(() => this._runMaintenance(), maintenanceMs);

    this._initialized = true;
    this.emit('initialized', { tiers: Object.keys(POOL_TIERS) });
  }

  async acquire(tier = 'hot') {
    const startTime = Date.now();
    const tierOrder = tier === 'hot' ? ['hot', 'warm', 'cold'] :
                      tier === 'warm' ? ['warm', 'cold'] : ['cold'];

    for (const t of tierOrder) {
      const pool = this.pools[t];
      const limits = POOL_TIERS[t];

      if (pool.connections.length > 0) {
        const conn = pool.connections.pop();
        if (this._isAlive(conn)) {
          pool.inUse.add(conn);
          this._recordLatency(startTime);
          this.metrics.totalAcquired++;
          return conn;
        }
        this._destroyConnection(conn);
      }

      if (pool.inUse.size + pool.connections.length < limits.max) {
        try {
          const conn = await this._createConnection(t);
          pool.inUse.add(conn);
          this._recordLatency(startTime);
          this.metrics.totalAcquired++;
          return conn;
        } catch { continue; }
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis pool acquire timeout (all tiers exhausted)'));
      }, 5000);

      this.pools.hot.waiters.push({
        resolve: (conn) => { clearTimeout(timeout); this._recordLatency(startTime); resolve(conn); },
        reject,
      });
    });
  }

  release(conn) {
    for (const [, pool] of Object.entries(this.pools)) {
      if (pool.inUse.has(conn)) {
        pool.inUse.delete(conn);
        this.metrics.totalReleased++;

        if (pool.waiters.length > 0) {
          const waiter = pool.waiters.shift();
          pool.inUse.add(conn);
          this.metrics.totalAcquired++;
          waiter.resolve(conn);
          return;
        }

        if (this._isAlive(conn)) {
          conn._lastUsed = Date.now();
          pool.connections.push(conn);
        } else {
          this._destroyConnection(conn);
        }
        return;
      }
    }
  }

  async withConnection(fn, tier = 'hot') {
    const conn = await this.acquire(tier);
    try { return await fn(conn); }
    finally { this.release(conn); }
  }

  /**
   * Agent Handoff — transfer task context between agents via Redis.
   * @param {string} fromAgentId
   * @param {string} toAgentId
   * @param {object} taskContext
   * @param {object} [opts] - { ttlMs, priority }
   * @returns {{ handoffId: string, stored: boolean, latencyMs: number }}
   */
  async agentHandoff(fromAgentId, toAgentId, taskContext, opts = {}) {
    const startTime = Date.now();
    const handoffId = `handoff:${crypto.randomUUID()}`;
    const ttlMs = opts.ttlMs || Math.round(Math.pow(PHI, 8) * 1000); // ~47s
    const priority = opts.priority || 'standard';

    const handoffData = {
      id: handoffId,
      from: fromAgentId,
      to: toAgentId,
      context: taskContext,
      priority,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };

    const tier = priority === 'critical' ? 'hot' : priority === 'high' ? 'warm' : 'cold';

    await this.withConnection(async (conn) => {
      const key = `${this.config.keyPrefix}${handoffId}`;
      const value = JSON.stringify(handoffData);
      if (conn.set) await conn.set(key, value, 'PX', ttlMs);
    }, tier);

    const latencyMs = Date.now() - startTime;
    this.metrics.totalHandoffs++;
    this.metrics.handoffLatencies.push(latencyMs);
    if (this.metrics.handoffLatencies.length > 100) this.metrics.handoffLatencies.shift();

    this.emit('handoff', { handoffId, from: fromAgentId, to: toAgentId, latencyMs });
    return { handoffId, stored: true, latencyMs };
  }

  async getHandoff(handoffId) {
    return this.withConnection(async (conn) => {
      const key = `${this.config.keyPrefix}${handoffId}`;
      if (conn.get) {
        const data = await conn.get(key);
        return data ? JSON.parse(data) : null;
      }
      return null;
    });
  }

  getHealth() {
    const poolStatus = {};
    for (const [tier, pool] of Object.entries(this.pools)) {
      poolStatus[tier] = {
        idle: pool.connections.length,
        inUse: pool.inUse.size,
        waiting: pool.waiters.length,
        max: POOL_TIERS[tier].max,
      };
    }

    return {
      ok: this._initialized,
      pools: poolStatus,
      metrics: {
        totalAcquired: this.metrics.totalAcquired,
        totalReleased: this.metrics.totalReleased,
        totalCreated: this.metrics.totalCreated,
        totalHandoffs: this.metrics.totalHandoffs,
        latencyP50: this._percentile(this.metrics.latencies, 50),
        latencyP95: this._percentile(this.metrics.latencies, 95),
        latencyP99: this._percentile(this.metrics.latencies, 99),
        handoffP50: this._percentile(this.metrics.handoffLatencies, 50),
        handoffP95: this._percentile(this.metrics.handoffLatencies, 95),
      },
    };
  }

  async shutdown() {
    if (this._maintenanceTimer) clearInterval(this._maintenanceTimer);
    for (const pool of Object.values(this.pools)) {
      pool.waiters.forEach(w => w.reject(new Error('Pool shutting down')));
      pool.waiters = [];
      [...pool.connections, ...pool.inUse].forEach(c => this._destroyConnection(c));
      pool.connections = [];
      pool.inUse.clear();
    }
    this._initialized = false;
    this.emit('shutdown');
  }

  // ── Internal ──────────────────────────────────────────────────

  async _createConnection(tier) {
    this.metrics.totalCreated++;

    if (this._ioredis) {
      const Redis = this._ioredis;
      const conn = new Redis({
        host: this.config.host, port: this.config.port,
        password: this.config.password, db: this.config.db,
        keyPrefix: this.config.keyPrefix, lazyConnect: true,
        retryStrategy: (times) => phiBackoff(times),
      });
      await conn.connect();
      conn._poolId = `redis-v3-${tier}-${this.metrics.totalCreated}`;
      conn._tier = tier;
      conn._createdAt = Date.now();
      conn._lastUsed = Date.now();
      conn._alive = true;
      return conn;
    }

    // Mock fallback for environments without ioredis
    const store = new Map();
    return {
      _poolId: `redis-v3-${tier}-${this.metrics.totalCreated}`,
      _tier: tier,
      _createdAt: Date.now(),
      _lastUsed: Date.now(),
      _alive: true,
      async get(key) {
        const entry = store.get(key);
        if (!entry) return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) { store.delete(key); return null; }
        return entry.value;
      },
      async set(key, value, ...args) {
        const entry = { value };
        if (args[0] === 'PX' && args[1]) entry.expiresAt = Date.now() + args[1];
        if (args[0] === 'EX' && args[1]) entry.expiresAt = Date.now() + args[1] * 1000;
        store.set(key, entry);
        return 'OK';
      },
      async del(key) { return store.delete(key) ? 1 : 0; },
      async publish() { return 1; },
      async ping() { return 'PONG'; },
      destroy() { this._alive = false; },
    };
  }

  _isAlive(conn) { return conn && conn._alive !== false && !conn.destroyed; }

  _destroyConnection(conn) {
    this.metrics.totalDestroyed++;
    try {
      if (typeof conn.disconnect === 'function') conn.disconnect();
      else if (typeof conn.destroy === 'function') conn.destroy();
    } catch { /* ignore */ }
  }

  _recordLatency(startTime) {
    const latency = Date.now() - startTime;
    this.metrics.latencies.push(latency);
    if (this.metrics.latencies.length > 100) this.metrics.latencies.shift();
  }

  _percentile(arr, pct) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((pct / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  _runMaintenance() {
    for (const [tierName, pool] of Object.entries(this.pools)) {
      const minConns = POOL_TIERS[tierName].min;
      while (pool.connections.length > minConns) {
        const conn = pool.connections[0];
        const idleMs = Date.now() - (conn._lastUsed || conn._createdAt || 0);
        if (idleMs > Math.pow(PHI, 4) * 1000) {
          pool.connections.shift();
          this._destroyConnection(conn);
        } else { break; }
      }
    }
  }
}

let _instance = null;
function getRedisPoolV3(config) {
  if (!_instance) _instance = new RedisPoolV3(config);
  return _instance;
}

module.exports = { RedisPoolV3, getRedisPoolV3, POOL_TIERS, phiBackoff };
