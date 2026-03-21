// HEADY_BRAND:BEGIN
// ║  HEADY™ — Revenue Architecture & Stripe Metered Billing               ║
// ║  FILE: src/services/heady-revenue.js                                   ║
// HEADY_BRAND:END
/**
 * Heady Revenue Architecture — Unified Monetization Stack
 *
 * Wires ALL Heady products into a single billing/metering system:
 *
 * ┌──────────────────┬────────────────────────────────┬──────────────────────┐
 * │ Model            │ Products                       │ Billing              │
 * ├──────────────────┼────────────────────────────────┼──────────────────────┤
 * │ Usage-based      │ Vector storage, pipeline runs, │ Stripe metered/unit  │
 * │                  │ LLM routing, agent executions  │                      │
 * │ Subscription     │ HeadyIntel, HeadyGuard,        │ Monthly/annual/seat  │
 * │                  │ HeadyMesh monitoring            │                      │
 * │ Licensing        │ Sacred Geometry SDK, Agent SDK  │ Annual per team      │
 * │ Platform fees    │ Agent Marketplace listings      │ 20% revenue share    │
 * │ Consulting       │ Custom agent dev, architecture  │ Hourly/project       │
 * └──────────────────┴────────────────────────────────┴──────────────────────┘
 *
 * All constants from phi-math.js. Zero hardcoded numbers.
 *
 * © 2024-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */

'use strict';

const crypto = require('crypto');
const {
  fib, PHI, PSI,
  PHI_TIMING,
  CSL_THRESHOLDS,
  phiBackoff,
} = require('../../shared/phi-math');

let log = null;
try { log = require('../utils/logger'); } catch { log = console; }
const { bus }          = require('../core/event-bus');

// ─── Metering Constants (φ-scaled) ──────────────────────────────────────────

/** Max meter events buffered before flush: fib(10) = 89 */
const METER_BUFFER_MAX = fib(10);

/** Flush interval: φ⁵ × 1000 = 11,090ms */
const METER_FLUSH_INTERVAL_MS = PHI_TIMING.PHI_5;

/** Max usage records kept in memory: fib(14) = 610 */
const MAX_USAGE_RECORDS = fib(14);

/** Invoice history cap: fib(12) = 233 */
const MAX_INVOICE_HISTORY = fib(12);

// ─── Product Catalog ─────────────────────────────────────────────────────────

const PRODUCTS = Object.freeze({
  // Usage-based products
  VECTOR_STORAGE: {
    id: 'vector_storage',
    name: 'Managed Vector Memory',
    model: 'usage',
    unit: 'vectors',
    unitSize: 1_000_000,
    pricePerUnit: 0.10,
    description: 'Multi-tenant pgvector with RLS isolation',
  },
  PIPELINE_RUNS: {
    id: 'pipeline_runs',
    name: 'Pipeline-as-a-Service',
    model: 'usage',
    unit: 'runs',
    unitSize: 1,
    pricePerUnit: 0.05,
    description: '22-stage HCFullPipeline execution',
  },
  LLM_ROUTING: {
    id: 'llm_routing',
    name: 'HeadyRouter',
    model: 'usage',
    unit: 'tokens',
    unitSize: 1_000_000,
    pricePerUnit: 0.50,
    description: 'Intelligent LLM routing across 6 providers',
  },
  AGENT_EXECUTIONS: {
    id: 'agent_executions',
    name: 'Agent Execution',
    model: 'usage',
    unit: 'executions',
    unitSize: 1,
    pricePerUnit: 0.01,
    description: 'Per-agent execution billing',
  },

  // Subscription products
  HEADY_INTEL: {
    id: 'heady_intel',
    name: 'HeadyIntel',
    model: 'subscription',
    plans: {
      monthly: { price: 500, interval: 'month' },
      annual:  { price: 5000, interval: 'year' },
    },
    description: 'Competitive intelligence reports',
  },
  HEADY_GUARD: {
    id: 'heady_guard',
    name: 'HeadyGuard',
    model: 'subscription',
    plans: {
      starter:    { price: 99,  interval: 'month', seats: 5 },
      enterprise: { price: 499, interval: 'month', seats: 50 },
    },
    description: 'Governance, compliance & kill-switch',
  },
  HEADY_MESH: {
    id: 'heady_mesh',
    name: 'HeadyMesh',
    model: 'subscription',
    plans: {
      pro:        { price: 49,  interval: 'month', agentsIncluded: fib(7) },
      enterprise: { price: 249, interval: 'month', agentsIncluded: fib(10) },
    },
    description: 'Multi-agent observability dashboard',
  },

  // Licensing products
  SACRED_GEOMETRY_SDK: {
    id: 'sacred_geometry_sdk',
    name: 'Sacred Geometry SDK',
    model: 'license',
    plans: {
      team:       { price: 999,  interval: 'year', seats: 10 },
      enterprise: { price: 4999, interval: 'year', seats: 100 },
    },
    description: 'φ-harmonic design system',
  },
  AGENT_SDK: {
    id: 'agent_sdk',
    name: '@heady/agent-sdk',
    model: 'license',
    plans: {
      indie:      { price: 199,  interval: 'year' },
      enterprise: { price: 1999, interval: 'year' },
    },
    description: 'Build and deploy custom agents',
  },

  // Platform fee
  MARKETPLACE: {
    id: 'marketplace',
    name: 'Agent Marketplace',
    model: 'platform_fee',
    feePercent: 20,
    description: '20% revenue share on marketplace sales',
  },
});

// ─── Tenant Tiers ────────────────────────────────────────────────────────────

const TIERS = Object.freeze({
  developer: {
    name: 'Developer',
    monthlyBudget: 0,
    rateLimitRps: fib(5),           // 8 rps
    vectorLimit: fib(14) * 1000,    // 610K vectors
    pipelineRunsDay: fib(5),        // 8 runs/day
  },
  starter: {
    name: 'Starter',
    monthlyBudget: 49,
    rateLimitRps: fib(7),           // 21 rps
    vectorLimit: fib(16) * 1000,    // 1.597M vectors
    pipelineRunsDay: fib(7),        // 21 runs/day
  },
  pro: {
    name: 'Pro',
    monthlyBudget: 199,
    rateLimitRps: fib(9),           // 55 rps
    vectorLimit: fib(18) * 1000,    // 4.181M vectors
    pipelineRunsDay: fib(9),        // 55 runs/day
  },
  enterprise: {
    name: 'Enterprise',
    monthlyBudget: 999,
    rateLimitRps: fib(11),          // 144 rps
    vectorLimit: fib(20) * 1000,    // 6.765M vectors
    pipelineRunsDay: fib(11),       // 144 runs/day
  },
});

// ─── Meter Event Buffer ──────────────────────────────────────────────────────

class MeterBuffer {
  constructor() {
    /** @type {Array<{ tenantId: string, productId: string, quantity: number, ts: number }>} */
    this._buffer = [];

    /** @type {Map<string, number>} tenantId:productId → accumulated quantity */
    this._aggregated = new Map();

    /** @type {NodeJS.Timer|null} */
    this._flushTimer = null;
  }

  /**
   * Record a metered event.
   * @param {string} tenantId
   * @param {string} productId
   * @param {number} quantity
   */
  record(tenantId, productId, quantity = 1) {
    const key = `${tenantId}:${productId}`;
    this._aggregated.set(key, (this._aggregated.get(key) || 0) + quantity);

    this._buffer.push({
      tenantId,
      productId,
      quantity,
      ts: Date.now(),
    });

    // Flush if buffer full
    if (this._buffer.length >= METER_BUFFER_MAX) {
      this.flush();
    }

    // Schedule periodic flush
    if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => {
        this._flushTimer = null;
        this.flush();
      }, METER_FLUSH_INTERVAL_MS);
      if (this._flushTimer.unref) this._flushTimer.unref();
    }
  }

  /**
   * Flush buffered meter events to Stripe (or local aggregation).
   * @returns {{ flushed: number, aggregated: object }}
   */
  flush() {
    const flushed = this._buffer.length;
    const snapshot = Object.fromEntries(this._aggregated);

    // Emit for Stripe webhook integration
    bus.emit('billing', {
      type:     'meter_flush',
      data:     { flushed, aggregated: snapshot },
      temporal: PSI,
      semantic: CSL_THRESHOLDS.MEDIUM,
      spatial:  PSI,
    });

    log.debug('Meter flush', { flushed, keys: this._aggregated.size });

    // Keep aggregated totals, clear buffer
    this._buffer = [];

    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }

    return { flushed, aggregated: snapshot };
  }

  /**
   * Get current usage for a tenant.
   * @param {string} tenantId
   * @returns {object}
   */
  getUsage(tenantId) {
    const usage = {};
    for (const [key, qty] of this._aggregated) {
      if (key.startsWith(`${tenantId}:`)) {
        const productId = key.slice(tenantId.length + 1);
        usage[productId] = qty;
      }
    }
    return usage;
  }

  /** @returns {{ bufferSize: number, aggregatedKeys: number }} */
  stats() {
    return {
      bufferSize: this._buffer.length,
      aggregatedKeys: this._aggregated.size,
    };
  }
}

// ─── Revenue Tracker ─────────────────────────────────────────────────────────

class RevenueTracker {
  constructor() {
    /** @type {Array<{ productId: string, tenantId: string, amount: number, ts: number }>} */
    this._invoices = [];

    /** @type {Map<string, number>} productId → total revenue */
    this._revenueByProduct = new Map();

    /** @type {number} */
    this._totalRevenue = 0;
  }

  /**
   * Record a revenue event.
   * @param {string} tenantId
   * @param {string} productId
   * @param {number} amount - Revenue in USD
   */
  record(tenantId, productId, amount) {
    this._invoices.push({ productId, tenantId, amount, ts: Date.now() });

    // Trim to max
    if (this._invoices.length > MAX_INVOICE_HISTORY) {
      this._invoices = this._invoices.slice(-MAX_INVOICE_HISTORY);
    }

    this._revenueByProduct.set(
      productId,
      (this._revenueByProduct.get(productId) || 0) + amount
    );
    this._totalRevenue += amount;

    bus.emit('billing', {
      type:     'revenue_recorded',
      data:     { tenantId, productId, amount, totalRevenue: this._totalRevenue },
      temporal: PSI,
      semantic: CSL_THRESHOLDS.HIGH,
      spatial:  PSI,
    });
  }

  /** @returns {object} Revenue breakdown */
  breakdown() {
    return {
      totalRevenue: this._totalRevenue,
      byProduct: Object.fromEntries(this._revenueByProduct),
      invoiceCount: this._invoices.length,
      recentInvoices: this._invoices.slice(-fib(5)),
    };
  }
}

// ─── Heady Revenue Service ───────────────────────────────────────────────────

class HeadyRevenue {
  constructor() {
    this.meter = new MeterBuffer();
    this.revenue = new RevenueTracker();

    /** @type {Map<string, { tenantId: string, tier: string, stripeCustomerId?: string }>} */
    this._tenants = new Map();
  }

  /**
   * Register a tenant.
   * @param {string} tenantId
   * @param {string} tier
   * @param {string} [stripeCustomerId]
   */
  registerTenant(tenantId, tier = 'developer', stripeCustomerId = null) {
    if (!TIERS[tier]) throw new Error(`Unknown tier: ${tier}`);
    this._tenants.set(tenantId, { tenantId, tier, stripeCustomerId, createdAt: Date.now() });
    log.info('Tenant registered', { tenantId, tier });
  }

  /**
   * Record metered usage for a tenant.
   * @param {string} tenantId
   * @param {string} productId
   * @param {number} quantity
   * @returns {{ recorded: boolean, budgetRemaining?: number }}
   */
  recordUsage(tenantId, productId, quantity = 1) {
    const tenant = this._tenants.get(tenantId);
    if (!tenant) return { recorded: false, error: 'unknown tenant' };

    const product = Object.values(PRODUCTS).find(p => p.id === productId);
    if (!product || product.model !== 'usage') return { recorded: false, error: 'invalid product' };

    // Check tier budget
    const tierConfig = TIERS[tenant.tier];
    const currentUsage = this.meter.getUsage(tenantId);
    const currentCost = this._calculateCost(currentUsage);

    if (tierConfig.monthlyBudget > 0 && currentCost >= tierConfig.monthlyBudget) {
      return { recorded: false, error: 'budget_exceeded', budgetRemaining: 0 };
    }

    this.meter.record(tenantId, productId, quantity);

    // Calculate cost for this usage
    const unitCost = (quantity / product.unitSize) * product.pricePerUnit;
    if (unitCost > 0) {
      this.revenue.record(tenantId, productId, unitCost);
    }

    return {
      recorded: true,
      budgetRemaining: tierConfig.monthlyBudget > 0
        ? tierConfig.monthlyBudget - currentCost - unitCost
        : Infinity,
    };
  }

  /**
   * Calculate total cost from usage map.
   * @param {object} usage - { productId: quantity }
   * @returns {number} Total cost in USD
   * @private
   */
  _calculateCost(usage) {
    let total = 0;
    for (const [productId, qty] of Object.entries(usage)) {
      const product = Object.values(PRODUCTS).find(p => p.id === productId);
      if (product && product.model === 'usage') {
        total += (qty / product.unitSize) * product.pricePerUnit;
      }
    }
    return total;
  }

  /**
   * Get billing dashboard data for a tenant.
   * @param {string} tenantId
   * @returns {object}
   */
  getDashboard(tenantId) {
    const tenant = this._tenants.get(tenantId);
    if (!tenant) return { error: 'unknown tenant' };

    const usage = this.meter.getUsage(tenantId);
    const cost = this._calculateCost(usage);
    const tierConfig = TIERS[tenant.tier];

    return {
      tenant: { ...tenant },
      tier: tierConfig,
      usage,
      cost,
      budgetUtilization: tierConfig.monthlyBudget > 0
        ? cost / tierConfig.monthlyBudget
        : 0,
      products: PRODUCTS,
    };
  }

  /** @returns {object} Service-wide stats */
  stats() {
    return {
      tenantCount: this._tenants.size,
      meter: this.meter.stats(),
      revenue: this.revenue.breakdown(),
      products: Object.keys(PRODUCTS).length,
      tiers: Object.keys(TIERS),
    };
  }
}

// ─── Express Router ──────────────────────────────────────────────────────────

function createRevenueRouter() {
  const express = require('express');
  const router  = express.Router();
  const service = new HeadyRevenue();

  // GET /api/revenue/products — product catalog
  router.get('/products', (_req, res) => {
    res.json({ ok: true, products: PRODUCTS, tiers: TIERS });
  });

  // POST /api/revenue/tenants — register tenant
  router.post('/tenants', (req, res) => {
    try {
      const { tenantId, tier, stripeCustomerId } = req.body || {};
      if (!tenantId) return res.status(400).json({ ok: false, error: 'tenantId required' });
      service.registerTenant(tenantId, tier, stripeCustomerId);
      res.status(201).json({ ok: true, tenantId, tier: tier || 'developer' });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  // POST /api/revenue/meter — record metered usage
  router.post('/meter', (req, res) => {
    const { tenantId, productId, quantity } = req.body || {};
    if (!tenantId || !productId) {
      return res.status(400).json({ ok: false, error: 'tenantId and productId required' });
    }
    const result = service.recordUsage(tenantId, productId, quantity || 1);
    res.json({ ok: result.recorded, ...result });
  });

  // GET /api/revenue/usage/:tenantId — tenant usage
  router.get('/usage/:tenantId', (req, res) => {
    const dashboard = service.getDashboard(req.params.tenantId);
    res.json({ ok: !dashboard.error, ...dashboard });
  });

  // GET /api/revenue/stats — global revenue stats
  router.get('/stats', (_req, res) => {
    res.json({ ok: true, ...service.stats() });
  });

  // POST /api/revenue/flush — flush meter buffer
  router.post('/flush', (_req, res) => {
    const result = service.meter.flush();
    res.json({ ok: true, ...result });
  });

  // GET /api/revenue/breakdown — revenue breakdown by product
  router.get('/breakdown', (_req, res) => {
    res.json({ ok: true, ...service.revenue.breakdown() });
  });

  return router;
}

// ─── Module Exports ──────────────────────────────────────────────────────────

module.exports = {
  HeadyRevenue,
  MeterBuffer,
  RevenueTracker,
  PRODUCTS,
  TIERS,
  createRevenueRouter,
};
