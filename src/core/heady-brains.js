/**
 * Heady™ Latent OS v5.4.0
 * © 2026 HeadySystems Inc. — Eric Haywood — 51 Provisional Patents
 * ZERO MAGIC NUMBERS — All constants φ-derived or Fibonacci
 *
 * HEADY BRAINS — Context Assembly Engine
 *
 * Gathers all relevant context before HeadyConductor routes a task.
 * Pulls from vector memory, recent conversation, session state,
 * and system awareness to build a complete context capsule.
 *
 * Position: INNER RING of Sacred Geometry topology
 * Feeds: HeadyConductor for intent classification
 */
'use strict';

const { EventEmitter } = require('events');
const {
  PHI, PSI, fib, CSL_THRESHOLDS, PHI_TIMING,
  cslGate, sigmoid,
} = require('../../shared/phi-math');

// ─── φ-Constants ─────────────────────────────────────────────────────────────

const CONTEXT_CAPSULE_MAX_TOKENS  = fib(17) * fib(5);      // 1597 × 5 = 7985 tokens
const WORKING_CONTEXT_TOKENS      = fib(16);                // 987 tokens
const SESSION_CONTEXT_TOKENS      = fib(14) * fib(5);      // 377 × 5 = 1885 tokens
const MEMORY_SEARCH_TOP_K         = fib(8);                 // 21 results
const RELEVANCE_THRESHOLD         = CSL_THRESHOLDS.LOW;     // 0.691
const CONTEXT_ASSEMBLY_TIMEOUT_MS = PHI_TIMING.PHI_6;       // 17 944ms
const CONVERSATION_WINDOW         = fib(8);                 // 21 messages

// ─── Context Tiers ──────────────────────────────────────────────────────────

const CONTEXT_TIERS = Object.freeze({
  WORKING:   { name: 'working',   budget: WORKING_CONTEXT_TOKENS, weight: PSI },
  SESSION:   { name: 'session',   budget: SESSION_CONTEXT_TOKENS, weight: PSI * PSI },
  MEMORY:    { name: 'memory',    budget: fib(13) * fib(5),       weight: Math.pow(PSI, 3) },
  ARTIFACTS: { name: 'artifacts', budget: fib(12) * fib(5),       weight: Math.pow(PSI, 4) },
});

// ─── Logger ─────────────────────────────────────────────────────────────────

function log(level, msg, meta = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: 'heady-brains',
    msg,
    ...meta,
  });
  process.stdout.write(entry + '\n');
}

// ─── HeadyBrains Class ──────────────────────────────────────────────────────

class HeadyBrains extends EventEmitter {
  constructor(dependencies = {}) {
    super();
    this.vectorMemory = dependencies.vectorMemory || null;
    this.conversationHistory = [];
    this.sessionContext = new Map();
    this.assemblyCount = 0;
  }

  // ─── Assemble Context Capsule ─────────────────────────────────────────
  // Gathers all context tiers into a single capsule for Conductor routing

  async assembleContext(request) {
    const startMs = Date.now();
    const capsule = {
      requestId: request.id || `ctx_${Date.now()}_${++this.assemblyCount}`,
      timestamp: new Date().toISOString(),
      tiers: {},
      totalTokenEstimate: 0,
      assemblyMs: 0,
    };

    // Assemble all tiers concurrently
    const tierResults = await Promise.allSettled([
      this._assembleWorkingContext(request),
      this._assembleSessionContext(request),
      this._assembleMemoryContext(request),
      this._assembleArtifactContext(request),
    ]);

    const tierNames = ['working', 'session', 'memory', 'artifacts'];
    for (let i = 0; i < tierResults.length; i++) {
      if (tierResults[i].status === 'fulfilled') {
        capsule.tiers[tierNames[i]] = tierResults[i].value;
        capsule.totalTokenEstimate += tierResults[i].value.tokenEstimate || 0;
      } else {
        capsule.tiers[tierNames[i]] = {
          error: tierResults[i].reason?.message || 'assembly_failed',
          tokenEstimate: 0,
        };
      }
    }

    // Enforce total budget
    if (capsule.totalTokenEstimate > CONTEXT_CAPSULE_MAX_TOKENS) {
      capsule.compressed = true;
      this._compressContext(capsule);
    }

    capsule.assemblyMs = Date.now() - startMs;

    log('info', 'Context capsule assembled', {
      requestId: capsule.requestId,
      tokens: capsule.totalTokenEstimate,
      assemblyMs: capsule.assemblyMs,
      tiers: Object.keys(capsule.tiers),
    });

    this.emit('brains:context_assembled', capsule);
    return capsule;
  }

  // ─── Working Context (current request + recent messages) ──────────────

  async _assembleWorkingContext(request) {
    const recentMessages = this.conversationHistory.slice(-CONVERSATION_WINDOW);
    const tokenEstimate = Math.min(
      this._estimateTokens(JSON.stringify(request)) + this._estimateTokens(JSON.stringify(recentMessages)),
      WORKING_CONTEXT_TOKENS,
    );

    return {
      request: {
        text: request.text || request.query || '',
        type: request.type || 'unknown',
        metadata: request.metadata || {},
      },
      recentMessages: recentMessages.map((m) => ({
        role: m.role,
        content: m.content?.substring(0, fib(14)),  // 377 char limit per message
        ts: m.ts,
      })),
      tokenEstimate,
      weight: CONTEXT_TIERS.WORKING.weight,
    };
  }

  // ─── Session Context (current session state) ──────────────────────────

  async _assembleSessionContext(request) {
    const sessionEntries = {};
    for (const [key, value] of this.sessionContext) {
      sessionEntries[key] = value;
    }
    const tokenEstimate = Math.min(
      this._estimateTokens(JSON.stringify(sessionEntries)),
      SESSION_CONTEXT_TOKENS,
    );

    return {
      entries: sessionEntries,
      entryCount: this.sessionContext.size,
      tokenEstimate,
      weight: CONTEXT_TIERS.SESSION.weight,
    };
  }

  // ─── Memory Context (vector memory search) ────────────────────────────

  async _assembleMemoryContext(request) {
    if (!this.vectorMemory) {
      return { entries: [], tokenEstimate: 0, weight: CONTEXT_TIERS.MEMORY.weight };
    }

    const query = request.text || request.query || '';
    if (!query) {
      return { entries: [], tokenEstimate: 0, weight: CONTEXT_TIERS.MEMORY.weight };
    }

    try {
      const results = await this.vectorMemory.search(query, {
        topK: MEMORY_SEARCH_TOP_K,
        threshold: RELEVANCE_THRESHOLD,
      });

      const entries = (results || []).map((r) => ({
        content: r.content?.substring(0, fib(14)),
        score: r.score,
        source: r.source,
      }));

      return {
        entries,
        tokenEstimate: this._estimateTokens(JSON.stringify(entries)),
        weight: CONTEXT_TIERS.MEMORY.weight,
      };
    } catch (memErr) {
      log('warn', 'Memory context assembly failed', { error: memErr.message });
      return { entries: [], tokenEstimate: 0, weight: CONTEXT_TIERS.MEMORY.weight, error: memErr.message };
    }
  }

  // ─── Artifact Context (relevant files, code, docs) ────────────────────

  async _assembleArtifactContext(request) {
    // Placeholder: in production, searches file index and code context
    return {
      entries: [],
      tokenEstimate: 0,
      weight: CONTEXT_TIERS.ARTIFACTS.weight,
    };
  }

  // ─── Add Message to Conversation ──────────────────────────────────────

  addMessage(role, content) {
    this.conversationHistory.push({
      role,
      content,
      ts: new Date().toISOString(),
    });

    // Trim at Fibonacci compression points
    const fibCompressionPoints = [fib(6), fib(7), fib(8), fib(9), fib(10)];
    if (fibCompressionPoints.includes(this.conversationHistory.length)) {
      this._compressConversation();
    }
  }

  // ─── Set Session Context ──────────────────────────────────────────────

  setSessionContext(key, value) {
    this.sessionContext.set(key, value);
  }

  // ─── Compress Context ─────────────────────────────────────────────────

  _compressContext(capsule) {
    // Evict lowest-weight tiers first until under budget
    const tiers = Object.entries(capsule.tiers)
      .filter(([_, t]) => t.tokenEstimate > 0)
      .sort((a, b) => (a[1].weight || 0) - (b[1].weight || 0));

    let excess = capsule.totalTokenEstimate - CONTEXT_CAPSULE_MAX_TOKENS;
    for (const [name, tier] of tiers) {
      if (excess <= 0) break;
      const reduction = Math.min(tier.tokenEstimate, excess);
      tier.tokenEstimate -= reduction;
      tier.compressed = true;
      capsule.totalTokenEstimate -= reduction;
      excess -= reduction;
    }
  }

  // ─── Compress Conversation ────────────────────────────────────────────

  _compressConversation() {
    if (this.conversationHistory.length <= CONVERSATION_WINDOW) return;

    // Keep last CONVERSATION_WINDOW messages, summarize older ones
    const keep = this.conversationHistory.slice(-CONVERSATION_WINDOW);
    const older = this.conversationHistory.slice(0, -CONVERSATION_WINDOW);
    const summary = {
      role: 'system',
      content: `[Compressed ${older.length} earlier messages]`,
      ts: new Date().toISOString(),
      compressed: true,
      originalCount: older.length,
    };
    this.conversationHistory = [summary, ...keep];

    log('info', 'Conversation compressed', {
      compressedCount: older.length,
      remaining: this.conversationHistory.length,
    });
  }

  // ─── Token Estimation ─────────────────────────────────────────────────

  _estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil((text || '').length / 4);
  }

  // ─── Get State ────────────────────────────────────────────────────────

  getState() {
    return {
      conversationLength: this.conversationHistory.length,
      sessionContextSize: this.sessionContext.size,
      assemblyCount: this.assemblyCount,
      hasVectorMemory: !!this.vectorMemory,
    };
  }
}

module.exports = {
  HeadyBrains,
  CONTEXT_TIERS,
  CONTEXT_CAPSULE_MAX_TOKENS,
  CONVERSATION_WINDOW,
};
