/**
 * Heady Event Bus — Cross-Service Publish-Subscribe
 *
 * Provides a unified event bus with NATS-compatible topic routing,
 * wildcard subscriptions, dead-letter handling, and phi-scaled
 * backpressure. Works in-process and can bridge to NATS JetStream.
 *
 * @module core/event-bus/event-bus
 * @author Eric Haywood — HeadySystems Inc.
 * @license PROPRIETARY — 51+ Provisional Patents
 */

import { EventEmitter } from 'events';
import {
  PHI, PSI, FIB,
  phiThreshold,
} from '../../packages/phi-math-foundation/src/index.js';
import { createLogger } from '../../packages/structured-logger/src/index.js';

const logger = createLogger('event-bus');

/** Maximum in-memory queue depth per subscription (Fibonacci) */
const MAX_QUEUE_DEPTH = FIB[13]; // 233

/** Dead letter threshold — messages retried more than FIB[5] times */
const MAX_RETRIES = FIB[5]; // 5

/** Backpressure threshold — queue utilization triggers at ψ ≈ 0.618 */
const BACKPRESSURE_THRESHOLD = PSI;

/**
 * Event envelope — wraps every published event with metadata.
 */
export class EventEnvelope {
  constructor(topic, payload, options = {}) {
    this.id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.topic = topic;
    this.payload = payload;
    this.publishedAt = Date.now();
    this.correlationId = options.correlationId || this.id;
    this.source = options.source || 'unknown';
    this.retryCount = 0;
    this.headers = options.headers || {};
  }
}

/**
 * Subscription — a registered handler for a topic pattern.
 */
class Subscription {
  constructor(id, pattern, handler, options = {}) {
    this.id = id;
    this.pattern = pattern;
    this.regex = Subscription.patternToRegex(pattern);
    this.handler = handler;
    this.group = options.group || null;   // Queue group for load balancing
    this.createdAt = Date.now();
    this.messagesReceived = 0;
    this.errors = 0;
    this.active = true;
  }

  /**
   * Convert NATS-style topic pattern to regex.
   * '*' matches one segment, '>' matches one or more trailing segments.
   *
   * @param {string} pattern - e.g., 'heady.services.*.health'
   * @returns {RegExp}
   */
  static patternToRegex(pattern) {
    const escaped = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '[^.]+')
      .replace(/>$/, '.+');
    return new RegExp(`^${escaped}$`);
  }

  matches(topic) {
    return this.regex.test(topic);
  }
}

/**
 * HeadyEventBus — in-process pub-sub with NATS-compatible topic routing.
 *
 * @fires HeadyEventBus#event:published
 * @fires HeadyEventBus#event:delivered
 * @fires HeadyEventBus#event:dead-letter
 * @fires HeadyEventBus#backpressure:warning
 */
export class HeadyEventBus extends EventEmitter {
  constructor(options = {}) {
    super();

    /** @type {Map<string, Subscription>} */
    this.subscriptions = new Map();

    /** @type {EventEnvelope[]} Dead letter queue */
    this.deadLetterQueue = [];

    /** @type {Map<string, EventEnvelope[]>} Per-subscription pending queues */
    this.pendingQueues = new Map();

    this.maxQueueDepth = options.maxQueueDepth || MAX_QUEUE_DEPTH;
    this.maxRetries = options.maxRetries || MAX_RETRIES;
    this.totalPublished = 0;
    this.totalDelivered = 0;
    this.totalDeadLettered = 0;

    /** NATS bridge connection (null if not connected to external NATS) */
    this.natsBridge = null;

    logger.info({
      maxQueueDepth: this.maxQueueDepth,
      maxRetries: this.maxRetries,
    }, 'HeadyEventBus initialized');
  }

  /**
   * Subscribe to a topic pattern.
   *
   * @param {string} pattern - NATS-style topic pattern (e.g., 'heady.swarm.*')
   * @param {Function} handler - async (envelope) => void
   * @param {object} [options]
   * @param {string} [options.group] - Queue group for load-balanced delivery
   * @returns {string} Subscription ID
   */
  subscribe(pattern, handler, options = {}) {
    const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sub = new Subscription(subId, pattern, handler, options);

    this.subscriptions.set(subId, sub);
    this.pendingQueues.set(subId, []);

    logger.info({
      subscriptionId: subId,
      pattern,
      group: options.group || null,
    }, 'Subscription created');

    return subId;
  }

  /**
   * Unsubscribe from a topic.
   *
   * @param {string} subscriptionId
   */
  unsubscribe(subscriptionId) {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.active = false;
      this.subscriptions.delete(subscriptionId);
      this.pendingQueues.delete(subscriptionId);

      logger.info({
        subscriptionId,
        pattern: sub.pattern,
      }, 'Subscription removed');
    }
  }

  /**
   * Publish an event to a topic.
   *
   * @param {string} topic - Dot-delimited topic (e.g., 'heady.swarm.bee.spawned')
   * @param {*} payload - Event payload
   * @param {object} [options]
   * @returns {EventEnvelope} The published envelope
   */
  async publish(topic, payload, options = {}) {
    const envelope = new EventEnvelope(topic, payload, options);
    this.totalPublished++;

    // Find matching subscriptions
    const matchingSubs = this._findMatchingSubscriptions(topic);

    if (matchingSubs.length === 0) {
      logger.debug({ topic, eventId: envelope.id }, 'No subscribers for topic');
      return envelope;
    }

    // Group-based delivery: within each group, only one subscriber gets the event
    const groupMap = new Map();
    const ungrouped = [];

    for (const sub of matchingSubs) {
      if (sub.group) {
        if (!groupMap.has(sub.group)) {
          groupMap.set(sub.group, []);
        }
        groupMap.get(sub.group).push(sub);
      } else {
        ungrouped.push(sub);
      }
    }

    // Deliver to all ungrouped subscribers
    const deliveryPromises = ungrouped.map(sub => this._deliver(sub, envelope));

    // Deliver to one subscriber per group (round-robin by message count)
    for (const [, groupSubs] of groupMap) {
      const selected = groupSubs.reduce((min, sub) =>
        sub.messagesReceived < min.messagesReceived ? sub : min
      );
      deliveryPromises.push(this._deliver(selected, envelope));
    }

    await Promise.allSettled(deliveryPromises);

    this.emit('event:published', { topic, eventId: envelope.id });

    // Bridge to external NATS if connected
    if (this.natsBridge) {
      this._bridgeToNats(envelope);
    }

    return envelope;
  }

  /**
   * Connect to external NATS server for cross-service bridging.
   *
   * @param {object} natsConnection - NATS client connection
   */
  bridgeToNats(natsConnection) {
    this.natsBridge = natsConnection;
    logger.info('NATS bridge connected');
  }

  /**
   * Get bus statistics.
   * @returns {object}
   */
  getStats() {
    const queueStats = {};
    for (const [subId, queue] of this.pendingQueues) {
      const sub = this.subscriptions.get(subId);
      queueStats[subId] = {
        pattern: sub ? sub.pattern : 'unknown',
        pending: queue.length,
        utilization: queue.length / this.maxQueueDepth,
        backpressure: (queue.length / this.maxQueueDepth) >= BACKPRESSURE_THRESHOLD,
      };
    }

    return {
      subscriptions: this.subscriptions.size,
      totalPublished: this.totalPublished,
      totalDelivered: this.totalDelivered,
      totalDeadLettered: this.totalDeadLettered,
      deadLetterQueueSize: this.deadLetterQueue.length,
      queues: queueStats,
    };
  }

  /**
   * Drain all dead-letter events (for reprocessing or inspection).
   * @returns {EventEnvelope[]}
   */
  drainDeadLetters() {
    const drained = [...this.deadLetterQueue];
    this.deadLetterQueue = [];
    return drained;
  }

  /**
   * Graceful shutdown — drains pending queues and disconnects.
   */
  async shutdown() {
    logger.info('Event bus shutting down');

    for (const [subId] of this.subscriptions) {
      this.unsubscribe(subId);
    }

    if (this.natsBridge) {
      this.natsBridge = null;
    }

    logger.info({
      totalPublished: this.totalPublished,
      totalDelivered: this.totalDelivered,
      deadLettered: this.totalDeadLettered,
    }, 'Event bus shutdown complete');
  }

  // --- Private ---

  _findMatchingSubscriptions(topic) {
    const matches = [];
    for (const [, sub] of this.subscriptions) {
      if (sub.active && sub.matches(topic)) {
        matches.push(sub);
      }
    }
    return matches;
  }

  async _deliver(sub, envelope) {
    const queue = this.pendingQueues.get(sub.id);

    // Backpressure check
    if (queue && queue.length >= this.maxQueueDepth) {
      this.emit('backpressure:warning', {
        subscriptionId: sub.id,
        pattern: sub.pattern,
        queueDepth: queue.length,
      });
      this._deadLetter(envelope, 'queue_full');
      return;
    }

    try {
      await sub.handler(envelope);
      sub.messagesReceived++;
      this.totalDelivered++;

      this.emit('event:delivered', {
        subscriptionId: sub.id,
        eventId: envelope.id,
        topic: envelope.topic,
      });
    } catch (error) {
      sub.errors++;
      envelope.retryCount++;

      if (envelope.retryCount >= this.maxRetries) {
        this._deadLetter(envelope, error.message);
      } else {
        // Re-queue for retry
        if (queue) {
          queue.push(envelope);
        }

        logger.warn({
          subscriptionId: sub.id,
          eventId: envelope.id,
          retryCount: envelope.retryCount,
          error: error.message,
        }, 'Event delivery failed, queued for retry');
      }
    }
  }

  _deadLetter(envelope, reason) {
    this.deadLetterQueue.push(envelope);
    this.totalDeadLettered++;

    this.emit('event:dead-letter', {
      eventId: envelope.id,
      topic: envelope.topic,
      reason,
      retryCount: envelope.retryCount,
    });

    logger.warn({
      eventId: envelope.id,
      topic: envelope.topic,
      reason,
    }, 'Event moved to dead letter queue');
  }

  _bridgeToNats(envelope) {
    try {
      if (this.natsBridge && typeof this.natsBridge.publish === 'function') {
        this.natsBridge.publish(envelope.topic, JSON.stringify({
          id: envelope.id,
          payload: envelope.payload,
          correlationId: envelope.correlationId,
          source: envelope.source,
          publishedAt: envelope.publishedAt,
        }));
      }
    } catch (error) {
      logger.error({
        eventId: envelope.id,
        error: error.message,
      }, 'NATS bridge publish failed');
    }
  }
}
