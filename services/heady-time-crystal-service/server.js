'use strict';

const crypto = require('crypto');
const express = require('express');
const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = {
  MIN: 0.500,
  LOW: 0.691,
  MED: 0.809,
  HIGH: 0.882,
  CRIT: 0.927,
  DEDUP: 0.972
};
const STATE_DIM = 384;
const vecNorm = v => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
const newVec = fn => Array.from({
  length: STATE_DIM
}, fn);
function createLogger(service) {
  return (level, message, meta = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      correlationId: meta.correlationId || crypto.randomUUID(),
      service,
      level,
      message,
      ...meta
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
    return entry;
  };
}
class StateSnapshot {
  constructor(stateVector, parentId = null, metadata = {}) {
    this.id = `snap_${crypto.randomUUID().slice(0, 12)}`;
    this.stateVector = stateVector;
    this.timestamp = Date.now();
    this.parentId = parentId;
    this.childIds = [];
    this.metadata = {
      ...metadata,
      dim: stateVector.length
    };
  }
  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      parentId: this.parentId,
      childIds: this.childIds,
      metadata: this.metadata,
      vectorNorm: vecNorm(this.stateVector)
    };
  }
}
class TimelineBranch {
  constructor(id, originSnapshotId = null) {
    this.id = id;
    this.originSnapshotId = originSnapshotId;
    this.snapshotIds = [];
    this.cursor = -1;
    this.createdAt = Date.now();
    this.label = id;
  }
  push(sid) {
    this.snapshotIds = this.snapshotIds.slice(0, this.cursor + 1);
    this.snapshotIds.push(sid);
    this.cursor = this.snapshotIds.length - 1;
  }
  undo() {
    if (this.cursor <= 0) return null;
    return this.snapshotIds[--this.cursor];
  }
  redo() {
    if (this.cursor >= this.snapshotIds.length - 1) return null;
    return this.snapshotIds[++this.cursor];
  }
  head() {
    return this.cursor >= 0 ? this.snapshotIds[this.cursor] : null;
  }
  toJSON() {
    return {
      id: this.id,
      label: this.label,
      originSnapshotId: this.originSnapshotId,
      snapshotCount: this.snapshotIds.length,
      cursor: this.cursor,
      createdAt: this.createdAt,
      headSnapshotId: this.head()
    };
  }
}
class DiffEngine {
  static distance(a, b) {
    let s = 0;
    for (let i = 0, l = Math.min(a.length, b.length); i < l; i++) s += (a[i] - b[i]) ** 2;
    return Math.sqrt(s);
  }
  static delta(snapA, snapB) {
    const dist = DiffEngine.distance(snapA.stateVector, snapB.stateVector);
    const maxN = Math.max(vecNorm(snapA.stateVector), vecNorm(snapB.stateVector), 1e-9);
    return {
      distance: dist,
      normalizedDelta: dist / maxN,
      similarity: 1 / (1 + dist * PSI)
    };
  }
}
class MergeResolver {
  static resolve(snapA, snapB, cohA, cohB) {
    const merged = new Float64Array(STATE_DIM),
      total = cohA + cohB || 1,
      wA = cohA / total,
      wB = cohB / total;
    for (let i = 0; i < STATE_DIM; i++) merged[i] = (snapA.stateVector[i] || 0) * wA + (snapB.stateVector[i] || 0) * wB;
    const conflictScore = DiffEngine.distance(snapA.stateVector, snapB.stateVector);
    const coherence = Math.max(cohA, cohB) / (1 + conflictScore * PSI);
    return {
      vector: Array.from(merged),
      winner: cohA >= cohB ? 'A' : 'B',
      coherence,
      gate: coherence >= CSL.MED ? 'PASS' : 'FAIL',
      conflictScore
    };
  }
}
class PhiScaledSnapshotScheduler {
  constructor(cb) {
    this.cb = cb;
    this.timers = [];
  }
  start(n = FIB[7]) {
    this.stop();
    for (let i = 0; i < n; i++) {
      const d = PHI ** i * 1000;
      this.timers.push(setTimeout(() => this.cb(i, d), d));
    }
  }
  stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
class TimelineDAG {
  constructor() {
    this.snapshots = new Map();
    this.branches = new Map();
    this.branches.set('main', new TimelineBranch('main'));
  }
  takeSnapshot(branchId, stateVector, metadata = {}) {
    const branch = this.branches.get(branchId);
    if (!branch) return null;
    const parentId = branch.head(),
      snap = new StateSnapshot(stateVector, parentId, metadata);
    if (parentId && this.snapshots.has(parentId)) this.snapshots.get(parentId).childIds.push(snap.id);
    this.snapshots.set(snap.id, snap);
    branch.push(snap.id);
    return snap;
  }
  fork(srcId, newId) {
    const src = this.branches.get(srcId);
    if (!src) return null;
    const origin = src.head(),
      id = newId || `branch_${crypto.randomUUID().slice(0, 8)}`;
    const branch = new TimelineBranch(id, origin);
    if (origin) branch.push(origin);
    this.branches.set(id, branch);
    return branch;
  }
  merge(idA, idB, targetId) {
    const brA = this.branches.get(idA),
      brB = this.branches.get(idB);
    if (!brA || !brB) return null;
    const sA = this.snapshots.get(brA.head()),
      sB = this.snapshots.get(brB.head());
    if (!sA || !sB) return null;
    const coh = s => 1 / (1 + s.stateVector.reduce((a, v) => a + Math.abs(v), 0) * PSI / STATE_DIM);
    const result = MergeResolver.resolve(sA, sB, coh(sA), coh(sB));
    if (result.gate === 'FAIL') return {
      error: 'CSL gate failed',
      coherence: result.coherence,
      threshold: CSL.MED
    };
    return {
      snapshot: this.takeSnapshot(targetId || idA, result.vector, {
        mergeOf: [idA, idB],
        winner: result.winner
      }),
      ...result
    };
  }
}
class HeadyTimeCrystalService {
  constructor(config = {}) {
    this.serviceName = 'heady-time-crystal';
    this.port = config.port || 3347;
    this.log = createLogger(this.serviceName);
    this.app = express();
    this.app.use(express.json({
      limit: '2mb'
    }));
    this.dag = new TimelineDAG();
    this.scheduler = null;
    this.startTime = Date.now();
    this.requestCount = 0;
    this.server = null;
    this._setupRoutes();
  }
  _setupRoutes() {
    const cid = req => req.headers['x-correlation-id'] || crypto.randomUUID();
    this.app.get('/health', (_req, res) => {
      const h = this.health();
      res.status(h.coherence >= CSL.MIN ? 200 : 503).json(h);
    });
    this.app.post('/snapshot', (req, res) => {
      const c = cid(req);
      this.requestCount++;
      try {
        const {
          branchId,
          stateVector,
          metadata
        } = req.body;
        const vec = stateVector || newVec(() => (Math.random() - 0.5) * PHI);
        const snap = this.dag.takeSnapshot(branchId || 'main', vec, metadata || {});
        if (!snap) return res.status(404).json({
          error: 'Branch not found'
        });
        this.log('info', 'Snapshot taken', {
          correlationId: c,
          snapshotId: snap.id
        });
        res.json(snap.toJSON());
      } catch (e) {
        this.log('error', 'Snapshot failed', {
          correlationId: c,
          error: e.message
        });
        res.status(500).json({
          error: e.message
        });
      }
    });
    this.app.post('/branch', (req, res) => {
      const c = cid(req);
      this.requestCount++;
      try {
        const branch = this.dag.fork(req.body.sourceBranchId || 'main', req.body.newBranchId);
        if (!branch) return res.status(404).json({
          error: 'Source branch not found'
        });
        this.log('info', 'Branch forked', {
          correlationId: c,
          branchId: branch.id
        });
        res.json(branch.toJSON());
      } catch (e) {
        this.log('error', 'Branch fork failed', {
          correlationId: c,
          error: e.message
        });
        res.status(500).json({
          error: e.message
        });
      }
    });
    this.app.post('/merge', (req, res) => {
      const c = cid(req);
      this.requestCount++;
      try {
        const result = this.dag.merge(req.body.branchIdA, req.body.branchIdB, req.body.targetBranchId);
        if (!result) return res.status(400).json({
          error: 'Merge failed — missing branches or snapshots'
        });
        if (result.error) return res.status(409).json(result);
        this.log('info', 'Branches merged', {
          correlationId: c,
          coherence: result.coherence
        });
        res.json({
          snapshot: result.snapshot.toJSON(),
          winner: result.winner,
          coherence: result.coherence,
          gate: result.gate
        });
      } catch (e) {
        this.log('error', 'Merge failed', {
          correlationId: c,
          error: e.message
        });
        res.status(500).json({
          error: e.message
        });
      }
    });
    this.app.post('/undo', (req, res) => {
      const c = cid(req);
      this.requestCount++;
      const branch = this.dag.branches.get(req.body.branchId || 'main');
      if (!branch) return res.status(404).json({
        error: 'Branch not found'
      });
      const sid = branch.undo();
      if (!sid) return res.status(400).json({
        error: 'Nothing to undo'
      });
      this.log('info', 'Undo performed', {
        correlationId: c,
        snapshotId: sid
      });
      const snap = this.dag.snapshots.get(sid);
      res.json({
        snapshot: snap ? snap.toJSON() : null,
        cursor: branch.cursor
      });
    });
    this.app.post('/redo', (req, res) => {
      const c = cid(req);
      this.requestCount++;
      const branch = this.dag.branches.get(req.body.branchId || 'main');
      if (!branch) return res.status(404).json({
        error: 'Branch not found'
      });
      const sid = branch.redo();
      if (!sid) return res.status(400).json({
        error: 'Nothing to redo'
      });
      this.log('info', 'Redo performed', {
        correlationId: c,
        snapshotId: sid
      });
      const snap = this.dag.snapshots.get(sid);
      res.json({
        snapshot: snap ? snap.toJSON() : null,
        cursor: branch.cursor
      });
    });
    this.app.get('/timeline/:id', (req, res) => {
      const b = this.dag.branches.get(req.params.id);
      b ? res.json(b.toJSON()) : res.status(404).json({
        error: 'Timeline not found'
      });
    });
    this.app.get('/timelines', (_req, res) => {
      const list = [...this.dag.branches.values()].map(b => b.toJSON());
      res.json({
        branches: list,
        count: list.length
      });
    });
    this.app.get('/snapshot/:id', (req, res) => {
      const s = this.dag.snapshots.get(req.params.id);
      s ? res.json(s.toJSON()) : res.status(404).json({
        error: 'Snapshot not found'
      });
    });
    this.app.post('/diff', (req, res) => {
      const c = cid(req);
      this.requestCount++;
      try {
        const {
          snapshotIdA,
          snapshotIdB
        } = req.body;
        const sA = this.dag.snapshots.get(snapshotIdA),
          sB = this.dag.snapshots.get(snapshotIdB);
        if (!sA || !sB) return res.status(404).json({
          error: 'Snapshot(s) not found'
        });
        const diff = DiffEngine.delta(sA, sB);
        this.log('info', 'Diff computed', {
          correlationId: c,
          distance: diff.distance
        });
        res.json({
          snapshotIdA,
          snapshotIdB,
          ...diff
        });
      } catch (e) {
        this.log('error', 'Diff failed', {
          correlationId: c,
          error: e.message
        });
        res.status(500).json({
          error: e.message
        });
      }
    });
  }
  health() {
    const coherence = this.dag.branches.size > 0 ? Math.min(CSL.HIGH, CSL.MED + this.dag.snapshots.size * PSI * 0.005) : CSL.LOW;
    return {
      status: coherence >= CSL.MIN ? 'healthy' : 'degraded',
      coherence: parseFloat(coherence.toFixed(4)),
      uptime: Date.now() - this.startTime,
      service: this.serviceName
    };
  }
  async init() {
    this.scheduler = new PhiScaledSnapshotScheduler((step, delay) => {
      this.dag.takeSnapshot('main', newVec((_, i) => Math.sin(i * PHI + step) * PSI), {
        scheduledStep: step,
        delay
      });
    });
    return new Promise(resolve => {
      this.server = this.app.listen(this.port, () => {
        this.log('info', `${this.serviceName} initialized`, {
          port: this.port,
          phi: PHI
        });
        resolve();
      });
    });
  }
  async execute(task) {
    const c = crypto.randomUUID();
    this.log('info', 'Executing time crystal task', {
      correlationId: c,
      type: task.type
    });
    if (task.type === 'snapshot') return this.dag.takeSnapshot(task.branchId || 'main', task.stateVector || newVec(() => Math.random() * PHI), task.metadata || {});
    if (task.type === 'fork') return this.dag.fork(task.sourceBranchId || 'main', task.newBranchId);
    if (task.type === 'merge') return this.dag.merge(task.branchIdA, task.branchIdB, task.targetBranchId);
    return {
      branches: this.dag.branches.size,
      snapshots: this.dag.snapshots.size
    };
  }
  async shutdown() {
    this.log('info', 'Shutting down time crystal service');
    if (this.scheduler) this.scheduler.stop();
    this.dag.snapshots.clear();
    this.dag.branches.clear();
    if (this.server) return new Promise(resolve => this.server.close(resolve));
  }
}
module.exports = {
  HeadyTimeCrystalService,
  TimelineDAG,
  TimelineBranch,
  StateSnapshot,
  DiffEngine,
  MergeResolver,
  PhiScaledSnapshotScheduler,
  CSL,
  PHI,
  PSI,
  FIB
};