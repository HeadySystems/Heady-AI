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
// ║  FILE: services/billing-service.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Billing Service — Port 3313
 * Stripe integration, subscription/usage billing, credit system
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash, randomBytes, createHmac } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, phiBackoff, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate, cslBlend, cosineSimilarity } from '../shared/csl-engine-v2.js';

// ── φ-Derived Constants ──────────────────────────────────────────
const TIER_THRESHOLDS = {
  free:       { maxCredits: fibonacci(10),  priceUsd: 0 },           // 55 credits
  starter:    { maxCredits: fibonacci(13),  priceUsd: fibonacci(7) }, // 233 credits, $13
  pro:        { maxCredits: fibonacci(16),  priceUsd: fibonacci(9) }, // 987 credits, $34
  enterprise: { maxCredits: fibonacci(20),  priceUsd: fibonacci(12) }, // 6765 credits, $144
};
const USAGE_BUCKET_SIZE      = fibonacci(8);                          // 21 units per bucket
const INVOICE_CACHE_SIZE     = fibonacci(12);                         // 144
const WEBHOOK_TOLERANCE_MS   = fibonacci(14) * 1000;                  // 377s
const CREDIT_WARN_THRESHOLD  = PSI;                                   // 61.8% usage = warning
const CREDIT_LIMIT_THRESHOLD = phiThreshold(3);                       // ≈0.882 = near limit

// ── In-Memory Stores ─────────────────────────────────────────────
const subscriptions = new Map();
const usageMeters = new Map();
const invoices = new Map();
const credits = new Map();
const webhookLog = [];
const metrics = { charges: 0, subscriptions: 0, webhooks: 0, creditsIssued: 0 };

function sha256(input) { return createHash('sha256').update(String(input)).digest('hex'); }

// ── Plan Management ──────────────────────────────────────────────
function createSubscription(userId, plan, stripeSubscriptionId) {
  const tier = TIER_THRESHOLDS[plan];
  if (!tier) return { error: 'invalid_plan' };
  const sub = {
    id: sha256(userId + plan + Date.now()),
    userId, plan,
    stripeSubscriptionId: stripeSubscriptionId || null,
    maxCredits: tier.maxCredits,
    priceUsd: tier.priceUsd,
    status: 'active',
    created: Date.now(),
    currentPeriodStart: Date.now(),
    currentPeriodEnd: Date.now() + (30 * 86400000),
    hash: sha256(userId + plan + stripeSubscriptionId),
  };
  subscriptions.set(userId, sub);
  credits.set(userId, { total: tier.maxCredits, used: 0, remaining: tier.maxCredits });
  metrics.subscriptions++;
  return sub;
}

function getSubscription(userId) {
  return subscriptions.get(userId) || null;
}

function cancelSubscription(userId) {
  const sub = subscriptions.get(userId);
  if (!sub) return { error: 'not_found' };
  sub.status = 'canceled';
  sub.canceledAt = Date.now();
  return sub;
}

// ── Usage Metering ───────────────────────────────────────────────
function recordUsage(userId, units, featureId) {
  const key = userId + ':' + (featureId || 'default');
  let meter = usageMeters.get(key);
  if (!meter) {
    meter = { userId, featureId: featureId || 'default', buckets: [], totalUnits: 0 };
    usageMeters.set(key, meter);
  }

  const currentBucket = meter.buckets[meter.buckets.length - 1];
  if (!currentBucket || currentBucket.units >= USAGE_BUCKET_SIZE) {
    meter.buckets.push({ units, timestamp: Date.now() });
  } else {
    currentBucket.units += units;
  }
  meter.totalUnits += units;

  // Deduct credits
  const userCredits = credits.get(userId);
  if (userCredits) {
    userCredits.used += units;
    userCredits.remaining = Math.max(0, userCredits.total - userCredits.used);

    const usageRatio = userCredits.used / userCredits.total;
    const warnGate = cslGate(usageRatio, usageRatio, CREDIT_WARN_THRESHOLD, PSI * PSI * PSI);
    const limitGate = cslGate(usageRatio, usageRatio, CREDIT_LIMIT_THRESHOLD, PSI * PSI * PSI);

    return {
      recorded: true,
      units,
      credits: { ...userCredits },
      warnings: {
        approachingLimit: warnGate > phiThreshold(2),
        atLimit: limitGate > phiThreshold(3),
      },
    };
  }
  return { recorded: true, units };
}

function getUsage(userId, featureId) {
  const key = userId + ':' + (featureId || 'default');
  return usageMeters.get(key) || { userId, featureId, buckets: [], totalUnits: 0 };
}

// ── Invoice Generation ───────────────────────────────────────────
function generateInvoice(userId) {
  const sub = subscriptions.get(userId);
  if (!sub) return { error: 'no_subscription' };

  const userMeters = [...usageMeters.entries()]
    .filter(([k]) => k.startsWith(userId + ':'))
    .map(([, v]) => v);

  const lineItems = [
    {
      description: sub.plan + ' subscription',
      amount: sub.priceUsd * 100,
      currency: 'usd',
    },
  ];

  for (const meter of userMeters) {
    const overageUnits = Math.max(0, meter.totalUnits - (sub.maxCredits || 0));
    if (overageUnits > 0) {
      const overageRate = PSI2 * 100;
      lineItems.push({
        description: 'Overage: ' + meter.featureId + ' (' + overageUnits + ' units)',
        amount: Math.ceil(overageUnits * overageRate),
        currency: 'usd',
      });
    }
  }

  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const invoice = {
    id: sha256(userId + Date.now() + randomBytes(8).toString('hex')),
    userId,
    lineItems,
    subtotal: total,
    tax: Math.ceil(total * PSI2 * PSI2),
    total: total + Math.ceil(total * PSI2 * PSI2),
    currency: 'usd',
    status: 'draft',
    created: Date.now(),
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
    hash: sha256(userId + total + Date.now()),
  };

  if (invoices.size >= INVOICE_CACHE_SIZE) {
    const oldest = invoices.keys().next().value;
    invoices.delete(oldest);
  }
  invoices.set(invoice.id, invoice);
  metrics.charges++;
  return invoice;
}

// ── Stripe Webhook Handler ───────────────────────────────────────
function verifyWebhookSignature(payload, signature, secret) {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  return sha256(expected) === sha256(signature);
}

function handleWebhook(eventType, data) {
  metrics.webhooks++;
  const entry = { eventType, data, timestamp: Date.now(), hash: sha256(eventType + JSON.stringify(data)) };
  webhookLog.push(entry);

  const handlers = {
    'payment_intent.succeeded': () => {
      const userId = data.metadata?.userId;
      if (userId) {
        const userCreds = credits.get(userId);
        if (userCreds) {
          userCreds.used = 0;
          userCreds.remaining = userCreds.total;
          metrics.creditsIssued++;
        }
      }
      return { action: 'credits_reset', userId };
    },
    'customer.subscription.updated': () => {
      const userId = data.metadata?.userId;
      const sub = subscriptions.get(userId);
      if (sub) {
        sub.status = data.status || sub.status;
        if (data.cancel_at_period_end) sub.cancelAtPeriodEnd = true;
      }
      return { action: 'subscription_updated', userId };
    },
    'customer.subscription.deleted': () => {
      const userId = data.metadata?.userId;
      if (userId) cancelSubscription(userId);
      return { action: 'subscription_canceled', userId };
    },
    'invoice.payment_failed': () => {
      const userId = data.metadata?.userId;
      const sub = subscriptions.get(userId);
      if (sub) sub.status = 'past_due';
      return { action: 'payment_failed', userId };
    },
  };

  const handler = handlers[eventType];
  return handler ? handler() : { action: 'unhandled', eventType };
}

// ── HTTP Server ──────────────────────────────────────────────────
function createServer(port = 3313) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      const readBody = () => new Promise((resolve) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (parseErr) { resolve({ _parseError: parseErr.message }); } });
      });

      if (url.pathname === '/billing/subscribe' && req.method === 'POST') {
        const body = await readBody();
        respond(201, createSubscription(body.userId, body.plan, body.stripeSubscriptionId));
      } else if (url.pathname === '/billing/subscription' && req.method === 'GET') {
        const userId = url.searchParams.get('userId');
        const sub = getSubscription(userId);
        respond(sub ? 200 : 404, sub || { error: 'not_found' });
      } else if (url.pathname === '/billing/usage' && req.method === 'POST') {
        const body = await readBody();
        respond(200, recordUsage(body.userId, body.units, body.featureId));
      } else if (url.pathname === '/billing/invoice' && req.method === 'POST') {
        const body = await readBody();
        respond(200, generateInvoice(body.userId));
      } else if (url.pathname === '/billing/webhook' && req.method === 'POST') {
        const body = await readBody();
        respond(200, handleWebhook(body.type, body.data || body));
      } else if (url.pathname === '/billing/credits' && req.method === 'GET') {
        const userId = url.searchParams.get('userId');
        respond(200, credits.get(userId) || { total: 0, used: 0, remaining: 0 });
      } else if (url.pathname === '/health') {
        respond(200, health());
      } else {
        respond(404, { error: 'not_found' });
      }
    });
    server.listen(port);
    return server;
  });
}

const startTime = Date.now();
function health() {
  return {
    service: 'billing-service',
    status: 'healthy',
    port: 3313,
    uptime: Date.now() - startTime,
    activeSubscriptions: subscriptions.size,
    activeMeters: usageMeters.size,
    invoiceCount: invoices.size,
    metrics: { ...metrics },
    phiConstants: { TIER_THRESHOLDS, USAGE_BUCKET_SIZE, CREDIT_WARN_THRESHOLD },
  };
}

export default { createServer, health, createSubscription, recordUsage, generateInvoice, handleWebhook, getSubscription };
export { createServer, health, createSubscription, recordUsage, generateInvoice, handleWebhook, getSubscription };
