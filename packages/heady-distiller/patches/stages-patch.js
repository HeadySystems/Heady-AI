// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: packages/heady-distiller/patches/stages-patch.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';
/**
 * HeadyDistiller — stages-patch.js (CJS)
 * ========================================
 * PATCH FILE: Shows the exact additions to core/pipeline/stages.js to
 * register Stage 22 DISTILL (index 21) in the HCFullPipeline.
 *
 * Usage:
 *   const patch = require('./patches/stages-patch.js');
 *   // Inspect patch.DISTILL_STAGE, patch.STAGE_NAMES, patch.VARIANTS, patch.diffInstructions
 *
 * All constants phi-derived. Zero placeholders. Zero TODOs.
 */

// ─── Phi-math constants (mirrors core/pipeline/stages.js values) ──────────────
const PHI  = 1.618033988749895;
const PSI  = 0.618033988749895;
const PSI2 = 0.381966011250105;

const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// CSL gate values (matches existing CSL object in stages.js)
const CSL = {
  SUPPRESS : 0.236,
  INCLUDE  : PSI2,   // 0.382
  MINIMUM  : 0.500,
  BOOST    : PSI,    // 0.618
  INJECT   : 0.718,
  MEDIUM   : 0.809,
  HIGH     : 0.882,
  CRITICAL : 0.927,
  DEDUP    : 0.972,
};

// TIMING values (mirrors core/pipeline/stages.js)
// Note: The spec's canonical patch references FIB[10] * FIB[6] = 89 * 13 = 1157ms
// using a 1-indexed Fibonacci sequence. In our 0-indexed FIB array (FIB[0]=0),
// the equivalent is FIB[11] * FIB[7] = 89 * 13 = 1157ms.
const TIMING = {
  FAST       : FIB[8]  * FIB[6],   //  21 *  8 =  168ms
  STANDARD   : FIB[9]  * FIB[7],   //  34 * 13 =  442ms
  TASK       : FIB[11] * FIB[7],   //  89 * 13 = 1157ms  (spec: FIB[10]*FIB[6] in 1-indexed)
  EXTENDED   : FIB[11] * FIB[8],   //  89 * 21 = 1869ms
  BACKGROUND : FIB[12] * FIB[8],   // 144 * 21 = 3024ms
};

// ─── DISTILL stage definition ─────────────────────────────────────────────────
/**
 * DISTILL_STAGE — add this object to the STAGES array in core/pipeline/stages.js
 * at index position 21 (appended after SelfHealCheck at index 20).
 *
 * Matches the existing stage shape:
 *   { id: <number>, phase: <string>, timeout: <ms>, csl: <threshold> }
 */
// FIB[8] = 21 — this is both the numeric value 21 and stage index 21. Perfect phi alignment.
const DISTILL_STAGE_FINAL = {
  id     : FIB[8],           // 21 — stage index 21 (FIB[8]=21)
  phase  : 'DISTILL',
  timeout: TIMING.TASK,      // FIB[11] * FIB[7] = 89 * 13 = 1157ms (0-indexed FIB)
  csl    : CSL.INCLUDE,      // PSI2 = 0.382 — intelligence capture, non-blocking
};

// ─── Updated STAGE_NAMES array ────────────────────────────────────────────────
/**
 * Full 22-element STAGE_NAMES array.
 * Positions 0-20 are the existing pipeline stages.
 * Position 21 adds 'DISTILL'.
 *
 * In core/pipeline/stages.js, replace the existing STAGE_NAMES export with this.
 */
const STAGE_NAMES = [
  'ContextAssembly',    // index  0
  'IntentClassify',     // index  1
  'NodeSelect',         // index  2
  'PlanBuild',          // index  3
  'ToolResolve',        // index  4
  'MemoryFetch',        // index  5
  'ContextEnrich',      // index  6
  'SafetyCheck',        // index  7
  'Execute',            // index  8
  'ToolCall',           // index  9
  'StreamCollect',      // index 10
  'ResponseAssemble',   // index 11
  'QualityGate',        // index 12
  'Judge',              // index 13
  'HeadyCheck',         // index 14
  'HeadyAssure',        // index 15
  'PatternCapture',     // index 16
  'StoryUpdate',        // index 17
  'VectorStore',        // index 18
  'TelemetryEmit',      // index 19
  'SelfHealCheck',      // index 20
  'DISTILL',            // index 21  ← NEW
];

// ─── Updated VARIANTS ─────────────────────────────────────────────────────────
/**
 * Variant → stage list map.
 *
 * Rules:
 *   FULL     — includes DISTILL (full execution + distillation)
 *   LEARNING — includes DISTILL (learning paths require distillation)
 *   ARENA    — includes DISTILL (evaluation arena benefits from recipe capture)
 *   STANDARD — does NOT include DISTILL (standard path skips distillation)
 *   FAST     — does NOT include DISTILL (fast path skips distillation)
 *
 * Replace the existing VARIANTS export in core/pipeline/stages.js with this.
 */
const VARIANTS = {
  FULL: [
    'ContextAssembly',
    'IntentClassify',
    'NodeSelect',
    'PlanBuild',
    'ToolResolve',
    'MemoryFetch',
    'ContextEnrich',
    'SafetyCheck',
    'Execute',
    'ToolCall',
    'StreamCollect',
    'ResponseAssemble',
    'QualityGate',
    'Judge',
    'HeadyCheck',
    'HeadyAssure',
    'PatternCapture',
    'StoryUpdate',
    'VectorStore',
    'TelemetryEmit',
    'SelfHealCheck',
    'DISTILL',          // ← NEW (last stage in FULL)
  ],

  LEARNING: [
    'ContextAssembly',
    'IntentClassify',
    'NodeSelect',
    'PlanBuild',
    'ToolResolve',
    'MemoryFetch',
    'ContextEnrich',
    'SafetyCheck',
    'Execute',
    'ToolCall',
    'StreamCollect',
    'ResponseAssemble',
    'QualityGate',
    'Judge',
    'HeadyCheck',
    'PatternCapture',
    'StoryUpdate',
    'VectorStore',
    'TelemetryEmit',
    'SelfHealCheck',
    'DISTILL',          // ← NEW (last stage in LEARNING)
  ],

  ARENA: [
    'ContextAssembly',
    'IntentClassify',
    'NodeSelect',
    'Execute',
    'ToolCall',
    'StreamCollect',
    'ResponseAssemble',
    'QualityGate',
    'Judge',
    'HeadyCheck',
    'HeadyAssure',
    'TelemetryEmit',
    'SelfHealCheck',
    'DISTILL',          // ← NEW (last stage in ARENA)
  ],

  // STANDARD — distillation does NOT run on standard paths
  STANDARD: [
    'ContextAssembly',
    'IntentClassify',
    'NodeSelect',
    'PlanBuild',
    'ToolResolve',
    'MemoryFetch',
    'Execute',
    'ToolCall',
    'StreamCollect',
    'ResponseAssemble',
    'QualityGate',
    'TelemetryEmit',
    'SelfHealCheck',
    // DISTILL deliberately excluded
  ],

  // FAST — distillation does NOT run on fast paths
  FAST: [
    'ContextAssembly',
    'IntentClassify',
    'Execute',
    'ToolCall',
    'StreamCollect',
    'ResponseAssemble',
    'QualityGate',
    // DISTILL deliberately excluded
  ],
};

// ─── Diff instructions ────────────────────────────────────────────────────────
/**
 * Human-readable diff showing exactly what to add/modify in
 * core/pipeline/stages.js
 *
 * Each entry has:
 *   file     — target file
 *   action   — 'add' | 'modify' | 'append'
 *   location — description of where in the file
 *   before   — existing code (null for pure additions)
 *   after    — replacement code
 */
const diffInstructions = [
  {
    file    : 'core/pipeline/stages.js',
    action  : 'append',
    location: 'After the last stage in the STAGES array (index 20 SelfHealCheck)',
    before  : null,
    after   : `
  // Stage 22 — DISTILL (index 21) — added by heady-distiller patch
  {
    id     : FIB[8],          // 21
    phase  : 'DISTILL',
    timeout: TIMING.TASK,     // FIB[11] * FIB[7] = 89 * 13 = 1157ms (0-indexed FIB)
    csl    : CSL.INCLUDE,     // PSI2 = 0.382
  },`,
  },
  {
    file    : 'core/pipeline/stages.js',
    action  : 'modify',
    location: 'STAGE_NAMES array export — append DISTILL as last element',
    before  : `  'SelfHealCheck',      // index 20
];`,
    after   : `  'SelfHealCheck',      // index 20
  'DISTILL',            // index 21  — added by heady-distiller patch
];`,
  },
  {
    file    : 'core/pipeline/stages.js',
    action  : 'modify',
    location: 'VARIANTS.FULL array — append DISTILL as last stage',
    before  : `    'SelfHealCheck',
  ],  // end FULL`,
    after   : `    'SelfHealCheck',
    'DISTILL',          // added by heady-distiller patch
  ],  // end FULL`,
  },
  {
    file    : 'core/pipeline/stages.js',
    action  : 'modify',
    location: 'VARIANTS.LEARNING array — append DISTILL as last stage',
    before  : `    'SelfHealCheck',
  ],  // end LEARNING`,
    after   : `    'SelfHealCheck',
    'DISTILL',          // added by heady-distiller patch
  ],  // end LEARNING`,
  },
  {
    file    : 'core/pipeline/stages.js',
    action  : 'modify',
    location: 'VARIANTS.ARENA array — append DISTILL as last stage',
    before  : `    'SelfHealCheck',
  ],  // end ARENA`,
    after   : `    'SelfHealCheck',
    'DISTILL',          // added by heady-distiller patch
  ],  // end ARENA`,
  },
  {
    file    : 'core/pipeline/stages.js',
    action  : 'none',
    location: 'VARIANTS.STANDARD — no change (DISTILL excluded from STANDARD)',
    before  : null,
    after   : null,
    note    : 'STANDARD and FAST variants deliberately do not include DISTILL. ' +
              'Distillation only runs on FULL, LEARNING, and ARENA paths.',
  },
];

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // PHI constants exposed for validation
  PHI,
  PSI,
  PSI2,
  FIB,
  CSL,
  TIMING,

  // Core patch data
  DISTILL_STAGE      : DISTILL_STAGE_FINAL,
  STAGE_NAMES,
  VARIANTS,
  diffInstructions,

  // Convenience: stage count after patch
  TOTAL_STAGES       : STAGE_NAMES.length,               // 22
  DISTILL_INDEX      : STAGE_NAMES.indexOf('DISTILL'),   // 21

  // Variants that include DISTILL
  DISTILL_VARIANTS   : Object.entries(VARIANTS)
    .filter(([, stages]) => stages.includes('DISTILL'))
    .map(([name]) => name),
  // → ['FULL', 'LEARNING', 'ARENA']

  // Variants that exclude DISTILL
  NO_DISTILL_VARIANTS: Object.entries(VARIANTS)
    .filter(([, stages]) => !stages.includes('DISTILL'))
    .map(([name]) => name),
  // → ['STANDARD', 'FAST']
};
