/**
 * HEADY_BRAND:BEGIN
 * Liquid Mesh Edge Worker — Cloudflare Workers
 * Routes requests to HeadyMC, HeadySims, HeadyBattle via edge
 * HEADY_BRAND:END
 */

const PHI = 1.618033988749895;

// Service routing map
const SERVICES = {
  'mc.headysystems.com':    { upstream: 'HEADY_MC_URL',    port: 3340, tier: 'warm' },
  'sims.headysystems.com':  { upstream: 'HEADY_SIMS_URL',  port: 3341, tier: 'warm' },
  'battle.headysystems.com':{ upstream: 'HEADY_BATTLE_URL', port: 3325, tier: 'warm' },
  'api.headysystems.com':   { upstream: 'HEADY_MANAGER_URL',port: 3300, tier: 'hot' },
  'brain.headysystems.com': { upstream: 'HEADY_BRAIN_URL',  port: 3311, tier: 'hot' },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Find matching service
    const service = SERVICES[hostname];
    if (!service) {
      return new Response(JSON.stringify({
        error: 'Unknown service',
        hostname,
        phi: PHI,
        available: Object.keys(SERVICES),
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Get upstream URL from environment
    const upstreamUrl = env[service.upstream];
    if (!upstreamUrl) {
      return new Response(JSON.stringify({
        error: `Upstream not configured: ${service.upstream}`,
        service: hostname,
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }

    // Forward request to upstream
    const upstreamRequest = new Request(`${upstreamUrl}${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // Add Heady edge headers
    upstreamRequest.headers.set('X-Heady-Edge', 'cloudflare');
    upstreamRequest.headers.set('X-Heady-Service', hostname);
    upstreamRequest.headers.set('X-Heady-Tier', service.tier);
    upstreamRequest.headers.set('X-Heady-Phi', String(PHI));

    try {
      const response = await fetch(upstreamRequest);

      // Clone response with edge headers
      const headers = new Headers(response.headers);
      headers.set('X-Heady-Edge-Cached', 'false');
      headers.set('X-Heady-Service-Tier', service.tier);

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Upstream unavailable',
        service: hostname,
        tier: service.tier,
        message: err.message,
      }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
  },
};
