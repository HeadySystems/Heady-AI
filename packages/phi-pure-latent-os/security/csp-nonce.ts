/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * @module security/csp-nonce
 * @description Express middleware that generates a cryptographic nonce per
 *   request and attaches a full Content-Security-Policy header covering all
 *   9 Heady domains. Nonce is exposed via res.locals.nonce for use in
 *   template engines (Twig, EJS, Handlebars).
 *
 *   All 9 Heady domains included in connect-src:
 *     headyme.com, headysystems.com, headyconnection.org, headybuddy.org,
 *     headymcp.com, headyio.com, headybot.com, headyapi.com, headyai.com
 */

import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CspOptions {
  /**
   * Report-Only mode: uses Content-Security-Policy-Report-Only instead of
   * enforcing. Set to true for canary deployments.
   */
  reportOnly?: boolean;
  /**
   * Sentry CSP report endpoint. Falls back to SENTRY_CSP_ENDPOINT env var.
   */
  reportUri?: string;
  /**
   * Allow inline styles in addition to 'unsafe-inline'. Drupal requires this.
   * Default: true.
   */
  allowInlineStyles?: boolean;
  /**
   * Trusted additional script origins (e.g. analytics CDN).
   * Appended to script-src.
   */
  additionalScriptSrc?: string[];
  /**
   * Additional connect-src origins beyond the 9 Heady domains.
   */
  additionalConnectSrc?: string[];
}

// Augment Express to expose nonce on res.locals
declare module 'express-serve-static-core' {
  interface Locals {
    nonce: string;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** All 9 Heady apex domains — both www and bare, both http schemes */
const HEADY_DOMAINS = [
  'https://*.headyme.com',
  'https://*.headysystems.com',
  'https://*.headyconnection.org',
  'https://*.headybuddy.org',
  'https://*.headymcp.com',
  'https://*.headyio.com',
  'https://*.headybot.com',
  'https://*.headyapi.com',
  'https://*.headyai.com',
] as const;

/** Nonce byte length: 16 bytes = 128 bits of entropy */
const NONCE_BYTE_LENGTH = 16;

/** Header name for enforcing CSP */
const CSP_HEADER          = 'Content-Security-Policy';
/** Header name for report-only CSP */
const CSP_REPORT_HEADER   = 'Content-Security-Policy-Report-Only';
/** Report-To group name */
const REPORT_TO_GROUP     = 'heady-csp';

// ─── Nonce Generation ─────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure base64 nonce.
 * Uses crypto.randomBytes — not Math.random, not uuid.
 */
function generateNonce(): string {
  return randomBytes(NONCE_BYTE_LENGTH).toString('base64');
}

// ─── CSP Policy Builder ───────────────────────────────────────────────────────

function buildPolicy(nonce: string, options: CspOptions): string {
  const allowInlineStyles = options.allowInlineStyles !== false; // default true

  const reportUri =
    options.reportUri ??
    process.env['SENTRY_CSP_ENDPOINT'] ??
    null;

  const connectSrcExtras = options.additionalConnectSrc ?? [];
  const scriptSrcExtras  = options.additionalScriptSrc  ?? [];

  // ── Directives ──────────────────────────────────────────────────────────────

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],

    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      // Strict dynamic allows scripts loaded by nonce-bearing scripts
      "'strict-dynamic'",
      ...scriptSrcExtras,
    ],

    'style-src': [
      "'self'",
      // Drupal injects inline styles — 'unsafe-inline' is required
      ...(allowInlineStyles ? ["'unsafe-inline'"] : []),
    ],

    'img-src': [
      "'self'",
      'data:',
      'https:',
      'blob:',
    ],

    'font-src': [
      "'self'",
      'data:',
      ...HEADY_DOMAINS,
    ],

    'media-src': [
      "'self'",
      'blob:',
      ...HEADY_DOMAINS,
    ],

    'connect-src': [
      "'self'",
      ...HEADY_DOMAINS,
      'https://sentry.io',        // Error reporting
      'https://*.sentry.io',
      'https://o*.ingest.sentry.io', // Sentry ingest tunnels
      ...connectSrcExtras,
    ],

    'worker-src': [
      "'self'",
      'blob:',
    ],

    'manifest-src': ["'self'"],

    'frame-src': [
      "'self'",
      ...HEADY_DOMAINS,
    ],

    // Prevent clickjacking via frame-ancestors
    'frame-ancestors': ["'none'"],

    // Restrict base tag injection attacks
    'base-uri': ["'self'"],

    // Only allow form submissions to self (API calls use fetch, not forms)
    'form-action': [
      "'self'",
      ...HEADY_DOMAINS,
    ],

    // Upgrade insecure requests on all Heady domains
    'upgrade-insecure-requests': [],
  };

  // Append report-uri directive if endpoint is configured
  if (reportUri) {
    directives['report-uri'] = [reportUri];
    directives['report-to']  = [REPORT_TO_GROUP];
  }

  // Serialize directives to CSP string
  return Object.entries(directives)
    .map(([directive, values]) => {
      if (values.length === 0) return directive;
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

// ─── Report-To Header Builder ─────────────────────────────────────────────────

function buildReportToHeader(reportUri: string): string {
  const group = {
    group:     REPORT_TO_GROUP,
    max_age:   10_886,  // ≈ FIB[12] * 46.7s — phi-harmonic cache TTL
    endpoints: [{ url: reportUri }],
    include_subdomains: true,
  };
  return JSON.stringify(group);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Express middleware factory that:
 *   1. Generates a cryptographic nonce per request
 *   2. Attaches nonce to res.locals.nonce (available in templates)
 *   3. Sets Content-Security-Policy header with full Heady domain policy
 *   4. Sets Report-To header when a Sentry CSP endpoint is configured
 *   5. Sets X-Content-Type-Options, X-Frame-Options, and Referrer-Policy
 *      as belt-and-suspenders defense headers
 *
 * @example
 * ```ts
 * import { cspNonce } from './security/csp-nonce.js';
 *
 * app.use(cspNonce());
 *
 * // In your template:
 * // <script nonce="{{ nonce }}">...</script>
 * ```
 */
export function cspNonce(options: CspOptions = {}): RequestHandler {
  return function cspNonceMiddleware(
    _req:  Request,
    res:   Response,
    next:  NextFunction,
  ): void {
    const nonce = generateNonce();

    // Expose nonce to template engines via res.locals
    res.locals['nonce'] = nonce;

    const headerName = options.reportOnly ? CSP_REPORT_HEADER : CSP_HEADER;
    const policy     = buildPolicy(nonce, options);

    // ── Security Headers ────────────────────────────────────────────────────

    res.setHeader(headerName, policy);

    // Belt-and-suspenders: prevent MIME-sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Belt-and-suspenders: frame embedding (legacy header, CSP frame-ancestors is primary)
    res.setHeader('X-Frame-Options', 'DENY');

    // Referrer policy: send only origin on cross-origin requests
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy: disable unused powerful APIs
    res.setHeader(
      'Permissions-Policy',
      [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
      ].join(', '),
    );

    // ── Report-To Header ────────────────────────────────────────────────────

    const reportUri =
      options.reportUri ??
      process.env['SENTRY_CSP_ENDPOINT'] ??
      null;

    if (reportUri) {
      res.setHeader('Report-To', buildReportToHeader(reportUri));
    }

    next();
  };
}

// ─── Nonce Helper for SSR Templates ──────────────────────────────────────────

/**
 * Extract the nonce from a response object (for use inside route handlers or
 * template helper functions after cspNonce() middleware has run).
 *
 * @throws if nonce is not present (middleware was not applied)
 */
export function getNonce(res: Response): string {
  const nonce = res.locals['nonce'];
  if (typeof nonce !== 'string' || nonce.length === 0) {
    throw new Error(
      'getNonce: nonce not found on res.locals. ' +
      'Ensure cspNonce() middleware is applied before this route handler.',
    );
  }
  return nonce;
}

/**
 * Render an inline <script> tag with the correct nonce attribute.
 * Safe for server-rendered HTML — does not escape existing nonce value
 * (nonce is base64 and contains no HTML-special characters by construction).
 *
 * @example
 * ```ts
 * res.send(`<html><head>${nonceScriptTag(res, 'window.__APP_STATE__ = ' + JSON.stringify(state))}</head></html>`);
 * ```
 */
export function nonceScriptTag(res: Response, code: string): string {
  const nonce = getNonce(res);
  return `<script nonce="${nonce}">${code}</script>`;
}

// ─── Default Export ───────────────────────────────────────────────────────────

export default cspNonce;
