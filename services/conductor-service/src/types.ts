/**
 * Conductor Service Types — Heady™ v4.0.0
 * HCFullPipeline, multi-agent orchestration, task routing
 */

export type PipelineStage =
  | 'CONTEXT_ASSEMBLY'
  | 'INTENT_CLASSIFICATION'
  | 'NODE_SELECTION'
  | 'EXECUTION'
  | 'QUALITY_GATE'
  | 'ASSURANCE_GATE'
  | 'PATTERN_CAPTURE'
  | 'STORY_UPDATE';

export type TaskDomain =
  | 'code_generation' | 'code_review' | 'security' | 'architecture'
  | 'research' | 'documentation' | 'creative' | 'translation'
  | 'monitoring' | 'cleanup' | 'analytics' | 'maintenance'
  | 'memory' | 'orchestration' | 'testing' | 'communication'
  | 'healing' | 'governance' | 'mcp' | 'edge' | 'gpu';

export type ResourcePool = 'hot' | 'warm' | 'cold' | 'reserve' | 'governance';

export interface TaskRequest {
  readonly id: string;
  readonly intent: string;
  readonly domain?: TaskDomain;
  readonly embedding?: number[];
  readonly context?: Record<string, unknown>;
  readonly userId?: string;
  readonly priority?: ResourcePool;
}

export interface PipelineState {
  readonly taskId: string;
  readonly currentStage: PipelineStage;
  readonly completedStages: PipelineStage[];
  readonly startedAt: string;
  readonly lastUpdated: string;
  readonly status: 'running' | 'completed' | 'failed' | 'cancelled';
  readonly selectedNodes: string[];
  readonly result?: unknown;
  readonly error?: string;
}

export interface NodeCapability {
  readonly name: string;
  readonly domains: TaskDomain[];
  readonly pool: ResourcePool;
  readonly healthy: boolean;
  readonly currentLoad: number;
}

export interface OrchestratorMetrics {
  readonly activePipelines: number;
  readonly completedTotal: number;
  readonly failedTotal: number;
  readonly avgPipelineMs: number;
  readonly poolUtilization: Record<ResourcePool, number>;
}
