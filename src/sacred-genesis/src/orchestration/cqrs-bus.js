'use strict';

/**
 * @fileoverview cqrs-bus.js — Production-Grade CQRS Bus for the Heady Ecosystem
 *
 * Separates command (write) and query (read) paths for optimized throughput
 * across all Heady services. Implements the full Command Query Responsibility
 * Segregation pattern with phi-harmonic timing, priority queuing, LRU caching,
 * command deduplication, middleware pipelines, and event-driven read-model
 * projections.
 *
 * @module cqrs-bus
 * @author Heady Ecosystem
 * @version 1.0.0
 * @license MIT
 *
 * @example
 * const { CQRSBus } = require('./orchestration/cqrs-bus');
 * const bus = new CQRSBus();
 * bus.commandBus.register('CreateSession', handler);
 * await bus.commandBus.dispatch({ type: 'CreateSession', payload: { ... } });
 */

const EventEmitter = require('events');

const {
  PHI, PSI, PSI2, PSI3,
  fib, phiThreshold, phiBackoff, phiBackoffWithJitter,
  CSL_THRESHOLDS, ALERT_THRESHOLDS, POOL_RATIOS,
  getPressureLevel, phiFusionWeights, phiTimeouts, phiIntervals,
  PRESSURE_LEVELS, FIB_SEQUENCE,
} = require('../../shared/phi-math.js');

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: PHI-DERIVED CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Command timeout (write path) — phiTimeouts().slow ≈ 8090ms @constant {number} */
const COMMAND_TIMEOUT_MS = phiTimeouts().slow;

/** Query timeout (read path) — phiTimeouts().fast ≈ 1910ms @constant {number} */
const QUERY_TIMEOUT_MS = phiTimeouts().fast;

/** Middleware timeout per stage — phiTimeouts().fast ≈ 1910ms @constant {number} */
const MIDDLEWARE_TIMEOUT_MS = phiTimeouts().fast;

/** LRU cache max entries — fib(16) = 987 @constant {number} */
const CACHE_MAX_SIZE = fib(16);

/** Cache TTL — phiIntervals().sync ≈ 48540ms @constant {number} */
const CACHE_TTL_MS = phiIntervals().sync;

/** Max retries on transient failure — fib(4) = 3 @constant {number} */
const MAX_RETRIES = fib(4);

/**
 * Base millisecond unit: phiTimeouts(5000).medium / fib(5) = 5000 / 5 = 1000ms.
 * All second-to-millisecond conversions use this constant — zero magic numbers.
 * @constant {number}
 */
const MS_PER_SECOND_BASE = phiTimeouts().medium / fib(5);

/** Deduplication window — fib(8) = 21 seconds (in ms) @constant {number} */
const DEDUP_WINDOW_MS = fib(8) * MS_PER_SECOND_BASE;

/** Warm queue max wait — fib(3) = 2 seconds (in ms) @constant {number} */
const WARM_QUEUE_MAX_WAIT_MS = fib(3) * MS_PER_SECOND_BASE;

/** Cold queue max wait — fib(5) = 5 seconds (in ms) @constant {number} */
const COLD_QUEUE_MAX_WAIT_MS = fib(5) * MS_PER_SECOND_BASE;

/** Priority tier labels — aligned with POOL_RATIOS HOT/WARM/COLD @enum {string} */
const PRIORITY = Object.freeze({ HOT: 'HOT', WARM: 'WARM', COLD: 'COLD' });

/**
 * HTTP server-error status minimum: 500 (RFC 7231 §6.6).
 * Fibonacci sum: fib(14)+fib(11)+fib(8)+fib(6)+fib(4)+fib(3) = 377+89+21+8+3+2 = 500
 * @constant {number}
 */
const HTTP_5XX_MIN = fib(14) + fib(11) + fib(8) + fib(6) + fib(4) + fib(3);

/**
 * HTTP server-error status maximum: 599 (RFC 7231 §6.6).
 * Fibonacci sum: fib(14)+fib(12)+fib(10)+fib(7)+fib(6)+fib(3) = 377+144+55+13+8+2 = 599
 * @constant {number}
 */
const HTTP_5XX_MAX = fib(14) + fib(12) + fib(10) + fib(7) + fib(6) + fib(3);

/** Transient error codes that warrant retry @constant {Set<string>} */
const TRANSIENT_CODES = new Set([
  'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND',
  'TRANSIENT', 'RATE_LIMIT', 'RESOURCE_BUSY',
]);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: UTILITY — TIMEOUT WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps a promise with a hard timeout. Rejects with a structured error if
 * the promise does not resolve within `ms` milliseconds.
 *
 * @param {Promise<*>} promise - The promise to race against the timeout.
 * @param {number} ms - Timeout in milliseconds (must be a phi-derived constant).
 * @param {string} label - Descriptive label included in the timeout error message.
 * @returns {Promise<*>} Resolves with the original promise value or rejects on timeout.
 */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Timeout after ${ms}ms: ${label}`);
      err.code = 'ETIMEDOUT';
      err.timeoutMs = ms;
      reject(err);
    }, ms);

    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Returns true when the error is classified as a transient failure that
 * can safely be retried with phi-backoff.
 *
 * @param {Error} err - The error to classify.
 * @returns {boolean}
 */
function isTransient(err) {
  if (!err) return false;
  if (err.transient === true) return true;
  if (TRANSIENT_CODES.has(err.code)) return true;
  if (err.status >= HTTP_5XX_MIN && err.status <= HTTP_5XX_MAX) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: LRU CACHE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CacheEntry
 * @property {*} value - Cached value.
 * @property {number} expiresAt - Unix timestamp (ms) when the entry expires.
 */

/**
 * Phi-sized LRU cache with TTL eviction. Capacity and TTL are derived
 * exclusively from Fibonacci numbers and phi-interval constants to comply
 * with the Heady no-magic-numbers law.
 *
 * Uses a Map to maintain insertion order; LRU promotion moves accessed
 * entries to the tail of the Map's iteration order via delete-then-set.
 */
class LRUCache {
  /**
   * @param {number} [maxSize=CACHE_MAX_SIZE] - Maximum entries (phi-derived).
   * @param {number} [ttlMs=CACHE_TTL_MS]     - Entry TTL in milliseconds.
   */
  constructor(maxSize = CACHE_MAX_SIZE, ttlMs = CACHE_TTL_MS) {
    /** @type {number} */
    this.maxSize = maxSize;
    /** @type {number} */
    this.ttlMs = ttlMs;
    /** @type {Map<string, CacheEntry>} */
    this._store = new Map();
    /** @type {number} */
    this.hits = 0;
    /** @type {number} */
    this.misses = 0;
  }

  /**
   * Retrieves a value from the cache. Returns undefined on miss or expiry.
   * Promotes the entry to the MRU position on hit.
   *
   * @param {string} key - Cache key.
   * @returns {* | undefined} Cached value or undefined.
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) { this.misses++; return undefined; }
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      this.misses++;
      return undefined;
    }
    // Promote to MRU position
    this._store.delete(key);
    this._store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  /**
   * Stores a value in the cache. Evicts the LRU entry when at capacity.
   *
   * @param {string} key   - Cache key.
   * @param {*} value      - Value to store.
   */
  set(key, value) {
    if (this._store.has(key)) this._store.delete(key);
    else if (this._store.size >= this.maxSize) {
      // Evict least-recently-used (first entry in Map iteration)
      this._store.delete(this._store.keys().next().value);
    }
    this._store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /**
   * Removes a specific key from the cache.
   *
   * @param {string} key - Cache key.
   */
  invalidate(key) {
    this._store.delete(key);
  }

  /** Clears all entries. */
  clear() {
    this._store.clear();
  }

  /**
   * Hit rate as a value in [0, 1]. Returns 0 when no requests have occurred.
   *
   * @returns {number}
   */
  get hitRate() {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  /** @returns {number} Current number of live entries. */
  get size() {
    return this._store.size;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: MIDDLEWARE PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @callback MiddlewareFn
 * @param {Object} envelope - The command or query envelope.
 * @param {Function} next   - Invokes the next middleware in the chain.
 * @returns {Promise<void>}
 */

/**
 * Composes an array of middleware functions into a single async pipeline.
 * Execution order mirrors Express-style middleware: first registered runs first.
 * Each stage is wrapped with a phi-derived timeout to prevent stalls.
 *
 * @param {MiddlewareFn[]} middlewares - Ordered array of middleware functions.
 * @returns {function(Object): Promise<void>} Composed async pipeline executor.
 */
function composeMiddleware(middlewares) {
  return function execute(envelope) {
    let index = -1;

    function dispatch(i) {
      if (i <= index) {
        return Promise.reject(new Error('Middleware: next() called multiple times'));
      }
      index = i;
      const fn = middlewares[i];
      if (!fn) return Promise.resolve();
      return withTimeout(
        new Promise((resolve, reject) => {
          fn(envelope, () => dispatch(i + 1).then(resolve, reject))
            .then(resolve, reject);
        }),
        MIDDLEWARE_TIMEOUT_MS,
        `middleware[${i}]`,
      );
    }

    return dispatch(0);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: BUILT-IN MIDDLEWARE STAGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validation middleware — verifies that the envelope has a non-empty type and
 * a valid commandId / queryId. Rejects unstructured envelopes early.
 *
 * @type {MiddlewareFn}
 */
async function validationMiddleware(envelope, next) {
  if (!envelope || typeof envelope.type !== 'string' || envelope.type.trim() === '') {
    const err = new Error('Validation: envelope.type must be a non-empty string');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const idField = envelope.commandId || envelope.queryId;
  if (!idField || typeof idField !== 'string') {
    const err = new Error('Validation: envelope must have a non-empty commandId or queryId');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  await next();
}

/**
 * Authorization middleware — checks for a non-null principal on the envelope.
 * Downstream services should replace or extend this with real authz logic.
 *
 * @type {MiddlewareFn}
 */
async function authorizationMiddleware(envelope, next) {
  if (envelope.skipAuth !== true && envelope.principal == null) {
    const err = new Error(`Authorization: no principal on ${envelope.type}`);
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  await next();
}

/**
 * Logging middleware — attaches structured log metadata to the envelope.
 * Populates envelope._meta.startedAt and envelope._meta.path markers
 * without writing to console.
 *
 * @type {MiddlewareFn}
 */
async function loggingMiddleware(envelope, next) {
  envelope._meta = envelope._meta || {};
  envelope._meta.startedAt = Date.now();
  envelope._meta.path = (envelope._meta.path || []).concat('log');
  await next();
}

/**
 * Timing middleware — records the middleware ingress timestamp for latency
 * measurement. The final elapsed duration is computed post-dispatch.
 *
 * @type {MiddlewareFn}
 */
async function timingMiddleware(envelope, next) {
  envelope._meta = envelope._meta || {};
  envelope._meta.middlewareEnter = process.hrtime.bigint();
  await next();
  envelope._meta.middlewareExitNs = process.hrtime.bigint() - envelope._meta.middlewareEnter;
}

/**
 * Error handling middleware — normalises thrown values into Error objects
 * and attaches a phi-derived severity code based on ALERT_THRESHOLDS.
 *
 * @type {MiddlewareFn}
 */
async function errorHandlingMiddleware(envelope, next) {
  try {
    await next();
  } catch (err) {
    const structured = err instanceof Error ? err : new Error(String(err));
    structured.envelopeType = envelope.type;
    structured.envelopeId = envelope.commandId || envelope.queryId;
    // Assign phi-derived severity label
    if (!structured.severity) {
      structured.severity = structured.code === 'UNAUTHORIZED'
        ? 'critical'
        : structured.code === 'VALIDATION_ERROR'
          ? 'caution'
          : 'warning';
    }
    throw structured;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: COMMAND DEDUPLICATION TRACKER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks recently seen command IDs within a phi-derived sliding window to
 * reject duplicate commands. Uses a Map keyed by commandId with expiry
 * timestamps. Expired entries are purged on each check.
 */
class DedupTracker {
  constructor() {
    /** @type {Map<string, number>} commandId → expiresAt (ms) */
    this._seen = new Map();
  }

  /**
   * Checks whether a commandId is a duplicate within DEDUP_WINDOW_MS.
   * Registers the id if it is new. Purges expired entries on each call.
   *
   * @param {string} commandId - Unique identifier for the command.
   * @returns {boolean} True if the command is a duplicate and should be rejected.
   */
  check(commandId) {
    const now = Date.now();
    // Purge expired entries
    for (const [id, exp] of this._seen) {
      if (now > exp) this._seen.delete(id);
    }
    if (this._seen.has(commandId)) return true;
    this._seen.set(commandId, now + DEDUP_WINDOW_MS);
    return false;
  }

  /** @returns {number} Number of actively tracked command IDs. */
  get size() {
    return this._seen.size;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: PRIORITY QUEUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} QueuedCommand
 * @property {Object}   command    - The command envelope.
 * @property {Function} resolve    - Promise resolve callback.
 * @property {Function} reject     - Promise reject callback.
 * @property {number}   enqueuedAt - Timestamp when command was enqueued (ms).
 * @property {string}   priority   - PRIORITY tier (HOT | WARM | COLD).
 */

/**
 * Three-tier priority queue for command dispatch.
 * HOT commands execute immediately without queuing.
 * WARM commands wait up to WARM_QUEUE_MAX_WAIT_MS before timeout.
 * COLD commands wait up to COLD_QUEUE_MAX_WAIT_MS before timeout.
 *
 * Drain processes HOT first, then WARM, then COLD.
 */
class PriorityQueue {
  constructor() {
    /** @type {QueuedCommand[]} */
    this._hot = [];
    /** @type {QueuedCommand[]} */
    this._warm = [];
    /** @type {QueuedCommand[]} */
    this._cold = [];
  }

  /**
   * Enqueues a command in the appropriate priority tier.
   *
   * @param {QueuedCommand} item - Command wrapper with resolve/reject callbacks.
   */
  enqueue(item) {
    switch (item.priority) {
      case PRIORITY.HOT:  this._hot.push(item);  break;
      case PRIORITY.WARM: this._warm.push(item); break;
      default:            this._cold.push(item); break;
    }
  }

  /**
   * Dequeues the highest-priority item. Returns null when all queues are empty.
   * Respects max-wait deadlines: items that have waited beyond their tier's
   * maximum are rejected before being returned.
   *
   * @returns {QueuedCommand | null}
   */
  dequeue() {
    const now = Date.now();
    for (const [queue, maxWait] of [
      [this._hot,  0],
      [this._warm, WARM_QUEUE_MAX_WAIT_MS],
      [this._cold, COLD_QUEUE_MAX_WAIT_MS],
    ]) {
      while (queue.length > 0) {
        const item = queue.shift();
        const waited = now - item.enqueuedAt;
        if (maxWait > 0 && waited > maxWait) {
          const err = new Error(
            `PriorityQueue: ${item.priority} command ${item.command.commandId} ` +
            `exceeded max wait of ${maxWait}ms (waited ${waited}ms)`,
          );
          err.code = 'QUEUE_TIMEOUT';
          item.reject(err);
          continue;
        }
        return item;
      }
    }
    return null;
  }

  /** @returns {number} Total items across all tiers. */
  get size() {
    return this._hot.length + this._warm.length + this._cold.length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: PROJECTION MANAGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @callback ProjectorFn
 * @param {Object} event - Domain event produced by a command handler.
 * @returns {Promise<void>}
 */

/**
 * Manages read-model projections. Projectors register interest in specific
 * event types and are invoked asynchronously after command completion to
 * update read-optimized views. Projection failures are isolated and do not
 * affect the command result.
 */
class ProjectionManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, ProjectorFn[]>} eventType → list of projectors */
    this._projectors = new Map();
    /** @type {number} Monotonic lag tracker (ms) */
    this._lastProjectionMs = 0;
    /** @type {number} Count of successful projections */
    this._projectedCount = 0;
    /** @type {number} Count of projection failures */
    this._failureCount = 0;
  }

  /**
   * Registers a projector function for a given event type. Multiple projectors
   * can listen to the same event type; all are invoked in registration order.
   *
   * @param {string}      eventType - Domain event type string (e.g. 'SessionCreated').
   * @param {ProjectorFn} projector - Async function that updates a read model.
   * @throws {TypeError} If eventType is not a string or projector is not a function.
   */
  registerProjection(eventType, projector) {
    if (typeof eventType !== 'string' || eventType.trim() === '') {
      throw new TypeError('ProjectionManager.registerProjection: eventType must be a non-empty string');
    }
    if (typeof projector !== 'function') {
      throw new TypeError('ProjectionManager.registerProjection: projector must be a function');
    }
    if (!this._projectors.has(eventType)) {
      this._projectors.set(eventType, []);
    }
    this._projectors.get(eventType).push(projector);
  }

  /**
   * Dispatches a domain event to all registered projectors asynchronously.
   * Projection lag (time from event creation to projection completion) is
   * measured and emitted via the 'projectionUpdated' event.
   *
   * @param {Object} event          - The domain event to project.
   * @param {string} event.type     - Event type matching a registered projector key.
   * @param {number} [event.ts]     - Event creation timestamp (ms); defaults to now.
   * @returns {Promise<void>} Resolves once all projectors have been dispatched
   *   (not necessarily completed — projectors run concurrently).
   */
  async project(event) {
    const projectors = this._projectors.get(event.type);
    if (!projectors || projectors.length === 0) return;

    const eventTs = event.ts || Date.now();

    const tasks = projectors.map(async (fn) => {
      try {
        const start = Date.now();
        await fn(event);
        this._lastProjectionMs = Date.now() - start;
        this._projectedCount++;
        this.emit('projectionUpdated', {
          eventType: event.type,
          lagMs: Date.now() - eventTs,
        });
      } catch (err) {
        this._failureCount++;
        this.emit('projectionError', { eventType: event.type, error: err });
      }
    });

    await Promise.allSettled(tasks);
  }

  /**
   * Returns current projection metrics.
   *
   * @returns {{ projectedCount: number, failureCount: number, lastProjectionMs: number }}
   */
  metrics() {
    return {
      projectedCount: this._projectedCount,
      failureCount: this._failureCount,
      lastProjectionMs: this._lastProjectionMs,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: COMMAND BUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @callback CommandHandlerFn
 * @param {Object} command - The command envelope.
 * @returns {Promise<Object>} Command result / confirmation object.
 */

/**
 * CommandBus — write-path router for the CQRS pattern.
 *
 * Responsibilities:
 * - One handler per command type (strict routing, no fan-out).
 * - Phi-ordered middleware pipeline applied before every dispatch.
 * - Command deduplication within a fib(8)-second window.
 * - Priority queuing: HOT → immediate, WARM → fib(3)s wait, COLD → fib(5)s wait.
 * - Transient-failure retry with phi-backoff, fib(4) = 3 max retries.
 * - Hard timeout at phiTimeouts().slow ≈ 8090ms.
 * - Produces domain events that feed ProjectionManager.
 *
 * @fires CommandBus#commandDispatched
 * @fires CommandBus#commandCompleted
 * @fires CommandBus#commandFailed
 */
class CommandBus extends EventEmitter {
  /**
   * @param {ProjectionManager} projectionManager - Receives domain events post-dispatch.
   */
  constructor(projectionManager) {
    super();
    /** @type {Map<string, CommandHandlerFn>} */
    this._handlers = new Map();
    /** @type {ProjectionManager} */
    this._projections = projectionManager;
    /** @type {DedupTracker} */
    this._dedup = new DedupTracker();
    /** @type {PriorityQueue} */
    this._queue = new PriorityQueue();
    /** @type {Function} Composed middleware pipeline */
    this._pipeline = composeMiddleware([
      errorHandlingMiddleware,
      timingMiddleware,
      loggingMiddleware,
      authorizationMiddleware,
      validationMiddleware,
    ]);
    /** @type {number} */
    this._commandsDispatched = 0;
    /** @type {number} */
    this._commandsFailed = 0;
    /** @type {number} Running total of latency for average calculation */
    this._totalLatencyMs = 0;
  }

  /**
   * Registers a handler function for the given command type. Only one handler
   * is permitted per command type; a second registration throws.
   *
   * @param {string}           commandType - Unique string identifier for this command.
   * @param {CommandHandlerFn} handler     - Async function that processes the command.
   * @throws {TypeError}  If commandType is not a non-empty string.
   * @throws {TypeError}  If handler is not a function.
   * @throws {RangeError} If a handler for commandType is already registered.
   */
  register(commandType, handler) {
    if (typeof commandType !== 'string' || commandType.trim() === '') {
      throw new TypeError('CommandBus.register: commandType must be a non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('CommandBus.register: handler must be a function');
    }
    if (this._handlers.has(commandType)) {
      throw new RangeError(
        `CommandBus.register: handler already registered for "${commandType}"`,
      );
    }
    this._handlers.set(commandType, handler);
  }

  /**
   * Dispatches a command through the middleware pipeline, dedup check, priority
   * queue, and onto its registered handler. Retries on transient failure using
   * phi-backoff. Returns a confirmation object from the handler.
   *
   * @param {Object}  command           - The command envelope.
   * @param {string}  command.type      - Registered command type.
   * @param {string}  command.commandId - Unique ID for deduplication.
   * @param {*}       [command.payload] - Domain-specific payload.
   * @param {string}  [command.priority=PRIORITY.WARM] - HOT | WARM | COLD.
   * @param {Object}  [command.principal] - Auth principal (skip if skipAuth=true).
   * @returns {Promise<Object>} Resolves with the handler's confirmation object.
   * @throws {Error} On validation failure, duplicate detection, missing handler,
   *   non-transient errors, or exhausted retries.
   *
   * @fires CommandBus#commandDispatched
   * @fires CommandBus#commandCompleted
   * @fires CommandBus#commandFailed
   */
  async dispatch(command) {
    const start = Date.now();
    const commandId = command.commandId;
    const priority = command.priority || PRIORITY.WARM;

    // Deduplication check
    if (this._dedup.check(commandId)) {
      const err = new Error(
        `CommandBus: duplicate commandId "${commandId}" within ${DEDUP_WINDOW_MS}ms window`,
      );
      err.code = 'DUPLICATE_COMMAND';
      this._commandsFailed++;
      this.emit('commandFailed', { command, error: err });
      throw err;
    }

    // Run middleware pipeline (validation, auth, logging, timing, error handling)
    await this._pipeline(command);

    // For HOT commands skip the queue; otherwise route through priority queue
    if (priority !== PRIORITY.HOT) {
      await this._enqueueAndWait(command, priority);
    }

    const handler = this._handlers.get(command.type);
    if (!handler) {
      const err = new Error(`CommandBus: no handler registered for "${command.type}"`);
      err.code = 'HANDLER_NOT_FOUND';
      this._commandsFailed++;
      this.emit('commandFailed', { command, error: err });
      throw err;
    }

    this._commandsDispatched++;
    this.emit('commandDispatched', { command, priority });

    // Execute with retry + phi-backoff
    let result;
    let lastError;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        result = await withTimeout(
          handler(command),
          COMMAND_TIMEOUT_MS,
          `CommandBus.dispatch(${command.type})`,
        );
        break;
      } catch (err) {
        lastError = err;
        const isLast = attempt === MAX_RETRIES - 1;
        if (!isTransient(err) || isLast) {
          this._commandsFailed++;
          const latency = Date.now() - start;
          this._totalLatencyMs += latency;
          this.emit('commandFailed', { command, error: err, attempt, latency });
          throw err;
        }
        await new Promise(r => setTimeout(r, phiBackoffWithJitter(attempt)));
      }
    }

    const latency = Date.now() - start;
    this._totalLatencyMs += latency;
    this.emit('commandCompleted', { command, result, latency });

    // Emit domain events to projections asynchronously (non-blocking)
    if (result && Array.isArray(result.events)) {
      setImmediate(() => {
        for (const event of result.events) {
          this._projections.project(event).catch(() => {
            // Projection errors are captured and emitted by ProjectionManager
          });
        }
      });
    }

    return result;
  }

  /**
   * Places a WARM or COLD command into the priority queue and returns a promise
   * that resolves when the item is dequeued for execution.
   *
   * @param {Object} command  - Command envelope.
   * @param {string} priority - PRIORITY.WARM or PRIORITY.COLD.
   * @returns {Promise<void>} Resolves when the command reaches the front of its tier.
   * @private
   */
  _enqueueAndWait(command, priority) {
    return new Promise((resolve, reject) => {
      this._queue.enqueue({
        command,
        resolve,
        reject,
        enqueuedAt: Date.now(),
        priority,
      });
      // Drain synchronously — the top item in the queue may be this command
      // if no HOT item is ahead of it.
      setImmediate(() => this._drain());
    });
  }

  /**
   * Drains one item from the priority queue, resolving its waiting promise.
   * Continues draining until the queue is empty.
   *
   * @private
   */
  _drain() {
    let item = this._queue.dequeue();
    while (item !== null) {
      item.resolve();
      item = this._queue.dequeue();
    }
  }

  /**
   * Returns a snapshot of CommandBus performance metrics.
   *
   * @returns {{ commandsDispatched: number, commandsFailed: number, averageLatencyMs: number, queueDepth: number }}
   */
  metrics() {
    const executed = this._commandsDispatched;
    return {
      commandsDispatched: executed,
      commandsFailed: this._commandsFailed,
      averageLatencyMs: executed > 0
        ? Math.round(this._totalLatencyMs / executed)
        : 0,
      queueDepth: this._queue.size,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: QUERY BUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @callback QueryHandlerFn
 * @param {Object} queryRequest - The query envelope.
 * @returns {Promise<Object>} Query result data.
 */

/**
 * QueryBus — read-path router for the CQRS pattern.
 *
 * Responsibilities:
 * - One handler per query type (strict routing).
 * - LRU cache sized fib(16) = 987 entries, TTL = phiIntervals().sync.
 * - Idempotent: same query with same cacheKey always returns same data.
 * - Hard timeout at phiTimeouts().fast ≈ 1910ms.
 * - Phi-ordered middleware pipeline applied before every query.
 * - No retry logic — read failures surface immediately.
 *
 * @fires QueryBus#queryExecuted
 * @fires QueryBus#cacheHit
 * @fires QueryBus#cacheMiss
 */
class QueryBus extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, QueryHandlerFn>} */
    this._handlers = new Map();
    /** @type {LRUCache} */
    this._cache = new LRUCache(CACHE_MAX_SIZE, CACHE_TTL_MS);
    /** @type {Function} Composed middleware pipeline */
    this._pipeline = composeMiddleware([
      errorHandlingMiddleware,
      timingMiddleware,
      loggingMiddleware,
      authorizationMiddleware,
      validationMiddleware,
    ]);
    /** @type {number} */
    this._queriesExecuted = 0;
    /** @type {number} */
    this._totalLatencyMs = 0;
  }

  /**
   * Registers a handler function for the given query type. Only one handler
   * is permitted per query type.
   *
   * @param {string}         queryType - Unique string identifier for this query.
   * @param {QueryHandlerFn} handler   - Async function that returns read data.
   * @throws {TypeError}  If queryType is not a non-empty string.
   * @throws {TypeError}  If handler is not a function.
   * @throws {RangeError} If a handler for queryType is already registered.
   */
  register(queryType, handler) {
    if (typeof queryType !== 'string' || queryType.trim() === '') {
      throw new TypeError('QueryBus.register: queryType must be a non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('QueryBus.register: handler must be a function');
    }
    if (this._handlers.has(queryType)) {
      throw new RangeError(
        `QueryBus.register: handler already registered for "${queryType}"`,
      );
    }
    this._handlers.set(queryType, handler);
  }

  /**
   * Executes a query through the middleware pipeline and returns cached or
   * freshly fetched data. Queries with cacheKey set will be served from the
   * LRU cache when available; cache misses execute the handler and populate
   * the cache.
   *
   * Set `queryRequest.noCache = true` to bypass the cache for a specific call.
   *
   * @param {Object}  queryRequest           - The query envelope.
   * @param {string}  queryRequest.type      - Registered query type.
   * @param {string}  queryRequest.queryId   - Unique ID for this query invocation.
   * @param {string}  [queryRequest.cacheKey] - Stable key for cache lookup.
   * @param {boolean} [queryRequest.noCache]  - Bypass cache when true.
   * @param {Object}  [queryRequest.principal] - Auth principal.
   * @returns {Promise<Object>} Resolves with query result data.
   * @throws {Error} On validation failure, missing handler, or timeout.
   *
   * @fires QueryBus#queryExecuted
   * @fires QueryBus#cacheHit
   * @fires QueryBus#cacheMiss
   */
  async query(queryRequest) {
    const start = Date.now();

    // Run middleware pipeline
    await this._pipeline(queryRequest);

    // Cache lookup
    const useCache = !queryRequest.noCache && typeof queryRequest.cacheKey === 'string';
    if (useCache) {
      const cached = this._cache.get(queryRequest.cacheKey);
      if (cached !== undefined) {
        this.emit('cacheHit', { queryType: queryRequest.type, cacheKey: queryRequest.cacheKey });
        return cached;
      }
      this.emit('cacheMiss', { queryType: queryRequest.type, cacheKey: queryRequest.cacheKey });
    }

    const handler = this._handlers.get(queryRequest.type);
    if (!handler) {
      const err = new Error(`QueryBus: no handler registered for "${queryRequest.type}"`);
      err.code = 'HANDLER_NOT_FOUND';
      throw err;
    }

    const result = await withTimeout(
      handler(queryRequest),
      QUERY_TIMEOUT_MS,
      `QueryBus.query(${queryRequest.type})`,
    );

    // Populate cache
    if (useCache) {
      this._cache.set(queryRequest.cacheKey, result);
    }

    const latency = Date.now() - start;
    this._queriesExecuted++;
    this._totalLatencyMs += latency;
    this.emit('queryExecuted', { queryRequest, result, latency });

    return result;
  }

  /**
   * Explicitly invalidates a cache entry by key. Use after a command that
   * modifies the data a query reads.
   *
   * @param {string} cacheKey - The cache key to invalidate.
   */
  invalidateCache(cacheKey) {
    this._cache.invalidate(cacheKey);
  }

  /** Clears the entire query cache. */
  clearCache() {
    this._cache.clear();
  }

  /**
   * Returns a snapshot of QueryBus performance metrics.
   *
   * @returns {{ queriesExecuted: number, cacheHitRate: number, averageLatencyMs: number, cacheSize: number }}
   */
  metrics() {
    const executed = this._queriesExecuted;
    return {
      queriesExecuted: executed,
      cacheHitRate: this._cache.hitRate,
      averageLatencyMs: executed > 0
        ? Math.round(this._totalLatencyMs / executed)
        : 0,
      cacheSize: this._cache.size,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11: CQRS BUS — CENTRAL ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CQRSBus — central bus that wires together the CommandBus, QueryBus, and
 * ProjectionManager into a single coherent interface. Serves as the single
 * entry point for all CQRS operations in the Heady ecosystem.
 *
 * Architecture:
 * ```
 *   Callers
 *      │
 *      ├── dispatch(command) ──► CommandBus ──► Handler
 *      │                              │
 *      │                         Events emitted
 *      │                              │
 *      │                         ProjectionManager ──► Read Models
 *      │
 *      └── query(queryRequest) ──► QueryBus ──► LRU Cache / Handler
 * ```
 *
 * All numeric constants (timeouts, cache size, retry counts, queue waits)
 * are derived exclusively from Fibonacci numbers and phi-harmonic functions.
 *
 * @extends EventEmitter
 *
 * @fires CQRSBus#commandDispatched
 * @fires CQRSBus#commandCompleted
 * @fires CQRSBus#commandFailed
 * @fires CQRSBus#queryExecuted
 * @fires CQRSBus#projectionUpdated
 * @fires CQRSBus#cacheHit
 * @fires CQRSBus#cacheMiss
 *
 * @example
 * const bus = new CQRSBus();
 *
 * // Register handlers
 * bus.commandBus.register('CreateOrder', async (cmd) => {
 *   const order = await db.createOrder(cmd.payload);
 *   return { ok: true, orderId: order.id, events: [{ type: 'OrderCreated', ts: Date.now(), order }] };
 * });
 *
 * bus.queryBus.register('GetOrder', async (q) => db.findOrder(q.payload.orderId));
 *
 * bus.projectionManager.registerProjection('OrderCreated', async (event) => {
 *   await readDb.upsertOrderView(event.order);
 * });
 *
 * // Dispatch a command
 * const result = await bus.dispatch({
 *   type: 'CreateOrder',
 *   commandId: 'cmd-001',
 *   payload: { items: [...] },
 *   principal: { userId: 'u-42' },
 *   priority: 'HOT',
 * });
 *
 * // Execute a query
 * const order = await bus.query({
 *   type: 'GetOrder',
 *   queryId: 'q-001',
 *   cacheKey: 'order:cmd-001',
 *   payload: { orderId: 'cmd-001' },
 *   principal: { userId: 'u-42' },
 * });
 */
class CQRSBus extends EventEmitter {
  constructor() {
    super();

    /** @type {ProjectionManager} Read-model projection coordinator. */
    this.projectionManager = new ProjectionManager();

    /** @type {CommandBus} Write-path router. */
    this.commandBus = new CommandBus(this.projectionManager);

    /** @type {QueryBus} Read-path router with LRU cache. */
    this.queryBus = new QueryBus();

    this._wireEvents();
  }

  /**
   * Forwards events from sub-buses to the CQRSBus event surface so callers
   * can subscribe at a single point.
   *
   * @private
   */
  _wireEvents() {
    const forward = (source, ...eventNames) => {
      for (const name of eventNames) {
        source.on(name, (payload) => this.emit(name, payload));
      }
    };

    forward(
      this.commandBus,
      'commandDispatched', 'commandCompleted', 'commandFailed',
    );
    forward(
      this.queryBus,
      'queryExecuted', 'cacheHit', 'cacheMiss',
    );
    forward(
      this.projectionManager,
      'projectionUpdated', 'projectionError',
    );
  }

  /**
   * Convenience proxy: dispatches a command via the CommandBus.
   *
   * @param {Object} command - See {@link CommandBus#dispatch}.
   * @returns {Promise<Object>}
   */
  dispatch(command) {
    return this.commandBus.dispatch(command);
  }

  /**
   * Convenience proxy: executes a query via the QueryBus.
   *
   * @param {Object} queryRequest - See {@link QueryBus#query}.
   * @returns {Promise<Object>}
   */
  query(queryRequest) {
    return this.queryBus.query(queryRequest);
  }

  /**
   * Aggregates metrics from all sub-systems into a single snapshot.
   *
   * Fields:
   * - commandsDispatched    — total successfully initiated commands
   * - commandsFailed        — total command failures
   * - averageCommandLatency — mean end-to-end command duration (ms)
   * - commandQueueDepth     — items currently pending in priority queue
   * - queriesExecuted       — total completed queries
   * - queryCacheHitRate     — LRU cache hit ratio in [0, 1]
   * - averageQueryLatency   — mean end-to-end query duration (ms)
   * - queryCacheSize        — live entries in the query LRU cache
   * - projectionLag         — duration of most recent projection (ms)
   * - projectedCount        — total successful projections
   * - projectionFailures    — total projection errors
   *
   * @returns {Object} Aggregated metrics snapshot.
   */
  metrics() {
    const cmd  = this.commandBus.metrics();
    const qry  = this.queryBus.metrics();
    const proj = this.projectionManager.metrics();

    return {
      commandsDispatched:    cmd.commandsDispatched,
      commandsFailed:        cmd.commandsFailed,
      averageCommandLatency: cmd.averageLatencyMs,
      commandQueueDepth:     cmd.queueDepth,

      queriesExecuted:       qry.queriesExecuted,
      queryCacheHitRate:     qry.cacheHitRate,
      averageQueryLatency:   qry.averageLatencyMs,
      queryCacheSize:        qry.cacheSize,

      projectionLag:         proj.lastProjectionMs,
      projectedCount:        proj.projectedCount,
      projectionFailures:    proj.failureCount,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12: EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  CQRSBus,
  CommandBus,
  QueryBus,
  ProjectionManager,
  LRUCache,
  DedupTracker,
  PriorityQueue,
  PRIORITY,
  COMMAND_TIMEOUT_MS,
  QUERY_TIMEOUT_MS,
  MIDDLEWARE_TIMEOUT_MS,
  CACHE_MAX_SIZE,
  CACHE_TTL_MS,
  MAX_RETRIES,
  DEDUP_WINDOW_MS,
  WARM_QUEUE_MAX_WAIT_MS,
  COLD_QUEUE_MAX_WAIT_MS,
};
