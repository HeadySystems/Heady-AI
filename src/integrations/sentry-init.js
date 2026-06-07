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
// ║  FILE: src/integrations/sentry-init.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Sentry Integration v5.0.0                              ║
// ║  Phi-ratio sampled error tracking and performance monitoring   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

'use strict';

/**
 * @fileoverview Sentry SDK initialization with phi-ratio sampling.
 *
 * Provides centralized Sentry setup for Node.js services, with:
 * - Automatic DSN from environment
 * - Release tagging from package.json
 * - Phi-ratio trace and profile sampling (0.1 ≈ ψ⁴)
 * - Express middleware integration
 * - Structured error capture with context
 *
 * @module sentry-init
 * @version 5.0.0
 * @see HEA-176
 */

const path = require('path');

/** @type {number} Phi-ratio sampling rate (≈ PSI⁴ rounded to 0.1) */
const PHI_SAMPLE_RATE = 0.1;

/**
 * Reads the project version from the nearest package.json.
 * @returns {string} Version string or 'unknown'
 */
function _getProjectVersion() {
  try {
    const pkg = require(path.resolve(process.cwd(), 'package.json'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Initializes the Sentry SDK for Node.js error tracking and performance monitoring.
 *
 * Reads configuration from environment variables and applies phi-ratio sampling.
 * Requires @sentry/node v8+ to be installed as a peer dependency.
 *
 * @param {Object} [options={}] - Override options
 * @param {string} [options.dsn] - Sentry DSN (defaults to SENTRY_DSN env var)
 * @param {string} [options.environment] - Environment name (defaults to NODE_ENV)
 * @param {string} [options.release] - Release tag (defaults to package.json version)
 * @param {number} [options.tracesSampleRate=0.1] - Transaction sampling rate (phi-ratio)
 * @param {number} [options.profilesSampleRate=0.1] - Profile sampling rate (phi-ratio)
 * @param {boolean} [options.enableExpress=true] - Whether to add Express integration
 * @returns {Object|null} Sentry instance if initialized successfully, null if DSN missing
 *
 * @example
 * const { initSentry } = require('./integrations/sentry-init');
 * const Sentry = initSentry();
 * // Sentry is now capturing errors with phi-ratio sampling
 *
 * @example
 * // With custom options
 * const Sentry = initSentry({
 *   tracesSampleRate: 0.2,
 *   environment: 'staging'
 * });
 */
function initSentry(options = {}) {
  const dsn = options.dsn || process.env.SENTRY_DSN;

  if (!dsn) {
    if (process.env.NODE_ENV !== 'test') {
      process.stderr.write('[sentry-init] SENTRY_DSN not set — Sentry disabled\n');
    }
    return null;
  }

  let Sentry;
  try {
    Sentry = require('@sentry/node');
  } catch {
    process.stderr.write('[sentry-init] @sentry/node not installed — Sentry disabled\n');
    return null;
  }

  // Verify v8+ API
  if (typeof Sentry.init !== 'function') {
    process.stderr.write('[sentry-init] @sentry/node v8+ required\n');
    return null;
  }

  const environment = options.environment || process.env.NODE_ENV || 'development';
  const release = options.release || _getProjectVersion();
  const tracesSampleRate = options.tracesSampleRate ?? PHI_SAMPLE_RATE;
  const profilesSampleRate = options.profilesSampleRate ?? PHI_SAMPLE_RATE;

  const initConfig = {
    dsn,
    environment,
    release,
    tracesSampleRate,
    profilesSampleRate
  };

  // Add Express integration if available and enabled
  const enableExpress = options.enableExpress !== false;
  if (enableExpress && Sentry.expressIntegration) {
    initConfig.integrations = [Sentry.expressIntegration()];
  }

  Sentry.init(initConfig);

  return Sentry;
}

/**
 * Captures an error with structured context metadata.
 *
 * Wraps Sentry.captureException with additional context tags and extras
 * for richer error diagnostics in the Sentry dashboard.
 *
 * @param {Error} error - The error to capture
 * @param {Object} [context={}] - Additional context
 * @param {string} [context.component] - Component name where error occurred
 * @param {string} [context.operation] - Operation that failed
 * @param {string} [context.userId] - Affected user ID
 * @param {Object} [context.extra] - Additional key-value metadata
 * @returns {string|null} Sentry event ID if captured, null if Sentry unavailable
 *
 * @example
 * captureWithContext(new Error('DB timeout'), {
 *   component: 'csl-engine',
 *   operation: 'vector-search',
 *   extra: { queryDimensions: 384 }
 * });
 */
function captureWithContext(error, context = {}) {
  let Sentry;
  try {
    Sentry = require('@sentry/node');
  } catch {
    return null;
  }

  if (!Sentry || typeof Sentry.captureException !== 'function') {
    return null;
  }

  return Sentry.withScope((scope) => {
    if (context.component) scope.setTag('component', context.component);
    if (context.operation) scope.setTag('operation', context.operation);
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.extra) scope.setExtras(context.extra);

    return Sentry.captureException(error);
  });
}

/**
 * Creates Express error-handling middleware for Sentry.
 *
 * Returns a standard Express error handler (err, req, res, next) that
 * captures the error to Sentry with request context, then passes it
 * to the next error handler.
 *
 * @returns {Function} Express error-handling middleware (err, req, res, next)
 *
 * @example
 * const express = require('express');
 * const { createSentryMiddleware } = require('./integrations/sentry-init');
 *
 * const app = express();
 * // ... routes ...
 * app.use(createSentryMiddleware());
 */
function createSentryMiddleware() {
  return function sentryErrorHandler(err, req, res, next) {
    captureWithContext(err, {
      component: 'express',
      operation: `${req.method} ${req.path}`,
      extra: {
        statusCode: res.statusCode,
        query: req.query,
        ip: req.ip
      }
    });
    next(err);
  };
}

// ─── CommonJS Exports ─────────────────────────────────────────────────────────

module.exports = {
  initSentry,
  captureWithContext,
  createSentryMiddleware,
  PHI_SAMPLE_RATE
};
