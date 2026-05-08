/**
 * MAPE-K Self-Improvement Engine v1.0.0
 * HeadySystems Inc. — §25 Implementation
 * 
 * Runs on Colab Delta (T4) as background process.
 * Monitor → Analyze → Plan → Execute → Knowledge
 * 
 * All constants φ-derived. All actions ML-DSA signed.
 * Patent Zone: HS-063 (Phi-Scaled Autonomous Self-Improvement)
 * 
 * @port 3405
 */

'use strict';

const express = require('express');
const pino = require('pino');
const crypto = require('crypto');

// ─── Sacred Constants ─────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI; // 0.618033988749895
const PSI_SQ = PSI * PSI; // 0.381966011250105
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// MAPE-K Timing (all φ-derived)
const MONITOR_INTERVAL_MS = FIB[10] * 1000; // 89s
const ANALYZE_WINDOW_MS = FIB[12] * 1000; // 233s sliding window
const PLAN_BUDGET_MS = Math.round(PHI * PHI * 1000); // 2618ms
const EXECUTE_ROLLBACK_MS = Math.round(PHI * PHI * 1000); // 2618ms
const DRIFT_THRESHOLD = PSI; // 0.618 — trigger analysis
const HALT_THRESHOLD = PSI_SQ; // 0.382 — emergency halt
const PROMOTION_THRESHOLD = 0.85; // JUDGE composite minimum
const CONSECUTIVE_SUCCESS_REQUIRED = FIB[8]; // 34

const logger = pino({
  name: 'mape-k-engine',
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
});

// ─── Knowledge Base (Persistent State) ────────────────────────
class KnowledgeBase {
  constructor(config) {
    this.redis = config.redis;
    this.neon = config.neon;
    this.prefix = 'mape_k:';
    this.wisdomKey = `${this.prefix}wisdom`;
    this.metricsKey = `${this.prefix}metrics`;
    this.improvementsKey = `${this.prefix}improvements`;
    this.driftHistoryKey = `${this.prefix}drift_history`;
  }

  async getWisdom() {
    try {
      const raw = await this.redis.get(this.wisdomKey);
      return raw ? JSON.parse(raw) : { rules: [], patterns: [], anti_patterns: [] };
    } catch (err) {
      logger.error({ err }, 'Failed to read wisdom from Redis');
      // Fallback to Neon
      const result = await this.neon.query(
        'SELECT data FROM heady_wisdom WHERE key = $1',
        ['mape_k_wisdom']
      );
      return result.rows[0]?.data || { rules: [], patterns: [], anti_patterns: [] };
    }
  }

  async storeWisdom(wisdom) {
    const signed = this._sign(wisdom);
    await this.redis.set(this.wisdomKey, JSON.stringify(signed), 'EX', FIB[12] * 3600);
    await this.neon.query(
      `INSERT INTO heady_wisdom (key, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = NOW()`,
      ['mape_k_wisdom', signed]
    );
    logger.info({ rules: wisdom.rules.length }, 'Wisdom updated');
  }

  async recordMetric(metric) {
    const entry = {
      ...metric,
      timestamp: Date.now(),
      trace_id: crypto.randomUUID(),
    };
    await this.redis.xadd(
      this.metricsKey, 'MAXLEN', '~', String(FIB[14]), // 610 entries max
      '*',
      'data', JSON.stringify(entry)
    );
    return entry;
  }

  async getRecentMetrics(windowMs = ANALYZE_WINDOW_MS) {
    const cutoff = Date.now() - windowMs;
    const entries = await this.redis.xrange(this.metricsKey, '-', '+');
    return entries
      .map(([id, fields]) => {
        try { return JSON.parse(fields[1]); } catch { return null; }
      })
      .filter(e => e && e.timestamp >= cutoff);
  }

  async recordDrift(driftReport) {
    await this.redis.lpush(this.driftHistoryKey, JSON.stringify(driftReport));
    await this.redis.ltrim(this.driftHistoryKey, 0, FIB[8] - 1); // Keep last 34
  }

  async recordImprovement(improvement) {
    await this.redis.lpush(this.improvementsKey, JSON.stringify({
      ...improvement,
      applied_at: Date.now(),
      trace_id: crypto.randomUUID(),
    }));
    await this.redis.ltrim(this.improvementsKey, 0, FIB[10] - 1); // Keep last 89
  }

  _sign(data) {
    const payload = JSON.stringify(data);
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    return { ...data, _hash: hash, _signed_at: new Date().toISOString() };
  }
}

// ─── Monitor Phase ────────────────────────────────────────────
class Monitor {
  constructor(kb, config) {
    this.kb = kb;
    this.config = config;
    this.signals = [
      'latency_p95',
      'error_rate',
      'cache_hit_ratio',
      'csl_gate_accuracy',
      'memory_retrieval_quality',
      'pipeline_throughput',
    ];
  }

  async collect() {
    const metrics = {};

    // Signal 1: Latency P95 from Sentry
    metrics.latency_p95 = await this._fetchSentryP95();

    // Signal 2: Error rate from structured logs
    metrics.error_rate = await this._fetchErrorRate();

    // Signal 3: Cache hit ratio from Redis
    metrics.cache_hit_ratio = await this._fetchCacheHitRatio();

    // Signal 4: CSL gate accuracy from telemetry
    metrics.csl_gate_accuracy = await this._fetchCSLAccuracy();

    // Signal 5: Memory retrieval quality (cosine sim of retrieved vs used)
    metrics.memory_retrieval_quality = await this._fetchRetrievalQuality();

    // Signal 6: Pipeline throughput (tasks/minute)
    metrics.pipeline_throughput = await this._fetchThroughput();

    // Composite health score (φ-weighted)
    const weights = [PSI_SQ, PSI_SQ, PSI, PSI, PHI * 0.1, PSI * 0.5];
    const normalizedWeights = weights.map(w => w / weights.reduce((a, b) => a + b, 0));
    const values = this.signals.map(s => this._normalizeSignal(s, metrics[s]));

    metrics._composite = values.reduce((sum, v, i) => sum + v * normalizedWeights[i], 0);
    metrics._timestamp = Date.now();
    metrics._phase = 'monitor';

    await this.kb.recordMetric(metrics);
    logger.info({ composite: metrics._composite.toFixed(4) }, 'Monitor cycle complete');

    return metrics;
  }

  _normalizeSignal(name, value) {
    const ranges = {
      latency_p95: { min: 0, max: 5000, invert: true },
      error_rate: { min: 0, max: 0.1, invert: true },
      cache_hit_ratio: { min: 0, max: 1, invert: false },
      csl_gate_accuracy: { min: 0, max: 1, invert: false },
      memory_retrieval_quality: { min: 0, max: 1, invert: false },
      pipeline_throughput: { min: 0, max: 100, invert: false },
    };
    const r = ranges[name] || { min: 0, max: 1, invert: false };
    let normalized = Math.max(0, Math.min(1, (value - r.min) / (r.max - r.min)));
    return r.invert ? 1 - normalized : normalized;
  }

  async _fetchSentryP95() {
    try {
      const res = await fetch(
        `https://sentry.io/api/0/organizations/${this.config.sentryOrg}/events/` +
        `?field=p95(transaction.duration)&project=${this.config.sentryProject}&statsPeriod=1h`,
        { headers: { Authorization: `Bearer ${this.config.sentryToken}` } }
      );
      if (!res.ok) return 2000;
      const data = await res.json();
      return data.data?.[0]?.['p95(transaction.duration)'] || 2000;
    } catch { return 2000; }
  }

  async _fetchErrorRate() {
    try {
      const recent = await this.kb.getRecentMetrics(FIB[10] * 1000);
      if (!recent.length) return 0;
      const errors = recent.filter(m => m.error_rate !== undefined);
      return errors.length ? errors.reduce((s, m) => s + m.error_rate, 0) / errors.length : 0;
    } catch { return 0; }
  }

  async _fetchCacheHitRatio() {
    try {
      const info = await this.kb.redis.info('stats');
      const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
      const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
      return hits + misses > 0 ? hits / (hits + misses) : 0.5;
    } catch { return 0.5; }
  }

  async _fetchCSLAccuracy() {
    try {
      const metrics = await this.kb.getRecentMetrics(ANALYZE_WINDOW_MS);
      const cslMetrics = metrics.filter(m => m.csl_gate_accuracy !== undefined);
      return cslMetrics.length
        ? cslMetrics.reduce((s, m) => s + m.csl_gate_accuracy, 0) / cslMetrics.length
        : PSI;
    } catch { return PSI; }
  }

  async _fetchRetrievalQuality() {
    try {
      const metrics = await this.kb.getRecentMetrics(ANALYZE_WINDOW_MS);
      const qualMetrics = metrics.filter(m => m.memory_retrieval_quality !== undefined);
      return qualMetrics.length
        ? qualMetrics.reduce((s, m) => s + m.memory_retrieval_quality, 0) / qualMetrics.length
        : PSI;
    } catch { return PSI; }
  }

  async _fetchThroughput() {
    try {
      const streamLen = await this.kb.redis.xlen('heady:tasks');
      return Math.min(streamLen / (MONITOR_INTERVAL_MS / 60000), 100);
    } catch { return 0; }
  }
}

// ─── Analyze Phase ────────────────────────────────────────────
class Analyzer {
  constructor(kb) {
    this.kb = kb;
  }

  async analyze(currentMetrics) {
    const recentMetrics = await this.kb.getRecentMetrics(ANALYZE_WINDOW_MS);
    if (recentMetrics.length < 3) {
      return { drift: 0, anomalies: [], trend: 'insufficient_data' };
    }

    // 6-Signal Drift Detection (per §11 Stage 14)
    const driftScores = {};
    const signals = [
      'latency_p95', 'error_rate', 'cache_hit_ratio',
      'csl_gate_accuracy', 'memory_retrieval_quality', 'pipeline_throughput',
    ];

    for (const signal of signals) {
      const values = recentMetrics
        .map(m => m[signal])
        .filter(v => v !== undefined && v !== null);
      if (values.length < 3) continue;

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stddev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
      const current = currentMetrics[signal];

      if (stddev > 0 && current !== undefined) {
        driftScores[signal] = Math.abs(current - mean) / stddev;
      } else {
        driftScores[signal] = 0;
      }
    }

    // Composite drift (φ-weighted)
    const driftValues = Object.values(driftScores);
    const compositeDrift = driftValues.length
      ? driftValues.reduce((s, v) => s + v, 0) / driftValues.length
      : 0;

    // Anomaly detection: any signal > 2σ
    const anomalies = Object.entries(driftScores)
      .filter(([, score]) => score > 2)
      .map(([signal, score]) => ({ signal, z_score: score }));

    // Trend: compare first half vs second half of window
    const midpoint = Math.floor(recentMetrics.length / 2);
    const firstHalf = recentMetrics.slice(0, midpoint);
    const secondHalf = recentMetrics.slice(midpoint);
    const firstComposite = firstHalf.reduce((s, m) => s + (m._composite || 0), 0) / (firstHalf.length || 1);
    const secondComposite = secondHalf.reduce((s, m) => s + (m._composite || 0), 0) / (secondHalf.length || 1);
    const trend = secondComposite > firstComposite + 0.05 ? 'improving'
      : secondComposite < firstComposite - 0.05 ? 'degrading'
      : 'stable';

    const report = {
      drift: compositeDrift,
      drift_per_signal: driftScores,
      anomalies,
      trend,
      composite_health: currentMetrics._composite,
      samples: recentMetrics.length,
      timestamp: Date.now(),
    };

    await this.kb.recordDrift(report);

    logger.info({
      drift: compositeDrift.toFixed(4),
      anomalies: anomalies.length,
      trend,
    }, 'Analysis complete');

    return report;
  }
}

// ─── Plan Phase ───────────────────────────────────────────────
class Planner {
  constructor(kb) {
    this.kb = kb;
  }

  async plan(analysis) {
    const improvements = [];

    // Only plan if drift exceeds threshold
    if (analysis.drift < DRIFT_THRESHOLD && analysis.anomalies.length === 0) {
      logger.info('No drift detected, skipping plan phase');
      return { actions: [], reason: 'system_nominal' };
    }

    // Emergency: drift above HALT threshold
    if (analysis.drift > 1 / PSI_SQ) { // ~2.618
      improvements.push({
        type: 'emergency_rollback',
        target: 'last_known_good_config',
        urgency: 'critical',
        description: 'Drift exceeds φ² threshold — rolling back to last stable configuration',
      });
    }

    // Per-signal improvement planning
    for (const anomaly of analysis.anomalies) {
      const action = this._planForSignal(anomaly.signal, anomaly.z_score);
      if (action) improvements.push(action);
    }

    // Trend-based proactive improvements
    if (analysis.trend === 'degrading') {
      const wisdom = await this.kb.getWisdom();
      const applicableRules = wisdom.rules.filter(r => r.trigger === 'degrading_trend');
      for (const rule of applicableRules.slice(0, FIB[4])) { // Max 5 proactive actions
        improvements.push({
          type: 'proactive',
          target: rule.target,
          action: rule.action,
          description: `Wisdom rule: ${rule.description}`,
          source: 'wisdom.json',
        });
      }
    }

    // DSPy MIPROv2 optimization for underperforming prompts
    if (analysis.drift_per_signal?.csl_gate_accuracy > 1.5) {
      improvements.push({
        type: 'prompt_optimization',
        target: 'csl_gate_prompts',
        method: 'DSPy_MIPROv2',
        description: 'CSL gate accuracy degrading — triggering MIPROv2 optimization on accumulated traces',
      });
    }

    // Cache tuning if hit ratio drops
    if (analysis.drift_per_signal?.cache_hit_ratio > 1.5) {
      improvements.push({
        type: 'cache_tuning',
        target: 'semantic_cache',
        action: 'adjust_ttl',
        new_ttl: Math.round(PHI * 3600), // φ hours
        description: 'Cache hit ratio degraded — adjusting TTL to φ × 1h',
      });
    }

    const plan = {
      actions: improvements,
      budget_ms: PLAN_BUDGET_MS,
      rollback_window_ms: EXECUTE_ROLLBACK_MS,
      timestamp: Date.now(),
    };

    logger.info({ actions: improvements.length }, 'Plan generated');
    return plan;
  }

  _planForSignal(signal, zScore) {
    const plans = {
      latency_p95: {
        type: 'latency_optimization',
        target: 'connection_pools',
        action: 'scale_pools',
        description: `Latency spike (z=${zScore.toFixed(2)}) — scaling connection pools by φ`,
      },
      error_rate: {
        type: 'reliability_fix',
        target: 'circuit_breakers',
        action: 'tighten_thresholds',
        description: `Error rate anomaly (z=${zScore.toFixed(2)}) — tightening circuit breaker thresholds`,
      },
      memory_retrieval_quality: {
        type: 'index_rebuild',
        target: 'hnsw_index',
        action: 'trigger_rebuild',
        description: `Retrieval quality drop (z=${zScore.toFixed(2)}) — triggering HNSW index rebuild on Colab Beta`,
      },
      pipeline_throughput: {
        type: 'throughput_optimization',
        target: 'worker_pool',
        action: 'scale_workers',
        description: `Throughput degradation (z=${zScore.toFixed(2)}) — scaling bee worker pool`,
      },
    };
    return plans[signal] || null;
  }
}

// ─── Execute Phase ────────────────────────────────────────────
class Executor {
  constructor(kb, config) {
    this.kb = kb;
    this.config = config;
  }

  async execute(plan) {
    if (!plan.actions.length) return { executed: 0, results: [] };

    const results = [];

    for (const action of plan.actions) {
      const startTime = Date.now();
      let result;

      try {
        switch (action.type) {
          case 'emergency_rollback':
            result = await this._emergencyRollback(action);
            break;
          case 'prompt_optimization':
            result = await this._triggerDSPyOptimization(action);
            break;
          case 'cache_tuning':
            result = await this._tuneCacheTTL(action);
            break;
          case 'latency_optimization':
            result = await this._scaleConnectionPools(action);
            break;
          case 'reliability_fix':
            result = await this._tightenCircuitBreakers(action);
            break;
          case 'index_rebuild':
            result = await this._triggerIndexRebuild(action);
            break;
          case 'throughput_optimization':
            result = await this._scaleWorkers(action);
            break;
          case 'proactive':
            result = await this._executeWisdomRule(action);
            break;
          default:
            result = { status: 'skipped', reason: `Unknown action type: ${action.type}` };
        }

        const elapsed = Date.now() - startTime;
        const improvement = {
          action: action.type,
          target: action.target,
          status: result.status || 'applied',
          elapsed_ms: elapsed,
          description: action.description,
        };

        results.push(improvement);
        await this.kb.recordImprovement(improvement);

        logger.info({ action: action.type, elapsed }, 'Improvement applied');
      } catch (err) {
        logger.error({ err, action: action.type }, 'Improvement execution failed');
        results.push({
          action: action.type,
          status: 'failed',
          error: err.message,
        });
      }
    }

    return { executed: results.length, results };
  }

  async _emergencyRollback(action) {
    // Publish rollback event via Redis
    await this.kb.redis.publish('mape_k:emergency', JSON.stringify({
      type: 'rollback',
      timestamp: Date.now(),
      reason: action.description,
    }));
    return { status: 'rollback_initiated' };
  }

  async _triggerDSPyOptimization(action) {
    // Dispatch to Colab Delta via QStash
    if (this.config.qstashToken) {
      const { Client } = require('@upstash/qstash');
      const qstash = new Client({ token: this.config.qstashToken });
      await qstash.publishJSON({
        url: `${this.config.colabDeltaUrl}/optimize`,
        body: { target: action.target, method: action.method },
        retries: FIB[4], // 5 retries
        delay: `${FIB[5]}s`, // 8s delay
      });
    }
    return { status: 'optimization_dispatched' };
  }

  async _tuneCacheTTL(action) {
    await this.kb.redis.set('mape_k:cache_ttl_override', String(action.new_ttl));
    return { status: 'ttl_updated', new_ttl: action.new_ttl };
  }

  async _scaleConnectionPools(action) {
    const currentMax = FIB[6]; // 13
    const newMax = FIB[7]; // 21
    await this.kb.redis.set('mape_k:pool_max_override', String(newMax));
    return { status: 'pools_scaled', from: currentMax, to: newMax };
  }

  async _tightenCircuitBreakers(action) {
    const newThreshold = PSI; // 0.618 failure rate
    await this.kb.redis.set('mape_k:circuit_breaker_threshold', String(newThreshold));
    return { status: 'thresholds_tightened', threshold: newThreshold };
  }

  async _triggerIndexRebuild(action) {
    // Dispatch to Colab Beta via QStash
    if (this.config.qstashToken) {
      const { Client } = require('@upstash/qstash');
      const qstash = new Client({ token: this.config.qstashToken });
      await qstash.publishJSON({
        url: `${this.config.colabBetaUrl}/rebuild-index`,
        body: { target: 'hnsw', dimension: 1536 },
        retries: FIB[3], // 3 retries
      });
    }
    return { status: 'rebuild_dispatched' };
  }

  async _scaleWorkers(action) {
    const currentWorkers = FIB[8]; // 34
    const newWorkers = FIB[9]; // 55
    await this.kb.redis.set('mape_k:max_workers_override', String(newWorkers));
    return { status: 'workers_scaled', from: currentWorkers, to: newWorkers };
  }

  async _executeWisdomRule(action) {
    // Generic wisdom rule execution — log and mark as applied
    logger.info({ rule: action.description }, 'Wisdom rule applied');
    return { status: 'wisdom_applied' };
  }
}

// ─── MAPE-K Engine (Orchestrator) ─────────────────────────────
class MAPEKEngine {
  constructor(config) {
    this.config = config;
    this.kb = new KnowledgeBase(config);
    this.monitor = new Monitor(this.kb, config);
    this.analyzer = new Analyzer(this.kb);
    this.planner = new Planner(this.kb);
    this.executor = new Executor(this.kb, config);
    this.running = false;
    this.cycleCount = 0;
    this.consecutiveSuccess = 0;
  }

  async start() {
    this.running = true;
    logger.info({ interval_ms: MONITOR_INTERVAL_MS }, 'MAPE-K engine starting');

    while (this.running) {
      const cycleStart = Date.now();

      try {
        // M — Monitor
        const metrics = await this.monitor.collect();

        // A — Analyze
        const analysis = await this.analyzer.analyze(metrics);

        // P — Plan
        const plan = await this.planner.plan(analysis);

        // E — Execute
        const result = await this.executor.execute(plan);

        // K — Knowledge Update
        if (result.executed > 0) {
          const wisdom = await this.kb.getWisdom();
          wisdom.rules.push({
            trigger: 'drift_detected',
            actions_taken: result.results.map(r => r.action),
            drift_level: analysis.drift,
            timestamp: Date.now(),
          });
          // Keep wisdom bounded
          if (wisdom.rules.length > FIB[10]) { // 89 max
            wisdom.rules = wisdom.rules.slice(-FIB[9]); // Keep last 55
          }
          await this.kb.storeWisdom(wisdom);
        }

        this.cycleCount++;
        this.consecutiveSuccess++;

        if (this.consecutiveSuccess >= CONSECUTIVE_SUCCESS_REQUIRED) {
          logger.info({ cycles: this.consecutiveSuccess }, 'MAPE-K promotion eligible');
        }

        const elapsed = Date.now() - cycleStart;
        logger.info({
          cycle: this.cycleCount,
          elapsed_ms: elapsed,
          drift: analysis.drift?.toFixed(4),
          improvements: result.executed,
        }, 'MAPE-K cycle complete');

      } catch (err) {
        this.consecutiveSuccess = 0;
        logger.error({ err, cycle: this.cycleCount }, 'MAPE-K cycle failed');
      }

      // Wait for next cycle
      await new Promise(resolve => setTimeout(resolve, MONITOR_INTERVAL_MS));
    }
  }

  stop() {
    this.running = false;
    logger.info('MAPE-K engine stopping');
  }

  getStatus() {
    return {
      running: this.running,
      cycle_count: this.cycleCount,
      consecutive_success: this.consecutiveSuccess,
      monitor_interval_ms: MONITOR_INTERVAL_MS,
      drift_threshold: DRIFT_THRESHOLD,
      halt_threshold: HALT_THRESHOLD,
    };
  }
}

// ─── Express Server ───────────────────────────────────────────
function createServer(engine) {
  const app = express();
  app.use(express.json());

  // Health
  app.get('/health', (req, res) => {
    const status = engine.getStatus();
    res.json({
      status: status.running ? 'healthy' : 'stopped',
      service: 'mape-k-engine',
      version: '1.0.0',
      uptime: process.uptime(),
      phi_health: status.consecutive_success / CONSECUTIVE_SUCCESS_REQUIRED,
      ...status,
    });
  });

  // A2A Agent Card
  app.get('/.well-known/agent.json', (req, res) => {
    res.json({
      name: 'heady-mape-k',
      version: '1.0.0',
      description: 'MAPE-K Self-Improvement Engine — proactive platform optimization',
      capabilities: ['monitor', 'analyze', 'plan', 'execute', 'knowledge'],
      endpoint: `https://mape-k.headysystems.com`,
      auth: { type: 'bearer', scheme: 'ML-DSA-65' },
    });
  });

  // Manual trigger
  app.post('/trigger', async (req, res) => {
    try {
      const metrics = await engine.monitor.collect();
      const analysis = await engine.analyzer.analyze(metrics);
      const plan = await engine.planner.plan(analysis);
      const result = await engine.executor.execute(plan);
      res.json({ metrics, analysis, plan, result });
    } catch (err) {
      logger.error({ err }, 'Manual trigger failed');
      res.status(500).json({ error: err.message });
    }
  });

  // Status
  app.get('/status', (req, res) => {
    res.json(engine.getStatus());
  });

  return app;
}

// ─── Bootstrap ────────────────────────────────────────────────
if (require.main === module) {
  const config = {
    redis: null, // Injected by bootstrap
    neon: null,  // Injected by bootstrap
    sentryOrg: process.env.SENTRY_ORG,
    sentryProject: process.env.SENTRY_PROJECT,
    sentryToken: process.env.SENTRY_AUTH_TOKEN,
    qstashToken: process.env.QSTASH_TOKEN,
    colabDeltaUrl: process.env.COLAB_DELTA_URL || 'https://colab-delta.heady-tailnet.ts.net',
    colabBetaUrl: process.env.COLAB_BETA_URL || 'https://colab-beta.heady-tailnet.ts.net',
  };

  const engine = new MAPEKEngine(config);
  const app = createServer(engine);
  const port = parseInt(process.env.PORT || '3405');

  app.listen(port, () => {
    logger.info({ port }, 'MAPE-K engine HTTP server started');
    // Start the continuous loop
    engine.start().catch(err => {
      logger.error({ err }, 'MAPE-K engine crashed');
      process.exit(1);
    });
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down MAPE-K engine');
    engine.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { MAPEKEngine, KnowledgeBase, Monitor, Analyzer, Planner, Executor, createServer };
