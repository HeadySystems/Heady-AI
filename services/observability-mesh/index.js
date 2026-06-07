// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: services/observability-mesh/index.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// © 2026 HeadySystems Inc. — Eric Haywood, Founder — 60+ Provisional Patents
'use strict';

const { Router } = require('express');
const {
  PHI, PSI, FIB, CSL_THRESHOLDS,
  phiFusionWeights, phiBackoff, cosineSimilarity, cslGate,
  ALERTS, getPressureLevel,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/structured-logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * @module observability-mesh
 * @version 1.0.0
 * @description Production observability mesh — phi-weighted coherence scoring,
 * Sentry severity classification, LLM trace collection, cost tracking,
 * and correlation-ID propagation across the Heady ecosystem.
 */

const SERVICE_NAME = 'observability-mesh';
const logger = createLogger(SERVICE_NAME, { domain: 'observability' });

/** Load Sentry DSN registry from configs */
const sentryRegistryPath = path.resolve(__dirname, '../../configs/sentry-dsn-registry.json');
const SENTRY_REGISTRY = JSON.parse(fs.readFileSync(sentryRegistryPath, 'utf8'));

/** Phi-scaled sampling rates by pool tier */
const SAMPLING_RATES = Object.freeze({
  hot:     1.0,
  warm:    PSI,
  cold:    PSI * PSI,
  reserve: PSI * PSI * PSI,
});

/** In-memory trace and cost buffers */
const traceBuffer = [];
const errorBuffer = [];
const costLedger = { totalUsd: 0, byService: {} };
const MAX_BUFFER = FIB[12]; // 144

// ─── CoherenceScorer ────────────────────────────────────────────────────────

/**
 * CoherenceScorer — phi-weighted fusion of latency and error signals
 * into a single coherence metric on [0, 1].
 */
class CoherenceScorer {
  /**
   * @param {Object} opts
   * @param {number} [opts.latencyTargetMs=1000] Target latency in ms
   * @param {number} [opts.errorBudget=0.01] Acceptable error rate
   */
  constructor(opts = {}) {
    this.latencyTargetMs = opts.latencyTargetMs || 1000;
    this.errorBudget = opts.errorBudget || 0.01;
    this.weights = phiFusionWeights(2); // [0.618, 0.382]
  }

  /**
   * Score coherence from latency and error rate.
   * @param {number} latencyMs Observed p99 latency
   * @param {number} errorRate Observed error rate [0,1]
   * @returns {{ score: number, latencyFactor: number, errorFactor: number, level: string }}
   */
  score(latencyMs, errorRate) {
    const latencyFactor = Math.max(0, 1 - (latencyMs / (this.latencyTargetMs * PHI)));
    const errorFactor = Math.max(0, 1 - (errorRate / this.errorBudget));
    const raw = this.weights[0] * latencyFactor + this.weights[1] * errorFactor;
    const score = Math.min(1, Math.max(0, raw));
    const level = score >= CSL_THRESHOLDS.CRITICAL ? 'CRITICAL'
      : score >= CSL_THRESHOLDS.HIGH ? 'HIGH'
      : score >= CSL_THRESHOLDS.MEDIUM ? 'MEDIUM'
      : score >= CSL_THRESHOLDS.LOW ? 'LOW'
      : 'MINIMUM';
    return { score, latencyFactor, errorFactor, level };
  }
}

// ─── SentryClassifier ───────────────────────────────────────────────────────

/**
 * SentryClassifier — maps CSL confidence levels to Sentry severity
 * and resolves DSN from the registry.
 */
class SentryClassifier {
  /**
   * Classify a CSL confidence into Sentry severity.
   * @param {number} confidence CSL confidence [0,1]
   * @returns {{ severity: string, shouldCapture: boolean, sampleRate: number }}
   */
  classify(confidence) {
    if (confidence >= CSL_THRESHOLDS.CRITICAL) {
      return { severity: 'fatal', shouldCapture: true, sampleRate: 1.0 };
    }
    if (confidence >= CSL_THRESHOLDS.HIGH) {
      return { severity: 'error', shouldCapture: true, sampleRate: 1.0 };
    }
    if (confidence >= CSL_THRESHOLDS.MEDIUM) {
      return { severity: 'warning', shouldCapture: true, sampleRate: PSI };
    }
    if (confidence >= CSL_THRESHOLDS.LOW) {
      return { severity: 'info', shouldCapture: true, sampleRate: PSI * PSI };
    }
    return { severity: 'debug', shouldCapture: false, sampleRate: PSI * PSI * PSI };
  }

  /**
   * Resolve the Sentry DSN for a given service name.
   * @param {string} serviceName
   * @returns {string|null} DSN string or null
   */
  resolveDsn(serviceName) {
    for (const [, project] of Object.entries(SENTRY_REGISTRY.projects || {})) {
      if (project.services && project.services.includes(serviceName)) {
        return project.dsn;
      }
    }
    return null;
  }
}

// ─── Correlation ID helper ──────────────────────────────────────────────────

/**
 * Extract or generate a correlation ID from the request.
 * @param {import('express').Request} req
 * @returns {string}
 */
function getCorrelationId(req) {
  return req.headers['x-heady-correlation-id']
    || req.headers['x-correlation-id']
    || `obs-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// ─── Router factory ─────────────────────────────────────────────────────────

const scorer = new CoherenceScorer();
const classifier = new SentryClassifier();
let startTime = Date.now();

/**
 * Create the observability mesh Express router.
 * @returns {import('express').Router}
 */
function createObservabilityRouter() {
  const router = Router();
  startTime = Date.now();

  /** Health endpoint */
  router.get('/health', (_req, res) => {
    const h = health();
    res.status(h.status === 'HEALTHY' ? 200 : 503).json(h);
  });

  /** Trace an LLM call */
  router.post('/trace/llm', (req, res) => {
    const correlationId = getCorrelationId(req);
    const { model, promptTokens, completionTokens, latencyMs, service } = req.body || {};
    const entry = {
      type: 'llm',
      correlationId,
      model: model || 'unknown',
      promptTokens: promptTokens || 0,
      completionTokens: completionTokens || 0,
      latencyMs: latencyMs || 0,
      service: service || 'unknown',
      timestamp: new Date().toISOString(),
    };
    if (traceBuffer.length >= MAX_BUFFER) traceBuffer.shift();
    traceBuffer.push(entry);
    logger.info('llm_trace', { correlationId, model: entry.model, latencyMs: entry.latencyMs });
    res.status(201).json({ accepted: true, correlationId });
  });

  /** Trace an error event */
  router.post('/trace/error', (req, res) => {
    const correlationId = getCorrelationId(req);
    const { error, service, confidence } = req.body || {};
    const csl = confidence != null ? confidence : CSL_THRESHOLDS.MEDIUM;
    const classification = classifier.classify(csl);
    const dsn = classifier.resolveDsn(service || 'unknown');
    const entry = {
      type: 'error',
      correlationId,
      error: error || 'unknown_error',
      service: service || 'unknown',
      confidence: csl,
      classification,
      dsn: dsn ? 'resolved' : 'none',
      timestamp: new Date().toISOString(),
    };
    if (errorBuffer.length >= MAX_BUFFER) errorBuffer.shift();
    errorBuffer.push(entry);
    logger.warn('error_trace', { correlationId, severity: classification.severity, service: entry.service });
    res.status(201).json({ accepted: true, correlationId, classification, dsnResolved: !!dsn });
  });

  /** Compute coherence score from supplied metrics */
  router.post('/coherence', (req, res) => {
    const correlationId = getCorrelationId(req);
    const { latencyMs, errorRate } = req.body || {};
    if (latencyMs == null || errorRate == null) {
      return res.status(400).json({ error: 'latencyMs and errorRate are required' });
    }
    const result = scorer.score(latencyMs, errorRate);
    logger.info('coherence_scored', { correlationId, ...result });
    res.json({ correlationId, ...result, samplingRates: SAMPLING_RATES });
  });

  /** Cost tracking endpoint */
  router.post('/cost', (req, res) => {
    const correlationId = getCorrelationId(req);
    const { service, amountUsd } = req.body || {};
    if (!service || amountUsd == null) {
      return res.status(400).json({ error: 'service and amountUsd are required' });
    }
    costLedger.totalUsd += amountUsd;
    costLedger.byService[service] = (costLedger.byService[service] || 0) + amountUsd;
    const pressure = getPressureLevel(Math.min(costLedger.totalUsd / 1000, 1));
    logger.info('cost_recorded', { correlationId, service, amountUsd, totalUsd: costLedger.totalUsd });
    res.status(201).json({ correlationId, costLedger, pressure });
  });

  return router;
}

/**
 * Health check for observability mesh.
 * @returns {Object} health status
 */
function health() {
  return {
    service: SERVICE_NAME,
    status: 'HEALTHY',
    uptime: Date.now() - startTime,
    traces: traceBuffer.length,
    errors: errorBuffer.length,
    costTotalUsd: costLedger.totalUsd,
    samplingRates: SAMPLING_RATES,
    sentryProjects: Object.keys(SENTRY_REGISTRY.projects || {}).length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Graceful shutdown — flush buffers.
 */
function shutdown() {
  logger.info('shutdown', { service: SERVICE_NAME, traces: traceBuffer.length, errors: errorBuffer.length });
  traceBuffer.length = 0;
  errorBuffer.length = 0;
}

module.exports = {
  createObservabilityRouter,
  CoherenceScorer,
  SentryClassifier,
  health,
  shutdown,
  SAMPLING_RATES,
};
