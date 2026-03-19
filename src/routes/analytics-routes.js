// HEADY_BRAND:BEGIN
// ║  ∞ SACRED GEOMETRY ∞  Privacy-First Analytics Service Routes
// ║  FILE: src/routes/analytics-routes.js
// HEADY_BRAND:END

const express = require('express');
const crypto = require('crypto');
const { getLogger } = require('../services/structured-logger');

const router = express.Router();
const log = getLogger('analytics', 'analytics');

// In-memory analytics store (replace with TimescaleDB/BigQuery in production)
const events = [];
const metrics = {
  pageViews: new Map(),    // page -> count
  apiCalls: new Map(),     // endpoint -> { count, totalMs, errors }
  sessions: new Map(),     // sessionId -> { startedAt, lastActivity, pages }
  funnels: new Map(),      // funnelName -> { steps, conversions }
};

const MAX_EVENTS = 10000; // Ring buffer

// ─── Track event ───────────────────────────────────────────────────
router.post('/event', (req, res) => {
  try {
    const { event, properties = {}, sessionId, page, userId } = req.body;

    if (!event) return res.status(400).json({ error: 'event name required' });

    // Privacy: hash userId if present (no PII stored)
    const anonId = userId ? crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16) : null;

    const entry = {
      id: crypto.randomBytes(6).toString('hex'),
      event,
      properties,
      sessionId: sessionId || null,
      page: page || null,
      anonId,
      ts: new Date().toISOString(),
      ua: req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 100) : null,
    };

    // Ring buffer
    if (events.length >= MAX_EVENTS) events.shift();
    events.push(entry);

    // Update page view metrics
    if (event === 'page_view' && page) {
      metrics.pageViews.set(page, (metrics.pageViews.get(page) || 0) + 1);
    }

    // Update session tracking
    if (sessionId) {
      if (!metrics.sessions.has(sessionId)) {
        metrics.sessions.set(sessionId, { startedAt: entry.ts, lastActivity: entry.ts, pages: new Set(), events: 0 });
      }
      const session = metrics.sessions.get(sessionId);
      session.lastActivity = entry.ts;
      session.events++;
      if (page) session.pages.add(page);
    }

    res.status(201).json({ tracked: true, id: entry.id });
  } catch (error) {
    res.status(500).json({ error: 'server_error', message: error.message });
  }
});

// ─── Track API call metrics ────────────────────────────────────────
router.post('/api-metric', (req, res) => {
  try {
    const { endpoint, method = 'GET', durationMs, statusCode, error: hasError } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

    const key = `${method} ${endpoint}`;
    if (!metrics.apiCalls.has(key)) {
      metrics.apiCalls.set(key, { count: 0, totalMs: 0, errors: 0, p99: [], lastCall: null });
    }

    const m = metrics.apiCalls.get(key);
    m.count++;
    m.totalMs += durationMs || 0;
    m.lastCall = new Date().toISOString();
    if (hasError || (statusCode && statusCode >= 500)) m.errors++;

    // Track p99 (keep last 100 durations)
    if (durationMs) {
      m.p99.push(durationMs);
      if (m.p99.length > 100) m.p99.shift();
    }

    res.json({ tracked: true });
  } catch (error) {
    res.status(500).json({ error: 'server_error', message: error.message });
  }
});

// ─── Dashboard — aggregate metrics ─────────────────────────────────
router.get('/dashboard', (req, res) => {
  const now = Date.now();
  const activeSessions = [...metrics.sessions.values()].filter(
    s => now - new Date(s.lastActivity).getTime() < 30 * 60 * 1000
  ).length;

  // Top pages
  const topPages = [...metrics.pageViews.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([page, views]) => ({ page, views }));

  // API performance
  const apiPerformance = [...metrics.apiCalls.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([endpoint, m]) => ({
      endpoint,
      calls: m.count,
      avgMs: m.count ? Math.round(m.totalMs / m.count) : 0,
      p99Ms: m.p99.length ? Math.round(m.p99.sort((a, b) => a - b)[Math.floor(m.p99.length * 0.99)]) : 0,
      errorRate: m.count ? Math.round((m.errors / m.count) * 100 * 100) / 100 : 0,
      lastCall: m.lastCall,
    }));

  res.json({
    overview: {
      totalEvents: events.length,
      totalSessions: metrics.sessions.size,
      activeSessions,
      uniquePages: metrics.pageViews.size,
      totalApiEndpoints: metrics.apiCalls.size,
    },
    topPages,
    apiPerformance,
    ts: new Date().toISOString(),
  });
});

// ─── Recent events ─────────────────────────────────────────────────
router.get('/events', (req, res) => {
  const { limit = 50, event: eventFilter } = req.query;
  let result = [...events].reverse();
  if (eventFilter) result = result.filter(e => e.event === eventFilter);
  result = result.slice(0, parseInt(limit));
  res.json({ events: result, total: events.length });
});

// ─── Health ────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    events: events.length,
    maxEvents: MAX_EVENTS,
    trackedEndpoints: metrics.apiCalls.size,
    trackedPages: metrics.pageViews.size,
    ts: new Date().toISOString(),
  });
});

module.exports = { router };
