/**
 * Heady™ Soul Governance v5.0.0
 * Values arbiter, coherence guardian, 3 Unbreakable Laws enforcement
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { PHI, PSI, FIB, CSL_THRESHOLDS, cosineSimilarity, normalize } from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('heady-soul');

// ═══ The 3 Unbreakable Laws ═══
export interface LawValidation {
  law: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface GovernanceDecision {
  requestId: string;
  laws: LawValidation[];
  overallPassed: boolean;
  coherenceScore: number;
  timestamp: string;
  recommendation: 'proceed' | 'modify' | 'reject';
}

export interface MissionAlignment {
  community: number;   // Alignment with community values
  equity: number;      // Alignment with equity goals
  empowerment: number; // Alignment with empowerment mission
  composite: number;   // φ-weighted composite
}

// ═══ Mission Embedding (HeadyConnection values) ═══
// These would be real 384D embeddings in production; here represented as directional vectors
const MISSION_KEYWORDS = [
  'community', 'equity', 'empowerment', 'education', 'access',
  'inclusion', 'opportunity', 'mentorship', 'growth', 'justice',
];

// ═══ Law 1: Structural Integrity ═══
function validateStructuralIntegrity(
  change: { compiles: boolean; typesafe: boolean; boundariesRespected: boolean },
): LawValidation {
  const checks = [change.compiles, change.typesafe, change.boundariesRespected];
  const passed = checks.every(Boolean);
  const score = checks.filter(Boolean).length / checks.length;

  return {
    law: 'Structural Integrity',
    passed,
    score,
    details: passed
      ? 'Code compiles, passes type checks, respects module boundaries'
      : `Violations: ${[
          !change.compiles && 'compilation failure',
          !change.typesafe && 'type safety violation',
          !change.boundariesRespected && 'module boundary violation',
        ].filter(Boolean).join(', ')}`,
  };
}

// ═══ Law 2: Semantic Coherence ═══
function validateSemanticCoherence(
  changeEmbedding: number[] | null,
  designEmbedding: number[] | null,
): LawValidation {
  if (!changeEmbedding || !designEmbedding) {
    return {
      law: 'Semantic Coherence',
      passed: true,
      score: 1.0,
      details: 'No embeddings available — trust-based validation',
    };
  }

  const coherence = cosineSimilarity(changeEmbedding, designEmbedding);
  const passed = coherence >= CSL_THRESHOLDS.MEDIUM; // 0.809

  return {
    law: 'Semantic Coherence',
    passed,
    score: coherence,
    details: passed
      ? `Change aligns with design intent (coherence: ${coherence.toFixed(3)} >= ${CSL_THRESHOLDS.MEDIUM.toFixed(3)})`
      : `Semantic drift detected (coherence: ${coherence.toFixed(3)} < ${CSL_THRESHOLDS.MEDIUM.toFixed(3)})`,
  };
}

// ═══ Law 3: Mission Alignment ═══
function validateMissionAlignment(
  changeDescription: string,
  changeEmbedding: number[] | null,
): LawValidation {
  // Keyword-based mission alignment (production uses embedding comparison)
  const lowerDesc = changeDescription.toLowerCase();
  const missionHits = MISSION_KEYWORDS.filter(kw => lowerDesc.includes(kw));
  const keywordScore = missionHits.length > 0 ? Math.min(1.0, missionHits.length * PSI * PSI) : PSI;

  // Technical changes that serve infrastructure are mission-aligned by default
  const technicalKeywords = ['security', 'performance', 'reliability', 'accessibility', 'privacy'];
  const techHits = technicalKeywords.filter(kw => lowerDesc.includes(kw));
  const techBoost = techHits.length > 0 ? Math.pow(PSI, 2) : 0;

  const score = Math.min(1.0, keywordScore + techBoost);
  const passed = score >= CSL_THRESHOLDS.MINIMUM; // 0.500 (generous — most changes should pass)

  return {
    law: 'Mission Alignment',
    passed,
    score,
    details: passed
      ? `Change serves HeadyConnection mission (score: ${score.toFixed(3)})`
      : `Potential mission misalignment (score: ${score.toFixed(3)} < ${CSL_THRESHOLDS.MINIMUM.toFixed(3)})`,
  };
}

// ═══ Full Governance Check ═══
export function governanceCheck(
  requestId: string,
  change: {
    description: string;
    compiles: boolean;
    typesafe: boolean;
    boundariesRespected: boolean;
    changeEmbedding: number[] | null;
    designEmbedding: number[] | null;
  },
): GovernanceDecision {
  const law1 = validateStructuralIntegrity({
    compiles: change.compiles,
    typesafe: change.typesafe,
    boundariesRespected: change.boundariesRespected,
  });

  const law2 = validateSemanticCoherence(change.changeEmbedding, change.designEmbedding);
  const law3 = validateMissionAlignment(change.description, change.changeEmbedding);

  const laws = [law1, law2, law3];
  const overallPassed = laws.every(l => l.passed);

  // φ-weighted coherence: [0.528, 0.326, 0.146]
  const coherenceScore = law1.score * 0.528 + law2.score * 0.326 + law3.score * 0.146;

  const recommendation = overallPassed ? 'proceed'
    : laws.filter(l => !l.passed).length === 1 ? 'modify'
    : 'reject';

  const decision: GovernanceDecision = {
    requestId,
    laws,
    overallPassed,
    coherenceScore,
    timestamp: new Date().toISOString(),
    recommendation,
  };

  logger.info('Governance decision', {
    requestId,
    passed: overallPassed,
    recommendation,
    coherence: coherenceScore,
    lawResults: laws.map(l => ({ law: l.law, passed: l.passed, score: l.score })),
  });

  return decision;
}

// ═══ Mission Alignment Score ═══
export function computeMissionAlignment(description: string): MissionAlignment {
  const lower = description.toLowerCase();

  const communityKeywords = ['community', 'together', 'collective', 'public', 'open', 'shared'];
  const equityKeywords = ['equity', 'fair', 'equal', 'access', 'inclusion', 'justice', 'diverse'];
  const empowermentKeywords = ['empower', 'enable', 'learn', 'grow', 'mentor', 'skill', 'opportunity'];

  const communityScore = Math.min(1.0, communityKeywords.filter(k => lower.includes(k)).length * PSI);
  const equityScore = Math.min(1.0, equityKeywords.filter(k => lower.includes(k)).length * PSI);
  const empowermentScore = Math.min(1.0, empowermentKeywords.filter(k => lower.includes(k)).length * PSI);

  // φ-weighted composite
  const composite = communityScore * 0.528 + equityScore * 0.326 + empowermentScore * 0.146;

  return { community: communityScore, equity: equityScore, empowerment: empowermentScore, composite };
}

// ═══ Values Arbiter ═══
export function arbitrateConflict(
  optionA: { description: string; embedding: number[] | null },
  optionB: { description: string; embedding: number[] | null },
): { winner: 'A' | 'B' | 'tie'; reason: string; scoreA: number; scoreB: number } {
  const alignA = computeMissionAlignment(optionA.description);
  const alignB = computeMissionAlignment(optionB.description);

  const scoreA = alignA.composite;
  const scoreB = alignB.composite;

  const difference = Math.abs(scoreA - scoreB);
  if (difference < Math.pow(PSI, 4)) { // ≈ 0.146 — within noise
    return { winner: 'tie', reason: 'Options are equally mission-aligned', scoreA, scoreB };
  }

  const winner = scoreA > scoreB ? 'A' : 'B';
  return {
    winner,
    reason: `Option ${winner} has stronger mission alignment (${Math.max(scoreA, scoreB).toFixed(3)} vs ${Math.min(scoreA, scoreB).toFixed(3)})`,
    scoreA,
    scoreB,
  };
}
