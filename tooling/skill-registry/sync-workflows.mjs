#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Workflow→Command Sync v1.1.0                              ║
// ║  Recognizes every AUTOMATED flow (.agents/workflows/*.md) and      ║
// ║  exposes it as a MANUAL /heady-* action (.claude/commands/*.md).   ║
// ║  A command is a relative SYMLINK to its workflow — the established  ║
// ║  convention — so the same flow is invokable both autonomously      ║
// ║  (workflow) and by hand (slash command) with ZERO possible drift.  ║
// ║  Idempotent: only (re)links when the target is missing or wrong.   ║
// ║  Companion to register.mjs (skills) + the governance-gate          ║
// ║  workflow-sync check (verifier).                                   ║
// ║                                                                    ║
// ║  Usage: node sync-workflows.mjs [--check] [--json]                 ║
// ║   --check  report drift, change nothing, exit 1 if out of sync     ║
// ║   (default) link missing/wrong commands, prune orphans            ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readdirSync, existsSync, mkdirSync, rmSync, symlinkSync, lstatSync, readlinkSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const SRC_DIR = join(REPO_ROOT, ".agents", "workflows");
const DEST_DIR = join(REPO_ROOT, ".claude", "commands");
// Relative link body so the repo stays portable across clone locations.
const LINK_PREFIX = join("..", "..", ".agents", "workflows");

function listWorkflows() {
  if (!existsSync(SRC_DIR)) return [];
  return readdirSync(SRC_DIR, { withFileTypes: true })
    .filter((e) => (e.isFile() || e.isSymbolicLink()) && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort();
}

// Every .md entry in commands, regardless of type (symlink or real file).
function listCommands() {
  if (!existsSync(DEST_DIR)) return [];
  return readdirSync(DEST_DIR, { withFileTypes: true })
    .filter((e) => e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort();
}

// A command is correctly synced iff it is a symlink resolving to its workflow.
function isCorrectLink(name) {
  const p = join(DEST_DIR, name);
  try {
    if (!lstatSync(p).isSymbolicLink()) return false;
    return readlinkSync(p) === join(LINK_PREFIX, name);
  } catch {
    return false;
  }
}

function plan() {
  const workflows = listWorkflows();
  const commands = new Set(listCommands());
  const toLink = []; // missing or not a correct symlink (e.g. stray real-file copy)
  for (const name of workflows) {
    if (!commands.has(name)) toLink.push({ name, reason: "missing" });
    else if (!isCorrectLink(name)) toLink.push({ name, reason: "not-a-symlink" });
  }
  const wfSet = new Set(workflows);
  const toPrune = [...commands].filter((name) => !wfSet.has(name));
  return { workflows, toLink, toPrune };
}

function main(argv) {
  const checkOnly = argv.includes("--check");
  const json = argv.includes("--json");
  const { workflows, toLink, toPrune } = plan();
  const inSync = toLink.length === 0 && toPrune.length === 0;

  if (!checkOnly) {
    if (!existsSync(DEST_DIR)) mkdirSync(DEST_DIR, { recursive: true });
    for (const { name } of toLink) {
      const target = join(DEST_DIR, name);
      rmSync(target, { force: true }); // remove stray file/broken link first
      symlinkSync(join(LINK_PREFIX, name), target);
    }
    for (const name of toPrune) rmSync(join(DEST_DIR, name), { force: true });
  }

  const summary = {
    inSync,
    workflows: workflows.length,
    linked: checkOnly ? 0 : toLink.length,
    pruned: checkOnly ? 0 : toPrune.length,
    needLink: toLink.map((w) => `${w.name} (${w.reason})`),
    orphans: toPrune,
  };

  if (json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } else if (checkOnly) {
    if (inSync) {
      process.stdout.write(`HEADY workflow→command sync: in sync — ${workflows.length} flows, each a manual /heady-* command (symlink)\n`);
    } else {
      process.stderr.write(`HEADY workflow→command sync: OUT OF SYNC\n`);
      for (const w of toLink) process.stderr.write(`  ✗ command ${w.reason}: ${w.name}\n`);
      for (const o of toPrune) process.stderr.write(`  ✗ orphan command (no workflow): ${o}\n`);
      process.stderr.write(`  → run: node ${relative(REPO_ROOT, fileURLToPath(import.meta.url))}\n`);
    }
  } else {
    process.stdout.write(
      `HEADY workflow→command sync: ${workflows.length} flows · linked ${summary.linked} · pruned ${summary.pruned} → ${relative(REPO_ROOT, DEST_DIR)}\n`
    );
  }

  process.exit(checkOnly && !inSync ? 1 : 0);
}

main(process.argv.slice(2));
