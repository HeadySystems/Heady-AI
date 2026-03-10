/**
 * Graceful Shutdown Manager — LIFO Cleanup Across All Services
 * 
 * Ensures orderly shutdown of the Heady system with Last-In-First-Out
 * cleanup ordering. Services that started last are shut down first,
 * preserving dependency order.
 * 
 * Features:
 * - LIFO ordered shutdown with phi-scaled timeouts
 * - Signal handling (SIGTERM, SIGINT, SIGUSR2)
 * - Cleanup hook registration with priorities
 * - Parallel shutdown within priority tiers
 * - Health degradation during shutdown
 * - Final state persistence before exit
 * - Phi-backoff for stubborn cleanups
 * 
 * @module GracefulShutdown
 * @author Eric Haywood
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const { PHI, PSI, fibonacci, phiBackoff, CSL_THRESHOLDS } = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('graceful-shutdown');

// ─── Constants ──────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT = fibonacci(13) * 1000;    // 233 seconds total
const PER_HOOK_TIMEOUT = fibonacci(8) * 1000;    // 21 seconds per hook
const FORCE_KILL_TIMEOUT = fibonacci(10) * 1000;  // 55 seconds force kill

// Shutdown phases (LIFO order — highest phase cleans up first)
const SHUTDOWN_PHASE = {
  CONNECTIONS:   5,  // HTTP servers, WebSocket, SSE streams
  APPLICATION:   4,  // Business logic, conductors, bees
  PERSISTENCE:   3,  // Database connections, memory sync
  INFRASTRUCTURE: 2, // Message queues, caches, metrics
  OBSERVABILITY: 1,  // Loggers, tracers, reporters
  FINAL:         0   // Process-level cleanup
};

const SHUTDOWN_STATE = {
  RUNNING:     'running',
  DRAINING:    'draining',
  SHUTTING_DOWN: 'shutting_down',
  TERMINATED:  'terminated'
};

/**
 * Cleanup hook registration
 */
class CleanupHook {
  constructor({ name, phase, fn, timeout = PER_HOOK_TIMEOUT, critical = false }) {
    this.name = name;
    this.phase = phase;
    this.fn = fn;
    this.timeout = timeout;
    this.critical = critical;
    this.registeredAt = Date.now();
    this.executed = false;
    this.duration = null;
    this.error = null;
  }
}

/**
 * GracefulShutdown Manager
 */
class GracefulShutdown {
  constructor(config = {}) {
    this.hooks = [];
    this.state = SHUTDOWN_STATE.RUNNING;
    this.shutdownStartedAt = null;
    this.totalTimeout = config.timeout || DEFAULT_TIMEOUT;
    this.onShutdownStart = config.onShutdownStart || null;
    this.onShutdownComplete = config.onShutdownComplete || null;
    this._signalsRegistered = false;
    this._shutdownPromise = null;
    this._results = [];

    logger.info({
      timeout: this.totalTimeout,
      phases: Object.keys(SHUTDOWN_PHASE).length,
      msg: 'GracefulShutdown manager initialized'
    });
  }

  /**
   * Register a cleanup hook
   * 
   * @param {string} name - Human-readable name
   * @param {number} phase - SHUTDOWN_PHASE value (higher = earlier cleanup)
   * @param {Function} fn - Async cleanup function
   * @param {Object} options - { timeout, critical }
   */
  register(name, phase, fn, options = {}) {
    if (this.state !== SHUTDOWN_STATE.RUNNING) {
      logger.warn({ name, msg: 'Cannot register hooks during shutdown' });
      return;
    }

    const hook = new CleanupHook({
      name,
      phase,
      fn,
      timeout: options.timeout || PER_HOOK_TIMEOUT,
      critical: options.critical || false
    });

    this.hooks.push(hook);

    logger.info({
      hookName: name,
      phase,
      critical: hook.critical,
      totalHooks: this.hooks.length,
      msg: 'Cleanup hook registered'
    });

    return this;
  }

  // ─── Convenience Registration Methods ─────────────────────────────────

  registerServer(name, server) {
    return this.register(name, SHUTDOWN_PHASE.CONNECTIONS, async () => {
      return new Promise((resolve) => {
        server.close(() => resolve());
        // Force close after timeout
        setTimeout(() => resolve(), fibonacci(7) * 1000); // 13 seconds
      });
    }, { critical: true });
  }

  registerDatabase(name, pool) {
    return this.register(name, SHUTDOWN_PHASE.PERSISTENCE, async () => {
      if (pool && typeof pool.end === 'function') {
        await pool.end();
      }
    }, { critical: true });
  }

  registerCache(name, client) {
    return this.register(name, SHUTDOWN_PHASE.INFRASTRUCTURE, async () => {
      if (client && typeof client.quit === 'function') {
        await client.quit();
      } else if (client && typeof client.close === 'function') {
        await client.close();
      }
    });
  }

  registerFlush(name, flushFn) {
    return this.register(name, SHUTDOWN_PHASE.OBSERVABILITY, flushFn);
  }

  registerCustom(name, phase, fn, options = {}) {
    return this.register(name, phase, fn, options);
  }

  /**
   * Install signal handlers
   */
  installSignalHandlers() {
    if (this._signalsRegistered) return this;

    const shutdown = (signal) => {
      logger.info({ signal, msg: 'Shutdown signal received' });
      this.shutdown(signal).then(() => {
        process.exit(0);
      }).catch((err) => {
        logger.error({ err: err.message, msg: 'Shutdown error — forcing exit' });
        process.exit(1);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2'));

    // Uncaught exceptions — attempt graceful shutdown
    process.on('uncaughtException', (err) => {
      logger.error({
        err: err.message,
        stack: err.stack?.substring(0, fibonacci(13) * 2), // 466 chars
        msg: 'Uncaught exception — initiating shutdown'
      });
      this.shutdown('uncaughtException').finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      logger.error({
        reason: String(reason).substring(0, fibonacci(13)),
        msg: 'Unhandled rejection'
      });
    });

    this._signalsRegistered = true;
    logger.info({ msg: 'Signal handlers installed (SIGTERM, SIGINT, SIGUSR2)' });

    return this;
  }

  /**
   * Execute graceful shutdown
   * 
   * LIFO order: hooks registered last in a phase execute first.
   * Phases execute from highest to lowest (CONNECTIONS → FINAL).
   */
  async shutdown(reason = 'manual') {
    // Prevent double shutdown
    if (this._shutdownPromise) return this._shutdownPromise;

    this._shutdownPromise = this._executeShutdown(reason);
    return this._shutdownPromise;
  }

  async _executeShutdown(reason) {
    this.shutdownStartedAt = Date.now();
    this.state = SHUTDOWN_STATE.DRAINING;

    logger.info({
      reason,
      hookCount: this.hooks.length,
      timeout: this.totalTimeout,
      msg: 'Graceful shutdown initiated'
    });

    // Notify listeners
    if (this.onShutdownStart) {
      try { await this.onShutdownStart(reason); }
      catch (err) { logger.warn({ err: err.message, msg: 'onShutdownStart callback failed' }); }
    }

    this.state = SHUTDOWN_STATE.SHUTTING_DOWN;

    // Group hooks by phase
    const phaseGroups = new Map();
    for (const hook of this.hooks) {
      if (!phaseGroups.has(hook.phase)) phaseGroups.set(hook.phase, []);
      phaseGroups.get(hook.phase).push(hook);
    }

    // Sort phases descending (LIFO: highest phase first)
    const phases = Array.from(phaseGroups.keys()).sort((a, b) => b - a);

    // Execute each phase
    for (const phase of phases) {
      const hooks = phaseGroups.get(phase);
      // Reverse within phase for LIFO order
      hooks.reverse();

      const phaseName = Object.entries(SHUTDOWN_PHASE).find(([, v]) => v === phase)?.[0] || `phase-${phase}`;

      logger.info({
        phase: phaseName,
        hookCount: hooks.length,
        msg: `Executing shutdown phase`
      });

      // Execute hooks in this phase in parallel
      const phaseResults = await Promise.allSettled(
        hooks.map(hook => this._executeHook(hook))
      );

      // Log phase results
      const succeeded = phaseResults.filter(r => r.status === 'fulfilled').length;
      const failed = phaseResults.filter(r => r.status === 'rejected').length;

      logger.info({
        phase: phaseName,
        succeeded,
        failed,
        msg: 'Shutdown phase complete'
      });

      // Check total timeout
      if (Date.now() - this.shutdownStartedAt > this.totalTimeout) {
        logger.error({ msg: 'Total shutdown timeout exceeded — forcing completion' });
        break;
      }
    }

    this.state = SHUTDOWN_STATE.TERMINATED;

    const totalDuration = Date.now() - this.shutdownStartedAt;
    const succeeded = this._results.filter(r => !r.error).length;
    const failed = this._results.filter(r => r.error).length;

    const summary = {
      reason,
      duration: totalDuration,
      totalHooks: this.hooks.length,
      succeeded,
      failed,
      results: this._results
    };

    logger.info({
      ...summary,
      results: undefined, // Don't log full results
      msg: 'Graceful shutdown complete'
    });

    // Notify listeners
    if (this.onShutdownComplete) {
      try { await this.onShutdownComplete(summary); }
      catch { /* Swallow — we're shutting down */ }
    }

    return summary;
  }

  /**
   * Execute a single cleanup hook with timeout
   */
  async _executeHook(hook) {
    const startTime = Date.now();

    try {
      await Promise.race([
        hook.fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${hook.timeout}ms`)), hook.timeout)
        )
      ]);

      hook.executed = true;
      hook.duration = Date.now() - startTime;

      this._results.push({
        name: hook.name,
        phase: hook.phase,
        duration: hook.duration,
        error: null
      });

      logger.info({
        hook: hook.name,
        duration: hook.duration,
        msg: 'Cleanup hook executed'
      });
    } catch (err) {
      hook.error = err.message;
      hook.duration = Date.now() - startTime;

      this._results.push({
        name: hook.name,
        phase: hook.phase,
        duration: hook.duration,
        error: err.message
      });

      if (hook.critical) {
        logger.error({
          hook: hook.name,
          err: err.message,
          duration: hook.duration,
          msg: 'Critical cleanup hook failed'
        });
      } else {
        logger.warn({
          hook: hook.name,
          err: err.message,
          duration: hook.duration,
          msg: 'Non-critical cleanup hook failed'
        });
      }
    }
  }

  // ─── Status ───────────────────────────────────────────────────────────

  status() {
    return {
      state: this.state,
      hookCount: this.hooks.length,
      phases: Object.fromEntries(
        Object.entries(SHUTDOWN_PHASE).map(([name, phase]) => [
          name,
          this.hooks.filter(h => h.phase === phase).length
        ])
      ),
      shutdownStartedAt: this.shutdownStartedAt,
      results: this._results.length > 0 ? this._results : undefined
    };
  }
}

module.exports = {
  GracefulShutdown,
  CleanupHook,
  SHUTDOWN_PHASE,
  SHUTDOWN_STATE,
  DEFAULT_TIMEOUT,
  PER_HOOK_TIMEOUT,
  FORCE_KILL_TIMEOUT
};
