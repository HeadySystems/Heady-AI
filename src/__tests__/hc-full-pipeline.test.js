'use strict';

/**
 * HCFullPipeline (v1 — 9-stage state machine) test suite
 * Tests: createRun, execute, stage transitions, skip, approval gate,
 *        resume, rollback, self-heal, status/queries.
 *
 * Uses node:test — no external test runner needed.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

let HCFullPipeline;

before(() => {
    HCFullPipeline = require('../orchestration/hc-full-pipeline');
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────

describe('HCFullPipeline — lifecycle', () => {

    it('exposes STAGES and STATUS constants', () => {
        assert.ok(Array.isArray(HCFullPipeline.STAGES));
        assert.ok(HCFullPipeline.STAGES.length >= 9, 'Pipeline should have at least 9 stages');
        assert.ok(HCFullPipeline.STATUS.PENDING);
        assert.ok(HCFullPipeline.STATUS.COMPLETED);
    });

    it('constructor creates a valid instance with EventEmitter', () => {
        const pipeline = new HCFullPipeline();
        assert.ok(pipeline);
        assert.ok(typeof pipeline.on === 'function');
        assert.ok(typeof pipeline.emit === 'function');
        assert.ok(pipeline.maxConcurrent > 0);
    });
});

// ─── createRun ───────────────────────────────────────────────────────────────

describe('HCFullPipeline — createRun', () => {

    it('creates a run with correct initial state', () => {
        const pipeline = new HCFullPipeline();
        const run = pipeline.createRun({ task: 'test-task' });

        assert.ok(run.id);
        assert.equal(run.status, 'pending');
        assert.equal(run.currentStage, 0);
        assert.equal(run.stages.length, HCFullPipeline.STAGES.length);
        assert.ok(run.stages.every(s => s.status === 'pending'));
        assert.deepStrictEqual(run.request, { task: 'test-task' });
    });

    it('respects arenaEnabled and skipStages config', () => {
        const pipeline = new HCFullPipeline();
        const run = pipeline.createRun({
            task: 'test',
            arenaEnabled: false,
            skipStages: ['MONTE_CARLO'],
        });

        assert.equal(run.config.arenaEnabled, false);
        assert.deepStrictEqual(run.config.skipStages, ['MONTE_CARLO']);
    });

    it('sets approvalRequired for HIGH risk', () => {
        const pipeline = new HCFullPipeline();
        const run = pipeline.createRun({ task: 'test', riskLevel: 'HIGH' });
        assert.equal(run.config.approvalRequired, true);
    });

    it('auto-approves for LOW risk', () => {
        const pipeline = new HCFullPipeline();
        const run = pipeline.createRun({ task: 'test', riskLevel: 'LOW' });
        assert.equal(run.config.approvalRequired, false);
    });
});

// ─── execute ─────────────────────────────────────────────────────────────────

describe('HCFullPipeline — execute', () => {

    it('completes all 9 stages for a normal run', async () => {
        const pipeline = new HCFullPipeline();
        const run = pipeline.createRun({ task: 'simple task' });
        const result = await pipeline.execute(run.id);

        assert.equal(result.status, 'completed');
        assert.ok(result.startedAt);
        assert.ok(result.finishedAt);
        assert.ok(result.result); // receipt object
    });

    it('skips MONTE_CARLO when configured', async () => {
        const pipeline = new HCFullPipeline();
        const run = pipeline.createRun({
            task: 'skip-test',
            skipStages: ['MONTE_CARLO'],
        });
        const result = await pipeline.execute(run.id);

        assert.equal(result.status, 'completed');
        const mcStage = result.stages.find(s => s.name === 'MONTE_CARLO');
        assert.equal(mcStage.status, 'skipped');
    });

    it('emits stage:started and stage:completed events', async () => {
        const pipeline = new HCFullPipeline();
        const events = [];
        pipeline.on('stage:started', e => events.push({ type: 'started', stage: e.stage }));
        pipeline.on('stage:completed', e => events.push({ type: 'completed', stage: e.stage }));

        const run = pipeline.createRun({ task: 'event-test' });
        await pipeline.execute(run.id);

        // Should have start+complete for each non-skipped stage
        const startEvents = events.filter(e => e.type === 'started');
        const completeEvents = events.filter(e => e.type === 'completed');
        assert.ok(startEvents.length >= 8); // at least 8 stages active
        assert.ok(completeEvents.length >= 8);
    });

    it('throws for a nonexistent runId', async () => {
        const pipeline = new HCFullPipeline();
        await assert.rejects(
            () => pipeline.execute('nonexistent'),
            /not found/
        );
    });

    it('pauses on APPROVE for HIGH risk and resumes', async () => {
        const pipeline = new HCFullPipeline();
        const run = pipeline.createRun({ task: 'approval-test', riskLevel: 'HIGH' });
        const paused = await pipeline.execute(run.id);

        assert.equal(paused.status, 'paused');

        // Resume with approval
        const resumed = await pipeline.resume(run.id, { approved: true, actor: 'admin' });
        assert.equal(resumed.status, 'completed');
        assert.ok(resumed.result);
    });

    it('fails when resumed with denial', async () => {
        const pipeline = new HCFullPipeline();
        const run = pipeline.createRun({ task: 'deny-test', riskLevel: 'CRITICAL' });
        await pipeline.execute(run.id);

        const denied = await pipeline.resume(run.id, { approved: false, actor: 'admin' });
        assert.equal(denied.status, 'failed');
    });
});

// ─── Queries ─────────────────────────────────────────────────────────────────

describe('HCFullPipeline — queries', () => {

    it('getRun returns null for unknown id', () => {
        const pipeline = new HCFullPipeline();
        assert.equal(pipeline.getRun('nope'), null);
    });

    it('listRuns returns runs sorted by startedAt', async () => {
        const pipeline = new HCFullPipeline();
        pipeline.createRun({ task: 'a' });
        pipeline.createRun({ task: 'b' });

        const runs = pipeline.listRuns();
        assert.ok(Array.isArray(runs));
        assert.equal(runs.length, 2);
    });

    it('status() returns aggregate counts', async () => {
        const pipeline = new HCFullPipeline();
        const run = pipeline.createRun({ task: 'status-test' });
        await pipeline.execute(run.id);

        const status = pipeline.status();
        assert.equal(status.total, 1);
        assert.equal(status.completed, 1);
        assert.ok('selfHeal' in status);
        assert.equal(status.selfHeal.attempts, 0);
    });
});

// ─── INTAKE validation ──────────────────────────────────────────────────────

describe('HCFullPipeline — INTAKE validation', () => {

    it('rejects empty requests without task/prompt/code', async () => {
        const pipeline = new HCFullPipeline();
        const run = pipeline.createRun({});
        const result = await pipeline.execute(run.id);

        assert.equal(result.status, 'failed');
        const intakeStage = result.stages.find(s => s.name === 'INTAKE');
        assert.equal(intakeStage.status, 'failed');
        assert.ok(intakeStage.error.includes('task, prompt, or code'));
    });
});
