/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Dynamic Multi-Domain Site Server — Orchestrator ═══
 *
 * Thin server that composes site-registry, auth-providers, and site-renderer.
 * Reads Host header → returns the correct branded page.
 *
 * Usage:
 *   node src/core/dynamic-site-server.js
 *   SITE_PORT=8080 node src/core/dynamic-site-server.js
 */

const http = require('http');
const logger = require('../utils/logger').child('dynamic-sites');
const { initSentry, captureError, addBreadcrumb } = require('./sentry-init');

// ── Composed microservices ────────────────────────────────────
const { SITES, _isHeadyOrigin } = require('./site-registry');
const { AUTH_PROVIDERS } = require('./auth-providers');
const {
  resolveIncomingHost, resolveSite,
  renderSite, renderOnboarding, renderLegalPage,
  generateSession, generateApiKey, hashPw
} = require('./site-renderer');

initSentry();

const PORT = process.env.PORT || process.env.SITE_PORT || 8080;
const sessions = new Map();

// ── Server request handler ────────────────────────────────────
const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && _isHeadyOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Heady-Version');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const host = resolveIncomingHost(req.headers);
  const site = resolveSite(host);
  const url = new URL(req.url, `http://${host}`);

  addBreadcrumb({ category: 'request', message: `${req.method} ${url.pathname}`, data: { host } });

  try {
    // ── Static routes ─────────────────────────────────
    if (url.pathname === '/health')         return json(res, { status: 'healthy', host, timestamp: new Date().toISOString() });
    if (url.pathname === '/api/site-info')  return json(res, { site, host });
    if (url.pathname === '/api/auth-providers') return json(res, AUTH_PROVIDERS);

    // ── Auth routes ───────────────────────────────────
    if (url.pathname === '/api/auth/email' && req.method === 'POST')  return handleEmailAuth(req, res);
    if (url.pathname === '/api/auth/apikey' && req.method === 'POST') return handleApiKeyAuth(req, res);
    if (url.pathname === '/api/auth/session')                          return handleSession(req, res);
    if (url.pathname === '/api/auth/logout' && req.method === 'POST') return handleLogout(req, res);

    // ── Page routes ───────────────────────────────────
    if (url.pathname === '/onboarding') return html(res, renderOnboarding(site, host));
    if (url.pathname === '/terms')      return html(res, renderLegalPage(site, host, 'terms'));
    if (url.pathname === '/privacy')    return html(res, renderLegalPage(site, host, 'privacy'));

    // ── Default: site homepage ────────────────────────
    return html(res, renderSite(site, host));

  } catch (error) {
    captureError(error, { host, url: url.pathname });
    logger.error(`Error serving ${host}${url.pathname}:`, error.message);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>500 Internal Error</h1><p>${error.message}</p>`);
  }
});

// ── Auth handlers ─────────────────────────────────────────────
function handleEmailAuth(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    try {
      const { email, password } = JSON.parse(body);
      if (!email || !password) return json(res, { error: 'Email and password required' }, 400);
      const session = generateSession();
      sessions.set(session, { email, loginAt: new Date().toISOString(), method: 'email' });
      res.setHeader('Set-Cookie', `heady_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
      json(res, { success: true, session, email });
    } catch (e) { json(res, { error: e.message }, 400); }
  });
}

function handleApiKeyAuth(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    try {
      const { provider, key } = JSON.parse(body);
      if (!provider || !key) return json(res, { error: 'Provider and key required' }, 400);
      const session = generateSession();
      sessions.set(session, { provider, method: 'apikey', connectedAt: new Date().toISOString() });
      res.setHeader('Set-Cookie', `heady_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
      json(res, { success: true, session, provider });
    } catch (e) { json(res, { error: e.message }, 400); }
  });
}

function handleSession(req, res) {
  const cookie = (req.headers.cookie || '').split(';').find(c => c.trim().startsWith('heady_session='));
  if (!cookie) return json(res, { authenticated: false });
  const sess = sessions.get(cookie.split('=')[1]?.trim());
  json(res, sess ? { authenticated: true, ...sess } : { authenticated: false });
}

function handleLogout(req, res) {
  const cookie = (req.headers.cookie || '').split(';').find(c => c.trim().startsWith('heady_session='));
  if (cookie) sessions.delete(cookie.split('=')[1]?.trim());
  res.setHeader('Set-Cookie', 'heady_session=; Path=/; HttpOnly; Max-Age=0');
  json(res, { success: true });
}

// ── Response helpers ──────────────────────────────────────────
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function html(res, content) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(content);
}

// ── Start ─────────────────────────────────────────────────────
server.listen(PORT, () => {
  logger.info(`Dynamic Site Server on port ${PORT}`);
  logger.info(`Serving ${Object.keys(SITES).length} domains`);
});

module.exports = { SITES, AUTH_PROVIDERS, server, resolveSite };
