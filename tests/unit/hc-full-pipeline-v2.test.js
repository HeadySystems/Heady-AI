'use strict';

/**
 * HCFullPipeline v2 Unit Tests (TEST-03)
 */

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const HCFullPipeline = require('../../src/orchestration/hc-full-pipeline');

describe('HCFullPipeline', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new HCFullPipeline({ maxConcurrent: 4 });
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const p = new HCFullPipeline();
      expect(p.maxConcurrent).toBeGreaterThanOrEqual(4);
      expect(p.runs).toBeInstanceOf(Map);
    });

    it('should accept custom maxConcurrent', () => {
      const p = new HCFullPipeline({ maxConcurrent: 8 });
      expect(p.maxConcurrent).toBe(8);
    });

    it('should accept optional dependencies', () => {
      const mc = {};
      const sa = { ingestTelemetry: jest.fn() };
      const p = new HCFullPipeline({ monteCarlo: mc, selfAwareness: sa });
      expect(p.monteCarlo).toBe(mc);
      expect(p.selfAwareness).toBe(sa);
    });
  });

  describe('createRun', () => {
    it('should create a valid run object', () => {
      const run = pipeline.createRun({ task: 'Test task' });
      expect(run.id).toBeDefined();
      expect(run.status).toBe('pending');
      expect(run.stages).toHaveLength(21);
      expect(run.request.task).toBe('Test task');
    });

    it('should initialize all 21 stages as pending', () => {
      const run = pipeline.createRun({ task: 'test' });
      expect(run.stages.every(s => s.status === 'pending')).toBe(true);
    });

    it('should include correct stage names', () => {
      const run = pipeline.createRun({ task: 'test' });
      const names = run.stages.map(s => s.name);
      expect(names[0]).toBe('CHANNEL_ENTRY');
      expect(names[20]).toBe('RECEIPT');
      expect(names).toContain('INTAKE');
      expect(names).toContain('TRIAGE');
      expect(names).toContain('DECOMPOSE');
      expect(names).toContain('ORCHESTRATE');
      expect(names).toContain('ARENA');
      expect(names).toContain('JUDGE');
      expect(names).toContain('EXECUTE');
      expect(names).toContain('SELF_AWARENESS');
    });

    it('should store run in runs map', () => {
      const run = pipeline.createRun({ task: 'test' });
      expect(pipeline.runs.get(run.id)).toBe(run);
    });

    it('should emit run:created event', () => {
      const handler = jest.fn();
      pipeline.on('run:created', handler);
      pipeline.createRun({ task: 'test' });
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        runId: expect.any(String),
      }));
    });

    it('should configure arena based on request', () => {
      const run = pipeline.createRun({ task: 'test', arenaEnabled: false });
      expect(run.config.arenaEnabled).toBe(false);
    });

    it('should require approval for HIGH risk', () => {
      const run = pipeline.createRun({ task: 'test', riskLevel: 'HIGH' });
      expect(run.config.approvalRequired).toBe(true);
    });

    it('should support skipStages', () => {
      const run = pipeline.createRun({ task: 'test', skipStages: ['ARENA', 'EVOLUTION'] });
      expect(run.config.skipStages).toEqual(['ARENA', 'EVOLUTION']);
    });
  });

  describe('execute', () => {
    it('should execute a full pipeline run', async () => {
      const run = pipeline.createRun({ task: 'Test execution' });
      const result = await pipeline.execute(run.id);
      expect(result.status).toBe('completed');
      expect(result.startedAt).toBeDefined();
      expect(result.finishedAt).toBeDefined();
    });

    it('should process stages in order', async () => {
      const stageOrder = [];
      pipeline.on('stage:started', ({ stage }) => stageOrder.push(stage));
      const run = pipeline.createRun({ task: 'Order test' });
      await pipeline.execute(run.id);
      expect(stageOrder[0]).toBe('CHANNEL_ENTRY');
      expect(stageOrder.indexOf('INTAKE')).toBeLessThan(stageOrder.indexOf('TRIAGE'));
      expect(stageOrder.indexOf('TRIAGE')).toBeLessThan(stageOrder.indexOf('DECOMPOSE'));
    });

    it('should skip stages when configured', async () => {
      const run = pipeline.createRun({
        task: 'Skip test',
        skipStages: ['MONTE_CARLO', 'ARENA', 'JUDGE', 'EVOLUTION', 'CONTINUOUS_SEARCH'],
      });
      const result = await pipeline.execute(run.id);
      const mcStage = result.stages.find(s => s.name === 'MONTE_CARLO');
      expect(mcStage.status).toBe('skipped');
      expect(result.status).toBe('completed');
    });

    it('should fail on INTAKE without task/prompt/code', async () => {
      const run = pipeline.createRun({});
      const result = await pipeline.execute(run.id);
      expect(result.status).toBe('failed');
    });

    it('should throw on unknown runId', async () => {
      await expect(pipeline.execute('nonexistent')).rejects.toThrow('not found');
    });

    it('should emit run lifecycle events', async () => {
      const events = [];
      pipeline.on('run:started', () => events.push('started'));
      pipeline.on('run:completed', () => events.push('completed'));
      const run = pipeline.createRun({ task: 'event test' });
      await pipeline.execute(run.id);
      expect(events).toContain('started');
      expect(events).toContain('completed');
    });

    it('should emit stage events', async () => {
      const completed = [];
      pipeline.on('stage:completed', ({ stage }) => completed.push(stage));
      const run = pipeline.createRun({ task: 'stage event test' });
      await pipeline.execute(run.id);
      expect(completed).toContain('CHANNEL_ENTRY');
      expect(completed).toContain('RECEIPT');
    });

    it('should track stage durations', async () => {
      const run = pipeline.createRun({ task: 'duration test' });
      const result = await pipeline.execute(run.id);
      const completedStages = result.stages.filter(s => s.status === 'completed');
      for (const stage of completedStages) {
        expect(stage.metrics.durationMs).toBeDefined();
        expect(typeof stage.metrics.durationMs).toBe('number');
      }
    });

    it('should pause on HIGH risk approval gate', async () => {
      const run = pipeline.createRun({
        task: 'risky task',
        riskLevel: 'HIGH',
      });
      const result = await pipeline.execute(run.id);
      expect(result.status).toBe('paused');
    });
  });

  describe('Deterministic PRNG', () => {
    it('should produce same results for same seed', () => {
      const rng1 = pipeline._createSeededRng(42);
      const rng2 = pipeline._createSeededRng(42);
      const seq1 = Array.from({ length: 10 }, () => rng1());
      const seq2 = Array.from({ length: 10 }, () => rng2());
      expect(seq1).toEqual(seq2);
    });

    it('should produce different results for different seeds', () => {
      const rng1 = pipeline._createSeededRng(42);
      const rng2 = pipeline._createSeededRng(99);
      expect(rng1()).not.toBe(rng2());
    });

    it('should produce values in [0, 1)', () => {
      const rng = pipeline._createSeededRng(12345);
      for (let i = 0; i < 1000; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('Self-Awareness Telemetry Wiring', () => {
    it('should wire telemetry when selfAwareness is provided', async () => {
      const sa = {
        ingestTelemetry: jest.fn().mockResolvedValue(undefined),
      };
      const p = new HCFullPipeline({ selfAwareness: sa });
      const run = p.createRun({ task: 'telemetry test' });
      await p.execute(run.id);
      expect(sa.ingestTelemetry).toHaveBeenCalled();
    });
  });

  describe('Vector Memory Integration', () => {
    it('should query vector memory in INTAKE stage', async () => {
      const mockMemory = {
        queryMemory: jest.fn().mockResolvedValue([
          { content: 'relevant context', score: 0.9 },
        ]),
      };
      const p = new HCFullPipeline({ vectorMemory: mockMemory });
      const run = p.createRun({ task: 'memory test' });
      await p.execute(run.id);
      expect(mockMemory.queryMemory).toHaveBeenCalled();
    });
  });
});
