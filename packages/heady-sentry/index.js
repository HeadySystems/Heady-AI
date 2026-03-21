'use strict';
const { createLogger } = require('../../src/utils/logger');
const logger = createLogger('auto-fixed');

/**
 * HEADY™ Sentry Integration — Liquid Architecture v9 (§8)
 *
 * @sentry/node v8+ with built-in OpenTelemetry support:
 * - Distributed tracing across 21 nodes (auto sentry-trace/baggage propagation)
 * - Sentry Crons for φ⁷ heartbeat monitoring (29,034ms)
 * - Continuous profiling via V8 CpuProfiler at 100Hz
 * - beforeSend volume reduction (drops non-actionable errors)
 * - CSL gate drift metric
 */
const PHI_7_MS = 29034; // φ⁷ × 1000

const SENTRY_PROJECTS = ['headyme-frontend', 'headysystems-frontend', 'headybuddy-frontend', 'heady-api', 'heady-memory', 'heady-conductor', 'heady-guard', 'heady-eval', 'heady-edge-worker', 'heady-colab-runtime-1', 'heady-colab-runtime-2', 'heady-colab-runtime-3', 'heady-colab-runtime-4'];
const ALERT_THRESHOLDS = {
  p99_latency_ms: 50,
  error_rate: 0.001,
  memory_bootstrap_ms: 200,
  csl_drift_max: 0.05
};

// Non-actionable error patterns to drop (30-60% volume reduction per §8)
const DROP_PATTERNS = [/ECONNRESET/, /EPIPE/, /socket hang up/i, /NetworkError/i, /AbortError/i, /Request timeout/i, /DNS lookup failed/i];

/**
 * Initialize Sentry v8 with OTel, tracing, profiling, and Crons.
 *
 * @param {string} projectName - Sentry project name
 * @param {object} [options]
 * @param {number} [options.tracesSampleRate=0.1]    - 10% default for production
 * @param {number} [options.profileSessionSampleRate=0.1]
 * @param {number} [options.replaysOnErrorSampleRate=1.0]
 * @param {number} [options.replaysSessionSampleRate=0.1]
 */
function initSentry(projectName, options = {}) {
  const dsn = process.env[`SENTRY_DSN_${projectName.replace(/-/g, '_').toUpperCase()}`] || process.env.SENTRY_DSN;
  if (!dsn) {
    logger.warn(`[Sentry] No DSN for ${projectName} — using mock`);
    return createMockSentry();
  }
  try {
    const Sentry = require('@sentry/node');

    // v8: OTel auto-instrumentation is built in — no manual span creation needed.
    // sentry-trace + baggage headers propagate automatically across HTTP calls.
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: `heady@${process.env.npm_package_version || '9.0.0'}`,
      serverName: projectName,
      // Tracing — 10% in prod, 100% in dev (§8)
      tracesSampleRate: options.tracesSampleRate ?? (process.env.NODE_ENV === 'production' ? 0.1 : 1.0),
      // Continuous profiling — V8 CpuProfiler at 100Hz (§8)
      profileSessionSampleRate: options.profileSessionSampleRate ?? 0.1,
      // Volume reduction: drop non-actionable errors (§8 cost optimization)
      beforeSend(event) {
        // Strip auth headers
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }

        // Drop transient network errors
        const msg = event.message || event.exception?.values?.[0]?.value || '';
        if (DROP_PATTERNS.some(p => p.test(msg))) {
          return null; // Discard event
        }
        return event;
      },
      // Integrations
      integrations: [
      // Profiling (if @sentry/profiling-node is installed)
      ...(() => {
        try {
          const {
            nodeProfilingIntegration
          } = require('@sentry/profiling-node');
          return [nodeProfilingIntegration()];
        } catch {
          return [];
        }
      })()]
    });
    logger.info(`[Sentry] ✓ v8 initialized for ${projectName} (OTel tracing enabled)`);
    return Sentry;
  } catch (e) {
    logger.warn(`[Sentry] @sentry/node not installed — using mock (${e.message})`);
    return createMockSentry();
  }
}

/**
 * Monitor the φ⁷ heartbeat cycle with Sentry Crons (§8).
 *
 * Uses interval schedule (not crontab) because the 29,034ms cycle
 * is sub-minute granularity. failureIssueThreshold=3 prevents noise.
 *
 * @param {object} Sentry       - Initialized Sentry instance
 * @param {string} monitorSlug  - Crons monitor name (e.g. 'heady-heartbeat')
 * @param {Function} heartbeatFn - The function to execute each cycle
 */
function startHeartbeatMonitor(Sentry, monitorSlug = 'heady-heartbeat', heartbeatFn) {
  if (Sentry._isMock) {
    logger.warn('[Sentry] Mock — heartbeat monitor not started');
    return null;
  }
  const intervalMs = PHI_7_MS;
  const run = async () => {
    const checkInId = Sentry.captureCheckIn?.({
      monitorSlug,
      status: 'in_progress'
    }, {
      schedule: {
        type: 'interval',
        value: Math.ceil(intervalMs / 1000),
        unit: 'second'
      },
      checkinMargin: 5,
      // 5 second tolerance
      maxRuntime: 10,
      // 10 second max
      failureIssueThreshold: 3,
      // Alert after 3 consecutive misses
      recoveryThreshold: 1
    });
    try {
      await heartbeatFn();
      Sentry.captureCheckIn?.({
        checkInId,
        monitorSlug,
        status: 'ok'
      });
    } catch (error) {
      Sentry.captureCheckIn?.({
        checkInId,
        monitorSlug,
        status: 'error'
      });
      Sentry.captureException?.(error);
    }
  };
  const timer = setInterval(run, intervalMs);
  run(); // First check immediately

  return {
    timer,
    stop: () => clearInterval(timer)
  };
}

/**
 * Track CSL gate drift as a custom metric.
 */
function trackCslDrift(sentry, currentGate, expectedGate = 0.618) {
  const drift = Math.abs(currentGate - expectedGate);
  if (sentry.metrics?.gauge) {
    sentry.metrics.gauge('heady.csl.gate', currentGate, {
      tags: {
        environment: process.env.NODE_ENV || 'development'
      },
      unit: 'ratio'
    });
    sentry.metrics.gauge('heady.csl.drift', drift, {
      tags: {
        environment: process.env.NODE_ENV || 'development'
      },
      unit: 'ratio'
    });
  }
  if (drift > ALERT_THRESHOLDS.csl_drift_max && sentry.captureMessage) {
    sentry.captureMessage(`CSL gate drift: ${currentGate.toFixed(4)} (expected ${expectedGate}, drift ${drift.toFixed(4)})`, 'warning');
  }
  return {
    currentGate,
    expectedGate,
    drift,
    alert: drift > ALERT_THRESHOLDS.csl_drift_max
  };
}

/**
 * Create a span for pipeline stage processing.
 * v8 uses `Sentry.startSpan()` instead of v7's `startTransaction()`.
 */
function withSpan(Sentry, name, op, fn) {
  if (Sentry._isMock || !Sentry.startSpan) {
    return fn({});
  }
  return Sentry.startSpan({
    name,
    op
  }, fn);
}
function createMockSentry() {
  return {
    _isMock: true,
    captureException: err => logger.error('[Sentry:mock]', err.message || err),
    captureMessage: (msg, level) => logger.info(`[Sentry:mock:${level}]`, msg),
    captureCheckIn: () => 'mock-checkin-id',
    addBreadcrumb: () => {},
    metrics: {
      gauge: () => {},
      increment: () => {},
      distribution: () => {}
    },
    startSpan: (_opts, fn) => fn({}),
    setUser: () => {},
    setTag: () => {},
    flush: async () => {}
  };
}

// ═══════════════════════════════════════════════════════════════
// SENTRY SEER — AI-powered issue analysis (§P8)
// ═══════════════════════════════════════════════════════════════

/**
 * Query Sentry Seer (AI-powered issue analysis).
 *
 * Seer analyzes errors via Sentry's API and returns:
 * - Root cause analysis
 * - Auto-fix suggestions
 * - Similar issue grouping
 *
 * Requires: organization slug, Sentry API auth token (distinct from DSN).
 *
 * @param {object} options
 * @param {string} options.issueId        - Sentry issue ID
 * @param {string} options.orgSlug        - Organization slug (e.g. 'headysystems')
 * @param {string} [options.authToken]    - Sentry API auth token
 * @returns {Promise<object>} Seer analysis result
 */
async function querySeer(options) {
  const authToken = options.authToken || process.env.SENTRY_AUTH_TOKEN;
  if (!authToken) {
    return {
      available: false,
      reason: 'No SENTRY_AUTH_TOKEN set'
    };
  }
  try {
    // Autofix: trigger AI analysis for the issue
    const autofixRes = await fetch(`https://sentry.io/api/0/organizations/${options.orgSlug}/issues/${options.issueId}/autofix/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instruction: 'Analyze this error and suggest a fix for the Heady AI platform.'
      })
    });
    if (!autofixRes.ok) {
      const errText = await autofixRes.text();
      return {
        available: false,
        status: autofixRes.status,
        error: errText.slice(0, 200)
      };
    }
    const autofixData = await autofixRes.json();

    // Fetch similar issues for grouping
    const similarRes = await fetch(`https://sentry.io/api/0/organizations/${options.orgSlug}/issues/${options.issueId}/similar-issues/v2/`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    const similarData = similarRes.ok ? await similarRes.json() : [];
    return {
      available: true,
      issue_id: options.issueId,
      autofix: autofixData,
      similar_issues: Array.isArray(similarData) ? similarData.length : 0,
      analyzed_at: new Date().toISOString()
    };
  } catch (err) {
    return {
      available: false,
      error: err.message
    };
  }
}
module.exports = {
  initSentry,
  startHeartbeatMonitor,
  trackCslDrift,
  withSpan,
  createMockSentry,
  querySeer,
  SENTRY_PROJECTS,
  ALERT_THRESHOLDS,
  DROP_PATTERNS,
  PHI_7_MS
};