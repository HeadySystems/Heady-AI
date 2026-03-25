/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Sentry v8 — Native OpenTelemetry integration.
 *
 * Sentry v8 ships its own OpenTelemetry SDK layer. Do NOT install or import
 * @sentry/opentelemetry separately — it is already bundled inside @sentry/node v8.
 * Setting skipOpenTelemetrySetup: false (the default) lets Sentry own the OTel
 * provider lifecycle so both SDKs share a single tracer/meter provider.
 *
 * Sample rates use φ-math constants:
 *   tracesSampleRate   = PSI       ≈ 0.618   (production)
 *   profilesSampleRate = PSI * PSI ≈ 0.382
 *
 * @module observability/sentry
 */

import * as Sentry from '@sentry/node';
import type { Event, EventHint } from '@sentry/node';
import type { Application } from 'express';
import { PSI } from '../shared/phi-math.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** φ-derived traces sample rate: 1/φ ≈ 0.618 */
const TRACES_SAMPLE_RATE_PROD: number = PSI;          // 0.618…

/** φ²-derived profiles sample rate: 1/φ² ≈ 0.382 */
const PROFILES_SAMPLE_RATE: number = PSI * PSI;       // 0.381…

/** Staging / local: capture everything */
const TRACES_SAMPLE_RATE_DEV = 1.0;

// ---------------------------------------------------------------------------
// PII scrubbing — beforeSend
// ---------------------------------------------------------------------------

/** Regex patterns that identify personally-identifiable data in string fields. */
const PII_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // RFC-5321 email addresses
  {
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    replacement: '[email-redacted]',
  },
  // IPv4 addresses
  {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '[ip-redacted]',
  },
  // IPv6 addresses (abbreviated form)
  {
    pattern: /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g,
    replacement: '[ipv6-redacted]',
  },
  // Bearer / Authorization tokens
  {
    pattern: /\b(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi,
    replacement: 'Bearer [token-redacted]',
  },
  // Generic "Authorization: <value>" header values
  {
    pattern: /(authorization:\s*)[^\s,]+/gi,
    replacement: '$1[auth-redacted]',
  },
  // API key / secret / token key-value pairs in query strings or JSON
  {
    pattern: /("?(?:api[_-]?key|secret|token|password|passwd|auth)"?\s*[:=]\s*["']?)[^"',\s&}]+/gi,
    replacement: '$1[secret-redacted]',
  },
  // Session IDs (sid= style)
  {
    pattern: /\b(sid=)[A-Za-z0-9._\-]+/gi,
    replacement: '$1[session-redacted]',
  },
];

/**
 * Recursively walk every string value in an arbitrary object and redact PII.
 * Returns a new object — never mutates the original.
 */
function scrubPii<T>(value: T): T {
  if (typeof value === 'string') {
    let out = value;
    for (const { pattern, replacement } of PII_PATTERNS) {
      out = out.replace(pattern, replacement);
    }
    return out as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map(scrubPii) as unknown as T;
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Drop entire fields whose keys signal PII even if we can't parse the value
      if (/^(password|passwd|secret|token|apiKey|api_key|auth|authorization|cookie|ssn|creditcard|cvv)$/i.test(k)) {
        result[k] = '[field-redacted]';
      } else {
        result[k] = scrubPii(v);
      }
    }
    return result as unknown as T;
  }

  return value;
}

/**
 * Sentry beforeSend hook — scrubs PII from every outbound event.
 * Returns null to drop the event entirely if the DSN is absent (safety guard).
 */
function beforeSend(event: Event, _hint: EventHint): Event | null {
  if (!process.env.SENTRY_DSN) {
    // No DSN configured — discard to avoid accidental telemetry leaks
    return null;
  }

  const cleaned = scrubPii(event);

  // Additionally redact request headers that should never reach Sentry
  if (cleaned.request?.headers) {
    const safeHeaders: Record<string, string> = {};
    const ALLOW_LISTED = new Set([
      'content-type',
      'content-length',
      'accept',
      'accept-encoding',
      'user-agent',
      'x-forwarded-for',   // kept for debugging but already scrubbed above
      'x-request-id',
      'x-correlation-id',
    ]);
    for (const [name, val] of Object.entries(cleaned.request.headers)) {
      if (ALLOW_LISTED.has(name.toLowerCase())) {
        safeHeaders[name] = typeof val === 'string' ? scrubPii(val) : String(val);
      } else {
        safeHeaders[name] = '[header-redacted]';
      }
    }
    cleaned.request = { ...cleaned.request, headers: safeHeaders };
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SentrySetupOptions {
  /** Express Application instance to attach error handler to. Pass undefined to skip. */
  app?: Application;
}

/**
 * Initialise Sentry v8 with native OpenTelemetry.
 *
 * Call this ONCE at process start, before any other imports that might create
 * spans or HTTP instrumentation. When `app` is provided the Sentry Express
 * error handler is also registered (must be called after all routes).
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { setupSentry } from './observability/sentry.js';
 *
 * const app = express();
 * setupSentry({ app });
 *
 * app.get('/', (_req, res) => res.send('ok'));
 * // error handler is already attached by setupSentry
 * ```
 */
export function setupSentry(options: SentrySetupOptions = {}): void {
  const { app } = options;
  const env = process.env.NODE_ENV ?? 'development';
  const isProduction = env === 'production';

  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    environment: env,
    release: process.env.SENTRY_RELEASE,

    // φ-derived sample rates
    tracesSampleRate: isProduction ? TRACES_SAMPLE_RATE_PROD : TRACES_SAMPLE_RATE_DEV,
    profilesSampleRate: PROFILES_SAMPLE_RATE,

    // Let Sentry v8 own the entire OpenTelemetry provider lifecycle.
    // Do NOT set this to true unless you are managing your own OTel SDK setup
    // elsewhere — doing so would break distributed tracing between Sentry and
    // any custom @opentelemetry/api spans created in tracing.ts.
    skipOpenTelemetrySetup: false,

    integrations: [
      // HTTP client + server instrumentation
      Sentry.httpIntegration({ tracing: true }),

      // Native Node fetch (undici) instrumentation
      Sentry.nativeNodeFetchIntegration({ breadcrumbs: true }),

      // Express route-level transaction names
      Sentry.expressIntegration(),

      // PostgreSQL query tracing (covers pg + pg-pool)
      Sentry.postgresIntegration(),
    ],

    beforeSend,

    // Attach Heady correlation context to every event
    beforeSendTransaction(transaction) {
      return scrubPii(transaction);
    },

    // Never send personal data in user context unless explicitly set
    sendDefaultPii: false,

    // Attach HeadySystems metadata to every event
    initialScope: {
      tags: {
        'heady.platform': 'phi-pure-latent-os',
        'heady.version': process.env.npm_package_version ?? 'unknown',
      },
    },
  });

  // Wire the Express error handler AFTER all routes have been declared so
  // Sentry can capture unhandled Express errors with full request context.
  if (app) {
    Sentry.setupExpressErrorHandler(app);
  }
}

/**
 * Manually capture an exception with optional Heady-specific context.
 * Prefer letting the Sentry OTel integration auto-capture; use this for
 * caught errors that should still be reported.
 */
export function captureHeadyError(
  error: Error,
  context?: {
    service?: string;
    domain?: string;
    coherenceScore?: number;
    pipelineStage?: string;
    beeType?: string;
    extra?: Record<string, unknown>;
  },
): string {
  return Sentry.captureException(error, {
    tags: {
      ...(context?.service      && { 'heady.service':        context.service }),
      ...(context?.domain       && { 'heady.domain':         context.domain }),
      ...(context?.pipelineStage && { 'heady.pipeline_stage': context.pipelineStage }),
      ...(context?.beeType      && { 'heady.bee_type':        context.beeType }),
    },
    extra: {
      ...(context?.coherenceScore !== undefined && {
        'heady.coherence_score': context.coherenceScore,
      }),
      ...context?.extra,
    },
  });
}

/**
 * Add a Heady-annotated breadcrumb to the current Sentry scope.
 */
export function addHeadyBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info',
): void {
  Sentry.addBreadcrumb({
    message,
    level,
    category: 'heady',
    data,
    timestamp: Date.now() / 1000,
  });
}

// Re-export the raw Sentry SDK for callers that need direct access (e.g. for
// withScope, setUser, etc.) without importing @sentry/node directly.
export { Sentry };
