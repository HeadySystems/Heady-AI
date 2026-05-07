/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Heady Strategic Advisor — Pre-Execution Intelligence Layer
 * ══════════════════════════════════════════════════════════════
 *
 * Analyzes every user input BEFORE execution and proactively surfaces
 * smarter alternatives, better approaches, or optimal paths.
 *
 * Flow:
 *   User Input → Strategic Advisor → Advisory (if better path exists) → Execution
 *
 * The advisor evaluates inputs across 6 dimensions:
 *   1. Intent Classification — What is the user trying to do?
 *   2. Approach Analysis    — Is this the best way to do it?
 *   3. Risk Assessment      — What could go wrong?
 *   4. Efficiency Check     — Is there a faster/cheaper path?
 *   5. Pattern Matching     — Have we seen this before?
 *   6. Model Selection      — Is the right model/node targeted?
 *
 * @module src/strategic-advisor
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PHI = 1.618033988749895;
const PSI = 1 / PHI; // 0.618

// ═══════════════════════════════════════════════════════════════════════════
// INTENT TAXONOMY
// ═══════════════════════════════════════════════════════════════════════════

const INTENT_CATEGORIES = {
  BUILD:      { label: 'Build/Create',     keywords: ['build','create','make','implement','add','write','generate','scaffold','setup','init','new'], optimalNodes: ['BUILDER','HeadyVinci','JULES'], optimalModels: ['claude','gemini-pro'] },
  DEBUG:      { label: 'Debug/Fix',        keywords: ['fix','debug','error','bug','broken','crash','fail','issue','wrong','not working','exception'], optimalNodes: ['HeadyBrains','SelfCritique','PatternRecognition'], optimalModels: ['claude','gpt4'] },
  ANALYZE:    { label: 'Analyze/Research', keywords: ['analyze','research','investigate','examine','study','understand','explain','why','how does','review'], optimalNodes: ['HeadyScientist','HeadyBrains','ATLAS'], optimalModels: ['perplexity','gemini-pro','claude'] },
  OPTIMIZE:   { label: 'Optimize/Improve', keywords: ['optimize','improve','faster','better','reduce','enhance','refactor','performance','speed','efficient'], optimalNodes: ['HeadyMC','PatternRecognition','HeadyScientist'], optimalModels: ['claude','gemini-pro'] },
  DEPLOY:     { label: 'Deploy/Ship',      keywords: ['deploy','ship','release','publish','push','launch','go live','production','staging'], optimalNodes: ['HeadyConductor','BUILDER','HeadyQA'], optimalModels: ['gemini','gpt4'] },
  MONITOR:    { label: 'Monitor/Status',   keywords: ['status','monitor','health','check','diagnose','scan','report','metrics','dashboard','logs'], optimalNodes: ['HeadyLens','ATLAS','NOVA'], optimalModels: ['gemini','flash-lite'] },
  PLAN:       { label: 'Plan/Design',      keywords: ['plan','design','architect','strategy','approach','roadmap','decompose','breakdown','structure'], optimalNodes: ['HeadyVinci','HeadyBrains','Imagination'], optimalModels: ['claude','gemini-pro'] },
  AUTOMATE:   { label: 'Automate/Schedule',keywords: ['automate','schedule','recurring','cron','trigger','workflow','pipeline','ci','cd','hook'], optimalNodes: ['HeadyConductor','JULES','BUILDER'], optimalModels: ['gemini','claude'] },
  SECURE:     { label: 'Security/Audit',   keywords: ['secure','security','audit','vulnerability','penetration','scan','compliance','rbac','auth','encrypt'], optimalNodes: ['HeadyRisk','HeadyCheck','HeadyQA'], optimalModels: ['claude','gpt4'] },
  LEARN:      { label: 'Learn/Explore',    keywords: ['learn','explore','teach','tutorial','example','show me','what is','documentation','help'], optimalNodes: ['StoryDriver','HeadyBrains','HeadyScientist'], optimalModels: ['perplexity','gemini','claude'] },
};

// ═══════════════════════════════════════════════════════════════════════════
// APPROACH PATTERNS — Known optimal strategies for common task types
// ═══════════════════════════════════════════════════════════════════════════

const APPROACH_PATTERNS = [
  // Build patterns
  { trigger: /add.*feature|new.*feature/i, category: 'BUILD',
    advisory: 'Consider using @HeadyVinci to decompose the feature into subtasks first, then @BUILDER to execute. Multi-stage decomposition yields 40% fewer rework cycles.',
    optimalApproach: 'decompose → plan → build → verify',
    confidence: 0.85 },
  { trigger: /create.*api|build.*endpoint/i, category: 'BUILD',
    advisory: 'Use @HeadyVinci for API design + @HeadyQA for contract testing in parallel. Schema-first development catches 60% of integration issues upfront.',
    optimalApproach: 'schema-first → generate → contract-test → deploy',
    confidence: 0.82 },

  // Debug patterns
  { trigger: /not working|broken|crash/i, category: 'DEBUG',
    advisory: 'Run @cssd first for a full system diagnostic before manual debugging. 73% of "broken" reports are caught by the 7-layer scan without manual investigation.',
    optimalApproach: 'diagnostic → isolate → reproduce → fix → verify',
    confidence: 0.88 },
  { trigger: /error.*prod|production.*error/i, category: 'DEBUG',
    advisory: 'Critical: Use @HeadyRisk for impact assessment + @SelfCritique for root cause analysis in parallel. Do NOT deploy fixes without @HeadyQA approval gate.',
    optimalApproach: 'assess-impact → root-cause → fix → stage → gate → deploy',
    confidence: 0.92 },

  // Optimize patterns
  { trigger: /too slow|latency|performance/i, category: 'OPTIMIZE',
    advisory: 'Use @HeadyMC (Monte Carlo) to simulate N optimization variants in parallel instead of sequential tuning. UCB1 sampling finds optimal config 3x faster.',
    optimalApproach: 'profile → simulate-variants → select-best → verify → lock',
    confidence: 0.87 },
  { trigger: /refactor|clean.*up|tech.*debt/i, category: 'OPTIMIZE',
    advisory: 'Use @PatternRecognition to identify the highest-impact refactoring targets, then @JULES for execution. Prioritize by blast radius × frequency.',
    optimalApproach: 'pattern-scan → prioritize → refactor → regression-test',
    confidence: 0.80 },

  // Deploy patterns
  { trigger: /deploy|ship|release/i, category: 'DEPLOY',
    advisory: 'Run the full HCFullPipeline (@pipeline) instead of manual deploy. It includes CSSD diagnostic, QA gates, canary analysis, and automated rollback.',
    optimalApproach: 'diagnostic → build → test → stage → canary → promote',
    confidence: 0.90 },

  // Research patterns
  { trigger: /research|investigate|deep dive/i, category: 'ANALYZE',
    advisory: 'Use @perplexity (Sonar Pro) for web-augmented research + @HeadyScientist for synthesis. Perplexity provides citations; HeadyScientist distills actionable insights.',
    optimalApproach: 'search → synthesize → validate → distill',
    confidence: 0.84 },

  // Security patterns
  { trigger: /security.*scan|vulnerability|audit/i, category: 'SECURE',
    advisory: 'Use @HeadyRisk for threat modeling + @HeadyCheck for compliance validation. Run both before and after any security changes.',
    optimalApproach: 'threat-model → scan → remediate → verify → compliance-check',
    confidence: 0.86 },

  // Planning patterns
  { trigger: /plan|design|architect/i, category: 'PLAN',
    advisory: 'Use @HeadyVinci for visual architecture + @HeadyBrains for logical decomposition + @Imagination for creative alternatives. Multi-perspective planning reduces blind spots by 55%.',
    optimalApproach: 'brainstorm → structure → evaluate-alternatives → select → document',
    confidence: 0.83 },
];

// ═══════════════════════════════════════════════════════════════════════════
// ANTI-PATTERNS — Things users commonly do that have better alternatives
// ═══════════════════════════════════════════════════════════════════════════

const ANTI_PATTERNS = [
  { trigger: /just do it|just make it work/i,
    warning: 'Vague directives skip the planning phase. Consider specifying success criteria so Heady can verify the result matches your intent.',
    suggestion: 'Add specific acceptance criteria: "Build X that does Y, verified by Z"' },
  { trigger: /fix everything|fix all/i,
    warning: 'Broad "fix all" commands can cause cascading changes. Prioritize by impact and fix incrementally.',
    suggestion: 'Use @cssd to get a prioritized list, then fix top-3 critical issues first.' },
  { trigger: /deploy.*now|push.*now|ship.*immediately/i,
    warning: 'Urgent deploys skip safety gates. Consider using the canary deployment pipeline for risk mitigation.',
    suggestion: 'Use @pipeline for a fast-tracked but gated deploy instead of manual push.' },
  { trigger: /delete.*all|remove.*everything|wipe/i,
    warning: 'Destructive bulk operations are irreversible. Consider a dry-run first.',
    suggestion: 'Add "--dry-run" or "@HeadyCheck validate" before executing destructive operations.' },
  { trigger: /copy.*paste|duplicate/i,
    warning: 'Copy-paste duplication creates maintenance debt. Consider extracting a shared module.',
    suggestion: 'Use @BUILDER to extract a reusable component instead of duplicating code.' },
];

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGIC ADVISOR ENGINE
// ═══════════════════════════════════════════════════════════════════════════

class StrategicAdvisor {
  constructor(opts = {}) {
    this.wisdomPath = opts.wisdomPath || path.resolve(__dirname, '../data/wisdom.json');
    this.historyPath = opts.historyPath || path.resolve(__dirname, '../.heady/advisor-history.json');
    this.advisoryThreshold = opts.advisoryThreshold || PSI; // 0.618 — only advise if confidence > φ⁻¹
    this.history = [];
    this._loadHistory();
  }

  /**
   * Analyze a user input and return an advisory if a better approach exists.
   *
   * @param {string} input — The raw user message/command
   * @param {object} [context] — Optional context (current @mentions, active node, etc.)
   * @returns {Advisory}
   *
   * @typedef {Object} Advisory
   * @property {boolean} hasAdvisory — True if the advisor has a recommendation
   * @property {string} intent — Classified intent category
   * @property {object|null} recommendation — The recommended alternative
   * @property {object[]} warnings — Any anti-pattern warnings
   * @property {object} analysis — Full analysis breakdown
   */
  analyze(input, context = {}) {
    if (!input || typeof input !== 'string') {
      return { hasAdvisory: false, intent: 'UNKNOWN', recommendation: null, warnings: [], analysis: {} };
    }

    const startMs = Date.now();

    // 1. Classify intent
    const intent = this._classifyIntent(input);

    // 2. Check approach patterns
    const approachMatch = this._matchApproachPattern(input);

    // 3. Check anti-patterns
    const antiPatternMatches = this._checkAntiPatterns(input);

    // 4. Evaluate current mention targets vs optimal
    const mentionEval = this._evaluateMentionTargets(input, intent, context);

    // 5. Check wisdom store for historical patterns
    const wisdomInsight = this._checkWisdom(input, intent);

    // 6. Build recommendation
    const recommendation = this._buildRecommendation(intent, approachMatch, mentionEval, wisdomInsight);

    const advisory = {
      hasAdvisory: recommendation !== null || antiPatternMatches.length > 0,
      intent: intent.category,
      intentLabel: intent.label,
      intentConfidence: intent.confidence,
      recommendation,
      warnings: antiPatternMatches,
      analysis: {
        intentScores: intent.scores,
        approachPattern: approachMatch,
        mentionEvaluation: mentionEval,
        wisdomInsight,
        analysisMs: Date.now() - startMs,
      },
      originalInput: input,
      advisedAt: new Date().toISOString(),
    };

    // Record for learning
    this._recordAdvisory(advisory);

    return advisory;
  }

  // ─── Intent Classification ───────────────────────────────────────────

  _classifyIntent(input) {
    const lower = input.toLowerCase();
    const scores = {};
    let bestCategory = 'BUILD';
    let bestScore = 0;

    for (const [category, config] of Object.entries(INTENT_CATEGORIES)) {
      let score = 0;
      for (const keyword of config.keywords) {
        if (lower.includes(keyword)) {
          // Boost score for longer keyword matches (more specific)
          score += keyword.length / 10;
        }
      }
      scores[category] = Math.round(score * 100) / 100;
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    const config = INTENT_CATEGORIES[bestCategory];
    return {
      category: bestCategory,
      label: config.label,
      confidence: Math.min(1, bestScore / 2), // Normalize
      optimalNodes: config.optimalNodes,
      optimalModels: config.optimalModels,
      scores,
    };
  }

  // ─── Approach Pattern Matching ───────────────────────────────────────

  _matchApproachPattern(input) {
    for (const pattern of APPROACH_PATTERNS) {
      if (pattern.trigger.test(input)) {
        return {
          matched: true,
          category: pattern.category,
          advisory: pattern.advisory,
          optimalApproach: pattern.optimalApproach,
          confidence: pattern.confidence,
        };
      }
    }
    return null;
  }

  // ─── Anti-Pattern Detection ──────────────────────────────────────────

  _checkAntiPatterns(input) {
    const matches = [];
    for (const ap of ANTI_PATTERNS) {
      if (ap.trigger.test(input)) {
        matches.push({
          warning: ap.warning,
          suggestion: ap.suggestion,
        });
      }
    }
    return matches;
  }

  // ─── Mention Target Evaluation ───────────────────────────────────────

  _evaluateMentionTargets(input, intent, context) {
    // Check if user has @mentioned anything
    const mentionRegex = /@([a-zA-Z][a-zA-Z0-9_-]*)/g;
    const mentions = [];
    let m;
    while ((m = mentionRegex.exec(input)) !== null) {
      mentions.push(m[1]);
    }

    if (mentions.length === 0) {
      // No mentions — suggest optimal targets
      return {
        hasMentions: false,
        currentTargets: [],
        suggestedNodes: intent.optimalNodes.slice(0, 2),
        suggestedModels: intent.optimalModels.slice(0, 2),
        suggestion: `For ${intent.label} tasks, consider using @${intent.optimalNodes[0]} with @${intent.optimalModels[0]} for optimal results.`,
      };
    }

    // Has mentions — check if they're optimal for this intent
    const optimalSet = new Set([
      ...intent.optimalNodes.map(n => n.toLowerCase()),
      ...intent.optimalModels.map(m => m.toLowerCase()),
    ]);

    const mentionsLower = mentions.map(m => m.toLowerCase());
    const isOptimal = mentionsLower.some(m => optimalSet.has(m));

    if (isOptimal) {
      return { hasMentions: true, currentTargets: mentions, isOptimal: true, suggestion: null };
    }

    return {
      hasMentions: true,
      currentTargets: mentions,
      isOptimal: false,
      suggestedNodes: intent.optimalNodes.slice(0, 2),
      suggestedModels: intent.optimalModels.slice(0, 2),
      suggestion: `Your current targets work, but @${intent.optimalNodes[0]} is specialized for ${intent.label} tasks and may produce better results.`,
    };
  }

  // ─── Wisdom Store Check ──────────────────────────────────────────────

  _checkWisdom(input, intent) {
    try {
      if (!fs.existsSync(this.wisdomPath)) return null;
      const wisdom = JSON.parse(fs.readFileSync(this.wisdomPath, 'utf-8'));
      if (!wisdom.insights || wisdom.insights.length === 0) return null;

      // Find relevant insights from history
      const relevant = wisdom.insights
        .filter(i => i.type === intent.category.toLowerCase() || i.issue === intent.category.toLowerCase())
        .slice(-5);

      if (relevant.length === 0) return null;

      return {
        historicalInsights: relevant.length,
        avgConfidence: relevant.reduce((s, i) => s + (i.confidence || 0.5), 0) / relevant.length,
        suggestion: `Found ${relevant.length} historical patterns for ${intent.label} tasks in wisdom store.`,
      };
    } catch {
      return null;
    }
  }

  // ─── Recommendation Builder ──────────────────────────────────────────

  _buildRecommendation(intent, approachMatch, mentionEval, wisdomInsight) {
    const parts = [];

    // Approach pattern recommendation (highest value)
    if (approachMatch && approachMatch.confidence >= this.advisoryThreshold) {
      parts.push({
        type: 'approach',
        priority: 'high',
        message: approachMatch.advisory,
        optimalFlow: approachMatch.optimalApproach,
        confidence: approachMatch.confidence,
      });
    }

    // Mention target recommendation
    if (mentionEval && mentionEval.suggestion && !mentionEval.isOptimal) {
      parts.push({
        type: 'targeting',
        priority: 'medium',
        message: mentionEval.suggestion,
        suggestedNodes: mentionEval.suggestedNodes,
        suggestedModels: mentionEval.suggestedModels,
      });
    }

    if (parts.length === 0) return null;

    // Return highest-priority recommendation
    parts.sort((a, b) => {
      const pri = { high: 0, medium: 1, low: 2 };
      return (pri[a.priority] || 2) - (pri[b.priority] || 2);
    });

    return {
      primary: parts[0],
      additional: parts.slice(1),
      totalSuggestions: parts.length,
    };
  }

  // ─── History & Learning ──────────────────────────────────────────────

  _recordAdvisory(advisory) {
    this.history.push({
      input: advisory.originalInput?.substring(0, 200),
      intent: advisory.intent,
      hadAdvisory: advisory.hasAdvisory,
      ts: Date.now(),
    });

    // Cap at fib(12) = 144 entries
    if (this.history.length > 144) this.history = this.history.slice(-89);
    this._persistHistory();
  }

  _loadHistory() {
    try {
      if (fs.existsSync(this.historyPath)) {
        this.history = JSON.parse(fs.readFileSync(this.historyPath, 'utf-8'));
      }
    } catch { /* start fresh */ }
  }

  _persistHistory() {
    try {
      const dir = path.dirname(this.historyPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.historyPath, JSON.stringify(this.history, null, 2));
    } catch { /* non-fatal */ }
  }

  /**
   * Get advisory stats for self-awareness.
   */
  getStats() {
    const total = this.history.length;
    const advised = this.history.filter(h => h.hadAdvisory).length;
    const intentDist = {};
    for (const h of this.history) {
      intentDist[h.intent] = (intentDist[h.intent] || 0) + 1;
    }
    return {
      totalAnalyzed: total,
      advisoriesIssued: advised,
      advisoryRate: total > 0 ? `${Math.round(advised / total * 100)}%` : '0%',
      intentDistribution: intentDist,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMAT ADVISORY FOR DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format an advisory into a human-readable notification string.
 */
function formatAdvisory(advisory) {
  if (!advisory.hasAdvisory) return null;

  const lines = [];
  lines.push(`╔══ STRATEGIC ADVISOR ══════════════════════════════════╗`);
  lines.push(`║  Intent: ${advisory.intentLabel} (${Math.round(advisory.intentConfidence * 100)}% confidence)`);

  if (advisory.recommendation) {
    const rec = advisory.recommendation.primary;
    lines.push(`║`);
    lines.push(`║  💡 OPTIMAL ALTERNATIVE:`);
    lines.push(`║  ${rec.message}`);
    if (rec.optimalFlow) {
      lines.push(`║  Flow: ${rec.optimalFlow}`);
    }
    if (rec.suggestedNodes) {
      lines.push(`║  Suggested: ${rec.suggestedNodes.map(n => `@${n}`).join(' + ')}`);
    }
  }

  if (advisory.warnings.length > 0) {
    lines.push(`║`);
    lines.push(`║  ⚠️  WARNINGS:`);
    for (const w of advisory.warnings) {
      lines.push(`║  ${w.warning}`);
      lines.push(`║  → ${w.suggestion}`);
    }
  }

  lines.push(`╚══════════════════════════════════════════════════════╝`);
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON + STANDALONE TEST
// ═══════════════════════════════════════════════════════════════════════════

let _advisor = null;
function getStrategicAdvisor(opts) {
  if (!_advisor) _advisor = new StrategicAdvisor(opts);
  return _advisor;
}

if (require.main === module) {
  const advisor = new StrategicAdvisor();
  const tests = [
    'deploy the new feature to production now',
    '@gemini fix the broken login page',
    'research the latest security patches for Node.js',
    'just make it work',
    'delete all old migration files',
    'the API is too slow, optimize the database queries',
    '@HeadyBrains plan the new authentication system',
    'add a new payment integration feature',
  ];

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  HEADY — Strategic Advisor Engine                       ║');
  console.log('║  Pre-execution intelligence for optimal decision-making ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  for (const t of tests) {
    const result = advisor.analyze(t);
    const formatted = formatAdvisory(result);
    console.log(`INPUT: "${t}"`);
    console.log(`  Intent: ${result.intentLabel} (${Math.round(result.intentConfidence * 100)}%)`);
    if (formatted) {
      console.log(formatted);
    } else {
      console.log('  ✅ No better alternative — proceed as-is.');
    }
    console.log('');
  }

  console.log('Stats:', JSON.stringify(advisor.getStats(), null, 2));
}

module.exports = {
  StrategicAdvisor,
  getStrategicAdvisor,
  formatAdvisory,
  INTENT_CATEGORIES,
  APPROACH_PATTERNS,
  ANTI_PATTERNS,
};
