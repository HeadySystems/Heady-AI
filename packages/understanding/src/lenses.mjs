// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Understanding Engine — the lens library                   ║
// ║  One function per lens. Each grades the evidence it was given,     ║
// ║  pulls from a Heady organ when available (coherence map/ripple),   ║
// ║  applies the adversarial STRESS penalty, and returns a graded      ║
// ║  finding. Honest UNKNOWN (with `wire`) where an organ isn't yet    ║
// ║  connected — never a fabricated answer. © 2026 HeadySystems        ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { PSI } from "../../phi-math/src/index.mjs";
import { LENSES, verdictFor } from "./schema.mjs";

const ROOT = resolve(new URL("../../..", import.meta.url).pathname);
const readJson = (rel) => { try { return JSON.parse(readFileSync(join(ROOT, rel), "utf8")); } catch { return null; } };

/** Base confidence = fraction of a lens's needed fields that are present + non-empty in `data`. */
function completeness(needs, data) {
  if (!data || typeof data !== "object") return 0;
  const present = needs.filter((k) => {
    const v = data[k];
    return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
  });
  return present.length / needs.length;
}

/** Organ wiring: derive a subject's relations + blast-radius from the coherence System Map / ripple. */
function coherenceOrgan(subject) {
  const map = readJson(".data/coherence/system-map.json");
  const ripple = readJson(".data/coherence/ripple.json");
  const out = { upstream: [], downstream: [], nodes: [], source: null };
  if (map?.edges) {
    const s = String(subject).toLowerCase();
    const match = (id) => String(id).toLowerCase().includes(s);
    for (const e of map.edges) {
      if (match(e.from)) out.downstream.push(e.to);
      if (match(e.to)) out.upstream.push(e.from);
    }
    if (out.upstream.length || out.downstream.length) out.source = ".data/coherence/system-map.json";
  }
  if (Array.isArray(ripple?.nodes)) {
    out.nodes = ripple.nodes.filter((n) => String(n).toLowerCase().includes(String(subject).toLowerCase()));
    if (out.nodes.length) out.source = (out.source ? out.source + " + " : "") + ".data/coherence/ripple.json";
  }
  return out;
}

/**
 * Run one lens. Returns { lens, q, verdict, confidence, finding, evidence[], unknowns[], wire? }.
 * `ev` = the per-lens evidence object the caller supplied; `subject` enables organ lookups.
 */
export function runLens(spec, ev, subject, opts = {}) {
  let data = ev ?? {};
  let wire;
  let organSource;

  // Organ-backed lenses fill gaps from coherence when the caller didn't supply them.
  if ((spec.id === "relations" || spec.id === "blastRadius") && completeness(spec.needs, data) < 1) {
    const organ = coherenceOrgan(subject);
    if (spec.id === "relations" && (organ.upstream.length || organ.downstream.length)) {
      data = { upstream: data.upstream?.length ? data.upstream : organ.upstream, downstream: data.downstream?.length ? data.downstream : organ.downstream };
      organSource = organ.source;
    }
    if (spec.id === "blastRadius" && organ.nodes.length) { data = { nodes: data.nodes?.length ? data.nodes : organ.nodes }; organSource = organ.source; }
    if (!organSource && completeness(spec.needs, data) === 0) {
      wire = spec.id === "blastRadius" ? "run `coherence ripple <subject>` to populate" : "run `coherence map` to populate";
    }
  }

  let confidence = completeness(spec.needs, data);
  const contradicted = data.contradicted === true;
  // STRESS — an unexamined claim is discounted (φ): no rebuttal considered ⇒ ×ψ.
  if (!opts.rebuttalConsidered) confidence *= PSI;
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(3))));

  const missing = spec.needs.filter((k) => {
    const v = data[k]; return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  });
  const evidence = [];
  if (organSource) evidence.push(organSource);
  for (const s of (data.sources || [])) evidence.push(s);

  return {
    lens: spec.id,
    q: spec.q,
    verdict: verdictFor(confidence, contradicted),
    confidence,
    finding: data.finding || data.summary || (missing.length ? `partial (${spec.needs.length - missing.length}/${spec.needs.length})` : "complete"),
    evidence,
    unknowns: missing.map((k) => `${spec.id}: missing ${k}`),
    ...(wire ? { wire } : {}),
  };
}

/** Run all 9 lenses over an evidence bundle. */
export function runAllLenses(subject, bundle = {}, opts = {}) {
  return LENSES.map((spec) => runLens(spec, bundle[spec.id], subject, opts));
}
