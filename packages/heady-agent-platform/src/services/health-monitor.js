// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Health Monitor v1.0.0                                   ║
// ║  Platform health monitoring with phi-adaptive intervals        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { EventEmitter } from 'events';
import { PlatformConfig } from '../../config/platform-config.js';

const PHI = 1.6180339887498948;
const PSI = 0.6180339887498949;

/**
 * HealthMonitor — Watches swarm health with phi-adaptive check intervals.
 *
 * When a swarm is healthy, checks slow down (multiply by φ).
 * When a swarm is degraded, checks speed up (multiply by ψ).
 * This creates a self-regulating observation frequency.
 */
export class HealthMonitor extends EventEmitter {
  constructor() {
    super();
    this._swarmHealth = new Map();
    this._timers = new Map();
    this._baseIntervalMs = PlatformConfig.healthCheckMs;
  }

  /**
   * Register a swarm for monitoring.
   */
  registerSwarm(swarmId, config) {
    this._swarmHealth.set(swarmId, {
      status: 'healthy', // healthy | degraded | unhealthy
      lastCheck: Date.now(),
      checkInterval: this._baseIntervalMs,
      consecutiveFailures: 0,
      config,
    });
  }

  /**
   * Start monitoring all registered swarms.
   */
  startMonitoring(swarmIds, intervalMs) {
    this._baseIntervalMs = intervalMs || this._baseIntervalMs;

    for (const swarmId of swarmIds) {
      if (!this._swarmHealth.has(swarmId)) {
        this.registerSwarm(swarmId, {});
      }

      const health = this._swarmHealth.get(swarmId);
      this._scheduleCheck(swarmId, health.checkInterval);
    }
  }

  /**
   * Stop monitoring.
   */
  stopMonitoring() {
    for (const [, timer] of this._timers) {
      clearTimeout(timer);
    }
    this._timers.clear();
  }

  /**
   * Report health status for a swarm (called externally).
   */
  reportHealth(swarmId, healthy) {
    const health = this._swarmHealth.get(swarmId);
    if (!health) return;

    health.lastCheck = Date.now();

    if (healthy) {
      health.consecutiveFailures = 0;
      health.status = 'healthy';
      // Slow down checks: φ multiplier
      health.checkInterval = Math.min(
        health.checkInterval * PHI,
        this._baseIntervalMs * PHI * PHI * PHI // Max ~4.2x base
      );
    } else {
      health.consecutiveFailures++;
      if (health.consecutiveFailures >= 3) {
        health.status = 'unhealthy';
        this.emit('swarm:unhealthy', { swarmId, failures: health.consecutiveFailures });
      } else {
        health.status = 'degraded';
        this.emit('swarm:degraded', { swarmId, failures: health.consecutiveFailures });
      }
      // Speed up checks: ψ multiplier
      health.checkInterval = Math.max(
        health.checkInterval * PSI,
        this._baseIntervalMs * PSI // Min ~0.618x base
      );
    }

    // Reschedule
    this._scheduleCheck(swarmId, health.checkInterval);
  }

  /**
   * Get health for a specific swarm.
   */
  getSwarmHealth(swarmId) {
    const health = this._swarmHealth.get(swarmId);
    if (!health) return { status: 'unknown' };
    return {
      status: health.status,
      lastCheck: health.lastCheck,
      checkInterval: Math.round(health.checkInterval),
      consecutiveFailures: health.consecutiveFailures,
    };
  }

  /**
   * Get platform-wide health summary.
   */
  getSummary() {
    const swarms = Array.from(this._swarmHealth.entries());
    return {
      total: swarms.length,
      healthy: swarms.filter(([, h]) => h.status === 'healthy').length,
      degraded: swarms.filter(([, h]) => h.status === 'degraded').length,
      unhealthy: swarms.filter(([, h]) => h.status === 'unhealthy').length,
      details: Object.fromEntries(
        swarms.map(([id, h]) => [id, this.getSwarmHealth(id)])
      ),
    };
  }

  // ─── Private ──────────────────────────────────────────────────────

  _scheduleCheck(swarmId, intervalMs) {
    if (this._timers.has(swarmId)) {
      clearTimeout(this._timers.get(swarmId));
    }

    const timer = setTimeout(() => {
      this.emit('swarm:check', { swarmId });
      // Auto-schedule next check
      const health = this._swarmHealth.get(swarmId);
      if (health) {
        this._scheduleCheck(swarmId, health.checkInterval);
      }
    }, intervalMs);

    // Allow process to exit even if timers are running
    if (timer.unref) timer.unref();
    this._timers.set(swarmId, timer);
  }
}
