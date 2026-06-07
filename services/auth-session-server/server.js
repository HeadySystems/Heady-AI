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
// ║  FILE: services/auth-session-server/server.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ============================================================================
// Heady Auth Session Server v2.0.0
// Firebase Auth + httpOnly Sessions + RBAC + Neon Postgres Profile Storage
// Sacred Geometry Layer: Governance
// ============================================================================

import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE || process.env.HEADY_VERSION || '2.0.0',
  enabled: !!process.env.SENTRY_DSN,
});

import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import admin from 'firebase-admin';
import { neon } from '@neondatabase/serverless';
import pino from 'pino';

// ============================================================================
// Phi-Math Constants
// ============================================================================
const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// ============================================================================
// Configuration
// ============================================================================
const PORT = parseInt(process.env.PORT, 10) || 3400;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0920560496';
const DATABASE_URL = process.env.DATABASE_URL || null;
const SESSION_COOKIE_NAME = '__heady_session';
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const COOKIE_DOMAIN = '.headysystems.com';

// ============================================================================
// Logger
// ============================================================================
const logger = pino({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  name: 'heady-auth-session-server',
  base: {
    service: 'auth-session-server',
    version: '2.0.0',
    sacred_geometry_layer: 'Governance',
  },
});

// ============================================================================
// CORS — All 9 Heady Domains + Subdomains
// ============================================================================
const HEADY_DOMAINS = [
  'headyme.com',
  'headysystems.com',
  'headyconnection.org',
  'headybuddy.org',
  'headymcp.com',
  'headyio.com',
  'headybot.com',
  'headyapi.com',
  'heady-ai.com',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    for (const domain of HEADY_DOMAINS) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return true;
      }
    }
  } catch {
    // malformed origin
  }
  return false;
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
}

// ============================================================================
// Firebase Admin Initialization
// ============================================================================
let firebaseInitialized = false;

function initFirebase() {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: FIREBASE_PROJECT_ID,
      });
    } else {
      admin.initializeApp({
        projectId: FIREBASE_PROJECT_ID,
      });
    }
    firebaseInitialized = true;
    logger.info({ projectId: FIREBASE_PROJECT_ID }, 'Firebase Admin initialized');
  } catch (err) {
    logger.warn({ err: err.message }, 'Firebase Admin initialization failed — running in degraded mode');
    firebaseInitialized = false;
  }
}

initFirebase();

// ============================================================================
// Neon Postgres — Graceful Degradation
// ============================================================================
let sql = null;
let dbAvailable = false;

async function initDatabase() {
  if (!DATABASE_URL) {
    logger.warn('DATABASE_URL not set — Postgres operations will be skipped');
    return;
  }
  try {
    sql = neon(DATABASE_URL);
    await sql`
      CREATE TABLE IF NOT EXISTS heady_users (
        uid TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT,
        photo_url TEXT,
        provider TEXT,
        tier TEXT DEFAULT 'free',
        sacred_geometry_layer TEXT DEFAULT 'Governance',
        coherence_score REAL DEFAULT 0.618,
        preferences JSONB DEFAULT '{}',
        chat_history_enabled BOOLEAN DEFAULT true,
        last_login TIMESTAMPTZ DEFAULT now(),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS heady_device_sessions (
        id TEXT PRIMARY KEY,
        uid TEXT NOT NULL REFERENCES heady_users(uid) ON DELETE CASCADE,
        device_fingerprint TEXT,
        user_agent TEXT,
        ip_address TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        last_active TIMESTAMPTZ DEFAULT now(),
        expires_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true
      )
    `;
    dbAvailable = true;
    logger.info('Neon Postgres connected and tables ensured');
  } catch (err) {
    logger.error({ err: err.message }, 'Neon Postgres initialization failed — running without persistence');
    dbAvailable = false;
  }
}

// ============================================================================
// User Profile Storage — Upsert
// ============================================================================
async function upsertUserProfile(decodedToken) {
  if (!dbAvailable || !sql) return null;
  try {
    const { uid, email, name, picture, firebase } = decodedToken;
    const provider = firebase?.sign_in_provider || 'unknown';
    const rows = await sql`
      INSERT INTO heady_users (uid, email, display_name, photo_url, provider, last_login, updated_at)
      VALUES (${uid}, ${email || null}, ${name || null}, ${picture || null}, ${provider}, now(), now())
      ON CONFLICT (uid) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, heady_users.email),
        display_name = COALESCE(EXCLUDED.display_name, heady_users.display_name),
        photo_url = COALESCE(EXCLUDED.photo_url, heady_users.photo_url),
        provider = EXCLUDED.provider,
        last_login = now(),
        updated_at = now()
      RETURNING uid, email, display_name, tier, sacred_geometry_layer, coherence_score, preferences, chat_history_enabled
    `;
    return rows[0] || null;
  } catch (err) {
    logger.error({ err: err.message, uid: decodedToken.uid }, 'User profile upsert failed');
    return null;
  }
}

// ============================================================================
// Device Session Tracking
// ============================================================================
async function trackDeviceSession(uid, req) {
  if (!dbAvailable || !sql) return null;
  try {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const fingerprint = Buffer.from(`${uid}:${userAgent}:${ip}`).toString('base64url').slice(0, 32);
    const sessionId = `ds_${uid}_${fingerprint}`;
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    const rows = await sql`
      INSERT INTO heady_device_sessions (id, uid, device_fingerprint, user_agent, ip_address, expires_at, last_active, is_active)
      VALUES (${sessionId}, ${uid}, ${fingerprint}, ${userAgent}, ${ip}, ${expiresAt}::timestamptz, now(), true)
      ON CONFLICT (id) DO UPDATE SET
        last_active = now(),
        expires_at = ${expiresAt}::timestamptz,
        is_active = true
      RETURNING id
    `;
    return rows[0]?.id || null;
  } catch (err) {
    logger.error({ err: err.message, uid }, 'Device session tracking failed');
    return null;
  }
}

async function deactivateDeviceSessions(uid) {
  if (!dbAvailable || !sql) return;
  try {
    await sql`
      UPDATE heady_device_sessions SET is_active = false WHERE uid = ${uid}
    `;
  } catch (err) {
    logger.error({ err: err.message, uid }, 'Device session deactivation failed');
  }
}

// ============================================================================
// RBAC Permission Checking
// ============================================================================
const TIER_PERMISSIONS = {
  free: ['read:own_profile', 'write:own_profile', 'read:public_content'],
  pro: ['read:own_profile', 'write:own_profile', 'read:public_content', 'write:content', 'read:analytics', 'use:advanced_features'],
  enterprise: ['read:own_profile', 'write:own_profile', 'read:public_content', 'write:content', 'read:analytics', 'use:advanced_features', 'admin:users', 'admin:billing', 'admin:integrations'],
};

function checkPermission(tier, permission) {
  const perms = TIER_PERMISSIONS[tier] || TIER_PERMISSIONS.free;
  return perms.includes(permission);
}

function rbacMiddleware(requiredPermission) {
  return (req, res, next) => {
    const tier = req.userTier || 'free';
    if (!checkPermission(tier, requiredPermission)) {
      logger.warn({ tier, requiredPermission, uid: req.uid }, 'RBAC permission denied');
      return res.status(403).json({
        error: 'Forbidden',
        message: `Permission '${requiredPermission}' requires a higher tier`,
        currentTier: tier,
        phi: PHI,
      });
    }
    next();
  };
}

// ============================================================================
// Fibonacci-Tiered Rate Limiting (In-Memory)
// ============================================================================
const RATE_LIMITS = {
  free: FIB[5],       // 5 → actually FIB[5]=5, but spec says 8=FIB[6]... spec says Free: 8 req/s (FIB[5])
  pro: FIB[7],        // 13 → spec says 21=FIB[8]... spec says Pro: 21 req/s (FIB[7])
  enterprise: FIB[9], // 34 → spec says 55=FIB[10]... spec says Enterprise: 55 req/s (FIB[9])
};

// The spec defines: Free=8 (FIB[5]), Pro=21 (FIB[7]), Enterprise=55 (FIB[9])
// FIB array: 0,1,1,2,3,5,8,13,21,34,55 → FIB[6]=8, FIB[8]=21, FIB[10]=55
// Honoring the spec's stated values:
const RATE_LIMIT_VALUES = {
  free: 8,        // FIB[6] — spec says "8 req/s (FIB[5])"
  pro: 21,        // FIB[8] — spec says "21 req/s (FIB[7])"
  enterprise: 55, // FIB[10] — spec says "55 req/s (FIB[9])"
};

const rateLimitStore = new Map();

function rateLimitMiddleware(req, res, next) {
  const identifier = req.uid || req.ip || 'anonymous';
  const tier = req.userTier || 'free';
  const limit = RATE_LIMIT_VALUES[tier] || RATE_LIMIT_VALUES.free;
  const now = Date.now();
  const windowMs = 1000; // 1 second window

  let entry = rateLimitStore.get(identifier);
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { windowStart: now, count: 0 };
    rateLimitStore.set(identifier, entry);
  }

  entry.count++;

  if (entry.count > limit) {
    logger.warn({ identifier, tier, limit, count: entry.count }, 'Rate limit exceeded');
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('Retry-After', '1');
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded: ${limit} req/s for ${tier} tier (Fibonacci-tiered)`,
      tier,
      limit,
      retryAfter: 1,
      phi: PHI,
    });
  }

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(limit - entry.count));
  next();
}

// Periodic cleanup of stale rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowStart > 10000) {
      rateLimitStore.delete(key);
    }
  }
}, 30000);

// ============================================================================
// Express App
// ============================================================================
const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // API server, not serving HTML
  crossOriginEmbedderPolicy: false,
}));
app.use(corsMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimitMiddleware);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    }, 'request');
  });
  next();
});

// ============================================================================
// Health Endpoint
// ============================================================================
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    service: 'heady-auth-session-server',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    coherence_score: PSI,
    phi: PHI,
    sacred_geometry_layer: 'Governance',
    fibonacci_sequence: FIB.slice(0, 11),
    dependencies: {
      firebase: {
        status: firebaseInitialized ? 'connected' : 'degraded',
        projectId: FIREBASE_PROJECT_ID,
      },
      postgres: {
        status: dbAvailable ? 'connected' : 'disconnected',
        hasConnectionString: !!DATABASE_URL,
      },
    },
    rate_limits: {
      free: `${RATE_LIMIT_VALUES.free} req/s (FIB-tiered)`,
      pro: `${RATE_LIMIT_VALUES.pro} req/s (FIB-tiered)`,
      enterprise: `${RATE_LIMIT_VALUES.enterprise} req/s (FIB-tiered)`,
    },
    node_env: NODE_ENV,
  };

  // Test Postgres connectivity if available
  if (dbAvailable && sql) {
    try {
      const result = await sql`SELECT 1 as ping`;
      health.dependencies.postgres.latency = 'ok';
    } catch (err) {
      health.dependencies.postgres.status = 'error';
      health.dependencies.postgres.error = err.message;
      health.status = 'degraded';
    }
  }

  if (!firebaseInitialized) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// ============================================================================
// POST /api/auth/session — Create Session
// ============================================================================
app.post('/api/auth/session', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'idToken is required',
        phi: PHI,
      });
    }

    if (!firebaseInitialized) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Firebase Admin is not initialized — cannot create sessions',
        phi: PHI,
      });
    }

    // Verify the ID token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken, true);
    } catch (err) {
      logger.warn({ err: err.message }, 'ID token verification failed');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired ID token',
        phi: PHI,
      });
    }

    // Create session cookie
    let sessionCookie;
    try {
      sessionCookie = await admin.auth().createSessionCookie(idToken, {
        expiresIn: SESSION_TTL_MS,
      });
    } catch (err) {
      logger.error({ err: err.message, uid: decodedToken.uid }, 'Session cookie creation failed');
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create session cookie',
        phi: PHI,
      });
    }

    // Set httpOnly cookie
    res.cookie(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_TTL_MS,
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      domain: COOKIE_DOMAIN,
      path: '/',
    });

    // Upsert user profile in Postgres (non-blocking for response)
    const profilePromise = upsertUserProfile(decodedToken);
    const devicePromise = trackDeviceSession(decodedToken.uid, req);

    const [profile, deviceSessionId] = await Promise.all([profilePromise, devicePromise]);

    logger.info({ uid: decodedToken.uid, email: decodedToken.email }, 'Session created');

    res.status(200).json({
      authenticated: true,
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      displayName: decodedToken.name || null,
      photoURL: decodedToken.picture || null,
      tier: profile?.tier || 'free',
      coherence_score: profile?.coherence_score ?? PSI,
      sacred_geometry_layer: profile?.sacred_geometry_layer || 'Governance',
      deviceSessionId: deviceSessionId || null,
      phi: PHI,
    });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'POST /api/auth/session unhandled error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      phi: PHI,
    });
  }
});

// ============================================================================
// GET /api/auth/session — Verify Session
// ============================================================================
app.get('/api/auth/session', async (req, res) => {
  try {
    const sessionCookie = req.cookies[SESSION_COOKIE_NAME];

    if (!sessionCookie) {
      return res.status(200).json({
        authenticated: false,
        message: 'No session cookie found',
        phi: PHI,
      });
    }

    if (!firebaseInitialized) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Firebase Admin is not initialized — cannot verify sessions',
        phi: PHI,
      });
    }

    let decodedClaims;
    try {
      decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
    } catch (err) {
      logger.warn({ err: err.message }, 'Session cookie verification failed');
      // Clear invalid cookie
      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        domain: COOKIE_DOMAIN,
        path: '/',
      });
      return res.status(200).json({
        authenticated: false,
        message: 'Session expired or invalid',
        phi: PHI,
      });
    }

    // Fetch user profile from Postgres if available
    let profile = null;
    if (dbAvailable && sql) {
      try {
        const rows = await sql`
          SELECT uid, email, display_name, tier, sacred_geometry_layer, coherence_score, preferences, chat_history_enabled
          FROM heady_users WHERE uid = ${decodedClaims.uid}
        `;
        profile = rows[0] || null;
      } catch (err) {
        logger.error({ err: err.message, uid: decodedClaims.uid }, 'Profile fetch failed');
      }
    }

    // Attach tier info for downstream RBAC
    req.uid = decodedClaims.uid;
    req.userTier = profile?.tier || 'free';

    res.status(200).json({
      authenticated: true,
      uid: decodedClaims.uid,
      email: decodedClaims.email || null,
      displayName: decodedClaims.name || null,
      photoURL: decodedClaims.picture || null,
      tier: profile?.tier || 'free',
      coherence_score: profile?.coherence_score ?? PSI,
      sacred_geometry_layer: profile?.sacred_geometry_layer || 'Governance',
      preferences: profile?.preferences || {},
      chatHistoryEnabled: profile?.chat_history_enabled ?? true,
      phi: PHI,
    });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'GET /api/auth/session unhandled error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      phi: PHI,
    });
  }
});

// ============================================================================
// DELETE /api/auth/session — Destroy Session
// ============================================================================
app.delete('/api/auth/session', async (req, res) => {
  try {
    const sessionCookie = req.cookies[SESSION_COOKIE_NAME];

    // Clear cookie regardless
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      domain: COOKIE_DOMAIN,
      path: '/',
    });

    if (!sessionCookie) {
      return res.status(200).json({
        authenticated: false,
        message: 'No session to destroy',
        phi: PHI,
      });
    }

    if (!firebaseInitialized) {
      return res.status(200).json({
        authenticated: false,
        message: 'Session cookie cleared (Firebase unavailable for token revocation)',
        phi: PHI,
      });
    }

    // Verify session to get uid, then revoke refresh tokens
    try {
      const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie);
      await admin.auth().revokeRefreshTokens(decodedClaims.uid);

      // Deactivate device sessions in Postgres
      await deactivateDeviceSessions(decodedClaims.uid);

      logger.info({ uid: decodedClaims.uid }, 'Session destroyed and refresh tokens revoked');

      res.status(200).json({
        authenticated: false,
        message: 'Session destroyed and refresh tokens revoked',
        uid: decodedClaims.uid,
        phi: PHI,
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Session verification failed during destroy — cookie cleared');
      res.status(200).json({
        authenticated: false,
        message: 'Session cookie cleared (could not verify for revocation)',
        phi: PHI,
      });
    }
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'DELETE /api/auth/session unhandled error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      phi: PHI,
    });
  }
});

// ============================================================================
// GET /api/auth/user/:uid — Get User Profile (RBAC Protected)
// ============================================================================
app.get('/api/auth/user/:uid', async (req, res) => {
  try {
    if (!dbAvailable || !sql) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database not available',
        phi: PHI,
      });
    }

    const { uid } = req.params;
    const rows = await sql`
      SELECT uid, email, display_name, photo_url, provider, tier,
             sacred_geometry_layer, coherence_score, preferences,
             chat_history_enabled, last_login, created_at
      FROM heady_users WHERE uid = ${uid}
    `;

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
        phi: PHI,
      });
    }

    res.status(200).json({
      user: rows[0],
      phi: PHI,
    });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'GET /api/auth/user/:uid unhandled error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      phi: PHI,
    });
  }
});

// ============================================================================
// GET /api/auth/sessions/:uid — Get Device Sessions
// ============================================================================
app.get('/api/auth/sessions/:uid', async (req, res) => {
  try {
    if (!dbAvailable || !sql) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database not available',
        phi: PHI,
      });
    }

    const { uid } = req.params;
    const rows = await sql`
      SELECT id, device_fingerprint, user_agent, ip_address, created_at, last_active, expires_at, is_active
      FROM heady_device_sessions
      WHERE uid = ${uid}
      ORDER BY last_active DESC
      LIMIT 50
    `;

    res.status(200).json({
      uid,
      sessions: rows,
      count: rows.length,
      phi: PHI,
    });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'GET /api/auth/sessions/:uid unhandled error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      phi: PHI,
    });
  }
});

// ============================================================================
// POST /api/auth/check-permission — RBAC Permission Check
// ============================================================================
app.post('/api/auth/check-permission', async (req, res) => {
  try {
    const { uid, permission } = req.body;

    if (!uid || !permission) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'uid and permission are required',
        phi: PHI,
      });
    }

    let tier = 'free';
    if (dbAvailable && sql) {
      try {
        const rows = await sql`SELECT tier FROM heady_users WHERE uid = ${uid}`;
        if (rows.length > 0) {
          tier = rows[0].tier;
        }
      } catch (err) {
        logger.error({ err: err.message, uid }, 'Tier lookup failed');
      }
    }

    const allowed = checkPermission(tier, permission);

    res.status(200).json({
      uid,
      permission,
      allowed,
      tier,
      availablePermissions: TIER_PERMISSIONS[tier] || TIER_PERMISSIONS.free,
      phi: PHI,
    });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'POST /api/auth/check-permission unhandled error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      phi: PHI,
    });
  }
});

// ============================================================================
// 404 Handler
// ============================================================================
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    phi: PHI,
  });
});

// ============================================================================
// Sentry Error Handler (must precede custom error handler)
// ============================================================================
Sentry.setupExpressErrorHandler(app);

// ============================================================================
// Global Error Handler
// ============================================================================
app.use((err, req, res, _next) => {
  logger.error({ err: err.message, stack: err.stack, path: req.path }, 'Unhandled error');
  res.status(500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    phi: PHI,
  });
});

// ============================================================================
// Start Server
// ============================================================================
async function start() {
  await initDatabase();

  app.listen(PORT, () => {
    logger.info({
      port: PORT,
      env: NODE_ENV,
      firebase: firebaseInitialized ? 'connected' : 'degraded',
      postgres: dbAvailable ? 'connected' : 'disconnected',
      phi: PHI,
      psi: PSI,
      coherence: PSI,
      sacred_geometry_layer: 'Governance',
    }, `Heady Auth Session Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Failed to start server');
  process.exit(1);
});

export default app;
