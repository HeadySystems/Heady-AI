/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  HEADY_BRAND: HeadySystems Inc.                                   ║
 * ║  Cloudflare Worker — Liquid Site Delivery Protocol v4             ║
 * ║  Node: CONDUCTOR (Orchestrator)                                   ║
 * ║  Routes 12 domains → correct site projections from R2             ║
 * ║  Law 3: Zero localhost — Worker + R2 only                        ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.replace('www.', '');

    // ── CORS Preflight (prevents 405 on OPTIONS) ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // ── Health check endpoints (prevents 405/503 from missing routes) ──
    if (url.pathname === '/health' || url.pathname === '/api/health' || url.pathname === '/health/live') {
      return new Response(JSON.stringify({ status: 'ok', site: host, timestamp: new Date().toISOString() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── Domain Aliases (non-canonical → canonical) ──
    const DOMAIN_ALIASES = {
      'headybuddy.org':  'headybuddy.org',
    };
    const resolvedHost = DOMAIN_ALIASES[host] || host;

    // ── Domain → Site File Routing ──
    const ROUTES = {
      'headysystems.com':    'sites/headysystems.html',
      'headyme.com':         'sites/headyme.html',
      'headybuddy.org':      'sites/headybuddy.html',
      'headymcp.com':        'sites/headymcp.html',
      'headyio.com':         'sites/headyio.html',
      'headybot.com':        'sites/headybot.html',
      'headyapi.com':        'sites/headyapi.html',
      'headylens.com':       'sites/headylens.html',
      'heady-ai.com':        'sites/headyai.html',
      'headyfinance.com':    'sites/headyfinance.html',
      'headyconnection.org': 'sites/headyconnection.html',
      'headyconnection.com': 'sites/headyconnection.html',
      '1ime1.com':           'sites/admin-1ime1.html',
    };

    // ── Shared assets ──
    if (url.pathname.startsWith('/shared/')) {
      const key = url.pathname.slice(1); // "shared/buddy-embed.js"
      const obj = await env.HEADY_SITES.get(key);
      if (obj) {
        return new Response(obj.body, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': origin || 'https://headysystems.com',
          }
        });
      }
    }

    // ── Route to site ──
    const siteFile = ROUTES[resolvedHost] || 'sites/headysystems.html';
    const obj = await env.HEADY_SITES.get(siteFile);

    if (!obj) {
      return new Response('Site not found', { status: 404 });
    }

    return new Response(obj.body, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Heady-Site': resolvedHost,
        'X-Heady-Architecture': 'Liquid-v9.0',
        'X-Heady-Node': 'CONDUCTOR',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      }
    });
  }
};
