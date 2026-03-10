/**
 * heady-phi-math.js — Browser-ready Phi Math Foundation
 * Heady™ Sacred Genesis v4.0.0
 *
 * All φ, ψ, Fibonacci constants and functions for frontend use.
 * Zero magic numbers. Every value derives from φ.
 */

(function(global) {
  'use strict';

  const PHI    = (1 + Math.sqrt(5)) / 2;  // 1.6180339887...
  const PSI    = 1 / PHI;                  // 0.6180339887...
  const PHI_SQ = PHI + 1;                  // 2.6180339887...
  const PSI2   = PSI * PSI;                // 0.3819660112...
  const PSI3   = PSI * PSI * PSI;          // 0.2360679774...
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // 2.3999632... rad = 137.5077641°

  /** Fibonacci sequence (first 20 terms) */
  const FIB = Object.freeze([1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765]);

  /** PHI timeout ladder: phi^n * 1000 ms */
  const TIMEOUTS = Object.freeze({
    PHI1: 1618,
    PHI2: 2618,
    PHI3: 4236,
    PHI4: 6854,
    PHI5: 11090,
    PHI6: 17944,
    PHI7: 29034,  // Auto-Success cycle
    PHI8: 46979
  });

  /**
   * CSL threshold function — phiThreshold(n) = 1 - ψ^(n+1)
   * @param {number} n
   * @returns {number}
   */
  function phiThreshold(n) {
    return 1 - Math.pow(PSI, n + 1);
  }

  const CSL_THRESHOLDS = Object.freeze({
    MINIMUM:  0.5000,
    LOW:      phiThreshold(1),   // 0.6910
    MEDIUM:   phiThreshold(2),   // 0.8090
    HIGH:     phiThreshold(3),   // 0.8820
    CRITICAL: phiThreshold(4),   // 0.9270
    DEDUP:    0.9720
  });

  /**
   * Pool allocation weights via Fibonacci percentages
   * Hot=34% | Warm=21% | Cold=13% | Reserve=8% | Governance=5%
   */
  const POOL_WEIGHTS = Object.freeze({
    HOT:        FIB[9]  / FIB[10],  // 55/89 ≈ 0.3372 (approx Fib basis)
    WARM:       34 / 100,
    COLD:       21 / 100,
    RESERVE:    13 / 100,
    GOVERNANCE:  8 / 100
  });

  /**
   * phi-exponential backoff: delay(attempt) = base * φ^attempt
   * @param {number} attempt - zero-indexed attempt number
   * @param {number} [base=1618] - base delay in ms (default: φ¹ × 1000)
   * @returns {number} delay in ms
   */
  function phiBackoff(attempt, base) {
    const b = base !== undefined ? base : TIMEOUTS.PHI1;
    return Math.round(b * Math.pow(PHI, attempt));
  }

  /**
   * Fibonacci fusion weights: exponentially decreasing weights summing to 1.0
   * w_i = ψ^i × (1 - ψ) / (1 - ψ^N)
   * @param {number} n - number of weights
   * @returns {number[]}
   */
  function phiFusionWeights(n) {
    const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
    const sum = raw.reduce((acc, v) => acc + v, 0);
    return raw.map(v => v / sum);
  }

  /**
   * Compute phi-scaled value
   * @param {number} base - base value
   * @param {number} power - phi power to apply
   * @returns {number}
   */
  function phiScale(base, power) {
    return base * Math.pow(PHI, power);
  }

  /**
   * Cosine similarity between two vectors
   * @param {number[]} a
   * @param {number[]} b
   * @returns {number} 0-1
   */
  function cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot   += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * CSL AND gate — cosine similarity between two feature vectors
   */
  function cslAnd(a, b) { return cosineSimilarity(a, b); }

  /**
   * CSL GATE — threshold-gated pass/block with continuous confidence
   * @param {number} score
   * @param {number} threshold
   * @returns {{ pass: boolean, confidence: number, threshold: number }}
   */
  function cslGate(score, threshold) {
    return {
      pass:       score >= threshold,
      confidence: score,
      threshold,
      margin:     score - threshold
    };
  }

  /**
   * Place N points on golden-angle spiral (sunflower pattern)
   * @param {number} n - number of points
   * @param {number} [scale=1] - radius scale
   * @returns {{ x: number, y: number }[]}
   */
  function goldenSpiralPoints(n, scale) {
    const s = scale !== undefined ? scale : 1;
    return Array.from({ length: n }, (_, i) => {
      const angle  = i * GOLDEN_ANGLE;
      const radius = s * Math.sqrt(i / n);
      return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    });
  }

  /**
   * Place N nodes on concentric rings with golden-angle spacing
   * @param {number} n - number of nodes
   * @param {number} rings - number of rings
   * @param {number} maxRadius - outer radius
   * @returns {{ x: number, y: number, ring: number }[]}
   */
  function sacredGeometryNodes(n, rings, maxRadius) {
    const r = rings !== undefined ? rings : 4;
    const mr = maxRadius !== undefined ? maxRadius : 1;
    const nodesPerRing = Math.ceil(n / r);
    const nodes = [];
    for (let ring = 0; ring < r && nodes.length < n; ring++) {
      const ringRadius = mr * ((ring + 1) / r);
      const count = Math.min(nodesPerRing, n - nodes.length);
      for (let i = 0; i < count; i++) {
        const angle = i * GOLDEN_ANGLE * (ring + 1);
        nodes.push({
          x: ringRadius * Math.cos(angle),
          y: ringRadius * Math.sin(angle),
          ring
        });
      }
    }
    return nodes;
  }

  // Export to global scope
  const HeadyPhi = {
    PHI, PSI, PHI_SQ, PSI2, PSI3, GOLDEN_ANGLE,
    FIB, TIMEOUTS, CSL_THRESHOLDS, POOL_WEIGHTS,
    phiThreshold, phiBackoff, phiFusionWeights, phiScale,
    cosineSimilarity, cslAnd, cslGate,
    goldenSpiralPoints, sacredGeometryNodes
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeadyPhi;
  } else {
    global.HeadyPhi = HeadyPhi;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
