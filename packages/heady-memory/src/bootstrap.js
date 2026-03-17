// packages/heady-memory/src/bootstrap.js
// §3 — Full Post-Auth Latent Space Bootstrap (T0 + T1 combined)
import { setWorkingMemory, setCSLScore } from './t0-redis.js';
import { bootstrapUserMemory } from './t1-neon.js';
import { CSL, TOP_K } from '../../heady-core/src/phi.js';

/**
 * Bootstrap a user's latent space after authentication.
 * 1. Load top-K memories from Neon (T1)
 * 2. Cache in Redis (T0) for instant retrieval
 * 3. Compute composite CSL score
 *
 * @param {string} userId
 * @returns {Promise<{ userId: string, memoryCount: number, cslScore: number, memories: Array, bootstrappedAt: number }>}
 */
export async function bootstrapLatentSpace(userId) {
  const memories = await bootstrapUserMemory(userId, TOP_K);

  const cslScore = memories.length > 0
    ? memories.reduce((sum, m) => sum + (m.csl_score || 0), 0) / memories.length
    : CSL.INCLUDE;

  // T0: cache in Redis for instant retrieval during session
  await setWorkingMemory(userId, memories.map(m => ({
    id: m.id,
    content: m.content,
    score: m.csl_score,
    tier: m.tier
  })));
  await setCSLScore(userId, cslScore);

  return {
    userId,
    memoryCount: memories.length,
    cslScore,
    memories,
    bootstrappedAt: Date.now()
  };
}
