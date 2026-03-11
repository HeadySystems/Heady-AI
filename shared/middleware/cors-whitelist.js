/**
 * Heady™ CORS Whitelist Middleware
 * Strict origin-based access control for all 9 Heady domains plus admin/auth/api subdomains
 *
 * Whitelist:
 *   - 9 main domains: headyme.com, headysystems.com, headyconnection.org, headybuddy.org,
 *     headymcp.com, headyio.com, headybot.com, headyapi.com, heady-ai.com
 *   - 3 subdomains: admin.headysystems.com, auth.headysystems.com, api.headysystems.com
 *
 * φ-scaled max-age: 86400 * φ (1.618...) ≈ 53,395 seconds
 */

const express = require('express');

// Whitelist: 9 domains + 3 subdomains
const ALLOWED_ORIGINS = [
  'https://headyme.com',
  'https://www.headyme.com',
  'https://headysystems.com',
  'https://www.headysystems.com',
  'https://headyconnection.org',
  'https://www.headyconnection.org',
  'https://headyconnection.com',
  'https://www.headyconnection.com',
  'https://headybuddy.org',
  'https://www.headybuddy.org',
  'https://headymcp.com',
  'https://www.headymcp.com',
  'https://headyio.com',
  'https://www.headyio.com',
  'https://headybot.com',
  'https://www.headybot.com',
  'https://headyapi.com',
  'https://www.headyapi.com',
  'https://heady-ai.com',
  'https://www.heady-ai.com',
  'https://admin.headysystems.com',
  'https://auth.headysystems.com',
  'https://api.headysystems.com',
  'https://headyos.com',
  'https://www.headyos.com',
];

// φ-scaled CORS max-age: 86400 seconds (1 day) * φ (1.618...) ≈ 53,395 seconds
// Round to 53395 seconds (14.8 hours)
const PHI_SCALED_MAX_AGE = 53395;

/**
 * CORS whitelist middleware factory
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.additionalOrigins - Extra origins to allow
 * @param {boolean} options.credentials - Allow credentials (cookies, auth headers)
 * @param {string[]} options.allowedMethods - HTTP methods to allow
 * @param {string[]} options.allowedHeaders - Request headers to allow
 * @returns {Function} Express middleware
 */
function corsWhitelistMiddleware(options = {}) {
  const credentials = options.credentials !== false; // Default true
  const allowedMethods = options.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
  const allowedHeaders = options.allowedHeaders || [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'Accept',
    'Origin',
    'Access-Control-Request-Headers',
    'Access-Control-Request-Method',
  ];

  const allowedOrigins = new Set([
    ...ALLOWED_ORIGINS,
    ...(options.additionalOrigins || []),
  ]);

  return (req, res, next) => {
    const origin = req.get('origin');
    const requestMethod = req.method;

    // Check if origin is whitelisted
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        allowedMethods.join(', ')
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        allowedHeaders.join(', ')
      );
      res.setHeader(
        'Access-Control-Max-Age',
        PHI_SCALED_MAX_AGE.toString()
      );
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-JSON-Response-Size');
      res.setHeader('Vary', 'Origin');
    } else if (origin) {
      // Origin not in whitelist: return 403 Forbidden
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Origin not allowed',
          origin: origin,
        })
      );
    }

    // Handle preflight OPTIONS requests
    if (requestMethod === 'OPTIONS') {
      return res.end();
    }

    next();
  };
}

module.exports = corsWhitelistMiddleware;
