'use strict';

const crypto = require('crypto');
const { getLogger } = require('../services/structured-logger');
const log = getLogger('prompt-optimizer', 'distiller');

const FIB_12 = 144; // max optimization calls

/**
 * Tier 1 — Optimized Prompt distillation.
 * In production: bridges to DSPy GEPA optimizer via Python subprocess.
 * Currently: extracts and hashes the prompt patterns from successful traces.
 */
async function optimizePrompt(trace, options = {}) {
  const maxCalls = options.max_calls || FIB_12;

  // Extract LLM call prompts from the trace
  const llmCalls = trace.llm_calls || [];
  const prompts = llmCalls.map(call => call.replay?.input).filter(Boolean);

  if (!prompts.length) {
    log.info('no prompts to optimize', { trace_id: trace.trace_id });
    return null;
  }

  const promptHash = crypto.createHash('sha256')
    .update(prompts.join('\n---\n'))
    .digest('hex');

  return {
    id: `t1_${promptHash.slice(0, 16)}`,
    tier: 1,
    task_class: trace.task_class,
    prompt: prompts[0], // Primary prompt — in production, GEPA-optimized
    sha256: promptHash,
    optimization_gain: 0, // Measured after first reuse
    created_at: Date.now(),
  };
}

module.exports = { optimizePrompt };
