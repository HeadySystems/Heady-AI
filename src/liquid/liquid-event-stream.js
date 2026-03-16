/**
 * Heady™ LiquidEventStream v1.0
 * Typed Action/Observation event stream with replay capability
 * Absorbed from: OpenHands event-stream architecture
 *
 * Actions flow through a central pub/sub hub to execution targets.
 * Observations flow back with typed payloads and immutable Event History.
 * Supports crash-proof replay from any checkpoint.
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const {
  PHI, PSI, PSI_SQ, fib, phiBackoffWithJitter,
  CSL_THRESHOLDS, PHI_TIMING,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('liquid-event-stream');

// ── Event Types ──────────────────────────────────────────────────
const ACTION_TYPES = Object.freeze({
  CODE_EDIT:      'CODE_EDIT',
  FILE_READ:      'FILE_READ',
  FILE_WRITE:     'FILE_WRITE',
  SHELL_EXEC:     'SHELL_EXEC',
  BROWSER_NAV:    'BROWSER_NAV',
  AGENT_DELEGATE: 'AGENT_DELEGATE',
  MEMORY_SEARCH:  'MEMORY_SEARCH',
  TOOL_CALL:      'TOOL_CALL',
  MODEL_QUERY:    'MODEL_QUERY',
  APPROVAL_REQ:   'APPROVAL_REQ',
});

const OBSERVATION_TYPES = Object.freeze({
  SUCCESS:        'SUCCESS',
  ERROR:          'ERROR',
  PARTIAL:        'PARTIAL',
  TIMEOUT:        'TIMEOUT',
  DENIED:         'DENIED',
  DELEGATED:      'DELEGATED',
});

const STREAM_STATES = Object.freeze({
  IDLE:      'IDLE',
  STREAMING: 'STREAMING',
  PAUSED:    'PAUSED',
  REPLAYING: 'REPLAYING',
  DRAINING:  'DRAINING',
  CLOSED:    'CLOSED',
});

// Phi-scaled capacities
const MAX_HISTORY = fib(13);          // 233 events
const MAX_SUBSCRIBERS = fib(8);       // 21
const REPLAY_BATCH_SIZE = fib(7);     // 13
const COMPACTION_THRESHOLD = fib(12); // 144

class LiquidAction {
  constructor(type, payload, metadata = {}) {
    this.id = crypto.randomUUID();
    this.type = type;
    this.payload = payload;
    this.timestamp = Date.now();
    this.hash = this._computeHash();
    this.metadata = {
      agentId: metadata.agentId || null,
      sessionId: metadata.sessionId || null,
      parentActionId: metadata.parentActionId || null,
      idempotencyKey: metadata.idempotencyKey || this.id,
      priority: metadata.priority || PSI,  // default golden ratio priority
      ...metadata,
    };
  }

  _computeHash() {
    return crypto.createHash('sha256')
      .update(`${this.type}:${JSON.stringify(this.payload)}:${this.timestamp}`)
      .digest('hex')
      .slice(0, 16);
  }

  toJSON() {
    return { id: this.id, type: this.type, payload: this.payload,
             timestamp: this.timestamp, hash: this.hash, metadata: this.metadata };
  }
}

class LiquidObservation {
  constructor(actionId, type, result, metadata = {}) {
    this.id = crypto.randomUUID();
    this.actionId = actionId;
    this.type = type;
    this.result = result;
    this.timestamp = Date.now();
    this.latencyMs = metadata.startTime ? this.timestamp - metadata.startTime : 0;
    this.metadata = metadata;
  }

  toJSON() {
    return { id: this.id, actionId: this.actionId, type: this.type,
             result: this.result, timestamp: this.timestamp,
             latencyMs: this.latencyMs, metadata: this.metadata };
  }
}

class LiquidEventStream extends EventEmitter {
  constructor(config = {}) {
    super();
    this.setMaxListeners(MAX_SUBSCRIBERS);

    this.state = STREAM_STATES.IDLE;
    this.sessionId = config.sessionId || crypto.randomUUID();

    // Immutable Event History for replay
    this._history = [];
    this._historyIndex = new Map(); // actionId → index
    this._subscribers = new Map();  // channel → Set<callback>
    this._steerQueue = [];          // inbound messages during active runs
    this._idempotencyCache = new Map();

    // Phi-scaled metrics
    this._metrics = {
      actionsDispatched: 0,
      observationsReceived: 0,
      replaysPerformed: 0,
      compactionsPerformed: 0,
      avgLatencyMs: 0,
      _latencySum: 0,
    };

    logger.info({ sessionId: this.sessionId }, 'LiquidEventStream initialized');
  }

  // ── Action Dispatch ────────────────────────────────────────────
  async dispatch(action) {
    if (this.state === STREAM_STATES.CLOSED) {
      throw new Error('HEADY-ES-001: Cannot dispatch to closed stream');
    }

    // Idempotency check
    const idemKey = action.metadata.idempotencyKey;
    if (this._idempotencyCache.has(idemKey)) {
      logger.debug({ idemKey }, 'Duplicate action suppressed');
      return this._idempotencyCache.get(idemKey);
    }

    this.state = STREAM_STATES.STREAMING;
    action.metadata.sessionId = this.sessionId;

    // Record to immutable history
    const entry = { type: 'action', event: action.toJSON(), index: this._history.length };
    this._history.push(entry);
    this._historyIndex.set(action.id, entry.index);

    // Broadcast to subscribers
    const channel = action.type;
    if (this._subscribers.has(channel)) {
      for (const cb of this._subscribers.get(channel)) {
        try { await cb(action); } catch (e) {
          logger.error({ actionId: action.id, error: e.message }, 'Subscriber error');
        }
      }
    }

    // Emit typed event
    this.emit('action', action);
    this.emit(`action:${action.type}`, action);
    this._metrics.actionsDispatched++;

    // Cache for idempotency (evict after fib(8) seconds)
    this._idempotencyCache.set(idemKey, action);
    setTimeout(() => this._idempotencyCache.delete(idemKey), fib(8) * 1000);

    // Auto-compact if history exceeds threshold
    if (this._history.length >= COMPACTION_THRESHOLD) {
      this._compact();
    }

    return action;
  }

  // ── Observation Recording ──────────────────────────────────────
  observe(actionId, type, result, metadata = {}) {
    const observation = new LiquidObservation(actionId, type, result, metadata);

    const entry = { type: 'observation', event: observation.toJSON(), index: this._history.length };
    this._history.push(entry);

    this.emit('observation', observation);
    this.emit(`observation:${type}`, observation);

    // Update latency metrics
    this._metrics.observationsReceived++;
    if (observation.latencyMs > 0) {
      this._metrics._latencySum += observation.latencyMs;
      this._metrics.avgLatencyMs = this._metrics._latencySum / this._metrics.observationsReceived;
    }

    return observation;
  }

  // ── Steer Queue (inject during active runs) ────────────────────
  steer(message) {
    this._steerQueue.push({
      message,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    });
    this.emit('steer:queued', message);
  }

  drainSteerQueue() {
    const messages = [...this._steerQueue];
    this._steerQueue = [];
    return messages;
  }

  // ── Subscribe to channels ──────────────────────────────────────
  subscribe(channel, callback) {
    if (!this._subscribers.has(channel)) {
      this._subscribers.set(channel, new Set());
    }
    this._subscribers.get(channel).add(callback);
    return () => this._subscribers.get(channel)?.delete(callback);
  }

  // ── Replay from Event History ──────────────────────────────────
  async replay(fromIndex = 0, filter = null) {
    if (this.state === STREAM_STATES.REPLAYING) {
      throw new Error('HEADY-ES-002: Replay already in progress');
    }

    const prevState = this.state;
    this.state = STREAM_STATES.REPLAYING;
    this._metrics.replaysPerformed++;

    logger.info({ fromIndex, totalEvents: this._history.length }, 'Replay started');

    const events = this._history.slice(fromIndex);
    const filtered = filter ? events.filter(filter) : events;

    // Process in phi-scaled batches
    for (let i = 0; i < filtered.length; i += REPLAY_BATCH_SIZE) {
      const batch = filtered.slice(i, i + REPLAY_BATCH_SIZE);
      for (const entry of batch) {
        this.emit('replay:event', entry);
      }
      // Yield control between batches
      await new Promise(r => setImmediate(r));
    }

    this.state = prevState;
    this.emit('replay:complete', { fromIndex, eventsReplayed: filtered.length });
    logger.info({ eventsReplayed: filtered.length }, 'Replay complete');

    return filtered;
  }

  // ── Query Event History ────────────────────────────────────────
  getHistory(options = {}) {
    let events = [...this._history];

    if (options.type) events = events.filter(e => e.type === options.type);
    if (options.actionType) events = events.filter(e =>
      e.type === 'action' && e.event.type === options.actionType);
    if (options.since) events = events.filter(e => e.event.timestamp >= options.since);
    if (options.agentId) events = events.filter(e =>
      e.event.metadata?.agentId === options.agentId);

    return events;
  }

  getActionObservation(actionId) {
    const actionIdx = this._historyIndex.get(actionId);
    if (actionIdx === undefined) return null;

    const action = this._history[actionIdx];
    const observations = this._history.filter(e =>
      e.type === 'observation' && e.event.actionId === actionId);

    return { action, observations };
  }

  // ── Compaction ─────────────────────────────────────────────────
  _compact() {
    if (this._history.length < COMPACTION_THRESHOLD) return;

    const keepCount = Math.round(MAX_HISTORY * PSI); // keep 61.8%
    const toRemove = this._history.length - keepCount;

    if (toRemove <= 0) return;

    // Remove oldest events, rebuild index
    this._history = this._history.slice(toRemove);
    this._historyIndex.clear();
    this._history.forEach((entry, idx) => {
      if (entry.type === 'action') {
        this._historyIndex.set(entry.event.id, idx);
      }
      entry.index = idx;
    });

    this._metrics.compactionsPerformed++;
    logger.info({ removed: toRemove, remaining: this._history.length }, 'Event history compacted');
  }

  // ── Lifecycle ──────────────────────────────────────────────────
  pause() {
    this.state = STREAM_STATES.PAUSED;
    this.emit('stream:paused');
  }

  resume() {
    this.state = STREAM_STATES.STREAMING;
    this.emit('stream:resumed');
  }

  async close() {
    this.state = STREAM_STATES.DRAINING;
    this.emit('stream:draining');

    // Flush remaining steer queue
    this.drainSteerQueue();

    this.state = STREAM_STATES.CLOSED;
    this._subscribers.clear();
    this._idempotencyCache.clear();
    this.removeAllListeners();

    logger.info({
      sessionId: this.sessionId,
      metrics: this._metrics,
    }, 'LiquidEventStream closed');
  }

  get metrics() { return { ...this._metrics }; }
  get historyLength() { return this._history.length; }
}

module.exports = {
  LiquidEventStream,
  LiquidAction,
  LiquidObservation,
  ACTION_TYPES,
  OBSERVATION_TYPES,
  STREAM_STATES,
};
