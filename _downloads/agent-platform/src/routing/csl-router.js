// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ CSL Router v1.0.0                                      ║
// ║  Continuous Semantic Logic routing — cosine similarity gates    ║
// ║  for deterministic task-to-swarm assignment                    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { EventEmitter } from 'events';
import { PlatformConfig } from '../../config/platform-config.js';

const PHI = 1.6180339887498948;
const PSI = 0.6180339887498949;

/**
 * CSLRouter — Routes tasks to swarms using cosine similarity against domain embeddings.
 *
 * This is NOT if/else routing. This is geometric logic:
 *   CSL AND = cosine(a, b)           — how well two concepts align
 *   CSL NOT = a - proj(a, b)         — orthogonal rejection
 *   CSL OR  = normalize(a + b)       — superposition
 *   CSL GATE = cos(a, b) >= tau      — pass/reject threshold
 *
 * ⚠️ PATENT LOCK — HS-2026-051: Continuous Semantic Logic Gating
 */
export class CSLRouter extends EventEmitter {
  /**
   * @param {Function} embedFn — async (text) => number[]
   */
  constructor(embedFn) {
    super();
    this._embedFn = embedFn;
    this._swarmEmbeddings = new Map();   // swarmId → { domain, embedding }
    this._routeCache = new Map();         // taskHash → { swarmId, score, timestamp }
    this._cacheMaxSize = 89;              // F(11)
    this._cacheTtlMs = PHI * PHI * 10000; // ~26.2s
  }

  /**
   * Register a swarm domain for routing.
   * @param {string} swarmId
   * @param {string} domain — Semantic domain description
   */
  async registerSwarm(swarmId, domain) {
    const embedding = await this._embed(domain);
    this._swarmEmbeddings.set(swarmId, { domain, embedding });
  }

  /**
   * Route a task to the best swarm using CSL gates.
   *
   * @param {object} task — { id, description, domain?, priority? }
   * @returns {Promise<{ swarmId, score, scores[], confidence }>}
   */
  async route(task) {
    const taskText = task.description || task.domain || task.id;

    // Check cache
    const cacheKey = this._hashTask(taskText);
    const cached = this._routeCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this._cacheTtlMs)) {
      return { ...cached, fromCache: true };
    }

    // Embed the task
    const taskEmbedding = await this._embed(taskText);

    // Score against all swarms
    const scores = [];
    for (const [swarmId, { embedding }] of this._swarmEmbeddings) {
      const cosScore = this._cosineSimilarity(taskEmbedding, embedding);
      scores.push({ swarmId, score: cosScore });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // CSL Gate: top match must exceed threshold
    const best = scores[0];
    if (!best) {
      return { swarmId: null, score: 0, scores, confidence: 0 };
    }

    // Confidence: gap between #1 and #2 (larger gap = higher confidence)
    const secondBest = scores[1]?.score || 0;
    const confidence = best.score - secondBest;

    const result = {
      swarmId: best.swarmId,
      score: Math.round(best.score * 1000) / 1000,
      confidence: Math.round(confidence * 1000) / 1000,
      scores: scores.slice(0, 5), // Top 5
      threshold: this._getThreshold(best.score),
      timestamp: Date.now(),
    };

    // Cache result
    this._routeCache.set(cacheKey, result);
    if (this._routeCache.size > this._cacheMaxSize) {
      const firstKey = this._routeCache.keys().next().value;
      this._routeCache.delete(firstKey);
    }

    this.emit('route:result', result);
    return result;
  }

  /**
   * Multi-route: find ALL swarms above a CSL threshold.
   * Used for broadcast/fan-out patterns.
   *
   * @param {object} task — Task to route
   * @param {number} minScore — Minimum CSL score
   * @returns {Promise<Array<{ swarmId, score }>>}
   */
  async multiRoute(task, minScore = PlatformConfig.csl.low) {
    const taskEmbedding = await this._embed(task.description || task.id);

    const matches = [];
    for (const [swarmId, { embedding }] of this._swarmEmbeddings) {
      const cosScore = this._cosineSimilarity(taskEmbedding, embedding);
      if (cosScore >= minScore) {
        matches.push({ swarmId, score: cosScore });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  // ─── CSL Operations ───────────────────────────────────────────────

  /**
   * CSL AND: cosine(a, b) — semantic alignment.
   */
  cslAnd(a, b) {
    return this._cosineSimilarity(a, b);
  }

  /**
   * CSL NOT: a - proj(a onto b) — orthogonal rejection.
   */
  cslNot(a, b) {
    const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    const scale = dot / (normB * normB || 1);
    return a.map((ai, i) => ai - scale * b[i]);
  }

  /**
   * CSL OR: normalize(a + b) — superposition.
   */
  cslOr(a, b) {
    const sum = a.map((ai, i) => ai + b[i]);
    const norm = Math.sqrt(sum.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? sum.map(v => v / norm) : sum;
  }

  /**
   * CSL GATE: cos(a, b) >= tau — threshold pass/reject.
   */
  cslGate(a, b, tau = PlatformConfig.csl.medium) {
    const score = this._cosineSimilarity(a, b);
    return { pass: score >= tau, score, tau };
  }

  // ─── Private Methods ──────────────────────────────────────────────

  _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  async _embed(text) {
    if (typeof this._embedFn === 'function') {
      return this._embedFn(text);
    }
    throw new Error('Embedding function not configured');
  }

  _hashTask(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `task_${hash}`;
  }

  _getThreshold(score) {
    if (score >= PlatformConfig.csl.high)   return 'HIGH';
    if (score >= PlatformConfig.csl.medium) return 'MEDIUM';
    if (score >= PlatformConfig.csl.low)    return 'LOW';
    return 'BELOW_THRESHOLD';
  }
}
