// ============================================================================
// HEADY STRUCTURED LOGGER
// src/lib/logger.mjs
//
// Addresses LR-004/LR-006: ALL src/ modules use pino structured logging.
// Zero console.* anywhere. ESM module (.mjs) for Gap #2 compatibility.
//
// Usage:
//   import { createLogger } from '../lib/logger.mjs';
//   const logger = createLogger('my-service');
//   logger.system('Boot complete', { nodeId: 'heady-brain', action: 'boot', meta: {} });
//   logger.error('Connection failed', { nodeId: 'heady-brain', error: err.message, stack: err.stack, ctx: {} });
//   logger.activity('User logged in', { userId: 'u_abc', action: 'login', site: 'headyme.com' });
//   logger.perf('Query completed', { nodeId: 'heady-vector', durationMs: 42, metric: 'qdrant_search' });
//   logger.security('PQC verification', { event: 'pqc_verify', userId: 'u_abc', ip: '1.2.3.4', pqcVerified: true });
//   logger.distill('Recipe created', { traceId: 't_123', tier: 2, recipeSha: 'abc', optimizationGain: 0.23 });
//
// © 2026 HeadySystems Inc.
// ============================================================================

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// Base pino configuration
const baseConfig = {
  level: process.env.HEADY_LOG_LEVEL || process.env.LOG_LEVEL || 'info',
  // Structured JSON in production, pretty-print in development
  ...(isProduction ? {} : {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    },
  }),
  // Redact sensitive fields per LOG_REDACTION=true in .poop env
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.secret',
      '*.accessToken',
      '*.refreshToken',
      '*.pqcSignature',
    ],
    censor: '[REDACTED]',
  },
  // Always include these base fields
  base: {
    service: process.env.OTEL_SERVICE_NAME || 'heady-manager',
    version: process.env.HEADY_VERSION || '3.1.0',
    env: process.env.NODE_ENV || 'development',
  },
  // Serializers for common objects
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
};

/**
 * Create a child logger with a specific component name.
 * Returns an object with typed logging methods matching §34 of the super prompt.
 *
 * @param {string} component - e.g. 'boot-orchestrator', 'unified-auth', 'distiller'
 * @returns {object} Logger with system, error, activity, perf, security, distill methods
 */
export function createLogger(component) {
  const base = pino(baseConfig).child({ component });

  return {
    /** System-level operational logs */
    system(msg, { nodeId, action, meta = {} } = {}) {
      base.info({ nodeId, action, meta, logType: 'system' }, msg);
    },

    /** Error logs with full context */
    error(msg, { nodeId, error, stack, ctx = {} } = {}) {
      base.error({ nodeId, error, stack, ctx, logType: 'error' }, msg);
    },

    /** User activity tracking */
    activity(msg, { userId, action, site } = {}) {
      base.info({ userId, action, site, logType: 'activity' }, msg);
    },

    /** Performance metrics */
    perf(msg, { nodeId, durationMs, metric } = {}) {
      base.info({ nodeId, durationMs, metric, logType: 'perf' }, msg);
    },

    /** Security events */
    security(msg, { event, userId, ip, pqcVerified } = {}) {
      base.warn({ event, userId, ip, pqcVerified, logType: 'security' }, msg);
    },

    /** Distiller recipe events (v8 new) */
    distill(msg, { traceId, tier, recipeSha, optimizationGain } = {}) {
      base.info({ traceId, tier, recipeSha, optimizationGain, logType: 'distill' }, msg);
    },

    /** Raw pino instance for advanced use (e.g., Express pino-http) */
    raw: base,
  };
}

// Default logger instance for quick import
export const logger = createLogger('heady');
