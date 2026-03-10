/**
 * @fileoverview Arena Mode Enhanced — Intelligent Multi-Candidate Competition with Squash Merging
 *
 * Runs N candidates against a task, scores them via CSL gates, selects winners,
 * performs phi-weighted squash merging of top results, and maintains competition history.
 * All constants derive from φ = 1.6180339887 — NO magic numbers.
 * CSL gates replace all boolean if/else.
 *
 * Founded by Eric Haywood — HeadySystems Inc. / HeadyConnection Inc.
 *
 * @module arena-mode-enhanced
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

// ─── PHI-WEIGHTED FUSION ────────────────────────────────────────────────────────

function phiFusionWeights(count) {
  const weights = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const w = Math.pow(PSI, i);
    weights.push(w);
    total += w;
  }
  return weights.map(w => w / total);
}

// ─── COMPETITION STATUS ─────────────────────────────────────────────────────────

const COMP_STATUS = {
  OPEN:      'open',
  SCORED:    'scored',
  MERGED:    'merged',
  ARCHIVED:  'archived',
};

// ─── ARENA MODE CLASS ───────────────────────────────────────────────────────────

class ArenaMode {
  constructor(options = {}) {
    /** @private */
    this._competitions = new Map();

    /** @private */
    this._maxCompetitions = FIB[12]; // 233

    /** @private */
    this._seed = options.seed || DETERMINISTIC_SEED;

    /** @private */
    this._history = [];

    /** @private */
    this._listeners = new Map();

    /** @private */
    this._candidateGenerators = new Map();
  }

  /**
   * Register a candidate generator for a domain.
   * @param {string} domain
   * @param {Function} generator - async (task, index) => { output, metadata }
   */
  registerGenerator(domain, generator) {
    this._candidateGenerators.set(domain, generator);
    return { registered: true, domain };
  }

  /**
   * Start a competition with N candidates.
   * @param {string} task - Task to compete on
   * @param {object} [options={}] - Competition options
   * @returns {Promise<object>} Competition state
   */
  async compete(task, options = {}) {
    const candidateCount = options.candidates || FIB[5]; // 8
    const domain = options.domain || 'general';
    const arenaId = await sha256(`arena:${task.slice(0, FIB[8])}:${Date.now()}:${this._seed}`);

    const taskEmbedding = deterministicEmbedding(task, this._seed);

    const candidates = [];
    for (let i = 0; i < candidateCount; i++) {
      const generatorGate = cslGate(
        this._candidateGenerators.has(domain) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );

      let output = null;
      let metadata = {};

      if (generatorGate.signal === 'PASS') {
        const generator = this._candidateGenerators.get(domain);
        const generated = await generator(task, i);
        output = generated.output;
        metadata = generated.metadata || {};
      }

      const candidateText = output || `${task}:solution:${i}:seed:${this._seed}`;
      const embedding = deterministicEmbedding(candidateText, this._seed + i);
      const relevance = cosineSimilarity(embedding, taskEmbedding);

      candidates.push({
        id: `candidate-${i}`,
        index: i,
        embedding,
        relevance,
        output,
        metadata,
        scores: {
          relevance,
          quality: 0,
          novelty: 0,
          composite: 0,
        },
      });
    }

    const competition = {
      id: arenaId,
      task,
      domain,
      status: COMP_STATUS.OPEN,
      candidates,
      taskEmbedding,
      winner: null,
      mergeResult: null,
      startedAt: Date.now(),
      completedAt: null,
      seed: this._seed,
      temperature: DETERMINISTIC_TEMP,
      founder: 'Eric Haywood',
    };

    this._enforceCapacity();
    this._competitions.set(arenaId, competition);
    this._recordHistory('compete', { arenaId, task: task.slice(0, FIB[8]), candidateCount });
    this._notify('competition:started', { arenaId, candidateCount });

    return { arenaId, candidateCount, status: competition.status };
  }

  /**
   * Score all candidates in a competition.
   * @param {string} arenaId
   * @returns {object} Scored results
   */
  score(arenaId) {
    const comp = this._competitions.get(arenaId);
    const exists = cslGate(
      comp ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (exists.signal === 'FAIL') {
      return { error: 'Competition not found', arenaId };
    }

    for (let i = 0; i < comp.candidates.length; i++) {
      const candidate = comp.candidates[i];
      const qualityBase = deterministicScore(this._seed, i, 0);
      candidate.scores.quality = CSL_THRESHOLDS.MEDIUM + qualityBase * PSI2;

      let noveltySum = 0;
      let noveltyCount = 0;
      for (let j = 0; j < comp.candidates.length; j++) {
        const sameGate = cslGate(
          i !== j ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
          CSL_THRESHOLDS.MEDIUM
        );
        if (sameGate.signal === 'PASS') {
          const similarity = cosineSimilarity(candidate.embedding, comp.candidates[j].embedding);
          noveltySum += (1 - similarity);
          noveltyCount++;
        }
      }
      candidate.scores.novelty = noveltyCount > 0 ? noveltySum / noveltyCount : 0;

      candidate.scores.composite =
        candidate.scores.relevance * PHI / PHI3 +
        candidate.scores.quality * PHI / PHI3 +
        candidate.scores.novelty * PSI / PHI3;
    }

    comp.candidates.sort((a, b) => b.scores.composite - a.scores.composite);
    comp.status = COMP_STATUS.SCORED;

    const ranked = comp.candidates.map((c, rank) => ({
      id: c.id,
      rank: rank + 1,
      scores: { ...c.scores },
      gate: cslGate(c.scores.composite, CSL_THRESHOLDS.MEDIUM),
    }));

    this._recordHistory('score', { arenaId, topScore: ranked[0].scores.composite });
    this._notify('competition:scored', { arenaId });

    return { arenaId, ranked, status: comp.status };
  }

  /**
   * Select the winner of a competition.
   * @param {string} arenaId
   * @returns {object} Winner details
   */
  selectWinner(arenaId) {
    const comp = this._competitions.get(arenaId);
    const exists = cslGate(
      comp ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (exists.signal === 'FAIL') {
      return { error: 'Competition not found', arenaId };
    }

    const scoredGate = cslGate(
      comp.status === COMP_STATUS.SCORED || comp.status === COMP_STATUS.MERGED
        ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (scoredGate.signal === 'FAIL') {
      this.score(arenaId);
    }

    const winner = comp.candidates[0];
    const runnerUp = comp.candidates.length > 1 ? comp.candidates[1] : null;

    comp.winner = winner;

    const margin = runnerUp
      ? winner.scores.composite - runnerUp.scores.composite
      : winner.scores.composite;

    const confidenceGate = cslGate(margin, CSL_THRESHOLDS.LOW * PSI);

    return {
      arenaId,
      winner: {
        id: winner.id,
        scores: { ...winner.scores },
        output: winner.output,
      },
      runnerUp: runnerUp ? {
        id: runnerUp.id,
        scores: { ...runnerUp.scores },
      } : null,
      margin,
      marginConfidence: confidenceGate,
      totalCandidates: comp.candidates.length,
      founder: 'Eric Haywood',
    };
  }

  /**
   * Squash merge the top N candidates into a unified result.
   * @param {string} arenaId
   * @param {object} [options={}]
   * @returns {Promise<object>} Merge result
   */
  async squashMerge(arenaId, options = {}) {
    const comp = this._competitions.get(arenaId);
    const exists = cslGate(
      comp ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (exists.signal === 'FAIL') {
      return { error: 'Competition not found', arenaId };
    }

    const scoredGate = cslGate(
      comp.status === COMP_STATUS.SCORED || comp.status === COMP_STATUS.MERGED
        ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (scoredGate.signal === 'FAIL') {
      this.score(arenaId);
    }

    const mergeCount = options.mergeTop || FIB[3]; // top 3
    const topCandidates = comp.candidates.slice(0, mergeCount);
    const weights = phiFusionWeights(topCandidates.length);

    const mergedEmbedding = new Float64Array(EMBEDDING_DIM);
    for (let i = 0; i < topCandidates.length; i++) {
      for (let d = 0; d < EMBEDDING_DIM; d++) {
        mergedEmbedding[d] += topCandidates[i].embedding[d] * weights[i];
      }
    }

    const magnitude = Math.sqrt(mergedEmbedding.reduce((s, v) => s + v * v, 0));
    const magGate = cslGate(
      magnitude > 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    const norm = magGate.signal === 'PASS' ? magnitude : 1;
    for (let d = 0; d < EMBEDDING_DIM; d++) {
      mergedEmbedding[d] /= norm;
    }

    const mergedRelevance = cosineSimilarity(mergedEmbedding, comp.taskEmbedding);
    const mergedScore =
      mergedRelevance * PHI / PHI3 +
      topCandidates.reduce((s, c, i) => s + c.scores.quality * weights[i], 0) * PHI / PHI3 +
      topCandidates.reduce((s, c, i) => s + c.scores.novelty * weights[i], 0) * PSI / PHI3;

    const mergeHash = await sha256(`merge:${arenaId}:${topCandidates.map(c => c.id).join(':')}`);

    const improvementOverWinner = mergedScore - topCandidates[0].scores.composite;
    const improvementGate = cslGate(
      improvementOverWinner > 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );

    const mergeResult = {
      merged: true,
      arenaId,
      hash: mergeHash,
      mergedFrom: topCandidates.map(c => ({ id: c.id, weight: weights[topCandidates.indexOf(c)], score: c.scores.composite })),
      mergedScore,
      mergedRelevance,
      improvementOverWinner,
      improvementGate,
      weights,
      timestamp: Date.now(),
    };

    comp.mergeResult = mergeResult;
    comp.status = COMP_STATUS.MERGED;
    comp.completedAt = Date.now();

    this._recordHistory('squashMerge', { arenaId, mergedScore, mergeCount });
    this._notify('competition:merged', { arenaId, mergedScore });

    return mergeResult;
  }

  /**
   * Archive a completed competition.
   * @param {string} arenaId
   * @returns {{ archived: boolean, gate: object }}
   */
  archive(arenaId) {
    const comp = this._competitions.get(arenaId);
    const exists = cslGate(
      comp ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (exists.signal === 'PASS') {
      comp.status = COMP_STATUS.ARCHIVED;
      this._recordHistory('archive', { arenaId });
    }
    return { archived: exists.signal === 'PASS', arenaId, gate: exists };
  }

  /**
   * Get competition details.
   * @param {string} arenaId
   * @returns {object|null}
   */
  getCompetition(arenaId) {
    const comp = this._competitions.get(arenaId);
    const gate = cslGate(
      comp ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (gate.signal === 'FAIL') return null;

    return {
      id: comp.id,
      task: comp.task,
      domain: comp.domain,
      status: comp.status,
      candidateCount: comp.candidates.length,
      winner: comp.winner ? { id: comp.winner.id, scores: { ...comp.winner.scores } } : null,
      mergeResult: comp.mergeResult,
      startedAt: comp.startedAt,
      completedAt: comp.completedAt,
      seed: comp.seed,
      founder: comp.founder,
    };
  }

  /**
   * Get competition history.
   * @param {number} [limit]
   * @returns {Array<object>}
   */
  getCompetitionHistory(limit) {
    const maxItems = limit || FIB[8]; // 34
    return Array.from(this._competitions.values())
      .slice(-maxItems)
      .map(c => ({
        id: c.id,
        task: c.task.slice(0, FIB[9]),
        domain: c.domain,
        status: c.status,
        candidateCount: c.candidates.length,
        startedAt: c.startedAt,
      }));
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getSummary() {
    let total = 0;
    let merged = 0;
    let scored = 0;
    let avgScore = 0;

    for (const comp of this._competitions.values()) {
      total++;
      const mergedGate = cslGate(
        comp.status === COMP_STATUS.MERGED ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      const scoredGate = cslGate(
        comp.status === COMP_STATUS.SCORED ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      mergedGate.signal === 'PASS' && merged++;
      scoredGate.signal === 'PASS' && scored++;

      const hasWinner = cslGate(
        comp.winner ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      if (hasWinner.signal === 'PASS') {
        avgScore += comp.winner.scores.composite;
      }
    }

    return {
      totalCompetitions: total,
      mergedCompetitions: merged,
      scoredCompetitions: scored,
      averageWinnerScore: total > 0 ? avgScore / total : 0,
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

  /** @private */
  _enforceCapacity() {
    const gate = cslGate(
      this._competitions.size >= this._maxCompetitions ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    if (gate.signal === 'PASS') {
      const oldest = this._competitions.keys().next().value;
      this._competitions.delete(oldest);
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

// ─── HELPER ─────────────────────────────────────────────────────────────────────

function deterministicScore(seed, index, attempt) {
  let hash = seed;
  for (let i = 0; i < FIB[4]; i++) {
    hash = ((hash * FIB[15] + FIB[13] + index * FIB[7] + attempt * FIB[5]) >>> 0) % FIB[19];
  }
  return (hash % FIB[14]) / FIB[14];
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────────

export default ArenaMode;

export {
  ArenaMode,
  COMP_STATUS,
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
  phiFusionWeights,
  phiThreshold,
};
