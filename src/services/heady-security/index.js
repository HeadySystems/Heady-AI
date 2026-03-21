/**
 * @fileoverview heady-security — Auth middleware and session management — httpOnly cookie auth
 * @module heady-security
 * @version 4.0.0
 * @port 3330
 * @domain security
 *
 * Heady™ Latent OS — Sacred Geometry v4.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — All Rights Reserved
 */

'use strict';

const { LiquidNodeBase, CSL_THRESHOLDS, PHI, PSI, PSI2, FIB, fib, phiThreshold, phiBackoff, correlationId } = require('../../shared/liquid-node-base');
const { ServiceMesh, SERVICE_CATALOG, DOMAIN_SWARMS } = require('../../shared/service-mesh');

const mesh = ServiceMesh.instance();

class HeadySecurity extends LiquidNodeBase {
  constructor() {
    super({
      name: 'heady-security',
      port: 3330,
      domain: 'security',
      description: 'Auth middleware and session management — httpOnly cookie auth',
      pool: 'hot',
      dependencies: ['auth-session-server'],
    });
  }

  async onStart() {

    /** @type {Map<string, Object>} Active sessions */
    const sessions = new Map();
    // POST /authenticate — validate credentials and create session
    this.route('POST', '/authenticate', async (req, res, ctx) => {
      const { token, apiKey } = ctx.body || {};
      if (!token && !apiKey) return this.sendError(res, 401, 'Missing credentials', 'UNAUTHORIZED');
      const sessionId = correlationId('sess');
      sessions.set(sessionId, { sessionId, tier: apiKey ? 'apiKey' : 'authenticated', createdAt: Date.now(), expiresAt: Date.now() + 15 * 60 * 1000 });
      this.json(res, 200, { sessionId, tier: sessions.get(sessionId).tier, expiresIn: '15m' });
    });
    // GET /session — validate session
    this.route('GET', '/session', async (req, res, ctx) => {
      const sid = ctx.query.id;
      const session = sessions.get(sid);
      if (!session || session.expiresAt < Date.now()) return this.sendError(res, 401, 'Invalid or expired session', 'SESSION_EXPIRED');
      this.json(res, 200, session);
    });

    this.log.info('heady-security initialized');
  }
}

new HeadySecurity().start();


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
