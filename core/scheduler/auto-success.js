/**
 * Heady™ Auto-Success Scheduler — φ-Scaled Background Task Engine
 * ════════════════════════════════════════════════════════════════
 *
 * Consolidates:
 *   1. src/auto-success-engine.ts → 144-task heartbeat engine
 *   2. src/orchestration/heady-conductor.js → heartbeat monitoring
 *
 * Architecture:
 *   Schedules background tasks across 13 categories on φ-scaled cycles.
 *   Each category runs at its own frequency derived from PHI powers.
 *   Tasks are registered dynamically and monitored via heartbeat.
 *
 * @module core/scheduler/auto-success
 */
'use strict';

const EventEmitter = require('events');
const { PHI, fib, TIMING, AUTO_SUCCESS } = require('../constants/phi');

// ─── Task States ───────────────────────────────────────────────────────────────

const TASK_STATE = {
  PENDING:   'PENDING',
  RUNNING:   'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED:    'FAILED',
  DISABLED:  'DISABLED',
};

// ─── Auto-Success Scheduler ────────────────────────────────────────────────────

class AutoSuccessScheduler extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number} [opts.heartbeatMs]  - Base heartbeat interval (default: AUTO_SUCCESS.HEARTBEAT_MS)
   * @param {number} [opts.maxTasks]     - Max registered tasks (default: fib(12)=144)
   */
  constructor(opts = {}) {
    super();
    this.heartbeatMs = opts.heartbeatMs ?? AUTO_SUCCESS.HEARTBEAT_MS;  // ~29,034ms
    this.maxTasks    = opts.maxTasks    ?? fib(12);                      // 144

    // Task registry: taskId → { handler, category, interval, lastRun, state, metrics }
    this._tasks = new Map();

    // Category timers
    this._categoryTimers = new Map();

    // Global heartbeat
    this._heartbeatTimer = null;
    this._running = false;

    // Metrics
    this.totalExecutions = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
    this.startTime = null;
    this.cycleCount = 0;
  }

  // ─── Task Registration ──────────────────────────────────────────────────

  /**
   * Register a background task.
   * @param {string} taskId - Unique task identifier
   * @param {object} config
   * @param {function} config.handler    - async () => result
   * @param {string}   config.category   - One of AUTO_SUCCESS.CATEGORIES
   * @param {number}   [config.intervalMs] - Custom interval (default: category-based)
   * @param {boolean}  [config.enabled]  - Whether task is active (default: true)
   */
  registerTask(taskId, config) {
    if (this._tasks.size >= this.maxTasks) {
      throw new Error(`AutoSuccess: max tasks reached (${this.maxTasks})`);
    }

    const category = config.category || 'GENERAL';
    const intervalMs = config.intervalMs || this._categoryInterval(category);

    this._tasks.set(taskId, {
      taskId,
      handler: config.handler,
      category,
      intervalMs,
      enabled: config.enabled !== false,
      state: TASK_STATE.PENDING,
      lastRunAt: 0,
      lastResult: null,
      lastError: null,
      metrics: {
        runs: 0,
        successes: 0,
        failures: 0,
        totalDurationMs: 0,
      },
    });

    this.emit('task:registered', { taskId, category });
    return this;
  }

  /** Remove a task */
  removeTask(taskId) {
    const removed = this._tasks.delete(taskId);
    if (removed) this.emit('task:removed', { taskId });
    return removed;
  }

  /** Enable/disable a task */
  setTaskEnabled(taskId, enabled) {
    const task = this._tasks.get(taskId);
    if (!task) return false;
    task.enabled = enabled;
    task.state = enabled ? TASK_STATE.PENDING : TASK_STATE.DISABLED;
    return true;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /** Start the scheduler */
  start() {
    if (this._running) return;
    this._running = true;
    this.startTime = Date.now();

    // Start heartbeat
    this._heartbeatTimer = setInterval(() => this._heartbeat(), this.heartbeatMs);
    this.emit('started', { taskCount: this._tasks.size });
  }

  /** Stop the scheduler */
  stop() {
    this._running = false;

    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }

    for (const timer of this._categoryTimers.values()) {
      clearInterval(timer);
    }
    this._categoryTimers.clear();

    this.emit('stopped', { cycleCount: this.cycleCount });
  }

  // ─── Heartbeat ────────────────────────────────────────────────────────────

  async _heartbeat() {
    if (!this._running) return;
    this.cycleCount++;

    const now = Date.now();
    const tasksToRun = [];

    for (const [taskId, task] of this._tasks) {
      if (!task.enabled) continue;
      if (task.state === TASK_STATE.RUNNING) continue;

      // Check if task is due
      if (now - task.lastRunAt >= task.intervalMs) {
        tasksToRun.push(task);
      }
    }

    // Execute due tasks (concurrently, capped at fib(5)=5)
    const batch = tasksToRun.slice(0, fib(5));
    await Promise.allSettled(batch.map(task => this._executeTask(task)));

    this.emit('heartbeat', {
      cycle: this.cycleCount,
      tasksRun: batch.length,
      totalPending: tasksToRun.length,
    });
  }

  async _executeTask(task) {
    task.state = TASK_STATE.RUNNING;
    task.lastRunAt = Date.now();
    const startTime = Date.now();

    try {
      task.lastResult = await task.handler();
      task.state = TASK_STATE.COMPLETED;
      task.lastError = null;
      task.metrics.successes++;
      this.totalSuccesses++;
    } catch (err) {
      task.state = TASK_STATE.FAILED;
      task.lastError = err.message;
      task.lastResult = null;
      task.metrics.failures++;
      this.totalFailures++;
      this.emit('task:failed', { taskId: task.taskId, error: err.message });
    } finally {
      const duration = Date.now() - startTime;
      task.metrics.runs++;
      task.metrics.totalDurationMs += duration;
      this.totalExecutions++;
    }
  }

  // ─── Category Intervals (φ-scaled) ───────────────────────────────────────

  /**
   * Get the execution interval for a category.
   * Categories closer to core run more frequently.
   */
  _categoryInterval(category) {
    const intervals = {
      SECURITY:     Math.round(this.heartbeatMs * 0.5),      // 2x frequency
      MONITORING:   Math.round(this.heartbeatMs * 0.618),    // PSI frequency
      HEALTH:       this.heartbeatMs,                         // Base frequency
      OPTIMIZATION: Math.round(this.heartbeatMs * PHI),      // φ slower
      MAINTENANCE:  Math.round(this.heartbeatMs * PHI * PHI), // φ² slower
      LEARNING:     Math.round(this.heartbeatMs * Math.pow(PHI, 3)), // φ³ slower
      ANALYTICS:    Math.round(this.heartbeatMs * Math.pow(PHI, 3)),
      CONTENT:      Math.round(this.heartbeatMs * Math.pow(PHI, 4)), // φ⁴ slower
      INTEGRATION:  Math.round(this.heartbeatMs * Math.pow(PHI, 4)),
      BACKUP:       Math.round(this.heartbeatMs * Math.pow(PHI, 5)), // φ⁵ slower
      CLEANUP:      Math.round(this.heartbeatMs * Math.pow(PHI, 5)),
      REPORTING:    Math.round(this.heartbeatMs * Math.pow(PHI, 6)), // φ⁶ slower
      GENERAL:      Math.round(this.heartbeatMs * Math.pow(PHI, 3)),
    };
    return intervals[category] || intervals.GENERAL;
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  /** Get task status */
  getTaskStatus(taskId) {
    const task = this._tasks.get(taskId);
    if (!task) return null;
    return {
      taskId: task.taskId,
      category: task.category,
      state: task.state,
      enabled: task.enabled,
      intervalMs: task.intervalMs,
      lastRunAt: task.lastRunAt,
      lastError: task.lastError,
      metrics: {
        ...task.metrics,
        avgDurationMs: task.metrics.runs > 0
          ? Math.round(task.metrics.totalDurationMs / task.metrics.runs)
          : 0,
        successRate: task.metrics.runs > 0
          ? task.metrics.successes / task.metrics.runs
          : 1,
      },
    };
  }

  /** Get all tasks by category */
  getTasksByCategory() {
    const byCategory = {};
    for (const task of this._tasks.values()) {
      if (!byCategory[task.category]) byCategory[task.category] = [];
      byCategory[task.category].push(this.getTaskStatus(task.taskId));
    }
    return byCategory;
  }

  /** Scheduler health */
  health() {
    return {
      running: this._running,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      cycleCount: this.cycleCount,
      tasks: {
        total: this._tasks.size,
        enabled: [...this._tasks.values()].filter(t => t.enabled).length,
        running: [...this._tasks.values()].filter(t => t.state === TASK_STATE.RUNNING).length,
      },
      totalExecutions: this.totalExecutions,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      successRate: this.totalExecutions > 0
        ? this.totalSuccesses / this.totalExecutions
        : 1,
    };
  }
}

module.exports = { AutoSuccessScheduler, TASK_STATE };
