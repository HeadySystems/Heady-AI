/**
 * Heady™ Structured JSON Logger (ESM)
 * Production-grade logging — no console.log, structured JSON everywhere.
 * Supports correlation IDs via AsyncLocalStorage, service tagging, domain spans.
 *
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * @module shared/logger
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { PHI, PSI } from './phi-math.mjs';

// ─── CORRELATION ID STORAGE ─────────────────────────────────────────────────
const correlationStore = new AsyncLocalStorage();

/**
 * Run a function with a correlation ID propagated to all logger calls within.
 * @param {string} correlationId
 * @param {Function} fn
 * @returns {*} Return value of fn
 */
export function withCorrelationId(correlationId, fn) {
  return correlationStore.run({ correlationId }, fn);
}

/**
 * Get the current correlation ID from async context.
 * @returns {string|undefined}
 */
export function getCorrelationId() {
  return correlationStore.getStore()?.correlationId;
}

// ─── LOG LEVELS ──────────────────────────────────────────────────────────────
const LOG_LEVELS = Object.freeze({
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
  fatal: 4,
});

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? 1;

// ─── LOGGER CLASS ────────────────────────────────────────────────────────────
export class HeadyLogger {
  /**
   * @param {string} serviceName - Name of the service or module
   * @param {object} [options]
   * @param {string} [options.version] - Service version
   * @param {string} [options.domain] - Heady domain (e.g., headysystems.com)
   */
  constructor(serviceName, options = {}) {
    this.service = serviceName;
    this.version = options.version || process.env.SERVICE_VERSION || '1.0.0';
    this.domain = options.domain || process.env.HEADY_DOMAIN || 'unknown';
  }

  /**
   * Internal log writer. Writes structured JSON to stdout.
   * @private
   */
  _write(level, message, data = {}) {
    if (LOG_LEVELS[level] < currentLevel) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      version: this.version,
      domain: this.domain,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      correlationId: getCorrelationId() || data.correlationId || undefined,
      ...data,
    };

    // Remove undefined values for clean JSON
    const clean = Object.fromEntries(
      Object.entries(entry).filter(([, v]) => v !== undefined)
    );

    process.stdout.write(JSON.stringify(clean) + '\n');
  }

  debug(message, data) { this._write('debug', message, data); }
  info(message, data)  { this._write('info', message, data); }
  warn(message, data)  { this._write('warn', message, data); }
  error(message, data) { this._write('error', message, data); }
  fatal(message, data) { this._write('fatal', message, data); }

  /**
   * Create a child logger with additional default fields.
   * @param {object} defaults - Additional fields to include in every log entry
   * @returns {HeadyLogger}
   */
  child(defaults = {}) {
    const child = new HeadyLogger(this.service, {
      version: this.version,
      domain: this.domain,
    });
    const parentWrite = child._write.bind(child);
    child._write = (level, message, data = {}) => {
      parentWrite(level, message, { ...defaults, ...data });
    };
    return child;
  }
}

// ─── FACTORY ─────────────────────────────────────────────────────────────────
/**
 * Create a structured logger instance.
 * @param {string} serviceName - Name of the service or module
 * @param {object} [options] - Logger options
 * @returns {HeadyLogger}
 */
export function createLogger(serviceName, options = {}) {
  return new HeadyLogger(serviceName, options);
}

export default { HeadyLogger, createLogger, withCorrelationId, getCorrelationId };
