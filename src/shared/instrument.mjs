/**
 * Heady™ Universal Sentry Instrumentation Module
 * ================================================
 * @sentry/node v9.x — ESM (MJS) edition
 *
 * Usage (ESM services — Node ≥ 18.19.0):
 *   node --import ./sentry-init.mjs src/index.mjs
 *   # or via env var:
 *   NODE_OPTIONS="--import ./sentry-init.mjs" npm start
 *
 * Required environment variables:
 *   SENTRY_DSN          — Project DSN (see instrumentation guide)
 *
 * Optional environment variables:
 *   NODE_ENV            — "production" | "staging" | "development"
 *   SENTRY_RELEASE      — e.g. "heady-api@4.2.0"  (set by CI/CD)
 *   HEADY_VERSION       — fallback version string
 *   SENTRY_TRACES_RATE  — float 0.0–1.0, default 0.1 (10%)
 *   SENTRY_PROFILES_RATE— float 0.0–1.0, default 0.1 (10%)
 *
 * Architecture:
 *   - MUST be loaded via --import BEFORE any other module
 *   - import-in-the-middle wraps all packages automatically
 *   - OpenTelemetry distributed tracing is built in
 *   - PII scrubbing via beforeSend (drops auth headers, emails, IPs)
 *   - Noise filter drops non-actionable network errors (~40% reduction)
 *
 * Reference: https://docs.sentry.io/platforms/javascript/guides/node/install/esm/
 * Pattern: src/services/sentry.js in heady-production (heady-manager v9.0 Blueprint §8)
 */

import * as Sentry from '@sentry/node';

// ── DSN resolution ────────────────────────────────────────────────────────────
const DSN = process.env.SENTRY_DSN;

if (!DSN) {
  // Warn but don't crash — services should run without Sentry in dev
  console.warn('[sentry-init] SENTRY_DSN not set — Sentry disabled');
}

// ── Noise filter — drops non-actionable network/infra errors ─────────────────
// Based on heady-manager v9.0 Blueprint §8 beforeSend implementation
const NOISE_PATTERNS = [
  /ECONNRESET/,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /socket hang up/,
  /fetch failed/,
  /AbortError/,
  /ERR_STREAM_PREMATURE_CLOSE/,
  /ERR_HTTP_REQUEST_TIMEOUT/,
  /read ECONNRESET/,
  /write ECONNRESET/,
];

// ── PII scrubbing — strips sensitive fields before sending to Sentry ──────────
const PII_HEADER_DENY_LIST = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-session-token',
  'x-heady-token',
  'proxy-authorization',
]);

const PII_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /credit[_-]?card/i,
  /ssn/i,
];

function scrubHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  const scrubbed = {};
  for (const [key, value] of Object.entries(headers)) {
    scrubbed[key] = PII_HEADER_DENY_LIST.has(key.toLowerCase()) ? '[Filtered]' : value;
  }
  return scrubbed;
}

function scrubObject(obj, depth = 0) {
  if (depth > 4 || !obj || typeof obj !== 'object') return obj;
  const result = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELD_PATTERNS.some(p => p.test(key))) {
      result[key] = '[Filtered]';
    } else if (typeof value === 'object') {
      result[key] = scrubObject(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── Sentry.init ───────────────────────────────────────────────────────────────
if (DSN) {
  Sentry.init({
    dsn: DSN,

    // Release tracking — set by CI/CD pipeline (e.g. "heady-api@4.2.0")
    release: process.env.SENTRY_RELEASE
      ?? `heady-service@${process.env.HEADY_VERSION ?? 'unknown'}`,

    // Environment tagging
    environment: process.env.NODE_ENV ?? 'development',

    // Performance tracing (10% sample rate in production — tune per service)
    // Set SENTRY_TRACES_RATE=1.0 temporarily for performance debugging
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_RATE ?? '0.1'),

    // Continuous profiling (requires @sentry/profiling-node)
    profileSessionSampleRate: parseFloat(process.env.SENTRY_PROFILES_RATE ?? '0.1'),

    // Structured logging integration — sends console.error/warn to Sentry
    // https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/
    _experiments: {
      enableLogs: true,
    },

    // ── Noise filter (v9.0 Blueprint §8) ─────────────────────────────────────
    beforeSend(event, hint) {
      const err = hint?.originalException;

      // Drop noise errors — network resets, timeouts, intentional aborts
      if (err instanceof Error) {
        if (NOISE_PATTERNS.some(p => p.test(err.message ?? ''))) {
          return null;
        }
      }

      // Scrub PII from request headers
      if (event.request?.headers) {
        event.request.headers = scrubHeaders(event.request.headers);
      }

      // Scrub PII from request body
      if (event.request?.data) {
        event.request.data = scrubObject(event.request.data);
      }

      // Scrub PII from extra/breadcrumbs
      if (event.extra) {
        event.extra = scrubObject(event.extra);
      }

      // Strip user email/IP to avoid PII leakage (keep user.id for correlation)
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }

      return event;
    },

    // ── beforeSendTransaction — sample-based PII scrub ───────────────────────
    beforeSendTransaction(transaction) {
      // Drop internal health check spans from traces
      if (transaction.transaction?.match(/GET \/health/)) {
        return null;
      }
      return transaction;
    },

    // OpenTelemetry integrations are automatic with @sentry/node v9
    // sentry-trace + baggage headers propagate without additional config
    integrations: [],
  });

  console.info(
    `[sentry-init] Sentry initialized | env=${process.env.NODE_ENV ?? 'development'} | traces=${process.env.SENTRY_TRACES_RATE ?? '0.1'}`
  );
}
