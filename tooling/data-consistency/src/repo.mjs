// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Repo-Context Builder v1.0.0                               ║
// ║  Gathers structural facts (ADRs, doc refs, task provenance)       ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// IO layer that assembles the `repo` context object consumed by the pure
// runStructuralChecks() in checker.mjs.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function expandHome(p) {
  return p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
}

/** List ADR files (docs/adr/NNNN-*.md). */
function readAdrFiles(repoRoot) {
  const dir = join(repoRoot, "docs", "adr");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}-.*\.md$/.test(f))
    .map((f) => ({ rel: `docs/adr/${f}` }));
}

/**
 * Parse the "Canonical planning documents" bullet list in SOURCE_OF_TRUTH.md
 * and any inline `docs/...md` reference, returning the doc paths it promises.
 */
function readPlanningDocs(repoRoot) {
  const sot = join(repoRoot, "SOURCE_OF_TRUTH.md");
  if (!existsSync(sot)) return [];
  const lines = readFileSync(sot, "utf8").split("\n");
  const refs = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].matchAll(/`(docs\/[A-Za-z0-9_\-/]+\.md)`/g);
    for (const m of matches) {
      const rel = m[1];
      if (rel.includes("…") || rel.includes("–")) continue;
      if (seen.has(rel)) continue;
      seen.add(rel);
      refs.push({ rel, from: "SOURCE_OF_TRUTH.md", line: i + 1 });
    }
  }
  return refs;
}

/**
 * Read every configs/*-tasks.json, extract each task's `source`, and resolve
 * the source's base filename against the rebuild + the current Heady build.
 */
function readTaskSources(repoRoot, legacyRoots) {
  const dir = join(repoRoot, "configs");
  if (!existsSync(dir)) return [];
  const roots = [repoRoot, ...legacyRoots.map(expandHome)].filter((r) => {
    try {
      return statSync(r).isDirectory();
    } catch {
      return false;
    }
  });
  const out = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith("-tasks.json"))) {
    const rel = `configs/${file}`;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (err) {
      out.push({
        taskId: "(parse)",
        source: file,
        resolved: false,
        configRel: rel,
        where: `JSON parse error: ${err.message}`,
      });
      continue;
    }
    for (const task of parsed.tasks ?? []) {
      if (!task.source) continue;
      const baseName = String(task.source).split(" - ")[0].trim();
      const resolved = roots.some((root) => fileFoundUnder(root, baseName));
      out.push({
        taskId: task.id ?? "(unknown)",
        source: task.source,
        baseName,
        resolved,
        configRel: rel,
        where: resolved ? "found" : "missing in rebuild + legacy",
      });
    }
  }
  return out;
}

/** Shallow-then-deep search for an exact filename under `root` (bounded). */
function fileFoundUnder(root, name, depth = 4) {
  const stack = [[root, 0]];
  while (stack.length) {
    const [dir, d] = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isFile() && e.name === name) return true;
      if (e.isDirectory() && d < depth && e.name !== "node_modules" && !e.name.startsWith(".git")) {
        stack.push([join(dir, e.name), d + 1]);
      }
    }
  }
  return false;
}

function readSupersededDocs(repoRoot, list) {
  return (list ?? [])
    .filter((rel) => existsSync(join(repoRoot, rel)))
    .map((rel) => ({ rel, content: readFileSync(join(repoRoot, rel), "utf8") }));
}

/** Assemble the full repo-context object for runStructuralChecks(). */
export function buildRepoContext(repoRoot, structural) {
  const legacyRoots = structural.legacySourceSearchRoots ?? [];
  return {
    adrFiles: readAdrFiles(repoRoot),
    planningDocs: readPlanningDocs(repoRoot),
    taskSources: readTaskSources(repoRoot, legacyRoots),
    supersededDocs: readSupersededDocs(repoRoot, structural.supersededDocsNeedBanner),
    fileExists: (rel) => existsSync(join(repoRoot, rel)),
  };
}
