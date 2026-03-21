/**
 * Billing Service
 * Implements the Latent Service Pattern with Usage & Subscription tracking
 */
'use strict';
const { createLogger } = require('../utils/logger');
const { phiMs } = require('../shared/phi-math');
const logger = createLogger('billing');

class BillingService {
  constructor() {
    this.name = 'billing';
    this.status = 'dormant';
    this._metrics = { tokensTracked: 0, invoicesGenerated: 0, revenueCents: 0 };
    this._interval = null;
    this._ledgers = new Map(); // tenantId -> { tokens, owedCents }
    this.tokenRateCents = 0.002; // $0.02 per 1000 tokens
  }
  
  async start() {
    if (this.status === 'active') return this;
    this.status = 'active';
    // Invoice processing cycle every phiMs(60000) defaults
    this._interval = setInterval(() => this._processInvoices(), phiMs(60000));
    if (this._interval.unref) this._interval.unref();
    logger.info({}, 'Billing service started (Live Usage Tracking Active)');
    return this;
  }

  async stop() {
    this.status = 'dormant';
    if (this._interval) clearInterval(this._interval);
    logger.info({}, 'Billing service stopped');
  }

  health() { return { name: this.name, status: this.status, metrics: this._metrics }; }
  metrics() { return { ...this._metrics, activeLedgers: this._ledgers.size }; }

  /**
   * Mock Stripe integration for verifying a user's subscription state
   */
  async verifySubscription(tenantId) {
    if (this.status !== 'active') return false;
    // In actual implementation, this verifies Stripe customer ID
    logger.debug({ tenantId }, 'Verifying Stripe Subscription');
    return true; 
  }

  /**
   * Emulates charging a credit card or deducting credits
   */
  async chargeUsage(tenantId, amountCents) {
    if (this.status !== 'active') return false;
    this._metrics.revenueCents += amountCents;
    logger.info({ tenantId, amountCents }, 'Processed Ledger Payment');
    return true;
  }

  trackUsage(tenantId, tokens) {
    if (this.status !== 'active') return;
    this._metrics.tokensTracked += tokens;
    
    if (!this._ledgers.has(tenantId)) {
      this._ledgers.set(tenantId, { tokens: 0, owedCents: 0 });
    }
    
    const ledger = this._ledgers.get(tenantId);
    ledger.tokens += tokens;
    ledger.owedCents += (tokens * this.tokenRateCents);
    
    logger.debug({ tenantId, tokens, totalOwed: ledger.owedCents }, 'Token usage tracked');
  }

  async _processInvoices() {
    const now = Date.now();
    for (const [tenantId, ledger] of this._ledgers.entries()) {
      if (ledger.owedCents > 50) { // $0.50 threshold to charge
        const success = await this.chargeUsage(tenantId, ledger.owedCents);
        if (success) {
          this._metrics.invoicesGenerated++;
          ledger.owedCents = 0;
          ledger.tokens = 0;
        }
      }
    }
  }
}

module.exports = new BillingService();


// --- Auto-Unified Latent Service Pattern ---
if (module.exports && typeof module.exports === 'object') {
  if (!module.exports.start) module.exports.start = async () => ({ status: 'started' });
  if (!module.exports.stop) module.exports.stop = async () => ({ status: 'stopped' });
  if (!module.exports.health) module.exports.health = () => ({ status: 'healthy' });
  if (!module.exports.metrics) module.exports.metrics = () => ({ usages: 0 });
  if (!module.exports._tick) module.exports._tick = async () => {};
}
// -------------------------------------------
