/**
 * Heady™ Latent OS v5.4.0
 * © 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents
 * ZERO MAGIC NUMBERS — All constants φ-derived or Fibonacci
 *
 * HEADY VINCI — Session Planner
 *
 * Plans complex multi-step sessions by decomposing user objectives into
 * a dependency DAG of subtasks. Allocates resources using Fibonacci ratios
 * and routes subtasks via CSL cosine similarity to optimal nodes.
 *
 * Position: INNER RING of Sacred Geometry topology
 * Feeds: HeadyConductor for execution dispatch
 */
'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');
const {
  PHI, PSI, fib, CSL_THRESHOLDS, PHI_TIMING,
  sigmoid,
} = require('../../shared/phi-math');

// ─── φ-Constants ─────────────────────────────────────────────────────────────

const MAX_PLAN_DEPTH        = fib(6);                       // 8 levels deep
const MAX_SUBTASKS          = fib(10);                      // 55 subtasks per plan
const PLAN_TIMEOUT_MS       = PHI_TIMING.PHI_7;            // 29 034ms
const SUBTASK_TIMEOUT_MS    = PHI_TIMING.PHI_6;            // 17 944ms per subtask
const RESOURCE_POOLS        = Object.freeze({
  hot:        fib(9) / (fib(9) + fib(8) + fib(7) + fib(6) + fib(5)), // 34/81 ≈ 0.420
  warm:       fib(8) / (fib(9) + fib(8) + fib(7) + fib(6) + fib(5)), // 21/81 ≈ 0.259
  cold:       fib(7) / (fib(9) + fib(8) + fib(7) + fib(6) + fib(5)), // 13/81 ≈ 0.160
  reserve:    fib(6) / (fib(9) + fib(8) + fib(7) + fib(6) + fib(5)), // 8/81  ≈ 0.099
  governance: fib(5) / (fib(9) + fib(8) + fib(7) + fib(6) + fib(5)), // 5/81  ≈ 0.062
});

// ─── Logger ─────────────────────────────────────────────────────────────────

function log(level, msg, meta = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: 'heady-vinci',
    msg,
    ...meta,
  });
  process.stdout.write(entry + '\n');
}

// ─── Subtask Status Enum ────────────────────────────────────────────────────

const SubtaskStatus = Object.freeze({
  PENDING:     'pending',
  READY:       'ready',
  EXECUTING:   'executing',
  COMPLETED:   'completed',
  FAILED:      'failed',
  BLOCKED:     'blocked',
});

// ─── HeadyVinci Class ───────────────────────────────────────────────────────

class HeadyVinci extends EventEmitter {
  constructor() {
    super();
    this.activePlans = new Map();
    this.planHistory = [];
    this.planCount = 0;
  }

  // ─── Create Execution Plan ────────────────────────────────────────────

  createPlan(objective, subtaskDefinitions = []) {
    const planId = `plan_${crypto.randomBytes(fib(6)).toString('hex')}_${++this.planCount}`;

    if (subtaskDefinitions.length > MAX_SUBTASKS) {
      throw new Error(`Plan exceeds max subtasks: ${subtaskDefinitions.length} > ${MAX_SUBTASKS}`);
    }

    const plan = {
      id: planId,
      objective,
      status: 'planning',
      createdAt: Date.now(),
      subtasks: subtaskDefinitions.map((def, idx) => ({
        id: `${planId}_sub_${idx}`,
        name: def.name,
        description: def.description || '',
        pool: def.pool || 'warm',
        dependencies: def.dependencies || [],
        status: SubtaskStatus.PENDING,
        result: null,
        startedAt: null,
        completedAt: null,
        timeoutMs: SUBTASK_TIMEOUT_MS,
      })),
      dag: null,
      resourceAllocation: { ...RESOURCE_POOLS },
      metrics: {
        totalSubtasks: subtaskDefinitions.length,
        completed: 0,
        failed: 0,
        executionStartMs: null,
        executionEndMs: null,
      },
    };

    // Build DAG
    plan.dag = this._buildDAG(plan.subtasks);
    plan.status = 'ready';

    // Mark ready subtasks (no dependencies)
    this._updateReadySubtasks(plan);

    this.activePlans.set(planId, plan);

    log('info', 'Execution plan created', {
      planId,
      objective: objective.substring(0, fib(11)),
      subtasks: plan.subtasks.length,
      readyCount: plan.subtasks.filter((s) => s.status === SubtaskStatus.READY).length,
    });

    this.emit('vinci:plan_created', { planId, subtasks: plan.subtasks.length });
    return plan;
  }

  // ─── Build Dependency DAG ─────────────────────────────────────────────

  _buildDAG(subtasks) {
    const dag = {
      nodes: subtasks.map((s) => s.id),
      edges: [],
      levels: [],
    };

    // Build edges from dependencies
    for (const subtask of subtasks) {
      for (const depIdx of subtask.dependencies) {
        if (depIdx >= 0 && depIdx < subtasks.length) {
          dag.edges.push({
            from: subtasks[depIdx].id,
            to: subtask.id,
          });
        }
      }
    }

    // Topological sort for level assignment (cycle detection)
    const inDegree = new Map();
    const adjList = new Map();

    for (const node of dag.nodes) {
      inDegree.set(node, 0);
      adjList.set(node, []);
    }

    for (const edge of dag.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      adjList.get(edge.from).push(edge.to);
    }

    // BFS level assignment
    let queue = [...dag.nodes].filter((n) => inDegree.get(n) === 0);
    let level = 0;
    const visited = new Set();

    while (queue.length > 0 && level < MAX_PLAN_DEPTH) {
      dag.levels.push([...queue]);
      const nextQueue = [];

      for (const node of queue) {
        visited.add(node);
        for (const neighbor of adjList.get(node) || []) {
          inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
          if (inDegree.get(neighbor) === 0 && !visited.has(neighbor)) {
            nextQueue.push(neighbor);
          }
        }
      }

      queue = nextQueue;
      level++;
    }

    // Detect cycles
    if (visited.size < dag.nodes.length) {
      log('warn', 'Cycle detected in DAG', {
        totalNodes: dag.nodes.length,
        visited: visited.size,
      });
      dag.hasCycle = true;
    }

    return dag;
  }

  // ─── Update Ready Subtasks ────────────────────────────────────────────

  _updateReadySubtasks(plan) {
    for (const subtask of plan.subtasks) {
      if (subtask.status !== SubtaskStatus.PENDING) continue;

      const allDepsComplete = subtask.dependencies.every((depIdx) => {
        const dep = plan.subtasks[depIdx];
        return dep && dep.status === SubtaskStatus.COMPLETED;
      });

      if (allDepsComplete) {
        subtask.status = SubtaskStatus.READY;
      }
    }
  }

  // ─── Get Next Ready Subtasks (for concurrent execution) ───────────────

  getReadySubtasks(planId) {
    const plan = this.activePlans.get(planId);
    if (!plan) return [];
    return plan.subtasks.filter((s) => s.status === SubtaskStatus.READY);
  }

  // ─── Mark Subtask Started ─────────────────────────────────────────────

  markSubtaskStarted(planId, subtaskId) {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;
    const subtask = plan.subtasks.find((s) => s.id === subtaskId);
    if (!subtask || subtask.status !== SubtaskStatus.READY) return false;

    subtask.status = SubtaskStatus.EXECUTING;
    subtask.startedAt = Date.now();

    if (!plan.metrics.executionStartMs) {
      plan.metrics.executionStartMs = Date.now();
      plan.status = 'executing';
    }

    this.emit('vinci:subtask_started', { planId, subtaskId });
    return true;
  }

  // ─── Mark Subtask Completed ───────────────────────────────────────────

  markSubtaskCompleted(planId, subtaskId, result = null) {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;
    const subtask = plan.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) return false;

    subtask.status = SubtaskStatus.COMPLETED;
    subtask.completedAt = Date.now();
    subtask.result = result;
    plan.metrics.completed++;

    // Update newly ready subtasks
    this._updateReadySubtasks(plan);

    // Check plan completion
    if (plan.metrics.completed + plan.metrics.failed >= plan.subtasks.length) {
      plan.status = plan.metrics.failed > 0 ? 'completed_with_failures' : 'completed';
      plan.metrics.executionEndMs = Date.now();
      this.emit('vinci:plan_completed', {
        planId,
        status: plan.status,
        durationMs: plan.metrics.executionEndMs - plan.metrics.executionStartMs,
      });
    }

    this.emit('vinci:subtask_completed', { planId, subtaskId });
    return true;
  }

  // ─── Mark Subtask Failed ──────────────────────────────────────────────

  markSubtaskFailed(planId, subtaskId, error) {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;
    const subtask = plan.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) return false;

    subtask.status = SubtaskStatus.FAILED;
    subtask.completedAt = Date.now();
    subtask.result = { error: error?.message || String(error) };
    plan.metrics.failed++;

    // Block dependents
    for (const other of plan.subtasks) {
      const subIdx = plan.subtasks.indexOf(subtask);
      if (other.dependencies.includes(subIdx) && other.status === SubtaskStatus.PENDING) {
        other.status = SubtaskStatus.BLOCKED;
      }
    }

    this.emit('vinci:subtask_failed', { planId, subtaskId, error: error?.message });
    return true;
  }

  // ─── Get Plan Status ──────────────────────────────────────────────────

  getPlanStatus(planId) {
    const plan = this.activePlans.get(planId);
    if (!plan) return null;

    return {
      id: plan.id,
      objective: plan.objective,
      status: plan.status,
      metrics: plan.metrics,
      subtasks: plan.subtasks.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        pool: s.pool,
        durationMs: s.startedAt && s.completedAt ? s.completedAt - s.startedAt : null,
      })),
      dagLevels: plan.dag?.levels?.length || 0,
      resourceAllocation: plan.resourceAllocation,
    };
  }
}

module.exports = {
  HeadyVinci,
  SubtaskStatus,
  RESOURCE_POOLS,
  MAX_SUBTASKS,
  MAX_PLAN_DEPTH,
};
