/**
 * HeadyLens — Deep System Introspection & Visualization Engine
 *
 * Provides real-time, deep visibility into the Heady ecosystem:
 * - Service topology and health mapping
 * - Request flow tracing across nodes
 * - Embedding space visualization data
 * - Performance bottleneck identification
 * - Coherence scoring across all nodes
 *
 * HeadyLens doesn't act — it observes. Pure read-only introspection.
 *
 * © 2026 HeadySystems Inc. — Sacred Geometry v4.0
 * @module intelligence/heady-lens
 */

const { PHI, PSI, fib, CSL_THRESHOLDS, phiFusionWeights, cosineSimilarity } = require('../shared/phi-math');
const { createLogger } = require('../shared/logger');

const logger = createLogger('HeadyLens');

class HeadyLens {
  /**
   * @param {Object} config
   * @param {Map|Object} config.nodeRegistry - Registry of all active nodes
   * @param {Object} [config.metricsStore] - Metrics persistence layer
   */
  constructor(config) {
    this.nodeRegistry = config.nodeRegistry;
    this.metricsStore = config.metricsStore || null;
    this.snapshots = [];
    this.maxSnapshots = fib(11); // 89 snapshots retained
    this.traceBuffer = [];
    this.maxTraces = fib(13);    // 233 traces retained
  }

  /**
   * Take a full system snapshot — health, coherence, metrics for all nodes.
   * @returns {Promise<Object>} System snapshot
   */
  async snapshot() {
    const nodes = this._getNodes();
    const timestamp = new Date().toISOString();

    const nodeStates = [];
    let totalCoherence = 0;
    let healthyCount = 0;

    for (const node of nodes) {
      const health = typeof node.health === 'function' ? node.health() : { status: 'unknown' };
      const coherence = node.coherenceScore || 1.0;
      totalCoherence += coherence;
      if (health.status === 'up') healthyCount++;

      nodeStates.push({
        name: node.name,
        ring: node.ring || 'unknown',
        pool: node.pool || 'unknown',
        state: node.state || 'unknown',
        coherence,
        health: health.status,
        metrics: node.metrics || {},
        uptime: health.uptime || null,
      });
    }

    const avgCoherence = nodes.length > 0 ? totalCoherence / nodes.length : 0;

    const snap = {
      timestamp,
      nodeCount: nodes.length,
      healthyNodes: healthyCount,
      unhealthyNodes: nodes.length - healthyCount,
      averageCoherence: parseFloat(avgCoherence.toFixed(4)),
      coherenceDrift: avgCoherence < CSL_THRESHOLDS.MEDIUM,
      nodes: nodeStates,
      topology: this._computeTopology(nodeStates),
      hotspots: this._identifyHotspots(nodeStates),
    };

    this.snapshots.push(snap);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-fib(10)); // Keep 55
    }

    logger.info({
      nodeCount: snap.nodeCount,
      healthy: snap.healthyNodes,
      coherence: snap.averageCoherence,
      drift: snap.coherenceDrift,
    }, 'System snapshot taken');

    return snap;
  }

  /**
   * Trace a request through the system — records node hops and timing.
   * @param {Object} trace
   * @param {string} trace.requestId - Correlation ID
   * @param {string} trace.source - Origin node/service
   * @param {Array<{ node: string, entryTime: number, exitTime: number, status: string }>} trace.hops
   * @returns {Object} Enriched trace with analysis
   */
  recordTrace(trace) {
    const totalMs = trace.hops.reduce((sum, h) => sum + (h.exitTime - h.entryTime), 0);
    const bottleneck = trace.hops.reduce((slow, h) =>
      (h.exitTime - h.entryTime) > (slow.exitTime - slow.entryTime) ? h : slow
    );

    const enriched = {
      ...trace,
      timestamp: new Date().toISOString(),
      totalMs,
      hopCount: trace.hops.length,
      bottleneck: {
        node: bottleneck.node,
        durationMs: bottleneck.exitTime - bottleneck.entryTime,
      },
      analysis: {
        avgHopMs: parseFloat((totalMs / trace.hops.length).toFixed(2)),
        failed: trace.hops.filter(h => h.status !== 'ok').length,
      },
    };

    this.traceBuffer.push(enriched);
    if (this.traceBuffer.length > this.maxTraces) {
      this.traceBuffer = this.traceBuffer.slice(-fib(12)); // Keep 144
    }

    return enriched;
  }

  /**
   * Get embedding space visualization data (3D projection).
   * Returns positions for all nodes in a 3D projection of the 384D space.
   * @returns {Object[]} Array of { name, x, y, z, ring, coherence }
   */
  embeddingVisualization() {
    const nodes = this._getNodes();
    const points = [];

    for (const node of nodes) {
      if (!node.embedding || node.embedding.length < 3) continue;

      // Simple 3D projection using first 3 principal components
      // In production: use UMAP/t-SNE with phi-scaled parameters
      const [x, y, z] = node.embedding.slice(0, 3);

      points.push({
        name: node.name,
        x: parseFloat(x.toFixed(4)),
        y: parseFloat(y.toFixed(4)),
        z: parseFloat(z.toFixed(4)),
        ring: node.ring || 'unknown',
        pool: node.pool || 'unknown',
        coherence: node.coherenceScore || 1.0,
      });
    }

    return points;
  }

  /**
   * Get performance breakdown by pool.
   * @returns {Object} Pool-level metrics
   */
  poolMetrics() {
    const nodes = this._getNodes();
    const pools = {};

    for (const node of nodes) {
      const pool = node.pool || 'unknown';
      if (!pools[pool]) {
        pools[pool] = { nodeCount: 0, healthy: 0, totalRequests: 0, totalErrors: 0, avgResponseMs: 0 };
      }
      pools[pool].nodeCount++;
      if (node.state !== 'expired') pools[pool].healthy++;
      if (node.metrics) {
        pools[pool].totalRequests += node.metrics.requestsHandled || 0;
        pools[pool].totalErrors += node.metrics.errorsEncountered || 0;
        pools[pool].avgResponseMs += node.metrics.avgResponseMs || 0;
      }
    }

    // Average the response times
    for (const pool of Object.values(pools)) {
      if (pool.nodeCount > 0) {
        pool.avgResponseMs = parseFloat((pool.avgResponseMs / pool.nodeCount).toFixed(2));
      }
    }

    return pools;
  }

  /**
   * Get coherence matrix — pairwise similarity between all nodes.
   * @returns {{ matrix: number[][], labels: string[], alerts: string[] }}
   */
  coherenceMatrix() {
    const nodes = this._getNodes().filter(n => n.embedding);
    const labels = nodes.map(n => n.name);
    const matrix = [];
    const alerts = [];

    for (let i = 0; i < nodes.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          const sim = cosineSimilarity(nodes[i].embedding, nodes[j].embedding);
          matrix[i][j] = parseFloat(sim.toFixed(4));

          if (sim < CSL_THRESHOLDS.MINIMUM && nodes[i].ring === nodes[j].ring) {
            alerts.push(`Low coherence between ${labels[i]} and ${labels[j]}: ${sim.toFixed(3)}`);
          }
        }
      }
    }

    return { matrix, labels, alerts };
  }

  /**
   * Get trend analysis from snapshot history.
   * @returns {Object}
   */
  trends() {
    if (this.snapshots.length < 2) return { insufficient: true };

    const recent = this.snapshots.slice(-fib(7)); // Last 13
    return {
      coherenceTrend: recent.map(s => ({ t: s.timestamp, v: s.averageCoherence })),
      healthTrend: recent.map(s => ({ t: s.timestamp, v: s.healthyNodes / s.nodeCount })),
      hotspotFrequency: this._hotspotFrequency(recent),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────

  _getNodes() {
    if (this.nodeRegistry instanceof Map) return [...this.nodeRegistry.values()];
    if (this.nodeRegistry && typeof this.nodeRegistry.nodes === 'object') {
      if (this.nodeRegistry.nodes instanceof Map) return [...this.nodeRegistry.nodes.values()];
      return Object.values(this.nodeRegistry.nodes);
    }
    return [];
  }

  _computeTopology(nodeStates) {
    const rings = {};
    for (const n of nodeStates) {
      if (!rings[n.ring]) rings[n.ring] = [];
      rings[n.ring].push(n.name);
    }
    return rings;
  }

  _identifyHotspots(nodeStates) {
    return nodeStates
      .filter(n => n.coherence < CSL_THRESHOLDS.MEDIUM || n.health !== 'up')
      .map(n => ({
        node: n.name,
        issue: n.health !== 'up' ? 'unhealthy' : 'coherence_drift',
        severity: n.coherence < CSL_THRESHOLDS.MINIMUM ? 'critical' : 'warning',
      }));
  }

  _hotspotFrequency(snapshots) {
    const freq = {};
    for (const snap of snapshots) {
      for (const hs of snap.hotspots) {
        freq[hs.node] = (freq[hs.node] || 0) + 1;
      }
    }
    return freq;
  }

  /** Health check */
  health() {
    return {
      service: 'HeadyLens',
      status: 'up',
      snapshotCount: this.snapshots.length,
      traceCount: this.traceBuffer.length,
      lastSnapshot: this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].timestamp : null,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { HeadyLens };
