/**
 * Heady™ Latent OS v5.4.0
 * © 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents
 * ZERO MAGIC NUMBERS — All constants φ-derived or Fibonacci
 *
 * ASYNC PARALLEL EXECUTOR
 *
 * Executes tasks concurrently wherever possible, respecting dependency DAGs.
 * Independent tasks fire simultaneously; dependent tasks wait for their
 * predecessors. Phi-limited concurrency prevents resource exhaustion.
 *
 * Core principle: "Everything that CAN run concurrently SHOULD run concurrently."
 */
'use strict';

const { EventEmitter } = require('events');
const {
  PHI, PSI, fib, CSL_THRESHOLDS, PHI_TIMING,
  phiBackoffWithJitter,
} = require('../../shared/phi-math');

// ─── φ-Constants ─────────────────────────────────────────────────────────────

const MAX_CONCURRENCY        = fib(8);                      // 21 parallel tasks
const TASK_TIMEOUT_MS        = PHI_TIMING.PHI_7;            // 29 034ms default
const MAX_RETRIES            = fib(5);                       // 5 retries
const QUEUE_DEPTH            = fib(13);                      // 233 max queued tasks
const PROGRESS_EMIT_INTERVAL = PHI_TIMING.PHI_5;            // 11 090ms

// ─── Logger ─────────────────────────────────────────────────────────────────

function log(level, msg, meta = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: 'async-parallel-executor',
    msg,
    ...meta,
  });
  process.stdout.write(entry + '\n');
}

// ─── AsyncParallelExecutor Class ────────────────────────────────────────────

class AsyncParallelExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConcurrency = options.maxConcurrency || MAX_CONCURRENCY;
    this.taskTimeout = options.taskTimeout || TASK_TIMEOUT_MS;
    this.maxRetries = options.maxRetries || MAX_RETRIES;
    this.running = 0;
    this.completed = 0;
    this.failed = 0;
    this.totalTasks = 0;
  }

  // ─── Execute Tasks with DAG Dependencies ──────────────────────────────
  // tasks: [{ id, fn, dependencies: [taskId, ...] }]
  // Returns: Map<taskId, result>

  async executeDAG(tasks) {
    if (tasks.length > QUEUE_DEPTH) {
      throw new Error(`Task count ${tasks.length} exceeds queue depth ${QUEUE_DEPTH}`);
    }

    this.totalTasks = tasks.length;
    this.completed = 0;
    this.failed = 0;
    this.running = 0;

    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const results = new Map();
    const status = new Map(tasks.map((t) => [t.id, 'pending']));
    const startTime = Date.now();

    log('info', 'DAG execution starting', {
      totalTasks: tasks.length,
      maxConcurrency: this.maxConcurrency,
    });

    // Build reverse dependency map
    const dependents = new Map();
    for (const task of tasks) {
      for (const dep of (task.dependencies || [])) {
        if (!dependents.has(dep)) dependents.set(dep, []);
        dependents.get(dep).push(task.id);
      }
    }

    return new Promise((resolve, reject) => {
      const trySchedule = () => {
        // Find tasks that are ready (all deps completed)
        for (const [taskId, taskStatus] of status) {
          if (taskStatus !== 'pending') continue;
          if (this.running >= this.maxConcurrency) break;

          const task = taskMap.get(taskId);
          const deps = task.dependencies || [];
          const allDepsComplete = deps.every((d) => status.get(d) === 'completed');
          const anyDepFailed = deps.some((d) => status.get(d) === 'failed');

          if (anyDepFailed) {
            status.set(taskId, 'failed');
            this.failed++;
            results.set(taskId, { error: 'dependency_failed' });
            this.emit('task:failed', { taskId, reason: 'dependency_failed' });
            continue;
          }

          if (allDepsComplete) {
            status.set(taskId, 'running');
            this.running++;
            this.emit('task:started', { taskId });

            this._executeWithRetry(task, results)
              .then((result) => {
                status.set(taskId, 'completed').catch(err => { /* promise error absorbed */ });
                results.set(taskId, result).catch(err => { /* promise error absorbed */ });
                this.running--;
                this.completed++;
                this.emit('task:completed', { taskId }}).catch(err => { /* promise error absorbed */ });
              })
              .catch((taskErr) => {
                status.set(taskId, 'failed');
                results.set(taskId, { error: taskErr.message });
                this.running--;
                this.failed++;
                this.emit('task:failed', { taskId, error: taskErr.message });
              })
              .finally(() => {
                // Check if all done
                if (this.completed + this.failed >= this.totalTasks) {
                  const duration = Date.now() - startTime;
                  log('info', 'DAG execution complete', {
                    completed: this.completed,
                    failed: this.failed,
                    durationMs: duration,
                  });
                  this.emit('dag:complete', {
                    completed: this.completed,
                    failed: this.failed,
                    durationMs: duration,
                  });
                  resolve(results);
                } else {
                  // Schedule newly unblocked tasks
                  trySchedule();
                }
              });
          }
        }
      };

      trySchedule();

      // Handle empty DAG
      if (tasks.length === 0) {
        resolve(results);
      }
    });
  }

  // ─── Execute Independent Tasks Concurrently ───────────────────────────
  // Simpler API for tasks with no dependencies

  async executeConcurrent(taskFns) {
    const tasks = taskFns.map((fn, idx) => ({
      id: `task_${idx}`,
      fn,
      dependencies: [],
    }));
    return this.executeDAG(tasks);
  }

  // ─── Execute with Retry (phi-backoff) ─────────────────────────────────

  async _executeWithRetry(task, existingResults) {
    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Pass existing results to task function so it can access dependency outputs
        const result = await Promise.race([
          task.fn(existingResults),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Task timeout')), this.taskTimeout)
          ),
        ]);
        return result;
      } catch (retryErr) {
        lastError = retryErr;
        if (attempt < this.maxRetries) {
          const backoffMs = phiBackoffWithJitter(attempt);
          log('warn', 'Task retry', {
            taskId: task.id,
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            backoffMs,
            error: retryErr.message,
          });
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }

    throw lastError;
  }

  // ─── Get Executor State ───────────────────────────────────────────────

  getState() {
    return {
      running: this.running,
      completed: this.completed,
      failed: this.failed,
      totalTasks: this.totalTasks,
      maxConcurrency: this.maxConcurrency,
      progress: this.totalTasks > 0
        ? Math.round(((this.completed + this.failed) / this.totalTasks) * 1000) / 1000
        : 0,
    };
  }
}

module.exports = {
  AsyncParallelExecutor,
  MAX_CONCURRENCY,
  TASK_TIMEOUT_MS,
  QUEUE_DEPTH,
};
