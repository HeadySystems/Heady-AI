#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Agent Handoff v1.1.0                                      ║
// ║  Catch the NEXT agent fully up to speed since the last handoff:    ║
// ║   • delta of commits + files since the stored checkpoint           ║
// ║   • verifies the change (law-lint · governance · enforcers ·       ║
// ║     coherence) and records pass/fail/execution-error               ║
// ║   • emits one agent-readable bundle (docs/handoff/HANDOFF-*.md)    ║
// ║     listing every file/doc/context source to read, in order        ║
// ║   • advances the checkpoint so the next run is incremental         ║
// ║                                                                    ║
// ║  Usage: node handoff.mjs [--since <ref>] [--out <path>] [--json]   ║
// ║         [--dry-run] [--no-verify]                                  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  loadCheckpoint, nextCheckpoint, parseNameStatus, parseCommits, renderBundle, FIELD_SEP,
} from "./core.mjs";
import { runGate } from "./gate-runner.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const CHECKPOINT_PATH = join(REPO_ROOT, ".data", "handoff", "checkpoint.json");
const ENFORCER = (name) => join("tooling", "enforcers", `${name}.mjs`);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
};

function git(args) {
  const r = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 1 << 24 });
  // trimEnd only — preserves the leading status column of `git status --porcelain` lines.
  return { code: r.status ?? 1, out: (r.stdout ?? "").replace(/\s+$/, ""), err: (r.stderr ?? "").trim() };
}

async function main() {
  if (git(["rev-parse", "--is-inside-work-tree"]).code !== 0) {
    process.stderr.write("handoff: not a git repository\n");
    process.exit(1);
  }
  process.chdir(REPO_ROOT);

  const nowIso = new Date().toISOString();
  const head = git(["rev-parse", "HEAD"]).out;
  const headShort = git(["rev-parse", "--short", "HEAD"]).out;
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).out;

  const prev = existsSync(CHECKPOINT_PATH) ? loadCheckpoint(readFileSync(CHECKPOINT_PATH, "utf8")) : null;
  let sinceRef = opt("--since", prev?.head ?? null);
  let firstRun = false;
  if (!sinceRef) {
    firstRun = true;
    const total = Number(git(["rev-list", "--count", "HEAD"]).out || "1");
    const n = Math.min(10, Math.max(1, total - 1));
    sinceRef = `HEAD~${n}`;
  }
  const range = `${sinceRef}..HEAD`;
  const sinceShort = git(["rev-parse", "--short", sinceRef]).out || sinceRef;

  const commits = parseCommits(
    git(["log", `--pretty=%h${FIELD_SEP}%s${FIELD_SEP}%an${FIELD_SEP}%ad`, "--date=short", range]).out
  );
  const files = parseNameStatus(git(["diff", "--name-status", range]).out);
  const stat = git(["diff", "--stat", range]).out;
  const uncommitted = git(["status", "--porcelain"]).out
    .split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  const candidateFiles = git(["ls-files", "--cached", "--others", "--exclude-standard"]).out
    .split("\n").filter(Boolean);

  // Verification — resilient: each gate captured, never aborts the handoff.
  let verification = [];
  if (!flag("--no-verify")) {
    const gates = [
      ["law-lint", ["tooling/law-lint/src/law-lint.mjs"]],
      ["governance", ["tooling/governance-gate/src/governance-gate.mjs", "all"]],
      ["no-loopback", [ENFORCER("no-localhost"), "--all"]], // heady-allow:no-localhost — gate-runner references the law by name
      ["glass-box", [ENFORCER("glass-box"), "--all"]],
      ["secret-scan", [ENFORCER("secret-scan"), "--all"]],
      ["zod-boundary", [ENFORCER("zod-boundary"), "--all"]],
      ["phi-timing", [ENFORCER("phi-timing"), "--all"]],
      ["projection-drift", ["tooling/projection-engine/bin/check-drift.mjs"]],
      ["coherence", ["tooling/coherence/src/coherence.mjs", "check", "--no-write"]],
    ];
    for (const [name, args] of gates) {
      verification.push(await runGate(name, args, { cwd: REPO_ROOT, candidateFiles }));
    }
  }

  const contextCandidates = [
    ["AGENTS.md", "system instructions + hard rules"],
    ["CLAUDE.md", "entry pointer"],
    ["CLAUDE_MEMORY.md", "prior handoff / project status"],
    [".data/awareness/context.json", "live repo snapshot (awareness)"],
    ["docs/LAW_TRANSFER_AUDIT.md", "law/enforcement state"],
    ["docs/HEADY_VARIABLE_REGISTRY.md", "canonical variables"],
  ];
  const contextFiles = contextCandidates.map(([path, note]) => ({
    path, note, exists: existsSync(join(REPO_ROOT, path)),
  }));

  const bundle = renderBundle({
    nowIso, head, headShort, branch, sinceRef, sinceShort, firstRun,
    commits, files, stat, verification, contextFiles, uncommitted,
  });

  // Write the bundle (docs/** allows .md only — skeleton-guard safe).
  const safeStamp = nowIso.replace(/[:.]/g, "-");
  const outPath = opt("--out", join(REPO_ROOT, "docs", "handoff", `HANDOFF-${safeStamp}.md`));
  if (!flag("--dry-run")) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, bundle);
    mkdirSync(dirname(CHECKPOINT_PATH), { recursive: true });
    writeFileSync(CHECKPOINT_PATH, JSON.stringify(nextCheckpoint(head, nowIso, prev), null, 2) + "\n");
  }

  if (flag("--json")) {
    process.stdout.write(JSON.stringify({
      firstRun, sinceShort, headShort, branch,
      commits: commits.length, files: files.length, uncommitted: uncommitted.length,
      verification, verificationSkipped: flag("--no-verify"), bundlePath: flag("--dry-run") ? null : outPath,
    }, null, 2) + "\n");
  } else {
    process.stdout.write(bundle);
    if (!flag("--dry-run")) process.stdout.write(`\n→ written: ${outPath}\n→ checkpoint advanced to ${headShort}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`handoff: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
});
