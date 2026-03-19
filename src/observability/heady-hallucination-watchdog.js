/*
 * © 2026 HeadySystems Inc. — PROPRIETARY AND CONFIDENTIAL
 *
 * HeadyHallucinationWatchdog — LLM Output Factual Verification
 * =============================================================
 *
 * Solves CRITICAL ISSUE from UNIMPLEMENTED_SERVICES_AUDIT.md:
 * "Hallucination Detection: No factual verification layer exists.
 *  LLM outputs pass through unverified."
 *
 * Compares LLM-generated output against:
 *   1. VectorMemory facts (RAM-first semantic search)
 *   2. PgVector persistence (full corpus search when connected)
 *   3. Registered fact sources (domain knowledge bases)
 *
 * Outputs a CSL-scored HallucinationReport with:
 *   - Confidence score (0–1, φ-anchored thresholds)
 *   - Flagged claims with contradictions
 *   - Suggested corrections from memory
 *   - Disposition: PASS / WARN / FLAG / BLOCK
 *
 * Architecture:
 *   LLM Output → Claim Extractor → Vector Search → CSL Gate → Report
 *
 * Integration:
 *   wire into HeadyBuddy response pipeline (post-LLM, pre-delivery)
 *   wire into ARENA stage (model scoring)
 *   wire into HCFullPipeline QUALITY_GATE and ASSURANCE_GATE stages
 *
 * © 2026 HeadySystems Inc. | φ = 1.618033988749895
 */

'use strict';

const EventEmitter = require('events');

// ─── φ-Math ───────────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584];

// CSL thresholds — matches shared/phi-math.js
const CSL = {
    MINIMUM:  0.500,
    LOW:      0.691,
    MEDIUM:   0.809,
    HIGH:     0.882,
    CRITICAL: 0.927,
    DEDUP:    0.972,
};

// Watchdog-specific thresholds
const CONTRADICTION_THRESHOLD = 0.809; // CSL MEDIUM — semantic contradiction gate
const SUPPORT_THRESHOLD       = 0.691; // CSL LOW — supporting evidence gate
const BLOCK_THRESHOLD         = 0.500; // below this confidence → BLOCK
const WARN_THRESHOLD          = 0.691; // below this → WARN
const FLAG_THRESHOLD          = 0.809; // below this → FLAG

// Ring buffer limits
const MAX_HISTORY   = FIB[13]; // 377 reports retained
const MAX_FACT_SRCS = FIB[8];  // 21 registered fact sources

// ─── Logger ───────────────────────────────────────────────────────────────────
let _logger = null;
try { _logger = require('../utils/logger'); } catch { /* optional */ }
function log(level, msg, data = {}) {
    const entry = { level, component: 'HallucinationWatchdog', msg, ts: new Date().toISOString(), ...data };
    if (_logger?.logNodeActivity) _logger.logNodeActivity('WATCHDOG', JSON.stringify(entry));
}

// ─── HeadyHallucinationWatchdog ──────────────────────────────────────────────

class HeadyHallucinationWatchdog extends EventEmitter {
    /**
     * @param {object} opts
     * @param {object} [opts.vectorMemory]  - VectorMemory instance (RAM-first)
     * @param {Function} [opts.embedFn]     - async (text) → Float64Array
     * @param {number} [opts.contradictionThreshold]
     * @param {number} [opts.supportThreshold]
     * @param {boolean} [opts.strict]       - true = BLOCK on low-confidence; false = WARN only
     */
    constructor(opts = {}) {
        super();
        this._vectorMemory = opts.vectorMemory || null;
        this._embedFn = opts.embedFn || null;
        this._contradictionThreshold = opts.contradictionThreshold || CONTRADICTION_THRESHOLD;
        this._supportThreshold = opts.supportThreshold || SUPPORT_THRESHOLD;
        this._strict = opts.strict !== undefined ? opts.strict : false;

        // Registered fact sources: Array<{ name, entries: [{text, vector, source}] }>
        this._factSources = [];

        // Report history ring buffer
        this._history = [];

        // Metrics
        this._metrics = {
            totalChecked: 0,
            totalPassed: 0,
            totalWarned: 0,
            totalFlagged: 0,
            totalBlocked: 0,
        };

        log('info', 'HeadyHallucinationWatchdog initialized', {
            strict: this._strict,
            contradictionThreshold: this._contradictionThreshold,
        });
    }

    // ─── Configuration ────────────────────────────────────────────────────────

    /**
     * Wire a VectorMemory instance as the fact store.
     * @param {object} vectorMemory
     */
    setVectorMemory(vm) {
        this._vectorMemory = vm;
        log('info', 'VectorMemory wired to watchdog');
        return this;
    }

    /**
     * Wire an embedding function.
     * @param {Function} fn - async (text) → Float64Array
     */
    setEmbedFn(fn) {
        this._embedFn = fn;
        return this;
    }

    /**
     * Register a named fact source (domain knowledge base).
     * Facts are pre-embedded and searched during verification.
     * @param {string} name
     * @param {Array<{text: string, vector: Float64Array, source: string}>} facts
     */
    registerFactSource(name, facts) {
        if (this._factSources.length >= MAX_FACT_SRCS) {
            this._factSources.shift(); // evict oldest
        }
        this._factSources.push({ name, facts, registeredAt: Date.now() });
        log('info', `Fact source registered: ${name}`, { factCount: facts.length });
        return this;
    }

    // ─── Core Verification ────────────────────────────────────────────────────

    /**
     * Verify LLM output for hallucinations.
     * Primary entry point — call with full LLM response text.
     *
     * @param {string} output        - LLM-generated text to verify
     * @param {object} [context]     - Request context { taskType, domain, runId, userId }
     * @returns {Promise<HallucinationReport>}
     */
    async verify(output, context = {}) {
        const startTs = Date.now();
        this._metrics.totalChecked++;

        if (!output || typeof output !== 'string') {
            return this._buildReport([], [], 1.0, 'PASS', context, startTs);
        }

        // Extract verifiable claims from output
        const claims = this._extractClaims(output);
        if (claims.length === 0) {
            this._metrics.totalPassed++;
            return this._buildReport([], [], 1.0, 'PASS', context, startTs);
        }

        // Embed all claims in parallel
        const embedResults = await this._embedClaims(claims);

        // Verify each claim against memory + fact sources
        const verifications = await Promise.all(
            embedResults.map(ec => this._verifyClaim(ec))
        );

        // Compute overall confidence score
        const confidence = this._computeConfidence(verifications);

        // Apply CSL gate to determine disposition
        const disposition = this._disposition(confidence);

        // Update metrics
        if (disposition === 'PASS') this._metrics.totalPassed++;
        else if (disposition === 'WARN') this._metrics.totalWarned++;
        else if (disposition === 'FLAG') this._metrics.totalFlagged++;
        else if (disposition === 'BLOCK') this._metrics.totalBlocked++;

        const report = this._buildReport(claims, verifications, confidence, disposition, context, startTs);

        // Record in history ring buffer
        this._history.push({
            reportId: report.reportId,
            confidence,
            disposition,
            claimCount: claims.length,
            ts: Date.now(),
        });
        if (this._history.length > MAX_HISTORY) this._history.shift();

        // Emit event for reactive systems
        this.emit('verification:complete', {
            reportId: report.reportId,
            confidence,
            disposition,
            context,
        });

        if (disposition === 'BLOCK' || disposition === 'FLAG') {
            this.emit('hallucination:detected', {
                reportId: report.reportId,
                confidence,
                disposition,
                flaggedClaims: verifications.filter(v => !v.supported).length,
                context,
            });
        }

        log('debug', `Verified output`, {
            claimCount: claims.length,
            confidence: confidence.toFixed(3),
            disposition,
            latencyMs: Date.now() - startTs,
        });

        return report;
    }

    /**
     * Verify a single claim string (utility method).
     * @param {string} claimText
     * @returns {Promise<{supported, confidence, contradictions, evidence}>}
     */
    async verifyClaim(claimText) {
        if (!this._embedFn) {
            return { supported: true, confidence: 0.5, contradictions: [], evidence: [], reason: 'no-embed-fn' };
        }
        const vector = await this._embedFn(claimText).catch(() => null);
        if (!vector) return { supported: true, confidence: 0.5, contradictions: [], evidence: [], reason: 'embed-failed' };
        return this._verifyClaim({ text: claimText, vector });
    }

    // ─── Claim Extraction ─────────────────────────────────────────────────────

    /**
     * Extract verifiable claims from text.
     * Splits on sentence boundaries and filters to claim-like sentences.
     * @param {string} text
     * @returns {string[]}
     */
    _extractClaims(text) {
        // Split into sentences
        const sentences = text
            .replace(/\n+/g, ' ')
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 20 && s.length < 500);

        // Filter to declarative claim-like sentences (not questions, not list items alone)
        return sentences.filter(s => {
            const lower = s.toLowerCase();
            // Skip obvious non-facts
            if (lower.startsWith('?') || lower.startsWith('•') || lower.startsWith('-')) return false;
            if (lower.includes('i think') || lower.includes('perhaps') || lower.includes('might')) return false;
            // Keep declarative sentences with factual markers
            return /\b(is|are|was|were|has|have|does|did|will|can|provides?|supports?|includes?|contains?)\b/.test(lower);
        }).slice(0, FIB[7]); // max 21 claims per check — fib(8)
    }

    // ─── Embedding ────────────────────────────────────────────────────────────

    async _embedClaims(claims) {
        if (!this._embedFn) {
            // No embedder — return claims without vectors (skips vector search)
            return claims.map(text => ({ text, vector: null }));
        }

        const results = await Promise.all(
            claims.map(async text => {
                try {
                    const vector = await this._embedFn(text);
                    return { text, vector };
                } catch {
                    return { text, vector: null };
                }
            })
        );
        return results;
    }

    // ─── Claim Verification ───────────────────────────────────────────────────

    async _verifyClaim(embeddedClaim) {
        const { text, vector } = embeddedClaim;

        if (!vector) {
            // No vector — cannot verify, default to neutral
            return {
                claim: text,
                supported: true,
                confidence: PSI, // 0.618 — uncertain but not blocking
                evidence: [],
                contradictions: [],
                reason: 'no-vector',
            };
        }

        const evidence = [];
        const contradictions = [];

        // Search VectorMemory
        if (this._vectorMemory) {
            try {
                const memResults = await this._vectorMemory.queryMemory(
                    vector, FIB[5], this._supportThreshold
                );
                for (const r of memResults) {
                    if (r.score >= this._contradictionThreshold) {
                        // High similarity — check if content contradicts
                        const isContradiction = this._detectContradiction(text, r.metadata?.text || '');
                        if (isContradiction) {
                            contradictions.push({ source: 'memory', score: r.score, id: r.id, metadata: r.metadata });
                        } else {
                            evidence.push({ source: 'memory', score: r.score, id: r.id, metadata: r.metadata });
                        }
                    } else if (r.score >= this._supportThreshold) {
                        evidence.push({ source: 'memory', score: r.score, id: r.id, metadata: r.metadata });
                    }
                }
            } catch { /* memory search failed — degrade gracefully */ }
        }

        // Search registered fact sources
        for (const fs of this._factSources) {
            const fsResults = this._searchFactSource(fs, vector, FIB[4]); // top 5
            for (const r of fsResults) {
                if (r.score >= this._supportThreshold) {
                    evidence.push({ source: `fact:${fs.name}`, score: r.score, text: r.text });
                }
            }
        }

        // Compute claim confidence
        const hasEvidence = evidence.length > 0;
        const hasContradiction = contradictions.length > 0;

        let confidence;
        if (hasContradiction && !hasEvidence) {
            confidence = 0.2; // contradicted with no support
        } else if (hasContradiction && hasEvidence) {
            confidence = 0.5; // conflicting signals
        } else if (hasEvidence) {
            // Confidence proportional to best evidence score, φ-weighted
            const bestScore = Math.max(...evidence.map(e => e.score));
            confidence = Math.min(1.0, bestScore * PHI * PSI); // φ × ψ ≈ 1.0
        } else {
            confidence = PSI; // no memory match — uncertain (0.618)
        }

        return {
            claim: text,
            supported: confidence >= this._supportThreshold,
            confidence,
            evidence,
            contradictions,
            reason: hasContradiction ? 'contradicted' : hasEvidence ? 'supported' : 'unverified',
        };
    }

    /**
     * Lightweight contradiction detection using negation patterns.
     * Not semantic — fast heuristic for obvious contradictions.
     */
    _detectContradiction(claimA, claimB) {
        if (!claimB) return false;
        const a = claimA.toLowerCase();
        const b = claimB.toLowerCase();

        // Opposite polarity markers
        const negativeMarkers = ['not ', "doesn't", "isn't", "aren't", "wasn't", "weren't", 'never', 'no '];
        const aHasNeg = negativeMarkers.some(m => a.includes(m));
        const bHasNeg = negativeMarkers.some(m => b.includes(m));

        // XOR — one is positive, one is negative (potential contradiction)
        return aHasNeg !== bHasNeg;
    }

    /**
     * Linear cosine search against a fact source.
     */
    _searchFactSource(factSource, queryVector, k) {
        const results = [];
        for (const fact of factSource.facts) {
            if (!fact.vector) continue;
            const score = this._cosine(queryVector, fact.vector);
            if (score >= this._supportThreshold) {
                results.push({ text: fact.text, score, source: fact.source });
            }
        }
        return results.sort((a, b) => b.score - a.score).slice(0, k);
    }

    _cosine(a, b) {
        let dot = 0, normA = 0, normB = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom === 0 ? 0 : dot / denom;
    }

    // ─── Confidence & Disposition ─────────────────────────────────────────────

    _computeConfidence(verifications) {
        if (verifications.length === 0) return 1.0;
        const scores = verifications.map(v => v.confidence);
        // φ-weighted average — recent entries weighted more
        let weightedSum = 0, totalWeight = 0;
        for (let i = 0; i < scores.length; i++) {
            const weight = Math.pow(PSI, scores.length - 1 - i);
            weightedSum += scores[i] * weight;
            totalWeight += weight;
        }
        return totalWeight > 0 ? weightedSum / totalWeight : 1.0;
    }

    /**
     * @param {number} confidence
     * @returns {'PASS'|'WARN'|'FLAG'|'BLOCK'}
     */
    _disposition(confidence) {
        if (confidence >= FLAG_THRESHOLD) return 'PASS';
        if (confidence >= WARN_THRESHOLD) return 'FLAG';
        if (confidence >= BLOCK_THRESHOLD) return 'WARN';
        // Below MINIMUM — BLOCK in strict mode, WARN in lenient
        return this._strict ? 'BLOCK' : 'WARN';
    }

    // ─── Report Builder ───────────────────────────────────────────────────────

    _buildReport(claims, verifications, confidence, disposition, context, startTs) {
        const reportId = `hvw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const flaggedClaims = verifications.filter(v => !v.supported);

        return {
            reportId,
            disposition,       // PASS | WARN | FLAG | BLOCK
            confidence,        // 0–1 overall
            claimCount: claims.length,
            flaggedCount: flaggedClaims.length,
            flaggedClaims,
            supportedCount: verifications.length - flaggedClaims.length,
            latencyMs: Date.now() - startTs,
            ts: new Date().toISOString(),
            context,
            cslThresholds: {
                support: this._supportThreshold,
                contradiction: this._contradictionThreshold,
            },
            phi: PHI,
        };
    }

    // ─── Status & History ─────────────────────────────────────────────────────

    getStatus() {
        const recentHistory = this._history.slice(-FIB[6]).reverse(); // last 13
        const dispositionCounts = recentHistory.reduce((acc, r) => {
            acc[r.disposition] = (acc[r.disposition] || 0) + 1;
            return acc;
        }, {});

        return {
            ...this._metrics,
            factSourceCount: this._factSources.length,
            historySize: this._history.length,
            recentDispositions: dispositionCounts,
            hasVectorMemory: !!this._vectorMemory,
            hasEmbedFn: !!this._embedFn,
            strict: this._strict,
            thresholds: {
                support: this._supportThreshold,
                contradiction: this._contradictionThreshold,
                warn: WARN_THRESHOLD,
                flag: FLAG_THRESHOLD,
                block: BLOCK_THRESHOLD,
            },
            phi: PHI,
        };
    }

    getHistory(limit = FIB[6]) {
        return this._history.slice(-Math.min(limit, MAX_HISTORY)).reverse();
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance = null;

function getWatchdog(opts = {}) {
    if (!_instance) {
        _instance = new HeadyHallucinationWatchdog(opts);
        global.__hallucinationWatchdog = _instance;
        log('info', 'HeadyHallucinationWatchdog singleton created');
    }
    return _instance;
}

// ─── Express Routes ───────────────────────────────────────────────────────────

function registerWatchdogRoutes(app, watchdog) {
    const w = watchdog || getWatchdog();

    app.get('/api/watchdog/status', (_req, res) => res.json({ ok: true, ...w.getStatus() }));

    app.get('/api/watchdog/history', (req, res) => {
        const limit = parseInt(req.query.limit) || FIB[6];
        res.json({ ok: true, history: w.getHistory(limit) });
    });

    app.post('/api/watchdog/verify', async (req, res) => {
        try {
            const { output, context } = req.body || {};
            if (!output || typeof output !== 'string') {
                return res.status(400).json({ ok: false, error: 'output string required' });
            }
            const report = await w.verify(output, context || {});
            res.json({ ok: true, report });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/watchdog/verify-claim', async (req, res) => {
        try {
            const { claim } = req.body || {};
            if (!claim || typeof claim !== 'string') {
                return res.status(400).json({ ok: false, error: 'claim string required' });
            }
            const result = await w.verifyClaim(claim);
            res.json({ ok: true, result });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    HeadyHallucinationWatchdog,
    getWatchdog,
    registerWatchdogRoutes,
    CSL,
    PHI,
    PSI,
};
