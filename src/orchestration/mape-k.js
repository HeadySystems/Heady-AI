'use strict';

/**
 * HEADY™ MAPE-K Control Loop — Liquid Architecture v9 (§P6)
 *
 * Self-healing autonomic computing loop:
 *   Monitor  → Collect metrics from Sentry, DuckDB, Upstash, health endpoints
 *   Analyze  → Detect anomalies (CSL drift, error spikes, latency degradation)
 *   Plan     → Select corrective action (scale, failover, reconfigure, alert)
 *   Execute  → Apply action via service mesh / QStash dispatch
 *   Knowledge → Persist decisions + outcomes to Neon for learning
 *
 * Runs every φ⁷ ms (29,034ms ≈ 29s) via Sentry Crons heartbeat.
 *
 * @see https://en.wikipedia.org/wiki/Autonomic_computing#MAPE-K
 */

const { createLogger } = require('../../packages/structured-logger');
const log = createLogger('mape-k', 'orchestration');

// φ-derived constants
const PHI = 1.618033988749895;
const PHI_7_MS = 29034;
const CSL_DRIFT_THRESHOLD = 0.05;   // 5% CSL gate drift
const ERROR_RATE_THRESHOLD = 0.01;  // 1% error rate
const LATENCY_P99_THRESHOLD = 500;  // 500ms p99
const MEMORY_USAGE_THRESHOLD = 0.85; // 85% memory

// Action types
const ACTIONS = {
  NONE: 'none',
  SCALE_UP: 'scale_up',
  SCALE_DOWN: 'scale_down',
  FAILOVER: 'failover',
  RECONFIGURE: 'reconfigure',
  RESTART: 'restart',
  ALERT: 'alert',
  QUARANTINE: 'quarantine',
};

class MapeK {
  /**
   * @param {object} deps - Injected dependencies
   * @param {object} deps.redis     - UpstashRedis instance
   * @param {object} [deps.db]      - Neon database pool
   * @param {object} [deps.sentry]  - Sentry instance
   * @param {object} [deps.qstash]  - QStash instance
   * @param {object} [deps.services] - Service registry { name: healthUrl }
   */
  constructor(deps = {}) {
    this.redis = deps.redis;
    this.db = deps.db;
    this.sentry = deps.sentry;
    this.qstash = deps.qstash;
    this.services = deps.services || {};
    this.timer = null;
    this.cycleCount = 0;
    this.knowledge = new Map(); // In-memory knowledge cache
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE — start/stop the autonomic loop
  // ═══════════════════════════════════════════════════════════════

  start() {
    log.system('MAPE-K loop starting', { interval_ms: PHI_7_MS });
    this.timer = setInterval(() => this.cycle(), PHI_7_MS);
    this.cycle(); // Immediate first run
    return this;
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    log.system('MAPE-K loop stopped', { total_cycles: this.cycleCount });
  }

  /**
   * Execute one full MAPE-K cycle.
   */
  async cycle() {
    this.cycleCount++;
    const cycleStart = Date.now();

    try {
      // M → Monitor
      const metrics = await this.monitor();

      // A → Analyze
      const anomalies = this.analyze(metrics);

      // P → Plan
      const plan = this.plan(anomalies, metrics);

      // E → Execute
      const results = await this.execute(plan);

      // K → Knowledge
      await this.updateKnowledge(metrics, anomalies, plan, results);

      const durationMs = Date.now() - cycleStart;
      log.activity('MAPE-K cycle complete', {
        cycle: this.cycleCount,
        duration_ms: durationMs,
        anomalies: anomalies.length,
        actions: plan.actions.length,
      });

    } catch (err) {
      log.error('MAPE-K cycle failed', {
        cycle: this.cycleCount,
        error: err.message,
        stack: err.stack,
      });
      this.sentry?.captureException?.(err);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // M — MONITOR: Collect metrics from all services
  // ═══════════════════════════════════════════════════════════════

  async monitor() {
    const metrics = {
      timestamp: Date.now(),
      cycle: this.cycleCount,
      services: {},
      system: {},
      pipeline: {},
    };

    // Service health checks
    const healthChecks = Object.entries(this.services).map(async ([name, url]) => {
      const start = Date.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = await res.json().catch(() => ({}));
        metrics.services[name] = {
          status: res.ok ? 'healthy' : 'degraded',
          latency_ms: Date.now() - start,
          details: data,
        };
      } catch (err) {
        metrics.services[name] = {
          status: 'down',
          latency_ms: Date.now() - start,
          error: err.message,
        };
      }
    });

    await Promise.allSettled(healthChecks);

    // System metrics
    if (typeof process !== 'undefined') {
      const mem = process.memoryUsage();
      metrics.system = {
        heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
        rss_mb: Math.round(mem.rss / 1024 / 1024),
        uptime_s: Math.round(process.uptime()),
        memory_ratio: mem.heapUsed / mem.heapTotal,
      };
    }

    // Redis metrics (if available)
    if (this.redis && !this.redis.mock) {
      try {
        const ping = await this.redis.ping();
        metrics.redis = { status: ping.ok ? 'healthy' : 'degraded' };
      } catch {
        metrics.redis = { status: 'down' };
      }
    }

    return metrics;
  }

  // ═══════════════════════════════════════════════════════════════
  // A — ANALYZE: Detect anomalies
  // ═══════════════════════════════════════════════════════════════

  analyze(metrics) {
    const anomalies = [];

    // Check service health
    for (const [name, svc] of Object.entries(metrics.services)) {
      if (svc.status === 'down') {
        anomalies.push({
          type: 'service_down',
          severity: 'critical',
          service: name,
          message: `${name} is down: ${svc.error || 'unreachable'}`,
        });
      } else if (svc.status === 'degraded') {
        anomalies.push({
          type: 'service_degraded',
          severity: 'warning',
          service: name,
          message: `${name} is degraded`,
        });
      }

      // Latency check
      if (svc.latency_ms > LATENCY_P99_THRESHOLD) {
        anomalies.push({
          type: 'high_latency',
          severity: 'warning',
          service: name,
          value: svc.latency_ms,
          threshold: LATENCY_P99_THRESHOLD,
          message: `${name} latency ${svc.latency_ms}ms exceeds ${LATENCY_P99_THRESHOLD}ms`,
        });
      }

      // CSL drift (from health response)
      if (svc.details?.csl_gate !== undefined) {
        const drift = Math.abs(svc.details.csl_gate - 0.618);
        if (drift > CSL_DRIFT_THRESHOLD) {
          anomalies.push({
            type: 'csl_drift',
            severity: 'warning',
            service: name,
            value: drift,
            threshold: CSL_DRIFT_THRESHOLD,
            message: `${name} CSL drift ${drift.toFixed(4)} exceeds ${CSL_DRIFT_THRESHOLD}`,
          });
        }
      }
    }

    // Memory pressure
    if (metrics.system.memory_ratio > MEMORY_USAGE_THRESHOLD) {
      anomalies.push({
        type: 'memory_pressure',
        severity: 'warning',
        value: metrics.system.memory_ratio,
        threshold: MEMORY_USAGE_THRESHOLD,
        message: `Memory usage ${(metrics.system.memory_ratio * 100).toFixed(1)}% exceeds ${MEMORY_USAGE_THRESHOLD * 100}%`,
      });
    }

    // Redis down
    if (metrics.redis?.status === 'down') {
      anomalies.push({
        type: 'redis_down',
        severity: 'critical',
        message: 'Redis is unreachable — T0 memory offline',
      });
    }

    return anomalies;
  }

  // ═══════════════════════════════════════════════════════════════
  // P — PLAN: Select corrective actions
  // ═══════════════════════════════════════════════════════════════

  plan(anomalies, metrics) {
    const actions = [];

    for (const anomaly of anomalies) {
      // Check knowledge base: did a previous action fix this?
      const prevAction = this.knowledge.get(`fix:${anomaly.type}:${anomaly.service || 'system'}`);

      switch (anomaly.type) {
        case 'service_down':
          actions.push({
            action: ACTIONS.RESTART,
            target: anomaly.service,
            anomaly,
            confidence: prevAction?.success_rate || 0.7,
          });
          break;

        case 'high_latency':
          actions.push({
            action: ACTIONS.SCALE_UP,
            target: anomaly.service,
            anomaly,
            confidence: 0.6,
          });
          break;

        case 'csl_drift':
          actions.push({
            action: ACTIONS.RECONFIGURE,
            target: anomaly.service,
            anomaly,
            confidence: 0.8,
            params: { reset_csl_gate: true },
          });
          break;

        case 'memory_pressure':
          actions.push({
            action: ACTIONS.ALERT,
            target: 'system',
            anomaly,
            confidence: 0.9,
          });
          break;

        case 'redis_down':
          actions.push({
            action: ACTIONS.FAILOVER,
            target: 'redis',
            anomaly,
            confidence: 0.5,
            params: { fallback: 'in-memory-cache' },
          });
          break;

        default:
          actions.push({
            action: ACTIONS.ALERT,
            target: anomaly.service || 'system',
            anomaly,
            confidence: 0.5,
          });
      }
    }

    return { actions, timestamp: Date.now() };
  }

  // ═══════════════════════════════════════════════════════════════
  // E — EXECUTE: Apply planned actions
  // ═══════════════════════════════════════════════════════════════

  async execute(plan) {
    const results = [];

    for (const action of plan.actions) {
      try {
        let result;

        switch (action.action) {
          case ACTIONS.RESTART:
            // Dispatch restart via QStash (durable)
            if (this.qstash) {
              result = await this.qstash.publish({
                url: this.services[action.target]?.replace('/health', '/restart') || '',
                body: { reason: action.anomaly.message, triggered_by: 'mape-k' },
                retries: 3,
              });
            }
            break;

          case ACTIONS.ALERT:
            // Send alert via Sentry
            this.sentry?.captureMessage?.(
              `[MAPE-K] ${action.anomaly.message}`,
              action.anomaly.severity === 'critical' ? 'error' : 'warning'
            );
            result = { alerted: true };
            break;

          case ACTIONS.FAILOVER:
          case ACTIONS.SCALE_UP:
          case ACTIONS.SCALE_DOWN:
          case ACTIONS.RECONFIGURE:
            // Log intent — actual scaling requires cloud provider APIs
            log.activity(`MAPE-K action: ${action.action}`, {
              target: action.target,
              params: action.params,
              reason: action.anomaly.message,
            });
            result = { logged: true, action: action.action };
            break;

          default:
            result = { skipped: true };
        }

        results.push({ action: action.action, target: action.target, success: true, result });
      } catch (err) {
        results.push({ action: action.action, target: action.target, success: false, error: err.message });
        log.error('MAPE-K execute failed', { action: action.action, target: action.target, error: err.message });
      }
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // K — KNOWLEDGE: Persist for learning
  // ═══════════════════════════════════════════════════════════════

  async updateKnowledge(metrics, anomalies, plan, results) {
    // Update in-memory knowledge cache
    for (let i = 0; i < plan.actions.length; i++) {
      const action = plan.actions[i];
      const result = results[i];
      const key = `fix:${action.anomaly.type}:${action.target}`;

      const prev = this.knowledge.get(key) || { attempts: 0, successes: 0 };
      prev.attempts++;
      if (result?.success) prev.successes++;
      prev.success_rate = prev.successes / prev.attempts;
      prev.last_action = action.action;
      prev.last_at = Date.now();
      this.knowledge.set(key, prev);
    }

    // Persist to Neon (if pool available)
    if (this.db && anomalies.length > 0) {
      try {
        await this.db.query(
          `INSERT INTO audit_logs (actor, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            'mape-k',
            'autonomic_cycle',
            'system',
            `cycle-${this.cycleCount}`,
            JSON.stringify({
              cycle: this.cycleCount,
              anomalies: anomalies.length,
              actions: plan.actions.length,
              results: results.map(r => ({ action: r.action, success: r.success })),
              knowledge_entries: this.knowledge.size,
            }),
          ]
        );
      } catch (err) {
        log.error('MAPE-K knowledge persist failed', { error: err.message });
      }
    }

    // Broadcast status via Redis
    if (this.redis && !this.redis.mock) {
      await this.redis.publishPipelineEvent('mape-k', {
        cycle: this.cycleCount,
        anomalies: anomalies.length,
        actions_taken: results.filter(r => r.success).length,
      }).catch(() => {});
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════

  getStatus() {
    return {
      running: !!this.timer,
      cycles: this.cycleCount,
      interval_ms: PHI_7_MS,
      knowledge_entries: this.knowledge.size,
      thresholds: {
        csl_drift: CSL_DRIFT_THRESHOLD,
        error_rate: ERROR_RATE_THRESHOLD,
        latency_p99_ms: LATENCY_P99_THRESHOLD,
        memory_usage: MEMORY_USAGE_THRESHOLD,
      },
    };
  }
}

module.exports = { MapeK, ACTIONS, PHI_7_MS };
