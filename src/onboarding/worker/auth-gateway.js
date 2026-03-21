/**
 * Heady Onboarding — Cloudflare Worker Edge Auth Gateway
 * Verifies Firebase JWTs at edge, enforces rate limits, handles CORS,
 * and routes requests to Cloud Run origin.
 *
 * Environment bindings:
 *   - ORIGIN_URL        (string) Cloud Run service URL
 *   - FIREBASE_PROJECT_ID (string) Firebase project ID (heady-ai)
 *   - RATE_LIMIT         (KV namespace) per-IP rate limiting store
 */
const logger = console;


// ─── Allowed Origins ────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
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
]);

// ─── Rate Limit Config ─────────────────────────────────────────────
const RATE_LIMIT_MAX = 1000;       // requests per window
const RATE_LIMIT_WINDOW_SEC = 60;  // 1-minute window

// ─── Firebase JWKS endpoint ─────────────────────────────────────────
const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const FIREBASE_ISSUER_PREFIX = 'https://securetoken.google.com/';

// ─── JWK cache (in-memory, per-isolate) ─────────────────────────────
let jwkCache = null;
let jwkCacheExpiry = 0;
const JWK_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ─── Entry Point ────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const requestId = crypto.randomUUID();
    const start = Date.now();
    const url = new URL(request.url);
    const clientIp = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

    try {
      // 1. CORS preflight
      if (request.method === 'OPTIONS') {
        return handleCORS(request, requestId);
      }

      // 2. Rate limiting
      const rateLimited = await checkRateLimit(env, clientIp);
      if (rateLimited) {
        return jsonResponse(429, { error: 'Too Many Requests' }, requestId, request);
      }

      // 3. Health / readiness probes — passthrough (no auth)
      if (url.pathname === '/health' || url.pathname === '/ready') {
        return routeToOrigin(request, env, requestId);
      }

      // 4. Auth callback — passthrough (no JWT required)
      if (url.pathname.startsWith('/auth/callback')) {
        return routeToOrigin(request, env, requestId);
      }

      // 5. All other requests — verify JWT
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse(401, { error: 'Missing or malformed Authorization header' }, requestId, request);
      }

      const token = authHeader.slice(7);
      const payload = await verifyFirebaseJWT(token, env.FIREBASE_PROJECT_ID);
      if (!payload) {
        return jsonResponse(401, { error: 'Invalid or expired token' }, requestId, request);
      }

      // Forward with verified user info
      return routeToOrigin(request, env, requestId, payload);
    } catch (err) {
      logStructured('error', {
        requestId,
        path: url.pathname,
        clientIp,
        error: err.message,
        stack: err.stack,
        durationMs: Date.now() - start,
      });
      return jsonResponse(500, { error: 'Internal Server Error' }, requestId, request);
    }
  },
};

// ─── CORS Handling ──────────────────────────────────────────────────

function handleCORS(request, requestId) {
  const origin = request.headers.get('Origin');
  const headers = new Headers();

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('X-Request-ID', requestId);
  addSecurityHeaders(headers);

  return new Response(null, { status: 204, headers });
}

function addCORSHeaders(headers, request) {
  const origin = request.headers.get('Origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
}

// ─── Security Headers ───────────────────────────────────────────────

function addSecurityHeaders(headers) {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
}

// ─── Rate Limiting (KV-backed) ──────────────────────────────────────

async function checkRateLimit(env, clientIp) {
  const key = `rl:${clientIp}`;
  const now = Math.floor(Date.now() / 1000);

  const raw = await env.RATE_LIMIT.get(key, { type: 'json' });
  let record = raw || { count: 0, windowStart: now };

  // Window expired — reset
  if (now - record.windowStart >= RATE_LIMIT_WINDOW_SEC) {
    record = { count: 1, windowStart: now };
    await env.RATE_LIMIT.put(key, JSON.stringify(record), {
      expirationTtl: RATE_LIMIT_WINDOW_SEC * 2,
    });
    return false;
  }

  record.count += 1;

  if (record.count > RATE_LIMIT_MAX) {
    return true;
  }

  await env.RATE_LIMIT.put(key, JSON.stringify(record), {
    expirationTtl: RATE_LIMIT_WINDOW_SEC * 2,
  });
  return false;
}

// ─── JWT Verification (Web Crypto API) ──────────────────────────────

async function verifyFirebaseJWT(token, projectId) {
  // Split token
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  // Decode header to get kid
  const header = JSON.parse(base64UrlDecode(headerB64));
  if (header.alg !== 'RS256') return null;

  // Decode payload for validation
  const payload = JSON.parse(base64UrlDecode(payloadB64));

  // Time validation
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return null;          // expired
  if (payload.iat > now + 300) return null;     // issued in the future (5m grace)
  if (payload.auth_time > now) return null;     // auth_time in future

  // Issuer & audience validation
  const expectedIssuer = FIREBASE_ISSUER_PREFIX + projectId;
  if (payload.iss !== expectedIssuer) return null;
  if (payload.aud !== projectId) return null;

  // sub must be non-empty
  if (!payload.sub || typeof payload.sub !== 'string') return null;

  // Fetch matching JWK
  const jwk = await getJWK(header.kid);
  if (!jwk) return null;

  // Import public key
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  // Verify signature
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToArrayBuffer(signatureB64);

  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data);
  if (!valid) return null;

  return payload;
}

async function getJWK(kid) {
  const now = Date.now();

  // Use cached JWKs if fresh
  if (jwkCache && now < jwkCacheExpiry) {
    const match = jwkCache.find((k) => k.kid === kid);
    if (match) return match;
  }

  // Fetch fresh JWKs
  const resp = await fetch(FIREBASE_JWKS_URL);
  if (!resp.ok) return null;

  const data = await resp.json();
  jwkCache = data.keys;
  jwkCacheExpiry = now + JWK_CACHE_TTL_MS;

  return jwkCache.find((k) => k.kid === kid) || null;
}

// ─── Base64URL Helpers ──────────────────────────────────────────────

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function base64UrlToArrayBuffer(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

// ─── Route to Origin ────────────────────────────────────────────────

async function routeToOrigin(request, env, requestId, jwtPayload) {
  const originUrl = new URL(request.url);
  originUrl.protocol = 'https:';
  originUrl.hostname = new URL(env.ORIGIN_URL).hostname;
  originUrl.port = '';

  const headers = new Headers(request.headers);
  headers.set('X-Request-ID', requestId);
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '0.0.0.0');
  headers.set('X-Forwarded-Proto', 'https');

  if (jwtPayload) {
    headers.set('X-Firebase-UID', jwtPayload.sub);
    headers.set('X-Firebase-Email', jwtPayload.email || '');
    headers.set('X-Firebase-Provider', jwtPayload.firebase?.sign_in_provider || '');
  }

  const originRequest = new Request(originUrl.toString(), {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
  });

  const response = await fetch(originRequest);

  // Clone response to add our headers
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('X-Request-ID', requestId);
  addCORSHeaders(responseHeaders, request);
  addSecurityHeaders(responseHeaders);

  logStructured('info', {
    requestId,
    method: request.method,
    path: new URL(request.url).pathname,
    clientIp: request.headers.get('CF-Connecting-IP') || '0.0.0.0',
    status: response.status,
    uid: jwtPayload?.sub || null,
    durationMs: Date.now() - (parseInt(request.headers.get('CF-Request-Start') || '0', 10) || Date.now()),
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

// ─── JSON Response Helper ───────────────────────────────────────────

function jsonResponse(status, body, requestId, request) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
  });
  addSecurityHeaders(headers);
  if (request) {
    addCORSHeaders(headers, request);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

// ─── Structured Logging ─────────────────────────────────────────────

function logStructured(level, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'heady-edge-gateway',
    ...data,
  };
  logger.info(JSON.stringify(entry));
}
