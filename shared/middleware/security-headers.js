/**
 * Heady™ Security Headers Middleware
 * Enforces comprehensive security headers across all HTTP responses
 *
 * CSP Policy: No unsafe-inline, no unsafe-eval
 * HSTS: 1 year max-age with includeSubDomains and preload
 * Additional: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
 */

const express = require('express');

/**
 * Security headers middleware factory
 * @param {Object} options - Configuration options
 * @param {string} options.cspNonce - Optional nonce for CSP (generated per request)
 * @param {boolean} options.reportOnly - If true, uses Content-Security-Policy-Report-Only
 * @returns {Function} Express middleware
 */
function securityHeadersMiddleware(options = {}) {
  const reportOnly = options.reportOnly || false;
  const cspHeaderName = reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  return (req, res, next) => {
    // Generate nonce for inline scripts/styles if provided
    const nonce = options.cspNonce || '';
    const nonceAttr = nonce ? `'nonce-${nonce}'` : '';

    // Content Security Policy
    // - Strict: only allows safe-listed origins
    // - No unsafe-inline for scripts/styles
    // - No eval() or related functions
    const cspPolicy = [
      "default-src 'self'",
      `script-src 'self' ${nonceAttr} https://cdn.jsdelivr.net https://cdnjs.cloudflare.com`,
      `style-src 'self' ${nonceAttr} https://fonts.googleapis.com https://cdn.jsdelivr.net`,
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https: wss: ws:",
      "media-src 'self' https:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
      "block-all-mixed-content",
      "report-uri /api/csp-report",
    ].join('; ');

    res.setHeader(cspHeaderName, cspPolicy);

    // X-Content-Type-Options: Prevent MIME type sniffing
    // nosniff: Forces browser to respect Content-Type header
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options: Prevent clickjacking
    // DENY: Prevent framing in any context
    res.setHeader('X-Frame-Options', 'DENY');

    // Strict-Transport-Security (HSTS)
    // 31536000 seconds = 1 year
    // includeSubDomains: Apply to all subdomains
    // preload: Allow browser preload list inclusion
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );

    // Referrer-Policy: Control referrer information leakage
    // strict-origin-when-cross-origin: Send referrer only for same-origin; send origin only for cross-origin
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy: Control browser features and APIs
    // Replace the allow-all-features header with a restrictive baseline
    const permissionsPolicy = [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=(self)',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'picture-in-picture=()',
      'sync-xhr=(self)',
      'usb=()',
      'vr=()',
      'xr-spatial-tracking=()',
    ].join(', ');

    res.setHeader('Permissions-Policy', permissionsPolicy);

    // X-UA-Compatible: Ensure modern rendering engine in IE
    res.setHeader('X-UA-Compatible', 'IE=edge');

    // Remove X-Powered-By header to avoid information disclosure
    res.removeHeader('X-Powered-By');

    next();
  };
}

module.exports = securityHeadersMiddleware;
