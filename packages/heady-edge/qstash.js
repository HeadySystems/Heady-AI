'use strict';

/**
 * HEADY™ QStash Client — Liquid Architecture v9 (§P5)
 *
 * Upstash QStash for durable, guaranteed-delivery task execution:
 * - Publish tasks with automatic retries + exponential backoff
 * - Dead-letter queue after max failures
 * - Fan-out to multiple pipeline stages simultaneously
 * - Cron scheduling for recurring jobs
 * - Callback URLs for async completion notification
 * - Content-based deduplication
 *
 * @see https://upstash.com/docs/qstash
 */

const QSTASH_BASE = 'https://qstash.upstash.io/v2';

class QStash {
  /**
   * @param {object} config
   * @param {string} config.token      - QSTASH_TOKEN
   * @param {string} [config.baseUrl]  - QStash API base (default: https://qstash.upstash.io/v2)
   * @param {string} [config.signingKey] - QSTASH_CURRENT_SIGNING_KEY (for verification)
   * @param {string} [config.nextSigningKey] - QSTASH_NEXT_SIGNING_KEY (for key rotation)
   */
  constructor(config = {}) {
    this.token = config.token || process.env.QSTASH_TOKEN;
    this.baseUrl = config.baseUrl || QSTASH_BASE;
    this.signingKey = config.signingKey || process.env.QSTASH_CURRENT_SIGNING_KEY;
    this.nextSigningKey = config.nextSigningKey || process.env.QSTASH_NEXT_SIGNING_KEY;

    if (!this.token) {
      this.mock = true;
      console.warn('[QStash] No QSTASH_TOKEN — running in mock mode');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TRANSPORT
  // ═══════════════════════════════════════════════════════════════

  async _request(method, path, body = null, headers = {}) {
    if (this.mock) return { messageId: `mock-${Date.now()}` };

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`QStash ${method} ${path}: ${res.status} ${text.slice(0, 200)}`);
    }

    const contentType = res.headers.get('content-type') || '';
    return contentType.includes('json') ? res.json() : res.text();
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLISH — guaranteed-delivery task dispatch
  // ═══════════════════════════════════════════════════════════════

  /**
   * Publish a task to a destination URL with guaranteed delivery.
   *
   * @param {object} options
   * @param {string} options.url           - Destination endpoint
   * @param {object} options.body          - Task payload
   * @param {number} [options.retries=3]   - Max retry attempts
   * @param {string} [options.delay]       - Delay before first delivery (e.g. '10s', '5m')
   * @param {string} [options.deduplicationId] - Prevent duplicate processing
   * @param {string} [options.callback]    - URL to call on completion
   * @param {string} [options.failureCallback] - URL to call on final failure
   * @param {number} [options.timeout]     - Max seconds to wait for response
   * @param {object} [options.headers]     - Additional headers to forward
   * @returns {Promise<{messageId: string}>}
   */
  async publish(options) {
    const headers = {
      'Upstash-Retries': String(options.retries ?? 3),
    };

    if (options.delay) headers['Upstash-Delay'] = options.delay;
    if (options.deduplicationId) headers['Upstash-Deduplication-Id'] = options.deduplicationId;
    if (options.callback) headers['Upstash-Callback'] = options.callback;
    if (options.failureCallback) headers['Upstash-Failure-Callback'] = options.failureCallback;
    if (options.timeout) headers['Upstash-Timeout'] = String(options.timeout);

    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        headers[`Upstash-Forward-${k}`] = v;
      }
    }

    return this._request('POST', `/publish/${options.url}`, options.body, headers);
  }

  // ═══════════════════════════════════════════════════════════════
  // FAN-OUT — dispatch to multiple stages simultaneously
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fan-out a task to multiple destination URLs (parallel dispatch).
   *
   * @param {object} options
   * @param {string[]} options.urls       - Array of destination endpoints
   * @param {object} options.body         - Shared payload
   * @param {number} [options.retries=3]  - Max retries per destination
   * @param {string} [options.delay]      - Delay before delivery
   * @returns {Promise<Array<{messageId: string, url: string}>>}
   */
  async fanOut(options) {
    const results = await Promise.allSettled(
      options.urls.map(url =>
        this.publish({
          url,
          body: options.body,
          retries: options.retries,
          delay: options.delay,
          deduplicationId: options.deduplicationId
            ? `${options.deduplicationId}:${url}` : undefined,
        }).then(r => ({ ...r, url }))
      )
    );

    return results.map((r, i) => ({
      url: options.urls[i],
      messageId: r.status === 'fulfilled' ? r.value.messageId : null,
      error: r.status === 'rejected' ? r.reason.message : null,
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // PIPELINE STAGES — convenience for Heady's 22-stage pipeline
  // ═══════════════════════════════════════════════════════════════

  /**
   * Dispatch a task to a specific pipeline stage.
   *
   * @param {number} stage      - Stage number (1-22)
   * @param {object} payload    - Task data
   * @param {string} baseUrl    - Base URL of the pipeline service
   * @param {object} [options]  - Additional publish options
   */
  async dispatchStage(stage, payload, baseUrl, options = {}) {
    return this.publish({
      url: `${baseUrl}/pipeline/stage/${stage}`,
      body: {
        stage,
        timestamp: Date.now(),
        ...payload,
      },
      retries: options.retries ?? 5,
      deduplicationId: `stage-${stage}-${payload.pipeline_run_id || Date.now()}`,
      callback: options.callback || `${baseUrl}/pipeline/stage/${stage}/complete`,
      failureCallback: options.failureCallback || `${baseUrl}/pipeline/dlq`,
      ...options,
    });
  }

  /**
   * Dispatch a pipeline run across all 22 stages sequentially.
   * Each stage's callback triggers the next stage.
   *
   * @param {object} initialPayload - Pipeline input
   * @param {string} baseUrl        - Pipeline service base URL
   */
  async startPipeline(initialPayload, baseUrl) {
    const pipelineRunId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this.dispatchStage(1, {
      ...initialPayload,
      pipeline_run_id: pipelineRunId,
    }, baseUrl);
  }

  // ═══════════════════════════════════════════════════════════════
  // SCHEDULES — cron-based recurring tasks
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a recurring schedule.
   *
   * @param {object} options
   * @param {string} options.destination  - Target URL
   * @param {string} options.cron         - Cron expression (e.g. '0 * * * *' for hourly)
   * @param {object} [options.body]       - Payload
   * @param {number} [options.retries=3]  - Max retries per invocation
   * @returns {Promise<{scheduleId: string}>}
   */
  async createSchedule(options) {
    const headers = {
      'Upstash-Cron': options.cron,
      'Upstash-Retries': String(options.retries ?? 3),
    };

    return this._request('POST', `/schedules/${options.destination}`, options.body, headers);
  }

  /**
   * List all active schedules.
   */
  async listSchedules() {
    return this._request('GET', '/schedules');
  }

  /**
   * Delete a schedule.
   * @param {string} scheduleId
   */
  async deleteSchedule(scheduleId) {
    return this._request('DELETE', `/schedules/${scheduleId}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /** Get message status by ID. */
  async getMessage(messageId) {
    return this._request('GET', `/messages/${messageId}`);
  }

  /** Cancel a pending/scheduled message. */
  async cancelMessage(messageId) {
    return this._request('DELETE', `/messages/${messageId}`);
  }

  /**
   * Bulk cancel messages by filter.
   * @param {object} filter
   * @param {string} [filter.url] - Cancel all messages to this URL
   */
  async bulkCancel(filter = {}) {
    return this._request('DELETE', '/messages', filter);
  }

  // ═══════════════════════════════════════════════════════════════
  // DLQ — Dead Letter Queue management
  // ═══════════════════════════════════════════════════════════════

  /** List messages in the dead-letter queue. */
  async listDLQ(cursor) {
    const path = cursor ? `/dlq?cursor=${cursor}` : '/dlq';
    return this._request('GET', path);
  }

  /** Retry a specific DLQ message. */
  async retryDLQ(dlqMessageId) {
    return this._request('POST', `/dlq/${dlqMessageId}`);
  }

  /** Delete a DLQ message (acknowledge failure). */
  async deleteDLQ(dlqMessageId) {
    return this._request('DELETE', `/dlq/${dlqMessageId}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // WEBHOOK VERIFICATION — validate incoming QStash callbacks
  // ═══════════════════════════════════════════════════════════════

  /**
   * Verify a QStash webhook signature.
   * Uses HMAC-SHA256 with the current/next signing key.
   *
   * @param {string} signature  - Upstash-Signature header
   * @param {string} body       - Raw request body
   * @returns {boolean}
   */
  async verify(signature, body) {
    if (!this.signingKey) {
      console.warn('[QStash] No signing key — skipping verification');
      return true;
    }

    const crypto = require('crypto');
    const keys = [this.signingKey, this.nextSigningKey].filter(Boolean);

    for (const key of keys) {
      const expected = crypto
        .createHmac('sha256', key)
        .update(body)
        .digest('base64url');

      // QStash signature is a JWT — extract the body claim
      try {
        const parts = signature.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          const bodyHash = crypto.createHash('sha256').update(body).digest('base64url');
          if (payload.body === bodyHash) return true;
        }
      } catch {
        // Fall through to next key
      }

      if (signature === expected) return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPRESS MIDDLEWARE — for pipeline webhook handlers
  // ═══════════════════════════════════════════════════════════════

  /**
   * Express middleware to verify QStash webhook signatures.
   * Usage: app.use('/pipeline', qstash.middleware());
   */
  middleware() {
    return async (req, res, next) => {
      const signature = req.headers['upstash-signature'];
      if (!signature) {
        return res.status(401).json({ error: 'Missing Upstash-Signature header' });
      }

      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const valid = await this.verify(signature, rawBody);

      if (!valid) {
        return res.status(401).json({ error: 'Invalid QStash signature' });
      }

      next();
    };
  }
}

module.exports = { QStash };
