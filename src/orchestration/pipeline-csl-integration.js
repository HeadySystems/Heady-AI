// ═══════════════════════════════════════════════════════════════════════════════
// SYS-004: CSL Engine v2 Pipeline Integration
// Wires shared/csl-engine-v2.js into classify (stage 3) and judge (stage 10)
// PL-004: compute_csl_resonance implementation
// © 2026 HeadySystems Inc. — 60+ Provisional Patents
// ═══════════════════════════════════════════════════════════════════════════════

import {
  cslAND, cslOR, cslCONSENSUS, cslGATE, phiGATE,
  textToEmbedding, MoECSLRouter, DIM, TERNARY, toTernary,
} from '../shared/csl-engine-v2.js';
import { TrustReceiptSigner } from '../shared/trust-receipt-signer.js';

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB_8 = 21;

/**
 * PipelineCSLIntegration — CSL gate logic for pipeline classification and judgment
 */
export class PipelineCSLIntegration {
  #router;
  #receiptSigner;
  #swarmVectors;

  constructor() {
    // 17-swarm MoE router (one expert per swarm)
    this.#router = new MoECSLRouter(17, DIM);
    this.#receiptSigner = new TrustReceiptSigner();
    this.#swarmVectors = new Map();

    // Initialize swarm capability vectors
    const swarmNames = [
      'Builder', 'Sentinel', 'Oracle', 'Diplomat', 'Curator',
      'Scout', 'Forager', 'Quant', 'Weaver', 'Architect',
      'Healer', 'Harvester', 'Navigator', 'Trainer', 'Chronicler',
      'Judge', 'Conductor'
    ];
    for (const name of swarmNames) {
      this.#swarmVectors.set(name, textToEmbedding(`heady swarm ${name.toLowerCase()} capability`));
    }
  }

  /**
   * Stage 3 — CLASSIFY: Compute CSL resonance between intent and swarm capabilities
   * PL-004: compute_csl_resonance — cos(intent_vector, swarm_capability_vector)
   */
  classify(task) {
    const intentVector = task.semanticVector || textToEmbedding(task.description || task.title || '');
    const scores = [];

    for (const [swarmName, capabilityVector] of this.#swarmVectors) {
      const resonance = cslAND(intentVector, capabilityVector);
      const gated = phiGATE(intentVector, capabilityVector, 2);
      const ternary = toTernary(resonance);

      scores.push({
        swarm: swarmName,
        resonance,
        gated,
        ternary,
        ternaryLabel: ternary === TERNARY.TRUE ? 'MATCH' :
                      ternary === TERNARY.FALSE ? 'REJECT' : 'UNCERTAIN',
      });
    }

    // Sort by resonance descending
    scores.sort((a, b) => b.resonance - a.resonance);

    // Use MoE router for top-K selection
    const routingDecision = this.#router.route(intentVector);

    return {
      stageId: 3,
      stageName: 'classify',
      taskId: task.id,
      scores,
      topSwarm: scores[0],
      routingDecision,
      collapseDetected: this.#router.detectCollapse(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Stage 10 — JUDGE: Evaluate candidate results using CSL consensus
   * Determines which candidate solution best satisfies the original intent
   */
  judge(task, candidates) {
    const intentVector = task.semanticVector || textToEmbedding(task.description || '');
    const evaluations = [];

    for (const candidate of candidates) {
      const candidateVector = candidate.semanticVector || textToEmbedding(
        JSON.stringify(candidate.result || candidate.output || '')
      );

      const intentAlignment = cslAND(intentVector, candidateVector);
      const qualityGate = phiGATE(candidateVector, intentVector, 3);
      const ternaryVerdict = toTernary(intentAlignment);

      evaluations.push({
        candidateId: candidate.id,
        intentAlignment,
        qualityGate,
        verdict: ternaryVerdict === TERNARY.TRUE ? 'ACCEPT' :
                 ternaryVerdict === TERNARY.FALSE ? 'REJECT' : 'REVIEW',
        confidence: intentAlignment,
      });
    }

    // Sort by alignment score
    evaluations.sort((a, b) => b.intentAlignment - a.intentAlignment);

    // Consensus across all candidate vectors
    const candidateVecs = candidates.map(c =>
      c.semanticVector || textToEmbedding(JSON.stringify(c.result || ''))
    );
    const consensusVec = candidateVecs.length > 0 ? cslCONSENSUS(candidateVecs) : null;
    const consensusAlignment = consensusVec ? cslAND(intentVector, consensusVec) : 0;

    const judgment = {
      stageId: 10,
      stageName: 'judge',
      taskId: task.id,
      evaluations,
      winner: evaluations[0] || null,
      consensusAlignment,
      totalCandidates: candidates.length,
      accepted: evaluations.filter(e => e.verdict === 'ACCEPT').length,
      rejected: evaluations.filter(e => e.verdict === 'REJECT').length,
      needsReview: evaluations.filter(e => e.verdict === 'REVIEW').length,
      timestamp: new Date().toISOString(),
    };

    // Sign the judgment as a trust receipt
    if (this.#receiptSigner.hasPrivateKey) {
      judgment.receipt = this.#receiptSigner.createStageReceipt(
        10, 'judge', { success: judgment.accepted > 0 }, task.id
      );
    }

    return judgment;
  }

  /**
   * PL-005: check_public_domain_inspiration — mine best-practice patterns
   */
  checkPublicDomainInspiration(taskDescription) {
    const taskVec = textToEmbedding(taskDescription);
    const patternCategories = [
      'design patterns software engineering',
      'security best practices OWASP',
      'performance optimization caching',
      'distributed systems consensus',
      'machine learning MLOps',
      'API design REST GraphQL',
    ];

    return patternCategories.map(category => ({
      category,
      resonance: cslAND(taskVec, textToEmbedding(category)),
    })).sort((a, b) => b.resonance - a.resonance);
  }

  /**
   * PL-006: validate_governance_policies — check against governance rules
   */
  validateGovernancePolicies(task) {
    const policyVectors = {
      'security_policy': textToEmbedding('zero trust security no hardcoded secrets'),
      'phi_compliance': textToEmbedding('phi fibonacci sacred geometry constants'),
      'glass_box': textToEmbedding('transparency audit logging traceability'),
      'patent_protection': textToEmbedding('patent provisional intellectual property'),
    };

    const taskVec = textToEmbedding(JSON.stringify(task));
    const results = {};

    for (const [policy, vec] of Object.entries(policyVectors)) {
      const score = cslAND(taskVec, vec);
      results[policy] = {
        score,
        compliant: toTernary(score) !== TERNARY.FALSE,
      };
    }

    return {
      taskId: task.id,
      governance: results,
      overallCompliant: Object.values(results).every(r => r.compliant),
    };
  }

  /**
   * PL-009: assess_metacognitive_confidence — HeadyBuddy confidence ≥ 20%
   */
  assessMetacognitiveConfidence(task, executionResult) {
    const intentVec = textToEmbedding(task.description || '');
    const resultVec = textToEmbedding(JSON.stringify(executionResult || ''));
    const confidence = cslAND(intentVec, resultVec);
    const minConfidence = 0.20; // 20% minimum per Super Prompt

    return {
      confidence,
      meetsMinimum: confidence >= minConfidence,
      gatedConfidence: phiGATE(resultVec, intentVec, 2),
      recommendation: confidence >= PSI ? 'PROCEED' :
                       confidence >= minConfidence ? 'PROCEED_WITH_CAUTION' : 'HALT_AND_LEARN',
    };
  }

  /**
   * PL-010: immunize_pipeline — inject prevention guards from mistake analysis
   */
  immunizePipeline(failurePattern, existingGuards = []) {
    const failureVec = textToEmbedding(failurePattern);
    const guardVecs = existingGuards.map(g => textToEmbedding(g));

    // Check if a guard already covers this failure
    const covered = guardVecs.some(gv => cslAND(failureVec, gv) > PSI);
    if (covered) {
      return { action: 'SKIP', reason: 'Existing guard covers this failure pattern' };
    }

    // Generate new guard
    return {
      action: 'INJECT',
      guard: {
        pattern: failurePattern,
        vector: failureVec,
        createdAt: new Date().toISOString(),
        type: 'prevention_guard',
      },
    };
  }
}

export default PipelineCSLIntegration;
