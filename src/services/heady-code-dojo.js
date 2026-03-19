// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ CODE DOJO — Continuous Coding Practice Engine           ║
// ║  Generates, evaluates, and tracks coding challenges 24/7        ║
// ║  FILE: src/services/heady-code-dojo.js                         ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

// ─── Skill Domains ──────────────────────────────────────────────────

const SKILL_DOMAINS = [
  { id: 'nodejs', name: 'Node.js', weight: 1.0 },
  { id: 'react', name: 'React', weight: 0.8 },
  { id: 'sql-pgvector', name: 'SQL/pgvector', weight: 0.9 },
  { id: 'cloud-run', name: 'Cloud Run', weight: 0.7 },
  { id: 'cloudflare-workers', name: 'Cloudflare Workers', weight: 0.7 },
  { id: 'sacred-geometry-css', name: 'Sacred Geometry CSS', weight: 0.5 },
  { id: 'mcp-protocol', name: 'MCP Protocol', weight: 0.8 },
  { id: 'agent-orchestration', name: 'Agent Orchestration', weight: 0.9 },
  { id: 'security-hardening', name: 'Security Hardening', weight: 0.85 },
  { id: 'trading-systems', name: 'Trading Systems', weight: 0.6 },
  { id: 'devops-ci', name: 'DevOps/CI', weight: 0.75 },
  { id: 'llm-prompt-engineering', name: 'LLM Prompt Engineering', weight: 0.85 },
];

// ─── Challenge Templates ────────────────────────────────────────────

const CHALLENGE_TEMPLATES = [
  {
    domain: 'nodejs',
    difficulty: 'easy',
    template: 'Implement a function that {action} using Node.js streams',
    actions: ['reads a file line by line and counts words', 'transforms JSON objects in a pipeline', 'implements backpressure handling'],
    evaluator: 'lint+test',
  },
  {
    domain: 'nodejs',
    difficulty: 'medium',
    template: 'Build a {component} with circuit breaker pattern',
    actions: ['HTTP client', 'database connection pool', 'service mesh proxy'],
    evaluator: 'lint+test+benchmark',
  },
  {
    domain: 'nodejs',
    difficulty: 'hard',
    template: 'Design a {system} with phi-scaled timeouts and graceful degradation',
    actions: ['distributed task scheduler', 'event-sourced state machine', 'multi-tenant service mesh'],
    evaluator: 'lint+test+benchmark+review',
  },
  {
    domain: 'sql-pgvector',
    difficulty: 'easy',
    template: 'Write a SQL query to {action}',
    actions: ['find top-K similar vectors using cosine distance', 'perform hybrid BM25 + vector search', 'implement row-level security for multi-tenant data'],
    evaluator: 'syntax+explain',
  },
  {
    domain: 'sql-pgvector',
    difficulty: 'medium',
    template: 'Optimize a pgvector query that {action}',
    actions: ['scans 1M vectors with WHERE filters', 'performs cross-tenant similarity search', 'combines full-text and semantic ranking'],
    evaluator: 'syntax+explain+benchmark',
  },
  {
    domain: 'security-hardening',
    difficulty: 'medium',
    template: 'Fix the security vulnerability: {vuln}',
    actions: ['prototype pollution via Object.assign with user input', 'XSS via unsanitized template literals', 'timing-safe comparison bypass in auth middleware'],
    evaluator: 'lint+test+security-scan',
  },
  {
    domain: 'agent-orchestration',
    difficulty: 'hard',
    template: 'Implement a {pattern} for multi-agent coordination',
    actions: ['consensus algorithm with Byzantine fault tolerance', 'swarm intelligence routing with CSL gates', 'supervisor pattern with parallel fan-out and aggregation'],
    evaluator: 'lint+test+benchmark',
  },
  {
    domain: 'mcp-protocol',
    difficulty: 'medium',
    template: 'Build an MCP server that {action}',
    actions: ['exposes tools for file system operations', 'implements resource discovery with pagination', 'handles streaming responses for long-running tools'],
    evaluator: 'lint+test',
  },
  {
    domain: 'llm-prompt-engineering',
    difficulty: 'easy',
    template: 'Write a prompt that {action} with structured output',
    actions: ['classifies intent from user messages', 'extracts entities from unstructured text', 'generates test cases from function signatures'],
    evaluator: 'quality-score',
  },
  {
    domain: 'cloud-run',
    difficulty: 'medium',
    template: 'Configure a Cloud Run service that {action}',
    actions: ['auto-scales based on CPU utilization with min 0 instances', 'handles graceful shutdown on SIGTERM', 'implements health checks with startup probes'],
    evaluator: 'yaml-lint+deploy-dry-run',
  },
  {
    domain: 'react',
    difficulty: 'medium',
    template: 'Build a React component that {action}',
    actions: ['renders a real-time dashboard with SSE data', 'implements virtual scrolling for 10K items', 'uses phi-scaled animations for breathing UI'],
    evaluator: 'lint+test+a11y',
  },
  {
    domain: 'devops-ci',
    difficulty: 'easy',
    template: 'Write a GitHub Actions workflow that {action}',
    actions: ['runs tests on PR and blocks merge on failure', 'builds and deploys to Cloud Run on main push', 'scans for secrets and vulnerabilities on every commit'],
    evaluator: 'yaml-lint',
  },
];

// ─── Challenge Generator ────────────────────────────────────────────

class ChallengeGenerator {
  constructor() {
    this.challengeHistory = [];
    this.skillScores = new Map();
    SKILL_DOMAINS.forEach(d => this.skillScores.set(d.id, { score: 50, attempts: 0, successes: 0 }));
  }

  generate(targetDomain = null, targetDifficulty = null) {
    const templates = CHALLENGE_TEMPLATES.filter(t => {
      if (targetDomain && t.domain !== targetDomain) return false;
      if (targetDifficulty && t.difficulty !== targetDifficulty) return false;
      return true;
    });

    if (templates.length === 0) {
      // Fall back to any template
      const t = CHALLENGE_TEMPLATES[Math.floor(Math.random() * CHALLENGE_TEMPLATES.length)];
      return this._buildChallenge(t);
    }

    const template = templates[Math.floor(Math.random() * templates.length)];
    return this._buildChallenge(template);
  }

  _buildChallenge(template) {
    const action = template.actions[Math.floor(Math.random() * template.actions.length)];
    const prompt = template.template.replace('{action}', action)
      .replace('{component}', action)
      .replace('{system}', action)
      .replace('{pattern}', action)
      .replace('{vuln}', action);

    const challenge = {
      id: `dojo_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      domain: template.domain,
      difficulty: template.difficulty,
      prompt,
      evaluator: template.evaluator,
      createdAt: new Date().toISOString(),
      timeoutMs: template.difficulty === 'easy' ? fibTimeout(8) : template.difficulty === 'medium' ? fibTimeout(9) : fibTimeout(10),
      maxScore: 100,
    };

    this.challengeHistory.push(challenge);
    return challenge;
  }

  generateBatch(count = 20) {
    const challenges = [];
    const weakestDomains = this.getWeakestDomains(3);

    for (let i = 0; i < count; i++) {
      // 60% from weakest domains, 40% random
      const domain = i < count * PSI ? weakestDomains[i % weakestDomains.length] : null;
      challenges.push(this.generate(domain));
    }
    return challenges;
  }

  getWeakestDomains(n = 3) {
    const sorted = [...this.skillScores.entries()]
      .sort((a, b) => a[1].score - b[1].score);
    return sorted.slice(0, n).map(([id]) => id);
  }
}

// ─── Solution Evaluator ─────────────────────────────────────────────

class SolutionEvaluator {
  evaluate(challenge, solution) {
    const scores = {
      syntaxValid: this._checkSyntax(solution),
      lintClean: this._checkLint(solution),
      correctness: this._checkCorrectness(challenge, solution),
      performance: this._checkPerformance(solution),
      security: this._checkSecurity(solution),
    };

    // CSL-weighted scoring: correctness 34%, security 21%, performance 21%, lint 13%, syntax 11%
    const total = Math.round(
      scores.correctness * 0.34 +
      scores.security * 0.21 +
      scores.performance * 0.21 +
      scores.lintClean * 0.13 +
      scores.syntaxValid * 0.11
    );

    return {
      challengeId: challenge.id,
      scores,
      totalScore: total,
      pass: total >= Math.round(PSI * 100), // 61.8% pass threshold
      evaluatedAt: new Date().toISOString(),
    };
  }

  _checkSyntax(solution) {
    try {
      new Function(solution);
      return 100;
    } catch {
      return 0;
    }
  }

  _checkLint(solution) {
    const issues = [];
    if (solution.includes('var ')) issues.push('use-const-let');
    if (solution.includes('==') && !solution.includes('===')) issues.push('strict-equality');
    if (solution.includes('eval(')) issues.push('no-eval');
    if (/console\.(log|warn|error)/.test(solution)) issues.push('no-console');
    return Math.max(0, 100 - issues.length * 25);
  }

  _checkCorrectness(challenge, solution) {
    // Basic heuristic: does the solution address the challenge domain?
    const domainKeywords = {
      'nodejs': ['require', 'module', 'exports', 'stream', 'buffer', 'async', 'await'],
      'sql-pgvector': ['SELECT', 'FROM', 'WHERE', 'vector', 'cosine', 'embedding'],
      'react': ['useState', 'useEffect', 'component', 'render', 'jsx', 'props'],
      'security-hardening': ['sanitize', 'validate', 'escape', 'hash', 'crypto', 'timingSafe'],
    };
    const keywords = domainKeywords[challenge.domain] || [];
    const matches = keywords.filter(kw => solution.toLowerCase().includes(kw.toLowerCase()));
    return Math.min(100, Math.round((matches.length / Math.max(1, keywords.length)) * 100));
  }

  _checkPerformance(solution) {
    const antiPatterns = ['for.*for.*for', 'while.*while', 'JSON.parse.*JSON.stringify.*JSON.parse'];
    let score = 100;
    for (const pattern of antiPatterns) {
      if (new RegExp(pattern).test(solution)) score -= 25;
    }
    return Math.max(0, score);
  }

  _checkSecurity(solution) {
    const vulns = ['eval(', '__proto__', 'constructor[', 'innerHTML', 'document.write', 'exec('];
    let score = 100;
    for (const v of vulns) {
      if (solution.includes(v)) score -= 20;
    }
    return Math.max(0, score);
  }
}

// ─── Pattern Extractor ──────────────────────────────────────────────

class PatternExtractor {
  constructor() {
    this.patterns = [];
  }

  extract(challenge, solution, evaluation) {
    if (evaluation.totalScore < 60) return null;

    const pattern = {
      id: `pattern_${Date.now()}`,
      domain: challenge.domain,
      difficulty: challenge.difficulty,
      prompt: challenge.prompt,
      solutionHash: crypto.createHash('sha256').update(solution).digest('hex').slice(0, 12),
      score: evaluation.totalScore,
      extractedAt: new Date().toISOString(),
      tags: this._extractTags(solution),
    };

    this.patterns.push(pattern);
    return pattern;
  }

  _extractTags(solution) {
    const tags = [];
    if (solution.includes('async') || solution.includes('await')) tags.push('async');
    if (solution.includes('stream') || solution.includes('pipe')) tags.push('streaming');
    if (solution.includes('cache') || solution.includes('memo')) tags.push('caching');
    if (solution.includes('retry') || solution.includes('backoff')) tags.push('resilience');
    if (solution.includes('crypto') || solution.includes('hash')) tags.push('security');
    return tags;
  }

  getLibrary() {
    return {
      totalPatterns: this.patterns.length,
      byDomain: this._groupBy('domain'),
      byDifficulty: this._groupBy('difficulty'),
      recentPatterns: this.patterns.slice(-20),
    };
  }

  _groupBy(key) {
    const groups = {};
    for (const p of this.patterns) {
      const k = p[key];
      groups[k] = (groups[k] || 0) + 1;
    }
    return groups;
  }
}

// ─── Skill Radar ────────────────────────────────────────────────────

class SkillRadar {
  constructor() {
    this.history = []; // { domain, score, timestamp }
  }

  record(domain, score) {
    this.history.push({ domain, score, timestamp: new Date().toISOString() });
  }

  getRadar() {
    const radar = {};
    for (const d of SKILL_DOMAINS) {
      const domainHistory = this.history.filter(h => h.domain === d.id);
      const recentScores = domainHistory.slice(-10).map(h => h.score);
      const avgScore = recentScores.length > 0
        ? Math.round(recentScores.reduce((s, v) => s + v, 0) / recentScores.length)
        : 50;
      const trend = recentScores.length >= 3
        ? recentScores[recentScores.length - 1] - recentScores[0] > 0 ? 'improving' : 'declining'
        : 'insufficient_data';
      radar[d.id] = {
        name: d.name,
        score: avgScore,
        attempts: domainHistory.length,
        trend,
        weight: d.weight,
      };
    }
    return radar;
  }

  getWeakestAreas(n = 5) {
    const radar = this.getRadar();
    return Object.entries(radar)
      .sort((a, b) => a[1].score - b[1].score)
      .slice(0, n)
      .map(([id, data]) => ({ id, ...data }));
  }
}

// ─── Code Dojo Service ──────────────────────────────────────────────

class HeadyCodeDojo {
  constructor() {
    this.generator = new ChallengeGenerator();
    this.evaluator = new SolutionEvaluator();
    this.patternExtractor = new PatternExtractor();
    this.skillRadar = new SkillRadar();
    this.completedToday = 0;
    this.dailyTarget = 20;
    this.sessionStart = new Date();
  }

  generateChallenge(domain, difficulty) {
    return this.generator.generate(domain, difficulty);
  }

  generateDailyBatch() {
    return this.generator.generateBatch(this.dailyTarget);
  }

  submitSolution(challenge, solution) {
    const evaluation = this.evaluator.evaluate(challenge, solution);
    this.skillRadar.record(challenge.domain, evaluation.totalScore);

    if (evaluation.pass) {
      this.completedToday++;
      this.patternExtractor.extract(challenge, solution, evaluation);
    }

    return {
      ...evaluation,
      completedToday: this.completedToday,
      dailyTarget: this.dailyTarget,
      onTrack: this.completedToday >= this._expectedByNow(),
    };
  }

  _expectedByNow() {
    const hoursElapsed = (Date.now() - this.sessionStart.getTime()) / 3600000;
    return Math.floor((hoursElapsed / 24) * this.dailyTarget);
  }

  getStatus() {
    return {
      completedToday: this.completedToday,
      dailyTarget: this.dailyTarget,
      challengesGenerated: this.generator.challengeHistory.length,
      patternsExtracted: this.patternExtractor.patterns.length,
      skillRadar: this.skillRadar.getRadar(),
      weakestAreas: this.skillRadar.getWeakestAreas(5),
      patternLibrary: this.patternExtractor.getLibrary(),
    };
  }
}

// ─── Express Router ─────────────────────────────────────────────────

function createDojoRouter() {
  const express = require('express');
  const router = express.Router();
  const dojo = new HeadyCodeDojo();

  const auth = (req, res, next) => {
    const key = req.headers['x-heady-api-key'] || req.headers['authorization']?.split(' ')[1];
    if (!key || key !== process.env.HEADY_API_KEY) {
      return res.status(403).json({ error: 'API key required' });
    }
    next();
  };

  router.get('/status', auth, (req, res) => {
    res.json({ ok: true, ...dojo.getStatus() });
  });

  router.post('/challenge', auth, (req, res) => {
    const { domain, difficulty } = req.body || {};
    res.json({ ok: true, challenge: dojo.generateChallenge(domain, difficulty) });
  });

  router.post('/batch', auth, (req, res) => {
    res.json({ ok: true, challenges: dojo.generateDailyBatch() });
  });

  router.post('/submit', auth, (req, res) => {
    const { challenge, solution } = req.body;
    if (!challenge || !solution) return res.status(400).json({ error: 'challenge and solution required' });
    res.json({ ok: true, result: dojo.submitSolution(challenge, solution) });
  });

  router.get('/radar', auth, (req, res) => {
    res.json({ ok: true, radar: dojo.skillRadar.getRadar(), weakest: dojo.skillRadar.getWeakestAreas() });
  });

  router.get('/patterns', auth, (req, res) => {
    res.json({ ok: true, library: dojo.patternExtractor.getLibrary() });
  });

  return router;
}

function fibTimeout(n) {
  return (FIB[n] || FIB[FIB.length - 1]) * 1000;
}

module.exports = { HeadyCodeDojo, createDojoRouter, SKILL_DOMAINS, CHALLENGE_TEMPLATES };
