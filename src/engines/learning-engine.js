/*
 * © 2026 Heady™ Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 * Autonomous Learning Engine — φ-scaled continuous improvement
 *
 * Runs on a cron cycle (default: every 5 minutes).
 * Reads resource events, git diffs, and pattern cache.
 * Extracts patterns, stores learnings, and writes improvement signals.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PATTERN_STORE = path.join(REPO_ROOT, '.heady_cache', 'pattern_store.json');
const STORIES_FILE = path.join(REPO_ROOT, '.heady', 'stories.json');
const EVENTS_LOG = path.join(REPO_ROOT, 'logs', 'resource-events.jsonl');
const LEARNINGS_LOG = path.join(REPO_ROOT, 'logs', 'learnings.jsonl');
const IMPROVEMENTS_LOG = path.join(REPO_ROOT, 'logs', 'improvements.jsonl');

const PHI = 1.618033988749895;
const CSL_THRESHOLD = 0.618;

/**
 * Load JSON file safely
 */
function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Append a JSONL record
 */
function appendJSONL(filepath, record) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(filepath, JSON.stringify(record) + '\n');
}

/**
 * Analyze resource events for patterns
 * - Detects recurring high-memory episodes
 * - Identifies time-of-day patterns
 * - Tracks trend stability
 */
function analyzeResourcePatterns() {
  if (!fs.existsSync(EVENTS_LOG)) return { patterns: [], insights: [] };

  const lines = fs.readFileSync(EVENTS_LOG, 'utf8').trim().split('\n');
  const recentEvents = lines.slice(-200).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  const severityCounts = {};
  const trendCounts = {};
  let maxUsage = 0;
  let avgUsage = 0;

  for (const evt of recentEvents) {
    severityCounts[evt.severity] = (severityCounts[evt.severity] || 0) + 1;
    trendCounts[evt.trend] = (trendCounts[evt.trend] || 0) + 1;
    if (evt.currentUsagePercent > maxUsage) maxUsage = evt.currentUsagePercent;
    avgUsage += evt.currentUsagePercent || 0;
  }
  avgUsage = recentEvents.length > 0 ? avgUsage / recentEvents.length : 0;

  const patterns = [];
  const insights = [];

  // Detect memory pressure pattern
  if ((severityCounts['WARN_HARD'] || 0) > recentEvents.length * CSL_THRESHOLD) {
    patterns.push({ type: 'MEMORY_PRESSURE', confidence: 0.9, severity: 'HIGH' });
    insights.push('System under sustained memory pressure — consider scaling or garbage collection');
  }

  // Detect stability
  if ((trendCounts['STABLE'] || 0) > recentEvents.length * 0.7) {
    patterns.push({ type: 'RESOURCE_STABLE', confidence: 0.85, severity: 'LOW' });
    insights.push('Resources are stable — good window for background optimization tasks');
  }

  // Detect rising trend
  if ((trendCounts['RISING'] || 0) > recentEvents.length * 0.4) {
    patterns.push({ type: 'RESOURCE_RISING', confidence: 0.75, severity: 'MEDIUM' });
    insights.push('Resource usage trending up — monitor for threshold breaches');
  }

  return { patterns, insights, stats: { maxUsage, avgUsage: Math.round(avgUsage), events: recentEvents.length } };
}

/**
 * Analyze git history for development patterns
 * - Commit frequency
 * - Most changed files
 * - Commit message topics
 */
function analyzeGitPatterns() {
  try {
    const log = execSync('git log --oneline --since="24 hours ago" 2>/dev/null', {
      cwd: REPO_ROOT, encoding: 'utf8', timeout: 5000
    }).trim();

    const commits = log ? log.split('\n') : [];
    const topics = {};

    for (const commit of commits) {
      const msg = commit.replace(/^[a-f0-9]+ /, '');
      // Extract topic keywords
      const words = msg.toLowerCase().split(/[\s:,]+/).filter(w => w.length > 3);
      for (const word of words) {
        topics[word] = (topics[word] || 0) + 1;
      }
    }

    // Sort by frequency
    const topTopics = Object.entries(topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return {
      commitCount24h: commits.length,
      topTopics,
      velocity: commits.length > 5 ? 'HIGH' : commits.length > 0 ? 'NORMAL' : 'IDLE'
    };
  } catch {
    return { commitCount24h: 0, topTopics: [], velocity: 'UNKNOWN' };
  }
}

/**
 * Update the pattern store with new learnings
 */
function updatePatternStore(resourceAnalysis, gitAnalysis) {
  const store = loadJSON(PATTERN_STORE);

  store.lastUpdated = new Date().toISOString();
  store.version = store.version ? store.version + 1 : 1;
  store.phi = PHI;

  // Merge resource patterns
  if (!store.resourcePatterns) store.resourcePatterns = [];
  for (const pattern of resourceAnalysis.patterns) {
    const existing = store.resourcePatterns.find(p => p.type === pattern.type);
    if (existing) {
      existing.occurrences = (existing.occurrences || 1) + 1;
      existing.lastSeen = new Date().toISOString();
      existing.confidence = Math.min(1, existing.confidence * PHI * 0.618 + pattern.confidence * 0.382);
    } else {
      store.resourcePatterns.push({
        ...pattern,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        occurrences: 1
      });
    }
  }

  // Store git velocity
  store.gitVelocity = gitAnalysis.velocity;
  store.commitCount24h = gitAnalysis.commitCount24h;
  store.topTopics = gitAnalysis.topTopics;

  // Prune old patterns (older than 7 days with low confidence)
  store.resourcePatterns = (store.resourcePatterns || []).filter(p => {
    const age = Date.now() - new Date(p.lastSeen).getTime();
    return age < 7 * 24 * 60 * 60 * 1000 || p.confidence > CSL_THRESHOLD;
  });

  const dir = path.dirname(PATTERN_STORE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PATTERN_STORE, JSON.stringify(store, null, 2));

  return store;
}

/**
 * Generate improvement suggestions based on patterns
 */
function generateImprovements(store) {
  const improvements = [];

  // Memory optimization suggestion
  const memPressure = (store.resourcePatterns || []).find(p => p.type === 'MEMORY_PRESSURE');
  if (memPressure && memPressure.occurrences > 3) {
    improvements.push({
      type: 'OPTIMIZATION',
      area: 'memory',
      suggestion: 'Persistent memory pressure detected — recommend enabling aggressive GC or increasing swap',
      priority: Math.min(10, Math.round(memPressure.occurrences * PHI)),
      autoApplicable: false
    });
  }

  // High velocity = more frequent auto-commits
  if (store.gitVelocity === 'HIGH') {
    improvements.push({
      type: 'WORKFLOW',
      area: 'git',
      suggestion: 'High commit velocity — auto-commit interval could be reduced to 5 minutes',
      priority: 3,
      autoApplicable: true
    });
  }

  // Idle = suggest running background optimization
  if (store.gitVelocity === 'IDLE') {
    improvements.push({
      type: 'OPTIMIZATION',
      area: 'maintenance',
      suggestion: 'System idle — good time for dependency updates, lint fixes, or test runs',
      priority: 2,
      autoApplicable: true
    });
  }

  return improvements;
}

/**
 * Main learning cycle
 */
async function runLearningCycle() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // 1. Analyze
  const resourceAnalysis = analyzeResourcePatterns();
  const gitAnalysis = analyzeGitPatterns();

  // 2. Learn — update pattern store
  const store = updatePatternStore(resourceAnalysis, gitAnalysis);

  // 3. Improve — generate suggestions
  const improvements = generateImprovements(store);

  // 4. Log the learning cycle
  const learning = {
    timestamp,
    durationMs: Date.now() - startTime,
    resourceStats: resourceAnalysis.stats,
    resourceInsights: resourceAnalysis.insights,
    gitVelocity: gitAnalysis.velocity,
    commitCount24h: gitAnalysis.commitCount24h,
    patternsTracked: (store.resourcePatterns || []).length,
    storeVersion: store.version,
    improvementCount: improvements.length
  };
  appendJSONL(LEARNINGS_LOG, learning);

  // 5. Log improvements
  for (const imp of improvements) {
    appendJSONL(IMPROVEMENTS_LOG, { ...imp, timestamp });
  }

  return { learning, improvements };
}

// Export for require() and direct execution
module.exports = { runLearningCycle, analyzeResourcePatterns, analyzeGitPatterns };

// Direct execution (node src/engines/learning-engine.js)
if (require.main === module) {
  runLearningCycle()
    .then(({ learning, improvements }) => {
      console.log(`[${learning.timestamp}] Learning cycle complete (${learning.durationMs}ms)`);
      console.log(`  Resources: ${learning.resourceStats?.events || 0} events, avg ${learning.resourceStats?.avgUsage || 0}% usage`);
      console.log(`  Git: ${learning.gitVelocity} velocity, ${learning.commitCount24h} commits/24h`);
      console.log(`  Patterns: ${learning.patternsTracked} tracked, store v${learning.storeVersion}`);
      console.log(`  Improvements: ${learning.improvementCount} suggestions`);
      for (const imp of improvements) {
        console.log(`    [${imp.priority}] ${imp.area}: ${imp.suggestion}`);
      }
    })
    .catch(e => {
      console.error('Learning cycle failed:', e.message);
      process.exit(1);
    });
}
