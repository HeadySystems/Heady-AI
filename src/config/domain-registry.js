/**
 * ═══════════════════════════════════════════════════════════════════════
 *  HEADY DOMAIN REGISTRY — code projection of the domain canon
 *  SoT: facts.yaml `domains:` (repo root, golden record). This file MUST
 *  stay consistent with it — the coherence gate treats facts.yaml as canon.
 *  ADR-0019: Nine-domain brand architecture
 *  ADR-0024: Domain registry canonical file (code-level)
 *  ADR-0011: Node.js ESM only
 *  ADR-0006: phi-math — no magic numbers
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This file is the code-level registry for:
 *   - Domain → legal entity mapping  (IRS compliance)
 *   - Domain → Firebase Auth tenant  (session isolation)
 *   - Domain → Sacred Geometry layer (topology)
 *   - Domain → revenue model         (billing attribution)
 *   - Domain → CORS allowlist        (src/middleware/cors.js)
 *   - Domain → PQC key namespace     (src/security/pqc.js)
 *
 * NEVER hard-code domain strings elsewhere. Import from here.
 * ADR Sentinel CI job verifies all Cloudflare/Firebase/routing configs
 * reference only domains present in this registry.
 *
 * `status` mirrors facts.yaml domains: 'verified' = founder-ruled canonical
 * surface confirmed live; 'unverified' = declared by a registry, but
 * Cloudflare zone/account verification is a recorded HUMAN-GATED step (the
 * available Cloudflare API token lacks zone scope). Domains carried only by
 * configs/_domains/site-registry.yaml (headysystems.com, headybuddy.org,
 * headyio.com, headyapi.com) are catalogued in facts.yaml and join this
 * registry when the founder ratifies their brand architecture
 * (entity/tenant/revenue).
 */

// ─── Enumerations ──────────────────────────────────────────────────────

/** @enum {string} Legal entities in the Heady ecosystem */
export const Entity = Object.freeze({
  HEADY_SYSTEMS:     'HeadySystems',
  HEADY_CONNECTION:  'HeadyConnection',
});

/** @enum {string} Sacred Geometry topology layers (ADR-0015) */
export const Layer = Object.freeze({
  CENTER:     'Center',
  INNER:      'Inner',
  MIDDLE:     'Middle',
  OUTER:      'Outer',
  GOVERNANCE: 'Governance',
  MEMORY:     'Memory',
  OPS:        'Ops',
});

/** @enum {string} Domain categories */
export const Category = Object.freeze({
  CORE:      'core',
  ADMIN:     'admin',
  AI:        'ai',
  MCP:       'mcp',
  COMPANION: 'companion',
  OS:        'os',
  FINTECH:   'fintech',
  RESEARCH:  'research',
  NONPROFIT: 'nonprofit',
  WEB:       'web',
});

/** @enum {string} Domain verification status — mirrors facts.yaml domains */
export const DomainStatus = Object.freeze({
  VERIFIED:   'verified',
  UNVERIFIED: 'unverified',
});

/** @enum {string} Revenue model types */
export const Revenue = Object.freeze({
  SAAS_SUBSCRIPTION: 'saas_subscription',
  API_CREDITS:       'api_credits',
  API_PER_REQUEST:   'api_per_request',
  SAAS_USAGE:        'saas_usage',
  ENTERPRISE:        'enterprise',
  REVENUE_SHARE:     'revenue_share',
  GRANTS_DONATIONS:  'grants_donations',
  AD_SUPPORTED:      'ad_supported',
  INTERNAL:          'internal',
});

// ─── Canonical Registry ───────────────────────────────────────────────

/**
 * @typedef {Object} DomainEntry
 * @property {string}   entity      - Legal entity owner (Entity enum)
 * @property {string}   category    - Domain category (Category enum)
 * @property {string}   layer       - Sacred Geometry layer (Layer enum)
 * @property {string}   tenant      - Firebase Auth tenant ID
 * @property {string}   revenue     - Revenue model (Revenue enum)
 * @property {boolean}  commercial  - false = nonprofit (IRS boundary)
 * @property {string}   status      - Verification status (DomainStatus enum, mirrors facts.yaml)
 * @property {string}   description - Human-readable purpose
 */

/** @type {Record<string, DomainEntry>} */
export const DOMAIN_REGISTRY = Object.freeze({
  'headyme.com': {
    entity:      Entity.HEADY_SYSTEMS,
    category:    Category.CORE,
    layer:       Layer.CENTER,
    tenant:      'headyme',
    revenue:     Revenue.SAAS_SUBSCRIPTION,
    commercial:  true,
    status:      DomainStatus.VERIFIED,
    description: 'Primary user surface — user workspace, dashboard, primary SaaS entrypoint',
  },
  '1ime1.com': {
    entity:      Entity.HEADY_SYSTEMS,
    category:    Category.ADMIN,
    layer:       Layer.OPS,
    tenant:      '1ime1',
    revenue:     Revenue.INTERNAL,
    commercial:  true,
    status:      DomainStatus.VERIFIED,
    description: 'Admin surface — apps/headyme-portal via Firebase Hosting (project heady-ai)',
  },
  'headyai.com': {
    entity:      Entity.HEADY_SYSTEMS,
    category:    Category.AI,
    layer:       Layer.INNER,
    tenant:      'headyai',
    revenue:     Revenue.API_CREDITS,
    commercial:  true,
    status:      DomainStatus.UNVERIFIED,
    description: 'AI orchestration hub — HCFullPipeline API, swarm access, model racing',
  },
  'headymcp.com': {
    entity:      Entity.HEADY_SYSTEMS,
    category:    Category.MCP,
    layer:       Layer.INNER,
    tenant:      'headymcp',
    revenue:     Revenue.API_PER_REQUEST,
    commercial:  true,
    status:      DomainStatus.VERIFIED,
    description: 'MCP gateway — Model Context Protocol server, tool registry, JSON-RPC',
  },
  'headybuddy.com': {
    entity:      Entity.HEADY_SYSTEMS,
    category:    Category.COMPANION,
    layer:       Layer.MIDDLE,
    tenant:      'headybuddy',
    revenue:     Revenue.SAAS_USAGE,
    commercial:  true,
    status:      DomainStatus.UNVERIFIED,
    description: 'HeadyBuddy companion AI — conversational agent, cross-device bridge',
  },
  'headyos.com': {
    entity:      Entity.HEADY_SYSTEMS,
    category:    Category.OS,
    layer:       Layer.MIDDLE,
    tenant:      'headyos',
    revenue:     Revenue.ENTERPRISE,
    commercial:  true,
    status:      DomainStatus.UNVERIFIED,
    description: 'Heady Latent OS — enterprise licensing, sovereign AI platform',
  },
  'headytrade.com': {
    entity:      Entity.HEADY_SYSTEMS,
    category:    Category.FINTECH,
    layer:       Layer.OUTER,
    tenant:      'headytrade',
    revenue:     Revenue.REVENUE_SHARE,
    commercial:  true,
    status:      DomainStatus.UNVERIFIED,
    description: 'FinTech / trading — HeadyCoin, Apex trading risk, subscription tiers',
  },
  'headylab.com': {
    entity:      Entity.HEADY_SYSTEMS,
    category:    Category.RESEARCH,
    layer:       Layer.OUTER,
    tenant:      'headylab',
    revenue:     Revenue.ENTERPRISE,
    commercial:  true,
    status:      DomainStatus.UNVERIFIED,
    description: 'Research + patent lab — IP portfolio, provisional patents, R&D docs',
  },
  'headyconnection.org': {
    entity:      Entity.HEADY_CONNECTION,
    category:    Category.NONPROFIT,
    layer:       Layer.GOVERNANCE,
    tenant:      'headyconnection',
    revenue:     Revenue.GRANTS_DONATIONS,
    commercial:  false,  // IRS 501(c)(3) — zero commercial features allowed
    status:      DomainStatus.VERIFIED,
    description: 'HeadyConnection Inc. nonprofit portal — grants, community, education',
  },
  'headyweb.com': {
    entity:      Entity.HEADY_SYSTEMS,
    category:    Category.WEB,
    layer:       Layer.OPS,
    tenant:      'headyweb',
    revenue:     Revenue.AD_SUPPORTED,
    commercial:  true,
    status:      DomainStatus.UNVERIFIED,
    description: 'Web / frontend hub — open access, landing pages, micro-frontend host',
  },
});

// ─── Derived Lookups (computed once at module load) ───────────────────

/** All domain hostnames as a frozen array */
export const ALL_DOMAINS = Object.freeze(Object.keys(DOMAIN_REGISTRY));

/** Allowed HTTPS origins for CORS (src/middleware/cors.js imports this) */
export const ALLOWED_ORIGINS = Object.freeze(
  ALL_DOMAINS.map(d => `https://${d}`)
);

/** Set of allowed origins for O(1) lookup */
export const ALLOWED_ORIGINS_SET = new Set(ALLOWED_ORIGINS);

/** Nonprofit-only domains (IRS boundary) */
export const NONPROFIT_DOMAINS = Object.freeze(
  ALL_DOMAINS.filter(d => !DOMAIN_REGISTRY[d].commercial)
);

/** Commercial domains */
export const COMMERCIAL_DOMAINS = Object.freeze(
  ALL_DOMAINS.filter(d => DOMAIN_REGISTRY[d].commercial)
);

/** Founder-verified canonical surfaces (facts.yaml domains, status: verified) */
export const VERIFIED_DOMAINS = Object.freeze(
  ALL_DOMAINS.filter(d => DOMAIN_REGISTRY[d].status === DomainStatus.VERIFIED)
);

/** Declared but pending human-gated Cloudflare zone verification */
export const UNVERIFIED_DOMAINS = Object.freeze(
  ALL_DOMAINS.filter(d => DOMAIN_REGISTRY[d].status === DomainStatus.UNVERIFIED)
);

/** Domains grouped by Sacred Geometry layer */
export const DOMAINS_BY_LAYER = Object.freeze(
  ALL_DOMAINS.reduce((acc, domain) => {
    const { layer } = DOMAIN_REGISTRY[domain];
    if (!acc[layer]) acc[layer] = [];
    acc[layer].push(domain);
    return acc;
  }, {})
);

/** Domains grouped by legal entity */
export const DOMAINS_BY_ENTITY = Object.freeze(
  ALL_DOMAINS.reduce((acc, domain) => {
    const { entity } = DOMAIN_REGISTRY[domain];
    if (!acc[entity]) acc[entity] = [];
    acc[entity].push(domain);
    return acc;
  }, {})
);

// ─── Guard Utilities ──────────────────────────────────────────────────

/**
 * Assert a domain exists in the registry (throws if not found).
 * Use in route handlers and CI validation scripts.
 * @param {string} domain
 * @returns {DomainEntry}
 */
export function assertDomain(domain) {
  const entry = DOMAIN_REGISTRY[domain];
  if (!entry) throw new Error(`Domain '${domain}' is not registered in DOMAIN_REGISTRY (ADR-0019/ADR-0024)`);
  return entry;
}

/**
 * Check if an origin is in the allowed CORS set.
 * @param {string} origin - e.g. 'https://headyme.com'
 * @returns {boolean}
 */
export function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS_SET.has(origin);
}

/**
 * Resolve the Firebase Auth tenant for an incoming request origin.
 * @param {string} origin - e.g. 'https://headyme.com'
 * @returns {string|null}
 */
export function tenantForOrigin(origin) {
  const domain = origin.replace(/^https?:\/\//, '');
  return DOMAIN_REGISTRY[domain]?.tenant ?? null;
}

/**
 * Return the PQC key namespace for a domain (ADR-0021).
 * Format: '{tenant}:{serviceId}'
 * @param {string} domain
 * @param {string} serviceId
 * @returns {string}
 */
export function pqcKeyNamespace(domain, serviceId) {
  const entry = assertDomain(domain);
  return `${entry.tenant}:${serviceId}`;
}
