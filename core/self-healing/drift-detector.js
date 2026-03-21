'use strict';
/**
 * Heady Self-Healing — Drift Detector
 * Monitors component coherence via baseline comparison, embedding cosine similarity,
 * and config key matching. Quarantines critically drifted components.
 *
 * © 2026 HeadySystems Inc. — Eric Haywood
 * Architecture: φ-scaled, CSL-gated, Sacred Geometry v4.0
 */

// ─── φ-Math Constants ────────────────────────────────────────────
const PHI  = 1.618033988749895;
const PSI  = 1 / PHI;
const PSI2 = PSI * PSI;

const phiThreshold = (level, spread = 0.5) => 1 - Math.pow(PSI, level) * spread;

// ─── Coherence Thresholds (φ-harmonic levels) ───────────────────
const COHERENCE_THRESHOLDS = Object.freeze({
  HEALTHY:  phiThreshold(2),   // ≈ 0.809
  DRIFTING: phiThreshold(1),   // ≈ 0.691
  DEGRADED: phiThreshold(0),   // ≈ 0.500
  CRITICAL: PSI2,              // ≈ 0.382
});

// ─── Utility: Cosine Similarity ─────────────────────────────────
function cosineSimilarity(a, b) {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < len; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Utility: Config Key Match Ratio ────────────────────────────
function configMatchRatio(baselineConfig, currentConfig) {
  const keys = Object.keys(baselineConfig);
  if (keys.length === 0) return 1;
  let matches = 0;
  for (const key of keys) {
    if (JSON.stringify(baselineConfig[key]) === JSON.stringify(currentConfig[key])) {
      matches++;
    }
  }
  return matches / keys.length;
}

// ─── DriftDetector ──────────────────────────────────────────────
class DriftDetector {
  #baselines = new Map();       // componentId -> { type, data }
  #measurements = new Map();    // componentId -> [{ coherenceScore, timestamp }]
  #quarantined = new Set();

  constructor() {}

  /**
   * Register a baseline for a component.
   * @param {string} componentId
   * @param {string} componentType - 'embedding' | 'behavior' | 'config'
   * @param {object} baselineData - { vector?, qualityScore?, config? }
   */
  registerBaseline(componentId, componentType, baselineData) {
    this.#baselines.set(componentId, {
      type: componentType,
      data: baselineData,
      registeredAt: Date.now(),
    });
    if (!this.#measurements.has(componentId)) {
      this.#measurements.set(componentId, []);
    }
  }

  /**
   * Measure current coherence against baseline.
   * @param {string} componentId
   * @param {object} currentData - { vector?, qualityScore?, config? }
   * @returns {{ componentId, componentType, coherenceScore, baselineScore, driftDelta, status }}
   */
  measure(componentId, currentData) {
    const baseline = this.#baselines.get(componentId);
    if (!baseline) {
      throw new Error(`No baseline registered for component: ${componentId}`);
    }

    let coherenceScore;

    switch (baseline.type) {
      case 'embedding': {
        // Use cosine similarity between baseline and current vectors
        if (baseline.data.vector && currentData.vector) {
          coherenceScore = cosineSimilarity(baseline.data.vector, currentData.vector);
        } else {
          coherenceScore = currentData.qualityScore / baseline.data.qualityScore;
        }
        break;
      }
      case 'config': {
        // Use key match ratio
        if (baseline.data.config && currentData.config) {
          coherenceScore = configMatchRatio(baseline.data.config, currentData.config);
        } else {
          coherenceScore = currentData.qualityScore / baseline.data.qualityScore;
        }
        break;
      }
      case 'behavior':
      default: {
        // Use quality score ratio
        coherenceScore = currentData.qualityScore / baseline.data.qualityScore;
        break;
      }
    }

    // Clamp to [0, 1]
    coherenceScore = Math.max(0, Math.min(1, coherenceScore));

    // Determine status
    let status;
    if (coherenceScore >= COHERENCE_THRESHOLDS.HEALTHY) {
      status = 'healthy';
    } else if (coherenceScore >= COHERENCE_THRESHOLDS.DRIFTING) {
      status = 'drifting';
    } else if (coherenceScore >= COHERENCE_THRESHOLDS.DEGRADED) {
      status = 'degraded';
    } else {
      status = 'critical';
    }

    // Auto-quarantine on critical drift
    if (status === 'critical') {
      this.#quarantined.add(componentId);
    }

    const measurement = {
      componentId,
      componentType: baseline.type,
      coherenceScore,
      baselineScore: baseline.data.qualityScore || 1.0,
      driftDelta: 1.0 - coherenceScore,
      status,
      timestamp: Date.now(),
    };

    // Store measurement for trend analysis
    this.#measurements.get(componentId).push(measurement);

    return measurement;
  }

  /**
   * Analyze the trend for a component based on historical measurements.
   * @param {string} componentId
   * @returns {{ trend, isImproving, measurements }}
   */
  trend(componentId) {
    const measurements = this.#measurements.get(componentId) || [];

    if (measurements.length < 2) {
      return {
        trend: 'insufficient_data',
        isImproving: false,
        measurements: measurements.length,
      };
    }

    // Simple linear regression on coherence scores
    const scores = measurements.map(m => m.coherenceScore);
    const n = scores.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX  += i;
      sumY  += scores[i];
      sumXY += i * scores[i];
      sumX2 += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const isImproving = slope > 0;

    let trend;
    if (slope > 0.01) {
      trend = 'improving';
    } else if (slope < -0.01) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return {
      trend,
      isImproving,
      slope,
      measurements: n,
      latestScore: scores[n - 1],
    };
  }

  /**
   * Get the set of quarantined component IDs.
   * @returns {Set<string>}
   */
  getQuarantined() {
    return new Set(this.#quarantined);
  }

  /**
   * Release a component from quarantine.
   * @param {string} componentId
   */
  release(componentId) {
    this.#quarantined.delete(componentId);
  }

  /**
   * Return health status of the detector.
   */
  health() {
    const components = {};
    for (const [id, baseline] of this.#baselines) {
      const measurements = this.#measurements.get(id) || [];
      components[id] = {
        type: baseline.type,
        measurementCount: measurements.length,
        quarantined: this.#quarantined.has(id),
        latestScore: measurements.length > 0
          ? measurements[measurements.length - 1].coherenceScore
          : null,
      };
    }

    return {
      status: this.#quarantined.size === 0 ? 'healthy' : 'degraded',
      componentCount: this.#baselines.size,
      quarantinedCount: this.#quarantined.size,
      components,
    };
  }
}

module.exports = {
  DriftDetector,
  COHERENCE_THRESHOLDS,
  cosineSimilarity,
  configMatchRatio,
};
