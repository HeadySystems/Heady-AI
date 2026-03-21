'use strict';
const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');

/**
 * HEADY™ Upstash Redis Client — Full Liquid Architecture v9
 *
 * Implements:
 * - T0 Working Memory (CSL ≥ 0.718, φ⁷ × 1000ms TTL)
 * - Redis Streams for 22-stage pipeline (XADD/XREADGROUP/XACK/XAUTOCLAIM)
 * - Tenant-namespaced key hierarchy
 * - Rate limiting (sliding window + token bucket)
 * - Semantic LLM cache
 * - Worker heartbeats with dead-worker recovery
 * - Pipeline event publishing
 */
const PHI = 1.618033988749895;
const PHI_7_MS = 29034; // φ⁷ × 1000
const PHI_7_S = 29; // Rounded for Redis TTL

class UpstashRedis {
  /**
   * @param {object} config
   * @param {string} config.url      - UPSTASH_REDIS_REST_URL
   * @param {string} config.token    - UPSTASH_REDIS_REST_TOKEN
   * @param {string} [config.tenant] - Tenant ID for namespacing (default: 'heady')
   */
  constructor(config = {}) {
    this.url = config.url || process.env.UPSTASH_REDIS_URL;
    this.token = config.token || process.env.UPSTASH_REDIS_TOKEN;
    this.tenant = config.tenant || 'heady';
    if (!this.url || !this.token) {
      this.mock = true;
      logger.warn('[UpstashRedis] No URL/TOKEN — running in mock mode');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TRANSPORT — single HTTP request per command (Upstash REST API)
  // ═══════════════════════════════════════════════════════════════

  async _fetch(command, ...args) {
    if (this.mock) return null;
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([command, ...args])
    });
    const data = await res.json();
    if (data.error) throw new Error(`Upstash: ${data.error}`);
    return data.result;
  }

  /** Pipeline: batch multiple commands in one HTTP roundtrip. */
  async _pipeline(commands) {
    if (this.mock) return commands.map(() => null);
    const res = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands)
    });
    const data = await res.json();
    return data.map(r => r.result);
  }

  // ═══════════════════════════════════════════════════════════════
  // KEY NAMESPACING — tenant:{id}:... hierarchy per blueprint §1
  // ═══════════════════════════════════════════════════════════════

  _key(...parts) {
    return `tenant:${this.tenant}:${parts.join(':')}`;
  }
  _systemKey(...parts) {
    return `heady:${parts.join(':')}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // T0 WORKING MEMORY — CSL ≥ 0.718, TTL = φ⁷ seconds
  // ═══════════════════════════════════════════════════════════════

  async setWorkingMemory(userId, memories) {
    const key = this._key('session', userId);
    return this._fetch('SETEX', key, PHI_7_S, JSON.stringify(memories));
  }
  async getWorkingMemory(userId) {
    const key = this._key('session', userId);
    const raw = await this._fetch('GET', key);
    return raw ? JSON.parse(raw) : [];
  }

  /** Sliding-window session TTL refresh. */
  async touchSession(userId) {
    const key = this._key('session', userId);
    return this._fetch('EXPIRE', key, 1800); // 30 min sliding
  }

  // ═══════════════════════════════════════════════════════════════
  // REDIS STREAMS — 22-stage pipeline (blueprint §1)
  //
  //   Stage N reads from stream `pipeline:stageN`
  //   Processes, then XADD to `pipeline:stage(N+1)`
  //   Consumer groups enable parallel workers per stage
  // ═══════════════════════════════════════════════════════════════

  _streamKey(stage) {
    return this._key('pipeline', `stage${stage}`);
  }
  _dlqKey(stage) {
    return this._key('pipeline', `stage${stage}:dlq`);
  }

  /**
   * Add a task to a pipeline stage stream.
   * @param {number} stage  - Stage number (1-22)
   * @param {object} data   - Task payload (serialized as JSON fields)
   * @param {number} [maxlen=100000] - MAXLEN cap
   * @returns {string} Stream entry ID
   */
  async xadd(stage, data, maxlen = 100000) {
    const key = this._streamKey(stage);
    const fields = [];
    for (const [k, v] of Object.entries(data)) {
      fields.push(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    return this._fetch('XADD', key, 'MAXLEN', '~', String(maxlen), '*', ...fields);
  }

  /**
   * Create a consumer group for a stage (idempotent).
   * @param {number} stage  - Stage number
   * @param {string} group  - Consumer group name
   */
  async xgroupCreate(stage, group) {
    const key = this._streamKey(stage);
    try {
      return await this._fetch('XGROUP', 'CREATE', key, group, '0', 'MKSTREAM');
    } catch (e) {
      if (e.message.includes('BUSYGROUP')) return 'already_exists';
      throw e;
    }
  }

  /**
   * Read from a stream as part of a consumer group (blocking via poll).
   * @param {number} stage    - Stage number
   * @param {string} group    - Consumer group name
   * @param {string} consumer - This worker's consumer name
   * @param {number} [count=10] - Max entries to read
   * @returns {Array} Stream entries [{id, fields}]
   */
  async xreadgroup(stage, group, consumer, count = 10) {
    const key = this._streamKey(stage);
    const result = await this._fetch('XREADGROUP', 'GROUP', group, consumer, 'COUNT', String(count), 'STREAMS', key, '>');
    if (!result || !result[0]) return [];

    // Parse [[streamName, [[id, [field, value, ...]], ...]]]
    const entries = result[0][1] || [];
    return entries.map(([id, fieldArray]) => {
      const fields = {};
      for (let i = 0; i < fieldArray.length; i += 2) {
        const val = fieldArray[i + 1];
        try {
          fields[fieldArray[i]] = JSON.parse(val);
        } catch {
          fields[fieldArray[i]] = val;
        }
      }
      return {
        id,
        fields
      };
    });
  }

  /**
   * Acknowledge processed entries.
   * @param {number} stage - Stage number
   * @param {string} group - Consumer group
   * @param {...string} ids - Entry IDs to acknowledge
   */
  async xack(stage, group, ...ids) {
    const key = this._streamKey(stage);
    return this._fetch('XACK', key, group, ...ids);
  }

  /**
   * Claim stuck messages from dead workers (blueprint: 5 min idle threshold).
   * @param {number} stage    - Stage number
   * @param {string} group    - Consumer group
   * @param {string} consumer - This worker's consumer name
   * @param {number} [minIdleMs=300000] - 5 minutes default
   * @param {number} [count=10]
   * @returns {Array} Claimed entries
   */
  async xautoclaim(stage, group, consumer, minIdleMs = 300000, count = 10) {
    const key = this._streamKey(stage);
    const result = await this._fetch('XAUTOCLAIM', key, group, consumer, String(minIdleMs), '0-0', 'COUNT', String(count));
    if (!result || !result[1]) return [];
    return result[1].map(([id, fieldArray]) => {
      const fields = {};
      if (fieldArray) {
        for (let i = 0; i < fieldArray.length; i += 2) {
          try {
            fields[fieldArray[i]] = JSON.parse(fieldArray[i + 1]);
          } catch {
            fields[fieldArray[i]] = fieldArray[i + 1];
          }
        }
      }
      return {
        id,
        fields
      };
    });
  }

  /**
   * Check pending entries (for dead-letter routing after 3 failures).
   * @param {number} stage - Stage number
   * @param {string} group - Consumer group
   * @param {number} [count=10]
   */
  async xpending(stage, group, count = 10) {
    const key = this._streamKey(stage);
    return this._fetch('XPENDING', key, group, '-', '+', String(count));
  }

  /**
   * Route a failed message to the dead-letter queue after max retries.
   * @param {number} stage   - Source stage
   * @param {string} entryId - Original entry ID
   * @param {object} data    - Original payload + error info
   */
  async routeToDLQ(stage, entryId, data) {
    const dlqKey = this._dlqKey(stage);
    const fields = [];
    for (const [k, v] of Object.entries({
      ...data,
      original_id: entryId,
      dlq_at: Date.now()
    })) {
      fields.push(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    return this._fetch('XADD', dlqKey, 'MAXLEN', '~', '10000', '*', ...fields);
  }

  // ═══════════════════════════════════════════════════════════════
  // WORKER HEARTBEATS — 30s TTL, 3-miss detection (blueprint §11)
  // ═══════════════════════════════════════════════════════════════

  async heartbeat(workerId, metadata = {}) {
    const key = this._systemKey('worker', workerId, 'heartbeat');
    return this._fetch('SETEX', key, 30, JSON.stringify({
      ts: Date.now(),
      ...metadata
    }));
  }
  async isWorkerAlive(workerId) {
    const key = this._systemKey('worker', workerId, 'heartbeat');
    const result = await this._fetch('EXISTS', key);
    return result === 1;
  }

  // ═══════════════════════════════════════════════════════════════
  // RATE LIMITING — sliding window (blueprint §1)
  //
  //   Uses Upstash's sorted-set sliding window pattern:
  //   ZADD key <now> <uuid> → ZREMRANGEBYSCORE key 0 <now-window>
  //   → ZCARD key → compare with limit
  // ═══════════════════════════════════════════════════════════════

  /**
   * Sliding window rate limiter.
   * @param {string} identifier - User ID, API key, etc.
   * @param {number} limit      - Max requests per window
   * @param {number} windowMs   - Window size in ms (default: 60000 = 1 min)
   * @returns {{allowed: boolean, remaining: number, resetMs: number}}
   */
  async rateLimit(identifier, limit, windowMs = 60000) {
    if (this.mock) return {
      allowed: true,
      remaining: limit,
      resetMs: 0
    };
    const key = this._key('quota', `api:${identifier}`);
    const now = Date.now();
    const windowStart = now - windowMs;
    const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

    // Pipeline: clean expired + add + count + set TTL
    const results = await this._pipeline([['ZREMRANGEBYSCORE', key, '0', String(windowStart)], ['ZADD', key, String(now), member], ['ZCARD', key], ['PEXPIRE', key, String(windowMs * 2)]]);
    const count = results[2] || 0;
    const allowed = count <= limit;
    if (!allowed) {
      // Remove the entry we just added (over limit)
      await this._fetch('ZREM', key, member);
    }
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      resetMs: windowMs
    };
  }

  /**
   * Token bucket for LLM token metering.
   * @param {string} userId    - User identifier
   * @param {number} tokens    - Tokens consumed
   * @param {number} maxTokens - Max tokens per window
   * @param {number} windowMs  - Window duration (default: 3600000 = 1 hr)
   */
  async tokenBucket(userId, tokens, maxTokens, windowMs = 3600000) {
    const key = this._key('quota', `tokens:${userId}`);
    const current = parseInt((await this._fetch('GET', key)) || '0', 10);
    if (current + tokens > maxTokens) {
      const ttl = await this._fetch('PTTL', key);
      return {
        allowed: false,
        remaining: maxTokens - current,
        resetMs: ttl > 0 ? ttl : windowMs
      };
    }
    await this._pipeline([['INCRBY', key, String(tokens)], ['PEXPIRE', key, String(windowMs)]]);
    return {
      allowed: true,
      remaining: maxTokens - current - tokens,
      resetMs: windowMs
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SEMANTIC LLM CACHE — prevent duplicate calls (blueprint §1)
  // ═══════════════════════════════════════════════════════════════

  async getCachedLLM(hash) {
    const key = this._key('cache', 'llm', hash);
    const raw = await this._fetch('GET', key);
    return raw ? JSON.parse(raw) : null;
  }
  async setCachedLLM(hash, response, ttlSeconds = 3600) {
    const key = this._key('cache', 'llm', hash);
    return this._fetch('SETEX', key, ttlSeconds, JSON.stringify(response));
  }

  // ═══════════════════════════════════════════════════════════════
  // JOB STATUS — 48hr TTL per blueprint
  // ═══════════════════════════════════════════════════════════════

  async setJobStatus(jobId, status) {
    const key = this._key('job', jobId, 'status');
    return this._fetch('SETEX', key, 172800, typeof status === 'string' ? status : JSON.stringify(status));
  }
  async getJobStatus(jobId) {
    const key = this._key('job', jobId, 'status');
    const raw = await this._fetch('GET', key);
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SWARM ROSTER — managed set, no TTL (blueprint §1)
  // ═══════════════════════════════════════════════════════════════

  async addToSwarm(swarmName, memberId) {
    return this._fetch('SADD', this._systemKey('swarm', swarmName, 'roster'), memberId);
  }
  async removeFromSwarm(swarmName, memberId) {
    return this._fetch('SREM', this._systemKey('swarm', swarmName, 'roster'), memberId);
  }
  async getSwarmMembers(swarmName) {
    return this._fetch('SMEMBERS', this._systemKey('swarm', swarmName, 'roster')) || [];
  }

  // ═══════════════════════════════════════════════════════════════
  // PIPELINE EVENTS — pub/sub broadcast
  // ═══════════════════════════════════════════════════════════════

  async publishPipelineEvent(stage, eventData) {
    return this._fetch('PUBLISH', 'heady.pipeline.events', JSON.stringify({
      stage,
      timestamp: Date.now(),
      ...eventData
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // HEALTH
  // ═══════════════════════════════════════════════════════════════

  async ping() {
    if (this.mock) return {
      ok: false,
      mode: 'mock'
    };
    const result = await this._fetch('PING');
    return {
      ok: result === 'PONG',
      mode: 'live'
    };
  }
}
module.exports = {
  UpstashRedis,
  PHI,
  PHI_7_MS,
  PHI_7_S
};