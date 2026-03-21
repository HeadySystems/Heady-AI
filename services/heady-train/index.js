/**
 * Heady Training Service
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Skill gap analysis, curriculum generation, Fibonacci spaced repetition,
 * priority training topics, and knowledge export.
 */
'use strict';

const crypto = require('crypto');

// Fibonacci intervals for spaced repetition (in days)
const FIBONACCI_INTERVALS = [1, 2, 3, 5, 8, 13];

// ── 8 Priority Training Topics ──
const TRAINING_TOPICS = [
  {
    id: 'topic-vector-retrieval',
    name: 'Vector Retrieval & Semantic Search',
    description: 'Master embedding generation, similarity metrics (cosine, dot-product, Euclidean), approximate nearest neighbor algorithms (HNSW, IVF), and production-scale vector database operations.',
    skills: ['algorithms', 'databases', 'performance'],
    assessment: {
      criteria: ['Implement cosine similarity from scratch', 'Build an HNSW index', 'Optimize recall@10 above 0.90', 'Handle billion-scale vector sets'],
      passingScore: 75,
    },
    resources: ['FAISS documentation', 'pgvector guide', 'ANN benchmarks paper'],
    estimatedHours: 40,
  },
  {
    id: 'topic-distributed-systems',
    name: 'Distributed Systems Fundamentals',
    description: 'Consensus algorithms (Raft, Paxos), distributed transactions (2PC, Saga), CAP theorem trade-offs, and building fault-tolerant services with leader election and partition tolerance.',
    skills: ['system-design', 'networking', 'concurrency'],
    assessment: {
      criteria: ['Implement a Raft leader election', 'Build a Saga coordinator', 'Handle split-brain scenarios', 'Design for eventual consistency'],
      passingScore: 70,
    },
    resources: ['Designing Data-Intensive Applications', 'Raft paper', 'Jepsen analyses'],
    estimatedHours: 60,
  },
  {
    id: 'topic-security-hardening',
    name: 'Security Hardening & Zero Trust',
    description: 'Implement zero-trust architecture with mTLS, JWT rotation, RBAC/ABAC, input sanitization, timing-safe comparisons, and security audit automation.',
    skills: ['security', 'api-design', 'devops'],
    assessment: {
      criteria: ['Configure mTLS between services', 'Implement JWT with key rotation', 'Build RBAC middleware', 'Pass OWASP Top 10 audit'],
      passingScore: 80,
    },
    resources: ['OWASP guidelines', 'NIST Zero Trust Architecture', 'CIS benchmarks'],
    estimatedHours: 35,
  },
  {
    id: 'topic-observability',
    name: 'Observability & Reliability Engineering',
    description: 'Structured logging, distributed tracing (OpenTelemetry), metric aggregation, SLO/SLI definition, error budgets, and incident response automation.',
    skills: ['observability', 'system-design', 'devops'],
    assessment: {
      criteria: ['Instrument a service with OpenTelemetry', 'Define SLOs and error budgets', 'Build a dashboard from metrics', 'Automate incident detection'],
      passingScore: 70,
    },
    resources: ['Google SRE Book', 'OpenTelemetry docs', 'Prometheus best practices'],
    estimatedHours: 30,
  },
  {
    id: 'topic-ml-pipelines',
    name: 'ML Pipeline Engineering',
    description: 'Feature stores, training pipelines, model serving (batch & real-time), A/B testing for models, drift detection, and automated retraining triggers.',
    skills: ['data-structures', 'performance', 'system-design'],
    assessment: {
      criteria: ['Build a feature store with versioning', 'Implement model A/B serving', 'Detect data drift statistically', 'Automate retraining pipeline'],
      passingScore: 70,
    },
    resources: ['MLOps principles', 'Feature Store patterns', 'Evidently AI docs'],
    estimatedHours: 50,
  },
  {
    id: 'topic-api-design',
    name: 'API Design & Developer Experience',
    description: 'REST/GraphQL/gRPC design patterns, versioning strategies, rate limiting, pagination, error contract design, SDK generation, and API-first development.',
    skills: ['api-design', 'system-design', 'testing'],
    assessment: {
      criteria: ['Design a RESTful API with proper HTTP semantics', 'Implement cursor-based pagination', 'Build a GraphQL schema with dataloader', 'Generate SDK from OpenAPI spec'],
      passingScore: 75,
    },
    resources: ['API Design Patterns (Manning)', 'Google API design guide', 'GraphQL best practices'],
    estimatedHours: 25,
  },
  {
    id: 'topic-concurrency',
    name: 'Concurrency & Parallel Processing',
    description: 'Event loops, worker threads, lock-free data structures, actor model, CSP channels, backpressure, and practical concurrency patterns in Node.js and Go.',
    skills: ['concurrency', 'performance', 'algorithms'],
    assessment: {
      criteria: ['Implement a work-stealing scheduler', 'Build a lock-free queue', 'Handle backpressure in streaming pipeline', 'Debug a race condition'],
      passingScore: 70,
    },
    resources: ['Node.js worker_threads docs', 'Java Concurrency in Practice', 'Go concurrency patterns'],
    estimatedHours: 45,
  },
  {
    id: 'topic-testing',
    name: 'Testing Strategy & Quality Engineering',
    description: 'Test pyramid design, property-based testing, contract testing, mutation testing, chaos engineering, and building confidence in deployments through automated quality gates.',
    skills: ['testing', 'devops', 'system-design'],
    assessment: {
      criteria: ['Design a test pyramid for a microservice', 'Write property-based tests with fast-check', 'Implement consumer-driven contract tests', 'Run a chaos experiment safely'],
      passingScore: 70,
    },
    resources: ['Testing JavaScript Applications', 'Pact contract testing', 'Chaos Engineering book'],
    estimatedHours: 30,
  },
];

/**
 * Skill Gap Analyzer — cross-references error patterns with skill domains.
 */
class SkillGapAnalyzer {
  constructor() {
    this._errorPatterns = [];
    this._skillScores = {};
  }

  /**
   * Ingest error patterns from build/test/runtime logs.
   * @param {Array} errors - [{ message, category, severity, timestamp }]
   */
  ingestErrors(errors) {
    for (const err of errors) {
      const domains = this._mapErrorToDomains(err);
      this._errorPatterns.push({
        ...err,
        mappedDomains: domains,
        ingestedAt: Date.now(),
      });
    }
    // Keep last 500
    if (this._errorPatterns.length > 500) {
      this._errorPatterns = this._errorPatterns.slice(-500);
    }
  }

  /**
   * Ingest skill scores from Code Dojo or external assessment.
   */
  ingestSkillScores(scores) {
    this._skillScores = { ...this._skillScores, ...scores };
  }

  _mapErrorToDomains(error) {
    const msg = (error.message || '').toLowerCase();
    const domains = [];
    const mappings = {
      algorithms: ['sort', 'search', 'recursion', 'stack overflow', 'infinite loop', 'timeout', 'complexity'],
      'data-structures': ['map', 'set', 'array', 'buffer', 'heap', 'queue', 'linked list'],
      'system-design': ['architecture', 'scaling', 'bottleneck', 'capacity', 'throughput', 'latency'],
      'api-design': ['endpoint', 'rest', 'graphql', 'grpc', 'status code', '404', '500', 'cors'],
      security: ['auth', 'token', 'permission', 'denied', 'forbidden', 'injection', 'xss', 'csrf'],
      performance: ['memory', 'cpu', 'slow', 'leak', 'gc', 'profile', 'cache miss'],
      testing: ['test fail', 'assertion', 'expect', 'mock', 'coverage', 'flaky'],
      concurrency: ['race condition', 'deadlock', 'thread', 'worker', 'async', 'promise', 'mutex'],
      databases: ['query', 'sql', 'index', 'migration', 'connection pool', 'transaction', 'deadlock'],
      networking: ['timeout', 'connection refused', 'dns', 'socket', 'tcp', 'http', 'ssl', 'tls'],
      observability: ['log', 'metric', 'trace', 'span', 'alert', 'monitor'],
      devops: ['deploy', 'build', 'ci', 'cd', 'docker', 'kubernetes', 'config'],
    };

    for (const [domain, keywords] of Object.entries(mappings)) {
      if (keywords.some(kw => msg.includes(kw))) {
        domains.push(domain);
      }
    }
    return domains.length > 0 ? domains : ['general'];
  }

  /**
   * Analyze gaps: domains with high error frequency and low skill scores.
   */
  analyze() {
    // Count errors per domain
    const errorCounts = {};
    for (const ep of this._errorPatterns) {
      for (const domain of ep.mappedDomains) {
        errorCounts[domain] = (errorCounts[domain] || 0) + 1;
      }
    }

    // Build gap report
    const gaps = [];
    const allDomains = new Set([...Object.keys(errorCounts), ...Object.keys(this._skillScores)]);

    for (const domain of allDomains) {
      const errors = errorCounts[domain] || 0;
      const skill = this._skillScores[domain] || 0;
      const gapScore = Math.round((errors * 10) + (100 - skill)) / 2;

      gaps.push({
        domain,
        errorCount: errors,
        skillScore: skill,
        gapScore: Math.min(100, gapScore),
        priority: gapScore >= 70 ? 'critical' : gapScore >= 50 ? 'high' : gapScore >= 30 ? 'medium' : 'low',
        relatedTopics: TRAINING_TOPICS.filter(t => t.skills.includes(domain)).map(t => t.id),
      });
    }

    return gaps.sort((a, b) => b.gapScore - a.gapScore);
  }
}

/**
 * Spaced Repetition Scheduler — Fibonacci intervals.
 */
class SpacedRepetitionScheduler {
  constructor() {
    this._items = new Map(); // itemId → { intervalIndex, nextReview, history }
  }

  /**
   * Schedule an item for review.
   */
  schedule(itemId, metadata = {}) {
    this._items.set(itemId, {
      itemId,
      metadata,
      intervalIndex: 0,
      nextReview: new Date(Date.now() + FIBONACCI_INTERVALS[0] * 86400000).toISOString(),
      history: [],
      createdAt: new Date().toISOString(),
    });
    return this._items.get(itemId);
  }

  /**
   * Record a review result and advance/reset the interval.
   * @param {string} itemId
   * @param {boolean} passed - Did the learner pass?
   * @param {number} score - Score 0–100
   */
  recordReview(itemId, passed, score = 0) {
    const item = this._items.get(itemId);
    if (!item) return null;

    item.history.push({
      reviewedAt: new Date().toISOString(),
      passed,
      score,
      intervalDays: FIBONACCI_INTERVALS[item.intervalIndex],
    });

    if (passed && score >= 70) {
      // Advance to next Fibonacci interval
      item.intervalIndex = Math.min(item.intervalIndex + 1, FIBONACCI_INTERVALS.length - 1);
    } else if (!passed) {
      // Reset to beginning
      item.intervalIndex = 0;
    }
    // If passed but score < 70, stay at same interval

    const intervalDays = FIBONACCI_INTERVALS[item.intervalIndex];
    item.nextReview = new Date(Date.now() + intervalDays * 86400000).toISOString();

    return item;
  }

  /**
   * Get items due for review.
   */
  getDue() {
    const now = new Date().toISOString();
    const due = [];
    for (const [, item] of this._items) {
      if (item.nextReview <= now) {
        due.push(item);
      }
    }
    return due.sort((a, b) => a.nextReview.localeCompare(b.nextReview));
  }

  /**
   * Get upcoming reviews within N days.
   */
  getUpcoming(days = 7) {
    const cutoff = new Date(Date.now() + days * 86400000).toISOString();
    const upcoming = [];
    for (const [, item] of this._items) {
      if (item.nextReview <= cutoff) {
        upcoming.push(item);
      }
    }
    return upcoming.sort((a, b) => a.nextReview.localeCompare(b.nextReview));
  }

  getItem(itemId) { return this._items.get(itemId) || null; }
  count() { return this._items.size; }
  stats() {
    const due = this.getDue().length;
    const total = this._items.size;
    const avgInterval = total > 0
      ? (Array.from(this._items.values()).reduce((s, i) => s + FIBONACCI_INTERVALS[i.intervalIndex], 0) / total).toFixed(1)
      : 0;
    return { total, due, avgIntervalDays: +avgInterval, fibonacciIntervals: FIBONACCI_INTERVALS };
  }
}

/**
 * Curriculum Generator — creates training plans from skill gaps.
 */
class CurriculumGenerator {
  /**
   * Generate a curriculum from analyzed skill gaps.
   * @param {Array} gaps - Output from SkillGapAnalyzer.analyze()
   * @param {object} options - { maxTopics, maxHoursPerWeek }
   */
  generate(gaps, options = {}) {
    const { maxTopics = 5, maxHoursPerWeek = 10 } = options;

    // Filter to critical and high priority gaps
    const priorityGaps = gaps.filter(g => g.priority === 'critical' || g.priority === 'high');
    const targetGaps = priorityGaps.length > 0 ? priorityGaps : gaps.slice(0, maxTopics);

    // Map gaps to training topics
    const curriculum = [];
    const seenTopics = new Set();

    for (const gap of targetGaps) {
      for (const topicId of gap.relatedTopics) {
        if (seenTopics.has(topicId)) continue;
        seenTopics.add(topicId);

        const topic = TRAINING_TOPICS.find(t => t.id === topicId);
        if (!topic) continue;

        const weeksNeeded = Math.ceil(topic.estimatedHours / maxHoursPerWeek);

        curriculum.push({
          topicId: topic.id,
          name: topic.name,
          description: topic.description,
          targetDomains: gap.domain,
          gapScore: gap.gapScore,
          priority: gap.priority,
          estimatedWeeks: weeksNeeded,
          hoursPerWeek: Math.min(maxHoursPerWeek, topic.estimatedHours),
          totalHours: topic.estimatedHours,
          assessment: topic.assessment,
          resources: topic.resources,
          milestones: this._generateMilestones(topic, weeksNeeded),
        });

        if (curriculum.length >= maxTopics) break;
      }
      if (curriculum.length >= maxTopics) break;
    }

    const totalWeeks = curriculum.reduce((s, c) => s + c.estimatedWeeks, 0);
    const totalHours = curriculum.reduce((s, c) => s + c.totalHours, 0);

    return {
      id: `curriculum-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      topics: curriculum,
      summary: {
        topicCount: curriculum.length,
        totalWeeks,
        totalHours,
        hoursPerWeek: maxHoursPerWeek,
        targetDomains: [...new Set(curriculum.map(c => c.targetDomains))],
      },
    };
  }

  _generateMilestones(topic, weeks) {
    const milestones = [];
    const criteria = topic.assessment.criteria;
    const perMilestone = Math.max(1, Math.ceil(criteria.length / Math.min(weeks, 4)));

    for (let i = 0; i < criteria.length; i += perMilestone) {
      const batch = criteria.slice(i, i + perMilestone);
      milestones.push({
        week: Math.floor(i / perMilestone) + 1,
        objectives: batch,
        assessmentType: i + perMilestone >= criteria.length ? 'final' : 'checkpoint',
      });
    }
    return milestones;
  }
}

/**
 * Knowledge Exporter — generates summary docs and code examples.
 */
class KnowledgeExporter {
  /**
   * Export a topic's knowledge as a structured document.
   */
  exportTopic(topicId, learnerProgress = {}) {
    const topic = TRAINING_TOPICS.find(t => t.id === topicId);
    if (!topic) return null;

    const progress = learnerProgress[topicId] || {};

    return {
      title: topic.name,
      exportedAt: new Date().toISOString(),
      summary: topic.description,
      skills: topic.skills,
      estimatedHours: topic.estimatedHours,
      assessmentCriteria: topic.assessment.criteria,
      passingScore: topic.assessment.passingScore,
      resources: topic.resources,
      learnerProgress: {
        score: progress.score || 0,
        completedCriteria: progress.completedCriteria || [],
        remainingCriteria: topic.assessment.criteria.filter(
          c => !(progress.completedCriteria || []).includes(c)
        ),
        status: (progress.score || 0) >= topic.assessment.passingScore ? 'passed' : 'in-progress',
      },
      codeExamples: this._generateCodeExamples(topic),
    };
  }

  _generateCodeExamples(topic) {
    const examples = [];

    if (topic.skills.includes('algorithms')) {
      examples.push({
        title: `${topic.name} — Core Algorithm`,
        language: 'javascript',
        code: `// ${topic.name} — demonstration pattern\nclass ${topic.id.replace(/-/g, '_').replace('topic_', '')} {\n  constructor(config = {}) {\n    this.config = config;\n    this._initialized = false;\n  }\n\n  async initialize() {\n    // Setup phase: validate config, allocate resources\n    this._initialized = true;\n    return { status: 'ready', config: this.config };\n  }\n\n  async execute(input) {\n    if (!this._initialized) throw new Error('Not initialized');\n    // Core logic implementation\n    const startTime = Date.now();\n    const result = this._process(input);\n    return {\n      result,\n      latencyMs: Date.now() - startTime,\n    };\n  }\n\n  _process(input) {\n    // Override in specific implementation\n    return input;\n  }\n}`,
        description: `Template pattern for ${topic.name}`,
      });
    }

    if (topic.skills.includes('testing')) {
      examples.push({
        title: `${topic.name} — Test Template`,
        language: 'javascript',
        code: `const { describe, it, expect } = require('@jest/globals');\n\ndescribe('${topic.name}', () => {\n  it('should initialize correctly', () => {\n    // Arrange\n    const config = { /* test config */ };\n    // Act\n    const instance = new Implementation(config);\n    // Assert\n    expect(instance).toBeDefined();\n  });\n\n  it('should handle edge cases', () => {\n    expect(() => new Implementation(null)).not.toThrow();\n    expect(() => new Implementation({})).not.toThrow();\n  });\n});`,
        description: `Test template for ${topic.name}`,
      });
    }

    if (topic.skills.includes('api-design')) {
      examples.push({
        title: `${topic.name} — API Route`,
        language: 'javascript',
        code: `const express = require('express');\nconst router = express.Router();\n\nrouter.get('/api/${topic.id.replace('topic-', '')}', async (req, res) => {\n  try {\n    const result = await service.execute(req.query);\n    res.json({ ok: true, data: result });\n  } catch (err) {\n    res.status(500).json({ ok: false, error: err.message });\n  }\n});\n\nmodule.exports = router;`,
        description: `API endpoint pattern for ${topic.name}`,
      });
    }

    return examples;
  }

  /**
   * Export full progress report.
   */
  exportProgressReport(gaps, curriculum, schedulerStats) {
    return {
      exportedAt: new Date().toISOString(),
      format: 'heady-training-report-v1',
      skillGaps: {
        totalGaps: gaps.length,
        criticalGaps: gaps.filter(g => g.priority === 'critical').length,
        topGaps: gaps.slice(0, 5).map(g => ({ domain: g.domain, gapScore: g.gapScore, priority: g.priority })),
      },
      curriculum: curriculum ? {
        topicCount: curriculum.summary?.topicCount || 0,
        totalWeeks: curriculum.summary?.totalWeeks || 0,
        totalHours: curriculum.summary?.totalHours || 0,
      } : null,
      spacedRepetition: schedulerStats || null,
      recommendations: this._generateRecommendations(gaps),
    };
  }

  _generateRecommendations(gaps) {
    const recs = [];
    const critical = gaps.filter(g => g.priority === 'critical');
    if (critical.length > 0) {
      recs.push({
        type: 'urgent',
        message: `${critical.length} critical skill gaps detected. Prioritize: ${critical.map(g => g.domain).join(', ')}`,
      });
    }
    if (gaps.length > 5) {
      recs.push({
        type: 'strategy',
        message: 'Focus on 2-3 domains at a time rather than spreading across all gaps',
      });
    }
    recs.push({
      type: 'habit',
      message: 'Schedule 30-minute daily practice sessions for consistent improvement',
    });
    return recs;
  }
}

/**
 * Heady Training Service — main orchestrator.
 */
class HeadyTrainService {
  constructor() {
    this.gapAnalyzer = new SkillGapAnalyzer();
    this.scheduler = new SpacedRepetitionScheduler();
    this.curriculumGenerator = new CurriculumGenerator();
    this.exporter = new KnowledgeExporter();
    this._currentCurriculum = null;
    this._progressHistory = [];
    this._startedAt = Date.now();
  }

  /**
   * Run full training analysis pipeline.
   */
  analyze(errors = [], skillScores = {}) {
    this.gapAnalyzer.ingestErrors(errors);
    this.gapAnalyzer.ingestSkillScores(skillScores);
    const gaps = this.gapAnalyzer.analyze();
    this._currentCurriculum = this.curriculumGenerator.generate(gaps);

    // Schedule topics for spaced repetition
    for (const topic of this._currentCurriculum.topics) {
      if (!this.scheduler.getItem(topic.topicId)) {
        this.scheduler.schedule(topic.topicId, { name: topic.name, priority: topic.priority });
      }
    }

    return {
      gaps,
      curriculum: this._currentCurriculum,
      scheduledReviews: this.scheduler.count(),
      dueNow: this.scheduler.getDue().length,
    };
  }

  /**
   * Record a review/practice session result.
   */
  recordPractice(topicId, passed, score) {
    const result = this.scheduler.recordReview(topicId, passed, score);
    this._progressHistory.push({
      topicId, passed, score,
      recordedAt: new Date().toISOString(),
    });
    return result;
  }

  /**
   * Export knowledge for a topic.
   */
  exportKnowledge(topicId) {
    return this.exporter.exportTopic(topicId);
  }

  /**
   * Get full progress report.
   */
  getProgressReport() {
    const gaps = this.gapAnalyzer.analyze();
    return this.exporter.exportProgressReport(gaps, this._currentCurriculum, this.scheduler.stats());
  }

  /**
   * Get service health and stats.
   */
  getStats() {
    return {
      service: 'heady-train',
      version: '1.0.0',
      uptime: Date.now() - this._startedAt,
      trainingTopics: TRAINING_TOPICS.length,
      availableTopics: TRAINING_TOPICS.map(t => ({ id: t.id, name: t.name, hours: t.estimatedHours })),
      currentCurriculum: this._currentCurriculum ? this._currentCurriculum.summary : null,
      spacedRepetition: this.scheduler.stats(),
      fibonacciIntervals: FIBONACCI_INTERVALS,
      practiceHistory: this._progressHistory.length,
      gapAnalysis: {
        errorPatternsIngested: this.gapAnalyzer._errorPatterns.length,
        skillDomainsTracked: Object.keys(this.gapAnalyzer._skillScores).length,
      },
    };
  }
}

module.exports = {
  HeadyTrainService, SkillGapAnalyzer, SpacedRepetitionScheduler,
  CurriculumGenerator, KnowledgeExporter,
  TRAINING_TOPICS, FIBONACCI_INTERVALS,
};
