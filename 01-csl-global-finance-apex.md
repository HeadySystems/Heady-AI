# Heady™ Global CSL Gate Integration + Apex Trading Intelligence

## Foundation
All changes are based on the HeadyMe repos and Heady project data. The actual source code for every referenced file is provided below.

## Objective
Replace ALL ternary logic throughout the Heady codebase with Continuous Semantic Logic (CSL) gates. Ternary logic (true/false/unknown) uses discrete branching — CSL uses continuous geometric operations on the phi scale (φ = 1.6180339887) for confidence scoring, producing richer decision signals.

**Priority domain: Finance & Apex Trading Intelligence** — replace ternary risk gates with CSL confidence-weighted continuous risk scoring for position sizing, entry/exit decisions, and portfolio risk management.

## Specific Deliverables — Build ALL Files

### 1. Core CSL Engine Enhancement
- Extend `csl-engine.js` with new gate methods: `cslAnd()`, `cslOr()`, `cslNot()`, `cslXor()`, `cslImplies()`, `cslEquivalent()`
- Each gate operates on continuous [0,1] confidence values, not boolean
- Phi-scaled thresholds: EXECUTE > 0.618, CAUTIOUS ∈ [0.382, 0.618), HALT < 0.382
- Geometric mean weighting instead of arithmetic for multi-signal fusion

### 2. Ternary → CSL Migration
- `core/ternary-logic.js` (727 lines) → identify all ternary patterns (TRUE/FALSE/UNKNOWN branching)
- `orchestration/ternary-logic.js` (312 lines) → replace with CSL continuous scoring
- Build a `ternary-to-csl-migrator.js` that automatically converts ternary patterns to CSL equivalents
- Document every conversion with before/after examples

### 3. Apex Trading Intelligence — CSL Risk Gates
- `trading/apex-risk-agent.js` (284 lines) → replace ternary risk gates with:
  - `cslRiskScore(position)` — continuous risk ∈ [0,1], not boolean safe/unsafe
  - `cslPositionSize(confidence, risk)` — phi-scaled position sizing
  - `cslEntryGate(signal)` — CSL confidence > φ⁻¹ to enter, < φ⁻² to halt
  - `cslExitGate(position)` — CSL continuous exit scoring with trailing confidence
  - `cslPortfolioRisk(positions[])` — geometric mean portfolio risk, not max()
- `trading-bee.js` → CSL-gated task routing for trading operations
- `trading-tasks.js` → CSL confidence scoring on each trading task

### 4. Global Service Integration
- Every service that currently uses `if/else` boolean gates → wrap with `cslGate(confidence, action)`
- `csl-service-integration.js` → expand to cover ALL services
- `csl-routes.js` → expose CSL analytics API endpoints
- `moe-csl-router.js` → CSL-weighted Mixture of Experts routing

### 5. Monte Carlo + VSA Integration
- `monte-carlo-engine-csl.js` → CSL confidence-weighted MC simulations for trading
- `vsa-csl-bridge.js` → Vector Symbolic Architecture with CSL gate binding

### 6. Test Suite
- Unit tests for every new CSL gate method
- Integration tests: ternary → CSL migration correctness
- Trading-specific tests: risk scoring, position sizing, entry/exit gates
- Determinism tests: same input → same CSL confidence output

## Constraints
- ALL constants derive from φ = 1.6180339887
- SHA-256 for output hashing and determinism verification
- Temperature = 0, seed = 42 for deterministic execution
- Node.js only — crypto, events modules, no external deps
- Before/after for every ternary → CSL conversion

---

## SOURCE FILES — COMPLETE HEADY CODEBASE CONTEXT


### `src/core/ternary-logic.js`

```javascript
/**
 * @fileoverview Ternary Logic Engine
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Implements ternary logic for uncertainty representation in CSL systems.
 * Cosine similarity's native range [-1, +1] maps perfectly to the ternary
 * truth domain: FALSE (-1), UNKNOWN (0), TRUE (+1).
 *
 * Supported Logic Systems:
 *   - Kleene K3 (Strong Logic of Indeterminacy): min/max/negation
 *   - Łukasiewicz Ł3: bounded sum operations, implication-aware
 *   - Gödel G3: min/max with strong negation
 *   - Product Logic: multiplication-based t-norms
 *   - CSL Continuous: direct cosine-based operations without discretization
 *
 * The CSL system naturally implements continuous ternary logic because:
 *   cos(θ) → +1  ≡ TRUE  (perfectly aligned vectors)
 *   cos(θ) → 0   ≡ UNKNOWN (orthogonal vectors — no relationship)
 *   cos(θ) → -1  ≡ FALSE (antipodal vectors — contradiction)
 *
 * References:
 *   - Łukasiewicz (1920): Three-valued logic for future contingents
 *   - Kleene (1952): Strong logic of indeterminacy
 *   - Wikipedia: Three-valued logic — truth tables
 *   - Fagin, Riegel, Gray (2024): "Foundations of reasoning with uncertainty" — PNAS
 *   - Open Logic Project: Three-valued Logics PDF
 *
 * @module ternary-logic
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL/ternary techniques
 */

'use strict';

const { CSL_THRESHOLDS, PHI_TEMPERATURE } = require('../../shared/phi-math.js');
const { CSLEngine, norm, normalize, dot, clamp, EPSILON } = require('../engine/csl-engine');

// ─── Ternary Value Constants ──────────────────────────────────────────────────

/**
 * Ternary truth value constants.
 *
 * Mapped to the cosine similarity range [-1, +1]:
 *   TRUE    = +1.0  → perfectly aligned vectors
 *   UNKNOWN =  0.0  → orthogonal vectors (no information)
 *   FALSE   = -1.0  → antipodal vectors (contradiction)
 */
const TERNARY = {
  TRUE:    1.0,
  UNKNOWN: 0.0,
  FALSE:  -1.0,
};

/** Threshold above which a value is classified as TRUE.
 * CSL_THRESHOLDS.MINIMUM ≈ 0.500 — phi-harmonic noise floor for truth activation. */
const TRUE_THRESHOLD = CSL_THRESHOLDS.MINIMUM; // ≈ 0.500 (CSL noise floor)

/** Threshold below which a value is classified as FALSE.
 * -CSL_THRESHOLDS.MINIMUM ≈ -0.500 — symmetric phi-harmonic false floor. */
const FALSE_THRESHOLD = -CSL_THRESHOLDS.MINIMUM; // ≈ -0.500 (CSL noise floor negated)

/** The width of the UNKNOWN zone: (-CSL_THRESHOLDS.MINIMUM, +CSL_THRESHOLDS.MINIMUM).
 * Symmetric around 0 using the phi-harmonic noise floor threshold. */
const UNKNOWN_ZONE = TRUE_THRESHOLD; // symmetric (CSL_THRESHOLDS.MINIMUM ≈ 0.500)

// ─── Discretization Helpers ───────────────────────────────────────────────────

/**
 * Map a continuous cosine value to a discrete ternary symbol.
 *
 * @param {number} x - Continuous value ∈ [-1, +1]
 * @param {number} [trueThreshold=0.5]
 * @param {number} [falseThreshold=-0.5]
 * @returns {'TRUE'|'UNKNOWN'|'FALSE'}
 */
function toTernarySymbol(x, trueThreshold = TRUE_THRESHOLD, falseThreshold = FALSE_THRESHOLD) {
  if (x >= trueThreshold) return 'TRUE';
  if (x <= falseThreshold) return 'FALSE';
  return 'UNKNOWN';
}

/**
 * Map a ternary symbol to its continuous representation.
 *
 * @param {'TRUE'|'UNKNOWN'|'FALSE'} symbol
 * @returns {number} ∈ {+1, 0, -1}
 */
function fromTernarySymbol(symbol) {
  switch (symbol) {
    case 'TRUE':    return TERNARY.TRUE;
    case 'UNKNOWN': return TERNARY.UNKNOWN;
    case 'FALSE':   return TERNARY.FALSE;
    default: throw new Error(`Unknown ternary symbol: ${symbol}`);
  }
}

// ─── TernaryLogicEngine Class ─────────────────────────────────────────────────

/**
 * TernaryLogicEngine — Continuous and discrete ternary logic operations.
 *
 * Provides all Kleene K3, Łukasiewicz Ł3, and CSL-continuous operations.
 * Works with both scalar values (from cosine similarity) and vector pairs
 * (computing similarity first).
 *
 * Integration with CSL gates:
 *   - CSLEngine.AND(a, b) → feed result to ternary operations
 *   - TernaryLogicEngine applies ternary operations to cosine values
 *   - Final values can be discretized to {TRUE, UNKNOWN, FALSE}
 *
 * @class
 * @example
 * const ternary = new TernaryLogicEngine({ mode: 'kleene' });
 * const engine = new CSLEngine({ dim: 384 });
 * const cosAB = engine.AND(vectorA, vectorB);  // ∈ [-1,+1]
 * const cosCD = engine.AND(vectorC, vectorD);  // ∈ [-1,+1]
 *
 * const andResult  = ternary.AND(cosAB, cosCD);  // Kleene K3 AND
 * const implResult = ternary.IMPLY(cosAB, cosCD); // Łukasiewicz implication
 * const symbol     = ternary.discretize(andResult); // → 'TRUE'|'UNKNOWN'|'FALSE'
 */
class TernaryLogicEngine {
  /**
   * @param {Object} [options]
   * @param {'kleene'|'lukasiewicz'|'godel'|'product'|'csl'} [options.mode='kleene']
   *   Logic system to use for binary operations
   * @param {number} [options.trueThreshold=0.5] - Threshold for TRUE discretization
   * @param {number} [options.falseThreshold=-0.5] - Threshold for FALSE discretization
   * @param {boolean} [options.normalizeOutput=false] - Clamp outputs to [-1,+1]
   */
  constructor(options = {}) {
    this.mode = options.mode || 'kleene';
    this.trueThreshold = options.trueThreshold !== undefined ? options.trueThreshold : TRUE_THRESHOLD;
    this.falseThreshold = options.falseThreshold !== undefined ? options.falseThreshold : FALSE_THRESHOLD;
    this.normalizeOutput = options.normalizeOutput !== false;

    this._csl = new CSLEngine();

    // Validate mode
    const validModes = ['kleene', 'lukasiewicz', 'godel', 'product', 'csl'];
    if (!validModes.includes(this.mode)) {
      throw new Error(`Unknown ternary mode: ${this.mode}. Use one of: ${validModes.join(', ')}`);
    }
  }

  // ─── Core Ternary Operations ───────────────────────────────────────────────

  /**
   * Ternary AND — Conjunction of two truth values.
   *
   * Implementations by system:
   *
   * Kleene K3 (Gödel t-norm):
   *   K3-AND(a, b) = min(a, b)
   *   Truth table: T∧T=T, T∧U=U, T∧F=F, U∧U=U, U∧F=F, F∧F=F
   *
   * Łukasiewicz (bounded sum):
   *   Ł3-AND(a, b) = max(-1, a + b - 1)   [mapped to [-1,+1] from [0,1]]
   *   Reduces to K3-AND on {-1, 0, +1}
   *
   * Gödel: same as Kleene (min)
   *
   * Product (multiplication):
   *   Prod-AND(a, b) = a · b
   *   Note: maps [-1,+1]² → [-1,+1] only if both inputs non-negative
   *
   * CSL (continuous):
   *   CSL-AND(a, b) = a · b   [product of cosine similarities]
   *   Equivalent to angular product — measures joint alignment
   *
   * Reference: Fagin et al. (2024) PNAS; Wikipedia Three-valued logic
   *
   * @param {number} a - Truth value ∈ [-1, +1]
   * @param {number} b - Truth value ∈ [-1, +1]
   * @returns {number} ∈ [-1, +1]
   */
  AND(a, b) {
    const result = this._applyAND(a, b);
    return this.normalizeOutput ? clamp(result, -1.0, 1.0) : result;
  }

  _applyAND(a, b) {
    switch (this.mode) {
      case 'kleene':
      case 'godel':
        return Math.min(a, b);

      case 'lukasiewicz':
        // Bounded difference: max(-1, a + b - 1)
        return Math.max(-1.0, a + b - 1.0);

      case 'product':
      case 'csl':
        // Product t-norm
        return a * b;

      default:
        return Math.min(a, b);
    }
  }

  /**
   * Ternary OR — Disjunction of two truth values.
   *
   * Kleene K3 (Gödel t-conorm):
   *   K3-OR(a, b) = max(a, b)
   *   Truth table: T∨T=T, T∨U=T, T∨F=T, U∨U=U, U∨F=U, F∨F=F
   *
   * Łukasiewicz (bounded sum):
   *   Ł3-OR(a, b) = min(1, a + b + 1)   [mapped to [-1,+1]]
   *
   * Product:
   *   Prod-OR(a, b) = a + b - a·b   [probabilistic sum]
   *
   * CSL:
   *   CSL-OR(a, b) = max(a, b)   [Gödel conorm for geometric values]
   *
   * @param {number} a - Truth value ∈ [-1, +1]
   * @param {number} b - Truth value ∈ [-1, +1]
   * @returns {number} ∈ [-1, +1]
   */
  OR(a, b) {
    const result = this._applyOR(a, b);
    return this.normalizeOutput ? clamp(result, -1.0, 1.0) : result;
  }

  _applyOR(a, b) {
    switch (this.mode) {
      case 'kleene':
      case 'godel':
      case 'csl':
        return Math.max(a, b);

      case 'lukasiewicz':
        // Bounded sum: min(1, a + b + 1)
        return Math.min(1.0, a + b + 1.0);

      case 'product':
        // Probabilistic sum: a + b - a·b (for values in [0,1])
        // Adapted to [-1,+1]: use scaled version
        return a + b - a * b;

      default:
        return Math.max(a, b);
    }
  }

  /**
   * Ternary NOT — Negation of a truth value.
   *
   * All systems: NOT(a) = -a   [sign flip on cosine scale]
   *   NOT(+1) = -1 (TRUE → FALSE)
   *   NOT( 0) =  0 (UNKNOWN → UNKNOWN)
   *   NOT(-1) = +1 (FALSE → TRUE)
   *
   * This is the Kleene/Łukasiewicz involution ¬a = 1 - a mapped to [-1,+1]:
   *   [0,1] version: ¬a = 1 - a
   *   [-1,+1] version: ¬a = -a    (equivalent under scaling)
   *
   * Note: Gödel logic has strong negation:
   *   G-NOT(a) = -1 if a = +1, else +1
   *   This is NOT implemented by default (strong ≠ weak negation)
   *
   * @param {number} a - Truth value ∈ [-1, +1]
   * @returns {number} ∈ [-1, +1]
   */
  NOT(a) {
    if (this.mode === 'godel') {
      // Strong Gödel negation: ¬T = F, ¬U = T, ¬F = T
      // (only T is negated to F; everything else becomes T)
      return a >= this.trueThreshold ? -1.0 : 1.0;
    }
    // Standard involution: soft NOT
    return -a;
  }

  /**
   * Ternary IMPLY — Material implication.
   *
   * Kleene K3:
   *   K3-IMPLY(a, b) = max(-a, b) = OR(NOT(a), b)
   *   = max(1-a, b) in [0,1] = max(-a, b) in [-1,+1]
   *   Truth table: T→T=T, T→U=U, T→F=F, U→T=T, U→U=U, U→F=U, F→T=T, F→U=T, F→F=T
   *
   * Łukasiewicz:
   *   Ł3-IMPLY(a, b) = min(1, 1 - a + b) in [0,1]
   *                  = min(1, -a + b + 1)   → clamp to [-1,+1]
   *   Key distinction: U→U = T (unknown implies unknown = true)
   *
   * CSL:
   *   CSL-IMPLY(a, b) = 1 - a + b (unclamped, geometric analog)
   *
   * @param {number} a - Antecedent truth value ∈ [-1, +1]
   * @param {number} b - Consequent truth value ∈ [-1, +1]
   * @returns {number} ∈ [-1, +1]
   */
  IMPLY(a, b) {
    let result;

    switch (this.mode) {
      case 'kleene':
      case 'godel':
        // K3 implication = OR(NOT(a), b)
        result = Math.max(-a, b);
        break;

      case 'lukasiewicz':
        // Ł3: min(1, 1 - a + b) → mapped: min(+1, -a + b + 1) - 1... use:
        // Standard Łukasiewicz: →(a,b) = min(1, 1-a+b) in [0,1]
        // In [-1,+1]: →(a,b) = min(1, (1-a+b+1)/2 * 2 - 1) ... simpler:
        // Transform: a_01 = (a+1)/2, b_01 = (b+1)/2
        // Ł-impl_01 = min(1, 1 - a_01 + b_01)
        // Back to [-1,+1]: result = 2*Ł-impl_01 - 1
        {
          const a01 = (a + 1.0) / 2.0;
          const b01 = (b + 1.0) / 2.0;
          const impl01 = Math.min(1.0, 1.0 - a01 + b01);
          result = 2.0 * impl01 - 1.0;
        }
        break;

      case 'product':
      case 'csl':
        // Product implication: b/a for a ≠ 0, clamped to [0,1] → [-1,+1]
        if (Math.abs(a) < EPSILON) {
          result = 1.0; // vacuous truth: false implies anything
        } else {
          result = clamp(b / Math.abs(a), -1.0, 1.0);
        }
        break;

      default:
        result = Math.max(-a, b);
    }

    return this.normalizeOutput ? clamp(result, -1.0, 1.0) : result;
  }

  /**
   * Ternary BICONDITIONAL — Equivalence of two truth values.
   *
   * Formula: BICONDITIONAL(a, b) = AND(IMPLY(a,b), IMPLY(b,a))
   *
   * @param {number} a
   * @param {number} b
   * @returns {number} ∈ [-1, +1]
   */
  BICONDITIONAL(a, b) {
    return this.AND(this.IMPLY(a, b), this.IMPLY(b, a));
  }

  /**
   * Łukasiewicz bounded AND (explicit, mode-independent).
   *
   * Formula: max(-1, a + b - 1)   [from standard Ł-t-norm: max(0, a+b-1)]
   *
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  lukasiewiczAND(a, b) {
    return clamp(Math.max(-1.0, a + b - 1.0), -1.0, 1.0);
  }

  /**
   * Łukasiewicz bounded OR (explicit, mode-independent).
   *
   * Formula: min(+1, a + b + 1)   [from standard Ł-t-conorm: min(1, a+b)]
   *
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  lukasiewiczOR(a, b) {
    return clamp(Math.min(1.0, a + b + 1.0), -1.0, 1.0);
  }

  /**
   * Kleene strong AND (explicit, mode-independent).
   *
   * Formula: min(a, b)
   *
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  kleeneAND(a, b) {
    return Math.min(a, b);
  }

  /**
   * Kleene strong OR (explicit, mode-independent).
   *
   * Formula: max(a, b)
   *
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  kleeneOR(a, b) {
    return Math.max(a, b);
  }

  // ─── Confidence Intervals ─────────────────────────────────────────────────

  /**
   * Compute a confidence interval for an UNKNOWN truth value.
   *
   * When a cosine similarity falls in the UNKNOWN zone (-0.5, +0.5),
   * the confidence interval estimates how strongly it leans toward TRUE or FALSE.
   *
   * Returns a [lower, upper] interval based on the magnitude and a noise model.
   * The interval represents the range of possible true values given measurement
   * uncertainty estimated by the noise parameter.
   *
   * @param {number} x - Cosine value ∈ [-1, +1]
   * @param {number} [noiseEstimate=0.1] - Estimated measurement noise std
   * @returns {{
   *   lower: number,   // lower bound of CI
   *   upper: number,   // upper bound of CI
   *   symbol: string,  // 'TRUE'|'UNKNOWN'|'FALSE'
   *   confidence: number, // confidence ∈ [0,1] (0.5 = maximum uncertainty)
   * }}
   */
  confidenceInterval(x, noiseEstimate = 0.1) {
    const lower = clamp(x - 1.96 * noiseEstimate, -1.0, 1.0);
    const upper = clamp(x + 1.96 * noiseEstimate, -1.0, 1.0);
    const symbol = toTernarySymbol(x, this.trueThreshold, this.falseThreshold);

    // Confidence: 0 = maximum uncertainty (x=0), 1 = certain (x=±1)
    const confidence = Math.abs(x);

    return { lower, upper, symbol, confidence };
  }

  // ─── Vector-Level Ternary Operations ─────────────────────────────────────

  /**
   * Compute ternary AND from two vector pairs.
   *
   * Computes cos(a, b) and cos(c, d) first, then applies ternary AND.
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @param {Float32Array|Float64Array|number[]} c
   * @param {Float32Array|Float64Array|number[]} d
   * @returns {{ score: number, symbol: string, confidence: number }}
   */
  vectorAND(a, b, c, d) {
    const cosAB = this._csl.AND(a, b);
    const cosCD = this._csl.AND(c, d);
    const score = this.AND(cosAB, cosCD);
    return {
      score,
      symbol: this.discretize(score),
      confidence: Math.abs(score),
      inputs: { cosAB, cosCD },
    };
  }

  /**
   * Compute ternary OR from two vector pairs.
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @param {Float32Array|Float64Array|number[]} c
   * @param {Float32Array|Float64Array|number[]} d
   * @returns {{ score: number, symbol: string, confidence: number }}
   */
  vectorOR(a, b, c, d) {
    const cosAB = this._csl.AND(a, b);
    const cosCD = this._csl.AND(c, d);
    const score = this.OR(cosAB, cosCD);
    return {
      score,
      symbol: this.discretize(score),
      confidence: Math.abs(score),
      inputs: { cosAB, cosCD },
    };
  }

  /**
   * Evaluate a ternary formula with multiple premises.
   *
   * Computes pairwise cosine similarities for all premise pairs, then applies
   * the specified reduction operation across all values.
   *
   * @param {Array<{ a: Float64Array, b: Float64Array }>} premises - Vector pairs
   * @param {'AND'|'OR'} [reduction='AND'] - How to combine premises
   * @returns {{ score: number, symbol: string, premiseScores: number[] }}
   */
  evaluateFormula(premises, reduction = 'AND') {
    const scores = premises.map(({ a, b }) => this._csl.AND(a, b));

    let combined = scores[0];
    for (let i = 1; i < scores.length; i++) {
      if (reduction === 'AND') {
        combined = this.AND(combined, scores[i]);
      } else {
        combined = this.OR(combined, scores[i]);
      }
    }

    return {
      score: combined,
      symbol: this.discretize(combined),
      premiseScores: scores,
      confidence: Math.abs(combined),
    };
  }

  // ─── Kleene K3 Truth Tables ────────────────────────────────────────────────

  /**
   * Get the full Kleene K3 truth table for AND and OR.
   *
   * Values: F=-1, U=0, T=+1
   *
   * @returns {Object} Truth tables
   */
  getKleeneTruthTable() {
    const vals = [
      { sym: 'F', val: -1.0 },
      { sym: 'U', val: 0.0 },
      { sym: 'T', val: 1.0 },
    ];

    const andTable = {};
    const orTable = {};
    const implTable = {};
    const notTable = {};

    for (const { sym: symA, val: a } of vals) {
      notTable[symA] = toTernarySymbol(-a, 0.5, -0.5);
      andTable[symA] = {};
      orTable[symA] = {};
      implTable[symA] = {};

      for (const { sym: symB, val: b } of vals) {
        const prevMode = this.mode;
        this.mode = 'kleene';

        andTable[symA][symB] = toTernarySymbol(this.AND(a, b), 0.5, -0.5);
        orTable[symA][symB]  = toTernarySymbol(this.OR(a, b), 0.5, -0.5);
        implTable[symA][symB] = toTernarySymbol(this.IMPLY(a, b), 0.5, -0.5);

        this.mode = prevMode;
      }
    }

    return { andTable, orTable, implTable, notTable };
  }

  /**
   * Get the Łukasiewicz Ł3 truth table.
   *
   * Key difference from K3: U→U = T (not U)
   *
   * @returns {Object} Truth tables
   */
  getLukasiewiczTruthTable() {
    const vals = [
      { sym: 'F', val: -1.0 },
      { sym: 'U', val: 0.0 },
      { sym: 'T', val: 1.0 },
    ];

    const andTable = {};
    const orTable = {};
    const implTable = {};

    for (const { sym: symA, val: a } of vals) {
      andTable[symA] = {};
      orTable[symA] = {};
      implTable[symA] = {};

      for (const { sym: symB, val: b } of vals) {
        const prevMode = this.mode;
        this.mode = 'lukasiewicz';

        andTable[symA][symB] = toTernarySymbol(this.AND(a, b), 0.5, -0.5);
        orTable[symA][symB] = toTernarySymbol(this.OR(a, b), 0.5, -0.5);
        implTable[symA][symB] = toTernarySymbol(this.IMPLY(a, b), 0.5, -0.5);

        this.mode = prevMode;
      }
    }

    return { andTable, orTable, implTable };
  }

  // ─── Discretization ───────────────────────────────────────────────────────

  /**
   * Discretize a continuous value to a ternary symbol.
   *
   * @param {number} x - Continuous value ∈ [-1, +1]
   * @returns {'TRUE'|'UNKNOWN'|'FALSE'}
   */
  discretize(x) {
    return toTernarySymbol(x, this.trueThreshold, this.falseThreshold);
  }

  /**
   * Discretize an array of continuous values.
   *
   * @param {number[]|Float64Array} values
   * @returns {string[]} Array of 'TRUE'|'UNKNOWN'|'FALSE'
   */
  discretizeAll(values) {
    return Array.from(values, x => this.discretize(x));
  }

  /**
   * Determine if a truth value is definitely TRUE, FALSE, or uncertain.
   *
   * Returns 'definite_true', 'definite_false', or 'uncertain'.
   *
   * @param {number} x
   * @returns {string}
   */
  certainty(x) {
    if (x >= this.trueThreshold) return 'definite_true';
    if (x <= this.falseThreshold) return 'definite_false';
    return 'uncertain';
  }

  // ─── Gate Integration ─────────────────────────────────────────────────────

  /**
   * Apply a ternary gate to a CSL GATE output.
   *
   * Given a CSL gate activation score and a second condition, combine them
   * using the ternary AND rule.
   *
   * @param {number} gateScore - CSL GATE cos score ∈ [-1, +1]
   * @param {number} conditionScore - Second condition cos score ∈ [-1, +1]
   * @returns {{ passed: boolean, score: number, symbol: string }}
   */
  ternaryGate(gateScore, conditionScore) {
    const combined = this.AND(gateScore, conditionScore);
    const symbol = this.discretize(combined);

    return {
      passed: symbol === 'TRUE',
      score: combined,
      symbol,
    };
  }

  /**
   * Compute a ternary-aware softmax over truth values.
   *
   * Maps the ternary values to probabilities:
   *   p_TRUE    = softmax(scores)[TRUE zone indices]
   *   p_UNKNOWN = softmax(scores)[UNKNOWN zone indices]
   *   p_FALSE   = softmax(scores)[FALSE zone indices]
   *
   * @param {number[]|Float64Array} scores - Array of cosine scores
   * @param {number} [temperature=1.0]
   * @returns {{ pTrue: number, pUnknown: number, pFalse: number }}
   */
  ternarySoftmax(scores, temperature = PHI_TEMPERATURE) {
    // Compute standard softmax
    const maxScore = Math.max(...scores);
    const exps = scores.map(x => Math.exp((x - maxScore) / temperature));
    const sumExp = exps.reduce((s, x) => s + x, 0);
    const probs = exps.map(x => x / sumExp);

    // Aggregate by ternary zone
    let pTrue = 0, pUnknown = 0, pFalse = 0;
    for (let i = 0; i < scores.length; i++) {
      const sym = this.discretize(scores[i]);
      if (sym === 'TRUE') pTrue += probs[i];
      else if (sym === 'FALSE') pFalse += probs[i];
      else pUnknown += probs[i];
    }

    return { pTrue, pUnknown, pFalse };
  }
}

// ─── Standalone Truth Table Utilities ────────────────────────────────────────

/**
 * Print a formatted truth table to string.
 *
 * @param {string} opName - Operation name
 * @param {Object} table - { symA: { symB: result } } or { symA: result }
 * @returns {string} Formatted table string
 */
function formatTruthTable(opName, table) {
  if (typeof Object.values(table)[0] === 'string') {
    // Unary table
    let out = `\n${opName}:\n`;
    for (const [a, result] of Object.entries(table)) {
      out += `  ${a} → ${result}\n`;
    }
    return out;
  }

  // Binary table
  const vals = Object.keys(table);
  let out = `\n${opName}:\n`;
  out += `  \\ B: ${vals.join('  ')}\nA:\n`;

  for (const a of vals) {
    out += `  ${a}:   ${vals.map(b => table[a][b]).join('   ')}\n`;
  }

  return out;
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  TernaryLogicEngine,
  TERNARY,
  TRUE_THRESHOLD,
  FALSE_THRESHOLD,
  UNKNOWN_ZONE,
  toTernarySymbol,
  fromTernarySymbol,
  formatTruthTable,
  phiInterpolateTruth,
};
```

---

### `src/orchestration/ternary-logic.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Balanced Ternary Logic Engine — Setun-Inspired {-1, 0, +1} Cognitive Filter
 *
 * Core decision matrix for Buddy's memory routing and swarm computation.
 * Eliminates binary waste by classifying all signals into three states:
 *   +1 (Core Resonance)  → Persistent truth, commit to K3D vector storage
 *    0 (Ephemeral State)  → Transient noise, volatile Redis cache only
 *   -1 (Repel State)      → Adversarial quarantine, Shadow Index
 */

'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');
const CSL = require('../core/semantic-logic');

// ─── Ternary States ──────────────────────────────────────────────────────────
const TERNARY = Object.freeze({
    CORE_RESONANCE: +1,  // Persistent truth — commit to K3D
    EPHEMERAL: 0,  // Transient noise — volatile cache only
    REPEL: -1,  // Adversarial quarantine — Shadow Index
});

// ─── Ternary Decision Matrix ─────────────────────────────────────────────────
class TernaryDecisionMatrix extends EventEmitter {
    constructor(opts = {}) {
        super();
        this._shadowIndex = [];     // Quarantined -1 signals
        this._resonanceLog = [];    // Committed +1 signals
        this._ephemeralCount = 0;   // Count of 0 signals (not stored)
        this._vectorMemory = opts.vectorMemory || null;
        this._redisCache = opts.redisCache || null;
        this._thresholds = {
            resonanceConfidence: opts.resonanceThreshold || 0.72,
            repelConfidence: opts.repelThreshold || 0.35,
            maxShadowSize: opts.maxShadowSize || 500,
            decayInterval: opts.decayInterval || 3600000, // 1 hour
        };
        this._stats = { classified: 0, resonance: 0, ephemeral: 0, repelled: 0 };

        // Start decay timer for shadow index
        this._decayTimer = setInterval(() => this._decayShadowIndex(), this._thresholds.decayInterval);
        if (this._decayTimer.unref) this._decayTimer.unref();
    }

    /**
     * Classify a signal into {-1, 0, +1} using feature analysis.
     * @param {Object} signal - The input signal to classify
     * @param {string} signal.type - Signal type (e.g., 'user_input', 'agent_output', 'error')
     * @param {*} signal.data - The actual data payload
     * @param {Object} [signal.context] - Additional context
     * @returns {Object} { state: -1|0|+1, action: string, signal }
     */
    classify(signal) {
        this._stats.classified++;
        const features = this._extractFeatures(signal);
        const state = this._applyTernaryLogic(features);

        const result = { state, features, signal, ts: Date.now() };

        switch (state) {
            case TERNARY.CORE_RESONANCE:
                this._handleResonance(result);
                break;
            case TERNARY.EPHEMERAL:
                this._handleEphemeral(result);
                break;
            case TERNARY.REPEL:
                this._handleRepel(result);
                break;
        }

        this.emit('classified', result);
        return result;
    }

    /**
     * Batch classify an array of signals — sparse computation.
     * Returns only non-zero results (ignores noise).
     */
    sparseClassify(signals) {
        const results = [];
        for (const signal of signals) {
            const result = this.classify(signal);
            if (result.state !== TERNARY.EPHEMERAL) {
                results.push(result);
            }
        }
        return results;
    }

    /**
     * Extract classification features from a signal.
     */
    _extractFeatures(signal) {
        const features = {
            confidence: 0.5,
            novelty: 0.5,
            adversarial: false,
            verified: false,
            frequency: 0,
            type: signal.type || 'unknown',
        };

        // Confidence from explicit metadata — pipe through CSL Soft Gate
        if (signal.confidence !== undefined) {
            features.confidence = CSL.soft_gate(signal.confidence, 0.5, 10);
        }
        if (signal.verified) features.verified = true;

        // Adversarial detection: failed compilations, blocked prompts, errors
        if (signal.type === 'error' || signal.type === 'blocked' || signal.type === 'compilation_failure') {
            features.adversarial = true;
            features.confidence = Math.min(features.confidence, 0.2);
        }

        // High-value: verified proofs, user confirmations, successful actions
        if (signal.type === 'verified_proof' || signal.type === 'user_confirmation' || signal.type === 'action_success') {
            features.verified = true;
            features.confidence = Math.max(features.confidence, 0.85);
        }

        // Novelty scoring: check shadow index for prior similar failures
        const shadowMatch = this._shadowIndex.find(s =>
            s.signal && s.signal.type === signal.type &&
            JSON.stringify(s.signal.data).slice(0, 100) === JSON.stringify(signal.data).slice(0, 100)
        );
        if (shadowMatch) {
            features.adversarial = true;
            features.confidence = 0.1; // Known bad pattern
            features.frequency = (shadowMatch.frequency || 0) + 1;
        }

        return features;
    }

    /**
     * Apply ternary logic via CSL Ternary Gate: {-1, 0, +1} classification.
     * Uses continuous sigmoid activation instead of hard thresholds.
     */
    _applyTernaryLogic(features) {
        // Forced REPEL for known adversarial signals
        if (features.adversarial) {
            return TERNARY.REPEL;
        }

        // Compute effective score: base confidence boosted by verification
        let effectiveScore = features.confidence;
        if (features.verified) effectiveScore = Math.min(1.0, effectiveScore + 0.15);
        if (features.novelty > 0.7) effectiveScore = Math.min(1.0, effectiveScore + 0.08);

        // CSL Ternary Gate: continuous sigmoid classification
        const gate = CSL.ternary_gate(
            effectiveScore,
            this._thresholds.resonanceConfidence,
            this._thresholds.repelConfidence,
            15
        );

        // Attach activation metadata for downstream consumers
        features._cslActivation = {
            resonance: gate.resonanceActivation,
            repel: gate.repelActivation,
            raw: gate.raw,
        };

        return gate.state === 1 ? TERNARY.CORE_RESONANCE
            : gate.state === -1 ? TERNARY.REPEL
                : TERNARY.EPHEMERAL;
    }

    /**
     * +1: Core Resonance — commit to K3D vector storage.
     */
    async _handleResonance(result) {
        this._stats.resonance++;
        this._resonanceLog.push({
            ts: result.ts,
            type: result.signal.type,
            confidence: result.features.confidence,
        });

        // Keep resonance log bounded
        if (this._resonanceLog.length > 1000) {
            this._resonanceLog = this._resonanceLog.slice(-500);
        }

        // Deep Consolidation Protocol: commit to K3D
        if (this._vectorMemory && typeof this._vectorMemory.ingestMemory === 'function') {
            try {
                await this._vectorMemory.ingestMemory({
                    content: JSON.stringify(result.signal.data),
                    type: 'core_resonance',
                    metadata: {
                        ternary_state: +1,
                        confidence: result.features.confidence,
                        source: result.signal.type,
                    },
                });
            } catch (err) {
                logger.error?.(`Ternary K3D commit failed: ${err.message}`) ||
                    console.error(`Ternary K3D commit failed: ${err.message}`);
            }
        }

        this.emit('resonance', result);
    }

    /**
     * 0: Ephemeral — volatile cache only, evaporates on session close.
     */
    _handleEphemeral(result) {
        this._stats.ephemeral++;
        this._ephemeralCount++;

        // If Redis is available, store in volatile cache with TTL
        if (this._redisCache && typeof this._redisCache.set === 'function') {
            const key = `ternary:ephemeral:${result.ts}`;
            this._redisCache.set(key, JSON.stringify(result.signal.data), 'EX', 300)
                .catch(() => { }); // fire and forget
        }
    }

    /**
     * -1: Repel — quarantine into Shadow Index.
     */
    _handleRepel(result) {
        this._stats.repelled++;

        const shadowEntry = {
            ts: result.ts,
            signal: { type: result.signal.type, data: result.signal.data },
            reason: result.features.adversarial ? 'adversarial_detection' : 'low_confidence',
            confidence: result.features.confidence,
            frequency: result.features.frequency || 1,
        };

        this._shadowIndex.push(shadowEntry);

        // Bound shadow index
        if (this._shadowIndex.length > this._thresholds.maxShadowSize) {
            this._shadowIndex = this._shadowIndex.slice(-Math.floor(this._thresholds.maxShadowSize / 2));
        }

        this.emit('repel', result);
    }

    /**
     * Decay old shadow entries to prevent stale quarantines.
     */
    _decayShadowIndex() {
        const cutoff = Date.now() - (this._thresholds.decayInterval * 24); // 24 decay cycles
        const before = this._shadowIndex.length;
        this._shadowIndex = this._shadowIndex.filter(e => e.ts > cutoff);
        const removed = before - this._shadowIndex.length;
        if (removed > 0) {
            this.emit('shadow_decay', { removed, remaining: this._shadowIndex.length });
        }
    }

    /**
     * Query the Shadow Index for known-bad patterns.
     */
    queryShadowIndex(query) {
        const queryStr = typeof query === 'string' ? query : JSON.stringify(query);
        return this._shadowIndex.filter(entry =>
            JSON.stringify(entry.signal.data).includes(queryStr)
        );
    }

    /**
     * Get ternary engine stats.
     */
    getStats() {
        return {
            ...this._stats,
            shadowIndexSize: this._shadowIndex.length,
            resonanceLogSize: this._resonanceLog.length,
            ephemeralCount: this._ephemeralCount,
            distribution: {
                resonance: this._stats.classified > 0 ? (this._stats.resonance / this._stats.classified * 100).toFixed(1) + '%' : '0%',
                ephemeral: this._stats.classified > 0 ? (this._stats.ephemeral / this._stats.classified * 100).toFixed(1) + '%' : '0%',
                repelled: this._stats.classified > 0 ? (this._stats.repelled / this._stats.classified * 100).toFixed(1) + '%' : '0%',
            },
        };
    }

    /**
     * Register API routes.
     */
    registerRoutes(app) {
        app.get('/api/v2/ternary/stats', (req, res) => res.json({ ok: true, ...this.getStats() }));
        app.get('/api/v2/ternary/shadow', (req, res) => {
            const query = req.query.q;
            const results = query ? this.queryShadowIndex(query) : this._shadowIndex.slice(-20);
            res.json({ ok: true, count: results.length, entries: results });
        });
        app.post('/api/v2/ternary/classify', (req, res) => {
            const result = this.classify(req.body);
            res.json({ ok: true, state: result.state, stateName: ['REPEL', 'EPHEMERAL', 'CORE_RESONANCE'][result.state + 1], features: result.features });
        });
    }

    destroy() {
        if (this._decayTimer) clearInterval(this._decayTimer);
    }
}

module.exports = { TernaryDecisionMatrix, TERNARY };
```

---

### `src/core/csl-engine/csl-engine.js`

```javascript
/**
 * @fileoverview CSL Engine — Continuous Semantic Logic
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Core innovation: vector geometry as logical gates operating in 384-dimensional
 * (or 1536-dimensional) embedding space. All logic is geometric: alignment,
 * superposition, orthogonal projection, and cosine activation.
 *
 * Mathematical Foundation:
 *   - Domain: unit vectors in ℝᴰ, D ∈ {384, 1536}
 *   - Truth value: τ(a, b) = cos(θ) = (a·b) / (‖a‖·‖b‖) ∈ [-1, +1]
 *   - +1 = fully aligned (TRUE), 0 = orthogonal (UNKNOWN), -1 = antipodal (FALSE)
 *
 * References:
 *   - Birkhoff & von Neumann (1936): "The Logic of Quantum Mechanics"
 *   - Widdows (2003): "Orthogonal Negation in Vector Spaces" — ACL 2003
 *   - Grand et al. (2022): "Semantic projection" — Nature Human Behaviour
 *   - Fagin, Riegel, Gray (2024): "Foundations of reasoning with uncertainty" — PNAS
 *
 * @module csl-engine
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL techniques
 */

import { PHI, PSI, PHI_TEMPERATURE, CSL_THRESHOLDS, phiThreshold, EPSILON as PHI_EPSILON, adaptiveTemperature } from '../../shared/phi-math.js';

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default vector dimension for standard embedding models (e.g., all-MiniLM-L6-v2) */
const DEFAULT_DIM = 384;

/** Extended dimension for high-fidelity models (e.g., text-embedding-3-large) */
const LARGE_DIM = 1536;

/** Numerical epsilon: prevents division-by-zero and detects near-zero vectors.
 * Sourced from shared/phi-math.js PHI_EPSILON (same 1e-10 value, unified constant). */
const EPSILON = PHI_EPSILON; // from shared/phi-math.js

/** Threshold below which a vector is considered near-zero (degenerate) */
const ZERO_NORM_THRESHOLD = 1e-8;

/** Default gate threshold τ for GATE operation.
 * CSL_THRESHOLDS.MINIMUM ≈ 0.500 — noise floor for geometric truth activation. */
const DEFAULT_GATE_THRESHOLD = CSL_THRESHOLDS.MINIMUM; // ≈ 0.500 (CSL noise floor)

/** Default temperature τ for soft gating / softmax operations.
 * PHI_TEMPERATURE = PSI^3 ≈ 0.236 — phi-harmonic softness. */
const DEFAULT_TEMPERATURE = PHI_TEMPERATURE; // PSI^3 ≈ 0.236

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Compute the L2 norm (Euclidean length) of a vector.
 *
 * Formula: ‖a‖ = √(Σᵢ aᵢ²)
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {number} L2 norm ≥ 0
 */
function norm(a) {
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length (project onto unit hypersphere Sᴰ⁻¹).
 *
 * Formula: â = a / ‖a‖
 *
 * Returns the zero vector if ‖a‖ < ZERO_NORM_THRESHOLD (degenerate case).
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {Float64Array} Unit vector, or zero vector if degenerate
 */
function normalize(a) {
  const n = norm(a);
  const result = new Float64Array(a.length);
  if (n < ZERO_NORM_THRESHOLD) {
    return result; // zero vector — caller should handle
  }
  const invN = 1.0 / n;
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * invN;
  }
  return result;
}

/**
 * Compute the dot product of two equal-length vectors.
 *
 * Formula: a·b = Σᵢ aᵢ·bᵢ
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {number} Scalar dot product
 * @throws {Error} If vectors have different lengths
 */
function dot(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Clamp a value to the interval [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Add two vectors element-wise and return a new Float64Array.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorAdd(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] + b[i];
  }
  return result;
}

/**
 * Subtract vector b from a element-wise.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorSub(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] - b[i];
  }
  return result;
}

/**
 * Scale a vector by a scalar.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {number} scalar
 * @returns {Float64Array}
 */
function vectorScale(a, scalar) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * scalar;
  }
  return result;
}

// ─── CSLEngine Class ──────────────────────────────────────────────────────────

/**
 * CSLEngine — Continuous Semantic Logic Engine
 *
 * Implements all CSL logical gates as pure geometric operations on high-dimensional
 * vectors. All operations work on raw (unnormalized) input vectors and handle
 * normalization internally unless otherwise noted.
 *
 * All gate methods:
 *   1. Accept Float32Array, Float64Array, or number[] inputs
 *   2. Return Float64Array for gate outputs (or number for scalar outputs)
 *   3. Include full numerical stability handling
 *   4. Support batch operation via the batch* prefix methods
 *
 * @class
 * @example
 * const engine = new CSLEngine({ dim: 384 });
 * const score = engine.AND(vectorA, vectorB);     // cosine similarity ∈ [-1,1]
 * const union = engine.OR(vectorA, vectorB);       // normalized superposition
 * const negated = engine.NOT(vectorA, vectorB);    // semantic negation
 */
class CSLEngine {
  /** Golden ratio constant — accessible on class for downstream phi-arithmetic */
  static PHI = PHI;
  /** Golden ratio conjugate (1/Φ = Φ-1) — accessible on class */
  static PSI = PSI;

  /**
   * @param {Object} [options]
   * @param {number} [options.dim=384] - Vector dimension
   * @param {number} [options.epsilon=1e-10] - Numerical stability epsilon
   * @param {number} [options.gateThreshold=0.0] - Default threshold τ for GATE
   * @param {number} [options.temperature=1.0] - Default temperature for soft gates
   * @param {boolean} [options.normalizeInputs=true] - Auto-normalize inputs
   */
  constructor(options = {}) {
    this.dim = options.dim || DEFAULT_DIM;
    this.epsilon = options.epsilon || EPSILON;
    this.gateThreshold = options.gateThreshold !== undefined
      ? options.gateThreshold
      : DEFAULT_GATE_THRESHOLD;
    this.temperature = options.temperature || DEFAULT_TEMPERATURE;
    this.normalizeInputs = options.normalizeInputs !== false;

    // Runtime statistics for monitoring
    this._stats = {
      operationCount: 0,
      degenerateVectors: 0,
      gateActivations: 0,
    };
  }

  // ─── Core Gate Operations ──────────────────────────────────────────────────

  /**
   * CSL AND — Measures semantic alignment between two concept vectors.
   *
   * Mathematical formula:
   *   AND(a, b) = cos(θ_{a,b}) = (a·b) / (‖a‖·‖b‖)
   *
   * Interpretation:
   *   - Result ∈ [-1, +1]
   *   - +1: concepts are fully aligned ("both true in the same direction")
   *   - 0:  concepts are orthogonal ("independent / no relationship")
   *   - -1: concepts are antipodal ("contradictory / one negates the other")
   *
   * Logical analogy: "a AND b is true" ↔ cos(a, b) close to +1.
   * This is the soft AND: high only when both concepts are co-aligned.
   *
   * Properties:
   *   - Commutative: AND(a,b) = AND(b,a)
   *   - Bounded: result ∈ [-1, +1]
   *   - Scale invariant: AND(λa, b) = AND(a, b) for λ > 0
   *
   * Reference: Birkhoff & von Neumann (1936), quantum logic inner product.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {number} Cosine similarity ∈ [-1, +1]
   */
  AND(a, b) {
    this._stats.operationCount++;
    const normA = norm(a);
    const normB = norm(b);

    if (normA < this.epsilon || normB < this.epsilon) {
      this._stats.degenerateVectors++;
      return 0.0; // degenerate: zero vectors are orthogonal to everything
    }

    const dotProduct = dot(a, b);
    return clamp(dotProduct / (normA * normB), -1.0, 1.0);
  }

  /**
   * CSL OR — Computes semantic superposition (soft union) of two concepts.
   *
   * Mathematical formula:
   *   OR(a, b) = normalize(a + b)
   *
   * The sum a + b creates a vector similar to both a and b — capturing the
   * "union" of semantic content. Normalization returns the result to the unit
   * sphere for subsequent operations.
   *
   * Interpretation:
   *   - The result vector points "between" a and b on the hypersphere
   *   - Its cosine similarity to both a and b is positive
   *   - For orthogonal a, b: result is at 45° to both (equal similarity)
   *   - For identical a = b: result is identical to a (idempotent in direction)
   *
   * Logical analogy: "a OR b" is the direction that captures either concept.
   *
   * Properties:
   *   - Commutative: OR(a,b) = OR(b,a)
   *   - Returns unit vector on Sᴰ⁻¹
   *   - Degenerate when a ≈ -b (antiparallel): returns zero vector
   *
   * Reference: HDC bundling operation; Boolean IR vector addition.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized superposition vector (unit length)
   */
  OR(a, b) {
    this._stats.operationCount++;
    const sum = vectorAdd(a, b);
    const n = norm(sum);

    if (n < this.epsilon) {
      this._stats.degenerateVectors++;
      // a ≈ -b: concepts cancel. Return zero vector to signal cancellation.
      return new Float64Array(a.length);
    }

    return vectorScale(sum, 1.0 / n);
  }

  /**
   * CSL NOT — Semantic negation via orthogonal projection.
   *
   * Mathematical formula:
   *   NOT(a, b) = a - proj_b(a) = a - (a·b / ‖b‖²) · b
   *
   * For unit vectors ‖b‖ = 1:
   *   NOT(a, b) = a - (a·b) · b
   *
   * The result is the component of a that is orthogonal to b — removing
   * the semantic content of b from a.
   *
   * Interpretation:
   *   - "NOT(a, b)" means "a, but not the part that overlaps with b"
   *   - Example: NOT(cat_vector, persian_vector) → cat vector minus Persian traits
   *   - The result has zero cosine similarity with b (by construction)
   *   - Residual magnitude: ‖NOT(a,b)‖ = ‖a‖·sin(θ_{a,b})
   *
   * Idempotency:
   *   NOT(NOT(a,b), b) ≈ NOT(a,b) because the result is already in b⊥.
   *   More precisely: the projection of NOT(a,b) onto b is ≈ 0, so subtracting
   *   proj_b again leaves it unchanged. (Full proof in csl-mathematical-proofs.md)
   *
   * Similarity after negation (for normalized a, b):
   *   a · NOT(a, b) = 1 - (a·b)²
   *
   * Reference: Widdows (2003), ACL 2003, "Orthogonal Negation in Vector Spaces"
   *
   * @param {Float32Array|Float64Array|number[]} a - Query/source vector
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate/remove
   * @param {boolean} [returnNormalized=true] - Whether to normalize the result
   * @returns {Float64Array} Vector with b's semantic content removed
   */
  NOT(a, b, returnNormalized = true) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      // b is near-zero: nothing to project out, return a (optionally normalized)
      return returnNormalized ? normalize(a) : new Float64Array(a);
    }

    // Projection coefficient: (a·b) / ‖b‖²
    const projCoeff = dot(a, b) / normBSq;

    // Remove projection: a - projCoeff·b
    const result = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] - projCoeff * b[i];
    }

    if (returnNormalized) {
      return normalize(result);
    }
    return result;
  }

  /**
   * CSL IMPLY — Geometric material implication via projection.
   *
   * Mathematical formula:
   *   IMPLY(a, b) = proj_b(a) = (a·b / ‖b‖²) · b
   *
   * For unit vectors:
   *   IMPLY(a, b) = (a·b) · b    [scalar times unit vector]
   *
   * The projection of a onto b captures "how much of a is contained in b" —
   * the geometric analog of material implication: degree to which a implies b.
   *
   * Interpretation:
   *   - Large projection → a strongly implies b (concepts highly co-directional)
   *   - Zero projection → a and b are independent (no implication)
   *   - Negative projection → a implies NOT b (antiparallel)
   *
   * Scalar implication strength: IMPLY_scalar(a,b) = a·b / ‖b‖ = cos(θ)·‖a‖
   *
   * Reference: Grand et al. (2022) semantic projection; Birkhoff-von Neumann.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent vector (hypothesis)
   * @param {Float32Array|Float64Array|number[]} b - Consequent vector (conclusion)
   * @returns {Float64Array} Projection of a onto span(b)
   */
  IMPLY(a, b) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      return new Float64Array(a.length); // zero consequent: no implication
    }

    const projCoeff = dot(a, b) / normBSq;
    return vectorScale(b, projCoeff);
  }

  /**
   * Scalar implication strength — returns the signed magnitude of implication.
   *
   * Formula: IMPLY_strength(a, b) = (a·b) / (‖a‖·‖b‖) = cos(θ_{a,b})
   *
   * Equivalent to AND(a, b) — the cosine similarity *is* the implication strength.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Implication strength ∈ [-1, +1]
   */
  IMPLY_scalar(a, b) {
    return this.AND(a, b);
  }

  /**
   * CSL XOR — Exclusive semantic content (symmetric difference).
   *
   * Mathematical formula:
   *   XOR(a, b) = normalize(a + b) - proj_mutual(a, b)
   *
   * More precisely, for unit vectors:
   *   XOR(a, b) = normalize( (a - proj_b(a)) + (b - proj_a(b)) )
   *             = normalize( a_⊥b + b_⊥a )
   *
   * Where a_⊥b is the component of a orthogonal to b (exclusive to a),
   * and b_⊥a is the component of b orthogonal to a (exclusive to b).
   *
   * Interpretation:
   *   - XOR captures what is unique to each concept (symmetric difference)
   *   - When a ≈ b: both exclusive components → 0, XOR → zero vector
   *   - When a ⊥ b: exclusive components = full vectors, XOR ≈ normalize(a + b)
   *   - "a XOR b" = concepts that appear in one but not both
   *
   * Properties:
   *   - Commutative: XOR(a,b) = XOR(b,a)
   *   - Anti-idempotent: XOR(a,a) → zero vector
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized exclusive semantic content
   */
  XOR(a, b) {
    this._stats.operationCount++;

    // a_⊥b: component of a orthogonal to b (NOT(a, b) unnormalized)
    const normBSq = dot(b, b);
    const normASq = dot(a, a);

    if (normASq < this.epsilon || normBSq < this.epsilon) {
      this._stats.degenerateVectors++;
      return new Float64Array(a.length);
    }

    const projAonB = dot(a, b) / normBSq;
    const projBonA = dot(a, b) / normASq; // Note: dot(b,a) = dot(a,b)

    // a_⊥b = a - proj_b(a)
    // b_⊥a = b - proj_a(b)
    const exclusive = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      const a_excl = a[i] - projAonB * b[i];
      const b_excl = b[i] - projBonA * a[i];
      exclusive[i] = a_excl + b_excl;
    }

    const n = norm(exclusive);
    if (n < this.epsilon) {
      return new Float64Array(a.length); // a ≈ b: no exclusive content
    }

    return vectorScale(exclusive, 1.0 / n);
  }

  /**
   * CSL CONSENSUS — Weighted mean of agent/concept vectors (agreement).
   *
   * Mathematical formula:
   *   CONSENSUS({aᵢ}, {wᵢ}) = normalize( Σᵢ wᵢ · aᵢ )
   *
   * Uniform weights (default):
   *   CONSENSUS({aᵢ}) = normalize( (1/n) Σᵢ aᵢ )
   *
   * Interpretation:
   *   - Result is the centroid direction on the unit hypersphere
   *   - ‖Σ wᵢaᵢ‖ before normalization measures consensus strength:
   *     → ≈ 1: strong agreement (vectors nearly aligned)
   *     → ≈ 0: strong disagreement (vectors cancel out)
   *   - Consensus Quality metric: R = ‖(1/n)Σaᵢ‖ ∈ [0,1]
   *
   * Properties:
   *   - Commutative: order of vectors doesn't matter
   *   - Weights must be non-negative (negative weights invert contribution)
   *   - Returns zero vector when agents completely disagree
   *
   * Reference: HDC bundling operation; Roundtable Policy (arXiv 2509.16839)
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors - Agent opinion vectors
   * @param {number[]} [weights] - Optional weights (uniform if omitted)
   * @returns {{ consensus: Float64Array, strength: number }}
   *   consensus: normalized consensus vector
   *   strength: R ∈ [0,1] measuring agreement level
   */
  CONSENSUS(vectors, weights = null) {
    this._stats.operationCount++;

    if (!vectors || vectors.length === 0) {
      throw new Error('CONSENSUS requires at least one vector');
    }

    const dim = vectors[0].length;
    const n = vectors.length;

    // Validate weights
    let w = weights;
    if (!w) {
      w = new Array(n).fill(1.0 / n);
    } else {
      if (w.length !== n) {
        throw new Error(`Weights length ${w.length} != vectors length ${n}`);
      }
      // Normalize weights to sum to 1
      const wSum = w.reduce((s, x) => s + x, 0);
      if (wSum < this.epsilon) {
        throw new Error('Weights must have positive sum');
      }
      w = w.map(x => x / wSum);
    }

    // Weighted sum
    const sum = new Float64Array(dim);
    for (let j = 0; j < n; j++) {
      const vec = vectors[j];
      const wj = w[j];
      for (let i = 0; i < dim; i++) {
        sum[i] += wj * vec[i];
      }
    }

    // Measure consensus strength before normalizing
    const strength = norm(sum);

    if (strength < this.epsilon) {
      this._stats.degenerateVectors++;
      return {
        consensus: new Float64Array(dim),
        strength: 0.0,
      };
    }

    const consensus = vectorScale(sum, 1.0 / strength);
    return { consensus, strength: clamp(strength, 0, 1) };
  }

  /**
   * CSL GATE — Threshold activation function using cosine similarity.
   *
   * Mathematical formula:
   *   GATE(input, gate_vector, τ) = θ( cos(input, gate_vector) - τ )
   *
   * Where θ is the Heaviside step function (hard gate) or sigmoid (soft gate):
   *   Hard:  GATE = 1  if cos(input, gate_vector) ≥ τ, else 0
   *   Soft:  GATE = σ( (cos(input, gate_vector) - τ) / temperature )
   *
   * The gate_vector defines a semantic "topic direction" in embedding space.
   * Inputs aligned with this direction (above threshold τ) pass the gate.
   *
   * Properties:
   *   - Bounded output: hard ∈ {0,1}, soft ∈ (0,1)
   *   - Scale invariant: GATE(λ·input, gate_vector, τ) = GATE(input, gate_vector, τ)
   *   - Differentiable (soft gate only)
   *   - Valid activation function: monotone, bounded, Lipschitz-continuous (soft)
   *
   * Proof that soft GATE is a valid activation function:
   *   (See csl-mathematical-proofs.md §4: CSL GATE Activation Properties)
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector to gate
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [threshold=0.0] - Threshold τ ∈ [-1, +1]
   * @param {'hard'|'soft'} [mode='hard'] - Hard (step) or soft (sigmoid) gate
   * @param {number} [temperature=1.0] - Temperature for soft gate sharpness
   * @returns {{ activation: number, cosScore: number }}
   *   activation: gate output ∈ {0,1} (hard) or (0,1) (soft)
   *   cosScore: raw cosine similarity before thresholding
   */
  GATE(input, gateVector, threshold = null, mode = 'hard', temperature = null) {
    this._stats.operationCount++;

    const tau = threshold !== null ? threshold : this.gateThreshold;
    const temp = temperature !== null ? temperature : this.temperature;

    const cosScore = this.AND(input, gateVector);
    const shifted = cosScore - tau;

    let activation;
    if (mode === 'hard') {
      activation = shifted >= 0 ? 1 : 0;
    } else {
      // Soft (sigmoid) gate: σ(x) = 1 / (1 + e^{-x/temp})
      activation = 1.0 / (1.0 + Math.exp(-shifted / temp));
    }

    if (activation > 0) this._stats.gateActivations++;

    return { activation, cosScore };
  }

  /**
   * CSL NAND — NOT AND: semantic incompatibility gate.
   *
   * Formula: NAND(a, b) = 1 - max(0, AND(a, b))
   *          Maps high alignment → low output; low alignment → high output.
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {number} NAND score ∈ [0, 1]
   */
  NAND(a, b) {
    const andScore = this.AND(a, b);
    return 1.0 - Math.max(0, andScore);
  }

  /**
   * CSL NOR — NOT OR: semantic exclusion gate.
   *
   * Returns normalized vector pointing away from the OR superposition.
   * Semantically: the concept that is distinct from both a and b.
   *
   * Formula: NOR(a,b) = normalize( -(a + b) )
   *                   = negate( OR(a, b) )
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {Float64Array} Antipodal to OR(a,b)
   */
  NOR(a, b) {
    this._stats.operationCount++;
    const orVec = this.OR(a, b);
    return vectorScale(orVec, -1.0);
  }

  // ─── Projection Utilities ──────────────────────────────────────────────────

  /**
   * Project vector a onto the subspace spanned by a set of basis vectors.
   *
   * Uses Gram-Schmidt orthogonalization for numerical stability.
   *
   * Formula: proj_B(a) = Σᵢ (a·eᵢ) eᵢ
   * where {eᵢ} is an orthonormal basis for span(B), computed via Gram-Schmidt.
   *
   * @param {Float32Array|Float64Array|number[]} a - Vector to project
   * @param {Array<Float32Array|Float64Array|number[]>} basisVectors - Spanning set
   * @returns {Float64Array} Projection of a onto span(basisVectors)
   */
  projectOntoSubspace(a, basisVectors) {
    if (!basisVectors || basisVectors.length === 0) {
      return new Float64Array(a.length);
    }

    const dim = a.length;
    // Gram-Schmidt orthogonalization of basisVectors
    const orthoBasis = [];

    for (let j = 0; j < basisVectors.length; j++) {
      let vec = new Float64Array(basisVectors[j]);

      // Remove components along existing orthobasis
      for (const e of orthoBasis) {
        const coeff = dot(vec, e);
        for (let i = 0; i < dim; i++) {
          vec[i] -= coeff * e[i];
        }
      }

      const n = norm(vec);
      if (n > this.epsilon) {
        const unitVec = vectorScale(vec, 1.0 / n);
        orthoBasis.push(unitVec);
      }
    }

    // Project a onto orthobasis
    const projection = new Float64Array(dim);
    for (const e of orthoBasis) {
      const coeff = dot(a, e);
      for (let i = 0; i < dim; i++) {
        projection[i] += coeff * e[i];
      }
    }

    return projection;
  }

  /**
   * NOT against a subspace (multiple semantic concepts removed simultaneously).
   *
   * Formula: NOT(a, B) = a - proj_B(a)
   *
   * Removes all semantic content in span{b₁,...,bₙ} from a.
   *
   * @param {Float32Array|Float64Array|number[]} a - Source vector
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Concepts to remove
   * @param {boolean} [returnNormalized=true]
   * @returns {Float64Array}
   */
  NOT_subspace(a, bVectors, returnNormalized = true) {
    this._stats.operationCount++;
    const projection = this.projectOntoSubspace(a, bVectors);
    const result = vectorSub(a, projection);
    return returnNormalized ? normalize(result) : result;
  }

  // ─── Batch Operations ──────────────────────────────────────────────────────

  /**
   * Batch AND — Compute cosine similarity of one vector against many.
   *
   * GPU-friendly: equivalent to a matrix-vector multiplication.
   * M[j] = a · B[j] / (‖a‖ · ‖B[j]‖) for each row B[j] in the matrix.
   *
   * @param {Float32Array|Float64Array|number[]} a - Query vector (1 × dim)
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Corpus vectors (n × dim)
   * @returns {Float64Array} Similarity scores (n,) ∈ [-1,+1]
   */
  batchAND(a, bVectors) {
    const normA = norm(a);
    if (normA < this.epsilon) {
      return new Float64Array(bVectors.length);
    }

    const result = new Float64Array(bVectors.length);
    for (let j = 0; j < bVectors.length; j++) {
      const normB = norm(bVectors[j]);
      if (normB < this.epsilon) {
        result[j] = 0.0;
        continue;
      }
      result[j] = clamp(dot(a, bVectors[j]) / (normA * normB), -1.0, 1.0);
    }
    return result;
  }

  /**
   * Batch NOT — Remove concept b from an array of source vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors - Source vectors
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate
   * @param {boolean} [returnNormalized=true]
   * @returns {Array<Float64Array>} Array of negated vectors
   */
  batchNOT(aVectors, b, returnNormalized = true) {
    return aVectors.map(a => this.NOT(a, b, returnNormalized));
  }

  /**
   * Batch GATE — Apply semantic gate to an array of input vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} inputs - Input vectors
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction
   * @param {number} [threshold=0.0] - Threshold τ
   * @param {'hard'|'soft'} [mode='hard']
   * @returns {Array<{ activation: number, cosScore: number }>}
   */
  batchGATE(inputs, gateVector, threshold = null, mode = 'hard') {
    return inputs.map(inp => this.GATE(inp, gateVector, threshold, mode));
  }

  /**
   * Batch IMPLY — Compute projection of each input onto the consequent.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {Array<Float64Array>} Projections
   */
  batchIMPLY(aVectors, b) {
    return aVectors.map(a => this.IMPLY(a, b));
  }

  // ─── Advanced Logical Compositions ────────────────────────────────────────

  /**
   * CSL CONDITIONAL — Soft conditional probability: P(b|a) via geometric Bayes.
   *
   * Formula: P(b|a) ≈ AND(a,b) / AND(a,a) = cos(a,b) / 1 = cos(a,b)
   *          [for normalized vectors, this reduces to AND]
   *
   * For asymmetric conditional, use the projection magnitude:
   *   P(b|a) ≈ ‖proj_b(a)‖ / ‖a‖ = |cos(a,b)|
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Conditional alignment ∈ [0, 1]
   */
  CONDITIONAL(a, b) {
    return Math.abs(this.AND(a, b));
  }

  /**
   * CSL ANALOGY — Completes an analogy: "a is to b as c is to ?"
   *
   * Formula: d = normalize( b - a + c )
   *   [vector arithmetic analogy, as in word2vec: king - man + woman ≈ queen]
   *
   * @param {Float32Array|Float64Array|number[]} a - Source concept
   * @param {Float32Array|Float64Array|number[]} b - Target concept
   * @param {Float32Array|Float64Array|number[]} c - Query concept
   * @returns {Float64Array} Analogy completion vector
   */
  ANALOGY(a, b, c) {
    this._stats.operationCount++;
    // d = normalize(b - a + c)
    const diff = vectorSub(b, a);
    const result = vectorAdd(diff, c);
    return normalize(result);
  }

  /**
   * Compute pairwise AND (cosine similarity matrix) for a set of vectors.
   *
   * Returns a symmetric matrix M where M[i][j] = cos(vectors[i], vectors[j]).
   * GPU-friendly: equivalent to normalized matrix multiplication V @ Vᵀ.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors
   * @returns {Float64Array[]} n×n cosine similarity matrix (row-major)
   */
  pairwiseAND(vectors) {
    const n = vectors.length;
    const norms = vectors.map(v => norm(v));

    // Pre-allocate n×n matrix as array of Float64Arrays
    const matrix = Array.from({ length: n }, () => new Float64Array(n));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0; // self-similarity
      for (let j = i + 1; j < n; j++) {
        const d = dot(vectors[i], vectors[j]);
        const normIJ = norms[i] * norms[j];
        const sim = normIJ < this.epsilon ? 0.0 : clamp(d / normIJ, -1.0, 1.0);
        matrix[i][j] = sim;
        matrix[j][i] = sim; // symmetric
      }
    }

    return matrix;
  }

  // ─── Statistics and Introspection ─────────────────────────────────────────

  /**
   * Retrieve runtime operation statistics.
   *
   * @returns {{ operationCount: number, degenerateVectors: number, gateActivations: number }}
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Reset runtime statistics.
   */
  resetStats() {
    this._stats = { operationCount: 0, degenerateVectors: 0, gateActivations: 0 };
  }

  // ─── Phi-Harmonic Gate Extensions ───────────────────────────────────────────────

  /**
   * Phi-harmonic GATE — uses phiThreshold(level) from phi-math.js as threshold.
   *
   * phiThreshold(level) = 1 - PSI^level * 0.5:
   *   level=1 ≈ 0.691 (CSL LOW)
   *   level=2 ≈ 0.809 (CSL MEDIUM)
   *   level=3 ≈ 0.882 (CSL HIGH)
   *
   * Provides a geometrically scaled activation threshold aligned with
   * the sacred geometry resource allocation tiers.
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [level=2] - Phi threshold level (1–4)
   * @param {'hard'|'soft'} [mode='hard'] - Gate mode
   * @returns {{ activation: number, cosScore: number, threshold: number }}
   */
  phiGATE(input, gateVector, level = 2, mode = 'hard') {
    const threshold = phiThreshold(level); // e.g. level=2 ≈ 0.809 (MEDIUM)
    const result = this.GATE(input, gateVector, threshold, mode);
    return { ...result, threshold };
  }

  /**
   * Adaptive GATE — uses adaptiveTemperature(entropy, maxEntropy) for dynamic softness.
   *
   * Temperature = PSI^(1 + 2*(1 - H/Hmax)) from phi-math.js.
   * At max entropy (uniform distribution): temperature ≈ PSI (softest).
   * At zero entropy (deterministic):       temperature ≈ PSI^3 (sharpest = PHI_TEMPERATURE).
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} entropy - Current routing entropy H (nats)
   * @param {number} maxEntropy - Maximum possible entropy Hmax = log(numExperts)
   * @returns {{ activation: number, cosScore: number, temperature: number }}
   */
  adaptiveGATE(input, gateVector, entropy, maxEntropy) {
    const temperature = adaptiveTemperature(entropy, maxEntropy);
    const result = this.GATE(input, gateVector, null, 'soft', temperature);
    return { ...result, temperature };
  }

  /**
   * Validate that a vector has the expected dimension and no NaN/Inf values.
   *
   * @param {Float32Array|Float64Array|number[]} vector
   * @param {number} [expectedDim] - Expected dimension (defaults to this.dim)
   * @returns {{ valid: boolean, issues: string[] }}
   */
  validateVector(vector, expectedDim = null) {
    const issues = [];
    const dim = expectedDim || this.dim;

    if (!vector || vector.length === 0) {
      issues.push('Vector is empty or null');
    } else {
      if (vector.length !== dim) {
        issues.push(`Dimension mismatch: got ${vector.length}, expected ${dim}`);
      }

      let hasNaN = false;
      let hasInf = false;
      for (let i = 0; i < vector.length; i++) {
        if (Number.isNaN(vector[i])) hasNaN = true;
        if (!Number.isFinite(vector[i])) hasInf = true;
      }
      if (hasNaN) issues.push('Vector contains NaN values');
      if (hasInf) issues.push('Vector contains Inf values');

      const n = norm(vector);
      if (n < ZERO_NORM_THRESHOLD) {
        issues.push('Vector is near-zero (degenerate)');
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  CSLEngine,
  // Export utility functions for external use
  norm,
  normalize,
  dot,
  clamp,
  vectorAdd,
  vectorSub,
  vectorScale,
  // Export constants
  DEFAULT_DIM,
  LARGE_DIM,
  EPSILON,
  ZERO_NORM_THRESHOLD,
};
```

---

### `src/core/csl-engine/moe-csl-router.js`

```javascript
/**
 * @fileoverview MoE-CSL Router — Mixture-of-Experts routing via CSL gates
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Routes inputs to expert agents using cosine similarity gates. The router
 * uses semantic alignment (CSL AND) rather than learned linear weights to
 * determine which experts are semantically relevant for each input.
 *
 * Key advantages over standard MoE routers:
 *   - Scale invariance: routing based on direction, not magnitude
 *   - Semantic interpretability: expert gate vectors have semantic meaning
 *   - Anti-collapse: cosine similarity naturally prevents expert collapse
 *   - Cross-domain robustness: geometric routing excels on diverse inputs
 *
 * Architecture:
 *   1. Each expert has a "gate vector" eᵢ ∈ ℝᴰ defining its semantic domain
 *   2. For input x, compute cosine scores: sᵢ = cos(x, eᵢ)
 *   3. Apply temperature-controlled softmax: pᵢ = softmax(sᵢ / τ)
 *   4. Select top-k experts by probability
 *   5. Load-balance via auxiliary anti-collapse loss
 *
 * References:
 *   - MoE Survey (arXiv:2503.07137, March 2025): cosine routing superiority
 *   - DeepSeekMoE (2024): cosine routing for stable sparse expert selection
 *   - Cottention (arXiv:2409.18747): cosine attention for linear transformers
 *
 * @module moe-csl-router
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL/routing techniques
 */

'use strict';

const { PHI, PSI, PHI_TEMPERATURE, adaptiveTemperature, fib } = require('../../shared/phi-math.js');
const { CSLEngine, norm, normalize, dot, clamp, EPSILON } = require('./csl-engine');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default number of experts to activate per token (sparse activation).
 * fib(3) = 2 — already Fibonacci, made explicit via fib(). */
const DEFAULT_TOP_K = fib(3); // fib(3) = 2 (already Fibonacci — made explicit)

/** Default temperature for softmax over cosine scores.
 * PHI_TEMPERATURE = PSI^3 ≈ 0.236 — phi-harmonic softmax sharpness. */
const DEFAULT_TEMPERATURE = PHI_TEMPERATURE; // PSI^3 ≈ 0.236

/** Default load-balance penalty weight (anti-collapse regularization).
 * Math.pow(PSI, 8) ≈ 0.0131 — phi-scaled anti-collapse coefficient. */
const DEFAULT_BALANCE_WEIGHT = Math.pow(PSI, 8); // ≈ 0.0131 (PSI^8 phi-scaled)

/** Minimum utilization rate before expert is flagged as collapsed.
 * Math.pow(PSI, 9) ≈ 0.0081 — phi-scaled collapse detection floor. */
const COLLAPSE_THRESHOLD = Math.pow(PSI, 9); // ≈ 0.0081 (PSI^9 phi-scaled)

// ─── MoECSLRouter Class ───────────────────────────────────────────────────────

/**
 * MoECSLRouter — Cosine-Similarity-based Mixture of Experts Router
 *
 * Routes input vectors to the most semantically relevant expert agents
 * using cosine similarity gates. Supports top-k sparse activation with
 * load balancing and anti-collapse regularization.
 *
 * The router maintains a running utilization table across routing decisions,
 * enabling monitoring of expert usage patterns and detecting collapse.
 *
 * @class
 * @example
 * const router = new MoECSLRouter({ numExperts: 8, topK: 2, dim: 384 });
 * router.setExpertGate(0, codeVec);
 * router.setExpertGate(1, mathVec);
 * // ...
 * const { experts, weights } = router.route(inputVec);
 */
class MoECSLRouter {
  /**
   * @param {Object} [options]
   * @param {number} [options.numExperts=8] - Total number of experts
   * @param {number} [options.topK=2] - Experts activated per input
   * @param {number} [options.dim=384] - Vector dimension
   * @param {number} [options.temperature=0.1] - Softmax temperature (lower = sharper)
   * @param {number} [options.balanceWeight=0.01] - Anti-collapse regularization weight
   * @param {boolean} [options.normalizeGates=true] - Normalize gate vectors to unit sphere
   * @param {'hard'|'soft'} [options.selectionMode='soft'] - Expert selection mode
   */
  constructor(options = {}) {
    this.numExperts = options.numExperts || 8;
    this.topK = Math.min(options.topK || DEFAULT_TOP_K, this.numExperts);
    this.dim = options.dim || 384;
    this.temperature = options.temperature || DEFAULT_TEMPERATURE;
    this.balanceWeight = options.balanceWeight !== undefined
      ? options.balanceWeight
      : DEFAULT_BALANCE_WEIGHT;
    this.normalizeGates = options.normalizeGates !== false;
    this.selectionMode = options.selectionMode || 'soft';

    // Expert gate vectors (define each expert's semantic domain)
    this.expertGates = new Array(this.numExperts).fill(null);

    // Expert metadata
    this.expertMeta = Array.from({ length: this.numExperts }, (_, i) => ({
      id: i,
      name: `expert_${i}`,
      description: '',
    }));

    // Running statistics for load balancing
    this._stats = {
      totalRoutings: 0,
      expertCounts: new Float64Array(this.numExperts),  // cumulative activations
      expertTokens: new Float64Array(this.numExperts),  // weighted token count
      routingEntropies: [],                              // history of routing entropy
      batchSize: 0,
    };

    this._csl = new CSLEngine({ dim: this.dim });
  }

  // ─── Expert Configuration ─────────────────────────────────────────────────

  /**
   * Set the gate vector for a specific expert.
   *
   * The gate vector defines the semantic domain of the expert:
   * inputs cosine-similar to this vector will be routed here.
   *
   * @param {number} expertId - Expert index ∈ [0, numExperts)
   * @param {Float32Array|Float64Array|number[]} gateVector - Expert's semantic direction
   * @param {Object} [meta] - Optional metadata { name, description }
   */
  setExpertGate(expertId, gateVector, meta = null) {
    this._validateExpertId(expertId);

    if (gateVector.length !== this.dim) {
      throw new Error(`Gate vector dim ${gateVector.length} != router dim ${this.dim}`);
    }

    const gate = this.normalizeGates ? normalize(gateVector) : new Float64Array(gateVector);
    this.expertGates[expertId] = gate;

    if (meta) {
      Object.assign(this.expertMeta[expertId], meta);
    }
  }

  /**
   * Set all expert gates at once from an array of vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} gateVectors - One per expert
   * @param {Object[]} [metaArray] - Optional metadata for each expert
   */
  setAllExpertGates(gateVectors, metaArray = null) {
    if (gateVectors.length !== this.numExperts) {
      throw new Error(`Expected ${this.numExperts} gate vectors, got ${gateVectors.length}`);
    }
    gateVectors.forEach((gate, i) => {
      this.setExpertGate(i, gate, metaArray ? metaArray[i] : null);
    });
  }

  /**
   * Initialize expert gates as random orthogonal unit vectors.
   * Useful for testing or when no semantic labels are available.
   *
   * @param {number} [seed] - Not used (Math.random() is used internally)
   */
  initRandomGates(seed = null) {
    for (let i = 0; i < this.numExperts; i++) {
      const vec = new Float64Array(this.dim);
      for (let j = 0; j < this.dim; j++) {
        vec[j] = (Math.random() - PSI) * PHI; // phi-harmonic: center at PSI, scale by PHI
      }
      this.expertGates[i] = normalize(vec);
    }
  }

  // ─── Routing ─────────────────────────────────────────────────────────────

  /**
   * Route a single input vector to the top-k most relevant experts.
   *
   * Algorithm:
   *   1. Compute cosine similarity: sᵢ = cos(input, eᵢ) for each expert
   *   2. Apply load-balance adjustment: s̃ᵢ = sᵢ - λ · utilization_penalty(i)
   *   3. Temperature softmax: pᵢ = exp(s̃ᵢ/τ) / Σⱼ exp(s̃ⱼ/τ)
   *   4. Select top-k experts by probability
   *   5. Renormalize selected weights to sum to 1
   *   6. Update utilization statistics
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector to route
   * @param {Object} [options]
   * @param {boolean} [options.applyLoadBalance=true] - Apply anti-collapse penalty
   * @param {number} [options.topK] - Override default topK for this routing
   * @returns {{
   *   experts: number[],       // selected expert indices (topK)
   *   weights: number[],       // routing weights (sum to 1)
   *   cosScores: Float64Array, // raw cosine scores for all experts
   *   softmaxScores: Float64Array, // softmax probabilities for all experts
   *   entropy: number,         // routing distribution entropy (nats)
   *   dominantExpert: number,  // highest-weight expert
   * }}
   */
  route(input, options = {}) {
    this._validateGatesInitialized();

    const applyLB = options.applyLoadBalance !== false;
    const k = options.topK || this.topK;

    // Step 1: Compute cosine scores for all experts
    const cosScores = this._computeCosineScores(input);

    // Step 2: Apply load-balance penalty (anti-collapse regularization)
    const adjustedScores = new Float64Array(this.numExperts);
    const utilizationPenalties = this._computeUtilizationPenalties();

    for (let i = 0; i < this.numExperts; i++) {
      adjustedScores[i] = cosScores[i]
        - (applyLB ? this.balanceWeight * utilizationPenalties[i] : 0);
    }

    // Step 3: Temperature-controlled softmax
    const softmaxScores = this._softmax(adjustedScores, this.temperature);

    // Step 4: Select top-k experts
    const topExperts = this._topK(softmaxScores, k);

    // Step 5: Renormalize selected weights
    const sumTopK = topExperts.reduce((s, i) => s + softmaxScores[i], 0);
    const weights = topExperts.map(i => softmaxScores[i] / (sumTopK + EPSILON));

    // Step 6: Update statistics
    this._updateStats(topExperts, weights);

    // Compute routing entropy: H = -Σᵢ pᵢ log(pᵢ)
    const entropy = this._computeEntropy(softmaxScores);

    // Adaptive temperature: use phi-harmonic adaptiveTemperature() for next routing call.
    // PSI^(1 + 2*(1 - H/Hmax)) — sharper when distribution is concentrated, softer at max entropy.
    // maxEntropy = log(numExperts) for uniform distribution over all experts.
    const _adaptiveTemp = adaptiveTemperature(entropy, Math.log(this.numExperts));
    // Note: _adaptiveTemp is computed and exposed for callers; next route() call may use it
    // by passing options.temperature. See adaptiveRoute() pattern in documentation.

    return {
      experts: topExperts,
      weights,
      cosScores,
      softmaxScores,
      entropy,
      dominantExpert: topExperts[0],
      adaptiveTemp: _adaptiveTemp,  // phi-harmonic temperature for next routing step
    };
  }

  /**
   * Route a batch of input vectors simultaneously.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} inputs - Batch of inputs
   * @param {Object} [options] - Same as route()
   * @returns {Array<ReturnType<MoECSLRouter['route']>>} Array of routing results
   */
  routeBatch(inputs, options = {}) {
    this._stats.batchSize = inputs.length;
    return inputs.map(inp => this.route(inp, options));
  }

  /**
   * Soft routing — returns a weighted combination vector from all experts.
   * Instead of selecting top-k, uses full softmax distribution.
   *
   * @param {Float32Array|Float64Array|number[]} input
   * @param {Object[]} expertOutputs - Expert output vectors [{ id, vector }]
   * @returns {{ combined: Float64Array, weights: Float64Array }}
   */
  softRoute(input, expertOutputs) {
    this._validateGatesInitialized();

    const cosScores = this._computeCosineScores(input);
    const weights = this._softmax(cosScores, this.temperature);

    const dim = expertOutputs[0].vector.length;
    const combined = new Float64Array(dim);

    for (const { id, vector } of expertOutputs) {
      if (id >= 0 && id < this.numExperts) {
        const w = weights[id];
        for (let i = 0; i < dim; i++) {
          combined[i] += w * vector[i];
        }
      }
    }

    return { combined: normalize(combined), weights };
  }

  // ─── Load Balancing ───────────────────────────────────────────────────────

  /**
   * Compute the auxiliary load-balance loss for training.
   *
   * Anti-collapse regularization loss (from Switch Transformer):
   *   L_balance = α · N · Σᵢ fᵢ · Pᵢ
   *
   * Where:
   *   - fᵢ = fraction of tokens routed to expert i
   *   - Pᵢ = average routing probability for expert i
   *   - α = balanceWeight
   *   - N = number of experts
   *
   * @returns {{ loss: number, expertFractions: Float64Array, loadImbalance: number }}
   */
  computeBalanceLoss() {
    const total = this._stats.totalRoutings + EPSILON;
    const fractions = new Float64Array(this.numExperts);
    const probs = new Float64Array(this.numExperts);

    for (let i = 0; i < this.numExperts; i++) {
      fractions[i] = this._stats.expertCounts[i] / total;
      probs[i] = this._stats.expertTokens[i] / total;
    }

    // Anti-collapse loss: penalize unequal distribution
    let loss = 0;
    for (let i = 0; i < this.numExperts; i++) {
      loss += fractions[i] * probs[i];
    }
    loss *= this.numExperts * this.balanceWeight;

    // Load imbalance: max(fractions) / mean(fractions)
    const meanFrac = 1.0 / this.numExperts;
    const maxFrac = Math.max(...fractions);
    const loadImbalance = maxFrac / meanFrac;

    return { loss, expertFractions: fractions, loadImbalance };
  }

  /**
   * Detect expert collapse — experts that have been nearly unused.
   *
   * @returns {number[]} Indices of collapsed experts (utilization < COLLAPSE_THRESHOLD)
   */
  detectCollapse() {
    const total = this._stats.totalRoutings + EPSILON;
    const collapsed = [];

    for (let i = 0; i < this.numExperts; i++) {
      const utilRate = this._stats.expertCounts[i] / total;
      if (utilRate < COLLAPSE_THRESHOLD) {
        collapsed.push(i);
      }
    }

    return collapsed;
  }

  /**
   * Reset collapsed experts by re-initializing their gates to random vectors.
   *
   * @returns {number[]} Expert IDs that were reset
   */
  resetCollapsedExperts() {
    const collapsed = this.detectCollapse();

    for (const id of collapsed) {
      const vec = new Float64Array(this.dim);
      for (let j = 0; j < this.dim; j++) {
        vec[j] = (Math.random() - PSI) * PHI; // phi-harmonic: center at PSI, scale by PHI
      }
      this.expertGates[id] = normalize(vec);
      // Reset utilization to give fresh start
      this._stats.expertCounts[id] = this._stats.totalRoutings * COLLAPSE_THRESHOLD;
    }

    return collapsed;
  }

  // ─── Metrics ──────────────────────────────────────────────────────────────

  /**
   * Compute comprehensive routing metrics.
   *
   * @returns {{
   *   expertUtilization: Float64Array,  // fraction of tokens per expert [0,1]
   *   routingEntropy: number,           // mean routing entropy (nats)
   *   loadImbalance: number,            // max/mean utilization ratio
   *   collapsedExperts: number[],       // expert IDs with near-zero utilization
   *   totalRoutings: number,
   * }}
   */
  getMetrics() {
    const total = this._stats.totalRoutings + EPSILON;
    const expertUtilization = new Float64Array(this.numExperts);

    for (let i = 0; i < this.numExperts; i++) {
      expertUtilization[i] = this._stats.expertCounts[i] / total;
    }

    const meanUtil = 1.0 / this.numExperts;
    const maxUtil = Math.max(...expertUtilization);
    const loadImbalance = maxUtil / meanUtil;

    const entropies = this._stats.routingEntropies;
    const routingEntropy = entropies.length > 0
      ? entropies.reduce((s, x) => s + x, 0) / entropies.length
      : 0;

    return {
      expertUtilization,
      routingEntropy,
      loadImbalance,
      collapsedExperts: this.detectCollapse(),
      totalRoutings: this._stats.totalRoutings,
    };
  }

  /**
   * Reset all routing statistics.
   */
  resetStats() {
    this._stats = {
      totalRoutings: 0,
      expertCounts: new Float64Array(this.numExperts),
      expertTokens: new Float64Array(this.numExperts),
      routingEntropies: [],
      batchSize: 0,
    };
  }

  /**
   * Compute mutual information between experts (expert similarity matrix).
   * Experts with high cosine similarity between gate vectors will compete.
   *
   * @returns {Float64Array[]} numExperts × numExperts cosine similarity matrix
   */
  expertSimilarityMatrix() {
    const n = this.numExperts;
    const matrix = Array.from({ length: n }, () => new Float64Array(n));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      if (!this.expertGates[i]) continue;

      for (let j = i + 1; j < n; j++) {
        if (!this.expertGates[j]) continue;
        const sim = this._csl.AND(this.expertGates[i], this.expertGates[j]);
        matrix[i][j] = sim;
        matrix[j][i] = sim;
      }
    }

    return matrix;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Compute cosine scores of input against all expert gates.
   * @private
   */
  _computeCosineScores(input) {
    const scores = new Float64Array(this.numExperts);
    const normInput = norm(input);

    if (normInput < EPSILON) {
      return scores; // degenerate input: all zeros
    }

    for (let i = 0; i < this.numExperts; i++) {
      if (!this.expertGates[i]) {
        scores[i] = 0.0;
        continue;
      }
      const d = dot(input, this.expertGates[i]);
      const normGate = norm(this.expertGates[i]);
      scores[i] = normGate < EPSILON ? 0.0 : clamp(d / (normInput * normGate), -1.0, 1.0);
    }

    return scores;
  }

  /**
   * Temperature-controlled softmax.
   * σ(x)ᵢ = exp(xᵢ/τ) / Σⱼ exp(xⱼ/τ)
   *
   * Numerically stable: subtracts max before exponentiation.
   * @private
   */
  _softmax(scores, temperature) {
    const tau = temperature || this.temperature;
    const result = new Float64Array(scores.length);

    // Numerically stable: find max
    let maxScore = -Infinity;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > maxScore) maxScore = scores[i];
    }

    let sumExp = 0.0;
    for (let i = 0; i < scores.length; i++) {
      result[i] = Math.exp((scores[i] - maxScore) / tau);
      sumExp += result[i];
    }

    if (sumExp < EPSILON) {
      // Uniform fallback
      const uniform = 1.0 / scores.length;
      result.fill(uniform);
    } else {
      for (let i = 0; i < result.length; i++) {
        result[i] /= sumExp;
      }
    }

    return result;
  }

  /**
   * Select top-k indices from a probability array.
   * Returns indices sorted by probability (descending).
   * @private
   */
  _topK(probs, k) {
    const indexed = Array.from(probs, (p, i) => ({ i, p }));
    indexed.sort((a, b) => b.p - a.p);
    return indexed.slice(0, k).map(x => x.i);
  }

  /**
   * Compute utilization penalty for load balancing.
   * penalty[i] = (expertCounts[i] / total) / (1/numExperts) - 1
   *            = numExperts * expertCounts[i] / total - 1
   * @private
   */
  _computeUtilizationPenalties() {
    const total = this._stats.totalRoutings + EPSILON;
    const expected = 1.0 / this.numExperts;
    const penalties = new Float64Array(this.numExperts);

    for (let i = 0; i < this.numExperts; i++) {
      const actual = this._stats.expertCounts[i] / total;
      penalties[i] = Math.max(0, actual - expected) / expected; // excess utilization ratio
    }

    return penalties;
  }

  /**
   * Compute Shannon entropy of a probability distribution.
   * H = -Σᵢ pᵢ · log(pᵢ)   (nats)
   * @private
   */
  _computeEntropy(probs) {
    let H = 0;
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > EPSILON) {
        H -= probs[i] * Math.log(probs[i]);
      }
    }
    return H;
  }

  /**
   * Update routing statistics after a routing decision.
   * @private
   */
  _updateStats(selectedExperts, weights) {
    this._stats.totalRoutings++;

    for (let k = 0; k < selectedExperts.length; k++) {
      const id = selectedExperts[k];
      this._stats.expertCounts[id]++;
      this._stats.expertTokens[id] += weights[k];
    }

    // Track routing entropy history (keep last 1000)
    const scores = new Float64Array(this.numExperts);
    for (let k = 0; k < selectedExperts.length; k++) {
      scores[selectedExperts[k]] = weights[k];
    }

    const entropy = this._computeEntropy(scores);
    this._stats.routingEntropies.push(entropy);
    if (this._stats.routingEntropies.length > 1000) {
      this._stats.routingEntropies.shift();
    }
  }

  _validateExpertId(id) {
    if (id < 0 || id >= this.numExperts || !Number.isInteger(id)) {
      throw new Error(`Invalid expert ID: ${id}. Must be integer in [0, ${this.numExperts})`);
    }
  }

  _validateGatesInitialized() {
    const unset = this.expertGates.findIndex(g => g === null);
    if (unset !== -1) {
      throw new Error(`Expert gate ${unset} not initialized. Call setExpertGate() or initRandomGates()`);
    }
  }
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  MoECSLRouter,
  DEFAULT_TOP_K,
  DEFAULT_TEMPERATURE,
  DEFAULT_BALANCE_WEIGHT,
  COLLAPSE_THRESHOLD,
};
```

---

### `src/core/csl-gates-enhanced.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Continuous Semantic Logic Gates — Enhanced ───────────────────────────────
 *
 * Patent Docket: HS-058
 * Title: SYSTEM AND METHOD FOR CONTINUOUS SEMANTIC LOGIC GATES USING GEOMETRIC
 *        OPERATIONS IN HIGH-DIMENSIONAL VECTOR SPACES
 * Applicant: Heady Systems LLC  |  Inventor: Eric Haywood
 *
 * Satisfies ALL 10 claims of HS-058.
 *
 * THE 3 UNIVERSAL VECTOR GATES:
 *   1. Resonance Gate   (Semantic AND / IF)   — cosine similarity + sigmoid
 *   2. Superposition Gate (Semantic OR / MERGE) — weighted vector fusion
 *   3. Orthogonal Gate  (Semantic NOT / REJECT) — vector subtraction
 *
 * EXTENDED OPERATIONS (Claims 4-8):
 *   4. Multi-Resonance         — score N vectors against a target (Claim 4)
 *   5. Weighted Superposition  — biased fusion with configurable α (Claim 5)
 *   6. Consensus Superposition — fuse arbitrary N vectors (Claim 6)
 *   7. Batch Orthogonal        — strip multiple reject vectors in one pass (Claim 7)
 *   8. Soft Gate               — configurable sigmoid steepness/threshold (Claim 8)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// Golden ratio constant — used throughout HeadySystems implementations
const PHI = 1.6180339887;

// ── Statistics module — Claim 9(d): tracks gate invocation counts and avg scores
const _gateStats = {
    resonance:           0,
    superposition:       0,
    orthogonal:          0,
    softGate:            0,
    totalCalls:          0,
    avgResonanceScore:   0,
    _resonanceScoreSum:  0,
    _resonanceCallCount: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// VECTOR MATH PRIMITIVES (shared by all gates)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the dot product of two vectors.
 * @param {number[]|Float32Array} a
 * @param {number[]|Float32Array} b
 * @returns {number}
 */
function dot_product(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}

/**
 * Compute the L2 norm (magnitude) of a vector.
 * @param {number[]|Float32Array} v
 * @returns {number}
 */
function norm(v) {
    let sum = 0;
    for (let i = 0; i < v.length; i++) {
        sum += v[i] * v[i];
    }
    return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length.
 * @param {number[]|Float32Array} v
 * @returns {Float32Array}
 */
function normalize(v) {
    const n = norm(v);
    if (n < 1e-10) return Float32Array.from(v);
    const res = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) {
        res[i] = v[i] / n;
    }
    return res;
}

/**
 * Cosine similarity between two N-dimensional vectors.
 * Returns a value in [-1, 1].
 * @param {number[]|Float32Array} a
 * @param {number[]|Float32Array} b
 * @returns {number}
 */
function cosine_similarity(a, b) {
    if (!a || !b || a.length === 0 || b.length === 0) return 0;
    const dot = dot_product(a, b);
    const normA = norm(a);
    const normB = norm(b);
    return dot / (normA * normB || 1e-10);
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT GATE — Continuous Activation Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soft Gate: sigmoid activation σ(x) = 1 / (1 + e^(-k(x - θ)))
 * Produces a continuous activation value between 0 and 1.
 *
 * // RTP: HS-058 Claim 8 — configurable sigmoid steepness k and threshold θ
 *
 * @param {number} score      — raw cosine similarity score
 * @param {number} threshold  — center of the sigmoid (θ), default 0.5
 * @param {number} steepness  — how sharp the transition is (k), default 20
 * @returns {number} continuous activation ∈ [0, 1]
 */
function soft_gate(score, threshold = 0.5, steepness = 20) {
    // RTP: HS-058 Claim 1(c) — sigmoid applied to similarity score
    // RTP: HS-058 Claim 8    — configurable k (steepness) and θ (threshold)
    _gateStats.softGate++;
    _gateStats.totalCalls++;
    return 1.0 / (1.0 + Math.exp(-steepness * (score - threshold)));
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 1: RESONANCE GATE  (Semantic IF / AND)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resonance Gate: measures cosine similarity between two N≥128 dimensional
 * vectors and applies sigmoid activation.
 *
 * // RTP: HS-058 Claim 1 — receives two N≥128-dim vectors, computes cosine
 * //                        similarity, applies sigmoid, returns structured result.
 *
 * @param {number[]|Float32Array} vec_a     — first embedding vector (N ≥ 128 dims)
 * @param {number[]|Float32Array} vec_b     — second embedding vector (N ≥ 128 dims)
 * @param {number}                threshold — sigmoid center θ (default 0.5)
 * @param {number}                steepness — sigmoid slope k (default 20)
 * @returns {{ score: number, activation: number, open: boolean }}
 */
function resonance_gate(vec_a, vec_b, threshold = 0.5, steepness = 20) {
    // RTP: HS-058 Claim 1(a) — receive two N-dimensional embedding vectors
    if (!vec_a || !vec_b) throw new Error('resonance_gate: both vectors required');

    // RTP: HS-058 Claim 1(b) — compute continuous alignment score via cosine similarity
    const score = cosine_similarity(vec_a, vec_b);

    // RTP: HS-058 Claim 1(c) — apply sigmoid activation function
    // RTP: HS-058 Claim 8    — sigmoid uses configurable steepness and threshold
    const activation = soft_gate(score, threshold, steepness);

    _gateStats.resonance++;
    _gateStats.totalCalls++;
    _gateStats._resonanceScoreSum += score;
    _gateStats._resonanceCallCount++;
    _gateStats.avgResonanceScore = _gateStats._resonanceScoreSum / _gateStats._resonanceCallCount;

    // RTP: HS-058 Claim 1(d) — return activation value and score as structured gate result
    return {
        score:      +score.toFixed(6),
        activation: +activation.toFixed(6),
        open:       activation >= 0.5,
        threshold,
        steepness,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 1 EXTENSION: MULTI-RESONANCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multi-Resonance: scores a plurality of candidate vectors against a single
 * target simultaneously and returns a sorted array of results.
 *
 * // RTP: HS-058 Claim 4 — scores multiple candidates against single target,
 * //                        returns sorted array of alignment scores and activations.
 *
 * @param {number[]|Float32Array}            target     — reference vector
 * @param {Array<number[]|Float32Array>}     candidates — vectors to score
 * @param {number}                           threshold  — sigmoid threshold
 * @param {number}                           steepness  — sigmoid steepness
 * @returns {Array<{ index: number, score: number, activation: number, open: boolean }>}
 */
function multi_resonance(target, candidates, threshold = 0.5, steepness = 20) {
    // RTP: HS-058 Claim 4 — score plurality of candidate vectors simultaneously
    if (!Array.isArray(candidates) || candidates.length === 0) return [];

    return candidates
        .map((c, i) => {
            const score = cosine_similarity(target, c);
            const activation = soft_gate(score, threshold, steepness);
            _gateStats.resonance++;
            _gateStats.totalCalls++;
            _gateStats._resonanceScoreSum += score;
            _gateStats._resonanceCallCount++;
            return {
                index:      i,
                score:      +score.toFixed(6),
                activation: +activation.toFixed(6),
                open:       activation >= 0.5,
            };
        })
        // RTP: HS-058 Claim 4 — return SORTED array (descending by score)
        .sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 2: SUPERPOSITION GATE  (Semantic OR / MERGE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Superposition Gate: fuses two concept vectors into a normalized hybrid vector.
 * Basic (equal-weight) form: S(A, B) = normalize(A + B)
 *
 * // RTP: HS-058 Claim 2 — receives plurality of vectors, computes weighted sum,
 * //                        normalizes, returns unit vector as new hybrid concept.
 *
 * @param {number[]|Float32Array} vec_a — concept A
 * @param {number[]|Float32Array} vec_b — concept B
 * @returns {Float32Array} normalized hybrid concept vector
 */
function superposition_gate(vec_a, vec_b) {
    // RTP: HS-058 Claim 2(a) — receive plurality of embedding vectors
    const len = vec_a.length;
    const hybrid = new Float32Array(len);
    // RTP: HS-058 Claim 2(b) — compute weighted sum (equal weight = 0.5 each)
    for (let i = 0; i < len; i++) {
        hybrid[i] = vec_a[i] + vec_b[i];
    }
    _gateStats.superposition++;
    _gateStats.totalCalls++;
    // RTP: HS-058 Claim 2(c) — normalize result to unit vector
    // RTP: HS-058 Claim 2(d) — return unit vector as new hybrid semantic concept
    return normalize(hybrid);
}

/**
 * Weighted Superposition: biased fusion with configurable α.
 * S(A, B, α) = normalize(α·A + (1−α)·B)
 *
 * // RTP: HS-058 Claim 5 — α ∈ [0,1]; α=1.0 returns A; α=0.0 returns B.
 *
 * @param {number[]|Float32Array} vec_a  — concept A
 * @param {number[]|Float32Array} vec_b  — concept B
 * @param {number}                alpha  — weight for vec_a ∈ [0.0, 1.0]
 * @returns {Float32Array} normalized weighted hybrid vector
 */
function weighted_superposition(vec_a, vec_b, alpha = 0.5) {
    // RTP: HS-058 Claim 5 — alpha ∈ [0.0,1.0]; (1-alpha) applied to vec_b
    if (alpha < 0 || alpha > 1) throw new Error('weighted_superposition: alpha must be in [0, 1]');
    const beta = 1.0 - alpha;
    const len = vec_a.length;
    const hybrid = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        hybrid[i] = alpha * vec_a[i] + beta * vec_b[i];
    }
    _gateStats.superposition++;
    _gateStats.totalCalls++;
    return normalize(hybrid);
}

/**
 * Consensus Superposition: fuses an arbitrary number of vectors into a single
 * normalized consensus vector using sum + normalize.
 *
 * // RTP: HS-058 Claim 6 — fuses arbitrary N vectors via sum + normalize.
 *
 * @param {Array<number[]|Float32Array>} vectors — vectors to fuse
 * @returns {Float32Array} normalized consensus vector
 */
function consensus_superposition(vectors) {
    // RTP: HS-058 Claim 6 — arbitrary number of vectors, sum all, normalize result
    if (!vectors || vectors.length === 0) return new Float32Array(0);
    const len = vectors[0].length;
    const fused = new Float32Array(len);
    for (const v of vectors) {
        for (let i = 0; i < len; i++) {
            fused[i] += v[i];
        }
    }
    _gateStats.superposition++;
    _gateStats.totalCalls++;
    return normalize(fused);
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 3: ORTHOGONAL GATE  (Semantic NOT / REJECT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orthogonal Gate: removes a semantic concept from a target vector by
 * projecting the target onto the orthogonal complement of the rejection vector.
 * O(T, L) = normalize(T − ((T·L)/(L·L))·L)
 *
 * // RTP: HS-058 Claim 3 — receives target + rejection vectors, projects target
 * //                        onto orthogonal complement, returns purified unit vector.
 *
 * @param {number[]|Float32Array} target_vec  — base intent vector
 * @param {number[]|Float32Array} reject_vec  — concept to remove
 * @returns {Float32Array} purified orthogonal unit vector
 */
function orthogonal_gate(target_vec, reject_vec) {
    // RTP: HS-058 Claim 3(a) — receive target vector and rejection vector
    const len = target_vec.length;
    const dotTR = dot_product(target_vec, reject_vec);
    const dotRR = dot_product(reject_vec, reject_vec);
    const projectionFactor = dotTR / (dotRR || 1e-10);

    // RTP: HS-058 Claim 3(b) — project target onto each rejection, subtract projections
    const result = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        result[i] = target_vec[i] - projectionFactor * reject_vec[i];
    }
    _gateStats.orthogonal++;
    _gateStats.totalCalls++;
    // RTP: HS-058 Claim 3(c) — normalize to produce purified unit vector
    // RTP: HS-058 Claim 3(d) — return purified vector
    return normalize(result);
}

/**
 * Batch Orthogonal: iteratively removes multiple rejection vectors from the
 * target in a single pass.
 *
 * // RTP: HS-058 Claim 7 — iteratively removes multiple rejection vectors in a single pass.
 *
 * @param {number[]|Float32Array}        target_vec  — base intent vector
 * @param {Array<number[]|Float32Array>} reject_vecs — concepts to strip out
 * @returns {Float32Array} purified vector with all rejections removed
 */
function batch_orthogonal(target_vec, reject_vecs) {
    // RTP: HS-058 Claim 7 — single pass through all rejection vectors
    let current = Float32Array.from(target_vec);
    for (const reject of reject_vecs) {
        const dotTR = dot_product(current, reject);
        const dotRR = dot_product(reject, reject);
        const factor = dotTR / (dotRR || 1e-10);
        for (let i = 0; i < current.length; i++) {
            current[i] -= factor * reject[i];
        }
    }
    _gateStats.orthogonal++;
    _gateStats.totalCalls++;
    return normalize(current);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS MODULE — Claim 9(d)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return a snapshot of gate invocation counts and average scores.
 *
 * // RTP: HS-058 Claim 9(d) — statistics module tracking gate invocation counts
 * //                            and average scores.
 * @returns {object}
 */
function getStats() {
    // RTP: HS-058 Claim 9(d)
    return {
        resonance:         _gateStats.resonance,
        superposition:     _gateStats.superposition,
        orthogonal:        _gateStats.orthogonal,
        softGate:          _gateStats.softGate,
        totalCalls:        _gateStats.totalCalls,
        avgResonanceScore: _gateStats._resonanceCallCount > 0
            ? +(_gateStats._resonanceScoreSum / _gateStats._resonanceCallCount).toFixed(6)
            : 0,
    };
}

/**
 * Reset all statistics counters.
 */
function resetStats() {
    _gateStats.resonance           = 0;
    _gateStats.superposition       = 0;
    _gateStats.orthogonal          = 0;
    _gateStats.softGate            = 0;
    _gateStats.totalCalls          = 0;
    _gateStats.avgResonanceScore   = 0;
    _gateStats._resonanceScoreSum  = 0;
    _gateStats._resonanceCallCount = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL CSL SYSTEM — Claim 9: complete system exposing all gates + stats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSLSystem: the full Continuous Semantic Logic system as a single object.
 *
 * // RTP: HS-058 Claim 9  — system with Resonance Gate module, Superposition Gate
 * //                         module, Orthogonal Gate module, statistics module, and
 * //                         API layer (see csl-routes.js).
 * // RTP: HS-058 Claim 10 — replaces all discrete boolean logic in vector memory
 * //                         subsystem, hybrid search subsystem, and self-healing
 * //                         attestation mesh with continuous geometric operations.
 */
class CSLSystem {

    constructor(opts = {}) {
        // RTP: HS-058 Claim 8 — configurable sigmoid steepness and threshold
        this.defaultThreshold = opts.threshold !== undefined ? opts.threshold : 0.5;
        this.defaultSteepness = opts.steepness !== undefined ? opts.steepness : 20;
    }

    // ── Resonance Gate module (Claim 9a) ───────────────────────────────────

    /**
     * Resonance Gate — Claim 1 core method.
     * // RTP: HS-058 Claim 1
     */
    resonance(vec_a, vec_b, threshold, steepness) {
        // RTP: HS-058 Claim 1
        return resonance_gate(
            vec_a,
            vec_b,
            threshold !== undefined ? threshold : this.defaultThreshold,
            steepness !== undefined ? steepness : this.defaultSteepness,
        );
    }

    /**
     * Multi-Resonance — Claim 4 extension.
     * // RTP: HS-058 Claim 4
     */
    multiResonance(target, candidates, threshold, steepness) {
        // RTP: HS-058 Claim 4
        return multi_resonance(
            target,
            candidates,
            threshold !== undefined ? threshold : this.defaultThreshold,
            steepness !== undefined ? steepness : this.defaultSteepness,
        );
    }

    // ── Superposition Gate module (Claim 9b) ───────────────────────────────

    /**
     * Superposition Gate — Claim 2 core method.
     * // RTP: HS-058 Claim 2
     */
    superposition(vec_a, vec_b) {
        // RTP: HS-058 Claim 2
        return superposition_gate(vec_a, vec_b);
    }

    /**
     * Weighted Superposition — Claim 5 configurable alpha.
     * // RTP: HS-058 Claim 5
     */
    weightedSuperposition(vec_a, vec_b, alpha = 0.5) {
        // RTP: HS-058 Claim 5
        return weighted_superposition(vec_a, vec_b, alpha);
    }

    /**
     * Consensus Superposition — Claim 6 arbitrary N vectors.
     * // RTP: HS-058 Claim 6
     */
    consensusSuperposition(vectors) {
        // RTP: HS-058 Claim 6
        return consensus_superposition(vectors);
    }

    // ── Orthogonal Gate module (Claim 9c) ──────────────────────────────────

    /**
     * Orthogonal Gate — Claim 3 core method.
     * // RTP: HS-058 Claim 3
     */
    orthogonal(target_vec, reject_vec) {
        // RTP: HS-058 Claim 3
        return orthogonal_gate(target_vec, reject_vec);
    }

    /**
     * Batch Orthogonal — Claim 7 multi-rejection single pass.
     * // RTP: HS-058 Claim 7
     */
    batchOrthogonal(target_vec, reject_vecs) {
        // RTP: HS-058 Claim 7
        return batch_orthogonal(target_vec, reject_vecs);
    }

    // ── Soft Gate (sigmoid) — Claim 8 ─────────────────────────────────────

    /**
     * Soft Gate with configurable steepness and threshold.
     * // RTP: HS-058 Claim 8
     */
    softGate(score, threshold, steepness) {
        // RTP: HS-058 Claim 8
        return soft_gate(
            score,
            threshold !== undefined ? threshold : this.defaultThreshold,
            steepness !== undefined ? steepness : this.defaultSteepness,
        );
    }

    // ── Statistics module — Claim 9(d) ────────────────────────────────────

    /**
     * Get gate invocation counts and average scores.
     * // RTP: HS-058 Claim 9(d)
     */
    getStats() {
        // RTP: HS-058 Claim 9(d)
        return getStats();
    }

    resetStats() {
        resetStats();
    }

    // ── Integration Replacement Points — Claim 10 ─────────────────────────

    /**
     * Vector Memory Density Gate: replaces boolean deduplication.
     * Returns continuous alignment — downstream decides with soft threshold.
     *
     * // RTP: HS-058 Claim 10 — replacement integration point: vector memory subsystem
     *
     * @param {number[]|Float32Array} newMemoryVec    — incoming memory embedding
     * @param {number[]|Float32Array} existingMemVec  — candidate existing memory
     * @param {number}               threshold        — deduplication threshold
     * @returns {{ isDuplicate: boolean, score: number, activation: number }}
     */
    vectorMemoryDensityGate(newMemoryVec, existingMemVec, threshold = 0.92) {
        // RTP: HS-058 Claim 10 — replaces discrete boolean deduplication
        const result = this.resonance(newMemoryVec, existingMemVec, threshold);
        return {
            isDuplicate: result.open,
            score:       result.score,
            activation:  result.activation,
        };
    }

    /**
     * Hybrid Search Score: replaces boolean similarity cutoffs.
     * Returns continuous relevance score.
     *
     * // RTP: HS-058 Claim 10 — replacement integration point: hybrid search subsystem
     *
     * @param {number[]|Float32Array}        queryVec    — query embedding
     * @param {Array<number[]|Float32Array>} docVecs     — document embeddings
     * @param {number}                       threshold   — relevance threshold
     * @returns {Array<{ index: number, score: number, activation: number, open: boolean }>}
     */
    hybridSearchScore(queryVec, docVecs, threshold = 0.5) {
        // RTP: HS-058 Claim 10 — replaces discrete cutoff in hybrid search
        return this.multiResonance(queryVec, docVecs, threshold);
    }

    /**
     * Hallucination Detection: replaces boolean confidence threshold.
     * Returns continuous alignment of agent output against mesh consensus.
     *
     * // RTP: HS-058 Claim 10 — replacement integration point: self-healing attestation mesh
     *
     * @param {number[]|Float32Array} agentOutputVec  — agent output embedding
     * @param {number[]|Float32Array} consensusVec    — mesh consensus vector
     * @param {number}               threshold        — hallucination threshold
     * @returns {{ score: number, activation: number, hallucinated: boolean }}
     */
    hallucinationDetectionGate(agentOutputVec, consensusVec, threshold = 0.7) {
        // RTP: HS-058 Claim 10 — replaces discrete hallucination detection in mesh
        const result = this.resonance(agentOutputVec, consensusVec, threshold);
        return {
            score:        result.score,
            activation:   result.activation,
            hallucinated: !result.open,
        };
    }

    // ── Shared math utilities (exposed for external callers) ───────────────

    cosineSimilarity(a, b) { return cosine_similarity(a, b); }
    dotProduct(a, b)       { return dot_product(a, b); }
    normalize(v)           { return normalize(v); }
    norm(v)                { return norm(v); }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    PHI,

    // Primitive math
    dot_product,
    norm,
    normalize,
    cosine_similarity,

    // Individual gate functions (functional API)
    soft_gate,
    resonance_gate,
    multi_resonance,
    superposition_gate,
    weighted_superposition,
    consensus_superposition,
    orthogonal_gate,
    batch_orthogonal,

    // Stats
    getStats,
    resetStats,

    // Full system class (OOP API)
    CSLSystem,

    // Convenience default instance with production defaults
    // RTP: HS-058 Claim 9 — instantiated full system
    defaultCSL: new CSLSystem({ threshold: 0.5, steepness: 20 }),
};
```

---

### `src/core/phi-scales-csl.js`

```javascript
'use strict';

/**
 * phi-scales.js — Core Phi Scale Engine
 * Heady AI Orchestration Platform
 *
 * Implements phi-harmonic (golden ratio) numeric scaling, decay, partitioning,
 * normalization, and spiral path generation. All classes integrate with the
 * CSL system (semantic-logic.js) and emit structured telemetry via the logger.
 */

const logger = require('../utils/logger');
const csl    = require('./semantic-logic');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHI          = 1.618033988749895;
const PHI_INVERSE  = 0.618033988749895;   // 1 / PHI  (= PHI - 1)
const SQRT_PHI     = Math.sqrt(PHI);       // ≈ 1.272019649514069
const PHI_SQUARED  = PHI * PHI;            // ≈ 2.618033988749895
const PHI_CUBED    = PHI * PHI * PHI;      // ≈ 4.23606797749979
const LOG_PHI      = Math.log(PHI);        // ≈ 0.48121182505960344
const TWO_PI_PHI   = 2 * Math.PI * PHI;   // ≈ 10.166407384630987

/** First 30 Fibonacci numbers (F(0)=0 … F(29)=514229) */
const FIBONACCI_SEQUENCE = (function buildFib() {
  const seq = [0, 1];
  for (let i = 2; i < 30; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return Object.freeze(seq);
}());

// ---------------------------------------------------------------------------
// PhiRange
// ---------------------------------------------------------------------------

/**
 * Represents a numeric range optionally mapped through phi coordinates.
 * When phiNormalized is true the "phi point" (equilibrium) sits at the
 * golden ratio of the span, i.e. baseMin + (baseMax-baseMin)*PHI_INVERSE.
 */
class PhiRange {
  /**
   * @param {number} baseMin
   * @param {number} baseMax
   * @param {boolean} [phiNormalized=false]
   */
  constructor(baseMin, baseMax, phiNormalized = false) {
    if (baseMin >= baseMax) {
      throw new RangeError(`PhiRange: baseMin (${baseMin}) must be less than baseMax (${baseMax})`);
    }
    this.baseMin       = baseMin;
    this.baseMax       = baseMax;
    this.phiNormalized = phiNormalized;
    this.span          = baseMax - baseMin;
    this._phiPoint     = baseMin + this.span * PHI_INVERSE;

    logger.debug('PhiRange created', {
      baseMin, baseMax, phiNormalized, phiPoint: this._phiPoint,
    });
  }

  /**
   * Map a raw value to [0, 1].  In phi-normalized mode the mapping is
   * non-linear: values below the phi-point are compressed into [0, PHI_INVERSE]
   * and values above are stretched into [PHI_INVERSE, 1].
   * @param {number} value
   * @returns {number} normalized in [0, 1]
   */
  normalize(value) {
    const clamped = Math.max(this.baseMin, Math.min(this.baseMax, value));
    if (!this.phiNormalized) {
      return (clamped - this.baseMin) / this.span;
    }
    // Below phi-point: linear across [0, PHI_INVERSE]
    if (clamped <= this._phiPoint) {
      const subSpan = this._phiPoint - this.baseMin;
      return subSpan === 0 ? 0 : ((clamped - this.baseMin) / subSpan) * PHI_INVERSE;
    }
    // Above phi-point: linear across [PHI_INVERSE, 1]
    const superSpan = this.baseMax - this._phiPoint;
    return superSpan === 0
      ? 1
      : PHI_INVERSE + ((clamped - this._phiPoint) / superSpan) * (1 - PHI_INVERSE);
  }

  /**
   * Invert normalize() — map a [0, 1] value back to the raw range.
   * @param {number} normalized
   * @returns {number}
   */
  denormalize(normalized) {
    const n = Math.max(0, Math.min(1, normalized));
    if (!this.phiNormalized) {
      return this.baseMin + n * this.span;
    }
    if (n <= PHI_INVERSE) {
      const subSpan = this._phiPoint - this.baseMin;
      return this.baseMin + (n / PHI_INVERSE) * subSpan;
    }
    const superSpan = this.baseMax - this._phiPoint;
    return this._phiPoint + ((n - PHI_INVERSE) / (1 - PHI_INVERSE)) * superSpan;
  }

  /** @returns {number} the phi equilibrium point in raw units */
  atPhiPoint() {
    return this._phiPoint;
  }

  /**
   * @param {number} value
   * @returns {boolean} true if value is above the phi equilibrium
   */
  abovePhiPoint(value) {
    return value > this._phiPoint;
  }

  /**
   * @param {number} value
   * @returns {boolean} true if value is below the phi equilibrium
   */
  belowPhiPoint(value) {
    return value < this._phiPoint;
  }

  /**
   * Signed distance from the phi equilibrium point (negative = below).
   * @param {number} value
   * @returns {number}
   */
  distanceFromPhi(value) {
    return value - this._phiPoint;
  }

  /**
   * Split the range at the phi point and return both sub-ranges.
   * @returns {{ lower: PhiRange, upper: PhiRange }}
   */
  goldenPartition() {
    return {
      lower: new PhiRange(this.baseMin, this._phiPoint, this.phiNormalized),
      upper: new PhiRange(this._phiPoint, this.baseMax, this.phiNormalized),
    };
  }

  /**
   * @param {number} value
   * @returns {boolean}
   */
  contains(value) {
    return value >= this.baseMin && value <= this.baseMax;
  }
}

// ---------------------------------------------------------------------------
// PhiScale
// ---------------------------------------------------------------------------

/**
 * Core wrapping class for any phi-scaled numeric value.
 * Integrates momentum smoothing, telemetry adjustment, history tracking,
 * and CSL gate hooks.
 */
class PhiScale {
  /**
   * @param {object}   opts
   * @param {string}   [opts.name='unnamed']
   * @param {number}   [opts.baseValue=1]
   * @param {number}   [opts.min=0]
   * @param {number}   [opts.max=PHI_SQUARED]
   * @param {boolean}  [opts.phiNormalized=false]
   * @param {number}   [opts.sensitivity=0.1]
   * @param {number}   [opts.momentumDecay=0.8]
   * @param {Function} [opts.telemetryFeed=null]
   * @param {number}   [opts.maxHistorySize=200]
   * @param {boolean}  [opts.enforceBounds=true]
   * @param {string}   [opts.unit='']
   * @param {string}   [opts.category='']
   * @param {string}   [opts.cslGate=null]
   */
  constructor(opts = {}) {
    this.name          = opts.name          ?? 'unnamed';
    this.baseValue     = opts.baseValue     ?? 1;
    this.min           = opts.min           ?? 0;
    this.max           = opts.max           ?? PHI_SQUARED;
    this.phiNormalized = opts.phiNormalized ?? false;
    this.sensitivity   = opts.sensitivity   ?? 0.1;
    this.momentumDecay = opts.momentumDecay ?? 0.8;
    this.telemetryFeed = opts.telemetryFeed ?? null;
    this.maxHistorySize= opts.maxHistorySize?? 200;
    this.enforceBounds = opts.enforceBounds ?? true;
    this.unit          = opts.unit          ?? '';
    this.category      = opts.category      ?? '';
    this.cslGate       = opts.cslGate       ?? null;

    if (this.baseValue < this.min || this.baseValue > this.max) {
      logger.warn('PhiScale: baseValue outside [min, max], clamping', {
        name: this.name, baseValue: this.baseValue, min: this.min, max: this.max,
      });
      this.baseValue = Math.max(this.min, Math.min(this.max, this.baseValue));
    }

    this.current  = this.baseValue;
    this._momentum = 0;
    this._history  = []; // { ts, value, delta, metrics }

    this._range = new PhiRange(this.min, this.max, this.phiNormalized);

    // CSL gate registration
    if (this.cslGate) {
      try {
        if (csl && typeof csl.registerGate === 'function') {
          csl.registerGate(this.cslGate, { phiScale: this.name });
        }
      } catch (err) {
        logger.warn('PhiScale: CSL gate registration failed', {
          name: this.name, cslGate: this.cslGate, error: err.message,
        });
      }
    }

    logger.debug('PhiScale created', {
      name: this.name, baseValue: this.baseValue, min: this.min, max: this.max,
    });
  }

  /** Current numeric value */
  get value() {
    return this.current;
  }

  /** Integer representation */
  asInt() {
    return Math.round(this.current);
  }

  /** Millisecond representation (always non-negative integer) */
  asMs() {
    return Math.max(0, Math.round(this.current));
  }

  /**
   * Floating-point representation with configurable decimal places.
   * @param {number} [precision=4]
   * @returns {number}
   */
  asFloat(precision = 4) {
    const factor = Math.pow(10, precision);
    return Math.round(this.current * factor) / factor;
  }

  /**
   * Apply a telemetry-driven adjustment with momentum smoothing.
   * The adjustment signal may come from opts.telemetryFeed or be passed directly.
   *
   * Momentum model:
   *   momentum = decay * momentum + (1 - decay) * rawAdjustment
   *   delta    = sensitivity * momentum
   *   current += delta  (clamped to [min, max] if enforceBounds)
   *
   * @param {object} [metrics={}]  arbitrary telemetry payload
   * @returns {number} new current value
   */
  adjust(metrics = {}) {
    let rawAdjustment = 0;

    // If a telemetryFeed function is wired, call it to obtain a scalar signal
    if (typeof this.telemetryFeed === 'function') {
      try {
        rawAdjustment = this.telemetryFeed(metrics, this.current, this) ?? 0;
      } catch (err) {
        logger.error('PhiScale: telemetryFeed threw', {
          name: this.name, error: err.message,
        });
        rawAdjustment = 0;
      }
    } else if (typeof metrics.adjustment === 'number') {
      rawAdjustment = metrics.adjustment;
    } else if (typeof metrics.signal === 'number') {
      rawAdjustment = metrics.signal;
    }

    this._momentum = this.momentumDecay * this._momentum
                   + (1 - this.momentumDecay) * rawAdjustment;

    const delta    = this.sensitivity * this._momentum;
    const proposed = this.current + delta;

    const next = this.enforceBounds
      ? Math.max(this.min, Math.min(this.max, proposed))
      : proposed;

    const entry = { ts: Date.now(), value: next, delta, metrics };
    this._history.push(entry);
    if (this._history.length > this.maxHistorySize) {
      this._history.shift();
    }

    this.current = next;

    logger.debug('PhiScale.adjust', {
      name: this.name, rawAdjustment, momentum: this._momentum,
      delta, prev: this.current - delta, next,
    });

    return this.current;
  }

  /**
   * Normalized position of current value in [0, 1].
   * @returns {number}
   */
  normalized() {
    return this._range.normalize(this.current);
  }

  /**
   * @returns {boolean} true when current normalized value > PHI_INVERSE
   */
  isAbovePhi() {
    return this.normalized() > PHI_INVERSE;
  }

  /**
   * @returns {boolean} true when current normalized value < PHI_INVERSE
   */
  isBelowPhi() {
    return this.normalized() < PHI_INVERSE;
  }

  /**
   * Signed distance of the current normalized value from the phi equilibrium.
   * @returns {number}
   */
  phiDeviation() {
    return this.normalized() - PHI_INVERSE;
  }

  /** Restore current value to baseValue and clear momentum & history. */
  reset() {
    logger.info('PhiScale.reset', { name: this.name, from: this.current, to: this.baseValue });
    this.current   = this.baseValue;
    this._momentum = 0;
    this._history  = [];
  }

  /**
   * Descriptive statistics over recorded history values.
   * @returns {{ mean: number, stddev: number, min: number, max: number, count: number }}
   */
  stats() {
    if (this._history.length === 0) {
      return { mean: this.current, stddev: 0, min: this.current, max: this.current, count: 0 };
    }
    const values = this._history.map(h => h.value);
    const n      = values.length;
    const mean   = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    return {
      mean,
      stddev: Math.sqrt(variance),
      min:    Math.min(...values),
      max:    Math.max(...values),
      count:  n,
    };
  }

  /**
   * Trend direction based on recent history (last 10 samples).
   * @returns {'increasing'|'decreasing'|'stable'}
   */
  trend() {
    const window = this._history.slice(-10);
    if (window.length < 2) return 'stable';
    const first = window[0].value;
    const last  = window[window.length - 1].value;
    const span  = this.max - this.min;
    const threshold = span * 0.01; // 1 % of full range
    if (last - first >  threshold) return 'increasing';
    if (first - last >  threshold) return 'decreasing';
    return 'stable';
  }

  /**
   * Soft sigmoid gate centred at the phi equilibrium.
   * σ(x) = 1 / (1 + e^(-20 * (x - 0.618)))
   * @returns {number} activation in (0, 1)
   */
  cslActivation() {
    const x = this.normalized();
    const activation = 1 / (1 + Math.exp(-20 * (x - PHI_INVERSE)));

    if (this.cslGate) {
      try {
        if (csl && typeof csl.activateGate === 'function') {
          csl.activateGate(this.cslGate, activation);
        }
      } catch (err) {
        logger.warn('PhiScale.cslActivation: gate call failed', {
          name: this.name, error: err.message,
        });
      }
    }

    logger.debug('PhiScale.cslActivation', { name: this.name, normalized: x, activation });
    return activation;
  }

  /**
   * CSL ternary classification:
   *   +1  above phi equilibrium (≥ PHI_INVERSE + tolerance)
   *    0  at phi equilibrium    (within tolerance)
   *   -1  below phi equilibrium (≤ PHI_INVERSE - tolerance)
   * @param {number} [tolerance=0.05]
   * @returns {1|0|-1}
   */
  cslTernary(tolerance = 0.05) {
    const dev = this.phiDeviation();
    if (dev >  tolerance) return  1;
    if (dev < -tolerance) return -1;
    return 0;
  }

  /**
   * Phi-deviation as a normalized risk signal in [0, 1].
   * Risk is 0 at equilibrium and rises toward 1 as the value moves to either extreme.
   * @returns {number}
   */
  cslRisk() {
    const dev  = Math.abs(this.phiDeviation());  // 0 at phi, up to ~0.618 at extremes
    const risk = Math.min(1, dev / PHI_INVERSE);
    logger.debug('PhiScale.cslRisk', { name: this.name, deviation: dev, risk });
    return risk;
  }

  /**
   * Serialize the current state to a plain JSON-safe object.
   * @returns {object}
   */
  snapshot() {
    return {
      name:          this.name,
      baseValue:     this.baseValue,
      current:       this.current,
      min:           this.min,
      max:           this.max,
      phiNormalized: this.phiNormalized,
      sensitivity:   this.sensitivity,
      momentumDecay: this.momentumDecay,
      enforceBounds: this.enforceBounds,
      unit:          this.unit,
      category:      this.category,
      cslGate:       this.cslGate,
      momentum:      this._momentum,
      history:       this._history.slice(), // shallow copy
      ts:            Date.now(),
    };
  }

  /**
   * Restore state from a previously produced snapshot.
   * @param {object} snap
   */
  restore(snap) {
    if (!snap || typeof snap !== 'object') {
      throw new TypeError('PhiScale.restore: snapshot must be an object');
    }
    this.name          = snap.name          ?? this.name;
    this.baseValue     = snap.baseValue     ?? this.baseValue;
    this.current       = snap.current       ?? this.baseValue;
    this.min           = snap.min           ?? this.min;
    this.max           = snap.max           ?? this.max;
    this.phiNormalized = snap.phiNormalized ?? this.phiNormalized;
    this.sensitivity   = snap.sensitivity   ?? this.sensitivity;
    this.momentumDecay = snap.momentumDecay ?? this.momentumDecay;
    this.enforceBounds = snap.enforceBounds ?? this.enforceBounds;
    this.unit          = snap.unit          ?? this.unit;
    this.category      = snap.category      ?? this.category;
    this.cslGate       = snap.cslGate       ?? this.cslGate;
    this._momentum     = snap.momentum      ?? 0;
    this._history      = Array.isArray(snap.history) ? snap.history.slice() : [];
    this._range        = new PhiRange(this.min, this.max, this.phiNormalized);

    logger.info('PhiScale.restore', { name: this.name, current: this.current });
  }
}

// ---------------------------------------------------------------------------
// PhiBackoff
// ---------------------------------------------------------------------------

/**
 * Phi-exponential retry interval generator.
 * Intervals grow as baseInterval * PHI^attempt, ensuring sub-exponential
 * (relative to standard 2x doubling) yet golden-ratio-tuned backoff.
 */
class PhiBackoff {
  /**
   * @param {number} [baseInterval=1000]   Initial wait in ms
   * @param {number} [maxAttempts=10]
   * @param {number} [jitterFactor=0.15]   ±fraction of interval added as jitter
   */
  constructor(baseInterval = 1000, maxAttempts = 10, jitterFactor = 0.15) {
    this.baseInterval  = baseInterval;
    this.maxAttempts   = maxAttempts;
    this.jitterFactor  = jitterFactor;
    this._attempt      = 0;
    this._elapsed      = 0;
    this._MAX_INTERVAL = 300_000; // 5 minutes hard cap

    logger.debug('PhiBackoff created', { baseInterval, maxAttempts, jitterFactor });
  }

  /**
   * Compute and return the next backoff interval in ms, advancing the attempt counter.
   * @returns {number} interval in ms, or -1 when maxAttempts exhausted
   */
  next() {
    if (this._attempt >= this.maxAttempts) {
      logger.warn('PhiBackoff.next: maxAttempts exhausted', { maxAttempts: this.maxAttempts });
      return -1;
    }
    const raw     = this.baseInterval * Math.pow(PHI, this._attempt);
    const capped  = Math.min(raw, this._MAX_INTERVAL);
    const jitter  = capped * this.jitterFactor * (2 * Math.random() - 1);
    const interval= Math.max(0, Math.round(capped + jitter));

    this._elapsed += interval;
    this._attempt += 1;

    logger.debug('PhiBackoff.next', { attempt: this._attempt, interval });
    return interval;
  }

  /**
   * Return the full deterministic (no jitter) sequence for all attempts.
   * @returns {number[]}
   */
  sequence() {
    const seq = [];
    for (let i = 0; i < this.maxAttempts; i++) {
      const raw    = this.baseInterval * Math.pow(PHI, i);
      seq.push(Math.min(Math.round(raw), this._MAX_INTERVAL));
    }
    return seq;
  }

  /** Reset the attempt counter and elapsed tracker. */
  reset() {
    this._attempt = 0;
    this._elapsed = 0;
    logger.debug('PhiBackoff.reset');
  }

  /** @returns {number} attempts remaining */
  remaining() {
    return Math.max(0, this.maxAttempts - this._attempt);
  }

  /** @returns {number} total ms elapsed across all issued intervals */
  elapsed() {
    return this._elapsed;
  }

  /**
   * Compare phi-backoff sequence against standard 2x doubling for the same settings.
   * @returns {{ phi: number[], standard: number[], ratios: number[] }}
   */
  compare() {
    const phi      = this.sequence();
    const standard = [];
    for (let i = 0; i < this.maxAttempts; i++) {
      standard.push(Math.min(Math.round(this.baseInterval * Math.pow(2, i)), this._MAX_INTERVAL));
    }
    const ratios = phi.map((p, i) => standard[i] > 0 ? +(p / standard[i]).toFixed(4) : null);
    return { phi, standard, ratios };
  }

  toString() {
    const seq = this.sequence();
    return (
      `PhiBackoff(base=${this.baseInterval}ms, attempts=${this.maxAttempts}, ` +
      `jitter=±${(this.jitterFactor * 100).toFixed(0)}%) — sequence: ` +
      seq.map(v => `${v}ms`).join(', ')
    );
  }
}

// ---------------------------------------------------------------------------
// PhiDecay
// ---------------------------------------------------------------------------

/**
 * Golden spiral decay function.
 * Uses polar golden spiral r = PHI^(-θ/90°) to model the decay of a signal
 * over time.  θ is mapped from elapsed time using the half-life parameter.
 */
class PhiDecay {
  /**
   * @param {number} [halfLife=60000]  Time (ms) for signal to decay to ~50 %
   */
  constructor(halfLife = 60_000) {
    if (halfLife <= 0) throw new RangeError('PhiDecay: halfLife must be > 0');
    this.halfLife = halfLife;
    // Derive the theta that yields r = 0.5: PHI^(-θ_half/90) = 0.5
    // => -θ_half/90 * LOG_PHI = ln(0.5) => θ_half = -90 * ln(0.5) / LOG_PHI
    this._thetaHalf = (-90 * Math.log(0.5)) / LOG_PHI;
    logger.debug('PhiDecay created', { halfLife, thetaHalf: this._thetaHalf });
  }

  /**
   * Compute the golden spiral decay factor [0, 1] for the given elapsed time.
   * @param {number} elapsedTime  ms since the signal was emitted
   * @returns {number}
   */
  decay(elapsedTime) {
    if (elapsedTime < 0) return 1;
    const thetaDeg = (elapsedTime / this.halfLife) * this._thetaHalf;
    return Math.pow(PHI, -thetaDeg / 90);
  }

  /**
   * Apply decay to a scalar value.
   * @param {number} value
   * @param {number} elapsedTime ms
   * @returns {number}
   */
  apply(value, elapsedTime) {
    return value * this.decay(elapsedTime);
  }

  /**
   * Calculate the elapsed time required to reach a target fraction.
   * @param {number} targetPercent  0–1 (e.g. 0.1 = 10 %)
   * @returns {number} ms
   */
  timeToDecay(targetPercent) {
    if (targetPercent <= 0 || targetPercent >= 1) {
      throw new RangeError('PhiDecay.timeToDecay: targetPercent must be in (0, 1)');
    }
    // PHI^(-θ/90) = targetPercent => θ = -90 * ln(targetPercent) / LOG_PHI
    const thetaDeg = (-90 * Math.log(targetPercent)) / LOG_PHI;
    return (thetaDeg / this._thetaHalf) * this.halfLife;
  }

  /**
   * Given a decay factor, return the elapsed time that produced it.
   * @param {number} decayFactor (0, 1]
   * @returns {number} ms
   */
  inverse(decayFactor) {
    if (decayFactor <= 0 || decayFactor > 1) {
      throw new RangeError('PhiDecay.inverse: decayFactor must be in (0, 1]');
    }
    // Same derivation as timeToDecay
    return this.timeToDecay(decayFactor);
  }

  /**
   * Compare golden spiral decay with linear and standard (ln2-based) exponential decay.
   * @param {number} elapsedTime ms
   * @returns {{ goldenSpiral: number, linear: number, standardExponential: number }}
   */
  compare(elapsedTime) {
    const t     = Math.max(0, elapsedTime);
    const goldenSpiral      = this.decay(t);
    const linear            = Math.max(0, 1 - t / (2 * this.halfLife));
    const standardExponential = Math.exp(-Math.log(2) * t / this.halfLife);
    return { goldenSpiral, linear, standardExponential };
  }
}

// ---------------------------------------------------------------------------
// PhiPartitioner
// ---------------------------------------------------------------------------

/**
 * Fibonacci-based work chunking.
 * Uses the pre-computed FIBONACCI_SEQUENCE to find phi-harmonic chunk sizes
 * that minimize cognitive and computational overhead.
 */
class PhiPartitioner {
  constructor() {
    // Local mutable copy for indexed lookups (excludes 0 for practical work sizing)
    this._fibs = FIBONACCI_SEQUENCE.slice(1); // [1,1,2,3,5,8,13,21,...]
    logger.debug('PhiPartitioner created', { fibCount: this._fibs.length });
  }

  /**
   * Find the best chunk count for given work and resources.
   * Returns the Fibonacci number closest to Math.ceil(totalWork / availableResources).
   * @param {number} totalWork
   * @param {number} availableResources
   * @returns {number}
   */
  partition(totalWork, availableResources) {
    if (availableResources <= 0) throw new RangeError('PhiPartitioner.partition: resources must be > 0');
    const ideal = Math.ceil(totalWork / availableResources);
    return this.nearestFibonacci(ideal);
  }

  /**
   * Greedy Fibonacci decomposition of totalWork into chunks ≤ maxChunkSize.
   * Each step uses the largest Fibonacci number ≤ remaining, down to 1.
   * @param {number} totalWork
   * @param {number} maxChunkSize
   * @returns {number[]}
   */
  split(totalWork, maxChunkSize) {
    if (totalWork <= 0) return [];
    const eligible = this._fibs.filter(f => f <= maxChunkSize);
    if (eligible.length === 0) {
      // No Fibonacci ≤ maxChunkSize; fall back to 1s
      return Array(totalWork).fill(1);
    }
    const chunks = [];
    let remaining = totalWork;
    while (remaining > 0) {
      // Find largest eligible Fibonacci ≤ remaining
      let chosen = 1;
      for (let i = eligible.length - 1; i >= 0; i--) {
        if (eligible[i] <= remaining) { chosen = eligible[i]; break; }
      }
      chunks.push(chosen);
      remaining -= chosen;
      if (chunks.length > 10_000) {
        logger.warn('PhiPartitioner.split: chunk limit reached, truncating', { totalWork, maxChunkSize });
        break;
      }
    }
    return chunks;
  }

  /**
   * Get the nth Fibonacci number (0-indexed, F(0)=0).
   * @param {number} n
   * @returns {number}
   */
  fibonacci(n) {
    if (n < 0)  throw new RangeError('fibonacci: n must be ≥ 0');
    if (n < FIBONACCI_SEQUENCE.length) return FIBONACCI_SEQUENCE[n];
    // Extend beyond the pre-computed 30 terms
    let a = FIBONACCI_SEQUENCE[FIBONACCI_SEQUENCE.length - 2];
    let b = FIBONACCI_SEQUENCE[FIBONACCI_SEQUENCE.length - 1];
    for (let i = FIBONACCI_SEQUENCE.length; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  /**
   * Find the Fibonacci number in the pre-computed sequence closest to n.
   * @param {number} n
   * @returns {number}
   */
  nearestFibonacci(n) {
    if (n <= 0) return 0;
    let best = this._fibs[0];
    let bestDist = Math.abs(n - best);
    for (const f of this._fibs) {
      const dist = Math.abs(n - f);
      if (dist < bestDist) { best = f; bestDist = dist; }
    }
    return best;
  }

  /**
   * @param {number} n
   * @returns {boolean}
   */
  isFibonacci(n) {
    if (n < 0) return false;
    return FIBONACCI_SEQUENCE.includes(n);
  }

  /**
   * Return all Fibonacci numbers in the pre-computed sequence within [min, max].
   * @param {number} min
   * @param {number} max
   * @returns {number[]}
   */
  fibonacciRange(min, max) {
    return FIBONACCI_SEQUENCE.filter(f => f >= min && f <= max);
  }

  /**
   * Split total into two parts at the golden ratio.
   * The larger part = total * PHI_INVERSE^(-1) … actually: larger = total * (1/PHI) + total * (1/PHI²)
   * i.e. larger = total * PHI / (PHI + 1) = total * PHI / PHI² = total / PHI = total * PHI_INVERSE
   * smaller = total - larger
   * @param {number} total
   * @returns {{ larger: number, smaller: number, ratio: number }}
   */
  goldenPartition(total) {
    const larger  = total * PHI_INVERSE;   // larger sub-part (≈61.8 % of total)
    const smaller = total - larger;
    return { larger, smaller, ratio: larger / (smaller || 1) };
  }
}

// ---------------------------------------------------------------------------
// PhiNormalizer (static utility class)
// ---------------------------------------------------------------------------

/**
 * Static methods for converting values between raw and phi coordinate spaces.
 */
class PhiNormalizer {
  /**
   * Map value in [min, max] to phi coordinate space [0, 1] with the equilibrium
   * at PHI_INVERSE.
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  static normalize(value, min, max) {
    if (max === min) return PHI_INVERSE;
    return (Math.max(min, Math.min(max, value)) - min) / (max - min);
  }

  /**
   * @param {number} phiValue  [0, 1]
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  static denormalize(phiValue, min, max) {
    return min + Math.max(0, Math.min(1, phiValue)) * (max - min);
  }

  /**
   * Convert a percentage (0–100) to a phi-space value [0, 1].
   * @param {number} percent
   * @returns {number}
   */
  static fromPercent(percent) {
    return Math.max(0, Math.min(100, percent)) / 100;
  }

  /**
   * Convert a phi-space value [0, 1] to a percentage (0–100).
   * @param {number} phiValue
   * @returns {number}
   */
  static toPercent(phiValue) {
    return Math.max(0, Math.min(1, phiValue)) * 100;
  }

  /**
   * Map a discrete integer (discreteMin..discreteMax) to its position on the
   * golden spiral, giving non-linear spacing tuned by PHI.
   * @param {number} discreteValue
   * @param {number} discreteMin
   * @param {number} discreteMax
   * @returns {number}  phi-space position in [0, 1]
   */
  static mapDiscrete(discreteValue, discreteMin, discreteMax) {
    if (discreteMax === discreteMin) return PHI_INVERSE;
    const linear  = (discreteValue - discreteMin) / (discreteMax - discreteMin);
    // Apply golden spiral warp: each step is scaled by PHI^(linear*2 - 1)
    const warped  = Math.pow(PHI, (linear * 2 - 1) * LOG_PHI) - Math.pow(PHI, -LOG_PHI);
    const scale   = Math.pow(PHI, LOG_PHI) - Math.pow(PHI, -LOG_PHI);
    return scale === 0 ? linear : Math.max(0, Math.min(1, warped / scale));
  }

  /**
   * Map a string category to a phi position.
   * Categories are evenly distributed across the [0, 1] range, with the
   * equilibrium category landing closest to PHI_INVERSE.
   * @param {string}   category
   * @param {string[]} categories  ordered array of all possible categories
   * @returns {number}  phi-space position in [0, 1]
   */
  static mapCategory(category, categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
      throw new TypeError('PhiNormalizer.mapCategory: categories must be a non-empty array');
    }
    const idx = categories.indexOf(category);
    if (idx === -1) {
      logger.warn('PhiNormalizer.mapCategory: unknown category, returning PHI_INVERSE', { category });
      return PHI_INVERSE;
    }
    const n = categories.length;
    return n === 1 ? PHI_INVERSE : idx / (n - 1);
  }

  /**
   * Convert a stepped integer value (0..steps-1) to a continuous phi position.
   * Steps are spaced at Fibonacci-weighted intervals.
   * @param {number} value  integer step index
   * @param {number} steps  total number of steps
   * @returns {number}  phi-space position in [0, 1]
   */
  static discreteToContinuous(value, steps) {
    if (steps <= 1) return PHI_INVERSE;
    const normalized = value / (steps - 1);
    // Golden-ratio warp: each successive step is multiplied by PHI_INVERSE
    // cumulative weighting uses partial sums of geometric series with ratio PHI_INVERSE
    const total = (1 - Math.pow(PHI_INVERSE, steps)) / (1 - PHI_INVERSE);
    const cumulative = total === 0
      ? normalized
      : (1 - Math.pow(PHI_INVERSE, value + 1)) / ((1 - PHI_INVERSE) * total);
    return Math.max(0, Math.min(1, cumulative));
  }
}

// ---------------------------------------------------------------------------
// PhiSpiral
// ---------------------------------------------------------------------------

/**
 * Golden spiral path generator.
 * The golden spiral is a special case of the logarithmic spiral where the growth
 * factor per quarter turn is PHI.  In polar form: r = a * PHI^(θ/90°).
 */
class PhiSpiral {
  /**
   * @param {number} [scale=1]      Scaling factor applied to all radii
   * @param {number} [rotations=2]  Number of full rotations for generated point sets
   */
  constructor(scale = 1, rotations = 2) {
    this.scale     = scale;
    this.rotations = rotations;
    logger.debug('PhiSpiral created', { scale, rotations });
  }

  /**
   * Compute Cartesian (x, y) on the golden spiral at angle theta (degrees).
   * @param {number} theta  angle in degrees
   * @returns {{ x: number, y: number, r: number, theta: number }}
   */
  point(theta) {
    const r = this.scale * Math.pow(PHI, theta / 90);
    const rad = (theta * Math.PI) / 180;
    return {
      x:     r * Math.cos(rad),
      y:     r * Math.sin(rad),
      r,
      theta,
    };
  }

  /**
   * Generate an array of evenly spaced points spanning [0°, 360° * rotations].
   * @param {number} [count=36]
   * @returns {Array<{ x: number, y: number, r: number, theta: number }>}
   */
  points(count = 36) {
    if (count < 2) throw new RangeError('PhiSpiral.points: count must be ≥ 2');
    const totalDeg = 360 * this.rotations;
    const step     = totalDeg / (count - 1);
    const pts      = [];
    for (let i = 0; i < count; i++) {
      pts.push(this.point(i * step));
    }
    return pts;
  }

  /**
   * Spherical linear interpolation between two angular positions on the spiral.
   * @param {number} startTheta  degrees
   * @param {number} endTheta    degrees
   * @param {number} t           interpolation factor [0, 1]
   * @returns {{ x: number, y: number, r: number, theta: number }}
   */
  interpolate(startTheta, endTheta, t) {
    const t_   = Math.max(0, Math.min(1, t));
    const theta = startTheta + (endTheta - startTheta) * t_;
    return this.point(theta);
  }
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
  // Constants
  PHI,
  PHI_INVERSE,
  SQRT_PHI,
  PHI_SQUARED,
  PHI_CUBED,
  LOG_PHI,
  TWO_PI_PHI,
  FIBONACCI_SEQUENCE,

  // Classes
  PhiRange,
  PhiScale,
  PhiBackoff,
  PhiDecay,
  PhiPartitioner,
  PhiNormalizer,
  PhiSpiral,
};
```

---

### `src/core/semantic-logic-csl.js`

```javascript
/**
 * ─── Heady Continuous Semantic Logic (CSL) ──────────────────────────
 *
 * BLUEPRINT: Universal Vector Gates v2.0
 * Replace ALL discrete logic (0, 1) with infinite geometric continuity.
 *
 * THE 3 UNIVERSAL VECTOR GATES:
 *   1. Resonance Gate  (Semantic AND / IF)  — cosine similarity
 *   2. Superposition Gate (Semantic OR / MERGE) — vector fusion
 *   3. Orthogonal Gate (Semantic NOT / REJECT) — vector subtraction
 *
 * EXTENDED OPERATIONS:
 *   4. Weighted Superposition — biased fusion with α
 *   5. Multi-Resonance — score N vectors against a target
 *   6. Batch Orthogonal — strip multiple reject vectors in one pass
 *   7. Soft Gate — sigmoid activation (continuous, not boolean)
 *
 * Patent: PPA #52 — Continuous Semantic Logic Gates
 * ──────────────────────────────────────────────────────────────────
 */

// ── Stats Tracking ─────────────────────────────────────────────
const gateStats = {
    resonance: 0,
    superposition: 0,
    orthogonal: 0,
    softGate: 0,
    totalCalls: 0,
    avgResonanceScore: 0,
    _resonanceScoreSum: 0,
};

class HeadySemanticLogic {

    // ═══════════════════════════════════════════════════════════════
    // GATE 1: RESONANCE (The Semantic IF / AND)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Measures cosine similarity between two intents.
     * R(I, C) = (I · C) / (‖I‖ · ‖C‖)
     *
     * @param {number[]|Float32Array} vec_a - Intent A
     * @param {number[]|Float32Array} vec_b - Intent B
     * @param {number} threshold - Activation threshold (default 0.95)
     * @returns {{ score: number, open: boolean }}
     */
    static resonance_gate(vec_a, vec_b, threshold = 0.95) {
        const score = this.cosine_similarity(vec_a, vec_b);
        gateStats.resonance++;
        gateStats.totalCalls++;
        gateStats._resonanceScoreSum += score;
        gateStats.avgResonanceScore = gateStats._resonanceScoreSum / gateStats.resonance;
        return {
            score: +score.toFixed(6),
            open: score >= threshold,
        };
    }

    /**
     * Multi-Resonance: score N vectors simultaneously against a target.
     * Returns sorted array of { index, score, open } for each candidate.
     *
     * @param {number[]|Float32Array} target - The reference vector
     * @param {Array<number[]|Float32Array>} candidates - Array of vectors to score
     * @param {number} threshold - Activation threshold
     * @returns {Array<{ index: number, score: number, open: boolean }>}
     */
    static multi_resonance(target, candidates, threshold = 0.95) {
        return candidates
            .map((c, i) => {
                const score = this.cosine_similarity(target, c);
                gateStats.resonance++;
                gateStats.totalCalls++;
                gateStats._resonanceScoreSum += score;
                return { index: i, score: +score.toFixed(6), open: score >= threshold };
            })
            .sort((a, b) => b.score - a.score);
    }

    // ═══════════════════════════════════════════════════════════════
    // GATE 2: SUPERPOSITION (The Semantic OR / MERGE)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Fuses two concepts into a brand-new hybrid intent.
     * S(T, A) = normalize(T + A)
     *
     * @param {number[]|Float32Array} vec_a - Concept A
     * @param {number[]|Float32Array} vec_b - Concept B
     * @returns {Float32Array} Normalized hybrid vector
     */
    static superposition_gate(vec_a, vec_b) {
        const len = vec_a.length;
        const hybrid = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            hybrid[i] = vec_a[i] + vec_b[i];
        }
        gateStats.superposition++;
        gateStats.totalCalls++;
        return this.normalize(hybrid);
    }

    /**
     * Weighted Superposition: biased fusion with factor α.
     * S(A, B, α) = normalize(α·A + (1-α)·B)
     *
     * @param {number[]|Float32Array} vec_a - Concept A
     * @param {number[]|Float32Array} vec_b - Concept B
     * @param {number} alpha - Weight for vec_a (0.0 - 1.0), default 0.5
     * @returns {Float32Array} Normalized weighted hybrid vector
     */
    static weighted_superposition(vec_a, vec_b, alpha = 0.5) {
        const len = vec_a.length;
        const beta = 1.0 - alpha;
        const hybrid = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            hybrid[i] = alpha * vec_a[i] + beta * vec_b[i];
        }
        gateStats.superposition++;
        gateStats.totalCalls++;
        return this.normalize(hybrid);
    }

    /**
     * N-way Superposition: fuse an array of vectors into a single consensus.
     * S(V₁, V₂, ... Vₙ) = normalize(Σ Vᵢ)
     *
     * @param {Array<number[]|Float32Array>} vectors - Array of vectors to fuse
     * @returns {Float32Array} Normalized consensus vector
     */
    static consensus_superposition(vectors) {
        if (!vectors || vectors.length === 0) return new Float32Array(0);
        const len = vectors[0].length;
        const fused = new Float32Array(len);
        for (const v of vectors) {
            for (let i = 0; i < len; i++) {
                fused[i] += v[i];
            }
        }
        gateStats.superposition++;
        gateStats.totalCalls++;
        return this.normalize(fused);
    }

    // ═══════════════════════════════════════════════════════════════
    // GATE 3: ORTHOGONAL (The Semantic NOT / REJECT)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Strips the influence of reject_vec from target_vec.
     * O(T, L) = T - ((T·L)/(L·L)) · L
     *
     * @param {number[]|Float32Array} target_vec - The base intent
     * @param {number[]|Float32Array} reject_vec - The intent to strip out
     * @returns {Float32Array} Purified orthogonal vector
     */
    static orthogonal_gate(target_vec, reject_vec) {
        const len = target_vec.length;
        const dotTR = this.dot_product(target_vec, reject_vec);
        const dotRR = this.dot_product(reject_vec, reject_vec);
        const projectionFactor = dotTR / (dotRR || 1e-10);

        const orthogonal = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            orthogonal[i] = target_vec[i] - (projectionFactor * reject_vec[i]);
        }
        gateStats.orthogonal++;
        gateStats.totalCalls++;
        return this.normalize(orthogonal);
    }

    /**
     * Batch Orthogonal: strip multiple reject vectors in one pass.
     * Iteratively projects out each rejection vector.
     *
     * @param {number[]|Float32Array} target_vec - The base intent
     * @param {Array<number[]|Float32Array>} reject_vecs - Array of intents to strip
     * @returns {Float32Array} Purified vector with all rejections removed
     */
    static batch_orthogonal(target_vec, reject_vecs) {
        let current = Float32Array.from(target_vec);
        for (const reject of reject_vecs) {
            const dotTR = this.dot_product(current, reject);
            const dotRR = this.dot_product(reject, reject);
            const factor = dotTR / (dotRR || 1e-10);
            for (let i = 0; i < current.length; i++) {
                current[i] -= factor * reject[i];
            }
        }
        gateStats.orthogonal++;
        gateStats.totalCalls++;
        return this.normalize(current);
    }

    // ═══════════════════════════════════════════════════════════════
    // SOFT GATE — Continuous sigmoid activation
    // ═══════════════════════════════════════════════════════════════

    /**
     * Soft Gate: returns a continuous activation value [0, 1]
     * instead of a hard boolean. Uses sigmoid around the threshold.
     *
     * σ(x) = 1 / (1 + e^(-k(x - threshold)))
     *
     * @param {number} score - The raw cosine similarity score
     * @param {number} threshold - Center of the sigmoid (default 0.5)
     * @param {number} steepness - How sharp the transition is (default 20)
     * @returns {number} Continuous activation between 0 and 1
     */
    static soft_gate(score, threshold = 0.5, steepness = 20) {
        gateStats.softGate++;
        gateStats.totalCalls++;
        return 1.0 / (1.0 + Math.exp(-steepness * (score - threshold)));
    }

    // ═══════════════════════════════════════════════════════════════
    // VECTOR MATH PRIMITIVES (shared by all gates)
    // ═══════════════════════════════════════════════════════════════

    static dot_product(a, b) {
        let dot = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            dot += a[i] * b[i];
        }
        return dot;
    }

    static norm(v) {
        let sum = 0;
        for (let i = 0; i < v.length; i++) {
            sum += v[i] * v[i];
        }
        return Math.sqrt(sum);
    }

    static normalize(v) {
        const n = this.norm(v);
        if (n < 1e-10) return v;
        const res = new Float32Array(v.length);
        for (let i = 0; i < v.length; i++) {
            res[i] = v[i] / n;
        }
        return res;
    }

    /**
     * Cosine similarity — the foundational metric of CSL.
     * All gates reduce to this geometric measure.
     */
    static cosine_similarity(a, b) {
        if (!a || !b || a.length === 0 || b.length === 0) return 0;
        const dot = this.dot_product(a, b);
        const normA = this.norm(a);
        const normB = this.norm(b);
        return dot / (normA * normB || 1e-10);
    }

    // ═══════════════════════════════════════════════════════════════
    // GATE 5: TERNARY (Continuous {-1, 0, +1} Classification)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Ternary Gate: maps a continuous confidence score to {-1, 0, +1}
     * using dual sigmoid boundaries instead of hard thresholds.
     *
     * Returns the discrete state PLUS the continuous activation values
     * so downstream systems preserve the geometric magnitude.
     *
     * @param {number} score - Raw confidence/similarity (0.0 - 1.0)
     * @param {number} resonanceThreshold - Center for +1 sigmoid (default 0.72)
     * @param {number} repelThreshold - Center for -1 sigmoid (default 0.35)
     * @param {number} steepness - Sigmoid steepness (default 15)
     * @returns {{ state: -1|0|+1, resonanceActivation: number, repelActivation: number, raw: number }}
     */
    static ternary_gate(score, resonanceThreshold = 0.72, repelThreshold = 0.35, steepness = 15) {
        const resonanceActivation = this.soft_gate(score, resonanceThreshold, steepness);
        const repelActivation = 1.0 - this.soft_gate(score, repelThreshold, steepness);

        let state;
        if (resonanceActivation >= 0.5) {
            state = +1;  // Core Resonance
        } else if (repelActivation >= 0.5) {
            state = -1;  // Repel
        } else {
            state = 0;   // Ephemeral / Epistemic Hold
        }

        gateStats.totalCalls++;
        return { state, resonanceActivation: +resonanceActivation.toFixed(6), repelActivation: +repelActivation.toFixed(6), raw: score };
    }

    // ═══════════════════════════════════════════════════════════════
    // GATE 6: RISK (Trading-Specific Continuous Risk Evaluation)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Risk Gate: evaluates trading risk as a continuous activation.
     * Maps proximity-to-limit ratios through sigmoid to produce
     * smooth risk curves instead of hard cutoffs.
     *
     * @param {number} current - Current value (equity, P&L, etc.)
     * @param {number} limit - The hard limit/threshold
     * @param {number} sensitivity - How early the alarm activates (default 0.8 = at 80%)
     * @param {number} steepness - Sigmoid steepness (default 12)
     * @returns {{ riskLevel: number, signal: -1|0|+1, proximity: number, activation: number }}
     */
    static risk_gate(current, limit, sensitivity = 0.8, steepness = 12) {
        const proximity = Math.abs(current) / (Math.abs(limit) || 1e-10);
        const activation = this.soft_gate(proximity, sensitivity, steepness);

        // Map to ternary: high activation = danger
        const ternary = this.ternary_gate(1.0 - activation, 0.5, 0.2, steepness);

        gateStats.totalCalls++;
        return {
            riskLevel: +activation.toFixed(6),
            signal: ternary.state,
            proximity: +proximity.toFixed(6),
            activation: +activation.toFixed(6),
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // GATE 7: ROUTE (Multi-Candidate Routing via Ranked Resonance)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Route Gate: selects the best candidate from a set using
     * multi-resonance scoring with soft gate activation.
     * Used for model selection, service routing, bee dispatch.
     *
     * @param {number[]|Float32Array} intent - The intent/query vector
     * @param {Array<{id: string, vector: number[]|Float32Array}>} candidates - Named candidates
     * @param {number} threshold - Minimum activation to be considered (default 0.3)
     * @returns {{ best: string|null, scores: Array<{id: string, score: number, activation: number}>, fallback: boolean }}
     */
    static route_gate(intent, candidates, threshold = 0.3) {
        const scores = candidates.map(c => {
            const score = this.cosine_similarity(intent, c.vector);
            const activation = this.soft_gate(score, threshold, 10);
            return { id: c.id, score: +score.toFixed(6), activation: +activation.toFixed(6) };
        }).sort((a, b) => b.score - a.score);

        const viable = scores.filter(s => s.activation >= 0.5);
        gateStats.totalCalls++;

        return {
            best: viable.length > 0 ? viable[0].id : null,
            scores,
            fallback: viable.length === 0,
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // STATUS & DIAGNOSTICS
    // ═══════════════════════════════════════════════════════════════

    static getStats() {
        return {
            ...gateStats,
            avgResonanceScore: gateStats.resonance > 0
                ? +(gateStats._resonanceScoreSum / gateStats.resonance).toFixed(4)
                : 0,
        };
    }

    static resetStats() {
        gateStats.resonance = 0;
        gateStats.superposition = 0;
        gateStats.orthogonal = 0;
        gateStats.softGate = 0;
        gateStats.totalCalls = 0;
        gateStats.avgResonanceScore = 0;
        gateStats._resonanceScoreSum = 0;
    }
}

// Export both the class and a singleton for convenience
module.exports = HeadySemanticLogic;
module.exports.CSL = HeadySemanticLogic;
```

---

### `src/intelligence/monte-carlo-engine-csl.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Monte Carlo Simulation Engine — Risk Assessment and Pipeline Integration
 *
 * // RTP: Monte Carlo Simulation - HCFullPipeline Stage
 *
 * Full production Monte Carlo engine for risk assessment, probabilistic outcome
 * distribution, confidence intervals, and scenario analysis.
 *
 * PHI = 1.6180339887
 *
 * Features:
 *   - runSimulation(params, iterations) — primary simulation entry point
 *   - probabilistic outcome distribution (success / partial / failure)
 *   - risk scoring with GREEN / YELLOW / ORANGE / RED grades
 *   - 95% Wilson confidence intervals for failure rate
 *   - scenario analysis (multi-scenario comparison)
 *   - configurable distributions: normal, uniform, triangular
 *   - pipeline stage integration hooks
 *   - quickReadiness() from operational signals
 *   - Mulberry32 seeded PRNG for reproducibility
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;

const RISK_GRADE = Object.freeze({
  GREEN:  'GREEN',
  YELLOW: 'YELLOW',
  ORANGE: 'ORANGE',
  RED:    'RED',
});

const DISTRIBUTION = Object.freeze({
  UNIFORM:    'uniform',
  NORMAL:     'normal',
  TRIANGULAR: 'triangular',
});

/** Impact thresholds that delineate simulation outcome buckets. */
const OUTCOME_THRESHOLDS = Object.freeze({
  SUCCESS_MAX: 0.30,  // total impact < 0.30 → success
  PARTIAL_MAX: 0.70,  // total impact < 0.70 → partial
                      // total impact >= 0.70 → failure
});

// ─── Mulberry32 PRNG ──────────────────────────────────────────────────────────

/**
 * Mulberry32 seeded PRNG — fast, high-quality, reproducible.
 * Returns floats uniformly distributed in [0, 1).
 *
 * @param {number} seed - 32-bit unsigned integer seed
 * @returns {function(): number}
 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s  += 0x6d2b79f5;
    let z = s;
    z     = Math.imul(z ^ (z >>> 15), z | 1);
    z    ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Distribution Samplers ────────────────────────────────────────────────────

/**
 * Sample from a uniform distribution [min, max].
 * @param {function} rand - PRNG
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function sampleUniform(rand, min = 0, max = 1) {
  return min + rand() * (max - min);
}

/**
 * Sample from a normal distribution using Box-Muller transform.
 * @param {function} rand - PRNG
 * @param {number} mean
 * @param {number} stddev
 * @returns {number}
 */
function sampleNormal(rand, mean = 0, stddev = 1) {
  const u1 = rand();
  const u2 = rand();
  const z0 = Math.sqrt(-2.0 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stddev;
}

/**
 * Sample from a triangular distribution defined by [min, mode, max].
 * @param {function} rand - PRNG
 * @param {number} min
 * @param {number} mode  - Most likely value (peak of triangle)
 * @param {number} max
 * @returns {number}
 */
function sampleTriangular(rand, min = 0, mode = 0.5, max = 1) {
  const u = rand();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

/**
 * Dispatch to the appropriate distribution sampler.
 * @param {function} rand
 * @param {string} distribution
 * @param {object} params
 * @returns {number}
 */
function sample(rand, distribution, params = {}) {
  switch (distribution) {
    case DISTRIBUTION.NORMAL:
      return sampleNormal(rand, params.mean, params.stddev);
    case DISTRIBUTION.TRIANGULAR:
      return sampleTriangular(rand, params.min, params.mode, params.max);
    case DISTRIBUTION.UNIFORM:
    default:
      return sampleUniform(rand, params.min !== undefined ? params.min : 0, params.max !== undefined ? params.max : 1);
  }
}

// ─── Statistical Helpers ──────────────────────────────────────────────────────

/**
 * Map a 0-100 score to a risk grade.
 * @param {number} score
 * @returns {string} RISK_GRADE value
 */
function scoreToGrade(score) {
  if (score >= 80) return RISK_GRADE.GREEN;
  if (score >= 60) return RISK_GRADE.YELLOW;
  if (score >= 40) return RISK_GRADE.ORANGE;
  return RISK_GRADE.RED;
}

/**
 * Compute the 95% Wilson score confidence interval for a proportion.
 * More accurate than normal approximation for small samples or extreme proportions.
 *
 * @param {number} p          - Observed proportion (0–1)
 * @param {number} n          - Sample size
 * @param {number} [z=1.96]   - Z-score for desired confidence level
 * @returns {{ lower: number, upper: number, centre: number }}
 */
function wilsonInterval(p, n, z = 1.96) {
  if (n === 0) return { lower: 0, upper: 1, centre: 0.5 };
  const z2         = z * z;
  const denominator = 1 + z2 / n;
  const centre      = (p + z2 / (2 * n)) / denominator;
  const margin      = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denominator;
  return {
    lower:  +Math.max(0, centre - margin).toFixed(6),
    upper:  +Math.min(1, centre + margin).toFixed(6),
    centre: +centre.toFixed(6),
  };
}

/**
 * Compute descriptive statistics for an array of numbers.
 * @param {number[]} arr
 * @returns {{ mean: number, stddev: number, min: number, max: number, p25: number, p50: number, p75: number, p95: number }}
 */
function descriptiveStats(arr) {
  if (arr.length === 0) return { mean: 0, stddev: 0, min: 0, max: 0, p25: 0, p50: 0, p75: 0, p95: 0 };

  const sorted = [...arr].sort((a, b) => a - b);
  const n      = sorted.length;
  const sum    = sorted.reduce((a, b) => a + b, 0);
  const mean   = sum / n;
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const stddev   = Math.sqrt(variance);

  const pct = (p) => {
    const idx = Math.floor(p * (n - 1));
    return +sorted[idx].toFixed(6);
  };

  return {
    mean:   +mean.toFixed(6),
    stddev: +stddev.toFixed(6),
    min:    +sorted[0].toFixed(6),
    max:    +sorted[n - 1].toFixed(6),
    p25:    pct(0.25),
    p50:    pct(0.50),
    p75:    pct(0.75),
    p95:    pct(0.95),
  };
}

// ─── MonteCarloEngine ─────────────────────────────────────────────────────────

/**
 * Monte Carlo Engine — production risk assessment and pipeline simulation.
 * // RTP: Monte Carlo Simulation - HCFullPipeline Stage
 */
class MonteCarloEngine {
  /**
   * @param {object} [opts]
   * @param {number} [opts.defaultSeed=42]           - Default PRNG seed
   * @param {number} [opts.defaultIterations=10000]  - Default iteration count
   */
  constructor(opts = {}) {
    this._defaultSeed       = opts.defaultSeed       !== undefined ? opts.defaultSeed : 42;
    this._defaultIterations = opts.defaultIterations !== undefined ? opts.defaultIterations : 10000;
    this._history           = [];
    this._pipelineHooks     = new Map();
    this._createdAt         = Date.now();
  }

  // ── Primary Simulation Entry Point ───────────────────────────────────────

  /**
   * Run a full Monte Carlo simulation.
   * // RTP: Monte Carlo Simulation - HCFullPipeline Stage
   *
   * @param {object} params                     - Simulation parameters
   * @param {string}  [params.name='unnamed']   - Scenario label
   * @param {number}  [params.seed]             - PRNG seed (defaults to timestamp)
   * @param {Array<{
   *   name: string,
   *   probability: number,
   *   impact: number,
   *   distribution?: string,
   *   distributionParams?: object,
   *   mitigation?: string,
   *   mitigationReduction?: number
   * }>} [params.riskFactors=[]]               - Risk factors to simulate
   * @param {string}  [params.pipelineStage]    - Pipeline stage name for hook integration
   * @param {number}  [iterations=this._defaultIterations]
   * @returns {object} Simulation result
   */
  runSimulation(params = {}, iterations) {
    const iters       = iterations !== undefined ? iterations : this._defaultIterations;
    const name        = params.name        || 'unnamed';
    const seed        = params.seed        !== undefined ? params.seed : (Date.now() & 0xffffffff);
    const riskFactors = params.riskFactors || [];
    const rand        = mulberry32(seed);

    let successCount = 0;
    let partialCount = 0;
    let failureCount = 0;

    const totalImpacts        = new Float64Array(iters);
    const mitigationHits      = {};
    const riskFactorHitCounts = riskFactors.map(() => 0);

    for (let i = 0; i < iters; i++) {
      let totalImpact = 0;

      for (let fi = 0; fi < riskFactors.length; fi++) {
        const factor = riskFactors[fi];
        const {
          probability        = 0.1,
          impact             = 0.5,
          distribution       = DISTRIBUTION.UNIFORM,
          distributionParams = {},
          mitigation,
          mitigationReduction = 0.5,
        } = factor;

        // Determine if this risk factor triggers this iteration
        const roll = rand();
        if (roll < probability) {
          riskFactorHitCounts[fi]++;

          // Sample the effective impact from the specified distribution
          let effectiveImpact;
          if (distribution !== DISTRIBUTION.UNIFORM ||
              distributionParams.min !== undefined || distributionParams.max !== undefined) {
            effectiveImpact = Math.max(0, Math.min(1,
              sample(rand, distribution, { ...distributionParams, mean: impact, mode: impact })
            ));
          } else {
            effectiveImpact = impact;
          }

          // Apply mitigation if specified
          if (mitigation) {
            effectiveImpact *= (1 - mitigationReduction);
            mitigationHits[mitigation] = (mitigationHits[mitigation] || 0) + 1;
          }

          totalImpact += effectiveImpact;
        }
      }

      totalImpacts[i] = totalImpact;

      if (totalImpact < OUTCOME_THRESHOLDS.SUCCESS_MAX)      successCount++;
      else if (totalImpact < OUTCOME_THRESHOLDS.PARTIAL_MAX) partialCount++;
      else                                                    failureCount++;
    }

    const failureRate   = failureCount / iters;
    const successRate   = successCount / iters;
    const partialRate   = partialCount / iters;
    const confidence    = Math.round(successRate * 100);
    const riskGrade     = scoreToGrade(confidence);

    // Wilson 95% CI for failure rate
    const confidenceBounds = wilsonInterval(failureRate, iters);

    // Impact distribution statistics
    const impactArr   = Array.from(totalImpacts);
    const impactStats = descriptiveStats(impactArr);

    // Top mitigations by hit frequency
    const topMitigations = Object.entries(mitigationHits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([m, count]) => ({ name: m, activations: count, activationRate: +(count / iters).toFixed(4) }));

    // Per-risk-factor hit rates
    const riskFactorStats = riskFactors.map((f, i) => ({
      name:            f.name || `factor-${i}`,
      probability:     f.probability || 0.1,
      observedHitRate: +(riskFactorHitCounts[i] / iters).toFixed(4),
      mitigation:      f.mitigation || null,
    }));

    const result = {
      // RTP: Monte Carlo Simulation - HCFullPipeline Stage
      scenario:         name,
      iterations:       iters,
      seed,
      confidence,
      riskGrade,
      failureRate:      +failureRate.toFixed(4),
      partialRate:      +partialRate.toFixed(4),
      successRate:      +successRate.toFixed(4),
      outcomes: {
        success: successCount,
        partial: partialCount,
        failure: failureCount,
      },
      confidenceBounds,
      impactDistribution: impactStats,
      topMitigations,
      riskFactorStats,
      phi:              PHI,
      simulatedAt:      Date.now(),
    };

    // Run pipeline hooks if a stage was specified
    if (params.pipelineStage) {
      this._runPipelineHooks(params.pipelineStage, result);
    }

    this._history.push({ scenario: name, result, runAt: Date.now() });
    return result;
  }

  // ── Quick Readiness (Operational Signals) ────────────────────────────────

  /**
   * Fast operational readiness score from live system signals.
   * No PRNG required — deterministic scoring for real-time use.
   *
   * @param {object} [signals={}]
   * @param {number}  [signals.errorRate=0]          - Fraction 0-1 (lower is better)
   * @param {boolean} [signals.lastDeploySuccess=true]
   * @param {number}  [signals.cpuPressure=0]        - Fraction 0-1
   * @param {number}  [signals.memoryPressure=0]     - Fraction 0-1
   * @param {number}  [signals.serviceHealthRatio=1] - Fraction 0-1 (higher is better)
   * @param {number}  [signals.openIncidents=0]      - Integer count
   * @returns {{ score: number, grade: string, breakdown: object }}
   */
  quickReadiness(signals = {}) {
    const {
      errorRate          = 0,
      lastDeploySuccess  = true,
      cpuPressure        = 0,
      memoryPressure     = 0,
      serviceHealthRatio = 1,
      openIncidents      = 0,
    } = signals;

    const errorScore    = Math.max(0, 100 - errorRate * 200);        // weight 25%
    const deployScore   = lastDeploySuccess ? 100 : 30;              // weight 20%
    const cpuScore      = Math.max(0, 100 - cpuPressure * 100);      // weight 15%
    const memScore      = Math.max(0, 100 - memoryPressure * 100);   // weight 15%
    const healthScore   = serviceHealthRatio * 100;                  // weight 20%
    const incidentScore = Math.max(0, 100 - openIncidents * 15);     // weight 5%

    const score = Math.round(
      errorScore    * 0.25 +
      deployScore   * 0.20 +
      cpuScore      * 0.15 +
      memScore      * 0.15 +
      healthScore   * 0.20 +
      incidentScore * 0.05,
    );

    return {
      score,
      grade:     scoreToGrade(score),
      breakdown: { errorScore, deployScore, cpuScore, memScore, healthScore, incidentScore },
    };
  }

  // ── Scenario Analysis ────────────────────────────────────────────────────

  /**
   * Run multiple scenarios and produce a comparative report.
   * @param {Array<{ name: string, params: object, iterations?: number }>} scenarios
   * @returns {{ scenarios: Array<object>, comparison: object }}
   */
  analyseScenarios(scenarios) {
    const results = scenarios.map(({ name, params, iterations }) =>
      this.runSimulation({ ...params, name }, iterations)
    );

    const sorted = [...results].sort((a, b) => b.confidence - a.confidence);

    return {
      scenarios: results,
      comparison: {
        best:    sorted[0] ? { name: sorted[0].scenario, confidence: sorted[0].confidence, grade: sorted[0].riskGrade } : null,
        worst:   sorted[sorted.length - 1] ? { name: sorted[sorted.length - 1].scenario, confidence: sorted[sorted.length - 1].confidence, grade: sorted[sorted.length - 1].riskGrade } : null,
        average: results.length > 0 ? +(results.reduce((a, b) => a + b.confidence, 0) / results.length).toFixed(1) : 0,
        allGreen: results.every(r => r.riskGrade === RISK_GRADE.GREEN),
        anyRed:   results.some(r => r.riskGrade === RISK_GRADE.RED),
      },
    };
  }

  // ── Pipeline Stage Integration ───────────────────────────────────────────

  /**
   * Register a hook function to be called after a simulation for a specific pipeline stage.
   * // RTP: Monte Carlo Simulation - HCFullPipeline Stage
   *
   * @param {string} stageName
   * @param {Function} hookFn  - Called with (result) — may be async
   */
  registerPipelineHook(stageName, hookFn) {
    if (!this._pipelineHooks.has(stageName)) {
      this._pipelineHooks.set(stageName, []);
    }
    this._pipelineHooks.get(stageName).push(hookFn);
  }

  /**
   * Run all registered hooks for a pipeline stage.
   * @private
   */
  _runPipelineHooks(stageName, result) {
    const hooks = this._pipelineHooks.get(stageName) || [];
    for (const hook of hooks) {
      try { hook(result); } catch { /* hooks must not break simulation */ }
    }
  }

  /**
   * Remove all hooks for a pipeline stage.
   * @param {string} stageName
   */
  clearPipelineHooks(stageName) {
    this._pipelineHooks.delete(stageName);
  }

  // ── Risk Scoring Utility ─────────────────────────────────────────────────

  /**
   * Compute a standalone risk score for a set of factors (no full simulation).
   * Returns a deterministic score 0-100 based on factor probabilities and impacts.
   *
   * @param {Array<{ probability: number, impact: number, mitigation?: boolean }>} riskFactors
   * @returns {{ score: number, grade: string, expectedImpact: number }}
   */
  scoreRisk(riskFactors = []) {
    let expectedImpact = 0;
    for (const f of riskFactors) {
      const raw       = (f.probability || 0.1) * (f.impact || 0.5);
      const effective = f.mitigation ? raw * 0.5 : raw;
      expectedImpact += effective;
    }
    // Clamp to [0, 1] and invert for score
    const score = Math.round(Math.max(0, 1 - expectedImpact) * 100);
    return { score, grade: scoreToGrade(score), expectedImpact: +expectedImpact.toFixed(4) };
  }

  // ── History & Status ─────────────────────────────────────────────────────

  /**
   * Return recent simulation history.
   * @param {number} [limit=20]
   * @returns {Array<object>}
   */
  getHistory(limit = 20) {
    return this._history.slice(-limit);
  }

  /**
   * Clear simulation history.
   */
  clearHistory() {
    this._history = [];
  }

  /**
   * Engine status summary.
   * @returns {{ totalRuns: number, lastRun: number|null, pipelineStages: string[] }}
   */
  status() {
    const last = this._history[this._history.length - 1];
    return {
      totalRuns:      this._history.length,
      lastRun:        last ? last.runAt : null,
      pipelineStages: Array.from(this._pipelineHooks.keys()),
      phi:            PHI,
      createdAt:      this._createdAt,
    };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  MonteCarloEngine,

  // Distribution samplers (exported for custom integrations)
  mulberry32,
  sampleUniform,
  sampleNormal,
  sampleTriangular,
  sample,

  // Statistical utilities
  wilsonInterval,
  descriptiveStats,
  scoreToGrade,

  // Constants
  PHI,
  RISK_GRADE,
  DISTRIBUTION,
  OUTCOME_THRESHOLDS,
};
```

---

### `src/prompts/csl-confidence-gate.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * CSL Confidence Gate — Error Prediction & Halt/Reconfigure System
 *
 * Uses Continuous Semantic Logic to predict errors BEFORE they occur
 * and halt operations when confidence drops below phi-scaled thresholds.
 *
 * Confidence Tiers (phi-scaled):
 *   > φ⁻¹ ≈ 0.618  →  EXECUTE   (high confidence, deterministic)
 *   0.382 – 0.618   →  CAUTIOUS  (adaptive temperature, log warning)
 *   < φ⁻² ≈ 0.382  →  HALT      (predicted error, stop + reconfigure)
 *
 * Error Prediction:
 *   Tracks rolling cosine similarity between consecutive output hashes.
 *   When drift exceeds 1 - φ⁻¹ ≈ 0.382, predicts impending error.
 *
 * Reconfiguration:
 *   When halted, returns a reconfiguration action plan:
 *     - Swap to a different model
 *     - Adjust temperature/parameters
 *     - Retry with different prompt composition
 *     - Escalate to human review
 *
 * @module csl-confidence-gate
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;
const PSI = 1 / PHI;             // ≈ 0.618
const PSI_SQ = PSI * PSI;           // ≈ 0.382

/** Confidence tiers — phi-derived thresholds */
const TIERS = Object.freeze({
    EXECUTE: PSI,                    // > 0.618  → proceed with full confidence
    CAUTIOUS: PSI_SQ,                 // 0.382–0.618 → proceed with caution
    HALT: 0,                      // < 0.382  → halt execution
});

/** Drift threshold — (1 - φ⁻¹) ≈ 0.382 */
const DRIFT_THRESHOLD = 1 - PSI;    // ≈ 0.382

/** Rolling window size for drift detection */
const DRIFT_WINDOW = Math.round(PHI ** 5); // ≈ 11

/** Domain reference vectors — phi-scaled pseudo-embeddings per domain.
 *  In production these would be real embeddings; here we use deterministic
 *  seeds for each domain to create reproducible reference vectors. */
const DOMAIN_SEEDS = Object.freeze({
    code: 0x636F6465,
    deploy: 0x64706C79,
    research: 0x72736368,
    security: 0x73656375,
    memory: 0x6D656D6F,
    orchestration: 0x6F726368,
    creative: 0x63726561,
    trading: 0x74726164,
});

// ─── CSLConfidenceGate ────────────────────────────────────────────────────────

class CSLConfidenceGate {
    /**
     * @param {Object} [options]
     * @param {number} [options.executeThreshold]  — override EXECUTE tier
     * @param {number} [options.cautiousThreshold] — override CAUTIOUS tier
     * @param {number} [options.driftThreshold]    — override drift detection
     * @param {number} [options.driftWindow]       — rolling window size
     */
    constructor(options = {}) {
        this.executeThreshold = options.executeThreshold || TIERS.EXECUTE;
        this.cautiousThreshold = options.cautiousThreshold || TIERS.CAUTIOUS;
        this.driftThreshold = options.driftThreshold || DRIFT_THRESHOLD;
        this.driftWindow = options.driftWindow || DRIFT_WINDOW;

        /** @type {string[]} Rolling window of output hashes for drift detection */
        this._outputHistory = [];

        /** Runtime stats */
        this._stats = {
            checks: 0,
            executes: 0,
            cautious: 0,
            halts: 0,
            drifts: 0,
            reconfigures: 0,
        };
    }

    // ─── Pre-Flight Check ───────────────────────────────────────────────────────

    /**
     * Pre-flight confidence check before prompt execution.
     *
     * Determines whether to EXECUTE, proceed with CAUTION, or HALT
     * based on phi-scaled confidence tiers.
     *
     * Confidence is computed from:
     *   1. Variable completeness (all required vars present?)
     *   2. Domain alignment (prompt domain is valid?)
     *   3. Input coherence (variables are non-empty, non-degenerate?)
     *   4. History stability (no recent drift alerts?)
     *
     * @param {string} promptId — prompt identifier
     * @param {Object} vars — variable map
     * @param {string} interpolated — the interpolated prompt string
     * @returns {{ decision: 'EXECUTE'|'CAUTIOUS'|'HALT', confidence: number, reason: string }}
     */
    preFlightCheck(promptId, vars, interpolated) {
        this._stats.checks++;

        // Factor 1: Variable completeness (are all vars non-null/non-empty?)
        const varEntries = Object.entries(vars);
        const totalVars = varEntries.length;
        const filledVars = varEntries.filter(([_, v]) => v !== null && v !== undefined && String(v).trim() !== '').length;
        const completeness = totalVars > 0 ? filledVars / totalVars : 0; // no vars = no confidence

        // Factor 2: Domain alignment (valid prompt ID format?)
        const domainMatch = promptId && promptId.includes('-') ? 1.0 : 0.3;
        const domain = promptId ? promptId.split('-')[0] : '';
        const knownDomain = domain in DOMAIN_SEEDS ? 1.0 : (domain === '' ? 0 : 0.3);

        // Factor 3: Input coherence (interpolated prompt is non-trivial?)
        const length = interpolated ? interpolated.length : 0;
        const coherence = length > 50 ? 1.0 : length > 10 ? 0.7 : 0.2;

        // Factor 4: History stability (no recent drift?)
        const recentDrifts = this._countRecentDrifts();
        const stability = recentDrifts === 0 ? 1.0 : recentDrifts < 3 ? 0.6 : 0.2;

        // Composite confidence — phi-weighted harmonic mean
        const weights = [PHI, 1.0, PSI, PSI_SQ]; // weight completeness highest
        const scores = [completeness, knownDomain * domainMatch, coherence, stability];
        const weightSum = weights.reduce((a, b) => a + b, 0);
        const confidence = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / weightSum;

        // Classify
        let decision, reason;
        if (confidence >= this.executeThreshold) {
            decision = 'EXECUTE';
            reason = `High confidence (${confidence.toFixed(3)} ≥ φ⁻¹=${this.executeThreshold.toFixed(3)})`;
            this._stats.executes++;
        } else if (confidence >= this.cautiousThreshold) {
            decision = 'CAUTIOUS';
            reason = `Moderate confidence (${confidence.toFixed(3)} ∈ [${this.cautiousThreshold.toFixed(3)}, ${this.executeThreshold.toFixed(3)}))`;
            this._stats.cautious++;
        } else {
            decision = 'HALT';
            reason = `Low confidence (${confidence.toFixed(3)} < φ⁻²=${this.cautiousThreshold.toFixed(3)}) — predicted error`;
            this._stats.halts++;
        }

        return { decision, confidence, reason, factors: { completeness, domainMatch, knownDomain, coherence, stability } };
    }

    // ─── Drift Detection ────────────────────────────────────────────────────────

    /**
     * Track output drift — detects when outputs are diverging from
     * deterministic expectations.
     *
     * Compares the current output hash against the rolling window.
     * If the proportion of unique hashes exceeds the drift threshold,
     * a drift alert is raised (error predicted).
     *
     * @param {string} outputHash — hash of the current output
     * @returns {{ drifting: boolean, driftScore: number, prediction: string }}
     */
    trackDrift(outputHash) {
        this._outputHistory.push(outputHash);

        // Maintain rolling window
        if (this._outputHistory.length > this.driftWindow) {
            this._outputHistory = this._outputHistory.slice(-this.driftWindow);
        }

        // Need at least 3 outputs to detect drift
        if (this._outputHistory.length < 3) {
            return { drifting: false, driftScore: 0, prediction: 'insufficient_data' };
        }

        // Drift score = proportion of unique hashes in window
        // For deterministic ops: all hashes should match → driftScore = 0
        // For drifting ops: hashes diverge → driftScore approaches 1
        const uniqueHashes = new Set(this._outputHistory).size;
        const driftScore = (uniqueHashes - 1) / (this._outputHistory.length - 1);

        const drifting = driftScore > this.driftThreshold;
        if (drifting) this._stats.drifts++;

        let prediction;
        if (driftScore === 0) {
            prediction = 'perfectly_deterministic';
        } else if (driftScore < PSI_SQ) {
            prediction = 'stable_with_minor_variation';
        } else if (driftScore < PSI) {
            prediction = 'drift_detected_error_likely';
        } else {
            prediction = 'severe_drift_error_imminent';
        }

        return { drifting, driftScore, prediction, windowSize: this._outputHistory.length, uniqueOutputs: uniqueHashes };
    }

    // ─── Reconfiguration ────────────────────────────────────────────────────────

    /**
     * Generate a reconfiguration plan when operations are halted.
     *
     * Returns an action plan based on the halting diagnostics:
     *   - If confidence was low due to completeness → suggest missing variables
     *   - If drift was detected → suggest model swap or temperature adjustment
     *   - If domain unknown → suggest prompt composition change
     *
     * @param {Object} diagnostics — from the halt event
     * @returns {{ action: string, newConfig: Object, steps: string[] }}
     */
    reconfigure(diagnostics) {
        this._stats.reconfigures++;

        const steps = [];
        const newConfig = {};

        const confidence = diagnostics.confidence || 0;
        const reason = diagnostics.reason || '';

        if (confidence < 0.2) {
            // Critical — escalate to human
            steps.push('ESCALATE: Confidence critically low, require human review');
            newConfig.escalate = true;
            newConfig.action = 'escalate';
        } else if (reason.includes('completeness') || reason.includes('Interpolation')) {
            // Missing variables — suggest filling them
            steps.push('FILL_VARIABLES: Complete all required prompt variables');
            steps.push('RETRY: Re-execute with completed variables');
            newConfig.action = 'fill_and_retry';
            newConfig.retryWithDefaults = true;
        } else if (reason.includes('drift') || reason.includes('diverging')) {
            // Drift — adjust model params
            steps.push('SWAP_MODEL: Switch to a model with lower variance');
            steps.push('LOCK_SEED: Enforce seed=42 on all subsequent calls');
            steps.push('REDUCE_TEMPERATURE: Force temperature=0');
            newConfig.action = 'stabilize';
            newConfig.llmOverrides = { temperature: 0, seed: 42, top_p: 1 };
        } else {
            // General halt — retry with different prompt composition
            steps.push('RECOMPOSE: Try alternative prompt composition from same domain');
            steps.push('RETRY: Execute with recomposed prompt');
            newConfig.action = 'recompose_and_retry';
        }

        return {
            action: newConfig.action || 'unknown',
            newConfig,
            steps,
            timestamp: Date.now(),
            diagnostics,
        };
    }

    // ─── Stats ──────────────────────────────────────────────────────────────────

    /**
     * Get gate statistics.
     * @returns {Object}
     */
    getStats() {
        return {
            ...this._stats,
            thresholds: {
                execute: this.executeThreshold,
                cautious: this.cautiousThreshold,
                drift: this.driftThreshold,
            },
            driftWindowSize: this._outputHistory.length,
            phi: PHI,
        };
    }

    // ─── Internal ───────────────────────────────────────────────────────────────

    /**
     * Count recent drift alerts (simple: count unique hashes in last N outputs).
     */
    _countRecentDrifts() {
        if (this._outputHistory.length < 3) return 0;
        const recent = this._outputHistory.slice(-5);
        return new Set(recent).size - 1; // 0 = no drift, 1+ = drifting
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = CSLConfidenceGate;
module.exports.CSLConfidenceGate = CSLConfidenceGate;
module.exports.TIERS = TIERS;
module.exports.DRIFT_THRESHOLD = DRIFT_THRESHOLD;
module.exports.PHI = PHI;
module.exports.PSI = PSI;
module.exports.PSI_SQ = PSI_SQ;
```

---

### `src/routes/csl-routes.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── CSL Gates REST Routes ────────────────────────────────────────────────────
 *
 * Patent Docket: HS-058
 * Express-style route handlers exposing Continuous Semantic Logic gates as REST
 * endpoints.  Satisfies Claim 9(e) (API layer) and Claim 10 (integration points).
 *
 * Mount in your Express app:
 *   const cslRoutes = require('./src/routes/csl-routes');
 *   app.use('/api/csl', cslRoutes);
 *
 * Endpoints:
 *   POST /api/csl/resonance              — Claim 1: resonance gate
 *   POST /api/csl/multi-resonance        — Claim 4: multi-resonance
 *   POST /api/csl/superposition          — Claim 2: superposition gate
 *   POST /api/csl/weighted-superposition — Claim 5: weighted superposition
 *   POST /api/csl/consensus-superposition— Claim 6: consensus superposition
 *   POST /api/csl/orthogonal             — Claim 3: orthogonal gate
 *   POST /api/csl/batch-orthogonal       — Claim 7: batch orthogonal
 *   POST /api/csl/soft-gate              — Claim 8: configurable sigmoid
 *   GET  /api/csl/stats                  — Claim 9(d): statistics
 *   POST /api/csl/stats/reset            — reset stats
 *   POST /api/csl/memory-density-gate    — Claim 10: vector memory integration
 *   POST /api/csl/hallucination-gate     — Claim 10: mesh integration point
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const {
    resonance_gate,
    multi_resonance,
    superposition_gate,
    weighted_superposition,
    consensus_superposition,
    orthogonal_gate,
    batch_orthogonal,
    soft_gate,
    getStats,
    resetStats,
    CSLSystem,
} = require('../core/csl-gates-enhanced');

// Shared CSL system instance for integration-point routes
const csl = new CSLSystem({ threshold: 0.5, steepness: 20 });

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that a value is a non-empty numeric array.
 * @param {any} v
 * @returns {boolean}
 */
function isVector(v) {
    return Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'number' && isFinite(x));
}

/**
 * Send a standardized error response.
 * @param {object} res
 * @param {number} statusCode
 * @param {string} message
 */
function sendError(res, statusCode, message) {
    return res.status(statusCode).json({ error: message });
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/csl/resonance
 * Claim 1: Resonance Gate — cosine similarity + sigmoid activation.
 *
 * Body: { vec_a: number[], vec_b: number[], threshold?: number, steepness?: number }
 * Returns: { score, activation, open, threshold, steepness }
 */
function postResonance(req, res) {
    // RTP: HS-058 Claim 1 and Claim 9(e)
    const { vec_a, vec_b, threshold = 0.5, steepness = 20 } = req.body;
    if (!isVector(vec_a)) return sendError(res, 400, 'vec_a must be a non-empty numeric array');
    if (!isVector(vec_b)) return sendError(res, 400, 'vec_b must be a non-empty numeric array');
    try {
        const result = resonance_gate(vec_a, vec_b, threshold, steepness);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/multi-resonance
 * Claim 4: Multi-Resonance — score N candidates against a target.
 *
 * Body: { target: number[], candidates: number[][], threshold?: number, steepness?: number }
 * Returns: Array<{ index, score, activation, open }>
 */
function postMultiResonance(req, res) {
    // RTP: HS-058 Claim 4 and Claim 9(e)
    const { target, candidates, threshold = 0.5, steepness = 20 } = req.body;
    if (!isVector(target))                     return sendError(res, 400, 'target must be a non-empty numeric array');
    if (!Array.isArray(candidates))            return sendError(res, 400, 'candidates must be an array');
    if (!candidates.every(isVector))           return sendError(res, 400, 'every candidate must be a numeric array');
    try {
        const results = multi_resonance(target, candidates, threshold, steepness);
        res.json({ ok: true, data: results });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/superposition
 * Claim 2: Superposition Gate — fuse two vectors.
 *
 * Body: { vec_a: number[], vec_b: number[] }
 * Returns: { hybrid: number[] }
 */
function postSuperposition(req, res) {
    // RTP: HS-058 Claim 2 and Claim 9(e)
    const { vec_a, vec_b } = req.body;
    if (!isVector(vec_a)) return sendError(res, 400, 'vec_a must be a non-empty numeric array');
    if (!isVector(vec_b)) return sendError(res, 400, 'vec_b must be a non-empty numeric array');
    try {
        const hybrid = superposition_gate(vec_a, vec_b);
        res.json({ ok: true, data: { hybrid: Array.from(hybrid) } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/weighted-superposition
 * Claim 5: Weighted Superposition — biased fusion with α.
 *
 * Body: { vec_a: number[], vec_b: number[], alpha: number }
 * Returns: { hybrid: number[], alpha }
 */
function postWeightedSuperposition(req, res) {
    // RTP: HS-058 Claim 5 and Claim 9(e)
    const { vec_a, vec_b, alpha = 0.5 } = req.body;
    if (!isVector(vec_a))                          return sendError(res, 400, 'vec_a must be a non-empty numeric array');
    if (!isVector(vec_b))                          return sendError(res, 400, 'vec_b must be a non-empty numeric array');
    if (typeof alpha !== 'number' || alpha < 0 || alpha > 1)
        return sendError(res, 400, 'alpha must be a number in [0, 1]');
    try {
        const hybrid = weighted_superposition(vec_a, vec_b, alpha);
        res.json({ ok: true, data: { hybrid: Array.from(hybrid), alpha } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/consensus-superposition
 * Claim 6: Consensus Superposition — fuse arbitrary N vectors.
 *
 * Body: { vectors: number[][] }
 * Returns: { consensus: number[] }
 */
function postConsensusSuperposition(req, res) {
    // RTP: HS-058 Claim 6 and Claim 9(e)
    const { vectors } = req.body;
    if (!Array.isArray(vectors) || vectors.length === 0)
        return sendError(res, 400, 'vectors must be a non-empty array');
    if (!vectors.every(isVector))
        return sendError(res, 400, 'every vector must be a non-empty numeric array');
    try {
        const consensus = consensus_superposition(vectors);
        res.json({ ok: true, data: { consensus: Array.from(consensus) } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/orthogonal
 * Claim 3: Orthogonal Gate — remove rejection vector from target.
 *
 * Body: { target_vec: number[], reject_vec: number[] }
 * Returns: { purified: number[] }
 */
function postOrthogonal(req, res) {
    // RTP: HS-058 Claim 3 and Claim 9(e)
    const { target_vec, reject_vec } = req.body;
    if (!isVector(target_vec)) return sendError(res, 400, 'target_vec must be a non-empty numeric array');
    if (!isVector(reject_vec)) return sendError(res, 400, 'reject_vec must be a non-empty numeric array');
    try {
        const purified = orthogonal_gate(target_vec, reject_vec);
        res.json({ ok: true, data: { purified: Array.from(purified) } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/batch-orthogonal
 * Claim 7: Batch Orthogonal — remove multiple rejection vectors.
 *
 * Body: { target_vec: number[], reject_vecs: number[][] }
 * Returns: { purified: number[] }
 */
function postBatchOrthogonal(req, res) {
    // RTP: HS-058 Claim 7 and Claim 9(e)
    const { target_vec, reject_vecs } = req.body;
    if (!isVector(target_vec))               return sendError(res, 400, 'target_vec must be a non-empty numeric array');
    if (!Array.isArray(reject_vecs))         return sendError(res, 400, 'reject_vecs must be an array');
    if (!reject_vecs.every(isVector))        return sendError(res, 400, 'every reject_vec must be a numeric array');
    try {
        const purified = batch_orthogonal(target_vec, reject_vecs);
        res.json({ ok: true, data: { purified: Array.from(purified) } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/soft-gate
 * Claim 8: Configurable sigmoid activation.
 *
 * Body: { score: number, threshold?: number, steepness?: number }
 * Returns: { activation: number }
 */
function postSoftGate(req, res) {
    // RTP: HS-058 Claim 8 and Claim 9(e)
    const { score, threshold = 0.5, steepness = 20 } = req.body;
    if (typeof score !== 'number' || !isFinite(score))
        return sendError(res, 400, 'score must be a finite number');
    try {
        const activation = soft_gate(score, threshold, steepness);
        res.json({ ok: true, data: { activation, score, threshold, steepness } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/csl/stats
 * Claim 9(d): Return gate invocation counts and average scores.
 */
function getStatsHandler(req, res) {
    // RTP: HS-058 Claim 9(d) and Claim 9(e)
    res.json({ ok: true, data: getStats() });
}

/**
 * POST /api/csl/stats/reset
 * Reset all statistics counters.
 */
function postStatsReset(req, res) {
    resetStats();
    res.json({ ok: true, data: { message: 'Stats reset successfully' } });
}

/**
 * POST /api/csl/memory-density-gate
 * Claim 10: Vector memory deduplication integration point.
 *
 * Body: { new_memory_vec: number[], existing_mem_vec: number[], threshold?: number }
 * Returns: { isDuplicate, score, activation }
 */
function postMemoryDensityGate(req, res) {
    // RTP: HS-058 Claim 10
    const { new_memory_vec, existing_mem_vec, threshold = 0.92 } = req.body;
    if (!isVector(new_memory_vec))    return sendError(res, 400, 'new_memory_vec required');
    if (!isVector(existing_mem_vec))  return sendError(res, 400, 'existing_mem_vec required');
    try {
        const result = csl.vectorMemoryDensityGate(new_memory_vec, existing_mem_vec, threshold);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/hallucination-gate
 * Claim 10: Self-healing mesh hallucination detection integration point.
 *
 * Body: { agent_output_vec: number[], consensus_vec: number[], threshold?: number }
 * Returns: { score, activation, hallucinated }
 */
function postHallucinationGate(req, res) {
    // RTP: HS-058 Claim 10
    const { agent_output_vec, consensus_vec, threshold = 0.7 } = req.body;
    if (!isVector(agent_output_vec)) return sendError(res, 400, 'agent_output_vec required');
    if (!isVector(consensus_vec))    return sendError(res, 400, 'consensus_vec required');
    try {
        const result = csl.hallucinationDetectionGate(agent_output_vec, consensus_vec, threshold);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Express Router
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register all CSL routes on an Express Router instance.
 *
 * Usage:
 *   const express = require('express');
 *   const { createRouter } = require('./src/routes/csl-routes');
 *   app.use('/api/csl', createRouter(express.Router()));
 *
 * @param {object} router — Express Router instance
 * @returns {object} configured router
 */
function createRouter(router) {
    router.post('/resonance',               postResonance);
    router.post('/multi-resonance',         postMultiResonance);
    router.post('/superposition',           postSuperposition);
    router.post('/weighted-superposition',  postWeightedSuperposition);
    router.post('/consensus-superposition', postConsensusSuperposition);
    router.post('/orthogonal',              postOrthogonal);
    router.post('/batch-orthogonal',        postBatchOrthogonal);
    router.post('/soft-gate',               postSoftGate);
    router.get( '/stats',                   getStatsHandler);
    router.post('/stats/reset',             postStatsReset);
    router.post('/memory-density-gate',     postMemoryDensityGate);
    router.post('/hallucination-gate',      postHallucinationGate);
    return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    createRouter,
    // Export individual handlers for testing without an HTTP layer
    handlers: {
        postResonance,
        postMultiResonance,
        postSuperposition,
        postWeightedSuperposition,
        postConsensusSuperposition,
        postOrthogonal,
        postBatchOrthogonal,
        postSoftGate,
        getStatsHandler,
        postStatsReset,
        postMemoryDensityGate,
        postHallucinationGate,
    },
};
```

---

### `src/services/csl-service-integration.js`

```javascript
/**
 * CSL Service Integration — Wires Continuous Semantic Logic into services
 *
 * Provides a lightweight façade that services import to route decisions
 * through CSL gates instead of discrete if/else.  The engine singleton
 * is shared across the process to avoid redundant Float64Array allocations.
 *
 * Usage in any service:
 *   const { csl, gate, decide, consensus } = require('./csl-service-integration');
 *   const { activation } = gate(inputVec, topicVec);      // replaces: if (topic === 'foo')
 *   const choice = decide(candidates, queryVec);           // replaces: switch/case
 *   const agreed = consensus(agentVectors);                // replaces: majority vote
 *
 * © 2026 HeadySystems Inc. — Proprietary
 * @module csl-service-integration
 */

'use strict';

const logger = require('../utils/logger');

// ── Lazy-load CSL engine (try/require pattern) ────────────────────────────
let _engine = null;

function getEngine() {
    if (_engine) return _engine;
    try {
        const { CSLEngine } = require('../core/csl-engine/csl-engine');
        _engine = new CSLEngine({ dim: 1536, normalizeInputs: true });
        logger.logNodeActivity('CSL', '  ✓ CSL Engine singleton: ACTIVE (1536-dim, phi-thresholds)');
    } catch (err) {
        // Fallback: lightweight compatibility shim
        logger.logNodeActivity('CSL', `  ⚠ CSL Engine unavailable, using shim: ${err.message}`);
        _engine = {
            AND(a, b) { return cosine(a, b); },
            OR(a, b) { return normalize(add(a, b)); },
            GATE(input, gateVec, threshold = 0.5) {
                const cos = cosine(input, gateVec);
                return { activation: cos >= (threshold || 0.5) ? 1 : 0, cosScore: cos };
            },
            CONSENSUS(vecs) {
                const dim = vecs[0].length;
                const sum = new Float64Array(dim);
                for (const v of vecs) for (let i = 0; i < dim; i++) sum[i] += v[i];
                const n = Math.sqrt(sum.reduce((s, x) => s + x * x, 0));
                return { consensus: n > 1e-10 ? sum.map(x => x / n) : sum, strength: n / vecs.length };
            },
            _stats: { operationCount: 0, degenerateVectors: 0, gateActivations: 0 }
        };
    }
    return _engine;
}

// Shim helpers
function cosine(a, b) {
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
    nA = Math.sqrt(nA); nB = Math.sqrt(nB);
    return (nA < 1e-10 || nB < 1e-10) ? 0 : dot / (nA * nB);
}
function add(a, b) { const r = new Float64Array(a.length); for (let i = 0; i < a.length; i++) r[i] = a[i] + b[i]; return r; }
function normalize(a) { const n = Math.sqrt(a.reduce((s, x) => s + x * x, 0)); return n < 1e-10 ? a : a.map(x => x / n); }

// ── Public API ────────────────────────────────────────────────────────────

/**
 * CSL gate — replaces if/else on semantic similarity
 * @param {Float64Array} input  - The input vector
 * @param {Float64Array} topic  - The gate topic vector
 * @param {number} [threshold]  - Optional override (default: engine default)
 * @returns {{ activation: number, cosScore: number }}
 */
function gate(input, topic, threshold) {
    return getEngine().GATE(input, topic, threshold, 'soft');
}

/**
 * decide — rank candidates by cosine similarity to query (replaces switch/case)
 * @param {Array<{ vector: Float64Array, label: string }>} candidates
 * @param {Float64Array} queryVec
 * @returns {{ label: string, score: number }[]}
 */
function decide(candidates, queryVec) {
    const engine = getEngine();
    return candidates
        .map(c => ({ label: c.label, score: engine.AND(queryVec, c.vector) }))
        .sort((a, b) => b.score - a.score);
}

/**
 * consensus — aggregate multiple agent vectors (replaces majority vote)
 * @param {Float64Array[]} vectors
 * @param {number[]} [weights]
 * @returns {{ consensus: Float64Array, strength: number }}
 */
function consensus(vectors, weights) {
    return getEngine().CONSENSUS(vectors, weights);
}

/**
 * stats — return engine operation counters
 */
function stats() {
    return getEngine()._stats || {};
}

module.exports = {
    get csl() { return getEngine(); },
    gate,
    decide,
    consensus,
    stats,
    getEngine,
};
```

---

### `src/shared/csl-engine.js`

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ CSL Engine — shared/csl-engine.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Continuous Semantic Logic: geometric AI gates replacing discrete boolean logic.
 * All operations work on unit vectors in ℝᴰ (D ∈ {384, 1536}).
 *
 * Gates: AND, OR, NOT, IMPLY, XOR, CONSENSUS, GATE
 * HDC/VSA: BIND, BUNDLE, PERMUTE for hyperdimensional computing
 * MoE Router: Cosine-similarity based expert routing
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { PHI, PSI, CSL_THRESHOLDS, PSI_POWERS, phiThreshold } = require('./phi-math');

// ─── Vector Utilities ────────────────────────────────────────────────────────

/**
 * Compute dot product of two vectors.
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {number}
 */
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Compute L2 norm of a vector.
 * @param {Float64Array|number[]} v
 * @returns {number}
 */
function norm(v) {
  return Math.sqrt(dot(v, v));
}

/**
 * Normalize a vector to unit length.
 * @param {Float64Array|number[]} v
 * @returns {Float64Array}
 */
function normalize(v) {
  const n = norm(v);
  if (n === 0) return new Float64Array(v.length);
  const result = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) result[i] = v[i] / n;
  return result;
}

/**
 * Add two vectors.
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function add(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) result[i] = a[i] + b[i];
  return result;
}

/**
 * Subtract vector b from a.
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function sub(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) result[i] = a[i] - b[i];
  return result;
}

/**
 * Scale a vector by a scalar.
 * @param {Float64Array|number[]} v
 * @param {number} s
 * @returns {Float64Array}
 */
function scale(v, s) {
  const result = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) result[i] = v[i] * s;
  return result;
}

// ─── CSL Gates ───────────────────────────────────────────────────────────────

/**
 * CSL AND: Cosine similarity — measures semantic alignment.
 * τ(a,b) = cos(θ) = (a·b) / (‖a‖·‖b‖)
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {number} Value in [-1, +1]
 */
function cslAND(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

/**
 * CSL OR: Superposition — soft semantic union.
 * OR(a,b) = normalize(a + b)
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array} Unit vector
 */
function cslOR(a, b) {
  return normalize(add(a, b));
}

/**
 * CSL NOT: Orthogonal projection — semantic negation.
 * NOT(a,b) = a - proj_b(a) = a - (a·b / ‖b‖²)·b
 * Property: NOT(a,b) · b = 0 (guaranteed orthogonality)
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function cslNOT(a, b) {
  const bNormSq = dot(b, b);
  if (bNormSq === 0) return new Float64Array(a);
  const projCoeff = dot(a, b) / bNormSq;
  return sub(a, scale(b, projCoeff));
}

/**
 * CSL IMPLY: Projection — component of a in direction of b.
 * IMPLY(a,b) = proj_b(a) = (a·b / ‖b‖²)·b
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function cslIMPLY(a, b) {
  const bNormSq = dot(b, b);
  if (bNormSq === 0) return new Float64Array(a.length);
  const projCoeff = dot(a, b) / bNormSq;
  return scale(b, projCoeff);
}

/**
 * CSL XOR: Exclusive semantic components.
 * XOR(a,b) = normalize(a+b) - mutual projection
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function cslXOR(a, b) {
  const combined = normalize(add(a, b));
  const aExclusive = cslNOT(a, b);
  const bExclusive = cslNOT(b, a);
  return normalize(add(aExclusive, bExclusive));
}

/**
 * CSL CONSENSUS: Weighted centroid of multiple agent vectors.
 * CONSENSUS(vᵢ, wᵢ) = normalize(Σ wᵢ·vᵢ)
 * @param {Array<Float64Array|number[]>} vectors
 * @param {number[]} [weights] - If omitted, uniform weights
 * @returns {Float64Array}
 */
function cslCONSENSUS(vectors, weights) {
  if (vectors.length === 0) return new Float64Array(0);
  const dim = vectors[0].length;
  const result = new Float64Array(dim);
  const w = weights || vectors.map(() => 1 / vectors.length);
  for (let v = 0; v < vectors.length; v++) {
    for (let d = 0; d < dim; d++) {
      result[d] += w[v] * vectors[v][d];
    }
  }
  return normalize(result);
}

/**
 * CSL GATE: Soft sigmoid gating on cosine alignment.
 * GATE(value, cos, τ, temp) = value × σ((cos - τ) / temp)
 * @param {number} value
 * @param {number} cosScore
 * @param {number} [tau=CSL_THRESHOLDS.MEDIUM]
 * @param {number} [temp=PSI³]
 * @returns {number}
 */
function cslGATE(value, cosScore, tau = CSL_THRESHOLDS.MEDIUM, temp = PSI_POWERS[3]) {
  const sigmoid = 1 / (1 + Math.exp(-(cosScore - tau) / temp));
  return value * sigmoid;
}

// ─── Multi-Vector Operations ─────────────────────────────────────────────────

/**
 * Batch cosine similarity of a query against multiple candidates.
 * @param {Float64Array|number[]} query
 * @param {Array<Float64Array|number[]>} candidates
 * @returns {number[]} Similarity scores
 */
function batchSimilarity(query, candidates) {
  return candidates.map(c => cslAND(query, c));
}

/**
 * Top-K selection by cosine similarity.
 * @param {Float64Array|number[]} query
 * @param {Array<{id: string, vector: Float64Array|number[]}>} items
 * @param {number} k
 * @returns {Array<{id: string, score: number}>}
 */
function topK(query, items, k) {
  const scored = items.map(item => ({
    id: item.id,
    score: cslAND(query, item.vector),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// ─── HDC/VSA Operations ──────────────────────────────────────────────────────

/**
 * HDC BIND: Element-wise multiplication (real HRR style).
 * Creates compositional representation (role-filler binding).
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function hdcBIND(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) result[i] = a[i] * b[i];
  return normalize(result);
}

/**
 * HDC BUNDLE: Aggregate multiple vectors (majority/superposition).
 * @param {Array<Float64Array|number[]>} vectors
 * @returns {Float64Array}
 */
function hdcBUNDLE(vectors) {
  if (vectors.length === 0) return new Float64Array(0);
  const dim = vectors[0].length;
  const result = new Float64Array(dim);
  for (const v of vectors) {
    for (let d = 0; d < dim; d++) result[d] += v[d];
  }
  return normalize(result);
}

/**
 * HDC PERMUTE: Cyclic shift for sequence encoding.
 * @param {Float64Array|number[]} v
 * @param {number} [n=1] - Number of positions to shift
 * @returns {Float64Array}
 */
function hdcPERMUTE(v, n = 1) {
  const len = v.length;
  const shift = ((n % len) + len) % len;
  const result = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    result[(i + shift) % len] = v[i];
  }
  return result;
}

// ─── MoE Router (CSL-Based) ─────────────────────────────────────────────────

/**
 * Cosine-similarity Mixture-of-Experts router.
 * Routes input to top-K experts using CSL scoring instead of learned weights.
 *
 * @param {Float64Array|number[]} input - Input embedding
 * @param {Array<{id: string, gate: Float64Array|number[]}>} experts
 * @param {object} [opts]
 * @param {number} [opts.k=2] - Top-K experts to select
 * @param {number} [opts.temperature] - Softmax temperature (default ψ³)
 * @param {number} [opts.antiCollapse] - Anti-collapse regularization (default ψ⁸)
 * @returns {Array<{id: string, weight: number}>}
 */
function moeRoute(input, experts, opts = {}) {
  const k = opts.k || 2;
  const temperature = opts.temperature || PSI_POWERS[3]; // ψ³ ≈ 0.236
  const antiCollapse = opts.antiCollapse || PSI_POWERS[8]; // ψ⁸ ≈ 0.013

  // Score each expert
  const scores = experts.map(e => ({
    id: e.id,
    raw: cslAND(input, e.gate),
  }));

  // Softmax with temperature
  const maxScore = Math.max(...scores.map(s => s.raw));
  const exps = scores.map(s => ({
    id: s.id,
    exp: Math.exp((s.raw - maxScore) / temperature) + antiCollapse,
  }));
  const sumExp = exps.reduce((s, e) => s + e.exp, 0);

  // Normalize and select top-K
  const probs = exps.map(e => ({ id: e.id, weight: e.exp / sumExp }));
  probs.sort((a, b) => b.weight - a.weight);
  const selected = probs.slice(0, k);

  // Re-normalize selected weights
  const selectedSum = selected.reduce((s, e) => s + e.weight, 0);
  return selected.map(e => ({ id: e.id, weight: e.weight / selectedSum }));
}

// ─── Ternary Logic ───────────────────────────────────────────────────────────

/**
 * Map cosine similarity to ternary truth value.
 * +1 ≈ TRUE, 0 ≈ UNKNOWN, -1 ≈ FALSE
 * @param {number} cosScore
 * @param {number} [threshold=CSL_THRESHOLDS.MINIMUM]
 * @returns {'TRUE'|'UNKNOWN'|'FALSE'}
 */
function ternary(cosScore, threshold = CSL_THRESHOLDS.MINIMUM) {
  if (cosScore >= threshold) return 'TRUE';
  if (cosScore <= -threshold) return 'FALSE';
  return 'UNKNOWN';
}

/**
 * Ternary truth value as continuous number.
 * Maps cos ∈ [-1,1] to truth ∈ [0,1] via (cos + 1) / 2.
 * @param {number} cosScore
 * @returns {number}
 */
function truthValue(cosScore) {
  return (cosScore + 1) / 2;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Vector utilities
  dot, norm, normalize, add, sub, scale,

  // CSL Gates
  cslAND, cslOR, cslNOT, cslIMPLY, cslXOR, cslCONSENSUS, cslGATE,

  // Multi-vector
  batchSimilarity, topK,

  // HDC/VSA
  hdcBIND, hdcBUNDLE, hdcPERMUTE,

  // MoE Router
  moeRoute,

  // Ternary Logic
  ternary, truthValue,
};
```

---

### `src/vsa/vsa-csl-bridge.js`

```javascript
/**
 * @fileoverview VSA-CSL Integration Bridge for Heady
 * @description Bridges Vector Symbolic Architectures with Continuous Semantic Logic
 * @version 1.0.0
 */

const { Hypervector } = require('./hypervector');
const { VSACodebook } = require('./codebook');
const { logger } = require('../utils/logger');

/**
 * Continuous Semantic Logic gates using VSA representations
 * Replaces traditional if/else with continuous vector operations
 */
class VSASemanticGates {
  /**
   * Create VSA semantic gates system
   * @param {VSACodebook} codebook - Codebook with semantic concepts
   */
  constructor(codebook) {
    this.codebook = codebook;
    this.gateCache = new Map(); // Cache computed gates for performance
  }

  /**
   * RESONANCE GATE: Measures semantic alignment between concepts
   * Returns continuous value [0, 1] representing how well concepts resonate
   * @param {string|Hypervector} concept_a
   * @param {string|Hypervector} concept_b
   * @returns {number} Resonance strength [0, 1]
   */
  resonance_gate(concept_a, concept_b) {
    const hv_a = typeof concept_a === 'string' ? this.codebook.get(concept_a) : concept_a;
    const hv_b = typeof concept_b === 'string' ? this.codebook.get(concept_b) : concept_b;

    if (!hv_a || !hv_b) {
      throw new Error('Concepts not found in codebook');
    }

    // Resonance = normalized similarity
    return hv_a.similarity(hv_b);
  }

  /**
   * SUPERPOSITION GATE: Combines multiple concepts into unified representation
   * Returns bundled hypervector representing semantic union
   * @param {Array<string|Hypervector>} concepts
   * @returns {Hypervector}
   */
  superposition_gate(...concepts) {
    if (concepts.length === 0) {
      throw new Error('Superposition requires at least 1 concept');
    }

    const vectors = concepts.map(c => 
      typeof c === 'string' ? this.codebook.get(c) : c
    );

    if (vectors.some(v => !v)) {
      throw new Error('Some concepts not found in codebook');
    }

    return vectors[0].bundle(vectors.slice(1));
  }

  /**
   * ORTHOGONAL GATE: Measures semantic independence/distinctness
   * Returns how orthogonal (different) two concepts are [0, 1]
   * High value = concepts are semantically independent
   * @param {string|Hypervector} concept_a
   * @param {string|Hypervector} concept_b
   * @returns {number} Orthogonality [0, 1]
   */
  orthogonal_gate(concept_a, concept_b) {
    const resonance = this.resonance_gate(concept_a, concept_b);

    // Orthogonality is inverse of resonance
    return 1 - resonance;
  }

  /**
   * SOFT GATE: Fuzzy threshold with smooth transition
   * Implements continuous logic gate with adjustable steepness
   * @param {number} value - Input value [0, 1]
   * @param {number} [threshold=0.618] - Activation threshold (default: φ - 1)
   * @param {number} [steepness=10] - Transition steepness
   * @returns {number} Output [0, 1]
   */
  soft_gate(value, threshold = 0.618, steepness = 10) {
    // Sigmoid-based soft threshold
    return 1 / (1 + Math.exp(-steepness * (value - threshold)));
  }

  /**
   * COMPOSITION GATE: Creates compositional semantic structure
   * Binds concepts in specified order to preserve structure
   * @param {Array<string|Hypervector>} concepts - Ordered concepts
   * @returns {Hypervector}
   */
  composition_gate(...concepts) {
    if (concepts.length === 0) {
      throw new Error('Composition requires at least 1 concept');
    }

    const vectors = concepts.map(c => 
      typeof c === 'string' ? this.codebook.get(c) : c
    );

    if (vectors.some(v => !v)) {
      throw new Error('Some concepts not found in codebook');
    }

    // Sequential binding maintains order
    let result = vectors[0];
    for (let i = 1; i < vectors.length; i++) {
      result = result.bind(vectors[i]);
    }

    return result;
  }

  /**
   * QUERY GATE: Semantic pattern matching against codebook
   * Returns best matching concepts above threshold
   * @param {Hypervector} query - Query vector
   * @param {number} [threshold=0.5] - Match threshold
   * @param {number} [topK=3] - Number of results
   * @returns {Array<{name: string, similarity: number}>}
   */
  query_gate(query, threshold = 0.5, topK = 3) {
    return this.codebook.query(query, threshold, topK);
  }

  /**
   * PHI DECISION GATE: Makes decision using phi-scale continuous logic
   * Replaces traditional if/else with continuous semantic decision
   * @param {Hypervector} state - Current state vector
   * @param {Array<{condition: string, action: Function}>} rules
   * @returns {*} Result of triggered action
   */
  phi_decision_gate(state, rules) {
    const PHI = (1 + Math.sqrt(5)) / 2;
    let bestMatch = null;
    let bestScore = 0;

    for (const rule of rules) {
      const conditionVector = this.codebook.get(rule.condition);
      if (!conditionVector) continue;

      const score = state.similarity(conditionVector);
      const phiScore = score * PHI; // Amplify using golden ratio

      if (phiScore > bestScore) {
        bestScore = phiScore;
        bestMatch = rule;
      }
    }

    if (bestMatch && bestScore > 0.618) { // φ - 1 threshold
      return bestMatch.action(bestScore);
    }

    return null;
  }

  /**
   * CONTINUOUS AND gate: Fuzzy conjunction using T-norm
   * @param {number} a - Value [0, 1]
   * @param {number} b - Value [0, 1]
   * @returns {number} Conjunction result [0, 1]
   */
  continuous_and(a, b) {
    // Product T-norm (smooth and differentiable)
    return a * b;
  }

  /**
   * CONTINUOUS OR gate: Fuzzy disjunction using T-conorm
   * @param {number} a - Value [0, 1]
   * @param {number} b - Value [0, 1]
   * @returns {number} Disjunction result [0, 1]
   */
  continuous_or(a, b) {
    // Probabilistic sum T-conorm
    return a + b - a * b;
  }

  /**
   * CONTINUOUS NOT gate: Fuzzy negation
   * @param {number} a - Value [0, 1]
   * @returns {number} Negation result [0, 1]
   */
  continuous_not(a) {
    return 1 - a;
  }

  /**
   * CONTINUOUS IMPLIES gate: Fuzzy implication
   * @param {number} a - Antecedent [0, 1]
   * @param {number} b - Consequent [0, 1]
   * @returns {number} Implication result [0, 1]
   */
  continuous_implies(a, b) {
    // Gödel implication: if a ≤ b then 1 else b
    return a <= b ? 1 : b;
  }

  /**
   * Clear gate cache (for memory management)
   */
  clearCache() {
    this.gateCache.clear();
    logger.debug('Cleared VSA gate cache');
  }
}

/**
 * CSL Script Interpreter for VSA-based semantic logic
 */
class CSLInterpreter {
  /**
   * Create CSL interpreter
   * @param {VSASemanticGates} gates - VSA semantic gates system
   */
  constructor(gates) {
    this.gates = gates;
    this.variables = new Map(); // Runtime variables
    this.stack = []; // Execution stack
  }

  /**
   * Execute CSL script
   * @param {string} script - CSL script content
   * @returns {*} Script result
   */
  execute(script) {
    const lines = script.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

    for (const line of lines) {
      this.executeLine(line);
    }

    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  /**
   * Execute single CSL line
   * @param {string} line
   */
  executeLine(line) {
    // Variable assignment: @var_name = expression
    if (line.startsWith('@')) {
      const [varName, ...exprParts] = line.substring(1).split('=');
      const expression = exprParts.join('=').trim();
      const value = this.evaluateExpression(expression);
      this.variables.set(varName.trim(), value);
      return;
    }

    // Gate invocation: resonance_gate(A, B)
    if (line.includes('(')) {
      const result = this.evaluateExpression(line);
      this.stack.push(result);
      return;
    }

    // Concept push: CONCEPT_NAME
    if (line.match(/^[A-Z_]+$/)) {
      const concept = this.gates.codebook.get(line);
      if (concept) {
        this.stack.push(concept);
      }
    }
  }

  /**
   * Evaluate expression
   * @param {string} expr
   * @returns {*}
   */
  evaluateExpression(expr) {
    expr = expr.trim();

    // Variable reference
    if (expr.startsWith('$')) {
      return this.variables.get(expr.substring(1));
    }

    // Numeric literal
    if (!isNaN(expr)) {
      return parseFloat(expr);
    }

    // Gate invocation
    const gateMatch = expr.match(/^([a-z_]+)\((.*)\)$/);
    if (gateMatch) {
      const [, gateName, argsStr] = gateMatch;
      const args = argsStr.split(',').map(a => this.evaluateExpression(a.trim()));

      if (typeof this.gates[gateName] === 'function') {
        return this.gates[gateName](...args);
      }
    }

    // Concept reference
    return this.gates.codebook.get(expr);
  }

  /**
   * Get variable value
   * @param {string} name
   * @returns {*}
   */
  getVariable(name) {
    return this.variables.get(name);
  }

  /**
   * Clear interpreter state
   */
  reset() {
    this.variables.clear();
    this.stack = [];
  }
}

module.exports = {
  VSASemanticGates,
  CSLInterpreter
};
```

---

### `src/trading/apex-risk-agent.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Apex 3.0 Risk Agent — Hardcoded risk parameters for HeadyBuddy
 * autonomous trading on Apex Trader Funding platform.
 *
 * These rules are IMMUTABLE in production. Any modification requires
 * explicit owner approval through CodeGovernance gate.
 */

const EventEmitter = require('events');
const CSL = require('../core/semantic-logic');

// ═══ APEX 3.0 RISK PARAMETERS — IMMUTABLE ═══════════════════════════════════
const APEX_RULES = Object.freeze({
    // Account tiers
    accounts: {
        '25K': { balance: 25000, trailingDrawdown: 1500, initialMAE: 450, safetyNetBuffer: 100 },
        '50K': { balance: 50000, trailingDrawdown: 2500, initialMAE: 750, safetyNetBuffer: 100 },
        '75K': { balance: 75000, trailingDrawdown: 2750, initialMAE: 825, safetyNetBuffer: 100 },
        '100K': { balance: 100000, trailingDrawdown: 3000, initialMAE: 900, safetyNetBuffer: 100 },
        '150K': { balance: 150000, trailingDrawdown: 5000, initialMAE: 1500, safetyNetBuffer: 100 },
        '250K': { balance: 250000, trailingDrawdown: 6500, initialMAE: 1950, safetyNetBuffer: 100 },
        '300K': { balance: 300000, trailingDrawdown: 7500, initialMAE: 2250, safetyNetBuffer: 100 },
    },

    // Universal rules
    consistencyRule: 0.30,           // No single day > 30% of total profit
    maeRule: 0.30,                   // Max open negative P&L = 30% of day profit/trailing
    minTradingDaysBetweenPayouts: 8,
    minProfitableDays: 5,            // $100+ profit per profitable day
    minProfitPerDay: 100,            // Minimum to count as "profitable day"
    safetyNetPayouts: 3,             // First 3 payouts require safety net

    // Execution constraints
    maxPositionHoldOvernight: false,  // Flatten before session close
    tradingHoursUTC: { start: '23:00', end: '22:00' }, // CME Globex
    newsBlackoutMinutes: 5,          // No entries within 5m of major news
});

// ═══ TERNARY SIGNAL STATES ══════════════════════════════════════════════════
const SIGNAL = Object.freeze({
    REPEL: -1,  // Non-viable, skip
    HOLD: 0,  // Epistemic hold — gather more data
    ENGAGE: +1,  // Validated, execute
});

class ApexRiskAgent extends EventEmitter {
    constructor(accountTier = '50K') {
        super();
        this.tier = accountTier;
        this.rules = APEX_RULES.accounts[accountTier];
        if (!this.rules) throw new Error(`Unknown Apex account tier: ${accountTier}`);

        // Runtime state
        this.sessionState = {
            startOfDayBalance: this.rules.balance,
            highestEquity: this.rules.balance,
            currentEquity: this.rules.balance,
            openPnL: 0,
            dailyPnL: 0,
            tradingDays: 0,
            profitableDays: 0,
            totalProfit: 0,
            dailyProfits: [],
            signals: [],
            violations: [],
            lastCheckTs: null,
        };

        this.started = false;
        this.checkInterval = null;
    }

    // ─── CORE RISK CHECKS ───────────────────────────────────────────────
    /**
     * Check if current state violates any Apex 3.0 rules.
     * Returns { safe: boolean, violations: string[], signal: -1|0|+1 }
     */
    checkRisk(equity, openPnL) {
        const violations = [];
        const state = this.sessionState;

        state.currentEquity = equity;
        state.openPnL = openPnL;
        state.lastCheckTs = new Date().toISOString();

        // Update highest equity watermark
        if (equity > state.highestEquity) {
            state.highestEquity = equity;
        }

        // 1. Trailing Drawdown Check
        const drawdownFloor = state.highestEquity - this.rules.trailingDrawdown;
        if (equity <= drawdownFloor) {
            violations.push(`TRAILING_DRAWDOWN: Equity $${equity.toFixed(2)} <= floor $${drawdownFloor.toFixed(2)}`);
        }

        // 2. MAE Check (30% negative P&L rule)
        const maeLimit = Math.max(this.rules.initialMAE, state.dailyPnL * APEX_RULES.maeRule);
        if (openPnL < 0 && Math.abs(openPnL) > maeLimit) {
            violations.push(`MAE_EXCEEDED: Open P&L $${openPnL.toFixed(2)} exceeds limit $${(-maeLimit).toFixed(2)}`);
        }

        // 3. Consistency Rule Check
        if (state.totalProfit > 0 && state.dailyPnL > 0) {
            const consistencyMax = state.totalProfit * APEX_RULES.consistencyRule;
            if (state.dailyPnL > consistencyMax) {
                violations.push(`CONSISTENCY: Daily P&L $${state.dailyPnL.toFixed(2)} > 30% of total $${consistencyMax.toFixed(2)}`);
            }
        }

        // ═══ CSL-POWERED SIGNAL DETERMINATION ═══════════════════════════════
        // Use continuous risk_gate instead of binary comparisons.
        // The sigmoid activation provides smooth transitions near limits.
        let signal;
        if (violations.length > 0) {
            signal = SIGNAL.REPEL;
            this.emit('risk:violation', { violations, equity, openPnL, ts: state.lastCheckTs });
        } else {
            // CSL Risk Gate: continuous proximity-to-limit evaluation
            const riskEval = CSL.risk_gate(openPnL, maeLimit, 0.8, 12);
            // CSL Soft Gate on drawdown proximity
            const drawdownProximity = (state.highestEquity - equity) / this.rules.trailingDrawdown;
            const drawdownActivation = CSL.soft_gate(drawdownProximity, 0.7, 15);

            if (riskEval.signal === -1 || drawdownActivation > 0.85) {
                signal = SIGNAL.HOLD; // Continuous risk approaching critical
                this.emit('risk:caution', {
                    reason: 'CSL risk gate activation',
                    riskLevel: riskEval.riskLevel,
                    drawdownActivation: +drawdownActivation.toFixed(4),
                    equity, openPnL,
                });
            } else {
                signal = SIGNAL.ENGAGE;
            }
        }

        // Record signal
        state.signals.push({ signal, equity, openPnL, ts: state.lastCheckTs });
        if (state.signals.length > 1000) state.signals = state.signals.slice(-500);

        // Record violations
        if (violations.length > 0) {
            state.violations.push(...violations.map(v => ({ violation: v, ts: state.lastCheckTs })));
            if (state.violations.length > 500) state.violations = state.violations.slice(-250);
        }

        return { safe: violations.length === 0, violations, signal };
    }

    // ─── SAFETY NET ─────────────────────────────────────────────────────
    /**
     * Calculate safety net for payout requests.
     * $Safety_Net = Starting_Balance + Trailing_Threshold + 100
     */
    getSafetyNet() {
        return this.rules.balance + this.rules.trailingDrawdown + this.rules.safetyNetBuffer;
    }

    canRequestPayout(requestAmount) {
        const safetyNet = this.getSafetyNet();
        const balanceAfter = this.sessionState.currentEquity - requestAmount;
        const meetsMinDays = this.sessionState.tradingDays >= APEX_RULES.minTradingDaysBetweenPayouts;
        const meetsProfitDays = this.sessionState.profitableDays >= APEX_RULES.minProfitableDays;
        const aboveSafetyNet = balanceAfter >= safetyNet;

        return {
            allowed: meetsMinDays && meetsProfitDays && aboveSafetyNet,
            safetyNet,
            balanceAfter,
            tradingDays: this.sessionState.tradingDays,
            profitableDays: this.sessionState.profitableDays,
            reasons: [
                !meetsMinDays ? `Need ${APEX_RULES.minTradingDaysBetweenPayouts} trading days, have ${this.sessionState.tradingDays}` : null,
                !meetsProfitDays ? `Need ${APEX_RULES.minProfitableDays} profitable days, have ${this.sessionState.profitableDays}` : null,
                !aboveSafetyNet ? `Balance after ($${balanceAfter.toFixed(2)}) below safety net ($${safetyNet.toFixed(2)})` : null,
            ].filter(Boolean),
        };
    }

    // ─── SESSION MANAGEMENT ─────────────────────────────────────────────
    startSession(balance) {
        this.sessionState.startOfDayBalance = balance || this.rules.balance;
        this.sessionState.currentEquity = balance || this.rules.balance;
        this.sessionState.highestEquity = balance || this.rules.balance;
        this.sessionState.dailyPnL = 0;
        this.sessionState.openPnL = 0;
        this.started = true;
        this.emit('session:started', { tier: this.tier, balance: this.sessionState.startOfDayBalance });
    }

    endSession() {
        const dailyPnL = this.sessionState.currentEquity - this.sessionState.startOfDayBalance;
        this.sessionState.tradingDays++;
        this.sessionState.dailyProfits.push(dailyPnL);
        if (dailyPnL >= APEX_RULES.minProfitPerDay) {
            this.sessionState.profitableDays++;
        }
        this.sessionState.totalProfit += Math.max(0, dailyPnL);
        this.started = false;
        this.emit('session:ended', {
            tier: this.tier, dailyPnL, totalProfit: this.sessionState.totalProfit,
            tradingDays: this.sessionState.tradingDays, profitableDays: this.sessionState.profitableDays,
        });
    }

    // ─── STATUS ─────────────────────────────────────────────────────────
    getStatus() {
        const safetyNet = this.getSafetyNet();
        return {
            node: 'apex-risk-agent',
            tier: this.tier,
            rules: this.rules,
            universalRules: {
                consistencyRule: `${APEX_RULES.consistencyRule * 100}%`,
                maeRule: `${APEX_RULES.maeRule * 100}%`,
                minTradingDays: APEX_RULES.minTradingDaysBetweenPayouts,
                minProfitableDays: APEX_RULES.minProfitableDays,
            },
            session: {
                active: this.started,
                currentEquity: this.sessionState.currentEquity,
                highestEquity: this.sessionState.highestEquity,
                openPnL: this.sessionState.openPnL,
                dailyPnL: this.sessionState.dailyPnL,
                totalProfit: this.sessionState.totalProfit,
                tradingDays: this.sessionState.tradingDays,
                profitableDays: this.sessionState.profitableDays,
            },
            safetyNet,
            drawdownFloor: this.sessionState.highestEquity - this.rules.trailingDrawdown,
            recentSignals: this.sessionState.signals.slice(-10),
            recentViolations: this.sessionState.violations.slice(-10),
            ts: new Date().toISOString(),
        };
    }
}

// ─── ROUTE REGISTRATION ─────────────────────────────────────────────────────
function registerApexRoutes(app, agent) {
    const express = require('../core/heady-server');
    const router = express.Router();

    router.get('/status', (req, res) => {
        res.json({ ok: true, ...agent.getStatus() });
    });

    router.get('/rules', (req, res) => {
        res.json({ ok: true, rules: APEX_RULES, ts: new Date().toISOString() });
    });

    router.post('/check', (req, res) => {
        const { equity, openPnL } = req.body;
        if (equity === undefined || openPnL === undefined) {
            return res.status(400).json({ ok: false, error: 'equity and openPnL required' });
        }
        const result = agent.checkRisk(equity, openPnL);
        res.json({ ok: true, ...result, ts: new Date().toISOString() });
    });

    router.post('/payout-check', (req, res) => {
        const { amount } = req.body;
        if (!amount) return res.status(400).json({ ok: false, error: 'amount required' });
        const result = agent.canRequestPayout(amount);
        res.json({ ok: true, ...result, ts: new Date().toISOString() });
    });

    router.post('/session/start', (req, res) => {
        agent.startSession(req.body.balance);
        res.json({ ok: true, message: 'Session started', ...agent.getStatus() });
    });

    router.post('/session/end', (req, res) => {
        agent.endSession();
        res.json({ ok: true, message: 'Session ended', ...agent.getStatus() });
    });

    app.use('/api/apex', router);
}

module.exports = { ApexRiskAgent, registerApexRoutes, APEX_RULES, SIGNAL };
```

---

### `src/bees/trading-bee.js`

```javascript
/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Trading Bee — Covers all trading/financial modules:
 * trading-tasks.js, apex-risk-agent.js, payment-gateway.js,
 * heady-fintech-agent.js, trader-core.js, biometric-hitl.js, webgl-orderbook.js
 */
const domain = 'trading';
const description = 'Trading tasks, apex risk, payment gateway, fintech agent, trader widgets';
const priority = 0.75;

function getWork(ctx = {}) {
    const mods = [
        { name: 'trading-tasks', path: '../trading-tasks' },
        { name: 'apex-risk-agent', path: '../trading/apex-risk-agent' },
        { name: 'payment-gateway', path: '../api/payment-gateway' },
        { name: 'trader-core', path: '../widgets/trader-widget/trader-core' },
        { name: 'biometric-hitl', path: '../widgets/trader-widget/biometric-hitl' },
        { name: 'webgl-orderbook', path: '../widgets/trader-widget/webgl-orderbook' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
```

---

### `src/shared/trading-tasks.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HeadyBuddy Trading Tasks — Auto-Success task definitions
 * for the Apex 3.0 autonomous trading system.
 *
 * These tasks are auto-assigned, auto-completing, and produce
 * comprehensive audit trail entries for every cycle.
 */

module.exports = [
    // ═══ APEX RISK MONITORING (15) ═══════════════════════════════════════════
    {
        id: "apx-001", name: "Verify trailing drawdown calculation",
        cat: "trading", pool: "hot", w: 5,
        desc: "Confirm trailing drawdown tracks highest intraday equity correctly"
    },
    {
        id: "apx-002", name: "Validate MAE 30% rule enforcement",
        cat: "trading", pool: "hot", w: 5,
        desc: "Ensure max adverse excursion never exceeds 30% of day profit balance"
    },
    {
        id: "apx-003", name: "Check consistency rule compliance",
        cat: "trading", pool: "hot", w: 5,
        desc: "Verify no single day exceeds 30% of total profit"
    },
    {
        id: "apx-004", name: "Calculate safety net threshold",
        cat: "trading", pool: "warm", w: 4,
        desc: "Compute Safety_Net = Starting_Balance + Trailing_Threshold + 100"
    },
    {
        id: "apx-005", name: "Monitor payout eligibility",
        cat: "trading", pool: "warm", w: 3,
        desc: "Track trading days (≥8) and profitable days (≥5 at $100+) for payout"
    },
    {
        id: "apx-006", name: "Validate position flattening before close",
        cat: "trading", pool: "hot", w: 5,
        desc: "Ensure all positions flatten before CME Globex session close"
    },
    {
        id: "apx-007", name: "Check news blackout enforcement",
        cat: "trading", pool: "warm", w: 4,
        desc: "Verify no entries within 5 minutes of major economic releases"
    },
    {
        id: "apx-008", name: "Monitor account tier parameters",
        cat: "trading", pool: "warm", w: 3,
        desc: "Validate current account tier rules match Apex 3.0 specifications"
    },
    {
        id: "apx-009", name: "Track risk agent signal distribution",
        cat: "trading", pool: "warm", w: 3,
        desc: "Monitor ternary signal balance: REPEL(-1), HOLD(0), ENGAGE(+1)"
    },
    {
        id: "apx-010", name: "Audit violation history",
        cat: "trading", pool: "warm", w: 4,
        desc: "Review and categorize all risk violations for pattern analysis"
    },
    {
        id: "apx-011", name: "Validate daily P&L tracking accuracy",
        cat: "trading", pool: "warm", w: 4,
        desc: "Cross-check daily P&L records against session start/end balances"
    },
    {
        id: "apx-012", name: "Monitor drawdown proximity alerts",
        cat: "trading", pool: "hot", w: 5,
        desc: "Trigger early warning when equity approaches 80% of drawdown threshold"
    },
    {
        id: "apx-013", name: "Verify session state persistence",
        cat: "trading", pool: "cold", w: 2,
        desc: "Ensure trading session state survives service restarts"
    },
    {
        id: "apx-014", name: "Check multi-account isolation",
        cat: "trading", pool: "warm", w: 3,
        desc: "Verify risk parameters are isolated per account instance"
    },
    {
        id: "apx-015", name: "Monitor execution latency budget",
        cat: "trading", pool: "hot", w: 5,
        desc: "Track total execution latency targeting 20ms via PTX hot path"
    },
    // ═══ TERNARY REASONER MODULE (10) ════════════════════════════════════════
    {
        id: "trm-001", name: "Validate ternary state transitions",
        cat: "trading", pool: "warm", w: 4,
        desc: "Verify {-1, 0, +1} transitions follow valid state machine rules"
    },
    {
        id: "trm-002", name: "Monitor epistemic hold duration",
        cat: "trading", pool: "warm", w: 3,
        desc: "Track average hold(0) state duration — optimize for decision speed"
    },
    {
        id: "trm-003", name: "Check sparse computation efficiency",
        cat: "trading", pool: "warm", w: 4,
        desc: "Measure -1 position skip rate for inference speedup validation"
    },
    {
        id: "trm-004", name: "Validate TRM weight integrity",
        cat: "trading", pool: "cold", w: 3,
        desc: "Verify 525KB quantized weight file integrity via SHA-256 hash"
    },
    {
        id: "trm-005", name: "Monitor query throughput",
        cat: "trading", pool: "hot", w: 5,
        desc: "Track queries/second targeting 5,882 QPS benchmark"
    },
    {
        id: "trm-006", name: "Check CLA v0 compression ratio",
        cat: "trading", pool: "warm", w: 3,
        desc: "Validate semantic dehydration achieving ≥70% compression"
    },
    {
        id: "trm-007", name: "Monitor Galaxy 3D RAM commit latency",
        cat: "trading", pool: "hot", w: 5,
        desc: "Ensure alpha signal vector commits complete within 5ms"
    },
    {
        id: "trm-008", name: "Validate k-NN search accuracy",
        cat: "trading", pool: "warm", w: 4,
        desc: "Test semantic similarity search returns relevant vectors under 100µs"
    },
    {
        id: "trm-009", name: "Check swarm signal consensus",
        cat: "trading", pool: "warm", w: 4,
        desc: "Monitor multi-agent validation rate for signal promotion to ENGAGE(+1)"
    },
    {
        id: "trm-010", name: "Audit A2UI widget generation",
        cat: "trading", pool: "cold", w: 2,
        desc: "Verify ephemeral trading UI widgets display ternary states correctly"
    },
];
```

---

### `src/shared/sacred-geometry.js`

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Sacred Geometry — shared/sacred-geometry.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Orchestration topology, node placement rings, coherence scoring,
 * Fibonacci resource allocation, and UI aesthetic constants.
 *
 * Every node, agent, and UI element follows geometric principles derived from φ.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { PHI, PSI, CSL_THRESHOLDS, fib, phiFusionWeights, poolAllocation } = require('./phi-math');
const { cslAND, normalize, add } = require('./csl-engine');

// ─── Node Topology ───────────────────────────────────────────────────────────

/**
 * Geometric ring topology for the 20 AI nodes.
 * Central → Inner → Middle → Outer → Governance
 */
const NODE_RINGS = Object.freeze({
  CENTRAL: {
    radius: 0,
    nodes: ['HeadySoul'],
    role: 'Awareness and values layer — origin point',
  },
  INNER: {
    radius: 1,
    nodes: ['HeadyBrains', 'HeadyConductor', 'HeadyVinci'],
    role: 'Processing core — orchestration, reasoning, planning',
  },
  MIDDLE: {
    radius: PHI,
    nodes: ['JULES', 'BUILDER', 'ATLAS', 'NOVA', 'HeadyLens', 'StoryDriver'],
    role: 'Execution layer — coding, building, monitoring, documentation',
  },
  OUTER: {
    radius: PHI * PHI,
    nodes: ['HeadyScientist', 'HeadyMC', 'PatternRecognition', 'SelfCritique',
            'SASHA', 'Imagination', 'HCSupervisor', 'HCBrain'],
    role: 'Specialized capabilities — research, simulation, creativity, supervision',
  },
  GOVERNANCE: {
    radius: PHI * PHI * PHI,
    nodes: ['HeadyQA', 'HeadyCheck', 'HeadyRisk'],
    role: 'Quality, assurance, risk — governance shell',
  },
});

/**
 * All 20 node names in canonical order (center-out).
 */
const ALL_NODES = Object.freeze(
  Object.values(NODE_RINGS).flatMap(ring => ring.nodes)
);

/**
 * Lookup which ring a node belongs to.
 * @param {string} nodeName
 * @returns {string|null} Ring name or null
 */
function nodeRing(nodeName) {
  for (const [ringName, ring] of Object.entries(NODE_RINGS)) {
    if (ring.nodes.includes(nodeName)) return ringName;
  }
  return null;
}

/**
 * Geometric distance between two nodes based on ring positions.
 * Nodes in the same ring have distance = ring angular separation.
 * Nodes in different rings have distance = ring radius difference.
 * @param {string} nodeA
 * @param {string} nodeB
 * @returns {number}
 */
function nodeDistance(nodeA, nodeB) {
  const ringA = nodeRing(nodeA);
  const ringB = nodeRing(nodeB);
  if (!ringA || !ringB) return Infinity;

  const rA = NODE_RINGS[ringA];
  const rB = NODE_RINGS[ringB];

  if (ringA === ringB) {
    // Same ring: angular distance based on position index
    const idxA = rA.nodes.indexOf(nodeA);
    const idxB = rA.nodes.indexOf(nodeB);
    const angularDist = Math.abs(idxA - idxB) / rA.nodes.length;
    return rA.radius * angularDist * 2 * Math.PI / rA.nodes.length;
  }

  // Different rings: radius difference + minimal angular correction
  return Math.abs(rA.radius - rB.radius);
}

// ─── Coherence Scoring ───────────────────────────────────────────────────────

const COHERENCE_THRESHOLDS = Object.freeze({
  HEALTHY:   CSL_THRESHOLDS.HIGH,     // ≈ 0.882 — normal operating range
  WARNING:   CSL_THRESHOLDS.MEDIUM,   // ≈ 0.809 — slight drift
  DEGRADED:  CSL_THRESHOLDS.LOW,      // ≈ 0.691 — significant drift
  CRITICAL:  CSL_THRESHOLDS.MINIMUM,  // ≈ 0.500 — system integrity at risk
});

/**
 * Compute coherence between two node state embeddings.
 * @param {Float64Array|number[]} stateA
 * @param {Float64Array|number[]} stateB
 * @returns {{ score: number, status: string }}
 */
function coherenceScore(stateA, stateB) {
  const score = cslAND(stateA, stateB);
  let status;
  if (score >= COHERENCE_THRESHOLDS.HEALTHY)   status = 'HEALTHY';
  else if (score >= COHERENCE_THRESHOLDS.WARNING)   status = 'WARNING';
  else if (score >= COHERENCE_THRESHOLDS.DEGRADED)  status = 'DEGRADED';
  else status = 'CRITICAL';
  return { score, status };
}

/**
 * Compute system-wide coherence by averaging all pairwise node scores.
 * @param {Map<string, Float64Array|number[]>} nodeStates - Map of node name → state vector
 * @returns {{ overall: number, status: string, drifted: string[] }}
 */
function systemCoherence(nodeStates) {
  const nodes = Array.from(nodeStates.keys());
  const drifted = [];
  let totalScore = 0;
  let pairCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const { score, status } = coherenceScore(
        nodeStates.get(nodes[i]),
        nodeStates.get(nodes[j])
      );
      totalScore += score;
      pairCount++;
      if (status === 'CRITICAL' || status === 'DEGRADED') {
        drifted.push(`${nodes[i]}<->${nodes[j]} (${score.toFixed(3)} ${status})`);
      }
    }
  }

  const overall = pairCount > 0 ? totalScore / pairCount : 0;
  let status;
  if (overall >= COHERENCE_THRESHOLDS.HEALTHY)  status = 'HEALTHY';
  else if (overall >= COHERENCE_THRESHOLDS.WARNING)  status = 'WARNING';
  else if (overall >= COHERENCE_THRESHOLDS.DEGRADED) status = 'DEGRADED';
  else status = 'CRITICAL';

  return { overall, status, drifted };
}

// ─── Pool Scheduling ─────────────────────────────────────────────────────────

/**
 * Hot/Warm/Cold pool definitions with Fibonacci resource ratios.
 */
const POOL_CONFIG = Object.freeze({
  HOT: {
    name: 'hot',
    purpose: 'User-facing, latency-critical tasks',
    resourcePct: fib(9),   // 34%
    maxConcurrency: fib(8), // 21
    timeoutMs: 5000,
    priority: 0,
  },
  WARM: {
    name: 'warm',
    purpose: 'Background processing, non-urgent tasks',
    resourcePct: fib(8),   // 21%
    maxConcurrency: fib(7), // 13
    timeoutMs: 30000,
    priority: 1,
  },
  COLD: {
    name: 'cold',
    purpose: 'Ingestion, analytics, batch processing',
    resourcePct: fib(7),   // 13%
    maxConcurrency: fib(6), // 8
    timeoutMs: 120000,
    priority: 2,
  },
  RESERVE: {
    name: 'reserve',
    purpose: 'Burst capacity for overload conditions',
    resourcePct: fib(6),   // 8%
    maxConcurrency: fib(5), // 5
    timeoutMs: 60000,
    priority: 3,
  },
  GOVERNANCE: {
    name: 'governance',
    purpose: 'Health checks, auditing, compliance',
    resourcePct: fib(5),   // 5%
    maxConcurrency: fib(4), // 3
    timeoutMs: 10000,
    priority: 4,
  },
});

/**
 * Assign a task to the appropriate pool based on priority and type.
 * @param {object} task
 * @param {string} task.type - 'user-facing' | 'background' | 'batch' | 'burst' | 'governance'
 * @param {number} [task.urgency=0.5] - 0–1 urgency score
 * @returns {string} Pool name
 */
function assignPool(task) {
  const urgency = task.urgency || 0.5;
  switch (task.type) {
    case 'user-facing': return 'HOT';
    case 'governance':  return 'GOVERNANCE';
    case 'burst':       return 'RESERVE';
    case 'batch':       return 'COLD';
    case 'background':
      return urgency >= CSL_THRESHOLDS.MEDIUM ? 'WARM' : 'COLD';
    default:
      return urgency >= CSL_THRESHOLDS.HIGH ? 'HOT' : 'WARM';
  }
}

// ─── UI Aesthetic Constants ──────────────────────────────────────────────────

const UI = Object.freeze({
  // Typography scale: φ-based
  TYPE_SCALE: {
    xs:    Math.round(16 / PHI / PHI),  // ≈ 6
    sm:    Math.round(16 / PHI),        // ≈ 10
    base:  16,
    lg:    Math.round(16 * PHI),        // ≈ 26
    xl:    Math.round(16 * PHI * PHI),  // ≈ 42
    '2xl': Math.round(16 * PHI * PHI * PHI), // ≈ 68
  },

  // Fibonacci spacing (px)
  SPACING: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89],

  // Layout ratios
  LAYOUT: {
    primaryWidth:   `${(PSI * 100).toFixed(2)}%`,      // ≈ 61.80%
    secondaryWidth: `${((1 - PSI) * 100).toFixed(2)}%`, // ≈ 38.20%
    goldenSection:  PSI,
  },

  // Color harmony: golden angle ≈ 137.508° for complementary hues
  GOLDEN_ANGLE: 360 / (PHI * PHI), // ≈ 137.508°

  // Brand colors
  COLORS: {
    primary:    '#6C63FF', // Heady Purple
    secondary:  '#FF6584', // Accent Pink
    success:    '#00C9A7', // Sacred Green
    warning:    '#FFB800', // Gold
    danger:     '#FF4757', // Alert Red
    background: '#0F0E17', // Deep Space
    surface:    '#1A1928', // Card Surface
    text:       '#FFFFFE', // Pure White
    muted:      '#94A1B2', // Muted
  },

  // Animation timing (phi-based easing)
  TIMING: {
    instant:  fib(4) * 10,  // 30ms
    fast:     fib(5) * 10,  // 50ms
    normal:   fib(7) * 10,  // 130ms
    slow:     fib(8) * 10,  // 210ms
    glacial:  fib(9) * 10,  // 340ms
  },
});

// ─── Bee Worker Limits ───────────────────────────────────────────────────────

const BEE_LIMITS = Object.freeze({
  maxConcurrentBees:  fib(8),  // 21
  maxQueueDepth:      fib(13), // 233
  beeTimeoutMs:       fib(9) * 1000, // 34 seconds
  maxRetries:         fib(5),  // 5
  healthCheckIntervalMs: fib(7) * 1000, // 13 seconds
  registryCapacity:   fib(10), // 55 registered bee types
});

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Topology
  NODE_RINGS, ALL_NODES, nodeRing, nodeDistance,

  // Coherence
  COHERENCE_THRESHOLDS, coherenceScore, systemCoherence,

  // Pool scheduling
  POOL_CONFIG, assignPool, poolAllocation,

  // UI aesthetics
  UI,

  // Bee limits
  BEE_LIMITS,
};
```

---

### `tests/patent/test-csl-gates.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Test Suite: HS-058 Continuous Semantic Logic Gates ──────────────────────
 *
 * Patent Docket: HS-058
 * Tests every claim of the CSL gates implementation.
 * Uses no external dependencies — pure Node.js assert.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const {
    PHI,
    dot_product,
    norm,
    normalize,
    cosine_similarity,
    soft_gate,
    resonance_gate,
    multi_resonance,
    superposition_gate,
    weighted_superposition,
    consensus_superposition,
    orthogonal_gate,
    batch_orthogonal,
    getStats,
    resetStats,
    CSLSystem,
    defaultCSL,
} = require('../src/core/csl-gates-enhanced');

// ─────────────────────────────────────────────────────────────────────────────
// Simple test runner
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
    }
}

function approx(a, b, tol = 1e-4) {
    return Math.abs(a - b) <= tol;
}

// Helper: make a unit vector of a specific dimension pointing in direction i
function unitVec(dim, i) {
    const v = new Float32Array(dim);
    v[i] = 1.0;
    return v;
}

// Helper: make a random 128-dim vector
function randVec128() {
    const v = new Float32Array(128);
    for (let i = 0; i < 128; i++) v[i] = Math.random() * 2 - 1;
    return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// VECTOR MATH PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Vector Math Primitives ===');

test('dot_product: [1,0]·[1,0] = 1', () => {
    assert.strictEqual(dot_product([1, 0], [1, 0]), 1);
});

test('dot_product: [1,0]·[0,1] = 0', () => {
    assert.strictEqual(dot_product([1, 0], [0, 1]), 0);
});

test('norm: [3,4] = 5', () => {
    assert.ok(approx(norm([3, 4]), 5));
});

test('normalize: result is unit vector', () => {
    const v = normalize([3, 4]);
    assert.ok(approx(norm(v), 1.0));
});

test('cosine_similarity: identical vectors = 1', () => {
    const v = [1, 2, 3, 4];
    assert.ok(approx(cosine_similarity(v, v), 1.0));
});

test('cosine_similarity: orthogonal vectors = 0', () => {
    assert.ok(approx(cosine_similarity([1, 0], [0, 1]), 0.0));
});

test('cosine_similarity: opposite vectors = -1', () => {
    assert.ok(approx(cosine_similarity([1, 0], [-1, 0]), -1.0));
});

test('cosine_similarity: empty vectors return 0', () => {
    assert.strictEqual(cosine_similarity([], []), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 1: Resonance Gate
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 1: Resonance Gate ===');

test('Claim 1: returns structured result with score and activation', () => {
    const a = randVec128();
    const b = randVec128();
    const result = resonance_gate(a, b);
    assert.ok('score'      in result, 'missing score');
    assert.ok('activation' in result, 'missing activation');
    assert.ok('open'       in result, 'missing open');
});

test('Claim 1(a): accepts N=128 dimensional vectors', () => {
    const a = randVec128();
    const b = randVec128();
    assert.doesNotThrow(() => resonance_gate(a, b));
});

test('Claim 1(b): score is cosine similarity in [-1, 1]', () => {
    const a = randVec128();
    const b = randVec128();
    const { score } = resonance_gate(a, b);
    assert.ok(score >= -1 && score <= 1, `score ${score} out of range`);
});

test('Claim 1(c): activation is sigmoid output in [0, 1]', () => {
    const a = randVec128();
    const b = randVec128();
    const { activation } = resonance_gate(a, b);
    assert.ok(activation >= 0 && activation <= 1, `activation ${activation} out of range`);
});

test('Claim 1(d): identical vectors → score ≈ 1, open = true', () => {
    const v = randVec128();
    const { score, open } = resonance_gate(v, v, 0.5);
    assert.ok(approx(score, 1.0, 1e-4));
    assert.strictEqual(open, true);
});

test('Claim 1: throws on missing vector', () => {
    assert.throws(() => resonance_gate(null, [1, 0]));
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 2: Superposition Gate
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 2: Superposition Gate ===');

test('Claim 2: result is a unit vector', () => {
    const a = randVec128();
    const b = randVec128();
    const result = superposition_gate(a, b);
    assert.ok(approx(norm(result), 1.0), `norm ${norm(result)} ≠ 1`);
});

test('Claim 2(b): fusing a vector with itself gives the same direction', () => {
    const v = normalize([1, 2, 3, 4]);
    const result = superposition_gate(v, v);
    // normalize(v + v) = normalize(2v) = v
    for (let i = 0; i < v.length; i++) {
        assert.ok(approx(result[i], v[i], 1e-5), `component ${i} mismatch`);
    }
});

test('Claim 2(d): returns a new hybrid semantic concept (Float32Array)', () => {
    const a = randVec128();
    const b = randVec128();
    const result = superposition_gate(a, b);
    assert.ok(result instanceof Float32Array);
    assert.strictEqual(result.length, 128);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 3: Orthogonal Gate
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 3: Orthogonal Gate ===');

test('Claim 3: result is unit vector', () => {
    const t = randVec128();
    const r = randVec128();
    const result = orthogonal_gate(t, r);
    assert.ok(approx(norm(result), 1.0), `norm ${norm(result)} ≠ 1`);
});

test('Claim 3(b): rejection vector is removed (dot product ≈ 0)', () => {
    const target = new Float32Array([1, 1, 0, 0]);
    const reject = new Float32Array([1, 0, 0, 0]);
    const result = orthogonal_gate(target, reject);
    const dotWithReject = dot_product(result, reject);
    assert.ok(Math.abs(dotWithReject) < 1e-5, `dot with reject = ${dotWithReject}`);
});

test('Claim 3(c): result normalized to unit vector', () => {
    const t = randVec128();
    const r = randVec128();
    const result = orthogonal_gate(t, r);
    assert.ok(approx(norm(result), 1.0, 1e-5));
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 4: Multi-Resonance
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 4: Multi-Resonance ===');

test('Claim 4: returns sorted array of results', () => {
    const target = randVec128();
    const candidates = [randVec128(), randVec128(), randVec128()];
    const results = multi_resonance(target, candidates);
    assert.strictEqual(results.length, 3);
    // Should be sorted descending by score
    for (let i = 0; i < results.length - 1; i++) {
        assert.ok(results[i].score >= results[i + 1].score,
            `results not sorted at ${i}: ${results[i].score} < ${results[i + 1].score}`);
    }
});

test('Claim 4: includes index, score, activation, open fields', () => {
    const target = randVec128();
    const candidates = [randVec128()];
    const [r] = multi_resonance(target, candidates);
    assert.ok('index'      in r);
    assert.ok('score'      in r);
    assert.ok('activation' in r);
    assert.ok('open'       in r);
});

test('Claim 4: identical target in candidates gets score ≈ 1', () => {
    const v = randVec128();
    const candidates = [randVec128(), v, randVec128()];
    const results = multi_resonance(v, candidates);
    // The identical vector should be at the top after sorting
    assert.ok(approx(results[0].score, 1.0, 1e-4));
});

test('Claim 4: empty candidates returns empty array', () => {
    const results = multi_resonance(randVec128(), []);
    assert.deepStrictEqual(results, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 5: Weighted Superposition
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 5: Weighted Superposition ===');

test('Claim 5: alpha=1.0 returns direction of vec_a', () => {
    const a = normalize([1, 2, 3, 4]);
    const b = normalize([5, 6, 7, 8]);
    const result = weighted_superposition(a, b, 1.0);
    // normalize(1.0*a + 0.0*b) = a
    for (let i = 0; i < a.length; i++) {
        assert.ok(approx(result[i], a[i], 1e-5));
    }
});

test('Claim 5: alpha=0.0 returns direction of vec_b', () => {
    const a = normalize([1, 2, 3, 4]);
    const b = normalize([5, 6, 7, 8]);
    const result = weighted_superposition(a, b, 0.0);
    for (let i = 0; i < b.length; i++) {
        assert.ok(approx(result[i], b[i], 1e-5));
    }
});

test('Claim 5: result is always unit vector', () => {
    const a = randVec128();
    const b = randVec128();
    const result = weighted_superposition(a, b, 0.3);
    assert.ok(approx(norm(result), 1.0, 1e-5));
});

test('Claim 5: alpha out of range throws', () => {
    assert.throws(() => weighted_superposition([1], [1], 1.5));
    assert.throws(() => weighted_superposition([1], [1], -0.1));
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 6: Consensus Superposition
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 6: Consensus Superposition ===');

test('Claim 6: returns unit vector for N vectors', () => {
    const vectors = [randVec128(), randVec128(), randVec128(), randVec128()];
    const result  = consensus_superposition(vectors);
    assert.ok(approx(norm(result), 1.0, 1e-5));
});

test('Claim 6: fusing a single vector returns same direction', () => {
    const v = normalize([1, 2, 3, 4]);
    const result = consensus_superposition([v]);
    for (let i = 0; i < v.length; i++) {
        assert.ok(approx(result[i], v[i], 1e-5));
    }
});

test('Claim 6: empty input returns empty Float32Array', () => {
    const result = consensus_superposition([]);
    assert.strictEqual(result.length, 0);
});

test('Claim 6: fusing 5 random 128-dim vectors produces unit vector', () => {
    const vectors = Array.from({ length: 5 }, () => randVec128());
    const result  = consensus_superposition(vectors);
    assert.ok(approx(norm(result), 1.0, 1e-5));
    assert.strictEqual(result.length, 128);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 7: Batch Orthogonal
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 7: Batch Orthogonal ===');

test('Claim 7: result is unit vector', () => {
    const t = randVec128();
    const rejects = [randVec128(), randVec128()];
    const result = batch_orthogonal(t, rejects);
    assert.ok(approx(norm(result), 1.0, 1e-5));
});

test('Claim 7: removes influence of both rejection vectors', () => {
    const target  = new Float32Array([1, 1, 1, 0]);
    const r1      = new Float32Array([1, 0, 0, 0]);
    const r2      = new Float32Array([0, 1, 0, 0]);
    const result  = batch_orthogonal(target, [r1, r2]);
    // After removing x and y components, only z component should remain
    assert.ok(Math.abs(dot_product(result, r1)) < 1e-5);
    assert.ok(Math.abs(dot_product(result, r2)) < 1e-5);
});

test('Claim 7: single rejection matches orthogonal_gate', () => {
    const t = randVec128();
    const r = randVec128();
    const single = orthogonal_gate(t, r);
    const batch  = batch_orthogonal(t, [r]);
    for (let i = 0; i < single.length; i++) {
        assert.ok(approx(single[i], batch[i], 1e-5));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 8: Configurable Sigmoid Steepness and Threshold
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 8: Configurable Sigmoid ===');

test('Claim 8: high steepness produces sharp transition (Δactivation > low steepness)', () => {
    const score = 0.6;
    const threshold = 0.5;
    const highSteepness = soft_gate(score, threshold, 100);
    const lowSteepness  = soft_gate(score, threshold, 1);
    assert.ok(highSteepness > lowSteepness,
        `high=${highSteepness} should be > low=${lowSteepness}`);
});

test('Claim 8: score at threshold returns 0.5 regardless of steepness', () => {
    assert.ok(approx(soft_gate(0.5, 0.5, 1),   0.5, 1e-6));
    assert.ok(approx(soft_gate(0.5, 0.5, 20),  0.5, 1e-6));
    assert.ok(approx(soft_gate(0.5, 0.5, 100), 0.5, 1e-6));
});

test('Claim 8: activation always in [0, 1]', () => {
    for (const score of [-1, -0.5, 0, 0.5, 1]) {
        const act = soft_gate(score, 0.5, 20);
        assert.ok(act >= 0 && act <= 1, `activation ${act} out of range`);
    }
});

test('Claim 8: resonance_gate accepts threshold and steepness params', () => {
    const a = randVec128();
    const b = randVec128();
    const r = resonance_gate(a, b, 0.3, 50);
    assert.ok('activation' in r);
    assert.strictEqual(r.threshold, 0.3);
    assert.strictEqual(r.steepness, 50);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 9: Statistics Module
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 9: Statistics Module ===');

test('Claim 9(d): getStats returns invocation counts', () => {
    resetStats();
    resonance_gate(randVec128(), randVec128());
    resonance_gate(randVec128(), randVec128());
    superposition_gate(randVec128(), randVec128());
    orthogonal_gate(randVec128(), randVec128());
    const stats = getStats();
    assert.ok(stats.resonance   >= 2, `resonance=${stats.resonance}`);
    assert.ok(stats.superposition >= 1);
    assert.ok(stats.orthogonal  >= 1);
    assert.ok(stats.totalCalls  >= 4);
});

test('Claim 9(d): getStats returns avgResonanceScore', () => {
    resetStats();
    const v = randVec128();
    resonance_gate(v, v);  // score ≈ 1
    const stats = getStats();
    assert.ok(stats.avgResonanceScore > 0.99, `avgResonanceScore=${stats.avgResonanceScore}`);
});

test('Claim 9(d): resetStats clears all counters', () => {
    resonance_gate(randVec128(), randVec128());
    resetStats();
    const stats = getStats();
    assert.strictEqual(stats.resonance,   0);
    assert.strictEqual(stats.totalCalls,  0);
    assert.strictEqual(stats.avgResonanceScore, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 9: CSLSystem (OOP API)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 9: CSLSystem Class ===');

test('Claim 9: CSLSystem has all gate methods', () => {
    const csl = new CSLSystem();
    assert.strictEqual(typeof csl.resonance,            'function');
    assert.strictEqual(typeof csl.multiResonance,       'function');
    assert.strictEqual(typeof csl.superposition,        'function');
    assert.strictEqual(typeof csl.weightedSuperposition,'function');
    assert.strictEqual(typeof csl.consensusSuperposition,'function');
    assert.strictEqual(typeof csl.orthogonal,           'function');
    assert.strictEqual(typeof csl.batchOrthogonal,      'function');
    assert.strictEqual(typeof csl.softGate,             'function');
    assert.strictEqual(typeof csl.getStats,             'function');
});

test('Claim 9: CSLSystem.resonance works end-to-end', () => {
    const csl = new CSLSystem({ threshold: 0.5, steepness: 20 });
    const v = randVec128();
    const r = csl.resonance(v, v);
    assert.ok(approx(r.score, 1.0, 1e-4));
    assert.strictEqual(r.open, true);
});

test('Claim 9: defaultCSL instance is exported', () => {
    assert.ok(defaultCSL instanceof CSLSystem);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM 10: Replacement Integration Points
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 10: Replacement Integration Points ===');

test('Claim 10: vectorMemoryDensityGate returns isDuplicate + score', () => {
    const csl = new CSLSystem();
    const v = randVec128();
    const result = csl.vectorMemoryDensityGate(v, v, 0.92);
    assert.ok('isDuplicate' in result);
    assert.ok('score'       in result);
    assert.ok('activation'  in result);
    assert.strictEqual(result.isDuplicate, true);  // identical = duplicate
});

test('Claim 10: hybridSearchScore returns sorted scored docs', () => {
    const csl = new CSLSystem();
    const query = randVec128();
    const docs  = [randVec128(), randVec128(), randVec128()];
    const results = csl.hybridSearchScore(query, docs);
    assert.strictEqual(results.length, 3);
    for (let i = 0; i < results.length - 1; i++) {
        assert.ok(results[i].score >= results[i + 1].score);
    }
});

test('Claim 10: hallucinationDetectionGate works with identical vectors', () => {
    const csl = new CSLSystem();
    const v = randVec128();
    const result = csl.hallucinationDetectionGate(v, v, 0.7);
    assert.ok('hallucinated' in result);
    assert.strictEqual(result.hallucinated, false);  // identical = not hallucinated
});

// ─────────────────────────────────────────────────────────────────────────────
// PHI CONSTANT
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== PHI Constant ===');

test('PHI = 1.6180339887', () => {
    assert.strictEqual(PHI, 1.6180339887);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────`);
console.log(`HS-058 CSL Gates: ${passed} passed, ${failed} failed`);
console.log(`─────────────────────────────────────────`);

if (failed > 0) process.exit(1);
```

---

### `tests/semantic-routing/test-migrate-to-csl.js`

```javascript
'use strict';

/**
 * test-migrate-to-csl.js
 *
 * Tests for MigrateToCSL using real module + temp file infrastructure.
 *
 * Run: node tests/semantic-routing/test-migrate-to-csl.js
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

// ── Mock logger ────────────────────────────────────────────────────────────

const mockLogger = { debug() {}, info() {}, warn() {}, error() {} };
const loggerPath = require.resolve('../../src/utils/logger');
require.cache[loggerPath] = {
    id: loggerPath, filename: loggerPath, loaded: true, exports: mockLogger,
};

const { MigrateToCSL }       = require('../../scripts/migrate-to-csl');
const { AuditDiscreteLogic } = require('../../scripts/audit-discrete-logic');

// ── Temp file helpers ──────────────────────────────────────────────────────

const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'hdy-migrate-test-'));
const backupDir = path.join(os.tmpdir(), 'hdy-migrate-backups-' + Date.now());
const created   = [];

function writeTmpFile(name, content) {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, content, 'utf8');
    created.push(p);
    return p;
}

function cleanup() {
    for (const f of created) { try { fs.unlinkSync(f); } catch (_) {} }
    try { fs.rmdirSync(tmpDir); } catch (_) {}
    // Clean backups
    try {
        if (fs.existsSync(backupDir)) {
            fs.readdirSync(backupDir).forEach(f => {
                try { fs.unlinkSync(path.join(backupDir, f)); } catch (_) {}
            });
            fs.rmdirSync(backupDir);
        }
    } catch (_) {}
}

// ── Test harness ───────────────────────────────────────────────────────────

let passed = 0, failed = 0;

async function runTest(name, fn) {
    try {
        await fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        if (process.env.VERBOSE) console.error(err.stack);
        failed++;
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

async function runTests() {
    console.log('\n[test-migrate-to-csl]');

    // ── test_constructor ─────────────────────────────────────────────────
    await runTest('test_constructor', () => {
        const m1 = new MigrateToCSL();
        assert.strictEqual(m1.dryRun, true, 'default dryRun=true');
        assert.ok(m1.backupDir.includes('.csl-backups'), 'default backupDir set');

        const m2 = new MigrateToCSL({ dryRun: false, backupDir: '/tmp/test-backups', reportPath: '/tmp/report.json' });
        assert.strictEqual(m2.dryRun,      false,            'dryRun=false stored');
        assert.strictEqual(m2.backupDir,   '/tmp/test-backups', 'backupDir stored');
        assert.strictEqual(m2.reportPath,  '/tmp/report.json',   'reportPath stored');
    });

    // ── test_type_a_migration_if_else ─────────────────────────────────────
    await runTest('test_type_a_migration_if_else', () => {
        const src = `'use strict';
function route(cmd) {
  if (cmd === 'deploy') {
    return doDeployment();
  }
}
`;
        const file  = writeTmpFile('type-a-if.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);
        const typeA  = findings.filter(f => f.type === 'TYPE_A');
        assert.ok(typeA.length > 0, `No TYPE_A findings in test file (got ${findings.length} total)`);

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const result   = migrator.migrateFile(file, typeA);

        assert.ok(result.hasOwnProperty('migratedCode'), 'has migratedCode');
        assert.ok(result.hasOwnProperty('diff'),         'has diff');
        assert.ok(result.hasOwnProperty('changes'),      'has changes');
        assert.ok(result.dryRun, 'dryRun=true in result');

        // Should contain CSL migration comments
        assert.ok(result.migratedCode.includes('CSL-MIGRATED'), 'migratedCode has CSL-MIGRATED marker');
        assert.ok(result.migratedCode.includes('semanticRouter') || result.migratedCode.includes('SemanticRouter'),
            'migratedCode references semanticRouter');
    });

    // ── test_type_a_migration_switch ──────────────────────────────────────
    await runTest('test_type_a_migration_switch', () => {
        const src = `'use strict';
function handleAction(action) {
  switch(action) {
    case 'start': return start();
    case 'stop':  return stop();
    default:      return noop();
  }
}
`;
        const file  = writeTmpFile('type-a-switch.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file).filter(f => f.type === 'TYPE_A');
        assert.ok(findings.length > 0, 'TYPE_A findings from switch');

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const result   = migrator.migrateFile(file, findings);

        assert.ok(result.migratedCode.includes('CSL-MIGRATED'),
            'switch migration has CSL-MIGRATED marker');
        assert.ok(result.changes.length > 0, 'changes recorded');
        for (const change of result.changes) {
            assert.strictEqual(change.type, 'TYPE_A', 'change type is TYPE_A');
            assert.ok(change.hasOwnProperty('original'),    'change has original');
            assert.ok(change.hasOwnProperty('replacement'), 'change has replacement');
        }
    });

    // ── test_type_b_migration_threshold ──────────────────────────────────
    await runTest('test_type_b_migration_threshold', () => {
        const src = `'use strict';
function applyGate(score) {
  if (score > 0.5) {
    return activateFeature();
  }
  return passThrough();
}
`;
        const file  = writeTmpFile('type-b-thresh.js', src);
        const audit = new AuditDiscreteLogic();
        const findings = audit.scanFile(file).filter(f => f.type === 'TYPE_B');
        assert.ok(findings.length > 0, 'TYPE_B findings');

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const result   = migrator.migrateFile(file, findings);

        assert.ok(result.migratedCode.includes('CSL-MIGRATED'),
            'TYPE_B migration has CSL-MIGRATED marker');
        assert.ok(result.migratedCode.includes('soft_gate') || result.migratedCode.includes('PhiScale'),
            'migrated code references soft_gate or PhiScale');
        assert.ok(result.migratedCode.includes('PHI_INVERSE'),
            'migrated code references PHI_INVERSE');
    });

    // ── test_generate_diff ────────────────────────────────────────────────
    await runTest('test_generate_diff', () => {
        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const original = `'use strict';\nif (cmd === 'start') { begin(); }\n`;
        const migrated = `'use strict';\n// [CSL-MIGRATED] replaced\nconst _result = semanticRouter.route(cmd);\n`;
        const diff = migrator.generateDiff(original, migrated, 'test.js');

        assert.ok(typeof diff === 'string' || diff === null, 'diff is string or null');
        if (diff !== null) {
            assert.ok(diff.includes('--- a/test.js'), 'diff has --- header');
            assert.ok(diff.includes('+++ b/test.js'), 'diff has +++ header');
            // Should have removed and added lines
            assert.ok(diff.includes('-') || diff.includes('+'), 'diff has change indicators');
        }
    });

    // ── test_migration_preserves_non_targets ──────────────────────────────
    await runTest('test_migration_preserves_non_targets', () => {
        const src = `'use strict';
function process(x, err) {
  if (!x) { throw new Error('no x'); }
  if (err) { return handleError(err); }
  if (x instanceof Array) { return processArray(x); }
  if (typeof x === 'string') { return processString(x); }
}
`;
        const file    = writeTmpFile('non-targets.js', src);
        const audit   = new AuditDiscreteLogic();
        const findings = audit.scanFile(file);

        // Only TYPE_C and TYPE_D — should not be modified
        const typeCD = findings.filter(f => f.type === 'TYPE_C' || f.type === 'TYPE_D');
        const typeAB = findings.filter(f => f.type === 'TYPE_A' || f.type === 'TYPE_B');
        assert.ok(typeCD.length > 0, 'Has TYPE_C or TYPE_D findings');

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const result   = migrator.migrateFile(file, typeCD);

        // No changes should be made for TYPE_C/TYPE_D
        assert.strictEqual(result.changes.length, 0,
            `TYPE_C/TYPE_D should not generate changes, got ${result.changes.length}`);
        assert.strictEqual(result.migratedCode, src, 'source code unchanged for TYPE_C/TYPE_D only');
    });

    // ── test_migration_plan_order ─────────────────────────────────────────
    await runTest('test_migration_plan_order', () => {
        // Create two files: one with lots of TYPE_A, one with only TYPE_B
        const fileA = writeTmpFile('many-type-a.js', `
'use strict';
if (cmd === 'deploy')   { deploy(); }
if (cmd === 'rollback') { rollback(); }
if (cmd === 'build')    { build(); }
if (cmd === 'test')     { runTest(); }
`);
        const fileB = writeTmpFile('only-type-b.js', `
'use strict';
if (score > 0.5)  { pass(); }
if (score > 0.9)  { excellent(); }
`);

        const audit      = new AuditDiscreteLogic();
        const findingsA  = audit.scanFile(fileA);
        const findingsB  = audit.scanFile(fileB);
        const allFindings = [...findingsA, ...findingsB];

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        const auditReport = { findings: allFindings };
        const plan = migrator.generateMigrationPlan(auditReport);

        assert.ok(Array.isArray(plan), 'plan is array');
        assert.ok(plan.length >= 2,    'plan has at least 2 files');

        // Files with TYPE_A (priority × 3) should come before TYPE_B-only (priority × 2)
        const firstFile = path.basename(plan[0].file);
        const aTypeCount = plan[0].typeA || 0;
        const bTypeCount = plan[0].typeB || 0;
        // Highest priority file should have TYPE_A findings
        assert.ok(plan[0].priority >= plan[plan.length - 1].priority,
            `plan is sorted descending by priority (${plan[0].priority} >= ${plan[plan.length-1].priority})`);
    });

    // ── test_track_progress ───────────────────────────────────────────────
    await runTest('test_track_progress', () => {
        const file1 = writeTmpFile('progress-a.js', `'use strict'; if (cmd === 'go') { go(); }`);
        const file2 = writeTmpFile('progress-b.js', `'use strict'; if (score > 1) { ok(); }`);

        const audit       = new AuditDiscreteLogic();
        const findings1   = audit.scanFile(file1);
        const findings2   = audit.scanFile(file2);
        const auditReport = { findings: [...findings1, ...findings2] };

        const migrator = new MigrateToCSL({ dryRun: true, backupDir });

        // No files completed yet
        const progress0 = migrator.trackProgress(auditReport, []);
        assert.ok(progress0.total >= 1,         'total > 0');
        assert.strictEqual(progress0.migrated,  0, 'migrated=0 initially');
        assert.strictEqual(progress0.remaining, progress0.total, 'remaining=total initially');

        // One file completed
        const progress1 = migrator.trackProgress(auditReport, [file1]);
        assert.strictEqual(progress1.migrated, 1, 'migrated=1 after completing file1');
        assert.ok(progress1.remaining < progress0.remaining, 'remaining decreased');
        assert.ok(progress1.percentComplete !== '0.0%', 'percentComplete updated');

        // All files completed
        const progress2 = migrator.trackProgress(auditReport, [file1, file2]);
        assert.strictEqual(progress2.migrated, 2, 'migrated=2 when both done');
        assert.strictEqual(progress2.remaining, 0, 'remaining=0 when all done');
        assert.strictEqual(progress2.percentComplete, '100.0%', 'percentComplete=100% when all done');
    });

    // ── test_dry_run ──────────────────────────────────────────────────────
    await runTest('test_dry_run', () => {
        const src = `'use strict';\nif (cmd === 'deploy') { deploy(); }\n`;
        const file = writeTmpFile('dry-run-test.js', src);

        const audit      = new AuditDiscreteLogic();
        const findings   = audit.scanFile(file).filter(f => f.type === 'TYPE_A');
        assert.ok(findings.length > 0, 'Has TYPE_A findings');

        // dryRun=true (default)
        const migrator = new MigrateToCSL({ dryRun: true, backupDir });
        migrator.migrateFile(file, findings);

        // File should be unchanged
        const afterContent = fs.readFileSync(file, 'utf8');
        assert.strictEqual(afterContent, src, 'dry run does not modify file on disk');
    });

    // ── test_rollback ─────────────────────────────────────────────────────
    await runTest('test_rollback', () => {
        const src = `'use strict';\nif (action === 'start') { start(); }\n`;
        const file = writeTmpFile('rollback-test.js', src);

        // Apply real migration (dryRun=false)
        const audit    = new AuditDiscreteLogic();
        const findings = audit.scanFile(file).filter(f => f.type === 'TYPE_A');
        assert.ok(findings.length > 0, 'Has TYPE_A findings for rollback test');

        const migrator = new MigrateToCSL({ dryRun: false, backupDir });
        migrator.migrateFile(file, findings);

        // File should now be changed
        const changedContent = fs.readFileSync(file, 'utf8');
        // Rollback
        const rolled = migrator.rollback(file);
        assert.ok(rolled, 'rollback returns true');

        // File should be restored
        const restoredContent = fs.readFileSync(file, 'utf8');
        assert.strictEqual(restoredContent, src, 'file restored to original after rollback');
    });
}

runTests()
    .then(() => {
        cleanup();
        console.log(`\nTests: ${passed} passed, ${failed} failed\n`);
        process.exitCode = failed > 0 ? 1 : 0;
    })
    .catch(err => {
        cleanup();
        console.error(err);
        process.exitCode = 1;
    });
```

---
