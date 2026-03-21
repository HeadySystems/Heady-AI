/**
 * Orchestration API Endpoint Router
 * Routes /api/system/status, /api/supervisor/status, /api/brain/status,
 * /api/registry, /api/pipeline/state, /api/nodes to real handlers
 *
 * P0 Critical: From Dropzone audit — these endpoints must return real JSON
 * instead of falling through to the marketing SPA
 */
'use strict';
const logger = require('../utils/logger') || console;

const { HermesAgent } = require('../agents/hermes');
const { KronosAgent } = require('../agents/kronos');
const { ArgusAgent } = require('../agents/argus');
const { NexusAgent } = require('../agents/nexus');
const { HeraldAgent } = require('../agents/herald');

const PHI = 1.618033988749895;

// ── Agent singletons ──
const hermes = new HermesAgent();
const kronos = new KronosAgent();
const argus = new ArgusAgent();
const nexus = new NexusAgent();
const herald = new HeraldAgent();
const logger = require('../utils/logger');

// Start all agents
async function initAgents() {
  await Promise.all([
    hermes.start(), kronos.start(), argus.start(),
    nexus.start(), herald.start()
  ]);
  logger.info('[API] All agents initialized');
}

/**
 * Mount orchestration routes on an Express-compatible app
 */
function mountOrchestrationRoutes(app) {

  // ── /api/system/status ──
  app.get('/api/system/status', (req, res) => {
    res.json({
      system: 'Heady Latent OS',
      version: '5.1.0',
      status: 'operational',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      agents: {
        HERMES: hermes.health(),
        KRONOS: kronos.health(),
        ARGUS: argus.health(),
        NEXUS: nexus.health(),
        HERALD: herald.health()
      },
      phi: PHI
    });
  });

  // ── /api/supervisor/status ──
  app.get('/api/supervisor/status', (req, res) => {
    res.json({
      supervisor: 'HCFullPipeline Conductor',
      version: '8.0.0',
      state: 'active',
      agents: {
        total: 5,
        hot: ['HERMES', 'KRONOS', 'ARGUS'],
        warm: ['NEXUS', 'HERALD']
      },
      taskMetrics: kronos.health(),
      auditIntegrity: argus.verifyAuditChain(),
      timestamp: new Date().toISOString()
    });
  });

  // ── /api/brain/status ──
  app.get('/api/brain/status', (req, res) => {
    res.json({
      brain: 'Heady Latent Brain',
      memoryLayers: ['vector', 'semantic', 'episodic', 'working'],
      telemetry: argus.health(),
      sessions: hermes.health(),
      drift: {
        alerts: argus.getDriftAlerts(Date.now() - 3600000),
        status: argus.getDriftAlerts(Date.now() - 3600000).length === 0 ? 'stable' : 'drifting'
      },
      timestamp: new Date().toISOString()
    });
  });

  // ── /api/registry ──
  app.get('/api/registry', async (req, res) => {
    const serverCard = await hermes.getServerCard();
    res.json({
      registry: 'Heady Service Registry',
      tools: serverCard?.tools?.length || 0,
      agents: serverCard?.agents || {},
      nodes: serverCard?.nodes || {},
      transport: serverCard?.transport || {},
      capabilities: serverCard?.capabilities || {},
      timestamp: new Date().toISOString()
    });
  });

  // ── /api/pipeline/state ──
  app.get('/api/pipeline/state', (req, res) => {
    res.json({
      pipeline: 'HCFullPipeline v8.0.0',
      stages: 21,
      executionModel: 'concurrent-equals',
      globalRules: {
        deterministic: true,
        phiBackoff: true,
        jitterEnabled: true,
        monteCarlo: true,
        selfCritique: true
      },
      taskCounts: kronos.health(),
      events: {
        totalFired: herald.health().totalEvents,
        activeTriggers: herald.health().triggers
      },
      timestamp: new Date().toISOString()
    });
  });

  // ── /api/nodes ──
  app.get('/api/nodes', async (req, res) => {
    const serverCard = await hermes.getServerCard();
    const agents = serverCard?.agents || {};
    const nodes = serverCard?.nodes || {};

    res.json({
      nodeRegistry: 'Heady Node & Agent Registry',
      agents: Object.entries(agents).map(([name, info]) => ({
        name, ...info, health: { HERMES: hermes, KRONOS: kronos, ARGUS: argus, NEXUS: nexus, HERALD: herald }[name]?.health() || 'unregistered'
      })),
      nodes: Object.entries(nodes).map(([name, info]) => ({
        name, ...info, status: 'registered'
      })),
      totalAgents: Object.keys(agents).length,
      totalNodes: Object.keys(nodes).length,
      timestamp: new Date().toISOString()
    });
  });

  // ── /api/health ──
  app.get('/api/health', (req, res) => {
    const health = {
      status: 'healthy',
      version: '5.1.0',
      uptime: process.uptime(),
      agents: [hermes, kronos, argus, nexus, herald].map(a => a.health()),
      timestamp: new Date().toISOString()
    };
    res.json(health);
  });

  // ── /api/tasks ──
  app.get('/api/tasks', async (req, res) => {
    const tasks = await kronos.listTasks({ limit: 50 });
    res.json({ tasks, total: tasks.length, timestamp: new Date().toISOString() });
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const task = await kronos.createTask(req.body || {});
      argus.recordAudit({ actor: 'api', action: 'task.create', resource: task.id });
      res.status(201).json(task);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── /api/events ──
  app.post('/api/events', async (req, res) => {
    try {
      const event = await herald.fireEvent(req.body || {});
      argus.recordAudit({ actor: 'api', action: 'event.fire', resource: event.id });
      res.status(201).json(event);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── /api/audit ──
  app.get('/api/audit', (req, res) => {
    const integrity = argus.verifyAuditChain();
    const recent = argus.auditLog.slice(-20);
    res.json({ integrity, recentEntries: recent, total: argus.auditLog.length });
  });

  // ── /api/sessions ──
  app.post('/api/sessions', async (req, res) => {
    try {
      const session = await hermes.createSession(req.body?.clientId || 'anonymous', req.body?.metadata);
      argus.recordAudit({ actor: req.body?.clientId, action: 'session.create', resource: session.id });
      res.status(201).json(session);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── /.well-known/mcp.json ──
  app.get('/.well-known/mcp.json', async (req, res) => {
    const card = await hermes.getServerCard();
    res.json(card);
  });

  logger.info('[API] Orchestration routes mounted: /api/system/status, /api/supervisor/status, /api/brain/status, /api/registry, /api/pipeline/state, /api/nodes, /api/health, /api/tasks, /api/events, /api/audit, /api/sessions, /.well-known/mcp.json');
}

module.exports = { mountOrchestrationRoutes, initAgents, hermes, kronos, argus, nexus, herald };
