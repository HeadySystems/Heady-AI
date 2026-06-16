#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Skeleton Guard — Verify Placement v1.0.0                 ║
// ║  CSL-gated file placement validator — ensures every file lands    ║
// ║  in a recognized scaffold location per skeleton.json manifest.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Dependency-free (mirrors tooling/auto-flow/preflight.mjs).
// Takes a file path relative to the repo root and returns a CSL-gated
// decision: EXECUTE (allowed), CAUTIOUS (unusual but permitted),
// or HALT (misplaced — block).
//
// Usage:
//   node verify-placement.mjs path/to/new/file.mjs
//   node verify-placement.mjs --json path/to/new/file.mjs

import { readFileSync } from "node:fs";
import { join, dirname, extname, basename, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const SKELETON_PATH = join(HERE, "skeleton.json");

// φ-derived constants — no magic numbers (AGENTS.md #8).
const PHI = 1.618033988749895;
const HALT_THRESHOLD = 1 / (PHI * PHI); // ≈ 0.382
const EXECUTE_THRESHOLD = 1 / PHI;       // ≈ 0.618

/**
 * Load and parse skeleton.json. Fails closed on bad manifest (AGENTS.md #10).
 */
function loadSkeleton() {
  const raw = readFileSync(SKELETON_PATH, "utf8");
  const skeleton = JSON.parse(raw);
  if (!skeleton.directories || !Array.isArray(skeleton.directories)) {
    throw new Error("skeleton.json: missing or invalid 'directories' array");
  }
  if (!skeleton.rootFiles || !Array.isArray(skeleton.rootFiles)) {
    throw new Error("skeleton.json: missing or invalid 'rootFiles' array");
  }
  if (!skeleton.antiPatterns || !Array.isArray(skeleton.antiPatterns)) {
    throw new Error("skeleton.json: missing or invalid 'antiPatterns' array");
  }
  return skeleton;
}

/**
 * Convert a glob-style directory pattern to a regex for matching file paths.
 * Supports: ** (any depth), * (single segment), literal segments.
 */
function patternToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")  // escape regex specials (not * or ?)
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")      // placeholder for **
    .replace(/\*/g, "[^/]+")                 // * = one path segment
    .replace(/<<<GLOBSTAR>>>/g, ".*");       // ** = any depth
  return new RegExp(`^${escaped}(?:/.*)?$`);
}

/**
 * Check if a file path is excluded from auditing.
 */
function isExcluded(filePath, skeleton) {
  const excludes = skeleton.exclude || [];
  for (const ex of excludes) {
    if (filePath === ex || filePath.startsWith(`${ex}/`)) return true;
  }
  return false;
}

/**
 * Check if a file is an allowed root file.
 */
function isRootFile(filePath, skeleton) {
  // A root file has no directory separators.
  if (filePath.includes("/")) return false;
  return skeleton.rootFiles.includes(filePath);
}

/**
 * Check if a file sits directly inside a recognized root directory.
 * E.g., ".agents/" is recognized but ".agents/random.txt" at that level
 * would still need a matching directory rule.
 */
function isInRootDirectory(filePath, skeleton) {
  const firstSegment = filePath.split("/")[0];
  return (skeleton.rootDirectories || []).includes(firstSegment);
}

/**
 * Find the best matching directory rule for a file path.
 * More specific patterns (more segments) are preferred.
 */
function findMatchingRule(filePath, skeleton) {
  let bestMatch = null;
  let bestSpecificity = -1;

  for (const rule of skeleton.directories) {
    const regex = patternToRegex(rule.pattern);
    if (regex.test(filePath)) {
      // Specificity = number of literal path segments in the pattern.
      const specificity = rule.pattern.replace(/\*\*/g, "").split("/").filter(Boolean).length;
      if (specificity > bestSpecificity) {
        bestSpecificity = specificity;
        bestMatch = rule;
      }
    }
  }

  return bestMatch;
}

/**
 * Check anti-patterns — these are explicit disallowed placements.
 */
function checkAntiPatterns(filePath, skeleton) {
  for (const ap of skeleton.antiPatterns) {
    const regex = new RegExp(ap.pattern);
    if (regex.test(filePath)) {
      // Check exceptions.
      const fname = basename(filePath);
      if ((ap.except || []).includes(fname)) continue;
      return { violated: true, id: ap.id, message: ap.message };
    }
  }
  return { violated: false };
}

/**
 * Core verification function.
 *
 * @param {string} filePath - Path relative to repo root (forward slashes).
 * @returns {{ decision: 'EXECUTE'|'CAUTIOUS'|'HALT', reason: string, rule?: object, antiPattern?: object }}
 */
export function verifyPlacement(filePath) {
  // Normalize: strip leading ./ or /, use forward slashes.
  const normalized = filePath
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\//, "");

  const skeleton = loadSkeleton();

  // 1. Excluded paths pass unconditionally.
  if (isExcluded(normalized, skeleton)) {
    return { decision: "EXECUTE", reason: `Excluded from auditing (${normalized.split("/")[0]}/)` };
  }

  // 2. Anti-pattern check — reject first (fail closed).
  const ap = checkAntiPatterns(normalized, skeleton);
  if (ap.violated) {
    return {
      decision: "HALT",
      reason: `Anti-pattern [${ap.id}]: ${ap.message}`,
      antiPattern: ap,
    };
  }

  // 3. Root file check.
  if (!normalized.includes("/")) {
    if (isRootFile(normalized, skeleton)) {
      return { decision: "EXECUTE", reason: `Recognized root file: ${normalized}` };
    }
    return {
      decision: "HALT",
      reason: `Unrecognized file at repo root: ${normalized}. Add it to skeleton.json rootFiles or move it to an appropriate directory.`,
    };
  }

  // 4. Check the first segment is a recognized root directory.
  if (!isInRootDirectory(normalized, skeleton)) {
    const firstSegment = normalized.split("/")[0];
    return {
      decision: "HALT",
      reason: `Unrecognized root directory: ${firstSegment}/. Add it to skeleton.json rootDirectories or move the file to a recognized location.`,
    };
  }

  // 5. Find the best matching directory rule.
  const rule = findMatchingRule(normalized, skeleton);
  if (!rule) {
    return {
      decision: "HALT",
      reason: `No directory rule matches ${normalized}. The file may be in an unexpected subdirectory. Add a rule to skeleton.json or move the file.`,
    };
  }

  // 6. Wildcard extension = any type allowed (e.g., scratch/, dist/).
  if (rule.allowedExtensions.includes("*")) {
    return {
      decision: "EXECUTE",
      reason: `Matched rule [${rule.pattern}]: any extension allowed (${rule.purpose})`,
      rule,
    };
  }

  // 7. Check extension against the allowed list.
  const ext = extname(normalized).toLowerCase();
  if (!ext) {
    // Extensionless files (e.g., Dockerfile, LICENSE, .gitkeep).
    const fname = basename(normalized);
    // Known extensionless files are CAUTIOUS, not HALT.
    const knownExtensionless = new Set([
      "Dockerfile", "Makefile", "LICENSE", "Procfile",
      ".gitkeep", ".gitignore", ".dockerignore", ".editorconfig",
      ".prettierrc", ".eslintrc", ".npmrc", ".nvmrc", ".node-version",
      ".firebaserc", ".env", ".browserslistrc",
    ]);
    if (knownExtensionless.has(fname)) {
      return {
        decision: "CAUTIOUS",
        reason: `Known extensionless file ${fname} in ${rule.pattern} — allowed but unusual`,
        rule,
      };
    }
    return {
      decision: "CAUTIOUS",
      reason: `Extensionless file ${fname} in ${rule.pattern} — review manually`,
      rule,
    };
  }

  if (rule.allowedExtensions.includes(ext)) {
    return {
      decision: "EXECUTE",
      reason: `Matched rule [${rule.pattern}]: ${ext} is allowed (${rule.purpose})`,
      rule,
    };
  }

  // Extension not in the allowed list — CAUTIOUS if it is code-adjacent, HALT otherwise.
  const codeAdjacentExts = new Set([".map", ".d.ts", ".lock", ".yaml", ".yml", ".toml"]);
  if (codeAdjacentExts.has(ext)) {
    return {
      decision: "CAUTIOUS",
      reason: `${ext} is not in the allowed list for [${rule.pattern}] but is code-adjacent — review manually`,
      rule,
    };
  }

  return {
    decision: "HALT",
    reason: `Extension ${ext} is not allowed in [${rule.pattern}] (allowed: ${rule.allowedExtensions.join(", ")}). Move the file or update skeleton.json.`,
    rule,
  };
}

/**
 * Resolve an absolute file path to a repo-relative path.
 */
export function toRelative(absolutePath) {
  const rel = relative(REPO_ROOT, resolve(absolutePath));
  return rel.replace(/\\/g, "/");
}

// ── CLI ─────────────────────────────────────────────────────────────
function render(result, filePath) {
  const mark = { EXECUTE: "✅", CAUTIOUS: "▲ ", HALT: "✗ " };
  const lines = [
    "",
    `HEADY™ Skeleton Guard — verify-placement`,
    `  file:     ${filePath}`,
    `  decision: ${mark[result.decision]}${result.decision}`,
    `  reason:   ${result.reason}`,
    "",
  ];
  return lines.join("\n");
}

function main(argv) {
  const asJson = argv.includes("--json");
  const filePath = argv.filter((a) => a !== "--json").join(" ").trim();

  if (!filePath) {
    process.stderr.write(
      'verify-placement: provide a file path, e.g. node verify-placement.mjs packages/phi-math/src/index.mjs\n',
    );
    process.exitCode = 2;
    return;
  }

  const result = verifyPlacement(filePath);
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ file: filePath, ...result }, null, 2)}\n`);
  } else {
    process.stdout.write(render(result, filePath));
  }

  if (result.decision === "HALT") process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith("verify-placement.mjs")) {
  main(process.argv.slice(2));
}
