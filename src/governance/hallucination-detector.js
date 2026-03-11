/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ HALLUCINATION DETECTOR — AI Output Verification          ║
 * ║  Detects when AI output contradicts known facts in memory        ║
 * ║  © 2024-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

import { PHI, PSI, fib, CSL_THRESHOLDS } from '../../shared/phi-math.js';
import { cslAND } from '../../shared/csl-engine.js';

/** Contradiction threshold — below this means potential hallucination */
const CONTRADICTION_THRESHOLD = CSL_THRESHOLDS.MINIMUM; // 0.500

/** Consistency threshold — above this means confirmed factual */
const CONSISTENCY_THRESHOLD = CSL_THRESHOLDS.MEDIUM; // 0.809

/**
 * HallucinationDetector — compares AI output against known facts
 * in vector memory to detect contradictions and unsupported claims.
 */
export class HallucinationDetector {
  constructor({ vectorMemory, embedFn, telemetry = null }) {
    /** @private */ this._vectorMemory = vectorMemory;
    /** @private */ this._embedFn = embedFn;
    /** @private */ this._telemetry = telemetry;
    /** @private */ this._totalChecks = 0;
    /** @private */ this._hallucinations = 0;
  }

  /**
   * Check an AI output for hallucinations.
   * @param {string} output - AI-generated text
   * @returns {Promise<Object>} { isHallucination, confidence, contradictions, supported }
   */
  async check(output) {
    this._totalChecks++;
    const outputEmbedding = await this._embedFn(output);

    // Search for related facts in memory
    const relatedFacts = await this._vectorMemory.search(output, {
      limit: fib(7), // 13 related facts
      minScore: CONTRADICTION_THRESHOLD,
    });

    const contradictions = [];
    const supported = [];

    for (const fact of relatedFacts) {
      const similarity = cslAND(outputEmbedding, fact.entry.embedding);

      if (similarity < CONTRADICTION_THRESHOLD) {
        contradictions.push({
          fact: fact.entry.content.slice(0, 200),
          similarity,
          type: 'contradiction',
        });
      } else if (similarity >= CONSISTENCY_THRESHOLD) {
        supported.push({
          fact: fact.entry.content.slice(0, 200),
          similarity,
          type: 'supported',
        });
      }
    }

    const isHallucination = contradictions.length > 0 && supported.length === 0;
    if (isHallucination) this._hallucinations++;

    return {
      isHallucination,
      confidence: isHallucination ? 1 - (supported.length / (contradictions.length + supported.length + 1)) : 0,
      contradictions,
      supported,
      relatedFactsChecked: relatedFacts.length,
    };
  }

  getStats() {
    return {
      totalChecks: this._totalChecks,
      hallucinationsDetected: this._hallucinations,
      hallucinationRate: this._totalChecks === 0 ? 0 : this._hallucinations / this._totalChecks,
    };
  }
}

export { CONTRADICTION_THRESHOLD, CONSISTENCY_THRESHOLD };
export default HallucinationDetector;
