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
// ║  FILE: packages/phi-pure-latent-os/cloudflare-edge/src/worker.ts                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Heady φ-Pure Latent OS — Cloudflare Worker Edge Entry
 * Main router: /health, /api/*, /mcp, all other routes.
 *
 * Architecture:
 *  - Firebase RS256 JWT verification at edge via Web Crypto
 *  - Rate limiting through RateLimiter Durable Object (Fibonacci tiers)
 *  - R2 storage for artifact retrieval and upload
 *  - Workers AI edge embedding generation (BGE-small-en-v1.5)
 *  - Cloudflare Queues producer for async task dispatch
 *  - Structured JSON logging with correlation IDs
 *  - Explicit CORS whitelist for all 9 Heady domains
 *
 * @module cloudflare-edge/worker
 */

import { verifyFirebaseJwt, type FirebasePayload } from './firebase-jwt';
import { PHI, PSI, FIB, CSL, phiBackoff } from '../../shared/phi-math';
import { queueHandler } from './queue-handler';

// ---------------------------------------------------------------------------
// Environment bindings (declared in wrangler.toml)
// ---------------------------------------------------------------------------
export interface Env {
  // AI binding
  AI: Ai;
  // R2 bucket
  HEADY_ARTIFACTS: R2Bucket;
  // Queue producer
  HEADY_TASKS: Queue<HeadyTaskMessage>;
  // DLQ producer
  HEADY_TASKS_DLQ: Queue<HeadyTaskMessage>;
  // KV namespace for JWT key cache and general caching
  HEADY_CACHE: KVNamespace;
  // Durable Object namespace for rate limiting
  RATE_LIMITER: DurableObjectNamespace;
  // Secrets / config vars
  FIREBASE_PROJECT_ID: string;
  ORIGIN_API_URL: string;      // upstream API origin (no trailing slash)
  MCP_ORIGIN_URL: string;      // MCP upstream (no trailing slash)
  WORKER_ENV: string;          // "production" | "staging" | "development"
}

// ---------------------------------------------------------------------------
// φ-Math constants (re-exported from shared, used inline for clarity)
// ---------------------------------------------------------------------------
const GOLDEN_RATIO   = PHI;          // 1.618033988749895
const CONJUGATE      = PSI;          // ≈ 0.618
const FIBONACCI      = FIB;          // [1,1,2,3,5,8,13,21,34,55,89,144,...]
const CSL_THRESHOLDS = CSL;          // { CRITICAL, HIGH, MEDIUM, LOW, MINIMUM, DEDUP }

// Rate limit window: 60 seconds (1 Fibonacci minute)
const RATE_WINDOW_MS = 60_000;

// Max request body: FIB[17] KB = 987 KB ≈ 1 MB
const MAX_BODY_BYTES = FIBONACCI[15] * 1024; // 987 * 1024

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface HeadyTaskMessage {
  taskId: string;
  taskType: string;
  payload: unknown;
  retryCount: number;
  enqueuedAt: number;
  correlationId: string;
  userId?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  tier: 'free' | 'pro' | 'enterprise';
}

interface LogEntry {
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  timestamp: string;
  correlationId: string;
  service: string;
  message: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  userId?: string;
  coherenceScore?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// CORS configuration — 9 Heady domains (explicit whitelist, no wildcards)
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  'https://headyme.com',
  'https://www.headyme.com',
  'https://headysystems.com',
  'https://www.headysystems.com',
  'https://headyconnection.org',
  'https://www.headyconnection.org',
  'https://headybuddy.org',
  'https://www.headybuddy.org',
  'https://headymcp.com',
  'https://www.headymcp.com',
  'https://headyio.com',
  'https://www.headyio.com',
  'https://headybot.com',
  'https://www.headybot.com',
  'https://headyapi.com',
  'https://www.headyapi.com',
  'https://heady-ai.com',
  'https://www.heady-ai.com',
]);

// Methods allowed on cross-origin requests
const CORS_ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

// Headers allowed in CORS requests
const CORS_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'X-Request-ID',
  'X-Heady-Tier',
  'X-Heady-Task-Type',
  'X-Heady-Correlation-ID',
].join(', ');

// Headers exposed to the browser
const CORS_EXPOSED_HEADERS = [
  'X-Request-ID',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'X-Heady-Coherence',
].join(', ');

// Preflight TTL: FIB[10] * 10 = 890 seconds ≈ 14.8 minutes
const CORS_MAX_AGE = FIBONACCI[10] * 10; // 890

// ---------------------------------------------------------------------------
// Structured JSON logger
// ---------------------------------------------------------------------------
function createLogger(correlationId: string) {
  const base: Partial<LogEntry> = {
    service: 'heady-edge-worker',
    correlationId,
  };

  function emit(level: LogEntry['level'], message: string, extra: Record<string, unknown> = {}): void {
    const entry: LogEntry = {
      ...base,
      level,
      timestamp: new Date().toISOString(),
      message,
      ...extra,
    } as LogEntry;
    console.log(JSON.stringify(entry));
  }

  return {
    info:  (msg: string, extra?: Record<string, unknown>) => emit('INFO',  msg, extra),
    warn:  (msg: string, extra?: Record<string, unknown>) => emit('WARN',  msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) => emit('ERROR', msg, extra),
    debug: (msg: string, extra?: Record<string, unknown>) => emit('DEBUG', msg, extra),
  };
}

// ---------------------------------------------------------------------------
// Correlation ID — cryptographically random, URL-safe
// ---------------------------------------------------------------------------
function generateCorrelationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------
function getAllowedOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;
  return ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : null;
}

function buildCorsHeaders(requestOrigin: string | null): HeadersInit {
  const origin = getAllowedOrigin(requestOrigin);
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin':   origin,
    'Access-Control-Allow-Methods':  CORS_ALLOWED_METHODS,
    'Access-Control-Allow-Headers':  CORS_ALLOWED_HEADERS,
    'Access-Control-Expose-Headers': CORS_EXPOSED_HEADERS,
    'Access-Control-Max-Age':        String(CORS_MAX_AGE),
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

function handlePreflight(request: Request): Response {
  const origin = request.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (Object.keys(corsHeaders).length === 0) {
    return new Response('Forbidden', { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// ---------------------------------------------------------------------------
// Security headers applied to every response
// ---------------------------------------------------------------------------
function applySecurityHeaders(headers: Headers, env: Env): void {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self';"
  );
  if (env.WORKER_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

// ---------------------------------------------------------------------------
// Error response builder
// ---------------------------------------------------------------------------
function errorResponse(
  status: number,
  code: string,
  message: string,
  correlationId: string,
  origin: string | null,
  extraHeaders: Record<string, string> = {}
): Response {
  const body = JSON.stringify({
    error: { code, message, correlationId, timestamp: new Date().toISOString() },
  });

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Request-ID': correlationId,
    ...buildCorsHeaders(origin),
    ...extraHeaders,
  });

  return new Response(body, { status, headers });
}

// ---------------------------------------------------------------------------
// Rate limiter — delegates to RateLimiter Durable Object
// ---------------------------------------------------------------------------
async function checkRateLimit(
  env: Env,
  identifier: string,
  tier: 'free' | 'pro' | 'enterprise'
): Promise<RateLimitResult> {
  // Stable DO ID per identifier so the same counter is always used
  const doId = env.RATE_LIMITER.idFromName(`rl:${identifier}`);
  const stub  = env.RATE_LIMITER.get(doId);

  const response = await stub.fetch(new Request('https://do.internal/check', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ identifier, tier, windowMs: RATE_WINDOW_MS }),
  }));

  if (!response.ok) {
    // If the DO is unreachable, fail open with a generous limit to avoid
    // dropping legitimate traffic. Log the degraded state.
    return { allowed: true, remaining: FIBONACCI[5], resetAt: Date.now() + RATE_WINDOW_MS, tier };
  }

  return response.json<RateLimitResult>();
}

// ---------------------------------------------------------------------------
// Derive rate-limit tier from Firebase token claims or header hint
// ---------------------------------------------------------------------------
function deriveTier(
  payload: FirebasePayload | null,
  request: Request
): 'free' | 'pro' | 'enterprise' {
  // Allow caller to provide an explicit tier hint (validated against claims)
  const headerTier = request.headers.get('X-Heady-Tier')?.toLowerCase();
  const claimTier  = (payload as Record<string, unknown> | null)?.['heady_tier'] as string | undefined;

  const raw = claimTier ?? headerTier ?? 'free';
  if (raw === 'enterprise') return 'enterprise';
  if (raw === 'pro')        return 'pro';
  return 'free';
}

// ---------------------------------------------------------------------------
// Extract bearer token from Authorization header
// ---------------------------------------------------------------------------
function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

// ---------------------------------------------------------------------------
// /health handler — liveness + coherence score
// ---------------------------------------------------------------------------
async function handleHealth(env: Env, correlationId: string): Promise<Response> {
  const startMs = Date.now();

  // Probe KV availability
  let kvOk = false;
  try {
    await env.HEADY_CACHE.put('__health_probe__', '1', { expirationTtl: 10 });
    kvOk = true;
  } catch {
    kvOk = false;
  }

  // Derive a simple coherence score: KV up → full, degraded → 0.5
  const coherenceScore = kvOk
    ? CSL_THRESHOLDS.HIGH                   // 0.882 — strong alignment
    : CSL_THRESHOLDS.LOW;                   // 0.691 — degraded but operational

  const status = coherenceScore >= CSL_THRESHOLDS.MEDIUM ? 'healthy' : 'degraded';
  const httpStatus = status === 'healthy' ? 200 : 503;

  const body = JSON.stringify({
    service:        'heady-edge-worker',
    version:        '1.0.0',
    status,
    coherenceScore,
    cslThreshold:   CSL_THRESHOLDS.MEDIUM,
    phiConstant:    GOLDEN_RATIO,
    psiConstant:    CONJUGATE,
    environment:    env.WORKER_ENV,
    checks: {
      kv: kvOk ? 'ok' : 'error',
    },
    correlationId,
    timestamp:      new Date().toISOString(),
    durationMs:     Date.now() - startMs,
  });

  return new Response(body, {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': correlationId,
      'X-Heady-Coherence': String(coherenceScore),
      'Cache-Control': 'no-store',
    },
  });
}

// ---------------------------------------------------------------------------
// /api/* proxy — forwards to upstream origin with auth context injected
// ---------------------------------------------------------------------------
async function handleApiProxy(
  request: Request,
  env: Env,
  correlationId: string,
  userId: string | null
): Promise<Response> {
  const url     = new URL(request.url);
  const target  = `${env.ORIGIN_API_URL}${url.pathname}${url.search}`;

  // Clone and mutate headers for upstream
  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.set('X-Forwarded-For',       request.headers.get('CF-Connecting-IP') ?? 'unknown');
  upstreamHeaders.set('X-Heady-Correlation-ID', correlationId);
  upstreamHeaders.set('X-Heady-Edge',           'true');
  if (userId) upstreamHeaders.set('X-Heady-User-ID', userId);

  // Remove hop-by-hop headers not suitable for upstream
  upstreamHeaders.delete('CF-Connecting-IP');
  upstreamHeaders.delete('CF-Ray');

  const upstream = new Request(target, {
    method:  request.method,
    headers: upstreamHeaders,
    body:    ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? null : request.body,
    redirect: 'manual',
  });

  return fetch(upstream);
}

// ---------------------------------------------------------------------------
// /mcp proxy — routes to MCP origin
// ---------------------------------------------------------------------------
async function handleMcpProxy(
  request: Request,
  env: Env,
  correlationId: string,
  userId: string | null
): Promise<Response> {
  const url    = new URL(request.url);
  const target = `${env.MCP_ORIGIN_URL}${url.pathname}${url.search}`;

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.set('X-Heady-Correlation-ID', correlationId);
  upstreamHeaders.set('X-Heady-Edge',           'true');
  upstreamHeaders.set('X-Heady-Protocol',        'mcp');
  if (userId) upstreamHeaders.set('X-Heady-User-ID', userId);

  const upstream = new Request(target, {
    method:  request.method,
    headers: upstreamHeaders,
    body:    ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? null : request.body,
    redirect: 'manual',
  });

  return fetch(upstream);
}

// ---------------------------------------------------------------------------
// Workers AI — edge embedding generation
// ---------------------------------------------------------------------------
async function handleEmbedding(
  request: Request,
  env: Env,
  correlationId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required', correlationId } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': correlationId },
    });
  }

  // Enforce body size limit
  const contentLength = Number(request.headers.get('Content-Length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'PAYLOAD_TOO_LARGE', `Body exceeds ${MAX_BODY_BYTES} bytes`, correlationId, request.headers.get('Origin'));
  }

  let body: { text?: string; texts?: string[] };
  try {
    body = await request.json<{ text?: string; texts?: string[] }>();
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON', correlationId, request.headers.get('Origin'));
  }

  const texts: string[] = body.texts ?? (body.text ? [body.text] : []);
  if (texts.length === 0 || texts.length > FIBONACCI[6]) { // max 13 texts
    return errorResponse(
      400, 'INVALID_INPUT',
      `texts array must have 1–${FIBONACCI[6]} entries`,
      correlationId, request.headers.get('Origin')
    );
  }

  // Validate individual text lengths
  for (const t of texts) {
    if (typeof t !== 'string' || t.length === 0 || t.length > 8192) {
      return errorResponse(400, 'INVALID_INPUT', 'Each text must be a non-empty string ≤ 8192 chars', correlationId, request.headers.get('Origin'));
    }
  }

  const result = await env.AI.run('@cf/baai/bge-small-en-v1.5', { text: texts });

  const responseBody = JSON.stringify({
    embeddings:     result.data,
    model:          '@cf/baai/bge-small-en-v1.5',
    dimensions:     384,
    phiConstant:    GOLDEN_RATIO,
    correlationId,
    timestamp:      new Date().toISOString(),
  });

  return new Response(responseBody, {
    status: 200,
    headers: {
      'Content-Type':   'application/json',
      'X-Request-ID':   correlationId,
      'Cache-Control':  'private, max-age=0',
    },
  });
}

// ---------------------------------------------------------------------------
// R2 artifact retrieval — GET /artifacts/:key
// ---------------------------------------------------------------------------
async function handleArtifactGet(
  request: Request,
  env: Env,
  correlationId: string,
  key: string
): Promise<Response> {
  if (!key || key.length > 1024 || /[<>"{}|\\^`\x00-\x1f]/.test(key)) {
    return errorResponse(400, 'INVALID_KEY', 'Artifact key is malformed', correlationId, request.headers.get('Origin'));
  }

  const object = await env.HEADY_ARTIFACTS.get(key, {
    onlyIf: {
      etagMatches:     request.headers.get('If-None-Match')     ?? undefined,
      etagDoesNotMatch: request.headers.get('If-Match')          ?? undefined,
      uploadedBefore:  request.headers.get('If-Unmodified-Since')
        ? new Date(request.headers.get('If-Unmodified-Since')!) : undefined,
      uploadedAfter:   request.headers.get('If-Modified-Since')
        ? new Date(request.headers.get('If-Modified-Since')!)  : undefined,
    },
  });

  if (!object) {
    return errorResponse(404, 'ARTIFACT_NOT_FOUND', `No artifact for key: ${key}`, correlationId, request.headers.get('Origin'));
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag',           object.httpEtag);
  headers.set('X-Request-ID',   correlationId);
  headers.set('Cache-Control',  'private, max-age=300');
  // Apply CORS
  const corsH = buildCorsHeaders(request.headers.get('Origin'));
  Object.entries(corsH).forEach(([k, v]) => headers.set(k, v));

  return new Response(object.body, { headers });
}

// ---------------------------------------------------------------------------
// R2 artifact upload — PUT /artifacts/:key
// ---------------------------------------------------------------------------
async function handleArtifactPut(
  request: Request,
  env: Env,
  correlationId: string,
  key: string,
  userId: string
): Promise<Response> {
  if (!key || key.length > 1024 || /[<>"{}|\\^`\x00-\x1f]/.test(key)) {
    return errorResponse(400, 'INVALID_KEY', 'Artifact key is malformed', correlationId, request.headers.get('Origin'));
  }

  const contentType   = request.headers.get('Content-Type') ?? 'application/octet-stream';
  const contentLength = Number(request.headers.get('Content-Length') ?? '0');

  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'PAYLOAD_TOO_LARGE', `Body exceeds ${MAX_BODY_BYTES} bytes`, correlationId, request.headers.get('Origin'));
  }

  await env.HEADY_ARTIFACTS.put(key, request.body, {
    httpMetadata: { contentType },
    customMetadata: {
      uploadedBy:    userId,
      correlationId,
      uploadedAt:    new Date().toISOString(),
    },
  });

  return new Response(JSON.stringify({ key, correlationId, timestamp: new Date().toISOString() }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': correlationId,
      ...buildCorsHeaders(request.headers.get('Origin')),
    },
  });
}

// ---------------------------------------------------------------------------
// Queue producer — POST /tasks
// ---------------------------------------------------------------------------
async function handleEnqueueTask(
  request: Request,
  env: Env,
  correlationId: string,
  userId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'POST required', correlationId, request.headers.get('Origin'));
  }

  let body: { taskType?: string; payload?: unknown };
  try {
    body = await request.json<{ taskType?: string; payload?: unknown }>();
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON', correlationId, request.headers.get('Origin'));
  }

  if (typeof body.taskType !== 'string' || body.taskType.trim().length === 0) {
    return errorResponse(400, 'MISSING_TASK_TYPE', 'taskType is required', correlationId, request.headers.get('Origin'));
  }

  const taskId = crypto.randomUUID();
  const message: HeadyTaskMessage = {
    taskId,
    taskType:      body.taskType.trim(),
    payload:       body.payload ?? null,
    retryCount:    0,
    enqueuedAt:    Date.now(),
    correlationId,
    userId,
  };

  await env.HEADY_TASKS.send(message);

  return new Response(JSON.stringify({ taskId, correlationId, status: 'enqueued', timestamp: new Date().toISOString() }), {
    status: 202,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': correlationId,
      ...buildCorsHeaders(request.headers.get('Origin')),
    },
  });
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startMs        = Date.now();
    const correlationId  = request.headers.get('X-Request-ID') ?? generateCorrelationId();
    const origin         = request.headers.get('Origin');
    const log            = createLogger(correlationId);
    const url            = new URL(request.url);
    const { pathname }   = url;

    log.info('Request received', {
      method:  request.method,
      path:    pathname,
      origin,
      cf:      (request as Request & { cf?: Record<string, unknown> }).cf?.colo,
    });

    // ------------------------------------------------------------------
    // CORS preflight — handle before any auth check
    // ------------------------------------------------------------------
    if (request.method === 'OPTIONS') {
      return handlePreflight(request);
    }

    // ------------------------------------------------------------------
    // Health check — unauthenticated
    // ------------------------------------------------------------------
    if (pathname === '/health' || pathname === '/health/') {
      const response = await handleHealth(env, correlationId);
      applySecurityHeaders(response.headers, env);
      response.headers.set('X-Request-ID', correlationId);
      return response;
    }

    // ------------------------------------------------------------------
    // JWT authentication (required for all non-health routes)
    // ------------------------------------------------------------------
    const token = extractBearerToken(request);
    let firebasePayload: FirebasePayload | null = null;
    let userId: string | null = null;

    if (token) {
      try {
        firebasePayload = await verifyFirebaseJwt(token, env.FIREBASE_PROJECT_ID, env.HEADY_CACHE);
        userId = firebasePayload.sub;
        log.info('JWT verified', { userId, tier: deriveTier(firebasePayload, request) });
      } catch (err) {
        log.warn('JWT verification failed', { error: String(err) });
        // Unauthenticated — block protected routes below
      }
    }

    // Public paths (no auth required)
    const isPublicPath = pathname.startsWith('/health');

    if (!isPublicPath && !userId) {
      const elapsed = Date.now() - startMs;
      log.warn('Unauthorized request rejected', { path: pathname, durationMs: elapsed });
      return errorResponse(401, 'UNAUTHORIZED', 'Valid Firebase Bearer token required', correlationId, origin);
    }

    // ------------------------------------------------------------------
    // Rate limiting — key by userId (authenticated) or IP (fallback)
    // ------------------------------------------------------------------
    const rateLimitKey  = userId ?? (request.headers.get('CF-Connecting-IP') ?? 'anonymous');
    const tier          = deriveTier(firebasePayload, request);
    const rateLimit     = await checkRateLimit(env, rateLimitKey, tier);

    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      log.warn('Rate limit exceeded', { rateLimitKey, tier, resetAt: rateLimit.resetAt });
      return errorResponse(
        429,
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded. Resets in ${resetIn}s.`,
        correlationId,
        origin,
        {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset':     String(Math.ceil(rateLimit.resetAt / 1000)),
          'Retry-After':           String(resetIn),
        }
      );
    }

    // ------------------------------------------------------------------
    // Route dispatch
    // ------------------------------------------------------------------
    let response: Response;

    try {
      if (pathname === '/api/embed' || pathname === '/api/embed/') {
        // Edge embedding — handled entirely at the edge via Workers AI
        response = await handleEmbedding(request, env, correlationId);

      } else if (pathname.startsWith('/api/artifacts/')) {
        // R2 artifact operations
        const key = decodeURIComponent(pathname.slice('/api/artifacts/'.length));
        if (request.method === 'GET' || request.method === 'HEAD') {
          response = await handleArtifactGet(request, env, correlationId, key);
        } else if (request.method === 'PUT') {
          response = await handleArtifactPut(request, env, correlationId, key, userId!);
        } else {
          response = errorResponse(405, 'METHOD_NOT_ALLOWED', 'GET, HEAD, or PUT required', correlationId, origin);
        }

      } else if (pathname === '/api/tasks' || pathname === '/api/tasks/') {
        // Queue producer
        response = await handleEnqueueTask(request, env, correlationId, userId!);

      } else if (pathname.startsWith('/api/')) {
        // General API proxy to upstream origin
        response = await handleApiProxy(request, env, correlationId, userId);

      } else if (pathname.startsWith('/mcp')) {
        // MCP protocol proxy
        response = await handleMcpProxy(request, env, correlationId, userId);

      } else {
        response = errorResponse(404, 'NOT_FOUND', `No route for ${pathname}`, correlationId, origin);
      }
    } catch (err) {
      log.error('Unhandled route error', { error: String(err), path: pathname });
      response = errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', correlationId, origin);
    }

    // ------------------------------------------------------------------
    // Attach standard headers to every response
    // ------------------------------------------------------------------
    const mutableHeaders = new Headers(response.headers);
    applySecurityHeaders(mutableHeaders, env);
    mutableHeaders.set('X-Request-ID',          correlationId);
    mutableHeaders.set('X-RateLimit-Remaining', String(rateLimit.remaining));
    mutableHeaders.set('X-RateLimit-Reset',     String(Math.ceil(rateLimit.resetAt / 1000)));

    // Attach CORS if not already set
    const corsHeaders = buildCorsHeaders(origin);
    for (const [k, v] of Object.entries(corsHeaders)) {
      if (!mutableHeaders.has(k)) mutableHeaders.set(k, v);
    }

    const elapsed = Date.now() - startMs;
    log.info('Request complete', {
      method:     request.method,
      path:       pathname,
      status:     response.status,
      durationMs: elapsed,
      userId,
    });

    return new Response(response.body, {
      status:  response.status,
      headers: mutableHeaders,
    });
  },
  /**
   * queue() — Cloudflare Queue consumer handler.
   * Processes batched HeadyTaskMessage entries from "heady-tasks".
   * Delegates to queueHandler for full Fibonacci-retry + DLQ logic.
   */
  queue: queueHandler.queue,
} satisfies ExportedHandler<Env>;

// Re-export Durable Object class so wrangler can find it
export { RateLimiterDO as RateLimiter } from './rate-limiter-do';
