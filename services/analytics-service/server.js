'use strict';
/**
 * analytics-service — Usage tracking and phi-harmonic metrics aggregation
 * © 2026 HeadySystems Inc.
 */

const express = require('express');
const { getLogger } = require('../../packages/shared/structured-logger');

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;
const PORT = process.env.PORT || 3412;
const logger = getLogger('analytics-service');

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
  service: 'analytics-service',
  status: 'healthy',
  uptime: process.uptime(),
  phi: PHI,
  timestamp: new Date().toISOString(),
}));

// ─── Routes ──────────────────────────────────────────────────────────
app.all('/analytics/event', (req, res) => res.json({ service: 'analytics-service', route: '/analytics/event', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/analytics/query', (req, res) => res.json({ service: 'analytics-service', route: '/analytics/query', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/analytics/dashboard', (req, res) => res.json({ service: 'analytics-service', route: '/analytics/dashboard', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/analytics/export', (req, res) => res.json({ service: 'analytics-service', route: '/analytics/export', status: 'ready', timestamp: new Date().toISOString() }));

// ─── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`analytics-service listening on port ${PORT}`);
});

module.exports = app;
