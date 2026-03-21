/**
 * Heady™ Healthz Middleware v1.0
 * Standard health check endpoint for all Cloud Run services.
 *
 * Provides /healthz, /readiness, and /startup endpoints
 * per Kubernetes/Cloud Run health check conventions.
 *
 * @module shared/middleware/healthz
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */
'use strict';

const { PHI } = require('../../../core/constants/phi');

const bootTime = Date.now();

/**
 * Create healthz middleware for Express apps.
 * @param {object} opts
 * @param {string} opts.service - Service name
 * @param {string} opts.version - Service version
 * @param {Function[]} [opts.readinessChecks] - Async functions that throw on failure
 * @returns {Function} Express middleware
 */
function createHealthzMiddleware(opts = {}) {
  const { service = 'heady-service', version = '4.1.0', readinessChecks = [] } = opts;

  return function healthzRouter(req, res, next) {
    const path = req.path;

    if (path === '/healthz' || path === '/health') {
      return res.status(200).json({
        status: 'healthy',
        service,
        version,
        uptime_ms: Date.now() - bootTime,
        phi: PHI,
        timestamp: new Date().toISOString(),
      });
    }

    if (path === '/readiness' || path === '/ready') {
      return Promise.all(readinessChecks.map(check => check()))
        .then(() => {
          res.status(200).json({
            status: 'ready',
            service,
            checks_passed: readinessChecks.length,
            timestamp: new Date().toISOString(),
          }}).catch(err => { /* promise error absorbed */ });
        })
        .catch(err => {
          res.status(503).json({
            status: 'not_ready',
            service,
            error: err.message,
            timestamp: new Date().toISOString(),
          });
        });
    }

    if (path === '/startup') {
      return res.status(200).json({
        status: 'started',
        service,
        version,
        boot_time_ms: Date.now() - bootTime,
        timestamp: new Date().toISOString(),
      });
    }

    if (next) return next();
  };
}

module.exports = { createHealthzMiddleware };
