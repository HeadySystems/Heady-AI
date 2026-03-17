// packages/heady-memory/src/t0-redis.js
// §3 — Upstash Redis T0 Working Memory
import { memoryKey, cslKey, llmCacheKey } from '../../heady-core/src/tenant.js';
import { PHI_7 } from '../../heady-core/src/phi.js';

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisCmd(cmd, ...args) {
  const res = await fetch(`${UPSTASH_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([cmd, ...args])
  });
  if (!res.ok) throw new Error(`Redis ${cmd} failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Redis error: ${data.error}`);
  return data.result;
}

/**
 * Store working memories in Redis with 30s TTL (φ⁷ ≈ 29,034ms).
 * @param {string} userId
 * @param {Array} memories
 */
export async function setWorkingMemory(userId, memories) {
  const key = memoryKey(userId);
  await redisCmd('SETEX', key, 30, JSON.stringify(memories));
}

/**
 * Retrieve working memories from Redis.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getWorkingMemory(userId) {
  const key = memoryKey(userId);
  const data = await redisCmd('GET', key);
  return data ? JSON.parse(data) : [];
}

/**
 * Set the user's current CSL score in Redis.
 * @param {string} userId
 * @param {number} score
 */
export async function setCSLScore(userId, score) {
  await redisCmd('SETEX', cslKey(userId), Math.round(PHI_7 / 1000), score.toString());
}

/**
 * Check semantic cache before calling LLM.
 * @param {string} promptHash
 * @returns {Promise<string|null>}
 */
export async function getCachedResponse(promptHash) {
  return redisCmd('GET', `cache:embed:${promptHash}`);
}

/**
 * Store LLM response in semantic cache.
 * @param {string} promptHash
 * @param {string} response
 * @param {number} [ttl=3600]
 */
export async function setCachedResponse(promptHash, response, ttl = 3600) {
  await redisCmd('SETEX', `cache:embed:${promptHash}`, ttl, response);
}

/**
 * Publish session delta for cross-device CRDT sync.
 * @param {string} userId
 * @param {object} delta
 */
export async function broadcastSessionUpdate(userId, delta) {
  await redisCmd('PUBLISH', `session:${userId}`, JSON.stringify(delta));
}
