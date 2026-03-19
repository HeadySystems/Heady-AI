// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ REVENUE ARCHITECTURE — Unified Monetization Stack      ║
// ║  11 products × 5 billing models × phi-scaled growth            ║
// ║  FILE: src/services/heady-revenue-architecture.js               ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

'use strict';
const { EventEmitter } = require('events');
const crypto = require('crypto');

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

// ─── PRICING TIERS ───────────────────────────────────────────────────────────
const PRICING_TIERS = {
  USAGE_BASED: 'usage-based',
  SUBSCRIPTION: 'subscription',
  LICENSING: 'licensing',
  PLATFORM_FEE: 'platform-fee',
  CONSULTING: 'consulting'
};

// ─── PRODUCT CATALOG ─────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    id: 'pipeline-as-a-service', layer: 2, name: 'Pipeline-as-a-Service',
    description: 'Enterprise CI/CD via HCFullPipeline webhook API',
    billingModel: PRICING_TIERS.USAGE_BASED,
    pricing: { perPipelineRun: 0.10, perStage: 0.005, monthlyMin: 50 },
    metrics: ['pipeline_runs', 'stages_executed', 'total_duration_ms']
  },
  {
    id: 'managed-vector-memory', layer: 3, name: 'Managed Vector Memory',
    description: 'Multi-tenant pgvector with RLS isolation',
    billingModel: PRICING_TIERS.USAGE_BASED,
    pricing: { perMillionVectors: 5.00, perThousandQueries: 0.50, monthlyMin: 25 },
    metrics: ['vectors_stored', 'queries_executed', 'storage_gb']
  },
  {
    id: 'heady-guard', layer: 4, name: 'HeadyGuard',
    description: 'Governance-as-a-Service: kill-switch + audit trail + hallucination watchdog',
    billingModel: PRICING_TIERS.SUBSCRIPTION,
    pricing: { starter: 99, professional: 299, enterprise: 999 },
    metrics: ['governance_events', 'alerts_triggered', 'compliance_score']
  },
  {
    id: 'heady-mesh', layer: 5, name: 'HeadyMesh',
    description: 'Observability + auto-healing dashboard for multi-agent deployments',
    billingModel: PRICING_TIERS.SUBSCRIPTION,
    pricing: { perAgentMonth: 5, baseMonthly: 49, enterprise: 499 },
    metrics: ['agents_monitored', 'events_processed', 'auto_heals']
  },
  {
    id: 'heady-router', layer: 6, name: 'HeadyRouter',
    description: 'Intelligent LLM routing gateway — Claude/GPT/Gemini/Groq',
    billingModel: PRICING_TIERS.USAGE_BASED,
    pricing: { perMillionTokens: 0.50, monthlyMin: 20 },
    metrics: ['tokens_routed', 'requests', 'cost_savings_pct']
  },
  {
    id: 'heady-autopilot', layer: 7, name: 'HeadyAutoPilot',
    description: 'Autonomous task execution engine — buy task packs',
    billingModel: PRICING_TIERS.USAGE_BASED,
    pricing: { securityAuditPack: 149, perfOptimPack: 199, compliancePack: 299, customPack: 499 },
    metrics: ['tasks_executed', 'packs_purchased', 'success_rate']
  },
  {
    id: 'heady-agents-marketplace', layer: 8, name: 'HeadyAgents Marketplace',
    description: 'Third-party AI agent marketplace — 20% platform fee',
    billingModel: PRICING_TIERS.PLATFORM_FEE,
    pricing: { platformFeePercent: 20, minListingFee: 0, payoutThreshold: 50 },
    metrics: ['agents_listed', 'agent_executions', 'gmv', 'platform_revenue']
  },
  {
    id: 'heady-intel', layer: 9, name: 'HeadyIntel',
    description: 'AI-generated weekly competitive intelligence reports',
    billingModel: PRICING_TIERS.SUBSCRIPTION,
    pricing: { perSeatMonth: 500, minSeats: 1, annualDiscount: 0.20 },
    metrics: ['reports_generated', 'insights_delivered', 'seats_active']
  },
  {
    id: 'sacred-geometry-sdk', layer: 10, name: 'Sacred Geometry SDK',
    description: 'Design system built on mathematical harmony',
    billingModel: PRICING_TIERS.LICENSING,
    pricing: { annualPerTeam: 2400, enterpriseSite: 9600 },
    metrics: ['teams_licensed', 'components_used', 'installs']
  },
  {
    id: 'heady-code-dojo', layer: 13, name: 'HeadyCodeDojo',
    description: 'Continuous coding practice with AI evaluation',
    billingModel: PRICING_TIERS.SUBSCRIPTION,
    pricing: { individual: 29, team: 99, enterprise: 299 },
    metrics: ['challenges_completed', 'skills_improved', 'active_users']
  },
  {
    id: 'heady-train', layer: 14, name: 'HeadyTrain',
    description: 'AI training curriculum — skill gap analysis + spaced repetition',
    billingModel: PRICING_TIERS.SUBSCRIPTION,
    pricing: { individual: 49, team: 149, enterprise: 499 },
    metrics: ['curricula_generated', 'gaps_closed', 'training_hours']
  }
];

class RevenueArchitecture extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._products = new Map(PRODUCTS.map(p => [p.id, { ...p, activeSubscriptions: 0, usageThisPeriod: {} }]));
    this._subscriptions = new Map();
    this._usageLog = [];
    this._invoices = [];
    this._startedAt = new Date().toISOString();
  }

  // ─── Usage Tracking ──────────────────────────────────────────────────────
  trackUsage(productId, metric, amount = 1) {
    const product = this._products.get(productId);
    if (!product) throw new Error(`Unknown product: ${productId}`);

    if (!product.usageThisPeriod[metric]) product.usageThisPeriod[metric] = 0;
    product.usageThisPeriod[metric] += amount;

    const entry = {
      id: crypto.randomUUID(),
      productId, metric, amount,
      timestamp: new Date().toISOString()
    };
    this._usageLog.push(entry);
    this.emit('usage:tracked', entry);
    return entry;
  }

  // ─── Subscription Management ─────────────────────────────────────────────
  createSubscription(customerId, productId, tier = 'starter') {
    const product = this._products.get(productId);
    if (!product) throw new Error(`Unknown product: ${productId}`);

    const sub = {
      id: `sub_${crypto.randomUUID().slice(0, 12)}`,
      customerId, productId, tier,
      status: 'active',
      createdAt: new Date().toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
      amount: product.pricing[tier] || product.pricing.perSeatMonth || 0
    };

    this._subscriptions.set(sub.id, sub);
    product.activeSubscriptions++;
    this.emit('subscription:created', sub);
    return sub;
  }

  cancelSubscription(subscriptionId) {
    const sub = this._subscriptions.get(subscriptionId);
    if (!sub) throw new Error(`Unknown subscription: ${subscriptionId}`);
    sub.status = 'cancelled';
    sub.cancelledAt = new Date().toISOString();
    const product = this._products.get(sub.productId);
    if (product) product.activeSubscriptions--;
    this.emit('subscription:cancelled', sub);
    return sub;
  }

  // ─── Revenue Calculations ────────────────────────────────────────────────
  calculateMRR() {
    let mrr = 0;
    for (const sub of this._subscriptions.values()) {
      if (sub.status === 'active') mrr += sub.amount;
    }
    return { mrr, currency: 'USD', calculatedAt: new Date().toISOString() };
  }

  calculateUsageRevenue(periodDays = 30) {
    const cutoff = Date.now() - periodDays * 86400000;
    const periodUsage = this._usageLog.filter(u => new Date(u.timestamp).getTime() > cutoff);
    let totalRevenue = 0;
    const byProduct = {};

    for (const [id, product] of this._products.entries()) {
      if (product.billingModel !== PRICING_TIERS.USAGE_BASED) continue;
      const usage = periodUsage.filter(u => u.productId === id);
      let productRevenue = 0;

      for (const u of usage) {
        if (u.metric === 'pipeline_runs') productRevenue += u.amount * (product.pricing.perPipelineRun || 0);
        if (u.metric === 'vectors_stored') productRevenue += (u.amount / 1e6) * (product.pricing.perMillionVectors || 0);
        if (u.metric === 'queries_executed') productRevenue += (u.amount / 1e3) * (product.pricing.perThousandQueries || 0);
        if (u.metric === 'tokens_routed') productRevenue += (u.amount / 1e6) * (product.pricing.perMillionTokens || 0);
      }

      byProduct[id] = productRevenue;
      totalRevenue += productRevenue;
    }

    return { totalRevenue, byProduct, periodDays, currency: 'USD' };
  }

  // ─── Revenue Forecasting ─────────────────────────────────────────────────
  forecast(months = 12) {
    const mrr = this.calculateMRR().mrr;
    const usageRev = this.calculateUsageRevenue(30).totalRevenue;
    const currentMonthly = mrr + usageRev;

    const projections = [];
    for (let m = 1; m <= months; m++) {
      // Phi-scaled growth: each month grows by PSI^(1/m) factor
      const growthFactor = 1 + (PSI / Math.sqrt(m));
      const projected = currentMonthly * Math.pow(growthFactor, m);
      projections.push({
        month: m,
        projected: Math.round(projected * 100) / 100,
        growthFactor: Math.round(growthFactor * 1000) / 1000,
        cumulative: Math.round(projections.reduce((s, p) => s + p.projected, 0) + projected)
      });
    }

    return {
      currentMonthly,
      projections,
      annualProjected: projections.reduce((s, p) => s + p.projected, 0),
      phiGrowthModel: true
    };
  }

  // ─── Revenue Report ──────────────────────────────────────────────────────
  generateRevenueReport() {
    const mrr = this.calculateMRR();
    const usage = this.calculateUsageRevenue(30);
    const forecast = this.forecast(12);

    return {
      timestamp: new Date().toISOString(),
      products: PRODUCTS.length,
      activeSubscriptions: [...this._subscriptions.values()].filter(s => s.status === 'active').length,
      mrr: mrr.mrr,
      usageRevenue: usage.totalRevenue,
      totalMonthlyRevenue: mrr.mrr + usage.totalRevenue,
      annualForecast: forecast.annualProjected,
      byProduct: Object.fromEntries(
        [...this._products.entries()].map(([id, p]) => [id, {
          name: p.name,
          billingModel: p.billingModel,
          activeSubscriptions: p.activeSubscriptions,
          usage: p.usageThisPeriod
        }])
      ),
      billingModelBreakdown: {
        [PRICING_TIERS.USAGE_BASED]: PRODUCTS.filter(p => p.billingModel === PRICING_TIERS.USAGE_BASED).length,
        [PRICING_TIERS.SUBSCRIPTION]: PRODUCTS.filter(p => p.billingModel === PRICING_TIERS.SUBSCRIPTION).length,
        [PRICING_TIERS.LICENSING]: PRODUCTS.filter(p => p.billingModel === PRICING_TIERS.LICENSING).length,
        [PRICING_TIERS.PLATFORM_FEE]: PRODUCTS.filter(p => p.billingModel === PRICING_TIERS.PLATFORM_FEE).length,
      },
      phi: PHI
    };
  }

  // ─── Stripe Webhook Handler ──────────────────────────────────────────────
  handleStripeWebhook(event) {
    switch (event.type) {
      case 'invoice.paid': {
        const subId = event.data?.object?.subscription;
        const sub = this._subscriptions.get(subId);
        if (sub) {
          sub.currentPeriodStart = new Date().toISOString();
          sub.currentPeriodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
          this.emit('invoice:paid', { subId, amount: event.data.object.amount_paid });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subId = event.data?.object?.id;
        if (subId) this.cancelSubscription(subId);
        break;
      }
      case 'invoice.payment_failed': {
        this.emit('payment:failed', event.data?.object);
        break;
      }
      default:
        this.emit('webhook:unhandled', event.type);
    }
    return { received: true };
  }
}

module.exports = { RevenueArchitecture, PRODUCTS, PRICING_TIERS };
