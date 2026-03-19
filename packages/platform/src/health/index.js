/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  @heady-ai/platform — health/index.js                               ║
 * ║  Health endpoint factory (live/ready/startup/details)            ║
 * ║  © 2026 HeadySystems Inc.                                        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Provides standardized health endpoints for all 50 Heady services.
 * Endpoints:
 *   GET /health          — combined liveness + readiness (simple)
 *   GET /health/live     — Kubernetes liveness probe
 *   GET /health/ready    — Kubernetes readiness probe
 *   GET /health/startup  — Kubernetes startup probe
 *   GET /health/details  — phi-enriched detail with CSL scores, phi_context
 *
 * All responses include:
 *   - status: 'healthy' | 'degraded' | 'unhealthy'
 *   - service, version, domain
 *   - phi_context.coherence — phi-compliance score
 *   - uptime_ms
 *   - checks: {[checkName]: CheckResult}
 *   - timestamp: ISO-8601 UTC
 */

'use strict';

import { PSI, CSL_THRESHOLDS, TIMEOUTS, PHI } from '../phi/index.js';

// ─── TYPES ────────────────────────────────────────────────────────────────────

/**
 * @typedef {'healthy'|'degraded'|'unhealthy'} HealthStatus
 */

/**
 * @typedef {Object} CheckResult
 * @property {HealthStatus} status
 * @property {number} [latencyMs]
 * @property {string} [message]
 * @property {Object} [meta]
 */

/**
 * @typedef {() => Promise<CheckResult>} HealthCheck
 */

// ─── STATUS AGGREGATION ──────────────────────────────────────────────────────

/**
 * Aggregate multiple check results into a single status.
 * Healthy if all checks healthy; degraded if any degraded; unhealthy if any unhealthy.
 * @param {CheckResult[]} results
 * @returns {HealthStatus}
 */
function aggregateStatus(results) {
  if (results.some(r => r.status === 'unhealthy')) return 'unhealthy';
  if (results.some(r => r.status === 'degraded'))  return 'degraded';
  return 'healthy';
}

/**
 * HTTP status code for a health status.
 * 200 = healthy, 207 = degraded, 503 = unhealthy
 * @param {HealthStatus} status
 * @returns {number}
 */
function statusCode(status) {
  if (status === 'healthy')  return 200;
  if (status === 'degraded') return 207;
  return 503;
}

// ─── PHI COHERENCE SCORING ───────────────────────────────────────────────────

/**
 * Compute a phi-coherence score for health results.
 * coherence = (healthy_count / total) normalized against ψ thresholds.
 * @param {CheckResult[]} results
 * @returns {number} coherence ∈ [0, 1]
 */
function computeCoherence(results) {
  if (!results.length) return 1;
  const healthyCount = results.filter(r => r.status === 'healthy').length;
  const degradedCount = results.filter(r => r.status === 'degraded').length;
  // Healthy = 1.0, degraded = ψ (0.618), unhealthy = 0
  const score = (healthyCount + degradedCount * PSI) / results.length;
  return Math.round(score * 1000) / 1000;
}

// ─── HEALTH REGISTRY ─────────────────────────────────────────────────────────

export class HealthRegistry {
  /**
   * @param {Object} opts
   * @param {string} opts.service
   * @param {string} [opts.version]
   * @param {string} [opts.domain]
   */
  constructor(opts = {}) {
    this._service = opts.service ?? process.env.SERVICE_NAME ?? 'unknown';
    this._version = opts.version ?? process.env.SERVICE_VERSION ?? 'unknown';
    this._domain  = opts.domain  ?? process.env.HEADY_DOMAIN   ?? 'unassigned';
    this._startAt = Date.now();
    this._checks  = new Map(); // name → HealthCheck
    this._ready   = false;
  }

  /**
   * Register a named health check.
   * @param {string} name
   * @param {HealthCheck} checkFn
   * @returns {this}
   */
  register(name, checkFn) {
    if (typeof checkFn !== 'function') throw new TypeError(`Health check '${name}' must be a function`);
    this._checks.set(name, checkFn);
    return this;
  }

  /**
   * Signal that the service has completed startup and is ready to serve traffic.
   * Until this is called, /health/ready returns 503.
   */
  markReady() {
    this._ready = true;
  }

  /**
   * Run all registered health checks, returning results map.
   * Each check has a phi-timeout: φ³ × 1000 = 4,236 ms.
   * @returns {Promise<Record<string, CheckResult>>}
   */
  async runChecks() {
    const timeout = TIMEOUTS.PHI_3; // 4236 ms
    const results = {};

    await Promise.all(
      Array.from(this._checks.entries()).map(async ([name, fn]) => {
        const start = Date.now();
        try {
          const checkPromise = fn();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Health check '${name}' timed out after ${timeout}ms`)), timeout)
          );
          const result = await Promise.race([checkPromise, timeoutPromise]);
          results[name] = { ...result, latencyMs: Date.now() - start };
        } catch (err) {
          results[name] = {
            status: 'unhealthy',
            latencyMs: Date.now() - start,
            message: err.message,
          };
        }
      })
    );

    return results;
  }

  /**
   * Build the full health response payload.
   * @param {'full'|'simple'} [detail='full']
   * @returns {Promise<Object>}
   */
  async buildResponse(detail = 'full') {
    const checkResults = await this.runChecks();
    const resultValues = Object.values(checkResults);
    const status = aggregateStatus(resultValues);
    const coherence = computeCoherence(resultValues);
    const uptimeMs = Date.now() - this._startAt;

    const base = {
      status,
      service:   this._service,
      version:   this._version,
      domain:    this._domain,
      uptime_ms: uptimeMs,
      timestamp: new Date().toISOString(),
      phi_context: {
        coherence,
        confidence:    PSI,             // ψ = 0.618 baseline
        phi_compliant: coherence >= CSL_THRESHOLDS.PASS,
        state: coherence >= CSL_THRESHOLDS.STEADY ? 'STEADY' :
               coherence >= CSL_THRESHOLDS.PASS ? 'PASS' : 'BELOW_THRESHOLD',
      },
    };

    if (detail === 'full') {
      base.checks = checkResults;
    }

    return base;
  }

  /**
   * Attach health routes to an Express app.
   * Registers: /health, /health/live, /health/ready, /health/startup, /health/details
   * @param {import('express').Router} router
   */
  attachRoutes(router) {
    // Combined health (simple — for Cloudflare, uptime monitors)
    router.get('/health', async (req, res) => {
      const data = await this.buildResponse('simple');
      res.status(statusCode(data.status)).json(data);
    });

    // Kubernetes liveness — is the process alive?
    router.get('/health/live', (req, res) => {
      res.status(200).json({
        status: 'alive',
        service: this._service,
        uptime_ms: Date.now() - this._startAt,
        timestamp: new Date().toISOString(),
      });
    });

    // Kubernetes readiness — is the service ready to receive traffic?
    router.get('/health/ready', async (req, res) => {
      if (!this._ready) {
        return res.status(503).json({
          status: 'not_ready',
          service: this._service,
          message: 'Service startup not complete',
          timestamp: new Date().toISOString(),
        });
      }
      const data = await this.buildResponse('simple');
      res.status(statusCode(data.status)).json(data);
    });

    // Kubernetes startup — has the service finished booting?
    router.get('/health/startup', (req, res) => {
      const code = this._ready ? 200 : 503;
      res.status(code).json({
        status: this._ready ? 'started' : 'starting',
        service: this._service,
        uptime_ms: Date.now() - this._startAt,
        timestamp: new Date().toISOString(),
      });
    });

    // Full phi-enriched health details
    router.get('/health/details', async (req, res) => {
      const data = await this.buildResponse('full');
      res.status(statusCode(data.status)).json(data);
    });
  }
}

// ─── COMMON CHECKS ────────────────────────────────────────────────────────────

/**
 * Built-in check: process memory usage against phi threshold.
 * Reports degraded if heapUsed > 80% of heapTotal.
 * @returns {HealthCheck}
 */
export function memoryCheck() {
  return async () => {
    const mem = process.memoryUsage();
    const ratio = mem.heapUsed / mem.heapTotal;
    const status = ratio > PSI ? 'degraded' : 'healthy';  // degraded if > 0.618
    return {
      status,
      message: status === 'degraded' ? `Heap ratio ${(ratio * 100).toFixed(1)}% > φ⁻¹ threshold` : 'OK',
      meta: {
        heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
        ratio: Math.round(ratio * 1000) / 1000,
        rss_mb: Math.round(mem.rss / 1024 / 1024),
      },
    };
  };
}

/**
 * Built-in check: environment variables presence.
 * @param {string[]} requiredEnvVars
 * @returns {HealthCheck}
 */
export function envCheck(requiredEnvVars) {
  return async () => {
    const missing = requiredEnvVars.filter(v => !process.env[v]);
    const status = missing.length > 0 ? 'unhealthy' : 'healthy';
    return {
      status,
      message: missing.length > 0 ? `Missing required env vars: ${missing.join(', ')}` : 'OK',
      meta: { required: requiredEnvVars.length, missing: missing.length },
    };
  };
}

/**
 * Built-in check: upstream URL reachability (HEAD request).
 * @param {string} name — upstream name
 * @param {string} url — upstream health endpoint URL
 * @param {number} [timeoutMs=TIMEOUTS.PHI_3] — phi-scaled timeout
 * @returns {HealthCheck}
 */
export function upstreamCheck(name, url, timeoutMs = TIMEOUTS.PHI_3) {
  return async () => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      const status = res.ok ? 'healthy' : 'degraded';
      return { status, latencyMs, message: `${name} returned ${res.status}`, meta: { url, statusCode: res.status } };
    } catch (err) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        message: `${name} unreachable: ${err.message}`,
        meta: { url },
      };
    }
  };
}
