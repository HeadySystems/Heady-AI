/**
 * HERALD Agent — Trigger & Event Dispatch Bee
 * P1 Priority | Warm Pool
 * Mission: Trigger registration, webhook dispatch, event bus integration
 */
'use strict';
const logger = require('../utils/logger') || console;

const PHI = 1.618033988749895;
const crypto = require('crypto');

class HeraldAgent {
  constructor(opts = {}) {
    this.name = 'HERALD';
    this.type = 'bee';
    this.pool = 'warm';
    this.version = '1.0.0';
    this.triggers = new Map();
    this.webhooks = new Map();
    this.eventLog = [];
    this.webhookSecret = opts.webhookSecret || crypto.randomBytes(32).toString('hex');
  }

  async start() {
    logger.info('[HERALD] Event dispatch agent active');
    return { status: 'active', agent: this.name };
  }

  async stop() { logger.info('[HERALD] Shutdown complete'); }

  /** Register a trigger */
  registerTrigger(triggerDef) {
    const triggerId = `trg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const trigger = {
      id: triggerId,
      event: triggerDef.event,
      conditions: triggerDef.conditions || {},
      action: triggerDef.action,
      webhookUrl: triggerDef.webhookUrl || null,
      createdAt: Date.now(),
      fireCount: 0,
      lastFired: null,
      enabled: true
    };
    this.triggers.set(triggerId, trigger);
    return trigger;
  }

  /** Fire an event — match triggers and dispatch */
  async fireEvent(event) {
    const entry = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: event.type,
      source: event.source || 'system',
      data: event.data || {},
      timestamp: Date.now(),
      dispatched: []
    };

    // Match triggers
    for (const [id, trigger] of this.triggers) {
      if (!trigger.enabled) continue;
      if (trigger.event !== event.type && trigger.event !== '*') continue;

      // Check conditions
      if (trigger.conditions && Object.keys(trigger.conditions).length > 0) {
        const match = Object.entries(trigger.conditions).every(([key, val]) =>
          event.data?.[key] === val
        );
        if (!match) continue;
      }

      trigger.fireCount++;
      trigger.lastFired = Date.now();

      // Dispatch webhook if configured
      if (trigger.webhookUrl) {
        await this._dispatchWebhook(trigger.webhookUrl, entry);
      }

      entry.dispatched.push({ triggerId: id, action: trigger.action });
    }

    this.eventLog.push(entry);
    if (this.eventLog.length > 10000) this.eventLog = this.eventLog.slice(-6180); // φ-scaled trim
    return entry;
  }

  /** Register a webhook endpoint */
  registerWebhook(url, events = ['*']) {
    const webhookId = `wh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const webhook = {
      id: webhookId,
      url,
      events,
      secret: crypto.randomBytes(16).toString('hex'),
      createdAt: Date.now(),
      deliveries: 0,
      lastDelivery: null,
      status: 'active'
    };
    this.webhooks.set(webhookId, webhook);
    return webhook;
  }

  /** Sign and dispatch webhook payload */
  async _dispatchWebhook(url, payload) {
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', this.webhookSecret)
      .update(body).digest('hex');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Heady-Signature': `sha256=${signature}`,
          'X-Heady-Event': payload.type,
          'X-Heady-Delivery': payload.id
        },
        body,
        signal: AbortSignal.timeout(Math.round(5000 * PHI))
      });
      return { success: response.ok, status: response.status };
    } catch (err) {
      console.error(`[HERALD] Webhook dispatch failed: ${url} — ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  health() {
    return {
      agent: this.name, status: 'healthy',
      triggers: this.triggers.size,
      webhooks: this.webhooks.size,
      totalEvents: this.eventLog.length,
      uptime: process.uptime()
    };
  }
}

module.exports = { HeraldAgent };
