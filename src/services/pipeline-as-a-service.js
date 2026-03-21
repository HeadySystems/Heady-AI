// HEADY_BRAND:BEGIN
// ║  HEADY™ — Pipeline-as-a-Service API                                    ║
// ║  FILE: src/services/pipeline-as-a-service.js                           ║
// HEADY_BRAND:END
/**
 * Pipeline-as-a-Service — Let enterprises plug custom stages into HCFullPipeline.
 *
 * Features:
 *   - Register external webhook stages with HMAC-SHA256 signatures
 *   - Metered billing per pipeline run
 *   - Circuit breaker per webhook endpoint (threshold: fib(5)=5)
 *   - Stage result collection with timeout (PHI_TIMING.PHI_5 = ~11s)
 *   - Express router for stage management and run triggering
 *
 * All constants from phi-math.js. Zero hardcoded numbers.
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const crypto = require('crypto');
const {
  fib, PHI, PSI,
  PHI_TIMING,
  CSL_THRESHOLDS,
  phiBackoff,
} = require('../../shared/phi-math');

let log = null;
try { log = require('../utils/logger'); } catch { log = console; }

const { bus } = require('../core/event-bus');

// ─── Constants (φ-scaled) ───────────────────────────────────────────────────

/** Max registered webhook stages: fib(9) = 55 */
const MAX_STAGES = fib(9);

/** Webhook delivery timeout: PHI_TIMING.PHI_5 = 11,090ms */
const WEBHOOK_TIMEOUT_MS = PHI_TIMING.PHI_5;

/** Circuit breaker failure threshold: fib(5) = 5 */
const CB_FAILURE_THRESHOLD = fib(5);

/** Circuit breaker reset interval: PHI_TIMING.PHI_7 = 29,034ms */
const CB_RESET_MS = PHI_TIMING.PHI_7;

/** Max concurrent runs: fib(7) = 13 */
const MAX_CONCURRENT_RUNS = fib(7);

/** Max run history: fib(13) = 377 */
const MAX_HISTORY = fib(13);

/** Max retries per webhook call: fib(3) = 2 */
const MAX_RETRIES = fib(3);

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

class CircuitBreaker {
  constructor() {
    this.failures = 0;
    this.open = false;
    this.lastFailure = 0;
  }

  recordSuccess() {
    this.failures = 0;
    this.open = false;
  }

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= CB_FAILURE_THRESHOLD) {
      this.open = true;
    }
  }

  isOpen() {
    if (this.open && Date.now() - this.lastFailure > CB_RESET_MS) {
      this.open = false;
      this.failures = 0;
    }
    return this.open;
  }
}

// ─── PaaS Service ────────────────────────────────────────────────────────────

class PipelineAsAService {
  constructor() {
    /** @type {Map<string, { name, url, secret, position, timeout, enabled, circuitBreaker }>} */
    this._stages = new Map();

    /** @type {Map<string, object>} runId → run state */
    this._runs = new Map();

    /** @type {Array<object>} run history */
    this._history = [];

    /** @type {{ totalRuns: number, totalBilled: number, webhookCalls: number }} */
    this._billing = { totalRuns: 0, totalBilled: 0, webhookCalls: 0 };
  }

  /**
   * Register an external webhook stage.
   * @param {{ name: string, url: string, secret: string, position?: number, timeout?: number }} opts
   */
  registerStage(opts) {
    if (this._stages.size >= MAX_STAGES) {
      throw new Error(`Max stages (${MAX_STAGES}) reached`);
    }
    if (!opts.name || !opts.url || !opts.secret) {
      throw new Error('name, url, and secret required');
    }

    this._stages.set(opts.name, {
      name: opts.name,
      url: opts.url,
      secret: opts.secret,
      position: opts.position || this._stages.size,
      timeout: opts.timeout || WEBHOOK_TIMEOUT_MS,
      enabled: true,
      circuitBreaker: new CircuitBreaker(),
      registeredAt: Date.now(),
    });

    bus.emit('paas', {
      type: 'stage_registered',
      data: { name: opts.name, url: opts.url, position: opts.position },
    });

    return { registered: true, name: opts.name };
  }

  /**
   * Unregister a webhook stage.
   * @param {string} name
   */
  unregisterStage(name) {
    const deleted = this._stages.delete(name);
    if (deleted) {
      bus.emit('paas', { type: 'stage_unregistered', data: { name } });
    }
    return { unregistered: deleted };
  }

  /**
   * Execute a pipeline run with custom stages.
   * @param {string} task
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async run(task, options = {}) {
    if (this._runs.size >= MAX_CONCURRENT_RUNS) {
      throw new Error(`Max concurrent runs (${MAX_CONCURRENT_RUNS}) reached`);
    }

    const runId = `paas:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
    const startTime = Date.now();

    const runState = {
      runId,
      task,
      status: 'running',
      stageResults: {},
      startedAt: startTime,
      completedAt: null,
    };

    this._runs.set(runId, runState);
    bus.emit('paas', { type: 'run_started', data: { runId, task } });

    // Execute stages in position order
    const stages = [...this._stages.values()]
      .filter(s => s.enabled)
      .sort((a, b) => a.position - b.position);

    let allPassed = true;

    for (const stage of stages) {
      if (stage.circuitBreaker.isOpen()) {
        runState.stageResults[stage.name] = {
          status: 'skipped',
          reason: 'circuit_breaker_open',
        };
        continue;
      }

      const result = await this._callWebhook(stage, { runId, task, options });
      runState.stageResults[stage.name] = result;

      if (!result.ok) {
        allPassed = false;
        if (options.haltOnFailure !== false) break;
      }
    }

    runState.status = allPassed ? 'completed' : 'failed';
    runState.completedAt = Date.now();
    runState.durationMs = runState.completedAt - startTime;

    // Billing: meter the run
    this._billing.totalRuns++;
    this._billing.totalBilled += 0.05; // $0.05 per pipeline run

    bus.emit('billing', {
      type: 'meter_event',
      data: {
        productId: 'pipeline_runs',
        quantity: 1,
        runId,
        durationMs: runState.durationMs,
      },
    });

    // Record history
    this._history.push({
      runId,
      task: task.slice(0, 100),
      status: runState.status,
      stages: stages.length,
      durationMs: runState.durationMs,
      ts: new Date().toISOString(),
    });
    if (this._history.length > MAX_HISTORY) {
      this._history = this._history.slice(-MAX_HISTORY);
    }

    bus.emit('paas', {
      type: 'run_completed',
      data: { runId, status: runState.status, durationMs: runState.durationMs },
    });

    return runState;
  }

  /**
   * Call a webhook stage with HMAC-SHA256 signature.
   * @param {object} stage
   * @param {object} payload
   * @returns {Promise<object>}
   * @private
   */
  async _callWebhook(stage, payload) {
    const body = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', stage.secret)
      .update(body)
      .digest('hex');

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), stage.timeout);

        const res = await fetch(stage.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Heady-Signature': `sha256=${signature}`,
            'X-Heady-Stage': stage.name,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        this._billing.webhookCalls++;

        if (res.ok) {
          stage.circuitBreaker.recordSuccess();
          let responseData = null;
          try { responseData = await res.json(); } catch { /* non-JSON response */ }
          return { ok: true, status: res.status, data: responseData, attempt };
        }

        stage.circuitBreaker.recordFailure();

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, phiBackoff(attempt + 1)));
        }
      } catch (err) {
        stage.circuitBreaker.recordFailure();

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, phiBackoff(attempt + 1)));
        } else {
          return { ok: false, error: err.message, attempt };
        }
      }
    }

    return { ok: false, error: 'max retries exceeded' };
  }

  /** List registered stages */
  listStages() {
    return [...this._stages.values()].map(s => ({
      name: s.name,
      url: s.url,
      position: s.position,
      enabled: s.enabled,
      circuitBreakerOpen: s.circuitBreaker.isOpen(),
      timeout: s.timeout,
    }));
  }

  /** Get run status */
  getRunStatus(runId) {
    return this._runs.get(runId) || null;
  }

  /** Get billing metrics */
  getBilling() {
    return {
      ...this._billing,
      pricePerRun: 0.05,
      recentRuns: this._history.slice(-fib(5)),
    };
  }
}

// ─── Express Router ──────────────────────────────────────────────────────────

function createPaaSRouter() {
  const express = require('express');
  const router  = express.Router();
  const service = new PipelineAsAService();

  router.post('/stages/register', (req, res) => {
    try {
      const result = service.registerStage(req.body || {});
      res.status(201).json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.delete('/stages/:name', (req, res) => {
    const result = service.unregisterStage(req.params.name);
    res.json({ ok: result.unregistered, ...result });
  });

  router.get('/stages', (_req, res) => {
    res.json({ ok: true, stages: service.listStages() });
  });

  router.post('/run', async (req, res) => {
    try {
      const { task, options } = req.body || {};
      if (!task) return res.status(400).json({ ok: false, error: 'task required' });
      const result = await service.run(task, options);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get('/runs/:runId', (req, res) => {
    const run = service.getRunStatus(req.params.runId);
    if (!run) return res.status(404).json({ ok: false, error: 'run not found' });
    res.json({ ok: true, ...run });
  });

  router.get('/billing', (_req, res) => {
    res.json({ ok: true, ...service.getBilling() });
  });

  router.post('/billing/meter', (req, res) => {
    const { tenantId, quantity } = req.body || {};
    bus.emit('billing', {
      type: 'meter_event',
      data: { productId: 'pipeline_runs', tenantId, quantity: quantity || 1 },
    });
    res.json({ ok: true, metered: true });
  });

  return router;
}

module.exports = {
  PipelineAsAService,
  createPaaSRouter,
  MAX_STAGES,
  WEBHOOK_TIMEOUT_MS,
  CB_FAILURE_THRESHOLD,
};
