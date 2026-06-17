// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Auto-Context Enrichment v2.0.0                            ║
// ║  The SYSTEMIC pre-reasoning procedure (NOT an opt-in skill).      ║
// ║  Realizes Unbreakable Law 4 (Context Maximization) + Master       ║
// ║  Directive 1 (Omnipresent Contextual Awareness): every reasoning  ║
// ║  stage is fed CSL-ranked live ecosystem state before it runs.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder · ⚠️ PATENT zone ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// WHAT.  Given a task signal (text + optional embedding), retrieve the most
//        semantically-relevant context fragments from live awareness channels
//        (vector memory, filesystem index, git/health/event state) and rank
//        them by CSL cosine similarity, returning a bounded, deduplicated,
//        φ-budgeted context capsule.
// WHY.   No decision is made on partial state. This is the single enforcement
//        point that makes "context-first" a property of the system, not a
//        behaviour an agent may choose to skip.
// HOW.   enrichForStage / enrichForBattle / enrichForCouncil wrap a retriever,
//        CSL-gate each candidate at a stage-appropriate threshold, dedupe at
//        DEDUP_THRESHOLD, and cap the capsule at a Fibonacci item budget.
// WHERE. Imported by gateway-middleware.mjs (wrapGateway) and HCFullPipeline
//        stage 00 CHANNEL_ENTRY. Runtime-enforced; CI-verified by
//        tooling/enforcers/autocontext.mjs.

import { createLogger } from "@heady/logger";
import { cosineSimilarity, DIM } from "@heady/csl-engine";
import { assertEmbedding } from "@heady/db";
import { ValidationError } from "@heady/shared";
import { CSL_THRESHOLDS, FIB, DEDUP_THRESHOLD } from "@heady/phi-math";

const log = createLogger({ base: { component: "auto-context-enrichment" } });

/**
 * Per-context-class CSL gate + capsule item budget.
 * Budgets are Fibonacci (Sacred-Geometry aligned); gates are φ-derived
 * CSL_THRESHOLDS. A higher-stakes class demands higher relevance and a
 * tighter capsule (less noise reaches a costly council/judge).
 */
export const ENRICH_PROFILES = Object.freeze({
  // Stage-level enrichment (HCFullPipeline 00 CHANNEL_ENTRY default).
  stage: Object.freeze({ gate: CSL_THRESHOLDS.LOW, budget: FIB[8] }), //   ≥0.691, 21 items
  // Arena/battle candidates compete — moderate relevance, broader capsule.
  battle: Object.freeze({ gate: CSL_THRESHOLDS.MEDIUM, budget: FIB[7] }), // ≥0.809, 13 items
  // Multi-model council — highest relevance bar, smallest, densest capsule.
  council: Object.freeze({ gate: CSL_THRESHOLDS.HIGH, budget: FIB[6] }), //  ≥0.882, 8 items
});

// Native validation (the workspace deliberately avoids an external schema dep — every package
// guards with @heady/shared errors + @heady/db assertEmbedding so the 384-dim lock is enforced
// in exactly one place). DIM is re-exported here only to document the contract at the boundary.
export { DIM };

/** Validate + normalize a retrieved candidate fragment. Throws ValidationError on bad shape. */
function parseFragment(raw) {
  if (!raw || typeof raw !== "object") throw new ValidationError("fragment must be an object");
  const { id, content, embedding, source, metadata } = raw;
  if (typeof id !== "string" || id.length === 0) throw new ValidationError("fragment.id required");
  if (typeof content !== "string") throw new ValidationError("fragment.content must be a string");
  if (typeof source !== "string" || source.length === 0) throw new ValidationError("fragment.source required");
  assertEmbedding(embedding); // 384-dim, finite — single source of truth
  return { id, content, embedding, source, metadata: metadata && typeof metadata === "object" ? metadata : {} };
}

/** Validate + normalize the incoming task signal. */
function parseTask(raw) {
  if (!raw || typeof raw !== "object") throw new ValidationError("task must be an object");
  const { text, embedding, traceId } = raw;
  if (typeof text !== "string" || text.length === 0) throw new ValidationError("task.text required");
  assertEmbedding(embedding);
  return { text, embedding, traceId: typeof traceId === "string" ? traceId : undefined };
}

/**
 * A retriever pulls candidate fragments from the live awareness channels.
 * It MUST be injected (no hardcoded hosts / no hidden global state): the caller
 * wires it to @heady/auto-context VectorizeProjector reads, the fs indexer,
 * git/health snapshots, etc.
 * @typedef {{ retrieve: (task: {text:string,embedding:number[]}, opts:{limit:number}) => Promise<Array<object>> }} Retriever
 */

/**
 * ContextEnricher — the systemic enrichment engine.
 * Stateless aside from its injected retriever; deterministic ranking.
 */
export class ContextEnricher {
  /** @param {{ retriever: Retriever }} params */
  constructor({ retriever }) {
    if (!retriever || typeof retriever.retrieve !== "function") {
      throw new TypeError("ContextEnricher: retriever with .retrieve() is required");
    }
    this.retriever = retriever;
  }

  /**
   * Core enrichment. Retrieve → CSL-rank → gate → dedupe → φ-budget.
   * @param {object} task          { text, embedding, traceId? }
   * @param {keyof typeof ENRICH_PROFILES} profileName
   * @returns {Promise<{ profile:string, gate:number, budget:number,
   *   items:Array<{id:string,content:string,source:string,score:number,metadata:object}>,
   *   considered:number, gated:number, deduped:number, coherence:number }>}
   */
  async enrich(task, profileName) {
    const t = parseTask(task);
    const profile = ENRICH_PROFILES[profileName];
    if (!profile) throw new RangeError(`enrich: unknown profile "${profileName}"`);
    const l = log.child({ profile: profileName, traceId: t.traceId, gate: profile.gate });

    // Over-fetch (φ-headroom) so gating/dedup still leaves a full capsule.
    const limit = Math.round(profile.budget * 2);
    const candidates = await this.retriever.retrieve(
      { text: t.text, embedding: t.embedding },
      { limit },
    );
    l.info({ considered: candidates.length, limit }, "retrieved candidates for enrichment");

    // CSL relevance score every candidate against the task embedding.
    const scored = [];
    for (const raw of candidates) {
      const frag = parseFragment(raw);
      const score = cosineSimilarity(t.embedding, frag.embedding);
      scored.push({ frag, score });
    }
    scored.sort((a, b) => b.score - a.score);

    // CSL gate: drop anything below the profile relevance bar (glass-box: counted).
    const gated = scored.filter((s) => s.score >= profile.gate);

    // Semantic dedupe: keep the highest-scoring of any near-duplicate pair.
    const kept = [];
    let deduped = 0;
    for (const cand of gated) {
      const dup = kept.find(
        (k) => cosineSimilarity(k.frag.embedding, cand.frag.embedding) >= DEDUP_THRESHOLD,
      );
      if (dup) { deduped += 1; continue; }
      kept.push(cand);
      if (kept.length >= profile.budget) break;
    }

    const items = kept.map((k) => ({
      id: k.frag.id,
      content: k.frag.content,
      source: k.frag.source,
      score: Number(k.score.toFixed(6)),
      metadata: k.frag.metadata,
    }));

    // Capsule coherence = mean relevance of retained items (0 when empty).
    const coherence = items.length
      ? Number((items.reduce((sum, i) => sum + i.score, 0) / items.length).toFixed(6))
      : 0;

    l.info(
      { considered: candidates.length, gated: gated.length, deduped, kept: items.length, coherence },
      "enrichment complete",
    );

    return {
      profile: profileName,
      gate: profile.gate,
      budget: profile.budget,
      items,
      considered: candidates.length,
      gated: gated.length,
      deduped,
      coherence,
    };
  }

  /** HCFullPipeline stage-level enrichment (00 CHANNEL_ENTRY → "auth + AutoContext"). */
  enrichForStage(task) { return this.enrich(task, "stage"); }

  /** Arena/Battle candidate enrichment (HCFP stage 09 ARENA, battle-arena-v2). */
  enrichForBattle(task) { return this.enrich(task, "battle"); }

  /** Multi-model Council enrichment (Directive 09, consensus-tribunal). */
  enrichForCouncil(task) { return this.enrich(task, "council"); }
}
