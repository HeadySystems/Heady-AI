// ═══════════════════════════════════════════════════════════════════════════════
// HeadyBuddy Chat API Server v2.1.0
// Gemini 2.5 Flash → Workers AI → Echo Fallback
// 384D pgvector Memory + Hybrid RRF Search + Persistent Conversations
// Sacred Geometry Layer: Middle
// ═══════════════════════════════════════════════════════════════════════════════

// Sentry instrumentation — MUST be first import
import './instrument.js';
import Sentry from './instrument.js';

import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { GoogleGenAI } from '@google/genai';
import { neon } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
import pino from 'pino';

// ─── Phi-Math Constants ──────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];
const EMBEDDING_DIM = 384;
const HF_TIMEOUT_MS = Math.round(PHI * PHI * PHI * 1000); // 4236ms
const SESSION_CACHE_TTL = FIB[8] * 60; // 21 minutes in seconds (phi-scaled)
const RATE_LIMIT_WINDOW = 60; // 1 minute window
const RATE_LIMIT_MAX = FIB[11]; // 89 requests per minute

// ─── Pino Logger with GCP Severity Formatter ─────────────────────────────────
const GCP_SEVERITY_MAP = {
  10: 'DEBUG',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARNING',
  50: 'ERROR',
  60: 'CRITICAL',
};

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'heady-buddy-api',
  base: { service: 'heady-buddy', version: '2.1.0', layer: 'Middle' },
  formatters: {
    level(label, number) {
      return {
        severity: GCP_SEVERITY_MAP[number] || 'DEFAULT',
        level: label,
      };
    },
  },
  messageKey: 'message',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

// ─── Environment ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3002;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CF_AI_TOKEN = process.env.CF_AI_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL;
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN;

// HuggingFace token rotation (3-token)
const HF_TOKENS = [
  process.env.HF_TOKEN_1,
  process.env.HF_TOKEN_2,
  process.env.HF_TOKEN_3,
].filter(Boolean);
let hfTokenIndex = 0;

function getNextHFToken() {
  if (HF_TOKENS.length === 0) return null;
  const token = HF_TOKENS[hfTokenIndex % HF_TOKENS.length];
  hfTokenIndex++;
  return token;
}

// ─── System Prompt ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are HeadyBuddy, an AI companion built by HeadySystems. You help users understand and interact with the Heady ecosystem — a sovereign AI platform with 9 domains, 384D vector memory, Continuous Semantic Logic (CSL), and Sacred Geometry orchestration. Be helpful, concise, and knowledgeable about AI, coding, and the Heady platform. Eric Haywood is the founder.`;

// ─── CORS — All 9 Heady Domains + Subdomains ────────────────────────────────
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
      if (hostname === domain || hostname === `www.${domain}`) return true;
      if (hostname.endsWith(`.${domain}`)) return true;
    }
    if (NODE_ENV === 'development' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Google GenAI (Gemini 2.5 Flash) ─────────────────────────────────────────
let genai = null;
let geminiReady = false;

function initGemini() {
  if (!GEMINI_API_KEY) {
    log.warn('GEMINI_API_KEY not set — Gemini provider disabled');
    return;
  }
  try {
    genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    geminiReady = true;
    log.info('Google GenAI initialized (Gemini 2.5 Flash)');
  } catch (err) {
    log.error({ err: err.message }, 'Google GenAI init failed');
    geminiReady = false;
  }
}

// ─── Neon Postgres (pooler / transaction mode) ───────────────────────────────
let sql = null;
let dbReady = false;

async function initDatabase() {
  if (!DATABASE_URL) {
    log.warn('DATABASE_URL not set — Postgres operations will be skipped');
    return;
  }
  try {
    sql = neon(DATABASE_URL);

    await sql`CREATE EXTENSION IF NOT EXISTS vector`;

    // Conversations table — groups messages into sessions
    await sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        session_id TEXT,
        title TEXT,
        model TEXT,
        message_count INTEGER DEFAULT 0,
        csl_score REAL DEFAULT 0.618,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations (user_id, updated_at DESC)`;

    // Messages table — individual messages with embeddings
    await sql`
      CREATE TABLE IF NOT EXISTS buddy_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL,
        device_id TEXT,
        role TEXT NOT NULL CHECK (role IN ('user', 'buddy', 'system')),
        text TEXT NOT NULL,
        node TEXT,
        origin TEXT,
        csl_score REAL DEFAULT 0.618,
        embedding vector(384),
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_buddy_msg_tenant ON buddy_messages (tenant_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_buddy_msg_conv ON buddy_messages (conversation_id, created_at ASC)`;

    // Full-text search index for keyword matching (used in hybrid RRF)
    await sql`
      CREATE INDEX IF NOT EXISTS idx_buddy_msg_text_search
      ON buddy_messages USING gin (to_tsvector('english', text))
    `;

    // HNSW index for fast cosine similarity search
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_buddy_msg_embedding
        ON buddy_messages USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `;
    } catch (err) {
      log.warn({ err: err.message }, 'HNSW index creation skipped');
    }

    dbReady = true;
    log.info('Neon Postgres initialized — conversations + buddy_messages tables ensured');
  } catch (err) {
    log.error({ err: err.message }, 'Neon Postgres init failed');
    dbReady = false;
  }
}

// ─── Upstash Redis ───────────────────────────────────────────────────────────
let redis = null;
let redisReady = false;

async function initRedis() {
  if (!UPSTASH_REDIS_URL || !UPSTASH_REDIS_TOKEN) {
    log.warn('Upstash Redis not configured — caching and rate limiting disabled');
    return;
  }
  try {
    redis = new Redis({
      url: UPSTASH_REDIS_URL,
      token: UPSTASH_REDIS_TOKEN,
    });
    // Verify connectivity
    await redis.ping();
    redisReady = true;
    log.info('Upstash Redis initialized and verified');
  } catch (err) {
    log.error({ err: err.message }, 'Upstash Redis init failed');
    redisReady = false;
  }
}

// ─── Redis Rate Limiting (89 req/min, Fibonacci) ─────────────────────────────
async function checkRateLimit(userId) {
  if (!redisReady || !redis) return { allowed: true, remaining: RATE_LIMIT_MAX };
  const key = `rl:buddy:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW);
    }
    const remaining = Math.max(0, RATE_LIMIT_MAX - count);
    return { allowed: count <= RATE_LIMIT_MAX, remaining, count };
  } catch (err) {
    log.warn({ err: err.message }, 'Rate limit check failed — allowing request');
    return { allowed: true, remaining: RATE_LIMIT_MAX };
  }
}

// ─── Redis Cache Helpers ─────────────────────────────────────────────────────
async function getCache(key) {
  if (!redisReady || !redis) return null;
  try {
    return await redis.get(key);
  } catch (err) {
    log.warn({ err: err.message }, 'Redis cache read failed');
    return null;
  }
}

async function setCache(key, value, ttl) {
  if (!redisReady || !redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttl || SESSION_CACHE_TTL });
  } catch (err) {
    log.warn({ err: err.message }, 'Redis cache write failed');
  }
}

// ─── HuggingFace 384D Embedding Generation ───────────────────────────────────
async function generateEmbedding(text) {
  const token = getNextHFToken();
  if (!token) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);

  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text.slice(0, 512),
          options: { wait_for_model: true },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      log.warn({ status: response.status }, 'HuggingFace API error');
      return null;
    }

    const result = await response.json();
    if (Array.isArray(result) && result.length === EMBEDDING_DIM && typeof result[0] === 'number') {
      return result;
    }
    if (Array.isArray(result) && Array.isArray(result[0]) && result[0].length === EMBEDDING_DIM) {
      return result[0];
    }
    log.warn({ shape: Array.isArray(result) ? result.length : typeof result }, 'Unexpected embedding shape');
    return null;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      log.warn({ timeoutMs: HF_TIMEOUT_MS }, 'HuggingFace embedding request timed out');
    } else {
      log.error({ err: err.message }, 'HuggingFace embedding generation failed');
    }
    return null;
  }
}

// ─── LLM Provider: Gemini 2.5 Flash via @google/genai ────────────────────────
async function callGemini(systemPrompt, messages) {
  if (!geminiReady || !genai) return null;

  const span = Sentry?.startSpan?.({ name: 'llm.gemini', op: 'ai.generate' });
  try {
    // Build contents: alternating user/model turns
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' || msg.role === 'buddy' ? 'model' : 'user',
      parts: [{ text: msg.content || msg.text || '' }],
    }));

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
        abortSignal: AbortSignal.timeout(20000),
      },
    });

    const text = response.text;
    if (text) {
      log.info({ provider: 'gemini-2.5-flash', len: text.length }, 'Gemini response received');
      return { text, provider: 'gemini-2.5-flash' };
    }

    log.warn('Gemini returned no text');
    return null;
  } catch (err) {
    log.error({ err: err.message }, 'Gemini call failed');
    Sentry?.captureException?.(err);
    return null;
  } finally {
    span?.end?.();
  }
}

// ─── LLM Provider: Cloudflare Workers AI ─────────────────────────────────────
async function callWorkersAI(systemPrompt, messages) {
  if (!CF_AI_TOKEN || !CF_ACCOUNT_ID) return null;

  const span = Sentry?.startSpan?.({ name: 'llm.workers-ai', op: 'ai.generate' });
  try {
    const cfMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === 'buddy' ? 'assistant' : m.role,
        content: m.content || m.text || '',
      })),
    ];

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CF_AI_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: cfMessages }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      log.warn({ status: response.status }, 'Workers AI error');
      return null;
    }

    const data = await response.json();
    const text = data?.result?.response;
    if (text) {
      log.info({ provider: 'workers-ai', len: text.length }, 'Workers AI response received');
      return { text, provider: 'workers-ai' };
    }
    return null;
  } catch (err) {
    log.error({ err: err.message }, 'Workers AI call failed');
    Sentry?.captureException?.(err);
    return null;
  } finally {
    span?.end?.();
  }
}

// ─── LLM Fallback: Echo-Style Response ───────────────────────────────────────
function echoFallback(message) {
  const responses = [
    `I understand you're asking about "${message.slice(0, 80)}". I'm currently operating in offline mode — my LLM providers are unavailable. Please try again shortly, or reach out through HeadySystems for direct support.`,
    `Thanks for reaching out! I'm HeadyBuddy, running in fallback mode right now. Your message has been stored and I'll be back to full capability soon. The Heady ecosystem spans 9 domains with 384D vector memory — ask me anything once I'm reconnected!`,
    `I received your message. I'm temporarily operating without my language model backends (Gemini/Workers AI). Your conversation is being saved. Eric Haywood and the HeadySystems team are working to keep all services running at peak coherence (\u03C8=${PSI}).`,
  ];
  const idx = Math.abs(hashCode(message)) % responses.length;
  return { text: responses[idx], provider: 'fallback' };
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash;
}

// ─── Conversation Management ─────────────────────────────────────────────────
async function getOrCreateConversation(userId, sessionId) {
  if (!dbReady || !sql) return null;
  try {
    // Try to find existing conversation for this session
    if (sessionId) {
      const existing = await sql`
        SELECT id FROM conversations
        WHERE user_id = ${userId} AND session_id = ${sessionId}
        LIMIT 1
      `;
      if (existing[0]) return existing[0].id;
    }

    // Create new conversation
    const sid = sessionId || `session_${Date.now()}`;
    const result = await sql`
      INSERT INTO conversations (user_id, session_id, model, csl_score)
      VALUES (${userId}, ${sid}, 'gemini-2.5-flash', ${PSI})
      RETURNING id
    `;
    return result[0]?.id || null;
  } catch (err) {
    log.error({ err: err.message }, 'Conversation creation failed');
    return null;
  }
}

async function persistMessage(conversationId, tenantId, role, text, node, origin, embedding, deviceId) {
  if (!dbReady || !sql) return null;
  try {
    const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;
    const result = await sql`
      INSERT INTO buddy_messages (conversation_id, tenant_id, device_id, role, text, node, origin, csl_score, embedding)
      VALUES (
        ${conversationId},
        ${tenantId},
        ${deviceId || null},
        ${role},
        ${text},
        ${node || null},
        ${origin || null},
        ${PSI},
        ${embeddingStr}::vector
      )
      RETURNING id
    `;

    // Update conversation message count + timestamp
    if (conversationId) {
      sql`
        UPDATE conversations
        SET message_count = message_count + 1, updated_at = now()
        WHERE id = ${conversationId}
      `.catch((err) => log.warn({ err: err.message }, 'Conversation count update failed'));
    }

    return result[0]?.id || null;
  } catch (err) {
    log.error({ err: err.message, tenantId, role }, 'Message persistence failed');
    return null;
  }
}

// ─── Hybrid RRF Context Retrieval ────────────────────────────────────────────
// Reciprocal Rank Fusion: combines vector similarity + keyword search
// RRF(d) = Σ 1 / (k + rank_i(d)) where k = 60
const RRF_K = 60;

async function hybridRRFSearch(tenantId, query, queryEmbedding, topK = 5) {
  if (!dbReady || !sql) return [];

  const span = Sentry?.startSpan?.({ name: 'db.hybrid_rrf_search', op: 'db.query' });
  try {
    // Vector similarity search
    let vectorResults = [];
    if (queryEmbedding) {
      const embeddingStr = `[${queryEmbedding.join(',')}]`;
      vectorResults = await sql`
        SELECT id, text, role, node, csl_score,
               1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM buddy_messages
        WHERE tenant_id = ${tenantId}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${topK * 2}
      `;
    }

    // Full-text keyword search
    const keywordResults = await sql`
      SELECT id, text, role, node, csl_score,
             ts_rank(to_tsvector('english', text), plainto_tsquery('english', ${query})) AS rank
      FROM buddy_messages
      WHERE tenant_id = ${tenantId}
        AND to_tsvector('english', text) @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${topK * 2}
    `;

    // Build RRF scores
    const scoreMap = new Map();

    vectorResults.forEach((row, idx) => {
      const entry = scoreMap.get(row.id) || { ...row, rrfScore: 0 };
      entry.rrfScore += 1 / (RRF_K + idx + 1);
      entry.similarity = row.similarity;
      scoreMap.set(row.id, entry);
    });

    keywordResults.forEach((row, idx) => {
      const entry = scoreMap.get(row.id) || { ...row, rrfScore: 0 };
      entry.rrfScore += 1 / (RRF_K + idx + 1);
      entry.keywordRank = row.rank;
      scoreMap.set(row.id, entry);
    });

    // Sort by RRF score descending, take top K
    const fused = [...scoreMap.values()]
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, topK)
      .filter((r) => r.rrfScore > 0.005); // minimum relevance threshold

    return fused;
  } catch (err) {
    log.error({ err: err.message, tenantId }, 'Hybrid RRF search failed');
    return [];
  } finally {
    span?.end?.();
  }
}

// ─── Load Conversation Context from DB ───────────────────────────────────────
async function loadConversationContext(tenantId, conversationId, limit) {
  if (!dbReady || !sql) return [];
  try {
    const contextLimit = limit || FIB[8]; // 21 messages
    if (conversationId) {
      return await sql`
        SELECT role, text AS content, created_at
        FROM buddy_messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC
        LIMIT ${contextLimit}
      `;
    }
    // Fallback: latest messages for this user
    const rows = await sql`
      SELECT role, text AS content, created_at
      FROM buddy_messages
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${contextLimit}
    `;
    rows.reverse();
    return rows;
  } catch (err) {
    log.error({ err: err.message }, 'Conversation context load failed');
    return [];
  }
}

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Heady-User-Id, X-Device-Id, X-Session-Id');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// User identification middleware
app.use((req, _res, next) => {
  req.headyUserId = req.headers['x-heady-user-id'] || req.cookies?.__heady_uid || null;
  req.deviceId = req.headers['x-device-id'] || null;
  req.sessionId = req.headers['x-session-id'] || null;
  next();
});

// Rate limiting middleware for /api/ routes
app.use('/api/', async (req, res, next) => {
  const userId = req.headyUserId || req.ip || 'anonymous';
  const { allowed, remaining, count } = await checkRateLimit(userId);

  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Window', `${RATE_LIMIT_WINDOW}s`);

  if (!allowed) {
    log.warn({ userId, count }, 'Rate limit exceeded');
    res.status(429).json({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMITED',
      limit: RATE_LIMIT_MAX,
      window: `${RATE_LIMIT_WINDOW}s`,
      retryAfter: RATE_LIMIT_WINDOW,
      phi: PHI,
    });
    return;
  }
  next();
});

// ─── GET /health — Dependency Status ─────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const uptime = process.uptime();
  const coherenceScore = PSI + (Math.sin(uptime * PSI) * 0.1);

  const health = {
    status: 'healthy',
    service: 'heady-buddy-api',
    version: '2.1.0',
    layer: 'Middle',
    uptime: Math.round(uptime),
    coherenceScore: Math.round(coherenceScore * 1000) / 1000,
    phi: PHI,
    psi: PSI,
    embeddingDim: EMBEDDING_DIM,
    rateLimiting: `${RATE_LIMIT_MAX} req/${RATE_LIMIT_WINDOW}s (FIB[${FIB.indexOf(RATE_LIMIT_MAX)}])`,
    dependencies: {
      postgres: 'not_configured',
      redis: 'not_configured',
      gemini: 'not_configured',
      workersAI: 'not_configured',
      huggingface: 'not_configured',
      sentry: 'not_configured',
    },
    timestamp: new Date().toISOString(),
  };

  // Probe Postgres
  if (!DATABASE_URL) {
    health.dependencies.postgres = 'not_configured';
  } else if (!dbReady || !sql) {
    health.dependencies.postgres = 'init_failed';
    health.status = 'degraded';
  } else {
    try {
      const result = await sql`SELECT count(*) AS cnt FROM buddy_messages LIMIT 1`;
      health.dependencies.postgres = 'connected';
      health.dependencies.postgresMessageCount = result[0]?.cnt ?? 0;
    } catch (err) {
      health.dependencies.postgres = 'error';
      health.dependencies.postgresError = err.message;
      health.status = 'degraded';
    }
  }

  // Probe Redis
  if (!UPSTASH_REDIS_URL) {
    health.dependencies.redis = 'not_configured';
  } else if (!redisReady || !redis) {
    health.dependencies.redis = 'init_failed';
  } else {
    try {
      const pong = await redis.ping();
      health.dependencies.redis = pong === 'PONG' ? 'connected' : 'degraded';
    } catch (err) {
      health.dependencies.redis = 'error';
      health.status = 'degraded';
    }
  }

  // Gemini
  health.dependencies.gemini = geminiReady ? 'connected' : (GEMINI_API_KEY ? 'init_failed' : 'not_configured');

  // Workers AI
  health.dependencies.workersAI = (CF_AI_TOKEN && CF_ACCOUNT_ID) ? 'configured' : 'not_configured';

  // HuggingFace
  health.dependencies.huggingface = HF_TOKENS.length > 0
    ? `configured (${HF_TOKENS.length} token${HF_TOKENS.length > 1 ? 's' : ''})`
    : 'not_configured';

  // Sentry
  health.dependencies.sentry = process.env.SENTRY_DSN ? 'configured' : 'not_configured';

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// ─── POST /api/brain/chat — Main Chat Endpoint ──────────────────────────────
app.post('/api/brain/chat', async (req, res) => {
  const startTime = Date.now();
  const span = Sentry?.startSpan?.({ name: 'chat.process', op: 'http.handler' });

  try {
    const { message, user, history, context } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required and must be a string', code: 'MISSING_MESSAGE' });
      return;
    }

    const tenantId = user || req.headyUserId || 'anonymous';
    const deviceId = req.deviceId;
    const sessionId = req.sessionId;

    log.info({ tenantId, messageLen: message.length, historyLen: history?.length || 0 }, 'Chat request');

    // Check Redis cache for dedup
    const cacheKey = `buddy:chat:${tenantId}:${hashCode(message)}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      log.info({ tenantId, fromCache: true }, 'Returning cached response');
      res.json({ response: parsed.response, node: 'PERSONA', fromCache: true, phi: PHI });
      return;
    }

    // Get or create conversation
    const conversationId = await getOrCreateConversation(tenantId, sessionId);

    // Load stored conversation context if user is authenticated
    let dbContext = [];
    if (tenantId !== 'anonymous') {
      // Check conversation context cache
      const ctxCacheKey = `buddy:ctx:${tenantId}:${conversationId || 'latest'}`;
      const cachedCtx = await getCache(ctxCacheKey);
      if (cachedCtx) {
        dbContext = typeof cachedCtx === 'string' ? JSON.parse(cachedCtx) : cachedCtx;
      } else {
        dbContext = await loadConversationContext(tenantId, conversationId);
        if (dbContext.length > 0) {
          await setCache(ctxCacheKey, dbContext, SESSION_CACHE_TTL);
        }
      }
    }

    // Generate embedding for semantic context recall
    const messageEmbedding = await generateEmbedding(message);

    // Hybrid RRF search for relevant context
    const recalledFacts = await hybridRRFSearch(tenantId, message, messageEmbedding, FIB[4]); // top 3

    // Build enriched system prompt
    let enrichedSystemPrompt = SYSTEM_PROMPT;
    if (recalledFacts.length > 0) {
      const contextBlock = recalledFacts
        .map((f) => `- [rrf:${f.rrfScore.toFixed(3)}] ${f.text.slice(0, 200)}`)
        .join('\n');
      enrichedSystemPrompt += `\n\nRelevant context from memory (hybrid RRF ranked):\n${contextBlock}`;
    }
    if (context) {
      enrichedSystemPrompt += `\n\nAdditional context: ${typeof context === 'string' ? context : JSON.stringify(context)}`;
    }

    // Build messages array: DB context → client history → current message
    const conversationMessages = [];

    // Add DB-loaded context (oldest first)
    for (const row of dbContext.slice(-FIB[6])) { // last 8 from DB
      conversationMessages.push({
        role: row.role === 'buddy' ? 'assistant' : row.role,
        content: row.content || row.text || '',
      });
    }

    // Add client-provided history
    if (Array.isArray(history)) {
      for (const h of history.slice(-FIB[7])) { // last 21 from client
        conversationMessages.push({
          role: h.role === 'buddy' || h.role === 'assistant' ? 'assistant' : h.role,
          content: h.content || h.text || '',
        });
      }
    }

    conversationMessages.push({ role: 'user', content: message });

    // Fallback chain: Gemini 2.5 Flash → Workers AI → echo
    let llmResult = await callGemini(enrichedSystemPrompt, conversationMessages);
    if (!llmResult) {
      llmResult = await callWorkersAI(enrichedSystemPrompt, conversationMessages);
    }
    if (!llmResult) {
      llmResult = echoFallback(message);
    }

    const responseText = llmResult.text;
    const provider = llmResult.provider;

    // Persist messages (fire-and-forget)
    const responseEmbedding = await generateEmbedding(responseText);
    Promise.allSettled([
      persistMessage(conversationId, tenantId, 'user', message, 'PERSONA', provider, messageEmbedding, deviceId),
      persistMessage(conversationId, tenantId, 'buddy', responseText, 'PERSONA', provider, responseEmbedding, deviceId),
    ]).catch((err) => log.error({ err: err?.message }, 'Background persistence error'));

    // Invalidate conversation context cache
    if (conversationId) {
      const ctxCacheKey = `buddy:ctx:${tenantId}:${conversationId}`;
      redis?.del?.(ctxCacheKey)?.catch?.(() => {});
    }

    // Cache this response for dedup
    await setCache(cacheKey, { response: responseText }, FIB[10]); // 55s TTL

    const duration = Date.now() - startTime;
    log.info({ tenantId, provider, duration, fromCache: false }, 'Chat response generated');

    res.json({
      response: responseText,
      node: 'PERSONA',
      fromCache: false,
      provider,
      conversationId: conversationId || null,
      coherence: PSI,
      phi: PHI,
    });
  } catch (err) {
    log.error({ err: err.message, stack: err.stack }, 'POST /api/brain/chat error');
    Sentry?.captureException?.(err);
    res.status(500).json({ error: 'Chat processing failed', code: 'INTERNAL_ERROR', phi: PHI });
  } finally {
    span?.end?.();
  }
});

// ─── POST /api/vector/store — Vector Memory Storage ─────────────────────────
app.post('/api/vector/store', async (req, res) => {
  const span = Sentry?.startSpan?.({ name: 'vector.store', op: 'db.insert' });
  try {
    const { content, metadata } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'content is required and must be a string', code: 'MISSING_CONTENT' });
      return;
    }

    const tenantId = metadata?.user || req.headyUserId || 'anonymous';
    const source = metadata?.source || 'api';
    const type = metadata?.type || 'memory';
    const deviceId = req.deviceId;

    log.info({ tenantId, contentLen: content.length, type, source }, 'Vector store request');

    const embedding = await generateEmbedding(content);

    const messageId = await persistMessage(
      null, // no conversation
      tenantId,
      'system',
      content,
      type,
      source,
      embedding,
      deviceId
    );

    if (messageId) {
      log.info({ tenantId, messageId, hasEmbedding: !!embedding }, 'Vector stored');
      res.json({ stored: true, id: messageId, hasEmbedding: !!embedding, phi: PHI });
    } else if (!dbReady) {
      res.status(503).json({ error: 'Database not available', code: 'SERVICE_DEGRADED', phi: PHI });
    } else {
      res.status(500).json({ error: 'Storage failed', code: 'STORE_FAILED', phi: PHI });
    }
  } catch (err) {
    log.error({ err: err.message }, 'POST /api/vector/store error');
    Sentry?.captureException?.(err);
    res.status(500).json({ error: 'Vector storage failed', code: 'INTERNAL_ERROR', phi: PHI });
  } finally {
    span?.end?.();
  }
});

// ─── POST /api/buddy/history — Load Conversation History ────────────────────
app.post('/api/buddy/history', async (req, res) => {
  try {
    const { user, limit, conversationId } = req.body;
    const tenantId = user || req.headyUserId;

    if (!tenantId) {
      res.status(400).json({ error: 'user is required', code: 'MISSING_USER' });
      return;
    }

    if (!dbReady || !sql) {
      res.status(503).json({ error: 'Database not available', code: 'SERVICE_DEGRADED', phi: PHI });
      return;
    }

    const messageLimit = Math.min(parseInt(limit, 10) || FIB[10], FIB[12]); // default 55, max 144

    let messages;
    if (conversationId) {
      messages = await sql`
        SELECT id, role, text, node, origin, csl_score, created_at
        FROM buddy_messages
        WHERE conversation_id = ${conversationId} AND tenant_id = ${tenantId}
        ORDER BY created_at ASC
        LIMIT ${messageLimit}
      `;
    } else {
      messages = await sql`
        SELECT id, role, text, node, origin, csl_score, created_at
        FROM buddy_messages
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
        LIMIT ${messageLimit}
      `;
      messages.reverse();
    }

    res.json({ messages, count: messages.length, tenantId, phi: PHI });
  } catch (err) {
    log.error({ err: err.message }, 'POST /api/buddy/history error');
    res.status(500).json({ error: 'History retrieval failed', code: 'INTERNAL_ERROR', phi: PHI });
  }
});

// ─── GET /api/conversations — List Conversations ─────────────────────────────
app.get('/api/conversations', async (req, res) => {
  try {
    const tenantId = req.headyUserId || req.query.user;

    if (!tenantId) {
      res.status(400).json({ error: 'user identification required', code: 'MISSING_USER' });
      return;
    }

    if (!dbReady || !sql) {
      res.status(503).json({ error: 'Database not available', code: 'SERVICE_DEGRADED', phi: PHI });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || FIB[8], FIB[10]); // default 21, max 55

    const conversations = await sql`
      SELECT id, session_id, title, model, message_count, csl_score, created_at, updated_at
      FROM conversations
      WHERE user_id = ${tenantId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;

    res.json({ conversations, count: conversations.length, phi: PHI });
  } catch (err) {
    log.error({ err: err.message }, 'GET /api/conversations error');
    res.status(500).json({ error: 'Conversations list failed', code: 'INTERNAL_ERROR', phi: PHI });
  }
});

// ─── POST /api/buddy/search — Hybrid RRF Semantic Search ────────────────────
app.post('/api/buddy/search', async (req, res) => {
  const span = Sentry?.startSpan?.({ name: 'buddy.search', op: 'db.query' });
  try {
    const { user, query, topK } = req.body;
    const tenantId = user || req.headyUserId;

    if (!tenantId) {
      res.status(400).json({ error: 'user is required', code: 'MISSING_USER' });
      return;
    }

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'query is required and must be a string', code: 'MISSING_QUERY' });
      return;
    }

    if (!dbReady || !sql) {
      res.status(503).json({ error: 'Database not available', code: 'SERVICE_DEGRADED', phi: PHI });
      return;
    }

    const k = Math.min(parseInt(topK, 10) || FIB[7], FIB[10]); // default 21, max 55
    const queryEmbedding = await generateEmbedding(query);

    // Use hybrid RRF search
    const results = await hybridRRFSearch(tenantId, query, queryEmbedding, k);

    log.info({ tenantId, query: query.slice(0, 50), resultsCount: results.length }, 'Hybrid search completed');

    res.json({
      results: results.map((r) => ({
        id: r.id,
        text: r.text,
        role: r.role,
        rrfScore: Math.round(r.rrfScore * 10000) / 10000,
        similarity: r.similarity != null ? Math.round(r.similarity * 1000) / 1000 : null,
        keywordRank: r.keywordRank != null ? Math.round(r.keywordRank * 1000) / 1000 : null,
      })),
      count: results.length,
      method: 'hybrid_rrf',
      embeddingDim: EMBEDDING_DIM,
      phi: PHI,
    });
  } catch (err) {
    log.error({ err: err.message }, 'POST /api/buddy/search error');
    Sentry?.captureException?.(err);
    res.status(500).json({ error: 'Semantic search failed', code: 'INTERNAL_ERROR', phi: PHI });
  } finally {
    span?.end?.();
  }
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND',
    path: req.path,
    service: 'heady-buddy-api',
  });
});

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  log.error({ err: err.message, stack: err.stack, path: req.path }, 'Unhandled error');
  Sentry?.captureException?.(err);
  res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    service: 'heady-buddy-api',
  });
});

// Sentry error handler
if (Sentry?.setupExpressErrorHandler) {
  Sentry.setupExpressErrorHandler(app);
}

// ─── Cleanup Cron — Prune old anonymous messages ─────────────────────────────
async function cleanupOldMessages() {
  if (!dbReady || !sql) return;
  const span = Sentry?.startSpan?.({ name: 'cron.cleanup', op: 'db.delete' });
  try {
    const result = await sql`
      DELETE FROM buddy_messages
      WHERE tenant_id = 'anonymous'
        AND created_at < now() - INTERVAL '7 days'
    `;
    log.info({ deleted: result?.length || 0 }, 'Cleanup cron: pruned old anonymous messages');
  } catch (err) {
    log.error({ err: err.message }, 'Cleanup cron failed');
  } finally {
    span?.end?.();
  }
}

// Run cleanup every 6 hours (FIB[8] * 1000 * 60 * ~17)
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
let cleanupTimer = null;

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
let httpServer = null;

async function gracefulShutdown(signal) {
  log.info({ signal }, 'Graceful shutdown initiated');
  if (cleanupTimer) clearInterval(cleanupTimer);

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }

  if (Sentry?.flush) {
    await Sentry.flush(2000).catch(() => {});
  }

  log.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Startup ─────────────────────────────────────────────────────────────────
async function start() {
  log.info({ port: PORT, env: NODE_ENV, phi: PHI, psi: PSI }, 'Starting HeadyBuddy Chat API');

  initGemini();
  await Promise.allSettled([initDatabase(), initRedis()]);

  // Start cleanup cron
  cleanupTimer = setInterval(cleanupOldMessages, CLEANUP_INTERVAL_MS);

  httpServer = app.listen(PORT, '0.0.0.0', () => {
    log.info(
      {
        port: PORT,
        postgres: dbReady,
        redis: redisReady,
        gemini: geminiReady,
        workersAI: !!(CF_AI_TOKEN && CF_ACCOUNT_ID),
        hfTokens: HF_TOKENS.length,
        embeddingDim: EMBEDDING_DIM,
        rateLimit: `${RATE_LIMIT_MAX}/${RATE_LIMIT_WINDOW}s`,
        sentry: !!process.env.SENTRY_DSN,
        domains: HEADY_DOMAINS.length,
      },
      `HeadyBuddy Chat API listening on port ${PORT}`
    );
  });
}

start().catch((err) => {
  log.fatal({ err: err.message }, 'Fatal startup error');
  Sentry?.captureException?.(err);
  process.exit(1);
});
