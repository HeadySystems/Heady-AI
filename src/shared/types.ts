/**
 * Heady™ Master Type Definitions v4.0.0
 * Central type registry for the entire Heady ecosystem
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

// ═══ φ-Derived Numeric Types ═══
export type PhiLevel = 0 | 1 | 2 | 3 | 4;
export type FibIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19;

// ═══ Resource Pools ═══
export type ResourcePool = 'hot' | 'warm' | 'cold' | 'reserve' | 'governance';

// ═══ Service Identity ═══
export interface ServiceIdentity {
  name: string;
  version: string;
  port: number;
  pool: ResourcePool;
  healthEndpoint: string;
}

// ═══ Health ═══
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  service: string;
  status: HealthStatus;
  version: string;
  uptime: number;
  checks: Record<string, { status: HealthStatus; latencyMs: number; details?: string }>;
  timestamp: string;
}

// ═══ CSL Types ═══
export type Vector384 = number[];
export type Vector1536 = number[];
export type CSLTruth = 'TRUE' | 'UNKNOWN' | 'FALSE';

export interface CSLGateResult {
  input: number;
  cosScore: number;
  tau: number;
  temperature: number;
  output: number;
  truth: CSLTruth;
}

// ═══ Pipeline ═══
export type PipelineStage =
  | 'CONTEXT_ASSEMBLY' | 'INTENT_CLASSIFICATION' | 'NODE_SELECTION'
  | 'EXECUTION' | 'QUALITY_GATE' | 'ASSURANCE_GATE'
  | 'PATTERN_CAPTURE' | 'STORY_UPDATE';

export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface PipelineState {
  taskId: string;
  currentStage: PipelineStage;
  completedStages: PipelineStage[];
  startedAt: string;
  lastUpdated: string;
  status: PipelineStatus;
  selectedNodes: string[];
  result?: Record<string, unknown>;
  error?: string;
}

// ═══ Task Domains ═══
export type TaskDomain =
  | 'code_generation' | 'code_review' | 'security' | 'architecture'
  | 'research' | 'documentation' | 'creative' | 'translation'
  | 'monitoring' | 'cleanup' | 'analytics' | 'maintenance'
  | 'memory' | 'orchestration' | 'testing' | 'communication'
  | 'healing' | 'governance' | 'mcp' | 'edge' | 'gpu';

// ═══ Colab Runtime ═══
export type RuntimeRole = 'embedding' | 'inference' | 'training';
export type RuntimeStatus = 'disconnected' | 'connecting' | 'ready' | 'busy' | 'error' | 'cooldown';

export interface RuntimeMetrics {
  gpuUtilization: number;
  memoryUtilization: number;
  tasksCompleted: number;
  tasksFailed: number;
  avgLatencyMs: number;
  uptime: number;
}

// ═══ Auth ═══
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  roles: string[];
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  expiresAt: string;
  refreshToken: string;
}

// ═══ Vector Memory ═══
export interface VectorEntry {
  id: string;
  content: string;
  embedding: Vector384;
  position3d: [number, number, number];
  metadata: Record<string, unknown>;
  createdAt: string;
  lastAccessed: string;
  accessCount: number;
}

export interface SearchResult {
  entry: VectorEntry;
  score: number;
  distance: number;
}

// ═══ Logging ═══
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  service: string;
  message: string;
  timestamp: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

// ═══ API Gateway ═══
export interface GatewayRoute {
  path: string;
  service: string;
  methods: string[];
  rateLimit: number;
  authRequired: boolean;
  pool: ResourcePool;
}

export interface RateLimitState {
  clientId: string;
  windowStart: number;
  requestCount: number;
  limit: number;
}

// ═══ Error Codes ═══
export interface HeadyError {
  code: string;
  message: string;
  httpStatus: number;
  service: string;
  timestamp: string;
  traceId?: string;
  details?: Record<string, unknown>;
}
