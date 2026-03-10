'use strict';

/**
 * HeadyGateway — Unified API Gateway for all Heady™ Native Services
 * Routes requests to the appropriate service based on path prefix.
 * Sacred Geometry Architecture v3.0.0
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { securityHeaders } = require('../shared/security-headers');
const compression = require('compression');
const logger = require('../shared/logger')('api-gateway');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const PSI2 = PSI * PSI;

// Service imports
const embedRoutes = require('./services/heady-embed/routes');
const inferRoutes = require('./services/heady-infer/routes');
const vectorRoutes = require('./services/heady-vector/routes');
const chainRoutes = require('./services/heady-chain/routes');
const cacheRoutes = require('./services/heady-cache/routes');
const guardRoutes = require('./services/heady-guard/routes');
const evalRoutes = require('./services/heady-eval/routes');

const PORT = parseInt(process.env.HEADY_GATEWAY_PORT || '3100', 10);
const DEFAULT_ALLOWED_ORIGINS = [
  'https://heady-onboarding-609590223909.us-east1.run.app',
  'https://heady-ide-bf4q4zywhq-ue.a.run.app',
  'https://headysystems.com',
];

function logEvent(level, event, details = {}) {
  const payload = { event, ...details };
  if (level === 'error') {
    logger.error(payload);
    return;
  }
  logger.info(payload);
}

function buildCorsPolicy() {
  const origins = (process.env.HEADY_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const allowedOrigins = origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS denied for origin: ${origin}`));
    },
    credentials: true,
    optionsSuccessStatus: 204,
  };
}

const SERVICES = [
  { name: 'HeadyEmbed', prefix: '/embed', port: 3101, status: 'unknown' },
  { name: 'HeadyInfer', prefix: '/infer', port: 3102, status: 'unknown' },
  { name: 'HeadyVector', prefix: '/vector', port: 3103, status: 'unknown' },
  { name: 'HeadyChain', prefix: '/chain', port: 3104, status: 'unknown' },
  { name: 'HeadyCache', prefix: '/cache', port: 3105, status: 'unknown' },
  { name: 'HeadyGuard', prefix: '/guard', port: 3106, status: 'unknown' },
  { name: 'HeadyEval', prefix: '/eval', port: 3107, status: 'unknown' },
];

function createGateway() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors(buildCorsPolicy()));
  app.use(securityHeaders());
  app.use(compression());
  app.use(express.json({ limit: '50mb' }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logEvent('info', 'request.completed', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
      });
    });
    next();
  });

  // Service routes
  app.use('/api/v1/embed', embedRoutes);
  app.use('/api/v1/infer', inferRoutes);
  app.use('/api/v1/vector', vectorRoutes);
  app.use('/api/v1/chain', chainRoutes);
  app.use('/api/v1/cache', cacheRoutes);
  app.use('/api/v1/guard', guardRoutes);
  app.use('/api/v1/eval', evalRoutes);

  // Gateway health
  app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    res.json({
      status: 'healthy',
      service: 'HeadyGateway',
      version: '1.0.0',
      architecture: 'Sacred Geometry v3.0.0',
      phi: PHI,
      uptime: `${Math.floor(uptime)}s`,
      memory: {
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      },
      services: SERVICES,
      timestamp: new Date().toISOString(),
    });
  });

  // Service registry
  app.get('/services', (req, res) => {
    res.json({
      gateway: { port: PORT, version: '1.0.0' },
      services: SERVICES.map(s => ({
        name: s.name,
        prefix: `/api/v1${s.prefix}`,
        standalone_port: s.port,
        health: `/api/v1${s.prefix}/health`,
      })),
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      available_prefixes: SERVICES.map(s => `/api/v1${s.prefix}`),
      csl_confidence: PSI2,
    });
  });

  // Error handler
  app.use((err, req, res, _next) => {
    logEvent('error', 'request.error', {
      method: req.method,
      path: req.originalUrl,
      error: err.message,
    });
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      service: 'HeadyGateway',
    });
  });

  return app;
}

// Start if run directly
if (require.main === module) {
  const app = createGateway();
  const gatewayUrl = process.env.HEADY_GATEWAY_PUBLIC_URL || 'https://heady-onboarding-609590223909.us-east1.run.app';
  const server = app.listen(PORT, () => {
    logEvent('info', 'gateway.started', {
      port: PORT,
      publicUrl: gatewayUrl,
      phi: PHI,
      cslGate: PSI,
      services: SERVICES,
    });
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    logEvent('info', 'gateway.shutdown.initiated', { signal });
    server.close(() => {
      logEvent('info', 'gateway.shutdown.complete');
      process.exit(0);
    });
    setTimeout(() => {
      logEvent('error', 'gateway.shutdown.forced', { timeoutMs: 10000 });
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { createGateway };
