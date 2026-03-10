#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';

import { logger } from './src/utils/logger.js';
import { validateEnv } from './src/utils/env-validator.js';
import { setupHealthRoutes } from './src/gateway/health.js';
import { setupGateway } from './src/gateway/ai-gateway.js';
import { setupMCPRoutes } from './src/mcp/mcp-server.js';
import { setupAgentRoutes } from './src/agents/agent-router.js';
import { setupMemoryRoutes } from './src/memory/memory-router.js';
import { setupDashboardRoutes } from './src/gateway/dashboard-router.js';
import { AutoSuccessEngine } from './src/services/auto-success.js';
import { getAutoContext } from './src/services/heady-auto-context.js';
import { errorHandler } from './src/gateway/error-handler.js';
import { metricsMiddleware, metricsEndpoint } from './src/utils/metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Auth routes — dynamic import for cookie-parser (optional dep)
let cookieParser;
try { cookieParser = require('cookie-parser'); } catch { cookieParser = null; }

let authRouter;
try {
  const authModule = await import('./src/routes/auth-routes.js');
  authRouter = authModule.router;
} catch (err) {
  logger.warn(`[HeadyManager] Auth routes not loaded: ${err.message}`);
}

// ── Validate environment ──
const envOk = validateEnv();
if (!envOk && process.env.NODE_ENV === 'production') {
  logger.error('Environment validation failed. Exiting.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3300;

// ── Global middleware ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.headysystems.com", "https://*.headyconnection.com", "wss:"],
    },
  },
}));
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
if (cookieParser) app.use(cookieParser());
app.use(metricsMiddleware);

// ── Static files (public/ + frontend dist) ──
app.use(express.static(path.join(__dirname, 'public')));
app.use('/app', express.static(path.join(__dirname, 'frontend', 'dist')));

// ── Routes ──
setupHealthRoutes(app);
setupGateway(app);
setupMCPRoutes(app);
setupAgentRoutes(app);
setupMemoryRoutes(app);
setupDashboardRoutes(app);
app.get('/metrics', metricsEndpoint);

// ── Auth routes ──
if (authRouter) {
  app.use('/api/auth', authRouter);
  logger.info('[HeadyManager] Auth routes mounted at /api/auth');
}

// ── AutoContext continuous service ──
const autoContext = getAutoContext({ workspaceRoot: __dirname, alwaysOn: true });

app.post('/api/context/enrich', async (req, res, next) => {
  try {
    const { task, domain, focusFiles, deep, vectorSearch } = req.body;
    if (!task) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'task is required' } });
    const result = await autoContext.enrich(task, { domain, focusFiles, deep, vectorSearch });
    res.json(result);
  } catch (err) { next(err); }
});

app.get('/api/context/status', (_req, res) => {
  res.json(autoContext.getStats());
});

app.post('/api/context/index', async (_req, res, next) => {
  try {
    const indexed = await autoContext.indexWorkspace();
    res.json({ indexed });
  } catch (err) { next(err); }
});

logger.info('[HeadyManager] AutoContext continuous service started at /api/context/*');

// ── SPA fallback for /app/* routes ──
const frontendIndex = path.join(__dirname, 'frontend', 'dist', 'index.html');
if (existsSync(frontendIndex)) {
  app.get('/app/{*path}', (_req, res) => res.sendFile(frontendIndex));
  logger.info('[HeadyManager] Frontend SPA served at /app');
}

// ── Error handling (must be last) ──
app.use(errorHandler);

// ── Start server ──
const server = app.listen(PORT, () => {
  logger.info(`[HeadyManager] Running on port ${PORT}`);
  logger.info(`[HeadyManager] Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`[HeadyManager] Health: http://localhost:${PORT}/health`);
});

// ── Auto-Success Engine ──
const autoSuccess = new AutoSuccessEngine();
autoSuccess.start().then(() => {
  logger.info(`[HeadyManager] Auto-Success Engine started (${autoSuccess.taskCount} tasks)`);
}).catch(err => {
  logger.error(`[HeadyManager] Auto-Success Engine error: ${err.message}`);
});

// ── Graceful shutdown ──
const shutdown = async (signal) => {
  logger.info(`[HeadyManager] Received ${signal}. Shutting down gracefully...`);
  await autoSuccess.stop();
  if (autoContext) autoContext.stop();
  server.close(() => {
    logger.info('[HeadyManager] Server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});
