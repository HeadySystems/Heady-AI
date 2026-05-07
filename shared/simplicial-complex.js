const { getLog, FIBS } = require('../src/kernel');
const { ALL_NODES, NODE_RINGS } = require('./sacred-geometry');
const { cslAND, normalize } = require('./csl-engine');

const logger = getLog('simplicial-complex');

class SimplicialComplex {
  constructor() {
    this.cells = {
      0: new Map(), // Nodes
      1: new Map(), // Edges
      2: new Map(), // Triangles
      3: new Map()  // Tetrahedra
    };
    this.timer = null;
  }

  static async initialize(nodes = ALL_NODES) {
    const complex = new SimplicialComplex();
    nodes.forEach(node => complex.addNode(node));
    complex.startTelemetry();
    return complex;
  }

  addNode(nodeId, state = 1.0) {
    this.cells[0].set(nodeId, { id: nodeId, state });
  }

  addEdge(nodeA, nodeB, weight = 1.0) {
    const id = [nodeA, nodeB].sort().join('-');
    this.cells[1].set(id, { id, nodes: [nodeA, nodeB], weight });
  }

  addTriangle(nodeA, nodeB, nodeC, weight = 1.0) {
    const id = [nodeA, nodeB, nodeC].sort().join('-');
    this.cells[2].set(id, { id, nodes: [nodeA, nodeB, nodeC], weight });
  }

  addTetrahedron(nodeA, nodeB, nodeC, nodeD, weight = 1.0) {
    const id = [nodeA, nodeB, nodeC, nodeD].sort().join('-');
    this.cells[3].set(id, { id, nodes: [nodeA, nodeB, nodeC, nodeD], weight });
  }

  /**
   * Updates the state/activation level of a specific node
   */
  updateNodeState(nodeId, state) {
    if (this.cells[0].has(nodeId)) {
      const node = this.cells[0].get(nodeId);
      node.state = state;
    }
  }

  /**
   * Compute sync score 0-1 using CSL coherence across all simplex levels
   */
  computeTopologicalSync() {
    let syncScores = [];

    // Edges (1-cells)
    for (const edge of this.cells[1].values()) {
      const [nA, nB] = edge.nodes;
      const stateA = this.cells[0].get(nA)?.state || 0;
      const stateB = this.cells[0].get(nB)?.state || 0;
      // using cslAND to measure coherence between states
      syncScores.push(cslAND([stateA], [stateB]) * edge.weight);
    }

    // Triangles (2-cells)
    for (const tri of this.cells[2].values()) {
      const [nA, nB, nC] = tri.nodes;
      const states = tri.nodes.map(n => this.cells[0].get(n)?.state || 0);
      // Continuous AND across 3 states
      const coherence = Math.min(...states); // simplified CSL AND for scalars
      syncScores.push(coherence * tri.weight * 1.5); // higher order bonus
    }

    if (syncScores.length === 0) return 1.0;
    
    const sum = syncScores.reduce((acc, val) => acc + val, 0);
    return Math.max(0, Math.min(1, sum / syncScores.length));
  }

  /**
   * Detects if any triangles have all 3 nodes activated above threshold
   * Returns list of activated triangles
   */
  detectTriangularActivation(threshold) {
    const activated = [];
    for (const tri of this.cells[2].values()) {
      const states = tri.nodes.map(n => this.cells[0].get(n)?.state || 0);
      const minState = Math.min(...states);
      if (minState >= threshold) {
        activated.push(tri);
      }
    }
    return activated;
  }

  startTelemetry() {
    const intervalMs = FIBS[10] * 1000; // 55 seconds
    this.timer = setInterval(() => {
      const syncScore = this.computeTopologicalSync();
      logger.info('Topological sync score', { syncScore });
    }, intervalMs);
    
    if (this.timer.unref) this.timer.unref();
  }

  stopTelemetry() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = { SimplicialComplex };
