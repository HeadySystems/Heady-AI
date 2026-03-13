// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  Spatial Orchestrator — Metatron's Cube Topology                 ║
// ║  13-Sphere Multi-Agent Spatial Routing                           ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════
// Sacred Geometry Constants
// ═══════════════════════════════════════════════════════════════════

const PHI = 1.618033988749895;
const PSI = 1 / PHI; // 0.618...
const SQRT2 = Math.SQRT2;
const SQRT3 = Math.sqrt(3);

// ═══════════════════════════════════════════════════════════════════
// Platonic Solid Node Archetypes
// ═══════════════════════════════════════════════════════════════════

const PlatonicArchetype = Object.freeze({
  TETRAHEDRON:  { id: 'tetrahedron',  faces: 4,  vertices: 4,  role: 'kv-cache',       element: 'fire'  },
  CUBE:         { id: 'cube',         faces: 6,  vertices: 8,  role: 'persistent-db',   element: 'earth' },
  OCTAHEDRON:   { id: 'octahedron',   faces: 8,  vertices: 6,  role: 'mesh-routing',    element: 'air'   },
  ICOSAHEDRON:  { id: 'icosahedron',  faces: 20, vertices: 12, role: 'ai-inference',    element: 'water' },
  DODECAHEDRON: { id: 'dodecahedron', faces: 12, vertices: 20, role: 'global-state',    element: 'aether'},
});

// ═══════════════════════════════════════════════════════════════════
// Metatron's Cube: 13-Sphere Topology
// ═══════════════════════════════════════════════════════════════════

class MetatronsCube {
  constructor() {
    // 13 spheres: 1 center + 6 inner ring + 6 outer ring
    this.spheres = new Map();
    this.edges = [];
    this._buildTopology();
  }

  _buildTopology() {
    // Center sphere (index 0)
    this.spheres.set(0, {
      id: 0,
      position: [0, 0, 0],
      ring: 'center',
      connections: [],
      agent: null,
      archetype: null,
      load: 0,
    });

    // Inner ring: 6 spheres at unit distance, 60° apart
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      this.spheres.set(i + 1, {
        id: i + 1,
        position: [Math.cos(angle), Math.sin(angle), 0],
        ring: 'inner',
        connections: [],
        agent: null,
        archetype: null,
        load: 0,
      });
    }

    // Outer ring: 6 spheres at PHI distance, offset by 30°
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 + Math.PI / 6;
      this.spheres.set(i + 7, {
        id: i + 7,
        position: [PHI * Math.cos(angle), PHI * Math.sin(angle), 0],
        ring: 'outer',
        connections: [],
        agent: null,
        archetype: null,
        load: 0,
      });
    }

    // Build edges: center connects to all inner
    for (let i = 1; i <= 6; i++) {
      this._addEdge(0, i);
    }

    // Inner ring connects cyclically
    for (let i = 1; i <= 6; i++) {
      this._addEdge(i, (i % 6) + 1);
    }

    // Inner to outer ring connections
    for (let i = 0; i < 6; i++) {
      this._addEdge(i + 1, i + 7);
      this._addEdge(i + 1, ((i + 1) % 6) + 7);
    }

    // Outer ring connects cyclically
    for (let i = 7; i <= 12; i++) {
      this._addEdge(i, ((i - 7 + 1) % 6) + 7);
    }
  }

  _addEdge(a, b) {
    this.edges.push([a, b]);
    this.spheres.get(a).connections.push(b);
    this.spheres.get(b).connections.push(a);
  }

  _distance(posA, posB) {
    const dx = posA[0] - posB[0];
    const dy = posA[1] - posB[1];
    const dz = posA[2] - posB[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Assign an agent to a sphere with a Platonic archetype
  assignAgent(sphereId, agentId, archetype = null) {
    const sphere = this.spheres.get(sphereId);
    if (!sphere) throw new Error(`Sphere ${sphereId} not found`);
    sphere.agent = agentId;
    sphere.archetype = archetype;
    return sphere;
  }

  // Find the optimal sphere for a new agent based on load balancing
  findOptimalSphere(archetype = null) {
    let best = null;
    let bestScore = Infinity;

    for (const [id, sphere] of this.spheres) {
      if (sphere.agent) continue;

      // Score: lower load + prefer inner ring for routing, outer for compute
      let score = sphere.load;
      if (archetype === PlatonicArchetype.OCTAHEDRON && sphere.ring === 'inner') {
        score *= PSI; // Prefer inner ring for mesh routing
      }
      if (archetype === PlatonicArchetype.ICOSAHEDRON && sphere.ring === 'outer') {
        score *= PSI; // Prefer outer ring for AI inference
      }
      if (archetype === PlatonicArchetype.DODECAHEDRON && sphere.ring === 'center') {
        score *= PSI; // Prefer center for global state
      }

      if (score < bestScore) {
        bestScore = score;
        best = sphere;
      }
    }

    return best;
  }

  // Route a task through the topology using shortest path (BFS)
  route(fromId, toId) {
    if (fromId === toId) return [fromId];

    const visited = new Set([fromId]);
    const queue = [[fromId]];

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      const sphere = this.spheres.get(current);

      for (const neighbor of sphere.connections) {
        if (neighbor === toId) return [...path, neighbor];
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return null; // No path found
  }

  // Get topology snapshot for monitoring
  snapshot() {
    const nodes = [];
    for (const [id, sphere] of this.spheres) {
      nodes.push({
        id,
        ring: sphere.ring,
        position: sphere.position,
        agent: sphere.agent,
        archetype: sphere.archetype ? sphere.archetype.id : null,
        load: sphere.load,
        connections: sphere.connections.length,
      });
    }
    return { nodes, edgeCount: this.edges.length, sphereCount: this.spheres.size };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Spatial Orchestrator Service
// ═══════════════════════════════════════════════════════════════════

class SpatialOrchestrator {
  constructor(options = {}) {
    this.cube = new MetatronsCube();
    this.taskQueue = [];
    this.routingHistory = [];
    this.maxHistory = options.maxHistory || 100;
  }

  // Register an agent in the topology
  registerAgent(agentId, archetype = null) {
    const sphere = this.cube.findOptimalSphere(archetype);
    if (!sphere) throw new Error('No available spheres in topology');
    return this.cube.assignAgent(sphere.id, agentId, archetype);
  }

  // Route a task from source agent to target agent
  routeTask(task) {
    const { from, to, payload, priority = 0 } = task;

    // Find spheres for agents
    let fromSphere = null;
    let toSphere = null;
    for (const [id, sphere] of this.cube.spheres) {
      if (sphere.agent === from) fromSphere = id;
      if (sphere.agent === to) toSphere = id;
    }

    if (fromSphere === null) throw new Error(`Agent ${from} not in topology`);
    if (toSphere === null) throw new Error(`Agent ${to} not in topology`);

    const path = this.cube.route(fromSphere, toSphere);
    const hops = path ? path.length - 1 : -1;

    const result = {
      id: crypto.randomBytes(8).toString('hex'),
      from,
      to,
      path,
      hops,
      priority,
      timestamp: Date.now(),
      payload,
    };

    // Update load on path nodes
    if (path) {
      for (const nodeId of path) {
        const sphere = this.cube.spheres.get(nodeId);
        sphere.load += 1;
      }
    }

    // Record history
    this.routingHistory.push(result);
    if (this.routingHistory.length > this.maxHistory) {
      this.routingHistory.shift();
    }

    return result;
  }

  // Get agents grouped by archetype
  agentsByArchetype() {
    const groups = {};
    for (const [, sphere] of this.cube.spheres) {
      if (!sphere.agent) continue;
      const key = sphere.archetype ? sphere.archetype.id : 'untyped';
      if (!groups[key]) groups[key] = [];
      groups[key].push({ agent: sphere.agent, sphereId: sphere.id, load: sphere.load });
    }
    return groups;
  }

  // Get orchestrator status
  status() {
    return {
      topology: this.cube.snapshot(),
      pendingTasks: this.taskQueue.length,
      routingHistory: this.routingHistory.length,
      agentsByArchetype: this.agentsByArchetype(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  SpatialOrchestrator,
  MetatronsCube,
  PlatonicArchetype,
  PHI,
  PSI,
};
