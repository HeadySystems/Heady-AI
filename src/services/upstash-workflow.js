/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Upstash Workflow — Durable Execution Engine
 *
 * Wraps @upstash/workflow's serve() for Express-compatible durable
 * workflows with automatic retries, sleep, and state persistence.
 * Uses QStash as the message delivery backbone.
 *
 * Set QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, and
 * QSTASH_NEXT_SIGNING_KEY in env.
 */

'use strict';

const { getLogger } = require('./structured-logger');
const logger = getLogger('upstash-workflow');

// ── Configuration ────────────────────────────────────────────
const QSTASH_TOKEN = process.env.QSTASH_TOKEN || '';
const QSTASH_CURRENT_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY || '';
const QSTASH_NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY || '';
const WORKFLOW_BASE_URL = process.env.UPSTASH_WORKFLOW_URL || process.env.CLOUD_RUN_URL || '';

const isConfigured = !!(QSTASH_TOKEN && WORKFLOW_BASE_URL);

// φ-scaled constants for timing invariants
const PHI = 1.618033988749895;
const PHI_7_S = 29; // φ⁷ seconds, used for heartbeat TTLs

// ── QStash Signature Verification Middleware ─────────────────
let _receiver = null;

/**
 * Get or create the QStash Receiver for signature verification.
 * @returns {import('@upstash/qstash').Receiver|null}
 */
function getReceiver() {
    if (_receiver) return _receiver;
    if (!QSTASH_CURRENT_SIGNING_KEY || !QSTASH_NEXT_SIGNING_KEY) {
        logger.warn('QStash signing keys not configured — signature verification disabled');
        return null;
    }

    try {
        const { Receiver } = require('@upstash/qstash');
        _receiver = new Receiver({
            currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
            nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
        });
        logger.info('QStash Receiver initialized for signature verification');
        return _receiver;
    } catch (err) {
        logger.error('Failed to initialize QStash Receiver', { error: err.message });
        return null;
    }
}

/**
 * Express middleware that verifies QStash webhook signatures.
 * Rejects requests with invalid or missing signatures (403).
 * Passes through if signing keys are not configured (dev mode).
 */
function verifyQStashSignature() {
    return async (req, res, next) => {
        const receiver = getReceiver();
        if (!receiver) {
            // Dev mode — no signing keys configured, pass through
            return next();
        }

        const signature = req.headers['upstash-signature'];
        if (!signature) {
            return res.status(403).json({ error: 'Missing Upstash-Signature header' });
        }

        try {
            // Body must be the raw string for verification
            const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            await receiver.verify({ signature, body });
            next();
        } catch (err) {
            logger.warn('QStash signature verification failed', {
                error: err.message,
                ip: req.ip,
            });
            return res.status(403).json({ error: 'Invalid signature' });
        }
    };
}

// ── Workflow Definition Helpers ──────────────────────────────

/**
 * Create a durable workflow handler compatible with Express.
 *
 * Upstash Workflow's serve() is designed for serverless frameworks;
 * this adapter bridges it to Express by handling the HTTP request/response
 * lifecycle and routing QStash callbacks.
 *
 * @param {string} workflowName - Unique workflow identifier
 * @param {Function} handler - async (context) => void workflow definition
 * @param {object} [opts] - Options
 * @param {number} [opts.retries=3] - Max retries per step
 * @param {string} [opts.failureUrl] - URL to call on final failure
 * @returns {Function} Express route handler
 */
function createWorkflowHandler(workflowName, handler, opts = {}) {
    if (!isConfigured) {
        return (_req, res) => {
            res.status(503).json({
                error: 'Upstash Workflows not configured',
                required: ['QSTASH_TOKEN', 'UPSTASH_WORKFLOW_URL'],
            });
        };
    }

    // Lazy-load to avoid breaking when SDK isn't installed
    let serveAdapter;
    try {
        const { serve } = require('@upstash/workflow/express');
        serveAdapter = serve;
    } catch {
        try {
            // Fallback: try the generic serve
            const { serve } = require('@upstash/workflow');
            serveAdapter = serve;
        } catch (err) {
            logger.error('Failed to load @upstash/workflow', { error: err.message });
            return (_req, res) => {
                res.status(500).json({ error: 'Workflow SDK not available' });
            };
        }
    }

    const workflowHandler = serveAdapter(handler, {
        qstashClient: _getQStashClient(),
        url: `${WORKFLOW_BASE_URL}/api/workflow/${workflowName}`,
        retries: opts.retries || 3,
        failureUrl: opts.failureUrl || `${WORKFLOW_BASE_URL}/api/workflow/dlq`,
        verbose: process.env.NODE_ENV !== 'production',
    });

    logger.info(`Workflow registered: ${workflowName}`, {
        url: `${WORKFLOW_BASE_URL}/api/workflow/${workflowName}`,
    });

    return workflowHandler;
}

// ── QStash Client (shared singleton) ─────────────────────────
let _qstashClient = null;

function _getQStashClient() {
    if (_qstashClient) return _qstashClient;
    if (!QSTASH_TOKEN) return undefined;

    try {
        const { Client } = require('@upstash/qstash');
        _qstashClient = new Client({ token: QSTASH_TOKEN });
        return _qstashClient;
    } catch {
        return undefined;
    }
}

// ══════════════════════════════════════════════════════════════
// WORKFLOW DEFINITIONS — Heady Ecosystem Durable Workflows
// ══════════════════════════════════════════════════════════════

/**
 * 22-Stage HCFP Pipeline Workflow
 *
 * Replaces the raw QStash dispatch in upstash-qstash.js with
 * durable, retriable step execution. Each stage runs as a
 * separate context.run() step with automatic retry on failure.
 */
async function pipelineWorkflowHandler(context) {
    const input = context.requestPayload;
    const { stages = [], payload = {} } = input;

    // Default: run all 22 stages sequentially
    const stageList = stages.length > 0
        ? stages
        : Array.from({ length: 22 }, (_, i) => i + 1);

    let lastResult = payload;

    for (const stageNum of stageList) {
        lastResult = await context.run(`pipeline-stage-${stageNum}`, async () => {
            logger.info(`Pipeline stage ${stageNum} executing`, {
                workflow: 'hcfp-pipeline',
                stage: stageNum,
            });

            // Call the pipeline stage endpoint on Cloud Run
            const baseUrl = process.env.CLOUD_RUN_URL;
            if (!baseUrl) {
                return { stage: stageNum, status: 'skipped', reason: 'CLOUD_RUN_URL not set' };
            }

            const res = await fetch(`${baseUrl}/api/pipeline/stage/${stageNum}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stage: stageNum,
                    payload: lastResult,
                    dispatchedAt: new Date().toISOString(),
                    source: 'upstash-workflow',
                }),
            });

            if (!res.ok) {
                throw new Error(`Stage ${stageNum} failed: ${res.status} ${await res.text()}`);
            }

            return res.json();
        });
    }

    // Final step: record completion
    await context.run('pipeline-complete', async () => {
        logger.info('Pipeline workflow completed', {
            stageCount: stageList.length,
            completedAt: new Date().toISOString(),
        });
        return { status: 'completed', stages: stageList.length, result: lastResult };
    });
}

/**
 * Agent Orchestration Workflow
 *
 * Dispatches a task to a Heady agent and waits for completion
 * with configurable polling intervals and timeout.
 */
async function agentWorkflowHandler(context) {
    const input = context.requestPayload;
    const {
        agentId,
        task,
        persona = 'default',
        maxWaitMinutes = 30,
        pollIntervalSeconds = 15,
    } = input;

    // Step 1: Dispatch task to agent
    const dispatch = await context.run('dispatch-agent-task', async () => {
        const baseUrl = process.env.CLOUD_RUN_URL;
        if (!baseUrl) {
            return { jobId: `local-${Date.now()}`, status: 'mock' };
        }

        const res = await fetch(`${baseUrl}/api/agents/${agentId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, persona, source: 'upstash-workflow' }),
        });

        if (!res.ok) throw new Error(`Agent dispatch failed: ${res.status}`);
        return res.json();
    });

    // Step 2: Poll for completion with sleep intervals
    const maxPolls = Math.ceil((maxWaitMinutes * 60) / pollIntervalSeconds);
    let result = null;

    for (let i = 0; i < maxPolls; i++) {
        await context.sleep(`wait-poll-${i}`, `${pollIntervalSeconds}s`);

        result = await context.run(`check-agent-${i}`, async () => {
            const baseUrl = process.env.CLOUD_RUN_URL;
            if (!baseUrl) return { status: 'completed', result: 'mock-result' };

            const res = await fetch(`${baseUrl}/api/agents/${agentId}/tasks/${dispatch.jobId}`);
            if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
            return res.json();
        });

        if (result.status === 'completed' || result.status === 'failed') {
            break;
        }
    }

    // Step 3: Handle completion
    await context.run('agent-finalize', async () => {
        logger.info('Agent workflow completed', {
            agentId,
            jobId: dispatch.jobId,
            status: result?.status || 'timeout',
        });
        return { agentId, jobId: dispatch.jobId, result };
    });
}

/**
 * Scheduled Health Check Workflow
 *
 * Runs a health sweep across all services, reports status,
 * and sleeps for the configured interval before repeating.
 */
async function healthWorkflowHandler(context) {
    const input = context.requestPayload;
    const { services = [], intervalMinutes = 60 } = input;

    // Step 1: Check all services
    const healthResults = await context.run('health-sweep', async () => {
        const baseUrl = process.env.CLOUD_RUN_URL;
        if (!baseUrl) {
            return { status: 'mock', services: [] };
        }

        const res = await fetch(`${baseUrl}/api/health/all`);
        if (!res.ok) {
            return { status: 'error', error: `Health endpoint returned ${res.status}` };
        }
        return res.json();
    });

    // Step 2: Report any failures
    const failures = (healthResults.services || []).filter(s => !s.healthy);
    if (failures.length > 0) {
        await context.run('report-failures', async () => {
            logger.warn('Health check found failures', {
                failureCount: failures.length,
                services: failures.map(f => f.name),
            });

            // Optionally trigger alerts via n8n webhook or Slack
            const webhookUrl = process.env.N8N_HEALTH_WEBHOOK_URL;
            if (webhookUrl) {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'health_check_failure',
                        failures,
                        timestamp: new Date().toISOString(),
                    }),
                });
            }
            return { reported: failures.length };
        });
    }

    // Step 3: Sleep and schedule next check
    await context.sleep('health-interval', `${intervalMinutes}m`);

    // Step 4: Trigger next iteration
    await context.run('schedule-next', async () => {
        const client = _getQStashClient();
        if (client) {
            await client.publishJSON({
                url: `${WORKFLOW_BASE_URL}/api/workflow/health`,
                body: { services, intervalMinutes },
            });
        }
        return { scheduledNext: true };
    });
}

/**
 * Linear Sync Workflow
 *
 * Synchronizes Linear issues to the Heady Neon cache with
 * durable retries and configurable intervals.
 */
async function linearSyncWorkflowHandler(context) {
    const input = context.requestPayload;
    const { teamId, syncIntervalMinutes = 30 } = input;

    // Step 1: Fetch issues from Linear
    const issues = await context.run('fetch-linear-issues', async () => {
        const linearKey = process.env.LINEAR_API_KEY;
        if (!linearKey) return { issues: [], error: 'LINEAR_API_KEY not set' };

        const res = await fetch('https://api.linear.app/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': linearKey,
            },
            body: JSON.stringify({
                query: `query { issues(filter: { team: { id: { eq: "${teamId}" } } }, first: 50) { nodes { id title state { name } priority assignee { name } updatedAt } } }`,
            }),
        });

        if (!res.ok) throw new Error(`Linear API failed: ${res.status}`);
        const data = await res.json();
        return data.data?.issues?.nodes || [];
    });

    // Step 2: Upsert to Neon cache
    await context.run('upsert-neon-cache', async () => {
        const baseUrl = process.env.CLOUD_RUN_URL;
        if (!baseUrl || !issues.length) return { synced: 0 };

        const res = await fetch(`${baseUrl}/api/sync/linear/upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issues, teamId }),
        });

        if (!res.ok) throw new Error(`Neon upsert failed: ${res.status}`);
        return res.json();
    });

    // Step 3: Sleep and re-trigger
    await context.sleep('sync-interval', `${syncIntervalMinutes}m`);

    await context.run('schedule-next-sync', async () => {
        const client = _getQStashClient();
        if (client) {
            await client.publishJSON({
                url: `${WORKFLOW_BASE_URL}/api/workflow/linear-sync`,
                body: { teamId, syncIntervalMinutes },
            });
        }
        return { scheduledNext: true };
    });
}

// ── Workflow Registry ────────────────────────────────────────

const WORKFLOW_REGISTRY = {
    pipeline: {
        name: 'hcfp-pipeline',
        description: '22-stage HCFP pipeline with durable execution',
        handler: pipelineWorkflowHandler,
    },
    agent: {
        name: 'agent-orchestration',
        description: 'Multi-agent task dispatch with polling',
        handler: agentWorkflowHandler,
    },
    health: {
        name: 'health-sweep',
        description: 'Periodic health check across all services',
        handler: healthWorkflowHandler,
    },
    'linear-sync': {
        name: 'linear-sync',
        description: 'Sync Linear issues to Neon cache',
        handler: linearSyncWorkflowHandler,
    },
};

// ── Health & Status ──────────────────────────────────────────

function getWorkflowStatus() {
    return {
        configured: isConfigured,
        baseUrl: WORKFLOW_BASE_URL || '(not set)',
        qstashConfigured: !!QSTASH_TOKEN,
        signingKeysConfigured: !!(QSTASH_CURRENT_SIGNING_KEY && QSTASH_NEXT_SIGNING_KEY),
        registeredWorkflows: Object.entries(WORKFLOW_REGISTRY).map(([key, wf]) => ({
            key,
            name: wf.name,
            description: wf.description,
            url: `${WORKFLOW_BASE_URL}/api/workflow/${key}`,
        })),
    };
}

module.exports = {
    createWorkflowHandler,
    verifyQStashSignature,
    getReceiver,
    pipelineWorkflowHandler,
    agentWorkflowHandler,
    healthWorkflowHandler,
    linearSyncWorkflowHandler,
    WORKFLOW_REGISTRY,
    getWorkflowStatus,
    isConfigured,
    PHI,
    PHI_7_S,
};
