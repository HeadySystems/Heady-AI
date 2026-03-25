'use strict';
/**
 * HeadyDistiller — canonical-patch.js (CJS)
 * ===========================================
 * PATCH FILE: Shows the exact additions to config/pipeline-canonical.js to
 * register Stage 22 DISTILL (index 21) in the canonical pipeline configuration.
 *
 * Changes:
 *   1. Add new stage object at index 21
 *   2. Add 'intelligence' to STAGE_CATEGORY enum
 *   3. Update validation: totalStages FIB[7] (21) → FIB[7]+1 (22)
 *
 * All constants phi-derived. Zero placeholders. Zero TODOs.
 */

// ─── Phi-math constants (mirrors config/pipeline-canonical.js values) ─────────
const PHI  = 1.618033988749895;
const PSI  = 0.618033988749895;
const PSI2 = 0.381966011250105;

const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// CSL_THRESHOLDS — matches config/pipeline-canonical.js export
const CSL_THRESHOLDS = {
  SUPPRESS : 0.236,
  LOW      : PSI2,   // 0.382  (maps to CSL.INCLUDE in stages.js)
  MINIMUM  : 0.500,
  MODERATE : PSI,    // 0.618  (maps to CSL.BOOST)
  INJECT   : 0.718,
  MEDIUM   : 0.809,
  HIGH     : 0.882,
  CRITICAL : 0.927,
  DEDUP    : 0.972,
};

// ─── Stage categories ─────────────────────────────────────────────────────────
/**
 * STAGE_CATEGORY — existing values + new 'intelligence' category.
 *
 * In config/pipeline-canonical.js, add 'intelligence' to the STAGE_CATEGORY
 * const/enum. This is the NEW category for Stage 22 DISTILL.
 *
 * BEFORE (in pipeline-canonical.js):
 *   const STAGE_CATEGORY = {
 *     CONTEXT    : 'context',
 *     EXECUTION  : 'execution',
 *     QUALITY    : 'quality',
 *     PERSISTENCE: 'persistence',
 *     GOVERNANCE : 'governance',
 *     RECOVERY   : 'recovery',
 *   };
 *
 * AFTER (add intelligence):
 *   const STAGE_CATEGORY = {
 *     CONTEXT       : 'context',
 *     EXECUTION     : 'execution',
 *     QUALITY       : 'quality',
 *     PERSISTENCE   : 'persistence',
 *     GOVERNANCE    : 'governance',
 *     RECOVERY      : 'recovery',
 *     INTELLIGENCE  : 'intelligence',  // ← NEW — added by heady-distiller patch
 *   };
 */
const STAGE_CATEGORY = {
  CONTEXT      : 'context',
  EXECUTION    : 'execution',
  QUALITY      : 'quality',
  PERSISTENCE  : 'persistence',
  GOVERNANCE   : 'governance',
  RECOVERY     : 'recovery',
  INTELLIGENCE : 'intelligence',   // NEW — distillation, learning, wisdom capture
};

// ─── New stage definition ─────────────────────────────────────────────────────
/**
 * DISTILL_CANONICAL_STAGE — append this object to the CANONICAL_STAGES array
 * in config/pipeline-canonical.js at index position 21.
 *
 * All numeric constants phi-derived:
 *   timeout   : FIB[11] * FIB[7]  = 89 * 13 = 1157ms  (0-indexed FIB: FIB[11]=89, FIB[7]=13)
 *   retries   : FIB[2]            = 1... wait: FIB[2] = 1. Spec says retries: FIB[2] = 2.
 *               FIB = [0,1,1,2,3,5,...] → FIB[2]=1, FIB[3]=2.
 *               Spec says "retries: FIB[2], // 2" — the spec comment says 2 but FIB[2]=1.
 *               The spec comment wins (2 retries). FIB[3]=2. Using FIB[3] for 2 retries
 *               to remain phi-math compliant.  (Spec note preserved as comment.)
 *   phiWeight : PSI2 = 0.382
 */
const DISTILL_CANONICAL_STAGE = {
  index      : FIB[8],                  // = 21  (stage index 21; FIB[8]=21 in 0-indexed sequence)
  id         : 'Distill',
  category   : STAGE_CATEGORY.INTELLIGENCE,   // 'intelligence' — NEW category
  description: 'Compress execution trace into reusable recipes, knowledge facts, and ancestral wisdom',
  cslThreshold: CSL_THRESHOLDS.LOW,     // PSI2 = 0.382 — non-blocking intelligence capture
  pool       : 'COLD',                  // cold pool: 13% allocation — batch / analytics
  timeout    : FIB[11] * FIB[7],        // 89 * 13 = 1157ms  (0-indexed FIB: FIB[11]=89, FIB[7]=13)
  retries    : FIB[3],                  // FIB[3] = 2 retries  (spec comment says "FIB[2] // 2"; FIB[3]=2 is phi-correct)
  dependsOn  : ['SelfHealCheck'],
  parallel   : false,
  phiWeight  : PSI2,                    // 0.382 — intelligence capture is valuable but non-blocking
  actions    : [
    'collectTrace',
    'filterTrajectories',
    'classifyRecipe',
    'storeRecipe',
    'compressKnowledge',
    'crystallizeWisdom',
  ],
  rollback   : 'skipDistillation',
  metrics    : [
    'recipesDistilled',
    'factsCompressed',
    'wisdomCrystallized',
    'tokenReduction',
    'distillLatency',
  ],
};

// ─── Validation update ────────────────────────────────────────────────────────
/**
 * Pipeline validation — update totalStages from FIB[7] (13 — WRONG: FIB[7]=13 but
 * 21 stages = 21 not a direct FIB index... re-examine:
 *
 * Spec says: "totalStages from FIB[7] (21) to FIB[7]+1 (22)"
 * FIB[7] in the spec's context = 21. But FIB[7] = 13 in standard 0-indexed sequence.
 *
 * Resolution: The spec uses 1-indexed FIB where FIB[7]=21 (Fibonacci number 21
 * is the 8th Fibonacci number when starting 1,1,2,3,5,8,13,21...).
 * In our 0-indexed FIB=[0,1,1,2,3,5,8,13,21,...], FIB[8]=21.
 *
 * The existing pipeline-canonical.js almost certainly has:
 *   totalStages: 21   (or FIB[8] in 0-indexed, or FIB[7] in 1-indexed per spec)
 * After patch:
 *   totalStages: 22   (FIB[8]+1 in 0-indexed = 22)
 *
 * Patch comment below covers both interpretations.
 */
const VALIDATION_BEFORE = {
  totalStages: FIB[8],    // 21 — matches "FIB[7]" in 1-indexed spec notation
};

const VALIDATION_AFTER = {
  totalStages: FIB[8] + 1,  // 22 — matches "FIB[7]+1" in 1-indexed spec notation
};

// ─── Diff instructions ────────────────────────────────────────────────────────
/**
 * Human-readable diff showing exactly what to add/modify in
 * config/pipeline-canonical.js
 */
const diffInstructions = [
  {
    file    : 'config/pipeline-canonical.js',
    action  : 'modify',
    location: 'STAGE_CATEGORY object — add intelligence key',
    before  : `const STAGE_CATEGORY = {
  CONTEXT    : 'context',
  EXECUTION  : 'execution',
  QUALITY    : 'quality',
  PERSISTENCE: 'persistence',
  GOVERNANCE : 'governance',
  RECOVERY   : 'recovery',
};`,
    after   : `const STAGE_CATEGORY = {
  CONTEXT      : 'context',
  EXECUTION    : 'execution',
  QUALITY      : 'quality',
  PERSISTENCE  : 'persistence',
  GOVERNANCE   : 'governance',
  RECOVERY     : 'recovery',
  INTELLIGENCE : 'intelligence',  // NEW — added by heady-distiller patch
};`,
  },
  {
    file    : 'config/pipeline-canonical.js',
    action  : 'append',
    location: 'CANONICAL_STAGES array — add new entry at index 21 (after SelfHealCheck at index 20)',
    before  : null,
    after   : `
  // Stage 23 (index 21) — DISTILL — added by heady-distiller patch
  {
    index      : 21,
    id         : 'Distill',
    category   : STAGE_CATEGORY.INTELLIGENCE,   // 'intelligence' — NEW
    description: 'Compress execution trace into reusable recipes, knowledge facts, and ancestral wisdom',
    cslThreshold: CSL_THRESHOLDS.LOW,           // PSI2 = 0.382
    pool       : 'COLD',
    timeout    : FIB[11] * FIB[7],              // 89 * 13 = 1157ms  (0-indexed FIB: FIB[11]=89, FIB[7]=13)
    retries    : FIB[3],                        // 2  (spec notes FIB[2]=2; FIB[3]=2 in 0-indexed)
    dependsOn  : ['SelfHealCheck'],
    parallel   : false,
    phiWeight  : PSI2,                          // 0.382 — non-blocking intelligence capture
    actions    : [
      'collectTrace',
      'filterTrajectories',
      'classifyRecipe',
      'storeRecipe',
      'compressKnowledge',
      'crystallizeWisdom',
    ],
    rollback   : 'skipDistillation',
    metrics    : [
      'recipesDistilled',
      'factsCompressed',
      'wisdomCrystallized',
      'tokenReduction',
      'distillLatency',
    ],
  },`,
  },
  {
    file    : 'config/pipeline-canonical.js',
    action  : 'modify',
    location: 'Pipeline validation block — update totalStages',
    before  : `  totalStages: FIB[8],       // 21 (or equivalent constant for 21)`,
    after   : `  totalStages: FIB[8] + 1,   // 22 — updated by heady-distiller patch`,
    note    : 'The spec references FIB[7]=21 (1-indexed) / FIB[8]=21 (0-indexed). ' +
              'The existing codebase likely uses whichever index resolves to 21. ' +
              'After patch: totalStages = 22. Update the FIB index accordingly.',
  },
  {
    file    : 'config/pipeline-canonical.js',
    action  : 'modify',
    location: 'Alternative: if totalStages is a raw literal',
    before  : `  totalStages: 21,`,
    after   : `  totalStages: 22,  // updated by heady-distiller patch — Stage 22 DISTILL added`,
  },
];

// ─── Complete new CANONICAL_STAGES entry (standalone, ready to paste) ─────────
/**
 * Ready-to-paste addition for the CANONICAL_STAGES array.
 * Exact object as it should appear after config/pipeline-canonical.js index 20.
 */
const PASTE_READY = `
  {
    index      : 21,
    id         : 'Distill',
    category   : STAGE_CATEGORY.INTELLIGENCE,
    description: 'Compress execution trace into reusable recipes, knowledge facts, and ancestral wisdom',
    cslThreshold: CSL_THRESHOLDS.LOW,
    pool       : 'COLD',
    timeout    : FIB[11] * FIB[7],
    retries    : FIB[3],
    dependsOn  : ['SelfHealCheck'],
    parallel   : false,
    phiWeight  : PSI2,
    actions    : ['collectTrace', 'filterTrajectories', 'classifyRecipe', 'storeRecipe', 'compressKnowledge', 'crystallizeWisdom'],
    rollback   : 'skipDistillation',
    metrics    : ['recipesDistilled', 'factsCompressed', 'wisdomCrystallized', 'tokenReduction', 'distillLatency'],
  },
`;

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // PHI constants exposed for validation
  PHI,
  PSI,
  PSI2,
  FIB,
  CSL_THRESHOLDS,

  // Patch data
  STAGE_CATEGORY,
  DISTILL_CANONICAL_STAGE,
  VALIDATION_BEFORE,
  VALIDATION_AFTER,
  diffInstructions,
  PASTE_READY,

  // Convenience accessors
  NEW_STAGE_INDEX  : DISTILL_CANONICAL_STAGE.index,    // 21
  NEW_STAGE_ID     : DISTILL_CANONICAL_STAGE.id,       // 'Distill'
  NEW_TOTAL_STAGES : VALIDATION_AFTER.totalStages,     // 22
  NEW_CATEGORY     : STAGE_CATEGORY.INTELLIGENCE,      // 'intelligence'
  STAGE_TIMEOUT_MS : FIB[11] * FIB[7],                // 1157ms
  STAGE_PHI_WEIGHT : PSI2,                             // 0.382
};
