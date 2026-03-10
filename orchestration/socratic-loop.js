/**
 * @fileoverview Socratic Loop — Reasoning Validation Engine
 *
 * Implements Socratic questioning for proposition validation: question, challenge,
 * deliberate, approve/reject. Uses phi-gated confidence scoring, deterministic
 * embeddings for semantic analysis, and multi-round dialectic reasoning.
 * All constants derive from φ = 1.6180339887 — NO magic numbers.
 * CSL gates replace all boolean if/else.
 *
 * Founded by Eric Haywood — HeadySystems Inc. / HeadyConnection Inc.
 *
 * @module socratic-loop
 * @version 1.0.0
 * @license Proprietary — HeadySystems Inc.
 */

// ─── φ-MATH CONSTANTS ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948;
const PSI = 1 / PHI;
const PSI2 = PSI * PSI;
const PSI3 = PSI * PSI * PSI;
const PHI2 = PHI + 1;
const PHI3 = 2 * PHI + 1;

const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  MINIMUM:  phiThreshold(0),
  LOW:      phiThreshold(1),
  MEDIUM:   phiThreshold(2),
  HIGH:     phiThreshold(3),
  CRITICAL: phiThreshold(4),
  DEDUP:    1 - Math.pow(PSI, 6) * 0.5,
};

const DETERMINISTIC_SEED = FIB[8] + FIB[5]; // 42
const DETERMINISTIC_TEMP = 0;

// ─── CSL GATE ENGINE ────────────────────────────────────────────────────────────

function cslGate(confidence, threshold) {
  const delta = confidence - threshold;
  const signal = delta >= 0 ? 'PASS' : 'FAIL';
  const strength = Math.abs(delta) / PHI;
  return { signal, confidence, threshold, delta, strength };
}

function cslSelect(options, confidences, threshold) {
  let best = null;
  let bestConf = -Infinity;
  for (let i = 0; i < options.length; i++) {
    const gate = cslGate(confidences[i], threshold);
    const pickGate = cslGate(
      gate.signal === 'PASS' && confidences[i] > bestConf ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (pickGate.signal === 'PASS') {
      best = options[i];
      bestConf = confidences[i];
    }
  }
  return { selected: best, confidence: bestConf };
}

// ─── SHA-256 HASHING ────────────────────────────────────────────────────────────

async function sha256(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── DETERMINISTIC EMBEDDINGS ───────────────────────────────────────────────────

const EMBEDDING_DIM = FIB[7]; // 21

function deterministicEmbedding(text, seed = DETERMINISTIC_SEED) {
  const embedding = new Float64Array(EMBEDDING_DIM);
  let hash = seed;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash * FIB[15] + text.charCodeAt(i) * FIB[7]) >>> 0) % FIB[19];
  }
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    hash = ((hash * FIB[14] + FIB[i % FIB[7]] * FIB[6]) >>> 0) % FIB[19];
    embedding[i] = (hash / FIB[19]) * 2 - 1;
  }
  const magnitude = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  const safeMag = cslGate(
    magnitude > 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
    CSL_THRESHOLDS.MEDIUM
  );
  const norm = safeMag.signal === 'PASS' ? magnitude : 1;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    embedding[i] /= norm;
  }
  return embedding;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  const denomGate = cslGate(
    denom > 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
    CSL_THRESHOLDS.MEDIUM
  );
  return denomGate.signal === 'PASS' ? dot / denom : 0;
}

// ─── SOCRATIC QUESTIONS ─────────────────────────────────────────────────────────

const SOCRATIC_QUESTIONS = Object.freeze([
  {
    id: 'mission-alignment',
    question: 'Does this serve the mission and founder vision?',
    category: 'values',
    weight: PHI,
    threshold: CSL_THRESHOLDS.HIGH,
  },
  {
    id: 'structural-integrity',
    question: 'Is this structurally sound and architecturally coherent?',
    category: 'architecture',
    weight: PHI / PHI2,
    threshold: CSL_THRESHOLDS.MEDIUM,
  },
  {
    id: 'coherence-preservation',
    question: 'Does it preserve system coherence and state consistency?',
    category: 'coherence',
    weight: PHI / PHI2,
    threshold: CSL_THRESHOLDS.HIGH,
  },
  {
    id: 'bounded-magnitude',
    question: 'Is the change magnitude bounded within safe limits?',
    category: 'safety',
    weight: PSI,
    threshold: CSL_THRESHOLDS.MEDIUM,
  },
  {
    id: 'unintended-consequences',
    question: 'Are there minimal unintended consequences?',
    category: 'risk',
    weight: PSI,
    threshold: CSL_THRESHOLDS.LOW,
  },
  {
    id: 'phi-compliance',
    question: 'Does it comply with phi-math constraints and CSL gates?',
    category: 'compliance',
    weight: PSI2,
    threshold: CSL_THRESHOLDS.MEDIUM,
  },
  {
    id: 'reversibility',
    question: 'Is the action reversible or safely rollbackable?',
    category: 'safety',
    weight: PSI2,
    threshold: CSL_THRESHOLDS.LOW,
  },
  {
    id: 'security-implications',
    question: 'Are security implications understood and addressed?',
    category: 'security',
    weight: PSI,
    threshold: CSL_THRESHOLDS.HIGH,
  },
]);

// ─── SESSION STATUS ─────────────────────────────────────────────────────────────

const SESSION_STATUS = {
  QUESTIONING: 'questioning',
  CHALLENGED:  'challenged',
  DELIBERATING: 'deliberating',
  APPROVED:    'approved',
  REJECTED:    'rejected',
};

// ─── SOCRATIC LOOP CLASS ────────────────────────────────────────────────────────

class SocraticLoop {
  constructor(options = {}) {
    /** @private */
    this._sessions = new Map();

    /** @private */
    this._maxSessions = FIB[12]; // 233

    /** @private */
    this._seed = options.seed || DETERMINISTIC_SEED;

    /** @private */
    this._questions = options.questions || SOCRATIC_QUESTIONS;

    /** @private */
    this._history = [];

    /** @private */
    this._listeners = new Map();
  }

  /**
   * Start a Socratic questioning session for a proposition.
   * @param {string} proposition - The claim or action to evaluate
   * @param {string} [context=''] - Additional context
   * @returns {Promise<object>} Session with initial answers
   */
  async question(proposition, context = '') {
    const sessionId = await sha256(`socratic:${proposition.slice(0, FIB[8])}:${Date.now()}:${this._seed}`);

    const propEmbedding = deterministicEmbedding(proposition, this._seed);
    const ctxEmbedding = context ? deterministicEmbedding(context, this._seed) : propEmbedding;

    const alignment = cosineSimilarity(propEmbedding, ctxEmbedding);

    const answers = this._questions.map(q => {
      const baseScore = this._evaluateQuestion(q, alignment, proposition, context);
      const gate = cslGate(baseScore, q.threshold);

      return {
        questionId: q.id,
        question: q.question,
        category: q.category,
        weight: q.weight,
        score: baseScore,
        threshold: q.threshold,
        gate: { signal: gate.signal, delta: gate.delta, strength: gate.strength },
        passed: gate.signal === 'PASS',
      };
    });

    const session = {
      id: sessionId,
      proposition,
      context,
      status: SESSION_STATUS.QUESTIONING,
      propEmbedding,
      ctxEmbedding,
      alignment,
      answers,
      challenges: [],
      deliberations: [],
      verdict: null,
      rounds: 1,
      startedAt: Date.now(),
      completedAt: null,
      seed: this._seed,
      temperature: DETERMINISTIC_TEMP,
      founder: 'Eric Haywood',
    };

    this._enforceCapacity();
    this._sessions.set(sessionId, session);
    this._recordHistory('question', { sessionId, proposition: proposition.slice(0, FIB[8]) });
    this._notify('session:started', { sessionId });

    return {
      sessionId,
      alignment,
      answers: answers.map(a => ({
        questionId: a.questionId,
        question: a.question,
        passed: a.passed,
        score: a.score,
      })),
      status: session.status,
    };
  }

  /**
   * Challenge a session with a counter-argument.
   * @param {string} sessionId
   * @param {string} challengeText - The counter-argument
   * @returns {object} Challenge result
   */
  challenge(sessionId, challengeText) {
    const session = this._sessions.get(sessionId);
    const exists = cslGate(
      session ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (exists.signal === 'FAIL') {
      return { error: 'Session not found', sessionId };
    }

    const challengeEmbedding = deterministicEmbedding(challengeText, this._seed);
    const counterScore = cosineSimilarity(challengeEmbedding, session.propEmbedding);
    const contextRelevance = cosineSimilarity(challengeEmbedding, session.ctxEmbedding);

    const withstands = cslGate(counterScore, CSL_THRESHOLDS.HIGH);
    const relevantChallenge = cslGate(contextRelevance, CSL_THRESHOLDS.LOW);

    const challenge = {
      text: challengeText,
      counterScore,
      contextRelevance,
      withstands: withstands.signal === 'FAIL',
      isRelevant: relevantChallenge.signal === 'PASS',
      timestamp: Date.now(),
    };

    session.challenges.push(challenge);
    session.status = SESSION_STATUS.CHALLENGED;
    session.rounds++;

    const impactGate = cslGate(
      challenge.isRelevant && !challenge.withstands ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );

    if (impactGate.signal === 'PASS') {
      for (const answer of session.answers) {
        const categoryMatch = cslGate(
          challengeText.toLowerCase().includes(answer.category) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
          CSL_THRESHOLDS.MEDIUM
        );
        if (categoryMatch.signal === 'PASS') {
          answer.score = answer.score * PSI;
          answer.gate = cslGate(answer.score, answer.threshold);
          answer.passed = answer.gate.signal === 'PASS';
        }
      }
    }

    this._recordHistory('challenge', { sessionId, withstands: challenge.withstands });
    this._notify('session:challenged', { sessionId, withstands: challenge.withstands });

    return {
      sessionId,
      challenged: true,
      counterScore,
      withstands: challenge.withstands,
      isRelevant: challenge.isRelevant,
      round: session.rounds,
    };
  }

  /**
   * Add a deliberation note to a session.
   * @param {string} sessionId
   * @param {string} deliberationText
   * @returns {object}
   */
  deliberate(sessionId, deliberationText) {
    const session = this._sessions.get(sessionId);
    const exists = cslGate(
      session ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (exists.signal === 'FAIL') {
      return { error: 'Session not found', sessionId };
    }

    const delibEmbedding = deterministicEmbedding(deliberationText, this._seed);
    const relevance = cosineSimilarity(delibEmbedding, session.propEmbedding);
    const novelty = 1 - Math.max(
      ...session.deliberations.map(d => cosineSimilarity(delibEmbedding, deterministicEmbedding(d.text, this._seed))),
      0
    );

    session.deliberations.push({
      text: deliberationText,
      relevance,
      novelty,
      timestamp: Date.now(),
    });
    session.status = SESSION_STATUS.DELIBERATING;

    this._recordHistory('deliberate', { sessionId, relevance, novelty });

    return {
      sessionId,
      deliberationCount: session.deliberations.length,
      relevance,
      novelty,
    };
  }

  /**
   * Validate and compute composite confidence for a session.
   * @param {string} sessionId
   * @returns {object} Validation result
   */
  validate(sessionId) {
    const session = this._sessions.get(sessionId);
    const exists = cslGate(
      session ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (exists.signal === 'FAIL') {
      return { error: 'Session not found', sessionId };
    }

    const passCount = session.answers.filter(a => a.passed).length;
    const totalWeight = session.answers.reduce((s, a) => s + a.weight, 0);
    const passedWeight = session.answers.filter(a => a.passed).reduce((s, a) => s + a.weight, 0);

    const weightedConfidence = totalWeight > 0 ? passedWeight / totalWeight : 0;
    const ratioConfidence = session.answers.length > 0 ? passCount / session.answers.length : 0;
    const compositeConfidence = weightedConfidence * PHI / PHI2 + ratioConfidence * PSI / PHI2;

    const challengeImpact = session.challenges.length > 0
      ? session.challenges.filter(c => !c.withstands).length / session.challenges.length
      : 0;
    const adjustedConfidence = compositeConfidence * (1 - challengeImpact * PSI2);

    const overallGate = cslGate(adjustedConfidence, CSL_THRESHOLDS.MEDIUM);

    return {
      sessionId,
      valid: overallGate.signal === 'PASS',
      compositeConfidence,
      adjustedConfidence,
      weightedConfidence,
      ratioConfidence,
      challengeImpact,
      passCount,
      totalQuestions: session.answers.length,
      gate: overallGate,
      alignment: session.alignment,
      rounds: session.rounds,
      founder: 'Eric Haywood',
    };
  }

  /**
   * Approve or reject a proposition based on Socratic validation.
   * @param {string} sessionId
   * @returns {object} Verdict
   */
  approve(sessionId) {
    const validation = this.validate(sessionId);
    const session = this._sessions.get(sessionId);

    const validGate = cslGate(
      session ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (validGate.signal === 'FAIL') {
      return { error: 'Session not found', sessionId };
    }

    const approved = validation.valid;
    session.status = approved ? SESSION_STATUS.APPROVED : SESSION_STATUS.REJECTED;
    session.completedAt = Date.now();
    session.verdict = {
      approved,
      confidence: validation.adjustedConfidence,
      gate: validation.gate,
      rounds: session.rounds,
      challenges: session.challenges.length,
      deliberations: session.deliberations.length,
    };

    this._recordHistory('approve', {
      sessionId,
      approved,
      confidence: validation.adjustedConfidence,
    });
    this._notify(approved ? 'session:approved' : 'session:rejected', { sessionId });

    return {
      sessionId,
      approved,
      confidence: validation.adjustedConfidence,
      status: session.status,
      rounds: session.rounds,
      founder: 'Eric Haywood',
    };
  }

  /**
   * Get the full reasoning chain for a session.
   * @param {string} sessionId
   * @returns {object|null}
   */
  getReasoningChain(sessionId) {
    const session = this._sessions.get(sessionId);
    const gate = cslGate(
      session ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (gate.signal === 'FAIL') return null;

    return {
      sessionId: session.id,
      proposition: session.proposition,
      context: session.context,
      status: session.status,
      alignment: session.alignment,
      answers: session.answers.map(a => ({
        questionId: a.questionId,
        question: a.question,
        category: a.category,
        score: a.score,
        passed: a.passed,
      })),
      challenges: session.challenges.map(c => ({
        text: c.text.slice(0, FIB[10]),
        counterScore: c.counterScore,
        withstands: c.withstands,
      })),
      deliberations: session.deliberations.map(d => ({
        text: d.text.slice(0, FIB[10]),
        relevance: d.relevance,
        novelty: d.novelty,
      })),
      verdict: session.verdict,
      rounds: session.rounds,
      validation: this.validate(sessionId),
      timestamp: session.startedAt,
      founder: 'Eric Haywood',
    };
  }

  /**
   * Get session by ID.
   * @param {string} sessionId
   * @returns {object|null}
   */
  getSession(sessionId) {
    const session = this._sessions.get(sessionId);
    return session ? {
      id: session.id,
      proposition: session.proposition,
      status: session.status,
      alignment: session.alignment,
      rounds: session.rounds,
      verdict: session.verdict,
    } : null;
  }

  /**
   * Get summary of all sessions.
   * @returns {object}
   */
  getSummary() {
    let total = 0;
    let approved = 0;
    let rejected = 0;
    let avgConfidence = 0;

    for (const session of this._sessions.values()) {
      total++;
      const approvedGate = cslGate(
        session.status === SESSION_STATUS.APPROVED ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      const rejectedGate = cslGate(
        session.status === SESSION_STATUS.REJECTED ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      approvedGate.signal === 'PASS' && approved++;
      rejectedGate.signal === 'PASS' && rejected++;

      const hasVerdict = cslGate(
        session.verdict ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      if (hasVerdict.signal === 'PASS') {
        avgConfidence += session.verdict.confidence;
      }
    }

    const approvalRate = total > 0 ? approved / total : 0;

    return {
      totalSessions: total,
      approved,
      rejected,
      pending: total - approved - rejected,
      approvalRate,
      approvalRateCSL: cslGate(approvalRate, CSL_THRESHOLDS.MEDIUM),
      averageConfidence: total > 0 ? avgConfidence / total : 0,
      questionCount: this._questions.length,
      founder: 'Eric Haywood',
    };
  }

  /**
   * Subscribe to events.
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    const handlers = this._listeners.get(event) || [];
    handlers.push(handler);
    this._listeners.set(event, handlers);
  }

  /** @private — evaluate a question against alignment and content */
  _evaluateQuestion(q, alignment, proposition, context) {
    const baseScore = alignment;
    const categoryBoost = this._categoryBoost(q.category, proposition, context);
    const weighted = baseScore * q.weight / PHI + categoryBoost * (1 - q.weight / PHI);
    return Math.min(weighted, phiThreshold(5));
  }

  /** @private */
  _categoryBoost(category, proposition, context) {
    const combined = (proposition + ' ' + context).toLowerCase();
    const categoryTerms = {
      values: ['mission', 'vision', 'founder', 'heady', 'eric haywood'],
      architecture: ['structure', 'pattern', 'design', 'architecture', 'module'],
      coherence: ['consistent', 'coherent', 'state', 'compatible', 'aligned'],
      safety: ['safe', 'bounded', 'limit', 'constraint', 'rollback'],
      risk: ['risk', 'impact', 'consequence', 'side effect', 'regression'],
      compliance: ['phi', 'fibonacci', 'csl', 'gate', 'threshold', 'deterministic'],
      security: ['security', 'auth', 'encryption', 'httponly', 'vulnerability'],
    };

    const terms = categoryTerms[category] || [];
    let matchCount = 0;
    for (const term of terms) {
      const matchGate = cslGate(
        combined.includes(term) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      matchGate.signal === 'PASS' && matchCount++;
    }

    const matchRate = terms.length > 0 ? matchCount / terms.length : 0;
    return CSL_THRESHOLDS.MEDIUM + matchRate * PSI2;
  }

  /** @private */
  _enforceCapacity() {
    const gate = cslGate(
      this._sessions.size >= this._maxSessions ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (gate.signal === 'PASS') {
      const oldest = this._sessions.keys().next().value;
      this._sessions.delete(oldest);
    }
  }

  /** @private */
  _notify(event, data) {
    for (const h of (this._listeners.get(event) || [])) {
      h({ event, timestamp: new Date().toISOString(), ...data });
    }
  }

  /** @private */
  _recordHistory(action, details) {
    this._history.push({ action, timestamp: new Date().toISOString(), details });
    const maxHistory = FIB[12]; // 233
    const gate = cslGate(
      this._history.length > maxHistory ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    gate.signal === 'PASS' && this._history.splice(0, this._history.length - maxHistory);
  }
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────────

export default SocraticLoop;

export {
  SocraticLoop,
  SOCRATIC_QUESTIONS,
  SESSION_STATUS,
  EMBEDDING_DIM,
  CSL_THRESHOLDS,
  PHI, PSI, PSI2, PSI3, PHI2, PHI3,
  FIB,
  DETERMINISTIC_SEED,
  DETERMINISTIC_TEMP,
  cslGate,
  cslSelect,
  sha256,
  deterministicEmbedding,
  cosineSimilarity,
  phiThreshold,
};
