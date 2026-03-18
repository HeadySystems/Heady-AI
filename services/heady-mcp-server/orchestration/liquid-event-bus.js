/**
 * @fileoverview Liquid Event Bus — Central Nervous System for the Heady Ecosystem
 * @description Pub/sub event bus with phi-weighted priority channels, SSE streaming,
 * backpressure-aware delivery, and semantic deduplication.
 * @module liquid-event-bus
 */

'use strict';

const { EventEmitter } = require('events');
const {
  PHI, PSI, PHI_SQUARED, FIB, CSL, CSL_ERROR_CODES,
  INTERVALS, phiBackoff, phiDecay, correlationId, structuredLog,
} = require('./phi-constants');

// ─── CHANNEL DEFINITIONS ─────────────────────────────────────────────────────

/**
 * @constant {Object} CHANNELS - Event bus channels with phi-weighted priorities
 * Higher priority channels are processed first during backpressure
 */
const CHANNELS = {
  system:   { priority: FIB[11], label: 'System',   maxBuffer: FIB[8] * FIB[5] },   // 89
  security: { priority: FIB[10], label: 'Security', maxBuffer: FIB[8] * FIB[5] },   // 55
  health:   { priority: FIB[9],  label: 'Health',   maxBuffer: FIB[8] * FIB[4] },   // 34
  swarm:    { priority: FIB[8],  label: 'Swarm',    maxBuffer: FIB[9] * FIB[5] },   // 21
  agent:    { priority: FIB[7],  label: 'Agent',    maxBuffer: FIB[9] * FIB[5] },   // 13
  pipeline: { priority: FIB[6],  label: 'Pipeline', maxBuffer: FIB[9] * FIB[5] },   // 8
  tool:     { priority: FIB[5],  label: 'Tool',     maxBuffer: FIB[10] * FIB[4] },  // 5
  memory:   { priority: FIB[4],  label: 'Memory',   maxBuffer: FIB[10] * FIB[4] },  // 3
  metrics:  { priority: FIB[3],  label: 'Metrics',  maxBuffer: FIB[11] * FIB[3] },  // 2
};

const CHANNEL_NAMES = Object.keys(CHANNELS);

// ─── EVENT ENVELOPE ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} EventEnvelope
 * @property {string} id - Unique event ID
 * @property {string} channel - Channel name
 * @property {string} type - Event type within channel
 * @property {*} payload - Event payload
 * @property {number} timestamp - Epoch ms
 * @property {number} priority - Computed priority
 * @property {string} correlationId - Trace correlation ID
 * @property {string} source - Emitting component
 * @property {number} ttl - Time to live in ms
 * @property {string} [fingerprint] - Semantic dedup fingerprint
 */

/**
 * Create a new event envelope
 * @param {string} channel - Target channel
 * @param {string} type - Event type
 * @param {*} payload - Event data
 * @param {Object} [opts={}] - Options
 * @returns {EventEnvelope}
 */
function createEnvelope(channel, type, payload, opts = {}) {
  const ch = CHANNELS[channel];
  if (!ch) throw new Error(`${CSL_ERROR_CODES.E_BELOW_MINIMUM.code}: Unknown channel '${channel}'`);
  return {
    id: correlationId('evt'),
    channel,
    type,
    payload,
    timestamp: Date.now(),
    priority: opts.priority || ch.priority,
    correlationId: opts.correlationId || correlationId('cor'),
    source: opts.source || 'unknown',
    ttl: opts.ttl || FIB[9] * 1000, // 34 seconds default TTL
    fingerprint: opts.fingerprint || null,
  };
}

// ─── SSE SUBSCRIBER ──────────────────────────────────────────────────────────

/**
 * @class SSESubscriber
 * @description Manages an SSE connection for real-time event streaming
 */
class SSESubscriber {
  /**
   * @param {string} id - Subscriber ID
   * @param {Object} res - HTTP response object (writable stream)
   * @param {string[]} channels - Subscribed channels
   */
  constructor(id, res, channels) {
    this.id = id;
    this.res = res;
    this.channels = new Set(channels);
    this.createdAt = Date.now();
    this.eventCount = 0;
    this.alive = true;
  }

  /**
   * Send an event via SSE
   * @param {EventEnvelope} envelope
   */
  send(envelope) {
    if (!this.alive) return;
    try {
      this.res.write(`id: ${envelope.id}\n`);
      this.res.write(`event: ${envelope.channel}.${envelope.type}\n`);
      this.res.write(`data: ${JSON.stringify(envelope)}\n\n`);
      this.eventCount++;
    } catch {
      this.alive = false;
    }
  }

  /** Close the SSE connection */
  close() {
    this.alive = false;
    try { this.res.end(); } catch { /* already closed */ }
  }
}

// ─── DEDUP RING BUFFER ───────────────────────────────────────────────────────

/**
 * @class DedupRing
 * @description Fixed-size ring buffer for semantic deduplication
 */
class DedupRing {
  /**
   * @param {number} [size] - Ring size (default: FIB[12] = 144)
   */
  constructor(size = FIB[12]) {
    this._buffer = new Array(size).fill(null);
    this._index = 0;
    this._size = size;
  }

  /**
   * Check if a fingerprint exists and add if not
   * @param {string} fingerprint
   * @returns {boolean} True if duplicate found
   */
  checkAndAdd(fingerprint) {
    if (!fingerprint) return false;
    for (let i = 0; i < this._size; i++) {
      if (this._buffer[i] === fingerprint) return true;
    }
    this._buffer[this._index] = fingerprint;
    this._index = (this._index + 1) % this._size;
    return false;
  }

  /** Reset the ring buffer */
  clear() {
    this._buffer.fill(null);
    this._index = 0;
  }
}

// ─── LIQUID EVENT BUS ────────────────────────────────────────────────────────

/**
 * @class LiquidEventBus
 * @extends EventEmitter
 * @description Central nervous system event bus with phi-weighted priority channels,
 * SSE streaming, backpressure management, and semantic deduplication.
 */
class LiquidEventBus extends EventEmitter {
  /**
   * @param {Object} [config={}]
   * @param {number} [config.maxBufferMultiplier] - Buffer size multiplier
   * @param {boolean} [config.dedupEnabled] - Enable semantic dedup
   * @param {number} [config.drainIntervalMs] - Queue drain interval
   */
  constructor(config = {}) {
    super();
    this.setMaxListeners(FIB[11]); // 89

    /** @private */
    this._config = {
      maxBufferMultiplier: config.maxBufferMultiplier || 1,
      dedupEnabled: config.dedupEnabled !== false,
      drainIntervalMs: config.drainIntervalMs || INTERVALS.HEARTBEAT,
    };

    /** @private {Map<string, EventEnvelope[]>} Channel queues */
    this._queues = new Map();
    CHANNEL_NAMES.forEach(ch => this._queues.set(ch, []));

    /** @private {Map<string, Set<Function>>} Channel subscribers */
    this._subscribers = new Map();
    CHANNEL_NAMES.forEach(ch => this._subscribers.set(ch, new Set()));

    /** @private {Map<string, SSESubscriber>} SSE subscribers */
    this._sseSubscribers = new Map();

    /** @private */
    this._dedup = new DedupRing();

    /** @private */
    this._stats = {
      published: 0,
      delivered: 0,
      dropped: 0,
      deduplicated: 0,
      backpressureEvents: 0,
    };

    /** @private */
    this._drainTimer = null;
    this._running = false;
    this._corrId = correlationId('bus');
  }

  /**
   * Start the event bus
   * @returns {Promise<void>}
   */
  async start() {
    if (this._running) return;
    this._running = true;
    this._drainTimer = setInterval(() => this._drain(), this._config.drainIntervalMs);
    this.emit('started', structuredLog('info', 'LiquidEventBus', 'Event bus started', {}, this._corrId));
  }

  /**
   * Stop the event bus gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    this._running = false;
    if (this._drainTimer) {
      clearInterval(this._drainTimer);
      this._drainTimer = null;
    }
    // Final drain
    this._drain();
    // Close all SSE connections
    for (const sub of this._sseSubscribers.values()) {
      sub.close();
    }
    this._sseSubscribers.clear();
    this.emit('stopped', structuredLog('info', 'LiquidEventBus', 'Event bus stopped', {}, this._corrId));
  }

  /**
   * Publish an event to a channel
   * @param {string} channel - Target channel
   * @param {string} type - Event type
   * @param {*} payload - Event data
   * @param {Object} [opts={}] - Envelope options
   * @returns {EventEnvelope|null} The envelope if published, null if dropped
   */
  publish(channel, type, payload, opts = {}) {
    const envelope = createEnvelope(channel, type, payload, opts);

    // Semantic dedup check
    if (this._config.dedupEnabled && envelope.fingerprint) {
      if (this._dedup.checkAndAdd(envelope.fingerprint)) {
        this._stats.deduplicated++;
        return null;
      }
    }

    // TTL check
    if (envelope.ttl <= 0) {
      this._stats.dropped++;
      return null;
    }

    // Backpressure check
    const queue = this._queues.get(channel);
    const chConfig = CHANNELS[channel];
    const maxBuf = chConfig.maxBuffer * this._config.maxBufferMultiplier;
    if (queue.length >= maxBuf) {
      this._stats.backpressureEvents++;
      // Drop lowest priority events
      queue.sort((a, b) => b.priority - a.priority);
      while (queue.length >= maxBuf) {
        queue.pop();
        this._stats.dropped++;
      }
    }

    queue.push(envelope);
    this._stats.published++;
    this.emit('published', envelope);
    return envelope;
  }

  /**
   * Subscribe to a channel
   * @param {string} channel - Channel name
   * @param {Function} handler - Event handler(envelope)
   * @returns {Function} Unsubscribe function
   */
  subscribe(channel, handler) {
    if (!CHANNELS[channel]) {
      throw new Error(`${CSL_ERROR_CODES.E_BELOW_MINIMUM.code}: Unknown channel '${channel}'`);
    }
    const subs = this._subscribers.get(channel);
    subs.add(handler);
    return () => subs.delete(handler);
  }

  /**
   * Subscribe to multiple channels
   * @param {string[]} channels - Channel names
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  subscribeMany(channels, handler) {
    const unsubs = channels.map(ch => this.subscribe(ch, handler));
    return () => unsubs.forEach(fn => fn());
  }

  /**
   * Register an SSE subscriber
   * @param {string} id - Subscriber ID
   * @param {Object} res - HTTP response
   * @param {string[]} channels - Channels to subscribe
   * @returns {SSESubscriber}
   */
  registerSSE(id, res, channels) {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Heady-Phi': String(PHI),
    });

    const subscriber = new SSESubscriber(id, res, channels);
    this._sseSubscribers.set(id, subscriber);

    // Send initial connection event
    subscriber.send(createEnvelope('system', 'sse.connected', {
      subscriberId: id,
      channels,
    }, { source: 'LiquidEventBus', correlationId: this._corrId }));

    return subscriber;
  }

  /**
   * Unregister an SSE subscriber
   * @param {string} id - Subscriber ID
   */
  unregisterSSE(id) {
    const sub = this._sseSubscribers.get(id);
    if (sub) {
      sub.close();
      this._sseSubscribers.delete(id);
    }
  }

  /**
   * Drain all queues, delivering events by priority
   * @private
   */
  _drain() {
    const now = Date.now();
    // Collect all events from all channels, sorted by priority
    const allEvents = [];

    for (const [channel, queue] of this._queues.entries()) {
      while (queue.length > 0) {
        const evt = queue.shift();
        // Check TTL
        if (now - evt.timestamp > evt.ttl) {
          this._stats.dropped++;
          continue;
        }
        allEvents.push(evt);
      }
    }

    // Sort by priority descending (highest priority first)
    allEvents.sort((a, b) => b.priority - a.priority);

    for (const envelope of allEvents) {
      this._deliver(envelope);
    }
  }

  /**
   * Deliver an event to all subscribers
   * @private
   * @param {EventEnvelope} envelope
   */
  _deliver(envelope) {
    // Deliver to channel subscribers
    const subs = this._subscribers.get(envelope.channel);
    if (subs) {
      for (const handler of subs) {
        try {
          handler(envelope);
          this._stats.delivered++;
        } catch (err) {
          this.emit('error', structuredLog('error', 'LiquidEventBus', 'Handler error', {
            channel: envelope.channel,
            type: envelope.type,
            error: err.message,
          }, envelope.correlationId));
        }
      }
    }

    // Deliver to SSE subscribers
    for (const sseSub of this._sseSubscribers.values()) {
      if (sseSub.alive && sseSub.channels.has(envelope.channel)) {
        sseSub.send(envelope);
        this._stats.delivered++;
      }
    }

    // Emit on the bus itself for wildcard listeners
    this.emit(`event:${envelope.channel}`, envelope);
    this.emit('event:*', envelope);
  }

  /**
   * Get health status
   * @returns {Object} Health report
   */
  health() {
    const queueDepths = {};
    let totalDepth = 0;
    for (const [ch, queue] of this._queues.entries()) {
      queueDepths[ch] = queue.length;
      totalDepth += queue.length;
    }

    const totalCapacity = CHANNEL_NAMES.reduce(
      (sum, ch) => sum + CHANNELS[ch].maxBuffer * this._config.maxBufferMultiplier, 0
    );
    const utilization = totalCapacity > 0 ? totalDepth / totalCapacity : 0;
    const coherence = 1 - (utilization * PSI); // Higher coherence when less pressure

    return {
      status: coherence >= CSL.MINIMUM ? 'healthy' : 'degraded',
      coherence: parseFloat(coherence.toFixed(FIB[4])),
      running: this._running,
      channels: CHANNEL_NAMES.length,
      queueDepths,
      totalDepth,
      subscribers: CHANNEL_NAMES.reduce(
        (sum, ch) => sum + this._subscribers.get(ch).size, 0
      ),
      sseSubscribers: this._sseSubscribers.size,
      stats: { ...this._stats },
      phi: PHI,
    };
  }
}

// ─── SINGLETON FACTORY ───────────────────────────────────────────────────────

let _instance = null;

/**
 * Get or create the singleton event bus instance
 * @param {Object} [config] - Configuration
 * @returns {LiquidEventBus}
 */
function getEventBus(config) {
  if (!_instance) {
    _instance = new LiquidEventBus(config);
  }
  return _instance;
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  LiquidEventBus,
  SSESubscriber,
  DedupRing,
  CHANNELS,
  CHANNEL_NAMES,
  createEnvelope,
  getEventBus,
};
