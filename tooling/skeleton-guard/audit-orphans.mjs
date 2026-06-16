#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Skeleton Guard — Audit Orphans v1.0.0                    ║
// ║  Whole-repo scanner that verifies every authored file is in a    ║
// ║  recognized scaffold location per skeleton.json.                 ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Walks the entire repo tree (excluding node_modules, .git, .turbo, dist),
// runs verifyPlacement() on each file, and produces a color-coded report.
// Exits non-zero if any HALT-level violations are found (CI-friendly).
//
// Usage:
//   node audit-orphans.mjs
//   node audit-orphans.mjs --json
//   node audit-orphans.mjs --verbose

import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPlacement } from "./verify-placement.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

// Directories to skip entirely during the walk.
const SKIP_DIRS = new Set(["node_modules", ".git", ".turbo", "dist", ".firebase"]);

/**
 * Recursively walk a directory tree, yielding relative file paths.
 */
function* walk(dir, base = dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // skip directories we cannot read
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(full, base);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      yield relative(base, full).replace(/\\/g, "/");
    }
  }
}

/**
 * Run the full audit.
 */
export function auditOrphans() {
  const results = { execute: [], cautious: [], halt: [] };
  let total = 0;

  for (const filePath of walk(REPO_ROOT)) {
    total += 1;
    const result = verifyPlacement(filePath);
    const entry = { file: filePath, decision: result.decision, reason: result.reason };

    switch (result.decision) {
      case "EXECUTE":
        results.execute.push(entry);
        break;
      case "CAUTIOUS":
        results.cautious.push(entry);
        break;
      case "HALT":
        results.halt.push(entry);
        break;
      default:
        results.halt.push(entry);
    }
  }

  return { total, ...results };
}

// ── CLI rendering ───────────────────────────────────────────────────
function render(audit, verbose) {
  const lines = [
    "",
    "HEADY™ Skeleton Guard — Audit Report",
    `  scanned:    ${audit.total} files`,
    `  ✅ recognized: ${audit.execute.length}`,
    `  ▲  cautious:   ${audit.cautious.length}`,
    `  ✗  misplaced:  ${audit.halt.length}`,
    "",
  ];

  if (audit.halt.length > 0) {
    lines.push("  misplaced files:");
    for (const h of audit.halt) {
      lines.push(`    ✗ ${h.file}`);
      lines.push(`      → ${h.reason}`);
    }
    lines.push("");
  }

  if (audit.cautious.length > 0) {
    lines.push("  cautious files (review recommended):");
    for (const c of audit.cautious) {
      lines.push(`    ▲ ${c.file}`);
      lines.push(`      → ${c.reason}`);
    }
    lines.push("");
  }

  if (verbose && audit.execute.length > 0) {
    lines.push("  recognized files:");
    for (const e of audit.execute) {
      lines.push(`    ✅ ${e.file}`);
    }
    lines.push("");
  }

  if (audit.halt.length === 0) {
    lines.push("  ✅ Scaffold is clean — no misplaced files detected.");
    lines.push("");
  } else {
    lines.push(`  ✗ ${audit.halt.length} violation(s) found. Fix these or update skeleton.json.`);
    lines.push("");
  }

  return lines.join("\n");
}

function main(argv) {
  const asJson = argv.includes("--json");
  const verbose = argv.includes("--verbose");

  const audit = auditOrphans();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
  } else {
    process.stdout.write(render(audit, verbose));
  }

  if (audit.halt.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith("audit-orphans.mjs")) {
  main(process.argv.slice(2));
}
