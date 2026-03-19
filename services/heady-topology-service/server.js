/**
 * @fileoverview HeadyTopologyService — Sacred Geometry topology manager.
 * Tracks all node positions in 3D vector space, calculates geometric distances
 * for routing, maintains ring membership, and provides real-time topology
 * visualization data. All constants derived from PHI/PSI/FIB.
 * @module heady-topology-service
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

// ── PHI-MATH CONSTANTS ──────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };
const RING_RADIUS = { CENTER: 0, INNER: FIB[8], MIDDLE: FIB[8] * PHI, OUTER: FIB[8] * PHI * PHI, GOVERNANCE: FIB[8] * PHI * PHI * PHI };

// ── SACRED GEOMETRY RING DEFINITIONS ─────────────────────────────────────────
const RING_MEMBERS = {
  CENTER: ['HeadySoul'],
  INNER: ['HeadyBrains', 'HeadyConductor', 'HeadyVinci', 'HeadyAutoSuccess'],
  MIDDLE: ['JULES', 'BUILDER', 'OBSERVER', 'MURPHY', 'ATLAS', 'PYTHIA'],
  OUTER: ['BRIDGE', 'MUSE', 'SENTINEL', 'NOVA', 'JANITOR', 'SOPHIA', 'CIPHER', 'LENS'],
  GOVERNANCE: ['HeadyCheck', 'HeadyAssure', 'HeadyAware', 'HeadyPatterns', 'HeadyMC', 'HeadyRisks']
};

/**
 * Structured JSON logger with correlation ID support.
 * @param {string} level - Log level
 * @param {string} msg - Log message
 * @param {Object} meta - Additional metadata
 * @param {string} [correlationId] - Correlation ID for distributed tracing
 */
function log(level, msg, meta = {}, correlationId = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'heady-topology-service',
    level,
    correlationId: correlationId || crypto.randomUUID(),
    message: msg,
    ...meta
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

/**
 * Calculate phi-backoff delay for retry attempts.
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function phiBackoff(attempt) {
  const fibIdx = Math.min(attempt, FIB.length - 1);
  return FIB[fibIdx] * PSI * 1000;
}

/**
 * HeadyTopologyService — Sacred Geometry topology manager.
 * Tracks node positions in 3D space, calculates distances, maintains rings.
 */
class HeadyTopologyService {
  /**
   * @param {Object} config - Service configuration
   * @param {number} [config.port=3400] - HTTP port
   * @param {number} [config.coherenceCheckIntervalMs] - Health check interval
   * @param {number} [config.maxNodes] - Maximum topology nodes
   */
  constructor(config = {}) {
    this.port = config.port || 3400;
    this.coherenceCheckIntervalMs = config.coherenceCheckIntervalMs || FIB[10] * FIB[5] * PHI;
    this.maxNodes = config.maxNodes || FIB[12];
    /** @type {Map<string, {id: string, ring: string, position: {x: number, y: number, z: number}, health: number, capabilities: string[], lastSeen: number}>} */
    this.nodes = new Map();
    /** @type {Map<string, Map<string, number>>} */
    this.distanceCache = new Map();
    this.app = express();
    this.server = null;
    this._coherenceTimer = null;
    this._lastCoherence = CSL.MINIMUM;
    this._started = false;
    this._initializeDefaultTopology();
  }

  /**
   * Initialize the default Sacred Geometry topology with all ring members.
   * Distributes nodes evenly around their ring circle in 3D space.
   * @private
   */
  _initializeDefaultTopology() {
    for (const [ring, members] of Object.entries(RING_MEMBERS)) {
      const radius = RING_RADIUS[ring];
      members.forEach((name, idx) => {
        const angle = (2 * Math.PI * idx) / members.length;
        const zOffset = Math.sin(angle * PSI) * FIB[5];
        this.nodes.set(name, {
          id: name,
          ring,
          position: {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            z: zOffset
          },
          health: CSL.HIGH,
          capabilities: [],
          lastSeen: Date.now()
        });
      });
    }
    log('info', 'Default topology initialized', { nodeCount: this.nodes.size });
  }

  /**
   * Calculate Euclidean distance between two nodes in 3D space.
   * @param {string} nodeA - Source node ID
   * @param {string} nodeB - Target node ID
   * @returns {number|null} Distance or null if node not found
   */
  calculateDistance(nodeA, nodeB) {
    const a = this.nodes.get(nodeA);
    const b = this.nodes.get(nodeB);
    if (!a || !b) return null;
    const cacheKey = [nodeA, nodeB].sort().join('::');
    if (this.distanceCache.has(cacheKey)) return this.distanceCache.get(cacheKey);
    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    const dz = a.position.z - b.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!this.distanceCache.has(nodeA)) this.distanceCache.set(nodeA, new Map());
    this.distanceCache.get(nodeA).set(nodeB, dist);
    if (!this.distanceCache.has(cacheKey)) this.distanceCache.set(cacheKey, dist);
    return dist;
  }

  /**
   * Get phi-weighted routing cost between two nodes.
   * Cost factors ring separation and distance, weighted by PHI.
   * @param {string} nodeA - Source node ID
   * @param {string} nodeB - Target node ID
   * @returns {number} Routing cost
   */
  routingCost(nodeA, nodeB) {
    const dist = this.calculateDistance(nodeA, nodeB);
    if (dist === null) return Infinity;
    const a = this.nodes.get(nodeA);
    const b = this.nodes.get(nodeB);
    const ringOrder = ['CENTER', 'INNER', 'MIDDLE', 'OUTER', 'GOVERNANCE'];
    const ringSep = Math.abs(ringOrder.indexOf(a.ring) - ringOrder.indexOf(b.ring));
    const healthPenalty = 1 / (b.health || CSL.MINIMUM);
    return dist * (1 + ringSep * PSI) * healthPenalty;
  }

  /**
   * Find the shortest path between nodes using Dijkstra with phi-weighted costs.
   * @param {string} source - Source node ID
   * @param {string} target - Target node ID
   * @returns {Object} Path result with nodes and total cost
   */
  findPath(source, target) {
    const dist = new Map();
    const prev = new Map();
    const visited = new Set();
    const queue = [];
    for (const nodeId of this.nodes.keys()) {
      dist.set(nodeId, Infinity);
    }
    dist.set(source, 0);
    queue.push({ id: source, cost: 0 });
    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const { id: current } = queue.shift();
      if (current === target) break;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const neighbor of this.nodes.keys()) {
        if (neighbor === current || visited.has(neighbor)) continue;
        const cost = this.routingCost(current, neighbor);
        const totalCost = dist.get(current) + cost;
        if (totalCost < dist.get(neighbor)) {
          dist.set(neighbor, totalCost);
          prev.set(neighbor, current);
          queue.push({ id: neighbor, cost: totalCost });
        }
      }
    }
    const path = [];
    let step = target;
    while (step) {
      path.unshift(step);
      step = prev.get(step);
    }
    return { path, totalCost: dist.get(target), hops: path.length - 1 };
  }

  /**
   * Register or update a node in the topology.
   * @param {string} nodeId - Node identifier
   * @param {Object} data - Node data including ring, position, capabilities
   * @returns {Object} Registered node
   */
  registerNode(nodeId, data = {}) {
    if (this.nodes.size >= this.maxNodes && !this.nodes.has(nodeId)) {
      throw new Error(`Topology full: max ${this.maxNodes} nodes`);
    }
    const existing = this.nodes.get(nodeId) || {};
    const node = {
      id: nodeId,
      ring: data.ring || existing.ring || 'OUTER',
      position: data.position || existing.position || { x: 0, y: 0, z: 0 },
      health: data.health != null ? data.health : (existing.health || CSL.MEDIUM),
      capabilities: data.capabilities || existing.capabilities || [],
      lastSeen: Date.now()
    };
    this.nodes.set(nodeId, node);
    this.distanceCache.clear();
    log('info', 'Node registered', { nodeId, ring: node.ring });
    return node;
  }

  /**
   * Remove a node from the topology.
   * @param {string} nodeId - Node to remove
   * @returns {boolean} True if removed
   */
  deregisterNode(nodeId) {
    const removed = this.nodes.delete(nodeId);
    if (removed) this.distanceCache.clear();
    log('info', 'Node deregistered', { nodeId, removed });
    return removed;
  }

  /**
   * Calculate system-wide coherence as average node health weighted by ring importance.
   * @returns {number} Coherence score [0, 1]
   */
  calculateCoherence() {
    if (this.nodes.size === 0) return CSL.MINIMUM;
    const ringWeights = { CENTER: PHI * PHI * PHI, INNER: PHI * PHI, MIDDLE: PHI, OUTER: 1, GOVERNANCE: PHI * PHI };
    let weightedSum = 0;
    let totalWeight = 0;
    for (const node of this.nodes.values()) {
      const w = ringWeights[node.ring] || 1;
      weightedSum += node.health * w;
      totalWeight += w;
    }
    this._lastCoherence = totalWeight > 0 ? weightedSum / totalWeight : CSL.MINIMUM;
    return this._lastCoherence;
  }

  /**
   * Generate full topology map for visualization.
   * @returns {Object} Topology map with nodes, edges, rings, metrics
   */
  generateTopologyMap() {
    const nodesArr = Array.from(this.nodes.values());
    const edges = [];
    const nodeIds = Array.from(this.nodes.keys());
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const dist = this.calculateDistance(nodeIds[i], nodeIds[j]);
        if (dist !== null && dist < RING_RADIUS.OUTER * PSI) {
          edges.push({ source: nodeIds[i], target: nodeIds[j], distance: dist, cost: this.routingCost(nodeIds[i], nodeIds[j]) });
        }
      }
    }
    const rings = {};
    for (const [ring, members] of Object.entries(RING_MEMBERS)) {
      rings[ring] = { radius: RING_RADIUS[ring], members, healthy: members.filter(m => { const n = this.nodes.get(m); return n && n.health >= CSL.MEDIUM; }).length };
    }
    return {
      timestamp: new Date().toISOString(),
      coherence: this.calculateCoherence(),
      nodeCount: this.nodes.size,
      edgeCount: edges.length,
      nodes: nodesArr,
      edges,
      rings
    };
  }

  /**
   * Set up Express routes for the topology service.
   * @private
   */
  _setupRoutes() {
    this.app.use(express.json());

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      next();
    });

    /** Health endpoint returning coherence scores */
    this.app.get('/health', (_req, res) => {
      const coherence = this.calculateCoherence();
      res.json({
        status: coherence >= CSL.MEDIUM ? 'healthy' : 'degraded',
        coherence,
        cslGate: coherence >= CSL.HIGH ? 'PASSED' : coherence >= CSL.MEDIUM ? 'WARNING' : 'FAILED',
        nodeCount: this.nodes.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    /** Full topology map */
    this.app.get('/topology/map', (_req, res) => {
      const correlationId = crypto.randomUUID();
      log('info', 'Topology map requested', {}, correlationId);
      res.json({ correlationId, ...this.generateTopologyMap() });
    });

    /** Distance between two nodes */
    this.app.get('/topology/distance', (req, res) => {
      const { from, to } = req.query;
      if (!from || !to) return res.status(400).json({ error: 'Missing from/to query params' });
      const dist = this.calculateDistance(from, to);
      if (dist === null) return res.status(404).json({ error: 'Node not found' });
      res.json({ from, to, distance: dist, routingCost: this.routingCost(from, to), path: this.findPath(from, to) });
    });

    /** System-wide coherence score */
    this.app.get('/topology/coherence', (_req, res) => {
      const coherence = this.calculateCoherence();
      const ringHealth = {};
      for (const [ring, members] of Object.entries(RING_MEMBERS)) {
        const healths = members.map(m => this.nodes.get(m)?.health || 0);
        ringHealth[ring] = healths.length > 0 ? healths.reduce((a, b) => a + b, 0) / healths.length : 0;
      }
      res.json({ coherence, ringHealth, cslGate: coherence >= CSL.HIGH ? 'OPTIMAL' : coherence >= CSL.MEDIUM ? 'NOMINAL' : 'DEGRADED', timestamp: new Date().toISOString() });
    });

    /** Register a node */
    this.app.post('/topology/register', (req, res) => {
      const correlationId = crypto.randomUUID();
      try {
        const node = this.registerNode(req.body.id, req.body);
        res.status(201).json({ correlationId, node });
      } catch (err) {
        res.status(400).json({ correlationId, error: err.message });
      }
    });

    /** Deregister a node */
    this.app.delete('/topology/node/:id', (req, res) => {
      const removed = this.deregisterNode(req.params.id);
      res.json({ removed });
    });
  }

  /**
   * Start the topology service.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._started) return;
    this._setupRoutes();
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this._started = true;
        this._coherenceTimer = setInterval(() => {
          const c = this.calculateCoherence();
          if (c < CSL.LOW) log('warn', 'System coherence below LOW threshold', { coherence: c });
        }, this.coherenceCheckIntervalMs);
        log('info', 'HeadyTopologyService started', { port: this.port });
        resolve();
      });
    });
  }

  /**
   * Gracefully stop the topology service.
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this._started) return;
    clearInterval(this._coherenceTimer);
    return new Promise((resolve) => {
      this.server.close(() => {
        this._started = false;
        log('info', 'HeadyTopologyService stopped');
        resolve();
      });
    });
  }

  /**
   * Health check returning current coherence.
   * @returns {Object} Health status
   */
  health() {
    return { status: this._lastCoherence >= CSL.MEDIUM ? 'healthy' : 'degraded', coherence: this._lastCoherence, nodeCount: this.nodes.size };
  }
}

module.exports = { HeadyTopologyService, PHI, PSI, FIB, CSL, RING_MEMBERS, RING_RADIUS, phiBackoff };
