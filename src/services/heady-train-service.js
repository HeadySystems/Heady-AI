// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ TRAIN SERVICE — Skill Gap Analysis & Active Learning   ║
// ║  Identifies weakest areas, generates curricula, trains actively ║
// ║  FILE: src/services/heady-train-service.js                     ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

// ─── Priority Training Topics ───────────────────────────────────────

const PRIORITY_TOPICS = [
  { id: 'pgvector-optimization', name: 'pgvector Query Optimization', impact: 'Direct IaaS revenue', priority: 1 },
  { id: 'cloudflare-workers', name: 'Cloudflare Workers Edge Compute', impact: 'Latency reduction', priority: 2 },
  { id: 'multi-agent-consensus', name: 'Multi-Agent Consensus Algorithms', impact: 'Swarm quality', priority: 3 },
  { id: 'websocket-streaming', name: 'WebSocket Real-Time Streaming', impact: 'Dashboard UX', priority: 4 },
  { id: 'stripe-metered-billing', name: 'Stripe Metered Billing Integration', impact: 'Monetization', priority: 5 },
  { id: 'soc2-compliance', name: 'SOC 2 Compliance Patterns', impact: 'Enterprise sales enablement', priority: 6 },
  { id: 'sacred-geometry-proofs', name: 'Sacred Geometry Mathematical Proofs', impact: 'IP moat reinforcement', priority: 7 },
  { id: 'trading-backtesting', name: 'Trading Algorithm Backtesting', impact: 'Apex PA performance', priority: 8 },
];

// ─── Spaced Repetition Engine ───────────────────────────────────────

class SpacedRepetition {
  constructor() {
    this.schedule = new Map(); // topicId → { nextReview, interval, easeFactor, repetitions }
  }

  initTopic(topicId) {
    if (!this.schedule.has(topicId)) {
      this.schedule.set(topicId, {
        nextReview: new Date(),
        intervalDays: FIB[0], // Start at 1 day
        easeFactor: PHI,      // φ-based ease
        repetitions: 0,
        lastScore: 0,
      });
    }
  }

  recordReview(topicId, score) {
    const entry = this.schedule.get(topicId);
    if (!entry) return;

    entry.repetitions++;
    entry.lastScore = score;

    if (score >= 80) {
      // Good recall — extend interval using Fibonacci sequence
      const fibIndex = Math.min(entry.repetitions, FIB.length - 1);
      entry.intervalDays = FIB[fibIndex];
      entry.easeFactor = Math.min(entry.easeFactor * 1.1, PHI * 2);
    } else if (score >= 50) {
      // Moderate — keep same interval
      entry.intervalDays = Math.max(1, Math.round(entry.intervalDays * PSI));
    } else {
      // Poor recall — reset to 1 day
      entry.intervalDays = 1;
      entry.easeFactor = Math.max(1.3, entry.easeFactor * 0.85);
    }

    entry.nextReview = new Date(Date.now() + entry.intervalDays * 86400000);
    this.schedule.set(topicId, entry);
  }

  getDueTopics() {
    const now = new Date();
    const due = [];
    for (const [topicId, entry] of this.schedule) {
      if (entry.nextReview <= now) {
        due.push({ topicId, ...entry });
      }
    }
    return due.sort((a, b) => a.nextReview - b.nextReview);
  }

  getSchedule() {
    const result = {};
    for (const [topicId, entry] of this.schedule) {
      result[topicId] = { ...entry, nextReview: entry.nextReview.toISOString() };
    }
    return result;
  }
}

// ─── Skill Gap Analyzer ─────────────────────────────────────────────

class SkillGapAnalyzer {
  constructor() {
    this.benchmarks = new Map(); // skill → { score, timestamp }
    this.errorPatterns = [];     // { skill, errorType, count }
    this.failureRates = new Map();
  }

  recordBenchmark(skill, score) {
    const prev = this.benchmarks.get(skill);
    this.benchmarks.set(skill, {
      score,
      previousScore: prev ? prev.score : null,
      delta: prev ? score - prev.score : 0,
      timestamp: new Date().toISOString(),
    });
  }

  recordError(skill, errorType) {
    const existing = this.errorPatterns.find(p => p.skill === skill && p.errorType === errorType);
    if (existing) {
      existing.count++;
      existing.lastSeen = new Date().toISOString();
    } else {
      this.errorPatterns.push({ skill, errorType, count: 1, lastSeen: new Date().toISOString() });
    }
  }

  recordFailure(skill) {
    const current = this.failureRates.get(skill) || { total: 0, failures: 0 };
    current.total++;
    current.failures++;
    current.rate = current.failures / current.total;
    this.failureRates.set(skill, current);
  }

  recordSuccess(skill) {
    const current = this.failureRates.get(skill) || { total: 0, failures: 0 };
    current.total++;
    current.rate = current.failures / current.total;
    this.failureRates.set(skill, current);
  }

  getTopGaps(n = 10) {
    const gaps = [];

    for (const topic of PRIORITY_TOPICS) {
      const benchmark = this.benchmarks.get(topic.id);
      const failureRate = this.failureRates.get(topic.id);
      const errors = this.errorPatterns.filter(p => p.skill === topic.id);

      const score = benchmark ? benchmark.score : 30; // Default low if untested
      const fRate = failureRate ? failureRate.rate : 0.5; // Default high if unknown
      const errorCount = errors.reduce((s, e) => s + e.count, 0);

      // Gap severity: weighted combination
      const gapSeverity = (100 - score) * 0.4 + fRate * 100 * 0.35 + Math.min(errorCount * 5, 100) * 0.25;

      gaps.push({
        ...topic,
        currentScore: score,
        failureRate: Math.round(fRate * 100) / 100,
        errorCount,
        gapSeverity: Math.round(gapSeverity),
        impactIfFixed: `Fixing would reduce ${Math.round(fRate * 100)}% of ${topic.id} failures`,
      });
    }

    return gaps.sort((a, b) => b.gapSeverity - a.gapSeverity).slice(0, n);
  }
}

// ─── Curriculum Generator ───────────────────────────────────────────

class CurriculumGenerator {
  generateCurriculum(gap) {
    const modules = [];
    const baseModules = this._getModulesForTopic(gap.id);

    for (let i = 0; i < baseModules.length; i++) {
      modules.push({
        order: i + 1,
        ...baseModules[i],
        estimatedMinutes: Math.round(FIB[Math.min(i + 4, FIB.length - 1)] * PSI * 10),
        prerequisites: i > 0 ? [baseModules[i - 1].id] : [],
      });
    }

    return {
      topicId: gap.id,
      topicName: gap.name,
      gapSeverity: gap.gapSeverity,
      modules,
      totalModules: modules.length,
      estimatedHours: Math.round(modules.reduce((s, m) => s + m.estimatedMinutes, 0) / 60 * 10) / 10,
      generatedAt: new Date().toISOString(),
    };
  }

  _getModulesForTopic(topicId) {
    const curricula = {
      'pgvector-optimization': [
        { id: 'pv-1', title: 'HNSW Index Tuning (M, efConstruction, efSearch)', type: 'theory', outputType: 'working-code' },
        { id: 'pv-2', title: 'IVFFlat vs HNSW Benchmark', type: 'hands-on', outputType: 'benchmark-results' },
        { id: 'pv-3', title: 'Hybrid Search: BM25 + Vector Fusion', type: 'hands-on', outputType: 'working-code' },
        { id: 'pv-4', title: 'Multi-Tenant RLS with Vector Queries', type: 'project', outputType: 'working-code' },
        { id: 'pv-5', title: 'Query Plan Analysis with EXPLAIN ANALYZE', type: 'diagnostic', outputType: 'optimization-report' },
      ],
      'cloudflare-workers': [
        { id: 'cw-1', title: 'Workers Runtime: V8 Isolates vs Node.js', type: 'theory', outputType: 'summary' },
        { id: 'cw-2', title: 'KV Storage Patterns for Edge State', type: 'hands-on', outputType: 'working-code' },
        { id: 'cw-3', title: 'Durable Objects for Stateful Edge', type: 'hands-on', outputType: 'working-code' },
        { id: 'cw-4', title: 'Edge LLM Routing with AI Gateway', type: 'project', outputType: 'working-code' },
      ],
      'multi-agent-consensus': [
        { id: 'mc-1', title: 'Raft Consensus for Agent Agreement', type: 'theory', outputType: 'summary' },
        { id: 'mc-2', title: 'CSL-Based Swarm Voting', type: 'hands-on', outputType: 'working-code' },
        { id: 'mc-3', title: 'Byzantine Fault Tolerance for AI Agents', type: 'project', outputType: 'working-code' },
      ],
      'stripe-metered-billing': [
        { id: 'sb-1', title: 'Stripe Meter Events and Usage Records', type: 'theory', outputType: 'summary' },
        { id: 'sb-2', title: 'Per-Token Metered Billing Integration', type: 'hands-on', outputType: 'working-code' },
        { id: 'sb-3', title: 'Webhook Verification and Idempotent Processing', type: 'hands-on', outputType: 'working-code' },
        { id: 'sb-4', title: 'Multi-Tier Subscription with Usage Caps', type: 'project', outputType: 'working-code' },
      ],
      'soc2-compliance': [
        { id: 'sc-1', title: 'SOC 2 Type II Control Mapping', type: 'theory', outputType: 'compliance-checklist' },
        { id: 'sc-2', title: 'Immutable Audit Trail Implementation', type: 'hands-on', outputType: 'working-code' },
        { id: 'sc-3', title: 'Access Control and RBAC Patterns', type: 'hands-on', outputType: 'working-code' },
      ],
    };

    return curricula[topicId] || [
      { id: `${topicId}-1`, title: `${topicId} Fundamentals`, type: 'theory', outputType: 'summary' },
      { id: `${topicId}-2`, title: `${topicId} Hands-On Practice`, type: 'hands-on', outputType: 'working-code' },
      { id: `${topicId}-3`, title: `${topicId} Integration Project`, type: 'project', outputType: 'working-code' },
    ];
  }
}

// ─── Knowledge Exporter ─────────────────────────────────────────────

class KnowledgeExporter {
  constructor() {
    this.exports = [];
  }

  exportSession(topicId, results) {
    const sessionExport = {
      id: `export_${Date.now()}`,
      topicId,
      summary: `Training session on ${topicId}: ${results.modulesCompleted}/${results.totalModules} modules completed`,
      score: results.averageScore,
      codeExamples: results.codeExamples || [],
      vectorEmbeddingReady: true,
      exportedAt: new Date().toISOString(),
    };

    this.exports.push(sessionExport);
    return sessionExport;
  }

  getExportHistory() {
    return {
      totalExports: this.exports.length,
      recentExports: this.exports.slice(-20),
      byTopic: this._groupByTopic(),
    };
  }

  _groupByTopic() {
    const groups = {};
    for (const e of this.exports) {
      groups[e.topicId] = (groups[e.topicId] || 0) + 1;
    }
    return groups;
  }
}

// ─── Main Training Service ──────────────────────────────────────────

class HeadyTrainService {
  constructor() {
    this.gapAnalyzer = new SkillGapAnalyzer();
    this.curriculumGenerator = new CurriculumGenerator();
    this.spacedRepetition = new SpacedRepetition();
    this.knowledgeExporter = new KnowledgeExporter();

    // Initialize spaced repetition for all priority topics
    PRIORITY_TOPICS.forEach(t => this.spacedRepetition.initTopic(t.id));
  }

  analyzeGaps() {
    return this.gapAnalyzer.getTopGaps(10);
  }

  generateTrainingPlan() {
    const gaps = this.analyzeGaps();
    const topGap = gaps[0];
    if (!topGap) return { message: 'No skill gaps detected' };

    return {
      targetGap: topGap,
      curriculum: this.curriculumGenerator.generateCurriculum(topGap),
      dueReviews: this.spacedRepetition.getDueTopics(),
      allGaps: gaps,
    };
  }

  recordTrainingResult(topicId, score) {
    this.gapAnalyzer.recordBenchmark(topicId, score);
    this.spacedRepetition.recordReview(topicId, score);
    if (score >= 60) {
      this.gapAnalyzer.recordSuccess(topicId);
    } else {
      this.gapAnalyzer.recordFailure(topicId);
    }
  }

  getStatus() {
    return {
      gaps: this.analyzeGaps(),
      schedule: this.spacedRepetition.getSchedule(),
      dueReviews: this.spacedRepetition.getDueTopics(),
      exports: this.knowledgeExporter.getExportHistory(),
      priorityTopics: PRIORITY_TOPICS,
    };
  }
}

// ─── Express Router ─────────────────────────────────────────────────

function createTrainRouter() {
  const express = require('express');
  const router = express.Router();
  const service = new HeadyTrainService();

  const auth = (req, res, next) => {
    const key = req.headers['x-heady-api-key'] || req.headers['authorization']?.split(' ')[1];
    if (!key || key !== process.env.HEADY_API_KEY) {
      return res.status(403).json({ error: 'API key required' });
    }
    next();
  };

  router.get('/status', auth, (req, res) => {
    res.json({ ok: true, ...service.getStatus() });
  });

  router.get('/gaps', auth, (req, res) => {
    res.json({ ok: true, gaps: service.analyzeGaps() });
  });

  router.get('/plan', auth, (req, res) => {
    res.json({ ok: true, plan: service.generateTrainingPlan() });
  });

  router.post('/record', auth, (req, res) => {
    const { topicId, score } = req.body;
    if (!topicId || score === undefined) return res.status(400).json({ error: 'topicId and score required' });
    service.recordTrainingResult(topicId, score);
    res.json({ ok: true, updated: service.getStatus() });
  });

  router.get('/schedule', auth, (req, res) => {
    res.json({ ok: true, schedule: service.spacedRepetition.getSchedule(), due: service.spacedRepetition.getDueTopics() });
  });

  return router;
}

module.exports = { HeadyTrainService, createTrainRouter, PRIORITY_TOPICS, SpacedRepetition };
