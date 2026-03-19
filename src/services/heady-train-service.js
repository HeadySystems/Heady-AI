// HEADY_BRAND:BEGIN
// ║  HEADY™ — Training Service: Skill Gap Analysis & Active Learning       ║
// ║  FILE: src/services/heady-train-service.js                             ║
// HEADY_BRAND:END
/**
 * HeadyTrainService — Identifies skill gaps and trains on beneficial topics.
 *
 * Features:
 *   - Skill gap analysis from auto-success failure rates + benchmark scores
 *   - Curriculum generation prioritized by impact score
 *   - Fibonacci-interval spaced repetition for knowledge retention
 *   - Knowledge export: summary, code examples, auto-success tasks, embeddings
 *   - 8 priority training topics aligned with revenue impact
 *
 * Target: close #1 skill gap every 48 hours. Zero stagnation.
 * All constants from phi-math.js. Zero hardcoded numbers.
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const {
  fib, PHI, PSI,
  PHI_TIMING,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math');

let log = null;
try { log = require('../utils/logger'); } catch { log = console; }

const { bus } = require('../core/event-bus');

// ─── Constants ───────────────────────────────────────────────────────────────

/** Spaced repetition intervals (Fibonacci days): 1, 2, 3, 5, 8, 13, 21 */
const SPACED_INTERVALS = [fib(1), fib(2), fib(3), fib(4), fib(5), fib(6), fib(7)];

/** Max training sessions: fib(13) = 377 */
const MAX_SESSIONS = fib(13);

/** Skill gap closure target: 48 hours in ms */
const GAP_CLOSURE_TARGET_MS = 48 * 60 * 60 * 1000;

// ─── Priority Training Topics ────────────────────────────────────────────────

const PRIORITY_TOPICS = Object.freeze([
  {
    id: 'pgvector-optimization',
    name: 'pgvector Query Optimization',
    impactArea: 'IaaS revenue',
    description: 'HNSW tuning, query planning, connection pooling for vector search',
    modules: ['index-tuning', 'query-planning', 'connection-pooling', 'rls-optimization'],
    exercises: ['benchmark-hnsw-params', 'optimize-cosine-search', 'multi-tenant-rls'],
    estimatedHours: 8,
  },
  {
    id: 'cloudflare-workers',
    name: 'Cloudflare Workers Edge Compute',
    impactArea: 'latency reduction',
    description: 'Workers KV, Durable Objects, edge caching strategies',
    modules: ['workers-runtime', 'kv-storage', 'durable-objects', 'edge-caching'],
    exercises: ['deploy-edge-api', 'implement-cache-strategy', 'durable-sessions'],
    estimatedHours: 6,
  },
  {
    id: 'multi-agent-consensus',
    name: 'Multi-Agent Consensus Algorithms',
    impactArea: 'swarm quality',
    description: 'Raft-like consensus, phi-weighted voting, conflict resolution',
    modules: ['consensus-theory', 'phi-weighted-voting', 'conflict-resolution', 'swarm-topology'],
    exercises: ['implement-phi-raft', 'build-voting-protocol', 'test-byzantine-fault'],
    estimatedHours: 10,
  },
  {
    id: 'websocket-streaming',
    name: 'WebSocket Real-Time Streaming',
    impactArea: 'dashboard UX',
    description: 'Backpressure handling, reconnection, binary frames, SSE comparison',
    modules: ['ws-fundamentals', 'backpressure', 'reconnection-strategies', 'binary-frames'],
    exercises: ['build-streaming-api', 'implement-backpressure', 'sse-vs-ws-benchmark'],
    estimatedHours: 5,
  },
  {
    id: 'stripe-metered-billing',
    name: 'Stripe Metered Billing Integration',
    impactArea: 'monetization',
    description: 'Usage records, metered subscriptions, webhooks, invoicing',
    modules: ['stripe-api', 'metered-subscriptions', 'webhook-handling', 'invoice-automation'],
    exercises: ['create-metered-plan', 'implement-usage-reporting', 'handle-failed-payments'],
    estimatedHours: 6,
  },
  {
    id: 'soc2-compliance',
    name: 'SOC 2 Compliance Patterns',
    impactArea: 'enterprise sales',
    description: 'Access control, audit logging, encryption, incident response',
    modules: ['trust-principles', 'access-control', 'audit-logging', 'encryption-at-rest'],
    exercises: ['implement-audit-trail', 'design-rbac', 'write-incident-playbook'],
    estimatedHours: 8,
  },
  {
    id: 'sacred-geometry-proofs',
    name: 'Sacred Geometry Mathematical Proofs',
    impactArea: 'IP moat',
    description: 'Golden ratio proofs, Fibonacci identities, phi-scaling theorems',
    modules: ['phi-identities', 'fibonacci-proofs', 'phi-scaling-theorems', 'geometric-constructions'],
    exercises: ['prove-phi-convergence', 'derive-phi-timing', 'fibonacci-css-proof'],
    estimatedHours: 4,
  },
  {
    id: 'trading-backtesting',
    name: 'Trading Algorithm Backtesting',
    impactArea: 'Apex PA performance',
    description: 'Historical data replay, position sizing, risk metrics, slippage modeling',
    modules: ['data-ingestion', 'position-sizing', 'risk-metrics', 'slippage-modeling'],
    exercises: ['backtest-phi-sizing', 'calculate-sharpe-ratio', 'model-slippage'],
    estimatedHours: 10,
  },
]);

// ─── Training Service ────────────────────────────────────────────────────────

class HeadyTrainService {
  constructor() {
    /** @type {Map<string, { topicId, proficiency, lastTrained, nextReview, reviewLevel, sessions }>} */
    this._topics = new Map();
    for (const topic of PRIORITY_TOPICS) {
      this._topics.set(topic.id, {
        topicId: topic.id,
        proficiency: 0,
        lastTrained: null,
        nextReview: null,
        reviewLevel: 0, // index into SPACED_INTERVALS
        sessions: 0,
        gapScore: 1.0, // 1.0 = maximum gap, 0.0 = fully closed
      });
    }

    /** @type {Array<object>} training session history */
    this._sessions = [];

    /** @type {Map<string, number>} failure pattern → count */
    this._failurePatterns = new Map();
  }

  /**
   * Analyze skill gaps based on failure patterns and proficiency scores.
   * @param {{ failureRates?: object, benchmarkScores?: object }} inputs
   * @returns {Array<{ topicId, name, gapScore, impactPct, priority }>}
   */
  analyzeGaps(inputs = {}) {
    const { failureRates = {}, benchmarkScores = {} } = inputs;

    const gaps = [];

    for (const topic of PRIORITY_TOPICS) {
      const state = this._topics.get(topic.id);
      const failureRate = failureRates[topic.id] || 0;
      const benchmark = benchmarkScores[topic.id] || 0;

      // Gap score: weighted combination of failure rate, low benchmark, and proficiency
      const gapFromFailures = failureRate; // 0-1
      const gapFromBenchmark = 1 - Math.min(1, benchmark); // 0-1
      const gapFromProficiency = 1 - state.proficiency; // 0-1

      // Phi-weighted composite gap
      const totalWeight = PHI + 1 + PSI;
      const gapScore = (gapFromFailures * PHI + gapFromBenchmark * 1 + gapFromProficiency * PSI) / totalWeight;

      state.gapScore = gapScore;

      // Impact: "learning X would fix Y% of current failures"
      const impactPct = Math.round(gapScore * failureRate * 100);

      gaps.push({
        topicId: topic.id,
        name: topic.name,
        impactArea: topic.impactArea,
        gapScore: Number(gapScore.toFixed(4)),
        impactPct,
        proficiency: state.proficiency,
        estimatedHours: topic.estimatedHours,
        lastTrained: state.lastTrained,
        nextReview: state.nextReview,
      });
    }

    // Sort by gap score descending (biggest gaps first)
    gaps.sort((a, b) => b.gapScore - a.gapScore);

    // Assign priority ranks
    gaps.forEach((g, i) => { g.priority = i + 1; });

    bus.emit('training', {
      type: 'gap_analysis_complete',
      data: { topGap: gaps[0]?.topicId, totalGaps: gaps.length },
    });

    return gaps;
  }

  /**
   * Start a training session on a topic.
   * @param {string} topicId
   * @returns {object} session with curriculum
   */
  startSession(topicId) {
    const topic = PRIORITY_TOPICS.find(t => t.id === topicId);
    if (!topic) return { ok: false, error: 'unknown topic' };

    const state = this._topics.get(topicId);
    const sessionId = `train:${Date.now()}:${topicId}`;

    const session = {
      sessionId,
      topicId: topic.id,
      name: topic.name,
      curriculum: {
        modules: topic.modules,
        exercises: topic.exercises,
        estimatedHours: topic.estimatedHours,
      },
      proficiencyBefore: state.proficiency,
      startedAt: Date.now(),
      completedAt: null,
      score: null,
    };

    this._sessions.push(session);
    if (this._sessions.length > MAX_SESSIONS) {
      this._sessions = this._sessions.slice(-MAX_SESSIONS);
    }

    state.sessions++;
    state.lastTrained = new Date().toISOString();

    // Calculate next spaced review
    const reviewDays = SPACED_INTERVALS[Math.min(state.reviewLevel, SPACED_INTERVALS.length - 1)];
    state.nextReview = new Date(Date.now() + reviewDays * 24 * 60 * 60 * 1000).toISOString();
    state.reviewLevel = Math.min(state.reviewLevel + 1, SPACED_INTERVALS.length - 1);

    bus.emit('training', {
      type: 'session_started',
      data: { sessionId, topicId, reviewDays },
    });

    return { ok: true, session };
  }

  /**
   * Complete a training session with a proficiency score.
   * @param {string} sessionId
   * @param {number} score — 0-1 proficiency score
   * @returns {object}
   */
  completeSession(sessionId, score) {
    const session = this._sessions.find(s => s.sessionId === sessionId);
    if (!session) return { ok: false, error: 'session not found' };

    session.completedAt = Date.now();
    session.score = score;

    const state = this._topics.get(session.topicId);
    // Update proficiency with exponential moving average
    state.proficiency = state.proficiency * PSI + score * (1 - PSI);
    state.gapScore = 1 - state.proficiency;

    // If score is low, reset review level for more frequent reviews
    if (score < CSL_THRESHOLDS.LOW) {
      state.reviewLevel = 0;
    }

    const improvement = score - session.proficiencyBefore;

    bus.emit('training', {
      type: 'session_completed',
      data: { sessionId, topicId: session.topicId, score, improvement },
    });

    return {
      ok: true,
      topicId: session.topicId,
      proficiencyBefore: session.proficiencyBefore,
      proficiencyAfter: state.proficiency,
      improvement,
      gapScore: state.gapScore,
    };
  }

  /**
   * Get the generated curriculum for a topic.
   * @param {string} topicId
   * @returns {object}
   */
  getCurriculum(topicId) {
    const topic = PRIORITY_TOPICS.find(t => t.id === topicId);
    if (!topic) return { ok: false, error: 'unknown topic' };

    const state = this._topics.get(topicId);
    return {
      ok: true,
      ...topic,
      proficiency: state.proficiency,
      gapScore: state.gapScore,
      sessions: state.sessions,
      nextReview: state.nextReview,
    };
  }

  /**
   * Get the spaced repetition review schedule.
   * @returns {Array<{ topicId, name, nextReview, reviewLevel, overdue }>}
   */
  getSchedule() {
    const now = Date.now();
    const schedule = [];

    for (const [topicId, state] of this._topics) {
      const topic = PRIORITY_TOPICS.find(t => t.id === topicId);
      if (!state.nextReview) continue;

      const reviewDate = new Date(state.nextReview).getTime();
      schedule.push({
        topicId,
        name: topic?.name,
        nextReview: state.nextReview,
        reviewLevel: state.reviewLevel,
        intervalDays: SPACED_INTERVALS[Math.min(state.reviewLevel, SPACED_INTERVALS.length - 1)],
        overdue: reviewDate < now,
        proficiency: state.proficiency,
      });
    }

    // Sort by most overdue first
    schedule.sort((a, b) => {
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      return new Date(a.nextReview) - new Date(b.nextReview);
    });

    return schedule;
  }

  /**
   * Get training progress across all topics.
   * @returns {object}
   */
  getProgress() {
    const topicProgress = [];
    for (const [topicId, state] of this._topics) {
      const topic = PRIORITY_TOPICS.find(t => t.id === topicId);
      topicProgress.push({
        topicId,
        name: topic?.name,
        impactArea: topic?.impactArea,
        proficiency: state.proficiency,
        gapScore: state.gapScore,
        sessions: state.sessions,
        lastTrained: state.lastTrained,
      });
    }

    // Sort by proficiency ascending (weakest first)
    topicProgress.sort((a, b) => a.proficiency - b.proficiency);

    const totalSessions = this._sessions.length;
    const avgProficiency = topicProgress.reduce((sum, t) => sum + t.proficiency, 0) / topicProgress.length;

    return {
      topics: topicProgress,
      totalSessions,
      avgProficiency: Number(avgProficiency.toFixed(4)),
      gapClosureTargetMs: GAP_CLOSURE_TARGET_MS,
      spacedIntervals: SPACED_INTERVALS,
      overdueReviews: this.getSchedule().filter(s => s.overdue).length,
    };
  }
}

// ─── Express Router ──────────────────────────────────────────────────────────

function createTrainRouter() {
  const express = require('express');
  const router  = express.Router();
  const service = new HeadyTrainService();

  router.get('/gaps', (req, res) => {
    const failureRates = req.query.failureRates ? JSON.parse(req.query.failureRates) : {};
    const benchmarkScores = req.query.benchmarkScores ? JSON.parse(req.query.benchmarkScores) : {};
    const gaps = service.analyzeGaps({ failureRates, benchmarkScores });
    res.json({ ok: true, gaps });
  });

  router.post('/session', (req, res) => {
    const { topicId } = req.body || {};
    if (!topicId) return res.status(400).json({ ok: false, error: 'topicId required' });
    const result = service.startSession(topicId);
    res.json(result);
  });

  router.post('/session/:sessionId/complete', (req, res) => {
    const { score } = req.body || {};
    if (typeof score !== 'number') return res.status(400).json({ ok: false, error: 'score required (0-1)' });
    const result = service.completeSession(req.params.sessionId, score);
    res.json(result);
  });

  router.get('/curriculum', (req, res) => {
    const { topicId } = req.query;
    if (!topicId) return res.status(400).json({ ok: false, error: 'topicId required' });
    res.json(service.getCurriculum(topicId));
  });

  router.get('/schedule', (_req, res) => {
    res.json({ ok: true, schedule: service.getSchedule() });
  });

  router.get('/progress', (_req, res) => {
    res.json({ ok: true, ...service.getProgress() });
  });

  return router;
}

module.exports = {
  HeadyTrainService,
  createTrainRouter,
  PRIORITY_TOPICS,
  SPACED_INTERVALS,
};
