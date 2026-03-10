// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Lens — Observability & Introspection Layer
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PHI, PSI, PSI2, PSI3, FIB, CSL_THRESHOLDS,
  cosineSimilarity, phiFusionWeights, cslGate, sha256,
  PRESSURE_LEVELS, ALERT_THRESHOLDS
} from '../shared/phi-math-v2.js';
import { systemCoherence, detectDrift, getAllNodes } from '../shared/sacred-geometry-v2.js';

class HeadyLens {
  #metrics;
  #snapshots;
  #anomalyHistory;
  #maxSnapshots;
  #maxMetrics;
  #collectionInterval;
  #nodeEmbeddings;

  constructor() {
    this.#metrics = new Map();
    this.#snapshots = [];
    this.#anomalyHistory = [];
    this.#maxSnapshots = FIB[12]; // 144
    this.#maxMetrics = FIB[16];   // 987
    this.#collectionInterval = FIB[8] * 1000; // 21 seconds
    this.#nodeEmbeddings = new Map();
  }

  observe(moduleName, metricName, value, tags = {}) {
    const key = moduleName + ':' + metricName;
    if (!this.#metrics.has(key)) {
      this.#metrics.set(key, []);
    }

    const series = this.#metrics.get(key);
    series.push({
      value, timestamp: Date.now(), tags,
    });

    if (series.length > this.#maxMetrics) {
      this.#metrics.set(key, series.slice(-this.#maxMetrics));
    }

    const anomaly = this.#checkAnomaly(key, value, series);
    if (anomaly) {
      this.#anomalyHistory.push(anomaly);
    }

    return { key, anomaly };
  }

  updateNodeEmbedding(nodeName, embedding) {
    this.#nodeEmbeddings.set(nodeName, embedding);
  }

  getSystemHealth() {
    const coherence = this.#nodeEmbeddings.size >= 2
      ? systemCoherence(Object.fromEntries(this.#nodeEmbeddings))
      : 1.0;

    const drifted = this.#nodeEmbeddings.size >= 2
      ? detectDrift(Object.fromEntries(this.#nodeEmbeddings))
      : [];

    const metricsHealth = this.#computeMetricsHealth();

    const overallScore = cslGate(
      (coherence + metricsHealth.score) / 2,
      coherence,
      CSL_THRESHOLDS.MEDIUM,
      PSI3
    );

    let pressureLevel = 'NOMINAL';
    if (1 - overallScore > PRESSURE_LEVELS.CRITICAL.min) pressureLevel = 'CRITICAL';
    else if (1 - overallScore > PRESSURE_LEVELS.HIGH.min) pressureLevel = 'HIGH';
    else if (1 - overallScore > PRESSURE_LEVELS.ELEVATED.min) pressureLevel = 'ELEVATED';

    return {
      overallScore,
      coherence,
      metricsHealth: metricsHealth.score,
      pressureLevel,
      driftedPairs: drifted.length,
      driftDetails: drifted,
      anomalyCount: this.#anomalyHistory.length,
      trackedModules: this.#metrics.size,
      trackedNodes: this.#nodeEmbeddings.size,
      timestamp: Date.now(),
    };
  }

  detectAnomalies(lookback = FIB[8]) {
    return this.#anomalyHistory.slice(-lookback);
  }

  getCoherenceMatrix() {
    const nodes = Array.from(this.#nodeEmbeddings.keys());
    const matrix = {};

    for (const a of nodes) {
      matrix[a] = {};
      for (const b of nodes) {
        if (a === b) { matrix[a][b] = 1.0; continue; }
        matrix[a][b] = cosineSimilarity(
          this.#nodeEmbeddings.get(a),
          this.#nodeEmbeddings.get(b)
        );
      }
    }

    return { nodes, matrix };
  }

  async snapshot() {
    const health = this.getSystemHealth();
    const snap = {
      id: await sha256('snapshot:' + Date.now()),
      health,
      metricsSummary: this.#summarizeMetrics(),
      timestamp: Date.now(),
    };

    this.#snapshots.push(snap);
    if (this.#snapshots.length > this.#maxSnapshots) {
      this.#snapshots = this.#snapshots.slice(-this.#maxSnapshots);
    }

    return snap;
  }

  getSnapshots(limit = FIB[6]) {
    return this.#snapshots.slice(-limit);
  }

  getMetrics(moduleName = null) {
    if (moduleName) {
      const result = {};
      for (const [key, series] of this.#metrics) {
        if (key.startsWith(moduleName + ':')) {
          result[key] = series.slice(-FIB[8]);
        }
      }
      return result;
    }
    const summary = {};
    for (const [key, series] of this.#metrics) {
      const recent = series.slice(-FIB[8]);
      const values = recent.map(m => m.value);
      summary[key] = {
        count: series.length,
        latest: values[values.length - 1],
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }
    return summary;
  }

  #checkAnomaly(key, value, series) {
    if (series.length < FIB[6]) return null;

    const recent = series.slice(-FIB[8]);
    const values = recent.map(m => m.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const phiBand = stdDev * PHI;
    if (Math.abs(value - mean) > phiBand) {
      return {
        key, value, mean, stdDev,
        deviation: Math.abs(value - mean) / stdDev,
        threshold: PHI,
        timestamp: Date.now(),
        severity: Math.abs(value - mean) > stdDev * PHI * PHI ? 'critical' : 'warning',
      };
    }
    return null;
  }

  #computeMetricsHealth() {
    let healthyCount = 0;
    let total = 0;

    for (const [key, series] of this.#metrics) {
      if (series.length < FIB[3]) continue;
      total++;
      const recent = series.slice(-FIB[5]);
      const values = recent.map(m => m.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
      const cv = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 0;
      if (cv < PSI) healthyCount++;
    }

    return { score: total > 0 ? healthyCount / total : 1.0, healthy: healthyCount, total };
  }

  #summarizeMetrics() {
    const summary = {};
    for (const [key, series] of this.#metrics) {
      const latest = series[series.length - 1];
      summary[key] = { count: series.length, latest: latest?.value, timestamp: latest?.timestamp };
    }
    return summary;
  }
}

export { HeadyLens };
export default HeadyLens;
