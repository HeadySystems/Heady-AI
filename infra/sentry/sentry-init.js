/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 */
// HEADY_BRAND:BEGIN
// Sentry Integration — Error Tracking & Performance Monitoring
// for all Heady Liquid Nodes
// HEADY_BRAND:END

const PSI = 0.618033988749895;
const PSI_SQ = 0.381966011250105;

/**
 * Initialize Sentry for a Heady Liquid Node.
 *
 * @param {Object} config
 * @param {string} config.serviceId - Service identifier
 * @param {string} config.serviceVersion - SemVer version
 * @param {string} config.serviceTier - hot | warm | cold
 * @returns {Object|null} Sentry instance or null if DSN not configured
 */
function initSentry({ serviceId, serviceVersion, serviceTier = 'warm' }) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.info(`[sentry] No SENTRY_DSN — Sentry disabled for ${serviceId}`);
    return null;
  }

  try {
    const Sentry = require('@sentry/node');
    const { nodeProfilingIntegration } = require('@sentry/profiling-node');

    // φ-scaled trace sample rates based on tier
    const tracesSampleRate = {
      hot: 1.0,      // Critical — trace everything
      warm: PSI,     // 0.618
      cold: PSI_SQ,  // 0.382
    }[serviceTier] || PSI;

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: `${serviceId}@${serviceVersion}`,
      serverName: serviceId,
      tracesSampleRate,
      profilesSampleRate: serviceTier === 'hot' ? 1.0 : PSI_SQ,
      integrations: [
        nodeProfilingIntegration(),
      ],
      beforeSend(event) {
        // Enrich with Heady context
        event.tags = {
          ...event.tags,
          'heady.service': serviceId,
          'heady.tier': serviceTier,
          'heady.version': serviceVersion,
          'heady.phi': '1.618',
        };
        return event;
      },
    });

    // Set global context
    Sentry.setContext('liquid_node', {
      serviceId,
      serviceVersion,
      serviceTier,
      phi: 1.618033988749895,
    });

    console.info(`[sentry] Initialized for ${serviceId} (tier: ${serviceTier}, traces: ${tracesSampleRate})`);
    return Sentry;
  } catch (err) {
    console.error(`[sentry] Failed to initialize for ${serviceId}:`, err.message);
    return null;
  }
}

/**
 * Create Sentry-aware error handler middleware for Express.
 */
function sentryErrorHandler(Sentry) {
  if (!Sentry) return (err, req, res, next) => next(err);
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Report all 4xx and 5xx errors
      if (error.status) return error.status >= 400;
      return true;
    },
  });
}

/**
 * Create Sentry request handler middleware for Express.
 */
function sentryRequestHandler(Sentry) {
  if (!Sentry) return (req, res, next) => next();
  return Sentry.Handlers.requestHandler({
    serverName: true,
    user: ['id', 'email'],
  });
}

module.exports = { initSentry, sentryErrorHandler, sentryRequestHandler };
