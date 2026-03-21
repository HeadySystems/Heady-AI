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
// ║  FILE: src/api/pipeline-as-a-service.js                         ║
// ║  LAYER: api                                                     ║
// ║  PURPOSE: Pipeline-as-a-Service — enterprise webhook stage API  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Pipeline-as-a-Service (PaaS) API
 *
 * Allows enterprises to register custom webhook stages that plug into
 * HCFullPipeline execution. Each stage is called via POST with run context
 * and results are aggregated into the pipeline run record.
 *
 * All timeouts and backoff intervals derive from φ (golden ratio) to
 * eliminate arbitrary magic numbers.
 */
'use strict';

const { Router } = require('express');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// ── φ Constants ──────────────────────────────────────────────────────────────

const PHI = 1.618033988749895;
const PHI_2 = PHI * PHI;                                   // 2.618...
const PHI_3 = PHI_2 * PHI;                                 // 4.236...
const PHI_4 = PHI_3 * PHI;                                 // 6.854...
const PHI_TIMEOUT_DEFAULT = Math.round(PHI_4 * 1000);      // 6854ms
const PHI_BACKOFF_SEQUENCE = [
  Math.round(PHI * 1000),                                  // 1618ms
  Math.round(PHI_2 * 1000),                                // 2618ms
  Math.round(PHI_3 * 1000),                                // 4236ms
];

// ── Billing Event Bus ────────────────────────────────────────────────────────

const billingBus = new EventEmitter();
billingBus.setMaxListeners(64);

// ── In-Memory Stores ─────────────────────────────────────────────────────────

const stages = new Map();
const runs = new Map();
const usageRecords = [];

// ── ID Generation ────────────────────────────────────────────────────────────

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
}

// ── Auth Middleware ───────────────────────────────────────────────────────────

function requireApiKey(req, res, next) {
  const key = req.headers['x-heady-api-key'];
  if (!key) {
    return res.status(401).json({
      error: 'Missing X-Heady-API-Key header',
      code: 'AUTH_REQUIRED',
    });
  }
  const expected = process.env.HEADY_API_KEY || '';
  if (expected.length === 0) {
    return res.status(503).json({
      error: 'Server API key not configured',
      code: 'KEY_NOT_CONFIGURED',
    });
  }
  const keyBuf = Buffer.from(key);
  const expectedBuf = Buffer.from(expected);
  if (keyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(keyBuf, expectedBuf)) {
    return res.status(403).json({
      error: 'Invalid API key',
      code: 'AUTH_INVALID',
    });
  }
  next();
}

// ── Webhook Caller ───────────────────────────────────────────────────────────

/**
 * POST JSON to a webhook URL with timeout.
 * Returns parsed response body.
 */
function callWebhook(webhookUrl, payload, timeoutMs, authHeader) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(webhookUrl);
    const transport = parsed.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);

    const opts = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Heady-PaaS/1.0',
        'X-Heady-Pipeline': 'HCFullPipeline',
      },
      timeout: timeoutMs,
    };

    if (authHeader) {
      opts.headers['Authorization'] = authHeader;
    }

    const req = transport.request(opts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`Webhook returned HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          err.body = raw;
          return reject(err);
        }
        try {
          resolve(JSON.parse(raw));
        } catch (parseErr) {
          const err = new Error('Webhook returned invalid JSON');
          err.body = raw;
          reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const err = new Error(`Webhook timed out after ${timeoutMs}ms`);
      err.code = 'WEBHOOK_TIMEOUT';
      reject(err);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Webhook Caller with φ-Backoff Retry ──────────────────────────────────────

async function callWebhookWithRetry(webhookUrl, payload, timeoutMs, authHeader) {
  let lastErr;
  for (let attempt = 0; attempt <= PHI_BACKOFF_SEQUENCE.length; attempt++) {
    try {
      return await callWebhook(webhookUrl, payload, timeoutMs, authHeader);
    } catch (err) {
      lastErr = err;
      if (attempt < PHI_BACKOFF_SEQUENCE.length) {
        const delay = PHI_BACKOFF_SEQUENCE[attempt];
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastErr;
}

// ── Stage Execution Engine ───────────────────────────────────────────────────

/**
 * Execute a single custom stage within a pipeline run.
 * Updates the run record in-place with stage results.
 */
async function executeStage(stage, run, previousResults) {
  const stageRecord = {
    stageId: stage.stageId,
    name: stage.name,
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    result: null,
    error: null,
    durationMs: 0,
    webhookCalls: 0,
    retries: 0,
  };

  run.stageResults.push(stageRecord);

  const payload = {
    stageId: stage.stageId,
    runId: run.runId,
    context: run.context,
    previousResults,
  };

  const timeout = stage.timeout || PHI_TIMEOUT_DEFAULT;
  const startTs = Date.now();

  try {
    const response = await callWebhookWithRetry(
      stage.webhookUrl,
      payload,
      timeout,
      stage.authHeader
    );

    const elapsed = Date.now() - startTs;
    stageRecord.status = response.status === 'failed' ? 'failed' : 'completed';
    stageRecord.result = response.result || null;
    stageRecord.durationMs = response.durationMs || elapsed;
    stageRecord.completedAt = new Date().toISOString();
    stageRecord.webhookCalls = 1;

    return stageRecord;
  } catch (err) {
    const elapsed = Date.now() - startTs;
    stageRecord.status = 'failed';
    stageRecord.error = err.message;
    stageRecord.durationMs = elapsed;
    stageRecord.completedAt = new Date().toISOString();
    stageRecord.retries = PHI_BACKOFF_SEQUENCE.length;
    stageRecord.webhookCalls = PHI_BACKOFF_SEQUENCE.length + 1;

    return stageRecord;
  }
}

/**
 * Execute the full pipeline run: all registered custom stages in order.
 */
async function executePipeline(run) {
  const orderedStages = Array.from(stages.values())
    .filter((s) => {
      if (run.stageFilter && run.stageFilter.length > 0) {
        return run.stageFilter.includes(s.stageId);
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);

  run.status = 'running';
  run.startedAt = new Date().toISOString();
  run.totalStages = orderedStages.length;

  billingBus.emit('pipeline:run:start', {
    runId: run.runId,
    stageCount: orderedStages.length,
    timestamp: run.startedAt,
  });

  const previousResults = [];
  let totalWebhookCalls = 0;

  for (const stage of orderedStages) {
    if (run.aborted) {
      run.status = 'aborted';
      run.completedAt = new Date().toISOString();
      run.durationMs = Date.now() - new Date(run.startedAt).getTime();

      billingBus.emit('pipeline:run:complete', {
        runId: run.runId,
        status: 'aborted',
        stagesExecuted: previousResults.length,
        totalWebhookCalls,
        durationMs: run.durationMs,
        timestamp: run.completedAt,
      });

      recordUsage(run, totalWebhookCalls);
      return;
    }

    const stageResult = await executeStage(stage, run, previousResults);
    totalWebhookCalls += stageResult.webhookCalls;
    previousResults.push({
      stageId: stageResult.stageId,
      name: stageResult.name,
      status: stageResult.status,
      result: stageResult.result,
      durationMs: stageResult.durationMs,
    });

    if (stageResult.status === 'failed') {
      run.status = 'failed';
      run.completedAt = new Date().toISOString();
      run.durationMs = Date.now() - new Date(run.startedAt).getTime();
      run.failedStage = stageResult.stageId;

      billingBus.emit('pipeline:run:complete', {
        runId: run.runId,
        status: 'failed',
        failedStage: stageResult.stageId,
        stagesExecuted: previousResults.length,
        totalWebhookCalls,
        durationMs: run.durationMs,
        timestamp: run.completedAt,
      });

      recordUsage(run, totalWebhookCalls);
      return;
    }
  }

  run.status = 'completed';
  run.completedAt = new Date().toISOString();
  run.durationMs = Date.now() - new Date(run.startedAt).getTime();

  billingBus.emit('pipeline:run:complete', {
    runId: run.runId,
    status: 'completed',
    stagesExecuted: previousResults.length,
    totalWebhookCalls,
    durationMs: run.durationMs,
    timestamp: run.completedAt,
  });

  recordUsage(run, totalWebhookCalls);
}

// ── Metered Billing ──────────────────────────────────────────────────────────

function recordUsage(run, totalWebhookCalls) {
  const record = {
    id: generateId('usage'),
    runId: run.runId,
    timestamp: new Date().toISOString(),
    runsCount: 1,
    totalDurationMs: run.durationMs || 0,
    stagesExecuted: run.stageResults.length,
    webhookCalls: totalWebhookCalls,
    status: run.status,
  };
  usageRecords.push(record);

  billingBus.emit('usage:recorded', record);
}

/**
 * Export usage data formatted for Stripe metered billing.
 * Returns aggregated usage for the given time window.
 */
function exportUsageForStripe(sinceMs) {
  const cutoff = sinceMs || 0;
  const relevant = usageRecords.filter(
    (r) => new Date(r.timestamp).getTime() >= cutoff
  );

  const aggregated = {
    period_start: sinceMs ? new Date(sinceMs).toISOString() : null,
    period_end: new Date().toISOString(),
    total_runs: relevant.length,
    total_duration_ms: relevant.reduce((s, r) => s + r.totalDurationMs, 0),
    total_stages_executed: relevant.reduce((s, r) => s + r.stagesExecuted, 0),
    total_webhook_calls: relevant.reduce((s, r) => s + r.webhookCalls, 0),
    successful_runs: relevant.filter((r) => r.status === 'completed').length,
    failed_runs: relevant.filter((r) => r.status === 'failed').length,
    aborted_runs: relevant.filter((r) => r.status === 'aborted').length,
    line_items: [
      {
        metric: 'pipeline_runs',
        quantity: relevant.length,
        unit: 'run',
      },
      {
        metric: 'pipeline_duration',
        quantity: Math.ceil(
          relevant.reduce((s, r) => s + r.totalDurationMs, 0) / 1000
        ),
        unit: 'second',
      },
      {
        metric: 'webhook_calls',
        quantity: relevant.reduce((s, r) => s + r.webhookCalls, 0),
        unit: 'call',
      },
      {
        metric: 'stages_executed',
        quantity: relevant.reduce((s, r) => s + r.stagesExecuted, 0),
        unit: 'stage',
      },
    ],
  };

  return aggregated;
}

// ── Validation Helpers ───────────────────────────────────────────────────────

function validateStageRegistration(body) {
  const errors = [];
  if (!body.stageId || typeof body.stageId !== 'string') {
    errors.push('stageId is required and must be a string');
  }
  if (!body.name || typeof body.name !== 'string') {
    errors.push('name is required and must be a string');
  }
  if (!body.webhookUrl || typeof body.webhookUrl !== 'string') {
    errors.push('webhookUrl is required and must be a string');
  } else {
    try {
      const parsed = new URL(body.webhookUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('webhookUrl must use http or https protocol');
      }
    } catch (_) {
      errors.push('webhookUrl must be a valid URL');
    }
  }
  if (body.order !== undefined && (typeof body.order !== 'number' || !Number.isFinite(body.order))) {
    errors.push('order must be a finite number');
  }
  if (body.timeout !== undefined) {
    if (typeof body.timeout !== 'number' || !Number.isFinite(body.timeout) || body.timeout <= 0) {
      errors.push('timeout must be a positive number (milliseconds)');
    }
  }
  if (body.authHeader !== undefined && typeof body.authHeader !== 'string') {
    errors.push('authHeader must be a string');
  }
  return errors;
}

// ── Router ───────────────────────────────────────────────────────────────────

const router = Router();

router.use(requireApiKey);

// ── POST /api/paas/register-stage ────────────────────────────────────────────

router.post('/register-stage', (req, res) => {
  const errors = validateStageRegistration(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const { stageId, name, webhookUrl, order, timeout, authHeader } = req.body;

  if (stages.has(stageId)) {
    return res.status(409).json({
      error: `Stage '${stageId}' already registered`,
      code: 'STAGE_EXISTS',
    });
  }

  const stage = {
    stageId,
    name,
    webhookUrl,
    order: typeof order === 'number' ? order : stages.size,
    timeout: timeout || PHI_TIMEOUT_DEFAULT,
    authHeader: authHeader || null,
    registeredAt: new Date().toISOString(),
  };

  stages.set(stageId, stage);

  res.status(201).json({
    message: 'Stage registered',
    stage: {
      stageId: stage.stageId,
      name: stage.name,
      order: stage.order,
      timeout: stage.timeout,
      registeredAt: stage.registeredAt,
    },
    phi: { defaultTimeout: PHI_TIMEOUT_DEFAULT, backoffSequence: PHI_BACKOFF_SEQUENCE },
  });
});

// ── POST /api/paas/trigger ───────────────────────────────────────────────────

router.post('/trigger', (req, res) => {
  const body = req.body || {};

  if (stages.size === 0) {
    return res.status(400).json({
      error: 'No custom stages registered. Register at least one stage first.',
      code: 'NO_STAGES',
    });
  }

  const runId = generateId('run');
  const run = {
    runId,
    status: 'queued',
    context: body.context || {},
    stageFilter: Array.isArray(body.stages) ? body.stages : [],
    stageResults: [],
    totalStages: 0,
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    failedStage: null,
    aborted: false,
    createdAt: new Date().toISOString(),
  };

  runs.set(runId, run);

  setImmediate(() => {
    executePipeline(run).catch((err) => {
      run.status = 'error';
      run.completedAt = new Date().toISOString();
      run.durationMs = run.startedAt
        ? Date.now() - new Date(run.startedAt).getTime()
        : 0;
      run.error = err.message;
    });
  });

  res.status(202).json({
    message: 'Pipeline run triggered',
    runId,
    status: 'queued',
    stagesQueued: run.stageFilter.length > 0
      ? run.stageFilter.length
      : stages.size,
    createdAt: run.createdAt,
  });
});

// ── GET /api/paas/stages ─────────────────────────────────────────────────────

router.get('/stages', (req, res) => {
  const allStages = Array.from(stages.values())
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      stageId: s.stageId,
      name: s.name,
      webhookUrl: s.webhookUrl,
      order: s.order,
      timeout: s.timeout,
      hasAuth: !!s.authHeader,
      registeredAt: s.registeredAt,
    }));

  res.json({
    stages: allStages,
    total: allStages.length,
    phi: { defaultTimeout: PHI_TIMEOUT_DEFAULT, backoffSequence: PHI_BACKOFF_SEQUENCE },
  });
});

// ── DELETE /api/paas/stages/:stageId ─────────────────────────────────────────

router.delete('/stages/:stageId', (req, res) => {
  const { stageId } = req.params;

  if (!stages.has(stageId)) {
    return res.status(404).json({
      error: `Stage '${stageId}' not found`,
      code: 'STAGE_NOT_FOUND',
    });
  }

  const activeRun = Array.from(runs.values()).find(
    (r) => r.status === 'running' && !r.aborted
  );
  if (activeRun) {
    return res.status(409).json({
      error: 'Cannot remove stage while a pipeline run is active',
      code: 'RUN_ACTIVE',
      activeRunId: activeRun.runId,
    });
  }

  stages.delete(stageId);

  res.json({ message: `Stage '${stageId}' removed`, stageId });
});

// ── GET /api/paas/runs ───────────────────────────────────────────────────────

router.get('/runs', (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const allRuns = Array.from(runs.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const page = allRuns.slice(offset, offset + limit).map((r) => ({
    runId: r.runId,
    status: r.status,
    totalStages: r.totalStages,
    stagesCompleted: r.stageResults.filter((s) => s.status === 'completed').length,
    stagesFailed: r.stageResults.filter((s) => s.status === 'failed').length,
    durationMs: r.durationMs,
    createdAt: r.createdAt,
    completedAt: r.completedAt,
  }));

  res.json({
    runs: page,
    total: allRuns.length,
    limit,
    offset,
  });
});

// ── GET /api/paas/runs/:runId ────────────────────────────────────────────────

router.get('/runs/:runId', (req, res) => {
  const { runId } = req.params;
  const run = runs.get(runId);

  if (!run) {
    return res.status(404).json({
      error: `Run '${runId}' not found`,
      code: 'RUN_NOT_FOUND',
    });
  }

  res.json({
    runId: run.runId,
    status: run.status,
    context: run.context,
    totalStages: run.totalStages,
    stageResults: run.stageResults,
    durationMs: run.durationMs,
    failedStage: run.failedStage,
    error: run.error || null,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
  });
});

// ── POST /api/paas/runs/:runId/abort ─────────────────────────────────────────

router.post('/runs/:runId/abort', (req, res) => {
  const { runId } = req.params;
  const run = runs.get(runId);

  if (!run) {
    return res.status(404).json({
      error: `Run '${runId}' not found`,
      code: 'RUN_NOT_FOUND',
    });
  }

  if (run.status !== 'running' && run.status !== 'queued') {
    return res.status(409).json({
      error: `Run is not active (status: ${run.status})`,
      code: 'RUN_NOT_ACTIVE',
    });
  }

  run.aborted = true;

  res.json({
    message: `Abort signal sent for run '${runId}'`,
    runId,
    previousStatus: run.status,
  });
});

// ── GET /api/paas/usage (bonus: Stripe export endpoint) ─────────────────────

router.get('/usage', (req, res) => {
  const since = req.query.since ? new Date(req.query.since).getTime() : 0;
  const usage = exportUsageForStripe(since);
  res.json(usage);
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = router;
module.exports.router = router;
module.exports.billingBus = billingBus;
module.exports.exportUsageForStripe = exportUsageForStripe;
module.exports.PHI = PHI;
module.exports.PHI_TIMEOUT_DEFAULT = PHI_TIMEOUT_DEFAULT;
module.exports.PHI_BACKOFF_SEQUENCE = PHI_BACKOFF_SEQUENCE;
module.exports._internals = {
  stages,
  runs,
  usageRecords,
  callWebhook,
  callWebhookWithRetry,
  executeStage,
  executePipeline,
  requireApiKey,
  validateStageRegistration,
};
