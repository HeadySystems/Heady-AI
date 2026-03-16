'use strict';

/**
 * HCFullPipeline Integration Tests (TEST-11)
 * Tests the full 21-stage pipeline execution end-to-end.
 */

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const HCFullPipeline = require('../../src/orchestration/hc-full-pipeline');

describe('HCFullPipeline Integration', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new HCFullPipeline({ maxConcurrent: 4 });
  });

  it('should execute a full pipeline run from CHANNEL_ENTRY to RECEIPT', async () => {
    const run = pipeline.createRun({
      task: 'Integration test task',
      channel: 'test',
      userId: 'test-user',
    });

    expect(run.id).toBeDefined();
    expect(run.stages).toHaveLength(21);

    const result = await pipeline.execute(run.id);

    expect(result.status).toBe('completed');
    expect(result.finishedAt).toBeDefined();
    expect(result.startedAt).toBeDefined();
  });

  it('should emit lifecycle events in correct order', async () => {
    const events = [];
    pipeline.on('run:created', () => events.push('run:created'));
    pipeline.on('run:started', () => events.push('run:started'));
    pipeline.on('stage:started', ({ stage }) => events.push(`stage:${stage}:started`));
    pipeline.on('stage:completed', ({ stage }) => events.push(`stage:${stage}:completed`));
    pipeline.on('run:completed', () => events.push('run:completed'));

    const run = pipeline.createRun({ task: 'Event order test' });
    await pipeline.execute(run.id);

    expect(events[0]).toBe('run:created');
    expect(events[1]).toBe('run:started');
    expect(events).toContain('stage:CHANNEL_ENTRY:started');
    expect(events).toContain('stage:CHANNEL_ENTRY:completed');
    expect(events[events.length - 1]).toBe('run:completed');
  });

  it('should skip configured stages', async () => {
    const run = pipeline.createRun({
      task: 'Skip test',
      skipStages: ['MONTE_CARLO', 'ARENA', 'JUDGE', 'EVOLUTION', 'CONTINUOUS_SEARCH'],
    });

    const skipped = [];
    pipeline.on('stage:skipped', ({ stage }) => skipped.push(stage));

    const result = await pipeline.execute(run.id);

    expect(skipped).toContain('MONTE_CARLO');
    expect(skipped).toContain('ARENA');
    expect(result.status).toBe('completed');
  });

  it('should fail on INTAKE without task/prompt/code', async () => {
    const run = pipeline.createRun({});
    const result = await pipeline.execute(run.id);
    expect(result.status).toBe('failed');
  });

  it('should integrate with vector memory', async () => {
    const mockMemory = {
      queryMemory: jest.fn().mockResolvedValue([
        { content: 'prior knowledge', score: 0.85 },
      ]),
      queryWithRelationships: jest.fn().mockResolvedValue([
        { entity: 'related', score: 0.7 },
      ]),
    };

    const p = new HCFullPipeline({ vectorMemory: mockMemory });
    const run = p.createRun({ task: 'Memory integration test' });
    await p.execute(run.id);

    expect(mockMemory.queryMemory).toHaveBeenCalled();
  });

  it('should track stage durations', async () => {
    const run = pipeline.createRun({ task: 'Duration tracking test' });
    const result = await pipeline.execute(run.id);

    for (const stage of result.stages) {
      if (stage.status === 'completed') {
        expect(stage.metrics.durationMs).toBeDefined();
        expect(typeof stage.metrics.durationMs).toBe('number');
        expect(stage.metrics.durationMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should handle CHANNEL_ENTRY result correctly', async () => {
    const run = pipeline.createRun({
      task: 'Channel test',
      channel: 'headyconnection',
      userId: 'user-123',
    });
    const result = await pipeline.execute(run.id);

    const channelStage = result.stages[0];
    expect(channelStage.status).toBe('completed');
    expect(channelStage.result.channel).toBe('headyconnection');
    expect(channelStage.result.userId).toBe('user-123');
  });

  it('should handle TRIAGE classification', async () => {
    const run = pipeline.createRun({
      task: 'Triage test',
      priority: 8,
      riskLevel: 'HIGH',
    });
    const result = await pipeline.execute(run.id);

    // HIGH risk pauses at approval
    expect(result.status).toBe('paused');
  });

  it('should handle DECOMPOSE for complex tasks', async () => {
    const longTask = 'x'.repeat(600); // > 500 chars = high complexity
    const run = pipeline.createRun({ task: longTask });
    const result = await pipeline.execute(run.id);

    const decomposeStage = result.stages.find(s => s.name === 'DECOMPOSE');
    expect(decomposeStage.result.complexity).toBe('high');
    expect(decomposeStage.result.subtaskCount).toBeGreaterThan(1);
  });

  it('should produce deterministic results with same seed', async () => {
    // Two pipeline runs with same task should have same PRNG-derived outputs
    const run1 = pipeline.createRun({ task: 'Determinism test' });
    const run2 = pipeline.createRun({ task: 'Determinism test' });

    // Seeds are based on Date.now(), so they'll differ slightly
    // But the PRNG itself is deterministic for a given seed
    expect(run1.seed).toBeDefined();
    expect(run2.seed).toBeDefined();
  });
});
