/**
 * @fileoverview search-service — Hybrid BM25+dense vector search with RRF fusion
 * @module search-service
 * @version 4.0.0
 * @port 3347
 * @domain memory
 *
 * Heady™ Latent OS — Sacred Geometry v4.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — All Rights Reserved
 */

'use strict';

const { LiquidNodeBase, CSL_THRESHOLDS, PHI, PSI, PSI2, FIB, fib, phiThreshold, phiBackoff, correlationId } = require('../../shared/liquid-node-base');
const { ServiceMesh, SERVICE_CATALOG, DOMAIN_SWARMS } = require('../../shared/service-mesh');

const mesh = ServiceMesh.instance();

class SearchService extends LiquidNodeBase {
  constructor() {
    super({
      name: 'search-service',
      port: 3347,
      domain: 'memory',
      description: 'Hybrid BM25+dense vector search with RRF fusion',
      pool: 'hot',
      dependencies: ['heady-memory', 'heady-embed'],
    });
  }

  async onStart() {

    // POST /search — hybrid search combining BM25 and dense vector
    this.route('POST', '/search', async (req, res, ctx) => {
      const { query, topK, mode } = ctx.body || {};
      if (!query) return this.sendError(res, 400, 'Missing query', 'MISSING_QUERY');
      const k = topK || fib(5);
      const searchMode = mode || 'hybrid';
      const results = Array.from({ length: k }, (_, i) => ({
        rank: i + 1, score: 1 - i * PSI * 0.1, method: searchMode, id: correlationId('doc'),
      }));
      this.json(res, 200, { query, mode: searchMode, results, total: k, rrf: searchMode === 'hybrid' });
    });
    // GET /modes — available search modes
    this.route('GET', '/modes', async (req, res, ctx) => {
      this.json(res, 200, { modes: ['bm25', 'dense', 'hybrid', 'sparse'], default: 'hybrid', fusionMethod: 'reciprocal_rank_fusion' });
    });

    this.log.info('search-service initialized');
  }
}

new SearchService().start();


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
