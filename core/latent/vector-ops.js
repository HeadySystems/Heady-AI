/**
 * Heady™ Latent Space Operations — Tightened Vector Mathematics
 * ═════════════════════════════════════════════════════════════
 *
 * Production-hardened vector operations for the 384-dimensional
 * latent space. All operations use φ-scaled parameters.
 *
 * Consolidates: vector-space-ops.js, vector-memory.js, spatial-embedder.js
 *
 * @module core/latent/vector-ops
 */
'use strict';

const { PHI, PSI, PSI2, fib, CSL, cosineSimilarity, normalize } = require('../constants/phi');

// ─── Constants ──────────────────────────────────────────────────────────────────

const DIMENSIONS = 384;                      // Default embedding dimension
const DIMENSIONS_LARGE = 1536;               // High-fidelity embeddings
const HNSW_EF_CONSTRUCTION = fib(10) + fib(9); // 55+34 = 89 (build quality — high recall)
const HNSW_EF_SEARCH = fib(8);               // 21 (query time — balanced)
const HNSW_M = fib(5) * fib(4);             // 5*3 = 15 (max neighbors — moderate)
const LRU_CAPACITY = fib(12);               // 144 cached embeddings
const BATCH_SIZE = fib(7);                   // 13 embeddings per batch
const SIMILARITY_FLOOR = PSI2;               // 0.382 — minimum relevance
const BOOST_THRESHOLD = PSI;                 // 0.618 — strong relevance
const CRITICAL_THRESHOLD = CSL.CRITICAL;     // 0.927 — exact match

// ─── 3D Memory Axes ─────────────────────────────────────────────────────────────
// Heady's vector memory operates in 3D space:
//   X = Semantic (what it means)
//   Y = Temporal (when it happened)
//   Z = Importance (how much it matters)

const AXIS = { SEMANTIC: 0, TEMPORAL: 1, IMPORTANCE: 2 };

// ─── Vector Operations ──────────────────────────────────────────────────────────

/**
 * Dot product of two vectors.
 * @param {Float32Array|number[]} a
 * @param {Float32Array|number[]} b
 * @returns {number}
 */
function dot(a, b) {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  // Unrolled loop for performance (4x)
  const limit = len - (len % 4);
  for (let i = 0; i < limit; i += 4) {
    sum += a[i] * b[i] + a[i+1] * b[i+1] + a[i+2] * b[i+2] + a[i+3] * b[i+3];
  }
  for (let i = limit; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * L2 (Euclidean) norm of a vector.
 * @param {Float32Array|number[]} v
 * @returns {number}
 */
function l2Norm(v) {
  return Math.sqrt(dot(v, v));
}

/**
 * Normalize a vector in-place to unit length.
 * @param {Float32Array|number[]} v
 * @returns {Float32Array|number[]}
 */
function normalizeInPlace(v) {
  const norm = l2Norm(v);
  if (norm === 0) return v;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

/**
 * Cosine similarity between two vectors.
 * @param {Float32Array|number[]} a
 * @param {Float32Array|number[]} b
 * @returns {number} Similarity in [-1, 1]
 */
function cosine(a, b) {
  const d = dot(a, b);
  const na = l2Norm(a);
  const nb = l2Norm(b);
  if (na === 0 || nb === 0) return 0;
  return d / (na * nb);
}

/**
 * Weighted cosine similarity with φ-fusion weights.
 * Combines semantic, temporal, and importance axes.
 * @param {object} a - { semantic: vec, temporal: number, importance: number }
 * @param {object} b - { semantic: vec, temporal: number, importance: number }
 * @returns {number} Fused similarity score
 */
function fusedSimilarity(a, b) {
  // φ-fusion weights: semantic is strongest (PHI), temporal next (1), importance (PSI)
  const wSemantic   = PHI;      // 1.618
  const wTemporal   = 1.0;      // 1.0
  const wImportance = PSI;      // 0.618
  const totalWeight = wSemantic + wTemporal + wImportance;

  const semSim = cosine(a.semantic, b.semantic);
  const tempSim = 1 - Math.abs(a.temporal - b.temporal); // Closer in time = more similar
  const impSim = 1 - Math.abs(a.importance - b.importance);

  return (semSim * wSemantic + tempSim * wTemporal + impSim * wImportance) / totalWeight;
}

/**
 * Apply CSL gate to a similarity score.
 * @param {number} similarity
 * @returns {{ pass: boolean, level: string, confidence: number }}
 */
function cslGate(similarity) {
  if (similarity >= CRITICAL_THRESHOLD) return { pass: true, level: 'CRITICAL', confidence: similarity };
  if (similarity >= CSL.HIGH)           return { pass: true, level: 'HIGH',     confidence: similarity };
  if (similarity >= CSL.INJECT)         return { pass: true, level: 'INJECT',   confidence: similarity };
  if (similarity >= BOOST_THRESHOLD)    return { pass: true, level: 'BOOST',    confidence: similarity };
  if (similarity >= SIMILARITY_FLOOR)   return { pass: true, level: 'INCLUDE',  confidence: similarity };
  return { pass: false, level: 'SUPPRESS', confidence: similarity };
}

/**
 * Batch compute similarities between a query and candidates.
 * Returns sorted results with CSL gating.
 * @param {Float32Array|number[]} query
 * @param {Array<{ id: string, vector: Float32Array|number[], metadata?: object }>} candidates
 * @param {object} [opts]
 * @param {number} [opts.topK]       - Max results (default: fib(7)=13)
 * @param {number} [opts.threshold]  - Min similarity (default: SIMILARITY_FLOOR)
 * @returns {Array<{ id: string, similarity: number, csl: object, metadata?: object }>}
 */
function searchSimilar(query, candidates, opts = {}) {
  const topK = opts.topK ?? fib(7);        // 13
  const threshold = opts.threshold ?? SIMILARITY_FLOOR;

  const results = [];
  for (const candidate of candidates) {
    const sim = cosine(query, candidate.vector);
    if (sim >= threshold) {
      results.push({
        id: candidate.id,
        similarity: sim,
        csl: cslGate(sim),
        metadata: candidate.metadata,
      });
    }
  }

  // Sort descending by similarity
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

/**
 * Quantize a float32 vector to int8 for storage efficiency.
 * Reduces memory by 4x with minimal recall loss.
 * @param {Float32Array|number[]} vec
 * @returns {Int8Array}
 */
function quantizeInt8(vec) {
  const out = new Int8Array(vec.length);
  // Find max absolute value for scaling
  let maxVal = 0;
  for (let i = 0; i < vec.length; i++) {
    const abs = Math.abs(vec[i]);
    if (abs > maxVal) maxVal = abs;
  }
  if (maxVal === 0) return out;
  const scale = 127 / maxVal;
  for (let i = 0; i < vec.length; i++) {
    out[i] = Math.round(vec[i] * scale);
  }
  return out;
}

/**
 * Dequantize int8 back to float32.
 * @param {Int8Array} vec
 * @param {number} maxVal - Original max absolute value
 * @returns {Float32Array}
 */
function dequantizeInt8(vec, maxVal) {
  const out = new Float32Array(vec.length);
  const scale = maxVal / 127;
  for (let i = 0; i < vec.length; i++) {
    out[i] = vec[i] * scale;
  }
  return out;
}

/**
 * Binary quantization — extreme compression (32x smaller).
 * Each dimension becomes a single bit (positive = 1, negative = 0).
 * Used for coarse pre-filtering before exact search.
 * @param {Float32Array|number[]} vec
 * @returns {Uint8Array}
 */
function quantizeBinary(vec) {
  const bytes = Math.ceil(vec.length / 8);
  const out = new Uint8Array(bytes);
  for (let i = 0; i < vec.length; i++) {
    if (vec[i] > 0) {
      out[Math.floor(i / 8)] |= (1 << (i % 8));
    }
  }
  return out;
}

/**
 * Hamming distance between two binary-quantized vectors.
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {number}
 */
function hammingDistance(a, b) {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = a[i] ^ b[i];
    // Count set bits (Brian Kernighan's algorithm)
    while (xor) { xor &= (xor - 1); dist++; }
  }
  return dist;
}

/**
 * Generate HNSW-tuned pgvector SQL for creating indexes.
 * @param {string} tableName
 * @param {string} columnName
 * @param {number} [dims] - Dimensions (default: 384)
 * @returns {string} SQL statements
 */
function generateHNSWSql(tableName, columnName, dims = DIMENSIONS) {
  return [
    `-- HNSW Index: φ-tuned for Heady™ ${dims}d vectors`,
    `CREATE INDEX IF NOT EXISTS idx_${tableName}_${columnName}_hnsw`,
    `  ON ${tableName} USING hnsw (${columnName} vector_cosine_ops)`,
    `  WITH (m = ${HNSW_M}, ef_construction = ${HNSW_EF_CONSTRUCTION});`,
    '',
    `-- Set search-time ef for queries`,
    `SET hnsw.ef_search = ${HNSW_EF_SEARCH};`,
    '',
    `-- Binary quantization index for coarse pre-filtering`,
    `CREATE INDEX IF NOT EXISTS idx_${tableName}_${columnName}_binary`,
    `  ON ${tableName} USING hnsw ((${columnName}::bit(${dims})) bit_hamming_ops)`,
    `  WITH (m = ${HNSW_M}, ef_construction = ${Math.round(HNSW_EF_CONSTRUCTION * PSI)});`,
  ].join('\n');
}

// ─── LRU Cache for Embeddings ───────────────────────────────────────────────────

class EmbeddingCache {
  constructor(capacity = LRU_CAPACITY) {
    this.capacity = capacity;
    this._cache = new Map(); // key → { vector, accessedAt, hits }
  }

  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    // Move to end (most recently used)
    this._cache.delete(key);
    entry.accessedAt = Date.now();
    entry.hits++;
    this._cache.set(key, entry);
    return entry.vector;
  }

  set(key, vector) {
    if (this._cache.has(key)) this._cache.delete(key);
    if (this._cache.size >= this.capacity) {
      // Evict least recently used
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(key, { vector, accessedAt: Date.now(), hits: 0 });
  }

  stats() {
    return {
      size: this._cache.size,
      capacity: this.capacity,
      utilization: this._cache.size / this.capacity,
    };
  }

  clear() { this._cache.clear(); }
}

module.exports = {
  // Constants
  DIMENSIONS, DIMENSIONS_LARGE,
  HNSW_EF_CONSTRUCTION, HNSW_EF_SEARCH, HNSW_M,
  LRU_CAPACITY, BATCH_SIZE,
  SIMILARITY_FLOOR, BOOST_THRESHOLD, CRITICAL_THRESHOLD,
  AXIS,

  // Operations
  dot, l2Norm, normalizeInPlace, cosine,
  fusedSimilarity, cslGate,
  searchSimilar,

  // Quantization
  quantizeInt8, dequantizeInt8,
  quantizeBinary, hammingDistance,

  // SQL
  generateHNSWSql,

  // Cache
  EmbeddingCache,
};
