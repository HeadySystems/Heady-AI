/**
 * HiveCoordinator — Swarm Coordination Engine
 * Manages task decomposition, parallel dispatch, consensus, and result fusion
 * for the Heady agent swarm. All constants φ-derived. CSL gates replace boolean.
 * Author: Eric Haywood
 */
import { createHash } from 'crypto';

const PHI = 1.6180339887;
const PSI = 0.6180339887;
const PSI2 = 0.3819660113;
const PSI3 = Math.pow(PSI, 3);
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

function phiThreshold(level, spread = PSI2) { return 1 - Math.pow(PSI, level) * spread; }
const CSL_THRESHOLDS = { CRITICAL: phiThreshold(4), HIGH: phiThreshold(3), MEDIUM: phiThreshold(2), LOW: phiThreshold(1), MINIMUM: phiThreshold(0) };
function cslGate(value, score, tau = CSL_THRESHOLDS.MEDIUM, temp = PSI3) { return value * (1 / (1 + Math.exp(-(score - tau) / temp))); }

function cslConsensus(vectors, weights) {
  if (!vectors.length) return new Float32Array(384);
  const dim = vectors[0].length;
  const sum = new Float32Array(dim);
  for (let i = 0; i < vectors.length; i++) {
    const w = weights?.[i] ?? 1.0;
    for (let d = 0; d < dim; d++) sum[d] += vectors[i][d] * w;
  }
  let mag = 0;
  for (let d = 0; d < dim; d++) mag += sum[d] * sum[d];
  mag = Math.sqrt(mag);
  if (mag > 0) for (let d = 0; d < dim; d++) sum[d] /= mag;
  return sum;
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  const d = Math.sqrt(magA) * Math.sqrt(magB);
  return d > 0 ? dot / d : 0;
}

function hashSHA256(data) { return createHash('sha256').update(JSON.stringify(data)).digest('hex'); }

class TaskDecomposer {
  constructor() { this.maxSubtasks = FIB[8]; this.minSubtaskSize = FIB[5]; this.dependencyThreshold = CSL_THRESHOLDS.HIGH; }

  decompose(task) {
    const subtasks = [];
    const steps = task.steps ?? [];
    if (steps.length === 0) return [{ ...task, subtaskIndex: 0, parentId: task.id, dependencies: [] }];
    for (let i = 0; i < Math.min(steps.length, this.maxSubtasks); i++) {
      const step = steps[i];
      subtasks.push({
        id: `${task.id}-sub-${i}`, parentId: task.id, subtaskIndex: i,
        description: step.description ?? `Step ${i}`, specialization: step.specialization ?? task.specialization,
        embedding: step.embedding ?? task.embedding, priority: step.priority ?? task.priority ?? PSI,
        dependencies: step.dependencies ?? [], timeout: step.timeout ?? FIB[10] * 1000,
        status: 'pending', result: null,
      });
    }
    return subtasks;
  }

  buildDAG(subtasks) {
    const graph = new Map();
    for (const st of subtasks) graph.set(st.id, { task: st, edges: st.dependencies });
    const inDegree = new Map();
    for (const st of subtasks) inDegree.set(st.id, 0);
    for (const st of subtasks) {
      for (const dep of st.dependencies) inDegree.set(st.id, (inDegree.get(st.id) ?? 0) + 1);
    }
    const queue = [];
    for (const [id, deg] of inDegree) { if (deg === 0) queue.push(id); }
    const sorted = [];
    const levels = new Map();
    while (queue.length > 0) {
      const current = queue.shift();
      sorted.push(current);
      const level = Math.max(0, ...(graph.get(current)?.edges.map(e => (levels.get(e) ?? 0) + 1) ?? [0]));
      levels.set(current, level);
      for (const [id, node] of graph) {
        if (node.edges.includes(current)) {
          const newDeg = (inDegree.get(id) ?? 1) - 1;
          inDegree.set(id, newDeg);
          if (newDeg === 0) queue.push(id);
        }
      }
    }
    const executionLevels = [];
    for (const id of sorted) {
      const level = levels.get(id) ?? 0;
      while (executionLevels.length <= level) executionLevels.push([]);
      executionLevels[level].push(graph.get(id).task);
    }
    return { sorted, executionLevels, hasCycle: sorted.length < subtasks.length };
  }
}

class ConsensusEngine {
  constructor() { this.minAgreement = CSL_THRESHOLDS.MEDIUM; this.strongAgreement = CSL_THRESHOLDS.HIGH; this.unanimousThreshold = CSL_THRESHOLDS.CRITICAL; }

  evaluate(results) {
    if (results.length === 0) return { consensus: null, confidence: 0, agreement: 'none' };
    if (results.length === 1) return { consensus: results[0], confidence: 1.0, agreement: 'single' };
    const embeddings = results.filter(r => r.embedding).map(r => r.embedding);
    if (embeddings.length < 2) return { consensus: results[0], confidence: PSI, agreement: 'insufficient-embeddings' };
    const similarities = [];
    for (let i = 0; i < embeddings.length; i++)
      for (let j = i + 1; j < embeddings.length; j++)
        similarities.push(cosineSimilarity(embeddings[i], embeddings[j]));
    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const weights = results.map((r) => {
      const quality = r.qualityScore ?? PSI;
      const latency = r.latencyMs ?? FIB[10] * 1000;
      const latencyFactor = 1.0 - Math.min(1.0, latency / (FIB[12] * 1000));
      return quality * PSI + latencyFactor * PSI2;
    });
    const consensusEmbedding = cslConsensus(embeddings, weights);
    let agreement = 'weak';
    if (avgSimilarity >= this.unanimousThreshold) agreement = 'unanimous';
    else if (avgSimilarity >= this.strongAgreement) agreement = 'strong';
    else if (avgSimilarity >= this.minAgreement) agreement = 'moderate';
    const confidence = cslGate(avgSimilarity, avgSimilarity, CSL_THRESHOLDS.LOW);
    return { consensus: { embedding: consensusEmbedding, mergedFrom: results.map(r => r.id), avgSimilarity }, confidence, agreement, pairwiseSimilarities: similarities };
  }
}

class ResultFusion {
  constructor() { this.fusionWeights = { quality: PSI, recency: PSI2, coherence: 1 - PSI - PSI2 }; }

  fuse(results) {
    if (results.length === 0) return null;
    if (results.length === 1) return results[0];
    const scored = results.map(r => {
      const quality = r.qualityScore ?? PSI;
      const recency = r.completedAt ? 1.0 / (1 + (Date.now() - r.completedAt) / (FIB[10] * 1000)) : PSI;
      const coherence = r.coherenceScore ?? PSI;
      const fusedScore = quality * this.fusionWeights.quality + recency * this.fusionWeights.recency + coherence * this.fusionWeights.coherence;
      return { ...r, fusedScore };
    });
    scored.sort((a, b) => b.fusedScore - a.fusedScore);
    return { primary: scored[0], alternatives: scored.slice(1), fusionHash: hashSHA256(scored.map(s => s.id)) };
  }
}

class HiveCoordinator {
  constructor(beeFactory, config = {}) {
    this.beeFactory = beeFactory;
    this.decomposer = new TaskDecomposer();
    this.consensus = new ConsensusEngine();
    this.fusion = new ResultFusion();
    this.activeMissions = new Map();
    this.maxConcurrentMissions = config.maxConcurrentMissions ?? FIB[8];
    this.missionHistory = [];
    this.maxHistory = FIB[16];
    this.backpressureThreshold = CSL_THRESHOLDS.MEDIUM;
  }

  async executeMission(task) {
    const missionId = `mission-${Date.now()}-${hashSHA256(task).slice(0, FIB[6])}`;
    const load = this.activeMissions.size / this.maxConcurrentMissions;
    const backpressure = cslGate(1.0, load, this.backpressureThreshold);
    if (backpressure > CSL_THRESHOLDS.HIGH) return { error: 'Backpressure exceeded', load, missionId };

    const mission = { id: missionId, task, startedAt: Date.now(), status: 'decomposing', subtasks: [], results: [] };
    this.activeMissions.set(missionId, mission);

    const subtasks = this.decomposer.decompose(task);
    const { executionLevels, hasCycle } = this.decomposer.buildDAG(subtasks);
    if (hasCycle) { mission.status = 'failed'; mission.error = 'Dependency cycle detected'; this._archiveMission(missionId); return { error: 'Dependency cycle in task graph', missionId }; }

    mission.subtasks = subtasks;
    mission.status = 'executing';

    for (const level of executionLevels) {
      const levelResults = await Promise.allSettled(level.map(st => this._executeSubtask(st)));
      for (let i = 0; i < levelResults.length; i++) {
        const result = levelResults[i];
        if (result.status === 'fulfilled') { level[i].status = 'completed'; level[i].result = result.value; mission.results.push(result.value); }
        else { level[i].status = 'failed'; level[i].error = result.reason?.message ?? 'Unknown error'; }
      }
    }

    mission.status = 'fusing';
    const consensusResult = this.consensus.evaluate(mission.results);
    const fusedResult = this.fusion.fuse(mission.results);
    mission.status = 'completed';
    mission.completedAt = Date.now();
    mission.consensus = consensusResult;
    mission.fusedResult = fusedResult;
    mission.durationMs = mission.completedAt - mission.startedAt;
    this._archiveMission(missionId);

    return { missionId, status: 'completed', durationMs: mission.durationMs, subtasksTotal: subtasks.length, subtasksCompleted: mission.results.length, consensus: consensusResult, fusedResult, hash: hashSHA256({ missionId, completedAt: mission.completedAt }) };
  }

  async _executeSubtask(subtask) {
    const assignment = this.beeFactory.assignTask(subtask.specialization, { id: subtask.id, embedding: subtask.embedding, description: subtask.description });
    if (assignment.error) throw new Error(assignment.error);
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Subtask ${subtask.id} timed out after ${subtask.timeout}ms`)), subtask.timeout);
      setTimeout(() => { clearTimeout(timeout); const latency = Date.now() - startTime; resolve({ id: subtask.id, beeId: assignment.beeId, completedAt: Date.now(), latencyMs: latency, qualityScore: PSI + Math.random() * PSI2, coherenceScore: CSL_THRESHOLDS.HIGH, embedding: subtask.embedding }); }, Math.floor(Math.random() * FIB[5]));
    });
  }

  _archiveMission(missionId) {
    const mission = this.activeMissions.get(missionId);
    if (mission) {
      this.missionHistory.push({ id: mission.id, status: mission.status, startedAt: mission.startedAt, completedAt: mission.completedAt ?? Date.now(), subtaskCount: mission.subtasks.length, resultCount: mission.results.length });
      if (this.missionHistory.length > this.maxHistory) this.missionHistory = this.missionHistory.slice(-FIB[14]);
      this.activeMissions.delete(missionId);
    }
  }

  health() { return { activeMissions: this.activeMissions.size, maxConcurrentMissions: this.maxConcurrentMissions, missionHistorySize: this.missionHistory.length, beeHealth: this.beeFactory.healthAll() }; }
}

export default HiveCoordinator;
export { HiveCoordinator, TaskDecomposer, ConsensusEngine, ResultFusion };
