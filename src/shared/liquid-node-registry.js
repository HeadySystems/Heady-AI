/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  PROPRIETARY AND CONFIDENTIAL — HEADYSYSTEMS INC.                   ║
 * ║  Copyright © 2026 HeadySystems Inc. All Rights Reserved.            ║
 * ║  Protected under the Defend Trade Secrets Act (18 U.S.C. § 1836)   ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * Liquid Node Registry — Auto-Discovery & Boot Orchestrator
 * ═══════════════════════════════════════════════════════════════════
 *
 * Discovers, liquidifies, and manages ALL service nodes at boot time.
 * NOT a god class — delegates lifecycle to each node's own start/stop.
 * This is the registry + health aggregator, nothing more.
 *
 * @module liquid-node-registry
 */

'use strict';

const path = require('path');
const { liquidify, aggregateHealth, getRegistry, INFRA_PROVIDERS } = require('../shared/liquid-node-contract');

let logger;
try { logger = require('../utils/logger'); } catch (_) {
    logger = { info: console.log, warn: console.warn, error: console.error, debug: () => {} };
}

// ─── Service Manifest ───────────────────────────────────────────────────────
// Every service that should be a liquid node. Organized by domain.
// Each entry: { id, module, factory, infra, endpoints, events }

const SERVICE_MANIFEST = [
    // ═══ Core Engines ════════════════════════════════════════════════════
    {
        id: 'heady-battle',
        module: '../services/HeadyBattle-service',
        factory: 'getHeadyBattleService',
        infra: ['cloudflare', 'gcloud', 'neon', 'sentry', 'colab'],
        endpoints: ['/api/battle/run', '/api/battle/results', '/api/battle/leaderboard'],
        events: { emits: ['battle:started', 'battle:completed', 'battle:scored'], reacts: ['task:new', 'pipeline:routed'] },
    },
    {
        id: 'heady-sims',
        module: '../services/HeadySims-service',
        factory: 'getHeadySimsService',
        infra: ['cloudflare', 'gcloud', 'upstash', 'colab', 'sentry'],
        endpoints: ['/api/sims/run', '/api/sims/optimize', '/api/sims/status'],
        events: { emits: ['sim:completed', 'sim:optimized'], reacts: ['task:new', 'pipeline:routed'] },
    },
    {
        id: 'heady-mc',
        module: '../services/monte-carlo-service',
        factory: 'getHeadySimsService',  // MC reuses HeadySims pattern
        infra: ['cloudflare', 'neon', 'colab', 'sentry'],
        endpoints: ['/api/mc/simulate', '/api/mc/risk', '/api/mc/status'],
        events: { emits: ['mc:simulated', 'mc:risk-scored'], reacts: ['battle:completed', 'pipeline:routed'] },
    },
    {
        id: 'auto-success',
        module: '../orchestration/hc_auto_success',
        factory: null,  // class export, not factory
        className: 'AutoSuccessEngine',
        infra: ['upstash', 'neon', 'sentry', 'github-actions'],
        endpoints: ['/api/auto-success/status', '/api/auto-success/tasks', '/api/auto-success/react'],
        events: { emits: ['success:task-completed', 'success:cycle', 'success:react'], reacts: Object.keys(require('../orchestration/hc_auto_success').REACTION_TRIGGERS || {}).slice(0, 8) },
    },
    {
        id: 'auto-context',
        module: '../services/heady-auto-context',
        factory: 'getAutoContext',
        factoryArgs: { workspaceRoot: process.env.HEADY_WORKSPACE || '/home/headyme/Heady' },
        infra: ['github', 'neon', 'cloudflare'],
        endpoints: ['/api/context/small', '/api/context/medium', '/api/context/large'],
        events: { emits: ['context:enriched', 'context:indexed'], reacts: ['file:changed', 'deploy:completed'] },
    },

    // ═══ Orchestration ═══════════════════════════════════════════════════
    {
        id: 'continuous-conductor',
        module: '../orchestration/continuous-conductor',
        infra: ['upstash', 'sentry'],
        endpoints: ['/api/conductor/status', '/api/conductor/route'],
        events: { emits: ['conductor:routed', 'conductor:scaled'], reacts: ['task:new', 'health:degraded'] },
    },
    {
        id: '17-swarm',
        module: '../orchestration/seventeen-swarm-orchestrator',
        infra: ['upstash', 'neon', 'sentry'],
        endpoints: ['/api/swarm/topology', '/api/swarm/health'],
        events: { emits: ['swarm:spawned', 'swarm:dissolved'], reacts: ['conductor:routed'] },
    },
    {
        id: 'hcfp-event-bridge',
        module: '../orchestration/hcfp-event-bridge',
        infra: ['upstash', 'sentry'],
        endpoints: ['/api/pipeline/events'],
        events: { emits: ['pipeline:event'], reacts: ['pipeline:started', 'pipeline:completed'] },
    },

    // ═══ Intelligence ════════════════════════════════════════════════════
    {
        id: 'autocontext-swarm-bridge',
        module: '../services/autocontext-swarm-bridge',
        infra: ['neon'],
        endpoints: [],
        events: { emits: ['bridge:enriched'], reacts: ['context:enriched', 'swarm:spawned'] },
    },
    {
        id: 'inference-gateway',
        module: '../services/inference-gateway',
        infra: ['cloudflare', 'gcloud', 'sentry', 'upstash'],
        endpoints: ['/api/gateway/complete', '/api/gateway/battle', '/api/gateway/race'],
        events: { emits: ['gateway:completed', 'gateway:error'], reacts: ['context:enriched'] },
    },

    // ═══ Infrastructure ══════════════════════════════════════════════════
    {
        id: 'upstash-redis',
        module: '../services/upstash-redis',
        infra: ['upstash'],
        endpoints: ['/api/redis/health'],
        events: { emits: ['redis:connected'], reacts: [] },
    },
    {
        id: 'upstash-qstash',
        module: '../services/upstash-qstash',
        infra: ['upstash'],
        endpoints: ['/api/qstash/health'],
        events: { emits: ['qstash:delivered'], reacts: [] },
    },
    {
        id: 'neon-db',
        module: '../services/neon-db',
        infra: ['neon'],
        endpoints: ['/api/neon/health'],
        events: { emits: ['db:connected'], reacts: [] },
    },
    {
        id: 'sentry',
        module: '../services/sentry',
        infra: ['sentry'],
        endpoints: [],
        events: { emits: ['sentry:error-captured'], reacts: ['error:thrown'] },
    },
    {
        id: 'vector-memory',
        module: '../services/vector-memory',
        infra: ['neon'],
        endpoints: ['/api/vectors/search', '/api/vectors/store'],
        events: { emits: ['vector:stored', 'vector:searched'], reacts: [] },
    },

    // ═══ Projection & Deployment ═════════════════════════════════════════
    {
        id: 'projection-engine',
        module: '../services/projection-engine',
        infra: ['cloudflare', 'gcloud', 'github'],
        endpoints: ['/api/projection/status', '/api/projection/sync'],
        events: { emits: ['projection:synced', 'projection:stale'], reacts: ['deploy:completed'] },
    },
    {
        id: 'liquid-deploy',
        module: '../services/liquid-deploy',
        infra: ['cloudflare', 'gcloud', 'github-actions'],
        endpoints: ['/api/deploy/status', '/api/deploy/trigger'],
        events: { emits: ['deploy:started', 'deploy:completed', 'deploy:failed'], reacts: ['pipeline:completed'] },
    },
    {
        id: 'liquid-state-manager',
        module: '../services/liquid-state-manager',
        infra: [],
        endpoints: ['/api/lifecycle/status'],
        events: { emits: ['lifecycle:transition'], reacts: ['liquid:projected', 'liquid:pruned'] },
    },

    // ═══ Auth & Security ═════════════════════════════════════════════════
    {
        id: 'auth-manager',
        module: '../services/auth-manager',
        infra: ['cloudflare', 'sentry'],
        endpoints: ['/api/auth/status'],
        events: { emits: ['auth:success', 'auth:failure'], reacts: ['security:alert'] },
    },
    {
        id: 'secure-key-vault',
        module: '../services/secure-key-vault',
        infra: ['gcloud', 'sentry'],
        endpoints: ['/api/vault/health'],
        events: { emits: ['vault:rotated'], reacts: [] },
    },

    // ═══ Cognitive & Learning ════════════════════════════════════════════
    {
        id: 'build-learning-engine',
        module: '../orchestration/build-learning-engine',
        infra: ['neon', 'sentry'],
        endpoints: ['/api/learning/patterns'],
        events: { emits: ['learning:pattern-saved'], reacts: ['pipeline:completed', 'success:task-completed'] },
    },
    {
        id: 'continuous-learning',
        module: '../services/continuous-learning',
        infra: ['neon', 'colab'],
        endpoints: ['/api/learning/status'],
        events: { emits: ['learning:cycle'], reacts: [] },
    },

    // ═══ Bees ════════════════════════════════════════════════════════════
    {
        id: 'context-sync-bee',
        module: '../bees/context-sync-bee',
        infra: ['github'],
        endpoints: [],
        events: { emits: ['sync:pushed'], reacts: ['deploy:completed', 'pipeline:completed'] },
    },
    {
        id: 'trading-bee',
        module: '../bees/trading-bee',
        infra: ['upstash', 'neon', 'sentry'],
        endpoints: ['/api/trading/status'],
        events: { emits: ['trade:signal', 'trade:executed'], reacts: ['mc:risk-scored'] },
    },

    // ═══ Standalone Services ═════════════════════════════════════════════
    {
        id: 'heady-health',
        module: null,  // standalone at services/heady-health/
        infra: ['sentry'],
        endpoints: ['/api/health/aggregate', '/api/health/circuit-breakers'],
        events: { emits: ['health:check', 'health:degraded', 'health:recovered'], reacts: [] },
    },
    {
        id: 'discord-bot',
        module: null,  // standalone at services/discord-bot/
        infra: ['gcloud'],
        endpoints: [],
        events: { emits: ['discord:message'], reacts: ['battle:completed'] },
    },
];

// ─── Boot Orchestrator ──────────────────────────────────────────────────────

/**
 * Discover and liquidify all services from the manifest.
 * Does NOT start them — just registers. Call node.start() individually.
 *
 * @returns {Map<string, Object>} registry of liquidified nodes
 */
function discoverAll() {
    let loaded = 0;
    let skipped = 0;

    for (const entry of SERVICE_MANIFEST) {
        try {
            if (!entry.module) {
                // Standalone service — register as placeholder
                liquidify({}, {
                    id: entry.id,
                    infra: entry.infra,
                    endpoints: entry.endpoints,
                    events: entry.events,
                });
                loaded++;
                continue;
            }

            const mod = require(entry.module);
            let instance;

            if (entry.factory && mod[entry.factory]) {
                instance = mod[entry.factory](entry.factoryArgs || {});
            } else if (entry.className && mod[entry.className]) {
                instance = new mod[entry.className]();
            } else if (typeof mod === 'function') {
                instance = new mod();
            } else {
                // Module is a plain object — liquidify directly
                instance = mod;
            }

            liquidify(instance, {
                id: entry.id,
                infra: entry.infra,
                endpoints: entry.endpoints,
                events: entry.events,
            });

            loaded++;
        } catch (e) {
            logger.debug(`[liquid-registry] Skip ${entry.id}: ${e.message}`);
            skipped++;
        }
    }

    logger.info(`[liquid-registry] Discovered ${loaded} nodes, ${skipped} skipped`);
    return getRegistry();
}

/**
 * Start all registered liquid nodes.
 * @returns {Object} { started: string[], failed: string[] }
 */
async function startAll() {
    const started = [];
    const failed = [];

    for (const [id, node] of getRegistry()) {
        try {
            if (node.start) await node.start();
            started.push(id);
        } catch (e) {
            logger.warn(`[liquid-registry] Failed to start ${id}: ${e.message}`);
            failed.push(id);
        }
    }

    return { started, failed };
}

/**
 * Stop all registered liquid nodes.
 */
async function stopAll() {
    for (const [id, node] of getRegistry()) {
        try { if (node.stop) await node.stop(); } catch (_) { /* best effort */ }
    }
}

/**
 * Get the full manifest for liquid-os-manifest.json updates.
 * @returns {Object[]} Array of node manifests
 */
function getFullManifest() {
    const nodes = [];
    for (const [id, node] of getRegistry()) {
        try {
            nodes.push(node.toManifest?.() || { id, lifecycle: 'unknown' });
        } catch (_) {
            nodes.push({ id, lifecycle: 'error' });
        }
    }
    return nodes;
}

// ─── Express Router (Liquid Health Endpoints) ────────────────────────────────

/**
 * Wire standard liquid node routes into an Express app.
 * @param {Object} app - Express app
 */
function wireHealthRoutes(app) {
    if (!app || !app.get) return;

    // Aggregated health check — all nodes
    app.get('/api/health', (req, res) => {
        res.json(aggregateHealth());
    });

    // Individual node health
    app.get('/api/health/:nodeId', (req, res) => {
        const node = getRegistry().get(req.params.nodeId);
        if (!node) return res.status(404).json({ error: 'Node not found' });
        try {
            res.json(node.health());
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Full manifest
    app.get('/api/manifest', (req, res) => {
        res.json({
            name: 'Heady™ Liquid Latent OS',
            version: '4.1.0',
            nodes: getFullManifest(),
            timestamp: new Date().toISOString(),
        });
    });

    // Node list
    app.get('/api/nodes', (req, res) => {
        const nodes = [];
        for (const [id, node] of getRegistry()) {
            nodes.push({
                id,
                lifecycle: node.__liquid?.lifecycle || 'unknown',
                infra: node.__liquid?.infra || [],
                endpoints: node.__liquid?.endpoints || [],
            });
        }
        res.json({ nodes, total: nodes.length });
    });
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    SERVICE_MANIFEST,
    discoverAll,
    startAll,
    stopAll,
    getFullManifest,
    wireHealthRoutes,
};
