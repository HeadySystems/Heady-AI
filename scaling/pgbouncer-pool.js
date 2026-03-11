/**
 * PgBouncerPool — PostgreSQL Connection Pool Manager
 * Manages connection pooling via PgBouncer with φ-scaled pool sizes,
 * health monitoring, query routing, and automatic failover.
 * All constants φ-derived. CSL gates replace boolean. ESM only.
 * Author: Eric Haywood
 */
import { createHash } from 'crypto';

// ── φ-Math Foundation ────────────────────────────────────────────
const PHI = 1.6180339887;
const PSI = 0.6180339887;
const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

function phiThreshold(level, spread = PSI2) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  CRITICAL: phiThreshold(4),
  HIGH: phiThreshold(3),
  MEDIUM: phiThreshold(2),
  LOW: phiThreshold(1),
  MINIMUM: phiThreshold(0),
};

function cslGate(value, score, tau = CSL_THRESHOLDS.MEDIUM, temp = Math.pow(PSI, 3)) {
  return value * (1 / (1 + Math.exp(-(score - tau) / temp)));
}

function hashSHA256(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const delay = baseMs * Math.pow(PHI, attempt);
  const jitter = (Math.random() - PSI) * PSI2 * delay;
  return Math.min(maxMs, delay + jitter);
}

// ── Connection Pool Tiers ────────────────────────────────────────
const POOL_TIERS = {
  primary: {
    mode: 'transaction',
    maxConnections: FIB[10],    // 55
    minConnections: FIB[5],     // 5
    reservePool: FIB[4],        // 3
    idleTimeout: FIB[10] * 1000,// 55s
    queryTimeout: FIB[9] * 1000,// 34s
    role: 'read-write',
  },
  replica: {
    mode: 'transaction',
    maxConnections: FIB[11],    // 89
    minConnections: FIB[6],     // 8
    reservePool: FIB[5],        // 5
    idleTimeout: FIB[11] * 1000,// 89s
    queryTimeout: FIB[10] * 1000,// 55s
    role: 'read-only',
  },
  analytics: {
    mode: 'session',
    maxConnections: FIB[8],     // 21
    minConnections: FIB[3],     // 2
    reservePool: FIB[3],        // 2
    idleTimeout: FIB[12] * 1000,// 144s
    queryTimeout: FIB[12] * 1000,// 144s
    role: 'read-only',
  },
};

// ── Connection ───────────────────────────────────────────────────
class PooledConnection {
  constructor(id, tier, config) {
    this.id = id;
    this.tier = tier;
    this.state = 'idle'; // idle | active | draining | closed
    this.createdAt = Date.now();
    this.lastUsedAt = Date.now();
    this.queryCount = 0;
    this.errorCount = 0;
    this.totalLatencyMs = 0;
    this.host = config.host ?? process.env.PGBOUNCER_HOST ?? 'pgbouncer';
    this.port = config.port ?? 6432; // PgBouncer default
    this.database = config.database ?? 'heady';
  }

  acquire() {
    this.state = 'active';
    this.lastUsedAt = Date.now();
    return this;
  }

  release() {
    this.state = 'idle';
    this.lastUsedAt = Date.now();
  }

  recordQuery(latencyMs, success) {
    this.queryCount++;
    this.totalLatencyMs += latencyMs;
    if (!success) this.errorCount++;
  }

  isStale(idleTimeout) {
    return this.state === 'idle' && (Date.now() - this.lastUsedAt) > idleTimeout;
  }

  close() {
    this.state = 'closed';
  }

  stats() {
    return {
      id: this.id,
      tier: this.tier,
      state: this.state,
      queryCount: this.queryCount,
      errorCount: this.errorCount,
      avgLatencyMs: this.queryCount > 0 ? this.totalLatencyMs / this.queryCount : 0,
      uptimeMs: Date.now() - this.createdAt,
      idleMs: Date.now() - this.lastUsedAt,
    };
  }
}

// ── Connection Pool ──────────────────────────────────────────────
class ConnectionPool {
  constructor(tier, config) {
    this.tier = tier;
    this.config = { ...POOL_TIERS[tier], ...config };
    this.connections = new Map();
    this.nextId = 1;
    this.waitQueue = [];
    this.totalAcquired = 0;
    this.totalReleased = 0;
    this.totalTimeouts = 0;
  }

  _createConnection() {
    const id = `conn-${this.tier}-${this.nextId++}`;
    const conn = new PooledConnection(id, this.tier, this.config);
    this.connections.set(id, conn);
    return conn;
  }

  acquire() {
    // Find idle connection
    for (const conn of this.connections.values()) {
      if (conn.state === 'idle') {
        this.totalAcquired++;
        return conn.acquire();
      }
    }

    // Create new if under max
    if (this.connections.size < this.config.maxConnections) {
      const conn = this._createConnection();
      this.totalAcquired++;
      return conn.acquire();
    }

    // Check reserve pool
    const activeCount = [...this.connections.values()].filter(c => c.state === 'active').length;
    const reserveAvailable = this.config.maxConnections + this.config.reservePool - activeCount;
    if (reserveAvailable > 0 && this.connections.size < this.config.maxConnections + this.config.reservePool) {
      const conn = this._createConnection();
      this.totalAcquired++;
      return conn.acquire();
    }

    this.totalTimeouts++;
    return null; // Pool exhausted
  }

  release(connId) {
    const conn = this.connections.get(connId);
    if (conn) {
      conn.release();
      this.totalReleased++;

      // Serve waiting requests
      if (this.waitQueue.length > 0) {
        const waiter = this.waitQueue.shift();
        const acquired = conn.acquire();
        waiter.resolve(acquired);
      }
    }
  }

  reapStale() {
    const reaped = [];
    for (const [id, conn] of this.connections) {
      if (conn.isStale(this.config.idleTimeout) && this.connections.size > this.config.minConnections) {
        conn.close();
        this.connections.delete(id);
        reaped.push(id);
      }
    }
    return reaped;
  }

  drain() {
    for (const conn of this.connections.values()) {
      if (conn.state === 'idle') {
        conn.close();
      } else {
        conn.state = 'draining';
      }
    }
  }

  stats() {
    const states = { idle: 0, active: 0, draining: 0, closed: 0 };
    for (const conn of this.connections.values()) {
      states[conn.state] = (states[conn.state] ?? 0) + 1;
    }
    return {
      tier: this.tier,
      role: this.config.role,
      mode: this.config.mode,
      totalConnections: this.connections.size,
      maxConnections: this.config.maxConnections,
      states,
      totalAcquired: this.totalAcquired,
      totalReleased: this.totalReleased,
      totalTimeouts: this.totalTimeouts,
      waitQueueSize: this.waitQueue.length,
    };
  }
}

// ── PgBouncer Pool Manager ───────────────────────────────────────
class PgBouncerPool {
  constructor(config = {}) {
    this.pools = new Map();
    this.pools.set('primary', new ConnectionPool('primary', config.primary));
    this.pools.set('replica', new ConnectionPool('replica', config.replica));
    this.pools.set('analytics', new ConnectionPool('analytics', config.analytics));
    this.queryRouter = new QueryRouter();
    this.auditLog = [];
    this.maxAuditEntries = FIB[16];
    this.healthCheckIntervalMs = config.healthCheckIntervalMs ?? FIB[9] * 1000; // 34s
  }

  _audit(action, detail) {
    const entry = { ts: Date.now(), action, detail, hash: hashSHA256({ action, detail, ts: Date.now() }) };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-FIB[14]);
    }
  }

  acquire(queryType = 'read') {
    const tier = this.queryRouter.route(queryType);
    const pool = this.pools.get(tier);
    if (!pool) return { error: `Unknown pool tier: ${tier}` };

    const conn = pool.acquire();
    if (!conn) {
      this._audit('pool-exhausted', { tier, queryType });
      // Fallback to primary if replica exhausted
      if (tier !== 'primary') {
        const fallback = this.pools.get('primary').acquire();
        if (fallback) {
          this._audit('fallback-primary', { originalTier: tier });
          return fallback;
        }
      }
      return { error: `Pool ${tier} exhausted` };
    }

    this._audit('acquire', { tier, connId: conn.id });
    return conn;
  }

  release(connId) {
    for (const pool of this.pools.values()) {
      if (pool.connections.has(connId)) {
        pool.release(connId);
        return true;
      }
    }
    return false;
  }

  reapAll() {
    const results = {};
    for (const [tier, pool] of this.pools) {
      results[tier] = pool.reapStale();
    }
    this._audit('reap', results);
    return results;
  }

  health() {
    const poolStats = {};
    for (const [tier, pool] of this.pools) {
      poolStats[tier] = pool.stats();
    }
    return {
      pools: poolStats,
      auditLogSize: this.auditLog.length,
    };
  }
}

// ── Query Router ─────────────────────────────────────────────────
class QueryRouter {
  route(queryType) {
    const routing = {
      'write': 'primary',
      'read': 'replica',
      'read-write': 'primary',
      'analytics': 'analytics',
      'batch': 'analytics',
      'migration': 'primary',
      'vector-search': 'replica',
    };
    return routing[queryType] ?? 'primary';
  }
}

export default PgBouncerPool;
export { PgBouncerPool, ConnectionPool, PooledConnection, QueryRouter, POOL_TIERS };
