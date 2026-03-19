'use strict';

/**
 * Heady™ Living Contract Service
 * Self-enforcing smart contracts between agents/services.
 * Defines SLAs, CSL-gated compliance, phi-scaled penalty escalation.
 * Contracts adapt based on historical performance.
 */

const crypto = require('crypto');
const express = require('express');

// ── Phi-Math Constants ──
const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ── CSL Gate Thresholds ──
const CSL = { MIN: 0.500, LOW: 0.691, MED: 0.809, HIGH: 0.882, CRIT: 0.927, DEDUP: 0.972 };

// ── Structured Logger ──
function createLogger(service) {
  return (level, message, meta = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      correlationId: meta.correlationId || crypto.randomUUID(),
      service,
      level,
      message,
      ...meta,
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
    return entry;
  };
}

// ── Performance Adaptor (Exponential Moving Average) ──
class PerformanceAdaptor {
  constructor(alpha = PSI) {
    this.alpha = alpha;
    this.ema = new Map();
  }

  update(metric, value) {
    const prev = this.ema.get(metric);
    const next = prev !== undefined ? this.alpha * value + (1 - this.alpha) * prev : value;
    this.ema.set(metric, next);
    return next;
  }

  get(metric) { return this.ema.get(metric); }

  trend(metric, value) {
    const current = this.ema.get(metric);
    if (current === undefined) return 'stable';
    const delta = value - current;
    if (Math.abs(delta) < current * 0.02) return 'stable';
    return delta > 0 ? 'increasing' : 'decreasing';
  }
}

// ── Violation Escalator (Fibonacci-spaced tiers) ──
class ViolationEscalator {
  constructor() {
    this.tiers = FIB.slice(3, 10).map((f, i) => ({
      tier: i,
      thresholdCount: f,
      label: ['warning', 'minor', 'moderate', 'major', 'severe', 'critical', 'terminal'][i],
      penaltyMultiplier: Math.pow(PHI, i),
    }));
  }

  escalate(consecutiveViolations) {
    let matched = this.tiers[0];
    for (const tier of this.tiers) {
      if (consecutiveViolations >= tier.thresholdCount) matched = tier;
    }
    return { ...matched, consecutiveViolations };
  }
}

// ── Contract Enforcer ──
class ContractEnforcer {
  evaluate(metrics, slaTerms) {
    const results = [];
    if (slaTerms.latencyMs != null && metrics.latencyMs != null) {
      const pass = metrics.latencyMs <= slaTerms.latencyMs;
      results.push({ term: 'latencyMs', target: slaTerms.latencyMs, actual: metrics.latencyMs, pass, deviation: (metrics.latencyMs - slaTerms.latencyMs) / slaTerms.latencyMs });
    }
    if (slaTerms.uptimePercent != null && metrics.uptimePercent != null) {
      const pass = metrics.uptimePercent >= slaTerms.uptimePercent;
      results.push({ term: 'uptimePercent', target: slaTerms.uptimePercent, actual: metrics.uptimePercent, pass, deviation: (slaTerms.uptimePercent - metrics.uptimePercent) / slaTerms.uptimePercent });
    }
    if (slaTerms.errorRate != null && metrics.errorRate != null) {
      const pass = metrics.errorRate <= slaTerms.errorRate;
      results.push({ term: 'errorRate', target: slaTerms.errorRate, actual: metrics.errorRate, pass, deviation: (metrics.errorRate - slaTerms.errorRate) / (slaTerms.errorRate || 1e-9) });
    }
    if (slaTerms.throughput != null && metrics.throughput != null) {
      const pass = metrics.throughput >= slaTerms.throughput;
      results.push({ term: 'throughput', target: slaTerms.throughput, actual: metrics.throughput, pass, deviation: (slaTerms.throughput - metrics.throughput) / slaTerms.throughput });
    }
    const passed = results.filter((r) => r.pass).length;
    const coherence = results.length > 0 ? passed / results.length : CSL.LOW;
    return { results, passed, total: results.length, coherence: parseFloat(coherence.toFixed(4)), compliant: coherence >= CSL.MED };
  }
}

// ── Living Contract ──
class LivingContract {
  constructor(id, parties, slaTerms) {
    this.id = id;
    this.parties = parties;
    this.slaTerms = { latencyMs: 200, uptimePercent: 99.5, errorRate: 0.01, throughput: 100, ...slaTerms };
    this.violations = [];
    this.metrics = [];
    this.consecutiveViolations = 0;
    this.currentPenalty = 0;
    this.adaptor = new PerformanceAdaptor();
    this.enforcer = new ContractEnforcer();
    this.escalator = new ViolationEscalator();
    this.createdAt = Date.now();
    this.adaptationCount = 0;
    this.windowSize = FIB[8]; // rolling window of 21 samples
  }

  reportMetric(metrics) {
    this.metrics.push({ ...metrics, timestamp: Date.now() });
    if (this.metrics.length > FIB[12]) this.metrics = this.metrics.slice(-FIB[11]);
    for (const key of Object.keys(metrics)) this.adaptor.update(key, metrics[key]);
    return { recorded: true, sampleCount: this.metrics.length };
  }

  evaluate() {
    if (this.metrics.length === 0) return { compliant: true, coherence: CSL.LOW, message: 'No metrics reported yet' };
    const latest = this.metrics[this.metrics.length - 1];
    const result = this.enforcer.evaluate(latest, this.slaTerms);
    if (!result.compliant) {
      this.consecutiveViolations++;
      const escalation = this.escalator.escalate(this.consecutiveViolations);
      this.currentPenalty = this.currentPenalty === 0 ? 1 : this.currentPenalty * PHI;
      const violation = { timestamp: Date.now(), evaluation: result, escalation, penalty: parseFloat(this.currentPenalty.toFixed(4)) };
      this.violations.push(violation);
      return { ...result, violation, escalation, penalty: violation.penalty };
    }
    this.consecutiveViolations = 0;
    this.currentPenalty = 0;
    return result;
  }

  adapt() {
    const window = this.metrics.slice(-this.windowSize);
    if (window.length < FIB[5]) return { adapted: false, reason: 'Insufficient samples', required: FIB[5], current: window.length };
    const avgLatency = window.reduce((s, m) => s + (m.latencyMs || 0), 0) / window.length;
    const avgUptime = window.reduce((s, m) => s + (m.uptimePercent || 0), 0) / window.length;
    const avgError = window.reduce((s, m) => s + (m.errorRate || 0), 0) / window.length;
    const avgThroughput = window.reduce((s, m) => s + (m.throughput || 0), 0) / window.length;
    const changes = {};
    const factor = PSI * 0.1;
    if (avgLatency < this.slaTerms.latencyMs * PSI) {
      this.slaTerms.latencyMs = parseFloat((this.slaTerms.latencyMs * (1 - factor)).toFixed(2));
      changes.latencyMs = { action: 'tightened', newTarget: this.slaTerms.latencyMs };
    } else if (avgLatency > this.slaTerms.latencyMs * PHI) {
      this.slaTerms.latencyMs = parseFloat((this.slaTerms.latencyMs * (1 + factor)).toFixed(2));
      changes.latencyMs = { action: 'relaxed', newTarget: this.slaTerms.latencyMs };
    }
    if (avgUptime > this.slaTerms.uptimePercent + 0.3) {
      this.slaTerms.uptimePercent = parseFloat(Math.min(99.99, this.slaTerms.uptimePercent * (1 + factor * 0.01)).toFixed(3));
      changes.uptimePercent = { action: 'tightened', newTarget: this.slaTerms.uptimePercent };
    } else if (avgUptime < this.slaTerms.uptimePercent - 1.0) {
      this.slaTerms.uptimePercent = parseFloat(Math.max(90, this.slaTerms.uptimePercent * (1 - factor * 0.01)).toFixed(3));
      changes.uptimePercent = { action: 'relaxed', newTarget: this.slaTerms.uptimePercent };
    }
    if (avgError < this.slaTerms.errorRate * PSI) {
      this.slaTerms.errorRate = parseFloat(Math.max(0.001, this.slaTerms.errorRate * (1 - factor)).toFixed(4));
      changes.errorRate = { action: 'tightened', newTarget: this.slaTerms.errorRate };
    } else if (avgError > this.slaTerms.errorRate * PHI) {
      this.slaTerms.errorRate = parseFloat(Math.min(0.1, this.slaTerms.errorRate * (1 + factor)).toFixed(4));
      changes.errorRate = { action: 'relaxed', newTarget: this.slaTerms.errorRate };
    }
    this.adaptationCount++;
    return { adapted: Object.keys(changes).length > 0, changes, adaptationCount: this.adaptationCount, slaTerms: { ...this.slaTerms }, windowSize: window.length };
  }

  toJSON() {
    return {
      id: this.id, parties: this.parties, slaTerms: this.slaTerms,
      violationCount: this.violations.length, consecutiveViolations: this.consecutiveViolations,
      currentPenalty: this.currentPenalty, metricCount: this.metrics.length,
      adaptationCount: this.adaptationCount, createdAt: this.createdAt,
      coherence: this.metrics.length > 0 ? this.enforcer.evaluate(this.metrics[this.metrics.length - 1], this.slaTerms).coherence : CSL.LOW,
    };
  }
}

// ── Main Service ──
class HeadyLivingContractService {
  constructor(config = {}) {
    this.serviceName = 'heady-living-contract';
    this.port = config.port || 3350;
    this.log = createLogger(this.serviceName);
    this.app = express();
    this.app.use(express.json({ limit: '2mb' }));

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      next();
    });
    this.contracts = new Map();
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

    this.app.post('/contract', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const { parties, slaTerms, contractId } = req.body;
        const id = contractId || `lc_${crypto.randomUUID().slice(0, 8)}`;
        const contract = new LivingContract(id, parties || [], slaTerms || {});
        this.contracts.set(id, contract);
        this.log('info', 'Living contract created', { correlationId: cid, contractId: id, parties: contract.parties });
        res.json(contract.toJSON());
      } catch (err) {
        this.log('error', 'Contract creation failed', { correlationId: cid, error: err.message });
        res.status(400).json({ error: err.message });
      }
    });

    this.app.post('/contract/:id/evaluate', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      const contract = this.contracts.get(req.params.id);
      if (!contract) return res.status(404).json({ error: 'Contract not found' });
      try {
        const result = contract.evaluate();
        this.log('info', 'Contract evaluated', { correlationId: cid, contractId: req.params.id, compliant: result.compliant, coherence: result.coherence });
        res.json(result);
      } catch (err) {
        this.log('error', 'Evaluation failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/contract/:id/report', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      const contract = this.contracts.get(req.params.id);
      if (!contract) return res.status(404).json({ error: 'Contract not found' });
      try {
        const result = contract.reportMetric(req.body);
        this.log('info', 'Metric reported', { correlationId: cid, contractId: req.params.id, sampleCount: result.sampleCount });
        res.json(result);
      } catch (err) {
        this.log('error', 'Report failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/contract/:id', (req, res) => {
      const contract = this.contracts.get(req.params.id);
      if (!contract) return res.status(404).json({ error: 'Contract not found' });
      res.json(contract.toJSON());
    });

    this.app.get('/contract/:id/violations', (req, res) => {
      const contract = this.contracts.get(req.params.id);
      if (!contract) return res.status(404).json({ error: 'Contract not found' });
      res.json({ contractId: contract.id, violations: contract.violations, total: contract.violations.length });
    });

    this.app.post('/contract/:id/adapt', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      const contract = this.contracts.get(req.params.id);
      if (!contract) return res.status(404).json({ error: 'Contract not found' });
      try {
        const result = contract.adapt();
        this.log('info', 'Contract adaptation', { correlationId: cid, contractId: req.params.id, adapted: result.adapted });
        res.json(result);
      } catch (err) {
        this.log('error', 'Adaptation failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });
  }

  health() {
    const uptimeMs = Date.now() - this.startTime;
    const contractCount = this.contracts.size;
    const coherence = contractCount > 0 ? Math.min(CSL.HIGH, CSL.MED + contractCount * PSI * 0.01) : CSL.LOW;
    return {
      status: coherence >= CSL.MIN ? 'healthy' : 'degraded',
      coherence: parseFloat(coherence.toFixed(4)),
      uptime: uptimeMs,
      service: this.serviceName,
      contracts: contractCount,
      requests: this.requestCount,
      phi: PHI,
    };
  }

  async init() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this.log('info', `${this.serviceName} initialized`, { port: this.port, phi: PHI });
        resolve();
      });
    });
  }

  async execute(task) {
    const cid = crypto.randomUUID();
    this.log('info', 'Executing contract task', { correlationId: cid, type: task.type });
    if (task.type === 'create') {
      const id = `task_${cid.slice(0, 8)}`;
      const contract = new LivingContract(id, task.parties || [], task.slaTerms || {});
      this.contracts.set(id, contract);
      return contract.toJSON();
    }
    if (task.type === 'evaluate' && task.contractId) {
      const contract = this.contracts.get(task.contractId);
      if (!contract) return { error: 'Contract not found' };
      if (task.metrics) contract.reportMetric(task.metrics);
      return contract.evaluate();
    }
    return { error: 'Unknown task type' };
  }

  async shutdown() {
    this.log('info', 'Shutting down living contract service');
    this.contracts.clear();
    if (this.server) {
      return new Promise((resolve) => this.server.close(resolve));
    }
  }
}

module.exports = { HeadyLivingContractService, LivingContract, ContractEnforcer, ViolationEscalator, PerformanceAdaptor, CSL, PHI, PSI, FIB };
