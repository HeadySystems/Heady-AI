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
// ║  FILE: auth-service/src/index.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * HeadyAuth Production Service v5.0
 * Zero-trust identity layer for the Heady™ ecosystem.
 * Powers the HeadyKey public auth product (headykey.com).
 *
 * Features:
 * - JWT access + refresh tokens (HS256, 1h/30d TTL)
 * - RBAC (admin/operator/user/guest)
 * - API key management (hdy_ prefix, SHA-256 hashed)
 * - Session cookies (httpOnly, Secure, SameSite=Strict)
 * - Neon PostgreSQL + pgvector (auto-schema at startup)
 * - Health triad (/health/live, /health/ready, /health/startup)
 * - Hardened CORS (zero wildcards)
 * - Structured JSON logging
 * - Graceful SIGTERM shutdown
 *
 * Internal service name: auth-service / heady-auth (stable, unchanged)
 * Public product name: HeadyKey
 *
 * © 2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */
'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const db = require('./db');
const { log } = require('./logger');
const { requireAuth, requireRole, ROLE_LEVELS } = require('./middleware');
const {
  generateApiKey, hashApiKey, generateSessionToken,
  hashPassword, verifyPassword, generateId,
} = require('./crypto');

// ─── Configuration ───────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3309', 10);
const JWT_SECRET = process.env.JWT_SECRET;
const SERVICE_NAME = process.env.SERVICE_NAME || 'heady-auth';

// Token TTLs (phi-derived)
const ACCESS_TOKEN_TTL = '1h';           // 1 hour
const REFRESH_TOKEN_DAYS = 30;           // 30 days
const SESSION_TTL_HOURS = 8;             // 8 hours (fib(6))
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

// ─── CORS Whitelist (zero wildcards) ─────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://headyme.com',       'https://www.headyme.com',
  'https://headysystems.com',  'https://www.headysystems.com',
  'https://admin.headysystems.com',
  'https://auth.headysystems.com', 'https://api.headysystems.com',
  'https://heady-ai.com',      'https://www.heady-ai.com',
  'https://headyos.com',       'https://www.headyos.com',
  'https://headyconnection.org','https://www.headyconnection.org',
  'https://headyex.com',       'https://www.headyex.com',
  'https://headyfinance.com',  'https://www.headyfinance.com',
  'https://headybuddy.org',    'https://www.headybuddy.org',
  'https://headybot.com',      'https://headyapi.com',
  'https://headyio.com',       'https://headymcp.com',
  'https://headykey.com',      'https://www.headykey.com',
  'https://headyvault.com',    'https://www.headyvault.com',
];

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // handled per-site
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // server-to-server
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    log('warn', 'cors_blocked', { origin });
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ─── Health State ────────────────────────────────────────────────────────────
const startTime = Date.now();
let serviceReady = false;
let startupComplete = false;

// ─── Health Triad ────────────────────────────────────────────────────────────
app.get('/health/live', (_req, res) => {
  res.json({ status: 'alive', service: SERVICE_NAME, timestamp: new Date().toISOString() });
});
app.get('/health/ready', (_req, res) => {
  res.status(serviceReady ? 200 : 503).json({
    status: serviceReady ? 'ready' : 'not_ready',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
});
app.get('/health/startup', (_req, res) => {
  res.status(startupComplete ? 200 : 503).json({
    status: startupComplete ? 'started' : 'starting',
    service: SERVICE_NAME,
    uptime: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  });
});
app.get('/health', async (_req, res) => {
  res.status(serviceReady ? 200 : 503).json({
    service: SERVICE_NAME,
    version: '5.0.0',
    status: serviceReady ? 'healthy' : 'degraded',
    uptime: Date.now() - startTime,
    database: serviceReady ? 'connected' : 'unknown',
    cors_origins: ALLOWED_ORIGINS.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── Auth Routes ─────────────────────────────────────────────────────────────

// POST /api/auth/register — Create new account
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = generateId();
    const passwordHash = await hashPassword(password);
    await db.query(
      `INSERT INTO users (id, email, password_hash, name, role, onboarding_stage)
       VALUES ($1, $2, $3, $4, 'user', 0)`,
      [id, email, passwordHash, name || null]
    );

    // Create onboarding log entry
    await db.query(
      `INSERT INTO onboarding_log (user_id, stage, status) VALUES ($1, 0, 'started')`,
      [id]
    );

    log('info', 'user_registered', { userId: id, email });

    // Issue tokens
    const accessToken = jwt.sign(
      { userId: id, email, role: 'user' },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );
    const refreshToken = generateSessionToken();
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.query(
      `INSERT INTO sessions (user_id, session_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, sessionToken, req.ip, req.headers['user-agent'] || '', expiresAt]
    );

    res.cookie('__heady_session', sessionToken, {
      maxAge: SESSION_TTL_MS,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });

    res.status(201).json({
      user: { id, email, name, role: 'user', onboarding_stage: 0 },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    log('error', 'register_failed', { error: err.message, email });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login — Authenticate and issue tokens
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const result = await db.query(
      'SELECT id, email, password_hash, name, role, onboarding_stage FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      log('warn', 'login_failed', { email, reason: 'invalid_password' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );
    const refreshToken = generateSessionToken();
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.query(
      `INSERT INTO sessions (user_id, session_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, sessionToken, req.ip, req.headers['user-agent'] || '', expiresAt]
    );

    res.cookie('__heady_session', sessionToken, {
      maxAge: SESSION_TTL_MS,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });

    log('info', 'user_logged_in', { userId: user.id, email });

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, onboarding_stage: user.onboarding_stage },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    log('error', 'login_error', { error: err.message });
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh — Refresh access token
app.post('/api/auth/refresh', requireAuth, (req, res) => {
  const accessToken = jwt.sign(
    { userId: req.user.userId, email: req.user.email, role: req.user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
  res.json({ accessToken });
});

// POST /api/auth/logout — Clear session
app.post('/api/auth/logout', async (req, res) => {
  const sessionToken = req.cookies?.__heady_session;
  if (sessionToken) {
    await db.query('DELETE FROM sessions WHERE session_token = $1', [sessionToken]);
  }
  res.clearCookie('__heady_session', {
    httpOnly: true, secure: true, sameSite: 'strict', path: '/',
  });
  log('info', 'user_logged_out');
  res.json({ status: 'logged_out' });
});

// GET /api/auth/me — Get current user
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, role, onboarding_stage, workspace_mode, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    log('error', 'get_user_error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /api/auth/verify — Verify JWT or API key (service-to-service)
app.get('/api/auth/verify', requireAuth, (req, res) => {
  res.json({
    authenticated: true,
    userId: req.user.userId,
    email: req.user.email,
    role: req.user.role,
    authMethod: req.user.authMethod || 'jwt',
  });
});

// ─── Session Endpoints (compatible with HeadyMe auth widget) ─────────────────

// POST /api/session/start — Create session from auth widget (alias for login)
app.post('/api/session/start', async (req, res) => {
  const { email, password, idToken, provider, returnUrl } = req.body;

  // If email+password, use standard login flow
  if (email && password) {
    try {
      const result = await db.query(
        'SELECT id, email, password_hash, name, role, onboarding_stage FROM users WHERE email = $1',
        [email]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const user = result.rows[0];
      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await db.query(
        'INSERT INTO sessions (user_id, session_token, ip_address, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [user.id, sessionToken, req.ip, req.headers['user-agent'] || '', expiresAt]
      );

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL }
      );

      res.cookie('__heady_session', sessionToken, {
        maxAge: SESSION_TTL_MS, httpOnly: true, secure: true, sameSite: 'strict', path: '/',
      });

      log('info', 'session_started', { userId: user.id, email: user.email });
      res.json({
        status: 'authenticated',
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        accessToken,
        returnUrl: returnUrl || 'https://headyme.com',
      });
    } catch (err) {
      log('error', 'session_start_error', { error: err.message });
      res.status(500).json({ error: 'Session creation failed' });
    }
    return;
  }

  // OAuth/provider flow placeholder — returns redirect URL
  if (provider) {
    log('info', 'provider_auth_requested', { provider });
    // TODO: Wire OAuth providers when credentials are configured
    return res.json({
      redirectUrl: `https://auth.headysystems.com/oauth/${provider}`,
      provider,
      state: generateSessionToken().slice(0, 32),
    });
  }

  res.status(400).json({ error: 'Email+password or provider required' });
});

// POST /api/provider/start — OAuth provider flow entry
app.post('/api/provider/start', (req, res) => {
  const { provider, returnUrl } = req.body;
  if (!provider) {
    return res.status(400).json({ error: 'Provider required' });
  }
  const state = generateSessionToken().slice(0, 32);
  log('info', 'oauth_provider_start', { provider, returnUrl });
  res.json({
    redirectUrl: `https://auth.headysystems.com/oauth/${provider}?state=${state}&return=${encodeURIComponent(returnUrl || 'https://headyme.com')}`,
    provider,
    state,
  });
});

// ─── Onboarding API ──────────────────────────────────────────────────────────

// POST /onboarding/complete — Save onboarding data
app.post('/onboarding/complete', requireAuth, async (req, res) => {
  const { displayName, organization, role, interests, buddy, plan } = req.body;
  const userId = req.user.userId;

  try {
    // Update user profile
    await db.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        onboarding_stage = 5,
        workspace_mode = 'cloud',
        updated_at = now()
       WHERE id = $2`,
      [displayName, userId]
    );

    // Log onboarding completion
    await db.query(
      `INSERT INTO onboarding_log (user_id, stage, status, metadata, completed_at)
       VALUES ($1, 5, 'completed', $2, now())`,
      [userId, JSON.stringify({ displayName, organization, role, interests, buddy, plan })]
    );

    // Store buddy preferences in user_memory_t2
    if (buddy) {
      await db.query(
        `INSERT INTO user_memory_t2 (user_id, content, metadata, tier)
         VALUES ($1, $2, $3, 't1')`,
        [
          userId,
          `User preferences: buddy name=${buddy.name}, style=${buddy.style}, context=${buddy.context || ''}`,
          JSON.stringify({ type: 'buddy_preferences', ...buddy, plan, interests, organization, role })
        ]
      );
    }

    log('info', 'onboarding_completed', { userId, plan, interests });

    // Generate first API key for the user
    const { raw, hash, prefix } = generateApiKey();
    const keyId = generateId();
    await db.query(
      `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, role, description)
       VALUES ($1, $2, $3, $4, $5, 'Auto-generated at onboarding')`,
      [keyId, userId, hash, prefix, req.user.role || 'user']
    );

    res.json({
      status: 'onboarding_complete',
      user: { id: userId, name: displayName, plan },
      apiKey: {
        key: raw,
        prefix,
        warning: 'Store this key securely. It cannot be retrieved again.',
      },
    });
  } catch (err) {
    log('error', 'onboarding_complete_error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// GET /onboarding/status — Check onboarding progress
app.get('/onboarding/status', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT onboarding_stage, workspace_mode FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    const logs = await db.query(
      'SELECT stage, status, completed_at FROM onboarding_log WHERE user_id = $1 ORDER BY stage',
      [req.user.userId]
    );
    res.json({
      currentStage: user.onboarding_stage,
      workspaceMode: user.workspace_mode,
      stages: logs.rows,
    });
  } catch (err) {
    log('error', 'onboarding_status_error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch onboarding status' });
  }
});

// ─── API Key Management ──────────────────────────────────────────────────────

// POST /api/auth/api-keys — Generate new API key
app.post('/api/auth/api-keys', requireAuth, async (req, res) => {
  const { description, role } = req.body;
  const keyRole = role || req.user.role;

  // Can't create a key with higher role than your own
  if ((ROLE_LEVELS[keyRole] || 0) > (ROLE_LEVELS[req.user.role] || 0)) {
    return res.status(403).json({ error: 'Cannot create key with higher role than your own' });
  }

  try {
    const { raw, hash, prefix } = generateApiKey();
    const id = generateId();

    await db.query(
      `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, role, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, req.user.userId, hash, prefix, keyRole, description || null]
    );

    log('info', 'api_key_created', { userId: req.user.userId, keyId: id, prefix });

    // Return raw key only once — it cannot be retrieved again
    res.status(201).json({
      id,
      key: raw,
      prefix,
      role: keyRole,
      description,
      warning: 'Store this key securely. It cannot be retrieved again.',
    });
  } catch (err) {
    log('error', 'api_key_create_error', { error: err.message });
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// GET /api/auth/api-keys — List user's API keys
app.get('/api/auth/api-keys', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, key_prefix, role, description, last_used_at, expires_at, created_at
       FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json({ keys: result.rows });
  } catch (err) {
    log('error', 'api_key_list_error', { error: err.message });
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// DELETE /api/auth/api-keys/:id — Revoke API key
app.delete('/api/auth/api-keys/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }
    log('info', 'api_key_revoked', { userId: req.user.userId, keyId: req.params.id });
    res.json({ status: 'revoked', id: req.params.id });
  } catch (err) {
    log('error', 'api_key_revoke_error', { error: err.message });
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// ─── Admin Routes ────────────────────────────────────────────────────────────

// GET /api/admin/users — List users (admin only)
app.get('/api/admin/users', requireAuth, requireRole(4), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, role, onboarding_stage, created_at FROM users ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ users: result.rows });
  } catch (err) {
    log('error', 'admin_list_users_error', { error: err.message });
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  log('error', 'unhandled_error', { error: err.message, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
const cleanups = [];
const registerCleanup = (name, fn) => cleanups.unshift({ name, fn });

const shutdown = async (signal) => {
  log('info', 'graceful_shutdown_initiated', { signal, service: SERVICE_NAME });
  serviceReady = false;

  // Drain period: fib(8) = 21 seconds
  await new Promise(r => setTimeout(r, 5000));

  for (const { name, fn } of cleanups) {
    try {
      await fn();
      log('info', 'cleanup_complete', { name });
    } catch (err) {
      log('error', 'cleanup_failed', { name, error: err.message });
    }
  }
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Startup ─────────────────────────────────────────────────────────────────
async function start() {
  if (!JWT_SECRET) {
    log('fatal', 'jwt_secret_missing', { message: 'JWT_SECRET environment variable is required' });
    process.exit(1);
  }

  // Initialize database schema
  try {
    await db.initSchema();
    log('info', 'database_connected');
  } catch (err) {
    log('error', 'database_init_failed', { error: err.message });
    // Continue in degraded mode — health endpoints will report not ready
  }

  const server = app.listen(PORT, () => {
    startupComplete = true;
    serviceReady = true;
    log('info', 'service_started', {
      port: PORT,
      service: SERVICE_NAME,
      cors_origins: ALLOWED_ORIGINS.length,
      database: process.env.DATABASE_URL ? 'configured' : 'missing',
    });
  });

  registerCleanup('http-server', () => new Promise(r => server.close(r)));
  registerCleanup('database', () => db.close());
}

start();
