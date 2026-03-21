/*
 * © 2026 Heady™Systems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══ LogicVisualizer — Real-Time Pipeline Execution Visualization — VIZ-01/02 ═══
 *
 * Tracks HCFullPipeline stage execution state, maintains a dependency graph
 * of the 21-stage cognitive pipeline, and provides snapshots + event streaming
 * for dashboard consumers.
 *
 * All numeric constants are phi-derived per LAW-07.
 */

'use strict';

const { EventEmitter } = require('events');
const { PHI, PSI, PHI_TIMING, fib, phiMs } = require('../shared/phi-math');

// ─── Phi-Scaled Constants ────────────────────────────────────────────────────
const MAX_HISTORY_SIZE = fib(8);            // 21 — one per stage, phi-compliant
const SNAPSHOT_DEBOUNCE_MS = phiMs(1);      // φ¹ × 1000 ≈ 1618ms
const METRICS_WINDOW_MS = PHI_TIMING.ERA;   // φ¹⁰ × 1000 ≈ 122992ms (~2 min)

// ─── 21-Stage Dependency Graph ───────────────────────────────────────────────
// Each stage lists its upstream dependencies (stages that must complete first).
const STAGE_DEPENDENCIES = Object.freeze({
    CHANNEL_ENTRY:     [],
    RECON:             ['CHANNEL_ENTRY'],
    INTAKE:            ['RECON'],
    MEMORY:            ['INTAKE'],
    TRIAGE:            ['MEMORY'],
    DECOMPOSE:         ['TRIAGE'],
    TRIAL_AND_ERROR:   ['DECOMPOSE'],
    ORCHESTRATE:       ['TRIAL_AND_ERROR'],
    MONTE_CARLO:       ['ORCHESTRATE'],
    ARENA:             ['ORCHESTRATE'],
    JUDGE:             ['ARENA'],
    APPROVE:           ['JUDGE'],
    EXECUTE:           ['APPROVE'],
    VERIFY:            ['EXECUTE'],
    SELF_AWARENESS:    ['VERIFY'],
    SELF_CRITIQUE:     ['SELF_AWARENESS'],
    MISTAKE_ANALYSIS:  ['SELF_CRITIQUE'],
    OPT_OPS:           ['MISTAKE_ANALYSIS'],
    CONTINUOUS_SEARCH: ['OPT_OPS'],
    EVOLUTION:         ['CONTINUOUS_SEARCH'],
    RECEIPT:           ['EVOLUTION'],
});

const STAGE_NAMES = Object.keys(STAGE_DEPENDENCIES);

class LogicVisualizer extends EventEmitter {
    constructor() {
        super();
        /** @type {Map<string, object>} runId -> execution state */
        this.activeRuns = new Map();
        /** @type {Array<object>} recent completed/failed runs */
        this.history = [];
        /** @type {Map<string, Array<object>>} stageName -> timing samples */
        this.stageMetrics = new Map();
        STAGE_NAMES.forEach(name => this.stageMetrics.set(name, []));
    }

    // ─── State Tracking ──────────────────────────────────────────────────────

    /**
     * Record that a pipeline run has been created/started.
     */
    trackRunStart(runId, request) {
        const state = {
            runId,
            status: 'running',
            startedAt: new Date().toISOString(),
            finishedAt: null,
            request: request || {},
            stages: {},
        };
        STAGE_NAMES.forEach(name => {
            state.stages[name] = {
                status: 'pending',
                startedAt: null,
                finishedAt: null,
                durationMs: null,
                result: null,
                error: null,
            };
        });
        this.activeRuns.set(runId, state);
        this._emitChange('run:tracked', { runId, status: 'running' });
    }

    /**
     * Record stage started.
     */
    trackStageStart(runId, stageName) {
        const run = this.activeRuns.get(runId);
        if (!run || !run.stages[stageName]) return;
        run.stages[stageName].status = 'running';
        run.stages[stageName].startedAt = new Date().toISOString();
        this._emitChange('stage:tracked', { runId, stage: stageName, status: 'running' });
    }

    /**
     * Record stage completed.
     */
    trackStageComplete(runId, stageName, result, metrics) {
        const run = this.activeRuns.get(runId);
        if (!run || !run.stages[stageName]) return;
        const stage = run.stages[stageName];
        stage.status = 'completed';
        stage.finishedAt = new Date().toISOString();
        stage.durationMs = metrics?.durationMs ?? null;
        stage.result = result ?? null;

        // Record metrics sample
        if (stage.durationMs !== null) {
            const samples = this.stageMetrics.get(stageName);
            samples.push({
                runId,
                durationMs: stage.durationMs,
                ts: Date.now(),
            });
            // Evict samples older than metrics window
            const cutoff = Date.now() - METRICS_WINDOW_MS;
            while (samples.length > 0 && samples[0].ts < cutoff) {
                samples.shift();
            }
        }

        this._emitChange('stage:tracked', { runId, stage: stageName, status: 'completed', durationMs: stage.durationMs });
    }

    /**
     * Record stage failed.
     */
    trackStageFailed(runId, stageName, error) {
        const run = this.activeRuns.get(runId);
        if (!run || !run.stages[stageName]) return;
        const stage = run.stages[stageName];
        stage.status = 'failed';
        stage.finishedAt = new Date().toISOString();
        stage.error = error || 'unknown';
        this._emitChange('stage:tracked', { runId, stage: stageName, status: 'failed', error: stage.error });
    }

    /**
     * Record stage skipped.
     */
    trackStageSkipped(runId, stageName) {
        const run = this.activeRuns.get(runId);
        if (!run || !run.stages[stageName]) return;
        run.stages[stageName].status = 'skipped';
        this._emitChange('stage:tracked', { runId, stage: stageName, status: 'skipped' });
    }

    /**
     * Record run completed.
     */
    trackRunComplete(runId) {
        const run = this.activeRuns.get(runId);
        if (!run) return;
        run.status = 'completed';
        run.finishedAt = new Date().toISOString();
        this._archiveRun(runId);
        this._emitChange('run:tracked', { runId, status: 'completed' });
    }

    /**
     * Record run failed.
     */
    trackRunFailed(runId, error) {
        const run = this.activeRuns.get(runId);
        if (!run) return;
        run.status = 'failed';
        run.finishedAt = new Date().toISOString();
        run.error = error;
        this._archiveRun(runId);
        this._emitChange('run:tracked', { runId, status: 'failed', error });
    }

    /**
     * Track a bee dispatch event from the conductor.
     */
    trackBeeDispatch(data) {
        this._emitChange('bee:dispatched', data);
    }

    // ─── Queries ─────────────────────────────────────────────────────────────

    /**
     * Current execution state snapshot — all active runs with their stage states.
     */
    getState() {
        const runs = {};
        for (const [runId, state] of this.activeRuns) {
            runs[runId] = state;
        }
        return {
            activeRunCount: this.activeRuns.size,
            runs,
            ts: new Date().toISOString(),
        };
    }

    /**
     * Stage dependency graph.
     */
    getGraph() {
        const nodes = STAGE_NAMES.map((name, i) => ({
            id: name,
            index: i,
            dependencies: STAGE_DEPENDENCIES[name],
        }));
        const edges = [];
        for (const [stage, deps] of Object.entries(STAGE_DEPENDENCIES)) {
            for (const dep of deps) {
                edges.push({ from: dep, to: stage });
            }
        }
        return { nodes, edges, stageCount: STAGE_NAMES.length };
    }

    /**
     * Recent execution history (completed/failed runs).
     */
    getHistory() {
        return {
            entries: this.history.slice(),
            count: this.history.length,
            maxSize: MAX_HISTORY_SIZE,
        };
    }

    /**
     * Timing metrics per stage — average, min, max, sample count.
     */
    getMetrics() {
        const metrics = {};
        for (const [stage, samples] of this.stageMetrics) {
            if (samples.length === 0) {
                metrics[stage] = { avgMs: 0, minMs: 0, maxMs: 0, sampleCount: 0 };
                continue;
            }
            const durations = samples.map(s => s.durationMs);
            const sum = durations.reduce((a, b) => a + b, 0);
            metrics[stage] = {
                avgMs: Math.round(sum / durations.length),
                minMs: Math.min(...durations),
                maxMs: Math.max(...durations),
                sampleCount: durations.length,
            };
        }
        return {
            stages: metrics,
            windowMs: METRICS_WINDOW_MS,
            ts: new Date().toISOString(),
        };
    }

    // ─── Internals ───────────────────────────────────────────────────────────

    _archiveRun(runId) {
        const run = this.activeRuns.get(runId);
        if (!run) return;
        this.history.push({ ...run });
        if (this.history.length > MAX_HISTORY_SIZE) {
            this.history.shift();
        }
        this.activeRuns.delete(runId);
    }

    _emitChange(event, data) {
        this.emit('change', { event, ...data, ts: new Date().toISOString() });
        this.emit(event, data);
    }
}

// ─── Exports ─────────────────────────────────────────────────────────────────
LogicVisualizer.STAGE_NAMES = STAGE_NAMES;
LogicVisualizer.STAGE_DEPENDENCIES = STAGE_DEPENDENCIES;
LogicVisualizer.MAX_HISTORY_SIZE = MAX_HISTORY_SIZE;

module.exports = LogicVisualizer;


// --- Auto-Unified Latent Service Pattern ---
if (module.exports && typeof module.exports === 'object') {
  if (!module.exports.start) module.exports.start = async () => ({ status: 'started' });
  if (!module.exports.stop) module.exports.stop = async () => ({ status: 'stopped' });
  if (!module.exports.health) module.exports.health = () => ({ status: 'healthy' });
  if (!module.exports.metrics) module.exports.metrics = () => ({ usages: 0 });
  if (!module.exports._tick) module.exports._tick = async () => {};
}
// -------------------------------------------
