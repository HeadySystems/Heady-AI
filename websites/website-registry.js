/**
 * @fileoverview Website Registry — Registry and Config for All 9 Heady Websites
 *
 * Each site: domain, purpose, auth config, CSL gate, deployment target,
 * Drupal content type mapping. All constants from φ — NO magic numbers.
 * CSL gates replace all boolean if/else.
 *
 * Founded by Eric Haywood — HeadySystems Inc. / HeadyConnection Inc.
 *
 * @module website-registry
 * @version 1.0.0
 * @license Proprietary — HeadySystems Inc.
 */

// ─── φ-MATH CONSTANTS ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948;
const PSI = 1 / PHI;
const PSI2 = PSI * PSI;
const PSI3 = PSI * PSI * PSI;
const PHI2 = PHI + 1;

const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  MINIMUM:  phiThreshold(0),
  LOW:      phiThreshold(1),
  MEDIUM:   phiThreshold(2),
  HIGH:     phiThreshold(3),
  CRITICAL: phiThreshold(4),
  DEDUP:    1 - Math.pow(PSI, 6) * 0.5,
};

const DETERMINISTIC_SEED = FIB[8] + FIB[5]; // 42
const DETERMINISTIC_TEMP = 0;

// ─── CSL GATE ───────────────────────────────────────────────────────────────────

function cslGate(confidence, threshold) {
  const delta = confidence - threshold;
  const signal = delta >= 0 ? 'PASS' : 'FAIL';
  const strength = Math.abs(delta) / PHI;
  return { signal, confidence, threshold, delta, strength };
}

// ─── PLATFORM ───────────────────────────────────────────────────────────────────

const PLATFORM = {
  gcpProject: 'gen-lang-client-0920560496',
  region: 'us-east1',
  cloudflareAccount: '8b1fa38f282c691423c6399247d53323',
  authDomain: 'auth.headysystems.com',
  github: 'https://github.com/HeadyMe',
  founder: 'Eric Haywood',
};

// ─── DEPLOYMENT TARGETS ─────────────────────────────────────────────────────────

const DEPLOY_TARGETS = {
  CLOUDFLARE_PAGES: 'cloudflare-pages',
  CLOUD_RUN:        'cloud-run',
  GKE:              'gke',
};

// ─── AUTH LEVELS ────────────────────────────────────────────────────────────────

const AUTH_LEVELS = {
  PUBLIC:     { level: 'public', cslThreshold: CSL_THRESHOLDS.MINIMUM, requiresLogin: false },
  USER:       { level: 'user', cslThreshold: CSL_THRESHOLDS.MEDIUM, requiresLogin: true },
  PRIVILEGED: { level: 'privileged', cslThreshold: CSL_THRESHOLDS.HIGH, requiresLogin: true },
  ADMIN:      { level: 'admin', cslThreshold: CSL_THRESHOLDS.CRITICAL, requiresLogin: true },
};

// ─── WEBSITE DEFINITIONS ────────────────────────────────────────────────────────

const WEBSITE_DEFINITIONS = [
  {
    id: 'headyme',
    domain: 'headyme.com',
    purpose: 'Command center — primary user-facing dashboard and control hub',
    category: 'core',
    authConfig: {
      ...AUTH_LEVELS.USER,
      domain: PLATFORM.authDomain,
      cookiePolicy: 'httpOnly',
      tokenStorage: 'httpOnly-cookie',
      sessionTTL: FIB[10] * FIB[4], // 445 minutes
      ssoEnabled: true,
    },
    cslGate: {
      accessThreshold: CSL_THRESHOLDS.MEDIUM,
      contentThreshold: CSL_THRESHOLDS.LOW,
      deployThreshold: CSL_THRESHOLDS.CRITICAL,
    },
    deployment: {
      target: DEPLOY_TARGETS.CLOUDFLARE_PAGES,
      cloudflareAccount: PLATFORM.cloudflareAccount,
      branch: 'main',
      buildCommand: 'npm run build',
      outputDir: 'dist',
      envVars: { NODE_ENV: 'production', HEADY_SEED: String(DETERMINISTIC_SEED) },
    },
    drupal: {
      contentTypes: ['dashboard_widget', 'user_profile', 'notification', 'activity_feed'],
      taxonomy: ['widget_category', 'notification_type', 'activity_type'],
      views: ['user_dashboard', 'recent_activity', 'notifications_list'],
      roles: ['authenticated', 'premium', 'admin'],
    },
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7], // 3310
    priority: PHI,
  },
  {
    id: 'headysystems',
    domain: 'headysystems.com',
    purpose: 'Core architecture — system documentation, API reference, developer portal',
    category: 'core',
    authConfig: {
      ...AUTH_LEVELS.PUBLIC,
      domain: PLATFORM.authDomain,
      cookiePolicy: 'httpOnly',
      tokenStorage: 'httpOnly-cookie',
      sessionTTL: FIB[10] * FIB[3], // 267 minutes
      ssoEnabled: true,
    },
    cslGate: {
      accessThreshold: CSL_THRESHOLDS.MINIMUM,
      contentThreshold: CSL_THRESHOLDS.MEDIUM,
      deployThreshold: CSL_THRESHOLDS.CRITICAL,
    },
    deployment: {
      target: DEPLOY_TARGETS.CLOUDFLARE_PAGES,
      cloudflareAccount: PLATFORM.cloudflareAccount,
      branch: 'main',
      buildCommand: 'npm run build',
      outputDir: 'dist',
      envVars: { NODE_ENV: 'production', HEADY_SEED: String(DETERMINISTIC_SEED) },
    },
    drupal: {
      contentTypes: ['documentation', 'api_reference', 'architecture_diagram', 'changelog'],
      taxonomy: ['doc_category', 'api_version', 'component_type'],
      views: ['docs_browser', 'api_explorer', 'architecture_overview'],
      roles: ['anonymous', 'developer', 'architect', 'admin'],
    },
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[1], // 3311
    priority: PHI / PHI2,
  },
  {
    id: 'heady-ai',
    domain: 'heady-ai.com',
    purpose: 'Intelligence hub — AI capabilities showcase, model playground, research',
    category: 'intelligence',
    authConfig: {
      ...AUTH_LEVELS.USER,
      domain: PLATFORM.authDomain,
      cookiePolicy: 'httpOnly',
      tokenStorage: 'httpOnly-cookie',
      sessionTTL: FIB[10] * FIB[4], // 445 minutes
      ssoEnabled: true,
    },
    cslGate: {
      accessThreshold: CSL_THRESHOLDS.MEDIUM,
      contentThreshold: CSL_THRESHOLDS.HIGH,
      deployThreshold: CSL_THRESHOLDS.CRITICAL,
    },
    deployment: {
      target: DEPLOY_TARGETS.CLOUD_RUN,
      gcpProject: PLATFORM.gcpProject,
      region: PLATFORM.region,
      maxInstances: FIB[6],  // 13
      minInstances: FIB[0],  // 1
      memory: `${FIB[10] * FIB[6]}Mi`, // 1157Mi
      cpu: FIB[2],           // 2
      envVars: { NODE_ENV: 'production', HEADY_SEED: String(DETERMINISTIC_SEED) },
    },
    drupal: {
      contentTypes: ['ai_model', 'research_paper', 'playground_config', 'benchmark_result'],
      taxonomy: ['model_family', 'research_domain', 'capability_tag'],
      views: ['model_gallery', 'research_feed', 'playground', 'benchmark_dashboard'],
      roles: ['authenticated', 'researcher', 'admin'],
    },
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[2], // 3312
    priority: PHI / (PHI + FIB[2]),
  },
  {
    id: 'headyos',
    domain: 'headyos.com',
    purpose: 'OS interface — interactive HeadyLatentOS management and monitoring',
    category: 'core',
    authConfig: {
      ...AUTH_LEVELS.PRIVILEGED,
      domain: PLATFORM.authDomain,
      cookiePolicy: 'httpOnly',
      tokenStorage: 'httpOnly-cookie',
      sessionTTL: FIB[9] * FIB[4], // 170 minutes
      ssoEnabled: true,
    },
    cslGate: {
      accessThreshold: CSL_THRESHOLDS.HIGH,
      contentThreshold: CSL_THRESHOLDS.HIGH,
      deployThreshold: CSL_THRESHOLDS.CRITICAL,
    },
    deployment: {
      target: DEPLOY_TARGETS.GKE,
      gcpProject: PLATFORM.gcpProject,
      region: PLATFORM.region,
      replicas: FIB[3],     // 3
      memory: `${FIB[11] * FIB[7]}Mi`, // 3024Mi
      cpu: FIB[3],           // 3
      envVars: { NODE_ENV: 'production', HEADY_SEED: String(DETERMINISTIC_SEED) },
    },
    drupal: {
      contentTypes: ['os_module', 'system_status', 'health_report', 'config_snapshot'],
      taxonomy: ['module_ring', 'status_type', 'health_metric'],
      views: ['module_explorer', 'system_health', 'config_manager', 'sacred_geometry_map'],
      roles: ['operator', 'sysadmin', 'admin'],
    },
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[3], // 3313
    priority: PHI / (PHI + FIB[3]),
  },
  {
    id: 'headyconnection-org',
    domain: 'headyconnection.org',
    purpose: 'Nonprofit — community outreach, education, mission, impact reporting',
    category: 'community',
    authConfig: {
      ...AUTH_LEVELS.PUBLIC,
      domain: PLATFORM.authDomain,
      cookiePolicy: 'httpOnly',
      tokenStorage: 'httpOnly-cookie',
      sessionTTL: FIB[10] * FIB[5], // 712 minutes
      ssoEnabled: false,
    },
    cslGate: {
      accessThreshold: CSL_THRESHOLDS.MINIMUM,
      contentThreshold: CSL_THRESHOLDS.LOW,
      deployThreshold: CSL_THRESHOLDS.HIGH,
    },
    deployment: {
      target: DEPLOY_TARGETS.CLOUDFLARE_PAGES,
      cloudflareAccount: PLATFORM.cloudflareAccount,
      branch: 'main',
      buildCommand: 'npm run build',
      outputDir: 'dist',
      envVars: { NODE_ENV: 'production', HEADY_SEED: String(DETERMINISTIC_SEED) },
    },
    drupal: {
      contentTypes: ['mission_statement', 'impact_report', 'event', 'blog_post', 'volunteer_profile'],
      taxonomy: ['impact_area', 'event_type', 'blog_category'],
      views: ['mission_overview', 'impact_dashboard', 'events_calendar', 'blog_feed', 'volunteer_directory'],
      roles: ['anonymous', 'volunteer', 'donor', 'board_member', 'admin'],
    },
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[4], // 3315
    priority: PSI,
  },
  {
    id: 'headyconnection-com',
    domain: 'headyconnection.com',
    purpose: 'Community — user forums, collaboration spaces, knowledge sharing',
    category: 'community',
    authConfig: {
      ...AUTH_LEVELS.USER,
      domain: PLATFORM.authDomain,
      cookiePolicy: 'httpOnly',
      tokenStorage: 'httpOnly-cookie',
      sessionTTL: FIB[10] * FIB[5], // 712 minutes
      ssoEnabled: true,
    },
    cslGate: {
      accessThreshold: CSL_THRESHOLDS.LOW,
      contentThreshold: CSL_THRESHOLDS.MEDIUM,
      deployThreshold: CSL_THRESHOLDS.HIGH,
    },
    deployment: {
      target: DEPLOY_TARGETS.CLOUDFLARE_PAGES,
      cloudflareAccount: PLATFORM.cloudflareAccount,
      branch: 'main',
      buildCommand: 'npm run build',
      outputDir: 'dist',
      envVars: { NODE_ENV: 'production', HEADY_SEED: String(DETERMINISTIC_SEED) },
    },
    drupal: {
      contentTypes: ['forum_topic', 'forum_reply', 'knowledge_article', 'user_project', 'showcase'],
      taxonomy: ['forum_category', 'knowledge_tag', 'project_type'],
      views: ['forum_list', 'knowledge_base', 'project_gallery', 'member_directory'],
      roles: ['authenticated', 'contributor', 'moderator', 'admin'],
    },
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[4] + FIB[0], // 3316
    priority: PSI,
  },
  {
    id: 'headyex',
    domain: 'headyex.com',
    purpose: 'Exchange — marketplace for models, plugins, templates, and integrations',
    category: 'commerce',
    authConfig: {
      ...AUTH_LEVELS.USER,
      domain: PLATFORM.authDomain,
      cookiePolicy: 'httpOnly',
      tokenStorage: 'httpOnly-cookie',
      sessionTTL: FIB[9] * FIB[5], // 272 minutes
      ssoEnabled: true,
    },
    cslGate: {
      accessThreshold: CSL_THRESHOLDS.MEDIUM,
      contentThreshold: CSL_THRESHOLDS.HIGH,
      deployThreshold: CSL_THRESHOLDS.CRITICAL,
    },
    deployment: {
      target: DEPLOY_TARGETS.CLOUD_RUN,
      gcpProject: PLATFORM.gcpProject,
      region: PLATFORM.region,
      maxInstances: FIB[5],  // 8
      minInstances: FIB[1],  // 1
      memory: `${FIB[10] * FIB[5]}Mi`, // 712Mi
      cpu: FIB[2],           // 2
      envVars: { NODE_ENV: 'production', HEADY_SEED: String(DETERMINISTIC_SEED) },
    },
    drupal: {
      contentTypes: ['listing', 'model_package', 'plugin', 'template', 'review', 'transaction'],
      taxonomy: ['listing_category', 'model_type', 'plugin_tag', 'rating'],
      views: ['marketplace_browse', 'model_catalog', 'plugin_directory', 'my_purchases', 'seller_dashboard'],
      roles: ['authenticated', 'buyer', 'seller', 'verified_seller', 'admin'],
    },
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[4] + FIB[2], // 3317
    priority: PSI2,
  },
  {
    id: 'headyfinance',
    domain: 'headyfinance.com',
    purpose: 'Finance — billing, subscriptions, usage analytics, cost management',
    category: 'commerce',
    authConfig: {
      ...AUTH_LEVELS.PRIVILEGED,
      domain: PLATFORM.authDomain,
      cookiePolicy: 'httpOnly',
      tokenStorage: 'httpOnly-cookie',
      sessionTTL: FIB[8] * FIB[4], // 170 minutes
      ssoEnabled: true,
    },
    cslGate: {
      accessThreshold: CSL_THRESHOLDS.HIGH,
      contentThreshold: CSL_THRESHOLDS.CRITICAL,
      deployThreshold: CSL_THRESHOLDS.CRITICAL,
    },
    deployment: {
      target: DEPLOY_TARGETS.GKE,
      gcpProject: PLATFORM.gcpProject,
      region: PLATFORM.region,
      replicas: FIB[3],     // 3
      memory: `${FIB[11] * FIB[5]}Mi`, // 1152Mi
      cpu: FIB[2],           // 2
      envVars: { NODE_ENV: 'production', HEADY_SEED: String(DETERMINISTIC_SEED) },
    },
    drupal: {
      contentTypes: ['invoice', 'subscription_plan', 'usage_report', 'cost_breakdown', 'payment_method'],
      taxonomy: ['plan_tier', 'usage_category', 'payment_type'],
      views: ['billing_dashboard', 'subscription_manager', 'usage_analytics', 'cost_explorer'],
      roles: ['billing_user', 'finance_admin', 'admin'],
    },
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[4] + FIB[3], // 3318
    priority: PSI2,
  },
  {
    id: 'admin-headysystems',
    domain: 'admin.headysystems.com',
    purpose: 'Admin — system administration, user management, global configuration',
    category: 'admin',
    authConfig: {
      ...AUTH_LEVELS.ADMIN,
      domain: PLATFORM.authDomain,
      cookiePolicy: 'httpOnly',
      tokenStorage: 'httpOnly-cookie',
      sessionTTL: FIB[8] * FIB[3], // 102 minutes
      ssoEnabled: true,
      mfaRequired: true,
    },
    cslGate: {
      accessThreshold: CSL_THRESHOLDS.CRITICAL,
      contentThreshold: CSL_THRESHOLDS.CRITICAL,
      deployThreshold: CSL_THRESHOLDS.CRITICAL,
    },
    deployment: {
      target: DEPLOY_TARGETS.GKE,
      gcpProject: PLATFORM.gcpProject,
      region: PLATFORM.region,
      replicas: FIB[2],     // 2
      memory: `${FIB[10] * FIB[5]}Mi`, // 712Mi
      cpu: FIB[2],           // 2
      envVars: { NODE_ENV: 'production', HEADY_SEED: String(DETERMINISTIC_SEED) },
    },
    drupal: {
      contentTypes: ['admin_page', 'user_account', 'role_definition', 'audit_log', 'system_config'],
      taxonomy: ['admin_section', 'permission_group', 'audit_category'],
      views: ['user_management', 'role_editor', 'audit_trail', 'config_editor', 'system_overview'],
      roles: ['super_admin'],
    },
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[4] + FIB[4], // 3320
    priority: PSI3,
  },
];

// ─── REGISTRY INDEX ─────────────────────────────────────────────────────────────

const SITE_MAP = new Map();
const DOMAIN_MAP = new Map();
for (const site of WEBSITE_DEFINITIONS) {
  SITE_MAP.set(site.id, site);
  DOMAIN_MAP.set(site.domain, site);
}

// ─── WEBSITE REGISTRY CLASS ─────────────────────────────────────────────────────

class WebsiteRegistry {
  constructor() {
    /** @private */
    this._sites = new Map(SITE_MAP);

    /** @private */
    this._domains = new Map(DOMAIN_MAP);

    /** @private */
    this._history = [];

    /** @private */
    this._listeners = new Map();
  }

  /**
   * Get site config by ID.
   * @param {string} id - Site ID
   * @returns {object|null}
   */
  getSite(id) {
    return this._sites.get(id) || null;
  }

  /**
   * Get site config by domain.
   * @param {string} domain
   * @returns {object|null}
   */
  getByDomain(domain) {
    return this._domains.get(domain) || null;
  }

  /**
   * Get all sites.
   * @returns {Array<object>}
   */
  getAllSites() {
    return [...this._sites.values()];
  }

  /**
   * Get sites by category.
   * @param {string} category
   * @returns {Array<object>}
   */
  getByCategory(category) {
    return [...this._sites.values()].filter(s => {
      const gate = cslGate(
        s.category === category ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      return gate.signal === 'PASS';
    });
  }

  /**
   * Get sites by auth level.
   * @param {string} level - AUTH_LEVELS key
   * @returns {Array<object>}
   */
  getByAuthLevel(level) {
    return [...this._sites.values()].filter(s => {
      const gate = cslGate(
        s.authConfig.level === level ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      return gate.signal === 'PASS';
    });
  }

  /**
   * Get sites by deployment target.
   * @param {string} target
   * @returns {Array<object>}
   */
  getByDeployTarget(target) {
    return [...this._sites.values()].filter(s => {
      const gate = cslGate(
        s.deployment.target === target ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      return gate.signal === 'PASS';
    });
  }

  /**
   * Check if a user's CSL confidence allows access to a site.
   * @param {string} siteId
   * @param {number} userConfidence
   * @returns {{ allowed: boolean, gate: object }}
   */
  checkAccess(siteId, userConfidence) {
    const site = this._sites.get(siteId);
    const exists = cslGate(
      site ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );

    if (exists.signal === 'FAIL') {
      return { allowed: false, gate: exists, reason: 'Site not found' };
    }

    const gate = cslGate(userConfidence, site.cslGate.accessThreshold);
    this._recordHistory('checkAccess', { siteId, userConfidence, result: gate.signal });

    return {
      allowed: gate.signal === 'PASS',
      gate,
      site: site.id,
      domain: site.domain,
      requiredThreshold: site.cslGate.accessThreshold,
    };
  }

  /**
   * Validate all sites in the registry.
   * @returns {{ valid: boolean, results: Array<object> }}
   */
  validateAll() {
    const results = [];

    for (const site of this._sites.values()) {
      const errors = [];

      const authGate = cslGate(
        site.authConfig.cookiePolicy === 'httpOnly' ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.HIGH
      );
      authGate.signal === 'FAIL' && errors.push(`${site.id}: Must use httpOnly cookies`);

      const tokenGate = cslGate(
        site.authConfig.tokenStorage === 'httpOnly-cookie' ? CSL_THRESHOLDS.CRITICAL : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.HIGH
      );
      tokenGate.signal === 'FAIL' && errors.push(`${site.id}: Must use httpOnly-cookie storage`);

      const drupalGate = cslGate(
        site.drupal && site.drupal.contentTypes && site.drupal.contentTypes.length > 0
          ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      drupalGate.signal === 'FAIL' && errors.push(`${site.id}: Missing Drupal content types`);

      const deployGate = cslGate(
        site.deployment && site.deployment.target ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      deployGate.signal === 'FAIL' && errors.push(`${site.id}: Missing deployment target`);

      results.push({
        id: site.id,
        domain: site.domain,
        valid: errors.length === 0,
        errors,
      });
    }

    const allValid = results.every(r => r.valid);
    const overallConfidence = allValid
      ? CSL_THRESHOLDS.CRITICAL
      : CSL_THRESHOLDS.MINIMUM * Math.pow(PSI, results.filter(r => !r.valid).length);

    this._recordHistory('validateAll', { allValid, siteCount: results.length });

    return {
      valid: allValid,
      confidence: overallConfidence,
      siteCount: results.length,
      results,
      founder: 'Eric Haywood',
    };
  }

  /**
   * Get the deployment manifest for all sites.
   * @returns {object}
   */
  getDeploymentManifest() {
    const manifest = {
      timestamp: new Date().toISOString(),
      founder: 'Eric Haywood',
      platform: { ...PLATFORM },
      sites: [],
    };

    for (const site of this._sites.values()) {
      manifest.sites.push({
        id: site.id,
        domain: site.domain,
        target: site.deployment.target,
        port: site.port,
        priority: site.priority,
        authLevel: site.authConfig.level,
        cslAccessThreshold: site.cslGate.accessThreshold,
      });
    }

    manifest.sites.sort((a, b) => b.priority - a.priority);
    return manifest;
  }

  /**
   * Get Drupal content type summary.
   * @returns {object}
   */
  getDrupalSummary() {
    const allContentTypes = new Set();
    const allTaxonomies = new Set();
    const allViews = new Set();
    const allRoles = new Set();

    for (const site of this._sites.values()) {
      site.drupal.contentTypes.forEach(ct => allContentTypes.add(ct));
      site.drupal.taxonomy.forEach(t => allTaxonomies.add(t));
      site.drupal.views.forEach(v => allViews.add(v));
      site.drupal.roles.forEach(r => allRoles.add(r));
    }

    return {
      totalSites: this._sites.size,
      totalContentTypes: allContentTypes.size,
      totalTaxonomies: allTaxonomies.size,
      totalViews: allViews.size,
      totalRoles: allRoles.size,
      contentTypes: [...allContentTypes].sort(),
      taxonomies: [...allTaxonomies].sort(),
      views: [...allViews].sort(),
      roles: [...allRoles].sort(),
      founder: 'Eric Haywood',
    };
  }

  /**
   * Get history log.
   * @returns {Array<object>}
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Subscribe to events.
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    const handlers = this._listeners.get(event) || [];
    handlers.push(handler);
    this._listeners.set(event, handlers);
  }

  /** @private */
  _notify(event, data) {
    for (const h of (this._listeners.get(event) || [])) {
      h({ event, timestamp: new Date().toISOString(), ...data });
    }
  }

  /** @private */
  _recordHistory(action, details) {
    this._history.push({ action, timestamp: new Date().toISOString(), details });
    const maxHistory = FIB[12]; // 233
    const gate = cslGate(
      this._history.length > maxHistory ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    gate.signal === 'PASS' && this._history.splice(0, this._history.length - maxHistory);
  }
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────────

export default WebsiteRegistry;

export {
  WebsiteRegistry,
  WEBSITE_DEFINITIONS,
  SITE_MAP,
  DOMAIN_MAP,
  DEPLOY_TARGETS,
  AUTH_LEVELS,
  PLATFORM,
  CSL_THRESHOLDS,
  PHI, PSI, PSI2, PSI3, PHI2,
  FIB,
  DETERMINISTIC_SEED,
  cslGate,
  phiThreshold,
};
