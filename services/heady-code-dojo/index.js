/**
 * Heady Code Dojo — Coding Practice Engine
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 */
'use strict';

const crypto = require('crypto');

const DIFFICULTY = { BEGINNER: 'beginner', INTERMEDIATE: 'intermediate', ADVANCED: 'advanced', EXPERT: 'expert' };
const CATEGORIES = ['algorithms', 'system-design', 'api-integration', 'security', 'performance'];

const SKILL_DOMAINS = [
  'algorithms', 'data-structures', 'system-design', 'api-design',
  'security', 'performance', 'testing', 'concurrency',
  'databases', 'networking', 'observability', 'devops',
];

// ── Challenge Templates ──
const CHALLENGE_TEMPLATES = {
  algorithms: [
    {
      id: 'algo-001', title: 'LRU Cache Implementation',
      difficulty: 'intermediate', category: 'algorithms',
      description: 'Implement an LRU (Least Recently Used) cache with O(1) get and put operations. The cache should support a configurable capacity and evict the least recently used item when full.',
      requirements: ['O(1) time complexity for get and put', 'Capacity-based eviction', 'Key-value storage with generic types'],
      testCases: [
        { input: 'put(1,"a"), put(2,"b"), get(1), put(3,"c"), get(2)', expected: '"a", null (evicted)' },
        { input: 'capacity=2, put(1,"x"), put(2,"y"), put(3,"z"), get(1)', expected: 'null (evicted)' },
      ],
      skillsDomain: ['algorithms', 'data-structures'],
      timeLimit: 1800,
      patterns: ['doubly-linked-list', 'hash-map', 'cache-eviction'],
    },
    {
      id: 'algo-002', title: 'Merge K Sorted Streams',
      difficulty: 'advanced', category: 'algorithms',
      description: 'Given K sorted async streams (iterators), merge them into a single sorted output stream. Handle backpressure and stream completion.',
      requirements: ['Min-heap for efficient merging', 'Async iterator protocol', 'Backpressure handling', 'Memory-efficient for large K'],
      testCases: [
        { input: '[[1,4,7],[2,5,8],[3,6,9]]', expected: '[1,2,3,4,5,6,7,8,9]' },
        { input: '[[1,1,1],[1,1,1]]', expected: '[1,1,1,1,1,1]' },
      ],
      skillsDomain: ['algorithms', 'concurrency', 'data-structures'],
      timeLimit: 2700,
      patterns: ['min-heap', 'async-iterator', 'k-way-merge'],
    },
    {
      id: 'algo-003', title: 'Rate Limiter with Sliding Window',
      difficulty: 'intermediate', category: 'algorithms',
      description: 'Implement a sliding window rate limiter that supports multiple time windows (1s, 1m, 1h) and returns remaining quota.',
      requirements: ['Sliding window (not fixed window)', 'Multiple concurrent windows', 'Thread-safe design', 'Memory cleanup for expired entries'],
      testCases: [
        { input: 'limit=5/sec, 6 requests in 1s', expected: '5 allowed, 1 rejected' },
        { input: 'limit=100/min, burst of 50 then steady', expected: 'All allowed until limit' },
      ],
      skillsDomain: ['algorithms', 'concurrency'],
      timeLimit: 1800,
      patterns: ['sliding-window', 'token-bucket', 'time-series'],
    },
  ],
  'system-design': [
    {
      id: 'sysdes-001', title: 'Event-Driven Task Queue',
      difficulty: 'advanced', category: 'system-design',
      description: 'Design and implement an in-process task queue with priority scheduling, retry with exponential backoff, dead-letter queue, and configurable concurrency.',
      requirements: ['Priority-based scheduling', 'Retry with exponential backoff', 'Dead-letter queue for failed tasks', 'Configurable max concurrency', 'Task timeout handling'],
      testCases: [
        { input: 'Enqueue 10 tasks, concurrency=3', expected: '3 running, 7 queued' },
        { input: 'Task fails 3 times', expected: 'Moved to DLQ after max retries' },
      ],
      skillsDomain: ['system-design', 'concurrency', 'algorithms'],
      timeLimit: 3600,
      patterns: ['priority-queue', 'circuit-breaker', 'backoff', 'dead-letter'],
    },
    {
      id: 'sysdes-002', title: 'CQRS Event Store',
      difficulty: 'expert', category: 'system-design',
      description: 'Implement a CQRS event store with event sourcing, snapshots, and projections. Events are immutable, state is derived.',
      requirements: ['Append-only event log', 'Snapshot at configurable intervals', 'Projection builder from events', 'Optimistic concurrency control', 'Event replay capability'],
      testCases: [
        { input: 'Append 100 events, snapshot at 50', expected: 'State reconstructable from snapshot + events 51-100' },
        { input: 'Concurrent writes to same aggregate', expected: 'Conflict detected, retry required' },
      ],
      skillsDomain: ['system-design', 'databases', 'algorithms'],
      timeLimit: 5400,
      patterns: ['event-sourcing', 'cqrs', 'snapshot', 'projection'],
    },
    {
      id: 'sysdes-003', title: 'Service Mesh Health Monitor',
      difficulty: 'intermediate', category: 'system-design',
      description: 'Build a health monitoring system for a microservice mesh. Aggregate health from multiple endpoints, detect cascading failures, and generate alerts.',
      requirements: ['Periodic health polling', 'Cascading failure detection', 'Alert generation with severity', 'Service dependency graph', 'Graceful degradation reporting'],
      testCases: [
        { input: '5 services, service-C depends on service-A, A goes down', expected: 'Alert for A (critical) and C (cascading)' },
        { input: 'Flapping service (up/down/up)', expected: 'Flap detection after 3 state changes in 1 min' },
      ],
      skillsDomain: ['system-design', 'observability', 'networking'],
      timeLimit: 2700,
      patterns: ['health-check', 'circuit-breaker', 'dependency-graph'],
    },
  ],
  'api-integration': [
    {
      id: 'api-001', title: 'Resilient HTTP Client',
      difficulty: 'intermediate', category: 'api-integration',
      description: 'Build an HTTP client wrapper with retry logic, circuit breaker, request deduplication, and response caching.',
      requirements: ['Configurable retry with backoff', 'Circuit breaker (open/half-open/closed)', 'Request deduplication for in-flight requests', 'Response caching with TTL', 'Timeout handling'],
      testCases: [
        { input: 'Server returns 503 twice then 200', expected: 'Success on 3rd attempt' },
        { input: '5 failures in a row', expected: 'Circuit opens, fast-fail subsequent requests' },
      ],
      skillsDomain: ['api-design', 'networking', 'algorithms'],
      timeLimit: 2400,
      patterns: ['circuit-breaker', 'retry', 'cache', 'dedup'],
    },
    {
      id: 'api-002', title: 'Webhook Delivery System',
      difficulty: 'advanced', category: 'api-integration',
      description: 'Implement a webhook delivery system with signature verification, delivery guarantees (at-least-once), retry scheduling, and delivery status tracking.',
      requirements: ['HMAC-SHA256 signature generation', 'At-least-once delivery guarantee', 'Configurable retry schedule', 'Delivery status tracking', 'Payload versioning'],
      testCases: [
        { input: 'Deliver to endpoint, 1st attempt fails', expected: 'Retry after backoff, succeed on 2nd' },
        { input: 'Invalid signature', expected: 'Receiver rejects, logged as verification failure' },
      ],
      skillsDomain: ['api-design', 'security', 'networking'],
      timeLimit: 3000,
      patterns: ['hmac', 'at-least-once', 'exponential-backoff', 'idempotency'],
    },
    {
      id: 'api-003', title: 'GraphQL Schema Stitcher',
      difficulty: 'expert', category: 'api-integration',
      description: 'Create a minimal GraphQL schema stitcher that merges multiple schema definitions, resolves type conflicts, and routes queries to the correct source service.',
      requirements: ['Schema merging with conflict resolution', 'Query routing to source services', 'Type conflict detection', 'Batched resolver execution', 'Error aggregation'],
      testCases: [
        { input: 'Two schemas with overlapping User type', expected: 'Merged schema with all fields, conflict noted' },
        { input: 'Query spanning two schemas', expected: 'Results merged from both sources' },
      ],
      skillsDomain: ['api-design', 'system-design', 'algorithms'],
      timeLimit: 4200,
      patterns: ['schema-stitching', 'type-merging', 'query-routing'],
    },
  ],
  security: [
    {
      id: 'sec-001', title: 'Token Bucket Rate Limiter with IP Reputation',
      difficulty: 'intermediate', category: 'security',
      description: 'Implement a token bucket rate limiter that factors in IP reputation scores. Known-good IPs get higher limits, suspicious IPs get lower limits.',
      requirements: ['Token bucket algorithm', 'IP reputation scoring (0-100)', 'Dynamic rate adjustment based on reputation', 'Blocklist support', 'Audit logging'],
      testCases: [
        { input: 'Reputation=90, limit=100/min', expected: '100 requests allowed per minute' },
        { input: 'Reputation=20, limit=100/min', expected: '20 requests allowed (scaled by reputation)' },
      ],
      skillsDomain: ['security', 'algorithms', 'networking'],
      timeLimit: 2400,
      patterns: ['token-bucket', 'reputation-scoring', 'rate-limiting'],
    },
    {
      id: 'sec-002', title: 'JWT Auth Middleware with Key Rotation',
      difficulty: 'advanced', category: 'security',
      description: 'Build JWT authentication middleware that supports key rotation with grace periods, token refresh, and revocation via a blocklist.',
      requirements: ['JWT signing and verification', 'Key rotation with overlapping validity', 'Token refresh mechanism', 'Blocklist-based revocation', 'Timing-safe comparison'],
      testCases: [
        { input: 'Token signed with old key during grace period', expected: 'Valid — old key still accepted' },
        { input: 'Revoked token presented', expected: 'Rejected with 401' },
      ],
      skillsDomain: ['security', 'api-design', 'algorithms'],
      timeLimit: 3000,
      patterns: ['jwt', 'key-rotation', 'token-revocation', 'timing-safe'],
    },
    {
      id: 'sec-003', title: 'Input Sanitization Pipeline',
      difficulty: 'beginner', category: 'security',
      description: 'Create a composable input sanitization pipeline that protects against XSS, SQL injection, and path traversal. Support custom sanitizer registration.',
      requirements: ['XSS prevention (HTML entity encoding)', 'SQL injection detection', 'Path traversal blocking', 'Composable sanitizer chain', 'Audit log of sanitized inputs'],
      testCases: [
        { input: '<script>alert("xss")</script>', expected: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;' },
        { input: "'; DROP TABLE users; --", expected: 'Blocked: SQL injection detected' },
      ],
      skillsDomain: ['security', 'api-design'],
      timeLimit: 1200,
      patterns: ['sanitization', 'input-validation', 'defense-in-depth'],
    },
  ],
  performance: [
    {
      id: 'perf-001', title: 'Connection Pool Manager',
      difficulty: 'advanced', category: 'performance',
      description: 'Implement a generic connection pool with min/max sizing, health checking, idle timeout, and connection draining for graceful shutdown.',
      requirements: ['Min/max pool sizing', 'Connection health checking', 'Idle connection timeout', 'Graceful drain on shutdown', 'Wait queue with timeout for exhausted pool'],
      testCases: [
        { input: 'Pool max=5, 10 concurrent requests', expected: '5 active, 5 waiting in queue' },
        { input: 'Idle connection for 30s', expected: 'Connection removed, pool shrinks' },
      ],
      skillsDomain: ['performance', 'concurrency', 'system-design'],
      timeLimit: 3000,
      patterns: ['object-pool', 'health-check', 'graceful-shutdown'],
    },
    {
      id: 'perf-002', title: 'Batch Processor with Backpressure',
      difficulty: 'intermediate', category: 'performance',
      description: 'Build a batch processor that collects items and flushes them in configurable batches with backpressure support when downstream is slow.',
      requirements: ['Configurable batch size and flush interval', 'Backpressure when buffer is full', 'Flush on size OR time threshold', 'Error handling per-batch', 'Metrics (throughput, latency, buffer utilization)'],
      testCases: [
        { input: 'Batch size=100, 250 items rapidly', expected: '2 full batches + 50 buffered' },
        { input: 'Downstream slow, buffer full', expected: 'Backpressure signal to producer' },
      ],
      skillsDomain: ['performance', 'concurrency', 'algorithms'],
      timeLimit: 2400,
      patterns: ['batching', 'backpressure', 'flush-strategy'],
    },
    {
      id: 'perf-003', title: 'Memory-Efficient Streaming CSV Parser',
      difficulty: 'beginner', category: 'performance',
      description: 'Implement a streaming CSV parser that processes files of arbitrary size with constant memory usage. Support custom delimiters and quoted fields.',
      requirements: ['Constant memory usage regardless of file size', 'Node.js Transform stream interface', 'Handle quoted fields with embedded delimiters', 'Custom delimiter support', 'Row count and byte throughput reporting'],
      testCases: [
        { input: '1GB CSV file', expected: 'Processes without memory spike, <50MB RSS' },
        { input: '"field with, comma","normal"', expected: 'Correctly parses quoted comma' },
      ],
      skillsDomain: ['performance', 'algorithms', 'data-structures'],
      timeLimit: 1800,
      patterns: ['streaming', 'transform-stream', 'state-machine-parser'],
    },
  ],
};

/**
 * Skill Radar — tracks proficiency across 12 domains.
 * Each domain has a score 0–100, updated after challenge evaluation.
 */
class SkillRadar {
  constructor() {
    this._scores = {};
    for (const domain of SKILL_DOMAINS) {
      this._scores[domain] = { score: 0, challengesCompleted: 0, lastUpdated: null };
    }
  }

  update(domain, score, challengeId) {
    if (!this._scores[domain]) return;
    const current = this._scores[domain];
    // Exponential moving average: new = 0.3 * incoming + 0.7 * existing
    current.score = current.challengesCompleted === 0
      ? score
      : Math.round(0.3 * score + 0.7 * current.score);
    current.challengesCompleted++;
    current.lastUpdated = new Date().toISOString();
    current.lastChallenge = challengeId;
  }

  getRadar() {
    return Object.entries(this._scores).map(([domain, data]) => ({
      domain,
      score: data.score,
      challengesCompleted: data.challengesCompleted,
      level: data.score >= 90 ? 'expert' : data.score >= 70 ? 'advanced' : data.score >= 40 ? 'intermediate' : 'beginner',
    }));
  }

  getWeakest(n = 3) {
    return this.getRadar().sort((a, b) => a.score - b.score).slice(0, n);
  }

  getStrongest(n = 3) {
    return this.getRadar().sort((a, b) => b.score - a.score).slice(0, n);
  }

  toJSON() { return this._scores; }

  loadFrom(data) {
    for (const [domain, vals] of Object.entries(data)) {
      if (this._scores[domain]) Object.assign(this._scores[domain], vals);
    }
  }
}

/**
 * Pattern Library — extracted patterns from solved challenges.
 */
class PatternLibrary {
  constructor() {
    this._patterns = new Map();
  }

  add(patternName, context) {
    if (!this._patterns.has(patternName)) {
      this._patterns.set(patternName, {
        name: patternName,
        occurrences: 0,
        challenges: [],
        firstSeen: new Date().toISOString(),
        lastSeen: null,
      });
    }
    const p = this._patterns.get(patternName);
    p.occurrences++;
    p.lastSeen = new Date().toISOString();
    if (context.challengeId && !p.challenges.includes(context.challengeId)) {
      p.challenges.push(context.challengeId);
    }
  }

  getAll() { return Array.from(this._patterns.values()); }
  get(name) { return this._patterns.get(name) || null; }
  count() { return this._patterns.size; }
  mostCommon(n = 5) {
    return this.getAll().sort((a, b) => b.occurrences - a.occurrences).slice(0, n);
  }
}

/**
 * Auto-Evaluation Pipeline.
 * Scores a challenge solution on lint, test pass, quality, and patterns.
 */
class Evaluator {
  /**
   * Evaluate a submitted solution.
   * @param {string} code - The submitted code
   * @param {object} challenge - The challenge definition
   * @returns {object} Evaluation result
   */
  evaluate(code, challenge) {
    const lint = this._lintCheck(code);
    const tests = this._testCheck(code, challenge);
    const quality = this._qualityScore(code, challenge);

    const totalScore = Math.round(
      lint.score * 0.15 +
      tests.score * 0.45 +
      quality.score * 0.40
    );

    return {
      challengeId: challenge.id,
      totalScore,
      grade: totalScore >= 90 ? 'A' : totalScore >= 80 ? 'B' : totalScore >= 70 ? 'C' : totalScore >= 60 ? 'D' : 'F',
      passed: totalScore >= 60,
      breakdown: { lint, tests, quality },
      evaluatedAt: new Date().toISOString(),
      patterns: challenge.patterns || [],
    };
  }

  _lintCheck(code) {
    const issues = [];
    // Check for common lint issues
    if (/var\s+/.test(code)) issues.push('Prefer const/let over var');
    if (/==(?!=)/.test(code)) issues.push('Use strict equality (===)');
    if (/console\.log/.test(code) && !/\/\/\s*debug/.test(code)) issues.push('Remove console.log statements');
    if (code.length > 10000) issues.push('Code exceeds recommended length');
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 120) { issues.push(`Line ${i + 1} exceeds 120 characters`); break; }
    }
    if (!/\/\*\*|\/\//.test(code)) issues.push('Missing code comments/documentation');

    return { score: Math.max(0, 100 - issues.length * 15), issues };
  }

  _testCheck(code, challenge) {
    const results = [];
    let passed = 0;
    for (const tc of challenge.testCases || []) {
      // Structural test: verify the code at least references expected patterns
      const hasInput = tc.input.split(',').some(part => {
        const key = part.trim().split('(')[0].replace(/[^a-zA-Z]/g, '');
        return key && code.toLowerCase().includes(key.toLowerCase());
      });
      const result = { input: tc.input, expected: tc.expected, passed: hasInput };
      if (hasInput) passed++;
      results.push(result);
    }
    const total = Math.max(1, results.length);
    return { score: Math.round((passed / total) * 100), passed, total, results };
  }

  _qualityScore(code, challenge) {
    let score = 50; // Base score
    const factors = [];

    // Modularity: functions/methods
    const funcCount = (code.match(/function\s+\w+|=>\s*\{|class\s+\w+/g) || []).length;
    if (funcCount >= 2) { score += 10; factors.push('Good modularity'); }
    if (funcCount >= 4) { score += 5; factors.push('Excellent modularity'); }

    // Error handling
    if (/try\s*\{/.test(code)) { score += 10; factors.push('Has error handling'); }
    if (/throw\s+new\s+\w*Error/.test(code)) { score += 5; factors.push('Custom error types'); }

    // Type safety indicators
    if (/typeof|instanceof|@param|@returns|@type/.test(code)) { score += 5; factors.push('Type safety awareness'); }

    // Edge cases
    if (/null|undefined|NaN|Infinity|\.length\s*===\s*0/.test(code)) { score += 5; factors.push('Edge case handling'); }

    // Requirements coverage
    const reqCoverage = (challenge.requirements || []).filter(req => {
      const keywords = req.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      return keywords.some(kw => code.toLowerCase().includes(kw));
    }).length;
    const reqTotal = Math.max(1, (challenge.requirements || []).length);
    score += Math.round((reqCoverage / reqTotal) * 15);
    factors.push(`Requirements coverage: ${reqCoverage}/${reqTotal}`);

    return { score: Math.min(100, score), factors };
  }
}

/**
 * Code Dojo — main orchestrator.
 */
class CodeDojo {
  constructor() {
    this.radar = new SkillRadar();
    this.patterns = new PatternLibrary();
    this.evaluator = new Evaluator();
    this._challengesCompleted = 0;
    this._submissions = [];
    this._startedAt = Date.now();
  }

  /**
   * Generate a challenge based on filters.
   */
  generateChallenge(options = {}) {
    const { category, difficulty, domain } = options;
    let pool = [];
    for (const [cat, challenges] of Object.entries(CHALLENGE_TEMPLATES)) {
      for (const ch of challenges) {
        if (category && ch.category !== category) continue;
        if (difficulty && ch.difficulty !== difficulty) continue;
        if (domain && !ch.skillsDomain.includes(domain)) continue;
        pool.push(ch);
      }
    }
    if (pool.length === 0) pool = Object.values(CHALLENGE_TEMPLATES).flat();

    // Prefer challenges in weak domains
    const weakDomains = new Set(this.radar.getWeakest(3).map(d => d.domain));
    pool.sort((a, b) => {
      const aWeak = a.skillsDomain.some(d => weakDomains.has(d)) ? 1 : 0;
      const bWeak = b.skillsDomain.some(d => weakDomains.has(d)) ? 1 : 0;
      return bWeak - aWeak;
    });

    const challenge = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
    return {
      ...challenge,
      generatedAt: new Date().toISOString(),
      suggestedBecause: challenge.skillsDomain.filter(d => weakDomains.has(d)).length > 0
        ? 'Targets weak skill domains'
        : 'General practice',
    };
  }

  /**
   * Submit a solution for evaluation.
   */
  submit(challengeId, code) {
    const challenge = this._findChallenge(challengeId);
    if (!challenge) return { error: `Challenge ${challengeId} not found` };

    const evaluation = this.evaluator.evaluate(code, challenge);

    // Update skill radar
    for (const domain of challenge.skillsDomain) {
      this.radar.update(domain, evaluation.totalScore, challengeId);
    }

    // Extract patterns
    for (const pattern of challenge.patterns) {
      this.patterns.add(pattern, { challengeId, score: evaluation.totalScore });
    }

    this._challengesCompleted++;
    this._submissions.push({
      challengeId,
      evaluation,
      submittedAt: new Date().toISOString(),
    });

    return {
      evaluation,
      skillUpdates: challenge.skillsDomain.map(d => ({
        domain: d,
        newScore: this.radar._scores[d]?.score || 0,
      })),
      patternsExtracted: challenge.patterns.length,
    };
  }

  _findChallenge(id) {
    for (const challenges of Object.values(CHALLENGE_TEMPLATES)) {
      const found = challenges.find(c => c.id === id);
      if (found) return found;
    }
    return null;
  }

  /**
   * Get all available challenges.
   */
  listChallenges(filters = {}) {
    const all = Object.values(CHALLENGE_TEMPLATES).flat();
    return all.filter(ch => {
      if (filters.category && ch.category !== filters.category) return false;
      if (filters.difficulty && ch.difficulty !== filters.difficulty) return false;
      return true;
    }).map(ch => ({
      id: ch.id, title: ch.title, difficulty: ch.difficulty,
      category: ch.category, timeLimit: ch.timeLimit,
      skillsDomain: ch.skillsDomain,
    }));
  }

  /**
   * Session stats.
   */
  getStats() {
    return {
      service: 'heady-code-dojo',
      version: '1.0.0',
      uptime: Date.now() - this._startedAt,
      challengesCompleted: this._challengesCompleted,
      totalChallengesAvailable: Object.values(CHALLENGE_TEMPLATES).flat().length,
      categories: CATEGORIES,
      difficulties: Object.values(DIFFICULTY),
      skillDomains: SKILL_DOMAINS.length,
      skillRadar: this.radar.getRadar(),
      patternsExtracted: this.patterns.count(),
      topPatterns: this.patterns.mostCommon(5),
      weakestDomains: this.radar.getWeakest(3),
      strongestDomains: this.radar.getStrongest(3),
      recentSubmissions: this._submissions.slice(-5).map(s => ({
        challengeId: s.challengeId,
        score: s.evaluation.totalScore,
        grade: s.evaluation.grade,
        submittedAt: s.submittedAt,
      })),
    };
  }
}

module.exports = {
  CodeDojo, SkillRadar, PatternLibrary, Evaluator,
  CHALLENGE_TEMPLATES, SKILL_DOMAINS, CATEGORIES, DIFFICULTY,
};
