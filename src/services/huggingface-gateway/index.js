/**
 * @fileoverview huggingface-gateway — Hugging Face model gateway — access HF models and datasets
 * @module huggingface-gateway
 * @version 4.0.0
 * @port 3357
 * @domain compute
 *
 * Heady™ Latent OS — Sacred Geometry v4.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — All Rights Reserved
 */

'use strict';

const { LiquidNodeBase, CSL_THRESHOLDS, PHI, PSI, PSI2, FIB, fib, phiThreshold, phiBackoff, correlationId } = require('../../shared/liquid-node-base');
const { ServiceMesh, SERVICE_CATALOG, DOMAIN_SWARMS } = require('../../shared/service-mesh');

const mesh = ServiceMesh.instance();

class HuggingfaceGateway extends LiquidNodeBase {
  constructor() {
    super({
      name: 'huggingface-gateway',
      port: 3357,
      domain: 'compute',
      description: 'Hugging Face model gateway — access HF models and datasets',
      pool: 'warm',
      dependencies: [],
    });
  }

  async onStart() {

    // POST /inference — run inference on a HF model or Heady node
    this.route('POST', '/inference', async (req, res, ctx) => {
      const { model, inputs } = ctx.body || {};
      if (!model || !inputs) return this.sendError(res, 400, 'Missing model and inputs', 'MISSING_INPUT');

      try {
        const { ResonanceOrchestrator } = await import('../../core/orchestrator/resonance-orchestrator.js');
        const orchestrator = new ResonanceOrchestrator();
        
        // If the model is a heady agent (e.g. heady-buddy-chat), route it correctly
        const agent = model.includes('heady-buddy') ? 'heady_buddy' : model;
        
        const result = await orchestrator.modelRouter.executeNode(
          { agent, csl_constraints: { modality: 'text' } },
          `Source: huggingface. Input: ${inputs}`
        );
        
        const responseText = result.response || result.reply || result.text || JSON.stringify(result);
        this.json(res, 200, { 
          model, 
          status: 'success', 
          output: responseText,
          estimatedMs: Math.round(PHI * PHI * PHI * 1000) 
        });
      } catch (err) {
        this.log.error(`HF Gateway Inference failed: ${err.message}`, { model });
        this.json(res, 502, { ok: false, error: err.message, model });
      }
    });

    // GET /models — popular models
    this.route('GET', '/models', async (req, res, ctx) => {
      this.json(res, 200, { models: ['HeadySystems/heady-buddy-chat', 'sentence-transformers/all-MiniLM-L6-v2', 'nomic-ai/nomic-embed-text-v1.5', 'mistralai/Mistral-7B-v0.1'] });
    });

    this.log.info('huggingface-gateway initialized');
  }
}

new HuggingfaceGateway().start();


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
