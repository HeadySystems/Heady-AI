#!/usr/bin/env node

// ============================================================================
// HEADY MIGRATION RUNNER
// scripts/migrate.mjs
//
// Applies SQL migrations in order against Neon Postgres.
// Tracks applied migrations in a _migrations table.
// Supports: up (apply), down (rollback), status (list)
//
// Usage:
//   node scripts/migrate.mjs up          # Apply all pending
//   node scripts/migrate.mjs status      # Show migration status
//   node scripts/migrate.mjs up 001      # Apply specific migration
//
// Environment:
//   DATABASE_URL=postgresql://...  (Neon connection string with SSL)
//
// © 2026 HeadySystems Inc.
// ============================================================================

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../db/migrations');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Example: postgresql://heady:password@ep-cold-snow-aesmiwt9.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require');
  process.exit(1);
}

// Create pool with Neon-appropriate settings
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
  max: 3,                             // minimal pool for migrations
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function ensureMigrationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT NOT NULL
    )
  `);
}

function getChecksum(content) {
  const crypto = await import('node:crypto');
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function getAppliedMigrations() {
  const result = await pool.query('SELECT name, applied_at, checksum FROM _migrations ORDER BY id');
  return new Map(result.rows.map(r => [r.name, r]));
}

function getPendingMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => ({
      name: f,
      path: path.join(MIGRATIONS_DIR, f),
      content: fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8'),
    }));
}

async function up(targetName) {
  await ensureMigrationTable();
  const applied = await getAppliedMigrations();
  const all = getPendingMigrations();

  const pending = all.filter(m => {
    if (applied.has(m.name)) return false;
    if (targetName && !m.name.includes(targetName)) return false;
    return true;
  });

  if (pending.length === 0) {
    console.log('✓ No pending migrations');
    return;
  }

  for (const migration of pending) {
    console.log(`Applying: ${migration.name}...`);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(migration.content);

      const crypto = (await import('node:crypto')).default;
      const checksum = crypto.createHash('sha256').update(migration.content).digest('hex').slice(0, 16);

      await client.query(
        'INSERT INTO _migrations (name, checksum) VALUES ($1, $2)',
        [migration.name, checksum]
      );

      await client.query('COMMIT');
      console.log(`  ✓ Applied: ${migration.name}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ✗ Failed: ${migration.name}`);
      console.error(`    Error: ${err.message}`);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log(`\n✓ ${pending.length} migration(s) applied`);
}

async function status() {
  await ensureMigrationTable();
  const applied = await getAppliedMigrations();
  const all = getPendingMigrations();

  console.log('\nMigration Status:');
  console.log('─'.repeat(60));

  for (const migration of all) {
    const info = applied.get(migration.name);
    if (info) {
      console.log(`  ✓ ${migration.name}  (applied ${info.applied_at.toISOString().split('T')[0]})`);
    } else {
      console.log(`  ○ ${migration.name}  (pending)`);
    }
  }

  const pendingCount = all.filter(m => !applied.has(m.name)).length;
  console.log(`\n${applied.size} applied, ${pendingCount} pending`);
}

// ── CLI ─────────────────────────────────────────────────────────────
const command = process.argv[2] || 'status';
const target = process.argv[3];

try {
  switch (command) {
    case 'up':
      await up(target);
      break;
    case 'status':
      await status();
      break;
    default:
      console.log('Usage: node scripts/migrate.mjs [up|status] [target]');
  }
} catch (err) {
  console.error('Migration error:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
