/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Redis Streams Transport — Optional distributed task distribution layer.
 * Wraps XREADGROUP / XADD / XACK / XAUTOCLAIM for swarm task routing.
 *
 * When REDIS_URL is set, tasks flow through Redis Streams instead of
 * in-memory arrays. Each swarm gets its own stream and consumer group.
 *
 * Pattern:
 *   Producer  → XADD   heady:swarm:<name> * task <JSON>
 *   Consumer  → XREADGROUP GROUP <swarm> <beeId> COUNT 1 BLOCK 5000 STREAMS heady:swarm:<name> >
 *   Recover   → XAUTOCLAIM heady:swarm:<name> <swarm> <beeId> <minIdleMs> 0-0
 *   Ack       → XACK   heady:swarm:<name> <swarm> <messageId>
 *
 * Founder: Eric Haywood
 * @module core/swarm-engine/redis-transport
 */

import { EventEmitter } from 'events';
import phiMath from '@heady/phi-math-foundation';
const { fib, TIMING } = phiMath.default || phiMath;
import structuredLogger from '@heady/structured-logger';
const { createLogger } = structuredLogger.default || structuredLogger;

const logger = createLogger('redis-transport');

/** Stream key prefix */
const STREAM_PREFIX = 'heady:swarm:';

/** Min idle time for XAUTOCLAIM (recover stuck tasks) */
const AUTOCLAIM_MIN_IDLE_MS = TIMING?.DRAIN || 21034;

/** Max messages per XREADGROUP call */
const READ_BATCH = fib(5); // 5

/**
 * RedisStreamTransport — connects swarm task distribution to Redis Streams.
 *
 * Usage:
 *   const transport = new RedisStreamTransport(redisClient);
 *   await transport.ensureGroup('Deploy');
 *   await transport.publish('Deploy', task);
 *   const messages = await transport.consume('Deploy', 'bee-abc123');
 *   await transport.ack('Deploy', messageId);
 */
class RedisStreamTransport extends EventEmitter {
  /**
   * @param {object} redisClient — ioredis or redis client with xadd/xreadgroup/xack/xautoclaim
   */
  constructor(redisClient) {
    super();
    this._redis = redisClient;
    this._groups = new Set();
  }

  /**
   * Ensure the consumer group exists for a swarm stream.
   * Creates the stream and group if they don't exist.
   * @param {string} swarmName
   */
  async ensureGroup(swarmName) {
    const key = STREAM_PREFIX + swarmName.toLowerCase();
    const group = swarmName.toLowerCase();

    if (this._groups.has(group)) return;

    try {
      await this._redis.xgroup('CREATE', key, group, '0', 'MKSTREAM');
      this._groups.add(group);
      logger.info('Consumer group created', { stream: key, group });
    } catch (err) {
      // BUSYGROUP means group already exists — that's fine
      if (err.message && err.message.includes('BUSYGROUP')) {
        this._groups.add(group);
      } else {
        throw err;
      }
    }
  }

  /**
   * Publish a task to a swarm's stream.
   * @param {string} swarmName
   * @param {object} task — { id, vector, payload, type }
   * @returns {string} Redis message ID
   */
  async publish(swarmName, task) {
    const key = STREAM_PREFIX + swarmName.toLowerCase();
    const messageId = await this._redis.xadd(
      key, '*',
      'task', JSON.stringify(task),
      'taskId', task.id || '',
      'type', task.type || 'general'
    );

    this.emit('task:published', { swarmName, messageId, taskId: task.id });
    return messageId;
  }

  /**
   * Consume tasks from a swarm's stream using XREADGROUP.
   * Each bee is a consumer in the swarm's consumer group.
   *
   * @param {string} swarmName
   * @param {string} consumerId — bee ID
   * @param {number} [count=READ_BATCH]
   * @param {number} [blockMs=5000]
   * @returns {Array<{ messageId: string, task: object }>}
   */
  async consume(swarmName, consumerId, count = READ_BATCH, blockMs = 5000) {
    const key = STREAM_PREFIX + swarmName.toLowerCase();
    const group = swarmName.toLowerCase();

    await this.ensureGroup(swarmName);

    const result = await this._redis.xreadgroup(
      'GROUP', group, consumerId,
      'COUNT', count,
      'BLOCK', blockMs,
      'STREAMS', key, '>'
    );

    if (!result || result.length === 0) return [];

    const messages = [];
    // result format: [[streamKey, [[messageId, [field, value, ...]]]]]
    for (const [, entries] of result) {
      for (const [messageId, fields] of entries) {
        const fieldMap = {};
        for (let i = 0; i < fields.length; i += 2) {
          fieldMap[fields[i]] = fields[i + 1];
        }

        let task;
        try {
          task = JSON.parse(fieldMap.task || '{}');
        } catch {
          task = { raw: fieldMap.task };
        }

        messages.push({ messageId, task });
      }
    }

    this.emit('tasks:consumed', { swarmName, consumerId, count: messages.length });
    return messages;
  }

  /**
   * Acknowledge a processed task.
   * @param {string} swarmName
   * @param {string} messageId
   */
  async ack(swarmName, messageId) {
    const key = STREAM_PREFIX + swarmName.toLowerCase();
    const group = swarmName.toLowerCase();
    await this._redis.xack(key, group, messageId);
  }

  /**
   * Reclaim tasks from dead/stalled consumers using XAUTOCLAIM.
   * Tasks idle longer than AUTOCLAIM_MIN_IDLE_MS are reassigned.
   *
   * @param {string} swarmName
   * @param {string} claimerId — bee ID claiming the orphaned tasks
   * @param {number} [minIdleMs=AUTOCLAIM_MIN_IDLE_MS]
   * @returns {Array<{ messageId: string, task: object }>}
   */
  async autoClaim(swarmName, claimerId, minIdleMs = AUTOCLAIM_MIN_IDLE_MS) {
    const key = STREAM_PREFIX + swarmName.toLowerCase();
    const group = swarmName.toLowerCase();

    await this.ensureGroup(swarmName);

    let result;
    try {
      result = await this._redis.xautoclaim(
        key, group, claimerId,
        minIdleMs, '0-0',
        'COUNT', READ_BATCH
      );
    } catch (err) {
      // XAUTOCLAIM requires Redis >= 6.2
      if (err.message && err.message.includes('unknown command')) {
        logger.warn('XAUTOCLAIM not available (requires Redis >= 6.2), skipping recovery');
        return [];
      }
      throw err;
    }

    if (!result || !result[1] || result[1].length === 0) return [];

    // result format: [nextStartId, [[messageId, [field, value, ...]], ...], deletedIds]
    const messages = [];
    for (const [messageId, fields] of result[1]) {
      const fieldMap = {};
      for (let i = 0; i < fields.length; i += 2) {
        fieldMap[fields[i]] = fields[i + 1];
      }

      let task;
      try {
        task = JSON.parse(fieldMap.task || '{}');
      } catch {
        task = { raw: fieldMap.task };
      }

      messages.push({ messageId, task });
    }

    if (messages.length > 0) {
      this.emit('tasks:autoclaimed', { swarmName, claimerId, count: messages.length });
      logger.info('Tasks auto-claimed from dead consumers', {
        swarmName, claimerId, count: messages.length,
      });
    }

    return messages;
  }

  /**
   * Get stream info (length, consumer groups, pending counts).
   * @param {string} swarmName
   * @returns {object}
   */
  async streamInfo(swarmName) {
    const key = STREAM_PREFIX + swarmName.toLowerCase();
    try {
      const info = await this._redis.xinfo('STREAM', key);
      // Parse flat array into object
      const obj = {};
      for (let i = 0; i < info.length; i += 2) {
        obj[info[i]] = info[i + 1];
      }
      return obj;
    } catch (err) {
      if (err.message && err.message.includes('no such key')) {
        return { length: 0, exists: false };
      }
      throw err;
    }
  }
}

/**
 * Check if Redis Streams transport should be used.
 * Returns true when REDIS_URL is set and SWARM_TRANSPORT !== 'memory'.
 */
function useRedisTransport() {
  return !!(process.env.REDIS_URL && process.env.SWARM_TRANSPORT !== 'memory');
}

export {
  RedisStreamTransport,
  useRedisTransport,
  STREAM_PREFIX,
  AUTOCLAIM_MIN_IDLE_MS,
  READ_BATCH,
};
