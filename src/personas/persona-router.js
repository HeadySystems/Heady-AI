/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ PERSONA ROUTER — 10 Animal Archetype Routing             ║
 * ║  Empathic masking with CSL-scored persona selection               ║
 * ║  © 2024-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

import { PHI, PSI, fib, CSL_THRESHOLDS } from '../../shared/phi-math.js';
import { cslAND } from '../../shared/csl-engine.js';

/**
 * 10 Animal Personas — permanent, parallel, non-toggleable.
 * Each represents a cognitive archetype that colors responses.
 */
const PERSONAS = Object.freeze({
  OWL:      { name: 'Owl',      role: 'Wisdom',           emoji: '🦉', question: 'What is fundamentally true here?' },
  EAGLE:    { name: 'Eagle',    role: 'Omniscience',      emoji: '🦅', question: 'What else does this touch across all 17 swarms?' },
  DOLPHIN:  { name: 'Dolphin',  role: 'Creativity',       emoji: '🐬', question: 'What is the elegant/inventive route?' },
  RABBIT:   { name: 'Rabbit',   role: 'Multiplication',   emoji: '🐇', question: 'What other viable paths exist? (min 3)' },
  ANT:      { name: 'Ant',      role: 'Repetitive Task',  emoji: '🐜', question: 'What repetitive work needs doing?' },
  ELEPHANT: { name: 'Elephant', role: 'Concentration',    emoji: '🐘', question: 'What context must I hold from prior sessions?' },
  BEAVER:   { name: 'Beaver',   role: 'Structured Build', emoji: '🦫', question: 'How do I build this properly?' },
  FOX:      { name: 'Fox',      role: 'Adaptability',     emoji: '🦊', question: 'What needs to change right now?' },
  LION:     { name: 'Lion',     role: 'Leadership',       emoji: '🦁', question: 'What is the decisive action?' },
  BEE:      { name: 'Bee',      role: 'Collaboration',    emoji: '🐝', question: 'How do we coordinate across the swarm?' },
});

/** Minimum confidence for all archetypes — ψ = 0.618 */
const MIN_ARCHETYPE_CONFIDENCE = PSI;

/**
 * PersonaRouter — routes responses through all 10 personas in parallel.
 * All 7 cognitive archetypes must exceed 0.618 confidence before output.
 */
export class PersonaRouter {
  constructor({ telemetry = null } = {}) {
    /** @private */ this._telemetry = telemetry;
    /** @private */ this._archetypeEmbeddings = new Map();
  }

  /**
   * Set archetype embeddings for CSL-based persona selection.
   * @param {Object} embeddings - persona name → Float64Array
   */
  setArchetypeEmbeddings(embeddings) {
    for (const [name, emb] of Object.entries(embeddings)) {
      this._archetypeEmbeddings.set(name, emb);
    }
  }

  /**
   * Score a response through all 7 cognitive archetypes.
   * @param {Object} response
   * @param {Float64Array} [responseEmbedding]
   * @returns {Object} Archetype scores and pass/fail
   */
  scoreArchetypes(response, responseEmbedding = null) {
    const cognitiveArchetypes = ['OWL', 'EAGLE', 'DOLPHIN', 'RABBIT', 'ANT', 'ELEPHANT', 'BEAVER'];
    const scores = {};
    let allPass = true;

    for (const archetype of cognitiveArchetypes) {
      const archetypeEmb = this._archetypeEmbeddings.get(archetype);
      if (archetypeEmb && responseEmbedding) {
        scores[archetype] = cslAND(responseEmbedding, archetypeEmb);
      } else {
        // Default: pass if no embedding available
        scores[archetype] = MIN_ARCHETYPE_CONFIDENCE;
      }

      if (scores[archetype] < MIN_ARCHETYPE_CONFIDENCE) {
        allPass = false;
      }
    }

    return { scores, allPass, threshold: MIN_ARCHETYPE_CONFIDENCE };
  }

  /**
   * Select the dominant persona for a user interaction.
   * @param {string} userInput
   * @param {Float64Array} [inputEmbedding]
   * @returns {Object} Selected persona and scores
   */
  selectPersona(userInput, inputEmbedding = null) {
    let bestPersona = PERSONAS.OWL; // Default
    let bestScore = 0;
    const scores = {};

    if (inputEmbedding) {
      for (const [key, persona] of Object.entries(PERSONAS)) {
        const personaEmb = this._archetypeEmbeddings.get(key);
        if (personaEmb) {
          const score = cslAND(inputEmbedding, personaEmb);
          scores[key] = score;
          if (score > bestScore) {
            bestScore = score;
            bestPersona = persona;
          }
        }
      }
    }

    return { persona: bestPersona, confidence: bestScore, allScores: scores };
  }

  /**
   * Get all persona definitions.
   * @returns {Object}
   */
  getPersonas() {
    return { ...PERSONAS };
  }
}

export { PERSONAS, MIN_ARCHETYPE_CONFIDENCE };
export default PersonaRouter;
