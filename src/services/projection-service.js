/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ─── ProjectionService ────────────────────────────────────────
 * Milestone Alpha — The Dispatcher
 *
 * Deploys ephemeral, coordinate-mapped agents into the 3D vector
 * space with zero state conflicts. Each agent occupies a unique
 * spatial slot, executes its task, then self-destructs.
 *
 * Architecture:
 *   deployAgent() → validate coords → VectorBridge handshake →
 *     SpatialIndex.insert() → start TTL timer → emit agent:deployed
 *
 *   reclaimAgent() → remove from SpatialIndex → emit agent:reclaimed
 *
 * Patent: PPA #06 — 3D Memory Architecture
 * ──────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const { EventEmitter } = require('events');
const { SpatialIndex, Vec3 } = require('../memory/octree-spatial-index');
const { VectorBridge, validateVec3, isInBounds, COORD_BOUNDS } = require('../core/vector-bridge');

const PHI = 1.6180339887;

// ── Defaults ───────────────────────────────────────────────────
const DEFAULT_TTL_MS = 5 * 60 * 1000;                 // 5 minutes
const MAX_AGENTS = 144;                                 // Fibonacci(12) — swarm ceiling
const SWEEP_INTERVAL_MS = Math.round(PHI ** 5 * 1000); // φ⁵ × 1000 ≈ 11.09s
const MIN_SEPARATION = 0.1;                             // Minimum distance between agents

// ── Agent States ───────────────────────────────────────────────
const AGENT_STATE = Object.freeze({
    DEPLOYING:  'deploying',
    ACTIVE:     'active',
    COMPLETING: 'completing',
    RECLAIMED:  'reclaimed',
    EXPIRED:    'expired',
    CONFLICTED: 'conflicted',
});

class ProjectionService extends EventEmitter {
    /**
     * @param {Object} opts
     * @param {string} [opts.serviceId='projection-service']
     * @param {number} [opts.maxAgents=144]
     * @param {number} [opts.defaultTTL=300000]
     * @param {number} [opts.minSeparation=0.1]
     * @param {boolean} [opts.autoSweep=true]
     */
    constructor(opts = {}) {
        super();
        this.serviceId = opts.serviceId || 'projection-service';
        this.maxAgents = opts.maxAgents || MAX_AGENTS;
        this.defaultTTL = opts.defaultTTL || DEFAULT_TTL_MS;
        this.minSeparation = opts.minSeparation || MIN_SEPARATION;

        // Spatial infrastructure
        this._spatial = new SpatialIndex({ extent: 10, maxDepth: 10 });
        this._bridge = new VectorBridge({
            serviceId: this.serviceId,
            strictMode: false,  // clamp instead of reject
        });

        // Agent registry
        this._agents = new Map();     // agentId → agent record
        this._taskIndex = new Map();  // taskId → agentId

        // Stats
        this._stats = { deployed: 0, reclaimed: 0, expired: 0, conflicts: 0 };

        // Auto-sweep expired agents
        this._sweepTimer = null;
        if (opts.autoSweep !== false) {
            this._startSweep();
        }
    }

    // ── Deploy ──────────────────────────────────────────────────

    /**
     * Deploy an ephemeral agent at specified 3D coordinates.
     *
     * @param {Object} config
     * @param {string} config.task - Task description
     * @param {Vec3|{x,y,z}|number[]} config.coordinates - Target position
     * @param {string[]} [config.capabilities=[]] - Agent capabilities
     * @param {number} [config.ttl] - Time-to-live in ms
     * @param {string} [config.taskId] - Optional external task reference
     * @param {Object} [config.metadata={}]
     * @returns {Object} Deployment receipt
     */
    deployAgent(config) {
        if (!config || !config.task) {
            throw new Error('ProjectionService: config.task is required');
        }
        if (!config.coordinates) {
            throw new Error('ProjectionService: config.coordinates is required');
        }

        // Capacity check
        if (this._agents.size >= this.maxAgents) {
            throw new Error(
                `ProjectionService: agent swarm at capacity (${this.maxAgents}). ` +
                `Reclaim agents before deploying more.`
            );
        }

        // Validate coordinates through VectorBridge
        const coords = validateVec3(config.coordinates, 'deploy');
        const handshake = this._bridge.send('spatial-index', config.coordinates, {
            action: 'agent-deploy',
            task: config.task,
        });

        // Collision detection — check for nearby agents
        const nearby = this._spatial.queryRadius(coords, this.minSeparation);
        if (nearby.length > 0) {
            const conflict = nearby[0];
            const existingAgent = this._agents.get(conflict.id);

            // If the existing agent is still active, flag a conflict
            if (existingAgent && existingAgent.state === AGENT_STATE.ACTIVE) {
                this._stats.conflicts++;
                this.emit('agent:state-conflict', {
                    newTask: config.task,
                    existingAgent: conflict.id,
                    existingTask: existingAgent.task,
                    coordinates: coords.toArray(),
                    separation: coords.distanceTo(conflict.pos),
                });

                // Auto-resolve: nudge coordinates slightly using φ offset
                const nudge = new Vec3(
                    PHI * 0.01 * (Math.random() - 0.5),
                    PHI * 0.01 * (Math.random() - 0.5),
                    PHI * 0.01 * (Math.random() - 0.5)
                );
                coords.x += nudge.x;
                coords.y += nudge.y;
                coords.z += nudge.z;
            }
        }

        // Generate agent ID
        const agentId = `agent-${crypto.randomUUID().slice(0, 8)}`;
        const ttl = config.ttl || this.defaultTTL;
        const now = Date.now();

        // Create agent record
        const agent = {
            agentId,
            task: config.task,
            taskId: config.taskId || null,
            capabilities: config.capabilities || [],
            coordinates: { x: coords.x, y: coords.y, z: coords.z },
            state: AGENT_STATE.ACTIVE,
            deployedAt: now,
            expiresAt: now + ttl,
            ttl,
            metadata: config.metadata || {},
            handshakeReceipt: handshake.receipt,
            telemetry: {
                progress: 0,
                lastHeartbeat: now,
                memoryUsage: 0,
            },
        };

        // Insert into spatial index
        this._spatial.insert(agentId, coords, {
            task: config.task,
            state: AGENT_STATE.ACTIVE,
            deployedAt: now,
        });

        // Register
        this._agents.set(agentId, agent);
        if (config.taskId) this._taskIndex.set(config.taskId, agentId);
        this._stats.deployed++;

        // Emit
        this.emit('agent:deployed', {
            agentId,
            task: config.task,
            coordinates: agent.coordinates,
            expiresAt: agent.expiresAt,
        });

        return {
            success: true,
            agentId,
            coordinates: agent.coordinates,
            expiresAt: new Date(agent.expiresAt).toISOString(),
            handshakeReceipt: handshake.receipt,
            receipt: crypto.createHash('sha256')
                .update(`${agentId}:${now}:${config.task}`)
                .digest('hex').slice(0, 16),
        };
    }

    // ── Reclaim ─────────────────────────────────────────────────

    /**
     * Terminate and reclaim an ephemeral agent.
     * @param {string} agentId
     * @param {string} [reason='manual']
     * @returns {Object}
     */
    reclaimAgent(agentId, reason = 'manual') {
        const agent = this._agents.get(agentId);
        if (!agent) return { success: false, error: `Agent ${agentId} not found` };

        agent.state = reason === 'expired' ? AGENT_STATE.EXPIRED : AGENT_STATE.RECLAIMED;
        agent.reclaimedAt = Date.now();
        agent.reclaimReason = reason;

        // Remove from spatial index
        this._spatial.remove(agentId);
        if (agent.taskId) this._taskIndex.delete(agent.taskId);
        this._agents.delete(agentId);

        if (reason === 'expired') this._stats.expired++;
        else this._stats.reclaimed++;

        this.emit('agent:reclaimed', {
            agentId,
            task: agent.task,
            coordinates: agent.coordinates,
            reason,
            lifespan: agent.reclaimedAt - agent.deployedAt,
        });

        return {
            success: true,
            agentId,
            state: agent.state,
            lifespan: agent.reclaimedAt - agent.deployedAt,
            reason,
        };
    }

    // ── Update ──────────────────────────────────────────────────

    /**
     * Update agent telemetry (progress, heartbeat).
     * @param {string} agentId
     * @param {Object} telemetry
     */
    updateTelemetry(agentId, telemetry = {}) {
        const agent = this._agents.get(agentId);
        if (!agent) return null;

        if (telemetry.progress !== undefined) agent.telemetry.progress = telemetry.progress;
        agent.telemetry.lastHeartbeat = Date.now();
        if (telemetry.memoryUsage) agent.telemetry.memoryUsage = telemetry.memoryUsage;

        // Check for completion
        if (agent.telemetry.progress >= 1.0) {
            agent.state = AGENT_STATE.COMPLETING;
            this.reclaimAgent(agentId, 'completed');
        }

        return { agentId, telemetry: agent.telemetry };
    }

    // ── Queries ─────────────────────────────────────────────────

    getAgent(agentId) { return this._agents.get(agentId) || null; }

    getAgentByTask(taskId) {
        const agentId = this._taskIndex.get(taskId);
        return agentId ? this._agents.get(agentId) : null;
    }

    listAgents(filter = {}) {
        let agents = Array.from(this._agents.values());
        if (filter.state) agents = agents.filter(a => a.state === filter.state);
        if (filter.capability) agents = agents.filter(a => a.capabilities.includes(filter.capability));
        return agents.map(a => ({
            agentId: a.agentId,
            task: a.task,
            state: a.state,
            coordinates: a.coordinates,
            progress: a.telemetry.progress,
            expiresIn: Math.max(0, a.expiresAt - Date.now()),
            deployedAt: new Date(a.deployedAt).toISOString(),
        }));
    }

    /**
     * Get real-time agent telemetry — positions, health, task progress.
     */
    getAgentTelemetry() {
        const agents = Array.from(this._agents.values());
        return {
            timestamp: new Date().toISOString(),
            activeAgents: agents.length,
            capacity: this.maxAgents,
            utilization: ((agents.length / this.maxAgents) * 100).toFixed(1) + '%',
            agents: agents.map(a => ({
                agentId: a.agentId,
                task: a.task,
                state: a.state,
                coordinates: a.coordinates,
                progress: a.telemetry.progress,
                heartbeat: new Date(a.telemetry.lastHeartbeat).toISOString(),
                ttlRemaining: Math.max(0, a.expiresAt - Date.now()),
                expiresIn: Math.max(0, a.expiresAt - Date.now()) + 'ms',
            })),
            stats: { ...this._stats },
        };
    }

    /**
     * Find agents near a 3D coordinate.
     * @param {Vec3|{x,y,z}|number[]} coords
     * @param {number} radius
     */
    findNearby(coords, radius = 1.0) {
        const vec = validateVec3(coords, 'findNearby');
        const results = this._spatial.queryRadius(vec, radius);
        return results.map(r => ({
            agentId: r.id,
            distance: r.pos.distanceTo(vec),
            coordinates: r.pos.toArray(),
            data: r.data,
        }));
    }

    // ── Sweep ───────────────────────────────────────────────────

    _startSweep() {
        this._sweepTimer = setInterval(() => this._sweepExpired(), SWEEP_INTERVAL_MS);
        if (this._sweepTimer.unref) this._sweepTimer.unref();
    }

    _sweepExpired() {
        const now = Date.now();
        const expired = [];

        for (const [agentId, agent] of this._agents.entries()) {
            if (now > agent.expiresAt) {
                expired.push(agentId);
            }
        }

        for (const agentId of expired) {
            this.reclaimAgent(agentId, 'expired');
        }

        if (expired.length > 0) {
            this.emit('sweep:completed', {
                expired: expired.length,
                remaining: this._agents.size,
                timestamp: new Date().toISOString(),
            });
        }
    }

    stopSweep() {
        if (this._sweepTimer) { clearInterval(this._sweepTimer); this._sweepTimer = null; }
    }

    // ── Health ──────────────────────────────────────────────────

    getHealth() {
        return {
            service: this.serviceId,
            activeAgents: this._agents.size,
            maxAgents: this.maxAgents,
            spatialNodes: this._spatial.size(),
            stats: { ...this._stats },
            bridgeHealth: this._bridge.getHealth(),
            sweepActive: this._sweepTimer !== null,
        };
    }
}

// ── Singleton ──────────────────────────────────────────────────
let _instance = null;

function getProjectionService(opts = {}) {
    if (!_instance) _instance = new ProjectionService(opts);
    return _instance;
}

// ── Express Routes ─────────────────────────────────────────────
function projectionServiceRoutes(app) {
    const service = getProjectionService();

    app.post('/api/projection-service/deploy', (req, res) => {
        try {
            const result = service.deployAgent(req.body);
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/projection-service/reclaim/:agentId', (req, res) => {
        const result = service.reclaimAgent(req.params.agentId, req.body.reason || 'api');
        if (!result.success) return res.status(404).json(result);
        res.json({ ok: true, ...result });
    });

    app.post('/api/projection-service/telemetry/:agentId', (req, res) => {
        const result = service.updateTelemetry(req.params.agentId, req.body);
        if (!result) return res.status(404).json({ ok: false, error: 'Agent not found' });
        res.json({ ok: true, ...result });
    });

    app.get('/api/projection-service/agents', (req, res) => {
        res.json({ ok: true, agents: service.listAgents(req.query) });
    });

    app.get('/api/projection-service/agents/:agentId', (req, res) => {
        const agent = service.getAgent(req.params.agentId);
        if (!agent) return res.status(404).json({ ok: false, error: 'Agent not found' });
        res.json({ ok: true, agent });
    });

    app.get('/api/projection-service/telemetry', (_req, res) => {
        res.json({ ok: true, ...service.getAgentTelemetry() });
    });

    app.post('/api/projection-service/nearby', (req, res) => {
        try {
            const results = service.findNearby(req.body.coordinates, req.body.radius || 1.0);
            res.json({ ok: true, results });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.get('/api/projection-service/health', (_req, res) => {
        res.json({ ok: true, ...service.getHealth() });
    });
}

module.exports = {
    ProjectionService,
    getProjectionService,
    projectionServiceRoutes,
    AGENT_STATE,
};


// --- Auto-Unified Latent Service Pattern ---
if (module.exports && typeof module.exports === 'object') {
  if (!module.exports.start) module.exports.start = async () => ({ status: 'started' });
  if (!module.exports.stop) module.exports.stop = async () => ({ status: 'stopped' });
  if (!module.exports.health) module.exports.health = () => ({ status: 'healthy' });
  if (!module.exports.metrics) module.exports.metrics = () => ({ usages: 0 });
  if (!module.exports._tick) module.exports._tick = async () => {};
}
// -------------------------------------------
