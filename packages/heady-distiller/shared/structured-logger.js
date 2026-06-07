// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: packages/heady-distiller/shared/structured-logger.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * @module structured-logger
 * @description Pino-based structured JSON logger for HeadyDistiller (Stage 22).
 *
 * Usage:
 *   import { createLogger } from '../shared/structured-logger.js';
 *   const log = createLogger('trace-collector');
 *   log.info({ runId }, 'Trace collected');
 *
 *   // Child logger with correlation ID
 *   const reqLog = log.child({ correlationId: 'abc-123' });
 */

import pino from 'pino';

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

/**
 * Serialize Error instances to plain objects with all relevant fields.
 * @param {Error} err
 * @returns {object}
 */
function errSerializer(err) {
  if (!err || typeof err !== 'object') return err;
  return {
    type:             err.constructor?.name ?? 'Error',
    message:          err.message,
    code:             err.code,
    statusCode:       err.statusCode,
    isOperational:    err.isOperational,
    coherenceImpact:  err.coherenceImpact,
    details:          err.details,
    stack:            err.stack,
  };
}

/**
 * Serialize HTTP request objects (Node.js IncomingMessage / Fastify / Express).
 * Strips sensitive headers before logging.
 * @param {object} req
 * @returns {object}
 */
function reqSerializer(req) {
  if (!req) return req;
  return {
    id:              req.id,
    method:          req.method,
    url:             req.url,
    remoteAddress:   req.socket?.remoteAddress ?? req.ip,
    userAgent:       req.headers?.['user-agent'],
  };
}

/**
 * Serialize HTTP response objects.
 * @param {object} res
 * @returns {object}
 */
function resSerializer(res) {
  if (!res) return res;
  return {
    statusCode:   res.statusCode,
    responseTime: res.responseTime,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a pino logger instance scoped to a service name.
 *
 * Configuration:
 *   - name field = serviceName
 *   - level from LOG_LEVEL env (default: 'info')
 *   - JSON output for structured log ingestion
 *   - Serializers for err, req, res
 *   - Redaction of sensitive headers: authorization, cookie, x-api-key
 *
 * @param {string} serviceName - Logical name of the service/module.
 * @returns {import('pino').Logger} Configured pino logger with child() support.
 *
 * @example
 * const log = createLogger('knowledge-compressor');
 * log.info({ factsStored: 5 }, 'Compression complete');
 *
 * const childLog = log.child({ correlationId: 'run-abc123', runId: 'abc123' });
 * childLog.warn({ duplicatesSkipped: 2 }, 'Dedup applied');
 */
export function createLogger(serviceName) {
  if (!serviceName || typeof serviceName !== 'string') {
    throw new TypeError('createLogger: serviceName must be a non-empty string');
  }

  const level = process.env.LOG_LEVEL ?? 'info';

  const logger = pino({
    name:  serviceName,
    level,

    // Structured field order: timestamp first, level, name, then msg
    timestamp: pino.stdTimeFunctions.isoTime,

    // Redact sensitive values — replaced with '[Redacted]' in output
    redact: {
      paths: [
        'authorization',
        'cookie',
        'x-api-key',
        '*.authorization',
        '*.cookie',
        '*.x-api-key',
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
      ],
      censor: '[Redacted]',
    },

    serializers: {
      err: errSerializer,
      req: reqSerializer,
      res: resSerializer,
    },

    // Base context fields included on every log line
    base: {
      service: serviceName,
      pid:     process.pid,
    },

    // Format level as label string (info, warn, error) rather than integer
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });

  return logger;
}

export default createLogger;
