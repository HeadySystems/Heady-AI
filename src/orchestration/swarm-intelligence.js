/**
 * Heady™ Latent OS v5.4.0
 * © 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents
 * ZERO MAGIC NUMBERS — All constants φ-derived or Fibonacci
 *
 * SWARM INTELLIGENCE — Collective Intelligence Module
 *
 * Implements swarm consensus algorithms for multi-agent decision making.
 * Multiple bee swarms independently process a task, then results are
 * aggregated via CSL CONSENSUS with phi-weighted scoring.
 *
 * Patterns:
 *   - Arena Mode: competitive evaluation of multiple approaches
 *   - Consensus Mode: aggregate agreement from multiple agents
 *   - Delegation Mode: route subtasks to specialist swarms
 */
'use strict';

const { EventEmitter } = require('events');
const {
  PHI, PSI, fib, CSL_THRESHOLDS, PHI_TIMING,
  sigmoid,
} = require('../../shared/phi-math');

// ─── φ-Constants ─────────────────────────────────────────────────────────────

const MIN_QUORUM             = fib(4);                      // 3 agents minimum for consensus
const MAX_ARENA_COMPETITORS  = fib(6);                      // 8 competing approaches
const CONSENSUS_THRESHOLD    = CSL_THRESHOLDS.MEDIUM;       // 0.809 agreement needed
const ARENA_TIMEOUT_MS       = PHI_TIMING.PHI_7;           // 29 034ms per arena round
const DELEGATION_TIMEOUT_MS  = PHI_TIMING.PHI_6;           // 17 944ms per delegation
const CONFIDENCE_DECAY_RATE  = PSI;                         // φ-decay for stale scores
const SWARM_HISTORY_SIZE     = fib(11);                     // 89 entries

// ─── Logger ─────────────────────────────────────────────────────────────────

function log(level, msg, meta = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: 'swarm-intelligence',
    msg,
    ...meta,
  });
  process.stdout.write(entry + '\n');
}

// ─── SwarmIntelligence Class ────────────────────────────────────────────────

class SwarmIntelligence extends EventEmitter {
  constructor() {
    super();
    this.arenaHistory = [];
    this.consensusHistory = [];
    this.swarmMetrics = new Map();
  }

  // ─── Arena Mode — Competitive Evaluation ──────────────────────────────
  // Multiple agents/approaches compete; best result wins

  async runArena(task, competitors) {
    if (competitors.length < 2) {
      throw new Error(`Arena requires at least 2 competitors, got ${competitors.length}`);
    }
    if (competitors.length > MAX_ARENA_COMPETITORS) {
      throw new Error(`Arena max competitors: ${MAX_ARENA_COMPETITORS}`);
    }

    const arenaId = `arena_${Date.now()}`;
    const startMs = Date.now();

    log('info', 'Arena starting', {
      arenaId,
      task: typeof task === 'string' ? task.substring(0, fib(11)) : 'function',
      competitors: competitors.length,
    });

    // Run all competitors concurrently
    const results = await Promise.allSettled(
      competitors.map((competitor, idx) =>
        Promise.race([
          competitor.execute(task),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Arena timeout')), ARENA_TIMEOUT_MS)
          ),
        ]).then((result) => ({
          competitorId: competitor.id || `competitor_${idx}`,
          result,
          confidence: competitor.confidence || PSI,
        }))
      )
    );

    // Score results
    const scored = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    const winner = scored[0] || null;
    const arenaResult = {
      arenaId,
      task: typeof task === 'string' ? task.substring(0, fib(11)) : '[function]',
      winner: winner ? winner.competitorId : null,
      winnerConfidence: winner ? winner.confidence : 0,
      allScores: scored.map((s) => ({
        id: s.competitorId,
        confidence: s.confidence,
      })),
      totalCompetitors: competitors.length,
      successfulCompetitors: scored.length,
      durationMs: Date.now() - startMs,
    };

    // Record history
    this.arenaHistory.push(arenaResult);
    if (this.arenaHistory.length > SWARM_HISTORY_SIZE) {
      this.arenaHistory.shift();
    }

    log('info', 'Arena complete', arenaResult);
    this.emit('swarm:arena_complete', arenaResult);
    return arenaResult;
  }

  // ─── Consensus Mode — Aggregate Agreement ─────────────────────────────
  // Multiple agents vote; consensus is phi-weighted centroid

  async runConsensus(task, agents) {
    if (agents.length < MIN_QUORUM) {
      throw new Error(`Consensus requires quorum of ${MIN_QUORUM}, got ${agents.length}`);
    }

    const consensusId = `consensus_${Date.now()}`;

    // Gather opinions concurrently
    const opinions = await Promise.allSettled(
      agents.map((agent) =>
        Promise.race([
          agent.evaluate(task),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Consensus timeout')), DELEGATION_TIMEOUT_MS)
          ),
        ])
      )
    );

    const validOpinions = opinions
      .filter((o) => o.status === 'fulfilled')
      .map((o) => o.value);

    if (validOpinions.length < MIN_QUORUM) {
      return {
        consensusId,
        reached: false,
        reason: 'insufficient_quorum',
        required: MIN_QUORUM,
        received: validOpinions.length,
      };
    }

    // Compute phi-weighted consensus score
    const scores = validOpinions
      .map((o) => o.confidence || PSI)
      .sort((a, b) => b - a);

    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < scores.length; i++) {
      const weight = Math.pow(PSI, i);
      weightedSum += scores[i] * weight;
      weightTotal += weight;
    }

    const consensusScore = weightedSum / weightTotal;
    const reached = consensusScore >= CONSENSUS_THRESHOLD;

    const result = {
      consensusId,
      reached,
      score: Math.round(consensusScore * 1000) / 1000,
      threshold: CONSENSUS_THRESHOLD,
      voterCount: validOpinions.length,
      opinions: validOpinions.map((o, i) => ({
        agentId: o.agentId || `agent_${i}`,
        confidence: o.confidence,
        recommendation: o.recommendation,
      })),
    };

    this.consensusHistory.push(result);
    if (this.consensusHistory.length > SWARM_HISTORY_SIZE) {
      this.consensusHistory.shift();
    }

    log('info', 'Consensus complete', {
      consensusId,
      reached,
      score: result.score,
      voters: validOpinions.length,
    });

    this.emit('swarm:consensus_complete', result);
    return result;
  }

  // ─── Delegation Mode — Route to Specialist ────────────────────────────

  async delegate(task, swarmPool) {
    // Find best-matching swarm by domain affinity
    let bestSwarm = null;
    let bestScore = 0;

    for (const swarm of swarmPool) {
      const score = swarm.affinityScore ? swarm.affinityScore(task) : PSI;
      if (score > bestScore) {
        bestScore = score;
        bestSwarm = swarm;
      }
    }

    if (!bestSwarm || bestScore < CSL_THRESHOLDS.MINIMUM) {
      return {
        success: false,
        reason: 'no_swarm_meets_threshold',
        bestScore,
        threshold: CSL_THRESHOLDS.MINIMUM,
      };
    }

    const result = await Promise.race([
      bestSwarm.execute(task),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Delegation timeout')), DELEGATION_TIMEOUT_MS)
      ),
    ]);

    return {
      success: true,
      swarmId: bestSwarm.id,
      affinityScore: bestScore,
      result,
    };
  }

  // ─── Get Metrics ──────────────────────────────────────────────────────

  getMetrics() {
    return {
      arenaRuns: this.arenaHistory.length,
      consensusRuns: this.consensusHistory.length,
      lastArena: this.arenaHistory[this.arenaHistory.length - 1] || null,
      lastConsensus: this.consensusHistory[this.consensusHistory.length - 1] || null,
    };
  }
}

module.exports = {
  SwarmIntelligence,
  MIN_QUORUM,
  MAX_ARENA_COMPETITORS,
  CONSENSUS_THRESHOLD,
};
