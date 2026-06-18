#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Report Distiller — docs → deterministic recipe            ║
// ║  HCFP Stage-20 DISTILL applied to DOCUMENTS (not exec traces):     ║
// ║  analyze a report corpus for structure + focus + the data-points   ║
// ║  that should be DERIVED, and emit (a) a recipe JSON and (b) a       ║
// ║  deterministic reproduction prompt + a starter .hbs template.      ║
// ║  Deterministic structural pass (no LLM); GEPA/MIPROv2 prompt-       ║
// ║  optimization is an optional layer on top (see distiller skill).   ║
// ║                                                                    ║
// ║  Usage: distill.mjs <docDirOrGlobRoot> [outRecipe.json]           ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const ROOT = resolve(new URL("../../..", import.meta.url).pathname);
const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: "report-distiller", level, msg, ...f })}\n`);

const STOP = new Set("the a an of to in for and or is are be on with by as at from this that it its into via per not no all any each every — the·".split(/\s+/));

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".md")) acc.push(p);
  }
  return acc;
}

// Map a numeric data-point's surrounding text to a likely canonical key (so it can be DERIVED).
function suggestCanonKey(context) {
  const c = context.toLowerCase();
  if (/patent/.test(c)) return "facts.company.patents_provisional";
  if (/stage/.test(c) && /pipeline|hcfp|hcfull/.test(c)) return "facts.hcfullpipeline.stage_count";
  if (/\bbee/.test(c)) return "facts.lexicon.bees";
  if (/\bagent/.test(c)) return "facts.lexicon.agents";
  if (/\bskill/.test(c)) return "facts.lexicon.skills";
  if (/\bdim|embedding|vector\(/.test(c)) return "facts.embedding.dim";
  if (/component|transfer group/.test(c)) return "(binding) ledger.decomposition.*";
  if (/contradiction|coherence/.test(c)) return "(binding) coherence.contradictions";
  return null; // free number — not obviously derivable
}

function analyzeDoc(abs) {
  const text = readFileSync(abs, "utf8");
  const headings = [];
  for (const m of text.matchAll(/^(#{1,4})\s+(.+)$/gm)) headings.push({ depth: m[1].length, title: m[2].trim() });
  // data-points: numbers with their line context + a derivability suggestion
  const dataPoints = [];
  for (const m of text.matchAll(/^.*?\b(\d{1,5})\+?\b.*$/gm)) {
    const line = m[0].trim();
    if (line.startsWith("|") && /^[-| :]+$/.test(line)) continue; // table rule
    const key = suggestCanonKey(line);
    if (key) dataPoints.push({ value: m[1], key, context: line.slice(0, 90) });
  }
  // focus terms: top content words across headings + first 1500 chars
  const freq = {};
  for (const w of (headings.map((h) => h.title).join(" ") + " " + text.slice(0, 1500)).toLowerCase().matchAll(/[a-z][a-z-]{3,}/g)) {
    const t = w[0]; if (!STOP.has(t)) freq[t] = (freq[t] || 0) + 1;
  }
  const focus = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  // shape signature: the sequence of depth-2 section titles (the report's skeleton)
  const shape = headings.filter((h) => h.depth === 2).map((h) => h.title.replace(/[`*]/g, "").split("—")[0].trim());
  return { headings: headings.length, depth2: shape.length, shape, focus, dataPoints: dataPoints.slice(0, 40) };
}

function run(target, outArg) {
  const base = resolve(ROOT, target || "docs/master-plan");
  if (!existsSync(base)) { log("error", "corpus path not found", { base }); process.exit(1); }
  const files = statSync(base).isDirectory() ? walk(base) : [base];
  const docs = {};
  let derivable = 0, freeNums = 0;
  for (const f of files) {
    const a = analyzeDoc(f);
    derivable += a.dataPoints.length;
    docs[relative(ROOT, f)] = a;
  }
  // Common shape = depth-2 titles appearing in ≥2 docs (the corpus's recurring skeleton)
  const titleCount = {};
  for (const d of Object.values(docs)) for (const t of d.shape) titleCount[t] = (titleCount[t] || 0) + 1;
  const commonShape = Object.entries(titleCount).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  // Corpus focus
  const allFocus = {};
  for (const d of Object.values(docs)) for (const t of d.focus) allFocus[t] = (allFocus[t] || 0) + 1;
  const corpusFocus = Object.entries(allFocus).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t]) => t);

  const recipe = {
    generatedFrom: relative(ROOT, base),
    docs: Object.keys(docs).length,
    corpusFocus,
    commonShape,
    derivableDataPoints: derivable,
    perDoc: docs,
    deterministicPrompt:
      `Produce a report on "${corpusFocus.slice(0, 4).join(", ")}". ` +
      `Use these depth-2 sections in order: ${commonShape.join(" · ") || "(per-doc)"}. ` +
      `Every load-bearing number MUST be injected from the golden record (heady-derive canon / a binding) — ` +
      `never typed inline; wrap counts in {{canon <key>}} or <!--heady:inject <key>-->. ` +
      `Match the corpus voice: dense, table-first, fail-closed claims, evidence paths. ` +
      `${derivable} derivable data-points were detected across ${Object.keys(docs).length} docs — bind them.`,
  };
  const out = resolve(ROOT, outArg || ".data/report-distiller/recipe.json");
  try { writeFileSync(out, JSON.stringify(recipe, null, 2)); } catch (e) { log("warn", "could not write recipe (dir missing?)", { out, err: String(e.message) }); }
  log("info", "distilled", { docs: recipe.docs, commonShape: commonShape.length, derivableDataPoints: derivable, recipe: relative(ROOT, out) });
  process.stdout.write(JSON.stringify(recipe.deterministicPrompt) + "\n");
}

const direct = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (direct) run(process.argv[2], process.argv[3]);
export { analyzeDoc };
