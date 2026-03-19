'use strict';

const crypto = require('crypto');
const { getLogger } = require('../services/structured-logger');
const log = getLogger('config-extractor', 'distiller');

/**
 * Tier 2 — Pipeline Configuration extraction.
 * Extracts abstract tips and config patterns from successful traces.
 * Follows the trajectory-to-abstract-tips pattern (arXiv:2603.10600).
 */
async function extractConfig(trace) {
  const stages = Object.keys(trace.stage_timings || {});
  const llmCalls = trace.llm_calls || [];

  // Extract which stages were used and their models
  const modelRouting = {};
  for (const call of llmCalls) {
    const stage = call.stage || 'unknown';
    if (call.meta?.model) {
      modelRouting[stage] = call.meta.model;
    }
  }

  const configHash = crypto.createHash('sha256')
    .update(JSON.stringify({ stages, modelRouting, task_class: trace.task_class }))
    .digest('hex');

  return {
    id: `t2_${configHash.slice(0, 16)}`,
    tier: 2,
    task_class: trace.task_class,
    config: {
      pipeline_variant: stages.length > 13 ? 'full' : 'fast',
      active_stages: stages,
      model_routing: modelRouting,
    },
    tips: [],
    sha256: configHash,
    optimization_gain: 0,
    created_at: Date.now(),
  };
}

module.exports = { extractConfig };
