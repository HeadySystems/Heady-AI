/**
 * Heady™ Pipeline Stage Definitions — Canonical 21-Stage Sequence
 * ═══════════════════════════════════════════════════════════════
 *
 * Hybridizes:
 *   - hybrid-pipeline.js (21 stages, 4 variants)
 *   - pipeline-runner.js (5 stages: INGEST→DECOMPOSE→ROUTE→VALIDATE→PERSIST)
 *   - auto-success-engine.ts (13 categories)
 *
 * The 5-step HCFP maps onto the 21-stage sequence:
 *   INGEST    → CHANNEL_ENTRY + RECON + INTAKE
 *   DECOMPOSE → CLASSIFY + TRIAGE + DECOMPOSE
 *   ROUTE     → ORCHESTRATE + ARENA + JUDGE
 *   VALIDATE  → VERIFY + SELF_AWARENESS + SELF_CRITIQUE
 *   PERSIST   → RECEIPT
 *
 * @module core/pipeline/stages
 */
'use strict';

const { CSL, TIMING, PHI } = require('../constants/phi');

// ─── Stage Definitions ──────────────────────────────────────────────────────

const STAGES = Object.freeze({
  // Phase 1: INGEST
  CHANNEL_ENTRY:     { id: 0,  phase: 'INGEST',    timeout: TIMING.CONNECT, csl: CSL.INCLUDE },
  RECON:             { id: 1,  phase: 'INGEST',    timeout: TIMING.REQUEST, csl: CSL.INCLUDE },
  INTAKE:            { id: 2,  phase: 'INGEST',    timeout: TIMING.REQUEST, csl: CSL.INCLUDE },

  // Phase 2: DECOMPOSE
  CLASSIFY:          { id: 3,  phase: 'DECOMPOSE', timeout: TIMING.REQUEST, csl: CSL.BOOST },
  TRIAGE:            { id: 4,  phase: 'DECOMPOSE', timeout: TIMING.REQUEST, csl: CSL.BOOST },
  DECOMPOSE:         { id: 5,  phase: 'DECOMPOSE', timeout: TIMING.TASK,    csl: CSL.BOOST },

  // Phase 3: EXECUTE
  TRIAL_AND_ERROR:   { id: 6,  phase: 'EXECUTE',   timeout: TIMING.LONG,    csl: CSL.BOOST },
  ORCHESTRATE:       { id: 7,  phase: 'EXECUTE',   timeout: TIMING.LONG,    csl: CSL.BOOST },
  MONTE_CARLO:       { id: 8,  phase: 'EXECUTE',   timeout: TIMING.LONG,    csl: CSL.HIGH },
  ARENA:             { id: 9,  phase: 'EXECUTE',   timeout: TIMING.LONG,    csl: CSL.HIGH },
  JUDGE:             { id: 10, phase: 'EXECUTE',   timeout: TIMING.REQUEST, csl: CSL.HIGH },
  APPROVE:           { id: 11, phase: 'EXECUTE',   timeout: TIMING.MAX,     csl: CSL.CRITICAL },
  EXECUTE:           { id: 12, phase: 'EXECUTE',   timeout: TIMING.LONG,    csl: CSL.BOOST },

  // Phase 4: VALIDATE
  VERIFY:            { id: 13, phase: 'VALIDATE',  timeout: TIMING.REQUEST, csl: CSL.HIGH },
  SELF_AWARENESS:    { id: 14, phase: 'VALIDATE',  timeout: TIMING.REQUEST, csl: CSL.BOOST },
  SELF_CRITIQUE:     { id: 15, phase: 'VALIDATE',  timeout: TIMING.REQUEST, csl: CSL.BOOST },
  MISTAKE_ANALYSIS:  { id: 16, phase: 'VALIDATE',  timeout: TIMING.REQUEST, csl: CSL.BOOST },

  // Phase 5: EVOLVE
  OPTIMIZATION_OPS:  { id: 17, phase: 'EVOLVE',    timeout: TIMING.TASK,    csl: CSL.INCLUDE },
  CONTINUOUS_SEARCH: { id: 18, phase: 'EVOLVE',    timeout: TIMING.TASK,    csl: CSL.INCLUDE },
  EVOLUTION:         { id: 19, phase: 'EVOLVE',    timeout: TIMING.TASK,    csl: CSL.INCLUDE },

  // Phase 6: PERSIST
  RECEIPT:           { id: 20, phase: 'PERSIST',   timeout: TIMING.REQUEST, csl: CSL.INCLUDE },
});

const STAGE_NAMES = Object.keys(STAGES);

// ─── Variants (execution paths through the stages) ───────────────────────────

const VARIANTS = Object.freeze({
  /** Fast path: 8 stages — skip trial/arena/evolution */
  FAST: [
    'CHANNEL_ENTRY', 'RECON', 'INTAKE', 'CLASSIFY', 'TRIAGE',
    'EXECUTE', 'VERIFY', 'RECEIPT',
  ],

  /** Standard path: 13 stages — the HCFP equivalent */
  STANDARD: [
    'CHANNEL_ENTRY', 'RECON', 'INTAKE',
    'CLASSIFY', 'TRIAGE', 'DECOMPOSE',
    'ORCHESTRATE', 'EXECUTE',
    'VERIFY', 'SELF_AWARENESS', 'SELF_CRITIQUE',
    'OPTIMIZATION_OPS', 'RECEIPT',
  ],

  /** Full path: all 21 stages */
  FULL: STAGE_NAMES,

  /** Arena path: routes through multi-model competition */
  ARENA: [
    'CHANNEL_ENTRY', 'RECON', 'INTAKE', 'CLASSIFY', 'TRIAGE',
    'DECOMPOSE', 'ORCHESTRATE',
    'MONTE_CARLO', 'ARENA', 'JUDGE', 'APPROVE',
    'EXECUTE', 'VERIFY', 'SELF_AWARENESS',
    'RECEIPT',
  ],

  /** Learning path: emphasizes evolution and self-improvement */
  LEARNING: [
    'CHANNEL_ENTRY', 'INTAKE', 'CLASSIFY',
    'TRIAL_AND_ERROR', 'EXECUTE', 'VERIFY',
    'SELF_AWARENESS', 'SELF_CRITIQUE', 'MISTAKE_ANALYSIS',
    'OPTIMIZATION_OPS', 'CONTINUOUS_SEARCH', 'EVOLUTION',
    'RECEIPT',
  ],
});

// ─── Auto-Success Categories (map onto pipeline phases) ──────────────────────

const AUTO_SUCCESS_CATEGORIES = Object.freeze({
  CodeQuality:      { phase: 'VALIDATE',  stages: ['VERIFY', 'SELF_CRITIQUE'] },
  Security:         { phase: 'VALIDATE',  stages: ['VERIFY', 'MISTAKE_ANALYSIS'] },
  Performance:      { phase: 'EVOLVE',    stages: ['OPTIMIZATION_OPS'] },
  Availability:     { phase: 'INGEST',    stages: ['CHANNEL_ENTRY', 'RECON'] },
  Compliance:       { phase: 'VALIDATE',  stages: ['APPROVE', 'VERIFY'] },
  Learning:         { phase: 'EVOLVE',    stages: ['CONTINUOUS_SEARCH', 'EVOLUTION'] },
  Communication:    { phase: 'PERSIST',   stages: ['RECEIPT'] },
  Infrastructure:   { phase: 'EXECUTE',   stages: ['ORCHESTRATE'] },
  Intelligence:     { phase: 'EXECUTE',   stages: ['ARENA', 'JUDGE'] },
  DataSync:         { phase: 'PERSIST',   stages: ['RECEIPT'] },
  CostOptimization: { phase: 'EVOLVE',    stages: ['OPTIMIZATION_OPS'] },
  SelfAwareness:    { phase: 'VALIDATE',  stages: ['SELF_AWARENESS', 'SELF_CRITIQUE'] },
  Evolution:        { phase: 'EVOLVE',    stages: ['EVOLUTION'] },
});

// ─── HCFP Phase Mapping ─────────────────────────────────────────────────────

const HCFP_PHASES = Object.freeze({
  INGEST:    ['CHANNEL_ENTRY', 'RECON', 'INTAKE'],
  DECOMPOSE: ['CLASSIFY', 'TRIAGE', 'DECOMPOSE'],
  ROUTE:     ['ORCHESTRATE', 'ARENA', 'JUDGE'],
  VALIDATE:  ['VERIFY', 'SELF_AWARENESS', 'SELF_CRITIQUE'],
  PERSIST:   ['RECEIPT'],
});

/** Select variant based on task complexity and CSL confidence */
function selectVariant(complexity, confidence) {
  if (confidence >= CSL.CRITICAL && complexity <= 0.3) return 'FAST';
  if (confidence >= CSL.HIGH && complexity <= 0.5) return 'STANDARD';
  if (complexity >= 0.8) return 'FULL';
  if (confidence < CSL.BOOST) return 'LEARNING';
  return 'STANDARD';
}

module.exports = {
  STAGES,
  STAGE_NAMES,
  VARIANTS,
  AUTO_SUCCESS_CATEGORIES,
  HCFP_PHASES,
  selectVariant,
};
