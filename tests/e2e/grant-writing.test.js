import { vi } from "vitest";
'use strict';

/**
 * E2E: Grant Writing Pipeline (TEST-14)
 * Simulates a grant-writing task flowing through the full HCFullPipeline.
 */

vi.mock('../../src/utils/logger', () => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}));

const HCFullPipeline = require('../../src/orchestration/hc-full-pipeline');

describe('E2E: Grant Writing Pipeline', () => {
  it('should process a grant-writing task through all 21 stages', async () => {
    const pipeline = new HCFullPipeline();

    const run = pipeline.createRun({
      task: 'Write a grant proposal for a community technology initiative targeting underserved neighborhoods',
      taskType: 'grant-writing',
      channel: 'headyconnection',
      userId: 'nonprofit-partner-1',
      riskLevel: 'LOW',
      pipelineVariant: 'full_path',
    });

    const result = await pipeline.execute(run.id);

    expect(result.status).toBe('completed');
    expect(result.stages[0].result.channel).toBe('headyconnection');
    expect(result.stages[0].result.userId).toBe('nonprofit-partner-1');

    // All stages should be completed or skipped (none failed)
    for (const stage of result.stages) {
      expect(['completed', 'skipped']).toContain(stage.status);
    }

    // RECEIPT stage (last) should have completed
    const receiptStage = result.stages[20];
    expect(receiptStage.name).toBe('RECEIPT');
    expect(receiptStage.status).toBe('completed');
  });

  it('should process multi-step grant with task decomposition', async () => {
    const pipeline = new HCFullPipeline();

    // Long task triggers "high" complexity decomposition (must be >500 chars)
    const longTask = [
      'Research federal and state funding sources for community technology programs targeting underserved neighborhoods.',
      'Draft a comprehensive grant proposal with detailed budget breakdown, milestone timeline, and quantitative impact metrics.',
      'Review compliance requirements for HUD Community Development Block Grant including environmental review and fair housing.',
      'Prepare supporting documentation including letters of support from community partners and audited financial statements.',
      'Submit application via grants.gov portal, track application status, and prepare for site visit review process.',
      'Coordinate with local government partners on matching fund requirements and community benefit agreements.',
    ].join(' ');

    const run = pipeline.createRun({
      task: longTask,
      taskType: 'grant-writing',
      channel: 'api',
      userId: 'grant-writer',
    });

    const result = await pipeline.execute(run.id);
    expect(result.status).toBe('completed');

    // Verify decomposition detected high complexity
    const decomposeStage = result.stages.find(s => s.name === 'DECOMPOSE');
    expect(decomposeStage.result.complexity).toBe('high');
    expect(decomposeStage.result.subtaskCount).toBeGreaterThan(1);
  });

  it('should enrich grant context with vector memory when available', async () => {
    const mockMemory = {
      queryMemory: vi.fn().mockResolvedValue([
        { content: 'Previous grant for HeadyConnection tech access program', score: 0.92 },
        { content: 'HUD CDBG eligibility criteria', score: 0.87 },
      ]),
      queryWithRelationships: vi.fn().mockResolvedValue([
        { entity: 'Community Technology', relations: ['funding', 'nonprofit'] },
      ]),
    };

    const pipeline = new HCFullPipeline({ vectorMemory: mockMemory });
    const run = pipeline.createRun({
      task: 'Draft technology grant for HeadyConnection community partners',
      channel: 'headyconnection',
    });

    const result = await pipeline.execute(run.id);
    expect(result.status).toBe('completed');
    expect(mockMemory.queryMemory).toHaveBeenCalled();
  });

  it('should handle grant with arena competition', async () => {
    const pipeline = new HCFullPipeline();
    const run = pipeline.createRun({
      task: 'Compare approaches for NSF CISE grant application',
      arenaEnabled: true,
    });

    const result = await pipeline.execute(run.id);
    expect(result.status).toBe('completed');

    const arenaStage = result.stages.find(s => s.name === 'ARENA');
    if (arenaStage.status === 'completed') {
      expect(arenaStage.result.winner).toBeDefined();
      expect(arenaStage.result.entries).toBeDefined();
    }
  });

  it('should track full audit trail via RECEIPT', async () => {
    const pipeline = new HCFullPipeline();
    const run = pipeline.createRun({
      task: 'Generate audit-ready grant proposal for HeadyConnection',
      channel: 'headyconnection',
      userId: 'auditor',
    });

    const result = await pipeline.execute(run.id);

    // Verify all stages have timing data
    const completedStages = result.stages.filter(s => s.status === 'completed');
    expect(completedStages.length).toBeGreaterThan(10);

    for (const stage of completedStages) {
      expect(stage.startedAt).toBeDefined();
      expect(stage.finishedAt).toBeDefined();
    }
  });
});
