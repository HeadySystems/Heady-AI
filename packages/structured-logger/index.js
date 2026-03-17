// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  Structured Logger — JSON-formatted Logging for Heady Services  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const { PHI_TIMEOUT_REQUEST } = require('../phi-math');

// ═══════════════════════════════════════════════════════════════════
// Log Levels and Configuration
// ═══════════════════════════════════════════════════════════════════

const LOG_LEVELS = {
  debug: 0,   // Detailed diagnostic information
  info: 1,    // General informational messages
  warn: 2,    // Warning messages (potential issues)
  error: 3,   // Error messages (failures)
  fatal: 4,   // Fatal errors (unrecoverable conditions)
};

// Determine active log level from environment variable
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

// ═══════════════════════════════════════════════════════════════════
// Logger Factory
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a structured logger instance for a given service and domain
 *
 * @param {string} service - Service name (e.g., 'heady-manager', 'hc-pipeline')
 * @param {string} domain - Logical domain (e.g., 'pipeline', 'network', 'storage')
 * @returns {Object} Logger with methods: debug, info, warn, error, fatal, child
 */
function createLogger(service, domain = 'system') {
  /**
   * Internal log function that writes structured JSON to appropriate stream
   *
   * @param {string} level - Log level (debug, info, warn, error, fatal)
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata to include in log entry
   */
  function log(level, message, meta = {}) {
    // Skip logs below current level threshold
    if (LOG_LEVELS[level] < currentLevel) return;

    // Build structured log entry
    const entry = {
      ts: new Date().toISOString(),    // RFC 3339 timestamp
      level,                            // Log level
      service,                          // Service identifier
      domain,                           // Logical domain
      message,                          // Main log message
      ...meta,                          // Merged metadata
      pid: process.pid,                 // Process ID
      env: process.env.NODE_ENV || 'development', // Environment
    };

    // Select output stream (errors to stderr, others to stdout)
    const output = (level === 'error' || level === 'fatal') ? process.stderr : process.stdout;

    // Write as JSON line (newline-delimited for streaming parsers)
    output.write(JSON.stringify(entry) + '\n');
  }

  /**
   * Logger instance with level-specific methods
   */
  return {
    /**
     * Debug level logging (development diagnostics)
     */
    debug: (msg, meta) => log('debug', msg, meta),

    /**
     * Info level logging (general operations)
     */
    info: (msg, meta) => log('info', msg, meta),

    /**
     * Warn level logging (potential issues)
     */
    warn: (msg, meta) => log('warn', msg, meta),

    /**
     * Error level logging (recoverable failures)
     */
    error: (msg, meta) => log('error', msg, meta),

    /**
     * Fatal level logging (unrecoverable failures)
     */
    fatal: (msg, meta) => log('fatal', msg, meta),

    /**
     * Create a child logger with additional context
     * Useful for nested operations (e.g., request handlers)
     *
     * @param {Object} childMeta - Context to add to all child logs
     * @returns {Object} Child logger instance
     */
    child: (childMeta) => createLogger(service, childMeta.domain || domain),
  };
}

// ═══════════════════════════════════════════════════════════════════
// Convenience Factory with Default Service
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a logger with automatic service detection
 * Used for one-off logging without explicit service registration
 *
 * @param {Object} options - Logger options
 * @param {string} options.service - Service name
 * @param {string} options.domain - Domain (default: 'system')
 * @returns {Object} Logger instance
 */
function createServiceLogger(options = {}) {
  const service = options.service || process.env.SERVICE_NAME || 'heady-service';
  const domain = options.domain || 'system';
  return createLogger(service, domain);
}

// ═══════════════════════════════════════════════════════════════════
// Default Global Logger
// ═══════════════════════════════════════════════════════════════════

const defaultLogger = createServiceLogger();

// ═══════════════════════════════════════════════════════════════════
// Module Exports
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  // Logger factory
  createLogger,
  createServiceLogger,

  // Default logger instance
  defaultLogger,

  // Log levels for reference
  LOG_LEVELS,

  // Re-export phi-math constants for convenience (via relative path)
  PHI_TIMEOUT_REQUEST,
};
