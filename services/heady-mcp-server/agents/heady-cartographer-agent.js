/**
 * HeadyCartographerAgent — Ecosystem mapper
 * Maintains live knowledge graphs of service dependencies, data flows, API contracts.
 * Detects orphaned services, circular dependencies, wiring gaps.
 * @module heady-cartographer-agent
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */
'use strict';

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

class HeadyCartographerAgent {
  constructor(config = {}) {
    this.graph = { nodes: new Map(), edges: [] };
    this.domainMap = new Map();
    this.orphans = [];
    this.cycles = [];
    this.wiringGaps = [];
    this.lastScanTimestamp = null;
    this.state = 'IDLE';
    this.stats = { scans: 0, nodesDiscovered: 0, edgesDiscovered: 0, orphansFound: 0, cyclesFound: 0, gapsFound: 0 };
    this._correlationId = `cartographer-${Date.now().toString(36)}`;
  }

  /**
   * Register a service/node in the ecosystem graph
   * @param {object} node — { id, type, domain, ring, capabilities, endpoints, dependencies }
   */
  registerNode(node) {
    const { id, type = 'service', domain = 'unknown', ring = 'outer', capabilities = [], endpoints = [], dependencies = [] } = node;
    this.graph.nodes.set(id, { id, type, domain, ring, capabilities, endpoints, dependencies, registeredAt: Date.now(), lastSeen: Date.now(), healthy: true });

    for (const dep of dependencies) {
      this.graph.edges.push({ from: id, to: dep, type: 'depends-on', weight: 1.0, registeredAt: Date.now() });
    }

    if (!this.domainMap.has(domain)) this.domainMap.set(domain, []);
    this.domainMap.get(domain).push(id);
    this.stats.nodesDiscovered++;
    this.stats.edgesDiscovered += dependencies.length;
  }

  /**
   * Register a data flow edge
   * @param {object} edge — { from, to, type, protocol, dataFormat }
   */
  registerEdge(edge) {
    const { from, to, type = 'data-flow', protocol = 'http', dataFormat = 'json' } = edge;
    this.graph.edges.push({ from, to, type, protocol, dataFormat, registeredAt: Date.now() });
    this.stats.edgesDiscovered++;
  }

  /**
   * Full ecosystem scan — detects orphans, cycles, gaps
   * @returns {object} — ecosystem health report
   */
  async scanEcosystem() {
    this.state = 'SCANNING';
    this.stats.scans++;
    const correlationId = `scan-${Date.now().toString(36)}`;

    this.orphans = this._findOrphans();
    this.cycles = this._detectCycles();
    this.wiringGaps = this._findWiringGaps();

    this.stats.orphansFound = this.orphans.length;
    this.stats.cyclesFound = this.cycles.length;
    this.stats.gapsFound = this.wiringGaps.length;
    this.lastScanTimestamp = Date.now();
    this.state = 'IDLE';

    const report = {
      correlationId,
      totalNodes: this.graph.nodes.size,
      totalEdges: this.graph.edges.length,
      domains: [...this.domainMap.entries()].map(([d, nodes]) => ({ domain: d, nodeCount: nodes.length })),
      ringDistribution: this._getRingDistribution(),
      orphans: this.orphans,
      cycles: this.cycles,
      wiringGaps: this.wiringGaps,
      coherence: this._calculateCoherence(),
      sacredGeometryHealth: this._assessSacredGeometryHealth(),
      timestamp: new Date().toISOString()
    };

    this._log('info', 'ecosystem-scanned', { correlationId, nodes: report.totalNodes, edges: report.totalEdges, orphans: this.orphans.length, cycles: this.cycles.length, gaps: this.wiringGaps.length });
    return report;
  }

  /** Find orphaned nodes (no incoming or outgoing edges) */
  _findOrphans() {
    const connected = new Set();
    for (const edge of this.graph.edges) {
      connected.add(edge.from);
      connected.add(edge.to);
    }
    return [...this.graph.nodes.keys()].filter(id => !connected.has(id));
  }

  /** Detect circular dependencies using DFS */
  _detectCycles() {
    const adj = new Map();
    for (const edge of this.graph.edges) {
      if (!adj.has(edge.from)) adj.set(edge.from, []);
      adj.get(edge.from).push(edge.to);
    }

    const visited = new Set();
    const recStack = new Set();
    const cycles = [];

    const dfs = (node, path) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      for (const neighbor of (adj.get(node) || [])) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart >= 0) cycles.push(path.slice(cycleStart).concat(neighbor));
        }
      }
      recStack.delete(node);
    };

    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) dfs(nodeId, []);
    }
    return cycles.slice(0, FIB[8]);
  }

  /** Find wiring gaps — services that declare dependencies on non-existent nodes */
  _findWiringGaps() {
    const gaps = [];
    for (const [nodeId, node] of this.graph.nodes) {
      for (const dep of node.dependencies) {
        if (!this.graph.nodes.has(dep)) {
          gaps.push({ service: nodeId, missingDependency: dep, severity: CSL.HIGH });
        }
      }
    }
    // Also check for edges pointing to non-existent nodes
    for (const edge of this.graph.edges) {
      if (!this.graph.nodes.has(edge.to)) {
        gaps.push({ from: edge.from, missingTarget: edge.to, edgeType: edge.type, severity: CSL.MEDIUM });
      }
    }
    return gaps;
  }

  _getRingDistribution() {
    const dist = { center: 0, inner: 0, middle: 0, outer: 0, governance: 0 };
    for (const node of this.graph.nodes.values()) dist[node.ring] = (dist[node.ring] || 0) + 1;
    return dist;
  }

  _assessSacredGeometryHealth() {
    const dist = this._getRingDistribution();
    const total = Object.values(dist).reduce((s, v) => s + v, 0);
    if (total === 0) return { health: 'empty', score: 0 };

    // Ideal ratios based on Sacred Geometry: center(1):inner(3):middle(6):outer(8):governance(6)
    const idealRatios = { center: 1/24, inner: 3/24, middle: 6/24, outer: 8/24, governance: 6/24 };
    let deviation = 0;
    for (const [ring, ideal] of Object.entries(idealRatios)) {
      const actual = (dist[ring] || 0) / total;
      deviation += Math.abs(actual - ideal);
    }
    const geometryScore = Math.max(0, 1.0 - deviation * PHI);
    return { health: geometryScore >= CSL.MEDIUM ? 'balanced' : 'imbalanced', score: geometryScore, distribution: dist };
  }

  _calculateCoherence() {
    const hasOrphans = this.orphans.length > 0 ? 0.1 : 0;
    const hasCycles = this.cycles.length > 0 ? 0.15 : 0;
    const hasGaps = this.wiringGaps.length > 0 ? 0.2 : 0;
    return Math.max(CSL.MINIMUM, 1.0 - hasOrphans - hasCycles - hasGaps);
  }

  async start() {
    this._log('info', 'cartographer-started', {});
    return this;
  }

  async stop() {
    this.state = 'STOPPED';
    this._log('info', 'cartographer-stopped', { stats: this.stats });
  }

  health() {
    return { status: 'ok', state: this.state, coherence: this._calculateCoherence(), stats: { ...this.stats }, graphSize: { nodes: this.graph.nodes.size, edges: this.graph.edges.length }, lastScan: this.lastScanTimestamp, timestamp: new Date().toISOString() };
  }

  _log(level, event, data = {}) {
    console.log(JSON.stringify({ level, event, agent: 'HeadyCartographerAgent', correlationId: this._correlationId, ...data, ts: new Date().toISOString() }));
  }
}

module.exports = { HeadyCartographerAgent };
