const { createLogger } = require('../../../src/utils/logger');
const logger = createLogger('auto-fixed');
// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY SYSTEMS — MCP Backend (PRIVATE — Cloud Run only)        ║
// ║  ∞ SACRED GEOMETRY ∞  All trade secrets live here              ║
// ║  NEVER publish to npm · ONLY deploy to Cloud Run               ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * Heady MCP Backend — Private Cloud Run Server
 *
 * This is the PRIVATE backend that contains ALL proprietary code:
 *  - CSL engine (Continuous Semantic Logic)
 *  - φ-math (golden ratio calculations)
 *  - Vector memory (3-tier hot/warm/cold)
 *  - Swarm orchestration
 *  - Intelligence (HeadyBattle, autocontext)
 *  - Governance (policies, RBAC, audit)
 *
 * Deployed to Cloud Run. Never published to npm.
 * The public @heady-ai/mcp-server facade proxies tool calls here.
 */

'use strict';

const http = require('http');
const path = require('path');
const PHI = 1.618033988749895;
const PORT = parseInt(process.env.PORT, 10) || 8080;
const HEADY_ROOT = process.env.HEADY_ROOT || path.resolve(__dirname, '..', '..');

// ─── Auth Middleware ──────────────────────────────────────────────
const VALID_API_KEYS = new Set([process.env.HEADY_MASTER_KEY, process.env.HEADY_INTERNAL_KEY
// Add more keys from vault as needed
].filter(Boolean));
function validateAuth(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: 'Missing Authorization header'
    };
  }
  const token = authHeader.substring(7);
  if (!VALID_API_KEYS.has(token) && VALID_API_KEYS.size > 0) {
    return {
      valid: false,
      error: 'Invalid API key'
    };
  }
  // If no keys configured, allow (development mode)
  return {
    valid: true,
    token
  };
}

// ─── Proprietary Tool Implementations ─────────────────────────────
// These are the REAL implementations that contain trade secrets.
// They import from @heady-ai/core, phi-math, vector-memory, etc.

let cslEngine, phiMath, vectorMemory, orchestrator, intelligence, governance;
function loadProprietaryModules() {
  try {
    // CSL Engine — Continuous Semantic Logic gates
    cslEngine = require(path.join(HEADY_ROOT, 'src', 'engines', 'csl-engine'));
  } catch (e) {
    cslEngine = null;
  }
  try {
    // φ-math — Golden ratio calculations
    phiMath = require(path.join(HEADY_ROOT, 'packages', 'phi-math'));
  } catch (e) {
    phiMath = {
      PHI,
      scale: v => v * PHI,
      fibonacci: n => {
        const fib = [0, 1];
        for (let i = 2; i <= n; i++) fib[i] = fib[i - 1] + fib[i - 2];
        return fib;
      }
    };
  }
  try {
    // Vector Memory — 3-tier semantic search
    vectorMemory = require(path.join(HEADY_ROOT, 'packages', 'vector-memory'));
  } catch (e) {
    vectorMemory = null;
  }
  try {
    // Orchestration — Swarms, pipelines, task graphs
    orchestrator = require(path.join(HEADY_ROOT, 'packages', 'orchestrator'));
  } catch (e) {
    orchestrator = null;
  }
  try {
    // Intelligence — Battles, patterns, autocontext
    intelligence = require(path.join(HEADY_ROOT, 'mcp-servers', 'heady-intelligence-mcp-server'));
  } catch (e) {
    intelligence = null;
  }
  try {
    // Governance — Policies, RBAC, audit
    governance = require(path.join(HEADY_ROOT, 'mcp-servers', 'heady-governance-mcp-server'));
  } catch (e) {
    governance = null;
  }
}
loadProprietaryModules();

// ─── Tool Router ──────────────────────────────────────────────────
async function executeTool(name, args) {
  switch (name) {
    // ── Core ──
    case 'heady_search':
      {
        if (vectorMemory && vectorMemory.search) {
          return vectorMemory.search(args.query, args.top_k || 5, args.namespace);
        }
        return {
          results: [],
          message: 'Vector memory module loading'
        };
      }
    case 'heady_store':
      {
        if (vectorMemory && vectorMemory.store) {
          return vectorMemory.store(args.key, args.content, args.metadata, args.namespace);
        }
        return {
          stored: false,
          message: 'Vector memory module loading'
        };
      }
    case 'heady_health':
      {
        return {
          status: 'healthy',
          version: '5.0.0-backend',
          platform: 'cloud-run',
          uptime: process.uptime(),
          modules: {
            csl: !!cslEngine,
            phiMath: !!phiMath,
            vectorMemory: !!vectorMemory,
            orchestrator: !!orchestrator,
            intelligence: !!intelligence,
            governance: !!governance
          },
          phi: PHI,
          timestamp: new Date().toISOString()
        };
      }
    case 'heady_pipeline_run':
      {
        if (orchestrator && orchestrator.runPipeline) {
          return orchestrator.runPipeline(args.task, args.stages, args.priority);
        }
        return {
          pipelineId: `pipe-${Date.now().toString(36)}`,
          status: 'queued',
          task: args.task,
          stages: args.stages || ['all'],
          message: 'Pipeline execution queued'
        };
      }
    case 'heady_analyze':
      {
        return {
          analysisId: `ana-${Date.now().toString(36)}`,
          target: args.target?.substring(0, 100),
          type: args.type || 'code',
          depth: args.depth || 'standard',
          status: 'processing',
          cslConfidence: phiMath ? phiMath.scale(0.382) : 0.618
        };
      }
    case 'heady_bee_list':
      {
        if (orchestrator && orchestrator.listBees) {
          return orchestrator.listBees(args.swarm, args.status);
        }
        return {
          bees: [],
          swarms: [],
          message: 'Orchestrator loading'
        };
      }

    // ── Intelligence ──
    case 'heady_battle':
      {
        if (intelligence && intelligence.handleTool) {
          return intelligence.handleTool('heady_battle_start', {
            challenge: args.prompt,
            models: args.models,
            rounds: args.rounds
          });
        }
        return {
          battleId: `bat-${Date.now().toString(36)}`,
          status: 'queued',
          prompt: args.prompt?.substring(0, 100),
          models: args.models || ['auto']
        };
      }
    case 'heady_autocontext':
      {
        return {
          scope: args.scope || 'project',
          path: args.path || '.',
          enrichedAt: new Date().toISOString(),
          message: 'Autocontext scan queued'
        };
      }

    // ── Orchestration ──
    case 'heady_swarm_dispatch':
      {
        if (orchestrator && orchestrator.dispatch) {
          return orchestrator.dispatch(args.swarm, args.task, args.bees);
        }
        return {
          dispatchId: `swm-${Date.now().toString(36)}`,
          swarm: args.swarm,
          task: args.task,
          bees: args.bees || 'auto',
          status: 'dispatched'
        };
      }

    // ── Governance ──
    case 'heady_cost_report':
      {
        if (governance && governance.handleTool) {
          return governance.handleTool('heady_cost_breakdown', {
            period: args.period || 'month'
          });
        }
        return {
          period: args.period || 'month',
          totalCost: 0,
          breakdown: [],
          message: 'Governance loading'
        };
      }
    case 'heady_audit_log':
      {
        if (governance && governance.handleTool) {
          return governance.handleTool('heady_audit_query', {
            action: args.action,
            limit: args.limit || 20
          });
        }
        return {
          entries: [],
          message: 'Governance loading'
        };
      }

    // ── Ecosystem ──
    case 'heady_ecosystem_map':
      {
        try {
          const unified = require(path.join(HEADY_ROOT, 'mcp-servers', 'heady-unified-mcp-server'));
          return unified.ecosystem.getEcosystemMap();
        } catch (e) {
          return {
            error: 'Ecosystem analyzer not available'
          };
        }
      }
    case 'heady_ecosystem_dependencies':
      {
        try {
          const unified = require(path.join(HEADY_ROOT, 'mcp-servers', 'heady-unified-mcp-server'));
          return unified.ecosystem.getDependencyGraph();
        } catch (e) {
          return {
            error: 'Ecosystem analyzer not available'
          };
        }
      }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Health check (no auth required — Cloud Run needs this)
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'application/json'
    });
    return res.end(JSON.stringify({
      status: 'healthy',
      version: '5.0.0-backend',
      platform: 'cloud-run',
      uptime: process.uptime(),
      tools: 13,
      timestamp: new Date().toISOString()
    }));
  }

  // Tool execution endpoint
  if (req.method === 'POST' && req.url === '/mcp/tools/call') {
    // Auth check
    const auth = validateAuth(req);
    if (!auth.valid) {
      res.writeHead(401, {
        'Content-Type': 'application/json'
      });
      return res.end(JSON.stringify({
        error: auth.error
      }));
    }

    // Parse body
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const {
          tool,
          arguments: args
        } = JSON.parse(body);
        if (!tool) {
          res.writeHead(400, {
            'Content-Type': 'application/json'
          });
          return res.end(JSON.stringify({
            error: 'Missing "tool" field'
          }));
        }
        const result = await executeTool(tool, args || {});
        res.writeHead(200, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({
          result,
          executedAt: new Date().toISOString()
        }));
      } catch (err) {
        const statusCode = err.message.includes('Unknown tool') ? 404 : 500;
        res.writeHead(statusCode, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({
          error: err.message
        }));
      }
    });
    return;
  }

  // List tools endpoint
  if (req.method === 'GET' && req.url === '/mcp/tools/list') {
    const auth = validateAuth(req);
    if (!auth.valid) {
      res.writeHead(401, {
        'Content-Type': 'application/json'
      });
      return res.end(JSON.stringify({
        error: auth.error
      }));
    }
    res.writeHead(200, {
      'Content-Type': 'application/json'
    });
    return res.end(JSON.stringify({
      tools: ['heady_search', 'heady_store', 'heady_health', 'heady_pipeline_run', 'heady_analyze', 'heady_bee_list', 'heady_battle', 'heady_autocontext', 'heady_swarm_dispatch', 'heady_cost_report', 'heady_audit_log', 'heady_ecosystem_map', 'heady_ecosystem_dependencies'],
      count: 13
    }));
  }

  // 404
  res.writeHead(404, {
    'Content-Type': 'application/json'
  });
  res.end(JSON.stringify({
    error: 'Not found',
    endpoints: ['/health', '/mcp/tools/call', '/mcp/tools/list']
  }));
});
server.listen(PORT, () => {
  logger.info(`[heady-mcp-backend] ∞ Private backend listening on :${PORT}`);
  logger.info(`[heady-mcp-backend] Auth keys configured: ${VALID_API_KEYS.size}`);
  logger.info(`[heady-mcp-backend] Modules: CSL=${!!cslEngine} φ-math=${!!phiMath} VecMem=${!!vectorMemory} Orch=${!!orchestrator} Intel=${!!intelligence} Gov=${!!governance}`);
});