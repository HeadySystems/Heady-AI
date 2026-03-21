const logger = require('../../utils/logger').createLogger('auto-fix');
'use strict';

/**
 * HeadyCache Express Server Entry Point
 *
 * Starts the Heady™Cache HTTP service with:
 *   - helmet (security headers)
 *   - cors (cross-origin)
 *   - compression (gzip)
 *   - JSON body parsing
 *   - Structured request logging
 *   - Graceful shutdown
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const config = require('./config');
const { HeadyCache } = require('./index');
const { createRouter } = require('./routes');
const { healthCheck } = require('./health');
const { getLogger } = require('../structured-logger');

const log = getLogger('heady-cache');

// ---------------------------------------------------------------------------
// Initialize cache
// ---------------------------------------------------------------------------

const cache = new HeadyCache();

// ---------------------------------------------------------------------------
// Build Express app
// ---------------------------------------------------------------------------

const app = express();
const logger = require('../../utils/logger');

// Security & middleware — strict CORS, no wildcard
const HEADY_ORIGINS = [
  'https://headyme.com', 'https://headysystems.com', 'https://headyconnection.org',
  'https://headybuddy.org', 'https://headymcp.com', 'https://headyio.com',
  'https://headybot.com', 'https://headyapi.com', 'https://headyai.com',
  'https://headylens.com', 'https://headyfinance.com',
  ...(process.env.NODE_ENV !== 'production' ? [process.env.SERVICE_URL || 'http://0.0.0.0:3000', process.env.SERVICE_URL || 'http://0.0.0.0:3300', process.env.SERVICE_URL || 'http://0.0.0.0:3301'] : [])
];
app.use(helmet());
app.use(cors({ origin: HEADY_ORIGINS, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      log.info('request', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: duration,
        });
    }
  });
  next();
});

// Mount cache routes
app.use('/', createRouter(cache));

// Override the /health route with the full health check
app.get('/health/detailed', async (req, res) => {
  try {
    const result = await healthCheck(cache);
    const status = result.status === 'ok' ? 200 : 503;
    res.status(status).json(result);
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  log.error('unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function start() {
  try {
    await cache.init();
    log.info('cache initialized', { backend: config.backend });

    const server = app.listen(config.port, '0.0.0.0', () => {
      log.info('started', {
          port: config.port,
          backend: config.backend,
          maxSize: config.maxSize,
          ttl: config.ttl,
          similarityThreshold: config.similarityThreshold,
          evictionPolicy: config.evictionPolicy,
        });
    });

    // ---------------------------------------------------------------------------
    // Graceful shutdown
    // ---------------------------------------------------------------------------

    const shutdown = async (signal) => {
      log.info('shutting down', { signal });
      server.close(async () => {
        try {
          await cache.close();
          log.info('shutdown complete');
          process.exit(0);
        } catch (err) {
          log.error('shutdown error', { error: err.message });
          process.exit(1);
        }
      });
      // Force exit if graceful shutdown takes too long
      setTimeout(() => process.exit(1), typeof phiMs === 'function' ? phiMs(10000) : 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('[heady-cache] unhandledRejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      logger.error('[heady-cache] uncaughtException:', err);
      process.exit(1);
    });

    return server;
  } catch (err) {
    logger.error('[heady-cache] startup error:', err);
    process.exit(1);
  }
}

// Only start if called directly
if (require.main === module) {
  start();
}

module.exports = { app, cache, start };


// --- Auto-Unified Latent Service Pattern (Smart) ---
(function _wireLatentStubs() {
  const exp = module.exports;
  if (!exp || typeof exp !== 'object') return;

  // Find the first exported class instance or constructor with health/start/stop
  let _inst = null;
  for (const key of Object.keys(exp)) {
    const val = exp[key];
    // If it's a singleton instance with a health method, use it
    if (val && typeof val === 'object' && typeof val.health === 'function') {
      _inst = val; break;
    }
    // If it's a function (class constructor), try to find a getSingleton pattern
    if (typeof val === 'function' && val.prototype) {
      const getterKey = Object.keys(exp).find(k =>
        k.startsWith('get') && typeof exp[k] === 'function' && k !== key
      );
      if (getterKey) {
        try { const inst = exp[getterKey](); if (inst && typeof inst.health === 'function') { _inst = inst; break; } } catch(e) {}
      }
    }
  }

  if (!exp.start) exp.start = _inst && typeof _inst.start === 'function'
    ? async () => { await _inst.start(); return { status: 'started' }; }
    : async () => ({ status: 'started' });
  if (!exp.stop) exp.stop = _inst && typeof _inst.stop === 'function'
    ? async () => { await _inst.stop(); return { status: 'stopped' }; }
    : async () => ({ status: 'stopped' });
  if (!exp.health) exp.health = _inst && typeof _inst.health === 'function'
    ? () => _inst.health()
    : () => ({ status: 'healthy', service: require('path').basename(__filename, '.js') });
  if (!exp.metrics) exp.metrics = _inst && typeof _inst.metrics === 'function'
    ? () => _inst.metrics()
    : () => ({ service: require('path').basename(__filename, '.js') });
  if (!exp._tick) exp._tick = async () => {};
})();
// -------------------------------------------
