/**
 * Event Bus Service — Maps orchestrated event bus to Latent Service lifecycle
 * @module services/event-bus
 */
'use strict';
const { createLogger } = require('../utils/logger');
const logger = createLogger('event-bus');

class EventBusService {
  constructor() {
    this.name = 'event-bus';
    this.status = 'dormant';
    // Dynamically require the underlying singleton pub/sub or event-emitter
    this.bus = null;
  }

  async start() {
    if (this.status === 'active') return this;
    try {
      this.bus = require('../orchestration/heady-event-bus');
      this.status = 'active';
      logger.info({}, 'Event Bus Service started');
    } catch (err) {
      logger.error({ err }, 'Failed to start Event Bus Service');
    }
    return this;
  }

  async stop() {
    this.status = 'dormant';
    logger.info({}, 'Event Bus Service stopped');
  }

  health() {
    return { status: this.status, connected: !!this.bus };
  }

  publish(topic, payload) {
    if (this.status !== 'active' || !this.bus) return false;
    return this.bus.emit ? this.bus.emit(topic, payload) : false;
  }

  subscribe(topic, handler) {
    if (this.status !== 'active' || !this.bus) return false;
    return this.bus.on ? this.bus.on(topic, handler) : false;
  }
}

module.exports = new EventBusService();


// --- Auto-Unified Latent Service Pattern ---
if (module.exports && typeof module.exports === 'object') {
  if (!module.exports.start) module.exports.start = async () => ({ status: 'started' });
  if (!module.exports.stop) module.exports.stop = async () => ({ status: 'stopped' });
  if (!module.exports.health) module.exports.health = () => ({ status: 'healthy' });
  if (!module.exports.metrics) module.exports.metrics = () => ({ usages: 0 });
  if (!module.exports._tick) module.exports._tick = async () => {};
}
// -------------------------------------------
