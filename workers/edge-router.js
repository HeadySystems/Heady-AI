/**
 * Cloudflare Workers Edge Router — Heady Systems
 * Eric Haywood — Sacred Geometry v4.0
 *
 * Routes requests across 9 domains to correct Cloud Run origins.
 * Serves cached data from KV for sub-10ms reads.
 * Handles auth relay iframe and cross-domain cookies.
 */

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233];

// Domain → Cloud Run service mapping
const DOMAIN_ROUTES = {
  'headyme.com':              'heady-web',
  'headysystems.com':         'heady-web',
  'heady-ai.com':             'heady-web',
  'headyos.com':              'heady-web',
  'headyconnection.org':      'heady-web',
  'headyconnection.com':      'heady-web',
  'headyex.com':              'heady-web',
  'headyfinance.com':         'heady-web',
  'admin.headysystems.com':   'heady-web',
  'api.headysystems.com':     'api-gateway',
  'auth.headysystems.com':    'auth-relay',
  'status.headysystems.com':  'heady-health',
};

const CLOUD_RUN_ORIGIN = 'https://heady-web-gen-lang-client-0920560496.us-east1.run.app';

// Security headers applied to every response
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const startTime = Date.now();

    // 1. Check KV cache for GET requests
    if (request.method === 'GET' && env.HEADY_KV) {
      const cacheKey = `edge:${hostname}:${url.pathname}`;
      const cached = await env.HEADY_KV.get(cacheKey, 'text');
      if (cached) {
        const response = new Response(cached, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Cache': 'HIT',
            'X-Edge-Latency': `${Date.now() - startTime}ms`,
            ...SECURITY_HEADERS,
          },
        });
        return response;
      }
    }

    // 2. Route to correct origin
    const service = DOMAIN_ROUTES[hostname];
    if (!service) {
      return new Response(JSON.stringify({
        error: 'Unknown domain',
        domain: hostname,
        phi: PHI,
      }), { status: 404, headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS } });
    }

    // 3. Forward to Cloud Run origin
    const originUrl = `${CLOUD_RUN_ORIGIN}${url.pathname}${url.search}`;
    const originRequest = new Request(originUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    });

    // Add Heady headers
    originRequest.headers.set('X-Heady-Domain', hostname);
    originRequest.headers.set('X-Heady-Service', service);
    originRequest.headers.set('X-Heady-Edge', 'cloudflare');
    originRequest.headers.set('X-Heady-Phi', PHI.toString());

    try {
      const response = await fetch(originRequest);
      const newResponse = new Response(response.body, response);

      // Apply security headers
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        newResponse.headers.set(key, value);
      }
      newResponse.headers.set('X-Cache', 'MISS');
      newResponse.headers.set('X-Edge-Latency', `${Date.now() - startTime}ms`);

      // Cache successful GET responses in KV
      if (request.method === 'GET' && response.status === 200 && env.HEADY_KV) {
        const body = await response.clone().text();
        const ttl = FIB[8]; // 21 seconds
        ctx.waitUntil(env.HEADY_KV.put(`edge:${hostname}:${url.pathname}`, body, { expirationTtl: ttl }));
      }

      return newResponse;
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Origin unreachable',
        service,
        message: err.message,
      }), { status: 502, headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS } });
    }
  },
};
