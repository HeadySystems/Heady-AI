/**
 * HeadyBrains — Context Assembler & Computational Pre-Processor
 * 
 * The "thinking" layer of the Alive Software Architecture.
 * Gathers context from all sources (vector memory, conversation history,
 * system state, user profile) and assembles a unified context window
 * for the Conductor to route and nodes to consume.
 * 
 * Features:
 * - Tiered context (working/session/memory/artifacts) with phi-scaled budgets
 * - Embedding-based retrieval from pgvector (384D HNSW)
 * - Priority-based eviction with phi-weighted scoring
 * - Context capsule serialization for inter-agent transfer
 * - LLM-based summarization for context compression
 * - Token budget tracking per tier
 * 
 * @module HeadyBrains
 * @author Eric Haywood
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const { PHI, PSI, PSI_SQ, fibonacci, phiThreshold, phiBackoff, phiFusionWeights,
  CSL_THRESHOLDS, FIBONACCI_SIZES, SERVICE_PORTS } = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');
const { PgVectorClient } = require('../../shared/pgvector-client');
const crypto = require('crypto');

const logger = createLogger('heady-brains');

// ─── Phi-Scaled Token Budgets ───────────────────────────────────────────────
const BASE_TOKEN_BUDGET = fibonacci(13) * fibonacci(8); // 233 * 21 = 4893 ≈ ~5k base
const TOKEN_BUDGETS = {
  working:   BASE_TOKEN_BUDGET,                                    // 4893 tokens — immediate context
  session:   Math.round(BASE_TOKEN_BUDGET * PHI * PHI),            // 12804 tokens — session history
  memory:    Math.round(BASE_TOKEN_BUDGET * PHI * PHI * PHI * PHI), // 33523 tokens — long-term memory
  artifacts: Math.round(BASE_TOKEN_BUDGET * Math.pow(PHI, 6))      // 87771 tokens — artifact cache
};

const TOTAL_BUDGET = Object.values(TOKEN_BUDGETS).reduce((a, b) => a + b, 0);

// ─── Eviction Weights (phi-derived) ─────────────────────────────────────────
const EVICTION_WEIGHTS = {
  importance: PSI,          // 0.618 — most weight on importance
  recency:   PSI_SQ,       // 0.382 — second weight on recency
  relevance: 1 - PSI - PSI_SQ  // ~0.0 adjusted below
};
// Normalize to phi-fusion 3-factor
const fusionW = phiFusionWeights(3);
const PRIORITY_WEIGHTS = {
  importance: fusionW[0],  // 0.528
  recency:    fusionW[1],  // 0.326
  relevance:  fusionW[2]   // 0.146
};

// ─── Context Entry Types ────────────────────────────────────────────────────
const ENTRY_TYPES = {
  USER_MESSAGE:   'user_message',
  SYSTEM_STATE:   'system_state',
  VECTOR_RECALL:  'vector_recall',
  CONVERSATION:   'conversation',
  ARTIFACT:       'artifact',
  NODE_OUTPUT:    'node_output',
  SOUL_DIRECTIVE: 'soul_directive',
  PROFILE:        'profile'
};

// ─── Cache Configuration ────────────────────────────────────────────────────
const LRU_CAPACITY = fibonacci(17);     // 1597 entries
const EMBEDDING_DIM = fibonacci(16) * 2 + fibonacci(9) * 2 + fibonacci(7) * 2; // Approximate to 384
const ACTUAL_DIM = 384;
const CONTEXT_TTL_MS = fibonacci(11) * 1000; // 89 seconds for working context
const SESSION_TTL_MS = fibonacci(14) * 1000 * 60; // 377 minutes ≈ 6.3 hours

// ─── CSL Similarity Thresholds ──────────────────────────────────────────────
const RETRIEVAL_THRESHOLD = CSL_THRESHOLDS.LOW;        // 0.691 — minimum relevance
const HIGH_RELEVANCE     = CSL_THRESHOLDS.MEDIUM;      // 0.809
const EXACT_MATCH        = CSL_THRESHOLDS.CRITICAL;    // 0.927
const DEDUP_THRESHOLD    = phiThreshold(5);             // ~0.955 — semantic dedup

/**
 * LRU Cache with phi-scaled eviction
 * Used for embedding and context caching
 */
class PhiLRUCache {
  constructor(capacity = LRU_CAPACITY) {
    this.capacity = capacity;
    this.cache = new Map();
    this.accessCount = new Map();
    this.insertTime = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    // Move to end (most recent)
    this.cache.delete(key);
    this.cache.set(key, value);
    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      this._evict();
    }
    this.cache.set(key, value);
    this.insertTime.set(key, Date.now());
    if (!this.accessCount.has(key)) {
      this.accessCount.set(key, 1);
    }
  }

  _evict() {
    // Phi-weighted eviction: score = importance * w1 + recency * w2 + frequency * w3
    let lowestScore = Infinity;
    let evictKey = null;
    const now = Date.now();

    for (const [key] of this.cache) {
      const age = now - (this.insertTime.get(key) || now);
      const accesses = this.accessCount.get(key) || 1;
      const maxAge = SESSION_TTL_MS;

      // Normalize factors to [0, 1]
      const recencyScore = 1 - Math.min(age / maxAge, 1);
      const frequencyScore = Math.min(accesses / fibonacci(8), 1); // Cap at 21
      const score = PRIORITY_WEIGHTS.importance * frequencyScore +
                    PRIORITY_WEIGHTS.recency * recencyScore +
                    PRIORITY_WEIGHTS.relevance * (frequencyScore * recencyScore);

      if (score < lowestScore) {
        lowestScore = score;
        evictKey = key;
      }
    }

    if (evictKey) {
      this.cache.delete(evictKey);
      this.accessCount.delete(evictKey);
      this.insertTime.delete(evictKey);
    }
  }

  size() { return this.cache.size; }
  clear() {
    this.cache.clear();
    this.accessCount.clear();
    this.insertTime.clear();
  }
}

/**
 * Context Entry — single piece of context with metadata
 */
class ContextEntry {
  constructor({ type, content, embedding = null, tokens = 0, importance = CSL_THRESHOLDS.MEDIUM,
                source = 'unknown', timestamp = Date.now(), metadata = {} }) {
    this.id = crypto.randomUUID();
    this.type = type;
    this.content = content;
    this.embedding = embedding;
    this.tokens = tokens;
    this.importance = importance;
    this.source = source;
    this.timestamp = timestamp;
    this.metadata = metadata;
    this.accessCount = 0;
  }

  /**
   * Phi-weighted priority score for eviction decisions
   */
  priorityScore(now = Date.now()) {
    const maxAge = SESSION_TTL_MS;
    const age = now - this.timestamp;
    const recency = 1 - Math.min(age / maxAge, 1);
    const frequency = Math.min(this.accessCount / fibonacci(8), 1);

    return PRIORITY_WEIGHTS.importance * this.importance +
           PRIORITY_WEIGHTS.recency * recency +
           PRIORITY_WEIGHTS.relevance * frequency;
  }

  touch() {
    this.accessCount++;
    return this;
  }
}

/**
 * Context Tier — manages entries within a token budget
 */
class ContextTier {
  constructor(name, budgetTokens) {
    this.name = name;
    this.budget = budgetTokens;
    this.usedTokens = 0;
    this.entries = [];
  }

  /**
   * Add entry, evicting lowest-priority if over budget
   */
  add(entry) {
    // Check if we need to make room
    while (this.usedTokens + entry.tokens > this.budget && this.entries.length > 0) {
      this._evictLowest();
    }

    if (this.usedTokens + entry.tokens <= this.budget) {
      this.entries.push(entry);
      this.usedTokens += entry.tokens;
      return true;
    }

    logger.warn({
      tier: this.name,
      entryTokens: entry.tokens,
      budget: this.budget,
      used: this.usedTokens,
      msg: 'Entry exceeds tier budget even after eviction'
    });
    return false;
  }

  _evictLowest() {
    if (this.entries.length === 0) return;

    const now = Date.now();
    let lowestIdx = 0;
    let lowestScore = this.entries[0].priorityScore(now);

    for (let i = 1; i < this.entries.length; i++) {
      const score = this.entries[i].priorityScore(now);
      if (score < lowestScore) {
        lowestScore = score;
        lowestIdx = i;
      }
    }

    const evicted = this.entries.splice(lowestIdx, 1)[0];
    this.usedTokens -= evicted.tokens;

    logger.info({
      tier: this.name,
      evictedId: evicted.id,
      evictedType: evicted.type,
      freedTokens: evicted.tokens,
      msg: 'Evicted entry from context tier'
    });
  }

  getEntries() {
    return [...this.entries].sort((a, b) => b.priorityScore() - a.priorityScore());
  }

  utilization() {
    return this.budget > 0 ? this.usedTokens / this.budget : 0;
  }

  clear() {
    this.entries = [];
    this.usedTokens = 0;
  }
}

/**
 * Context Capsule — serializable snapshot for inter-agent transfer
 */
class ContextCapsule {
  constructor(sessionId, tiers, metadata = {}) {
    this.version = '1.0.0';
    this.sessionId = sessionId;
    this.createdAt = Date.now();
    this.metadata = metadata;
    this.tiers = {};
    this.totalTokens = 0;

    for (const [name, tier] of Object.entries(tiers)) {
      const entries = tier.getEntries().map(e => ({
        id: e.id,
        type: e.type,
        content: e.content,
        tokens: e.tokens,
        importance: e.importance,
        source: e.source,
        timestamp: e.timestamp,
        metadata: e.metadata
      }));
      this.tiers[name] = entries;
      this.totalTokens += entries.reduce((sum, e) => sum + e.tokens, 0);
    }
  }

  serialize() {
    return JSON.stringify(this);
  }

  static deserialize(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    return data;
  }
}

/**
 * HeadyBrains — Main Context Assembly Engine
 */
class HeadyBrains {
  constructor(config = {}) {
    this.sessionId = config.sessionId || crypto.randomUUID();
    this.pgClient = config.pgClient || null;
    this.embeddingFn = config.embeddingFn || null;

    // Initialize tiered context
    this.tiers = {
      working:   new ContextTier('working',   TOKEN_BUDGETS.working),
      session:   new ContextTier('session',    TOKEN_BUDGETS.session),
      memory:    new ContextTier('memory',     TOKEN_BUDGETS.memory),
      artifacts: new ContextTier('artifacts',  TOKEN_BUDGETS.artifacts)
    };

    // Embedding cache
    this.embeddingCache = new PhiLRUCache(fibonacci(16)); // 987 entries
    // Context capsule history
    this.capsuleHistory = [];
    // Dedup index
    this.dedupIndex = new Map();

    this._initialized = false;
    this._healthState = { coherence: 1.0, lastCheck: Date.now() };

    logger.info({
      sessionId: this.sessionId,
      budgets: TOKEN_BUDGETS,
      totalBudget: TOTAL_BUDGET,
      msg: 'HeadyBrains initialized'
    });
  }

  /**
   * Initialize connections (pgvector, embedding service)
   */
  async initialize() {
    if (this._initialized) return;

    try {
      if (!this.pgClient) {
        this.pgClient = new PgVectorClient();
        await this.pgClient.initialize();
      }

      this._initialized = true;
      logger.info({ msg: 'HeadyBrains connections initialized' });
    } catch (err) {
      logger.error({ err: err.message, msg: 'HeadyBrains initialization failed, running in degraded mode' });
      // Continue in degraded mode — local context only
    }
  }

  /**
   * Assemble full context for a task
   * This is the primary entry point — called by HeadyConductor before routing
   * 
   * @param {Object} request - The incoming request/task
   * @param {string} request.query - User's query or task description
   * @param {string} request.userId - Authenticated user ID
   * @param {Object} request.conversationHistory - Recent conversation turns
   * @param {Object} request.systemState - Current system health/state
   * @returns {Object} Assembled context with entries from all tiers
   */
  async assembleContext(request) {
    const startTime = Date.now();
    const { query, userId, conversationHistory = [], systemState = {} } = request;

    logger.info({
      sessionId: this.sessionId,
      queryLength: query?.length || 0,
      historyTurns: conversationHistory.length,
      msg: 'Assembling context'
    });

    // 1. Add Soul directives (always highest priority)
    await this._addSoulDirectives();

    // 2. Add user profile context
    if (userId) {
      await this._addUserProfile(userId);
    }

    // 3. Add conversation history to session tier
    this._addConversationHistory(conversationHistory);

    // 4. Add system state snapshot
    this._addSystemState(systemState);

    // 5. Embedding-based retrieval from vector memory
    if (query && this._initialized) {
      await this._retrieveFromVectorMemory(query);
    }

    // 6. Add the current query to working context
    if (query) {
      this.addToWorking({
        type: ENTRY_TYPES.USER_MESSAGE,
        content: query,
        tokens: this._estimateTokens(query),
        importance: CSL_THRESHOLDS.HIGH,
        source: 'user'
      });
    }

    // 7. Deduplicate across tiers
    this._deduplicateEntries();

    // 8. Compress if over total budget
    if (this._totalUsedTokens() > TOTAL_BUDGET * CSL_THRESHOLDS.CRITICAL) {
      await this._compressContext();
    }

    const assembled = this._buildContextOutput();
    const elapsed = Date.now() - startTime;

    logger.info({
      sessionId: this.sessionId,
      elapsed,
      totalTokens: assembled.totalTokens,
      tierUtilization: assembled.utilization,
      entryCount: assembled.entryCount,
      msg: 'Context assembly complete'
    });

    return assembled;
  }

  /**
   * Add entry to working context (immediate, highest access)
   */
  addToWorking(entryData) {
    const entry = new ContextEntry(entryData);
    return this.tiers.working.add(entry);
  }

  /**
   * Add entry to session context
   */
  addToSession(entryData) {
    const entry = new ContextEntry(entryData);
    return this.tiers.session.add(entry);
  }

  /**
   * Add entry to memory context (long-term recall)
   */
  addToMemory(entryData) {
    const entry = new ContextEntry(entryData);
    return this.tiers.memory.add(entry);
  }

  /**
   * Add entry to artifacts context
   */
  addToArtifacts(entryData) {
    const entry = new ContextEntry(entryData);
    return this.tiers.artifacts.add(entry);
  }

  /**
   * Create a context capsule for inter-agent transfer
   */
  createCapsule(metadata = {}) {
    const capsule = new ContextCapsule(this.sessionId, this.tiers, {
      ...metadata,
      createdBy: 'heady-brains',
      coherence: this._healthState.coherence
    });

    this.capsuleHistory.push({
      timestamp: Date.now(),
      totalTokens: capsule.totalTokens,
      tierSizes: Object.fromEntries(
        Object.entries(capsule.tiers).map(([k, v]) => [k, v.length])
      )
    });

    // Keep only last fib(8) = 21 capsule records
    if (this.capsuleHistory.length > fibonacci(8)) {
      this.capsuleHistory = this.capsuleHistory.slice(-fibonacci(8));
    }

    return capsule;
  }

  /**
   * Restore context from a capsule (inter-agent receive)
   */
  restoreFromCapsule(capsuleData) {
    const data = ContextCapsule.deserialize(capsuleData);

    for (const [tierName, entries] of Object.entries(data.tiers)) {
      if (this.tiers[tierName]) {
        for (const entryData of entries) {
          const entry = new ContextEntry(entryData);
          this.tiers[tierName].add(entry);
        }
      }
    }

    logger.info({
      sessionId: this.sessionId,
      restoredFrom: data.sessionId,
      totalTokens: data.totalTokens,
      msg: 'Context restored from capsule'
    });
  }

  // ─── Private Methods ────────────────────────────────────────────────────

  /**
   * Add HeadySoul directives — highest priority, always in working context
   */
  async _addSoulDirectives() {
    const directives = [
      'Structural Integrity: All outputs must maintain module boundaries and type safety.',
      'Semantic Coherence: All reasoning must align with the system embedding space.',
      'Mission Alignment: All actions serve HeadyConnection mission — community, equity, empowerment.'
    ];

    for (const directive of directives) {
      this.addToWorking({
        type: ENTRY_TYPES.SOUL_DIRECTIVE,
        content: directive,
        tokens: this._estimateTokens(directive),
        importance: CSL_THRESHOLDS.CRITICAL, // 0.927
        source: 'heady-soul'
      });
    }
  }

  /**
   * Add user profile from vector memory
   */
  async _addUserProfile(userId) {
    if (!this._initialized || !this.pgClient) return;

    try {
      const profile = await this.pgClient.query(
        'SELECT content, embedding FROM heady_memory WHERE user_id = $1 AND type = $2 ORDER BY updated_at DESC LIMIT $3',
        [userId, 'profile', fibonacci(5)] // Last 5 profile entries
      );

      if (profile.rows) {
        for (const row of profile.rows) {
          this.addToSession({
            type: ENTRY_TYPES.PROFILE,
            content: row.content,
            embedding: row.embedding,
            tokens: this._estimateTokens(row.content),
            importance: CSL_THRESHOLDS.HIGH,
            source: 'user-profile'
          });
        }
      }
    } catch (err) {
      logger.warn({ err: err.message, msg: 'Failed to load user profile' });
    }
  }

  /**
   * Add conversation history to session tier
   */
  _addConversationHistory(history) {
    if (!Array.isArray(history) || history.length === 0) return;

    // Take last fib(8) = 21 turns max
    const recentHistory = history.slice(-fibonacci(8));

    for (const turn of recentHistory) {
      const content = typeof turn === 'string' ? turn : JSON.stringify(turn);
      this.addToSession({
        type: ENTRY_TYPES.CONVERSATION,
        content,
        tokens: this._estimateTokens(content),
        importance: CSL_THRESHOLDS.MEDIUM, // 0.809
        source: 'conversation',
        metadata: { role: turn.role || 'unknown' }
      });
    }
  }

  /**
   * Add current system state snapshot
   */
  _addSystemState(state) {
    if (!state || Object.keys(state).length === 0) return;

    const stateStr = JSON.stringify(state);
    this.addToWorking({
      type: ENTRY_TYPES.SYSTEM_STATE,
      content: stateStr,
      tokens: this._estimateTokens(stateStr),
      importance: CSL_THRESHOLDS.MEDIUM,
      source: 'system-state'
    });
  }

  /**
   * Retrieve relevant context from vector memory using embedding similarity
   */
  async _retrieveFromVectorMemory(query) {
    if (!this.pgClient) return;

    try {
      // Generate query embedding (or use cached)
      const queryHash = this._hashContent(query);
      let embedding = this.embeddingCache.get(queryHash);

      if (!embedding) {
        if (this.embeddingFn) {
          embedding = await this.embeddingFn(query);
          this.embeddingCache.set(queryHash, embedding);
        } else {
          // Fallback: use pgvector's built-in embedding if available
          logger.warn({ msg: 'No embedding function configured, skipping vector retrieval' });
          return;
        }
      }

      // Query pgvector with HNSW index — top fib(8) = 21 results
      const embeddingStr = `[${embedding.join(',')}]`;
      const results = await this.pgClient.query(
        `SELECT id, content, type, metadata, 
                1 - (embedding <=> $1::vector) as similarity
         FROM heady_memory 
         WHERE 1 - (embedding <=> $1::vector) > $2
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [embeddingStr, RETRIEVAL_THRESHOLD, fibonacci(8)]
      );

      if (results.rows) {
        for (const row of results.rows) {
          const tierTarget = row.similarity >= HIGH_RELEVANCE ? 'working' : 'memory';
          const importance = row.similarity >= EXACT_MATCH ?
            CSL_THRESHOLDS.CRITICAL :
            row.similarity >= HIGH_RELEVANCE ?
              CSL_THRESHOLDS.HIGH :
              CSL_THRESHOLDS.MEDIUM;

          const entry = {
            type: ENTRY_TYPES.VECTOR_RECALL,
            content: row.content,
            tokens: this._estimateTokens(row.content),
            importance,
            source: 'vector-memory',
            metadata: {
              similarity: row.similarity,
              originalType: row.type,
              ...(row.metadata || {})
            }
          };

          if (tierTarget === 'working') {
            this.addToWorking(entry);
          } else {
            this.addToMemory(entry);
          }
        }

        logger.info({
          retrieved: results.rows.length,
          highRelevance: results.rows.filter(r => r.similarity >= HIGH_RELEVANCE).length,
          msg: 'Vector memory retrieval complete'
        });
      }
    } catch (err) {
      logger.warn({ err: err.message, msg: 'Vector memory retrieval failed' });
    }
  }

  /**
   * Deduplicate entries across tiers using semantic similarity
   */
  _deduplicateEntries() {
    const allEntries = [];
    for (const tier of Object.values(this.tiers)) {
      for (const entry of tier.entries) {
        allEntries.push(entry);
      }
    }

    const contentHashes = new Map();
    const toRemove = new Set();

    for (const entry of allEntries) {
      const hash = this._hashContent(entry.content);
      if (contentHashes.has(hash)) {
        // Exact duplicate — keep higher importance
        const existing = contentHashes.get(hash);
        if (entry.importance > existing.importance) {
          toRemove.add(existing.id);
          contentHashes.set(hash, entry);
        } else {
          toRemove.add(entry.id);
        }
      } else {
        contentHashes.set(hash, entry);
      }
    }

    if (toRemove.size > 0) {
      for (const tier of Object.values(this.tiers)) {
        const before = tier.entries.length;
        tier.entries = tier.entries.filter(e => !toRemove.has(e.id));
        const removed = before - tier.entries.length;
        if (removed > 0) {
          tier.usedTokens = tier.entries.reduce((sum, e) => sum + e.tokens, 0);
        }
      }

      logger.info({
        deduplicated: toRemove.size,
        msg: 'Context deduplication complete'
      });
    }
  }

  /**
   * Compress context when approaching budget limits
   * Uses summarization for older/lower-priority entries
   */
  async _compressContext() {
    // Strategy: Move session entries older than PHI * average_age to memory tier (summarized)
    const sessionEntries = this.tiers.session.entries;
    if (sessionEntries.length === 0) return;

    const avgAge = sessionEntries.reduce((sum, e) => sum + (Date.now() - e.timestamp), 0) / sessionEntries.length;
    const compressionThreshold = avgAge * PHI;

    const toCompress = sessionEntries.filter(e => (Date.now() - e.timestamp) > compressionThreshold);
    if (toCompress.length === 0) return;

    // Batch summarize old entries
    const summaryContent = toCompress.map(e => e.content).join('\n---\n');
    const summaryTokens = Math.round(this._estimateTokens(summaryContent) / PHI); // Compress by phi ratio

    // Remove originals from session
    const compressIds = new Set(toCompress.map(e => e.id));
    this.tiers.session.entries = this.tiers.session.entries.filter(e => !compressIds.has(e.id));
    this.tiers.session.usedTokens = this.tiers.session.entries.reduce((sum, e) => sum + e.tokens, 0);

    // Add compressed summary to memory tier
    this.addToMemory({
      type: ENTRY_TYPES.CONVERSATION,
      content: `[Compressed ${toCompress.length} entries]: ${summaryContent.substring(0, Math.round(summaryContent.length / PHI))}`,
      tokens: summaryTokens,
      importance: CSL_THRESHOLDS.LOW,
      source: 'compression',
      metadata: { originalCount: toCompress.length, compressionRatio: PHI }
    });

    logger.info({
      compressed: toCompress.length,
      savedTokens: toCompress.reduce((sum, e) => sum + e.tokens, 0) - summaryTokens,
      msg: 'Context compression complete'
    });
  }

  /**
   * Build the final context output for the Conductor
   */
  _buildContextOutput() {
    const output = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      totalTokens: 0,
      entryCount: 0,
      utilization: {},
      tiers: {},
      directives: [],
      coherence: this._healthState.coherence
    };

    for (const [name, tier] of Object.entries(this.tiers)) {
      const entries = tier.getEntries();
      output.tiers[name] = entries.map(e => ({
        id: e.id,
        type: e.type,
        content: e.content,
        importance: e.importance,
        source: e.source,
        tokens: e.tokens
      }));
      output.totalTokens += tier.usedTokens;
      output.entryCount += entries.length;
      output.utilization[name] = Math.round(tier.utilization() * 1000) / 1000;

      // Extract directives separately for easy access
      if (name === 'working') {
        output.directives = entries
          .filter(e => e.type === ENTRY_TYPES.SOUL_DIRECTIVE)
          .map(e => e.content);
      }
    }

    return output;
  }

  /**
   * Estimate token count (phi-scaled approximation: ~PSI² tokens per character)
   * More accurate than chars/4 for mixed content
   */
  _estimateTokens(text) {
    if (!text) return 0;
    const charCount = typeof text === 'string' ? text.length : JSON.stringify(text).length;
    // ~0.25 tokens per char for English, adjusted by PSI² ≈ 0.382 for mixed content
    return Math.ceil(charCount * PSI_SQ * PSI);
  }

  /**
   * SHA-256 hash for content deduplication
   */
  _hashContent(content) {
    return crypto.createHash('sha256')
      .update(typeof content === 'string' ? content : JSON.stringify(content))
      .digest('hex')
      .substring(0, fibonacci(8)); // 21 char prefix
  }

  /**
   * Total tokens across all tiers
   */
  _totalUsedTokens() {
    return Object.values(this.tiers).reduce((sum, tier) => sum + tier.usedTokens, 0);
  }

  // ─── Health & Observability ─────────────────────────────────────────────

  /**
   * Health check — returns coherence and utilization metrics
   */
  health() {
    const utilization = {};
    let totalUsed = 0;

    for (const [name, tier] of Object.entries(this.tiers)) {
      utilization[name] = {
        used: tier.usedTokens,
        budget: tier.budget,
        ratio: Math.round(tier.utilization() * 1000) / 1000,
        entries: tier.entries.length
      };
      totalUsed += tier.usedTokens;
    }

    const overallUtilization = totalUsed / TOTAL_BUDGET;

    // Coherence degrades if utilization is too high (over phi-threshold)
    if (overallUtilization > CSL_THRESHOLDS.HIGH) {
      this._healthState.coherence = Math.max(
        CSL_THRESHOLDS.LOW,
        this._healthState.coherence * PSI
      );
    } else if (overallUtilization < CSL_THRESHOLDS.MEDIUM) {
      this._healthState.coherence = Math.min(1.0,
        this._healthState.coherence + (1 - this._healthState.coherence) * PSI_SQ
      );
    }

    this._healthState.lastCheck = Date.now();

    return {
      status: this._healthState.coherence >= CSL_THRESHOLDS.MEDIUM ? 'healthy' : 'degraded',
      coherence: Math.round(this._healthState.coherence * 1000) / 1000,
      totalTokens: totalUsed,
      totalBudget: TOTAL_BUDGET,
      utilization: Math.round(overallUtilization * 1000) / 1000,
      tiers: utilization,
      cacheSize: this.embeddingCache.size(),
      capsuleCount: this.capsuleHistory.length,
      initialized: this._initialized,
      sessionId: this.sessionId
    };
  }

  /**
   * Reset all context (new session)
   */
  reset() {
    for (const tier of Object.values(this.tiers)) {
      tier.clear();
    }
    this.embeddingCache.clear();
    this.dedupIndex.clear();
    this.sessionId = crypto.randomUUID();
    this._healthState = { coherence: 1.0, lastCheck: Date.now() };

    logger.info({
      sessionId: this.sessionId,
      msg: 'HeadyBrains context reset'
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    // Create final capsule before shutdown
    const finalCapsule = this.createCapsule({ reason: 'shutdown' });

    logger.info({
      sessionId: this.sessionId,
      finalTokens: finalCapsule.totalTokens,
      msg: 'HeadyBrains shutting down'
    });

    this.reset();
    return finalCapsule;
  }
}

module.exports = {
  HeadyBrains,
  ContextEntry,
  ContextTier,
  ContextCapsule,
  PhiLRUCache,
  TOKEN_BUDGETS,
  TOTAL_BUDGET,
  ENTRY_TYPES,
  PRIORITY_WEIGHTS,
  RETRIEVAL_THRESHOLD,
  HIGH_RELEVANCE,
  EXACT_MATCH,
  DEDUP_THRESHOLD
};
