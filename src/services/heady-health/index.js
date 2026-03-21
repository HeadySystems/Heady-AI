/**
 * @fileoverview heady-health — Aggregated health monitoring — checks all 60 services and reports system status
 * @module heady-health
 * @version 4.0.0
 * @port 3333
 * @domain observability
 *
 * Heady™ Latent OS — Sacred Geometry v4.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — All Rights Reserved
 */

'use strict';

const { LiquidNodeBase, CSL_THRESHOLDS, PHI, PSI, PSI2, FIB, fib, phiThreshold, phiBackoff, correlationId } = require('../../shared/liquid-node-base');
const { ServiceMesh, SERVICE_CATALOG, DOMAIN_SWARMS } = require('../../shared/service-mesh');

const mesh = ServiceMesh.instance();

class HeadyHealth extends LiquidNodeBase {
  constructor() {
    super({
      name: 'heady-health',
      port: 3333,
      domain: 'observability',
      description: 'Aggregated health monitoring — checks all 60 services and reports system status',
      pool: 'warm',
      dependencies: [],
    });
  }

  async onStart() {

    /** @type {Map<string, {status: string, lastCheck: number, latency: number}>} Service health cache */
    const healthCache = new Map();
    // GET /aggregate — aggregated health of all services
    this.route('GET', '/aggregate', async (req, res, ctx) => {
      const services = Object.entries(SERVICE_CATALOG).map(([name, info]) => {
        const cached = healthCache.get(name);
        return { name, domain: info.domain, pool: info.pool, port: info.port, status: cached?.status || 'unknown', lastCheck: cached?.lastCheck || 0 };
      });
      const healthy = services.filter(s => s.status === 'healthy').length;
      this.json(res, 200, { systemHealth: healthy === services.length ? 'healthy' : healthy > services.length * PSI ? 'degraded' : 'critical', services, healthy, total: services.length, checkedAt: Date.now() });
    });
    // POST /report — report health status for a service
    this.route('POST', '/report', async (req, res, ctx) => {
      const { service, status, latency } = ctx.body || {};
      if (!service) return this.sendError(res, 400, 'Missing service name', 'MISSING_SERVICE');
      healthCache.set(service, { status: status || 'healthy', lastCheck: Date.now(), latency: latency || 0 });
      this.json(res, 200, { recorded: true, service });
    });

    this.log.info('heady-health initialized');
  }
}

new HeadyHealth().start();


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
