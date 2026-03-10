/**
 * HeadyMemory — Vector Memory Read/Write Interface
 * 
 * RAM-first vector memory service that is the "source of truth" for the
 * Alive Software Architecture. All reasoning, routing, and orchestration
 * decisions read from HeadyMemory first.
 * 
 * Features:
 * - RAM-first with pgvector persistence backup
 * - 384-dimensional HNSW-indexed embeddings
 * - Phi-scaled LRU cache with semantic deduplication
 * - Multi-namespace memory spaces (user, system, session, knowledge)
 * - Cosine similarity search with CSL-gated relevance scoring
 * - Batch embed and upsert operations
 * - Memory consolidation (compress old memories)
 * - Heartbeat-based coherence monitoring
 * 
 * @module HeadyMemory
 * @author Eric Haywood
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const { PHI, PSI, PSI_SQ, fibonacci, phiThreshold, phiBackoff,
  CSL_THRESHOLDS, SERVICE_PORTS } = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');
const { PgVectorClient } = require('../../shared/pgvector-client');
const { createHealthCheck } = require('../../shared/health');

const logger = createLogger('heady-memory');

// ─── Constants ──────────────────────────────────────────────────────────────
const PORT = SERVICE_PORTS?.MEMORY || 3385;
const EMBEDDING_DIM = 384;
const HNSW_M = fibonacci(8);            // 21
const HNSW_EF_CONSTRUCTION = fibonacci(12); // 144
const HNSW_EF_SEARCH = fibonacci(11);    // 89

const RAM_CACHE_SIZE = fibonacci(17);    // 1597 entries
const BATCH_SIZE = fibonacci(8);         // 21 entries per batch
const CONSOLIDATION_AGE_MS = fibonacci(14) * 60 * 1000; // 377 minutes
const HEARTBEAT_INTERVAL = fibonacci(8) * 1000; // 21 seconds

const NAMESPACES = ['user', 'system', 'session', 'knowledge', 'pattern', 'soul'];

// CSL thresholds for memory operations
const SEARCH_THRESHOLD = CSL_THRESHOLDS.LOW;       // 0.691
const HIGH_RELEVANCE = CSL_THRESHOLDS.MEDIUM;      // 0.809
const EXACT_MATCH = CSL_THRESHOLDS.CRITICAL;       // 0.927
const DEDUP_THRESHOLD = phiThreshold(5);            // ~0.955

/**
 * RAM-first memory entry
 */
class MemoryEntry {
  constructor({ id, namespace, content, embedding, metadata = {},
                importance = CSL_THRESHOLDS.MEDIUM, createdAt = Date.now(), updatedAt = Date.now() }) {
    this.id = id || crypto.randomUUID();
    this.namespace = namespace;
    this.content = content;
    this.embedding = embedding; // Float32Array or array of 384 floats
    this.metadata = metadata;
    this.importance = importance;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.accessCount = 0;
    this.lastAccessed = Date.now();
  }

  touch() {
    this.accessCount++;
    this.lastAccessed = Date.now();
    return this;
  }

  /**
   * Phi-weighted priority score for eviction decisions
   */
  priorityScore() {
    const now = Date.now();
    const age = now - this.updatedAt;
    const maxAge = CONSOLIDATION_AGE_MS;
    const recency = 1 - Math.min(age / maxAge, 1);
    const frequency = Math.min(this.accessCount / fibonacci(8), 1);

    const weights = [0.528, 0.326, 0.146]; // phiFusionWeights(3)
    return weights[0] * this.importance +
           weights[1] * recency +
           weights[2] * frequency;
  }
}

/**
 * RAM-first Memory Store with LRU eviction
 */
class RAMStore {
  constructor(capacity = RAM_CACHE_SIZE) {
    this.capacity = capacity;
    this.entries = new Map();         // id -> MemoryEntry
    this.namespaceIndex = new Map();  // namespace -> Set<id>
    this.dirty = new Set();           // IDs that need persistence sync
  }

  get(id) {
    const entry = this.entries.get(id);
    if (entry) entry.touch();
    return entry || null;
  }

  set(entry) {
    if (this.entries.size >= this.capacity && !this.entries.has(entry.id)) {
      this._evictLowest();
    }

    this.entries.set(entry.id, entry);
    this.dirty.add(entry.id);

    // Update namespace index
    if (!this.namespaceIndex.has(entry.namespace)) {
      this.namespaceIndex.set(entry.namespace, new Set());
    }
    this.namespaceIndex.get(entry.namespace).add(entry.id);

    return entry;
  }

  delete(id) {
    const entry = this.entries.get(id);
    if (entry) {
      this.entries.delete(id);
      this.dirty.delete(id);
      const nsIndex = this.namespaceIndex.get(entry.namespace);
      if (nsIndex) nsIndex.delete(id);
    }
    return !!entry;
  }

  getByNamespace(namespace) {
    const ids = this.namespaceIndex.get(namespace);
    if (!ids) return [];
    return Array.from(ids).map(id => this.entries.get(id)).filter(Boolean);
  }

  /**
   * Cosine similarity search across all RAM entries
   */
  search(queryEmbedding, { namespace = null, limit = fibonacci(8), threshold = SEARCH_THRESHOLD } = {}) {
    const candidates = namespace ? this.getByNamespace(namespace) : Array.from(this.entries.values());
    const scored = [];

    for (const entry of candidates) {
      if (!entry.embedding) continue;
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity >= threshold) {
        scored.push({ entry: entry.touch(), similarity });
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  }

  _evictLowest() {
    let lowestScore = Infinity;
    let evictId = null;

    for (const [id, entry] of this.entries) {
      const score = entry.priorityScore();
      if (score < lowestScore) {
        lowestScore = score;
        evictId = id;
      }
    }

    if (evictId) {
      this.delete(evictId);
      logger.info({ evictedId: evictId, score: lowestScore, msg: 'RAM entry evicted' });
    }
  }

  getDirtyEntries() {
    const entries = [];
    for (const id of this.dirty) {
      const entry = this.entries.get(id);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  clearDirty() {
    this.dirty.clear();
  }

  size() { return this.entries.size; }

  stats() {
    return {
      totalEntries: this.entries.size,
      capacity: this.capacity,
      utilization: Math.round((this.entries.size / this.capacity) * 1000) / 1000,
      dirtyCount: this.dirty.size,
      namespaces: Object.fromEntries(
        Array.from(this.namespaceIndex.entries()).map(([ns, ids]) => [ns, ids.size])
      )
    };
  }
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * HeadyMemory Service
 */
class HeadyMemory {
  constructor(config = {}) {
    this.ramStore = new RAMStore(config.cacheSize || RAM_CACHE_SIZE);
    this.pgClient = config.pgClient || null;
    this.embeddingFn = config.embeddingFn || null;
    this._syncInterval = null;
    this._heartbeatInterval = null;
    this._coherence = 1.0;
    this._initialized = false;
  }

  async initialize() {
    if (this._initialized) return;

    try {
      if (!this.pgClient) {
        this.pgClient = new PgVectorClient();
        await this.pgClient.initialize();
      }

      // Ensure memory table exists
      await this._ensureSchema();

      // Load hot entries into RAM
      await this._warmRAMCache();

      // Start background sync (dirty entries → pgvector)
      this._syncInterval = setInterval(() => this._syncToPg(), fibonacci(13) * 1000); // Every 233 seconds

      // Start coherence heartbeat
      this._heartbeatInterval = setInterval(() => this._heartbeat(), HEARTBEAT_INTERVAL);

      this._initialized = true;
      logger.info({ msg: 'HeadyMemory initialized', ramSize: this.ramStore.size() });
    } catch (err) {
      logger.error({ err: err.message, msg: 'HeadyMemory initialization failed, RAM-only mode' });
      this._initialized = true; // Run in RAM-only degraded mode
    }
  }

  /**
   * Store a memory entry
   */
  async store({ namespace = 'knowledge', content, embedding = null, metadata = {}, importance }) {
    if (!NAMESPACES.includes(namespace)) {
      throw new Error(`Invalid namespace: ${namespace}. Valid: ${NAMESPACES.join(', ')}`);
    }

    // Generate embedding if not provided
    if (!embedding && this.embeddingFn) {
      embedding = await this.embeddingFn(content);
    }

    // Check for semantic duplicates in RAM
    if (embedding) {
      const existing = this.ramStore.search(embedding, {
        namespace,
        limit: 1,
        threshold: DEDUP_THRESHOLD
      });

      if (existing.length > 0) {
        // Update existing instead of creating duplicate
        const entry = existing[0].entry;
        entry.content = content;
        entry.embedding = embedding;
        entry.metadata = { ...entry.metadata, ...metadata };
        entry.updatedAt = Date.now();
        if (importance !== undefined) entry.importance = importance;
        this.ramStore.set(entry);

        logger.info({
          id: entry.id,
          namespace,
          similarity: existing[0].similarity,
          msg: 'Updated existing memory (dedup match)'
        });

        return { id: entry.id, action: 'updated', similarity: existing[0].similarity };
      }
    }

    // Create new entry
    const entry = new MemoryEntry({
      namespace,
      content,
      embedding,
      metadata,
      importance: importance || CSL_THRESHOLDS.MEDIUM
    });

    this.ramStore.set(entry);

    logger.info({
      id: entry.id,
      namespace,
      contentLength: content?.length || 0,
      hasEmbedding: !!embedding,
      msg: 'Memory stored'
    });

    return { id: entry.id, action: 'created' };
  }

  /**
   * Retrieve a memory by ID
   */
  async recall(id) {
    // RAM first
    const entry = this.ramStore.get(id);
    if (entry) return this._entryToResponse(entry);

    // Fallback to pgvector
    if (this.pgClient) {
      try {
        const result = await this.pgClient.query(
          'SELECT * FROM heady_memory WHERE id = $1',
          [id]
        );
        if (result.rows[0]) {
          const row = result.rows[0];
          const restored = new MemoryEntry({
            id: row.id,
            namespace: row.namespace,
            content: row.content,
            embedding: row.embedding,
            metadata: row.metadata || {},
            importance: row.importance || CSL_THRESHOLDS.MEDIUM,
            createdAt: new Date(row.created_at).getTime(),
            updatedAt: new Date(row.updated_at).getTime()
          });
          this.ramStore.set(restored);
          return this._entryToResponse(restored);
        }
      } catch (err) {
        logger.warn({ err: err.message, id, msg: 'PgVector recall failed' });
      }
    }

    return null;
  }

  /**
   * Semantic search across memory
   */
  async search(query, { namespace = null, limit = fibonacci(8), threshold = SEARCH_THRESHOLD, embedding = null } = {}) {
    // Get query embedding
    let queryEmbedding = embedding;
    if (!queryEmbedding && this.embeddingFn) {
      queryEmbedding = await this.embeddingFn(query);
    }

    if (!queryEmbedding) {
      logger.warn({ msg: 'No embedding available for search query' });
      return [];
    }

    // RAM search first
    const ramResults = this.ramStore.search(queryEmbedding, { namespace, limit, threshold });

    // If RAM has enough high-relevance results, skip pg
    const highRelevance = ramResults.filter(r => r.similarity >= HIGH_RELEVANCE);
    if (highRelevance.length >= limit) {
      return ramResults.slice(0, limit).map(r => ({
        ...this._entryToResponse(r.entry),
        similarity: Math.round(r.similarity * 1000) / 1000,
        source: 'ram'
      }));
    }

    // Supplement from pgvector
    let pgResults = [];
    if (this.pgClient && queryEmbedding) {
      try {
        const embeddingStr = `[${queryEmbedding.join(',')}]`;
        const nsFilter = namespace ? 'AND namespace = $4' : '';
        const params = namespace
          ? [embeddingStr, threshold, limit, namespace]
          : [embeddingStr, threshold, limit];

        const result = await this.pgClient.query(
          `SELECT id, namespace, content, metadata, importance, created_at, updated_at,
                  1 - (embedding <=> $1::vector) as similarity
           FROM heady_memory
           WHERE 1 - (embedding <=> $1::vector) > $2 ${nsFilter}
           ORDER BY embedding <=> $1::vector
           LIMIT $3`,
          params
        );

        pgResults = (result.rows || []).map(row => ({
          id: row.id,
          namespace: row.namespace,
          content: row.content,
          metadata: row.metadata || {},
          importance: row.importance,
          similarity: Math.round(row.similarity * 1000) / 1000,
          source: 'pgvector',
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
      } catch (err) {
        logger.warn({ err: err.message, msg: 'PgVector search failed' });
      }
    }

    // Merge and deduplicate results
    const merged = new Map();
    for (const r of ramResults) {
      merged.set(r.entry.id, {
        ...this._entryToResponse(r.entry),
        similarity: Math.round(r.similarity * 1000) / 1000,
        source: 'ram'
      });
    }
    for (const r of pgResults) {
      if (!merged.has(r.id)) {
        merged.set(r.id, r);
      }
    }

    // Sort by similarity descending
    const results = Array.from(merged.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    logger.info({
      query: query?.substring(0, fibonacci(8) * 5), // 105 chars max
      namespace,
      ramHits: ramResults.length,
      pgHits: pgResults.length,
      merged: results.length,
      msg: 'Memory search complete'
    });

    return results;
  }

  /**
   * Batch store multiple memories
   */
  async batchStore(entries) {
    const results = [];
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(entry => this.store(entry))
      );
      results.push(...batchResults);
    }
    return results;
  }

  /**
   * Delete a memory
   */
  async forget(id) {
    const deleted = this.ramStore.delete(id);

    if (this.pgClient) {
      try {
        await this.pgClient.query('DELETE FROM heady_memory WHERE id = $1', [id]);
      } catch (err) {
        logger.warn({ err: err.message, id, msg: 'PgVector delete failed' });
      }
    }

    return deleted;
  }

  /**
   * Consolidate old memories — compress low-access entries
   */
  async consolidate() {
    const now = Date.now();
    const entries = Array.from(this.ramStore.entries.values());
    const old = entries.filter(e => (now - e.updatedAt) > CONSOLIDATION_AGE_MS && e.accessCount < fibonacci(5));

    if (old.length === 0) return { consolidated: 0 };

    // Group by namespace and summarize
    const byNamespace = {};
    for (const entry of old) {
      if (!byNamespace[entry.namespace]) byNamespace[entry.namespace] = [];
      byNamespace[entry.namespace].push(entry);
    }

    let consolidated = 0;
    for (const [ns, nsEntries] of Object.entries(byNamespace)) {
      if (nsEntries.length < fibonacci(5)) continue; // Need at least 5 to consolidate

      // Combine content
      const combined = nsEntries.map(e => e.content).join('\n---\n');
      const avgImportance = nsEntries.reduce((s, e) => s + e.importance, 0) / nsEntries.length;

      // Store consolidated entry
      await this.store({
        namespace: ns,
        content: `[Consolidated ${nsEntries.length} memories]: ${combined.substring(0, fibonacci(14) * 10)}`, // ~3770 chars
        importance: avgImportance,
        metadata: { consolidated: true, originalCount: nsEntries.length, consolidatedAt: now }
      });

      // Remove originals from RAM
      for (const entry of nsEntries) {
        this.ramStore.delete(entry.id);
      }

      consolidated += nsEntries.length;
    }

    logger.info({ consolidated, namespaces: Object.keys(byNamespace).length, msg: 'Memory consolidation complete' });
    return { consolidated };
  }

  // ─── Private Methods ──────────────────────────────────────────────────

  async _ensureSchema() {
    if (!this.pgClient) return;

    await this.pgClient.query(`
      CREATE TABLE IF NOT EXISTS heady_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        namespace VARCHAR(50) NOT NULL DEFAULT 'knowledge',
        content TEXT NOT NULL,
        embedding vector(${EMBEDDING_DIM}),
        metadata JSONB DEFAULT '{}',
        importance FLOAT DEFAULT ${CSL_THRESHOLDS.MEDIUM},
        access_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_heady_memory_embedding
        ON heady_memory USING hnsw (embedding vector_cosine_ops)
        WITH (m = ${HNSW_M}, ef_construction = ${HNSW_EF_CONSTRUCTION});

      CREATE INDEX IF NOT EXISTS idx_heady_memory_namespace
        ON heady_memory (namespace);

      CREATE INDEX IF NOT EXISTS idx_heady_memory_importance
        ON heady_memory (importance DESC);
    `);
  }

  async _warmRAMCache() {
    if (!this.pgClient) return;

    try {
      // Load most important and recently accessed entries
      const result = await this.pgClient.query(
        `SELECT * FROM heady_memory
         ORDER BY importance DESC, updated_at DESC
         LIMIT $1`,
        [fibonacci(16)] // 987 entries
      );

      for (const row of (result.rows || [])) {
        const entry = new MemoryEntry({
          id: row.id,
          namespace: row.namespace,
          content: row.content,
          embedding: row.embedding,
          metadata: row.metadata || {},
          importance: row.importance || CSL_THRESHOLDS.MEDIUM,
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime()
        });
        entry.accessCount = row.access_count || 0;
        this.ramStore.set(entry);
      }

      this.ramStore.clearDirty(); // Don't re-sync freshly loaded entries
      logger.info({ loaded: result.rows?.length || 0, msg: 'RAM cache warmed from pgvector' });
    } catch (err) {
      logger.warn({ err: err.message, msg: 'RAM cache warming failed' });
    }
  }

  async _syncToPg() {
    if (!this.pgClient) return;

    const dirty = this.ramStore.getDirtyEntries();
    if (dirty.length === 0) return;

    let synced = 0;
    for (let i = 0; i < dirty.length; i += BATCH_SIZE) {
      const batch = dirty.slice(i, i + BATCH_SIZE);
      for (const entry of batch) {
        try {
          const embeddingStr = entry.embedding ? `[${entry.embedding.join(',')}]` : null;
          await this.pgClient.query(
            `INSERT INTO heady_memory (id, namespace, content, embedding, metadata, importance, access_count, created_at, updated_at)
             VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
               content = EXCLUDED.content,
               embedding = EXCLUDED.embedding,
               metadata = EXCLUDED.metadata,
               importance = EXCLUDED.importance,
               access_count = EXCLUDED.access_count,
               updated_at = EXCLUDED.updated_at`,
            [
              entry.id, entry.namespace, entry.content, embeddingStr,
              JSON.stringify(entry.metadata), entry.importance, entry.accessCount,
              new Date(entry.createdAt), new Date(entry.updatedAt)
            ]
          );
          synced++;
        } catch (err) {
          logger.warn({ err: err.message, entryId: entry.id, msg: 'Sync entry failed' });
        }
      }
    }

    this.ramStore.clearDirty();
    logger.info({ synced, total: dirty.length, msg: 'RAM → pgvector sync complete' });
  }

  _heartbeat() {
    const stats = this.ramStore.stats();
    const utilization = stats.utilization;

    // Coherence degrades under high utilization
    if (utilization > CSL_THRESHOLDS.HIGH) {
      this._coherence = Math.max(CSL_THRESHOLDS.LOW, this._coherence * PSI);
    } else if (utilization < CSL_THRESHOLDS.MEDIUM) {
      this._coherence = Math.min(1.0, this._coherence + (1 - this._coherence) * PSI_SQ);
    }
  }

  _entryToResponse(entry) {
    return {
      id: entry.id,
      namespace: entry.namespace,
      content: entry.content,
      metadata: entry.metadata,
      importance: entry.importance,
      accessCount: entry.accessCount,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    };
  }

  health() {
    const stats = this.ramStore.stats();
    return {
      status: this._coherence >= CSL_THRESHOLDS.MEDIUM ? 'healthy' : 'degraded',
      coherence: Math.round(this._coherence * 1000) / 1000,
      ram: stats,
      pgConnected: !!this.pgClient,
      initialized: this._initialized
    };
  }

  async shutdown() {
    // Final sync before shutdown
    await this._syncToPg();
    if (this._syncInterval) clearInterval(this._syncInterval);
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
    logger.info({ msg: 'HeadyMemory shut down' });
  }
}

// ─── HTTP Server ────────────────────────────────────────────────────────────
async function startServer() {
  const memory = new HeadyMemory();
  await memory.initialize();

  const healthCheck = createHealthCheck('heady-memory', {
    checks: [() => memory.health()]
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const method = req.method;

    // Parse body for POST/PUT
    let body = null;
    if (method === 'POST' || method === 'PUT') {
      body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve(null); }
        });
      });
    }

    const respond = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      // Health
      if (url.pathname === '/health') {
        return respond(200, {
          ...healthCheck(),
          service: 'heady-memory',
          memory: memory.health()
        });
      }

      // Store
      if (url.pathname === '/api/memory' && method === 'POST') {
        if (!body) return respond(400, { error: 'Request body required' });
        const result = await memory.store(body);
        return respond(201, result);
      }

      // Search
      if (url.pathname === '/api/memory/search' && method === 'POST') {
        if (!body || !body.query) return respond(400, { error: 'Query required' });
        const results = await memory.search(body.query, {
          namespace: body.namespace,
          limit: body.limit,
          threshold: body.threshold,
          embedding: body.embedding
        });
        return respond(200, { results, count: results.length });
      }

      // Recall by ID
      if (url.pathname.startsWith('/api/memory/') && method === 'GET') {
        const id = url.pathname.split('/').pop();
        const result = await memory.recall(id);
        if (!result) return respond(404, { error: 'Memory not found' });
        return respond(200, result);
      }

      // Batch store
      if (url.pathname === '/api/memory/batch' && method === 'POST') {
        if (!body || !Array.isArray(body.entries)) return respond(400, { error: 'Entries array required' });
        const results = await memory.batchStore(body.entries);
        return respond(201, { results, count: results.length });
      }

      // Delete
      if (url.pathname.startsWith('/api/memory/') && method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        const deleted = await memory.forget(id);
        return respond(deleted ? 200 : 404, { deleted });
      }

      // Consolidate
      if (url.pathname === '/api/memory/consolidate' && method === 'POST') {
        const result = await memory.consolidate();
        return respond(200, result);
      }

      // Stats
      if (url.pathname === '/api/memory/stats') {
        return respond(200, memory.health());
      }

      respond(404, { error: 'Not found' });
    } catch (err) {
      logger.error({ err: err.message, path: url.pathname, method, msg: 'Request handler error' });
      respond(500, { error: 'Internal server error' });
    }
  });

  server.listen(PORT, () => {
    logger.info({ port: PORT, msg: 'HeadyMemory service started' });
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info({ msg: 'HeadyMemory shutting down...' });
    await memory.shutdown();
    server.close();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { server, memory };
}

module.exports = { HeadyMemory, MemoryEntry, RAMStore, cosineSimilarity, startServer };

// Start if run directly
if (require.main === module) {
  startServer().catch(err => {
    logger.error({ err: err.message, msg: 'HeadyMemory startup failed' });
    process.exit(1);
  });
}
