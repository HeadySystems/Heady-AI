'use strict';

/**
 * Heady™ Structured Logger — JSON-formatted production logging.
 * Replaces all console.log usage with structured, leveled, context-rich logging.
 * 
 * Features:
 *  - JSON output for log aggregation (Cloud Logging, Datadog, etc.)
 *  - φ-scaled log sampling for high-volume paths
 *  - Request correlation IDs
 *  - Service/module context tags
 *  - Redaction of sensitive fields
 * 
 * © 2026 HeadySystems Inc.
 */

const PHI = 1.6180339887;
const PSI = 0.6180339887;

const LEVELS = { TRACE: 0, DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, FATAL: 50 };
const LEVEL_NAMES = Object.fromEntries(Object.entries(LEVELS).map(([k, v]) => [v, k]));

const REDACT_KEYS = new Set([
    'password', 'secret', 'token', 'apiKey', 'api_key', 'authorization',
    'cookie', 'refreshToken', 'refresh_token', 'ssn', 'creditCard',
]);

class StructuredLogger {
    /**
     * @param {object} opts
     * @param {string}  opts.service   - Service name (e.g., 'heady-infer')
     * @param {string}  [opts.module]  - Module name within service
     * @param {string}  [opts.level]   - Minimum log level (default: INFO in prod, DEBUG in dev)
     * @param {boolean} [opts.pretty]  - Pretty-print JSON (default: false in prod)
     * @param {WritableStream} [opts.output] - Output stream (default: process.stdout)
     */
    constructor(opts = {}) {
        this.service = opts.service || process.env.HEADY_SERVICE || 'heady';
        this.module = opts.module || null;
        this.minLevel = LEVELS[opts.level?.toUpperCase()] ??
            (process.env.NODE_ENV === 'production' ? LEVELS.INFO : LEVELS.DEBUG);
        this.pretty = opts.pretty ?? (process.env.NODE_ENV !== 'production');
        this.output = opts.output || process.stdout;
        this._sampleCounters = {};
    }

    /**
     * Create a child logger with additional context.
     * @param {string} module - Module name
     * @param {object} [extra] - Extra context fields
     * @returns {StructuredLogger}
     */
    child(module, extra = {}) {
        const child = new StructuredLogger({
            service: this.service,
            module,
            level: LEVEL_NAMES[this.minLevel],
            pretty: this.pretty,
            output: this.output,
        });
        child._extra = { ...(this._extra || {}), ...extra };
        return child;
    }

    // ─── Level Methods ──────────────────────────────────────────────────
    trace(msg, data) { this._log(LEVELS.TRACE, msg, data); }
    debug(msg, data) { this._log(LEVELS.DEBUG, msg, data); }
    info(msg, data) { this._log(LEVELS.INFO, msg, data); }
    warn(msg, data) { this._log(LEVELS.WARN, msg, data); }
    error(msg, data) { this._log(LEVELS.ERROR, msg, data); }
    fatal(msg, data) { this._log(LEVELS.FATAL, msg, data); }

    /**
     * φ-sampled log — only emits every φ^n-th call for high-volume paths.
     * @param {string} key - Sampling key
     * @param {number} level - Log level
     * @param {string} msg - Message
     * @param {object} [data] - Context data
     */
    sampled(key, level, msg, data) {
        const count = (this._sampleCounters[key] || 0) + 1;
        this._sampleCounters[key] = count;
        // Emit at 1, 2, 3, 5, 8, 13, 21, 34, 55, 89... (Fibonacci)
        if (_isFibonacci(count)) {
            this._log(level, msg, { ...data, _sampled: true, _sampleCount: count });
        }
    }

    // ─── Internal ───────────────────────────────────────────────────────
    _log(level, msg, data) {
        if (level < this.minLevel) return;

        const entry = {
            timestamp: new Date().toISOString(),
            level: LEVEL_NAMES[level] || 'INFO',
            service: this.service,
            ...(this.module && { module: this.module }),
            message: typeof msg === 'string' ? msg : JSON.stringify(msg),
            ...(this._extra || {}),
            ...(data && { data: _redact(data) }),
        };

        // Add error stack if present
        if (data instanceof Error) {
            entry.error = { name: data.name, message: data.message, stack: data.stack };
            delete entry.data;
        }

        const line = this.pretty
            ? JSON.stringify(entry, null, 2)
            : JSON.stringify(entry);

        this.output.write(line + '\n');
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function _redact(obj, depth = 0) {
    if (depth > 5 || obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(v => _redact(v, depth + 1));

    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
        if (REDACT_KEYS.has(k.toLowerCase())) {
            clean[k] = '[REDACTED]';
        } else if (typeof v === 'object' && v !== null) {
            clean[k] = _redact(v, depth + 1);
        } else {
            clean[k] = v;
        }
    }
    return clean;
}

function _isFibonacci(n) {
    // A number is Fibonacci if 5n²+4 or 5n²-4 is a perfect square
    const a = 5 * n * n + 4;
    const b = 5 * n * n - 4;
    const sqrtA = Math.sqrt(a);
    const sqrtB = Math.sqrt(b);
    return sqrtA === Math.floor(sqrtA) || sqrtB === Math.floor(sqrtB);
}

// ─── Singleton Factory ───────────────────────────────────────────────

const _instances = {};

function getLogger(service, module) {
    const key = `${service}:${module || ''}`;
    if (!_instances[key]) {
        _instances[key] = new StructuredLogger({ service, module });
    }
    return _instances[key];
}

module.exports = { StructuredLogger, getLogger, LEVELS, LEVEL_NAMES };
