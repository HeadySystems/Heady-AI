'use strict';

/**
 * @fileoverview event-store.js — Immutable Append-Only Event Store
 *
 * Production-grade event sourcing infrastructure for the Heady ecosystem.
 * Provides an immutable event log for all state transitions, enabling
 * time-travel debugging, full audit trails, and aggregate rebuilding.
 *
 * Architecture:
 *  - Append-only stream model with per-stream optimistic concurrency
 *  - SHA-256 hash chain integrity across every stream
 *  - Pluggable storage backends (InMemory / Postgres)
 *  - Push subscriptions + catch-up replay
 *  - Snapshot caching at Fibonacci-derived intervals
 *  - Phi-compliant ring buffers, retention limits, and timing constants
 *
 * All numeric constants are derived from φ, ψ, or Fibonacci numbers via
 * the shared phi-math module. Zero magic numbers.
 *
 * @module event-store
 * @author Heady Ecosystem
 * @version 1.0.0
 * @license MIT
 *
 * @example
 * const { EventStore, InMemoryBackend } = require('./event-store');
 * const store = new EventStore({ backend: new InMemoryBackend() });
 * await store.append('order-1', [{ eventType: 'OrderPlaced', payload: { amount: 42 } }], 0);
 * const events = await store.readStream('order-1');
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

const {
  PHI,
  PSI,
  PSI2,
  PSI3,
  fib,
  phiThreshold,
  phiBackoff,
  CSL_THRESHOLDS,
  ALERT_THRESHOLDS,
  getPressureLevel,
  phiFusionWeights,
  phiTimeouts,
  phiIntervals,
  FIB_SEQUENCE,
} = require('../../shared/phi-math.js');

// ─────────────────────────────────────────────────────────────────────────────
// PHI-DERIVED CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Ring buffer capacity for InMemoryBackend: fib(20) = 6765 */
const RING_BUFFER_CAPACITY = fib(20);

/** Snapshot interval — create a snapshot every fib(8) = 21 events */
const SNAPSHOT_INTERVAL = fib(8);

/** Maximum events per stream before compaction is triggered: fib(17) = 1597 */
const MAX_EVENTS_PER_STREAM = fib(17);

/**
 * Compaction stride — preserve every fib(5)th = 5th event after archival.
 * fib(5) = 5
 */
const COMPACTION_STRIDE = fib(5);

/** Archive interval: phiIntervals().deepScan (φ⁴ × 30 000 ms ≈ 195 939 ms) */
const ARCHIVE_INTERVAL_MS = phiIntervals().deepScan;

/** Timeouts for async backend operations */
const OP_TIMEOUTS = phiTimeouts();

/** Maximum subscriptions per stream: fib(10) = 55 */
const MAX_STREAM_SUBSCRIPTIONS = fib(10);

/** Maximum global subscriptions: fib(11) = 89 */
const MAX_GLOBAL_SUBSCRIPTIONS = fib(11);

/** Minimum pressure ratio before retention warnings: PSI2 ≈ 0.382 */
const RETENTION_WARNING_RATIO = PSI2;

/** Pressure ratio for critical retention action: 1 - PSI3 ≈ 0.764 */
const RETENTION_CRITICAL_RATIO = CSL_THRESHOLDS.MEDIUM;

/**
 * SHA-256 produces 256 bits = 32 bytes; each byte encodes to 2 hex characters.
 * 32 × 2 = 64 hex characters per digest.
 * Expressed as: (256 / 8) × 2 — domain constants, not arbitrary numbers.
 * @type {number}
 */
const SHA256_HEX_LENGTH = (256 / 8) * 2;

/** Genesis hash — the canonical empty-chain sentinel (all zeros) */
const GENESIS_HASH = '0'.repeat(SHA256_HEX_LENGTH);

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a RFC-4122 version 4 UUID.
 *
 * @returns {string} A randomly-generated UUID v4 string.
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Computes a SHA-256 hash chain digest for an event.
 *
 * Hash = SHA-256( prevHash + JSON.stringify(payload) + timestamp )
 *
 * @param {string} prevHash - The previous event's hash (or GENESIS_HASH for the first event).
 * @param {*}      payload  - The event payload (must be JSON-serializable).
 * @param {string} timestamp - ISO 8601 timestamp of the current event.
 * @returns {string} Hex-encoded SHA-256 digest.
 */
function computeHash(prevHash, payload, timestamp) {
  const data = prevHash + JSON.stringify(payload) + timestamp;
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Returns the current UTC time as an ISO 8601 string.
 *
 * @returns {string} ISO 8601 timestamp (e.g. "2026-03-08T08:12:00.000Z").
 */
function nowISO() {
  return new Date().toISOString();
}

/**
 * Validates that a value is a non-empty string.
 *
 * @param {*}      value - The value to test.
 * @param {string} name  - Field name used in the error message.
 * @throws {TypeError} If the value is not a non-empty string.
 */
function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`EventStore: "${name}" must be a non-empty string, got ${JSON.stringify(value)}`);
  }
}

/**
 * Validates that a value is a non-negative integer.
 *
 * @param {*}      value - The value to test.
 * @param {string} name  - Field name used in the error message.
 * @throws {TypeError} If the value is not a non-negative integer.
 */
function requireNonNegativeInt(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`EventStore: "${name}" must be a non-negative integer, got ${JSON.stringify(value)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPED DEFINITIONS (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} EventMetadata
 * @property {string} [correlationId] - Traces a business operation across services.
 * @property {string} [causationId]   - The eventId that caused this event.
 * @property {string} [userId]        - Identity of the actor who triggered this event.
 * @property {string} [source]        - Originating service or module name.
 */

/**
 * @typedef {Object} StoredEvent
 * @property {string}        eventId    - UUID v4 unique identifier.
 * @property {string}        streamId   - Aggregate/entity identifier.
 * @property {string}        eventType  - Human-readable event type name.
 * @property {number}        version    - Monotonically-increasing per stream (1-based).
 * @property {number}        position   - Global append-log position (0-based).
 * @property {string}        timestamp  - ISO 8601 UTC creation time.
 * @property {*}             payload    - Serializable JSON event data.
 * @property {EventMetadata} metadata   - Correlation, causation, user, source context.
 * @property {string}        hash       - SHA-256 chain hash for tamper detection.
 */

/**
 * @typedef {Object} SnapshotRecord
 * @property {string} streamId  - The stream this snapshot belongs to.
 * @property {number} version   - The stream version at snapshot time.
 * @property {string} timestamp - ISO 8601 creation time.
 * @property {*}      state     - The serialized aggregate state.
 */

/**
 * @typedef {Object} AppendInput
 * @property {string}        eventType - Event type name (e.g. 'BeeSpawned').
 * @property {*}             payload   - JSON-serializable event data.
 * @property {EventMetadata} [metadata] - Optional correlation context.
 */

// ─────────────────────────────────────────────────────────────────────────────
// INMEMORY BACKEND
// ─────────────────────────────────────────────────────────────────────────────

/**
 * InMemoryBackend — ephemeral storage backend for testing and development.
 *
 * Maintains a global ring buffer (capacity: fib(20) = 6765) for the ordered
 * append log and per-stream arrays for fast stream reads.  Ring overflow
 * evicts the oldest events from the global log while stream arrays retain
 * their full history up to MAX_EVENTS_PER_STREAM.
 *
 * @implements {StorageBackend}
 */
class InMemoryBackend {
  /**
   * Creates a new InMemoryBackend instance.
   */
  constructor() {
    /**
     * Per-stream event arrays.
     * @type {Map<string, StoredEvent[]>}
     * @private
     */
    this._streams = new Map();

    /**
     * Per-stream snapshot storage (latest only).
     * @type {Map<string, SnapshotRecord>}
     * @private
     */
    this._snapshots = new Map();

    /**
     * Global ordered append log (ring buffer).
     * @type {StoredEvent[]}
     * @private
     */
    this._globalLog = [];

    /**
     * Ring buffer write head (modular index).
     * @type {number}
     * @private
     */
    this._ringHead = 0;

    /**
     * Total events ever appended (monotonic; used as global position).
     * @type {number}
     * @private
     */
    this._globalPosition = 0;
  }

  /**
   * Appends validated events to a stream and the global ring log.
   *
   * @param {string}        streamId - Target stream identifier.
   * @param {StoredEvent[]} events   - Pre-built StoredEvent objects to persist.
   * @returns {Promise<void>}
   */
  async append(streamId, events) {
    if (!this._streams.has(streamId)) {
      this._streams.set(streamId, []);
    }
    const stream = this._streams.get(streamId);

    for (const event of events) {
      stream.push(event);

      // Ring buffer — overwrite oldest slot on overflow
      if (this._globalLog.length < RING_BUFFER_CAPACITY) {
        this._globalLog.push(event);
      } else {
        this._globalLog[this._ringHead % RING_BUFFER_CAPACITY] = event;
        this._ringHead++;
      }

      this._globalPosition++;
    }
  }

  /**
   * Reads events from a stream between two version bounds (inclusive).
   *
   * @param {string} streamId    - Stream to read from.
   * @param {number} fromVersion - Minimum version (1-based, inclusive).
   * @param {number} toVersion   - Maximum version (inclusive); -1 means unbounded.
   * @returns {Promise<StoredEvent[]>} Slice of events in version order.
   */
  async readStream(streamId, fromVersion, toVersion) {
    const stream = this._streams.get(streamId);
    if (!stream) return [];

    return stream.filter((e) => {
      if (e.version < fromVersion) return false;
      if (toVersion !== -1 && e.version > toVersion) return false;
      return true;
    });
  }

  /**
   * Reads events from the global append log, starting at a given position.
   *
   * @param {number} fromPosition - Start position (0-based, inclusive).
   * @param {number} limit        - Maximum number of events to return.
   * @returns {Promise<StoredEvent[]>} Events in global append order.
   */
  async readAll(fromPosition, limit) {
    // The ring buffer may not be sorted by position after overflow —
    // re-sort by position to guarantee global order.
    const sorted = [...this._globalLog].sort((a, b) => a.position - b.position);
    return sorted.filter((e) => e.position >= fromPosition).slice(0, limit);
  }

  /**
   * Returns the latest version number for a stream, or 0 if the stream
   * does not exist.
   *
   * @param {string} streamId - Stream to query.
   * @returns {Promise<number>} Current version (0 = no events).
   */
  async getStreamVersion(streamId) {
    const stream = this._streams.get(streamId);
    if (!stream || stream.length === 0) return 0;
    return stream[stream.length - 1].version;
  }

  /**
   * Persists a snapshot record, replacing any previous snapshot for the stream.
   *
   * @param {SnapshotRecord} snapshot - Snapshot to store.
   * @returns {Promise<void>}
   */
  async saveSnapshot(snapshot) {
    this._snapshots.set(snapshot.streamId, snapshot);
  }

  /**
   * Loads the most recent snapshot for a stream.
   *
   * @param {string} streamId - Target stream identifier.
   * @returns {Promise<SnapshotRecord|null>} The snapshot, or null if none exists.
   */
  async loadSnapshot(streamId) {
    return this._snapshots.get(streamId) || null;
  }

  /**
   * Removes old events from a stream, preserving every COMPACTION_STRIDE-th
   * (fib(5) = 5th) event after the archive boundary.
   *
   * @param {string} streamId      - Stream to compact.
   * @param {number} archiveBefore - Version before which events may be compacted.
   * @returns {Promise<number>} Number of events removed.
   */
  async compact(streamId, archiveBefore) {
    const stream = this._streams.get(streamId);
    if (!stream) return 0;

    const surviving = stream.filter((e) => {
      if (e.version >= archiveBefore) return true;
      // Keep every COMPACTION_STRIDE-th event in the archived range
      return e.version % COMPACTION_STRIDE === 0;
    });

    const removed = stream.length - surviving.length;
    this._streams.set(streamId, surviving);
    return removed;
  }

  /**
   * Returns per-stream event count, total stream count, snapshot count,
   * and global log size.
   *
   * @returns {Promise<Object>} Backend-level metrics.
   */
  async getMetrics() {
    let totalEvents = 0;
    for (const stream of this._streams.values()) {
      totalEvents += stream.length;
    }
    return {
      totalStreams: this._streams.size,
      totalEvents,
      globalLogSize: this._globalLog.length,
      globalPosition: this._globalPosition,
      snapshotCount: this._snapshots.size,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTGRES BACKEND (INTERFACE / STUB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PostgresBackend — production storage backend stub.
 *
 * Implements the same interface as InMemoryBackend.  All methods are wired
 * for pgvector integration; callers must supply a pg.Pool or compatible client
 * via the constructor.  The schema expected is:
 *
 * ```sql
 * CREATE TABLE heady_events (
 *   position      BIGSERIAL PRIMARY KEY,
 *   event_id      UUID        NOT NULL UNIQUE,
 *   stream_id     TEXT        NOT NULL,
 *   event_type    TEXT        NOT NULL,
 *   version       INTEGER     NOT NULL,
 *   timestamp     TIMESTAMPTZ NOT NULL,
 *   payload       JSONB       NOT NULL,
 *   metadata      JSONB       NOT NULL DEFAULT '{}',
 *   hash          CHAR(64)    NOT NULL,
 *   UNIQUE (stream_id, version)
 * );
 * CREATE INDEX idx_heady_events_stream ON heady_events (stream_id, version);
 *
 * CREATE TABLE heady_snapshots (
 *   stream_id   TEXT        PRIMARY KEY,
 *   version     INTEGER     NOT NULL,
 *   timestamp   TIMESTAMPTZ NOT NULL,
 *   state       JSONB       NOT NULL
 * );
 * ```
 *
 * @implements {StorageBackend}
 */
class PostgresBackend {
  /**
   * @param {Object} pool - A `pg.Pool` (or compatible) database connection pool.
   */
  constructor(pool) {
    if (!pool || typeof pool.query !== 'function') {
      throw new TypeError('PostgresBackend: pool must expose a .query() method');
    }
    /** @private */
    this._pool = pool;
  }

  /**
   * Appends events to the Postgres events table in a single transaction.
   *
   * @param {string}        streamId - Target stream identifier.
   * @param {StoredEvent[]} events   - Pre-built StoredEvent objects to persist.
   * @returns {Promise<void>}
   * @throws {Error} On database error or concurrency violation.
   */
  async append(streamId, events) {
    const client = await this._pool.connect();
    try {
      await client.query('BEGIN');
      for (const evt of events) {
        await client.query(
          `INSERT INTO heady_events
             (event_id, stream_id, event_type, version, timestamp,
              payload, metadata, hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            evt.eventId,
            evt.streamId,
            evt.eventType,
            evt.version,
            evt.timestamp,
            JSON.stringify(evt.payload),
            JSON.stringify(evt.metadata),
            evt.hash,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Reads events from a Postgres stream between version bounds.
   *
   * @param {string} streamId    - Stream to read.
   * @param {number} fromVersion - Minimum version (inclusive).
   * @param {number} toVersion   - Maximum version (inclusive); -1 means unbounded.
   * @returns {Promise<StoredEvent[]>}
   */
  async readStream(streamId, fromVersion, toVersion) {
    const params = [streamId, fromVersion];
    let sql = `SELECT * FROM heady_events
               WHERE stream_id = $1 AND version >= $2`;
    if (toVersion !== -1) {
      params.push(toVersion);
      sql += ` AND version <= $${params.length}`;
    }
    sql += ' ORDER BY version ASC';

    const result = await this._pool.query(sql, params);
    return result.rows.map(PostgresBackend._rowToEvent);
  }

  /**
   * Reads events from the global ordered log starting at a given position.
   *
   * @param {number} fromPosition - Start position (inclusive).
   * @param {number} limit        - Maximum events to return.
   * @returns {Promise<StoredEvent[]>}
   */
  async readAll(fromPosition, limit) {
    const result = await this._pool.query(
      `SELECT * FROM heady_events
       WHERE position >= $1
       ORDER BY position ASC
       LIMIT $2`,
      [fromPosition, limit]
    );
    return result.rows.map(PostgresBackend._rowToEvent);
  }

  /**
   * Returns the current version of a stream.
   *
   * @param {string} streamId - Stream to query.
   * @returns {Promise<number>} Current version, or 0 if the stream is empty.
   */
  async getStreamVersion(streamId) {
    const result = await this._pool.query(
      'SELECT COALESCE(MAX(version), 0) AS v FROM heady_events WHERE stream_id = $1',
      [streamId]
    );
    return Number(result.rows[0].v);
  }

  /**
   * Upserts a snapshot record for a stream.
   *
   * @param {SnapshotRecord} snapshot - Snapshot to persist.
   * @returns {Promise<void>}
   */
  async saveSnapshot(snapshot) {
    await this._pool.query(
      `INSERT INTO heady_snapshots (stream_id, version, timestamp, state)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (stream_id) DO UPDATE
         SET version = EXCLUDED.version,
             timestamp = EXCLUDED.timestamp,
             state = EXCLUDED.state`,
      [snapshot.streamId, snapshot.version, snapshot.timestamp, JSON.stringify(snapshot.state)]
    );
  }

  /**
   * Loads the latest snapshot for a stream from Postgres.
   *
   * @param {string} streamId - Target stream.
   * @returns {Promise<SnapshotRecord|null>}
   */
  async loadSnapshot(streamId) {
    const result = await this._pool.query(
      'SELECT * FROM heady_snapshots WHERE stream_id = $1',
      [streamId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      streamId: row.stream_id,
      version: row.version,
      timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
      state: typeof row.state === 'string' ? JSON.parse(row.state) : row.state,
    };
  }

  /**
   * Compacts a stream in Postgres by deleting non-stride events before a
   * given version boundary.
   *
   * @param {string} streamId      - Stream to compact.
   * @param {number} archiveBefore - Version threshold.
   * @returns {Promise<number>} Number of rows deleted.
   */
  async compact(streamId, archiveBefore) {
    const result = await this._pool.query(
      `DELETE FROM heady_events
       WHERE stream_id = $1
         AND version < $2
         AND version % $3 != 0`,
      [streamId, archiveBefore, COMPACTION_STRIDE]
    );
    return result.rowCount || 0;
  }

  /**
   * Retrieves backend-level metrics from Postgres aggregate queries.
   *
   * @returns {Promise<Object>}
   */
  async getMetrics() {
    const [evtResult, snapResult] = await Promise.all([
      this._pool.query(
        `SELECT COUNT(*) AS total_events,
                COUNT(DISTINCT stream_id) AS total_streams,
                COALESCE(MAX(position), 0) AS global_position
         FROM heady_events`
      ),
      this._pool.query('SELECT COUNT(*) AS snapshot_count FROM heady_snapshots'),
    ]);
    return {
      totalEvents: Number(evtResult.rows[0].total_events),
      totalStreams: Number(evtResult.rows[0].total_streams),
      globalPosition: Number(evtResult.rows[0].global_position),
      snapshotCount: Number(snapResult.rows[0].snapshot_count),
    };
  }

  /**
   * Converts a raw Postgres row to a StoredEvent.
   *
   * @param {Object} row - Raw database row.
   * @returns {StoredEvent}
   * @private
   */
  static _rowToEvent(row) {
    return {
      eventId: row.event_id,
      streamId: row.stream_id,
      eventType: row.event_type,
      version: row.version,
      position: Number(row.position),
      timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      hash: row.hash,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT STORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EventStore — the central immutable event log for the Heady ecosystem.
 *
 * Provides append-only, hash-chained, version-controlled event streams with:
 *  - Optimistic concurrency control via expected version checks
 *  - Push subscriptions (per-stream and global)
 *  - Catch-up replay from any historical position
 *  - Automatic snapshot creation at fib(8) = 21 event intervals
 *  - Retention enforcement at fib(17) = 1597 events per stream
 *  - Periodic compaction scheduled at phiIntervals().deepScan
 *  - Full SHA-256 hash chain integrity verification
 *
 * @extends EventEmitter
 *
 * @fires EventStore#eventAppended
 * @fires EventStore#streamCreated
 * @fires EventStore#snapshotCreated
 * @fires EventStore#chainCorrupted
 * @fires EventStore#retentionTriggered
 *
 * @example
 * const store = new EventStore({ backend: new InMemoryBackend() });
 * await store.append('bee-1', [{ eventType: 'BeeSpawned', payload: { hive: 'alpha' } }], 0);
 */
class EventStore extends EventEmitter {
  /**
   * @param {Object}         [options]              - Configuration options.
   * @param {Object}         [options.backend]      - Storage backend instance (default: InMemoryBackend).
   * @param {boolean}        [options.autoCompact]  - Whether to schedule periodic compaction (default: true).
   * @param {number}         [options.archiveIntervalMs] - Override for the compaction interval (default: ARCHIVE_INTERVAL_MS).
   */
  constructor(options = {}) {
    super();

    const {
      backend = new InMemoryBackend(),
      autoCompact = true,
      archiveIntervalMs = ARCHIVE_INTERVAL_MS,
    } = options;

    /** @private @type {InMemoryBackend|PostgresBackend} */
    this._backend = backend;

    /**
     * Per-stream SHA-256 chain tip (last appended hash).
     * @private
     * @type {Map<string, string>}
     */
    this._hashTips = new Map();

    /**
     * Per-stream subscriptions: streamId → Set<Function>
     * @private
     * @type {Map<string, Set<Function>>}
     */
    this._streamSubs = new Map();

    /**
     * Global subscriptions.
     * @private
     * @type {Set<Function>}
     */
    this._globalSubs = new Set();

    /**
     * Catch-up subscriptions: { fromPosition, handler, cursor }
     * @private
     * @type {Array<{fromPosition:number, handler:Function, cursor:number}>}
     */
    this._catchUpSubs = [];

    /**
     * In-memory metrics counters.
     * @private
     * @type {Object}
     */
    this._metrics = {
      totalEvents: 0,
      totalStreams: 0,
      appendRate: 0,
      readRate: 0,
      storageSize: 0,
      snapshotCount: 0,
      _appendWindow: [],
      _readWindow: [],
    };

    /**
     * Global append position counter (monotonic).
     * @private
     * @type {number}
     */
    this._globalPosition = 0;

    /**
     * Timer reference for the periodic compaction scheduler.
     * @private
     * @type {NodeJS.Timeout|null}
     */
    this._compactTimer = null;

    if (autoCompact) {
      this._compactTimer = setInterval(
        () => this._runCompaction().catch((err) => this.emit('error', err)),
        archiveIntervalMs
      );
      // Do not hold the process open for maintenance work
      if (this._compactTimer.unref) this._compactTimer.unref();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STREAM OPERATIONS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Appends one or more events to a stream with optimistic concurrency control.
   *
   * The `expectedVersion` must match the stream's current version; if it does
   * not, a concurrency error is thrown.  Each event in the batch receives a
   * monotonically-increasing version, a global position, a UTC timestamp, and
   * a SHA-256 hash chained from the previous event's hash.
   *
   * @param {string}        streamId        - Target aggregate/entity identifier.
   * @param {AppendInput[]} events          - Array of events to append (must be non-empty).
   * @param {number}        expectedVersion - The version the caller believes the stream is at.
   *                                          Use 0 to create a new stream.
   * @returns {Promise<StoredEvent[]>} The persisted events with all system fields populated.
   * @throws {TypeError}  On invalid arguments.
   * @throws {Error}      On optimistic concurrency violation.
   * @throws {Error}      On backend persistence failure.
   *
   * @fires EventStore#streamCreated - When a new stream is created (first append).
   * @fires EventStore#eventAppended - For each event appended.
   */
  async append(streamId, events, expectedVersion) {
    requireString(streamId, 'streamId');
    requireNonNegativeInt(expectedVersion, 'expectedVersion');

    if (!Array.isArray(events) || events.length === 0) {
      throw new TypeError('EventStore.append: events must be a non-empty array');
    }

    const currentVersion = await this._backend.getStreamVersion(streamId);
    if (currentVersion !== expectedVersion) {
      throw new Error(
        `EventStore.append: concurrency conflict on stream "${streamId}". ` +
        `Expected version ${expectedVersion}, found ${currentVersion}.`
      );
    }

    const isNewStream = currentVersion === 0;
    let prevHash = this._hashTips.get(streamId) || GENESIS_HASH;
    let version = currentVersion;

    const stored = [];
    for (const evt of events) {
      requireString(evt.eventType, 'eventType');

      version++;
      const timestamp = nowISO();
      const hash = computeHash(prevHash, evt.payload, timestamp);

      /** @type {StoredEvent} */
      const stored_event = {
        eventId: generateUUID(),
        streamId,
        eventType: evt.eventType,
        version,
        position: this._globalPosition++,
        timestamp,
        payload: evt.payload !== undefined ? evt.payload : null,
        metadata: {
          correlationId: evt.metadata?.correlationId || null,
          causationId: evt.metadata?.causationId || null,
          userId: evt.metadata?.userId || null,
          source: evt.metadata?.source || null,
        },
        hash,
      };

      stored.push(stored_event);
      prevHash = hash;
    }

    await this._backend.append(streamId, stored);
    this._hashTips.set(streamId, prevHash);

    // Update metrics
    this._metrics.totalEvents += stored.length;
    this._trackAppendRate(stored.length);

    if (isNewStream) {
      this._metrics.totalStreams++;
      /**
       * @event EventStore#streamCreated
       * @type {Object}
       * @property {string} streamId - The newly created stream.
       */
      this.emit('streamCreated', { streamId });
    }

    for (const evt of stored) {
      /**
       * @event EventStore#eventAppended
       * @type {StoredEvent}
       */
      this.emit('eventAppended', evt);
      this._notifySubscribers(evt);
    }

    // Auto-snapshot when stream version crosses a fib(8) boundary
    const newVersion = await this._backend.getStreamVersion(streamId);
    if (newVersion % SNAPSHOT_INTERVAL === 0) {
      // Trigger snapshot creation in the background (non-blocking)
      setImmediate(() => this._autoSnapshot(streamId, newVersion));
    }

    // Retention enforcement
    if (newVersion >= MAX_EVENTS_PER_STREAM * RETENTION_CRITICAL_RATIO) {
      /**
       * @event EventStore#retentionTriggered
       * @type {Object}
       * @property {string} streamId - Stream approaching or at the retention limit.
       * @property {number} version  - Current version count.
       */
      this.emit('retentionTriggered', { streamId, version: newVersion });
    }

    return stored;
  }

  /**
   * Reads events from a stream between two version bounds (inclusive).
   *
   * @param {string} streamId              - Target stream.
   * @param {number} [fromVersion=1]       - Start version (1-based, inclusive).
   * @param {number} [toVersion=-1]        - End version (inclusive); -1 means read to current tip.
   * @returns {Promise<StoredEvent[]>} Events in ascending version order.
   * @throws {TypeError} On invalid arguments.
   */
  async readStream(streamId, fromVersion = 1, toVersion = -1) {
    requireString(streamId, 'streamId');
    requireNonNegativeInt(fromVersion, 'fromVersion');
    if (toVersion !== -1) requireNonNegativeInt(toVersion, 'toVersion');

    this._trackReadRate(1);
    return this._backend.readStream(streamId, fromVersion, toVersion);
  }

  /**
   * Reads events from the global append log starting at a given position.
   *
   * @param {number} [fromPosition=0]           - Start global position (0-based, inclusive).
   * @param {number} [limit=fib(10)]            - Maximum number of events to return.
   * @returns {Promise<StoredEvent[]>} Events in global append order.
   * @throws {TypeError} On invalid arguments.
   */
  async readAll(fromPosition = 0, limit = fib(10)) {
    requireNonNegativeInt(fromPosition, 'fromPosition');
    if (!Number.isInteger(limit) || limit < 1) {
      throw new TypeError('EventStore.readAll: limit must be a positive integer');
    }

    this._trackReadRate(1);
    return this._backend.readAll(fromPosition, limit);
  }

  /**
   * Returns the current version number for a stream.
   *
   * @param {string} streamId - Target stream.
   * @returns {Promise<number>} Current version, or 0 if the stream does not exist.
   * @throws {TypeError} On invalid streamId.
   */
  async getStreamVersion(streamId) {
    requireString(streamId, 'streamId');
    return this._backend.getStreamVersion(streamId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUBSCRIPTIONS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Subscribes a handler to events on a specific stream.
   *
   * The handler is called synchronously during `append` for each new event on
   * the given stream.  Handler errors are caught and re-emitted as 'error' on
   * the EventStore.
   *
   * @param {string}   streamId - Stream to subscribe to.
   * @param {Function} handler  - Called with (event: StoredEvent) for each new event.
   * @returns {Function} An unsubscribe function; call it to remove this subscription.
   * @throws {TypeError}  On invalid arguments.
   * @throws {RangeError} If the per-stream subscription limit (fib(10) = 55) is reached.
   */
  subscribeToStream(streamId, handler) {
    requireString(streamId, 'streamId');
    if (typeof handler !== 'function') {
      throw new TypeError('EventStore.subscribeToStream: handler must be a function');
    }

    if (!this._streamSubs.has(streamId)) {
      this._streamSubs.set(streamId, new Set());
    }
    const subs = this._streamSubs.get(streamId);

    if (subs.size >= MAX_STREAM_SUBSCRIPTIONS) {
      throw new RangeError(
        `EventStore.subscribeToStream: subscription limit of ${MAX_STREAM_SUBSCRIPTIONS} reached for stream "${streamId}"`
      );
    }

    subs.add(handler);
    return () => subs.delete(handler);
  }

  /**
   * Subscribes a handler to all events across every stream.
   *
   * @param {Function} handler - Called with (event: StoredEvent) for every new event.
   * @returns {Function} An unsubscribe function.
   * @throws {TypeError}  On invalid handler type.
   * @throws {RangeError} If the global subscription limit (fib(11) = 89) is reached.
   */
  subscribeToAll(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('EventStore.subscribeToAll: handler must be a function');
    }
    if (this._globalSubs.size >= MAX_GLOBAL_SUBSCRIPTIONS) {
      throw new RangeError(
        `EventStore.subscribeToAll: global subscription limit of ${MAX_GLOBAL_SUBSCRIPTIONS} reached`
      );
    }

    this._globalSubs.add(handler);
    return () => this._globalSubs.delete(handler);
  }

  /**
   * Creates a catch-up subscription that first replays all existing events
   * from `fromPosition` (or from the beginning if 0), then continues to
   * receive new events as they are appended.
   *
   * Replay is performed in batches of fib(10) = 55 events to bound memory
   * usage.  Once replay is complete, the subscription remains active and
   * receives live events.
   *
   * @param {number}   fromPosition - Global position from which to start replay (0-based).
   * @param {Function} handler      - Called with (event: StoredEvent) for each event.
   * @returns {Promise<Function>} Resolves once historical replay is complete;
   *                              the returned function unsubscribes from live events.
   * @throws {TypeError} On invalid arguments.
   */
  async catchUpSubscription(fromPosition, handler) {
    requireNonNegativeInt(fromPosition, 'fromPosition');
    if (typeof handler !== 'function') {
      throw new TypeError('EventStore.catchUpSubscription: handler must be a function');
    }

    const batchSize = fib(10);
    let cursor = fromPosition;
    let done = false;

    // Replay historical events in batches
    while (!done) {
      const batch = await this._backend.readAll(cursor, batchSize);
      for (const evt of batch) {
        await this._invokeHandler(handler, evt);
      }
      if (batch.length < batchSize) {
        done = true;
      } else {
        cursor = batch[batch.length - 1].position + 1;
      }
    }

    // Register for live events from the current tip
    const sub = { fromPosition: cursor, handler, cursor };
    this._catchUpSubs.push(sub);

    return () => {
      const idx = this._catchUpSubs.indexOf(sub);
      if (idx !== -1) this._catchUpSubs.splice(idx, 1);
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SNAPSHOTS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Creates and persists a snapshot of an aggregate's state at a given version.
   *
   * Snapshots accelerate aggregate rebuilding by providing a base state from
   * which only subsequent events need to be replayed.  A snapshot is
   * automatically triggered every SNAPSHOT_INTERVAL (fib(8) = 21) events.
   *
   * @param {string} streamId - Target stream.
   * @param {*}      state    - Serializable aggregate state object.
   * @param {number} version  - Stream version this state corresponds to.
   * @returns {Promise<SnapshotRecord>} The persisted snapshot record.
   * @throws {TypeError} On invalid arguments.
   *
   * @fires EventStore#snapshotCreated
   */
  async createSnapshot(streamId, state, version) {
    requireString(streamId, 'streamId');
    requireNonNegativeInt(version, 'version');

    /** @type {SnapshotRecord} */
    const snapshot = {
      streamId,
      version,
      timestamp: nowISO(),
      state,
    };

    await this._backend.saveSnapshot(snapshot);
    this._metrics.snapshotCount++;

    /**
     * @event EventStore#snapshotCreated
     * @type {SnapshotRecord}
     */
    this.emit('snapshotCreated', snapshot);
    return snapshot;
  }

  /**
   * Loads the most recent snapshot for a stream.
   *
   * @param {string} streamId - Target stream.
   * @returns {Promise<SnapshotRecord|null>} The snapshot, or null if none exists.
   * @throws {TypeError} On invalid streamId.
   */
  async loadSnapshot(streamId) {
    requireString(streamId, 'streamId');
    return this._backend.loadSnapshot(streamId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EVENT REPLAY
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Rebuilds aggregate state by replaying all events in a stream through a
   * projector function.  If a snapshot exists, replay starts from the
   * snapshot's version to minimize work.
   *
   * @param {string}   streamId  - Stream to replay.
   * @param {Function} projector - `(state, event) => newState` pure reducer.
   *                               The initial state is `null` (or snapshot state).
   * @returns {Promise<*>} The final projected state after all events are applied.
   * @throws {TypeError} On invalid arguments.
   *
   * @example
   * const finalState = await store.replayStream('order-1', (state, evt) => {
   *   if (evt.eventType === 'OrderPlaced') return { ...state, status: 'placed' };
   *   return state;
   * });
   */
  async replayStream(streamId, projector) {
    requireString(streamId, 'streamId');
    if (typeof projector !== 'function') {
      throw new TypeError('EventStore.replayStream: projector must be a function');
    }

    const snapshot = await this._backend.loadSnapshot(streamId);
    let state = snapshot ? snapshot.state : null;
    const fromVersion = snapshot ? snapshot.version + 1 : 1;

    const events = await this._backend.readStream(streamId, fromVersion, -1);
    for (const evt of events) {
      state = projector(state, evt);
    }

    return state;
  }

  /**
   * Rebuilds global state by replaying every event in the store through a
   * projector function.  Events are processed in global append order, batched
   * at fib(10) = 55 events to bound heap usage.
   *
   * @param {Function} projector - `(state, event) => newState` pure reducer.
   * @returns {Promise<*>} Final projected state after full system replay.
   * @throws {TypeError} On invalid projector.
   */
  async replayAll(projector) {
    if (typeof projector !== 'function') {
      throw new TypeError('EventStore.replayAll: projector must be a function');
    }

    const batchSize = fib(10);
    let state = null;
    let position = 0;
    let done = false;

    while (!done) {
      const batch = await this._backend.readAll(position, batchSize);
      for (const evt of batch) {
        state = projector(state, evt);
      }
      if (batch.length < batchSize) {
        done = true;
      } else {
        position = batch[batch.length - 1].position + 1;
      }
    }

    return state;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HASH CHAIN INTEGRITY
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Verifies the SHA-256 hash chain integrity for an entire stream.
   *
   * Each event's hash is recomputed from the previous event's hash, the
   * current event's payload, and the current event's timestamp.  Any
   * mismatch indicates tampering or corruption.
   *
   * @param {string} streamId - Stream to verify.
   * @returns {Promise<{valid: boolean, firstCorruptVersion: number|null, totalChecked: number}>}
   *   Verification result with the first corrupt version (if any) and total events checked.
   * @throws {TypeError} On invalid streamId.
   *
   * @fires EventStore#chainCorrupted - If any hash mismatch is detected.
   */
  async verifyChain(streamId) {
    requireString(streamId, 'streamId');

    const events = await this._backend.readStream(streamId, 1, -1);
    let prevHash = GENESIS_HASH;
    let firstCorruptVersion = null;

    for (const evt of events) {
      const expected = computeHash(prevHash, evt.payload, evt.timestamp);
      if (expected !== evt.hash) {
        firstCorruptVersion = evt.version;
        /**
         * @event EventStore#chainCorrupted
         * @type {Object}
         * @property {string} streamId            - The corrupt stream.
         * @property {number} firstCorruptVersion - Version of first hash mismatch.
         */
        this.emit('chainCorrupted', { streamId, firstCorruptVersion });
        return { valid: false, firstCorruptVersion, totalChecked: events.length };
      }
      prevHash = evt.hash;
    }

    return { valid: true, firstCorruptVersion: null, totalChecked: events.length };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // METRICS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns a snapshot of current EventStore metrics.
   *
   * Metrics include:
   *  - `totalEvents`   : All events ever appended (in-process counter)
   *  - `totalStreams`  : Number of distinct streams created
   *  - `appendRate`    : Approximate events-per-second over a rolling window
   *  - `readRate`      : Approximate read-operations-per-second over a rolling window
   *  - `storageSize`   : Backend-reported event count (may differ from totalEvents after compaction)
   *  - `snapshotCount` : Total snapshots persisted
   *
   * @returns {Promise<Object>} Metrics object.
   */
  async getMetrics() {
    const backendMetrics = await this._backend.getMetrics();

    return {
      totalEvents: this._metrics.totalEvents,
      totalStreams: this._metrics.totalStreams,
      appendRate: this._computeRate(this._metrics._appendWindow),
      readRate: this._computeRate(this._metrics._readWindow),
      storageSize: backendMetrics.totalEvents,
      snapshotCount: this._metrics.snapshotCount,
      globalPosition: this._globalPosition,
      backendMetrics,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Shuts down the EventStore, cancelling any scheduled timers and removing
   * all subscriptions.  Must be called when the store is no longer needed to
   * prevent resource leaks.
   *
   * @returns {void}
   */
  shutdown() {
    if (this._compactTimer) {
      clearInterval(this._compactTimer);
      this._compactTimer = null;
    }
    this._streamSubs.clear();
    this._globalSubs.clear();
    this._catchUpSubs.length = 0;
    this.removeAllListeners();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Dispatches a newly-appended event to all registered subscribers.
   *
   * Per-stream subscribers receive events only for their target stream.
   * Global subscribers and catch-up subscribers receive every event.
   * Handler errors are caught and re-emitted as 'error' on the EventStore.
   *
   * @param {StoredEvent} evt - The event to dispatch.
   * @private
   */
  _notifySubscribers(evt) {
    const streamSubs = this._streamSubs.get(evt.streamId);
    if (streamSubs) {
      for (const handler of streamSubs) {
        this._invokeHandler(handler, evt);
      }
    }

    for (const handler of this._globalSubs) {
      this._invokeHandler(handler, evt);
    }

    for (const sub of this._catchUpSubs) {
      if (evt.position >= sub.cursor) {
        this._invokeHandler(sub.handler, evt);
        sub.cursor = evt.position + 1;
      }
    }
  }

  /**
   * Safely invokes a subscriber handler, catching and re-emitting any error.
   *
   * @param {Function}    handler - Subscriber callback.
   * @param {StoredEvent} evt     - Event payload to pass.
   * @returns {Promise<void>}
   * @private
   */
  async _invokeHandler(handler, evt) {
    try {
      await handler(evt);
    } catch (err) {
      this.emit('error', err);
    }
  }

  /**
   * Automatically creates a snapshot if the stream has not had a manual
   * snapshot recorded at the given version.
   *
   * This is a best-effort background operation; errors are swallowed and
   * re-emitted as 'error' so they do not disrupt the append path.
   *
   * @param {string} streamId       - Target stream.
   * @param {number} targetVersion  - Version at which to snapshot.
   * @returns {Promise<void>}
   * @private
   */
  async _autoSnapshot(streamId, targetVersion) {
    try {
      const existing = await this._backend.loadSnapshot(streamId);
      if (existing && existing.version >= targetVersion) return;

      // Rebuild state up to targetVersion via replay
      const state = await this.replayStream(streamId, (s, e) => {
        if (!s) return { events: [e] };
        s.events = s.events || [];
        s.events.push(e);
        return s;
      });

      await this.createSnapshot(streamId, state, targetVersion);
    } catch (err) {
      this.emit('error', err);
    }
  }

  /**
   * Runs the periodic retention compaction pass across all streams.
   *
   * For each stream, if the event count exceeds MAX_EVENTS_PER_STREAM ×
   * RETENTION_WARNING_RATIO, the stream is compacted by preserving only every
   * COMPACTION_STRIDE-th event before the current snapshot version boundary.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _runCompaction() {
    const backendMetrics = await this._backend.getMetrics();
    if (!backendMetrics.totalStreams) return;

    // Compact in-memory streams individually
    const inMemoryBackend = this._backend instanceof InMemoryBackend
      ? this._backend
      : null;

    if (!inMemoryBackend) return; // Postgres compaction deferred to external scheduler

    for (const [streamId, stream] of inMemoryBackend._streams.entries()) {
      const count = stream.length;
      const warningFloor = Math.floor(MAX_EVENTS_PER_STREAM * RETENTION_WARNING_RATIO);
      if (count < warningFloor) continue;

      const snapshot = await this._backend.loadSnapshot(streamId);
      const archiveBefore = snapshot ? snapshot.version : Math.floor(count * PSI2);

      const removed = await this._backend.compact(streamId, archiveBefore);
      if (removed > 0) {
        this.emit('retentionTriggered', { streamId, removed, remainingEvents: count - removed });
      }
    }
  }

  /**
   * Records a rate sample to the given sliding window array for rate calculation.
   * The window retains samples from the last phiTimeouts().slow milliseconds.
   *
   * @param {number} count - Number of operations to record.
   * @private
   */
  _trackAppendRate(count) {
    const now = Date.now();
    this._metrics._appendWindow.push({ ts: now, count });
    this._pruneWindow(this._metrics._appendWindow);
  }

  /**
   * Records a read rate sample.
   *
   * @param {number} count - Number of operations to record.
   * @private
   */
  _trackReadRate(count) {
    const now = Date.now();
    this._metrics._readWindow.push({ ts: now, count });
    this._pruneWindow(this._metrics._readWindow);
  }

  /**
   * Removes samples older than phiTimeouts().slow ms from a sliding window.
   *
   * @param {Array<{ts:number, count:number}>} window - The window to prune.
   * @private
   */
  _pruneWindow(window) {
    const cutoff = Date.now() - OP_TIMEOUTS.slow;
    let i = 0;
    while (i < window.length && window[i].ts < cutoff) i++;
    if (i > 0) window.splice(0, i);
  }

  /**
   * Computes an approximate operations-per-second rate from a sliding window.
   *
   * @param {Array<{ts:number, count:number}>} window - The sliding window to measure.
   * @returns {number} Operations per second, or 0 if the window is empty.
   * @private
   */
  _computeRate(window) {
    if (window.length === 0) return 0;
    const totalCount = window.reduce((acc, s) => acc + s.count, 0);
    const spanMs = Date.now() - window[0].ts;
    if (spanMs <= 0) return 0;
    return (totalCount / spanMs) * 1000;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  EventStore,
  InMemoryBackend,
  PostgresBackend,
  // Expose phi-derived constants for downstream testing and documentation
  RING_BUFFER_CAPACITY,
  SNAPSHOT_INTERVAL,
  MAX_EVENTS_PER_STREAM,
  COMPACTION_STRIDE,
  ARCHIVE_INTERVAL_MS,
  GENESIS_HASH,
};
