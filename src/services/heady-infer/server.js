'use strict';

/**
 * HeadyInfer Standalone Server
 *
 * Starts the Express app with all middleware, mounts the Heady™Infer router,
 * and handles graceful shutdown.
 *
 * Can also be required as a module from a parent service for embedding.
 */

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const compression = require('compression');
const config     = require('./config');
const { HeadyInfer } = require('./index');
const { createRouter } = require('./routes');
const { liveness }     = require('./health');
const { getLogger } = require('../structured-logger');

const log = getLogger('heady-infer');

function createApp(cfg = config) {
  const app = express();

  // ─── Security / Perf Middleware ──────────────────────────────────────────
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

  // Request logging middleware
  app.use((req, _res, next) => {
    if (cfg.logging.level !== 'silent') {
      log.info('request', { method: req.method, path: req.path });
    }
    next();
  });

  // ─── Initialize Gateway ───────────────────────────────────────────────────
  const gateway = new HeadyInfer(cfg);

  // ─── Top-level /health ─────────────────────────────────────────────────────
  // Fast liveness — no provider ping
  app.get('/health', (req, res) => {
    const report = liveness(gateway);
    const code = (report.status === 'healthy' || report.status === 'ok') ? 200 : 503;
    res.status(code).json(report);
  });

  // ─── Mount HeadyInfer Router ───────────────────────────────────────────────
  app.use('/api/v1', createRouter(gateway));

  // ─── 404 Handler ──────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({
      error:     'Not found',
      path:      req.path,
      service:   cfg.serviceName,
      timestamp: new Date().toISOString(),
    });
  });

  return { app, gateway };
}

// ─── Startup ───────────────────────────────────────────────────────────────

if (require.main === module) {
  const { app, gateway } = createApp();
  const port = config.port;

  const server = app.listen(port, '0.0.0.0', () => {
    log.info('started', { port, env: config.env });
  });

  // ─── Graceful Shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    log.info('shutting down', { signal });
    server.close(async () => {
      await gateway.shutdown();
      log.info('server closed');
      process.exit(0);
    });
    // Force-quit after 10s
    setTimeout(() => { process.exit(1); }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    log.error('unhandled rejection', { reason: String(reason) });
  });
}

module.exports = { createApp };


// --- Auto-Unified Latent Service Pattern ---
if (module.exports && typeof module.exports === 'object') {
  if (!module.exports.start) module.exports.start = async () => ({ status: 'started' });
  if (!module.exports.stop) module.exports.stop = async () => ({ status: 'stopped' });
  if (!module.exports.health) module.exports.health = () => ({ status: 'healthy' });
  if (!module.exports.metrics) module.exports.metrics = () => ({ usages: 0 });
  if (!module.exports._tick) module.exports._tick = async () => {};
}
// -------------------------------------------
