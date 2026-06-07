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
// ║  FILE: src/services/billing-service/src/plans.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

/**
 * Heady subscription plans with Fibonacci-based API call limits.
 *
 * FIB[9]  = 34  → Explorer (free tier)
 * FIB[11] = 89  → Builder (paid tier)
 * FIB[13] = 233 → Enterprise (custom tier)
 */
const PLANS = {
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Free tier for exploration and evaluation',
    priceId: null, // free
    monthlyPriceCents: 0,
    apiCallsPerDay: 34,
    apiCallsPerMin: 34,
    features: {
      vectorSearch: true,
      customAgents: false,
      prioritySupport: false,
      analytics: false,
      webhooks: false,
      sso: false,
      maxNamespaces: 1,
      maxVectorDimensions: 384,
      maxStorageMB: 100,
    },
  },
  builder: {
    id: 'builder',
    name: 'Builder',
    description: 'For developers and small teams building with Heady',
    priceId: process.env.STRIPE_BUILDER_PRICE_ID || null,
    monthlyPriceCents: 2900,
    apiCallsPerDay: 89,
    apiCallsPerMin: 89,
    features: {
      vectorSearch: true,
      customAgents: true,
      prioritySupport: false,
      analytics: true,
      webhooks: true,
      sso: false,
      maxNamespaces: 5,
      maxVectorDimensions: 384,
      maxStorageMB: 1000,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom plan for organizations with advanced needs',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
    monthlyPriceCents: null, // custom pricing
    apiCallsPerDay: 233,
    apiCallsPerMin: 233,
    features: {
      vectorSearch: true,
      customAgents: true,
      prioritySupport: true,
      analytics: true,
      webhooks: true,
      sso: true,
      maxNamespaces: 50,
      maxVectorDimensions: 384,
      maxStorageMB: 10000,
    },
  },
};

/**
 * Get a plan by ID.
 * @param {string} planId
 * @returns {object|undefined}
 */
function getPlan(planId) {
  return PLANS[planId];
}

/**
 * Get all plans as an array.
 * @returns {object[]}
 */
function getAllPlans() {
  return Object.values(PLANS);
}

/**
 * Get the API call limit per day for a plan.
 * @param {string} planId
 * @returns {number}
 */
function getApiLimit(planId) {
  const plan = PLANS[planId];
  return plan ? plan.apiCallsPerDay : PLANS.explorer.apiCallsPerDay;
}

/**
 * Get the rate limit (per minute) for a plan.
 * @param {string} planId
 * @returns {number}
 */
function getRateLimit(planId) {
  const plan = PLANS[planId];
  return plan ? plan.apiCallsPerMin : PLANS.explorer.apiCallsPerMin;
}

/**
 * Check if a feature is available on a given plan.
 * @param {string} planId
 * @param {string} feature
 * @returns {boolean}
 */
function hasFeature(planId, feature) {
  const plan = PLANS[planId];
  if (!plan) return false;
  return !!plan.features[feature];
}

module.exports = {
  PLANS,
  getPlan,
  getAllPlans,
  getApiLimit,
  getRateLimit,
  hasFeature,
};


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
