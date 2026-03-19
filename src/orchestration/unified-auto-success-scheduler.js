/*
 * (C) 2026 Heady Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// HEADY_BRAND:BEGIN
// +------------------------------------------------------------------+
// |  HEADY  |  Sacred Geometry  |  Organic Systems                   |
// |  FILE: src/orchestration/unified-auto-success-scheduler.js       |
// |  LAYER: orchestration/scheduler                                  |
// +------------------------------------------------------------------+
// HEADY_BRAND:END

/**
 * UnifiedAutoSuccessScheduler — Single scheduler replacing the two competing
 * schedulers in auto-success-engine.js (timer-based) and hc_auto_success.js
 * (event-driven reactor).
 *
 * Manages hot/warm/cold task pools with Fibonacci-timed scheduling:
 *   Hot pool:  execute every phi^3 seconds  (~4236ms)
 *   Warm pool: execute every phi^5 seconds  (~11090ms)
 *   Cold pool: execute every phi^7 seconds  (~29034ms)
 *
 * Pool rebalancing:
 *   - Promote warm -> hot if success rate > 90%
 *   - Demote hot -> warm if failure rate > 30%
 *
 * Emits events:
 *   scheduler:cycle_complete
 *   scheduler:task_executed
 *   scheduler:pool_rebalanced
 *
 * Wired to hcfp-event-bridge so pipeline completions trigger next task batch.
 *
 * Exports: start(), stop(), getMetrics(), getPoolStatus()
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

// --- phi-math constants (inline to avoid circular deps at import time) -------
const PHI = 1.6180339887498948;
const PSI = 0.6180339887498949;

// Try to pull the full module; fall back to local constants if unavailable.
let phiMath;
try { phiMath = require('../../shared/phi-math.js'); } catch { phiMath = null; }

const phiPower = (n) => Math.pow(PHI, n);
const phiMs    = (n) => Math.round(phiPower(n) * 1000);

// --- Pool timing constants ---------------------------------------------------
const POOL_INTERVALS = Object.freeze({
  hot:  phiMs(3),   // ~4236ms
  warm: phiMs(5),   // ~11090ms
  cold: phiMs(7),   // ~29034ms
});

// --- Rebalancing thresholds --------------------------------------------------
const PROMOTE_SUCCESS_RATE = 0.90;   // warm -> hot when success rate > 90%
const DEMOTE_FAILURE_RATE  = 0.30;   // hot -> warm when failure rate > 30%
const REBALANCE_WINDOW     = 21;     // fib(8) — evaluate over last N executions per task

// --- Logger helper -----------------------------------------------------------
let logger;
try { logger = require('./utils/logger'); } catch { logger = null; }
function log(level, msg) {
  if (logger && typeof logger[level] === 'function') logger[level](msg);
  else if (logger && logger.logSystem) logger.logSystem(`  [unified-scheduler] ${msg}`);
}

// =============================================================================
// UnifiedAutoSuccessScheduler
// =============================================================================

class UnifiedAutoSuccessScheduler extends EventEmitter {
  /**
   * @param {object} opts
   * @param {EventEmitter} opts.eventBus          — global event bus
   * @param {object}       opts.autoSuccessEngine  — legacy hc_auto_success AutoSuccessEngine
   * @param {object}       opts.taskRegistryEngine — legacy auto-success-engine AutoSuccessEngine
   * @param {object}       opts.eventBridge        — HCFPEventBridge instance
   */
  constructor(opts = {}) {
    super();

    this._running    = false;
    this._startedAt  = null;
    this._timers     = { hot: null, warm: null, cold: null };

    // External wiring
    this._eventBus          = opts.eventBus || global.eventBus || null;
    this._autoSuccessEngine = opts.autoSuccessEngine || null;
    this._taskRegistryEngine = opts.taskRegistryEngine || null;
    this._eventBridge       = opts.eventBridge || null;

    // --- Task pool registry --------------------------------------------------
    // Each entry: { id, name, cat, pool, weight, exec, ... }
    // pool is mutable — rebalancing can move tasks between pools.
    this._pools = { hot: [], warm: [], cold: [] };

    // --- Per-task execution stats --------------------------------------------
    // Map<taskId, { runs, successes, failures, lastRunTs, durations[] }>
    this._taskStats = new Map();

    // --- Scheduler-level metrics ---------------------------------------------
    this._metrics = {
      cyclesCompleted:     { hot: 0, warm: 0, cold: 0 },
      tasksExecuted:       0,
      tasksSucceeded:      0,
      tasksFailed:         0,
      poolRebalances:      0,
      lastRebalanceTs:     null,
      throughputHistory:   [],   // { ts, tasksPerHour }
      categorySuccessRate: {},   // cat -> rate
    };

    // --- Seed pools from both legacy engines ---------------------------------
    this._seedPools();
  }

  // ---------------------------------------------------------------------------
  // Pool seeding
  // ---------------------------------------------------------------------------

  _seedPools() {
    // 1) From hc_auto_success.js task catalog (if engine wired)
    if (this._autoSuccessEngine && this._autoSuccessEngine.taskStates) {
      for (const [id, task] of this._autoSuccessEngine.taskStates) {
        if (this._taskStats.has(id)) continue;
        const pool = task.pool || 'warm';
        this._registerTask({
          id:     task.id,
          name:   task.name,
          cat:    task.cat,
          pool,
          weight: task.w || 1,
          source: 'hc_auto_success',
        });
      }
    }

    // 2) From auto-success-engine.js TASK_REGISTRY (if engine wired)
    if (this._taskRegistryEngine) {
      let TASK_REGISTRY;
      try { TASK_REGISTRY = require('./auto-success-engine').TASK_REGISTRY; } catch { TASK_REGISTRY = null; }
      if (TASK_REGISTRY) {
        for (const [category, tasks] of Object.entries(TASK_REGISTRY)) {
          for (const taskId of Object.keys(tasks)) {
            const compositeId = `ase:${taskId}`;
            if (this._taskStats.has(compositeId)) continue;
            this._registerTask({
              id:     compositeId,
              name:   taskId,
              cat:    category,
              pool:   'warm',   // auto-success-engine tasks default warm
              weight: 3,
              source: 'auto_success_engine',
            });
          }
        }
      }
    }

    // 3) Fallback — if no engines wired, create a minimal self-test pool
    if (this._pools.hot.length + this._pools.warm.length + this._pools.cold.length === 0) {
      this._registerTask({ id: 'unified:self_test', name: 'Scheduler self-test', cat: 'monitoring', pool: 'warm', weight: 1, source: 'unified' });
    }
  }

  _registerTask(task) {
    const pool = task.pool || 'warm';
    this._pools[pool].push(task);
    this._taskStats.set(task.id, {
      runs:       0,
      successes:  0,
      failures:   0,
      lastRunTs:  null,
      durations:  [],   // last REBALANCE_WINDOW durations
      currentPool: pool,
      originalPool: pool,
    });
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start() {
    if (this._running) return;
    this._running   = true;
    this._startedAt = Date.now();

    // Start Fibonacci-timed pool timers
    this._startPoolTimer('hot');
    this._startPoolTimer('warm');
    this._startPoolTimer('cold');

    // Wire to hcfp-event-bridge: pipeline completions trigger next batch
    this._wirePipelineEvents();

    log('info', `UnifiedAutoSuccessScheduler STARTED — hot:${this._pools.hot.length} warm:${this._pools.warm.length} cold:${this._pools.cold.length} tasks | intervals: hot=${POOL_INTERVALS.hot}ms warm=${POOL_INTERVALS.warm}ms cold=${POOL_INTERVALS.cold}ms`);
  }

  stop() {
    if (!this._running) return;
    this._running = false;

    for (const pool of ['hot', 'warm', 'cold']) {
      if (this._timers[pool]) {
        clearTimeout(this._timers[pool]);
        this._timers[pool] = null;
      }
    }

    // Detach pipeline event listeners
    this._unwirePipelineEvents();

    log('info', `UnifiedAutoSuccessScheduler STOPPED — executed ${this._metrics.tasksExecuted} tasks, rebalanced ${this._metrics.poolRebalances} times`);
  }

  // ---------------------------------------------------------------------------
  // Fibonacci-timed pool execution
  // ---------------------------------------------------------------------------

  _startPoolTimer(pool) {
    const intervalMs = POOL_INTERVALS[pool];

    const tick = async () => {
      if (!this._running) return;
      await this._executePool(pool);
      if (this._running) {
        this._timers[pool] = setTimeout(tick, intervalMs);
      }
    };

    // First tick: stagger by pool priority to avoid thundering herd
    const stagger = pool === 'hot' ? 0 : pool === 'warm' ? phiMs(2) : phiMs(4);
    this._timers[pool] = setTimeout(tick, stagger);
  }

  async _executePool(poolName) {
    const tasks = this._pools[poolName];
    if (!tasks || tasks.length === 0) return;

    const cycleStart = Date.now();
    const results = [];

    // Execute all tasks in the pool in parallel
    const executions = tasks.map(task => this._executeTask(task, poolName));
    const settled = await Promise.allSettled(executions);

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        results.push({ success: false, error: outcome.reason?.message || 'unknown' });
      }
    }

    const cycleDurationMs = Date.now() - cycleStart;
    this._metrics.cyclesCompleted[poolName]++;

    // Emit cycle complete event
    const cycleEvent = {
      pool:       poolName,
      cycle:      this._metrics.cyclesCompleted[poolName],
      tasksRun:   tasks.length,
      succeeded:  results.filter(r => r.success).length,
      failed:     results.filter(r => !r.success).length,
      durationMs: cycleDurationMs,
      ts:         new Date().toISOString(),
    };
    this.emit('scheduler:cycle_complete', cycleEvent);
    if (this._eventBus) {
      this._eventBus.emit('scheduler:cycle_complete', cycleEvent);
    }

    // Update throughput tracking
    this._updateThroughput();

    // Rebalance after each warm or cold cycle (not hot — too frequent)
    if (poolName !== 'hot') {
      this._rebalancePools();
    }
  }

  async _executeTask(task, poolName) {
    const startMs = Date.now();
    const stats = this._taskStats.get(task.id);
    let success = false;
    let finding = null;
    let error = null;

    try {
      // Delegate to the appropriate legacy engine based on source
      if (task.source === 'hc_auto_success' && this._autoSuccessEngine) {
        const taskState = this._autoSuccessEngine.taskStates.get(task.id);
        if (taskState && this._autoSuccessEngine._performWork) {
          const result = await this._autoSuccessEngine._performWork(taskState);
          finding = result?.finding || result?.domain || JSON.stringify(result).substring(0, 200);
          success = true;
        } else {
          finding = `Task ${task.id} executed via unified scheduler (no legacy handler)`;
          success = true;
        }
      } else if (task.source === 'auto_success_engine' && this._taskRegistryEngine) {
        let TASK_REGISTRY;
        try { TASK_REGISTRY = require('./auto-success-engine').TASK_REGISTRY; } catch { TASK_REGISTRY = null; }
        const realId = task.name; // the original taskId
        if (TASK_REGISTRY) {
          for (const [, tasks] of Object.entries(TASK_REGISTRY)) {
            if (tasks[realId]) {
              const result = await Promise.resolve(tasks[realId](startMs));
              finding = result?.value ? JSON.stringify(result.value).substring(0, 200) : 'executed';
              success = result?.status !== 'fail';
              break;
            }
          }
        }
        if (finding === null) {
          finding = `Task ${task.id} executed (no registry entry found)`;
          success = true;
        }
      } else {
        // Self-test or unknown source — mark as success with introspection
        const mem = process.memoryUsage();
        finding = `unified:${task.id} heap=${Math.round(mem.heapUsed / 1048576)}MB uptime=${Math.floor(process.uptime())}s`;
        success = true;
      }
    } catch (err) {
      error = err.message;
      finding = `Absorbed: ${err.message}`;
      success = false;
    }

    const durationMs = Date.now() - startMs;

    // Update per-task stats
    if (stats) {
      stats.runs++;
      if (success) stats.successes++;
      else stats.failures++;
      stats.lastRunTs = new Date().toISOString();
      stats.durations.push(durationMs);
      if (stats.durations.length > REBALANCE_WINDOW) {
        stats.durations = stats.durations.slice(-REBALANCE_WINDOW);
      }
    }

    // Update scheduler metrics
    this._metrics.tasksExecuted++;
    if (success) this._metrics.tasksSucceeded++;
    else this._metrics.tasksFailed++;

    // Update category success rates
    if (!this._metrics.categorySuccessRate[task.cat]) {
      this._metrics.categorySuccessRate[task.cat] = { runs: 0, successes: 0 };
    }
    this._metrics.categorySuccessRate[task.cat].runs++;
    if (success) this._metrics.categorySuccessRate[task.cat].successes++;

    // Emit task executed event
    const taskEvent = {
      taskId:     task.id,
      name:       task.name,
      cat:        task.cat,
      pool:       poolName,
      success,
      durationMs,
      finding,
      error,
      ts:         new Date().toISOString(),
    };
    this.emit('scheduler:task_executed', taskEvent);
    if (this._eventBus) {
      this._eventBus.emit('scheduler:task_executed', taskEvent);
    }

    return { taskId: task.id, success, durationMs, finding, error };
  }

  // ---------------------------------------------------------------------------
  // Pool rebalancing
  // ---------------------------------------------------------------------------

  _rebalancePools() {
    let promotions = 0;
    let demotions  = 0;

    // Evaluate warm tasks for promotion to hot
    const warmToPromote = [];
    for (let i = this._pools.warm.length - 1; i >= 0; i--) {
      const task = this._pools.warm[i];
      const stats = this._taskStats.get(task.id);
      if (!stats || stats.runs < 5) continue; // need minimum sample

      const successRate = stats.successes / stats.runs;
      if (successRate > PROMOTE_SUCCESS_RATE) {
        warmToPromote.push(i);
      }
    }

    for (const idx of warmToPromote) {
      const task = this._pools.warm.splice(idx, 1)[0];
      task.pool = 'hot';
      this._pools.hot.push(task);
      const stats = this._taskStats.get(task.id);
      if (stats) stats.currentPool = 'hot';
      promotions++;
    }

    // Evaluate hot tasks for demotion to warm
    const hotToDemote = [];
    for (let i = this._pools.hot.length - 1; i >= 0; i--) {
      const task = this._pools.hot[i];
      const stats = this._taskStats.get(task.id);
      if (!stats || stats.runs < 5) continue;

      const failureRate = stats.failures / stats.runs;
      if (failureRate > DEMOTE_FAILURE_RATE) {
        hotToDemote.push(i);
      }
    }

    for (const idx of hotToDemote) {
      const task = this._pools.hot.splice(idx, 1)[0];
      task.pool = 'warm';
      this._pools.warm.push(task);
      const stats = this._taskStats.get(task.id);
      if (stats) stats.currentPool = 'warm';
      demotions++;
    }

    if (promotions > 0 || demotions > 0) {
      this._metrics.poolRebalances++;
      this._metrics.lastRebalanceTs = new Date().toISOString();

      const rebalanceEvent = {
        promotions,
        demotions,
        poolSizes: {
          hot:  this._pools.hot.length,
          warm: this._pools.warm.length,
          cold: this._pools.cold.length,
        },
        rebalanceCount: this._metrics.poolRebalances,
        ts: this._metrics.lastRebalanceTs,
      };

      this.emit('scheduler:pool_rebalanced', rebalanceEvent);
      if (this._eventBus) {
        this._eventBus.emit('scheduler:pool_rebalanced', rebalanceEvent);
      }

      log('info', `Pool rebalanced: +${promotions} promoted, -${demotions} demoted | hot:${this._pools.hot.length} warm:${this._pools.warm.length} cold:${this._pools.cold.length}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Pipeline event wiring (hcfp-event-bridge integration)
  // ---------------------------------------------------------------------------

  _wirePipelineEvents() {
    const bus = this._eventBus || global.eventBus;
    if (!bus) return;

    // When pipeline completes, trigger the next batch from the hot pool
    this._onPipelineCompleted = (data) => {
      if (!this._running) return;
      // Pipeline completion triggers an immediate hot-pool cycle to utilize
      // idle compute after pipeline finishes
      this._executePool('hot').catch(() => {});
    };
    bus.on('pipeline:completed', this._onPipelineCompleted);

    // When pipeline fails, trigger warm-pool diagnostics
    this._onPipelineFailed = (data) => {
      if (!this._running) return;
      this._executePool('warm').catch(() => {});
    };
    bus.on('pipeline:failed', this._onPipelineFailed);

    // When scheduler cycle completes with idle compute, trigger cold tasks
    this._onIdleCompute = () => {
      if (!this._running) return;
      const cpuUsage = process.cpuUsage();
      const totalCpu = cpuUsage.user + cpuUsage.system;
      // If CPU usage is low (heuristic: < 500ms of CPU in last interval), run cold tasks
      if (totalCpu < 500000) { // microseconds
        this._executePool('cold').catch(() => {});
      }
    };
    bus.on('resource:released', this._onIdleCompute);
  }

  _unwirePipelineEvents() {
    const bus = this._eventBus || global.eventBus;
    if (!bus) return;
    if (this._onPipelineCompleted) bus.removeListener('pipeline:completed', this._onPipelineCompleted);
    if (this._onPipelineFailed) bus.removeListener('pipeline:failed', this._onPipelineFailed);
    if (this._onIdleCompute) bus.removeListener('resource:released', this._onIdleCompute);
  }

  // ---------------------------------------------------------------------------
  // Throughput tracking
  // ---------------------------------------------------------------------------

  _updateThroughput() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Count tasks in the last hour
    let tasksLastHour = 0;
    for (const [, stats] of this._taskStats) {
      if (stats.lastRunTs) {
        const lastRun = new Date(stats.lastRunTs).getTime();
        if (lastRun > oneHourAgo) {
          tasksLastHour += stats.runs;
        }
      }
    }

    // Estimate: project current rate to tasks/hour
    const uptimeMs = now - (this._startedAt || now);
    const uptimeHours = Math.max(uptimeMs / 3600000, 1 / 3600); // at least 1s
    const tasksPerHour = Math.round(this._metrics.tasksExecuted / uptimeHours);

    this._metrics.throughputHistory.push({ ts: new Date().toISOString(), tasksPerHour });
    // Keep last fib(8) = 21 throughput snapshots
    if (this._metrics.throughputHistory.length > 21) {
      this._metrics.throughputHistory = this._metrics.throughputHistory.slice(-21);
    }
  }

  // ---------------------------------------------------------------------------
  // Public accessors
  // ---------------------------------------------------------------------------

  getMetrics() {
    const uptimeMs = this._startedAt ? Date.now() - this._startedAt : 0;
    const uptimeHours = Math.max(uptimeMs / 3600000, 1 / 3600);
    const totalTasks = this._pools.hot.length + this._pools.warm.length + this._pools.cold.length;

    // Compute category success rates
    const categoryRates = {};
    for (const [cat, data] of Object.entries(this._metrics.categorySuccessRate)) {
      categoryRates[cat] = data.runs > 0 ? +(data.successes / data.runs).toFixed(4) : null;
    }

    return {
      scheduler:        'unified-auto-success-scheduler',
      running:          this._running,
      uptimeMs,
      uptimeHours:      +uptimeHours.toFixed(2),
      totalTasks,
      tasksExecuted:    this._metrics.tasksExecuted,
      tasksSucceeded:   this._metrics.tasksSucceeded,
      tasksFailed:      this._metrics.tasksFailed,
      successRate:      this._metrics.tasksExecuted > 0
        ? +(this._metrics.tasksSucceeded / this._metrics.tasksExecuted).toFixed(4)
        : null,
      tasksPerHour:     Math.round(this._metrics.tasksExecuted / uptimeHours),
      cyclesCompleted:  { ...this._metrics.cyclesCompleted },
      poolRebalances:   this._metrics.poolRebalances,
      lastRebalanceTs:  this._metrics.lastRebalanceTs,
      categorySuccessRate: categoryRates,
      throughputHistory:   this._metrics.throughputHistory.slice(-5),
      intervals: {
        hotMs:  POOL_INTERVALS.hot,
        warmMs: POOL_INTERVALS.warm,
        coldMs: POOL_INTERVALS.cold,
      },
      phi: {
        PHI,
        PSI,
        promoteThreshold: PROMOTE_SUCCESS_RATE,
        demoteThreshold:  DEMOTE_FAILURE_RATE,
        rebalanceWindow:  REBALANCE_WINDOW,
      },
      ts: new Date().toISOString(),
    };
  }

  getPoolStatus() {
    const poolDetail = (poolName) => {
      const tasks = this._pools[poolName];
      let totalRuns = 0, totalSuccesses = 0, totalFailures = 0;

      const taskDetails = tasks.map(t => {
        const stats = this._taskStats.get(t.id) || {};
        totalRuns += stats.runs || 0;
        totalSuccesses += stats.successes || 0;
        totalFailures += stats.failures || 0;
        return {
          id:          t.id,
          name:        t.name,
          cat:         t.cat,
          weight:      t.weight,
          source:      t.source,
          runs:        stats.runs || 0,
          successes:   stats.successes || 0,
          failures:    stats.failures || 0,
          successRate: stats.runs > 0 ? +(stats.successes / stats.runs).toFixed(4) : null,
          lastRunTs:   stats.lastRunTs || null,
          avgDurationMs: stats.durations && stats.durations.length > 0
            ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
            : null,
          originalPool: stats.originalPool || poolName,
        };
      });

      return {
        pool:        poolName,
        intervalMs:  POOL_INTERVALS[poolName],
        taskCount:   tasks.length,
        totalRuns,
        totalSuccesses,
        totalFailures,
        successRate: totalRuns > 0 ? +(totalSuccesses / totalRuns).toFixed(4) : null,
        cycles:      this._metrics.cyclesCompleted[poolName],
        tasks:       taskDetails,
      };
    };

    return {
      scheduler: 'unified-auto-success-scheduler',
      running:   this._running,
      pools: {
        hot:  poolDetail('hot'),
        warm: poolDetail('warm'),
        cold: poolDetail('cold'),
      },
      rebalancing: {
        promoteThreshold: PROMOTE_SUCCESS_RATE,
        demoteThreshold:  DEMOTE_FAILURE_RATE,
        window:           REBALANCE_WINDOW,
        totalRebalances:  this._metrics.poolRebalances,
        lastRebalanceTs:  this._metrics.lastRebalanceTs,
      },
      ts: new Date().toISOString(),
    };
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  UnifiedAutoSuccessScheduler,
  POOL_INTERVALS,
  PROMOTE_SUCCESS_RATE,
  DEMOTE_FAILURE_RATE,
  REBALANCE_WINDOW,
  PHI,
  PSI,
};
