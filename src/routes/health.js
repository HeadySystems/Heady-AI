// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/routes/health.js                                        ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const express = require('express');

function createHealthRouter({ getHealthState, getPulseState }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: Service health check
   *     responses:
   *       200:
   *         description: Service is healthy
   */
  router.get('/api/health', (req, res) => {
    res.json(getHealthState());
  });

  /**
   * @swagger
   * /api/pulse:
   *   get:
   *     summary: Service pulse check
   *     responses:
   *       200:
   *         description: Service is active
   */
  router.get('/api/pulse', (req, res) => {
    res.json(getPulseState());
  });

  // Root health endpoint (before SPA fallback)
  router.get('/health', (req, res) => {
    res.redirect('/api/health');
  });

  // Alias required by render.yaml healthCheckPath
  router.get('/api/brain/health', (req, res) => {
    res.json(getHealthState());
  });

  // Standard Cloud Run /healthz endpoint (Kubernetes convention)
  router.get('/healthz', (req, res) => {
    res.json(getHealthState());
  });

  // Readiness probe
  router.get('/readiness', (req, res) => {
    res.json({
      status: 'ready',
      service: 'heady-manager',
      version: '4.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Startup probe
  router.get('/startup', (req, res) => {
    res.json({
      status: 'started',
      service: 'heady-manager',
      version: '4.1.0',
      uptime_ms: process.uptime() * 1000,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

module.exports = {
  createHealthRouter
};
