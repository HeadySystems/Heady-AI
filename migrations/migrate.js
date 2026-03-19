/**
 * Heady™ Database Migration Runner v6.0
 * Sequential migration execution with checksum validation
 * 
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createLogger } = require('../shared/logger');
const { phiBackoffWithJitter, fib } = require('../shared/phi-math');

const logger = createLogger('migrator');

const MIGRATIONS_DIR = path.resolve(__dirname);
const MAX_RETRIES = fib(5);  // 5

async function runMigrations(pgPool) {
  const runStartMs = Date.now();
  logger.info({ message: 'Starting database migrations' });

  // Ensure migrations tracking table exists
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS heady.migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(144) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum VARCHAR(89)
    )
  `);

  // Get applied migrations
  const applied = await pgPool.query('SELECT version, checksum FROM heady.migrations ORDER BY version');
  const appliedVersions = new Map(applied.rows.map(r => [r.version, r.checksum]));

  // Discover migration files
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let migrationsRun = 0;

  for (const file of files) {
    const versionMatch = file.match(/^(\d+)/);
    if (!versionMatch) continue;

    const version = parseInt(versionMatch[1], 10);
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex').slice(0, fib(11));  // 89 chars

    if (appliedVersions.has(version)) {
      const existingChecksum = appliedVersions.get(version);
      if (existingChecksum && existingChecksum !== checksum) {
        logger.error({
          message: 'Migration checksum mismatch — manual intervention required',
          version,
          file,
          expected: existingChecksum,
          actual: checksum,
        });
        throw new Error(`Migration ${file} has been modified after application`);
      }
      logger.debug({ message: 'Migration already applied', version, file });
      continue;
    }

    // Execute migration with retry
    let lastError = null;
    const migrationStartMs = Date.now();
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const attemptStartMs = Date.now();
        await pgPool.query('BEGIN');
        await pgPool.query(sql);
        await pgPool.query(
          'INSERT INTO heady.migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [version, file.replace('.sql', ''), checksum]
        );
        await pgPool.query('COMMIT');

        const elapsedMs = Date.now() - attemptStartMs;
        const totalElapsedMs = Date.now() - migrationStartMs;
        logger.info({ message: 'Migration applied', version, file, attempt, elapsedMs, totalElapsedMs });
        migrationsRun++;
        lastError = null;
        break;
      } catch (error) {
        await pgPool.query('ROLLBACK').catch(() => {});
        lastError = error;

        if (attempt < MAX_RETRIES - 1) {
          const delay = phiBackoffWithJitter(attempt);
          logger.warn({
            message: 'Migration retry',
            version,
            file,
            attempt,
            nextRetryMs: delay,
            error: error.message,
          });
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    if (lastError) {
      const totalElapsedMs = Date.now() - migrationStartMs;
      logger.error({
        message: 'Migration failed after all retries',
        version,
        file,
        totalElapsedMs,
        error: lastError.message,
      });
      throw lastError;
    }
  }

  const runElapsedMs = Date.now() - runStartMs;
  logger.info({ message: 'Migrations complete', migrationsRun, totalApplied: appliedVersions.size + migrationsRun, runElapsedMs });
}

module.exports = { runMigrations };
