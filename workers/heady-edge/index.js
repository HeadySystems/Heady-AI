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
// ║  FILE: workers/heady-edge/index.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Edge Proxy — Cloudflare Worker
 * Mesh routing, KV caching, circuit breaker logic at the edge.
 */

const ORIGIN = 'https://heady-manager-xxxx.run.app';
const CACHE_TTL = 300; // 5 minutes

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health bypass
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ edge: 'healthy', ts: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Auth check
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    // KV cache for GET requests
    if (request.method === 'GET') {
      const cacheKey = `cache:${url.pathname}`;
      const cached = await env.HEADY_KV.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        });
      }
    }

    // Forward to origin
    const response = await fetch(`${ORIGIN}${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' ? request.body : undefined,
    });

    // Cache successful GETs
    if (request.method === 'GET' && response.ok) {
      const body = await response.text();
      await env.HEADY_KV.put(`cache:${url.pathname}`, body, { expirationTtl: CACHE_TTL });
      return new Response(body, {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      });
    }

    return response;
  },
};
