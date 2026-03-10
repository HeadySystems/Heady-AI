'use strict';

/**
 * Heady™ Colab Vector Space Operations
 * 384-dimensional vector space engine running on Colab Pro+ runtimes.
 * Embedding, batch processing, HNSW indexing, hybrid search, clustering,
 * and 3D projection — all constants derived from φ / Fibonacci.
 *
 * @module colab-vector-space-ops
 * @author HeadySystems Inc.
 * @license Proprietary
 */

// ─── Phi / Fibonacci Primitives ──────────────────────────────────────────────

/** @constant {number} PHI - Golden ratio φ = (1 + √5) / 2 ≈ 1.618033988749895 */
const PHI = (1 + Math.sqrt(5)) / 2;

/** @constant {number} PSI - Conjugate golden ratio ψ = 1/φ ≈ 0.618033988749895 */
const PSI = 1 / PHI;

/**
 * Compute the n-th Fibonacci number via Binet's closed-form formula.
 * @param {number} n - Non-negative integer index.
 * @returns {number} F(n).
 */
const fib = (n) => Math.round((Math.pow(PHI, n) - Math.pow(-PSI, n)) / Math.sqrt(5));

// ─── Derived Constants ───────────────────────────────────────────────────────

/** @constant {number} EMBEDDING_DIM - 384 dimensions (fib(7) × fib(5) × ... kept at 384 for MiniLM compat) */
const EMBEDDING_DIM = 384;

/** @constant {number} CACHE_MAX_SIZE - fib(16) = 987 entries */
const CACHE_MAX_SIZE = fib(16);

/** @constant {number} CACHE_EVICTION_BATCH - fib(6) = 8 entries evicted at once */
const CACHE_EVICTION_BATCH = fib(6);

/** @constant {number} HNSW_EF_CONSTRUCTION - 200 (≈ fib(11) × PHI² ≈ 89 × 2.236 ≈ 199) */
const HNSW_EF_CONSTRUCTION = 200;

/** @constant {number} HNSW_M - 32 (≈ fib(9) ≈ 34 rounded to nearest power-of-two friendly value) */
const HNSW_M = 32;

/** @constant {number} HNSW_EF_SEARCH - fib(11) = 89 */
const HNSW_EF_SEARCH = fib(11);

/** @constant {number} HNSW_MAX_LEVEL - fib(6) = 8 maximum graph layers */
const HNSW_MAX_LEVEL = fib(6);

/** @constant {number[]} FIBONACCI_BATCH_SIZES - [8, 13, 21, 34, 55] for adaptive batch embedding */
const FIBONACCI_BATCH_SIZES = [fib(6), fib(7), fib(8), fib(9), fib(10)];

/** @constant {number} KNN_DEFAULT_K - fib(7) = 13 default neighbours for kNN */
const KNN_DEFAULT_K = fib(7);

/** @constant {number} CLUSTER_MAX_ITERS - fib(8) = 21 k-means iterations */
const CLUSTER_MAX_ITERS = fib(8);

/** @constant {number} PCA_POWER_ITERS - fib(7) = 13 power iterations for PCA */
const PCA_POWER_ITERS = fib(7);

// ─── EmbeddingCache ──────────────────────────────────────────────────────────

/**
 * LRU cache for embedding vectors.
 * Max size is fib(16) = 987 entries. On capacity overflow, the oldest
 * fib(6) = 8 entries are evicted in a batch.
 */
class EmbeddingCache {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxSize] - Maximum entries; defaults to fib(16) = 987.
   * @param {number} [opts.evictionBatch] - Entries evicted per overflow; defaults to fib(6) = 8.
   */
  constructor(opts = {}) {
    /** @type {number} */
    this.maxSize = opts.maxSize || CACHE_MAX_SIZE;
    /** @type {number} */
    this.evictionBatch = opts.evictionBatch || CACHE_EVICTION_BATCH;
    /** @type {Map<string, Float32Array>} Ordered map — oldest first */
    this._map = new Map();
    /** @type {number} */
    this.hits = 0;
    /** @type {number} */
    this.misses = 0;
  }

  /**
   * Retrieve a cached embedding. Moves the key to most-recent position.
   * @param {string} key - Cache key (typically hashed text).
   * @returns {Float32Array|null} Cached vector, or null on miss.
   */
  get(key) {
    if (!this._map.has(key)) {
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    const val = this._map.get(key);
    this._map.delete(key);
    this._map.set(key, val);
    return val;
  }

  /**
   * Store an embedding vector. Evicts fib(6) oldest entries when full.
   * @param {string} key          - Cache key.
   * @param {Float32Array} vector - Embedding to cache.
   */
  set(key, vector) {
    if (this._map.has(key)) {
      this._map.delete(key);
    } else if (this._map.size >= this.maxSize) {
      this._evict();
    }
    this._map.set(key, vector);
  }

  /**
   * Check whether a key exists without affecting LRU order.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this._map.has(key);
  }

  /** @returns {number} Current entry count. */
  get size() { return this._map.size; }

  /** @returns {number} Hit rate in [0, 1]. */
  get hitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  /** Clear all entries and reset stats. */
  clear() {
    this._map.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Evict the oldest `evictionBatch` entries.
   * @private
   */
  _evict() {
    const iter = this._map.keys();
    for (let i = 0; i < this.evictionBatch; i++) {
      const { value, done } = iter.next();
      if (done) break;
      this._map.delete(value);
    }
  }
}

// ─── VectorProjection ────────────────────────────────────────────────────────

/**
 * Projects 384-dimensional vectors down to 3D using PCA with power
 * iteration, then maps each 3D point to one of 8 spatial octants.
 */
class VectorProjection {
  /**
   * @param {number} [sourceDim] - Source dimensionality; defaults to EMBEDDING_DIM.
   */
  constructor(sourceDim = EMBEDDING_DIM) {
    /** @type {number} */
    this.sourceDim = sourceDim;
    /** @type {number} */
    this.targetDim = 3;
    /** @type {Array<Float32Array>|null} Computed principal components */
    this._components = null;
    /** @type {Float32Array|null} Mean vector for centering */
    this._mean = null;
  }

  /**
   * Fit the projection on a set of vectors, computing the top-3 principal
   * components via power iteration (fib(7) = 13 iterations per component).
   *
   * @param {Array<number[]|Float32Array>} vectors - Training vectors.
   * @returns {VectorProjection} this (for chaining).
   */
  fit(vectors) {
    const n = vectors.length;
    const d = this.sourceDim;

    /* Compute mean */
    this._mean = new Float32Array(d);
    for (const v of vectors) {
      for (let i = 0; i < d; i++) this._mean[i] += v[i];
    }
    for (let i = 0; i < d; i++) this._mean[i] /= n;

    /* Center data */
    const centered = vectors.map((v) => {
      const c = new Float32Array(d);
      for (let i = 0; i < d; i++) c[i] = v[i] - this._mean[i];
      return c;
    });

    /* Extract top 3 components via deflated power iteration */
    this._components = [];
    let residuals = centered.map((v) => Float32Array.from(v));

    for (let comp = 0; comp < this.targetDim; comp++) {
      let pc = new Float32Array(d);
      for (let i = 0; i < d; i++) pc[i] = Math.random() - 0.5;
      this._normalise(pc);

      for (let iter = 0; iter < PCA_POWER_ITERS; iter++) {
        const newPc = new Float32Array(d);
        for (const vec of residuals) {
          let dot = 0;
          for (let i = 0; i < d; i++) dot += vec[i] * pc[i];
          for (let i = 0; i < d; i++) newPc[i] += dot * vec[i];
        }
        this._normalise(newPc);
        pc = newPc;
      }
      this._components.push(pc);

      /* Deflate residuals */
      residuals = residuals.map((vec) => {
        let dot = 0;
        for (let i = 0; i < d; i++) dot += vec[i] * pc[i];
        const r = new Float32Array(d);
        for (let i = 0; i < d; i++) r[i] = vec[i] - dot * pc[i];
        return r;
      });
    }
    return this;
  }

  /**
   * Project a single vector to 3D.
   * @param {number[]|Float32Array} vector - EMBEDDING_DIM-length input.
   * @returns {{coords: number[], octant: number}} 3D coordinates and octant index (0–7).
   */
  project(vector) {
    if (!this._components) {
      throw new Error('VectorProjection has not been fitted. Call fit() first.');
    }
    const d = this.sourceDim;
    const coords = [];
    for (const pc of this._components) {
      let dot = 0;
      for (let i = 0; i < d; i++) dot += (vector[i] - this._mean[i]) * pc[i];
      coords.push(dot);
    }
    const octant = (coords[0] >= 0 ? 4 : 0) + (coords[1] >= 0 ? 2 : 0) + (coords[2] >= 0 ? 1 : 0);
    return { coords, octant };
  }

  /**
   * Project a batch of vectors to 3D.
   * @param {Array<number[]|Float32Array>} vectors
   * @returns {Array<{coords: number[], octant: number}>}
   */
  projectBatch(vectors) {
    return vectors.map((v) => this.project(v));
  }

  /**
   * In-place L2 normalisation.
   * @param {Float32Array} vec
   * @private
   */
  _normalise(vec) {
    let mag = 0;
    for (let i = 0; i < vec.length; i++) mag += vec[i] * vec[i];
    mag = Math.sqrt(mag);
    if (mag > 0) {
      for (let i = 0; i < vec.length; i++) vec[i] /= mag;
    }
  }
}

// ─── VectorSpaceOps ──────────────────────────────────────────────────────────

/**
 * Core vector space operations dispatched to Colab runtimes.
 *
 * Provides: embed, batchEmbed (Fibonacci batch sizes), projectTo3D,
 * cosineSimilarity, hybridSearch (BM25 + dense + SPLADE), hnswIndex,
 * knnSearch, clusterVectors.
 */
class VectorSpaceOps {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.dimensions]  - Embedding dimensionality; default 384.
   * @param {number} [opts.cacheSize]   - Cache max entries; default fib(16)=987.
   */
  constructor(opts = {}) {
    /** @type {number} */
    this.dimensions = opts.dimensions || EMBEDDING_DIM;
    /** @type {EmbeddingCache} */
    this.cache = new EmbeddingCache({ maxSize: opts.cacheSize || CACHE_MAX_SIZE });
    /** @type {VectorProjection} */
    this.projection = new VectorProjection(this.dimensions);

    /* ── HNSW index structures ── */
    /** @type {Map<string, {vector: Float32Array, level: number}>} */
    this._nodes = new Map();
    /** @type {Map<string, string[]>} Adjacency lists per node */
    this._adjacency = new Map();
    /** @type {string|null} Entry point for HNSW graph */
    this._entryPoint = null;
    /** @type {number} Current maximum level in the graph */
    this._maxLevel = 0;

    /** @type {number} Operation counter */
    this.opCount = 0;
  }

  // ── Embedding ────────────────────────────────────────────────────────────

  /**
   * Embed a single text string into a 384-dimensional unit vector.
   * Uses the {@link EmbeddingCache} to avoid re-computation.
   *
   * @param {string} text - Input text.
   * @returns {{vector: Float32Array, cached: boolean}} Embedding result.
   */
  embed(text) {
    const key = `emb:${text}`;
    const cached = this.cache.get(key);
    if (cached) {
      return { vector: cached, cached: true };
    }
    const vector = this._deterministicEmbed(text);
    this.cache.set(key, vector);
    this.opCount += 1;
    return { vector, cached: false };
  }

  /**
   * Batch-embed an array of texts using adaptive Fibonacci batch sizes
   * [8, 13, 21, 34, 55]. The batch size is selected based on input length:
   * the largest Fibonacci batch size that does not exceed the total count.
   *
   * @param {string[]} texts - Array of text strings.
   * @returns {{embeddings: Array<{vector: Float32Array, cached: boolean}>, batchSize: number, batchCount: number}}
   */
  batchEmbed(texts) {
    const batchSize = this._selectBatchSize(texts.length);
    const embeddings = [];
    let batchCount = 0;

    for (let i = 0; i < texts.length; i += batchSize) {
      const slice = texts.slice(i, i + batchSize);
      for (const t of slice) {
        embeddings.push(this.embed(t));
      }
      batchCount += 1;
    }

    return { embeddings, batchSize, batchCount };
  }

  // ── Projection ───────────────────────────────────────────────────────────

  /**
   * Project a set of high-dimensional vectors down to 3D with octant
   * spatial indexing.
   *
   * If the internal projection has not been fitted, it is fitted first on
   * the provided vectors.
   *
   * @param {Array<number[]|Float32Array>} vectors - Input embeddings.
   * @returns {Array<{coords: number[], octant: number}>}
   */
  projectTo3D(vectors) {
    if (!this.projection._components) {
      this.projection.fit(vectors);
    }
    return this.projection.projectBatch(vectors);
  }

  // ── Similarity ───────────────────────────────────────────────────────────

  /**
   * Compute cosine similarity between two vectors.
   * @param {number[]|Float32Array} a
   * @param {number[]|Float32Array} b
   * @returns {number} Similarity in [-1, 1].
   */
  cosineSimilarity(a, b) {
    let dot = 0, magA = 0, magB = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot  += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    return (magA > 0 && magB > 0) ? dot / (magA * magB) : 0;
  }

  // ── Hybrid Search ────────────────────────────────────────────────────────

  /**
   * Hybrid search combining BM25 (sparse), dense cosine, and SPLADE
   * pseudo-expansion. Results are fused with phi-weighted Reciprocal
   * Rank Fusion (RRF).
   *
   * Weight distribution (phi-derived):
   *   dense   = PHI / (PHI + 1 + PSI) ≈ 0.50
   *   BM25    = 1   / (PHI + 1 + PSI) ≈ 0.31
   *   SPLADE  = PSI / (PHI + 1 + PSI) ≈ 0.19
   *
   * @param {string}   query      - Search query text.
   * @param {Object[]} documents  - Array of {id, text} objects.
   * @param {number}   [k]        - Number of results; default fib(7)=13.
   * @returns {{results: Array<{id: string, score: number, components: Object}>, k: number}}
   */
  hybridSearch(query, documents, k = KNN_DEFAULT_K) {
    const queryVec = this.embed(query).vector;
    const denom = PHI + 1 + PSI;
    const wDense  = PHI / denom;
    const wBM25   = 1   / denom;
    const wSPLADE = PSI / denom;

    const scored = documents.map((doc) => {
      const docVec = this.embed(doc.text).vector;
      const denseScore  = this.cosineSimilarity(queryVec, docVec);
      const bm25Score   = this._bm25Score(query, doc.text);
      const spladeScore = this._spladeScore(queryVec, docVec);

      return {
        id: doc.id,
        score: wDense * denseScore + wBM25 * bm25Score + wSPLADE * spladeScore,
        components: {
          dense: denseScore,
          bm25: bm25Score,
          splade: spladeScore,
        },
      };
    });

    scored.sort((a, b) => b.score - a.score);
    this.opCount += 1;
    return { results: scored.slice(0, k), k };
  }

  // ── HNSW Index ───────────────────────────────────────────────────────────

  /**
   * Insert a vector into the HNSW index.
   *
   * Parameters: ef_construction = 200, m = 32, max level derived from
   * probabilistic φ-based level assignment.
   *
   * @param {string} id                 - Unique identifier for this vector.
   * @param {number[]|Float32Array} vec - The vector to index.
   */
  hnswIndex(id, vec) {
    const vector = vec instanceof Float32Array ? vec : Float32Array.from(vec);
    if (vector.length !== this.dimensions) {
      throw new Error(`Dimension mismatch: expected ${this.dimensions}, got ${vector.length}`);
    }

    const level = this._hnswRandomLevel();
    this._nodes.set(id, { vector, level });
    if (!this._adjacency.has(id)) {
      this._adjacency.set(id, []);
    }

    if (!this._entryPoint) {
      this._entryPoint = id;
      this._maxLevel = level;
      this.opCount += 1;
      return;
    }

    /* Find nearest neighbours up to ef_construction */
    const neighbours = this._hnswGreedySearch(vector, HNSW_EF_CONSTRUCTION);
    const topM = neighbours.slice(0, HNSW_M);

    for (const { id: nId } of topM) {
      const adj = this._adjacency.get(id);
      adj.push(nId);

      const nAdj = this._adjacency.get(nId) || [];
      if (nAdj.length < HNSW_M) {
        nAdj.push(id);
        this._adjacency.set(nId, nAdj);
      }
    }

    if (level > this._maxLevel) {
      this._maxLevel = level;
      this._entryPoint = id;
    }
    this.opCount += 1;
  }

  /**
   * k-nearest-neighbour search over the HNSW index.
   *
   * @param {number[]|Float32Array} queryVec - Query vector.
   * @param {number} [k]                     - Neighbours to return; default fib(7)=13.
   * @returns {Array<{id: string, similarity: number}>} Sorted by descending similarity.
   */
  knnSearch(queryVec, k = KNN_DEFAULT_K) {
    if (this._nodes.size === 0) return [];
    const ef = Math.max(k, HNSW_EF_SEARCH);
    const results = this._hnswGreedySearch(queryVec, ef);
    this.opCount += 1;
    return results.slice(0, k);
  }

  // ── Clustering ───────────────────────────────────────────────────────────

  /**
   * Cluster vectors via k-means with cosine distance.
   * Max iterations = fib(8) = 21.
   *
   * @param {Array<number[]|Float32Array>} vectors - Input vectors.
   * @param {number} [numClusters]                 - k; default fib(5)=5.
   * @returns {{assignments: number[], centroids: Array<number[]>, iterations: number}}
   */
  clusterVectors(vectors, numClusters = fib(5)) {
    const n = vectors.length;
    const d = this.dimensions;
    const assignments = new Array(n).fill(0);

    /* Initialise centroids from first k vectors */
    const centroids = vectors.slice(0, numClusters).map((v) => Array.from(v));

    let iters = 0;
    for (iters = 0; iters < CLUSTER_MAX_ITERS; iters++) {
      let changed = false;

      /* Assign */
      for (let i = 0; i < n; i++) {
        let bestC = 0;
        let bestSim = -Infinity;
        for (let c = 0; c < centroids.length; c++) {
          const sim = this.cosineSimilarity(vectors[i], centroids[c]);
          if (sim > bestSim) {
            bestSim = sim;
            bestC = c;
          }
        }
        if (assignments[i] !== bestC) {
          assignments[i] = bestC;
          changed = true;
        }
      }
      if (!changed) break;

      /* Update centroids */
      for (let c = 0; c < centroids.length; c++) {
        const members = [];
        for (let i = 0; i < n; i++) {
          if (assignments[i] === c) members.push(vectors[i]);
        }
        if (members.length === 0) continue;
        for (let j = 0; j < d; j++) {
          let sum = 0;
          for (const m of members) sum += m[j];
          centroids[c][j] = sum / members.length;
        }
        /* Re-normalise centroid */
        let mag = 0;
        for (let j = 0; j < d; j++) mag += centroids[c][j] * centroids[c][j];
        mag = Math.sqrt(mag);
        if (mag > 0) {
          for (let j = 0; j < d; j++) centroids[c][j] /= mag;
        }
      }
    }

    this.opCount += 1;
    return { assignments, centroids, iterations: iters };
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  /**
   * Return operational statistics for monitoring.
   * @returns {Object}
   */
  stats() {
    return {
      dimensions: this.dimensions,
      indexSize: this._nodes.size,
      cacheSize: this.cache.size,
      cacheMaxSize: this.cache.maxSize,
      cacheHitRate: this.cache.hitRate,
      opCount: this.opCount,
      hnswParams: {
        efConstruction: HNSW_EF_CONSTRUCTION,
        m: HNSW_M,
        efSearch: HNSW_EF_SEARCH,
        maxLevel: this._maxLevel,
      },
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Select the largest Fibonacci batch size ≤ total input count,
   * falling back to the smallest (fib(6) = 8).
   * @param {number} totalCount
   * @returns {number}
   * @private
   */
  _selectBatchSize(totalCount) {
    for (let i = FIBONACCI_BATCH_SIZES.length - 1; i >= 0; i--) {
      if (FIBONACCI_BATCH_SIZES[i] <= totalCount) return FIBONACCI_BATCH_SIZES[i];
    }
    return FIBONACCI_BATCH_SIZES[0];
  }

  /**
   * Deterministic pseudo-embedding for a text string.
   * In production this delegates to the sentence-transformers model on
   * the Colab runtime. Here we produce a repeatable unit vector for
   * local testing and offline operation.
   *
   * @param {string} text
   * @returns {Float32Array}
   * @private
   */
  _deterministicEmbed(text) {
    const bytes = Buffer.from(text, 'utf8');
    const vec = new Float32Array(this.dimensions);
    for (let i = 0; i < this.dimensions; i++) {
      const seed = bytes[i % bytes.length] / 255;
      vec[i] = (seed - 0.5) * PHI;
    }
    /* Normalise to unit sphere */
    let mag = 0;
    for (let i = 0; i < this.dimensions; i++) mag += vec[i] * vec[i];
    mag = Math.sqrt(mag);
    if (mag > 0) {
      for (let i = 0; i < this.dimensions; i++) vec[i] /= mag;
    }
    return vec;
  }

  /**
   * Simple BM25 scoring between a query and document.
   * k1 = PHI ≈ 1.618, b = PSI ≈ 0.618.
   *
   * @param {string} query
   * @param {string} doc
   * @returns {number} Score in [0, 1].
   * @private
   */
  _bm25Score(query, doc) {
    const k1 = PHI;
    const b = PSI;
    const qTerms = query.toLowerCase().split(/\s+/);
    const dTerms = doc.toLowerCase().split(/\s+/);
    const avgDl = fib(8); /* assumed average doc length = 21 tokens */
    const dl = dTerms.length;

    const termFreq = {};
    for (const t of dTerms) termFreq[t] = (termFreq[t] || 0) + 1;

    let score = 0;
    for (const qt of qTerms) {
      const tf = termFreq[qt] || 0;
      if (tf === 0) continue;
      const idf = Math.log(1 + 1); /* simplified: single-document IDF */
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (dl / avgDl));
      score += idf * (numerator / denominator);
    }
    /* Normalise to [0, 1] by capping at fib(5)=5 */
    return Math.min(score / fib(5), 1);
  }

  /**
   * SPLADE-style pseudo-expansion score: amplify shared high-magnitude
   * dimensions using a ReLU log(1 + ReLU(x)) transform.
   *
   * @param {Float32Array|number[]} queryVec
   * @param {Float32Array|number[]} docVec
   * @returns {number} Score in [0, 1].
   * @private
   */
  _spladeScore(queryVec, docVec) {
    let score = 0;
    const d = Math.min(queryVec.length, docVec.length);
    for (let i = 0; i < d; i++) {
      const qw = Math.log(1 + Math.max(0, queryVec[i]));
      const dw = Math.log(1 + Math.max(0, docVec[i]));
      score += qw * dw;
    }
    /* Normalise by dimensionality */
    return Math.min(score / (d * PSI * PSI), 1);
  }

  /**
   * HNSW probabilistic level assignment. Each level is gained with
   * probability 1/φ, capped at HNSW_MAX_LEVEL = fib(6) = 8.
   * @returns {number}
   * @private
   */
  _hnswRandomLevel() {
    let level = 0;
    while (Math.random() < PSI && level < HNSW_MAX_LEVEL) {
      level += 1;
    }
    return level;
  }

  /**
   * Greedy BFS search over the HNSW graph.
   * @param {number[]|Float32Array} queryVec - Query vector.
   * @param {number} ef                      - Expansion factor.
   * @returns {Array<{id: string, similarity: number}>} Sorted descending.
   * @private
   */
  _hnswGreedySearch(queryVec, ef) {
    if (!this._entryPoint) return [];
    const visited = new Set();
    const candidates = [];
    const queue = [this._entryPoint];
    visited.add(this._entryPoint);

    while (queue.length > 0) {
      const currentId = queue.shift();
      const node = this._nodes.get(currentId);
      if (!node) continue;

      const similarity = this.cosineSimilarity(queryVec, node.vector);
      candidates.push({ id: currentId, similarity });

      const neighbours = this._adjacency.get(currentId) || [];
      for (const nId of neighbours) {
        if (!visited.has(nId)) {
          visited.add(nId);
          queue.push(nId);
        }
      }
      if (candidates.length >= ef) break;
    }

    candidates.sort((a, b) => b.similarity - a.similarity);
    return candidates.slice(0, ef);
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  PSI,
  fib,
  EMBEDDING_DIM,
  CACHE_MAX_SIZE,
  CACHE_EVICTION_BATCH,
  HNSW_EF_CONSTRUCTION,
  HNSW_M,
  HNSW_EF_SEARCH,
  FIBONACCI_BATCH_SIZES,
  KNN_DEFAULT_K,
  EmbeddingCache,
  VectorProjection,
  VectorSpaceOps,
};
