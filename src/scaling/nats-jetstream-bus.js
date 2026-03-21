'use strict';

// ─── φ-Math Constants ─────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const MAX_RETRIES = Math.round(PHI * PHI * PHI); // φ³ ≈ 4
const ACK_WAIT_MS = FIB[7] * 1000; // 21s
const MAX_PENDING = FIB[8]; // 34
const BACKOFF_BASE_MS = 1000;

// ─── Domain Subjects ─────────────────────────────────────────────────────────

const DOMAINS = Object.freeze({
  MEMORY: 'heady.memory',
  INFERENCE: 'heady.inference',
  AGENTS: 'heady.agents',
  ORCHESTRATION: 'heady.orchestration',
  SECURITY: 'heady.security',
  MONITORING: 'heady.monitoring',
  AUTH: 'heady.auth',
  WEB: 'heady.web',
  DATA: 'heady.data',
  INTEGRATION: 'heady.integration'
});
const SUBJECTS = Object.freeze({
  // Memory domain
  'memory.embed.request': `${DOMAINS.MEMORY}.embed.request`,
  'memory.embed.complete': `${DOMAINS.MEMORY}.embed.complete`,
  'memory.vector.index': `${DOMAINS.MEMORY}.vector.index`,
  'memory.vector.query': `${DOMAINS.MEMORY}.vector.query`,
  'memory.projection.sync': `${DOMAINS.MEMORY}.projection.sync`,
  // Inference domain
  'inference.request': `${DOMAINS.INFERENCE}.request`,
  'inference.complete': `${DOMAINS.INFERENCE}.complete`,
  'inference.model.route': `${DOMAINS.INFERENCE}.model.route`,
  // Agent domain
  'agents.spawn': `${DOMAINS.AGENTS}.spawn`,
  'agents.complete': `${DOMAINS.AGENTS}.complete`,
  'agents.health': `${DOMAINS.AGENTS}.health`,
  'agents.swarm.coordinate': `${DOMAINS.AGENTS}.swarm.coordinate`,
  // Auth domain
  'auth.login': `${DOMAINS.AUTH}.login`,
  'auth.logout': `${DOMAINS.AUTH}.logout`,
  'auth.session.created': `${DOMAINS.AUTH}.session.created`,
  'auth.session.revoked': `${DOMAINS.AUTH}.session.revoked`,
  // Monitoring domain
  'monitoring.health': `${DOMAINS.MONITORING}.health`,
  'monitoring.alert': `${DOMAINS.MONITORING}.alert`,
  'monitoring.metrics': `${DOMAINS.MONITORING}.metrics`
});

// ─── Event Bus ───────────────────────────────────────────────────────────────

class NATSJetStreamBus {
  /**
   * @param {object} [opts]
   * @param {string} [opts.url]        - NATS server URL
   * @param {string} [opts.streamName] - JetStream stream name
   * @param {object} [opts.nats]       - Pre-connected NATS client
   */
  constructor(opts = {}) {
    this._url = opts.url || process.env.NATS_URL || "nats://0.0.0.0:4222";
    this._streamName = opts.streamName || 'HEADY';
    this._nc = opts.nats || null;
    this._js = null;
    this._subscribers = new Map();
    this._connected = false;
    this._metrics = {
      published: 0,
      consumed: 0,
      dlq: 0,
      errors: 0
    };
  }

  /**
   * Connect to NATS and initialize JetStream.
   */
  async connect() {
    if (this._connected) return;
    try {
      // Import NATS client dynamically (production dependency)
      const nats = await _importNATS();
      if (!this._nc) {
        this._nc = await nats.connect({
          servers: this._url,
          reconnect: true,
          maxReconnectAttempts: FIB[10],
          // 89
          reconnectTimeWait: BACKOFF_BASE_MS,
          name: 'heady-event-bus'
        });
      }
      this._js = this._nc.jetstream();

      // Ensure stream exists
      const jsm = await this._nc.jetstreamManager();
      try {
        await jsm.streams.info(this._streamName);
      } catch {
        await jsm.streams.add({
          name: this._streamName,
          subjects: ['heady.>'],
          retention: 'limits',
          max_msgs: FIB[15] * 1000,
          // 987,000
          max_bytes: FIB[13] * 1024 * 1024,
          // 377 MB
          max_age: FIB[10] * 3600 * 1e9,
          // 89 hours in nanoseconds
          storage: 'file',
          num_replicas: 1,
          discard: 'old'
        });
      }
      this._connected = true;
      _log('info', 'Connected to NATS JetStream', {
        url: this._url,
        stream: this._streamName
      });
    } catch (err) {
      _log('error', 'Failed to connect to NATS', {
        error: err.message,
        url: this._url
      });
      throw err;
    }
  }

  /**
   * Publish an event to a domain subject.
   *
   * @param {string} subject  - Subject key from SUBJECTS or raw subject
   * @param {*} data          - Event payload (will be JSON-serialized)
   * @param {object} [headers] - Optional NATS headers
   * @returns {{ seq: number, stream: string }}
   */
  async publish(subject, data, headers = {}) {
    if (!this._connected) await this.connect();
    const resolvedSubject = SUBJECTS[subject] || subject;
    const payload = _encodeJSON({
      id: _eventId(),
      subject: resolvedSubject,
      data,
      timestamp: new Date().toISOString(),
      source: headers.source || 'heady-bus'
    });
    const nats = await _importNATS();
    const msgHeaders = nats.headers();
    for (const [k, v] of Object.entries(headers)) {
      msgHeaders.append(k, String(v));
    }
    const ack = await this._js.publish(resolvedSubject, payload, {
      headers: msgHeaders
    });
    this._metrics.published++;
    return {
      seq: ack.seq,
      stream: ack.stream
    };
  }
  async subscribe(subject, consumerName, handler, opts = {}) {
    if (!this._connected) await this.connect();
    const resolvedSubject = SUBJECTS[subject] || subject;
    const {
      maxRetries = MAX_RETRIES,
      ackWaitMs = ACK_WAIT_MS,
      maxPending = MAX_PENDING,
      dlqSubject = `${resolvedSubject}.dlq`
    } = opts;
    const jsm = await this._nc.jetstreamManager();

    // Ensure consumer exists
    try {
      await jsm.consumers.info(this._streamName, consumerName);
    } catch {
      await jsm.consumers.add(this._streamName, {
        durable_name: consumerName,
        filter_subject: resolvedSubject,
        ack_policy: 'explicit',
        ack_wait: ackWaitMs * 1e6,
        // Convert to nanoseconds
        max_deliver: maxRetries,
        deliver_policy: 'all'
      });
    }
    const sub = await this._js.pullSubscribe(resolvedSubject, {
      durable: consumerName,
      config: {
        max_waiting: maxPending
      }
    });

    // Consumption loop
    const consume = async () => {
      while (this._connected) {
        try {
          const fetched = await sub.fetch({
            batch: FIB[5],
            expires: FIB[6] * 1000
          }); // 8 msgs, 13s timeout
          for await (const msg of fetched) {
            try {
              const parsed = _decodeJSON(msg.data);
              await handler(parsed, msg);
              msg.ack();
              this._metrics.consumed++;
            } catch (err) {
              _log('error', 'Message handler failed', {
                subject: resolvedSubject,
                consumer: consumerName,
                delivery: msg.info?.redeliveryCount,
                error: err.message
              });

              // DLQ after max retries
              if ((msg.info?.redeliveryCount || 0) >= maxRetries - 1) {
                await this._sendToDLQ(dlqSubject, msg, err);
                msg.term(); // Terminal ack — stop redelivery
              } else {
                // φ-exponential backoff before NAK
                const attempt = msg.info?.redeliveryCount || 0;
                const delayMs = Math.round(BACKOFF_BASE_MS * Math.pow(PHI, attempt));
                msg.nak(delayMs);
              }
            }
          }
        } catch (err) {
          if (this._connected) {
            this._metrics.errors++;
            await _delay(BACKOFF_BASE_MS);
          }
        }
      }
    };
    consume().catch(err => _log('error', 'Consume loop exited', {
      error: err.message
    }));
    this._subscribers.set(consumerName, sub);
    _log('info', 'Subscribed', {
      subject: resolvedSubject,
      consumer: consumerName,
      maxRetries,
      ackWaitMs
    });
  }

  /**
   * Send a failed message to the dead letter queue.
   * @private
   */
  async _sendToDLQ(dlqSubject, originalMsg, error) {
    try {
      const dlqPayload = _encodeJSON({
        id: _eventId(),
        originalSubject: originalMsg.subject,
        originalData: _decodeJSON(originalMsg.data),
        error: error.message,
        deliveryCount: originalMsg.info?.redeliveryCount,
        dlqTimestamp: new Date().toISOString()
      });
      await this._js.publish(dlqSubject, dlqPayload);
      this._metrics.dlq++;
      _log('warn', 'Message sent to DLQ', {
        dlqSubject,
        originalSubject: originalMsg.subject,
        error: error.message
      });
    } catch (dlqErr) {
      _log('error', 'Failed to send to DLQ', {
        error: dlqErr.message
      });
    }
  }

  /**
   * Get bus health and metrics.
   */
  getMetrics() {
    return {
      connected: this._connected,
      subscribers: this._subscribers.size,
      ...this._metrics
    };
  }

  /**
   * Graceful shutdown.
   */
  async close() {
    this._connected = false;
    for (const [name, sub] of this._subscribers) {
      try {
        sub.unsubscribe();
      } catch {/* ignore */}
    }
    this._subscribers.clear();
    if (this._nc) {
      await this._nc.drain();
      await this._nc.close();
    }
    _log('info', 'NATS JetStream bus closed');
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const _crypto = require('crypto');
function _eventId() {
  return _crypto.randomUUID();
}
function _encodeJSON(obj) {
  return new TextEncoder().encode(JSON.stringify(obj));
}
function _decodeJSON(uint8) {
  return JSON.parse(new TextDecoder().decode(uint8));
}
function _delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
function _log(level, msg, meta = {}) {
  process.stdout.write(JSON.stringify({
    level,
    service: 'nats-jetstream-bus',
    message: msg,
    ...meta,
    timestamp: new Date().toISOString()
  }) + '\n');
}
async function _importNATS() {
  try {
    return await import('nats');
  } catch {
    try {
      return require('nats');
    } catch {
      return {
        connect: () => {
          throw new Error('nats package not installed — run: npm install nats');
        },
        headers: () => new Map()
      };
    }
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  NATSJetStreamBus,
  DOMAINS,
  SUBJECTS,
  MAX_RETRIES,
  ACK_WAIT_MS,
  MAX_PENDING,
  BACKOFF_BASE_MS
};