'use strict';

/**
 * HeadyVector Server Entry Point
 * Boots Express + HeadyVector service.
 * CommonJS, Node.js 20+.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const config = require('./config');
const { getInstance } = require('./index');
const { createRouter } = require('./routes');

// ── Structured logging helpers ──────────────────────────────────────────────
const SVC = 'heady-vector';
function structuredLog(event, data = {}) {
  process.stdout.write(JSON.stringify({ service: SVC, event, ...data, ts: new Date().toISOString() }) + '\n');
}
function structuredError(event, data = {}) {
  process.stderr.write(JSON.stringify({ service: SVC, event, ...data, ts: new Date().toISOString() }) + '\n');
}

async function main() {
  // ── Initialize HeadyVector ─────────────────────────────────────────────────
  const hv = getInstance();
  await hv.start();

  // ── Express setup ──────────────────────────────────────────────────────────
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false, // API service, not serving HTML
  }));
  app.use(cors({
    origin: process.env.CORS_ORIGIN || process.env.HEADY_CORS_ORIGINS || 'https://headyme.com',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
    credentials: true,
  }));
  app.use(compression());
  app.use(express.json({ limit: '50mb' })); // Large batch upserts
  app.use(express.urlencoded({ extended: true }));

  // Request logging (lightweight, structured)
  if (config.nodeEnv !== 'test') {
    app.use((req, _res, next) => {
      if (req.path !== '/health/live' && req.path !== '/health/ready') {
        structuredLog('request', { method: req.method, path: req.path });
      }
      next();
    });
  }

  // ── Mount router ───────────────────────────────────────────────────────────
  app.use('/', createRouter(hv));

  // ── Start server ───────────────────────────────────────────────────────────
  const server = app.listen(config.port, config.host, () => {
    structuredLog('listening', { host: config.host, port: config.port, phi: config.phi, nodeVersion: process.version });
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    structuredLog('shutdown_requested', { signal });
    server.close(async () => {
      await hv.stop();
      structuredLog('closed');
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    structuredError('unhandled_rejection', { error: String(reason) });
  });

  return { app, server, hv };
}

main().catch((err) => {
  structuredError('fatal_startup_error', { error: err.message });
  process.exit(1);
});

module.exports = { main };
