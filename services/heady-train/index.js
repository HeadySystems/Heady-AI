/**
 * Heady Train Service — Skill gap analysis, curriculum, spaced repetition.
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 */
'use strict';
const crypto = require('crypto');
const PHI = (1 + Math.sqrt(5)) / 2;
const FIB_DAYS = [1, 2, 3, 5, 8, 13, 21]; // spaced repetition intervals

const PRIORITY_TOPICS = [
  { id: 'pgvector-optimization', name: 'pgvector Query Optimization', impact: 'IaaS revenue', domain: 'sql-pgvector', assessmentCriteria: 'Sub-100ms P95 query latency on 1M+ vectors' },
  { id: 'cloudflare-edge', name: 'Cloudflare Workers Edge Compute', impact: 'Latency reduction', domain: 'cloudflare-workers', assessmentCriteria: 'Deploy a Worker with <50ms cold start' },
  { id: 'multi-agent-consensus', name: 'Multi-Agent Consensus Algorithms', impact: 'Swarm quality', domain: 'agent-orchestration', assessmentCriteria: 'Implement Byzantine fault-tolerant consensus for 5+ agents' },
  { id: 'websocket-streaming', name: 'WebSocket Real-Time Streaming', impact: 'Dashboard UX', domain: 'nodejs', assessmentCriteria: 'Stream 1000 events/sec with <10ms latency' },
  { id: 'stripe-metered-billing', name: 'Stripe Metered Billing Integration', impact: 'Monetization', domain: 'nodejs', assessmentCriteria: 'Working metered subscription with usage reporting' },
  { id: 'soc2-compliance', name: 'SOC 2 Compliance Patterns', impact: 'Enterprise sales', domain: 'security-hardening', assessmentCriteria: 'Audit trail, access controls, encryption at rest' },
  { id: 'sacred-geometry-proofs', name: 'Sacred Geometry Mathematical Proofs', impact: 'IP moat', domain: 'sacred-geometry-css', assessmentCriteria: 'Formal proof that φ-timing improves UX metrics' },
  { id: 'trading-backtesting', name: 'Trading Algorithm Backtesting', impact: 'Apex PA performance', domain: 'trading-systems', assessmentCriteria: 'Backtest framework with Sharpe ratio > 1.5' },
];

class SkillGapAnalyzer {
  constructor() { this._scores = new Map(); this._errorPatterns = new Map(); }
  recordScore(domain, score) {
    const scores = this._scores.get(domain) || [];
    scores.push({ score, recordedAt: new Date().toISOString() });
    this._scores.set(domain, scores);
  }
  recordError(domain, errorType) {
    const count = this._errorPatterns.get(`${domain}:${errorType}`) || 0;
    this._errorPatterns.set(`${domain}:${errorType}`, count + 1);
  }
  getGaps() {
    const gaps = [];
    for (const topic of PRIORITY_TOPICS) {
      const scores = this._scores.get(topic.domain) || [];
      const avgScore = scores.length > 0 ? scores.reduce((s, e) => s + e.score, 0) / scores.length : 0;
      const errorCount = [...this._errorPatterns.entries()]
        .filter(([k]) => k.startsWith(topic.domain + ':'))
        .reduce((s, [, v]) => s + v, 0);
      gaps.push({ ...topic, avgScore, errorCount, gapSize: Math.max(0, 100 - avgScore) + errorCount * 5 });
    }
    return gaps.sort((a, b) => b.gapSize - a.gapSize);
  }
}

class SpacedRepetitionScheduler {
  constructor() { this._items = new Map(); }
  schedule(topicId, firstReviewDate = new Date()) {
    const reviews = FIB_DAYS.map((days, i) => {
      const date = new Date(firstReviewDate);
      date.setDate(date.getDate() + days);
      return { reviewNumber: i + 1, scheduledDate: date.toISOString().split('T')[0], intervalDays: days };
    });
    this._items.set(topicId, { reviews, currentReview: 0, lastScore: null });
    return reviews;
  }
  recordReview(topicId, score) {
    const item = this._items.get(topicId);
    if (!item) return null;
    item.lastScore = score;
    if (score >= 80) item.currentReview = Math.min(item.currentReview + 1, FIB_DAYS.length - 1);
    else item.currentReview = Math.max(0, item.currentReview - 1); // reset on failure
    return item;
  }
  getDueToday() {
    const today = new Date().toISOString().split('T')[0];
    const due = [];
    for (const [id, item] of this._items) {
      const review = item.reviews[item.currentReview];
      if (review && review.scheduledDate <= today) due.push({ topicId: id, review });
    }
    return due;
  }
}

class CurriculumGenerator {
  constructor(gapAnalyzer) { this._analyzer = gapAnalyzer; }
  generate(topN = 5) {
    const gaps = this._analyzer.getGaps().slice(0, topN);
    return gaps.map((gap, i) => ({
      priority: i + 1,
      topic: gap.name,
      domain: gap.domain,
      gapSize: gap.gapSize,
      impact: gap.impact,
      assessment: gap.assessmentCriteria,
      estimatedHours: Math.round(gap.gapSize / 10 * PHI),
      resources: [`docs/${gap.id}.md`, `exercises/${gap.id}/`],
    }));
  }
}

class TrainService {
  constructor() {
    this.gapAnalyzer = new SkillGapAnalyzer();
    this.scheduler = new SpacedRepetitionScheduler();
    this.curriculum = new CurriculumGenerator(this.gapAnalyzer);
    this._sessions = [];
  }
  startTrainingSession(topicId) {
    const session = {
      id: crypto.randomUUID(), topicId,
      startedAt: new Date().toISOString(), outputs: [],
    };
    this._sessions.push(session);
    return session;
  }
  completeSession(sessionId, score, outputs = []) {
    const session = this._sessions.find(s => s.id === sessionId);
    if (!session) return null;
    session.completedAt = new Date().toISOString();
    session.score = score;
    session.outputs = outputs;
    this.gapAnalyzer.recordScore(
      PRIORITY_TOPICS.find(t => t.id === session.topicId)?.domain || 'general', score
    );
    this.scheduler.recordReview(session.topicId, score);
    return session;
  }
  health() {
    return {
      service: 'heady-train', sessions: this._sessions.length,
      gaps: this.gapAnalyzer.getGaps().slice(0, 3).map(g => ({ topic: g.name, gap: g.gapSize })),
      dueToday: this.scheduler.getDueToday().length,
      topics: PRIORITY_TOPICS.length,
    };
  }
}

module.exports = { TrainService, SkillGapAnalyzer, SpacedRepetitionScheduler, CurriculumGenerator, PRIORITY_TOPICS };
