// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ CSL Pattern Engine v2.0.0                                ║
// ║  Dual-Gate Pattern Execution & Consequence Dispatch              ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';
import { findNegativePatterns, findPositivePatterns } from '../../../../packages/heady-db/src/pg/patterns.mjs';
import { cachePatternState } from '../../../../packages/heady-db/src/redis/patterns-cache.mjs';

const logger = pino();
const PHI_INV = 0.618034;

/**
 * CSL Gate: Filters out low confidence outputs.
 * Requires cosine similarity (cosScore) > PHI_INV
 */
function cslGate(value, cosScore, tau = PHI_INV) {
  if (cosScore >= tau) {
    return value;
  }
  return null;
}

export async function evaluatePattern(event, incomingPatternType, nc) {
  const { tenantId, eventType, payload, traceId } = event;
  
  try {
    const queryText = `${eventType} ${JSON.stringify(payload)}`;
    
    // 1. NEGATIVE GATE (Check for violations first)
    const negativeCandidates = await findNegativePatterns(tenantId, queryText);
    const passedNegatives = negativeCandidates
      .map(c => ({ pattern: cslGate(c.pattern, c.similarity), similarity: c.similarity }))
      .filter(c => c.pattern !== null);

    if (passedNegatives.length > 0) {
      const violation = passedNegatives[0];
      logger.warn({
        msg: 'CSL Gate triggered NEGATIVE pattern violation',
        tenantId,
        pattern: violation.pattern,
        similarity: violation.similarity,
        'X-Heady-Trace-Id': traceId
      });

      // Dispatch Consequence
      const consequencePayload = JSON.stringify({
        tenantId,
        traceId,
        action: 'phi-backoff', // Enforce circuit breaker timeout
        reason: `High similarity (${violation.similarity.toFixed(3)}) to negative pattern: ${violation.pattern}`
      });

      nc.publish('system.consequence.enforce', Buffer.from(consequencePayload));
      
      // Cache violation state to Edge
      await cachePatternState(tenantId, { status: 'BLOCKED', reason: violation.pattern });
      return; // HALT Execution
    }

    // 2. POSITIVE GATE (Check for recommendations)
    const positiveCandidates = await findPositivePatterns(tenantId, queryText);
    const passedPositives = positiveCandidates
      .map(c => ({ pattern: cslGate(c.pattern, c.similarity), similarity: c.similarity }))
      .filter(c => c.pattern !== null);

    if (passedPositives.length > 0) {
      const best = passedPositives[0];
      logger.info({
        msg: 'CSL Gate passed POSITIVE pattern recommendation',
        tenantId,
        pattern: best.pattern,
        similarity: best.similarity,
        'X-Heady-Trace-Id': traceId
      });

      // Cache recommendation state to Edge
      await cachePatternState(tenantId, { status: 'RECOMMENDED', pattern: best.pattern });
    }
  } catch (err) {
    logger.error({
      msg: 'CSL pattern evaluation failed',
      tenantId,
      error: err.message,
      'X-Heady-Trace-Id': traceId
    });
  }
}
