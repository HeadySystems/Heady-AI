'use strict';

/**
 * BaseScorer — Abstract base class for all HeadyEval scorers.
 *
 * All scorers must extend this class and implement:
 *   - score(example, context) → ScorerResult
 *
 * ScorerResult shape:
 * {
 *   scorer:      string,           // scorer name
 *   score:       number,           // 1–5 normalized score
 *   pass:        boolean,          // score >= passThreshold
 *   breakdown:   Record<string, number>,  // sub-dimension scores
 *   explanation: string,           // human-readable reasoning
 *   metadata:    object,           // scorer-specific extras
 *   durationMs:  number,           // how long scoring took
 *   error:       string | null,    // error message if scoring failed
 * }
 */

const config = require('../config');

class BaseScorer {
  /**
   * @param {string} name        - Unique scorer identifier
   * @param {object} [options]   - Scorer-specific options
   */
  constructor(name, options = {}) {
    if (new.target === BaseScorer) {
      throw new Error('BaseScorer is abstract — extend it and implement score()');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('Scorer name must be a non-empty string');
    }

    this.name = name;
    this.options = options;
    this.passThreshold = options.passThreshold ?? config.scoring.passThreshold;
    this.minScore = config.scoring.min;
    this.maxScore = config.scoring.max;
    this.enabled = options.enabled !== false;
  }

  /**
   * Score a single evaluation example.
   * Must be overridden by subclasses.
   *
   * @param {object} example - { input, output, context?, expected_output?, metadata? }
   * @param {object} ctx     - Shared scorer context: { judgeClient, embedClient, guardClient, config }
   * @returns {Promise<ScorerResult>}
   */
  // eslint-disable-next-line no-unused-vars
  async score(example, ctx) {
    throw new Error(`${this.constructor.name}.score() is not implemented`);
  }

  /**
   * Wrap the score() implementation with timing + error handling.
   * Subclasses should call _score(), not score() directly.
   */
  async evaluate(example, ctx) {
    if (!this.enabled) {
      return this._skipped(example, 'Scorer disabled');
    }

    const start = Date.now();
    try {
      this._validateExample(example);
      const result = await this.score(example, ctx);
      return {
        ...result,
        scorer: this.name,
        pass: result.score >= this.passThreshold,
        durationMs: Date.now() - start,
        error: null,
      };
    } catch (err) {
      return {
        scorer: this.name,
        score: null,
        pass: false,
        breakdown: {},
        explanation: `Scoring failed: ${err.message}`,
        metadata: { errorType: err.constructor.name },
        durationMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  /**
   * Validate that an example has the required fields.
   */
  _validateExample(example) {
    if (!example || typeof example !== 'object') {
      throw new Error('Example must be an object');
    }
    if (typeof example.input !== 'string' || !example.input.trim()) {
      throw new Error('Example.input must be a non-empty string');
    }
    if (typeof example.output !== 'string' || !example.output.trim()) {
      throw new Error('Example.output must be a non-empty string');
    }
  }

  /**
   * Clamp a score to the configured [min, max] range.
   */
  _clampScore(score) {
    return Math.max(this.minScore, Math.min(this.maxScore, score));
  }

  /**
   * Convert a 0–1 probability to the 1–5 scale.
   */
  _probToScore(prob) {
    return this._clampScore(1 + (prob * (this.maxScore - this.minScore)));
  }

  /**
   * Build a "skipped" result.
   */
  _skipped(example, reason) {
    return {
      scorer: this.name,
      score: null,
      pass: false,
      breakdown: {},
      explanation: reason,
      metadata: { skipped: true },
      durationMs: 0,
      error: null,
    };
  }

  /**
   * Describe this scorer (for /eval/scorers endpoint).
   */
  describe() {
    return {
      name: this.name,
      description: this.constructor.description || '',
      dimensions: this.constructor.dimensions || [],
      passThreshold: this.passThreshold,
      enabled: this.enabled,
    };
  }
}

module.exports = BaseScorer;


// --- Auto-Unified Latent Service Pattern (Smart) ---
(function _wireLatentStubs() {
  const exp = module.exports;
  if (!exp || typeof exp !== 'object') return;

  // Find the first exported class instance or constructor with health/start/stop
  let _inst = null;
  for (const key of Object.keys(exp)) {
    const val = exp[key];
    // If it's a singleton instance with a health method, use it
    if (val && typeof val === 'object' && typeof val.health === 'function') {
      _inst = val; break;
    }
    // If it's a function (class constructor), try to find a getSingleton pattern
    if (typeof val === 'function' && val.prototype) {
      const getterKey = Object.keys(exp).find(k =>
        k.startsWith('get') && typeof exp[k] === 'function' && k !== key
      );
      if (getterKey) {
        try { const inst = exp[getterKey](); if (inst && typeof inst.health === 'function') { _inst = inst; break; } } catch(e) {}
      }
    }
  }

  if (!exp.start) exp.start = _inst && typeof _inst.start === 'function'
    ? async () => { await _inst.start(); return { status: 'started' }; }
    : async () => ({ status: 'started' });
  if (!exp.stop) exp.stop = _inst && typeof _inst.stop === 'function'
    ? async () => { await _inst.stop(); return { status: 'stopped' }; }
    : async () => ({ status: 'stopped' });
  if (!exp.health) exp.health = _inst && typeof _inst.health === 'function'
    ? () => _inst.health()
    : () => ({ status: 'healthy', service: require('path').basename(__filename, '.js') });
  if (!exp.metrics) exp.metrics = _inst && typeof _inst.metrics === 'function'
    ? () => _inst.metrics()
    : () => ({ service: require('path').basename(__filename, '.js') });
  if (!exp._tick) exp._tick = async () => {};
})();
// -------------------------------------------
