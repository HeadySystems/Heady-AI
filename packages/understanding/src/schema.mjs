// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Understanding Engine (HUE) — schema                       ║
// ║  The 9-lens Comprehension Schema (ADR-0030) + the Understanding    ║
// ║  Artifact shape + CSL ternary verdicts + the φ-derived act/abstain ║
// ║  threshold. © 2026 HeadySystems Inc. — Eric Haywood, Founder       ║
// ╚══════════════════════════════════════════════════════════════════╝
import { PSI, PSI2 } from "../../phi-math/src/index.mjs";

// Act/abstain threshold τ = MEDIUM CSL gate = 1 − ψ²·0.5 ≈ 0.809 (the coherence-alignment level).
// Heady may ACT on understanding ≥ τ and MUST ABSTAIN below it (ADR-0030 core directive).
export const TAU = 1 - PSI2 * 0.5;            // ≈ 0.809
export const FLOOR = 1 - PSI;                  // ≈ 0.382 — below this a claim is effectively unknown

// CSL ternary verdict over an understanding claim.
export const VERDICT = Object.freeze({ TRUE: "TRUE", UNKNOWN: "UNKNOWN", FALSE: "FALSE" });

/** Map a confidence (0..1) + contradiction flag → ternary verdict. */
export function verdictFor(confidence, contradicted = false) {
  if (contradicted) return VERDICT.FALSE;
  if (confidence >= TAU) return VERDICT.TRUE;
  return VERDICT.UNKNOWN;
}

// The 9 lenses (the founder's question-set, formalized). Each declares the evidence fields it needs;
// confidence is the fraction present, penalized when no rebuttal was considered (the STRESS pass).
// `loadBearing` lenses gate the overall act/abstain decision.
export const LENSES = Object.freeze([
  { id: "mechanism",   loadBearing: true,  needs: ["inputs", "process", "outputs"],     q: "how does it work? what does it do?" },
  { id: "causality",   loadBearing: true,  needs: ["conditions", "chain"],              q: "how/why is it possible? is it happening?" },
  { id: "teleology",   loadBearing: false, needs: ["purpose", "breaksWithout"],         q: "why should it be around? why does it do it?" },
  { id: "relations",   loadBearing: true,  needs: ["upstream", "downstream"],           q: "how is it involved?" },
  { id: "effect",      loadBearing: false, needs: ["internal", "external"],             q: "internal / external effects?" },
  { id: "blastRadius", loadBearing: true,  needs: ["nodes"],                            q: "blast radius? significance — to where/what?" },
  { id: "normativity", loadBearing: false, needs: ["benefits", "risks"],               q: "good? bad? why / why not?" },
  { id: "agency",      loadBearing: false, needs: ["modelsGoals", "adapts", "predicts"], q: "is it intelligent?" },
  { id: "evidence",    loadBearing: true,  needs: ["sources"],                          q: "how do we know? (confidence)" },
]);

export const ACT = Object.freeze({ ACT: "ACT", ABSTAIN: "ABSTAIN" });
