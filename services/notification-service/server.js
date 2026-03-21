'use strict';
/**
 * notification-service — Email, webhook, and push notification dispatch — φ-batched delivery
 * © 2026 HeadySystems Inc.
 */

const express = require('express');
const { getLogger } = require('../../packages/shared/structured-logger');

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;
const PORT = process.env.PORT || 3411;
const logger = getLogger('notification-service');

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
  service: 'notification-service',
  status: 'healthy',
  uptime: process.uptime(),
  phi: PHI,
  timestamp: new Date().toISOString(),
}));

// ─── Routes ──────────────────────────────────────────────────────────
app.all('/notify/email', (req, res) => res.json({ service: 'notification-service', route: '/notify/email', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/notify/webhook', (req, res) => res.json({ service: 'notification-service', route: '/notify/webhook', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/notify/push', (req, res) => res.json({ service: 'notification-service', route: '/notify/push', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/notify/batch', (req, res) => res.json({ service: 'notification-service', route: '/notify/batch', status: 'ready', timestamp: new Date().toISOString() }));

// ─── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`notification-service listening on port ${PORT}`);
});

module.exports = app;
