/**
 * Heady Unified Billing Service
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * 5 billing models, Stripe-ready metering, subscription management,
 * invoice generation, and revenue reporting.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Billing Models ──
const BILLING_MODELS = {
  USAGE_BASED: 'usage-based',
  SUBSCRIPTION: 'subscription',
  LICENSING: 'licensing',
  PLATFORM_FEES: 'platform-fees',
  CONSULTING: 'consulting',
};

// ── Metering Dimensions ──
const METERING_DIMENSIONS = {
  VECTOR_STORAGE: { id: 'vector-storage', unit: 'per 1M vectors', pricePerUnit: 2.50, description: 'Vector storage and indexing' },
  PIPELINE_RUNS: { id: 'pipeline-runs', unit: 'per run', pricePerUnit: 0.05, description: 'Pipeline execution runs' },
  LLM_TOKENS: { id: 'llm-tokens', unit: 'per 1M tokens', pricePerUnit: 3.00, description: 'LLM token consumption' },
  AGENT_EXECUTIONS: { id: 'agent-executions', unit: 'per execution', pricePerUnit: 0.10, description: 'Agent task executions' },
};

// ── Subscription Plans ──
const PLANS = {
  free: {
    id: 'free', name: 'Free', price: 0, interval: 'month', currency: 'usd',
    limits: { vectorStorage: 100000, pipelineRuns: 100, llmTokens: 1000000, agentExecutions: 50 },
    features: ['Basic vector search', 'Community support', 'Single project', '100K vectors'],
    stripePriceId: null,
  },
  pro: {
    id: 'pro', name: 'Pro', price: 4900, interval: 'month', currency: 'usd',
    limits: { vectorStorage: 10000000, pipelineRuns: 5000, llmTokens: 50000000, agentExecutions: 2000 },
    features: ['10M vectors', '5K pipeline runs/mo', '50M LLM tokens/mo', 'Priority support', 'Custom pipelines', 'API access', 'Team collaboration (5 seats)'],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
  },
  enterprise: {
    id: 'enterprise', name: 'Enterprise', price: 49900, interval: 'month', currency: 'usd',
    limits: { vectorStorage: -1, pipelineRuns: -1, llmTokens: -1, agentExecutions: -1 },
    features: ['Unlimited vectors', 'Unlimited pipeline runs', 'Unlimited LLM tokens', 'Unlimited agent executions', 'Dedicated support', 'SLA guarantee (99.9%)', 'Custom integrations', 'SSO/SAML', 'Audit logs', 'Unlimited seats'],
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
  },
  custom: {
    id: 'custom', name: 'Custom', price: null, interval: 'month', currency: 'usd',
    limits: { vectorStorage: -1, pipelineRuns: -1, llmTokens: -1, agentExecutions: -1 },
    features: ['Everything in Enterprise', 'Custom pricing', 'Dedicated infrastructure', 'On-premise deployment option', 'Custom SLA', 'Executive support'],
    stripePriceId: null,
  },
};

/**
 * Metering Engine — tracks usage across all dimensions.
 */
class MeteringEngine {
  constructor() {
    this._meters = new Map(); // customerId → { dimension → { total, records } }
    this._periodStart = new Date();
    this._periodStart.setDate(1);
    this._periodStart.setHours(0, 0, 0, 0);
  }

  /**
   * Record a usage event.
   */
  record(customerId, dimension, quantity = 1, metadata = {}) {
    if (!this._meters.has(customerId)) {
      this._meters.set(customerId, {});
    }
    const customer = this._meters.get(customerId);
    if (!customer[dimension]) {
      customer[dimension] = { total: 0, records: [] };
    }

    const meter = customer[dimension];
    meter.total += quantity;
    meter.records.push({
      quantity,
      timestamp: new Date().toISOString(),
      ...metadata,
    });

    // Keep only last 1000 records per dimension
    if (meter.records.length > 1000) {
      meter.records = meter.records.slice(-1000);
    }

    return { customerId, dimension, newTotal: meter.total, quantity };
  }

  /**
   * Get usage for a customer in the current billing period.
   */
  getUsage(customerId) {
    const customer = this._meters.get(customerId);
    if (!customer) return {};

    const usage = {};
    for (const [dim, meter] of Object.entries(customer)) {
      const dimConfig = Object.values(METERING_DIMENSIONS).find(d => d.id === dim);
      usage[dim] = {
        total: meter.total,
        unit: dimConfig ? dimConfig.unit : 'units',
        cost: dimConfig ? this._calculateCost(meter.total, dimConfig) : 0,
      };
    }
    return usage;
  }

  _calculateCost(total, dimConfig) {
    const unitSize = dimConfig.unit.includes('1M') ? 1000000 : 1;
    return +((total / unitSize) * dimConfig.pricePerUnit).toFixed(2);
  }

  /**
   * Check if a customer has exceeded their plan limits.
   */
  checkLimits(customerId, plan) {
    const customer = this._meters.get(customerId) || {};
    const violations = [];

    const limitMap = {
      'vector-storage': plan.limits.vectorStorage,
      'pipeline-runs': plan.limits.pipelineRuns,
      'llm-tokens': plan.limits.llmTokens,
      'agent-executions': plan.limits.agentExecutions,
    };

    for (const [dim, limit] of Object.entries(limitMap)) {
      if (limit === -1) continue; // Unlimited
      const used = customer[dim]?.total || 0;
      if (used >= limit) {
        violations.push({ dimension: dim, used, limit, overage: used - limit });
      }
    }

    return { withinLimits: violations.length === 0, violations };
  }

  /**
   * Reset meters for a new billing period.
   */
  resetPeriod() {
    const snapshot = {};
    for (const [customerId, meters] of this._meters) {
      snapshot[customerId] = {};
      for (const [dim, meter] of Object.entries(meters)) {
        snapshot[customerId][dim] = { total: meter.total, recordCount: meter.records.length };
      }
    }
    this._meters.clear();
    this._periodStart = new Date();
    this._periodStart.setDate(1);
    this._periodStart.setHours(0, 0, 0, 0);
    return { previousPeriod: snapshot, newPeriodStart: this._periodStart.toISOString() };
  }

  stats() {
    return {
      customers: this._meters.size,
      periodStart: this._periodStart.toISOString(),
      dimensions: Object.keys(METERING_DIMENSIONS).length,
    };
  }
}

/**
 * Subscription Manager — handles plan assignments and lifecycle.
 */
class SubscriptionManager {
  constructor() {
    this._subscriptions = new Map(); // customerId → subscription
  }

  /**
   * Create or update a subscription.
   */
  subscribe(customerId, planId, options = {}) {
    const plan = PLANS[planId];
    if (!plan) return { error: `Unknown plan: ${planId}` };

    const existing = this._subscriptions.get(customerId);
    const subscription = {
      id: `sub_${crypto.randomBytes(12).toString('hex')}`,
      customerId,
      planId,
      plan,
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: this._periodEnd().toISOString(),
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      canceledAt: null,
      stripeSubscriptionId: options.stripeSubscriptionId || null,
      metadata: options.metadata || {},
    };

    this._subscriptions.set(customerId, subscription);
    return subscription;
  }

  /**
   * Cancel a subscription.
   */
  cancel(customerId, immediate = false) {
    const sub = this._subscriptions.get(customerId);
    if (!sub) return null;

    if (immediate) {
      sub.status = 'canceled';
      sub.canceledAt = new Date().toISOString();
    } else {
      sub.status = 'canceling';
      sub.canceledAt = sub.currentPeriodEnd; // Cancel at end of period
    }
    sub.updatedAt = new Date().toISOString();
    return sub;
  }

  get(customerId) { return this._subscriptions.get(customerId) || null; }

  getAll() { return Array.from(this._subscriptions.values()); }

  _periodEnd() {
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    end.setDate(1);
    end.setHours(0, 0, 0, 0);
    return end;
  }

  stats() {
    const subs = this.getAll();
    const byPlan = {};
    for (const sub of subs) {
      byPlan[sub.planId] = (byPlan[sub.planId] || 0) + 1;
    }
    return {
      total: subs.length,
      active: subs.filter(s => s.status === 'active').length,
      canceling: subs.filter(s => s.status === 'canceling').length,
      canceled: subs.filter(s => s.status === 'canceled').length,
      byPlan,
    };
  }
}

/**
 * Invoice Generator.
 */
class InvoiceGenerator {
  constructor(metering, subscriptions) {
    this._metering = metering;
    this._subscriptions = subscriptions;
    this._invoices = [];
  }

  /**
   * Generate an invoice for a customer.
   */
  generate(customerId) {
    const sub = this._subscriptions.get(customerId);
    if (!sub) return { error: 'No subscription found' };

    const usage = this._metering.getUsage(customerId);
    const plan = sub.plan;

    // Base subscription cost
    const subscriptionCost = plan.price / 100; // Convert cents to dollars

    // Overage costs for usage-based billing
    let overageCost = 0;
    const overageItems = [];
    const limitCheck = this._metering.checkLimits(customerId, plan);
    for (const violation of limitCheck.violations) {
      const dimConfig = Object.values(METERING_DIMENSIONS).find(d => d.id === violation.dimension);
      if (dimConfig) {
        const cost = this._metering._calculateCost(violation.overage, dimConfig);
        overageCost += cost;
        overageItems.push({
          dimension: violation.dimension,
          overage: violation.overage,
          cost,
          unit: dimConfig.unit,
        });
      }
    }

    const totalCost = +(subscriptionCost + overageCost).toFixed(2);

    const invoice = {
      id: `inv_${crypto.randomBytes(12).toString('hex')}`,
      customerId,
      subscriptionId: sub.id,
      planId: sub.planId,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      lineItems: [
        { description: `${plan.name} Plan — Monthly`, amount: subscriptionCost, currency: plan.currency },
        ...overageItems.map(o => ({
          description: `Overage: ${o.dimension} (${o.overage} ${o.unit})`,
          amount: o.cost,
          currency: plan.currency,
        })),
      ],
      subtotal: totalCost,
      tax: 0,
      total: totalCost,
      currency: plan.currency,
      status: 'draft',
      usage,
      createdAt: new Date().toISOString(),
    };

    this._invoices.push(invoice);
    return invoice;
  }

  getInvoices(customerId) {
    if (customerId) return this._invoices.filter(i => i.customerId === customerId);
    return this._invoices;
  }

  markPaid(invoiceId) {
    const inv = this._invoices.find(i => i.id === invoiceId);
    if (!inv) return null;
    inv.status = 'paid';
    inv.paidAt = new Date().toISOString();
    return inv;
  }
}

/**
 * Revenue Reporter — MRR, ARR, churn metrics.
 */
class RevenueReporter {
  constructor(subscriptions, invoices) {
    this._subscriptions = subscriptions;
    this._invoices = invoices;
  }

  report() {
    const subs = this._subscriptions.getAll().filter(s => s.status === 'active');
    const allSubs = this._subscriptions.getAll();

    // MRR: sum of monthly revenue from active subscriptions
    const mrr = subs.reduce((sum, s) => sum + (s.plan.price || 0), 0) / 100;

    // ARR: MRR * 12
    const arr = mrr * 12;

    // Churn: canceled / total
    const canceled = allSubs.filter(s => s.status === 'canceled').length;
    const total = allSubs.length;
    const churnRate = total > 0 ? +((canceled / total) * 100).toFixed(2) : 0;

    // Revenue from invoices
    const paidInvoices = this._invoices.getInvoices().filter(i => i.status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);

    // ARPU: Average Revenue Per User
    const arpu = subs.length > 0 ? +(mrr / subs.length).toFixed(2) : 0;

    // Plan distribution
    const planDistribution = {};
    for (const sub of subs) {
      planDistribution[sub.planId] = (planDistribution[sub.planId] || 0) + 1;
    }

    return {
      generatedAt: new Date().toISOString(),
      mrr: +mrr.toFixed(2),
      arr: +arr.toFixed(2),
      churnRate,
      arpu,
      activeSubscriptions: subs.length,
      totalSubscriptionsEver: total,
      canceledSubscriptions: canceled,
      totalRevenue: +totalRevenue.toFixed(2),
      paidInvoiceCount: paidInvoices.length,
      planDistribution,
    };
  }
}

/**
 * Product Catalog — 5 billing models with their configurations.
 */
class ProductCatalog {
  constructor() {
    this._products = new Map();
    this._initializeDefaults();
  }

  _initializeDefaults() {
    this._products.set('heady-platform', {
      id: 'heady-platform',
      name: 'Heady Platform',
      billingModel: BILLING_MODELS.SUBSCRIPTION,
      plans: Object.keys(PLANS),
      description: 'Full Heady orchestration platform with vector memory, pipelines, and agents',
    });
    this._products.set('heady-vectors', {
      id: 'heady-vectors',
      name: 'Heady Vectors',
      billingModel: BILLING_MODELS.USAGE_BASED,
      meteringDimension: 'vector-storage',
      description: 'Pay-per-use vector storage and search',
    });
    this._products.set('heady-sdk', {
      id: 'heady-sdk',
      name: 'Heady SDK License',
      billingModel: BILLING_MODELS.LICENSING,
      annualFee: 9999,
      description: 'Annual SDK license for embedding Heady in third-party applications',
    });
    this._products.set('heady-marketplace', {
      id: 'heady-marketplace',
      name: 'Heady Marketplace',
      billingModel: BILLING_MODELS.PLATFORM_FEES,
      feePercent: 15,
      description: 'Marketplace for Heady plugins and integrations — 15% platform fee',
    });
    this._products.set('heady-consulting', {
      id: 'heady-consulting',
      name: 'Heady Consulting',
      billingModel: BILLING_MODELS.CONSULTING,
      hourlyRate: 250,
      packages: { assessment: 5000, implementation: 25000, enterprise: 100000 },
      description: 'Expert consulting for Heady deployment and customization',
    });
  }

  get(productId) { return this._products.get(productId) || null; }
  getAll() { return Array.from(this._products.values()); }
  add(product) { this._products.set(product.id, product); }
}

/**
 * Stripe Integration Layer — configurable payment provider.
 */
class PaymentProvider {
  constructor(options = {}) {
    this._provider = options.provider || 'stripe';
    this._apiKey = options.apiKey || process.env.STRIPE_SECRET_KEY || null;
    this._client = null;
  }

  async initialize() {
    if (this._provider === 'stripe' && this._apiKey) {
      try {
        const Stripe = require('stripe');
        this._client = new Stripe(this._apiKey);
        return { initialized: true, provider: 'stripe' };
      } catch {
        return { initialized: false, provider: 'stripe', error: 'stripe package not installed' };
      }
    }
    return { initialized: false, provider: this._provider, error: 'No API key or unsupported provider' };
  }

  isInitialized() { return !!this._client; }

  async createCustomer(email, name, metadata = {}) {
    if (!this._client) return { id: `cus_local_${crypto.randomBytes(8).toString('hex')}`, email, name, metadata, local: true };
    return this._client.customers.create({ email, name, metadata });
  }

  async createSubscription(customerId, priceId) {
    if (!this._client) return { id: `sub_local_${crypto.randomBytes(8).toString('hex')}`, customerId, priceId, local: true };
    return this._client.subscriptions.create({ customer: customerId, items: [{ price: priceId }] });
  }

  async reportUsage(subscriptionItemId, quantity, timestamp) {
    if (!this._client) return { id: `usage_local_${Date.now()}`, quantity, local: true };
    return this._client.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity,
      timestamp: Math.floor((timestamp || Date.now()) / 1000),
      action: 'increment',
    });
  }
}

/**
 * Heady Billing Service — main orchestrator.
 */
class HeadyBillingService {
  constructor(options = {}) {
    this.catalog = new ProductCatalog();
    this.metering = new MeteringEngine();
    this.subscriptions = new SubscriptionManager();
    this.invoices = new InvoiceGenerator(this.metering, this.subscriptions);
    this.revenue = new RevenueReporter(this.subscriptions, this.invoices);
    this.payment = new PaymentProvider(options.payment || {});
    this._startedAt = Date.now();
  }

  async initialize() {
    const paymentStatus = await this.payment.initialize();
    return {
      service: 'heady-billing',
      version: '1.0.0',
      payment: paymentStatus,
      products: this.catalog.getAll().length,
      plans: Object.keys(PLANS).length,
      meteringDimensions: Object.keys(METERING_DIMENSIONS).length,
    };
  }

  /**
   * Get service health and stats.
   */
  getStats() {
    return {
      service: 'heady-billing',
      version: '1.0.0',
      uptime: Date.now() - this._startedAt,
      billingModels: Object.values(BILLING_MODELS),
      products: this.catalog.getAll().length,
      plans: Object.keys(PLANS),
      subscriptions: this.subscriptions.stats(),
      metering: this.metering.stats(),
      invoices: this.invoices.getInvoices().length,
      revenue: this.revenue.report(),
      paymentProvider: this.payment._provider,
      paymentInitialized: this.payment.isInitialized(),
    };
  }
}

module.exports = {
  HeadyBillingService, MeteringEngine, SubscriptionManager,
  InvoiceGenerator, RevenueReporter, ProductCatalog, PaymentProvider,
  BILLING_MODELS, METERING_DIMENSIONS, PLANS,
};
