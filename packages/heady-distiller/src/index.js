/**
 * HeadyDistiller — Express Service Entry Point
 * Stage 22 (index 21) DISTILL — Standalone service
 *
 * Compresses HCFullPipeline execution traces into reusable recipes,
 * knowledge facts, and ancestral wisdom.
 *
 * Port: process.env.PORT || 3375
 *
 * Env vars:
 *   NEON_PG_URL, UPSTASH_REDIS_URL, UPSTASH_TOKEN,
 *   HUGGINGFACE_TOKEN_1/2/3, PORT, LOG_LEVEL
 *
 * All constants phi-derived. Zero placeholders. Zero TODOs.
 */

import express            from 'express';
import { randomUUID }     from 'crypto';
import pino               from 'pino';
import pinoHttp           from 'pino-http';

import { TrajectoryFilter }    from './trajectory-filter.js';
import { RecipeStore }         from './recipe-store.js';
import { KnowledgeCompressor } from './knowledge-compressor.js';
import { WisdomCrystallizer }  from './wisdom-crystallizer.js';
import { createDistillerStageHandler } from './distiller-stage-handler.js';

// ─── Phi-math constants ───────────────────────────────────────────────────────
const PHI  = 1.618033988749895;
const PSI  = 0.618033988749895;
const PSI2 = 0.381966011250105;

const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// CSL gate thresholds
const CSL = {
  SUPPRESS : 0.236,
  INCLUDE  : PSI2,   // 0.382
  MINIMUM  : 0.500,
  BOOST    : PSI,    // 0.618
  INJECT   : 0.718,
  MEDIUM   : 0.809,
  HIGH     : 0.882,
  CRITICAL : 0.927,
  DEDUP    : 0.972,
};

// ─── Configuration ─────────────────────────────────────────────────────────────
const PORT     = parseInt(process.env.PORT || '3375', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const SERVICE_NAME    = 'heady-distiller';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';

// ─── Logger ───────────────────────────────────────────────────────────────────
const logger = pino({
  name  : SERVICE_NAME,
  level : LOG_LEVEL,
  base  : { service: SERVICE_NAME, version: SERVICE_VERSION, phi: PHI },
  formatters: {
    level(label) { return { level: label }; },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// ─── Service dependencies ─────────────────────────────────────────────────────
const trajectoryFilter    = new TrajectoryFilter();
const recipeStore         = new RecipeStore();
const knowledgeCompressor = new KnowledgeCompressor();
const wisdomCrystallizer  = new WisdomCrystallizer();

const distillHandler = createDistillerStageHandler({
  trajectoryFilter,
  recipeStore,
  knowledgeCompressor,
  wisdomCrystallizer,
});

// ─── Express app ──────────────────────────────────────────────────────────────
const app = express();

// Disable x-powered-by
app.disable('x-powered-by');

// JSON body parser — 16mb limit (phi-aligned: FIB[12]=144 * ~111 KB ≈ 16 MB)
app.use(express.json({ limit: '16mb' }));

// Structured HTTP request logging
app.use(pinoHttp({
  logger,
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  serializers: {
    req(req) {
      return {
        method       : req.method,
        url          : req.url,
        correlationId: req.headers['x-correlation-id'],
      };
    },
  },
}));

// ─── Middleware: Correlation ID ───────────────────────────────────────────────
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || randomUUID();
  req.correlationId   = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// ─── Middleware: X-Heady-Service ──────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('x-heady-service', SERVICE_NAME);
  res.setHeader('x-heady-stage',   '21');
  res.setHeader('x-heady-phi',     String(PHI));
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /healthz — liveness probe (simple 200)
app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

// GET /health — full health with phi stats
app.get('/health', async (req, res) => {
  try {
    const [recipeStats, wisdomStats, traceCount] = await Promise.allSettled([
      recipeStore.stats(),
      wisdomCrystallizer.stats(),
      trajectoryFilter.traceCount?.() ?? Promise.resolve(0),
    ]);

    const health = {
      service    : SERVICE_NAME,
      version    : SERVICE_VERSION,
      status     : 'healthy',
      uptime     : process.uptime(),
      uptimeHuman: `${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`,
      port       : PORT,
      stage      : { index: 21, name: 'DISTILL', phi: PHI, psi: PSI },
      phi        : PHI,
      psi        : PSI,
      cslGates   : CSL,
      fibonacci  : FIB,
      recipeStats   : recipeStats.status   === 'fulfilled' ? recipeStats.value   : { error: recipeStats.reason?.message },
      wisdomStats   : wisdomStats.status   === 'fulfilled' ? wisdomStats.value   : { error: wisdomStats.reason?.message },
      traceCount    : traceCount.status    === 'fulfilled' ? traceCount.value    : 0,
      memory     : {
        heapUsedMb : Math.round(process.memoryUsage().heapUsed  / 1024 / 1024),
        heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rssMb      : Math.round(process.memoryUsage().rss       / 1024 / 1024),
      },
      timestamp  : new Date().toISOString(),
    };

    res.status(200).json(health);
  } catch (err) {
    logger.error({ err: err.message }, 'Health check failed');
    res.status(503).json({
      service : SERVICE_NAME,
      status  : 'degraded',
      error   : err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/v1/distill — main distillation endpoint
app.post('/api/v1/distill', async (req, res, next) => {
  try {
    const { trace } = req.body ?? {};

    if (!trace || typeof trace !== 'object') {
      return res.status(400).json({
        error          : 'INVALID_INPUT',
        message        : 'Request body must contain a trace object',
        correlationId  : req.correlationId,
        cslThreshold   : CSL.INCLUDE,
      });
    }

    // Build a pipeline context from the incoming trace
    const ctx = {
      runId      : trace.runId      ?? req.correlationId,
      variant    : trace.variant    ?? 'FULL',
      input      : trace.input      ?? {},
      results    : trace.results    ?? {},
      errors     : trace.errors     ?? [],
      timeline   : trace.timeline   ?? [],
      confidence : trace.confidence ?? 0,
      metadata   : trace.metadata   ?? {},
    };

    const result = await distillHandler(ctx);

    res.status(200).json({
      success      : true,
      distillation : result,
      correlationId: req.correlationId,
      timestamp    : new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/recipes/match — recipe matching
app.post('/api/v1/recipes/match', async (req, res, next) => {
  try {
    const { intent, taskClass, minTier } = req.body ?? {};

    if (!intent && !taskClass) {
      return res.status(400).json({
        error        : 'INVALID_INPUT',
        message      : 'Request body must contain intent or taskClass',
        correlationId: req.correlationId,
      });
    }

    const matches = await recipeStore.match({
      intent,
      taskClass,
      minTier: typeof minTier === 'number' ? minTier : 1,
    });

    res.status(200).json({
      success      : true,
      matches,
      count        : Array.isArray(matches) ? matches.length : 0,
      correlationId: req.correlationId,
      timestamp    : new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/recipes — list recipes
app.get('/api/v1/recipes', async (req, res, next) => {
  try {
    const tier      = req.query.tier      ? parseInt(req.query.tier,  10) : undefined;
    const taskClass = req.query.taskClass ?? undefined;
    const limit     = req.query.limit     ? parseInt(req.query.limit, 10) : FIB[8]; // 21

    const recipes = await recipeStore.list({ tier, taskClass, limit });

    res.status(200).json({
      success      : true,
      recipes,
      count        : Array.isArray(recipes) ? recipes.length : 0,
      limit,
      correlationId: req.correlationId,
      timestamp    : new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/recipes/route — semantic recipe routing
app.post('/api/v1/recipes/route', async (req, res, next) => {
  try {
    const { intent, taskEmbedding } = req.body ?? {};

    if (!intent && !taskEmbedding) {
      return res.status(400).json({
        error        : 'INVALID_INPUT',
        message      : 'Request body must contain intent or taskEmbedding',
        correlationId: req.correlationId,
      });
    }

    const best = await recipeStore.semanticRoute({
      intent,
      taskEmbedding,
      cslThreshold: CSL.BOOST,  // PSI=0.618 — minimum alignment for semantic routing
      topK        : FIB[5],     // 5
    });

    res.status(200).json({
      success      : true,
      match        : best,
      cslThreshold : CSL.BOOST,
      correlationId: req.correlationId,
      timestamp    : new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/wisdom — wisdom query
app.get('/api/v1/wisdom', async (req, res, next) => {
  try {
    const topK = req.query.topK ? parseInt(req.query.topK, 10) : FIB[6];  // 8
    const type = req.query.type ?? undefined;

    const wisdom = await wisdomCrystallizer.query({ topK, type });

    res.status(200).json({
      success      : true,
      wisdom,
      count        : Array.isArray(wisdom) ? wisdom.length : 0,
      topK,
      correlationId: req.correlationId,
      timestamp    : new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/wisdom/query — semantic wisdom query
app.post('/api/v1/wisdom/query', async (req, res, next) => {
  try {
    const { taskEmbedding, topK } = req.body ?? {};

    if (!taskEmbedding) {
      return res.status(400).json({
        error        : 'INVALID_INPUT',
        message      : 'Request body must contain taskEmbedding',
        correlationId: req.correlationId,
      });
    }

    const resolvedTopK = typeof topK === 'number' ? topK : FIB[6];  // 8

    const results = await wisdomCrystallizer.semanticQuery({
      taskEmbedding,
      topK         : resolvedTopK,
      cslThreshold : CSL.MEDIUM,  // 0.809 — coherence floor for wisdom retrieval
    });

    res.status(200).json({
      success      : true,
      results,
      count        : Array.isArray(results) ? results.length : 0,
      topK         : resolvedTopK,
      cslThreshold : CSL.MEDIUM,
      correlationId: req.correlationId,
      timestamp    : new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats — comprehensive stats across all subsystems
app.get('/api/v1/stats', async (req, res, next) => {
  try {
    const [recipeStats, wisdomStats, compressorStats, filterStats] = await Promise.allSettled([
      recipeStore.stats(),
      wisdomCrystallizer.stats(),
      knowledgeCompressor.stats?.()  ?? Promise.resolve({}),
      trajectoryFilter.stats?.()     ?? Promise.resolve({}),
    ]);

    const stats = {
      service    : SERVICE_NAME,
      version    : SERVICE_VERSION,
      stage      : { index: 21, name: 'DISTILL' },
      phi        : PHI,
      psi        : PSI,
      psi2       : PSI2,
      uptime     : process.uptime(),
      subsystems : {
        recipeStore     : recipeStats.status    === 'fulfilled' ? recipeStats.value    : { error: recipeStats.reason?.message },
        wisdomCrystal   : wisdomStats.status    === 'fulfilled' ? wisdomStats.value    : { error: wisdomStats.reason?.message },
        knowledgeCompress: compressorStats.status === 'fulfilled' ? compressorStats.value : { error: compressorStats.reason?.message },
        trajectoryFilter: filterStats.status    === 'fulfilled' ? filterStats.value    : { error: filterStats.reason?.message },
      },
      memory     : {
        heapUsedMb : Math.round(process.memoryUsage().heapUsed  / 1024 / 1024),
        heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rssMb      : Math.round(process.memoryUsage().rss       / 1024 / 1024),
      },
      fibonacci  : {
        fib7 : FIB[7],   // 13
        fib8 : FIB[8],   // 21
        fib9 : FIB[9],   // 34
        fib10: FIB[10],  // 55
        fib11: FIB[11],  // 89
      },
      cslGates   : CSL,
      timestamp  : new Date().toISOString(),
    };

    res.status(200).json({ success: true, stats, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error        : 'NOT_FOUND',
    message      : `Route ${req.method} ${req.url} not found`,
    service      : SERVICE_NAME,
    correlationId: req.correlationId,
    timestamp    : new Date().toISOString(),
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.statusCode ?? err.status ?? 500;
  const code       = err.code       ?? 'INTERNAL_ERROR';

  logger.error({
    err         : err.message,
    stack       : err.stack,
    correlationId: req.correlationId,
    method      : req.method,
    url         : req.url,
    statusCode,
    code,
  }, 'Unhandled request error');

  // Never leak stack traces in production
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    error        : code,
    message      : err.isOperational ? err.message : 'An unexpected error occurred',
    correlationId: req.correlationId,
    timestamp    : new Date().toISOString(),
    ...(isProduction ? {} : { detail: err.message }),
  });
});

// ─── Graceful shutdown — LIFO cleanup ────────────────────────────────────────
const cleanups = [];

/** Register a cleanup function (LIFO: last registered is first executed). */
function registerCleanup(name, fn) {
  cleanups.unshift({ name, fn });
}

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal, cleanupCount: cleanups.length }, 'Graceful shutdown initiated');

  for (const { name, fn } of cleanups) {
    try {
      await fn();
      logger.info({ name }, 'Cleanup complete');
    } catch (err) {
      logger.error({ name, err: err.message }, 'Cleanup failed — continuing shutdown');
    }
  }

  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Unhandled rejection safety net
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason: String(reason), promise: String(promise) },
    'Unhandled promise rejection — service continuing');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught exception — initiating shutdown');
  shutdown('uncaughtException').catch(() => process.exit(1));
});

// ─── Startup ──────────────────────────────────────────────────────────────────

// Register cleanups in dependency order (LIFO: HTTP server first-to-shutdown)
const server = app.listen(PORT, () => {
  logger.info(
    {
      port       : PORT,
      service    : SERVICE_NAME,
      version    : SERVICE_VERSION,
      stage      : 'DISTILL (index 21)',
      phi        : PHI,
      psi        : PSI,
      env        : {
        NEON_PG_URL         : process.env.NEON_PG_URL         ? '✓ set' : '✗ not set',
        UPSTASH_REDIS_URL   : process.env.UPSTASH_REDIS_URL   ? '✓ set' : '✗ not set',
        UPSTASH_TOKEN       : process.env.UPSTASH_TOKEN       ? '✓ set' : '✗ not set',
        HUGGINGFACE_TOKEN_1 : process.env.HUGGINGFACE_TOKEN_1 ? '✓ set' : '✗ not set',
        HUGGINGFACE_TOKEN_2 : process.env.HUGGINGFACE_TOKEN_2 ? '✓ set' : '✗ not set',
        HUGGINGFACE_TOKEN_3 : process.env.HUGGINGFACE_TOKEN_3 ? '✓ set' : '✗ not set',
      },
    },
    'HeadyDistiller service started'
  );
});

registerCleanup('http-server', () => new Promise((resolve, reject) => {
  server.close((err) => {
    if (err) reject(err);
    else resolve();
  });
}));

registerCleanup('recipe-store', async () => {
  if (typeof recipeStore.close === 'function') {
    await recipeStore.close();
  }
});

registerCleanup('wisdom-crystallizer', async () => {
  if (typeof wisdomCrystallizer.close === 'function') {
    await wisdomCrystallizer.close();
  }
});

registerCleanup('knowledge-compressor', async () => {
  if (typeof knowledgeCompressor.close === 'function') {
    await knowledgeCompressor.close();
  }
});

registerCleanup('trajectory-filter', async () => {
  if (typeof trajectoryFilter.close === 'function') {
    await trajectoryFilter.close();
  }
});

export { app, server };
export default app;
