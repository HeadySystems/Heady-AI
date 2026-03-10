/**
 * @fileoverview api-gateway — Primary API gateway for all external traffic — auth, routing, rate limiting
 * @module api-gateway
 * @version 4.0.0
 * @port 3366
 * @domain interface
 *
 * Heady™ Latent OS — Sacred Geometry v4.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — All Rights Reserved
 */

'use strict';

const { LiquidNodeBase, CSL_THRESHOLDS, PHI, PSI, PSI2, FIB, fib, phiThreshold, phiBackoff, correlationId } = require('../../shared/liquid-node-base');
const { ServiceMesh, SERVICE_CATALOG, DOMAIN_SWARMS } = require('../../shared/service-mesh');

const mesh = ServiceMesh.instance();

/**
 * Route table mapping external paths to internal services.
 * @type {Object<string, {service: string, path: string}>}
 */
const ROUTE_TABLE = Object.freeze({
  '/api/v1/embed':      { service: 'heady-embed',    path: '/embed' },
  '/api/v1/memory':     { service: 'heady-memory',   path: '/store' },
  '/api/v1/search':     { service: 'heady-memory',   path: '/search' },
  '/api/v1/dispatch':   { service: 'heady-conductor', path: '/dispatch' },
  '/api/v1/validate':   { service: 'heady-soul',     path: '/validate' },
  '/api/v1/coherence':  { service: 'heady-soul',     path: '/coherence' },
  '/api/v1/bees/spawn': { service: 'heady-bee-factory', path: '/spawn' },
  '/api/v1/bees/types': { service: 'heady-bee-factory', path: '/types' },
  '/api/v1/gpu/embed':  { service: 'colab-gateway',  path: '/embed' },
  '/api/v1/gpu/infer':  { service: 'colab-gateway',  path: '/infer' },
  '/api/v1/gpu/cluster':{ service: 'colab-gateway',  path: '/cluster' },
  '/api/v1/auto-success':{ service: 'auto-success-engine', path: '/run' },
  '/api/v1/pipeline':   { service: 'hcfullpipeline-executor', path: '/execute' },
  '/api/v1/buddy/chat': { service: 'heady-buddy',    path: '/chat' },
  '/api/v1/swarms':     { service: 'heady-conductor', path: '/swarms' },
});

let totalRequests = 0;
let proxyErrors = 0;

class ApiGateway extends LiquidNodeBase {
  constructor() {
    super({
      name: 'api-gateway',
      port: 3366,
      domain: 'interface',
      description: 'Primary API gateway for all external traffic',
      pool: 'hot',
      dependencies: ['heady-conductor', 'heady-security', 'auth-session-server'],
    });
  }

  async onStart() {
    // GET /api/v1/routes — list all routes
    this.route('GET', '/api/v1/routes', async (req, res, ctx) => {
      this.json(res, 200, {
        routes: Object.entries(ROUTE_TABLE).map(([path, target]) => ({
          path,
          service: target.service,
          internalPath: target.path,
        })),
        count: Object.keys(ROUTE_TABLE).length,
      });
    });

    // GET /api/v1/services — list all services with health
    this.route('GET', '/api/v1/services', async (req, res, ctx) => {
      const services = [];
      for (const [name, info] of Object.entries(SERVICE_CATALOG)) {
        const resolved = mesh.discovery.resolve(name);
        services.push({
          name,
          domain: info.domain,
          pool: info.pool,
          port: info.port,
          description: info.description,
          reachable: !!resolved,
        });
      }
      this.json(res, 200, { count: services.length, services });
    });

    // GET /api/v1/system — system-wide status
    this.route('GET', '/api/v1/system', async (req, res, ctx) => {
      this.json(res, 200, {
        system: 'Heady Latent OS',
        version: '4.0.0',
        codename: 'Sacred Genesis',
        founder: 'Eric Haywood',
        organization: 'HeadySystems Inc.',
        services: Object.keys(SERVICE_CATALOG).length,
        swarms: Object.keys(DOMAIN_SWARMS).length,
        patents: 51,
        phi: PHI,
        totalRequests,
        proxyErrors,
      });
    });

    // Dynamic proxy for all /api/v1/* routes not explicitly handled
    for (const [path, target] of Object.entries(ROUTE_TABLE)) {
      const method = path.includes('embed') || path.includes('search') || path.includes('spawn') || path.includes('dispatch') || path.includes('validate') || path.includes('auto-success') || path.includes('pipeline') || path.includes('chat') || path.includes('infer')
        ? 'POST' : 'GET';

      this.route(method, path, async (req, res, ctx) => {
        totalRequests++;
        try {
          const result = await this.callService(target.service, target.path, {
            method: ctx.method,
            body: ctx.body,
            headers: { 'X-Correlation-ID': ctx.correlationId, 'X-Gateway': 'api-gateway' },
          });
          this.json(res, 200, result);
        } catch (err) {
          proxyErrors++;
          this.log.error('Proxy error', { target: target.service, path: target.path, error: err.message });
          this.sendError(res, 502, `Upstream error: ${target.service}`, 'PROXY_ERROR');
        }
      });
    }

    this.log.info('ApiGateway initialized', { routes: Object.keys(ROUTE_TABLE).length });
  }
}

new ApiGateway().start();
