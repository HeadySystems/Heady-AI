/**
 * FederationManager — Multi-Hive Federation & Cross-Region Coordination
 * Manages multiple HiveCoordinator instances across regions, handles
 * cross-hive task routing, data replication, and global consensus.
 * All constants φ-derived. CSL gates replace boolean. ESM only.
 * Author: Eric Haywood
 */
import { createHash } from 'crypto';

const PHI = 1.6180339887;
const PSI = 0.6180339887;
const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

function phiThreshold(level, spread = PSI2) { return 1 - Math.pow(PSI, level) * spread; }
const CSL_THRESHOLDS = { CRITICAL: phiThreshold(4), HIGH: phiThreshold(3), MEDIUM: phiThreshold(2), LOW: phiThreshold(1), MINIMUM: phiThreshold(0) };
function cslGate(value, score, tau = CSL_THRESHOLDS.MEDIUM, temp = Math.pow(PSI, 3)) { return value * (1 / (1 + Math.exp(-(score - tau) / temp))); }
function cosineSimilarity(a, b) { let dot = 0, magA = 0, magB = 0; const len = Math.min(a.length, b.length); for (let i = 0; i < len; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; } const d = Math.sqrt(magA) * Math.sqrt(magB); return d > 0 ? dot / d : 0; }
function hashSHA256(data) { return createHash('sha256').update(JSON.stringify(data)).digest('hex'); }

const REGIONS = {
  'us-east1': { lat: 33.836, lng: -81.163, tier: 'primary' },
  'us-central1': { lat: 41.262, lng: -95.861, tier: 'primary' },
  'us-west1': { lat: 45.601, lng: -121.184, tier: 'secondary' },
  'europe-west1': { lat: 50.449, lng: 3.818, tier: 'secondary' },
  'asia-east1': { lat: 24.038, lng: 121.514, tier: 'tertiary' },
};

function geoDistance(r1, r2) {
  const R = 6371;
  const dLat = (r2.lat - r1.lat) * Math.PI / 180;
  const dLng = (r2.lng - r1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r1.lat * Math.PI / 180) * Math.cos(r2.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

class HiveNode {
  constructor(id, region, hiveCoordinator) {
    this.id = id; this.region = region; this.regionMeta = REGIONS[region] ?? REGIONS['us-east1'];
    this.hive = hiveCoordinator; this.state = 'active'; this.lastHeartbeat = Date.now();
    this.missionsRouted = 0; this.missionsFailed = 0; this.coherenceScore = 1.0; this.latencyMs = FIB[5];
  }
  heartbeat() {
    this.lastHeartbeat = Date.now();
    const health = this.hive?.health?.() ?? {};
    this.state = health.activeMissions !== undefined ? 'active' : 'degraded';
    return { id: this.id, region: this.region, state: this.state, coherenceScore: this.coherenceScore, latencyMs: this.latencyMs, missionsRouted: this.missionsRouted, missionsFailed: this.missionsFailed, lastHeartbeat: this.lastHeartbeat };
  }
}

class ReplicationEngine {
  constructor() { this.replicationLog = []; this.maxLogSize = FIB[16]; this.replicationFactor = FIB[3]; this.consistencyLevel = 'quorum'; }
  replicate(data, sourceNode, targetNodes) {
    const replicationId = hashSHA256({ data: data.id, source: sourceNode.id, ts: Date.now() });
    const results = [];
    const targets = targetNodes.slice(0, this.replicationFactor);
    for (const target of targets) {
      const latency = geoDistance(sourceNode.regionMeta, target.regionMeta) / PHI;
      results.push({ targetId: target.id, targetRegion: target.region, estimatedLatencyMs: Math.ceil(latency), status: target.state === 'active' ? 'replicated' : 'deferred' });
    }
    const entry = { replicationId, sourceId: sourceNode.id, results, ts: Date.now() };
    this.replicationLog.push(entry);
    if (this.replicationLog.length > this.maxLogSize) this.replicationLog = this.replicationLog.slice(-FIB[14]);
    const quorumMet = results.filter(r => r.status === 'replicated').length >= Math.ceil(targets.length * PSI);
    return { replicationId, quorumMet, results };
  }
}

class GlobalConsensus {
  constructor() { this.voteThreshold = CSL_THRESHOLDS.MEDIUM; this.vetoThreshold = CSL_THRESHOLDS.CRITICAL; }
  vote(proposal, hiveNodes) {
    const votes = [];
    for (const node of hiveNodes) {
      if (node.state === 'offline') continue;
      const voteScore = node.coherenceScore * cslGate(1.0, node.coherenceScore, CSL_THRESHOLDS.LOW);
      votes.push({ nodeId: node.id, region: node.region, score: voteScore });
    }
    if (votes.length === 0) return { accepted: false, reason: 'no-active-nodes' };
    const avgScore = votes.reduce((a, v) => a + v.score, 0) / votes.length;
    const accepted = avgScore >= this.voteThreshold;
    const vetoed = votes.some(v => v.score < CSL_THRESHOLDS.MINIMUM);
    return { proposalId: proposal.id ?? hashSHA256(proposal), accepted: accepted && !vetoed, avgScore, voteCount: votes.length, votes, vetoed };
  }
}

class FederationManager {
  constructor(config = {}) {
    this.hiveNodes = new Map(); this.replication = new ReplicationEngine();
    this.globalConsensus = new GlobalConsensus(); this.routingHistory = [];
    this.maxRoutingHistory = FIB[16]; this.heartbeatIntervalMs = config.heartbeatIntervalMs ?? FIB[9] * 1000;
    this.failoverThreshold = CSL_THRESHOLDS.LOW; this.auditLog = []; this.maxAuditEntries = FIB[16];
  }
  _audit(action, detail) { const entry = { ts: Date.now(), action, detail, hash: hashSHA256({ action, detail, ts: Date.now() }) }; this.auditLog.push(entry); if (this.auditLog.length > this.maxAuditEntries) this.auditLog = this.auditLog.slice(-FIB[14]); }

  registerHive(id, region, hiveCoordinator) {
    const node = new HiveNode(id, region, hiveCoordinator);
    this.hiveNodes.set(id, node); this._audit('register-hive', { id, region });
    return node.heartbeat();
  }
  deregisterHive(id) { const node = this.hiveNodes.get(id); if (!node) return { error: `Hive not found: ${id}` }; node.state = 'offline'; this.hiveNodes.delete(id); this._audit('deregister-hive', { id }); return { id, state: 'deregistered' }; }

  selectHive(task, preferredRegion) {
    const active = [...this.hiveNodes.values()].filter(n => n.state !== 'offline');
    if (active.length === 0) return { error: 'No active hives available' };
    const preferredMeta = REGIONS[preferredRegion] ?? REGIONS['us-east1'];
    const scored = active.map(node => {
      const distance = geoDistance(preferredMeta, node.regionMeta);
      const proximitySco = 1.0 - (distance / 20000);
      const tierBonus = node.regionMeta.tier === 'primary' ? PHI * 0.1 : node.regionMeta.tier === 'secondary' ? PSI * 0.1 : PSI2 * 0.1;
      const healthScore = node.coherenceScore;
      const loadScore = node.missionsRouted > 0 ? 1.0 - (node.missionsFailed / node.missionsRouted) : 1.0;
      const composite = proximitySco * PSI + healthScore * PSI2 + loadScore * (1 - PSI - PSI2) + tierBonus;
      return { node, composite };
    });
    scored.sort((a, b) => b.composite - a.composite);
    const selected = scored[0];
    this._audit('route-task', { selectedHive: selected.node.id, region: selected.node.region, score: selected.composite });
    selected.node.missionsRouted++;
    return selected.node;
  }

  async routeTask(task, preferredRegion = 'us-east1') {
    const hive = this.selectHive(task, preferredRegion);
    if (hive.error) return hive;
    const result = await hive.hive.executeMission(task);
    const otherNodes = [...this.hiveNodes.values()].filter(n => n.id !== hive.id && n.state === 'active');
    const replicationResult = this.replication.replicate({ id: result.missionId, data: result }, hive, otherNodes);
    this.routingHistory.push({ taskId: task.id, hiveId: hive.id, region: hive.region, missionId: result.missionId, replicationId: replicationResult.replicationId, ts: Date.now() });
    if (this.routingHistory.length > this.maxRoutingHistory) this.routingHistory = this.routingHistory.slice(-FIB[14]);
    return { ...result, routing: { hiveId: hive.id, region: hive.region, replication: replicationResult } };
  }

  proposeGlobalChange(proposal) {
    const activeNodes = [...this.hiveNodes.values()].filter(n => n.state !== 'offline');
    const voteResult = this.globalConsensus.vote(proposal, activeNodes);
    this._audit('global-vote', { proposal: proposal.id ?? 'unnamed', result: voteResult.accepted });
    return voteResult;
  }

  heartbeatAll() { const results = []; for (const node of this.hiveNodes.values()) results.push(node.heartbeat()); return { hives: results, totalActive: results.filter(r => r.state === 'active').length }; }
  health() { const hb = this.heartbeatAll(); return { ...hb, routingHistorySize: this.routingHistory.length, replicationLogSize: this.replication.replicationLog.length, auditLogSize: this.auditLog.length }; }
}

export default FederationManager;
export { FederationManager, HiveNode, ReplicationEngine, GlobalConsensus, REGIONS };
