/**
 * Heady™ Bee Agent Factory v5.0.0
 * Dynamic agent worker creation — 24 domains, persistent + ephemeral workers
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { PHI, PSI, FIB, CSL_THRESHOLDS, phiBackoff, cosineSimilarity, TIMING } from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('bee-factory');

// ═══ Types ═══
export type BeeStatus = 'idle' | 'working' | 'cooldown' | 'error' | 'terminated';
export type BeeLifecycle = 'persistent' | 'ephemeral';

export interface BeeConfig {
  domain: string;
  name: string;
  lifecycle: BeeLifecycle;
  intervalMs: number;
  capabilities: string[];
  maxConcurrent: number;
  metadata: Record<string, unknown>;
}

export interface Bee {
  id: string;
  config: BeeConfig;
  status: BeeStatus;
  createdAt: string;
  lastActiveAt: string;
  tasksCompleted: number;
  tasksFailed: number;
  currentTask: string | null;
  coherenceScore: number;
  embedding: number[] | null;
}

export interface BeeMetrics {
  totalBees: number;
  activeBees: number;
  idleBees: number;
  errorBees: number;
  tasksThroughput: number;
  avgCoherence: number;
  domainCounts: Record<string, number>;
}

// ═══ 24 Domain Registry ═══
export const BEE_DOMAINS: Record<string, { description: string; defaultCapabilities: string[]; pool: string }> = {
  code_generation:  { description: 'Code synthesis and generation', defaultCapabilities: ['write-code', 'refactor', 'generate-api'], pool: 'hot' },
  code_review:      { description: 'Code analysis and review', defaultCapabilities: ['lint', 'security-scan', 'quality-check'], pool: 'hot' },
  security:         { description: 'Security auditing and hardening', defaultCapabilities: ['vulnerability-scan', 'owasp-check', 'penetration-test'], pool: 'hot' },
  architecture:     { description: 'System design and architecture', defaultCapabilities: ['design-system', 'evaluate-tradeoffs', 'topology-plan'], pool: 'hot' },
  research:         { description: 'Information gathering and analysis', defaultCapabilities: ['web-search', 'paper-review', 'competitive-intel'], pool: 'warm' },
  documentation:    { description: 'Documentation generation', defaultCapabilities: ['generate-docs', 'api-docs', 'readme'], pool: 'warm' },
  creative:         { description: 'Creative and UX design', defaultCapabilities: ['ui-design', 'ux-flow', 'visual-identity'], pool: 'warm' },
  translation:      { description: 'Language translation and i18n', defaultCapabilities: ['translate', 'localize', 'i18n-check'], pool: 'warm' },
  monitoring:       { description: 'System observation and alerting', defaultCapabilities: ['health-check', 'metric-collect', 'anomaly-detect'], pool: 'warm' },
  cleanup:          { description: 'Resource cleanup and maintenance', defaultCapabilities: ['log-rotate', 'cache-clear', 'dead-code-remove'], pool: 'cold' },
  analytics:        { description: 'Data analysis and reporting', defaultCapabilities: ['metric-analyze', 'report-generate', 'trend-detect'], pool: 'cold' },
  maintenance:      { description: 'System maintenance operations', defaultCapabilities: ['backup', 'update', 'migrate'], pool: 'cold' },
  memory:           { description: 'Vector memory operations', defaultCapabilities: ['embed', 'search', 'store', 'recall'], pool: 'hot' },
  orchestration:    { description: 'Workflow orchestration', defaultCapabilities: ['route-task', 'coordinate', 'pipeline'], pool: 'hot' },
  testing:          { description: 'Quality assurance and testing', defaultCapabilities: ['unit-test', 'integration-test', 'e2e-test'], pool: 'warm' },
  communication:    { description: 'Messaging and notifications', defaultCapabilities: ['email', 'webhook', 'notification'], pool: 'warm' },
  healing:          { description: 'Self-healing and recovery', defaultCapabilities: ['diagnose', 'repair', 'respawn'], pool: 'governance' },
  governance:       { description: 'Policy enforcement and compliance', defaultCapabilities: ['validate', 'enforce', 'audit'], pool: 'governance' },
  mcp:              { description: 'Model Context Protocol operations', defaultCapabilities: ['tool-execute', 'transport', 'registry'], pool: 'warm' },
  edge:             { description: 'Edge computing operations', defaultCapabilities: ['edge-cache', 'edge-compute', 'cdn'], pool: 'warm' },
  gpu:              { description: 'GPU compute operations', defaultCapabilities: ['inference', 'training', 'embedding'], pool: 'warm' },
  deployment:       { description: 'Deploy and release management', defaultCapabilities: ['deploy', 'rollback', 'canary'], pool: 'cold' },
  data_pipeline:    { description: 'Data ETL and transformation', defaultCapabilities: ['extract', 'transform', 'load'], pool: 'cold' },
  billing:          { description: 'Billing and metering', defaultCapabilities: ['meter', 'invoice', 'subscription'], pool: 'cold' },
};

// ═══ Bee Registry ═══
const beeRegistry = new Map<string, Bee>();
let beeIdCounter = 0;

function generateBeeId(domain: string): string {
  beeIdCounter++;
  return `bee-${domain}-${beeIdCounter}-${Date.now().toString(36)}`;
}

// ═══ Create Bee (Persistent) ═══
export function createBee(config: BeeConfig): Bee {
  const id = generateBeeId(config.domain);
  const now = new Date().toISOString();

  const bee: Bee = {
    id,
    config: { ...config, lifecycle: 'persistent' },
    status: 'idle',
    createdAt: now,
    lastActiveAt: now,
    tasksCompleted: 0,
    tasksFailed: 0,
    currentTask: null,
    coherenceScore: 1.0,
    embedding: null,
  };

  beeRegistry.set(id, bee);
  logger.info('Bee created (persistent)', { beeId: id, domain: config.domain, name: config.name });
  return bee;
}

// ═══ Spawn Bee (Ephemeral) ═══
export function spawnBee(domain: string, task: string, context: Record<string, unknown> = {}): Bee {
  const domainDef = BEE_DOMAINS[domain];
  if (!domainDef) throw new Error(`HEADY-6001: Unknown bee domain: ${domain}`);

  const config: BeeConfig = {
    domain,
    name: `ephemeral-${domain}-${Date.now().toString(36)}`,
    lifecycle: 'ephemeral',
    intervalMs: 0,
    capabilities: domainDef.defaultCapabilities,
    maxConcurrent: 1,
    metadata: { task, context, spawnedAt: new Date().toISOString() },
  };

  const bee = createBee(config);
  bee.config.lifecycle = 'ephemeral';
  bee.currentTask = task;
  bee.status = 'working';

  logger.info('Bee spawned (ephemeral)', { beeId: bee.id, domain, task });
  return bee;
}

// ═══ Terminate Bee ═══
export function terminateBee(beeId: string): boolean {
  const bee = beeRegistry.get(beeId);
  if (!bee) return false;

  bee.status = 'terminated';
  bee.currentTask = null;

  if (bee.config.lifecycle === 'ephemeral') {
    beeRegistry.delete(beeId);
    logger.info('Ephemeral bee terminated and removed', { beeId });
  } else {
    logger.info('Persistent bee terminated', { beeId });
  }

  return true;
}

// ═══ Get Bee ═══
export function getBee(beeId: string): Bee | undefined {
  return beeRegistry.get(beeId);
}

// ═══ List Bees ═══
export function listBees(filter?: { domain?: string; status?: BeeStatus; lifecycle?: BeeLifecycle }): Bee[] {
  let bees = Array.from(beeRegistry.values());

  if (filter?.domain) bees = bees.filter(b => b.config.domain === filter.domain);
  if (filter?.status) bees = bees.filter(b => b.status === filter.status);
  if (filter?.lifecycle) bees = bees.filter(b => b.config.lifecycle === filter.lifecycle);

  return bees;
}

// ═══ Find Best Bee for Task ═══
export function findBestBee(requiredCapabilities: string[], domain?: string): Bee | null {
  const candidates = listBees({ status: 'idle' })
    .filter(b => !domain || b.config.domain === domain)
    .filter(b => requiredCapabilities.every(cap => b.config.capabilities.includes(cap)));

  if (candidates.length === 0) return null;

  // Sort by coherence score (highest first), then tasks completed (most experienced first)
  candidates.sort((a, b) => {
    const coherenceDiff = b.coherenceScore - a.coherenceScore;
    if (Math.abs(coherenceDiff) > PSI * 0.1) return coherenceDiff;
    return b.tasksCompleted - a.tasksCompleted;
  });

  return candidates[0];
}

// ═══ Record Task Completion ═══
export function recordBeeTaskComplete(beeId: string, success: boolean): void {
  const bee = beeRegistry.get(beeId);
  if (!bee) return;

  if (success) {
    bee.tasksCompleted++;
  } else {
    bee.tasksFailed++;
    // Degrade coherence on failure
    bee.coherenceScore = Math.max(0, bee.coherenceScore - Math.pow(PSI, 3));
  }

  bee.lastActiveAt = new Date().toISOString();
  bee.currentTask = null;
  bee.status = 'idle';

  // Auto-terminate ephemeral bees after task
  if (bee.config.lifecycle === 'ephemeral') {
    terminateBee(beeId);
  }
}

// ═══ Stale Bee Detection ═══
export function detectStaleBees(): Bee[] {
  const now = Date.now();
  const staleThreshold = TIMING.HEARTBEAT_MS * FIB[3]; // 34s * 3 = 102s
  const stale: Bee[] = [];

  for (const bee of beeRegistry.values()) {
    if (bee.status === 'terminated') continue;
    const lastActive = new Date(bee.lastActiveAt).getTime();
    if (bee.status === 'working' && now - lastActive > staleThreshold) {
      bee.status = 'error';
      stale.push(bee);
      logger.warn('Stale bee detected', { beeId: bee.id, domain: bee.config.domain, elapsedMs: now - lastActive });
    }
  }

  return stale;
}

// ═══ Metrics ═══
export function getBeeMetrics(): BeeMetrics {
  const bees = Array.from(beeRegistry.values());
  const active = bees.filter(b => b.status === 'working');
  const idle = bees.filter(b => b.status === 'idle');
  const errorBees = bees.filter(b => b.status === 'error');

  const domainCounts: Record<string, number> = {};
  for (const bee of bees) {
    domainCounts[bee.config.domain] = (domainCounts[bee.config.domain] || 0) + 1;
  }

  const totalCompleted = bees.reduce((sum, b) => sum + b.tasksCompleted, 0);
  const avgCoherence = bees.length > 0 ? bees.reduce((sum, b) => sum + b.coherenceScore, 0) / bees.length : 1.0;

  return {
    totalBees: bees.length,
    activeBees: active.length,
    idleBees: idle.length,
    errorBees: errorBees.length,
    tasksThroughput: totalCompleted,
    avgCoherence,
    domainCounts,
  };
}

// ═══ Initialize Default Persistent Bees ═══
export function initializeDefaultBees(): void {
  const defaults: Array<{ domain: string; name: string }> = [
    { domain: 'orchestration', name: 'HeadyConductor-Worker' },
    { domain: 'memory', name: 'HeadyMemory-Worker' },
    { domain: 'governance', name: 'HeadyCheck-Worker' },
    { domain: 'governance', name: 'HeadySoul-Worker' },
    { domain: 'healing', name: 'HeadyMaintenance-Worker' },
    { domain: 'monitoring', name: 'HeadyObserver-Worker' },
    { domain: 'security', name: 'HeadyGuard-Worker' },
    { domain: 'code_generation', name: 'HeadyCoder-Worker' },
    { domain: 'code_review', name: 'HeadyCodex-Worker' },
    { domain: 'research', name: 'HeadyResearch-Worker' },
    { domain: 'architecture', name: 'HeadyVinci-Worker' },
    { domain: 'creative', name: 'HeadyMuse-Worker' },
    { domain: 'analytics', name: 'HeadyPatterns-Worker' },
  ];

  for (const { domain, name } of defaults) {
    const domainDef = BEE_DOMAINS[domain];
    if (!domainDef) continue;
    createBee({
      domain,
      name,
      lifecycle: 'persistent',
      intervalMs: TIMING.HEARTBEAT_MS,
      capabilities: domainDef.defaultCapabilities,
      maxConcurrent: FIB[3], // 3
      metadata: { role: 'default-worker' },
    });
  }

  logger.info('Default bees initialized', { count: defaults.length });
}
