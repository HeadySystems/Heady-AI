'use strict';
// HEADY_BRAND:BEGIN
// +------------------------------------------------------------------+
// |  HEADY  |  Sacred Geometry  |  Organic Systems                   |
// |  FILE: src/intelligence/heady-code-dojo.js                       |
// |  LAYER: intelligence/practice                                    |
// +------------------------------------------------------------------+
// HEADY_BRAND:END

/**
 * HeadyCodeDojo — Continuous coding practice engine.
 *
 * Pre-seeded challenge pool across 12 domains with real-time
 * evaluation, skill radar tracking, and daily stats.
 *
 * Routes:
 *   POST /api/v1/dojo/challenge — generate a challenge
 *   POST /api/v1/dojo/submit    — submit a solution
 *   GET  /api/v1/dojo/radar     — skill proficiency radar
 *   GET  /api/v1/dojo/stats     — daily statistics
 *
 * Events: dojo:challenge_generated, dojo:solution_evaluated
 *
 * @module heady-code-dojo
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

// --- phi constant -----------------------------------------------------------
const PHI = 1.618033988749895;

// --- Event Bus Integration --------------------------------------------------
function emit(event, data) {
  if (global.eventBus && typeof global.eventBus.emit === 'function') {
    global.eventBus.emit(event, data);
  }
}

// --- Domain definitions -----------------------------------------------------
const DOMAINS = [
  'nodejs', 'react', 'sql', 'cloudrun', 'cloudflare',
  'sacred-geometry-css', 'mcp-protocol', 'agent-orchestration',
  'security', 'trading', 'devops', 'prompt-engineering',
];

// --- In-memory stores -------------------------------------------------------
const submissions = [];    // { challengeId, code, score, domain, ts }
const streakTracker = { lastDate: null, streak: 0 };

// --- Challenge Pool (20 challenges, 12 domains) -----------------------------
const CHALLENGE_POOL = [
  { id: 'nd-01', domain: 'nodejs', difficulty: 2, title: 'Event Loop Scheduler',
    description: 'Write a function that schedules N callbacks using setImmediate, each receiving its index. Return a promise that resolves when all have fired.',
    examples: ['scheduleAll(3, cb) // cb called with 0,1,2'], constraints: ['No setTimeout', 'Must return Promise'] },
  { id: 'nd-02', domain: 'nodejs', difficulty: 4, title: 'Stream Backpressure Handler',
    description: 'Implement a Transform stream that buffers up to maxSize bytes and pauses the source when the buffer exceeds the threshold.',
    examples: ['new BackpressureTransform({ maxSize: 1024 })'], constraints: ['Extend Transform', 'Handle drain event'] },
  { id: 'rc-01', domain: 'react', difficulty: 2, title: 'useDebounce Hook',
    description: 'Create a custom React hook useDebounce(value, delay) that returns the debounced value.',
    examples: ['const debouncedSearch = useDebounce(query, 300)'], constraints: ['Use useEffect + useState', 'Cleanup on unmount'] },
  { id: 'rc-02', domain: 'react', difficulty: 3, title: 'Virtual List Component',
    description: 'Build a VirtualList component that only renders visible items given a fixed row height and container height.',
    examples: ['<VirtualList items={data} rowHeight={40} height={400} />'], constraints: ['Calculate visible range', 'Use absolute positioning'] },
  { id: 'sq-01', domain: 'sql', difficulty: 3, title: 'Window Function Ranking',
    description: 'Write a SQL query that ranks employees by salary within each department, handling ties with DENSE_RANK.',
    examples: ['SELECT *, DENSE_RANK() OVER (PARTITION BY dept ...)'], constraints: ['Use DENSE_RANK', 'Order by salary DESC'] },
  { id: 'cr-01', domain: 'cloudrun', difficulty: 3, title: 'Cold Start Optimizer',
    description: 'Write a Cloud Run startup probe handler that pre-warms connections to a database and cache, returning 200 only when both are ready.',
    examples: ['app.get("/_startup", handler)'], constraints: ['Parallel warmup', 'Timeout after 10s'] },
  { id: 'cf-01', domain: 'cloudflare', difficulty: 3, title: 'Edge KV Rate Limiter',
    description: 'Implement a Cloudflare Worker that rate-limits requests per IP using KV storage with a sliding window.',
    examples: ['addEventListener("fetch", handleRequest)'], constraints: ['Use KV namespace', '60 req/min limit'] },
  { id: 'cf-02', domain: 'cloudflare', difficulty: 4, title: 'Smart Cache Purge',
    description: 'Write a Worker that selectively purges cache based on content tags, supporting wildcard patterns.',
    examples: ['purgeByTag("blog:*")'], constraints: ['Use Cache API', 'Support glob matching'] },
  { id: 'sg-01', domain: 'sacred-geometry-css', difficulty: 2, title: 'Golden Ratio Grid',
    description: 'Create a CSS Grid layout where column widths follow the golden ratio sequence: 1fr, 1.618fr, 2.618fr.',
    examples: ['.grid { grid-template-columns: 1fr 1.618fr 2.618fr; }'], constraints: ['Pure CSS', 'Use custom properties for phi'] },
  { id: 'sg-02', domain: 'sacred-geometry-css', difficulty: 4, title: 'Fibonacci Spiral Animation',
    description: 'Build a CSS animation that draws an approximation of the Fibonacci spiral using nested elements with phi-scaled border-radius.',
    examples: ['@keyframes spiral { ... }'], constraints: ['Use CSS transforms', 'At least 8 segments'] },
  { id: 'mp-01', domain: 'mcp-protocol', difficulty: 3, title: 'MCP Tool Registry',
    description: 'Implement an MCP tool registry that validates tool schemas, supports versioning, and returns capability listings.',
    examples: ['registry.register({ name, schema, handler })'], constraints: ['JSON Schema validation', 'Semver versioning'] },
  { id: 'mp-02', domain: 'mcp-protocol', difficulty: 5, title: 'MCP Streaming Transport',
    description: 'Build an MCP transport layer that supports server-sent events for streaming tool results back to the client.',
    examples: ['transport.stream(toolId, params, onChunk)'], constraints: ['SSE format', 'Heartbeat keepalive'] },
  { id: 'ao-01', domain: 'agent-orchestration', difficulty: 4, title: 'Fan-Out Supervisor',
    description: 'Create a supervisor that fans out tasks to N agents in parallel, collects results, and applies a consensus function.',
    examples: ['supervisor.fanOut(task, agents, consensusFn)'], constraints: ['Handle agent failures', 'Configurable timeout'] },
  { id: 'ao-02', domain: 'agent-orchestration', difficulty: 5, title: 'Agent Memory Sync',
    description: 'Implement a shared memory protocol where agents can read/write to a vector store with conflict resolution via vector clocks.',
    examples: ['memory.write(agentId, key, value, clock)'], constraints: ['Vector clock merge', 'Last-writer-wins fallback'] },
  { id: 'se-01', domain: 'security', difficulty: 3, title: 'Timing-Safe Comparator',
    description: 'Write a constant-time string comparison function that prevents timing side-channel attacks on API key validation.',
    examples: ['timingSafeEqual(input, secret)'], constraints: ['Fixed-time execution', 'Handle different lengths'] },
  { id: 'se-02', domain: 'security', difficulty: 4, title: 'JWT Rotation Manager',
    description: 'Build a JWT key rotation system that maintains current and previous signing keys, allowing graceful key transitions.',
    examples: ['rotator.sign(payload) / rotator.verify(token)'], constraints: ['Support RS256', 'Max 2 active keys'] },
  { id: 'tr-01', domain: 'trading', difficulty: 3, title: 'Moving Average Crossover',
    description: 'Implement a function that detects golden cross and death cross signals from two moving average series.',
    examples: ['detectCrossover(shortMA, longMA) // { type, index }'], constraints: ['Return crossover points', 'Handle edge cases'] },
  { id: 'dv-01', domain: 'devops', difficulty: 2, title: 'Health Check Aggregator',
    description: 'Write a health check endpoint that probes N upstream services in parallel and returns aggregate status.',
    examples: ['GET /health => { status, services: [...] }'], constraints: ['Parallel probes', '5s timeout per service'] },
  { id: 'dv-02', domain: 'devops', difficulty: 4, title: 'Canary Deploy Controller',
    description: 'Implement a canary deployment controller that gradually shifts traffic from 1% to 100% based on error rate thresholds.',
    examples: ['canary.advance() // 1% -> 5% -> 20% -> 100%'], constraints: ['Rollback on error spike', 'Configurable steps'] },
  { id: 'pe-01', domain: 'prompt-engineering', difficulty: 3, title: 'Prompt Template Engine',
    description: 'Build a template engine that supports variable interpolation, conditional blocks, and few-shot example injection.',
    examples: ['engine.render(template, { vars, examples })'], constraints: ['{{var}} syntax', '#if/#endif conditionals'] },
];

// --- Core Functions ---------------------------------------------------------

/**
 * Generate a challenge from the pool.
 * @param {number} [difficulty] - 1-5, optional filter
 * @param {string} [domain] - domain filter
 * @returns {object} challenge object
 */
function generateChallenge(difficulty, domain) {
  let pool = CHALLENGE_POOL;
  if (difficulty) pool = pool.filter(c => c.difficulty === difficulty);
  if (domain) pool = pool.filter(c => c.domain === domain);
  if (pool.length === 0) pool = CHALLENGE_POOL;

  // Deterministic-ish selection using phi-derived index
  const idx = Math.floor(Date.now() * PHI) % pool.length;
  const challenge = { ...pool[idx], generatedAt: new Date().toISOString() };

  emit('dojo:challenge_generated', { id: challenge.id, domain: challenge.domain, difficulty: challenge.difficulty });
  return challenge;
}

/**
 * Evaluate a submitted solution.
 * @param {string} challengeId
 * @param {string} code - submitted source code
 * @returns {object} { score, breakdown, feedback }
 */
function evaluateSubmission(challengeId, code) {
  const challenge = CHALLENGE_POOL.find(c => c.id === challengeId);
  if (!challenge) return { score: 0, breakdown: {}, feedback: 'Challenge not found.' };
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return { score: 0, breakdown: {}, feedback: 'Empty submission.' };
  }

  const breakdown = {};

  // 1. Syntax validity (0-30)
  try {
    new Function(code);
    breakdown.syntax = 30;
  } catch (e) {
    breakdown.syntax = 0;
    const result = { score: 0, breakdown, feedback: `Syntax error: ${e.message}` };
    recordSubmission(challengeId, code, 0, challenge.domain);
    emit('dojo:solution_evaluated', { challengeId, score: 0 });
    return result;
  }

  // 2. Code length efficiency (0-20) — shorter well-structured code scores higher
  const lines = code.split('\n').filter(l => l.trim().length > 0).length;
  if (lines <= 5) breakdown.efficiency = 8;
  else if (lines <= 15) breakdown.efficiency = 20;
  else if (lines <= 40) breakdown.efficiency = 16;
  else if (lines <= 80) breakdown.efficiency = 12;
  else breakdown.efficiency = 6;

  // 3. Structure quality (0-25) — functions, error handling, comments
  let structure = 0;
  if (/function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(/.test(code)) structure += 8;
  if (/try\s*\{/.test(code)) structure += 6;
  if (/\/\/|\/\*/.test(code)) structure += 4;
  if (/return\s+/.test(code)) structure += 4;
  if (/(?:class|module\.exports|export)/.test(code)) structure += 3;
  breakdown.structure = Math.min(structure, 25);

  // 4. Pattern usage (0-15)
  const patterns = extractPatterns(code);
  breakdown.patterns = Math.min(patterns.length * 5, 15);

  // 5. Constraint adherence (0-10) — keyword presence from constraints
  let constraintHits = 0;
  for (const constraint of challenge.constraints) {
    const keywords = constraint.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (keywords.some(kw => code.toLowerCase().includes(kw))) constraintHits++;
  }
  breakdown.constraints = Math.min(Math.round((constraintHits / Math.max(challenge.constraints.length, 1)) * 10), 10);

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const feedback = score >= 80 ? 'Excellent solution!' :
                   score >= 60 ? 'Good approach, consider edge cases and patterns.' :
                   score >= 40 ? 'Decent start. Focus on structure and constraint coverage.' :
                   'Needs improvement. Review the challenge constraints.';

  recordSubmission(challengeId, code, score, challenge.domain);
  emit('dojo:solution_evaluated', { challengeId, score, domain: challenge.domain });

  return { score, breakdown, feedback, patterns: patterns.map(p => p.name) };
}

/**
 * Record a submission for tracking.
 */
function recordSubmission(challengeId, code, score, domain) {
  const today = new Date().toISOString().slice(0, 10);
  submissions.push({ challengeId, score, domain, ts: Date.now(), date: today });

  // Update streak
  if (streakTracker.lastDate === today) {
    // same day, no change
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streakTracker.streak = (streakTracker.lastDate === yesterday) ? streakTracker.streak + 1 : 1;
    streakTracker.lastDate = today;
  }
}

/**
 * Identify common design patterns in code.
 * @param {string} code
 * @returns {Array<{name: string, confidence: number}>}
 */
function extractPatterns(code) {
  const detected = [];
  const checks = [
    { name: 'factory',    re: /function\s+create\w+|new\s+\w+\(|=>\s*new\s+/ },
    { name: 'observer',   re: /\.on\(|\.emit\(|addEventListener|subscribe|EventEmitter/ },
    { name: 'middleware',  re: /next\(\)|use\(|middleware|req\s*,\s*res\s*,\s*next/ },
    { name: 'singleton',  re: /getInstance|instance\s*===\s*null|_instance/ },
    { name: 'strategy',   re: /strategy|strategies\[|getStrategy/ },
    { name: 'decorator',  re: /wrapper|decorate|@\w+|Object\.assign\(.*prototype/ },
    { name: 'promise-chain', re: /\.then\(|\.catch\(|async\s+function|await\s+/ },
    { name: 'iterator',   re: /Symbol\.iterator|\[Symbol\.iterator\]|next\(\)\s*\{|yield\s+/ },
    { name: 'proxy',      re: /new\s+Proxy\(|handler\s*=\s*\{.*get\s*:/ },
    { name: 'builder',    re: /\.set\w+\(.*\)\s*\{[^}]*return\s+this|\.build\(\)/ },
    { name: 'circuit-breaker', re: /circuitBreaker|circuit_breaker|state\s*===\s*'open'/ },
    { name: 'pub-sub',    re: /publish|subscribe|channel|topic/ },
  ];
  for (const { name, re } of checks) {
    if (re.test(code)) {
      detected.push({ name, confidence: Math.round(PHI * 60) / 100 });
    }
  }
  return detected;
}

/**
 * Compute skill radar across all 12 domains.
 * @returns {object} domain -> { avgScore, attempts, proficiency }
 */
function getSkillRadar() {
  const radar = {};
  for (const domain of DOMAINS) {
    const domainSubs = submissions.filter(s => s.domain === domain);
    const attempts = domainSubs.length;
    const avgScore = attempts > 0 ? Math.round(domainSubs.reduce((a, s) => a + s.score, 0) / attempts) : 0;
    // Proficiency scales with attempts and score, capped at 100
    const proficiency = Math.min(100, Math.round(avgScore * Math.log2(attempts + 1) * (1 / PHI)));
    radar[domain] = { avgScore, attempts, proficiency };
  }
  return radar;
}

/**
 * Get daily statistics.
 * @returns {object} { completedToday, avgScoreToday, streak, totalSubmissions }
 */
function getDailyStats() {
  const today = new Date().toISOString().slice(0, 10);
  const todaySubs = submissions.filter(s => s.date === today);
  const completedToday = todaySubs.length;
  const avgScoreToday = completedToday > 0
    ? Math.round(todaySubs.reduce((a, s) => a + s.score, 0) / completedToday)
    : 0;
  return {
    completedToday,
    avgScoreToday,
    streak: streakTracker.streak,
    totalSubmissions: submissions.length,
    date: today,
  };
}

// --- Express Routes ---------------------------------------------------------

router.post('/api/v1/dojo/challenge', (req, res) => {
  try {
    const { difficulty, domain } = req.body || {};
    const challenge = generateChallenge(
      difficulty ? Number(difficulty) : undefined,
      domain || undefined
    );
    res.json({ ok: true, challenge });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/api/v1/dojo/submit', (req, res) => {
  try {
    const { challengeId, code } = req.body || {};
    if (!challengeId || !code) {
      return res.status(400).json({ ok: false, error: 'challengeId and code are required.' });
    }
    const result = evaluateSubmission(challengeId, code);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/api/v1/dojo/radar', (_req, res) => {
  try {
    const radar = getSkillRadar();
    res.json({ ok: true, radar, domains: DOMAINS });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/api/v1/dojo/stats', (_req, res) => {
  try {
    const stats = getDailyStats();
    res.json({ ok: true, stats });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Exports ----------------------------------------------------------------
module.exports = {
  router,
  generateChallenge,
  evaluateSubmission,
  getSkillRadar,
  getDailyStats,
  extractPatterns,
  DOMAINS,
  CHALLENGE_POOL,
};
