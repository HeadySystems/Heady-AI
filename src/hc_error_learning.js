// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/hc_error_learning.js                                  ║
// ║  LAYER: backend/src                                              ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HCErrorLearning — Persistent Error Tracking & Mistake Avoidance System
 *
 * Core problem this solves: AI agents repeatedly make the same mistakes because
 * there is no persistent memory of past errors and their resolutions.
 *
 * Architecture:
 *   - Persistent JSON-backed error database (survives restarts)
 *   - Error fingerprinting via trigram hashing for deduplication
 *   - Semantic search over past errors to find relevant prior mistakes
 *   - Automatic "known pitfall" injection into task context
 *   - Resolution tracking: what fixed each error, success rate of fixes
 *   - Decay scoring: recent errors weighted higher than old ones
 *
 * Integration:
 *   - Records to latent space (L1 vector store + L2 ops log)
 *   - Emits events for self-critique engine consumption
 *   - Express routes for /api/errors/* endpoints
 *   - Query interface for agents to check "have I seen this before?"
 *
 * Usage:
 *   const { errorLearning } = require('./hc_error_learning');
 *   errorLearning.recordError({ category: 'build', message: 'Module not found', context: {...} });
 *   errorLearning.recordResolution(errorId, { fix: 'Added missing import', success: true });
 *   const similar = errorLearning.findSimilar('Cannot find module xyz');
 *   const pitfalls = errorLearning.getPitfalls('build'); // Known issues for build tasks
 */

'use strict';
const logger = require('utils/logger') || console;

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// ─── Graceful dependency loading ─────────────────────────────────
let latent;

try {
  latent = require('./hc_latent_space');
} catch (e) {
  latent = { record: () => {}, search: () => ({ results: [] }) };
}

try {
  const { createLogger } = require('../packages/structured-logger');
  logger = createLogger('error-learning', 'intelligence');
} catch (e) {
  logger = {
    info: (msg, data) => logger.info(`[INFO] error-learning: ${msg}`, data || ''),
    warn: (msg, data) => logger.warn(`[WARN] error-learning: ${msg}`, data || ''),
    error: (msg, data) => logger.error(`[ERROR] error-learning: ${msg}`, data || ''),
    debug: () => {},
  };
}

// ─── Constants ───────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const VECTOR_DIMS = 128;
const ERROR_DB_PATH = path.join(__dirname, '..', 'data', 'error-learning', 'errors.json');
const RESOLUTION_DB_PATH = path.join(__dirname, '..', 'data', 'error-learning', 'resolutions.json');
const MAX_ERRORS = 500;         // Keep last 500 errors
const MAX_RESOLUTIONS = 500;    // Keep last 500 resolutions
const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Text-to-Vector (Trigram Hash) — matches hc_latent_space.js ──
function textToVector(text, dims = VECTOR_DIMS) {
  const vec = new Array(dims).fill(0);
  const normalized = String(text).toLowerCase().replace(/[^a-z0-9 ]/g, '');
  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.substring(i, i + 3);
    let hash = 0;
    for (let j = 0; j < trigram.length; j++) {
      hash = ((hash << 5) - hash) + trigram.charCodeAt(j);
      hash = hash & hash;
    }
    vec[Math.abs(hash) % dims] += 1;
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));
}

// ─── Error Fingerprinting ────────────────────────────────────────
function fingerprint(message, category) {
  const normalized = String(message).toLowerCase()
    .replace(/['"][^'"]*['"]/g, '<STR>')       // Normalize string literals
    .replace(/\b\d+\b/g, '<NUM>')              // Normalize numbers
    .replace(/\/[^\s/]+/g, '<PATH>')           // Normalize file paths
    .replace(/\s+/g, ' ')
    .trim();
  let hash = 0;
  const input = `${category}:${normalized}`;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ─── Time-based decay scoring ────────────────────────────────────
function decayScore(timestamp) {
  const age = Date.now() - new Date(timestamp).getTime();
  return Math.pow(0.5, age / DECAY_HALF_LIFE_MS);
}

// ─── Persistence ─────────────────────────────────────────────────
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* exists */  }
}

function loadJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function saveJSON(filePath, data) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ═══════════════════════════════════════════════════════════════════
// ErrorLearningEngine
// ═══════════════════════════════════════════════════════════════════

class ErrorLearningEngine extends EventEmitter {
  constructor() {
    super();
    this.errors = loadJSON(ERROR_DB_PATH, { entries: [], metadata: { created: new Date().toISOString(), version: '1.0' } });
    this.resolutions = loadJSON(RESOLUTION_DB_PATH, { entries: [], metadata: { created: new Date().toISOString(), version: '1.0' } });
    this._fingerprintIndex = new Map(); // fingerprint → error entry

    // Build fingerprint index from loaded errors
    for (const entry of this.errors.entries) {
      this._fingerprintIndex.set(entry.fingerprint, entry);
    }

    logger.info('ErrorLearningEngine initialized', {
      errorCount: this.errors.entries.length,
      resolutionCount: this.resolutions.entries.length,
    });
  }

  /**
   * Record an error occurrence.
   * If a matching fingerprint exists, increments the occurrence count.
   * @param {object} params
   * @param {string} params.category - Error category (build, deploy, config, runtime, ai, test)
   * @param {string} params.message - Error message text
   * @param {object} params.context - Structured context (file, line, stack, agent, stage)
   * @param {string} params.severity - Error severity (critical, high, medium, low)
   * @returns {object} The error record
   */
  recordError({ category, message, context = {}, severity = 'medium' }) {
    if (!category || !message) {
      throw new Error('category and message are required');
    }

    const fp = fingerprint(message, category);
    const existing = this._fingerprintIndex.get(fp);

    if (existing) {
      // Increment occurrence count
      existing.occurrences = (existing.occurrences || 1) + 1;
      existing.lastSeen = new Date().toISOString();
      existing.contexts.push({
        ...context,
        timestamp: new Date().toISOString(),
      });
      // Keep only last 10 contexts per error
      if (existing.contexts.length > 10) {
        existing.contexts = existing.contexts.slice(-10);
      }

      this._save();
      logger.warn('Recurring error recorded', {
        errorId: existing.id,
        fingerprint: fp,
        occurrences: existing.occurrences,
        category,
      });

      latent.record('error', `Recurring error (${existing.occurrences}x): ${message.substring(0, 100)}`, {
        errorId: existing.id,
        category,
        occurrences: existing.occurrences,
        severity,
      });

      this.emit('error:recurring', existing);
      return existing;
    }

    // New error
    const vector = textToVector(`${category} ${message}`);
    const entry = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      fingerprint: fp,
      category,
      message: message.substring(0, 2000),
      severity,
      vector,
      occurrences: 1,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      contexts: [{ ...context, timestamp: new Date().toISOString() }],
      resolutions: [],
      status: 'open', // open, resolved, wontfix
    };

    this.errors.entries.push(entry);
    this._fingerprintIndex.set(fp, entry);

    // Trim if over limit
    if (this.errors.entries.length > MAX_ERRORS) {
      const removed = this.errors.entries.shift();
      this._fingerprintIndex.delete(removed.fingerprint);
    }

    this._save();

    logger.info('New error recorded', {
      errorId: entry.id,
      category,
      severity,
      fingerprint: fp,
    });

    latent.record('error', `New error: ${message.substring(0, 100)}`, {
      errorId: entry.id,
      category,
      severity,
    });

    this.emit('error:new', entry);
    return entry;
  }

  /**
   * Record a resolution for an error.
   * @param {string} errorId - The error ID to resolve
   * @param {object} params
   * @param {string} params.fix - Description of what fixed the error
   * @param {boolean} params.success - Whether the fix worked
   * @param {string} params.agent - Which agent applied the fix
   * @returns {object} The resolution record
   */
  recordResolution(errorId, { fix, success = true, agent = 'unknown' }) {
    const error = this.errors.entries.find(e => e.id === errorId);
    if (!error) {
      throw new Error(`Error ${errorId} not found`);
    }

    const resolution = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      errorId,
      fix: String(fix).substring(0, 2000),
      success,
      agent,
      timestamp: new Date().toISOString(),
    };

    error.resolutions.push(resolution);
    if (success) {
      error.status = 'resolved';
    }

    this.resolutions.entries.push(resolution);
    if (this.resolutions.entries.length > MAX_RESOLUTIONS) {
      this.resolutions.entries.shift();
    }

    this._save();

    logger.info('Resolution recorded', {
      errorId,
      resolutionId: resolution.id,
      success,
      agent,
    });

    latent.record('resolution', `${success ? 'Fixed' : 'Failed fix'}: ${fix.substring(0, 100)}`, {
      errorId,
      resolutionId: resolution.id,
      success,
    });

    this.emit('resolution:recorded', resolution);
    return resolution;
  }

  /**
   * Find errors semantically similar to a query string.
   * Used by agents to check "have I seen this before?" before acting.
   * @param {string} query - Error message or description to search for
   * @param {number} topK - Number of results to return
   * @param {string} category - Optional category filter
   * @returns {Array} Matching errors with similarity scores
   */
  findSimilar(query, topK = 5, category = null) {
    const queryVec = textToVector(query);
    let candidates = this.errors.entries;

    if (category) {
      candidates = candidates.filter(e => e.category === category);
    }

    const scored = candidates.map(entry => ({
      ...entry,
      similarity: cosineSim(queryVec, entry.vector),
      relevanceScore: cosineSim(queryVec, entry.vector) * decayScore(entry.lastSeen),
    }));

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return scored.slice(0, topK).map(e => ({
      id: e.id,
      category: e.category,
      message: e.message,
      severity: e.severity,
      occurrences: e.occurrences,
      status: e.status,
      similarity: Math.round(e.similarity * 1000) / 1000,
      relevanceScore: Math.round(e.relevanceScore * 1000) / 1000,
      resolutions: e.resolutions,
      lastSeen: e.lastSeen,
    }));
  }

  /**
   * Get known pitfalls for a given task category.
   * Returns recurring, unresolved errors sorted by frequency and recency.
   * Agents should consult this before starting a task.
   * @param {string} category - Task category to check
   * @param {number} limit - Max pitfalls to return
   * @returns {Array} Known pitfalls with resolution suggestions
   */
  getPitfalls(category, limit = 10) {
    const relevant = this.errors.entries
      .filter(e => e.category === category && e.occurrences > 1)
      .sort((a, b) => {
        // Score: occurrences * decay
        const scoreA = a.occurrences * decayScore(a.lastSeen);
        const scoreB = b.occurrences * decayScore(b.lastSeen);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    return relevant.map(e => ({
      id: e.id,
      message: e.message,
      occurrences: e.occurrences,
      severity: e.severity,
      status: e.status,
      lastSeen: e.lastSeen,
      bestResolution: this._getBestResolution(e),
    }));
  }

  /**
   * Get the most successful resolution for an error.
   * @private
   */
  _getBestResolution(error) {
    const successful = error.resolutions.filter(r => r.success);
    if (successful.length === 0) return null;
    // Return the most recent successful resolution
    return successful[successful.length - 1];
  }

  /**
   * Generate a context injection string for agents.
   * Summarizes known pitfalls relevant to a task description.
   * @param {string} taskDescription - What the agent is about to do
   * @param {string} category - Task category
   * @returns {string} Context injection text (empty if no relevant pitfalls)
   */
  getContextInjection(taskDescription, category = null) {
    const similar = this.findSimilar(taskDescription, 3, category);
    const relevantPitfalls = similar.filter(s => s.similarity > 0.3 && s.occurrences > 1);

    if (relevantPitfalls.length === 0) return '';

    const lines = ['KNOWN PITFALLS (from error learning database):'];
    for (const pitfall of relevantPitfalls) {
      const fix = pitfall.resolutions.filter(r => r.success).pop();
      lines.push(`  - [${pitfall.severity.toUpperCase()}] ${pitfall.message.substring(0, 120)} (seen ${pitfall.occurrences}x)`);
      if (fix) {
        lines.push(`    Resolution: ${fix.fix.substring(0, 120)}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Get comprehensive statistics.
   */
  getStats() {
    const errors = this.errors.entries;
    const categories = {};
    let totalOccurrences = 0;
    let openCount = 0;
    let resolvedCount = 0;

    for (const e of errors) {
      categories[e.category] = (categories[e.category] || 0) + 1;
      totalOccurrences += e.occurrences;
      if (e.status === 'open') openCount++;
      if (e.status === 'resolved') resolvedCount++;
    }

    const resolutions = this.resolutions.entries;
    const successfulResolutions = resolutions.filter(r => r.success).length;

    return {
      totalUniqueErrors: errors.length,
      totalOccurrences,
      openErrors: openCount,
      resolvedErrors: resolvedCount,
      categories,
      totalResolutions: resolutions.length,
      successfulResolutions,
      resolutionSuccessRate: resolutions.length > 0
        ? Math.round((successfulResolutions / resolutions.length) * 100)
        : 0,
      topRecurring: errors
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 5)
        .map(e => ({ id: e.id, message: e.message.substring(0, 80), occurrences: e.occurrences, category: e.category })),
    };
  }

  /**
   * Persist to disk.
   * @private
   */
  _save() {
    try {
      saveJSON(ERROR_DB_PATH, this.errors);
      saveJSON(RESOLUTION_DB_PATH, this.resolutions);
    } catch (e) {
      logger.error('Failed to save error learning database', { error: e.message });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════════════

const errorLearning = new ErrorLearningEngine();

// ═══════════════════════════════════════════════════════════════════
// Express Routes
// ═══════════════════════════════════════════════════════════════════

function registerErrorLearningRoutes(app) {
  // Stats
  app.get('/api/errors/stats', (_req, res) => {
    res.json({ ok: true, ...errorLearning.getStats(), ts: new Date().toISOString() });
  });

  // Record error
  app.post('/api/errors/record', (req, res) => {
    try {
      const { category, message, context, severity } = req.body;
      if (!category || !message) {
        return res.status(400).json({ error: 'category and message required' });
      }
      const entry = errorLearning.recordError({ category, message, context, severity });
      res.json({ ok: true, error: entry });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Record resolution
  app.post('/api/errors/resolve', (req, res) => {
    try {
      const { errorId, fix, success, agent } = req.body;
      if (!errorId || !fix) {
        return res.status(400).json({ error: 'errorId and fix required' });
      }
      const resolution = errorLearning.recordResolution(errorId, { fix, success, agent });
      res.json({ ok: true, resolution });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Search similar errors
  app.post('/api/errors/search', (req, res) => {
    try {
      const { query, topK, category } = req.body;
      if (!query) {
        return res.status(400).json({ error: 'query required' });
      }
      const results = errorLearning.findSimilar(query, topK || 5, category);
      res.json({ ok: true, results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get pitfalls for a category
  app.get('/api/errors/pitfalls/:category', (req, res) => {
    try {
      const pitfalls = errorLearning.getPitfalls(req.params.category);
      res.json({ ok: true, category: req.params.category, pitfalls });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get context injection for a task
  app.post('/api/errors/context', (req, res) => {
    try {
      const { taskDescription, category } = req.body;
      if (!taskDescription) {
        return res.status(400).json({ error: 'taskDescription required' });
      }
      const injection = errorLearning.getContextInjection(taskDescription, category);
      res.json({ ok: true, contextInjection: injection, hasRelevantPitfalls: injection.length > 0 });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List all errors (paginated)
  app.get('/api/errors/list', (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      const offset = parseInt(req.query.offset, 10) || 0;
      const category = req.query.category || null;

      let entries = errorLearning.errors.entries;
      if (category) {
        entries = entries.filter(e => e.category === category);
      }

      const total = entries.length;
      const page = entries.slice(offset, offset + limit).map(e => ({
        id: e.id,
        category: e.category,
        message: e.message.substring(0, 200),
        severity: e.severity,
        occurrences: e.occurrences,
        status: e.status,
        firstSeen: e.firstSeen,
        lastSeen: e.lastSeen,
        resolutionCount: e.resolutions.length,
      }));

      res.json({ ok: true, errors: page, total, limit, offset });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  ErrorLearningEngine,
  errorLearning,
  registerErrorLearningRoutes,
};
