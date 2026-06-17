// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Perspective — Semantic scorer (CSL cosine) v1.0.0         ║
// ║  Role/task fit via CSL-gated cosine over the locked embedder        ║
// ║  (@cf/baai/bge-small-en-v1.5). Real embeddings only — no fakes;     ║
// ║  null embedder ⇒ caller falls back to lexical. Reuses csl-engine +  ║
// ║  the canonical embed-corpus embedder. © 2026 HeadySystems          ║
// ╚══════════════════════════════════════════════════════════════════╝
import { cosineSimilarity, cslGate } from '../../csl-engine/src/index.mjs';
// NOTE: the canonical .mjs embedder lives in embed-corpus; relocate to @heady/embedding when that ships
// as ESM. resolveEmbedder returns null when no Cloudflare/HF token is present (→ lexical fallback).
import { resolveEmbedder } from '../../../tooling/embed-corpus/src/embedder.mjs';

/** The locked embedder, or null when no token is configured (fail-safe → lexical mode). */
export function getEmbedder(env = process.env) {
  try { return resolveEmbedder(env); } catch { return null; }
}

/** Batch-embed texts → vectors[] (empty when no embedder). */
export async function embedTexts(embedder, texts) {
  if (!embedder || !texts || !texts.length) return [];
  return embedder.embed(texts);
}

/** CSL cosine similarity ∈ [0,1] (cslAND) between a task vector and a role vector. */
export function semanticScore(taskVec, roleVec) {
  if (!Array.isArray(taskVec) || !Array.isArray(roleVec)) return 0;
  const cos = cosineSimilarity(taskVec, roleVec);
  return Math.max(0, Number.isFinite(cos) ? cos : 0);
}

/** Ternary CSL gate verdict for a similarity score (EXECUTE / ABSTAIN / REJECT). */
export function gateVerdict(score, tau) {
  return cslGate(score, score, tau);
}
