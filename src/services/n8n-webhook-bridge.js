/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * n8n ↔ Heady Webhook Bridge
 *
 * Bidirectional integration between n8n Pro and the Heady ecosystem:
 *  - Receives n8n webhook outputs → dispatches to Upstash Workflows
 *  - Exposes endpoints that n8n trigger nodes subscribe to
 *  - Provides n8n API client for triggering n8n workflows from Heady
 */

'use strict';

const { getLogger } = require('./structured-logger');
const logger = getLogger('n8n-webhook-bridge');

// ── Configuration ────────────────────────────────────────────
const N8N_API_URL = process.env.N8N_API_URL || '';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || '';
const isConfigured = !!(N8N_API_URL && N8N_API_KEY);

// ── n8n API Client ──────────────────────────────────────────

class N8nClient {
    constructor(apiUrl = N8N_API_URL, apiKey = N8N_API_KEY) {
        this.apiUrl = apiUrl.replace(/\/$/, '');
        this.apiKey = apiKey;
    }

    async _request(path, method = 'GET', body = null) {
        const res = await fetch(`${this.apiUrl}${path}`, {
            method,
            headers: {
                'X-N8N-API-KEY': this.apiKey,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`n8n API ${res.status}: ${text}`);
        }

        return res.json();
    }

    /** List all workflows */
    async listWorkflows() {
        return this._request('/workflows');
    }

    /** Get workflow by ID */
    async getWorkflow(id) {
        return this._request(`/workflows/${id}`);
    }

    /** Activate a workflow */
    async activateWorkflow(id) {
        return this._request(`/workflows/${id}/activate`, 'POST');
    }

    /** Execute a workflow via the API */
    async executeWorkflow(id, data = {}) {
        return this._request(`/workflows/${id}/run`, 'POST', { data });
    }

    /** Trigger a webhook-activated workflow */
    async triggerWebhook(webhookPath, data = {}) {
        const res = await fetch(`${this.apiUrl.replace('/api/v1', '')}/webhook/${webhookPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`n8n webhook ${res.status}: ${text}`);
        }

        return res.json();
    }

    /** List executions */
    async listExecutions(opts = {}) {
        const params = new URLSearchParams();
        if (opts.workflowId) params.set('workflowId', opts.workflowId);
        if (opts.status) params.set('status', opts.status);
        if (opts.limit) params.set('limit', String(opts.limit));
        const qs = params.toString();
        return this._request(`/executions${qs ? `?${qs}` : ''}`);
    }
}

// ── Singleton ───────────────────────────────────────────────
let _n8nClient = null;

function getN8nClient() {
    if (_n8nClient) return _n8nClient;
    if (!isConfigured) {
        logger.warn('n8n not configured (set N8N_API_URL + N8N_API_KEY)');
        return null;
    }
    _n8nClient = new N8nClient();
    logger.info('n8n API client initialized', { apiUrl: N8N_API_URL });
    return _n8nClient;
}

// ── Event Subscriber Registry ───────────────────────────────
// n8n trigger nodes register their webhook URLs here so Heady
// can push events to them in real-time.

const _eventSubscribers = new Map();

function subscribeToEvent(eventType, webhookUrl) {
    if (!_eventSubscribers.has(eventType)) {
        _eventSubscribers.set(eventType, new Set());
    }
    _eventSubscribers.get(eventType).add(webhookUrl);
    logger.info('n8n subscriber registered', { eventType, webhookUrl });
}

function unsubscribeFromEvent(eventType, webhookUrl) {
    const subs = _eventSubscribers.get(eventType);
    if (subs) {
        subs.delete(webhookUrl);
        if (subs.size === 0) _eventSubscribers.delete(eventType);
    }
}

/**
 * Emit an event to all subscribed n8n trigger nodes.
 * Non-blocking — failures are logged but don't propagate.
 */
async function emitEvent(eventType, data) {
    const subs = _eventSubscribers.get(eventType);
    if (!subs || subs.size === 0) return;

    const payload = {
        event: eventType,
        data,
        timestamp: new Date().toISOString(),
        source: 'heady-ecosystem',
    };

    const promises = [...subs].map(async (url) => {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                logger.warn('n8n webhook delivery failed', {
                    url, status: res.status, eventType,
                });
            }
        } catch (err) {
            logger.warn('n8n webhook delivery error', {
                url, error: err.message, eventType,
            });
        }
    });

    await Promise.allSettled(promises);
}

// ── Webhook Secret Verification ─────────────────────────────

function verifyWebhookSecret() {
    return (req, res, next) => {
        if (!N8N_WEBHOOK_SECRET) return next(); // Dev mode

        const provided = req.headers['x-n8n-webhook-secret'] || req.query.secret;
        if (provided !== N8N_WEBHOOK_SECRET) {
            return res.status(403).json({ error: 'Invalid webhook secret' });
        }
        next();
    };
}

// ── Express Routes ──────────────────────────────────────────

function n8nBridgeRoutes(app) {
    const prefix = '/api/n8n';

    // Health
    app.get(`${prefix}/health`, (_req, res) => {
        res.json({
            ok: isConfigured,
            service: 'n8n-webhook-bridge',
            configured: isConfigured,
            n8nApiUrl: N8N_API_URL || '(not set)',
            subscriberCount: _eventSubscribers.size,
            ts: new Date().toISOString(),
        });
    });

    // ── Inbound: n8n → Heady ─────────────────────────────────
    // Receives webhook outputs from n8n workflows and dispatches
    // them to Upstash Workflows or internal services.

    app.post(`${prefix}/webhook/:event`, verifyWebhookSecret(), async (req, res) => {
        try {
            const event = req.params.event;
            const payload = req.body || {};

            logger.info('n8n webhook received', { event, keys: Object.keys(payload) });

            // Try to dispatch to Upstash Workflow if applicable
            const { publish } = require('./upstash-qstash');
            const workflowUrl = process.env.UPSTASH_WORKFLOW_URL || process.env.CLOUD_RUN_URL;

            if (workflowUrl && publish) {
                try {
                    const result = await publish(`${workflowUrl}/api/workflow/pipeline`, {
                        source: 'n8n',
                        event,
                        payload,
                        triggeredAt: new Date().toISOString(),
                    });
                    return res.json({ ok: true, event, dispatched: true, messageId: result.messageId });
                } catch (dispatchErr) {
                    logger.warn('Workflow dispatch failed, processing locally', {
                        error: dispatchErr.message,
                    });
                }
            }

            // Fallback: process locally
            res.json({ ok: true, event, dispatched: false, processed: 'local' });
        } catch (err) {
            logger.error('n8n webhook processing failed', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    // ── Outbound: Heady → n8n ────────────────────────────────
    // Triggers n8n workflows from Heady services.

    app.post(`${prefix}/trigger`, async (req, res) => {
        try {
            const client = getN8nClient();
            if (!client) {
                return res.status(503).json({ error: 'n8n not configured' });
            }

            const { workflowId, webhookPath, data = {} } = req.body || {};

            if (webhookPath) {
                const result = await client.triggerWebhook(webhookPath, data);
                return res.json({ ok: true, method: 'webhook', result });
            }

            if (workflowId) {
                const result = await client.executeWorkflow(workflowId, data);
                return res.json({ ok: true, method: 'api', result });
            }

            res.status(400).json({ error: 'workflowId or webhookPath required' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Event Subscription (for n8n Trigger nodes) ───────────
    app.post(`${prefix}/subscribe`, verifyWebhookSecret(), (req, res) => {
        const { eventType, webhookUrl } = req.body || {};
        if (!eventType || !webhookUrl) {
            return res.status(400).json({ error: 'eventType and webhookUrl required' });
        }
        subscribeToEvent(eventType, webhookUrl);
        res.json({ ok: true, eventType, webhookUrl });
    });

    app.post(`${prefix}/unsubscribe`, verifyWebhookSecret(), (req, res) => {
        const { eventType, webhookUrl } = req.body || {};
        if (!eventType || !webhookUrl) {
            return res.status(400).json({ error: 'eventType and webhookUrl required' });
        }
        unsubscribeFromEvent(eventType, webhookUrl);
        res.json({ ok: true, removed: true });
    });

    // ── n8n Workflows List (proxy) ───────────────────────────
    app.get(`${prefix}/workflows`, async (_req, res) => {
        try {
            const client = getN8nClient();
            if (!client) return res.status(503).json({ error: 'n8n not configured' });
            const workflows = await client.listWorkflows();
            res.json({ ok: true, ...workflows });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    logger.info('n8n bridge routes registered', { prefix });
}

module.exports = {
    N8nClient,
    getN8nClient,
    subscribeToEvent,
    unsubscribeFromEvent,
    emitEvent,
    verifyWebhookSecret,
    n8nBridgeRoutes,
    isConfigured,
};
