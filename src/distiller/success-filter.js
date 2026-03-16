'use strict';

const PSI_SQ = 0.3819660113;
const JUDGE_THRESHOLD = 0.854; // ψ + ψ²/2 + ψ³/8

/**
 * Quality gate: only traces with sufficient JUDGE score enter distillation.
 * Configurable per task class (some classes may need stricter thresholds).
 */
function filterSuccess(trace, judgeScore, options = {}) {
  const threshold = options.threshold || JUDGE_THRESHOLD;

  if (judgeScore < threshold) {
    return null;
  }

  return {
    ...trace,
    judge_score: judgeScore,
    qualified: true,
    llm_calls: trace.events.filter(e => e.event === 'llm_call'),
    stage_timings: extractTimings(trace.events),
  };
}

function extractTimings(events) {
  const timings = {};
  let lastTs = events[0]?.ts || 0;

  for (const event of events) {
    if (event.event === 'stage_start' || event.stage) {
      if (!timings[event.stage]) {
        timings[event.stage] = { start: event.ts, duration_ms: 0 };
      }
      timings[event.stage].duration_ms = event.ts - (timings[event.stage].start || event.ts);
    }
  }
  return timings;
}

module.exports = { filterSuccess, JUDGE_THRESHOLD };
