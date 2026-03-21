// HEADY_BRAND:BEGIN
// ║  ∞ SACRED GEOMETRY ∞  Notification Service Routes
// ║  FILE: src/routes/notification-routes.js
// HEADY_BRAND:END

const express = require('express');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const { getLogger } = require('../services/structured-logger');

const router = express.Router();
const log = getLogger('notifications', 'notifications');
const notificationBus = new EventEmitter();
notificationBus.setMaxListeners(100);

// In-memory notification store (replace with DB in production)
const notifications = new Map();
const userNotifications = new Map(); // userId -> [notificationIds]
const sseClients = new Map(); // userId -> [response objects]

// ─── SSE Endpoint — Real-time notification stream ─────────────────
router.get('/stream', (req, res) => {
  const userId = req.query.userId || 'anonymous';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', userId, ts: new Date().toISOString() })}\n\n`);

  // Register client
  if (!sseClients.has(userId)) sseClients.set(userId, []);
  sseClients.get(userId).push(res);

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(userId) || [];
    sseClients.set(userId, clients.filter(c => c !== res));
  });
});

// ─── Send notification ─────────────────────────────────────────────
router.post('/send', (req, res) => {
  try {
    const { userId, title, message, type = 'info', channel = 'all', metadata = {} } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'bad_request', message: 'title and message required' });
    }

    const id = `notif-${crypto.randomBytes(8).toString('hex')}`;
    const notification = {
      id,
      userId: userId || 'broadcast',
      title,
      message,
      type, // info, success, warning, error, system
      channel, // all, sse, webhook, email
      metadata,
      read: false,
      createdAt: new Date().toISOString(),
    };

    notifications.set(id, notification);

    // Index by user
    const targetUser = userId || 'broadcast';
    if (!userNotifications.has(targetUser)) userNotifications.set(targetUser, []);
    userNotifications.get(targetUser).push(id);

    // Push via SSE
    if (channel === 'all' || channel === 'sse') {
      const targets = userId ? (sseClients.get(userId) || []) : [...sseClients.values()].flat();
      for (const client of targets) {
        try {
          client.write(`data: ${JSON.stringify(notification)}\n\n`);
        } catch (e) { /* client disconnected */  logger.error('Operation failed', { error: e.message }); }
      }
    }

    // Emit on internal bus
    notificationBus.emit('notification', notification);

    res.status(201).json({ id, status: 'sent', notification });
  } catch (error) {
    res.status(500).json({ error: 'server_error', message: error.message });
  }
});

// ─── List notifications for a user ─────────────────────────────────
router.get('/list', (req, res) => {
  const { userId = 'broadcast', limit = 50, unreadOnly = false } = req.query;
  const ids = userNotifications.get(userId) || [];
  let items = ids.map(id => notifications.get(id)).filter(Boolean);

  if (unreadOnly === 'true') items = items.filter(n => !n.read);
  items = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, parseInt(limit));

  res.json({
    notifications: items,
    total: ids.length,
    unread: ids.map(id => notifications.get(id)).filter(n => n && !n.read).length,
  });
});

// ─── Mark as read ──────────────────────────────────────────────────
router.post('/read', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'bad_request', message: 'ids array required' });

  let updated = 0;
  for (const id of ids) {
    const n = notifications.get(id);
    if (n) { n.read = true; updated++; }
  }

  res.json({ updated, total: ids.length });
});

// ─── Health ────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  const totalClients = [...sseClients.values()].reduce((sum, arr) => sum + arr.length, 0);
  res.json({
    status: 'operational',
    notifications: notifications.size,
    sseClients: totalClients,
    users: sseClients.size,
    ts: new Date().toISOString(),
  });
});

module.exports = { router, notificationBus };
