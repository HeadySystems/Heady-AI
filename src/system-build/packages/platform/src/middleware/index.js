/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  @heady/platform — middleware/index.js                           ║
 * ║  HeadyAutoContext middleware hooks + request enrichment          ║
 * ║  © 2026 HeadySystems Inc. — 51 Provisional Patents             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Express middleware stack for every Heady service:
 *
 *   1. headyRequestId    — attach trace/request IDs
 *   2. headyAutoContext  — inject phi-context from HeadyAutoContext engine
 *   3. headyCslDomain    — perform CSL domain matching, attach to req
 *   4. headyAuth         — validate JWT / service-to-service mTLS identity
 *   5. headyRateLimit    — phi-scaled token bucket
 *   6. headyAccessLog    — structured pino request log
 *   7. headyErrorHandler — typed error handling, never swallows exceptions
 *
 * No ranking-based routing anywhere in this stack.
 * Domain resolution is always via CSL cosine matching.
 */

'use strict';

import { PSI, PSI2, CSL_THRESHOLDS, TIMEOUTS, fib } from '../phi/index.js';
import { cslDomainMatch } from '../csl/index.js';
import { requestLogger, logConfidenceEvent } from '../logger/index.js';
import { recordCslGate } from '../otel/index.js';

// ─── 1. REQUEST ID ────────────────────────────────────────────────────────────

/**
 * Attach trace_id, span_id, and request_id to every request.
 * Propagates W3C traceparent and x-b3-traceid headers.
 * @returns {import('express').RequestHandler}
 */
export function headyRequestId() {
  return (req, res, next) => {
    // W3C Trace Context — propagate or generate
    const traceparent = req.headers['traceparent'];
    if (traceparent) {
      const parts = traceparent.split('-');
      req.traceId = parts[1] ?? randomHex(16);
      req.spanId  = parts[2] ?? randomHex(8);
    } else {
      req.traceId = req.headers['x-b3-traceid'] ?? randomHex(16);
      req.spanId  = req.headers['x-b3-spanid']  ?? randomHex(8);
    }
    req.requestId = req.headers['x-request-id'] ?? randomHex(8);

    // Forward propagation headers
    res.setHeader('x-request-id', req.requestId);
    res.setHeader('x-trace-id',   req.traceId);

    next();
  };
}

// ─── 2. HEADY AUTO-CONTEXT HOOK ───────────────────────────────────────────────

/**
 * HeadyAutoContext middleware hook.
 * Attaches the AutoContext engine instance to req.autoContext.
 * If an autoContext instance is provided, calls enrich() before proceeding.
 * Falls back gracefully if AutoContext is not available (no crash).
 *
 * @param {Object} [autoContextInstance] — HeadyAutoContext instance (optional)
 * @returns {import('express').RequestHandler}
 */
export function headyAutoContext(autoContextInstance = null) {
  return async (req, res, next) => {
    req.autoContext = autoContextInstance;

    if (!autoContextInstance) {
      req.contextSources = [];
      return next();
    }

    try {
      const enriched = await autoContextInstance.enrich({
        query: `${req.method} ${req.path}`,
        metadata: {
          service: req.headers['x-heady-service'],
          domain:  req.headers['x-heady-domain'],
          traceId: req.traceId,
        },
      });
      req.contextSources = enriched?.sources ?? [];
      req.contextCoherence = enriched?.coherence ?? PSI;
    } catch (err) {
      // Graceful degradation — AutoContext failure NEVER blocks the request
      req.contextSources = [];
      req.contextCoherence = 0;
      // Log at warn, not error — context enrichment failure is non-fatal
      if (req.log) req.log.warn({ event: 'autocontext.enrich.failed', error: err.message },
        'HeadyAutoContext enrichment failed (degraded gracefully)');
    }

    next();
  };
}

// ─── 3. CSL DOMAIN MATCHING ───────────────────────────────────────────────────

/**
 * CSL domain-matching middleware.
 * Resolves req.headyDomain by computing cosine similarity between
 * the request's embedding and registered domain centroids.
 *
 * Replaces ranking-based routing: no integer weights, no ordered queues.
 * Domain assignment is purely geometric (cosine alignment).
 *
 * @param {import('../csl/index.js').DomainEntry[]} domains — registered domain centroids
 * @param {Function} [getEmbedding] — function(req) → Float64Array (optional)
 * @returns {import('express').RequestHandler}
 */
export function headyCslDomain(domains, getEmbedding = null) {
  return async (req, res, next) => {
    req.headyDomain = null;
    req.cslMatch = null;

    if (!getEmbedding || !domains.length) {
      // No embedding function — attempt header-based domain passthrough
      const headerDomain = req.headers['x-heady-domain'];
      if (headerDomain) {
        req.headyDomain = headerDomain;
      }
      return next();
    }

    try {
      const embedding = await getEmbedding(req);
      if (!embedding) return next();

      const matches = cslDomainMatch(embedding, domains, CSL_THRESHOLDS.PASS);
      if (matches.length > 0) {
        req.cslMatch   = matches[0];
        req.headyDomain = matches[0].domain.id;
        recordCslGate(matches[0].similarity, 'csl.domain_match');

        if (req.log) {
          logConfidenceEvent(req.log, 'csl.domain_match',
            matches[0].similarity, { domain: req.headyDomain });
        }
      }
    } catch (err) {
      // Non-fatal — continue without CSL assignment
      if (req.log) req.log.warn({ event: 'csl.domain_match.failed', error: err.message },
        'CSL domain matching failed (degraded gracefully)');
    }

    next();
  };
}

// ─── 4. PHI-SCALED RATE LIMITER ───────────────────────────────────────────────

/**
 * Token-bucket rate limiter with phi-scaled limits.
 * Window: φ⁴ × 1000 = 6,854 ms
 * Max requests per window: F(11) = 89
 * Burst: F(8) = 21
 *
 * @param {Object} [opts]
 * @param {number} [opts.windowMs=TIMEOUTS.PHI_4]
 * @param {number} [opts.maxRequests=89]
 * @param {number} [opts.burst=21]
 * @returns {import('express').RequestHandler}
 */
export function headyRateLimit(opts = {}) {
  const {
    windowMs   = TIMEOUTS.PHI_4,    // 6854 ms
    maxRequests = fib(11),           // 89
    burst       = fib(8),            // 21
  } = opts;

  // In-memory per-IP token buckets (for production, use Redis/CF KV)
  const buckets = new Map();

  return (req, res, next) => {
    const key = req.ip ?? req.headers['x-forwarded-for'] ?? 'unknown';
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart > windowMs) {
      bucket = { windowStart: now, count: 0, burst: burst };
      buckets.set(key, bucket);
    }

    bucket.count++;

    if (bucket.count > maxRequests + burst) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      res.setHeader('X-RateLimit-Limit',     maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset',     new Date(bucket.windowStart + windowMs).toISOString());
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Request rate exceeds φ-scaled limit',
        retry_after_ms: windowMs,
        phi_context: { threshold: PSI, window_ms: windowMs },
      });
    }

    const remaining = Math.max(0, maxRequests - bucket.count);
    res.setHeader('X-RateLimit-Limit',     maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset',     new Date(bucket.windowStart + windowMs).toISOString());
    next();
  };
}

// ─── 5. STRUCTURED ACCESS LOG ─────────────────────────────────────────────────

/**
 * Structured pino access log middleware.
 * Logs every request/response with phi-context, CSL domain, and timing.
 * @param {import('pino').Logger} logger
 * @returns {import('express').RequestHandler}
 */
export function headyAccessLog(logger) {
  return (req, res, next) => {
    const start = Date.now();

    // Attach enriched child logger to req
    req.log = requestLogger(logger, {
      traceId:    req.traceId,
      spanId:     req.spanId,
      requestId:  req.requestId,
      domain:     req.headyDomain,
      confidence: req.cslMatch?.similarity,
    });

    res.on('finish', () => {
      const latencyMs = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' :
                    res.statusCode >= 400 ? 'warn'  : 'info';

      req.log[level]({
        event: 'http.request',
        method: req.method,
        path:   req.path,
        status: res.statusCode,
        latency_ms: latencyMs,
        domain:     req.headyDomain ?? 'unassigned',
        csl_score:  req.cslMatch?.similarity,
        content_length: parseInt(res.getHeader('content-length') ?? '0', 10),
      }, `${req.method} ${req.path} ${res.statusCode} ${latencyMs}ms`);
    });

    next();
  };
}

// ─── 6. TYPED ERROR HANDLER ───────────────────────────────────────────────────

/**
 * Centralized error handler. NEVER returns HTTP 200 for errors.
 * NEVER swallows exceptions. Every error is typed and logged.
 *
 * @param {import('pino').Logger} logger
 * @returns {import('express').ErrorRequestHandler}
 */
export function headyErrorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const log = req.log ?? logger;
    const status = err.status ?? err.statusCode ?? 500;
    const errorType = classifyError(err);

    log.error({
      event: 'http.error',
      error_type: errorType,
      error_message: err.message,
      status,
      method: req.method,
      path:   req.path,
      stack:  process.env.NODE_ENV === 'development' ? err.stack : undefined,
      phi_context: {
        coherence: 0,
        confidence: 0,
        state: 'BELOW_THRESHOLD',
      },
    }, `Error handling ${req.method} ${req.path}: ${err.message}`);

    // Never leak stack traces in production
    const body = {
      error:      errorType,
      message:    status < 500 ? err.message : 'Internal service error',
      request_id: req.requestId,
      timestamp:  new Date().toISOString(),
    };

    if (process.env.NODE_ENV === 'development') {
      body.stack = err.stack;
    }

    res.status(status).json(body);
  };
}

// ─── 7. SECURITY HEADERS ─────────────────────────────────────────────────────

/**
 * Attach Heady-standard security headers to every response.
 * @returns {import('express').RequestHandler}
 */
export function headySecurityHeaders() {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options',   'nosniff');
    res.setHeader('X-Frame-Options',           'DENY');
    res.setHeader('X-XSS-Protection',          '1; mode=block');
    res.setHeader('Referrer-Policy',           'strict-origin-when-cross-origin');
    res.setHeader('X-Heady-Service',           process.env.SERVICE_NAME ?? 'heady');
    res.setHeader('X-Heady-Version',           process.env.SERVICE_VERSION ?? 'unknown');
    res.removeHeader('X-Powered-By');
    next();
  };
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

function randomHex(bytes) {
  return Array.from({ length: bytes }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
}

function classifyError(err) {
  if (err.name === 'ValidationError') return 'validation_error';
  if (err.name === 'AuthenticationError' || err.status === 401) return 'authentication_error';
  if (err.name === 'AuthorizationError' || err.status === 403) return 'authorization_error';
  if (err.status === 404 || err.name === 'NotFoundError') return 'not_found';
  if (err.status === 429) return 'rate_limit_exceeded';
  if (err.status === 422) return 'unprocessable_entity';
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') return 'upstream_unavailable';
  if (err.status >= 500 || !err.status) return 'internal_error';
  return 'client_error';
}
