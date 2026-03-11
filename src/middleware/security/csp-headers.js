/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Content Security Policy (CSP) Headers Middleware
 * ═════════════════════════════════════════════════
 * Strict CSP for all 9 Heady domains — no unsafe-inline, no unsafe-eval.
 * Uses nonce-based script loading for inline scripts.
 * Includes frame-ancestors, SRI reporting, and OWASP headers.
 *
 * φ-derived: Report throttle = ψ² × 1000 ms ≈ 382ms
 */

'use strict';

const crypto = require('crypto');

// ─── φ-Math Constants ─────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI;                     // ≈ 0.618
const PSI2 = PSI * PSI;                  // ≈ 0.382
const REPORT_THROTTLE_MS = Math.round(PSI2 * 1000); // ≈ 382ms

// ─── Trusted Domains ──────────────────────────────────────────────────────────
const HEADY_DOMAINS = [
    'headyme.com',
    'headysystems.com',
    'headyconnection.org',
    'headyconnection.com',
    'headyos.com',
    'heady-ai.com',
    'headyex.com',
    'headyfinance.com',
    'admin.headysystems.com',
    'auth.headysystems.com',
    'api.headysystems.com',
    'status.headysystems.com',
];

const SELF_AND_HEADY = ["'self'", ...HEADY_DOMAINS.map(d => `https://${d}`)];

// ─── CSP Directives Builder ──────────────────────────────────────────────────

/**
 * Generate a cryptographic nonce for inline scripts.
 * @returns {string} Base64-encoded nonce
 */
function generateNonce() {
    return crypto.randomBytes(16).toString('base64');
}

/**
 * Build CSP directive string.
 * @param {object} opts
 * @param {string} opts.nonce        - Script nonce
 * @param {string} [opts.reportUri]  - CSP violation report endpoint
 * @param {string[]} [opts.extraScriptSrc] - Additional script sources
 * @param {string[]} [opts.extraStyleSrc]  - Additional style sources
 * @param {string[]} [opts.extraConnectSrc] - Additional connect sources
 * @param {string[]} [opts.extraImgSrc]    - Additional image sources
 * @param {string[]} [opts.extraFrameAncestors] - Additional frame ancestors
 * @returns {string}
 */
function buildCSP(opts = {}) {
    const { nonce, reportUri, extraScriptSrc = [], extraStyleSrc = [], extraConnectSrc = [], extraImgSrc = [], extraFrameAncestors = [] } = opts;

    const directives = {
        'default-src': ["'self'"],

        'script-src': [
            "'self'",
            `'nonce-${nonce}'`,
            "'strict-dynamic'",
            ...extraScriptSrc,
        ],

        'style-src': [
            "'self'",
            `'nonce-${nonce}'`,
            'https://fonts.googleapis.com',
            ...extraStyleSrc,
        ],

        'font-src': [
            "'self'",
            'https://fonts.gstatic.com',
            'data:',
        ],

        'img-src': [
            "'self'",
            'data:',
            'blob:',
            'https:',
            ...extraImgSrc,
        ],

        'connect-src': [
            "'self'",
            ...SELF_AND_HEADY,
            'https://firebaseinstallations.googleapis.com',
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
            'wss://*.headysystems.com',
            ...extraConnectSrc,
        ],

        'frame-src': [
            "'self'",
            'https://auth.headysystems.com',
            'https://accounts.google.com',
        ],

        'frame-ancestors': [
            "'self'",
            ...HEADY_DOMAINS.map(d => `https://${d}`),
            ...extraFrameAncestors,
        ],

        'form-action': ["'self'", 'https://auth.headysystems.com'],

        'base-uri': ["'self'"],

        'object-src': ["'none'"],

        'worker-src': ["'self'", 'blob:'],

        'manifest-src': ["'self'"],

        'media-src': ["'self'", 'blob:'],

        'upgrade-insecure-requests': [],
    };

    if (reportUri) {
        directives['report-uri'] = [reportUri];
    }

    return Object.entries(directives)
        .map(([key, values]) => values.length === 0 ? key : `${key} ${values.join(' ')}`)
        .join('; ');
}

// ─── Additional Security Headers ─────────────────────────────────────────────

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '0', // Disabled — CSP replaces this
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=(self)',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()',
    ].join(', '),
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Resource-Policy': 'same-site',
};

// ─── Middleware Factory ──────────────────────────────────────────────────────

/**
 * Express middleware that sets strict CSP and security headers.
 *
 * @param {object} [opts]
 * @param {string} [opts.reportUri]         - CSP violation report endpoint
 * @param {boolean} [opts.reportOnly]       - Use Content-Security-Policy-Report-Only
 * @param {string[]} [opts.extraScriptSrc]  - Additional script sources
 * @param {string[]} [opts.extraStyleSrc]   - Additional style sources
 * @param {string[]} [opts.extraConnectSrc] - Additional connect sources
 * @param {string[]} [opts.extraImgSrc]     - Additional image sources
 * @param {string[]} [opts.extraFrameAncestors] - Additional frame ancestors
 * @param {boolean} [opts.includeSTSHeader] - Include Strict-Transport-Security
 * @returns {Function} Express middleware
 */
function cspHeaders(opts = {}) {
    const {
        reportUri = '/api/csp-report',
        reportOnly = false,
        includeSTSHeader = process.env.NODE_ENV === 'production',
        ...cspOpts
    } = opts;

    const cspHeaderName = reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';

    return (req, res, next) => {
        // Generate per-request nonce
        const nonce = generateNonce();
        res.locals.cspNonce = nonce;

        // Build CSP
        const csp = buildCSP({ nonce, reportUri, ...cspOpts });
        res.set(cspHeaderName, csp);

        // Set additional security headers
        for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
            res.set(header, value);
        }

        // HSTS in production
        if (includeSTSHeader) {
            res.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
        }

        next();
    };
}

// ─── CSP Report Handler ──────────────────────────────────────────────────────

let _lastReportTime = 0;

/**
 * Express route handler for CSP violation reports.
 * Throttled to ψ² × 1000ms intervals.
 */
function cspReportHandler(req, res) {
    const now = Date.now();
    if (now - _lastReportTime < REPORT_THROTTLE_MS) {
        return res.status(204).end();
    }
    _lastReportTime = now;

    const report = req.body?.['csp-report'] || req.body;
    if (report) {
        const logData = {
            level: 'warn',
            service: 'csp',
            event: 'csp-violation',
            blockedUri: report['blocked-uri'],
            documentUri: report['document-uri'],
            violatedDirective: report['violated-directive'],
            originalPolicy: report['original-policy']?.slice(0, 200),
            timestamp: new Date().toISOString(),
        };
        // Structured JSON logging — no console.log
        process.stdout.write(JSON.stringify(logData) + '\n');
    }
    res.status(204).end();
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    cspHeaders,
    cspReportHandler,
    generateNonce,
    buildCSP,
    HEADY_DOMAINS,
    SECURITY_HEADERS,
    REPORT_THROTTLE_MS,
};
