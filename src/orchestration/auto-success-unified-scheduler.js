/**
 * Auto-Success Unified Scheduler — Single scheduling authority.
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Bridges hc_auto_success.js (event-driven reactor) and auto-success-engine.js
 * (cycle-based executor) under a single scheduler. Prevents duplicate execution
 * and uses Fibonacci-timed intervals for pool cycling.
 */
'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

const PHI = (1 + Math.sqrt(5)) / 2;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

class UnifiedScheduler extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._running = false;
    this._executingTasks = new Set(); // prevent duplicate execution
    this._completedCount = 0;
    this._failedCount = 0;
    this._cycleCount = 0;
    this._pools = { hot: [], warm: [], cold: [] };
    this._fibIndex = 0; // current Fibonacci interval index
    this._timer = null;
    this._baseIntervalMs = opts.baseIntervalMs || 1000;
    this._maxConcurrency = opts.maxConcurrency || 13; // fib(7)
    this._taskExecutor = opts.taskExecutor || null;
    this._startedAt = null;
  }

  /**
   * Load tasks from the catalog into pools.
   */
  loadTasks(tasks) {
    this._pools = { hot: [], warm: [], cold: [] };
    for (const task of tasks) {
      const pool = task.pool || 'warm';
      if (this._pools[pool]) {
        this._pools[pool].push(task);
      } else {
        this._pools.warm.push(task);
      }
    }
    this.emit('tasks:loaded', {
      hot: this._pools.hot.length,
      warm: this._pools.warm.length,
      cold: this._pools.cold.length,
      total: tasks.length,
    });
    return this;
  }

  /**
   * Start the unified scheduling loop.
   */
  start() {
    if (this._running) return this;
    this._running = true;
    this._startedAt = new Date().toISOString();
    this._scheduleNextCycle();
    this.emit('scheduler:started', { startedAt: this._startedAt });
    return this;
  }

  stop() {
    this._running = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    this.emit('scheduler:stopped', { cycles: this._cycleCount, completed: this._completedCount });
    return this;
  }

  /**
   * Execute a single cycle — process tasks from hot → warm → cold pools.
   */
  async _executeCycle() {
    this._cycleCount++;
    const cycleId = crypto.randomBytes(4).toString('hex');

    // Determine batch: hot pool every cycle, warm every φ cycles, cold every φ² cycles
    const batch = [...this._pools.hot];
    if (this._cycleCount % Math.round(PHI) === 0) batch.push(...this._pools.warm);
    if (this._cycleCount % Math.round(PHI * PHI) === 0) batch.push(...this._pools.cold);

    // Limit concurrency
    const toExecute = batch
      .filter(t => !this._executingTasks.has(t.id))
      .sort((a, b) => (b.w || 1) - (a.w || 1))
      .slice(0, this._maxConcurrency);

    this.emit('cycle:started', { cycleId, count: toExecute.length, cycleNumber: this._cycleCount });

    const results = await Promise.allSettled(
      toExecute.map(task => this._executeTask(task, cycleId))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    this.emit('cycle:completed', { cycleId, succeeded, failed, cycleNumber: this._cycleCount });

    if (this._running) this._scheduleNextCycle();
  }

  async _executeTask(task, cycleId) {
    if (this._executingTasks.has(task.id)) return; // prevent duplicate
    this._executingTasks.add(task.id);

    try {
      if (this._taskExecutor) {
        await this._taskExecutor(task);
      }
      this._completedCount++;
      this.emit('task:completed', { taskId: task.id, cycleId });
    } catch (err) {
      this._failedCount++;
      this.emit('task:failed', { taskId: task.id, cycleId, error: err.message });
    } finally {
      this._executingTasks.delete(task.id);
    }
  }

  _scheduleNextCycle() {
    // Fibonacci-timed intervals: cycle through fib sequence
    this._fibIndex = (this._fibIndex + 1) % FIB.length;
    const intervalMs = FIB[Math.min(this._fibIndex, 7)] * this._baseIntervalMs;
    this._timer = setTimeout(() => this._executeCycle(), intervalMs);
  }

  /**
   * Trigger an immediate reaction (event-driven, bypasses cycle timer).
   */
  react(event) {
    if (!this._running) return;
    // Immediately execute hot pool tasks relevant to this event
    const relevant = this._pools.hot.filter(t => !this._executingTasks.has(t.id));
    if (relevant.length > 0) {
      this._executeCycle();
    }
    this.emit('reaction', { event: event.trigger, tasksTriggered: relevant.length });
  }

  health() {
    return {
      service: 'auto-success-unified-scheduler',
      running: this._running,
      startedAt: this._startedAt,
      cycles: this._cycleCount,
      completed: this._completedCount,
      failed: this._failedCount,
      executing: this._executingTasks.size,
      pools: {
        hot: this._pools.hot.length,
        warm: this._pools.warm.length,
        cold: this._pools.cold.length,
      },
      throughput: this._cycleCount > 0 ? (this._completedCount / this._cycleCount).toFixed(2) : '0',
    };
  }
}

module.exports = { UnifiedScheduler };
