const logger = console;
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
// ║  FILE: src/hc_trajectory_filter.js                              ║
// ║  LAYER: distiller/filtering                                     ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HeadyDistiller — Trajectory Filter
 *
 * Implements 3 research-backed filtering strategies:
 *
 * 1. Success filtering (SWE-Gym RFT): Keep only completed traces
 * 2. Confidence filtering (WEBRL): Score by execution quality,
 *    exclude trivial and flailing runs
 * 3. Trajectory-to-tips (March 2026): Extract abstract tips with
 *    applicability conditions — selective add + selective delete
 */

const crypto = require('crypto');

class TrajectoryFilter {
  constructor(options = {}) {
    this.minSuccessRate = options.minSuccessRate ?? 0.8;
    this.confidenceWindow = options.confidenceWindow || [0.1, 0.9];
    this.tipExtraction = options.tipExtraction !== false;
    this.maxTips = options.maxTips || 200;
    this.tips = new Map(); // tipId → { tip, conditions, score, uses }
  }

  // ─── PATTERN 1: SUCCESS FILTERING (SWE-Gym RFT) ──────────────────────────

  /**
   * Keep only traces where all steps succeeded and status is 'completed'.
   * SWE-Gym showed 491 filtered success trajectories → +14% absolute gains.
   */
  filterBySuccess(traceSummaries) {
    return traceSummaries.filter(summary => {
      if (summary.status !== 'completed') return false;
      if (summary.failedSteps > 0) return false;
      if (summary.stepCount === 0) return false;
      return true;
    });
  }

  // ─── PATTERN 2: CONFIDENCE FILTERING (WEBRL) ─────────────────────────────

  /**
   * Score trajectories by execution quality.
   * Filters out:
   * - Trivially easy traces (too fast, too few steps) — bottom percentile
   * - Flailing traces (too many retries, poor time efficiency) — top percentile
   *
   * WEBRL guarantees monotonic policy improvement: V^{π_θ} ≥ V^{π_μ}
   */
  filterByConfidence(traceSummaries) {
    if (traceSummaries.length === 0) return [];

    // Score each trace
    const scored = traceSummaries.map(summary => ({
      ...summary,
      confidenceScore: this._computeConfidenceScore(summary),
    }));

    // Sort by score
    scored.sort((a, b) => a.confidenceScore - b.confidenceScore);

    // Apply confidence window — remove bottom and top percentiles
    const [lowCut, highCut] = this.confidenceWindow;
    const startIdx = Math.floor(scored.length * lowCut);
    const endIdx = Math.ceil(scored.length * highCut);

    return scored.slice(startIdx, endIdx);
  }

  /**
   * Compute a confidence score for a trace.
   * Factors: step efficiency, time efficiency, LLM call ratio, success ratio.
   */
  _computeConfidenceScore(summary) {
    let score = 0;

    // Step efficiency: penalize traces with too many or too few steps
    const stepCount = summary.stepCount || 1;
    if (stepCount >= 2 && stepCount <= 20) {
      score += 0.3; // sweet spot
    } else if (stepCount === 1) {
      score += 0.1; // trivially simple
    } else {
      score += 0.15; // complex but potentially flailing
    }

    // Time efficiency: normalize duration by step count
    const msPerStep = (summary.durationMs || 0) / stepCount;
    if (msPerStep > 100 && msPerStep < 30000) {
      score += 0.3; // reasonable per-step time
    } else if (msPerStep <= 100) {
      score += 0.05; // suspiciously fast (cached?)
    } else {
      score += 0.1; // very slow per step
    }

    // Success ratio
    const totalSteps = (summary.successfulSteps || 0) + (summary.failedSteps || 0);
    const successRatio = totalSteps > 0 ? (summary.successfulSteps || 0) / totalSteps : 0;
    score += successRatio * 0.2;

    // LLM efficiency: fewer LLM calls per step = more deterministic
    const llmRatio = summary.llmCallCount / Math.max(stepCount, 1);
    if (llmRatio <= 2) {
      score += 0.2; // efficient use of LLM
    } else {
      score += 0.1; // over-reliance on LLM
    }

    return score;
  }

  // ─── PATTERN 3: TRAJECTORY-TO-TIPS (March 2026) ──────────────────────────

  /**
   * Extract abstract "tips" with applicability conditions from traces.
   * Combines selective addition with selective deletion for scalable memory.
   *
   * This pattern yields +10% absolute performance gains over naive memory
   * growth (AppWorld benchmark, March 2026).
   */
  extractTips(traceEntries, meta = {}) {
    const tips = [];

    // Extract step-level patterns
    const steps = traceEntries.filter(e => e.type === 'skill_step' || e.type === 'tool_call');
    const llmCalls = traceEntries.filter(e => e.type === 'llm_call');

    // Tip 1: Effective tool sequences
    if (steps.length >= 2) {
      const sequence = steps.map(s => s.tool || s.step).filter(Boolean);
      if (sequence.length >= 2) {
        tips.push({
          tipId: this._tipHash('tool_sequence', sequence.join('→')),
          type: 'tool_sequence',
          content: `When performing ${meta.skillId || meta.source || 'this task'}, use tools in order: ${sequence.join(' → ')}`,
          conditions: {
            applies_when: meta.skillId ? `skill is ${meta.skillId}` : `source is ${meta.source}`,
            step_count: steps.length,
          },
          confidence: 0.7,
          source_trace: meta.traceId || null,
        });
      }
    }

    // Tip 2: LLM prompt patterns that worked
    for (const call of llmCalls) {
      if (call.response && call.prompt) {
        const promptSnippet = (typeof call.prompt === 'string' ? call.prompt : '').slice(0, 200);
        if (promptSnippet.length > 20) {
          tips.push({
            tipId: this._tipHash('prompt_pattern', promptSnippet),
            type: 'prompt_pattern',
            content: `Effective prompt pattern for ${call.model || 'LLM'}: starts with "${promptSnippet.slice(0, 80)}..."`,
            conditions: {
              model: call.model,
              applies_when: `Using ${call.model || 'LLM'} for similar tasks`,
            },
            confidence: 0.6,
            source_trace: meta.traceId || null,
          });
        }
      }
    }

    // Tip 3: Timing patterns
    const totalDuration = traceEntries.find(e => e.type === 'trace_end')?.durationMs || 0;
    if (totalDuration > 0 && steps.length > 0) {
      const avgStepMs = totalDuration / steps.length;
      tips.push({
        tipId: this._tipHash('timing', `${meta.skillId}_${steps.length}_${Math.round(avgStepMs)}`),
        type: 'timing_pattern',
        content: `This task type typically completes in ${steps.length} steps, ~${Math.round(avgStepMs)}ms per step, ~${Math.round(totalDuration)}ms total`,
        conditions: {
          applies_when: meta.skillId ? `skill is ${meta.skillId}` : 'similar tasks',
          step_count_range: [Math.max(1, steps.length - 2), steps.length + 2],
        },
        confidence: 0.5,
        source_trace: meta.traceId || null,
      });
    }

    // Selective addition: only add tips that don't duplicate existing ones
    const newTips = [];
    for (const tip of tips) {
      if (!this.tips.has(tip.tipId)) {
        this.tips.set(tip.tipId, { ...tip, uses: 0, addedAt: Date.now() });
        newTips.push(tip);
      } else {
        // Existing tip — bump confidence slightly
        const existing = this.tips.get(tip.tipId);
        existing.confidence = Math.min(1.0, existing.confidence + 0.05);
        existing.uses++;
      }
    }

    // Selective deletion: remove low-confidence, unused tips when over limit
    if (this.tips.size > this.maxTips) {
      const sorted = Array.from(this.tips.entries())
        .sort((a, b) => (a[1].confidence * (a[1].uses + 1)) - (b[1].confidence * (b[1].uses + 1)));
      const toRemove = sorted.slice(0, this.tips.size - this.maxTips);
      for (const [id] of toRemove) {
        this.tips.delete(id);
      }
    }

    return newTips;
  }

  /**
   * Retrieve tips relevant to a given context.
   */
  retrieveTips(context = {}) {
    const results = [];
    for (const tip of this.tips.values()) {
      let relevance = 0;

      if (context.skillId && tip.conditions?.applies_when?.includes(context.skillId)) {
        relevance += 0.5;
      }
      if (context.source && tip.conditions?.applies_when?.includes(context.source)) {
        relevance += 0.3;
      }
      if (context.model && tip.conditions?.model === context.model) {
        relevance += 0.2;
      }

      if (relevance > 0 || !context.skillId) {
        results.push({ ...tip, relevance });
      }
    }

    return results
      .sort((a, b) => (b.relevance + b.confidence) - (a.relevance + a.confidence))
      .slice(0, 20);
  }

  // ─── COMBINED FILTERING PIPELINE ──────────────────────────────────────────

  /**
   * Run the full filtering pipeline: success → confidence → tips.
   */
  filter(traceSummaries, traceLoader = null) {
    // Step 1: Success filter
    const successes = this.filterBySuccess(traceSummaries);

    // Step 2: Confidence filter
    const confident = this.filterByConfidence(successes);

    // Step 3: Extract tips (if loader provided)
    if (this.tipExtraction && traceLoader) {
      for (const summary of confident) {
        try {
          const entries = traceLoader(summary.traceId);
          this.extractTips(entries, summary);
        } catch (e) { // skip traces that fail to load  logger.error('Operation failed', { error: e.message }); }
      }
    }

    return {
      input: traceSummaries.length,
      afterSuccessFilter: successes.length,
      afterConfidenceFilter: confident.length,
      tipsExtracted: this.tips.size,
      filtered: confident,
    };
  }

  /**
   * Get all stored tips.
   */
  getAllTips() {
    return Array.from(this.tips.values());
  }

  /**
   * Get statistics.
   */
  getStats() {
    return {
      totalTips: this.tips.size,
      maxTips: this.maxTips,
      avgConfidence: this.tips.size > 0
        ? Array.from(this.tips.values()).reduce((s, t) => s + t.confidence, 0) / this.tips.size
        : 0,
      tipsByType: this._groupBy(Array.from(this.tips.values()), 'type'),
    };
  }

  // ─── INTERNALS ────────────────────────────────────────────────────────────

  _tipHash(type, content) {
    return crypto.createHash('sha256')
      .update(`${type}:${content}`)
      .digest('hex')
      .slice(0, 12);
  }

  _groupBy(items, key) {
    const groups = {};
    for (const item of items) {
      const k = item[key] || 'unknown';
      groups[k] = (groups[k] || 0) + 1;
    }
    return groups;
  }
}

module.exports = TrajectoryFilter;
