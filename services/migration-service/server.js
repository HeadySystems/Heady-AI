'use strict';
/**
 * migration-service — Database migrations and pgvector schema versioning
 * © 2026 HeadySystems Inc.
 */

const express = require('express');
const { getLogger } = require('../../packages/shared/structured-logger');

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;
const PORT = process.env.PORT || 3416;
const logger = getLogger('migration-service');

const app = express();
app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ─── Health ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  service: 'migration-service',
  status: 'healthy',
  uptime: process.uptime(),
  phi: PHI,
  timestamp: new Date().toISOString(),
}));

// ─── Routes ──────────────────────────────────────────────────────────
app.all('/migrations/run', (req, res) => res.json({ service: 'migration-service', route: '/migrations/run', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/migrations/rollback', (req, res) => res.json({ service: 'migration-service', route: '/migrations/rollback', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/migrations/status', (req, res) => res.json({ service: 'migration-service', route: '/migrations/status', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/migrations/plan', (req, res) => res.json({ service: 'migration-service', route: '/migrations/plan', status: 'ready', timestamp: new Date().toISOString() }));

// ─── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`migration-service listening on port ${PORT}`);
});

module.exports = app;
