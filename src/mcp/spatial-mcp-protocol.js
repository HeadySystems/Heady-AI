/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ─── Spatial MCP Protocol ─────────────────────────────────────
 * Milestone Gamma — Spatial MCP
 *
 * Standardized Model Context Protocol (MCP) tool definitions
 * allowing external tools to natively query and interact with
 * Heady's 3D vector space environment.
 *
 * Tools:
 *   spatial_query   — query memories/agents near a 3D coordinate
 *   spatial_insert  — insert a new entity into vector space
 *   spatial_inspect — get zone, octant, neighborhood for a coord
 *   spatial_agents  — list active ephemeral agents
 *   spatial_health  — 3D environment statistics
 *
 * Patent: PPA #06 — 3D Memory Architecture
 * ──────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const { Vec3, SpatialIndex, ZoneManager, MemoryStore } = require('../memory/octree-spatial-index');
const { embed } = require('../services/spatial-embedder');

// ── Shared Spatial State ───────────────────────────────────────
let _memoryStore = null;

function getMemoryStore() {
    if (!_memoryStore) {
        _memoryStore = new MemoryStore({ extent: 10, inputDim: 384 });
    }
    return _memoryStore;
}

// Allow injection from heady-manager boot
function setMemoryStore(store) {
    _memoryStore = store;
}

// ── MCP Tool Definitions ───────────────────────────────────────

const SPATIAL_MCP_TOOLS = [
    {
        name: 'spatial_query',
        description: 'Query the Heady 3D vector space for memories, knowledge, or agents near a 3D coordinate. Returns k-nearest neighbors with distance, zone, and context.',
        inputSchema: {
            type: 'object',
            properties: {
                coordinates: {
                    type: 'array',
                    items: { type: 'number' },
                    minItems: 3,
                    maxItems: 3,
                    description: '3D coordinates [x, y, z] in the vector space. Range: [-10, 10] per axis.',
                },
                text: {
                    type: 'string',
                    description: 'Optional text to auto-embed into 3D coordinates if coordinates are not provided.',
                },
                k: {
                    type: 'number',
                    default: 5,
                    description: 'Number of nearest neighbors to return.',
                },
                radius: {
                    type: 'number',
                    default: 3.0,
                    description: 'Maximum search radius.',
                },
            },
            required: [],
        },
    },
    {
        name: 'spatial_insert',
        description: 'Insert a new entity (memory, knowledge, or document) into the Heady 3D vector space. Text is auto-embedded into 3D coordinates using the Spatial Embedder.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Unique identifier for the entity. Auto-generated if omitted.',
                },
                text: {
                    type: 'string',
                    description: 'Content to embed and store in the 3D vector space.',
                },
                coordinates: {
                    type: 'array',
                    items: { type: 'number' },
                    minItems: 3,
                    maxItems: 3,
                    description: 'Explicit 3D coordinates. If omitted, auto-computed from text.',
                },
                metadata: {
                    type: 'object',
                    description: 'Additional metadata to attach to the entity.',
                },
            },
            required: ['text'],
        },
    },
    {
        name: 'spatial_inspect',
        description: 'Inspect a 3D coordinate in the Heady vector space. Returns zone classification, octant info, nearby entity count, and spatial metadata.',
        inputSchema: {
            type: 'object',
            properties: {
                coordinates: {
                    type: 'array',
                    items: { type: 'number' },
                    minItems: 3,
                    maxItems: 3,
                    description: '3D coordinates [x, y, z] to inspect.',
                },
                text: {
                    type: 'string',
                    description: 'Optional text to auto-embed into coordinates for inspection.',
                },
            },
            required: [],
        },
    },
    {
        name: 'spatial_agents',
        description: 'List all active ephemeral agents deployed in the Heady 3D vector space. Shows positions, tasks, progress, and time-to-live.',
        inputSchema: {
            type: 'object',
            properties: {
                state: {
                    type: 'string',
                    enum: ['active', 'deploying', 'completing', 'all'],
                    default: 'active',
                    description: 'Filter agents by state.',
                },
            },
        },
    },
    {
        name: 'spatial_health',
        description: 'Get comprehensive health statistics for the Heady 3D vector space environment. Includes node counts, zone distribution, STM/LTM state, and graph stats.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
];

// ── Tool Handlers ──────────────────────────────────────────────

async function handleSpatialQuery(params) {
    const store = getMemoryStore();
    let coords;

    if (params.coordinates && params.coordinates.length === 3) {
        coords = params.coordinates;
    } else if (params.text) {
        const embedded = embed(params.text);
        coords = [embedded.x * 10, embedded.y * 10, embedded.z * 10]; // Scale to ±10
    } else {
        return { error: 'Either coordinates or text is required.' };
    }

    const k = params.k || 5;
    const { neighbors, context } = store.retrieve(coords, k);
    const zoneManager = store.getZoneManager();
    const zone = zoneManager.getZone(coords);

    return {
        query: { coordinates: coords, zone: zone.name },
        results: neighbors.map(n => ({
            id: n.id,
            distance: n.dist ? n.dist.toFixed(4) : n.pos.distanceTo(Vec3.fromArray(coords)).toFixed(4),
            coordinates: n.pos.toArray(),
            data: n.data,
        })),
        context: context.map(c => ({
            id: c.id,
            depth: c.depth,
            data: c.data,
        })),
        receipt: crypto.createHash('sha256')
            .update(JSON.stringify({ coords, k, ts: Date.now() }))
            .digest('hex').slice(0, 12),
    };
}

async function handleSpatialInsert(params) {
    const store = getMemoryStore();
    let coords;

    if (params.coordinates && params.coordinates.length === 3) {
        coords = params.coordinates;
    } else {
        const embedded = embed(params.text, { filePath: params.metadata?.filePath });
        coords = [embedded.x * 10, embedded.y * 10, embedded.z * 10];
    }

    const id = params.id || `mem-${crypto.randomUUID().slice(0, 8)}`;
    const result = store.store(id, coords, {
        text: params.text.slice(0, 1000),
        ...params.metadata,
        insertedAt: Date.now(),
    });

    return {
        success: true,
        id,
        coordinates: result.pos,
        zone: result.zone.name,
        receipt: crypto.createHash('sha256')
            .update(JSON.stringify({ id, coords, ts: Date.now() }))
            .digest('hex').slice(0, 12),
    };
}

async function handleSpatialInspect(params) {
    const store = getMemoryStore();
    const zoneManager = store.getZoneManager();
    let coords;

    if (params.coordinates && params.coordinates.length === 3) {
        coords = params.coordinates;
    } else if (params.text) {
        const embedded = embed(params.text);
        coords = [embedded.x * 10, embedded.y * 10, embedded.z * 10];
    } else {
        return { error: 'Either coordinates or text is required.' };
    }

    const zone = zoneManager.getZone(coords);
    const vec = Vec3.fromArray(coords);
    const nearby = store.getSpatialIndex().queryRadius(vec, 2.0);

    return {
        coordinates: coords,
        zone: {
            id: zone.id,
            name: zone.name,
            centroid: zone.centroid.toArray(),
            distanceToCentroid: vec.distanceTo(zone.centroid).toFixed(4),
        },
        neighborhood: {
            entitiesWithin2Units: nearby.length,
            nearest: nearby.length > 0 ? {
                id: nearby[0].id,
                distance: nearby[0].pos.distanceTo(vec).toFixed(4),
            } : null,
        },
        spaceStats: store.getStats(),
    };
}

async function handleSpatialAgents(params) {
    try {
        const { getProjectionService } = require('../services/projection-service');
        const service = getProjectionService();
        const state = params.state || 'active';
        const filter = state === 'all' ? {} : { state };
        return {
            agents: service.listAgents(filter),
            health: service.getHealth(),
        };
    } catch {
        return {
            agents: [],
            health: { error: 'ProjectionService not available' },
        };
    }
}

async function handleSpatialHealth() {
    const store = getMemoryStore();
    const stats = store.getStats();
    const zones = store.getZoneManager().getAllZones();

    let agentHealth = {};
    try {
        const { getProjectionService } = require('../services/projection-service');
        agentHealth = getProjectionService().getHealth();
    } catch { agentHealth = { available: false }; }

    return {
        timestamp: new Date().toISOString(),
        vectorSpace: {
            totalEntities: stats.spatial,
            graphNodes: stats.graphNodes,
            graphEdges: stats.graphEdges,
            stm: stats.stmLtm.stm,
            ltm: stats.stmLtm.ltm,
            consolidationThreshold: stats.stmLtm.threshold,
        },
        zones: zones.map(z => ({
            id: z.id,
            name: z.name,
            centroid: z.centroid.toArray(),
        })),
        agents: agentHealth,
        receipt: crypto.createHash('sha256')
            .update(JSON.stringify(stats))
            .digest('hex').slice(0, 12),
    };
}

// ── Dispatcher ─────────────────────────────────────────────────

const TOOL_HANDLERS = {
    spatial_query:   handleSpatialQuery,
    spatial_insert:  handleSpatialInsert,
    spatial_inspect: handleSpatialInspect,
    spatial_agents:  handleSpatialAgents,
    spatial_health:  handleSpatialHealth,
};

/**
 * Handle an MCP tool call.
 * @param {string} toolName
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function handleToolCall(toolName, params = {}) {
    const handler = TOOL_HANDLERS[toolName];
    if (!handler) return { error: `Unknown spatial tool: ${toolName}` };
    return handler(params);
}

// ── Express Integration ────────────────────────────────────────

function registerSpatialMCPRoutes(app) {
    // List available spatial tools
    app.get('/api/mcp/spatial/tools', (_req, res) => {
        res.json({
            ok: true,
            protocol: 'Model Context Protocol',
            version: '1.0.0',
            tools: SPATIAL_MCP_TOOLS,
        });
    });

    // Execute a spatial MCP tool
    app.post('/api/mcp/spatial/call', async (req, res) => {
        try {
            const { tool, params } = req.body;
            if (!tool) return res.status(400).json({ ok: false, error: 'tool name required' });
            const result = await handleToolCall(tool, params || {});
            res.json({ ok: true, tool, result });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // Convenience routes for each tool
    for (const tool of SPATIAL_MCP_TOOLS) {
        app.post(`/api/mcp/spatial/${tool.name.replace('spatial_', '')}`, async (req, res) => {
            try {
                const result = await handleToolCall(tool.name, req.body);
                res.json({ ok: true, tool: tool.name, result });
            } catch (err) {
                res.status(500).json({ ok: false, error: err.message });
            }
        });
    }
}

module.exports = {
    SPATIAL_MCP_TOOLS,
    handleToolCall,
    registerSpatialMCPRoutes,
    getMemoryStore,
    setMemoryStore,
    TOOL_HANDLERS,
};
