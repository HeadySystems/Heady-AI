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
// ║  FILE: services/auth-session-server.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Auth Session Server — Port 3310
 * Firebase Auth relay + httpOnly session cookies + CSRF + device binding
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, phiBackoff, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate, cslBlend, cosineSimilarity } from '../shared/csl-engine-v2.js';

// ── φ-Derived Constants ──────────────────────────────────────────
const SESSION_TTL_MS       = fibonacci(17) * 1000;          // 1597s ≈ 26.6min
const REFRESH_WINDOW_MS    = fibonacci(14) * 1000;          // 377s ≈ 6.3min
const MAX_SESSIONS_PER_USER = fibonacci(8);                  // 21
const CSRF_TOKEN_BYTES     = fibonacci(9);                   // 34
const RATE_LIMIT_WINDOW_MS = fibonacci(13) * 1000;           // 233s
const RATE_LIMIT_MAX       = fibonacci(10);                  // 55 requests per window
const COOKIE_NAME          = '__Host-heady_session';
const SEED                 = 42;
const TEMP_ZERO            = 0;

// ── In-Memory Stores ─────────────────────────────────────────────
const sessions = new Map();
const rateLimits = new Map();
const csrfTokens = new Map();

// ── SHA-256 Utility ──────────────────────────────────────────────
function sha256(input) {
  return createHash('sha256').update(String(input)).digest('hex');
}

// ── Device Fingerprint ───────────────────────────────────────────
function computeFingerprint(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '0.0.0.0';
  const ua = req.headers['user-agent'] || 'unknown';
  return sha256(ip + '|' + ua + '|' + SEED);
}

// ── Rate Limiter with φ-Backoff ──────────────────────────────────
function checkRateLimit(clientId) {
  const now = Date.now();
  let bucket = rateLimits.get(clientId);
  if (!bucket || (now - bucket.windowStart) > RATE_LIMIT_WINDOW_MS) {
    bucket = { windowStart: now, count: 0, backoffAttempt: 0 };
    rateLimits.set(clientId, bucket);
  }
  bucket.count++;
  const loadFactor = bucket.count / RATE_LIMIT_MAX;
  const gateScore = 1.0 - loadFactor;
  const gateValue = cslGate(1.0, gateScore, phiThreshold(2), PSI * PSI * PSI);
  if (gateValue < PSI2) {
    bucket.backoffAttempt++;
    const delay = phiBackoff(bucket.backoffAttempt, 1000, fibonacci(13) * 1000);
    return { allowed: false, retryAfterMs: delay };
  }
  return { allowed: true, retryAfterMs: 0 };
}

// ── CSRF Token Management ────────────────────────────────────────
function generateCsrfToken(sessionId) {
  const raw = randomBytes(CSRF_TOKEN_BYTES).toString('hex');
  const token = sha256(raw + sessionId);
  csrfTokens.set(sessionId, { token, created: Date.now() });
  return token;
}

function validateCsrfToken(sessionId, providedToken) {
  const stored = csrfTokens.get(sessionId);
  if (!stored) return false;
  const age = Date.now() - stored.created;
  if (age > SESSION_TTL_MS) {
    csrfTokens.delete(sessionId);
    return false;
  }
  const expected = Buffer.from(stored.token, 'utf8');
  const provided = Buffer.from(String(providedToken), 'utf8');
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

// ── Session Operations ───────────────────────────────────────────
function createSession(userId, firebaseToken, req) {
  const fingerprint = computeFingerprint(req);
  const sessionId = sha256(randomBytes(32).toString('hex') + Date.now());
  const now = Date.now();

  // Enforce per-user session limit with φ-gated eviction
  const userSessions = [...sessions.entries()]
    .filter(([, s]) => s.userId === userId)
    .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
  while (userSessions.length >= MAX_SESSIONS_PER_USER) {
    const [oldId] = userSessions.shift();
    sessions.delete(oldId);
    csrfTokens.delete(oldId);
  }

  const session = {
    sessionId,
    userId,
    firebaseTokenHash: sha256(firebaseToken),
    fingerprint,
    created: now,
    lastAccess: now,
    expiresAt: now + SESSION_TTL_MS,
    rotationCount: 0,
    integrityHash: sha256(sessionId + userId + fingerprint + now),
  };
  sessions.set(sessionId, session);
  const csrf = generateCsrfToken(sessionId);
  return { sessionId, csrf, expiresAt: session.expiresAt };
}

function verifySession(sessionId, req) {
  const session = sessions.get(sessionId);
  if (!session) return { valid: false, reason: 'not_found' };

  const now = Date.now();
  if (now > session.expiresAt) {
    sessions.delete(sessionId);
    csrfTokens.delete(sessionId);
    return { valid: false, reason: 'expired' };
  }

  // Device binding check via CSL gate
  const currentFingerprint = computeFingerprint(req);
  const bindingMatch = session.fingerprint === currentFingerprint ? 1.0 : 0.0;
  const bindingGate = cslGate(1.0, bindingMatch, phiThreshold(4), PSI * PSI * PSI);
  if (bindingGate < phiThreshold(3)) {
    return { valid: false, reason: 'device_mismatch' };
  }

  // Sliding window refresh
  const timeToExpiry = session.expiresAt - now;
  if (timeToExpiry < REFRESH_WINDOW_MS) {
    session.expiresAt = now + SESSION_TTL_MS;
    session.rotationCount++;
    session.lastAccess = now;
    session.integrityHash = sha256(sessionId + session.userId + session.fingerprint + now);
  } else {
    session.lastAccess = now;
  }

  return {
    valid: true,
    userId: session.userId,
    rotationCount: session.rotationCount,
    expiresAt: session.expiresAt,
  };
}

function revokeSession(sessionId) {
  const existed = sessions.delete(sessionId);
  csrfTokens.delete(sessionId);
  return { revoked: existed };
}

function revokeAllUserSessions(userId) {
  let count = 0;
  for (const [id, session] of sessions) {
    if (session.userId === userId) {
      sessions.delete(id);
      csrfTokens.delete(id);
      count++;
    }
  }
  return { revokedCount: count };
}

// ── Cookie Helpers ───────────────────────────────────────────────
function buildCookieHeader(sessionId, maxAgeS) {
  return `${COOKIE_NAME}=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeS}`;
}

function parseCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';').map(s => s.trim().split('='));
  const match = pairs.find(([k]) => k === COOKIE_NAME);
  return match ? match[1] : null;
}

// ── HTTP Server ──────────────────────────────────────────────────
function createServer(port = 3310) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const clientId = computeFingerprint(req);

      // Rate limit check
      const rateCheck = checkRateLimit(clientId);
      if (!rateCheck.allowed) {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)),
        });
        res.end(JSON.stringify({ error: 'rate_limited', retryAfterMs: rateCheck.retryAfterMs }));
        return;
      }

      const respond = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      const readBody = () => new Promise((resolve) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
          catch (parseErr) { resolve({ _parseError: parseErr.message }); }
        });
      });

      if (url.pathname === '/auth/session' && req.method === 'POST') {
        const body = await readBody();
        if (!body.userId || !body.firebaseToken) {
          return respond(400, { error: 'missing_fields' });
        }
        const result = createSession(body.userId, body.firebaseToken, req);
        const maxAge = Math.floor(SESSION_TTL_MS / 1000);
        res.writeHead(201, {
          'Content-Type': 'application/json',
          'Set-Cookie': buildCookieHeader(result.sessionId, maxAge),
        });
        res.end(JSON.stringify({ csrf: result.csrf, expiresAt: result.expiresAt }));
      } else if (url.pathname === '/auth/verify' && req.method === 'GET') {
        const sessionId = parseCookie(req.headers.cookie);
        if (!sessionId) return respond(401, { error: 'no_session' });
        const result = verifySession(sessionId, req);
        respond(result.valid ? 200 : 401, result);
      } else if (url.pathname === '/auth/revoke' && req.method === 'POST') {
        const sessionId = parseCookie(req.headers.cookie);
        if (!sessionId) return respond(401, { error: 'no_session' });
        const body = await readBody();
        if (!validateCsrfToken(sessionId, body.csrf)) {
          return respond(403, { error: 'invalid_csrf' });
        }
        const result = revokeSession(sessionId);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': buildCookieHeader('', 0),
        });
        res.end(JSON.stringify(result));
      } else if (url.pathname === '/auth/revoke-all' && req.method === 'POST') {
        const body = await readBody();
        if (!body.userId) return respond(400, { error: 'missing_userId' });
        const result = revokeAllUserSessions(body.userId);
        respond(200, result);
      } else if (url.pathname === '/health') {
        respond(200, health());
      } else {
        respond(404, { error: 'not_found' });
      }
    });
    server.listen(port);
    return server;
  });
}

// ── Health ────────────────────────────────────────────────────────
const startTime = Date.now();
function health() {
  return {
    service: 'auth-session-server',
    status: 'healthy',
    port: 3310,
    uptime: Date.now() - startTime,
    activeSessions: sessions.size,
    activeCsrfTokens: csrfTokens.size,
    rateLimitBuckets: rateLimits.size,
    phiConstants: { SESSION_TTL_MS, RATE_LIMIT_MAX, MAX_SESSIONS_PER_USER },
  };
}

export default { createServer, health, createSession, verifySession, revokeSession, revokeAllUserSessions };
export { createServer, health, createSession, verifySession, revokeSession, revokeAllUserSessions };
