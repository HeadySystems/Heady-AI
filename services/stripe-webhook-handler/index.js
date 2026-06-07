// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: services/stripe-webhook-handler/index.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// © 2026 HeadySystems Inc. — Eric Haywood, Founder — 60+ Provisional Patents
'use strict';

const { Router } = require('express');
const {
  PHI, PSI, phiBackoff, CSL_THRESHOLDS,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/structured-logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * @module stripe-webhook-handler
 * @version 1.0.0
 * @description Stripe webhook handler for subscription lifecycle events.
 * Verifies signatures, routes events, applies phi-tiered rate limiting,
 * and maps products/prices from the billing registry.
 */

const SERVICE_NAME = 'stripe-webhook-handler';
const logger = createLogger(SERVICE_NAME, { domain: 'billing' });

/** Load billing registry */
const billingRegistryPath = path.resolve(__dirname, '../../configs/stripe-billing-registry.json');
const BILLING_REGISTRY = JSON.parse(fs.readFileSync(billingRegistryPath, 'utf8'));

/** Supported webhook event types */
const HANDLED_EVENTS = Object.freeze([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
]);

/** Phi-tiered rate limits per subscription tier (requests per minute) */
const RATE_LIMITS = Object.freeze({
  developer:  Math.round(60 * PSI),           // ~37 rpm
  team:       Math.round(60 * PHI),            // ~97 rpm
  enterprise: Math.round(60 * PHI * PHI),      // ~157 rpm
});

/** In-memory rate limit tracker */
const rateBuckets = new Map();
const eventLog = [];
const MAX_EVENT_LOG = 144; // fib(12)
let startTime = Date.now();

/**
 * Verify a Stripe webhook signature.
 * @param {Buffer} payload Raw request body
 * @param {string} sigHeader Stripe-Signature header value
 * @param {string} secret Webhook signing secret
 * @returns {{ valid: boolean, timestamp: number|null }}
 */
function verifyWebhookSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return { valid: false, timestamp: null };

  const elements = sigHeader.split(',');
  const tsElement = elements.find(e => e.startsWith('t='));
  const sigElement = elements.find(e => e.startsWith('v1='));

  if (!tsElement || !sigElement) return { valid: false, timestamp: null };

  const timestamp = parseInt(tsElement.slice(2), 10);
  const signature = sigElement.slice(3);

  /** Reject events older than 5 minutes (300s) */
  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    return { valid: false, timestamp };
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const valid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );

  return { valid, timestamp };
}

/**
 * Check phi-tiered rate limit for a customer tier.
 * @param {string} customerId
 * @param {string} tier
 * @returns {{ allowed: boolean, remaining: number, limit: number }}
 */
function checkRateLimit(customerId, tier) {
  const limit = RATE_LIMITS[tier] || RATE_LIMITS.developer;
  const key = `${customerId}:${Math.floor(Date.now() / 60000)}`;
  const current = rateBuckets.get(key) || 0;

  if (current >= limit) {
    return { allowed: false, remaining: 0, limit };
  }

  rateBuckets.set(key, current + 1);
  /** Evict stale buckets */
  if (rateBuckets.size > 1000) {
    const cutoff = `${Math.floor(Date.now() / 60000) - 2}`;
    for (const [k] of rateBuckets) {
      if (k.split(':')[1] < cutoff) rateBuckets.delete(k);
    }
  }

  return { allowed: true, remaining: limit - current - 1, limit };
}

/**
 * Resolve product tier from a Stripe price ID.
 * @param {string} priceId
 * @returns {string} Tier name or 'unknown'
 */
function resolveTier(priceId) {
  for (const [tierName, product] of Object.entries(BILLING_REGISTRY.products || {})) {
    for (const [, price] of Object.entries(product.prices || {})) {
      if (price.price_id === priceId) return tierName;
    }
  }
  return 'unknown';
}

/**
 * Create the Stripe webhook Express router.
 * @param {Object} [opts]
 * @param {string} [opts.webhookSecret] Stripe webhook signing secret (from env)
 * @returns {import('express').Router}
 */
function createStripeWebhookRouter(opts = {}) {
  const router = Router();
  const webhookSecret = opts.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';
  startTime = Date.now();

  /** Health endpoint */
  router.get('/health', (_req, res) => {
    res.json(health());
  });

  /** Main webhook endpoint — expects raw body */
  router.post('/webhook', (req, res) => {
    const correlationId = req.headers['x-heady-correlation-id']
      || `stripe-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const sigHeader = req.headers['stripe-signature'] || '';
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    /** Signature verification */
    if (webhookSecret) {
      const verification = verifyWebhookSignature(rawBody, sigHeader, webhookSecret);
      if (!verification.valid) {
        logger.warn('webhook_sig_invalid', { correlationId });
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventType = event.type;

    if (!HANDLED_EVENTS.includes(eventType)) {
      logger.info('webhook_ignored', { correlationId, eventType });
      return res.json({ received: true, handled: false });
    }

    /** Rate limit check */
    const customerId = event.data?.object?.customer || 'unknown';
    const priceId = event.data?.object?.items?.data?.[0]?.price?.id
      || event.data?.object?.lines?.data?.[0]?.price?.id || '';
    const tier = resolveTier(priceId);
    const rateCheck = checkRateLimit(customerId, tier);

    if (!rateCheck.allowed) {
      logger.warn('webhook_rate_limited', { correlationId, customerId, tier });
      return res.status(429).json({ error: 'Rate limited', retryAfterMs: Math.round(60000 * PSI) });
    }

    /** Process the event */
    const entry = {
      correlationId,
      eventType,
      eventId: event.id,
      customerId,
      tier,
      timestamp: new Date().toISOString(),
    };

    if (eventLog.length >= MAX_EVENT_LOG) eventLog.shift();
    eventLog.push(entry);

    logger.info('webhook_processed', entry);
    res.json({ received: true, handled: true, correlationId, tier });
  });

  return router;
}

/**
 * Health check.
 * @returns {Object}
 */
function health() {
  return {
    service: SERVICE_NAME,
    status: 'HEALTHY',
    uptime: Date.now() - startTime,
    eventsProcessed: eventLog.length,
    handledEventTypes: HANDLED_EVENTS,
    rateLimits: RATE_LIMITS,
    billingTiers: Object.keys(BILLING_REGISTRY.products || {}),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Graceful shutdown.
 */
function shutdown() {
  logger.info('shutdown', { service: SERVICE_NAME, eventsProcessed: eventLog.length });
  rateBuckets.clear();
  eventLog.length = 0;
}

module.exports = {
  createStripeWebhookRouter,
  verifyWebhookSignature,
  resolveTier,
  checkRateLimit,
  health,
  shutdown,
  HANDLED_EVENTS,
  RATE_LIMITS,
};
