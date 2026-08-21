#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Auto-Flow — Skill/Workflow Preflight v1.0.0              ║
// ║  Scans the whole skill + workflow catalog before a task and       ║
// ║  returns a CSL-gated shortlist of what could be beneficially used.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Step 0 of any Auto-Flow: "what do we already have that fits THIS task?"
// Dependency-free (mirrors the rest of tooling/ so it runs with zero install).
// Lexical TF-cosine over each pack's name + description + embedded Keywords list,
// then a CSL ternary gate (EXECUTE / CAUTIOUS / HALT) on the relevance score.
//
// Usage:
//   node preflight.mjs "task description text"
//   node preflight.mjs --json "task description text"

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const SKILLS_DIR = join(REPO_ROOT, ".agents", "skills");
const WORKFLOWS_DIR = join(REPO_ROOT, ".agents", "workflows");

// φ-derived gate thresholds (golden ratio) — no magic numbers (AGENTS.md #8).
const PHI = 1.618033988749895;
const HALT = 1 / (PHI * PHI); // 0.382 — below this: ignore
const EXECUTE = 1 / PHI; //      0.618 — at/above this: strongly recommended
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
const TOP_N = FIB[6]; // 13 — max shortlist length

const STOPWORDS = new Set(
  ("the a an and or of to in for on with use using when used this that any all into via across" +
    " is are be it as at by from your you we our heady heady™ keywords include such etc per each").split(/\s+/),
);

const EXPLICIT_REF = /(?:^|\s)[$/@]([a-z0-9][a-z0-9-]*)/gi;

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** TF vector (token → count). */
function vectorize(tokens) {
  const v = new Map();
  for (const t of tokens) v.set(t, (v.get(t) ?? 0) + 1);
  return v;
}

function cosine(a, b) {
  let dot = 0;
  for (const [t, w] of a) if (b.has(t)) dot += w * b.get(t);
  if (dot === 0) return 0;
  const mag = (m) => Math.sqrt([...m.values()].reduce((s, w) => s + w * w, 0));
  return dot / (mag(a) * mag(b));
}

/** Read the frontmatter `description` (inline or first content line) + name. */
function readMeta(file, fallbackName) {
  const raw = readFileSync(file, "utf8");
  const lines = raw.split("\n");
  let name = fallbackName;
  let description = "";
  // frontmatter is line 1 for registered skills; workflows have a description: line too
  const nameM = raw.match(/^name:\s*(.+)$/m);
  if (nameM) name = nameM[1].replace(/["']/g, "").trim();
  const descM = raw.match(/^description:\s*(.+)$/m);
  if (descM && descM[1].trim() && descM[1].trim() !== ">") {
    description = descM[1].replace(/["']/g, "").trim();
  } else {
    // block scalar: collect indented lines after `description:`
    const i = lines.findIndex((l) => /^description:/.test(l));
    if (i !== -1) {
      const parts = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\S/.test(lines[j]) && /^[A-Za-z0-9_-]+:/.test(lines[j])) break;
        if (lines[j].trim() === "---") break;
        parts.push(lines[j].trim());
      }
      description = parts.join(" ").trim();
    }
  }
  return { name, description };
}

function loadCatalog() {
  const items = [];
  if (existsSync(SKILLS_DIR)) {
    for (const d of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const f = join(SKILLS_DIR, d.name, "SKILL.md");
      if (!existsSync(f)) continue;
      const { name, description } = readMeta(f, d.name);
      items.push({ kind: "skill", ref: name, description, tokens: vectorize(tokenize(`${name} ${description}`)) });
    }
  }
  if (existsSync(WORKFLOWS_DIR)) {
    for (const f of readdirSync(WORKFLOWS_DIR).filter((x) => x.endsWith(".md"))) {
      const name = basename(f, ".md");
      const { description } = readMeta(join(WORKFLOWS_DIR, f), name);
      items.push({ kind: "workflow", ref: name, description, tokens: vectorize(tokenize(`${name} ${description}`)) });
    }
  }
  return items;
}

/** Explicit $skill, /workflow, and @command references in user order. */
function explicitRefs(taskText) {
  return [...String(taskText).matchAll(EXPLICIT_REF)].map((match) => match[1].toLowerCase());
}

/** Score every catalog item against the task; gate and rank. */
export function preflight(taskText) {
  const taskVec = vectorize(tokenize(taskText));
  const catalog = loadCatalog();
  const requested = explicitRefs(taskText);
  const requestedSet = new Set(requested);
  const requestOrder = new Map(requested.map((ref, index) => [ref, index]));
  const scored = catalog
    .map((it) => ({
      kind: it.kind,
      ref: it.ref,
      description: it.description,
      score: cosine(taskVec, it.tokens),
      explicit: requestedSet.has(it.ref.toLowerCase()),
    }))
    .sort((a, b) => {
      const aOrder = requestOrder.get(a.ref.toLowerCase()) ?? Number.POSITIVE_INFINITY;
      const bOrder = requestOrder.get(b.ref.toLowerCase()) ?? Number.POSITIVE_INFINITY;
      return aOrder - bOrder || Number(b.explicit) - Number(a.explicit) || b.score - a.score || a.ref.localeCompare(b.ref);
    });

  const top = scored.find((s) => s.score > 0)?.score ?? 0;
  const gate = (s) => {
    if (s.explicit) return "EXECUTE";
    // Tier on the score relative to the best available match (relative confidence).
    const rel = top > 0 ? s.score / top : 0;
    if (rel >= EXECUTE && s.score > 0) return "EXECUTE";
    if (rel >= HALT && s.score > 0) return "CAUTIOUS";
    return "HALT";
  };
  const ranked = scored.slice(0, TOP_N).map((s) => ({ ...s, decision: gate(s) }));
  return {
    task: taskText,
    catalogSize: catalog.length,
    explicitRefs: requested,
    unresolvedExplicitRefs: requested.filter((ref) => !catalog.some((item) => item.ref.toLowerCase() === ref)),
    recommended: ranked.filter((r) => r.decision !== "HALT"),
    shortlist: ranked,
    thresholds: { HALT, EXECUTE, basis: "score relative to best match (φ-tiered)" },
  };
}

function render(result) {
  const out = [];
  out.push("");
  out.push(`HEADY™ Auto-Flow preflight — scanned ${result.catalogSize} skills + workflows`);
  out.push(`  task: "${result.task}"`);
  out.push("");
  if (result.recommended.length === 0) {
    out.push("  no strong matches — proceed without a pre-existing skill/workflow (build from primitives).");
  } else {
    out.push(`  recommended (${result.recommended.length}):`);
  }
  const mark = { EXECUTE: "✅", CAUTIOUS: "▲", HALT: "·" };
  for (const r of result.shortlist) {
    out.push(`  ${mark[r.decision]} [${r.decision.padEnd(8)}] ${r.kind.padEnd(8)} ${r.ref}  (rel ${r.score.toFixed(3)})`);
    if (r.decision !== "HALT") out.push(`        ${r.description.slice(0, 140)}`);
  }
  out.push("");
  return out.join("\n");
}

function main(argv) {
  const asJson = argv.includes("--json");
  const task = argv.filter((a) => a !== "--json").join(" ").trim();
  if (!task) {
    process.stderr.write('preflight: provide a task, e.g. node preflight.mjs "refactor the auth service"\n');
    process.exitCode = 2;
    return;
  }
  const result = preflight(task);
  process.stdout.write(asJson ? `${JSON.stringify(result, null, 2)}\n` : render(result));
}

if (process.argv[1] && process.argv[1].endsWith("preflight.mjs")) {
  main(process.argv.slice(2));
}
