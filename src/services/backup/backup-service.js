/**
 * Heady™ Backup Service v6.0
 * Port 3388 — Automated backup of pgvector data, NATS streams, and vector indices
 * Phi-timed scheduling via HeadyScheduler, encrypted at rest
 * 
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const http = require('http');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createLogger } = require('../../../shared/logger');
const { HealthProbe } = require('../../../shared/health');
const {
  PHI, PSI, fib, phiBackoffWithJitter,
  CSL_THRESHOLDS, SERVICE_PORTS, TIMING,
} = require('../../../shared/phi-math');

const execFileAsync = promisify(execFile);
const logger = createLogger('backup-service');
const PORT = SERVICE_PORTS.HEADY_BACKUP || 3388;

// ═══════════════════════════════════════════════════════════
// CONFIGURATION — Phi-Scaled
// ═══════════════════════════════════════════════════════════

const BACKUP_CONFIG = {
  backupDir: process.env.BACKUP_DIR || '/data/backups',
  
  // Schedule intervals in milliseconds
  schedules: {
    full:        fib(11) * 3600 * 1000,    // Every 89 hours (~3.7 days)
    incremental: fib(8) * 3600 * 1000,     // Every 21 hours
    vectorIndex: fib(12) * 3600 * 1000,    // Every 144 hours (~6 days)
  },
  
  // Retention in hours
  retention: {
    full:        fib(14) * 24,              // 377 days
    incremental: fib(11) * 24,              // 89 days
    vectorIndex: fib(12) * 24,              // 144 days
  },
  
  maxConcurrentBackups: fib(4),             // 3 concurrent
  compressionLevel: fib(6),                 // 8 (gzip level)
  maxRetries: fib(5),                       // 5 retries
  
  // Database config
  pgHost: process.env.PG_HOST || 'heady-pgbouncer',
  pgPort: parseInt(process.env.PG_PORT, 10) || 5432,
  pgDatabase: process.env.PG_DATABASE || 'heady_vectors',
  pgUser: process.env.PG_USER || 'heady',
};

// ═══════════════════════════════════════════════════════════
// BACKUP SERVICE
// ═══════════════════════════════════════════════════════════

class BackupService {
  constructor(config = {}) {
    this.config = { ...BACKUP_CONFIG, ...config };
    this.server = null;
    this.health = new HealthProbe('backup-service');
    this.scheduleTimers = new Map();
    this.runningBackups = new Map();
    this.history = [];
    this.maxHistory = fib(12);  // 144 entries
    this.encryptionKey = null;
  }

  async start(encryptionKey) {
    this.encryptionKey = encryptionKey;
    
    // Ensure backup directory exists
    await fs.promises.mkdir(this.config.backupDir, { recursive: true });

    this.server = http.createServer((req, res) => this._handleRequest(req, res));

    return new Promise((resolve) => {
      this.server.listen(PORT, () => {
        logger.info({ message: 'Backup Service started', port: PORT });
        this.health.markReady();
        this._startSchedules();
        resolve();
      });
    });
  }

  _startSchedules() {
    for (const [type, intervalMs] of Object.entries(this.config.schedules)) {
      const timer = setInterval(() => {
        this.runBackup(type).catch(err => {
          logger.error({ message: 'Scheduled backup failed', type, error: err.message });
        });
      }, intervalMs);

      if (timer.unref) timer.unref();
      this.scheduleTimers.set(type, timer);

      logger.info({
        message: 'Backup schedule registered',
        type,
        intervalHours: Math.round(intervalMs / 3600000),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // BACKUP EXECUTION
  // ═══════════════════════════════════════════════════════════

  async runBackup(type = 'full') {
    const backupId = `${type}-${Date.now()}-${crypto.randomBytes(fib(5)).toString('hex')}`;
    
    if (this.runningBackups.size >= this.config.maxConcurrentBackups) {
      logger.warn({ message: 'Max concurrent backups reached, skipping', type, running: this.runningBackups.size });
      return null;
    }

    const record = {
      id: backupId,
      type,
      status: 'running',
      startedAt: Date.now(),
      completedAt: null,
      filePath: null,
      fileSize: 0,
      checksum: null,
      encrypted: !!this.encryptionKey,
      tables: [],
      error: null,
    };

    this.runningBackups.set(backupId, record);
    logger.info({ message: 'Backup started', backupId, type });

    try {
      let filePath;

      switch (type) {
        case 'full':
          filePath = await this._runFullBackup(backupId);
          record.tables = ['embeddings', 'sessions', 'agent_state', 'task_history', 'patterns', 'drift_log', 'audit_log', 'backups'];
          break;

        case 'incremental':
          filePath = await this._runIncrementalBackup(backupId);
          record.tables = ['embeddings', 'task_history', 'audit_log'];
          break;

        case 'vectorIndex':
          filePath = await this._runVectorIndexBackup(backupId);
          record.tables = ['embeddings', 'patterns'];
          break;

        default:
          throw new Error(`Unknown backup type: ${type}`);
      }

      // Encrypt if key available
      if (this.encryptionKey) {
        filePath = await this._encryptFile(filePath);
      }

      // Get file stats
      const stat = await fs.promises.stat(filePath);
      const checksum = await this._checksumFile(filePath);

      record.status = 'completed';
      record.completedAt = Date.now();
      record.filePath = filePath;
      record.fileSize = stat.size;
      record.checksum = checksum;

      logger.info({
        message: 'Backup completed',
        backupId,
        type,
        fileSize: stat.size,
        durationMs: record.completedAt - record.startedAt,
      });
    } catch (error) {
      record.status = 'failed';
      record.completedAt = Date.now();
      record.error = error.message;

      logger.error({
        message: 'Backup failed',
        backupId,
        type,
        error: error.message,
      });
    } finally {
      this.runningBackups.delete(backupId);
      this._addToHistory(record);
    }

    // Cleanup old backups
    await this._cleanupOldBackups(type);

    return record;
  }

  async _runFullBackup(backupId) {
    const filename = `heady-full-${backupId}.sql.gz`;
    const filePath = path.join(this.config.backupDir, filename);
    
    let lastError = null;
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        await execFileAsync('pg_dump', [
          '-h', this.config.pgHost,
          '-p', String(this.config.pgPort),
          '-U', this.config.pgUser,
          '-d', this.config.pgDatabase,
          '-n', 'heady',
          '--format=custom',
          `--compress=${this.config.compressionLevel}`,
          '-f', filePath,
        ], {
          env: { ...process.env, PGPASSWORD: process.env.PG_PASSWORD },
          timeout: fib(13) * 1000,  // 233s timeout
        });
        return filePath;
      } catch (error) {
        lastError = error;
        if (attempt < this.config.maxRetries - 1) {
          await new Promise(r => setTimeout(r, phiBackoffWithJitter(attempt)));
        }
      }
    }
    throw lastError;
  }

  async _runIncrementalBackup(backupId) {
    const filename = `heady-incr-${backupId}.sql.gz`;
    const filePath = path.join(this.config.backupDir, filename);
    
    // Get last full backup timestamp
    const lastFull = this.history
      .filter(h => h.type === 'full' && h.status === 'completed')
      .sort((a, b) => b.startedAt - a.startedAt)[0];

    const sinceDate = lastFull
      ? new Date(lastFull.startedAt).toISOString()
      : new Date(Date.now() - fib(8) * 3600000).toISOString();  // 21 hours ago

    await execFileAsync('pg_dump', [
      '-h', this.config.pgHost,
      '-p', String(this.config.pgPort),
      '-U', this.config.pgUser,
      '-d', this.config.pgDatabase,
      '-n', 'heady',
      '--format=custom',
      `--compress=${this.config.compressionLevel}`,
      '-f', filePath,
      '-t', 'heady.embeddings',
      '-t', 'heady.task_history',
      '-t', 'heady.audit_log',
    ], {
      env: { ...process.env, PGPASSWORD: process.env.PG_PASSWORD },
      timeout: fib(12) * 1000,
    });

    return filePath;
  }

  async _runVectorIndexBackup(backupId) {
    const filename = `heady-vectors-${backupId}.sql.gz`;
    const filePath = path.join(this.config.backupDir, filename);

    await execFileAsync('pg_dump', [
      '-h', this.config.pgHost,
      '-p', String(this.config.pgPort),
      '-U', this.config.pgUser,
      '-d', this.config.pgDatabase,
      '-n', 'heady',
      '--format=custom',
      `--compress=${this.config.compressionLevel}`,
      '-f', filePath,
      '-t', 'heady.embeddings',
      '-t', 'heady.patterns',
    ], {
      env: { ...process.env, PGPASSWORD: process.env.PG_PASSWORD },
      timeout: fib(13) * 1000,
    });

    return filePath;
  }

  // ═══════════════════════════════════════════════════════════
  // ENCRYPTION
  // ═══════════════════════════════════════════════════════════

  async _encryptFile(inputPath) {
    const outputPath = inputPath + '.enc';
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(this.encryptionKey).digest();

    const input = fs.createReadStream(inputPath);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const output = fs.createWriteStream(outputPath);

    // Write IV header
    output.write(iv);

    await new Promise((resolve, reject) => {
      input.pipe(cipher).pipe(output);
      output.on('finish', resolve);
      output.on('error', reject);
    });

    // Remove unencrypted file
    await fs.promises.unlink(inputPath);
    return outputPath;
  }

  async _checksumFile(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex').slice(0, fib(11))));  // 89 chars
      stream.on('error', reject);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CLEANUP — Retention-based
  // ═══════════════════════════════════════════════════════════

  async _cleanupOldBackups(type) {
    const retentionHours = this.config.retention[type];
    if (!retentionHours) return;

    const cutoff = Date.now() - retentionHours * 3600000;
    const expired = this.history.filter(h => h.type === type && h.startedAt < cutoff && h.filePath);

    for (const backup of expired) {
      try {
        await fs.promises.unlink(backup.filePath);
        logger.info({ message: 'Old backup removed', backupId: backup.id, type });
      } catch {
        // File may already be deleted
      }
    }
  }

  _addToHistory(record) {
    this.history.push(record);
    while (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HTTP API
  // ═══════════════════════════════════════════════════════════

  _handleRequest(req, res) {
    const url = new URL(req.url, `http://0.0.0.0:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return this._respondJson(res, 200, this.health.getStatus());
    }

    if (req.method === 'GET' && url.pathname === '/status') {
      return this._respondJson(res, 200, this.getStatus());
    }

    if (req.method === 'POST' && url.pathname === '/backup') {
      const type = url.searchParams.get('type') || 'full';
      this.runBackup(type).then(result => {
        this._respondJson(res, 202, result || { error: 'Backup skipped — max concurrent reached' }).catch(err => { /* promise error absorbed */ });
      }).catch(err => {
        this._respondJson(res, 500, { error: err.message });
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/history') {
      return this._respondJson(res, 200, { history: this.history.slice(-fib(8)) });  // Last 21
    }

    this._respondJson(res, 404, { error: 'Not found' });
  }

  getStatus() {
    return {
      running: this.runningBackups.size,
      maxConcurrent: this.config.maxConcurrentBackups,
      historyCount: this.history.length,
      lastBackups: {
        full: this.history.filter(h => h.type === 'full').slice(-1)[0] || null,
        incremental: this.history.filter(h => h.type === 'incremental').slice(-1)[0] || null,
        vectorIndex: this.history.filter(h => h.type === 'vectorIndex').slice(-1)[0] || null,
      },
      schedules: Object.fromEntries(
        Object.entries(this.config.schedules).map(([k, v]) => [k, `${Math.round(v / 3600000)}h`])
      ),
    };
  }

  _respondJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  async shutdown() {
    for (const [, timer] of this.scheduleTimers) {
      clearInterval(timer);
    }
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }
    logger.info({ message: 'Backup Service shut down' });
  }
}

// ═══════════════════════════════════════════════════════════
// STANDALONE
// ═══════════════════════════════════════════════════════════

if (require.main === module) {
  const service = new BackupService();
  service.start(process.env.BACKUP_ENCRYPTION_KEY).catch(err => {
    logger.error({ message: 'Backup Service startup failed', error: err.message });
    process.exit(1);
  });

  process.on('SIGTERM', async () => { await service.shutdown(); process.exit(0); });
  process.on('SIGINT', async () => { await service.shutdown(); process.exit(0); });
}

module.exports = { BackupService, BACKUP_CONFIG };
