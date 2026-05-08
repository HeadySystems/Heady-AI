/**
 * HeadyAuth Database Layer — Neon PostgreSQL + pgvector
 * Auto-creates schema on startup. Connection pooling with phi-scaled limits.
 *
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */
'use strict';

const { Pool } = require('pg');
const { log } = require('./logger');

// Fibonacci-scaled pool: min=2 (fib(3)), max=13 (fib(7))
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  min: 2,
  max: 13,
  idleTimeoutMillis: 55000, // fib(10) = 55 seconds
  connectionTimeoutMillis: 8000, // fib(6) = 8 seconds (×1000)
});

pool.on('error', (err) => {
  log('error', 'db_pool_error', { error: err.message });
});

/**
 * Execute a SQL query.
 * @param {string} text - SQL query
 * @param {any[]} [params] - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1618) { // phi * 1000 — slow query threshold
    log('warn', 'slow_query', { duration, text: text.slice(0, 100) });
  }
  return result;
}

/**
 * Initialize database schema. Creates tables if they don't exist.
 * Called once at startup.
 */
async function initSchema() {
  log('info', 'db_schema_init_start');

  await query('CREATE EXTENSION IF NOT EXISTS vector');
  await query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      onboarding_stage INT NOT NULL DEFAULT 0,
      workspace_mode TEXT NOT NULL DEFAULT 'cloud',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      expires_at BIGINT,
      token_type TEXT,
      scope TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(provider, provider_account_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_token TEXT UNIQUE NOT NULL,
      fingerprint TEXT,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_hash TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      description TEXT,
      last_used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_memory_t2 (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      embedding vector(384),
      metadata JSONB,
      tier TEXT NOT NULL DEFAULT 't2',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      archived_at TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS onboarding_log (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stage INT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      metadata JSONB,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)',
    'CREATE INDEX IF NOT EXISTS idx_memory_t2_user ON user_memory_t2(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_onboarding_user ON onboarding_log(user_id)',
  ];
  for (const sql of indexes) {
    await query(sql);
  }

  // HNSW vector index (m=21 fib(8), ef_construction=89 fib(11))
  try {
    await query(`
      CREATE INDEX IF NOT EXISTS idx_memory_t2_embedding
      ON user_memory_t2 USING hnsw (embedding vector_cosine_ops)
      WITH (m = 21, ef_construction = 89)
    `);
  } catch (err) {
    // Ignore if vector extension not available
    log('warn', 'hnsw_index_skip', { error: err.message });
  }

  log('info', 'db_schema_init_complete');
}

/**
 * Close the database pool.
 */
async function close() {
  await pool.end();
  log('info', 'db_pool_closed');
}

module.exports = { query, initSchema, close };
