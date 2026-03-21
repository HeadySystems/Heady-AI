'use strict';

const crypto = require('crypto');
const express = require('express');

// ── Phi-Math Constants ──
const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ── CSL Gate Thresholds ──
const CSL = {
  MIN: 0.500,
  LOW: 0.691,
  MED: 0.809,
  HIGH: 0.882,
  CRIT: 0.927,
  DEDUP: 0.972
};

// ── Structured Logger ──
function createLogger(service) {
  return (level, message, meta = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      correlationId: meta.correlationId || crypto.randomUUID(),
      service,
      level,
      message,
      ...meta
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
    return entry;
  };
}

// ── Time Series Buffer with Fibonacci-Windowed Buckets ──
class TimeSeriesBuffer {
  constructor(name, maxBuckets = FIB.length) {
    this.name = name;
    this.buckets = new Map();
    this.maxBuckets = maxBuckets;
    this.rawPoints = [];
    for (let i = 2; i < Math.min(maxBuckets, FIB.length); i++) {
      this.buckets.set(FIB[i], []);
    }
  }
  addPoint(value, timestamp = Date.now()) {
    this.rawPoints.push({
      value,
      timestamp
    });
    this.rawPoints.sort((a, b) => a.timestamp - b.timestamp);
    this._rebucket();
  }
  _rebucket() {
    for (const [window] of this.buckets) this.buckets.set(window, []);
    const len = this.rawPoints.length;
    for (const [window, bucket] of this.buckets) {
      const start = Math.max(0, len - window);
      for (let i = start; i < len; i++) bucket.push(this.rawPoints[i].value);
    }
  }
  fibonacciMovingAverage(windowIndex) {
    const window = FIB[Math.min(windowIndex, FIB.length - 1)];
    const bucket = this.buckets.get(window) || [];
    if (bucket.length === 0) return null;
    return bucket.reduce((a, b) => a + b, 0) / bucket.length;
  }
  phiWeightedAverage() {
    if (this.rawPoints.length === 0) return null;
    let weightSum = 0;
    let valueSum = 0;
    for (let i = 0; i < this.rawPoints.length; i++) {
      const weight = Math.pow(PHI, -(this.rawPoints.length - 1 - i));
      weightSum += weight;
      valueSum += this.rawPoints[i].value * weight;
    }
    return valueSum / weightSum;
  }
  recentValues(count) {
    return this.rawPoints.slice(-count).map(p => p.value);
  }
}

// ── Forecast Engine ──
class ForecastEngine {
  constructor() {
    this.coefficients = [PSI, PSI * PSI, PSI * PSI * PSI];
  }
  arima(series, horizon) {
    if (series.length < 3) return {
      error: 'Insufficient data; need >= 3 points'
    };
    const n = series.length;
    const diffs = [];
    for (let i = 1; i < n; i++) diffs.push(series[i] - series[i - 1]);
    const predictions = [];
    let prev = series.slice(-3);
    for (let h = 0; h < horizon; h++) {
      let next = 0;
      for (let k = 0; k < this.coefficients.length; k++) {
        next += this.coefficients[k] * (prev[prev.length - 1 - k] || 0);
      }
      const meanDiff = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
      next += meanDiff * PSI;
      predictions.push(next);
      prev.push(next);
      diffs.push(next - prev[prev.length - 2]);
    }
    return {
      method: 'arima',
      predictions,
      horizon,
      phiDecay: this.coefficients
    };
  }
  monteCarlo(series, horizon, iterations = FIB[10]) {
    if (series.length < 2) return {
      error: 'Insufficient data; need >= 2 points'
    };
    const returns = [];
    for (let i = 1; i < series.length; i++) {
      returns.push(series[i] / (series[i - 1] || 1));
    }
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const paths = [];
    for (let s = 0; s < iterations; s++) {
      const path = [series[series.length - 1]];
      for (let h = 0; h < horizon; h++) {
        const u1 = Math.random() || 1e-10;
        const u2 = Math.random() || 1e-10;
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const step = path[path.length - 1] * (meanReturn + stdDev * z);
        path.push(step);
      }
      paths.push(path.slice(1));
    }
    const means = [];
    const lows = [];
    const highs = [];
    for (let h = 0; h < horizon; h++) {
      const col = paths.map(p => p[h]).sort((a, b) => a - b);
      means.push(col.reduce((a, b) => a + b, 0) / col.length);
      lows.push(col[Math.floor(col.length * 0.05)]);
      highs.push(col[Math.floor(col.length * 0.95)]);
    }
    return {
      method: 'monte_carlo',
      predictions: means,
      ci90: {
        low: lows,
        high: highs
      },
      iterations,
      horizon
    };
  }
  fibonacciTrend(buffer) {
    const trends = [];
    for (let i = 3; i < Math.min(10, FIB.length); i++) {
      const avg = buffer.fibonacciMovingAverage(i);
      if (avg !== null) trends.push({
        window: FIB[i],
        average: avg
      });
    }
    if (trends.length < 2) return {
      error: 'Insufficient windowed data'
    };
    const slopes = [];
    for (let i = 1; i < trends.length; i++) {
      slopes.push((trends[i].average - trends[i - 1].average) / (trends[i].window - trends[i - 1].window));
    }
    const phiAvg = buffer.phiWeightedAverage();
    const trendDirection = slopes.reduce((a, b) => a + b, 0) / slopes.length;
    return {
      method: 'fibonacci_trend',
      windows: trends,
      slopes,
      trendDirection,
      phiWeightedCurrent: phiAvg,
      momentum: trendDirection * PHI
    };
  }
}

// ── CSL-Gated Confidence Interval ──
function cslConfidenceInterval(predictions, requestedCSL) {
  const threshold = CSL[requestedCSL] || CSL.MED;
  const n = predictions.length;
  if (n === 0) return {
    interval: [0, 0],
    coherence: 0,
    gate: 'FAIL'
  };
  const mean = predictions.reduce((a, b) => a + b, 0) / n;
  const variance = predictions.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const halfWidth = stdDev * PHI * (1 - threshold);
  const coherence = 1 / (1 + stdDev * PSI);
  const gate = coherence >= threshold ? 'PASS' : 'FAIL';
  return {
    mean,
    stdDev,
    interval: [mean - halfWidth, mean + halfWidth],
    coherence: parseFloat(coherence.toFixed(4)),
    threshold,
    gate
  };
}

// ── Phi-Scaled Time Horizon ──
function phiScaleHorizon(baseHorizon, steps) {
  const horizons = [];
  for (let i = 0; i < steps; i++) {
    horizons.push(Math.round(baseHorizon * Math.pow(PHI, i)));
  }
  return horizons;
}

// ── Main Service ──
class HeadyTemporalForecastingService {
  constructor(config = {}) {
    this.serviceName = 'heady-temporal-forecasting';
    this.port = config.port || 3341;
    this.log = createLogger(this.serviceName);
    this.app = express();
    this.app.use(express.json({
      limit: '2mb'
    }));
    this.engine = new ForecastEngine();
    this.series = new Map();
    this.startTime = Date.now();
    this.requestCount = 0;
    this.server = null;
    this._setupRoutes();
  }
  _setupRoutes() {
    this.app.get('/health', (_req, res) => {
      const h = this.health();
      res.status(h.coherence >= CSL.MIN ? 200 : 503).json(h);
    });
    this.app.post('/series', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      try {
        const {
          metric,
          values
        } = req.body;
        if (!metric || !Array.isArray(values)) return res.status(400).json({
          error: 'metric and values[] required'
        });
        if (!this.series.has(metric)) this.series.set(metric, new TimeSeriesBuffer(metric));
        const buf = this.series.get(metric);
        for (const v of values) buf.addPoint(typeof v === 'object' ? v.value : v, typeof v === 'object' ? v.timestamp : Date.now());
        this.log('info', 'Series data ingested', {
          correlationId: cid,
          metric,
          points: values.length
        });
        res.json({
          metric,
          totalPoints: buf.rawPoints.length,
          phiWeightedAvg: buf.phiWeightedAverage()
        });
      } catch (err) {
        this.log('error', 'Series ingestion failed', {
          correlationId: cid,
          error: err.message
        });
        res.status(500).json({
          error: err.message
        });
      }
    });
    this.app.post('/forecast', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const {
          metric,
          horizon = FIB[7],
          method = 'arima',
          confidence = 'MED'
        } = req.body;
        const buf = this.series.get(metric);
        if (!buf) return res.status(404).json({
          error: `Metric '${metric}' not found`
        });
        const data = buf.recentValues(FIB[12]);
        let result;
        if (method === 'monte_carlo') result = this.engine.monteCarlo(data, horizon);else if (method === 'fibonacci_trend') result = this.engine.fibonacciTrend(buf);else result = this.engine.arima(data, horizon);
        if (result.error) return res.status(400).json(result);
        const ci = cslConfidenceInterval(result.predictions || [], confidence);
        const horizons = phiScaleHorizon(horizon, 5);
        this.log('info', 'Forecast generated', {
          correlationId: cid,
          metric,
          method,
          coherence: ci.coherence
        });
        res.json({
          metric,
          ...result,
          confidence: ci,
          phiHorizons: horizons
        });
      } catch (err) {
        this.log('error', 'Forecast failed', {
          correlationId: cid,
          error: err.message
        });
        res.status(500).json({
          error: err.message
        });
      }
    });
    this.app.post('/trend', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const {
          metric
        } = req.body;
        const buf = this.series.get(metric);
        if (!buf) return res.status(404).json({
          error: `Metric '${metric}' not found`
        });
        const result = this.engine.fibonacciTrend(buf);
        if (result.error) return res.status(400).json(result);
        this.log('info', 'Trend analysis complete', {
          correlationId: cid,
          metric,
          direction: result.trendDirection
        });
        res.json({
          metric,
          ...result
        });
      } catch (err) {
        this.log('error', 'Trend analysis failed', {
          correlationId: cid,
          error: err.message
        });
        res.status(500).json({
          error: err.message
        });
      }
    });
    this.app.get('/metrics/:name', (req, res) => {
      const buf = this.series.get(req.params.name);
      if (!buf) return res.status(404).json({
        error: `Metric '${req.params.name}' not found`
      });
      res.json({
        metric: buf.name,
        totalPoints: buf.rawPoints.length,
        phiWeightedAvg: buf.phiWeightedAverage(),
        windows: [...buf.buckets.entries()].map(([w, b]) => ({
          window: w,
          count: b.length,
          avg: b.length ? b.reduce((a, c) => a + c, 0) / b.length : null
        })),
        recent: buf.recentValues(FIB[7])
      });
    });
  }
  health() {
    const uptimeMs = Date.now() - this.startTime;
    const seriesCount = this.series.size;
    const coherence = seriesCount > 0 ? Math.min(CSL.HIGH, CSL.MED + seriesCount * PSI * 0.01) : CSL.LOW;
    return {
      status: coherence >= CSL.MIN ? 'healthy' : 'degraded',
      coherence: parseFloat(coherence.toFixed(4)),
      uptime: uptimeMs,
      service: this.serviceName,
      series: seriesCount,
      requests: this.requestCount,
      phi: PHI
    };
  }
  async init() {
    return new Promise(resolve => {
      this.server = this.app.listen(this.port, () => {
        this.log('info', `${this.serviceName} initialized`, {
          port: this.port,
          phi: PHI
        });
        resolve();
      });
    });
  }
  async execute(task) {
    const cid = crypto.randomUUID();
    this.log('info', 'Executing forecast task', {
      correlationId: cid,
      type: task.type,
      metric: task.metric
    });
    if (task.series) {
      if (!this.series.has(task.metric)) this.series.set(task.metric, new TimeSeriesBuffer(task.metric));
      const buf = this.series.get(task.metric);
      for (const v of task.series) buf.addPoint(v);
    }
    const buf = this.series.get(task.metric);
    if (!buf) return {
      error: 'No data for metric'
    };
    const data = buf.recentValues(FIB[12]);
    if (task.type === 'arima') return this.engine.arima(data, task.horizon || FIB[7]);
    if (task.type === 'monte_carlo') return this.engine.monteCarlo(data, task.horizon || FIB[7], task.iterations);
    if (task.type === 'fibonacci_trend') return this.engine.fibonacciTrend(buf);
    return this.engine.arima(data, task.horizon || FIB[7]);
  }
  async shutdown() {
    this.log('info', 'Shutting down temporal forecasting service');
    this.series.clear();
    if (this.server) {
      return new Promise(resolve => this.server.close(resolve));
    }
  }
}
module.exports = {
  HeadyTemporalForecastingService,
  TimeSeriesBuffer,
  ForecastEngine,
  cslConfidenceInterval,
  phiScaleHorizon,
  CSL,
  PHI,
  PSI,
  FIB
};