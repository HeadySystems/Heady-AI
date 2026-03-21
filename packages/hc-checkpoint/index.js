const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
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
// ║  FILE: packages/hc-checkpoint/index.js                           ║
// ║  LAYER: packages                                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════
// HC Checkpoint — System Checkpointing and Synchronization
// Validates pipeline state, detects config drift, and records
// checkpoint snapshots for deterministic replay.
// ═══════════════════════════════════════════════════════════════════

const CHECKPOINT_DIR = path.join(__dirname, '../../.checkpoints');
const CONFIGS_DIR = path.join(__dirname, '../../configs');
class HCCheckpoint {
  constructor() {
    this.records = [];
    this.configHashes = new Map();
  }

  /**
   * Create a checkpoint snapshot of the current system state.
   * Records config hashes, pipeline stage, and timestamp.
   */
  checkpoint(stage, context = {}) {
    const record = {
      id: crypto.randomUUID(),
      stage,
      timestamp: new Date().toISOString(),
      configHashes: this.hashConfigs(),
      context,
      status: 'captured'
    };
    this.records.push(record);
    this._persist(record);
    logger.info(`[hc-checkpoint] Checkpoint captured: stage=${stage} id=${record.id}`);
    return record;
  }

  /**
   * Sync checkpoint state — compare current config hashes against
   * the last checkpoint to detect drift.
   */
  sync(referenceId) {
    const currentHashes = this.hashConfigs();
    const reference = referenceId ? this.records.find(r => r.id === referenceId) : this.records[this.records.length - 1];
    if (!reference) {
      logger.info('[hc-checkpoint] No reference checkpoint found; creating initial.');
      return {
        drifted: false,
        initial: true,
        record: this.checkpoint('initial-sync')
      };
    }
    const drifts = [];
    for (const [file, hash] of Object.entries(currentHashes)) {
      if (reference.configHashes[file] && reference.configHashes[file] !== hash) {
        drifts.push({
          file,
          expected: reference.configHashes[file],
          actual: hash
        });
      }
    }
    const result = {
      drifted: drifts.length > 0,
      drifts,
      referenceId: reference.id,
      checkedAt: new Date().toISOString()
    };
    if (drifts.length > 0) {
      logger.warn(`[hc-checkpoint] Config drift detected in ${drifts.length} file(s):`);
      drifts.forEach(d => logger.warn(`  - ${d.file}`));
    } else {
      logger.info('[hc-checkpoint] No config drift detected.');
    }
    return result;
  }

  /**
   * Analyze a checkpoint — validate run state, compare hashes,
   * and produce a status report per the Checkpoint Protocol.
   */
  analyze(stage = 'manual') {
    const currentHashes = this.hashConfigs();
    const lastCheckpoint = this.records[this.records.length - 1];
    const drift = lastCheckpoint ? this.sync(lastCheckpoint.id) : {
      drifted: false,
      initial: true
    };
    return {
      stage,
      analyzedAt: new Date().toISOString(),
      configFileCount: Object.keys(currentHashes).length,
      configHashes: currentHashes,
      drift,
      recordCount: this.records.length,
      lastCheckpoint: lastCheckpoint || null
    };
  }

  /**
   * Return all checkpoint records.
   */
  getRecords() {
    return [...this.records];
  }

  /**
   * Hash all YAML config files in configs/ for drift detection.
   */
  hashConfigs() {
    const hashes = {};
    try {
      if (!fs.existsSync(CONFIGS_DIR)) return hashes;
      const files = fs.readdirSync(CONFIGS_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(CONFIGS_DIR, file), 'utf8');
        hashes[file] = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
      }
    } catch (err) {
      logger.error('[hc-checkpoint] Error hashing configs:', err.message);
    }
    return hashes;
  }

  /**
   * Persist a checkpoint record to disk.
   */
  _persist(record) {
    try {
      if (!fs.existsSync(CHECKPOINT_DIR)) {
        fs.mkdirSync(CHECKPOINT_DIR, {
          recursive: true
        });
      }
      const filePath = path.join(CHECKPOINT_DIR, `${record.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
    } catch (err) {
      logger.error('[hc-checkpoint] Failed to persist checkpoint:', err.message);
    }
  }
}
module.exports = new HCCheckpoint();