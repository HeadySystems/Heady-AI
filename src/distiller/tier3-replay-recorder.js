'use strict';

const crypto = require('crypto');
const { getLogger } = require('../services/structured-logger');
const log = getLogger('replay-recorder', 'distiller');

/**
 * Tier 3 — Full Execution Recipe / Deterministic Replay.
 * Records complete trace with DAG topology, LLM I/O, and test assertions.
 * Replay: stream recorded outputs instead of making new LLM calls.
 */
async function recordReplay(trace) {
  const llmCalls = trace.llm_calls || [];
  const events = trace.events || [];

  // Build DAG from stage transitions
  const nodes = [...new Set(events.map(e => e.stage).filter(Boolean))];
  const edges = [];
  for (let i = 1; i < nodes.length; i++) {
    edges.push([nodes[i - 1], nodes[i]]);
  }

  // Collect recorded LLM outputs for replay
  const recordedEvents = llmCalls
    .filter(call => call.replay)
    .map(call => ({
      stage: call.stage,
      model: call.meta?.model,
      input: call.replay.input,
      output: call.replay.output,
      tokens_in: call.meta?.tokens_in,
      tokens_out: call.meta?.tokens_out,
      duration_ms: call.meta?.duration_ms,
    }));

  const totalTokens = recordedEvents.reduce((sum, e) => sum + (e.tokens_in || 0) + (e.tokens_out || 0), 0);
  const totalDuration = events.length > 1
    ? events[events.length - 1].ts - events[0].ts
    : 0;

  const replayHash = crypto.createHash('sha256')
    .update(JSON.stringify({ trace_id: trace.trace_id, recordedEvents }))
    .digest('hex');

  return {
    id: `t3_${replayHash.slice(0, 16)}`,
    tier: 3,
    task_class: trace.task_class,
    trace_id: trace.trace_id,
    judge_score: trace.judge_score,
    sha256: replayHash,
    replay_compatible: recordedEvents.length > 0,
    recorded_llm_calls: recordedEvents.length,
    recorded_events: recordedEvents,
    total_tokens: totalTokens,
    duration_ms: totalDuration,
    dag: { nodes, edges },
    test_assertions: [], // Generated from output analysis in production
    optimization_gain: 0,
    created_at: Date.now(),
  };
}

module.exports = { recordReplay };
