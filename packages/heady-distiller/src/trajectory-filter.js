// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: packages/heady-distiller/src/trajectory-filter.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * @module trajectory-filter
 * @description Filters pipeline execution traces using three research-backed strategies
 * for HeadyDistiller Stage 22 DISTILL.
 *
 * Strategies:
 *   1. successFilter    — SWE-Gym RFT pattern: keep traces where judgeScore >= minSuccessRate
 *   2. confidenceFilter — WEBRL pattern: exclude trivially easy and actively failing traces
 *                         outside the confidence window [PSI², 1−PSI²] = [0.382, 0.618]
 *   3. extractTips      — Abstract reusable tips with applicability conditions from passing traces
 *
 * All thresholds derive from phi-math. No magic numbers.
 */

import { PSI, PSI2, FIB, CSL, phiFusionWeights } from '../shared/phi-math.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default minimum judge score: PSI (0.618) */
const DEFAULT_MIN_SUCCESS_RATE = PSI; // 0.618033…

/** Default confidence window: [PSI², 1−PSI²] = [0.382, 0.618] */
const DEFAULT_CONFIDENCE_WINDOW = Object.freeze([PSI2, 1 - PSI2]); // [0.382, 0.618]

/** Default maximum tips to extract: FIB[12] = 144 */
const DEFAULT_MAX_TIPS = FIB[12]; // 144

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely extract judgeScore from a trace row.
 * Handles snake_case (DB) and camelCase (in-memory) field names.
 *
 * @param {object} trace
 * @returns {number}
 */
function getJudgeScore(trace) {
  return Number(trace?.judge_score ?? trace?.judgeScore ?? 0);
}

/**
 * Safely extract confidence from a trace row.
 *
 * @param {object} trace
 * @returns {number}
 */
function getConfidence(trace) {
  return Number(trace?.confidence ?? 0);
}

/**
 * Extract a variant label from a trace.
 * @param {object} trace
 * @returns {string}
 */
function getVariant(trace) {
  return trace?.variant ?? 'unknown';
}

/**
 * Extract stage results from a trace.
 * Handles JSONB-decoded objects or raw strings.
 *
 * @param {object} trace
 * @returns {object}
 */
function getStageResults(trace) {
  const raw = trace?.stage_results ?? trace?.stageResults ?? {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw ?? {};
}

/**
 * Extract timeline from a trace.
 * @param {object} trace
 * @returns {object[]}
 */
function getTimeline(trace) {
  const raw = trace?.timeline ?? [];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

/**
 * Derive abstract tip from a single trace.
 *
 * A tip captures:
 *   - The highest-scoring stage (by judgeScore or confidence in its output).
 *   - The conditions under which this trace succeeded (variant + confidence band).
 *   - The confidence in the tip (phi-fused from judgeScore and confidence).
 *
 * @param {object} trace
 * @returns {{ tip: string, conditions: object, sourceTraceId: string, confidence: number }}
 */
function deriveTipFromTrace(trace) {
  const judgeScore = getJudgeScore(trace);
  const confidence = getConfidence(trace);
  const variant    = getVariant(trace);
  const stageResults = getStageResults(trace);
  const timeline   = getTimeline(trace);

  // Identify which stage contributed most (highest judgeScore or first final stage)
  const stageKeys = Object.keys(stageResults);
  let topStage = 'pipeline';
  let topScore = 0;

  for (const key of stageKeys) {
    const stageVal = stageResults[key];
    const stageScore =
      Number(stageVal?.judgeScore ?? stageVal?.score ?? stageVal?.confidence ?? 0);
    if (stageScore > topScore) {
      topScore = stageScore;
      topStage = key;
    }
  }

  // Fuse judgeScore and confidence using phi weights: [PSI, PSI²] normalised
  const [w0, w1] = phiFusionWeights(2); // [0.618…, 0.381…]
  const tipConfidence = w0 * judgeScore + w1 * confidence;

  // Build applicability conditions
  const conditions = {
    variant,
    minJudgeScore: judgeScore,
    confidenceBand: confidence <= CSL.BOOST
      ? 'low'
      : confidence <= CSL.HIGH
        ? 'medium'
        : 'high',
    topStage,
    elapsed: trace?.elapsed ?? 0,
  };

  // Abstract tip text
  const stageCount = stageKeys.length || timeline.length;
  const tip =
    `Variant "${variant}" with ${stageCount} active stage(s) reached judgeScore ` +
    `${judgeScore.toFixed(3)} (top stage: ${topStage}). ` +
    `Confidence band: ${conditions.confidenceBand}.`;

  return {
    tip,
    conditions,
    sourceTraceId: trace?.run_id ?? trace?.runId ?? 'unknown',
    confidence: tipConfidence,
  };
}

// ---------------------------------------------------------------------------
// TrajectoryFilter
// ---------------------------------------------------------------------------

export class TrajectoryFilter {
  /**
   * @param {object} [opts]
   * @param {number}   [opts.minSuccessRate=PSI]           - Minimum judgeScore to pass success filter (0.618).
   * @param {[number, number]} [opts.confidenceWindow]     - [low, high] confidence bounds (default [PSI², 1−PSI²]).
   * @param {number}   [opts.maxTips=FIB[12]]              - Maximum tips to extract across all traces (144).
   */
  constructor({
    minSuccessRate    = DEFAULT_MIN_SUCCESS_RATE,
    confidenceWindow  = DEFAULT_CONFIDENCE_WINDOW,
    maxTips           = DEFAULT_MAX_TIPS,
  } = {}) {
    if (minSuccessRate < 0 || minSuccessRate > 1) {
      throw new RangeError(`minSuccessRate must be in [0, 1], got ${minSuccessRate}`);
    }
    if (!Array.isArray(confidenceWindow) || confidenceWindow.length !== 2) {
      throw new TypeError('confidenceWindow must be a [low, high] tuple');
    }

    this.minSuccessRate   = minSuccessRate;
    this.confidenceWindow = confidenceWindow;
    this.maxTips          = Math.max(1, Math.floor(maxTips));
  }

  // -------------------------------------------------------------------------
  // successFilter
  // -------------------------------------------------------------------------

  /**
   * SWE-Gym RFT pattern: keep only traces where judgeScore >= minSuccessRate.
   *
   * Eliminates failed and low-quality runs that would pollute the knowledge base
   * with failure patterns.
   *
   * @param {object[]} traces - Array of trace rows.
   * @returns {object[]} Filtered traces.
   */
  successFilter(traces) {
    if (!Array.isArray(traces)) return [];
    return traces.filter(t => getJudgeScore(t) >= this.minSuccessRate);
  }

  // -------------------------------------------------------------------------
  // confidenceFilter
  // -------------------------------------------------------------------------

  /**
   * WEBRL pattern: exclude traces outside the confidence window.
   *
   * Removes two extremes:
   *   - Trivially easy traces (confidence > upper bound) — system already knows these
   *   - Actively failing / flailing traces (confidence < lower bound) — too noisy
   *
   * Default window: [PSI² = 0.382, 1−PSI² = 0.618]
   * Only traces in the "interesting middle" produce reusable learning signal.
   *
   * @param {object[]} traces
   * @returns {object[]}
   */
  confidenceFilter(traces) {
    if (!Array.isArray(traces)) return [];
    const [low, high] = this.confidenceWindow;
    return traces.filter(t => {
      const c = getConfidence(t);
      return c >= low && c <= high;
    });
  }

  // -------------------------------------------------------------------------
  // extractTips
  // -------------------------------------------------------------------------

  /**
   * Extract abstract reusable tips from passing traces.
   *
   * Each tip captures:
   *   - The abstract insight derived from the trace.
   *   - Applicability conditions (variant, confidence band, top stage).
   *   - Source trace ID for lineage.
   *   - A phi-fused confidence score.
   *
   * Tips are sorted by confidence descending and capped at maxTips.
   *
   * @param {object[]} traces - Traces that have already passed both filters.
   * @returns {{ tip: string, conditions: object, sourceTraceId: string, confidence: number }[]}
   */
  extractTips(traces) {
    if (!Array.isArray(traces) || traces.length === 0) return [];

    const tips = traces
      .map(trace => {
        try {
          return deriveTipFromTrace(trace);
        } catch {
          // Malformed trace — skip without crashing
          return null;
        }
      })
      .filter(Boolean);

    // Sort by confidence descending (highest-value tips first)
    tips.sort((a, b) => b.confidence - a.confidence);

    // Deduplicate tips with identical tip text (keep highest confidence)
    const seen = new Map();
    for (const t of tips) {
      if (!seen.has(t.tip)) {
        seen.set(t.tip, t);
      }
    }

    return Array.from(seen.values()).slice(0, this.maxTips);
  }

  // -------------------------------------------------------------------------
  // filterAll
  // -------------------------------------------------------------------------

  /**
   * Run all three filters in sequence and return structured results.
   *
   * Pipeline:
   *   traces → successFilter → confidenceFilter → extractTips
   *
   * @param {object[]} traces - Raw trace rows from TraceCollector.
   * @returns {{
   *   filtered: object[],
   *   tips: { tip: string, conditions: object, sourceTraceId: string, confidence: number }[],
   *   stats: {
   *     inputCount: number,
   *     successFiltered: number,
   *     confidenceFiltered: number,
   *     tipsExtracted: number,
   *   }
   * }}
   */
  filterAll(traces) {
    const inputCount = Array.isArray(traces) ? traces.length : 0;

    const afterSuccess    = this.successFilter(traces);
    const afterConfidence = this.confidenceFilter(afterSuccess);
    const tips            = this.extractTips(afterConfidence);

    const stats = {
      inputCount,
      successFiltered:    afterSuccess.length,
      confidenceFiltered: afterConfidence.length,
      tipsExtracted:      tips.length,
    };

    return {
      filtered: afterConfidence,
      tips,
      stats,
    };
  }
}

export default TrajectoryFilter;
