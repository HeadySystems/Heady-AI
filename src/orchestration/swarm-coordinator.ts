/**
 * Heady™ Swarm Coordinator v5.0.0
 * Multi-agent consensus, parallel execution, CSL-scored routing
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { PHI, PSI, FIB, CSL_THRESHOLDS, cosineSimilarity, cslCONSENSUS, cslGate, normalize, phiFusionWeights, TIMING } from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';
import { findBestBee, spawnBee, recordBeeTaskComplete, listBees } from './bee-factory.js';
import type { Bee } from './bee-factory.js';

const logger = createLogger('swarm-coordinator');

// ═══ Types ═══
export interface SwarmTask {
  id: string;
  description: string;
  domain: string;
  requiredCapabilities: string[];
  embedding: number[] | null;
  priority: 'hot' | 'warm' | 'cold';
  dependsOn: string[];
  timeout: number;
}

export interface SwarmResult {
  taskId: string;
  beeId: string;
  status: 'completed' | 'failed' | 'timeout';
  result: unknown;
  latencyMs: number;
  coherenceScore: number;
}

export interface SwarmConsensus {
  taskId: string;
  results: SwarmResult[];
  consensusVector: number[] | null;
  agreementScore: number;
  finalResult: unknown;
}

export interface SwarmMetrics {
  activeSwarms: number;
  totalTasksRouted: number;
  avgRoutingLatencyMs: number;
  avgConsensusScore: number;
  domainDistribution: Record<string, number>;
}

// ═══ Swarm State ═══
const activeSwarms = new Map<string, SwarmTask[]>();
let totalRouted = 0;
let totalRoutingMs = 0;

// ═══ CSL-Scored Task Routing ═══
export function routeTask(task: SwarmTask): Bee | null {
  const start = Date.now();

  // 1. Try to find existing idle bee with matching capabilities
  let bee = findBestBee(task.requiredCapabilities, task.domain);

  // 2. If no idle bee, spawn ephemeral
  if (!bee) {
    bee = spawnBee(task.domain, task.description, { taskId: task.id });
    logger.info('Spawned ephemeral bee for task', { taskId: task.id, beeId: bee.id, domain: task.domain });
  }

  // 3. CSL gate check — ensure bee embedding aligns with task
  if (task.embedding && bee.embedding) {
    const similarity = cosineSimilarity(task.embedding, bee.embedding);
    const gated = cslGate(1.0, similarity, CSL_THRESHOLDS.LOW);
    if (gated < CSL_THRESHOLDS.MINIMUM) {
      logger.warn('CSL gate rejected routing', { taskId: task.id, beeId: bee.id, similarity, gated });
      return null;
    }
  }

  totalRouted++;
  totalRoutingMs += Date.now() - start;

  logger.info('Task routed', { taskId: task.id, beeId: bee.id, domain: task.domain });
  return bee;
}

// ═══ Parallel Swarm Execution ═══
export async function executeSwarm(tasks: SwarmTask[]): Promise<SwarmResult[]> {
  const maxParallel = FIB[6]; // 8 concurrent
  const results: SwarmResult[] = [];
  const queue = [...tasks];

  logger.info('Swarm execution starting', { totalTasks: tasks.length, maxParallel });

  while (queue.length > 0) {
    const batch = queue.splice(0, maxParallel);
    const batchPromises = batch.map(task => executeTask(task));
    const batchResults = await Promise.allSettled(batchPromises);

    for (let i = 0; i < batchResults.length; i++) {
      const settled = batchResults[i];
      if (settled.status === 'fulfilled') {
        results.push(settled.value);
      } else {
        results.push({
          taskId: batch[i].id,
          beeId: 'none',
          status: 'failed',
          result: null,
          latencyMs: 0,
          coherenceScore: 0,
        });
      }
    }
  }

  logger.info('Swarm execution complete', { totalTasks: tasks.length, completed: results.filter(r => r.status === 'completed').length });
  return results;
}

async function executeTask(task: SwarmTask): Promise<SwarmResult> {
  const start = Date.now();
  const bee = routeTask(task);

  if (!bee) {
    return { taskId: task.id, beeId: 'none', status: 'failed', result: null, latencyMs: 0, coherenceScore: 0 };
  }

  try {
    // Execute with timeout
    const timeoutMs = task.priority === 'hot' ? FIB[9] * 1000  // 34s
      : task.priority === 'warm' ? FIB[12] * 1000  // 144s
      : FIB[14] * 1000;  // 610s

    const result = await Promise.race([
      performBeeWork(bee, task),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('HEADY-6002: Task timeout')), timeoutMs)
      ),
    ]);

    const latencyMs = Date.now() - start;
    recordBeeTaskComplete(bee.id, true);

    return { taskId: task.id, beeId: bee.id, status: 'completed', result, latencyMs, coherenceScore: bee.coherenceScore };
  } catch (err) {
    const latencyMs = Date.now() - start;
    recordBeeTaskComplete(bee.id, false);

    return {
      taskId: task.id,
      beeId: bee.id,
      status: err instanceof Error && err.message.includes('timeout') ? 'timeout' : 'failed',
      result: null,
      latencyMs,
      coherenceScore: bee.coherenceScore,
    };
  }
}

async function performBeeWork(bee: Bee, task: SwarmTask): Promise<unknown> {
  // In production: delegates to actual service endpoints, Colab runtimes, or external tools
  // Here: structured result placeholder that represents the execution contract
  return {
    beeId: bee.id,
    domain: task.domain,
    description: task.description,
    executedAt: new Date().toISOString(),
    capabilities: bee.config.capabilities,
  };
}

// ═══ Swarm Consensus (CSL CONSENSUS gate) ═══
export function buildConsensus(taskId: string, results: SwarmResult[]): SwarmConsensus {
  const successful = results.filter(r => r.status === 'completed');

  if (successful.length === 0) {
    return { taskId, results, consensusVector: null, agreementScore: 0, finalResult: null };
  }

  // If we have embeddings, compute CSL CONSENSUS
  const embeddings = successful
    .map(r => (r.result as Record<string, unknown>)?.embedding as number[] | undefined)
    .filter((e): e is number[] => Array.isArray(e) && e.length > 0);

  let consensusVector: number[] | null = null;
  let agreementScore = 1.0;

  if (embeddings.length >= 2) {
    const weights = phiFusionWeights(embeddings.length);
    consensusVector = cslCONSENSUS(embeddings, weights);

    // Agreement = average pairwise cosine similarity
    let pairSum = 0;
    let pairCount = 0;
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        pairSum += cosineSimilarity(embeddings[i], embeddings[j]);
        pairCount++;
      }
    }
    agreementScore = pairCount > 0 ? pairSum / pairCount : 1.0;
  }

  // Select best result by coherence score
  successful.sort((a, b) => b.coherenceScore - a.coherenceScore);
  const finalResult = successful[0].result;

  logger.info('Consensus built', { taskId, participants: successful.length, agreementScore });

  return { taskId, results, consensusVector, agreementScore, finalResult };
}

// ═══ Metrics ═══
export function getSwarmMetrics(): SwarmMetrics {
  const bees = listBees();
  const domainDist: Record<string, number> = {};
  for (const bee of bees) {
    domainDist[bee.config.domain] = (domainDist[bee.config.domain] || 0) + 1;
  }

  return {
    activeSwarms: activeSwarms.size,
    totalTasksRouted: totalRouted,
    avgRoutingLatencyMs: totalRouted > 0 ? totalRoutingMs / totalRouted : 0,
    avgConsensusScore: 0,
    domainDistribution: domainDist,
  };
}
