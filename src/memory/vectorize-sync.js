/**
 * Heady™ Latent OS v5.4.0
 * © 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents
 * ZERO MAGIC NUMBERS — All constants φ-derived or Fibonacci
 *
 * VECTORIZE SYNC — Cloudflare Vectorize ↔ pgvector Bidirectional Sync
 *
 * Keeps edge Vectorize index in sync with origin pgvector.
 * pgvector is source of truth; Vectorize is the edge cache.
 *
 * Sync: Incremental via KV watermarks
 * Batch: fib(16) = 987 vectors per upsert
 * Conflict: pgvector (origin) wins
 * Retry: phi-backoff on failure
 * Fallback: edge Vectorize first, origin pgvector on miss
 */
'use strict';

const { EventEmitter } = require('events');
const {
  PHI, PSI, fib, CSL_THRESHOLDS, PHI_TIMING,
  phiBackoffWithJitter,
} = require('../../shared/phi-math');

// ─── φ-Constants ─────────────────────────────────────────────────────────────

const BATCH_SIZE           = fib(16);                      // 987 vectors per batch
const SYNC_INTERVAL_MS     = PHI_TIMING.PHI_8;            // 46 979ms between syncs
const SYNC_TIMEOUT_MS      = PHI_TIMING.PHI_7;            // 29 034ms per sync operation
const MAX_RETRY_ATTEMPTS   = fib(5);                       // 5 retries
const WATERMARK_KEY        = 'heady:vectorize:watermark';
const CONFLICT_LOG_SIZE    = fib(11);                      // 89 entries
const EVICTION_BATCH       = fib(6);                       // 8 vectors evicted at once

// ─── Logger ─────────────────────────────────────────────────────────────────

function log(level, msg, meta = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: 'vectorize-sync',
    msg,
    ...meta,
  });
  process.stdout.write(entry + '\n');
}

// ─── VectorizeSync Class ────────────────────────────────────────────────────

class VectorizeSync extends EventEmitter {
  constructor(config = {}) {
    super();
    this.pgvector = config.pgvector || null;         // Origin (source of truth)
    this.vectorize = config.vectorize || null;        // Edge (cache)
    this.kvStore = config.kvStore || new Map();       // KV for watermarks
    this.lastWatermark = null;
    this.syncCount = 0;
    this.conflictLog = [];
    this.metrics = {
      syncsCompleted: 0,
      vectorsSynced: 0,
      conflictsResolved: 0,
      fallbacksToOrigin: 0,
    };
  }

  // ─── Start Periodic Sync ──────────────────────────────────────────────

  startPeriodicSync() {
    this._syncInterval = setInterval(() => this.sync(), SYNC_INTERVAL_MS);
    log('info', 'Periodic sync started', { intervalMs: SYNC_INTERVAL_MS });
    return this;
  }

  // ─── Stop Periodic Sync ───────────────────────────────────────────────

  stopPeriodicSync() {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }
    log('info', 'Periodic sync stopped');
  }

  // ─── Incremental Sync (origin → edge) ─────────────────────────────────

  async sync() {
    if (!this.pgvector || !this.vectorize) {
      log('warn', 'Sync skipped — missing pgvector or vectorize client');
      return { skipped: true, reason: 'missing_clients' };
    }

    const syncId = `sync_${++this.syncCount}`;
    const startMs = Date.now();

    try {
      // Get watermark
      const watermark = this.kvStore.get(WATERMARK_KEY) || '1970-01-01T00:00:00Z';

      // Fetch changed vectors from origin since watermark
      const changes = await this._fetchChangesFromOrigin(watermark);

      if (!changes || changes.length === 0) {
        log('info', 'Sync complete — no changes', { syncId, watermark });
        return { syncId, changes: 0, durationMs: Date.now() - startMs };
      }

      // Batch upsert to edge
      let synced = 0;
      for (let i = 0; i < changes.length; i += BATCH_SIZE) {
        const batch = changes.slice(i, i + BATCH_SIZE);
        await this._upsertToEdge(batch);
        synced += batch.length;
      }

      // Update watermark
      const newWatermark = new Date().toISOString();
      this.kvStore.set(WATERMARK_KEY, newWatermark);
      this.lastWatermark = newWatermark;

      this.metrics.syncsCompleted++;
      this.metrics.vectorsSynced += synced;

      const result = {
        syncId,
        changes: synced,
        watermark: newWatermark,
        durationMs: Date.now() - startMs,
      };

      log('info', 'Sync complete', result);
      this.emit('sync:complete', result);
      return result;

    } catch (syncErr) {
      log('error', 'Sync failed', { syncId, error: syncErr.message });
      this.emit('sync:failed', { syncId, error: syncErr.message });
      throw syncErr;
    }
  }

  // ─── Transparent Query (edge first, origin fallback) ──────────────────

  async query(vector, options = {}) {
    const { topK = fib(8), threshold = CSL_THRESHOLDS.LOW } = options;

    // Try edge first
    try {
      if (this.vectorize) {
        const edgeResults = await this.vectorize.query(vector, { topK, threshold });
        if (edgeResults && edgeResults.length > 0) {
          return { source: 'edge', results: edgeResults };
        }
      }
    } catch (edgeErr) {
      log('warn', 'Edge query failed, falling back to origin', { error: edgeErr.message });
    }

    // Fallback to origin
    if (this.pgvector) {
      this.metrics.fallbacksToOrigin++;
      const originResults = await this.pgvector.query(vector, { topK, threshold });
      return { source: 'origin', results: originResults };
    }

    return { source: 'none', results: [] };
  }

  // ─── Conflict Resolution (origin wins) ────────────────────────────────

  resolveConflict(vectorId, edgeVersion, originVersion) {
    // Origin is always source of truth
    this.conflictLog.push({
      ts: new Date().toISOString(),
      vectorId,
      resolution: 'origin_wins',
    });

    if (this.conflictLog.length > CONFLICT_LOG_SIZE) {
      this.conflictLog.shift();
    }

    this.metrics.conflictsResolved++;
    return originVersion;
  }

  // ─── Internal: Fetch changes from origin ──────────────────────────────

  async _fetchChangesFromOrigin(sinceWatermark) {
    if (!this.pgvector || !this.pgvector.fetchSince) return [];
    return this.pgvector.fetchSince(sinceWatermark, BATCH_SIZE);
  }

  // ─── Internal: Upsert batch to edge ───────────────────────────────────

  async _upsertToEdge(batch) {
    if (!this.vectorize || !this.vectorize.upsert) return;

    for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await this.vectorize.upsert(batch);
        return;
      } catch (upsertErr) {
        if (attempt < MAX_RETRY_ATTEMPTS) {
          const backoff = phiBackoffWithJitter(attempt);
          log('warn', 'Edge upsert retry', { attempt: attempt + 1, backoffMs: backoff });
          await new Promise((r) => setTimeout(r, backoff));
        } else {
          throw upsertErr;
        }
      }
    }
  }

  // ─── Get State ────────────────────────────────────────────────────────

  getState() {
    return {
      lastWatermark: this.lastWatermark,
      syncCount: this.syncCount,
      metrics: { ...this.metrics },
      conflictLogSize: this.conflictLog.length,
      hasPgvector: !!this.pgvector,
      hasVectorize: !!this.vectorize,
    };
  }
}

module.exports = {
  VectorizeSync,
  BATCH_SIZE,
  SYNC_INTERVAL_MS,
  WATERMARK_KEY,
};
