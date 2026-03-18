/**
 * @fileoverview HeadyReputationEngineService — Decentralized trust scoring.
 * Multi-dimensional reputation vectors using phi-weighted ELO ratings,
 * CSL-gated trust thresholds, Fibonacci-windowed behavioral history,
 * and graph-based endorsement propagation for agents, services, and providers.
 * @module heady-reputation-engine-service
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

// ── PHI-MATH CONSTANTS ──────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

/** Initial ELO rating, derived from Fibonacci */
const BASE_ELO = FIB[13]; // 233
/** ELO K-factor scaled by PHI */
const ELO_K = FIB[5] * PHI; // ~8.09
/** Reputation dimensions */
const REPUTATION_DIMS = ['reliability', 'quality', 'speed', 'security', 'cooperation'];
/** Trust tiers mapped to CSL */
const TRUST_TIERS = {
  UNTRUSTED: { min: 0, max: CSL.MINIMUM, label: 'Untrusted' },
  PROVISIONAL: { min: CSL.MINIMUM, max: CSL.LOW, label: 'Provisional' },
  TRUSTED: { min: CSL.LOW, max: CSL.HIGH, label: 'Trusted' },
  HIGHLY_TRUSTED: { min: CSL.HIGH, max: CSL.CRITICAL, label: 'Highly Trusted' },
  SOVEREIGN: { min: CSL.CRITICAL, max: 1.0, label: 'Sovereign' }
};

/**
 * Structured JSON logger.
 * @param {string} level - Log level
 * @param {string} msg - Message
 * @param {Object} meta - Metadata
 * @param {string} [correlationId] - Correlation ID
 */
function log(level, msg, meta = {}, correlationId = null) {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'heady-reputation-engine-service',
    level,
    correlationId: correlationId || crypto.randomUUID(),
    message: msg,
    ...meta
  }) + '\n');
}

/**
 * Phi-backoff delay.
 * @param {number} attempt - Attempt number
 * @returns {number} Delay in ms
 */
function phiBackoff(attempt) {
  return FIB[Math.min(attempt, FIB.length - 1)] * PSI * 1000;
}

/**
 * HeadyReputationEngineService — Decentralized trust scoring engine.
 */
class HeadyReputationEngineService {
  /**
   * @param {Object} config - Service configuration
   * @param {number} [config.port=3405] - HTTP port
   * @param {number} [config.maxEntities] - Maximum tracked entities
   * @param {number} [config.historyWindow] - Fibonacci-windowed history length
   */
  constructor(config = {}) {
    this.port = config.port || 3405;
    this.maxEntities = config.maxEntities || FIB[12]; // 144
    this.historyWindow = config.historyWindow || FIB[10]; // 55
    /**
     * @type {Map<string, {
     *   id: string, type: string,
     *   elo: Object<string, number>,
     *   history: Array<{action: string, outcome: number, timestamp: number}>,
     *   endorsements: Map<string, number>,
     *   trustScore: number, tier: string
     * }>}
     */
    this.entities = new Map();
    /** @type {Map<string, Set<string>>} */
    this.endorsementGraph = new Map();
    this.app = express();
    this.server = null;
    this._started = false;
    this._coherence = CSL.HIGH;
  }

  /**
   * Register an entity (agent, service, provider) for reputation tracking.
   * @param {string} entityId - Entity identifier
   * @param {string} type - Entity type (agent, service, provider)
   * @returns {Object} Registration result
   */
  registerEntity(entityId, type = 'agent') {
    if (this.entities.size >= this.maxEntities && !this.entities.has(entityId)) {
      // Evict lowest-trust entity
      let lowestId = null;
      let lowestTrust = Infinity;
      for (const [id, entity] of this.entities) {
        if (entity.trustScore < lowestTrust) {
          lowestTrust = entity.trustScore;
          lowestId = id;
        }
      }
      if (lowestId) this.entities.delete(lowestId);
    }

    const elo = {};
    for (const dim of REPUTATION_DIMS) elo[dim] = BASE_ELO;

    const entity = {
      id: entityId,
      type,
      elo,
      history: [],
      endorsements: new Map(),
      trustScore: CSL.MEDIUM,
      tier: 'TRUSTED',
      registeredAt: Date.now()
    };

    this.entities.set(entityId, entity);
    if (!this.endorsementGraph.has(entityId)) this.endorsementGraph.set(entityId, new Set());
    log('info', 'Entity registered', { entityId, type });
    return { entityId, type, elo, trustScore: entity.trustScore, tier: entity.tier };
  }

  /**
   * Record an interaction outcome and update ELO ratings.
   * Uses phi-weighted ELO calculation.
   * @param {string} entityId - Entity identifier
   * @param {string} dimension - Reputation dimension
   * @param {number} outcome - Outcome score [0, 1]
   * @param {string} [opponentId] - Opponent entity for comparative rating
   * @returns {Object} Updated ratings
   */
  recordOutcome(entityId, dimension, outcome, opponentId = null) {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error('Entity not found');
    if (!REPUTATION_DIMS.includes(dimension)) throw new Error(`Invalid dimension: ${dimension}`);

    const currentElo = entity.elo[dimension];
    let expectedScore;

    if (opponentId && this.entities.has(opponentId)) {
      const opponent = this.entities.get(opponentId);
      const opponentElo = opponent.elo[dimension];
      // Standard ELO expected score with phi-scaled denominator
      expectedScore = 1 / (1 + Math.pow(FIB[7], (opponentElo - currentElo) / (BASE_ELO * PHI)));
      // Update opponent
      const opponentExpected = 1 - expectedScore;
      opponent.elo[dimension] = Math.round(opponentElo + ELO_K * ((1 - outcome) - opponentExpected));
      this._recalculateTrust(opponentId);
    } else {
      expectedScore = PSI; // Default expected performance
    }

    // Phi-weighted ELO update
    entity.elo[dimension] = Math.round(currentElo + ELO_K * (outcome - expectedScore));

    // Record in Fibonacci-windowed history
    entity.history.push({ action: dimension, outcome, timestamp: Date.now() });
    if (entity.history.length > this.historyWindow) {
      entity.history = entity.history.slice(entity.history.length - this.historyWindow);
    }

    this._recalculateTrust(entityId);

    return {
      entityId,
      dimension,
      previousElo: currentElo,
      newElo: entity.elo[dimension],
      trustScore: entity.trustScore,
      tier: entity.tier
    };
  }

  /**
   * Recalculate trust score from multi-dimensional ELO ratings.
   * Trust = phi-weighted average of normalized dimension scores + endorsement bonus.
   * @param {string} entityId - Entity identifier
   * @private
   */
  _recalculateTrust(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    // Normalize ELO scores to [0, 1] range using sigmoid
    const normalizedScores = {};
    for (const dim of REPUTATION_DIMS) {
      normalizedScores[dim] = 1 / (1 + Math.exp(-(entity.elo[dim] - BASE_ELO) / (BASE_ELO * PSI)));
    }

    // Phi-weighted average: security and reliability weighted higher
    const weights = {
      reliability: PHI * PHI,
      quality: PHI,
      speed: 1,
      security: PHI * PHI * PHI,
      cooperation: PHI
    };

    let weightedSum = 0;
    let totalWeight = 0;
    for (const dim of REPUTATION_DIMS) {
      weightedSum += normalizedScores[dim] * weights[dim];
      totalWeight += weights[dim];
    }

    const baseScore = weightedSum / totalWeight;

    // Endorsement bonus: each endorser contributes their own trust * PSI^distance
    const endorsers = this.endorsementGraph.get(entityId) || new Set();
    let endorsementBonus = 0;
    for (const endorserId of endorsers) {
      const endorser = this.entities.get(endorserId);
      if (endorser) {
        endorsementBonus += endorser.trustScore * PSI * PSI;
      }
    }
    endorsementBonus = Math.min(endorsementBonus, PSI * 0.1); // Cap bonus

    entity.trustScore = Math.min(1, baseScore + endorsementBonus);

    // Assign tier
    for (const [tier, range] of Object.entries(TRUST_TIERS)) {
      if (entity.trustScore >= range.min && entity.trustScore < range.max) {
        entity.tier = tier;
        break;
      }
    }
  }

  /**
   * Add an endorsement from one entity to another.
   * Endorsements propagate trust through the graph.
   * @param {string} endorserId - Endorsing entity
   * @param {string} endorseeId - Endorsed entity
   * @returns {Object} Endorsement result
   */
  endorse(endorserId, endorseeId) {
    if (!this.entities.has(endorserId)) throw new Error('Endorser not found');
    if (!this.entities.has(endorseeId)) throw new Error('Endorsee not found');
    if (endorserId === endorseeId) throw new Error('Self-endorsement not allowed');

    if (!this.endorsementGraph.has(endorseeId)) this.endorsementGraph.set(endorseeId, new Set());
    this.endorsementGraph.get(endorseeId).add(endorserId);

    this._recalculateTrust(endorseeId);

    const endorsee = this.entities.get(endorseeId);
    log('info', 'Endorsement recorded', { endorserId, endorseeId, newTrust: endorsee.trustScore });
    return { endorserId, endorseeId, newTrust: endorsee.trustScore, tier: endorsee.tier };
  }

  /**
   * Revoke an endorsement.
   * @param {string} endorserId - Endorser
   * @param {string} endorseeId - Endorsee
   * @returns {Object} Revocation result
   */
  revokeEndorsement(endorserId, endorseeId) {
    const endorsers = this.endorsementGraph.get(endorseeId);
    if (endorsers) endorsers.delete(endorserId);
    this._recalculateTrust(endorseeId);
    const endorsee = this.entities.get(endorseeId);
    return { endorserId, endorseeId, newTrust: endorsee?.trustScore, revoked: true };
  }

  /**
   * Get full reputation profile for an entity.
   * @param {string} entityId - Entity identifier
   * @returns {Object} Full reputation profile
   */
  getProfile(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error('Entity not found');

    const endorsers = this.endorsementGraph.get(entityId) || new Set();
    const recentHistory = entity.history.slice(-FIB[7]); // Last 13

    // Fibonacci-windowed trend: compare recent vs older performance
    const oldHistory = entity.history.slice(0, -FIB[7]);
    const recentAvg = recentHistory.length > 0 ? recentHistory.reduce((s, h) => s + h.outcome, 0) / recentHistory.length : PSI;
    const oldAvg = oldHistory.length > 0 ? oldHistory.reduce((s, h) => s + h.outcome, 0) / oldHistory.length : PSI;
    const trend = recentAvg - oldAvg;

    return {
      id: entity.id,
      type: entity.type,
      elo: { ...entity.elo },
      trustScore: entity.trustScore,
      tier: entity.tier,
      endorserCount: endorsers.size,
      historyLength: entity.history.length,
      trend: { direction: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable', magnitude: Math.abs(trend) },
      recentOutcomes: recentHistory.map(h => ({ action: h.action, outcome: h.outcome })),
      registeredAt: entity.registeredAt
    };
  }

  /**
   * Get leaderboard ranked by trust score.
   * @param {string} [type] - Filter by entity type
   * @param {number} [limit] - Number of results
   * @returns {Array} Ranked entities
   */
  leaderboard(type = null, limit = FIB[7]) {
    let entities = Array.from(this.entities.values());
    if (type) entities = entities.filter(e => e.type === type);
    return entities
      .sort((a, b) => b.trustScore - a.trustScore)
      .slice(0, limit)
      .map(e => ({ id: e.id, type: e.type, trustScore: e.trustScore, tier: e.tier, elo: { ...e.elo } }));
  }

  /** Set up Express routes. @private */
  _setupRoutes() {
    this.app.use(express.json());

    this.app.get('/health', (_req, res) => {
      const avgTrust = this.entities.size > 0
        ? Array.from(this.entities.values()).reduce((s, e) => s + e.trustScore, 0) / this.entities.size
        : CSL.HIGH;
      this._coherence = avgTrust;
      res.json({
        status: avgTrust >= CSL.MEDIUM ? 'healthy' : 'degraded',
        coherence: avgTrust,
        trackedEntities: this.entities.size,
        endorsementEdges: Array.from(this.endorsementGraph.values()).reduce((s, set) => s + set.size, 0),
        timestamp: new Date().toISOString()
      });
    });

    this.app.post('/entity', (req, res) => {
      const result = this.registerEntity(req.body.entityId, req.body.type);
      res.status(201).json(result);
    });

    this.app.get('/entity/:id', (req, res) => {
      try { res.json(this.getProfile(req.params.id)); }
      catch (err) { res.status(404).json({ error: err.message }); }
    });

    this.app.post('/entity/:id/outcome', (req, res) => {
      try {
        const result = this.recordOutcome(req.params.id, req.body.dimension, req.body.outcome, req.body.opponentId);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });

    this.app.post('/endorse', (req, res) => {
      try { res.json(this.endorse(req.body.endorserId, req.body.endorseeId)); }
      catch (err) { res.status(400).json({ error: err.message }); }
    });

    this.app.delete('/endorse', (req, res) => {
      const result = this.revokeEndorsement(req.body.endorserId, req.body.endorseeId);
      res.json(result);
    });

    this.app.get('/leaderboard', (req, res) => {
      const limit = parseInt(req.query.limit) || FIB[7];
      res.json({ leaderboard: this.leaderboard(req.query.type || null, limit) });
    });
  }

  /** @returns {Promise<void>} */
  async start() {
    if (this._started) return;
    this._setupRoutes();
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this._started = true;
        log('info', 'HeadyReputationEngineService started', { port: this.port });
        resolve();
      });
    });
  }

  /** @returns {Promise<void>} */
  async stop() {
    if (!this._started) return;
    return new Promise((resolve) => {
      this.server.close(() => {
        this._started = false;
        log('info', 'HeadyReputationEngineService stopped');
        resolve();
      });
    });
  }

  /** @returns {Object} Health */
  health() {
    return { status: this._coherence >= CSL.MEDIUM ? 'healthy' : 'degraded', coherence: this._coherence, trackedEntities: this.entities.size };
  }
}

module.exports = { HeadyReputationEngineService, PHI, PSI, FIB, CSL, REPUTATION_DIMS, TRUST_TIERS, BASE_ELO, phiBackoff };
