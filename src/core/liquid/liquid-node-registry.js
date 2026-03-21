/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  PROPRIETARY AND CONFIDENTIAL — HEADYSYSTEMS INC.                   ║
 * ║  Copyright © 2026 HeadySystems Inc. All Rights Reserved.            ║
 * ║  Protected under the Defend Trade Secrets Act (18 U.S.C. § 1836)   ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * Liquid Node Registry — Lazy Materialization, Zero Boot
 * ═══════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE: The system NEVER fully boots. Every node lives in LATENT
 * state and materializes on-demand when first accessed. When idle beyond
 * the φ-scaled TTL, nodes return to LATENT (pruned from memory).
 *
 * Lifecycle: LATENT → MATERIALIZING → PROJECTED → STALE → PRUNED → LATENT
 *
 * This registry is a thin index — it knows WHERE every service lives and
 * HOW to instantiate it, but never eagerly loads anything.
 *
 * @module liquid-node-registry
 */

'use strict';

const { liquidify, aggregateHealth, getRegistry, LIFECYCLE } = require('./liquid-node-contract');

const PHI = 1.618033988749895;

let logger;
try { logger = require('../../utils/logger'); } catch (_) {
    logger = { info: console.log, warn: console.warn, error: console.error, debug: () => {} };
}

// ─── φ-Scaled Idle TTL ──────────────────────────────────────────────────────
// After this many ms of no access, a PROJECTED node returns to LATENT.
// 5 min × φ = ~8.09 min default idle threshold
const IDLE_TTL_MS = Math.round(300_000 * PHI); // ~485,410ms ≈ 8.09 min

// ─── Service Manifest ───────────────────────────────────────────────────────
// Declarative index of every liquid node. Nothing is loaded until accessed.
// Each entry: { id, module (relative require path), factory?, className?,
//               infra[], endpoints[], events: { emits[], reacts[] } }

const SERVICE_MANIFEST = [
    // ═══ Core Engines ════════════════════════════════════════════════════
    {
        id: 'heady-battle',
        module: '../../services/HeadyBattle-service',
        factory: 'getHeadyBattleService',
        infra: ['cloudflare', 'gcloud', 'neon', 'sentry', 'colab'],
        endpoints: ['/api/battle/run', '/api/battle/results', '/api/battle/leaderboard'],
        events: { emits: ['battle:started', 'battle:completed', 'battle:scored'], reacts: ['task:new', 'pipeline:routed'] },
    },
    {
        id: 'heady-sims',
        module: '../../services/HeadySims-service',
        factory: 'getHeadySimsService',
        infra: ['cloudflare', 'gcloud', 'upstash', 'colab', 'sentry'],
        endpoints: ['/api/sims/run', '/api/sims/optimize', '/api/sims/status'],
        events: { emits: ['sim:completed', 'sim:optimized'], reacts: ['task:new', 'pipeline:routed'] },
    },
    {
        id: 'heady-mc',
        module: '../../services/monte-carlo-service',
        factory: 'getHeadySimsService',
        infra: ['cloudflare', 'neon', 'colab', 'sentry'],
        endpoints: ['/api/mc/simulate', '/api/mc/risk', '/api/mc/status'],
        events: { emits: ['mc:simulated', 'mc:risk-scored'], reacts: ['battle:completed', 'pipeline:routed'] },
    },
    {
        id: 'auto-success',
        module: '../../orchestration/hc_auto_success',
        className: 'AutoSuccessEngine',
        infra: ['upstash', 'neon', 'sentry', 'github-actions'],
        endpoints: ['/api/auto-success/status', '/api/auto-success/tasks', '/api/auto-success/react'],
        events: { emits: ['success:task-completed', 'success:cycle', 'success:react'], reacts: ['state:changed', 'deploy:completed', 'health:degraded', 'pipeline:completed'] },
    },
    {
        id: 'auto-context',
        module: '../../services/heady-auto-context',
        factory: 'getAutoContext',
        factoryArgs: { workspaceRoot: process.env.HEADY_WORKSPACE || '/home/headyme/Heady' },
        infra: ['github', 'neon', 'cloudflare'],
        endpoints: ['/api/context/small', '/api/context/medium', '/api/context/large'],
        events: { emits: ['context:enriched', 'context:indexed'], reacts: ['file:changed', 'deploy:completed'] },
    },

    // ═══ Orchestration ═══════════════════════════════════════════════════
    {
        id: 'continuous-conductor',
        module: '../../orchestration/continuous-conductor',
        infra: ['upstash', 'sentry'],
        endpoints: ['/api/conductor/status', '/api/conductor/route'],
        events: { emits: ['conductor:routed', 'conductor:scaled'], reacts: ['task:new', 'health:degraded'] },
    },
    {
        id: '17-swarm',
        module: '../../orchestration/seventeen-swarm-orchestrator',
        infra: ['upstash', 'neon', 'sentry'],
        endpoints: ['/api/swarm/topology', '/api/swarm/health'],
        events: { emits: ['swarm:spawned', 'swarm:dissolved'], reacts: ['conductor:routed'] },
    },
    {
        id: 'hcfp-event-bridge',
        module: '../../orchestration/hcfp-event-bridge',
        infra: ['upstash', 'sentry'],
        endpoints: ['/api/pipeline/events'],
        events: { emits: ['pipeline:event'], reacts: ['pipeline:started', 'pipeline:completed'] },
    },
    {
        id: 'heady-council',
        module: '../../orchestration/heady-council',
        infra: ['gcloud', 'neon', 'sentry'],
        endpoints: ['/api/council/deliberate'],
        events: { emits: ['council:verdict'], reacts: ['battle:completed'] },
    },
    {
        id: 'build-learning-engine',
        module: '../../orchestration/build-learning-engine',
        infra: ['neon', 'sentry'],
        endpoints: ['/api/learning/patterns'],
        events: { emits: ['learning:pattern-saved'], reacts: ['pipeline:completed', 'success:task-completed'] },
    },
    {
        id: 'auto-commit-deploy',
        module: '../../orchestration/auto-commit-deploy',
        infra: ['github', 'gcloud', 'cloudflare'],
        endpoints: ['/api/deploy/auto'],
        events: { emits: ['deploy:started', 'deploy:completed'], reacts: ['pipeline:completed'] },
    },
    {
        id: 'skill-router',
        module: '../../orchestration/skill-router',
        infra: ['sentry'],
        endpoints: ['/api/skills/route'],
        events: { emits: ['skill:routed'], reacts: ['task:new'] },
    },

    // ═══ Intelligence ════════════════════════════════════════════════════
    {
        id: 'autocontext-swarm-bridge',
        module: '../../services/autocontext-swarm-bridge',
        infra: ['neon'],
        endpoints: [],
        events: { emits: ['bridge:enriched'], reacts: ['context:enriched', 'swarm:spawned'] },
    },
    {
        id: 'inference-gateway',
        module: '../../services/inference-gateway',
        infra: ['cloudflare', 'gcloud', 'sentry', 'upstash'],
        endpoints: ['/api/gateway/complete', '/api/gateway/battle', '/api/gateway/race'],
        events: { emits: ['gateway:completed', 'gateway:error'], reacts: ['context:enriched'] },
    },
    {
        id: 'vector-memory',
        module: '../../services/vector-memory',
        infra: ['neon'],
        endpoints: ['/api/vectors/search', '/api/vectors/store'],
        events: { emits: ['vector:stored', 'vector:searched'], reacts: [] },
    },
    {
        id: 'deep-research',
        module: '../../services/deep-research',
        infra: ['gcloud', 'neon', 'colab'],
        endpoints: ['/api/research/run'],
        events: { emits: ['research:completed'], reacts: ['task:new'] },
    },
    {
        id: 'competitive-intelligence',
        module: '../../services/competitive-intelligence-engine',
        infra: ['neon', 'sentry'],
        endpoints: ['/api/intel/scan'],
        events: { emits: ['intel:report'], reacts: ['mc:risk-scored'] },
    },
    {
        id: 'continuous-learning',
        module: '../../services/continuous-learning',
        infra: ['neon', 'colab'],
        endpoints: ['/api/learning/status'],
        events: { emits: ['learning:cycle'], reacts: [] },
    },

    // ═══ Infrastructure ══════════════════════════════════════════════════
    {
        id: 'upstash-redis',
        module: '../../services/upstash-redis',
        infra: ['upstash'],
        endpoints: ['/api/redis/health'],
        events: { emits: ['redis:connected'], reacts: [] },
    },
    {
        id: 'upstash-qstash',
        module: '../../services/upstash-qstash',
        infra: ['upstash'],
        endpoints: ['/api/qstash/health'],
        events: { emits: ['qstash:delivered'], reacts: [] },
    },
    {
        id: 'neon-db',
        module: '../../services/neon-db',
        infra: ['neon'],
        endpoints: ['/api/neon/health'],
        events: { emits: ['db:connected'], reacts: [] },
    },
    {
        id: 'sentry',
        module: '../../services/sentry',
        infra: ['sentry'],
        endpoints: [],
        events: { emits: ['sentry:error-captured'], reacts: ['error:thrown'] },
    },

    // ═══ Projection & Deployment ═════════════════════════════════════════
    {
        id: 'projection-engine',
        module: '../../services/projection-engine',
        infra: ['cloudflare', 'gcloud', 'github'],
        endpoints: ['/api/projection/status', '/api/projection/sync'],
        events: { emits: ['projection:synced', 'projection:stale'], reacts: ['deploy:completed'] },
    },
    {
        id: 'liquid-deploy',
        module: '../../services/liquid-deploy',
        infra: ['cloudflare', 'gcloud', 'github-actions'],
        endpoints: ['/api/deploy/status', '/api/deploy/trigger'],
        events: { emits: ['deploy:started', 'deploy:completed', 'deploy:failed'], reacts: ['pipeline:completed'] },
    },
    {
        id: 'liquid-state-manager',
        module: '../../services/liquid-state-manager',
        infra: [],
        endpoints: ['/api/lifecycle/status'],
        events: { emits: ['lifecycle:transition'], reacts: ['liquid:projected', 'liquid:pruned'] },
    },

    // ═══ Auth & Security ═════════════════════════════════════════════════
    {
        id: 'auth-manager',
        module: '../../services/auth-manager',
        infra: ['cloudflare', 'sentry'],
        endpoints: ['/api/auth/status'],
        events: { emits: ['auth:success', 'auth:failure'], reacts: ['security:alert'] },
    },
    {
        id: 'secure-key-vault',
        module: '../../services/secure-key-vault',
        infra: ['gcloud', 'sentry'],
        endpoints: ['/api/vault/health'],
        events: { emits: ['vault:rotated'], reacts: [] },
    },
    {
        id: 'hf-token-rotation',
        module: '../../services/hf-token-rotation',
        infra: ['gcloud'],
        endpoints: ['/api/hf/tokens'],
        events: { emits: ['token:rotated'], reacts: [] },
    },
    {
        id: 'phi-governance',
        module: '../../governance/phi-governance-engine',
        factory: 'getPhiGovernance',
        infra: ['cloudflare', 'sentry', 'upstash', 'neon'],
        endpoints: ['/api/governance/health', '/api/governance/scan', '/api/governance/quarantine', '/api/governance/receipts', '/api/governance/trace'],
        events: { emits: ['scan:complete', 'quarantine:added'], reacts: ['gateway:request', 'auth:failure', 'security:alert'] },
    },

    // ═══ Digital Presence ════════════════════════════════════════════════
    {
        id: 'digital-presence',
        module: '../../services/digital-presence-orchestrator',
        infra: ['cloudflare', 'gcloud', 'drupal'],
        endpoints: ['/api/presence/status'],
        events: { emits: ['presence:updated'], reacts: ['deploy:completed'] },
    },
    {
        id: 'domain-router',
        module: '../../services/domain-router',
        infra: ['cloudflare'],
        endpoints: ['/api/domains/routes'],
        events: { emits: ['route:updated'], reacts: [] },
    },

    // ═══ Bees ════════════════════════════════════════════════════════════
    {
        id: 'context-sync-bee',
        module: '../../bees/context-sync-bee',
        infra: ['github'],
        endpoints: [],
        events: { emits: ['sync:pushed'], reacts: ['deploy:completed', 'pipeline:completed'] },
    },
    {
        id: 'trading-bee',
        module: '../../bees/trading-bee',
        infra: ['upstash', 'neon', 'sentry'],
        endpoints: ['/api/trading/status'],
        events: { emits: ['trade:signal', 'trade:executed'], reacts: ['mc:risk-scored'] },
    },
    {
        id: 'deployment-bee',
        module: '../../bees/deployment-bee',
        infra: ['gcloud', 'cloudflare', 'github-actions'],
        endpoints: [],
        events: { emits: ['deploy:bee-completed'], reacts: ['deploy:started'] },
    },
    {
        id: 'security-bee',
        module: '../../bees/security-bee',
        infra: ['sentry'],
        endpoints: [],
        events: { emits: ['security:scanned'], reacts: ['security:alert'] },
    },
    {
        id: 'telemetry-bee',
        module: '../../bees/telemetry-bee',
        infra: ['sentry', 'upstash'],
        endpoints: [],
        events: { emits: ['telemetry:collected'], reacts: [] },
    },

    // ═══ Colab GPU Runtimes ══════════════════════════════════════════════
    {
        id: 'colab-node1-overmind',
        module: null,  // Python — accessed via API
        infra: ['colab', 'gcloud'],
        endpoints: ['/api/colab/node1/health'],
        events: { emits: ['colab:embedding-complete'], reacts: ['vector:store-request'] },
    },
    {
        id: 'colab-node2-forge',
        module: null,
        infra: ['colab', 'gcloud'],
        endpoints: ['/api/colab/node2/health'],
        events: { emits: ['colab:model-trained'], reacts: ['battle:run-request'] },
    },
    {
        id: 'colab-node3-edge',
        module: null,
        infra: ['colab', 'gcloud'],
        endpoints: ['/api/colab/node3/health'],
        events: { emits: ['colab:inference-complete'], reacts: ['sim:run-request'] },
    },
    {
        id: 'colab-node4-learning',
        module: null,
        infra: ['colab', 'gcloud'],
        endpoints: ['/api/colab/node4/health'],
        events: { emits: ['colab:learning-cycle'], reacts: ['mc:simulate-request'] },
    },

    // ═══ Standalone Services ═════════════════════════════════════════════
    {
        id: 'heady-health',
        module: null,
        infra: ['sentry'],
        endpoints: ['/api/health/aggregate', '/api/health/circuit-breakers'],
        events: { emits: ['health:check', 'health:degraded', 'health:recovered'], reacts: [] },
    },
    {
        id: 'discord-bot',
        module: null,
        infra: ['gcloud'],
        endpoints: [],
        events: { emits: ['discord:message'], reacts: ['battle:completed'] },
    },
    {
        id: 'drupal-cms',
        module: null,
        infra: ['drupal', 'gcloud', 'cloudflare'],
        endpoints: ['/api/drupal/content', '/api/drupal/health'],
        events: { emits: ['content:published'], reacts: ['presence:updated'] },
    },
    {
        id: 'heady-mcp-server',
        module: null,  // standalone service
        infra: ['gcloud'],
        endpoints: ['/api/mcp/tools'],
        events: { emits: ['mcp:tool-called'], reacts: [] },
    },
];

// ─── Lazy Materialization Cache ─────────────────────────────────────────────
// Nodes are NOT loaded at require time. They materialize on first access.
const _lazyCache = new Map(); // id → { instance, lastAccess }

/**
 * Get a service node by ID — materializes on first access.
 * Subsequent calls return the cached instance until idle TTL expires.
 *
 * @param {string} id - Node ID from SERVICE_MANIFEST
 * @param {Object} [config] - Optional config to pass on materialization
 * @returns {Object|null} The liquidified service node, or null if not found
 */
function materialize(id, config = {}) {
    // Already materialized?
    if (_lazyCache.has(id)) {
        const cached = _lazyCache.get(id);
        cached.lastAccess = Date.now();
        return cached.instance;
    }

    // Find manifest entry
    const entry = SERVICE_MANIFEST.find(e => e.id === id);
    if (!entry) {
        logger.debug(`[liquid-registry] Unknown node ID: ${id}`);
        return null;
    }

    // No module? This is an external service (Colab, standalone, etc.)
    // Register as a thin placeholder
    if (!entry.module) {
        const placeholder = liquidify({}, {
            id: entry.id,
            infra: entry.infra,
            endpoints: entry.endpoints,
            events: entry.events,
        });
        _lazyCache.set(id, { instance: placeholder, lastAccess: Date.now() });
        logger.debug(`[liquid-registry] Materialized external node: ${id}`);
        return placeholder;
    }

    // Lazy load the actual module
    try {
        const mod = require(entry.module);
        let instance;

        if (entry.factory && mod[entry.factory]) {
            instance = mod[entry.factory]({ ...entry.factoryArgs, ...config });
        } else if (entry.className && mod[entry.className]) {
            instance = new mod[entry.className](config);
        } else if (typeof mod === 'function') {
            instance = new mod(config);
        } else {
            instance = mod;
        }

        liquidify(instance, {
            id: entry.id,
            infra: entry.infra,
            endpoints: entry.endpoints,
            events: entry.events,
        });

        _lazyCache.set(id, { instance, lastAccess: Date.now() });
        logger.info(`[liquid-registry] Materialized: ${id}`);
        return instance;
    } catch (e) {
        logger.warn(`[liquid-registry] Failed to materialize ${id}: ${e.message}`);
        return null;
    }
}

/**
 * Prune idle nodes — returns them to LATENT state.
 * Called on a φ-scaled interval, NOT eagerly.
 *
 * @returns {{ pruned: string[], active: string[] }}
 */
function pruneIdle() {
    const now = Date.now();
    const pruned = [];
    const active = [];

    for (const [id, cached] of _lazyCache) {
        if (now - cached.lastAccess > IDLE_TTL_MS) {
            // Return to LATENT
            try { cached.instance.stop?.(); } catch (_) { /* best effort */  }
            if (cached.instance.__liquid) cached.instance.__liquid.lifecycle = LIFECYCLE.LATENT;
            _lazyCache.delete(id);
            getRegistry().delete(id);
            pruned.push(id);
        } else {
            active.push(id);
        }
    }

    if (pruned.length > 0) {
        logger.info(`[liquid-registry] Pruned ${pruned.length} idle nodes: ${pruned.join(', ')}`);
    }
    return { pruned, active };
}

// ─── φ-Scaled Idle Pruner ───────────────────────────────────────────────────
// Runs every idle TTL to return unused nodes to LATENT state.
let _pruneInterval = null;

function startIdlePruner() {
    if (_pruneInterval) return;
    _pruneInterval = setInterval(pruneIdle, IDLE_TTL_MS);
    if (_pruneInterval.unref) _pruneInterval.unref(); // don't keep process alive
}

function stopIdlePruner() {
    if (_pruneInterval) {
        clearInterval(_pruneInterval);
        _pruneInterval = null;
    }
}

// ─── Manifest & Health ──────────────────────────────────────────────────────

/**
 * Get the full manifest (all known nodes — both materialized and latent).
 * @returns {Object[]}
 */
function getFullManifest() {
    return SERVICE_MANIFEST.map(entry => {
        const cached = _lazyCache.get(entry.id);
        const lifecycle = cached?.instance?.__liquid?.lifecycle || LIFECYCLE.LATENT;
        return {
            id: entry.id,
            lifecycle,
            materialized: _lazyCache.has(entry.id),
            infra: entry.infra,
            endpoints: entry.endpoints,
            events: entry.events,
            lastAccess: cached?.lastAccess || null,
        };
    });
}

/**
 * Get health from only MATERIALIZED nodes (not latent ones).
 * @returns {Object}
 */
function getMaterializedHealth() {
    const nodes = [];
    for (const [id, cached] of _lazyCache) {
        try {
            nodes.push(cached.instance.health?.() || { id, status: 'no-health' });
        } catch (e) {
            nodes.push({ id, status: 'error', error: e.message });
        }
    }
    return {
        materialized: nodes.length,
        latent: SERVICE_MANIFEST.length - nodes.length,
        total: SERVICE_MANIFEST.length,
        nodes,
        timestamp: new Date().toISOString(),
    };
}

// ─── Express Routes ─────────────────────────────────────────────────────────

/**
 * Wire liquid node routes into an Express app.
 * @param {Object} app - Express app
 */
function wireHealthRoutes(app) {
    if (!app || !app.get) return;

    // Health — only materialized nodes
    app.get('/api/health', (req, res) => {
        res.json(getMaterializedHealth());
    });

    // Individual node health — materializes on access
    app.get('/api/health/:nodeId', (req, res) => {
        const node = materialize(req.params.nodeId);
        if (!node) return res.status(404).json({ error: 'Unknown node' });
        try {
            res.json(node.health());
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Full manifest — shows latent + materialized
    app.get('/api/manifest', (req, res) => {
        res.json({
            name: 'Heady™ Liquid Latent OS',
            version: '4.1.0',
            architecture: 'lazy-materialization',
            idleTtlMs: IDLE_TTL_MS,
            nodes: getFullManifest(),
            timestamp: new Date().toISOString(),
        });
    });

    // On-demand materialization endpoint
    app.post('/api/nodes/:nodeId/materialize', (req, res) => {
        const node = materialize(req.params.nodeId, req.body);
        if (!node) return res.status(404).json({ error: 'Unknown node' });
        res.json({ id: req.params.nodeId, lifecycle: node.__liquid?.lifecycle, materialized: true });
    });

    // Prune idle nodes
    app.post('/api/nodes/prune', (req, res) => {
        res.json(pruneIdle());
    });
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    SERVICE_MANIFEST,
    materialize,
    pruneIdle,
    getFullManifest,
    getMaterializedHealth,
    wireHealthRoutes,
    startIdlePruner,
    stopIdlePruner,
    IDLE_TTL_MS,
};
