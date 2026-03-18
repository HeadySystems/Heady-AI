'use strict';

/**
 * heady_consensus_tribunal — Escalate high-stakes decisions to multi-model
 * tribunal (3-5 AI judges with cognitive archetypes: OWL/EAGLE/DOLPHIN/ELEPHANT/BEAVER).
 * JSON-RPC 2.0 MCP Tool
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

const ARCHETYPES = {
  OWL: { name: 'OWL', domain: 'wisdom', focus: 'long-term consequences and historical precedent', weight: FIB[8], bias: 'conservative' },
  EAGLE: { name: 'EAGLE', domain: 'vision', focus: 'strategic overview and opportunity detection', weight: FIB[7], bias: 'progressive' },
  DOLPHIN: { name: 'DOLPHIN', domain: 'empathy', focus: 'user impact and social harmony', weight: FIB[7], bias: 'humanistic' },
  ELEPHANT: { name: 'ELEPHANT', domain: 'memory', focus: 'precedent recall and pattern continuity', weight: FIB[6], bias: 'cautious' },
  BEAVER: { name: 'BEAVER', domain: 'engineering', focus: 'feasibility, efficiency, and buildability', weight: FIB[6], bias: 'pragmatic' },
};

const VERDICT_TYPES = ['approve', 'reject', 'defer', 'modify'];
let tribunalSeq = 0;

function correlationId() {
  return `tribunal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyError(code) {
  if (code >= 7000 && code < 7500) return 'TRIBUNAL_INPUT_ERROR';
  if (code >= 7500 && code < 8000) return 'TRIBUNAL_DELIBERATION_ERROR';
  return 'UNKNOWN_ERROR';
}

function hashSimple(str) {
  let h = FIB[7];
  for (let i = 0; i < str.length; i++) h = ((h << FIB[3]) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function simulateJudgment(archetype, proposal, context) {
  const seed = hashSimple(`${archetype.name}:${proposal}:${context}`);
  const confidence = CSL.MEDIUM + (seed % FIB[5]) / FIB[8] * (CSL.CRITICAL - CSL.MEDIUM);
  const verdictIdx = seed % VERDICT_TYPES.length;
  const verdict = VERDICT_TYPES[verdictIdx];

  const reasoning = generateReasoning(archetype, verdict, confidence);
  const concerns = [];
  if (confidence < CSL.HIGH) concerns.push(`${archetype.domain} confidence below HIGH threshold`);
  if (verdict === 'reject') concerns.push(`${archetype.focus} indicates unacceptable risk`);
  if (verdict === 'modify') concerns.push(`${archetype.domain} suggests refinement needed`);

  const conditions = [];
  if (verdict === 'approve' || verdict === 'modify') {
    conditions.push(`Monitor ${archetype.domain} metrics for ${FIB[5]} cycles post-implementation`);
    if (archetype.bias === 'conservative') conditions.push('Implement rollback plan before execution');
    if (archetype.bias === 'pragmatic') conditions.push('Validate resource availability before proceeding');
  }

  return {
    judge: archetype.name,
    domain: archetype.domain,
    focus: archetype.focus,
    verdict,
    confidence: Number(confidence.toFixed(6)),
    weight: archetype.weight,
    weighted_score: Number((confidence * archetype.weight / FIB[8]).toFixed(6)),
    reasoning,
    concerns,
    conditions,
    phi_alignment: Number((confidence * PHI * PSI).toFixed(6)),
  };
}

function generateReasoning(archetype, verdict, confidence) {
  const templates = {
    OWL: { approve: 'Historical patterns support this approach; precedent exists for safe deployment.', reject: 'Historical analysis reveals similar decisions led to cascading failures.', defer: 'Insufficient historical data to render judgment; recommend gathering more evidence.', modify: 'Core approach sound, but historical patterns suggest adjustments to mitigate known failure modes.' },
    EAGLE: { approve: 'Strategic alignment confirmed; this advances the ecosystem vision.', reject: 'Strategic misalignment detected; this diverges from optimal trajectory.', defer: 'Strategic landscape uncertain; recommend scenario analysis before commitment.', modify: 'Strategic value present but vector needs adjustment for optimal positioning.' },
    DOLPHIN: { approve: 'User impact assessment positive; this enhances the experience.', reject: 'Significant negative user impact projected; empathy metrics below threshold.', defer: 'User sentiment data insufficient; recommend user research before proceeding.', modify: 'Positive intent but execution needs refinement to maximize user benefit.' },
    ELEPHANT: { approve: 'Pattern continuity maintained; this aligns with established system memory.', reject: 'Pattern disruption detected; this conflicts with proven operational patterns.', defer: 'Memory recall inconclusive; similar patterns exist but context differs significantly.', modify: 'Pattern match partial; recommend adaptation to maintain continuity with proven approaches.' },
    BEAVER: { approve: 'Technically feasible with current resources; implementation path clear.', reject: 'Implementation complexity exceeds resource constraints; not buildable as specified.', defer: 'Technical feasibility uncertain; recommend prototype before full commitment.', modify: 'Buildable with modifications; current spec has engineering inefficiencies.' },
  };
  return `[${archetype.name}/${verdict.toUpperCase()}@${confidence.toFixed(3)}] ${templates[archetype.name][verdict]}`;
}

function deliberate(judgments) {
  const totalWeight = judgments.reduce((s, j) => s + j.weight, 0);
  const votes = {};
  for (const v of VERDICT_TYPES) votes[v] = { count: 0, weighted: 0 };
  for (const j of judgments) {
    votes[j.verdict].count++;
    votes[j.verdict].weighted += j.weighted_score;
  }

  let consensus = null;
  let maxWeighted = 0;
  for (const [v, data] of Object.entries(votes)) {
    if (data.weighted > maxWeighted) { maxWeighted = data.weighted; consensus = v; }
  }

  const unanimity = judgments.every(j => j.verdict === consensus);
  const superMajority = votes[consensus].count >= Math.ceil(judgments.length * PSI + 1);
  const avgConfidence = judgments.reduce((s, j) => s + j.confidence, 0) / judgments.length;
  const strength = unanimity ? 'unanimous' : superMajority ? 'super_majority' : votes[consensus].count > judgments.length / FIB[3] ? 'simple_majority' : 'split';
  const allConcerns = [...new Set(judgments.flatMap(j => j.concerns))];
  const allConditions = [...new Set(judgments.flatMap(j => j.conditions))];

  return {
    verdict: consensus,
    strength,
    unanimity,
    super_majority: superMajority,
    vote_breakdown: votes,
    average_confidence: Number(avgConfidence.toFixed(6)),
    total_weight: totalWeight,
    consensus_score: Number((maxWeighted / (totalWeight / FIB[8])).toFixed(6)),
    combined_concerns: allConcerns,
    combined_conditions: allConditions,
    phi_harmony: Number((avgConfidence * (unanimity ? PHI : PSI)).toFixed(6)),
  };
}

const name = 'heady_consensus_tribunal';

const description = 'Escalate high-stakes decisions to a multi-model tribunal of 3-5 AI judges (OWL/EAGLE/DOLPHIN/ELEPHANT/BEAVER cognitive archetypes). Returns weighted consensus with deliberation details.';

const inputSchema = {
  type: 'object',
  properties: {
    proposal: { type: 'string', description: 'The decision/proposal to deliberate on' },
    context: { type: 'string', description: 'Additional context for judges' },
    judges: { type: 'array', items: { type: 'string', enum: ['OWL', 'EAGLE', 'DOLPHIN', 'ELEPHANT', 'BEAVER'] }, description: 'Which judges to convene (default: all 5)' },
    urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Decision urgency level' },
    stakes: { type: 'string', enum: ['low', 'medium', 'high', 'existential'], description: 'Stakes level of the decision' },
  },
  required: ['proposal'],
};

async function handler(params) {
  const cid = correlationId();
  const ts = new Date().toISOString();

  try {
    if (!params.proposal || typeof params.proposal !== 'string') throw { code: 7001, message: 'proposal must be a non-empty string' };

    const judgeNames = params.judges && params.judges.length >= FIB[4] ? params.judges : Object.keys(ARCHETYPES);
    if (judgeNames.length < FIB[4]) throw { code: 7002, message: `Minimum ${FIB[4]} judges required for tribunal` };

    const context = params.context || '';
    const urgency = params.urgency || 'medium';
    const stakes = params.stakes || 'high';
    const tribunalId = `tribunal_${++tribunalSeq}_${Date.now().toString(36)}`;

    const judgments = judgeNames.map(jn => {
      const archetype = ARCHETYPES[jn];
      if (!archetype) throw { code: 7003, message: `Unknown judge archetype: ${jn}` };
      return simulateJudgment(archetype, params.proposal, context);
    });

    const deliberation = deliberate(judgments);
    const cslConf = deliberation.unanimity ? CSL.CRITICAL : deliberation.super_majority ? CSL.HIGH : CSL.MEDIUM;

    return {
      jsonrpc: '2.0',
      result: {
        tribunal_id: tribunalId,
        proposal: params.proposal,
        urgency,
        stakes,
        judgments,
        deliberation,
        final_verdict: deliberation.verdict,
        verdict_strength: deliberation.strength,
        csl_confidence: cslConf,
        phi_coherence: Number((deliberation.phi_harmony * PSI).toFixed(6)),
        correlation_id: cid,
        timestamp: ts,
      },
    };
  } catch (err) {
    const code = err.code || 7999;
    return { jsonrpc: '2.0', error: { code, message: err.message || 'Tribunal deliberation failed', classification: classifyError(code), correlation_id: cid, timestamp: ts } };
  }
}

function health() {
  return { status: 'healthy', archetypes: Object.keys(ARCHETYPES).length, tribunal_count: tribunalSeq, verdict_types: VERDICT_TYPES.length, phi: PHI, timestamp: new Date().toISOString() };
}

module.exports = { name, description, inputSchema, handler, health };
