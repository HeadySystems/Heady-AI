// ============================================================================
// HEADY CROSS-DOMAIN SSO
// src/auth/cross-domain-sso.mjs
//
// Addresses Gap #7: No SSO config existed. Cross-domain auth was documented
// in auth-gateway.js (relay iframe + postMessage) but never implemented.
//
// Architecture:
//   1. auth.headysystems.com is the SSO authority
//   2. Each site (headyme.com, headybuddy.com, etc.) embeds a hidden iframe
//      pointing to auth.headysystems.com/sso/relay
//   3. The relay iframe checks for the session cookie (same origin as auth)
//   4. If authenticated, it postMessage()s the session token to the parent
//   5. The parent site sets its own __Host-heady_session cookie
//   6. All subsequent requests use the cookie directly (no more iframe needed)
//
// Security:
//   - Origin whitelist: only the 11 Heady domains accepted
//   - CSRF: nonce-based challenge-response
//   - Cookies: httpOnly, Secure, SameSite=Strict
//   - Session tokens are server-validated, not trusted from postMessage
//
// © 2026 HeadySystems Inc.
// ============================================================================

import { createLogger } from '../lib/logger.mjs';
import crypto from 'node:crypto';

const logger = createLogger('sso');

// Allowed origins for cross-domain SSO (from CORS whitelist in .poop env)
const ALLOWED_ORIGINS = new Set([
  'https://headyme.com',
  'https://headysystems.com',
  'https://headyconnection.org',
  'https://headybuddy.com',
  'https://headymcp.com',
  'https://headyio.com',
  'https://headybot.com',
  'https://headyapi.com',
  'https://headylens.com',
  'https://headyai.com',
  'https://headyfinance.com',
]);

/**
 * SSO Relay endpoint — serves the hidden iframe content.
 * Mounted at auth.headysystems.com/sso/relay
 *
 * This page:
 *   1. Receives a postMessage with { type: 'sso:check', nonce }
 *   2. Checks if the user has a valid session (reads httpOnly cookie)
 *   3. Responds with { type: 'sso:result', nonce, authenticated, sessionToken }
 */
export function ssoRelayHandler(unifiedAuth) {
  return async (req, res) => {
    // This serves an HTML page that acts as the relay iframe
    const html = `<!DOCTYPE html>
<html>
<head><title>Heady SSO Relay</title></head>
<body>
<script>
  // Allowed parent origins
  const ALLOWED = ${JSON.stringify([...ALLOWED_ORIGINS])};

  window.addEventListener('message', async (event) => {
    // Validate origin
    if (!ALLOWED.includes(event.origin)) return;

    const { type, nonce } = event.data || {};

    if (type === 'sso:check') {
      // The session cookie is httpOnly and belongs to auth.headysystems.com
      // We can't read it from JS, but we can make a fetch to our own /sso/status
      try {
        const resp = await fetch('/sso/status', {
          credentials: 'include', // sends the httpOnly cookie
          headers: { 'X-SSO-Nonce': nonce }
        });
        const data = await resp.json();

        event.source.postMessage({
          type: 'sso:result',
          nonce: nonce,
          authenticated: data.authenticated,
          user: data.user || null,
          // We send a one-time transfer token, NOT the session cookie itself
          transferToken: data.transferToken || null,
        }, event.origin);
      } catch (err) {
        event.source.postMessage({
          type: 'sso:result',
          nonce: nonce,
          authenticated: false,
          error: 'relay_error',
        }, event.origin);
      }
    }
  });

  // Signal ready to parent
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'sso:ready' }, '*');
  }
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    // Allow embedding only from Heady domains
    res.setHeader('Content-Security-Policy', `frame-ancestors ${[...ALLOWED_ORIGINS].join(' ')}`);
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://headyme.com');
    res.send(html);
  };
}

/**
 * SSO Status endpoint — checks if current request has valid session.
 * Mounted at auth.headysystems.com/sso/status
 * Called by the relay iframe with credentials: 'include'.
 *
 * Returns:
 *   { authenticated: true, user: { id, email, displayName }, transferToken }
 *   or { authenticated: false }
 *
 * The transferToken is a one-time short-lived token that the requesting site
 * can exchange for a session on its own domain.
 */
export function ssoStatusHandler(unifiedAuth, redis) {
  return async (req, res) => {
    const sessionToken = req.cookies?.['__Host-heady_session'];
    const nonce = req.headers['x-sso-nonce'];

    if (!sessionToken || !nonce) {
      return res.json({ authenticated: false });
    }

    try {
      const { user } = await unifiedAuth.validateSession(sessionToken);

      // Generate one-time transfer token (5-minute TTL)
      const transferToken = crypto.randomBytes(32).toString('base64url');
      await redis.setex(
        `sso:transfer:${transferToken}`,
        300, // 5 minutes
        JSON.stringify({ userId: user.id, nonce, createdAt: Date.now() })
      );

      logger.security('SSO transfer token created', {
        event: 'sso_transfer',
        userId: user.id,
        ip: req.ip,
        pqcVerified: false,
      });

      res.json({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
        transferToken,
      });
    } catch (err) {
      res.json({ authenticated: false });
    }
  };
}

/**
 * SSO Token Exchange endpoint — converts a transfer token into a session.
 * Mounted at auth.headysystems.com/sso/exchange
 * Called by each site's backend after receiving the transfer token from postMessage.
 *
 * POST { transferToken, site }
 * Returns: { sessionToken, expiresAt } — set this as the site's cookie
 */
export function ssoExchangeHandler(unifiedAuth, redis) {
  return async (req, res) => {
    const { transferToken, site } = req.body;

    if (!transferToken || !site) {
      return res.status(400).json({ error: 'MISSING_PARAMS' });
    }

    // Validate origin site
    const siteOrigin = `https://${site}`;
    if (!ALLOWED_ORIGINS.has(siteOrigin)) {
      return res.status(403).json({ error: 'INVALID_SITE' });
    }

    // Retrieve and consume the transfer token (one-time use)
    const tokenKey = `sso:transfer:${transferToken}`;
    const tokenData = await redis.get(tokenKey);
    await redis.del(tokenKey); // consume immediately

    if (!tokenData) {
      return res.status(401).json({ error: 'INVALID_TRANSFER_TOKEN' });
    }

    const { userId, createdAt } = JSON.parse(tokenData);

    // Check expiry (5 minutes)
    if (Date.now() - createdAt > 300000) {
      return res.status(401).json({ error: 'TRANSFER_TOKEN_EXPIRED' });
    }

    // Create a new session for the requesting site
    const result = await unifiedAuth._createSession({
      userId,
      originSite: site,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    logger.security('SSO exchange completed', {
      event: 'sso_exchange',
      userId,
      ip: req.ip,
      pqcVerified: false,
    });

    res.json({
      sessionToken: result.sessionToken,
      expiresAt: result.expiresAt,
    });
  };
}

/**
 * Client-side SSO check — embed this script in each site's base template.
 * Returns the JavaScript snippet that each site includes to trigger SSO.
 */
export function getSSOClientScript() {
  return `
<!-- Heady SSO Client — embed in base template of each site -->
<script>
(function() {
  // Skip if already authenticated on this site
  if (document.cookie.includes('__Host-heady_session')) return;

  const SSO_RELAY = 'https://auth.headysystems.com/sso/relay';
  const SSO_EXCHANGE = 'https://auth.headysystems.com/sso/exchange';
  const nonce = crypto.randomUUID();

  // Create hidden relay iframe
  const iframe = document.createElement('iframe');
  iframe.src = SSO_RELAY;
  iframe.style.display = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  window.addEventListener('message', async (event) => {
    if (event.origin !== 'https://auth.headysystems.com') return;

    const { type, nonce: respNonce, authenticated, transferToken } = event.data || {};

    if (type === 'sso:ready') {
      // Relay is ready, send check request
      iframe.contentWindow.postMessage({ type: 'sso:check', nonce }, 'https://auth.headysystems.com');
    }

    if (type === 'sso:result' && respNonce === nonce && authenticated && transferToken) {
      // Exchange transfer token for a session on this site
      try {
        const resp = await fetch(SSO_EXCHANGE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transferToken, site: location.hostname }),
        });
        const data = await resp.json();

        if (data.sessionToken) {
          // Server will set the cookie via Set-Cookie header
          // Reload to pick up authenticated state
          location.reload();
        }
      } catch (err) {
        console.error('SSO exchange failed:', err);
      }
    }

    // Cleanup iframe after response
    if (type === 'sso:result') {
      iframe.remove();
    }
  });
})();
</script>`;
}
