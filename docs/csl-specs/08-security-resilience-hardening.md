# Heady™ Security Hardening + Resilience + Circuit Breakers

## Foundation
All changes are based on the HeadyMe repos and Heady project data. The actual source code for every referenced file is provided below.

## Objective
CSL confidence-gated access control replacing boolean security checks with continuous risk scoring. Resilient circuit breakers with phi-scaled recovery.

## Specific Deliverables — Build ALL Files
### 1. CSL Security Gates — continuous risk scoring, ALLOW/CHALLENGE/DENY at phi thresholds
### 2. Security Headers — consolidate duplicates, CSP/HSTS, dynamic CSL-adjusted strictness
### 3. Circuit Breakers — phi-scaled thresholds, CLOSED/HALF_OPEN/OPEN states, CSL on transitions
### 4. Web3 Ledger Anchoring — immutable security event logging, phi-scaled severity
### 5. Security Bee — continuous monitoring, CSL escalation, automated response
### 6. Test Suite — scoring, headers, circuit states, auth, threat detection

## Constraints
- φ = 1.6180339887, OWASP Top 10, zero-trust, Node.js/crypto only

---

## SOURCE FILES — COMPLETE HEADY CODEBASE CONTEXT


### `src/resilience/security-hardening.js`

```javascript
'use strict';

/**
 * security-hardening.js — OWASP Top 10 Security Middleware
 *
 * New file: comprehensive security middleware layer for the Heady platform.
 *
 * Protections implemented:
 *  1. Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy)
 *  2. Request sanitization (path traversal prevention, null-byte injection, oversized payloads)
 *  3. Prompt injection detection (multi-layer: keyword, pattern, Unicode normalization)
 *  4. RuleZGatekeeper path jail (prevents directory traversal on YAML schema loading)
 *  5. Content-Type enforcement (reject requests with unexpected MIME types)
 *  6. JSON deserialization safety (prototype pollution prevention)
 *  7. Correlation ID injection (X-Request-ID propagation for audit trail linkage)
 *  8. Security event structured logging
 *
 * @module security-hardening
 */

const crypto = require('crypto');
const path   = require('path');
const logger = require('../utils/logger');

// ─── Security logger ───────────────────────────────────────────────────────────

/**
 * Emit a structured security event.
 * In production, wire this to a SIEM (Splunk, Datadog Security, etc.).
 *
 * @param {string} event   - Security event type
 * @param {object} details - Event payload
 */
function securityEvent(event, details = {}) {
    const entry = {
        level:       'SECURITY',
        event,
        timestamp:   new Date().toISOString(),
        requestId:   details.requestId,
        ip:          details.ip,
        userId:      details.userId,
        ...details,
    };
    logger.warn(`[SECURITY] ${event}`, entry);
    // Emit to SIEM stream in production:
    // process.emit('heady:security-event', entry);
    return entry;
}

// ─── 1. Security Headers Middleware ───────────────────────────────────────────

/**
 * Attach security headers to every response.
 * Covers OWASP Top 10 A05:2021 (Security Misconfiguration).
 *
 * @param {object} [opts]
 * @param {string}  [opts.cspDirectives]  - Custom CSP; defaults to strict policy
 * @param {boolean} [opts.hsts=true]      - Enable Strict-Transport-Security
 * @param {number}  [opts.hstsMaxAge]     - HSTS max-age in seconds (default: 1 year)
 * @returns {import('express').RequestHandler}
 */
function securityHeaders(opts = {}) {
    const hstsMaxAge = opts.hstsMaxAge ?? 31_536_000; // 1 year
    const enableHsts = opts.hsts !== false;

    const csp = opts.cspDirectives ??
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self'; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none'; " +
        "form-action 'self'; " +
        "base-uri 'self'; " +
        "object-src 'none';";

    return (req, res, next) => {
        // Prevent clickjacking
        res.setHeader('X-Frame-Options', 'DENY');
        // Prevent MIME sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // XSS filter (legacy browsers)
        res.setHeader('X-XSS-Protection', '1; mode=block');
        // Referrer policy
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        // CSP
        res.setHeader('Content-Security-Policy', csp);
        // Permissions policy
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        // Remove server fingerprint
        res.removeHeader('X-Powered-By');
        res.removeHeader('Server');

        if (enableHsts) {
            res.setHeader('Strict-Transport-Security', `max-age=${hstsMaxAge}; includeSubDomains; preload`);
        }

        // Cache control for auth endpoints
        if (req.path.startsWith('/auth') || req.path.startsWith('/api/auth')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
        }

        next();
    };
}

// ─── 2. Correlation ID Middleware ─────────────────────────────────────────────

/**
 * Inject a correlation ID for request tracing.
 * Reads X-Request-ID header from caller (if trusted), or generates a fresh one.
 *
 * @returns {import('express').RequestHandler}
 */
function correlationId() {
    return (req, res, next) => {
        const fromHeader = req.headers['x-request-id'];
        // Only accept caller-provided IDs if they match safe format (prevent header injection)
        const id = (fromHeader && /^[\w\-]{8,64}$/.test(fromHeader))
            ? fromHeader
            : crypto.randomUUID();

        req.requestId = id;
        res.setHeader('X-Request-ID', id);
        next();
    };
}

// ─── 3. Request Sanitization ──────────────────────────────────────────────────

/**
 * Sanitize incoming requests against path traversal, null-byte injection,
 * and oversized payloads.
 * Covers OWASP A01:2021 (Broken Access Control) and A03:2021 (Injection).
 *
 * @param {object} [opts]
 * @param {number} [opts.maxUrlLength=2048]     - Max URL length
 * @param {number} [opts.maxHeaderValueLen=8192] - Max length of any single header value
 * @returns {import('express').RequestHandler}
 */
function requestSanitizer(opts = {}) {
    const maxUrlLength      = opts.maxUrlLength      ?? 2048;
    const maxHeaderValueLen = opts.maxHeaderValueLen ?? 8192;

    // Patterns that should never appear in a URL path
    const DANGEROUS_PATH_PATTERNS = [
        /\.\.\//,          // Path traversal (Unix)
        /\.\.\\/,          // Path traversal (Windows)
        /%2e%2e/i,         // URL-encoded ..
        /%252e/i,           // Double-encoded .
        /\0/,              // Null byte
        /<script/i,        // XSS in path
        /javascript:/i,    // JavaScript protocol
        /data:text\/html/i,// Data URI XSS
    ];

    return (req, res, next) => {
        const requestId = req.requestId || 'unknown';
        const ip = req.ip || req.connection?.remoteAddress;

        // URL length check
        if (req.url && req.url.length > maxUrlLength) {
            securityEvent('url-too-long', { requestId, ip, length: req.url.length, max: maxUrlLength });
            return res.status(414).json({ error: 'URI Too Long' });
        }

        // Path sanitization
        for (const pattern of DANGEROUS_PATH_PATTERNS) {
            if (pattern.test(req.url || '')) {
                securityEvent('path-traversal-attempt', {
                    requestId, ip, url: req.url, pattern: pattern.toString()
                });
                return res.status(400).json({ error: 'Bad Request' });
            }
        }

        // Header value length check
        for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string' && value.length > maxHeaderValueLen) {
                securityEvent('header-too-long', {
                    requestId, ip, header: key, length: value.length
                });
                return res.status(431).json({ error: 'Request Header Fields Too Large' });
            }
        }

        next();
    };
}

// ─── 4. Prompt Injection Detection ────────────────────────────────────────────

/**
 * Detect and block prompt injection attempts in AI-bound request payloads.
 * Applied to routes that forward user input to LLM providers.
 *
 * Defense layers:
 *  L1 — Direct keyword patterns
 *  L2 — Structural injection patterns (ignore/override/repeat)
 *  L3 — Unicode normalization (catches homoglyph attacks)
 *  L4 — Role impersonation detection
 *  L5 — Base64 encoded injection (catches obfuscation)
 *
 * Covers OWASP Top 10 for LLMs: LLM01 (Prompt Injection).
 *
 * @returns {import('express').RequestHandler}
 */
function promptInjectionGuard() {
    // L1: High-confidence jailbreak keywords
    const JAILBREAK_KEYWORDS = [
        'ignore previous instructions',
        'ignore all previous',
        'disregard your instructions',
        'forget your instructions',
        'your new instructions',
        'act as if you have no restrictions',
        'dan mode',
        'developer mode enabled',
        'jailbreak',
        'you are now',
        'pretend you are',
        'act as an ai with no',
    ];

    // L2: Structural injection patterns
    const INJECTION_PATTERNS = [
        /\bsystem\s*:\s*(ignore|forget|override|bypass)/i,
        /\[SYSTEM\].*\[\/SYSTEM\]/is,
        /<\|im_start\|>/i,    // OpenAI internal format
        /###\s*(instruction|system|prompt)/i,
        /\brepeat\s+(the\s+)?(above|previous|system)\s+(instructions?|prompt)/i,
        /\bprint\s+(your\s+)?(system\s+)?prompt/i,
        /\bwhat\s+(are|were)\s+(your|the)\s+(instructions?|system\s+prompt)/i,
    ];

    // L4: Role impersonation
    const ROLE_IMPERSONATION = [
        /you\s+are\s+(now\s+)?(a|an)\s+(helpful\s+)?(assistant|ai|chatbot)\s+(with|without|that)/i,
        /from\s+now\s+on\s+(you\s+are|act\s+as)/i,
    ];

    /**
     * Normalize Unicode to catch homoglyph substitutions.
     * e.g., "іgnore" (Cyrillic і) → "ignore"
     */
    function normalize(text) {
        return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    /**
     * Check a single text string for injection signals.
     * @returns {{ injected: boolean, layer: string|null, pattern: string|null }}
     */
    function detect(text) {
        if (typeof text !== 'string' || text.length === 0) {
            return { injected: false, layer: null, pattern: null };
        }

        const normalized = normalize(text);

        // L1 keyword scan
        for (const kw of JAILBREAK_KEYWORDS) {
            if (normalized.includes(kw)) {
                return { injected: true, layer: 'L1-keyword', pattern: kw };
            }
        }

        // L2 structural patterns
        for (const re of INJECTION_PATTERNS) {
            if (re.test(text)) {
                return { injected: true, layer: 'L2-structural', pattern: re.toString() };
            }
        }

        // L3 run normalized text through L2 patterns too
        for (const re of INJECTION_PATTERNS) {
            if (re.test(normalized)) {
                return { injected: true, layer: 'L3-unicode-normalized', pattern: re.toString() };
            }
        }

        // L4 role impersonation
        for (const re of ROLE_IMPERSONATION) {
            if (re.test(text)) {
                return { injected: true, layer: 'L4-role-impersonation', pattern: re.toString() };
            }
        }

        // L5 base64 obfuscation — decode and re-scan
        const b64Matches = text.match(/[A-Za-z0-9+/]{20,}={0,2}/g);
        if (b64Matches) {
            for (const b64 of b64Matches.slice(0, 5)) { // limit to first 5 chunks
                try {
                    const decoded = Buffer.from(b64, 'base64').toString('utf8');
                    const inner = detect(decoded);
                    if (inner.injected) {
                        return { injected: true, layer: 'L5-base64-obfuscated', pattern: inner.pattern };
                    }
                } catch { /* not valid base64, skip */ }
            }
        }

        return { injected: false, layer: null, pattern: null };
    }

    return (req, res, next) => {
        const requestId = req.requestId || 'unknown';
        const ip = req.ip || req.connection?.remoteAddress;
        const userId = req.user?.sub;

        // Extract all text fields from request body
        const textsToCheck = extractTextFields(req.body);

        for (const { path: fieldPath, value } of textsToCheck) {
            const result = detect(value);
            if (result.injected) {
                securityEvent('prompt-injection-detected', {
                    requestId, ip, userId,
                    field: fieldPath,
                    layer: result.layer,
                    pattern: result.pattern,
                    excerpt: value.slice(0, 120),
                });
                return res.status(400).json({
                    error:   'Request contains disallowed content',
                    code:    'PROMPT_INJECTION',
                    layer:   result.layer,
                });
            }
        }

        next();
    };
}

/**
 * Recursively extract all string values from a nested object with field paths.
 * @param {*}      obj
 * @param {string} [prefix]
 * @returns {Array<{path: string, value: string}>}
 */
function extractTextFields(obj, prefix = 'body') {
    const results = [];
    if (!obj || typeof obj !== 'object') return results;

    for (const [key, value] of Object.entries(obj)) {
        const p = `${prefix}.${key}`;
        if (typeof value === 'string') {
            results.push({ path: p, value });
        } else if (typeof value === 'object' && value !== null) {
            results.push(...extractTextFields(value, p));
        }
    }
    return results;
}

// ─── 5. JSON Prototype Pollution Guard ────────────────────────────────────────

/**
 * Block prototype pollution in JSON bodies.
 * Covers OWASP A08:2021 (Software and Data Integrity Failures).
 *
 * Usage: replace express.json() with safeJsonParser().
 *
 * @returns {import('express').RequestHandler}
 */
function safeJsonParser() {
    return (req, res, next) => {
        if (req.headers['content-type']?.includes('application/json')) {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
                if (!raw) return next();
                try {
                    const parsed = JSON.parse(raw);
                    // Detect prototype pollution keys
                    if (_hasProtoKeys(parsed)) {
                        securityEvent('prototype-pollution-attempt', {
                            requestId: req.requestId,
                            ip: req.ip,
                        });
                        return res.status(400).json({ error: 'Bad Request' });
                    }
                    req.body = parsed;
                    next();
                } catch {
                    res.status(400).json({ error: 'Invalid JSON' });
                }
            });
        } else {
            next();
        }
    };
}

/** @private */
function _hasProtoKeys(obj, depth = 0) {
    if (depth > 10 || typeof obj !== 'object' || obj === null) return false;
    for (const key of Object.keys(obj)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return true;
        if (_hasProtoKeys(obj[key], depth + 1)) return true;
    }
    return false;
}

// ─── 6. Content-Type Enforcement ──────────────────────────────────────────────

/**
 * Enforce expected Content-Type on POST/PUT/PATCH requests.
 * Covers OWASP A03:2021 (Injection).
 *
 * @param {string[]} [allowedTypes] - Default: ['application/json']
 * @returns {import('express').RequestHandler}
 */
function contentTypeEnforcement(allowedTypes = ['application/json']) {
    const modifyMethods = new Set(['POST', 'PUT', 'PATCH']);

    return (req, res, next) => {
        if (!modifyMethods.has(req.method)) return next();

        const ct = req.headers['content-type'] || '';
        const allowed = allowedTypes.some(t => ct.startsWith(t));

        if (!allowed && req.headers['content-length'] !== '0') {
            securityEvent('unexpected-content-type', {
                requestId: req.requestId,
                ip: req.ip,
                contentType: ct,
                allowed: allowedTypes,
            });
            return res.status(415).json({
                error: 'Unsupported Media Type',
                expected: allowedTypes,
            });
        }

        next();
    };
}

// ─── 7. Path Jail for RuleZGatekeeper ─────────────────────────────────────────

/**
 * Jail a file path within a permitted root directory.
 * Use this wherever a path is constructed from config or user-influenced data.
 *
 * Addresses CRIT-004 (RuleZ path traversal).
 *
 * @param {string} base - The permitted root directory (must be absolute)
 * @param {string} rel  - The relative path to resolve
 * @returns {string}    - The resolved absolute path
 * @throws {Error}      - If the resolved path escapes the jail
 */
function jailPath(base, rel) {
    const absBase     = path.resolve(base);
    const absResolved = path.resolve(absBase, rel);

    if (!absResolved.startsWith(absBase + path.sep) && absResolved !== absBase) {
        throw Object.assign(
            new Error(`Path traversal detected: "${rel}" escapes jail "${absBase}"`),
            { code: 'PATH_TRAVERSAL', base: absBase, resolved: absResolved }
        );
    }

    return absResolved;
}

// ─── 8. Health Route Auth Guard ───────────────────────────────────────────────

/**
 * Protect /health/full from unauthenticated access.
 * Allows /health/live and /health/ready (needed for Kubernetes probes from within the cluster).
 *
 * Addresses MED-010 (health routes expose system internals).
 *
 * @param {object} [opts]
 * @param {string} [opts.internalSecret] - Static secret expected in X-Internal-Token header
 * @returns {import('express').RequestHandler}
 */
function healthRouteGuard(opts = {}) {
    const secret = opts.internalSecret || process.env.HEALTH_INTERNAL_SECRET;

    return (req, res, next) => {
        // /live and /ready are safe to expose (no sensitive data)
        if (req.path === '/live' || req.path === '/ready') return next();

        // /full and any other health endpoints require internal token or loopback
        const ip = req.ip || req.connection?.remoteAddress;
        const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

        if (isLoopback) return next();

        if (secret) {
            const provided = req.headers['x-internal-token'];
            if (!provided || !crypto.timingSafeEqual(
                Buffer.from(provided),
                Buffer.from(secret)
            )) {
                securityEvent('health-route-unauthorized', { requestId: req.requestId, ip, path: req.path });
                return res.status(401).json({ error: 'Unauthorized' });
            }
        } else {
            // No secret configured — restrict to loopback only
            securityEvent('health-route-denied-no-secret', { requestId: req.requestId, ip, path: req.path });
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    };
}

// ─── Middleware stack factory ──────────────────────────────────────────────────

/**
 * Compose the full security middleware stack for use with Express.
 *
 * @example
 * const app = express();
 * app.use(securityStack());
 *
 * @param {object} [opts]
 * @param {boolean} [opts.promptGuard=true]       - Enable prompt injection guard
 * @param {boolean} [opts.contentTypeGuard=true]  - Enable content-type enforcement
 * @param {boolean} [opts.protoGuard=true]        - Enable prototype pollution guard
 * @returns {import('express').RequestHandler[]}
 */
function securityStack(opts = {}) {
    const stack = [
        correlationId(),
        securityHeaders(opts.headers || {}),
        requestSanitizer(opts.sanitizer || {}),
    ];

    if (opts.promptGuard !== false) {
        stack.push(promptInjectionGuard());
    }
    if (opts.contentTypeGuard !== false) {
        stack.push(contentTypeEnforcement(opts.allowedContentTypes));
    }

    return stack;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    // Middleware
    securityHeaders,
    correlationId,
    requestSanitizer,
    promptInjectionGuard,
    safeJsonParser,
    contentTypeEnforcement,
    healthRouteGuard,
    securityStack,

    // Utilities
    jailPath,
    securityEvent,
    extractTextFields,
};
```
---

### `src/resilience/security-headers.js`

```javascript
'use strict';

/**
 * Heady™ Security Headers Middleware
 * Drop into: src/middleware/security-headers.js
 * Usage: app.use(securityHeaders())
 */

const helmet = require('helmet');

function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://*.headysystems.com",
          "https://*.headyme.com",
          "https://*.headyconnection.org",
          "https://*.headymcp.com",
          "https://*.headybuddy.org",
          "https://*.headyio.com",
          "https://*.headyapi.com",
          "https://*.headybot.com",
          "https://*.headyos.com",
        ],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
  });
}

module.exports = { securityHeaders };
```
---

### `src/resilience/circuit-breakers/mcp-breaker.js`

```javascript
/**
 * mcp-breaker.js
 * Circuit-breaker wrapper for MCP SDK tool calls (@modelcontextprotocol/sdk).
 *
 * Features
 * --------
 * - Per-tool circuit breakers (31 tools, each with its own breaker instance)
 * - Tool call timeout enforcement (default 10 s, configurable per tool)
 * - Fallback implementations for critical tools (marked as CRITICAL)
 * - Tool availability dashboard
 * - Global MCP SDK breaker (parent) + per-tool children
 * - Event emission on state changes
 *
 * @module enterprise-hardening/circuit-breaker/mcp-breaker
 */
'use strict';

const { EventEmitter } = require('events');
const { registry, EnhancedCircuitBreaker, PHI } = require('./external-api-breakers');
const { STATES } = require('../../circuit-breaker');

// ---------------------------------------------------------------------------
// Tool registry (31 MCP tools for headymcp-core)
// ---------------------------------------------------------------------------
/**
 * Each entry:
 *   name         — tool identifier
 *   timeoutMs    — per-tool timeout override (falls back to DEFAULT_TOOL_TIMEOUT_MS)
 *   critical     — whether a fallback implementation exists
 *   fallback     — async function that handles the call when breaker is OPEN
 *   description  — short description for dashboard
 */
const DEFAULT_TOOL_TIMEOUT_MS = 10_000;

const TOOL_REGISTRY = [
  // Core system tools
  { name: 'heady.ping',              timeoutMs: 2_000,  critical: true,  description: 'Liveness check' },
  { name: 'heady.echo',              timeoutMs: 2_000,  critical: true,  description: 'Echo input' },
  { name: 'heady.status',            timeoutMs: 5_000,  critical: true,  description: 'System status' },
  { name: 'heady.config.get',        timeoutMs: 5_000,  critical: false, description: 'Get configuration value' },
  { name: 'heady.config.set',        timeoutMs: 5_000,  critical: false, description: 'Set configuration value' },

  // Agent tools
  { name: 'heady.agent.spawn',       timeoutMs: 15_000, critical: false, description: 'Spawn a new agent' },
  { name: 'heady.agent.stop',        timeoutMs: 5_000,  critical: false, description: 'Stop a running agent' },
  { name: 'heady.agent.list',        timeoutMs: 5_000,  critical: true,  description: 'List active agents' },
  { name: 'heady.agent.send',        timeoutMs: 10_000, critical: false, description: 'Send message to agent' },
  { name: 'heady.agent.receive',     timeoutMs: 10_000, critical: false, description: 'Receive message from agent' },

  // Memory tools
  { name: 'heady.memory.store',      timeoutMs: 5_000,  critical: false, description: 'Store to memory' },
  { name: 'heady.memory.retrieve',   timeoutMs: 5_000,  critical: true,  description: 'Retrieve from memory' },
  { name: 'heady.memory.search',     timeoutMs: 10_000, critical: false, description: 'Semantic memory search' },
  { name: 'heady.memory.delete',     timeoutMs: 5_000,  critical: false, description: 'Delete memory entry' },
  { name: 'heady.memory.list',       timeoutMs: 5_000,  critical: false, description: 'List memory entries' },

  // LLM / model tools
  { name: 'heady.llm.generate',      timeoutMs: 30_000, critical: true,  description: 'LLM text generation' },
  { name: 'heady.llm.embed',         timeoutMs: 15_000, critical: false, description: 'Generate embeddings' },
  { name: 'heady.llm.stream',        timeoutMs: 30_000, critical: false, description: 'Streaming generation' },

  // File / storage tools
  { name: 'heady.file.read',         timeoutMs: 10_000, critical: true,  description: 'Read file' },
  { name: 'heady.file.write',        timeoutMs: 10_000, critical: false, description: 'Write file' },
  { name: 'heady.file.list',         timeoutMs: 5_000,  critical: true,  description: 'List files' },
  { name: 'heady.file.delete',       timeoutMs: 5_000,  critical: false, description: 'Delete file' },

  // Web / search tools
  { name: 'heady.web.fetch',         timeoutMs: 15_000, critical: false, description: 'Fetch URL' },
  { name: 'heady.web.search',        timeoutMs: 15_000, critical: false, description: 'Web search' },
  { name: 'heady.web.screenshot',    timeoutMs: 30_000, critical: false, description: 'Screenshot URL' },

  // Code tools
  { name: 'heady.code.run',          timeoutMs: 30_000, critical: false, description: 'Execute code' },
  { name: 'heady.code.lint',         timeoutMs: 10_000, critical: false, description: 'Lint code' },

  // Data tools
  { name: 'heady.data.query',        timeoutMs: 30_000, critical: false, description: 'Database query' },
  { name: 'heady.data.transform',    timeoutMs: 15_000, critical: false, description: 'Transform data' },

  // Workflow tools
  { name: 'heady.workflow.trigger',  timeoutMs: 10_000, critical: false, description: 'Trigger workflow' },
  { name: 'heady.workflow.status',   timeoutMs: 5_000,  critical: true,  description: 'Check workflow status' },
];

// ---------------------------------------------------------------------------
// Fallback implementations for CRITICAL tools
// ---------------------------------------------------------------------------
const CRITICAL_FALLBACKS = {
  'heady.ping': async (_params) => ({ pong: true, fallback: true, timestamp: Date.now() }),

  'heady.echo': async (params) => ({ echo: params?.input || '', fallback: true }),

  'heady.status': async (_params) => ({
    status: 'degraded',
    fallback: true,
    message: 'MCP SDK breaker OPEN — running in degraded mode',
    timestamp: new Date().toISOString(),
  }),

  'heady.agent.list': async (_params) => ({
    agents: [],
    fallback: true,
    message: 'Agent list unavailable while MCP circuit is open',
  }),

  'heady.memory.retrieve': async (params) => ({
    result: null,
    fallback: true,
    message: `Memory unavailable for key: ${params?.key || 'unknown'}`,
  }),

  'heady.llm.generate': async (params) => ({
    content: 'Service temporarily unavailable. Please retry shortly.',
    model: 'fallback',
    fallback: true,
    prompt: params?.prompt || '',
  }),

  'heady.file.read': async (params) => ({
    content: null,
    fallback: true,
    error: `File read unavailable for: ${params?.path || 'unknown'}`,
  }),

  'heady.file.list': async (params) => ({
    files: [],
    fallback: true,
    message: `File listing unavailable for: ${params?.dir || '/'}`,
  }),

  'heady.workflow.status': async (params) => ({
    status: 'unknown',
    fallback: true,
    workflowId: params?.workflowId || 'unknown',
  }),
};

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------
function withTimeout(promise, ms, toolName) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`MCP tool timeout: ${toolName} (${ms}ms)`)),
      ms
    );
    promise.then(v => { clearTimeout(t); resolve(v); },
                 e => { clearTimeout(t); reject(e); });
  });
}

// ---------------------------------------------------------------------------
// MCPToolBreaker — manages per-tool breakers
// ---------------------------------------------------------------------------
class MCPToolBreaker extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {object}   [opts.mcpClient]       @modelcontextprotocol/sdk Client instance
   * @param {number}   [opts.defaultTimeoutMs]
   * @param {boolean}  [opts.useFallbacks]    Default: true
   */
  constructor(opts = {}) {
    super();
    this._client         = opts.mcpClient      || null;
    this._defaultTimeout = opts.defaultTimeoutMs || DEFAULT_TOOL_TIMEOUT_MS;
    this._useFallbacks   = opts.useFallbacks !== false;

    // Global MCP SDK breaker (parent)
    this._globalBreaker = registry.get('mcp-sdk');
    this._globalBreaker.on('stateChange', e => this.emit('stateChange', { ...e, scope: 'global' }));

    // Per-tool breakers — Map<toolName, EnhancedCircuitBreaker>
    this._toolBreakers = new Map();
    this._toolConfigs  = new Map();
    this._toolMetrics  = new Map();

    // Register all 31 tools
    for (const tool of TOOL_REGISTRY) {
      this._registerTool(tool);
    }
  }

  // -------------------------------------------------------------------------
  // Tool registration
  // -------------------------------------------------------------------------
  _registerTool(toolDef) {
    const { name, timeoutMs, critical, description, fallback } = toolDef;

    const breaker = new EnhancedCircuitBreaker(`mcp:${name}`, {
      failureThreshold: 5,
      recoveryTimeout:  30_000,
      halfOpenMaxCalls: 3,
      timeoutMs: timeoutMs || this._defaultTimeout,
    });

    breaker.on('stateChange', e => {
      this.emit('toolStateChange', { ...e, tool: name });
    });

    this._toolBreakers.set(name, breaker);
    this._toolConfigs.set(name, {
      timeoutMs: timeoutMs || this._defaultTimeout,
      critical: !!critical,
      description: description || name,
      fallback: fallback || CRITICAL_FALLBACKS[name] || null,
    });
    this._toolMetrics.set(name, { calls: 0, failures: 0, fallbackCalls: 0, lastError: null });
  }

  /**
   * Dynamically register an additional tool not in the default 31.
   * @param {object} toolDef
   */
  registerTool(toolDef) {
    if (this._toolBreakers.has(toolDef.name)) return; // already registered
    this._registerTool(toolDef);
  }

  setClient(client) { this._client = client; }

  // -------------------------------------------------------------------------
  // Core call() — main entry point
  // -------------------------------------------------------------------------
  /**
   * Call an MCP tool with full circuit-breaker protection.
   *
   * @param {string} toolName   MCP tool name (e.g. 'heady.memory.retrieve')
   * @param {object} [params]   Tool parameters
   * @returns {Promise<any>}
   */
  async call(toolName, params = {}) {
    const metrics = this._toolMetrics.get(toolName);
    const config  = this._toolConfigs.get(toolName);
    const breaker = this._toolBreakers.get(toolName);

    if (!breaker) {
      // Unknown tool — register it dynamically and proceed
      this.registerTool({ name: toolName });
      return this.call(toolName, params);
    }

    metrics.calls++;

    // If global MCP breaker is OPEN, check for fallback
    if (this._globalBreaker.state === STATES.OPEN) {
      return this._handleFallback(toolName, params, config, metrics, new Error('Global MCP circuit is OPEN'));
    }

    // If per-tool breaker is OPEN, check for fallback
    if (breaker.state === STATES.OPEN) {
      return this._handleFallback(toolName, params, config, metrics, new Error(`Tool circuit ${toolName} is OPEN`));
    }

    const timeoutMs = config?.timeoutMs || this._defaultTimeout;

    try {
      const result = await breaker.execute(() =>
        this._globalBreaker.execute(() => {
          if (!this._client) throw new Error('MCPToolBreaker: MCP client not initialised');
          return withTimeout(
            this._client.callTool({ name: toolName, arguments: params }),
            timeoutMs,
            toolName
          );
        })
      );

      return result;
    } catch (err) {
      metrics.failures++;
      metrics.lastError = err.message;
      return this._handleFallback(toolName, params, config, metrics, err);
    }
  }

  // -------------------------------------------------------------------------
  // Fallback handling
  // -------------------------------------------------------------------------
  async _handleFallback(toolName, params, config, metrics, originalErr) {
    if (!this._useFallbacks) throw originalErr;

    const fallbackFn = config?.fallback || CRITICAL_FALLBACKS[toolName];

    if (!fallbackFn) {
      this.emit('toolFailed', { tool: toolName, error: originalErr.message, fallback: false });
      throw originalErr;
    }

    try {
      metrics.fallbackCalls++;
      const result = await fallbackFn(params);
      this.emit('toolFallback', { tool: toolName, reason: originalErr.message });
      return result;
    } catch (fallbackErr) {
      this.emit('toolFailed', { tool: toolName, error: fallbackErr.message, fallback: true });
      throw new Error(`${toolName} and its fallback both failed: ${fallbackErr.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Batch call (parallel, with individual error handling)
  // -------------------------------------------------------------------------
  /**
   * Call multiple tools in parallel.
   * Returns an array of { toolName, result?, error? } objects.
   *
   * @param {Array<{name: string, params?: object}>} calls
   */
  async callBatch(calls) {
    return Promise.all(
      calls.map(async ({ name, params }) => {
        try {
          const result = await this.call(name, params);
          return { toolName: name, result };
        } catch (err) {
          return { toolName: name, error: err.message };
        }
      })
    );
  }

  // -------------------------------------------------------------------------
  // Tool availability dashboard
  // -------------------------------------------------------------------------
  /**
   * Returns availability status for all registered tools.
   */
  dashboard() {
    const tools = {};
    for (const [name, breaker] of this._toolBreakers.entries()) {
      const config  = this._toolConfigs.get(name);
      const metrics = this._toolMetrics.get(name);
      tools[name] = {
        state:         breaker.state,
        available:     breaker.state !== STATES.OPEN,
        critical:      config.critical,
        hasFallback:   !!(config.fallback || CRITICAL_FALLBACKS[name]),
        description:   config.description,
        timeoutMs:     config.timeoutMs,
        calls:         metrics.calls,
        failures:      metrics.failures,
        fallbackCalls: metrics.fallbackCalls,
        lastError:     metrics.lastError,
        p99LatencyMs:  breaker.p99LatencyMs,
      };
    }

    const toolList = Object.values(tools);
    return {
      timestamp: new Date().toISOString(),
      global: this._globalBreaker.snapshot(),
      summary: {
        total:          toolList.length,
        available:      toolList.filter(t => t.available).length,
        open:           toolList.filter(t => !t.available).length,
        critical:       toolList.filter(t => t.critical).length,
        withFallback:   toolList.filter(t => t.hasFallback).length,
      },
      tools,
    };
  }

  // -------------------------------------------------------------------------
  // Reset helpers
  // -------------------------------------------------------------------------
  resetTool(toolName) {
    const b = this._toolBreakers.get(toolName);
    if (!b) throw new Error(`Unknown tool: ${toolName}`);
    b.reset();
    const m = this._toolMetrics.get(toolName);
    m.calls = 0; m.failures = 0; m.fallbackCalls = 0; m.lastError = null;
  }

  resetAll() {
    this._globalBreaker.reset();
    for (const [name] of this._toolBreakers) this.resetTool(name);
  }

  // -------------------------------------------------------------------------
  // Express route handler factories
  // -------------------------------------------------------------------------
  dashboardHandler() {
    return (_req, res) => res.json(this.dashboard());
  }

  resetToolHandler() {
    return (req, res) => {
      const { tool } = req.params;
      try {
        this.resetTool(tool);
        res.json({ tool, reset: true });
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    };
  }

  registerRoutes(app) {
    app.get('/api/mcp/breakers',           this.dashboardHandler());
    app.post('/api/mcp/breakers/:tool/reset', this.resetToolHandler());
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
const mcpBreaker = new MCPToolBreaker();

module.exports = {
  mcpBreaker,
  MCPToolBreaker,
  TOOL_REGISTRY,
  CRITICAL_FALLBACKS,
  DEFAULT_TOOL_TIMEOUT_MS,
};
```
---

### `src/middleware/security/security-headers.js`

```javascript
/**
 * Security Headers Middleware — Comprehensive Production Implementation
 * @module security-middleware/security-headers
 *
 * Provides all recommended security response headers:
 *  - Content-Security-Policy (strict nonce-based)
 *  - Strict-Transport-Security (HSTS + preload)
 *  - X-Content-Type-Options
 *  - X-Frame-Options (configurable)
 *  - X-XSS-Protection (disabled in favor of CSP)
 *  - Referrer-Policy
 *  - Permissions-Policy
 *  - Cross-Origin-Opener-Policy
 *  - Cross-Origin-Resource-Policy
 *  - Cross-Origin-Embedder-Policy
 *  - Cache-Control
 *  - X-Request-ID injection
 *  - X-DNS-Prefetch-Control
 *  - Report-To (CSP violation reporting)
 *  - CSP nonce generation + injection into res.locals
 */

'use strict';

const crypto = require('crypto');

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULTS = {
  // HSTS
  hstsMaxAge:               31536000,  // 1 year
  hstsIncludeSubdomains:    true,
  hstsPreload:              true,

  // CSP
  cspReportUri:             '/csp-violations',
  cspReportOnlyMode:        false,

  // X-Frame-Options
  frameOptions:             'DENY',    // 'DENY' | 'SAMEORIGIN' | null (to disable)

  // Referrer Policy
  referrerPolicy:           'strict-origin-when-cross-origin',

  // COOP / COEP / CORP
  crossOriginOpenerPolicy:  'same-origin',
  crossOriginEmbedderPolicy:'require-corp',
  crossOriginResourcePolicy:'same-origin',

  // Cache-Control for authenticated routes
  cacheControlAuthenticated:'no-store, max-age=0',
  cacheControlPublic:       'public, max-age=3600',

  // Request ID
  requestIdHeader:          'X-Request-ID',

  // Report-To endpoint
  reportToGroupName:        'heady-csp-violations',
  reportToEndpoint:         '/csp-violations',
  reportToMaxAge:           86400,

  // Permissions Policy defaults (deny all sensitive APIs)
  permissionsPolicy: {
    accelerometer:    '()',
    'ambient-light-sensor': '()',
    autoplay:         '()',
    battery:          '()',
    camera:           '()',
    'display-capture': '()',
    'document-domain': '()',
    'encrypted-media': '()',
    'execution-while-not-rendered': '()',
    'execution-while-out-of-viewport': '()',
    fullscreen:       '()',
    geolocation:      '()',
    gyroscope:        '()',
    'keyboard-map':   '()',
    magnetometer:     '()',
    microphone:       '()',
    midi:             '()',
    'navigation-override': '()',
    payment:          '()',
    'picture-in-picture': '()',
    'publickey-credentials-get': '()',
    'screen-wake-lock': '()',
    'serial':         '()',
    'speaker-selection': '()',
    'sync-xhr':       '()',
    usb:              '()',
    'web-share':      '()',
    'xr-spatial-tracking': '()',
  },
};

// ─── CSP Nonce Generation ─────────────────────────────────────────────────────

/**
 * Generate a cryptographically random CSP nonce.
 * @returns {string} base64url-encoded 16-byte nonce
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('base64url');
}

// ─── CSP Builder ─────────────────────────────────────────────────────────────

/**
 * Build a strict CSP header value with nonce.
 *
 * @param {string} nonce          - CSP nonce value
 * @param {object} [overrides]    - Per-request CSP directive overrides
 * @param {string} [reportUri]    - CSP report URI
 * @returns {string}
 */
function buildCSP(nonce, overrides = {}, reportUri = '/csp-violations') {
  const directives = {
    'default-src':   ["'self'"],
    'script-src':    ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    'style-src':     ["'self'", `'nonce-${nonce}'`],
    'img-src':       ["'self'", 'data:', 'blob:', 'https:'],
    'font-src':      ["'self'", 'data:'],
    'connect-src':   ["'self'", 'https://api.headyme.com', 'https://api.headysystems.com', 'wss://api.headyme.com'],
    'frame-src':     ["'none'"],
    'frame-ancestors': ["'none'"],
    'object-src':    ["'none'"],
    'base-uri':      ["'self'"],
    'form-action':   ["'self'"],
    'manifest-src':  ["'self'"],
    'worker-src':    ["'self'", 'blob:'],
    'media-src':     ["'self'"],
    'upgrade-insecure-requests': [],
    'block-all-mixed-content':   [],
    ...overrides,
  };

  if (reportUri) {
    directives['report-uri'] = [reportUri];
  }

  return Object.entries(directives)
    .map(([directive, values]) => {
      if (!values || values.length === 0) return directive;
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

// ─── Permissions Policy Builder ───────────────────────────────────────────────

function buildPermissionsPolicy(policy) {
  return Object.entries(policy)
    .map(([feature, value]) => `${feature}=${value}`)
    .join(', ');
}

// ─── Report-To Header Builder ─────────────────────────────────────────────────

function buildReportTo(groupName, endpoint, maxAge) {
  return JSON.stringify({
    group:      groupName,
    max_age:    maxAge,
    endpoints:  [{ url: endpoint }],
    include_subdomains: true,
  });
}

// ─── Main Middleware Factory ──────────────────────────────────────────────────

/**
 * Create the security headers Express middleware.
 *
 * @param {object} [opts]                  - Configuration overrides
 * @param {number} [opts.hstsMaxAge]       - HSTS max-age in seconds
 * @param {boolean} [opts.hstsIncludeSubdomains]
 * @param {boolean} [opts.hstsPreload]
 * @param {string} [opts.frameOptions]     - X-Frame-Options value (or null to disable)
 * @param {string} [opts.cspReportUri]     - CSP violation report URI
 * @param {boolean} [opts.cspReportOnlyMode] - Use CSP-Report-Only header
 * @param {object} [opts.cspOverrides]     - CSP directive overrides applied globally
 * @param {object} [opts.permissionsPolicy] - Permissions-Policy overrides
 * @param {boolean} [opts.requireAuth]     - If true, set Cache-Control: no-store
 * @param {Function} [opts.isAuthenticated] - fn(req) → bool; determine if route is authenticated
 * @returns {Function} Express middleware
 */
function securityHeaders(opts = {}) {
  const config = { ...DEFAULTS, ...opts };
  const permPolicy = buildPermissionsPolicy({ ...DEFAULTS.permissionsPolicy, ...(opts.permissionsPolicy || {}) });
  const reportTo   = buildReportTo(config.reportToGroupName, config.reportToEndpoint, config.reportToMaxAge);

  // Build HSTS value
  let hsts = `max-age=${config.hstsMaxAge}`;
  if (config.hstsIncludeSubdomains) hsts += '; includeSubDomains';
  if (config.hstsPreload)           hsts += '; preload';

  return (req, res, next) => {
    // ── Generate per-request CSP nonce ──────────────────────────────────
    const nonce = generateNonce();
    res.locals.cspNonce = nonce;

    // ── Determine if route is authenticated ──────────────────────────────
    const isAuth = typeof config.isAuthenticated === 'function'
      ? config.isAuthenticated(req)
      : !!(req.user || req.session?.userId);

    // ── Build CSP (allow per-request overrides via res.locals.cspOverrides) ──
    const cspValue = buildCSP(nonce, { ...config.cspOverrides, ...res.locals.cspOverrides }, config.cspReportUri);

    // ── Set headers ──────────────────────────────────────────────────────

    // Transport Security
    res.set('Strict-Transport-Security', hsts);

    // Content Security Policy
    const cspHeaderName = config.cspReportOnlyMode ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
    res.set(cspHeaderName, cspValue);

    // Content type sniffing prevention
    res.set('X-Content-Type-Options', 'nosniff');

    // Frame embedding prevention
    if (config.frameOptions) {
      res.set('X-Frame-Options', config.frameOptions);
    }

    // XSS Protection — explicitly disable; CSP is the modern replacement
    res.set('X-XSS-Protection', '0');

    // Referrer Policy
    res.set('Referrer-Policy', config.referrerPolicy);

    // Permissions Policy
    res.set('Permissions-Policy', permPolicy);

    // Cross-Origin Policies
    res.set('Cross-Origin-Opener-Policy',   config.crossOriginOpenerPolicy);
    res.set('Cross-Origin-Embedder-Policy', config.crossOriginEmbedderPolicy);
    res.set('Cross-Origin-Resource-Policy', config.crossOriginResourcePolicy);

    // Cache Control
    if (isAuth || config.requireAuth) {
      res.set('Cache-Control', config.cacheControlAuthenticated);
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    } else {
      res.set('Cache-Control', config.cacheControlPublic);
    }

    // DNS Prefetch Control
    res.set('X-DNS-Prefetch-Control', 'off');

    // Report-To (for CSP violation collection + other reporting APIs)
    res.set('Report-To', reportTo);

    // Request ID — use existing or generate new
    const requestId = req.id
      || req.headers[config.requestIdHeader.toLowerCase()]
      || req.headers['x-request-id']
      || crypto.randomUUID();

    req.id = requestId;
    res.set(config.requestIdHeader, requestId);

    // Remove server info headers (defense in depth)
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  };
}

// ─── Per-Route Frame Options Middleware ───────────────────────────────────────

/**
 * Override X-Frame-Options on a per-route basis.
 * Use to allow specific embed targets.
 *
 * @param {'DENY'|'SAMEORIGIN'|string} value  - 'ALLOW-FROM uri' for legacy
 * @returns {Function} Express middleware
 */
function frameOptions(value) {
  return (req, res, next) => {
    if (value === null) {
      res.removeHeader('X-Frame-Options');
    } else {
      res.set('X-Frame-Options', value);
    }
    next();
  };
}

/**
 * Per-route CSP override middleware.
 * Merges additional CSP directives for a specific route (e.g., to allow specific embed).
 *
 * @param {object} directives  - CSP directive overrides
 * @returns {Function} Express middleware
 */
function cspOverride(directives) {
  return (req, res, next) => {
    res.locals.cspOverrides = { ...(res.locals.cspOverrides || {}), ...directives };
    next();
  };
}

// ─── CSP Violation Report Handler ────────────────────────────────────────────

/**
 * Express route handler for CSP violation reports.
 * Mount at the same path as cspReportUri.
 *
 * @param {object} [opts]
 * @param {Function} [opts.onViolation]  - Callback(report, req)
 * @returns {Function} Express route handler
 */
function cspViolationHandler(opts = {}) {
  return (req, res) => {
    const report = req.body?.['csp-report'] || req.body || {};

    // Minimal validation
    if (!report['document-uri'] && !report['blocked-uri']) {
      return res.status(204).end();
    }

    const violation = {
      timestamp:     new Date().toISOString(),
      documentUri:   report['document-uri'],
      referrer:      report['referrer'],
      violatedDir:   report['violated-directive'],
      effectiveDir:  report['effective-directive'],
      originalPolicy: report['original-policy'],
      blockedUri:    report['blocked-uri'],
      statusCode:    report['status-code'],
      scriptSample:  report['script-sample'],
      ip:            req.ip || req.headers['x-forwarded-for'],
      userAgent:     req.headers['user-agent'],
      requestId:     req.id,
    };

    // Call optional handler
    if (typeof opts.onViolation === 'function') {
      try { opts.onViolation(violation, req); } catch {}
    }

    // Default: log to stderr
    console.warn('[CSP-VIOLATION]', JSON.stringify(violation));

    res.status(204).end();
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  securityHeaders,
  frameOptions,
  cspOverride,
  cspViolationHandler,
  generateNonce,
  buildCSP,
  buildPermissionsPolicy,
  buildReportTo,
  DEFAULTS,
};

// ─── Usage Example ────────────────────────────────────────────────────────────
/*
const express = require('express');
const { securityHeaders, cspViolationHandler, frameOptions } = require('./security-headers');

const app = express();

// Apply to all routes
app.use(securityHeaders({
  cspReportUri:     '/.well-known/csp-violations',
  isAuthenticated:  (req) => !!req.user,
  // Allow specific analytics domains in connect-src
  cspOverrides: {
    'connect-src': ["'self'", 'https://api.headyme.com', 'https://telemetry.headysystems.com'],
  },
}));

// CSP violation handler
app.post('/.well-known/csp-violations',
  express.json({ type: ['application/json', 'application/csp-report'] }),
  cspViolationHandler({ onViolation: (v) => auditLogger.log({ action: 'CSP_VIOLATION', metadata: v }) })
);

// Override frame options for specific embeddable page
app.get('/embed/widget', frameOptions('SAMEORIGIN'), (req, res) => {
  // This page can be embedded in same-origin iframes
  res.send(`<script nonce="${res.locals.cspNonce}">console.log('widget')</script>`);
});
*/
```
---

### `src/middleware/mcp-auth.js`

```javascript
/**
 * T6: MCP Gateway Auth — SSO-integrated authentication for MCP servers
 * @module src/middleware/mcp-auth
 */
'use strict';

const crypto = require('crypto');
const { CircuitBreaker, TokenBucketRateLimiter } = require('../lib/circuit-breaker');

const MCP_RATE_LIMIT = parseInt(process.env.MCP_RATE_LIMIT || '100', 10);

class MCPGatewayAuth {
    constructor(opts = {}) {
        this.rateLimiter = new TokenBucketRateLimiter({ rate: MCP_RATE_LIMIT, burst: 20 });
        this.breaker = new CircuitBreaker({ failureThreshold: 5, recoveryTimeout: 30000 });
        this.allowedScopes = opts.scopes || ['tools.read', 'tools.execute', 'resources.read'];
        this._sessions = new Map();
    }

    // Validate MCP-specific JWT with scope checks
    async authenticate(req) {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return { authenticated: false, error: 'Missing authorization' };

        try {
            const [, payload] = token.split('.');
            const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

            // Validate issued-for this MCP server
            if (decoded.aud && decoded.aud !== process.env.MCP_SERVER_ID) {
                return { authenticated: false, error: 'Token not issued for this MCP server' };
            }

            // Validate expiry
            if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
                return { authenticated: false, error: 'Token expired' };
            }

            // Validate scopes
            const tokenScopes = decoded.scope?.split(' ') || [];
            const hasScope = this.allowedScopes.some(s => tokenScopes.includes(s));
            if (!hasScope && tokenScopes.length > 0) {
                return { authenticated: false, error: 'Insufficient scopes' };
            }

            return {
                authenticated: true,
                user: { id: decoded.sub, email: decoded.email, scopes: tokenScopes, tenantId: decoded.org },
            };
        } catch (err) {
            return { authenticated: false, error: 'Invalid token' };
        }
    }

    // Session management with __Host- cookie prefix per MCP spec
    createSession(userId) {
        const sessionId = crypto.randomUUID();
        this._sessions.set(sessionId, {
            userId, createdAt: Date.now(),
            expiresAt: Date.now() + 600000, // 10 min
        });
        return sessionId;
    }

    validateSession(sessionId) {
        const session = this._sessions.get(sessionId);
        if (!session || session.expiresAt < Date.now()) {
            this._sessions.delete(sessionId);
            return null;
        }
        return session;
    }

    // Express middleware
    middleware() {
        return async (req, res, next) => {
            // Rate limit
            const rateResult = this.rateLimiter.consume(req.ip);
            if (!rateResult.allowed) {
                res.set('Retry-After', String(rateResult.retryAfter));
                return res.status(429).json({ error: 'MCP rate limit exceeded' });
            }

            // Authenticate
            const authResult = await this.authenticate(req);
            if (!authResult.authenticated) {
                return res.status(401).json({ error: authResult.error });
            }

            req.mcpUser = authResult.user;
            req.tenantId = authResult.user.tenantId;
            next();
        };
    }

    getMetrics() {
        return {
            activeSessions: this._sessions.size,
            circuitBreaker: this.breaker.getState(),
        };
    }
}

module.exports = MCPGatewayAuth;
```
---

### `src/routes/security-routes.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Vector-Native Security Scanner REST Routes ───────────────────────────────
 *
 * Patent Docket: HS-062
 * Express-style route handlers exposing the Vector-Native Security Scanner.
 *
 * Mount in your Express app:
 *   const secRoutes = require('./src/routes/security-routes');
 *   app.use('/api/security', secRoutes.createRouter(express.Router()));
 *
 * Endpoints:
 *   POST   /api/security/patterns              — Register threat pattern (Claim 1a, 6)
 *   DELETE /api/security/patterns/:label       — Remove threat pattern
 *   GET    /api/security/patterns              — List all patterns
 *   POST   /api/security/scan/vector           — Full vector scan (Claims 1, 2, 3)
 *   POST   /api/security/scan/threat           — Threat pattern only scan (Claim 1b)
 *   POST   /api/security/outlier               — Outlier detection (Claim 1c, 3)
 *   POST   /api/security/zones                 — Register zone centroid
 *   POST   /api/security/access                — Record vector access (Claim 1d)
 *   POST   /api/security/baseline/zones        — Capture zone membership baseline (Claim 2)
 *   POST   /api/security/baseline/densities    — Capture density baseline (Claim 4)
 *   POST   /api/security/scan/membership       — Poisoning scan (Claim 2)
 *   POST   /api/security/scan/densities        — Sprawl scan (Claim 4)
 *   POST   /api/security/pre-deploy            — Pre-deploy gate (Claim 5)
 *   GET    /api/security/scan-history          — Scan history
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const {
    ThreatPatternRegistry,
    OutlierDetector,
    InjectionDetector,
    PoisoningDetector,
    AntiSprawlEngine,
    PreDeployGate,
    VectorNativeSecuritySystem,
} = require('../security/vector-native-scanner');

// Singleton system instance
const securitySystem = new VectorNativeSecuritySystem();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sendError(res, statusCode, message) {
    return res.status(statusCode).json({ error: message });
}

function isVector(v) {
    return Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'number' && isFinite(x));
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/security/patterns
 * Register a new threat pattern embedding vector.
 *
 * // RTP: HS-062 Claim 1(a) and Claim 6
 *
 * Body: { label: string, embedding: number[] }
 */
function postRegisterPattern(req, res) {
    // RTP: HS-062 Claim 1(a) and Claim 6
    const { label, embedding } = req.body;
    if (!label || typeof label !== 'string') return sendError(res, 400, 'label required');
    if (!isVector(embedding))                return sendError(res, 400, 'embedding must be a non-empty numeric array');
    try {
        const record = securitySystem.threatRegistry.registerPattern(label, embedding);
        res.status(201).json({ ok: true, data: record });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * DELETE /api/security/patterns/:label
 * Remove a threat pattern.
 */
function deletePattern(req, res) {
    const { label } = req.params;
    securitySystem.threatRegistry.removePattern(decodeURIComponent(label));
    res.json({ ok: true, data: { removed: label } });
}

/**
 * GET /api/security/patterns
 * List all registered threat patterns.
 *
 * // RTP: HS-062 Claim 1(a)
 */
function listPatterns(req, res) {
    // RTP: HS-062 Claim 1(a)
    const patterns = securitySystem.threatRegistry.listPatterns();
    res.json({ ok: true, data: { patterns, count: patterns.length } });
}

/**
 * POST /api/security/scan/vector
 * Run full geometric security scan on an incoming vector.
 *
 * // RTP: HS-062 Claim 1 (all parts), Claim 2, Claim 3
 *
 * Body: { vectorId: string, embedding: number[], zone?: string }
 */
function postScanVector(req, res) {
    // RTP: HS-062 Claim 1, 2, 3
    const { vectorId, embedding, zone = 'default' } = req.body;
    if (!vectorId)            return sendError(res, 400, 'vectorId required');
    if (!isVector(embedding)) return sendError(res, 400, 'embedding must be a non-empty numeric array');
    try {
        const result = securitySystem.scanVector(vectorId, embedding, zone);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/security/scan/threat
 * Scan vector against threat registry only.
 *
 * // RTP: HS-062 Claim 1(b)
 *
 * Body: { embedding: number[], threshold?: number }
 */
function postScanThreat(req, res) {
    // RTP: HS-062 Claim 1(b)
    const { embedding, threshold = 0.85 } = req.body;
    if (!isVector(embedding)) return sendError(res, 400, 'embedding required');
    try {
        const result = securitySystem.threatRegistry.scan(embedding, threshold);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/security/zones
 * Register a zone centroid for outlier detection.
 *
 * // RTP: HS-062 Claim 1(c) and Claim 3
 *
 * Body: { zoneName: string, centroid: number[] }
 */
function postRegisterZone(req, res) {
    // RTP: HS-062 Claim 1(c) and Claim 3
    const { zoneName, centroid } = req.body;
    if (!zoneName)            return sendError(res, 400, 'zoneName required');
    if (!isVector(centroid))  return sendError(res, 400, 'centroid must be a non-empty numeric array');
    securitySystem.outlierDetector.registerZone(zoneName, centroid);
    res.json({ ok: true, data: { zoneName, registered: true, totalZones: securitySystem.outlierDetector.zoneCount } });
}

/**
 * POST /api/security/outlier
 * Check if a vector is geometrically isolated (potential injection).
 *
 * // RTP: HS-062 Claim 1(c) and Claim 3
 *
 * Body: { embedding: number[] }
 */
function postOutlierScan(req, res) {
    // RTP: HS-062 Claim 1(c) and Claim 3
    const { embedding } = req.body;
    if (!isVector(embedding)) return sendError(res, 400, 'embedding required');
    try {
        const result = securitySystem.outlierDetector.scan(embedding);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/security/access
 * Record a vector access event for injection frequency tracking.
 *
 * // RTP: HS-062 Claim 1(d)
 *
 * Body: { vectorId: string, embedding?: number[] }
 */
function postRecordAccess(req, res) {
    // RTP: HS-062 Claim 1(d)
    const { vectorId, embedding } = req.body;
    if (!vectorId) return sendError(res, 400, 'vectorId required');
    securitySystem.injectionDetector.recordAccess(vectorId, embedding || null);
    res.json({ ok: true, data: { vectorId, recorded: true } });
}

/**
 * POST /api/security/baseline/zones
 * Capture zone membership baseline for poisoning detection.
 *
 * // RTP: HS-062 Claim 2
 *
 * Body: { memberships: Array<{ id: string, zone: string }> }
 */
function postCaptureZoneBaseline(req, res) {
    // RTP: HS-062 Claim 2
    const { memberships } = req.body;
    if (!Array.isArray(memberships)) return sendError(res, 400, 'memberships must be an array');
    securitySystem.poisoningDetector.captureBaseline(memberships);
    res.json({ ok: true, data: { captured: true, count: memberships.length } });
}

/**
 * POST /api/security/scan/membership
 * Scan current zone memberships against baseline for poisoning.
 *
 * // RTP: HS-062 Claim 2
 *
 * Body: { memberships: Array<{ id: string, zone: string }> }
 */
function postPoisoningScan(req, res) {
    // RTP: HS-062 Claim 2
    const { memberships } = req.body;
    if (!Array.isArray(memberships)) return sendError(res, 400, 'memberships must be an array');
    try {
        const result = securitySystem.poisoningDetector.scan(memberships);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/security/baseline/densities
 * Capture zone density baseline for anti-sprawl.
 *
 * // RTP: HS-062 Claim 4
 *
 * Body: { densities: { [zoneName: string]: number } }
 */
function postCaptureDensityBaseline(req, res) {
    // RTP: HS-062 Claim 4
    const { densities } = req.body;
    if (!densities || typeof densities !== 'object') return sendError(res, 400, 'densities object required');
    securitySystem.antiSprawlEngine.captureBaseline(densities);
    res.json({ ok: true, data: { captured: true, zones: Object.keys(densities).length } });
}

/**
 * POST /api/security/scan/densities
 * Check current zone densities against baseline for sprawl.
 *
 * // RTP: HS-062 Claim 4
 *
 * Body: { densities: { [zoneName: string]: number } }
 */
function postSprawlScan(req, res) {
    // RTP: HS-062 Claim 4
    const { densities } = req.body;
    if (!densities || typeof densities !== 'object') return sendError(res, 400, 'densities object required');
    try {
        const result = securitySystem.antiSprawlEngine.scan(densities);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/security/pre-deploy
 * Execute the pre-deployment security gate.
 *
 * // RTP: HS-062 Claim 5
 *
 * Body: {
 *   zoneDensities?: object,
 *   recentVectors?: Array<{ id, embedding, zone }>,
 *   currentMemberships?: Array<{ id, zone }>,
 *   memoryHealth?: object
 * }
 */
function postPreDeploy(req, res) {
    // RTP: HS-062 Claim 5
    try {
        const result = securitySystem.preDeployGate.run(req.body || {});
        const statusCode = result.allowed ? 200 : 422;
        res.status(statusCode).json({ ok: result.allowed, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/security/scan-history
 * Return scan history.
 */
function getScanHistory(req, res) {
    const limit  = parseInt(req.query.limit,  10) || 50;
    const history = securitySystem.getScanHistory();
    res.json({ ok: true, data: {
        entries: history.slice(-limit),
        total:   history.length,
    }});
}

// ─────────────────────────────────────────────────────────────────────────────
// Express Router
// ─────────────────────────────────────────────────────────────────────────────

function createRouter(router) {
    router.post(  '/patterns',              postRegisterPattern);
    router.delete('/patterns/:label',       deletePattern);
    router.get(   '/patterns',              listPatterns);
    router.post(  '/zones',                 postRegisterZone);
    router.post(  '/access',                postRecordAccess);
    router.post(  '/scan/vector',           postScanVector);
    router.post(  '/scan/threat',           postScanThreat);
    router.post(  '/outlier',               postOutlierScan);
    router.post(  '/baseline/zones',        postCaptureZoneBaseline);
    router.post(  '/baseline/densities',    postCaptureDensityBaseline);
    router.post(  '/scan/membership',       postPoisoningScan);
    router.post(  '/scan/densities',        postSprawlScan);
    router.post(  '/pre-deploy',            postPreDeploy);
    router.get(   '/scan-history',          getScanHistory);
    return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    createRouter,
    securitySystem,
    handlers: {
        postRegisterPattern,
        deletePattern,
        listPatterns,
        postRegisterZone,
        postRecordAccess,
        postScanVector,
        postScanThreat,
        postOutlierScan,
        postCaptureZoneBaseline,
        postCaptureDensityBaseline,
        postPoisoningScan,
        postSprawlScan,
        postPreDeploy,
        getScanHistory,
    },
};
```
---

### `src/bees/security-bee.js`

```javascript
/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Security Bee — Active security operations + module wiring:
 *   - Patent Lock enforcement & evidence snapshots
 *   - Credential exposure scanning
 *   - .gitignore audit & hardening
 *   - Module health checks for all security systems
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const domain = 'security';
const description = 'Patent lock, credential scan, gitignore audit, auth, governance, PQC, RBAC, secret rotation';
const priority = 1.0; // Highest — security is non-negotiable

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function getWork(ctx = {}) {
    return [
        // ═══ ACTIVE SECURITY OPS (run every swarm cycle) ═══

        // 1. Patent Evidence Snapshot — generate SHA-384 hash of all patent-critical files
        async () => {
            try {
                const { generateEvidenceSnapshot } = require('../security/code-governance');
                const snapshot = generateEvidenceSnapshot();
                return { bee: domain, action: 'patent-evidence-snapshot', ok: snapshot.ok, files: snapshot.file_count, composite: snapshot.composite_hash?.substring(0, 16) + '...' };
            } catch (e) { return { bee: domain, action: 'patent-evidence-snapshot', ok: false, error: e.message }; }
        },

        // 2. Patent Lock Audit — verify no patent-locked files have been modified without owner approval
        async () => {
            try {
                const { isPatentLocked, loadConfig } = require('../security/code-governance');
                const config = loadConfig();
                const patentLock = config.patent_lock || {};
                const allClaims = [...(patentLock.rtp_verified || []), ...(patentLock.new_inventive_steps || [])];
                const violations = [];
                for (const claim of allClaims) {
                    for (const f of claim.files || []) {
                        const check = isPatentLocked(f);
                        if (check.locked) {
                            const fullPath = path.join(PROJECT_ROOT, f);
                            const exists = fs.existsSync(fullPath);
                            if (!exists) violations.push({ file: f, claim: claim.id, issue: 'MISSING' });
                        }
                    }
                }
                return { bee: domain, action: 'patent-lock-audit', ok: violations.length === 0, claims: allClaims.length, violations };
            } catch (e) { return { bee: domain, action: 'patent-lock-audit', ok: false, error: e.message }; }
        },

        // 3. Credential Exposure Scan — check for tracked sensitive files
        async () => {
            try {
                const { execSync } = require('child_process');
                const tracked = execSync('git ls-files "*.env*" "*.key" "*.pem" "secret*" "*.credentials" 2>/dev/null', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
                const files = tracked.split('\n').filter(f => f && !f.includes('.example') && !f.includes('.env.example'));
                return { bee: domain, action: 'credential-scan', ok: files.length === 0, exposed: files };
            } catch (e) { return { bee: domain, action: 'credential-scan', ok: true, exposed: [] }; } // git ls-files returns non-zero if nothing found
        },

        // 4. .gitignore Health Check — verify critical patterns exist
        async () => {
            try {
                const gitignore = fs.readFileSync(path.join(PROJECT_ROOT, '.gitignore'), 'utf8');
                const requiredPatterns = ['.env', '*.pid', '*.jsonl', '*.key', '*.pem', 'node_modules/', '*.bak'];
                const missing = requiredPatterns.filter(p => !gitignore.includes(p));
                return { bee: domain, action: 'gitignore-audit', ok: missing.length === 0, missing, totalLines: gitignore.split('\n').length };
            } catch (e) { return { bee: domain, action: 'gitignore-audit', ok: false, error: e.message }; }
        },

        // ═══ MODULE HEALTH CHECKS (verify all security systems load) ═══
        async () => { try { require('../hc_auth'); return { bee: domain, action: 'auth', loaded: true }; } catch { return { bee: domain, action: 'auth', loaded: false }; } },
        async () => { try { require('../security/code-governance'); return { bee: domain, action: 'code-governance', loaded: true }; } catch { return { bee: domain, action: 'code-governance', loaded: false }; } },
        async () => { try { require('../security/env-validator'); return { bee: domain, action: 'env-validator', loaded: true }; } catch { return { bee: domain, action: 'env-validator', loaded: false }; } },
        async () => { try { require('../security/handshake'); return { bee: domain, action: 'handshake', loaded: true }; } catch { return { bee: domain, action: 'handshake', loaded: false }; } },
        async () => { try { require('../security/ip-classification'); return { bee: domain, action: 'ip-classification', loaded: true }; } catch { return { bee: domain, action: 'ip-classification', loaded: false }; } },
        async () => { try { require('../security/pqc'); return { bee: domain, action: 'pqc', loaded: true }; } catch { return { bee: domain, action: 'pqc', loaded: false }; } },
        async () => { try { require('../security/rate-limiter'); return { bee: domain, action: 'rate-limiter', loaded: true }; } catch { return { bee: domain, action: 'rate-limiter', loaded: false }; } },
        async () => { try { require('../security/rbac-vendor'); return { bee: domain, action: 'rbac-vendor', loaded: true }; } catch { return { bee: domain, action: 'rbac-vendor', loaded: false }; } },
        async () => { try { require('../security/secret-rotation'); return { bee: domain, action: 'secret-rotation', loaded: true }; } catch { return { bee: domain, action: 'secret-rotation', loaded: false }; } },
        async () => { try { require('../security/web3-ledger-anchor'); return { bee: domain, action: 'web3-ledger', loaded: true }; } catch { return { bee: domain, action: 'web3-ledger', loaded: false }; } },
    ];
}

module.exports = { domain, description, priority, getWork };
```
---

### `src/mcp/security-index.js`

```javascript
/**
 * Heady MCP Security — Unified Entry Point
 * ==========================================
 * Import all security modules from a single entry.
 *
 * Usage:
 *   const { MCPGateway, RBACManager, AuditLogger } = require('@heady/mcp-security');
 *
 * @module @heady/mcp-security
 * @version 1.0.0
 */

'use strict';

// ── Foundation ──────────────────────────────────────────────────────────────
const phiMath = require('../shared/phi-math');

// ── Gateway ─────────────────────────────────────────────────────────────────
const { MCPGateway, CSLToolRouter, SecurityError } = require('./gateway/mcp-gateway');
const { ConnectionPoolManager, TransportAdapter } = require('./gateway/connection-pool');

// ── Security Modules ────────────────────────────────────────────────────────
const { ZeroTrustSandbox, ResourceTracker, SandboxViolation, CAPABILITIES, TOOL_PROFILES, DEFAULT_RESOURCE_LIMITS } = require('./security/zero-trust-sandbox');
const { SemanticRateLimiter, TokenBucket, SlidingWindowCounter, SemanticDedupCache, PriorityQueue } = require('./security/rate-limiter');
const { AuditLogger, SOC2_CRITERIA } = require('./security/audit-logger');
const { OutputScanner, PATTERNS: SCAN_PATTERNS } = require('./security/output-scanner');
const { RBACManager, ROLES, TOOL_OVERRIDES, JWT_ADAPTERS } = require('./security/rbac-manager');
const { InputValidator, THREAT_PATTERNS, BLOCKED_CIDRS } = require('./security/input-validator');
const { SecretRotationManager, InMemorySecretBackend, GCPSecretBackend, SECRET_TYPES, ROTATION_INTERVALS } = require('./security/secret-rotation');

module.exports = {
  // Foundation
  ...phiMath,

  // Gateway
  MCPGateway,
  CSLToolRouter,
  SecurityError,
  ConnectionPoolManager,
  TransportAdapter,

  // Security Modules
  ZeroTrustSandbox,
  ResourceTracker,
  SandboxViolation,
  CAPABILITIES,
  TOOL_PROFILES,
  DEFAULT_RESOURCE_LIMITS,

  SemanticRateLimiter,
  TokenBucket,
  SlidingWindowCounter,
  SemanticDedupCache,
  PriorityQueue,

  AuditLogger,
  SOC2_CRITERIA,

  OutputScanner,
  SCAN_PATTERNS,

  RBACManager,
  ROLES,
  TOOL_OVERRIDES,
  JWT_ADAPTERS,

  InputValidator,
  THREAT_PATTERNS,
  BLOCKED_CIDRS,

  SecretRotationManager,
  InMemorySecretBackend,
  GCPSecretBackend,
  SECRET_TYPES,
  ROTATION_INTERVALS,
};
```
---

### `src/security/web3-ledger-anchor.js`

```javascript
/**
 * © 2026 HeadySystems Inc..
 * ─── Web3 Ledger Anchor (Proof-of-Inference) ─────────────────────────
 * 
 * HeadyScientist Swarm Node: 
 * This module ingests simulated SHA-256 hashes generated by Heady agents
 * and anchors them to an immutable EVM-compatible ledger (Base/Arbitrum).
 * Provide undisputed proof that an agent's reasoning was unaltered.
 * ─────────────────────────────────────────────────────────────────
 */

const { ethers } = require("ethers");
const logger = require("../utils/logger");
require('../core/heady-env').config();

// Defaulting to Base Goerli/Sepolia or Arbitrum for low-cost anchoring
const RPC_URL = process.env.WEB3_RPC_URL || "https://sepolia.base.org";
const PRIVATE_KEY = process.env.WEB3_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001"; // Placeholder
const CONTRACT_ADDRESS = process.env.HEADY_ANCHOR_CONTRACT || "0xYourAnchorContractAddressHere";

// Minimal ABI for a basic immutable data registry
const ANCHOR_ABI = [
    "function anchorHash(string memory agentHash, string memory metadata) public returns (uint256)",
    "event HashAnchored(address indexed sender, string agentHash, uint256 timestamp)"
];

/**
 * Anchor a Proof-of-Inference hash to the blockchain.
 * @param {string} sha256Hash The locally simulated hash from the agent output.
 * @param {object} metadata Additional JSON metadata (e.g. agentId, action_type).
 * @returns {Promise<string>} The transaction hash on the blockchain.
 */
async function anchorToLedger(sha256Hash, metadata = {}) {
    try {
        if (!process.env.WEB3_PRIVATE_KEY) {
            logger.warn("⚠️ [HeadyScientist] WEB3_PRIVATE_KEY missing. Simulating anchor execution.");
            return `0xsimulated_tx_hash_${Date.now()}`;
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ANCHOR_ABI, wallet);

        const metadataString = JSON.stringify(metadata);

        logger.logSystem(`📡 [HeadyScientist] Anchoring hash ${sha256Hash} to ledger...`);
        const tx = await contract.anchorHash(sha256Hash, metadataString);

        logger.logSystem(`🔗 [HeadyScientist] Transaction submitted: ${tx.hash}`);
        await tx.wait(1); // Wait for 1 block confirmation

        logger.logSystem(`✅ [HeadyScientist] Proof-of-Inference anchored successfully.`);
        return tx.hash;
    } catch (error) {
        logger.error(`❌ [HeadyScientist] Ledger Anchor Failed: ${error.message}`);
        throw error;
    }
}

module.exports = { anchorToLedger };
```
---

### `src/core/csl-engine/csl-engine.js`

```javascript
/**
 * @fileoverview CSL Engine — Continuous Semantic Logic
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Core innovation: vector geometry as logical gates operating in 384-dimensional
 * (or 1536-dimensional) embedding space. All logic is geometric: alignment,
 * superposition, orthogonal projection, and cosine activation.
 *
 * Mathematical Foundation:
 *   - Domain: unit vectors in ℝᴰ, D ∈ {384, 1536}
 *   - Truth value: τ(a, b) = cos(θ) = (a·b) / (‖a‖·‖b‖) ∈ [-1, +1]
 *   - +1 = fully aligned (TRUE), 0 = orthogonal (UNKNOWN), -1 = antipodal (FALSE)
 *
 * References:
 *   - Birkhoff & von Neumann (1936): "The Logic of Quantum Mechanics"
 *   - Widdows (2003): "Orthogonal Negation in Vector Spaces" — ACL 2003
 *   - Grand et al. (2022): "Semantic projection" — Nature Human Behaviour
 *   - Fagin, Riegel, Gray (2024): "Foundations of reasoning with uncertainty" — PNAS
 *
 * @module csl-engine
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL techniques
 */

import { PHI, PSI, PHI_TEMPERATURE, CSL_THRESHOLDS, phiThreshold, EPSILON as PHI_EPSILON, adaptiveTemperature } from '../../shared/phi-math.js';

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default vector dimension for standard embedding models (e.g., all-MiniLM-L6-v2) */
const DEFAULT_DIM = 384;

/** Extended dimension for high-fidelity models (e.g., text-embedding-3-large) */
const LARGE_DIM = 1536;

/** Numerical epsilon: prevents division-by-zero and detects near-zero vectors.
 * Sourced from shared/phi-math.js PHI_EPSILON (same 1e-10 value, unified constant). */
const EPSILON = PHI_EPSILON; // from shared/phi-math.js

/** Threshold below which a vector is considered near-zero (degenerate) */
const ZERO_NORM_THRESHOLD = 1e-8;

/** Default gate threshold τ for GATE operation.
 * CSL_THRESHOLDS.MINIMUM ≈ 0.500 — noise floor for geometric truth activation. */
const DEFAULT_GATE_THRESHOLD = CSL_THRESHOLDS.MINIMUM; // ≈ 0.500 (CSL noise floor)

/** Default temperature τ for soft gating / softmax operations.
 * PHI_TEMPERATURE = PSI^3 ≈ 0.236 — phi-harmonic softness. */
const DEFAULT_TEMPERATURE = PHI_TEMPERATURE; // PSI^3 ≈ 0.236

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Compute the L2 norm (Euclidean length) of a vector.
 *
 * Formula: ‖a‖ = √(Σᵢ aᵢ²)
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {number} L2 norm ≥ 0
 */
function norm(a) {
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length (project onto unit hypersphere Sᴰ⁻¹).
 *
 * Formula: â = a / ‖a‖
 *
 * Returns the zero vector if ‖a‖ < ZERO_NORM_THRESHOLD (degenerate case).
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {Float64Array} Unit vector, or zero vector if degenerate
 */
function normalize(a) {
  const n = norm(a);
  const result = new Float64Array(a.length);
  if (n < ZERO_NORM_THRESHOLD) {
    return result; // zero vector — caller should handle
  }
  const invN = 1.0 / n;
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * invN;
  }
  return result;
}

/**
 * Compute the dot product of two equal-length vectors.
 *
 * Formula: a·b = Σᵢ aᵢ·bᵢ
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {number} Scalar dot product
 * @throws {Error} If vectors have different lengths
 */
function dot(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Clamp a value to the interval [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Add two vectors element-wise and return a new Float64Array.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorAdd(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] + b[i];
  }
  return result;
}

/**
 * Subtract vector b from a element-wise.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorSub(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] - b[i];
  }
  return result;
}

/**
 * Scale a vector by a scalar.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {number} scalar
 * @returns {Float64Array}
 */
function vectorScale(a, scalar) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * scalar;
  }
  return result;
}

// ─── CSLEngine Class ──────────────────────────────────────────────────────────

/**
 * CSLEngine — Continuous Semantic Logic Engine
 *
 * Implements all CSL logical gates as pure geometric operations on high-dimensional
 * vectors. All operations work on raw (unnormalized) input vectors and handle
 * normalization internally unless otherwise noted.
 *
 * All gate methods:
 *   1. Accept Float32Array, Float64Array, or number[] inputs
 *   2. Return Float64Array for gate outputs (or number for scalar outputs)
 *   3. Include full numerical stability handling
 *   4. Support batch operation via the batch* prefix methods
 *
 * @class
 * @example
 * const engine = new CSLEngine({ dim: 384 });
 * const score = engine.AND(vectorA, vectorB);     // cosine similarity ∈ [-1,1]
 * const union = engine.OR(vectorA, vectorB);       // normalized superposition
 * const negated = engine.NOT(vectorA, vectorB);    // semantic negation
 */
class CSLEngine {
  /** Golden ratio constant — accessible on class for downstream phi-arithmetic */
  static PHI = PHI;
  /** Golden ratio conjugate (1/Φ = Φ-1) — accessible on class */
  static PSI = PSI;

  /**
   * @param {Object} [options]
   * @param {number} [options.dim=384] - Vector dimension
   * @param {number} [options.epsilon=1e-10] - Numerical stability epsilon
   * @param {number} [options.gateThreshold=0.0] - Default threshold τ for GATE
   * @param {number} [options.temperature=1.0] - Default temperature for soft gates
   * @param {boolean} [options.normalizeInputs=true] - Auto-normalize inputs
   */
  constructor(options = {}) {
    this.dim = options.dim || DEFAULT_DIM;
    this.epsilon = options.epsilon || EPSILON;
    this.gateThreshold = options.gateThreshold !== undefined
      ? options.gateThreshold
      : DEFAULT_GATE_THRESHOLD;
    this.temperature = options.temperature || DEFAULT_TEMPERATURE;
    this.normalizeInputs = options.normalizeInputs !== false;

    // Runtime statistics for monitoring
    this._stats = {
      operationCount: 0,
      degenerateVectors: 0,
      gateActivations: 0,
    };
  }

  // ─── Core Gate Operations ──────────────────────────────────────────────────

  /**
   * CSL AND — Measures semantic alignment between two concept vectors.
   *
   * Mathematical formula:
   *   AND(a, b) = cos(θ_{a,b}) = (a·b) / (‖a‖·‖b‖)
   *
   * Interpretation:
   *   - Result ∈ [-1, +1]
   *   - +1: concepts are fully aligned ("both true in the same direction")
   *   - 0:  concepts are orthogonal ("independent / no relationship")
   *   - -1: concepts are antipodal ("contradictory / one negates the other")
   *
   * Logical analogy: "a AND b is true" ↔ cos(a, b) close to +1.
   * This is the soft AND: high only when both concepts are co-aligned.
   *
   * Properties:
   *   - Commutative: AND(a,b) = AND(b,a)
   *   - Bounded: result ∈ [-1, +1]
   *   - Scale invariant: AND(λa, b) = AND(a, b) for λ > 0
   *
   * Reference: Birkhoff & von Neumann (1936), quantum logic inner product.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {number} Cosine similarity ∈ [-1, +1]
   */
  AND(a, b) {
    this._stats.operationCount++;
    const normA = norm(a);
    const normB = norm(b);

    if (normA < this.epsilon || normB < this.epsilon) {
      this._stats.degenerateVectors++;
      return 0.0; // degenerate: zero vectors are orthogonal to everything
    }

    const dotProduct = dot(a, b);
    return clamp(dotProduct / (normA * normB), -1.0, 1.0);
  }

  /**
   * CSL OR — Computes semantic superposition (soft union) of two concepts.
   *
   * Mathematical formula:
   *   OR(a, b) = normalize(a + b)
   *
   * The sum a + b creates a vector similar to both a and b — capturing the
   * "union" of semantic content. Normalization returns the result to the unit
   * sphere for subsequent operations.
   *
   * Interpretation:
   *   - The result vector points "between" a and b on the hypersphere
   *   - Its cosine similarity to both a and b is positive
   *   - For orthogonal a, b: result is at 45° to both (equal similarity)
   *   - For identical a = b: result is identical to a (idempotent in direction)
   *
   * Logical analogy: "a OR b" is the direction that captures either concept.
   *
   * Properties:
   *   - Commutative: OR(a,b) = OR(b,a)
   *   - Returns unit vector on Sᴰ⁻¹
   *   - Degenerate when a ≈ -b (antiparallel): returns zero vector
   *
   * Reference: HDC bundling operation; Boolean IR vector addition.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized superposition vector (unit length)
   */
  OR(a, b) {
    this._stats.operationCount++;
    const sum = vectorAdd(a, b);
    const n = norm(sum);

    if (n < this.epsilon) {
      this._stats.degenerateVectors++;
      // a ≈ -b: concepts cancel. Return zero vector to signal cancellation.
      return new Float64Array(a.length);
    }

    return vectorScale(sum, 1.0 / n);
  }

  /**
   * CSL NOT — Semantic negation via orthogonal projection.
   *
   * Mathematical formula:
   *   NOT(a, b) = a - proj_b(a) = a - (a·b / ‖b‖²) · b
   *
   * For unit vectors ‖b‖ = 1:
   *   NOT(a, b) = a - (a·b) · b
   *
   * The result is the component of a that is orthogonal to b — removing
   * the semantic content of b from a.
   *
   * Interpretation:
   *   - "NOT(a, b)" means "a, but not the part that overlaps with b"
   *   - Example: NOT(cat_vector, persian_vector) → cat vector minus Persian traits
   *   - The result has zero cosine similarity with b (by construction)
   *   - Residual magnitude: ‖NOT(a,b)‖ = ‖a‖·sin(θ_{a,b})
   *
   * Idempotency:
   *   NOT(NOT(a,b), b) ≈ NOT(a,b) because the result is already in b⊥.
   *   More precisely: the projection of NOT(a,b) onto b is ≈ 0, so subtracting
   *   proj_b again leaves it unchanged. (Full proof in csl-mathematical-proofs.md)
   *
   * Similarity after negation (for normalized a, b):
   *   a · NOT(a, b) = 1 - (a·b)²
   *
   * Reference: Widdows (2003), ACL 2003, "Orthogonal Negation in Vector Spaces"
   *
   * @param {Float32Array|Float64Array|number[]} a - Query/source vector
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate/remove
   * @param {boolean} [returnNormalized=true] - Whether to normalize the result
   * @returns {Float64Array} Vector with b's semantic content removed
   */
  NOT(a, b, returnNormalized = true) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      // b is near-zero: nothing to project out, return a (optionally normalized)
      return returnNormalized ? normalize(a) : new Float64Array(a);
    }

    // Projection coefficient: (a·b) / ‖b‖²
    const projCoeff = dot(a, b) / normBSq;

    // Remove projection: a - projCoeff·b
    const result = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] - projCoeff * b[i];
    }

    if (returnNormalized) {
      return normalize(result);
    }
    return result;
  }

  /**
   * CSL IMPLY — Geometric material implication via projection.
   *
   * Mathematical formula:
   *   IMPLY(a, b) = proj_b(a) = (a·b / ‖b‖²) · b
   *
   * For unit vectors:
   *   IMPLY(a, b) = (a·b) · b    [scalar times unit vector]
   *
   * The projection of a onto b captures "how much of a is contained in b" —
   * the geometric analog of material implication: degree to which a implies b.
   *
   * Interpretation:
   *   - Large projection → a strongly implies b (concepts highly co-directional)
   *   - Zero projection → a and b are independent (no implication)
   *   - Negative projection → a implies NOT b (antiparallel)
   *
   * Scalar implication strength: IMPLY_scalar(a,b) = a·b / ‖b‖ = cos(θ)·‖a‖
   *
   * Reference: Grand et al. (2022) semantic projection; Birkhoff-von Neumann.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent vector (hypothesis)
   * @param {Float32Array|Float64Array|number[]} b - Consequent vector (conclusion)
   * @returns {Float64Array} Projection of a onto span(b)
   */
  IMPLY(a, b) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      return new Float64Array(a.length); // zero consequent: no implication
    }

    const projCoeff = dot(a, b) / normBSq;
    return vectorScale(b, projCoeff);
  }

  /**
   * Scalar implication strength — returns the signed magnitude of implication.
   *
   * Formula: IMPLY_strength(a, b) = (a·b) / (‖a‖·‖b‖) = cos(θ_{a,b})
   *
   * Equivalent to AND(a, b) — the cosine similarity *is* the implication strength.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Implication strength ∈ [-1, +1]
   */
  IMPLY_scalar(a, b) {
    return this.AND(a, b);
  }

  /**
   * CSL XOR — Exclusive semantic content (symmetric difference).
   *
   * Mathematical formula:
   *   XOR(a, b) = normalize(a + b) - proj_mutual(a, b)
   *
   * More precisely, for unit vectors:
   *   XOR(a, b) = normalize( (a - proj_b(a)) + (b - proj_a(b)) )
   *             = normalize( a_⊥b + b_⊥a )
   *
   * Where a_⊥b is the component of a orthogonal to b (exclusive to a),
   * and b_⊥a is the component of b orthogonal to a (exclusive to b).
   *
   * Interpretation:
   *   - XOR captures what is unique to each concept (symmetric difference)
   *   - When a ≈ b: both exclusive components → 0, XOR → zero vector
   *   - When a ⊥ b: exclusive components = full vectors, XOR ≈ normalize(a + b)
   *   - "a XOR b" = concepts that appear in one but not both
   *
   * Properties:
   *   - Commutative: XOR(a,b) = XOR(b,a)
   *   - Anti-idempotent: XOR(a,a) → zero vector
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized exclusive semantic content
   */
  XOR(a, b) {
    this._stats.operationCount++;

    // a_⊥b: component of a orthogonal to b (NOT(a, b) unnormalized)
    const normBSq = dot(b, b);
    const normASq = dot(a, a);

    if (normASq < this.epsilon || normBSq < this.epsilon) {
      this._stats.degenerateVectors++;
      return new Float64Array(a.length);
    }

    const projAonB = dot(a, b) / normBSq;
    const projBonA = dot(a, b) / normASq; // Note: dot(b,a) = dot(a,b)

    // a_⊥b = a - proj_b(a)
    // b_⊥a = b - proj_a(b)
    const exclusive = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      const a_excl = a[i] - projAonB * b[i];
      const b_excl = b[i] - projBonA * a[i];
      exclusive[i] = a_excl + b_excl;
    }

    const n = norm(exclusive);
    if (n < this.epsilon) {
      return new Float64Array(a.length); // a ≈ b: no exclusive content
    }

    return vectorScale(exclusive, 1.0 / n);
  }

  /**
   * CSL CONSENSUS — Weighted mean of agent/concept vectors (agreement).
   *
   * Mathematical formula:
   *   CONSENSUS({aᵢ}, {wᵢ}) = normalize( Σᵢ wᵢ · aᵢ )
   *
   * Uniform weights (default):
   *   CONSENSUS({aᵢ}) = normalize( (1/n) Σᵢ aᵢ )
   *
   * Interpretation:
   *   - Result is the centroid direction on the unit hypersphere
   *   - ‖Σ wᵢaᵢ‖ before normalization measures consensus strength:
   *     → ≈ 1: strong agreement (vectors nearly aligned)
   *     → ≈ 0: strong disagreement (vectors cancel out)
   *   - Consensus Quality metric: R = ‖(1/n)Σaᵢ‖ ∈ [0,1]
   *
   * Properties:
   *   - Commutative: order of vectors doesn't matter
   *   - Weights must be non-negative (negative weights invert contribution)
   *   - Returns zero vector when agents completely disagree
   *
   * Reference: HDC bundling operation; Roundtable Policy (arXiv 2509.16839)
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors - Agent opinion vectors
   * @param {number[]} [weights] - Optional weights (uniform if omitted)
   * @returns {{ consensus: Float64Array, strength: number }}
   *   consensus: normalized consensus vector
   *   strength: R ∈ [0,1] measuring agreement level
   */
  CONSENSUS(vectors, weights = null) {
    this._stats.operationCount++;

    if (!vectors || vectors.length === 0) {
      throw new Error('CONSENSUS requires at least one vector');
    }

    const dim = vectors[0].length;
    const n = vectors.length;

    // Validate weights
    let w = weights;
    if (!w) {
      w = new Array(n).fill(1.0 / n);
    } else {
      if (w.length !== n) {
        throw new Error(`Weights length ${w.length} != vectors length ${n}`);
      }
      // Normalize weights to sum to 1
      const wSum = w.reduce((s, x) => s + x, 0);
      if (wSum < this.epsilon) {
        throw new Error('Weights must have positive sum');
      }
      w = w.map(x => x / wSum);
    }

    // Weighted sum
    const sum = new Float64Array(dim);
    for (let j = 0; j < n; j++) {
      const vec = vectors[j];
      const wj = w[j];
      for (let i = 0; i < dim; i++) {
        sum[i] += wj * vec[i];
      }
    }

    // Measure consensus strength before normalizing
    const strength = norm(sum);

    if (strength < this.epsilon) {
      this._stats.degenerateVectors++;
      return {
        consensus: new Float64Array(dim),
        strength: 0.0,
      };
    }

    const consensus = vectorScale(sum, 1.0 / strength);
    return { consensus, strength: clamp(strength, 0, 1) };
  }

  /**
   * CSL GATE — Threshold activation function using cosine similarity.
   *
   * Mathematical formula:
   *   GATE(input, gate_vector, τ) = θ( cos(input, gate_vector) - τ )
   *
   * Where θ is the Heaviside step function (hard gate) or sigmoid (soft gate):
   *   Hard:  GATE = 1  if cos(input, gate_vector) ≥ τ, else 0
   *   Soft:  GATE = σ( (cos(input, gate_vector) - τ) / temperature )
   *
   * The gate_vector defines a semantic "topic direction" in embedding space.
   * Inputs aligned with this direction (above threshold τ) pass the gate.
   *
   * Properties:
   *   - Bounded output: hard ∈ {0,1}, soft ∈ (0,1)
   *   - Scale invariant: GATE(λ·input, gate_vector, τ) = GATE(input, gate_vector, τ)
   *   - Differentiable (soft gate only)
   *   - Valid activation function: monotone, bounded, Lipschitz-continuous (soft)
   *
   * Proof that soft GATE is a valid activation function:
   *   (See csl-mathematical-proofs.md §4: CSL GATE Activation Properties)
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector to gate
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [threshold=0.0] - Threshold τ ∈ [-1, +1]
   * @param {'hard'|'soft'} [mode='hard'] - Hard (step) or soft (sigmoid) gate
   * @param {number} [temperature=1.0] - Temperature for soft gate sharpness
   * @returns {{ activation: number, cosScore: number }}
   *   activation: gate output ∈ {0,1} (hard) or (0,1) (soft)
   *   cosScore: raw cosine similarity before thresholding
   */
  GATE(input, gateVector, threshold = null, mode = 'hard', temperature = null) {
    this._stats.operationCount++;

    const tau = threshold !== null ? threshold : this.gateThreshold;
    const temp = temperature !== null ? temperature : this.temperature;

    const cosScore = this.AND(input, gateVector);
    const shifted = cosScore - tau;

    let activation;
    if (mode === 'hard') {
      activation = shifted >= 0 ? 1 : 0;
    } else {
      // Soft (sigmoid) gate: σ(x) = 1 / (1 + e^{-x/temp})
      activation = 1.0 / (1.0 + Math.exp(-shifted / temp));
    }

    if (activation > 0) this._stats.gateActivations++;

    return { activation, cosScore };
  }

  /**
   * CSL NAND — NOT AND: semantic incompatibility gate.
   *
   * Formula: NAND(a, b) = 1 - max(0, AND(a, b))
   *          Maps high alignment → low output; low alignment → high output.
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {number} NAND score ∈ [0, 1]
   */
  NAND(a, b) {
    const andScore = this.AND(a, b);
    return 1.0 - Math.max(0, andScore);
  }

  /**
   * CSL NOR — NOT OR: semantic exclusion gate.
   *
   * Returns normalized vector pointing away from the OR superposition.
   * Semantically: the concept that is distinct from both a and b.
   *
   * Formula: NOR(a,b) = normalize( -(a + b) )
   *                   = negate( OR(a, b) )
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {Float64Array} Antipodal to OR(a,b)
   */
  NOR(a, b) {
    this._stats.operationCount++;
    const orVec = this.OR(a, b);
    return vectorScale(orVec, -1.0);
  }

  // ─── Projection Utilities ──────────────────────────────────────────────────

  /**
   * Project vector a onto the subspace spanned by a set of basis vectors.
   *
   * Uses Gram-Schmidt orthogonalization for numerical stability.
   *
   * Formula: proj_B(a) = Σᵢ (a·eᵢ) eᵢ
   * where {eᵢ} is an orthonormal basis for span(B), computed via Gram-Schmidt.
   *
   * @param {Float32Array|Float64Array|number[]} a - Vector to project
   * @param {Array<Float32Array|Float64Array|number[]>} basisVectors - Spanning set
   * @returns {Float64Array} Projection of a onto span(basisVectors)
   */
  projectOntoSubspace(a, basisVectors) {
    if (!basisVectors || basisVectors.length === 0) {
      return new Float64Array(a.length);
    }

    const dim = a.length;
    // Gram-Schmidt orthogonalization of basisVectors
    const orthoBasis = [];

    for (let j = 0; j < basisVectors.length; j++) {
      let vec = new Float64Array(basisVectors[j]);

      // Remove components along existing orthobasis
      for (const e of orthoBasis) {
        const coeff = dot(vec, e);
        for (let i = 0; i < dim; i++) {
          vec[i] -= coeff * e[i];
        }
      }

      const n = norm(vec);
      if (n > this.epsilon) {
        const unitVec = vectorScale(vec, 1.0 / n);
        orthoBasis.push(unitVec);
      }
    }

    // Project a onto orthobasis
    const projection = new Float64Array(dim);
    for (const e of orthoBasis) {
      const coeff = dot(a, e);
      for (let i = 0; i < dim; i++) {
        projection[i] += coeff * e[i];
      }
    }

    return projection;
  }

  /**
   * NOT against a subspace (multiple semantic concepts removed simultaneously).
   *
   * Formula: NOT(a, B) = a - proj_B(a)
   *
   * Removes all semantic content in span{b₁,...,bₙ} from a.
   *
   * @param {Float32Array|Float64Array|number[]} a - Source vector
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Concepts to remove
   * @param {boolean} [returnNormalized=true]
   * @returns {Float64Array}
   */
  NOT_subspace(a, bVectors, returnNormalized = true) {
    this._stats.operationCount++;
    const projection = this.projectOntoSubspace(a, bVectors);
    const result = vectorSub(a, projection);
    return returnNormalized ? normalize(result) : result;
  }

  // ─── Batch Operations ──────────────────────────────────────────────────────

  /**
   * Batch AND — Compute cosine similarity of one vector against many.
   *
   * GPU-friendly: equivalent to a matrix-vector multiplication.
   * M[j] = a · B[j] / (‖a‖ · ‖B[j]‖) for each row B[j] in the matrix.
   *
   * @param {Float32Array|Float64Array|number[]} a - Query vector (1 × dim)
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Corpus vectors (n × dim)
   * @returns {Float64Array} Similarity scores (n,) ∈ [-1,+1]
   */
  batchAND(a, bVectors) {
    const normA = norm(a);
    if (normA < this.epsilon) {
      return new Float64Array(bVectors.length);
    }

    const result = new Float64Array(bVectors.length);
    for (let j = 0; j < bVectors.length; j++) {
      const normB = norm(bVectors[j]);
      if (normB < this.epsilon) {
        result[j] = 0.0;
        continue;
      }
      result[j] = clamp(dot(a, bVectors[j]) / (normA * normB), -1.0, 1.0);
    }
    return result;
  }

  /**
   * Batch NOT — Remove concept b from an array of source vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors - Source vectors
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate
   * @param {boolean} [returnNormalized=true]
   * @returns {Array<Float64Array>} Array of negated vectors
   */
  batchNOT(aVectors, b, returnNormalized = true) {
    return aVectors.map(a => this.NOT(a, b, returnNormalized));
  }

  /**
   * Batch GATE — Apply semantic gate to an array of input vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} inputs - Input vectors
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction
   * @param {number} [threshold=0.0] - Threshold τ
   * @param {'hard'|'soft'} [mode='hard']
   * @returns {Array<{ activation: number, cosScore: number }>}
   */
  batchGATE(inputs, gateVector, threshold = null, mode = 'hard') {
    return inputs.map(inp => this.GATE(inp, gateVector, threshold, mode));
  }

  /**
   * Batch IMPLY — Compute projection of each input onto the consequent.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {Array<Float64Array>} Projections
   */
  batchIMPLY(aVectors, b) {
    return aVectors.map(a => this.IMPLY(a, b));
  }

  // ─── Advanced Logical Compositions ────────────────────────────────────────

  /**
   * CSL CONDITIONAL — Soft conditional probability: P(b|a) via geometric Bayes.
   *
   * Formula: P(b|a) ≈ AND(a,b) / AND(a,a) = cos(a,b) / 1 = cos(a,b)
   *          [for normalized vectors, this reduces to AND]
   *
   * For asymmetric conditional, use the projection magnitude:
   *   P(b|a) ≈ ‖proj_b(a)‖ / ‖a‖ = |cos(a,b)|
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Conditional alignment ∈ [0, 1]
   */
  CONDITIONAL(a, b) {
    return Math.abs(this.AND(a, b));
  }

  /**
   * CSL ANALOGY — Completes an analogy: "a is to b as c is to ?"
   *
   * Formula: d = normalize( b - a + c )
   *   [vector arithmetic analogy, as in word2vec: king - man + woman ≈ queen]
   *
   * @param {Float32Array|Float64Array|number[]} a - Source concept
   * @param {Float32Array|Float64Array|number[]} b - Target concept
   * @param {Float32Array|Float64Array|number[]} c - Query concept
   * @returns {Float64Array} Analogy completion vector
   */
  ANALOGY(a, b, c) {
    this._stats.operationCount++;
    // d = normalize(b - a + c)
    const diff = vectorSub(b, a);
    const result = vectorAdd(diff, c);
    return normalize(result);
  }

  /**
   * Compute pairwise AND (cosine similarity matrix) for a set of vectors.
   *
   * Returns a symmetric matrix M where M[i][j] = cos(vectors[i], vectors[j]).
   * GPU-friendly: equivalent to normalized matrix multiplication V @ Vᵀ.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors
   * @returns {Float64Array[]} n×n cosine similarity matrix (row-major)
   */
  pairwiseAND(vectors) {
    const n = vectors.length;
    const norms = vectors.map(v => norm(v));

    // Pre-allocate n×n matrix as array of Float64Arrays
    const matrix = Array.from({ length: n }, () => new Float64Array(n));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0; // self-similarity
      for (let j = i + 1; j < n; j++) {
        const d = dot(vectors[i], vectors[j]);
        const normIJ = norms[i] * norms[j];
        const sim = normIJ < this.epsilon ? 0.0 : clamp(d / normIJ, -1.0, 1.0);
        matrix[i][j] = sim;
        matrix[j][i] = sim; // symmetric
      }
    }

    return matrix;
  }

  // ─── Statistics and Introspection ─────────────────────────────────────────

  /**
   * Retrieve runtime operation statistics.
   *
   * @returns {{ operationCount: number, degenerateVectors: number, gateActivations: number }}
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Reset runtime statistics.
   */
  resetStats() {
    this._stats = { operationCount: 0, degenerateVectors: 0, gateActivations: 0 };
  }

  // ─── Phi-Harmonic Gate Extensions ───────────────────────────────────────────────

  /**
   * Phi-harmonic GATE — uses phiThreshold(level) from phi-math.js as threshold.
   *
   * phiThreshold(level) = 1 - PSI^level * 0.5:
   *   level=1 ≈ 0.691 (CSL LOW)
   *   level=2 ≈ 0.809 (CSL MEDIUM)
   *   level=3 ≈ 0.882 (CSL HIGH)
   *
   * Provides a geometrically scaled activation threshold aligned with
   * the sacred geometry resource allocation tiers.
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [level=2] - Phi threshold level (1–4)
   * @param {'hard'|'soft'} [mode='hard'] - Gate mode
   * @returns {{ activation: number, cosScore: number, threshold: number }}
   */
  phiGATE(input, gateVector, level = 2, mode = 'hard') {
    const threshold = phiThreshold(level); // e.g. level=2 ≈ 0.809 (MEDIUM)
    const result = this.GATE(input, gateVector, threshold, mode);
    return { ...result, threshold };
  }

  /**
   * Adaptive GATE — uses adaptiveTemperature(entropy, maxEntropy) for dynamic softness.
   *
   * Temperature = PSI^(1 + 2*(1 - H/Hmax)) from phi-math.js.
   * At max entropy (uniform distribution): temperature ≈ PSI (softest).
   * At zero entropy (deterministic):       temperature ≈ PSI^3 (sharpest = PHI_TEMPERATURE).
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} entropy - Current routing entropy H (nats)
   * @param {number} maxEntropy - Maximum possible entropy Hmax = log(numExperts)
   * @returns {{ activation: number, cosScore: number, temperature: number }}
   */
  adaptiveGATE(input, gateVector, entropy, maxEntropy) {
    const temperature = adaptiveTemperature(entropy, maxEntropy);
    const result = this.GATE(input, gateVector, null, 'soft', temperature);
    return { ...result, temperature };
  }

  /**
   * Validate that a vector has the expected dimension and no NaN/Inf values.
   *
   * @param {Float32Array|Float64Array|number[]} vector
   * @param {number} [expectedDim] - Expected dimension (defaults to this.dim)
   * @returns {{ valid: boolean, issues: string[] }}
   */
  validateVector(vector, expectedDim = null) {
    const issues = [];
    const dim = expectedDim || this.dim;

    if (!vector || vector.length === 0) {
      issues.push('Vector is empty or null');
    } else {
      if (vector.length !== dim) {
        issues.push(`Dimension mismatch: got ${vector.length}, expected ${dim}`);
      }

      let hasNaN = false;
      let hasInf = false;
      for (let i = 0; i < vector.length; i++) {
        if (Number.isNaN(vector[i])) hasNaN = true;
        if (!Number.isFinite(vector[i])) hasInf = true;
      }
      if (hasNaN) issues.push('Vector contains NaN values');
      if (hasInf) issues.push('Vector contains Inf values');

      const n = norm(vector);
      if (n < ZERO_NORM_THRESHOLD) {
        issues.push('Vector is near-zero (degenerate)');
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  CSLEngine,
  // Export utility functions for external use
  norm,
  normalize,
  dot,
  clamp,
  vectorAdd,
  vectorSub,
  vectorScale,
  // Export constants
  DEFAULT_DIM,
  LARGE_DIM,
  EPSILON,
  ZERO_NORM_THRESHOLD,
};
```
---

### `src/shared/sacred-geometry.js`

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Sacred Geometry — shared/sacred-geometry.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Orchestration topology, node placement rings, coherence scoring,
 * Fibonacci resource allocation, and UI aesthetic constants.
 *
 * Every node, agent, and UI element follows geometric principles derived from φ.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { PHI, PSI, CSL_THRESHOLDS, fib, phiFusionWeights, poolAllocation } = require('./phi-math');
const { cslAND, normalize, add } = require('./csl-engine');

// ─── Node Topology ───────────────────────────────────────────────────────────

/**
 * Geometric ring topology for the 20 AI nodes.
 * Central → Inner → Middle → Outer → Governance
 */
const NODE_RINGS = Object.freeze({
  CENTRAL: {
    radius: 0,
    nodes: ['HeadySoul'],
    role: 'Awareness and values layer — origin point',
  },
  INNER: {
    radius: 1,
    nodes: ['HeadyBrains', 'HeadyConductor', 'HeadyVinci'],
    role: 'Processing core — orchestration, reasoning, planning',
  },
  MIDDLE: {
    radius: PHI,
    nodes: ['JULES', 'BUILDER', 'ATLAS', 'NOVA', 'HeadyLens', 'StoryDriver'],
    role: 'Execution layer — coding, building, monitoring, documentation',
  },
  OUTER: {
    radius: PHI * PHI,
    nodes: ['HeadyScientist', 'HeadyMC', 'PatternRecognition', 'SelfCritique',
            'SASHA', 'Imagination', 'HCSupervisor', 'HCBrain'],
    role: 'Specialized capabilities — research, simulation, creativity, supervision',
  },
  GOVERNANCE: {
    radius: PHI * PHI * PHI,
    nodes: ['HeadyQA', 'HeadyCheck', 'HeadyRisk'],
    role: 'Quality, assurance, risk — governance shell',
  },
});

/**
 * All 20 node names in canonical order (center-out).
 */
const ALL_NODES = Object.freeze(
  Object.values(NODE_RINGS).flatMap(ring => ring.nodes)
);

/**
 * Lookup which ring a node belongs to.
 * @param {string} nodeName
 * @returns {string|null} Ring name or null
 */
function nodeRing(nodeName) {
  for (const [ringName, ring] of Object.entries(NODE_RINGS)) {
    if (ring.nodes.includes(nodeName)) return ringName;
  }
  return null;
}

/**
 * Geometric distance between two nodes based on ring positions.
 * Nodes in the same ring have distance = ring angular separation.
 * Nodes in different rings have distance = ring radius difference.
 * @param {string} nodeA
 * @param {string} nodeB
 * @returns {number}
 */
function nodeDistance(nodeA, nodeB) {
  const ringA = nodeRing(nodeA);
  const ringB = nodeRing(nodeB);
  if (!ringA || !ringB) return Infinity;

  const rA = NODE_RINGS[ringA];
  const rB = NODE_RINGS[ringB];

  if (ringA === ringB) {
    // Same ring: angular distance based on position index
    const idxA = rA.nodes.indexOf(nodeA);
    const idxB = rA.nodes.indexOf(nodeB);
    const angularDist = Math.abs(idxA - idxB) / rA.nodes.length;
    return rA.radius * angularDist * 2 * Math.PI / rA.nodes.length;
  }

  // Different rings: radius difference + minimal angular correction
  return Math.abs(rA.radius - rB.radius);
}

// ─── Coherence Scoring ───────────────────────────────────────────────────────

const COHERENCE_THRESHOLDS = Object.freeze({
  HEALTHY:   CSL_THRESHOLDS.HIGH,     // ≈ 0.882 — normal operating range
  WARNING:   CSL_THRESHOLDS.MEDIUM,   // ≈ 0.809 — slight drift
  DEGRADED:  CSL_THRESHOLDS.LOW,      // ≈ 0.691 — significant drift
  CRITICAL:  CSL_THRESHOLDS.MINIMUM,  // ≈ 0.500 — system integrity at risk
});

/**
 * Compute coherence between two node state embeddings.
 * @param {Float64Array|number[]} stateA
 * @param {Float64Array|number[]} stateB
 * @returns {{ score: number, status: string }}
 */
function coherenceScore(stateA, stateB) {
  const score = cslAND(stateA, stateB);
  let status;
  if (score >= COHERENCE_THRESHOLDS.HEALTHY)   status = 'HEALTHY';
  else if (score >= COHERENCE_THRESHOLDS.WARNING)   status = 'WARNING';
  else if (score >= COHERENCE_THRESHOLDS.DEGRADED)  status = 'DEGRADED';
  else status = 'CRITICAL';
  return { score, status };
}

/**
 * Compute system-wide coherence by averaging all pairwise node scores.
 * @param {Map<string, Float64Array|number[]>} nodeStates - Map of node name → state vector
 * @returns {{ overall: number, status: string, drifted: string[] }}
 */
function systemCoherence(nodeStates) {
  const nodes = Array.from(nodeStates.keys());
  const drifted = [];
  let totalScore = 0;
  let pairCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const { score, status } = coherenceScore(
        nodeStates.get(nodes[i]),
        nodeStates.get(nodes[j])
      );
      totalScore += score;
      pairCount++;
      if (status === 'CRITICAL' || status === 'DEGRADED') {
        drifted.push(`${nodes[i]}<->${nodes[j]} (${score.toFixed(3)} ${status})`);
      }
    }
  }

  const overall = pairCount > 0 ? totalScore / pairCount : 0;
  let status;
  if (overall >= COHERENCE_THRESHOLDS.HEALTHY)  status = 'HEALTHY';
  else if (overall >= COHERENCE_THRESHOLDS.WARNING)  status = 'WARNING';
  else if (overall >= COHERENCE_THRESHOLDS.DEGRADED) status = 'DEGRADED';
  else status = 'CRITICAL';

  return { overall, status, drifted };
}

// ─── Pool Scheduling ─────────────────────────────────────────────────────────

/**
 * Hot/Warm/Cold pool definitions with Fibonacci resource ratios.
 */
const POOL_CONFIG = Object.freeze({
  HOT: {
    name: 'hot',
    purpose: 'User-facing, latency-critical tasks',
    resourcePct: fib(9),   // 34%
    maxConcurrency: fib(8), // 21
    timeoutMs: 5000,
    priority: 0,
  },
  WARM: {
    name: 'warm',
    purpose: 'Background processing, non-urgent tasks',
    resourcePct: fib(8),   // 21%
    maxConcurrency: fib(7), // 13
    timeoutMs: 30000,
    priority: 1,
  },
  COLD: {
    name: 'cold',
    purpose: 'Ingestion, analytics, batch processing',
    resourcePct: fib(7),   // 13%
    maxConcurrency: fib(6), // 8
    timeoutMs: 120000,
    priority: 2,
  },
  RESERVE: {
    name: 'reserve',
    purpose: 'Burst capacity for overload conditions',
    resourcePct: fib(6),   // 8%
    maxConcurrency: fib(5), // 5
    timeoutMs: 60000,
    priority: 3,
  },
  GOVERNANCE: {
    name: 'governance',
    purpose: 'Health checks, auditing, compliance',
    resourcePct: fib(5),   // 5%
    maxConcurrency: fib(4), // 3
    timeoutMs: 10000,
    priority: 4,
  },
});

/**
 * Assign a task to the appropriate pool based on priority and type.
 * @param {object} task
 * @param {string} task.type - 'user-facing' | 'background' | 'batch' | 'burst' | 'governance'
 * @param {number} [task.urgency=0.5] - 0–1 urgency score
 * @returns {string} Pool name
 */
function assignPool(task) {
  const urgency = task.urgency || 0.5;
  switch (task.type) {
    case 'user-facing': return 'HOT';
    case 'governance':  return 'GOVERNANCE';
    case 'burst':       return 'RESERVE';
    case 'batch':       return 'COLD';
    case 'background':
      return urgency >= CSL_THRESHOLDS.MEDIUM ? 'WARM' : 'COLD';
    default:
      return urgency >= CSL_THRESHOLDS.HIGH ? 'HOT' : 'WARM';
  }
}

// ─── UI Aesthetic Constants ──────────────────────────────────────────────────

const UI = Object.freeze({
  // Typography scale: φ-based
  TYPE_SCALE: {
    xs:    Math.round(16 / PHI / PHI),  // ≈ 6
    sm:    Math.round(16 / PHI),        // ≈ 10
    base:  16,
    lg:    Math.round(16 * PHI),        // ≈ 26
    xl:    Math.round(16 * PHI * PHI),  // ≈ 42
    '2xl': Math.round(16 * PHI * PHI * PHI), // ≈ 68
  },

  // Fibonacci spacing (px)
  SPACING: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89],

  // Layout ratios
  LAYOUT: {
    primaryWidth:   `${(PSI * 100).toFixed(2)}%`,      // ≈ 61.80%
    secondaryWidth: `${((1 - PSI) * 100).toFixed(2)}%`, // ≈ 38.20%
    goldenSection:  PSI,
  },

  // Color harmony: golden angle ≈ 137.508° for complementary hues
  GOLDEN_ANGLE: 360 / (PHI * PHI), // ≈ 137.508°

  // Brand colors
  COLORS: {
    primary:    '#6C63FF', // Heady Purple
    secondary:  '#FF6584', // Accent Pink
    success:    '#00C9A7', // Sacred Green
    warning:    '#FFB800', // Gold
    danger:     '#FF4757', // Alert Red
    background: '#0F0E17', // Deep Space
    surface:    '#1A1928', // Card Surface
    text:       '#FFFFFE', // Pure White
    muted:      '#94A1B2', // Muted
  },

  // Animation timing (phi-based easing)
  TIMING: {
    instant:  fib(4) * 10,  // 30ms
    fast:     fib(5) * 10,  // 50ms
    normal:   fib(7) * 10,  // 130ms
    slow:     fib(8) * 10,  // 210ms
    glacial:  fib(9) * 10,  // 340ms
  },
});

// ─── Bee Worker Limits ───────────────────────────────────────────────────────

const BEE_LIMITS = Object.freeze({
  maxConcurrentBees:  fib(8),  // 21
  maxQueueDepth:      fib(13), // 233
  beeTimeoutMs:       fib(9) * 1000, // 34 seconds
  maxRetries:         fib(5),  // 5
  healthCheckIntervalMs: fib(7) * 1000, // 13 seconds
  registryCapacity:   fib(10), // 55 registered bee types
});

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Topology
  NODE_RINGS, ALL_NODES, nodeRing, nodeDistance,

  // Coherence
  COHERENCE_THRESHOLDS, coherenceScore, systemCoherence,

  // Pool scheduling
  POOL_CONFIG, assignPool, poolAllocation,

  // UI aesthetics
  UI,

  // Bee limits
  BEE_LIMITS,
};
```
---
