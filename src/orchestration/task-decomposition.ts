/**
 * Heady™ Task Decomposition Engine v5.0.0
 * DAG construction, topological sort, CSL-scored swarm assignment, parallel batching
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { PHI, PSI, FIB, CSL_THRESHOLDS, cosineSimilarity, cslGate } from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';
import type { SwarmTask } from './swarm-coordinator.js';

const logger = createLogger('task-decomposition');

// ═══ Types ═══
export interface Subtask {
  id: string;
  description: string;
  type: SubtaskType;
  dependsOn: string[];
  estimatedComplexity: 'trivial' | 'simple' | 'medium' | 'complex' | 'epic';
  embedding: number[] | null;
  metadata: Record<string, unknown>;
}

export type SubtaskType =
  | 'research' | 'coding' | 'data' | 'reasoning' | 'synthesis'
  | 'validation' | 'retrieval' | 'integration' | 'planning' | 'communication';

export interface DAGNode {
  subtask: Subtask;
  depth: number;
  inDegree: number;
  outEdges: string[];
  score: number;
  assignedSwarm: string | null;
}

export interface ExecutionPlan {
  taskId: string;
  dag: Map<string, DAGNode>;
  layers: string[][];
  totalSubtasks: number;
  maxDepth: number;
  maxParallelism: number;
  estimatedDurationMs: number;
}

// ═══ Swarm Capability Map ═══
const SWARM_CAPABILITIES: Record<string, string[]> = {
  'research-swarm':       ['research', 'planning'],
  'coding-swarm':         ['coding', 'integration'],
  'data-swarm':           ['data', 'retrieval'],
  'reasoning-swarm':      ['reasoning', 'synthesis'],
  'governance-swarm':     ['validation'],
  'memory-swarm':         ['retrieval'],
  'communication-swarm':  ['communication'],
};

// ═══ Complexity-to-Duration Map (Fibonacci-scaled milliseconds) ═══
const COMPLEXITY_DURATION_MS: Record<string, number> = {
  trivial: FIB[5] * 100,   // 500ms
  simple:  FIB[7] * 100,   // 2,100ms
  medium:  FIB[9] * 100,   // 5,500ms
  complex: FIB[11] * 1000, // 89,000ms
  epic:    FIB[13] * 1000, // 233,000ms
};

// ═══ Decompose Task ═══
export function decompose(taskDescription: string, subtasks: Subtask[]): ExecutionPlan {
  const taskId = `task-${Date.now().toString(36)}`;

  // Validate max subtasks
  if (subtasks.length > FIB[10]) { // 55 max
    throw new Error(`HEADY-6010: Too many subtasks (${subtasks.length} > ${FIB[10]})`);
  }

  // Build DAG
  const dag = buildDAG(subtasks);

  // Detect cycles
  if (hasCycle(dag)) {
    throw new Error('HEADY-6011: Circular dependency detected in subtask graph');
  }

  // Topological sort into execution layers
  const layers = topologicalSort(dag);

  // Score and assign swarms
  for (const node of dag.values()) {
    node.score = scoreSubtask(node.subtask);
    node.assignedSwarm = assignSwarm(node.subtask);
  }

  const maxDepth = layers.length;
  const maxParallelism = Math.max(...layers.map(l => l.length), 0);
  const estimatedDurationMs = estimateDuration(layers, dag);

  logger.info('Task decomposed', {
    taskId,
    subtasks: subtasks.length,
    layers: layers.length,
    maxParallelism,
    estimatedDurationMs,
  });

  return { taskId, dag, layers, totalSubtasks: subtasks.length, maxDepth, maxParallelism, estimatedDurationMs };
}

// ═══ Build DAG ═══
function buildDAG(subtasks: Subtask[]): Map<string, DAGNode> {
  const dag = new Map<string, DAGNode>();

  // Create nodes
  for (const subtask of subtasks) {
    dag.set(subtask.id, {
      subtask,
      depth: 0,
      inDegree: 0,
      outEdges: [],
      score: 0,
      assignedSwarm: null,
    });
  }

  // Build edges
  for (const subtask of subtasks) {
    for (const depId of subtask.dependsOn) {
      const depNode = dag.get(depId);
      const node = dag.get(subtask.id);
      if (depNode && node) {
        depNode.outEdges.push(subtask.id);
        node.inDegree++;
      }
    }
  }

  return dag;
}

// ═══ Cycle Detection (DFS) ═══
function hasCycle(dag: Map<string, DAGNode>): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = dag.get(nodeId);
    if (!node) return false;

    for (const neighbor of node.outEdges) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const nodeId of dag.keys()) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) return true;
    }
  }

  return false;
}

// ═══ Topological Sort (Kahn's Algorithm) — Returns execution layers ═══
function topologicalSort(dag: Map<string, DAGNode>): string[][] {
  const inDegrees = new Map<string, number>();
  for (const [id, node] of dag) {
    inDegrees.set(id, node.inDegree);
  }

  const layers: string[][] = [];
  let remaining = dag.size;

  while (remaining > 0) {
    // Find all nodes with inDegree 0
    const layer: string[] = [];
    for (const [id, degree] of inDegrees) {
      if (degree === 0) {
        layer.push(id);
      }
    }

    if (layer.length === 0 && remaining > 0) {
      throw new Error('HEADY-6012: Topological sort failed — unreachable nodes detected');
    }

    // Remove processed nodes and update inDegrees
    for (const id of layer) {
      inDegrees.delete(id);
      remaining--;

      const node = dag.get(id);
      if (node) {
        node.depth = layers.length;
        for (const neighbor of node.outEdges) {
          const deg = inDegrees.get(neighbor);
          if (deg !== undefined) {
            inDegrees.set(neighbor, deg - 1);
          }
        }
      }
    }

    layers.push(layer);
  }

  return layers;
}

// ═══ CSL Scoring ═══
function scoreSubtask(subtask: Subtask): number {
  // Score based on type alignment and complexity
  const complexityWeight = {
    trivial: 0.1,
    simple: PSI * PSI,   // ≈ 0.382
    medium: PSI,          // ≈ 0.618
    complex: 1 - PSI * PSI, // ≈ 0.764
    epic: 1.0,
  }[subtask.estimatedComplexity] || PSI;

  return complexityWeight;
}

// ═══ Swarm Assignment (Capability Match) ═══
function assignSwarm(subtask: Subtask): string {
  let bestSwarm = 'reasoning-swarm';
  let bestMatch = 0;

  for (const [swarmName, capabilities] of Object.entries(SWARM_CAPABILITIES)) {
    const match = capabilities.includes(subtask.type) ? 1.0 : 0;
    if (match > bestMatch) {
      bestMatch = match;
      bestSwarm = swarmName;
    }
  }

  return bestSwarm;
}

// ═══ Duration Estimation ═══
function estimateDuration(layers: string[][], dag: Map<string, DAGNode>): number {
  let totalMs = 0;
  for (const layer of layers) {
    // Each layer runs in parallel — duration = max subtask in layer
    let layerMax = 0;
    for (const id of layer) {
      const node = dag.get(id);
      if (node) {
        const duration = COMPLEXITY_DURATION_MS[node.subtask.estimatedComplexity] || FIB[9] * 100;
        layerMax = Math.max(layerMax, duration);
      }
    }
    totalMs += layerMax;
  }
  return totalMs;
}

// ═══ Convert to SwarmTasks ═══
export function toSwarmTasks(plan: ExecutionPlan): SwarmTask[] {
  const tasks: SwarmTask[] = [];

  for (const [id, node] of plan.dag) {
    tasks.push({
      id,
      description: node.subtask.description,
      domain: node.subtask.type,
      requiredCapabilities: [],
      embedding: node.subtask.embedding,
      priority: node.depth === 0 ? 'hot' : node.depth <= 2 ? 'warm' : 'cold',
      dependsOn: node.subtask.dependsOn,
      timeout: COMPLEXITY_DURATION_MS[node.subtask.estimatedComplexity] || FIB[9] * 100,
    });
  }

  return tasks;
}
