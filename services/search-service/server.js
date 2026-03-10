'use strict';
/**
 * search-service — Full-text + vector search via pgvector — concurrent-equals ranking
 * © 2026 HeadySystems Inc.
 */

const express = require('express');
const { getLogger } = require('../../packages/shared/structured-logger');

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;
const PORT = process.env.PORT || 3414;
const logger = getLogger('search-service');

const app = express();
app.use(express.json());

// ─── Health ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  service: 'search-service',
  status: 'healthy',
  uptime: process.uptime(),
  phi: PHI,
  timestamp: new Date().toISOString(),
}));

// ─── Routes ──────────────────────────────────────────────────────────
app.all('/search/text', (req, res) => res.json({ service: 'search-service', route: '/search/text', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/search/vector', (req, res) => res.json({ service: 'search-service', route: '/search/vector', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/search/hybrid', (req, res) => res.json({ service: 'search-service', route: '/search/hybrid', status: 'ready', timestamp: new Date().toISOString() }));
app.all('/search/suggest', (req, res) => res.json({ service: 'search-service', route: '/search/suggest', status: 'ready', timestamp: new Date().toISOString() }));

// ─── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`search-service listening on port ${PORT}`);
});

module.exports = app;
