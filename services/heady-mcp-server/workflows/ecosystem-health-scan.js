/**
 * Ecosystem Health Scan Workflow
 * Full ecosystem health scan visiting every service, swarm, node.
 * Produces comprehensive health report with Sacred Geometry coherence map.
 * @module ecosystem-health-scan
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */
'use strict';

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

const RINGS = ['center', 'inner', 'middle', 'outer', 'governance'];
const POOLS = { hot: 0.34, warm: 0.21, cold: 0.13, reserve: 0.08, governance: 0.05 };

class EcosystemHealthScanWorkflow {
  constructor(config = {}) {
    this.serviceMesh = config.serviceMesh || null;
    this.timeoutMs = config.timeoutMs || FIB[8] * 1000;
    this.state = 'IDLE';
    this.lastReport = null;
    this._correlationId = `health-scan-${Date.now().toString(36)}`;
  }

  /**
   * Execute full ecosystem health scan
   * @param {object} context — { services, nodes, swarms }
   * @returns {object} — comprehensive health report
   */
  async execute(context = {}) {
    const { services = [], nodes = [], swarms = [] } = context;
    this.state = 'SCANNING';
    const correlationId = `scan-${Date.now().toString(36)}`;
    const startTime = Date.now();

    // Phase 1: Scan all services in parallel
    const serviceResults = await Promise.allSettled(
      services.map(svc => this._checkService(svc))
    );

    // Phase 2: Scan all nodes
    const nodeResults = await Promise.allSettled(
      nodes.map(node => this._checkNode(node))
    );

    // Phase 3: Scan all swarms
    const swarmResults = await Promise.allSettled(
      swarms.map(swarm => this._checkSwarm(swarm))
    );

    // Phase 4: Compute Sacred Geometry coherence map
    const geometryMap = this._computeGeometryMap(serviceResults, nodeResults);

    // Phase 5: Compute pool utilization
    const poolUtilization = this._computePoolUtilization(serviceResults, nodeResults, swarmResults);

    // Phase 6: Aggregate findings
    const serviceHealth = this._aggregateResults(serviceResults, 'service');
    const nodeHealth = this._aggregateResults(nodeResults, 'node');
    const swarmHealth = this._aggregateResults(swarmResults, 'swarm');

    const overallCoherence = this._computeOverallCoherence(serviceHealth, nodeHealth, swarmHealth);
    const duration = Date.now() - startTime;

    this.lastReport = {
      correlationId,
      timestamp: new Date().toISOString(),
      duration,
      overall: {
        coherence: overallCoherence,
        status: overallCoherence >= CSL.HIGH ? 'excellent' : overallCoherence >= CSL.MEDIUM ? 'good' : overallCoherence >= CSL.LOW ? 'degraded' : 'critical',
        totalComponents: services.length + nodes.length + swarms.length,
        healthyCount: serviceHealth.healthy + nodeHealth.healthy + swarmHealth.healthy,
        degradedCount: serviceHealth.degraded + nodeHealth.degraded + swarmHealth.degraded,
        failedCount: serviceHealth.failed + nodeHealth.failed + swarmHealth.failed
      },
      services: serviceHealth,
      nodes: nodeHealth,
      swarms: swarmHealth,
      sacredGeometry: geometryMap,
      poolUtilization,
      recommendations: this._generateRecommendations(overallCoherence, serviceHealth, nodeHealth, swarmHealth, geometryMap)
    };

    this.state = 'IDLE';
    return this.lastReport;
  }

  async _checkService(service) {
    try {
      const health = typeof service.health === 'function' ? await service.health() : service.health || {};
      return { id: service.id || service.name || 'unknown', status: health.status || 'unknown', coherence: health.coherence || CSL.MEDIUM, ring: service.ring || 'outer', pool: service.pool || 'warm', ...health };
    } catch (err) {
      return { id: service.id || 'unknown', status: 'failed', coherence: 0, error: err.message };
    }
  }

  async _checkNode(node) {
    try {
      const health = typeof node.health === 'function' ? await node.health() : node.health || {};
      return { id: node.nodeId || node.id || 'unknown', status: health.status || 'unknown', coherence: health.coherence || CSL.MEDIUM, ring: health.ring || node.ring || 'middle', ...health };
    } catch (err) {
      return { id: node.nodeId || 'unknown', status: 'failed', coherence: 0, error: err.message };
    }
  }

  async _checkSwarm(swarm) {
    try {
      const health = typeof swarm.health === 'function' ? await swarm.health() : swarm.health || {};
      return { id: swarm.id || swarm.name || 'unknown', status: health.status || 'unknown', coherence: health.coherence || CSL.MEDIUM, beeCount: health.beeCount || 0, ...health };
    } catch (err) {
      return { id: swarm.id || 'unknown', status: 'failed', coherence: 0, error: err.message };
    }
  }

  _aggregateResults(results, type) {
    const items = results.map(r => r.status === 'fulfilled' ? r.value : { status: 'failed', coherence: 0 });
    const healthy = items.filter(i => i.status === 'ok' || i.coherence >= CSL.MEDIUM).length;
    const degraded = items.filter(i => i.status === 'degraded' || (i.coherence >= CSL.LOW && i.coherence < CSL.MEDIUM)).length;
    const failed = items.filter(i => i.status === 'failed' || i.coherence < CSL.LOW).length;
    const avgCoherence = items.length > 0 ? items.reduce((s, i) => s + (i.coherence || 0), 0) / items.length : 0;
    return { type, total: items.length, healthy, degraded, failed, avgCoherence, items };
  }

  _computeGeometryMap(serviceResults, nodeResults) {
    const ringHealth = {};
    for (const ring of RINGS) ringHealth[ring] = { count: 0, totalCoherence: 0, avgCoherence: 0 };

    const allResults = [...serviceResults, ...nodeResults].map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
    for (const item of allResults) {
      const ring = item.ring || 'outer';
      if (ringHealth[ring]) {
        ringHealth[ring].count++;
        ringHealth[ring].totalCoherence += item.coherence || 0;
      }
    }
    for (const ring of RINGS) {
      ringHealth[ring].avgCoherence = ringHealth[ring].count > 0 ? ringHealth[ring].totalCoherence / ringHealth[ring].count : 0;
    }

    const overallGeometryScore = RINGS.reduce((s, r) => s + ringHealth[r].avgCoherence, 0) / RINGS.length;
    return { rings: ringHealth, overallScore: overallGeometryScore, balanced: overallGeometryScore >= CSL.MEDIUM };
  }

  _computePoolUtilization(serviceResults, nodeResults, swarmResults) {
    const pools = { hot: 0, warm: 0, cold: 0, reserve: 0, governance: 0 };
    const allResults = [...serviceResults, ...nodeResults, ...swarmResults].map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
    for (const item of allResults) {
      const pool = item.pool || 'warm';
      if (pools[pool] !== undefined) pools[pool]++;
    }
    const total = Object.values(pools).reduce((s, v) => s + v, 0);
    const utilization = {};
    for (const [pool, count] of Object.entries(pools)) {
      utilization[pool] = { count, idealRatio: POOLS[pool], actualRatio: total > 0 ? count / total : 0, deviation: total > 0 ? Math.abs((count / total) - POOLS[pool]) : 0 };
    }
    return utilization;
  }

  _computeOverallCoherence(serviceHealth, nodeHealth, swarmHealth) {
    const weights = { services: PHI, nodes: 1.0, swarms: PSI };
    const totalWeight = weights.services + weights.nodes + weights.swarms;
    return (serviceHealth.avgCoherence * weights.services + nodeHealth.avgCoherence * weights.nodes + swarmHealth.avgCoherence * weights.swarms) / totalWeight;
  }

  _generateRecommendations(coherence, services, nodes, swarms, geometry) {
    const recs = [];
    if (coherence < CSL.MEDIUM) recs.push({ priority: 'critical', message: 'Overall coherence below MEDIUM threshold — system-wide review needed' });
    if (services.failed > 0) recs.push({ priority: 'high', message: `${services.failed} service(s) failed — investigate immediately` });
    if (nodes.failed > 0) recs.push({ priority: 'high', message: `${nodes.failed} node(s) failed — check Sacred Geometry topology` });
    if (!geometry.balanced) recs.push({ priority: 'medium', message: 'Sacred Geometry ring balance is off — consider rebalancing node placement' });
    if (swarms.degraded > 0) recs.push({ priority: 'medium', message: `${swarms.degraded} swarm(s) degraded — check bee lifecycle health` });
    if (recs.length === 0) recs.push({ priority: 'info', message: 'All systems operating within normal parameters' });
    return recs;
  }

  health() {
    return { status: 'ok', workflow: 'ecosystem-health-scan', state: this.state, lastScan: this.lastReport ? this.lastReport.timestamp : null, timestamp: new Date().toISOString() };
  }
}

module.exports = { EcosystemHealthScanWorkflow };
