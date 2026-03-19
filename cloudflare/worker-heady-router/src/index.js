/*
 * © 2026 Heady™Systems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Hologram Router — Cloudflare Edge Worker ═══
 *
 * Restores branded edge routing for the active Heady domain portfolio.
 * The worker serves cached UI when available, attempts live compilation,
 * retries origin proxying, and finally returns a branded fallback page so
 * no routed domain hard-fails with a 404/522.
 */

const CACHE_TTL_SECONDS = 3600;
const DEFAULT_ORIGIN = 'https://heady-manager-1073792900703.us-east1.run.app';
const DEFAULT_COMPILER_WEBHOOK = `${DEFAULT_ORIGIN}/api/hologram/compile`;

const DOMAIN_MODULES = {
  'headymcp.com': 'mcp-dashboard',
  'www.headymcp.com': 'mcp-dashboard',
  'headysystems.com': 'systems-portal',
  'www.headysystems.com': 'systems-portal',
  'headyme.com': 'personal-hub',
  'www.headyme.com': 'personal-hub',
  'headyapi.com': 'api-docs',
  'www.headyapi.com': 'api-docs',
  'headyio.com': 'io-platform',
  'www.headyio.com': 'io-platform',
  'headyfinance.com': 'trading-desk',
  'www.headyfinance.com': 'trading-desk',
  'headyconnection.org': 'foundation-portal',
  'www.headyconnection.org': 'foundation-portal',
  'headyconnection.com': 'connection-hub',
  'www.headyconnection.com': 'connection-hub',
  'headybuddy.org': 'buddy-portal',
  'www.headybuddy.org': 'buddy-portal',
  'heady-ai.com': 'ai-assistant',
  'www.heady-ai.com': 'ai-assistant',
  'headyos.com': 'os-portal',
  'www.headyos.com': 'os-portal',
  'headyex.com': 'executive-hub',
  'www.headyex.com': 'executive-hub',
  'admin.headysystems.com': 'admin-portal',
  'auth.headysystems.com': 'auth-portal',
  'heady.headyme.com': 'edge-mcp',
};

const MODULE_BRANDS = {
  'mcp-dashboard': {
    brand: 'HeadyMCP',
    title: 'Protocol and tool orchestration',
    description: 'The Heady MCP gateway for tools, connectors, and agent transport.',
    accent: '#f59e0b',
    ctaLabel: 'Open protocol docs',
    ctaHref: 'https://headymcp.com',
  },
  'systems-portal': {
    brand: 'HeadySystems',
    title: 'Sovereign AI infrastructure',
    description: 'Platform architecture, service operations, and deployment control for the Heady stack.',
    accent: '#00d4ff',
    ctaLabel: 'Open platform',
    ctaHref: 'https://headysystems.com',
  },
  'personal-hub': {
    brand: 'HeadyMe',
    title: 'Your personal AI operating system',
    description: 'Cross-device AI, memory, and orchestration in one sovereign workspace.',
    accent: '#4c8fff',
    ctaLabel: 'Open dashboard',
    ctaHref: 'https://headyme.com',
  },
  'api-docs': {
    brand: 'HeadyAPI',
    title: 'Unified API gateway',
    description: 'Programmable access to Heady routing, intelligence, and automation services.',
    accent: '#14b8a6',
    ctaLabel: 'Open API portal',
    ctaHref: 'https://headyapi.com',
  },
  'io-platform': {
    brand: 'HeadyIO',
    title: 'Developer platform',
    description: 'SDKs, integration patterns, and technical documentation for builders.',
    accent: '#ec4899',
    ctaLabel: 'Open developer portal',
    ctaHref: 'https://headyio.com',
  },
  'trading-desk': {
    brand: 'HeadyFinance',
    title: 'Financial operations intelligence',
    description: 'Budget routing, forecasting, and subscription intelligence for the Heady ecosystem.',
    accent: '#84cc16',
    ctaLabel: 'Open finance portal',
    ctaHref: 'https://headyfinance.com',
  },
  'foundation-portal': {
    brand: 'HeadyConnection',
    title: 'Nonprofit and community impact',
    description: 'Programs, outreach, and mission-aligned intelligence for HeadyConnection.',
    accent: '#8b5cf6',
    ctaLabel: 'Open nonprofit site',
    ctaHref: 'https://headyconnection.org',
  },
  'connection-hub': {
    brand: 'HeadyConnection',
    title: 'Community intelligence',
    description: 'Relationship, engagement, and impact tooling for the HeadyConnection ecosystem.',
    accent: '#f43f5e',
    ctaLabel: 'Open community site',
    ctaHref: 'https://headyconnection.com',
  },
  'buddy-portal': {
    brand: 'HeadyBuddy',
    title: 'Companion AI experience',
    description: 'Persistent personal assistance, memory, and task continuity across sessions.',
    accent: '#10b981',
    ctaLabel: 'Open buddy site',
    ctaHref: 'https://headybuddy.org',
  },
  'ai-assistant': {
    brand: 'HeadyAI',
    title: 'The intelligence hub',
    description: 'Multi-model AI routing, research workflows, and edge-native inference.',
    accent: '#a855f7',
    ctaLabel: 'Open HeadyAI',
    ctaHref: 'https://heady-ai.com',
  },
  'os-portal': {
    brand: 'HeadyOS',
    title: 'The sovereign operating system',
    description: 'Agent runtime, memory, orchestration, and platform control across the Heady stack.',
    accent: '#0ea5e9',
    ctaLabel: 'Open HeadyOS',
    ctaHref: 'https://headyos.com',
  },
  'executive-hub': {
    brand: 'HeadyEX',
    title: 'Executive intelligence',
    description: 'Leadership dashboards, summaries, and decision support for executive operators.',
    accent: '#94a3b8',
    ctaLabel: 'Open HeadyEX',
    ctaHref: 'https://headyex.com',
  },
  'admin-portal': {
    brand: 'Heady Admin',
    title: 'Administrative control plane',
    description: 'Secure operational access for platform administration, governance, and service controls.',
    accent: '#06b6d4',
    ctaLabel: 'Open platform home',
    ctaHref: 'https://headysystems.com',
  },
  'auth-portal': {
    brand: 'Heady Auth',
    title: 'Centralized sign-in',
    description: 'Unified authentication entrypoint for Heady domains and service access.',
    accent: '#7c5eff',
    ctaLabel: 'Open sign-in hub',
    ctaHref: 'https://headyme.com',
  },
  'edge-mcp': {
    brand: 'Heady Edge',
    title: 'Edge transport bridge',
    description: 'Low-latency edge bridge for Heady routing and protocol traffic.',
    accent: '#38bdf8',
    ctaLabel: 'Open HeadyMe',
    ctaHref: 'https://headyme.com',
  },
};

function moduleForHostname(hostname) {
  const clean = hostname.toLowerCase();
  if (DOMAIN_MODULES[clean]) return DOMAIN_MODULES[clean];
  const withoutWww = clean.replace(/^www\./, '');
  return DOMAIN_MODULES[withoutWww] || null;
}

function contentTypeForPath(pathname) {
  if (pathname.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.json')) return 'application/json; charset=utf-8';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  return 'text/html; charset=utf-8';
}

function commonHeaders(moduleName, source, contentType = 'text/html; charset=utf-8') {
  return {
    'Content-Type': contentType,
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    'X-Heady-Source': source,
    'X-Heady-Module': moduleName,
    'X-Heady-Edge': 'true',
  };
}

function renderFallbackPage(hostname, moduleName) {
  const brand = MODULE_BRANDS[moduleName] || {
    brand: 'Heady',
    title: 'Edge recovery portal',
    description: 'This domain is being restored through the Heady edge recovery layer.',
    accent: '#4c8fff',
    ctaLabel: 'Open HeadySystems',
    ctaHref: 'https://headysystems.com',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${brand.brand} · ${brand.title}</title>
  <meta name="description" content="${brand.description}">
  <style>
    :root {
      --bg: #060814;
      --surface: rgba(15, 23, 42, 0.78);
      --text: #e5eefb;
      --muted: #9fb0c9;
      --border: rgba(255,255,255,0.1);
      --accent: ${brand.accent};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 20%, transparent), transparent 35%),
        radial-gradient(circle at bottom right, rgba(99, 102, 241, 0.18), transparent 30%),
        linear-gradient(180deg, #050816 0%, #0b1220 100%);
      display: grid;
      place-items: center;
      padding: 32px;
    }
    .card {
      width: min(760px, 100%);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 24px;
      backdrop-filter: blur(22px);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      padding: 32px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
      color: var(--accent);
      border-radius: 999px;
      padding: 8px 14px;
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    h1 {
      margin: 20px 0 12px;
      font-size: clamp(32px, 5vw, 52px);
      line-height: 1.04;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.6;
    }
    .host {
      margin-top: 20px;
      font: 14px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #cdd9ee;
      padding: 14px 16px;
      border-radius: 14px;
      background: rgba(2, 6, 23, 0.5);
      border: 1px solid var(--border);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 26px;
    }
    a.button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 0 18px;
      border-radius: 14px;
      text-decoration: none;
      font-weight: 600;
      transition: transform 160ms ease, opacity 160ms ease;
    }
    a.button:hover { transform: translateY(-1px); }
    a.primary {
      background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, white));
      color: #08111f;
    }
    a.secondary {
      background: rgba(255,255,255,0.03);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .footer {
      margin-top: 28px;
      font-size: 14px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="badge">Heady edge recovery active</div>
    <h1>${brand.brand}</h1>
    <p>${brand.description}</p>
    <div class="host">Domain: ${hostname}<br>Module: ${moduleName}</div>
    <div class="actions">
      <a class="button primary" href="${brand.ctaHref}">${brand.ctaLabel}</a>
      <a class="button secondary" href="https://headysystems.com">Platform home</a>
    </div>
    <div class="footer">This domain is now served by the Heady edge router with cache, compile, origin retry, and branded fallback recovery.</div>
  </main>
</body>
</html>`;
}

async function tryCompiler(url, hostname, moduleName, env) {
  if (!env.HEADY_INTERNAL_TOKEN) return null;

  const response = await fetch(env.COLAB_COMPILER_WEBHOOK || DEFAULT_COMPILER_WEBHOOK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.HEADY_INTERNAL_TOKEN}`,
    },
    body: JSON.stringify({
      domain: hostname,
      module: moduleName,
      path: url.pathname,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) return null;
  return response.text();
}

async function tryOrigin(request, url, hostname, moduleName, env) {
  const originBase = env.HEADY_ORIGIN_BASE || DEFAULT_ORIGIN;
  const originUrl = `${originBase}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('X-Forwarded-Host', hostname);
  headers.set('X-Heady-Module', moduleName);
  headers.set('X-Heady-Edge-Recovery', 'true');

  const response = await fetch(originUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow',
  });

  if (!response.ok) return null;
  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();
    const moduleName = moduleForHostname(hostname);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Heady-Module',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (!moduleName) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Unknown domain',
        domain: hostname,
      }), {
        status: 404,
        headers: commonHeaders('unknown', 'router-miss', 'application/json; charset=utf-8'),
      });
    }

    const cacheKey = `hologram:${moduleName}:${url.pathname || '/'}:${url.search || ''}`;
    const contentType = contentTypeForPath(url.pathname);

    const cached = await env.HEADY_UI_MANIFEST.get(cacheKey, { type: 'text' });
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: commonHeaders(moduleName, 'edge-cache', contentType),
      });
    }

    try {
      const compiled = await tryCompiler(url, hostname, moduleName, env);
      if (compiled) {
        await env.HEADY_UI_MANIFEST.put(cacheKey, compiled, { expirationTtl: CACHE_TTL_SECONDS });
        return new Response(compiled, {
          status: 200,
          headers: commonHeaders(moduleName, 'just-compiled', contentType),
        });
      }
    } catch (_error) {
      // Fall through to origin and static recovery.
    }

    try {
      const originResponse = await tryOrigin(request, url, hostname, moduleName, env);
      if (originResponse) {
        const headers = new Headers(originResponse.headers);
        headers.set('X-Heady-Source', 'origin-proxy');
        headers.set('X-Heady-Module', moduleName);
        headers.set('X-Heady-Edge', 'true');
        return new Response(originResponse.body, {
          status: originResponse.status,
          headers,
        });
      }
    } catch (_error) {
      // Final branded fallback below.
    }

    const fallback = renderFallbackPage(hostname, moduleName);
    return new Response(fallback, {
      status: 200,
      headers: commonHeaders(moduleName, 'static-fallback'),
    });
  },
};
