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
// ║  FILE: src/services/gateway/index.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Gateway Service — Edge Entrypoint for Heady Latent OS
 * @module services/gateway
 */
'use strict';
const express = require('express');
const logger = require('../../utils/logger');
const crypto = require('crypto');

class GatewayService {
  constructor() {
    this.name = 'gateway-service';
    this.status = 'dormant';
    this.app = express();
    this.server = null;
    this.port = process.env.GATEWAY_PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    // Trace ID injection for Latent OS observability
    this.app.use((req, res, next) => {
      req.traceId = req.headers['x-trace-id'] || crypto.randomUUID();
      res.setHeader('x-trace-id', req.traceId);
      next();
    });

    // 1. Observability and correlation context
    let headyContextModule;
    try {
      headyContextModule = require('../../../middleware').headyAutoContext;
    } catch (e) {
      logger.warn('Could not load observability middleware: ' + e.message);
    }
    
    if (headyContextModule) {
      const HeadyAutoContextClass = headyContextModule.default || headyContextModule.HeadyAutoContext;
      if (HeadyAutoContextClass) {
        const observabilityCtx = new HeadyAutoContextClass({ serviceName: this.name });
        this.app.use(observabilityCtx.middleware());
      }
    }

    // 2. Semantic vector-memory context enrichment
    try {
      const { getAutoContext } = require('../heady-auto-context');
      const autoContext = getAutoContext({ workspaceRoot: process.cwd(), serviceName: this.name });
      if (autoContext && typeof autoContext.createExpressMiddleware === 'function') {
        this.app.use(autoContext.createExpressMiddleware());
        logger.info('Wired HeadyAutoContext vector enrichment into Gateway');
      }
    } catch (err) {
      logger.warn('Could not wire Vector HeadyAutoContext into Gateway: ' + err.message);
    }
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.status(200).json(this.health());
    });
    
    // Dynamic Swarm routing interceptor
    this.app.use('/api/swarm/:swarmName', (req, res) => {
      res.status(202).json({
        message: `Request routed to ${req.params.swarmName}`,
        traceId: req.traceId
      });
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          this.status = 'active';
          logger.info({ port: this.port }, 'Gateway Service Edge listening');
          resolve();
        });
      } catch (err) {
        logger.error({ err }, 'Failed to start Gateway Service');
        reject(err);
      }
    });
  }

  async stop() {
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }
    this.status = 'dormant';
    logger.info({}, 'Gateway Service stopped');
  }

  health() {
    return { status: this.status, port: this.port };
  }
}

module.exports = { GatewayService, gateway: new GatewayService() };


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
