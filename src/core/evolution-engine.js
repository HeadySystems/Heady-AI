// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Evolution Engine — Self-Improvement via PDCA Socratic Loop
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PHI, PSI, PSI2, PSI3, FIB, CSL_THRESHOLDS,
  cosineSimilarity, normalize, sha256, phiBackoff,
  cslGate, deterministicRandom, SEED
} from '../shared/phi-math-v2.js';
import { cslAND, cslOR, cslNOT, textToEmbedding, DIM } from '../shared/csl-engine-v2.js';

class EvolutionEngine {
  #mutations;
  #baselines;
  #history;
  #maxHistory;
  #coherenceThreshold;
  #rng;

  constructor() {
    this.#mutations = new Map();
    this.#baselines = new Map();
    this.#history = [];
    this.#maxHistory = FIB[16]; // 987
    this.#coherenceThreshold = CSL_THRESHOLDS.HIGH;
    this.#rng = deterministicRandom(SEED);
  }

  async propose(componentId, currentEmbedding, targetDescription) {
    const targetEmb = textToEmbedding(targetDescription);
    const coherence = cosineSimilarity(currentEmbedding, targetEmb);
    const gatedScore = cslGate(1.0, coherence, CSL_THRESHOLDS.MEDIUM, PSI3);

    const candidates = this.#monteCarloSample(currentEmbedding, targetEmb, FIB[8]);

    const scored = candidates.map((candidate, i) => {
      const candidateCoherence = cosineSimilarity(candidate, targetEmb);
      const improvement = candidateCoherence - coherence;
      const hash = componentId + ':' + i + ':' + Date.now();
      return {
        id: hash,
        embedding: candidate,
        coherence: candidateCoherence,
        improvement,
        gatedScore: cslGate(improvement, candidateCoherence, CSL_THRESHOLDS.MEDIUM, PSI3),
      };
    });

    scored.sort((a, b) => b.gatedScore - a.gatedScore);

    const proposal = {
      componentId,
      timestamp: Date.now(),
      currentCoherence: coherence,
      candidates: scored.slice(0, FIB[5]),
      bestCandidate: scored[0],
      hash: await sha256(JSON.stringify(scored[0])),
    };

    this.#mutations.set(proposal.hash, proposal);
    return proposal;
  }

  async evaluate(proposalHash) {
    const proposal = this.#mutations.get(proposalHash);
    if (!proposal) throw new Error('Proposal not found: ' + proposalHash);

    const best = proposal.bestCandidate;
    const baseline = this.#baselines.get(proposal.componentId);

    const evaluation = {
      proposalHash,
      componentId: proposal.componentId,
      coherenceGain: best.improvement,
      passesCoherenceGate: best.coherence >= this.#coherenceThreshold,
      passesImprovementGate: best.improvement > 0,
      gatedApproval: cslGate(
        best.improvement > 0 ? 1 : 0,
        best.coherence,
        CSL_THRESHOLDS.HIGH,
        PSI3
      ),
      socraticValidation: this.#socraticLoop(proposal),
      timestamp: Date.now(),
    };

    evaluation.approved = evaluation.gatedApproval > CSL_THRESHOLDS.MEDIUM
      && evaluation.socraticValidation.passes;

    return evaluation;
  }

  async apply(proposalHash) {
    const proposal = this.#mutations.get(proposalHash);
    if (!proposal) throw new Error('Proposal not found: ' + proposalHash);

    const evaluation = await this.evaluate(proposalHash);
    if (!evaluation.approved) {
      return { applied: false, reason: 'Evaluation not approved', evaluation };
    }

    const previousBaseline = this.#baselines.get(proposal.componentId);
    this.#baselines.set(proposal.componentId, {
      embedding: proposal.bestCandidate.embedding,
      appliedAt: Date.now(),
      previousHash: previousBaseline ? await sha256(JSON.stringify(previousBaseline)) : null,
    });

    const record = {
      type: 'apply',
      proposalHash,
      componentId: proposal.componentId,
      coherenceBefore: proposal.currentCoherence,
      coherenceAfter: proposal.bestCandidate.coherence,
      timestamp: Date.now(),
    };

    this.#history.push(record);
    if (this.#history.length > this.#maxHistory) {
      this.#history = this.#history.slice(-this.#maxHistory);
    }

    this.#mutations.delete(proposalHash);
    return { applied: true, record };
  }

  async rollback(componentId) {
    const baseline = this.#baselines.get(componentId);
    if (!baseline || !baseline.previousHash) {
      return { rolledBack: false, reason: 'No previous baseline' };
    }

    const record = {
      type: 'rollback',
      componentId,
      timestamp: Date.now(),
    };
    this.#history.push(record);
    this.#baselines.delete(componentId);
    return { rolledBack: true, record };
  }

  getEvolutionHistory(limit = FIB[8]) {
    return this.#history.slice(-limit);
  }

  getBaseline(componentId) {
    return this.#baselines.get(componentId) || null;
  }

  getPendingProposals() {
    return Array.from(this.#mutations.entries()).map(([hash, p]) => ({
      hash, componentId: p.componentId, timestamp: p.timestamp,
    }));
  }

  #monteCarloSample(current, target, n) {
    const candidates = [];
    for (let i = 0; i < n; i++) {
      const alpha = PSI * (i + 1) / n;
      const candidate = current.map((v, d) => v * (1 - alpha) + target[d] * alpha);
      const noise = Array.from({ length: current.length }, () => (this.#rng() - PSI) * PSI3);
      const noisy = candidate.map((v, d) => v + noise[d]);
      candidates.push(normalize(noisy));
    }
    return candidates;
  }

  #socraticLoop(proposal) {
    const questions = [
      { q: 'Does this improve coherence?', answer: proposal.bestCandidate.improvement > 0 },
      { q: 'Is coherence above HIGH threshold?', answer: proposal.bestCandidate.coherence >= CSL_THRESHOLDS.HIGH },
      { q: 'Is the change magnitude bounded?', answer: Math.abs(proposal.bestCandidate.improvement) < PSI },
      { q: 'Does it preserve mission alignment?', answer: proposal.bestCandidate.coherence >= CSL_THRESHOLDS.MEDIUM },
    ];

    const passes = questions.every(q => q.answer);
    const confidence = questions.filter(q => q.answer).length / questions.length;
    return { questions, passes, confidence };
  }
}

export { EvolutionEngine };
export default EvolutionEngine;
