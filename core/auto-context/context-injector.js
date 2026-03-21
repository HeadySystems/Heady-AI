'use strict';
/**
 * HeadyAutoContext — Context Injector Middleware (CommonJS)
 *
 * Wraps any task execution function with automatic context assembly.
 * Ensures every task gets a ContextEnvelope BEFORE execution begins.
 *
 * © 2026 HeadySystems Inc. — Eric Haywood
 * Architecture: φ-scaled, CSL-gated, Sacred Geometry v4.0
 */

const { EventEmitter } = require('events');
const { ContextEnvelope, CONTEXT_SOURCES } = require('./context-assembler.js');

// ─── φ-Math Constants ────────────────────────────────────────────
const PHI  = 1.618033988749895;
const PSI  = 1 / PHI;

// ─── CSL Quality Gates ──────────────────────────────────────────
const phiThreshold = (level, spread = 0.5) => 1 - Math.pow(PSI, level) * spread;

const QUALITY_GATES = Object.freeze({
  PASS:   phiThreshold(3),  // ≈ 0.882
  REVIEW: phiThreshold(2),  // ≈ 0.809
  RETRY:  phiThreshold(1),  // ≈ 0.691
  FAIL:   phiThreshold(0),  // ≈ 0.500
});

/**
 * Context injection modes.
 */
const INJECTION_MODES = Object.freeze({
  STRICT:      'strict',
  ADVISORY:    'advisory',
  PASSTHROUGH: 'passthrough',
});

/**
 * Create a context-injecting wrapper around a task function.
 *
 * @param {HeadyAutoContext} autoContext - The context engine instance
 * @param {Function} taskFn - (contextEnvelope, params) => result
 * @param {object} [options]
 * @param {string} [options.mode] - Injection mode
 * @param {number} [options.minRelevance] - Minimum relevance score
 * @param {number} [options.maxRetries] - Max context assembly retries
 * @returns {Function}
 */
function contextInjector(autoContext, taskFn, options = {}) {
  const mode = options.mode || INJECTION_MODES.ADVISORY;
  const minRelevance = options.minRelevance ?? QUALITY_GATES.RETRY;
  const maxRetries = options.maxRetries ?? Math.round(PHI * 2); // 3

  return async function injectedTask(params) {
    const { taskId, userId, query, ...rest } = params;

    if (!taskId || !userId) {
      throw new Error('HeadyAutoContext requires taskId and userId in all task params');
    }

    let envelope = null;
    let attempts = 0;
    let lastError = null;

    while (attempts < maxRetries) {
      attempts++;
      try {
        envelope = await autoContext.assemble({
          taskId,
          userId,
          query: query || `task:${taskId}`,
          metadata: rest,
        });

        if (envelope.meetsThreshold(minRelevance)) {
          break;
        }

        if (mode === INJECTION_MODES.PASSTHROUGH) {
          break;
        }

        if (attempts < maxRetries && typeof autoContext.emit === 'function') {
          autoContext.emit('context:below_threshold', {
            taskId,
            attempt: attempts,
            relevanceScore: envelope.relevanceScore,
            threshold: minRelevance,
          });
        }
      } catch (err) {
        lastError = err;
        if (typeof autoContext.emit === 'function') {
          autoContext.emit('context:assembly_error', {
            taskId,
            attempt: attempts,
            error: err.message,
          });
        }
      }
    }

    // Enforce mode
    if (!envelope) {
      if (mode === INJECTION_MODES.STRICT) {
        throw new Error(
          `HeadyAutoContext: Context assembly failed after ${maxRetries} attempts. ` +
          `Last error: ${lastError?.message || 'unknown'}`
        );
      }
      // Advisory/passthrough — create empty envelope
      const emptySources = {};
      for (const type of Object.values(CONTEXT_SOURCES)) {
        emptySources[type] = { items: [], score: 0 };
      }
      envelope = new ContextEnvelope({
        taskId,
        userId,
        sources: emptySources,
        assemblyMs: 0,
        totalItems: 0,
        relevanceScore: 0,
        timestamp: Date.now(),
      });
    }

    if (mode === INJECTION_MODES.STRICT && !envelope.meetsThreshold(minRelevance)) {
      throw new Error(
        `HeadyAutoContext: Context relevance ${envelope.relevanceScore.toFixed(3)} ` +
        `below threshold ${minRelevance.toFixed(3)} in strict mode`
      );
    }

    return taskFn(envelope, { taskId, userId, query, ...rest });
  };
}

module.exports = {
  contextInjector,
  INJECTION_MODES,
  QUALITY_GATES,
};
