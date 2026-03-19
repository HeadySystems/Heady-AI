// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ REVENUE ROUTER — Unified Monetization Architecture     ║
// ║  Wires all products into usage-based, subscription, licensing   ║
// ║  FILE: src/services/heady-revenue-router.js                    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

'use strict';
const crypto = require('crypto');

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;

// ─── Product Catalog ────────────────────────────────────────────────

const PRODUCTS = {
  // Usage-based products
  'vector-memory': {
    type: 'usage',
    name: 'Managed Vector Memory',
    unit: 'vectors',
    pricePer1M: 5.00,
    queryPricePer1K: 0.01,
    stripePriceId: 'price_vector_memory_metered',
    meter: 'heady_vector_operations',
  },
  'pipeline-runs': {
    type: 'usage',
    name: 'Pipeline-as-a-Service',
    unit: 'runs',
    pricePerRun: 0.10,
    stripePriceId: 'price_pipeline_metered',
    meter: 'heady_pipeline_runs',
  },
  'llm-routing': {
    type: 'usage',
    name: 'HeadyRouter LLM Gateway',
    unit: 'tokens',
    pricePer1M: 2.50,
    stripePriceId: 'price_llm_routing_metered',
    meter: 'heady_routed_tokens',
  },
  'agent-executions': {
    type: 'usage',
    name: 'Agent Executions',
    unit: 'executions',
    pricePerExecution: 0.05,
    stripePriceId: 'price_agent_exec_metered',
    meter: 'heady_agent_executions',
  },

  // Subscription products
  'heady-intel': {
    type: 'subscription',
    name: 'HeadyIntel',
    description: 'Weekly AI-generated market intelligence reports',
    priceMonthly: 500.00,
    priceAnnual: 5000.00,
    stripePriceIdMonthly: 'price_intel_monthly',
    stripePriceIdAnnual: 'price_intel_annual',
    features: ['weekly-reports', 'competitor-tracking', 'patent-monitoring', 'tech-radar'],
  },
  'heady-guard': {
    type: 'subscription',
    name: 'HeadyGuard',
    description: 'Enterprise governance, compliance, and audit trail',
    priceMonthly: 299.00,
    priceAnnual: 2990.00,
    stripePriceIdMonthly: 'price_guard_monthly',
    stripePriceIdAnnual: 'price_guard_annual',
    features: ['kill-switch', 'audit-trail', 'hallucination-watchdog', 'soc2-reports'],
  },
  'heady-mesh': {
    type: 'subscription',
    name: 'HeadyMesh',
    description: 'Observability + auto-healing for multi-agent deployments',
    pricePerAgent: 49.00,
    stripePriceId: 'price_mesh_per_agent',
    features: ['agent-health', 'event-flow', 'auto-healing', 'topology-view'],
  },

  // Licensing products
  'sacred-geometry-sdk': {
    type: 'license',
    name: 'Sacred Geometry Design System',
    priceAnnual: 2499.00,
    stripePriceId: 'price_sg_sdk_annual',
    includes: ['phi-constants', 'fibonacci-css', 'torus-themes', 'metatron-layouts', 'breathing-animations'],
  },
  'agent-sdk': {
    type: 'license',
    name: 'HeadyAgent SDK',
    priceAnnual: 4999.00,
    stripePriceId: 'price_agent_sdk_annual',
    includes: ['agent-base', 'bee-factory', 'swarm-coordinator', 'supervisor-pattern', 'battle-arena'],
  },

  // Platform fees
  'marketplace': {
    type: 'platform-fee',
    name: 'HeadyAgents Marketplace',
    feePercent: 20,
    description: 'Third-party agent listings — Heady takes 20% platform fee',
  },
};

// ─── Usage Metering ─────────────────────────────────────────────────

class UsageMeter {
  constructor() {
    this.meters = new Map();
    this.events = [];
  }

  record(productId, quantity, metadata = {}) {
    const product = PRODUCTS[productId];
    if (!product || product.type !== 'usage') return null;

    const event = {
      id: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      productId,
      meter: product.meter,
      quantity,
      timestamp: new Date().toISOString(),
      customerId: metadata.customerId || 'default',
      metadata,
    };

    this.events.push(event);

    // Update running total
    const key = `${metadata.customerId || 'default'}:${productId}`;
    const current = this.meters.get(key) || { total: 0, cost: 0 };
    current.total += quantity;

    // Calculate cost based on product pricing
    if (product.pricePer1M) {
      current.cost += (quantity / 1_000_000) * product.pricePer1M;
    } else if (product.pricePerRun) {
      current.cost += quantity * product.pricePerRun;
    } else if (product.pricePerExecution) {
      current.cost += quantity * product.pricePerExecution;
    }

    this.meters.set(key, current);

    // Emit for Stripe metering
    if (global.eventBus) {
      global.eventBus.emit('billing:usage', event);
    }

    return event;
  }

  getUsage(customerId, productId) {
    const key = `${customerId}:${productId}`;
    return this.meters.get(key) || { total: 0, cost: 0 };
  }

  getTotalRevenue() {
    let total = 0;
    for (const [, data] of this.meters) {
      total += data.cost;
    }
    return Math.round(total * 100) / 100;
  }

  getRecentEvents(limit = 50) {
    return this.events.slice(-limit);
  }
}

// ─── Subscription Manager ───────────────────────────────────────────

class SubscriptionManager {
  constructor() {
    this.subscriptions = new Map(); // customerId → [{ productId, plan, startDate, status }]
  }

  subscribe(customerId, productId, plan = 'monthly') {
    const product = PRODUCTS[productId];
    if (!product || (product.type !== 'subscription' && product.type !== 'license')) return null;

    const sub = {
      id: `sub_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      customerId,
      productId,
      plan,
      price: plan === 'annual' ? (product.priceAnnual || product.priceMonthly * 10) : product.priceMonthly,
      status: 'active',
      startDate: new Date().toISOString(),
      nextBilling: new Date(Date.now() + (plan === 'annual' ? 365 : 30) * 86400000).toISOString(),
    };

    const existing = this.subscriptions.get(customerId) || [];
    existing.push(sub);
    this.subscriptions.set(customerId, existing);

    if (global.eventBus) {
      global.eventBus.emit('billing:subscription', sub);
    }

    return sub;
  }

  getSubscriptions(customerId) {
    return this.subscriptions.get(customerId) || [];
  }

  getMRR() {
    let mrr = 0;
    for (const [, subs] of this.subscriptions) {
      for (const sub of subs) {
        if (sub.status !== 'active') continue;
        mrr += sub.plan === 'annual' ? sub.price / 12 : sub.price;
      }
    }
    return Math.round(mrr * 100) / 100;
  }
}

// ─── Revenue Dashboard ──────────────────────────────────────────────

class RevenueDashboard {
  constructor(usageMeter, subscriptionManager) {
    this.usage = usageMeter;
    this.subs = subscriptionManager;
  }

  getSummary() {
    return {
      mrr: this.subs.getMRR(),
      usageRevenue: this.usage.getTotalRevenue(),
      totalRevenue: this.subs.getMRR() + this.usage.getTotalRevenue(),
      products: Object.entries(PRODUCTS).map(([id, p]) => ({
        id,
        name: p.name,
        type: p.type,
        pricing: p.type === 'usage'
          ? `${p.pricePer1M ? `$${p.pricePer1M}/1M ${p.unit}` : p.pricePerRun ? `$${p.pricePerRun}/run` : `$${p.pricePerExecution}/exec`}`
          : p.type === 'subscription'
            ? `$${p.priceMonthly || p.pricePerAgent}/mo`
            : p.type === 'license'
              ? `$${p.priceAnnual}/yr`
              : `${p.feePercent}% fee`,
      })),
      recentUsage: this.usage.getRecentEvents(20),
    };
  }
}

// ─── Express Router ─────────────────────────────────────────────────

function createRevenueRouter() {
  const express = require('express');
  const router = express.Router();
  const usageMeter = new UsageMeter();
  const subscriptionManager = new SubscriptionManager();
  const dashboard = new RevenueDashboard(usageMeter, subscriptionManager);

  const auth = (req, res, next) => {
    const key = req.headers['x-heady-api-key'] || req.headers['authorization']?.split(' ')[1];
    if (!key || key !== process.env.HEADY_API_KEY) {
      return res.status(403).json({ error: 'API key required' });
    }
    next();
  };

  router.get('/dashboard', auth, (req, res) => {
    res.json({ ok: true, ...dashboard.getSummary() });
  });

  router.get('/products', (req, res) => {
    res.json({ ok: true, products: PRODUCTS });
  });

  router.post('/usage', auth, (req, res) => {
    const { productId, quantity, customerId } = req.body;
    if (!productId || !quantity) return res.status(400).json({ error: 'productId and quantity required' });
    const event = usageMeter.record(productId, quantity, { customerId });
    if (!event) return res.status(400).json({ error: 'Invalid usage product' });
    res.json({ ok: true, event });
  });

  router.get('/usage/:customerId', auth, (req, res) => {
    const usage = {};
    for (const id of Object.keys(PRODUCTS)) {
      if (PRODUCTS[id].type === 'usage') {
        usage[id] = usageMeter.getUsage(req.params.customerId, id);
      }
    }
    res.json({ ok: true, customerId: req.params.customerId, usage });
  });

  router.post('/subscribe', auth, (req, res) => {
    const { customerId, productId, plan } = req.body;
    if (!customerId || !productId) return res.status(400).json({ error: 'customerId and productId required' });
    const sub = subscriptionManager.subscribe(customerId, productId, plan);
    if (!sub) return res.status(400).json({ error: 'Invalid subscription product' });
    res.json({ ok: true, subscription: sub });
  });

  router.get('/subscriptions/:customerId', auth, (req, res) => {
    res.json({ ok: true, subscriptions: subscriptionManager.getSubscriptions(req.params.customerId) });
  });

  router.get('/mrr', auth, (req, res) => {
    res.json({ ok: true, mrr: subscriptionManager.getMRR(), usageRevenue: usageMeter.getTotalRevenue() });
  });

  return router;
}

module.exports = { createRevenueRouter, PRODUCTS, UsageMeter, SubscriptionManager, RevenueDashboard };
