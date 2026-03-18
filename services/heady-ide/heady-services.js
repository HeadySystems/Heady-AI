// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Service Mesh v1.0 — All-Service Connector               ║
// ║  Initializes: Redis, Neon, Qdrant, R2, Firebase, Sentry,       ║
// ║  AI Gateway, MCP, all LLM providers, HeadyCoder stack           ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { Redis } from '@upstash/redis';
import pg from 'pg';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as Sentry from '@sentry/node';
import pino from 'pino';
import { createHeadyCoder } from './heady-coder.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377];

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'heady-services',
  base: { service: 'heady-services', version: process.env.HEADY_VERSION || '1.0.0' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// ═══════════════════════════════════════════════════════════════════
// §1 — UPSTASH REDIS (T0 Working Memory)
// ═══════════════════════════════════════════════════════════════════

function connectRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    log.warn('Redis not configured — T0 memory unavailable');
    return createRedisStub();
  }

  const redis = new Redis({ url, token });
  log.info({ url: url.replace(/\/\/.*@/, '//***@') }, 'Redis T0 connected');
  return redis;
}

function createRedisStub() {
  const store = new Map();
  return {
    get: async (k) => store.get(k) || null,
    set: async (k, v, opts) => { store.set(k, v); return 'OK'; },
    del: async (k) => { store.delete(k); return 1; },
    incrbyfloat: async (k, v) => { const n = (parseFloat(store.get(k) || '0')) + v; store.set(k, String(n)); return n; },
    lrange: async (k, start, end) => [],
    setex: async (k, ttl, v) => { store.set(k, v); return 'OK'; },
    expire: async () => 1,
    keys: async () => [...store.keys()],
    _stub: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// §2 — NEON POSTGRES (T1 Persistent Memory + pgvector)
// ═══════════════════════════════════════════════════════════════════

function connectNeon() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    log.warn('Neon not configured — T1 memory unavailable');
    return null;
  }

  const pool = new pg.Pool({
    connectionString,
    max: FIB[7],          // 13 connections
    idleTimeoutMillis: FIB[11] * 1000, // 89s
    connectionTimeoutMillis: Math.round(Math.pow(PHI, 5) * 1000), // ~11s
    ssl: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });

  pool.on('error', (err) => {
    log.error({ err: err.message }, 'Neon pool error');
    Sentry.captureException(err);
  });

  pool.on('connect', () => {
    log.debug('Neon connection acquired');
  });

  log.info({ max: FIB[7], idle: `${FIB[11]}s` }, 'Neon T1 pool created');

  return {
    query: (text, params) => pool.query(text, params),
    pool,
    async health() {
      try {
        const { rows } = await pool.query('SELECT 1 AS ok');
        return { status: 'healthy', connections: pool.totalCount };
      } catch (err) {
        return { status: 'unhealthy', error: err.message };
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// §3 — QDRANT (T2 Long-Term Vector Memory)
// ═══════════════════════════════════════════════════════════════════

function connectQdrant() {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url) {
    log.warn('Qdrant not configured — T2 memory unavailable');
    return null;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['api-key'] = apiKey;

  const client = {
    async search(collection, vector, limit = FIB[8], filter = {}) {
      const resp = await fetch(`${url}/collections/${collection}/points/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vector, limit, with_payload: true,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error(`Qdrant search failed: ${resp.status}`);
      const data = await resp.json();
      return data.result || [];
    },

    async upsert(collection, points) {
      const resp = await fetch(`${url}/collections/${collection}/points`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ points }),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error(`Qdrant upsert failed: ${resp.status}`);
      return resp.json();
    },

    async health() {
      try {
        const resp = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(5000) });
        return { status: resp.ok ? 'healthy' : 'unhealthy' };
      } catch (err) {
        return { status: 'unhealthy', error: err.message };
      }
    },
  };

  log.info({ url: url.replace(/\/\/.*@/, '//***@') }, 'Qdrant T2 connected');
  return client;
}

// ═══════════════════════════════════════════════════════════════════
// §4 — CLOUDFLARE R2 (Workspace File Storage)
// ═══════════════════════════════════════════════════════════════════

function connectR2() {
  const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET || 'heady-workspaces';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    log.warn('R2 not configured — workspace storage unavailable');
    return createR2Stub();
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const client = {
    async read(key) {
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
      const resp = await s3.send(cmd);
      return await resp.Body.transformToString();
    },

    async write(key, content, contentType = 'application/octet-stream') {
      const cmd = new PutObjectCommand({
        Bucket: bucket, Key: key, Body: content, ContentType: contentType,
      });
      return s3.send(cmd);
    },

    async remove(key) {
      const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
      return s3.send(cmd);
    },

    async list(prefix, maxKeys = 1000) {
      const cmd = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: maxKeys });
      const resp = await s3.send(cmd);
      return (resp.Contents || []).map(o => ({ key: o.Key, size: o.Size, modified: o.LastModified }));
    },

    async listTree(prefix) {
      const files = await this.list(prefix);
      return files.map(f => f.key).join('\n');
    },

    async health() {
      try {
        await this.list('__health__', 1);
        return { status: 'healthy' };
      } catch (err) {
        return { status: 'unhealthy', error: err.message };
      }
    },
  };

  log.info({ bucket }, 'R2 storage connected');
  return client;
}

function createR2Stub() {
  const store = new Map();
  return {
    read: async (k) => store.get(k) || '',
    write: async (k, v) => { store.set(k, v); },
    remove: async (k) => { store.delete(k); },
    list: async (prefix) => [...store.keys()].filter(k => k.startsWith(prefix || '')).map(k => ({ key: k })),
    listTree: async (prefix) => [...store.keys()].filter(k => k.startsWith(prefix || '')).join('\n'),
    health: async () => ({ status: 'stub' }),
    _stub: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// §5 — FIREBASE AUTH (27 OAuth Providers + SSO)
// ═══════════════════════════════════════════════════════════════════

function connectFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0920560496';
  const apiKey = process.env.FIREBASE_API_KEY;

  if (!apiKey) {
    log.warn('Firebase not configured — auth unavailable');
    return null;
  }

  const client = {
    projectId,

    async verifyToken(idToken) {
      // Verify via Firebase REST API (no admin SDK needed on Cloud Run)
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
          signal: AbortSignal.timeout(5000),
        }
      );
      if (!resp.ok) throw new Error(`Firebase verify failed: ${resp.status}`);
      const data = await resp.json();
      return data.users?.[0] || null;
    },

    async verifySessionCookie(cookie) {
      // For Cloud Run: validate session cookie server-side
      // In production, use firebase-admin SDK with service account
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: cookie }),
          signal: AbortSignal.timeout(5000),
        }
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.users?.[0] || null;
    },

    extractTenantId(user) {
      return user?.localId || user?.uid || 'anonymous';
    },
  };

  log.info({ projectId }, 'Firebase Auth connected');
  return client;
}

// ═══════════════════════════════════════════════════════════════════
// §6 — SENTRY (Observability + Error Fortress)
// ═══════════════════════════════════════════════════════════════════

function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    log.warn('Sentry not configured — observability limited');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    release: `heady@${process.env.HEADY_VERSION || '1.0.0'}`,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: 0.1,

    beforeSend(event) {
      // Noise filter — drop non-actionable errors
      const msg = event.message || event.exception?.values?.[0]?.value || '';
      const noise = [
        'ECONNRESET', 'EPIPE', 'ETIMEDOUT',
        'AbortError', 'fetch failed', 'network error',
      ];
      if (noise.some(n => msg.includes(n))) return null;
      return event;
    },

    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });

  log.info('Sentry initialized');
}

// ═══════════════════════════════════════════════════════════════════
// §7 — EMBEDDING SERVICE (HuggingFace 3-token rotation)
// ═══════════════════════════════════════════════════════════════════

function createEmbedder() {
  const tokens = [
    process.env.HF_TOKEN,
    process.env.HF_TOKEN_2,
    process.env.HF_TOKEN_3,
  ].filter(Boolean);

  if (tokens.length === 0) {
    log.warn('No HF tokens — embeddings will use Gemini fallback');
  }

  let tokenIndex = 0;
  const model = process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';

  return async function embed(text) {
    const input = Array.isArray(text) ? text : [text];

    // Try HuggingFace first (round-robin tokens)
    if (tokens.length > 0) {
      const token = tokens[tokenIndex % tokens.length];
      tokenIndex++;

      try {
        const resp = await fetch(`https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: input, options: { wait_for_model: true } }),
          signal: AbortSignal.timeout(10000),
        });

        if (resp.ok) {
          const data = await resp.json();
          return Array.isArray(data[0]?.[0]) ? data : [data];
        }

        if (resp.status === 429) {
          log.debug({ tokenIdx: (tokenIndex - 1) % tokens.length }, 'HF rate limited — rotating');
          // Fall through to Gemini
        }
      } catch { /* fall through */ }
    }

    // Fallback: Gemini Embedding (free tier)
    if (process.env.GEMINI_API_KEY) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: { parts: [{ text: input[0] }] } }),
            signal: AbortSignal.timeout(10000),
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          return [data.embedding?.values || []];
        }
      } catch { /* fall through */ }
    }

    log.warn('All embedding providers failed');
    return [new Array(384).fill(0)]; // zero vector fallback
  };
}

// ═══════════════════════════════════════════════════════════════════
// §8 — HEALTH CHECK (aggregated across all services)
// ═══════════════════════════════════════════════════════════════════

async function aggregateHealth(services) {
  const checks = await Promise.allSettled([
    services.redis._stub ? Promise.resolve({ status: 'stub' }) : services.redis.get('__health__').then(() => ({ status: 'healthy' })),
    services.db?.health() || Promise.resolve({ status: 'unconfigured' }),
    services.qdrant?.health() || Promise.resolve({ status: 'unconfigured' }),
    services.r2?.health() || Promise.resolve({ status: 'unconfigured' }),
  ]);

  const names = ['redis_t0', 'neon_t1', 'qdrant_t2', 'r2_storage'];
  const results = {};
  let allHealthy = true;

  checks.forEach((c, i) => {
    const val = c.status === 'fulfilled' ? c.value : { status: 'error', error: c.reason?.message };
    results[names[i]] = val;
    if (val.status !== 'healthy' && val.status !== 'stub') allHealthy = false;
  });

  // φ-scored aggregate health
  const healthyCount = Object.values(results).filter(r => r.status === 'healthy').length;
  const totalChecks = names.length;
  const phiHealth = Math.min(PHI, (healthyCount / totalChecks) * PHI); // 0.0 to 1.618

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    phiScore: Math.round(phiHealth * 1000) / 1000,
    services: results,
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// §9 — MASTER BOOTSTRAP
//
// Single function that initializes EVERYTHING and returns the
// unified dependency object consumed by all Heady modules.
// ═══════════════════════════════════════════════════════════════════

/**
 * Boot all Heady services. Returns a unified deps object.
 *
 * @returns {Object} deps — pass this to createHeadyCoder(), HeadyAutoContext, etc.
 */
export async function bootHeadyServices(opts = {}) {
  const startTime = Date.now();
  log.info('═══ HEADY SERVICE MESH BOOTING ═══');

  // Phase 1: Observability (first, so everything else is traced)
  initSentry();

  // Phase 2: Data stores (parallel)
  const [redis, db, qdrant, r2, firebase] = await Promise.all([
    Promise.resolve(connectRedis()),
    Promise.resolve(connectNeon()),
    Promise.resolve(connectQdrant()),
    Promise.resolve(connectR2()),
    Promise.resolve(connectFirebase()),
  ]);

  // Phase 3: Embedding service
  const embed = createEmbedder();

  // Phase 4: Tenant context
  const tenantId = opts.tenantId || 'system';

  // Phase 5: Filesystem adapter for IDE (wraps R2)
  const workspacePrefix = opts.workspacePrefix || `tenant:${tenantId}/workspace/`;
  const fs = {
    read: (path) => r2.read(workspacePrefix + path),
    write: (path, content) => r2.write(workspacePrefix + path, content),
    remove: (path) => r2.remove(workspacePrefix + path),
    list: (prefix) => r2.list(workspacePrefix + (prefix || '')),
    listTree: (prefix) => r2.listTree(workspacePrefix + (prefix || '')),
    exec: async (cmd) => {
      // Terminal commands go through the IDE server's WS terminal
      // This is a placeholder — real exec happens via terminal-server.js
      log.debug({ cmd }, 'fs.exec stub — route through terminal WS');
      return '';
    },
  };

  // Phase 6: HeadyCoder stack (AutoContext + Coder + Codex + Jules)
  const heady = createHeadyCoder({ redis, db, qdrant, embed, fs, tenantId });

  // Phase 7: Health check function
  const services = { redis, db, qdrant, r2, firebase, embed, fs, heady, tenantId };
  services.health = () => aggregateHealth(services);

  const bootMs = Date.now() - startTime;
  log.info({
    bootMs,
    redis: redis._stub ? 'stub' : 'live',
    neon: db ? 'live' : 'off',
    qdrant: qdrant ? 'live' : 'off',
    r2: r2._stub ? 'stub' : 'live',
    firebase: firebase ? 'live' : 'off',
    providers: Object.keys(heady.providers).length,
  }, `═══ HEADY SERVICES ONLINE (${bootMs}ms) ═══`);

  return services;
}

/**
 * Graceful shutdown.
 */
export async function shutdownHeadyServices(services) {
  log.info('Shutting down Heady services...');

  if (services.heady?.stop) services.heady.stop();
  if (services.db?.pool) await services.db.pool.end();

  await Sentry.close(2000);
  log.info('All services stopped');
}

export { connectRedis, connectNeon, connectQdrant, connectR2, connectFirebase, initSentry, createEmbedder, aggregateHealth };
export default { bootHeadyServices, shutdownHeadyServices };
