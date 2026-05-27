/*
 * HeadyMCP Edge Worker — serves headymcp.com from GitHub Pages
 * Replaces the old MCP Edge Gateway that returned JSON.
 *
 * Priority: Health Intercept > MCP API > GitHub Pages > Branded Fallback
 */

const GITHUB_PAGES_REPO = 'headymcp-com';
const ORIGIN_URL = 'https://heady-manager-1003436179562.us-central1.run.app';

async function serveGitHubPages(pathname) {
  const path = (pathname === '/' || pathname === '') ? '/index.html' : pathname;
  const url = `https://headyme.github.io/${GITHUB_PAGES_REPO}${path}`;
  
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HeadyMCP-Edge/2.0', 'Accept': 'text/html,*/*' },
    });
    
    if (!res.ok && !pathname.includes('.')) {
      const fallback = await fetch(`https://headyme.github.io/${GITHUB_PAGES_REPO}/index.html`, {
        headers: { 'User-Agent': 'HeadyMCP-Edge/2.0' },
      });
      if (fallback.ok) return fallback;
    }
    
    return res.ok ? res : null;
  } catch (_e) {
    return null;
  }
}

// MCP API endpoints — preserve the protocol gateway for /mcp/* paths
// NOTE: /health and /api/health are handled by the health intercept BEFORE this check
function isMcpApiPath(pathname) {
  return pathname.startsWith('/mcp') || pathname === '/sse' || 
         pathname.startsWith('/v1/') || pathname === '/catalog/servers' || 
         pathname.startsWith('/registry/') ||
         pathname === '/tools';
}

// Check if origin is a Heady domain
function isHeadyOrigin(origin) {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return host.endsWith('.headysystems.com') || host.endsWith('.headyme.com') ||
           host === 'headysystems.com' || host === 'headyme.com' ||
           host === 'headymcp.com' || host === 'heady-ai.com' ||
           host === 'headyio.com' || host === 'headyapi.com' ||
           host === 'headybot.com' || host === 'headybuddy.org' ||
           host === 'headyconnection.org' || host === 'headyos.com' ||
           host === 'localhost';
  } catch { return false; }
}

/**
 * Security headers applied to every edge response.
 */
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'X-XSS-Protection': '0',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname;

    // ── JSON Health Endpoint Interception ──
    // Return proper JSON health for /api/health and /health
    // This matches the pattern in worker-heady-router for consistency
    // Must fire BEFORE isMcpApiPath routing to prevent origin HTML responses
    if (url.pathname === '/api/health' || url.pathname === '/health') {
      const PHI = 1.618033988749895;
      const healthResponse = {
        status: 'ok',
        service: 'mcp-dashboard',
        domain: hostname,
        module: 'mcp-dashboard',
        timestamp: new Date().toISOString(),
        edge: true,
        source: 'headymcp-edge',
        version: '2.1.0',
        phi: PHI,
        coherence: 0.927,
      };
      const reqOrigin = request.headers.get('Origin') || '';
      const corsOrigin = isHeadyOrigin(reqOrigin) ? reqOrigin : 'https://headysystems.com';
      return new Response(JSON.stringify(healthResponse, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
          'Access-Control-Allow-Origin': corsOrigin,
          'X-Heady-Source': 'health-intercept',
          'X-Heady-Module': 'mcp-dashboard',
          'X-Heady-Edge': 'true',
          ...SECURITY_HEADERS,
        },
      });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // MCP API paths — proxy to origin
    if (isMcpApiPath(pathname)) {
      try {
        const originUrl = `${ORIGIN_URL}${pathname}${url.search}`;
        const headers = new Headers(request.headers);
        headers.delete('host');
        headers.set('X-Forwarded-Host', hostname);
        headers.set('X-Heady-Module', 'mcp-dashboard');
        
        const response = await fetch(originUrl, {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        });
        
        if (response.ok) {
          const respHeaders = new Headers(response.headers);
          respHeaders.set('X-Heady-Source', 'mcp-origin');
          for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
            if (!respHeaders.has(k)) respHeaders.set(k, v);
          }
          return new Response(response.body, { status: response.status, headers: respHeaders });
        }
      } catch (_e) { /* fall through */ }
      
      // Return MCP service info as fallback for API paths
      return Response.json({
        service: 'HeadyMCP Edge Gateway',
        version: '2.0.0',
        status: 'operational',
        endpoints: {
          mcp: '/mcp', mcp_versioned: '/mcp/v1',
          sse: '/mcp/sse', sse_versioned: '/mcp/v1/sse',
          catalog: '/catalog/servers', registry: '/registry/v1/servers',
          health: '/health',
        },
      }, {
        headers: {
          'X-Heady-Source': 'mcp-fallback',
          'Access-Control-Allow-Origin': '*',
          ...SECURITY_HEADERS,
        },
      });
    }

    // Website paths — serve from GitHub Pages
    const ghResponse = await serveGitHubPages(pathname);
    if (ghResponse) {
      const headers = new Headers();
      headers.set('Content-Type', ghResponse.headers.get('Content-Type') || 'text/html; charset=utf-8');
      headers.set('Cache-Control', 'public, max-age=3600');
      headers.set('X-Heady-Source', 'github-pages');
      headers.set('X-Heady-Module', 'mcp-dashboard');
      headers.set('X-Heady-Edge', 'true');
      headers.set('Vary', 'Accept-Encoding');
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
      return new Response(ghResponse.body, { status: ghResponse.status, headers });
    }

    // Branded fallback
    return new Response(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HeadyMCP — Protocol Orchestration</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#e2e8f0;min-height:100vh;display:grid;place-items:center;padding:2rem}
.card{max-width:600px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:24px;padding:2.5rem;text-align:center}
h1{font-size:2.5rem;margin-bottom:0.5rem}p{color:#94a3b8;line-height:1.6;margin-bottom:1.5rem}
a{display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#0a0a0f;border-radius:12px;text-decoration:none;font-weight:600}</style>
</head><body><div class="card"><h1>HeadyMCP</h1><p>Protocol and tool orchestration for the Heady sovereign AI ecosystem.</p>
<a href="https://headysystems.com">Open HeadySystems</a></div></body></html>`, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Heady-Source': 'static-fallback', ...SECURITY_HEADERS },
    });
  },
};
