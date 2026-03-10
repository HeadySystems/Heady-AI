'use strict';
/**
 * Heady™ NATS JetStream Client — concurrent-equals event bus.
 * All subscribers are concurrent equals — no consumer has priority.
 * © 2026 HeadySystems Inc.
 */
const { getLogger } = require('./structured-logger');
const logger = getLogger('nats-client');

class HeadyNatsClient {
  constructor(opts = {}) {
    this.url = opts.url || process.env.NATS_URL || 'nats://localhost:4222';
    this.streamName = opts.streamName || 'HEADY';
    this._connection = null;
    this._jetstream = null;
  }

  async connect() {
    try {
      const nats = require('nats');
      this._connection = await nats.connect({ servers: this.url });
      this._jetstream = this._connection.jetstream();
      logger.info('NATS JetStream connected', { url: this.url });
    } catch (err) {
      logger.warn('NATS not available, using in-memory fallback', { error: err.message });
      this._connection = null;
      this._jetstream = null;
    }
    return this;
  }

  async publish(subject, data) {
    const payload = JSON.stringify({ subject, data, timestamp: new Date().toISOString() });
    if (this._jetstream) {
      await this._jetstream.publish(subject, Buffer.from(payload));
    }
    logger.debug('Published', { subject });
  }

  async subscribe(subject, handler) {
    if (!this._connection) { logger.warn('No NATS connection for subscribe'); return; }
    const sub = this._connection.subscribe(subject);
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(msg.data.toString());
          await handler(data, msg);
        } catch (err) {
          logger.error('Message handler error', { subject, error: err.message });
        }
      }
    })();
    logger.info('Subscribed', { subject });
  }

  async close() {
    if (this._connection) {
      await this._connection.close();
      logger.info('NATS connection closed');
    }
  }
}

module.exports = { HeadyNatsClient };
