/**
 * Heady™ Liquid Node Registry — Multi-Platform Compute Fabric
 * ════════════════════════════════════════════════════════════
 *
 * Liquid Nodes are ephemeral compute endpoints that Heady can
 * spin up across multiple platforms. Each node runs a subset of
 * Heady services and connects back to the central conductor.
 *
 * Platforms:
 *   - Google Colab (GPU: T4/V100/A100)
 *   - Cloudflare Workers (edge: 300+ PoPs)
 *   - Google Cloud Run (serverless containers)
 *   - Google AI Studio (Gemini models)
 *   - Vertex AI (ML pipelines + embeddings)
 *   - GitHub Actions (CI/CD compute)
 *   - GitHub Gists (config + snippet storage)
 *
 * @module core/liquid/node-registry
 */
'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const { PHI, PSI, fib, TIMING } = require('../constants/phi');

// ─── Node Types ─────────────────────────────────────────────────────────────────

const NODE_TYPE = {
  COLAB:      'colab',
  CLOUDFLARE: 'cloudflare',
  CLOUD_RUN:  'cloud-run',
  AI_STUDIO:  'ai-studio',
  VERTEX_AI:  'vertex-ai',
  GITHUB:     'github-actions',
  GIST:       'github-gist',
};

const NODE_STATE = {
  PROVISIONING: 'PROVISIONING',
  READY:        'READY',
  BUSY:         'BUSY',
  DRAINING:     'DRAINING',
  TERMINATED:   'TERMINATED',
  ERROR:        'ERROR',
};

// ─── Platform Configurations ────────────────────────────────────────────────────

const PLATFORMS = {
  [NODE_TYPE.COLAB]: {
    displayName: 'Google Colab',
    capabilities: ['gpu', 'embedding', 'inference', 'training', 'vector-ops'],
    maxConcurrent: fib(3),   // 2 notebooks
    bootTimeMs: TIMING.LONG, // ~47s
    costTier: 'compute',
    gpuTypes: ['T4', 'V100', 'A100'],
    config: {
      project: process.env.GCP_PROJECT || 'gen-lang-client-0920560496',
      runtime: 'gpu',
      accelerator: 'T4',
      idleTimeout: Math.round(TIMING.IDLE * fib(5)), // ~64,720ms
    },
    bootstrap: {
      // Colab notebook cells to execute on startup
      cells: [
        '!pip install torch transformers sentence-transformers pgvector psycopg2-binary',
        'from sentence_transformers import SentenceTransformer\nmodel = SentenceTransformer("all-MiniLM-L6-v2")',
        'import requests\nHEADY_ENDPOINT = "https://api.headysystems.com/v1"',
      ],
    },
  },

  [NODE_TYPE.CLOUDFLARE]: {
    displayName: 'Cloudflare Workers',
    capabilities: ['edge', 'routing', 'caching', 'kv-storage', 'ai-inference'],
    maxConcurrent: fib(8),    // 21 workers
    bootTimeMs: TIMING.FAST,  // ~4.2s
    costTier: 'edge',
    config: {
      accountId: process.env.CF_ACCOUNT_ID || '8b1fa38f282c691423c6399247d53323',
      compatibilityDate: '2026-03-01',
      routes: [
        '*.headysystems.com/*',
        '*.headyme.com/*',
        '*.heady-ai.com/*',
        '*.headyos.com/*',
        '*.headyconnection.org/*',
        '*.headyconnection.com/*',
        '*.headyex.com/*',
        '*.headyfinance.com/*',
      ],
    },
    workerScript: `
      export default {
        async fetch(request, env) {
          const url = new URL(request.url);
          // Liquid node health check
          if (url.pathname === '/_heady/health') {
            return new Response(JSON.stringify({
              status: 'ok', node: 'cloudflare', region: request.cf?.colo,
              timestamp: Date.now()
            }), { headers: { 'Content-Type': 'application/json' }});
          }
          // Vector cache lookup from KV
          if (url.pathname.startsWith('/_heady/cache/')) {
            const key = url.pathname.slice(14);
            const cached = await env.HEADY_KV.get(key, 'json');
            if (cached) return new Response(JSON.stringify(cached));
            return new Response('miss', { status: 404 });
          }
          return fetch(request);
        }
      };
    `,
  },

  [NODE_TYPE.CLOUD_RUN]: {
    displayName: 'Google Cloud Run',
    capabilities: ['container', 'api', 'scaling', 'gpu'],
    maxConcurrent: fib(7),     // 13 instances
    bootTimeMs: TIMING.NORMAL, // ~11s
    costTier: 'serverless',
    config: {
      project: process.env.GCP_PROJECT || 'gen-lang-client-0920560496',
      region: 'us-east1',
      minInstances: 1,
      maxInstances: fib(7),    // 13
      concurrency: fib(8) * fib(4), // 21*3 = 63
      cpu: 2,
      memory: '2Gi',
      cpuAlwaysOn: true,
    },
  },

  [NODE_TYPE.AI_STUDIO]: {
    displayName: 'Google AI Studio',
    capabilities: ['gemini', 'inference', 'embedding', 'grounding'],
    maxConcurrent: fib(5),     // 5 concurrent
    bootTimeMs: TIMING.FAST,   // ~4.2s
    costTier: 'inference',
    config: {
      models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro'],
      defaultModel: 'gemini-2.0-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      envKey: 'GOOGLE_AI_STUDIO_KEY',
    },
  },

  [NODE_TYPE.VERTEX_AI]: {
    displayName: 'Vertex AI',
    capabilities: ['ml-pipeline', 'embedding', 'prediction', 'training', 'tuning'],
    maxConcurrent: fib(4),     // 3 pipelines
    bootTimeMs: TIMING.LONG,   // ~47s
    costTier: 'ml',
    config: {
      project: process.env.GCP_PROJECT || 'gen-lang-client-0920560496',
      region: 'us-east1',
      endpoints: {
        embedding: 'publishers/google/models/text-embedding-004',
        prediction: 'publishers/google/models/gemini-2.0-flash',
      },
      pipelineRoot: `gs://gen-lang-client-0920560496-heady-pipelines`,
    },
  },

  [NODE_TYPE.GITHUB]: {
    displayName: 'GitHub Actions',
    capabilities: ['ci-cd', 'testing', 'building', 'deployment'],
    maxConcurrent: fib(5),     // 5 runners
    bootTimeMs: TIMING.NORMAL, // ~11s
    costTier: 'ci',
    config: {
      org: 'HeadyMe',
      repo: 'Heady-pre-production-9f2f0642',
      runnerLabels: ['ubuntu-latest', 'self-hosted'],
      workflowDir: '.github/workflows/',
    },
  },

  [NODE_TYPE.GIST]: {
    displayName: 'GitHub Gists',
    capabilities: ['config-storage', 'snippet-sharing', 'versioned-snippets'],
    maxConcurrent: fib(8),     // 21 gists
    bootTimeMs: 1000,          // ~1s
    costTier: 'free',
    config: {
      owner: 'HeadyMe',
      apiEndpoint: 'https://api.github.com/gists',
      envKey: 'GITHUB_TOKEN',
      prefixes: {
        config: 'heady-config-',
        snippet: 'heady-snippet-',
        pipeline: 'heady-pipeline-',
        embedding: 'heady-embedding-',
      },
    },
  },
};

// ─── Liquid Node Registry ───────────────────────────────────────────────────────

class LiquidNodeRegistry extends EventEmitter {
  constructor() {
    super();
    this._nodes = new Map();  // nodeId → { type, state, metadata, createdAt, lastPingAt }
    this._platformStats = new Map();
  }

  /**
   * Register a liquid node.
   * @param {string} type - NODE_TYPE value
   * @param {object} [metadata] - Node-specific metadata
   * @returns {string} nodeId
   */
  registerNode(type, metadata = {}) {
    const platform = PLATFORMS[type];
    if (!platform) throw new Error(`Unknown platform: ${type}`);

    const nodeId = `ln_${type}_${crypto.randomBytes(4).toString('hex')}`;

    this._nodes.set(nodeId, {
      nodeId,
      type,
      platform: platform.displayName,
      state: NODE_STATE.PROVISIONING,
      capabilities: platform.capabilities,
      metadata,
      createdAt: Date.now(),
      lastPingAt: Date.now(),
      metrics: { tasksCompleted: 0, tasksFailed: 0, totalLatencyMs: 0 },
    });

    // Track per-platform stats
    if (!this._platformStats.has(type)) {
      this._platformStats.set(type, { active: 0, total: 0, totalTasks: 0 });
    }
    const stats = this._platformStats.get(type);
    stats.active++;
    stats.total++;

    this.emit('node:registered', { nodeId, type, platform: platform.displayName });
    return nodeId;
  }

  /** Update node state */
  setNodeState(nodeId, state) {
    const node = this._nodes.get(nodeId);
    if (!node) return false;
    const oldState = node.state;
    node.state = state;
    node.lastPingAt = Date.now();

    if (state === NODE_STATE.TERMINATED) {
      const stats = this._platformStats.get(node.type);
      if (stats) stats.active--;
    }

    this.emit('node:stateChange', { nodeId, from: oldState, to: state });
    return true;
  }

  /** Record task completion on a node */
  recordTask(nodeId, elapsed, success) {
    const node = this._nodes.get(nodeId);
    if (!node) return;
    if (success) node.metrics.tasksCompleted++;
    else node.metrics.tasksFailed++;
    node.metrics.totalLatencyMs += elapsed;
    node.lastPingAt = Date.now();

    const stats = this._platformStats.get(node.type);
    if (stats) stats.totalTasks++;
  }

  /** Get all nodes by platform */
  getNodesByPlatform(type) {
    return [...this._nodes.values()].filter(n => n.type === type);
  }

  /** Get ready nodes with a specific capability */
  getReadyNodes(capability) {
    return [...this._nodes.values()].filter(n =>
      n.state === NODE_STATE.READY && n.capabilities.includes(capability)
    );
  }

  /** Find the best node for a given capability */
  findBestNode(capability) {
    const ready = this.getReadyNodes(capability);
    if (ready.length === 0) return null;

    // Score: prefer less loaded, higher success rate
    let best = null;
    let bestScore = -1;

    for (const node of ready) {
      const total = node.metrics.tasksCompleted + node.metrics.tasksFailed;
      const successRate = total > 0 ? node.metrics.tasksCompleted / total : 1;
      const avgLatency = total > 0 ? node.metrics.totalLatencyMs / total : 0;
      const freshness = (Date.now() - node.lastPingAt) / 1000; // seconds since last ping

      const score = successRate * PHI - (avgLatency / 10000) - (freshness / 100) * PSI;
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }

    return best;
  }

  /** Get platform configuration */
  getPlatformConfig(type) {
    return PLATFORMS[type] || null;
  }

  /** Health overview */
  health() {
    const nodes = [...this._nodes.values()];
    return {
      totalNodes: nodes.length,
      byState: {
        provisioning: nodes.filter(n => n.state === NODE_STATE.PROVISIONING).length,
        ready: nodes.filter(n => n.state === NODE_STATE.READY).length,
        busy: nodes.filter(n => n.state === NODE_STATE.BUSY).length,
        error: nodes.filter(n => n.state === NODE_STATE.ERROR).length,
        terminated: nodes.filter(n => n.state === NODE_STATE.TERMINATED).length,
      },
      byPlatform: Object.fromEntries(this._platformStats),
      platforms: Object.keys(PLATFORMS).length,
    };
  }

  /** Terminate all nodes */
  terminateAll() {
    for (const [nodeId, node] of this._nodes) {
      if (node.state !== NODE_STATE.TERMINATED) {
        this.setNodeState(nodeId, NODE_STATE.TERMINATED);
      }
    }
  }
}

module.exports = { LiquidNodeRegistry, NODE_TYPE, NODE_STATE, PLATFORMS };
