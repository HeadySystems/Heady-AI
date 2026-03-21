'use strict';

const http = require('node:http');
const express = require('express');
const helmet = require('helmet');
const { ChannelManager } = require('./channels');
const { createWebSocketServer } = require('./websocket');
const { createSSEHandler } = require('./sse');

const PORT = parseInt(process.env.PORT, 10) || 3381;
const SERVICE_NAME = 'notification-service';
const startTime = Date.now();

// Structured JSON logger
const log = {
  _write(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      message,
      ...meta,
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
  },
  info(msg, meta) { this._write('info', msg, meta); },
  warn(msg, meta) { this._write('warn', msg, meta); },
  error(msg, meta) { this._write('error', msg, meta); },
  debug(msg, meta) { this._write('debug', msg, meta); },
};

// Token validation stub — in production, calls auth-session-server or validates JWT
async function validateToken(token) {
  if (!token || typeof token !== 'string' || token.length < 10) {
    throw new Error('Invalid token format');
  }
  const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
  const response = await fetch(`${AUTH_SERVICE_URL}/session/me`, {
    headers: { Cookie: `__Host-heady_session=${token}` },
  });
  if (!response.ok) {
    throw new Error(`Auth validation failed: ${response.status}`);
  }
  const data = await response.json();
  return data.user;
}

const channelManager = new ChannelManager(log);
const app = express();

app.set('trust proxy', true);
app.use(helmet());
app.use(express.json({ limit: '256kb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log.info('request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latency: Date.now() - start,
    });
  });
  next();
});

// Health endpoint
app.get('/health', (req, res) => {
  const stats = channelManager.getStats();
  res.json({
    status: 'healthy',
    service: SERVICE_NAME,
    version: '1.0.0',
    uptime: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    checks: [
      { name: 'websocket', status: 'healthy', latency: 0, detail: 'running' },
      { name: 'sse', status: 'healthy', latency: 0, detail: 'running' },
    ],
    stats,
  });
});

// SSE endpoint
app.get('/events', createSSEHandler({ validateToken, channelManager, log }));

// POST /broadcast — internal endpoint to send to a channel
app.post('/broadcast', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    res.status(403).json({
      code: 'HEADY-NOTIF-003',
      message: 'Invalid API key',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const { channel, payload } = req.body;
  if (!channel || !payload) {
    res.status(400).json({
      code: 'HEADY-NOTIF-004',
      message: 'channel and payload required',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const notified = channelManager.broadcast(channel, payload);
  res.json({ channel, notified });
});

// POST /notify — internal endpoint to send direct message
app.post('/notify', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    res.status(403).json({
      code: 'HEADY-NOTIF-005',
      message: 'Invalid API key',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const { userId, payload } = req.body;
  if (!userId || !payload) {
    res.status(400).json({
      code: 'HEADY-NOTIF-006',
      message: 'userId and payload required',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const delivered = channelManager.directMessage(userId, payload);
  res.json({ userId, delivered });
});

// Create HTTP server and attach WebSocket
const server = http.createServer(app);

createWebSocketServer({
  server,
  validateToken,
  channelManager,
  log,
});

// Graceful shutdown
function shutdown(signal) {
  log.info('Shutdown initiated', { signal });
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    log.warn('Forced shutdown');
    process.exit(1);
  }, 13000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, () => {
  log.info('Server started', { port: PORT, service: SERVICE_NAME });
});

module.exports = app;


// --- Auto-Unified Latent Service Pattern (Smart) ---
(function _wireLatentStubs() {
  const exp = module.exports;
  if (!exp || typeof exp !== 'object') return;

  // Find the first exported class instance or constructor with health/start/stop
  let _inst = null;
  for (const key of Object.keys(exp)) {
    const val = exp[key];
    // If it's a singleton instance with a health method, use it
    if (val && typeof val === 'object' && typeof val.health === 'function') {
      _inst = val; break;
    }
    // If it's a function (class constructor), try to find a getSingleton pattern
    if (typeof val === 'function' && val.prototype) {
      const getterKey = Object.keys(exp).find(k =>
        k.startsWith('get') && typeof exp[k] === 'function' && k !== key
      );
      if (getterKey) {
        try { const inst = exp[getterKey](); if (inst && typeof inst.health === 'function') { _inst = inst; break; } } catch(e) {}
      }
    }
  }

  if (!exp.start) exp.start = _inst && typeof _inst.start === 'function'
    ? async () => { await _inst.start(); return { status: 'started' }; }
    : async () => ({ status: 'started' });
  if (!exp.stop) exp.stop = _inst && typeof _inst.stop === 'function'
    ? async () => { await _inst.stop(); return { status: 'stopped' }; }
    : async () => ({ status: 'stopped' });
  if (!exp.health) exp.health = _inst && typeof _inst.health === 'function'
    ? () => _inst.health()
    : () => ({ status: 'healthy', service: require('path').basename(__filename, '.js') });
  if (!exp.metrics) exp.metrics = _inst && typeof _inst.metrics === 'function'
    ? () => _inst.metrics()
    : () => ({ service: require('path').basename(__filename, '.js') });
  if (!exp._tick) exp._tick = async () => {};
})();
// -------------------------------------------
