/**
 * HNSWTuner — pgvector HNSW Index Auto-Tuner
 * Dynamically adjusts HNSW parameters (m, efConstruction, efSearch)
 * based on workload analysis, recall measurements, and latency targets.
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

// ── HNSW Parameter Profiles ──────────────────────────────────────
const PROFILES = {
  'low-latency': {
    m: FIB[8],                 // 21
    efConstruction: FIB[11],   // 89
    efSearch: FIB[10],         // 55
    description: 'Optimized for fast queries at cost of recall',
    targetLatencyMs: FIB[5],   // 5ms
    targetRecall: CSL_THRESHOLDS.MEDIUM, // ≈0.809
  },
  'balanced': {
    m: FIB[8],                 // 21
    efConstruction: FIB[12],   // 144
    efSearch: FIB[11],         // 89
    description: 'Balance between latency and recall',
    targetLatencyMs: FIB[8],   // 21ms
    targetRecall: CSL_THRESHOLDS.HIGH,   // ≈0.882
  },
  'high-recall': {
    m: FIB[9],                 // 34
    efConstruction: FIB[13],   // 233
    efSearch: FIB[12],         // 144
    description: 'Maximum recall for critical queries',
    targetLatencyMs: FIB[10],  // 55ms
    targetRecall: CSL_THRESHOLDS.CRITICAL, // ≈0.927
  },
  'bulk-ingestion': {
    m: FIB[7],                 // 13
    efConstruction: FIB[10],   // 55
    efSearch: FIB[9],          // 34
    description: 'Fast ingestion with acceptable recall',
    targetLatencyMs: FIB[6],   // 8ms
    targetRecall: CSL_THRESHOLDS.LOW,    // ≈0.691
  },
};

// ── Workload Analyzer ────────────────────────────────────────────
class WorkloadAnalyzer {
  constructor() {
    this.querySamples = [];
    this.maxSamples = FIB[16];     // 987
    this.windowMs = FIB[10] * 60 * 1000; // 55 minutes
  }

  recordQuery(sample) {
    this.querySamples.push({
      latencyMs: sample.latencyMs,
      recall: sample.recall ?? null,
      vectorCount: sample.vectorCount,
      k: sample.k,
      ts: Date.now(),
    });
    if (this.querySamples.length > this.maxSamples) {
      this.querySamples = this.querySamples.slice(-FIB[14]);
    }
  }

  analyze() {
    const now = Date.now();
    const recent = this.querySamples.filter(s => now - s.ts < this.windowMs);

    if (recent.length < FIB[5]) {
      return { insufficient: true, sampleCount: recent.length };
    }

    const latencies = recent.map(s => s.latencyMs);
    const recalls = recent.filter(s => s.recall !== null).map(s => s.recall);
    const ks = recent.map(s => s.k);

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50Latency = this._percentile(latencies, PSI2); // ≈38th percentile
    const p95Latency = this._percentile(latencies, CSL_THRESHOLDS.CRITICAL);
    const p99Latency = this._percentile(latencies, 0.99);
    const avgRecall = recalls.length > 0 ? recalls.reduce((a, b) => a + b, 0) / recalls.length : null;
    const avgK = ks.reduce((a, b) => a + b, 0) / ks.length;

    const avgVectorCount = recent.reduce((a, s) => a + s.vectorCount, 0) / recent.length;

    return {
      insufficient: false,
      sampleCount: recent.length,
      latency: { avg: avgLatency, p50: p50Latency, p95: p95Latency, p99: p99Latency },
      recall: avgRecall,
      avgK,
      avgVectorCount,
      qps: recent.length / (this.windowMs / 1000),
    };
  }

  _percentile(arr, pct) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * pct) - 1;
    return sorted[Math.max(0, idx)];
  }
}

// ── HNSW Tuner ───────────────────────────────────────────────────
class HNSWTuner {
  constructor(config = {}) {
    this.workloadAnalyzer = new WorkloadAnalyzer();
    this.currentProfile = config.profile ?? 'balanced';
    this.currentParams = { ...PROFILES[this.currentProfile] };
    this.tuningHistory = [];
    this.maxHistory = FIB[16];
    this.auditLog = [];
    this.maxAuditEntries = FIB[16];
    this.autoTuneEnabled = config.autoTune ?? true;
    this.tuneIntervalMs = config.tuneIntervalMs ?? FIB[10] * 60 * 1000; // 55 min
    this.lastTuneAt = 0;
  }

  _audit(action, detail) {
    const entry = { ts: Date.now(), action, detail, hash: hashSHA256({ action, detail, ts: Date.now() }) };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-FIB[14]);
    }
  }

  recordQuery(sample) {
    this.workloadAnalyzer.recordQuery(sample);

    // Auto-tune check
    if (this.autoTuneEnabled && Date.now() - this.lastTuneAt > this.tuneIntervalMs) {
      return this.autoTune();
    }
    return null;
  }

  autoTune() {
    const analysis = this.workloadAnalyzer.analyze();
    if (analysis.insufficient) return { tuned: false, reason: 'insufficient-data' };

    this.lastTuneAt = Date.now();
    const recommendation = this._recommend(analysis);

    if (recommendation.profileChange) {
      const oldProfile = this.currentProfile;
      this.currentProfile = recommendation.newProfile;
      this.currentParams = { ...PROFILES[this.currentProfile] };

      this.tuningHistory.push({
        ts: Date.now(),
        from: oldProfile,
        to: this.currentProfile,
        analysis,
        reason: recommendation.reason,
      });
      if (this.tuningHistory.length > this.maxHistory) {
        this.tuningHistory = this.tuningHistory.slice(-FIB[14]);
      }

      this._audit('auto-tune', { from: oldProfile, to: this.currentProfile, reason: recommendation.reason });
      return { tuned: true, ...recommendation };
    }

    // Fine-tune within profile
    if (recommendation.paramAdjust) {
      Object.assign(this.currentParams, recommendation.params);
      this._audit('fine-tune', recommendation.params);
      return { tuned: true, finetuned: true, params: this.currentParams };
    }

    return { tuned: false, reason: 'no-change-needed' };
  }

  _recommend(analysis) {
    const lat = analysis.latency;
    const recall = analysis.recall;
    const vectorCount = analysis.avgVectorCount;

    // High latency, need to optimize for speed
    if (lat.p95 > FIB[10] && recall > CSL_THRESHOLDS.HIGH) {
      return { profileChange: true, newProfile: 'low-latency', reason: 'p95-latency-high' };
    }

    // Low recall, need more accuracy
    if (recall !== null && recall < CSL_THRESHOLDS.LOW) {
      return { profileChange: true, newProfile: 'high-recall', reason: 'recall-below-low' };
    }

    // Large dataset, consider adjusting m
    if (vectorCount > FIB[16] * FIB[8]) {
      const newM = Math.min(FIB[9], this.currentParams.m + FIB[3]);
      if (newM !== this.currentParams.m) {
        return { paramAdjust: true, params: { m: newM }, reason: 'large-dataset-m-increase' };
      }
    }

    // Adjust efSearch based on latency/recall balance
    if (lat.avg < this.currentParams.targetLatencyMs * PSI && (recall === null || recall < this.currentParams.targetRecall)) {
      const newEfSearch = Math.min(FIB[13], this.currentParams.efSearch + FIB[6]);
      return { paramAdjust: true, params: { efSearch: newEfSearch }, reason: 'headroom-increase-ef' };
    }

    return { profileChange: false, paramAdjust: false };
  }

  setProfile(profileName) {
    const profile = PROFILES[profileName];
    if (!profile) return { error: `Unknown profile: ${profileName}` };
    this.currentProfile = profileName;
    this.currentParams = { ...profile };
    this._audit('set-profile', { profile: profileName });
    return { profile: profileName, params: this.currentParams };
  }

  generateSQL() {
    const params = this.currentParams;
    return {
      createIndex: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_heady_vectors_hnsw
  ON heady_vectors USING hnsw (embedding vector_cosine_ops)
  WITH (m = ${params.m}, ef_construction = ${params.efConstruction});`,
      setSearchParam: `SET hnsw.ef_search = ${params.efSearch};`,
      profile: this.currentProfile,
      params,
    };
  }

  health() {
    return {
      currentProfile: this.currentProfile,
      currentParams: this.currentParams,
      autoTuneEnabled: this.autoTuneEnabled,
      lastTuneAt: this.lastTuneAt,
      tuningHistorySize: this.tuningHistory.length,
      workloadSamples: this.workloadAnalyzer.querySamples.length,
      auditLogSize: this.auditLog.length,
    };
  }
}

export default HNSWTuner;
export { HNSWTuner, WorkloadAnalyzer, PROFILES };
