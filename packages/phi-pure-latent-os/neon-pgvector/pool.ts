// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: packages/phi-pure-latent-os/neon-pgvector/pool.ts                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Neon pgvector Connection Pool
 *
 * Two connection modes:
 *   appPool      — uses DATABASE_URL (-pooler endpoint) for all application traffic.
 *                  Pool min=FIB[3]=2, max=FIB[7]=13.
 *                  Idle timeout: PHI^4 × 1000 ≈ 6854 ms.
 *                  Statement timeout: 30 000 ms.
 *
 *   migrationDb  — uses DATABASE_URL_DIRECT (non-pooler) for migrations only.
 *                  Direct connection, no pooler, required for DDL statements.
 *
 * @module neon-pgvector/pool
 */

import { neon, neonConfig, NeonQueryFunction } from '@neondatabase/serverless';
import { Pool, PoolClient, PoolConfig } from 'pg';
import { PHI, FIB, fibonacciBackoff, phiBackoff } from '../shared/phi-math';

// ─── Constants from φ-math ────────────────────────────────────────────────────

/** Minimum pool connections: FIB[3] = 2 */
const POOL_MIN = FIB[3]; // 2

/** Maximum pool connections: FIB[7] = 13 */
const POOL_MAX = FIB[7]; // 13

/** Idle connection timeout: PHI^4 × 1000 ≈ 6854 ms */
const POOL_IDLE_TIMEOUT_MS = Math.round(Math.pow(PHI, 4) * 1000); // 6854 ms

/** Statement execution timeout: 30 000 ms */
const STATEMENT_TIMEOUT_MS = 30_000;

/** Connection acquire timeout: FIB[7] × 1000 = 13 000 ms */
const CONNECTION_TIMEOUT_MS = FIB[7] * 1000; // 13 000 ms

/** Health check interval: FIB[8] × 1000 = 34 000 ms */
const HEALTH_CHECK_INTERVAL_MS = FIB[8] * 1000; // 34 000 ms

/** Max connection retries: FIB[5] = 8 */
const MAX_CONNECT_RETRIES = FIB[5]; // 8

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PoolHealth {
  healthy: boolean;
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  lastCheckedAt: Date;
  latencyMs: number;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  command: string;
}

// ─── Neon HTTP driver (serverless/edge) ──────────────────────────────────────

let _httpSql: NeonQueryFunction<false, false> | null = null;

/**
 * Get the Neon HTTP SQL executor (edge/serverless safe).
 * Uses DATABASE_URL which must point to the -pooler endpoint.
 */
export function getHttpSql(): NeonQueryFunction<false, false> {
  if (_httpSql) return _httpSql;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL env var is required (must be the -pooler endpoint)');
  }
  if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
    throw new Error('DATABASE_URL must not reference localhost — use the Neon -pooler endpoint');
  }

  // WebSocket is optional in HTTP mode; disable for fetch-based environments
  neonConfig.fetchConnectionCache = true;

  _httpSql = neon(databaseUrl);
  return _httpSql;
}

// ─── pg Pool (Node.js long-running services) ─────────────────────────────────

let _appPool: Pool | null = null;
let _healthTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Get (or create) the application connection pool.
 * Uses DATABASE_URL — must be the Neon -pooler endpoint.
 * Pool: min=FIB[3]=2, max=FIB[7]=13, idleTimeout=PHI^4≈6854ms.
 */
export function getAppPool(): Pool {
  if (_appPool) return _appPool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL env var is required (must be the Neon -pooler endpoint)');
  }
  if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
    throw new Error('DATABASE_URL must not reference localhost — use the Neon -pooler endpoint');
  }

  const poolConfig: PoolConfig = {
    connectionString: databaseUrl,
    min: POOL_MIN,                         // FIB[3] = 2
    max: POOL_MAX,                         // FIB[7] = 13
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,    // PHI^4 ≈ 6854 ms
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS, // 13 000 ms
    statement_timeout: STATEMENT_TIMEOUT_MS,       // 30 000 ms
    // Neon serverless pools require SSL
    ssl: { rejectUnauthorized: false },
  };

  _appPool = new Pool(poolConfig);

  // Log pool events
  _appPool.on('connect', () => {
    console.debug(
      JSON.stringify({
        level: 'debug',
        service: 'neon-pool',
        event: 'client_connected',
        totalCount: _appPool?.totalCount,
        idleCount: _appPool?.idleCount,
      }),
    );
  });

  _appPool.on('acquire', () => {
    console.debug(
      JSON.stringify({
        level: 'debug',
        service: 'neon-pool',
        event: 'client_acquired',
        waitingCount: _appPool?.waitingCount,
      }),
    );
  });

  _appPool.on('error', (err: Error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'neon-pool',
        event: 'pool_error',
        error: err.message,
      }),
    );
  });

  _appPool.on('remove', () => {
    console.debug(
      JSON.stringify({
        level: 'debug',
        service: 'neon-pool',
        event: 'client_removed',
        totalCount: _appPool?.totalCount,
      }),
    );
  });

  // Schedule background health checks
  _healthTimer = setInterval(async () => {
    try {
      await checkPoolHealth();
    } catch {
      // Non-fatal: health check failure is logged inside checkPoolHealth
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  if (_healthTimer.unref) _healthTimer.unref(); // don't block process exit

  console.info(
    JSON.stringify({
      level: 'info',
      service: 'neon-pool',
      event: 'pool_created',
      min: POOL_MIN,
      max: POOL_MAX,
      idleTimeoutMs: POOL_IDLE_TIMEOUT_MS,
      statementTimeoutMs: STATEMENT_TIMEOUT_MS,
      connectionTimeoutMs: CONNECTION_TIMEOUT_MS,
      phi: PHI,
    }),
  );

  return _appPool;
}

// ─── Direct connection for migrations ────────────────────────────────────────

/**
 * Create a direct (non-pooler) database connection for migrations only.
 * Uses DATABASE_URL_DIRECT — must NOT be the pooler endpoint.
 * DDL statements (CREATE TABLE, ALTER TABLE, etc.) require direct connections
 * because pooler endpoints do not support multi-statement transactions reliably.
 */
export async function getMigrationClient(): Promise<PoolClient> {
  const directUrl = process.env.DATABASE_URL_DIRECT;
  if (!directUrl) {
    throw new Error(
      'DATABASE_URL_DIRECT env var is required for migrations (non-pooler endpoint)',
    );
  }
  if (directUrl.includes('localhost') || directUrl.includes('127.0.0.1')) {
    throw new Error(
      'DATABASE_URL_DIRECT must not reference localhost — use the Neon direct endpoint',
    );
  }

  const migrationPool = new Pool({
    connectionString: directUrl,
    min: 1,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    ssl: { rejectUnauthorized: false },
  });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_CONNECT_RETRIES; attempt++) {
    try {
      const client = await migrationPool.connect();
      console.info(
        JSON.stringify({
          level: 'info',
          service: 'neon-pool',
          event: 'migration_client_acquired',
          attempt,
        }),
      );
      return client;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const backoffMs = fibonacciBackoff(attempt, 500);
      console.warn(
        JSON.stringify({
          level: 'warn',
          service: 'neon-pool',
          event: 'migration_connect_retry',
          attempt,
          backoffMs,
          error: lastError.message,
        }),
      );
      await sleep(backoffMs);
    }
  }

  throw new Error(
    `Failed to acquire migration client after ${MAX_CONNECT_RETRIES} attempts: ${lastError?.message}`,
  );
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/**
 * Execute a parameterized query on the application pool.
 * Always use parameterized queries ($1, $2...) — never string interpolation.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  const pool = getAppPool();
  const start = Date.now();
  let attempt = 0;

  while (attempt <= FIB[4]) { // up to 5 retries (FIB[4]=5)
    try {
      const result = await pool.query<T>(text, values);
      const duration = Date.now() - start;

      console.debug(
        JSON.stringify({
          level: 'debug',
          service: 'neon-pool',
          event: 'query_executed',
          rowCount: result.rowCount,
          durationMs: duration,
          attempt,
        }),
      );

      return {
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
        command: result.command,
      };
    } catch (err: unknown) {
      const pgErr = err as { code?: string; message?: string };

      // Don't retry on query errors (syntax, constraint violations, etc.)
      const isTransient =
        pgErr.code === '57P01' || // admin_shutdown
        pgErr.code === '57P03' || // cannot_connect_now
        pgErr.code === '08006' || // connection_failure
        pgErr.code === '08001';   // sqlclient_unable_to_establish_sqlconnection

      if (!isTransient || attempt >= FIB[4]) {
        throw err;
      }

      const backoffMs = phiBackoff(attempt, 200, 10_000);
      console.warn(
        JSON.stringify({
          level: 'warn',
          service: 'neon-pool',
          event: 'query_retry',
          attempt,
          backoffMs,
          pgCode: pgErr.code,
          error: pgErr.message,
        }),
      );
      await sleep(backoffMs);
      attempt++;
    }
  }

  throw new Error('Query retry loop exited unexpectedly');
}

/**
 * Execute a callback within a transaction.
 * Automatically ROLLBACK on error, COMMIT on success.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getAppPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Health Check ─────────────────────────────────────────────────────────────

/**
 * Check pool health by executing SELECT 1.
 * Returns structured health status with latency.
 */
export async function checkPoolHealth(): Promise<PoolHealth> {
  const pool = getAppPool();
  const start = Date.now();

  try {
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;

    const health: PoolHealth = {
      healthy: true,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
      lastCheckedAt: new Date(),
      latencyMs,
    };

    console.debug(
      JSON.stringify({
        level: 'debug',
        service: 'neon-pool',
        event: 'health_check_passed',
        ...health,
      }),
    );

    return health;
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const health: PoolHealth = {
      healthy: false,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
      lastCheckedAt: new Date(),
      latencyMs,
    };

    console.error(
      JSON.stringify({
        level: 'error',
        service: 'neon-pool',
        event: 'health_check_failed',
        error: err instanceof Error ? err.message : String(err),
        ...health,
      }),
    );

    return health;
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

/**
 * Gracefully close the application pool.
 * Should be registered in LIFO cleanup stack — call last registered, execute first.
 */
export async function closePool(): Promise<void> {
  if (_healthTimer) {
    clearInterval(_healthTimer);
    _healthTimer = null;
  }

  if (_appPool) {
    await _appPool.end();
    _appPool = null;
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'neon-pool',
        event: 'pool_closed',
      }),
    );
  }
}

// ─── LIFO shutdown registration ──────────────────────────────────────────────

/** Register pool cleanup handlers. Call once at service startup. */
export function registerPoolShutdown(): void {
  const cleanups: Array<{ name: string; fn: () => Promise<void> }> = [];
  const registerCleanup = (name: string, fn: () => Promise<void>): void => {
    cleanups.unshift({ name, fn }); // unshift = LIFO
  };

  registerCleanup('neon-app-pool', closePool);

  const shutdown = async (signal: string): Promise<void> => {
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'neon-pool',
        event: 'shutdown_initiated',
        signal,
      }),
    );
    for (const { name, fn } of cleanups) {
      try {
        await fn();
        console.info(JSON.stringify({ level: 'info', service: 'neon-pool', event: 'cleanup_complete', name }));
      } catch (err: unknown) {
        console.error(JSON.stringify({ level: 'error', service: 'neon-pool', event: 'cleanup_failed', name, error: err instanceof Error ? err.message : String(err) }));
      }
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
