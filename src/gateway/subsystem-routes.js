const { createLogger } = require('../utils/logger');
const logger = createLogger('subsystem-routes');

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
// ║  FILE: src/gateway/subsystem-routes.js                            ║
// ║  LAYER: backend/src                                               ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * Subsystem Routes — API endpoints for Colab Cluster, Swarm Coordinator,
 * Bee Factory, Universal Agent Prompt, and Liquid Node infrastructure.
 *
 * Wires all subsystems into the Express app and exposes health, status,
 * and task execution endpoints for each subsystem.
 *
 * @module subsystem-routes
 * @version 1.0.0
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Structured logger — emits JSON in production, readable text in dev
const LOG_JSON = process.env.NODE_ENV === 'production';
const log = {
  info: (msg, meta = {}) => LOG_JSON
    ? process.stdout.write(JSON.stringify({ level: 'info', module: 'SubsystemRoutes', msg, ...meta, ts: Date.now() }) + '\n')
    : console.info(`[SubsystemRoutes] ${msg}`),
  warn: (msg, meta = {}) => LOG_JSON
    ? process.stdout.write(JSON.stringify({ level: 'warn', module: 'SubsystemRoutes', msg, ...meta, ts: Date.now() }) + '\n')
    : console.warn(`[SubsystemRoutes] ${msg}`),
};

const { ColabRuntimeCluster } = require('../colab/colab-runtime-nodes.js');
const logger = require('../utils/logger');
const { loadUniversalPrompt, buildAgentPrompt, buildCompactDirective,
        getPromptHash, CSL_GATES, ARCHETYPES, COLAB_RUNTIMES,
        SWARM_MATRIX } = require('../agents/universal-agent-prompt.js');

// Lazy-load bee factory, swarm coordinator, and pipeline (CJS modules)
let BeeFactory, SwarmCoordinator, registerComputeProviders;
try {
  BeeFactory = require('../bees/bee-factory.js');
  SwarmCoordinator = require('../bees/swarm-coordinator.js');
} catch (err) {
  logger.warn('[SubsystemRoutes] Bee/Swarm modules not loaded:', err.message);
}
try {
  registerComputeProviders = require('../hc_pipeline.js').registerComputeProviders;
} catch (err) {
  logger.warn('[SubsystemRoutes] Pipeline compute registration not available:', err.message);
}

// ── Liquid Nodes (Core Vector Space Infrastructure) ──
let LiquidNodeRegistry, VectorRouter, HealthMonitor, ColabRuntimeManager;
const _liquidNodesReady = import('../core/liquid-nodes/index.js').then(mod => {
  LiquidNodeRegistry = mod.LiquidNodeRegistry;
  VectorRouter = mod.VectorRouter;
  HealthMonitor = mod.HealthMonitor;
  ColabRuntimeManager = mod.ColabRuntimeManager;
}).catch(err => {
  logger.warn('[SubsystemRoutes] Liquid Nodes modules not loaded:', err.message);
});

// ── Subsystem Singletons ──

let colabCluster = null;
let beeFactory = null;
let swarmCoordinator = null;
let nodeRegistry = null;
let vectorRouter = null;
let healthMonitor = null;
let colabRuntimeManager = null;

/**
 * Initialize all subsystems. Called once at server startup.
 * @returns {Promise<Object>} Initialized subsystem references
 */
async function initializeSubsystems() {
  const results = { colab: false, bees: false, swarms: false, prompt: false };

  // 1. Initialize Colab Runtime Cluster (3 Colab Pro+ A100s)
  try {
    colabCluster = new ColabRuntimeCluster();
    await colabCluster.initialize();
    results.colab = true;
    logger.info('[SubsystemRoutes] Colab Runtime Cluster initialized (3 runtimes: Cortex, Synapse, Reflex)');
  } catch (err) {
    logger.warn('[SubsystemRoutes] Colab cluster init failed:', err.message);
  }

  // 2. Initialize Bee Factory (17 swarms, up to 10,000 bees)
  try {
    if (BeeFactory) {
      const FactoryClass = BeeFactory.BeeFactory || BeeFactory.default || BeeFactory;
      if (typeof FactoryClass === 'function') {
        beeFactory = new FactoryClass();
        results.bees = true;
        logger.info('[SubsystemRoutes] Bee Factory initialized');
      }
    }
  } catch (err) {
    logger.warn('[SubsystemRoutes] Bee Factory init failed:', err.message);
  }

  // 3. Initialize Swarm Coordinator
  try {
    if (SwarmCoordinator) {
      const CoordClass = SwarmCoordinator.SwarmCoordinator || SwarmCoordinator.default || SwarmCoordinator;
      if (typeof CoordClass === 'function') {
        swarmCoordinator = new CoordClass({ beeFactory });
        results.swarms = true;
        logger.info('[SubsystemRoutes] Swarm Coordinator initialized (17 swarms)');
      }
    }
  } catch (err) {
    logger.warn('[SubsystemRoutes] Swarm Coordinator init failed:', err.message);
  }

  // 4. Pre-load Universal Prompt (warm the cache)
  try {
    loadUniversalPrompt();
    results.prompt = true;
    logger.info(`[SubsystemRoutes] Universal Agent Prompt loaded (hash: ${getPromptHash()})`);
  } catch (err) {
    logger.warn('[SubsystemRoutes] Universal Prompt load failed:', err.message);
  }

  // 5. Initialize Liquid Node Registry + Vector Router + Colab Runtime Manager
  await _liquidNodesReady;
  try {
    if (LiquidNodeRegistry) {
      nodeRegistry = new LiquidNodeRegistry();
      nodeRegistry.initialize();
      results.liquidNodes = true;
      logger.info(`[SubsystemRoutes] Liquid Node Registry initialized (${nodeRegistry.getAllNodes().length} nodes in 3D vector space)`);

      if (VectorRouter) {
        vectorRouter = new VectorRouter(nodeRegistry);
        logger.info('[SubsystemRoutes] Vector Router initialized (CSL-gated 3D routing)');
      }

      if (HealthMonitor) {
        healthMonitor = new HealthMonitor(nodeRegistry);
        logger.info('[SubsystemRoutes] Health Monitor initialized (phi-scaled heartbeats)');
      }

      if (ColabRuntimeManager) {
        colabRuntimeManager = new ColabRuntimeManager();
        colabRuntimeManager.initialize();
        logger.info('[SubsystemRoutes] Colab Runtime Manager initialized (3 A100 runtimes as latent space ops)');
      }
    }
  } catch (err) {
    logger.warn('[SubsystemRoutes] Liquid Nodes init failed:', err.message);
  }

  // 6. Register compute providers with the pipeline task executor
  if (registerComputeProviders && (colabCluster || swarmCoordinator)) {
    registerComputeProviders({ colabCluster, swarmCoordinator, colabRuntimeManager });
    logger.info('[SubsystemRoutes] Pipeline compute providers registered (colab + swarms + liquid nodes)');
  }

  return results;
}

/**
 * Set up all subsystem API routes on the Express app.
 * @param {import('express').Express} app - Express application
 */
function setupSubsystemRoutes(app) {

  // ═══════════════════════════════════════════════════════════════
  // COLAB CLUSTER ROUTES
  // ═══════════════════════════════════════════════════════════════

  app.get('/api/colab/cluster/health', (req, res) => {
    if (!colabCluster) {
      return res.status(503).json({ error: 'Colab cluster not initialized', status: 'offline' });
    }
    res.json(colabCluster.getClusterHealth());
  });

  app.get('/api/colab/runtimes', (req, res) => {
    if (!colabCluster) {
      return res.status(503).json({ error: 'Colab cluster not initialized' });
    }
    const health = colabCluster.getClusterHealth();
    res.json(health.nodes);
  });

  app.get('/api/colab/runtimes/:id', (req, res) => {
    if (!colabCluster) {
      return res.status(503).json({ error: 'Colab cluster not initialized' });
    }
    const node = colabCluster.nodes.get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Runtime not found' });
    res.json(node.getHealth());
  });

  app.post('/api/colab/execute', async (req, res, next) => {
    try {
      if (!colabCluster) {
        return res.status(503).json({ error: 'Colab cluster not initialized' });
      }
      const { type, data } = req.body;
      if (!type) return res.status(400).json({ error: 'Missing task type' });

      const result = await colabCluster.executeTask({
        id: `task-${Date.now()}`,
        type,
        data,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // SWARM & BEE ROUTES
  // ═══════════════════════════════════════════════════════════════

  app.get('/api/swarms/status', (req, res) => {
    if (!swarmCoordinator) {
      return res.json({
        status: 'not_initialized',
        swarmMatrix: SWARM_MATRIX,
        message: 'Swarm coordinator defined but not instantiated',
      });
    }
    const status = typeof swarmCoordinator.getStatus === 'function'
      ? swarmCoordinator.getStatus()
      : { status: 'active', type: 'SwarmCoordinator' };
    res.json(status);
  });

  app.get('/api/bees/status', (req, res) => {
    if (!beeFactory) {
      return res.json({
        status: 'not_initialized',
        message: 'Bee factory defined but not instantiated',
      });
    }
    const status = typeof beeFactory.getStatus === 'function'
      ? beeFactory.getStatus()
      : { status: 'active', type: 'BeeFactory' };
    res.json(status);
  });

  app.get('/api/swarms/matrix', (req, res) => {
    res.json({
      totalSwarms: SWARM_MATRIX.length,
      swarms: SWARM_MATRIX,
      beeFactoryActive: !!beeFactory,
      swarmCoordinatorActive: !!swarmCoordinator,
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL AGENT PROMPT ROUTES
  // ═══════════════════════════════════════════════════════════════

  app.get('/api/universal-prompt/status', (req, res) => {
    res.json({
      loaded: !!getPromptHash(),
      hash: getPromptHash(),
      archetypes: ARCHETYPES.map(a => ({ name: a.name, domain: a.domain, gate: a.gate })),
      cslGates: CSL_GATES,
      colabRuntimes: COLAB_RUNTIMES.map(r => ({ id: r.id, codename: r.codename, role: r.role })),
      swarmCount: SWARM_MATRIX.length,
    });
  });

  app.get('/api/universal-prompt/full', (req, res) => {
    const prompt = loadUniversalPrompt();
    res.type('text/markdown').send(prompt);
  });

  app.post('/api/universal-prompt/build', (req, res) => {
    const { agentId, skills, pool, ring, stage, runId, readinessScore } = req.body;
    if (!agentId) return res.status(400).json({ error: 'Missing agentId' });

    const prompt = buildAgentPrompt(
      { id: agentId, skills: skills || [], pool: pool || 'warm', ring: ring || 'middle' },
      { stage, runId, readinessScore }
    );
    res.type('text/markdown').send(prompt);
  });

  app.post('/api/universal-prompt/compact', (req, res) => {
    const { agentId, skills, pool } = req.body;
    if (!agentId) return res.status(400).json({ error: 'Missing agentId' });

    const directive = buildCompactDirective({
      id: agentId, skills: skills || [], pool: pool || 'warm',
    });
    res.type('text/plain').send(directive);
  });

  // ═══════════════════════════════════════════════════════════════
  // LIQUID NODES (3D Vector Space Infrastructure)
  // ═══════════════════════════════════════════════════════════════

  app.get('/api/liquid-nodes/registry', (req, res) => {
    if (!nodeRegistry) {
      return res.status(503).json({ error: 'Liquid node registry not initialized' });
    }
    res.json(nodeRegistry.toJSON());
  });

  app.get('/api/liquid-nodes/stats', (req, res) => {
    if (!nodeRegistry) {
      return res.status(503).json({ error: 'Liquid node registry not initialized' });
    }
    res.json(nodeRegistry.stats());
  });

  app.get('/api/liquid-nodes/platform/:platform', (req, res) => {
    if (!nodeRegistry) {
      return res.status(503).json({ error: 'Liquid node registry not initialized' });
    }
    const nodes = nodeRegistry.getNodesByPlatform(req.params.platform);
    res.json({ platform: req.params.platform, nodes, count: nodes.length });
  });

  app.get('/api/liquid-nodes/:nodeId', (req, res) => {
    if (!nodeRegistry) {
      return res.status(503).json({ error: 'Liquid node registry not initialized' });
    }
    const node = nodeRegistry.getNode(req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    res.json(node);
  });

  app.post('/api/liquid-nodes/route', async (req, res, next) => {
    try {
      if (!vectorRouter) {
        return res.status(503).json({ error: 'Vector router not initialized' });
      }
      const { taskType, constraints } = req.body;
      if (!taskType) return res.status(400).json({ error: 'Missing taskType' });

      const taskVector = vectorRouter.getTaskVector(taskType);
      const result = vectorRouter.selectOptimal(taskVector, taskType, constraints || {});
      if (!result) return res.status(404).json({ error: 'No suitable node found' });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/liquid-nodes/routing/stats', (req, res) => {
    if (!vectorRouter) {
      return res.status(503).json({ error: 'Vector router not initialized' });
    }
    res.json(vectorRouter.getRoutingStats());
  });

  app.post('/api/liquid-nodes/rebalance', (req, res) => {
    if (!vectorRouter) {
      return res.status(503).json({ error: 'Vector router not initialized' });
    }
    const redistributions = vectorRouter.rebalance();
    res.json({ redistributions: redistributions || [], timestamp: new Date().toISOString() });
  });

  // ── Colab Runtime Manager Routes ──

  app.get('/api/liquid-nodes/colab/cluster', (req, res) => {
    if (!colabRuntimeManager) {
      return res.status(503).json({ error: 'Colab runtime manager not initialized' });
    }
    res.json(colabRuntimeManager.getClusterStatus());
  });

  app.get('/api/liquid-nodes/colab/:runtimeId/gpu', (req, res) => {
    if (!colabRuntimeManager) {
      return res.status(503).json({ error: 'Colab runtime manager not initialized' });
    }
    try {
      res.json(colabRuntimeManager.getGpuMetrics(req.params.runtimeId));
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/liquid-nodes/colab/:runtimeId/provision', async (req, res, next) => {
    try {
      if (!colabRuntimeManager) {
        return res.status(503).json({ error: 'Colab runtime manager not initialized' });
      }
      const result = await colabRuntimeManager.provision(req.params.runtimeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/liquid-nodes/colab/execute', async (req, res, next) => {
    try {
      if (!colabRuntimeManager) {
        return res.status(503).json({ error: 'Colab runtime manager not initialized' });
      }
      const { op, params } = req.body;
      if (!op) return res.status(400).json({ error: 'Missing op (embed|search|cluster|train|transform)' });
      const result = await colabRuntimeManager.executeLatentOp(op, params || {});
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/liquid-nodes/colab/:runtimeId/sync-memory', async (req, res, next) => {
    try {
      if (!colabRuntimeManager) {
        return res.status(503).json({ error: 'Colab runtime manager not initialized' });
      }
      const result = await colabRuntimeManager.syncVectorMemory(req.params.runtimeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // COMBINED SUBSYSTEM OVERVIEW
  // ═══════════════════════════════════════════════════════════════

  app.get('/api/subsystems', (req, res) => {
    const overview = {
      colabCluster: colabCluster ? colabCluster.getClusterHealth() : { status: 'offline' },
      swarmCoordinator: swarmCoordinator
        ? (typeof swarmCoordinator.getStatus === 'function' ? swarmCoordinator.getStatus() : { status: 'active' })
        : { status: 'offline' },
      beeFactory: beeFactory
        ? (typeof beeFactory.getStatus === 'function' ? beeFactory.getStatus() : { status: 'active' })
        : { status: 'offline' },
      liquidNodes: nodeRegistry
        ? { status: 'active', ...nodeRegistry.stats() }
        : { status: 'offline' },
      vectorRouter: vectorRouter
        ? { status: 'active', ...vectorRouter.getRoutingStats() }
        : { status: 'offline' },
      colabRuntimeManager: colabRuntimeManager
        ? { status: 'active', ...colabRuntimeManager.getClusterStatus() }
        : { status: 'offline' },
      universalPrompt: {
        loaded: !!getPromptHash(),
        hash: getPromptHash(),
        archetypeCount: ARCHETYPES.length,
        swarmCount: SWARM_MATRIX.length,
        colabRuntimeCount: COLAB_RUNTIMES.length,
      },
      timestamp: new Date().toISOString(),
    };
    res.json(overview);
  });
}

/**
 * Shutdown all subsystems gracefully.
 * @returns {Promise<void>}
 */
async function shutdownSubsystems() {
  if (colabRuntimeManager) {
    for (const rt of colabRuntimeManager.getAllRuntimes()) {
      try { await colabRuntimeManager.terminate(rt.id); } catch (e) {
        logger.error('Unexpected error', { error: e.message, stack: e.stack });
      }
    }
    logger.info('[SubsystemRoutes] Colab runtime manager shut down');
  }
  if (colabCluster) {
    await colabCluster.shutdown();
    logger.info('[SubsystemRoutes] Colab cluster shut down');
  }
  if (beeFactory && typeof beeFactory.shutdown === 'function') {
    await beeFactory.shutdown();
    logger.info('[SubsystemRoutes] Bee factory shut down');
  }
  if (swarmCoordinator && typeof swarmCoordinator.shutdown === 'function') {
    await swarmCoordinator.shutdown();
    logger.info('[SubsystemRoutes] Swarm coordinator shut down');
  }
}

export {
  setupSubsystemRoutes,
  initializeSubsystems,
  shutdownSubsystems,
  colabCluster,
  beeFactory,
  swarmCoordinator,
  nodeRegistry,
  vectorRouter,
  healthMonitor,
  colabRuntimeManager,
};
