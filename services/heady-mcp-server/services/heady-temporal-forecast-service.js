'use strict';

const express = require('express');
const crypto = require('crypto');

// ── PHI-MATH CONSTANTS ──────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
const CSL = {
  MINIMUM: 0.500,
  LOW: 0.691,
  MEDIUM: 0.809,
  HIGH: 0.882,
  CRITICAL: 0.927,
  DEDUP: 0.972
};

/** Fibonacci windows for trend analysis (in time units) */
const FIB_WINDOWS = [FIB[5], FIB[6], FIB[7], FIB[8], FIB[9], FIB[10]]; // [5, 8, 13, 21, 34, 55]

/** Monte Carlo simulation count */
const MC_DEFAULT_SIMS = FIB[10]; // 55

/**
 * Structured JSON logger.
 * @param {string} level - Log level
 * @param {string} msg - Message
 * @param {Object} meta - Metadata
 * @param {string} [correlationId] - Correlation ID
 */
function log(level, msg, meta = {}, correlationId = null) {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'heady-temporal-forecast-service',
    level,
    correlationId: correlationId || crypto.randomUUID(),
    message: msg,
    ...meta
  }) + '\n');
}
function phiBackoff(attempt) {
  return FIB[Math.min(attempt, FIB.length - 1)] * PSI * 1000;
}

/**
 * Simple seeded PRNG for reproducible Monte Carlo.
 * @param {number} seed - Seed value
 * @returns {Function} Random generator
 */
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = s * 1664525 + 1013904223 & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}
class HeadyTemporalForecastService {
  /**
   * @param {Object} config - Service configuration
   * @param {number} [config.port=3404] - HTTP port
   * @param {number} [config.maxSeries] - Maximum time series in memory
   * @param {number} [config.defaultSimulations] - Default MC simulation count
   */
  constructor(config = {}) {
    this.port = config.port || 3404;
    this.maxSeries = config.maxSeries || FIB[8];
    this.defaultSimulations = config.defaultSimulations || MC_DEFAULT_SIMS;
    /** @type {Map<string, {dataPoints: Array<{timestamp: number, value: number}>, metadata: Object}>} */
    this.timeSeries = new Map();
    /** @type {Map<string, Object>} */
    this.forecastCache = new Map();
    this._cacheMaxSize = FIB[10];
    this.app = express();
    this.server = null;
    this._started = false;
    this._coherence = CSL.HIGH;
    this._circuitBreaker = {
      failures: 0,
      maxFailures: FIB[6],
      openUntil: 0
    };
  }

  /**
   * Register a time series for forecasting.
   * @param {string} seriesId - Series identifier
   * @param {Object} metadata - Series metadata (unit, description, etc.)
   * @returns {Object} Registration result
   */
  registerSeries(seriesId, metadata = {}) {
    if (this.timeSeries.size >= this.maxSeries && !this.timeSeries.has(seriesId)) {
      const oldest = [...this.timeSeries.entries()].sort((a, b) => (a[1].dataPoints[0]?.timestamp || 0) - (b[1].dataPoints[0]?.timestamp || 0))[0];
      if (oldest) this.timeSeries.delete(oldest[0]);
    }
    if (!this.timeSeries.has(seriesId)) {
      this.timeSeries.set(seriesId, {
        dataPoints: [],
        metadata
      });
    }
    log('info', 'Series registered', {
      seriesId
    });
    return {
      seriesId,
      dataPoints: this.timeSeries.get(seriesId).dataPoints.length
    };
  }

  /**
   * Ingest data points into a time series.
   * @param {string} seriesId - Series identifier
   * @param {Array<{timestamp: number, value: number}>} points - Data points
   * @returns {Object} Ingestion result
   */
  ingest(seriesId, points) {
    const series = this.timeSeries.get(seriesId);
    if (!series) throw new Error('Series not found. Register first.');
    for (const point of points) {
      series.dataPoints.push({
        timestamp: point.timestamp || Date.now(),
        value: point.value
      });
    }
    series.dataPoints.sort((a, b) => a.timestamp - b.timestamp);
    // Trim to max Fibonacci-bounded length
    const maxLen = FIB[14]; // 377
    if (series.dataPoints.length > maxLen) {
      series.dataPoints = series.dataPoints.slice(series.dataPoints.length - maxLen);
    }
    this.forecastCache.delete(seriesId);
    return {
      seriesId,
      totalPoints: series.dataPoints.length,
      ingested: points.length
    };
  }

  /**
   * Calculate phi-weighted exponential moving average.
   * @param {number[]} values - Data values
   * @param {number} window - Window size
   * @returns {number} EMA value
   */
  phiEMA(values, window) {
    if (values.length === 0) return 0;
    const alpha = PSI / window;
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = alpha * values[i] + (1 - alpha) * ema;
    }
    return ema;
  }

  /**
   * Fibonacci-windowed trend analysis. Computes trends at multiple Fibonacci windows.
   * @param {string} seriesId - Series identifier
   * @returns {Object} Multi-window trend analysis
   */
  fibonacciTrend(seriesId) {
    const series = this.timeSeries.get(seriesId);
    if (!series || series.dataPoints.length < FIB[4]) throw new Error('Insufficient data');
    const values = series.dataPoints.map(p => p.value);
    const trends = {};
    for (const window of FIB_WINDOWS) {
      if (values.length < window) continue;
      const windowValues = values.slice(values.length - window);
      const ema = this.phiEMA(windowValues, window);
      const first = windowValues[0];
      const last = windowValues[windowValues.length - 1];
      const slope = (last - first) / window;
      const acceleration = windowValues.length >= FIB[4] ? (windowValues[windowValues.length - 1] - 2 * windowValues[Math.floor(windowValues.length / 2)] + windowValues[0]) / (window * window) : 0;
      const volatility = Math.sqrt(windowValues.reduce((s, v) => s + (v - ema) * (v - ema), 0) / windowValues.length);
      trends[`fib_${window}`] = {
        window,
        ema,
        slope,
        acceleration,
        volatility,
        direction: slope > 0 ? 'rising' : slope < 0 ? 'falling' : 'stable'
      };
    }

    // Consensus trend: phi-weighted vote across windows
    let weightedSlope = 0;
    let totalWeight = 0;
    let idx = 0;
    for (const trend of Object.values(trends)) {
      const weight = Math.pow(PHI, idx);
      weightedSlope += trend.slope * weight;
      totalWeight += weight;
      idx++;
    }
    const consensus = totalWeight > 0 ? weightedSlope / totalWeight : 0;
    return {
      seriesId,
      windows: trends,
      consensus: {
        slope: consensus,
        direction: consensus > 0 ? 'rising' : consensus < 0 ? 'falling' : 'stable'
      },
      dataPoints: values.length
    };
  }

  /**
   * Monte Carlo forecast: simulate future values with trend + noise.
   * @param {string} seriesId - Series identifier
   * @param {number} horizon - Forecast horizon (number of steps)
   * @param {Object} [options] - Simulation options
   * @returns {Object} Forecast with confidence intervals
   */
  forecast(seriesId, horizon, options = {}) {
    const series = this.timeSeries.get(seriesId);
    if (!series || series.dataPoints.length < FIB[4]) throw new Error('Insufficient data');
    const correlationId = crypto.randomUUID();
    const numSims = options.simulations || this.defaultSimulations;
    const seed = options.seed || Date.now();
    const rng = seededRandom(seed);
    const values = series.dataPoints.map(p => p.value);
    const trendAnalysis = this.fibonacciTrend(seriesId);
    const slope = trendAnalysis.consensus.slope;

    // Estimate volatility from the shortest Fibonacci window
    const shortWindow = FIB_WINDOWS.find(w => values.length >= w) || FIB_WINDOWS[0];
    const recent = values.slice(values.length - Math.min(shortWindow, values.length));
    const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
    const volatility = Math.sqrt(recent.reduce((s, v) => s + (v - mean) * (v - mean), 0) / recent.length);

    // Run simulations
    const simResults = [];
    for (let sim = 0; sim < numSims; sim++) {
      const path = [values[values.length - 1]];
      for (let t = 1; t <= horizon; t++) {
        const u1 = rng(),
          u2 = rng();
        const noise = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2) * volatility;
        const phiDecay = Math.pow(PSI, t / FIB[7]); // Trend decays over time
        path.push(path[t - 1] + slope * phiDecay + noise);
      }
      simResults.push(path);
    }

    // Aggregate per time step
    const forecastSteps = [];
    for (let t = 0; t <= horizon; t++) {
      const stepValues = simResults.map(s => s[t]).sort((a, b) => a - b);
      const stepMean = stepValues.reduce((s, v) => s + v, 0) / stepValues.length;
      const p5 = stepValues[Math.floor(stepValues.length * 0.05)];
      const p25 = stepValues[Math.floor(stepValues.length * 0.25)];
      const p50 = stepValues[Math.floor(stepValues.length * 0.50)];
      const p75 = stepValues[Math.floor(stepValues.length * 0.75)];
      const p95 = stepValues[Math.floor(stepValues.length * 0.95)];
      const ciWidth = p95 - p5;
      const confidence = ciWidth > 0 ? Math.max(0, 1 - ciWidth / (Math.abs(stepMean) + PSI)) : CSL.HIGH;
      forecastSteps.push({
        step: t,
        mean: stepMean,
        median: p50,
        p5,
        p25,
        p75,
        p95,
        ciWidth,
        confidence,
        cslGate: confidence >= CSL.HIGH ? 'HIGH' : confidence >= CSL.MEDIUM ? 'MEDIUM' : confidence >= CSL.LOW ? 'LOW' : 'MINIMUM'
      });
    }
    const result = {
      correlationId,
      seriesId,
      horizon,
      simulations: numSims,
      trend: trendAnalysis.consensus,
      forecast: forecastSteps,
      overallConfidence: forecastSteps.reduce((s, f) => s + f.confidence, 0) / forecastSteps.length,
      timestamp: new Date().toISOString()
    };

    // Cache forecast
    this.forecastCache.set(seriesId, result);
    if (this.forecastCache.size > this._cacheMaxSize) {
      const firstKey = this.forecastCache.keys().next().value;
      this.forecastCache.delete(firstKey);
    }
    log('info', 'Forecast generated', {
      seriesId,
      horizon,
      confidence: result.overallConfidence
    }, correlationId);
    return result;
  }

  /**
   * Predict when a threshold will be crossed based on current trend.
   * @param {string} seriesId - Series identifier
   * @param {number} threshold - Target threshold value
   * @returns {Object} Prediction with confidence
   */
  predictThresholdCrossing(seriesId, threshold) {
    const series = this.timeSeries.get(seriesId);
    if (!series || series.dataPoints.length < FIB[4]) throw new Error('Insufficient data');
    const values = series.dataPoints.map(p => p.value);
    const current = values[values.length - 1];
    const trendAnalysis = this.fibonacciTrend(seriesId);
    const slope = trendAnalysis.consensus.slope;
    if (Math.abs(slope) < PSI * 0.001) {
      return {
        seriesId,
        threshold,
        prediction: 'never',
        reason: 'Trend is flat',
        confidence: CSL.HIGH
      };
    }
    const stepsToThreshold = (threshold - current) / slope;
    if (stepsToThreshold < 0) {
      return {
        seriesId,
        threshold,
        prediction: 'never',
        reason: 'Trend moving away from threshold',
        confidence: CSL.MEDIUM
      };
    }

    // Phi-scaled urgency: closer = more urgent
    const urgency = 1 / (1 + stepsToThreshold * PSI);
    const cslGate = urgency >= CSL.CRITICAL ? 'IMMINENT' : urgency >= CSL.HIGH ? 'SOON' : urgency >= CSL.MEDIUM ? 'APPROACHING' : 'DISTANT';
    return {
      seriesId,
      threshold,
      currentValue: current,
      stepsToThreshold: Math.ceil(stepsToThreshold),
      urgency,
      cslGate,
      trend: trendAnalysis.consensus,
      timestamp: new Date().toISOString()
    };
  }

  /** Set up Express routes. @private */
  _setupRoutes() {
    this.app.use(express.json());
    this.app.get('/health', (_req, res) => {
      res.json({
        status: this._coherence >= CSL.MEDIUM ? 'healthy' : 'degraded',
        coherence: this._coherence,
        activeSeries: this.timeSeries.size,
        cachedForecasts: this.forecastCache.size,
        timestamp: new Date().toISOString()
      });
    });
    this.app.post('/series', (req, res) => {
      const result = this.registerSeries(req.body.seriesId, req.body.metadata);
      res.status(201).json(result);
    });
    this.app.post('/series/:id/ingest', (req, res) => {
      try {
        const result = this.ingest(req.params.id, req.body.points);
        res.json(result);
      } catch (err) {
        res.status(404).json({
          error: err.message
        });
      }
    });
    this.app.get('/series/:id/trend', (req, res) => {
      try {
        const result = this.fibonacciTrend(req.params.id);
        res.json(result);
      } catch (err) {
        res.status(400).json({
          error: err.message
        });
      }
    });
    this.app.post('/series/:id/forecast', (req, res) => {
      try {
        const result = this.forecast(req.params.id, req.body.horizon || FIB[8], req.body.options);
        res.json(result);
      } catch (err) {
        res.status(400).json({
          error: err.message
        });
      }
    });
    this.app.post('/series/:id/threshold', (req, res) => {
      try {
        const result = this.predictThresholdCrossing(req.params.id, req.body.threshold);
        res.json(result);
      } catch (err) {
        res.status(400).json({
          error: err.message
        });
      }
    });
  }

  /** @returns {Promise<void>} */
  async start() {
    if (this._started) return;
    this._setupRoutes();
    return new Promise(resolve => {
      this.server = this.app.listen(this.port, () => {
        this._started = true;
        log('info', 'HeadyTemporalForecastService started', {
          port: this.port
        });
        resolve();
      });
    });
  }

  /** @returns {Promise<void>} */
  async stop() {
    if (!this._started) return;
    return new Promise(resolve => {
      this.server.close(() => {
        this._started = false;
        this.timeSeries.clear();
        this.forecastCache.clear();
        log('info', 'HeadyTemporalForecastService stopped');
        resolve();
      });
    });
  }

  /** @returns {Object} Health */
  health() {
    return {
      status: this._coherence >= CSL.MEDIUM ? 'healthy' : 'degraded',
      coherence: this._coherence,
      activeSeries: this.timeSeries.size
    };
  }
}
module.exports = {
  HeadyTemporalForecastService,
  PHI,
  PSI,
  FIB,
  CSL,
  FIB_WINDOWS,
  phiBackoff
};