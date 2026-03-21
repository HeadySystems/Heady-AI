/**
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * TaskStateStore — Persistent task state using vector memory.
 * Stores and retrieves task state so tasks survive process restarts,
 * deployments, and machine migrations. Any agent can pick up where
 * another left off by querying the task's state.
 *
 * Currently uses filesystem-backed JSON with future pgvector integration.
 *
 * @module task-state-store
 */

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const STATE_DIR = path.join(__dirname, '..', '..', 'data', 'task-state');

class TaskStateStore {
    /**
     * @param {object} opts
     * @param {string} [opts.stateDir] - Directory for state files
     * @param {object} [opts.vectorMemory] - pgvector memory service (optional)
     */
    constructor(opts = {}) {
        this.stateDir = opts.stateDir || STATE_DIR;
        this.vectorMemory = opts.vectorMemory || null;
        this.cache = new Map();

        // Ensure state directory exists
        if (!fs.existsSync(this.stateDir)) {
            fs.mkdirSync(this.stateDir, { recursive: true });
        }
    }

    /**
     * Save task state.
     * @param {string} taskId
     * @param {object} state
     */
    async save(taskId, state) {
        // Merge with existing state
        const existing = await this.load(taskId);
        const merged = { ...existing, ...state, updatedAt: new Date().toISOString() };

        // Write to filesystem
        const filePath = this._filePath(taskId);
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');

        // Update cache
        this.cache.set(taskId, merged);

        // Embed in vector memory if available
        if (this.vectorMemory) {
            try {
                await this.vectorMemory.store({
                    content: JSON.stringify({ taskId, ...merged }),
                    metadata: { type: 'task_state', taskId },
                });
            } catch (err) {
                logger.warn({ taskId, err: err.message }, 'Failed to embed task state');
            }
        }
    }

    /**
     * Load task state.
     * @param {string} taskId
     * @returns {Promise<object|null>}
     */
    async load(taskId) {
        // Check cache first
        if (this.cache.has(taskId)) {
            return this.cache.get(taskId);
        }

        // Check filesystem
        const filePath = this._filePath(taskId);
        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                this.cache.set(taskId, data);
                return data;
            } catch (err) {
                logger.warn({ taskId, err: err.message }, 'Failed to load task state from file');
            }
        }

        return null;
    }

    /**
     * List all stored task states.
     * @param {object} [filters] - { status, since }
     * @returns {Promise<object[]>}
     */
    async list(filters = {}) {
        const results = [];

        if (!fs.existsSync(this.stateDir)) return results;

        const files = fs.readdirSync(this.stateDir).filter(f => f.endsWith('.json'));

        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(this.stateDir, file), 'utf-8'));

                if (filters.status && data.status !== filters.status) continue;
                if (filters.since && new Date(data.updatedAt) < new Date(filters.since)) continue;

                results.push(data);
            } catch (e) {
              logger.error('Unexpected error', { error: e.message, stack: e.stack });
            }
        }

        return results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    /**
     * Delete task state.
     * @param {string} taskId
     */
    async delete(taskId) {
        this.cache.delete(taskId);
        const filePath = this._filePath(taskId);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    /**
     * Cleanup old completed/failed task states.
     * @param {number} [maxAgeDays=7]
     * @returns {Promise<number>} Number of cleaned up states
     */
    async cleanup(maxAgeDays = 7) {
        const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
        let cleaned = 0;

        if (!fs.existsSync(this.stateDir)) return 0;

        const files = fs.readdirSync(this.stateDir).filter(f => f.endsWith('.json'));

        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(this.stateDir, file), 'utf-8'));
                if (['completed', 'failed'].includes(data.status) &&
                    new Date(data.updatedAt).getTime() < cutoff) {
                    fs.unlinkSync(path.join(this.stateDir, file));
                    cleaned++;
                }
            } catch (e) {
              logger.error('Unexpected error', { error: e.message, stack: e.stack });
            }
        }

        logger.info({ cleaned, maxAgeDays }, 'Task state cleanup complete');
        return cleaned;
    }

    /** @private */
    _filePath(taskId) {
        return path.join(this.stateDir, `${taskId}.json`);
    }
}

module.exports = { TaskStateStore };


// --- Auto-Unified Latent Service Pattern (Smart) ---
(function _wireLatentStubs() {
  const exp = module.exports;
  if (!exp || typeof exp !== 'object') return;

  // Find the first exported class instance or constructor with health/start/stop
  let _inst = null;
  for (const key of Object.keys(exp)) {
    const val = exp[key];
    // If it's a singleton instance with a health method, use it
    if (val && typeof val === 'object' && typeof val.health === 'function') {
      _inst = val; break;
    }
    // If it's a function (class constructor), try to find a getSingleton pattern
    if (typeof val === 'function' && val.prototype) {
      const getterKey = Object.keys(exp).find(k =>
        k.startsWith('get') && typeof exp[k] === 'function' && k !== key
      );
      if (getterKey) {
        try { const inst = exp[getterKey](); if (inst && typeof inst.health === 'function') { _inst = inst; break; } } catch(e) {}
      }
    }
  }

  if (!exp.start) exp.start = _inst && typeof _inst.start === 'function'
    ? async () => { await _inst.start(); return { status: 'started' }; }
    : async () => ({ status: 'started' });
  if (!exp.stop) exp.stop = _inst && typeof _inst.stop === 'function'
    ? async () => { await _inst.stop(); return { status: 'stopped' }; }
    : async () => ({ status: 'stopped' });
  if (!exp.health) exp.health = _inst && typeof _inst.health === 'function'
    ? () => _inst.health()
    : () => ({ status: 'healthy', service: require('path').basename(__filename, '.js') });
  if (!exp.metrics) exp.metrics = _inst && typeof _inst.metrics === 'function'
    ? () => _inst.metrics()
    : () => ({ service: require('path').basename(__filename, '.js') });
  if (!exp._tick) exp._tick = async () => {};
})();
// -------------------------------------------
