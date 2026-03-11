// HEADY_BRAND:BEGIN
// HEADY SYSTEMS :: SACRED GEOMETRY
// FILE: packages/hc-readiness/src/index.js
// LAYER: packages/hc-readiness
// HEADY_BRAND:END

'use strict';

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

/**
 * ReadinessEvaluator — Evaluates operational readiness via configurable probes.
 * Computes a 0-100 readiness score and determines operational mode.
 * Uses app-readiness.yaml probes for business-level health assessment.
 */
class ReadinessEvaluator {
  constructor(options = {}) {
    this.probes = options.probes || [];
    this.history = [];
    this.maxHistory = FIB[8]; // 21
  }

  /**
   * Run all registered probes and compute readiness score.
   */
  async evaluate() {
    const startTime = Date.now();
    const results = [];

    for (const probe of this.probes) {
      const result = await this._runProbe(probe);
      results.push(result);
    }

    // If no probes, return default healthy state
    if (results.length === 0) {
      const evaluation = {
        score: 85,
        mode: 'normal',
        probeCount: 0,
        results: [],
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
      this._record(evaluation);
      return evaluation;
    }

    // Compute weighted score
    const totalWeight = results.reduce((s, r) => s + (r.weight || 1), 0);
    const weightedScore = results.reduce((s, r) => {
      const weight = r.weight || 1;
      return s + (r.score * weight);
    }, 0) / totalWeight;

    const score = Math.round(Math.max(0, Math.min(100, weightedScore)));
    const mode = this._determineMode(score);

    const evaluation = {
      score,
      mode,
      probeCount: results.length,
      passCount: results.filter(r => r.pass).length,
      failCount: results.filter(r => !r.pass).length,
      results,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    this._record(evaluation);
    return evaluation;
  }

  async _runProbe(probe) {
    const startTime = Date.now();

    try {
      // Execute probe check function if provided
      if (typeof probe.check === 'function') {
        const result = await probe.check();
        return {
          name: probe.name || 'unnamed',
          score: result.score || (result.pass ? 100 : 0),
          pass: result.pass !== false,
          weight: probe.weight || 1,
          details: result,
          durationMs: Date.now() - startTime,
        };
      }

      // Static probe — always passes
      return {
        name: probe.name || 'unnamed',
        score: 100,
        pass: true,
        weight: probe.weight || 1,
        details: { type: 'static', config: probe },
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        name: probe.name || 'unnamed',
        score: 0,
        pass: false,
        weight: probe.weight || 1,
        error: err.message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  _determineMode(score) {
    if (score > 85) return 'aggressive';
    if (score > 70) return 'normal';
    if (score > 50) return 'maintenance';
    return 'recovery';
  }

  _record(evaluation) {
    this.history.push(evaluation);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  getHistory() {
    return this.history;
  }

  getLatest() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }
}

module.exports = { ReadinessEvaluator };
