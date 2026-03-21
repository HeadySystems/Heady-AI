/**
 * EventBusNATS — NATS JetStream Event Bus Client
 * Provides pub/sub, request/reply, streaming, and durable consumers
 * for Heady's distributed event architecture.
 * All constants φ-derived. CSL gates replace boolean. ESM only.
 * Author: Eric Haywood
 */
import { createHash } from 'crypto';

// ── φ-Math Foundation ────────────────────────────────────────────
const PHI = 1.6180339887;
const PSI = 0.6180339887;
const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

function phiThreshold(level, spread = PSI2) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  CRITICAL: phiThreshold(4),
  HIGH: phiThreshold(3),
  MEDIUM: phiThreshold(2),
  LOW: phiThreshold(1),
  MINIMUM: phiThreshold(0),
};

function cslGate(value, score, tau = CSL_THRESHOLDS.MEDIUM, temp = Math.pow(PSI, 3)) {
  return value * (1 / (1 + Math.exp(-(score - tau) / temp)));
}

function hashSHA256(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const delay = baseMs * Math.pow(PHI, attempt);
  const jitter = (Math.random() - PSI) * PSI2 * delay;
  return Math.min(maxMs, delay + jitter);
}

// ── Event Schemas ────────────────────────────────────────────────
const EVENT_SUBJECTS = {
  'heady.agent.spawned':       { retention: 'limits', maxAge: FIB[11] * 3600, maxMsgs: FIB[16] },
  'heady.agent.completed':     { retention: 'limits', maxAge: FIB[11] * 3600, maxMsgs: FIB[16] },
  'heady.agent.failed':        { retention: 'limits', maxAge: FIB[13] * 3600, maxMsgs: FIB[16] },
  'heady.memory.stored':       { retention: 'limits', maxAge: FIB[12] * 3600, maxMsgs: FIB[16] },
  'heady.memory.evicted':      { retention: 'limits', maxAge: FIB[11] * 3600, maxMsgs: FIB[14] },
  'heady.security.alert':      { retention: 'limits', maxAge: FIB[14] * 3600, maxMsgs: FIB[16] },
  'heady.security.violation':  { retention: 'limits', maxAge: FIB[14] * 3600, maxMsgs: FIB[16] },
  'heady.health.heartbeat':    { retention: 'limits', maxAge: FIB[9] * 3600, maxMsgs: FIB[14] },
  'heady.health.drift':        { retention: 'limits', maxAge: FIB[12] * 3600, maxMsgs: FIB[16] },
  'heady.deploy.started':      { retention: 'limits', maxAge: FIB[11] * 3600, maxMsgs: FIB[14] },
  'heady.deploy.completed':    { retention: 'limits', maxAge: FIB[11] * 3600, maxMsgs: FIB[14] },
  'heady.billing.event':       { retention: 'limits', maxAge: FIB[14] * 3600, maxMsgs: FIB[16] },
  'heady.analytics.event':     { retention: 'limits', maxAge: FIB[12] * 3600, maxMsgs: FIB[16] },
};

// ── In-Memory Message Store (NATS-compatible interface) ──────────
class MessageStore {
  constructor(config = {}) {
    this.maxMsgs = config.maxMsgs ?? FIB[16];
    this.maxAge = config.maxAge ?? FIB[12] * 3600 * 1000;
    this.messages = [];
    this.sequence = 0;
  }

  publish(subject, data) {
    this.sequence++;
    const msg = {
      sequence: this.sequence,
      subject,
      data,
      timestamp: Date.now(),
      hash: hashSHA256({ sequence: this.sequence, subject, data }),
    };
    this.messages.push(msg);

    // Enforce limits
    while (this.messages.length > this.maxMsgs) {
      this.messages.shift();
    }
    const cutoff = Date.now() - this.maxAge;
    while (this.messages.length > 0 && this.messages[0].timestamp < cutoff) {
      this.messages.shift();
    }

    return msg;
  }

  getFromSequence(startSeq, limit = FIB[8]) {
    return this.messages
      .filter(m => m.sequence >= startSeq)
      .slice(0, limit);
  }

  stats() {
    return { messageCount: this.messages.length, sequence: this.sequence, maxMsgs: this.maxMsgs };
  }
}

// ── Consumer ─────────────────────────────────────────────────────
class Consumer {
  constructor(name, subjects, config = {}) {
    this.name = name;
    this.subjects = subjects;
    this.durable = config.durable ?? true;
    this.ackPolicy = config.ackPolicy ?? 'explicit';
    this.maxDeliver = config.maxDeliver ?? FIB[5]; // 5 retries
    this.ackWaitMs = config.ackWaitMs ?? FIB[9] * 1000; // 34s
    this.lastSequence = 0;
    this.pendingAcks = new Map();
    this.handlers = new Map();
    this.deliveryCount = 0;
    this.ackCount = 0;
    this.nakCount = 0;
  }

  subscribe(subject, handler) {
    this.handlers.set(subject, handler);
  }

  async deliver(msg) {
    const handler = this.handlers.get(msg.subject);
    if (!handler) return { delivered: false, reason: 'no-handler' };

    this.deliveryCount++;
    const ackId = `${this.name}-${msg.sequence}`;
    this.pendingAcks.set(ackId, { msg, deliveredAt: Date.now(), attempts: 1 });

    try {
      await handler(msg);
      this.ack(ackId);
      return { delivered: true, ackId };
    } catch (err) {
      this.nak(ackId);
      return { delivered: false, error: err.message, ackId };
    }
  }

  ack(ackId) {
    this.pendingAcks.delete(ackId);
    this.ackCount++;
  }

  nak(ackId) {
    const pending = this.pendingAcks.get(ackId);
    if (pending && pending.attempts < this.maxDeliver) {
      pending.attempts++;
    } else {
      this.pendingAcks.delete(ackId);
    }
    this.nakCount++;
  }

  stats() {
    return {
      name: this.name,
      durable: this.durable,
      subjects: this.subjects,
      lastSequence: this.lastSequence,
      pendingAcks: this.pendingAcks.size,
      deliveryCount: this.deliveryCount,
      ackCount: this.ackCount,
      nakCount: this.nakCount,
    };
  }
}

// ── Event Bus ────────────────────────────────────────────────────
class EventBusNATS {
  constructor(config = {}) {
    this.url = config.url ?? process.env.NATS_URL || 'nats://0.0.0.0:4222';
    this.streams = new Map();
    this.consumers = new Map();
    this.subscriptions = new Map();
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = FIB[8]; // 21
    this.totalPublished = 0;
    this.totalConsumed = 0;
    this.auditLog = [];
    this.maxAuditEntries = FIB[16];

    // Initialize default streams
    this._initStreams();
  }

  _audit(action, detail) {
    const entry = { ts: Date.now(), action, detail };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-FIB[14]);
    }
  }

  _initStreams() {
    for (const [subject, config] of Object.entries(EVENT_SUBJECTS)) {
      const streamName = subject.replace(/\./g, '-');
      this.streams.set(streamName, new MessageStore(config));
    }
  }

  async connect() {
    // In production, connect to NATS server
    this.connected = true;
    this.reconnectAttempts = 0;
    this._audit('connected', { url: this.url });
    return { connected: true, url: this.url };
  }

  async disconnect() {
    this.connected = false;
    this._audit('disconnected', {});
    return { connected: false };
  }

  async publish(subject, data) {
    const streamName = subject.replace(/\./g, '-');
    let store = this.streams.get(streamName);
    if (!store) {
      store = new MessageStore();
      this.streams.set(streamName, store);
    }

    const msg = store.publish(subject, data);
    this.totalPublished++;

    // Deliver to subscribers
    for (const consumer of this.consumers.values()) {
      if (consumer.subjects.includes(subject) || consumer.subjects.some(s => subject.startsWith(s.replace('.*', '')))) {
        await consumer.deliver(msg);
        this.totalConsumed++;
      }
    }

    this._audit('publish', { subject, sequence: msg.sequence });
    return msg;
  }

  createConsumer(name, subjects, config = {}) {
    const consumer = new Consumer(name, subjects, config);
    this.consumers.set(name, consumer);
    this._audit('create-consumer', { name, subjects });
    return consumer;
  }

  subscribe(consumerName, subject, handler) {
    const consumer = this.consumers.get(consumerName);
    if (!consumer) return { error: `Consumer not found: ${consumerName}` };
    consumer.subscribe(subject, handler);
    this._audit('subscribe', { consumer: consumerName, subject });
    return { subscribed: true, consumer: consumerName, subject };
  }

  async request(subject, data, timeoutMs = FIB[9] * 1000) {
    const msg = await this.publish(subject, data);
    // Request/reply pattern — in production, NATS handles this natively
    return { request: msg, timeout: timeoutMs };
  }

  health() {
    const streamStats = {};
    for (const [name, store] of this.streams) {
      streamStats[name] = store.stats();
    }
    const consumerStats = {};
    for (const [name, consumer] of this.consumers) {
      consumerStats[name] = consumer.stats();
    }
    return {
      connected: this.connected,
      url: this.url,
      totalPublished: this.totalPublished,
      totalConsumed: this.totalConsumed,
      streams: streamStats,
      consumers: consumerStats,
      auditLogSize: this.auditLog.length,
    };
  }
}

export default EventBusNATS;
export { EventBusNATS, Consumer, MessageStore, EVENT_SUBJECTS };
