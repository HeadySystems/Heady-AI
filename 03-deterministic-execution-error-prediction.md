# Heady™ Deterministic Prompt Execution + CSL Error Prediction System

## Foundation
All changes are based on the HeadyMe repos and Heady project data. The actual source code for every referenced file is provided below.

## Objective
Build a fully deterministic prompt execution system with CSL-gated error prediction. Every prompt execution should be:
1. **Reproducible** — same input → same output (SHA-256 hash match)
2. **Predictable** — CSL confidence gate predicts errors before execution
3. **Self-healing** — when confidence drops below φ⁻², system auto-reconfigures
4. **Auditable** — every execution logged with input/output hash, confidence, decision, drift score

## Specific Deliverables — Build ALL Files

### 1. Deterministic Prompt Executor
- Template interpolation with variable validation
- SHA-256 input hashing for cache key generation
- Replay cache — serve cached output for identical inputs
- LLM params locked: temperature=0, seed=42, top_p=1, frequency_penalty=0, presence_penalty=0
- Event emission: `execute`, `cache_hit`, `halt`, `system:reconfigure`

### 2. CSL Confidence Gate
- Pre-flight check before every prompt execution
- Confidence scoring based on: variable completeness, domain alignment, prompt coherence, input entropy
- Phi-scaled tiers: EXECUTE > φ⁻¹, CAUTIOUS ∈ [φ⁻², φ⁻¹), HALT < φ⁻²
- Drift detection: rolling window of output hashes, uniqueness ratio > φ⁻² → drift alert
- Reconfiguration plan generation when halting

### 3. Continuous Action Analysis
- Record every action (task/user/environmental) with 16-dim hash vector
- Rolling window pattern detection using domain-grouped actions
- Learn optimal LLM params per domain from execution history
- Auto-reconfigure: tighten params, increase MC iterations, enable replay cache

### 4. Monte Carlo Determinism Boundary
- Run N iterations of each prompt with deterministic seeds
- Measure output variance → find where determinism breaks
- Express boundary as: D(n,v,d,c) where n=iterations, v=variable completeness, d=domain alignment, c=coherence
- All thresholds from φ

### 5. Test Suite (Jest)
- Template determinism: same input → same hash
- CSL gate thresholds: EXECUTE/CAUTIOUS/HALT decisions
- Drift detection: diverse outputs → alert
- Halt + reconfigure flow
- Replay cache hit/miss
- Full pipeline: gate → execute → drift → audit
- Edge cases: empty input, missing variables, unknown domain

## Constraints
- All constants from φ = 1.6180339887
- SHA-256 for all hashing
- Node.js: crypto, events modules only
- Temperature=0, seed=42 for deterministic mode

---

## SOURCE FILES — COMPLETE HEADY CODEBASE CONTEXT


### `src/prompts/deterministic-prompt-executor.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Deterministic Prompt Executor
 *
 * Wraps PromptManager with deterministic execution guarantees:
 *   - Fixed LLM params (temperature: 0, top_p: 1, deterministic seed)
 *   - Input hashing (SHA-256) for cache keys
 *   - Output validation via CSL cosine similarity
 *   - Replay guarantee: same inputHash → same cached output
 *   - Full execution audit log
 *
 * PHI = 1.6180339887
 *
 * @module deterministic-prompt-executor
 */

'use strict';

const crypto = require('crypto');
const CSLConfidenceGate = require('./csl-confidence-gate');

// Lazy-load PromptManager (template literals evaluate at require time)
let _PromptManager = null;
function getPromptManager() {
    if (!_PromptManager) {
        try {
            _PromptManager = require('./deterministic-prompt-manager').PromptManager;
        } catch (err) {
            // Fallback: minimal stub for environments where templates can't load
            _PromptManager = class StubPromptManager {
                interpolate(id, vars) {
                    return `[PROMPT:${id}] ` + Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(', ');
                }
                getPrompt(id) { return { id, variables: [], template: '', tags: [] }; }
                listPrompts() { return []; }
                composePrompts(ids, vars) { return { composed: ids.join('\n'), sections: [], ids }; }
            };
        }
    }
    return _PromptManager;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;
const PSI = 1 / PHI;                    // ≈ 0.618
const PSI_SQ = PSI * PSI;                  // ≈ 0.382

/** Replay threshold — cached output returned if CSL score exceeds this */
const REPLAY_THRESHOLD = PSI;              // φ⁻¹ ≈ 0.618

/** Maximum audit log entries before rotation */
const MAX_AUDIT_LOG = Math.round(PHI ** 8); // ≈ 47

/** Deterministic LLM parameters — enforced on every call */
const DETERMINISTIC_LLM_PARAMS = Object.freeze({
    temperature: 0,
    top_p: 1,
    seed: 42,
    max_tokens: 4096,
    presence_penalty: 0,
    frequency_penalty: 0,
});

// ─── DeterministicPromptExecutor ──────────────────────────────────────────────

class DeterministicPromptExecutor {
    /**
     * @param {Object} [options]
     * @param {PromptManager} [options.promptManager] — existing PromptManager instance
     * @param {CSLConfidenceGate} [options.confidenceGate] — existing gate instance
     * @param {number} [options.replayThreshold] — cosine threshold for cache replay
     * @param {Object} [options.llmParams] — override deterministic LLM params
     */
    constructor(options = {}) {
        const PM = getPromptManager();
        this.promptManager = options.promptManager || new PM();
        this.confidenceGate = options.confidenceGate || new CSLConfidenceGate();
        this.replayThreshold = options.replayThreshold || REPLAY_THRESHOLD;
        this.llmParams = { ...DETERMINISTIC_LLM_PARAMS, ...(options.llmParams || {}) };

        /** @type {Map<string, { output: string, cslScore: number, timestamp: number }>} */
        this._cache = new Map();

        /** @type {Array<Object>} */
        this._auditLog = [];

        /** Runtime stats */
        this._stats = {
            totalExecutions: 0,
            cacheHits: 0,
            cacheMisses: 0,
            halts: 0,
            cautious: 0,
            driftAlerts: 0,
            reconfigures: 0,
        };

        /** Event listeners */
        this._listeners = new Map();
    }

    // ─── Core Execution ─────────────────────────────────────────────────────────

    /**
     * Execute a prompt deterministically.
     *
     * Pipeline:
     *   1. Interpolate template with variables
     *   2. Compute inputHash (SHA-256 of promptId + sorted vars)
     *   3. Check cache — return cached output if CSL score > replayThreshold
     *   4. Run CSL pre-flight confidence check
     *   5. If HALT → stop execution, emit reconfigure event
     *   6. If EXECUTE/CAUTIOUS → interpolate + return
     *   7. Log to audit trail
     *
     * @param {string} promptId — prompt identifier (e.g. 'code-001')
     * @param {Object} vars — variable map for interpolation
     * @param {Object} [opts]
     * @param {boolean} [opts.bypassCache=false] — skip cache lookup
     * @param {boolean} [opts.strict=true] — enforce variable completeness
     * @returns {{ output: string, confidence: number, inputHash: string,
     *             cslScore: number, halted: boolean, decision: string,
     *             llmParams: Object, cached: boolean }}
     */
    execute(promptId, vars = {}, opts = {}) {
        const { bypassCache = false, strict = true } = opts;
        this._stats.totalExecutions++;

        // Step 1: Compute deterministic input hash
        const inputHash = this._computeHash(promptId, vars);

        // Step 2: Check cache (unless bypassed)
        if (!bypassCache && this._cache.has(inputHash)) {
            const cached = this._cache.get(inputHash);
            this._stats.cacheHits++;

            const result = {
                output: cached.output,
                confidence: 1.0, // cached = known-good
                inputHash,
                cslScore: cached.cslScore,
                halted: false,
                decision: 'CACHED',
                llmParams: this.llmParams,
                cached: true,
            };

            this._log('cache_hit', promptId, inputHash, result);
            return result;
        }

        this._stats.cacheMisses++;

        // Step 3: Interpolate the prompt deterministically
        let interpolated;
        try {
            interpolated = this.promptManager.interpolate(promptId, vars, { strict });
        } catch (err) {
            const haltResult = {
                output: null,
                confidence: 0,
                inputHash,
                cslScore: 0,
                halted: true,
                decision: 'HALT',
                reason: `Interpolation error: ${err.message}`,
                llmParams: this.llmParams,
                cached: false,
            };
            this._stats.halts++;
            this._log('interpolation_error', promptId, inputHash, haltResult);
            this._emit('halt', { promptId, inputHash, reason: haltResult.reason });
            this._emit('system:reconfigure', this.confidenceGate.reconfigure({
                promptId, inputHash, confidence: 0, reason: haltResult.reason,
            }));
            return haltResult;
        }

        // Step 4: CSL pre-flight confidence check
        const preCheck = this.confidenceGate.preFlightCheck(promptId, vars, interpolated);

        if (preCheck.decision === 'HALT') {
            this._stats.halts++;
            const haltResult = {
                output: null,
                confidence: preCheck.confidence,
                inputHash,
                cslScore: preCheck.confidence,
                halted: true,
                decision: 'HALT',
                reason: preCheck.reason,
                llmParams: this.llmParams,
                cached: false,
            };
            this._log('halt', promptId, inputHash, haltResult);
            this._emit('halt', { promptId, inputHash, confidence: preCheck.confidence, reason: preCheck.reason });
            this._emit('system:reconfigure', this.confidenceGate.reconfigure({
                promptId, inputHash, confidence: preCheck.confidence, reason: preCheck.reason,
            }));
            return haltResult;
        }

        if (preCheck.decision === 'CAUTIOUS') {
            this._stats.cautious++;
        }

        // Step 5: At template level, the output IS deterministic (same template + same vars = same string)
        const output = interpolated;
        const outputHash = this._hashString(output);

        // Step 6: Compute CSL score (self-consistency = 1.0 for deterministic template output)
        const cslScore = 1.0; // Template interpolation is perfectly deterministic

        // Step 7: Cache the result
        this._cache.set(inputHash, { output, cslScore, outputHash, timestamp: Date.now() });

        // Step 8: Track drift
        const driftResult = this.confidenceGate.trackDrift(outputHash);
        if (driftResult.drifting) {
            this._stats.driftAlerts++;
            this._emit('drift', { promptId, inputHash, driftScore: driftResult.driftScore });
        }

        const result = {
            output,
            confidence: preCheck.confidence,
            inputHash,
            cslScore,
            halted: false,
            decision: preCheck.decision,
            llmParams: this.llmParams,
            cached: false,
        };

        this._log('execute', promptId, inputHash, result);
        return result;
    }

    // ─── Replay ─────────────────────────────────────────────────────────────────

    /**
     * Replay a cached output by its input hash.
     * Returns null if not found or if CSL score below replay threshold.
     *
     * @param {string} inputHash
     * @returns {{ output: string, cslScore: number, timestamp: number } | null}
     */
    replay(inputHash) {
        const cached = this._cache.get(inputHash);
        if (!cached) return null;
        if (cached.cslScore < this.replayThreshold) return null;
        return { output: cached.output, cslScore: cached.cslScore, timestamp: cached.timestamp };
    }

    // ─── Audit ──────────────────────────────────────────────────────────────────

    /**
     * Get execution audit log.
     * @param {number} [limit=20]
     * @returns {Array<Object>}
     */
    getAuditLog(limit = 20) {
        return this._auditLog.slice(-limit);
    }

    /**
     * Get determinism report — stats on cache performance, halts, drift alerts.
     * @returns {Object}
     */
    getDeterminismReport() {
        const cacheSize = this._cache.size;
        const hitRate = this._stats.totalExecutions > 0
            ? (this._stats.cacheHits / this._stats.totalExecutions * 100).toFixed(1)
            : '0.0';

        return {
            totalExecutions: this._stats.totalExecutions,
            cacheHits: this._stats.cacheHits,
            cacheMisses: this._stats.cacheMisses,
            cacheHitRate: `${hitRate}%`,
            cacheSize,
            halts: this._stats.halts,
            cautious: this._stats.cautious,
            driftAlerts: this._stats.driftAlerts,
            reconfigures: this._stats.reconfigures,
            replayThreshold: this.replayThreshold,
            llmParams: this.llmParams,
            phi: PHI,
        };
    }

    // ─── Events ─────────────────────────────────────────────────────────────────

    /**
     * Register event listener.
     * @param {string} event — 'halt' | 'drift' | 'system:reconfigure'
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this._listeners.has(event)) this._listeners.set(event, []);
        this._listeners.get(event).push(callback);
    }

    // ─── Internal ───────────────────────────────────────────────────────────────

    /**
     * Compute SHA-256 hash of (promptId + sorted variables).
     * Deterministic: same inputs always produce the same hash.
     */
    _computeHash(promptId, vars) {
        const sortedKeys = Object.keys(vars).sort();
        const canonical = promptId + ':' + sortedKeys.map(k => `${k}=${vars[k]}`).join('|');
        return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
    }

    /**
     * Hash a string with SHA-256 (truncated to 16 chars).
     */
    _hashString(str) {
        return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
    }

    /**
     * Append to audit log with rotation.
     */
    _log(action, promptId, inputHash, result) {
        this._auditLog.push({
            action,
            promptId,
            inputHash,
            decision: result.decision,
            confidence: result.confidence,
            cslScore: result.cslScore,
            halted: result.halted,
            cached: result.cached,
            timestamp: Date.now(),
        });
        if (this._auditLog.length > MAX_AUDIT_LOG) {
            this._auditLog = this._auditLog.slice(-MAX_AUDIT_LOG);
        }
    }

    /**
     * Emit event to registered listeners.
     */
    _emit(event, data) {
        const listeners = this._listeners.get(event) || [];
        for (const cb of listeners) {
            try { cb(data); } catch (_) { /* fire-and-forget */ }
        }
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    DeterministicPromptExecutor,
    DETERMINISTIC_LLM_PARAMS,
    REPLAY_THRESHOLD,
    PHI,
    PSI,
    PSI_SQ,
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

### `src/analytics/continuous-action-analyzer.js`

```javascript
/**
 * Continuous Action Analyzer
 *
 * Tracks every task execution, user action, and environmental parameter
 * to learn deterministic patterns and enforce them.
 *
 * Features:
 *   - Rolling window of action vectors for drift/pattern detection
 *   - Phi-scaled thresholds trigger auto-reconfig when determinism degrades
 *   - Learns optimal LLM params from execution history
 *   - Emits action:learned / action:drift / action:reconfig events
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

const PHI = 1.6180339887;
const PSI = 1 / PHI;
const PSI_SQ = PSI * PSI;

const WINDOW_SIZE = 50;          // rolling window for pattern detection
const DRIFT_THRESHOLD = PSI_SQ;  // 0.382 — alert when uniqueness exceeds this
const LEARN_THRESHOLD = 10;      // min actions before learning kicks in

class ContinuousActionAnalyzer extends EventEmitter {

    constructor(opts = {}) {
        super();
        this._windowSize = opts.windowSize || WINDOW_SIZE;
        this._actions = [];            // rolling window of action records
        this._allActions = [];         // full history (capped at 10k)
        this._patterns = new Map();    // domain → learned pattern
        this._driftWindow = [];        // rolling output hash window
        this._stats = {
            totalActions: 0,
            learnedPatterns: 0,
            driftAlerts: 0,
            reconfigs: 0,
            avgConfidence: 0,
            avgLatency: 0,
        };
    }

    /**
     * Record a task execution action.
     * @param {Object} action - { taskId, domain, inputHash, outputHash, provider, model, latencyMs, confidence, simScore, battleWon, mcDeterminism }
     */
    record(action) {
        const entry = {
            ...action,
            ts: Date.now(),
            actionHash: crypto.createHash('sha256')
                .update(JSON.stringify(action))
                .digest('hex').slice(0, 16),
        };

        this._actions.push(entry);
        if (this._actions.length > this._windowSize) this._actions.shift();

        this._allActions.push(entry);
        if (this._allActions.length > 10000) this._allActions.shift();

        this._stats.totalActions++;
        this._updateRunningStats(entry);

        // Check drift
        this._driftWindow.push(entry.outputHash);
        if (this._driftWindow.length > this._windowSize) this._driftWindow.shift();
        const driftResult = this._checkDrift();
        if (driftResult.drifting) {
            this._stats.driftAlerts++;
            this.emit('action:drift', { entry, ...driftResult });
        }

        // Learn patterns after threshold
        if (this._actions.length >= LEARN_THRESHOLD) {
            this._learnPatterns();
        }

        this.emit('action:recorded', entry);
        return entry;
    }

    /**
     * Record a user action (click, navigation, input, etc.)
     * @param {Object} userAction - { type, target, value, sessionId }
     */
    recordUserAction(userAction) {
        return this.record({
            taskId: `user-${userAction.type}`,
            domain: 'user-interaction',
            inputHash: crypto.createHash('sha256').update(JSON.stringify(userAction)).digest('hex').slice(0, 16),
            outputHash: 'user-action',
            provider: 'user',
            model: 'human',
            latencyMs: 0,
            confidence: 1.0,
            simScore: 1.0,
            battleWon: true,
            mcDeterminism: 1.0,
            ...userAction,
        });
    }

    /**
     * Record an environmental parameter change.
     * @param {Object} envParam - { key, value, previousValue, source }
     */
    recordEnvironmental(envParam) {
        return this.record({
            taskId: `env-${envParam.key}`,
            domain: 'environmental',
            inputHash: crypto.createHash('sha256').update(`${envParam.key}=${envParam.value}`).digest('hex').slice(0, 16),
            outputHash: crypto.createHash('sha256').update(String(envParam.value)).digest('hex').slice(0, 16),
            provider: envParam.source || 'system',
            model: 'env',
            latencyMs: 0,
            confidence: 1.0,
            simScore: 1.0,
            battleWon: true,
            mcDeterminism: 1.0,
            ...envParam,
        });
    }

    // ─── Drift Detection ──────────────────────────────────────────────────

    _checkDrift() {
        if (this._driftWindow.length < 5) {
            return { drifting: false, driftScore: 0, prediction: 'insufficient_data' };
        }

        const unique = new Set(this._driftWindow).size;
        const driftScore = (unique - 1) / (this._driftWindow.length - 1);

        const drifting = driftScore > DRIFT_THRESHOLD;
        const prediction = driftScore === 0 ? 'perfectly_deterministic' :
            driftScore <= PSI_SQ ? 'stable' :
                driftScore <= PSI ? 'moderate_drift' : 'severe_drift';

        if (drifting) {
            const reconfig = this._generateReconfig(driftScore);
            this._stats.reconfigs++;
            this.emit('action:reconfig', reconfig);
        }

        return { drifting, driftScore: +driftScore.toFixed(4), prediction, windowSize: this._driftWindow.length };
    }

    // ─── Pattern Learning ─────────────────────────────────────────────────

    _learnPatterns() {
        // Group recent actions by domain
        const byDomain = {};
        for (const a of this._actions) {
            if (!byDomain[a.domain]) byDomain[a.domain] = [];
            byDomain[a.domain].push(a);
        }

        for (const [domain, actions] of Object.entries(byDomain)) {
            if (actions.length < 3) continue;

            const avgConf = actions.reduce((s, a) => s + (a.confidence || 0), 0) / actions.length;
            const avgLat = actions.reduce((s, a) => s + (a.latencyMs || 0), 0) / actions.length;
            const avgSim = actions.reduce((s, a) => s + (a.simScore || 0), 0) / actions.length;
            const avgMC = actions.reduce((s, a) => s + (a.mcDeterminism || 0), 0) / actions.length;
            const winRate = actions.filter(a => a.battleWon).length / actions.length;

            // Find most common provider/model
            const providerCounts = {};
            for (const a of actions) {
                const key = `${a.provider}/${a.model}`;
                providerCounts[key] = (providerCounts[key] || 0) + 1;
            }
            const bestProvider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];

            const pattern = {
                domain,
                count: actions.length,
                avgConfidence: +avgConf.toFixed(4),
                avgLatencyMs: +avgLat.toFixed(0),
                avgSimScore: +avgSim.toFixed(4),
                avgMCDeterminism: +avgMC.toFixed(4),
                winRate: +winRate.toFixed(4),
                bestProviderModel: bestProvider ? bestProvider[0] : 'unknown',
                recommendedConfig: {
                    temperature: avgMC >= PSI ? 0 : 0.1,
                    seed: 42,
                    top_p: 1,
                    preferredModel: bestProvider ? bestProvider[0] : null,
                },
                learnedAt: Date.now(),
            };

            const isNew = !this._patterns.has(domain);
            this._patterns.set(domain, pattern);
            if (isNew) {
                this._stats.learnedPatterns++;
                this.emit('action:learned', pattern);
            }
        }
    }

    // ─── Reconfiguration ──────────────────────────────────────────────────

    _generateReconfig(driftScore) {
        const steps = [];

        if (driftScore > PSI) {
            steps.push('CRITICAL: Lock all LLM params — temperature=0, seed=42, top_p=1');
            steps.push('Switch to single-model mode (disable racing) to reduce variance');
            steps.push('Enable full replay cache to serve deterministic responses');
        } else if (driftScore > PSI_SQ) {
            steps.push('WARNING: Increase MC sampling iterations to detect boundary');
            steps.push('Tighten CSL confidence threshold to φ⁻¹ (0.618)');
            steps.push('Enable output comparison logging for drift root-cause analysis');
        }

        return {
            action: driftScore > PSI ? 'lock_deterministic' : 'stabilize',
            driftScore: +driftScore.toFixed(4),
            steps,
            newConfig: {
                temperature: 0,
                seed: 42,
                top_p: 1,
                mcIterations: Math.ceil(5 * (1 + driftScore)),
                cslThreshold: driftScore > PSI ? PSI : PSI_SQ,
            },
            ts: Date.now(),
        };
    }

    // ─── Public API ─────────────────────────────────────────────────────

    /** Get current stats */
    getStats() {
        return { ...this._stats };
    }

    /** Get learned patterns for all domains */
    getPatterns() {
        return Object.fromEntries(this._patterns);
    }

    /** Get pattern for a specific domain */
    getPattern(domain) {
        return this._patterns.get(domain) || null;
    }

    /** Get recent actions */
    getRecentActions(n = 10) {
        return this._actions.slice(-n);
    }

    /** Get comprehensive determinism report */
    getDeterminismReport() {
        const patterns = this.getPatterns();
        const domains = Object.keys(patterns);
        const avgDeterminism = domains.length > 0
            ? domains.reduce((s, d) => s + patterns[d].avgMCDeterminism, 0) / domains.length
            : 0;

        return {
            totalActions: this._stats.totalActions,
            learnedDomains: domains.length,
            avgDeterminism: +avgDeterminism.toFixed(4),
            driftAlerts: this._stats.driftAlerts,
            reconfigs: this._stats.reconfigs,
            patterns,
            recommendation: avgDeterminism >= PSI ? 'System is deterministic — maintain current config' :
                avgDeterminism >= PSI_SQ ? 'Marginal determinism — consider tightening params' :
                    'Low determinism — lock all params and enable replay cache',
        };
    }

    /** Force reconfigure based on current state */
    forceReconfig() {
        const drift = this._checkDrift();
        if (!drift.drifting) {
            return { action: 'none', reason: 'No drift detected — system is stable' };
        }
        return this._generateReconfig(drift.driftScore);
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    _updateRunningStats(entry) {
        const n = this._stats.totalActions;
        this._stats.avgConfidence = ((this._stats.avgConfidence * (n - 1)) + (entry.confidence || 0)) / n;
        this._stats.avgLatency = ((this._stats.avgLatency * (n - 1)) + (entry.latencyMs || 0)) / n;
    }
}

module.exports = { ContinuousActionAnalyzer, WINDOW_SIZE, DRIFT_THRESHOLD, LEARN_THRESHOLD, PHI, PSI, PSI_SQ };
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

### `tests/deterministic-prompts.test.js`

```javascript
/**
 * Deterministic Prompt System — Test Suite
 *
 * Tests that prove:
 *   1. Template interpolation is perfectly deterministic
 *   2. CSL confidence gates classify correctly at phi thresholds
 *   3. Drift detection fires at > 0.382 (1 - φ⁻¹)
 *   4. HALT prevents execution and emits reconfigure event
 *   5. Replay cache returns identical results
 *   6. Edge cases: missing vars, empty inputs, degenerate data
 *   7. Full executor pipeline with deterministic guarantees
 *
 * Run: npx jest tests/deterministic-prompts.test.js --verbose
 */

const { DeterministicPromptExecutor, DETERMINISTIC_LLM_PARAMS, REPLAY_THRESHOLD, PHI, PSI, PSI_SQ } = require('../src/prompts/deterministic-prompt-executor');
const { CSLConfidenceGate, TIERS, DRIFT_THRESHOLD } = require('../src/prompts/csl-confidence-gate');

// ─── Stub PromptManager ───────────────────────────────────────────────────────
// The production PromptManager uses backtick template literals that evaluate at
// require() time. We use a faithful stub that mimics its interpolation behavior
// (replacing ${var} placeholders) without triggering JS evaluation.

class StubPromptManager {
    constructor() {
        this._prompts = new Map();
        // Register test prompts using regular strings (not template literals)
        const testPrompts = [
            {
                id: 'code-001', domain: 'code', name: 'Code Review',
                description: 'Thorough code review',
                template: 'You are reviewing ${language} code.\n\nCode:\n${code}\n\nFocus: ${focus}\nStandards: ${standards}\n\nProvide: 1. Critical issues 2. Performance 3. Style 4. Line feedback 5. Rating',
                variables: ['language', 'code', 'focus', 'standards'],
                tags: ['review', 'quality'],
            },
            {
                id: 'code-002', domain: 'code', name: 'Bug Analysis',
                description: 'Diagnose a bug and propose a fix',
                template: 'Diagnose this ${language} bug.\n\nError: ${errorMessage}\nCode: ${code}\nStack: ${stackTrace}\n\nProvide: root cause, fix, prevention.',
                variables: ['language', 'errorMessage', 'code', 'stackTrace'],
                tags: ['debug', 'fix'],
            },
            {
                id: 'deploy-001', domain: 'deploy', name: 'Deployment Plan',
                description: 'Generate a deployment plan',
                template: 'Deploy ${serviceName} from ${currentVersion} to ${targetVersion} using ${strategy} on ${environment}.',
                variables: ['serviceName', 'environment', 'currentVersion', 'targetVersion', 'strategy'],
                tags: ['deployment', 'devops'],
            },
        ];
        for (const p of testPrompts) this._prompts.set(p.id, p);
        this._compositionLog = [];
    }

    getPrompt(id) {
        const p = this._prompts.get(id);
        if (!p) throw new Error(`Prompt not found: '${id}'. Use listPrompts() to see all IDs.`);
        return { ...p };
    }

    interpolate(promptOrId, vars = {}, opts = {}) {
        const { strict = true } = opts;
        const prompt = typeof promptOrId === 'string' ? this.getPrompt(promptOrId) : promptOrId;
        if (strict) {
            const missing = (prompt.variables || []).filter(v => !(v in vars));
            if (missing.length > 0) throw new Error(`Prompt '${prompt.id}' is missing required variables: ${missing.join(', ')}`);
        }
        let result = prompt.template;
        for (const [key, value] of Object.entries(vars)) {
            result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value != null ? String(value) : '');
        }
        return result;
    }

    listPrompts() {
        return Array.from(this._prompts.values()).map(({ id, domain, name, description, variables, tags }) => ({
            id, domain, name, description, variables, tags,
        }));
    }

    composePrompts(ids, varsByPrompt = {}, opts = {}) {
        const { separator = '\n\n---\n\n' } = opts;
        const sections = ids.map(id => {
            const prompt = this.getPrompt(id);
            const vars = varsByPrompt[id] || {};
            const content = this.interpolate(prompt, vars, { strict: false });
            return { id, name: prompt.name, domain: prompt.domain, content };
        });
        return { composed: sections.map(s => s.content).join(separator), sections, ids };
    }
}

// ─── 1. Template Interpolation Determinism ────────────────────────────────────

describe('Template Interpolation Determinism', () => {
    const pm = new StubPromptManager();

    test('same inputs produce identical output — 100 iterations', () => {
        const prompts = pm.listPrompts();
        for (const p of prompts) {
            const vars = {};
            p.variables.forEach(v => { vars[v] = `TEST_${v.toUpperCase()}`; });
            const baseline = pm.interpolate(p.id, vars);
            for (let i = 0; i < 100; i++) {
                expect(pm.interpolate(p.id, vars)).toBe(baseline);
            }
        }
    });

    test('different vars produce different output', () => {
        const a = pm.interpolate('code-001', { language: 'JavaScript', code: 'function a() {}', focus: 'bugs', standards: 'ESLint' });
        const b = pm.interpolate('code-001', { language: 'Python', code: 'def a(): pass', focus: 'security', standards: 'PEP8' });
        expect(a).not.toBe(b);
    });

    test('composition is deterministic', () => {
        const ids = ['code-001', 'code-002'];
        const varsByPrompt = {
            'code-001': { language: 'JS', code: 'x()', focus: 'perf', standards: 'ESLint' },
            'code-002': { language: 'JS', errorMessage: 'TypeError', code: 'y()', stackTrace: 'line 1' },
        };
        const a = pm.composePrompts(ids, varsByPrompt);
        const b = pm.composePrompts(ids, varsByPrompt);
        expect(a.composed).toBe(b.composed);
    });
});

// ─── 2. CSL Confidence Gate Thresholds ────────────────────────────────────────

describe('CSL Confidence Gate — Phi-Scaled Thresholds', () => {
    test('phi constants are correct', () => {
        expect(PHI).toBeCloseTo(1.618, 2);
        expect(PSI).toBeCloseTo(0.618, 2);
        expect(PSI_SQ).toBeCloseTo(0.382, 2);
    });

    test('EXECUTE threshold = φ⁻¹ ≈ 0.618', () => {
        expect(TIERS.EXECUTE).toBeCloseTo(PSI, 6);
    });

    test('CAUTIOUS threshold = φ⁻² ≈ 0.382', () => {
        expect(TIERS.CAUTIOUS).toBeCloseTo(PSI_SQ, 6);
    });

    test('fully-filled prompt → EXECUTE decision', () => {
        const gate = new CSLConfidenceGate();
        const result = gate.preFlightCheck('code-001',
            { language: 'JavaScript', code: 'function test() {}', focus: 'bugs', standards: 'ESLint' },
            'A long interpolated prompt string that is well-formed and contains meaningful content for code review.'
        );
        expect(result.decision).toBe('EXECUTE');
        expect(result.confidence).toBeGreaterThanOrEqual(TIERS.EXECUTE);
    });

    test('partially-filled prompt → CAUTIOUS or lower', () => {
        const gate = new CSLConfidenceGate();
        const result = gate.preFlightCheck('code-001',
            { language: 'JavaScript', code: '', focus: '', standards: '' },
            'Short.'
        );
        expect(['CAUTIOUS', 'HALT']).toContain(result.decision);
        expect(result.confidence).toBeLessThan(TIERS.EXECUTE);
    });

    test('unknown domain → lower confidence', () => {
        const gate = new CSLConfidenceGate();
        const good = gate.preFlightCheck('code-001', { a: 'test' }, 'A long prompt that is meaningful and complete.');
        const bad = gate.preFlightCheck('xyzzy-001', { a: 'test' }, 'A long prompt that is meaningful and complete.');
        expect(bad.confidence).toBeLessThan(good.confidence);
    });

    test('empty prompt → HALT', () => {
        const gate = new CSLConfidenceGate();
        const result = gate.preFlightCheck('', {}, '');
        expect(result.decision).toBe('HALT');
        expect(result.confidence).toBeLessThan(TIERS.CAUTIOUS);
    });
});

// ─── 3. Drift Detection ──────────────────────────────────────────────────────

describe('Drift Detection', () => {
    test('identical outputs → no drift (driftScore = 0)', () => {
        const gate = new CSLConfidenceGate();
        for (let i = 0; i < 5; i++) gate.trackDrift('same_hash');
        const result = gate.trackDrift('same_hash');
        expect(result.drifting).toBe(false);
        expect(result.driftScore).toBe(0);
        expect(result.prediction).toBe('perfectly_deterministic');
    });

    test('all-unique outputs → severe drift (driftScore ≈ 1)', () => {
        const gate = new CSLConfidenceGate();
        for (let i = 0; i < 10; i++) gate.trackDrift(`unique_${i}`);
        const result = gate.trackDrift('unique_10');
        expect(result.drifting).toBe(true);
        expect(result.driftScore).toBeGreaterThan(DRIFT_THRESHOLD);
        expect(result.prediction).toBe('severe_drift_error_imminent');
    });

    test('drift threshold is 1 - φ⁻¹ ≈ 0.382', () => {
        expect(DRIFT_THRESHOLD).toBeCloseTo(1 - PSI, 6);
        expect(DRIFT_THRESHOLD).toBeCloseTo(0.382, 2);
    });

    test('insufficient data → no drift alert', () => {
        const gate = new CSLConfidenceGate();
        gate.trackDrift('a');
        const result = gate.trackDrift('b');
        expect(result.prediction).toBe('insufficient_data');
        expect(result.drifting).toBe(false);
    });
});

// ─── 4. Halt Mechanism ───────────────────────────────────────────────────────

describe('Halt & Reconfigure', () => {
    test('HALT prevents execution and returns null output', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        // Force a halt by giving empty vars to a strict prompt
        const result = executor.execute('code-001', {}, { strict: true });
        expect(result.halted).toBe(true);
        expect(result.output).toBe(null);
        expect(result.decision).toBe('HALT');
    });

    test('HALT emits halt event', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        let haltFired = false;
        executor.on('halt', () => { haltFired = true; });
        executor.execute('code-001', {}, { strict: true });
        expect(haltFired).toBe(true);
    });

    test('HALT emits system:reconfigure event with action plan', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        let reconfigData = null;
        executor.on('system:reconfigure', (data) => { reconfigData = data; });
        executor.execute('code-001', {}, { strict: true });
        expect(reconfigData).not.toBe(null);
        expect(reconfigData.action).toBeDefined();
        expect(reconfigData.steps).toBeDefined();
        expect(reconfigData.steps.length).toBeGreaterThan(0);
    });

    test('reconfigure returns sensible steps for low confidence', () => {
        const gate = new CSLConfidenceGate();
        const reconfig = gate.reconfigure({ confidence: 0.1, reason: 'low confidence' });
        expect(reconfig.action).toBe('escalate');
        expect(reconfig.steps).toContain('ESCALATE: Confidence critically low, require human review');
    });

    test('reconfigure suggests stabilize for drift', () => {
        const gate = new CSLConfidenceGate();
        const reconfig = gate.reconfigure({ confidence: 0.3, reason: 'drift detected, diverging outputs' });
        expect(reconfig.action).toBe('stabilize');
        expect(reconfig.newConfig.llmOverrides.temperature).toBe(0);
    });
});

// ─── 5. Replay Cache ─────────────────────────────────────────────────────────

describe('Replay Cache', () => {
    test('replay returns cached output for known inputHash', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        const vars = { language: 'JS', code: 'x()', focus: 'bugs', standards: 'ESLint' };
        const first = executor.execute('code-001', vars);
        expect(first.cached).toBe(false);

        const replayed = executor.replay(first.inputHash);
        expect(replayed).not.toBeNull();
        expect(replayed.output).toBe(first.output);
        expect(replayed.cslScore).toBe(first.cslScore);
    });

    test('second execution hits cache', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        const vars = { language: 'Python', code: 'def f(): pass', focus: 'security', standards: 'PEP8' };
        const first = executor.execute('code-001', vars);
        const second = executor.execute('code-001', vars);
        expect(second.cached).toBe(true);
        expect(second.decision).toBe('CACHED');
        expect(second.output).toBe(first.output);
    });

    test('replay returns null for unknown hash', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        expect(executor.replay('nonexistent_hash')).toBeNull();
    });

    test('bypassCache forces fresh execution', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        const vars = { language: 'Go', code: 'func main() {}', focus: 'perf', standards: 'govet' };
        executor.execute('code-001', vars);
        const fresh = executor.execute('code-001', vars, { bypassCache: true });
        expect(fresh.cached).toBe(false);
    });
});

// ─── 6. Deterministic Executor — Full Pipeline ───────────────────────────────

describe('Deterministic Executor Pipeline', () => {
    test('enforces deterministic LLM params', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        expect(executor.llmParams.temperature).toBe(0);
        expect(executor.llmParams.top_p).toBe(1);
        expect(executor.llmParams.seed).toBe(42);
    });

    test('inputHash is deterministic (same promptId + vars → same hash)', () => {
        const pm1 = new StubPromptManager();
        const pm2 = new StubPromptManager();
        const executor1 = new DeterministicPromptExecutor({ promptManager: pm1 });
        const executor2 = new DeterministicPromptExecutor({ promptManager: pm2 });
        const vars = { language: 'Rust', code: 'fn main() {}', focus: 'safe', standards: 'clippy' };
        const a = executor1.execute('code-001', vars);
        const b = executor2.execute('code-001', vars);
        expect(a.inputHash).toBe(b.inputHash);
        expect(a.output).toBe(b.output);
    });

    test('getDeterminismReport returns accurate stats', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        const vars = { language: 'JS', code: 'x', focus: 'f', standards: 's' };
        executor.execute('code-001', vars);
        executor.execute('code-001', vars); // cache hit
        const report = executor.getDeterminismReport();
        expect(report.totalExecutions).toBe(2);
        expect(report.cacheHits).toBe(1);
        expect(report.cacheMisses).toBe(1);
        expect(report.cacheHitRate).toBe('50.0%');
        expect(report.phi).toBeCloseTo(PHI, 6);
    });

    test('getAuditLog returns execution history', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        executor.execute('code-001', { language: 'JS', code: 'a', focus: 'b', standards: 'c' });
        const log = executor.getAuditLog();
        expect(log.length).toBe(1);
        expect(log[0].promptId).toBe('code-001');
        expect(log[0].timestamp).toBeGreaterThan(0);
    });

    test('REPLAY_THRESHOLD = φ⁻¹ ≈ 0.618', () => {
        expect(REPLAY_THRESHOLD).toBeCloseTo(PSI, 6);
    });
});

// ─── 7. Edge Cases ───────────────────────────────────────────────────────────

describe('Edge Cases', () => {
    test('CSLConfidenceGate handles empty vars gracefully', () => {
        const gate = new CSLConfidenceGate();
        const result = gate.preFlightCheck('code-001', {}, '');
        // Empty vars + empty prompt → low confidence → HALT or CAUTIOUS
        expect(['CAUTIOUS', 'HALT']).toContain(result.decision);
        expect(result.confidence).toBeLessThan(1.0);
    });

    test('StubPromptManager throws on unknown prompt ID', () => {
        const pm = new StubPromptManager();
        expect(() => pm.getPrompt('nonexistent-999')).toThrow(/not found/i);
    });

    test('gate stats accumulate correctly', () => {
        const gate = new CSLConfidenceGate();
        gate.preFlightCheck('code-001', { language: 'JS', code: 'x', focus: 'f', standards: 's' }, 'A good prompt with enough content.');
        gate.preFlightCheck('', {}, '');
        const stats = gate.getStats();
        expect(stats.checks).toBe(2);
        expect(stats.executes + stats.cautious + stats.halts).toBe(2);
    });

    test('executor handles cross-domain prompts', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        const result = executor.execute('deploy-001', {
            serviceName: 'heady-manager', environment: 'prod',
            currentVersion: '3.2.2', targetVersion: '3.2.3', strategy: 'rolling',
        });
        expect(result.halted).toBe(false);
        expect(result.output).toContain('heady-manager');
        expect(result.output).toContain('3.2.3');
    });

    test('confidence factors are all between 0 and 1', () => {
        const gate = new CSLConfidenceGate();
        const result = gate.preFlightCheck('code-001',
            { language: 'JS', code: 'test', focus: 'perf', standards: 'lint' },
            'A prompt.'
        );
        for (const [key, val] of Object.entries(result.factors)) {
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThanOrEqual(1);
        }
    });
});
```

---
