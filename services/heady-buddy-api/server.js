// ═══════════════════════════════════════════════════════════════════════════════
// HeadyBuddy Chat API Server v2.0.0
// LLM Routing + 384D Vector Memory + Persistent Conversations + Semantic Search
// Sacred Geometry Layer: Middle
// ═══════════════════════════════════════════════════════════════════════════════

import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { neon } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
import pino from 'pino';
import { randomUUID } from 'node:crypto';

// ─── Phi-Math Constants ──────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];
const EMBEDDING_DIM = 384;
const HF_TIMEOUT_MS = Math.round(PHI * PHI * PHI * 1000); // 4236ms
const REDIS_CACHE_TTL = FIB[10]; // 55 seconds

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'heady-buddy-api',
  base: { service: 'heady-buddy', version: '2.0.0', layer: 'Middle', phi: PHI },
});

// ─── Environment ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3351;
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
  'headyai.com',
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

// ─── Neon Postgres ───────────────────────────────────────────────────────────
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

    await sql`
      CREATE TABLE IF NOT EXISTS buddy_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

    // HNSW index for fast cosine similarity search
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_buddy_msg_embedding
        ON buddy_messages USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `;
    } catch (err) {
      log.warn({ err: err.message }, 'HNSW index creation skipped (may already exist or pgvector version issue)');
    }

    dbReady = true;
    log.info('Neon Postgres initialized — buddy_messages table ensured');
  } catch (err) {
    log.error({ err: err.message }, 'Neon Postgres init failed');
    dbReady = false;
  }
}

// ─── Upstash Redis ───────────────────────────────────────────────────────────
let redis = null;
let redisReady = false;

function initRedis() {
  if (!UPSTASH_REDIS_URL || !UPSTASH_REDIS_TOKEN) {
    log.warn('Upstash Redis not configured — caching disabled');
    return;
  }
  try {
    redis = new Redis({
      url: UPSTASH_REDIS_URL,
      token: UPSTASH_REDIS_TOKEN,
    });
    redisReady = true;
    log.info('Upstash Redis initialized');
  } catch (err) {
    log.error({ err: err.message }, 'Upstash Redis init failed');
    redisReady = false;
  }
}

// ─── HuggingFace 384D Embedding Generation ───────────────────────────────────
async function generateEmbedding(text) {
  const token = getNextHFToken();
  if (!token) {
    log.warn('No HuggingFace tokens configured — skipping embedding generation');
    return null;
  }

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
          inputs: text.slice(0, 512), // truncate to avoid token limits
          options: { wait_for_model: true },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      log.warn({ status: response.status, body: errText }, 'HuggingFace API error');
      return null;
    }

    const result = await response.json();

    // The API returns a flat array of 384 floats for single input
    if (Array.isArray(result) && result.length === EMBEDDING_DIM && typeof result[0] === 'number') {
      return result;
    }
    // Sometimes returns nested array
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

// ─── LLM Provider: Gemini ────────────────────────────────────────────────────
async function callGemini(systemPrompt, messages) {
  if (!GEMINI_API_KEY) return null;

  try {
    // Build contents array for Gemini
    const contents = [];

    // Add conversation history
    for (const msg of messages) {
      contents.push({
        role: msg.role === 'assistant' || msg.role === 'buddy' ? 'model' : 'user',
        parts: [{ text: msg.content || msg.text || '' }],
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      log.warn({ status: response.status, body: errText }, 'Gemini API error');
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      log.info({ provider: 'gemini', tokens: text.length }, 'Gemini response received');
      return { text, provider: 'gemini' };
    }

    log.warn({ data }, 'Gemini returned no text');
    return null;
  } catch (err) {
    log.error({ err: err.message }, 'Gemini call failed');
    return null;
  }
}

// ─── LLM Provider: Cloudflare Workers AI ─────────────────────────────────────
async function callWorkersAI(systemPrompt, messages) {
  if (!CF_AI_TOKEN || !CF_ACCOUNT_ID) return null;

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
      const errText = await response.text().catch(() => 'unknown');
      log.warn({ status: response.status, body: errText }, 'Workers AI error');
      return null;
    }

    const data = await response.json();
    const text = data?.result?.response;
    if (text) {
      log.info({ provider: 'workers-ai', tokens: text.length }, 'Workers AI response received');
      return { text, provider: 'workers-ai' };
    }

    return null;
  } catch (err) {
    log.error({ err: err.message }, 'Workers AI call failed');
    return null;
  }
}

// ─── LLM Fallback: Echo-Style Response ───────────────────────────────────────
function echoFallback(message) {
  const responses = [
    `I understand you're asking about "${message.slice(0, 80)}". I'm currently operating in offline mode — my LLM providers are unavailable. Please try again shortly, or reach out through HeadySystems for direct support.`,
    `Thanks for reaching out! I'm HeadyBuddy, running in fallback mode right now. Your message has been stored and I'll be back to full capability soon. The Heady ecosystem spans 9 domains with 384D vector memory — ask me anything once I'm reconnected!`,
    `I received your message. I'm temporarily operating without my language model backends (Gemini/Workers AI). Your conversation is being saved. Eric Haywood and the HeadySystems team are working to keep all services running at peak coherence (ψ=${PSI}).`,
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

// ─── Persist Message to Postgres ─────────────────────────────────────────────
async function persistMessage(tenantId, role, text, node, origin, embedding, deviceId) {
  if (!dbReady || !sql) return null;
  try {
    const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;
    const result = await sql`
      INSERT INTO buddy_messages (tenant_id, device_id, role, text, node, origin, csl_score, embedding)
      VALUES (
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
    return result[0]?.id || null;
  } catch (err) {
    log.error({ err: err.message, tenantId, role }, 'Message persistence failed');
    return null;
  }
}

// ─── Recall Relevant Context via Vector Search ───────────────────────────────
async function recallContext(tenantId, queryEmbedding, topK = 3) {
  if (!dbReady || !sql || !queryEmbedding) return [];
  try {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const results = await sql`
      SELECT text, role, node, csl_score,
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM buddy_messages
      WHERE tenant_id = ${tenantId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `;
    return results.filter((r) => r.similarity > 0.3);
  } catch (err) {
    log.error({ err: err.message, tenantId }, 'Vector recall failed');
    return [];
  }
}

// ─── Redis Cache Helpers ─────────────────────────────────────────────────────
async function getCachedResponse(key) {
  if (!redisReady || !redis) return null;
  try {
    const cached = await redis.get(key);
    return cached || null;
  } catch (err) {
    log.warn({ err: err.message }, 'Redis cache read failed');
    return null;
  }
}

async function setCachedResponse(key, value) {
  if (!redisReady || !redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { ex: REDIS_CACHE_TTL });
  } catch (err) {
    log.warn({ err: err.message }, 'Redis cache write failed');
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Heady-User-Id, X-Device-Id');
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
  next();
});

// ─── GET /health ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const uptime = process.uptime();
  const coherenceScore = PSI + (Math.sin(uptime * PSI) * 0.1);

  const health = {
    status: 'healthy',
    service: 'heady-buddy-api',
    version: '2.0.0',
    layer: 'Middle',
    uptime: Math.round(uptime),
    coherenceScore: Math.round(coherenceScore * 1000) / 1000,
    phi: PHI,
    psi: PSI,
    embeddingDim: EMBEDDING_DIM,
    dependencies: {
      postgres: dbReady ? 'connected' : 'degraded',
      redis: redisReady ? 'connected' : 'degraded',
      gemini: GEMINI_API_KEY ? 'configured' : 'not_configured',
      workersAI: CF_AI_TOKEN ? 'configured' : 'not_configured',
      huggingface: HF_TOKENS.length > 0 ? `configured (${HF_TOKENS.length} tokens)` : 'not_configured',
    },
    timestamp: new Date().toISOString(),
  };

  // Test postgres connectivity
  if (dbReady && sql) {
    try {
      await sql`SELECT 1`;
    } catch {
      health.dependencies.postgres = 'error';
      health.status = 'degraded';
    }
  }

  res.json(health);
});

// ─── POST /api/brain/chat — Main Chat Endpoint ──────────────────────────────
app.post('/api/brain/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, user, history, context } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required and must be a string', code: 'MISSING_MESSAGE' });
      return;
    }

    const tenantId = user || req.headyUserId || 'anonymous';
    const deviceId = req.deviceId;

    log.info({ tenantId, messageLen: message.length, historyLen: history?.length || 0 }, 'Chat request received');

    // Check Redis cache for dedup
    const cacheKey = `buddy:chat:${tenantId}:${hashCode(message)}`;
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      log.info({ tenantId, fromCache: true }, 'Returning cached response');
      res.json({ response: parsed.response, node: 'PERSONA', fromCache: true, phi: PHI });
      return;
    }

    // Generate embedding for the user message
    const messageEmbedding = await generateEmbedding(message);

    // Recall relevant context from vector memory
    const recalledFacts = await recallContext(tenantId, messageEmbedding, FIB[4]); // top 3

    // Build enriched system prompt with recalled context
    let enrichedSystemPrompt = SYSTEM_PROMPT;
    if (recalledFacts.length > 0) {
      const contextBlock = recalledFacts
        .map((f) => `- ${f.text.slice(0, 200)}`)
        .join('\n');
      enrichedSystemPrompt += `\n\nRelevant context from previous conversations:\n${contextBlock}`;
    }
    if (context) {
      enrichedSystemPrompt += `\n\nAdditional context: ${typeof context === 'string' ? context : JSON.stringify(context)}`;
    }

    // Build messages array
    const conversationMessages = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-FIB[7])) { // last 21 messages max
        conversationMessages.push({
          role: h.role === 'buddy' || h.role === 'assistant' ? 'assistant' : h.role,
          content: h.content || h.text || '',
        });
      }
    }
    conversationMessages.push({ role: 'user', content: message });

    // Try LLM providers in fallback order
    let llmResult = await callGemini(enrichedSystemPrompt, conversationMessages);
    if (!llmResult) {
      llmResult = await callWorkersAI(enrichedSystemPrompt, conversationMessages);
    }
    if (!llmResult) {
      llmResult = echoFallback(message);
    }

    const responseText = llmResult.text;
    const provider = llmResult.provider;

    // Persist user message and buddy response (non-blocking)
    const responseEmbedding = await generateEmbedding(responseText);

    const persistOps = [
      persistMessage(tenantId, 'user', message, 'PERSONA', provider, messageEmbedding, deviceId),
      persistMessage(tenantId, 'buddy', responseText, 'PERSONA', provider, responseEmbedding, deviceId),
    ];
    Promise.allSettled(persistOps).catch((err) => {
      log.error({ err: err?.message }, 'Background persistence error');
    });

    // Cache the response
    await setCachedResponse(cacheKey, { response: responseText });

    const duration = Date.now() - startTime;
    log.info({ tenantId, provider, duration, fromCache: false }, 'Chat response generated');

    res.json({
      response: responseText,
      node: 'PERSONA',
      fromCache: false,
      provider,
      coherence: PSI,
      phi: PHI,
    });
  } catch (err) {
    log.error({ err: err.message, stack: err.stack }, 'POST /api/brain/chat unhandled error');
    res.status(500).json({ error: 'Chat processing failed', code: 'INTERNAL_ERROR', phi: PHI });
  }
});

// ─── POST /api/vector/store — Vector Memory Storage ─────────────────────────
app.post('/api/vector/store', async (req, res) => {
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

    // Generate embedding
    const embedding = await generateEmbedding(content);

    // Store in Postgres
    const messageId = await persistMessage(
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
    log.error({ err: err.message, stack: err.stack }, 'POST /api/vector/store unhandled error');
    res.status(500).json({ error: 'Vector storage failed', code: 'INTERNAL_ERROR', phi: PHI });
  }
});

// ─── POST /api/buddy/history — Load Conversation History ────────────────────
app.post('/api/buddy/history', async (req, res) => {
  try {
    const { user, limit } = req.body;
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

    const messages = await sql`
      SELECT id, role, text, node, origin, csl_score, created_at
      FROM buddy_messages
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${messageLimit}
    `;

    // Reverse to chronological order
    messages.reverse();

    log.info({ tenantId, count: messages.length }, 'History loaded');

    res.json({
      messages,
      count: messages.length,
      tenantId,
      phi: PHI,
    });
  } catch (err) {
    log.error({ err: err.message, stack: err.stack }, 'POST /api/buddy/history unhandled error');
    res.status(500).json({ error: 'History retrieval failed', code: 'INTERNAL_ERROR', phi: PHI });
  }
});

// ─── POST /api/buddy/search — Semantic Search ───────────────────────────────
app.post('/api/buddy/search', async (req, res) => {
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

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    if (!queryEmbedding) {
      res.status(503).json({
        error: 'Embedding generation unavailable — semantic search requires HuggingFace API',
        code: 'EMBEDDING_UNAVAILABLE',
        phi: PHI,
      });
      return;
    }

    const k = Math.min(parseInt(topK, 10) || FIB[7], FIB[10]); // default 21, max 55
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await sql`
      SELECT id, role, text, node, origin, csl_score, created_at,
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM buddy_messages
      WHERE tenant_id = ${tenantId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${k}
    `;

    // Filter by minimum similarity threshold
    const filtered = results.filter((r) => r.similarity > 0.2);

    log.info({ tenantId, query: query.slice(0, 50), resultsCount: filtered.length }, 'Semantic search completed');

    res.json({
      results: filtered,
      count: filtered.length,
      query: query.slice(0, 100),
      embeddingDim: EMBEDDING_DIM,
      phi: PHI,
    });
  } catch (err) {
    log.error({ err: err.message, stack: err.stack }, 'POST /api/buddy/search unhandled error');
    res.status(500).json({ error: 'Semantic search failed', code: 'INTERNAL_ERROR', phi: PHI });
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
  res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    service: 'heady-buddy-api',
  });
});

// ─── Startup ─────────────────────────────────────────────────────────────────
async function start() {
  log.info({ port: PORT, env: NODE_ENV, phi: PHI, psi: PSI }, 'Starting HeadyBuddy Chat API');

  initRedis();
  await initDatabase();

  app.listen(PORT, '0.0.0.0', () => {
    log.info(
      {
        port: PORT,
        postgres: dbReady,
        redis: redisReady,
        gemini: !!GEMINI_API_KEY,
        workersAI: !!CF_AI_TOKEN,
        hfTokens: HF_TOKENS.length,
        embeddingDim: EMBEDDING_DIM,
        domains: HEADY_DOMAINS.length,
      },
      `HeadyBuddy Chat API listening on port ${PORT}`
    );
  });
}

start().catch((err) => {
  log.fatal({ err: err.message }, 'Fatal startup error');
  process.exit(1);
});
