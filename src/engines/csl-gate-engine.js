'use strict';

const logger = require('../utils/logger') || console;

/**
 * csl-gate-engine.js
 * Continuous Semantic Logic (CSL) Gate Engine.
 *
 * All thresholds and weights are phi-derived via phi-math-v2.
 * This engine provides gating, blending, classification, deduplication,
 * resonance checking, coherence measurement, and drift detection.
 *
 * @module csl-gate-engine
 * @version 2.0.0
 */

const {
const logger = require('../utils/logger');
  PHI,
  PSI,
  PHI_TEMPERATURE,
  CSL_THRESHOLDS,
  DEDUP_THRESHOLD,
  COHERENCE_DRIFT_THRESHOLD,
  sigmoid,
  cslGate,
  cslBlend,
  adaptiveTemperature,
  cosineSimilarity,
  phiFusionWeights,
  phiPriorityScore
} = require('../shared/phi-math.js');

// ─────────────────────────────────────────────────────────────────────────────
// CSLGateEngine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} DriftResult
 * @property {boolean} drifted    - Whether drift exceeded threshold
 * @property {number}  similarity - Raw cosine similarity between current and baseline
 * @property {number}  delta      - 1 - similarity (distance from baseline)
 */

/**
 * @typedef {Object} ScoredCandidate
 * @property {*}      candidate - The original candidate
 * @property {number} score     - Phi-weighted composite score in [0, 1]
 */

/**
 * Continuous Semantic Logic Gate Engine.
 *
 * Provides smooth, phi-derived gating and blending for semantic pipelines.
 * All thresholds default to phi-math-v2 constants but may be overridden per-instance.
 *
 * @class CSLGateEngine
 *
 * @example
 * const engine = new CSLGateEngine();
 * const level = engine.classify(0.85);   // → 'HIGH'
 * const gated = engine.gate(0.9, 0.85);  // → smooth sigmoid output
 */
class CSLGateEngine {
  constructor(config = {}) {
    this.thresholds = Object.assign({}, CSL_THRESHOLDS, config.thresholds || {});
    this.dedupThreshold = config.dedupThreshold !== undefined ? config.dedupThreshold : DEDUP_THRESHOLD;
    this.coherenceDriftThreshold = config.coherenceDriftThreshold !== undefined ? config.coherenceDriftThreshold : COHERENCE_DRIFT_THRESHOLD;
    this.defaultTau = config.defaultTau !== undefined ? config.defaultTau : 1.0;
    this.defaultTemp = config.defaultTemp !== undefined ? config.defaultTemp : PHI_TEMPERATURE;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CORE GATE & BLEND
  // ───────────────────────────────────────────────────────────────────────────

  gate(value, cosScore, options = {}) {
    const tau = options.tau !== undefined ? options.tau : this.defaultTau;
    const temp = options.temp !== undefined ? options.temp : this.defaultTemp;
    return cslGate(value, cosScore, tau, temp);
  }
  blend(weightHigh, weightLow, cosScore, options = {}) {
    const tau = options.tau !== undefined ? options.tau : this.defaultTau;
    const temp = options.temp !== undefined ? options.temp : this.defaultTemp;
    return cslBlend(weightHigh, weightLow, cosScore, tau, temp);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CLASSIFICATION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Classifies a cosine similarity score into a named CSL confidence level.
   *
   * Thresholds (ascending):
   *   MINIMUM (0.500) → LOW (0.691) → MEDIUM (0.809) → HIGH (0.882) → CRITICAL (0.927)
   *
   * @param {number} cosScore - Cosine similarity score in [0, 1]
   * @returns {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'|'MINIMUM'} Classification label
   *
   * @example
   * engine.classify(0.93);  // → 'CRITICAL'
   * engine.classify(0.85);  // → 'HIGH'
   * engine.classify(0.81);  // → 'MEDIUM'
   * engine.classify(0.70);  // → 'LOW'
   * engine.classify(0.50);  // → 'MINIMUM'
   */
  classify(cosScore) {
    const t = this.thresholds;
    if (cosScore >= t.CRITICAL) return 'CRITICAL';
    if (cosScore >= t.HIGH) return 'HIGH';
    if (cosScore >= t.MEDIUM) return 'MEDIUM';
    if (cosScore >= t.LOW) return 'LOW';
    return 'MINIMUM';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RESONANCE CHECK
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Checks whether an intent vector and a swarm vector are in CSL resonance.
   * Resonance is defined as cosine similarity >= the given threshold.
   *
   * @param {number[]} intentVector  - Intent embedding vector
   * @param {number[]} swarmVector   - Swarm/consensus embedding vector
   * @param {number}   [threshold=PSI] - Resonance threshold (default ψ ≈ 0.618)
   * @returns {boolean} True if the vectors are resonant
   *
   * @example
   * engine.isResonant([1,0,1], [0.9,0.1,0.9]); // → likely true
   */
  isResonant(intentVector, swarmVector, threshold = PSI) {
    const sim = cosineSimilarity(intentVector, swarmVector);
    return sim >= threshold;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CANDIDATE SCORING
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Scores an array of candidates using phi-weighted criteria fusion.
   *
   * Each criterion specifies how to extract a score from a candidate.
   * Criteria are weighted using phi-geometric series (first criterion is most important).
   *
   * @param {Array<*>}  candidates - Array of items to score
   * @param {Array<{name: string, fn: function(*): number}>} criteria
   *   - Array of criterion objects with a scoring function `fn(candidate) → [0,1]`
   *   - Ordered by importance (highest weight first)
   * @returns {ScoredCandidate[]} Array of { candidate, score } sorted descending by score
   *
   * @example
   * const results = engine.scoreCandidates(items, [
   *   { name: 'relevance', fn: item => item.relevanceScore },
   *   { name: 'recency',   fn: item => item.recencyScore },
   * ]);
   */
  scoreCandidates(candidates, criteria) {
    if (!candidates || candidates.length === 0) return [];
    if (!criteria || criteria.length === 0) return candidates.map(c => ({
      candidate: c,
      score: 0
    }));
    const weights = phiFusionWeights(criteria.length);
    const scored = candidates.map(candidate => {
      const factorScores = criteria.map(c => {
        const raw = c.fn(candidate);
        return Math.max(0, Math.min(1, raw));
      });
      const score = factorScores.reduce((acc, s, i) => acc + s * weights[i], 0);
      return {
        candidate,
        score
      };
    });
    return scored.sort((a, b) => b.score - a.score);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SEMANTIC DEDUPLICATION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Performs semantic deduplication on an array of items using their embeddings.
   * Items whose embedding cosine similarity exceeds the threshold are considered duplicates;
   * only the first occurrence is retained.
   *
   * @param {Array<*>}        items      - Items to deduplicate (parallel to `embeddings`)
   * @param {Array<number[]>} embeddings - Embedding vectors for each item
   * @param {number}          [threshold=DEDUP_THRESHOLD] - Similarity threshold (≈ 0.972)
   * @returns {Array<*>} Deduplicated items array
   *
   * @example
   * const unique = engine.dedup(documents, documentEmbeddings);
   */
  dedup(items, embeddings, threshold = this.dedupThreshold) {
    if (!items || items.length === 0) return [];
    const kept = [];
    const keptEmbeddings = [];
    for (let i = 0; i < items.length; i++) {
      const emb = embeddings[i];
      let isDuplicate = false;
      for (const keptEmb of keptEmbeddings) {
        if (cosineSimilarity(emb, keptEmb) >= threshold) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        kept.push(items[i]);
        keptEmbeddings.push(emb);
      }
    }
    return kept;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ADAPTIVE GATE
  // ───────────────────────────────────────────────────────────────────────────

  adaptiveGate(value, cosScore, entropy, maxEntropy) {
    const temp = adaptiveTemperature(entropy, maxEntropy);
    return cslGate(value, cosScore, this.defaultTau, temp);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BATCH GATE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Batch-processes parallel arrays of values and cosine scores through the gate.
   *
   * @param {number[]} values    - Array of raw input values
   * @param {number[]} cosScores - Parallel array of cosine similarity scores
   * @param {number}   [tau]     - Optional tau override for this batch
   * @returns {number[]} Array of gated outputs in (0, 1)
   * @throws {Error} If arrays have different lengths
   *
   * @example
   * const outputs = engine.batchGate([0.9, 0.7, 0.5], [0.85, 0.70, 0.55]);
   */
  batchGate(values, cosScores, tau) {
    if (values.length !== cosScores.length) {
      throw new Error(`batchGate: values (${values.length}) and cosScores (${cosScores.length}) must have equal length`);
    }
    const t = tau !== undefined ? tau : this.defaultTau;
    return values.map((v, i) => cslGate(v, cosScores[i], t, this.defaultTemp));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GATE CHAIN
  // ───────────────────────────────────────────────────────────────────────────

  createGateChain(stages) {
    const engine = this;
    return function runChain(initialValue) {
      let current = initialValue;
      const stageOutputs = [];
      let terminated = false;
      for (const stage of stages) {
        const tau = stage.tau !== undefined ? stage.tau : engine.defaultTau;
        const temp = stage.temp !== undefined ? stage.temp : engine.defaultTemp;
        const cos = typeof stage.cosScore === 'function' ? stage.cosScore(current) : stage.cosScore;
        current = cslGate(current, cos, tau, temp);
        stageOutputs.push(current);
        if (current < engine.thresholds.MINIMUM) {
          terminated = true;
          break;
        }
      }
      return {
        output: current,
        stages: stageOutputs,
        terminated
      };
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COHERENCE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Computes the average pairwise cosine similarity of a set of embeddings.
   * Higher coherence (→1.0) means the embeddings are tightly clustered.
   * Returns 1.0 for single-embedding sets (trivially coherent).
   *
   * @param {Array<number[]>} embeddings - Array of embedding vectors
   * @returns {number} Average pairwise cosine similarity in [-1, 1]
   *
   * @example
   * const coherence = engine.computeCoherence([embA, embB, embC]);
   */
  computeCoherence(embeddings) {
    if (!embeddings || embeddings.length === 0) return 0;
    if (embeddings.length === 1) return 1;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        sum += cosineSimilarity(embeddings[i], embeddings[j]);
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DRIFT DETECTION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Detects semantic drift between a current embedding and a baseline embedding.
   * Drift is detected when similarity drops below the given threshold.
   *
   * @param {number[]} current   - Current state embedding
   * @param {number[]} baseline  - Baseline reference embedding
   * @param {number}   [threshold=COHERENCE_DRIFT_THRESHOLD] - Minimum similarity to remain non-drifted (≈ 0.809)
   * @returns {DriftResult} Object with { drifted, similarity, delta }
   *
   * @example
   * const { drifted, similarity, delta } = engine.detectDrift(currentEmb, baselineEmb);
   * if (drifted) logger.info(`Drift detected: delta=${delta.toFixed(3)}`);
   */
  detectDrift(current, baseline, threshold = this.coherenceDriftThreshold) {
    const similarity = cosineSimilarity(current, baseline);
    const delta = 1 - similarity;
    return {
      drifted: similarity < threshold,
      similarity,
      delta
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = CSLGateEngine;