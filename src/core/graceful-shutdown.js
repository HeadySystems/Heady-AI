// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/core/graceful-shutdown.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Graceful Shutdown with LIFO Cleanup
 * Subsystems are stopped in reverse registration order.
 */
export class GracefulShutdown {
  #log;
  #server;
  #subsystems;
  #shutdownInProgress = false;

  constructor({ log, server, subsystems }) {
    this.#log = log;
    this.#server = server;
    this.#subsystems = subsystems;
  }

  async execute() {
    if (this.#shutdownInProgress) return;
    this.#shutdownInProgress = true;
    this.#log.info('🛑 Graceful shutdown initiated (LIFO order)');

    // Stop subsystems in reverse order
    for (let i = this.#subsystems.length - 1; i >= 0; i--) {
      const sub = this.#subsystems[i];
      try {
        if (typeof sub.stop === 'function') await sub.stop();
      } catch (err) {
        this.#log.error({ err }, 'Error stopping subsystem');
      }
    }

    // Close HTTP server
    this.#server.close(() => {
      this.#log.info('HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      this.#log.warn('Forced exit after timeout');
      process.exit(1);
    }, 10_000);
  }
}
