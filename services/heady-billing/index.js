/**
 * Heady Billing Service — Unified monetization stack.
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * 5 billing models: usage-based, subscription, licensing, platform-fees, consulting.
 * Stripe-ready metering for vectors, pipeline runs, LLM tokens, agent executions.
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BILLING_MODELS = ['usage-based', 'subscription', 'licensing', 'platform-fees', 'consulting'];

const PLANS = {
  free: { id: 'free', name: 'Free', priceMonthly: 0, limits: { vectors: 10000, pipelineRuns: 10, llmTokens: 100000, agentExecutions: 50 } },
  pro: { id: 'pro', name: 'Pro', priceMonthly: 4900, limits: { vectors: 1000000, pipelineRuns: 500, llmTokens: 10000000, agentExecutions: 5000 } },
  enterprise: { id: 'enterprise', name: 'Enterprise', priceMonthly: 49900, limits: { vectors: -1, pipelineRuns: -1, llmTokens: -1, agentExecutions: -1 } },
};

const METERING_RATES = {
  vectors: { unit: '1M vectors stored', pricePerUnit: 500 },        // $5.00 per 1M
  vectorQueries: { unit: '1K queries', pricePerUnit: 10 },          // $0.10 per 1K
  pipelineRuns: { unit: 'per run', pricePerUnit: 25 },              // $0.25 per run
  llmTokens: { unit: '1M tokens routed', pricePerUnit: 200 },      // $2.00 per 1M
  agentExecutions: { unit: 'per execution', pricePerUnit: 5 },      // $0.05 per exec
};

class MeteringEngine {
  constructor() { this._usage = new Map(); }
  record(tenantId, metric, quantity) {
    const key = `${tenantId}:${metric}`;
    const current = this._usage.get(key) || { total: 0, periodStart: new Date().toISOString(), records: [] };
    current.total += quantity;
    current.records.push({ quantity, timestamp: new Date().toISOString() });
    if (current.records.length > 1000) current.records = current.records.slice(-500);
    this._usage.set(key, current);
    return current.total;
  }
  getUsage(tenantId, metric) {
    return this._usage.get(`${tenantId}:${metric}`) || { total: 0, records: [] };
  }
  computeCharges(tenantId) {
    const charges = {};
    for (const [metric, rate] of Object.entries(METERING_RATES)) {
      const usage = this.getUsage(tenantId, metric);
      let units = usage.total;
      if (metric === 'vectors') units = units / 1000000;
      else if (metric === 'vectorQueries') units = units / 1000;
      else if (metric === 'llmTokens') units = units / 1000000;
      charges[metric] = { units: Math.ceil(units), ratePerUnit: rate.pricePerUnit, total: Math.ceil(units) * rate.pricePerUnit };
    }
    return charges;
  }
  resetPeriod(tenantId) {
    for (const metric of Object.keys(METERING_RATES)) {
      this._usage.delete(`${tenantId}:${metric}`);
    }
  }
}

class SubscriptionManager {
  constructor() { this._subscriptions = new Map(); }
  create(tenantId, planId) {
    const plan = PLANS[planId];
    if (!plan) throw new Error(`Unknown plan: ${planId}`);
    const sub = {
      id: crypto.randomUUID(), tenantId, planId, plan,
      status: 'active', createdAt: new Date().toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    };
    this._subscriptions.set(tenantId, sub);
    return sub;
  }
  get(tenantId) { return this._subscriptions.get(tenantId); }
  cancel(tenantId) {
    const sub = this._subscriptions.get(tenantId);
    if (sub) { sub.status = 'cancelled'; sub.cancelledAt = new Date().toISOString(); }
    return sub;
  }
  upgrade(tenantId, newPlanId) {
    const sub = this._subscriptions.get(tenantId);
    if (!sub) return this.create(tenantId, newPlanId);
    sub.planId = newPlanId; sub.plan = PLANS[newPlanId]; sub.upgradedAt = new Date().toISOString();
    return sub;
  }
}

class InvoiceGenerator {
  constructor(metering, subscriptions) { this._metering = metering; this._subscriptions = subscriptions; this._invoices = []; }
  generate(tenantId) {
    const sub = this._subscriptions.get(tenantId);
    const charges = this._metering.computeCharges(tenantId);
    const usageTotal = Object.values(charges).reduce((s, c) => s + c.total, 0);
    const subscriptionTotal = sub ? sub.plan.priceMonthly : 0;
    const invoice = {
      id: `INV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      tenantId, createdAt: new Date().toISOString(),
      subscription: sub ? { plan: sub.planId, amount: subscriptionTotal } : null,
      usage: charges, usageTotal, subscriptionTotal,
      grandTotal: subscriptionTotal + usageTotal,
      currency: 'USD', status: 'pending',
    };
    this._invoices.push(invoice);
    return invoice;
  }
  getInvoices(tenantId) { return this._invoices.filter(i => i.tenantId === tenantId); }
}

class RevenueReporter {
  constructor(invoiceGen) { this._invoices = invoiceGen; }
  mrr() {
    const activeInvoices = this._invoices._invoices.filter(i => i.status !== 'void');
    return activeInvoices.reduce((s, i) => s + (i.subscriptionTotal || 0), 0);
  }
  arr() { return this.mrr() * 12; }
  report() {
    return { mrr: this.mrr(), arr: this.arr(), totalInvoices: this._invoices._invoices.length,
      totalRevenue: this._invoices._invoices.reduce((s, i) => s + i.grandTotal, 0) };
  }
}

class BillingService {
  constructor() {
    this.metering = new MeteringEngine();
    this.subscriptions = new SubscriptionManager();
    this.invoices = new InvoiceGenerator(this.metering, this.subscriptions);
    this.revenue = new RevenueReporter(this.invoices);
  }
  health() {
    return {
      service: 'heady-billing', plans: Object.keys(PLANS),
      billingModels: BILLING_MODELS, meterableMetrics: Object.keys(METERING_RATES),
      revenue: this.revenue.report(),
    };
  }
}

module.exports = { BillingService, MeteringEngine, SubscriptionManager, InvoiceGenerator, RevenueReporter, PLANS, METERING_RATES };
