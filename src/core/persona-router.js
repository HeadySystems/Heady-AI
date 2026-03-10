// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Persona Router — CSL-based MoE Persona/Agent Routing
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PHI, PSI, PSI2, PSI3, FIB, CSL_THRESHOLDS,
  cosineSimilarity, normalize, sigmoid, cslGate,
  deterministicRandom, SEED
} from '../shared/phi-math-v2.js';
import { textToEmbedding, DIM, MoECSLRouter } from '../shared/csl-engine-v2.js';

const SWARM_PERSONAS = Object.freeze([
  { id: 'heady-soul',      domain: 'awareness',     ring: 'central', layer: 'strategic',   fibIdx: 0, cslThreshold: CSL_THRESHOLDS.CRITICAL },
  { id: 'heady-brains',    domain: 'context',       ring: 'inner',   layer: 'strategic',   fibIdx: 1, cslThreshold: CSL_THRESHOLDS.HIGH },
  { id: 'heady-conductor', domain: 'orchestration', ring: 'inner',   layer: 'strategic',   fibIdx: 2, cslThreshold: CSL_THRESHOLDS.HIGH },
  { id: 'heady-vinci',     domain: 'planning',      ring: 'inner',   layer: 'strategic',   fibIdx: 3, cslThreshold: CSL_THRESHOLDS.HIGH },
  { id: 'jules',           domain: 'code-gen',      ring: 'middle',  layer: 'tactical',    fibIdx: 4, cslThreshold: CSL_THRESHOLDS.MEDIUM },
  { id: 'builder',         domain: 'construction',  ring: 'middle',  layer: 'tactical',    fibIdx: 5, cslThreshold: CSL_THRESHOLDS.MEDIUM },
  { id: 'observer',        domain: 'monitoring',    ring: 'middle',  layer: 'tactical',    fibIdx: 6, cslThreshold: CSL_THRESHOLDS.MEDIUM },
  { id: 'murphy',          domain: 'security',      ring: 'middle',  layer: 'tactical',    fibIdx: 7, cslThreshold: CSL_THRESHOLDS.MEDIUM },
  { id: 'atlas',           domain: 'architecture',  ring: 'middle',  layer: 'tactical',    fibIdx: 8, cslThreshold: CSL_THRESHOLDS.MEDIUM },
  { id: 'pythia',          domain: 'analysis',      ring: 'middle',  layer: 'tactical',    fibIdx: 9, cslThreshold: CSL_THRESHOLDS.MEDIUM },
  { id: 'bridge',          domain: 'translation',   ring: 'outer',   layer: 'operational', fibIdx: 10, cslThreshold: CSL_THRESHOLDS.LOW },
  { id: 'muse',            domain: 'creative',      ring: 'outer',   layer: 'operational', fibIdx: 11, cslThreshold: CSL_THRESHOLDS.LOW },
  { id: 'sentinel',        domain: 'defense',       ring: 'outer',   layer: 'operational', fibIdx: 12, cslThreshold: CSL_THRESHOLDS.LOW },
  { id: 'nova',            domain: 'innovation',    ring: 'outer',   layer: 'operational', fibIdx: 13, cslThreshold: CSL_THRESHOLDS.LOW },
  { id: 'janitor',         domain: 'cleanup',       ring: 'outer',   layer: 'operational', fibIdx: 14, cslThreshold: CSL_THRESHOLDS.LOW },
  { id: 'sophia',          domain: 'wisdom',        ring: 'outer',   layer: 'operational', fibIdx: 15, cslThreshold: CSL_THRESHOLDS.LOW },
  { id: 'cipher',          domain: 'encryption',    ring: 'outer',   layer: 'operational', fibIdx: 16, cslThreshold: CSL_THRESHOLDS.LOW },
]);

class PersonaRouter {
  #personas;
  #gateVectors;
  #routingHistory;
  #maxHistory;
  #adaptiveThresholds;
  #moeRouter;

  constructor() {
    this.#personas = new Map();
    this.#gateVectors = new Map();
    this.#routingHistory = [];
    this.#maxHistory = FIB[16];
    this.#adaptiveThresholds = new Map();
    this.#moeRouter = new MoECSLRouter(SWARM_PERSONAS.length, DIM);

    for (const persona of SWARM_PERSONAS) {
      this.registerPersona(persona);
    }
  }

  registerPersona(persona) {
    this.#personas.set(persona.id, persona);
    const gateVector = textToEmbedding(persona.domain + ' ' + persona.ring + ' ' + persona.layer);
    this.#gateVectors.set(persona.id, gateVector);
    this.#adaptiveThresholds.set(persona.id, persona.cslThreshold);
  }

  route(requestText, requestEmbedding = null) {
    const embedding = requestEmbedding || textToEmbedding(requestText);
    const scores = [];

    for (const [id, persona] of this.#personas) {
      const gateVec = this.#gateVectors.get(id);
      const cosSim = cosineSimilarity(embedding, gateVec);
      const threshold = this.#adaptiveThresholds.get(id);
      const gatedScore = cslGate(cosSim, cosSim, threshold, PSI3);

      scores.push({
        personaId: id,
        domain: persona.domain,
        ring: persona.ring,
        layer: persona.layer,
        rawScore: cosSim,
        gatedScore,
        meetsThreshold: cosSim >= threshold,
      });
    }

    scores.sort((a, b) => b.gatedScore - a.gatedScore);

    const topN = FIB[3]; // 2 concurrent-equals selections
    const selected = scores.slice(0, topN).filter(s => s.gatedScore > CSL_THRESHOLDS.MINIMUM);

    if (selected.length === 0) {
      selected.push(scores[0]); // fallback to best match
    }

    const sumWeights = selected.reduce((s, sel) => s + sel.gatedScore, 0);
    const routing = selected.map(s => ({
      ...s,
      weight: sumWeights > 0 ? s.gatedScore / sumWeights : 1 / selected.length,
    }));

    const record = {
      timestamp: Date.now(),
      requestSnippet: requestText.slice(0, FIB[8] * FIB[3]), // 42 chars
      selected: routing.map(r => r.personaId),
      topScore: routing[0]?.gatedScore || 0,
    };
    this.#routingHistory.push(record);
    if (this.#routingHistory.length > this.#maxHistory) {
      this.#routingHistory = this.#routingHistory.slice(-this.#maxHistory);
    }

    return { routing, allScores: scores, record };
  }

  getPersonaScores(requestText) {
    const embedding = textToEmbedding(requestText);
    const scores = {};
    for (const [id] of this.#personas) {
      const gateVec = this.#gateVectors.get(id);
      scores[id] = cosineSimilarity(embedding, gateVec);
    }
    return scores;
  }

  adaptThresholds(feedbackMap) {
    for (const [personaId, feedback] of Object.entries(feedbackMap)) {
      const current = this.#adaptiveThresholds.get(personaId);
      if (current === undefined) continue;
      const delta = feedback.success ? -PSI3 : PSI3;
      const newThreshold = Math.max(CSL_THRESHOLDS.MINIMUM, Math.min(CSL_THRESHOLDS.CRITICAL, current + delta));
      this.#adaptiveThresholds.set(personaId, newThreshold);
    }
  }

  getPersona(id) { return this.#personas.get(id) || null; }
  getAllPersonas() { return Array.from(this.#personas.values()); }
  getRoutingHistory(limit = FIB[8]) { return this.#routingHistory.slice(-limit); }
  getAdaptiveThresholds() { return Object.fromEntries(this.#adaptiveThresholds); }
}

export { PersonaRouter, SWARM_PERSONAS };
export default PersonaRouter;
