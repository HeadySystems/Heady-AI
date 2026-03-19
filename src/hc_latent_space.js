// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
<<<<<<< HEAD
// ║  Heady Latent Space — Vector Memory & Operations Layer          ║
// ║  ∞ SACRED GEOMETRY ∞  All operations flow through latent space  ║
=======
// ║  HEADY LATENT SPACE — Vector Routing & Semantic Memory          ║
// ║  FILE: src/hc_latent_space.js                                   ║
// ║  LAYER: core                                                    ║
>>>>>>> hc-testing/dependabot/docker/node-25-slim
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
<<<<<<< HEAD
 * HCLatentSpace — Central vector memory for all Heady operations.
 *
 * Every service, deployment, config change, and AI operation is recorded
 * in latent space, creating a persistent semantic memory that can be
 * queried, analyzed, and used for decision-making.
 *
 * Architecture:
 *   - L0 (Ephemeral): In-memory ring buffer for hot operations
 *   - L1 (Working): File-backed JSON vector store
 *   - L2 (Persistent): Append-only operation log
 *   - L3 (Archive): Compressed historical records
 *
 * Usage:
 *   const latent = require('./hc_latent_space');
 *   latent.record('deploy', 'Pushed to production', { branch: 'main', hash: 'abc123' });
 *   latent.record('config', 'Updated pipeline config', { file: 'hcfullpipeline.yaml' });
 *   const results = latent.search('deployment errors');
 *   const history = latent.getOperationLog('deploy', 10);
 */

const fs = require('fs');
const path = require('path');
const ColorfulLogger = require('./hc_colorful_logger');
const log = new ColorfulLogger({ level: 'info' });

const HEADY_ROOT = path.resolve(__dirname, '..');
const LATENT_DIR = path.join(HEADY_ROOT, 'data', 'latent-space');
const VECTOR_FILE = path.join(LATENT_DIR, 'index.json');
const OPS_LOG_FILE = path.join(LATENT_DIR, 'operations.jsonl');

// φ (golden ratio) constants for Sacred Geometry scaling
const PHI = 1.618033988749895;
const RING_BUFFER_SIZE = Math.round(PHI * 100); // ~162 entries

// ─── Ensure Directories ──────────────────────────────────────────
function ensureDirs() {
  try { fs.mkdirSync(LATENT_DIR, { recursive: true }); } catch (e) { log.warning("Failed to create latent directory", { path: LATENT_DIR, error: e.message }); }
}

// ─── L0: In-Memory Ring Buffer ────────────────────────────────────
const ringBuffer = [];
let ringIndex = 0;

function ringPush(entry) {
  if (ringBuffer.length < RING_BUFFER_SIZE) {
    ringBuffer.push(entry);
  } else {
    ringBuffer[ringIndex % RING_BUFFER_SIZE] = entry;
  }
  ringIndex++;
}

function ringSearch(query, limit = 10) {
  const q = query.toLowerCase();
  return ringBuffer
    .filter(e => e && (e.text.toLowerCase().includes(q) || e.category.includes(q)))
    .slice(-limit);
}

// ─── Text-to-Vector (Trigram Hash) ────────────────────────────────
function textToVector(text, dims = 128) {
  const vec = new Array(dims).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, '');
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
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

// ─── L1: File-Backed Vector Store ─────────────────────────────────
function loadVectorIndex() {
  try {
    return JSON.parse(fs.readFileSync(VECTOR_FILE, 'utf8'));
  } catch (e) {
    return { vectors: [], metadata: { created: new Date().toISOString(), version: '1.0' } };
  }
}

function saveVectorIndex(index) {
  ensureDirs();
  fs.writeFileSync(VECTOR_FILE, JSON.stringify(index, null, 2));
}

// ─── L2: Append-Only Operations Log ──────────────────────────────
function appendOpsLog(entry) {
  ensureDirs();
  try {
    fs.appendFileSync(OPS_LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (e) { log.warning("Failed to append to operations log", { path: OPS_LOG_FILE, error: e.message }); }
}

function readOpsLog(category, limit = 20) {
  try {
    const lines = fs.readFileSync(OPS_LOG_FILE, 'utf8').split('\n').filter(Boolean);
    const entries = lines
      .map(l => { try { return JSON.parse(l); } catch (e) { return null; } })
      .filter(Boolean);

    if (category) {
      return entries.filter(e => e.category === category).slice(-limit);
    }
    return entries.slice(-limit);
  } catch (e) {
    return [];
  }
}

// ─── Core API ─────────────────────────────────────────────────────

/**
 * Record an operation in latent space.
 * @param {string} category - Operation category (deploy, config, service, ai, git, error, etc.)
 * @param {string} text - Human-readable description
 * @param {object} meta - Structured metadata
 * @returns {object} Record confirmation
 */
function record(category, text, meta = {}) {
  const entry = {
    id: `${category}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    category,
    text,
    meta,
    timestamp: new Date().toISOString(),
    vector: textToVector(`${category} ${text}`)
  };

  // L0: Ring buffer (immediate access)
  ringPush(entry);

  // L1: Vector index (semantic search)
  const index = loadVectorIndex();
  index.vectors.push({
    key: entry.id,
    category: entry.category,
    text: entry.text.substring(0, 2000),
    vector: entry.vector,
    meta: entry.meta,
    timestamp: entry.timestamp
  });

  // Keep vector index bounded (last 1000 entries)
  if (index.vectors.length > 1000) {
    index.vectors = index.vectors.slice(-1000);
  }
  saveVectorIndex(index);

  // L2: Append-only log (full history)
  appendOpsLog({
    id: entry.id,
    category: entry.category,
    text: entry.text,
    meta: entry.meta,
    timestamp: entry.timestamp
  });

  return { recorded: true, id: entry.id, category, totalVectors: index.vectors.length };
}

/**
 * Search latent space by semantic similarity.
 * @param {string} query - Natural language search query
 * @param {number} topK - Number of results
 * @param {string} category - Optional category filter
 * @returns {object} Search results
 */
function search(query, topK = 10, category = null) {
  // Check L0 first (hot memory)
  const hotResults = ringSearch(query, topK);

  // Then L1 (vector store)
  const index = loadVectorIndex();
  let candidates = index.vectors;
  if (category) {
    candidates = candidates.filter(v => v.category === category);
  }

  const queryVec = textToVector(query);
  const scored = candidates.map(entry => ({
    key: entry.key,
    category: entry.category,
    text: entry.text.substring(0, 300),
    score: cosineSim(queryVec, entry.vector),
    meta: entry.meta,
    timestamp: entry.timestamp
  }));

  scored.sort((a, b) => b.score - a.score);

  return {
    results: scored.slice(0, topK),
    hotResults: hotResults.length,
    totalVectors: index.vectors.length
  };
}

/**
 * Get operation log for a category.
 * @param {string} category - Operation category (or null for all)
 * @param {number} limit - Max entries to return
 * @returns {Array} Operation log entries
 */
function getOperationLog(category, limit = 20) {
  return readOpsLog(category, limit);
}

/**
 * Get latent space status and statistics.
 */
function getStatus() {
  const index = loadVectorIndex();
  const categories = {};
  for (const v of index.vectors) {
    categories[v.category] = (categories[v.category] || 0) + 1;
  }

  let opsLogSize = 0;
  try {
    const stat = fs.statSync(OPS_LOG_FILE);
    opsLogSize = stat.size;
  } catch (e) { /* no log yet */ }

  return {
    l0_ring_buffer: { entries: ringBuffer.filter(Boolean).length, capacity: RING_BUFFER_SIZE },
    l1_vector_store: { entries: index.vectors.length, categories },
    l2_operations_log: { sizeBytes: opsLogSize },
    phi_constant: PHI,
    status: 'active'
  };
}

/**
 * Wrap a function to automatically record its execution in latent space.
 * @param {string} category - Operation category
 * @param {string} description - What the function does
 * @param {function} fn - Function to wrap
 * @returns {function} Wrapped function
 */
function wrap(category, description, fn) {
  return async function (...args) {
    const startTime = Date.now();
    record(category, `Starting: ${description}`, { args: args.length });

    try {
      const result = await fn.apply(this, args);
      const duration = Date.now() - startTime;
      record(category, `Completed: ${description}`, { duration, success: true });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      record('error', `Failed: ${description} — ${error.message}`, {
        category, duration, error: error.message
      });
      throw error;
    }
  };
}

/**
 * Create a middleware that records all operations for an Express-like router.
 */
function middleware() {
  return (req, res, next) => {
    const startTime = Date.now();
    const originalEnd = res.end;

    res.end = function (...args) {
      const duration = Date.now() - startTime;
      record('http', `${req.method} ${req.path} → ${res.statusCode}`, {
        method: req.method, path: req.path,
        statusCode: res.statusCode, duration
      });
      originalEnd.apply(res, args);
    };

    next();
  };
}

module.exports = {
  record,
  search,
  getOperationLog,
  getStatus,
  wrap,
  middleware,
  // Low-level access
  textToVector,
  cosineSim,
  loadVectorIndex,
  saveVectorIndex
};
=======
 * HCLatentSpace — Manages vector embeddings, semantic routing,
 * and 3D persistent vector storage for the Heady cognitive pipeline.
 *
 * Integrates with Pinecone, DuckDB-VSS, or in-memory fallback.
 */

const PHI = 1.6180339887;
const DIMENSIONS = 384; // sentence-transformers default

class HCLatentSpace {
  constructor(opts = {}) {
    this.dimensions = opts.dimensions || DIMENSIONS;
    this.store = new Map();
    this.index = [];
    this.stats = {
      totalEmbeddings: 0,
      totalSearches: 0,
      avgSearchMs: 0,
      createdAt: new Date().toISOString(),
    };
    this.backend = opts.backend || "memory"; // "pinecone" | "duckdb" | "memory"
  }

  /**
   * Store a vector embedding with metadata.
   */
  embed(id, vector, metadata = {}) {
    if (!Array.isArray(vector) || vector.length !== this.dimensions) {
      // Auto-pad or truncate to correct dimensions
      vector = this._normalizeVector(vector || []);
    }
    const entry = {
      id,
      vector,
      metadata,
      norm: this._l2Norm(vector),
      storedAt: new Date().toISOString(),
    };
    this.store.set(id, entry);
    this.index.push(id);
    this.stats.totalEmbeddings++;
    return entry;
  }

  /**
   * Semantic search — cosine similarity nearest neighbors.
   */
  search(queryVector, opts = {}) {
    const start = Date.now();
    const limit = opts.limit || 13; // fib(7)
    const minScore = opts.minScore || 0.618; // 1/φ default gate

    queryVector = this._normalizeVector(queryVector || []);
    const queryNorm = this._l2Norm(queryVector);

    const results = [];
    for (const [id, entry] of this.store) {
      const score = this._cosineSimilarity(queryVector, entry.vector, queryNorm, entry.norm);
      if (score >= minScore) {
        results.push({ id, score, metadata: entry.metadata });
      }
    }

    results.sort((a, b) => b.score - a.score);
    const elapsed = Date.now() - start;
    this.stats.totalSearches++;
    this.stats.avgSearchMs = Math.round(
      (this.stats.avgSearchMs * (this.stats.totalSearches - 1) + elapsed) / this.stats.totalSearches
    );

    return {
      results: results.slice(0, limit),
      totalCandidates: this.store.size,
      elapsed,
      ts: new Date().toISOString(),
    };
  }

  /**
   * Scan full vector storage — used by Stage 0 of HCFullPipeline.
   */
  scan(opts = {}) {
    const namespaces = {};
    for (const [id, entry] of this.store) {
      const ns = entry.metadata?.namespace || "default";
      if (!namespaces[ns]) namespaces[ns] = { count: 0, ids: [] };
      namespaces[ns].count++;
      namespaces[ns].ids.push(id);
    }

    return {
      ok: true,
      backend: this.backend,
      dimensions: this.dimensions,
      totalEmbeddings: this.store.size,
      namespaces,
      stats: this.stats,
      ts: new Date().toISOString(),
    };
  }

  /**
   * Delete an embedding by ID.
   */
  remove(id) {
    const existed = this.store.delete(id);
    if (existed) {
      this.index = this.index.filter(i => i !== id);
    }
    return { removed: existed, id };
  }

  /**
   * Get status summary for API endpoints.
   */
  getStatus() {
    return {
      backend: this.backend,
      dimensions: this.dimensions,
      totalEmbeddings: this.store.size,
      stats: this.stats,
      phi: PHI,
    };
  }

  // ─── Internal Helpers ─────────────────────────────────────────────

  _normalizeVector(v) {
    const result = new Float64Array(this.dimensions);
    for (let i = 0; i < this.dimensions && i < v.length; i++) {
      result[i] = v[i] || 0;
    }
    return Array.from(result);
  }

  _l2Norm(v) {
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
    return Math.sqrt(sum);
  }

  _cosineSimilarity(a, b, normA, normB) {
    if (normA === 0 || normB === 0) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot / (normA * normB);
  }

  _dotProduct(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * (b[i] || 0);
    return sum;
  }
}

// ─── Express Route Registration ────────────────────────────────────

function registerLatentSpaceRoutes(app, latentSpace) {
  app.get("/api/latent-space/status", (req, res) => {
    res.json({ ok: true, ...latentSpace.getStatus(), ts: new Date().toISOString() });
  });

  app.get("/api/latent-space/scan", (req, res) => {
    const result = latentSpace.scan();
    res.json(result);
  });

  app.post("/api/latent-space/embed", (req, res) => {
    const { id, vector, metadata } = req.body;
    if (!id) return res.status(400).json({ error: "id required" });
    const entry = latentSpace.embed(id, vector || [], metadata || {});
    res.json({ ok: true, embedded: entry.id, dimensions: latentSpace.dimensions });
  });

  app.post("/api/latent-space/search", (req, res) => {
    const { vector, limit, minScore } = req.body;
    const results = latentSpace.search(vector || [], { limit, minScore });
    res.json({ ok: true, ...results });
  });

  app.delete("/api/latent-space/:id", (req, res) => {
    const result = latentSpace.remove(req.params.id);
    res.json({ ok: true, ...result });
  });
}

module.exports = { HCLatentSpace, registerLatentSpaceRoutes };
>>>>>>> hc-testing/dependabot/docker/node-25-slim
