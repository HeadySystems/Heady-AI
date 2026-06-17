// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Awareness — Intelligent Squash Proposer v1.0.0           ║
// ║  Groups a commit range by CSL-style cosine over a hybrid          ║
// ║  semantic+structural feature bag (subject/body tokens + touched    ║
// ║  scopes), synthesizes a coherent conventional-commit message per   ║
// ║  cluster, and emits the exact git command — but NEVER runs it.     ║
// ║  History rewriting is irreversible → autoApply:false,              ║
// ║  requiresHumanConfirmation:true (org rule: destructive ⇒ confirm). ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import * as g from "./git.mjs";
import { CSL_THRESHOLDS, FIB } from "../../../packages/phi-math/src/index.mjs";

// Cluster gate: two commits join when their feature cosine ≥ φ-threshold LOW (0.691).
const CLUSTER_TAU = CSL_THRESHOLDS.LOW;
// Touched-scope tokens count this many times in the bag — structure outweighs prose.
const SCOPE_WEIGHT = FIB[4]; // 3

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "via",
  "into", "over", "is", "are", "be", "this", "that", "it", "as", "at", "by",
]);

/** Conventional-commit type from a subject (feat/fix/chore/docs/refactor/…), or "chore". */
export function commitType(subject) {
  const m = /^(\w+)(?:\([^)]*\))?!?:/.exec(subject ?? "");
  return m ? m[1].toLowerCase() : "chore";
}

/** The meaningful scope of a touched path: the package/app/tool name, else top dir. */
export function scopeOf(file) {
  const parts = file.split("/");
  if ((parts[0] === "packages" || parts[0] === "apps" || parts[0] === "tooling") && parts[1]) {
    return parts[1];
  }
  return parts.length > 1 ? parts[0] : file; // root file → its own name
}

/** Lowercase word tokens, punctuation-stripped, stopwords + conventional prefix removed. */
function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/^(\w+)(\([^)]*\))?!?:/, "") // drop the "feat(scope):" prefix — it's not semantic content
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Build the term-frequency feature bag for a commit (prose + weighted scopes). */
function featureBag(commit) {
  const bag = new Map();
  const add = (tok, n = 1) => bag.set(tok, (bag.get(tok) ?? 0) + n);
  for (const t of tokenize(commit.subject)) add(t);
  for (const t of tokenize(commit.body)) add(t);
  const scopes = new Set(commit.files.map(scopeOf));
  for (const s of scopes) add(`scope:${s}`, SCOPE_WEIGHT);
  return bag;
}

/** Cosine similarity of two term-frequency bags ∈ [0,1]. */
export function cosineTF(a, b) {
  let dot = 0;
  for (const [k, v] of a) if (b.has(k)) dot += v * b.get(k);
  const norm = (m) => Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0));
  const na = norm(a);
  const nb = norm(b);
  return na === 0 || nb === 0 ? 0 : dot / (na * nb);
}

/** Most frequent value in a list (ties broken by first occurrence). */
function mode(values, fallback) {
  const counts = new Map();
  let best = fallback;
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

/** Greedy single-link clustering by feature cosine ≥ CLUSTER_TAU (oldest commit first). */
function cluster(commits) {
  const bags = commits.map(featureBag);
  const clusters = []; // { idx:number[], reps:Map[] }
  for (let i = 0; i < commits.length; i++) {
    let target = null;
    let bestSim = 0;
    for (const c of clusters) {
      const sim = Math.max(...c.idx.map((j) => cosineTF(bags[i], bags[j])));
      if (sim >= CLUSTER_TAU && sim > bestSim) {
        bestSim = sim;
        target = c;
      }
    }
    if (target) target.idx.push(i);
    else clusters.push({ idx: [i] });
  }
  return clusters.map((c) => c.idx.map((j) => commits[j]));
}

/** Synthesize one squashed conventional-commit message for a cluster of commits. */
function synthesize(group) {
  const type = mode(group.map((c) => commitType(c.subject)), "chore");
  const scope = mode(group.flatMap((c) => c.files.map(scopeOf)), null);
  const header = scope ? `${type}(${scope})` : type;
  // Summary = the cluster's largest commit subject (most files touched), prefix-stripped.
  const lead = [...group].sort((a, b) => b.files.length - a.files.length)[0];
  const summary = (lead.subject ?? "").replace(/^(\w+)(\([^)]*\))?!?:\s*/, "").trim() || "consolidated changes";
  const bullets = group.map((c) => `- ${c.subject} (${c.shortSha})`).join("\n");
  return {
    type,
    scope,
    message: `${header}: ${summary}`,
    body: `Squashes ${group.length} commit(s):\n${bullets}`,
    commits: group.map((c) => ({ sha: c.shortSha, subject: c.subject })),
    fileCount: new Set(group.flatMap((c) => c.files)).size,
  };
}

/**
 * Produce a NON-DESTRUCTIVE squash proposal for the commit range `base..head`.
 * Default base is the upstream tracking ref, else the merge-base with the
 * mainline. Returns clusters + suggested messages + the exact (UN-RUN) commands.
 *
 * @param {object} args
 * @param {string} args.repoRoot
 * @param {string} [args.base]  base ref; defaults to upstream → merge-base(main) → root
 * @param {string} [args.head]  head ref; defaults to "HEAD"
 * @param {string} [args.nowIso]
 * @returns {object} proposal — ALWAYS autoApply:false, requiresHumanConfirmation:true
 */
export function proposeSquash({ repoRoot, base, head = "HEAD", nowIso }) {
  const mainline = ["main", "master"].find((m) => g.git(repoRoot, ["rev-parse", "--verify", "--quiet", m]).ok);
  const resolvedBase =
    base ??
    g.upstream(repoRoot) ??
    (mainline ? g.mergeBase(repoRoot, mainline, head) : null);

  const proposal = {
    schema: "heady.awareness.squash/v1",
    generatedAt: nowIso,
    base: resolvedBase,
    head,
    autoApply: false, // awareness NEVER rewrites history unattended
    destructive: true,
    requiresHumanConfirmation: true,
  };

  if (!resolvedBase) {
    return { ...proposal, noop: true, reason: "no base ref (no upstream and no mainline merge-base)", clusters: [] };
  }

  const range = `${resolvedBase}..${head}`;
  const commits = g.log(repoRoot, range).reverse(); // oldest → newest for stable clustering
  if (commits.length <= 1) {
    return { ...proposal, noop: true, reason: `range ${range} has ${commits.length} commit(s) — nothing to squash`, range, clusters: [] };
  }

  const groups = cluster(commits);
  const clusters = groups.map(synthesize);
  const singleCluster = clusters.length === 1;

  // The exact commands a human can run after review — emitted, never executed.
  const commands = singleCluster
    ? [
        `git reset --soft ${resolvedBase}`,
        `git commit -m ${JSON.stringify(clusters[0].message)} -m ${JSON.stringify(clusters[0].body)}`,
      ]
    : [`git rebase -i ${resolvedBase}   # ${clusters.length} clusters detected — squash within each group below`];

  return {
    ...proposal,
    noop: false,
    range,
    commitCount: commits.length,
    clusterCount: clusters.length,
    clusterTau: CLUSTER_TAU,
    clusters,
    recommendation: singleCluster
      ? "Branch is cohesive — squash to a single commit."
      : `Branch spans ${clusters.length} themes — squash within each cluster, keep clusters separate.`,
    commands,
  };
}
