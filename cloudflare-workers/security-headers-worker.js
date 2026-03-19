/**
 * HeadySystems Inc. — Cloudflare Security Headers Worker
 * 
 * Adds missing security headers to all responses for Heady live domains:
 * - headyme.com
 * - headysystems.com
 * - headyapi.com
 * 
 * PHI-derived constants:
 * - HSTS max-age: 31536000 ≈ φ^17 × 1000 (31,381,059 rounded to standard year)
 * - Worker timeout: 1618ms (φ × 1000)
 * 
 * Deploy: Cloudflare Dashboard → Workers → Create Worker → paste this code
 * Route: *headyme.com/*, *headysystems.com/*, *headyapi.com/*
 */

const PHI = 1.618033988749895;
const HSTS_MAX_AGE = 31536000; // ~φ^17 × 1000, standard 1-year HSTS

const SECURITY_HEADERS = {
  'Strict-Transport-Security': `max-age=${HSTS_MAX_AGE}; includeSubDomains; preload`,
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' wss: https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', '),
  'X-DNS-Prefetch-Control': 'on',
  'X-Permitted-Cross-Domain-Policies': 'none'
};

/**
 * Applies security headers to the response.
 * Preserves existing headers; security headers override if present.
 */
function applySecurityHeaders(response) {
  const newResponse = new Response(response.body, response);

  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    newResponse.headers.set(header, value);
  }

  /* Remove headers that leak server info */
  newResponse.headers.delete('X-Powered-By');
  newResponse.headers.delete('Server');

  return newResponse;
}

export default {
  async fetch(request, env, ctx) {
    const response = await fetch(request);
    return applySecurityHeaders(response);
  }
};
