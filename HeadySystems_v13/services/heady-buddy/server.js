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
// ║  FILE: HeadySystems_v13/services/heady-buddy/server.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { createLogger, headyAutoContext, CSL_GATES, PHI } = require('@heady/core');

const app = express();
const logger = createLogger('heady-buddy');

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

// CORS — allow all 9 Heady domains + headybuddy.org
const HEADY_DOMAINS = [
    '.headysystems.com',
    '.headyconnection.org',
    '.headyconnection.com',
    'headyme.com',
    'headybuddy.org',
    'headyio.com',
    'headybot.com',
    'headyapi.com',
    'heady-ai.com',
    'headyos.com',
    'headyex.com',
    'headyfinance.com',
    'headycloud.com',
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || HEADY_DOMAINS.some(d => origin.endsWith(d) || origin.includes(d))) {
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
  res.status(200).json({ status: 'ALIVE', service: 'heady-buddy', timestamp: new Date().toISOString() });
});

app.get('/health/ready', (req, res) => {
  res.status(_serviceReady ? 200 : 503).json({
    status: _serviceReady ? 'READY' : 'NOT_READY',
    service: 'heady-buddy',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/startup', (req, res) => {
  res.status(_startupComplete ? 200 : 503).json({
    status: _startupComplete ? 'STARTED' : 'STARTING',
    service: 'heady-buddy',
    uptime: Date.now() - _startTime,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'heady-buddy', timestamp: Date.now() });
});

// ── Buddy Chat Proxy — forwards /api/buddy/chat to /api/brain/chat ──
// Legacy widgets call /api/buddy/chat; new widget calls /api/brain/chat directly.
// This proxy ensures backward compatibility.
const https = require('https');
const BRAIN_API = process.env.HEADY_BRAIN_API || 'https://api.headysystems.com';

app.post('/api/buddy/chat', async (req, res) => {
    try {
        const { message, domain, user, history, session_id } = req.body;
        const response = await retryWithPhiBackoff(async () => {
            const payload = JSON.stringify({ message, user: user || 'anonymous', history: history || [], session_id });
            return new Promise((resolve, reject) => {
                const url = new URL(BRAIN_API + '/api/brain/chat');
                const reqOpts = {
                    hostname: url.hostname,
                    port: url.port || 443,
                    path: url.pathname,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
                    timeout: 13000
                };
                const r = https.request(reqOpts, (resp) => {
                    let data = '';
                    resp.on('data', chunk => data += chunk);
                    resp.on('end', () => {
                        try { resolve(JSON.parse(data)); }
                        catch { resolve({ response: data }); }
                    });
                });
                r.on('error', reject);
                r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
                r.write(payload);
                r.end();
            });
        });
        return res.json({
            ok: true,
            reply: response.response || response.reply || response.message || 'HeadyBuddy is here to help.',
            response: response.response,
            session_id: response.session_id
        });
    } catch (err) {
        logger.error('Buddy chat proxy error', err);
        return res.status(502).json({ error: 'HEADY-ERR-BUDDY', reply: 'HeadyBuddy is connecting to the neural network. Try again in a moment.' });
    }
});

// Error Handler - Prevents swallowing errors silently
app.use((err, req, res, next) => {
    logger.error('Unhandled Server Error', err);
    res.status(500).json({ error: 'HEADY-ERR-001', code: 500, message: 'Internal Server Error' });
});

const port = process.env.PORT || 3338;
app.listen(port, () => {
    _serviceReady = true;
    _startupComplete = true;
    logger.info(`Service heady-buddy listening on port ${port}`);
});
