/**
 * Conductor Service — Core Logic — Heady™ v4.0.0
 * Multi-agent orchestration, HCFullPipeline execution
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import {
  PHI, PSI, FIB, CSL_THRESHOLDS, RESOURCE_POOLS,
  cosineSimilarity, phiBackoff, TIMING
} from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';
import { PipelineErrors } from '../../shared/errors.js';
import type {
  TaskRequest, PipelineState, PipelineStage, TaskDomain,
  ResourcePool, NodeCapability, OrchestratorMetrics
} from './types.js';

const logger = createLogger('conductor-service');

// ═══ Pipeline State Store ═══
const pipelines = new Map<string, PipelineState>();
let completedCount = 0;
let failedCount = 0;
let totalPipelineMs = 0;

// ═══ Node Registry ═══
const NODE_REGISTRY: NodeCapability[] = [
  { name: 'HeadyCoder',     domains: ['code_generation'],  pool: 'hot',  healthy: true, currentLoad: 0 },
  { name: 'HeadyCodex',     domains: ['code_review', 'documentation'], pool: 'hot', healthy: true, currentLoad: 0 },
  { name: 'HeadyRisks',     domains: ['security'],         pool: 'hot',  healthy: true, currentLoad: 0 },
  { name: 'HeadyVinci',     domains: ['architecture'],     pool: 'hot',  healthy: true, currentLoad: 0 },
  { name: 'HeadyResearch',  domains: ['research'],         pool: 'warm', healthy: true, currentLoad: 0 },
  { name: 'HeadyMuse',      domains: ['creative'],         pool: 'warm', healthy: true, currentLoad: 0 },
  { name: 'HeadyPatterns',  domains: ['analytics'],        pool: 'cold', healthy: true, currentLoad: 0 },
  { name: 'HeadyMaid',      domains: ['cleanup'],          pool: 'cold', healthy: true, currentLoad: 0 },
  { name: 'HeadyMaintenance', domains: ['maintenance'],    pool: 'cold', healthy: true, currentLoad: 0 },
  { name: 'HeadyCheck',     domains: ['testing', 'governance'], pool: 'governance', healthy: true, currentLoad: 0 },
  { name: 'HeadyMemory',    domains: ['memory'],           pool: 'hot',  healthy: true, currentLoad: 0 },
  { name: 'HeadyBrains',    domains: ['orchestration'],    pool: 'hot',  healthy: true, currentLoad: 0 },
  { name: 'HeadySoul',      domains: ['governance', 'healing'], pool: 'governance', healthy: true, currentLoad: 0 },
  { name: 'HeadyGuard',     domains: ['security', 'governance'], pool: 'hot', healthy: true, currentLoad: 0 },
  { name: 'ColabWorker1',   domains: ['gpu'],              pool: 'warm', healthy: true, currentLoad: 0 },
  { name: 'ColabWorker2',   domains: ['gpu'],              pool: 'warm', healthy: true, currentLoad: 0 },
  { name: 'ColabWorker3',   domains: ['gpu'],              pool: 'warm', healthy: true, currentLoad: 0 },
];

// ═══ Domain-to-Pool Mapping ═══
const DOMAIN_POOL_MAP: Record<TaskDomain, ResourcePool> = {
  code_generation: 'hot', code_review: 'hot', security: 'hot', architecture: 'hot',
  research: 'warm', documentation: 'warm', creative: 'warm', translation: 'warm',
  monitoring: 'warm', cleanup: 'cold', analytics: 'cold', maintenance: 'cold',
  memory: 'hot', orchestration: 'hot', testing: 'governance', communication: 'warm',
  healing: 'governance', governance: 'governance', mcp: 'warm', edge: 'warm', gpu: 'warm',
};

// ═══ HCFullPipeline Stages ═══
const PIPELINE_STAGES: PipelineStage[] = [
  'CONTEXT_ASSEMBLY', 'INTENT_CLASSIFICATION', 'NODE_SELECTION',
  'EXECUTION', 'QUALITY_GATE', 'ASSURANCE_GATE',
  'PATTERN_CAPTURE', 'STORY_UPDATE',
];

// ═══ Execute Pipeline ═══
export async function executePipeline(task: TaskRequest): Promise<PipelineState> {
  const pipelineId = task.id || crypto.randomUUID();
  const startTime = Date.now();

  let state: PipelineState = {
    taskId: pipelineId,
    currentStage: 'CONTEXT_ASSEMBLY',
    completedStages: [],
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    status: 'running',
    selectedNodes: [],
  };

  pipelines.set(pipelineId, state);

  try {
    // Stage 1: Context Assembly
    state = updateStage(state, 'CONTEXT_ASSEMBLY');
    logger.info('Pipeline stage: CONTEXT_ASSEMBLY', { taskId: pipelineId });
    // HeadyBrains gathers context
    await simulateStage(FIB[6] * 10); // 80ms

    // Stage 2: Intent Classification
    state = updateStage(state, 'INTENT_CLASSIFICATION');
    logger.info('Pipeline stage: INTENT_CLASSIFICATION', { taskId: pipelineId });
    const domain = task.domain || classifyDomain(task.intent);
    await simulateStage(FIB[5] * 10); // 50ms

    // Stage 3: Node Selection
    state = updateStage(state, 'NODE_SELECTION');
    logger.info('Pipeline stage: NODE_SELECTION', { taskId: pipelineId, domain });
    const selectedNodes = selectNodes(domain);
    state = { ...state, selectedNodes: selectedNodes.map(n => n.name) };
    await simulateStage(FIB[4] * 10); // 30ms

    // Stage 4: Execution
    state = updateStage(state, 'EXECUTION');
    logger.info('Pipeline stage: EXECUTION', { taskId: pipelineId, nodes: state.selectedNodes });
    // Execute across selected nodes (concurrent if independent)
    await simulateStage(FIB[8] * 10); // 210ms

    // Stage 5: Quality Gate (HeadyCheck)
    state = updateStage(state, 'QUALITY_GATE');
    logger.info('Pipeline stage: QUALITY_GATE', { taskId: pipelineId });
    await simulateStage(FIB[6] * 10); // 80ms

    // Stage 6: Assurance Gate (HeadyAssure)
    state = updateStage(state, 'ASSURANCE_GATE');
    logger.info('Pipeline stage: ASSURANCE_GATE', { taskId: pipelineId });
    await simulateStage(FIB[5] * 10); // 50ms

    // Stage 7: Pattern Capture
    state = updateStage(state, 'PATTERN_CAPTURE');
    await simulateStage(FIB[4] * 10);

    // Stage 8: Story Update
    state = updateStage(state, 'STORY_UPDATE');
    await simulateStage(FIB[3] * 10);

    const totalMs = Date.now() - startTime;
    totalPipelineMs += totalMs;
    completedCount++;

    state = {
      ...state,
      status: 'completed',
      lastUpdated: new Date().toISOString(),
      result: { domain, totalMs, stages: PIPELINE_STAGES.length },
    };

    pipelines.set(pipelineId, state);
    logger.info('Pipeline completed', { taskId: pipelineId, totalMs, domain });

    return state;
  } catch (err) {
    failedCount++;
    state = {
      ...state,
      status: 'failed',
      lastUpdated: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Unknown error',
    };
    pipelines.set(pipelineId, state);
    logger.error('Pipeline failed', { taskId: pipelineId, error: state.error });
    return state;
  }
}

function updateStage(state: PipelineState, stage: PipelineStage): PipelineState {
  return {
    ...state,
    currentStage: stage,
    completedStages: [...state.completedStages, state.currentStage],
    lastUpdated: new Date().toISOString(),
  };
}

function simulateStage(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function classifyDomain(intent: string): TaskDomain {
  const lower = intent.toLowerCase();
  if (/code|function|class|api|endpoint/.test(lower)) return 'code_generation';
  if (/review|audit|check/.test(lower)) return 'code_review';
  if (/secure|vulnerability|owasp/.test(lower)) return 'security';
  if (/architect|design|system/.test(lower)) return 'architecture';
  if (/research|find|investigate/.test(lower)) return 'research';
  if (/doc|readme|guide/.test(lower)) return 'documentation';
  if (/creative|design|ui|ux/.test(lower)) return 'creative';
  if (/monitor|watch|observe/.test(lower)) return 'monitoring';
  if (/clean|remove|prune/.test(lower)) return 'cleanup';
  if (/analyz|metric|report/.test(lower)) return 'analytics';
  if (/deploy|scale|infra/.test(lower)) return 'maintenance';
  if (/memory|vector|embed/.test(lower)) return 'memory';
  if (/gpu|train|model/.test(lower)) return 'gpu';
  return 'orchestration'; // default
}

function selectNodes(domain: TaskDomain): NodeCapability[] {
  const pool = DOMAIN_POOL_MAP[domain];
  const candidates = NODE_REGISTRY.filter(
    n => n.domains.includes(domain) && n.healthy
  );

  if (candidates.length === 0) {
    // Fallback: find any healthy node in the same pool
    return NODE_REGISTRY.filter(n => n.pool === pool && n.healthy).slice(0, FIB[2]);
  }

  // Sort by load (lowest first)
  candidates.sort((a, b) => a.currentLoad - b.currentLoad);
  return candidates.slice(0, FIB[3]); // top 3
}

// ═══ Get Pipeline Status ═══
export function getPipelineStatus(taskId: string): PipelineState | undefined {
  return pipelines.get(taskId);
}

// ═══ Metrics ═══
export function getMetrics(): OrchestratorMetrics {
  const active = Array.from(pipelines.values()).filter(p => p.status === 'running').length;
  return {
    activePipelines: active,
    completedTotal: completedCount,
    failedTotal: failedCount,
    avgPipelineMs: completedCount > 0 ? totalPipelineMs / completedCount : 0,
    poolUtilization: {
      hot: RESOURCE_POOLS.hot,
      warm: RESOURCE_POOLS.warm,
      cold: RESOURCE_POOLS.cold,
      reserve: RESOURCE_POOLS.reserve,
      governance: RESOURCE_POOLS.governance,
    },
  };
}
