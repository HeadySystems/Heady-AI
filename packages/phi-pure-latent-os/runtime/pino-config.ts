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
// ║  FILE: packages/phi-pure-latent-os/runtime/pino-config.ts                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * @module runtime/pino-config
 * @description Pino production configuration with GCP Cloud Logging severity mapping,
 *   sensitive field redaction, structured serializers, and a child-logger factory.
 *   Replaces pino's default numeric level names with GCP severity labels so logs
 *   appear correctly classified in Cloud Logging and Error Reporting.
 */

import pino, { type LoggerOptions, type SerializedRequest, type SerializedResponse, type SerializedError } from 'pino';

// ─── Environment ──────────────────────────────────────────────────────────────

const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';
const LOG_LEVEL     = process.env['LOG_LEVEL'] ?? (IS_PRODUCTION ? 'info' : 'debug');
const SERVICE_NAME  = process.env['SERVICE_NAME'] ?? 'heady-service';
const SERVICE_VERSION = process.env['npm_package_version'] ?? '0.0.0';
const ENVIRONMENT   = process.env['NODE_ENV'] ?? 'development';

// ─── GCP Severity Mapping ─────────────────────────────────────────────────────
// Cloud Logging expects a "severity" field with GCP label values.
// Pino uses numeric levels; we map them here via formatters.
// See: https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity

const GCP_SEVERITY: Record<string, string> = {
  '10': 'DEBUG',     // pino trace
  '20': 'DEBUG',     // pino debug
  '30': 'INFO',      // pino info
  '40': 'WARNING',   // pino warn
  '50': 'ERROR',     // pino error
  '60': 'CRITICAL',  // pino fatal
};

// ─── Sensitive Paths to Redact ────────────────────────────────────────────────

const REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.body.password',
  'req.body.token',
  'req.body.secret',
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.api_key',
  '*.accessToken',
  '*.access_token',
  '*.refreshToken',
  '*.refresh_token',
  '*.privateKey',
  '*.private_key',
  '*.clientSecret',
  '*.client_secret',
  '*.connectionString',
  '*.connection_string',
];

// ─── Serializers ──────────────────────────────────────────────────────────────

function reqSerializer(req: SerializedRequest) {
  return {
    id:        req.id,
    method:    req.method,
    url:       req.url,
    remoteAddress: req.remoteAddress,
    remotePort:    req.remotePort,
    // Headers: strip sensitive keys, keep useful ones
    headers: {
      host:             req.headers?.['host'],
      'user-agent':     req.headers?.['user-agent'],
      'content-type':   req.headers?.['content-type'],
      'x-request-id':  req.headers?.['x-request-id'],
      'x-trace-id':    req.headers?.['x-trace-id'],
      'x-forwarded-for': req.headers?.['x-forwarded-for'],
    },
  };
}

function resSerializer(res: SerializedResponse) {
  return {
    statusCode: res.statusCode,
    headers: {
      'content-type':   (res as any).headers?.['content-type'],
      'content-length': (res as any).headers?.['content-length'],
    },
  };
}

function errSerializer(err: SerializedError) {
  return {
    type:        err.type,
    message:     err.message,
    stack:       err.stack,
    code:        (err as any).code,
    statusCode:  (err as any).statusCode,
    isOperational: (err as any).isOperational,
    coherenceImpact: (err as any).coherenceImpact,
  };
}

// ─── Base Logger Options ──────────────────────────────────────────────────────

const baseOptions: LoggerOptions = {
  level:      LOG_LEVEL,
  messageKey: 'message',   // GCP Cloud Logging uses "message" not "msg"
  timestamp:  pino.stdTimeFunctions.isoTime,

  // Map pino numeric levels → GCP severity labels
  formatters: {
    level(label: string, numericLevel: number) {
      const severity = GCP_SEVERITY[String(numericLevel)] ?? 'DEFAULT';
      return { severity, level: numericLevel };
    },
    bindings(bindings) {
      // Rename 'pid' and 'hostname' to GCP conventions
      return {
        pid:      bindings.pid,
        hostname: bindings.hostname,
        service:  SERVICE_NAME,
        version:  SERVICE_VERSION,
        env:      ENVIRONMENT,
      };
    },
    log(obj) {
      // Promote Error Reporting-required fields if an error is present
      if (obj['err'] && (obj['err'] as any).stack) {
        return {
          ...obj,
          '@type': 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
        };
      }
      return obj;
    },
  },

  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },

  serializers: {
    req: reqSerializer,
    res: resSerializer,
    err: errSerializer,
    error: errSerializer,
  },

  // Base context on every log line
  base: {
    service:     SERVICE_NAME,
    version:     SERVICE_VERSION,
    environment: ENVIRONMENT,
  },
};

// ─── Transport (development only) ────────────────────────────────────────────

function buildTransport(): LoggerOptions['transport'] {
  if (IS_PRODUCTION) return undefined;

  return {
    target:  'pino-pretty',
    options: {
      colorize:         true,
      translateTime:    'SYS:HH:MM:ss.l',
      ignore:           'pid,hostname,service,version,environment,severity',
      messageKey:       'message',
      levelFirst:       true,
      singleLine:       false,
    },
  };
}

// ─── Root Logger Instance ─────────────────────────────────────────────────────

export const rootLogger = pino(
  { ...baseOptions, transport: buildTransport() },
);

// ─── Child Logger Factory ─────────────────────────────────────────────────────

/**
 * Creates a child logger bound to a named component/module.
 * Use this instead of the root logger in all modules:
 *
 * ```ts
 * import { createLogger } from '../runtime/pino-config.js';
 * const log = createLogger('my-service');
 * log.info({ requestId }, 'Processing request');
 * ```
 */
export function createLogger(
  name: string,
  extra?: Record<string, unknown>,
): pino.Logger {
  return rootLogger.child({ component: name, ...extra });
}

// ─── Request Logger Middleware (Express) ──────────────────────────────────────

/**
 * Minimal request/response logging middleware.
 * Logs at INFO for 2xx/3xx, WARN for 4xx, ERROR for 5xx.
 */
export function requestLogger() {
  const log = createLogger('http');

  return function pinoRequestMiddleware(
    req: any,
    res: any,
    next: () => void,
  ) {
    const startMs = Date.now();
    const reqId   = req.headers['x-request-id'] ??
                    req.headers['x-trace-id']    ??
                    crypto.randomUUID();

    req.id = reqId;
    res.setHeader('x-request-id', reqId);

    res.on('finish', () => {
      const durationMs  = Date.now() - startMs;
      const statusCode  = res.statusCode as number;
      const logPayload  = {
        req:        { method: req.method, url: req.url, id: reqId },
        res:        { statusCode },
        durationMs,
      };

      if (statusCode >= 500) {
        log.error(logPayload, 'Request completed with server error');
      } else if (statusCode >= 400) {
        log.warn(logPayload, 'Request completed with client error');
      } else {
        log.info(logPayload, 'Request completed');
      }
    });

    next();
  };
}

// ─── Default export ───────────────────────────────────────────────────────────

export default rootLogger;
