/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  @heady/platform — logger/index.js                               ║
 * ║  Structured JSON logger with φ-context enrichment               ║
 * ║  © 2026 HeadySystems Inc.                                        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Every log line is newline-delimited JSON conforming to the
 * Heady structured log schema. All log entries carry:
 *   - service name and version
 *   - trace_id, span_id (OTLP-compatible hex strings)
 *   - domain (CSL domain assignment)
 *   - phi_context (confidence, coherence, state)
 *   - timestamp (ISO-8601 UTC)
 *   - level, message, component
 *
 * Backed by pino for production throughput; includes pino-pretty
 * for local development detection.
 */

'use strict';

import pino from 'pino';
import { PSI, CSL_THRESHOLDS } from '../phi/index.js';

// ─── SCHEMA VERSION ──────────────────────────────────────────────────────────
const LOG_SCHEMA_VERSION = '2.0.0';

// ─── PHI CONFIDENCE TIER LABELS ──────────────────────────────────────────────
/**
 * Classify a confidence value against phi thresholds.
 * @param {number} confidence
 * @returns {string}
 */
function phiState(confidence) {
  if (confidence >= CSL_THRESHOLDS.RESONANT) return 'RESONANT_PASS';
  if (confidence >= CSL_THRESHOLDS.STEADY)   return 'STEADY';
  if (confidence >= CSL_THRESHOLDS.ALIGN)    return 'ALIGN';
  if (confidence >= CSL_THRESHOLDS.ENTRY)    return 'ENTRY';
  if (confidence >= CSL_THRESHOLDS.PASS)     return 'PASS';
  return 'BELOW_THRESHOLD';
}

// ─── LOG CONTEXT ─────────────────────────────────────────────────────────────

/**
 * Default phi_context to attach when none is provided.
 * confidence defaults to ψ (golden section), coherence to T(3) steady.
 */
const DEFAULT_PHI_CONTEXT = Object.freeze({
  confidence: PSI,                       // 0.618
  coherence: CSL_THRESHOLDS.STEADY,      // 0.882
  state: phiState(PSI),
  domain: 'unassigned',
});

// ─── FACTORY ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} LoggerOptions
 * @property {string} service — service name (e.g. 'heady-gateway')
 * @property {string} [version='unknown'] — service version
 * @property {string} [domain='unassigned'] — default CSL domain
 * @property {'trace'|'debug'|'info'|'warn'|'error'|'fatal'} [level='info']
 * @property {boolean} [pretty=false] — pino-pretty for local dev
 * @property {Object} [phiContext] — default phi context overrides
 */

/**
 * Create a structured pino logger bound to a service identity.
 * Merges Heady-standard base fields into every log entry.
 *
 * @param {LoggerOptions} opts
 * @returns {import('pino').Logger}
 */
export function createLogger(opts = {}) {
  const {
    service,
    version = process.env.SERVICE_VERSION ?? 'unknown',
    domain = process.env.HEADY_DOMAIN ?? 'unassigned',
    level = process.env.LOG_LEVEL ?? 'info',
    pretty = process.env.NODE_ENV === 'development',
    phiContext = {},
  } = opts;

  if (!service) throw new Error('createLogger: service name is required');

  const mergedPhi = { ...DEFAULT_PHI_CONTEXT, domain, ...phiContext };

  const pinoOpts = {
    level,
    base: {
      service,
      version,
      schema: LOG_SCHEMA_VERSION,
      domain: mergedPhi.domain,
      phi_context: mergedPhi,
      env: process.env.NODE_ENV ?? 'production',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  };

  if (pretty) {
    pinoOpts.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    };
  }

  return pino(pinoOpts);
}

// ─── REQUEST LOGGER ENRICHMENT ───────────────────────────────────────────────

/**
 * Enrich a child logger with per-request context.
 * Call this at the start of each request handler.
 *
 * @param {import('pino').Logger} logger
 * @param {Object} reqContext
 * @param {string} [reqContext.traceId]
 * @param {string} [reqContext.spanId]
 * @param {string} [reqContext.requestId]
 * @param {string} [reqContext.domain] — CSL-matched domain for this request
 * @param {number} [reqContext.confidence] — CSL confidence for domain match
 * @returns {import('pino').Logger} child logger
 */
export function requestLogger(logger, reqContext = {}) {
  const {
    traceId = randomHex(16),
    spanId = randomHex(8),
    requestId = randomHex(8),
    domain,
    confidence,
  } = reqContext;

  const child = logger.child({ trace_id: traceId, span_id: spanId, request_id: requestId });

  if (domain !== undefined) {
    return child.child({
      domain,
      phi_context: {
        ...(logger.bindings().phi_context ?? DEFAULT_PHI_CONTEXT),
        domain,
        ...(confidence !== undefined ? {
          confidence,
          state: phiState(confidence),
        } : {}),
      },
    });
  }

  return child;
}

// ─── STRUCTURED EVENT HELPERS ────────────────────────────────────────────────

/**
 * Log a phi-confidence event (used by CSL domain matching, gate evaluations).
 *
 * @param {import('pino').Logger} logger
 * @param {string} event — event name
 * @param {number} confidence — CSL confidence score
 * @param {Object} [meta] — additional metadata
 */
export function logConfidenceEvent(logger, event, confidence, meta = {}) {
  const state = phiState(confidence);
  const level = confidence < CSL_THRESHOLDS.PASS ? 'warn' : 'info';
  logger[level]({ event, confidence, state, csl_pass: confidence >= CSL_THRESHOLDS.PASS, ...meta }, event);
}

/**
 * Log a service health event.
 * @param {import('pino').Logger} logger
 * @param {'live'|'ready'|'startup'|'shutdown'} type
 * @param {boolean} healthy
 * @param {Object} [meta]
 */
export function logHealthEvent(logger, type, healthy, meta = {}) {
  const level = healthy ? 'info' : 'warn';
  logger[level]({ event: `health.${type}`, healthy, ...meta }, `Health ${type}: ${healthy ? 'OK' : 'DEGRADED'}`);
}

/**
 * Log a circuit breaker state transition.
 * @param {import('pino').Logger} logger
 * @param {string} service
 * @param {'CLOSED'|'OPEN'|'HALF_OPEN'} from
 * @param {'CLOSED'|'OPEN'|'HALF_OPEN'} to
 * @param {Object} [meta]
 */
export function logCircuitBreaker(logger, service, from, to, meta = {}) {
  const level = to === 'OPEN' ? 'error' : 'warn';
  logger[level]({ event: 'circuit_breaker.transition', circuit_service: service, from, to, ...meta },
    `Circuit breaker ${service}: ${from} → ${to}`);
}

// ─── UTILITY ─────────────────────────────────────────────────────────────────

function randomHex(bytes) {
  return Array.from({ length: bytes }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
}
