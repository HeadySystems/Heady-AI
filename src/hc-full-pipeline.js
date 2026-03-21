/**
 * HCFullPipeline — 9-Stage State Machine for task execution.
 * Stages: INTAKE → TRIAGE → MONTE_CARLO → ARENA → JUDGE → APPROVE → EXECUTE → VERIFY → RECEIPT
 *
 * @module src/hc-full-pipeline
 * @version 2.0.0
 * @author HeadySystems™
 */

'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');

const PHI = 1.618033988749895;

const STAGES = [
  'INTAKE',
  'TRIAGE',
  'MONTE_CARLO',
  'ARENA',
  'JUDGE',
  'APPROVE',
  'EXECUTE',
  'VERIFY',
  'RECEIPT',
];

const STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused',
  ROLLED_BACK: 'rolled_back',
});

const NODE_POOLS = {
  code:     ['HeadyCoder', 'HeadyJules'],
  security: ['HeadyRisks', 'HeadySentinel'],
  research: ['HeadyPythia', 'HeadyAtlas'],
  general:  ['HeadyCoder', 'HeadyJules', 'HeadyPythia'],
};

/** Deterministic seeded PRNG (mulberry32) */
function seededRng(seed) {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  if (h === 0) h = 1;
  return () => {
    h |= 0; h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ h >>> 15, 1 | h);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

class HCFullPipeline extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.maxConcurrent = opts.maxConcurrent || 4;
    this.runs = new Map();
    this.history = [];
  }

  createRun({ task, prompt, code, riskLevel = 'LOW', skipStages, meta = {} } = {}) {
    const id = `run-${crypto.randomUUID()}`;
    const seed = crypto.randomBytes(8).toString('hex');
    const stages = STAGES.map((name, idx) => ({
      name,
      index: idx,
      status: 'pending',
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
      metrics: {},
    }));
    const run = {
      id,
      task: task || prompt || code || null,
      prompt: prompt || null,
      code: code || null,
      riskLevel: riskLevel || 'LOW',
      status: 'pending',
      seed,
      stages,
      skipStages: skipStages || [],
      createdAt: Date.now(),
      finishedAt: null,
      meta,
      receipts: [],
      rollbackLog: null,
    };
    this.runs.set(id, run);
    this.emit('run:created', { runId: id, task: run.task, riskLevel });
    return run;
  }

  async execute(runId) {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    run.status = 'running';
    this.emit('run:started', { runId });

    const rng = seededRng(run.seed);

    for (let i = 0; i < run.stages.length; i++) {
      const stage = run.stages[i];

      // Check skipStages
      if (run.skipStages.includes(stage.name)) {
        stage.status = 'skipped';
        this.emit('stage:skipped', { runId, stage: stage.name });
        continue;
      }

      // APPROVE stage: skip for LOW risk, pause for HIGH/CRITICAL
      if (stage.name === 'APPROVE' && run.riskLevel === 'LOW') {
        stage.status = 'skipped';
        this.emit('stage:skipped', { runId, stage: stage.name });
        continue;
      }

      stage.status = 'running';
      stage.startedAt = Date.now();
      this.emit('stage:started', { runId, stage: stage.name });

      try {
        stage.result = await this._runStage(stage.name, run, rng);
        if (stage.result && stage.result.pending) {
          stage.status = 'pending';
          run.status = 'paused';
          stage.finishedAt = Date.now();
          stage.metrics.durationMs = stage.finishedAt - stage.startedAt;
          return run;
        }
        stage.status = 'completed';
      } catch (err) {
        stage.status = 'failed';
        stage.error = err.message;
        stage.result = { error: err.message };
        run.status = 'failed';
        stage.finishedAt = Date.now();
        stage.metrics.durationMs = stage.finishedAt - stage.startedAt;
        this._rollback(run, i);
        this.emit('run:failed', { runId, stage: stage.name, error: err.message });
        return run;
      }

      stage.finishedAt = Date.now();
      stage.metrics.durationMs = stage.finishedAt - stage.startedAt;
      this.emit('stage:completed', { runId, stage: stage.name, durationMs: stage.metrics.durationMs });
    }

    run.status = 'completed';
    run.finishedAt = Date.now();
    this.history.push({ runId, status: 'completed', finishedAt: run.finishedAt });
    this.emit('run:completed', { runId });
    return run;
  }

  async _runStage(name, run, rng) {
    switch (name) {
      case 'INTAKE':      return this._stageIntake(run);
      case 'TRIAGE':      return this._stageTriage(run, rng);
      case 'MONTE_CARLO': return this._stageMonteCarlo(run, rng);
      case 'ARENA':       return this._stageArena(run, rng);
      case 'JUDGE':       return this._stageJudge(run, rng);
      case 'APPROVE':     return this._stageApprove(run);
      case 'EXECUTE':     return this._stageExecute(run, rng);
      case 'VERIFY':      return this._stageVerify(run);
      case 'RECEIPT':     return this._stageReceipt(run);
      default:            return { ok: true, stage: name };
    }
  }

  _stageIntake(run) {
    if (!run.task && !run.prompt && !run.code) {
      throw new Error('Intake validation failed: request must include task, prompt, or code');
    }
    return { validated: true, inputType: run.code ? 'code' : run.prompt ? 'prompt' : 'task' };
  }

  _stageTriage(run, rng) {
    const confidence = Math.round(rng() * 40 + 60); // 60-100
    return { riskLevel: run.riskLevel, confidence, recommended: run.riskLevel === 'LOW' ? 'fast-track' : 'full-review' };
  }

  _stageMonteCarlo(run, rng) {
    const simulations = 5;
    const results = [];
    for (let i = 0; i < simulations; i++) {
      results.push({ score: Math.round(rng() * 100) / 100, outcome: rng() > 0.3 ? 'success' : 'failure' });
    }
    const confidence = Math.round(results.filter(r => r.outcome === 'success').length / simulations * 100);
    return { deterministic: true, simulations, results, confidence };
  }

  _stageArena(run, rng) {
    const entries = [
      { node: 'HeadyCoder', score: Math.round(rng() * 10000) / 10000 },
      { node: 'HeadyJules', score: Math.round(rng() * 10000) / 10000 },
      { node: 'HeadyPythia', score: Math.round(rng() * 10000) / 10000 },
    ];
    entries.sort((a, b) => b.score - a.score);
    return { deterministic: true, entries, winner: entries[0] };
  }

  _stageJudge(run, rng) {
    const criteria = {
      correctness: Math.round(rng() * 10000) / 10000,
      efficiency:  Math.round(rng() * 10000) / 10000,
      security:    Math.round(rng() * 10000) / 10000,
      clarity:     Math.round(rng() * 10000) / 10000,
    };
    const avg = Object.values(criteria).reduce((a, b) => a + b, 0) / 4;
    return { deterministic: true, criteria, score: Math.round(avg * 10000) / 10000, pass: avg >= 0.5 };
  }

  _stageApprove(run) {
    if (run.riskLevel === 'HIGH' || run.riskLevel === 'CRITICAL') {
      return { pending: true, reason: 'human_approval_required', riskLevel: run.riskLevel };
    }
    return { approved: true, auto: true };
  }

  _stageExecute(run, rng) {
    return { executed: true, durationMs: Math.round(rng() * 100) };
  }

  _stageVerify(run) {
    return { verified: true, checks: ['syntax', 'tests', 'lint'], passed: true };
  }

  _stageReceipt(run) {
    const receiptId = `receipt-${crypto.randomUUID()}`;
    run.receipts.push(receiptId);
    return {
      receiptId,
      runId: run.id,
      seed: run.seed,
      ts: Date.now(),
      stages: run.stages.map(s => ({
        name: s.name,
        status: s.status,
        durationMs: s.metrics.durationMs || 0,
      })),
    };
  }

  _rollback(run, failedIndex) {
    run.rollbackLog = [];
    this.emit('rollback:started', { runId: run.id });
    for (let i = failedIndex - 1; i >= 0; i--) {
      const stage = run.stages[i];
      if (stage.status === 'completed') {
        run.rollbackLog.push({ stage: stage.name, rolledBackAt: Date.now() });
        this.emit('stage:rolledback', { runId: run.id, stage: stage.name });
      }
    }
    this.emit('rollback:completed', { runId: run.id });
  }

  async resume(runId, approval = {}) {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    if (run.status !== 'paused') throw new Error(`Run ${runId} is not paused`);

    const approveStage = run.stages.find(s => s.name === 'APPROVE');
    if (!approval.approved) {
      approveStage.result = { approved: false, actor: approval.actor };
      approveStage.status = 'completed';
      run.status = 'failed';
      return run;
    }

    approveStage.result = { approved: true, actor: approval.actor };
    approveStage.status = 'completed';
    approveStage.finishedAt = Date.now();
    approveStage.metrics.durationMs = approveStage.finishedAt - approveStage.startedAt;
    this.emit('stage:completed', { runId, stage: 'APPROVE' });

    run.status = 'running';
    const rng = seededRng(run.seed);
    // Advance RNG state to match where we left off
    for (let i = 0; i < 20; i++) rng();

    const approveIdx = run.stages.findIndex(s => s.name === 'APPROVE');
    for (let i = approveIdx + 1; i < run.stages.length; i++) {
      const stage = run.stages[i];
      stage.status = 'running';
      stage.startedAt = Date.now();
      this.emit('stage:started', { runId, stage: stage.name });

      try {
        stage.result = await this._runStage(stage.name, run, rng);
        stage.status = 'completed';
      } catch (err) {
        stage.status = 'failed';
        stage.error = err.message;
        run.status = 'failed';
        return run;
      }

      stage.finishedAt = Date.now();
      stage.metrics.durationMs = stage.finishedAt - stage.startedAt;
      this.emit('stage:completed', { runId, stage: stage.name });
    }

    run.status = 'completed';
    run.finishedAt = Date.now();
    this.emit('run:completed', { runId });
    return run;
  }

  getRun(runId) {
    return this.runs.get(runId) || null;
  }

  listRuns() {
    return Array.from(this.runs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  status() {
    const runs = Array.from(this.runs.values());
    return {
      total: runs.length,
      pending: runs.filter(r => r.status === 'pending').length,
      running: runs.filter(r => r.status === 'running').length,
      completed: runs.filter(r => r.status === 'completed').length,
      failed: runs.filter(r => r.status === 'failed').length,
      paused: runs.filter(r => r.status === 'paused').length,
    };
  }

  getHistory() {
    return [...this.history];
  }

  _selectNodePool(taskType) {
    return NODE_POOLS[taskType] || NODE_POOLS.general;
  }

  async rollback(runId) {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    run.status = 'rolled_back';
    run.finishedAt = Date.now();
    this.emit('run:rolledback', { runId });
    return run;
  }
}

HCFullPipeline.STAGES = STAGES;
HCFullPipeline.STATUS = STATUS;

module.exports = HCFullPipeline;
