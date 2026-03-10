/**
 * ∞ Heady™ Graceful Shutdown — Canonical Implementation
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 *
 * Single source of truth for graceful shutdown logic.
 * All services MUST import from this module instead of
 * implementing their own shutdown handlers.
 *
 * Usage:
 *   const { GracefulShutdown } = require('../lifecycle/graceful-shutdown');
 *   const shutdown = new GracefulShutdown({ server, logger });
 *   shutdown.register();
 */

'use strict';

const { PHI_TIMING } = require('../shared/phi-math');

// φ-derived shutdown timeout: ~7.6 seconds
const SHUTDOWN_TIMEOUT_MS = Math.round(PHI_TIMING?.SHUTDOWN || 1000 * (1.618 ** 3));

class GracefulShutdown {
  /**
   * @param {Object} opts
   * @param {import('http').Server} [opts.server] - HTTP/HTTPS server to close
   * @param {Function} [opts.logger] - Logger function (defaults to console)
   * @param {Function[]} [opts.cleanupHooks] - Additional cleanup functions
   * @param {number} [opts.timeoutMs] - Max shutdown wait time
   */
  constructor({
    server = null,
    logger = console,
    cleanupHooks = [],
    timeoutMs = SHUTDOWN_TIMEOUT_MS,
  } = {}) {
    this.server = server;
    this.logger = typeof logger === 'function' ? { info: logger, warn: logger, error: logger } : logger;
    this.cleanupHooks = cleanupHooks;
    this.timeoutMs = timeoutMs;
    this._isShuttingDown = false;
  }

  /**
   * Register signal handlers for SIGTERM, SIGINT,
   * uncaughtException, and unhandledRejection.
   */
  register() {
    process.once('SIGTERM', () => this.shutdown('SIGTERM'));
    process.once('SIGINT', () => this.shutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      this.logger.error?.('[GracefulShutdown] uncaughtException:', err);
      this.shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error?.('[GracefulShutdown] unhandledRejection:', reason);
      this.shutdown('unhandledRejection');
    });

    return this;
  }

  /**
   * Execute graceful shutdown sequence.
   * @param {string} signal - Reason for shutdown
   */
  async shutdown(signal) {
    if (this._isShuttingDown) return;
    this._isShuttingDown = true;

    this.logger.info?.(`[GracefulShutdown] Received ${signal} — starting graceful shutdown`);

    // Force exit after timeout
    const forceTimer = setTimeout(() => {
      this.logger.warn?.('[GracefulShutdown] Timeout exceeded — forcing exit');
      process.exit(1);
    }, this.timeoutMs);
    forceTimer.unref?.();

    try {
      // 1. Close HTTP server (stop accepting new connections)
      if (this.server && typeof this.server.close === 'function') {
        await new Promise((resolve) => {
          this.server.close(() => {
            this.logger.info?.('[GracefulShutdown] HTTP server closed');
            resolve();
          });
        });
      }

      // 2. Run cleanup hooks in parallel
      if (this.cleanupHooks.length > 0) {
        this.logger.info?.(`[GracefulShutdown] Running ${this.cleanupHooks.length} cleanup hooks`);
        await Promise.allSettled(
          this.cleanupHooks.map((fn) =>
            Promise.resolve(fn()).catch((err) => {
              this.logger.error?.('[GracefulShutdown] Cleanup hook error:', err);
            })
          )
        );
      }

      this.logger.info?.('[GracefulShutdown] Shutdown complete');
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (err) {
      this.logger.error?.('[GracefulShutdown] Shutdown error:', err);
      clearTimeout(forceTimer);
      process.exit(1);
    }
  }
}

module.exports = { GracefulShutdown, SHUTDOWN_TIMEOUT_MS };
