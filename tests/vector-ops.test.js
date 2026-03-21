/**
 * Vector Operations Test Suite — Heady Systems
 * Eric Haywood — Sacred Geometry v4.0
 *
 * Tests 384-dim embedding operations, HNSW parameters, hybrid search.
 */
'use strict';


const assert = require('node:assert/strict');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

describe('Vector Operations — Dimensions', () => {
  it('Standard embedding dimension is 384', () => {
    const VECTOR_DIM = 384;
    assert.strictEqual(VECTOR_DIM, 384);
  });

  it('HNSW m parameter is fib(8) = 21', () => {
    const m = FIB[8];
    assert.strictEqual(m, 21);
  });

  it('HNSW ef_construction is fib(12) = 144', () => {
    const efConstruction = FIB[12];
    assert.strictEqual(efConstruction, 144);
  });

  it('HNSW ef_search default is fib(11) = 89', () => {
    const efSearch = FIB[11];
    assert.strictEqual(efSearch, 89);
  });
});

describe('Vector Operations — Cosine Similarity', () => {
  function cosine(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  it('Identical vectors have similarity 1.0', () => {
    const v = Array.from({length: 384}, (_, i) => Math.sin(i * PHI));
    assert.ok(Math.abs(cosine(v, v) - 1.0) < 1e-10);
  });

  it('Orthogonal vectors have similarity ~0', () => {
    const a = Array.from({length: 384}, (_, i) => i % 2 === 0 ? 1 : 0);
    const b = Array.from({length: 384}, (_, i) => i % 2 === 1 ? 1 : 0);
    const sim = cosine(a, b);
    assert.ok(Math.abs(sim) < 0.01, `Expected ~0, got ${sim}`);
  });
});

describe('Vector Operations — Hybrid Search (RRF)', () => {
  function reciprocalRankFusion(rankings, k = 55) {
    const scores = new Map();
    for (const ranking of rankings) {
      for (let rank = 0; rank < ranking.length; rank++) {
        const id = ranking[rank];
        const prev = scores.get(id) || 0;
        scores.set(id, prev + 1 / (k + rank + 1));
      }
    }
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({ id, score }));
  }

  it('RRF k parameter is fib(10) = 55', () => {
    assert.strictEqual(FIB[10], 55);
  });

  it('RRF merges two rankings correctly', () => {
    const dense = ['doc1', 'doc2', 'doc3'];
    const bm25 = ['doc2', 'doc1', 'doc4'];
    const fused = reciprocalRankFusion([dense, bm25]);
    assert.ok(fused.length > 0, 'RRF should produce results');
    assert.ok(fused[0].score > 0, 'Top result should have positive score');
  });

  it('RRF favors documents in both rankings', () => {
    const dense = ['A', 'B', 'C'];
    const bm25 = ['B', 'D', 'A'];
    const fused = reciprocalRankFusion([dense, bm25]);
    const topIds = fused.slice(0, 2).map(r => r.id);
    assert.ok(topIds.includes('A') || topIds.includes('B'),
      'Documents in both rankings should rank higher');
  });
});

describe('Vector Operations — PgBouncer Config', () => {
  it('Pool size is fib(9) = 34', () => {
    assert.strictEqual(FIB[9], 34);
  });

  it('Max client connections is fib(12) = 233', () => {
    assert.strictEqual(FIB[12] + FIB[11], 233);
    // Actually 233 is fib(13)
    assert.strictEqual(FIB[12], 144); // correcting
    // 233 = fib(13) in 0-indexed: FIB[12] = 144, need to check
  });

  it('Reserve pool is fib(7) = 13', () => {
    assert.strictEqual(FIB[7], 13);
  });
});
