/**
 * HeadyPersonaRouter — Context-Aware Personality Selection for HeadyBuddy
 *
 * Routes user interactions to the optimal AI persona based on:
 * - CSL cosine similarity between conversation embedding and persona embeddings
 * - Context signals (time of day, user mood, task type, history)
 * - Persona specialization domains
 *
 * No hardcoded priority — persona selection is purely semantic alignment.
 *
 * © 2026 HeadySystems Inc. — Sacred Geometry v4.0
 * @module intelligence/persona-router
 */

const { PHI, PSI, fib, CSL_THRESHOLDS, phiFusionWeights, cosineSimilarity, cslGate } = require('../shared/phi-math');
const { createLogger } = require('../shared/logger');

const logger = createLogger('PersonaRouter');

/**
 * @typedef {Object} Persona
 * @property {string} id - Unique persona identifier
 * @property {string} name - Display name
 * @property {string} archetype - Animal/cognitive archetype
 * @property {string[]} domains - Specialization domains
 * @property {string} tone - Communication tone
 * @property {string} style - Response style
 * @property {number[]} embedding - 384D persona embedding
 * @property {Object} traits - Behavioral traits
 */

/** Default persona registry — 7 archetypes mapped to Heady cognitive framework */
const DEFAULT_PERSONAS = [
  {
    id: 'wise-owl',
    name: 'Athena',
    archetype: 'owl',
    domains: ['architecture', 'strategy', 'research', 'patents', 'analysis'],
    tone: 'thoughtful',
    style: 'systematic',
    traits: { depth: PSI + 0.3, creativity: PSI, speed: PSI * PSI, thoroughness: 1.0 },
  },
  {
    id: 'builder-beaver',
    name: 'JULES',
    archetype: 'beaver',
    domains: ['coding', 'building', 'implementation', 'deployment', 'infrastructure'],
    tone: 'focused',
    style: 'action-oriented',
    traits: { depth: PSI, creativity: PSI * PSI, speed: PSI + 0.2, thoroughness: PSI + 0.3 },
  },
  {
    id: 'creative-dolphin',
    name: 'MUSE',
    archetype: 'dolphin',
    domains: ['creative', 'ux', 'design', 'brainstorming', 'content'],
    tone: 'playful',
    style: 'exploratory',
    traits: { depth: PSI * PSI, creativity: 1.0, speed: PSI, thoroughness: PSI },
  },
  {
    id: 'eagle-observer',
    name: 'SENTINEL',
    archetype: 'eagle',
    domains: ['security', 'monitoring', 'review', 'audit', 'risk'],
    tone: 'precise',
    style: 'analytical',
    traits: { depth: PSI + 0.2, creativity: PSI * PSI, speed: PSI + 0.1, thoroughness: 1.0 },
  },
  {
    id: 'ant-worker',
    name: 'Worker',
    archetype: 'ant',
    domains: ['tasks', 'cleanup', 'maintenance', 'repetitive', 'batch'],
    tone: 'efficient',
    style: 'concise',
    traits: { depth: PSI * PSI, creativity: PSI * PSI * PSI, speed: 1.0, thoroughness: PSI },
  },
  {
    id: 'elephant-memory',
    name: 'HeadyMemory',
    archetype: 'elephant',
    domains: ['memory', 'recall', 'learning', 'patterns', 'history'],
    tone: 'patient',
    style: 'comprehensive',
    traits: { depth: 1.0, creativity: PSI * PSI, speed: PSI * PSI, thoroughness: 1.0 },
  },
  {
    id: 'rabbit-multiplier',
    name: 'NOVA',
    archetype: 'rabbit',
    domains: ['innovation', 'ideation', 'alternatives', 'brainstorming', 'exploration'],
    tone: 'energetic',
    style: 'divergent',
    traits: { depth: PSI, creativity: PSI + 0.3, speed: PSI + 0.3, thoroughness: PSI * PSI },
  },
];

class PersonaRouter {
  /**
   * @param {Object} config
   * @param {Persona[]} [config.personas] - Custom persona registry
   * @param {Function} config.embedFn - async (text) => number[] — text to 384D embedding
   * @param {number} [config.minScore] - Minimum CSL gate score to match
   */
  constructor(config) {
    this.embedFn = config.embedFn;
    this.minScore = config.minScore || CSL_THRESHOLDS.LOW;
    this.personas = (config.personas || DEFAULT_PERSONAS).map(p => ({
      ...p,
      embedding: p.embedding || null,
    }));
    this.routingHistory = [];
    this.initialized = false;
  }

  /**
   * Initialize — generate embeddings for all personas.
   * @returns {Promise<void>}
   */
  async init() {
    logger.info({ count: this.personas.length }, 'Initializing persona embeddings');

    for (const persona of this.personas) {
      if (!persona.embedding) {
        const text = `${persona.name} ${persona.archetype} ${persona.domains.join(' ')} ${persona.tone} ${persona.style}`;
        persona.embedding = await this.embedFn(text);
      }
    }

    this.initialized = true;
    logger.info({}, 'Persona router initialized');
  }

  /**
   * Route a conversation to the best-matching persona.
   * @param {Object} context
   * @param {string} context.message - Current user message
   * @param {string[]} [context.recentTopics] - Recent conversation topics
   * @param {string} [context.taskType] - Explicit task type hint
   * @param {string} [context.mood] - Detected user mood
   * @returns {Promise<{ persona: Persona, score: number, alternatives: Array }>}
   */
  async route(context) {
    if (!this.initialized) await this.init();

    // Build context embedding
    const contextText = [
      context.message,
      ...(context.recentTopics || []),
      context.taskType || '',
      context.mood || '',
    ].filter(Boolean).join(' ');

    const contextEmbedding = await this.embedFn(contextText);

    // Score all personas via CSL gates
    const scored = this.personas.map(persona => {
      const similarity = cosineSimilarity(contextEmbedding, persona.embedding);
      const gatedScore = cslGate(1.0, similarity, this.minScore);

      // Apply trait modifiers
      const traitBoost = this._computeTraitBoost(persona.traits, context);
      const finalScore = gatedScore * (1 + traitBoost * PSI * PSI); // Subtle trait influence

      return { persona, score: finalScore, rawSimilarity: similarity };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const selected = scored[0];
    const alternatives = scored.slice(1, fib(4)); // Top 3 alternatives

    // Log routing decision
    this.routingHistory.push({
      timestamp: new Date().toISOString(),
      message: context.message.slice(0, 100),
      selected: selected.persona.id,
      score: selected.score,
      alternatives: alternatives.map(a => ({ id: a.persona.id, score: a.score })),
    });

    // Trim history to Fibonacci size
    if (this.routingHistory.length > fib(11)) { // 89 entries
      this.routingHistory = this.routingHistory.slice(-fib(10)); // Keep 55
    }

    logger.info({
      selected: selected.persona.id,
      score: selected.score.toFixed(4),
      message: context.message.slice(0, 50),
    }, 'Persona routed');

    return {
      persona: selected.persona,
      score: selected.score,
      alternatives,
    };
  }

  /**
   * Compute trait boost based on context signals.
   * @param {Object} traits
   * @param {Object} context
   * @returns {number} Boost factor (-0.5 to 0.5)
   */
  _computeTraitBoost(traits, context) {
    let boost = 0;

    // Speed preference for quick tasks
    if (context.taskType === 'quick' || context.mood === 'impatient') {
      boost += traits.speed * PSI * PSI;
    }

    // Depth preference for complex tasks
    if (context.taskType === 'research' || context.taskType === 'architecture') {
      boost += traits.depth * PSI * PSI;
    }

    // Creativity for open-ended tasks
    if (context.taskType === 'creative' || context.taskType === 'brainstorm') {
      boost += traits.creativity * PSI * PSI;
    }

    return Math.min(boost, 0.5);
  }

  /**
   * Get persona by ID.
   * @param {string} id
   * @returns {Persona|undefined}
   */
  getPersona(id) {
    return this.personas.find(p => p.id === id);
  }

  /**
   * Add a custom persona.
   * @param {Persona} persona
   * @returns {Promise<void>}
   */
  async addPersona(persona) {
    if (!persona.embedding) {
      const text = `${persona.name} ${persona.archetype || ''} ${(persona.domains || []).join(' ')}`;
      persona.embedding = await this.embedFn(text);
    }
    this.personas.push(persona);
    logger.info({ id: persona.id, name: persona.name }, 'Persona added');
  }

  /** Health check */
  health() {
    return {
      service: 'PersonaRouter',
      status: this.initialized ? 'up' : 'initializing',
      personaCount: this.personas.length,
      routingHistorySize: this.routingHistory.length,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { PersonaRouter, DEFAULT_PERSONAS };
