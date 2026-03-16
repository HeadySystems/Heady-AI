/**
 * HEADY Shared Configuration
 *
 * Central configuration management for services, CORS, logging,
 * health checks, and middleware stacks.
 *
 * @module @heady/config
 */

export * from './base-service';
export * from './cors';
export {
  LogContext, StructuredLogEntry, createLogEntry, createErrorLogEntry,
  LoggerConfig, getLoggerConfig, redactSensitiveFields,
  getCorrelationId, generateCorrelationId, extractB3Trace, extractJaegerTrace,
  createLogContextFromRequest, formatLogEntry, LOG_LEVELS,
} from './logging';
export * from './health-check';
export * from './middleware';
