'use strict';
const { createLogger } = require('../../utils/logger');
const logger = createLogger('auto-fixed');

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = {
  MINIMUM: 0.500,
  LOW: 0.691,
  MEDIUM: 0.809,
  HIGH: 0.882,
  CRITICAL: 0.927,
  DEDUP: 0.972
};
class HeadyProphetAgent {
  constructor(config = {}) {
    this.predictionHorizon = config.predictionHorizon || FIB[8] * 60000; // 21 minutes default
    this.anomalyWindowSize = config.anomalyWindowSize || FIB[10];
    this.metricsHistory = new Map();
    this.predictions = [];
    this.warnings = [];
    this.state = 'WATCHING';
    this.stats = {
      metricsIngested: 0,
      predictionsIssued: 0,
      warningsIssued: 0,
      truePositives: 0,
      falsePositives: 0
    };
    this._correlationId = `prophet-${Date.now().toString(36)}`;
  }

  /**
   * Ingest a metric observation
   * @param {object} metric — { service, name, value, timestamp }
   */
  ingestMetric(metric) {
    const {
      service,
      name,
      value,
      timestamp = Date.now()
    } = metric;
    const key = `${service}:${name}`;
    if (!this.metricsHistory.has(key)) this.metricsHistory.set(key, []);
    const history = this.metricsHistory.get(key);
    history.push({
      value,
      timestamp
    });

    // Fibonacci-windowed retention
    if (history.length > FIB[12]) history.splice(0, history.length - FIB[12]);
    this.stats.metricsIngested++;
  }

  /**
   * Run prediction cycle across all tracked metrics
   * @returns {object} — prediction report with warnings
   */
  async predict() {
    const correlationId = `pred-${Date.now().toString(36)}`;
    const newPredictions = [];
    const newWarnings = [];
    for (const [key, history] of this.metricsHistory) {
      if (history.length < FIB[5]) continue; // Need minimum data points

      const [service, name] = key.split(':');

      // 1. Trend analysis with linear regression
      const trend = this._linearTrend(history);

      // 2. Anomaly detection via Z-score
      const anomaly = this._detectAnomaly(history);

      // 3. Volatility via coefficient of variation
      const volatility = this._calculateVolatility(history);

      // 4. Threshold crossing prediction
      const crossingPred = this._predictThresholdCrossing(history, trend);

      // Combine signals into failure probability
      const signals = [anomaly.isAnomaly ? anomaly.severity : 0, trend.slope > 0 && name.includes('error') ? Math.min(1.0, Math.abs(trend.slope) * PHI) : 0, trend.slope < 0 && name.includes('throughput') ? Math.min(1.0, Math.abs(trend.slope) * PHI) : 0, volatility > PSI ? Math.min(1.0, volatility) : 0];
      const failureProbability = 1.0 - signals.reduce((prod, s) => prod * (1.0 - s * PSI), 1.0);
      const prediction = {
        service,
        metric: name,
        failureProbability,
        trend: {
          direction: trend.slope > 0 ? 'rising' : trend.slope < 0 ? 'falling' : 'stable',
          slope: trend.slope,
          r2: trend.r2
        },
        anomaly: anomaly.isAnomaly ? {
          zScore: anomaly.zScore,
          severity: anomaly.severity
        } : null,
        volatility,
        thresholdCrossing: crossingPred,
        timestamp: Date.now()
      };
      newPredictions.push(prediction);

      // Issue warning if failure probability exceeds CSL gate
      if (failureProbability >= CSL.LOW) {
        const urgency = failureProbability >= CSL.CRITICAL ? 'critical' : failureProbability >= CSL.HIGH ? 'high' : failureProbability >= CSL.MEDIUM ? 'medium' : 'low';
        const warning = {
          correlationId,
          service,
          metric: name,
          failureProbability,
          urgency,
          prediction,
          message: `${service}/${name}: ${Math.round(failureProbability * 100)}% failure probability — ${urgency} urgency`,
          issuedAt: Date.now(),
          expiresAt: Date.now() + this.predictionHorizon
        };
        newWarnings.push(warning);
        this.stats.warningsIssued++;
      }
    }
    this.predictions = newPredictions;
    this.warnings = newWarnings;
    this.stats.predictionsIssued += newPredictions.length;
    this._log('info', 'prediction-cycle', {
      correlationId,
      predictions: newPredictions.length,
      warnings: newWarnings.length
    });
    return {
      correlationId,
      predictions: newPredictions,
      warnings: newWarnings,
      summary: {
        totalMetrics: this.metricsHistory.size,
        criticalWarnings: newWarnings.filter(w => w.urgency === 'critical').length,
        highWarnings: newWarnings.filter(w => w.urgency === 'high').length,
        systemRisk: newPredictions.length > 0 ? newPredictions.reduce((s, p) => s + p.failureProbability, 0) / newPredictions.length : 0
      },
      coherence: this._calculateCoherence(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Linear trend via least squares regression
   * @param {Array} history — [{value, timestamp}]
   */
  _linearTrend(history) {
    const n = history.length;
    if (n < 2) return {
      slope: 0,
      intercept: 0,
      r2: 0
    };
    const xs = history.map((_, i) => i);
    const ys = history.map(h => h.value);
    const xMean = xs.reduce((s, x) => s + x, 0) / n;
    const yMean = ys.reduce((s, y) => s + y, 0) / n;
    let num = 0,
      den = 0,
      ssRes = 0,
      ssTot = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;
    for (let i = 0; i < n; i++) {
      const predicted = slope * xs[i] + intercept;
      ssRes += (ys[i] - predicted) ** 2;
      ssTot += (ys[i] - yMean) ** 2;
    }
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    return {
      slope,
      intercept,
      r2
    };
  }

  /** Z-score anomaly detection on latest value */
  _detectAnomaly(history) {
    if (history.length < FIB[5]) return {
      isAnomaly: false
    };
    const values = history.map(h => h.value);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    if (std === 0) return {
      isAnomaly: false
    };
    const latest = values[values.length - 1];
    const zScore = Math.abs((latest - mean) / std);
    const threshold = PHI + 1; // ~2.618 sigma
    return {
      isAnomaly: zScore > threshold,
      zScore,
      severity: Math.min(1.0, zScore / (threshold * PHI))
    };
  }

  /** Coefficient of variation */
  _calculateVolatility(history) {
    const recent = history.slice(-FIB[8]);
    const values = recent.map(h => h.value);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    if (mean === 0) return 0;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    return std / Math.abs(mean);
  }

  /** Predict when metric will cross critical threshold */
  _predictThresholdCrossing(history, trend) {
    if (trend.slope === 0 || trend.r2 < CSL.MINIMUM) return null;
    const latestValue = history[history.length - 1].value;
    const threshold = latestValue * PHI; // Assume critical at PHI * current
    const stepsToThreshold = (threshold - latestValue) / trend.slope;
    if (stepsToThreshold <= 0 || stepsToThreshold > FIB[12]) return null;
    const avgInterval = history.length > 1 ? (history[history.length - 1].timestamp - history[0].timestamp) / (history.length - 1) : 60000;
    return {
      estimatedMs: Math.round(stepsToThreshold * avgInterval),
      confidence: trend.r2,
      threshold
    };
  }
  _calculateCoherence() {
    if (this.warnings.length === 0) return 1.0;
    const critCount = this.warnings.filter(w => w.urgency === 'critical').length;
    return Math.max(CSL.MINIMUM, 1.0 - critCount * 0.1 - this.warnings.length * 0.02);
  }
  async start() {
    this._log('info', 'prophet-started', {
      predictionHorizon: this.predictionHorizon
    });
    return this;
  }
  async stop() {
    this.state = 'STOPPED';
    this._log('info', 'prophet-stopped', {
      stats: this.stats
    });
  }
  health() {
    return {
      status: 'ok',
      state: this.state,
      coherence: this._calculateCoherence(),
      stats: {
        ...this.stats
      },
      trackedMetrics: this.metricsHistory.size,
      activeWarnings: this.warnings.length,
      timestamp: new Date().toISOString()
    };
  }
  _log(level, event, data = {}) {
    logger.info(JSON.stringify({
      level,
      event,
      agent: 'HeadyProphetAgent',
      correlationId: this._correlationId,
      ...data,
      ts: new Date().toISOString()
    }));
  }
}
module.exports = {
  HeadyProphetAgent
};