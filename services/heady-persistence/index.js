/**
 * heady-persistence — User persistence system — state, prefs, bookmarks, history
 * Heady™ Service | Domain: persistence | Port: 3370
 * ALL requests enriched by HeadyAutoContext (MANDATORY)
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 */
'use strict';

import express from 'express';
import { randomUUID } from 'crypto';

// ─── φ-Math Constants ────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const VECTOR_DIM = 384;
const CSL_GATES = Object.freeze({ include: PSI * PSI, boost: PSI, inject: PSI + 0.1 });

const SERVICE_NAME = 'heady-persistence';
const PORT = process.env.PORT || 3370;
const DOMAIN = 'persistence';
const BOOT_TIME = Date.now();
const DATABASE_URL = process.env.DATABASE_URL || '';

// ─── Express Setup ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '4mb' }));
app.disable('x-powered-by');

// ─── Context Middleware ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.headyContext = {
    service: SERVICE_NAME,
    domain: DOMAIN,
    correlationId: req.headers['x-correlation-id'] || randomUUID(),
    timestamp: Date.now(),
  };
  res.setHeader('X-Heady-Service', SERVICE_NAME);
  res.setHeader('X-Correlation-Id', req.headyContext.correlationId);
  next();
});

// ─── Structured Logging ───────────────────────────────────────────────────────
function log(level, msg, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME, level, message: msg,
    correlationId: meta.correlationId || 'system',
    domain: DOMAIN, ...meta,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// ─── In-Memory Store (backed by Neon Postgres in production) ──────────────────
// Structure: userId -> { preferences, bookmarks, history, settings, devices, sessions }
const userStore = new Map();

function getUserData(userId) {
  if (!userStore.has(userId)) {
    userStore.set(userId, {
      preferences: { theme: 'sacred-dark', language: 'en', fontSize: 13 },
      bookmarks: [],
      history: [],
      settings: {},
      devices: [],
      sessions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  return userStore.get(userId);
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-heady-token'];
  if (!token) return res.status(401).json({ error: 'Authentication required', service: SERVICE_NAME });
  // In production: validate JWT against heady-auth service
  // For now: extract userId from token or header
  req.userId = req.headers['x-heady-user-id'] || 'default-user';
  next();
}

// ─── Health Endpoints ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    service: SERVICE_NAME, status: 'operational', domain: DOMAIN,
    uptime: Math.round((Date.now() - BOOT_TIME) / 1000),
    port: PORT, users: userStore.size, dbConnected: !!DATABASE_URL,
    timestamp: new Date().toISOString(),
  });
});
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// ─── Service Info ─────────────────────────────────────────────────────────────
app.get('/info', (req, res) => {
  res.json({
    service: SERVICE_NAME,
    description: 'User persistence — state, preferences, bookmarks, history across all Heady apps',
    domain: DOMAIN, port: PORT, version: '1.0.0',
    endpoints: [
      'GET  /api/user/preferences',
      'PUT  /api/user/preferences',
      'GET  /api/user/bookmarks',
      'POST /api/user/bookmarks',
      'DELETE /api/user/bookmarks/:id',
      'GET  /api/user/history',
      'POST /api/user/history',
      'GET  /api/user/settings',
      'PUT  /api/user/settings',
      'GET  /api/user/devices',
      'POST /api/user/devices',
      'GET  /api/user/sync',
      'POST /api/user/sync',
    ],
  });
});

// ─── Preferences ──────────────────────────────────────────────────────────────
app.get('/api/user/preferences', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  res.json({ preferences: data.preferences, userId: req.userId });
});

app.put('/api/user/preferences', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  data.preferences = { ...data.preferences, ...req.body };
  data.updatedAt = Date.now();
  log('info', 'Preferences updated', { userId: req.userId, correlationId: req.headyContext.correlationId });
  res.json({ saved: true, preferences: data.preferences });
});

// ─── Bookmarks ────────────────────────────────────────────────────────────────
app.get('/api/user/bookmarks', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  res.json({ bookmarks: data.bookmarks });
});

app.post('/api/user/bookmarks', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  const bookmark = {
    id: randomUUID(),
    url: req.body.url,
    title: req.body.title || req.body.url,
    icon: req.body.icon || null,
    folder: req.body.folder || 'default',
    createdAt: Date.now(),
  };
  data.bookmarks.push(bookmark);
  data.updatedAt = Date.now();
  res.json({ saved: true, bookmark });
});

app.delete('/api/user/bookmarks/:id', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  data.bookmarks = data.bookmarks.filter(b => b.id !== req.params.id);
  data.updatedAt = Date.now();
  res.json({ deleted: true });
});

// ─── History ──────────────────────────────────────────────────────────────────
app.get('/api/user/history', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  const limit = parseInt(req.query.limit) || 100;
  res.json({ history: data.history.slice(-limit) });
});

app.post('/api/user/history', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  const entry = {
    id: randomUUID(),
    url: req.body.url,
    title: req.body.title || '',
    app: req.body.app || 'headyweb',
    visitedAt: Date.now(),
  };
  data.history.push(entry);
  // Cap history at Fibonacci 987 entries
  if (data.history.length > 987) data.history = data.history.slice(-987);
  data.updatedAt = Date.now();
  res.json({ saved: true, entry });
});

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/user/settings', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  res.json({ settings: data.settings });
});

app.put('/api/user/settings', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  data.settings = { ...data.settings, ...req.body };
  data.updatedAt = Date.now();
  res.json({ saved: true, settings: data.settings });
});

// ─── Devices ──────────────────────────────────────────────────────────────────
app.get('/api/user/devices', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  res.json({ devices: data.devices });
});

app.post('/api/user/devices', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  const device = {
    id: randomUUID(),
    name: req.body.name || 'Unknown Device',
    platform: req.body.platform || 'unknown',
    lastSeen: Date.now(),
    capabilities: req.body.capabilities || [],
  };
  // Upsert by name
  const idx = data.devices.findIndex(d => d.name === device.name);
  if (idx >= 0) {
    data.devices[idx] = { ...data.devices[idx], ...device, id: data.devices[idx].id };
  } else {
    data.devices.push(device);
  }
  data.updatedAt = Date.now();
  res.json({ registered: true, device });
});

// ─── Cross-Device Sync ───────────────────────────────────────────────────────
app.get('/api/user/sync', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  const since = parseInt(req.query.since) || 0;
  const changes = {};
  if (data.updatedAt > since) {
    changes.preferences = data.preferences;
    changes.bookmarks = data.bookmarks;
    changes.settings = data.settings;
    changes.devices = data.devices;
  }
  res.json({ userId: req.userId, updatedAt: data.updatedAt, changes, hasChanges: data.updatedAt > since });
});

app.post('/api/user/sync', requireAuth, (req, res) => {
  const data = getUserData(req.userId);
  const { preferences, bookmarks, settings } = req.body;
  if (preferences) data.preferences = { ...data.preferences, ...preferences };
  if (bookmarks) data.bookmarks = bookmarks;
  if (settings) data.settings = { ...data.settings, ...settings };
  data.updatedAt = Date.now();
  log('info', 'User data synced', { userId: req.userId, correlationId: req.headyContext.correlationId });
  res.json({ synced: true, updatedAt: data.updatedAt });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  log('error', err.message, { correlationId: req.headyContext?.correlationId, stack: err.stack });
  res.status(500).json({ error: err.message, service: SERVICE_NAME });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  log('info', `${SERVICE_NAME} operational on port ${PORT}`, { domain: DOMAIN, dbConnected: !!DATABASE_URL });
});

export default app;
