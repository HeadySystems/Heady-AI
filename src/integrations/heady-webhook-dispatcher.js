'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

// ─── φ-Math ───────────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584];

// Retry / queue configuration
const MAX_RETRIES = FIB[4];
const RETRY_BASE_MS = FIB[11]; // 144ms base backoff
const MAX_QUEUE = FIB[14]; // 610 — pending delivery queue cap
const MAX_DEAD_LETTER = FIB[12]; // 233 — dead-letter cap
const MAX_HISTORY = FIB[13]; // 377 — delivery history ring buffer
const MAX_ENDPOINTS = FIB[9]; // 55  — registered endpoint cap
const TIMEOUT_MS = FIB[8] * 1000; // 21s — per-request delivery timeout
const DRAIN_INTERVAL_MS = Math.round(PHI * 1000); // ~1.618s — queue drain tick

// ─── Logger ───────────────────────────────────────────────────────────────────
let _logger = null;
try {
  _logger = require('../utils/logger');
} catch {/* optional */}
function log(level, msg, data = {}) {
  const entry = {
    level,
    component: 'WebhookDispatcher',
    msg,
    ts: new Date().toISOString(),
    ...data
  };
  if (_logger?.logNodeActivity) _logger.logNodeActivity('WEBHOOK', JSON.stringify(entry));
}

// ─── HeadyWebhookDispatcher ───────────────────────────────────────────────────

class HeadyWebhookDispatcher extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);

    // Registered endpoints: name → { url, secret, enabled, filters, headers }
    this._endpoints = new Map();

    // Pending delivery queue: Array<DeliveryJob>
    this._queue = [];

    // Dead-letter queue
    this._deadLetter = [];

    // Delivery history ring buffer
    this._history = [];

    // Metrics
    this._metrics = {
      totalDispatched: 0,
      totalDelivered: 0,
      totalFailed: 0,
      totalDeadLettered: 0,
      byEndpoint: new Map()
    };

    // Drain loop
    this._drainTimer = null;
    this._draining = false;
    log('info', 'HeadyWebhookDispatcher initialized');
  }

  // ─── Endpoint Management ──────────────────────────────────────────────────

  /**
   * Register a webhook endpoint.
   * @param {string} name     - Unique identifier for this endpoint
   * @param {string} url      - Delivery URL (must be https in production)
   * @param {object} [opts]
   * @param {string} [opts.secret]          - HMAC signing secret
   * @param {string[]} [opts.filters]       - Event name patterns to include (default: all)
   * @param {object} [opts.headers]         - Extra headers to include
   * @param {boolean} [opts.enabled=true]   - Enable/disable without removing
   */
  register(name, url, opts = {}) {
    if (!name || typeof name !== 'string' || !/^[a-zA-Z0-9_\-\.]+$/.test(name)) {
      throw new Error('Endpoint name must be alphanumeric with _-. only');
    }
    if (!url || typeof url !== 'string') {
      throw new Error('Endpoint URL required');
    }
    if (this._endpoints.size >= MAX_ENDPOINTS) {
      throw new Error(`Max endpoints reached (${MAX_ENDPOINTS})`);
    }
    this._endpoints.set(name, {
      name,
      url,
      secret: opts.secret || null,
      filters: opts.filters || null,
      // null = receive all events
      headers: opts.headers || {},
      enabled: opts.enabled !== false,
      registeredAt: Date.now(),
      consecutiveFailures: 0,
      lastDeliveryAt: null,
      lastFailureAt: null
    });
    log('info', `Endpoint registered: ${name}`, {
      url
    });
    this.emit('endpoint:registered', {
      name,
      url
    });
    return this;
  }
  unregister(name) {
    this._endpoints.delete(name);
    this.emit('endpoint:unregistered', {
      name
    });
    return this;
  }
  setEndpointEnabled(name, enabled) {
    const ep = this._endpoints.get(name);
    if (ep) ep.enabled = enabled;
    return this;
  }

  // ─── Dispatch ─────────────────────────────────────────────────────────────

  /**
   * Dispatch an event to all matching endpoints (or a specific one).
   * Fire-and-forget — jobs are queued, not awaited by default.
   *
   * @param {string} eventName   - Event name (e.g., 'pipeline:completed')
   * @param {object} payload     - Event payload
   * @param {object} [opts]
   * @param {string} [opts.endpointName] - Target specific endpoint only
   * @param {string} [opts.traceId]      - Correlation trace ID
   * @param {boolean} [opts.await]       - true = await all deliveries
   * @returns {Promise<object[]>|string[]} jobIds
   */
  async dispatch(eventName, payload = {}, opts = {}) {
    if (!eventName || typeof eventName !== 'string') {
      return [];
    }
    this._metrics.totalDispatched++;
    const targets = opts.endpointName ? this._endpoints.has(opts.endpointName) ? [this._endpoints.get(opts.endpointName)] : [] : Array.from(this._endpoints.values()).filter(ep => ep.enabled && this._matchesFilter(ep, eventName));
    if (targets.length === 0) {
      log('debug', `No endpoints for event: ${eventName}`);
      return [];
    }
    const traceId = opts.traceId || this._generateTraceId();
    const jobs = targets.map(ep => this._createJob(ep, eventName, payload, traceId));
    if (opts.await) {
      return Promise.all(jobs.map(job => this._deliverJob(job)));
    }

    // Queue for async drain
    for (const job of jobs) {
      if (this._queue.length >= MAX_QUEUE) {
        this._queue.shift(); // drop oldest when full
        log('warn', 'Queue full — dropped oldest pending job');
      }
      this._queue.push(job);
    }
    this._ensureDrainLoop();
    return jobs.map(j => j.jobId);
  }

  /**
   * Dispatch and await all deliveries (sync variant).
   */
  async dispatchAwait(eventName, payload = {}, opts = {}) {
    return this.dispatch(eventName, payload, {
      ...opts,
      await: true
    });
  }

  // ─── Delivery ─────────────────────────────────────────────────────────────

  _createJob(endpoint, eventName, payload, traceId) {
    return {
      jobId: `wh-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      endpoint: endpoint.name,
      url: endpoint.url,
      secret: endpoint.secret,
      headers: endpoint.headers,
      eventName,
      payload,
      traceId,
      attempts: 0,
      createdAt: Date.now(),
      nextRetryAt: Date.now()
    };
  }
  async _deliverJob(job) {
    job.attempts++;
    const ts = Date.now();
    const body = JSON.stringify({
      event: job.eventName,
      payload: job.payload,
      traceId: job.traceId,
      ts
    });
    const headers = {
      'Content-Type': 'application/json',
      'X-Heady-Timestamp': String(ts),
      'X-Heady-TraceId': job.traceId,
      'X-Heady-Event': job.eventName,
      'User-Agent': 'HeadyWebhookDispatcher/2026',
      ...job.headers
    };
    if (job.secret) {
      const sig = this._sign(body, job.secret);
      headers['X-Heady-Signature'] = `sha256=${sig}`;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const response = await fetch(job.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      }).finally(() => clearTimeout(timer));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      // Success
      this._metrics.totalDelivered++;
      this._updateEndpointMetrics(job.endpoint, true);
      this._recordHistory(job, 'delivered', response.status);
      this.emit('webhook:delivered', {
        jobId: job.jobId,
        endpoint: job.endpoint,
        event: job.eventName,
        traceId: job.traceId
      });
      log('debug', `Delivered ${job.eventName} → ${job.endpoint}`, {
        jobId: job.jobId,
        attempts: job.attempts,
        statusCode: response.status
      });
      return {
        ok: true,
        jobId: job.jobId,
        endpoint: job.endpoint,
        statusCode: response.status
      };
    } catch (err) {
      const errMsg = err.name === 'AbortError' ? 'timeout' : err.message;
      this._updateEndpointMetrics(job.endpoint, false);
      if (job.attempts >= MAX_RETRIES) {
        // Dead-letter
        this._metrics.totalFailed++;
        this._metrics.totalDeadLettered++;
        this._deadLetter.push({
          ...job,
          failedAt: Date.now(),
          lastError: errMsg
        });
        if (this._deadLetter.length > MAX_DEAD_LETTER) this._deadLetter.shift();
        this._recordHistory(job, 'dead-lettered', 0, errMsg);
        this.emit('webhook:failed', {
          jobId: job.jobId,
          endpoint: job.endpoint,
          event: job.eventName,
          error: errMsg,
          finalFailure: true
        });
        log('warn', `Dead-lettered ${job.eventName} → ${job.endpoint}`, {
          jobId: job.jobId,
          attempts: job.attempts,
          error: errMsg
        });
        return {
          ok: false,
          jobId: job.jobId,
          endpoint: job.endpoint,
          error: errMsg,
          deadLettered: true
        };
      }

      // Schedule retry with φ-exponential backoff ± 38.2% jitter
      const baseDelay = Math.round(RETRY_BASE_MS * Math.pow(PHI, job.attempts - 1));
      const jitter = Math.round(baseDelay * 0.382 * (Math.random() - 0.5));
      job.nextRetryAt = Date.now() + baseDelay + jitter;
      this.emit('webhook:retry', {
        jobId: job.jobId,
        endpoint: job.endpoint,
        attempt: job.attempts,
        nextRetryAt: job.nextRetryAt
      });
      log('debug', `Retry scheduled ${job.eventName} → ${job.endpoint}`, {
        jobId: job.jobId,
        attempt: job.attempts,
        nextRetryAt: new Date(job.nextRetryAt).toISOString(),
        error: errMsg
      });

      // Re-queue
      this._queue.push(job);
      return {
        ok: false,
        jobId: job.jobId,
        endpoint: job.endpoint,
        error: errMsg,
        retrying: true
      };
    }
  }

  // ─── Drain Loop ───────────────────────────────────────────────────────────

  _ensureDrainLoop() {
    if (this._drainTimer) return;
    this._drainTimer = setInterval(() => this._drain(), DRAIN_INTERVAL_MS);
  }
  _stopDrainLoop() {
    if (this._drainTimer) {
      clearInterval(this._drainTimer);
      this._drainTimer = null;
    }
  }
  async _drain() {
    if (this._draining || this._queue.length === 0) return;
    this._draining = true;
    const now = Date.now();
    const ready = [];
    const deferred = [];
    for (const job of this._queue) {
      if (job.nextRetryAt <= now) {
        ready.push(job);
      } else {
        deferred.push(job);
      }
    }
    this._queue = deferred;

    // Deliver ready jobs in parallel (up to fib(7)=21 concurrent)
    const batches = [];
    for (let i = 0; i < ready.length; i += FIB[7]) {
      batches.push(ready.slice(i, i + FIB[7]));
    }
    for (const batch of batches) {
      await Promise.allSettled(batch.map(job => this._deliverJob(job)));
    }
    if (this._queue.length === 0) {
      this._stopDrainLoop();
    }
    this._draining = false;
  }

  // ─── Signature ────────────────────────────────────────────────────────────

  _sign(body, secret) {
    return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  }

  /**
   * Verify an incoming webhook signature (for consumers).
   * @param {string} body - Raw request body string
   * @param {string} signature - X-Heady-Signature header value
   * @param {string} secret - Shared secret
   * @returns {boolean}
   */
  verify(body, signature, secret) {
    if (!signature || !secret) return false;
    const raw = signature.replace(/^sha256=/, '');
    const expected = this._sign(body, secret);
    // Constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(Buffer.from(raw, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _matchesFilter(endpoint, eventName) {
    if (!endpoint.filters || endpoint.filters.length === 0) return true;
    return endpoint.filters.some(pattern => {
      if (pattern.endsWith('*')) return eventName.startsWith(pattern.slice(0, -1));
      if (pattern.startsWith('*')) return eventName.endsWith(pattern.slice(1));
      return pattern === eventName;
    });
  }
  _generateTraceId() {
    return `wh-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  }
  _updateEndpointMetrics(name, success) {
    const ep = this._endpoints.get(name);
    if (!ep) return;
    if (!this._metrics.byEndpoint.has(name)) {
      this._metrics.byEndpoint.set(name, {
        delivered: 0,
        failed: 0
      });
    }
    const m = this._metrics.byEndpoint.get(name);
    if (success) {
      m.delivered++;
      ep.consecutiveFailures = 0;
      ep.lastDeliveryAt = Date.now();
    } else {
      m.failed++;
      ep.consecutiveFailures++;
      ep.lastFailureAt = Date.now();
      // Auto-disable endpoint after fib(4)=3 consecutive failures
      if (ep.consecutiveFailures >= FIB[4]) {
        ep.enabled = false;
        log('warn', `Auto-disabled endpoint after ${ep.consecutiveFailures} failures: ${name}`);
        this.emit('endpoint:disabled', {
          name,
          consecutiveFailures: ep.consecutiveFailures
        });
      }
    }
  }
  _recordHistory(job, outcome, statusCode, error = null) {
    this._history.push({
      jobId: job.jobId,
      endpoint: job.endpoint,
      event: job.eventName,
      outcome,
      statusCode,
      error,
      attempts: job.attempts,
      ts: Date.now()
    });
    if (this._history.length > MAX_HISTORY) this._history.shift();
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  getStatus() {
    const epStatus = {};
    for (const [name, ep] of this._endpoints) {
      const m = this._metrics.byEndpoint.get(name) || {
        delivered: 0,
        failed: 0
      };
      epStatus[name] = {
        url: ep.url,
        enabled: ep.enabled,
        consecutiveFailures: ep.consecutiveFailures,
        lastDeliveryAt: ep.lastDeliveryAt,
        delivered: m.delivered,
        failed: m.failed
      };
    }
    return {
      totalDispatched: this._metrics.totalDispatched,
      totalDelivered: this._metrics.totalDelivered,
      totalFailed: this._metrics.totalFailed,
      totalDeadLettered: this._metrics.totalDeadLettered,
      queueDepth: this._queue.length,
      deadLetterQueueDepth: this._deadLetter.length,
      historySize: this._history.length,
      endpointCount: this._endpoints.size,
      drainActive: !!this._drainTimer,
      endpoints: epStatus,
      phi: PHI
    };
  }
  getHistory(limit = FIB[6]) {
    return this._history.slice(-Math.min(limit, MAX_HISTORY)).reverse();
  }
  getDeadLetters(limit = FIB[5]) {
    return this._deadLetter.slice(-Math.min(limit, MAX_DEAD_LETTER)).reverse();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance = null;
function getDispatcher() {
  if (!_instance) {
    _instance = new HeadyWebhookDispatcher();
    global.__webhookDispatcher = _instance;
    log('info', 'HeadyWebhookDispatcher singleton created');
  }
  return _instance;
}

// ─── Express Routes ───────────────────────────────────────────────────────────

function registerWebhookRoutes(app, dispatcher) {
  const d = dispatcher || getDispatcher();
  app.get('/api/webhooks/status', (_req, res) => res.json({
    ok: true,
    ...d.getStatus()
  }));
  app.get('/api/webhooks/history', (req, res) => {
    const limit = parseInt(req.query.limit) || FIB[6];
    res.json({
      ok: true,
      history: d.getHistory(limit)
    });
  });
  app.get('/api/webhooks/dead-letters', (req, res) => {
    const limit = parseInt(req.query.limit) || FIB[5];
    res.json({
      ok: true,
      deadLetters: d.getDeadLetters(limit)
    });
  });
  app.post('/api/webhooks/register', (req, res) => {
    try {
      const {
        name,
        url,
        secret,
        filters,
        headers
      } = req.body || {};
      if (!name || !url) return res.status(400).json({
        ok: false,
        error: 'name and url required'
      });
      d.register(name, url, {
        secret,
        filters,
        headers
      });
      res.json({
        ok: true,
        registered: name
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err.message
      });
    }
  });
  app.delete('/api/webhooks/:name', (req, res) => {
    const {
      name
    } = req.params;
    d.unregister(name);
    res.json({
      ok: true,
      unregistered: name
    });
  });
  app.patch('/api/webhooks/:name/enabled', (req, res) => {
    const {
      name
    } = req.params;
    const {
      enabled
    } = req.body || {};
    d.setEndpointEnabled(name, !!enabled);
    res.json({
      ok: true,
      name,
      enabled: !!enabled
    });
  });
  app.post('/api/webhooks/dispatch', async (req, res) => {
    try {
      const {
        event,
        payload,
        endpointName
      } = req.body || {};
      if (!event || typeof event !== 'string' || !/^[a-zA-Z0-9:_\-\.]+$/.test(event)) {
        return res.status(400).json({
          ok: false,
          error: 'event name required (alphanumeric with :_-.)'
        });
      }
      const jobIds = await d.dispatch(event, payload || {}, {
        endpointName
      });
      res.json({
        ok: true,
        event,
        jobCount: jobIds.length,
        jobIds
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err.message
      });
    }
  });
  app.post('/api/webhooks/verify-signature', (req, res) => {
    const {
      body,
      signature,
      secret
    } = req.body || {};
    if (!body || !signature || !secret) {
      return res.status(400).json({
        ok: false,
        error: 'body, signature, and secret required'
      });
    }
    const valid = d.verify(body, signature, secret);
    res.json({
      ok: true,
      valid
    });
  });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  HeadyWebhookDispatcher,
  getDispatcher,
  registerWebhookRoutes,
  PHI,
  FIB
};