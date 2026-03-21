/**
 * Notification Service — Multi-channel alerting 
 * @module services/notification
 */
'use strict';
const { createLogger } = require('../utils/logger');
const logger = createLogger('notification');

class NotificationService {
  constructor() {
    this.name = 'notification';
    this.status = 'dormant';
    this.queue = [];
    this.channels = {
      email: this._sendEmail.bind(this),
      websocket: this._sendWebSocket.bind(this),
      push: this._sendPush.bind(this)
    };
  }

  async start() {
    this.status = 'active';
    this._processQueueInterval = setInterval(() => this._processQueue(), typeof phiMs === 'function' ? phiMs(5000) : 5000);
    logger.info({}, 'Notification Service Started');
  }

  async stop() {
    this.status = 'dormant';
    if (this._processQueueInterval) clearInterval(this._processQueueInterval);
    logger.info({}, 'Notification Service Stopped');
  }

  health() {
    return { status: this.status, queued: this.queue.length };
  }

  /**
   * Queue a notification for dispatch
   * @param {Object} event - Event details
   * @param {String} event.channel - 'email', 'websocket', 'push'
   * @param {Object} event.payload - Notification payload
   * @param {String} event.recipient - Recipient identifier
   */
  async dispatch(event) {
    if (!event.channel || !this.channels[event.channel]) {
      logger.warn({ channel: event.channel }, 'Unsupported notification channel requested');
      return false;
    }
    
    this.queue.push({
      ...event,
      timestamp: Date.now()
    });
    logger.debug({ eventId: event.id || 'anonymous' }, 'Notification queued for dispatch');
    return true;
  }

  async _processQueue() {
    if (this.status !== 'active' || this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, 50); // Process up to 50 at a time
    for (const item of batch) {
      try {
        await this.channels[item.channel](item.recipient, item.payload);
        logger.info({ channel: item.channel, recipient: item.recipient }, 'Notification dispatched successfully');
      } catch (err) {
        logger.error({ err, item }, 'Failed to dispatch notification, re-queuing');
        this.queue.push(item); // Re-queue on failure
      }
    }
  }

  async _sendEmail(recipient, payload) {
    // Integrate with Sendgrid/Resend here
    logger.info({ recipient, subject: payload.subject }, 'Sending EMAIL');
    return Promise.resolve(true);
  }

  async _sendWebSocket(recipient, payload) {
    // Integrate with Socket.io/WS here
    logger.info({ recipient, event: payload.event }, 'Sending WEBSOCKET event');
    return Promise.resolve(true);
  }

  async _sendPush(recipient, payload) {
    // Integrate with APNS/FCM here
    logger.info({ recipient, title: payload.title }, 'Sending PUSH notification');
    return Promise.resolve(true);
  }
}

module.exports = { NotificationService, notification: new NotificationService() };


// --- Auto-Unified Latent Service Pattern (Smart) ---
(function _wireLatentStubs() {
  const exp = module.exports;
  if (!exp || typeof exp !== 'object') return;

  // Find the first exported class instance or constructor with health/start/stop
  let _inst = null;
  for (const key of Object.keys(exp)) {
    const val = exp[key];
    // If it's a singleton instance with a health method, use it
    if (val && typeof val === 'object' && typeof val.health === 'function') {
      _inst = val; break;
    }
    // If it's a function (class constructor), try to find a getSingleton pattern
    if (typeof val === 'function' && val.prototype) {
      const getterKey = Object.keys(exp).find(k =>
        k.startsWith('get') && typeof exp[k] === 'function' && k !== key
      );
      if (getterKey) {
        try { const inst = exp[getterKey](); if (inst && typeof inst.health === 'function') { _inst = inst; break; } } catch(e) {}
      }
    }
  }

  if (!exp.start) exp.start = _inst && typeof _inst.start === 'function'
    ? async () => { await _inst.start(); return { status: 'started' }; }
    : async () => ({ status: 'started' });
  if (!exp.stop) exp.stop = _inst && typeof _inst.stop === 'function'
    ? async () => { await _inst.stop(); return { status: 'stopped' }; }
    : async () => ({ status: 'stopped' });
  if (!exp.health) exp.health = _inst && typeof _inst.health === 'function'
    ? () => _inst.health()
    : () => ({ status: 'healthy', service: require('path').basename(__filename, '.js') });
  if (!exp.metrics) exp.metrics = _inst && typeof _inst.metrics === 'function'
    ? () => _inst.metrics()
    : () => ({ service: require('path').basename(__filename, '.js') });
  if (!exp._tick) exp._tick = async () => {};
})();
// -------------------------------------------
