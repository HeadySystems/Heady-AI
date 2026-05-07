/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Upstash Workflow Express Routes
 *
 * Mounts all registered durable workflows at /api/workflow/*
 * with QStash signature verification and health endpoints.
 */

'use strict';

const { getLogger } = require('./structured-logger');
const logger = getLogger('upstash-workflow-routes');

const {
    createWorkflowHandler,
    verifyQStashSignature,
    WORKFLOW_REGISTRY,
    getWorkflowStatus,
    isConfigured,
} = require('./upstash-workflow');

/**
 * Register all workflow routes on an Express app.
 *
 * @param {import('express').Application} app - Express app instance
 */
function workflowRoutes(app) {
    const prefix = '/api/workflow';

    // ── Health & Status ──────────────────────────────────────
    app.get(`${prefix}/health`, (_req, res) => {
        const status = getWorkflowStatus();
        res.status(status.configured ? 200 : 503).json({
            ok: status.configured,
            service: 'upstash-workflow',
            ...status,
            ts: new Date().toISOString(),
        });
    });

    app.get(`${prefix}/status`, (_req, res) => {
        res.json({
            ok: true,
            ...getWorkflowStatus(),
            ts: new Date().toISOString(),
        });
    });

    // ── DLQ Handler ──────────────────────────────────────────
    app.post(`${prefix}/dlq`, verifyQStashSignature(), (req, res) => {
        logger.error('Workflow step failed (DLQ)', {
            body: req.body,
            headers: {
                'upstash-message-id': req.headers['upstash-message-id'],
                'upstash-retried': req.headers['upstash-retried'],
            },
        });
        res.json({ received: true, handler: 'dlq' });
    });

    // ── Register All Workflows ───────────────────────────────
    for (const [key, wf] of Object.entries(WORKFLOW_REGISTRY)) {
        const handler = createWorkflowHandler(key, wf.handler, {
            retries: 3,
            failureUrl: `${process.env.UPSTASH_WORKFLOW_URL || process.env.CLOUD_RUN_URL || ''}/api/workflow/dlq`,
        });

        // Upstash Workflow expects to handle both GET and POST
        app.all(`${prefix}/${key}`, handler);

        logger.info(`Workflow route mounted: ${prefix}/${key}`, { name: wf.name });
    }

    // ── Manual Trigger Endpoint ──────────────────────────────
    app.post(`${prefix}/trigger`, async (req, res) => {
        try {
            const { workflow, payload = {} } = req.body || {};

            if (!workflow || !WORKFLOW_REGISTRY[workflow]) {
                return res.status(400).json({
                    error: 'Invalid workflow',
                    available: Object.keys(WORKFLOW_REGISTRY),
                });
            }

            if (!isConfigured) {
                return res.status(503).json({
                    error: 'Upstash Workflows not configured',
                    required: ['QSTASH_TOKEN', 'UPSTASH_WORKFLOW_URL'],
                });
            }

            // Dispatch via QStash to trigger the workflow durably
            const { Client } = require('@upstash/qstash');
            const client = new Client({ token: process.env.QSTASH_TOKEN });

            const baseUrl = process.env.UPSTASH_WORKFLOW_URL || process.env.CLOUD_RUN_URL;
            const result = await client.publishJSON({
                url: `${baseUrl}/api/workflow/${workflow}`,
                body: payload,
            });

            res.json({
                ok: true,
                workflow,
                messageId: result.messageId,
                triggeredAt: new Date().toISOString(),
            });
        } catch (err) {
            logger.error('Workflow trigger failed', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    // ── CRON Schedule Management ─────────────────────────────
    app.get(`${prefix}/schedules`, async (_req, res) => {
        try {
            if (!isConfigured) {
                return res.status(503).json({ error: 'Not configured' });
            }

            const { Client } = require('@upstash/qstash');
            const client = new Client({ token: process.env.QSTASH_TOKEN });
            const schedules = await client.schedules.list();

            res.json({ ok: true, count: schedules.length, schedules });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post(`${prefix}/schedules`, async (req, res) => {
        try {
            const { workflow, cron, payload = {} } = req.body || {};

            if (!workflow || !cron) {
                return res.status(400).json({ error: 'workflow and cron are required' });
            }

            if (!isConfigured) {
                return res.status(503).json({ error: 'Not configured' });
            }

            const { Client } = require('@upstash/qstash');
            const client = new Client({ token: process.env.QSTASH_TOKEN });
            const baseUrl = process.env.UPSTASH_WORKFLOW_URL || process.env.CLOUD_RUN_URL;

            const schedule = await client.schedules.create({
                destination: `${baseUrl}/api/workflow/${workflow}`,
                cron,
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
            });

            res.json({ ok: true, scheduleId: schedule.scheduleId, cron, workflow });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete(`${prefix}/schedules/:id`, async (req, res) => {
        try {
            if (!isConfigured) return res.status(503).json({ error: 'Not configured' });

            const { Client } = require('@upstash/qstash');
            const client = new Client({ token: process.env.QSTASH_TOKEN });
            await client.schedules.delete(req.params.id);

            res.json({ ok: true, deleted: req.params.id });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    logger.info(`Workflow routes registered: ${Object.keys(WORKFLOW_REGISTRY).length} workflows`, {
        prefix,
    });
}

module.exports = { workflowRoutes };
