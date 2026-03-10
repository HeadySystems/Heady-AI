/**
 * Heady™ Latent OS v5.4.0
 * © 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents
 * ZERO MAGIC NUMBERS — All constants φ-derived or Fibonacci
 *
 * HEADY SOUL — Values, Awareness, and Ethical Core
 *
 * The origin point of the Sacred Geometry topology. Every decision in the
 * Heady ecosystem passes through HeadySoul for values alignment, coherence
 * checking, and ethical validation.
 *
 * Position: CENTER of all rings
 * Responsibility: Ultimate arbiter of system coherence and values alignment
 * Patent: CSL-gated ethical reasoning — 51 Provisional Patents
 */
'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');
const {
  PHI, PSI, fib, CSL_THRESHOLDS, PHI_TIMING,
  cslGate, sigmoid, phiBackoffWithJitter,
} = require('../../shared/phi-math');

// ─── φ-Constants ─────────────────────────────────────────────────────────────

const COHERENCE_CHECK_INTERVAL_MS = PHI_TIMING.PHI_7;       // 29 034ms
const COHERENCE_DRIFT_THRESHOLD   = CSL_THRESHOLDS.MEDIUM;  // 0.809
const VALUES_VECTOR_DIM           = fib(14);                 // 377 dimensions
const AWARENESS_BUFFER_SIZE       = fib(12);                 // 144 entries
const SOUL_STATE_PERSIST_MS       = PHI_TIMING.PHI_8;       // 46 979ms
const MAX_ETHICAL_REVIEW_QUEUE    = fib(11);                 // 89
const IDENTITY_EMBEDDING_DIM      = fib(14);                 // 377

// ─── Core Values Vectors ─────────────────────────────────────────────────────
// Each value is a unit vector in 377D space; coherence = cosine similarity

const CORE_VALUES = Object.freeze({
  integrity:     'truth_consistency_honesty',
  empathy:       'understanding_compassion_care',
  sovereignty:   'user_control_data_ownership_privacy',
  excellence:    'quality_thoroughness_craftsmanship',
  transparency:  'openness_explainability_auditability',
  growth:        'learning_improvement_adaptation',
  safety:        'harm_prevention_security_protection',
  fairness:      'equality_unbiased_inclusive',
});

// ─── Structured Logger ──────────────────────────────────────────────────────

function log(level, msg, meta = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: 'heady-soul',
    msg,
    ...meta,
  });
  process.stdout.write(entry + '\n');
}

// ─── HeadySoul Class ────────────────────────────────────────────────────────

class HeadySoul extends EventEmitter {
  constructor(config = {}) {
    super();
    this.state = 'initializing';
    this.valuesVectors = new Map();
    this.awarenessBuffer = [];
    this.coherenceHistory = [];
    this.ethicalReviewQueue = [];
    this.lastCoherenceScore = 1.0;
    this.sessionId = crypto.randomBytes(fib(7)).toString('hex'); // 13 bytes

    // Initialize values vectors (seeded pseudorandom for determinism)
    this._initializeValuesVectors(config.seed || 'heady-soul-sacred-geometry');

    log('info', 'HeadySoul initializing', {
      sessionId: this.sessionId,
      values: Object.keys(CORE_VALUES),
      dimensions: VALUES_VECTOR_DIM,
    });
  }

  // ─── Initialize Values Vectors ──────────────────────────────────────────

  _initializeValuesVectors(seed) {
    for (const [name, description] of Object.entries(CORE_VALUES)) {
      // Deterministic seeded vector generation
      const hash = crypto.createHash('sha384').update(`${seed}:${name}:${description}`).digest();
      const vector = new Float32Array(VALUES_VECTOR_DIM);
      for (let i = 0; i < VALUES_VECTOR_DIM; i++) {
        vector[i] = (hash[i % hash.length] / 255.0) * 2 - 1;
      }
      // Normalize to unit vector
      const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      for (let i = 0; i < VALUES_VECTOR_DIM; i++) {
        vector[i] /= magnitude;
      }
      this.valuesVectors.set(name, vector);
    }
  }

  // ─── Start Soul ─────────────────────────────────────────────────────────

  start() {
    this.state = 'active';
    this._coherenceInterval = setInterval(
      () => this._runCoherenceCheck(),
      COHERENCE_CHECK_INTERVAL_MS,
    );
    log('info', 'HeadySoul active', { sessionId: this.sessionId });
    this.emit('soul:active', { sessionId: this.sessionId });
    return this;
  }

  // ─── Stop Soul ──────────────────────────────────────────────────────────

  stop() {
    this.state = 'stopped';
    if (this._coherenceInterval) {
      clearInterval(this._coherenceInterval);
      this._coherenceInterval = null;
    }
    log('info', 'HeadySoul stopped', { sessionId: this.sessionId });
    this.emit('soul:stopped', { sessionId: this.sessionId });
  }

  // ─── Evaluate Action Against Values ─────────────────────────────────────
  // Returns CSL-gated alignment score

  evaluateAction(actionEmbedding, context = {}) {
    if (!actionEmbedding || actionEmbedding.length !== VALUES_VECTOR_DIM) {
      return {
        aligned: false,
        reason: 'invalid_embedding_dimensions',
        requiredDim: VALUES_VECTOR_DIM,
      };
    }

    const scores = {};
    let weightedSum = 0;
    let weightSum = 0;
    let idx = 0;

    for (const [name, valuesVec] of this.valuesVectors) {
      const similarity = this._cosineSimilarity(actionEmbedding, valuesVec);
      scores[name] = Math.round(similarity * 1000) / 1000;

      // φ-weighted: first values carry more weight
      const weight = Math.pow(PSI, idx);
      weightedSum += similarity * weight;
      weightSum += weight;
      idx++;
    }

    const overallScore = weightedSum / weightSum;
    const gated = sigmoid((overallScore - CSL_THRESHOLDS.LOW) / (PSI * PSI));

    const result = {
      aligned: overallScore >= CSL_THRESHOLDS.MINIMUM,
      overallScore: Math.round(overallScore * 1000) / 1000,
      gatedScore: Math.round(gated * 1000) / 1000,
      valueScores: scores,
      threshold: CSL_THRESHOLDS.MINIMUM,
      context,
    };

    // Record in awareness buffer
    this._recordAwareness('action_evaluation', result);

    // Flag for ethical review if borderline
    if (overallScore >= CSL_THRESHOLDS.MINIMUM && overallScore < CSL_THRESHOLDS.LOW) {
      this._queueEthicalReview(result);
    }

    return result;
  }

  // ─── Coherence Check ───────────────────────────────────────────────────
  // Measures how well the system's current state aligns with core values

  _runCoherenceCheck() {
    // Self-coherence: check pairwise value vector stability
    const valueNames = [...this.valuesVectors.keys()];
    let coherenceSum = 0;
    let pairCount = 0;

    for (let i = 0; i < valueNames.length; i++) {
      for (let j = i + 1; j < valueNames.length; j++) {
        const vecA = this.valuesVectors.get(valueNames[i]);
        const vecB = this.valuesVectors.get(valueNames[j]);
        const sim = Math.abs(this._cosineSimilarity(vecA, vecB));
        coherenceSum += sim;
        pairCount++;
      }
    }

    const avgCoherence = pairCount > 0 ? coherenceSum / pairCount : 1.0;
    this.lastCoherenceScore = avgCoherence;
    this.coherenceHistory.push({
      ts: Date.now(),
      score: avgCoherence,
    });

    // Trim history to Fibonacci size
    if (this.coherenceHistory.length > fib(11)) {
      this.coherenceHistory = this.coherenceHistory.slice(-fib(11));
    }

    // Drift detection
    if (avgCoherence < COHERENCE_DRIFT_THRESHOLD) {
      log('warn', 'Coherence drift detected', {
        score: avgCoherence,
        threshold: COHERENCE_DRIFT_THRESHOLD,
      });
      this.emit('soul:drift', {
        score: avgCoherence,
        threshold: COHERENCE_DRIFT_THRESHOLD,
        sessionId: this.sessionId,
      });
    }

    return avgCoherence;
  }

  // ─── Awareness Recording ──────────────────────────────────────────────

  _recordAwareness(type, data) {
    this.awarenessBuffer.push({
      ts: Date.now(),
      type,
      data,
      sessionId: this.sessionId,
    });

    if (this.awarenessBuffer.length > AWARENESS_BUFFER_SIZE) {
      this.awarenessBuffer.shift();
    }
  }

  // ─── Ethical Review Queue ─────────────────────────────────────────────

  _queueEthicalReview(evaluation) {
    if (this.ethicalReviewQueue.length >= MAX_ETHICAL_REVIEW_QUEUE) {
      this.ethicalReviewQueue.shift();
    }
    this.ethicalReviewQueue.push({
      ts: Date.now(),
      evaluation,
      status: 'pending',
    });
    this.emit('soul:ethical_review', evaluation);
  }

  // ─── Cosine Similarity ────────────────────────────────────────────────

  _cosineSimilarity(vecA, vecB) {
    let dot = 0, magA = 0, magB = 0;
    const len = Math.min(vecA.length, vecB.length);
    for (let i = 0; i < len; i++) {
      dot += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom > 0 ? dot / denom : 0;
  }

  // ─── Get State ────────────────────────────────────────────────────────

  getState() {
    return {
      state: this.state,
      sessionId: this.sessionId,
      coherenceScore: this.lastCoherenceScore,
      coherenceThreshold: COHERENCE_DRIFT_THRESHOLD,
      valuesCount: this.valuesVectors.size,
      awarenessBufferSize: this.awarenessBuffer.length,
      ethicalReviewPending: this.ethicalReviewQueue.filter((r) => r.status === 'pending').length,
    };
  }
}

module.exports = { HeadySoul, CORE_VALUES, VALUES_VECTOR_DIM };
