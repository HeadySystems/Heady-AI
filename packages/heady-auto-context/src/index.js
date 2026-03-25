/**
 * ═══════════════════════════════════════════════════════════
 * HEADY™ AUTO-CONTEXT SERVICE — Entry Point
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 *
 * Express server exposing context enrichment (Pass 2/3),
 * indexing, diagnostics, and health endpoints.
 * Port: 8907 (Law 3: Cloud-deployed, zero localhost)
 * ═══════════════════════════════════════════════════════════
 */

import express from 'express';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../shared/structured-logger.js';
import { AppError, ValidationError } from '../shared/errors.js';
import { autoContextMiddleware, setLocalEngine } from '../shared/auto-context-middleware.js';
import { fib } from '../shared/phi-math.js';
import config from './config.js';
import * as vectorStore from './vector-store.js';
import { embed, embedBatch, clearCache, getCacheStats } from './embedding-client.js';
import { enrich, getDiagnostics } from './context-fusion-engine.js';
import { startScanner, stopScanner, forceScan, getScannerStats } from './background-scanner.js';

const logger = createLogger(config.serviceName);
const app = express();

// ── Request Parsing ────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── CORS ───────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (config.allowedOrigins.length > 0 && origin) {
    if (config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Heady-User-Id, X-Heady-Tenant-Id, X-Heady-Role, X-Heady-Session-Id, X-Heady-Trace-Id, X-Heady-Domain');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Request ID ─────────────────────────────────────────────
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ── Wire local engine for self-enrichment ──────────────────
setLocalEngine({ enrich });

// ── AutoContext middleware (self-consuming) ─────────────────
// The service itself uses its own middleware for meta-context
app.use(autoContextMiddleware);

// ═══════════════════════════════════════════════════════════
// HEALTH ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /health — Full health check with vector count
 */
app.get('/health', async (req, res) => {
  const dbHealth = await vectorStore.healthCheck();
  const stats = await vectorStore.getStats();
  const cacheStats = getCacheStats();
  const scannerStats = getScannerStats();

  const healthy = dbHealth.ok;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    service: config.serviceName,
    port: config.port,
    uptime: process.uptime(),
    database: dbHealth,
    vectors: stats,
    embeddingCache: cacheStats,
    scanner: scannerStats,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /healthz — Quick K8s liveness probe
 */
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

/**
 * GET /readiness — Readiness probe for deployment
 */
app.get('/readiness', async (req, res) => {
  const dbHealth = await vectorStore.healthCheck();
  if (dbHealth.ok) {
    res.status(200).json({ status: 'ready', dbLatencyMs: dbHealth.latencyMs });
  } else {
    res.status(503).json({ status: 'not ready', error: dbHealth.error });
  }
});

// ═══════════════════════════════════════════════════════════
// CONTEXT ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /context/query — Primary enrichment (Pass 2/3)
 *
 * Body: { text: string, domain?: string, topK?: number }
 * Returns: enriched context with CSL scores and gate classifications
 */
app.post('/context/query', async (req, res, next) => {
  try {
    const { text, domain, topK } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new ValidationError('Field "text" is required and must be non-empty');
    }

    const result = await enrich(
      text.trim(),
      domain || 'general',
      topK || config.searchTopK,
    );

    // Remove raw embedding from response (large payload)
    const { queryEmbedding, ...response } = result;

    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /context/index — Index a single context entry
 *
 * Body: { content: string, metadata?: object, domain?: string, source?: string }
 */
app.post('/context/index', async (req, res, next) => {
  try {
    const { content, metadata, domain, source } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new ValidationError('Field "content" is required and must be non-empty');
    }

    const embedding = await embed(content.trim());
    const result = await vectorStore.index(
      content.trim(),
      embedding,
      metadata || {},
      domain || 'general',
      source || 'api',
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /context/index-batch — Batch index (max fib(7)=13 entries)
 *
 * Body: { entries: Array<{ content: string, metadata?: object, domain?: string, source?: string }> }
 */
app.post('/context/index-batch', async (req, res, next) => {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      throw new ValidationError('Field "entries" must be a non-empty array');
    }

    if (entries.length > config.batchSize) {
      throw new ValidationError(`Batch exceeds max size of ${config.batchSize} (fib(7)=13)`);
    }

    // Validate all entries
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].content || typeof entries[i].content !== 'string' || entries[i].content.trim().length === 0) {
        throw new ValidationError(`Entry ${i}: "content" is required and must be non-empty`);
      }
    }

    // Batch embed all content
    const texts = entries.map(e => e.content.trim());
    const embeddings = await embedBatch(texts);

    // Batch index
    const results = await vectorStore.indexBatch(entries, embeddings);

    res.status(201).json({ indexed: results.length, results });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /context/stats — Diagnostics and Pass 1 state
 */
app.get('/context/stats', async (req, res) => {
  const vectorStats = await vectorStore.getStats();
  const cacheStats = getCacheStats();
  const fusionDiag = getDiagnostics();
  const scannerStats = getScannerStats();

  res.json({
    vectors: vectorStats,
    embeddingCache: cacheStats,
    fusion: fusionDiag,
    scanner: scannerStats,
    config: {
      vectorDim: config.vectorDim,
      searchTopK: config.searchTopK,
      batchSize: config.batchSize,
      scanIntervalMs: config.scanIntervalMs,
      hnswM: config.hnswM,
      hnswEf: config.hnswEfConstruction,
    },
  });
});

/**
 * POST /context/force-scan — Manual Pass 1 trigger
 */
app.post('/context/force-scan', async (req, res, next) => {
  try {
    await forceScan();
    const scannerStats = getScannerStats();
    res.json({ triggered: true, scanner: scannerStats });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /context/clear-cache — Clear embedding cache
 */
app.post('/context/clear-cache', (req, res) => {
  clearCache();
  res.json({ cleared: true, cache: getCacheStats() });
});

// ═══════════════════════════════════════════════════════════
// ERROR HANDLER
// ═══════════════════════════════════════════════════════════

app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  logger.error({
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode,
    code,
    error: err.message,
    stack: err.stack,
  }, 'Request error');

  res.status(statusCode).json({
    error: {
      code,
      message: err.isOperational ? err.message : 'Internal server error',
      ...(err.details && Object.keys(err.details).length > 0 ? { details: err.details } : {}),
    },
  });
});

// ═══════════════════════════════════════════════════════════
// STARTUP & SHUTDOWN
// ═══════════════════════════════════════════════════════════

const cleanups = [];

async function startup() {
  logger.info({ port: config.port, serviceName: config.serviceName }, 'Starting heady-auto-context');

  // 1. Initialize vector store (pgvector)
  await vectorStore.initVectorStore();
  cleanups.unshift({ name: 'vector-store', fn: () => vectorStore.closeVectorStore() });

  // 2. Start background scanner (Pass 1)
  startScanner();
  cleanups.unshift({ name: 'background-scanner', fn: async () => stopScanner() });

  // 3. Start HTTP server
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'heady-auto-context listening');
    if (typeof process.send === 'function') process.send('ready');
  });

  cleanups.unshift({
    name: 'http-server',
    fn: () => new Promise((resolve) => server.close(resolve)),
  });
}

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully (LIFO)');
  for (const { name, fn } of cleanups) {
    try {
      await fn();
      logger.info({ name }, 'Cleanup complete');
    } catch (err) {
      logger.error({ name, error: err.message }, 'Cleanup failed');
    }
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason: String(reason) }, 'Unhandled rejection');
  process.exit(1);
});

startup().catch(err => {
  logger.fatal({ error: err.message, stack: err.stack }, 'Startup failed');
  process.exit(1);
});

export { app };
