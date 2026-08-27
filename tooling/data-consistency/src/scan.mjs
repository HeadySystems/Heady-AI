// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Data-Consistency Scanner v1.0.0                           ║
// ║  Dependency-free filesystem discovery for the consistency gate    ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Walks the repository and returns the in-scope file set for the checker.
// No external deps (mirrors packages/embedding's dependency-free core so the
// gate runs with zero install). Scope/exclude rules come from invariants.json.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Recursively walk `dir`, returning absolute file paths whose extension is in
 * `exts` and whose repo-relative path is not excluded.
 */
function walk(dir, repoRoot, exts, excludeRel, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    // Unreadable directory is reported upstream, never silently swallowed.
    throw new Error(`scan: cannot read directory ${dir}: ${err.message}`);
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const rel = relative(repoRoot, abs).split(sep).join("/");
    if (isExcluded(rel, excludeRel)) continue;
    if (entry.isDirectory()) {
      walk(abs, repoRoot, exts, excludeRel, out);
    } else if (entry.isFile() && exts.some((e) => entry.name.endsWith(e))) {
      out.push({ abs, rel });
    }
  }
  return out;
}

function isExcluded(rel, excludeRel) {
  return excludeRel.some(
    (ex) => rel === ex || rel.startsWith(`${ex}/`) || rel.split("/").includes(ex),
  );
}

/**
 * Resolve the scope from invariants.json into two labelled file sets.
 * @returns {{canonical: Array<{abs,rel,content}>, extended: Array<{abs,rel,content}>}}
 */
export function collectFiles(repoRoot, scope) {
  const exts = scope.exts ?? [".md", ".json"];
  const exclude = scope.exclude ?? [];

  const canonicalAbs = new Map();
  for (const f of scope.canonicalFiles ?? []) {
    const abs = join(repoRoot, f);
    try {
      statSync(abs);
      canonicalAbs.set(abs, { abs, rel: f });
    } catch {
      // A declared canonical file that is missing is a finding, surfaced by
      // the structural planning-docs check — not the scanner's concern.
    }
  }
  for (const root of scope.canonicalRoots ?? []) {
    const abs = join(repoRoot, root);
    let exists = true;
    try {
      statSync(abs);
    } catch {
      exists = false;
    }
    if (exists) {
      for (const file of walk(abs, repoRoot, exts, exclude, [])) {
        canonicalAbs.set(file.abs, file);
      }
    }
  }

  const extendedAbs = new Map();
  for (const root of scope.extendedRoots ?? []) {
    const abs = join(repoRoot, root);
    let exists = true;
    try {
      statSync(abs);
    } catch {
      exists = false;
    }
    if (exists) {
      for (const file of walk(abs, repoRoot, exts, exclude, [])) {
        if (!canonicalAbs.has(file.abs)) extendedAbs.set(file.abs, file);
      }
    }
  }

  const hydrate = (entry) => ({
    ...entry,
    content: readFileSync(entry.abs, "utf8"),
  });

  return {
    canonical: [...canonicalAbs.values()].map(hydrate),
    extended: [...extendedAbs.values()].map(hydrate),
  };
}
