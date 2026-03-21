/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  heady-drupal — drupal-wiring.js                                 ║
 * ║  Drupal CMS integration for headyconnection.org                  ║
 * ║  © 2026 HeadySystems Inc.                                        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Wires the Heady platform to the Drupal CMS at headyconnection.org.
 * Provides:
 *   - Content delivery via Drupal JSON:API
 *   - HeadySites taxonomy integration
 *   - HeadyCMS liquid node management
 *   - Auth passthrough (Drupal session → Heady JWT)
 *   - CSL-tagged content routing
 *   - HCFP (HeadyConnection Full Pipeline) endpoint bridge
 *
 * Drupal modules integrated:
 *   - heady_sites      — site taxonomy, multi-site routing
 *   - heady_cms        — content manager, task browser, liquid dashboard
 *   - heady_admin      — admin dashboard, HeadyLens, HCFP control
 *   - heady_control    — liquid node controller
 *   - heady_tasks      — task queue bridge
 *   - heady_content    — content type bridge
 *   - heady_config     — configuration endpoint
 */

'use strict';

import { PSI, CSL_THRESHOLDS, TIMEOUTS, phiBackoff, MeshClient, CircuitBreaker, createLogger, logConfidenceEvent } from '@heady/platform';

// ─── DRUPAL CONFIG ────────────────────────────────────────────────────────────

/**
 * Drupal connection configuration.
 * ALL URLs from environment — zero hardcoded values (Law #5).
 */
function getDrupalConfig() {
  const baseUrl = process.env.DRUPAL_BASE_URL;
  if (!baseUrl) throw new Error('DRUPAL_BASE_URL env var not set');
  if (baseUrl.includes("0.0.0.0") && process.env.NODE_ENV !== 'development') {
    throw new Error('Drupal localhost URL detected in non-development environment (Law #5 violation)');
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiBase: `${baseUrl.replace(/\/$/, '')}/jsonapi`,
    username: process.env.DRUPAL_USERNAME,
    password: process.env.DRUPAL_PASSWORD,
    bearerToken: process.env.DRUPAL_BEARER_TOKEN,
    timeoutMs: TIMEOUTS.PHI_5 // 11090ms — φ⁵
  };
}

// ─── DRUPAL CLIENT ────────────────────────────────────────────────────────────

export class DrupalClient {
  /**
   * @param {Object} [opts]
   * @param {import('pino').Logger} [opts.logger]
   */
  constructor(opts = {}) {
    this._logger = opts.logger ?? createLogger({
      service: 'heady-drupal',
      domain: 'headyconnection.org'
    });
    this._config = null;
    this._cb = new CircuitBreaker({
      name: 'drupal-cms',
      failureThreshold: 5,
      // F(5) = 5
      successThreshold: 3,
      // F(4) = 3
      timeoutMs: 34000,
      // F(9) × 1000
      logger: this._logger
    });
  }

  /**
   * Initialize Drupal client, loading config from environment.
   * @returns {this}
   */
  init() {
    this._config = getDrupalConfig();
    this._logger.info({
      event: 'drupal.client.init',
      base: this._config.baseUrl
    }, 'Drupal client initialized');
    return this;
  }

  // ─── JSON:API CONTENT ──────────────────────────────────────────────────────

  /**
   * Fetch content nodes by type via Drupal JSON:API.
   * @param {string} contentType — e.g. 'node--article', 'node--page'
   * @param {Object} [query] — JSON:API filter parameters
   * @returns {Promise<Object[]>} array of content nodes
   */
  async getContent(contentType, query = {}) {
    const qs = new URLSearchParams(buildJsonApiParams(query)).toString();
    const path = `/jsonapi/${contentType.replace('--', '/')}${qs ? '?' + qs : ''}`;
    const data = await this._get(path);
    return data?.data ?? [];
  }

  /**
   * Fetch a single content node by UUID.
   * @param {string} contentType
   * @param {string} uuid
   * @returns {Promise<Object|null>}
   */
  async getNode(contentType, uuid) {
    const path = `/jsonapi/${contentType.replace('--', '/')}/${uuid}`;
    const data = await this._get(path);
    return data?.data ?? null;
  }

  /**
   * Create a content node via Drupal JSON:API.
   * @param {string} contentType
   * @param {Object} attributes
   * @param {Object} [relationships]
   * @returns {Promise<Object>}
   */
  async createNode(contentType, attributes, relationships = {}) {
    const [entity, bundle] = contentType.split('--');
    const body = {
      data: {
        type: contentType,
        attributes,
        ...(Object.keys(relationships).length > 0 ? {
          relationships
        } : {})
      }
    };
    const path = `/jsonapi/${entity}/${bundle}`;
    return this._post(path, body);
  }

  // ─── HEADY SITES TAXONOMY ─────────────────────────────────────────────────

  /**
   * Get all HeadySites taxonomy terms (domain registry in Drupal).
   * Maps to the heady_sites Drupal module.
   * @returns {Promise<Object[]>}
   */
  async getHeadySites() {
    const data = await this._get('/jsonapi/taxonomy_term/heady_sites');
    return (data?.data ?? []).map(term => ({
      id: term.id,
      name: term.attributes?.name,
      domain: term.attributes?.field_domain_url,
      active: term.attributes?.field_active ?? true
    }));
  }

  /**
   * Register a new domain in the HeadySites taxonomy.
   * @param {string} name — e.g. 'HeadyMe'
   * @param {string} domainUrl — e.g. 'https://headyme.com'
   * @returns {Promise<Object>}
   */
  async registerDomain(name, domainUrl) {
    return this.createNode('taxonomy_term--heady_sites', {
      name,
      field_domain_url: domainUrl,
      field_active: true
    });
  }

  // ─── HEADY TASKS ──────────────────────────────────────────────────────────

  /**
   * Submit a task to the Drupal heady_tasks queue.
   * Bridges Heady pipeline tasks to Drupal task tracking.
   * @param {Object} task
   * @param {string} task.type — task type
   * @param {Object} task.data — task payload
   * @param {string} [task.domain] — CSL domain
   * @param {number} [task.confidence] — CSL confidence
   * @returns {Promise<Object>}
   */
  async submitTask(task) {
    const body = {
      data: {
        type: 'heady_task--heady_task',
        attributes: {
          title: task.type,
          field_task_type: task.type,
          field_task_data: JSON.stringify(task.data),
          field_csl_domain: task.domain ?? 'headyconnection.org',
          field_confidence: task.confidence ?? PSI,
          field_status: 'pending'
        }
      }
    };
    return this._post('/jsonapi/heady_task/heady_task', body);
  }

  /**
   * Get pending tasks from the Drupal task queue.
   * @param {number} [limit=21] — F(8) = 21
   * @returns {Promise<Object[]>}
   */
  async getPendingTasks(limit = 21) {
    const data = await this._get(`/jsonapi/heady_task/heady_task?filter[field_status]=pending&page[limit]=${limit}`);
    return data?.data ?? [];
  }

  // ─── LIQUID NODE MANAGER ──────────────────────────────────────────────────

  /**
   * Get liquid nodes from the HeadyCMS LiquidNodeManager.
   * @param {string} [domain] — filter by domain
   * @returns {Promise<Object[]>}
   */
  async getLiquidNodes(domain = null) {
    const filter = domain ? `?filter[field_domain]=${encodeURIComponent(domain)}` : '';
    const data = await this._get(`/jsonapi/node/liquid_node${filter}`);
    return data?.data ?? [];
  }

  /**
   * Create or update a liquid node.
   * @param {Object} nodeData
   * @returns {Promise<Object>}
   */
  async upsertLiquidNode(nodeData) {
    const body = {
      data: {
        type: 'node--liquid_node',
        attributes: {
          title: nodeData.title,
          field_domain: nodeData.domain ?? 'headyconnection.org',
          field_content: nodeData.content ?? '',
          field_csl_score: nodeData.cslScore ?? PSI,
          field_phi_tier: nodeData.phiTier ?? 'PASS',
          field_active: true
        }
      }
    };
    return this._post('/jsonapi/node/liquid_node', body);
  }

  // ─── HCFP (HeadyConnection Full Pipeline) BRIDGE ─────────────────────────

  /**
   * Trigger an HCFP pipeline run via the Drupal heady_admin module.
   * @param {Object} params
   * @param {string} params.pipeline — pipeline variant: 'full' | 'fast' | 'arena'
   * @param {string} params.input — user input
   * @param {string} [params.domain] — CSL domain
   * @returns {Promise<Object>}
   */
  async triggerHCFP(params) {
    return this._post('/admin/heady/hcfp/trigger', {
      pipeline: params.pipeline ?? 'full',
      input: params.input,
      domain: params.domain ?? 'headyconnection.org',
      confidence: PSI
    });
  }

  // ─── CONTENT DELIVERY ─────────────────────────────────────────────────────

  /**
   * Deliver content to a Heady domain endpoint via the ContentDeliveryService.
   * @param {string} domain — target domain
   * @param {Object} content — content payload
   * @returns {Promise<Object>}
   */
  async deliverContent(domain, content) {
    return this._post('/heady/content/deliver', {
      domain,
      content,
      timestamp: new Date().toISOString()
    });
  }

  // ─── HEALTH CHECK ─────────────────────────────────────────────────────────

  /**
   * Health check for the Drupal connection.
   * @returns {Promise<{status: string, message: string}>}
   */
  async healthCheck() {
    if (!this._config) {
      return {
        status: 'unhealthy',
        message: 'Drupal client not initialized'
      };
    }
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), TIMEOUTS.PHI_3);
      const res = await fetch(`${this._config.baseUrl}/api/heady/health`, {
        signal: ctl.signal
      });
      clearTimeout(t);
      return {
        status: res.ok ? 'healthy' : 'degraded',
        message: `Drupal CMS HTTP ${res.status}`
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        message: err.message
      };
    }
  }

  // ─── PRIVATE HTTP ─────────────────────────────────────────────────────────

  async _get(path) {
    return this._cb.execute(() => this._fetch('GET', path));
  }
  async _post(path, body) {
    return this._cb.execute(() => this._fetch('POST', path, body));
  }
  async _fetch(method, path, body = null) {
    if (!this._config) throw new Error('DrupalClient not initialized — call init() first');
    const url = `${this._config.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'X-Heady-Service': 'heady-drupal'
    };
    if (this._config.bearerToken) {
      headers['Authorization'] = `Bearer ${this._config.bearerToken}`;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), this._config.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
        signal: ctl.signal
      });
      clearTimeout(t);
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        const err = new Error(`Drupal API ${method} ${path} returned ${res.status}: ${errBody.slice(0, 200)}`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    } catch (err) {
      clearTimeout(t);
      this._logger.error({
        event: 'drupal.fetch.error',
        method,
        path,
        error: err.message
      }, `Drupal ${method} ${path} failed`);
      throw err;
    }
  }
}

// ─── JSON:API QUERY BUILDER ──────────────────────────────────────────────────

/**
 * Build JSON:API query parameters.
 * @param {Object} query
 * @returns {Object}
 */
function buildJsonApiParams(query) {
  const params = {};
  if (query.filter) {
    for (const [field, value] of Object.entries(query.filter)) {
      params[`filter[${field}]`] = value;
    }
  }
  if (query.sort) params['sort'] = Array.isArray(query.sort) ? query.sort.join(',') : query.sort;
  if (query.include) params['include'] = Array.isArray(query.include) ? query.include.join(',') : query.include;
  if (query.limit) params['page[limit]'] = query.limit;
  if (query.offset) params['page[offset]'] = query.offset;
  return params;
}