/**
 * @file index.js
 * @description Express app entry point — middleware chain, route mounting,
 *   Firebase Admin init, health/readiness endpoints, graceful shutdown.
 *
 *   Middleware order:
 *     1. Helmet (security headers)
 *     2. CORS (12 Heady domains)
 *     3. pino-http (request logging)
 *     4. JSON body parser
 *     5. Session (express-session)
 *     6. Onboarding guard
 *     7. Routes
 *
 *   Environment variables:
 *     PORT                    — Listen port (default: 8080)
 *     NODE_ENV                — 'production' | 'development' (default: 'development')
 *     SESSION_SECRET          — express-session secret (required in production)
 *     JWT_SECRET              — JWT signing secret (required in production)
 *     FIREBASE_SERVICE_ACCOUNT — JSON-encoded service account key (optional; falls back to default credentials)
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { initializeApp, cert } from 'firebase-admin/app';
import { createAuthRouter } from './routes/auth-routes.js';
import { createOnboardingRouter } from './routes/onboarding-routes.js';
import { onboardingGuard } from './middleware/onboarding-guard.js';

const log = pino({ name: 'heady-onboarding' });

// ─── Configuration ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '8080', 10);
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'heady-dev-session-secret-change-in-production';

// ─── CORS: 12 Heady Domains ────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://heady.ai',
  'https://www.heady.ai',
  'https://app.heady.ai',
  'https://api.heady.ai',
  'https://headyme.com',
  'https://www.headyme.com',
  'https://app.headyme.com',
  'https://mail.headyme.com',
  'https://heady.dev',
  'https://www.heady.dev',
  'https://app.heady.dev',
  'https://api.heady.dev',
  'https://mail.heady.dev',
];

if (NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push(process.env.SERVICE_URL || 'http://0.0.0.0:3000', process.env.SERVICE_URL || 'http://0.0.0.0:8080', process.env.SERVICE_URL || 'http://0.0.0.0:5173');
}

// ─── Firebase Admin Init ────────────────────────────────────────────────────

let firebaseApp;

function initFirebase() {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccount) {
    try {
      const parsed = JSON.parse(serviceAccount);
      firebaseApp = initializeApp({ credential: cert(parsed) });
      log.info('Firebase Admin initialized with service account');
    } catch (err) {
      log.error({ err: err.message }, 'Failed to parse FIREBASE_SERVICE_ACCOUNT');
      throw err;
    }
  } else {
    // Default credentials (GCE, Cloud Run, emulator)
    firebaseApp = initializeApp();
    log.info('Firebase Admin initialized with default credentials');
  }

  return firebaseApp;
}

// ─── App Factory ────────────────────────────────────────────────────────────

export function createApp() {
  const app = express();

  // 1. Helmet — security headers
  app.use(helmet({
    contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  // 2. CORS — 12 Heady domains + localhost in dev
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        log.warn({ origin }, 'CORS origin rejected');
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    maxAge: 86400,
  }));

  // 3. pino-http — structured request logging
  app.use(pinoHttp({
    logger: log,
    autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  }));

  // 4. JSON body parser
  app.use(express.json({ limit: '1mb' }));

  // 5. Session middleware
  app.use(session({
    secret: SESSION_SECRET,
    name: 'heady.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24h
    },
  }));

  // ── Health / Readiness ──────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'heady-onboarding', version: '3.0.0', timestamp: new Date().toISOString() });
  });

  app.get('/ready', (_req, res) => {
    const ready = !!firebaseApp;
    res.status(ready ? 200 : 503).json({ ok: ready, service: 'heady-onboarding' });
  });

  // ── Mount auth routes (before onboarding guard) ─────────────────────
  app.use('/auth', createAuthRouter(firebaseApp));

  // 6. Onboarding guard — blocks non-onboarded users from app routes
  app.use(onboardingGuard());

  // ── Mount onboarding routes ─────────────────────────────────────────
  app.use('/api/onboarding', createOnboardingRouter());

  // ── 404 handler ─────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // ── Global error handler ──────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    log.error({ err: err.message, stack: err.stack }, 'unhandled error');
    res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  });

  return app;
}

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

let server;

function shutdown(signal) {
  log.info({ signal }, 'shutdown signal received');
  if (server) {
    server.close(() => {
      log.info('HTTP server closed');
      process.exit(0);
    });
    // Force exit after 10s if connections don't close
    setTimeout(() => {
      log.warn('forcing shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  } else {
    process.exit(0);
  }
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────

function main() {
  initFirebase();
  const app = createApp();

  server = app.listen(PORT, () => {
    log.info({ port: PORT, env: NODE_ENV }, 'HeadyMe onboarding server v3.0.0 started');
  });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
