/** Continuous Semantic Logic value — always between 0.0 and 1.0 */
export type CSLValue = number;

export type PipelineStage = 'INGEST' | 'PROJECTION' | 'REASONING' | 'SYNTHESIS' | 'IGNITION' | 'AUDIT';

export interface ServiceManifest {
  name: string;
  version: string;
  port: number;
  summary: string;
  routes: string[];
  dependencies: string[];
}

export interface ServiceHealth {
  ok: boolean;
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
}

export interface HealthSnapshot {
  service: string;
  healthy: boolean;
  readinessScore: number;
  driftScore: number;
  checkedAt: string;
  details?: Record<string, unknown>;
}

export interface RouteDecision {
  taskType: string;
  pool: 'hot' | 'warm' | 'cold';
  service: string;
  confidence: number;
}

export interface AlignmentResult {
  score: CSLValue;
  certified: boolean;
  reason: string;
}

export interface ContextLayer {
  name: string;
  content: string;
  tokens: number;
  priority: number;
}

export interface ContextCapsule {
  layers: ContextLayer[];
  totalTokens: number;
  cslConfidence: CSLValue;
}

export interface MemoryEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  cslRelevance: CSLValue;
  createdAt: string;
}

export interface MemorySearchResult {
  entries: MemoryEntry[];
  totalFound: number;
}

export interface MemoryUpsertRequest {
  content: string;
  metadata?: Record<string, unknown>;
  namespace?: string;
}

export interface PatternMatch {
  patternId: string;
  confidence: CSLValue;
  explanation: string;
}

export interface BeeTask {
  id: string;
  type: string;
  payload: unknown;
  priority: number;
  ttl: number;
}

export interface BeeStatus {
  id: string;
  state: 'idle' | 'working' | 'done' | 'failed';
  task?: BeeTask;
}

export interface GovernanceRequest {
  action: string;
  actor: string;
  domain: string;
  context?: Record<string, unknown>;
}

export interface GovernanceDecision {
  allowed: boolean;
  reason: string;
  riskLevel: CSLValue;
  auditId: string;
}

export interface NodeEndpoint {
  id: string;
  endpoint: string;
  health: string;
  layer: string;
}

export interface StoryEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  outcome: string;
  cslSignificance: CSLValue;
}

export interface VinciPattern {
  id: string;
  name: string;
  embedding: number[];
  frequency: number;
  lastSeen: string;
  confidence: CSLValue;
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  checkedAt: string;
}
