/**
 * Heady™ Liquid Node Service — Cloud Run Server
 * ═══════════════════════════════════════════════
 *
 * Express server for liquid node orchestration, wiring, and health monitoring.
 * Integrates: Neon Postgres, Upstash Redis, Pinecone, Firebase Admin, Sentry.
 *
 * @module services/heady-liquid/server
 */
'use strict';

const { isAllowedOrigin } = require('../../shared/cors-config');
const express = require('express');
const Sentry = require('@sentry/node');
const { neon } = require('@neondatabase/serverless');
const { Pinecone } = require('@pinecone-database/pinecone');
const Redis = require('ioredis');
const admin = require('firebase-admin');

// ─── φ Constants ─────────────────────────────────────────────────────
const PHI = 1.6180339887498948;
const PSI = 0.6180339887498948;
const VERSION = process.env.HEADY_VERSION || '5.9.0';
const PORT = process.env.PORT || 8080;

// ─── Sentry (error tracking + performance) ──────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    release: `heady-liquid@${VERSION}`,
    tracesSampleRate: PSI, // ~61.8% sampling — φ-scaled
    profilesSampleRate: PSI * PSI, // ~38.2%
  });
  console.log('  ✅ Sentry wired — DSN:', process.env.SENTRY_DSN.split('@')[1]?.split('/')[0] || 'configured');
}

// ─── Firebase Admin ─────────────────────────────────────────────────
let firebaseApp = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID) {
  try {
    firebaseApp = admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'heady-ai',
    });
    console.log('  ✅ Firebase Admin wired — project:', firebaseApp.options.projectId);
  } catch (e) {
    console.log('  ⚠️ Firebase Admin:', e.message);
  }
}

// ─── Neon Postgres ──────────────────────────────────────────────────
let sql = null;
if (process.env.DATABASE_URL) {
  sql = neon(process.env.DATABASE_URL);
  console.log('  ✅ Neon Postgres wired — project: green-water-91851995');
}

// ─── Upstash Redis ──────────────────────────────────────────────────
let redis = null;
if (process.env.UPSTASH_REDIS_ENDPOINT && process.env.UPSTASH_REDIS_PASSWORD) {
  redis = new Redis({
    host: process.env.UPSTASH_REDIS_ENDPOINT,
    port: parseInt(process.env.UPSTASH_REDIS_PORT || '6379'),
    password: process.env.UPSTASH_REDIS_PASSWORD,
    tls: {},
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * Math.round(PHI * 100), 5000),
  });
  console.log('  ✅ Upstash Redis wired — endpoint:', process.env.UPSTASH_REDIS_ENDPOINT);
}

// ─── Pinecone ───────────────────────────────────────────────────────
let pinecone = null;
if (process.env.PINECONE_API_KEY) {
  pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  console.log('  ✅ Pinecone wired — vector DB initialized');
}

// ─── Express App ────────────────────────────────────────────────────
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

// Sentry request handler
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', isAllowedOrigin(req.headers.origin) ? req.headers.origin : 'null');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Heady-Device');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('X-Heady-Version', VERSION);
  res.header('X-Heady-Phi', String(PHI));
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Health Endpoints ───────────────────────────────────────────────

app.get('/_heady/health', (req, res) => {
  res.json({
    status: 'ok',
    node: 'cloud-run',
    version: VERSION,
    phi: PHI,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      neon: sql ? 'wired' : 'disconnected',
      redis: redis ? 'wired' : 'disconnected',
      pinecone: pinecone ? 'wired' : 'disconnected',
      firebase: firebaseApp ? 'wired' : 'disconnected',
      sentry: process.env.SENTRY_DSN ? 'wired' : 'disconnected',
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Neon Postgres Endpoints ────────────────────────────────────────

app.get('/api/data/query', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'Neon Postgres not configured — set DATABASE_URL' });
  try {
    const result = await sql`SELECT NOW() as time, current_database() as db, version() as pg_version`;
    res.json({ ok: true, result: result[0] });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data/tables', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'Neon Postgres not configured' });
  try {
    const tables = await sql`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    res.json({ ok: true, tables, count: tables.length });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Upstash Redis Endpoints ────────────────────────────────────────

app.get('/api/cache/ping', async (req, res) => {
  if (!redis) return res.status(503).json({ error: 'Upstash Redis not configured' });
  try {
    const pong = await redis.ping();
    const info = await redis.info('keyspace');
    res.json({ ok: true, ping: pong, keyspace: info });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cache/:key', async (req, res) => {
  if (!redis) return res.status(503).json({ error: 'Redis not configured' });
  const val = await redis.get(req.params.key);
  if (val === null) return res.status(404).json({ key: req.params.key, found: false });
  res.json({ key: req.params.key, value: val, found: true });
});

app.post('/api/cache/:key', async (req, res) => {
  if (!redis) return res.status(503).json({ error: 'Redis not configured' });
  const ttl = req.body.ttl || Math.round(PHI * 3600); // ~1.618 hours default
  await redis.set(req.params.key, JSON.stringify(req.body.value), 'EX', ttl);
  res.json({ ok: true, key: req.params.key, ttl });
});

// ─── Pinecone Vector Endpoints ──────────────────────────────────────

app.get('/api/vectors/indexes', async (req, res) => {
  if (!pinecone) return res.status(503).json({ error: 'Pinecone not configured — set PINECONE_API_KEY' });
  try {
    const indexes = await pinecone.listIndexes();
    res.json({ ok: true, indexes });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vectors/upsert', async (req, res) => {
  if (!pinecone) return res.status(503).json({ error: 'Pinecone not configured' });
  const { index: indexName, vectors, namespace } = req.body;
  if (!indexName || !vectors) return res.status(400).json({ error: 'index and vectors required' });
  try {
    const index = pinecone.index(indexName);
    const ns = namespace ? index.namespace(namespace) : index;
    await ns.upsert(vectors);
    res.json({ ok: true, upserted: vectors.length, index: indexName, namespace: namespace || 'default' });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vectors/query', async (req, res) => {
  if (!pinecone) return res.status(503).json({ error: 'Pinecone not configured' });
  const { index: indexName, vector, topK, namespace, filter } = req.body;
  if (!indexName || !vector) return res.status(400).json({ error: 'index and vector required' });
  try {
    const index = pinecone.index(indexName);
    const ns = namespace ? index.namespace(namespace) : index;
    const results = await ns.query({ vector, topK: topK || 10, filter, includeMetadata: true });
    res.json({ ok: true, matches: results.matches, namespace: namespace || 'default' });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Firebase Auth Endpoints ────────────────────────────────────────

app.post('/api/auth/verify', async (req, res) => {
  if (!firebaseApp) return res.status(503).json({ error: 'Firebase Admin not configured' });
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    res.json({ ok: true, uid: decoded.uid, email: decoded.email, provider: decoded.firebase?.sign_in_provider });
  } catch (err) {
    res.status(401).json({ authenticated: false, error: err.message });
  }
});

app.get('/api/auth/users/count', async (req, res) => {
  if (!firebaseApp) return res.status(503).json({ error: 'Firebase Admin not configured' });
  try {
    // List first page to get a count estimate
    const listResult = await admin.auth().listUsers(1000);
    res.json({ ok: true, count: listResult.users.length, hasMore: !!listResult.pageToken });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Sentry Endpoints ──────────────────────────────────────────────

app.get('/api/monitoring/sentry/test', (req, res) => {
  if (!process.env.SENTRY_DSN) return res.status(503).json({ error: 'Sentry not configured' });
  Sentry.captureMessage('Heady Liquid Node — Sentry test event', 'info');
  res.json({ ok: true, message: 'Test event sent to Sentry', dsn: process.env.SENTRY_DSN.split('@')[1]?.split('/')[0] || 'configured' });
});

// ─── Liquid Node Wiring Status ──────────────────────────────────────

app.get('/api/liquid-nodes/status', (req, res) => {
  const nodes = [
    { id: 'neon', name: 'Neon Postgres', type: 'database', status: sql ? 'wired' : 'disconnected' },
    { id: 'upstash', name: 'Upstash Redis', type: 'cache', status: redis ? 'wired' : 'disconnected' },
    { id: 'pinecone', name: 'Pinecone', type: 'vector-db', status: pinecone ? 'wired' : 'disconnected' },
    { id: 'firebase', name: 'Firebase Admin', type: 'auth', status: firebaseApp ? 'wired' : 'disconnected' },
    { id: 'sentry', name: 'Sentry', type: 'monitoring', status: process.env.SENTRY_DSN ? 'wired' : 'disconnected' },
  ];
  const wired = nodes.filter(n => n.status === 'wired').length;
  res.json({
    ok: wired > 0,
    total: nodes.length,
    wired,
    coveragePct: Math.round((wired / nodes.length) * 100),
    phi: PHI,
    nodes,
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  ⚡ Heady™ Liquid Node Service v${VERSION}`);
  console.log(`  🌀 φ = ${PHI} | ψ = ${PSI}`);
  console.log(`  🚀 Listening on port ${PORT}`);
  console.log(`  📍 Endpoints: /_heady/health, /api/data/*, /api/cache/*, /api/vectors/*, /api/auth/*, /api/monitoring/*\n`);
});
