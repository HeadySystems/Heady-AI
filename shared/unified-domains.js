'use strict';

/**
 * Heady™ Unified Domain Registry v1.0
 * ═══════════════════════════════════════════════════════════════
 * SINGLE SOURCE OF TRUTH for all Heady platform domains.
 *
 * Replaces the 3 fragmented domain lists that were out of sync:
 *   - shared/cors-config.js (14 domains)
 *   - shared/cors-whitelist.js (12 domains + subdomains)
 *   - shared/domains.js (9 domains — missing headybuddy.org, headymcp.com, headyio.com, headybot.com, headyapi.com)
 *   - services/auth-session-server/index.js (11 domains — missing 5 critical ones)
 *
 * All CORS, CSP, cookie, and routing configuration MUST import from here.
 *
 * φ-scaled CORS max-age: 86400 * PSI ≈ 53,395 seconds
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

const PHI = 1.618033988749895;
const PSI = 1 / PHI;

// ═══════════════════════════════════════════════════════════════
// CANONICAL DOMAIN REGISTRY
// ═══════════════════════════════════════════════════════════════

const DOMAIN_REGISTRY = {
  // ── Primary Heady Domains (9 core) ─────────────────────────
  'headyme.com': {
    role: 'consumer',
    pool: 'hot',
    description: 'Personal AI command center',
    services: ['auth-session-server', 'notification-service', 'analytics-service'],
    cloudflareProject: 'headyme',
  },
  'headysystems.com': {
    role: 'platform',
    pool: 'hot',
    description: 'Core architecture engine and platform',
    services: ['auth-session-server', 'notification-service', 'analytics-service', 'billing-service', 'scheduler-service'],
    cloudflareProject: 'headysystems',
  },
  'heady-ai.com': {
    role: 'ai',
    pool: 'hot',
    description: 'Intelligence routing hub and AI inference',
    services: ['auth-session-server', 'notification-service', 'analytics-service', 'ai-router'],
    cloudflareProject: 'heady-ai',
  },
  'headyconnection.org': {
    role: 'nonprofit',
    pool: 'warm',
    description: 'HeadyConnection nonprofit community (501c3)',
    services: ['auth-session-server', 'notification-service', 'analytics-service'],
    cloudflareProject: 'headyconnection-org',
  },
  'headybuddy.org': {
    role: 'companion',
    pool: 'hot',
    description: 'AI companion experience',
    services: ['auth-session-server', 'notification-service', 'buddy-service'],
    cloudflareProject: 'headybuddy-org',
  },
  'headymcp.com': {
    role: 'mcp',
    pool: 'hot',
    description: 'Model Context Protocol developer platform',
    services: ['auth-session-server', 'mcp-service'],
    cloudflareProject: 'headymcp',
  },
  'headyio.com': {
    role: 'developer',
    pool: 'warm',
    description: 'Developer platform and API gateway',
    services: ['auth-session-server', 'notification-service', 'analytics-service', 'api-gateway'],
    cloudflareProject: 'headyio',
  },
  'headybot.com': {
    role: 'automation',
    pool: 'warm',
    description: 'Automation and agent platform',
    services: ['auth-session-server', 'notification-service', 'bot-service'],
    cloudflareProject: 'headybot',
  },
  'headyapi.com': {
    role: 'api',
    pool: 'hot',
    description: 'Public intelligence API interface',
    services: ['auth-session-server', 'api-gateway'],
    cloudflareProject: 'headyapi',
  },

  // ── Secondary Domains ──────────────────────────────────────
  'headyos.com': {
    role: 'os',
    pool: 'warm',
    description: 'HeadyOS operating environment',
    services: ['auth-session-server', 'notification-service', 'scheduler-service'],
    cloudflareProject: 'headyos',
  },
  'headyconnection.com': {
    role: 'community-commercial',
    pool: 'warm',
    description: 'HeadyConnection commercial community',
    services: ['auth-session-server', 'notification-service'],
    cloudflareProject: 'headyconnection-com',
  },
  'headyex.com': {
    role: 'marketplace',
    pool: 'cold',
    description: 'HeadyEX marketplace and exchange',
    services: ['auth-session-server', 'billing-service'],
    cloudflareProject: 'headyex',
  },
  'headyfinance.com': {
    role: 'finance',
    pool: 'cold',
    description: 'Heady Finance platform',
    services: ['auth-session-server', 'billing-service'],
    cloudflareProject: 'headyfinance',
  },
  'headylens.com': {
    role: 'analytics',
    pool: 'cold',
    description: 'HeadyLens analytics and visualization',
    services: ['analytics-service'],
    cloudflareProject: 'headylens',
  },

  // ── Subdomains ─────────────────────────────────────────────
  'admin.headysystems.com': {
    role: 'admin',
    pool: 'warm',
    description: 'Platform administration dashboard',
    services: ['auth-session-server', 'billing-service', 'scheduler-service'],
    isSubdomain: true,
  },
  'auth.headysystems.com': {
    role: 'auth',
    pool: 'hot',
    description: 'Authentication SSO hub',
    services: ['auth-session-server'],
    isSubdomain: true,
  },
  'api.headysystems.com': {
    role: 'api-gateway',
    pool: 'hot',
    description: 'Central API gateway',
    services: ['api-gateway'],
    isSubdomain: true,
  },
};

// ═══════════════════════════════════════════════════════════════
// DERIVED COLLECTIONS
// ═══════════════════════════════════════════════════════════════

/** All registered domain names */
const ALL_DOMAINS = Object.keys(DOMAIN_REGISTRY);

/** Primary domains (non-subdomain) */
const PRIMARY_DOMAINS = ALL_DOMAINS.filter(d => !DOMAIN_REGISTRY[d].isSubdomain);

/** All HTTPS origins including www variants (for CORS) */
const ALL_ORIGINS = new Set();
for (const domain of ALL_DOMAINS) {
  ALL_ORIGINS.add(`https://${domain}`);
  // Subdomains don't get www variants
  if (!DOMAIN_REGISTRY[domain].isSubdomain) {
    ALL_ORIGINS.add(`https://www.${domain}`);
  }
}

/** Origins as array (for configs that need arrays) */
const ALL_ORIGINS_ARRAY = [...ALL_ORIGINS].sort();

// ═══════════════════════════════════════════════════════════════
// CORS HELPERS
// ═══════════════════════════════════════════════════════════════

const PHI_CORS_MAX_AGE = Math.round(86400 * PSI); // 53395 seconds

/**
 * Check if an origin is in the Heady whitelist.
 * @param {string} origin
 * @returns {boolean}
 */
function isAllowedOrigin(origin) {
  return ALL_ORIGINS.has(origin);
}

/**
 * CORS options for the `cors` npm package.
 * Never returns Access-Control-Allow-Origin: *
 */
const corsOptions = {
  origin: function originValidator(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (ALL_ORIGINS.has(origin)) {
      callback(null, origin);
    } else {
      callback(new Error(`CORS: origin ${origin} not in Heady whitelist`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 'Authorization', 'X-Heady-CSRF', 'X-Heady-API-Key',
    'X-Request-ID', 'X-Correlation-ID', 'X-Workspace-ID', 'X-Brain-Profile',
    'Accept', 'Accept-Language',
  ],
  exposedHeaders: [
    'X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset',
  ],
  maxAge: PHI_CORS_MAX_AGE,
};

// ═══════════════════════════════════════════════════════════════
// CSP HELPERS
// ═══════════════════════════════════════════════════════════════

/** CSP connect-src for all Heady domains */
const CSP_CONNECT_SOURCES = PRIMARY_DOMAINS
  .map(d => `https://*.${d}`)
  .join(' ');

// ═══════════════════════════════════════════════════════════════
// POOL QUERIES
// ═══════════════════════════════════════════════════════════════

/**
 * Get domains by pool assignment.
 * @param {'hot'|'warm'|'cold'} pool
 * @returns {string[]}
 */
function getDomainsByPool(pool) {
  return ALL_DOMAINS.filter(d => DOMAIN_REGISTRY[d].pool === pool);
}

/**
 * Get domains by role.
 * @param {string} role
 * @returns {string[]}
 */
function getDomainsByRole(role) {
  return ALL_DOMAINS.filter(d => DOMAIN_REGISTRY[d].role === role);
}

/**
 * Get the registry entry for a domain.
 * @param {string} domain
 * @returns {object|null}
 */
function getDomainConfig(domain) {
  return DOMAIN_REGISTRY[domain] || null;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  DOMAIN_REGISTRY,
  ALL_DOMAINS,
  PRIMARY_DOMAINS,
  ALL_ORIGINS,
  ALL_ORIGINS_ARRAY,
  corsOptions,
  isAllowedOrigin,
  getDomainsByPool,
  getDomainsByRole,
  getDomainConfig,
  CSP_CONNECT_SOURCES,
  PHI_CORS_MAX_AGE,
};
