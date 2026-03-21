/**
 * Event Bus Service
 * Implements the Latent Service Pattern
 */
'use strict';
const { createLogger } = require('../utils/logger');
const { phiMs } = require('../shared/phi-math');
const logger = createLogger('event-bus');

class EventBusService {
  constructor() {
    this.name = 'event-bus';
    this.status = 'dormant';
    this._metrics = { eventsPublished: 0, subscriptions: 0 };
    this._interval = null;
    this.subscribers = new Map();
  }

  async start() {
    if (this.status === 'active') return this;
    this.status = 'active';
    this._interval = setInterval(() => this._tick(), phiMs(1000));
    if (this._interval.unref) this._interval.unref();
    logger.info({}, 'Event Bus service started');
    return this;
  }

  async stop() {
    this.status = 'dormant';
    if (this._interval) clearInterval(this._interval);
    logger.info({}, 'Event Bus service stopped');
  }

  health() {
    return { name: this.name, status: this.status, metrics: this._metrics };
  }

  metrics() {
    return { ...this._metrics };
  }

  async _tick() {
    // Background event cleanup
  }
  
  publish(topic, event) {
    if (this.status !== 'active') {
      logger.warn('EventBus is dormant, dropping event');
      return;
    }
    this._metrics.eventsPublished++;
    const handlers = this.subscribers.get(topic) || [];
    for (const handler of handlers) {
      try { handler(event); } catch (e) { logger.error({ error: e.message }, 'Handler failed'); }
    }
  }

  subscribe(topic, handler) {
    if (!this.subscribers.has(topic)) this.subscribers.set(topic, []);
    this.subscribers.get(topic).push(handler);
    this._metrics.subscriptions++;
  }
}

module.exports = new EventBusService();
