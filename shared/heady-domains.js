'use strict';
/**
 * Heady™ Latent OS v5.3.0
 * Heady Domains Registry — Central source of truth for all 9 Heady platform domains.
 *
 * © 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents
 */

const { CSL_THRESHOLDS, PSI } = require('./phi-math');

// ─── The 9 Canonical Heady Domains ──────────────────────────────
const HEADY_DOMAINS = Object.freeze({
  HEADYME: Object.freeze({
    host: 'headyme.com',
    role: 'command_center',
    pool: 'hot',
    csl: CSL_THRESHOLDS.MEDIUM,          // ≈ 0.809
    description: 'Consumer-facing Heady personal AI command center',
  }),
  HEADYSYSTEMS: Object.freeze({
    host: 'headysystems.com',
    role: 'platform_core',
    pool: 'hot',
    csl: CSL_THRESHOLDS.HIGH,            // ≈ 0.882
    description: 'Core Heady platform and API infrastructure',
  }),
  HEADYCONNECTION: Object.freeze({
    host: 'headyconnection.org',
    role: 'community',
    pool: 'warm',
    csl: CSL_THRESHOLDS.LOW,             // ≈ 0.691
    description: 'Heady Connection community (nonprofit)',
  }),
  HEADYBUDDY: Object.freeze({
    host: 'headybuddy.org',
    role: 'companion',
    pool: 'warm',
    csl: CSL_THRESHOLDS.LOW,             // ≈ 0.691
    description: 'Heady Buddy companion platform',
  }),
  HEADYMCP: Object.freeze({
    host: 'headymcp.com',
    role: 'mcp_gateway',
    pool: 'hot',
    csl: CSL_THRESHOLDS.CRITICAL,        // ≈ 0.927
    description: 'Heady MCP protocol gateway',
  }),
  HEADYIO: Object.freeze({
    host: 'headyio.com',
    role: 'developer_portal',
    pool: 'warm',
    csl: CSL_THRESHOLDS.MEDIUM,          // ≈ 0.809
    description: 'Heady developer portal and docs',
  }),
  HEADYBOT: Object.freeze({
    host: 'headybot.com',
    role: 'bot_platform',
    pool: 'warm',
    csl: PSI,                            // ≈ 0.618
    description: 'Heady Bot platform',
  }),
  HEADYAPI: Object.freeze({
    host: 'headyapi.com',
    role: 'api_gateway',
    pool: 'hot',
    csl: CSL_THRESHOLDS.HIGH,            // ≈ 0.882
    description: 'Heady API gateway',
  }),
  HEADYAI: Object.freeze({
    host: 'headyai.com',
    role: 'intelligence_hub',
    pool: 'hot',
    csl: CSL_THRESHOLDS.CRITICAL,        // ≈ 0.927
    description: 'Heady AI intelligence and inference hub',
  }),
});

// ─── Admin Subdomains ───────────────────────────────────────────
const ADMIN_SUBDOMAINS = Object.freeze([
  'admin.headysystems.com',
  'auth.headysystems.com',
  'api.headysystems.com',
]);

// ─── Allowed Origins (HTTPS only, frozen) ───────────────────────
function buildAllowedOrigins() {
  const origins = [];
  for (const domain of Object.values(HEADY_DOMAINS)) {
    origins.push(`https://${domain.host}`);
    origins.push(`https://www.${domain.host}`);
  }
  for (const sub of ADMIN_SUBDOMAINS) {
    origins.push(`https://${sub}`);
  }
  return Object.freeze(origins);
}

const ALLOWED_ORIGINS = buildAllowedOrigins();

// ─── Navigation Map ─────────────────────────────────────────────
const NAVIGATION_MAP = Object.freeze({
  primary: Object.freeze([
    { label: 'HeadyMe', href: 'https://headyme.com', role: 'command_center' },
    { label: 'HeadyAI', href: 'https://headyai.com', role: 'intelligence_hub' },
    { label: 'HeadyAPI', href: 'https://headyapi.com', role: 'api_gateway' },
    { label: 'HeadyMCP', href: 'https://headymcp.com', role: 'mcp_gateway' },
  ]),
  secondary: Object.freeze([
    { label: 'HeadyIO', href: 'https://headyio.com', role: 'developer_portal' },
    { label: 'HeadyBot', href: 'https://headybot.com', role: 'bot_platform' },
    { label: 'HeadyBuddy', href: 'https://headybuddy.org', role: 'companion' },
    { label: 'HeadyConnection', href: 'https://headyconnection.org', role: 'community' },
  ]),
  admin: Object.freeze([
    { label: 'Admin', href: 'https://admin.headysystems.com', role: 'admin' },
    { label: 'Auth', href: 'https://auth.headysystems.com', role: 'auth' },
    { label: 'Platform', href: 'https://headysystems.com', role: 'platform_core' },
  ]),
});

// ─── Lookup Functions ───────────────────────────────────────────

/**
 * Find domain config by hostname (strips www. prefix).
 * @param {string} host
 * @returns {object|null}
 */
function getDomainByHost(host) {
  if (!host) return null;
  const normalized = host.replace(/^www\./, '');
  for (const domain of Object.values(HEADY_DOMAINS)) {
    if (domain.host === normalized) {
      return domain;
    }
  }
  return null;
}

/**
 * Check if an origin is in the allowed list.
 * @param {string} origin
 * @returns {boolean}
 */
function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}

module.exports = {
  HEADY_DOMAINS,
  ADMIN_SUBDOMAINS,
  ALLOWED_ORIGINS,
  NAVIGATION_MAP,
  getDomainByHost,
  isAllowedOrigin,
};
