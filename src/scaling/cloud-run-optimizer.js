/**
 * CloudRunOptimizer — Cloud Run Service Auto-Optimization
 * Analyzes Cloud Run metrics and recommends/applies optimizations for
 * concurrency, CPU/memory, min/max instances, cold start mitigation.
 * All constants φ-derived. CSL gates replace boolean. ESM only.
 * Author: Eric Haywood
 */
import { createHash } from 'crypto';

// ── φ-Math Foundation ────────────────────────────────────────────
const PHI = 1.6180339887;
const PSI = 0.6180339887;
const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

function phiThreshold(level, spread = PSI2) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  CRITICAL: phiThreshold(4),
  HIGH: phiThreshold(3),
  MEDIUM: phiThreshold(2),
  LOW: phiThreshold(1),
  MINIMUM: phiThreshold(0),
};

function cslGate(value, score, tau = CSL_THRESHOLDS.MEDIUM, temp = Math.pow(PSI, 3)) {
  return value * (1 / (1 + Math.exp(-(score - tau) / temp)));
}

function hashSHA256(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// ── Service Profiles ─────────────────────────────────────────────
const SERVICE_PROFILES = {
  'inference': {
    cpu: '2',
    memory: '2Gi',
    concurrency: FIB[8],          // 21
    minInstances: FIB[3],         // 2
    maxInstances: FIB[8],         // 21
    timeoutSeconds: FIB[10],      // 55
    cpuThrottle: false,
    startupCpuBoost: true,
  },
  'api': {
    cpu: '1',
    memory: '512Mi',
    concurrency: FIB[11],         // 89
    minInstances: FIB[3],         // 2
    maxInstances: FIB[9],         // 34
    timeoutSeconds: FIB[9],       // 34
    cpuThrottle: true,
    startupCpuBoost: true,
  },
  'worker': {
    cpu: '1',
    memory: '1Gi',
    concurrency: FIB[6],          // 8
    minInstances: FIB[1],         // 1
    maxInstances: FIB[7],         // 13
    timeoutSeconds: FIB[12],      // 144
    cpuThrottle: true,
    startupCpuBoost: false,
  },
  'web': {
    cpu: '1',
    memory: '256Mi',
    concurrency: FIB[12],         // 144
    minInstances: FIB[3],         // 2
    maxInstances: FIB[10],        // 55
    timeoutSeconds: FIB[9],       // 34
    cpuThrottle: true,
    startupCpuBoost: true,
  },
  'batch': {
    cpu: '4',
    memory: '4Gi',
    concurrency: FIB[4],          // 3
    minInstances: 0,
    maxInstances: FIB[5],         // 5
    timeoutSeconds: FIB[14],      // 377
    cpuThrottle: false,
    startupCpuBoost: false,
  },
};

// ── Metrics Collector ────────────────────────────────────────────
class MetricsWindow {
  constructor(windowMs = FIB[10] * 60 * 1000) { // 55 min window
    this.samples = [];
    this.windowMs = windowMs;
    this.maxSamples = FIB[16]; // 987
  }

  record(sample) {
    this.samples.push({ ...sample, ts: Date.now() });
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-FIB[14]);
    }
  }

  getRecent() {
    const cutoff = Date.now() - this.windowMs;
    return this.samples.filter(s => s.ts > cutoff);
  }

  aggregate() {
    const recent = this.getRecent();
    if (recent.length === 0) return null;

    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const max = (arr) => Math.max(...arr);
    const p95 = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.ceil(sorted.length * CSL_THRESHOLDS.CRITICAL) - 1];
    };

    return {
      cpuUtilization: { avg: avg(recent.map(s => s.cpu ?? 0)), max: max(recent.map(s => s.cpu ?? 0)) },
      memoryUtilization: { avg: avg(recent.map(s => s.memory ?? 0)), max: max(recent.map(s => s.memory ?? 0)) },
      requestLatency: { avg: avg(recent.map(s => s.latencyMs ?? 0)), p95: p95(recent.map(s => s.latencyMs ?? 0)) },
      instanceCount: { avg: avg(recent.map(s => s.instances ?? 1)), max: max(recent.map(s => s.instances ?? 1)) },
      concurrentRequests: { avg: avg(recent.map(s => s.concurrent ?? 0)), max: max(recent.map(s => s.concurrent ?? 0)) },
      coldStarts: recent.filter(s => s.coldStart).length,
      errorRate: recent.filter(s => s.error).length / recent.length,
      sampleCount: recent.length,
    };
  }
}

// ── Cloud Run Optimizer ──────────────────────────────────────────
class CloudRunOptimizer {
  constructor(config = {}) {
    this.projectId = config.projectId ?? 'gen-lang-client-0920560496';
    this.region = config.region ?? 'us-east1';
    this.services = new Map();
    this.metricsWindows = new Map();
    this.recommendations = [];
    this.maxRecommendations = FIB[16];
    this.auditLog = [];
    this.maxAuditEntries = FIB[16];
  }

  _audit(action, detail) {
    const entry = { ts: Date.now(), action, detail, hash: hashSHA256({ action, detail, ts: Date.now() }) };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-FIB[14]);
    }
  }

  registerService(name, profile, currentConfig = {}) {
    const baseProfile = SERVICE_PROFILES[profile] ?? SERVICE_PROFILES['api'];
    this.services.set(name, { profile, config: { ...baseProfile, ...currentConfig } });
    this.metricsWindows.set(name, new MetricsWindow());
    this._audit('register-service', { name, profile });
    return { name, profile, config: this.services.get(name).config };
  }

  recordMetrics(serviceName, sample) {
    const window = this.metricsWindows.get(serviceName);
    if (!window) return { error: `Service not registered: ${serviceName}` };
    window.record(sample);
  }

  analyze(serviceName) {
    const service = this.services.get(serviceName);
    const window = this.metricsWindows.get(serviceName);
    if (!service || !window) return { error: `Service not found: ${serviceName}` };

    const metrics = window.aggregate();
    if (!metrics) return { serviceName, recommendations: [], reason: 'insufficient-data' };

    const recs = [];
    const config = service.config;

    // Concurrency optimization
    if (metrics.concurrentRequests.max > config.concurrency * CSL_THRESHOLDS.HIGH) {
      const newConcurrency = Math.ceil(metrics.concurrentRequests.max / PSI);
      recs.push({
        type: 'concurrency',
        current: config.concurrency,
        recommended: Math.min(newConcurrency, FIB[12]),
        reason: 'concurrent-requests-near-limit',
        impact: 'high',
      });
    } else if (metrics.concurrentRequests.avg < config.concurrency * PSI2) {
      const newConcurrency = Math.max(FIB[3], Math.ceil(metrics.concurrentRequests.avg * PHI));
      recs.push({
        type: 'concurrency',
        current: config.concurrency,
        recommended: newConcurrency,
        reason: 'concurrent-requests-underutilized',
        impact: 'medium',
      });
    }

    // Memory optimization
    if (metrics.memoryUtilization.max > CSL_THRESHOLDS.HIGH) {
      recs.push({
        type: 'memory',
        current: config.memory,
        recommended: this._nextMemoryTier(config.memory),
        reason: 'memory-utilization-high',
        impact: 'high',
      });
    }

    // Cold start mitigation
    if (metrics.coldStarts > FIB[4] && config.minInstances === 0) {
      recs.push({
        type: 'min-instances',
        current: 0,
        recommended: FIB[3],
        reason: 'frequent-cold-starts',
        impact: 'high',
      });
    }

    // Scale-up trigger
    if (metrics.cpuUtilization.avg > CSL_THRESHOLDS.MEDIUM && metrics.instanceCount.max >= config.maxInstances * CSL_THRESHOLDS.HIGH) {
      const newMax = Math.ceil(config.maxInstances * PHI);
      recs.push({
        type: 'max-instances',
        current: config.maxInstances,
        recommended: newMax,
        reason: 'scaling-ceiling-reached',
        impact: 'medium',
      });
    }

    // Error rate check
    if (metrics.errorRate > PSI2) {
      recs.push({
        type: 'error-rate',
        current: metrics.errorRate,
        recommended: 'investigate',
        reason: 'error-rate-above-threshold',
        impact: 'critical',
      });
    }

    const recommendation = {
      serviceName,
      profile: service.profile,
      metrics,
      recommendations: recs,
      ts: Date.now(),
      hash: hashSHA256({ serviceName, recs, ts: Date.now() }),
    };

    this.recommendations.push(recommendation);
    if (this.recommendations.length > this.maxRecommendations) {
      this.recommendations = this.recommendations.slice(-FIB[14]);
    }

    this._audit('analyze', { serviceName, recommendationCount: recs.length });
    return recommendation;
  }

  _nextMemoryTier(current) {
    const tiers = ['128Mi', '256Mi', '512Mi', '1Gi', '2Gi', '4Gi', '8Gi'];
    const idx = tiers.indexOf(current);
    return idx >= 0 && idx < tiers.length - 1 ? tiers[idx + 1] : current;
  }

  generateYAML(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return { error: `Service not found: ${serviceName}` };

    const c = service.config;
    return `apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ${serviceName}
  annotations:
    run.googleapis.com/launch-stage: BETA
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "${c.minInstances}"
        autoscaling.knative.dev/maxScale: "${c.maxInstances}"
        run.googleapis.com/cpu-throttling: "${c.cpuThrottle}"
        run.googleapis.com/startup-cpu-boost: "${c.startupCpuBoost}"
    spec:
      containerConcurrency: ${c.concurrency}
      timeoutSeconds: ${c.timeoutSeconds}
      containers:
        - resources:
            limits:
              cpu: "${c.cpu}"
              memory: "${c.memory}"`;
  }

  analyzeAll() {
    const results = {};
    for (const name of this.services.keys()) {
      results[name] = this.analyze(name);
    }
    return results;
  }

  health() {
    return {
      registeredServices: this.services.size,
      recommendationCount: this.recommendations.length,
      auditLogSize: this.auditLog.length,
      projectId: this.projectId,
      region: this.region,
    };
  }
}

export default CloudRunOptimizer;
export { CloudRunOptimizer, MetricsWindow, SERVICE_PROFILES };
