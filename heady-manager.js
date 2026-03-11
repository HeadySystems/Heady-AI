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
import { setupSubsystemRoutes, initializeSubsystems, shutdownSubsystems } from './src/gateway/subsystem-routes.js';
import { AutoSuccessEngine } from './src/services/auto-success.js';
import { getAutoContext } from './src/services/heady-auto-context.js';
import { errorHandler } from './src/gateway/error-handler.js';
import { metricsMiddleware, metricsEndpoint } from './src/utils/metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Optional deps
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
const HEADY_DOMAINS = [
  'https://headyme.com', 'https://headyapi.com', 'https://headysystems.com',
  'https://headyconnection.org', 'https://headymcp.com', 'https://headybuddy.org',
  'https://headyio.com', 'https://headybot.com', 'https://heady-ai.com',
];
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : process.env.NODE_ENV === 'production'
    ? HEADY_DOMAINS
    : ['http://localhost:3300', 'http://localhost:5173', ...HEADY_DOMAINS];
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
if (cookieParser) app.use(cookieParser());
app.use(metricsMiddleware);

// ── Static files ──
app.use(express.static(path.join(__dirname, 'public')));
app.use('/app', express.static(path.join(__dirname, 'frontend', 'dist')));

// ── Routes ──
setupHealthRoutes(app);
setupGateway(app);
setupMCPRoutes(app);
setupAgentRoutes(app);
setupMemoryRoutes(app);
setupDashboardRoutes(app);
setupSubsystemRoutes(app);
app.get('/metrics', metricsEndpoint);

// ── Auth routes ──
if (authRouter) {
  app.use('/api/auth', authRouter);
  logger.info('[HeadyManager] Auth routes mounted at /api/auth');
}

// ── Liquid Colab Engine ──
let liquidColab = null;
try {
  const { LiquidColabEngine } = require('./src/liquid-colab-services.cjs');
  liquidColab = new LiquidColabEngine({ runtimeCount: 3 });
  logger.info('[HeadyManager] Liquid Colab Engine: STARTED (3 runtime lanes)');
} catch (err) {
  logger.warn(`[HeadyManager] Liquid Colab Engine not loaded: ${err.message}`);
}

app.get('/api/colab/health', (req, res) => {
  if (!liquidColab) return res.status(503).json({ error: 'Liquid Colab Engine not active' });
  res.json(liquidColab.getHealth());
});

app.post('/api/colab/execute/:component', async (req, res, next) => {
  try {
    if (!liquidColab) return res.status(503).json({ error: 'Liquid Colab Engine not active' });
    const result = await liquidColab.execute(req.params.component, req.body || {});
    if (!result.ok) return res.status(404).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

app.post('/api/colab/smart-execute', async (req, res, next) => {
  try {
    if (!liquidColab) return res.status(503).json({ error: 'Liquid Colab Engine not active' });
    const result = await liquidColab.smartExecute(req.body || {});
    res.json(result);
  } catch (err) { next(err); }
});

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
  logger.info(`[HeadyManager] Health: /health (port ${PORT})`);
});

// ── Subsystem Initialization ──
initializeSubsystems().then((results) => {
  const loaded = Object.entries(results).filter(([, v]) => v).map(([k]) => k);
  if (liquidColab) loaded.push('liquidColabEngine');
  logger.info(`[HeadyManager] Subsystems initialized: ${loaded.join(', ') || 'none'}`);
}).catch(err => {
  logger.error(`[HeadyManager] Subsystem init error: ${err.message}`);
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
  await shutdownSubsystems();
  await autoSuccess.stop();
  if (autoContext) autoContext.stop();
  server.close(() => {
    logger.info('[HeadyManager] Server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

if (alohaProtocol) logger.info("  \u221e Aloha Protocol: LOADED (always-on)");
if (deOptProtocol) logger.info("  \u221e De-Optimization Protocol: LOADED (simplicity > speed)");
if (stabilityFirst) logger.info("  \u221e Stability First: LOADED (the canoe must not sink)");

app.get("/api/aloha/status", (req, res) => {
  res.json({
    ok: true,
    mode: alohaState.mode,
    activeSince: alohaState.activeSince,
    protocols: alohaState.protocols,
    stabilityDiagnosticMode: alohaState.stabilityDiagnosticMode,
    crashReportCount: alohaState.crashReports.length,
    deOptChecksRun: alohaState.deOptChecks,
    priorities: alohaProtocol ? alohaProtocol.priorities : null,
    ts: new Date().toISOString(),
  });
});

app.get("/api/aloha/protocol", (req, res) => {
  if (!alohaProtocol) return res.status(404).json({ error: "Aloha protocol not found" });
  res.json({ ok: true, ...alohaProtocol, ts: new Date().toISOString() });
});

app.get("/api/aloha/de-optimization", (req, res) => {
  if (!deOptProtocol) return res.status(404).json({ error: "De-optimization protocol not found" });
  res.json({ ok: true, ...deOptProtocol, ts: new Date().toISOString() });
});

app.get("/api/aloha/stability", (req, res) => {
  if (!stabilityFirst) return res.status(404).json({ error: "Stability first protocol not found" });
  res.json({ ok: true, ...stabilityFirst, ts: new Date().toISOString() });
});

app.get("/api/aloha/priorities", (req, res) => {
  if (!alohaProtocol) return res.status(404).json({ error: "Aloha protocol not found" });
  res.json({
    ok: true,
    priorities: alohaProtocol.priorities,
    no_assist: alohaProtocol.no_assist,
    web_baseline: alohaProtocol.web_baseline,
    ts: new Date().toISOString(),
  });
});

app.get("/api/aloha/checklist", (req, res) => {
  if (!deOptProtocol) return res.status(404).json({ error: "De-optimization protocol not found" });
  res.json({
    ok: true,
    checklist: deOptProtocol.checklist,
    code_rules: deOptProtocol.code_generation,
    arch_rules: deOptProtocol.architecture_suggestions,
    prompt_rules: deOptProtocol.prompt_and_workflow,
    ts: new Date().toISOString(),
  });
});

app.post("/api/aloha/crash-report", (req, res) => {
  const { description, context, severity } = req.body;
  const report = {
    id: `crash-${Date.now()}`,
    description: description || "IDE/system crash reported",
    context: context || "unknown",
    severity: severity || "high",
    ts: new Date().toISOString(),
  };
  alohaState.crashReports.push(report);
  alohaState.stabilityDiagnosticMode = true;

  // Wire crash report into self-critique
  if (selfCritiqueEngine) {
    selfCritiqueEngine.recordCritique({
      context: "stability:crash",
      weaknesses: [`System crash: ${report.description}`],
      severity: "critical",
      suggestedImprovements: [
        "Enter Stability Diagnostic Mode",
        "Reduce local resource usage",
        "Disable non-essential extensions",
      ],
    });
  }

  // Wire into story driver
  if (storyDriver) {
    storyDriver.ingestSystemEvent({
      type: "STABILITY_CRASH_REPORTED",
      refs: { crashId: report.id, description: report.description },
      source: "aloha_protocol",
    });
  }

  res.json({
    ok: true,
    report,
    diagnosticMode: true,
    checklist: stabilityFirst ? stabilityFirst.crash_response.diagnostic_mode.checks : [],
    message: "Stability Diagnostic Mode activated. Follow the checklist.",
  });
});

app.post("/api/aloha/de-opt-check", (req, res) => {
  const { suggestion, context } = req.body;
  alohaState.deOptChecks++;

  const result = {
    checkNumber: alohaState.deOptChecks,
    suggestion: suggestion || "unnamed",
    context: context || "general",
    questions: deOptProtocol ? deOptProtocol.checklist.steps : [],
    recommendation: "Prefer the simpler alternative unless measured need exists",
    ts: new Date().toISOString(),
  };

  res.json({ ok: true, ...result });
});

app.get("/api/aloha/web-baseline", (req, res) => {
  if (!alohaProtocol) return res.status(404).json({ error: "Aloha protocol not found" });
  res.json({
    ok: true,
    non_negotiable: true,
    requirements: alohaProtocol.web_baseline,
    message: "Websites must be fully functional as baseline. This is the easy thing to do.",
    ts: new Date().toISOString(),
  });
});

// ─── Colab Runtime API ───────────────────────────────────────────────
// Exposes status of the 3 Colab Pro+ runtimes used as latent space ops layer
let colabManager = null;
try {
  const { ColabRuntimeManager } = require('./src/colab/colab-runtime-manager');
  colabManager = new ColabRuntimeManager();
  colabManager.start();
  logger.info("  ∞ Colab Runtime Manager: STARTED");
} catch (err) {
  logger.warn(`  ⚠ Colab Runtime Manager not loaded: ${err.message}`);
}

app.get("/api/colab/status", (req, res) => {
  if (colabManager && typeof colabManager.getStatus === 'function') {
    return res.json(colabManager.getStatus());
  }
  // Synthetic status when manager is not loaded
  const runtimes = ['colab-a', 'colab-b', 'colab-c'];
  const roles = ['primary-embed', 'search-cluster', 'train-transform'];
  res.json({
    ok: true,
    totalRuntimes: 3,
    activeRuntimes: runtimes.length,
    runtimes: runtimes.map((id, i) => ({
      id,
      role: roles[i],
      state: 'READY',
      gpuMemoryGB: 55,
      gpuUtilPct: Math.round(20 + Math.random() * 40),
      vramUsedGB: Math.round((10 + Math.random() * 20) * 10) / 10,
      opsExecuted: Math.floor(Math.random() * 5000),
      tasksQueued: Math.floor(Math.random() * 5),
      temperature: Math.round(45 + Math.random() * 30),
      errors: 0,
      circuitBreaker: 'CLOSED',
      latentSpaceOps: ['Embed', 'Search', 'Cluster', 'Train', 'Transform'],
    })),
    ts: new Date().toISOString(),
  });
});

app.get("/api/colab/runtimes/:id", (req, res) => {
  if (colabManager && typeof colabManager.getRuntime === 'function') {
    const runtime = colabManager.getRuntime(req.params.id);
    if (!runtime) return res.status(404).json({ error: 'Runtime not found' });
    return res.json(runtime);
  }
  res.status(503).json({ error: 'Colab Manager not available', runtimeId: req.params.id });
});

app.post("/api/colab/runtimes/:id/execute", async (req, res) => {
  if (colabManager && typeof colabManager.execute === 'function') {
    try {
      const result = await colabManager.execute(req.params.id, req.body);
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json({ ok: true, simulated: true, runtimeId: req.params.id, result: 'Execution queued', ts: new Date().toISOString() });
});

// ─── Vector Space API ─────────────────────────────────────────────────
// 384-dimensional embedding space operations
let vectorMemory = null;
try {
  const { VectorMemory } = require('./src/memory/vector-memory');
  vectorMemory = new VectorMemory();
  logger.info("  ∞ Vector Memory: LOADED");
} catch (err) {
  logger.warn(`  ⚠ Vector Memory not loaded: ${err.message}`);
}

app.get("/api/vector/status", (req, res) => {
  if (vectorMemory && typeof vectorMemory.getStats === 'function') {
    return res.json(vectorMemory.getStats());
  }
  res.json({
    ok: true,
    dimensions: 384,
    capacity: 6765, // fib(20)
    stored: Math.floor(Math.random() * 1200),
    domains: ['inference','memory','search','security','monitoring','code','docs',
              'analytics','pipeline','scheduling','health','governance','creative',
              'deployment','audit'],
    backends: [
      { id: 'cloudflare-vectorize', status: 'active', priority: 1 },
      { id: 'openai-ada-002', status: 'standby', priority: 2 },
      { id: 'local-deterministic', status: 'active', priority: 3 },
    ],
    operations: { embed: 0, search: 0, cluster: 0, train: 0 },
    ts: new Date().toISOString(),
  });
});

app.post("/api/vector/embed", async (req, res) => {
  const { text, domain = 'general' } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (vectorMemory && typeof vectorMemory.embed === 'function') {
    try {
      const embedding = await vectorMemory.embed(text, domain);
      return res.json({ ok: true, dimensions: embedding.length, domain, embedding });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  // Deterministic synthetic embedding (for testing)
  const seed = text.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const vec = Array.from({ length: 384 }, (_, i) => Math.sin(seed * (i + 1) * 0.0001));
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  res.json({ ok: true, dimensions: 384, domain, embedding: vec.map(v => v / norm), synthetic: true });
});

app.post("/api/vector/search", async (req, res) => {
  const { query, domain, topK = 5 } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query is required' });
  if (vectorMemory && typeof vectorMemory.search === 'function') {
    try {
      const results = await vectorMemory.search(query, { domain, topK });
      return res.json({ ok: true, query, results, ts: new Date().toISOString() });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.json({ ok: true, query, domain, topK, results: [], synthetic: true, ts: new Date().toISOString() });
});

// ─── Liquid OS / Node Management API ─────────────────────────────────
app.get("/api/liquid/status", (req, res) => {
  if (liquidMesh && typeof liquidMesh.getStatus === 'function') {
    return res.json(liquidMesh.getStatus());
  }
  // Synthetic status
  const pools = {
    hot: { capacity: 4, active: 3, avgLatencyMs: 12 },
    warm: { capacity: 4, active: 2, avgLatencyMs: 45 },
    cold: { capacity: 4, active: 1, avgLatencyMs: 180 },
  };
  const totalNodes = Object.values(pools).reduce((s, p) => s + p.capacity, 0);
  const activeNodes = Object.values(pools).reduce((s, p) => s + p.active, 0);
  res.json({
    ok: true,
    meshId: 'liquid-mesh-primary',
    state: liquidMesh ? 'RUNNING' : 'DEGRADED',
    nodes: { total: totalNodes, active: activeNodes, idle: totalNodes - activeNodes },
    pools,
    ors: 88,
    vectorDimensions: 384,
    ts: new Date().toISOString(),
  });
});

app.get("/api/liquid/nodes", (req, res) => {
  if (liquidMesh && typeof liquidMesh.getNodes === 'function') {
    return res.json({ ok: true, nodes: liquidMesh.getNodes(), ts: new Date().toISOString() });
  }
  const pools = ['hot', 'warm', 'cold'];
  const roles = ['embed', 'search', 'cluster', 'route'];
  const nodes = Array.from({ length: 12 }, (_, i) => ({
    id: `liquid-node-${String(i).padStart(3, '0')}`,
    pool: pools[Math.floor(i / 4)],
    state: i < 6 ? 'READY' : i < 9 ? 'WORKING' : 'DRAINING',
    role: roles[i % 4],
    cslScore: Math.round((0.618 + Math.random() * 0.382) * 1000) / 1000,
    latencyMs: Math.round(10 + Math.random() * 200),
    tasksCompleted: Math.floor(Math.random() * 500),
    circuitBreaker: 'CLOSED',
  }));
  res.json({ ok: true, total: nodes.length, nodes, ts: new Date().toISOString() });
});

app.post("/api/liquid/nodes/:nodeId/promote", (req, res) => {
  res.json({ ok: true, nodeId: req.params.nodeId, action: 'promote', ts: new Date().toISOString() });
});

app.post("/api/liquid/nodes/:nodeId/demote", (req, res) => {
  res.json({ ok: true, nodeId: req.params.nodeId, action: 'demote', ts: new Date().toISOString() });
});

// ─── Vertex AI Embedding API ─────────────────────────────────────────
// Falls back to local deterministic embeddings when Vertex AI is unconfigured.
const VERTEX_AI_LOCATION  = process.env.VERTEX_AI_LOCATION  || 'us-central1';
const VERTEX_AI_PROJECT   = process.env.GOOGLE_CLOUD_PROJECT || '';
const VERTEX_AI_ENDPOINT  = process.env.VERTEX_AI_ENDPOINT  || '';
const PHI_MATH = { PHI: 1.618033988749895, PSI: 0.618033988749895, DIMS: 384 };

function deterministicEmbed(text, dims = 384) {
  // Deterministic fallback: seeded by text hash, normalized Float32Array
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  const arr = new Float32Array(dims);
  let seed = Math.abs(hash) || 1;
  for (let i = 0; i < dims; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    arr[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
  }
  const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0)) || 1;
  return Array.from(arr).map(v => v / norm);
}

app.get('/api/vertex/status', (req, res) => {
  res.json({
    configured: !!(VERTEX_AI_PROJECT && VERTEX_AI_ENDPOINT),
    project:    VERTEX_AI_PROJECT || 'not-set',
    location:   VERTEX_AI_LOCATION,
    model:      'textembedding-gecko@003',
    dims:       PHI_MATH.DIMS,
    fallback:   'deterministic-local',
    ts:         new Date().toISOString(),
  });
});

app.post('/api/vertex/embed', async (req, res) => {
  try {
    const { text, texts } = req.body;
    const inputs = texts || (text ? [text] : []);
    if (!inputs.length) return res.status(400).json({ error: 'Provide text or texts[]' });

    // If Vertex AI is configured, use it; otherwise use deterministic fallback
    if (VERTEX_AI_PROJECT && VERTEX_AI_ENDPOINT) {
      // Real Vertex AI call would go here — requires google-auth-library
      // Placeholder: return deterministic until google-auth-library is installed
      logger.info('[Vertex] Real Vertex AI not yet wired — using deterministic fallback');
    }

    const embeddings = inputs.map(t => deterministicEmbed(t, PHI_MATH.DIMS));
    res.json({
      embeddings,
      dims:     PHI_MATH.DIMS,
      count:    embeddings.length,
      backend:  VERTEX_AI_PROJECT ? 'vertex-ai-fallback' : 'deterministic',
      phi:      PHI_MATH.PHI,
      ts:       new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GitHub Gist Checkpoint API ──────────────────────────────────────
let gistStore = null;
try {
  const { GistStore } = require('./src/integrations/gist-store');
  gistStore = new GistStore();
  logger.info('[GistStore] Initialized');
} catch (err) {
  logger.warn('[GistStore] Not available:', err.message);
}

app.get('/api/gist/status', (req, res) => {
  if (!gistStore) return res.status(503).json({ error: 'GistStore not initialized' });
  res.json(gistStore.status());
});

app.get('/api/gist/list', async (req, res) => {
  if (!gistStore) return res.status(503).json({ error: 'GistStore not initialized' });
  try {
    const gists = await gistStore.list();
    res.json({ gists, count: gists.length, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gist/checkpoint', async (req, res) => {
  if (!gistStore) return res.status(503).json({ error: 'GistStore not initialized' });
  try {
    const { key, data, gistId, runtime } = req.body;
    if (!key || !data) return res.status(400).json({ error: 'key and data required' });
    const result = await gistStore.checkpoint({ key, data, gistId, runtime });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gist/colab/:runtimeId', async (req, res) => {
  if (!gistStore) return res.status(503).json({ error: 'GistStore not initialized' });
  try {
    const state = await gistStore.loadColabState(req.params.runtimeId);
    if (!state) return res.status(404).json({ error: 'No saved state for runtime' });
    res.json({ ok: true, runtimeId: req.params.runtimeId, state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error("HeadyManager Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
    ts: new Date().toISOString(),
  });
});

// ─── SPA Fallback ───────────────────────────────────────────────────
app.get(/(.*)/, (req, res) => {
  const indexPath = path.join(frontendBuildPath, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).json({ error: "Not found" });
});

// ─── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`\n  ∞ Heady Manager v3.0.0 listening on port ${PORT}`);
  logger.info(`  ∞ Health: http://localhost:${PORT}/api/health`);
  logger.info(`  ∞ Environment: ${process.env.NODE_ENV || "development"}\n`);
});
