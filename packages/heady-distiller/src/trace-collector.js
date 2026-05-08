/**
 * @module trace-collector
 * @description Collects and persists HCFullPipeline execution traces for Stage 22 DISTILL.
 *
 * Storage:
 *   - Neon Postgres (via @neondatabase/serverless)  — durable trace records
 *   - Upstash Redis  (via @upstash/redis)            — hot-cache per variant (TTL: FIB[8]=21 s)
 *
 * Dedup:
 *   A SHA-256 hash of (runId + sorted stage names) is computed and stored as
 *   `trace_hash`. Duplicate submissions within the same variant are detected
 *   and safely no-op (return existing record).
 */

import crypto from 'node:crypto';
import { neon }    from '@neondatabase/serverless';
import { Redis }   from '@upstash/redis';
import { createLogger }        from '../shared/structured-logger.js';
import { TraceCollectionError } from '../shared/errors.js';
import { FIB, PSI, CSL }        from '../shared/phi-math.js';

// ---------------------------------------------------------------------------
// Constants (all phi/Fibonacci derived)
// ---------------------------------------------------------------------------

/** Default trace fetch limit — FIB[8] = 21 */
const DEFAULT_LIMIT = FIB[8]; // 21

/** Redis TTL for per-variant cache — FIB[8] * 1000 ms expressed as seconds */
const REDIS_TTL_SECONDS = FIB[8]; // 21 seconds

/** Redis key prefix for variant caches */
const REDIS_KEY_PREFIX = 'distiller:trace:variant:';

// ---------------------------------------------------------------------------
// DDL helper — idempotent table creation
// ---------------------------------------------------------------------------

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS distiller_traces (
    run_id        TEXT        NOT NULL PRIMARY KEY,
    variant       TEXT        NOT NULL,
    trace_hash    TEXT        NOT NULL,
    stage_results JSONB       NOT NULL DEFAULT '{}',
    errors        JSONB       NOT NULL DEFAULT '[]',
    timeline      JSONB       NOT NULL DEFAULT '[]',
    elapsed       BIGINT      NOT NULL DEFAULT 0,
    confidence    DOUBLE PRECISION NOT NULL DEFAULT 0,
    judge_score   DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS distiller_traces_variant_idx
    ON distiller_traces (variant, created_at DESC);

  CREATE UNIQUE INDEX IF NOT EXISTS distiller_traces_hash_idx
    ON distiller_traces (trace_hash);
`;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of the trace inputs for dedup detection.
 * Hash covers: runId + sorted stage names (from timeline).
 *
 * @param {string}   runId
 * @param {object[]} stages - Timeline stage entries (each has a `stage` field).
 * @returns {string} Hex digest.
 */
function computeTraceHash(runId, stages) {
  const stageList = (stages ?? [])
    .map(s => (typeof s === 'string' ? s : s?.stage ?? ''))
    .filter(Boolean)
    .sort()
    .join(':');
  return crypto
    .createHash('sha256')
    .update(`${runId}::${stageList}`)
    .digest('hex');
}

/**
 * Extract judge score from pipeline results.
 * Checks results.QualityGate.score, results.JUDGE.score, then results.judgeScore.
 *
 * @param {object} results
 * @returns {number} Score in [0, 1]; defaults to 0.
 */
function extractJudgeScore(results) {
  if (!results || typeof results !== 'object') return 0;
  const score =
    results.QualityGate?.score ??
    results.JUDGE?.score       ??
    results.judgeScore         ??
    0;
  return Math.max(0, Math.min(1, Number(score) || 0));
}

/**
 * Extract confidence from pipeline results or metadata.
 *
 * @param {object} results
 * @param {object} metadata
 * @returns {number} Confidence in [0, 1]; defaults to PSI (0.618).
 */
function extractConfidence(results, metadata) {
  const conf =
    results?.confidence   ??
    metadata?.confidence  ??
    results?.QualityGate?.confidence ??
    PSI; // default to PSI (0.618) — phi-neutral confidence
  return Math.max(0, Math.min(1, Number(conf) || PSI));
}

// ---------------------------------------------------------------------------
// TraceCollector
// ---------------------------------------------------------------------------

export class TraceCollector {
  /**
   * @param {object} opts
   * @param {string} opts.pgUrl    - Neon Postgres connection string.
   * @param {string} opts.redisUrl - Upstash Redis REST URL  (UPSTASH_REDIS_REST_URL).
   * @param {string} [opts.redisToken] - Upstash Redis REST token (UPSTASH_REDIS_REST_TOKEN).
   *                                    Falls back to UPSTASH_REDIS_REST_TOKEN env var.
   */
  constructor({ pgUrl, redisUrl, redisToken } = {}) {
    if (!pgUrl)    throw new TypeError('TraceCollector: pgUrl is required');
    if (!redisUrl) throw new TypeError('TraceCollector: redisUrl is required');

    this._log = createLogger('trace-collector');

    // Neon serverless SQL tag function — each call opens a pooled connection
    this._sql = neon(pgUrl);

    // Upstash Redis client (HTTP-based, edge-compatible)
    this._redis = new Redis({
      url:   redisUrl,
      token: redisToken ?? process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this._initialised = false;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Ensure the distiller_traces table and indices exist.
   * Safe to call multiple times (idempotent).
   */
  async init() {
    if (this._initialised) return;
    try {
      await this._sql(CREATE_TABLE_SQL);
      this._initialised = true;
      this._log.info('distiller_traces table ensured');
    } catch (err) {
      throw new TraceCollectionError('Failed to initialise distiller_traces table', {
        operation: 'init',
        cause:     err.message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // collectTrace
  // -------------------------------------------------------------------------

  /**
   * Persist a completed pipeline run trace.
   *
   * Performs dedup check via trace_hash before inserting. On conflict the
   * existing row is returned unchanged (no upsert overwrite).
   *
   * @param {object} runResult
   * @param {string}   runResult.runId    - Unique pipeline run identifier.
   * @param {string}   runResult.variant  - Pipeline variant label (e.g. 'rag-v2').
   * @param {object[]} runResult.stages   - Ordered list of stage descriptors.
   * @param {object}   runResult.results  - Stage output keyed by stage name.
   * @param {object[]} runResult.errors   - Array of error records.
   * @param {object[]} runResult.timeline - Ordered timeline events.
   * @param {number}   runResult.elapsed  - Total elapsed time in milliseconds.
   * @param {object}   [runResult.metadata] - Arbitrary metadata.
   *
   * @returns {Promise<object>} The persisted trace row.
   */
  async collectTrace(runResult) {
    await this.init();

    const {
      runId,
      variant,
      stages   = [],
      results  = {},
      errors   = [],
      timeline = [],
      elapsed  = 0,
      metadata = {},
    } = runResult ?? {};

    if (!runId)   throw new TraceCollectionError('collectTrace: runId is required', { operation: 'insert' });
    if (!variant) throw new TraceCollectionError('collectTrace: variant is required', { operation: 'insert', runId });

    const traceHash  = computeTraceHash(runId, timeline.length ? timeline : stages);
    const judgeScore = extractJudgeScore(results);
    const confidence = extractConfidence(results, metadata);

    this._log.info({ runId, variant, judgeScore, confidence }, 'Collecting trace');

    let row;
    try {
      const rows = await this._sql`
        INSERT INTO distiller_traces
          (run_id, variant, trace_hash, stage_results, errors, timeline, elapsed, confidence, judge_score)
        VALUES
          (
            ${runId},
            ${variant},
            ${traceHash},
            ${JSON.stringify(results)},
            ${JSON.stringify(errors)},
            ${JSON.stringify(timeline)},
            ${elapsed},
            ${confidence},
            ${judgeScore}
          )
        ON CONFLICT (trace_hash) DO NOTHING
        RETURNING *
      `;

      if (rows.length === 0) {
        // Dedup hit — fetch existing
        this._log.debug({ runId, traceHash }, 'Duplicate trace hash — returning existing');
        const existing = await this._sql`
          SELECT * FROM distiller_traces WHERE trace_hash = ${traceHash} LIMIT 1
        `;
        row = existing[0];
      } else {
        row = rows[0];
      }
    } catch (err) {
      throw new TraceCollectionError('Failed to insert trace into distiller_traces', {
        operation: 'insert',
        runId,
        variant,
        cause: err.message,
      });
    }

    // Cache latest trace per variant in Redis (TTL: 21 seconds)
    try {
      const cacheKey = `${REDIS_KEY_PREFIX}${variant}`;
      await this._redis.set(cacheKey, JSON.stringify(row), { ex: REDIS_TTL_SECONDS });
      this._log.debug({ cacheKey, ttl: REDIS_TTL_SECONDS }, 'Variant cache updated');
    } catch (err) {
      // Non-fatal — cache miss degrades to Postgres lookup
      this._log.warn({ err, runId, variant }, 'Redis cache update failed (non-fatal)');
    }

    return row;
  }

  // -------------------------------------------------------------------------
  // getTrace
  // -------------------------------------------------------------------------

  /**
   * Retrieve a single trace by runId.
   *
   * @param {string} runId
   * @returns {Promise<object|null>} Trace row or null if not found.
   */
  async getTrace(runId) {
    await this.init();
    if (!runId) throw new TraceCollectionError('getTrace: runId is required', { operation: 'select' });

    try {
      const rows = await this._sql`
        SELECT * FROM distiller_traces
        WHERE run_id = ${runId}
        LIMIT 1
      `;
      return rows[0] ?? null;
    } catch (err) {
      throw new TraceCollectionError('Failed to retrieve trace', {
        operation: 'select',
        runId,
        cause: err.message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // getRecentTraces
  // -------------------------------------------------------------------------

  /**
   * Retrieve the most recent traces across all variants.
   *
   * @param {number} [limit=FIB[8]] - Maximum rows to return (default 21).
   * @returns {Promise<object[]>}
   */
  async getRecentTraces(limit = DEFAULT_LIMIT) {
    await this.init();
    const safeLimit = Math.max(1, Math.min(limit, FIB[16])); // cap at FIB[16]=987

    try {
      return await this._sql`
        SELECT * FROM distiller_traces
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `;
    } catch (err) {
      throw new TraceCollectionError('Failed to retrieve recent traces', {
        operation: 'select',
        limit: safeLimit,
        cause: err.message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // getTracesByVariant
  // -------------------------------------------------------------------------

  /**
   * Retrieve traces filtered by pipeline variant.
   *
   * Checks Redis cache for the latest entry first, then falls back to Postgres.
   *
   * @param {string} variant
   * @param {number} [limit=FIB[8]] - Maximum rows (default 21).
   * @returns {Promise<object[]>}
   */
  async getTracesByVariant(variant, limit = DEFAULT_LIMIT) {
    await this.init();
    if (!variant) throw new TraceCollectionError('getTracesByVariant: variant is required', { operation: 'select' });

    const safeLimit = Math.max(1, Math.min(limit, FIB[16]));

    // Try Redis hot cache for single latest record
    if (safeLimit === 1) {
      try {
        const cached = await this._redis.get(`${REDIS_KEY_PREFIX}${variant}`);
        if (cached) {
          this._log.debug({ variant }, 'Variant cache hit');
          const record = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return [record];
        }
      } catch (err) {
        this._log.warn({ err, variant }, 'Redis cache read failed — falling through to Postgres');
      }
    }

    try {
      return await this._sql`
        SELECT * FROM distiller_traces
        WHERE variant = ${variant}
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `;
    } catch (err) {
      throw new TraceCollectionError('Failed to retrieve traces by variant', {
        operation: 'select',
        variant,
        limit: safeLimit,
        cause: err.message,
      });
    }
  }
}

export default TraceCollector;
