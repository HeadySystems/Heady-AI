/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 */
// HEADY_BRAND:BEGIN
// Upstash EventSpine Setup — Redis Streams + Kafka Topics
// HEADY_BRAND:END

const PHI = 1.618033988749895;

/**
 * Upstash Redis Streams configuration for the Heady EventSpine.
 * All events flow through Redis Streams with consumer groups.
 */
const STREAMS = {
  'heady:events': {
    consumerGroup: 'hcfp-consumers',
    description: 'Main EventSpine — all pipeline, service, and system events',
    blockTimeout: 0, // Instantaneous push
  },
  'heady:auto-success': {
    consumerGroup: 'auto-success-consumers',
    description: 'Auto-Success Engine reaction events',
    blockTimeout: 0,
  },
  'heady:deploy': {
    consumerGroup: 'deploy-consumers',
    description: 'Deployment lifecycle events',
    blockTimeout: 0,
  },
  'heady:health': {
    consumerGroup: 'health-consumers',
    description: 'Service health check events',
    blockTimeout: 0,
  },
  'heady:battle': {
    consumerGroup: 'battle-consumers',
    description: 'HeadyBattle arena events',
    blockTimeout: 0,
  },
  'heady:sims': {
    consumerGroup: 'sims-consumers',
    description: 'HeadySims simulation events',
    blockTimeout: 0,
  },
  'heady:mc': {
    consumerGroup: 'mc-consumers',
    description: 'HeadyMC Monte Carlo events',
    blockTimeout: 0,
  },
};

/**
 * Upstash Kafka topic definitions.
 * Partitions are Fibonacci-scaled.
 */
const KAFKA_TOPICS = {
  'heady.pipeline.events': { partitions: 13, retentionMs: 604800000 },   // 7d
  'heady.service.health':  { partitions: 8,  retentionMs: 86400000 },    // 1d
  'heady.audit.trail':     { partitions: 5,  retentionMs: 2592000000 },  // 30d
  'heady.battle.events':   { partitions: 8,  retentionMs: 604800000 },   // 7d
  'heady.sims.results':    { partitions: 8,  retentionMs: 604800000 },   // 7d
  'heady.mc.simulations':  { partitions: 8,  retentionMs: 604800000 },   // 7d
  'heady.colab.events':    { partitions: 5,  retentionMs: 604800000 },   // 7d
};

/**
 * Create an Upstash Redis client for the EventSpine.
 */
function createEventSpineClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return { publish: async () => {}, subscribe: async () => {}, connected: false };
  }

  try {
    const { Redis } = require('@upstash/redis');
    const redis = new Redis({ url, token });
    return {
      connected: true,
      redis,
      async publish(stream, data) {
        return redis.xadd(stream, '*', { data: JSON.stringify(data), ts: Date.now() });
      },
      async subscribe(stream, group, consumer, handler) {
        // Create consumer group if not exists
        try { await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM'); } catch { /* already exists */ }
        // Read with BLOCK 0
        const messages = await redis.xreadgroup(group, consumer, [{ key: stream, id: '>' }], { count: 10, block: 0 });
        for (const msg of (messages || [])) {
          await handler(JSON.parse(msg.data));
        }
      },
    };
  } catch (err) {
    console.error('[upstash] Failed to create EventSpine client:', err.message);
    return { publish: async () => {}, subscribe: async () => {}, connected: false };
  }
}

module.exports = { STREAMS, KAFKA_TOPICS, createEventSpineClient, PHI };
