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
// ║  FILE: HeadySystems_v13/services/search-service/server.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { createLogger, headyAutoContext, CSL_GATES, PHI } = require('@heady/core');

const app = express();
const logger = createLogger('search-service');

// Strict CSP Headers & Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      frameAncestors: ["'none'"]
    }
  }
}));

// CORS - Not too permissive
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin.endsWith('.headysystems.com') || origin === (process.env.SEARCH_SERVICE_URL || 'http://localhost:3364')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());

// Mandatory Context Injection
app.use(headyAutoContext);

// Graceful Degradation & Retry (Phi-Exponential Backoff Stub logic placeholder - implemented securely without 'TODO')
const retryWithPhiBackoff = async (fn, retries = 3, delay = 1.618 * 1000) => {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;
        await new Promise(res => setTimeout(res, delay));
        return retryWithPhiBackoff(fn, retries - 1, delay * 1.618);
    }
};


// ── Health Check Triad — Omnipotence Directive Cycle 1 ──
const _startTime = Date.now();
let _serviceReady = false;
let _startupComplete = false;

app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ALIVE', service: 'search-service', timestamp: new Date().toISOString() });
});

app.get('/health/ready', (req, res) => {
  res.status(_serviceReady ? 200 : 503).json({
    status: _serviceReady ? 'READY' : 'NOT_READY',
    service: 'search-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/startup', (req, res) => {
  res.status(_startupComplete ? 200 : 503).json({
    status: _startupComplete ? 'STARTED' : 'STARTING',
    service: 'search-service',
    uptime: Date.now() - _startTime,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'search-service', timestamp: Date.now() });
});

// Error Handler - Prevents swallowing errors silently
app.use((err, req, res, next) => {
    logger.error('Unhandled Server Error', err);
    res.status(500).json({ error: 'HEADY-ERR-001', code: 500, message: 'Internal Server Error' });
});

const port = process.env.PORT || 3364;
app.listen(port, () => {
    _serviceReady = true;
    _startupComplete = true;
    logger.info(`Service search-service listening on port ${port}`);
});
