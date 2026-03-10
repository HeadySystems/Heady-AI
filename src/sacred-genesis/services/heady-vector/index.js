/**
 * @fileoverview heady-vector — Vector space operations — cosine similarity, superposition, projection, HNSW search
 * @module heady-vector
 * @version 4.0.0
 * @port 3317
 * @domain memory
 *
 * Heady™ Latent OS — Sacred Geometry v4.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — All Rights Reserved
 */

'use strict';

const { LiquidNodeBase, CSL_THRESHOLDS, PHI, PSI, PSI2, FIB, fib, phiThreshold, phiBackoff, correlationId } = require('../../shared/liquid-node-base');
const { ServiceMesh, SERVICE_CATALOG, DOMAIN_SWARMS } = require('../../shared/service-mesh');

const mesh = ServiceMesh.instance();

class HeadyVector extends LiquidNodeBase {
  constructor() {
    super({
      name: 'heady-vector',
      port: 3317,
      domain: 'memory',
      description: 'Vector space operations — cosine, superposition, projection, HNSW search',
      pool: 'hot',
      dependencies: ['heady-embed', 'heady-memory'],
    });
  }

  async onStart() {
    // POST /cosine — compute cosine similarity
    this.route('POST', '/cosine', async (req, res, ctx) => {
      const { a, b } = ctx.body || {};
      if (!a || !b) return this.sendError(res, 400, 'Missing vectors a and b', 'MISSING_VECTORS');
      const score = this.cosineSimilarity(a, b);
      this.json(res, 200, {
        similarity: score,
        interpretation: score >= CSL_THRESHOLDS.HIGH ? 'strongly_aligned'
          : score >= CSL_THRESHOLDS.MEDIUM ? 'moderately_aligned'
          : score >= CSL_THRESHOLDS.LOW ? 'weakly_aligned'
          : score >= CSL_THRESHOLDS.MINIMUM ? 'marginally_related'
          : 'unrelated',
        thresholds: CSL_THRESHOLDS,
      });
    });

    // POST /superposition — CSL OR (vector addition + normalize)
    this.route('POST', '/superposition', async (req, res, ctx) => {
      const { vectors, weights } = ctx.body || {};
      if (!vectors || !Array.isArray(vectors) || vectors.length < 2) {
        return this.sendError(res, 400, 'Need at least 2 vectors', 'INSUFFICIENT_VECTORS');
      }
      const dim = vectors[0].length;
      const result = new Array(dim).fill(0);
      for (let v = 0; v < vectors.length; v++) {
        const w = weights ? (weights[v] || 1) : 1;
        for (let i = 0; i < dim; i++) {
          result[i] += vectors[v][i] * w;
        }
      }
      let mag = 0;
      for (let i = 0; i < dim; i++) mag += result[i] * result[i];
      mag = Math.sqrt(mag);
      if (mag > 0) for (let i = 0; i < dim; i++) result[i] /= mag;
      this.json(res, 200, { vector: result, dimension: dim, inputCount: vectors.length });
    });

    // POST /negate — CSL NOT (orthogonal projection)
    this.route('POST', '/negate', async (req, res, ctx) => {
      const { a, b } = ctx.body || {};
      if (!a || !b) return this.sendError(res, 400, 'Missing vectors a and b', 'MISSING_VECTORS');
      let dot = 0, magB = 0;
      for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magB += b[i] * b[i]; }
      const scale = magB > 0 ? dot / magB : 0;
      const result = a.map((v, i) => v - scale * b[i]);
      let mag = 0;
      for (let i = 0; i < result.length; i++) mag += result[i] * result[i];
      mag = Math.sqrt(mag);
      if (mag > 0) for (let i = 0; i < result.length; i++) result[i] /= mag;
      this.json(res, 200, { vector: result, dimension: result.length, operation: 'CSL_NOT' });
    });

    // POST /gate — CSL sigmoid gate
    this.route('POST', '/gate', async (req, res, ctx) => {
      const { value, gateVector, inputVector, threshold, temperature } = ctx.body || {};
      if (!inputVector || !gateVector) return this.sendError(res, 400, 'Missing inputVector and gateVector', 'MISSING_VECTORS');
      const cosScore = this.cosineSimilarity(inputVector, gateVector);
      const tau = threshold || CSL_THRESHOLDS.MEDIUM;
      const temp = temperature || (PSI * PSI * PSI); // ≈0.236
      const sigmoid = 1 / (1 + Math.exp(-(cosScore - tau) / temp));
      const gatedValue = (value || 1) * sigmoid;
      this.json(res, 200, { cosScore, sigmoid, gatedValue, threshold: tau, temperature: temp });
    });

    // GET /dimension — supported dimensions
    this.route('GET', '/dimension', async (req, res, ctx) => {
      this.json(res, 200, { primary: 384, supported: [384, 768, 1536], hnswM: fib(8), efConstruct: fib(12), efSearch: fib(11) });
    });

    this.log.info('HeadyVector space operations initialized');
  }
}

new HeadyVector().start();
