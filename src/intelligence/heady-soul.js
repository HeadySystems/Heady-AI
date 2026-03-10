/**
 * Heady™ HeadySoul v7.0
 * Awareness layer — values arbiter, coherence guardian, 3 Unbreakable Laws
 * The conscience of the Heady operating system.
 * Every mutation flows through HeadySoul for alignment verification.
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');
const { createLogger } = require('../../shared/logger');
const { HealthProbe } = require('../../shared/health');
const {
  PHI, PSI, PSI_SQ, PSI_CUBE, fib, phiBackoffWithJitter,
  CSL_THRESHOLDS, COHERENCE_DRIFT_THRESHOLD, DEDUP_THRESHOLD,
  EMBEDDING_DIM, SERVICE_PORTS,
  cslAND, cslOR, cslNOT,
} = require('../../shared/phi-math');

const logger = createLogger('heady-soul');

// ═══════════════════════════════════════════════════════════
// THE 3 UNBREAKABLE LAWS
// Every code mutation, every task result, every system change
// must satisfy ALL three laws or be rejected.
// ═══════════════════════════════════════════════════════════

const UNBREAKABLE_LAWS = Object.freeze({
  STRUCTURAL_INTEGRITY: {
    id: 1,
    name: 'Structural Integrity',
    description: 'Code compiles, passes type checks, respects module boundaries',
    threshold: CSL_THRESHOLDS.HIGH,  // 0.882 — must be strongly compliant
    weight: PSI,                      // 0.618 — highest weight
  },
  SEMANTIC_COHERENCE: {
    id: 2,
    name: 'Semantic Coherence',
    description: 'Change embedding stays within tolerance of the intended design',
    threshold: COHERENCE_DRIFT_THRESHOLD,  // 0.809 — MEDIUM threshold
    weight: PSI_SQ,                        // 0.382
  },
  MISSION_ALIGNMENT: {
    id: 3,
    name: 'Mission Alignment',
    description: 'Change serves HeadyConnection mission: community, equity, empowerment',
    threshold: CSL_THRESHOLDS.LOW,   // 0.691 — broad mission alignment
    weight: PSI_CUBE,                // 0.236
  },
});

// ═══════════════════════════════════════════════════════════
// CORE VALUES — The mission compass
// ═══════════════════════════════════════════════════════════

const CORE_VALUES = Object.freeze([
  { name: 'community',    embedding: null, weight: PSI },
  { name: 'equity',       embedding: null, weight: PSI_SQ },
  { name: 'empowerment',  embedding: null, weight: PSI_CUBE },
  { name: 'transparency', embedding: null, weight: PSI_SQ },
  { name: 'innovation',   embedding: null, weight: PSI_CUBE },
]);

// ═══════════════════════════════════════════════════════════
// HEADY SOUL — The consciousness of the system
// ═══════════════════════════════════════════════════════════

class HeadySoul extends EventEmitter {
  constructor(config = {}) {
    super();
    this.health = new HealthProbe('heady-soul');

    // Design embeddings — the "DNA" of each component
    this.designEmbeddings = new Map();

    // Coherence tracking
    this.coherenceScores = new Map();
    this.coherenceHistory = [];
    this.maxHistory = fib(14);         // 377 entries

    // Drift alerts
    this.driftAlerts = [];
    this.maxAlerts = fib(12);          // 144 alerts

    // Audit trail of law evaluations
    this.auditTrail = [];
    this.maxAudit = fib(13);           // 233 entries

    // Healing requests queue
    this.healingQueue = [];
    this.maxHealingQueue = fib(10);    // 55 items

    // Statistics
    this.stats = {
      evaluations: 0,
      approvals: 0,
      rejections: 0,
      driftDetections: 0,
      healingRequests: 0,
    };

    // Check interval — phi-scaled
    this.coherenceCheckInterval = null;
    this.checkIntervalMs = fib(8) * 1000;  // 21 seconds
  }

  // ═══════════════════════════════════════════════════════════
  // LAW EVALUATION — The core function
  // ═══════════════════════════════════════════════════════════

  async evaluateLaws(mutation) {
    this.stats.evaluations++;
    const evaluationId = crypto.randomBytes(fib(6)).toString('hex');
    const startTime = Date.now();

    const results = {
      evaluationId,
      timestamp: new Date().toISOString(),
      mutation: {
        type: mutation.type,
        component: mutation.component,
        source: mutation.source,
      },
      laws: {},
      overallScore: 0,
      approved: false,
      reasons: [],
    };

    // Evaluate each law
    const law1 = await this._evaluateStructuralIntegrity(mutation);
    const law2 = await this._evaluateSemanticCoherence(mutation);
    const law3 = await this._evaluateMissionAlignment(mutation);

    results.laws = {
      structuralIntegrity: law1,
      semanticCoherence: law2,
      missionAlignment: law3,
    };

    // Phi-weighted overall score
    results.overallScore =
      law1.score * UNBREAKABLE_LAWS.STRUCTURAL_INTEGRITY.weight +
      law2.score * UNBREAKABLE_LAWS.SEMANTIC_COHERENCE.weight +
      law3.score * UNBREAKABLE_LAWS.MISSION_ALIGNMENT.weight;

    // ALL laws must pass their individual thresholds AND overall must exceed MEDIUM
    const law1Pass = law1.score >= UNBREAKABLE_LAWS.STRUCTURAL_INTEGRITY.threshold;
    const law2Pass = law2.score >= UNBREAKABLE_LAWS.SEMANTIC_COHERENCE.threshold;
    const law3Pass = law3.score >= UNBREAKABLE_LAWS.MISSION_ALIGNMENT.threshold;
    const overallPass = results.overallScore >= CSL_THRESHOLDS.MEDIUM;

    results.approved = law1Pass && law2Pass && law3Pass && overallPass;

    if (!law1Pass) results.reasons.push(`Structural Integrity below ${UNBREAKABLE_LAWS.STRUCTURAL_INTEGRITY.threshold.toFixed(3)}`);
    if (!law2Pass) results.reasons.push(`Semantic Coherence below ${UNBREAKABLE_LAWS.SEMANTIC_COHERENCE.threshold.toFixed(3)}`);
    if (!law3Pass) results.reasons.push(`Mission Alignment below ${UNBREAKABLE_LAWS.MISSION_ALIGNMENT.threshold.toFixed(3)}`);
    if (!overallPass) results.reasons.push(`Overall score ${results.overallScore.toFixed(3)} below MEDIUM threshold`);

    if (results.approved) {
      this.stats.approvals++;
    } else {
      this.stats.rejections++;
      this.emit('rejection', results);
    }

    results.durationMs = Date.now() - startTime;

    // Record in audit trail
    this._addToAudit(results);

    logger.info({
      message: results.approved ? 'Mutation approved' : 'Mutation REJECTED',
      evaluationId,
      component: mutation.component,
      overallScore: results.overallScore.toFixed(3),
      approved: results.approved,
      reasons: results.reasons,
      durationMs: results.durationMs,
    });

    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // LAW 1: STRUCTURAL INTEGRITY
  // ═══════════════════════════════════════════════════════════

  async _evaluateStructuralIntegrity(mutation) {
    let score = 1.0;
    const issues = [];

    // Check: Does the mutation have valid structure?
    if (!mutation.type || !mutation.component) {
      score -= 0.3;
      issues.push('Missing mutation type or component');
    }

    // Check: Module boundary violations
    if (mutation.crossesBoundary && !mutation.boundaryJustification) {
      score -= 0.2;
      issues.push('Crosses module boundary without justification');
    }

    // Check: Has the code been validated (lint, type check)?
    if (mutation.validated === false) {
      score -= 0.4;
      issues.push('Code not validated');
    }

    // Check: Does it have proper error handling?
    if (mutation.hasErrorHandling === false) {
      score -= 0.15;
      issues.push('Missing error handling');
    }

    // Check: Zero console.log
    if (mutation.hasConsoleLog) {
      score -= 0.2;
      issues.push('Contains console.log — use structured logger');
    }

    // Check: No magic numbers
    if (mutation.hasMagicNumbers) {
      score -= 0.15;
      issues.push('Contains magic numbers — derive from phi/Fibonacci');
    }

    // Check: Has health endpoint (for services)
    if (mutation.isService && !mutation.hasHealthEndpoint) {
      score -= 0.1;
      issues.push('Service missing health endpoint');
    }

    return {
      law: 'Structural Integrity',
      score: Math.max(0, score),
      threshold: UNBREAKABLE_LAWS.STRUCTURAL_INTEGRITY.threshold,
      passed: Math.max(0, score) >= UNBREAKABLE_LAWS.STRUCTURAL_INTEGRITY.threshold,
      issues,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // LAW 2: SEMANTIC COHERENCE
  // ═══════════════════════════════════════════════════════════

  async _evaluateSemanticCoherence(mutation) {
    let score = 1.0;
    const issues = [];

    // If we have design embeddings, check cosine similarity
    if (mutation.embedding && this.designEmbeddings.has(mutation.component)) {
      const designEmb = this.designEmbeddings.get(mutation.component);
      const similarity = this._cosineSimilarity(mutation.embedding, designEmb);

      if (similarity < COHERENCE_DRIFT_THRESHOLD) {
        const drift = COHERENCE_DRIFT_THRESHOLD - similarity;
        score -= drift * PHI;  // Amplified penalty for drift
        issues.push(`Semantic drift: similarity ${similarity.toFixed(3)} below ${COHERENCE_DRIFT_THRESHOLD.toFixed(3)}`);

        // Record drift event
        this.stats.driftDetections++;
        this._addDriftAlert(mutation.component, similarity);
      } else {
        // Bonus for high coherence
        score = Math.min(1.0, score + (similarity - COHERENCE_DRIFT_THRESHOLD) * PSI);
      }
    } else if (!mutation.embedding) {
      // No embedding provided — partial penalty
      score -= 0.1;
      issues.push('No embedding provided for coherence check');
    }

    // Check naming conventions
    if (mutation.naming && !this._checkNamingConventions(mutation.naming)) {
      score -= 0.1;
      issues.push('Naming convention violation');
    }

    // Check phi-compliance of any numeric constants
    if (mutation.constants) {
      const nonPhiConstants = mutation.constants.filter(c => !this._isPhiDerived(c));
      if (nonPhiConstants.length > 0) {
        score -= nonPhiConstants.length * 0.05;
        issues.push(`${nonPhiConstants.length} non-phi-derived constants`);
      }
    }

    return {
      law: 'Semantic Coherence',
      score: Math.max(0, score),
      threshold: UNBREAKABLE_LAWS.SEMANTIC_COHERENCE.threshold,
      passed: Math.max(0, score) >= UNBREAKABLE_LAWS.SEMANTIC_COHERENCE.threshold,
      issues,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // LAW 3: MISSION ALIGNMENT
  // ═══════════════════════════════════════════════════════════

  async _evaluateMissionAlignment(mutation) {
    let score = 0.8;  // Default: assume aligned unless flagged
    const issues = [];

    // Check: Does the mutation serve the HeadyConnection mission?
    if (mutation.missionContext) {
      // If explicitly tagged with mission alignment
      const alignmentScore = mutation.missionContext.alignmentScore || 0.5;
      score = alignmentScore;
    }

    // Check: Does it introduce vendor lock-in that harms sovereignty?
    if (mutation.introducesVendorLockIn) {
      score -= 0.2;
      issues.push('Introduces vendor lock-in — sovereign AI principle violated');
    }

    // Check: Is it accessible? (community value)
    if (mutation.isUserFacing && mutation.accessibilityScore !== undefined) {
      if (mutation.accessibilityScore < CSL_THRESHOLDS.LOW) {
        score -= 0.15;
        issues.push('Accessibility below minimum threshold');
      }
    }

    // Check: Does it respect user privacy? (equity value)
    if (mutation.collectsUserData && !mutation.hasPrivacyDisclosure) {
      score -= 0.2;
      issues.push('Collects user data without privacy disclosure');
    }

    // Check: Open/transparent design (transparency value)
    if (mutation.isOpaque && !mutation.opaqueJustification) {
      score -= 0.1;
      issues.push('Opaque implementation without justification');
    }

    return {
      law: 'Mission Alignment',
      score: Math.max(0, score),
      threshold: UNBREAKABLE_LAWS.MISSION_ALIGNMENT.threshold,
      passed: Math.max(0, score) >= UNBREAKABLE_LAWS.MISSION_ALIGNMENT.threshold,
      issues,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // COHERENCE MONITORING — Continuous self-healing cycle
  // ═══════════════════════════════════════════════════════════

  startCoherenceMonitoring() {
    if (this.coherenceCheckInterval) return;

    this.coherenceCheckInterval = setInterval(() => {
      this._runCoherenceCheck();
    }, this.checkIntervalMs);

    if (this.coherenceCheckInterval.unref) {
      this.coherenceCheckInterval.unref();
    }

    logger.info({ message: 'Coherence monitoring started', intervalMs: this.checkIntervalMs });
  }

  _runCoherenceCheck() {
    for (const [component, designEmb] of this.designEmbeddings) {
      const currentScore = this.coherenceScores.get(component);
      if (currentScore === undefined) continue;

      if (currentScore < COHERENCE_DRIFT_THRESHOLD) {
        this._addDriftAlert(component, currentScore);
        this._requestHealing(component, currentScore);
      }
    }
  }

  _addDriftAlert(component, currentScore) {
    const alert = {
      component,
      currentScore,
      threshold: COHERENCE_DRIFT_THRESHOLD,
      drift: COHERENCE_DRIFT_THRESHOLD - currentScore,
      timestamp: new Date().toISOString(),
    };

    this.driftAlerts.push(alert);
    while (this.driftAlerts.length > this.maxAlerts) {
      this.driftAlerts.shift();
    }

    this.emit('drift', alert);

    logger.warn({
      message: 'Coherence drift detected',
      component,
      currentScore: currentScore.toFixed(3),
      threshold: COHERENCE_DRIFT_THRESHOLD.toFixed(3),
    });
  }

  _requestHealing(component, currentScore) {
    const request = {
      component,
      currentScore,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };

    this.healingQueue.push(request);
    while (this.healingQueue.length > this.maxHealingQueue) {
      this.healingQueue.shift();
    }

    this.stats.healingRequests++;
    this.emit('healing_request', request);

    logger.info({
      message: 'Self-healing requested',
      component,
      currentScore: currentScore.toFixed(3),
      queueSize: this.healingQueue.length,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // DESIGN EMBEDDING MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  registerDesignEmbedding(component, embedding) {
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
      throw new Error(`Design embedding must be ${EMBEDDING_DIM}-dimensional`);
    }
    this.designEmbeddings.set(component, embedding);
    this.coherenceScores.set(component, 1.0);  // Perfect coherence at registration

    logger.info({ message: 'Design embedding registered', component, dimension: EMBEDDING_DIM });
  }

  updateCoherenceScore(component, currentEmbedding) {
    const designEmb = this.designEmbeddings.get(component);
    if (!designEmb) return null;

    const similarity = this._cosineSimilarity(currentEmbedding, designEmb);
    this.coherenceScores.set(component, similarity);

    this.coherenceHistory.push({
      component,
      score: similarity,
      timestamp: Date.now(),
    });
    while (this.coherenceHistory.length > this.maxHistory) {
      this.coherenceHistory.shift();
    }

    return similarity;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
  }

  _checkNamingConventions(naming) {
    // camelCase for variables, PascalCase for classes, UPPER_SNAKE for constants
    if (naming.variables) {
      return naming.variables.every(n => /^[a-z][a-zA-Z0-9]*$/.test(n));
    }
    return true;
  }

  _isPhiDerived(value) {
    if (typeof value !== 'number') return false;
    // Check if value is a Fibonacci number
    const fibs = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];
    if (fibs.includes(value)) return true;
    // Check if value is a phi-derived threshold
    const phiValues = [PHI, PSI, PSI_SQ, PSI_CUBE, 384];
    if (phiValues.some(p => Math.abs(value - p) < 0.001)) return true;
    // Check CSL thresholds
    return Object.values(CSL_THRESHOLDS).some(t => Math.abs(value - t) < 0.001);
  }

  _addToAudit(result) {
    this.auditTrail.push(result);
    while (this.auditTrail.length > this.maxAudit) {
      this.auditTrail.shift();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STATUS & HEALTH
  // ═══════════════════════════════════════════════════════════

  getStatus() {
    const componentScores = {};
    for (const [comp, score] of this.coherenceScores) {
      componentScores[comp] = {
        score: score.toFixed(3),
        healthy: score >= COHERENCE_DRIFT_THRESHOLD,
      };
    }

    return {
      designEmbeddings: this.designEmbeddings.size,
      coherenceScores: componentScores,
      driftAlerts: this.driftAlerts.length,
      recentDrifts: this.driftAlerts.slice(-fib(5)),
      healingQueue: this.healingQueue.length,
      auditTrailSize: this.auditTrail.length,
      stats: { ...this.stats },
      approvalRate: this.stats.evaluations > 0
        ? (this.stats.approvals / this.stats.evaluations).toFixed(3)
        : 'N/A',
    };
  }

  // ═══════════════════════════════════════════════════════════
  // SHUTDOWN
  // ═══════════════════════════════════════════════════════════

  shutdown() {
    if (this.coherenceCheckInterval) {
      clearInterval(this.coherenceCheckInterval);
      this.coherenceCheckInterval = null;
    }
    logger.info({ message: 'HeadySoul shut down' });
  }
}

module.exports = { HeadySoul, UNBREAKABLE_LAWS, CORE_VALUES };
