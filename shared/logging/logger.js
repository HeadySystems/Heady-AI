/**
 * Heady™ Structured Logger
 * JSON-based structured logging with pino backend
 *
 * Fields: timestamp, level, service, domain, correlationId, message
 * φ-scaled log rotation: every fib(21) = 10,946 lines
 */

const pino = require('pino');
const path = require('path');
const fs = require('fs');

const PHI_SCALED_LOG_ROTATION_LINES = 10946; // fib(21)

/**
 * Create a structured logger instance
 * @param {Object} options - Logger configuration
 * @param {string} options.service - Service name (e.g., "heady-mcp-server")
 * @param {string} options.domain - Domain name (e.g., "headysystems.com")
 * @param {string} options.level - Log level (debug, info, warn, error)
 * @param {string} options.environment - Environment (development, production, staging)
 * @param {string} options.logDir - Directory for log files (optional, for file output)
 * @returns {Object} Logger instance with custom context methods
 */
function createLogger(options = {}) {
  const {
    service = 'heady-service',
    domain = 'unknown',
    level = process.env.HEADY_LOG_LEVEL || 'info',
    environment = process.env.NODE_ENV || 'development',
    logDir = process.env.HEADY_LOG_DIR || null,
  } = options;

  // Pino configuration
  const pinoOptions = {
    level,
    base: null, // Remove pid and hostname from base
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
      bindings: () => {
        return {}; // Remove default bindings
      },
    },
  };

  // Configure transport based on environment
  let transport;
  if (environment === 'production') {
    // Production: send to file with rotation
    if (logDir && !fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = logDir
      ? path.join(logDir, `${service}-${new Date().toISOString().split('T')[0]}.log`)
      : undefined;

    if (logFile) {
      transport = pino.transport({
        target: 'pino-roll',
        options: {
          file: logFile,
          size: `${PHI_SCALED_LOG_ROTATION_LINES * 100}B`, // Approximate
          frequency: 'daily',
        },
      });
    }
  } else {
    // Development: pretty-print to console
    transport = pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        singleLine: false,
        translateTime: 'SYS:standard',
      },
    });
  }

  const logger = pino(pinoOptions, transport);

  // Create context-aware logger with service and domain pre-filled
  const contextLogger = {
    /**
     * Log at debug level
     * @param {Object} meta - Metadata object
     * @param {string} message - Log message
     */
    debug: (message, meta = {}) => {
      logger.debug({ ...getLogContext(), ...meta }, message);
    },

    /**
     * Log at info level
     * @param {Object} meta - Metadata object
     * @param {string} message - Log message
     */
    info: (message, meta = {}) => {
      logger.info({ ...getLogContext(), ...meta }, message);
    },

    /**
     * Log at warn level
     * @param {Object} meta - Metadata object
     * @param {string} message - Log message
     */
    warn: (message, meta = {}) => {
      logger.warn({ ...getLogContext(), ...meta }, message);
    },

    /**
     * Log at error level
     * @param {Object} meta - Metadata object
     * @param {string} message - Log message
     */
    error: (message, meta = {}) => {
      const errorMeta = {
        ...getLogContext(),
        ...meta,
      };
      if (meta instanceof Error) {
        errorMeta.error = {
          name: meta.name,
          message: meta.message,
          stack: meta.stack,
        };
      }
      logger.error(errorMeta, message);
    },

    /**
     * Create a child logger with additional context
     * @param {Object} context - Additional context fields
     * @returns {Object} New logger instance with merged context
     */
    child: (context = {}) => {
      const childLogger = logger.child(context);
      return {
        debug: (msg, meta = {}) => childLogger.debug({ ...meta }, msg),
        info: (msg, meta = {}) => childLogger.info({ ...meta }, msg),
        warn: (msg, meta = {}) => childLogger.warn({ ...meta }, msg),
        error: (msg, meta = {}) => childLogger.error({ ...meta }, msg),
        child: (ctx = {}) => contextLogger.child({ ...context, ...ctx }),
      };
    },

    /**
     * Get the underlying pino logger for advanced usage
     * @returns {Object} Pino logger instance
     */
    raw: () => logger,
  };

  /**
   * Get standard log context
   * @returns {Object} Context with timestamp, service, domain
   */
  function getLogContext() {
    return {
      timestamp: new Date().toISOString(),
      service,
      domain,
      environment,
    };
  }

  return contextLogger;
}

/**
 * Express/HTTP middleware for request logging
 * @param {Object} logger - Logger instance
 * @returns {Function} Middleware function
 */
function httpLoggingMiddleware(logger) {
  return (req, res, next) => {
    const startTime = Date.now();
    const correlationId = req.get('X-Correlation-ID') || generateCorrelationId();

    // Attach to request for downstream handlers
    req.correlationId = correlationId;

    // Log incoming request
    logger.info('HTTP request received', {
      correlationId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Hook response finish
    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - startTime;
      logger.info('HTTP response sent', {
        correlationId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
      originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Generate a unique correlation ID
 * @returns {string} UUID v4 correlation ID
 */
function generateCorrelationId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  createLogger,
  httpLoggingMiddleware,
  generateCorrelationId,
  PHI_SCALED_LOG_ROTATION_LINES,
};
