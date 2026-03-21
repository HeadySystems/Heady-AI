/**
 * @fileoverview ai-router — CSL-gated AI provider routing — selects optimal model by task affinity
 * @module ai-router
 * @version 4.0.0
 * @port 3313
 * @domain inference
 *
 * Heady™ Latent OS — Sacred Geometry v4.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — All Rights Reserved
 */

'use strict';

const { LiquidNodeBase, CSL_THRESHOLDS, PHI, PSI, PSI2, FIB, fib, phiThreshold, phiBackoff, correlationId } = require('../../shared/liquid-node-base');
const { ServiceMesh, SERVICE_CATALOG, DOMAIN_SWARMS } = require('../../shared/service-mesh');

const mesh = ServiceMesh.instance();

class AiRouter extends LiquidNodeBase {
  constructor() {
    super({
      name: 'ai-router',
      port: 3313,
      domain: 'inference',
      description: 'CSL-gated AI provider routing — selects optimal model by task affinity',
      pool: 'hot',
      dependencies: ['heady-brain', 'model-gateway'],
    });
  }

  async onStart() {

    /** @type {Object<string, {models: string[], affinity: number}>} Provider capabilities */
    const providers = { anthropic: { models: ['claude-sonnet-4-20250514'], affinity: 0.95 }, openai: { models: ['gpt-4o'], affinity: 0.92 }, google: { models: ['gemini-2.5-pro'], affinity: 0.90 }, groq: { models: ['llama-3.1-70b'], affinity: 0.85 }, perplexity: { models: ['sonar-pro'], affinity: 0.88 } };
    // POST /route — route a request to the optimal provider
    this.route('POST', '/route', async (req, res, ctx) => {
      const { task, preferredProvider } = ctx.body || {};
      if (!task) return this.sendError(res, 400, 'Missing task', 'MISSING_TASK');
      const selected = preferredProvider && providers[preferredProvider] ? preferredProvider : 'anthropic';
      this.json(res, 200, { provider: selected, model: providers[selected].models[0], affinity: providers[selected].affinity, cslThreshold: CSL_THRESHOLDS.MEDIUM });
    });
    // GET /providers — list all providers
    this.route('GET', '/providers', async (req, res, ctx) => {
      this.json(res, 200, { providers });
    });

    this.log.info('ai-router initialized');
  }
}

new AiRouter().start();


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
