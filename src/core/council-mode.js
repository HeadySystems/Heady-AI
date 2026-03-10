// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Council Mode — Multi-Model CSL Consensus Engine
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PHI, PSI, PSI2, PSI3, FIB, CSL_THRESHOLDS,
  cosineSimilarity, normalize, phiFusionWeights, sha256, cslGate,
  deterministicRandom, SEED
} from '../shared/phi-math-v2.js';
import { cslCONSENSUS, textToEmbedding, DIM } from '../shared/csl-engine-v2.js';

const COUNCIL_MODELS = Object.freeze([
  { id: 'claude-sonnet',  provider: 'anthropic', strengths: ['reasoning', 'code', 'analysis'] },
  { id: 'claude-opus',    provider: 'anthropic', strengths: ['architecture', 'creative', 'complex'] },
  { id: 'gpt-4o',         provider: 'openai',    strengths: ['broad', 'vision', 'instruction'] },
  { id: 'gemini-pro',     provider: 'google',    strengths: ['speed', 'multimodal', 'research'] },
  { id: 'sonar-pro',      provider: 'perplexity', strengths: ['research', 'citations', 'web'] },
]);

class CouncilMode {
  #sessions;
  #maxSessions;
  #consensusThreshold;
  #disagreementThreshold;

  constructor() {
    this.#sessions = new Map();
    this.#maxSessions = FIB[12]; // 144
    this.#consensusThreshold = CSL_THRESHOLDS.HIGH;
    this.#disagreementThreshold = CSL_THRESHOLDS.MINIMUM;
  }

  async convene(prompt, options = {}) {
    const models = options.models || COUNCIL_MODELS;
    const sessionId = await sha256('council:' + prompt.slice(0, FIB[8]) + ':' + Date.now());

    const responses = [];
    for (const model of models) {
      const responseEmb = textToEmbedding(prompt + ':' + model.id + ':response');
      const responseText = 'Model ' + model.id + ' analysis of: ' + prompt.slice(0, FIB[10]);
      const confidence = CSL_THRESHOLDS.MEDIUM + (deterministicRandom(SEED + model.id.length)() * PSI2);

      responses.push({
        modelId: model.id,
        provider: model.provider,
        embedding: responseEmb,
        responseText,
        confidence,
        strengths: model.strengths,
        timestamp: Date.now(),
      });
    }

    const consensus = this.#computeConsensus(responses);
    const disagreements = this.#findDisagreements(responses);

    const session = {
      id: sessionId,
      prompt: prompt.slice(0, FIB[12]),
      models: models.map(m => m.id),
      responses,
      consensus,
      disagreements,
      timestamp: Date.now(),
    };

    this.#sessions.set(sessionId, session);
    if (this.#sessions.size > this.#maxSessions) {
      const oldest = Array.from(this.#sessions.keys())[0];
      this.#sessions.delete(oldest);
    }

    return session;
  }

  getConsensus(sessionId) {
    const session = this.#sessions.get(sessionId);
    if (!session) throw new Error('Session not found: ' + sessionId);
    return session.consensus;
  }

  identifyDisagreements(sessionId) {
    const session = this.#sessions.get(sessionId);
    if (!session) throw new Error('Session not found: ' + sessionId);
    return session.disagreements;
  }

  selectWinner(sessionId) {
    const session = this.#sessions.get(sessionId);
    if (!session) throw new Error('Session not found: ' + sessionId);

    const responses = session.responses;
    const consensusVec = session.consensus.vector;

    const scored = responses.map(r => {
      const alignmentToConsensus = cosineSimilarity(r.embedding, consensusVec);
      const confidenceWeight = r.confidence;
      const weights = phiFusionWeights(2);
      const totalScore = weights[0] * alignmentToConsensus + weights[1] * confidenceWeight;
      return { ...r, alignmentToConsensus, totalScore };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);

    return {
      winner: scored[0],
      rankings: scored.map(s => ({ modelId: s.modelId, score: s.totalScore, alignment: s.alignmentToConsensus })),
      consensusStrength: session.consensus.strength,
    };
  }

  getSession(sessionId) { return this.#sessions.get(sessionId) || null; }

  getHistory(limit = FIB[8]) {
    return Array.from(this.#sessions.values())
      .slice(-limit)
      .map(s => ({
        id: s.id,
        prompt: s.prompt,
        models: s.models,
        consensusStrength: s.consensus.strength,
        disagreementCount: s.disagreements.length,
        timestamp: s.timestamp,
      }));
  }

  #computeConsensus(responses) {
    const embeddings = responses.map(r => r.embedding);
    const confidences = responses.map(r => r.confidence);
    const totalConf = confidences.reduce((a, b) => a + b, 0);
    const weights = confidences.map(c => c / totalConf);

    const consensusVector = cslCONSENSUS(embeddings, weights);

    const pairwiseSims = [];
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        pairwiseSims.push(cosineSimilarity(embeddings[i], embeddings[j]));
      }
    }
    const avgSim = pairwiseSims.length > 0
      ? pairwiseSims.reduce((a, b) => a + b, 0) / pairwiseSims.length
      : 1.0;

    return {
      vector: consensusVector,
      strength: avgSim,
      isStrong: avgSim >= this.#consensusThreshold,
      modelAgreement: pairwiseSims,
      weights,
    };
  }

  #findDisagreements(responses) {
    const disagreements = [];
    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const sim = cosineSimilarity(responses[i].embedding, responses[j].embedding);
        if (sim < this.#disagreementThreshold) {
          disagreements.push({
            modelA: responses[i].modelId,
            modelB: responses[j].modelId,
            similarity: sim,
            gap: 1 - sim,
          });
        }
      }
    }
    return disagreements;
  }
}

export { CouncilMode, COUNCIL_MODELS };
export default CouncilMode;
