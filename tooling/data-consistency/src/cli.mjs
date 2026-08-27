#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Consistency Gate CLI v1.0.0                              ║
// ║  `heady-consistency check` — the single global data-consistency  ║
// ║  gate. Exit 1 on errors, 0 when clean. Used standalone and as the ║
// ║  gate inside the sync system.                                     ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { collectFiles } from "./scan.mjs";
import { buildRepoContext } from "./repo.mjs";
import { runChecks } from "./checker.mjs";
import { formatHuman, formatJson } from "./report.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = join(HERE, "..");
const REPO_ROOT = join(TOOL_ROOT, "..", "..");

export function loadInvariants(toolRoot = TOOL_ROOT) {
  const raw = readFileSync(join(toolRoot, "invariants.json"), "utf8");
  const cfg = JSON.parse(raw);
  if (!Array.isArray(cfg.invariants) || !cfg.scope || !cfg.structural) {
    throw new Error("invariants.json malformed: requires scope, invariants[], structural.");
  }
  for (const inv of cfg.invariants) {
    if (!inv.id || !inv.banned || !inv.severity || !inv.message) {
      throw new Error(`invariant missing required field (id/banned/severity/message): ${JSON.stringify(inv)}`);
    }
  }
  return cfg;
}

/** Run the gate against a repo root. Returns the checker result. */
export function check(repoRoot = REPO_ROOT, toolRoot = TOOL_ROOT) {
  const cfg = loadInvariants(toolRoot);
  const fileSets = collectFiles(repoRoot, cfg.scope);
  const repo = buildRepoContext(repoRoot, cfg.structural);
  return runChecks(fileSets, cfg.invariants, repo, cfg.structural);
}

function main(argv) {
  const asJson = argv.includes("--json");
  const strict = argv.includes("--strict"); // warnings also fail the gate
  let result;
  try {
    result = check();
  } catch (err) {
    process.stderr.write(`heady-consistency: ${err.message}\n`);
    process.exitCode = 2;
    return;
  }
  process.stdout.write(asJson ? `${formatJson(result)}\n` : formatHuman(result));
  const failed = !result.summary.ok || (strict && result.summary.warns > 0);
  process.exitCode = failed ? 1 : 0;
}

// Run main() only when this file is the program entry — exact realpath match (resolves the
// .bin symlink) so importing `check`/`loadInvariants` never triggers the CLI as a side effect.
function isProgramEntry() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isProgramEntry()) {
  main(process.argv.slice(2));
}
